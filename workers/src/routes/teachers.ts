import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const teachersRoutes = new Hono<{ Bindings: Bindings }>()

teachersRoutes.get('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from teachers order by id`
  return c.json(rows)
})

teachersRoutes.post('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'teachers', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

teachersRoutes.get('/:teacherId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const teacherId = c.req.param('teacherId')
  const teacher = (await db`select * from teachers where id = ${teacherId} limit 1`)[0]
  if (!teacher) return c.json({ detail: 'Teacher not found.' }, 404)
  const [qualifications, availabilities] = await Promise.all([
    db`select * from qualifications where teacher_id = ${teacherId}`,
    db`select * from availabilities where teacher_id = ${teacherId}`,
  ])
  return c.json({ ...teacher, qualifications, availabilities })
})

teachersRoutes.patch('/:teacherId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const updated = await updateRowById(db, 'teachers', c.req.param('teacherId'), body)
  return c.json(updated)
})
