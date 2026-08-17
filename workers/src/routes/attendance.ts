import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const attendanceRoutes = new Hono<{ Bindings: Bindings }>()

attendanceRoutes.get('/classes', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from attendance_sessions order by created_at desc`
  return c.json(rows)
})

attendanceRoutes.get('/sessions', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from attendance_sessions order by created_at desc`
  return c.json(rows)
})

attendanceRoutes.post('/sessions', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'attendance_sessions', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

attendanceRoutes.get('/sessions/:sessionId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const sessionId = c.req.param('sessionId')
  const session = (await db`select * from attendance_sessions where id = ${sessionId} limit 1`)[0]
  if (!session) return c.json({ detail: 'Session not found.' }, 404)
  const records = await db`select * from attendance_records where session_id = ${sessionId}`
  return c.json({ ...session, records })
})

attendanceRoutes.patch('/sessions/:sessionId/records', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const records = Array.isArray(body.records) ? body.records : []
  const db = createSql(c.env)
  const sessionId = c.req.param('sessionId')
  for (const record of records as Record<string, unknown>[]) {
    if (record.id) {
      await db`update attendance_records set status = ${record.status ?? 'present'}, remark = ${record.remark ?? null} where id = ${record.id}`
    } else {
      await db`
        insert into attendance_records (session_id, student_id, status, remark)
        values (${sessionId}, ${record.student_id}, ${record.status ?? 'present'}, ${record.remark ?? null})
        on conflict (session_id, student_id) do update set status = excluded.status, remark = excluded.remark
      `
    }
  }
  return c.json({ ok: true })
})

attendanceRoutes.get('/students/:studentId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from attendance_records where student_id = ${c.req.param('studentId')} order by created_at desc`
  return c.json(rows)
})
