-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  ⚠️  DANGER — DO NOT RE-RUN THIS FILE                                   ║
-- ╠═══════════════════════════════════════════════════════════════════════╣
-- ║  This migration DROPs the ENTIRE public schema (every table, all data). ║
-- ║  It must ONLY ever run once, on a fresh database, ahead of              ║
-- ║  001_initial_schema.sql. Never apply it against a database that already ║
-- ║  holds live data.                                                      ║
-- ║                                                                         ║
-- ║  The automated migration runner (workers/scripts/apply-migrations.sh)   ║
-- ║  records applied files in the `_migrations` table and skips any file    ║
-- ║  already recorded, which prevents this file from being re-applied. Do   ║
-- ║  NOT remove or bypass that guard.                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════
-- 000 — Drop legacy FastAPI schema (intentional fresh start)
-- ════════════════════════════════════════════════════════════════════════
-- This project previously ran against a FastAPI backend whose Alembic schema
-- lived in the public schema. The backend is being replaced by the Cloudflare
-- Worker, and this migration deliberately removes every legacy public table so
-- that 001_initial_schema.sql can lay down the canonical Worker schema.
--
-- WARNING: This is destructive. It drops ALL tables in the public schema
-- (users, students, finance, scheduling, etc.). Row data is lost.
--
-- Supabase Auth lives in the `auth` schema, so this does not touch auth users.

do $$
declare
  r record;
  app_tables int;
begin
  -- SAFETY GUARD: if the Worker schema is already initialized (users/school_info
  -- exist) this database is NOT a fresh start. Skipping prevents the runner from
  -- ever wiping live data if this file is applied to an existing environment.
  select count(*) into app_tables
  from information_schema.tables
  where table_schema = 'public' and table_name in ('users', 'school_info');

  if app_tables > 0 then
    raise notice '000 skipped: public schema already holds Worker tables (initialized)';
    return;
  end if;

  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
end $$;