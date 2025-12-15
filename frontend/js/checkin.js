// =====================================================
// VOLTRIDE - Check-in Walk-in
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

// Accessoires disponibles (à personnaliser)
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
    El presente contrato tiene por objeto la cesión temporal del uso de un vehículo de movilidad personal (bicicleta, bicicleta eléctrica o patinete eléctrico) por parte de VOLTRIDE al Cliente.</p>
    
    <p><strong>2. Estado del vehículo</strong><br>
    El cliente reconoce haber recibido el vehículo en perfecto estado de funcionamiento y se compromete a devolverlo en las mismas condiciones.</p>
    
    <p><strong>3. Responsabilidad del cliente</strong><br>
    El cliente es responsable de cualquier daño o pérdida del vehículo durante el período de alquiler. En caso de robo, el cliente deberá presentar denuncia policial.</p>
    
    <p><strong>4. Depósito</strong><br>
    El depósito será devuelto íntegramente si el vehículo se devuelve sin daños y en el plazo acordado.</p>
    
    <p><strong>5. Retraso en la devolución</strong><br>
    En caso de retraso en la devolución, se aplicará un cargo adicional equivalente a la tarifa diaria por cada día de retraso.</p>
    
    <p><strong>6. Normas de circulación</strong><br>
    El cliente se compromete a respetar el código de circulación vigente y a utilizar el vehículo de manera responsable.</p>
    
    <p><strong>7. Prohibiciones</strong><br>
    - Está prohibido el uso del vehículo bajo los efectos del alcohol o drogas.<br>
    - El vehículo no puede ser subalquilado ni prestado a terceros.<br>
    - El vehículo debe estar guardado en lugar seguro entre las 21h y las 7h.</p>
    
    <p><strong>8. Averías</strong><br>
    En caso de avería, el cliente debe contactar inmediatamente con la agencia.</p>
    
    <p><strong>9. Limpieza</strong><br>
    Si el vehículo se devuelve sucio, se aplicará un cargo de 5 EUR.</p>
    
    <p><strong>10. Protección de datos</strong><br>
    Los datos personales del cliente serán tratados conforme al RGPD y utilizados únicamente para la gestión del alquiler.</p>
  `,
  fr: `
    <h3>CONDITIONS GÉNÉRALES DE LOCATION - VOLTRIDE</h3>
    <p><strong>1. Objet du contrat</strong><br>
    Le présent contrat a pour objet la mise à disposition temporaire d'un véhicule de mobilité personnelle (vélo, vélo électrique ou trottinette électrique) par VOLTRIDE au Client.</p>
    
    <p><strong>2. État du véhicule</strong><br>
    Le client reconnaît avoir reçu le véhicule en parfait état de fonctionnement et s'engage à le restituer dans les mêmes conditions.</p>
    
    <p><strong>3. Responsabilité du client</strong><br>
    Le client est responsable de tout dommage ou perte du véhicule pendant la période de location. En cas de vol, le client devra déposer une plainte auprès de la police.</p>
    
    <p><strong>4. Caution</strong><br>
    La caution sera intégralement restituée si le véhicule est rendu sans dommages et dans les délais convenus.</p>
    
    <p><strong>5. Retard de restitution</strong><br>
    En cas de retard de restitution, un supplément équivalent au tarif journalier sera appliqué pour chaque jour de retard.</p>
    
    <p><strong>6. Code de la route</strong><br>
    Le client s'engage à respecter le code de la route en vigueur et à utiliser le véhicule de manière responsable.</p>
    
    <p><strong>7. Interdictions</strong><br>
    - L'utilisation du véhicule sous l'influence de l'alcool ou de drogues est interdite.<br>
    - Le véhicule ne peut être sous-loué ni prêté à des tiers.<br>
    - Le véhicule doit être stationné en lieu sûr entre 21h et 7h.</p>
    
    <p><strong>8. Pannes</strong><br>
    En cas de panne, le client doit contacter immédiatement l'agence.</p>
    
    <p><strong>9. Propreté</strong><br>
    Si le véhicule est rendu sale, des frais de 5 EUR seront appliqués.</p>
    
    <p><strong>10. Protection des données</strong><br>
    Les données personnelles du client seront traitées conformément au RGPD et utilisées uniquement pour la gestion de la location.</p>
  `,
  en: `
    <h3>GENERAL RENTAL CONDITIONS - VOLTRIDE</h3>
    <p><strong>1. Purpose of the contract</strong><br>
    This contract governs the temporary rental of a personal mobility vehicle (bicycle, electric bicycle or electric scooter) from VOLTRIDE to the Customer.</p>
    
    <p><strong>2. Vehicle condition</strong><br>
    The customer acknowledges having received the vehicle in perfect working condition and agrees to return it in the same condition.</p>
    
    <p><strong>3. Customer responsibility</strong><br>
    The customer is responsible for any damage or loss of the vehicle during the rental period. In case of theft, the customer must file a police report.</p>
    
    <p><strong>4. Deposit</strong><br>
    The deposit will be fully refunded if the vehicle is returned without damage and within the agreed timeframe.</p>
    
    <p><strong>5. Late return</strong><br>
    In case of late return, an additional charge equivalent to the daily rate will be applied for each day of delay.</p>
    
    <p><strong>6. Traffic rules</strong><br>
    The customer agrees to comply with current traffic regulations and to use the vehicle responsibly.</p>
    
    <p><strong>7. Prohibitions</strong><br>
    - Use of the vehicle under the influence of alcohol or drugs is prohibited.<br>
    - The vehicle cannot be sublet or lent to third parties.<br>
    - The vehicle must be stored in a secure location between 9pm and 7am.</p>
    
    <p><strong>8. Breakdowns</strong><br>
    In case of breakdown, the customer must contact the agency immediately.</p>
    
    <p><strong>9. Cleanliness</strong><br>
    If the vehicle is returned dirty, a 5 EUR cleaning fee will be applied.</p>
    
    <p><strong>10. Data protection</strong><br>
    The customer's personal data will be processed in accordance with GDPR and used only for rental management.</p>
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
  const currentHour = today.getHours();
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
    hours.push(`<option value="${String(h).padStart(2, '0')}">${String(h).padStart(2, '0')}:00</option>`);
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
  renderVehicles(vehiclesData.filter(v => {
    const filterType = document.querySelector('.btn.btn-sm:not(.btn-secondary)')?.textContent || 'Todos';
    if (filterType === 'Todos') return true;
    if (filterType.includes('City')) return v.type === 'bike';
    if (filterType.includes('E-Bike')) return v.type === 'ebike';
    if (filterType.includes('E-Moto')) return v.type === 'scooter';
    return true;
  }));
  
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
  document.querySelectorAll('.vehicle-grid').forEach(g => g.innerHTML = '');
  
  let filtered = vehiclesData;
  if (type !== 'all') {
    filtered = vehiclesData.filter(v => v.type === type);
  }
  
  // Update button styles
  document.querySelectorAll('.wizard-panel#step1 .btn-sm').forEach(btn => {
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  });
  event.target.classList.remove('btn-secondary');
  event.target.classList.add('btn-primary');
  
  renderVehicles(filtered);
}

