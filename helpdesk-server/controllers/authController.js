// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Roles a visitor may choose on the public register form.
// "admin" additionally requires the ADMIN_SIGNUP_CODE from the server .env —
// without that gate anyone could sign themselves up and read every customer's
// tickets. Agents are still created by staff (scripts/seedAdmin.js).
const SELF_SERVE_ROLES = ['customer', 'admin'];

// Decide the role for a new signup, or return an error message to send back.
function resolveRole(requested, adminCode) {
  const role = requested || 'customer';
  if (!SELF_SERVE_ROLES.includes(role))
    return { status: 400, error: 'role must be "customer" or "admin"' };
  if (role === 'customer') return { role: 'customer' };

  const expected = process.env.ADMIN_SIGNUP_CODE;
  if (!expected)
    return {
      status: 403,
      error: 'Admin sign-up is turned off. Set ADMIN_SIGNUP_CODE in the server .env (or run "npm run seed:admin").',
    };
  if (adminCode !== expected) return { status: 403, error: 'That admin sign-up code is not correct' };
  return { role: 'admin' };
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role: requestedRole, adminCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const decided = resolveRole(requestedRole, adminCode);
    if (decided.error) return res.status(decided.status).json({ error: decided.error });

    if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already used' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: decided.role });
    res.status(201).json({ id: user._id, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.json(user);
  } catch (err) {
    next(err);
  }
};
