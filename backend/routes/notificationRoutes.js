import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/notifications
 * Active equipment warnings and recent system events
 */
router.get('/', (req, res) => {
  try {
    const notifications = db.query(`
      SELECT n.*, e.name as equipment_name, e.status as equipment_status
      FROM notifications n
      LEFT JOIN equipment e ON n.equipment_id = e.id
      ORDER BY n.created_at DESC
      LIMIT 25
    `);
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

export default router;
