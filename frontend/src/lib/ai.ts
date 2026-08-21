/**
 * AI client library.
 *
 * Wraps the /api/v1/ai backend endpoints.  Streaming chat uses raw fetch +
 * ReadableStream because POST + SSE isn't supported by EventSource.
 */

import { apiFetch, ApiError, friendlyApiError } from './api'

// ── Types ──────────────────────────────────────────────────────────────

export type AiUsage = {
  used: number
  limit: number
  resetsAt: string
}

export type AiChatMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
  tokens_used: number
  created_at: string
}

export type AiStreamEvent =
  | { type: 'token'; token: string }
  | { type: 'done'; usage: { tokens_in: number; tokens_out: number }; rate_limit?: AiUsage }
  | { type: 'error'; detail: string }

export type AiAdminConfig = {
  providers: {
    id: number
    provider: string
    default_model: string | null
    api_key_hint: string | null
    status: string
    created_at: string
    updated_at: string
  }[]
  school_overrides: {
    id: number
    school_id: number
    school_name: string
    provider: string
    default_model: string | null
    api_key_hint: string | null
    status: string
  }[]
  rate_limits: {
    id: number
    scope: string
    daily_limit: number
  }[]
  feature_toggles: {
    id: number
    school_id: number | null
    school_name: string | null
    feature: string
    enabled: boolean
  }[]
}

export type AiAuditEntry = {
  id: number
  at: string
  actor: string | null
  action: string
  request_type: string | null
  tokens_in: number
  tokens_out: number
  model: string | null
  provider: string | null
  success: boolean
  error_message: string | null
  duration_ms: number | null
  school_name: string | null
}

// ── SSE streaming helper ───────────────────────────────────────────────

/**
 * Parse an SSE stream from a fetch Response body, yielding typed events.
 */
async function* parseSseStream(
  response: Response,
): AsyncGenerator<AiStreamEvent> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (!data) continue
          try {
            const parsed = JSON.parse(data)
            if (currentEvent === 'token' || parsed.token !== undefined) {
              yield { type: 'token', token: parsed.token ?? '' }
            } else if (currentEvent === 'done' || parsed.usage) {
              yield {
                type: 'done',
                usage: parsed.usage ?? { tokens_in: 0, tokens_out: 0 },
                rate_limit: parsed.rate_limit,
              }
            } else if (currentEvent === 'error' || parsed.detail) {
              yield { type: 'error', detail: parsed.detail ?? 'Unknown error' }
            }
          } catch {
            // skip malformed JSON
          }
          currentEvent = ''
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ── Chat ───────────────────────────────────────────────────────────────

/**
 * Send a chat message and stream the response.
 *
 * Calls `onToken` for each token chunk, `onDone` when complete,
 * and `onError` on failure.
 */
export async function streamChat(params: {
  message: string
  onToken: (token: string) => void
  onDone: (usage: { tokens_in: number; tokens_out: number }, rateLimit?: AiUsage) => void
  onError: (detail: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const { getStoredSession } = await import('./authSession')
  const { getActiveSchoolId } = await import('./schoolContext')

  const session = getStoredSession()
  if (!session) {
    params.onError('Please sign in again.')
    return
  }

  const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const schoolId = getActiveSchoolId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    Authorization: `Bearer ${session.access_token}`,
  }
  if (schoolId != null) headers['X-School-Id'] = String(schoolId)

  try {
    const response = await fetch(`${apiUrl}/api/v1/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: params.message }),
      signal: params.signal,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const detail = typeof payload?.detail === 'string'
        ? payload.detail
        : `Request failed (${response.status})`
      params.onError(friendlyApiError(new ApiError(detail, response.status), 'send message'))
      return
    }

    for await (const event of parseSseStream(response)) {
      if (event.type === 'token') {
        params.onToken(event.token)
      } else if (event.type === 'done') {
        params.onDone(event.usage, event.rate_limit)
      } else if (event.type === 'error') {
        params.onError(event.detail)
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    params.onError(friendlyApiError(err, 'send message'))
  }
}

/**
 * Stream an AI analytics/report/finance endpoint.
 */
export async function streamAnalytics(params: {
  endpoint: string
  body: Record<string, unknown>
  onToken: (token: string) => void
  onDone: (usage: { tokens_in: number; tokens_out: number }) => void
  onError: (detail: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const { getStoredSession } = await import('./authSession')
  const { getActiveSchoolId } = await import('./schoolContext')

  const session = getStoredSession()
  if (!session) {
    params.onError('Please sign in again.')
    return
  }

  const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const schoolId = getActiveSchoolId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    Authorization: `Bearer ${session.access_token}`,
  }
  if (schoolId != null) headers['X-School-Id'] = String(schoolId)

  try {
    const response = await fetch(`${apiUrl}/api/v1/ai${params.endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params.body),
      signal: params.signal,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const detail = typeof payload?.detail === 'string'
        ? payload.detail
        : `Request failed (${response.status})`
      params.onError(friendlyApiError(new ApiError(detail, response.status), 'run analysis'))
      return
    }

    for await (const event of parseSseStream(response)) {
      if (event.type === 'token') {
        params.onToken(event.token)
      } else if (event.type === 'done') {
        params.onDone(event.usage)
      } else if (event.type === 'error') {
        params.onError(event.detail)
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    params.onError(friendlyApiError(err, 'run analysis'))
  }
}

// ── History ────────────────────────────────────────────────────────────

export function getChatHistory(limit = 20): Promise<AiChatMessage[]> {
  return apiFetch<AiChatMessage[]>(`/api/v1/ai/chat/history?limit=${limit}`)
}

export function clearChatHistory(): Promise<void> {
  return apiFetch<void>('/api/v1/ai/chat/history', { method: 'DELETE' })
}

// ── Usage ──────────────────────────────────────────────────────────────

export function getUsage(): Promise<AiUsage> {
  return apiFetch<AiUsage>('/api/v1/ai/usage')
}

export function getSchoolUsage(): Promise<AiUsage> {
  return apiFetch<AiUsage>('/api/v1/ai/usage/school')
}

// ── Admin ──────────────────────────────────────────────────────────────

export function getAdminConfig(): Promise<AiAdminConfig> {
  return apiFetch<AiAdminConfig>('/api/v1/ai/admin/config')
}

export function saveProviderConfig(params: {
  provider?: string
  api_key?: string
  model?: string
  school_id?: number
  school_provider?: string
  school_api_key?: string
  school_model?: string
}): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/v1/ai/admin/config', {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

export function removeProvider(provider: string): Promise<void> {
  return apiFetch<void>(`/api/v1/ai/admin/config/${provider}`, { method: 'DELETE' })
}

export function saveRateLimit(params: {
  scope: string
  daily_limit: number
}): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/v1/ai/admin/limits', {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

export function saveFeatureToggle(params: {
  feature: string
  enabled: boolean
  school_id?: number | null
}): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/v1/ai/admin/features', {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

export function getAuditLog(params?: {
  limit?: number
  school_id?: number
}): Promise<AiAuditEntry[]> {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.school_id) query.set('school_id', String(params.school_id))
  const qs = query.toString()
  return apiFetch<AiAuditEntry[]>(`/api/v1/ai/admin/audit${qs ? `?${qs}` : ''}`)
}

// ── Feature check (client-side helper) ─────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Chat assistant',
  reports: 'Report generation',
  grade_analytics: 'Grade analytics',
  finance_insight: 'Finance insights',
}

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature
}
