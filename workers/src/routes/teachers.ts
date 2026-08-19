import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const teachersRoutes = new Hono<{ Bindings: Bindings }>()

teachersRoutes.get('/', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from teachers where school_id = ${sid} order by id`
  return c.json(rows)
})

teachersRoutes.post('/', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'teachers', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

teachersRoutes.get('/:teacherId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const teacherId = c.req.param('teacherId')
  const teacher = (await db`select * from teachers where id = ${teacherId} and school_id = ${sid} limit 1`)[0]
  if (!teacher) return c.json({ detail: 'Teacher not found.' }, 404)
  const [qualifications, availabilities] = await Promise.all([
    db`select * from qualifications where teacher_id in (select id from teachers where school_id = ${sid}) and teacher_id = ${teacherId}`,
    db`select * from availabilities where teacher_id in (select id from teachers where school_id = ${sid}) and teacher_id = ${teacherId}`,
  ])
  return c.json({ ...teacher, qualifications, availabilities })
})

teachersRoutes.patch('/:teacherId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const teacherId = c.req.param('teacherId')
  const teacher = (await db`select 1 from teachers where id = ${teacherId} and school_id = ${sid} limit 1`)[0]
  if (!teacher) return c.json({ detail: 'Teacher not found.' }, 404)
  const updated = await updateRowById(db, 'teachers', teacherId, body)
  return c.json(updated)
})