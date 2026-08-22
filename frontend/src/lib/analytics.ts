import { apiFetch } from './api'

const BASE = '/api/v1/analytics'

export type AttendancePoint = {
  date: string
  present: number
  absent: number
  late: number
  excused: number
  rate: number | null
}

export type AttendanceSummaryResponse = {
  days: number
  series: AttendancePoint[]
  totals: { marked: number; rate: number | null }
}

export type FinanceMonth = {
  month: string
  collected: number
  payments: number
  invoiced: number
  invoices: number
  outstanding: number
}

export type FinanceSummaryResponse = {
  days: number
  series: FinanceMonth[]
  totals: { collected: number; invoiced: number; outstanding: number }
}

export type TimetableHealthResponse = {
  current_version_id: number | null
  lessons: {
    total: number
    assigned: number
    unassigned: number
    coverage_pct: number | null
    by_status: Record<string, number>
  }
  audit_events_30d: number
}

export const analytics = {
  attendanceSummary: (days = 30) =>
    apiFetch<AttendanceSummaryResponse>(`${BASE}/attendance-summary?days=${days}`),
  financeSummary: (days = 90) =>
    apiFetch<FinanceSummaryResponse>(`${BASE}/finance-summary?days=${days}`),
  timetableHealth: () => apiFetch<TimetableHealthResponse>(`${BASE}/timetable-health`),
}
