// =====================================================
// VOLTRIDE - Application principale (v2.3)
// Responsive + Mobile sidebar + Settings intégrés + ½ día
// =====================================================

let currentPage = 'dashboard';
let currentUser = null;
let agencies = [];

// Variables pour les tarifs
let vehicleTypes = [];
let accessories = [];
let insuranceOptions = [];
let damages = [];
let currentSettingsTab = 'agencies';

// =====================================================
// Initialisation
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) { window.location.href = '/'; return; }
  
  currentUser = getCurrentUser();
  if (!currentUser) { window.location.href = '/'; return; }
  
  initUI();
  
  try { agencies = await agenciesAPI.getAll(); } catch (e) { console.error(e); }
  
  loadPage('dashboard');
});

function initUI() {
  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userRole').textContent = currentUser.role === 'admin' ? t('admin') : t('employee');
  document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();
  document.getElementById('currentAgency').textContent = currentUser.agency_name || 'Voltride';
  
  // Masquer le lien Usuarios dans la sidebar (maintenant dans Parámetros)
  const navUsers = document.getElementById('navUsers');
  if (navUsers) navUsers.style.display = 'none';
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.page) loadPage(item.dataset.page);
    });
  });
  
  const savedLang = localStorage.getItem('voltride_lang') || 'es';
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === savedLang);
    btn.addEventListener('click', () => {
      localStorage.setItem('voltride_lang', btn.dataset.lang);
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadPage(currentPage);
    });
  });
  
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
      }
    });
  });
  
  document.querySelectorAll('.mobile-lang .lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      localStorage.setItem('voltride_lang', lang);
      document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === lang);
      });
      loadPage(currentPage);
    });
  });
}

function loadPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  const container = document.getElementById('pageContainer');
  switch(page) {
    case 'dashboard': renderDashboard(container); break;
    case 'vehicles': renderVehicles(container); break;
    case 'rentals': renderRentals(container); break;
    case 'customers': renderCustomers(container); break;
    case 'cash': renderCash(container); break;
    case 'users': renderSettings(container); break; // Redirige vers settings
    case 'documents': renderDocuments(container); break;
    case 'settings': renderSettings(container); break;
    case 'maintenance': renderMaintenance(container); break;
  }
}

function logout() {
  localStorage.removeItem('voltride_token');
  localStorage.removeItem('voltride_user');
  window.location.href = '/';
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}

// =====================================================
// Utilitaires
// =====================================================

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-ES');
}

function getVehicleTypeIcon(type) {
  const icons = { bike: '🚲', ebike: '⚡', scooter: '🛵' };
  return icons[type] || '🚲';
}

function getStatusBadge(status) {
  const badges = {
    available: `<span class="badge badge-success">${t('available')}</span>`,
    rented: `<span class="badge badge-warning">${t('rented')}</span>`,
    maintenance: `<span class="badge badge-danger">${t('maintenance')}</span>`,
    active: `<span class="badge badge-warning">${t('active')}</span>`,
    completed: `<span class="badge badge-success">${t('completed')}</span>`,
    cancelled: `<span class="badge badge-secondary">${t('cancelled')}</span>`
  };
  return badges[status] || status;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast alert-${type === 'error' ? 'danger' : type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function openModal(title, body, footer = '') {
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header">
      <h2>${title}</h2>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  `;
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// =====================================================
// Dashboard
// =====================================================

async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>${t('welcomeBack')}, ${currentUser.full_name}!</h1>
      <p>${t('todayOverview')}</p>
    </div>
    <div class="stats-grid" id="dashboardStats"><div class="loading"><div class="spinner"></div></div></div>
    <div class="card">
      <div class="card-header"><h2>${t('activeRentals')}</h2></div>
      <div id="activeRentalsList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  
  try {
    const stats = await reportsAPI.getDashboard(currentUser.agency_id);
    document.getElementById('dashboardStats').innerHTML = `
      <div class="stat-card"><div class="stat-icon primary">🚲</div><div class="stat-info"><h3>${stats.vehicles.total}</h3><p>${t('totalVehicles')}</p></div></div>
      <div class="stat-card"><div class="stat-icon success">✓</div><div class="stat-info"><h3>${stats.vehicles.available}</h3><p>${t('available')}</p></div></div>
      <div class="stat-card"><div class="stat-icon warning">📋</div><div class="stat-info"><h3>${stats.rentals.active}</h3><p>${t('activeRentals')}</p></div></div>
      <div class="stat-card"><div class="stat-icon info">💰</div><div class="stat-info"><h3>${formatCurrency(stats.revenue.today_revenue)}</h3><p>${t('todayRevenue')}</p></div></div>
    `;
    
    const activeRentals = await rentalsAPI.getActive(currentUser.agency_id);
    if (activeRentals.length === 0) {
      document.getElementById('activeRentalsList').innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>${t('noResults')}</h3></div>`;
    } else {
      document.getElementById('activeRentalsList').innerHTML = `
        <div class="table-container"><table><thead><tr>
          <th>${t('contract')}</th><th>${t('customer')}</th><th>${t('vehicle')}</th><th>${t('startDate')}</th><th>${t('plannedEndDate')}</th><th></th>
        </tr></thead><tbody>
          ${activeRentals.map(r => `<tr>
            <td><strong>${r.contract_number}</strong></td>
            <td>${r.first_name} ${r.last_name}</td>
            <td>${r.vehicle_code}</td>
            <td>${formatDateShort(r.start_date)}</td>
            <td>${formatDateShort(r.planned_end_date)}</td>
            <td><div class="btn-group">
              <button class="btn btn-sm btn-info" onclick="downloadContract(${r.id})">📄</button>
              <button class="btn btn-sm btn-success" onclick="showReturnModal(${r.id})">🏁</button>
            </div></td>
          </tr>`).join('')}
        </tbody></table></div>
      `;
    }
  } catch (error) {
    console.error(error);
    showToast(t('errorOccurred'), 'error');
  }
}

// =====================================================
// Véhicules
// =====================================================

