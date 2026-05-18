# Setup Guide for LeetCode AI Journal

Follow these steps to install and configure the extension.

## 1. Clone or Download the Extension

```bash
git clone <this-repo-url>
cd leetcode-ai-journal
```

## 2. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `leetcode-ai-journal` folder
5. The extension should appear in your extensions list

## 3. Get Required API Keys

### TrueFoundry API Key

1. Go to your TrueFoundry account dashboard
2. Navigate to API Keys section
3. Create a new API key or copy an existing one
4. Note the Base URL and Model name for your deployment

### GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)" or "Fine-grained token"
3. For **fine-grained token** (recommended):
   - Name: "LeetCode AI Journal"
   - Repository access: Select your target repo
   - Permissions: Check "Contents" (Read and write)
4. For **classic token**:
   - Scopes: Check `repo` (full control of private repositories)
5. Copy the token (keep it secret!)

## 4. Configure the Extension

1. Click the extension icon in your Chrome toolbar to open the popup
2. Go to the "Settings" tab
3. Fill in your API credentials:
   - **TrueFoundry URL**: Your TrueFoundry API endpoint (e.g., `https://truefoundry.innovaccer.com/api/llm/api/inference/openai/`)
   - **TrueFoundry Key**: Your TrueFoundry API key
   - **TrueFoundry Model**: Your model name (e.g., `internal-bedrock/sonnet-46`)
   - **GitHub Token**: Your GitHub personal access token
   - **GitHub Owner**: Your GitHub username or organization name
   - **GitHub Repo**: The name of your target repository
4. Click "Save Settings" to store your configuration

## 5. Test the Extension

1. Go to [LeetCode](https://leetcode.com)
2. Solve a problem and submit your solution
3. Look for the "AI Analysis" button that appears after submission
4. Click it to see the AI-powered analysis in the sidebar

## Troubleshooting

### Extension not loading?
- Make sure all files are in the correct folder structure
- Check the console in `chrome://extensions/` for errors
- Try reloading the extension

### API errors?
- Double-check your API keys are correct in the extension settings
- Make sure GitHub token has the right permissions
- Check the browser console for detailed error messages

### No toast notifications?
- Make sure you're on a LeetCode problem page
- Try refreshing the page
- Check if the extension has permission to run on leetcode.com

### GitHub commits failing?
- Verify the repository exists and is accessible
- Check that your GitHub token is valid and has write access
- Make sure the repository name matches exactly (case-sensitive)

### Extension not loading?
- Make sure all files are in the correct folder structure
- Check the console in `chrome://extensions/` for errors
- Try reloading the extension

### API errors?
- Double-check your API keys are correct
- Make sure GitHub token has the right permissions
- Check the browser console for detailed error messages

### No toast notifications?
- Make sure you're on a LeetCode problem page
- Try refreshing the page
- Check if the extension has permission to run on leetcode.com

### GitHub commits failing?
- Verify the repository exists and is accessible
- Check that your GitHub token is valid and has write access
- Make sure the repository name matches exactly (case-sensitive)

## File Structure

After setup, your GitHub repo will have this structure:

```
your-leetcode-repo/
├── 2025/
│   └── 05/
│       └── 2025-05-02_two-sum/
│           ├── solution.py
│           └── README.md
├── tracker.json
└── README.md
```

## Support

If you encounter issues, check the browser console for error messages prefixed with `[LeetCode AI]`.

![alt text](image.png)