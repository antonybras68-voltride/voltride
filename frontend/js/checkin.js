// =====================================================
// VOLTRIDE - Check-in Walk-in (Version 2.0)
// =====================================================

let currentStep = 1;
let selectedVehicles = [];
let vehiclesData = [];
let accessoriesData = {};
let clientMode = false;
let signatureCanvas, signatureCtx;
let isDrawing = false;
let hasSignature = false;
let idPhotoData = null;
let foundClient = null;

// Payment data
let paymentData = {
  rental: { method: null, amount: 0 },
  deposit: { method: null, amount: 0 }
};

// Accessoires disponibles
const availableAccessories = [
  { id: 'lock', name: 'Candado', icon: '🔒', price: 0, mandatory: true, vehicleTypes: ['bike', 'ebike'] },
  { id: 'helmet', name: 'Casco', icon: '⛑️', price: 0, mandatory: false, vehicleTypes: ['bike', 'ebike', 'scooter'] },
  { id: 'basket', name: 'Cesta', icon: '🧺', price: 0, mandatory: false, vehicleTypes: ['bike', 'ebike'] },
  { id: 'phone_holder', name: 'Soporte Móvil', icon: '📱', price: 5, mandatory: false, vehicleTypes: ['bike', 'ebike', 'scooter'] },
  { id: 'child_seat', name: 'Silla Niño', icon: '👶', price: 10, mandatory: false, vehicleTypes: ['bike', 'ebike'] },
  { id: 'panniers', name: 'Alforjas', icon: '🎒', price: 8, mandatory: false, vehicleTypes: ['bike', 'ebike'] },
  { id: 'gps', name: 'GPS', icon: '🗺️', price: 5, mandatory: false, vehicleTypes: ['scooter'] },
  { id: 'rain_cover', name: 'Chubasquero', icon: '🌧️', price: 3, mandatory: false, vehicleTypes: ['bike', 'ebike', 'scooter'] }
];

