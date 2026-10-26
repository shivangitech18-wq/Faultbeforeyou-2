import express from 'express';
import { db } from '../db/database.js';
import { IncidentService } from '../services/incidentService.js';
import { summarizeEquipmentIncidentHistory } from '../services/gemmaService.js';

const router = express.Router();

/**
 * GET /api/equipment/metrics
 * Summary counts for Dashboard cards
 */
router.get('/metrics', (req, res) => {
  try {
    const totalEquipment = db.get('SELECT COUNT(*) as count FROM equipment').count;
    const availableEquipment = db.get("SELECT COUNT(*) as count FROM equipment WHERE status = 'available'").count;
    const outOfServiceEquipment = db.get("SELECT COUNT(*) as count FROM equipment WHERE status = 'out_of_service'").count;
    const openIncidents = db.get("SELECT COUNT(*) as count FROM incidents WHERE status != 'resolved'").count;
    
    // Incidents resolved today (UTC / local midnight)
    const resolvedToday = db.get(`
      SELECT COUNT(*) as count 
      FROM incidents 
      WHERE status = 'resolved' 
        AND resolved_at >= date('now', 'start of day')
    `).count;

    res.json({
      totalEquipment,
      availableEquipment,
      outOfServiceEquipment,
      openIncidents,
      resolvedToday
    });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Failed to calculate dashboard metrics.' });
  }
});

/**
 * GET /api/equipment
 * List equipment with filters and active fault warning metadata
 */
router.get('/', (req, res) => {
  try {
    const { search, status, type, location } = req.query;

    let sql = `
      SELECT e.*,
        (SELECT COUNT(*) FROM incidents WHERE equipment_id = e.id AND status != 'resolved') as active_incident_count,
        (SELECT description FROM incidents WHERE equipment_id = e.id AND status != 'resolved' ORDER BY created_at DESC LIMIT 1) as active_fault_description,
        (SELECT severity FROM incidents WHERE equipment_id = e.id AND status != 'resolved' ORDER BY created_at DESC LIMIT 1) as active_fault_severity,
        (SELECT id FROM incidents WHERE equipment_id = e.id AND status != 'resolved' ORDER BY created_at DESC LIMIT 1) as active_incident_id
      FROM equipment e
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (e.id LIKE ? OR e.name LIKE ? OR e.location LIKE ? OR e.model_number LIKE ?)`;
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (status && status !== 'all') {
      sql += ` AND e.status = ?`;
      params.push(status);
    }

    if (type && type !== 'all') {
      sql += ` AND e.type = ?`;
      params.push(type);
    }

    if (location && location !== 'all') {
      sql += ` AND e.location LIKE ?`;
      params.push(`%${location}%`);
    }

    sql += ` ORDER BY CASE WHEN e.status = 'out_of_service' THEN 0 ELSE 1 END, e.id ASC`;

    const equipmentList = db.query(sql, params);
    res.json(equipmentList);
  } catch (err) {
    console.error('Error fetching equipment:', err);
    res.status(500).json({ error: 'Failed to retrieve equipment list.' });
  }
});

/**
 * GET /api/equipment/:id
 * Retrieve details of a single equipment unit
 */
router.get('/:id', (req, res) => {
  try {
    const equipment = db.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    if (!equipment) {
      return res.status(404).json({ error: `Equipment "${req.params.id}" not found.` });
    }

    // Active incident if any
    const activeIncident = db.get(
      `SELECT * FROM incidents WHERE equipment_id = ? AND status != 'resolved' ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    // Latest verification record
    const latestVerification = db.get(
      `SELECT * FROM verification_records WHERE equipment_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );

    res.json({
      equipment,
      activeIncident,
      latestVerification
    });
  } catch (err) {
    console.error('Error fetching equipment details:', err);
    res.status(500).json({ error: 'Failed to retrieve equipment details.' });
  }
});

/**
 * GET /api/equipment/:id/history
 * Comprehensive incident and status history
 */
router.get('/:id/history', (req, res) => {
  try {
    const historyData = IncidentService.getEquipmentHistory(req.params.id);
    if (!historyData) {
      return res.status(404).json({ error: `Equipment "${req.params.id}" not found.` });
    }
    res.json(historyData);
  } catch (err) {
    console.error('Error fetching equipment history:', err);
    res.status(500).json({ error: 'Failed to retrieve equipment history.' });
  }
});

/**
 * GET /api/equipment/:id/ai-summary
 * Gemma Feature C: Incident Intelligence Summary
 */
router.get('/:id/ai-summary', async (req, res) => {
  try {
    const historyData = IncidentService.getEquipmentHistory(req.params.id);
    if (!historyData) {
      return res.status(404).json({ error: `Equipment "${req.params.id}" not found.` });
    }

    const aiSummary = await summarizeEquipmentIncidentHistory(
      historyData.equipment,
      historyData.incidents,
      historyData.verifications
    );

    res.json({
      equipmentId: req.params.id,
      equipmentName: historyData.equipment.name,
      incidentCount: historyData.incidents.length,
      verificationCount: historyData.verifications.length,
      aiSummary
    });
  } catch (err) {
    console.error('Error generating AI incident summary:', err);
    res.status(500).json({ error: 'Failed to generate Gemma incident intelligence.' });
  }
});

export default router;
