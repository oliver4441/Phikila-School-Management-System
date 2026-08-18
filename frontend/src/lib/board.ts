import { apiFetch } from './api'

const BASE = '/api/v1/board'

export type MemberStatus = 'Active' | 'Expired' | 'Resigned'

export type BoardMember = {
  id: number
  full_name: string
  position: string
  email: string | null
  phone: string | null
  term_start: string | null
  term_end: string | null
  status: MemberStatus
  created_at: string
  updated_at: string
}

export type MeetingStatus = 'scheduled' | 'held' | 'cancelled'

export type BoardMeeting = {
  id: number
  title: string
  meeting_date: string
  start_time: string | null
  location: string | null
  agenda: unknown | null
  minutes: string | null
  status: MeetingStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ResolutionStatus = 'pending' | 'adopted' | 'implemented' | 'archived'

export type Resolution = {
  id: number
  meeting_id: number | null
  title: string
  description: string | null
  status: ResolutionStatus
  adopted_at: string | null
  created_at: string
  updated_at: string
}

export type MemberInput = {
  full_name: string
  position: string
  email?: string | null
  phone?: string | null
  term_start?: string | null
  term_end?: string | null
  status?: MemberStatus
}

export type MeetingInput = {
  title: string
  meeting_date: string
  start_time?: string | null
  location?: string | null
  agenda?: unknown | null
  minutes?: string | null
  status?: MeetingStatus
}

export type ResolutionInput = {
  meeting_id?: number | null
  title: string
  description?: string | null
  status?: ResolutionStatus
}

const get = <T,>(path: string) => apiFetch<T>(path)
const send = <T,>(path: string, method: string, body?: unknown) =>
  apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const board = {
  members: () => get<BoardMember[]>(`${BASE}/members`),
  createMember: (payload: MemberInput) => send<BoardMember>(`${BASE}/members`, 'POST', payload),
  updateMember: (id: number, payload: Record<string, unknown>) =>
    send<BoardMember>(`${BASE}/members/${id}`, 'PATCH', payload),
  removeMember: (id: number) => send<void>(`${BASE}/members/${id}`, 'DELETE'),

  meetings: () => get<BoardMeeting[]>(`${BASE}/meetings`),
  meeting: (id: number) => get<{ meeting: BoardMeeting; resolutions: Resolution[] }>(`${BASE}/meetings/${id}`),
  createMeeting: (payload: MeetingInput) => send<BoardMeeting>(`${BASE}/meetings`, 'POST', payload),
  updateMeeting: (id: number, payload: Record<string, unknown>) =>
    send<BoardMeeting>(`${BASE}/meetings/${id}`, 'PATCH', payload),

  resolutions: () => get<Resolution[]>(`${BASE}/resolutions`),
  createResolution: (payload: ResolutionInput) => send<Resolution>(`${BASE}/resolutions`, 'POST', payload),
  updateResolution: (id: number, payload: Record<string, unknown>) =>
    send<Resolution>(`${BASE}/resolutions/${id}`, 'PATCH', payload),
}