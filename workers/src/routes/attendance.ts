import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const attendanceRoutes = new Hono<{ Bindings: Bindings }>()

const SESSION_SELECT = `
  select id, coalesce(school_id, 1) as school_id, coalesce(class_id, 0) as class_id,
         session_date as date, period_index,
         created_by as opened_by, coalesce(status, 'open') as status, created_at
  from attendance_sessions
`

const RECORD_SELECT = `
  select id, session_id, student_id, status, remark as reason, marked_by, created_at
  from attendance_records
`

async function withRecords(db: ReturnType<typeof createSql>, sessions: Record<string, unknown>[], sid: number) {
  if (!sessions.length) return sessions
  const ids = sessions.map((s) => s.id)
  const rows = (await db.query(`${RECORD_SELECT} where session_id = any($1) and school_id = ${sid}`, [ids])) as Record<string, unknown>[]
  const bySession = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const list = bySession.get(String(r.session_id)) ?? []
    list.push(r)
    bySession.set(String(r.session_id), list)
  }
  for (const s of sessions) s.records = bySession.get(String(s.id)) ?? []
  return sessions
}

attendanceRoutes.get('/sessions', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const q = c.req.query()
  const where: string[] = []
  const params: unknown[] = []
  params.push(sid)
  where.push(`school_id = $${params.length}`)
  if (q.class_id) {
    params.push(q.class_id)
    where.push(`class_id = $${params.length}`)
  }
  if (q.date_from) {
    params.push(q.date_from)
    where.push(`session_date >= $${params.length}`)
  }
  if (q.date_to) {
    params.push(q.date_to)
    where.push(`session_date <= $${params.length}`)
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  const rows = await db.query(`${SESSION_SELECT} ${whereSql} order by session_date desc, id desc`, params)
  return c.json(await withRecords(db, rows as Record<string, unknown>[], sid))
})

attendanceRoutes.post('/sessions', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const session_date = (body as Record<string, unknown>).date ?? (body as Record<string, unknown>).session_date
  if (!session_date || !(body as Record<string, unknown>).class_id) {
    return jsonError(c, 'class_id and date are required.', 400)
  }
  try {
    const rows = await db.query(
      `insert into attendance_sessions (session_type, session_date, class_id, period_index, created_by, status, school_id)
       values ('lesson', $1, $2, $3, $4, 'open', $5) returning *`,
      [
        session_date,
        (body as Record<string, unknown>).class_id,
        (body as Record<string, unknown>).period_index ?? null,
        ten.ctx.user.id,
        sid,
      ],
    )
    const [session] = await db.query(`${SESSION_SELECT} where id = $1 and school_id = ${sid}`, [rows[0].id])
    return c.json({ ...session, records: [] }, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

attendanceRoutes.get('/sessions/:sessionId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(`${SESSION_SELECT} where id = $1 and school_id = ${sid} limit 1`, [c.req.param('sessionId')])
  if (!rows[0]) return c.json({ detail: 'Session not found.' }, 404)
  const records = await db.query(`${RECORD_SELECT} where session_id = $1 and school_id = ${sid}`, [c.req.param('sessionId')])
  return c.json({ ...rows[0], records })
})

attendanceRoutes.post('/sessions/:sessionId/records', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const sessionId = c.req.param('sessionId')
  const studentId = (body as Record<string, unknown>).student_id
  if (!studentId) return jsonError(c, 'student_id is required.', 400)
  try {
    const sessionOk = await db.query(`select 1 from attendance_sessions where id = $1 and school_id = ${sid}`, [sessionId])
    if (!sessionOk[0]) return c.json({ detail: 'Session not found.' }, 404)
    const rows = await db.query(
      `insert into attendance_records (session_id, student_id, status, remark, marked_by, school_id)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (session_id, student_id) do update set status = excluded.status, remark = excluded.remark, marked_by = excluded.marked_by
       returning *`,
      [sessionId, studentId, (body as Record<string, unknown>).status ?? 'present', (body as Record<string, unknown>).reason ?? null, ten.ctx.user.id, sid],
    )
    const [record] = await db.query(`${RECORD_SELECT} where id = $1 and school_id = ${sid}`, [rows[0].id])
    return c.json(record, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

attendanceRoutes.post('/sessions/:sessionId/bulk', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const sessionId = c.req.param('sessionId')
  const studentIds = Array.isArray((body as Record<string, unknown>).student_ids)
    ? ((body as Record<string, unknown>).student_ids as unknown[])
    : []
  const status = (body as Record<string, unknown>).status ?? 'present'
  const sessionOk = await db.query(`select 1 from attendance_sessions where id = $1 and school_id = ${sid}`, [sessionId])
  if (!sessionOk[0]) return c.json({ detail: 'Session not found.' }, 404)
  let marked = 0
  for (const stuId of studentIds) {
    if (stuId == null) continue
    await db.query(
      `insert into attendance_records (session_id, student_id, status, remark, marked_by, school_id)
       values ($1, $2, $3, null, $4, $5)
       on conflict (session_id, student_id) do update set status = excluded.status, marked_by = excluded.marked_by`,
      [sessionId, stuId, status, ten.ctx.user.id, sid],
    )
    marked++
  }
  return c.json({ marked })
})

attendanceRoutes.patch('/records/:recordId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const rows = await db.query(
    `update attendance_records set status = $1, remark = $2, marked_by = $3 where id = $4 and school_id = ${sid} returning *`,
    [(body as Record<string, unknown>).status ?? 'present', (body as Record<string, unknown>).reason ?? null, ten.ctx.user.id, c.req.param('recordId')],
  )
  if (!rows[0]) return c.json({ detail: 'Record not found.' }, 404)
  const [record] = await db.query(`${RECORD_SELECT} where id = $1 and school_id = ${sid}`, [c.req.param('recordId')])
  return c.json(record)
})

attendanceRoutes.get('/students/:studentId/summary', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const studentId = c.req.param('studentId')
  const student = (await db.query(
    `select id, first_name, last_name from students where id = $1 and school_id = ${sid} limit 1`,
    [studentId],
  )) as Record<string, unknown>[]
  if (!student[0]) return c.json({ detail: 'Student not found.' }, 404)

  const rows = (await db.query(
    `select ar.status, count(*)::int as n
     from attendance_records ar
     join attendance_sessions s on s.id = ar.session_id
     where ar.student_id = $1 and s.school_id = ${sid}
     group by ar.status`,
    [studentId],
  )) as Record<string, unknown>[]

  const counts: Record<string, number> = {}
  for (const r of rows) counts[String(r.status)] = Number(r.n) || 0
  const present = counts.present ?? 0
  const absent = counts.absent ?? 0
  const late = counts.late ?? 0
  const excused = counts.excused ?? 0
  const totalDays = present + absent + late + excused

  return c.json({
    student_id: studentId,
    student_name: `${student[0].first_name} ${student[0].last_name ?? ''}`.trim(),
    total_days: totalDays,
    present,
    absent,
    late,
    excused,
    attendance_rate: totalDays ? Math.round((present / totalDays) * 1000) / 10 : 0,
  })
})