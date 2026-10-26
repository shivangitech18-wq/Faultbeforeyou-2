import express from 'express';
import { db } from '../db/database.js';
import { IncidentService } from '../services/incidentService.js';
import { structureTechnicianNotes } from '../services/gemmaService.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/incidents
 * List incidents with optional status or equipment filters
 */
router.get('/', (req, res) => {
  try {
    const { status, equipmentId } = req.query;

    let sql = `
      SELECT i.*, e.name as equipment_name, e.type as equipment_type, e.location as equipment_location,
        (SELECT COUNT(*) FROM incident_updates WHERE incident_id = i.id) as update_count,
        (SELECT COUNT(*) FROM verification_records WHERE incident_id = i.id) as verification_count
      FROM incidents i
      JOIN equipment e ON i.equipment_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ` AND i.status = ?`;
      params.push(status);
    }

    if (equipmentId && equipmentId !== 'all') {
      sql += ` AND i.equipment_id = ?`;
      params.push(equipmentId);
    }

    sql += ` ORDER BY CASE WHEN i.status != 'resolved' THEN 0 ELSE 1 END, i.created_at DESC`;

    const incidents = db.query(sql, params);
    res.json(incidents);
  } catch (err) {
    console.error('Error fetching incidents:', err);
    res.status(500).json({ error: 'Failed to retrieve incidents.' });
  }
});

/**
 * GET /api/incidents/:id
 * Get full incident record with timeline and verification records
 */
router.get('/:id', (req, res) => {
  try {
    const incident = IncidentService.getIncidentDetails(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: `Incident #${req.params.id} not found.` });
    }
    res.json(incident);
  } catch (err) {
    console.error('Error fetching incident details:', err);
    res.status(500).json({ error: 'Failed to retrieve incident details.' });
  }
});

/**
 * POST /api/incidents
 * Report a new fault. Immediately warns everyone and changes equipment to out_of_service.
 * Protected: Reporter, Technician, Admin
 */
router.post('/', authenticate, requireAuth, requireRole(['reporter', 'technician', 'admin']), async (req, res) => {
  try {
    const { equipmentId, description, skipAi } = req.body;

    if (!equipmentId || !description || description.trim() === '') {
      return res.status(400).json({ error: 'Equipment ID and fault description are required.' });
    }

    const result = await IncidentService.reportFault({
      equipmentId: equipmentId.trim(),
      reporterId: req.user.id,
      reporterName: req.user.fullName || req.user.username,
      description: description.trim(),
      skipAi: Boolean(skipAi)
    });

    res.status(201).json({
      success: true,
      message: `Fault reported. ${equipmentId} is now marked OUT OF SERVICE.`,
      incident: result.incident,
      equipment: result.equipment,
      aiAnalysis: result.aiAnalysis
    });
  } catch (err) {
    console.error('Error reporting fault:', err);
    res.status(400).json({ error: err.message || 'Failed to report fault.' });
  }
});

/**
 * POST /api/incidents/:id/update
 * Record a technician repair attempt or status transition.
 * Protected: Technician, Admin
 */
router.post('/:id/update', authenticate, requireAuth, requireRole(['technician', 'admin']), (req, res) => {
  try {
    const { note, actionTaken, moveStatusToAwaiting } = req.body;

    if (!note || note.trim() === '') {
      return res.status(400).json({ error: 'Technician note is required.' });
    }

    const result = IncidentService.recordTechnicianUpdate({
      incidentId: req.params.id,
      userId: req.user.id,
      userName: req.user.fullName || req.user.username,
      userRole: req.user.role,
      note: note.trim(),
      actionTaken: actionTaken ? actionTaken.trim() : null,
      moveStatusToAwaiting: Boolean(moveStatusToAwaiting)
    });

    res.json({
      success: true,
      message: moveStatusToAwaiting
        ? 'Technician repair recorded. Incident moved to AWAITING VERIFICATION.'
        : 'Technician repair attempt logged.',
      result
    });
  } catch (err) {
    console.error('Error recording technician update:', err);
    res.status(400).json({ error: err.message || 'Failed to record technician update.' });
  }
});

/**
 * POST /api/incidents/:id/ai-structure-notes
 * Gemma feature: Structures raw technician scribble into clean standardized steps
 * Protected: Technician, Admin
 */
router.post('/:id/ai-structure-notes', authenticate, requireAuth, requireRole(['technician', 'admin']), async (req, res) => {
  try {
    const { rawNote } = req.body;
    if (!rawNote || rawNote.trim() === '') {
      return res.status(400).json({ error: 'Raw technician note is required.' });
    }

    const incident = db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    const equipment = db.get('SELECT * FROM equipment WHERE id = ?', [incident.equipment_id]);

    const structured = await structureTechnicianNotes(rawNote, equipment || {});
    res.json({
      success: true,
      structured
    });
  } catch (err) {
    console.error('Error structuring technician notes:', err);
    res.status(500).json({ error: 'Failed to structure notes with Gemma.' });
  }
});

export default router;
