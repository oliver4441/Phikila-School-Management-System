import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const schedulingRoutes = new Hono<{ Bindings: Bindings }>()

const NOT_AVAILABLE = 'Timetable generation and AI assistant features are not available on this deployment.'

function solverEnabled(env: Bindings): boolean {
  return env.SOLVER_ENABLED === 'true'
}

const TEACHER_SELECT = `
  select id, name, coalesce(code, '') as code, email,
         coalesce(department, null) as department,
         coalesce(max_lessons_per_day, max_periods, 6) as max_lessons_per_day,
         coalesce(max_consecutive, 2) as max_consecutive,
         workload_target,
         coalesce(unavailable, '{}'::jsonb) as unavailable,
         coalesce(is_active, true) as is_active
  from tt_teachers
`

const SUBJECT_SELECT = `
  select id, name, coalesce(code, '') as code, coalesce(colour, '') as colour,
         coalesce(prefers_morning, false) as prefers_morning,
         coalesce(prefers_double, false) as prefers_double,
         coalesce(spread_across_week, true) as spread_across_week,
         required_room_type
  from tt_subjects
`

const ROOM_SELECT = `
  select id, name, coalesce(code, '') as code, building,
         coalesce(capacity, 0) as capacity,
         coalesce(room_type, 'Classroom') as room_type,
         coalesce(is_accessible, false) as is_accessible,
         coalesce(unavailable, '{}'::jsonb) as unavailable
  from tt_rooms
`

const CLASS_SELECT = `
  select id, name, coalesce(code, '') as code, coalesce(grade, level) as grade,
         coalesce(student_count, size, 0) as student_count,
         coalesce(home_room_id, class_teacher_id) as home_room_id,
         coalesce(unavailable, '{}'::jsonb) as unavailable
  from tt_classes
`

const VERSION_SELECT = `
  select id, coalesce(version_number, id::int) as "number",
         coalesce(label, description) as label, coalesce(status, 'draft') as status,
         coalesce(quality, '{}'::jsonb) as quality, coalesce(stats, '{}'::jsonb) as stats,
         created_by, created_at,
         coalesce(published_at, case when is_current then created_at else null end) as published_at
  from tt_versions
`

const LESSON_SELECT = `
  select l.id, l.version_id,
         case when l.requirement_id ~ '^[0-9]+$' then l.requirement_id::bigint else null end as requirement_id,
         coalesce(l.class_id, 0) as class_id, coalesce(l.subject_id, 0) as subject_id,
         l.teacher_id, l.room_id,
         coalesce(l.day_index, 0) as day_index,
         coalesce(l.period_index, l.period, 0) as period_index,
         coalesce(l.duration, 1) as duration,
         coalesce(l.is_locked, false) as is_locked
  from tt_lessons l
`

const AUDIT_SELECT = `
  select a.id, a.created_at as at, u.email as actor, a.action, a.entity,
         case when a.entity_id ~ '^[0-9]+$' then a.entity_id::bigint else null end as entity_id,
         coalesce(a.summary, a.detail->>'summary', a.action) as summary,
         a."before", a."after"
  from tt_audit a left join users u on u.id = a.user_id
`

async function nextNumericId(db: ReturnType<typeof createSql>, table: string): Promise<string> {
  const [r] = await db.query(`select coalesce(max(id::bigint), 0) + 1 as n from ${table} where id ~ '^[0-9]+$'`)
  return String(r?.n ?? 1)
}

async function latestVersion(db: ReturnType<typeof createSql>, sid: number): Promise<Record<string, unknown> | null> {
  const rows = await db.query(`${VERSION_SELECT} where school_id = ${sid} order by is_current desc, published_at desc nulls last, created_at desc limit 1`)
  return (rows[0] as Record<string, unknown>) ?? null
}

schedulingRoutes.get('/me', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const ctx = ten.ctx
  const isAdmin = ten.ctx.role === 'admin' || ten.ctx.isSuperAdmin
  const role = ten.ctx.isSuperAdmin ? 'super_admin' : isAdmin ? 'admin' : ten.ctx.role
  return c.json({
    user_id: ctx.user.id,
    email: ctx.user.email,
    school_id: ctx.school?.id ?? null,
    role,
    teacher_id: null,
    class_id: null,
    solver_available: solverEnabled(c.env),
  })
})

