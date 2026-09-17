# OptiDesk API (Express + MongoDB)

A runnable Express + MongoDB + JWT starter for **OptiDesk**, the AI customer-support helpdesk (Phases 0–2 of the build guide). The AI phases — ticket triage ML, RAG chat, real-time — are layered on top by following the full build guide.

## Quick start

```bash
npm install
cp .env.example .env      # then edit .env with your values (Windows: copy .env.example .env)
npm run dev
```

Open http://localhost:5000/api/health → you should see `{ "ok": true, "service": "optidesk-api" }`.

## Create the admin account

Customers self-register from the client and always get the `customer` role. Staff accounts
are **not** created from the public form (so nobody can make themselves an admin). Create the
admin once with:

```bash
npm run seed:admin
```

This reads `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (defaults:
`admin@optidesk.local` / `admin123`) and creates — or promotes + resets the password of — that
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
| POST | `/api/auth/register` | — | `{ name, email, password, role?, adminCode? }` → sends a verification email |
| GET | `/api/auth/verify-email?token=` | — | called by the client page the emailed link opens → `{ ok, status, message }` |
| GET | `/api/auth/verify?token=` | — | legacy link shape; 302s to `CLIENT_URL/verify-email?token=…` |
| POST | `/api/auth/resend` | — | `{ email }` → new verification link |
| POST | `/api/auth/login` | — | `{ email, password }` → `{ token }`; **403 until verified** |
| GET | `/api/auth/me` | Bearer | — |
| POST | `/api/tickets` | Bearer | `{ subject, body }` |
| GET | `/api/tickets` | Bearer | — (customers see own; agent/admin see all) |
| GET | `/api/tickets/:id` | Bearer | — (own ticket, or any for staff) |
| PATCH | `/api/tickets/:id` | agent/admin | `{ status?, assignedTo?, priority? }` — status only `open`/`in_progress` |
| POST | `/api/tickets/:id/resolve` | agent/admin | `{ message }` → step 1: propose the fix |
| POST | `/api/tickets/:id/confirm` | customer (owner) | `{ solved, note? }` → step 2: "is it solved?" |
| DELETE | `/api/tickets/:id` | admin | — step 3: **409 unless the customer confirmed** |
| GET | `/api/users/customers` | agent/admin | — (customer directory + ticket counts) |
| GET | `/api/users/:id` | agent/admin | — (one customer + their tickets) |
| POST | `/api/chat` | Bearer | `{ question, ticketId? }` → RAG answer |
| GET | `/api/chat/:ticketId/history` | Bearer | — (past chat messages) |

## Email verification

New accounts start unverified and `POST /api/auth/login` answers **403** until the
person clicks the link that was emailed to them. Mail goes out over **HTTPS via the
[Resend](https://resend.com) API**, not SMTP — one `.env` value switches it on:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

**Why not SMTP/Gmail?** Render — like most PaaS free tiers — blocks outbound ports
25/465/587 to keep spam off its IP ranges, with no setting to open them. A
nodemailer send there hangs and fails with `ETIMEDOUT` no matter how correct the
Gmail app password is, which makes it look like a credentials problem. Resend is a
plain HTTPS POST to port 443, so nothing in the way blocks it.

Two optional values control the sender:

```env
MAIL_FROM=OptiDesk <no-reply@yourdomain.com>   # unset → Resend's sandbox sender
MAIL_REPLY_TO=support@yourdomain.com           # where replies land
MAIL_TIMEOUT_MS=10000                          # abort a stalled send
```

Leave `MAIL_FROM` unset and mail is sent from `onboarding@resend.dev`, which needs
no DNS setup but **only delivers to the address that owns your Resend account** —
fine for a first test, useless for real users. To email anybody else, add your
domain at <https://resend.com/domains>, publish the DNS records it gives you, wait
for *Verified*, then point `MAIL_FROM` at an address on it.

The link points at the **client**, not the API:
`CLIENT_URL/verify-email?token=…`. That page calls
`GET /api/auth/verify-email?token=…`, which answers JSON so the page can render
its own state:

| status | HTTP | meaning |
|---|---|---|
| `success` | 200 | verified just now |
| `already` | 200 | verified earlier |
| `expired` | 410 | older than `EMAIL_VERIFY_TTL` (default 24 hours) |
| `invalid` | 400 | wrong signature, missing, already-used, or superseded token |

Check the setup without registering anybody:

```bash
npm run mail:test you@example.com
```

The API also checks the key at boot and prints `✉️  Verification email: ON/OFF`
with the reason — including whether `MAIL_FROM`'s domain is actually verified,
which is the other thing that makes every send fail while the key itself is fine.

`MAIL_FROM` is only ever the **sender**. Each message goes to the address typed
into the signup form (`to: [user.email]`), and the API logs
`✉️  Verification email sent to <that address>` so you can confirm it.

**No key configured?** Accounts are still created and the verification link is
printed in the API console instead, so local development works with no provider at
all. The link is never returned in the HTTP response — that would defeat the point
of proving the address.

### The link has to be openable by the recipient

`CLIENT_URL` is the base of the emailed link. `http://localhost:5173` means
"this computer" **to whoever opens the email** — so a customer clicking it on
their phone gets nothing. Pick the address that matches who will click:

