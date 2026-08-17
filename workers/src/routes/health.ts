import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const healthRoutes = new Hono<{ Bindings: Bindings }>()

healthRoutes.get('/records', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from health_records order by created_at desc`
  return c.json(rows)
})

healthRoutes.post('/records', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'health_records', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

healthRoutes.get('/records/:recordId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const row = (await createSql(c.env)`select * from health_records where id = ${c.req.param('recordId')} limit 1`)[0]
  if (!row) return c.json({ detail: 'Record not found.' }, 404)
  return c.json(row)
})

healthRoutes.patch('/records/:recordId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'health_records', c.req.param('recordId'), body)
  return c.json(updated)
})

healthRoutes.get('/students/:studentId/records', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from health_records where student_id = ${c.req.param('studentId')} order by created_at desc`
  return c.json(rows)
})

healthRoutes.get('/welfare', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from welfare_cases order by created_at desc`
  return c.json(rows)
})

healthRoutes.get('/welfare/stats', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select status, count(*)::int as count from welfare_cases group by status`
  const counts: Record<string, number> = {}
  for (const row of rows) counts[String(row.status)] = Number(row.count)
  return c.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0) })
})

healthRoutes.post('/welfare', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'welfare_cases', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

healthRoutes.patch('/welfare/:caseId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'welfare_cases', c.req.param('caseId'), body)
  return c.json(updated)
})