// Calendar
schedulingRoutes.get('/calendar', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const days = await db.query(
    `select id, day_of_week as index, name, coalesce(is_active, true) as is_active from tt_days where school_id = ${sid} order by day_of_week`,
  )
  const periods = await db.query(
    `select id, coalesce(sort_index, id) as index, name, start_time, end_time,
            coalesce(is_teaching, not coalesce(is_break, false)) as is_teaching
     from tt_periods where school_id = ${sid} order by index`,
  )
  return c.json({ days, periods })
})

schedulingRoutes.put('/calendar', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const days = Array.isArray((body as Record<string, unknown>).days) ? ((body as Record<string, unknown>).days as Record<string, unknown>[]) : []
  const periods = Array.isArray((body as Record<string, unknown>).periods) ? ((body as Record<string, unknown>).periods as Record<string, unknown>[]) : []
  try {
    await db.query(`delete from tt_days where school_id = ${sid}`)
    for (const d of days) {
      await db.query(`insert into tt_days (school_id, name, day_of_week, is_active) values ($1, $2, $3, $4)`, [
        sid,
        d.name,
        d.index ?? 0,
        d.is_active ?? true,
      ])
    }
    await db.query(`delete from tt_periods where school_id = ${sid}`)
    for (const p of periods) {
      await db.query(
        `insert into tt_periods (school_id, name, start_time, end_time, sort_index, is_teaching, is_break) values ($1, $2, $3, $4, $5, $6, $7)`,
        [sid, p.name, p.start_time ?? null, p.end_time ?? null, p.index ?? 0, p.is_teaching ?? true, !(p.is_teaching ?? true)],
      )
    }
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
  const daysOut = await db.query(`select id, day_of_week as index, name, coalesce(is_active, true) as is_active from tt_days where school_id = ${sid} order by day_of_week`)
  const periodsOut = await db.query(
    `select id, coalesce(sort_index, id) as index, name, start_time, end_time,
            coalesce(is_teaching, not coalesce(is_break, false)) as is_teaching
     from tt_periods where school_id = ${sid} order by index`,
  )
  return c.json({ days: daysOut, periods: periodsOut })
})

// Resources
const resourceDefs: { resource: string; table: string; select: string; allowed: string[] }[] = [
  { resource: 'teachers', table: 'tt_teachers', select: TEACHER_SELECT, allowed: ['name', 'email', 'code', 'department', 'max_lessons_per_day', 'max_consecutive', 'workload_target', 'unavailable', 'is_active'] },
  { resource: 'subjects', table: 'tt_subjects', select: SUBJECT_SELECT, allowed: ['name', 'code', 'colour', 'prefers_morning', 'prefers_double', 'spread_across_week', 'required_room_type'] },
  { resource: 'rooms', table: 'tt_rooms', select: ROOM_SELECT, allowed: ['name', 'code', 'building', 'capacity', 'room_type', 'is_accessible', 'unavailable'] },
  { resource: 'classes', table: 'tt_classes', select: CLASS_SELECT, allowed: ['name', 'code', 'grade', 'student_count', 'home_room_id', 'unavailable'] },
]