| Who clicks | `CLIENT_URL` | Also needed |
|---|---|---|
| You, on this PC | `http://localhost:5173` | nothing |
| Your phone / another laptop on the same Wi-Fi | `http://<lan-ip>:5173` | start Vite with `--host` |
| Anyone, anywhere | `https://<tunnel-or-domain>` | a tunnel or a deploy |

For a public URL you need **both** halves reachable, because the verification
page runs in the visitor's browser and calls the API from there:

```env
# helpdesk-server/.env
CLIENT_URL=https://optidesk.example.com
CORS_ORIGINS=http://localhost:5173      # keep local dev working too
```

```env
# helpdesk-client/.env
VITE_API_URL=https://api.optidesk.example.com
```

A throwaway tunnel for testing, one terminal each:

```bash
npx --yes cloudflared tunnel --url http://localhost:5173   # -> CLIENT_URL
npx --yes cloudflared tunnel --url http://localhost:5000   # -> VITE_API_URL
```

Then restart both dev servers so the new values are read. `CORS_ORIGINS` is a
comma-separated allowlist on top of `CLIENT_URL`; leave both unset only for
local work, since unset means "accept any origin".

On boot the API prints `Verification email: ON` or `OFF`, so a missing credential
is obvious. **`.env` is only read at start-up** — `nodemon.json` lists `.env` in
its watch set so editing it restarts the server; with `npm start`, restart by hand
after changing credentials.

- The token is a **JWT** signed by `services/verifyToken.js`, carrying
  `{ sub: <user id>, email, purpose: 'verify-email' }` and its own `exp`. Nothing
  in the URL can be edited without breaking the signature, and the deadline
  travels with the token instead of being looked up.
- It is **not** signed with `JWT_SECRET`. That secret is what
  `middleware/auth.js` trusts for sessions, so a link signed with it would work
  as a 24-hour Bearer token. The verification key is `"<JWT_SECRET>::verify-email"`
  by default — override with `EMAIL_VERIFY_SECRET` if you want to rotate links
  independently. `auth` also rejects any token carrying a `purpose` claim, so the
  two kinds cannot be swapped even by mistake.
- The token is single-use. Its SHA-256 hash is stored on the user (never the
  token itself) and cleared on success, so a second click — or an older link
  after a resend — reports `invalid` rather than silently working again. The
  client guards against React StrictMode's double effect so this never happens on
  a legitimate first click.
- `EMAIL_VERIFY_TTL` sets the lifetime (default `24h`).
- If email is not configured the account is still created and the link is printed
  to the server console, so local development is not blocked.
- Accounts created **before** this feature existed would be locked out, so run the
  one-time backfill: `npm run verify:existing`.
- `npm run seed:admin` marks its admin verified automatically.

## Ticket lifecycle (deletion is gated on the customer)

An admin cannot delete a ticket on a whim. Three steps, enforced server-side:

1. `POST /api/tickets/:id/resolve { message }` — staff send the fix. Status becomes
   `resolved`, the message lands in the customer's thread. **Not deletable yet.**
2. `POST /api/tickets/:id/confirm { solved }` — the customer answers "Is your
   problem solved?". Only the ticket's owner may call this, so staff cannot
   self-confirm. `true` → status `closed` and `confirmedByCustomerAt` is stamped;
   `false` → back to `in_progress` and `reopenedCount` increments.
3. `DELETE /api/tickets/:id` — admin only, and returns **409** unless
   `confirmedByCustomerAt` is set. Deleting also removes the ticket's messages.

`PATCH /api/tickets/:id` deliberately refuses `resolved` and `closed`, so the
handshake cannot be short-circuited. The API exposes `canDelete` and
`awaitingConfirmation` virtuals for the UI.

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
