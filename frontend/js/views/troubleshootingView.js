import { api, showToast, getAiModelName } from '../api.js';

export async function renderTroubleshooting(container, router, queryParams = {}) {
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <p>Loading approved equipment manuals & troubleshooting engine...</p>
    </div>
  `;

  try {
    const [equipmentList, manuals, activeModel] = await Promise.all([
      api.getEquipment(),
      api.getManuals(),
      getAiModelName()
    ]);

    const initialEqId = queryParams.equipmentId || (equipmentList[0] ? equipmentList[0].id : '');
    const initialType = queryParams.type || (equipmentList[0] ? equipmentList[0].type : 'printer');

    container.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto;">
        
        <!-- Header -->
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <span class="ai-badge">⚡ Gemma Manual-Grounded Assistant</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Ground truth model: ${activeModel}</span>
          </div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: #FFFFFF;">
            Approved-Manual Troubleshooting Assistant
          </h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Gemma 4 provides troubleshooting strictly grounded in verified equipment operating manuals. Non-user hazards (high-heat fusers, high-voltage lamps) are strictly directed to authorized technicians.
          </p>
        </div>

        <!-- Query Form Panel -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem;">
          <form id="troubleshoot-form">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label for="ts-equipment-select">Equipment Unit</label>
                <select id="ts-equipment-select" class="form-control">
                  ${equipmentList.map(eq => `
                    <option value="${eq.id}" data-type="${eq.type}" ${eq.id === initialEqId ? 'selected' : ''}>
                      ${eq.name} (${eq.id}) — ${eq.type.toUpperCase()}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label for="ts-type-select">Manual Catalog</label>
                <select id="ts-type-select" class="form-control">
                  <option value="printer" ${initialType === 'printer' ? 'selected' : ''}>Lexmark Enterprise M553 Operator Guide</option>
                  <option value="projector" ${initialType === 'projector' ? 'selected' : ''}>Epson PowerLite Pro 4K User Manual</option>
                  <option value="desktop" ${initialType === 'desktop' ? 'selected' : ''}>Dell OptiPlex 7090 Hardware Guide</option>
                  <option value="scanner" ${initialType === 'scanner' ? 'selected' : ''}>Fujitsu fi-8170 Operator Handbook</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="ts-fault-input">Describe Error Symptom or Code *</label>
              <input
                type="text"
                id="ts-fault-input"
                class="form-control"
                placeholder="e.g., The printer is showing a paper jam error in Tray 1"
                required
              />
            </div>

            <!-- Demo Suggestions -->
            <div style="margin-bottom: 1.25rem;">
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; display: block; margin-bottom: 0.35rem;">
                Try Demo Scenarios (Matches Approved Manual Passages):
              </span>
              <div style="display: flex; flex-wrap: wrap; gap: 0.45rem;">
                <button type="button" class="btn btn-outline btn-sm ts-quick-btn" data-type="printer" data-text="The printer is showing a paper jam error in Tray 1.">
                  🖨️ Printer Jam Tray 1 (Sec 3.1)
                </button>
                <button type="button" class="btn btn-outline btn-sm ts-quick-btn" data-type="printer" data-text="Paper accordion-folded inside hot rear fuser unit.">
                  ⚠️ Fuser Heat Hazard (Sec 3.2 - Tech Only)
                </button>
                <button type="button" class="btn btn-outline btn-sm ts-quick-btn" data-type="projector" data-text="Projector screen blue with No Signal detected on HDMI.">
                  📽️ Projector No Signal (Sec 2.4)
                </button>
                <button type="button" class="btn btn-outline btn-sm ts-quick-btn" data-type="projector" data-text="Red LAMP warning light solid; bulb failure.">
                  ⚠️ Projector Lamp Failure (Sec 4.5 - Tech Only)
                </button>
                <button type="button" class="btn btn-outline btn-sm ts-quick-btn" data-type="desktop" data-text="Desktop power LED blinks amber 2 blinks then 4 blinks.">
                  🖥️ PC Amber Diagnostic LED (Sec 1.3)
                </button>
                <button type="button" class="btn btn-outline btn-sm ts-quick-btn" data-type="scanner" data-text="ADF multi-feed jam error J01 pick rollers slipping.">
                  📄 Scanner Roller Jam (Sec 2.2)
                </button>
                <button type="button" class="btn btn-outline btn-sm ts-quick-btn" data-type="printer" data-text="Alien spaceship warp core coolant leak error 9999.">
                  ❌ Non-Existent Issue (Tests 'No Manual Guidance' Guardrail)
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-submit-ts" style="width: 100%;">
              <span>🔍</span> Retrieve Manual Passages & Generate Grounded Guidance
            </button>
          </form>
        </div>

        <!-- Grounded Results Container -->
        <div id="ts-result-container"></div>

        <!-- Available Manuals Reference Accordion -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-top: 1.5rem;">
          <h3 style="font-size: 1rem; font-weight: 700; color: #FFFFFF; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>📚</span> Knowledge Base Directory (${manuals.length} Approved Sections)
          </h3>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 1rem;">
            Passages are stored in the SQLite database and queried with tokenized relevance ranking. No invented manuals or citations are permitted.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem;">
            ${manuals.map(m => `
              <div style="background: var(--bg-input); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.8rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
                  <strong style="color: var(--accent-cyan); font-family: monospace; font-size: 0.72rem;">${m.section_number}</strong>
                  <span style="font-size: 0.68rem; color: ${m.is_user_safe ? '#34D399' : '#F87171'};">
                    ${m.is_user_safe ? 'User Check' : 'Technician'}
                  </span>
                </div>
                <div style="font-weight: 600; color: #FFFFFF; font-size: 0.78rem;">${m.title}</div>
                <div style="color: var(--text-muted); font-size: 0.7rem; margin-top: 0.15rem;">${m.manual_name}</div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    // Equipment select synchronizes type select
    const eqSelect = document.getElementById('ts-equipment-select');
    const typeSelect = document.getElementById('ts-type-select');
    eqSelect.addEventListener('change', () => {
      const selectedOption = eqSelect.options[eqSelect.selectedIndex];
      const eqType = selectedOption.getAttribute('data-type');
      if (eqType) typeSelect.value = eqType;
    });

    // Quick demo scenario buttons
    document.querySelectorAll('.ts-quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const text = e.currentTarget.getAttribute('data-text');
        const eqType = e.currentTarget.getAttribute('data-type');
        document.getElementById('ts-fault-input').value = text;
        typeSelect.value = eqType;
        // Also select matching equipment
        for (const opt of eqSelect.options) {
          if (opt.getAttribute('data-type') === eqType) {
            eqSelect.value = opt.value;
            break;
          }
        }
      });
    });

    // Troubleshoot form submit
    const form = document.getElementById('troubleshoot-form');
    const resultContainer = document.getElementById('ts-result-container');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const faultDesc = document.getElementById('ts-fault-input').value.trim();
      const eqId = eqSelect.value;
      const eqType = typeSelect.value;

      if (!faultDesc) return;

      resultContainer.innerHTML = `
        <div style="padding: 2rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); text-align: center; color: var(--accent-cyan);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚡</div>
          <strong>Searching approved manual passages and grounding guidance with Gemma 4...</strong>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
            Verifying citations against ${typeSelect.options[typeSelect.selectedIndex].text}...
          </p>
        </div>
      `;

      try {
        const res = await api.queryTroubleshooting({
          equipmentId: eqId,
          equipmentType: eqType,
          faultDescription: faultDesc
        });

        renderGroundedResult(resultContainer, res, router, eqId);
      } catch (err) {
        resultContainer.innerHTML = `
          <div style="padding: 1.5rem; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--status-out-service-border); border-radius: var(--radius-md); color: #F87171; text-align: center;">
            Error generating troubleshooting: ${err.message}
          </div>
        `;
      }
    });

  } catch (err) {
    container.innerHTML = `
      <div style="padding: 2rem; color: #F87171; text-align: center;">
        Failed to load troubleshooting assistant: ${err.message}
      </div>
    `;
  }
}

function renderGroundedResult(container, res, router, equipmentId) {
  const g = res.guidance;

  // Check if grounded was false or no passages
  if (!g.grounded || (g.passagesUsed && g.passagesUsed.length === 0)) {
    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--status-amber-border); border-radius: var(--radius-lg); padding: 1.75rem; border-left: 5px solid var(--status-amber);">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; color: #FBBF24; font-weight: 700; font-size: 1.05rem;">
          <span>🔍</span> Knowledge Base Guardrail Triggered
        </div>
        <p style="font-size: 0.95rem; color: #FFFFFF; font-weight: 600; margin-bottom: 0.75rem;">
          ${g.guidance || 'No verified troubleshooting guidance was found in the available manual.'}
        </p>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          In accordance with the Grounding Policy, Gemma 4 is strictly prevented from hallucinating or inventing procedures not present in approved manuals.
        </p>
        <button class="btn btn-primary btn-sm" id="btn-report-ungrounded" data-eq="${equipmentId}">
          ⚠️ Report Fault & Request Technician
        </button>
      </div>
    `;

    document.getElementById('btn-report-ungrounded').addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-eq');
      router.navigate(`report?equipmentId=${id}`);
    });
    return;
  }

  // Grounded Guidance Found
  container.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.75rem;">
      
      <!-- Guidance Header & Citations -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.35rem;">
            <span class="ai-badge">✓ Approved-Manual Grounded</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Strict Ground Truth</span>
          </div>
          <h3 style="font-size: 1.2rem; font-weight: 700; color: #FFFFFF;">
            Troubleshooting Procedure: ${res.query}
          </h3>
          <div style="font-size: 0.8rem; color: var(--accent-cyan); margin-top: 0.25rem;">
            📖 <strong>Source Manual:</strong> ${g.sourceManual} 
            ${g.sectionsCited && g.sectionsCited.length > 0 ? `(${g.sectionsCited.join(', ')})` : ''}
          </div>
        </div>

        <button class="btn btn-danger btn-sm" id="btn-report-if-fails" data-eq="${equipmentId}">
          ⚠️ Did Not Fix? Report Fault
        </button>
      </div>

      <!-- Technician Safety Warning (if any) -->
      ${g.technicianWarning ? `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--status-out-service-border); border-left: 4px solid var(--status-out-service); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
          <div style="font-weight: 700; color: #FCA5A5; font-size: 0.85rem; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
            <span>⚠️</span> RESTRICTED HAZARD - AUTHORIZED TECHNICIAN REQUIRED
          </div>
          <p style="font-size: 0.82rem; color: #FEE2E2; line-height: 1.4;">
            ${g.technicianWarning}
          </p>
        </div>
      ` : ''}

      <!-- Step-by-Step User-Level Checks -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.35rem;">
          <span>✅</span> Safe User-Level Action Steps
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${g.userLevelSteps && g.userLevelSteps.length > 0 ? g.userLevelSteps.map((step, idx) => `
            <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: flex-start; gap: 0.75rem;">
              <span style="background: var(--accent-cyan-bg); color: var(--accent-cyan); font-weight: 700; font-size: 0.75rem; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 0.1rem;">
                ${idx + 1}
              </span>
              <span style="font-size: 0.86rem; color: #FFFFFF; line-height: 1.4;">
                ${step}
              </span>
            </div>
          `).join('') : `
            <div style="color: var(--text-muted); font-size: 0.85rem;">Refer to manual passages below for specific checks.</div>
          `}
        </div>
      </div>

      <!-- Recovery Verification Instruction -->
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid var(--status-available-border); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.5rem;">
        <div style="font-size: 0.75rem; font-weight: 700; color: #34D399; text-transform: uppercase; margin-bottom: 0.2rem;">
          Mandatory Recovery Verification Test:
        </div>
        <p style="font-size: 0.82rem; color: #FFFFFF;">
          ${g.verificationInstruction || 'Perform diagnostic self-test print or signal test before declaring equipment available.'}
        </p>
      </div>

      <!-- Retrieved Ground Truth Manual Passages (Transparency Audit) -->
      <div>
        <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.04em;">
          Retrieved Ground Truth Manual Passages (${g.passagesUsed ? g.passagesUsed.length : 0})
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${g.passagesUsed && g.passagesUsed.map(p => `
            <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--accent-cyan); font-family: monospace; margin-bottom: 0.25rem;">
                <span>${p.manual} — ${p.section}: ${p.title}</span>
                <span style="color: ${p.isUserSafe ? '#34D399' : '#F87171'}">${p.isUserSafe ? 'User-Safe' : 'Technician Only'}</span>
              </div>
              <p style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4;">
                "${p.snippet}"
              </p>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;

  document.getElementById('btn-report-if-fails').addEventListener('click', (e) => {
    const id = e.currentTarget.getAttribute('data-eq');
    router.navigate(`report?equipmentId=${id}`);
  });
}
