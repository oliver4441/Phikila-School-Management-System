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
  "CREATE TABLE IF NOT EXISTS _migrations (name text primary key, applied_at timestamptz not null default now());"

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
    "SELECT 1 FROM _migrations WHERE name = '${name}';" || true)"

  if [[ "${already}" == "1" ]]; then
    echo "==> SKIP (already applied): ${name}"
    skipped=$((skipped + 1))
    continue
  fi

  echo "==> APPLY: ${name}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${file}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO _migrations (name) VALUES ('${name}');"
  echo "==> DONE: ${name}"
  applied=$((applied + 1))
done

echo "==> Migration run complete. applied=${applied} skipped=${skipped}"
