// utils/claude.js
import { decryptValue } from './crypto.js';

export const BASE_URL = 'https://truefoundry.innovaccer.com/api/llm/api/inference/openai/';
export const MODEL = 'internal-bedrock/sonnet-46';

export async function analyzeWithClaude({ code, lang, meta }) {
  const { truefoundryKey: encryptedKey } = await chrome.storage.local.get(['truefoundryKey']);
  if (!encryptedKey) {
    throw new Error('TrueFoundry API key not configured. Please add it in Settings.');
  }
  const apiKey = await decryptValue(encryptedKey);

  try {
    const truncatedContent = meta.content ? meta.content.substring(0, 800) : '';
    const truncatedCode = code.substring(0, 2000);

    const systemPrompt = `You are a DSA mentor. Analyze this accepted solution and return ONLY valid JSON.`;
    const userPrompt = `Problem: ${meta.title} — ${meta.difficulty}
Description: ${truncatedContent}
Topic tags: ${meta.tags ? meta.tags.join(', ') : ''}
My solution (${lang}):
${truncatedCode}

Return this JSON schema:
{
  "approach": "name of the algorithm/pattern used",
  "essence": "one-sentence core idea (for commit msg)",
  "logic": ["step 1...", "step 2...", "step 3..."],
  "time_complexity": "O(...) — explanation",
  "space_complexity": "O(...) — explanation",
  "patterns": ["two pointers", "sliding window", ...],
  "edge_cases_handled": ["empty array", ...],
  "what_i_learned": "plain English takeaway",
  "similar_problems": ["problem name 1", "problem name 2", ...]
}`;

    console.log('[LeetCode AI] Sending to TrueFoundry for analysis');

    const response = await fetch(`${BASE_URL}chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1200,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`TrueFoundry API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let jsonText = data.choices[0].message.content;
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    const analysis = JSON.parse(jsonText);

    const requiredFields = ['approach', 'essence', 'logic', 'time_complexity', 'space_complexity', 'patterns', 'edge_cases_handled', 'what_i_learned', 'similar_problems'];
    for (const field of requiredFields) {
      if (!(field in analysis)) throw new Error(`Missing required field: ${field}`);
    }

    console.log('[LeetCode AI] TrueFoundry analysis complete');
    return analysis;

  } catch (error) {
    console.error('[LeetCode AI] TrueFoundry analysis failed:', error);
    return {
      approach: 'Unknown',
      essence: 'Solution analysis failed',
      logic: ['Analysis could not be completed'],
      time_complexity: 'Unknown',
      space_complexity: 'Unknown',
      patterns: [],
      edge_cases_handled: [],
      what_i_learned: 'Analysis failed - please check your TrueFoundry configuration',
      similar_problems: []
    };
  }
}