// =====================================================
// Pricing
// =====================================================

function updatePricing() {
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  if (!startDate || !endDate) return;
  
  const start = new Date(`${startDate}T${startHour}:${startMinute}`);
  const end = new Date(`${endDate}T${endHour}:${endMinute}`);
  
  const diffHours = (end - start) / (1000 * 60 * 60);
  let days = Math.floor(diffHours / 24);
  if (diffHours % 24 > 1) days++;
  days = Math.max(1, days);
  
  let html = `<div class="price-line"><span>Período</span><span><strong>${days} día(s)</strong></span></div>`;
  
  let subtotal = 0;
  selectedVehicles.forEach(v => {
    const price = days * parseFloat(v.daily_rate);
    subtotal += price;
    const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
    html += `<div class="price-line"><span>${icon} ${v.code}</span><span>${price.toFixed(2)} €</span></div>`;
  });
  
  // Add accessories price
  let accessoriesTotal = 0;
  Object.values(accessoriesData).forEach(vehicleAccessories => {
    vehicleAccessories.forEach(acc => {
      if (acc.price > 0) {
        accessoriesTotal += acc.price * days;
      }
    });
  });
  
  if (accessoriesTotal > 0) {
    html += `<div class="price-line"><span>🎒 Accesorios</span><span>${accessoriesTotal.toFixed(2)} €</span></div>`;
  }
  
  const total = subtotal + accessoriesTotal;
  html += `<div class="price-line total"><span>TOTAL</span><span>${total.toFixed(2)} €</span></div>`;
  
  document.getElementById('pricingSummary').innerHTML = html;
}

// =====================================================
// Accessories
// =====================================================

