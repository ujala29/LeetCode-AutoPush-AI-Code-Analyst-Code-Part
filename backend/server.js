import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifyGoogleToken } from './lib/auth.js';
import { startScheduler } from './lib/scheduler.js';
import analyzeRouter from './routes/analyze.js';
import chatRouter from './routes/chat.js';
import registerRouter from './routes/register.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50kb' }));

// Public — no auth (use for health checks / uptime monitors)
app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// Auth middleware — all /api/* routes require a valid Google OAuth token
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = await verifyGoogleToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: `Auth failed: ${err.message}` });
  }
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/chat', chatRouter);
app.use('/api/register', registerRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[backend] running on port ${PORT}`);
  startScheduler();
});
