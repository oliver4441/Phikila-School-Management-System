import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const schedulingRoutes = new Hono<{ Bindings: Bindings }>()

schedulingRoutes.get('/timetable', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from timetables order by created_at desc`
  return c.json(rows)
})

schedulingRoutes.post('/timetable', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'timetables', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

schedulingRoutes.get('/timetable/:timetableId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const timetableId = c.req.param('timetableId')
  const timetable = (await db`select * from timetables where id = ${timetableId} limit 1`)[0]
  if (!timetable) return c.json({ detail: 'Timetable not found.' }, 404)
  const entries = await db`select * from timetable_entries where timetable_id = ${timetableId}`
  return c.json({ ...timetable, entries })
})

schedulingRoutes.get('/entries', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from timetable_entries order by day, period`
  return c.json(rows)
})

schedulingRoutes.post('/entries', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'timetable_entries', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

schedulingRoutes.patch('/entries/:entryId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'timetable_entries', c.req.param('entryId'), body)
  return c.json(updated)
})

schedulingRoutes.delete('/entries/:entryId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'timetable_entries', c.req.param('entryId'))
  return c.body(null, 204)
})

const resourceDefs = [
  { resource: 'teachers', table: 'tt_teachers' },
  { resource: 'classes', table: 'tt_classes' },
  { resource: 'subjects', table: 'tt_subjects' },
  { resource: 'rooms', table: 'tt_rooms' },
  { resource: 'periods', table: 'tt_periods' },
  { resource: 'days', table: 'tt_days' },
]

for (const { resource, table } of resourceDefs) {
  schedulingRoutes.get(`/${resource}`, async (c) => {
    const { error } = requireAuth(c as never)
    if (error) return error
    const rows = await createSql(c.env).query(`select * from ${table} order by id`, [])
    return c.json(rows)
  })
  schedulingRoutes.post(`/${resource}`, async (c) => {
    const { error } = requireAuth(c as never)
    if (error) return error
    const body = await c.req.json().catch(() => ({}))
    try {
      const row = await insertRow(createSql(c.env), table, body)
      return c.json(row, 201)
    } catch (err) {
      return jsonError(c, (err as Error).message, 400)
    }
  })
  schedulingRoutes.patch(`/${resource}/:id`, async (c) => {
    const { error } = requireAuth(c as never)
    if (error) return error
    const body = await c.req.json().catch(() => ({}))
    const updated = await updateRowById(createSql(c.env), table, c.req.param('id'), body)
    return c.json(updated)
  })
  schedulingRoutes.delete(`/${resource}/:id`, async (c) => {
    const { error } = requireAuth(c as never)
    if (error) return error
    await deleteRowById(createSql(c.env), table, c.req.param('id'))
    return c.body(null, 204)
  })
}

schedulingRoutes.get('/versions', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from tt_versions order by created_at desc`
  return c.json(rows)
})

schedulingRoutes.post('/solve', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const rows = await db`
    insert into tt_solver_jobs (id, status, version_id, message)
    values (gen_random_uuid()::text, 'queued', ${body.version_id ?? null}, ${body.message ?? null})
    returning *
  `
  return c.json(rows[0], 202)
})
