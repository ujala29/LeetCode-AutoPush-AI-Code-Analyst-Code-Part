# Backend-Side Rendering: Architecture for Chrome Extension Security

## Why This Matters for the Chrome Web Store

Your extension currently calls the **Claude API** and **GitHub API directly** from the browser — meaning the API keys live inside the extension package. Anyone who installs your extension (or downloads the `.crx` file) can extract those keys.

Google Web Store also flags extensions that embed sensitive credentials or make direct calls to powerful third-party APIs without a proxy layer.

The solution is a **Backend Proxy Architecture**.

---

## Current Architecture (Client-Side / Insecure)

```
[User's Browser]
      |
      | (extension code runs here)
      |
      ├──→ Claude API  (API key stored in extension)
      ├──→ GitHub API  (token stored in extension)
      └──→ LeetCode    (scraping done client-side)
```

**Problems:**
- API keys are visible inside the extension package
- No rate limiting or abuse control
- No way to revoke a single user's access
- Violates Chrome Web Store policies for key management

---

## Backend-Side Architecture (Secure)

```
[User's Browser / Extension]
      |
      | (only talks to YOUR server)
      |
      ↓
[Your Backend Server]  ← API keys live here, never leave this box
      |
      ├──→ Claude API  (Anthropic)
      ├──→ GitHub API
      └──→ Any other service
```

The extension never knows the real API keys. It only knows **your server's URL**.

---

## How the Data Flow Works

### Step 1 — User triggers an action in the extension
The popup or sidebar collects data (e.g., LeetCode problem, user's code, notes) and sends it to **your backend** via a simple HTTP POST.

```
Extension  →  POST https://your-api.com/analyze
              Body: { problem, code, notes }
              Header: Authorization: Bearer <user-session-token>
```

### Step 2 — Your backend validates the request
Before touching any API, your server:
- Verifies the user's session token (so random people can't abuse your API)
- Rate-limits the request (e.g., max 10 AI calls per hour per user)
- Sanitizes the input

### Step 3 — Your backend calls the real APIs
Your server (running in a private environment) holds the Claude API key and GitHub token. It assembles the full prompt and calls Claude's API.

```
Your Server  →  POST https://api.anthropic.com/v1/messages
               Header: x-api-key: YOUR_SECRET_CLAUDE_KEY
               Body: { model, messages, ... }
```

### Step 4 — Your backend returns only the result
The raw Claude response is processed server-side and only the **needed output** is sent back to the extension.

```
Your Server  →  Extension
               Body: { analysis, hints, summary }
```

---

## Component Breakdown

| Component | Runs Where | Holds What | Does What |
|---|---|---|---|
| Extension (popup, sidebar, background.js) | User's browser | Nothing sensitive | UI, data collection, display |
| Content script (content.js) | User's browser | Nothing | Scrapes LeetCode page DOM |
| Your Backend Server | Cloud / VPS | API keys, user DB | Validates, proxies, rate-limits |
| Claude API | Anthropic's servers | AI model | Generates AI responses |
| GitHub API | GitHub's servers | User repos | Saves journal entries |

---

## Authentication Layer (How Users Are Identified)

Since your server is now public, you need to know WHO is calling it.

```
[Extension]  →  Login flow (Google OAuth or email/password)
                    ↓
             [Your Backend issues a JWT token]
                    ↓
             Extension stores token in chrome.storage.local
                    ↓
             Every request includes: Authorization: Bearer <token>
                    ↓
             Backend verifies token before doing anything
```

This way:
- You can revoke a specific user's access
- You can track usage per user
- Abuse is isolated and containable

---

## GitHub Integration in This Architecture

Instead of storing the user's GitHub token in the extension:

1. User logs into your backend via GitHub OAuth
2. Your backend receives and **stores** their GitHub token server-side
3. Extension says "save this journal entry" → your backend handles the GitHub API call
4. Extension never sees the GitHub token

---

## What Stays in the Extension vs What Moves to the Backend

| Logic | Before | After |
|---|---|---|
| Claude API call | `utils/claude.js` in extension | Backend endpoint `/api/analyze` |
| GitHub push | `utils/github.js` in extension | Backend endpoint `/api/save` |
| API key storage | `chrome.storage.local` or hardcoded | Environment variables on server |
| User auth token | Hardcoded or none | Issued by your backend, stored in `chrome.storage.local` |
| LeetCode DOM scraping | `content.js` | Stays in extension (no secret needed) |
| Encryption (`crypto.js`) | Extension | Can stay in extension for client-side data |

---

## Deployment Options for Your Backend

| Option | Complexity | Cost | Good For |
|---|---|---|---|
| **Vercel / Railway** (Node.js) | Low | Free tier available | Quick start |
| **Render** | Low | Free tier available | Persistent server |
| **AWS Lambda** | Medium | Pay-per-call | Scaling |
| **Cloudflare Workers** | Medium | Generous free tier | Edge performance |
| **VPS (DigitalOcean / Linode)** | High | ~$5/month | Full control |

---

## Chrome Web Store Compliance Checklist

- [ ] No API keys embedded in extension source code
- [ ] No remotely hosted executable scripts (`eval`, dynamic imports)
- [ ] All permissions in `manifest.json` are justified and minimal
- [ ] Content Security Policy (CSP) defined in manifest
- [ ] Extension only communicates with your declared backend domain
- [ ] User data handled per Chrome Web Store privacy requirements
- [ ] `host_permissions` only lists your backend domain, not `*://*/*`

---

## Summary

The core idea is simple: **your extension is a dumb UI layer**. It collects input and displays output. All intelligence, all secrets, and all API communication happen on a server you control. The extension only ever talks to your server, and your server is the only place that knows the real API keys.

This makes the extension safe to distribute publicly, impossible to abuse by extracting its source, and easy to update (change AI models, APIs, or logic without pushing a new extension version).
