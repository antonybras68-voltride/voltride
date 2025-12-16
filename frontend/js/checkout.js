// =====================================================
// VOLTRIDE - Check-out (Version 1.0)
// =====================================================

let currentStep = 1;
let selectedContract = null;
let activeContracts = [];
let accessoriesStatus = {};
let inspectionData = {};
let additionalDamages = [];
let ticketPhotoData = null;

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

// Coûts des dommages
const damageCosts = {
  chassis: { rayado: 10, tordu: 50 },
  wheels: { crevé: 0, voilé: 15 }, // crevé = maintenance only
  lights: { no_funciona: 0, cassé: 20 },
  cleaning: { sale: 6 }
};

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
        ❌ Error al cargar los contratos: ${e.message}
      </div>
    `;
  }
}

function renderContracts() {
  const grid = document.getElementById('contractsGrid');
  
  if (activeContracts.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        📭 No hay contratos activos para check-out
      </div>
    `;
    return;
  }
  
  grid.innerHTML = activeContracts.map(contract => {
    const startDate = new Date(contract.start_date);
    const endDate = new Date(contract.planned_end_date);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const vehicleIcon = contract.vehicle_type === 'bike' ? '🚲' : contract.vehicle_type === 'ebike' ? '⚡' : '🛵';
    
    // Parse accessories from notes
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
            <span class="contract-info-label">Vehículo:</span>
            <span class="contract-info-value">${vehicleIcon} ${contract.vehicle_code}</span>
          </div>
          <div class="contract-info-row">
            <span class="contract-info-label">Depósito:</span>
            <span class="contract-info-value" style="color: var(--success);">${parseFloat(contract.deposit).toFixed(2)}€</span>
          </div>
        </div>
        ${accessories.length > 0 ? `
          <div class="contract-accessories">
            ${accessories.map(a => `<span class="accessory-tag">🎒 ${a}</span>`).join('')}
          </div>
        ` : ''}
        <div class="contract-dates">
          📅 ${startDate.toLocaleDateString('es-ES')} → ${endDate.toLocaleDateString('es-ES')} (${days} días)
        </div>
      </div>
    `;
  }).join('');
}

function selectContract(id) {
  selectedContract = activeContracts.find(c => c.id === id);
  renderContracts();
  document.getElementById('btnNext1').disabled = !selectedContract;
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
  
  // Parse accessories from notes
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
  
  // Calculate rental days
  const startDate = new Date(selectedContract.start_date);
  const endDate = new Date(selectedContract.planned_end_date);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  list.innerHTML = accessories.map((accName, index) => {
    // Find accessory value
    const accKey = Object.keys(accessoryValues).find(k => 
      accessoryValues[k].name.toLowerCase() === accName.toLowerCase()
    );
    const accValue = accKey ? accessoryValues[accKey].value : 20; // Default 20€
    
    // Initialize status if not exists
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
  // Parse accessories count
  let accessories = [];
  if (selectedContract?.notes?.includes('Accesorios:')) {
    const accStr = selectedContract.notes.replace('Accesorios:', '').trim();
    accessories = accStr.split(',').map(a => a.trim()).filter(a => a);
  }
  
  // Mark all as returned
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
  
  const vehicleIcon = selectedContract.vehicle_type === 'bike' ? '🚲' : 
                      selectedContract.vehicle_type === 'ebike' ? '⚡' : '🛵';
  
  // Initialize inspection data
  if (!inspectionData[selectedContract.vehicle_id]) {
    inspectionData[selectedContract.vehicle_id] = {
      chassis: 'excelente',
      wheels: 'excelente',
      lights: 'excelente',
      cleaning: 'limpio',
      checkoutPhotoLeft: null,
      checkoutPhotoRight: null,
      damagePhotos: []
    };
  }
  
  const inspection = inspectionData[selectedContract.vehicle_id];
  
  container.innerHTML = `
    <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h3 style="margin-bottom: 20px;">${vehicleIcon} ${selectedContract.vehicle_code} - ${selectedContract.brand || ''} ${selectedContract.model || ''}</h3>
      
      <!-- Inspection Grid -->
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
    
    <!-- Photo Comparison -->
    <div class="photo-comparison">
      <h3>📷 Comparación de Fotos (Antes / Después)</h3>
      <p style="color: var(--text-secondary); margin-bottom: 15px;">Compara el estado del vehículo al inicio y al final del alquiler</p>
      
      <div class="photo-comparison-grid">
        <div class="photo-side">
          <h4>🔵 Lado Izquierdo</h4>
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
                  '📷 Foto'}
              </div>
              <div class="photo-label">CHECK-OUT</div>
            </div>
          </div>
        </div>
        
        <div class="photo-side">
          <h4>🔴 Lado Derecho</h4>
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
                  '📷 Foto'}
              </div>
              <div class="photo-label">CHECK-OUT</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Additional Damage Photos -->
    <div class="additional-photos">
      <h3>📸 Fotos Adicionales (Daños)</h3>
      <p style="color: var(--text-secondary); margin-bottom: 15px;">Añade fotos de cualquier daño encontrado</p>
      
      <div class="damage-photos-grid" id="damagePhotosGrid">
        ${inspection.damagePhotos.map((photo, i) => `
          <div class="damage-photo-box">
            <img src="${photo}" alt="Daño ${i+1}">
          </div>
        `).join('')}
        <div class="damage-photo-box" onclick="captureDamagePhoto(${selectedContract.vehicle_id})">
          📷 + Añadir
        </div>
      </div>
    </div>
    
    <!-- Hidden file inputs -->
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
  const vehicleIcon = selectedContract.vehicle_type === 'bike' ? '🚲' : 
                      selectedContract.vehicle_type === 'ebike' ? '⚡' : '🛵';
  
  // Contract summary
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
      <span>Vehículo:</span>
      <span>${vehicleIcon} ${selectedContract.vehicle_code} (${selectedContract.brand || ''} ${selectedContract.model || ''})</span>
    </div>
    <div class="summary-row">
      <span>Período:</span>
      <span>${days} día(s)</span>
    </div>
  `;
  
  // Calculate deductions
  const deductions = calculateDeductions();
  const deposit = parseFloat(selectedContract.deposit) || 0;
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const toRefund = Math.max(0, deposit - totalDeductions);
  
  // Show deductions
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
  
  // Update deposit refund display
  document.getElementById('depositToRefund').textContent = toRefund.toFixed(2) + '€';
  
  // Refund method
  const depositMethod = selectedContract.deposit_method || 'cash';
  const refundMethodsContainer = document.getElementById('refundMethods');
  
  if (depositMethod === 'preauth') {
    // Must refund via preauth
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
    // Cash refund
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
  
  // 1. Missing accessories
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
  
  // 2. Inspection damages
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
  
  // 3. Additional damages
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
  if (currentStep === 1) {
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
  
  // Check if preauth refund needs photo
  const depositMethod = selectedContract.deposit_method || 'cash';
  if (depositMethod === 'preauth' && !ticketPhotoData) {
    alert('Por favor, tome una foto del ticket de cancelación de pre-autorización');
    return;
  }
  
  const deductions = calculateDeductions();
  const deposit = parseFloat(selectedContract.deposit) || 0;
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const toRefund = Math.max(0, deposit - totalDeductions);
  
  // Determine if vehicle needs maintenance
  const inspection = inspectionData[selectedContract.vehicle_id] || {};
  const needsMaintenance = 
    inspection.wheels === 'crevé' || 
    inspection.wheels === 'voilé' || 
    inspection.lights === 'no_funciona' || 
    inspection.lights === 'cassé';
  
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
    }
  };
  
  try {
    document.getElementById('btnFinish').disabled = true;
    document.getElementById('btnFinish').textContent = '⏳ Procesando...';
    
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
      alert(`✅ Check-out completado!\n\nDepósito devuelto: ${toRefund.toFixed(2)}€\n${needsMaintenance ? '⚠️ Vehículo enviado a mantenimiento' : '✅ Vehículo disponible'}`);
      
      // Open PDF if available
      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank');
      }
      
      window.location.href = '/app.html';
    } else {
      throw new Error(result.error || 'Error al procesar el check-out');
    }
  } catch (e) {
    console.error('Error:', e);
    alert('❌ Error: ' + e.message);
    document.getElementById('btnFinish').disabled = false;
    document.getElementById('btnFinish').textContent = '✅ Finalizar Check-out y Generar Documentos';
  }
}

function exitCheckout() {
  if (confirm('¿Seguro que desea salir? Se perderán los datos no guardados.')) {
    window.location.href = '/app.html';
  }
}
