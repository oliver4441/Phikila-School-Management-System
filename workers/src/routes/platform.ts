import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById, upsertRow, pick } from '../lib/crud'
import { requireAuth, type AuthUser } from '../lib/auth'
import { jsonError } from '../lib/http'
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

/** Current caller's platform authority + access state. */
platformRoutes.get('/session', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)

  const [adminRows, accessRows, schoolRows] = await Promise.all([
    db`select role from tt_platform_admins where user_id = ${user!.id}`,
    db`select status, requested_role, requested_school_name, decision_note from tt_access_requests where user_id = ${user!.id} order by created_at desc limit 1`,
    db`select id, name, slug from school_info order by id`,
  ])

  const isSuperAdmin = adminRows.length > 0
  const schools = schoolRows.map((s) => ({
    id: s.id,
    name: s.name,
    role: isSuperAdmin ? 'super_admin' : (accessRows[0]?.requested_role as string | null) ?? 'viewer',
  }))

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

  const hasAccess = isSuperAdmin || (accessRows[0]?.status === 'approved' && schools.length > 0)

  return c.json({
    user_id: user!.id,
    email: user!.email,
    is_super_admin: isSuperAdmin,
    schools,
    has_access: hasAccess,
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
  const admins = await db`select id from tt_platform_admins where user_id = ${user!.id}`
  if (!admins.length) return c.json({ detail: 'Forbidden' }, 403)
  const rows = await db`select * from tt_access_requests order by created_at desc`
  return c.json(rows)
})

platformRoutes.post('/access-requests/:requestId/decide', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const admins = await db`select id from tt_platform_admins where user_id = ${user!.id}`
  if (!admins.length) return c.json({ detail: 'Forbidden' }, 403)

  const requestId = c.req.param('requestId')
  const body = await c.req.json().catch(() => ({}))
  const { approve, role, note, school_id } = body
  const status = approve ? 'approved' : 'rejected'

  const request = (await db`select * from tt_access_requests where id = ${requestId} limit 1`)[0]
  if (!request) return c.json({ detail: 'Request not found.' }, 404)

  await db`update tt_access_requests set status = ${status}, decision_note = ${note ?? null}, decided_by = ${user!.id}, decided_at = now() where id = ${requestId}`

  if (approve) {
    // Record which school was actually granted, so the decision is reflected
    // in the request row rather than silently dropping the admin's choice.
    if (school_id) {
      await db`update tt_access_requests set requested_school_id = ${school_id} where id = ${requestId}`
    }
    if (role === 'super_admin' || role === 'admin') {
      await db`insert into tt_platform_admins (user_id, role) values (${request.user_id}, 'admin') on conflict (user_id) do update set role = excluded.role`
    }
  }
  return c.json({ ok: true })
})

platformRoutes.get('/overview', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
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
         (select count(*) from users) as users,
         (select count(*) from teachers) as teachers,
         (select count(*) from class_registers) as classes,
         s.created_at
  from school_info s
`

platformRoutes.get('/schools', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
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
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const slug = String(body.slug ?? String(body.name ?? 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim()
  const db = createSql(c.env)
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
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const rows = await db.query(`${SCHOOL_SELECT} where s.id = $1 limit 1`, [c.req.param('schoolId')])
  if (!rows[0]) return c.json({ detail: 'School not found.' }, 404)
  return c.json(rows[0])
})

platformRoutes.patch('/schools/:schoolId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const updated = await updateRowById(db, 'school_info', c.req.param('schoolId'), pick(body, 'name', 'motto', 'slug', 'establishment_year', 'phone', 'email', 'address', 'timezone', 'academic_year', 'term', 'school_days', 'session_count', 'status'))
  return c.json(updated)
})

platformRoutes.post('/schools/:schoolId/status', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const active = c.req.query('active')
  const status = active === 'true' ? 'active' : active === 'false' ? 'inactive' : (await c.req.json().catch(() => ({}))).status ?? 'active'
  const updated = await updateRowById(db, 'school_info', c.req.param('schoolId'), { status })
  return c.json(updated)
})

platformRoutes.get('/schools/:schoolId/users', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
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
  const existing = (await db`select id from users where email = ${body.email} limit 1`)[0]
  const userId = existing?.id ?? user!.id
  await db`insert into tt_platform_admins (user_id, role) values (${userId}, ${body.role ?? 'admin'}) on conflict (user_id) do update set role = excluded.role`
  return c.json({ ok: true }, 201)
})

platformRoutes.delete('/schools/:schoolId/administrators/:userId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  await db`delete from tt_platform_admins where user_id = ${c.req.param('userId')}`
  return c.body(null, 204)
})

platformRoutes.get('/administrators', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
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
  const existing = (await db`select id from users where email = ${body.email} limit 1`)[0]
  const userId = existing?.id ?? user!.id
  await db`insert into tt_platform_admins (user_id, role) values (${userId}, ${body.role ?? 'admin'}) on conflict (user_id) do update set role = excluded.role`
  return c.json({ ok: true }, 201)
})

platformRoutes.delete('/administrators/:userId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  await db`delete from tt_platform_admins where user_id = ${c.req.param('userId')}`
  return c.body(null, 204)
})

platformRoutes.get('/audit', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
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
