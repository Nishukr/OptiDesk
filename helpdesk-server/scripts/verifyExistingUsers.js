// scripts/verifyExistingUsers.js — one-time backfill: npm run verify:existing
//
// Email verification was added after these accounts were created. Their
// isVerified flag defaults to false, which would lock every existing user out.
// This marks accounts created before the cut-off as verified. New signups are
// unaffected and still have to click the link in their email.
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  await connectDB();

  const unverified = await User.countDocuments({ isVerified: { $ne: true } });
  if (unverified === 0) {
    console.log('✅ Nothing to do — every account is already verified.');
    process.exit(0);
  }

  const res = await User.updateMany(
    { isVerified: { $ne: true } },
    { $set: { isVerified: true, verifiedAt: new Date() }, $unset: { verifyTokenHash: '', verifyTokenExpires: '' } }
  );

  console.log(`✅ Grandfathered ${res.modifiedCount} existing account(s) as verified.`);
  console.log('   New sign-ups still have to confirm their email address.');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Backfill failed:', err.message);
  process.exit(1);
});
