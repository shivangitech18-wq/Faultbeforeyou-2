import { db } from '../db/database.js';
import { classifyFaultReport } from './gemmaService.js';

export class IncidentService {
  /**
   * Report an equipment fault.
   * Immediately transitions equipment to 'out_of_service' and notifies all users.
   */
  static async reportFault({ equipmentId, reporterId, reporterName, description, skipAi = false }) {
    if (!equipmentId || !description) {
      throw new Error('Equipment ID and fault description are required.');
    }

    // Verify equipment exists
    const equipment = db.get('SELECT * FROM equipment WHERE id = ?', [equipmentId]);
    if (!equipment) {
      throw new Error(`Equipment with ID "${equipmentId}" not found.`);
    }

    const previousStatus = equipment.status;

    // Optional AI Classification with Gemma 4
    let aiResult = {
      category: 'Hardware',
      summary: description.slice(0, 100),
      suggestedSeverity: 'Medium',
      recommendedNextStep: 'Inspect equipment and follow approved manual steps.',
      technicianRequired: true,
      reasoningSummary: 'Initial fault submission'
    };

    if (!skipAi) {
      try {
        aiResult = await classifyFaultReport(description, equipment);
      } catch (err) {
        console.warn('AI classification skipped or failed:', err.message);
      }
    }

    // Begin database updates
    // 1. Insert incident record
    const insertIncident = db.instance.prepare(`
      INSERT INTO incidents (
        equipment_id, reporter_id, reporter_name, description,
        category, severity, ai_summary, ai_next_step, technician_required, ai_reasoning,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reported')
    `);

    const incRes = insertIncident.run(
      equipmentId,
      reporterId || null,
      reporterName || 'Anonymous Reporter',
      description,
      aiResult.category,
      aiResult.suggestedSeverity,
      aiResult.summary,
      aiResult.recommendedNextStep,
      aiResult.technicianRequired ? 1 : 0,
      aiResult.reasoningSummary
    );

    const incidentId = incRes.lastInsertRowid;

    // 2. Mark equipment OUT OF SERVICE immediately
    db.run(
      `UPDATE equipment SET status = 'out_of_service', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [equipmentId]
    );

    // 3. Log to status history
    db.run(
      `INSERT INTO status_history (
        equipment_id, incident_id, previous_status, new_status,
        changed_by_id, changed_by_name, reason
      ) VALUES (?, ?, ?, 'out_of_service', ?, ?, ?)`,
      [
        equipmentId,
        incidentId,
        previousStatus,
        reporterId || null,
        reporterName || 'Fault Reporter',
        `Fault reported: ${description.slice(0, 120)}`
      ]
    );

    // 4. Create broadcast notification
    db.run(
      `INSERT INTO notifications (equipment_id, incident_id, type, title, message)
       VALUES (?, ?, 'warning', 'Equipment Out of Service', ?)`,
      [
        equipmentId,
        incidentId,
        `⚠️ ${equipment.name} (${equipmentId}) is OUT OF SERVICE due to reported fault: "${description.slice(0, 80)}"`
      ]
    );

    // Fetch refreshed records
    const updatedIncident = db.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    const updatedEquipment = db.get('SELECT * FROM equipment WHERE id = ?', [equipmentId]);

    return {
      incident: updatedIncident,
      equipment: updatedEquipment,
      aiAnalysis: aiResult
    };
  }

  /**
   * Record a technician repair attempt or update note.
   */
  static recordTechnicianUpdate({ incidentId, userId, userName, userRole, note, actionTaken, moveStatusToAwaiting = false }) {
    if (!incidentId || !note) {
      throw new Error('Incident ID and update note are required.');
    }

    const incident = db.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) {
      throw new Error(`Incident #${incidentId} not found.`);
    }

    if (incident.status === 'resolved') {
      throw new Error('Cannot update an incident that has already been resolved.');
    }

    // Determine new status
    let nextStatus = incident.status;
    if (moveStatusToAwaiting) {
      nextStatus = 'awaiting_verification';
    } else if (incident.status === 'reported') {
      nextStatus = 'under_investigation';
    }

    // Insert update record
    db.run(
      `INSERT INTO incident_updates (incident_id, user_id, user_name, user_role, update_type, note, action_taken)
       VALUES (?, ?, ?, ?, 'repair_attempt', ?, ?)`,
      [
        incidentId,
        userId || null,
        userName || 'Technician',
        userRole || 'technician',
        note,
        actionTaken || null
      ]
    );

    // Update incident status
    db.run(
      `UPDATE incidents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [nextStatus, incidentId]
    );

    // Add notification
    const notePreview = note.length > 70 ? note.slice(0, 70) + '...' : note;
    db.run(
      `INSERT INTO notifications (equipment_id, incident_id, type, title, message)
       VALUES (?, ?, 'info', ?, ?)`,
      [
        incident.equipment_id,
        incidentId,
        moveStatusToAwaiting ? 'Ready for Verification' : 'Technician Repair Underway',
        `Incident #${incidentId}: ${userName} recorded repair - "${notePreview}". Status: ${nextStatus.replace('_', ' ').toUpperCase()}`
      ]
    );

