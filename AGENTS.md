# AGENTS.md

Phikila School Management System — **the ONLY canonical repo is
`github.com/oliver4441/Phikila-School-Management-System`** (default branch
`main`). Do **NOT** confuse it with any `langattr-cloud` fork/repo; that is a
different project. If you see `langattr-cloud` anywhere, ignore it.

The production stack is:

- **Backend:** Cloudflare Worker (`workers/`) — Hono + `@neondatabase/serverless`
  against Neon Postgres.
- **Frontend:** React + Vite (`frontend/`), deployed to Vercel.
- **Auth:** Firebase Auth (`omix-systems-cd1af`). Browser signs in with Firebase
  (email/password or Google), exchanges the ID token for the worker's own HS256
  JWT, and sends that JWT on every API call.
- **Media:** R2 bucket `phikila-storage`, bound as `MEDIA` in `wrangler.toml`.

The legacy FastAPI app (`app/`, `alembic/`, `requirements.txt`) is dead code —
ignored, not deployed. Never migrate it or import it.

---

## Platform Coordinates (IDs / URLs / Locations)

Use these exact values so AI agents and humans never get confused about which
project is which. **All deployments go to the entries below — never to
`langattr-cloud`.**

| Platform | Identifier | Name / Value | URL | Region / Location | Notes |
|----------|-----------|-------------|-----|-------------------|-------|
| **GitHub** | repo | `oliver4441/Phikila-School-Management-System` | github.com/oliver4441/Phikila-School-Management-System | — | Canonical source. Default branch `main`. NOT langattr-cloud. |
| **Vercel** | orgId | `team_osZxoIzDBMePUxtd5biFGhyo` | — | — | Vercel team |
| **Vercel** | projectId | `prj_5xqNmk2MiA8LmjdWwh6hGjULAeht` | — | — | |
| **Vercel** | projectName | `phikila-school-system` | https://phikila-school-system.vercel.app | — | **Root Directory MUST be set to `frontend/`** (see Anti-Patterns). |
| **Cloudflare** | account_id | `549a05783941248fb5a7f53ede7c54fa` | — | — | |
| **Cloudflare** | worker name | `phikila-backend` | https://phikila-backend.kipkiruigideon890.workers.dev | Global (Workers) | Main API worker. |
| **Cloudflare** | R2 bucket | `phikila-storage` (binding `MEDIA`) | — | Auto | Media storage. Already exists — never recreate. |
| **Firebase** | project_id | `omix-systems-cd1af` | console.firebase.google.com/project/omix-systems-cd1af | Auth is global | Only used for Auth. Backend verifies RS256 via Google JWKS. |
| **Neon** | project | (retrieve from Neon console / `neonctl projects list`) | — | **AWS us-east-1** | |
| **Neon** | pooled endpoint | `ep-orange-wind-aiytaow8-pooler` | `ep-orange-wind-aiytaow8-pooler.c-4.us-east-1.aws.neon.tech` | us-east-1 | Transaction-pooler (PgBouncer) — use for runtime only, NOT for DDL/migrations. |
| **Neon** | DATABASE_URL | wrangler **secret** (not in code) | — | — | Same DB used by worker; should be a separate branch per environment (see below). |

> If you need an ID not listed (e.g. Neon project id), get it from the
> respective console/CLI — never guess, and never invent a `langattr-cloud` id.

---

## Deployment Best Practices (DO THESE)

These are the standards the project should follow. They are derived from modern
CI/CD, progressive-delivery, and database-migration best practices.

1. **One canonical repo, one source of truth.** Everything deploys from
   `oliver4441/Phikila-School-Management-System@main`. No `langattr-cloud`,
   no fork drift.
2. **Trunk-based development + feature flags.** Commit small changes to `main`;
   wrap incomplete work in feature flags so it can ship disabled. Set an
   expiration for every flag (avoid flag debt).
3. **Environment separation (dev / staging / prod).**
   - Separate Firebase project for dev/staging vs prod.
   - Separate Neon branch per environment (`neonctl branches`); dev must NOT
     share prod data.
   - Vercel: Production vs Preview deployments; Cloudflare: separate
     `wrangler` environments / `--env`.
4. **Automated database migrations with a tracking table.**
   - Apply `workers/db/migrations/*.sql` in order via a runner (CI job), not by
     hand.
   - Record each applied file in a `_migrations(name, applied_at)` table so the
     runner is idempotent.
   - The runner is the SAME artifact promoted through environments — only the
     `DATABASE_URL` (runtime config) differs.
5. **Safe, backward-compatible schema changes (expand / migrate / contract).**
   - Add new columns/tables nullable first; deploy code that reads new columns
     with fallback; backfill; then make non-nullable; remove old only after the
     new code is the only version running. Never write a migration that assumes
     only the new code is live.
6. **Deploy gate / CI checks before any push to prod:**
   - `npm run typecheck` passes (backend + frontend).
   - Required secrets present (`wrangler secret list` includes `DATABASE_URL`,
     `JWT_SECRET`, `AI_ENCRYPTION_KEY`).
   - Migration runner applied cleanly to the target Neon branch.
   - No uncommitted/WIP changes deployed.
7. **Secrets live only in platform secret stores.** `DATABASE_URL`,
   `JWT_SECRET`, `AI_ENCRYPTION_KEY` are Cloudflare secrets (or `.dev.vars`
   locally, gitignored). Never commit secrets. `VITE_*` are public by design
   (set in Vercel dashboard + `frontend/.env.example` only).
8. **Immutable artifacts, runtime config only.** Build once, promote the same
   bundle; vary config via env vars, not rebuilds.
9. **Preview / ephemeral environments per PR.** Vercel Preview per PR; a Neon
   branch per PR for integration tests. Tear down after merge.
