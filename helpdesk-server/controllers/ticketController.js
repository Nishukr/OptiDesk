// controllers/ticketController.js
const Ticket = require('../models/Ticket');
const Message = require('../models/Message');
// Auto-triage: fills category / priority / sentiment from the ticket text.
const { triage } = require('../services/triage');

// Every ticket stores only the customer's _id in `user`. Populating it swaps that
// id for { name, email } so staff can see WHO raised the ticket instead of an id.
const CUSTOMER_FIELDS = 'name email role';

const isStaff = (u) => u.role === 'agent' || u.role === 'admin';

// escape user input before building a RegExp for the search box
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Statuses staff may set by hand. "resolved" and "closed" are deliberately not
// here: resolving goes through POST /:id/resolve so the customer gets asked to
// confirm, and only that confirmation can close a ticket.
const MANUAL_STATUSES = ['open', 'in_progress'];

const withPeople = (query) =>
  query.populate('user', CUSTOMER_FIELDS).populate('assignedTo', CUSTOMER_FIELDS);

const emit = (req, event, ticket) => {
  const io = req.app.get('io');
  if (!io) return;
  io.to('admins').emit(event, ticket);
  io.to(`ticket:${ticket._id}`).emit(event, ticket); // the customer's open ticket page
};

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

    emit(req, 'ticket:new', ticket);
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

    const tickets = await withPeople(Ticket.find(filter)).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};

exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await withPeople(Ticket.findById(req.params.id));
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

    if (status) {
      if (!MANUAL_STATUSES.includes(status))
        return res.status(400).json({
          error:
            'Use POST /api/admin/tickets/:id/resolve to propose a fix. Only the customer\'s confirmation can close a ticket.',
        });
      update.status = status;
    }
    if (assignedTo) update.assignedTo = assignedTo;
    if (priority) update.priority = priority;

    // Re-populate on the way out so the updated row keeps its customer details.
    const ticket = await withPeople(
      Ticket.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    emit(req, 'ticket:updated', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/tickets/:id/resolve  { message }  — staff only.
// Step 1 of the handshake: send the customer the fix and ask them to confirm.
// This does NOT close the ticket and does NOT make it deletable.
exports.proposeResolution = async (req, res, next) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message)
      return res.status(400).json({ error: 'Write the customer a message explaining the fix' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.confirmedByCustomerAt)
      return res.status(409).json({ error: 'The customer already confirmed this ticket as solved' });

    ticket.status = 'resolved';
    ticket.resolutionRequestedAt = new Date();
    ticket.resolutionMessage = message;
    if (!ticket.assignedTo) ticket.assignedTo = req.user.id; // whoever answered owns it
    await ticket.save();

    // The message shows up in the customer's ticket thread.
    await Message.create({ ticket: ticket._id, sender: 'agent', text: message });

    await ticket.populate([
      { path: 'user', select: CUSTOMER_FIELDS },
      { path: 'assignedTo', select: CUSTOMER_FIELDS },
    ]);
    emit(req, 'ticket:updated', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

// POST /api/tickets/:id/confirm  { solved: true | false }  — the customer only.
// Step 2: "Is your problem solved?". Yes closes the ticket and unlocks deletion;
// No pushes it back to the queue.
exports.confirmResolution = async (req, res, next) => {
  try {
    const { solved, note } = req.body;
    if (typeof solved !== 'boolean')
      return res.status(400).json({ error: 'solved must be true or false' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Only the person who raised the ticket can answer this — not staff,
    // otherwise an admin could confirm on the customer's behalf and delete.
    if (String(ticket.user) !== req.user.id)
      return res.status(403).json({ error: 'Only the customer who raised this ticket can confirm it' });

    if (!ticket.resolutionRequestedAt)
      return res.status(409).json({ error: 'Support has not proposed a solution for this ticket yet' });

    if (solved) {
      ticket.confirmedByCustomerAt = new Date();
      ticket.status = 'closed';
      await Message.create({
        ticket: ticket._id,
        sender: 'customer',
        text: note?.trim() || 'Yes — my problem is solved. Thank you!',
      });
    } else {
      ticket.resolutionRequestedAt = undefined;
      ticket.resolutionMessage = undefined;
      ticket.status = 'in_progress';
      ticket.reopenedCount += 1;
      await Message.create({
        ticket: ticket._id,
        sender: 'customer',
        text: note?.trim() || 'No — my problem is still not solved.',
      });
    }
    await ticket.save();

    await ticket.populate([
      { path: 'user', select: CUSTOMER_FIELDS },
      { path: 'assignedTo', select: CUSTOMER_FIELDS },
    ]);
    emit(req, 'ticket:updated', ticket);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/tickets/:id — admin only.
// Step 3: refuses until confirmByCustomerAt is set, so an admin can never
// delete a ticket the customer has not agreed is finished.
exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (!ticket.confirmedByCustomerAt)
      return res.status(409).json({
        error: ticket.resolutionRequestedAt
          ? 'Waiting for the customer to confirm the problem is solved. You cannot delete it yet.'
          : 'Send the customer a solution first, then wait for them to confirm before deleting.',
        awaitingConfirmation: Boolean(ticket.resolutionRequestedAt),
      });

    await Message.deleteMany({ ticket: ticket._id }); // no orphaned chat rows
    await ticket.deleteOne();

    req.app.get('io')?.to('admins').emit('ticket:deleted', { _id: ticket._id });
    res.json({ deleted: true, _id: ticket._id });
  } catch (err) {
    next(err);
  }
};
