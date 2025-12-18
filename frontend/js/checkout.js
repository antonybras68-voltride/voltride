// =====================================================
// VOLTRIDE - Check-out (Version 2.0 - avec KM Motos & Maintenance)
// =====================================================

let currentStep = 1;
let selectedContract = null;
let activeContracts = [];
let accessoriesStatus = {};
let inspectionData = {};
let additionalDamages = [];
let ticketPhotoData = null;
let endKmValue = null;

// Types de véhicules motorisés
const MOTORIZED_TYPES = ['scooter', 'e-motocross', 'emotocross', 'e_motocross', 'moto', 'motocross'];

// Valeurs des accessoires (à déduire si non rendus)
const accessoryValues = {
  'lock': { name: 'Candado', value: 15 },
  'helmet': { name: 'Casco', value: 25 },
  'basket': { name: 'Cesta', value: 20 },
  'phone_holder': { name: 'Soporte Móvil', value: 15 },
  'child_seat': { name: 'Silla Niño', value: 40 },
  'panniers': { name: 'Alforjas', value: 30 },
  'gps': { name: 'GPS', value: 50 },
  'rain_cover': { name: 'Chubasquero', value: 10 }
};

// =====================================================
// Utilitaires
// =====================================================

function isMotorizedVehicle(type) {
  if (!type) return false;
  const normalizedType = type.toLowerCase().replace(/[-_\s]/g, '');
  return MOTORIZED_TYPES.some(t => normalizedType.includes(t.replace(/[-_\s]/g, '')));
}

// =====================================================
// Initialisation
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('voltride_token');
  if (!token) {
    window.location.href = '/';
    return;
  }
  
  const user = JSON.parse(localStorage.getItem('voltride_user') || '{}');
  document.getElementById('agencyName').textContent = user.agency_name || 'Voltride';
  
  await loadActiveContracts();
});

// =====================================================
// Load Active Contracts
// =====================================================

async function loadActiveContracts() {
  try {
    const user = JSON.parse(localStorage.getItem('voltride_user') || '{}');
    const response = await fetch(`/api/checkout/active?agency_id=${user.agency_id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('voltride_token')}` }
    });
    
    if (!response.ok) throw new Error('Error loading contracts');
    
    activeContracts = await response.json();
    renderContracts();
  } catch (e) {
    console.error('Error:', e);
    document.getElementById('contractsGrid').innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--danger);">
        Error al cargar los contratos: ${e.message}
      </div>
    `;
  }
}

function renderContracts() {
  const grid = document.getElementById('contractsGrid');
  
  if (activeContracts.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        No hay contratos activos para check-out
      </div>
    `;
    return;
  }
  
  grid.innerHTML = activeContracts.map(contract => {
    const startDate = new Date(contract.start_date);
    const endDate = new Date(contract.planned_end_date);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const isMotorized = isMotorizedVehicle(contract.vehicle_type);
    const vehicleIcon = contract.vehicle_type === 'bike' ? '🚲' : contract.vehicle_type === 'ebike' ? '⚡' : '🛵';
    
    let accessories = [];
    if (contract.notes && contract.notes.includes('Accesorios:')) {
      const accStr = contract.notes.replace('Accesorios:', '').trim();
      accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
    }
    
    return `
      <div class="contract-card ${selectedContract?.id === contract.id ? 'selected' : ''}" 
           onclick="selectContract(${contract.id})">
        <div class="contract-number">${contract.contract_number}</div>
        <div class="contract-info">
          <div class="contract-info-row">
            <span class="contract-info-label">Cliente:</span>
            <span class="contract-info-value">${contract.first_name} ${contract.last_name}</span>
          </div>
          <div class="contract-info-row">
            <span class="contract-info-label">Email:</span>
            <span class="contract-info-value">${contract.email || 'Sin email'}</span>
          </div>
          <div class="contract-info-row">
            <span class="contract-info-label">Vehículo:</span>
            <span class="contract-info-value">${vehicleIcon} ${contract.vehicle_code}</span>
          </div>
          ${isMotorized && contract.current_km ? `
          <div class="contract-info-row">
            <span class="contract-info-label">KM Inicio:</span>
            <span class="contract-info-value" style="color: var(--info);">${contract.start_km || contract.current_km} km</span>
          </div>
          ` : ''}
          ${isMotorized && contract.license_plate ? `
          <div class="contract-info-row">
            <span class="contract-info-label">Matrícula:</span>
            <span class="contract-info-value">${contract.license_plate}</span>
          </div>
          ` : ''}
          <div class="contract-info-row">
            <span class="contract-info-label">Depósito:</span>
            <span class="contract-info-value" style="color: var(--success);">${parseFloat(contract.deposit).toFixed(2)}€</span>
          </div>
        </div>
        ${accessories.length > 0 ? `
          <div class="contract-accessories">
            ${accessories.map(a => `<span class="accessory-tag">${a}</span>`).join('')}
          </div>
        ` : ''}
        ${isMotorized ? `
          <div style="background: var(--warning); color: var(--bg-dark); padding: 5px 10px; border-radius: 5px; font-size: 0.8rem; margin-top: 10px; text-align: center;">
            🏍️ Vehículo motorizado - KM requerido
          </div>
        ` : ''}
        <div class="contract-dates">
          ${startDate.toLocaleDateString('es-ES')} → ${endDate.toLocaleDateString('es-ES')} (${days} días)
        </div>
      </div>
    `;
  }).join('');
}

