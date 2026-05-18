# LeetCode AI Journal

A Chrome extension that automatically analyzes your LeetCode solutions with AI, commits them to GitHub, and provides a personalized DSA mentor chatbot — with Google sign-in and daily email motivation.

## Repo Structure

```
leetcode-ai-journal/    ← Chrome Extension (load this in chrome://extensions)
backend/                ← Node.js proxy server (run this before using the extension)
```

## What It Does

When you solve a LeetCode problem and get "Accepted":

1. **Detects** the submission automatically
2. **Analyzes** your code with Groq AI (LLaMA 3.3 70B) — approach, complexity, patterns
3. **Commits** to your GitHub repo:
   ```
   problems/
     two-sum/solution.cpp + README.md
     palindrome-number/solution.py + README.md
   tracker.json
   README.md
   ```
4. **Updates** streak, difficulty counts, topic heatmap, weak areas
5. **Sends** daily motivation emails with your weak areas (9 AM IST)

## Features

- **Google Sign-In** — one-click auth via `chrome.identity`
- **AI-Powered Analysis** — approach, complexity, patterns, improvement tips
- **GitHub Auto-Commit** — no duplicates, same problem always overwrites
- **Popup Dashboard** — streak, difficulty breakdown, recent solves, topic heatmap
- **AI Mentor Chatbot** — floating sidebar with 8 quick-help buttons
- **Problem Context Aware** — AI sees your current problem + code
- **Daily Email** — personalized reminder with weak areas every morning

## Architecture

```
Chrome Extension (no API keys)
        ↓  Google OAuth Bearer token
  Node.js Backend Proxy
        ↓
   Groq AI API (LLaMA 3.3 70B)
```

## Quick Setup

### 1. Backend
```bash
cd backend
npm install
# Fill in .env (see backend/.env.example)
npm run dev
```

### 2. Extension
- `chrome://extensions` → Developer mode ON → **Load unpacked** → select `leetcode-ai-journal/`
- Copy the Extension ID

### 3. Google OAuth
- [Google Cloud Console](https://console.cloud.google.com) → Create OAuth 2.0 Client → Chrome Extension
- Paste Extension ID as Item ID → copy Client ID
- Add to `manifest.json` (`oauth2.client_id`) and `backend/.env` (`GOOGLE_CLIENT_ID`)

### 4. First Use
- Open popup → **Sign in with Google**
- Settings → set Backend URL + GitHub Token

## Tech Stack

| | Technology |
|---|---|
| Extension | Chrome MV3, Vanilla JS |
| Auth | Google OAuth (`chrome.identity`) |
| AI | Groq — `llama-3.3-70b-versatile` |
| Backend | Node.js 18+, Express 4 |
| Email | Resend API |
| Storage | GitHub REST API + chrome.storage.local |

## Before Chrome Web Store Publish
1. Deploy backend (Railway / Render / Fly.io)
2. Update `host_permissions` in `manifest.json` with production URL
3. Update `GOOGLE_CLIENT_ID` in `.env` for production extension ID
4. Set `RESEND_API_KEY` for daily emails
