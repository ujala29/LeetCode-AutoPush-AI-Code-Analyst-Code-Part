// utils/github.js
import { decryptValue } from './crypto.js';

const OWNER = 'ujala29';
const REPO = 'LeetCode-AutoPush-AI-Code-Analyst';

export async function commitToGitHub(files, commitMessage) {
  const { githubToken: encryptedToken } = await chrome.storage.local.get(['githubToken']);
  if (!encryptedToken) {
    throw new Error('GitHub token not configured. Please add it in Settings.');
  }
  const token = await decryptValue(encryptedToken);

  for (const file of files) {
    await commitFileWithRetry(token, file, commitMessage);
  }
}

async function commitFileWithRetry(token, file, commitMessage, maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s, 3s back-off
    }

    // Always fetch a fresh SHA — never reuse a cached one to avoid 409 conflicts
    let sha = null;
    try {
      const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${file.path}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
      );
      if (res.ok) sha = (await res.json()).sha;
    } catch (_) {
      // File doesn't exist yet — sha stays null
    }

    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${file.path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: commitMessage, content: toBase64(file.content), sha })
      }
    );

    if (res.ok) {
      const data = await res.json();
      console.log(`[LeetCode AI] Committed ${file.path}: ${data.commit.sha}`);
      return;
    }

    // Specific error messages for common failure cases
    if (res.status === 401) {
      throw new Error('GitHub token expired or revoked — please update it in Settings.');
    }
    if (res.status === 403) {
      throw new Error('GitHub rate limit hit or token lacks repo write permission.');
    }
    if (res.status === 404) {
      throw new Error(`GitHub repo not found — verify that ${OWNER}/${REPO} exists and your token has access.`);
    }

    if (res.status === 409 && attempt < maxAttempts - 1) {
      console.warn(`[LeetCode AI] SHA conflict on ${file.path}, retrying (attempt ${attempt + 1})`);
      continue;
    }

    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`GitHub API error: ${res.status} — ${err.message}`);
  }
}

// Chunked base64 encoding — avoids call stack overflow on large files (>65k bytes)
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