// CGV multilingues
const cgvTexts = {
  es: `
    <h3>CONDICIONES GENERALES DE ALQUILER - VOLTRIDE</h3>
    <p><strong>1. Objeto del contrato</strong><br>
    El presente contrato tiene por objeto la cesión temporal del uso de un vehículo de movilidad personal por parte de VOLTRIDE al Cliente.</p>
    <p><strong>2. Estado del vehículo</strong><br>
    El cliente reconoce haber recibido el vehículo en perfecto estado de funcionamiento y se compromete a devolverlo en las mismas condiciones.</p>
    <p><strong>3. Responsabilidad del cliente</strong><br>
    El cliente es responsable de cualquier daño o pérdida del vehículo durante el período de alquiler.</p>
    <p><strong>4. Depósito</strong><br>
    El depósito será devuelto íntegramente si el vehículo se devuelve sin daños y en el plazo acordado.</p>
    <p><strong>5. Retraso en la devolución</strong><br>
    En caso de retraso, se aplicará un cargo adicional equivalente a la tarifa diaria.</p>
    <p><strong>6. Normas de circulación</strong><br>
    El cliente se compromete a respetar el código de circulación vigente.</p>
    <p><strong>7. Prohibiciones</strong><br>
    - Uso bajo efectos del alcohol o drogas prohibido.<br>
    - No subalquilar ni prestar a terceros.<br>
    - Guardar en lugar seguro entre 21h y 7h.</p>
    <p><strong>8. Averías</strong><br>
    Contactar inmediatamente con la agencia en caso de avería.</p>
    <p><strong>9. Limpieza</strong><br>
    Cargo de 5 EUR si el vehículo se devuelve sucio.</p>
    <p><strong>10. Protección de datos</strong><br>
    Datos tratados conforme al RGPD.</p>
  `,
  fr: `
    <h3>CONDITIONS GÉNÉRALES DE LOCATION - VOLTRIDE</h3>
    <p><strong>1. Objet du contrat</strong><br>
    Mise à disposition temporaire d'un véhicule de mobilité personnelle par VOLTRIDE au Client.</p>
    <p><strong>2. État du véhicule</strong><br>
    Le client reconnaît avoir reçu le véhicule en parfait état.</p>
    <p><strong>3. Responsabilité du client</strong><br>
    Le client est responsable de tout dommage ou perte pendant la location.</p>
    <p><strong>4. Caution</strong><br>
    Restituée intégralement si le véhicule est rendu sans dommages.</p>
    <p><strong>5. Retard de restitution</strong><br>
    Supplément journalier appliqué en cas de retard.</p>
    <p><strong>6. Code de la route</strong><br>
    Le client s'engage à respecter le code de la route.</p>
    <p><strong>7. Interdictions</strong><br>
    - Usage sous alcool/drogues interdit.<br>
    - Ne pas sous-louer ni prêter.<br>
    - Stationner en lieu sûr entre 21h et 7h.</p>
    <p><strong>8. Pannes</strong><br>
    Contacter immédiatement l'agence.</p>
    <p><strong>9. Propreté</strong><br>
    Frais de 5 EUR si véhicule rendu sale.</p>
    <p><strong>10. Protection des données</strong><br>
    Données traitées conformément au RGPD.</p>
  `,
  en: `
    <h3>GENERAL RENTAL CONDITIONS - VOLTRIDE</h3>
    <p><strong>1. Purpose</strong><br>
    Temporary rental of a personal mobility vehicle from VOLTRIDE to Customer.</p>
    <p><strong>2. Vehicle condition</strong><br>
    Customer acknowledges receiving the vehicle in perfect condition.</p>
    <p><strong>3. Customer responsibility</strong><br>
    Customer is responsible for any damage or loss during the rental.</p>
    <p><strong>4. Deposit</strong><br>
    Fully refunded if vehicle is returned without damage.</p>
    <p><strong>5. Late return</strong><br>
    Additional daily charge applied for late returns.</p>
    <p><strong>6. Traffic rules</strong><br>
    Customer agrees to comply with traffic regulations.</p>
    <p><strong>7. Prohibitions</strong><br>
    - No use under alcohol/drugs.<br>
    - No subletting or lending.<br>
    - Store securely between 9pm-7am.</p>
    <p><strong>8. Breakdowns</strong><br>
    Contact agency immediately.</p>
    <p><strong>9. Cleanliness</strong><br>
    5 EUR fee if returned dirty.</p>
    <p><strong>10. Data protection</strong><br>
    Data processed per GDPR.</p>
  `
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
  
  initHourSelects();
  initSignatureCanvas();
  await loadVehicles();
  
  // Set default dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  document.getElementById('startDate').value = formatDateInput(today);
  document.getElementById('endDate').value = formatDateInput(tomorrow);
  
  // Set current time rounded to 15 min
  const currentHour = Math.min(21, Math.max(8, today.getHours()));
  const currentMinute = Math.ceil(today.getMinutes() / 15) * 15;
  document.getElementById('startHour').value = String(currentHour).padStart(2, '0');
  document.getElementById('startMinute').value = String(currentMinute % 60).padStart(2, '0');
  document.getElementById('endHour').value = String(currentHour).padStart(2, '0');
  document.getElementById('endMinute').value = String(currentMinute % 60).padStart(2, '0');
});

function formatDateInput(date) {
  return date.toISOString().split('T')[0];
}

function initHourSelects() {
  const hours = [];
  for (let h = 8; h <= 21; h++) {
    hours.push(`<option value="${String(h).padStart(2, '0')}">${String(h).padStart(2, '0')}h</option>`);
  }
  document.getElementById('startHour').innerHTML = hours.join('');
  document.getElementById('endHour').innerHTML = hours.join('');
}

// =====================================================
// Vehicles
// =====================================================

async function loadVehicles() {
  try {
    const user = JSON.parse(localStorage.getItem('voltride_user') || '{}');
    const response = await fetch(`/api/vehicles?agency_id=${user.agency_id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('voltride_token')}` }
    });
    vehiclesData = await response.json();
    renderVehicles(vehiclesData);
  } catch (e) {
    console.error('Error loading vehicles:', e);
  }
}

