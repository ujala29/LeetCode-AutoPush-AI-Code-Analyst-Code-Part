# LeetCode AI Journal - Complete Pipeline Documentation

## 1. WHAT WAS BUILT

### Extension Overview
**LeetCode AI Journal** is a Chrome Manifest V3 extension that automatically detects when you solve a LeetCode problem, analyzes your solution with AI, and commits everything to GitHub with structured documentation and analytics.

**One-paragraph summary:** This extension transforms your LeetCode solving into an automated journaling system - when you get "Accepted" on any problem, it extracts your code and metadata, sends it to TrueFoundry AI for detailed analysis (approach, complexity, patterns, insights), builds comprehensive README documentation, commits everything to GitHub in a date-organized structure, updates analytics tracking, and provides a dashboard for monitoring progress and weak areas.

### Every File Created & Its Responsibility

#### Root Files
- **`manifest.json`** - Defines extension permissions, entry points, content scripts, and web accessible resources
- **`background.js`** - Service worker orchestrating the entire pipeline from submission detection to GitHub commits
- **`content.js`** - Content script running on leetcode.com that detects submissions and injects UI

#### Utils Modules (`utils/`)
- **`utils/leetcode.js`** - Fetches problem metadata via LeetCode GraphQL API
- **`utils/claude.js`** - Sends code to TrueFoundry AI for analysis, returns structured JSON
- **`utils/github.js`** - Handles GitHub REST API for file commits with SHA handling
- **`utils/tracker.js`** - Manages analytics data (streaks, topics, difficulty counts)
- **`utils/readme-builder.js`** - Builds Markdown README files for each problem
- **`utils/leetcode.js`** - Fetches problem metadata via LeetCode GraphQL API
- **`utils/claude.js`** - Sends code to TrueFoundry AI for analysis, returns structured JSON
- **`utils/github.js`** - Handles GitHub REST API for file commits with SHA handling
- **`utils/tracker.js`** - Manages analytics data (streaks, topics, difficulty counts)
- **`utils/readme-builder.js`** - Builds Markdown README files for each problem

#### Popup Dashboard (`popup/`)
- **`popup/popup.html`** - Extension popup UI with tabs (Dashboard, Topics, Settings)
- **`popup/popup.js`** - Handles popup logic, loads tracker data, manages settings
- **`popup/popup.css`** - Dark theme styling for popup interface

#### AI Chat Sidebar (`sidebar/`)
- **`sidebar/sidebar.html`** - Chat interface injected into LeetCode problem pages
- **`sidebar/sidebar.js`** - Manages chat messages, sends to background for AI responses
- **`sidebar/sidebar.css`** - Chat bubble styling and animations

#### Icons (`icons/`)
- **`icons/README.md`** - Icon asset documentation

#### Documentation
- **`README.md`** - Project overview and features
- **`SETUP.md`** - Installation and configuration guide
- **`utils/README.md`** - Utils module documentation

## 2. COMPLETE PIPELINE FLOW

### Step-by-Step Execution Trace

**TRIGGER: User gets "Accepted" on LeetCode**

#### Step 1: Submission Detection (`content.js`)
- `MutationObserver` watches DOM for "Accepted" text in submission results
- Debounces multiple detections (10-second cooldown per problem)
- Extracts problem slug from URL (`/problems/two-sum/` → `two-sum`)
- Extracts code from Monaco editor (or fallback to textarea)
- Infers language from code content or UI selectors
- Scrapes basic metadata from DOM (title, difficulty, tags)
- Sends `SUBMISSION_ACCEPTED` message to background script

#### Step 2: Metadata Enrichment (`background.js` → `utils/leetcode.js`)
- Receives `SUBMISSION_ACCEPTED` payload: `{ slug, code, lang, meta }`
- Calls `fetchLeetCodeMeta(slug)` with GraphQL query
- GraphQL fetches: `title`, `difficulty`, `content`, `topicTags`, `hints`, `exampleTestcases`
- Merges GraphQL data with DOM-scraped data
- Returns enriched metadata object

