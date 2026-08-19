import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const boardRoutes = new Hono<{ Bindings: Bindings }>()

boardRoutes.get('/members', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from board_members where school_id = ${sid} order by term_start desc nulls last, created_at desc`
  return c.json(rows)
})

boardRoutes.post('/members', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'board_members', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

boardRoutes.patch('/members/:memberId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from board_members where id = ${c.req.param('memberId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Member not found.' }, 404)
  const updated = await updateRowById(db, 'board_members', c.req.param('memberId'), { ...body, school_id: sid })
  return c.json(updated)
})

boardRoutes.delete('/members/:memberId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const ok = await db`select 1 from board_members where id = ${c.req.param('memberId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Member not found.' }, 404)
  await deleteRowById(db, 'board_members', c.req.param('memberId'))
  return c.body(null, 204)
})

boardRoutes.get('/meetings', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from board_meetings where school_id = ${sid} order by meeting_date desc`
  return c.json(rows)
})

boardRoutes.post('/meetings', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'board_meetings', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

boardRoutes.get('/meetings/:meetingId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const meetingId = c.req.param('meetingId')
  const meeting = (await db`select * from board_meetings where id = ${meetingId} and school_id = ${sid} limit 1`)[0]
  if (!meeting) return c.json({ detail: 'Meeting not found.' }, 404)
  const resolutions = await db`select * from board_resolutions where meeting_id = ${meetingId} and school_id = ${sid}`
  return c.json({ ...meeting, resolutions })
})

boardRoutes.patch('/meetings/:meetingId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from board_meetings where id = ${c.req.param('meetingId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Meeting not found.' }, 404)
  const updated = await updateRowById(db, 'board_meetings', c.req.param('meetingId'), { ...body, school_id: sid })
  return c.json(updated)
})

boardRoutes.get('/resolutions', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from board_resolutions where school_id = ${sid} order by adopted_at desc nulls last, created_at desc`
  return c.json(rows)
})

boardRoutes.post('/resolutions', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'board_resolutions', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

boardRoutes.patch('/resolutions/:resolutionId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from board_resolutions where id = ${c.req.param('resolutionId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Resolution not found.' }, 404)
  const updated = await updateRowById(db, 'board_resolutions', c.req.param('resolutionId'), { ...body, school_id: sid })
  return c.json(updated)
})