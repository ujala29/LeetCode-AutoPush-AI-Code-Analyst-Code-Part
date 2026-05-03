// content.js - Runs on leetcode.com pages
// Detects accepted submissions and sends them to the background script

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

// Handle accepted submission
async function handleAcceptedSubmission(slug, submissionId) {
  console.log('[LeetCode AI] Detected accepted submission for:', slug, 'submissionId:', submissionId);

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
    console.error('[LeetCode AI] Error extracting submission data:', error);
    showToast('Failed to process submission.', 'error');
  }
}

// Extract slug from URL
function getSlugFromURL() {
  const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
  return match ? match[1] : null;
}

// Extract submission ID from URL
function getSubmissionIdFromURL() {
  const match = window.location.pathname.match(/\/submissions\/(\d+)\//);
  return match ? match[1] : null;
}

// Fetch complete submission code from LeetCode API
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
        }
      }`,
      variables: { submissionId: parseInt(submissionId) }
    })
  });

  if (gqlResponse.ok) {
    const gqlData = await gqlResponse.json();
    const code = gqlData?.data?.submissionDetails?.code;
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

// Extract language from selector
function getLanguage() {
  const langSelector = document.querySelector('[data-cy="lang-select"]') ||
                      document.querySelector('select') ||
                      document.querySelector('[class*="language"]');

  if (langSelector) {
    return langSelector.value || langSelector.textContent;
  }

  return 'unknown';
}

// Extract problem metadata from DOM
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

// Show toast notification
function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.getElementById('leetcode-ai-toast');
  if (existing) existing.remove();

  // Create toast
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

  // Auto remove after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}


// Listen for processing complete messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PROCESSING_COMPLETE') {
    if (message.status === 'success') {
      showToast('Synced to GitHub!', 'success');
    } else {
      showToast(`Error: ${message.message}`, 'error');
    }
  }
});

// Add CSS animations
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
`;
document.head.appendChild(style);