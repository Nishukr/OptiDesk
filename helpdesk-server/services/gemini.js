// services/gemini.js — thin wrapper around Google Gemini for embeddings + chat.
// Centralises the API key check so every AI feature gives the SAME clear error
// when the key is missing or still the placeholder from .env.example.
const { GoogleGenerativeAI } = require('@google/generative-ai');

const EMBED_MODEL = 'gemini-embedding-001'; // current embedding model
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.6-flash';

// Google issues API keys in more than one format: older ones start with "AIza",
// newer ones start with "AQ.". So we can't check a prefix — instead we just
// reject an empty value or the literal placeholder from .env.example.
function keyLooksReal(k) {
  if (typeof k !== 'string') return false;
  const v = k.trim();
  if (v.length < 20) return false;
  if (/^(your|paste|xxx+|<|changeme|api[-_]?key)/i.test(v)) return false; // placeholder
  return true;
}

class GeminiNotConfigured extends Error {
  constructor() {
    super(
      'Gemini API key is not configured. Put a real key from ' +
        'https://aistudio.google.com/apikey into GEMINI_API_KEY in helpdesk-server/.env, then restart the server.'
    );
    this.status = 503; // Service Unavailable — the code is fine, the key isn't
    this.code = 'GEMINI_NOT_CONFIGURED';
  }
}

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!keyLooksReal(key)) throw new GeminiNotConfigured();
  return new GoogleGenerativeAI(key);
}

// isConfigured() lets callers show a friendly state without throwing.
const isConfigured = () => keyLooksReal(process.env.GEMINI_API_KEY);

// embed(text) -> number[768]
async function embed(text) {
  const model = client().getGenerativeModel({ model: EMBED_MODEL });
  const res = await model.embedContent(String(text).slice(0, 8000));
  return res.embedding.values;
}

// generate(prompt) -> string
async function generate(prompt) {
  const model = client().getGenerativeModel({ model: CHAT_MODEL });
  const res = await model.generateContent(prompt);
  return res.response.text();
}

module.exports = { embed, generate, isConfigured, GeminiNotConfigured, EMBED_MODEL, CHAT_MODEL };
