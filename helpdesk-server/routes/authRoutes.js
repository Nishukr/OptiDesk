// routes/authRoutes.js — STAFF sign-in, on the original custom JWT.
//
// Customers never touch this router: Clerk owns their sign-up, sign-in, session
// and email verification (see middleware/clerkAuth.js). Everything here — bcrypt
// password hashes, JWT_SECRET tokens, the Resend verification email — exists for
// agents and admins, and is deliberately unchanged.
const router = require('express').Router();
const {
  register,
  login,
  me,
  verifyEmail,
  verifyEmailLegacy,
  resendVerification,
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/register', register); // admin only, gated by ADMIN_SIGNUP_CODE
router.post('/login', login);
router.get('/verify-email', verifyEmail); // called by the client page in the emailed link
router.get('/verify', verifyEmailLegacy); // older links hit the API directly — forward them
router.post('/resend', resendVerification);
router.get('/me', auth, me);

module.exports = router;