#### Step 3: AI Analysis (`background.js` → `utils/claude.js`)
- Calls `analyzeWithClaude({ code, lang, meta })`
- Truncates inputs (800 chars content, 2000 chars code)
- Builds system prompt: "You are a DSA mentor..."
- Builds user prompt with problem details and JSON schema
- Calls TrueFoundry API: `POST ${TRUEFOUNDRY_BASE_URL}chat/completions`
- Headers: `Authorization: Bearer ${TRUEFOUNDRY_API_KEY}`
- Body: `{ model: TRUEFOUNDRY_MODEL, messages: [...], max_tokens: 1200 }`
- Parses `response.choices[0].message.content` as JSON
- Validates required fields: `approach`, `essence`, `logic`, `time_complexity`, `space_complexity`, `patterns`, `edge_cases_handled`, `what_i_learned`, `similar_problems`
- Returns analysis object or fallback on error

#### Step 4: Path & Date Calculation (`background.js`)
- Gets current date: `new Date().toISOString().split('T')[0]` → `2025-05-02`
- Builds paths: `year/month/date_slug/` → `2025/05/2025-05-02_two-sum/`

#### Step 5: README Generation (`background.js` → `utils/readme-builder.js`)
- Calls `buildReadme({ slug, code, lang, meta, analysis, dateStr })`
- Strips HTML from problem content
- Builds Markdown with: badges, approach, logic steps, complexity table, edge cases, insights, similar problems, code block
- Returns complete Markdown string

#### Step 6: File Preparation (`background.js`)
- Creates solution file: `solution.${extension}` (maps lang to file extension)
- Creates README file: `README.md` with generated content
- Prepares commit payload: `[{ path, content }, { path, content }]`

#### Step 7: GitHub Configuration (`background.js`)
- Loads config from `chrome.storage.local.get(['githubToken', 'githubOwner', 'githubRepo'])`
- Validates: `githubToken`, `githubOwner`, `githubRepo`
- Builds githubConfig object

#### Step 8: Solution Files Commit (`background.js` → `utils/github.js`)
- Calls `commitToGitHub(githubConfig, files, commitMessage)`
- For each file: gets existing SHA (if file exists), base64 encodes content
- `PUT /repos/{owner}/{repo}/contents/{path}` with SHA for updates
- Handles 409 conflicts with retry logic
- Commit message: `[2025-05-02] Two Sum — Hash table approach using dictionary`

#### Step 9: Analytics Update (`background.js` → `utils/tracker.js`)
- Loads current tracker from `chrome.storage.local.get(['tracker'])`
- Calls `updateTracker(tracker, { slug, dateStr, meta, analysis })`
- Updates: solve count, topic counts, difficulty counts, streak calculation
- Identifies weak topics (topics with < 3 solves)
- Returns updated tracker object

#### Step 10: Root Files Commit (`background.js` → `utils/github.js`)
- Stringifies tracker: `JSON.stringify(updatedTracker, null, 2)`
- Builds root README dashboard with stats table
- Commits `tracker.json` and `README.md` to repo root
- Commit message: `Update analytics — 2025-05-02`

#### Step 11: Local Storage Update (`background.js`)
- Saves updated tracker to `chrome.storage.local.set({ tracker: updatedTracker })`

#### Step 12: Success Notification (`background.js` → `content.js`)
- Sends `PROCESSING_COMPLETE` message with status: `success`
- Content script shows toast: "Synced to GitHub!"

### File Calling Chain
```
User Submission
    ↓
content.js (detects + extracts)
    ↓
background.js (orchestrates pipeline)
    ├─► utils/leetcode.js (metadata)
    ├─► utils/claude.js (AI analysis)
    ├─► utils/readme-builder.js (documentation)
    ├─► utils/github.js (file commits)
    └─► utils/tracker.js (analytics)
         ↓
    chrome.storage.local (local persistence)
```

## 3. MESSAGE PASSING MAP

### chrome.runtime.sendMessage Calls

#### From `content.js` to `background.js`:
```javascript
// SUBMISSION_ACCEPTED
{
  type: 'SUBMISSION_ACCEPTED',
  payload: {
    slug: 'two-sum',
    code: 'class Solution:\n    def twoSum...',
    lang: 'python',
    meta: { title: 'Two Sum', difficulty: 'Easy', tags: ['array', 'hash-table'] }
  }
}
```

#### From `background.js` to `content.js`:
```javascript
// PROCESSING_COMPLETE
{
  type: 'PROCESSING_COMPLETE',
  status: 'success' | 'error',
  message: 'Optional error message'
}
```

#### From `popup.js` to `background.js`:
```javascript
// GET_TRACKER
{ type: 'GET_TRACKER' }
// Returns: { tracker: {...} } or {}
```

#### From `sidebar.js` to `background.js`:
```javascript
// AI_CHAT
{
  type: 'AI_CHAT',
  messages: [{ role: 'user', content: 'Explain this problem' }],
  context: { problemSlug: 'two-sum' }
}
// Returns: { reply: 'AI response text' }
```