function selectContract(id) {
  selectedContract = activeContracts.find(c => c.id === id);
  endKmValue = null;
  renderContracts();
  document.getElementById('btnNext1').disabled = !selectedContract;
}

// =====================================================
// Accessories Verification
// =====================================================

function renderAccessories() {
  const list = document.getElementById('accessoriesList');
  const isMotorized = selectedContract && isMotorizedVehicle(selectedContract.vehicle_type);
  
  // Section KM pour véhicules motorisés
  let kmSection = '';
  if (isMotorized) {
    const startKm = selectedContract.start_km || selectedContract.current_km || 0;
    kmSection = `
      <div style="background: linear-gradient(135deg, var(--warning) 0%, #f59e0b 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; color: var(--bg-dark);">
        <h3 style="margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;">
          🏍️ Kilométrage - Vehículo Motorizado
        </h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <label style="font-size: 0.85rem; opacity: 0.8;">KM Inicio</label>
            <div style="font-size: 1.5rem; font-weight: bold;">${startKm.toLocaleString()} km</div>
          </div>
          <div>
            <label style="font-size: 0.85rem; opacity: 0.8;">KM Fin (actual) *</label>
            <input type="number" id="endKmInput" class="form-control" 
                   value="${endKmValue || ''}" 
                   min="${startKm}"
                   placeholder="Introducir km actual"
                   onchange="updateEndKm(this.value)"
                   style="font-size: 1.2rem; font-weight: bold; text-align: center; background: white; color: var(--bg-dark);">
          </div>
        </div>
        <div id="kmTraveledInfo" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.2); display: ${endKmValue ? 'block' : 'none'};">
          <span style="font-size: 0.9rem;">KM Recorridos: </span>
          <strong id="kmTraveledValue">${endKmValue ? (endKmValue - startKm).toLocaleString() : 0} km</strong>
        </div>
      </div>
    `;
  }
  
  // Section accessoires
  if (!selectedContract || !selectedContract.notes) {
    list.innerHTML = kmSection + `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        ✅ No hay accesorios registrados para este contrato
      </div>
    `;
    return;
  }
  
  let accessories = [];
  if (selectedContract.notes.includes('Accesorios:')) {
    const accStr = selectedContract.notes.replace('Accesorios:', '').trim();
    accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
  }
  
  if (accessories.length === 0) {
    list.innerHTML = kmSection + `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        ✅ No hay accesorios registrados para este contrato
      </div>
    `;
    return;
  }
  
  const startDate = new Date(selectedContract.start_date);
  const endDate = new Date(selectedContract.planned_end_date);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  list.innerHTML = kmSection + accessories.map((accName, index) => {
    const accKey = Object.keys(accessoryValues).find(k => 
      accessoryValues[k].name.toLowerCase() === accName.toLowerCase()
    );
    const accValue = accKey ? accessoryValues[accKey].value : 20;
    
    if (accessoriesStatus[index] === undefined) {
      accessoriesStatus[index] = false;
    }
    
    const isReturned = accessoriesStatus[index];
    
    return `
      <div class="accessory-check-item ${isReturned ? 'returned' : 'missing'}">
        <div class="accessory-check-left">
          <input type="checkbox" class="accessory-check-checkbox" 
                 ${isReturned ? 'checked' : ''} 
                 onchange="toggleAccessory(${index})">
          <div class="accessory-check-info">
            <h4>${accName}</h4>
            <p>Alquilado por ${days} día(s)</p>
          </div>
        </div>
        <div class="accessory-check-value">
          <div class="price">${isReturned ? '✅' : `-${accValue.toFixed(2)}€`}</div>
          <div class="label">${isReturned ? 'Devuelto' : 'Valor si no devuelto'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateEndKm(value) {
  const startKm = selectedContract.start_km || selectedContract.current_km || 0;
  endKmValue = parseInt(value) || null;
  
  const infoDiv = document.getElementById('kmTraveledInfo');
  const valueSpan = document.getElementById('kmTraveledValue');
  
  if (endKmValue && endKmValue >= startKm) {
    infoDiv.style.display = 'block';
    valueSpan.textContent = (endKmValue - startKm).toLocaleString() + ' km';
  } else {
    infoDiv.style.display = 'none';
  }
}

function toggleAccessory(index) {
  accessoriesStatus[index] = !accessoriesStatus[index];
  renderAccessories();
}

function selectAllAccessories() {
  let accessories = [];
  if (selectedContract?.notes?.includes('Accesorios:')) {
    const accStr = selectedContract.notes.replace('Accesorios:', '').trim();
    accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
  }
  
  accessories.forEach((_, index) => {
    accessoriesStatus[index] = true;
  });
  
  renderAccessories();
}

// =====================================================
// Vehicle Inspection
// =====================================================

function renderInspection() {
  const container = document.getElementById('vehicleInspections');
  
  if (!selectedContract) {
    container.innerHTML = '<p>No hay vehículo seleccionado</p>';
    return;
  }
  
  const isMotorized = isMotorizedVehicle(selectedContract.vehicle_type);
  const vehicleIcon = selectedContract.vehicle_type === 'bike' ? '🚲' : 
                      selectedContract.vehicle_type === 'ebike' ? '⚡' : '🛵';
  
  if (!inspectionData[selectedContract.vehicle_id]) {
    inspectionData[selectedContract.vehicle_id] = {
      chassis: 'excelente',
      wheels: 'excelente',
      lights: 'excelente',
      brakes: 'excelente',
      battery: 'excelente',
      cleaning: 'limpio',
      checkoutPhotoLeft: null,
      checkoutPhotoRight: null,
      damagePhotos: []
    };
  }
  
  const inspection = inspectionData[selectedContract.vehicle_id];
  
  // Options supplémentaires pour motos
  const motorizedInspection = isMotorized ? `
    <div class="inspection-item">
      <label>Motor</label>
      <select onchange="updateInspection(${selectedContract.vehicle_id}, 'motor', this.value)">
        <option value="excelente" ${inspection.motor === 'excelente' ? 'selected' : ''}>✅ Funciona bien</option>
        <option value="ruido" ${inspection.motor === 'ruido' ? 'selected' : ''}>⚠️ Ruido anormal (Mant.)</option>
        <option value="no_arranca" ${inspection.motor === 'no_arranca' ? 'selected' : ''}>❌ No arranca (Mant.)</option>
      </select>
    </div>
    <div class="inspection-item">
      <label>Suspensión</label>
      <select onchange="updateInspection(${selectedContract.vehicle_id}, 'suspension', this.value)">
        <option value="excelente" ${inspection.suspension === 'excelente' ? 'selected' : ''}>✅ Excelente</option>
        <option value="blanda" ${inspection.suspension === 'blanda' ? 'selected' : ''}>⚠️ Blanda (Mant.)</option>
        <option value="dura" ${inspection.suspension === 'dura' ? 'selected' : ''}>⚠️ Dura (Mant.)</option>
      </select>
    </div>
  ` : '';
  
  container.innerHTML = `
    <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h3 style="margin-bottom: 20px;">${vehicleIcon} ${selectedContract.vehicle_code} - ${selectedContract.brand || ''} ${selectedContract.model || ''}</h3>
      ${isMotorized && selectedContract.license_plate ? `<p style="color: var(--text-secondary); margin-bottom: 15px;">Matrícula: <strong>${selectedContract.license_plate}</strong></p>` : ''}
      
      <div class="inspection-grid">
        <div class="inspection-item">
          <label>Cuadro/Chasis</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'chassis', this.value)">
            <option value="excelente" ${inspection.chassis === 'excelente' ? 'selected' : ''}>✅ Excelente</option>
            <option value="rayado" ${inspection.chassis === 'rayado' ? 'selected' : ''}>⚠️ Rayado (-10€)</option>
            <option value="tordu" ${inspection.chassis === 'tordu' ? 'selected' : ''}>❌ Torcido (-50€)</option>
          </select>
        </div>
        
        <div class="inspection-item">
          <label>Neumáticos/Ruedas</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'wheels', this.value)">
            <option value="excelente" ${inspection.wheels === 'excelente' ? 'selected' : ''}>✅ Excelente</option>
            <option value="crevé" ${inspection.wheels === 'crevé' ? 'selected' : ''}>🔧 Pinchado (Mant.)</option>
            <option value="voilé" ${inspection.wheels === 'voilé' ? 'selected' : ''}>❌ Doblada (-15€ + Mant.)</option>
          </select>
        </div>
        
        <div class="inspection-item">
          <label>Luces</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'lights', this.value)">
            <option value="excelente" ${inspection.lights === 'excelente' ? 'selected' : ''}>✅ Excelente</option>
            <option value="no_funciona" ${inspection.lights === 'no_funciona' ? 'selected' : ''}>🔧 No funciona (Mant.)</option>
            <option value="cassé" ${inspection.lights === 'cassé' ? 'selected' : ''}>❌ Rota/Ausente (-20€)</option>
          </select>
        </div>
        
        <div class="inspection-item">
          <label>Frenos</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'brakes', this.value)">
            <option value="excelente" ${inspection.brakes === 'excelente' ? 'selected' : ''}>✅ Excelente</option>
            <option value="gastados" ${inspection.brakes === 'gastados' ? 'selected' : ''}>⚠️ Gastados (Mant.)</option>
            <option value="defectuoso" ${inspection.brakes === 'defectuoso' ? 'selected' : ''}>❌ Defectuoso (Mant. URGENTE)</option>
          </select>
        </div>
        
        ${motorizedInspection}
        
        <div class="inspection-item">
          <label>Batería</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'battery', this.value)">
            <option value="excelente" ${inspection.battery === 'excelente' ? 'selected' : ''}>✅ Carga OK</option>
            <option value="faible" ${inspection.battery === 'faible' ? 'selected' : ''}>⚠️ Carga baja</option>
            <option value="defectuosa" ${inspection.battery === 'defectuosa' ? 'selected' : ''}>❌ Defectuosa (Mant.)</option>
          </select>
        </div>
        
        <div class="inspection-item">
          <label>Limpieza</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'cleaning', this.value)">
            <option value="limpio" ${inspection.cleaning === 'limpio' ? 'selected' : ''}>✅ Limpio</option>
            <option value="medio" ${inspection.cleaning === 'medio' ? 'selected' : ''}>😐 Medio</option>
            <option value="sale" ${inspection.cleaning === 'sale' ? 'selected' : ''}>❌ Sucio (-6€)</option>
          </select>
        </div>
        
        <div class="inspection-item">
          <label>Estado General</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'general', this.value)">
            <option value="excelente">✅ Excelente</option>
            <option value="bueno">👍 Bueno</option>
            <option value="regular">😐 Regular</option>
            <option value="malo">❌ Malo</option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="photo-comparison">
      <h3>Comparación de Fotos (Antes / Después)</h3>
      <p style="color: var(--text-secondary); margin-bottom: 15px;">Compara el estado del vehículo al inicio y al final del alquiler</p>
      
      <div class="photo-comparison-grid">
        <div class="photo-side">
          <h4>Lado Izquierdo</h4>
          <div class="photo-columns">
            <div>
              <div class="photo-box">
                ${selectedContract.checkin_photo_left ? 
                  `<img src="${selectedContract.checkin_photo_left}" alt="Check-in">` : 
                  'Sin foto'}
              </div>
              <div class="photo-label">CHECK-IN</div>
            </div>
            <div>
              <div class="photo-box clickable" onclick="captureInspectionPhoto(${selectedContract.vehicle_id}, 'left')">
                ${inspection.checkoutPhotoLeft ? 
                  `<img src="${inspection.checkoutPhotoLeft}" alt="Check-out">` : 
                  '+ Foto'}
              </div>
              <div class="photo-label">CHECK-OUT</div>
            </div>
          </div>
        </div>
        
        <div class="photo-side">
          <h4>Lado Derecho</h4>
          <div class="photo-columns">
            <div>
              <div class="photo-box">
                ${selectedContract.checkin_photo_right ? 
                  `<img src="${selectedContract.checkin_photo_right}" alt="Check-in">` : 
                  'Sin foto'}
              </div>
              <div class="photo-label">CHECK-IN</div>
            </div>
            <div>
              <div class="photo-box clickable" onclick="captureInspectionPhoto(${selectedContract.vehicle_id}, 'right')">
                ${inspection.checkoutPhotoRight ? 
                  `<img src="${inspection.checkoutPhotoRight}" alt="Check-out">` : 
                  '+ Foto'}
              </div>
              <div class="photo-label">CHECK-OUT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="additional-photos">
      <h3>Fotos Adicionales (Daños)</h3>
      <p style="color: var(--text-secondary); margin-bottom: 15px;">Añade fotos de cualquier daño encontrado</p>
      
      <div class="damage-photos-grid" id="damagePhotosGrid">
        ${(inspection.damagePhotos || []).map((photo, i) => `
          <div class="damage-photo-box">
            <img src="${photo}" alt="Daño ${i+1}">
          </div>
        `).join('')}
        <div class="damage-photo-box" onclick="captureDamagePhoto(${selectedContract.vehicle_id})">
          + Añadir
        </div>
      </div>
    </div>
    
    <input type="file" id="inspectionPhotoInput" accept="image/*" capture="environment" style="display: none;">
    <input type="file" id="damagePhotoInput" accept="image/*" capture="environment" style="display: none;">
  `;
}

function updateInspection(vehicleId, field, value) {
  if (!inspectionData[vehicleId]) {
    inspectionData[vehicleId] = {};
  }
  inspectionData[vehicleId][field] = value;
}

let currentPhotoTarget = null;

function captureInspectionPhoto(vehicleId, side) {
  currentPhotoTarget = { vehicleId, side, type: 'inspection' };
  document.getElementById('inspectionPhotoInput').click();
}

function captureDamagePhoto(vehicleId) {
  currentPhotoTarget = { vehicleId, type: 'damage' };
  document.getElementById('damagePhotoInput').click();
}

document.addEventListener('change', function(e) {
  if (e.target.id === 'inspectionPhotoInput' && currentPhotoTarget) {
    handleInspectionPhoto(e.target);
  }
  if (e.target.id === 'damagePhotoInput' && currentPhotoTarget) {
    handleDamagePhoto(e.target);
  }
});

function handleInspectionPhoto(input) {
  if (input.files && input.files[0] && currentPhotoTarget) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const { vehicleId, side } = currentPhotoTarget;
      if (side === 'left') {
        inspectionData[vehicleId].checkoutPhotoLeft = e.target.result;
      } else {
        inspectionData[vehicleId].checkoutPhotoRight = e.target.result;
      }
      renderInspection();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function handleDamagePhoto(input) {
  if (input.files && input.files[0] && currentPhotoTarget) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const { vehicleId } = currentPhotoTarget;
      if (!inspectionData[vehicleId].damagePhotos) {
        inspectionData[vehicleId].damagePhotos = [];
      }
      inspectionData[vehicleId].damagePhotos.push(e.target.result);
      renderInspection();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// =====================================================
// Summary & Finalize
// =====================================================

function renderSummary() {
  if (!selectedContract) return;
  
  const startDate = new Date(selectedContract.start_date);
  const endDate = new Date(selectedContract.planned_end_date);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const isMotorized = isMotorizedVehicle(selectedContract.vehicle_type);
  const vehicleIcon = selectedContract.vehicle_type === 'bike' ? '🚲' : 
                      selectedContract.vehicle_type === 'ebike' ? '⚡' : '🛵';
  
  // Info KM pour motos
  let kmInfo = '';
  if (isMotorized) {
    const startKm = selectedContract.start_km || selectedContract.current_km || 0;
    const kmTraveled = endKmValue ? endKmValue - startKm : 0;
    kmInfo = `
      <div class="summary-row" style="background: var(--bg-secondary); padding: 10px; border-radius: 8px; margin: 10px 0;">
        <span>KM Recorridos:</span>
        <span style="color: var(--info);"><strong>${startKm.toLocaleString()} → ${(endKmValue || startKm).toLocaleString()} km</strong> (${kmTraveled.toLocaleString()} km)</span>
      </div>
    `;
  }
  
  document.getElementById('contractSummary').innerHTML = `
    <div class="summary-row">
      <span>Contrato:</span>
      <span><strong>${selectedContract.contract_number}</strong></span>
    </div>
    <div class="summary-row">
      <span>Cliente:</span>
      <span>${selectedContract.first_name} ${selectedContract.last_name}</span>
    </div>
    <div class="summary-row">
      <span>Email:</span>
      <span>${selectedContract.email || 'Sin email'}</span>
    </div>
    <div class="summary-row">
      <span>Vehículo:</span>
      <span>${vehicleIcon} ${selectedContract.vehicle_code} (${selectedContract.brand || ''} ${selectedContract.model || ''})</span>
    </div>
    <div class="summary-row">
      <span>Período:</span>
      <span>${days} día(s)</span>
    </div>
    ${kmInfo}
  `;
  
  const deductions = calculateDeductions();
  const deposit = parseFloat(selectedContract.deposit) || 0;
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const toRefund = Math.max(0, deposit - totalDeductions);
  
  const deductionsBox = document.getElementById('deductionsBox');
  if (deductions.length > 0) {
    deductionsBox.style.display = 'block';
    document.getElementById('deductionsList').innerHTML = deductions.map(d => `
      <div class="summary-row deduction">
        <span>${d.description}</span>
        <span>-${d.amount.toFixed(2)}€</span>
      </div>
    `).join('') + `
      <div class="summary-row" style="font-weight: bold; border-top: 1px solid var(--border); padding-top: 10px;">
        <span>Total Deducciones:</span>
        <span style="color: var(--danger);">-${totalDeductions.toFixed(2)}€</span>
      </div>
    `;
  } else {
    deductionsBox.style.display = 'none';
  }
  
  document.getElementById('depositToRefund').textContent = toRefund.toFixed(2) + '€';
  
  const depositMethod = selectedContract.deposit_method || 'cash';
  const refundMethodsContainer = document.getElementById('refundMethods');
  
  if (depositMethod === 'preauth') {
    refundMethodsContainer.innerHTML = `
      <div class="refund-method selected">
        <div class="refund-method-icon">💳</div>
        <div class="refund-method-name">Pre-autorización</div>
        <div class="refund-method-desc">Cancelar la pre-autorización</div>
      </div>
      <div class="refund-method disabled">
        <div class="refund-method-icon">💵</div>
        <div class="refund-method-name">Efectivo</div>
        <div class="refund-method-desc">No disponible (pago original: tarjeta)</div>
      </div>
    `;
    document.getElementById('refundMethodDisplay').textContent = 'Devolver vía: Cancelación Pre-autorización';
    document.getElementById('photoTicketBox').style.display = 'block';
  } else {
    refundMethodsContainer.innerHTML = `
      <div class="refund-method disabled">
        <div class="refund-method-icon">💳</div>
        <div class="refund-method-name">Pre-autorización</div>
        <div class="refund-method-desc">No disponible (pago original: efectivo)</div>
      </div>
      <div class="refund-method selected">
        <div class="refund-method-icon">💵</div>
        <div class="refund-method-name">Efectivo</div>
        <div class="refund-method-desc">Devolver en efectivo</div>
      </div>
    `;
    document.getElementById('refundMethodDisplay').textContent = 'Devolver vía: Efectivo';
    document.getElementById('photoTicketBox').style.display = 'none';
  }
}

function calculateDeductions() {
  const deductions = [];
  
  if (selectedContract?.notes?.includes('Accesorios:')) {
    const accStr = selectedContract.notes.replace('Accesorios:', '').trim();
    const accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
    
    accessories.forEach((accName, index) => {
      if (!accessoriesStatus[index]) {
        const accKey = Object.keys(accessoryValues).find(k => 
          accessoryValues[k].name.toLowerCase() === accName.toLowerCase()
        );
        const accValue = accKey ? accessoryValues[accKey].value : 20;
        deductions.push({
          description: `Accesorio no devuelto: ${accName}`,
          amount: accValue
        });
      }
    });
  }
  
  if (selectedContract && inspectionData[selectedContract.vehicle_id]) {
    const inspection = inspectionData[selectedContract.vehicle_id];
    
    if (inspection.chassis === 'rayado') {
      deductions.push({ description: 'Daño chasis: Rayado', amount: 10 });
    } else if (inspection.chassis === 'tordu') {
      deductions.push({ description: 'Daño chasis: Torcido', amount: 50 });
    }
    
    if (inspection.wheels === 'voilé') {
      deductions.push({ description: 'Rueda doblada (mal uso)', amount: 15 });
    }
    
    if (inspection.lights === 'cassé') {
      deductions.push({ description: 'Luz rota/ausente', amount: 20 });
    }
    
    if (inspection.cleaning === 'sale') {
      deductions.push({ description: 'Limpieza: Vehículo sucio', amount: 6 });
    }
  }
  
  additionalDamages.forEach(d => {
    deductions.push({
      description: d.description,
      amount: d.amount
    });
  });
  
  return deductions;
}

// =====================================================
// Additional Damages
// =====================================================

function addDamage() {
  const description = document.getElementById('damageDescription').value.trim();
  const amount = parseFloat(document.getElementById('damageAmount').value) || 0;
  
  if (!description || amount <= 0) {
    alert('Por favor, introduce una descripción y un importe válido');
    return;
  }
  
  additionalDamages.push({ description, amount });
  
  document.getElementById('damageDescription').value = '';
  document.getElementById('damageAmount').value = '';
  
  renderDamageList();
  renderSummary();
}

function removeDamage(index) {
  additionalDamages.splice(index, 1);
  renderDamageList();
  renderSummary();
}

function renderDamageList() {
  const list = document.getElementById('damageList');
  list.innerHTML = additionalDamages.map((d, i) => `
    <div class="damage-item">
      <span>${d.description}</span>
      <span style="display: flex; align-items: center; gap: 10px;">
        <strong style="color: var(--danger);">-${d.amount.toFixed(2)}€</strong>
        <button class="damage-item-remove" onclick="removeDamage(${i})">×</button>
      </span>
    </div>
  `).join('');
}

// =====================================================
// Ticket Photo
// =====================================================

function captureTicketPhoto() {
  document.getElementById('ticketPhotoInput').click();
}

function handleTicketPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      ticketPhotoData = e.target.result;
      const preview = document.querySelector('.photo-ticket-preview');
      preview.innerHTML = `<img src="${e.target.result}" alt="Ticket">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// =====================================================
