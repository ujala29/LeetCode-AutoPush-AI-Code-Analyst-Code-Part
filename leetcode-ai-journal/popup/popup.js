// popup/popup.js
import { encryptValue } from '../utils/crypto.js';
import { signIn, signOut, getToken, getUserProfile } from '../utils/auth.js';

document.addEventListener('DOMContentLoaded', initPopup);

let currentTracker = {};

async function initPopup() {
  await loadTracker();
  setupTabs();
  await setupSettings();
  renderDashboard();
  await setupAuth();
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
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    });
  });
}

async function setupSettings() {
  const result = await chrome.storage.local.get(['backendUrl', 'githubRepo', 'githubToken']);

  // GitHub repo — show current value (it's not secret)
  const repoInput = document.getElementById('github-repo');
  if (result.githubRepo) {
    repoInput.value = result.githubRepo;
    document.getElementById('github-repo-status').style.display = 'inline';
  }

  // GitHub token — mask it, just signal configured/not
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
  setupReset();
}

function applyKeyStatus(inputId, isSaved) {
  const input = document.getElementById(inputId);
  const statusEl = document.getElementById(`${inputId}-status`);

  input.value = '';
  if (isSaved) {
    input.placeholder = '••••••••••••••••••••••• (saved)';
    statusEl.style.display = 'inline';
  } else {
    input.placeholder = 'ghp_...';
    statusEl.style.display = 'none';
  }
}

async function saveSettings() {
  const repoValue = document.getElementById('github-repo').value.trim();
  const ghValue = document.getElementById('github-token').value.trim();

  const current = await chrome.storage.local.get(['backendUrl', 'githubRepo', 'githubToken']);

  if (!repoValue && !current.githubRepo) {
    showSaveStatus('GitHub repo is required (e.g. username/repo-name)', 'error');
    return;
  }
  if (!ghValue && !current.githubToken) {
    showSaveStatus('GitHub token is required', 'error');
    return;
  }

  try {
    const updates = {};
    if (repoValue) updates.githubRepo = repoValue;
    if (ghValue) updates.githubToken = await encryptValue(ghValue);

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }

    if (repoValue) {
      document.getElementById('github-repo-status').style.display = 'inline';
    }
    applyKeyStatus('github-token', true);

    showSaveStatus('Saved!', 'success');
  } catch (error) {
    console.error('[LeetCode AI] Failed to save settings:', error);
    showSaveStatus('Save failed', 'error');
  }
}

function setupReset() {
  const resetBtn = document.getElementById('reset-btn');
  const confirmBox = document.getElementById('reset-confirm');
  const confirmYes = document.getElementById('reset-confirm-yes');
  const confirmNo = document.getElementById('reset-confirm-no');
  const resetStatus = document.getElementById('reset-status');

  resetBtn.addEventListener('click', () => {
    confirmBox.style.display = 'block';
    resetBtn.style.display = 'none';
    resetStatus.style.display = 'none';
  });

  confirmNo.addEventListener('click', () => {
    confirmBox.style.display = 'none';
    resetBtn.style.display = 'block';
  });

  confirmYes.addEventListener('click', async () => {
    await chrome.storage.local.remove(['tracker', 'seenSubmissions', 'pendingCommit']);
    currentTracker = {};
    confirmBox.style.display = 'none';
    resetBtn.style.display = 'block';
    resetStatus.textContent = 'Stats cleared.';
    resetStatus.className = 'success';
    resetStatus.style.display = 'block';
    setTimeout(() => { resetStatus.style.display = 'none'; }, 3000);
    renderDashboard();
  });
}

function showSaveStatus(message, type) {
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = message;
  statusEl.className = type;
  statusEl.style.display = 'block';
  setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
}

function renderDashboard() {
  const tracker = currentTracker;

  const streak = tracker.streak || {};
  document.getElementById('streak-num').textContent = streak.current || 0;
  document.getElementById('best-streak').textContent = `Best: ${streak.best || 0}`;

  const difficulty = tracker.difficulty || {};
  document.getElementById('total-solved').textContent = (difficulty.Easy || 0) + (difficulty.Medium || 0) + (difficulty.Hard || 0);
  document.getElementById('easy-count').textContent = difficulty.Easy || 0;
  document.getElementById('medium-count').textContent = difficulty.Medium || 0;
  document.getElementById('hard-count').textContent = difficulty.Hard || 0;

  const weakTopics = tracker.weakTopics || [];
  if (weakTopics.length > 0) {
    document.getElementById('weak-topics').textContent = weakTopics.slice(0, 3).join(', ');
    document.getElementById('weak-alert').style.display = 'block';
  }

  const solves = tracker.solves || [];
  const recent = solves.slice(-10).reverse();
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

  renderTopicsChart();
}

function renderTopicsChart() {
  const topics = currentTracker.topics || {};
  const topicsList = document.getElementById('topics-list');

  if (Object.keys(topics).length === 0) {
    topicsList.innerHTML = '<div class="no-data">No topic data yet</div>';
    return;
  }

  const sortedTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 15);
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
  return topic.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function setupAuth() {
  document.getElementById('sign-in-btn').addEventListener('click', handleSignIn);
  document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);

  // Try silent token first
  const token = await getToken();
  if (token) {
    const profile = await getUserProfile(token);
    if (profile) { showSignedIn(profile); return; }
  }
  showSignedOut();
}

async function handleSignIn() {
  const btn = document.getElementById('sign-in-btn');
  btn.textContent = 'Signing in…';
  btn.disabled = true;
  try {
    const token = await signIn();
    const profile = await getUserProfile(token);
    if (profile) showSignedIn(profile);
  } catch (err) {
    console.error('[auth] Sign in failed:', err.message);
    btn.textContent = 'Sign in failed — try again';
    btn.disabled = false;
    setTimeout(() => {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 48 48" style="vertical-align:middle;margin-right:8px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Sign in with Google';
    }, 2000);
  }
}

async function handleSignOut() {
  const token = await getToken();
  await signOut(token);
  showSignedOut();
}

function showSignedIn(profile) {
  document.getElementById('user-card-signed-out').style.display = 'none';
  const card = document.getElementById('user-card-signed-in');
  card.style.display = 'flex';
  document.getElementById('user-avatar').src = profile.picture || '';
  document.getElementById('user-name').textContent = profile.name || '';
  document.getElementById('user-email').textContent = profile.email || '';
}

function showSignedOut() {
  document.getElementById('user-card-signed-in').style.display = 'none';
  document.getElementById('user-card-signed-out').style.display = 'flex';
}
