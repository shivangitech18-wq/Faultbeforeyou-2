import { api } from '../api.js';

export async function renderDashboard(container, router) {
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <p>Loading real-time equipment status...</p>
    </div>
  `;

  try {
    const [metrics, equipmentList, notifications] = await Promise.all([
      api.getMetrics(),
      api.getEquipment(),
      api.getNotifications()
    ]);

    // Check for out-of-service equipment to construct prominent warning banner
    const outOfServiceItems = equipmentList.filter(e => e.status === 'out_of_service');

    let warningBannerHtml = '';
    if (outOfServiceItems.length > 0) {
      const topAlert = outOfServiceItems[0];
      warningBannerHtml = `
        <div class="active-warning-banner">
          <div class="banner-content">
            <div class="banner-icon">⚠️</div>
            <div>
              <div class="banner-title">
                ACTIVE EQUIPMENT WARNING: ${topAlert.name} (${topAlert.id})
                <span class="banner-badge">OUT OF SERVICE</span>
              </div>
              <div class="banner-message">
                <strong>Fault Encountered:</strong> "${topAlert.active_fault_description || 'Unresolved hardware/supplies issue reported'}"
                <br>
                <span style="color: var(--text-secondary); font-size: 0.8rem;">
                  Someone has already reported this fault. Please avoid using this unit until recovery is verified by authorized staff.
                </span>
              </div>
            </div>
          </div>
          <button class="banner-action-btn" id="banner-inspect-btn" data-id="${topAlert.id}">
            Inspect Equipment & Recovery →
          </button>
        </div>
      `;
    }

    container.innerHTML = `
      <!-- Active Out-of-Service Warning Banner -->
      ${warningBannerHtml}

      <!-- Metrics Row -->
      <section class="metrics-grid">
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Total Equipment</span>
            <span class="metric-icon">📦</span>
          </div>
          <div class="metric-value">${metrics.totalEquipment}</div>
          <div class="metric-caption">Simulated shared lab units</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Available Now</span>
            <span class="metric-icon">🟢</span>
          </div>
          <div class="metric-value available">${metrics.availableEquipment}</div>
          <div class="metric-caption">Ready for immediate use</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Out of Service</span>
            <span class="metric-icon">🔴</span>
          </div>
          <div class="metric-value out-of-service">${metrics.outOfServiceEquipment}</div>
          <div class="metric-caption">Unresolved reported faults</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Open Incidents</span>
            <span class="metric-icon">⚡</span>
          </div>
          <div class="metric-value open-incidents">${metrics.openIncidents}</div>
          <div class="metric-caption">Active repair workflows</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Resolved Today</span>
            <span class="metric-icon">✅</span>
          </div>
          <div class="metric-value resolved-today">${metrics.resolvedToday}</div>
          <div class="metric-caption">Human-verified recoveries</div>
        </div>
      </section>

      <!-- Equipment Section Toolbar -->
      <section class="section-toolbar">
        <div class="search-filter-group">
          <div class="search-box">
            <svg class="search-icon-svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input type="text" id="equipment-search" placeholder="Search equipment by ID, name, location..." />
          </div>

          <select class="filter-select" id="filter-status">
            <option value="all">All Statuses</option>
            <option value="available">Available Only</option>
            <option value="out_of_service">Out of Service Only</option>
          </select>

          <select class="filter-select" id="filter-type">
            <option value="all">All Types</option>
            <option value="printer">Printers</option>
            <option value="projector">Projectors</option>
            <option value="desktop">Desktops</option>
            <option value="scanner">Scanners</option>
          </select>
        </div>

        <button class="btn btn-primary" id="dashboard-report-btn">
          <span>⚠️</span> Report Equipment Fault
        </button>
      </section>

      <!-- Equipment Card Grid -->
      <section class="equipment-grid" id="equipment-grid-container">
        ${renderEquipmentCards(equipmentList)}
      </section>

      <!-- Recent System Activity Log -->
      <section style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-top: 1rem;">
        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>📢</span> Real-Time Equipment Warning Broadcasts
        </h3>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${notifications.slice(0, 5).map(n => `
            <div style="padding: 0.75rem 1rem; background: var(--bg-input); border-radius: var(--radius-md); border-left: 3px solid ${n.type === 'warning' ? '#EF4444' : n.type === 'success' ? '#10B981' : '#38BDF8'}; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #FFFFFF; font-size: 0.85rem;">${n.title}</strong>
                <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.15rem;">${n.message}</p>
              </div>
              <span style="font-size: 0.72rem; color: var(--text-muted); white-space: nowrap;">
                ${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          `).join('')}
        </div>
      </section>
    `;

    // Event Listeners
    if (document.getElementById('banner-inspect-btn')) {
      document.getElementById('banner-inspect-btn').addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        router.navigate(`equipment/${id}`);
      });
    }

    document.getElementById('dashboard-report-btn').addEventListener('click', () => {
      router.navigate('report');
    });

    // Real-time filtering
    const searchInput = document.getElementById('equipment-search');
    const statusSelect = document.getElementById('filter-status');
    const typeSelect = document.getElementById('filter-type');

    function applyFilters() {
      const q = searchInput.value.toLowerCase();
      const statusFilter = statusSelect.value;
      const typeFilter = typeSelect.value;

      const filtered = equipmentList.filter(eq => {
        const matchesQuery = !q ||
          eq.id.toLowerCase().includes(q) ||
          eq.name.toLowerCase().includes(q) ||
          eq.location.toLowerCase().includes(q) ||
          (eq.model_number && eq.model_number.toLowerCase().includes(q));

        const matchesStatus = statusFilter === 'all' || eq.status === statusFilter;
        const matchesType = typeFilter === 'all' || eq.type === typeFilter;

        return matchesQuery && matchesStatus && matchesType;
      });

      document.getElementById('equipment-grid-container').innerHTML = renderEquipmentCards(filtered);
      attachCardListeners(router);
    }

    searchInput.addEventListener('input', applyFilters);
    statusSelect.addEventListener('change', applyFilters);
    typeSelect.addEventListener('change', applyFilters);

    attachCardListeners(router);

  } catch (err) {
    container.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--status-out-service-border); border-radius: var(--radius-md); padding: 2rem; text-align: center;">
        <h3 style="color: #F87171; margin-bottom: 0.5rem;">Failed to Load Dashboard</h3>
        <p style="color: var(--text-secondary);">${err.message}</p>
        <button class="btn btn-outline" style="margin-top: 1rem;" onclick="location.reload()">Retry Connection</button>
      </div>
    `;
  }
}

