// sidebar/sidebar.js
// Handles the AI chat sidebar injected into LeetCode

let messages = [
  {
    role: 'assistant',
    content: 'Hi! I\'m your personalized DSA mentor. I know your solving history and can help you understand problems better. What would you like to know about this problem?'
  }
];

document.addEventListener('DOMContentLoaded', initSidebar);

function initSidebar() {
  // Update problem slug in header
  updateProblemSlug();

  // Setup input handling
  setupInput();

  // Setup suggested prompts
  setupPrompts();

  // Render initial messages
  renderMessages();
}

function updateProblemSlug() {
  // Try to get slug from parent window URL
  try {
    const slug = window.parent.location.pathname.split('/problems/')[1]?.split('/')[0] || 'unknown';
    document.getElementById('current-problem').textContent = slug.replace(/-/g, ' ');
  } catch (error) {
    document.getElementById('current-problem').textContent = 'current problem';
  }
}

function setupInput() {
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  function updateSendButton() {
    sendBtn.disabled = !input.value.trim();
  }

  input.addEventListener('input', updateSendButton);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);
}

function setupPrompts() {
  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      document.getElementById('message-input').value = prompt;
      document.getElementById('send-btn').disabled = false;
      document.getElementById('send-btn').click();
    });
  });
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();

  if (!message) return;

  // Add user message
  messages.push({ role: 'user', content: message });
  renderMessages();

  // Clear input
  input.value = '';
  document.getElementById('send-btn').disabled = true;

  // Show typing indicator
  showTyping(true);

  try {
    // Send to background script
    const response = await chrome.runtime.sendMessage({
      type: 'AI_CHAT',
      messages: messages,
      context: { problemSlug: getCurrentProblemSlug() }
    });

    // Hide typing
    showTyping(false);

    // Add bot response
    messages.push({ role: 'assistant', content: response.reply });
    renderMessages();

  } catch (error) {
    showTyping(false);
    console.error('[LeetCode AI] Chat error:', error);

    // Add error message
    messages.push({
      role: 'assistant',
      content: 'Sorry, I encountered an error. Please check your Claude API key in the extension settings.'
    });
    renderMessages();
  }
}

function renderMessages() {
  const messagesEl = document.getElementById('messages');
  messagesEl.innerHTML = messages.map(msg => `
    <div class="message ${msg.role === 'user' ? 'user' : 'bot'}">
      <div class="message-content">${formatMessage(msg.content)}</div>
    </div>
  `).join('');

  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatMessage(content) {
  // Basic markdown-like formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function showTyping(show) {
  document.getElementById('typing').style.display = show ? 'flex' : 'none';
}

function getCurrentProblemSlug() {
  try {
    return window.parent.location.pathname.split('/problems/')[1]?.split('/')[0] || null;
  } catch (error) {
    return null;
  }
}

// Listen for messages from parent (if needed)
window.addEventListener('message', (event) => {
  // Handle any messages from the parent LeetCode page if needed
});