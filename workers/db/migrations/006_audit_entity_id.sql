-- Migration 006: add entity_id to tt_audit for scheduling audit mapping
alter table public.tt_audit add column if not exists entity_id text;