### Message Flow Summary:
- **Content Script → Background**: Submission detection (async, no response expected)
- **Background → Content Script**: Processing completion status
- **Popup → Background**: Tracker data requests (async with response)
- **Sidebar → Background**: AI chat requests (async with response)

## 4. DATA STRUCTURES

### tracker.json Shape (GitHub root file)
```json
{
  "solves": [
    {
      "date": "2025-05-02",
      "slug": "two-sum",
      "title": "Two Sum",
      "difficulty": "Easy",
      "patterns": ["hash-table", "array"],
      "tags": ["array", "hash-table"],
      "essence": "Hash table approach using dictionary for O(1) lookups",
      "approach": "Two-pass hash table",
      "time_complexity": "O(n) — single pass through array",
      "path": "2025/05/2025-05-02_two-sum"
    }
  ],
  "topics": {
    "hash-table": 5,
    "array": 8,
    "two-pointers": 3,
    "dynamic-programming": 1
  },
  "difficulty": {
    "Easy": 12,
    "Medium": 8,
    "Hard": 2
  },
  "streak": {
    "current": 5,
    "best": 12,
    "last_date": "2025-05-02"
  },
  "weakTopics": [
    "dynamic-programming",
    "graph",
    "tree"
  ],
  "lastUpdated": "2025-05-02T14:30:00.000Z"
}
```

### Claude API Response JSON (TrueFoundry)
```json
{
  "approach": "Two-pointer technique",
  "essence": "Use two pointers moving towards center to find target sum",
  "logic": [
    "Sort the input array to enable two-pointer approach",
    "Initialize left pointer at start, right at end",
    "Move pointers based on current sum vs target",
    "Return indices when target sum found"
  ],
  "time_complexity": "O(n log n) — dominated by sorting",
  "space_complexity": "O(1) — excluding input array",
  "patterns": ["two-pointers", "array"],
  "edge_cases_handled": [
    "Empty array",
    "No solution exists",
    "Multiple possible solutions"
  ],
  "what_i_learned": "Two-pointer technique is efficient for sorted array problems",
  "similar_problems": [
    "3Sum",
    "4Sum",
    "Container With Most Water"
  ]
}
```

### chrome.storage.local Contents
```javascript
{
  "tracker": {
    // Same structure as tracker.json above
  },
  "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "githubOwner": "your-username",
  "githubRepo": "leetcode-solutions"
}
```

## 5. API CALLS MAP

### External API Calls

#### LeetCode GraphQL API (`utils/leetcode.js`)
```javascript
// Endpoint: https://leetcode.com/graphql
// Method: POST
// Headers: { 'Content-Type': 'application/json' }
// Credentials: 'include' (session cookies)
{
  "query": `
    query getQuestion($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title difficulty content topicTags { name } hints exampleTestcases
      }
    }
  `,
  "variables": { "titleSlug": "two-sum" }
}
// Returns: GraphQL response with question data
```

#### TrueFoundry API (`utils/claude.js`)
```javascript
// Endpoint: ${TRUEFOUNDRY_BASE_URL}chat/completions
// Method: POST
// Headers: {
  'Authorization': `Bearer ${TRUEFOUNDRY_API_KEY}`,
  'Content-Type': 'application/json'
// }
{
  "model": "internal-bedrock/sonnet-46",
  "messages": [
    { "role": "system", "content": "You are a DSA mentor..." },
    { "role": "user", "content": "Problem: Two Sum..." }
  ],
  "max_tokens": 1200,
  "temperature": 0.1
}
// Returns: { choices: [{ message: { content: "{ \"approach\": \"...\" }" } }] }
```

#### GitHub REST API (`utils/github.js`)
```javascript
// GET existing file SHA (optional)
// https://api.github.com/repos/{owner}/{repo}/contents/{path}
// Headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }

// PUT commit file
// https://api.github.com/repos/{owner}/{repo}/contents/{path}
// Method: PUT
// Headers: {
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json'
// }
{
  "message": "Commit message",
  "content": "base64-encoded-content",
  "sha": "existing-file-sha-or-null"
}
// Returns: { commit: { sha: "abc123..." } }
```

### API Error Handling
- **LeetCode**: Returns empty object, pipeline continues with DOM data
- **TrueFoundry**: Returns fallback analysis object with error message
- **GitHub**: Throws error, stops pipeline (critical failure)

