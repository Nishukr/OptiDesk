// scripts/testMail.js — prove the Resend setup works without registering a user.
// Run:  npm run mail:test you@example.com
//
// With the sandbox sender (no MAIL_FROM), Resend only delivers to the address
// that owns your Resend account — pass that address.
require('dotenv').config();
const {
  sendVerificationEmail,
  isMailConfigured,
  verifyMailCredentials,
  fromAddress,
  usingTestSender,
} = require('../services/mailer');

const key = String(process.env.RESEND_API_KEY || '').trim();
const to = process.argv[2];

(async () => {
  // Never print the key itself — a prefix and a length are enough to tell
  // "wrong variable" and "truncated paste" apart.
  console.log('RESEND_API_KEY :', key ? `set (${key.slice(0, 6)}…, ${key.length} chars)` : 'MISSING');
  console.log('MAIL_FROM      :', fromAddress() + (usingTestSender() ? '  ← sandbox sender' : ''));
  console.log('CLIENT_URL     :', process.env.CLIENT_URL || 'http://localhost:5173');

  if (!isMailConfigured()) {
    console.error('\n❌ Not configured. Put RESEND_API_KEY=re_… in .env (https://resend.com/api-keys).');
    process.exit(1);
  }
  if (!to) {
    console.error('\n❌ No recipient. Pass one: npm run mail:test you@example.com');
    if (usingTestSender())
      console.error('   MAIL_FROM is unset, so this must be the address that owns your Resend account.');
    process.exit(1);
  }

  const { ok, reason, note } = await verifyMailCredentials();
  if (!ok) {
    console.error(`\n❌ ${reason}`);
    process.exit(1);
  }
  console.log('\n✅ Resend accepted the API key.');
  if (note) console.warn(`   Note: ${note}`);

  try {
    const info = await sendVerificationEmail('OptiDesk test', to, 'THIS_IS_A_TEST_TOKEN');
    console.log(`✅ Sent to ${info.to} — Resend id ${info.id}`);
    console.log('   Check the inbox (and Spam). The link in it is deliberately invalid.');
  } catch (err) {
    console.error(`\n❌ Send failed: ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
})();
