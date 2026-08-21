# Phikila School Management System

A school management platform: React/Vite frontend on Vercel, a Cloudflare
Worker API on Neon Postgres, Firebase Auth, and R2 object storage.

## Repository layout

- `/frontend` — React + Vite browser application (Vercel)
- `/workers` — Cloudflare Worker backend (Hono + Neon Postgres)
- `/workers/db/migrations` — additive SQL migrations, applied manually
- `/app`, `/alembic`, `/requirements.txt` — legacy FastAPI backend (dead code)

## Local setup

### Backend (Cloudflare Worker)

```bash
cd workers
npm install --registry=https://registry.npmjs.org/
cp .dev.vars.example .dev.vars     # DATABASE_URL (Neon) + JWT_SECRET for local dev
npm run typecheck
./node_modules/.bin/wrangler dev   # local worker on :8787
```

> This machine has a broken IPv6 route. For any Node process that opens sockets
> (`wrangler`, `vercel`, neon scripts) run with
> `NODE_OPTIONS=--dns-result-order=ipv4first`.

### Frontend

```bash
cd frontend
cp .env.example .env.local   # VITE_FIREBASE_* + VITE_API_URL
npm run dev                  # proxies /api + /health to the local worker on :8787
npm run build
```

Every `VITE_*` value is public browser configuration (Firebase publishable
settings, the worker URL). Never put a backend secret in a `VITE_*` variable.

## Deployment

### Worker

```bash
cd workers
./node_modules/.bin/wrangler secret put DATABASE_URL   # Neon connection string
./node_modules/.bin/wrangler secret put JWT_SECRET
NODE_OPTIONS=--dns-result-order=ipv4first ./node_modules/.bin/wrangler deploy
```

Health: `https://phikila-backend.kipkiruigideon890.workers.dev/health`.

### Frontend (Vercel)

Project `phikila-school-system`, root directory `frontend/`. Production
environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Worker base URL (`https://phikila-backend.kipkiruigideon890.workers.dev`). |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase publishable API key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain. |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project id. |

```bash
cd frontend
vercel deploy --prod --yes
```

## Authentication

- The browser signs in with Firebase (email/password or Google).
- `POST /api/v1/auth/firebase` on the worker exchanges the Firebase ID token
  for the backend's HS256 JWT (7-day expiry) and upserts the user.
- Every API call sends `Authorization: Bearer <backend JWT>`.
- The worker validates that JWT server-side; Firebase credentials never reach
  it. New accounts start without access and must be approved by a platform
  administrator.

### Seeding a super admin (fresh deployment)

1. Create the user in Firebase (`accounts:signUp` REST or the console).
2. Exchange a Firebase ID token for a backend JWT
   (`POST /api/v1/auth/firebase`).
3. `POST /api/v1/platform/administrators` with
   `{ "email": "admin@…", "role": "super_admin" }` and the JWT.

## Database

Neon Postgres. Schema is applied manually (additive only) from
`workers/db/migrations/*.sql`. All writes go through parameterized SQL.

## Deployment smoke checks

```text
GET https://phikila-backend.kipkiruigideon890.workers.dev/health  -> {"status":"ok"}
GET https://phikila-backend.kipkiruigideon890.workers.dev/debug/db -> {"ok":true}
GET https://phikila-school-system.vercel.app/                     -> text/html
POST /api/v1/auth/firebase { id_token }                           -> { access_token, user }
GET /api/v1/auth/me with Bearer token                             -> 200
GET /api/v1/auth/me without a token                               -> 401
```

## Timetable scheduling

The interactive workspace (`/timetable`), "My timetable" views, and the AI
copilot (`/scheduling/copilot`) ship as part of the frontend. Backend
constraints/requirements, teacher availability, and generation hooks live in
`workers/src/routes/scheduling.ts`. The legacy CP-SAT engine in `app/` is not
deployed.