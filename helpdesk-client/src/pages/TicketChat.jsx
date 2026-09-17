// src/pages/TicketChat.jsx — one ticket: the AI assistant chat, the agent's
// replies, and the "Is your problem solved?" confirmation step.
//
// The confirmation is the hinge of the new lifecycle: an admin cannot delete this
// ticket until the customer presses "Yes, it's solved" here.
//
// Customer-facing only. Staff read the same thread at /admin/tickets/:id, and
// GET /api/tickets/:id now requires a Clerk session, so a staff JWT cannot reach
// this page at all.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useCustomer } from '../context/CustomerContext';
import { fmtDate, statusLabel } from '../utils/format';

const SENDER_LABEL = { customer: 'You', agent: 'Support agent', ai: 'AI assistant' };

export default function TicketChat() {
  const { id } = useParams();
  // Ownership is expressed as a Mongo _id (Ticket.user), which the Clerk session
  // does not carry — GET /api/me supplies it. Comparing against the Clerk user id
  // would never match and would hide the confirm buttons from their owner.
  const { profile, ready: profileReady, error: profileError } = useCustomer();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const loadTicket = useCallback(async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicket(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load this ticket');
    }
  }, [id]);

  // Load the ticket and any earlier messages so a refresh doesn't lose the thread.
  useEffect(() => {
    loadTicket();
    api
      .get(`/chat/${id}/history`)
      .then((res) =>
        setMessages(res.data.map((m) => ({ sender: m.sender, text: m.text, citations: m.citations })))
      )
      .catch(() => {}); // no history yet is fine
  }, [id, loadTicket]);

  const ask = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setMessages((m) => [...m, { sender: 'customer', text: q }]);
    setQuestion('');
    setBusy(true);
    try {
      const res = await api.post('/chat', { question: q, ticketId: id });
      setMessages((m) => [...m, { sender: 'ai', text: res.data.text, citations: res.data.citations || [] }]);
    } catch (err) {
      const status = err.response?.status;
      const text =
        status === 503
          ? 'The AI assistant is not configured yet: the server needs a valid GEMINI_API_KEY. A human agent will follow up on your ticket in the meantime.'
          : status === 404
            ? 'The AI assistant endpoint (/api/chat) is not available.'
            : err.response?.data?.error || 'Something went wrong.';
      setMessages((m) => [...m, { sender: 'ai', text }]);
    } finally {
      setBusy(false);
    }
  };

  // Step 2 of the lifecycle: answer "Is your problem solved?".
  // Yes closes the ticket and unlocks deletion for the admin. No reopens it.
  const respond = async (solved) => {
    setConfirming(true);
    setError('');
    try {
      const res = await api.post(`/tickets/${id}/confirm`, { solved });
      setTicket(res.data);
      setMessages((m) => [
        ...m,
        { sender: 'customer', text: solved ? 'Yes — my problem is solved. Thank you!' : 'No — my problem is still not solved.' },
      ]);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send your answer');
    } finally {
      setConfirming(false);
    }
  };

  if (error && !ticket)
    return <div className="container narrow"><div className="card"><div className="alert">{error}</div></div></div>;
  if (!ticket) return <div className="container narrow"><p className="muted">Loading…</p></div>;

  // The confirmation step belongs to exactly one person: whoever raised the ticket.
  // `profileReady` gates it because until /api/me answers, `profile` is null and a
  // bare `profile?.id === ownerId` would read as "not the owner" and hide the
  // buttons from the only person who can press them.
  const ownerId = String(ticket.user?._id || ticket.user || '');
  const isOwner = profileReady && Boolean(profile?.id) && ownerId === String(profile.id);

  const awaiting = ticket.awaitingConfirmation && isOwner;
  const confirmed = Boolean(ticket.confirmedByCustomerAt);

  return (
    <div className="container narrow">
      <p className="crumb"><Link to="/">← All my tickets</Link></p>

      {error && <div className="alert">{error}</div>}

      {/* Without the local record there is no way to tell whose ticket this is, so
          the confirmation step cannot be offered. Say why rather than silently
          omitting the only action on the page. */}
      {profileError && ticket.awaitingConfirmation && (
        <div className="alert">{profileError} Reload the page to try again.</div>
      )}

      {awaiting && (
        <section className="resolve-ask">
          <h3><span aria-hidden="true">🛠️</span> Is your problem solved?</h3>
          <p className="muted small">
            Support answered your ticket {fmtDate(ticket.resolutionRequestedAt)}. Let them know whether
            it worked — the ticket stays open until you answer.
          </p>
          {ticket.resolutionMessage && <div className="quote">{ticket.resolutionMessage}</div>}
          <div className="resolve-actions">
            <button className="btn" onClick={() => respond(true)} disabled={confirming}>
              {confirming ? 'Sending…' : '✓ Yes, it is solved'}
            </button>
            <button className="btn-ghost" onClick={() => respond(false)} disabled={confirming}>
              ✕ No, still not fixed
            </button>
          </div>
        </section>
      )}

      {confirmed && (
        <div className="solved-banner">
          <span aria-hidden="true">✅</span>
          <span>
            You confirmed this was solved on {fmtDate(ticket.confirmedByCustomerAt)}. The ticket is
            closed.
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>{ticket.subject}</h2>
          <span className={`chip chip-${ticket.status}`}>{statusLabel(ticket.status)}</span>
        </div>
        <p className="muted small">Raised {fmtDate(ticket.createdAt)}</p>
        <p className="ticket-body">{ticket.body}</p>
        <div className="kv">
          <span>Category</span><b>{ticket.category}</b>
          <span>Priority</span><b><span className={`pill pill-${ticket.priority}`}>{ticket.priority}</span></b>
          <span>Handled by</span><b>{ticket.assignedTo?.name || ticket.assignedTo?.email || 'Not assigned yet'}</b>
        </div>
      </div>

      <div className="card">
        <h2>AI Support Assistant</h2>
        <p className="muted small">
          Ask anything about your issue. Answers are grounded in our knowledge base and cite their source.
        </p>

        <div className="chat">
          {messages.length === 0 && !busy && (
            <p className="muted center">Start the conversation below 👇</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble-${m.sender}`}>
              {m.sender !== 'customer' && (
                <span className="bubble-who">{SENDER_LABEL[m.sender] || m.sender}</span>
              )}
              <div className="bubble-text">{m.text}</div>
              {m.citations?.length > 0 && (
                <div className="citations">
                  {m.citations.map((c, j) => (
                    <span key={j} className="cite">[{j + 1}] {c.source}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="bubble bubble-ai">
              <span className="bubble-who">AI assistant</span>
              <span className="typing" aria-label="Thinking"><i /><i /><i /></span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={ask} className="chat-input">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question…"
            disabled={busy}
            aria-label="Your question"
          />
          <button className="btn" disabled={busy}>{busy ? '…' : 'Send'}</button>
        </form>
      </div>
    </div>
  );
}
