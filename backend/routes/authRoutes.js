import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = db.get('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role
    };

    const token = generateToken(tokenPayload);

    res.json({
      success: true,
      token,
      user: tokenPayload
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal authentication error.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: req.user
  });
});

/**
 * GET /api/auth/demo-users
 * Returns available demonstration accounts for hackathon judges & testers
 */
router.get('/demo-users', (req, res) => {
  const users = [
    {
      username: 'viewer',
      role: 'viewer',
      fullName: 'Victoria Viewer',
      description: 'Read-only access: view equipment, warning alerts, and manuals.'
    },
    {
      username: 'reporter',
      role: 'reporter',
      fullName: 'Riley Reporter',
      description: 'General user: can report equipment faults and request manual troubleshooting.'
    },
    {
      username: 'tech',
      role: 'technician',
      fullName: 'Taylor Technician',
      description: 'Technician: can investigate faults, log repair attempts, and request verification.'
    },
    {
      username: 'admin',
      role: 'admin',
      fullName: 'Alex Admin (Authorized Verifier)',
      description: 'Authorized verifier: can perform recovery test verification to resolve equipment.'
    }
  ];

  res.json(users);
});

export default router;
