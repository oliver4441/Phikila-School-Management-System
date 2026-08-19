import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById, upsertRow, pick } from '../lib/crud'
import { requireAuth, type AuthUser } from '../lib/auth'
import { jsonError } from '../lib/http'
import { jsonErrorResponse, isSuperAdmin, ADMIN_ROLES, GRANTABLE_ROLES } from '../lib/tenancy'
import type { Bindings } from '../lib/env'

export const platformRoutes = new Hono<{ Bindings: Bindings }>()

const uid = (c: { get: (k: 'authUser') => AuthUser | null }) => c.get('authUser')?.id ?? null

type SessionInfo = {
  access_request: {
    status: 'pending' | 'approved' | 'rejected'
    requested_role: string
    requested_school_name: string | null
    decision_note: string | null
  } | null
}

async function isSuper(c: { env: Bindings }, db: ReturnType<typeof createSql>, userId: string): Promise<boolean> {
  return isSuperAdmin(db, userId)
}

/** Current caller's platform authority + access state. */
platformRoutes.get('/session', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)

  const [adminRows, accessRows, memberRows] = await Promise.all([
    db`select role from tt_platform_admins where user_id = ${user!.id}`,
    db`select status, requested_role, requested_school_name, decision_note from tt_access_requests where user_id = ${user!.id} order by created_at desc limit 1`,
    db`
      select s.id, s.name, s.slug, m.role
      from school_memberships m
      join school_info s on s.id = m.school_id
      where m.user_id = ${user!.id} and m.status = 'active'
      order by s.id`,
  ])

  const isSuperAdmin = adminRows.length > 0
  const allSchools = await db`select id, name, slug from school_info order by id`

  const schools = isSuperAdmin
    ? allSchools.map((s) => ({ id: s.id, name: s.name, role: 'super_admin' }))
    : memberRows.map((m) => ({ id: m.id, name: m.name, role: m.role }))

  let accessRequest: SessionInfo['access_request'] | null = null
  const requestData = accessRows[0]
  if (requestData) {
    accessRequest = {
      status: (requestData.status as 'pending' | 'approved' | 'rejected') ?? 'pending',
      requested_role: (requestData.requested_role as string | null) ?? '',
      requested_school_name: (requestData.requested_school_name as string | null) ?? null,
      decision_note: (requestData.decision_note as string | null) ?? null,
    }
  }

  const hasAccess = isSuperAdmin || memberRows.length > 0
  const activeSchoolId = isSuperAdmin ? null : memberRows[0]?.id ?? null

  return c.json({
    user_id: user!.id,
    email: user!.email,
    is_super_admin: isSuperAdmin,
    schools,
    has_access: hasAccess,
    active_school_id: activeSchoolId,
    access_request: accessRequest,
  })
})

platformRoutes.get('/access-requests/options', async (c) => {
  const db = createSql(c.env)
  const schools = await db`select id, name from school_info order by id`
  return c.json({
    roles: ['admin', 'academics', 'finance', 'teacher', 'student'],
    schools: schools.map((s) => ({ id: s.id, name: s.name })),
  })
})

platformRoutes.post('/access-requests', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const { requested_role, school_id, school_name } = body

  const db = createSql(c.env)
  const existing = await db`select id from tt_access_requests where user_id = ${user!.id}`
  if (existing.length) return c.json({ detail: 'A request is already pending.' }, 409)

  const membership = await db`select id from school_memberships where user_id = ${user!.id}`
  if (membership.length) return c.json({ detail: 'You already have school access.' }, 409)

  try {
    await insertRow(db, 'tt_access_requests', {
      user_id: user!.id,
      requested_role: requested_role ?? null,
      requested_school_id: school_id ?? null,
      requested_school_name: school_name ?? null,
      status: 'pending',
    })
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
  return c.json({ ok: true }, 201)
})

platformRoutes.get('/access-requests', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const rows = await db.query(
    `select r.*, u.email
     from tt_access_requests r left join users u on u.id = r.user_id
     order by r.created_at desc`,
  )
  return c.json(rows)
})

platformRoutes.post('/access-requests/:requestId/decide', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)

  const requestId = c.req.param('requestId')
  const body = await c.req.json().catch(() => ({}))
  const { approve, role, note, school_id } = body
  const status = approve ? 'approved' : 'rejected'

  const request = (await db`select * from tt_access_requests where id = ${requestId} limit 1`)[0]
  if (!request) return c.json({ detail: 'Request not found.' }, 404)

  await db`update tt_access_requests set status = ${status}, decision_note = ${note ?? null}, decided_by = ${user!.id}, decided_at = now() where id = ${requestId}`

  if (approve) {
    const grantedSchoolId = school_id ?? request.requested_school_id
    const grantedRole = (role ?? request.requested_role ?? 'viewer') as string
    if (grantedRole === 'super_admin') {
      await db`insert into tt_platform_admins (user_id, role) values (${request.user_id}, 'super_admin') on conflict (user_id) do update set role = excluded.role`
    } else if (grantedSchoolId && GRANTABLE_ROLES.includes(grantedRole)) {
      await db`
        insert into school_memberships (school_id, user_id, role, created_by)
        values (${grantedSchoolId}, ${request.user_id}, ${grantedRole}, ${user!.id})
        on conflict (school_id, user_id) do update set role = excluded.role, status = 'active', updated_at = now()`
    } else {
      return c.json({ detail: 'Approve requires a school and a valid role.' }, 400)
    }
    await db`update tt_access_requests set requested_school_id = ${grantedSchoolId}, requested_role = ${grantedRole} where id = ${requestId}`
  }
  return c.json({ ok: true })
})

