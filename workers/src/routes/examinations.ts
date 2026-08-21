import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const examinationsRoutes = new Hono<{ Bindings: Bindings }>()

examinationsRoutes.get('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from examinations order by created_at desc`
  return c.json(rows)
})

examinationsRoutes.post('/', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'examinations', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

examinationsRoutes.get('/:examId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const examId = c.req.param('examId')
  const exam = (await db`select * from examinations where id = ${examId} limit 1`)[0]
  if (!exam) return c.json({ detail: 'Examination not found.' }, 404)
  const subjects = await db`select * from exam_subjects where examination_id = ${examId}`
  const entries = await db`
    select e.* from exam_entries e
    join exam_subjects s on s.id = e.exam_subject_id
    where s.examination_id = ${examId}
  `
  return c.json({ ...exam, subjects, entries })
})

examinationsRoutes.patch('/:examId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const updated = await updateRowById(db, 'examinations', c.req.param('examId'), body)
  return c.json(updated)
})

examinationsRoutes.delete('/:examId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'examinations', c.req.param('examId'))
  return c.body(null, 204)
})
