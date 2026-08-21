/**
 * AI rate-limiting.
 *
 * Enforces per-user and per-school daily request caps.
 * Counters live in Neon Postgres (source of truth) with a lightweight
 * in-memory cache per worker invocation to avoid hammering the DB on
 * rapid successive requests.
 */

import type { Sql } from './db'

// ── In-memory cache (per worker invocation) ────────────────────────────

const cache = new Map<string, { count: number; ttl: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

function cacheKey(scope: string, date: string): string {
  return `${scope}:${date}`
}

function cachedCount(key: string): number | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.ttl) {
    cache.delete(key)
    return null
  }
  return entry.count
}

function setCache(key: string, count: number): void {
  cache.set(key, { count, ttl: Date.now() + CACHE_TTL_MS })
}

// ── Date helper ────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

// ── Types ──────────────────────────────────────────────────────────────

export type RateLimitResult = {
  allowed: boolean
  current: number
  limit: number
  retryAfterSeconds?: number
}

// ── Limit resolution ───────────────────────────────────────────────────

async function getDailyLimit(db: Sql, scope: string): Promise<number> {
  const rows = await db`select daily_limit from ai_rate_limits where scope = ${scope} limit 1`
  if (rows.length) return Number(rows[0].daily_limit)
  // Fallback to global
  const global = await db`select daily_limit from ai_rate_limits where scope = 'global' limit 1`
  return global.length ? Number(global[0].daily_limit) : 50
}

async function countToday(db: Sql, column: 'user_id' | 'school_id', id: string | number): Promise<number> {
  const today = todayKey()
  const key = cacheKey(`${column}:${id}`, today)
  const cached = cachedCount(key)
  if (cached !== null) return cached

  const rows = await db.query(
    `select count(*)::int as n from ai_usage where ${column} = $1 and created_at >= $2::date`,
    [id, today],
  )
  const count = rows[0]?.n ?? 0
  setCache(key, count)
  return count
}

function incrementCache(column: 'user_id' | 'school_id', id: string | number): void {
  const today = todayKey()
  const key = cacheKey(`${column}:${id}`, today)
  const entry = cache.get(key)
  if (entry && Date.now() <= entry.ttl) {
    entry.count++
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Check whether a request is allowed for the given user + school.
 * Returns the rate-limit decision without mutating anything.
 */
export async function checkRateLimit(
  db: Sql,
  userId: string,
  schoolId: number | null,
): Promise<RateLimitResult> {
  const today = todayKey()

  // Per-user limit
  const userLimit = await getDailyLimit(db, 'global')
  const userCount = await countToday(db, 'user_id', userId)
  if (userCount >= userLimit) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const retryAfter = Math.floor((tomorrow.getTime() - Date.now()) / 1000)
    return { allowed: false, current: userCount, limit: userLimit, retryAfterSeconds: retryAfter }
  }

  // Per-school limit (if school context present)
  if (schoolId) {
    const schoolScope = `school:${schoolId}`
    const schoolLimit = await getDailyLimit(db, schoolScope)
    const schoolCount = await countToday(db, 'school_id', schoolId)
    if (schoolCount >= schoolLimit) {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const retryAfter = Math.floor((tomorrow.getTime() - Date.now()) / 1000)
      return { allowed: false, current: schoolCount, limit: schoolLimit, retryAfterSeconds: retryAfter }
    }
  }

  return { allowed: true, current: userCount, limit: userLimit }
}

/**
 * Record a completed AI request for usage tracking.
 * Also increments the in-memory cache so subsequent checks are fast.
 */
export async function recordUsage(
  db: Sql,
  params: {
    userId: string
    schoolId: number | null
    requestType: string
    tokensIn: number
    tokensOut: number
    model: string | null
    provider: string | null
  },
): Promise<void> {
  await db`
    insert into ai_usage (user_id, school_id, request_type, tokens_in, tokens_out, model, provider)
    values (${params.userId}, ${params.schoolId}, ${params.requestType}, ${params.tokensIn}, ${params.tokensOut}, ${params.model}, ${params.provider})
  `
  incrementCache('user_id', params.userId)
  if (params.schoolId) incrementCache('school_id', params.schoolId)
}

/**
 * Get current usage stats for a user.
 */
export async function getUserUsage(
  db: Sql,
  userId: string,
): Promise<{ used: number; limit: number; resetsAt: string }> {
  const today = todayKey()
  const userLimit = await getDailyLimit(db, 'global')
  const used = await countToday(db, 'user_id', userId)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return { used, limit: userLimit, resetsAt: tomorrow.toISOString() }
}

/**
 * Get current usage stats for a school.
 */
export async function getSchoolUsage(
  db: Sql,
  schoolId: number,
): Promise<{ used: number; limit: number; resetsAt: string }> {
  const today = todayKey()
  const schoolScope = `school:${schoolId}`
  const schoolLimit = await getDailyLimit(db, schoolScope)
  const used = await countToday(db, 'school_id', schoolId)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return { used, limit: schoolLimit, resetsAt: tomorrow.toISOString() }
}

/**
 * Check if a feature is enabled for a school (or globally).
 */
export async function isFeatureEnabled(
  db: Sql,
  feature: string,
  schoolId: number | null,
): Promise<boolean> {
  // School-specific toggle
  if (schoolId) {
    const rows = await db`select enabled from ai_feature_toggles where school_id = ${schoolId} and feature = ${feature} limit 1`
    if (rows.length) return Boolean(rows[0].enabled)
  }
  // Global toggle
  const rows = await db`select enabled from ai_feature_toggles where school_id is null and feature = ${feature} limit 1`
  if (rows.length) return Boolean(rows[0].enabled)
  // Default: enabled
  return true
}
