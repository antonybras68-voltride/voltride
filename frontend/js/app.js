// =====================================================
// VOLTRIDE - Application principale
// =====================================================

let currentPage = 'dashboard';
let currentUser = null;
let agencies = [];

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
  
  if (currentUser.role === 'admin') {
    document.getElementById('navUsers').style.display = 'flex';
  }
  
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
    case 'users': renderUsers(container); break;
  }
}

function logout() {
  localStorage.removeItem('voltride_token');
  localStorage.removeItem('voltride_user');
  window.location.href = '/';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
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
            <td><button class="btn btn-sm btn-success" onclick="showReturnModal(${r.id})">${t('returnVehicle')}</button></td>
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
  container.innerHTML = `
    <div class="page-header"><h1>${t('vehicles')}</h1></div>
    <div class="card">
      <div class="card-header">
        <div class="filters-bar" style="margin:0;flex:1;">
          <div class="search-box"><span class="search-icon">🔍</span><input type="text" id="vehicleSearch" placeholder="${t('search')}..." onkeyup="filterVehicles()"></div>
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
    const vehicles = await vehiclesAPI.getAll({ agency_id: currentUser.agency_id });
    window.vehiclesData = vehicles;
    renderVehiclesTable(vehicles);
  } catch (e) { console.error(e); showToast(t('errorOccurred'), 'error'); }
}

function renderVehiclesTable(vehicles) {
  if (!vehicles.length) {
    document.getElementById('vehiclesList').innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚲</div><h3>${t('noResults')}</h3></div>`;
    return;
  }
  document.getElementById('vehiclesList').innerHTML = `
    <div class="table-container"><table><thead><tr>
      <th>${t('vehicleCode')}</th><th>${t('vehicleType')}</th><th>${t('brand')}</th><th>${t('dailyRate')}</th><th>${t('status')}</th><th></th>
    </tr></thead><tbody>
      ${vehicles.map(v => `<tr>
        <td><strong>${v.code}</strong></td>
        <td>${getVehicleTypeIcon(v.type)} ${t(v.type)}</td>
        <td>${v.brand || '-'} ${v.model || ''}</td>
        <td>${formatCurrency(v.daily_rate)}</td>
        <td>${getStatusBadge(v.status)}</td>
        <td><div class="btn-group">
          <button class="btn btn-sm btn-secondary" onclick="showVehicleModal(${v.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteVehicle(${v.id})">🗑️</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>
  `;
}

function filterVehicles() {
  const search = document.getElementById('vehicleSearch').value.toLowerCase();
  const status = document.getElementById('vehicleStatusFilter').value;
  let filtered = window.vehiclesData || [];
  if (search) filtered = filtered.filter(v => v.code.toLowerCase().includes(search) || (v.brand||'').toLowerCase().includes(search));
  if (status) filtered = filtered.filter(v => v.status === status);
  renderVehiclesTable(filtered);
}

function showVehicleModal(id = null) {
  openModal(id ? t('editVehicle') : t('addVehicle'), `
    <form id="vehicleForm">
      <input type="hidden" id="vehicleId" value="${id||''}">
      <div class="form-row">
        <div class="form-group"><label>${t('vehicleCode')} *</label><input type="text" id="vehicleCode" class="form-control" required></div>
        <div class="form-group"><label>${t('vehicleType')} *</label><select id="vehicleType" class="form-control"><option value="bike">${t('bike')}</option><option value="ebike">${t('ebike')}</option><option value="scooter">${t('scooter')}</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('brand')}</label><input type="text" id="vehicleBrand" class="form-control"></div>
        <div class="form-group"><label>${t('model')}</label><input type="text" id="vehicleModel" class="form-control"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('dailyRate')} (€) *</label><input type="number" id="vehicleDailyRate" class="form-control" required min="0" step="0.01"></div>
        <div class="form-group"><label>${t('deposit')} (€)</label><input type="number" id="vehicleDeposit" class="form-control" min="0" step="0.01" value="0"></div>
      </div>
      <div class="form-group"><label>${t('status')}</label><select id="vehicleStatus" class="form-control"><option value="available">${t('available')}</option><option value="maintenance">${t('maintenance')}</option></select></div>
    </form>
  `, `<button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary" onclick="saveVehicle()">${t('save')}</button>`);
  if (id) loadVehicleData(id);
}

async function loadVehicleData(id) {
  try {
    const v = await vehiclesAPI.getById(id);
    document.getElementById('vehicleCode').value = v.code;
    document.getElementById('vehicleType').value = v.type;
    document.getElementById('vehicleBrand').value = v.brand || '';
    document.getElementById('vehicleModel').value = v.model || '';
    document.getElementById('vehicleDailyRate').value = v.daily_rate;
    document.getElementById('vehicleDeposit').value = v.deposit || 0;
    document.getElementById('vehicleStatus').value = v.status;
  } catch (e) { console.error(e); }
}

