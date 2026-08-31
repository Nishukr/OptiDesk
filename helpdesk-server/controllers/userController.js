// controllers/userController.js — staff-only views of the people behind the tickets.
// Customers must never reach these routes (see routes/userRoutes.js).
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// GET /api/users/customers — every customer plus a summary of their tickets.
exports.listCustomers = async (req, res, next) => {
  try {
    const customers = await User.find({ role: 'customer' })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // One grouped query for all counts instead of a query per customer.
    const stats = await Ticket.aggregate([
      {
        $group: {
          _id: '$user',
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ['$status', ['open', 'in_progress']] }, 1, 0] } },
          lastTicketAt: { $max: '$createdAt' },
        },
      },
    ]);
    const byUser = new Map(stats.map((s) => [String(s._id), s]));

    res.json(
      customers.map((c) => {
        const s = byUser.get(String(c._id));
        return {
          ...c,
          ticketCount: s?.total || 0,
          openCount: s?.open || 0,
          lastTicketAt: s?.lastTicketAt || null,
        };
      })
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/users/agents — staff list, used by the "assign to" dropdown.
exports.listAgents = async (req, res, next) => {
  try {
    const agents = await User.find({ role: { $in: ['agent', 'admin'] } })
      .select('name email role')
      .sort({ name: 1 });
    res.json(agents);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id — one customer's profile plus their full ticket history.
exports.getCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const tickets = await Ticket.find({ user: user._id }).sort({ createdAt: -1 });
    res.json({ user, tickets });
  } catch (err) {
    next(err);
  }
};
