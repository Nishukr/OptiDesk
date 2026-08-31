// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'agent', 'admin'], default: 'customer' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
