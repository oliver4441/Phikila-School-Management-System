-- Phikila — Neon platform module reconciliation
-- school_info.status is used by /api/v1/platform school management routes.
alter table public.school_info add column if not exists status text default 'active';
