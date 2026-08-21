-- Phikila — Neon auth & module fixes migration
-- Portable PostgreSQL; no Supabase-specific features.

-- Firebase identity binding on users (passwords are owned by Firebase Auth).
alter table public.users add column if not exists firebase_uid text;
create unique index if not exists idx_users_firebase_uid
  on public.users(firebase_uid) where firebase_uid is not null;

-- Examinations module tables (reconcile routes that reference exam_subjects / exam_entries).
create table if not exists public.exam_subjects (
  id bigint primary key generated always as identity,
  examination_id bigint not null references public.examinations(id) on delete cascade,
  subject_name text not null,
  max_score numeric not null default 100,
  weight numeric not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_entries (
  id bigint primary key generated always as identity,
  exam_subject_id bigint not null references public.exam_subjects(id) on delete cascade,
  student_id bigint references public.students(id) on delete cascade,
  score numeric,
  grade text,
  remark text,
  created_at timestamptz not null default now(),
  unique (exam_subject_id, student_id)
);