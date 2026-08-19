import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const academicsRoutes = new Hono<{ Bindings: Bindings }>()

academicsRoutes.get('/years', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from academic_years where school_id = ${sid} order by id desc`
  return c.json(rows)
})

academicsRoutes.get('/years/:yearId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const row = (await db`select * from academic_years where id = ${c.req.param('yearId')} and school_id = ${sid} limit 1`)[0]
  if (!row) return c.json({ detail: 'Academic year not found.' }, 404)
  return c.json(row)
})

academicsRoutes.post('/years', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'academic_years', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

academicsRoutes.get('/terms', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from terms where school_id = ${sid} order by id`
  return c.json(rows)
})

academicsRoutes.get('/terms/:termId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const row = (await db`select * from terms where id = ${c.req.param('termId')} and school_id = ${sid} limit 1`)[0]
  if (!row) return c.json({ detail: 'Term not found.' }, 404)
  return c.json(row)
})

academicsRoutes.post('/terms', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'terms', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

academicsRoutes.get('/levels', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from levels where school_id = ${sid} order by sort_order`
  return c.json(rows)
})

academicsRoutes.get('/levels/:levelId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const row = (await db`select * from levels where id = ${c.req.param('levelId')} and school_id = ${sid} limit 1`)[0]
  if (!row) return c.json({ detail: 'Level not found.' }, 404)
  return c.json(row)
})

academicsRoutes.post('/levels', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'levels', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

academicsRoutes.get('/levels/:levelId/streams', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from streams where level_id = ${c.req.param('levelId')} and school_id = ${sid} order by id`
  return c.json(rows)
})

academicsRoutes.get('/streams/:streamId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const row = (await db`select * from streams where id = ${c.req.param('streamId')} and school_id = ${sid} limit 1`)[0]
  if (!row) return c.json({ detail: 'Stream not found.' }, 404)
  return c.json(row)
})

academicsRoutes.post('/streams', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'streams', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})