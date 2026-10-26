import express from 'express';
import { getAIStatus, classifyFaultReport } from '../services/gemmaService.js';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/ai/status
 * Returns connection and configuration status of Gemma 4
 */
router.get('/status', (req, res) => {
  try {
    const status = getAIStatus();
    res.json(status);
  } catch (err) {
    console.error('Error fetching AI status:', err);
    res.status(500).json({ error: 'Failed to retrieve AI status.' });
  }
});

/**
 * POST /api/ai/classify
 * Direct fault classification preview (used by Report a Fault form)
 */
router.post('/classify', async (req, res) => {
  try {
    const { description, equipmentId } = req.body;
    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required.' });
    }

    let equipmentMetadata = {};
    if (equipmentId) {
      const eq = db.get('SELECT * FROM equipment WHERE id = ?', [equipmentId]);
      if (eq) equipmentMetadata = eq;
    }

    const classification = await classifyFaultReport(description, equipmentMetadata);
    res.json({
      success: true,
      classification
    });
  } catch (err) {
    console.error('Error classifying fault:', err);
    res.status(500).json({ error: 'Failed to classify fault report.' });
  }
});

export default router;
