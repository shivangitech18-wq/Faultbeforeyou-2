import { api, showToast, getAiModelName } from '../api.js';
import { getCurrentUser } from '../auth.js';

export async function renderReportFault(container, router, queryParams = {}) {
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <p>Loading equipment options...</p>
    </div>
  `;

  try {
    const equipmentList = await api.getEquipment();
    const currentUser = getCurrentUser();

    // Check if equipmentId preselected from queryParams
    const selectedId = queryParams.equipmentId || (equipmentList[0] ? equipmentList[0].id : '');

    container.innerHTML = `
      <div class="form-panel">
        <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <span style="font-size: 1.3rem;">⚠️</span>
            <h2 style="font-size: 1.35rem; font-weight: 700; color: #FFFFFF;">Report Equipment Fault</h2>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Reporting a fault immediately warns other users and places the equipment Out of Service to prevent further disruption.
          </p>
        </div>

        <form id="fault-report-form">
          <!-- Equipment Selection -->
          <div class="form-group">
            <label for="report-equipment-select">Select Equipment Unit *</label>
            <select class="form-control" id="report-equipment-select" required>
              ${equipmentList.map(eq => `
                <option value="${eq.id}" ${eq.id === selectedId ? 'selected' : ''}>
                  ${eq.name} (${eq.id}) — ${eq.status.replace('_', ' ').toUpperCase()} — ${eq.location}
                </option>
              `).join('')}
            </select>
            <div class="form-hint" id="equipment-status-hint"></div>
          </div>

          <!-- Fault Description -->
          <div class="form-group">
            <label for="report-description">
              Describe the Fault or Error Encountered *
            </label>
            <textarea
              id="report-description"
              class="form-control"
              rows="4"
              maxlength="1000"
              placeholder="e.g., The printer is showing a paper jam error in Tray 1 and making a grinding noise."
              required
            ></textarea>
            <div style="display: flex; justify-content: space-between; margin-top: 0.35rem;">
              <span class="form-hint">Be specific about error codes, blinking lights, or screen messages.</span>
              <span class="form-hint" id="char-count">0 / 1000</span>
            </div>
          </div>

          <!-- Quick Demo Suggestion Pills -->
          <div style="margin-bottom: 1.25rem;">
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.4rem; font-weight: 600;">
              Demo Quick-Fill Scenarios:
            </span>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              <button type="button" class="btn btn-outline btn-sm quick-fill-btn" data-text="The printer is showing a paper jam error in Tray 1.">
                🖨️ Printer Jam (Hackathon Demo)
              </button>
              <button type="button" class="btn btn-outline btn-sm quick-fill-btn" data-text="Projector HDMI signal disconnected. Displays blue No Signal screen.">
                📽️ Projector No Signal
              </button>
              <button type="button" class="btn btn-outline btn-sm quick-fill-btn" data-text="Desktop PC power LED is blinking amber; monitor enters sleep mode.">
                🖥️ PC Amber LED Error
              </button>
            </div>
          </div>

          <!-- Gemma 4 Fault Intelligence Preview Card (Interactive) -->
          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-size: 0.85rem; font-weight: 600; color: var(--accent-cyan); display: flex; align-items: center; gap: 0.35rem;">
                <span>⚡</span> Gemma 4 Fault Intelligence Preview
              </span>
              <button type="button" class="btn btn-outline btn-sm" id="btn-run-ai-preview">
                🔍 Analyze Fault with Gemma 4
              </button>
            </div>

            <div id="ai-preview-result" style="display: none;"></div>
          </div>

          <!-- Strict Recovery Disclaimer -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.5rem; font-size: 0.78rem; color: var(--text-secondary); line-height: 1.45;">
            <strong style="color: #FFFFFF;">Workflow Guarantee:</strong> AI classifications and suggested severities are strictly advisory. Submitting this report will mark the equipment <strong>Out of Service</strong> across all dashboards. The equipment can ONLY return to Available status after an authorized human verifier records a successful physical test.
          </div>

          <!-- Form Actions -->
          <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button type="button" class="btn btn-outline" id="btn-cancel-report">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" id="btn-submit-fault">
              <span>⚠️</span> Broadcast Fault & Mark Out of Service
            </button>
          </div>
        </form>
      </div>
    `;

    // Character counter
    const descInput = document.getElementById('report-description');
    const charCount = document.getElementById('char-count');
    descInput.addEventListener('input', () => {
      charCount.textContent = `${descInput.value.length} / 1000`;
    });

    // Quick-fill buttons
    document.querySelectorAll('.quick-fill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        descInput.value = e.currentTarget.getAttribute('data-text');
        charCount.textContent = `${descInput.value.length} / 1000`;
      });
    });

    // AI Preview Button
    const previewContainer = document.getElementById('ai-preview-result');
    const runAiBtn = document.getElementById('btn-run-ai-preview');
    runAiBtn.addEventListener('click', async () => {
      const desc = descInput.value.trim();
      const eqId = document.getElementById('report-equipment-select').value;

      if (!desc) {
        showToast('Please type a fault description first.', 'warning');
        descInput.focus();
        return;
      }

      const activeModel = await getAiModelName();
      previewContainer.style.display = 'block';
      previewContainer.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--accent-cyan); font-size: 0.85rem;">
          <span>⏳</span> Calling Gemma (${activeModel}) to classify fault and evaluate technician requirements...
        </div>
      `;

      try {
        const res = await api.classifyFault({ description: desc, equipmentId: eqId });
        const c = res.classification;

        let sevColor = '#FBBF24';
        if (c.suggestedSeverity === 'High') sevColor = '#F87171';
        if (c.suggestedSeverity === 'Low') sevColor = '#34D399';

        previewContainer.innerHTML = `
          <div class="ai-preview-card">
            <div class="ai-preview-header">
              <span class="ai-badge">⚡ Gemma Structured Classification</span>
              <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${activeModel}</span>
            </div>

            <div class="ai-grid">
              <div class="ai-grid-item">
                <div class="ai-label">Category</div>
                <div class="ai-val" style="color: var(--accent-blue);">${c.category}</div>
              </div>
              <div class="ai-grid-item">
                <div class="ai-label">Suggested Severity</div>
                <div class="ai-val" style="color: ${sevColor};">${c.suggestedSeverity}</div>
              </div>
              <div class="ai-grid-item">
                <div class="ai-label">Technician Required?</div>
                <div class="ai-val" style="color: ${c.technicianRequired ? '#F87171' : '#34D399'};">
                  ${c.technicianRequired ? 'YES (Specialized)' : 'NO (User-Safe Checks)'}
                </div>
              </div>
            </div>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 0.75rem 0.85rem; border-radius: var(--radius-sm); margin-bottom: 0.5rem; font-size: 0.82rem;">
              <strong style="color: var(--text-secondary); display: block; margin-bottom: 0.2rem; font-size: 0.72rem; text-transform: uppercase;">
                Gemma Immediate Recommendation:
              </strong>
              <span style="color: #FFFFFF;">${c.recommendedNextStep}</span>
            </div>

            <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">
              ${c.reasoningSummary}
            </div>
          </div>
        `;
      } catch (err) {
        previewContainer.innerHTML = `
          <div style="padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm); color: #F87171; font-size: 0.82rem;">
            Gemma analysis note: ${err.message}. Standard reporting will proceed normally.
          </div>
        `;
      }
    });

    // Form submission
    const form = document.getElementById('fault-report-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const eqId = document.getElementById('report-equipment-select').value;
      const desc = descInput.value.trim();

      const submitBtn = document.getElementById('btn-submit-fault');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Broadcasting Fault Warning...';

      try {
        const result = await api.reportFault({
          equipmentId: eqId,
          description: desc
        });

        showToast(`Incident #${result.incident.id} created! ${eqId} marked OUT OF SERVICE.`, 'warning');
        router.navigate('dashboard');
      } catch (err) {
        showToast(`Failed to report fault: ${err.message}`, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>⚠️</span> Broadcast Fault & Mark Out of Service';
      }
    });

    document.getElementById('btn-cancel-report').addEventListener('click', () => {
      router.navigate('dashboard');
    });

  } catch (err) {
    container.innerHTML = `
      <div style="padding: 2rem; color: #F87171; text-align: center;">
        Failed to load report form: ${err.message}
      </div>
    `;
  }
}
