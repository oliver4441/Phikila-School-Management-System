-- Phikila — AI features
-- Adds tables for AI provider key management, rate limiting, chat history,
-- feature toggles, and audit logging. Additive; safe to run against live DB.

-- ════════════════════════════════════════════════════════════════════════
-- AI provider keys (encrypted at rest via application-level encryption)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_provider_keys (
  id            bigint primary key generated always as identity,
  provider      text not null,              -- openai | anthropic | gemini | groq | cloudflare
  api_key_enc   text not null,              -- encrypted API key
  api_key_hint  text,                       -- last 4 chars for display
  default_model text,                       -- model identifier to use
  status        text not null default 'active', -- active | revoked
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider)
);

-- ════════════════════════════════════════════════════════════════════════
-- Per-school key override (optional)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_school_keys (
  id            bigint primary key generated always as identity,
  school_id     bigint not null references public.school_info(id) on delete cascade,
  provider      text not null,
  api_key_enc   text not null,
  api_key_hint  text,
  default_model text,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  unique (school_id, provider)
);

create index if not exists idx_ai_school_keys_school on public.ai_school_keys(school_id);

-- ════════════════════════════════════════════════════════════════════════
-- Rate limit configuration (super admin configurable)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_rate_limits (
  id            bigint primary key generated always as identity,
  scope         text not null,              -- global | school:<id>
  daily_limit   integer not null default 50,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (scope)
);

-- Default: 50 per user per day, 500 per school per day
insert into public.ai_rate_limits (scope, daily_limit)
values ('global', 500)
on conflict (scope) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- AI usage tracking (rate limiting + analytics)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_usage (
  id            bigint primary key generated always as identity,
  user_id       uuid not null references public.users(id) on delete cascade,
  school_id     bigint,                    -- null for platform-wide ops
  request_type  text not null,             -- chat | report | grade_analytics | finance_insight
  tokens_in     integer not null default 0,
  tokens_out    integer not null default 0,
  model         text,
  provider      text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_day
  on public.ai_usage (user_id, created_at desc);

create index if not exists idx_ai_usage_school_day
  on public.ai_usage (school_id, created_at desc)
  where school_id is not null;

-- ════════════════════════════════════════════════════════════════════════
-- Chat history (for context continuity)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_chat_history (
  id            bigint primary key generated always as identity,
  user_id       uuid not null references public.users(id) on delete cascade,
  school_id     bigint,
  role          text not null,              -- user | assistant
  content       text not null,
  tokens_used   integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ai_chat_user
  on public.ai_chat_history (user_id, school_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════
-- AI feature toggles per school
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_feature_toggles (
  id            bigint primary key generated always as identity,
  school_id     bigint,                    -- null = global default
  feature       text not null,             -- chat | reports | grade_analytics | finance_insight
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (school_id, feature)
);

-- ════════════════════════════════════════════════════════════════════════
-- AI audit log
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_audit_log (
  id            bigint primary key generated always as identity,
  user_id       uuid references public.users(id) on delete set null,
  school_id     bigint,
  action        text not null,             -- chat.send | report.generate | finance.match
  request_type  text,
  tokens_in     integer not null default 0,
  tokens_out    integer not null default 0,
  model         text,
  provider      text,
  success       boolean not null default true,
  error_message text,
  duration_ms   integer,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ai_audit_school
  on public.ai_audit_log (school_id, created_at desc);
