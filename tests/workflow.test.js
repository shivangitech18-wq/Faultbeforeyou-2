import assert from 'node:assert';
import { db } from '../backend/db/database.js';
import { seedDatabase } from '../backend/db/seed.js';
import { IncidentService } from '../backend/services/incidentService.js';
import { retrieveApprovedManualPassages } from '../backend/services/manualService.js';
import { generateToken, verifyToken } from '../backend/middleware/auth.js';

async function runWorkflowTests() {
  console.log('🧪 Starting FaultBeforeYou Workflow & Recovery Test Suite...\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // Reseed DB to clean state
  await seedDatabase();

  // Fetch seeded users
  const reporterUser = db.get("SELECT * FROM users WHERE role = 'reporter'");
  const techUser = db.get("SELECT * FROM users WHERE role = 'technician'");
  const adminUser = db.get("SELECT * FROM users WHERE role = 'admin'");
  const viewerUser = db.get("SELECT * FROM users WHERE role = 'viewer'");

  // -------------------------------------------------------------
  // TEST 1: Initial Equipment State
  // -------------------------------------------------------------
  test('Initial State: LAB-PR-01 must start as Available', () => {
    const eq = db.get("SELECT * FROM equipment WHERE id = 'LAB-PR-01'");
    assert.strictEqual(eq.status, 'available', 'LAB-PR-01 should start Available');
  });

  // -------------------------------------------------------------
  // TEST 2: Fault Reporting & Immediate Out-of-Service Warning
  // -------------------------------------------------------------
  let testIncidentId = null;
  await asyncTest('Fault Reporting: Report jam sets equipment Out of Service and logs incident', async () => {
    const reportRes = await IncidentService.reportFault({
      equipmentId: 'LAB-PR-01',
      reporterId: reporterUser.id,
      reporterName: reporterUser.full_name,
      description: 'The printer is showing a paper jam error in Tray 1.',
      skipAi: true
    });

    assert.ok(reportRes.incident.id > 0, 'Incident ID should be assigned');
    testIncidentId = reportRes.incident.id;

    assert.strictEqual(reportRes.incident.status, 'reported', 'Incident should start in reported state');
    assert.strictEqual(reportRes.equipment.status, 'out_of_service', 'Equipment must immediately transition to out_of_service');

    // Verify status history
    const history = db.get(
      'SELECT * FROM status_history WHERE equipment_id = ? AND incident_id = ? ORDER BY created_at DESC LIMIT 1',
      ['LAB-PR-01', testIncidentId]
    );
    assert.ok(history, 'Status history event must be recorded');
    assert.strictEqual(history.new_status, 'out_of_service', 'History must record new status as out_of_service');
  });

  // -------------------------------------------------------------
  // TEST 3: Persistence Across Separate Query
  // -------------------------------------------------------------
  test('Persistence: Equipment remains Out of Service in separate query', () => {
    const eq = db.get("SELECT * FROM equipment WHERE id = 'LAB-PR-01'");
    assert.strictEqual(eq.status, 'out_of_service', 'Equipment must persist Out of Service state');
  });

  // -------------------------------------------------------------
  // TEST 4: Technician Repair Attempt Record
  // -------------------------------------------------------------
  test('Technician Repair: Logs update and moves status to Awaiting Verification', () => {
    const updateRes = IncidentService.recordTechnicianUpdate({
      incidentId: testIncidentId,
      userId: techUser.id,
      userName: techUser.full_name,
      userRole: 'technician',
      note: 'Cleared jammed sheet from Tray 1 pickup rollers. Cleaned sensor.',
      actionTaken: 'Cleared jam and wiped sensor',
      moveStatusToAwaiting: true
    });

    assert.strictEqual(updateRes.status, 'awaiting_verification', 'Incident must move to awaiting_verification');

    const inc = db.get('SELECT * FROM incidents WHERE id = ?', [testIncidentId]);
    assert.strictEqual(inc.status, 'awaiting_verification', 'Persisted incident status must be awaiting_verification');

    // Equipment must STILL be out of service!
    const eq = db.get("SELECT * FROM equipment WHERE id = 'LAB-PR-01'");
    assert.strictEqual(eq.status, 'out_of_service', 'Equipment must REMAIN out of service after technician note');
  });

  // -------------------------------------------------------------
  // TEST 5: FAILED Verification Test (Mandatory Requirement)
  // -------------------------------------------------------------
  test('Failed Verification: When test fails, equipment REMAINS Out of Service', () => {
    const failRes = IncidentService.recordVerification({
      incidentId: testIncidentId,
      verifierId: adminUser.id,
      verifierName: adminUser.full_name,
      testName: 'Diagnostic Print Test Sheet #1',
      testResult: 'failed',
      notes: 'Feed motor still slipping; paper jammed again at lead edge.'
    });

    assert.strictEqual(failRes.testResult, 'failed');
    assert.strictEqual(failRes.equipment.status, 'out_of_service', 'Equipment must remain out_of_service when test fails');
    assert.strictEqual(failRes.incident.status, 'under_investigation', 'Incident returns to under_investigation');

    // Verify status history logs failed verification
    const hist = db.get(
      `SELECT * FROM status_history WHERE incident_id = ? AND reason LIKE '%FAILED%'`,
      [testIncidentId]
    );
    assert.ok(hist, 'Status history must document the failed verification test');
  });

  // -------------------------------------------------------------
  // TEST 6: Technician Second Repair Attempt
  // -------------------------------------------------------------
  test('Technician Second Attempt: Replaced pickup roller spring', () => {
    IncidentService.recordTechnicianUpdate({
      incidentId: testIncidentId,
      userId: techUser.id,
      userName: techUser.full_name,
      userRole: 'technician',
      note: 'Replaced worn tension spring on feed roller. Retested feed path manually.',
      actionTaken: 'Replaced feed spring',
      moveStatusToAwaiting: true
    });

    const inc = db.get('SELECT * FROM incidents WHERE id = ?', [testIncidentId]);
    assert.strictEqual(inc.status, 'awaiting_verification');
  });

  // -------------------------------------------------------------
  // TEST 7: SUCCESSFUL Verification Test (Recovery Verification)
  // -------------------------------------------------------------
  test('Successful Verification: Passes test, incident RESOLVED, equipment AVAILABLE', () => {
    const passRes = IncidentService.recordVerification({
      incidentId: testIncidentId,
      verifierId: adminUser.id,
      verifierName: adminUser.full_name,
      testName: 'Diagnostic Quality Test Sheet (2 copies)',
      testResult: 'passed',
      notes: 'Printed 2 clean sheets without error. Feed path verified clear.'
    });

    assert.strictEqual(passRes.testResult, 'passed');
    assert.strictEqual(passRes.incident.status, 'resolved', 'Incident status must become resolved');
    assert.strictEqual(passRes.equipment.status, 'available', 'Equipment must return to available');

    // Verify recovery audit history
    const recoveryHist = db.get(
      `SELECT * FROM status_history WHERE incident_id = ? AND new_status = 'available'`,
      [testIncidentId]
    );
    assert.ok(recoveryHist, 'Status history must record recovery transition to available');
    assert.strictEqual(recoveryHist.changed_by_name, adminUser.full_name);
  });

  // -------------------------------------------------------------
  // TEST 8: Auth Token Generation & Verification
  // -------------------------------------------------------------
  test('Authentication: Token creation, signing, and verification', () => {
    const token = generateToken({ id: 99, username: 'testuser', role: 'technician' });
    assert.ok(typeof token === 'string' && token.split('.').length === 3, 'Token must be valid 3-part JWT');

    const decoded = verifyToken(token);
    assert.ok(decoded, 'Token must verify successfully');
    assert.strictEqual(decoded.username, 'testuser');
    assert.strictEqual(decoded.role, 'technician');

    // Corrupted signature fails
    const corrupted = token.slice(0, -4) + 'abcd';
    assert.strictEqual(verifyToken(corrupted), null, 'Tampered token must fail verification');
  });

  // -------------------------------------------------------------
  // TEST 9: Approved Manual Retrieval (Feature B Knowledge Base)
  // -------------------------------------------------------------
  test('Manual Retrieval: Paper jam query retrieves Sec 3.1 from printer manual', () => {
    const passages = retrieveApprovedManualPassages('printer', 'The printer is showing a paper jam error in Tray 1', 3);
    assert.ok(passages.length > 0, 'Should find at least 1 passage');
    assert.strictEqual(passages[0].section_number, 'Sec 3.1', 'Top passage must be Sec 3.1');
    assert.ok(passages[0].content.includes('Door A'), 'Passage must include door clearance instructions');
  });

  test('Manual Retrieval Guardrail: Irrelevant query returns empty result', () => {
    const passages = retrieveApprovedManualPassages('printer', 'quantum teleportation antimatter flux', 3);
    assert.strictEqual(passages.length, 0, 'Irrelevant query must return 0 passages to trigger guardrail');
  });

  console.log(`\n========================================`);
  console.log(`Workflow Test Results: ${passed} / ${total} passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    throw new Error(`${total - passed} test(s) failed.`);
  }
}

runWorkflowTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
