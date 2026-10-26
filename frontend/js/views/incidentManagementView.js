import { api, showToast, getAiModelName } from '../api.js';
import { getCurrentUser } from '../auth.js';

export async function renderIncidentManagement(container, router, queryParams = {}) {
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <p>Loading incident pipeline and recovery workflows...</p>
    </div>
  `;

  try {
    const [incidents, activeModel] = await Promise.all([
      api.getIncidents(),
      getAiModelName()
    ]);
    const currentUser = getCurrentUser();

    // Determine active incident to view in detail
    let activeIncidentId = queryParams.id ? parseInt(queryParams.id, 10) : null;
    if (!activeIncidentId && incidents.length > 0) {
      // Default to first open incident if available, else first incident
      const firstOpen = incidents.find(i => i.status !== 'resolved');
      activeIncidentId = firstOpen ? firstOpen.id : incidents[0].id;
    }

    let activeDetail = null;
    if (activeIncidentId) {
      try {
        activeDetail = await api.getIncidentById(activeIncidentId);
      } catch (e) {
        console.warn('Could not fetch incident details:', e);
      }
    }

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: #FFFFFF; display: flex; align-items: center; gap: 0.5rem;">
            <span>🔧</span> Incident Recovery Pipeline
          </h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Workflow state machine: <strong style="color: var(--accent-cyan);">Reported → Under Investigation → Awaiting Verification → Resolved</strong>
          </p>
        </div>

        <button class="btn btn-primary" id="btn-pipeline-report">
          <span>⚠️</span> Report New Fault
        </button>
      </div>

      <!-- Main Layout: Incident List / Filter Sidebar + Detail Workspace -->
      <div style="display: grid; grid-template-columns: minmax(300px, 360px) 1fr; gap: 1.5rem; align-items: flex-start;">
        
        <!-- Left: Incident Queue & Filters -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.25rem;">
          <div style="display: flex; gap: 0.35rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm filter-inc-tab active" data-status="all">All (${incidents.length})</button>
            <button class="btn btn-outline btn-sm filter-inc-tab" data-status="open">Open</button>
            <button class="btn btn-outline btn-sm filter-inc-tab" data-status="awaiting_verification">Verify</button>
            <button class="btn btn-outline btn-sm filter-inc-tab" data-status="resolved">Resolved</button>
          </div>

          <div id="incident-list-container" style="display: flex; flex-direction: column; gap: 0.65rem; max-height: 650px; overflow-y: auto;">
            ${renderIncidentList(incidents, activeIncidentId)}
          </div>
        </div>

        <!-- Right: Active Incident Dossier & Action Drawer -->
        <div id="incident-detail-container">
          ${activeDetail ? renderDetailDossier(activeDetail, currentUser, activeModel) : `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 3rem; text-align: center; color: var(--text-muted);">
              Select an incident from the queue to inspect details and recovery actions.
            </div>
          `}
        </div>

      </div>
    `;

    // Event Listeners
    document.getElementById('btn-pipeline-report').addEventListener('click', () => {
      router.navigate('report');
    });

    // Filter tab buttons
    document.querySelectorAll('.filter-inc-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-inc-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const st = e.currentTarget.getAttribute('data-status');

        let filtered = incidents;
        if (st === 'open') {
          filtered = incidents.filter(i => i.status !== 'resolved');
        } else if (st === 'awaiting_verification') {
          filtered = incidents.filter(i => i.status === 'awaiting_verification');
        } else if (st === 'resolved') {
          filtered = incidents.filter(i => i.status === 'resolved');
        }

        document.getElementById('incident-list-container').innerHTML = renderIncidentList(filtered, activeIncidentId);
        attachListListeners(router);
      });
    });

    attachListListeners(router);
    if (activeDetail) {
      attachDossierActions(activeDetail, currentUser, router);
    }

  } catch (err) {
    container.innerHTML = `
      <div style="padding: 2rem; color: #F87171; text-align: center;">
        Failed to load incidents: ${err.message}
      </div>
    `;
  }
}