function renderAccessories() {
  const section = document.getElementById('accessoriesSection');
  
  section.innerHTML = selectedVehicles.map(vehicle => {
    const icon = vehicle.type === 'bike' ? '🚲' : vehicle.type === 'ebike' ? '⚡' : '🛵';
    const vehicleAccessories = availableAccessories.filter(a => a.vehicleTypes.includes(vehicle.type));
    
    // Initialize accessories data for this vehicle if not exists
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
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  const start = new Date(`${startDate}T${startHour}:${startMinute}`);
  const end = new Date(`${endDate}T${endHour}:${endMinute}`);
  
  const diffHours = (end - start) / (1000 * 60 * 60);
  let days = Math.floor(diffHours / 24);
  if (diffHours % 24 > 1) days++;
  days = Math.max(1, days);
  
  // Vehicles section
  let vehiclesHtml = selectedVehicles.map(v => {
    const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
    const accessories = accessoriesData[v.id] || [];
    return `
      <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${icon} ${v.code}</strong>
            <div style="color: var(--text-secondary); font-size: 14px;">${v.brand || ''} ${v.model || ''}</div>
          </div>
          <div style="text-align: right;">
            <strong>${(days * parseFloat(v.daily_rate)).toFixed(2)} €</strong>
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
  
  // Pricing
  let subtotal = 0;
  let accessoriesTotal = 0;
  
  selectedVehicles.forEach(v => {
    subtotal += days * parseFloat(v.daily_rate);
  });
  
  Object.values(accessoriesData).forEach(vehicleAccessories => {
    vehicleAccessories.forEach(acc => {
      if (acc.price > 0) {
        accessoriesTotal += acc.price * days;
      }
    });
  });
  
  // Calculate deposit (sum of all vehicle deposits)
  const totalDeposit = selectedVehicles.reduce((sum, v) => sum + (parseFloat(v.deposit) || 0), 0);
  
  const total = subtotal + accessoriesTotal;
  
  document.getElementById('finalPricing').innerHTML = `
    <h3>💰 Resumen de Precios</h3>
    <div class="price-line"><span>Vehículos (${days} día(s))</span><span>${subtotal.toFixed(2)} €</span></div>
    ${accessoriesTotal > 0 ? `<div class="price-line"><span>Accesorios</span><span>${accessoriesTotal.toFixed(2)} €</span></div>` : ''}
    <div class="price-line"><span>Subtotal</span><span><strong>${total.toFixed(2)} €</strong></span></div>
    <div class="price-line"><span>Depósito (reembolsable)</span><span>${totalDeposit.toFixed(2)} €</span></div>
    <div class="price-line total"><span>TOTAL A PAGAR</span><span>${(total + totalDeposit).toFixed(2)} €</span></div>
  `;
}

// =====================================================
// Client Mode
// =====================================================

function startClientMode() {
  clientMode = true;
  document.getElementById('clientModeBanner').classList.add('active');
  document.querySelectorAll('.wizard-step.client-step').forEach(s => s.style.background = 'var(--warning)');
  nextStep();
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
  signatureCtx = signatureCanvas.getContext('2d');
  
  // Set white background
  signatureCtx.fillStyle = 'white';
  signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  
  // Mouse events
  signatureCanvas.addEventListener('mousedown', startDrawing);
  signatureCanvas.addEventListener('mousemove', draw);
  signatureCanvas.addEventListener('mouseup', stopDrawing);
  signatureCanvas.addEventListener('mouseout', stopDrawing);
  
  // Touch events
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
  document.getElementById('btnFinish').disabled = false;
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
  document.getElementById('btnFinish').disabled = true;
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
  }
  
  window.scrollTo(0, 0);
}

// =====================================================
// Finish Check-in
// =====================================================

async function finishCheckin() {
  if (!hasSignature) {
    alert('Por favor, firme el contrato');
    return;
  }
  
  const user = JSON.parse(localStorage.getItem('voltride_user') || '{}');
  const signatureData = signatureCanvas.toDataURL('image/png');
  
  // Collect all data
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  const checkinData = {
    // Customer
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
    // Vehicles
    vehicles: selectedVehicles.map(v => ({
      id: v.id,
      code: v.code,
      daily_rate: v.daily_rate,
      deposit: v.deposit,
      accessories: accessoriesData[v.id] || []
    })),
    // Dates
    start_date: `${startDate}T${startHour}:${startMinute}`,
    planned_end_date: `${endDate}T${endHour}:${endMinute}`,
    // Agency & User
    agency_id: user.agency_id,
    user_id: user.id,
    // Signature & Photos
    signature: signatureData,
    id_photo: idPhotoData
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
      
      // Open PDF contracts
      result.rental_ids.forEach(id => {
        window.open(`/api/contracts/${id}/pdf`, '_blank');
      });
      
      // Redirect to dashboard
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
