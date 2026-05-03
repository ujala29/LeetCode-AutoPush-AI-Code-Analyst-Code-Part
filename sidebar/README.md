# Sidebar Folder

The sidebar provides an AI chat interface that appears as an overlay on LeetCode problem pages, offering personalized mentoring based on the user's solving history.

## Files Overview

### sidebar.html
**Purpose:** HTML structure for the chat sidebar iframe.

**Structure:**
- Header with "AI Mentor" title and current problem slug
- Scrollable messages area with user/bot message bubbles
- Suggested prompt chips for common questions
- Input field with send button
- Typing indicator animation

**Inputs:** None (static HTML)

**Outputs:** None (renders UI)

**Connections:**
- Loads `sidebar.js` and `sidebar.css`
- Injected as iframe by `content.js`
- `sidebar.js` handles chat logic and API calls

### sidebar.js
**Purpose:** Manages chat functionality, message handling, and UI updates.

**Functions:**
- `initSidebar()`: Sets up event listeners and initial state
- `updateProblemSlug()`: Extracts current problem from parent URL
- `setupInput()`: Handles message input and sending
- `setupPrompts()`: Pre-fills input with suggested questions
- `sendMessage()`: Sends user message to background and handles response
- `renderMessages()`: Updates UI with new messages
- `showTyping()`: Toggles typing indicator

**Inputs:**
- User messages from input field
- Suggested prompts from chip clicks
- AI responses from `chrome.runtime.sendMessage({ type: 'AI_CHAT' })`

**Outputs:**
- UI updates to message list
- Messages sent to background script for Claude API calls

**Connections:**
- Communicates with background script for AI chat functionality
- Accesses parent window URL for problem context
- Uses tracker data from background for personalized responses

### sidebar.css
**Purpose:** Dark theme styling for the chat interface.

**Features:**
- Message bubbles with different styles for user/bot
- Responsive layout fitting 420px width
- Smooth animations for typing indicator
- Custom scrollbar styling
- Hover effects on interactive elements

**Inputs:** None (static CSS)

**Outputs:** None (styles HTML)

**Connections:**
- Applied to `sidebar.html`
- Consistent with popup theming

## Data Flow

1. User clicks AI Chat button on LeetCode → `content.js` injects iframe
2. `sidebar.html` loads with `sidebar.js`
3. User types message or clicks prompt chip
4. `sendMessage()` sends to background script
5. Background calls Claude API with user history context
6. Response returns to sidebar and renders in chat
7. Conversation continues with message history maintained

## Message Format

- **User messages:** Right-aligned, purple background
- **Bot messages:** Left-aligned, dark surface with border
- **Formatting:** Basic markdown support (*bold*, `code`, line breaks)
- **History:** Maintained in `messages` array for context

## Context Injection

The sidebar automatically includes:
- Current problem slug from URL
- User's solving history from tracker
- Personalized system prompt built by background script using Azure OpenAI

## Error Handling

- API failures show error messages in chat
- Network issues gracefully handled
- Invalid responses fall back to error text