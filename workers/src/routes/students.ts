import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { deleteRowById, insertRow } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const studentsRoutes = new Hono<{ Bindings: Bindings }>()

const STUDENT_SELECT = `
  select id, admission_number, first_name, middle_name, last_name,
         coalesce(preferred_name, first_name) as preferred_name,
         date_of_birth, gender, nationality, photo_url,
         school_id, email, phone, address, national_id,
         current_class_id, level_id, stream_id, admission_date,
         status, status_reason, status_date, created_at, updated_at
  from students
`

const GUARDIAN_SELECT = `
  select id, student_id,
         parent_name as full_name,
         relationship_to_student as relationship,
         phone_number as phone,
         alt_phone, email, address, occupation,
         is_emergency_contact
  from guardians
`

function guardianInsertBody(body: Record<string, unknown>): Record<string, unknown> {
  return {
    parent_name: body.full_name ?? body.parent_name,
    relationship_to_student: body.relationship ?? body.relationship_to_student,
    phone_number: body.phone ?? body.phone_number,
    email: body.email,
    address: body.address,
    alt_phone: body.alt_phone,
    occupation: body.occupation,
    is_emergency_contact: body.is_emergency_contact ?? false,
  }
}

studentsRoutes.get('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const q = c.req.query()
  const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(q.page_size ?? '20', 10) || 20))
  const offset = (page - 1) * pageSize

  const where: string[] = []
  const params: unknown[] = []
  if (q.search) {
    params.push(`%${q.search}%`)
    where.push(
      `(lower(first_name) like lower($${params.length}) or lower(last_name) like lower($${params.length}) or lower(coalesce(preferred_name,'')) like lower($${params.length}) or lower(admission_number) like lower($${params.length}))`,
    )
  }
  if (q.status) {
    params.push(q.status)
    where.push(`lower(status) = lower($${params.length})`)
  }
  for (const key of ['class_id', 'level_id', 'stream_id'] as const) {
    if (q[key]) {
      params.push(q[key])
      where.push(`${key} = $${params.length}`)
    }
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''

  const countRows = await db.query(`select count(*)::int as n from students ${whereSql}`, params)
  const total = countRows[0]?.n ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  const rows = await db.query(
    `${STUDENT_SELECT} ${whereSql} order by first_name, last_name limit ${pageSize} offset ${offset}`,
    params,
  )
  const items = rows as Record<string, unknown>[]

  const ids = items.map((r) => r.id)
  const guardiansByStudent = new Map<string, Record<string, unknown>[]>()
  if (ids.length) {
    const gs = await db.query(
      `${GUARDIAN_SELECT} where student_id = any($1) order by id`,
      [ids],
    )
    for (const g of gs as Record<string, unknown>[]) {
      const list = guardiansByStudent.get(String(g.student_id)) ?? []
      list.push(g)
      guardiansByStudent.set(String(g.student_id), list)
    }
  }
  for (const row of items) row.guardians = guardiansByStudent.get(String(row.id)) ?? []

  return c.json({ items, total, page, page_size: pageSize, pages })
})

studentsRoutes.post('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)

  let admissionNumber = body.admission_number
  if (!admissionNumber) {
    const [{ n }] = await db`select count(*)::int as n from students`
    admissionNumber = `ADM-${String((n ?? 0) + 1).padStart(4, '0')}`
  }

  let student: Record<string, unknown>
  try {
    student = await insertRow(db, 'students', { ...body, admission_number: admissionNumber })
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }

  const guardians = Array.isArray(body.guardians) ? (body.guardians as Record<string, unknown>[]) : []
  for (const g of guardians) {
    await insertRow(db, 'guardians', { student_id: student.id, ...guardianInsertBody(g) })
  }

  const [full] = await db.query(`${STUDENT_SELECT} where id = $1`, [student.id])
  const gs = await db.query(`${GUARDIAN_SELECT} where student_id = $1`, [student.id])
  return c.json({ ...full, guardians: gs }, 201)
})

studentsRoutes.get('/:studentId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const studentId = c.req.param('studentId')
  const rows = await db.query(`${STUDENT_SELECT} where id = $1 limit 1`, [studentId])
  if (!rows[0]) return c.json({ detail: 'Student not found.' }, 404)
  const gs = await db.query(`${GUARDIAN_SELECT} where student_id = $1`, [studentId])
  return c.json({ ...rows[0], guardians: gs })
})

studentsRoutes.patch('/:studentId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const allowed = [
    'admission_number', 'first_name', 'middle_name', 'last_name', 'preferred_name',
    'date_of_birth', 'gender', 'nationality', 'photo_url', 'status',
    'school_id', 'email', 'phone', 'address', 'national_id',
    'current_class_id', 'level_id', 'stream_id', 'admission_date',
    'status_reason', 'status_date',
  ]
  const data: Record<string, unknown> = {}
  for (const k of allowed) if ((body as Record<string, unknown>)[k] !== undefined) data[k] = (body as Record<string, unknown>)[k]
  if (!Object.keys(data).length) return c.json({ detail: 'No fields to update.' }, 400)
  const updated = await updateStudent(db, c.req.param('studentId'), data)
  if (!updated) return c.json({ detail: 'Student not found.' }, 404)
  const gs = await db.query(`${GUARDIAN_SELECT} where student_id = $1`, [c.req.param('studentId')])
  return c.json({ ...updated, guardians: gs })
})

async function updateStudent(db: ReturnType<typeof createSql>, id: string, data: Record<string, unknown>) {
  const keys = Object.keys(data)
  const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
  const rows = await db.query(`update students set ${sets}, updated_at = now() where id = $${keys.length + 1} returning *`, [
    ...keys.map((k) => data[k]),
    id,
  ])
  return rows[0]
}

studentsRoutes.delete('/:studentId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'students', c.req.param('studentId'))
  return c.body(null, 204)
})

studentsRoutes.get('/:studentId/guardians', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const gs = await db.query(`${GUARDIAN_SELECT} where student_id = $1 order by id`, [c.req.param('studentId')])
  return c.json(gs)
})

studentsRoutes.post('/:studentId/guardians', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const row = await insertRow(db, 'guardians', {
    student_id: c.req.param('studentId'),
    ...guardianInsertBody(body as Record<string, unknown>),
  })
  return c.json(row, 201)
})

studentsRoutes.get('/:studentId/enrollment', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const rows = await db.query(
    `select id, student_id, academic_year_id, term_id, class_id, level_id, stream_id, status, enrollment_date
     from enrollment_records where student_id = $1 order by id desc`,
    [c.req.param('studentId')],
  )
  return c.json(rows)
})

studentsRoutes.post('/:studentId/enrollment', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const row = await insertRow(db, 'enrollment_records', { student_id: c.req.param('studentId'), ...body })
  return c.json(row, 201)
})

studentsRoutes.get('/:studentId/documents', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const rows = await db.query(
    `select id, student_id, document_type, title, description, file_url, file_size, mime_type, created_at
     from student_documents where student_id = $1 order by id desc`,
    [c.req.param('studentId')],
  )
  return c.json(rows)
})

studentsRoutes.post('/:studentId/documents', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const row = await insertRow(db, 'student_documents', { student_id: c.req.param('studentId'), ...body })
  return c.json(row, 201)
})