    return {
      incidentId,
      status: nextStatus,
      updates: db.query('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at DESC', [incidentId])
    };
  }

  /**
   * Record verification result from an authorized verifier/admin.
   * CRITICAL WORKFLOW REQUIREMENT:
   * - If test passes: Incident -> 'resolved', Equipment -> 'available'
   * - If test fails: Incident remains unresolved ('under_investigation'), Equipment stays 'out_of_service'
   */
  static recordVerification({ incidentId, verifierId, verifierName, testName, testResult, notes }) {
    if (!incidentId || !testName || !testResult) {
      throw new Error('Incident ID, test name, and test result (passed/failed) are required.');
    }

    if (!['passed', 'failed'].includes(testResult)) {
      throw new Error('testResult must be either "passed" or "failed".');
    }

    const incident = db.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) {
      throw new Error(`Incident #${incidentId} not found.`);
    }

    const equipment = db.get('SELECT * FROM equipment WHERE id = ?', [incident.equipment_id]);
    if (!equipment) {
      throw new Error(`Equipment ${incident.equipment_id} not found.`);
    }

    // 1. Store verification record
    const verRes = db.run(
      `INSERT INTO verification_records (
        incident_id, equipment_id, verifier_id, verifier_name,
        test_name, test_result, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        incidentId,
        incident.equipment_id,
        verifierId,
        verifierName,
        testName,
        testResult,
        notes || ''
      ]
    );

    const verificationRecordId = verRes.lastInsertRowid;

    if (testResult === 'passed') {
      // SUCCESSFUL VERIFICATION WORKFLOW:
      // Mark incident resolved
      db.run(
        `UPDATE incidents
         SET status = 'resolved', updated_at = CURRENT_TIMESTAMP, resolved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [incidentId]
      );

      // Check if there are any other unresolved incidents on this equipment
      const otherOpenIncidents = db.get(
        `SELECT COUNT(*) as count FROM incidents WHERE equipment_id = ? AND status != 'resolved' AND id != ?`,
        [incident.equipment_id, incidentId]
      );

      // Return equipment to AVAILABLE only if no other active faults exist
      if (otherOpenIncidents.count === 0) {
        db.run(
          `UPDATE equipment SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [incident.equipment_id]
        );

        // Record status history
        db.run(
          `INSERT INTO status_history (
            equipment_id, incident_id, previous_status, new_status,
            changed_by_id, changed_by_name, reason
          ) VALUES (?, ?, ?, 'available', ?, ?, ?)`,
          [
            incident.equipment_id,
            incidentId,
            equipment.status,
            verifierId,
            verifierName,
            `Recovery verified: Passed test "${testName}". ${notes || ''}`
          ]
        );
      }

      // Log update note
      db.run(
        `INSERT INTO incident_updates (incident_id, user_id, user_name, user_role, update_type, note, action_taken)
         VALUES (?, ?, ?, 'admin', 'status_change', ?, ?)`,
        [
          incidentId,
          verifierId,
          verifierName,
          `Verification PASSED: "${testName}". Equipment restored to service.`,
          `Recovery verified via test: ${testName}`
        ]
      );

      // Broadcast recovery notification
      db.run(
        `INSERT INTO notifications (equipment_id, incident_id, type, title, message)
         VALUES (?, ?, 'success', 'Equipment Recovered and Available', ?)`,
        [
          incident.equipment_id,
          incidentId,
          `✅ ${equipment.name} (${incident.equipment_id}) has passed verification test "${testName}" and is now AVAILABLE.`
        ]
      );

    } else {
      // FAILED VERIFICATION WORKFLOW:
      // Incident returns to under_investigation
      db.run(
        `UPDATE incidents SET status = 'under_investigation', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [incidentId]
      );

      // Equipment remains OUT OF SERVICE
      db.run(
        `UPDATE equipment SET status = 'out_of_service', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [incident.equipment_id]
      );

      // Record status history event documenting failed verification
      db.run(
        `INSERT INTO status_history (
          equipment_id, incident_id, previous_status, new_status,
          changed_by_id, changed_by_name, reason
        ) VALUES (?, ?, 'out_of_service', 'out_of_service', ?, ?, ?)`,
        [
          incident.equipment_id,
          incidentId,
          verifierId,
          verifierName,
          `Verification FAILED: Test "${testName}" did not pass. ${notes || ''}. Equipment remains Out of Service.`
        ]
      );

      // Log update note
      db.run(
        `INSERT INTO incident_updates (incident_id, user_id, user_name, user_role, update_type, note, action_taken)
         VALUES (?, ?, ?, 'admin', 'repair_attempt', ?, ?)`,
        [
          incidentId,
          verifierId,
          verifierName,
          `Verification FAILED for test "${testName}". Notes: ${notes || 'Further repair required.'}`,
          'Test failed; sent back to technician'
        ]
      );

      // Broadcast warning notification
      db.run(
        `INSERT INTO notifications (equipment_id, incident_id, type, title, message)
         VALUES (?, ?, 'warning', 'Verification Test Failed', ?)`,
        [
          incident.equipment_id,
          incidentId,
          `❌ ${equipment.name} (${incident.equipment_id}) FAILED recovery verification test "${testName}". Equipment remains OUT OF SERVICE.`
        ]
      );
    }

    return {
      verificationId: verificationRecordId,
      incident: db.get('SELECT * FROM incidents WHERE id = ?', [incidentId]),
      equipment: db.get('SELECT * FROM equipment WHERE id = ?', [incident.equipment_id]),
      testResult
    };
  }

  /**
   * Fetch full incident details including updates, verifications, and equipment status
   */
  static getIncidentDetails(incidentId) {
    const incident = db.get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    if (!incident) return null;

    const equipment = db.get('SELECT * FROM equipment WHERE id = ?', [incident.equipment_id]);
    const updates = db.query('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC', [incidentId]);
    const verifications = db.query('SELECT * FROM verification_records WHERE incident_id = ? ORDER BY created_at DESC', [incidentId]);

    return {
      ...incident,
      equipment,
      updates,
      verifications
    };
  }

  /**
   * Fetch full historical log for a piece of equipment (for Feature C & Equipment Details)
   */
  static getEquipmentHistory(equipmentId) {
    const equipment = db.get('SELECT * FROM equipment WHERE id = ?', [equipmentId]);
    if (!equipment) return null;

    const incidents = db.query(
      `SELECT i.*, 
        (SELECT note FROM incident_updates WHERE incident_id = i.id ORDER BY created_at DESC LIMIT 1) as technician_note
       FROM incidents i
       WHERE i.equipment_id = ?
       ORDER BY i.created_at DESC`,
      [equipmentId]
    );

    const verifications = db.query(
      `SELECT * FROM verification_records WHERE equipment_id = ? ORDER BY created_at DESC`,
      [equipmentId]
    );

    const statusHistory = db.query(
      `SELECT * FROM status_history WHERE equipment_id = ? ORDER BY created_at DESC`,
      [equipmentId]
    );

    return {
      equipment,
      incidents,
      verifications,
      statusHistory
    };
  }
}
