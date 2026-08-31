# Helpdesk API — Starter Scaffold

A runnable Express + MongoDB + JWT starter for the **AI Customer-Support Helpdesk** project (Phases 0–2 of the build guide). The AI phases — ticket triage ML, RAG chat, real-time — are layered on top by following the full build guide.

## Quick start

```bash
npm install
cp .env.example .env      # then edit .env with your values (Windows: copy .env.example .env)
npm run dev
```

Open http://localhost:5000/api/health → you should see `{ "ok": true, "service": "helpdesk-api" }`.

## Create the admin account

Customers self-register from the client and always get the `customer` role. Staff accounts
are **not** created from the public form (so nobody can make themselves an admin). Create the
admin once with:

```bash
npm run seed:admin
```

This reads `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (defaults:
`admin@helpdesk.local` / `admin123`) and creates — or promotes + resets the password of — that
user as an `admin`. Log in with those credentials on the client: you'll land on the **Dashboard**,
where every ticket a customer raises shows up (live, via Socket.io). Re-run any time to reset the
password. **Change `ADMIN_PASSWORD` before deploying anywhere public.**

## Environment variables

See `.env.example`. You need a MongoDB Atlas connection string, a JWT secret (any long random string), and a Google Gemini API key.

## Optional — train the ticket classifier (build-guide Phase 3)

```bash
npm run train
```

This creates `ml/category.json` and `ml/priority.json` from the seed data in `ml/train.js`. Then follow the build guide to add `services/triage.js` and uncomment the triage lines in `controllers/ticketController.js`.

## Endpoints included

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/health` | — | — |
| POST | `/api/auth/register` | — | `{ name, email, password }` |
| POST | `/api/auth/login` | — | `{ email, password }` → `{ token }` |
| GET | `/api/auth/me` | Bearer | — |
| POST | `/api/tickets` | Bearer | `{ subject, body }` |
| GET | `/api/tickets` | Bearer | — (customers see own; agent/admin see all) |
| GET | `/api/tickets/:id` | Bearer | — (own ticket, or any for staff) |
| PATCH | `/api/tickets/:id` | agent/admin | `{ status?, assignedTo?, priority? }` |
| GET | `/api/users/customers` | agent/admin | — (customer directory + ticket counts) |
| GET | `/api/users/:id` | agent/admin | — (one customer + their tickets) |
| POST | `/api/chat` | Bearer | `{ question, ticketId? }` → RAG answer |
| GET | `/api/chat/:ticketId/history` | Bearer | — (past chat messages) |

## Turning on the AI features

The AI has two independent parts:

**1. Ticket triage (works offline — no API key needed).** Auto-fills each new
ticket's category, priority and sentiment using the Bayes classifiers plus the
`sentiment` library. Just train once:

```bash
npm run train
```

This is already wired into `POST /api/tickets`. Add more examples to `ml/train.js`
(20–30+ per label) and re-run `npm run train` to improve accuracy.

**2. RAG chat assistant (needs a real Gemini key).** Answers customer questions
from your knowledge base and cites sources.

```bash
# 1. Put a real key in .env:  GEMINI_API_KEY=AIza...   (https://aistudio.google.com/apikey)
# 2. Drop .md/.txt/.pdf docs into  helpdesk-server/knowledge/  (a sample is included)
npm run ingest   # embeds the docs into MongoDB
```

Without a valid `GEMINI_API_KEY`, `POST /api/chat` returns HTTP 503 with a clear
message and the client shows "AI assistant is not configured yet" — nothing crashes.

## What's next

Follow the build guide for Phase 3 (triage ML) → Phase 4 (knowledge ingestion) → Phase 5 (RAG chat) → Phase 6 (Socket.io) → Phase 7 (React client) → Phase 8 (deploy).
