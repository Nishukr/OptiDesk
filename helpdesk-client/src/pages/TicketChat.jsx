// src/pages/TicketChat.jsx — ticket detail + AI assistant chat (RAG via POST /api/chat)
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

export default function TicketChat() {
  const { id } = useParams();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load any earlier messages for this ticket so a refresh doesn't lose the chat.
  useEffect(() => {
    let alive = true;
    api
      .get(`/chat/${id}/history`)
      .then((res) => alive && setMessages(res.data.map((m) => ({ sender: m.sender, text: m.text, citations: m.citations }))))
      .catch(() => {}); // no history yet is fine
    return () => {
      alive = false;
    };
  }, [id]);

  const ask = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setMessages((m) => [...m, { sender: 'customer', text: q }]);
    setQuestion('');
    setBusy(true);
    try {
      const res = await api.post('/chat', { question: q, ticketId: id });
      setMessages((m) => [
        ...m,
        { sender: 'ai', text: res.data.text, citations: res.data.citations || [] },
      ]);
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

  return (
    <div className="container narrow">
      <div className="card">
        <h2>AI Support Assistant</h2>
        <p className="muted">Ask a question about your issue. Answers are grounded in our knowledge base.</p>

        <div className="chat">
          {messages.length === 0 && (
            <p className="muted center">Start the conversation below 👇</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble-${m.sender}`}>
              <div className="bubble-text">{m.text}</div>
              {m.citations && m.citations.length > 0 && (
                <div className="citations">
                  {m.citations.map((c, j) => (
                    <span key={j} className="cite">[{j + 1}] {c.source}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={ask} className="chat-input">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question…"
            disabled={busy}
          />
          <button className="btn" disabled={busy}>{busy ? '…' : 'Send'}</button>
        </form>
      </div>
    </div>
  );
}
