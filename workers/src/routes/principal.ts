import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const principalRoutes = new Hono<{ Bindings: Bindings }>()

principalRoutes.get('/announcements', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from announcements where school_id = ${sid} order by published_at desc nulls last, created_at desc`
  return c.json(rows)
})

principalRoutes.post('/announcements', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'announcements', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

principalRoutes.patch('/announcements/:announcementId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from announcements where id = ${c.req.param('announcementId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Announcement not found.' }, 404)
  const updated = await updateRowById(db, 'announcements', c.req.param('announcementId'), { ...body, school_id: sid })
  return c.json(updated)
})

principalRoutes.delete('/announcements/:announcementId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const ok = await db`select 1 from announcements where id = ${c.req.param('announcementId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Announcement not found.' }, 404)
  await deleteRowById(db, 'announcements', c.req.param('announcementId'))
  return c.body(null, 204)
})

principalRoutes.get('/insights', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from principal_insights where school_id = ${sid} order by created_at desc`
  return c.json(rows)
})

principalRoutes.post('/insights', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'principal_insights', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

principalRoutes.patch('/insights/:insightId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from principal_insights where id = ${c.req.param('insightId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Insight not found.' }, 404)
  const updated = await updateRowById(db, 'principal_insights', c.req.param('insightId'), { ...body, school_id: sid })
  return c.json(updated)
})