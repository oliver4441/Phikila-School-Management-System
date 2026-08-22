-- Phikila — school-scoped analytics support (migration 010)
-- ════════════════════════════════════════════════════════════════════════
-- Adds a school_id column to the timetable lesson + audit tables that were
-- missed by 007_multi_school_tenancy.sql, backfills them from their parent
-- version, and creates the composite time-series indexes needed for
-- per-school analytics (finance ageing, audit timelines, lesson lookup).
--
-- Fully additive and idempotent: every statement uses IF NOT EXISTS / guard
-- checks and backfills only rows where school_id IS NULL, so this file can be
-- safely re-run by the migration runner without error or data loss.
-- ════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. school_id on tt_lessons (backfill from parent tt_versions)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.tt_lessons
  add column if not exists school_id bigint references public.school_info(id) on delete cascade;

update public.tt_lessons
set school_id = (
  select v.school_id
  from public.tt_versions v
  where v.id = public.tt_lessons.version_id
)
where public.tt_lessons.school_id is null;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. school_id on tt_audit (best-effort backfill)
--    tt_audit only carries a free-text entity/entity_id (e.g. 'tt_versions',
--    'tt_lessons'). There is no hard FK, so the backfill is best-effort: it
--    resolves school_id from the referenced version/lesson when the text
--    entity matches a known table. Rows that cannot be resolved stay NULL and
--    can be fixed up later; nothing here is destructive.
-- ──────────────────────────────────────────────────────────────────────────
alter table public.tt_audit
  add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- best-effort: audit rows pointing at a timetable version
update public.tt_audit
set school_id = (
  select v.school_id
  from public.tt_versions v
  where v.id::text = public.tt_audit.entity_id
)
where public.tt_audit.school_id is null
  and public.tt_audit.entity = 'tt_versions';

-- best-effort: audit rows pointing at a lesson → resolve via its version
update public.tt_audit
set school_id = (
  select v.school_id
  from public.tt_lessons l
  join public.tt_versions v on v.id = l.version_id
  where l.id::text = public.tt_audit.entity_id
)
where public.tt_audit.school_id is null
  and public.tt_audit.entity = 'tt_lessons';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Composite indexes for per-school time-series analytics
-- ──────────────────────────────────────────────────────────────────────────
create index if not exists idx_student_invoices_school_due
  on public.student_invoices(school_id, due_date);

create index if not exists idx_payments_school_created
  on public.payments(school_id, created_at);

create index if not exists idx_tt_audit_school_created
  on public.tt_audit(school_id, created_at);

create index if not exists idx_tt_lessons_school
  on public.tt_lessons(school_id);
