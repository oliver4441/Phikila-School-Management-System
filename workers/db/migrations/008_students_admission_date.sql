-- Fix schema drift: students.admission_date was referenced by the API but missing
alter table public.students add column if not exists admission_date date;