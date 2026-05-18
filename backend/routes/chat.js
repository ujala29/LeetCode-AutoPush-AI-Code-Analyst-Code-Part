import express from 'express';
import { callGemini } from '../lib/gemini.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { messages, trackerSummary, problemContext } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // callGemini (lib/gemini.js) actually calls Groq with OpenAI-compatible format.
  // It expects role: 'model' for assistant turns (converted internally).
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const systemPrompt = buildSystemPrompt(trackerSummary || {}, problemContext || null);

  try {
    const reply = await callGemini(contents, systemPrompt, {
      temperature: 0.7,
      maxOutputTokens: 800
    });
    return res.json({ reply });
  } catch (err) {
    console.error('[chat] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

function buildSystemPrompt(summary, ctx) {
  let prompt = `You are a personalized DSA (Data Structures & Algorithms) mentor.

User profile:
- Strongest topics: ${summary.topTopics || 'None yet'}
- Weakest / not attempted: ${summary.weakTopics || 'None identified'}
- Current streak: ${summary.streak || 0} days
- Last solved: ${summary.recentSolves || 'None yet'}`;

  if (ctx?.title) {
    prompt += `

Current problem the user is looking at:
- Title: ${ctx.title}${ctx.difficulty ? ` (${ctx.difficulty})` : ''}`;

    if (ctx.description) {
      prompt += `
- Description: ${ctx.description.substring(0, 500)}`;
    }

    if (ctx.code && ctx.code.trim()) {
      prompt += `
- User's current code (first 800 chars):
\`\`\`
${ctx.code.substring(0, 800)}
\`\`\``;
    }
  }

  prompt += `

Answer specifically to their skill level and history. Reference their past solves when relevant. Suggest next problems from their weak areas when asked. Be concise — responses should be 2-4 short paragraphs max. Use markdown formatting where helpful.`;

  return prompt;
}

export default router;
