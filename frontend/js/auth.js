import { api, setToken, showToast } from './api.js';

let currentUser = null;
const authListeners = [];

const DEMO_CREDENTIALS = {
  viewer: 'viewer123',
  reporter: 'reporter123',
  tech: 'tech123',
  admin: 'admin123'
};

export function getCurrentUser() {
  return currentUser;
}

export function onAuthChange(callback) {
  authListeners.push(callback);
}

function notifyAuthChange() {
  for (const cb of authListeners) {
    try {
      cb(currentUser);
    } catch (e) {
      console.error('Auth change callback error:', e);
    }
  }
}

/**
 * Switch persona by logging in as that demo user
 */
export async function switchPersona(username) {
  const password = DEMO_CREDENTIALS[username];
  if (!password) {
    throw new Error(`Unknown persona: ${username}`);
  }

  try {
    const res = await api.login(username, password);
    setToken(res.token);
    currentUser = res.user;

    // Update select element if present
    const select = document.getElementById('persona-select');
    if (select && select.value !== username) {
      select.value = username;
    }

    showToast(`Switched persona to ${currentUser.fullName} (${currentUser.role.toUpperCase()})`, 'info');
    notifyAuthChange();
    return currentUser;
  } catch (err) {
    showToast(`Failed to switch persona: ${err.message}`, 'error');
    throw err;
  }
}

/**
 * Initialize authentication on app launch
 */
export async function initAuth() {
  try {
    const me = await api.getMe();
    if (me.authenticated && me.user) {
      currentUser = me.user;
      const select = document.getElementById('persona-select');
      if (select) select.value = currentUser.username;
      notifyAuthChange();
      return currentUser;
    }
  } catch (e) {
    // Ignore, fall through to default login
  }

  // Default to reporter for friendly initial experience
  return switchPersona('reporter');
}
