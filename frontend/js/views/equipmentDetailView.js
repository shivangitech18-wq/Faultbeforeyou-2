import { api, showToast, getAiModelName } from '../api.js';

export async function renderEquipmentDetail(container, equipmentId, router) {
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <p>Loading equipment specifications and incident history for ${equipmentId}...</p>
    </div>
  `;

  try {
    const [detailData, historyData, manuals, activeModel] = await Promise.all([
      api.getEquipmentById(equipmentId),
      api.getEquipmentHistory(equipmentId),
      api.getManuals(),
      getAiModelName()
    ]);

    const eq = detailData.equipment;
    const activeIncident = detailData.activeIncident;
    const isOut = eq.status === 'out_of_service';
    const statusClass = isOut ? 'out_of_service' : 'available';
    const statusLabel = isOut ? 'Out of Service' : 'Available';

    // Filter manuals for this equipment type
    const relevantManuals = manuals.filter(m => m.equipment_type === eq.type);

    container.innerHTML = `
      <!-- Back button -->
      <div style="margin-bottom: 1.25rem;">
        <button class="btn btn-outline btn-sm" id="btn-back-dashboard">
          ← Back to Dashboard
        </button>
      </div>

      <!-- Equipment Profile Header -->
      <section style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.75rem; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.4rem;">
              <span class="equipment-id-badge" style="font-size: 0.9rem; padding: 0.3rem 0.65rem;">${eq.id}</span>
              <span class="status-pill ${statusClass}">
                <span class="status-dot-indicator"></span>
                ${statusLabel}
              </span>
            </div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #FFFFFF;">${eq.name}</h2>
            <div style="display: flex; gap: 1.5rem; color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem; flex-wrap: wrap;">
              <div>📍 <strong>Location:</strong> ${eq.location}</div>
              <div>⚙️ <strong>Model:</strong> ${eq.model_number || 'Standard'}</div>
              <div>🏷️ <strong>Type:</strong> <span style="text-transform: capitalize;">${eq.type}</span></div>
            </div>
          </div>

          <div style="display: flex; gap: 0.65rem;">
            <button class="btn btn-outline" id="btn-manual-troubleshoot">
              📖 View Manual Guidance
            </button>
            ${isOut ? `
              <button class="btn btn-danger" id="btn-view-active-fault">
                ⚠️ View Active Incident
              </button>
            ` : `
              <button class="btn btn-primary" id="btn-report-fault-for-this">
                ⚠️ Report a Fault
              </button>
            `}
          </div>
        </div>

        <!-- Active Fault Alert Box if out of service -->
        ${isOut && activeIncident ? `
          <div style="margin-top: 1.25rem; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--status-out-service-border); border-radius: var(--radius-md); padding: 1rem; border-left: 4px solid var(--status-out-service);">
            <div style="font-weight: 700; color: #FCA5A5; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">
              <span>⚠️</span> ACTIVE UNRESOLVED FAULT (Incident #${activeIncident.id})
            </div>
            <p style="color: #FFFFFF; font-size: 0.88rem; margin-bottom: 0.5rem;">
              <strong>Reported Issue:</strong> "${activeIncident.description}"
            </p>
            <div style="display: flex; gap: 1rem; font-size: 0.78rem; color: var(--text-secondary);">
              <span>Category: <strong>${activeIncident.category || 'Hardware'}</strong></span>
              <span>Severity: <strong>${activeIncident.severity || 'Medium'}</strong></span>
              <span>Reported: <strong>${new Date(activeIncident.created_at).toLocaleString()}</strong> by ${activeIncident.reporter_name}</span>
            </div>
          </div>
        ` : ''}
      </section>

      <!-- GEMMA FEATURE C: Incident Intelligence Card -->
      <section style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: var(--radius-lg); padding: 1.75rem; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="ai-badge">⚡ Gemma Incident Intelligence</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Grounding model: ${activeModel}</span>
            </div>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #FFFFFF;">
              Historical Pattern Analysis & Recovery Intelligence
            </h3>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-refresh-ai-summary">
            🔄 Refresh Gemma Analytics
          </button>
        </div>

        <div id="ai-intelligence-container">
          <div style="text-align: center; padding: 1.5rem; color: var(--text-secondary);">
            <p>Click "Run Gemma 4 Analysis" or wait for initial synthesis...</p>
          </div>
        </div>
      </section>

      <!-- Grid: Approved Demonstration Manuals & Specifications -->
      <section style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>📖</span> Approved Ground Truth Manual Passages (${relevantManuals.length} Available)
        </h3>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
          Gemma 4 troubleshooting instructions are strictly grounded in these manufacturer-approved passages:
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          ${relevantManuals.map(m => `
            <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <span style="font-family: monospace; font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700;">
                  ${m.section_number}
                </span>
                <span style="font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: var(--radius-sm); ${m.is_user_safe ? 'background: rgba(16, 185, 129, 0.15); color: #34D399;' : 'background: rgba(239, 68, 68, 0.15); color: #F87171;'}">
                  ${m.is_user_safe ? 'User-Safe' : 'Technician Only'}
                </span>
              </div>
              <h4 style="font-size: 0.9rem; font-weight: 700; color: #FFFFFF; margin-bottom: 0.4rem;">
                ${m.title}
              </h4>
              <p style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4;">
                ${m.content}
              </p>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Incident History Table -->
      <section style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>📜</span> Recorded Incidents History (${historyData.incidents.length} total)
        </h3>

        ${historyData.incidents.length === 0 ? `
          <p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No incidents recorded for this equipment yet.</p>
        ` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Fault Description</th>
                  <th>Reporter</th>
                  <th>Created</th>
                  <th>Technician Action</th>
                </tr>
              </thead>
              <tbody>
                ${historyData.incidents.map(inc => `
                  <tr>
                    <td><strong>#${inc.id}</strong></td>
                    <td>
                      <span class="status-pill ${inc.status}">
                        ${inc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>${inc.category || 'N/A'}</td>
                    <td>${inc.description}</td>
                    <td>${inc.reporter_name}</td>
                    <td>${new Date(inc.created_at).toLocaleDateString()}</td>
                    <td style="color: var(--text-secondary); font-size: 0.8rem;">
                      ${inc.technician_note || '—'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </section>

      <!-- Status Change Audit Trail -->
      <section style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>🛡️</span> Equipment Availability & Recovery Audit Trail
        </h3>

        ${historyData.statusHistory.length === 0 ? `
          <p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No status changes recorded.</p>
        ` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Transition</th>
                  <th>Authorized User</th>
                  <th>Grounds / Reason</th>
                </tr>
              </thead>
              <tbody>
                ${historyData.statusHistory.map(sh => `
                  <tr>
                    <td style="font-size: 0.78rem; color: var(--text-muted);">${new Date(sh.created_at).toLocaleString()}</td>
                    <td>
                      <span style="font-family: monospace; font-size: 0.8rem;">
                        ${sh.previous_status} → <strong style="color: ${sh.new_status === 'available' ? '#34D399' : '#F87171'}">${sh.new_status}</strong>
                      </span>
                    </td>
                    <td><strong>${sh.changed_by_name}</strong></td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary);">${sh.reason}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </section>
    `;

    // Load AI Incident Intelligence
    loadAiSummary(equipmentId);

    // Event handlers
    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
      router.navigate('dashboard');
    });

    document.getElementById('btn-refresh-ai-summary').addEventListener('click', () => {
      loadAiSummary(equipmentId);
    });

    document.getElementById('btn-manual-troubleshoot').addEventListener('click', () => {
      router.navigate(`troubleshoot?equipmentId=${eq.id}&type=${eq.type}`);
    });

    if (document.getElementById('btn-report-fault-for-this')) {
      document.getElementById('btn-report-fault-for-this').addEventListener('click', () => {
        router.navigate(`report?equipmentId=${eq.id}`);
      });
    }

    if (document.getElementById('btn-view-active-fault')) {
      document.getElementById('btn-view-active-fault').addEventListener('click', () => {
        router.navigate(`incidents?id=${activeIncident.id}`);
      });
    }

  } catch (err) {
    container.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--status-out-service-border); border-radius: var(--radius-md); padding: 2rem; text-align: center;">
        <h3 style="color: #F87171; margin-bottom: 0.5rem;">Error Loading Equipment Details</h3>
        <p style="color: var(--text-secondary);">${err.message}</p>
        <button class="btn btn-outline" style="margin-top: 1rem;" onclick="location.hash='#dashboard'">Back to Dashboard</button>
      </div>
    `;
  }
}

async function loadAiSummary(equipmentId) {
  const container = document.getElementById('ai-intelligence-container');
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; color: var(--accent-cyan);">
      <span>⏳</span> <em>Gemma 4 is synthesizing historical repair patterns and verified recovery records...</em>
    </div>
  `;

  try {
    const data = await api.getEquipmentAiSummary(equipmentId);
    const ai = data.aiSummary;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
            📊 Recorded History Scope
          </div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #FFFFFF; margin-top: 0.25rem;">
            ${data.incidentCount} Incident(s) | ${data.verificationCount} Test(s)
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem;">
            ${ai.summary}
          </p>
        </div>

        <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
            ✅ Verified Successful Fixes
          </div>
          <div style="margin-top: 0.4rem; display: flex; flex-direction: column; gap: 0.35rem;">
            ${ai.verifiedFixes && ai.verifiedFixes.length > 0 ? ai.verifiedFixes.map(f => `
              <div style="font-size: 0.8rem; color: #34D399; display: flex; align-items: flex-start; gap: 0.3rem;">
                <span>✓</span> <span>${f}</span>
              </div>
            `).join('') : '<span style="font-size: 0.8rem; color: var(--text-muted);">No verified fixes recorded yet.</span>'}
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
            🔍 Common Fault Signatures
          </div>
          <div style="margin-top: 0.4rem; display: flex; flex-wrap: wrap; gap: 0.4rem;">
            ${ai.commonFaults && ai.commonFaults.length > 0 ? ai.commonFaults.map(c => `
              <span style="font-size: 0.75rem; background: var(--bg-input); border: 1px solid var(--border-color); padding: 0.15rem 0.5rem; border-radius: var(--radius-sm); color: var(--accent-blue);">
                ${c}
              </span>
            `).join('') : '<span style="font-size: 0.8rem; color: var(--text-muted);">None</span>'}
          </div>
        </div>
      </div>

      <!-- Factual vs Interpreted Differentiation -->
      <div style="background: rgba(15, 23, 42, 0.4); border-left: 3px solid var(--accent-cyan); padding: 0.85rem 1rem; border-radius: 0 var(--radius-md) var(--radius-md) 0;">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; margin-bottom: 0.2rem;">
          Gemma Trend Synthesis (Distinguished from Raw Database Rows):
        </div>
        <p style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4;">
          ${ai.patternsSupportedByRecords || ai.patterns || 'Records reflect reliable recovery following verified testing.'}
        </p>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div style="color: #F87171; font-size: 0.85rem;">
        Failed to fetch Gemma incident intelligence: ${err.message}
      </div>
    `;
  }
}
