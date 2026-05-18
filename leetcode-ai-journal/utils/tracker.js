// utils/tracker.js
// Manages the analytics tracker with streaks, topics, and weak areas

/**
 * Updates the tracker with a new solved problem
 * @param {Object} tracker - Current tracker object
 * @param {Object} solveData - New solve data
 * @param {string} solveData.slug - Problem slug
 * @param {string} solveData.dateStr - Date string YYYY-MM-DD
 * @param {Object} solveData.meta - Problem metadata
 * @param {Object} solveData.analysis - AI analysis
 * @returns {Object} Updated tracker
 */
export function updateTracker(tracker, { slug, dateStr, meta, analysis }) {
  // Deep clone to avoid mutating original
  const updated = JSON.parse(JSON.stringify(tracker));

  // Initialize structures if needed
  updated.solves = updated.solves || [];
  updated.topics = updated.topics || {};
  updated.difficulty = updated.difficulty || { Easy: 0, Medium: 0, Hard: 0 };
  updated.streak = updated.streak || { current: 0, best: 0, last_date: null };

  const solveEntry = {
    date: dateStr,
    slug,
    title: meta.title || 'Unknown',
    difficulty: meta.difficulty || 'Unknown',
    patterns: analysis.patterns || [],
    tags: meta.tags || [],
    essence: analysis.essence || '',
    approach: analysis.approach || '',
    time_complexity: analysis.time_complexity || '',
    path: `${dateStr.slice(0, 4)}/${dateStr.slice(5, 7)}/${dateStr}_${slug}`
  };

  // If slug already exists, remove old entry and undo its counts before adding updated one
  const existingIdx = updated.solves.findIndex(s => s.slug === slug);
  if (existingIdx !== -1) {
    const old = updated.solves[existingIdx];

    // Undo old difficulty count
    if (old.difficulty && updated.difficulty[old.difficulty] !== undefined) {
      updated.difficulty[old.difficulty] = Math.max(0, updated.difficulty[old.difficulty] - 1);
    }

    // Undo old topic/pattern counts
    const oldTags = [...(old.tags || []), ...(old.patterns || [])];
    oldTags.forEach(tag => {
      const normalized = tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (updated.topics[normalized]) {
        updated.topics[normalized] = Math.max(0, updated.topics[normalized] - 1);
        if (updated.topics[normalized] === 0) delete updated.topics[normalized];
      }
    });

    updated.solves.splice(existingIdx, 1); // remove old entry
  }

  updated.solves.push(solveEntry);

  // Update topic counts
  const allTags = [...(meta.tags || []), ...(analysis.patterns || [])];
  allTags.forEach(tag => {
    const normalizedTag = tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
    updated.topics[normalizedTag] = (updated.topics[normalizedTag] || 0) + 1;
  });

  // Update difficulty counts
  const diff = meta.difficulty;
  if (diff && updated.difficulty[diff] !== undefined) {
    updated.difficulty[diff]++;
  }

  // Calculate streak
  const today = new Date(dateStr);
  const lastDate = updated.streak.last_date ? new Date(updated.streak.last_date) : null;

  if (!lastDate) {
    // First solve
    updated.streak.current = 1;
    updated.streak.best = 1;
  } else {
    const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      // Same day, no change
    } else if (daysDiff === 1) {
      // Consecutive day
      updated.streak.current++;
      if (updated.streak.current > updated.streak.best) {
        updated.streak.best = updated.streak.current;
      }
    } else {
      // Streak broken
      updated.streak.current = 1;
    }
  }

  updated.streak.last_date = dateStr;

  // Identify weak topics
  const knownTopics = [
    'dynamic-programming', 'graphs', 'bfs', 'dfs', 'trees', 'binary-search',
    'two-pointers', 'sliding-window', 'backtracking', 'greedy', 'heap',
    'trie', 'segment-tree', 'monotonic-stack', 'union-find', 'bit-manipulation'
  ];

  updated.weakTopics = knownTopics.filter(topic =>
    !updated.topics[topic] || updated.topics[topic] < 3
  );

  // Update timestamp
  updated.lastUpdated = new Date().toISOString();

  return updated;
}