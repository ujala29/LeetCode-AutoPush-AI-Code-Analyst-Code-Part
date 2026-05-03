// utils/readme-builder.js
// Builds per-problem README.md with AI analysis

/**
 * Builds a comprehensive README for a solved problem
 * @param {Object} params - Build parameters
 * @param {string} params.slug - Problem slug
 * @param {string} params.code - Solution code
 * @param {string} params.lang - Programming language
 * @param {Object} params.meta - Problem metadata
 * @param {Object} params.analysis - AI analysis
 * @param {string} params.dateStr - Date string
 * @returns {string} Markdown content
 */
export function buildReadme({ slug, code, lang, meta, analysis, dateStr }) {
  // Strip HTML from problem content
  const plainContent = stripHtml(meta.content || '').substring(0, 600);

  // Build badges
  const difficultyBadge = getDifficultyBadge(meta.difficulty);
  const tagBadges = (meta.tags || []).map(tag => `\`${tag}\``).join(' ');

  // Build logic steps
  const logicSteps = (analysis.logic || []).map((step, i) => `${i + 1}. ${step}`).join('\n');

  // Build similar problems
  const similarProblems = (analysis.similar_problems || [])
    .map(problem => `- ${problem}`)
    .join('\n');

  // Get language identifier for code block
  const langId = getLanguageIdentifier(lang);

  const markdown = `# ${meta.title || 'Unknown Problem'}

**Date:** ${dateStr}  
**Difficulty:** ${difficultyBadge}  
**Tags:** ${tagBadges}

## Problem Description

${plainContent}

[LeetCode Link](https://leetcode.com/problems/${slug})

## Approach

${analysis.approach || 'Unknown'}

> ${analysis.essence || 'No essence provided'}

## Solution Logic

${logicSteps || 'No logic breakdown provided'}

## Complexity Analysis

| Complexity | Analysis |
|------------|----------|
| **Time:** | ${analysis.time_complexity || 'Unknown'} |
| **Space:** | ${analysis.space_complexity || 'Unknown'} |

## Edge Cases Handled

${(analysis.edge_cases_handled || []).map(ec => `- ${ec}`).join('\n') || 'None specified'}

## What I Learned

${analysis.what_i_learned || 'No insights provided'}

## Similar Problems

${similarProblems || 'None suggested'}

## Solution Code

\`\`\`${langId}
${code}
\`\`\`
`;

  return markdown;
}

// Helper functions
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDifficultyBadge(difficulty) {
  switch (difficulty?.toLowerCase()) {
    case 'easy': return '🟢 **Easy**';
    case 'medium': return '🟡 **Medium**';
    case 'hard': return '🔴 **Hard**';
    default: return '⚪ **Unknown**';
  }
}

function getLanguageIdentifier(lang) {
  const map = {
    'python': 'python',
    'python3': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c++': 'cpp',
    'c': 'c',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'go': 'go',
    'rust': 'rust',
    'kotlin': 'kotlin',
    'swift': 'swift',
    'ruby': 'ruby',
    'php': 'php',
    'scala': 'scala',
    'racket': 'racket',
    'erlang': 'erlang',
    'elixir': 'elixir'
  };
  return map[lang?.toLowerCase()] || 'text';
}