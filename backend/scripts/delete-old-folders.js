// Run: node backend/scripts/delete-old-folders.js <github_token> <owner/repo> [folder]
// Example: node backend/scripts/delete-old-folders.js ghp_xxx ujala29/LeetCode-AutoPush-AI-Code-Analyst 2026

const [,, token, repo, folder = '2026'] = process.argv;

if (!token || !repo) {
  console.error('Usage: node delete-old-folders.js <github_token> <owner/repo> [folder]');
  process.exit(1);
}

const BASE = `https://api.github.com/repos/${repo}`;
const HEADERS = {
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'leetcode-cleanup-script'
};

async function getAllFiles(path) {
  const res = await fetch(`${BASE}/contents/${path}`, { headers: HEADERS });
  if (!res.ok) {
    if (res.status === 404) { console.log(`Not found: ${path}`); return []; }
    throw new Error(`GitHub API error ${res.status} for ${path}`);
  }
  const items = await res.json();
  const files = [];
  for (const item of items) {
    if (item.type === 'dir') {
      files.push(...await getAllFiles(item.path));
    } else {
      files.push({ path: item.path, sha: item.sha });
    }
  }
  return files;
}

async function deleteFile(path, sha) {
  const res = await fetch(`${BASE}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `cleanup: remove old date-based folder ${path}`, sha })
  });
  if (!res.ok) throw new Error(`Failed to delete ${path}: ${res.status}`);
  console.log(`✓ Deleted: ${path}`);
}

async function main() {
  console.log(`\nFetching all files in "${folder}/" from ${repo}...\n`);
  const files = await getAllFiles(folder);

  if (files.length === 0) {
    console.log('No files found. Already clean!');
    return;
  }

  console.log(`Found ${files.length} files. Deleting...\n`);

  for (const file of files) {
    try {
      await deleteFile(file.path, file.sha);
      await new Promise(r => setTimeout(r, 300)); // avoid rate limit
    } catch (err) {
      console.error(`✗ ${file.path}: ${err.message}`);
    }
  }

  console.log(`\nDone! "${folder}/" folder removed from GitHub.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
