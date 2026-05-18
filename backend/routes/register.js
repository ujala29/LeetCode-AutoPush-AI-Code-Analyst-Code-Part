import express from 'express';
import { upsertUser } from '../lib/userStore.js';

const router = express.Router();

// POST /api/register — called by background.js after every successful solve
// Upserts user's latest tracker stats so the scheduler has fresh data for emails
router.post('/', async (req, res) => {
  const { tracker } = req.body;
  const { email, name } = req.user; // injected by auth middleware

  try {
    upsertUser(email, {
      name,
      streak: tracker?.streak?.current || 0,
      weakTopics: tracker?.weakTopics || [],
      totalSolved: tracker?.solves?.length || 0
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[register] error:', err.message);
    return res.status(500).json({ error: 'Failed to save user data' });
  }
});

export default router;