function renderVehicles(vehicles) {
  const grid = document.getElementById('vehicleGrid');
  grid.innerHTML = vehicles.map(v => {
    const isSelected = selectedVehicles.find(sv => sv.id === v.id);
    const isAvailable = v.status === 'available';
    const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
    
    return `
      <div class="vehicle-card ${isSelected ? 'selected' : ''} ${!isAvailable ? 'unavailable' : ''}" 
           onclick="${isAvailable ? `toggleVehicle(${v.id})` : ''}"
           data-type="${v.type}">
        <div class="vehicle-card-icon">${icon}</div>
        <div class="vehicle-card-code">${v.code}</div>
        <div class="vehicle-card-type">${v.brand || ''} ${v.model || ''}</div>
        <div class="vehicle-card-price">${parseFloat(v.daily_rate).toFixed(2)} €/día</div>
        ${!isAvailable ? '<div style="color: var(--danger); font-size: 12px; margin-top: 5px;">No disponible</div>' : ''}
      </div>
    `;
  }).join('');
}

function toggleVehicle(id) {
  const vehicle = vehiclesData.find(v => v.id === id);
  if (!vehicle) return;
  
  const index = selectedVehicles.findIndex(v => v.id === id);
  if (index > -1) {
    selectedVehicles.splice(index, 1);
  } else {
    selectedVehicles.push(vehicle);
  }
  
  updateSelectedVehiclesDisplay();
  renderVehicles(vehiclesData);
  document.getElementById('btnNext1').disabled = selectedVehicles.length === 0;
}

function removeVehicle(id) {
  selectedVehicles = selectedVehicles.filter(v => v.id !== id);
  updateSelectedVehiclesDisplay();
  renderVehicles(vehiclesData);
  document.getElementById('btnNext1').disabled = selectedVehicles.length === 0;
}

function updateSelectedVehiclesDisplay() {
  const container = document.getElementById('selectedVehiclesContainer');
  const tags = document.getElementById('selectedVehiclesTags');
  const count = document.getElementById('selectedCount');
  
  if (selectedVehicles.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  count.textContent = selectedVehicles.length;
  
  tags.innerHTML = selectedVehicles.map(v => {
    const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
    return `
      <span class="selected-vehicle-tag">
        ${icon} ${v.code}
        <span class="remove" onclick="removeVehicle(${v.id})">×</span>
      </span>
    `;
  }).join('');
}

function filterVehicles(type) {
  let filtered = vehiclesData;
  if (type !== 'all') {
    filtered = vehiclesData.filter(v => v.type === type);
  }
  
  // Update button styles
  document.querySelectorAll('#step1 .btn-sm').forEach(btn => {
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  });
  if (event && event.target) {
    event.target.classList.remove('btn-secondary');
    event.target.classList.add('btn-primary');
  }
  
  renderVehicles(filtered);
}

// =====================================================
// Pricing (Prix TTC - TVA inversée)
// =====================================================

function calculateDays() {
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  if (!startDate || !endDate) return 1;
  
  const start = new Date(`${startDate}T${startHour}:${startMinute}`);
  const end = new Date(`${endDate}T${endHour}:${endMinute}`);
  
  const diffHours = (end - start) / (1000 * 60 * 60);
  let days = Math.floor(diffHours / 24);
  if (diffHours % 24 > 1) days++;
  return Math.max(1, days);
}

function updatePricing() {
  const days = calculateDays();
  
  let html = `<div class="price-line"><span>Período</span><span><strong>${days} día(s)</strong></span></div>`;
  
  let subtotalTTC = 0;
  selectedVehicles.forEach(v => {
    const priceTTC = days * parseFloat(v.daily_rate);
    subtotalTTC += priceTTC;
    const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
    html += `<div class="price-line"><span>${icon} ${v.code}</span><span>${priceTTC.toFixed(2)} €</span></div>`;
  });
  
  // Add accessories price
  let accessoriesTotalTTC = 0;
  Object.values(accessoriesData).forEach(vehicleAccessories => {
    vehicleAccessories.forEach(acc => {
      if (acc.price > 0) {
        accessoriesTotalTTC += acc.price * days;
      }
    });
  });
  
  if (accessoriesTotalTTC > 0) {
    html += `<div class="price-line"><span>🎒 Accesorios</span><span>${accessoriesTotalTTC.toFixed(2)} €</span></div>`;
  }
  
  const totalTTC = subtotalTTC + accessoriesTotalTTC;
  html += `<div class="price-line total"><span>TOTAL</span><span>${totalTTC.toFixed(2)} €</span></div>`;
  
  document.getElementById('pricingSummary').innerHTML = html;
}

// =====================================================
// Client Search
// =====================================================

async function searchClientByEmail() {
  const email = document.getElementById('clientSearchEmail').value.trim();
  if (!email) {
    alert('Por favor, introduce un email');
    return;
  }
  
  try {
    const response = await fetch(`/api/customers?search=${encodeURIComponent(email)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('voltride_token')}` }
    });
    const customers = await response.json();
    
    // Find exact match
    const customer = customers.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
    
    if (customer) {
      foundClient = customer;
      document.getElementById('clientFoundName').textContent = `${customer.first_name} ${customer.last_name} (${customer.email})`;
      document.getElementById('clientFoundBox').classList.add('active');
    } else {
      foundClient = null;
      document.getElementById('clientFoundBox').classList.remove('active');
      alert('Cliente no encontrado. Puede registrarse como nuevo cliente.');
    }
  } catch (e) {
    console.error('Error searching client:', e);
    alert('Error al buscar cliente');
  }
}

