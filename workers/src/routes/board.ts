import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const boardRoutes = new Hono<{ Bindings: Bindings }>()

boardRoutes.get('/members', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from board_members order by term_start desc nulls last, created_at desc`
  return c.json(rows)
})

boardRoutes.post('/members', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'board_members', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

boardRoutes.patch('/members/:memberId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'board_members', c.req.param('memberId'), body)
  return c.json(updated)
})

boardRoutes.delete('/members/:memberId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'board_members', c.req.param('memberId'))
  return c.body(null, 204)
})

boardRoutes.get('/meetings', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from board_meetings order by meeting_date desc`
  return c.json(rows)
})

boardRoutes.post('/meetings', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'board_meetings', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

boardRoutes.get('/meetings/:meetingId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const meetingId = c.req.param('meetingId')
  const meeting = (await db`select * from board_meetings where id = ${meetingId} limit 1`)[0]
  if (!meeting) return c.json({ detail: 'Meeting not found.' }, 404)
  const resolutions = await db`select * from board_resolutions where meeting_id = ${meetingId}`
  return c.json({ ...meeting, resolutions })
})

boardRoutes.patch('/meetings/:meetingId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'board_meetings', c.req.param('meetingId'), body)
  return c.json(updated)
})

boardRoutes.get('/resolutions', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from board_resolutions order by adopted_at desc nulls last, created_at desc`
  return c.json(rows)
})

boardRoutes.post('/resolutions', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'board_resolutions', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

boardRoutes.patch('/resolutions/:resolutionId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'board_resolutions', c.req.param('resolutionId'), body)
  return c.json(updated)
})