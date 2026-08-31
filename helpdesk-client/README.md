# AI Helpdesk — Frontend (React + Vite)

The customer/agent web app for the AI Customer-Support Helpdesk. It talks to the
`helpdesk-server` Express API for auth, tickets, live updates, and (Phase 5) the
RAG chat endpoint.

Built with **React 18 + Vite**, **react-router-dom v6**, **axios** (with a JWT
interceptor), **socket.io-client** (live admin board), and plain CSS — no Tailwind,
no build-config surprises.

---

## 1. Prerequisites

- **Node.js 18+** (check with `node -v`)
- The **backend running** — see `helpdesk-server/README.md`. By default it listens
  on `http://localhost:5000`.

---

## 2. Setup

```bash
cd helpdesk-client
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

`.env` holds one variable:

```
VITE_API_URL=http://localhost:5000
```

That is the **base URL of your backend** (no `/api` — the axios layer adds it).
In production you'll point this at your deployed API (e.g. your Render URL).

> Vite only exposes variables that start with `VITE_` to the browser, and it reads
> `.env` **at startup** — if you change it, restart `npm run dev`.

---

## 3. Run it

```bash
npm run dev      # starts Vite on http://localhost:5173
```

Open http://localhost:5173. You'll want **both** processes running at once —
two terminals:

| Terminal | Folder            | Command       | URL                     |
|----------|-------------------|---------------|-------------------------|
| 1 — API  | `helpdesk-server` | `npm run dev` | http://localhost:5000   |
| 2 — Web  | `helpdesk-client` | `npm run dev` | http://localhost:5173   |

Then: **Register** an account → you land on **My Tickets** → raise a ticket.
To see the live agent board at `/admin`, promote your user to `agent`/`admin`
(see §6).

Other scripts: `npm run build` (production bundle → `dist/`), `npm run preview`
(serve the built bundle locally).

---

## 4. How the frontend connects to the backend

This is the part interviewers love to hear you explain. Four wires connect the two apps:

### a) One axios instance = one place that knows the API URL
`src/api/axios.js` creates a single axios client whose `baseURL` is
`VITE_API_URL + '/api'`. Every page imports this `api` object, so a call like
`api.get('/tickets')` becomes `GET http://localhost:5000/api/tickets`. Change the
env var once and the whole app repoints.

### b) The JWT travels automatically (request interceptor)
On login the server returns a **JWT**, which we store in `localStorage`. A request
interceptor reads that token and adds `Authorization: Bearer <token>` to **every**
outgoing request — so you never wire auth headers by hand on individual calls. A
response interceptor watches for `401 Unauthorized` and clears the dead token.

```
Login form ─▶ POST /api/auth/login ─▶ { token, user }
                                         │
                        localStorage.setItem('token', …)
                                         │
   every later request ─▶ interceptor adds  Authorization: Bearer <token>
```

### c) Auth state lives in React Context
`src/context/AuthContext.jsx` holds the current `user` and exposes
`login / register / logout`. On page load, if a token exists it calls
`GET /api/auth/me` to rehydrate the user (so a refresh keeps you logged in).
`ProtectedRoute` reads this context to guard pages and enforce roles
(`/admin` requires `agent` or `admin`).

### d) Live updates over Socket.io
`AdminDashboard.jsx` opens a websocket to `VITE_API_URL`, emits `join:admins`, and
listens for `ticket:new`. When a customer creates a ticket, the server pushes it to
the admins room and the board prepends it — no refresh needed.

### The request/response contract (must match the server)

