// popup/popup.js
import { encryptValue } from '../utils/crypto.js';

document.addEventListener('DOMContentLoaded', initPopup);

let currentTracker = {};

async function initPopup() {
  // Load tracker data
  await loadTracker();

  // Setup tab switching
  setupTabs();

  // Setup settings
  setupSettings();

  // Render dashboard
  renderDashboard();
}

async function loadTracker() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TRACKER' });
    currentTracker = response || {};
  } catch (error) {
    console.error('[LeetCode AI] Failed to load tracker:', error);
    currentTracker = {};
  }
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active to clicked
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    });
  });
}

async function setupSettings() {
  const result = await chrome.storage.local.get(['truefoundryKey', 'githubToken']);

  // Never show actual key values — just signal whether each is configured
  applyKeyStatus('truefoundry-key', !!result.truefoundryKey);
  applyKeyStatus('github-token', !!result.githubToken);

  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? '🙈' : '👁️';
    });
  });

  document.getElementById('save-settings').addEventListener('click', saveSettings);
}

// Sets input to empty + updates placeholder and ✓ indicator based on saved state
function applyKeyStatus(inputId, isSaved) {
  const input = document.getElementById(inputId);
  const statusEl = document.getElementById(`${inputId}-status`);

  input.value = '';
  if (isSaved) {
    input.placeholder = '••••••••••••••••••••••• (saved)';
    statusEl.style.display = 'inline';
  } else {
    input.placeholder = inputId === 'truefoundry-key' ? 'eyJhbGciOiJSUzI1NiIs...' : 'ghp_...';
    statusEl.style.display = 'none';
  }
}

async function saveSettings() {
  const tfValue = document.getElementById('truefoundry-key').value.trim();
  const ghValue = document.getElementById('github-token').value.trim();

  // Read current storage to know what's already saved
  const current = await chrome.storage.local.get(['truefoundryKey', 'githubToken']);

  // Require each key to be present (either already saved or newly entered)
  if (!tfValue && !current.truefoundryKey) {
    showSaveStatus('TrueFoundry API key is required', 'error');
    return;
  }
  if (!ghValue && !current.githubToken) {
    showSaveStatus('GitHub token is required', 'error');
    return;
  }

  try {
    // Only encrypt and overwrite keys the user actually typed into
    const updates = {};
    if (tfValue) updates.truefoundryKey = await encryptValue(tfValue);
    if (ghValue) updates.githubToken = await encryptValue(ghValue);

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }

    // Reset both fields to masked state — never leave plaintext in the input
    applyKeyStatus('truefoundry-key', true);
    applyKeyStatus('github-token', true);

    showSaveStatus('Saved!', 'success');
  } catch (error) {
    console.error('[LeetCode AI] Failed to save settings:', error);
    showSaveStatus('Save failed', 'error');
  }
}

function showSaveStatus(message, type) {
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = message;
  statusEl.className = type;
  statusEl.style.display = 'block';

  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

function renderDashboard() {
  const tracker = currentTracker;

  // Streak
  const streak = tracker.streak || {};
  document.getElementById('streak-num').textContent = streak.current || 0;
  document.getElementById('best-streak').textContent = `Best: ${streak.best || 0}`;

  // Difficulty counts
  const difficulty = tracker.difficulty || {};
  document.getElementById('total-solved').textContent = (difficulty.Easy || 0) + (difficulty.Medium || 0) + (difficulty.Hard || 0);
  document.getElementById('easy-count').textContent = difficulty.Easy || 0;
  document.getElementById('medium-count').textContent = difficulty.Medium || 0;
  document.getElementById('hard-count').textContent = difficulty.Hard || 0;

  // Weak topics alert
  const weakTopics = tracker.weakTopics || [];
  if (weakTopics.length > 0) {
    document.getElementById('weak-topics').textContent = weakTopics.slice(0, 3).join(', ');
    document.getElementById('weak-alert').style.display = 'block';
  }

  // Recent solves
  const solves = tracker.solves || [];
  const recent = solves.slice(-5).reverse();
  const recentList = document.getElementById('recent-list');

  if (recent.length === 0) {
    recentList.innerHTML = '<div class="no-data">No solves yet</div>';
  } else {
    recentList.innerHTML = recent.map(solve => `
      <div class="solve-item">
        <div class="solve-title">${solve.title}</div>
        <div class="solve-meta">
          <span class="difficulty ${solve.difficulty.toLowerCase()}">${solve.difficulty}</span>
          <span class="solve-date">${solve.date}</span>
        </div>
        <div class="solve-essence">${solve.essence}</div>
      </div>
    `).join('');
  }

  // Topics chart
  renderTopicsChart();
}

function renderTopicsChart() {
  const topics = currentTracker.topics || {};
  const topicsList = document.getElementById('topics-list');

  if (Object.keys(topics).length === 0) {
    topicsList.innerHTML = '<div class="no-data">No topic data yet</div>';
    return;
  }

  // Sort by count descending, take top 15
  const sortedTopics = Object.entries(topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const maxCount = Math.max(...sortedTopics.map(([_, count]) => count));

  topicsList.innerHTML = sortedTopics.map(([topic, count]) => {
    const percentage = (count / maxCount) * 100;
    const colorClass = count >= 10 ? 'high' : count >= 3 ? 'medium' : 'low';

    return `
      <div class="topic-item">
        <div class="topic-name">${formatTopicName(topic)}</div>
        <div class="topic-bar">
          <div class="topic-fill ${colorClass}" style="width: ${percentage}%"></div>
        </div>
        <div class="topic-count">${count}</div>
      </div>
    `;
  }).join('');
}

function formatTopicName(topic) {
  return topic.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}