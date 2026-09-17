// scripts/seedAdmin.js — create (or update) the admin login. Run once: npm run seed:admin
// Use this when you don't want admin self-registration enabled at all. Otherwise the
// public register form can create an admin too, but only for someone who knows
// ADMIN_SIGNUP_CODE from .env (see controllers/authController.js).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

// Credentials come from .env if set, otherwise these safe local defaults.
const NAME = process.env.ADMIN_NAME || 'Support Admin';
const EMAIL = (process.env.ADMIN_EMAIL || 'admin@optidesk.local').toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function seedAdmin() {
  await connectDB();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Upsert: if this email already exists, promote it to admin and reset the password;
  // otherwise create a fresh admin. Safe to run more than once.
  // isVerified is forced on: this account is created by you, so there is no
  // inbox to check and it must be able to log in immediately.
  const admin = await User.findOneAndUpdate(
    { email: EMAIL },
    {
      name: NAME,
      email: EMAIL,
      passwordHash,
      role: 'admin',
      isVerified: true,
      verifiedAt: new Date(),
      $unset: { verifyTokenHash: '', verifyTokenExpires: '' },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log('✅ Admin account ready:');
  console.log(`   email:    ${admin.email}`);
  console.log(`   password: ${PASSWORD}`);
  console.log(`   role:     ${admin.role}`);
  console.log('\n👉 Log in with these on the client, then open the Dashboard to see incoming tickets.');
  console.log('⚠️  Change ADMIN_PASSWORD in .env before deploying anywhere public.');

  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('❌ Failed to seed admin:', err.message);
  process.exit(1);
});