// Navigation
// =====================================================

function nextStep() {
  // Validation pour véhicules motorisés à l'étape 1
  if (currentStep === 1) {
    const isMotorized = selectedContract && isMotorizedVehicle(selectedContract.vehicle_type);
    if (isMotorized && !endKmValue) {
      alert('Por favor, introduce el kilometraje actual del vehículo');
      return;
    }
    const startKm = selectedContract?.start_km || selectedContract?.current_km || 0;
    if (isMotorized && endKmValue < startKm) {
      alert('El kilometraje final no puede ser menor que el kilometraje inicial');
      return;
    }
    renderAccessories();
  }
  if (currentStep === 2) {
    renderInspection();
  }
  if (currentStep === 3) {
    renderSummary();
  }
  
  document.getElementById(`step${currentStep}`).classList.remove('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add('completed');
  
  currentStep++;
  
  document.getElementById(`step${currentStep}`).classList.add('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add('active');
  
  window.scrollTo(0, 0);
}

function prevStep() {
  document.getElementById(`step${currentStep}`).classList.remove('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove('active');
  
  currentStep--;
  
  document.getElementById(`step${currentStep}`).classList.add('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove('completed');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add('active');
  
  window.scrollTo(0, 0);
}

// =====================================================
// Finish Checkout
// =====================================================

async function finishCheckout() {
  if (!selectedContract) {
    alert('No hay contrato seleccionado');
    return;
  }
  
  const isMotorized = isMotorizedVehicle(selectedContract.vehicle_type);
  
  // Validation KM pour motos
  if (isMotorized && !endKmValue) {
    alert('Por favor, introduce el kilometraje final del vehículo');
    return;
  }
  
  const depositMethod = selectedContract.deposit_method || 'cash';
  if (depositMethod === 'preauth' && !ticketPhotoData) {
    alert('Por favor, tome una foto del ticket de cancelación de pre-autorización');
    return;
  }
  
  const deductions = calculateDeductions();
  const deposit = parseFloat(selectedContract.deposit) || 0;
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const toRefund = Math.max(0, deposit - totalDeductions);
  
  const inspection = inspectionData[selectedContract.vehicle_id] || {};
  const needsMaintenance = 
    inspection.wheels === 'crevé' || 
    inspection.wheels === 'voilé' || 
    inspection.lights === 'no_funciona' || 
    inspection.lights === 'cassé' ||
    inspection.brakes === 'defectuoso' ||
    inspection.brakes === 'gastados' ||
    inspection.battery === 'defectuosa' ||
    inspection.motor === 'ruido' ||
    inspection.motor === 'no_arranca' ||
    inspection.suspension === 'blanda' ||
    inspection.suspension === 'dura';
  
  const checkoutData = {
    rental_id: selectedContract.id,
    vehicle_id: selectedContract.vehicle_id,
    deductions: deductions,
    total_deductions: totalDeductions,
    deposit_refunded: toRefund,
    refund_method: depositMethod === 'preauth' ? 'preauth' : 'cash',
    inspection: inspection,
    needs_maintenance: needsMaintenance,
    ticket_photo: ticketPhotoData,
    checkout_photos: {
      left: inspection.checkoutPhotoLeft,
      right: inspection.checkoutPhotoRight,
      damages: inspection.damagePhotos || []
    },
    end_km: isMotorized ? endKmValue : null
  };
  
  try {
    document.getElementById('btnFinish').disabled = true;
    document.getElementById('btnFinish').textContent = 'Procesando...';
    
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('voltride_token')}`
      },
      body: JSON.stringify(checkoutData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Ouvrir la facture PDF
      if (result.invoice_url) {
        window.open(result.invoice_url, '_blank');
      }
      
      // Message de succès
      const emailMsg = selectedContract.email ? 
        `\n\nFactura enviada a: ${selectedContract.email}` : '';
      const kmMsg = isMotorized && result.km_traveled ? 
        `\nKM recorridos: ${result.km_traveled.toLocaleString()} km` : '';
      const maintenanceMsg = result.scheduled_maintenance ? 
        `\n\n⚠️ Mantenimiento programado requerido` : '';
      
      alert(`✅ Check-out completado!\n\n` +
            `Depósito devuelto: ${toRefund.toFixed(2)}€` +
            kmMsg +
            `\n${needsMaintenance || result.scheduled_maintenance ? '⚠️ Vehículo enviado a mantenimiento' : '✅ Vehículo disponible'}` +
            maintenanceMsg +
            emailMsg);
      
      window.location.href = '/app.html';
    } else {
      throw new Error(result.error || 'Error al procesar el check-out');
    }
  } catch (e) {
    console.error('Error:', e);
    alert('Error: ' + e.message);
    document.getElementById('btnFinish').disabled = false;
    document.getElementById('btnFinish').textContent = 'Finalizar Check-out y Generar Documentos';
  }
}

function exitCheckout() {
  if (confirm('¿Seguro que desea salir? Se perderán los datos no guardados.')) {
    window.location.href = '/app.html';
  }
}
