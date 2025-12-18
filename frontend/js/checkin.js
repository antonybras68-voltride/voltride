// =====================================================
// VOLTRIDE - Check-in Walk-in (Version 3.0)
// Dates d'abord, tarifs depuis config, photos, KM motos
// =====================================================

let currentStep = 1;
let selectedVehicle = null;
let vehiclesData = [];
let selectedAccessories = [];
let clientMode = false;
let signatureCanvas, signatureCtx;
let isDrawing = false;
let hasSignature = false;
let idPhotoData = null;
let foundClient = null;
let rentalDays = 1;

// Données de configuration (chargées depuis Tarifas)
let pricingConfig = {
  vehicleTypes: [],
  accessories: []
};

// Payment data
let paymentData = {
  rental: { method: null, amount: 0 },
  deposit: { method: null, amount: 0 }
};

// Types motorisés (nécessitent KM)
const MOTORIZED_TYPES = ['scooter', 'e-motocross', 'emotocross', 'e_motocross', 'moto', 'motocross'];

// CGV multilingues
const cgvTexts = {
  es: `<h3>CONDICIONES GENERALES DE ALQUILER - VOLTRIDE</h3>
    <p><strong>1. Objeto del contrato</strong><br>El presente contrato tiene por objeto la cesión temporal del uso de un vehículo de movilidad personal por parte de VOLTRIDE al Cliente.</p>
    <p><strong>2. Estado del vehículo</strong><br>El cliente reconoce haber recibido el vehículo en perfecto estado de funcionamiento.</p>
    <p><strong>3. Responsabilidad del cliente</strong><br>El cliente es responsable de cualquier daño o pérdida del vehículo durante el período de alquiler.</p>
    <p><strong>4. Depósito</strong><br>El depósito será devuelto íntegramente si el vehículo se devuelve sin daños.</p>
    <p><strong>5. Retraso en la devolución</strong><br>En caso de retraso, se aplicará un cargo adicional equivalente a la tarifa diaria.</p>
    <p><strong>6. Normas de circulación</strong><br>El cliente se compromete a respetar el código de circulación vigente.</p>
    <p><strong>7. Prohibiciones</strong><br>- Uso bajo efectos del alcohol o drogas prohibido.<br>- No subalquilar ni prestar a terceros.<br>- Guardar en lugar seguro entre 21h y 7h.</p>
    <p><strong>8. Averías</strong><br>Contactar inmediatamente con la agencia en caso de avería.</p>
    <p><strong>9. Limpieza</strong><br>Cargo de 5 EUR si el vehículo se devuelve sucio.</p>
    <p><strong>10. Protección de datos</strong><br>Datos tratados conforme al RGPD.</p>`,
  fr: `<h3>CONDITIONS GÉNÉRALES DE LOCATION - VOLTRIDE</h3>
    <p><strong>1. Objet du contrat</strong><br>Mise à disposition temporaire d'un véhicule de mobilité personnelle par VOLTRIDE au Client.</p>
    <p><strong>2. État du véhicule</strong><br>Le client reconnaît avoir reçu le véhicule en parfait état.</p>
    <p><strong>3. Responsabilité du client</strong><br>Le client est responsable de tout dommage ou perte pendant la location.</p>
    <p><strong>4. Caution</strong><br>Restituée intégralement si le véhicule est rendu sans dommages.</p>
    <p><strong>5. Retard de restitution</strong><br>Supplément journalier appliqué en cas de retard.</p>
    <p><strong>6. Code de la route</strong><br>Le client s'engage à respecter le code de la route.</p>
    <p><strong>7. Interdictions</strong><br>- Usage sous alcool/drogues interdit.<br>- Ne pas sous-louer ni prêter.<br>- Stationner en lieu sûr entre 21h et 7h.</p>
    <p><strong>8. Pannes</strong><br>Contacter immédiatement l'agence.</p>
    <p><strong>9. Propreté</strong><br>Frais de 5 EUR si véhicule rendu sale.</p>
    <p><strong>10. Protection des données</strong><br>Données traitées conformément au RGPD.</p>`,
  en: `<h3>GENERAL RENTAL CONDITIONS - VOLTRIDE</h3>
    <p><strong>1. Purpose</strong><br>Temporary rental of a personal mobility vehicle from VOLTRIDE to Customer.</p>
    <p><strong>2. Vehicle condition</strong><br>Customer acknowledges receiving the vehicle in perfect condition.</p>
    <p><strong>3. Customer responsibility</strong><br>Customer is responsible for any damage or loss during the rental.</p>
    <p><strong>4. Deposit</strong><br>Fully refunded if vehicle is returned without damage.</p>
    <p><strong>5. Late return</strong><br>Additional daily charge applied for late returns.</p>
    <p><strong>6. Traffic rules</strong><br>Customer agrees to comply with traffic regulations.</p>
    <p><strong>7. Prohibitions</strong><br>- No use under alcohol/drugs.<br>- No subletting or lending.<br>- Store securely between 9pm-7am.</p>
    <p><strong>8. Breakdowns</strong><br>Contact agency immediately.</p>
    <p><strong>9. Cleanliness</strong><br>5 EUR fee if returned dirty.</p>
    <p><strong>10. Data protection</strong><br>Data processed per GDPR.</p>`
};