platformRoutes.get('/overview', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const [schools, users, teachers, classes, pendingRequests, superAdmins, recent] = await Promise.all([
    db`select count(*)::int as n from school_info`,
    db`select count(*)::int as n from users`,
    db`select count(*)::int as n from teachers`,
    db`select count(*)::int as n from class_registers`,
    db`select count(*)::int as n from tt_access_requests where status = 'pending'`,
    db`select count(*)::int as n from tt_platform_admins where role = 'super_admin'`,
    db`select t.id, t.created_at as at, u.email as actor, t.action,
              coalesce(t.detail->>'summary', t.action) as summary
       from tt_platform_audit t left join users u on u.id = t.user_id
       order by t.created_at desc limit 10`,
  ])
  return c.json({
    schools: schools[0]?.n ?? 0,
    users: users[0]?.n ?? 0,
    teachers: teachers[0]?.n ?? 0,
    classes: classes[0]?.n ?? 0,
    pending_requests: pendingRequests[0]?.n ?? 0,
    super_admins: superAdmins[0]?.n ?? 0,
    recent,
  })
})

const SCHOOL_SELECT = `
  select s.id, s.name, s.slug, s.timezone, s.academic_year,
         coalesce(s.status, 'active') as status,
         (select count(*) from school_memberships m where m.school_id = s.id) as users,
         (select count(*) from teachers t where t.school_id = s.id) as teachers,
         (select count(*) from class_registers cr where cr.school_id = s.id) as classes,
         s.created_at
  from school_info s
`

platformRoutes.get('/schools', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const q = c.req.query()
  const where: string[] = []
  const params: unknown[] = []
  if (q.search) {
    params.push(`%${q.search}%`)
    where.push(`(lower(s.name) like lower($${params.length}) or lower(s.slug) like lower($${params.length}))`)
  }
  if (q.status) {
    params.push(q.status)
    where.push(`lower(coalesce(s.status, 'active')) = lower($${params.length})`)
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  const rows = await db.query(`${SCHOOL_SELECT} ${whereSql} order by s.id`, params)
  return c.json(rows)
})