for (const { resource, table, select, allowed } of resourceDefs) {
  schedulingRoutes.get(`/${resource}`, async (c) => {
    const db = createSql(c.env)
    const ten = await resolveTenant(c, db)
    if ('error' in ten) return ten.error
    const sid = tenantSchoolId(ten.ctx)
    if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
    const rows = await db.query(`${select} where school_id = ${sid} order by id`)
    return c.json(rows)
  })

  schedulingRoutes.post(`/${resource}`, async (c) => {
    const db = createSql(c.env)
    const ten = await resolveTenant(c, db)
    if ('error' in ten) return ten.error
    const sid = tenantSchoolId(ten.ctx)
    if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
    const w = requireWrite(ten.ctx)
    if ('error' in w) return w.error
    const body = await c.req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    for (const k of allowed) if ((body as Record<string, unknown>)[k] !== undefined) data[k] = (body as Record<string, unknown>)[k]
    if (!data.name) return jsonError(c, 'name is required.', 400)
    data.school_id = sid
    try {
      const row = await insertRow(db, table, data)
      const [out] = await db.query(`${select} where id = $1 and school_id = ${sid}`, [row.id])
      return c.json(out, 201)
    } catch (err) {
      return jsonError(c, (err as Error).message, 400)
    }
  })

  schedulingRoutes.put(`/${resource}/:id`, async (c) => {
    const db = createSql(c.env)
    const ten = await resolveTenant(c, db)
    if ('error' in ten) return ten.error
    const sid = tenantSchoolId(ten.ctx)
    if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
    const w = requireWrite(ten.ctx)
    if ('error' in w) return w.error
    const body = await c.req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    for (const k of allowed) if ((body as Record<string, unknown>)[k] !== undefined) data[k] = (body as Record<string, unknown>)[k]
    if (!Object.keys(data).length) return c.json({ detail: 'No fields to update.' }, 400)
    data.school_id = sid
    const keys = Object.keys(data)
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const rows = await db.query(
      `update ${table} set ${sets}, updated_at = now() where id = $${keys.length + 1} and school_id = ${sid} returning *`,
      [...keys.map((k) => data[k]), c.req.param('id')],
    )
    if (!rows[0]) return c.json({ detail: 'Not found.' }, 404)
    const [out] = await db.query(`${select} where id = $1 and school_id = ${sid}`, [c.req.param('id')])
    return c.json(out)
  })

  schedulingRoutes.delete(`/${resource}/:id`, async (c) => {
    const db = createSql(c.env)
    const ten = await resolveTenant(c, db)
    if ('error' in ten) return ten.error
    const sid = tenantSchoolId(ten.ctx)
    if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
    const w = requireWrite(ten.ctx)
    if ('error' in w) return w.error
    await db.query(`delete from ${table} where id = $1 and school_id = ${sid}`, [c.req.param('id')])
    return c.body(null, 204)
  })
}

// Requirements
schedulingRoutes.get('/requirements', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = (await db.query(
    `select r.id, r.class_id, r.subject_id, r.teacher_id, r.room_id,
            r.periods_per_week, coalesce(r.double_periods, 0) as double_periods,
            c.name as class_name, s.name as subject_name, t.name as teacher_name, rm.name as room_name
     from tt_lesson_requirements r
     left join tt_classes c on c.id = r.class_id
     left join tt_subjects s on s.id = r.subject_id
     left join tt_teachers t on t.id = r.teacher_id
     left join tt_rooms rm on rm.id = r.room_id
     where r.school_id = ${sid}
     order by r.created_at`,
  )) as Record<string, unknown>[]
  return c.json(rows.map((r) => ({ ...r, id: Number(r.id) })))
})