// =====================================================
// Utilitaires
// =====================================================

function isMotorizedVehicle(type) {
  if (!type) return false;
  const normalizedType = type.toLowerCase().replace(/[-_\s]/g, '');
  return MOTORIZED_TYPES.some(t => normalizedType.includes(t.replace(/[-_\s]/g, '')));
}

function formatDateInput(date) {
  return date.toISOString().split('T')[0];
}

function getToken() {
  return localStorage.getItem('voltride_token');
}

// =====================================================
// Initialisation
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/';
    return;
  }
  
  const user = JSON.parse(localStorage.getItem('voltride_user') || '{}');
  document.getElementById('agencyName').textContent = user.agency_name || 'Voltride';
  
  initHourSelects();
  initSignatureCanvas();
  
  // Charger la configuration des tarifs
  await loadPricingConfig();
  
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
  
  updateDaysDisplay();
});

function initHourSelects() {
  const hours = [];
  for (let h = 8; h <= 21; h++) {
    hours.push(`<option value="${String(h).padStart(2, '0')}">${String(h).padStart(2, '0')}h</option>`);
  }
  document.getElementById('startHour').innerHTML = hours.join('');
  document.getElementById('endHour').innerHTML = hours.join('');
}

// =====================================================
// Chargement des tarifs depuis config
// =====================================================

async function loadPricingConfig() {
  try {
    const response = await fetch('/api/pricing', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (response.ok) {
      const data = await response.json();
      pricingConfig.vehicleTypes = data.vehicleTypes || [];
      pricingConfig.accessories = data.accessories || [];
      console.log('✅ Config tarifs chargée:', pricingConfig);
    }
  } catch (e) {
    console.error('Erreur chargement tarifs:', e);
  }
}

// Récupérer le tarif d'un type de véhicule pour X jours
function getVehicleTypePrice(type, days) {
  const vehicleType = pricingConfig.vehicleTypes.find(vt => 
    vt.id.toLowerCase() === type.toLowerCase() || 
    vt.name.toLowerCase() === type.toLowerCase()
  );
  
  if (!vehicleType || !vehicleType.prices) {
    return { dailyRate: 0, total: 0, deposit: 0 };
  }
  
  // Trouver le meilleur tarif selon le nombre de jours (tarif dégressif)
  let dailyRate = vehicleType.prices['1'] || 0;
  
  const sortedDays = Object.keys(vehicleType.prices)
    .map(Number)
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);
  
  for (const d of sortedDays) {
    if (days >= d) {
      dailyRate = vehicleType.prices[String(d)];
    }
  }
  
  return {
    dailyRate: dailyRate,
    total: dailyRate * days,
    deposit: vehicleType.deposit || 0,
    image: vehicleType.image || null,
    name: vehicleType.name
  };
}

