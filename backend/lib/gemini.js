const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

/**
 * Calls Groq (OpenAI-compatible) with automatic retry on 429 rate-limit errors.
 * Throws on network failure, timeout, non-2xx status, or empty response.
 */
export async function callGemini(contents, systemInstruction, config = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set on server');

  // Convert Gemini-style contents to OpenAI-style messages
  const messages = [
    { role: 'system', content: systemInstruction },
    ...contents.map(c => ({
      role: c.role === 'model' ? 'assistant' : c.role,
      content: c.parts[0].text
    }))
  ];

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: config.temperature ?? 0.1,
          max_tokens: config.maxOutputTokens ?? 1200
        })
      });

      if (response.status === 429) {
        const body = await response.json().catch(() => ({}));
        const retryMatch = body.error?.message?.match(/try again in ([\d.]+)s/i);
        const waitMs = retryMatch ? parseFloat(retryMatch[1]) * 1000 + 1000 : (attempt + 1) * 5000;

        if (attempt < MAX_RETRIES) {
          console.warn(`[groq] 429 rate limit — retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, waitMs));
          lastError = new Error(`Groq 429: ${body.error?.message || 'rate limited'}`);
          continue;
        }
        throw new Error('Groq 429: rate limit exceeded after retries');
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Groq ${response.status}: ${body.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Groq returned an empty response');

      return text;

    } catch (err) {
      if (err.name === 'AbortError') throw new Error(`Groq timed out after ${TIMEOUT_MS / 1000}s`);
      if (err.message.startsWith('Groq 429') && attempt < MAX_RETRIES) {
        lastError = err;
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

/** Strips ```json ... ``` fences that LLMs sometimes wrap around JSON. */
export function stripFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}