schedulingRoutes.post('/requirements', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  if ((body as Record<string, unknown>).class_id == null || (body as Record<string, unknown>).subject_id == null) {
    return jsonError(c, 'class_id and subject_id are required.', 400)
  }
  try {
    const id = await nextNumericId(db, 'tt_lesson_requirements')
    await db.query(
      `insert into tt_lesson_requirements (id, school_id, class_id, subject_id, teacher_id, room_id, periods_per_week, double_periods, room_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        sid,
        (body as Record<string, unknown>).class_id,
        (body as Record<string, unknown>).subject_id,
        (body as Record<string, unknown>).teacher_id ?? null,
        (body as Record<string, unknown>).room_id ?? null,
        (body as Record<string, unknown>).periods_per_week ?? 1,
        (body as Record<string, unknown>).double_periods ?? 0,
        (body as Record<string, unknown>).room_type ?? null,
      ],
    )
    const rows = await db.query(
      `select r.id, r.class_id, r.subject_id, r.teacher_id, r.room_id, r.periods_per_week,
              coalesce(r.double_periods, 0) as double_periods,
              c.name as class_name, s.name as subject_name, t.name as teacher_name, rm.name as room_name
       from tt_lesson_requirements r
       left join tt_classes c on c.id = r.class_id
       left join tt_subjects s on s.id = r.subject_id
       left join tt_teachers t on t.id = r.teacher_id
       left join tt_rooms rm on rm.id = r.room_id
       where r.id = $1 and r.school_id = ${sid}`,
      [id],
    )
    return c.json({ ...rows[0], id: Number(id) }, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

schedulingRoutes.delete('/requirements/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  await db.query(`delete from tt_lesson_requirements where id = $1 and school_id = ${sid}`, [c.req.param('id')])
  return c.body(null, 204)
})

// Constraints
schedulingRoutes.get('/constraints', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(`select * from tt_constraints where school_id = ${sid} order by id`)
  return c.json(rows)
})

schedulingRoutes.post('/constraints', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  if (!(body as Record<string, unknown>).type) return jsonError(c, 'type is required.', 400)
  try {
    const row = await insertRow(db, 'tt_constraints', { school_id: sid, ...(body as Record<string, unknown>) })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

schedulingRoutes.delete('/constraints/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  await db.query(`delete from tt_constraints where id = $1 and school_id = ${sid}`, [c.req.param('id')])
  return c.body(null, 204)
})

// Versions
schedulingRoutes.get('/versions', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(`${VERSION_SELECT} where school_id = ${sid} order by created_at desc`)
  return c.json(rows)
})

schedulingRoutes.get('/versions/current', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const version = await latestVersion(db, sid)
  return c.json(version)
})

schedulingRoutes.get('/versions/:versionId/lessons', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(
    `${LESSON_SELECT} where l.version_id = $1 and l.version_id in (select id from tt_versions where school_id = ${sid}) order by day_index, period_index, id`,
    [c.req.param('versionId')],
  )
  return c.json(rows)
})

schedulingRoutes.post('/versions/:versionId/lessons', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const versionId = c.req.param('versionId')
  if ((body as Record<string, unknown>).requirement_id == null) {
    return jsonError(c, 'requirement_id is required.', 400)
  }
  try {
    const [row] = await db.query(
      `insert into tt_lessons (version_id, requirement_id, class_id, subject_id, teacher_id, room_id, day_index, period_index, duration)
       select $1, $2, r.class_id, r.subject_id, r.teacher_id, r.room_id, $3, $4, $5
       from tt_lesson_requirements r
       where r.id = $2 and r.school_id = ${sid}
         and $1 in (select id from tt_versions where school_id = ${sid})
       returning *`,
      [
        versionId,
        String((body as Record<string, unknown>).requirement_id),
        (body as Record<string, unknown>).day_index ?? 0,
        (body as Record<string, unknown>).period_index ?? 0,
        (body as Record<string, unknown>).duration ?? 1,
      ],
    )
    if (!row) return jsonError(c, 'Requirement not found.', 404)
    const [out] = await db.query(`${LESSON_SELECT} where l.id = $1 and l.version_id in (select id from tt_versions where school_id = ${sid})`, [row.id])
    return c.json(out, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

async function computeConflicts(
  db: ReturnType<typeof createSql>,
  versionId: string,
  sid: number,
): Promise<Record<string, unknown>[]> {
  const lessons = (await db.query(
    `select l.id, l.class_id, l.teacher_id, l.room_id,
            coalesce(l.day_index, 0) as day_index, coalesce(l.period_index, l.period, 0) as period_index
     from tt_lessons l
     where l.version_id = $1 and l.version_id in (select id from tt_versions where school_id = ${sid})`,
    [versionId],
  )) as Record<string, unknown>[]
  const classNames = new Map<number, string>()
  for (const r of (await db.query(`select id, name from tt_classes where school_id = ${sid}`)) as Record<string, unknown>[]) {
    classNames.set(Number(r.id), String(r.name))
  }
  const slots = new Map<string, Record<string, unknown>[]>()
  for (const l of lessons) {
    const key = `${l.day_index}:${l.period_index}`
    const bucket = slots.get(key)
    if (bucket) bucket.push(l)
    else slots.set(key, [l])
  }
  const conflicts: Record<string, unknown>[] = []
  const push = (severity: string, kind: string, message: string, ids: number[], day: number | null, period: number | null) =>
    conflicts.push({ severity, kind, message, lesson_ids: ids, day, period })
  for (const [, group] of slots) {
    const byClass = new Map<number | string, number[]>()
    const byTeacher = new Map<number | string, number[]>()
    const byRoom = new Map<number | string, number[]>()
    for (const l of group) {
      const ck = String(l.class_id ?? 0)
      const tk = l.teacher_id == null ? 'none' : String(l.teacher_id)
      const rk = l.room_id == null ? 'none' : String(l.room_id)
      byClass.set(ck, [...(byClass.get(ck) ?? []), Number(l.id)])
      byTeacher.set(tk, [...(byTeacher.get(tk) ?? []), Number(l.id)])
      byRoom.set(rk, [...(byRoom.get(rk) ?? []), Number(l.id)])
    }
    const day = group[0] ? Number(group[0].day_index) : null
    const period = group[0] ? Number(group[0].period_index) : null
    for (const [cls, ids] of byClass) {
      if (ids.length > 1)
        push('hard', 'class_clash', `${classNames.get(Number(cls)) ?? 'Class'} has ${ids.length} lessons at the same time`, ids, day, period)
    }
    for (const [tch, ids] of byTeacher) {
      if (tch !== 'none' && ids.length > 1)
        push('hard', 'teacher_clash', `Teacher #${String(tch)} has ${ids.length} lessons at the same time`, ids, day, period)
    }
    for (const [room, ids] of byRoom) {
      if (room !== 'none' && ids.length > 1)
        push('hard', 'room_clash', `Room #${String(room)} has ${ids.length} lessons at the same time`, ids, day, period)
    }
  }
  return conflicts
}