platformRoutes.post('/schools', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const slug = String(body.slug ?? String(body.name ?? 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim()
  try {
    const row = await insertRow(db, 'school_info', {
      name: body.name,
      slug,
      timezone: body.timezone ?? null,
      status: body.status ?? 'active',
    })
    const [school] = await db.query(`${SCHOOL_SELECT} where s.id = $1`, [row.id])
    return c.json(school, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

platformRoutes.get('/schools/:schoolId', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const rows = await db.query(`${SCHOOL_SELECT} where s.id = $1 limit 1`, [c.req.param('schoolId')])
  if (!rows[0]) return c.json({ detail: 'School not found.' }, 404)
  return c.json(rows[0])
})

platformRoutes.patch('/schools/:schoolId', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(db, 'school_info', c.req.param('schoolId'), pick(body, 'name', 'motto', 'slug', 'establishment_year', 'phone', 'email', 'address', 'timezone', 'academic_year', 'term', 'school_days', 'session_count', 'status'))
  return c.json(updated)
})

platformRoutes.post('/schools/:schoolId/status', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const active = c.req.query('active')
  const status = active === 'true' ? 'active' : active === 'false' ? 'inactive' : (await c.req.json().catch(() => ({}))).status ?? 'active'
  const updated = await updateRowById(db, 'school_info', c.req.param('schoolId'), { status })
  return c.json(updated)
})

/**
 * Who may manage a school's members: the platform super admin, or the school's
 * own principal/admin team.
 */
async function canManageSchool(
  db: ReturnType<typeof createSql>,
  userId: string,
  schoolId: string,
): Promise<boolean> {
  if (await isSuperAdmin(db, userId)) return true
  const rows = await db`
    select id from school_memberships
    where user_id = ${userId} and school_id = ${schoolId} and status = 'active'
      and (role = 'admin' or role = 'academics')`
  return rows.length > 0
}

/** Resolve a user by email, creating a placeholder account if it doesn't exist
 *  yet. Firebase email sign-in links to it via the auth.ts email match. */
async function resolveUserByEmail(db: ReturnType<typeof createSql>, email: string) {
  const cleaned = String(email ?? '').trim().toLowerCase()
  if (!cleaned) return null
  const existing = (await db`select id from users where lower(email) = lower(${cleaned}) limit 1`)[0]
  if (existing) return String(existing.id)
  const created = await db`insert into users (id, email, role, status) values (gen_random_uuid(), ${cleaned}, 'user', 'active') returning id`
  return String(created[0].id)
}

platformRoutes.get('/schools/:schoolId/members', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const schoolId = c.req.param('schoolId')
  if (!(await canManageSchool(db, user!.id, schoolId))) return c.json({ detail: 'Forbidden' }, 403)
  const rows = await db.query(
    `select m.id, m.user_id, m.role, m.status, m.created_at,
            u.email, u.full_name
     from school_memberships m left join users u on u.id = m.user_id
     where m.school_id = $1
     order by m.created_at`,
    [schoolId],
  )
  return c.json(rows)
})

platformRoutes.post('/schools/:schoolId/members', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const schoolId = c.req.param('schoolId')
  if (!(await canManageSchool(db, user!.id, schoolId))) return c.json({ detail: 'Forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const role = (body.role ?? 'viewer') as string
  if (!GRANTABLE_ROLES.includes(role)) return c.json({ detail: 'Invalid role.' }, 400)
  const userId = await resolveUserByEmail(db, body.email)
  if (!userId) return c.json({ detail: 'An email is required.' }, 400)
  await upsertRow(db, 'school_memberships', {
    school_id: schoolId,
    user_id: userId,
    role,
    status: 'active',
    created_by: user!.id,
  }, ['school_id', 'user_id'])
  return c.json({ ok: true }, 201)
})

platformRoutes.patch('/schools/:schoolId/members/:userId', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const schoolId = c.req.param('schoolId')
  if (!(await canManageSchool(db, user!.id, schoolId))) return c.json({ detail: 'Forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const data = pick(body, 'role', 'status')
  if (data.role !== undefined && !GRANTABLE_ROLES.includes(data.role as string)) {
    return c.json({ detail: 'Invalid role.' }, 400)
  }
  await db`
    update school_memberships set role = coalesce(${data.role ?? null}, role), status = coalesce(${data.status ?? null}, status), updated_at = now()
    where school_id = ${schoolId} and user_id = ${c.req.param('userId')}`
  return c.json({ ok: true })
})

platformRoutes.delete('/schools/:schoolId/members/:userId', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const schoolId = c.req.param('schoolId')
  if (!(await canManageSchool(db, user!.id, schoolId))) return c.json({ detail: 'Forbidden' }, 403)
  await db`delete from school_memberships where school_id = ${schoolId} and user_id = ${c.req.param('userId')}`
  return c.body(null, 204)
})

platformRoutes.get('/schools/:schoolId/users', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const rows = await db.query(
    `select u.id as user_id, u.email, coalesce(u.role, 'user') as role,
            (u.status = 'active') as is_active, u.created_at
     from users u order by u.created_at desc`,
  )
  return c.json(rows)
})

platformRoutes.post('/schools/:schoolId/administrators', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const existing = (await db`select id from users where email = ${body.email} limit 1`)[0]
  const userId = existing?.id ?? user!.id
  await db`insert into tt_platform_admins (user_id, role) values (${userId}, ${body.role ?? 'admin'}) on conflict (user_id) do update set role = excluded.role`
  return c.json({ ok: true }, 201)
})

platformRoutes.delete('/schools/:schoolId/administrators/:userId', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  await db`delete from tt_platform_admins where user_id = ${c.req.param('userId')}`
  return c.body(null, 204)
})

platformRoutes.get('/administrators', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const rows = await db.query(
    `select a.user_id, u.email, null as granted_by, a.created_at,
            (a.user_id = $1) as is_self
     from tt_platform_admins a left join users u on u.id = a.user_id
     order by a.created_at`,
    [user!.id],
  )
  return c.json(rows)
})

platformRoutes.post('/administrators', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const existing = (await db`select id from users where email = ${body.email} limit 1`)[0]
  const userId = existing?.id ?? user!.id
  await db`insert into tt_platform_admins (user_id, role) values (${userId}, ${body.role ?? 'admin'}) on conflict (user_id) do update set role = excluded.role`
  return c.json({ ok: true }, 201)
})

platformRoutes.delete('/administrators/:userId', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  await db`delete from tt_platform_admins where user_id = ${c.req.param('userId')}`
  return c.body(null, 204)
})

platformRoutes.get('/audit', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  if (!(await isSuper(c, db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)
  const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
  const rows = await db.query(
    `select t.id, t.created_at as at, u.email as actor, t.action,
            coalesce(t.detail->>'summary', t.action) as summary
     from tt_platform_audit t left join users u on u.id = t.user_id
     order by t.created_at desc limit $1`,
    [limit],
  )
  return c.json(rows)
})

export { uid }