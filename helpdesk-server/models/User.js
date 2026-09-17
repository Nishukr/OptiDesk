// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },

    // Staff only. Customers are authenticated by Clerk and never have a password
    // here, so this cannot be `required` any more — middleware/auth.js and
    // authController.login treat its absence as "this account signs in elsewhere"
    // rather than as a broken record.
    passwordHash: { type: String },
    role: { type: String, enum: ['customer', 'agent', 'admin'], default: 'customer' },

    // ---- Clerk identity (customers) ----
    // The Clerk user id ("user_2ab…") this document mirrors. Written by the
    // /api/webhooks/clerk handler and by the lazy resolver in
    // middleware/clerkAuth.js, and it is what a Clerk session token is looked up
    // by on every customer request.
    //
    // `sparse` is what makes one index serve both kinds of account: staff rows
    // have no clerkId at all, and a plain unique index would treat every one of
    // their `null` values as a duplicate of the first.
    clerkId: { type: String, unique: true, sparse: true, index: true },

    // Set when Clerk reports user.deleted. A soft delete, because tickets and
    // messages reference this row — a hard delete would leave the admin board
    // with orphaned "unknown customer" rows and break populate().
    deletedAt: Date,

    // ---- email verification ----
    // Login is refused until isVerified is true. The emailed value is a signed
    // JWT (services/verifyToken.js) that carries the user id and its own expiry,
    // so nothing has to be looked up to know whether it is genuine.
    //
    // verifyTokenHash is the sha256 of the token *currently* in play. A JWT is
    // stateless and therefore replayable until it expires; storing this
    // fingerprint — and clearing it on success — makes each link single-use and
    // makes a resend invalidate the previous one. It is a hash, not the token,
    // so a leaked database dump cannot be used to verify somebody's account.
    // verifyTokenExpires mirrors the JWT's `exp` for readability in the shell;
    // the JWT's own claim is what actually enforces the deadline.
    isVerified: { type: Boolean, default: false },
    verifyTokenHash: { type: String, select: false },
    verifyTokenExpires: { type: Date, select: false },
    verifiedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