schedulingRoutes.get('/versions/:versionId/conflicts', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const conflicts = await computeConflicts(db, c.req.param('versionId'), sid)
  return c.json(conflicts)
})

schedulingRoutes.get('/versions/:versionId/unassigned', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const versionId = c.req.param('versionId')
  const reqs = (await db.query(
    `select r.id, r.subject_id, r.class_id, r.teacher_id, r.room_id, r.periods_per_week,
            coalesce(r.double_periods, 0) as double_periods,
            s.name as subject_name, coalesce(s.colour, '') as subject_colour,
            c.name as class_name, t.name as teacher_name, rm.name as room_name
     from tt_lesson_requirements r
     left join tt_subjects s on s.id = r.subject_id
     left join tt_classes c on c.id = r.class_id
     left join tt_teachers t on t.id = r.teacher_id
     left join tt_rooms rm on rm.id = r.room_id
     where r.school_id = ${sid}
     order by r.created_at`,
  )) as Record<string, unknown>[]
  const placedRows = (await db.query(
    `select l.requirement_id, count(*)::int as n
     from tt_lessons l
     where l.version_id = $1 and l.version_id in (select id from tt_versions where school_id = ${sid})
       and l.requirement_id ~ '^[0-9]+$'
     group by l.requirement_id`,
    [versionId],
  )) as Record<string, unknown>[]
  const placed = new Map(placedRows.map((r) => [String(r.requirement_id), Number(r.n)]))
  const out = reqs.map((r) => {
    const p = placed.get(String(r.id)) ?? 0
    const periods = Number(r.periods_per_week) ?? 1
    return {
      requirement_id: Number(r.id),
      subject_id: r.subject_id,
      subject_name: r.subject_name,
      subject_colour: r.subject_colour ?? '',
      class_id: r.class_id,
      class_name: r.class_name,
      teacher_id: r.teacher_id,
      teacher_name: r.teacher_name,
      room_id: r.room_id,
      room_name: r.room_name,
      periods_per_week: periods,
      placed: p,
      remaining: Math.max(periods - p, 0),
      requires_double: Number(r.double_periods ?? 0) > 0,
    }
  })
  return c.json(out)
})

schedulingRoutes.post('/versions/:versionId/assign-rooms', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const rows = await db.query(
    `update tt_lessons l set room_id = r.room_id, updated_at = now()
     from tt_lesson_requirements r
     where r.id = l.requirement_id and r.school_id = ${sid}
       and l.room_id is null and r.room_id is not null
       and l.version_id = $1 and l.version_id in (select id from tt_versions where school_id = ${sid})
     returning l.id`,
    [c.req.param('versionId')],
  )
  return c.json({ assigned: rows.length })
})

schedulingRoutes.post('/versions/:versionId/publish', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const versionId = c.req.param('versionId')
  await db.query(`update tt_versions set is_current = false where id <> $1 and school_id = ${sid}`, [versionId])
  const rows = await db.query(
    `update tt_versions set status = 'published', is_current = true,
            published_at = coalesce(published_at, now()), updated_at = now()
     where id = $1 and school_id = ${sid} returning *`,
    [versionId],
  )
  if (!rows[0]) return c.json({ detail: 'Version not found.' }, 404)
  const [out] = await db.query(`${VERSION_SELECT} where id = $1 and school_id = ${sid}`, [versionId])
  return c.json(out)
})

schedulingRoutes.post('/versions/:versionId/restore', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const versionId = c.req.param('versionId')
  await db.query(`update tt_versions set is_current = false where id <> $1 and school_id = ${sid}`, [versionId])
  const rows = await db.query(
    `update tt_versions set is_current = true, updated_at = now()
     where id = $1 and school_id = ${sid} returning *`,
    [versionId],
  )
  if (!rows[0]) return c.json({ detail: 'Version not found.' }, 404)
  const [out] = await db.query(`${VERSION_SELECT} where id = $1 and school_id = ${sid}`, [versionId])
  return c.json(out)
})

