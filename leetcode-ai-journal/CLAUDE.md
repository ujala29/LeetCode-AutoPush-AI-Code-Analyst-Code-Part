# LeetCode AI Journal — Project Context for Claude

## What This Is
Chrome extension (Manifest V3) that auto-detects LeetCode accepted submissions, analyzes them with Groq AI via a Node.js backend proxy, commits structured solution notes to GitHub, provides an AI mentor chatbot sidebar, and sends daily motivation emails.

## Repo Layout
```
leetcode-ai-journal/          ← extension root (load unpacked in chrome://extensions)
  manifest.json               ← MV3, version 1.2, oauth2 client_id set
  background.js               ← service worker: full pipeline + user sync
  content.js                  ← injected into leetcode.com: detects acceptance, injects sidebar
  utils/
    auth.js                   ← chrome.identity wrappers: signIn, signOut, getToken, getUserProfile
    claude.js                 ← backend proxy calls — Bearer token auth, 401 auto-refresh
    github.js                 ← GitHub API: chunked base64, specific 401/403/404 errors
    crypto.js                 ← AES-GCM encrypt/decrypt keyed on chrome.runtime.id (DO NOT CHANGE)
    leetcode.js               ← LeetCode GraphQL + REST fetchers (metadata + submission code)
    tracker.js                ← updates local solve stats (streak, difficulty, topics, weak areas)
    readme-builder.js         ← builds per-problem README.md markdown
  popup/
    popup.html                ← user card (Google sign-in) + dashboard/topics/settings tabs
    popup.js                  ← auth management + tracker dashboard + settings
    popup.css
  sidebar/
    sidebar.html              ← AI chat UI with 8 quick-option buttons
    sidebar.js                ← postMessage context receiver, option auto-send, XSS-safe render
    sidebar.css
  icons/

backend/                      ← Node.js proxy (run before using extension)
  server.js                   ← Express app, Google token auth middleware, starts scheduler
  lib/
    gemini.js                 ← actually calls Groq API (OpenAI-compatible) — file kept as gemini.js
    auth.js                   ← verifyGoogleToken via Google tokeninfo API
    mailer.js                 ← sendDailyMotivation via Resend API
    userStore.js              ← JSON file user registry (data/users.json)
    scheduler.js              ← node-cron daily email job (9 AM IST = '30 3 * * *')
  routes/
    analyze.js                ← POST /api/analyze → Groq → JSON analysis (fallback on failure)
    chat.js                   ← POST /api/chat → Groq DSA mentor with problem context
    register.js               ← POST /api/register → upsert user email+stats for email scheduler
  scripts/
    delete-old-folders.js     ← one-off script: deletes old date-based GitHub folders
  data/
    users.json                ← { email: { name, streak, weakTopics, totalSolved, updatedAt } }
  package.json                ← ESM, express + cors + dotenv + node-cron + resend
  .env                        ← GROQ_API_KEY + GOOGLE_CLIENT_ID + RESEND_API_KEY + FROM_EMAIL + PORT
  .gitignore
```

## Full Pipeline (happy path)
```
content.js polls DOM every 3s
  → detects [data-e2e-locator="submission-result"] contains "Accepted"
  → timestamp check: if submission > 5 min old → SKIP_OLD_SUBMISSION silently
  → extracts submissionId from URL /submissions/(\d+)/
  → fetches code via GraphQL (primary) or /check/ REST (fallback, 5 retries)
  → sends SUBMISSION_ACCEPTED → background.js

background.js (service worker):
  0. Dedup: in-memory Set + chrome.storage seenSubmissions (last 100, survives SW restart)
  1. fetchLeetCodeSubmissionCode (if not in payload)
  2. fetchLeetCodeMeta (GraphQL) → safeMeta defaults (title||slug, difficulty||Unknown)
  3. getToken() → POST /api/analyze (Bearer token) → Groq → JSON analysis or fallback
  4. chrome.storage.set({ pendingCommit }) ← safety before GitHub
  5. commitToGitHub([problems/{slug}/solution.ext, problems/{slug}/README.md])
  6. updateTracker (dedup by slug — overwrites old entry) + commitToGitHub([tracker.json, README.md])
  7. chrome.storage.set({ tracker }) + remove pendingCommit
  8. syncUserToBackend(tracker) → POST /api/register → saves email+stats for daily emails
  9. notify('success') → content.js showToast

AI Chat sidebar:
  content.js injects floating 🤖 button + iframe (sidebar.html)
  → on open: sendContextToSidebar({ slug, title, difficulty, description, code })
  → user types or clicks quick-option chip
  → sidebar.js sends AI_CHAT message → background.js
  → POST /api/chat with messages + trackerSummary + problemContext → Groq
  → reply rendered in chat
```

