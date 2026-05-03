// utils/leetcode.js
// Fetches problem metadata from LeetCode's GraphQL API

/**
 * Fetches full problem metadata from LeetCode
 * @param {string} slug - Problem slug (e.g., "two-sum")
 * @returns {Object} Problem metadata or empty object on failure
 */
export async function fetchLeetCodeMeta(slug) {
  try {
    const query = `
      query getQuestion($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          title
          difficulty
          content
          topicTags {
            name
          }
          hints
          exampleTestcases
        }
      }
    `;

    console.log(`[LeetCode AI] Fetching metadata for: ${slug}`);

    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include session cookies
      body: JSON.stringify({
        query,
        variables: { titleSlug: slug }
      })
    });

    if (!response.ok) {
      throw new Error(`LeetCode API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${data.errors.map(e => e.message).join(', ')}`);
    }

    const question = data.data.question;
    if (!question) {
      throw new Error('Question not found');
    }

    console.log(`[LeetCode AI] Successfully fetched metadata for: ${question.title}`);

    return {
      title: question.title,
      difficulty: question.difficulty,
      content: question.content,
      tags: question.topicTags.map(tag => tag.name),
      hints: question.hints || [],
      exampleTestcases: question.exampleTestcases || ''
    };

  } catch (error) {
    console.error(`[LeetCode AI] Failed to fetch LeetCode metadata for ${slug}:`, error);
    return {};
  }
}

/**
 * Fetches full submission code from LeetCode
 * @param {string} submissionId
 * @returns {string} solution code
 */
export async function fetchLeetCodeSubmissionCode(submissionId) {
  if (!submissionId) {
    throw new Error('No submission ID provided');
  }

  const response = await fetch(`https://leetcode.com/submissions/detail/${submissionId}/check/`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`LeetCode submission API error: ${response.status}`);
  }

  const data = await response.json();
  const code = data.code || data.submission?.code || data.data?.code;

  if (!code) {
    throw new Error('No code found in LeetCode submission response');
  }

  return code;
}