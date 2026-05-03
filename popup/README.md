# Popup Folder

The popup provides the main user interface for the LeetCode AI Journal extension, showing analytics, recent activity, and settings configuration.

## Files Overview

### popup.html
**Purpose:** Main HTML structure for the extension popup with three tabs.

**Structure:**
- Tab navigation (Dashboard, Topics, Settings)
- Dashboard tab: Streak counter, difficulty stats, weak topics alert, recent solves list
- Topics tab: Horizontal bar chart showing topic coverage with color coding
- Settings tab: Form inputs for API keys and GitHub credentials

**Inputs:** None (static HTML)

**Outputs:** None (renders UI)

**Connections:**
- Loads `popup.js` and `popup.css`
- `popup.js` populates data from chrome.runtime messages and storage

### popup.js
**Purpose:** Handles popup logic, data loading, tab switching, and settings management.

**Functions:**
- `initPopup()`: Initializes popup on DOM load
- `loadTracker()`: Fetches tracker data from background script
- `setupTabs()`: Handles tab switching UI
- `setupSettings()`: Loads/saves settings to chrome.storage.local
- `renderDashboard()`: Populates dashboard with tracker data
- `renderTopicsChart()`: Creates topic visualization

**Inputs:**
- Tracker data from `chrome.runtime.sendMessage({ type: 'GET_TRACKER' })`
- Settings from `chrome.storage.local.get()`

**Outputs:**
- UI updates to HTML elements
- Settings saved to `chrome.storage.local.set()`

**Connections:**
- Calls background script for tracker data
- Reads/writes to chrome.storage.local for settings
- Renders data from `tracker.js` structures

### popup.css
**Purpose:** Dark theme styling for the popup interface.

**Features:**
- CSS custom properties for consistent theming
- Responsive grid layouts for stats cards
- Color-coded elements (difficulty badges, topic bars)
- Hover states and transitions
- Form styling with password visibility toggles

**Inputs:** None (static CSS)

**Outputs:** None (styles HTML)

**Connections:**
- Applied to `popup.html`
- Uses theme variables consistent with other UI components

## Data Flow

1. User clicks extension icon → `popup.html` loads
2. `popup.js` initializes and calls `loadTracker()`
3. `loadTracker()` sends message to background script
4. Background script returns tracker from storage
5. `renderDashboard()` populates UI with data
6. User can switch tabs or modify settings
7. Settings changes trigger `saveSettings()` → updates storage

## UI States

- **Loading:** Shows default values while fetching data
- **No Data:** "No solves yet" messages when tracker is empty
- **Settings Incomplete:** Form shows placeholder text, save status messages
- **Weak Topics:** Alert box appears when weakTopics array has items
- **Topic Colors:** Green (≥10 solves), amber (3-9), red (<3)

## Settings Tab Changes

- **Removed:** Claude API Key input (now loaded from .env)
- **Kept:** GitHub settings (can override .env values)
- **Added:** Info message explaining .env configuration
- **Updated:** Help links (removed Claude, kept GitHub)