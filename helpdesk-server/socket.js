// socket.js — Socket.io setup for real-time chat + live ticket board
//
// Rooms carry whole ticket payloads (subject, body, the customer's name and
// email, and the agent's resolutionMessage), so joining a room IS reading
// customer data. Both joins below are therefore authorised the same way the
// REST controllers authorise GET /api/tickets/:id — staff see everything, a
// customer sees only the tickets they raised.
//
// The handshake accepts EITHER credential, for the same reason app.js mounts two
// auth systems: staff hold a JWT_SECRET-signed token, customers hold a Clerk
// session token. A single socket connection is all the client has, so it cannot
// route by URL the way the REST API does — it has to try both.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { allowedOrigins } = require('./app');
const Ticket = require('./models/Ticket');
const { resolveCustomer, isClerkConfigured } = require('./middleware/clerkAuth');

const isStaff = (u) => u && (u.role === 'agent' || u.role === 'admin');

// Staff credential: the same token middleware/auth.js accepts, checked the same
// way (including the `purpose` claim rule, so an email-verification link can
// never open a socket). Returns null for anything that is not a staff JWT —
// including a Clerk token, which is signed by a key this secret cannot verify.
function staffFromJwt(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose) return null;
    return payload; // { id, role }
  } catch {
    return null;
  }
}

// Customer credential: a Clerk session token. `verifyToken` checks the signature
// against Clerk's JWKS, then the Clerk user id is mapped to the local mirror
// row, because every room check below compares against Ticket.user — a Mongo
// ObjectId. Passing the Clerk string id straight through would never match.
async function customerFromClerk(token) {
  if (!isClerkConfigured()) return null;
  try {
    const { verifyToken } = require('@clerk/express');
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkId = payload?.sub;
    if (!clerkId) return null;
    const customer = await resolveCustomer(clerkId);
    if (!customer) return null;
    return { id: String(customer._id), role: 'customer', clerkId };
  } catch {
    return null;
  }
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    // Same origin rules as the REST API, so a tunnelled or deployed frontend
    // gets live updates instead of silently failing to connect.
    cors: { origin: allowedOrigins.length ? allowedOrigins : '*' },
  });

  // Handshake gate. The client sends whichever token it holds as `auth.token`; an
  // unauthenticated socket is refused outright rather than being allowed to
  // connect and then blocked per-event, because CORS alone does not stop a
  // script from opening a socket to this port.
  //
  // Staff is tried first because it is a local signature check with no network
  // call; the Clerk path is only reached for tokens JWT_SECRET cannot verify.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const user = staffFromJwt(token) || (await customerFromClerk(token));
      if (!user) return next(new Error('unauthorized'));
      socket.user = user; // { id, role }
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Staff-only. Previously any caller could join and then receive every
    // ticket:new / ticket:updated / ticket:deleted event for every customer.
    socket.on('join:admins', () => {
      if (isStaff(socket.user)) socket.join('admins');
    });

    // Per-ticket chat room, restricted to the customer who raised the ticket
    // (plus staff). This is what keeps a resolution message addressed to one
    // customer from reaching anybody else's browser.
    socket.on('join:ticket', async (id) => {
      try {
        const ticket = await Ticket.findById(id).select('user');
        if (!ticket) return;
        if (isStaff(socket.user) || String(ticket.user) === socket.user.id)
          socket.join(`ticket:${id}`);
      } catch {
        /* malformed id — just don't join */
      }
    });
  });

  return io;
}

module.exports = { initSocket };
