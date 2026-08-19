import type { Context } from 'hono'
import type { Sql } from './db'
import { requireAuth, type AuthUser } from './auth'

/** Roles allowed to mutate school data. `student` and `viewer` are read-only. */
export const WRITE_ROLES = ['admin', 'academics', 'finance', 'teacher']
/** Roles that administer a school (manage members, settings). */
export const ADMIN_ROLES = ['admin', 'academics']
/** Roles a super admin can grant when approving access or appointing members. */
export const GRANTABLE_ROLES = ['admin', 'academics', 'finance', 'teacher', 'student', 'viewer']

export type TenantContext = {
  user: AuthUser
  school: { id: number; name: string; slug: string } | null
  role: string
  isSuperAdmin: boolean
}

export function jsonErrorResponse(detail: string, status: number): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function getSchoolIdHeader(c: Context): string | null {
  const header = c.req.header('x-school-id')
  return header && /^\d+$/.test(header) ? header : null
}

export async function isSuperAdmin(db: Sql, userId: string): Promise<boolean> {
  const rows = await db`select id from tt_platform_admins where user_id = ${userId}`
  return rows.length > 0
}

/**
 * Resolves the caller's tenancy context for a module route.
 *
 * - Super admins may operate against any school (selected via `X-School-Id`)
 *   and may also operate platform-wide with `school === null`.
 * - Everyone else must hold an active membership in the requested school.
 *
 * Returns `{ ctx }` on success or `{ error: Response }`.
 */
export async function resolveTenant(
  c: Context,
  db: Sql,
): Promise<{ ctx: TenantContext } | { error: Response }> {
  const { error, user } = requireAuth(c as never)
  if (error) return { error }
  const header = getSchoolIdHeader(c)
  const superAdmin = await isSuperAdmin(db, user!.id)

  if (superAdmin) {
    let school: TenantContext['school'] = null
    if (header) {
      const rows = await db`select id, name, slug from school_info where id = ${header}`
      if (!rows.length) return { error: jsonErrorResponse('School not found.', 404) }
      school = { id: Number(rows[0].id), name: rows[0].name, slug: rows[0].slug }
    }
    return { ctx: { user: user!, school, role: 'super_admin', isSuperAdmin: true } }
  }

  if (!header) {
    return { error: jsonErrorResponse('Select a school first.', 400) }
  }

  const rows = await db`
    select m.role, s.id, s.name, s.slug
    from school_memberships m
    join school_info s on s.id = m.school_id
    where m.user_id = ${user!.id} and m.school_id = ${header} and m.status = 'active'
    limit 1`
  if (!rows.length) {
    return { error: jsonErrorResponse('You do not have access to this school.', 403) }
  }
  return {
    ctx: {
      user: user!,
      school: { id: Number(rows[0].id), name: rows[0].name, slug: rows[0].slug },
      role: rows[0].role as string,
      isSuperAdmin: false,
    },
  }
}

/** Super admins pass any role check; otherwise the caller's role must be allowed. */
export function requireRole(
  ctx: TenantContext,
  allowed: string[],
): { ok: true } | { error: Response } {
  if (ctx.isSuperAdmin || allowed.includes(ctx.role)) return { ok: true }
  return { error: jsonErrorResponse('Forbidden', 403) }
}

/** Convenience: enforce write access (any non-readonly role). */
export function requireWrite(ctx: TenantContext): { ok: true } | { error: Response } {
  return requireRole(ctx, WRITE_ROLES)
}

/** The school id every module write must stamp, or null for platform-wide ops. */
export function tenantSchoolId(ctx: TenantContext): number | null {
  return ctx.school?.id ?? null
}