// Récupérer le tarif d'un accessoire pour X jours
function getAccessoryPrice(accessoryId, days) {
  const accessory = pricingConfig.accessories.find(a => 
    a.id === accessoryId || a.name.toLowerCase() === accessoryId.toLowerCase()
  );
  
  if (!accessory) {
    return { dailyRate: 0, total: 0 };
  }
  
  let dailyRate = accessory.prices?.['1'] || accessory.dailyRate || 0;
  
  if (accessory.prices) {
    const sortedDays = Object.keys(accessory.prices)
      .map(Number)
      .filter(d => !isNaN(d))
      .sort((a, b) => a - b);
    
    for (const d of sortedDays) {
      if (days >= d) {
        dailyRate = accessory.prices[String(d)];
      }
    }
  }
  
  return {
    dailyRate: dailyRate,
    total: dailyRate * days,
    image: accessory.image || null,
    name: accessory.name,
    icon: accessory.icon || '🎒',
    deposit: accessory.deposit || 0
  };
}

// =====================================================
// Étape 1: Dates
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

function updateDaysDisplay() {
  rentalDays = calculateDays();
  const daysDisplay = document.getElementById('daysDisplay');
  if (daysDisplay) {
    daysDisplay.innerHTML = `<strong>${rentalDays}</strong> día(s)`;
  }
}

// =====================================================
// Étape 2: Véhicules disponibles
// =====================================================

