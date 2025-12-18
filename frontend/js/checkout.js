// =====================================================
// VOLTRIDE - Check-out (Version 2.2 - Dommages depuis Tarifas)
// =====================================================

let currentStep = 1;
let selectedContract = null;
let activeContracts = [];
let accessoriesStatus = {};
let inspectionData = {};
let additionalDamages = [];
let ticketPhotoData = null;
let endKmValue = null;

// Configuration des dommages (chargée depuis Tarifas)
let damagesConfig = [];
let selectedDamages = [];

// Types de véhicules motorisés
const MOTORIZED_TYPES = ['scooter', 'e-motocross', 'emotocross', 'e_motocross', 'moto', 'motocross'];

// Valeurs des accessoires
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
  
  // Charger les dommages depuis Tarifas
  await loadDamagesConfig();
  
  await loadActiveContracts();
});

// =====================================================
// Charger la config des dommages
// =====================================================

async function loadDamagesConfig() {
  try {
    const response = await fetch('/api/pricing', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('voltride_token')}` }
    });
    if (response.ok) {
      const data = await response.json();
      damagesConfig = data.damages || [];
      console.log('✅ Dommages chargés:', damagesConfig);
    }
  } catch (e) {
    console.error('Erreur chargement dommages:', e);
    damagesConfig = [];
  }
}

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
  
  // Afficher/masquer la section KM
  updateKmSection();
}

function selectContract(id) {
  selectedContract = activeContracts.find(c => c.id === id);
  endKmValue = null;
  renderContracts();
  document.getElementById('btnNext1').disabled = false;
  
  // Mettre à jour la section KM
  updateKmSection();
}

// =====================================================
// Section KM pour véhicules motorisés (DANS ÉTAPE 1)
// =====================================================

function updateKmSection() {
  const kmSection = document.getElementById('kmInputSection');
  if (!kmSection) return;
  
  if (!selectedContract) {
    kmSection.style.display = 'none';
    kmSection.innerHTML = '';
    return;
  }
  
  const isMotorized = isMotorizedVehicle(selectedContract.vehicle_type);
  
  if (!isMotorized) {
    kmSection.style.display = 'none';
    kmSection.innerHTML = '';
    return;
  }
  
  const startKm = selectedContract.start_km || selectedContract.current_km || 0;
  
  kmSection.style.display = 'block';
  kmSection.innerHTML = `
    <div style="background: linear-gradient(135deg, var(--warning) 0%, #f59e0b 100%); border-radius: 12px; padding: 20px; margin-top: 20px; color: var(--bg-dark);">
      <h3 style="margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;">
        🏍️ Kilométrage - Vehículo Motorizado
      </h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; align-items: end;">
        <div>
          <label style="font-size: 0.85rem; opacity: 0.8; display: block; margin-bottom: 5px;">KM Inicio</label>
          <div style="font-size: 1.5rem; font-weight: bold; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; text-align: center;">${startKm.toLocaleString()} km</div>
        </div>
        <div>
          <label style="font-size: 0.85rem; opacity: 0.8; display: block; margin-bottom: 5px;">KM Fin (actual) *</label>
          <input type="number" id="endKmInput" class="form-control" 
                 value="${endKmValue || ''}" 
                 min="${startKm}"
                 placeholder="Introducir km"
                 onchange="updateEndKm(this.value)"
                 oninput="updateEndKm(this.value)"
                 style="font-size: 1.2rem; font-weight: bold; text-align: center; background: white; color: var(--bg-dark); padding: 10px;">
        </div>
        <div>
          <label style="font-size: 0.85rem; opacity: 0.8; display: block; margin-bottom: 5px;">KM Recorridos</label>
          <div id="kmTraveledDisplay" style="font-size: 1.5rem; font-weight: bold; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; text-align: center;">
            ${endKmValue ? (endKmValue - startKm).toLocaleString() : '0'} km
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateEndKm(value) {
  const startKm = selectedContract?.start_km || selectedContract?.current_km || 0;
  endKmValue = parseInt(value) || null;
  
  const display = document.getElementById('kmTraveledDisplay');
  if (display && endKmValue) {
    display.textContent = (endKmValue - startKm).toLocaleString() + ' km';
  } else if (display) {
    display.textContent = '0 km';
  }
}

// =====================================================
// Accessories Verification
// =====================================================

function renderAccessories() {
  const list = document.getElementById('accessoriesList');
  
  if (!selectedContract || !selectedContract.notes) {
    list.innerHTML = `
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
    list.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        ✅ No hay accesorios registrados para este contrato
      </div>
    `;
    return;
  }
  
  const startDate = new Date(selectedContract.start_date);
  const endDate = new Date(selectedContract.planned_end_date);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  list.innerHTML = accessories.map((accName, index) => {
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
  
  const motorizedInspection = isMotorized ? `
    <div class="inspection-item">
      <label>Motor</label>
      <select onchange="updateInspection(${selectedContract.vehicle_id}, 'motor', this.value)">
        <option value="excelente" ${inspection.motor === 'excelente' ? 'selected' : ''}>✅ Funciona bien</option>
        <option value="ruido" ${inspection.motor === 'ruido' ? 'selected' : ''}>⚠️ Ruido anormal</option>
        <option value="no_arranca" ${inspection.motor === 'no_arranca' ? 'selected' : ''}>❌ No arranca</option>
      </select>
    </div>
    <div class="inspection-item">
      <label>Suspensión</label>
      <select onchange="updateInspection(${selectedContract.vehicle_id}, 'suspension', this.value)">
        <option value="excelente" ${inspection.suspension === 'excelente' ? 'selected' : ''}>✅ Excelente</option>
        <option value="blanda" ${inspection.suspension === 'blanda' ? 'selected' : ''}>⚠️ Blanda</option>
        <option value="dura" ${inspection.suspension === 'dura' ? 'selected' : ''}>⚠️ Dura</option>
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
            <option value="crevé" ${inspection.wheels === 'crevé' ? 'selected' : ''}>🔧 Pinchado</option>
            <option value="voilé" ${inspection.wheels === 'voilé' ? 'selected' : ''}>❌ Doblada (-15€)</option>
          </select>
        </div>
        
        <div class="inspection-item">
          <label>Luces</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'lights', this.value)">
            <option value="excelente" ${inspection.lights === 'excelente' ? 'selected' : ''}>✅ Excelente</option>
            <option value="no_funciona" ${inspection.lights === 'no_funciona' ? 'selected' : ''}>🔧 No funciona</option>
            <option value="cassé" ${inspection.lights === 'cassé' ? 'selected' : ''}>❌ Rota (-20€)</option>
          </select>
        </div>
        
        <div class="inspection-item">
          <label>Frenos</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'brakes', this.value)">
            <option value="excelente" ${inspection.brakes === 'excelente' ? 'selected' : ''}>✅ Excelente</option>
            <option value="gastados" ${inspection.brakes === 'gastados' ? 'selected' : ''}>⚠️ Gastados</option>
            <option value="defectuoso" ${inspection.brakes === 'defectuoso' ? 'selected' : ''}>❌ Defectuoso</option>
          </select>
        </div>
        
        ${motorizedInspection}
        
        <div class="inspection-item">
          <label>Limpieza</label>
          <select onchange="updateInspection(${selectedContract.vehicle_id}, 'cleaning', this.value)">
            <option value="limpio" ${inspection.cleaning === 'limpio' ? 'selected' : ''}>✅ Limpio</option>
            <option value="medio" ${inspection.cleaning === 'medio' ? 'selected' : ''}>😐 Medio</option>
            <option value="sale" ${inspection.cleaning === 'sale' ? 'selected' : ''}>❌ Sucio (-5€)</option>
          </select>
        </div>
      </div>
      
      <!-- Section Dommages depuis Tarifas -->
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border);">
        <h4 style="margin-bottom: 15px;">🔧 Dommages constatés</h4>
        <div id="damagesCheckboxes" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
          <!-- Rempli dynamiquement -->
        </div>
      </div>
    </div>
    
    <div class="photo-comparison">
      <h3>Fotos Check-out</h3>
      <div class="photo-comparison-grid">
        <div class="photo-side">
          <h4>Lado Izquierdo</h4>
          <div class="photo-box clickable" onclick="captureInspectionPhoto(${selectedContract.vehicle_id}, 'left')">
            ${inspection.checkoutPhotoLeft ? 
              `<img src="${inspection.checkoutPhotoLeft}" alt="Check-out">` : 
              '+ Foto'}
          </div>
        </div>
        <div class="photo-side">
          <h4>Lado Derecho</h4>
          <div class="photo-box clickable" onclick="captureInspectionPhoto(${selectedContract.vehicle_id}, 'right')">
            ${inspection.checkoutPhotoRight ? 
              `<img src="${inspection.checkoutPhotoRight}" alt="Check-out">` : 
              '+ Foto'}
          </div>
        </div>
      </div>
    </div>
    
    <div class="additional-photos" style="margin-top: 20px;">
      <h3>Fotos Daños</h3>
      <div class="damage-photos-grid" id="damagePhotosGrid">
        ${(inspection.damagePhotos || []).map((photo, i) => `
          <div class="damage-photo-box"><img src="${photo}" alt="Daño ${i+1}"></div>
        `).join('')}
        <div class="damage-photo-box" onclick="captureDamagePhoto(${selectedContract.vehicle_id})">+ Añadir</div>
      </div>
    </div>
    
    <input type="file" id="inspectionPhotoInput" accept="image/*" capture="environment" style="display: none;">
    <input type="file" id="damagePhotoInput" accept="image/*" capture="environment" style="display: none;">
  `;
  
  // Rendre les checkboxes des dommages
  renderDamagesCheckboxes();
}

// Render damages checkboxes from Tarifas config
function renderDamagesCheckboxes() {
  const container = document.getElementById('damagesCheckboxes');
  if (!container) return;
  
  // Filtrer les dommages par type de véhicule si applicable
  const vehicleType = selectedContract?.vehicle_type?.toLowerCase() || '';
  let filteredDamages = damagesConfig;
  
  // Si les dommages ont des types compatibles, filtrer
  if (damagesConfig.some(d => d.compatibleTypes && d.compatibleTypes.length > 0)) {
    filteredDamages = damagesConfig.filter(d => {
      if (!d.compatibleTypes || d.compatibleTypes.length === 0) return true;
      return d.compatibleTypes.some(t => vehicleType.includes(t.toLowerCase()));
    });
  }
  
  if (filteredDamages.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Aucun dommage configuré dans Tarifas</p>';
    return;
  }
  
  container.innerHTML = filteredDamages.map(damage => `
    <label style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-input); border-radius: 8px; cursor: pointer;">
      <input type="checkbox" 
             onchange="toggleDamage(${damage.id}, '${damage.name}', ${damage.price})"
             ${selectedDamages.some(d => d.id === damage.id) ? 'checked' : ''}>
      <span>${damage.name}</span>
      <span style="color: var(--danger); margin-left: auto; font-weight: bold;">-${damage.price}€</span>
    </label>
  `).join('');
}

// Toggle damage selection
function toggleDamage(id, name, price) {
  const existingIndex = selectedDamages.findIndex(d => d.id === id);
  if (existingIndex >= 0) {
    selectedDamages.splice(existingIndex, 1);
  } else {
    selectedDamages.push({ id, name, price });
  }
  console.log('Dommages sélectionnés:', selectedDamages);
}

function updateInspection(vehicleId, field, value) {
  if (!inspectionData[vehicleId]) inspectionData[vehicleId] = {};
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
  if (e.target.id === 'inspectionPhotoInput' && currentPhotoTarget) handleInspectionPhoto(e.target);
  if (e.target.id === 'damagePhotoInput' && currentPhotoTarget) handleDamagePhoto(e.target);
});

function handleInspectionPhoto(input) {
  if (input.files && input.files[0] && currentPhotoTarget) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const { vehicleId, side } = currentPhotoTarget;
      if (side === 'left') inspectionData[vehicleId].checkoutPhotoLeft = e.target.result;
      else inspectionData[vehicleId].checkoutPhotoRight = e.target.result;
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
      if (!inspectionData[vehicleId].damagePhotos) inspectionData[vehicleId].damagePhotos = [];
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
  const vehicleIcon = selectedContract.vehicle_type === 'bike' ? '🚲' : selectedContract.vehicle_type === 'ebike' ? '⚡' : '🛵';
  
  let kmInfo = '';
  if (isMotorized) {
    const startKm = selectedContract.start_km || selectedContract.current_km || 0;
    const kmTraveled = endKmValue ? endKmValue - startKm : 0;
    kmInfo = `
      <div class="summary-row" style="background: var(--bg-secondary); padding: 10px; border-radius: 8px; margin: 10px 0;">
        <span>🏍️ KM Recorridos:</span>
        <span style="color: var(--info);"><strong>${startKm.toLocaleString()} → ${(endKmValue || startKm).toLocaleString()} km</strong> (${kmTraveled.toLocaleString()} km)</span>
      </div>
    `;
  }
  
  document.getElementById('contractSummary').innerHTML = `
    <div class="summary-row"><span>Contrato:</span><span><strong>${selectedContract.contract_number}</strong></span></div>
    <div class="summary-row"><span>Cliente:</span><span>${selectedContract.first_name} ${selectedContract.last_name}</span></div>
    <div class="summary-row"><span>Email:</span><span>${selectedContract.email || 'Sin email'}</span></div>
    <div class="summary-row"><span>Vehículo:</span><span>${vehicleIcon} ${selectedContract.vehicle_code}</span></div>
    <div class="summary-row"><span>Período:</span><span>${days} día(s)</span></div>
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
      <div class="summary-row deduction"><span>${d.description}</span><span>-${d.amount.toFixed(2)}€</span></div>
    `).join('') + `
      <div class="summary-row" style="font-weight: bold; border-top: 1px solid var(--border); padding-top: 10px;">
        <span>Total Deducciones:</span><span style="color: var(--danger);">-${totalDeductions.toFixed(2)}€</span>
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
      <div class="refund-method selected"><div class="refund-method-icon">💳</div><div class="refund-method-name">Pre-autorización</div></div>
      <div class="refund-method disabled"><div class="refund-method-icon">💵</div><div class="refund-method-name">Efectivo</div></div>
    `;
    document.getElementById('refundMethodDisplay').textContent = 'Cancelación Pre-autorización';
    document.getElementById('photoTicketBox').style.display = 'block';
  } else {
    refundMethodsContainer.innerHTML = `
      <div class="refund-method disabled"><div class="refund-method-icon">💳</div><div class="refund-method-name">Pre-auth</div></div>
      <div class="refund-method selected"><div class="refund-method-icon">💵</div><div class="refund-method-name">Efectivo</div></div>
    `;
    document.getElementById('refundMethodDisplay').textContent = 'Efectivo';
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
        const accKey = Object.keys(accessoryValues).find(k => accessoryValues[k].name.toLowerCase() === accName.toLowerCase());
        const accValue = accKey ? accessoryValues[accKey].value : 20;
        deductions.push({ description: `Accesorio no devuelto: ${accName}`, amount: accValue });
      }
    });
  }
  
  if (selectedContract && inspectionData[selectedContract.vehicle_id]) {
    const inspection = inspectionData[selectedContract.vehicle_id];
    if (inspection.chassis === 'rayado') deductions.push({ description: 'Chasis rayado', amount: 10 });
    else if (inspection.chassis === 'tordu') deductions.push({ description: 'Chasis torcido', amount: 50 });
    if (inspection.wheels === 'voilé') deductions.push({ description: 'Rueda doblada', amount: 15 });
    if (inspection.lights === 'cassé') deductions.push({ description: 'Luz rota', amount: 20 });
    if (inspection.cleaning === 'sale') deductions.push({ description: 'Limpieza', amount: 5 });
  }
  
  // Ajouter les dommages sélectionnés depuis Tarifas
  selectedDamages.forEach(d => deductions.push({ description: d.name, amount: d.price }));
  
  // Ajouter les dommages additionnels manuels
  additionalDamages.forEach(d => deductions.push({ description: d.description, amount: d.amount }));
  
  return deductions;
}