## 6. FOLDER STRUCTURE

```
leetcode-ai-journal/
├── manifest.json              # Extension manifest (permissions, scripts)
├── background.js              # Service worker (pipeline orchestrator)
├── content.js                 # LeetCode page script (detection + UI)
├── README.md                  # Project documentation
├── SETUP.md                   # Installation guide
├── popup/                     # Extension popup UI
│   ├── popup.html            # Dashboard HTML
│   ├── popup.js              # Dashboard logic
│   ├── popup.css             # Dark theme styles
│   └── README.md             # Popup documentation
├── sidebar/                   # AI chat sidebar
│   ├── sidebar.html          # Chat interface HTML
│   ├── sidebar.js            # Chat functionality
│   ├── sidebar.css           # Chat styling
│   └── README.md             # Sidebar documentation
├── utils/                     # Utility modules
│   ├── leetcode.js           # LeetCode API client
│   ├── claude.js             # TrueFoundry AI client
│   ├── github.js             # GitHub API client
│   ├── tracker.js            # Analytics manager
│   ├── readme-builder.js     # Markdown generator
│   └── README.md             # Utils documentation
└── icons/                     # Extension icons
    └── README.md             # Icon documentation
```

## 7. WHAT CAN BREAK

### Critical Pipeline Failures (Stop Execution)

#### TrueFoundry API Configuration
- **Trigger**: Missing/invalid `truefoundryUrl`, `truefoundryKey`, or `truefoundryModel` in chrome.storage.local
- **Error**: "TrueFoundry configuration not found. Please check your extension settings."
- **Impact**: Pipeline stops at Step 3, no analysis generated
- **Recovery**: Configure TrueFoundry settings in extension popup, reload extension

#### GitHub API Configuration
- **Trigger**: Missing `githubToken`, `githubOwner`, or `githubRepo` in chrome.storage.local
- **Error**: "GitHub configuration not found. Please check your extension settings."
- **Impact**: Pipeline stops at Step 7, no commits made
- **Recovery**: Configure GitHub settings in extension popup, reload extension

#### GitHub API Authentication
- **Trigger**: Invalid/expired GitHub token, insufficient permissions
- **Error**: "GitHub API error: 401 Unauthorized"
- **Impact**: Pipeline stops at Step 8 or 10, partial commits possible
- **Recovery**: Generate new token with repo permissions

#### GitHub Repository Access
- **Trigger**: Repository doesn't exist, user lacks write access
- **Error**: "GitHub API error: 404 Not Found" or "403 Forbidden"
- **Impact**: Pipeline stops at Step 8 or 10
- **Recovery**: Create repository or fix permissions

### Non-Critical Failures (Continue with Fallbacks)

#### LeetCode GraphQL API
- **Trigger**: Network issues, API changes, rate limiting
- **Error**: "LeetCode API error: 500" or GraphQL errors
- **Impact**: Uses DOM-scraped metadata only (less rich data)
- **Recovery**: Automatic, pipeline continues

#### TrueFoundry API Analysis
- **Trigger**: Network issues, API quota exceeded, model errors
- **Error**: "TrueFoundry API error: 429 Too Many Requests"
- **Impact**: Returns fallback analysis object with error message
- **Recovery**: Automatic, commits with basic analysis

#### Code Extraction
- **Trigger**: Monaco editor changes, unusual page structure
- **Error**: No error thrown, but empty/null code
- **Impact**: Pipeline stops early with "Could not extract code" toast
- **Recovery**: Manual retry after page refresh

#### File Commit Conflicts
- **Trigger**: Concurrent edits to same files
- **Error**: "409 Conflict" on GitHub API
- **Impact**: Automatic retry with updated SHA
- **Recovery**: Built-in retry logic handles most cases

### Edge Cases & Race Conditions

#### Multiple Rapid Submissions
- **Protection**: 10-second debounce in `content.js`
- **Impact**: Only first submission processed per problem

#### Extension Reload During Processing
- **Impact**: Current pipeline interrupted, no recovery
- **Recovery**: Manual retry of submission

#### Network Interruptions
- **Impact**: API calls fail, pipeline stops or uses fallbacks
- **Recovery**: Manual retry after network restored

## 8. HOW TO TEST IT

### Step-by-Step Testing Procedure

