import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const academicsRoutes = new Hono<{ Bindings: Bindings }>()

academicsRoutes.get('/years', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from academic_years order by id desc`
  return c.json(rows)
})

academicsRoutes.get('/years/:yearId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const row = (await createSql(c.env)`select * from academic_years where id = ${c.req.param('yearId')} limit 1`)[0]
  if (!row) return c.json({ detail: 'Academic year not found.' }, 404)
  return c.json(row)
})

academicsRoutes.post('/years', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'academic_years', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

academicsRoutes.get('/terms', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from terms order by id`
  return c.json(rows)
})

academicsRoutes.get('/terms/:termId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const row = (await createSql(c.env)`select * from terms where id = ${c.req.param('termId')} limit 1`)[0]
  if (!row) return c.json({ detail: 'Term not found.' }, 404)
  return c.json(row)
})

academicsRoutes.post('/terms', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'terms', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

academicsRoutes.get('/levels', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from levels order by sort_order`
  return c.json(rows)
})

academicsRoutes.get('/levels/:levelId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const row = (await createSql(c.env)`select * from levels where id = ${c.req.param('levelId')} limit 1`)[0]
  if (!row) return c.json({ detail: 'Level not found.' }, 404)
  return c.json(row)
})

academicsRoutes.post('/levels', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'levels', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

academicsRoutes.get('/levels/:levelId/streams', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from streams where level_id = ${c.req.param('levelId')} order by id`
  return c.json(rows)
})

academicsRoutes.get('/streams/:streamId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const row = (await createSql(c.env)`select * from streams where id = ${c.req.param('streamId')} limit 1`)[0]
  if (!row) return c.json({ detail: 'Stream not found.' }, 404)
  return c.json(row)
})

academicsRoutes.post('/streams', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'streams', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})