schedulingRoutes.delete('/versions/:versionId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const versionId = c.req.param('versionId')
  await db.query(`delete from tt_lessons where version_id = $1 and version_id in (select id from tt_versions where school_id = ${sid})`, [versionId])
  const rows = await db.query(`delete from tt_versions where id = $1 and school_id = ${sid} returning id`, [versionId])
  if (!rows[0]) return c.json({ detail: 'Version not found.' }, 404)
  return c.body(null, 204)
})

// Lessons
schedulingRoutes.patch('/lessons/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const allowed = ['day_index', 'period_index', 'duration', 'teacher_id', 'class_id', 'subject_id', 'room_id', 'is_locked']
  const data: Record<string, unknown> = {}
  for (const k of allowed) if ((body as Record<string, unknown>)[k] !== undefined) data[k] = (body as Record<string, unknown>)[k]
  if (!Object.keys(data).length) return c.json({ detail: 'No fields to update.' }, 400)
  const keys = Object.keys(data)
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
  const rows = await db.query(
    `update tt_lessons set ${sets}, updated_at = now()
     where id = $${keys.length + 1} and version_id in (select id from tt_versions where school_id = ${sid})
     returning id`,
    [...keys.map((k) => data[k]), c.req.param('id')],
  )
  if (!rows[0]) return c.json({ detail: 'Lesson not found.' }, 404)
  const [out] = await db.query(`${LESSON_SELECT} where l.id = $1 and l.version_id in (select id from tt_versions where school_id = ${sid})`, [c.req.param('id')])
  return c.json(out)
})

schedulingRoutes.post('/lessons/:id/duplicate', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const rows = await db.query(
    `insert into tt_lessons (version_id, requirement_id, class_id, subject_id, teacher_id, room_id, day_index, period_index, duration, is_locked)
     select version_id, requirement_id, class_id, subject_id, teacher_id, room_id, day_index, period_index, duration, is_locked
     from tt_lessons
     where id = $1 and version_id in (select id from tt_versions where school_id = ${sid})
     returning id`,
    [c.req.param('id')],
  )
  if (!rows[0]) return c.json({ detail: 'Lesson not found.' }, 404)
  const [out] = await db.query(`${LESSON_SELECT} where l.id = $1 and l.version_id in (select id from tt_versions where school_id = ${sid})`, [rows[0].id])
  return c.json(out, 201)
})

schedulingRoutes.delete('/lessons/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const rows = await db.query(
    `delete from tt_lessons where id = $1 and version_id in (select id from tt_versions where school_id = ${sid}) returning id`,
    [c.req.param('id')],
  )
  if (!rows[0]) return c.json({ detail: 'Lesson not found.' }, 404)
  return c.body(null, 204)
})

schedulingRoutes.post('/lessons/:id/explain', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  return c.json({ detail: NOT_AVAILABLE }, 501)
})

schedulingRoutes.get('/lessons/:id/suggestions', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  return c.json({ detail: NOT_AVAILABLE }, 501)
})

// Solver
schedulingRoutes.post('/solver/generate', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  return c.json({ detail: NOT_AVAILABLE }, 501)
})

schedulingRoutes.get('/solver/jobs/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(
    `select * from tt_solver_jobs
     where id = $1 and version_id in (select id from tt_versions where school_id = ${sid})`,
    [c.req.param('id')],
  )
  if (!rows[0]) return c.json({ detail: 'Job not found.' }, 404)
  const j = rows[0]
  return c.json({
    id: Number(j.id),
    status: j.status,
    progress: j.progress ?? 0,
    stage: j.stage ?? null,
    checks: j.checks ?? [],
    result_version_id: j.result_version_id ?? j.version_id ?? null,
    quality: j.quality ?? {},
    message: j.message ?? j.error ?? null,
  })
})

schedulingRoutes.post('/solver/jobs/:id/cancel', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  return c.json({ detail: NOT_AVAILABLE }, 501)
})

