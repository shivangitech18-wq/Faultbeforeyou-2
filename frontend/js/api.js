/**
 * API client for FaultBeforeYou backend
 */

const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('faultbeforeyou_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('faultbeforeyou_token', token);
  } else {
    localStorage.removeItem('faultbeforeyou_token');
  }
}

export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  getMe: () => request('/auth/me'),
  getDemoUsers: () => request('/auth/demo-users'),

  // Equipment
  getMetrics: () => request('/equipment/metrics'),
  getEquipment: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/equipment${query ? '?' + query : ''}`);
  },
  getEquipmentById: (id) => request(`/equipment/${id}`),
  getEquipmentHistory: (id) => request(`/equipment/${id}/history`),
  getEquipmentAiSummary: (id) => request(`/equipment/${id}/ai-summary`),

  // Incidents
  getIncidents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/incidents${query ? '?' + query : ''}`);
  },
  getIncidentById: (id) => request(`/incidents/${id}`),
  reportFault: (body) => request('/incidents', {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  updateIncident: (id, body) => request(`/incidents/${id}/update`, {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  structureTechnicianNotes: (incidentId, rawNote) => request(`/incidents/${incidentId}/ai-structure-notes`, {
    method: 'POST',
    body: JSON.stringify({ rawNote })
  }),

  // Recovery Verification
  recordVerification: (body) => request('/verification', {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  getVerificationHistory: () => request('/verification/history'),

  // Troubleshooting
  getManuals: () => request('/troubleshoot/manuals'),
  queryTroubleshooting: (body) => request('/troubleshoot/query', {
    method: 'POST',
    body: JSON.stringify(body)
  }),

  // AI Service
  getAiStatus: () => request('/ai/status'),
  classifyFault: (body) => request('/ai/classify', {
    method: 'POST',
    body: JSON.stringify(body)
  }),

  // Notifications
  getNotifications: () => request('/notifications')
};

let cachedAiStatus = null;
export async function getAiModelName() {
  if (!cachedAiStatus) {
    try {
      cachedAiStatus = await api.getAiStatus();
    } catch (e) {
      cachedAiStatus = { model: 'gemma-2-27b-it' };
    }
  }
  return cachedAiStatus?.model || 'gemma-2-27b-it';
}

// UI Toast Notification helper
export function showToast(message, type = 'info', durationMs = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}
