# FaultBeforeYou — Live Hackathon Demo Script

> **Tagline:** Report once. Warn everyone. Verify recovery.

This guide details the step-by-step scenario to demonstrate **FaultBeforeYou** for hackathon judges, following the exact 12-step flow.

---

## Demo Personas & Quick Switcher

The header bar features a live persona switcher to seamlessly transition between user roles:

| Persona | Role | Credentials | Capabilities |
| :--- | :--- | :--- | :--- |
| **📢 Riley Reporter** | `reporter` | `reporter` / `reporter123` | General user: reports faults, views equipment and manuals |
| **🔧 Taylor Technician** | `technician` | `tech` / `tech123` | Maintenance staff: records repairs, structures notes with Gemma |
| **🛡️ Alex Admin / Verifier** | `admin` | `admin` / `admin123` | Authorized verifier: performs recovery test verification |
| **👁️ Victoria Viewer** | `viewer` | `viewer` / `viewer123` | Read-only user: views warnings, equipment, and audit trail |

---

## 12-Step Hackathon Demo Walkthrough

### Step 1: Open the Dashboard & Verify Initial Status
1. Navigate to `http://localhost:3000/#dashboard`.
2. Observe the Summary Cards:
   - **Available Equipment: 4**
   - **Out of Service: 0**
3. Locate **`LAB-PR-01` (Engineering Lab Color Printer)** in the equipment grid.
4. Verify its status pill is green: `● AVAILABLE`.

### Step 2: Report a Fault
1. Click **Report Fault** on `LAB-PR-01` or the top navigation tab **⚠️ Report Fault**.
2. Equipment is preselected as `LAB-PR-01`.
3. Enter the description (or click the quick-fill pill):
   ```
   The printer is showing a paper jam error in Tray 1.
   ```

### Step 3: View Gemma 4 Actual Classification & Preview
1. Click the button **🔍 Analyze Fault with Gemma 4**.
2. Observe the structured Gemma output:
   - **Category:** `Hardware`
   - **Suggested Severity:** `Medium`
   - **Technician Required:** `NO (User-Safe Checks)`
   - **Recommended Next Step:** `Inspect feed guides and follow manual steps.`
   - **Reasoning Summary:** `Classified based on reported symptom patterns.`
3. Click **⚠️ Broadcast Fault & Mark Out of Service**.

### Step 4: Show Manual-Grounded Troubleshooting
1. From the top navigation, click **📖 Troubleshooting**.
2. Select `LAB-PR-01` / `Lexmark Enterprise M553 Operator Guide`.
3. Input or click: `"The printer is showing a paper jam error in Tray 1."`
4. Click **Retrieve Manual Passages & Generate Grounded Guidance**.
5. Observe the grounded response:
   - **Citations:** `Lexmark Enterprise M553 Operator Guide, Sec 3.1`
   - **User-Level Checks:** Clear Door A, grasp jammed sheet with both hands along feed path, check fill guides.
   - **Retrieved Ground Truth:** Shows the exact database passage snippet from SQLite.
   - *(Optional Check)*: Try searching `"quantum warp core coolant leak"` — observe the guardrail refusal: *"No verified troubleshooting guidance was found in the available manual."*

### Step 5: Refresh Dashboard & Confirm Persistence
1. Navigate to **📊 Dashboard** (or hit refresh `F5`).
2. Observe the prominent red banner at the top:
   ```
   ⚠️ ACTIVE EQUIPMENT WARNING: Engineering Lab Color Printer (LAB-PR-01)
   Fault Encountered: "The printer is showing a paper jam error in Tray 1."
   ```
3. Look at `LAB-PR-01` in the grid — it is outlined in red with status `● OUT OF SERVICE`.
4. Summary card **Out of Service** now reads `1`.

### Step 6: Open Equipment Details Page
1. Click **View Details** on `LAB-PR-01` (or `#equipment/LAB-PR-01`).
2. Notice the active incident alert box.
3. Scroll to **Gemma 4 Incident Intelligence**:
   - Displays common fault patterns, previous repairs, and verified fixes.
   - Clearly separates raw database rows from Gemma synthesis.

### Step 7: Sign in as Technician & Record Repair
1. In the header top-right, switch persona to **🔧 Taylor (Technician)**.
2. Click **View Active Incident** (or `#incidents?id=...`).
3. Under **Step 1: Record Technician Repair Attempt**:
   - Type in the field notes:
     ```
     opened door a, cleared jammed sheet from tray 1 pickup rollers, wiped feed sensor with alcohol wipe
     ```
   - Click **⚡ Structure with Gemma** to see Gemma format it cleanly without adding unreported actions.

### Step 8: Move Incident to Awaiting Verification
1. Ensure the checkbox **Move Incident Status to Awaiting Verification** is checked.
2. Click **Submit Technician Repair Update**.
3. The incident status badge transitions to amber `● AWAITING VERIFICATION`.
4. Check the equipment status: **Notice that the printer REMAINS OUT OF SERVICE.** (Gemma or technician repairs do not auto-restore equipment).

### Step 9 & 10: Human Verification Test (Pass Scenario)
1. In the header top-right, switch persona to **🛡️ Alex (Admin / Verifier)**.
2. Under **Step 2: Human Test Verification & Recovery Authorization**:
   - Enter **Verification Test Performed:** `Diagnostic Quality Test Sheet (2 copies)`
   - Select Outcome: **✅ PASSED (Restores to Available)**
   - Enter **Verifier Notes:** `Printed 2 clean single-page diagnostic outputs. Feed path clear.`
   - Click **🛡️ Submit Official Recovery Verification**.
3. **Recovery Confirmed!**
   - Incident status updates to green `● RESOLVED`.
   - Notification toast appears: *"🎉 RECOVERY VERIFIED! Equipment is now AVAILABLE."*
4. Return to **📊 Dashboard**:
   - `LAB-PR-01` has returned to green `● AVAILABLE`.
   - The warning banner has disappeared.
   - Metric card **Incidents Resolved Today** incremented.

### Step 11: Display Full Report, Repair, and Verification History
1. Click **📜 History** tab.
2. Inspect the **Recovery Test Verification Log**:
   - Shows timestamp, Equipment `LAB-PR-01`, Test `Diagnostic Quality Test Sheet (2 copies)`, Result `PASSED`, Verifier `Alex Admin`.
3. Complete audit trail guarantees that no fault can be resolved without recorded physical verification.

### Step 12: Repeat with a FAILED Verification Test
1. Switch to **📢 Riley (Reporter)**.
2. Report a new fault on `LAB-PJ-01` (Classroom Ceiling Projector):
   ```
   Projector screen is flashing blue No Signal and HDMI 1 does not detect laptop.
   ```
3. `LAB-PJ-01` becomes `OUT OF SERVICE`.
4. Switch to **🔧 Taylor (Technician)** and log repair: `"Re-seated wall plate HDMI cable"`, moving to Awaiting Verification.
5. Switch to **🛡️ Alex (Admin / Verifier)**.
6. Enter **Verification Test Performed:** `Full Spectrum 4K Color Bar Test Pattern`.
7. Select Outcome: **❌ FAILED (Remains Out of Service)**.
8. Enter notes: `Signal drops intermittently after 10 seconds. HDMI port appears loose.`
9. Click **Submit Official Recovery Verification**.
10. **Demonstrate Guardrail:**
    - Incident returns to `● UNDER INVESTIGATION`.
    - Equipment `LAB-PJ-01` **REMAINS OUT OF SERVICE**.
    - Status history documents the failed test record.
    - Dashboard warning remains active!
