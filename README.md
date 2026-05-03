# LeetCode AI Journal

A Chrome extension that automatically analyzes your LeetCode solutions with AI and commits them to GitHub with structured analytics and a personal dashboard.

## What It Does

When you solve a LeetCode problem and get "Accepted":

1. **Auto-detects** the submission using DOM observers
2. **Fetches** full problem metadata via LeetCode's GraphQL API
3. **Analyzes** your code with TrueFoundry AI for approach, complexity, patterns, and insights
4. **Commits** everything to GitHub in a date-wise folder structure:
   ```
   2025/
     05/
       2025-05-02_two-sum/
         solution.py
         README.md (AI-generated breakdown)
   ```
5. **Updates** `tracker.json` with topic analytics, streaks, and weak areas
6. **Maintains** a root `README.md` dashboard with stats and recent solves
7. **Provides** a popup dashboard showing streaks, topic heatmaps, and recent activity
8. **Offers** an AI chat sidebar on problem pages with personalized mentoring

## Features

- **AI-Powered Analysis**: TrueFoundry AI generates detailed breakdowns of your solutions
- **GitHub Integration**: Automatic commits with meaningful messages
- **Analytics Dashboard**: Track progress, streaks, and topic coverage
- **Personalized AI Chat**: Context-aware mentoring based on your history
- **Weak Area Detection**: Identifies topics you need to practice more
- **Date-wise Organization**: Clean GitHub repo structure

## Tech Stack

- **Chrome Extension Manifest V3**
- **TrueFoundry API** (OpenAI-compatible) for AI analysis
- **GitHub REST API** for automated commits
- **LeetCode GraphQL API** for problem metadata
- **Vanilla JavaScript** with ES modules
- **Environment variables** (.env file) for configuration

## Screenshots

*(Add screenshots here once implemented)*

## Installation

See [SETUP.md](SETUP.md) for detailed installation instructions.

## Configuration

All API keys and settings are stored in the `.env` file in the extension root directory. Copy the provided `.env` template and fill in your actual credentials:

- **TrueFoundry**: Base URL, API key, and model name from your TrueFoundry account
- **GitHub**: Personal access token, username, and repository name

## Privacy

- API keys are stored locally in the `.env` file (not in browser storage)
- No data is sent to any servers except official TrueFoundry and GitHub APIs
- All processing happens locally in the extension