## Tech Stack
- Extension: Vanilla JS, MV3, chrome.storage.local (5MB quota)
- Auth: Google OAuth via chrome.identity API (Bearer token on every backend call)
- Backend: Node.js 18+ (ESM), Express 4, native fetch
- AI: Groq API — model `llama-3.3-70b-versatile` (30 RPM / 14400 RPD free)
- GitHub: repo `ujala29/LeetCode-AutoPush-AI-Code-Analyst`
- Email: Resend API (100 emails/day free tier)
- Scheduler: node-cron, daily 9 AM IST (`30 3 * * *` UTC)
- Encryption: Web Crypto AES-GCM (`crypto.js`) for GitHub token

## Key Secrets / Config
| Key | Where it lives | Notes |
|---|---|---|
| `GROQ_API_KEY` | `backend/.env` only | Never in extension |
| `GOOGLE_CLIENT_ID` | `backend/.env` + `manifest.json` oauth2 | Must match extension's Item ID in Google Cloud Console |
| `RESEND_API_KEY` | `backend/.env` only | Optional — emails skipped if empty |
| `githubToken` | `chrome.storage.local` (AES-GCM encrypted) | User's own token, repo scope |
| `backendUrl` | `chrome.storage.local` (plain) | Set in popup Settings; default `http://localhost:3000` |

## Running Locally
```bash
# Backend
cd backend && npm install
# Edit .env: GROQ_API_KEY, GOOGLE_CLIENT_ID, RESEND_API_KEY
npm run dev        # http://localhost:3000

# Extension
# Load leetcode-ai-journal/ unpacked in chrome://extensions
# Note the extension ID → must match OAuth client Item ID in Google Cloud Console
# Popup → Sign in with Google
# Popup → Settings → Backend URL: http://localhost:3000
# Popup → Settings → GitHub Token: ghp_...
```

## GitHub Folder Structure
```
problems/
  palindrome-number/
    solution.cpp
    README.md
  two-sum/
    solution.py
    README.md
tracker.json
README.md
```
No date in folder path — same problem always overwrites (no duplicates).
Date is preserved in README content + git commit message history.

## Before Chrome Web Store Publish
1. Deploy backend (Railway / Render / Fly.io)
2. Update `manifest.json` `host_permissions` with production URL
3. Set real `GOOGLE_CLIENT_ID` in `.env` for the production extension ID
4. Set real `APP_SECRET` or keep Google auth as sole guard
5. Change scheduler in `backend/lib/scheduler.js` back to `'30 3 * * *'` (9 AM IST)
6. Set `FROM_EMAIL` to your verified domain email

## All Fixed Bugs
| # | Problem | Fix |
|---|---|---|
| 1 | SW killed mid-pipeline | `pendingCommit` saved before GitHub calls |
| 2 | `processedSubmissions` lost on SW restart | Persisted as `seenSubmissions` (last 100) |
| 3 | Groq wraps JSON in fences | `stripFences()` in `backend/lib/gemini.js` |
| 4 | `btoa()` stack overflow on large files | Chunked 8192-byte base64 in `github.js` |
| 5 | `meta.title` undefined | `safeMeta` defaults in `background.js` |
| 6 | GitHub 409 SHA conflict | 4-attempt retry with fresh SHA |
| 7 | Groq hangs → SW killed | `AbortController` 30s timeout |
| 8 | Non-JSON 502/504 response crashes | `res.text()` → `JSON.parse()` with catch |
| 9 | Groq fails → pipeline stops | `analyze.js` fallback (200) so GitHub still commits |
| 10 | Old submission triggers AI | Timestamp check >5 min → `SKIP_OLD_SUBMISSION` |
| 11 | Wrong file extension (solution.txt) | 6 fallback selectors in `getLanguage()` |
| 12 | Duplicate tracker entries | `findIndex` by slug → undo old counts → splice → push |
| 13 | Date-based folders = duplicates in GitHub | Path changed to `problems/{slug}/` (slug only) |

## Files That Must Not Change Without Caution
- `crypto.js` — any change breaks all previously encrypted tokens in user storage
- `manifest.json` — `host_permissions` must list every domain fetched; `oauth2.client_id` must match Google Cloud Console
- `github.js` — SHA retry logic is intentional; chunked base64 is intentional

## Storage Keys (chrome.storage.local)
| Key | Type | Purpose |
|---|---|---|
| `backendUrl` | string | Backend server URL |
| `githubToken` | string (encrypted) | GitHub personal access token |
| `tracker` | object | Solve stats: streak, difficulty, topics, weakTopics, solves[] |
| `seenSubmissions` | string[] | Last 100 submission IDs — dedup across SW restarts |
| `pendingCommit` | object | In-flight solve data; removed after successful GitHub commit |
