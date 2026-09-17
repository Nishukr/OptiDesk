# Deploying OptiDesk (MongoDB Atlas + Render + Vercel)

A step-by-step, free-tier deployment guide for the OptiDesk AI Customer-Support
Helpdesk. It is written for **this** repo, so the folder names, env vars, build
commands and known gotchas all match your actual code.

## Architecture — three moving parts

| Part | What it is | Where it goes | Free? |
|------|-----------|---------------|-------|
| **Database** | MongoDB (users, tickets, messages, knowledge chunks) | **MongoDB Atlas** M0 cluster | Yes |
| **API** | Express + Socket.io server in `helpdesk-server/` | **Render** Web Service | Yes* |
| **Client** | React + Vite app in `helpdesk-client/` | **Vercel** | Yes |
| **Email** | Account-verification mail over the HTTPS API | **Resend** | Yes (3k/mo) |

*Render's free web service **spins down after ~15 min idle**, so the first request
after a nap takes ~50 s to wake ("cold start"). Fine for a portfolio demo — see
[Keep it warm](#keep-render-warm-optional) to hide it during interviews.

Your client is already wired to an API URL: `helpdesk-client/.env.production`
contains `VITE_API_URL=https://optidesk-d71l.onrender.com`. That is the Render
service this guide assumes. If you create a differently-named service, update
that file (it is committed on purpose) and redeploy the client.

---

## Deploy order (why it matters)

The two services point at each other, so there is a small chicken-and-egg:

1. **Atlas first** — the API needs a database connection string.
2. **Render (API) next** — you need its public URL for the client and for CORS.
3. **Vercel (client) next** — you need its public URL for the API's `CLIENT_URL`.
4. **Wire back** — set `CLIENT_URL` on Render to the Vercel URL, then redeploy the API.
5. **Seed data last** — create the admin login and ingest the knowledge base.

Follow the parts in order and you will not have to backtrack.

---

## Part 0 — Push the code to GitHub

Render and Vercel both deploy from a Git repo.

```bash
cd D:\OptiDesk
git add .
git commit -m "Prepare OptiDesk for deployment"
git push        # create the GitHub repo first if you haven't
```

Two things to know about this repo:

- **Your `.env` files are gitignored** (`.env`, `.env*` in the server) — good, your
  real MongoDB password, Gemini key, JWT secret and Resend API key will **not** be
  pushed. You will paste those values into the Render dashboard instead
  (Part 2). Never commit a real `.env`.
- It is a **two-app repo** (client + server in sub-folders, no root `package.json`).
  That is fine — you just tell each host which sub-folder to build via its
  **Root Directory** setting.

---

## Part 1 — MongoDB Atlas (database)

1. Create a free account at <https://www.mongodb.com/cloud/atlas> and create an
   **M0 (free) cluster**. Any region near you is fine.
2. **Database Access → Add New Database User.** Username + password (a real
   password, no `@ : / ?` characters to avoid escaping headaches). Role:
   *Read and write to any database*. Save the password somewhere.
3. **Network Access → Add IP Address → Allow Access from Anywhere
   (`0.0.0.0/0`).** Render's outbound IP is dynamic on the free tier, so
   whitelisting only your laptop will make the API fail to connect. **This is the
   single most common Atlas deployment mistake.**
4. **Clusters → Connect → Drivers → Node.js** and copy the connection string. It
   looks like:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

5. Add a **database name** before the `?` so OptiDesk gets its own DB instead of
   the default `test`:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/optidesk?retryWrites=true&w=majority&appName=Cluster0
   ```

Keep this final string — it becomes `MONGO_URI` on Render.

---

## Part 2 — Render (the Express + Socket.io API)

Render will build and run `helpdesk-server/`.

### Create the service

1. <https://dashboard.render.com> → **New → Web Service** → connect your GitHub repo.
2. Configure:

   | Setting | Value |
   |---------|-------|
   | **Name** | `optidesk` (this becomes `optidesk-XXXX.onrender.com`) |
   | **Root Directory** | `helpdesk-server` |
   | **Runtime** | Node |
   | **Build Command** | `npm install && npm run train` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |
   | **Health Check Path** | `/api/health` |

> **Why `npm run train` in the build command?** Your `.gitignore` excludes
> `ml/*.json`, so the trained classifiers (`ml/category.json`, `ml/priority.json`)
> are **not** in the repo. Without them, ticket triage silently falls back to
> "general / normal" for everything — the ML feature looks broken. Running
> `npm run train` during build regenerates them on the server from
> `ml/train.js`. (It needs no API key or database, so it always works.)

### Environment variables (Render → your service → Environment)

Add these. Values come from your local `helpdesk-server/.env`; **do not** commit them.

| Key | Value | Notes |
|-----|-------|-------|
| `MONGO_URI` | *(the Atlas string from Part 1)* | Required |
| `JWT_SECRET` | *(a long random string)* | Required — signs login tokens |
| `GEMINI_API_KEY` | *(your Google AI Studio key)* | Required for AI chat + ingest |
| `CLIENT_URL` | `https://<your-app>.vercel.app` | **Set after Part 3.** CORS + Socket.io + email link origin |
| `API_URL` | `https://optidesk-d71l.onrender.com` | This service's own public URL |
| `USE_ATLAS_VECTOR` | `false` | Keep false (in-memory cosine search) |
| `GEMINI_CHAT_MODEL` | `gemini-1.5-flash` | Optional — set a model your key supports |
| `EMAIL_USER` | *(your Gmail address)* | **Do not set** — replaced by `RESEND_API_KEY` |
| `EMAIL_PASS` | *(16-char Gmail App Password)* | **Do not set** — SMTP is blocked on Render, see below |
| `RESEND_API_KEY` | *(from resend.com/api-keys)* | Optional — enables verification email over HTTPS |
| `MAIL_FROM` | `OptiDesk <no-reply@yourdomain.com>` | Optional — needs a **verified** domain on Resend; unset = sandbox sender |
| `ADMIN_SIGNUP_CODE` | *(a strong secret, or omit)* | Optional — lets people self-register as admin if they know it |

Notes:

- **`PORT` is not needed** — Render injects it and your `server.js` already reads
  `process.env.PORT`. Don't hardcode it.
- **Email is optional.** Without `RESEND_API_KEY`, accounts still get created and
  the verification link is **printed in the Render logs** instead of emailed. For a
  clean public demo, either configure Resend (below) or just seed a pre-verified
  admin (Part 5) and log in as that.
- **⚠️ SMTP does not work on Render.** Render blocks outbound ports 25/465/587 on
  every plan, so a nodemailer/Gmail send fails with `ETIMEDOUT` — the app password
  is not the problem and no amount of regenerating it will help. That is why
  `services/mailer.js` uses Resend's HTTPS API instead. Leave `EMAIL_USER` /
  `EMAIL_PASS` unset here; if they are already in the dashboard, delete them and
  revoke the app password at <https://myaccount.google.com/apppasswords>.
- **Setting up Resend:** sign up at <https://resend.com>, create a key at
  <https://resend.com/api-keys> ("Sending access" is enough), and put it in
  `RESEND_API_KEY`. With no `MAIL_FROM`, mail comes from `onboarding@resend.dev`,
  which delivers **only to the address that owns your Resend account** — enough to
  prove the wiring, useless for real visitors. To email anyone else, add your domain
  at <https://resend.com/domains>, publish the DNS records it lists, wait for
  *Verified*, then set `MAIL_FROM=OptiDesk <no-reply@yourdomain.com>`. The API
  prints `✉️  Verification email: ON/OFF` at boot and names which of these is wrong.

3. **Create Web Service.** Watch the logs for `✅ MongoDB connected` and
   `🚀 API running`. Test it:

   ```
   https://optidesk-d71l.onrender.com/api/health   →   {"ok":true,"service":"optidesk-api"}
   ```

---

## Part 3 — Vercel (the React client)

Vercel will build and host `helpdesk-client/`.

1. <https://vercel.com> → **Add New → Project** → import the same GitHub repo.
2. Configure:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `helpdesk-client` |
   | **Framework Preset** | Vite |
   | **Build Command** | `npm run build` (default) |
   | **Output Directory** | `dist` (default) |
   | **Install Command** | `npm install` (default) |

3. **`VITE_API_URL` is already handled.** Your committed
   `helpdesk-client/.env.production` sets it to your Render URL, and Vite bakes
   that in at build time — so you do **not** need to add it in the Vercel
   dashboard. Only add a `VITE_API_URL` **Production** env var in Vercel if you
   want to override that file (dashboard values win over `.env.production`).

   > ⚠️ Vite inlines `VITE_*` values into the **public** browser bundle. Never put
   > a secret (DB password, Gemini key) in a `VITE_*` variable — only the API URL.

4. **SPA routing fix — already added for you.** This guide created
   `helpdesk-client/vercel.json` with a catch-all rewrite to `index.html`. Without
   it, opening a deep link directly — like the email link
   `/verify-email?token=...`, or refreshing on `/login` — returns a Vercel 404,
   because those routes only exist inside React Router. Make sure that file is
   committed and pushed.

5. **Deploy.** Vercel gives you `https://<your-app>.vercel.app`.

---

## Part 4 — Wire the two together

Now that the client has a real domain, tell the API to trust it:

1. Render → your service → **Environment** → set
   `CLIENT_URL = https://<your-app>.vercel.app` (no trailing slash).
2. Render → **Manual Deploy → Deploy latest commit** (or just Save — an env change
   triggers a redeploy).

`CLIENT_URL` controls three things in your code: the CORS allow-list
(`app.js`), the Socket.io CORS origin (`socket.js`), and the domain in the email
verification link (`services/mailer.js`). If it is wrong, the browser console
shows CORS errors and the live admin board won't receive real-time ticket updates.

> **Allowing more than one origin.** `app.js` also reads an optional
> `CORS_ORIGINS` env var (comma-separated) and merges it with `CLIENT_URL`. Use it
> if you want Vercel **preview** deployments or a custom domain to work too, e.g.
> `CORS_ORIGINS=https://optidesk.vercel.app,https://www.yourdomain.com`.

---

## Part 5 — One-time setup (admin login + knowledge base)

Your API is live but the database is empty. Run the setup scripts **once**. The
easiest way is from your own machine, pointed at the Atlas database.

1. In `helpdesk-server/.env` locally, set `MONGO_URI` to the **Atlas** string (the
   same one on Render) and make sure `GEMINI_API_KEY` is real.
2. From `helpdesk-server/`:

   ```bash
   npm install
   npm run seed:admin     # creates a pre-verified admin you can log in with
   npm run ingest         # embeds knowledge/support-faq.md so the AI chat can cite it
   ```

   - `seed:admin` uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`
     (defaults: `admin@optidesk.local` / `admin123` — **change these** before a
     public demo).
   - `ingest` needs a working `GEMINI_API_KEY`; it clears and rebuilds the
     `knowledgechunks` collection from everything in `helpdesk-server/knowledge/`.
     Add more `.md`/`.txt`/`.pdf` files there and re-run to expand the bot's
     knowledge.

> Alternatively, run these from **Render → your service → Shell**
> (`npm run seed:admin`, `npm run ingest`) so they execute in the deployed
> environment. Either approach writes to the same Atlas database.

---

## Part 6 — Smoke test (prove it works)

Open your Vercel URL and check, in order:

1. **Register** a customer → you land on the "check your inbox" screen. (If email
   is configured, click the link; otherwise grab the link from the Render logs, or
   just use the seeded admin.)
2. **Log in as the seeded admin** → the **Dashboard** loads.
3. In a second browser/incognito, **log in as the customer and raise a ticket**
   with angry wording like *"I was charged twice and I'm furious"*. It should be
   auto-classified **billing / high-or-urgent** (triage + sentiment) and appear
   **live** on the admin dashboard without a refresh (Socket.io working).
4. **Open the AI chat** on a ticket and ask something the FAQ covers → you get an
   answer with `[1]`-style **citations** (RAG working).
5. Admin **proposes a resolution** → customer **confirms "solved"** → the ticket
   closes and becomes deletable (the resolution handshake).

If all five pass, OptiDesk is fully deployed. 🎉

---

## Environment variable reference

**Server (Render):**

```
MONGO_URI            required   Atlas connection string (with /optidesk db name)
JWT_SECRET           required   long random string, signs login JWTs
GEMINI_API_KEY       required   Google AI Studio key (chat + embeddings)
CLIENT_URL           required   the Vercel URL — CORS, Socket.io, email links
API_URL              recommended  this API's own URL (used by legacy verify links)
USE_ATLAS_VECTOR     optional   "false" (in-memory) — flip to "true" only with an Atlas vector index
GEMINI_CHAT_MODEL    optional   defaults to gemini-3.6-flash; set to a model your key supports
RESEND_API_KEY       optional   Resend API key (re_…) — verification email over HTTPS
MAIL_FROM            optional   "OptiDesk <no-reply@yourdomain.com>" — needs a verified Resend domain
MAIL_REPLY_TO        optional   where replies to verification mail go
EMAIL_USER/EMAIL_PASS  DO NOT SET  legacy SMTP — Render blocks ports 25/465/587
ADMIN_SIGNUP_CODE    optional   secret that lets users self-register as admin
ADMIN_NAME/EMAIL/PASSWORD  optional  used by `npm run seed:admin`
PORT                 do not set   Render injects it automatically
```

**Client (Vercel):**

```
VITE_API_URL         the Render API base URL (no trailing /api — axios adds it).
                     Already committed in helpdesk-client/.env.production.
                     PUBLIC — never put secrets in VITE_* vars.
```

---

## Keep Render warm (optional)

To avoid the ~50 s cold start when a recruiter clicks your link, ping the health
endpoint every ~10 minutes with a free uptime monitor
(<https://uptimerobot.com> or <https://cron-job.org>):

```
Monitor URL: https://optidesk-d71l.onrender.com/api/health
Interval:    every 10 minutes
```

This keeps the free instance awake during the day. (It still sleeps overnight,
which is fine.)

---

## Troubleshooting

| Symptom | Cause & fix |
|---------|-------------|
| API logs `❌ MongoDB connection error` / timeout | Atlas **Network Access** doesn't allow `0.0.0.0/0`, or wrong password in `MONGO_URI`. |
| Browser console: **CORS error**, or admin board not updating live | `CLIENT_URL` on Render ≠ your exact Vercel URL. Fix it and redeploy the API (Part 4). |
| Refreshing `/login` or opening the email link gives a **Vercel 404** | `helpdesk-client/vercel.json` missing/not pushed. It rewrites all routes to `index.html`. |
| Every ticket comes out **general / normal** | `ml/category.json` & `priority.json` weren't built. Confirm Render **Build Command** is `npm install && npm run train`. |
| AI chat returns a 500 / "model not found" | Set `GEMINI_CHAT_MODEL` to a model your key supports, e.g. `gemini-1.5-flash` or `gemini-2.0-flash`. |
| AI chat says "I don't have any knowledge-base articles yet" | You haven't run `npm run ingest` against the Atlas DB (Part 5). |
| Can't log in: *"verify your email"* (403) | Email isn't configured — verify via the link in the Render logs, or just log in as the seeded (pre-verified) admin. |
| Mail fails with `ETIMEDOUT` / `ECONNREFUSED` on SMTP ports | Render blocks 25/465/587. Nothing to fix in the credentials — use `RESEND_API_KEY` (HTTPS), which is what `services/mailer.js` now does. |
| Logs: `Resend refused the API key` | `RESEND_API_KEY` is revoked or truncated. Generate a fresh one at <https://resend.com/api-keys>. |
| Logs: *"only send testing emails to your own email address"* | You are on the sandbox sender. Verify a domain at <https://resend.com/domains> and set `MAIL_FROM` to an address on it. |
| Logs: *"the domain is not verified"* | `MAIL_FROM` points at a domain whose DNS records are not published/propagated yet. Unset `MAIL_FROM` to fall back to the sandbox sender meanwhile. |
| API is slow on the first request | Render free cold start. Expected — see [Keep it warm](#keep-render-warm-optional). |

---

## Security reminders

- Your real secrets live only in gitignored `.env` files and in the Render
  dashboard — keep it that way. If a key ever lands in a commit, rotate it
  (new Gemini key, new Resend API key, new Atlas password, new `JWT_SECRET`).
- Change the default admin password before any public demo.
- If you set `ADMIN_SIGNUP_CODE`, anyone who learns it can self-register as an
  admin and read every ticket. For a public portfolio site, prefer creating the
  admin with `npm run seed:admin` and leaving `ADMIN_SIGNUP_CODE` unset.
