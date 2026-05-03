import { fetchLeetCodeMeta, fetchLeetCodeSubmissionCode } from './utils/leetcode.js';
import { analyzeWithClaude, BASE_URL, MODEL } from './utils/claude.js';
import { commitToGitHub } from './utils/github.js';
import { updateTracker } from './utils/tracker.js';
import { buildReadme } from './utils/readme-builder.js';
import { decryptValue } from './utils/crypto.js';

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
    handleAIChat(message.messages, message.context).then(reply => {
      sendResponse({ reply });
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true;
  }
});

async function handleSubmissionAccepted(payload, sender) {
  if (payload.submissionId && processedSubmissions.has(payload.submissionId)) return;
  if (payload.submissionId) processedSubmissions.add(payload.submissionId);

  const notify = (status, message) => {
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'PROCESSING_COMPLETE', status, message });
    }
  };

  try {
    const code = payload.code || await fetchLeetCodeSubmissionCode(payload.submissionId);
    if (!code) throw new Error('Could not retrieve submission code from LeetCode');

    const meta = await fetchLeetCodeMeta(payload.slug);
    const fullMeta = { ...payload.meta, ...meta };
    const analysis = await analyzeWithClaude({ code, lang: payload.lang, meta: fullMeta });

    const dateStr = new Date().toISOString().split('T')[0];
    const problemPath = `${dateStr.slice(0, 7).replace('-', '/')}/${dateStr}_${payload.slug}`;

    const files = [
      {
        path: `${problemPath}/solution.${getFileExtension(payload.lang)}`,
        content: payload.code
      },
      {
        path: `${problemPath}/README.md`,
        content: buildReadme({ slug: payload.slug, code: payload.code, lang: payload.lang, meta: fullMeta, analysis, dateStr })
      }
    ];

    await commitToGitHub(files, `[${dateStr}] ${fullMeta.title} — ${analysis.essence}`);

    const { tracker } = await chrome.storage.local.get(['tracker']);
    const updatedTracker = updateTracker(tracker || {}, { slug: payload.slug, dateStr, meta: fullMeta, analysis });

    await commitToGitHub(
      [
        { path: 'tracker.json', content: JSON.stringify(updatedTracker, null, 2) },
        { path: 'README.md', content: buildRootReadme(updatedTracker) }
      ],
      `update stats — ${dateStr}`
    );

    await chrome.storage.local.set({ tracker: updatedTracker });
    notify('success');

  } catch (err) {
    console.error('submission failed:', err);
    notify('error', err.message);
  }
}

async function handleAIChat(messages) {
  const { truefoundryKey: encryptedKey, tracker } = await chrome.storage.local.get(['truefoundryKey', 'tracker']);
  if (!encryptedKey) throw new Error('TrueFoundry API key not configured. Please check Settings.');

  const apiKey = await decryptValue(encryptedKey);

  const response = await fetch(`${BASE_URL}chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: buildChatSystemPrompt(tracker || {}) },
        ...messages
      ],
      max_tokens: 800,
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error(`TrueFoundry error: ${response.status}`);

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildChatSystemPrompt(tracker) {
  const topTopics = Object.entries(tracker.topics || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, c]) => `${t} (${c})`)
    .join(', ');

  const weakTopics = (tracker.weakTopics || []).slice(0, 5).join(', ');
  const recentSolves = (tracker.solves || [])
    .slice(-5)
    .map(s => `${s.title} (${s.difficulty}) — ${s.essence}`)
    .join('; ');

  return `You are a personalized DSA mentor for this user.

Their profile:
- Strongest topics: ${topTopics || 'None yet'}
- Weakest / not attempted: ${weakTopics || 'None identified'}
- Current streak: ${tracker.streak?.current || 0} days
- Last solved: ${recentSolves || 'None yet'}

Answer specifically to their skill level and history. Reference their past solves when relevant. Suggest next problems from their weak areas when asked.`;
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

function getFileExtension(lang) {
  const map = {
    python: 'py', python3: 'py', java: 'java',
    cpp: 'cpp', 'c++': 'cpp', c: 'c',
    javascript: 'js', typescript: 'ts',
    go: 'go', rust: 'rs', kotlin: 'kt',
    swift: 'swift', ruby: 'rb', php: 'php',
    scala: 'scala', racket: 'rkt', erlang: 'erl', elixir: 'ex'
  };
  return map[lang.toLowerCase()] || 'txt';
}