async function loadAvailableVehicles() {
  const user = JSON.parse(localStorage.getItem('voltride_user') || '{}');
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  
  try {
    // Charger tous les véhicules de l'agence
    const response = await fetch(`/api/vehicles?agency_id=${user.agency_id}`, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    const allVehicles = await response.json();
    
    // Filtrer uniquement les véhicules disponibles
    vehiclesData = allVehicles.filter(v => v.status === 'available');
    
    renderVehicles();
  } catch (e) {
    console.error('Error loading vehicles:', e);
    document.getElementById('vehicleGrid').innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--danger);">
        Error al cargar vehículos: ${e.message}
      </div>
    `;
  }
}

function renderVehicles() {
  const grid = document.getElementById('vehicleGrid');
  const days = rentalDays;
  
  if (vehiclesData.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary); grid-column: 1 / -1;">
        No hay vehículos disponibles para estas fechas
      </div>
    `;
    return;
  }
  
  grid.innerHTML = vehiclesData.map(v => {
    const isSelected = selectedVehicle?.id === v.id;
    const pricing = getVehicleTypePrice(v.type, days);
    const isMotorized = isMotorizedVehicle(v.type);
    
    // Image du type depuis config ou icône par défaut
    let imageHtml;
    if (pricing.image) {
      imageHtml = `<img src="${pricing.image}" alt="${v.type}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;">`;
    } else {
      const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
      imageHtml = `<div style="font-size: 48px;">${icon}</div>`;
    }
    
    return `
      <div class="vehicle-card ${isSelected ? 'selected' : ''}" 
           onclick="selectVehicle(${v.id})"
           data-type="${v.type}">
        <div class="vehicle-card-image">${imageHtml}</div>
        <div class="vehicle-card-code">${v.code}</div>
        <div class="vehicle-card-type">${v.brand || ''} ${v.model || ''}</div>
        <div class="vehicle-card-type-name">${pricing.name || v.type}</div>
        
        <div class="vehicle-card-pricing">
          <div class="vehicle-price-total">${pricing.total.toFixed(2)} €</div>
          <div class="vehicle-price-detail">${days} día(s) x ${pricing.dailyRate.toFixed(2)} €/día</div>
        </div>
        
        <div class="vehicle-card-deposit">
          Caución: ${pricing.deposit.toFixed(2)} €
        </div>
        
        ${isMotorized ? `
          <div class="vehicle-motorized-badge">
            🏍️ KM actual: ${v.current_km || 0}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function selectVehicle(id) {
  const vehicle = vehiclesData.find(v => v.id === id);
  if (!vehicle) return;
  
  selectedVehicle = vehicle;
  selectedAccessories = []; // Reset accessoires
  
  renderVehicles();
  document.getElementById('btnNext2').disabled = false;
  
  // Afficher le résumé du véhicule sélectionné
  updateSelectedVehicleDisplay();
}

function updateSelectedVehicleDisplay() {
  const container = document.getElementById('selectedVehicleBox');
  if (!selectedVehicle || !container) return;
  
  const pricing = getVehicleTypePrice(selectedVehicle.type, rentalDays);
  const icon = selectedVehicle.type === 'bike' ? '🚲' : selectedVehicle.type === 'ebike' ? '⚡' : '🛵';
  
  container.style.display = 'block';
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px;">
      <div style="font-size: 32px;">${icon}</div>
      <div>
        <strong>${selectedVehicle.code}</strong> - ${selectedVehicle.brand || ''} ${selectedVehicle.model || ''}
        <div style="color: var(--accent); font-weight: bold;">${pricing.total.toFixed(2)} € (${rentalDays} días)</div>
      </div>
    </div>
  `;
}

function filterVehicles(type) {
  document.querySelectorAll('#step2 .filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  }
  
  const grid = document.getElementById('vehicleGrid');
  const days = rentalDays;
  
  let filtered = vehiclesData;
  if (type !== 'all') {
    filtered = vehiclesData.filter(v => v.type === type);
  }
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary); grid-column: 1 / -1;">
        No hay vehículos de este tipo disponibles
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filtered.map(v => {
    const isSelected = selectedVehicle?.id === v.id;
    const pricing = getVehicleTypePrice(v.type, days);
    const isMotorized = isMotorizedVehicle(v.type);
    
    let imageHtml;
    if (pricing.image) {
      imageHtml = `<img src="${pricing.image}" alt="${v.type}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;">`;
    } else {
      const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
      imageHtml = `<div style="font-size: 48px;">${icon}</div>`;
    }
    
    return `
      <div class="vehicle-card ${isSelected ? 'selected' : ''}" 
           onclick="selectVehicle(${v.id})"
           data-type="${v.type}">
        <div class="vehicle-card-image">${imageHtml}</div>
        <div class="vehicle-card-code">${v.code}</div>
        <div class="vehicle-card-type">${v.brand || ''} ${v.model || ''}</div>
        <div class="vehicle-card-type-name">${pricing.name || v.type}</div>
        
        <div class="vehicle-card-pricing">
          <div class="vehicle-price-total">${pricing.total.toFixed(2)} €</div>
          <div class="vehicle-price-detail">${days} día(s) x ${pricing.dailyRate.toFixed(2)} €/día</div>
        </div>
        
        <div class="vehicle-card-deposit">
          Caución: ${pricing.deposit.toFixed(2)} €
        </div>
        
        ${isMotorized ? `
          <div class="vehicle-motorized-badge">
            🏍️ KM actual: ${v.current_km || 0}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// =====================================================
// Étape 3: Accessoires
// =====================================================

function renderAccessories() {
  const section = document.getElementById('accessoriesSection');
  
  if (!selectedVehicle) {
    section.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Seleccione un vehículo primero</p>';
    return;
  }
  
  const days = rentalDays;
  const vehicleType = selectedVehicle.type;
  
  // Filtrer les accessoires compatibles avec ce type de véhicule
  let compatibleAccessories = pricingConfig.accessories;
  
  // Si l'accessoire a une liste de types compatibles, filtrer
  compatibleAccessories = compatibleAccessories.filter(acc => {
    if (!acc.compatibleTypes || acc.compatibleTypes.length === 0) return true;
    return acc.compatibleTypes.some(t => 
      t.toLowerCase() === vehicleType.toLowerCase() ||
      vehicleType.toLowerCase().includes(t.toLowerCase())
    );
  });
  
  if (compatibleAccessories.length === 0) {
    section.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        No hay accesorios disponibles para este tipo de vehículo
      </div>
    `;
    return;
  }
  
  section.innerHTML = `
    <div class="accessory-grid">
      ${compatibleAccessories.map(acc => {
        const pricing = getAccessoryPrice(acc.id, days);
        const isSelected = selectedAccessories.some(a => a.id === acc.id);
        const isRequired = acc.insuranceRequired === 'required';
        
        let imageHtml;
        if (acc.image) {
          imageHtml = `<img src="${acc.image}" alt="${acc.name}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px;">`;
        } else {
          imageHtml = `<div style="font-size: 36px;">${acc.icon || '🎒'}</div>`;
        }
        
        return `
          <div class="accessory-card ${isSelected ? 'selected' : ''} ${isRequired ? 'required' : ''}"
               onclick="toggleAccessory('${acc.id}')">
            <div class="accessory-image">${imageHtml}</div>
            <div class="accessory-name">${acc.name}</div>
            <div class="accessory-pricing">
              ${pricing.total > 0 ? `
                <div class="accessory-price">${pricing.total.toFixed(2)} €</div>
                <div class="accessory-detail">${days} día(s) x ${pricing.dailyRate.toFixed(2)} €</div>
              ` : `
                <div class="accessory-price free">Gratis</div>
              `}
            </div>
            ${pricing.deposit > 0 ? `<div class="accessory-deposit">Caución: ${pricing.deposit.toFixed(2)} €</div>` : ''}
            ${isRequired ? '<div class="accessory-required-badge">Obligatorio</div>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Pré-sélectionner les accessoires obligatoires
  compatibleAccessories.forEach(acc => {
    if (acc.insuranceRequired === 'required' && !selectedAccessories.some(a => a.id === acc.id)) {
      selectedAccessories.push(acc);
    }
  });
}

function toggleAccessory(accessoryId) {
  const acc = pricingConfig.accessories.find(a => a.id === accessoryId);
  if (!acc) return;
  
  // Ne pas permettre de désélectionner les obligatoires
  if (acc.insuranceRequired === 'required') {
    return;
  }
  
  const index = selectedAccessories.findIndex(a => a.id === accessoryId);
  if (index > -1) {
    selectedAccessories.splice(index, 1);
  } else {
    selectedAccessories.push(acc);
  }
  
  renderAccessories();
  updatePricing();
}

// =====================================================
// Pricing Summary
// =====================================================

function updatePricing() {
  const days = rentalDays;
  const pricingDiv = document.getElementById('pricingSummary');
  if (!pricingDiv) return;
  
  if (!selectedVehicle) {
    pricingDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Seleccione un vehículo</p>';
    return;
  }
  
  const vehiclePricing = getVehicleTypePrice(selectedVehicle.type, days);
  const icon = selectedVehicle.type === 'bike' ? '🚲' : selectedVehicle.type === 'ebike' ? '⚡' : '🛵';
  
  let html = `
    <div class="price-line">
      <span>Período</span>
      <span><strong>${days} día(s)</strong></span>
    </div>
    <div class="price-line">
      <span>${icon} ${selectedVehicle.code}</span>
      <span>${vehiclePricing.total.toFixed(2)} €</span>
    </div>
  `;
  
  let accessoriesTotal = 0;
  selectedAccessories.forEach(acc => {
    const accPricing = getAccessoryPrice(acc.id, days);
    if (accPricing.total > 0) {
      accessoriesTotal += accPricing.total;
      html += `
        <div class="price-line">
          <span>${acc.icon || '🎒'} ${acc.name}</span>
          <span>${accPricing.total.toFixed(2)} €</span>
        </div>
      `;
    }
  });
  
  const totalRental = vehiclePricing.total + accessoriesTotal;
  
  // Caution
  let totalDeposit = vehiclePricing.deposit;
  selectedAccessories.forEach(acc => {
    const accPricing = getAccessoryPrice(acc.id, days);
    totalDeposit += accPricing.deposit || 0;
  });
  
  html += `
    <div class="price-line subtotal">
      <span>Subtotal alquiler</span>
      <span>${totalRental.toFixed(2)} €</span>
    </div>
    <div class="price-line">
      <span>Caución (reembolsable)</span>
      <span>${totalDeposit.toFixed(2)} €</span>
    </div>
    <div class="price-line total">
      <span>TOTAL</span>
      <span>${(totalRental + totalDeposit).toFixed(2)} €</span>
    </div>
  `;
  
  pricingDiv.innerHTML = html;
  
  // Update payment data
  paymentData.rental.amount = totalRental;
  paymentData.deposit.amount = totalDeposit;
}

// =====================================================
// Summary
// =====================================================

function renderSummary() {
  const days = rentalDays;
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  const start = new Date(`${startDate}T${startHour}:${startMinute}`);
  const end = new Date(`${endDate}T${endHour}:${endMinute}`);
  
  if (!selectedVehicle) return;
  
  const vehiclePricing = getVehicleTypePrice(selectedVehicle.type, days);
  const icon = selectedVehicle.type === 'bike' ? '🚲' : selectedVehicle.type === 'ebike' ? '⚡' : '🛵';
  const isMotorized = isMotorizedVehicle(selectedVehicle.type);
  
  // Véhicule
  let vehicleHtml = `
    <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 15px;">
          ${vehiclePricing.image ? 
            `<img src="${vehiclePricing.image}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px;">` : 
            `<div style="font-size: 40px;">${icon}</div>`
          }
          <div>
            <strong>${selectedVehicle.code}</strong>
            <div style="color: var(--text-secondary); font-size: 14px;">${selectedVehicle.brand || ''} ${selectedVehicle.model || ''}</div>
            ${isMotorized ? `<div style="color: var(--info); font-size: 12px;">KM: ${selectedVehicle.current_km || 0}</div>` : ''}
          </div>
        </div>
        <div style="text-align: right;">
          <strong>${vehiclePricing.total.toFixed(2)} €</strong>
          <div style="color: var(--text-secondary); font-size: 12px;">${days} día(s) x ${vehiclePricing.dailyRate.toFixed(2)} €</div>
        </div>
      </div>
    </div>
  `;
  
  // Accessoires
  let accessoriesHtml = '';
  if (selectedAccessories.length > 0) {
    accessoriesHtml = `
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Accesorios:</div>
        ${selectedAccessories.map(a => {
          const accPricing = getAccessoryPrice(a.id, days);
          return `<span style="display: inline-block; background: var(--bg-secondary); padding: 3px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">${a.icon || '🎒'} ${a.name} ${accPricing.total > 0 ? `(${accPricing.total.toFixed(2)}€)` : ''}</span>`;
        }).join('')}
      </div>
    `;
  }
  
  document.getElementById('summaryDetails').innerHTML = `
    <div class="summary-section">
      <h3>🚲 Vehículo Seleccionado</h3>
      ${vehicleHtml}
      ${accessoriesHtml}
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
        <strong>Duración: ${days} día(s)</strong>
      </div>
    </div>
  `;
  
  // Pricing final
  let accessoriesTotal = 0;
  let accessoriesDeposit = 0;
  selectedAccessories.forEach(acc => {
    const accPricing = getAccessoryPrice(acc.id, days);
    accessoriesTotal += accPricing.total;
    accessoriesDeposit += accPricing.deposit || 0;
  });
  
  const totalRental = vehiclePricing.total + accessoriesTotal;
  const totalDeposit = vehiclePricing.deposit + accessoriesDeposit;
  
  paymentData.rental.amount = totalRental;
  paymentData.deposit.amount = totalDeposit;
  
  document.getElementById('finalPricing').innerHTML = `
    <h3>💰 Resumen de Precios</h3>
    <div class="price-line"><span>Vehículo (${days} día(s))</span><span>${vehiclePricing.total.toFixed(2)} €</span></div>
    ${accessoriesTotal > 0 ? `<div class="price-line"><span>Accesorios</span><span>${accessoriesTotal.toFixed(2)} €</span></div>` : ''}
    <div class="price-line"><span><strong>Subtotal (IVA incl.)</strong></span><span><strong>${totalRental.toFixed(2)} €</strong></span></div>
    <div class="price-line"><span>Caución (reembolsable)</span><span>${totalDeposit.toFixed(2)} €</span></div>
    <div class="price-line total"><span>TOTAL A PAGAR</span><span>${(totalRental + totalDeposit).toFixed(2)} €</span></div>
  `;
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
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    const customers = await response.json();
    
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
// Client Mode
// =====================================================

function startClientMode() {
  clientMode = true;
  document.getElementById('clientModeBanner').classList.add('active');
  document.getElementById('operatorModeBanner').classList.remove('active');
  nextStep();
}

// =====================================================
// Photo ID avec OCR
// =====================================================

function captureIdPhoto() {
  document.getElementById('idPhotoInput').click();
}

function uploadIdPhoto() {
  document.getElementById('idPhotoInput').click();
}

async function handleIdPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      idPhotoData = e.target.result;
      const preview = document.getElementById('idPhotoPreview');
      preview.classList.remove('empty');
      preview.innerHTML = `<img src="${e.target.result}" alt="ID Photo">`;
      
      await analyzeDocumentWithOCR(e.target.result);
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function analyzeDocumentWithOCR(imageData) {
  const preview = document.getElementById('idPhotoPreview');
  preview.style.position = 'relative';
  preview.innerHTML += `
    <div id="ocrLoading" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
         background: rgba(0,0,0,0.7); display: flex; flex-direction: column; 
         align-items: center; justify-content: center; color: white; border-radius: 8px;">
      <div style="font-size: 32px; margin-bottom: 10px;">🔍</div>
      <div>Analizando documento con IA...</div>
    </div>
  `;
  
  try {
    const response = await fetch('/api/ocr/document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: JSON.stringify({ image: imageData })
    });
    
    const result = await response.json();
    
    const loadingEl = document.getElementById('ocrLoading');
    if (loadingEl) loadingEl.remove();
    
    if (result.success) {
      if (result.first_name) document.getElementById('clientFirstName').value = result.first_name;
      if (result.last_name) document.getElementById('clientLastName').value = result.last_name;
      if (result.document_number) document.getElementById('clientIdNumber').value = result.document_number;
      if (result.document_type) {
        const idTypeSelect = document.getElementById('clientIdType');
        if (['passport', 'dni', 'nie', 'driving_license'].includes(result.document_type)) {
          idTypeSelect.value = result.document_type;
        }
      }
      if (result.nationality) {
        const countryMap = {
          'ESPAÑA': 'ES', 'SPAIN': 'ES', 'FRANCE': 'FR', 'FRANCIA': 'FR',
          'UNITED KINGDOM': 'GB', 'UK': 'GB', 'GERMANY': 'DE', 'ALEMANIA': 'DE',
          'ITALY': 'IT', 'ITALIA': 'IT', 'PORTUGAL': 'PT', 'NETHERLANDS': 'NL', 'BELGIUM': 'BE'
        };
        const countryCode = countryMap[result.nationality.toUpperCase()];
        if (countryCode) document.getElementById('clientCountry').value = countryCode;
      }
      if (result.birth_date) {
        const birthDate = convertDateToISO(result.birth_date);
        if (birthDate) document.getElementById('clientBirthDate').value = birthDate;
      }
      if (result.expiry_date) {
        const expiryDate = convertDateToISO(result.expiry_date);
        if (expiryDate) document.getElementById('clientDocExpiry').value = expiryDate;
      }
      
      showOCRSuccess();
    } else {
      showOCRError(result.error || 'No se pudo leer el documento');
    }
    
  } catch (error) {
    console.error('Erreur OCR:', error);
    const loadingEl = document.getElementById('ocrLoading');
    if (loadingEl) loadingEl.remove();
    showOCRError('Error al analizar el documento');
  }
}

function convertDateToISO(dateStr) {
  if (!dateStr) return null;
  const match1 = dateStr.match(/(\d{2})[\/\-\s](\d{2})[\/\-\s](\d{4})/);
  if (match1) return `${match1[3]}-${match1[2]}-${match1[1]}`;
  const match2 = dateStr.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (match2) return `${match2[1]}-${match2[2]}-${match2[3]}`;
  return null;
}

function showOCRSuccess() {
  const preview = document.getElementById('idPhotoPreview');
  const badge = document.createElement('div');
  badge.style.cssText = `position: absolute; bottom: 10px; left: 10px; right: 10px;
    background: rgba(34, 197, 94, 0.95); color: white;
    padding: 12px; border-radius: 8px; text-align: center; font-weight: bold;`;
  badge.innerHTML = '✅ Datos extraídos - Verifique en el siguiente paso';
  preview.appendChild(badge);
  setTimeout(() => badge.remove(), 5000);
}

function showOCRError(message) {
  const preview = document.getElementById('idPhotoPreview');
  const badge = document.createElement('div');
  badge.style.cssText = `position: absolute; bottom: 10px; left: 10px; right: 10px;
    background: rgba(239, 68, 68, 0.95); color: white;
    padding: 12px; border-radius: 8px; text-align: center;`;
  badge.innerHTML = `⚠️ ${message}<br><small>Complete los datos manualmente</small>`;
  preview.appendChild(badge);
  setTimeout(() => badge.remove(), 6000);
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

function startDrawing(e) { isDrawing = true; draw(e); }

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

function stopDrawing() { isDrawing = false; signatureCtx.beginPath(); }

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  signatureCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY }));
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  signatureCanvas.dispatchEvent(new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY }));
}