async function renderVehicles(container) {
  // Charger les tarifs pour avoir les images des types de véhicules
  await loadPricingData();
  
  container.innerHTML = `
    <div class="page-header"><h1>${t('vehicles')}</h1></div>
    <div class="card">
      <div class="card-header">
        <div class="filters-bar" style="margin:0;flex:1;">
          <div class="search-box"><input type="text" id="vehicleSearch" placeholder="${t('search')}..." onkeyup="filterVehicles()"></div>
          <select class="filter-select" id="vehicleAgencyFilter" onchange="filterVehicles()">
            <option value="">Toutes agences</option>
            ${agencies.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
          </select>
          <select class="filter-select" id="vehicleStatusFilter" onchange="filterVehicles()">
            <option value="">${t('all')}</option><option value="available">${t('available')}</option><option value="rented">${t('rented')}</option><option value="maintenance">${t('maintenance')}</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="showVehicleModal()">+ ${t('addVehicle')}</button>
      </div>
      <div id="vehiclesList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  await loadVehicles();
}

async function loadVehicles() {
  try {
    // Admin voit tous les véhicules, employé seulement ceux de son agence
    const params = currentUser.role === 'admin' ? {} : { agency_id: currentUser.agency_id };
    const vehicles = await vehiclesAPI.getAll(params);
    window.vehiclesData = vehicles;
    renderVehiclesTable(vehicles);
  } catch (e) { console.error(e); showToast(t('errorOccurred'), 'error'); }
}

// Fonction pour récupérer l'image du type de véhicule depuis les tarifs
function getVehicleTypeImage(type) {
  const vType = vehicleTypes.find(v => v.id === type);
  if (vType && vType.image) {
    return `<img src="${vType.image}" alt="${vType.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">`;
  }
  // Placeholder si pas d'image
  return `<div style="width:40px;height:40px;background:var(--bg-input);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text-secondary);">${type.substring(0,2).toUpperCase()}</div>`;
}

// Fonction pour récupérer le nom de l'agence
function getAgencyName(agencyId) {
  const agency = agencies.find(a => a.id === agencyId);
  return agency ? agency.name : '-';
}

function renderVehiclesTable(vehicles) {
  if (!vehicles.length) {
    document.getElementById('vehiclesList').innerHTML = `<div class="empty-state"><h3>${t('noResults')}</h3></div>`;
    return;
  }
  document.getElementById('vehiclesList').innerHTML = `
    <div class="table-container"><table><thead><tr>
      <th></th>
      <th>${t('vehicleCode')}</th>
      <th>${t('vehicleType')}</th>
      <th>${t('brand')}</th>
      <th>Agencia</th>
      <th>${t('status')}</th>
      <th></th>
    </tr></thead><tbody>
      ${vehicles.map(v => `<tr>
        <td>${getVehicleTypeImage(v.type)}</td>
        <td><strong>${v.code}</strong></td>
        <td>${t(v.type)}</td>
        <td>${v.brand || '-'} ${v.model || ''}</td>
        <td><span style="font-size:0.85rem;color:var(--text-secondary);">${getAgencyName(v.agency_id)}</span></td>
        <td>${getStatusBadge(v.status)}</td>
        <td><div class="btn-group">
          <button class="btn btn-sm btn-secondary" onclick="showVehicleModal(${v.id})" title="Editar">Editar</button>
          <button class="btn btn-sm btn-info" onclick="duplicateVehicle(${v.id})" title="Duplicar">Copiar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteVehicle(${v.id})" title="Eliminar">Suppr.</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>
  `;
}

async function duplicateVehicle(id) {
  try {
    const v = await vehiclesAPI.getById(id);
    
    // Afficher une modal pour demander le nouveau code
    openModal('Duplicar vehículo', `
      <form id="duplicateForm">
        <p style="color:var(--text-secondary);margin-bottom:15px;">Duplicando: <strong>${v.code}</strong> (${v.brand || ''} ${v.model || ''})</p>
        <div class="form-group">
          <label>Nuevo código *</label>
          <input type="text" id="newVehicleCode" class="form-control" value="${v.code}-2" required>
        </div>
        <div class="form-group">
          <label>Agencia</label>
          <select id="newVehicleAgency" class="form-control">
            ${agencies.map(a => `<option value="${a.id}" ${a.id === v.agency_id ? 'selected' : ''}>${a.code} - ${a.name}</option>`).join('')}
          </select>
        </div>
      </form>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="confirmDuplicateVehicle(${id})">Duplicar</button>`);
  } catch (e) { 
    showToast(e.message || 'Error al cargar el vehículo', 'error'); 
  }
}

async function confirmDuplicateVehicle(originalId) {
  const newCode = document.getElementById('newVehicleCode').value;
  const newAgencyId = document.getElementById('newVehicleAgency').value;
  
  if (!newCode) {
    alert('El código es obligatorio');
    return;
  }
  
  try {
    const v = await vehiclesAPI.getById(originalId);
    const data = {
      code: newCode,
      type: v.type,
      brand: v.brand,
      model: v.model,
      color: v.color,
      daily_rate: v.daily_rate || 0,
      deposit: v.deposit || 0,
      status: 'available',
      agency_id: newAgencyId,
      notes: v.notes
    };
    await vehiclesAPI.create(data);
    closeModal();
    showToast('Vehículo duplicado correctamente', 'success');
    loadVehicles();
  } catch (e) { 
    showToast(e.message || 'Error al duplicar', 'error'); 
  }
}

function filterVehicles() {
  const search = document.getElementById('vehicleSearch').value.toLowerCase();
  const status = document.getElementById('vehicleStatusFilter').value;
  const agencyId = document.getElementById('vehicleAgencyFilter').value;
  let filtered = window.vehiclesData || [];
  if (search) filtered = filtered.filter(v => v.code.toLowerCase().includes(search) || (v.brand||'').toLowerCase().includes(search) || (v.model||'').toLowerCase().includes(search));
  if (status) filtered = filtered.filter(v => v.status === status);
  if (agencyId) filtered = filtered.filter(v => v.agency_id == agencyId);
  renderVehiclesTable(filtered);
}

function showVehicleModal(id = null) {
  // Créer les options de type depuis les tarifs configurés
  const typeOptions = vehicleTypes.length > 0 
    ? vehicleTypes.map(vt => `<option value="${vt.id}">${vt.name}</option>`).join('')
    : `<option value="bike">${t('bike')}</option><option value="ebike">${t('ebike')}</option><option value="scooter">${t('scooter')}</option>`;
  
  // Options d'agences
  const agencyOptions = agencies.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('');
  
  openModal(id ? t('editVehicle') : t('addVehicle'), `
    <form id="vehicleForm">
      <input type="hidden" id="vehicleId" value="${id||''}">
      <div class="form-row">
        <div class="form-group"><label>${t('vehicleCode')} *</label><input type="text" id="vehicleCode" class="form-control" required placeholder="EB1, CB2, SC3..."></div>
        <div class="form-group"><label>${t('vehicleType')} *</label><select id="vehicleType" class="form-control" onchange="toggleMotorizedFields()">${typeOptions}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('brand')}</label><input type="text" id="vehicleBrand" class="form-control" placeholder="FIIDO, MBM..."></div>
        <div class="form-group"><label>${t('model')}</label><input type="text" id="vehicleModel" class="form-control" placeholder="C11 PRO, Touring 28..."></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Agencia *</label><select id="vehicleAgency" class="form-control" required>${agencyOptions}</select></div>
        <div class="form-group"><label>${t('status')}</label><select id="vehicleStatus" class="form-control"><option value="available">${t('available')}</option><option value="maintenance">${t('maintenance')}</option></select></div>
      </div>
      <div class="form-group"><label>Color</label><input type="text" id="vehicleColor" class="form-control" placeholder="Negro, Blanco, Rojo..."></div>
      
      <!-- Champs pour véhicules motorisés (E-motocross, Scooter) -->
      <div id="motorizedFields" style="display:none;border:1px solid var(--border);border-radius:8px;padding:15px;margin:15px 0;background:var(--bg-input);">
        <p style="margin:0 0 15px 0;color:var(--primary);font-weight:500;">Información legal (vehículo motorizado)</p>
        <div class="form-row">
          <div class="form-group"><label>Matrícula</label><input type="text" id="vehiclePlate" class="form-control" placeholder="1234 ABC"></div>
          <div class="form-group"><label>Nº Bastidor/Chasis</label><input type="text" id="vehicleChassis" class="form-control" placeholder="VIN/Número de chasis"></div>
        </div>
      </div>
      
      <div class="form-group"><label>Notas</label><textarea id="vehicleNotes" class="form-control" rows="2" placeholder="Observaciones adicionales..."></textarea></div>
    </form>
  `, `<button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary" onclick="saveVehicle()">${t('save')}</button>`);
  
  // Sélectionner l'agence de l'utilisateur par défaut
  if (!id) {
    document.getElementById('vehicleAgency').value = currentUser.agency_id;
    toggleMotorizedFields();
  } else {
    loadVehicleData(id);
  }
}

// Afficher/masquer les champs pour véhicules motorisés
function toggleMotorizedFields() {
  const type = document.getElementById('vehicleType').value.toLowerCase();
  const motorizedFields = document.getElementById('motorizedFields');
  
  // Types qui nécessitent plaque et châssis
  const motorizedTypes = ['e-motocross', 'emotocross', 'e_motocross', 'scooter', 'moto', 'motocross'];
  
  if (motorizedTypes.some(t => type.includes(t.replace(/[-_]/g, '')) || type.replace(/[-_]/g, '').includes(t.replace(/[-_]/g, '')))) {
    motorizedFields.style.display = 'block';
  } else {
    motorizedFields.style.display = 'none';
  }
}

async function loadVehicleData(id) {
  try {
    const v = await vehiclesAPI.getById(id);
    document.getElementById('vehicleCode').value = v.code;
    document.getElementById('vehicleType').value = v.type;
    document.getElementById('vehicleBrand').value = v.brand || '';
    document.getElementById('vehicleModel').value = v.model || '';
    document.getElementById('vehicleAgency').value = v.agency_id || currentUser.agency_id;
    document.getElementById('vehicleStatus').value = v.status;
    document.getElementById('vehicleColor').value = v.color || '';
    document.getElementById('vehiclePlate').value = v.license_plate || '';
    document.getElementById('vehicleChassis').value = v.chassis_number || '';
    document.getElementById('vehicleNotes').value = v.notes || '';
    
    // Afficher les champs motorisés si nécessaire
    toggleMotorizedFields();
  } catch (e) { console.error(e); }
}

async function saveVehicle() {
  const id = document.getElementById('vehicleId').value;
  const data = {
    code: document.getElementById('vehicleCode').value,
    type: document.getElementById('vehicleType').value,
    brand: document.getElementById('vehicleBrand').value,
    model: document.getElementById('vehicleModel').value,
    color: document.getElementById('vehicleColor').value,
    status: document.getElementById('vehicleStatus').value,
    agency_id: document.getElementById('vehicleAgency').value,
    license_plate: document.getElementById('vehiclePlate').value || null,
    chassis_number: document.getElementById('vehicleChassis').value || null,
    notes: document.getElementById('vehicleNotes').value,
    daily_rate: 0,
    deposit: 0
  };
  try {
    if (id) await vehiclesAPI.update(id, data); else await vehiclesAPI.create(data);
    closeModal(); showToast(t('savedSuccess'), 'success'); loadVehicles();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteVehicle(id) {
  if (!confirm(t('confirmDelete'))) return;
  try { await vehiclesAPI.delete(id); showToast(t('deleteSuccess'), 'success'); loadVehicles(); }
  catch (e) { showToast(e.message, 'error'); }
}

// =====================================================
// Clients
// =====================================================

async function renderCustomers(container) {
  container.innerHTML = `
    <div class="page-header"><h1>${t('customers')}</h1></div>
    <div class="card">
      <div class="card-header">
        <div class="search-box" style="max-width:300px;"><span class="search-icon">🔍</span><input type="text" id="customerSearch" placeholder="${t('search')}..." onkeyup="searchCustomers()"></div>
        <button class="btn btn-primary" onclick="showCustomerModal()">+ ${t('addCustomer')}</button>
      </div>
      <div id="customersList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  await loadCustomers();
}

async function loadCustomers(search = '') {
  try {
    const customers = await customersAPI.getAll(search);
    window.customersData = customers;
    renderCustomersTable(customers);
  } catch (e) { showToast(t('errorOccurred'), 'error'); }
}

function renderCustomersTable(customers) {
  if (!customers.length) {
    document.getElementById('customersList').innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><h3>${t('noResults')}</h3></div>`;
    return;
  }
  document.getElementById('customersList').innerHTML = `
    <div class="table-container"><table><thead><tr>
      <th>${t('firstName')} ${t('lastName')}</th><th>${t('phone')}</th><th>${t('email')}</th><th>${t('idNumber')}</th><th>🌐</th><th></th>
    </tr></thead><tbody>
      ${customers.map(c => `<tr>
        <td><strong>${c.first_name} ${c.last_name}</strong></td>
        <td>${c.phone || '-'}</td>
        <td>${c.email || '-'}</td>
        <td>${c.id_number || '-'}</td>
        <td>${(c.preferred_language || 'es').toUpperCase()}</td>
        <td><div class="btn-group">
          <button class="btn btn-sm btn-secondary" onclick="showCustomerModal(${c.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">🗑️</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>
  `;
}

function searchCustomers() {
  const search = document.getElementById('customerSearch').value;
  loadCustomers(search);
}

function showCustomerModal(id = null) {
  openModal(id ? t('editCustomer') : t('addCustomer'), `
    <form id="customerForm">
      <input type="hidden" id="customerId" value="${id||''}">
      <div class="form-row">
        <div class="form-group"><label>${t('firstName')} *</label><input type="text" id="customerFirstName" class="form-control" required></div>
        <div class="form-group"><label>${t('lastName')} *</label><input type="text" id="customerLastName" class="form-control" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('phone')}</label><input type="tel" id="customerPhone" class="form-control"></div>
        <div class="form-group"><label>${t('email')}</label><input type="email" id="customerEmail" class="form-control"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('idType')}</label><select id="customerIdType" class="form-control"><option value="passport">${t('passport')}</option><option value="dni">${t('dni')}</option><option value="nie">NIE</option><option value="driving_license">${t('drivingLicense')}</option></select></div>
        <div class="form-group"><label>${t('idNumber')}</label><input type="text" id="customerIdNumber" class="form-control"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('country')}</label><input type="text" id="customerCountry" class="form-control"></div>
        <div class="form-group"><label>${t('city')}</label><input type="text" id="customerCity" class="form-control"></div>
      </div>
      <div class="form-group">
        <label>🌐 Idioma preferido</label>
        <select id="customerLanguage" class="form-control">
          <option value="es">🇪🇸 Español</option>
          <option value="fr">🇫🇷 Français</option>
          <option value="en">🇬🇧 English</option>
        </select>
      </div>
    </form>
  `, `<button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary" onclick="saveCustomer()">${t('save')}</button>`);
  if (id) loadCustomerData(id);
}

async function loadCustomerData(id) {
  try {
    const c = await customersAPI.getById(id);
    document.getElementById('customerFirstName').value = c.first_name;
    document.getElementById('customerLastName').value = c.last_name;
    document.getElementById('customerPhone').value = c.phone || '';
    document.getElementById('customerEmail').value = c.email || '';
    document.getElementById('customerIdType').value = c.id_type || 'passport';
    document.getElementById('customerIdNumber').value = c.id_number || '';
    document.getElementById('customerCountry').value = c.country || '';
    document.getElementById('customerCity').value = c.city || '';
    document.getElementById('customerLanguage').value = c.preferred_language || 'es';
  } catch (e) { console.error(e); }
}

