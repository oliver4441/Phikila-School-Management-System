#!/usr/bin/env bash
# Phikila — idempotent SQL migration runner
#
# Applies every *.sql file in workers/db/migrations/ in sorted order, exactly
# once each. Applied filenames are recorded in the `_migrations` table so that
# re-running this script is a safe no-op for already-applied files.
#
# Usage:
#   DATABASE_URL=postgres://... bash workers/scripts/apply-migrations.sh
#
# Requires the `psql` client (postgresql-client) to be on PATH.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL environment variable is not set." >&2
  echo "       Export it (or pass it inline) before running this script." >&2
  exit 1
fi

# Resolve the migrations directory relative to this script so the runner works
# regardless of the current working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(cd "${SCRIPT_DIR}/../db/migrations" && pwd)"

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "ERROR: migrations directory not found at ${MIGRATIONS_DIR}" >&2
  exit 1
fi

echo "==> Using migrations directory: ${MIGRATIONS_DIR}"

# Ensure the tracking table exists.
echo "==> Ensuring _migrations tracking table exists..."
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c \
  "CREATE SCHEMA IF NOT EXISTS migration_ctl;" \
  -c \
  "CREATE TABLE IF NOT EXISTS migration_ctl._migrations (name text primary key, applied_at timestamptz not null default now());"

# SAFETY: refuse to run against a database whose schema is already initialized
# but has no migration history (i.e. migrations were applied manually before the
# runner existed). Running file 000 against such a database would DROP the whole
# public schema. If you truly want a fresh start, drop the schema yourself first.
initialized="$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'school_info');")" || initialized="?"
history="$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -tAc \
  "SELECT count(*) FROM migration_ctl._migrations;")" || history="?"

if [[ "${initialized}" != "0" && "${history}" == "0" ]]; then
  echo "ERROR: Refusing to run migrations." >&2
  echo "The public schema already contains application tables but there is no" >&2
  echo "migration history in migration_ctl._migrations. Applying 000 would wipe" >&2
  echo "all data. Import existing state into the tracking table or reset the" >&2
  echo "database intentionally, then re-run." >&2
  exit 1
fi

# Iterate over migration files in sorted (lexical) order.
shopt -s nullglob
files=("${MIGRATIONS_DIR}"/*.sql)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "==> No .sql migration files found. Nothing to do."
  exit 0
fi

echo "==> Found ${#files[@]} migration file(s)."

applied=0
skipped=0
for file in $(printf '%s\n' "${files[@]}" | sort); do
  name="$(basename "${file}")"

  already="$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -tAc \
    "SELECT 1 FROM migration_ctl._migrations WHERE name = '${name}';" || true)"

  if [[ "${already}" == "1" ]]; then
    echo "==> SKIP (already applied): ${name}"
    skipped=$((skipped + 1))
    continue
  fi

  echo "==> APPLY: ${name}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${file}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO migration_ctl._migrations (name) VALUES ('${name}');"
  echo "==> DONE: ${name}"
  applied=$((applied + 1))
done

echo "==> Migration run complete. applied=${applied} skipped=${skipped}"
