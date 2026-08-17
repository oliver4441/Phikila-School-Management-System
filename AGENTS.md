# AGENTS.md

# IMPORTANT: Independent Phikila Deployment

This repository is the **independent Phikila deployment owned by `oliver4441`**.

## Repository identity and location

- **Current repository (WORK HERE):** `oliver4441/Phikila-School-Management-System`
- **Current repository URL:** `https://github.com/oliver4441/Phikila-School-Management-System`
- **Current repository owner:** `oliver4441`
- **Default branch:** `main`
- **Upstream/original repository:** `langattr-cloud/Phikila-School-Management-System`
- **Upstream URL:** `https://github.com/langattr-cloud/Phikila-School-Management-System`

### CRITICAL AGENT RULE

When operating in this project, treat **`oliver4441/Phikila-School-Management-System` as the ONLY repository to modify**.

Do NOT push commits, create branches, edit files, create releases, modify Actions, or otherwise mutate `langattr-cloud/Phikila-School-Management-System` unless the user explicitly gives a separate instruction to work on upstream.

The `langattr-cloud` repository is **UPSTREAM/REFERENCE ONLY** for this independent deployment.

Do not confuse:

```text
UPSTREAM / REFERENCE
langattr-cloud/Phikila-School-Management-System

                ↓ one-way reference / selective sync

CURRENT / AUTHORITATIVE FOR THIS DEPLOYMENT
oliver4441/Phikila-School-Management-System
```

## Independent infrastructure boundary

This repository is being prepared for infrastructure owned/controlled by `oliver4441`.

Target architecture:

```text
GitHub
└── oliver4441/Phikila-School-Management-System
    │
    ├── Vercel
    │   └── Frontend deployment
    │
    ├── Cloudflare
    │   ├── DNS/CDN/security
    │   ├── Workers where appropriate
    │   └── R2 for object/file storage
    │
    └── Neon
        └── PostgreSQL database
```

The independent deployment must NOT depend on Langattr's:

- Vercel project
- Cloudflare account/project
- Supabase project/database
- Supabase Storage
- production secrets
- production API endpoints
- deployment credentials

Do not reuse infrastructure credentials or production environment variables from upstream.

## Database boundary

The target database is **Neon PostgreSQL owned/controlled by `oliver4441`**.

Use the `DATABASE_URL` environment variable.

Never hard-code database credentials.

Never connect development or production work in this repository to Langattr's Supabase database.

The repository uses Alembic for schema migrations. Before changing migration behavior, inspect `alembic/env.py`, `alembic.ini`, and `alembic/versions/`.

## Current backend architecture

FastAPI backend for the Phikila School Management System (React frontend lives in the sibling `frontend/` dir). Modular architecture under `app/modules/<name>/` — each module has `models.py`, `schemas.py`, `router.py`, plus optional `services.py`/`repository.py`.

## Commands

```bash
pip install -r requirements.txt
alembic upgrade head          # runs against the DATABASE_URL configured in the environment
python seed_admin.py
uvicorn app.main:app --reload # server on :8000, docs at /docs
```

There is **no test framework** (no pytest config, no tests/). `test_timetable_route.py` is an ad-hoc ASGI scope script; don't treat it as a suite.

## Database gotchas

- The original project used a **Supabase cloud database**. That is upstream infrastructure and must not be treated as the database for this independent deployment.
- `alembic/env.py` overrides `alembic.ini`'s `sqlalchemy.url` from the environment. Verify `DATABASE_URL` before running migrations.
- `.env` may contain credentials; never expose, commit, or log them.
- `alembic/versions/` may contain stale `*.bak` files — not applied migrations unless explicitly verified.
- Before running migrations against any database, confirm the database host belongs to the independent environment.

## Router prefix gotcha

Two mounting styles in `app/main.py` — check a module's router before adding routes:

- Routers that **declare their own prefix** (`/users`, `/school`, `/departments`, `/subjects`, `/students`, `/class_register`, `/timetable`, `/finance`): mounted with only `/api/v1` in `main.py`.
- Routers with **no prefix** (`auth`, `academics`, `teachers`, `examinations`, `reports`): the full path segment is added in `main.py` (`/api/v1/auth`, `/api/v1/teachers`, etc.).

Never add a prefix to a no-prefix router, and never mount a prefixed router with a duplicate segment.

## Auth & hashing

- JWT login: `POST /api/v1/auth/login` (OAuth2 form). `create_access_token` encodes the user's **email** as `sub`.
- The only correct password hashing is `app/modules/authentication/security.py` (bcrypt). `app/core/security.py` uses `sha256_crypt` and is dead/inconsistent — never import it.
- Use `from app.modules.authentication.dependencies import get_current_user` for protected routes (re-exports the working implementation from `tokens.py`).

## Adding a module or model

- New modules: create under `app/modules/<name>/`, mount the router in `app/main.py`, and **import the models in `alembic/env.py`** or autogenerate won't see them.
- `static/` is auto-created and served at `/static` (school logo uploads).

## Upstream synchronization policy

Upstream changes may be reviewed and selectively incorporated, but they are NOT automatically authoritative.

When asked to sync upstream:

1. Inspect the upstream commit/branch first.
2. Compare it against this repository.
3. Identify conflicts with the independent infrastructure.
4. Preserve the independent Neon/Vercel/Cloudflare/R2 architecture.
5. Never copy upstream secrets or environment values.
6. Never point this repository back to Langattr production infrastructure.
7. Test before merging changes into `main`.

## Deployment rule

`main` in **`oliver4441/Phikila-School-Management-System`** is the production source for this independent deployment.

Pull requests and feature branches are for development and review.

Do not assume a deployment belonging to `langattr-cloud` is this project's deployment.
