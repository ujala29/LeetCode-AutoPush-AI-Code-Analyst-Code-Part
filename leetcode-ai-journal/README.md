# LeetCode AI Journal

A Chrome extension that automatically analyzes your LeetCode solutions with AI, commits them to GitHub, and provides a personalized DSA mentor chatbot — with Google sign-in and daily email motivation.

## What It Does

When you solve a LeetCode problem and get "Accepted":

1. **Detects** the submission automatically (no button clicks needed)
2. **Fetches** full problem metadata via LeetCode's GraphQL API
3. **Analyzes** your code with Groq AI (LLaMA 3.3 70B) — approach, complexity, patterns, key insights
4. **Commits** everything to your GitHub repo:
   ```
   problems/
     two-sum/
       solution.cpp
       README.md        ← AI-generated breakdown
     palindrome-number/
       solution.py
       README.md
   tracker.json         ← your stats
   README.md            ← auto-updated dashboard
   ```
5. **Updates** local tracker with streak, difficulty counts, topic heatmap, weak areas
6. **Syncs** your stats to the backend for daily email reminders

## Features

- **Google Sign-In** — one-click auth, no separate accounts needed
- **AI-Powered Analysis** — approach, time/space complexity, patterns, improvement tips
- **GitHub Auto-Commit** — structured repo, no duplicates (same problem always overwrites)
- **Popup Dashboard** — streak, difficulty breakdown, recent 10 solves, topic heatmap
- **AI Mentor Chatbot** — floating sidebar on LeetCode with 8 quick-help buttons:
  - ⚠️ Edge Cases · 💡 Hint · 👀 Review Code · 🇮🇳 Hinglish explanation
  - 🎯 Similar Problems · 📝 More Examples · ⚡ Complexity · 🧠 Pattern Used
- **Problem Context Aware** — AI sees your current problem + code in the editor
- **Daily Email Motivation** — personalized reminder with your weak areas every morning (9 AM IST)
- **Weak Area Detection** — identifies topics you need to practice more

## Architecture

```
Chrome Extension (no API keys)
        ↓  Google OAuth token
  Node.js Backend Proxy
        ↓
   Groq AI API (LLaMA 3.3 70B)
```

All AI API keys live only on the backend server — safe for Chrome Web Store.

## Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome MV3, Vanilla JS (ESM) |
| Auth | Google OAuth via `chrome.identity` |
| AI | Groq API — `llama-3.3-70b-versatile` (30 RPM free) |
| Backend | Node.js 18+, Express 4 |
| GitHub | GitHub REST API (auto-commit) |
| LeetCode | GraphQL API (metadata + submission code) |
| Email | Resend API (100 emails/day free) |
| Encryption | Web Crypto AES-GCM (GitHub token) |

## Installation & Setup

### 1. Backend

```bash
cd backend
npm install
# Fill in backend/.env (see below)
npm run dev        # http://localhost:3000
```

**backend/.env:**
```
GROQ_API_KEY=gsk_...          # groq.com — free
GOOGLE_CLIENT_ID=...          # Google Cloud Console → Chrome Extension OAuth client
RESEND_API_KEY=re_...         # resend.com — free (optional, for emails)
FROM_EMAIL=onboarding@resend.dev
PORT=3000
```

### 2. Extension

1. Go to `chrome://extensions` → Enable **Developer mode**
2. **Load unpacked** → select `leetcode-ai-journal/` folder
3. Note the **Extension ID** shown (32 characters)

### 3. Google OAuth Client

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. **Create credentials → OAuth 2.0 Client ID → Chrome Extension**
3. Paste your Extension ID in **Item ID**
4. Copy the Client ID → paste in:
   - `manifest.json` → `oauth2.client_id`
   - `backend/.env` → `GOOGLE_CLIENT_ID`

### 4. Extension Settings

Open the extension popup → **Settings**:
- **Backend URL**: `http://localhost:3000` (local) or your deployed URL
- **GitHub Token**: `ghp_...` with `repo` scope

Then click **Sign in with Google** at the top of the popup.

## Before Chrome Web Store Publish

1. Deploy backend (Railway / Render / Fly.io)
2. Update `manifest.json` → `host_permissions` with your production backend URL
3. Update `backend/.env` → set a real `GOOGLE_CLIENT_ID` for the production extension ID
4. Change daily email time in `backend/lib/scheduler.js` to `'30 3 * * *'` (9 AM IST)

## Privacy

- No AI API keys stored in the extension — all on your own backend server
- GitHub token encrypted with AES-GCM and stored locally in your browser
- Google OAuth token managed by Chrome — never sent to third parties
- Your solve data goes only to GitHub (your own repo) and your own backend
