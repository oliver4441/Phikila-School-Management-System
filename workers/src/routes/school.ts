import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, upsertRow, pick } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const schoolRoutes = new Hono<{ Bindings: Bindings }>()

schoolRoutes.get('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const school = (await db`select * from school_info order by id limit 1`)[0]
  if (!school) return c.json(null)
  const [settings, brandingRows, contactRows] = await Promise.all([
    db`select key, value from school_settings`,
    db`select * from school_branding where school_id = ${school.id} limit 1`,
    db`select * from school_contact where school_id = ${school.id} limit 1`,
  ])
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  return c.json({
    ...school,
    settings: settingsMap,
    branding: brandingRows[0] ?? null,
    contact: contactRows[0] ?? null,
  })
})

schoolRoutes.post('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  try {
    const row = await insertRow(db, 'school_info', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

schoolRoutes.patch('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const school = (await db`select id from school_info order by id limit 1`)[0]
  if (!school) return c.json({ detail: 'School not found.' }, 404)
  const updated = await updateRowById(db, 'school_info', String(school.id), body)
  return c.json(updated)
})

schoolRoutes.patch('/settings', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  for (const [key, value] of Object.entries(body)) {
    await db`insert into school_settings (key, value) values (${key}, to_jsonb(${String(value)}::text)) on conflict (key) do update set value = excluded.value, updated_at = now()`
  }
  return c.json({ ok: true })
})

schoolRoutes.patch('/branding', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const school = (await db`select id from school_info order by id limit 1`)[0]
  const row = await upsertRow(db, 'school_branding', { school_id: school?.id ?? null, ...pick(body, 'primary_color', 'logo_url', 'accent_color') }, ['school_id'])
  return c.json(row)
})

schoolRoutes.patch('/contact', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const school = (await db`select id from school_info order by id limit 1`)[0]
  const row = await upsertRow(db, 'school_contact', { school_id: school?.id ?? null, ...pick(body, 'phone', 'email', 'physical_address') }, ['school_id'])
  return c.json(row)
})