function useFoundClient() {
  if (!foundClient) return;
  
  document.getElementById('clientFirstName').value = foundClient.first_name || '';
  document.getElementById('clientLastName').value = foundClient.last_name || '';
  document.getElementById('clientEmail').value = foundClient.email || '';
  document.getElementById('clientPhone').value = foundClient.phone || '';
  document.getElementById('clientCountry').value = foundClient.country || '';
  document.getElementById('clientLanguage').value = foundClient.preferred_language || 'es';
  document.getElementById('clientIdType').value = foundClient.id_type || 'passport';
  document.getElementById('clientIdNumber').value = foundClient.id_number || '';
  document.getElementById('clientAddress').value = foundClient.address || '';
  
  document.getElementById('clientFoundBox').classList.remove('active');
  document.getElementById('clientSearchEmail').value = '';
}

// =====================================================
// Accessories
// =====================================================

function renderAccessories() {
  const section = document.getElementById('accessoriesSection');
  
  section.innerHTML = selectedVehicles.map(vehicle => {
    const icon = vehicle.type === 'bike' ? '🚲' : vehicle.type === 'ebike' ? '⚡' : '🛵';
    const vehicleAccessories = availableAccessories.filter(a => a.vehicleTypes.includes(vehicle.type));
    
    if (!accessoriesData[vehicle.id]) {
      accessoriesData[vehicle.id] = vehicleAccessories
        .filter(a => a.mandatory || a.price === 0)
        .map(a => ({ ...a }));
    }
    
    return `
      <div class="accessory-vehicle">
        <h3>${icon} ${vehicle.code} - ${vehicle.brand || ''} ${vehicle.model || ''}</h3>
        <div class="accessory-grid">
          ${vehicleAccessories.map(acc => {
            const isSelected = accessoriesData[vehicle.id]?.some(a => a.id === acc.id);
            return `
              <div class="accessory-card ${isSelected ? 'selected' : ''} ${acc.mandatory ? 'mandatory' : ''}"
                   onclick="${acc.mandatory ? '' : `toggleAccessory(${vehicle.id}, '${acc.id}')`}"
                   style="${acc.mandatory ? 'cursor: default;' : ''}">
                <div class="accessory-icon">${acc.icon}</div>
                <div class="accessory-name">${acc.name}</div>
                <div class="accessory-price ${acc.price > 0 ? 'paid' : ''}">
                  ${acc.price === 0 ? 'Gratis' : `${acc.price} €/día`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function toggleAccessory(vehicleId, accessoryId) {
  const acc = availableAccessories.find(a => a.id === accessoryId);
  if (!acc || acc.mandatory) return;
  
  if (!accessoriesData[vehicleId]) {
    accessoriesData[vehicleId] = [];
  }
  
  const index = accessoriesData[vehicleId].findIndex(a => a.id === accessoryId);
  if (index > -1) {
    accessoriesData[vehicleId].splice(index, 1);
  } else {
    accessoriesData[vehicleId].push({ ...acc });
  }
  
  renderAccessories();
  updatePricing();
}

// =====================================================
// Summary
// =====================================================

function renderSummary() {
  const days = calculateDays();
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  const start = new Date(`${startDate}T${startHour}:${startMinute}`);
  const end = new Date(`${endDate}T${endHour}:${endMinute}`);
  
  // Vehicles section
  let vehiclesHtml = selectedVehicles.map(v => {
    const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
    const accessories = accessoriesData[v.id] || [];
    const priceTTC = days * parseFloat(v.daily_rate);
    
    return `
      <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${icon} ${v.code}</strong>
            <div style="color: var(--text-secondary); font-size: 14px;">${v.brand || ''} ${v.model || ''}</div>
          </div>
          <div style="text-align: right;">
            <strong>${priceTTC.toFixed(2)} €</strong>
            <div style="color: var(--text-secondary); font-size: 12px;">${days} día(s) x ${parseFloat(v.daily_rate).toFixed(2)} €</div>
          </div>
        </div>
        ${accessories.length > 0 ? `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Accesorios:</div>
            ${accessories.map(a => `<span style="display: inline-block; background: var(--bg-secondary); padding: 3px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">${a.icon} ${a.name} ${a.price > 0 ? `(${a.price}€/día)` : ''}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  document.getElementById('summaryDetails').innerHTML = `
    <div class="summary-section">
      <h3>🚲 Vehículo(s) Seleccionado(s)</h3>
      ${vehiclesHtml}
    </div>
    
    <div class="summary-section">
      <h3>📅 Período de Alquiler</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px;">
          <div style="color: var(--success); font-weight: bold; margin-bottom: 5px;">🟢 INICIO</div>
          <div>${start.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div style="font-size: 24px; font-weight: bold;">${startHour}:${startMinute}</div>
        </div>
        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px;">
          <div style="color: var(--danger); font-weight: bold; margin-bottom: 5px;">🔴 FIN</div>
          <div>${end.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div style="font-size: 24px; font-weight: bold;">${endHour}:${endMinute}</div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 15px; padding: 10px; background: var(--accent); color: var(--bg-primary); border-radius: 8px;">
        <strong>⏱️ Duración: ${days} día(s)</strong>
      </div>
    </div>
  `;
  
  // Pricing - Prix TTC
  let subtotalTTC = 0;
  let accessoriesTotalTTC = 0;
  
  selectedVehicles.forEach(v => {
    subtotalTTC += days * parseFloat(v.daily_rate);
  });
  
  Object.values(accessoriesData).forEach(vehicleAccessories => {
    vehicleAccessories.forEach(acc => {
      if (acc.price > 0) {
        accessoriesTotalTTC += acc.price * days;
      }
    });
  });
  
  const totalDeposit = selectedVehicles.reduce((sum, v) => sum + (parseFloat(v.deposit) || 0), 0);
  const totalTTC = subtotalTTC + accessoriesTotalTTC;
  
  // Store for payment step
  paymentData.rental.amount = totalTTC;
  paymentData.deposit.amount = totalDeposit;
  
  document.getElementById('finalPricing').innerHTML = `
    <h3>💰 Resumen de Precios</h3>
    <div class="price-line"><span>Vehículos (${days} día(s))</span><span>${subtotalTTC.toFixed(2)} €</span></div>
    ${accessoriesTotalTTC > 0 ? `<div class="price-line"><span>Accesorios</span><span>${accessoriesTotalTTC.toFixed(2)} €</span></div>` : ''}
    <div class="price-line"><span><strong>Subtotal (IVA incl.)</strong></span><span><strong>${totalTTC.toFixed(2)} €</strong></span></div>
    <div class="price-line"><span>Depósito (reembolsable)</span><span>${totalDeposit.toFixed(2)} €</span></div>
    <div class="price-line total"><span>TOTAL A PAGAR</span><span>${(totalTTC + totalDeposit).toFixed(2)} €</span></div>
  `;
}

// =====================================================
// Client Mode
// =====================================================

function startClientMode() {
  clientMode = true;
  document.getElementById('clientModeBanner').classList.add('active');
  document.getElementById('operatorModeBanner').classList.remove('active');
  nextStep();
}

// =====================================================
// Payment
// =====================================================

function goToPayment() {
  if (!hasSignature) {
    alert('Por favor, firme el contrato');
    return;
  }
  
  // Exit client mode, enter operator mode
  clientMode = false;
  document.getElementById('clientModeBanner').classList.remove('active');
  document.getElementById('operatorModeBanner').classList.add('active');
  
  // Update payment display
  const totalToPay = paymentData.rental.amount + paymentData.deposit.amount;
  document.getElementById('paymentTotalAmount').textContent = totalToPay.toFixed(2) + ' €';
  document.getElementById('rentalAmountDisplay').textContent = paymentData.rental.amount.toFixed(2) + ' €';
  document.getElementById('depositAmountDisplay').textContent = paymentData.deposit.amount.toFixed(2) + ' €';
  
  nextStep();
}

function selectPaymentMethod(type, method) {
  paymentData[type].method = method;
  
  // Update UI
  const containerId = type === 'rental' ? 'rentalPaymentMethods' : 'depositPaymentMethods';
  document.querySelectorAll(`#${containerId} .payment-method`).forEach(el => {
    el.classList.remove('selected');
  });
  event.currentTarget.classList.add('selected');
  
  // Check if both methods selected
  checkPaymentComplete();
}

function checkPaymentComplete() {
  const isComplete = paymentData.rental.method && paymentData.deposit.method;
  document.getElementById('btnFinish').disabled = !isComplete;
}

// =====================================================
// CGV
// =====================================================

function renderCGV() {
  const lang = document.getElementById('clientLanguage')?.value || 'es';
  document.getElementById('cgvContent').innerHTML = cgvTexts[lang] || cgvTexts.es;
}

function checkCgvAccepted() {
  document.getElementById('btnNext7').disabled = !document.getElementById('acceptCgv').checked;
}

// =====================================================
// Photo ID
// =====================================================

function captureIdPhoto() {
  document.getElementById('idPhotoInput').click();
}

function uploadIdPhoto() {
  document.getElementById('idPhotoInput').click();
}

function handleIdPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      idPhotoData = e.target.result;
      const preview = document.getElementById('idPhotoPreview');
      preview.classList.remove('empty');
      preview.innerHTML = `<img src="${e.target.result}" alt="ID Photo">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// =====================================================
// Signature
// =====================================================

function initSignatureCanvas() {
  signatureCanvas = document.getElementById('signatureCanvas');
  if (!signatureCanvas) return;
  
  signatureCtx = signatureCanvas.getContext('2d');
  
  signatureCtx.fillStyle = 'white';
  signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  
  signatureCanvas.addEventListener('mousedown', startDrawing);
  signatureCanvas.addEventListener('mousemove', draw);
  signatureCanvas.addEventListener('mouseup', stopDrawing);
  signatureCanvas.addEventListener('mouseout', stopDrawing);
  
  signatureCanvas.addEventListener('touchstart', handleTouchStart);
  signatureCanvas.addEventListener('touchmove', handleTouchMove);
  signatureCanvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
  isDrawing = true;
  draw(e);
}

function draw(e) {
  if (!isDrawing) return;
  
  const rect = signatureCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  signatureCtx.lineWidth = 2;
  signatureCtx.lineCap = 'round';
  signatureCtx.strokeStyle = '#000';
  
  signatureCtx.lineTo(x, y);
  signatureCtx.stroke();
  signatureCtx.beginPath();
  signatureCtx.moveTo(x, y);
  
  hasSignature = true;
  document.getElementById('btnToPayment').disabled = false;
}

function stopDrawing() {
  isDrawing = false;
  signatureCtx.beginPath();
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  signatureCanvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  signatureCanvas.dispatchEvent(mouseEvent);
}

function clearSignature() {
  signatureCtx.fillStyle = 'white';
  signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  hasSignature = false;
  document.getElementById('btnToPayment').disabled = true;
}

// =====================================================
// Navigation
// =====================================================

function nextStep() {
  if (currentStep === 2) {
    renderAccessories();
  }
  if (currentStep === 3) {
    renderSummary();
  }
  if (currentStep === 5) {
    renderCGV();
  }
  
  document.getElementById(`step${currentStep}`).classList.remove('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add('completed');
  
  currentStep++;
  
  document.getElementById(`step${currentStep}`).classList.add('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add('active');
  
  updatePricing();
  window.scrollTo(0, 0);
}

function prevStep() {
  document.getElementById(`step${currentStep}`).classList.remove('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove('active');
  
  currentStep--;
  
  document.getElementById(`step${currentStep}`).classList.add('active');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove('completed');
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.add('active');
  
  if (currentStep <= 4) {
    clientMode = false;
    document.getElementById('clientModeBanner').classList.remove('active');
    document.getElementById('operatorModeBanner').classList.remove('active');
  }
  
  window.scrollTo(0, 0);
}

// =====================================================
// Finish Check-in
// =====================================================

async function finishCheckin() {
  if (!paymentData.rental.method || !paymentData.deposit.method) {
    alert('Por favor, seleccione los métodos de pago');
    return;
  }
  
  const user = JSON.parse(localStorage.getItem('voltride_user') || '{}');
  const signatureData = signatureCanvas.toDataURL('image/png');
  
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  const checkinData = {
    customer: {
      first_name: document.getElementById('clientFirstName').value,
      last_name: document.getElementById('clientLastName').value,
      email: document.getElementById('clientEmail').value,
      phone: document.getElementById('clientPhone').value,
      country: document.getElementById('clientCountry').value,
      preferred_language: document.getElementById('clientLanguage').value,
      id_type: document.getElementById('clientIdType').value,
      id_number: document.getElementById('clientIdNumber').value,
      address: document.getElementById('clientAddress').value
    },
    vehicles: selectedVehicles.map(v => ({
      id: v.id,
      code: v.code,
      daily_rate: v.daily_rate,
      deposit: v.deposit,
      accessories: accessoriesData[v.id] || []
    })),
    start_date: `${startDate}T${startHour}:${startMinute}`,
    planned_end_date: `${endDate}T${endHour}:${endMinute}`,
    agency_id: user.agency_id,
    user_id: user.id,
    signature: signatureData,
    id_photo: idPhotoData,
    payment: {
      rental_method: paymentData.rental.method,
      rental_amount: paymentData.rental.amount,
      deposit_method: paymentData.deposit.method,
      deposit_amount: paymentData.deposit.amount
    }
  };
  
  try {
    document.getElementById('btnFinish').disabled = true;
    document.getElementById('btnFinish').textContent = '⏳ Procesando...';
    
    const response = await fetch('/api/checkin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('voltride_token')}`
      },
      body: JSON.stringify(checkinData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(`✅ Check-in completado!\n\nContrato(s): ${result.contracts.join(', ')}`);
      
      result.rental_ids.forEach(id => {
        window.open(`/api/contracts/${id}/pdf`, '_blank');
      });
      
      window.location.href = '/app.html';
    } else {
      throw new Error(result.error || 'Error al procesar el check-in');
    }
  } catch (e) {
    console.error('Error:', e);
    alert('❌ Error: ' + e.message);
    document.getElementById('btnFinish').disabled = false;
    document.getElementById('btnFinish').textContent = '✅ Finalizar Check-in y Generar Contrato';
  }
}

function exitCheckin() {
  if (confirm('¿Seguro que desea salir? Se perderán los datos no guardados.')) {
    window.location.href = '/app.html';
  }
}