10. **Observability + fast rollback.** Enable Workers `observability`; monitor
    error rate / latency / business KPIs. Rollback = re-deploy previous artifact
    or flip a feature flag — not a manual hotfix.
11. **Decouple deploy from release.** Ship code behind a flag; enable gradually
    (internal → beta → % traffic) with metrics at each step.
12. **Keep dead code out of every deploy path.** The root `vercel.json` and any
    CI workflow that references `app/` / `alembic` / `requirements.txt` must be
    removed (see Anti-Patterns).

---

## Known Anti-Patterns / Gaps to Fix (DO NOT REPEAT)

Documented so future agents don't reintroduce them:

- 🔴 **Root `vercel.json` references the dead FastAPI app**
  (`"framework":"fastapi"` + `pip install -r requirements.txt`). The real SPA
  config is `frontend/vercel.json`. **Vercel Root Directory must be `frontend/`**,
  and the root `vercel.json` should be deleted. If the root config wins, prod
  builds the dead app and `/dashboard` deep-links 404 (no rewrites).
- 🔴 **`.github/workflows/migrate-production.yml` targets Alembic / the dead
  app**, not `workers/db/migrations/*.sql`. It migrates the WRONG schema.
  Repoint it to the worker SQL files + a `_migrations` tracking table.
- 🔴 **No migration tracking table + manual, drift-prone applies.** Add a
  runner + `_migrations`.
- 🔴 **`workers/db/migrations/000_drop_legacy_public_tables.sql` DROPs the entire
  `public` schema with no guard.** Re-running wipes all data. Guard it or move
  it out of the repeatable set.
- 🔴 **`tt_lessons` and `tt_audit` have NO `school_id`** — per-school analytics
  are impossible until added. Add `school_id` + composite indexes
  `(school_id, created_at)` / `(school_id, due_date)` before shipping analytics.
- 🟡 **Duplicate/conflicting table defs** between `004` and `007` (run-order
  dependent). `007` was reverse-engineered from drifted prod — reconcile to one
  canonical definition.
- 🟡 **Uncommitted WIP has been deployed.** Only deploy committed, typecheck-clean
  state.
- 🟡 **Single Firebase project for dev+prod** — test accounts pollute prod.
  Split into `omix-systems-cd1af` (prod) + a `-dev` project.
- 🟡 **`.env.vercel` has EMPTY `VITE_*`** — if Vercel builds from it, prod ships
  broken. Real `VITE_API_URL` + `VITE_FIREBASE_*` must be in the Vercel
  dashboard (Production env).
- 🟡 **Frontend dev port mismatch:** `frontend/.env.local` uses `:8788` but
  `wrangler dev` serves `:8787`. Align to `:8787` (or run `wrangler dev --port
  8788`).
- 🟡 **DNS/registry quirks not encoded in scripts** (see Environment quirks).
  Bake `NODE_OPTIONS=--dns-result-order=ipv4first` into npm scripts.
- 🟡 **`AI_ENCRYPTION_KEY` is empty** in `[vars]` and unset as a secret → AI
  features broken. Set via `wrangler secret put AI_ENCRYPTION_KEY`.
- 🟡 **`SOLVER_ENABLED` stored as a secret** — it's a non-sensitive feature flag;
  move it to `[vars]`.
- 🟡 **No `observability` block; `compatibility_date` stale (2024-11-01).** Bump
  and enable logs.
- 🟡 **No `[[durable_objects]]` / `[migrations]`** in `wrangler.toml` — the
  real-time/WebSocket phase needs a DO namespace + migration entry.
- 🟢 **Firebase authorized domains undocumented** — add
  `phikila-school-system.vercel.app` (and any custom domain) in the Firebase
  console or Google login fails in prod.

---

## Commands

```bash
# Backend (workers/) — note the registry/DNS quirks below
cd workers
NODE_OPTIONS=--dns-result-order=ipv4first npm run typecheck   # tsc --noEmit
NODE_OPTIONS=--dns-result-order=ipv4first ./node_modules/.bin/wrangler dev   # local worker on :8787
NODE_OPTIONS=--dns-result-order=ipv4first ./node_modules/.bin/wrangler deploy
./node_modules/.bin/wrangler secret put DATABASE_URL   # Neon connection string
./node_modules/.bin/wrangler secret put JWT_SECRET
./node_modules/.bin/wrangler secret put AI_ENCRYPTION_KEY

# Frontend (frontend/)
cd frontend
cp .env.example .env.local         # VITE_FIREBASE_* + VITE_API_URL
NODE_OPTIONS=--dns-result-order=ipv4first npm run dev    # dev server proxies /api + /health to :8787
NODE_OPTIONS=--dns-result-order=ipv4first npm run build  # tsc -b && vite build

# Deploy frontend to Vercel (run inside frontend/; Root Directory = frontend/)
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

- Neon Postgres via `@neondatabase/serverless`. Schema lives in
  `workers/db/migrations/*.sql` (additive forward migrations).
- **Migrations must be applied by an automated runner in CI** against the target
  Neon branch, recording each file in a `_migrations` table. Do NOT run them by
  hand against prod. (Current state: no runner exists yet — see Anti-Patterns;
  this is a gap to close before the dashboard overhaul.)
- Route modules use `createSql(env)` for raw parameterized SQL. All writes go
  through `src/lib/crud.ts` helpers where possible.
- `.env`/secrets must never be committed or logged. `DATABASE_URL` and
  `JWT_SECRET` live only as worker secrets and in `.dev.vars` (dev, gitignored).
- Use the **unpooled** Neon endpoint for DDL/migrations; the pooler endpoint is
  for runtime queries only.

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
new tables/columns as a new `workers/db/migrations/NNN_*.sql` file (additive,
with a corresponding entry in the migration runner).
