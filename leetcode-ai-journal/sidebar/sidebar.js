// sidebar/sidebar.js

let messages = [
  {
    role: 'assistant',
    content: "Hi! I'm your personalized DSA mentor. I can see your current problem and code. Ask me anything or pick a quick option below!"
  }
];

let problemContext = null; // set via postMessage from content.js

document.addEventListener('DOMContentLoaded', initSidebar);

function initSidebar() {
  setupInput();
  setupOptionButtons();
  renderMessages();

  // Receive problem context from content.js via postMessage
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'PROBLEM_CONTEXT') {
      problemContext = event.data.context;
      const el = document.getElementById('current-problem');
      if (el && problemContext?.title) {
        el.textContent = `${problemContext.title} · ${problemContext.difficulty || ''}`;
      } else if (el && problemContext?.slug) {
        el.textContent = problemContext.slug.replace(/-/g, ' ');
      }
    }
  });
}

function setupInput() {
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim();
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);
}

function setupOptionButtons() {
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      // Show which option was selected by highlighting it briefly
      btn.classList.add('selected');
      setTimeout(() => btn.classList.remove('selected'), 1200);
      // Auto-send
      sendMessageText(prompt, btn.textContent.trim());
    });
  });
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  document.getElementById('send-btn').disabled = true;
  await sendMessageText(text);
}

async function sendMessageText(prompt, displayLabel) {
  // Add user message to UI — show the button label if it came from a chip
  messages.push({ role: 'user', content: prompt });

  // If it came from a chip, display a shorter label in the chat bubble
  const displayMessages = [...messages];
  if (displayLabel) {
    displayMessages[displayMessages.length - 1] = {
      role: 'user',
      content: displayLabel
    };
  }
  renderMessages(displayMessages);

  showTyping(true);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'AI_CHAT',
      messages,
      problemContext
    });

    showTyping(false);

    if (response.error) throw new Error(response.error);

    messages.push({ role: 'assistant', content: response.reply });
    renderMessages();

  } catch (error) {
    showTyping(false);
    const msg = error.message || 'Unknown error';
    let hint = '';
    if (msg.includes('Not signed in')) {
      hint = '\n\n👉 Open the extension popup and **Sign in with Google**.';
    } else if (msg.includes('Cannot reach backend') || msg.includes('localhost')) {
      hint = '\n\n👉 Open popup → Settings → set Backend URL to your Render URL.';
    } else if (msg.includes('401') || msg.includes('Token')) {
      hint = '\n\n👉 Your session expired. Open popup and sign in again.';
    }
    messages.push({
      role: 'assistant',
      content: `Sorry, I encountered an error:\n\`${msg}\`${hint}`
    });
    renderMessages();
  }
}

function renderMessages(msgs) {
  const list = msgs || messages;
  const messagesEl = document.getElementById('messages');
  messagesEl.innerHTML = list.map(msg => `
    <div class="message ${msg.role === 'user' ? 'user' : 'bot'}">
      <div class="message-content">${formatMessage(msg.content)}</div>
    </div>
  `).join('');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatMessage(content) {
  return content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function showTyping(show) {
  document.getElementById('typing').style.display = show ? 'flex' : 'none';
  const messagesEl = document.getElementById('messages');
  if (show) messagesEl.scrollTop = messagesEl.scrollHeight;
}
