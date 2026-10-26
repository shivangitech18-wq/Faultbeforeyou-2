import express from 'express';
import { retrieveApprovedManualPassages, getAllManuals } from '../services/manualService.js';
import { generateManualGroundedTroubleshooting } from '../services/gemmaService.js';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/troubleshoot/manuals
 * List all available approved demonstration manuals
 */
router.get('/manuals', (req, res) => {
  try {
    const manuals = getAllManuals();
    res.json(manuals);
  } catch (err) {
    console.error('Error fetching manuals:', err);
    res.status(500).json({ error: 'Failed to retrieve manuals.' });
  }
});

/**
 * POST /api/troubleshoot/query
 * Gemma Feature B: Approved-Manual Grounded Troubleshooting
 */
router.post('/query', async (req, res) => {
  try {
    const { equipmentType, equipmentId, faultDescription } = req.body;

    if (!faultDescription || faultDescription.trim() === '') {
      return res.status(400).json({ error: 'Fault description is required.' });
    }

    let resolvedType = equipmentType;
    let equipmentName = null;

    if (equipmentId) {
      const eq = db.get('SELECT * FROM equipment WHERE id = ?', [equipmentId]);
      if (eq) {
        resolvedType = eq.type;
        equipmentName = eq.name;
      }
    }

    if (!resolvedType) {
      return res.status(400).json({ error: 'Equipment type or ID is required.' });
    }

    // Step 1: Lightweight retrieval from SQLite knowledge base
    const retrievedPassages = retrieveApprovedManualPassages(resolvedType, faultDescription, 3);

    // Step 2: Grounded inference with Gemma 4
    const guidanceResult = await generateManualGroundedTroubleshooting(
      resolvedType,
      faultDescription,
      retrievedPassages
    );

    res.json({
      success: true,
      equipmentType: resolvedType,
      equipmentName,
      query: faultDescription,
      retrievedPassageCount: retrievedPassages.length,
      guidance: guidanceResult
    });
  } catch (err) {
    console.error('Troubleshooting error:', err);
    res.status(500).json({ error: 'Failed to generate manual troubleshooting guidance.' });
  }
});

export default router;
