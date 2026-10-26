import { api } from '../api.js';

export async function renderHistory(container, router) {
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <p>Loading historical records & verification audit trail...</p>
    </div>
  `;

  try {
    const [incidents, verifications, equipmentList] = await Promise.all([
      api.getIncidents({ status: 'all' }),
      api.getVerificationHistory(),
      api.getEquipment()
    ]);

    container.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <h2 style="font-size: 1.5rem; font-weight: 800; color: #FFFFFF; display: flex; align-items: center; gap: 0.5rem;">
          <span>📜</span> Equipment Incident & Recovery Audit Trail
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Complete persisted logs of reported equipment faults, technician repairs, and authorized verification test records.
        </p>
      </div>

      <!-- Quick Metrics -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div class="metric-card">
          <div class="metric-title">Total Logged Incidents</div>
          <div class="metric-value">${incidents.length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Resolved Recoveries</div>
          <div class="metric-value available">${incidents.filter(i => i.status === 'resolved').length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Verification Tests Logged</div>
          <div class="metric-value resolved-today">${verifications.length}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Passed Verification Rate</div>
          <div class="metric-value" style="color: #34D399;">
            ${verifications.length > 0 ? Math.round((verifications.filter(v => v.test_result === 'passed').length / verifications.length) * 100) : 100}%
          </div>
        </div>
      </div>

      <!-- Verification Audit Trail Section -->
      <section style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: #FFFFFF; display: flex; align-items: center; gap: 0.4rem;">
              <span>🛡️</span> Recovery Test Verification Log (${verifications.length} Records)
            </h3>
            <p style="font-size: 0.78rem; color: var(--text-muted);">
              Official record of human-verified physical recovery tests.
            </p>
          </div>
        </div>

        ${verifications.length === 0 ? `
          <p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No verification records logged yet.</p>
        ` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Equipment</th>
                  <th>Incident</th>
                  <th>Test Performed</th>
                  <th>Outcome</th>
                  <th>Verifier</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${verifications.map(v => `
                  <tr>
                    <td style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">
                      ${new Date(v.created_at).toLocaleString()}
                    </td>
                    <td>
                      <strong>${v.equipment_id}</strong>
                      <div style="font-size: 0.72rem; color: var(--text-muted);">${v.equipment_name}</div>
                    </td>
                    <td><a href="#incidents?id=${v.incident_id}" style="color: var(--accent-cyan); text-decoration: none; font-weight: 700;">#${v.incident_id}</a></td>
                    <td><strong style="color: #FFFFFF;">${v.test_name}</strong></td>
                    <td>
                      <span class="status-pill ${v.test_result === 'passed' ? 'available' : 'out_of_service'}" style="font-size: 0.72rem;">
                        ${v.test_result.toUpperCase()}
                      </span>
                    </td>
                    <td><strong>${v.verifier_name}</strong></td>
                    <td style="color: var(--text-secondary); font-size: 0.8rem;">${v.notes || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </section>

      <!-- Historical Incidents Table -->
      <section style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #FFFFFF; display: flex; align-items: center; gap: 0.4rem;">
            <span>📋</span> Complete Incident Repository
          </h3>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Equipment</th>
                <th>Category</th>
                <th>Description</th>
                <th>Reporter</th>
                <th>Reported</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${incidents.map(inc => `
                <tr>
                  <td><strong style="font-family: monospace; color: var(--accent-cyan);">#${inc.id}</strong></td>
                  <td><span class="status-pill ${inc.status}">${inc.status.replace('_', ' ')}</span></td>
                  <td>
                    <strong>${inc.equipment_id}</strong>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">${inc.equipment_name}</div>
                  </td>
                  <td>${inc.category || 'Hardware'}</td>
                  <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${inc.description}
                  </td>
                  <td>${inc.reporter_name}</td>
                  <td style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">
                    ${new Date(inc.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button class="btn btn-outline btn-sm btn-inspect-hist" data-id="${inc.id}">
                      Inspect
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;

    document.querySelectorAll('.btn-inspect-hist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        router.navigate(`incidents?id=${id}`);
      });
    });

  } catch (err) {
    container.innerHTML = `
      <div style="padding: 2rem; color: #F87171; text-align: center;">
        Failed to load history: ${err.message}
      </div>
    `;
  }
}
