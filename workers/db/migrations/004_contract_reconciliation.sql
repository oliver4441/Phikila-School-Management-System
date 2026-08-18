-- Phikila — reconcile the live schema to the frontend API contracts.
-- Additive only; every statement is idempotent and safe to re-run.

-- students ───────────────────────────────────────────────────────────────
alter table public.students add column if not exists school_id bigint default 1;
alter table public.students add column if not exists preferred_name text;
alter table public.students add column if not exists email text;
alter table public.students add column if not exists phone text;
alter table public.students add column if not exists address text;
alter table public.students add column if not exists national_id text;
alter table public.students add column if not exists current_class_id bigint;
alter table public.students add column if not exists level_id bigint;
alter table public.students add column if not exists stream_id bigint;
alter table public.students add column if not exists status_reason text;
alter table public.students add column if not exists status_date date;

alter table public.guardians add column if not exists alt_phone text;
alter table public.guardians add column if not exists occupation text;

-- attendance ─────────────────────────────────────────────────────────────
alter table public.attendance_sessions add column if not exists school_id bigint default 1;
alter table public.attendance_sessions add column if not exists class_id bigint;
alter table public.attendance_sessions add column if not exists period_index int;
alter table public.attendance_sessions add column if not exists status text default 'open';

-- examinations ───────────────────────────────────────────────────────────
alter table public.examinations add column if not exists school_id bigint default 1;
alter table public.examinations add column if not exists series_id bigint;
alter table public.examinations add column if not exists description text;
alter table public.examinations add column if not exists exam_date date;
alter table public.examinations add column if not exists total_marks numeric default 100;
alter table public.examinations add column if not exists passing_marks numeric default 50;
alter table public.exam_subjects add column if not exists subject_id bigint;

