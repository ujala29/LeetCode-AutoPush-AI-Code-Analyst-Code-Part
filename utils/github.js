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

// Fetches a fresh SHA before every attempt so stale-SHA 409s are self-healing
async function commitFileWithRetry(token, file, commitMessage, maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s, 3s back-off
    }

    // Always fetch the current SHA fresh — never reuse a cached one
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

    const base64Content = btoa(String.fromCharCode(...new TextEncoder().encode(file.content)));

    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${file.path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: commitMessage, content: base64Content, sha })
      }
    );

    if (res.ok) {
      const data = await res.json();
      console.log(`[LeetCode AI] Committed ${file.path}: ${data.commit.sha}`);
      return;
    }

    if (res.status === 409 && attempt < maxAttempts - 1) {
      console.warn(`[LeetCode AI] SHA conflict on ${file.path}, retrying (attempt ${attempt + 1})`);
      continue; // loop re-fetches a fresh SHA at the top
    }

    const err = await res.json();
    throw new Error(`GitHub API error: ${res.status} - ${err.message}`);
  }
}
