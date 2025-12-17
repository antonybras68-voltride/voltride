// =====================================================
// VOLTRIDE - API Module (v2.0)
// Communication avec le backend
// =====================================================

const API_BASE = '/api';

// Obtenir le token d'authentification
function getToken() {
  return localStorage.getItem('voltride_token');
}

// Obtenir l'utilisateur actuel
function getCurrentUser() {
  const user = localStorage.getItem('voltride_user');
  return user ? JSON.parse(user) : null;
}

// Headers par défaut pour les requêtes
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Gestionnaire d'erreurs
async function handleResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem('voltride_token');
    localStorage.removeItem('voltride_user');
    window.location.href = '/';
    throw new Error('Session expirée');
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue');
  }
  
  return data;
}

// =====================================================
// API - Authentification
// =====================================================

const authAPI = {
  async login(username, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return handleResponse(response);
  },
  
  async getMe() {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async getUsers() {
    const response = await fetch(`${API_BASE}/auth/users`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async createUser(userData) {
    const response = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    return handleResponse(response);
  },
  
  async updateUser(id, userData) {
    const response = await fetch(`${API_BASE}/auth/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    return handleResponse(response);
  },
  
  async deleteUser(id) {
    const response = await fetch(`${API_BASE}/auth/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  }
};

// =====================================================
// API - Véhicules
// =====================================================

const vehiclesAPI = {
  async getAll(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${API_BASE}/vehicles?${queryString}` : `${API_BASE}/vehicles`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async getById(id) {
    const response = await fetch(`${API_BASE}/vehicles/${id}`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async create(vehicleData) {
    const response = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(vehicleData)
    });
    return handleResponse(response);
  },
  
  async update(id, vehicleData) {
    const response = await fetch(`${API_BASE}/vehicles/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(vehicleData)
    });
    return handleResponse(response);
  },
  
  async delete(id) {
    const response = await fetch(`${API_BASE}/vehicles/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async getStats(agencyId) {
    const url = agencyId 
      ? `${API_BASE}/vehicles/stats/summary?agency_id=${agencyId}`
      : `${API_BASE}/vehicles/stats/summary`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  }
};

// =====================================================
// API - Clients
// =====================================================

const customersAPI = {
  async getAll(search = '') {
    const url = search 
      ? `${API_BASE}/customers?search=${encodeURIComponent(search)}`
      : `${API_BASE}/customers`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async getById(id) {
    const response = await fetch(`${API_BASE}/customers/${id}`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async create(customerData) {
    const response = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(customerData)
    });
    return handleResponse(response);
  },
  
  async update(id, customerData) {
    const response = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(customerData)
    });
    return handleResponse(response);
  },
  
  async delete(id) {
    const response = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async getRentals(id) {
    const response = await fetch(`${API_BASE}/customers/${id}/rentals`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  }
};

// =====================================================
// API - Locations
// =====================================================

const rentalsAPI = {
  async getAll(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${API_BASE}/rentals?${queryString}` : `${API_BASE}/rentals`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async getActive(agencyId) {
    const url = agencyId 
      ? `${API_BASE}/rentals/active?agency_id=${agencyId}`
      : `${API_BASE}/rentals/active`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async getById(id) {
    const response = await fetch(`${API_BASE}/rentals/${id}`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async create(rentalData) {
    const response = await fetch(`${API_BASE}/rentals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(rentalData)
    });
    return handleResponse(response);
  },
  
  async update(id, rentalData) {
    const response = await fetch(`${API_BASE}/rentals/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(rentalData)
    });
    return handleResponse(response);
  },
  
  async return(id, returnData) {
    const response = await fetch(`${API_BASE}/rentals/${id}/return`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(returnData)
    });
    return handleResponse(response);
  },
  
  async delete(id) {
    const response = await fetch(`${API_BASE}/rentals/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async addPayment(id, paymentData) {
    const response = await fetch(`${API_BASE}/rentals/${id}/payment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(paymentData)
    });
    return handleResponse(response);
  }
};

// =====================================================
// API - Paiements
// =====================================================

const paymentsAPI = {
  async getAll(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${API_BASE}/payments?${queryString}` : `${API_BASE}/payments`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async getToday(agencyId) {
    const url = agencyId 
      ? `${API_BASE}/payments/today?agency_id=${agencyId}`
      : `${API_BASE}/payments/today`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async getSummary(agencyId, date) {
    let url = `${API_BASE}/payments/summary?`;
    if (agencyId) url += `agency_id=${agencyId}&`;
    if (date) url += `date=${date}`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async create(paymentData) {
    const response = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(paymentData)
    });
    return handleResponse(response);
  }
};

// =====================================================
// API - Agences
// =====================================================

const agenciesAPI = {
  async getAll() {
    const response = await fetch(`${API_BASE}/agencies`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async getById(id) {
    const response = await fetch(`${API_BASE}/agencies/${id}`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async create(agencyData) {
    const response = await fetch(`${API_BASE}/agencies`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(agencyData)
    });
    return handleResponse(response);
  },
  
  async update(id, agencyData) {
    const response = await fetch(`${API_BASE}/agencies/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(agencyData)
    });
    return handleResponse(response);
  },
  
  async delete(id) {
    const response = await fetch(`${API_BASE}/agencies/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },
  
  async getStats(id) {
    const response = await fetch(`${API_BASE}/agencies/${id}/stats`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  }
};

// =====================================================
// API - Rapports
// =====================================================

const reportsAPI = {
  async getDashboard(agencyId) {
    const url = agencyId 
      ? `${API_BASE}/reports/dashboard?agency_id=${agencyId}`
      : `${API_BASE}/reports/dashboard`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async getZReports(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${API_BASE}/reports/z?${queryString}` : `${API_BASE}/reports/z`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async checkZReport(agencyId) {
    const url = agencyId 
      ? `${API_BASE}/reports/z/check?agency_id=${agencyId}`
      : `${API_BASE}/reports/z/check`;
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },
  
  async createZReport(data) {
    const response = await fetch(`${API_BASE}/reports/z`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  }
};
