import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { deleteRowById, insertRow } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const examinationsRoutes = new Hono<{ Bindings: Bindings }>()

const EXAM_SELECT = `
  select id, coalesce(school_id, 1) as school_id, coalesce(series_id, 0) as series_id,
         name, description, coalesce(exam_date, start_date) as exam_date,
         coalesce(total_marks, 100) as total_marks, coalesce(passing_marks, 50) as passing_marks,
         status, created_at
  from examinations
`

const ENTRY_SELECT = `
  select e.id, es.examination_id as exam_id, e.student_id,
         coalesce(es.subject_id, 0) as subject_id, e.score, e.grade, e.remark as remarks
  from exam_entries e
  join exam_subjects es on es.id = e.exam_subject_id
`

// Series
examinationsRoutes.get('/series', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(
    `select id, coalesce(school_id, 1) as school_id, name, academic_year_id, term_id, status, created_at
     from exam_series where school_id = ${sid} order by id desc`,
  )
  return c.json(rows)
})

examinationsRoutes.post('/series', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'exam_series', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

// Grade scale
examinationsRoutes.get('/grade-scale', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(
    `select id, coalesce(school_id, 1) as school_id, grade, min_score, max_score, points, description
     from grade_scale where school_id = ${sid} order by min_score desc`,
  )
  return c.json(rows)
})

examinationsRoutes.post('/grade-scale', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'grade_scale', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

// Examinations
examinationsRoutes.get('/', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const seriesId = c.req.query('series_id')
  const rows = await db.query(
    `${EXAM_SELECT} ${seriesId ? `where series_id = $1 and school_id = ${sid}` : `where school_id = ${sid}`} order by created_at desc`,
    seriesId ? [seriesId] : [],
  )
  return c.json(rows)
})

examinationsRoutes.get('/:examId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(`${EXAM_SELECT} where id = $1 and school_id = ${sid} limit 1`, [c.req.param('examId')])
  if (!rows[0]) return c.json({ detail: 'Examination not found.' }, 404)
  return c.json(rows[0])
})

examinationsRoutes.post('/', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  if (!(body as Record<string, unknown>).name) return jsonError(c, 'name is required.', 400)
  try {
    const row = await insertRow(db, 'examinations', { school_id: sid, ...body })
    const [exam] = await db.query(`${EXAM_SELECT} where id = $1 and school_id = ${sid}`, [row.id])
    return c.json(exam, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

examinationsRoutes.delete('/:examId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const ok = await db.query(`select 1 from examinations where id = $1 and school_id = ${sid}`, [c.req.param('examId')])
  if (!ok[0]) return c.json({ detail: 'Examination not found.' }, 404)
  await deleteRowById(db, 'examinations', c.req.param('examId'))
  return c.body(null, 204)
})

// Score entry
examinationsRoutes.post('/:examId/entries', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const examId = c.req.param('examId')
  const examOk = await db.query(`select 1 from examinations where id = $1 and school_id = ${sid}`, [examId])
  if (!examOk[0]) return c.json({ detail: 'Examination not found.' }, 404)
  const entries = Array.isArray((body as Record<string, unknown>).entries)
    ? ((body as Record<string, unknown>).entries as Record<string, unknown>[])
    : []
  let created = 0
  let updated = 0
  for (const entry of entries) {
    const studentId = entry.student_id
    const subjectId = entry.subject_id
    if (studentId == null || subjectId == null) continue
    const subjRows = await db.query(
      `insert into exam_subjects (examination_id, subject_id)
       values ($1, $2)
       on conflict (examination_id, subject_id) do update set subject_id = excluded.subject_id
       returning id`,
      [examId, subjectId],
    )
    const examSubjectId = subjRows[0].id
    const upserted = await db.query(
      `insert into exam_entries (exam_subject_id, student_id, score, grade, remark)
       values ($1, $2, $3, $4, $5)
       on conflict (exam_subject_id, student_id)
       do update set score = excluded.score, grade = excluded.grade, remark = excluded.remark
       returning (xmax = 0) as inserted`,
      [examSubjectId, studentId, entry.score ?? null, entry.grade ?? null, entry.remarks ?? null],
    )
    if (upserted[0]?.inserted) created++
    else updated++
  }
  return c.json({ created, updated })
})

examinationsRoutes.get('/:examId/entries', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const examId = c.req.param('examId')
  const subjectId = c.req.query('subject_id')
  const studentId = c.req.query('student_id')
  const where = [`es.examination_id = $1`, `es.examination_id in (select id from examinations where school_id = ${sid})`]
  const params: unknown[] = [examId]
  if (subjectId) {
    params.push(subjectId)
    where.push(`es.subject_id = $${params.length}`)
  }
  if (studentId) {
    params.push(studentId)
    where.push(`e.student_id = $${params.length}`)
  }
  const rows = await db.query(`${ENTRY_SELECT} where ${where.join(' and ')} order by e.student_id`, params)
  return c.json(rows)
})

// Results
examinationsRoutes.get('/:examId/results', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const examId = c.req.param('examId')
  const classId = c.req.query('class_id')

  const scoreRows = (await db.query(
    `select e.student_id, es.subject_id, e.score, e.grade
     from exam_entries e
     join exam_subjects es on es.id = e.exam_subject_id
     join students s on s.id = e.student_id
     where es.examination_id = $1 and es.examination_id in (select id from examinations where school_id = ${sid}) ${classId ? 'and s.current_class_id = $2' : ''}
     order by e.student_id`,
    classId ? [examId, classId] : [examId],
  )) as Record<string, unknown>[]

  const studentIds = [...new Set(scoreRows.map((r) => r.student_id))]
  const students = new Map<string, Record<string, unknown>>()
  if (studentIds.length) {
    const rows = (await db.query(
      `select id, first_name, last_name, admission_number from students where id = any($1) and school_id = ${sid}`,
      [studentIds],
    )) as Record<string, unknown>[]
    for (const r of rows) students.set(String(r.id), r)
  }

  const scales = (await db.query(
    `select grade, min_score, max_score, points from grade_scale where school_id = ${sid} order by min_score desc`,
  )) as Record<string, unknown>[]

  function gradeFor(score: number): string | undefined {
    for (const g of scales) {
      if (score >= Number(g.min_score)) return String(g.grade)
    }
    return scales.length ? String(scales[scales.length - 1].grade) : undefined
  }

  const byStudent = new Map<string, { subject_id: number; score: number; grade?: string }[]>()
  for (const r of scoreRows) {
    const key = String(r.student_id)
    const list = byStudent.get(key) ?? []
    list.push({ subject_id: Number(r.subject_id), score: Number(r.score ?? 0), grade: (r.grade as string) ?? undefined })
    byStudent.set(key, list)
  }

  const results = [...byStudent.entries()].map(([sid, subjectScores]) => {
    const stu = students.get(sid) ?? {}
    const totalScore = subjectScores.reduce((a, s) => a + s.score, 0)
    const average = subjectScores.length ? totalScore / subjectScores.length : 0
    return {
      student_id: Number(sid),
      student_name: `${stu.first_name ?? ''} ${stu.last_name ?? ''}`.trim(),
      admission_number: stu.admission_number ?? '',
      subject_scores: subjectScores,
      total_score: Math.round(totalScore * 100) / 100,
      average: Math.round(average * 100) / 100,
      grade: gradeFor(average),
    }
  })
  results.sort((a, b) => b.average - a.average)
  results.forEach((r, i) => { (r as { position?: number }).position = i + 1 })

  return c.json(results)
})