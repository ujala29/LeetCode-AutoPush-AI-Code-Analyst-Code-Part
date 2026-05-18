import express from 'express';
import { callGemini, stripFences } from '../lib/gemini.js';

const router = express.Router();

const REQUIRED_FIELDS = [
  'approach', 'essence', 'logic', 'time_complexity', 'space_complexity',
  'patterns', 'edge_cases_handled', 'what_i_learned', 'similar_problems'
];

const FALLBACK_ANALYSIS = {
  approach: 'Unknown',
  essence: 'Analysis unavailable',
  logic: ['Could not analyze solution'],
  time_complexity: 'Unknown',
  space_complexity: 'Unknown',
  patterns: [],
  edge_cases_handled: [],
  what_i_learned: 'AI analysis failed — solution still committed to GitHub',
  similar_problems: []
};

router.post('/', async (req, res) => {
  const { code, lang, meta } = req.body;

  if (!code || !lang || !meta) {
    return res.status(400).json({ error: 'Missing required fields: code, lang, meta' });
  }

  const systemPrompt = `You are a DSA mentor. Analyze this accepted solution and return ONLY valid JSON with no markdown fences, no explanation text.`;

  const userPrompt = `Problem: ${meta.title || 'Unknown'} — ${meta.difficulty || 'Unknown'}
Description: ${(meta.content || '').substring(0, 800)}
Topic tags: ${(meta.tags || []).join(', ')}
My solution (${lang}):
${code.substring(0, 2000)}

Return ONLY this exact JSON structure (no code fences, no extra text):
{
  "approach": "algorithm/pattern name",
  "essence": "one-sentence core idea for git commit message",
  "logic": ["step 1", "step 2", "step 3"],
  "time_complexity": "O(...) — explanation",
  "space_complexity": "O(...) — explanation",
  "patterns": ["pattern1", "pattern2"],
  "edge_cases_handled": ["case1", "case2"],
  "what_i_learned": "plain English takeaway",
  "similar_problems": ["problem1", "problem2"]
}`;

  try {
    const raw = await callGemini(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemPrompt,
      { temperature: 0.1, maxOutputTokens: 1200 }
    );

    let analysis;
    try {
      analysis = JSON.parse(stripFences(raw));
    } catch (parseErr) {
      console.error('[analyze] JSON parse failed. Raw response:', raw.substring(0, 300));
      throw new Error(`Gemini returned unparseable JSON: ${parseErr.message}`);
    }

    // Fill any missing fields with fallback values so pipeline always gets a complete object
    for (const field of REQUIRED_FIELDS) {
      if (!(field in analysis) || analysis[field] === null || analysis[field] === undefined) {
        analysis[field] = FALLBACK_ANALYSIS[field];
      }
    }

    return res.json(analysis);

  } catch (err) {
    console.error('[analyze] error:', err.message);
    // Return 200 with fallback so the extension pipeline continues (still commits to GitHub)
    return res.json({ ...FALLBACK_ANALYSIS, _error: err.message });
  }
});

export default router;
