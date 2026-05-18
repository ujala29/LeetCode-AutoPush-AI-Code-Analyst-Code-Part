// utils/claude.js — all AI calls routed through backend proxy.
// No API keys live in the extension. Auth uses Google OAuth Bearer token.

import { getToken, refreshToken } from './auth.js';

async function backendFetch(path, body) {
  const { backendUrl } = await chrome.storage.local.get(['backendUrl']);
  const base = (backendUrl || 'http://localhost:3000').replace(/\/$/, '');

  let token = await getToken();
  if (!token) {
    throw new Error('Not signed in. Please open the extension popup and sign in with Google.');
  }

  async function doFetch(authToken) {
    try {
      return await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(body)
      });
    } catch (networkErr) {
      throw new Error(`Cannot reach backend at ${base} — is it running?\n(${networkErr.message})`);
    }
  }

  let res = await doFetch(token);

  // Token expired — refresh once and retry
  if (res.status === 401) {
    try {
      token = await refreshToken(token);
      res = await doFetch(token);
    } catch {
      throw new Error('Session expired. Please sign in again in the extension popup.');
    }
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Backend returned non-JSON (status ${res.status}): ${text.substring(0, 120)}`);
  }

  // 200 with _error means backend used a fallback — let it through
  if (!res.ok && !data._error) {
    throw new Error(data.error || `Backend error ${res.status}`);
  }

  return data;
}

export async function analyzeWithClaude({ code, lang, meta }) {
  console.log('[LeetCode AI] Requesting analysis via backend');
  const analysis = await backendFetch('/api/analyze', { code, lang, meta });
  if (analysis._error) {
    console.warn('[LeetCode AI] Analysis used fallback due to:', analysis._error);
  }
  return analysis;
}

export async function chatWithAI(messages, trackerSummary, problemContext) {
  const data = await backendFetch('/api/chat', { messages, trackerSummary, problemContext });
  return data.reply;
}
