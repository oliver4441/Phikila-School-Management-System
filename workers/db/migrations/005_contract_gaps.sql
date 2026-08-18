-- Phikila — small contract gaps found during worker reconciliation.
alter table public.fee_structures add column if not exists status text default 'active';