function renderIncidentList(items, activeId) {
  if (items.length === 0) {
    return `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No incidents match this filter.</div>`;
  }

  return items.map(inc => {
    const isSelected = inc.id === activeId;
    return `
      <div class="incident-queue-item ${isSelected ? 'active-item' : ''}" data-id="${inc.id}"
        style="padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-color)'}; background: ${isSelected ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-input)'}; cursor: pointer; transition: all 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
          <span style="font-family: monospace; font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700;">
            #${inc.id} • ${inc.equipment_id}
          </span>
          <span class="status-pill ${inc.status}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">
            ${inc.status.replace('_', ' ')}
          </span>
        </div>
        <div style="font-size: 0.82rem; font-weight: 600; color: #FFFFFF; line-height: 1.3; margin-bottom: 0.35rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${inc.description}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted);">
          <span>By: ${inc.reporter_name}</span>
          <span>${new Date(inc.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }).join('');
}

function attachListListeners(router) {
  document.querySelectorAll('.incident-queue-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      router.navigate(`incidents?id=${id}`);
    });
  });
}

function renderDetailDossier(inc, currentUser, activeModel = 'gemma-2-27b-it') {
  const isResolved = inc.status === 'resolved';
  const isAwaitingVerification = inc.status === 'awaiting_verification';
  const canPerformTechAction = currentUser && ['technician', 'admin'].includes(currentUser.role);
  const canPerformVerification = currentUser && currentUser.role === 'admin';

  return `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.75rem;">
      
      <!-- Incident Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.4rem;">
            <span style="font-family: monospace; font-size: 1rem; font-weight: 800; color: var(--accent-cyan);">Incident #${inc.id}</span>
            <span class="status-pill ${inc.status}">${inc.status.replace('_', ' ')}</span>
            <span style="font-size: 0.75rem; background: var(--bg-input); padding: 0.15rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); color: var(--text-secondary);">
              Severity: <strong style="color: ${inc.severity === 'High' ? '#F87171' : '#FBBF24'}">${inc.severity || 'Medium'}</strong>
            </span>
          </div>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: #FFFFFF;">
            ${inc.equipment ? inc.equipment.name : inc.equipment_id} (${inc.equipment_id})
          </h3>
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">
            Reported by <strong>${inc.reporter_name}</strong> on ${new Date(inc.created_at).toLocaleString()}
            ${isResolved ? ` • <strong style="color: #34D399;">Resolved on ${new Date(inc.resolved_at).toLocaleString()}</strong>` : ''}
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-outline btn-sm" id="btn-view-equipment-from-dossier" data-id="${inc.equipment_id}">
            View Equipment Specs
          </button>
        </div>
      </div>

      <!-- Original User Report -->
      <div style="margin-bottom: 1.25rem;">
        <label style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">
          Original User Fault Report (Ground Truth)
        </label>
        <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; color: #FFFFFF; font-size: 0.9rem; line-height: 1.4;">
          "${inc.description}"
        </div>
      </div>

      <!-- Gemma Fault Intelligence Card -->
      <div class="ai-preview-card" style="margin-bottom: 1.5rem;">
        <div class="ai-preview-header">
          <span class="ai-badge">⚡ Gemma Incident Diagnostics</span>
          <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${activeModel}</span>
        </div>
        <div class="ai-grid">
          <div class="ai-grid-item">
            <div class="ai-label">Classified Category</div>
            <div class="ai-val" style="color: var(--accent-blue);">${inc.category || 'Hardware'}</div>
          </div>
          <div class="ai-grid-item">
            <div class="ai-label">Evaluated Severity</div>
            <div class="ai-val" style="color: ${inc.severity === 'High' ? '#F87171' : '#FBBF24'};">${inc.severity || 'Medium'}</div>
          </div>
          <div class="ai-grid-item">
            <div class="ai-label">Technician Required</div>
            <div class="ai-val" style="color: ${inc.technician_required ? '#F87171' : '#34D399'};">
              ${inc.technician_required ? 'YES (Specialist)' : 'NO (User-Safe)'}
            </div>
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.6); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.82rem; margin-bottom: 0.4rem;">
          <strong style="color: var(--text-secondary); display: block; margin-bottom: 0.2rem; font-size: 0.72rem; text-transform: uppercase;">
            Gemma Recommended Action:
          </strong>
          <span style="color: #FFFFFF;">${inc.ai_next_step || 'Inspect feed guides and follow manual steps.'}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">
          ${inc.ai_reasoning || 'Diagnostic summary based on fault syntax.'}
        </div>
      </div>

      <!-- Updates and Repair Timeline -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
          <span>📋</span> Recorded Repair Attempts & Updates (${inc.updates ? inc.updates.length : 0})
        </h4>

        ${!inc.updates || inc.updates.length === 0 ? `
          <div style="padding: 1rem; background: var(--bg-input); border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-muted); text-align: center;">
            No repair attempts or notes recorded yet.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${inc.updates.map(u => `
              <div style="background: var(--bg-input); border-left: 3px solid ${u.update_type === 'status_change' ? '#10B981' : '#38BDF8'}; border-radius: 0 var(--radius-md) var(--radius-md) 0; padding: 0.75rem 1rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                  <span><strong>${u.user_name}</strong> (${u.user_role.toUpperCase()})</span>
                  <span>${new Date(u.created_at).toLocaleString()}</span>
                </div>
                <div style="font-size: 0.85rem; color: #FFFFFF;">${u.note}</div>
                ${u.action_taken ? `<div style="font-size: 0.75rem; color: var(--accent-cyan); margin-top: 0.2rem;">Action Taken: ${u.action_taken}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Human Verification Records (Section 9 & 11) -->
      <div style="margin-bottom: 1.75rem;">
        <h4 style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
          <span>🛡️</span> Recovery Test Verification Records (${inc.verifications ? inc.verifications.length : 0})
        </h4>

        ${!inc.verifications || inc.verifications.length === 0 ? `
          <div style="padding: 1rem; background: var(--bg-input); border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-muted); text-align: center;">
            No physical recovery test recorded yet. (Mandatory for resolving recovery).
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${inc.verifications.map(v => `
              <div style="background: var(--bg-input); border: 1px solid ${v.test_result === 'passed' ? 'var(--status-available-border)' : 'var(--status-out-service-border)'}; border-left: 4px solid ${v.test_result === 'passed' ? 'var(--status-available)' : 'var(--status-out-service)'}; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
                  <strong style="color: #FFFFFF; font-size: 0.88rem;">Test: "${v.test_name}"</strong>
                  <span class="status-pill ${v.test_result === 'passed' ? 'available' : 'out_of_service'}" style="font-size: 0.72rem;">
                    ${v.test_result.toUpperCase()}
                  </span>
                </div>
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
                  ${v.notes || 'No verifier notes.'}
                </p>
                <div style="font-size: 0.72rem; color: var(--text-muted);">
                  Verified by <strong>${v.verifier_name}</strong> on ${new Date(v.created_at).toLocaleString()}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- WORKFLOW ACTIONS ACCORDION -->
      ${!isResolved ? `
        <!-- 1. TECHNICIAN REPAIR FORM -->
        <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF; display: flex; align-items: center; gap: 0.4rem;">
              <span>🔧</span> Step 1: Record Technician Repair Attempt
            </h4>
            ${!canPerformTechAction ? `
              <span style="font-size: 0.72rem; color: var(--status-amber);">
                Switch persona to Taylor (Technician) to submit
              </span>
            ` : ''}
          </div>

          <form id="tech-repair-form">
            <div class="form-group" style="margin-bottom: 0.75rem;">
              <label for="tech-note-input" style="font-size: 0.8rem;">Technician Field Notes / Actions Taken *</label>
              <textarea id="tech-note-input" class="form-control" rows="3" placeholder="e.g., Opened Front Door A, gently cleared jammed 80gsm paper from feed rollers. Adjusted Tray 1 paper guides."></textarea>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
              <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--text-primary); cursor: pointer;">
                <input type="checkbox" id="move-to-awaiting-check" checked />
                <span>Move Incident Status to <strong>Awaiting Verification</strong></span>
              </label>

              <button type="button" class="btn btn-outline btn-sm" id="btn-structure-notes" title="Gemma note structuring without adding unreported events">
                ⚡ Structure with Gemma
              </button>
            </div>

            <button type="submit" class="btn btn-primary btn-sm" ${!canPerformTechAction ? 'disabled' : ''}>
              Submit Technician Repair Update
            </button>
          </form>
        </div>

        <!-- 2. RECOVERY VERIFICATION FORM (AUTHORIZED VERIFIER ONLY) -->
        <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-md); padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <h4 style="font-size: 0.95rem; font-weight: 700; color: #34D399; display: flex; align-items: center; gap: 0.4rem;">
                <span>🛡️</span> Step 2: Human Test Verification & Recovery Authorization
              </h4>
              <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.15rem;">
                Mandatory step. Equipment will NOT return to Available without a passing physical test.
              </p>
            </div>
            ${!canPerformVerification ? `
              <span style="font-size: 0.72rem; color: var(--status-amber); font-weight: 600;">
                Requires Alex (Admin / Verifier) persona
              </span>
            ` : ''}
          </div>

          <form id="verifier-form">
            <div class="form-group" style="margin-bottom: 0.75rem;">
              <label for="test-name-input" style="font-size: 0.8rem;">Verification Test Performed *</label>
              <input type="text" id="test-name-input" class="form-control" placeholder="e.g., Diagnostic Quality Test Print Sheet (2 consecutive pages)" required />
            </div>

            <!-- Test Result Buttons -->
            <div class="form-group" style="margin-bottom: 0.75rem;">
              <label style="font-size: 0.8rem;">Test Result Outcome *</label>
              <div style="display: flex; gap: 0.75rem;">
                <label style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.65rem; border: 1px solid var(--status-available-border); border-radius: var(--radius-md); background: rgba(16, 185, 129, 0.12); color: #34D399; cursor: pointer; font-weight: 700; font-size: 0.85rem;">
                  <input type="radio" name="test-result" value="passed" checked />
                  <span>✅ PASSED (Restores to Available)</span>
                </label>
                <label style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.65rem; border: 1px solid var(--status-out-service-border); border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.12); color: #F87171; cursor: pointer; font-weight: 700; font-size: 0.85rem;">
                  <input type="radio" name="test-result" value="failed" />
                  <span>❌ FAILED (Remains Out of Service)</span>
                </label>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0.75rem;">
              <label for="verifier-notes-input" style="font-size: 0.8rem;">Verifier Test Notes & Observations</label>
              <input type="text" id="verifier-notes-input" class="form-control" placeholder="e.g., Printed 2 clean sheets without paper jam error. Feed path smooth." />
            </div>

            <button type="submit" class="btn btn-success btn-sm" ${!canPerformVerification ? 'disabled' : ''}>
              🛡️ Submit Official Recovery Verification
            </button>
          </form>
        </div>
      ` : `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--status-available-border); border-radius: var(--radius-md); padding: 1.25rem; text-align: center; color: #34D399;">
          <strong>Incident Resolved & Equipment Recovered</strong>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">
            This incident has successfully passed human test verification. Equipment is active in Available status.
          </p>
        </div>
      `}

    </div>
  `;
}

function attachDossierActions(inc, currentUser, router) {
  // View Equipment button
  const viewEqBtn = document.getElementById('btn-view-equipment-from-dossier');
  if (viewEqBtn) {
    viewEqBtn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      router.navigate(`equipment/${id}`);
    });
  }

  // Structure notes with Gemma
  const structureBtn = document.getElementById('btn-structure-notes');
  if (structureBtn) {
    structureBtn.addEventListener('click', async () => {
      const noteInput = document.getElementById('tech-note-input');
      const raw = noteInput.value.trim();
      if (!raw) {
        showToast('Please type rough technician notes first.', 'warning');
        noteInput.focus();
        return;
      }

      structureBtn.disabled = true;
      structureBtn.textContent = '⚡ Structuring with Gemma...';

      try {
        const res = await api.structureTechnicianNotes(inc.id, raw);
        if (res.structured && res.structured.formattedSummary) {
          noteInput.value = res.structured.formattedSummary;
          showToast('Notes structured with Gemma without adding unreported actions.', 'success');
        }
      } catch (err) {
        showToast('Gemma note formatting note: ' + err.message, 'warning');
      } finally {
        structureBtn.disabled = false;
        structureBtn.textContent = '⚡ Structure with Gemma';
      }
    });
  }

  // Technician form submit
  const techForm = document.getElementById('tech-repair-form');
  if (techForm) {
    techForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const noteInput = document.getElementById('tech-note-input');
      const note = noteInput.value.trim();
      const moveAwaiting = document.getElementById('move-to-awaiting-check').checked;

      if (!note) {
        showToast('Technician note is required.', 'warning');
        return;
      }

      try {
        await api.updateIncident(inc.id, {
          note,
          actionTaken: note.slice(0, 100),
          moveStatusToAwaiting: moveAwaiting
        });

        showToast(moveAwaiting
          ? 'Repair logged! Incident moved to Awaiting Verification.'
          : 'Technician repair update logged.', 'success');
        
        router.navigate(`incidents?id=${inc.id}`, true);
      } catch (err) {
        showToast(`Failed to update incident: ${err.message}`, 'error');
      }
    });
  }

  // Verifier form submit (Passed or Failed test)
  const verifierForm = document.getElementById('verifier-form');
  if (verifierForm) {
    verifierForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const testName = document.getElementById('test-name-input').value.trim();
      const testResult = document.querySelector('input[name="test-result"]:checked').value;
      const notes = document.getElementById('verifier-notes-input').value.trim();

      if (!testName) {
        showToast('Verification test name is required.', 'warning');
        return;
      }

      try {
        const res = await api.recordVerification({
          incidentId: inc.id,
          testName,
          testResult,
          notes
        });

        if (testResult === 'passed') {
          showToast(`🎉 RECOVERY VERIFIED! Equipment is now AVAILABLE.`, 'success', 5000);
        } else {
          showToast(`❌ Test FAILED. Equipment remains OUT OF SERVICE.`, 'warning', 5000);
        }

        router.navigate(`incidents?id=${inc.id}`, true);
      } catch (err) {
        showToast(`Verification submission failed: ${err.message}`, 'error');
      }
    });
  }
}
