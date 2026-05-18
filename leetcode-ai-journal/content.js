window.addEventListener('load', () => {
  setTimeout(() => {
    let lastProcessedSlug = null;
    let lastProcessedTime = 0;
    let seenSubmissions = new Set();
    let isProcessing = false;
    let retryCount = 0;

    function checkForAccepted() {
      if (isProcessing) return;

      const result = document.querySelector('[data-e2e-locator="submission-result"]');
      if (!result || !result.textContent.includes('Accepted')) return;

      const now = Date.now();
      const slug = getSlugFromURL();
      const submissionId = getSubmissionIdFromURL();

      if (!submissionId) {
        if (retryCount < 5) {
          retryCount += 1;
          setTimeout(checkForAccepted, 1500);
        }
        return;
      }

      retryCount = 0;

      if (slug && !seenSubmissions.has(submissionId) && (slug !== lastProcessedSlug || now - lastProcessedTime > 10000)) {
        seenSubmissions.add(submissionId);
        lastProcessedSlug = slug;
        lastProcessedTime = now;
        isProcessing = true;
        handleAcceptedSubmission(slug, submissionId).finally(() => {
          isProcessing = false;
        });
      }
    }

    setInterval(checkForAccepted, 3000);
    checkForAccepted();
  }, 3000);
});

async function handleAcceptedSubmission(slug, submissionId) {

  try {
    const code = await getSubmissionCode(submissionId);
    const lang = getLanguage();
    const meta = getProblemMeta();

    if (!submissionId || !lang || !code) {
      showToast('Could not extract submission information. Please try again.', 'error');
      return;
    }

    try {
      if (!chrome.runtime?.id) {
        // Extension was reloaded — content script is orphaned; user needs to refresh the tab
        showToast('Extension was updated. Please refresh this page.', 'error');
        return;
      }
      chrome.runtime.sendMessage({
        type: 'SUBMISSION_ACCEPTED',
        payload: { slug, submissionId, code, lang, meta }
      });
    } catch (sendError) {
      console.warn('[LeetCode AI] Failed to send submission message:', sendError);
    }

    showToast('Analyzing with AI...', 'info');

  } catch (error) {
    if (error.message === 'SKIP_OLD_SUBMISSION') return; // user viewing old result — do nothing
    console.error('[LeetCode AI] Error extracting submission data:', error);
    showToast('Failed to process submission.', 'error');
  }
}

function getSlugFromURL() {
  const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
  return match ? match[1] : null;
}

function getSubmissionIdFromURL() {
  const match = window.location.pathname.match(/\/submissions\/(\d+)\//);
  return match ? match[1] : null;
}

async function getSubmissionCode(submissionId) {
  if (!submissionId) {
    throw new Error('No submission ID available');
  }

  // Primary: GraphQL API — works for both live and historical submissions
  const csrfToken = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
  const gqlResponse = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrftoken': csrfToken,
      'Referer': 'https://leetcode.com',
    },
    credentials: 'include',
    body: JSON.stringify({
      query: `query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          code
          timestamp
        }
      }`,
      variables: { submissionId: parseInt(submissionId) }
    })
  });

  if (gqlResponse.ok) {
    const gqlData = await gqlResponse.json();
    const details = gqlData?.data?.submissionDetails;
    const code = details?.code;
    const timestamp = details?.timestamp;

    // If submission is older than 5 minutes, user is viewing an old result — skip silently
    if (timestamp && (Date.now() / 1000 - timestamp) > 300) {
      throw new Error('SKIP_OLD_SUBMISSION');
    }

    if (code) return code;
  }

  // Fallback: /check/ endpoint (only works for live submissions being graded)
  const delay = ms => new Promise(res => setTimeout(res, ms));
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await delay(1500);

    const response = await fetch(`https://leetcode.com/submissions/detail/${submissionId}/check/`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) throw new Error(`Failed to fetch submission code: ${response.status}`);

    const data = await response.json();
    if (data.code) return data.code;
  }

  throw new Error('No code found in submission response');
}