async function saveVehicle() {
  const id = document.getElementById('vehicleId').value;
  const data = {
    code: document.getElementById('vehicleCode').value,
    type: document.getElementById('vehicleType').value,
    brand: document.getElementById('vehicleBrand').value,
    model: document.getElementById('vehicleModel').value,
    daily_rate: parseFloat(document.getElementById('vehicleDailyRate').value),
    deposit: parseFloat(document.getElementById('vehicleDeposit').value) || 0,
    status: document.getElementById('vehicleStatus').value,
    agency_id: currentUser.agency_id
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
      <th>${t('firstName')} ${t('lastName')}</th><th>${t('phone')}</th><th>${t('email')}</th><th>${t('idNumber')}</th><th></th>
    </tr></thead><tbody>
      ${customers.map(c => `<tr>
        <td><strong>${c.first_name} ${c.last_name}</strong></td>
        <td>${c.phone || '-'}</td>
        <td>${c.email || '-'}</td>
        <td>${c.id_number || '-'}</td>
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
        <div class="form-group"><label>${t('idType')}</label><select id="customerIdType" class="form-control"><option value="passport">${t('passport')}</option><option value="dni">${t('dni')}</option><option value="driving_license">${t('drivingLicense')}</option></select></div>
        <div class="form-group"><label>${t('idNumber')}</label><input type="text" id="customerIdNumber" class="form-control"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('country')}</label><input type="text" id="customerCountry" class="form-control"></div>
        <div class="form-group"><label>${t('city')}</label><input type="text" id="customerCity" class="form-control"></div>
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
    city: document.getElementById('customerCity').value
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
        <td>
          ${r.status === 'active' ? `<button class="btn btn-sm btn-success" onclick="showReturnModal(${r.id})">${t('returnVehicle')}</button>` : ''}
        </td>
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
        <button type="button" class="btn btn-sm btn-secondary" style="margin-top:5px;" onclick="closeModal();showCustomerModal();">+ ${t('addCustomer')}</button>
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
      <div class="form-row">
        <div class="form-group"><label>${t('totalAmount')} (€)</label><input type="number" id="rentalTotal" class="form-control" readonly></div>
        <div class="form-group"><label>${t('paymentMethod')}</label><select id="rentalPayment" class="form-control"><option value="cash">${t('cash_method')}</option><option value="card">${t('card')}</option><option value="transfer">${t('transfer')}</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>${t('deposit')} ${t('amountPaid')} (€)</label><input type="number" id="rentalDepositPaid" class="form-control" step="0.01" value="0"></div>
        <div class="form-group"><label>${t('amountPaid')} (€)</label><input type="number" id="rentalAmountPaid" class="form-control" step="0.01" value="0"></div>
      </div>
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
    deposit_paid: parseFloat(document.getElementById('rentalDepositPaid').value) || 0,
    amount_paid: parseFloat(document.getElementById('rentalAmountPaid').value) || 0,
    payment_method: document.getElementById('rentalPayment').value
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
      <p><strong>${t('startDate')}:</strong> ${formatDate(rental.start_date)}</p>
      <hr style="border-color:var(--border);margin:15px 0;">
      <div class="form-group"><label>${t('endDate')} *</label><input type="datetime-local" id="returnDate" class="form-control" value="${now}" required></div>
      <div class="form-row">
        <div class="form-group"><label>${t('amountPaid')} (€)</label><input type="number" id="returnAmount" class="form-control" step="0.01" value="0"></div>
        <div class="form-group"><label>${t('paymentMethod')}</label><select id="returnPayment" class="form-control"><option value="cash">${t('cash_method')}</option><option value="card">${t('card')}</option></select></div>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="returnDeposit" checked> Devolver depósito (${formatCurrency(rental.deposit_paid)})</label>
      </div>
    </form>
  `, `<button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-success" onclick="processReturn()">${t('confirm')}</button>`);
}

async function processReturn() {
  const id = document.getElementById('returnRentalId').value;
  const data = {
    end_date: document.getElementById('returnDate').value,
    amount_paid: parseFloat(document.getElementById('returnAmount').value) || 0,
    payment_method: document.getElementById('returnPayment').value,
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
  if (!confirm('¿Generar informe Z y cerrar la caja del día?')) return;
  try {
    await reportsAPI.createZReport({ agency_id: currentUser.agency_id });
    showToast(t('zReportGenerated'), 'success');
    renderCash(document.getElementById('pageContainer'));
  } catch (e) { showToast(e.message, 'error'); }
}

// =====================================================
// Utilisateurs (Admin)
// =====================================================

async function renderUsers(container) {
  if (currentUser.role !== 'admin') { loadPage('dashboard'); return; }
  
  container.innerHTML = `
    <div class="page-header"><h1>${t('users')}</h1></div>
    <div class="card">
      <div class="card-header">
        <h2>${t('usersList')}</h2>
        <button class="btn btn-primary" onclick="showUserModal()">+ ${t('addUser')}</button>
      </div>
      <div id="usersList"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  
  try {
    const users = await authAPI.getUsers();
    document.getElementById('usersList').innerHTML = `
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
    if (id) await authAPI.updateUser(id, data); else await authAPI.createUser(data);
    closeModal(); showToast(t('savedSuccess'), 'success'); renderUsers(document.getElementById('pageContainer'));
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteUser(id) {
  if (!confirm(t('confirmDelete'))) return;
  try { await authAPI.deleteUser(id); showToast(t('deleteSuccess'), 'success'); renderUsers(document.getElementById('pageContainer')); }
  catch (e) { showToast(e.message, 'error'); }
}
