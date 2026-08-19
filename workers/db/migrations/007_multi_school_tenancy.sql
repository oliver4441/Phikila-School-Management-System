-- Phikila — multi-school tenancy
-- Moves the system from single-school to a superadmin → school-principal
-- hierarchy. Adds a membership table and a school_id column to every tenant
-- table. Additive; safe to run against the live (near-empty) database.

-- ════════════════════════════════════════════════════════════════════════
-- Memberships (who belongs to which school, with what role)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.school_memberships (
  id bigint primary key generated always as identity,
  school_id bigint not null references public.school_info(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'viewer', -- admin | academics | finance | teacher | student | viewer
  status text not null default 'active', -- active | suspended
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create index if not exists idx_school_memberships_school on public.school_memberships(school_id);
create index if not exists idx_school_memberships_user on public.school_memberships(user_id);

-- ════════════════════════════════════════════════════════════════════════
-- School scoping — add school_id to every tenant table
-- ════════════════════════════════════════════════════════════════════════

-- Academics & setup
alter table public.academic_years add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.school_settings add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.terms add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.levels add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.streams add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.departments add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.subjects add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.class_registers add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.lesson_periods add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.working_days add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- Teachers
alter table public.teachers add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- Attendance
alter table public.attendance_records add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- Examinations
alter table public.exam_subjects add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.exam_entries add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.assessment_components add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- Finance
alter table public.finance_receipts add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.chart_of_accounts add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.finance_journals add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.finance_journal_entries add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- Timetable
alter table public.timetables add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.timetable_entries add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.timetable_allocations add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- Scheduling engine
alter table public.tt_teachers add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.tt_classes add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.tt_subjects add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.tt_rooms add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.tt_periods add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.tt_days add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.tt_lesson_requirements add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.tt_versions add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.tt_constraints add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- New modules
alter table public.admission_applications add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.enrollment_records add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.health_records add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.welfare_cases add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.inventory_items add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.inventory_movements add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.library_books add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.library_loans add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.board_members add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.board_meetings add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.board_resolutions add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.announcements add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.principal_insights add column if not exists school_id bigint references public.school_info(id) on delete cascade;
alter table public.ocr_scans add column if not exists school_id bigint references public.school_info(id) on delete cascade;

-- ════════════════════════════════════════════════════════════════════════
-- Indexes on the new tenant columns
-- ════════════════════════════════════════════════════════════════════════
create index if not exists idx_academic_years_school on public.academic_years(school_id);
create index if not exists idx_terms_school on public.terms(school_id);
create index if not exists idx_levels_school on public.levels(school_id);
create index if not exists idx_streams_school on public.streams(school_id);
create index if not exists idx_subjects_school on public.subjects(school_id);
create index if not exists idx_class_registers_school on public.class_registers(school_id);
create index if not exists idx_teachers_school on public.teachers(school_id);
create index if not exists idx_exam_subjects_school on public.exam_subjects(school_id);
create index if not exists idx_exam_entries_school on public.exam_entries(school_id);
create index if not exists idx_attendance_records_school on public.attendance_records(school_id);
create index if not exists idx_inventory_items_school on public.inventory_items(school_id);
create index if not exists idx_library_books_school on public.library_books(school_id);
create index if not exists idx_board_members_school on public.board_members(school_id);
create index if not exists idx_announcements_school on public.announcements(school_id);
create index if not exists idx_admission_applications_school on public.admission_applications(school_id);
create index if not exists idx_tt_versions_school on public.tt_versions(school_id);
create index if not exists idx_tt_teachers_school on public.tt_teachers(school_id);
create index if not exists idx_tt_classes_school on public.tt_classes(school_id);
create index if not exists idx_tt_subjects_school on public.tt_subjects(school_id);
create index if not exists idx_tt_rooms_school on public.tt_rooms(school_id);
create index if not exists idx_timetables_school on public.timetables(school_id);
create index if not exists idx_timetable_entries_school on public.timetable_entries(school_id);

-- ════════════════════════════════════════════════════════════════════════
-- Reconciliation — drifted tables captured from the live database so that
-- migrations/ is the source of truth again.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.bank_accounts (
  id int8 not null,
  school_id int8 default 1,
  bank_name text not null,
  branch_name text,
  account_name text not null,
  account_identifier text not null,
  currency text default 'KES',
  opening_balance numeric default 0,
  status text default 'active',
  created_at timestamptz not null default now()
);
create table if not exists public.bank_reconciliations (
  id int8 not null,
  school_id int8 default 1,
  bank_account_id int8 not null,
  statement_date date not null,
  statement_balance numeric default 0,
  book_balance numeric default 0,
  difference numeric default 0,
  status text default 'open',
  reconciled_by uuid,
  reconciled_at timestamptz,
  notes text
);
create table if not exists public.cash_books (
  id int8 not null,
  school_id int8 default 1,
  name text not null,
  book_type text default 'receipts',
  bank_account_id int8,
  opening_balance numeric default 0,
  status text default 'active'
);
create table if not exists public.exam_series (
  id int8 not null,
  school_id int8 default 1,
  name text not null,
  academic_year_id int8,
  term_id int8,
  status text default 'draft',
  created_at timestamptz not null default now()
);
create table if not exists public.grade_scale (
  id int8 not null,
  school_id int8 default 1,
  grade text not null,
  min_score numeric not null default 0,
  max_score numeric not null default 0,
  points numeric,
  description text
);
create table if not exists public.student_documents (
  id int8 not null,
  student_id int8 not null,
  document_type text not null,
  title text not null,
  description text,
  file_url text,
  file_size int8,
  mime_type text,
  created_at timestamptz not null default now()
);