import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const healthRoutes = new Hono<{ Bindings: Bindings }>()

healthRoutes.get('/records', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from health_records where school_id = ${sid} order by created_at desc`
  return c.json(rows)
})

healthRoutes.post('/records', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'health_records', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

healthRoutes.get('/records/:recordId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const row = (await db`select * from health_records where id = ${c.req.param('recordId')} and school_id = ${sid} limit 1`)[0]
  if (!row) return c.json({ detail: 'Record not found.' }, 404)
  return c.json(row)
})

healthRoutes.patch('/records/:recordId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from health_records where id = ${c.req.param('recordId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Record not found.' }, 404)
  const updated = await updateRowById(db, 'health_records', c.req.param('recordId'), { ...body, school_id: sid })
  return c.json(updated)
})

healthRoutes.get('/students/:studentId/records', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from health_records where student_id = ${c.req.param('studentId')} and school_id = ${sid} order by created_at desc`
  return c.json(rows)
})

healthRoutes.get('/welfare', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from welfare_cases where school_id = ${sid} order by created_at desc`
  return c.json(rows)
})

healthRoutes.get('/welfare/stats', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select status, count(*)::int as count from welfare_cases where school_id = ${sid} group by status`
  const counts: Record<string, number> = {}
  for (const row of rows) counts[String(row.status)] = Number(row.count)
  return c.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0) })
})

healthRoutes.post('/welfare', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'welfare_cases', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

healthRoutes.patch('/welfare/:caseId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from welfare_cases where id = ${c.req.param('caseId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Case not found.' }, 404)
  const updated = await updateRowById(db, 'welfare_cases', c.req.param('caseId'), { ...body, school_id: sid })
  return c.json(updated)
})