#### Phase 1: Extension Loading
1. **Open Chrome**: Navigate to `chrome://extensions/`
2. **Enable Developer Mode**: Toggle in top-right corner
3. **Load Unpacked**: Click "Load unpacked" → select `leetcode-ai-journal` folder
4. **Verify Installation**: Extension appears in list with LeetCode icon
5. **Check Console**: Open DevTools on extension background page, look for "Config loaded successfully"

#### Phase 2: Configuration Setup
1. **Open Extension Popup**: Click extension icon in toolbar
2. **Go to Settings Tab**: Fill in TrueFoundry and GitHub credentials
3. **Save Settings**: Click "Save Settings" button
4. **Check Console**: Should show no config errors

#### Phase 3: Basic Functionality Test
1. **Navigate to LeetCode**: Go to https://leetcode.com/problems/two-sum/
2. **Verify UI Injection**: Look for floating chat button (💬) in bottom-right
3. **Click Extension Icon**: Should open popup dashboard
4. **Check Popup Tabs**: Dashboard, Topics, Settings should be accessible

#### Phase 4: Submission Detection Test
1. **Solve a Problem**: Write code for Two Sum, submit and get "Accepted"
2. **Watch Console**: Open DevTools on leetcode.com page
3. **Verify Detection**: Should see "[LeetCode AI] Detected accepted submission"
4. **Check Toast**: Should show "Analyzing with AI..." then "Synced to GitHub!"

#### Phase 5: Pipeline Execution Verification
1. **Monitor Network Tab**: In DevTools, watch for API calls:
   - `https://leetcode.com/graphql` (metadata fetch)
   - `https://truefoundry.innovaccer.com/api/llm/api/inference/openai/chat/completions` (AI analysis)
   - `https://api.github.com/repos/.../contents/...` (file commits)

2. **Check Console Logs**: Should see sequential logs:
   ```
   [LeetCode AI] Processing submission: two-sum
   [LeetCode AI] Fetching metadata for: two-sum
   [LeetCode AI] Successfully fetched metadata
   [LeetCode AI] Sending to TrueFoundry for analysis
   [LeetCode AI] TrueFoundry analysis complete
   [LeetCode AI] Successfully committed solution.py
   [LeetCode AI] Successfully committed README.md
   [LeetCode AI] Successfully committed tracker.json
   [LeetCode AI] Successfully committed README.md
   ```

#### Phase 6: GitHub Verification
1. **Check Repository**: Navigate to your GitHub repo
2. **Verify Structure**: Should have `2025/05/2025-05-02_two-sum/` folder
3. **Check Files**: 
   - `solution.py` (your code)
   - `README.md` (AI-generated analysis)
4. **Check Root Files**:
   - `tracker.json` (updated analytics)
   - `README.md` (dashboard with stats)

#### Phase 7: Dashboard Testing
1. **Open Extension Popup**: Click extension icon
2. **Check Stats**: Should show updated solve count, streak, difficulty breakdown
3. **Verify Topics Tab**: Should show topic frequency bars
4. **Test Settings**: GitHub credentials should be saved

#### Phase 8: AI Chat Testing
1. **Go to Problem Page**: Any LeetCode problem
2. **Click Chat Button**: Floating 💬 button
3. **Send Message**: Type "Explain this problem" and send
4. **Verify Response**: Should get AI response with personalized context
5. **Check Network**: Should see TrueFoundry API call

### Debug Commands (Chrome DevTools)

#### Check Extension Logs
```javascript
// Background script logs
chrome://extensions/ → "Inspect views: background page"

// Content script logs
// On leetcode.com page: F12 → Console
```

#### Manual API Testing
```javascript
// Test TrueFoundry API
fetch('https://truefoundry.innovaccer.com/api/llm/api/inference/openai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'internal-bedrock/sonnet-46',
    messages: [{ role: 'user', content: 'Hello' }]
  })
}).then(r => r.json()).then(console.log)
```

#### Check Storage
```javascript
// View local storage
chrome.storage.local.get(null, console.log)

// Clear storage for fresh start
chrome.storage.local.clear()
```

### Common Issues & Fixes

#### "Config loaded successfully" not appearing
- **Issue**: .env file not found or malformed
- **Fix**: Verify .env exists in extension root, check syntax

#### No submission detection
- **Issue**: DOM selectors changed
- **Fix**: Check if "Accepted" text appears in submission result element

#### API calls failing
- **Issue**: Network/CORS issues
- **Fix**: Check API keys, network connectivity, extension permissions

#### GitHub commits failing
- **Issue**: Token permissions or repository access
- **Fix**: Verify token has `repo` scope, repository exists and is accessible