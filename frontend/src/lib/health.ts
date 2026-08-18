import { apiFetch } from './api'

const BASE = '/api/v1/health'

export type HealthRecordType = 'medical' | 'checkup' | 'immunization' | 'incident'

export type HealthRecord = {
  id: number
  student_id: number
  record_type: HealthRecordType
  date: string
  title: string
  description: string | null
  blood_group: string | null
  allergies: string | null
  medication: string | null
  handler_name: string | null
  created_by: string | null
  created_at: string
}

export type WelfareStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export type WelfareCase = {
  id: number
  student_id: number | null
  case_type: string
  title: string
  description: string | null
  status: WelfareStatus
  assigned_to: string | null
  resolution_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type WelfareStats = { counts: Record<string, number>; total: number }

export type HealthRecordInput = {
  student_id: number
  record_type: HealthRecordType
  date?: string
  title: string
  description?: string | null
  blood_group?: string | null
  allergies?: string | null
  medication?: string | null
  handler_name?: string | null
}

export type WelfareInput = {
  student_id?: number | null
  case_type: string
  title: string
  description?: string | null
  assigned_to?: string | null
  resolution_notes?: string | null
}

const get = <T,>(path: string) => apiFetch<T>(path)
const send = <T,>(path: string, method: string, body?: unknown) =>
  apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const health = {
  records: () => get<HealthRecord[]>(`${BASE}/records`),
  createRecord: (payload: HealthRecordInput) => send<HealthRecord>(`${BASE}/records`, 'POST', payload),
  updateRecord: (id: number, payload: Record<string, unknown>) =>
    send<HealthRecord>(`${BASE}/records/${id}`, 'PATCH', payload),
  studentRecords: (studentId: number) => get<HealthRecord[]>(`${BASE}/students/${studentId}/records`),

  welfare: () => get<WelfareCase[]>(`${BASE}/welfare`),
  welfareStats: () => get<WelfareStats>(`${BASE}/welfare/stats`),
  createWelfare: (payload: WelfareInput) => send<WelfareCase>(`${BASE}/welfare`, 'POST', payload),
  updateWelfare: (id: number, payload: Record<string, unknown>) =>
    send<WelfareCase>(`${BASE}/welfare/${id}`, 'PATCH', payload),
}