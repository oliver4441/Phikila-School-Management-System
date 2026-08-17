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
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
end $$;