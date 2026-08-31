// models/Message.js — chat messages inside a ticket (human or AI)
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    sender: { type: String, enum: ['customer', 'agent', 'ai'], required: true },
    text: { type: String, required: true },
    citations: [{ source: String, snippet: String }], // for AI (RAG) answers
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
