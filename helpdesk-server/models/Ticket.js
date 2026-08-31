// models/Ticket.js
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    // ---- filled in by your custom ML (build-guide Phase 3) ----
    category: { type: String, enum: ['billing', 'technical', 'account', 'general'], default: 'general' },
    priority: { type: String, enum: ['urgent', 'high', 'normal', 'low'], default: 'normal' },
    sentimentScore: { type: Number, default: 0 }, // negative = unhappy customer
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ticket', ticketSchema);
