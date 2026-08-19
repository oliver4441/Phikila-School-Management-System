import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const admissionsRoutes = new Hono<{ Bindings: Bindings }>()

admissionsRoutes.get('/applications', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from admission_applications where school_id = ${sid} order by created_at desc`
  return c.json(rows)
})

admissionsRoutes.get('/applications/stats', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select status, count(*)::int as count from admission_applications where school_id = ${sid} group by status`
  const counts: Record<string, number> = {}
  for (const row of rows) counts[String(row.status)] = Number(row.count)
  return c.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0) })
})

admissionsRoutes.post('/applications', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'admission_applications', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

admissionsRoutes.get('/applications/:applicationId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const row = (await db`select * from admission_applications where id = ${c.req.param('applicationId')} and school_id = ${sid} limit 1`)[0]
  if (!row) return c.json({ detail: 'Application not found.' }, 404)
  return c.json(row)
})

admissionsRoutes.patch('/applications/:applicationId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from admission_applications where id = ${c.req.param('applicationId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Application not found.' }, 404)
  const updated = await updateRowById(db, 'admission_applications', c.req.param('applicationId'), { ...body, school_id: sid })
  return c.json(updated)
})

admissionsRoutes.post('/applications/:applicationId/enroll', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const applicationId = c.req.param('applicationId')
  const body = await c.req.json().catch(() => ({}))
  const application = (await db`select * from admission_applications where id = ${applicationId} and school_id = ${sid} limit 1`)[0]
  if (!application) return c.json({ detail: 'Application not found.' }, 404)

  const [{ n }] = await db`select count(*)::int as n from students where school_id = ${sid}`
  const admissionNumber = `ADM-${String((n ?? 0) + 1).padStart(4, '0')}`

  let student: Record<string, unknown>
  try {
    const rows = await db`
      insert into students (school_id, admission_number, first_name, middle_name, last_name, gender, date_of_birth)
      values (
        ${sid},
        ${admissionNumber},
        ${application.first_name},
        ${application.middle_name ?? null},
        ${application.last_name},
        coalesce(nullif(${application.gender ?? ''}, ''), 'Unspecified'),
        coalesce(${application.date_of_birth ?? null}, current_date)
      )
      returning *
    `
    student = rows[0]
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }

  await db`
    insert into enrollment_records (school_id, student_id, application_id, admission_date, level, stream, academic_year, admission_type, notes, created_by)
    values (${sid}, ${student.id}, ${application.id}, ${body.admission_date ?? new Date().toISOString().slice(0, 10)}, coalesce(nullif(${application.applying_for_level ?? ''}, ''), null), ${body.stream ?? null}, ${body.academic_year ?? null}, 'new', ${body.notes ?? null}, ${ten.ctx.user.id})
  `

  await db`update admission_applications set status = 'enrolled' where id = ${applicationId} and school_id = ${sid}`
  return c.json({ student, status: 'enrolled' }, 201)
})

admissionsRoutes.get('/enrollments', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from enrollment_records where school_id = ${sid} order by admission_date desc`
  return c.json(rows)
})