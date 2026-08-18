import { apiFetch } from './api'

const BASE = '/api/v1/principal'

export type AnnouncementStatus = 'draft' | 'published' | 'archived'

export type Announcement = {
  id: number
  title: string
  body: string
  audience: string
  priority: 'normal' | 'important' | 'urgent'
  status: AnnouncementStatus
  published_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type AnnouncementInput = {
  title: string
  body: string
  audience?: string
  priority?: string
  status?: AnnouncementStatus
}

export type InsightSeverity = 'info' | 'warning' | 'critical'

export type Insight = {
  id: number
  insight_type: string
  title: string
  summary: string | null
  detail: unknown | null
  severity: InsightSeverity
  status: 'new' | 'acknowledged' | 'resolved'
  created_at: string
}

export type InsightInput = {
  insight_type?: string
  title: string
  summary?: string | null
  severity?: InsightSeverity
  status?: string
}

const get = <T,>(path: string) => apiFetch<T>(path)
const send = <T,>(path: string, method: string, body?: unknown) =>
  apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const principal = {
  announcements: () => get<Announcement[]>(`${BASE}/announcements`),
  createAnnouncement: (payload: AnnouncementInput) => send<Announcement>(`${BASE}/announcements`, 'POST', payload),
  updateAnnouncement: (id: number, payload: Record<string, unknown>) =>
    send<Announcement>(`${BASE}/announcements/${id}`, 'PATCH', payload),
  removeAnnouncement: (id: number) => send<void>(`${BASE}/announcements/${id}`, 'DELETE'),

  insights: () => get<Insight[]>(`${BASE}/insights`),
  createInsight: (payload: InsightInput) => send<Insight>(`${BASE}/insights`, 'POST', payload),
  updateInsight: (id: number, payload: Record<string, unknown>) =>
    send<Insight>(`${BASE}/insights/${id}`, 'PATCH', payload),
}