// Dashboard
schedulingRoutes.get('/dashboard', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const [t] = await db.query(`select count(*)::int as n from tt_teachers where school_id = ${sid}`)
  const [s] = await db.query(`select count(*)::int as n from tt_subjects where school_id = ${sid}`)
  const [cl] = await db.query(`select count(*)::int as n from tt_classes where school_id = ${sid}`)
  const [rm] = await db.query(`select count(*)::int as n from tt_rooms where school_id = ${sid}`)
  const [req] = await db.query(`select coalesce(sum(periods_per_week), 0)::int as n from tt_lesson_requirements where school_id = ${sid}`)
  const version = await latestVersion(db, sid)
  const versionId = version ? String(version.id) : '0'
  const [sched] = await db.query(`select count(*)::int as n from tt_lessons where version_id = $1 and version_id in (select id from tt_versions where school_id = ${sid})`, [versionId])
  const conflicts = version ? await computeConflicts(db, versionId, sid) : []
  const hard = conflicts.filter((x) => x.severity === 'hard').length
  const soft = conflicts.filter((x) => x.severity === 'soft').length
  const recent = (await db.query(
    `${AUDIT_SELECT} where a.entity_id ~ '^[0-9]+$' and a.entity_id::bigint in (
       select v.id from tt_versions v where v.school_id = ${sid}
       union
       select l.id from tt_lessons l where l.version_id in (select id from tt_versions where school_id = ${sid})
     ) order by a.created_at desc limit 8`,
  )) as Record<string, unknown>[]
  return c.json({
    counts: {
      teachers: t?.n ?? 0,
      subjects: s?.n ?? 0,
      classes: cl?.n ?? 0,
      rooms: rm?.n ?? 0,
    },
    lessons: {
      required: req?.n ?? 0,
      scheduled: sched?.n ?? 0,
      unassigned: Math.max((req?.n ?? 0) - (sched?.n ?? 0), 0),
    },
    conflicts: { hard, soft },
    version,
    quality: (version?.quality as Record<string, unknown>) ?? {},
    recent: recent.map((r) => ({
      at: r.at ?? null,
      actor: r.actor ?? null,
      action: r.action,
      summary: r.summary,
    })),
    solver_available: solverEnabled(c.env),
  })
})

// Analytics
schedulingRoutes.get('/analytics', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const version = await latestVersion(db, sid)
  const versionId = version ? String(version.id) : '0'
  const [totalPeriodsRow] = await db.query(
    `select count(*)::int as n from tt_periods where school_id = ${sid} and coalesce(is_teaching, not coalesce(is_break, false))`,
  )
  const totalPeriods = totalPeriodsRow?.n ?? 0

  const teachers = (await db.query(
    `select t.id, t.name, coalesce(t.workload_target, t.max_lessons_per_day, 6) as target,
            count(l.id)::int as lessons
     from tt_teachers t
     left join tt_lessons l on l.teacher_id = t.id and l.version_id = $1
          and l.version_id in (select id from tt_versions where school_id = ${sid})
     where t.school_id = ${sid}
     group by t.id order by t.name`,
    [versionId],
  )) as Record<string, unknown>[]
  const rooms = (await db.query(
    `select r.id, r.name, coalesce(r.room_type, 'Classroom') as type,
            count(l.id)::int as used
     from tt_rooms r
     left join tt_lessons l on l.room_id = r.id and l.version_id = $1
          and l.version_id in (select id from tt_versions where school_id = ${sid})
     where r.school_id = ${sid}
     group by r.id order by r.name`,
    [versionId],
  )) as Record<string, unknown>[]
  const classes = (await db.query(
    `select c.id, c.name, count(l.id)::int as lessons,
            coalesce(max(l.day_index), 0) as busiest_day, coalesce(min(l.day_index), 0) as quietest_day
     from tt_classes c
     left join tt_lessons l on l.class_id = c.id and l.version_id = $1
          and l.version_id in (select id from tt_versions where school_id = ${sid})
     where c.school_id = ${sid}
     group by c.id order by c.name`,
    [versionId],
  )) as Record<string, unknown>[]

  return c.json({
    teachers: teachers.map((r) => {
      const lessons = Number(r.lessons) ?? 0
      const target = r.target ? Number(r.target) : null
      return {
        id: Number(r.id),
        name: String(r.name),
        lessons,
        free_periods: Math.max(totalPeriods - lessons, 0),
        gaps: 0,
        target,
        utilisation: target ? Math.min(Math.round((lessons / target) * 100) / 100, 1) : 0,
      }
    }),
    rooms: rooms.map((r) => {
      const used = Number(r.used) ?? 0
      return {
        id: Number(r.id),
        name: String(r.name),
        type: String(r.type),
        used,
        utilisation: totalPeriods ? Math.min(Math.round((used / totalPeriods) * 100) / 100, 1) : 0,
      }
    }),
    classes: classes.map((r) => {
      const lessons = Number(r.lessons) ?? 0
      return {
        id: Number(r.id),
        name: String(r.name),
        lessons,
        free_periods: Math.max(totalPeriods - lessons, 0),
        busiest_day: Number(r.busiest_day ?? 0),
        quietest_day: Number(r.quietest_day ?? 0),
      }
    }),
    quality: (version?.quality as Record<string, unknown>) ?? {},
  })
})

