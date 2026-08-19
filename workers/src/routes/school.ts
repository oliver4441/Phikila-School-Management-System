import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, upsertRow, pick } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const schoolRoutes = new Hono<{ Bindings: Bindings }>()

schoolRoutes.get('/', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const school = (await db`select * from school_info where id = ${sid} limit 1`)[0]
  if (!school) return c.json(null)
  const [settings, brandingRows, contactRows] = await Promise.all([
    db`select key, value from school_settings where school_id = ${sid}`,
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
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  if (!ten.ctx.isSuperAdmin) return c.json({ detail: 'Forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'school_info', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

schoolRoutes.patch('/', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const school = (await db`select id from school_info where id = ${sid} limit 1`)[0]
  if (!school) return c.json({ detail: 'School not found.' }, 404)
  const updated = await updateRowById(db, 'school_info', String(school.id), body)
  return c.json(updated)
})

schoolRoutes.patch('/settings', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  for (const [key, value] of Object.entries(body)) {
    await db`insert into school_settings (school_id, key, value) values (${sid}, ${key}, to_jsonb(${String(value)}::text)) on conflict (school_id, key) do update set value = excluded.value, updated_at = now()`
  }
  return c.json({ ok: true })
})

schoolRoutes.patch('/branding', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const row = await upsertRow(db, 'school_branding', { school_id: sid, ...pick(body, 'primary_color', 'logo_url', 'accent_color') }, ['school_id'])
  return c.json(row)
})

schoolRoutes.patch('/contact', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const row = await upsertRow(db, 'school_contact', { school_id: sid, ...pick(body, 'phone', 'email', 'physical_address') }, ['school_id'])
  return c.json(row)
})