import { initAuth, onAuthChange, switchPersona } from './auth.js';
import { api } from './api.js';

// Views
import { renderDashboard } from './views/dashboardView.js';
import { renderEquipmentDetail } from './views/equipmentDetailView.js';
import { renderReportFault } from './views/reportFaultView.js';
import { renderIncidentManagement } from './views/incidentManagementView.js';
import { renderTroubleshooting } from './views/troubleshootingView.js';
import { renderHistory } from './views/historyView.js';

class AppRouter {
  constructor() {
    this.appRoot = document.getElementById('app-root');
    this.currentRoute = 'dashboard';
  }

  init() {
    // Listen for hash change
    window.addEventListener('hashchange', () => this.handleRoute());

    // Navigation tab buttons
    document.querySelectorAll('#main-nav .nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        this.navigate(view);
      });
    });

    // Brand click
    document.getElementById('nav-brand').addEventListener('click', (e) => {
      e.preventDefault();
      this.navigate('dashboard');
    });

    // Persona switcher dropdown
    const personaSelect = document.getElementById('persona-select');
    if (personaSelect) {
      personaSelect.addEventListener('change', async (e) => {
        await switchPersona(e.target.value);
      });
    }

    // Initial route handling
    this.handleRoute();
  }

  navigate(path, force = false) {
    if (window.location.hash.slice(1) === path && !force) {
      this.handleRoute();
    } else {
      window.location.hash = path;
    }
  }

  updateNavTabs(activeTabName) {
    document.querySelectorAll('#main-nav .nav-tab-btn').forEach(btn => {
      const view = btn.getAttribute('data-view');
      if (view === activeTabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  parseHash() {
    const raw = window.location.hash.slice(1) || 'dashboard';
    const [pathPart, queryPart] = raw.split('?');
    const queryParams = {};

    if (queryPart) {
      const pairs = queryPart.split('&');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }

    return { path: pathPart, query: queryParams };
  }

  async handleRoute() {
    const { path, query } = this.parseHash();
    this.currentRoute = path;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Route matching
    if (path === 'dashboard' || path === '') {
      this.updateNavTabs('dashboard');
      await renderDashboard(this.appRoot, this);
    } else if (path.startsWith('equipment/')) {
      const equipmentId = path.split('/')[1];
      this.updateNavTabs('dashboard');
      await renderEquipmentDetail(this.appRoot, equipmentId, this);
    } else if (path === 'report') {
      this.updateNavTabs('report');
      await renderReportFault(this.appRoot, this, query);
    } else if (path === 'incidents') {
      this.updateNavTabs('incidents');
      await renderIncidentManagement(this.appRoot, this, query);
    } else if (path === 'troubleshoot') {
      this.updateNavTabs('troubleshoot');
      await renderTroubleshooting(this.appRoot, this, query);
    } else if (path === 'history') {
      this.updateNavTabs('history');
      await renderHistory(this.appRoot, this);
    } else {
      this.updateNavTabs('dashboard');
      await renderDashboard(this.appRoot, this);
    }
  }
}

// Check and update AI status indicator in header
async function checkAiStatus() {
  const dot = document.getElementById('ai-dot');
  const text = document.getElementById('ai-status-text');
  const pill = document.getElementById('ai-status-indicator');

  try {
    const status = await api.getAiStatus();
    if (status.configured) {
      dot.className = 'ai-status-dot';
      text.textContent = `Gemma 4: Active (${status.model})`;
      pill.title = status.message;
    } else {
      dot.className = 'ai-status-dot unconfigured';
      text.textContent = `Gemma 4: Fallback Mode (${status.model})`;
      pill.title = status.message;
    }
  } catch (err) {
    dot.className = 'ai-status-dot unconfigured';
    text.textContent = 'Gemma 4: Offline';
  }
}

// Application Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  const router = new AppRouter();

  // Re-render when persona changes
  onAuthChange(() => {
    router.handleRoute();
  });

  // Check AI integration status
  await checkAiStatus();

  // Initialize Auth
  await initAuth();

  // Start Router
  router.init();
});
