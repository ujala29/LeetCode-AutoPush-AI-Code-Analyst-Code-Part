import { fetchLeetCodeMeta, fetchLeetCodeSubmissionCode } from './utils/leetcode.js';
import { analyzeWithClaude, chatWithAI } from './utils/claude.js';
import { commitToGitHub } from './utils/github.js';
import { updateTracker } from './utils/tracker.js';
import { buildReadme } from './utils/readme-builder.js';
import { getToken } from './utils/auth.js';

// In-memory dedup — also persisted to storage so SW restarts don't cause double-processing
const processedSubmissions = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBMISSION_ACCEPTED') {
    handleSubmissionAccepted(message.payload, sender);
    sendResponse({ status: 'processing' });

  } else if (message.type === 'GET_TRACKER') {
    chrome.storage.local.get(['tracker'], (result) => {
      sendResponse(result.tracker || {});
    });
    return true;

  } else if (message.type === 'AI_CHAT') {
    handleAIChat(message.messages, message.problemContext).then(reply => {
      sendResponse({ reply });
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true;
  }
});

async function handleSubmissionAccepted(payload, sender) {
  // Check in-memory set first (fast path)
  if (payload.submissionId && processedSubmissions.has(payload.submissionId)) return;

  // Also check storage to survive service worker restarts
  const { seenSubmissions = [] } = await chrome.storage.local.get(['seenSubmissions']);
  if (payload.submissionId && seenSubmissions.includes(payload.submissionId)) return;

  if (payload.submissionId) {
    processedSubmissions.add(payload.submissionId);
    await chrome.storage.local.set({
      seenSubmissions: [...seenSubmissions, payload.submissionId].slice(-100) // keep last 100
    });
  }

  const notify = (status, message) => {
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'PROCESSING_COMPLETE', status, message });
    }
  };

  try {
    const code = payload.code || await fetchLeetCodeSubmissionCode(payload.submissionId);
    if (!code) throw new Error('Could not retrieve submission code from LeetCode');

    const rawMeta = await fetchLeetCodeMeta(payload.slug);

    // Defensive defaults — meta fields can be undefined if LeetCode GraphQL returns null
    const meta = {
      title: rawMeta.title || payload.meta?.title || payload.slug,
      difficulty: rawMeta.difficulty || payload.meta?.difficulty || 'Unknown',
      tags: rawMeta.tags || payload.meta?.tags || [],
      content: rawMeta.content || '',
      hints: rawMeta.hints || []
    };

    const analysis = await analyzeWithClaude({ code, lang: payload.lang, meta });

    // Persist analysis to storage BEFORE touching GitHub.
    // If GitHub commits fail, the solve data is not lost.
    const dateStr = new Date().toISOString().split('T')[0];
    await chrome.storage.local.set({
      pendingCommit: { slug: payload.slug, code, lang: payload.lang, meta, analysis, dateStr }
    });

    const problemPath = `problems/${payload.slug}`;

    const files = [
      {
        path: `${problemPath}/solution.${getFileExtension(payload.lang)}`,
        content: code
      },
      {
        path: `${problemPath}/README.md`,
        content: buildReadme({ slug: payload.slug, code, lang: payload.lang, meta, analysis, dateStr })
      }
    ];

    await commitToGitHub(files, `[${dateStr}] ${meta.title} — ${analysis.essence}`);

    const { tracker } = await chrome.storage.local.get(['tracker']);
    const updatedTracker = updateTracker(tracker || {}, { slug: payload.slug, dateStr, meta, analysis });

    await commitToGitHub(
      [
        { path: 'tracker.json', content: JSON.stringify(updatedTracker, null, 2) },
        { path: 'README.md', content: buildRootReadme(updatedTracker) }
      ],
      `update stats — ${dateStr}`
    );

    await chrome.storage.local.set({ tracker: updatedTracker });
    await chrome.storage.local.remove(['pendingCommit']);

    // Sync user data to backend for daily email notifications (fire-and-forget)
    syncUserToBackend(updatedTracker).catch(err =>
      console.warn('[LeetCode AI] User sync skipped:', err.message)
    );

    notify('success');

  } catch (err) {
    console.error('[LeetCode AI] submission pipeline failed:', err);
    notify('error', err.message);
  }
}

async function handleAIChat(messages, problemContext) {
  const { tracker } = await chrome.storage.local.get(['tracker']);

  const topTopics = Object.entries(tracker?.topics || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, c]) => `${t} (${c})`)
    .join(', ');

  const weakTopics = (tracker?.weakTopics || []).slice(0, 5).join(', ');
  const recentSolves = (tracker?.solves || [])
    .slice(-5)
    .map(s => `${s.title} (${s.difficulty}) — ${s.essence}`)
    .join('; ');

  return chatWithAI(messages, {
    topTopics,
    weakTopics,
    recentSolves,
    streak: tracker?.streak?.current || 0
  }, problemContext);
}

function buildRootReadme(tracker) {
  const total = tracker.solves?.length || 0;
  const { current: streak = 0, best: bestStreak = 0 } = tracker.streak || {};
  const { Easy: easy = 0, Medium: medium = 0, Hard: hard = 0 } = tracker.difficulty || {};
  const recent = (tracker.solves || []).slice(-10).reverse();

  let md = `# LeetCode AI Journal

Auto-generated dashboard from your LeetCode solving journey.

## Stats
- **Total Solved**: ${total}
- **Current Streak**: ${streak} days 🔥
- **Best Streak**: ${bestStreak} days
- **Difficulty Breakdown**: Easy: ${easy}, Medium: ${medium}, Hard: ${hard}

## Recent Solves
| Date | Problem | Difficulty | Approach |
|------|---------|------------|----------|
`;

  recent.forEach(s => {
    md += `| ${s.date} | [${s.title}](https://leetcode.com/problems/${s.slug}) | ${s.difficulty} | ${s.approach} |\n`;
  });

  return md;
}

async function syncUserToBackend(tracker) {
  const { backendUrl } = await chrome.storage.local.get(['backendUrl']);
  const base = (backendUrl || 'http://localhost:3000').replace(/\/$/, '');
  const token = await getToken();
  if (!token) return;
  await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ tracker })
  });
}

function getFileExtension(lang) {
  const map = {
    python: 'py', python3: 'py', java: 'java',
    cpp: 'cpp', 'c++': 'cpp', c: 'c',
    javascript: 'js', typescript: 'ts',
    go: 'go', rust: 'rs', kotlin: 'kt',
    swift: 'swift', ruby: 'rb', php: 'php',
    scala: 'scala', racket: 'rkt', erlang: 'erl', elixir: 'ex'
  };
  return map[lang?.toLowerCase()] || 'txt';
}