async function saveCustomer() {
  const id = document.getElementById('customerId').value;
  const data = {
    first_name: document.getElementById('customerFirstName').value,
    last_name: document.getElementById('customerLastName').value,
    phone: document.getElementById('customerPhone').value,
    email: document.getElementById('customerEmail').value,
    id_type: document.getElementById('customerIdType').value,
    id_number: document.getElementById('customerIdNumber').value,
    country: document.getElementById('customerCountry').value,
    city: document.getElementById('customerCity').value,
    preferred_language: document.getElementById('customerLanguage').value
  };
  try {
    if (id) await customersAPI.update(id, data); else await customersAPI.create(data);
    closeModal(); showToast(t('savedSuccess'), 'success'); loadCustomers();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteCustomer(id) {
  if (!confirm(t('confirmDelete'))) return;
  try { await customersAPI.delete(id); showToast(t('deleteSuccess'), 'success'); loadCustomers(); }
  catch (e) { showToast(e.message, 'error'); }
}

// =====================================================
// Locations
// =====================================================

async function renderRentals(container) {
  container.innerHTML = `
    <div class="page-header"><h1>${t('rentals')}</h1></div>
    <div class="card">
      <div class="card-header">
        <select class="filter-select" id="rentalStatusFilter" onchange="loadRentals()">
          <option value="">${t('all')}</option><option value="active">${t('active')}</option><option value="completed">${t('completed')}</option>
        </select>
        <button class="btn btn-primary" onclick="showNewRentalModal()">+ ${t('newRental')}</button>
      </div>
      <div id="rentalsList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  await loadRentals();
}

async function loadRentals() {
  try {
    const status = document.getElementById('rentalStatusFilter')?.value || '';
    const params = { agency_id: currentUser.agency_id };
    if (status) params.status = status;
    const rentals = await rentalsAPI.getAll(params);
    renderRentalsTable(rentals);
  } catch (e) { showToast(t('errorOccurred'), 'error'); }
}

function renderRentalsTable(rentals) {
  if (!rentals.length) {
    document.getElementById('rentalsList').innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>${t('noResults')}</h3></div>`;
    return;
  }
  document.getElementById('rentalsList').innerHTML = `
    <div class="table-container"><table><thead><tr>
      <th>${t('contract')}</th><th>${t('customer')}</th><th>${t('vehicle')}</th><th>${t('startDate')}</th><th>${t('totalAmount')}</th><th>${t('status')}</th><th></th>
    </tr></thead><tbody>
      ${rentals.map(r => `<tr>
        <td><strong>${r.contract_number}</strong></td>
        <td>${r.first_name} ${r.last_name}</td>
        <td>${r.vehicle_code}</td>
        <td>${formatDateShort(r.start_date)}</td>
        <td>${formatCurrency(r.total_amount)}</td>
        <td>${getStatusBadge(r.status)}</td>
        <td><div class="btn-group">
          <button class="btn btn-sm btn-info" onclick="downloadContract(${r.id})">📄</button>
          ${r.status === 'active' ? `<button class="btn btn-sm btn-success" onclick="showReturnModal(${r.id})">🏁</button>` : ''}
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>
  `;
}

async function showNewRentalModal() {
  const [vehicles, customers] = await Promise.all([
    vehiclesAPI.getAll({ agency_id: currentUser.agency_id, status: 'available' }),
    customersAPI.getAll()
  ]);
  
  const now = new Date();
  const startDate = now.toISOString().slice(0, 16);
  const endDate = new Date(now.getTime() + 24*60*60*1000).toISOString().slice(0, 16);
  
  openModal(t('newRental'), `
    <form id="rentalForm">
      <div class="form-group">
        <label>${t('customer')} *</label>
        <select id="rentalCustomer" class="form-control" required>
          <option value="">${t('selectCustomer')}</option>
          ${customers.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name} - ${c.phone||c.email||''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${t('vehicle')} *</label>
        <select id="rentalVehicle" class="form-control" required onchange="updateRentalPrice()">
          <option value="">${t('selectVehicle')}</option>
          ${vehicles.map(v => `<option value="${v.id}" data-rate="${v.daily_rate}" data-deposit="${v.deposit}">${v.code} - ${v.brand||''} ${v.model||''} (${formatCurrency(v.daily_rate)}/día)</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('startDate')} *</label><input type="datetime-local" id="rentalStart" class="form-control" value="${startDate}" required onchange="updateRentalPrice()"></div>
        <div class="form-group"><label>${t('plannedEndDate')} *</label><input type="datetime-local" id="rentalEnd" class="form-control" value="${endDate}" required onchange="updateRentalPrice()"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('dailyRate')} (€)</label><input type="number" id="rentalRate" class="form-control" step="0.01" readonly></div>
        <div class="form-group"><label>${t('deposit')} (€)</label><input type="number" id="rentalDeposit" class="form-control" step="0.01" readonly></div>
      </div>
      <div class="form-group"><label>${t('totalAmount')} (€)</label><input type="number" id="rentalTotal" class="form-control" readonly></div>
    </form>
  `, `<button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary" onclick="createRental()">${t('save')}</button>`);
}

function updateRentalPrice() {
  const vehicleSelect = document.getElementById('rentalVehicle');
  const option = vehicleSelect.options[vehicleSelect.selectedIndex];
  if (!option.value) return;
  
  const rate = parseFloat(option.dataset.rate) || 0;
  const deposit = parseFloat(option.dataset.deposit) || 0;
  const start = new Date(document.getElementById('rentalStart').value);
  const end = new Date(document.getElementById('rentalEnd').value);
  
  const diffHours = (end - start) / (1000 * 60 * 60);
  let days = Math.floor(diffHours / 24);
  if (diffHours % 24 > 1) days++;
  days = Math.max(1, days);
  
  document.getElementById('rentalRate').value = rate.toFixed(2);
  document.getElementById('rentalDeposit').value = deposit.toFixed(2);
  document.getElementById('rentalTotal').value = (days * rate).toFixed(2);
}

async function createRental() {
  const data = {
    customer_id: document.getElementById('rentalCustomer').value,
    vehicle_id: document.getElementById('rentalVehicle').value,
    agency_id: currentUser.agency_id,
    start_date: document.getElementById('rentalStart').value,
    planned_end_date: document.getElementById('rentalEnd').value,
    daily_rate: parseFloat(document.getElementById('rentalRate').value),
    deposit: parseFloat(document.getElementById('rentalDeposit').value),
    payment_method: 'cash'
  };
  
  try {
    await rentalsAPI.create(data);
    closeModal(); showToast(t('savedSuccess'), 'success'); loadRentals();
  } catch (e) { showToast(e.message, 'error'); }
}

async function showReturnModal(id) {
  const rental = await rentalsAPI.getById(id);
  const now = new Date().toISOString().slice(0, 16);
  
  openModal(t('returnVehicle'), `
    <form id="returnForm">
      <input type="hidden" id="returnRentalId" value="${id}">
      <p><strong>${t('contract')}:</strong> ${rental.contract_number}</p>
      <p><strong>${t('customer')}:</strong> ${rental.first_name} ${rental.last_name}</p>
      <p><strong>${t('vehicle')}:</strong> ${rental.vehicle_code}</p>
      <hr style="border-color:var(--border);margin:15px 0;">
      <div class="form-group"><label>${t('endDate')} *</label><input type="datetime-local" id="returnDate" class="form-control" value="${now}" required></div>
      <div class="form-group">
        <label><input type="checkbox" id="returnDeposit" checked> Devolver depósito (${formatCurrency(rental.deposit_paid || rental.deposit)})</label>
      </div>
    </form>
  `, `<button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-success" onclick="processReturn()">${t('confirm')}</button>`);
}

async function processReturn() {
  const id = document.getElementById('returnRentalId').value;
  const data = {
    end_date: document.getElementById('returnDate').value,
    return_deposit: document.getElementById('returnDeposit').checked
  };
  
  try {
    await rentalsAPI.return(id, data);
    closeModal(); showToast(t('savedSuccess'), 'success'); loadPage(currentPage);
  } catch (e) { showToast(e.message, 'error'); }
}

// =====================================================
// Caisse
// =====================================================

async function renderCash(container) {
  container.innerHTML = `
    <div class="page-header"><h1>${t('cash')}</h1><p>${t('cashRegister')}</p></div>
    <div class="stats-grid" id="cashStats"><div class="loading"><div class="spinner"></div></div></div>
    <div class="card">
      <div class="card-header">
        <h2>${t('todayPayments')}</h2>
        <button class="btn btn-primary" onclick="generateZReport()">${t('closeDay')}</button>
      </div>
      <div id="paymentsList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  
  try {
    const [summary, payments] = await Promise.all([
      paymentsAPI.getSummary(currentUser.agency_id),
      paymentsAPI.getToday(currentUser.agency_id)
    ]);
    
    document.getElementById('cashStats').innerHTML = `
      <div class="stat-card"><div class="stat-icon success">💵</div><div class="stat-info"><h3>${formatCurrency(summary.cash_in)}</h3><p>${t('cashTotal')}</p></div></div>
      <div class="stat-card"><div class="stat-icon info">💳</div><div class="stat-info"><h3>${formatCurrency(summary.card_in)}</h3><p>${t('cardTotal')}</p></div></div>
      <div class="stat-card"><div class="stat-icon warning">🏦</div><div class="stat-info"><h3>${formatCurrency(summary.transfer_in)}</h3><p>${t('transferTotal')}</p></div></div>
      <div class="stat-card"><div class="stat-icon primary">💰</div><div class="stat-info"><h3>${formatCurrency(summary.total_in)}</h3><p>${t('totalIn')}</p></div></div>
    `;
    
    if (!payments.length) {
      document.getElementById('paymentsList').innerHTML = `<div class="empty-state"><h3>${t('noResults')}</h3></div>`;
    } else {
      document.getElementById('paymentsList').innerHTML = `
        <div class="table-container"><table><thead><tr>
          <th>${t('contract')}</th><th>${t('customer')}</th><th>${t('paymentMethod')}</th><th>${t('totalAmount')}</th>
        </tr></thead><tbody>
          ${payments.map(p => `<tr>
            <td>${p.contract_number || '-'}</td>
            <td>${p.first_name ? p.first_name + ' ' + p.last_name : '-'}</td>
            <td>${t(p.payment_method === 'cash' ? 'cash_method' : p.payment_method)}</td>
            <td><strong>${formatCurrency(p.amount)}</strong></td>
          </tr>`).join('')}
        </tbody></table></div>
      `;
    }
  } catch (e) { showToast(t('errorOccurred'), 'error'); }
}

async function generateZReport() {
  if (!confirm('Generar informe Z y cerrar la caja del día?')) return;
  try {
    await reportsAPI.createZReport({ agency_id: currentUser.agency_id });
    showToast(t('zReportGenerated'), 'success');
    renderCash(document.getElementById('pageContainer'));
  } catch (e) { showToast(e.message, 'error'); }
}

// =====================================================
// Documents (Contrats & Factures)
// =====================================================

async function renderDocuments(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Documentos</h1>
      <p>Contratos y facturas de alquileres</p>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="filters-bar" style="margin:0;flex:1;gap:10px;">
          <div class="search-box"><span class="search-icon">🔍</span><input type="text" id="docSearch" placeholder="Buscar..." onkeyup="searchDocuments()"></div>
          <select class="filter-select" id="docStatusFilter" onchange="loadDocuments()">
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="completed">Finalizados</option>
          </select>
        </div>
      </div>
      <div id="documentsList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  await loadDocuments();
}

async function loadDocuments() {
  try {
    const status = document.getElementById('docStatusFilter')?.value || '';
    const params = { agency_id: currentUser.agency_id };
    if (status) params.status = status;
    const rentals = await rentalsAPI.getAll(params);
    window.documentsData = rentals;
    renderDocumentsTable(rentals);
  } catch (e) { showToast(t('errorOccurred'), 'error'); }
}

function searchDocuments() {
  const search = document.getElementById('docSearch').value.toLowerCase();
  let filtered = window.documentsData || [];
  if (search) {
    filtered = filtered.filter(r => 
      r.contract_number.toLowerCase().includes(search) ||
      (r.first_name + ' ' + r.last_name).toLowerCase().includes(search) ||
      (r.vehicle_code || '').toLowerCase().includes(search)
    );
  }
  renderDocumentsTable(filtered);
}

function renderDocumentsTable(rentals) {
  if (!rentals.length) {
    document.getElementById('documentsList').innerHTML = `<div class="empty-state"><div class="empty-state-icon">📄</div><h3>${t('noResults')}</h3></div>`;
    return;
  }
  document.getElementById('documentsList').innerHTML = `
    <div class="table-container"><table><thead><tr>
      <th>Contrato</th><th>Cliente</th><th>Vehículo</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Docs</th>
    </tr></thead><tbody>
      ${rentals.map(r => `<tr>
        <td><strong>${r.contract_number}</strong></td>
        <td>${r.first_name} ${r.last_name}</td>
        <td>${getVehicleTypeIcon(r.vehicle_type)} ${r.vehicle_code}</td>
        <td>${formatDateShort(r.start_date)}</td>
        <td>${formatCurrency(r.total_amount)}</td>
        <td>${getStatusBadge(r.status)}</td>
        <td><div class="btn-group">
          <button class="btn btn-sm btn-info" onclick="downloadContract(${r.id})" title="Contrato">📋</button>
          ${r.status === 'completed' ? `<button class="btn btn-sm btn-success" onclick="downloadInvoice(${r.id})" title="Factura">🧾</button>` : ''}
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>
  `;
}

function downloadInvoice(rentalId) {
  window.open(`/api/invoices/${rentalId}/pdf`, '_blank');
}

function downloadContract(rentalId) {
  window.open(`/api/contracts/${rentalId}/pdf`, '_blank');
}

// =====================================================
// PARAMÈTRES - Page principale unifiée
// =====================================================

async function renderSettings(container) {
  const isAdmin = currentUser.role === 'admin';
  
  container.innerHTML = `
    <div class="page-header">
      <h1>Parámetros</h1>
      <p>Configuración de la aplicación</p>
    </div>
    
    <div class="settings-tabs" style="display:flex;gap:5px;margin-bottom:20px;flex-wrap:wrap;background:var(--bg-card);padding:8px;border-radius:12px;">
      <button class="settings-tab-btn ${currentSettingsTab === 'agencies' ? 'active' : ''}" onclick="switchSettingsTab('agencies')">Agencias</button>
      <button class="settings-tab-btn ${currentSettingsTab === 'company' ? 'active' : ''}" onclick="switchSettingsTab('company')">Empresa</button>
      <button class="settings-tab-btn ${currentSettingsTab === 'pricing' ? 'active' : ''}" onclick="switchSettingsTab('pricing')">Tarifas</button>
      ${isAdmin ? `<button class="settings-tab-btn ${currentSettingsTab === 'users' ? 'active' : ''}" onclick="switchSettingsTab('users')">Usuarios</button>` : ''}
    </div>
    
    <div id="settingsContent"></div>
    
    <style>
      .settings-tab-btn {
        padding: 12px 20px;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 500;
        transition: all 0.2s;
      }
      .settings-tab-btn:hover { background: var(--bg-input); color: var(--text-primary); }
      .settings-tab-btn.active { background: var(--primary); color: var(--bg-dark); }
      .pricing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; margin: 15px 0; }
      .pricing-day { text-align: center; }
      .pricing-day label { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; }
      .pricing-day input { width: 100%; padding: 8px 4px; text-align: center; background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-size: 0.85rem; }
      .pricing-day input:focus { outline: none; border-color: var(--primary); }
      .pricing-day.half-day { background: rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 5px; }
      .pricing-day.half-day label { color: var(--primary); font-weight: bold; }
      .pricing-day.half-day input { background: rgba(245, 158, 11, 0.1); border-color: var(--primary); }
      .pricing-card { background: var(--bg-card); border-radius: 12px; padding: 20px; margin-bottom: 15px; }
      .pricing-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
      .add-item-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 15px; background: transparent; border: 2px dashed var(--border); border-radius: 10px; color: var(--text-secondary); cursor: pointer; font-size: 0.9rem; transition: all 0.2s; }
      .add-item-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(245, 158, 11, 0.1); }
      .insurance-row { display: flex; align-items: center; justify-content: space-between; padding: 15px; background: var(--bg-input); border-radius: 10px; margin-bottom: 10px; flex-wrap: wrap; gap: 15px; }
      .damage-row { display: grid; grid-template-columns: 1fr 100px auto; gap: 10px; align-items: center; padding: 12px; background: var(--bg-input); border-radius: 8px; margin-bottom: 8px; }
      @media (max-width: 768px) {
        .pricing-grid { grid-template-columns: repeat(5, 1fr); }
        .damage-row { grid-template-columns: 1fr; }
        .insurance-row { flex-direction: column; align-items: stretch; }
      }
    </style>
  `;
  
  switchSettingsTab(currentSettingsTab);
}

function switchSettingsTab(tab) {
  currentSettingsTab = tab;
  
  // Mettre à jour les boutons actifs
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tab.substring(0, 4)));
  });
  
  const content = document.getElementById('settingsContent');
  
  switch(tab) {
    case 'agencies': renderAgenciesTab(content); break;
    case 'company': renderCompanyTab(content); break;
    case 'pricing': renderPricingTab(content); break;
    case 'users': renderUsersTab(content); break;
  }
}

// =====================================================
// Tab Agences
// =====================================================

async function renderAgenciesTab(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Agencias</h2>
        <button class="btn btn-primary" onclick="showAgencyModal()">+ Nueva Agencia</button>
      </div>
      <div id="agenciesList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  await loadAgenciesSettings();
}

async function loadAgenciesSettings() {
  try {
    const agenciesList = await agenciesAPI.getAll();
    if (!agenciesList.length) {
      document.getElementById('agenciesList').innerHTML = `<div class="empty-state"><h3>No hay agencias</h3></div>`;
      return;
    }
    document.getElementById('agenciesList').innerHTML = `
      <div class="table-container"><table><thead><tr>
        <th>Código</th><th>Nombre</th><th>Dirección</th><th>Teléfono</th><th></th>
      </tr></thead><tbody>
        ${agenciesList.map(a => `<tr>
          <td><strong>${a.code}</strong></td>
          <td>${a.name}</td>
          <td>${a.address || '-'}</td>
          <td>${a.phone || '-'}</td>
          <td><div class="btn-group">
            <button class="btn btn-sm btn-secondary" onclick="showAgencyModal(${a.id})">✏️</button>
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>
    `;
  } catch (e) { showToast(t('errorOccurred'), 'error'); }
}

function showAgencyModal(id = null) {
  openModal(id ? 'Editar Agencia' : 'Nueva Agencia', `
    <form id="agencyForm">
      <input type="hidden" id="agencyId" value="${id || ''}">
      <div class="form-row">
        <div class="form-group"><label>Código *</label><input type="text" id="agencyCode" class="form-control" placeholder="AG-01" required></div>
        <div class="form-group"><label>Nombre *</label><input type="text" id="agencyName" class="form-control" placeholder="Voltride Torrevieja" required></div>
      </div>
      <div class="form-group"><label>Dirección</label><input type="text" id="agencyAddress" class="form-control" placeholder="Calle Principal 123, Torrevieja"></div>
      <div class="form-row">
        <div class="form-group"><label>Teléfono</label><input type="tel" id="agencyPhone" class="form-control" placeholder="+34 600 000 001"></div>
        <div class="form-group"><label>Email</label><input type="email" id="agencyEmail" class="form-control" placeholder="torrevieja@voltride.es"></div>
      </div>
    </form>
  `, `<button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary" onclick="saveAgency()">${t('save')}</button>`);
  if (id) loadAgencyData(id);
}

async function loadAgencyData(id) {
  try {
    const agenciesList = await agenciesAPI.getAll();
    const agency = agenciesList.find(a => a.id === id);
    if (agency) {
      document.getElementById('agencyCode').value = agency.code;
      document.getElementById('agencyName').value = agency.name;
      document.getElementById('agencyAddress').value = agency.address || '';
      document.getElementById('agencyPhone').value = agency.phone || '';
      document.getElementById('agencyEmail').value = agency.email || '';
    }
  } catch (e) { console.error(e); }
}

async function saveAgency() {
  const id = document.getElementById('agencyId').value;
  const data = {
    code: document.getElementById('agencyCode').value,
    name: document.getElementById('agencyName').value,
    address: document.getElementById('agencyAddress').value,
    phone: document.getElementById('agencyPhone').value,
    email: document.getElementById('agencyEmail').value
  };
  
  try {
    if (id) await agenciesAPI.update(id, data);
    else await agenciesAPI.create(data);
    closeModal();
    showToast(t('savedSuccess'), 'success');
    loadAgenciesSettings();
    agencies = await agenciesAPI.getAll();
  } catch (e) { showToast(e.message, 'error'); }
}

// =====================================================
// Tab Empresa
// =====================================================

function renderCompanyTab(container) {
  const saved = JSON.parse(localStorage.getItem('voltride_company') || '{}');
  
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h2>Información de la Empresa</h2></div>
      <div style="padding: 20px;">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre de la empresa</label>
            <input type="text" id="companyName" class="form-control" value="${saved.name || 'Voltride'}">
          </div>
          <div class="form-group">
            <label>NIF/CIF</label>
            <input type="text" id="companyNif" class="form-control" value="${saved.nif || ''}" placeholder="B12345678">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="companyEmail" class="form-control" value="${saved.email || ''}" placeholder="info@voltride.es">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="tel" id="companyPhone" class="form-control" value="${saved.phone || ''}" placeholder="+34 600 000 001">
          </div>
        </div>
        <button class="btn btn-primary" onclick="saveCompanySettings()">Guardar</button>
      </div>
    </div>
  `;
}

function saveCompanySettings() {
  const settings = {
    name: document.getElementById('companyName').value,
    nif: document.getElementById('companyNif').value,
    email: document.getElementById('companyEmail').value,
    phone: document.getElementById('companyPhone').value
  };
  localStorage.setItem('voltride_company', JSON.stringify(settings));
  showToast('Configuración guardada', 'success');
}

// =====================================================
// Tab Tarifas
// =====================================================

let currentPricingSubTab = 'vehicles';

async function renderPricingTab(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Configuración de Tarifas</h2>
        <button class="btn btn-primary" onclick="savePricing()">Guardar</button>
      </div>
      
      <div style="display:flex;gap:5px;margin-bottom:20px;flex-wrap:wrap;">
        <button class="btn btn-sm ${currentPricingSubTab === 'vehicles' ? 'btn-primary' : 'btn-secondary'}" onclick="switchPricingSubTab('vehicles')">Vehículos</button>
        <button class="btn btn-sm ${currentPricingSubTab === 'accessories' ? 'btn-primary' : 'btn-secondary'}" onclick="switchPricingSubTab('accessories')">Accessoires</button>
        <button class="btn btn-sm ${currentPricingSubTab === 'insurance' ? 'btn-primary' : 'btn-secondary'}" onclick="switchPricingSubTab('insurance')">Assurances</button>
        <button class="btn btn-sm ${currentPricingSubTab === 'damages' ? 'btn-primary' : 'btn-secondary'}" onclick="switchPricingSubTab('damages')">Dommages</button>
      </div>
      
      <div id="pricingSubContent"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  
  await loadPricingData();
  switchPricingSubTab(currentPricingSubTab);
}

async function loadPricingData() {
  try {
    const response = await fetch('/api/pricing', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    
    if (response.ok) {
      const data = await response.json();
      vehicleTypes = data.vehicleTypes || getDefaultVehicleTypes();
      accessories = data.accessories || getDefaultAccessories();
      insuranceOptions = data.insuranceOptions || getDefaultInsuranceOptions();
      damages = data.damages || getDefaultDamages();
    } else {
      vehicleTypes = getDefaultVehicleTypes();
      accessories = getDefaultAccessories();
      insuranceOptions = getDefaultInsuranceOptions();
      damages = getDefaultDamages();
    }
  } catch (e) {
    console.error('Error loading pricing:', e);
    vehicleTypes = getDefaultVehicleTypes();
    accessories = getDefaultAccessories();
    insuranceOptions = getDefaultInsuranceOptions();
    damages = getDefaultDamages();
  }
}

function getDefaultVehicleTypes() {
  return [
    { 
      id: 'bike', 
      name: 'Vélo classique', 
      image: '', 
      deposit: 100, 
      replacementValue: 350,
      prices: {1:10,2:18,3:25,4:32,5:38,6:44,7:49,8:55,9:60,10:65,11:70,12:75,13:80,14:84}, 
      extraDay: 5,
      compatibleAccessories: ['helmet', 'lock', 'basket', 'child_seat', 'phone_holder'],
      insuranceRequired: false,
      availableInsurance: ['none', 'basic', 'premium']
    },
    { 
      id: 'ebike', 
      name: 'Vélo électrique', 
      image: '', 
      deposit: 300, 
      replacementValue: 1500,
      prices: {1:25,2:45,3:63,4:80,5:95,6:108,7:119,8:130,9:140,10:150,11:159,12:168,13:176,14:182}, 
      extraDay: 12,
      compatibleAccessories: ['helmet', 'lock', 'basket', 'child_seat', 'phone_holder'],
      insuranceRequired: false,
      availableInsurance: ['none', 'basic', 'premium']
    },
    { 
      id: 'scooter', 
      name: 'Scooter électrique', 
      image: '', 
      deposit: 500, 
      replacementValue: 2500,
      prices: {1:35,2:65,3:90,4:112,5:130,6:145,7:158,8:170,9:181,10:191,11:200,12:208,13:215,14:221}, 
      extraDay: 15,
      compatibleAccessories: ['helmet', 'lock', 'phone_holder'],
      insuranceRequired: true,
      availableInsurance: ['basic', 'premium']
    }
  ];
}

function getDefaultAccessories() {
  return [
    { id: 'helmet', name: 'Casque', image: '', replacementValue: 35, prices: {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0}, extraDay: 0 },
    { id: 'lock', name: 'Antivol', image: '', replacementValue: 25, prices: {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0}, extraDay: 0 },
    { id: 'basket', name: 'Panier', image: '', replacementValue: 20, prices: {1:2,2:4,3:5,4:6,5:7,6:8,7:9,8:10,9:11,10:12,11:13,12:14,13:15,14:15}, extraDay: 1 },
    { id: 'child_seat', name: 'Siège enfant', image: '', replacementValue: 60, prices: {1:5,2:9,3:12,4:15,5:17,6:19,7:21,8:23,9:25,10:27,11:29,12:31,13:33,14:35}, extraDay: 2 },
    { id: 'phone_holder', name: 'Support téléphone', image: '', replacementValue: 15, prices: {1:1,2:2,3:3,4:4,5:5,6:5,7:5,8:5,9:5,10:5,11:5,12:5,13:5,14:5}, extraDay: 0 }
  ];
}

// Fonction pour afficher l'image ou un placeholder
function getItemImage(item, size = 60) {
  if (item.image) {
    return `<img src="${item.image}" alt="${item.name}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:8px;">`;
  }
  // Placeholder avec initiales
  const initials = item.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `<div style="width:${size}px;height:${size}px;background:var(--bg-input);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--text-secondary);font-size:${size/3}px;">${initials}</div>`;
}

function getDefaultInsuranceOptions() {
  return [
    { id: 'none', name: 'Sans assurance', description: 'Caution complète', pricePerDay: 0, depositReduction: 0 },
    { id: 'basic', name: 'Assurance Basic', description: 'Réduction 50% caution', pricePerDay: 3, depositReduction: 50 },
    { id: 'premium', name: 'Assurance Premium', description: 'Réduction 75% caution', pricePerDay: 6, depositReduction: 75 }
  ];
}

function getDefaultDamages() {
  return [
    { id: 1, name: 'Pneu crevé', price: 15 },
    { id: 2, name: 'Frein endommagé', price: 25 },
    { id: 3, name: 'Chaîne cassée', price: 20 },
    { id: 4, name: 'Éclairage cassé', price: 15 },
    { id: 5, name: 'Batterie endommagée', price: 200 }
  ];
}

function switchPricingSubTab(tab) {
  currentPricingSubTab = tab;
  
  // Mettre à jour les boutons
  document.querySelectorAll('#settingsContent .card .btn-sm').forEach(btn => {
    const isActive = btn.textContent.toLowerCase().includes(tab.substring(0, 4));
    btn.className = `btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`;
  });
  
  const content = document.getElementById('pricingSubContent');
  
  switch(tab) {
    case 'vehicles': renderVehiclesPricing(content); break;
    case 'accessories': renderAccessoriesPricing(content); break;
    case 'insurance': renderInsurancePricing(content); break;
    case 'damages': renderDamagesPricing(content); break;
  }
}

function renderVehiclesPricing(container) {
  container.innerHTML = `
    <div style="background:rgba(245,158,11,0.15);border:1px solid var(--primary);border-radius:10px;padding:15px;margin-bottom:20px;">
      <p style="color:var(--text-primary);font-size:0.9rem;margin:0;"><strong>💡 Info:</strong> Los precios son <strong>TOTALES</strong> por duración. <strong>½ día = 4 horas</strong>. <strong>24h = 1 día</strong> (+1h gratis).</p>
    </div>
  ` + vehicleTypes.map((v, i) => `
    <div class="pricing-card">
      <div class="pricing-card-header">
        <div style="display:flex;align-items:center;gap:15px;">
          <div class="item-image-container" onclick="uploadVehicleImage(${i})" style="cursor:pointer;position:relative;">
            ${getItemImage(v, 60)}
            <div style="position:absolute;bottom:-5px;right:-5px;background:var(--primary);color:var(--bg-dark);width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;">+</div>
          </div>
          <h3>${v.name}</h3>
        </div>
        <button class="btn btn-sm btn-danger" onclick="deleteVehicleType(${i})">Suppr.</button>
      </div>
      
      <div style="display:flex;gap:15px;flex-wrap:wrap;margin-bottom:15px;">
        <div>
          <label style="font-size:0.8rem;color:var(--text-secondary);">Caution (€)</label>
          <input type="number" value="${v.deposit}" onchange="vehicleTypes[${i}].deposit=parseFloat(this.value)" style="width:100px;padding:8px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;">
        </div>
        <div>
          <label style="font-size:0.8rem;color:var(--text-secondary);">Valeur rempl. (€)</label>
          <input type="number" value="${v.replacementValue || 0}" onchange="vehicleTypes[${i}].replacementValue=parseFloat(this.value)" style="width:100px;padding:8px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;">
        </div>
        <div>
          <label style="font-size:0.8rem;color:var(--text-secondary);">Jour sup. (€)</label>
          <input type="number" value="${v.extraDay}" onchange="vehicleTypes[${i}].extraDay=parseFloat(this.value)" style="width:80px;padding:8px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;">
        </div>
      </div>
      
      <label style="font-size:0.85rem;color:var(--text-secondary);">Prix par durée (½ día + 1-14 jours)</label>
      <div class="pricing-grid">
        <div class="pricing-day half-day">
          <label>½ día</label>
          <input type="number" value="${v.halfDay||0}" onchange="vehicleTypes[${i}].halfDay=parseFloat(this.value)||0">
        </div>
        ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(d => `
          <div class="pricing-day">
            <label>${d}j</label>
            <input type="number" value="${v.prices[d]||0}" onchange="vehicleTypes[${i}].prices[${d}]=parseFloat(this.value)">
          </div>
        `).join('')}
      </div>
      
      <div style="margin-top:20px;padding-top:15px;border-top:1px solid var(--border);">
        <label style="font-size:0.85rem;color:var(--text-secondary);display:block;margin-bottom:10px;">Accessoires compatibles</label>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          ${accessories.map(acc => `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-input);border-radius:6px;cursor:pointer;font-size:0.85rem;">
              <input type="checkbox" ${(v.compatibleAccessories || []).includes(acc.id) ? 'checked' : ''} onchange="toggleVehicleAccessory(${i}, '${acc.id}', this.checked)">
              ${acc.image ? `<img src="${acc.image}" style="width:20px;height:20px;object-fit:cover;border-radius:4px;">` : ''} ${acc.name}
            </label>
          `).join('')}
        </div>
      </div>
      
      <div style="margin-top:15px;padding-top:15px;border-top:1px solid var(--border);">
        <label style="font-size:0.85rem;color:var(--text-secondary);display:block;margin-bottom:10px;">Options d'assurance</label>
        <div style="display:flex;flex-wrap:wrap;gap:15px;align-items:center;">
          <label style="display:flex;align-items:center;gap:5px;font-size:0.85rem;color:var(--warning);">
            <input type="checkbox" ${v.insuranceRequired ? 'checked' : ''} onchange="vehicleTypes[${i}].insuranceRequired=this.checked">
            Assurance obligatoire
          </label>
          <span style="color:var(--text-secondary);font-size:0.85rem;">|</span>
          <span style="font-size:0.85rem;color:var(--text-secondary);">Disponibles:</span>
          ${insuranceOptions.map(ins => `
            <label style="display:flex;align-items:center;gap:5px;padding:6px 10px;background:var(--bg-input);border-radius:6px;cursor:pointer;font-size:0.85rem;">
              <input type="checkbox" ${(v.availableInsurance || []).includes(ins.id) ? 'checked' : ''} onchange="toggleVehicleInsurance(${i}, '${ins.id}', this.checked)">
              ${ins.name}
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('') + `<button class="add-item-btn" onclick="addVehicleType()">+ Ajouter un type de véhicule</button>`;
}

function uploadVehicleImage(index) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        vehicleTypes[index].image = event.target.result;
        switchPricingSubTab('vehicles');
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

function toggleVehicleAccessory(vehicleIndex, accessoryId, checked) {
  if (!vehicleTypes[vehicleIndex].compatibleAccessories) {
    vehicleTypes[vehicleIndex].compatibleAccessories = [];
  }
  if (checked) {
    if (!vehicleTypes[vehicleIndex].compatibleAccessories.includes(accessoryId)) {
      vehicleTypes[vehicleIndex].compatibleAccessories.push(accessoryId);
    }
  } else {
    vehicleTypes[vehicleIndex].compatibleAccessories = vehicleTypes[vehicleIndex].compatibleAccessories.filter(id => id !== accessoryId);
  }
}

function toggleVehicleInsurance(vehicleIndex, insuranceId, checked) {
  if (!vehicleTypes[vehicleIndex].availableInsurance) {
    vehicleTypes[vehicleIndex].availableInsurance = [];
  }
  if (checked) {
    if (!vehicleTypes[vehicleIndex].availableInsurance.includes(insuranceId)) {
      vehicleTypes[vehicleIndex].availableInsurance.push(insuranceId);
    }
  } else {
    vehicleTypes[vehicleIndex].availableInsurance = vehicleTypes[vehicleIndex].availableInsurance.filter(id => id !== insuranceId);
  }
}

function renderAccessoriesPricing(container) {
  container.innerHTML = `
    <div style="background:rgba(59,130,246,0.1);border:1px solid var(--info);border-radius:10px;padding:15px;margin-bottom:20px;">
      <p style="color:var(--text-secondary);font-size:0.9rem;"><strong>Valeur de remplacement</strong> = montant déduit de la caution si accessoire non retourné/perdu</p>
    </div>
  ` + accessories.map((a, i) => `
    <div class="pricing-card">
      <div class="pricing-card-header">
        <div style="display:flex;align-items:center;gap:15px;">
          <div class="item-image-container" onclick="uploadAccessoryImage(${i})" style="cursor:pointer;position:relative;">
            ${getItemImage(a, 50)}
            <div style="position:absolute;bottom:-5px;right:-5px;background:var(--primary);color:var(--bg-dark);width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;">+</div>
          </div>
          <h3>${a.name}</h3>
        </div>
        <button class="btn btn-sm btn-danger" onclick="deleteAccessory(${i})">Suppr.</button>
      </div>
      <div style="display:flex;gap:15px;flex-wrap:wrap;margin-bottom:15px;">
        <div>
          <label style="font-size:0.8rem;color:var(--text-secondary);">Valeur rempl. (€)</label>
          <input type="number" value="${a.replacementValue || 0}" onchange="accessories[${i}].replacementValue=parseFloat(this.value)" style="width:100px;padding:8px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;">
        </div>
        <div>
          <label style="font-size:0.8rem;color:var(--text-secondary);">Jour sup. (€)</label>
          <input type="number" value="${a.extraDay}" onchange="accessories[${i}].extraDay=parseFloat(this.value)" style="width:80px;padding:8px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;">
        </div>
      </div>
      <label style="font-size:0.85rem;color:var(--text-secondary);">Prix par durée (½ día + 1-14 jours)</label>
      <div class="pricing-grid">
        <div class="pricing-day half-day">
          <label>½ día</label>
          <input type="number" value="${a.halfDay||0}" onchange="accessories[${i}].halfDay=parseFloat(this.value)||0">
        </div>
        ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(d => `
          <div class="pricing-day">
            <label>${d}j</label>
            <input type="number" value="${a.prices[d]||0}" onchange="accessories[${i}].prices[${d}]=parseFloat(this.value)">
          </div>
        `).join('')}
      </div>
    </div>
  `).join('') + `<button class="add-item-btn" onclick="addAccessory()">+ Ajouter un accessoire</button>`;
}

function uploadAccessoryImage(index) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        accessories[index].image = event.target.result;
        switchPricingSubTab('accessories');
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

function renderInsurancePricing(container) {
  container.innerHTML = `
    <div style="background:rgba(59,130,246,0.1);border:1px solid var(--info);border-radius:10px;padding:15px;margin-bottom:20px;">
      <p style="color:var(--text-secondary);font-size:0.9rem;">L'assurance réduit la caution selon le % configuré. Ex: 50% = caution divisée par 2.</p>
    </div>
    ${insuranceOptions.map((ins, i) => `
      <div class="insurance-row">
        <div style="flex:1;">
          <strong>${ins.name}</strong>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">${ins.description}</p>
        </div>
        <div style="display:flex;gap:15px;align-items:center;">
          <div style="text-align:center;">
            <label style="font-size:0.75rem;color:var(--text-secondary);display:block;">Prix/jour (€)</label>
            <input type="number" value="${ins.pricePerDay}" onchange="insuranceOptions[${i}].pricePerDay=parseFloat(this.value)" style="width:80px;padding:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;">
          </div>
          <div style="text-align:center;">
            <label style="font-size:0.75rem;color:var(--text-secondary);display:block;">Réduction (%)</label>
            <input type="number" value="${ins.depositReduction}" min="0" max="100" onchange="insuranceOptions[${i}].depositReduction=parseFloat(this.value)" style="width:80px;padding:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;">
          </div>
          ${i > 0 ? `<button class="btn btn-sm btn-danger" onclick="deleteInsurance(${i})">Suppr.</button>` : '<div style="width:60px;"></div>'}
        </div>
      </div>
    `).join('')}
    <button class="add-item-btn" onclick="addInsurance()">+ Ajouter une option d'assurance</button>
  `;
}

function renderDamagesPricing(container) {
  container.innerHTML = `
    <div style="background:rgba(245,158,11,0.15);border:1px solid var(--primary);border-radius:10px;padding:15px;margin-bottom:20px;">
      <p style="color:var(--text-primary);font-size:0.9rem;margin:0;"><strong>💡 Info:</strong> Les dommages sont affichés dans le Check-out. Vous pouvez les associer à des types de véhicules spécifiques.</p>
    </div>
    ${damages.map((d, i) => `
      <div class="damage-row" style="display:grid;grid-template-columns:1fr 100px 200px auto;gap:10px;align-items:center;padding:15px;background:var(--bg-input);border-radius:8px;margin-bottom:10px;">
        <input type="text" value="${d.name || ''}" placeholder="Type de dommage" onchange="damages[${i}].name=this.value" style="padding:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);">
        <input type="number" value="${d.price || 0}" placeholder="€" onchange="damages[${i}].price=parseFloat(this.value)||0" style="padding:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);text-align:center;">
        <select onchange="updateDamageTypes(${i}, this.value)" style="padding:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);">
          <option value="" ${!d.compatibleTypes || d.compatibleTypes.length === 0 ? 'selected' : ''}>🌐 Tous véhicules</option>
          ${vehicleTypes.map(vt => `
            <option value="${vt.id}" ${d.compatibleTypes && d.compatibleTypes.includes(vt.id) ? 'selected' : ''}>${vt.name}</option>
          `).join('')}
        </select>
        <button class="btn btn-sm btn-danger" onclick="deleteDamage(${i})">Suppr.</button>
      </div>
    `).join('')}
    <button class="add-item-btn" onclick="addDamageWithType()">+ Ajouter un type de dommage</button>
  `;
}

function updateDamageTypes(index, vehicleTypeId) {
  if (!damages[index].compatibleTypes) damages[index].compatibleTypes = [];
  if (vehicleTypeId === '') {
    damages[index].compatibleTypes = [];
  } else {
    damages[index].compatibleTypes = [vehicleTypeId];
  }
}

function addDamageWithType() {
  const maxId = damages.length > 0 ? Math.max(...damages.map(d => d.id || 0)) : 0;
  damages.push({ id: maxId + 1, name: '', price: 0, compatibleTypes: [] });
  switchPricingSubTab('damages');
}

function addVehicleType() {
  openModal('Ajouter un type de véhicule', `
    <div class="form-group"><label>Nom</label><input type="text" id="newVTypeName" class="form-control" placeholder="Ex: Vélo cargo"></div>
    <div class="form-row">
      <div class="form-group"><label>Caution (€)</label><input type="number" id="newVTypeDeposit" class="form-control" value="100"></div>
      <div class="form-group"><label>Valeur de remplacement (€)</label><input type="number" id="newVTypeReplacement" class="form-control" value="500"></div>
    </div>
    <div class="form-group">
      <label><input type="checkbox" id="newVTypeInsReq"> Assurance obligatoire</label>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="confirmAddVehicleType()">Ajouter</button>`);
}

function confirmAddVehicleType() {
  const name = document.getElementById('newVTypeName').value;
  if (!name) { alert('Nom requis'); return; }
  vehicleTypes.push({
    id: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
    name: name,
    image: '',
    deposit: parseFloat(document.getElementById('newVTypeDeposit').value) || 100,
    replacementValue: parseFloat(document.getElementById('newVTypeReplacement').value) || 500,
    halfDay: parseFloat(document.getElementById('newVTypeHalfDay').value) || 0,
    prices: {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0},
    extraDay: 0,
    compatibleAccessories: accessories.map(a => a.id),
    insuranceRequired: document.getElementById('newVTypeInsReq').checked,
    availableInsurance: ['none', 'basic', 'premium']
  });
  closeModal();
  switchPricingSubTab('vehicles');
}

function deleteVehicleType(i) { if(confirm('Supprimer?')) { vehicleTypes.splice(i,1); switchPricingSubTab('vehicles'); } }

function addAccessory() {
  openModal('Ajouter un accessoire', `
    <div class="form-group"><label>Nom</label><input type="text" id="newAccName" class="form-control" placeholder="Ex: Sacoche"></div>
    <div class="form-group"><label>Valeur de remplacement (€)</label><input type="number" id="newAccReplacement" class="form-control" value="30"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="confirmAddAccessory()">Ajouter</button>`);
}

function confirmAddAccessory() {
  const name = document.getElementById('newAccName').value;
  if (!name) { alert('Nom requis'); return; }
  const newAcc = {
    id: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
    name: name,
    image: '',
    replacementValue: parseFloat(document.getElementById('newAccReplacement').value) || 30,
    prices: {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0},
    extraDay: 0
  };
  accessories.push(newAcc);
  // Ajouter automatiquement à tous les véhicules compatibles
  vehicleTypes.forEach(v => {
    if (!v.compatibleAccessories) v.compatibleAccessories = [];
    v.compatibleAccessories.push(newAcc.id);
  });
  closeModal();
  switchPricingSubTab('accessories');
}

function deleteAccessory(i) { if(confirm('Supprimer?')) { accessories.splice(i,1); switchPricingSubTab('accessories'); } }

function addInsurance() {
  openModal('Ajouter une assurance', `
    <div class="form-group"><label>Nom</label><input type="text" id="newInsName" class="form-control"></div>
    <div class="form-group"><label>Description</label><input type="text" id="newInsDesc" class="form-control"></div>
    <div class="form-row">
      <div class="form-group"><label>Prix/jour (€)</label><input type="number" id="newInsPrice" class="form-control" value="5"></div>
      <div class="form-group"><label>Réduction caution (%)</label><input type="number" id="newInsReduction" class="form-control" value="50"></div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="confirmAddInsurance()">Ajouter</button>`);
}

function confirmAddInsurance() {
  const name = document.getElementById('newInsName').value;
  if (!name) { alert('Nom requis'); return; }
  insuranceOptions.push({
    id: name.toLowerCase().replace(/\s+/g, '_'),
    name: name,
    description: document.getElementById('newInsDesc').value,
    pricePerDay: parseFloat(document.getElementById('newInsPrice').value) || 0,
    depositReduction: parseFloat(document.getElementById('newInsReduction').value) || 0
  });
  closeModal();
  switchPricingSubTab('insurance');
}

function deleteInsurance(i) { if(confirm('Supprimer?')) { insuranceOptions.splice(i,1); switchPricingSubTab('insurance'); } }

function deleteDamage(i) { damages.splice(i,1); switchPricingSubTab('damages'); }

async function savePricing() {
  const filteredDamages = damages.filter(d => d.name && d.name.trim() !== '');
  
  try {
    const response = await fetch('/api/pricing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: JSON.stringify({
        vehicleTypes: vehicleTypes,
        accessories: accessories,
        insuranceOptions: insuranceOptions,
        damages: filteredDamages
      })
    });
    
    if (response.ok) {
      showToast('Tarifas guardadas correctamente', 'success');
    } else {
      throw new Error('Error servidor');
    }
  } catch (e) {
    console.error(e);
    localStorage.setItem('voltride_pricing', JSON.stringify({ vehicleTypes, accessories, insuranceOptions, damages: filteredDamages }));
    showToast('Guardado localmente', 'warning');
  }
}

// =====================================================
// Tab Usuarios
// =====================================================

async function renderUsersTab(container) {
  if (currentUser.role !== 'admin') {
    container.innerHTML = `<div class="empty-state"><h3>Accès réservé aux administrateurs</h3></div>`;
    return;
  }
  
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Usuarios</h2>
        <button class="btn btn-primary" onclick="showUserModal()">+ ${t('addUser')}</button>
      </div>
      <div id="usersListContent"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  
  try {
    const users = await authAPI.getUsers();
    document.getElementById('usersListContent').innerHTML = `
      <div class="table-container"><table><thead><tr>
        <th>${t('username')}</th><th>${t('fullName')}</th><th>${t('role')}</th><th>${t('agency')}</th><th></th>
      </tr></thead><tbody>
        ${users.map(u => `<tr>
          <td><strong>${u.username}</strong></td>
          <td>${u.full_name}</td>
          <td>${t(u.role)}</td>
          <td>${u.agency_name || '-'}</td>
          <td><div class="btn-group">
            <button class="btn btn-sm btn-secondary" onclick="showUserModal(${u.id})">✏️</button>
            ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">🗑️</button>` : ''}
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>
    `;
  } catch (e) { showToast(t('errorOccurred'), 'error'); }
}

function showUserModal(id = null) {
  openModal(id ? t('editUser') : t('addUser'), `
    <form id="userForm">
      <input type="hidden" id="userId" value="${id||''}">
      <div class="form-group"><label>${t('username')} *</label><input type="text" id="userUsername" class="form-control" required></div>
      <div class="form-group"><label>${t('password')} ${id ? '' : '*'}</label><input type="password" id="userPassword" class="form-control" ${id ? '' : 'required'}></div>
      <div class="form-group"><label>${t('fullName')} *</label><input type="text" id="userFullName" class="form-control" required></div>
      <div class="form-row">
        <div class="form-group"><label>${t('role')}</label><select id="userRole" class="form-control"><option value="employee">${t('employee')}</option><option value="admin">${t('admin')}</option></select></div>
        <div class="form-group"><label>${t('agency')}</label><select id="userAgency" class="form-control">${agencies.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('')}</select></div>
      </div>
    </form>
  `, `<button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary" onclick="saveUser()">${t('save')}</button>`);
  if (id) loadUserData(id);
}

async function loadUserData(id) {
  try {
    const users = await authAPI.getUsers();
    const u = users.find(x => x.id === id);
    if (u) {
      document.getElementById('userUsername').value = u.username;
      document.getElementById('userFullName').value = u.full_name;
      document.getElementById('userRole').value = u.role;
      document.getElementById('userAgency').value = u.agency_id || '';
    }
  } catch (e) { console.error(e); }
}

async function saveUser() {
  const id = document.getElementById('userId').value;
  const data = {
    username: document.getElementById('userUsername').value,
    full_name: document.getElementById('userFullName').value,
    role: document.getElementById('userRole').value,
    agency_id: document.getElementById('userAgency').value,
    active: true
  };
  const password = document.getElementById('userPassword').value;
  if (password) data.password = password;
  
  try {
    if (id) await authAPI.updateUser(id, data);
    else await authAPI.createUser(data);
    closeModal();
    showToast(t('savedSuccess'), 'success');
    renderUsersTab(document.getElementById('settingsContent'));
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteUser(id) {
  if (!confirm(t('confirmDelete'))) return;
  try {
    await authAPI.deleteUser(id);
    showToast(t('deleteSuccess'), 'success');
    renderUsersTab(document.getElementById('settingsContent'));
  } catch (e) { showToast(e.message, 'error'); }
}

// =====================================================
// MAINTENANCE
// =====================================================

let maintenanceRecords = [];
let maintenanceStats = {};
let currentMaintenanceTab = 'pending';

// API Maintenance
const maintenanceAPI = {
  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/maintenance?${query}`, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) throw new Error('Error al cargar mantenimientos');
    return res.json();
  },
  async getStats(agencyId) {
    const query = agencyId ? `?agency_id=${agencyId}` : '';
    const res = await fetch(`/api/maintenance/stats${query}`, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) throw new Error('Error al cargar estadísticas');
    return res.json();
  },
  async getVehicleHistory(vehicleId) {
    const res = await fetch(`/api/maintenance/vehicle/${vehicleId}/history`, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) throw new Error('Error al cargar historial');
    return res.json();
  },
  async create(data) {
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al crear mantenimiento');
    return res.json();
  },
  async update(id, data) {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar');
    return res.json();
  },
  async complete(id, data = {}) {
    const res = await fetch(`/api/maintenance/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al completar');
    return res.json();
  },
  async delete(id) {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) throw new Error('Error al eliminar');
    return res.json();
  }
};

async function renderMaintenance(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>🔧 Mantenimiento</h1>
      <button class="btn btn-primary" onclick="showNewMaintenanceModal()">+ Nuevo Ticket</button>
    </div>
    
    <div id="maintenanceStats" class="stats-grid" style="margin-bottom: 20px;">
      <div class="loading"><div class="spinner"></div></div>
    </div>
    
    <div class="card">
      <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
          <button class="btn btn-sm ${currentMaintenanceTab === 'pending' ? 'btn-primary' : 'btn-secondary'}" onclick="switchMaintenanceTab('pending')">Pendientes</button>
          <button class="btn btn-sm ${currentMaintenanceTab === 'in_progress' ? 'btn-primary' : 'btn-secondary'}" onclick="switchMaintenanceTab('in_progress')">En Curso</button>
          <button class="btn btn-sm ${currentMaintenanceTab === 'completed' ? 'btn-primary' : 'btn-secondary'}" onclick="switchMaintenanceTab('completed')">Completados</button>
          <button class="btn btn-sm ${currentMaintenanceTab === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="switchMaintenanceTab('all')">Todos</button>
        </div>
        <select class="filter-select" id="maintenanceTypeFilter" onchange="filterMaintenance()" style="min-width: 150px;">
          <option value="">Todos los tipos</option>
          <option value="repair">Reparación</option>
          <option value="scheduled_km">Programado (KM)</option>
          <option value="scheduled_days">Programado (Días)</option>
        </select>
      </div>
      <div id="maintenanceList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  
  await loadMaintenanceData();
}

async function loadMaintenanceData() {
  try {
    const agencyId = currentUser.role === 'admin' ? null : currentUser.agency_id;
    
    // Charger stats
    maintenanceStats = await maintenanceAPI.getStats(agencyId);
    renderMaintenanceStats();
    
    // Charger liste
    const params = {};
    if (agencyId) params.agency_id = agencyId;
    if (currentMaintenanceTab !== 'all') params.status = currentMaintenanceTab;
    
    maintenanceRecords = await maintenanceAPI.getAll(params);
    renderMaintenanceList();
  } catch (e) {
    console.error(e);
    showToast('Error al cargar datos de mantenimiento', 'error');
  }
}

function renderMaintenanceStats() {
  const stats = maintenanceStats;
  document.getElementById('maintenanceStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon danger">🔴</div>
      <div class="stat-info">
        <h3>${stats.pending || 0}</h3>
        <p>Pendientes</p>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon warning">🟡</div>
      <div class="stat-info">
        <h3>${stats.in_progress || 0}</h3>
        <p>En Curso</p>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon success">🟢</div>
      <div class="stat-info">
        <h3>${stats.completed || 0}</h3>
        <p>Completados</p>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon info">⚠️</div>
      <div class="stat-info">
        <h3>${stats.high_priority || 0}</h3>
        <p>Alta Prioridad</p>
      </div>
    </div>
  `;
}

function renderMaintenanceList() {
  const typeFilter = document.getElementById('maintenanceTypeFilter')?.value || '';
  let filtered = maintenanceRecords;
  
  if (typeFilter) {
    filtered = filtered.filter(m => m.type === typeFilter);
  }
  
  if (filtered.length === 0) {
    document.getElementById('maintenanceList').innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align: center;">
        <h3>No hay tickets de mantenimiento</h3>
        <p style="color: var(--text-secondary);">Los tickets aparecerán aquí cuando se detecten problemas en los check-outs</p>
      </div>
    `;
    return;
  }
  
  document.getElementById('maintenanceList').innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Vehículo</th>
            <th>Tipo</th>
            <th>Descripción</th>
            <th>Prioridad</th>
            <th>Reportado</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(m => `
            <tr>
              <td>
                <strong>${m.vehicle_code || '-'}</strong>
                <br><small style="color: var(--text-secondary);">${m.brand || ''} ${m.model || ''}</small>
              </td>
              <td>${getMaintenanceTypeBadge(m.type)}</td>
              <td style="max-width: 250px;">
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${m.description || ''}">
                  ${m.description || '-'}
                </div>
                ${m.contract_number ? `<small style="color: var(--text-secondary);">Contrato: ${m.contract_number}</small>` : ''}
              </td>
              <td>${getPriorityBadge(m.priority)}</td>
              <td>
                ${formatDateShort(m.reported_at)}
                <br><small style="color: var(--text-secondary);">${m.reported_by_name || ''}</small>
              </td>
              <td>${getMaintenanceStatusBadge(m.status)}</td>
              <td>
                <div class="btn-group">
                  ${m.status === 'pending' ? `
                    <button class="btn btn-sm btn-warning" onclick="startMaintenance(${m.id})" title="Iniciar">Iniciar</button>
                  ` : ''}
                  ${m.status === 'in_progress' ? `
                    <button class="btn btn-sm btn-success" onclick="completeMaintenance(${m.id})" title="Completar">Completar</button>
                  ` : ''}
                  <button class="btn btn-sm btn-secondary" onclick="showMaintenanceDetails(${m.id})" title="Ver">Ver</button>
                  ${m.status !== 'completed' ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteMaintenance(${m.id})" title="Eliminar">X</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getMaintenanceTypeBadge(type) {
  const types = {
    'repair': '<span class="badge badge-danger">Reparación</span>',
    'scheduled_km': '<span class="badge badge-info">Progr. KM</span>',
    'scheduled_days': '<span class="badge badge-info">Progr. Días</span>'
  };
  return types[type] || `<span class="badge badge-secondary">${type}</span>`;
}

function getPriorityBadge(priority) {
  const priorities = {
    'high': '<span class="badge badge-danger">Alta</span>',
    'normal': '<span class="badge badge-warning">Normal</span>',
    'low': '<span class="badge badge-secondary">Baja</span>'
  };
  return priorities[priority] || priorities['normal'];
}

function getMaintenanceStatusBadge(status) {
  const statuses = {
    'pending': '<span class="badge badge-danger">Pendiente</span>',
    'in_progress': '<span class="badge badge-warning">En Curso</span>',
    'completed': '<span class="badge badge-success">Completado</span>'
  };
  return statuses[status] || `<span class="badge badge-secondary">${status}</span>`;
}

function switchMaintenanceTab(tab) {
  currentMaintenanceTab = tab;
  document.querySelectorAll('.card-header .btn-sm').forEach(btn => {
    btn.className = `btn btn-sm ${btn.textContent.toLowerCase().includes(tab.substring(0, 4)) || (tab === 'all' && btn.textContent === 'Todos') ? 'btn-primary' : 'btn-secondary'}`;
  });
  loadMaintenanceData();
}

function filterMaintenance() {
  renderMaintenanceList();
}

async function startMaintenance(id) {
  if (!confirm('¿Iniciar este trabajo de mantenimiento?')) return;
  try {
    await maintenanceAPI.update(id, { status: 'in_progress' });
    showToast('Mantenimiento iniciado', 'success');
    loadMaintenanceData();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function completeMaintenance(id) {
  openModal('Completar Mantenimiento', `
    <form id="completeMaintenanceForm">
      <div class="form-group">
        <label>Notas de la reparación</label>
        <textarea id="maintenanceNotes" class="form-control" rows="3" placeholder="Descripción del trabajo realizado..."></textarea>
      </div>
      <div class="form-group">
        <label>Coste (€)</label>
        <input type="number" id="maintenanceCost" class="form-control" min="0" step="0.01" value="0">
      </div>
      <div class="form-group">
        <label>Piezas utilizadas</label>
        <input type="text" id="maintenanceParts" class="form-control" placeholder="Ej: Cámara, pastillas de freno...">
      </div>
    </form>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-success" onclick="confirmCompleteMaintenance(${id})">Completar</button>
  `);
}

async function confirmCompleteMaintenance(id) {
  const notes = document.getElementById('maintenanceNotes').value;
  const cost = parseFloat(document.getElementById('maintenanceCost').value) || 0;
  const parts = document.getElementById('maintenanceParts').value;
  
  try {
    await maintenanceAPI.update(id, { 
      status: 'completed',
      notes: notes,
      cost: cost,
      parts_used: parts
    });
    closeModal();
    showToast('Mantenimiento completado - Vehículo disponible', 'success');
    loadMaintenanceData();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteMaintenance(id) {
  if (!confirm('¿Eliminar este ticket de mantenimiento?')) return;
  try {
    await maintenanceAPI.delete(id);
    showToast('Ticket eliminado', 'success');
    loadMaintenanceData();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function showMaintenanceDetails(id) {
  const m = maintenanceRecords.find(r => r.id === id);
  if (!m) return;
  
  openModal('Detalle Mantenimiento', `
    <div style="display: grid; gap: 15px;">
      <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0;">${m.vehicle_code} - ${m.brand || ''} ${m.model || ''}</h4>
        ${m.license_plate ? `<p style="margin: 0; color: var(--text-secondary);">Matrícula: ${m.license_plate}</p>` : ''}
        ${m.current_km ? `<p style="margin: 5px 0 0 0; color: var(--text-secondary);">KM: ${m.current_km.toLocaleString()}</p>` : ''}
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Tipo</label>
          <div>${getMaintenanceTypeBadge(m.type)}</div>
        </div>
        <div class="form-group">
          <label>Prioridad</label>
          <div>${getPriorityBadge(m.priority)}</div>
        </div>
        <div class="form-group">
          <label>Estado</label>
          <div>${getMaintenanceStatusBadge(m.status)}</div>
        </div>
      </div>
      
      <div class="form-group">
        <label>Descripción</label>
        <p style="background: var(--bg-input); padding: 10px; border-radius: 6px; margin: 0;">${m.description || '-'}</p>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Reportado</label>
          <p style="margin: 0;">${formatDate(m.reported_at)}<br><small>${m.reported_by_name || ''}</small></p>
        </div>
        ${m.completed_at ? `
          <div class="form-group">
            <label>Completado</label>
            <p style="margin: 0;">${formatDate(m.completed_at)}<br><small>${m.completed_by_name || ''}</small></p>
          </div>
        ` : ''}
      </div>
      
      ${m.notes ? `
        <div class="form-group">
          <label>Notas de reparación</label>
          <p style="background: var(--bg-input); padding: 10px; border-radius: 6px; margin: 0;">${m.notes}</p>
        </div>
      ` : ''}
      
      ${m.cost > 0 ? `
        <div class="form-group">
          <label>Coste</label>
          <p style="margin: 0; font-size: 1.2rem; color: var(--warning);">${m.cost.toFixed(2)} €</p>
        </div>
      ` : ''}
      
      ${m.contract_number ? `
        <div class="form-group">
          <label>Contrato relacionado</label>
          <p style="margin: 0;">${m.contract_number}</p>
        </div>
      ` : ''}
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
    <button class="btn btn-info" onclick="showVehicleHistory(${m.vehicle_id})">Ver Historial</button>
  `);
}

async function showVehicleHistory(vehicleId) {
  try {
    const history = await maintenanceAPI.getVehicleHistory(vehicleId);
    
    const historyHtml = history.length === 0 
      ? '<p style="text-align: center; color: var(--text-secondary);">No hay historial</p>'
      : `<div class="table-container" style="max-height: 400px; overflow-y: auto;">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Coste</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(h => `
                <tr>
                  <td>${formatDateShort(h.reported_at)}</td>
                  <td>${getMaintenanceTypeBadge(h.type)}</td>
                  <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h.description || '-'}</td>
                  <td>${getMaintenanceStatusBadge(h.status)}</td>
                  <td>${h.cost ? h.cost.toFixed(2) + '€' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    
    openModal('Historial del Vehículo', historyHtml, `
      <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
    `);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function showNewMaintenanceModal() {
  // Charger la liste des véhicules
  try {
    const vehicles = await vehiclesAPI.getAll({});
    
    openModal('Nuevo Ticket de Mantenimiento', `
      <form id="newMaintenanceForm">
        <div class="form-group">
          <label>Vehículo *</label>
          <select id="maintenanceVehicle" class="form-control" required>
            <option value="">Seleccionar vehículo</option>
            ${vehicles.map(v => `<option value="${v.id}">${v.code} - ${v.brand || ''} ${v.model || ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Tipo *</label>
            <select id="maintenanceType" class="form-control" required>
              <option value="repair">Reparación</option>
              <option value="scheduled_km">Programado (KM)</option>
              <option value="scheduled_days">Programado (Días)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Prioridad</label>
            <select id="maintenancePriority" class="form-control">
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Descripción *</label>
          <textarea id="maintenanceDescription" class="form-control" rows="3" required placeholder="Describe el problema o trabajo a realizar..."></textarea>
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="createMaintenance()">Crear Ticket</button>
    `);
  } catch (e) {
    showToast('Error al cargar vehículos', 'error');
  }
}

async function createMaintenance() {
  const vehicleId = document.getElementById('maintenanceVehicle').value;
  const type = document.getElementById('maintenanceType').value;
  const priority = document.getElementById('maintenancePriority').value;
  const description = document.getElementById('maintenanceDescription').value;
  
  if (!vehicleId || !description) {
    alert('Por favor, complete todos los campos obligatorios');
    return;
  }
  
  try {
    await maintenanceAPI.create({
      vehicle_id: vehicleId,
      type: type,
      priority: priority,
      description: description
    });
    closeModal();
    showToast('Ticket de mantenimiento creado', 'success');
    loadMaintenanceData();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
