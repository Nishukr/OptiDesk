// services/triage.js — offline ticket triage (no API key needed).
// Uses the Bayes classifiers trained by `npm run train` (ml/category.json,
// ml/priority.json) plus the `sentiment` library. Called from createTicket.
const path = require('path');
const natural = require('natural');
const Sentiment = require('sentiment');

const sentiment = new Sentiment();
const CATEGORIES = ['billing', 'technical', 'account', 'general'];
const PRIORITIES = ['urgent', 'high', 'normal', 'low'];

// Classifiers load asynchronously from disk once, at startup. Until they finish
// (or if the JSON files are missing because `npm run train` was never run) we
// fall back to safe defaults instead of crashing.
let categoryClf = null;
let priorityClf = null;

function loadClassifier(file, assign) {
  const full = path.join(__dirname, '..', 'ml', file);
  natural.BayesClassifier.load(full, null, (err, clf) => {
    if (err) {
      console.warn(`⚠️  triage: could not load ml/${file} (run "npm run train"). Using defaults.`);
      return;
    }
    assign(clf);
  });
}
loadClassifier('category.json', (c) => (categoryClf = c));
loadClassifier('priority.json', (c) => (priorityClf = c));

// Nudge priority up when the customer clearly sounds upset, so an angry
// "this is broken and I'm furious" doesn't sit at "normal".
function escalate(priority, score) {
  if (score > -3) return priority;
  const i = PRIORITIES.indexOf(priority);
  return PRIORITIES[Math.max(0, i - 1)]; // one step more urgent
}

function safeClassify(clf, text, allowed, fallback) {
  if (!clf) return fallback;
  try {
    const label = clf.classify(text);
    return allowed.includes(label) ? label : fallback;
  } catch {
    return fallback;
  }
}

// triage(text) -> { category, priority, sentimentScore }
function triage(text = '') {
  const clean = String(text).toLowerCase().trim();
  if (!clean) return { category: 'general', priority: 'normal', sentimentScore: 0 };

  const category = safeClassify(categoryClf, clean, CATEGORIES, 'general');
  const basePriority = safeClassify(priorityClf, clean, PRIORITIES, 'normal');
  const sentimentScore = sentiment.analyze(clean).score;

  return { category, priority: escalate(basePriority, sentimentScore), sentimentScore };
}

module.exports = { triage };
