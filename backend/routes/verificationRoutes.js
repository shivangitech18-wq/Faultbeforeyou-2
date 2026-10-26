import express from 'express';
import { db } from '../db/database.js';
import { IncidentService } from '../services/incidentService.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/verification
 * Record a verification test result.
 * CRITICAL WORKFLOW: Only authorized verifier / admin can resolve equipment recovery.
 * Protected: Admin only.
 */
router.post('/', authenticate, requireAuth, requireRole(['admin']), (req, res) => {
  try {
    const { incidentId, testName, testResult, notes } = req.body;

    if (!incidentId || !testName || !testResult) {
      return res.status(400).json({
        error: 'Incident ID, test name, and test result ("passed" or "failed") are required.'
      });
    }

    if (!['passed', 'failed'].includes(testResult)) {
      return res.status(400).json({
        error: 'testResult must be either "passed" or "failed".'
      });
    }

    const result = IncidentService.recordVerification({
      incidentId: parseInt(incidentId, 10),
      verifierId: req.user.id,
      verifierName: req.user.fullName || req.user.username,
      testName: testName.trim(),
      testResult,
      notes: notes ? notes.trim() : ''
    });

    res.json({
      success: true,
      message: testResult === 'passed'
        ? `Recovery VERIFIED! Incident #${incidentId} is RESOLVED and equipment is now AVAILABLE.`
        : `Verification FAILED. Incident #${incidentId} remains open and equipment remains OUT OF SERVICE.`,
      result
    });
  } catch (err) {
    console.error('Error recording verification:', err);
    res.status(400).json({ error: err.message || 'Failed to record verification.' });
  }
});

/**
 * GET /api/verification/history
 * List historical verification tests across all equipment
 */
router.get('/history', (req, res) => {
  try {
    const records = db.query(`
      SELECT v.*, e.name as equipment_name, e.type as equipment_type, e.location as equipment_location,
        i.description as incident_description
      FROM verification_records v
      JOIN equipment e ON v.equipment_id = e.id
      JOIN incidents i ON v.incident_id = i.id
      ORDER BY v.created_at DESC
      LIMIT 100
    `);
    res.json(records);
  } catch (err) {
    console.error('Error fetching verification history:', err);
    res.status(500).json({ error: 'Failed to retrieve verification history.' });
  }
});

export default router;
