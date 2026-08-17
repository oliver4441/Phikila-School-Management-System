# AGENTS.md

Phikila School Management System. The production stack is:

- **Backend:** Cloudflare Worker (`workers/`) — Hono + `@neondatabase/serverless`
  against Neon Postgres. Deployed at `https://phikila-backend.kipkiruigideon890.workers.dev`.
- **Frontend:** React + Vite (`frontend/`), deployed to Vercel
  (`https://phikila-school-system.vercel.app`).
- **Auth:** Firebase Auth (`omix-systems-cd1af`). The browser signs in with
  Firebase (email/password or Google), exchanges the ID token for the worker's
  own HS256 JWT, and sends that JWT on every API call.
- **Media:** R2 bucket `phikila-storage`, bound as `MEDIA` in `wrangler.toml`.

The legacy FastAPI app (`app/`, `alembic/`, `requirements.txt`) is dead code —
ignored, not deployed. Never migrate it or import it.

## Commands

```bash
# Backend (workers/) — note the registry/DNS quirks below
cd workers
npm run typecheck                  # tsc --noEmit
./node_modules/.bin/wrangler dev   # local worker on :8787
./node_modules/.bin/wrangler deploy
./node_modules/.bin/wrangler secret put DATABASE_URL   # Neon connection string
./node_modules/.bin/wrangler secret put JWT_SECRET

# Frontend (frontend/)
cd frontend
cp .env.example .env.local         # VITE_FIREBASE_* + VITE_API_URL
npm run dev                        # dev server proxies /api + /health to :8787
npm run build                      # tsc -b && vite build

# Deploy frontend to Vercel (run inside frontend/)
vercel deploy --prod --yes
```

## Environment quirks (do not fight these)

- The machine's IPv6 route is broken. Node processes that open sockets
  (`wrangler`, `vercel`, node scripts) must run with
  `NODE_OPTIONS=--dns-result-order=ipv4first`. `curl` is fine without it.
- The npm registry hangs. Prefer local binaries over `npx`, and always pass
  `--registry=https://registry.npmjs.org/` when installing. `wrangler r2 bucket
  create` also hangs/fails — create buckets via the Cloudflare API instead
  (the bucket already exists; don't re-create it).
- The Worker reaches Neon fine; the problem is only local DNS. Smoke-test DB
  from the deployed worker via `GET /debug/db` on the workers.dev URL.

## Router prefix gotcha

Mounting style in `workers/src/index.ts`:

- Routers that declare their own prefix (`school`, `platform`, `students`,
  `teachers`, `attendance`, `examinations`, `finance`, `scheduling`,
  `admissions`, `health`, `inventory`, `library`, `board`, `principal`): mounted
  with `app.route('/api/v1/<name>', routes)`.
- The auth router declares no prefix; its full path is added in `index.ts`
  (`app.route('/api/v1/auth', authRoutes)`).

Never add a prefix to the auth router, and never mount a prefixed router with a
duplicate segment.

## Auth flow (worker)

- Firebase email/password and Google sign-in happen entirely in the browser.
  The worker never sees Firebase credentials.
- `POST /api/v1/auth/firebase` receives `{ id_token }`, verifies it against the
  Firebase tokeninfo endpoint, upserts the user into `users` (keyed by
  `firebase_uid`, `id` default `gen_random_uuid()`), and returns
  `{ access_token, user }`.
- The backend JWT is HS256 signed with `JWT_SECRET` (7-day expiry), `sub` = the
  internal `users.id` UUID. `jwt.ts` is the only correct JWT implementation.
- `authMiddleware` is lenient: it attaches `authUser` when a valid token is
  present and passes through otherwise. `requireAuth` (in `src/routes/auth.ts`)
  is what returns 401. Add `requireAuth` to any route that must reject
  anonymous callers.
- `src/lib/firebase.ts` verifies ID tokens; `src/lib/http.ts` has the CORS
  middleware (wildcard origin — fine because the frontend uses bearer tokens,
  never cookies).

## Database

- Neon Postgres via `@neondatabase/serverless`. Schema is created/applied from
  `workers/db/migrations/*.sql` (additive; run manually against the live
  database). Autogenerate is not used.
- Route modules use `createSql(env)` for raw parameterized SQL. All writes go
  through `src/lib/crud.ts` helpers where possible.
- `.env`/secrets must never be committed or logged. `DATABASE_URL` and
  `JWT_SECRET` live only as worker secrets and in `.dev.vars` (dev).

## Admin seeding (fresh deployment)

1. Create the user in Firebase (REST `accounts:signUp` or the console).
2. Sign in via the app (or REST `accounts:signInWithPassword`) to get an ID
   token, then `POST /api/v1/auth/firebase` for a backend JWT.
3. `POST /api/v1/platform/administrators` with `{ email, role: "super_admin" }`
   and that JWT. `GET /api/v1/platform/session` then reports
   `is_super_admin: true`.

## Adding a route module

Create `workers/src/routes/<name>.ts` (Hono router), mount it in
`workers/src/index.ts`, and follow the prefix rule above. No Alembic; add any
new tables/columns as a new `workers/db/migrations/NNN_*.sql` file.