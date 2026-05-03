import { fetchLeetCodeMeta, fetchLeetCodeSubmissionCode } from './utils/leetcode.js';
import { analyzeWithClaude, BASE_URL, MODEL } from './utils/claude.js';
import { commitToGitHub } from './utils/github.js';
import { updateTracker } from './utils/tracker.js';
import { buildReadme } from './utils/readme-builder.js';
import { decryptValue } from './utils/crypto.js';

// Global set to track processed submissions
let processedSubmissions = new Set();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBMISSION_ACCEPTED') {
    handleSubmissionAccepted(message.payload, sender);
    sendResponse({ status: 'processing' });
  } else if (message.type === 'GET_TRACKER') {
    chrome.storage.local.get(['tracker'], (result) => {
      sendResponse(result.tracker || {});
    });
    return true; // Keep message channel open for async response
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
  console.log('[LeetCode AI] Processing submission:', payload.slug, 'submissionId:', payload.submissionId);

  // Check for duplicate processing
  if (payload.submissionId && processedSubmissions.has(payload.submissionId)) {
    console.log('[LeetCode AI] Submission already processed, skipping:', payload.submissionId);
    return;
  }

  // Mark as processed
  if (payload.submissionId) {
    processedSubmissions.add(payload.submissionId);
  }

  try {
    // Fetch solution code from LeetCode submission API
    const code = payload.code || await fetchLeetCodeSubmissionCode(payload.submissionId);
    if (!code) {
      throw new Error('Could not retrieve submission code from LeetCode');
    }

    // Step 1: Fetch full metadata
    const meta = await fetchLeetCodeMeta(payload.slug);
    const fullMeta = { ...payload.meta, ...meta };

    // Step 2: Analyze with Azure OpenAI (no API key needed from storage)
    const analysis = await analyzeWithClaude({ code, lang: payload.lang, meta: fullMeta });

    // Step 3: Build date and paths
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(5, 7);
    const monthPath = `${year}/${month}`;
    const problemPath = `${monthPath}/${dateStr}_${payload.slug}`;

    // Step 4: Build README
    const readmeContent = buildReadme({ slug: payload.slug, code: payload.code, lang: payload.lang, meta: fullMeta, analysis, dateStr });

    // Step 5: Prepare files for commit
    const files = [
      {
        path: `${problemPath}/solution.${getFileExtension(payload.lang)}`,
        content: payload.code
      },
      {
        path: `${problemPath}/README.md`,
        content: readmeContent
      }
    ];

    // Step 7: Commit solution files
    const commitMessage = `[${dateStr}] ${fullMeta.title} — ${analysis.essence}`;
    await commitToGitHub(files, commitMessage);

    // Step 8: Update tracker
    const { tracker } = await chrome.storage.local.get(['tracker']);
    const updatedTracker = updateTracker(tracker || {}, { slug: payload.slug, dateStr, meta: fullMeta, analysis });

    // Step 9: Commit tracker.json and root README
    const trackerContent = JSON.stringify(updatedTracker, null, 2);
    const rootReadmeContent = buildRootReadme(updatedTracker);

    const rootFiles = [
      { path: 'tracker.json', content: trackerContent },
      { path: 'README.md', content: rootReadmeContent }
    ];

    await commitToGitHub(rootFiles, `Update analytics — ${dateStr}`);

    // Step 10: Save updated tracker locally
    await chrome.storage.local.set({ tracker: updatedTracker });

    console.log('[LeetCode AI] Successfully processed and committed:', payload.slug);

    // Notify content script of success
    if (sender && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'PROCESSING_COMPLETE', status: 'success' });
    }

  } catch (error) {
    console.error('[LeetCode AI] Error processing submission:', error);
    if (sender && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'PROCESSING_COMPLETE', status: 'error', message: error.message });
    }
  }
}

async function handleAIChat(messages, context) {
  const { truefoundryKey: encryptedKey, tracker } = await chrome.storage.local.get(['truefoundryKey', 'tracker']);
  if (!encryptedKey) {
    throw new Error('TrueFoundry API key not configured. Please check your extension settings.');
  }
  const apiKey = await decryptValue(encryptedKey);
  const userTracker = tracker || {};

  const systemPrompt = buildChatSystemPrompt(userTracker);

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
        ...messages
      ],
      max_tokens: 800,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`TrueFoundry API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildChatSystemPrompt(tracker) {
  const topics = tracker.topics || {};
  const sortedTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]);
  const topTopics = sortedTopics.slice(0, 5).map(([topic, count]) => `${topic} (${count})`).join(', ');

  const weakTopics = (tracker.weakTopics || []).slice(0, 5).join(', ');

  const streak = tracker.streak?.current || 0;

  const recentSolves = (tracker.solves || []).slice(-5).map(s => `${s.title} (${s.difficulty}) — ${s.essence}`).join('; ');

  return `You are a personalized DSA mentor for this user.

Their profile:
- Strongest topics: ${topTopics || 'None yet'}
- Weakest / not attempted: ${weakTopics || 'None identified'}
- Current streak: ${streak} days
- Last solved: ${recentSolves || 'None yet'}

Answer specifically to their skill level and history. Reference their past solves when relevant. Suggest next problems from their weak areas when asked.`;
}

function buildRootReadme(tracker) {
  const total = tracker.solves?.length || 0;
  const streak = tracker.streak?.current || 0;
  const bestStreak = tracker.streak?.best || 0;

  const difficulty = tracker.difficulty || {};
  const easy = difficulty.Easy || 0;
  const medium = difficulty.Medium || 0;
  const hard = difficulty.Hard || 0;

  const recent = (tracker.solves || []).slice(-10).reverse();

  let markdown = `# LeetCode AI Journal

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

  recent.forEach(solve => {
    markdown += `| ${solve.date} | [${solve.title}](https://leetcode.com/problems/${solve.slug}) | ${solve.difficulty} | ${solve.approach} |\n`;
  });

  return markdown;
}

function getFileExtension(lang) {
  const map = {
    'python': 'py',
    'python3': 'py',
    'java': 'java',
    'cpp': 'cpp',
    'c++': 'cpp',
    'c': 'c',
    'javascript': 'js',
    'typescript': 'ts',
    'go': 'go',
    'rust': 'rs',
    'kotlin': 'kt',
    'swift': 'swift',
    'ruby': 'rb',
    'php': 'php',
    'scala': 'scala',
    'racket': 'rkt',
    'erlang': 'erl',
    'elixir': 'ex'
  };
  return map[lang.toLowerCase()] || 'txt';
}