// =====================================================
// Additional Damages
// =====================================================

function addDamage() {
  const description = document.getElementById('damageDescription').value.trim();
  const amount = parseFloat(document.getElementById('damageAmount').value) || 0;
  if (!description || amount <= 0) { alert('Introduce descripción e importe'); return; }
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
  document.getElementById('damageList').innerHTML = additionalDamages.map((d, i) => `
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

function captureTicketPhoto() { document.getElementById('ticketPhotoInput').click(); }

function handleTicketPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      ticketPhotoData = e.target.result;
      document.querySelector('.photo-ticket-preview').innerHTML = `<img src="${e.target.result}" alt="Ticket">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// =====================================================
// Navigation
// =====================================================

function nextStep() {
  // Validation KM pour motos à l'étape 1
  if (currentStep === 1) {
    const isMotorized = selectedContract && isMotorizedVehicle(selectedContract.vehicle_type);
    if (isMotorized) {
      const kmInput = document.getElementById('endKmInput');
      if (!kmInput || !kmInput.value) {
        alert('Por favor, introduce el kilometraje actual del vehículo');
        return;
      }
      endKmValue = parseInt(kmInput.value);
      const startKm = selectedContract.start_km || selectedContract.current_km || 0;
      if (endKmValue < startKm) {
        alert('El kilometraje final no puede ser menor que el inicial');
        return;
      }
    }
    renderAccessories();
  }
  if (currentStep === 2) renderInspection();
  if (currentStep === 3) renderSummary();
  
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
  if (!selectedContract) { alert('No hay contrato seleccionado'); return; }
  
  const isMotorized = isMotorizedVehicle(selectedContract.vehicle_type);
  if (isMotorized && !endKmValue) { alert('Introduce el kilometraje final'); return; }
  
  const depositMethod = selectedContract.deposit_method || 'cash';
  if (depositMethod === 'preauth' && !ticketPhotoData) {
    alert('Toma foto del ticket de cancelación');
    return;
  }
  
  const deductions = calculateDeductions();
  const deposit = parseFloat(selectedContract.deposit) || 0;
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const toRefund = Math.max(0, deposit - totalDeductions);
  
  const inspection = inspectionData[selectedContract.vehicle_id] || {};
  const needsMaintenance = ['crevé', 'voilé'].includes(inspection.wheels) ||
    ['no_funciona', 'cassé'].includes(inspection.lights) ||
    ['defectuoso', 'gastados'].includes(inspection.brakes) ||
    inspection.battery === 'defectuosa' ||
    ['ruido', 'no_arranca'].includes(inspection.motor) ||
    ['blanda', 'dura'].includes(inspection.suspension);
  
  const checkoutData = {
    rental_id: selectedContract.id,
    vehicle_id: selectedContract.vehicle_id,
    deductions, total_deductions: totalDeductions,
    deposit_refunded: toRefund,
    refund_method: depositMethod === 'preauth' ? 'preauth' : 'cash',
    inspection, needs_maintenance: needsMaintenance,
    ticket_photo: ticketPhotoData,
    checkout_photos: { left: inspection.checkoutPhotoLeft, right: inspection.checkoutPhotoRight, damages: inspection.damagePhotos || [] },
    end_km: isMotorized ? endKmValue : null
  };
  
  try {
    document.getElementById('btnFinish').disabled = true;
    document.getElementById('btnFinish').textContent = 'Procesando...';
    
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('voltride_token')}` },
      body: JSON.stringify(checkoutData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      if (result.invoice_url) window.open(result.invoice_url, '_blank');
      
      const kmMsg = isMotorized && result.km_traveled ? `\nKM: ${result.km_traveled.toLocaleString()} km` : '';
      alert(`✅ Check-out completado!\n\nDepósito: ${toRefund.toFixed(2)}€${kmMsg}\n${needsMaintenance ? '⚠️ → Mantenimiento' : '✅ → Disponible'}`);
      
      window.location.href = '/app.html';
    } else {
      throw new Error(result.error || 'Error');
    }
  } catch (e) {
    alert('Error: ' + e.message);
    document.getElementById('btnFinish').disabled = false;
    document.getElementById('btnFinish').textContent = 'Finalizar Check-out';
  }
}

function exitCheckout() {
  if (confirm('¿Salir? Se perderán los datos.')) window.location.href = '/app.html';
}
