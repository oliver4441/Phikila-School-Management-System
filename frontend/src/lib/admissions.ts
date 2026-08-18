import { apiFetch } from './api'

const BASE = '/api/v1/admissions'

export type ApplicationStatus = 'pending' | 'shortlisted' | 'accepted' | 'rejected' | 'enrolled'

export type Application = {
  id: number
  application_number: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  gender: string | null
  date_of_birth: string | null
  applying_for_level: string | null
  previous_school: string | null
  parent_name: string | null
  parent_phone: string | null
  parent_email: string | null
  status: ApplicationStatus
  decision_note: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
}

export type ApplicationStats = { counts: Record<string, number>; total: number }

export type EnrollmentRecord = {
  id: number
  student_id: number
  application_id: number | null
  admission_date: string
  academic_year: string | null
  level: string | null
  stream: string | null
  admission_type: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export type ApplicationInput = {
  first_name: string
  middle_name?: string | null
  last_name: string
  gender?: string | null
  date_of_birth?: string | null
  applying_for_level?: string | null
  previous_school?: string | null
  parent_name?: string | null
  parent_phone?: string | null
  parent_email?: string | null
}

const get = <T,>(path: string) => apiFetch<T>(path)
const send = <T,>(path: string, method: string, body?: unknown) =>
  apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const admissions = {
  applications: () => get<Application[]>(`${BASE}/applications`),
  stats: () => get<ApplicationStats>(`${BASE}/applications/stats`),
  create: (payload: ApplicationInput) => send<Application>(`${BASE}/applications`, 'POST', payload),
  application: (id: number) => get<Application>(`${BASE}/applications/${id}`),
  update: (id: number, payload: Record<string, unknown>) =>
    send<Application>(`${BASE}/applications/${id}`, 'PATCH', payload),
  enroll: (id: number, payload: { admission_date?: string; stream?: string; academic_year?: string; notes?: string }) =>
    send<{ student: Record<string, unknown>; status: string }>(`${BASE}/applications/${id}/enroll`, 'POST', payload),
  enrollments: () => get<EnrollmentRecord[]>(`${BASE}/enrollments`),
}