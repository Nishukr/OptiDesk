// controllers/chatController.js — the AI support assistant behind POST /api/chat.
// Persists the customer question + AI answer as Messages so the conversation
// survives a page refresh, then returns the answer to the client.
const Ticket = require('../models/Ticket');
const Message = require('../models/Message');
const { answer } = require('../services/rag');

const isStaff = (u) => u.role === 'agent' || u.role === 'admin';

exports.chat = async (req, res, next) => {
  try {
    const { question, ticketId } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });

    // If tied to a ticket, make sure the caller is allowed to see that ticket.
    let ticket = null;
    if (ticketId) {
      ticket = await Ticket.findById(ticketId);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (!isStaff(req.user) && String(ticket.user) !== req.user.id)
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Ask the RAG pipeline. A missing/placeholder API key throws
    // GeminiNotConfigured (status 503) which the error handler passes through.
    const result = await answer(question.trim());

    // Best-effort persistence — never fail the reply if saving hiccups.
    if (ticket) {
      try {
        await Message.create({ ticket: ticket._id, sender: 'customer', text: question.trim() });
        await Message.create({
          ticket: ticket._id,
          sender: 'ai',
          text: result.text,
          citations: result.citations,
        });
      } catch (e) {
        console.warn('chat: could not persist messages:', e.message);
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// GET /api/chat/:ticketId/history — prior messages for a ticket (for page reloads).
exports.history = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isStaff(req.user) && String(ticket.user) !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    const messages = await Message.find({ ticket: ticket._id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    next(err);
  }
};
