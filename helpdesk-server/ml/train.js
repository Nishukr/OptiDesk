// ml/train.js — trains the ticket classifiers. Run once: npm run train
// Creates ml/category.json and ml/priority.json (used by services/triage.js in Phase 3).
const natural = require('natural');
const path = require('path');

const categoryClf = new natural.BayesClassifier();
const priorityClf = new natural.BayesClassifier();
// Expanded training dataset for Ticket Triage & Classification
const data = [
  // ==========================================
  // ---- BILLING (Payments, Invoices, Plans) -
  // ==========================================
  { text: 'I was charged twice for my subscription this month', category: 'billing', priority: 'high' },
  { text: 'please refund my last payment immediately', category: 'billing', priority: 'high' },
  { text: 'my invoice amount looks completely wrong', category: 'billing', priority: 'normal' },
  { text: 'how do I update my credit card details', category: 'billing', priority: 'low' },
  { text: 'I want to cancel my plan and get a full refund', category: 'billing', priority: 'high' },
  { text: 'why was I billed after cancelling my subscription', category: 'billing', priority: 'high' },
  { text: 'unauthorized charge on my bank statement from your company', category: 'billing', priority: 'urgent' },
  { text: 'my payment failed but money was deducted from my account', category: 'billing', priority: 'urgent' },
  { text: 'where can I download my past VAT invoices for tax purposes', category: 'billing', priority: 'low' },
  { text: 'I want to upgrade from basic tier to enterprise yearly plan', category: 'billing', priority: 'normal' },
  { text: 'do you accept payment via PayPal or wire transfer', category: 'billing', priority: 'low' },
  { text: 'my coupon code is not applying any discount at checkout', category: 'billing', priority: 'normal' },
  { text: 'charged annual fee unexpectedly please revert to monthly', category: 'billing', priority: 'high' },
  { text: 'we need to switch our billing currency to EUR', category: 'billing', priority: 'low' },
  { text: 'how do I add our company tax ID or GST number to receipts', category: 'billing', priority: 'low' },
  { text: 'subscription renewal failed and our service is frozen', category: 'billing', priority: 'urgent' },
  { text: 'requesting a grace period extension before invoice due date', category: 'billing', priority: 'normal' },
  { text: 'please remove my old expired debit card from the system', category: 'billing', priority: 'low' },
  { text: 'overcharged on extra user seats this billing cycle', category: 'billing', priority: 'high' },
  { text: 'can I get a custom quote for 50 team member licenses', category: 'billing', priority: 'normal' },
  { text: 'fraudulent transaction detected on my credit card from this site', category: 'billing', priority: 'urgent' },
  { text: 'how does prorated billing work if I downgrade halfway through', category: 'billing', priority: 'low' },
  { text: 'need a copy of receipt for last month expense report', category: 'billing', priority: 'low' },
  { text: 'bank declined transaction error code 402', category: 'billing', priority: 'normal' },

  // ==========================================
  // ---- TECHNICAL (Bugs, Outages, Errors) ---
  // ==========================================
  { text: 'the app crashes every time I click upload', category: 'technical', priority: 'urgent' },
  { text: 'the website is completely down and our team cannot work', category: 'technical', priority: 'urgent' },
  { text: 'I get a 500 internal server error when saving my profile', category: 'technical', priority: 'high' },
  { text: 'images and thumbnails are not loading on the dashboard', category: 'technical', priority: 'normal' },
  { text: 'the export CSV button does nothing when clicked', category: 'technical', priority: 'normal' },
  { text: 'login page keeps spinning forever and never loads', category: 'technical', priority: 'high' },
  { text: 'our production database connection timed out', category: 'technical', priority: 'urgent' },
  { text: 'API returning 429 Too Many Requests even with low traffic', category: 'technical', priority: 'high' },
  { text: 'webhook notifications are delayed by several hours', category: 'technical', priority: 'normal' },
  { text: 'the search filter results are showing incorrect dates', category: 'technical', priority: 'normal' },
  { text: 'websocket disconnected and real-time chat is broken', category: 'technical', priority: 'high' },
  { text: 'getting a CORS error when calling your API endpoint from React', category: 'technical', priority: 'normal' },
  { text: 'mobile view layout is broken on iOS Safari', category: 'technical', priority: 'normal' },
  { text: 'critical security vulnerability discovered in public endpoint', category: 'technical', priority: 'urgent' },
  { text: 'data sync between mobile and desktop client is failing', category: 'technical', priority: 'high' },
  { text: 'getting 404 page not found on the settings page', category: 'technical', priority: 'normal' },
  { text: 'file upload times out when attaching files larger than 10mb', category: 'technical', priority: 'normal' },
  { text: 'dark mode toggle is not persisting after page refresh', category: 'technical', priority: 'low' },
  { text: 'memory leak causing the browser tab to freeze', category: 'technical', priority: 'high' },
  { text: 'SSL certificate expired warning showing for your domain', category: 'technical', priority: 'urgent' },
  { text: 'table sorting breaks when clicking column header', category: 'technical', priority: 'low' },
  { text: 'PDF generator produces blank corrupted documents', category: 'technical', priority: 'high' },
  { text: 'push notifications are not arriving on Android devices', category: 'technical', priority: 'normal' },
  { text: 'infinite redirect loop after OAuth login flow', category: 'technical', priority: 'urgent' },

  // ==========================================
  // ---- ACCOUNT (Auth, Security, Profiles) --
  // ==========================================
  { text: 'I cannot reset my password email never arrives', category: 'account', priority: 'normal' },
  { text: 'how do I change my primary account email address', category: 'account', priority: 'low' },
  { text: 'I want to delete my account and erase all my personal data', category: 'account', priority: 'normal' },
  { text: 'my account is locked after too many failed attempts', category: 'account', priority: 'high' },
  { text: 'how do I enable two factor authentication 2FA', category: 'account', priority: 'low' },
  { text: 'please update my profile display name and title', category: 'account', priority: 'low' },
  { text: 'I suspect my account has been hacked or compromised', category: 'account', priority: 'urgent' },
  { text: 'lost my phone and cannot receive 2FA SMS verification codes', category: 'account', priority: 'urgent' },
  { text: 'how do I invite new team members with admin permissions', category: 'account', priority: 'low' },
  { text: 'change ownership of the organization to another admin', category: 'account', priority: 'normal' },
  { text: 'SSO Google workspace login stopped working for all staff', category: 'account', priority: 'urgent' },
  { text: 'how to transfer projects from personal account to company team', category: 'account', priority: 'normal' },
  { text: 'cannot verify my email link shows expired token', category: 'account', priority: 'normal' },
  { text: 'remove ex-employee access from our workspace immediately', category: 'account', priority: 'high' },
  { text: 'where do I manage active logged in sessions and devices', category: 'account', priority: 'low' },
  { text: 'forgot username and no longer have access to recovery email', category: 'account', priority: 'high' },
  { text: 'how to merge two duplicate accounts under one login', category: 'account', priority: 'normal' },
  { text: 'updating company legal name in profile settings', category: 'account', priority: 'low' },
  { text: 'session keeps logging out every five minutes', category: 'account', priority: 'normal' },
  { text: 'requesting complete export of my GDPR account archive', category: 'account', priority: 'low' },
  { text: 'reset backup recovery codes for authenticator app', category: 'account', priority: 'high' },
  { text: 'cannot change account password invalid current password error', category: 'account', priority: 'normal' },

  // ==========================================
  // ---- GENERAL (Info, Inquiries, Feedback) -
  // ==========================================
  { text: 'what are your regular customer support business hours', category: 'general', priority: 'low' },
  { text: 'do you offer a student or non-profit discount', category: 'general', priority: 'low' },
  { text: 'where can I find the API documentation and tutorials', category: 'general', priority: 'low' },
  { text: 'is there a native mobile app available on iOS or Android', category: 'general', priority: 'low' },
  { text: 'can I integrate this platform with Slack and Microsoft Teams', category: 'general', priority: 'normal' },
  { text: 'thank you for the quick and great customer support', category: 'general', priority: 'low' },
  { text: 'do you have a public product roadmap or feature request board', category: 'general', priority: 'low' },
  { text: 'feature request: please add support for dark mode theme', category: 'general', priority: 'low' },
  { text: 'what is your average response time for support tickets', category: 'general', priority: 'low' },
  { text: 'is your service SOC2 and HIPAA compliant', category: 'general', priority: 'normal' },
  { text: 'are you planning to support multi-language localizations', category: 'general', priority: 'low' },
  { text: 'where are your cloud data centers physically located', category: 'general', priority: 'low' },
  { text: 'looking for partnership and affiliate program opportunities', category: 'general', priority: 'normal' },
  { text: 'how does your system compare to other helpdesk alternatives', category: 'general', priority: 'low' },
  { text: 'is there a free trial period for the business plan', category: 'general', priority: 'low' },
  { text: 'great work on the recent UI redesign update', category: 'general', priority: 'low' },
  { text: 'can we schedule a 1-on-1 product demo for our management team', category: 'general', priority: 'normal' },
  { text: 'where can I view your privacy policy and terms of service', category: 'general', priority: 'low' },
  { text: 'do you offer on-premise self-hosted enterprise deployment', category: 'general', priority: 'normal' },
  { text: 'how many team seats are included in the standard license', category: 'general', priority: 'low' },
  { text: 'feedback regarding the new ticket dashboard navigation', category: 'general', priority: 'low' },
  { text: 'what browsers and versions do you officially support', category: 'general', priority: 'low' },
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
