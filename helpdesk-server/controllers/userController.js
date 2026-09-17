// controllers/userController.js — staff-only views of the people behind the tickets,
// plus the signed-in customer's own profile.
// Customers must never reach the staff views (see routes/adminRoutes.js).
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// GET /api/me — the Clerk-authenticated customer's local record.
//
// The client needs the Mongo _id, not the Clerk id: ticket ownership is compared
// against Ticket.user, so the UI cannot tell "is this my ticket?" from the Clerk
// session alone. requireCustomer has already resolved and attached the document.
exports.myProfile = (req, res) => {
  const u = req.customer;
  res.json({
    _id: u._id,
    id: String(u._id),
    clerkId: u.clerkId,
    name: u.name,
    email: u.email,
    role: u.role,
    isVerified: u.isVerified,
    createdAt: u.createdAt,
  });
};

// GET /api/admin/customers — every customer plus a summary of their tickets.
exports.listCustomers = async (req, res, next) => {
  try {
    const customers = await User.find({ role: 'customer', deletedAt: { $exists: false } })
      .select('name email createdAt clerkId')
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

// GET /api/admin/agents — staff list, used by the "assign to" dropdown.
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

// GET /api/admin/customers/:id — one customer's profile plus their full ticket history.
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
