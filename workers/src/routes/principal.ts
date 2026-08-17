import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const principalRoutes = new Hono<{ Bindings: Bindings }>()

principalRoutes.get('/announcements', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from announcements order by published_at desc nulls last, created_at desc`
  return c.json(rows)
})

principalRoutes.post('/announcements', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'announcements', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

principalRoutes.patch('/announcements/:announcementId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'announcements', c.req.param('announcementId'), body)
  return c.json(updated)
})

principalRoutes.delete('/announcements/:announcementId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'announcements', c.req.param('announcementId'))
  return c.body(null, 204)
})

principalRoutes.get('/insights', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from principal_insights order by created_at desc`
  return c.json(rows)
})

principalRoutes.post('/insights', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'principal_insights', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

principalRoutes.patch('/insights/:insightId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'principal_insights', c.req.param('insightId'), body)
  return c.json(updated)
})