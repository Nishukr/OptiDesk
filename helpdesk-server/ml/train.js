// ml/train.js — trains the ticket classifiers. Run once: npm run train
// Creates ml/category.json and ml/priority.json (used by services/triage.js in Phase 3).
const natural = require('natural');
const path = require('path');

const categoryClf = new natural.BayesClassifier();
const priorityClf = new natural.BayesClassifier();

// Seed training data. Add MANY more examples (aim for 20-30+ per label) to improve accuracy.
const data = [
  // ---- billing ----
  { text: 'I was charged twice for my subscription this month', category: 'billing', priority: 'high' },
  { text: 'please refund my last payment', category: 'billing', priority: 'high' },
  { text: 'my invoice amount looks wrong', category: 'billing', priority: 'normal' },
  { text: 'how do I update my credit card', category: 'billing', priority: 'low' },
  { text: 'I want to cancel my plan and get a refund', category: 'billing', priority: 'high' },
  { text: 'why was I billed after cancelling', category: 'billing', priority: 'high' },
  // ---- technical ----
  { text: 'the app crashes every time I click upload', category: 'technical', priority: 'urgent' },
  { text: 'the website is completely down and I cannot work', category: 'technical', priority: 'urgent' },
  { text: 'I get a 500 error when saving my profile', category: 'technical', priority: 'high' },
  { text: 'images are not loading on the dashboard', category: 'technical', priority: 'normal' },
  { text: 'the export button does nothing', category: 'technical', priority: 'normal' },
  { text: 'login page keeps spinning forever', category: 'technical', priority: 'high' },
  // ---- account ----
  { text: 'I cannot reset my password', category: 'account', priority: 'normal' },
  { text: 'how do I change my email address', category: 'account', priority: 'low' },
  { text: 'I want to delete my account', category: 'account', priority: 'normal' },
  { text: 'my account is locked after too many attempts', category: 'account', priority: 'high' },
  { text: 'how do I enable two factor authentication', category: 'account', priority: 'low' },
  { text: 'please update my profile name', category: 'account', priority: 'low' },
  // ---- general ----
  { text: 'what are your business hours', category: 'general', priority: 'low' },
  { text: 'do you offer a student discount', category: 'general', priority: 'low' },
  { text: 'where can I find your documentation', category: 'general', priority: 'low' },
  { text: 'is there a mobile app available', category: 'general', priority: 'low' },
  { text: 'can I integrate this with slack', category: 'general', priority: 'normal' },
  { text: 'thank you for the great support', category: 'general', priority: 'low' },
];

data.forEach((d) => {
  categoryClf.addDocument(d.text.toLowerCase(), d.category);
  priorityClf.addDocument(d.text.toLowerCase(), d.priority);
});

categoryClf.train();
priorityClf.train();

const catPath = path.join(__dirname, 'category.json');
const priPath = path.join(__dirname, 'priority.json');

categoryClf.save(catPath, (err) => {
  if (err) return console.error(err);
  priorityClf.save(priPath, (err2) => {
    if (err2) return console.error(err2);
    console.log('✓ Trained and saved: ml/category.json and ml/priority.json');
  });
});
