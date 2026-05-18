# Utils Folder

This folder contains utility modules that handle external API integrations and data processing for the LeetCode AI Journal extension.

## Files Overview

### Configuration Management
**Note:** Configuration is now handled via `chrome.storage.local` instead of a config.js file. API keys and settings are stored securely in the browser's local storage and managed through the extension popup.

**Storage Keys:**
- `truefoundryUrl` → TrueFoundry API endpoint URL
- `truefoundryKey` → TrueFoundry API key
- `truefoundryModel` → TrueFoundry model name
- `githubToken` → GitHub personal access token
- `githubOwner` → GitHub username/organization
- `githubRepo` → Target repository name

**Access:** Use `await chrome.storage.local.get(['key1', 'key2'])` to retrieve configuration values.
- Called once on extension startup by `background.js`
- Provides configuration to `claude.js`, `github.js`, and chat functionality
- Replaces the need for `chrome.storage.local` API key storage

### claude.js
**Purpose:** Interfaces with TrueFoundry API for AI-powered code analysis.

**Exports:**
- `analyzeWithClaude({ code, lang, meta })` → Returns structured JSON analysis

**Inputs:**
- `code`: Raw solution code (truncated to 2000 chars)
- `lang`: Programming language
- `meta`: Problem metadata (title, difficulty, content, tags)
- Loads TrueFoundry config from `.env` file

**Outputs:**
- JSON object with approach, essence, logic steps, complexity, patterns, edge cases, insights, similar problems
- Fallback object on API failure

**Connections:**
- Called by `background.js` after fetching LeetCode metadata
- Uses TrueFoundry OpenAI-compatible API instead of Anthropic Claude
- Provides analysis data for `readme-builder.js` and `tracker.js`

### github.js
**Purpose:** Handles GitHub REST API operations for automated file commits.

**Exports:**
- `commitToGitHub(config, files[], commitMessage)` → Commits files to repo

**Inputs:**
- `config`: { githubToken, githubOwner, githubRepo }
- `files[]`: Array of { path, content } objects
- `commitMessage`: String for commit

**Outputs:**
- Void (throws on failure)
- Logs each committed file path

**Connections:**
- Called by `background.js` to commit solution files and tracker updates
- Uses base64 encoding for file content
- Handles SHA conflicts with retry logic

### leetcode.js
**Purpose:** Fetches problem metadata from LeetCode's GraphQL API.

**Exports:**
- `fetchLeetCodeMeta(slug)` → Returns problem details

**Inputs:**
- `slug`: Problem identifier (e.g., "two-sum")

**Outputs:**
- Object with title, difficulty, content, tags, hints, examples
- Empty object on failure (non-fatal)

**Connections:**
- Called by `background.js` immediately after detecting accepted submission
- Enriches DOM-scraped data from `content.js`
- Results passed to Claude analysis

### tracker.js
**Purpose:** Maintains analytics state with streaks, topic counts, and weak area detection.

**Exports:**
- `updateTracker(tracker, solveData)` → Returns updated tracker object

**Inputs:**
- `tracker`: Current analytics object
- `solveData`: { slug, dateStr, meta, analysis }

**Outputs:**
- Updated tracker with new solve entry, incremented counts, calculated streak, weak topics list

**Connections:**
- Called by `background.js` after successful analysis
- Data saved to `chrome.storage.local`
- Powers dashboard in `popup.js` and chat context in `sidebar.js`

### readme-builder.js
**Purpose:** Generates detailed Markdown READMEs for individual problems.

**Exports:**
- `buildReadme({ slug, code, lang, meta, analysis, dateStr })` → Returns markdown string

**Inputs:**
- Problem slug, code, language, metadata, AI analysis, date

**Outputs:**
- Complete Markdown document with sections for approach, logic, complexity, edge cases, etc.

**Connections:**
- Called by `background.js` to generate per-problem README.md
- Content committed to GitHub via `github.js`
- Uses AI analysis from `claude.js`

## Data Flow

1. `config.js` loads environment variables from `.env` file on startup
2. `content.js` detects accepted submission
3. `background.js` calls `leetcode.js` for metadata
4. `background.js` calls `claude.js` (now Azure OpenAI) for analysis
5. `background.js` calls `readme-builder.js` for README
6. `background.js` calls `github.js` to commit files (using .env config)
7. `background.js` calls `tracker.js` to update analytics
8. `popup.js` reads tracker from storage for dashboard
9. `sidebar.js` uses tracker for chat context