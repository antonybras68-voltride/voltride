// =====================================================
// VOLTRIDE - Check-in Walk-in (Version 3.0)
// Dates d'abord, tarifs depuis config, photos, KM motos
// =====================================================

let currentStep = 1;
let selectedVehicles = []; // Multi-sélection (sauf motos: 1 seule)
let vehiclesData = [];
let selectedAccessories = [];
let clientMode = false;
let signatureCanvas, signatureCtx;
let isDrawing = false;
let hasSignature = false;
let idPhotoData = null;
let foundClient = null;
let rentalDays = 1;
let vehicleStartKm = {}; // KM de départ pour les motos {vehicleId: km}

// Données de configuration (chargées depuis Tarifas)
let pricingConfig = {
  vehicleTypes: [],
  accessories: []
};

// Payment data
let paymentData = {
  rental: { method: null, amount: 0, originalAmount: 0 },
  deposit: { method: null, amount: 0 },
  discount: { amount: 0, reason: '' }
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
// IMPORTANT: Les prix dans la grille sont des TOTAUX (pas prix/jour)
// Ex: prices[2] = 220 signifie 220€ TOTAL pour 2 jours
function getVehicleTypePrice(type, days, isHalfDay = false) {
  const vehicleType = pricingConfig.vehicleTypes.find(vt => 
    vt.id.toLowerCase() === type.toLowerCase() || 
    vt.name.toLowerCase() === type.toLowerCase()
  );
  
  if (!vehicleType || !vehicleType.prices) {
    return { dailyRate: 0, total: 0, deposit: 0 };
  }
  
  let total = 0;
  let dailyRate = 0;
  
  // Demi-journée (4h) - prix fixe depuis config
  if (isHalfDay || days === 0.5) {
    total = vehicleType.halfDay || Math.round((vehicleType.prices['1'] || 0) * 0.6);
    dailyRate = total;
    return {
      dailyRate: total,
      total: total,
      deposit: vehicleType.deposit || 0,
      image: vehicleType.image || null,
      name: vehicleType.name,
      halfDay: vehicleType.halfDay || 0,
      isHalfDay: true
    };
  }
  
  const daysInt = Math.ceil(days);
  
  // Si le nombre exact de jours existe dans la grille, utiliser ce prix
  if (vehicleType.prices[String(daysInt)]) {
    total = vehicleType.prices[String(daysInt)];
    dailyRate = total / daysInt;
  } 
  // Si > 14 jours, utiliser prix 14j + jours supplémentaires
  else if (daysInt > 14) {
    const base14 = vehicleType.prices['14'] || 0;
    const extraDay = vehicleType.extraDay || (vehicleType.prices['1'] || 0);
    const extraDays = daysInt - 14;
    total = base14 + (extraDay * extraDays);
    dailyRate = total / daysInt;
  }
  // Sinon trouver le prix le plus proche inférieur
  else {
    const sortedDays = Object.keys(vehicleType.prices)
      .map(Number)
      .filter(d => !isNaN(d) && d <= daysInt)
      .sort((a, b) => b - a);
    
    if (sortedDays.length > 0) {
      const closestDay = sortedDays[0];
      const basePrice = vehicleType.prices[String(closestDay)];
      const extraDay = vehicleType.extraDay || (vehicleType.prices['1'] || 0);
      const extraDays = daysInt - closestDay;
      total = basePrice + (extraDay * extraDays);
      dailyRate = total / daysInt;
    } else {
      dailyRate = vehicleType.prices['1'] || 0;
      total = dailyRate * daysInt;
    }
  }
  
  return {
    dailyRate: Math.round(dailyRate * 100) / 100,
    total: Math.round(total * 100) / 100,
    deposit: vehicleType.deposit || 0,
    image: vehicleType.image || null,
    name: vehicleType.name,
    halfDay: vehicleType.halfDay || 0,
    isHalfDay: false
  };
}

// Récupérer le tarif d'un accessoire pour X jours
// IMPORTANT: Les prix dans la grille sont des TOTAUX (pas prix/jour)
function getAccessoryPrice(accessoryId, days, isHalfDay = false) {
  const accessory = pricingConfig.accessories.find(a => 
    a.id === accessoryId || a.name.toLowerCase() === accessoryId.toLowerCase()
  );
  
  if (!accessory) {
    return { dailyRate: 0, total: 0, deposit: 0 };
  }
  
  let total = 0;
  let dailyRate = 0;
  
  // Demi-journée (4h) - prix fixe depuis config
  if (isHalfDay || days === 0.5) {
    total = accessory.halfDay || 0;
    return {
      dailyRate: total,
      total: total,
      image: accessory.image || null,
      name: accessory.name,
      icon: accessory.icon || '🎒',
      deposit: accessory.deposit || 0,
      halfDay: accessory.halfDay || 0,
      isHalfDay: true
    };
  }
  
  const daysInt = Math.ceil(days);
  
  if (accessory.prices) {
    // Si le nombre exact de jours existe dans la grille
    if (accessory.prices[String(daysInt)]) {
      total = accessory.prices[String(daysInt)];
      dailyRate = daysInt > 0 ? total / daysInt : 0;
    }
    // Si > 14 jours
    else if (daysInt > 14) {
      const base14 = accessory.prices['14'] || 0;
      const extraDay = accessory.extraDay || 0;
      const extraDays = daysInt - 14;
      total = base14 + (extraDay * extraDays);
      dailyRate = total / daysInt;
    }
    // Sinon trouver le prix le plus proche
    else {
      const sortedDays = Object.keys(accessory.prices)
        .map(Number)
        .filter(d => !isNaN(d) && d <= daysInt)
        .sort((a, b) => b - a);
      
      if (sortedDays.length > 0) {
        const closestDay = sortedDays[0];
        const basePrice = accessory.prices[String(closestDay)];
        const extraDay = accessory.extraDay || 0;
        const extraDays = daysInt - closestDay;
        total = basePrice + (extraDay * extraDays);
        dailyRate = daysInt > 0 ? total / daysInt : 0;
      }
    }
  }
  
  return {
    dailyRate: Math.round(dailyRate * 100) / 100,
    total: Math.round(total * 100) / 100,
    image: accessory.image || null,
    name: accessory.name,
    icon: accessory.icon || '🎒',
    deposit: accessory.deposit || 0,
    halfDay: accessory.halfDay || 0,
    isHalfDay: false
  };
}

// =====================================================
// Étape 1: Dates - Calcul 24h = 1 jour
// =====================================================

// Calcul: 24h = 1 jour, +1h gratuit, >1h = jour supplémentaire
// Demi-journée = 4h ou moins
function calculateDays() {
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  if (!startDate || !endDate) return { days: 1, isHalfDay: false, totalHours: 24 };
  
  const start = new Date(`${startDate}T${startHour}:${startMinute}`);
  const end = new Date(`${endDate}T${endHour}:${endMinute}`);
  
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Demi-journée: 4h ou moins
  if (diffHours <= 4) {
    return { days: 0.5, isHalfDay: true, totalHours: diffHours };
  }
  
  // Calcul des jours: 24h = 1 jour
  let fullDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  
  // +1h gratuit, >1h = jour supplémentaire
  if (remainingHours > 1) {
    fullDays++;
  }
  
  return { 
    days: Math.max(1, fullDays), 
    isHalfDay: false, 
    totalHours: diffHours 
  };
}

function updateDaysDisplay() {
  const result = calculateDays();
  rentalDays = result.days;
  window.isHalfDayRental = result.isHalfDay;
  
  const daysDisplay = document.getElementById('daysDisplay');
  if (daysDisplay) {
    if (result.isHalfDay) {
      daysDisplay.innerHTML = `<strong>½ día</strong> (${result.totalHours.toFixed(1)}h)`;
    } else {
      const hoursInfo = result.totalHours > 24 ? ` (${result.totalHours.toFixed(0)}h)` : '';
      daysDisplay.innerHTML = `<strong>${rentalDays}</strong> día(s)${hoursInfo}`;
    }
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
    
    // Si non autorisé, rediriger vers login
    if (response.status === 401) {
      console.error('Session expirée ou token invalide');
      localStorage.removeItem('voltride_token');
      localStorage.removeItem('voltride_user');
      window.location.href = '/';
      return;
    }
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const allVehicles = await response.json();
    
    // Vérifier que c'est bien un tableau
    if (!Array.isArray(allVehicles)) {
      console.error('API did not return an array:', allVehicles);
      throw new Error('Formato de respuesta inválido');
    }
    
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
  const isHalfDay = window.isHalfDayRental;
  
  if (vehiclesData.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary); grid-column: 1 / -1;">
        No hay vehículos disponibles para estas fechas
      </div>
    `;
    return;
  }
  
  // Vérifier si une moto est déjà sélectionnée
  const hasMotorizedSelected = selectedVehicles.some(v => isMotorizedVehicle(v.type));
  
  grid.innerHTML = vehiclesData.map(v => {
    const isSelected = selectedVehicles.some(sv => sv.id === v.id);
    const pricing = getVehicleTypePrice(v.type, days, isHalfDay);
    const isMotorized = isMotorizedVehicle(v.type);
    
    // Désactiver les autres motos si une moto est déjà sélectionnée
    const isDisabled = isMotorized && hasMotorizedSelected && !isSelected;
    
    // Image du type depuis config ou icône par défaut
    let imageHtml;
    if (pricing.image) {
      imageHtml = `<img src="${pricing.image}" alt="${v.type}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;">`;
    } else {
      const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
      imageHtml = `<div style="font-size: 48px;">${icon}</div>`;
    }
    
    // Texte durée
    const durationText = isHalfDay ? '½ día' : `${Math.ceil(days)} día(s)`;
    const priceDetail = isHalfDay ? 'Media jornada (4h)' : `${Math.ceil(days)} día(s) x ${pricing.dailyRate.toFixed(2)} €/día`;
    
    return `
      <div class="vehicle-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
           onclick="${isDisabled ? '' : `toggleVehicle(${v.id})`}"
           data-type="${v.type}"
           style="${isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
        <div class="vehicle-card-image">${imageHtml}</div>
        <div class="vehicle-card-code">${v.code}</div>
        <div class="vehicle-card-type">${v.brand || ''} ${v.model || ''}</div>
        <div class="vehicle-card-type-name">${pricing.name || v.type}</div>
        
        <div class="vehicle-card-pricing">
          <div class="vehicle-price-total">${pricing.total.toFixed(2)} €</div>
          <div class="vehicle-price-detail">${priceDetail}</div>
        </div>
        
        <div class="vehicle-card-deposit">
          Caución: ${pricing.deposit.toFixed(2)} €
        </div>
        
        ${isMotorized ? `
          <div class="vehicle-motorized-badge">
            🏍️ KM actual: ${v.current_km || 0}
          </div>
          ${isDisabled ? '<div style="color: var(--danger); font-size: 11px; margin-top: 5px;">⚠️ Solo 1 moto por contrato</div>' : ''}
        ` : ''}
      </div>
    `;
  }).join('');
}

// Toggle sélection véhicule (multi-sélection sauf motos)
function toggleVehicle(id) {
  const vehicle = vehiclesData.find(v => v.id === id);
  if (!vehicle) return;
  
  const isMotorized = isMotorizedVehicle(vehicle.type);
  const existingIndex = selectedVehicles.findIndex(v => v.id === id);
  
  if (existingIndex > -1) {
    // Désélectionner
    selectedVehicles.splice(existingIndex, 1);
    delete vehicleStartKm[id];
  } else {
    // Sélectionner
    // Si c'est une moto, vérifier qu'il n'y en a pas déjà une
    if (isMotorized) {
      const hasMotorized = selectedVehicles.some(v => isMotorizedVehicle(v.type));
      if (hasMotorized) {
        alert('Solo se puede alquilar 1 moto por contrato');
        return;
      }
    }
    selectedVehicles.push(vehicle);
    // Initialiser KM pour les motos
    if (isMotorized) {
      vehicleStartKm[id] = vehicle.current_km || 0;
    }
  }
  
  selectedAccessories = []; // Reset accessoires quand on change les véhicules
  
  renderVehicles();
  document.getElementById('btnNext2').disabled = selectedVehicles.length === 0;
  
  updateSelectedVehiclesDisplay();
}

function updateSelectedVehiclesDisplay() {
  const container = document.getElementById('selectedVehicleBox');
  if (!container) return;
  
  if (selectedVehicles.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  const isHalfDay = window.isHalfDayRental;
  let totalPrice = 0;
  let totalDeposit = 0;
  
  const vehiclesHtml = selectedVehicles.map(v => {
    const pricing = getVehicleTypePrice(v.type, rentalDays, isHalfDay);
    const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
    const isMotorized = isMotorizedVehicle(v.type);
    totalPrice += pricing.total;
    totalDeposit += pricing.deposit;
    
    return `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 5px;">
        <span style="font-size: 24px;">${icon}</span>
        <div style="flex: 1;">
          <strong>${v.code}</strong> - ${v.brand || ''} ${v.model || ''}
          ${isMotorized ? `<span style="color: var(--info); font-size: 11px;"> (KM: ${vehicleStartKm[v.id] || v.current_km || 0})</span>` : ''}
        </div>
        <div style="color: var(--accent); font-weight: bold;">${pricing.total.toFixed(2)} €</div>
        <button onclick="toggleVehicle(${v.id})" style="background: var(--danger); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;">×</button>
      </div>
    `;
  }).join('');
  
  const durationText = isHalfDay ? '½ día' : `${Math.ceil(rentalDays)} días`;
  
  container.style.display = 'block';
  container.innerHTML = `
    <h4 style="margin-bottom: 10px;">🚲 Vehículos seleccionados (${selectedVehicles.length})</h4>
    ${vehiclesHtml}
    <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
      <span>Total (${durationText}):</span>
      <strong style="color: var(--success);">${totalPrice.toFixed(2)} €</strong>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span>Caución total:</span>
      <strong style="color: var(--warning);">${totalDeposit.toFixed(2)} €</strong>
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
  const isHalfDay = window.isHalfDayRental;
  
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
  
  const hasMotorizedSelected = selectedVehicles.some(v => isMotorizedVehicle(v.type));
  
  grid.innerHTML = filtered.map(v => {
    const isSelected = selectedVehicles.some(sv => sv.id === v.id);
    const pricing = getVehicleTypePrice(v.type, days, isHalfDay);
    const isMotorized = isMotorizedVehicle(v.type);
    const isDisabled = isMotorized && hasMotorizedSelected && !isSelected;
    
    let imageHtml;
    if (pricing.image) {
      imageHtml = `<img src="${pricing.image}" alt="${v.type}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;">`;
    } else {
      const icon = v.type === 'bike' ? '🚲' : v.type === 'ebike' ? '⚡' : '🛵';
      imageHtml = `<div style="font-size: 48px;">${icon}</div>`;
    }
    
    const durationText = isHalfDay ? '½ día' : `${Math.ceil(days)} día(s)`;
    const priceDetail = isHalfDay ? 'Media jornada (4h)' : `${Math.ceil(days)} día(s) x ${pricing.dailyRate.toFixed(2)} €/día`;
    
    return `
      <div class="vehicle-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
           onclick="${isDisabled ? '' : `toggleVehicle(${v.id})`}"
           data-type="${v.type}"
           style="${isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
        <div class="vehicle-card-image">${imageHtml}</div>
        <div class="vehicle-card-code">${v.code}</div>
        <div class="vehicle-card-type">${v.brand || ''} ${v.model || ''}</div>
        <div class="vehicle-card-type-name">${pricing.name || v.type}</div>
        
        <div class="vehicle-card-pricing">
          <div class="vehicle-price-total">${pricing.total.toFixed(2)} €</div>
          <div class="vehicle-price-detail">${priceDetail}</div>
        </div>
        
        <div class="vehicle-card-deposit">
          Caución: ${pricing.deposit.toFixed(2)} €
        </div>
        
        ${isMotorized ? `
          <div class="vehicle-motorized-badge">
            🏍️ KM actual: ${v.current_km || 0}
          </div>
          ${isDisabled ? '<div style="color: var(--danger); font-size: 11px; margin-top: 5px;">⚠️ Solo 1 moto</div>' : ''}
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
  
  if (selectedVehicles.length === 0) {
    section.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Seleccione un vehículo primero</p>';
    return;
  }
  
  const days = rentalDays;
  const isHalfDay = window.isHalfDayRental;
  
  // Récupérer tous les types de véhicules sélectionnés
  const selectedTypes = [...new Set(selectedVehicles.map(v => v.type.toLowerCase()))];
  
  // Filtrer les accessoires compatibles avec AU MOINS UN des types sélectionnés
  let compatibleAccessories = pricingConfig.accessories.filter(acc => {
    if (!acc.compatibleTypes || acc.compatibleTypes.length === 0) return true;
    return acc.compatibleTypes.some(t => 
      selectedTypes.some(st => 
        st.includes(t.toLowerCase()) || t.toLowerCase().includes(st)
      )
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
  
  const durationText = isHalfDay ? '½ día' : `${Math.ceil(days)} día(s)`;
  
  section.innerHTML = `
    <div class="accessory-grid">
      ${compatibleAccessories.map(acc => {
        const pricing = getAccessoryPrice(acc.id, days, isHalfDay);
        const isSelected = selectedAccessories.some(a => a.id === acc.id);
        const isRequired = acc.insuranceRequired === 'required';
        
        let imageHtml;
        if (acc.image) {
          imageHtml = `<img src="${acc.image}" alt="${acc.name}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px;">`;
        } else {
          imageHtml = `<div style="font-size: 36px;">${acc.icon || '🎒'}</div>`;
        }
        
        const priceDetail = isHalfDay ? 'Media jornada' : `${Math.ceil(days)} día(s)`;
        
        return `
          <div class="accessory-card ${isSelected ? 'selected' : ''} ${isRequired ? 'required' : ''}"
               onclick="toggleAccessory('${acc.id}')">
            <div class="accessory-image">${imageHtml}</div>
            <div class="accessory-name">${acc.name}</div>
            <div class="accessory-pricing">
              ${pricing.total > 0 ? `
                <div class="accessory-price">${pricing.total.toFixed(2)} €</div>
                <div class="accessory-detail">${priceDetail}</div>
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
  const isHalfDay = window.isHalfDayRental;
  const pricingDiv = document.getElementById('pricingSummary');
  if (!pricingDiv) return;
  
  if (selectedVehicles.length === 0) {
    pricingDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Seleccione un vehículo</p>';
    return;
  }
  
  const durationText = isHalfDay ? '½ día' : `${Math.ceil(days)} día(s)`;
  
  let html = `
    <div class="price-line">
      <span>Período</span>
      <span><strong>${durationText}</strong></span>
    </div>
  `;
  
  // Véhicules
  let vehiclesTotal = 0;
  let vehiclesDeposit = 0;
  selectedVehicles.forEach(vehicle => {
    const pricing = getVehicleTypePrice(vehicle.type, days, isHalfDay);
    const icon = vehicle.type === 'bike' ? '🚲' : vehicle.type === 'ebike' ? '⚡' : '🛵';
    vehiclesTotal += pricing.total;
    vehiclesDeposit += pricing.deposit;
    html += `
      <div class="price-line">
        <span>${icon} ${vehicle.code}</span>
        <span>${pricing.total.toFixed(2)} €</span>
      </div>
    `;
  });
  
  let accessoriesTotal = 0;
  let accessoriesDeposit = 0;
  selectedAccessories.forEach(acc => {
    const accPricing = getAccessoryPrice(acc.id, days, isHalfDay);
    if (accPricing.total > 0) {
      accessoriesTotal += accPricing.total;
      html += `
        <div class="price-line">
          <span>${acc.icon || '🎒'} ${acc.name}</span>
          <span>${accPricing.total.toFixed(2)} €</span>
        </div>
      `;
    }
    accessoriesDeposit += accPricing.deposit || 0;
  });
  
  const totalRental = vehiclesTotal + accessoriesTotal;
  const totalDeposit = vehiclesDeposit + accessoriesDeposit;
  
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
  const isHalfDay = window.isHalfDayRental;
  const startDate = document.getElementById('startDate').value;
  const startHour = document.getElementById('startHour').value;
  const startMinute = document.getElementById('startMinute').value;
  const endDate = document.getElementById('endDate').value;
  const endHour = document.getElementById('endHour').value;
  const endMinute = document.getElementById('endMinute').value;
  
  const start = new Date(`${startDate}T${startHour}:${startMinute}`);
  const end = new Date(`${endDate}T${endHour}:${endMinute}`);
  
  if (selectedVehicles.length === 0) return;
  
  const durationText = isHalfDay ? '½ día (4h)' : `${Math.ceil(days)} día(s)`;
  
  // Véhicules
  let vehiclesHtml = '';
  let totalVehiclePrice = 0;
  let totalDeposit = 0;
  
  selectedVehicles.forEach(vehicle => {
    const pricing = getVehicleTypePrice(vehicle.type, days, isHalfDay);
    const icon = vehicle.type === 'bike' ? '🚲' : vehicle.type === 'ebike' ? '⚡' : '🛵';
    const isMotorized = isMotorizedVehicle(vehicle.type);
    totalVehiclePrice += pricing.total;
    totalDeposit += pricing.deposit;
    
    vehiclesHtml += `
      <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 15px;">
            ${pricing.image ? 
              `<img src="${pricing.image}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px;">` : 
              `<div style="font-size: 40px;">${icon}</div>`
            }
            <div>
              <strong>${vehicle.code}</strong>
              <div style="color: var(--text-secondary); font-size: 14px;">${vehicle.brand || ''} ${vehicle.model || ''}</div>
              ${isMotorized ? `
                <div style="margin-top: 8px;">
                  <label style="color: var(--info); font-size: 12px;">🏍️ KM de inicio:</label>
                  <input type="number" 
                         id="startKm_${vehicle.id}" 
                         value="${vehicleStartKm[vehicle.id] || vehicle.current_km || 0}" 
                         onchange="updateVehicleKm(${vehicle.id}, this.value)"
                         style="width: 100px; padding: 5px; margin-left: 10px; background: var(--bg-secondary); border: 1px solid var(--info); border-radius: 5px; color: var(--text-primary); text-align: center;">
                </div>
              ` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="color: var(--success); font-weight: bold; font-size: 18px;">${pricing.total.toFixed(2)} €</div>
            <div style="font-size: 12px; color: var(--text-secondary);">Caución: ${pricing.deposit.toFixed(2)} €</div>
          </div>
        </div>
      </div>
    `;
  });
  
  // Accessoires
  let accessoriesHtml = '';
  let accessoriesTotal = 0;
  let accessoriesDeposit = 0;
  if (selectedAccessories.length > 0) {
    selectedAccessories.forEach(a => {
      const accPricing = getAccessoryPrice(a.id, days, isHalfDay);
      accessoriesTotal += accPricing.total;
      accessoriesDeposit += accPricing.deposit || 0;
    });
    
    accessoriesHtml = `
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Accesorios:</div>
        ${selectedAccessories.map(a => {
          const accPricing = getAccessoryPrice(a.id, days, isHalfDay);
          return `<span style="display: inline-block; background: var(--bg-secondary); padding: 3px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">${a.icon || '🎒'} ${a.name} ${accPricing.total > 0 ? `(${accPricing.total.toFixed(2)}€)` : ''}</span>`;
        }).join('')}
      </div>
    `;
  }
  
  totalDeposit += accessoriesDeposit;
  const totalRental = totalVehiclePrice + accessoriesTotal;
  
  document.getElementById('summaryDetails').innerHTML = `
    <div class="summary-section">
      <h3>🚲 Vehículos Seleccionados (${selectedVehicles.length})</h3>
      ${vehiclesHtml}
      ${accessoriesHtml}
    </div>
    
    <div class="summary-section">
      <h3>📅 Período de Alquiler</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px;">
          <div style="color: var(--success); font-weight: bold; margin-bottom: 5px;">🟢 INICIO</div>
          <div>${start.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          <div style="font-size: 24px; font-weight: bold;">${startHour}:${startMinute}</div>
        </div>
        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px;">
          <div style="color: var(--danger); font-weight: bold; margin-bottom: 5px;">🔴 FIN</div>
          <div>${end.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          <div style="font-size: 24px; font-weight: bold;">${endHour}:${endMinute}</div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 15px; padding: 10px; background: var(--accent); color: var(--bg-primary); border-radius: 8px;">
        <strong>Duración: ${durationText}</strong>
      </div>
    </div>
  `;
  
  paymentData.rental.amount = totalRental;
  paymentData.deposit.amount = totalDeposit;
  
  document.getElementById('finalPricing').innerHTML = `
    <h3>💰 Resumen de Precios</h3>
    <div class="price-line"><span>Vehículos (${durationText})</span><span>${totalVehiclePrice.toFixed(2)} €</span></div>
    ${accessoriesTotal > 0 ? `<div class="price-line"><span>Accesorios</span><span>${accessoriesTotal.toFixed(2)} €</span></div>` : ''}
    <div class="price-line"><span><strong>Subtotal (IVA incl.)</strong></span><span><strong>${totalRental.toFixed(2)} €</strong></span></div>
    <div class="price-line"><span>Caución (reembolsable)</span><span>${totalDeposit.toFixed(2)} €</span></div>
    <div class="price-line total"><span>TOTAL A PAGAR</span><span>${(totalRental + totalDeposit).toFixed(2)} €</span></div>
  `;
}

// Mise à jour du KM de départ pour les motos
function updateVehicleKm(vehicleId, km) {
  vehicleStartKm[vehicleId] = parseInt(km) || 0;
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
  
  // Stocker le montant original de la location
  paymentData.rental.originalAmount = paymentData.rental.amount;
  
  // Reset discount
  paymentData.discount.amount = 0;
  paymentData.discount.reason = '';
  document.getElementById('discountAmount').value = '0';
  document.getElementById('discountReason').value = '';
  document.getElementById('discountInfo').style.display = 'none';
  
  updatePaymentDisplay();
  
  nextStep();
}

function applyDiscount() {
  const discountInput = document.getElementById('discountAmount');
  const discountReason = document.getElementById('discountReason');
  const discountInfo = document.getElementById('discountInfo');
  const discountApplied = document.getElementById('discountApplied');
  
  let discountAmount = parseFloat(discountInput.value) || 0;
  
  // Le descuento ne peut pas dépasser le montant de la location
  if (discountAmount > paymentData.rental.originalAmount) {
    discountAmount = paymentData.rental.originalAmount;
    discountInput.value = discountAmount;
  }
  
  if (discountAmount < 0) {
    discountAmount = 0;
    discountInput.value = 0;
  }
  
  paymentData.discount.amount = discountAmount;
  paymentData.discount.reason = discountReason.value;
  
  // Recalculer le montant de la location avec le descuento
  paymentData.rental.amount = paymentData.rental.originalAmount - discountAmount;
  
  // Afficher le descuento appliqué
  if (discountAmount > 0) {
    discountInfo.style.display = 'block';
    discountApplied.textContent = discountAmount.toFixed(2) + ' €';
  } else {
    discountInfo.style.display = 'none';
  }
  
  updatePaymentDisplay();
}

function updatePaymentDisplay() {
  const totalToPay = paymentData.rental.amount + paymentData.deposit.amount;
  document.getElementById('paymentTotalAmount').textContent = totalToPay.toFixed(2) + ' €';
  document.getElementById('rentalAmountDisplay').textContent = paymentData.rental.amount.toFixed(2) + ' €';
  document.getElementById('depositAmountDisplay').textContent = paymentData.deposit.amount.toFixed(2) + ' €';
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
    if (selectedVehicles.length === 0) {
      alert('Por favor, seleccione al menos un vehículo');
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
  
  if (selectedVehicles.length === 0) {
    alert('Error: No hay vehículos seleccionados');
    return;
  }
  
  // Valider que les motos ont un KM de départ
  for (const vehicle of selectedVehicles) {
    if (isMotorizedVehicle(vehicle.type)) {
      const kmInput = document.getElementById(`startKm_${vehicle.id}`);
      if (kmInput) {
        vehicleStartKm[vehicle.id] = parseInt(kmInput.value) || vehicle.current_km || 0;
      }
    }
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
  const isHalfDay = window.isHalfDayRental;
  
  // Préparer les véhicules avec leurs tarifs et KM
  const vehiclesData = selectedVehicles.map(vehicle => {
    const pricing = getVehicleTypePrice(vehicle.type, days, isHalfDay);
    const isMotorized = isMotorizedVehicle(vehicle.type);
    
    // Calculer les accessoires pour ce véhicule
    let accDeposit = 0;
    selectedAccessories.forEach(acc => {
      const accPricing = getAccessoryPrice(acc.id, days, isHalfDay);
      accDeposit += accPricing.deposit || 0;
    });
    
    return {
      id: vehicle.id,
      code: vehicle.code,
      type: vehicle.type,
      daily_rate: pricing.dailyRate,
      total_price: pricing.total,
      deposit: pricing.deposit + (selectedVehicles.length === 1 ? accDeposit : 0),
      accessories: selectedVehicles.length === 1 ? selectedAccessories.map(a => ({ id: a.id, name: a.name, icon: a.icon })) : [],
      start_km: isMotorized ? (vehicleStartKm[vehicle.id] || vehicle.current_km || 0) : null
    };
  });
  
  // Si plusieurs véhicules, les accessoires vont avec le premier non-motorisé ou le premier véhicule
  if (selectedVehicles.length > 1 && selectedAccessories.length > 0) {
    const nonMotorized = vehiclesData.find(v => !isMotorizedVehicle(v.type));
    const targetVehicle = nonMotorized || vehiclesData[0];
    
    let accDeposit = 0;
    selectedAccessories.forEach(acc => {
      const accPricing = getAccessoryPrice(acc.id, days, isHalfDay);
      accDeposit += accPricing.deposit || 0;
    });
    
    targetVehicle.accessories = selectedAccessories.map(a => ({ id: a.id, name: a.name, icon: a.icon }));
    targetVehicle.deposit += accDeposit;
  }
  
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
    vehicles: vehiclesData,
    start_date: `${startDate}T${startHour}:${startMinute}`,
    planned_end_date: `${endDate}T${endHour}:${endMinute}`,
    is_half_day: isHalfDay,
    agency_id: user.agency_id,
    user_id: user.id,
    signature: signatureData,
    id_photo: idPhotoData,
    payment: {
      rental_method: paymentData.rental.method,
      rental_amount: paymentData.rental.amount,
      rental_original_amount: paymentData.rental.originalAmount,
      deposit_method: paymentData.deposit.method,
      deposit_amount: paymentData.deposit.amount,
      discount_amount: paymentData.discount.amount,
      discount_reason: paymentData.discount.reason
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