// Audit
schedulingRoutes.get('/audit', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 200)
  const rows = (await db.query(
    `${AUDIT_SELECT} where a.entity_id ~ '^[0-9]+$' and a.entity_id::bigint in (
       select v.id from tt_versions v where v.school_id = ${sid}
       union
       select l.id from tt_lessons l where l.version_id in (select id from tt_versions where school_id = ${sid})
     ) order by a.created_at desc limit ${limit}`,
  )) as Record<string, unknown>[]
  return c.json(
    rows.map((r) => ({
      id: Number(r.id),
      at: r.at ?? null,
      actor: r.actor ?? null,
      action: String(r.action),
      entity: r.entity ?? null,
      entity_id: r.entity_id ?? null,
      summary: String(r.summary ?? r.action ?? ''),
      before: r.before ?? null,
      after: r.after ?? null,
    })),
  )
})

// Timetable view
schedulingRoutes.get('/timetable/view', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const scope = c.req.query('scope')
  const targetId = c.req.query('target_id')
  const days = await db.query(
    `select day_of_week as index, name from tt_days where school_id = ${sid} and coalesce(is_active, true) order by day_of_week`,
  )
  const periods = await db.query(
    `select id, coalesce(sort_index, id) as index, name, start_time, end_time,
            coalesce(is_teaching, not coalesce(is_break, false)) as is_teaching
     from tt_periods where school_id = ${sid} order by index`,
  )
  const version = await latestVersion(db, sid)
  let targetName: string | null = null
  if (targetId && (scope === 'class' || scope === 'teacher' || scope === 'room')) {
    const table = scope === 'class' ? 'tt_classes' : scope === 'teacher' ? 'tt_teachers' : 'tt_rooms'
    const rows = await db.query(`select name from ${table} where id = $1 and school_id = ${sid}`, [targetId])
    targetName = rows[0]?.name ?? null
  }
  let lessons: Record<string, unknown>[] = []
  if (version) {
    let where = `l.version_id = $1 and l.version_id in (select id from tt_versions where school_id = ${sid})`
    const params: string[] = [String(version.id)]
    if (targetId && (scope === 'class' || scope === 'teacher' || scope === 'room')) {
      const col = scope === 'class' ? 'l.class_id' : scope === 'teacher' ? 'l.teacher_id' : 'l.room_id'
      where += ` and ${col} = $2`
      params.push(targetId)
    }
    lessons = (await db.query(
      `select l.id, coalesce(l.day_index, 0) as day, coalesce(l.period_index, l.period, 0) as period,
              coalesce(s.name, '') as subject, coalesce(s.colour, '#6366f1') as colour,
              c.name as class, t.name as teacher, r.name as room
       from tt_lessons l
       left join tt_subjects s on s.id = l.subject_id
       left join tt_classes c on c.id = l.class_id
       left join tt_teachers t on t.id = l.teacher_id
       left join tt_rooms r on r.id = l.room_id
       where ${where} order by day, period, l.id`,
      params,
    )) as Record<string, unknown>[]
  }
  return c.json({
    version: version ? { id: Number(version.id), number: Number(version.number), status: String(version.status) } : null,
    scope: scope ?? undefined,
    target_id: targetId ? Number(targetId) : undefined,
    target_name: targetName,
    days,
    periods,
    lessons: lessons.map((l) => ({
      id: Number(l.id),
      day: Number(l.day),
      period: Number(l.period),
      subject: String(l.subject),
      colour: String(l.colour),
      class: l.class ?? null,
      teacher: l.teacher ?? null,
      room: l.room ?? null,
    })),
  })
})

// Copilot (stubbed)
schedulingRoutes.post('/copilot/interpret', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  return c.json({ detail: NOT_AVAILABLE }, 501)
})

schedulingRoutes.post('/copilot/apply', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  return c.json({ detail: NOT_AVAILABLE }, 501)
})