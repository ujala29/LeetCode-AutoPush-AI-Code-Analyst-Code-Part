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

app.get('/privacy', (_, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Privacy Policy — LeetCode AI Journal</title>
<style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#222;line-height:1.7}h1{color:#111}h2{margin-top:28px}code{background:#f4f4f4;padding:2px 6px;border-radius:4px}</style>
</head><body>
<h1>Privacy Policy — LeetCode AI Journal</h1>
<p><strong>Last updated: May 2026</strong></p>
<h2>What We Collect</h2>
<p><strong>Google Account Info (name, email):</strong> Collected via Google OAuth sign-in. Used only to identify you on the backend server for sending daily motivation emails. Never sold or shared.</p>
<p><strong>GitHub Personal Access Token:</strong> Stored locally in your browser using AES-GCM encryption. Never sent to our servers. Used only to commit your solution files to your own GitHub repository.</p>
<p><strong>LeetCode Problem Data:</strong> When you get an accepted submission, we read the problem title, difficulty, description, and your code from the LeetCode page. This data is sent to our backend to generate AI analysis. It is not stored permanently on our servers.</p>
<h2>What We Do NOT Collect</h2>
<ul><li>Passwords</li><li>Payment or financial information</li><li>Location data</li><li>General browsing history</li><li>Keystrokes or mouse activity outside LeetCode</li></ul>
<h2>Data Storage</h2>
<ul>
<li>GitHub token: encrypted locally in your browser (<code>chrome.storage.local</code>)</li>
<li>Solve stats (streak, topics, difficulty counts): stored locally in your browser only</li>
<li>Email + solve summary: stored on our backend server solely for sending daily emails</li>
</ul>
<h2>Third-Party Services</h2>
<ul>
<li><strong>Groq API</strong> — receives your LeetCode problem and code for AI analysis</li>
<li><strong>GitHub API</strong> — receives your solution files to commit to your repository</li>
<li><strong>Resend</strong> — used to send daily motivation emails to your registered address</li>
<li><strong>Google OAuth</strong> — used for sign-in only</li>
</ul>
<h2>Data Deletion</h2>
<p>To delete your data: sign out from the extension popup, and contact us at <a href="mailto:aanyagupta980@gmail.com">aanyagupta980@gmail.com</a> to remove your email from our server.</p>
<h2>Contact</h2>
<p><a href="mailto:aanyagupta980@gmail.com">aanyagupta980@gmail.com</a></p>
</body></html>`);
});

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