function clearSignature() {
  signatureCtx.fillStyle = 'white';
  signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  hasSignature = false;
  document.getElementById('btnToPayment').disabled = true;
}

// =====================================================
// Payment
// =====================================================

function goToPayment() {
  if (!hasSignature) {
    alert('Por favor, firme el contrato');
    return;
  }
  
  clientMode = false;
  document.getElementById('clientModeBanner').classList.remove('active');
  document.getElementById('operatorModeBanner').classList.add('active');
  
  const totalToPay = paymentData.rental.amount + paymentData.deposit.amount;
  document.getElementById('paymentTotalAmount').textContent = totalToPay.toFixed(2) + ' €';
  document.getElementById('rentalAmountDisplay').textContent = paymentData.rental.amount.toFixed(2) + ' €';
  document.getElementById('depositAmountDisplay').textContent = paymentData.deposit.amount.toFixed(2) + ' €';
  
  nextStep();
}

function selectPaymentMethod(type, method) {
  paymentData[type].method = method;
  
  const containerId = type === 'rental' ? 'rentalPaymentMethods' : 'depositPaymentMethods';
  document.querySelectorAll(`#${containerId} .payment-method`).forEach(el => {
    el.classList.remove('selected');
  });
  event.currentTarget.classList.add('selected');
  
  checkPaymentComplete();
}