| Frontend call | Method & path | Sends | Gets back |
|---|---|---|---|
| Register | `POST /api/auth/register` | `{ name, email, password }` | `{ token?, user }` → app auto-logs-in |
| Login | `POST /api/auth/login` | `{ email, password }` | `{ token, user }` |
| Current user | `GET /api/auth/me` | *(Bearer token)* | `user` |
| List tickets | `GET /api/tickets` | *(Bearer)* | `Ticket[]` (customer: own; staff: all) |
| Create ticket | `POST /api/tickets` | `{ subject, body }` | new `Ticket` |
| Update ticket | `PATCH /api/tickets/:id` | `{ status? }` *(agent/admin)* | updated `Ticket` |
| AI chat *(Phase 5)* | `POST /api/chat` | `{ question, ticketId }` | `{ text, citations[] }` |

> The chat page is wired but **degrades gracefully**: until you add `/api/chat` in
> Phase 5 of the build guide, it shows a friendly "not enabled yet" message instead
> of erroring.

### CORS (the #1 gotcha)
The browser blocks cross-origin calls unless the server allows them. The backend
already sets `cors({ origin: CLIENT_URL })`. Make sure the server's `.env` has:

```
CLIENT_URL=http://localhost:5173
```

If you see a **CORS error** in the console, this mismatch is almost always why.

---

## 5. Project structure

```
helpdesk-client/
├─ index.html              # Vite entry, mounts #root
├─ vite.config.js          # React plugin, dev server on :5173
├─ .env.example            # VITE_API_URL
└─ src/
   ├─ main.jsx             # BrowserRouter > AuthProvider > App
   ├─ App.jsx              # routes
   ├─ index.css            # all styling (light theme, indigo accent)
   ├─ api/axios.js         # axios instance + JWT interceptors  ← the connection layer
   ├─ context/AuthContext.jsx  # user state, login/register/logout
   ├─ components/
   │  ├─ Navbar.jsx
   │  └─ ProtectedRoute.jsx    # auth + role gate
   └─ pages/
      ├─ Login.jsx
      ├─ Register.jsx
      ├─ Tickets.jsx           # customer: create + list
      ├─ TicketChat.jsx        # AI assistant chat (Phase 5)
      └─ AdminDashboard.jsx    # staff: live board, sort by priority
```

---

## 6. Make yourself an agent/admin

New users are created as `customer`. To reach `/admin`, promote your account
directly in the database, then log out and back in (so a fresh JWT/user loads):

**MongoDB shell / Compass:**
```js
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

**Atlas UI:** Browse Collections → `users` → edit your document → set `role` to `admin`.

---

## 7. Deploy (free tier)

- **Frontend → Vercel:** import the repo, set **root** to `helpdesk-client`,
  framework **Vite**, and add env var `VITE_API_URL` = your deployed API URL.
  Build command `npm run build`, output `dist`.
- **Backend → Render:** deploy `helpdesk-server`, set its `CLIENT_URL` to your
  Vercel domain (otherwise CORS blocks the live site).
- Render's free tier **spins down after ~15 min idle**, so the first request after
  a nap can take ~30–60s. Mention this in your demo so it doesn't look like a bug.

---

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| **CORS error** in console | Server `CLIENT_URL` ≠ your frontend origin. Set it to `http://localhost:5173` (or your Vercel URL) and restart the server. |
| **401 on every call** | Not logged in, or token expired — the interceptor auto-clears it; just log in again. |
| **Network error / calls fail** | Backend not running, or `VITE_API_URL` wrong. Confirm `http://localhost:5000/api/health` returns `{ok:true}`. |
| **`/admin` bounces to home** | Your user isn't `agent`/`admin`. See §6, then re-login. |
| **Env change ignored** | Restart `npm run dev` — Vite reads `.env` only at startup. |
| **Live board not updating** | Socket blocked or API URL wrong. It falls back to polling; a manual refresh still shows new tickets. |

---

## 9. Verification note

This scaffold was structure-checked with a script that confirms **every relative
import resolves to a real file, every referenced export exists, and all brackets
balance across all 11 source files** — the errors that typically white-screen a
Vite app. A full `npm run build` should be run on your machine (the sandbox that
generated this couldn't reach the npm registry). If `npm install && npm run dev`
starts cleanly, you're good.