create table if not exists public.exam_series (
  id bigint primary key generated always as identity,
  school_id bigint default 1,
  name text not null,
  academic_year_id bigint,
  term_id bigint,
  status text default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.grade_scale (
  id bigint primary key generated always as identity,
  school_id bigint default 1,
  grade text not null,
  min_score numeric not null default 0,
  max_score numeric not null default 0,
  points numeric,
  description text
);

-- finance ────────────────────────────────────────────────────────────────
alter table public.fee_structures add column if not exists school_id bigint default 1;
alter table public.fee_structures add column if not exists description text;
alter table public.fee_structures add column if not exists academic_year_id bigint;
alter table public.fee_structures add column if not exists term_id bigint;
alter table public.fee_structures add column if not exists level_id bigint;
alter table public.fee_structures add column if not exists currency text default 'KES';

alter table public.student_invoices add column if not exists school_id bigint default 1;
alter table public.student_invoices add column if not exists balance numeric default 0;

alter table public.payments add column if not exists school_id bigint default 1;
alter table public.payments add column if not exists invoice_id bigint;
alter table public.payments add column if not exists payment_method text;
alter table public.payments add column if not exists reference_number text;
alter table public.payments add column if not exists notes text;
alter table public.payments add column if not exists received_by text;
alter table public.payments add column if not exists journal_id bigint;
alter table public.payments add column if not exists reversed_at timestamptz;

alter table public.payment_inbox add column if not exists school_id bigint default 1;
alter table public.payment_inbox add column if not exists source_account text;
alter table public.payment_inbox add column if not exists account_name text;
alter table public.payment_inbox add column if not exists raw_message text;
alter table public.payment_inbox add column if not exists external_reference text;
alter table public.payment_inbox add column if not exists student_identifier text;
alter table public.payment_inbox add column if not exists payment_channel text;
alter table public.payment_inbox add column if not exists matched_student_id bigint;
alter table public.payment_inbox add column if not exists match_method text;
alter table public.payment_inbox add column if not exists match_confidence numeric;
alter table public.payment_inbox add column if not exists duplicate_of bigint;
alter table public.payment_inbox add column if not exists posted_payment_id bigint;
alter table public.payment_inbox add column if not exists reviewed_by uuid;
alter table public.payment_inbox add column if not exists reviewed_at timestamptz;
alter table public.payment_inbox add column if not exists notes text;

create table if not exists public.bank_accounts (
  id bigint primary key generated always as identity,
  school_id bigint default 1,
  bank_name text not null,
  branch_name text,
  account_name text not null,
  account_identifier text not null,
  currency text default 'KES',
  opening_balance numeric default 0,
  status text default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.cash_books (
  id bigint primary key generated always as identity,
  school_id bigint default 1,
  name text not null,
  book_type text default 'receipts',
  bank_account_id bigint,
  opening_balance numeric default 0,
  status text default 'active'
);

create table if not exists public.bank_reconciliations (
  id bigint primary key generated always as identity,
  school_id bigint default 1,
  bank_account_id bigint not null,
  statement_date date not null,
  statement_balance numeric default 0,
  book_balance numeric default 0,
  difference numeric default 0,
  status text default 'open',
  reconciled_by uuid,
  reconciled_at timestamptz,
  notes text
);

-- students documents & enrolment ─────────────────────────────────────────
create table if not exists public.student_documents (
  id bigint primary key generated always as identity,
  student_id bigint not null references public.students(id) on delete cascade,
  document_type text not null,
  title text not null,
  description text,
  file_url text,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

alter table public.enrollment_records add column if not exists academic_year_id bigint;
alter table public.enrollment_records add column if not exists term_id bigint;
alter table public.enrollment_records add column if not exists class_id bigint;
alter table public.enrollment_records add column if not exists level_id bigint;
alter table public.enrollment_records add column if not exists stream_id bigint;
alter table public.enrollment_records add column if not exists status text default 'active';
alter table public.enrollment_records add column if not exists enrollment_date date;

-- scheduling resources ───────────────────────────────────────────────────
alter table public.tt_teachers add column if not exists code text;
alter table public.tt_teachers add column if not exists department text;
alter table public.tt_teachers add column if not exists max_lessons_per_day int default 6;
alter table public.tt_teachers add column if not exists max_consecutive int default 2;
alter table public.tt_teachers add column if not exists workload_target int;
alter table public.tt_teachers add column if not exists unavailable jsonb default '{}'::jsonb;
alter table public.tt_teachers add column if not exists is_active boolean default true;

alter table public.tt_subjects add column if not exists colour text;
alter table public.tt_subjects add column if not exists prefers_morning boolean default false;
alter table public.tt_subjects add column if not exists prefers_double boolean default false;
alter table public.tt_subjects add column if not exists spread_across_week boolean default true;
alter table public.tt_subjects add column if not exists required_room_type text;

alter table public.tt_rooms add column if not exists code text;
alter table public.tt_rooms add column if not exists building text;
alter table public.tt_rooms add column if not exists is_accessible boolean default false;
alter table public.tt_rooms add column if not exists unavailable jsonb default '{}'::jsonb;

alter table public.tt_classes add column if not exists code text;
alter table public.tt_classes add column if not exists grade text;
alter table public.tt_classes add column if not exists student_count int default 0;
alter table public.tt_classes add column if not exists home_room_id bigint;
alter table public.tt_classes add column if not exists unavailable jsonb default '{}'::jsonb;

alter table public.tt_periods add column if not exists sort_index int;
alter table public.tt_periods add column if not exists is_teaching boolean default true;

alter table public.tt_lesson_requirements add column if not exists room_id bigint;
alter table public.tt_lesson_requirements add column if not exists double_periods int default 0;

alter table public.tt_versions add column if not exists version_number int;
alter table public.tt_versions add column if not exists label text;
alter table public.tt_versions add column if not exists quality jsonb default '{}'::jsonb;
alter table public.tt_versions add column if not exists published_at timestamptz;

alter table public.tt_lessons add column if not exists requirement_id text;
alter table public.tt_lessons add column if not exists room_id bigint;
alter table public.tt_lessons add column if not exists day_index int;
alter table public.tt_lessons add column if not exists period_index int;
alter table public.tt_lessons add column if not exists duration int default 1;
alter table public.tt_lessons add column if not exists is_locked boolean default false;

alter table public.tt_solver_jobs add column if not exists stage text;
alter table public.tt_solver_jobs add column if not exists checks jsonb default '[]'::jsonb;
alter table public.tt_solver_jobs add column if not exists result_version_id bigint;
alter table public.tt_solver_jobs add column if not exists quality jsonb default '{}'::jsonb;

alter table public.tt_audit add column if not exists summary text;
alter table public.tt_audit add column if not exists "before" jsonb;
alter table public.tt_audit add column if not exists "after" jsonb;

create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_lessons_requirement on public.tt_lessons(requirement_id);