function checkPaymentComplete() {
  const isComplete = paymentData.rental.method && paymentData.deposit.method;
  document.getElementById('btnFinish').disabled = !isComplete;
}

// =====================================================
// Navigation
// =====================================================

function nextStep() {
  // Actions spécifiques par étape
  if (currentStep === 1) {
    // Passer des dates aux véhicules
    updateDaysDisplay();
    loadAvailableVehicles();
  }
  if (currentStep === 2) {
    // Vérifier qu'un véhicule est sélectionné
    if (!selectedVehicle) {
      alert('Por favor, seleccione un vehículo');
      return;
    }
    renderAccessories();
  }
  if (currentStep === 3) {
    renderSummary();
  }
  if (currentStep === 6) {
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
  
  if (!selectedVehicle) {
    alert('Error: No hay vehículo seleccionado');
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
  
  const days = rentalDays;
  const vehiclePricing = getVehicleTypePrice(selectedVehicle.type, days);
  
  // Calculer totaux
  let accessoriesTotal = 0;
  let accessoriesDeposit = 0;
  selectedAccessories.forEach(acc => {
    const accPricing = getAccessoryPrice(acc.id, days);
    accessoriesTotal += accPricing.total;
    accessoriesDeposit += accPricing.deposit || 0;
  });
  
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
      address: document.getElementById('clientAddress').value,
      birth_date: document.getElementById('clientBirthDate')?.value || null,
      doc_expiry: document.getElementById('clientDocExpiry')?.value || null
    },
    vehicles: [{
      id: selectedVehicle.id,
      code: selectedVehicle.code,
      type: selectedVehicle.type,
      daily_rate: vehiclePricing.dailyRate,
      deposit: vehiclePricing.deposit + accessoriesDeposit,
      accessories: selectedAccessories.map(a => ({ id: a.id, name: a.name, icon: a.icon })),
      start_km: selectedVehicle.current_km || null
    }],
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
        'Authorization': 'Bearer ' + getToken()
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