function renderEquipmentCards(items) {
  if (items.length === 0) {
    return `
      <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg);">
        No equipment found matching your search criteria.
      </div>
    `;
  }

  return items.map(eq => {
    const isOut = eq.status === 'out_of_service';
    const statusClass = isOut ? 'out_of_service' : 'available';
    const statusLabel = isOut ? 'Out of Service' : 'Available';

    let icon = '🖨️';
    if (eq.type === 'projector') icon = '📽️';
    if (eq.type === 'desktop') icon = '🖥️';
    if (eq.type === 'scanner') icon = '📄';

    let alertBox = '';
    if (isOut && eq.active_fault_description) {
      alertBox = `
        <div class="card-alert-box">
          <div class="card-alert-title">
            <span>⚠️</span> Active Unresolved Fault
          </div>
          <div class="card-alert-desc">
            "${eq.active_fault_description}"
          </div>
        </div>
      `;
    }

    return `
      <div class="equipment-card ${isOut ? 'out-of-service' : ''}">
        <div>
          <div class="card-top">
            <span class="equipment-id-badge">${eq.id}</span>
            <span class="status-pill ${statusClass}">
              <span class="status-dot-indicator"></span>
              ${statusLabel}
            </span>
          </div>

          <h3 class="equipment-name">${icon} ${eq.name}</h3>

          <div class="equipment-meta">
            <div class="meta-row">
              <span style="color: var(--text-muted);">📍 Location:</span>
              <span>${eq.location}</span>
            </div>
            <div class="meta-row">
              <span style="color: var(--text-muted);">⚙️ Model:</span>
              <span>${eq.model_number || 'Standard Unit'}</span>
            </div>
          </div>

          ${alertBox}
        </div>

        <div class="card-actions">
          <button class="btn btn-outline btn-sm card-btn-details" data-id="${eq.id}" style="flex: 1;">
            View Details
          </button>
          <button class="btn btn-outline btn-sm card-btn-troubleshoot" data-id="${eq.id}" data-type="${eq.type}" title="Grounded Manual Troubleshooting">
            📖 Manual
          </button>
          ${isOut ? `
            <button class="btn btn-danger btn-sm card-btn-incident" data-inc="${eq.active_incident_id}">
              Inspect Incident
            </button>
          ` : `
            <button class="btn btn-primary btn-sm card-btn-report" data-id="${eq.id}">
              Report Fault
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function attachCardListeners(router) {
  document.querySelectorAll('.card-btn-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      router.navigate(`equipment/${id}`);
    });
  });

  document.querySelectorAll('.card-btn-report').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      router.navigate(`report?equipmentId=${id}`);
    });
  });

  document.querySelectorAll('.card-btn-incident').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const incId = e.currentTarget.getAttribute('data-inc');
      router.navigate(`incidents?id=${incId}`);
    });
  });

  document.querySelectorAll('.card-btn-troubleshoot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const type = e.currentTarget.getAttribute('data-type');
      router.navigate(`troubleshoot?equipmentId=${id}&type=${type}`);
    });
  });
}