function getLanguage() {
  // LeetCode renders the selected language in several places depending on UI version
  const candidates = [
    document.querySelector('[data-cy="lang-select"]'),
    document.querySelector('button[id*="headlessui-listbox-button"]'),
    document.querySelector('.ant-select-selection-item'),
    document.querySelector('[class*="SelectLang"]'),
    document.querySelector('[class*="lang-select"]'),
    document.querySelector('select'),
  ];

  for (const el of candidates) {
    if (!el) continue;
    const val = (el.value || el.textContent || '').trim().toLowerCase();
    if (val && val !== 'language') return val;
  }

  // Last resort: check the URL for /submissions/ page which sometimes encodes lang
  const urlMatch = window.location.href.match(/lang=([a-z0-9+_#]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();

  return 'unknown';
}

function getProblemMeta() {
  const titleElement = document.querySelector('[data-cy="question-title"]') ||
                      document.querySelector('h1') ||
                      document.querySelector('[class*="title"]');

  const difficultyElement = document.querySelector('[class*="difficulty"]') ||
                           document.querySelector('[data-difficulty]');

  const tagsElements = document.querySelectorAll('[class*="tag"]') ||
                      document.querySelectorAll('[data-tag]');

  return {
    title: titleElement ? titleElement.textContent.trim() : 'Unknown Problem',
    difficulty: difficultyElement ? difficultyElement.textContent.trim() : 'Unknown',
    tags: Array.from(tagsElements).map(el => el.textContent.trim()).filter(Boolean)
  };
}

function showToast(message, type = 'info') {
  const existing = document.getElementById('leetcode-ai-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'leetcode-ai-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideDown 0.3s ease;
  `;

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}


chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PROCESSING_COMPLETE') {
    if (message.status === 'success') {
      showToast('Synced to GitHub!', 'success');
    } else {
      showToast(`Error: ${message.message}`, 'error');
    }
  }
});

const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateX(-50%) translateY(0); opacity: 1; }
    to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
  }
  #lc-ai-toggle-btn {
    position: fixed;
    bottom: 28px;
    right: 28px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c6af7, #4dc8a0);
    border: none;
    cursor: pointer;
    z-index: 9998;
    box-shadow: 0 4px 16px rgba(124,106,247,0.5);
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  #lc-ai-toggle-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(124,106,247,0.7);
  }
  #lc-ai-sidebar-frame {
    position: fixed;
    bottom: 90px;
    right: 28px;
    width: 360px;
    height: 500px;
    border: none;
    border-radius: 14px;
    z-index: 9999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    transition: opacity 0.25s, transform 0.25s;
    opacity: 0;
    transform: translateY(16px);
    pointer-events: none;
  }
  #lc-ai-sidebar-frame.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: all;
  }
`;
document.head.appendChild(style);

// Extract current code from Monaco editor
function getCurrentCode() {
  try {
    // Monaco API (most reliable)
    if (window.monaco?.editor) {
      const models = window.monaco.editor.getModels();
      if (models.length > 0) return models[0].getValue().substring(0, 2000);
    }
    // DOM fallback — read visible lines
    const lines = document.querySelectorAll('.view-line');
    if (lines.length > 0) {
      return Array.from(lines).map(l => l.textContent).join('\n').substring(0, 2000);
    }
  } catch (_) {}
  return '';
}

// Extract problem description text
function getProblemDescription() {
  const el = document.querySelector('[data-track-load="description_content"]') ||
             document.querySelector('[class*="question-content"]') ||
             document.querySelector('[class*="description__"]');
  return el ? el.textContent.substring(0, 600) : '';
}

// Post current problem context to the sidebar iframe
function sendContextToSidebar(frame) {
  const meta = getProblemMeta();
  const slug = getSlugFromURL();
  frame.contentWindow?.postMessage({
    type: 'PROBLEM_CONTEXT',
    context: {
      slug: slug || '',
      title: meta.title || slug || '',
      difficulty: meta.difficulty || '',
      description: getProblemDescription(),
      code: getCurrentCode()
    }
  }, '*');
}

// Inject floating AI chat button + sidebar iframe
(function injectSidebar() {
  const btn = document.createElement('button');
  btn.id = 'lc-ai-toggle-btn';
  btn.title = 'AI Mentor Chat';
  btn.textContent = '🤖';
  document.body.appendChild(btn);

  const frame = document.createElement('iframe');
  frame.id = 'lc-ai-sidebar-frame';
  frame.src = chrome.runtime.getURL('sidebar/sidebar.html');
  document.body.appendChild(frame);

  // Send context once iframe is ready
  frame.addEventListener('load', () => {
    setTimeout(() => sendContextToSidebar(frame), 300);
  });

  let open = false;
  btn.addEventListener('click', () => {
    open = !open;
    frame.classList.toggle('visible', open);
    btn.textContent = open ? '✕' : '🤖';
    // Refresh context every time user opens sidebar (code may have changed)
    if (open) setTimeout(() => sendContextToSidebar(frame), 150);
  });

  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (open && !frame.contains(e.target) && e.target !== btn) {
      open = false;
      frame.classList.remove('visible');
      btn.textContent = '🤖';
    }
  }, true);
})();