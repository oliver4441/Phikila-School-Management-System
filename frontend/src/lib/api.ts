import { getStoredSession } from './authSession'

const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Structured detail, e.g. conflict reasons and suggested alternatives. */
    public readonly detail?: unknown,
  ) { super(message) }
}

/** User-facing copy for an API failure. Never surfaces backend internals. */
export function friendlyApiError(error: unknown, action: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your sign-in could not be verified. Please sign in again.'
    if (error.status === 403) return `You do not have permission to ${action}.`
    if (error.status === 404) return 'That information has not been set up yet.'
    if (error.status === 422 || error.status === 400) return 'Some details were not accepted. Check the form and try again.'
    // 501 endpoints are deliberate stubs; the backend returns a clear,
    // user-facing detail explaining the feature is not available here.
    if (error.status === 501 && error.message && error.message !== `Request failed (501)`) {
      return error.message
    }
    if (error.status >= 500) return `The server had a problem and could not ${action}.`
    return `We could not ${action}. Please try again.`
  }
  return `We could not ${action}. Check your connection and try again.`
}

export type ApiSession = {
  access_token: string
  user: { id: string; email: string | null; role: string | null }
}

/** Exchange a Firebase ID token for a backend session token. */
export async function exchangeFirebaseIdToken(idToken: string): Promise<ApiSession> {
  const response = await fetch(`${apiUrl}/api/v1/auth/firebase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail = typeof payload?.detail === 'string' ? payload.detail : `Request failed (${response.status})`
    throw new ApiError(detail, response.status, payload?.detail && typeof payload.detail !== 'string' ? payload.detail : undefined)
  }
  return response.json() as Promise<ApiSession>
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (authenticated) {
    const session = getStoredSession()
    if (!session) throw new ApiError('Please sign in again.', 401)
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const raw = payload?.detail
    const message = typeof raw === 'string' ? raw : typeof raw?.message === 'string' ? raw.message : `Request failed (${response.status})`
    throw new ApiError(message, response.status, typeof raw === 'object' ? raw : undefined)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export type Identity = {
  id: string
  email: string | null
  role: string | null
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

export type SchoolProfile = {
  id: number
  name: string
  motto?: string | null
  slug?: string | null
  establishment_year?: number | null
  phone?: string | null
  email?: string | null
  address?: string | null
  timezone?: string | null
  academic_year?: string | null
  term?: string | null
  session_count?: number | null
  status?: string | null
}

export type AcademicYear = {
  id: number
  name: string
  start_date: string
  end_date: string
  is_current?: boolean | null
  school_id?: number
}

export type Term = {
  id: number
  name: string
  start_date?: string | null
  end_date?: string | null
  year_id?: number | null
  school_id?: number
}

export type TermStatus = 'current' | 'upcoming' | 'completed'

/** Derives a term's status from its date range, since terms carry no flag. */
export function termStatus(term: Term): TermStatus {
  const today = new Date()
  const start = term.start_date ? new Date(term.start_date) : null
  const end = term.end_date ? new Date(term.end_date) : null
  if (start && end && today >= start && today <= end) return 'current'
  if (end && today > end) return 'completed'
  return 'upcoming'
}

export function yearStatus(year: AcademicYear): TermStatus {
  if (year.is_current) return 'current'
  const today = new Date()
  const start = year.start_date ? new Date(year.start_date) : null
  const end = year.end_date ? new Date(year.end_date) : null
  if (end && today > end) return 'completed'
  if (start && today < start) return 'upcoming'
  return 'upcoming'
}

export type Level = {
  id: number
  name: string
  description?: string | null
  sort_order?: number
}

export const api = {
  health: () => apiFetch<{ status: string; environment: string }>('/health', {}, false),
  me: () => apiFetch<Identity>('/api/v1/auth/me'),
  school: () => apiFetch<SchoolProfile>('/api/v1/school/'),
  academicYears: () => apiFetch<AcademicYear[]>('/api/v1/academics/years'),
  terms: () => apiFetch<Term[]>('/api/v1/academics/terms'),
  levels: () => apiFetch<Level[]>('/api/v1/academics/levels'),
}