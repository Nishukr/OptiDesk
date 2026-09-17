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

    // ---- resolution handshake (staff propose → customer confirms → delete allowed) ----
    // Staff sent a solution and asked "is your problem solved?"
    resolutionRequestedAt: Date,
    resolutionMessage: String,
    // The customer pressed "Yes, it's solved". Only then may an admin delete.
    confirmedByCustomerAt: Date,
    // The customer pressed "No, still broken" — kept for reporting.
    reopenedCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Single source of truth for the front-end. A ticket is only removable once the
// customer has confirmed the fix — the API enforces the same rule on DELETE.
ticketSchema.virtual('canDelete').get(function () {
  return Boolean(this.confirmedByCustomerAt);
});

// True while the customer still has to answer "is your problem solved?".
ticketSchema.virtual('awaitingConfirmation').get(function () {
  return Boolean(this.resolutionRequestedAt) && !this.confirmedByCustomerAt;
});

module.exports = mongoose.model('Ticket', ticketSchema);
