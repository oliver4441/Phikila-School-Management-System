import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const studentsRoutes = new Hono<{ Bindings: Bindings }>()

studentsRoutes.get('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from students order by id`
  return c.json(rows)
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

  const guardians = Array.isArray(body.guardians) ? body.guardians : []
  if (guardians.length > 0) {
    for (const g of guardians as Record<string, unknown>[]) {
      await db`
        insert into guardians (student_id, parent_name, relationship_to_student, phone_number, email, address, is_emergency_contact)
        values (${student.id}, ${g.parent_name ?? ''}, ${g.relationship_to_student ?? ''}, ${g.phone_number ?? ''}, ${g.email ?? null}, ${g.address ?? null}, ${g.is_emergency_contact ?? false})
      `
    }
  }
  return c.json({ ...student, guardians }, 201)
})

studentsRoutes.get('/:studentId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const studentId = c.req.param('studentId')
  const student = (await db`select * from students where id = ${studentId} limit 1`)[0]
  if (!student) return c.json({ detail: 'Student not found.' }, 404)
  const guardians = await db`select * from guardians where student_id = ${studentId}`
  return c.json({ ...student, guardians })
})

studentsRoutes.patch('/:studentId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const updated = await updateRowById(db, 'students', c.req.param('studentId'), body)
  return c.json(updated)
})

studentsRoutes.delete('/:studentId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'students', c.req.param('studentId'))
  return c.body(null, 204)
})
