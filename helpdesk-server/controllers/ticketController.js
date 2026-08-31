// controllers/ticketController.js
const Ticket = require('../models/Ticket');
// Auto-triage: fills category / priority / sentiment from the ticket text.
const { triage } = require('../services/triage');

// Every ticket stores only the customer's _id in `user`. Populating it swaps that
// id for { name, email } so staff can see WHO raised the ticket instead of an id.
const CUSTOMER_FIELDS = 'name email role';

const isStaff = (u) => u.role === 'agent' || u.role === 'admin';

// escape user input before building a RegExp for the search box
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.createTicket = async (req, res, next) => {
  try {
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'subject and body required' });

    // Classify category/priority and score sentiment from the customer's own words.
    const { category, priority, sentimentScore } = triage(`${subject} ${body}`);
    const ticket = await Ticket.create({ user: req.user.id, subject, body, category, priority, sentimentScore });

    // Attach the customer before broadcasting, otherwise the row that appears
    // live on the admin board would have a blank "Customer" column.
    await ticket.populate('user', CUSTOMER_FIELDS);

    req.app.get('io')?.to('admins').emit('ticket:new', ticket); // live board update
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
};

exports.listTickets = async (req, res, next) => {
  try {
    const { status, priority, category, customer, q } = req.query;

    // A customer only ever sees their own tickets; staff see every ticket.
    const filter = isStaff(req.user) ? {} : { user: req.user.id };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (customer && isStaff(req.user)) filter.user = customer; // drill into one customer
    if (q) {
      const rx = new RegExp(escapeRx(q), 'i');
      filter.$or = [{ subject: rx }, { body: rx }];
    }

    const tickets = await Ticket.find(filter)
      .populate('user', CUSTOMER_FIELDS)
      .populate('assignedTo', CUSTOMER_FIELDS)
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};

exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user', CUSTOMER_FIELDS)
      .populate('assignedTo', CUSTOMER_FIELDS);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Staff can open anything; a customer can only open their own ticket.
    if (!isStaff(req.user) && String(ticket.user?._id) !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

exports.updateTicket = async (req, res, next) => {
  try {
    const { status, assignedTo, priority } = req.body;
    const update = {};
    if (status) update.status = status;
    if (assignedTo) update.assignedTo = assignedTo;
    if (priority) update.priority = priority;

    // Re-populate on the way out so the updated row keeps its customer details.
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    })
      .populate('user', CUSTOMER_FIELDS)
      .populate('assignedTo', CUSTOMER_FIELDS);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    req.app.get('io')?.to('admins').emit('ticket:updated', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};
