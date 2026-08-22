import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { resolveTenant, tenantSchoolId } from '../lib/tenancy'
import type { Bindings } from '../lib/env'

export const analyticsRoutes = new Hono<{ Bindings: Bindings }>()

function parseDays(c: { req: { query: (k: string) => string | undefined } }, fallback: number, max: number): number {
  const raw = c.req.query('days')
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

analyticsRoutes.get('/attendance-summary', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const days = parseDays(c, 30, 180)

  const rows = (await db.query(
    `select s.session_date::text as date,
            count(*) filter (where ar.status = 'present')::int as present,
            count(*) filter (where ar.status = 'absent')::int as absent,
            count(*) filter (where ar.status = 'late')::int as late,
            count(*) filter (where ar.status = 'excused')::int as excused,
            count(*)::int as total
     from attendance_records ar
     join attendance_sessions s on s.id = ar.session_id
     where s.school_id = ${sid}
       and s.session_date >= current_date - ${days}::int
     group by s.session_date
     order by s.session_date asc`,
  )) as Record<string, unknown>[]

  let marked = 0
  let positive = 0
  const series = rows.map((r) => {
    const total = Number(r.total ?? 0)
    const pos = Number(r.present ?? 0) + Number(r.late ?? 0)
    marked += total
    positive += pos
    return {
      date: r.date,
      present: Number(r.present ?? 0),
      absent: Number(r.absent ?? 0),
      late: Number(r.late ?? 0),
      excused: Number(r.excused ?? 0),
      rate: total > 0 ? Math.round((pos / total) * 100) : null,
    }
  })

  return c.json({
    days,
    series,
    totals: {
      marked,
      rate: marked > 0 ? Math.round((positive / marked) * 100) : null,
    },
  })
})

analyticsRoutes.get('/finance-summary', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const days = parseDays(c, 90, 365)

  const collected = (await db.query(
    `select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
            coalesce(sum(amount), 0)::numeric as amount,
            count(*)::int as payments
     from payments
     where school_id = ${sid}
       and created_at >= current_date - ${days}::int
       and reversed_at is null and status <> 'reversed'
     group by 1 order by 1 asc`,
  )) as Record<string, unknown>[]

  const invoiced = (await db.query(
    `select to_char(date_trunc('month', coalesce(due_date, created_at::date)), 'YYYY-MM') as month,
            coalesce(sum(amount), 0)::numeric as amount,
            count(*)::int as invoices,
            coalesce(sum(case when status in ('paid', 'void') then amount else 0 end), 0)::numeric as settled
     from student_invoices
     where school_id = ${sid}
       and coalesce(due_date, created_at::date) >= current_date - ${days}::int
     group by 1 order by 1 asc`,
  )) as Record<string, unknown>[]

  const months = Array.from(new Set([...collected.map((r) => String(r.month)), ...invoiced.map((r) => String(r.month))])).sort()
  const series = months.map((m) => {
    const pay = collected.find((r) => String(r.month) === m)
    const inv = invoiced.find((r) => String(r.month) === m)
    return {
      month: m,
      collected: Number(pay?.amount ?? 0),
      payments: Number(pay?.payments ?? 0),
      invoiced: Number(inv?.amount ?? 0),
      invoices: Number(inv?.invoices ?? 0),
      outstanding: Number(inv?.amount ?? 0) - Number(inv?.settled ?? 0),
    }
  })

  const totalCollected = series.reduce((a, s) => a + s.collected, 0)
  const totalInvoiced = series.reduce((a, s) => a + s.invoiced, 0)

  return c.json({
    days,
    series,
    totals: {
      collected: totalCollected,
      invoiced: totalInvoiced,
      outstanding: totalInvoiced - totalCollected,
    },
  })
})

analyticsRoutes.get('/timetable-health', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)

  const versionRows = (await db.query(
    `select id from tt_versions where school_id = ${sid} and is_current = true limit 1`,
  )) as Record<string, unknown>[]
  const versionId = versionRows[0] ? Number(versionRows[0].id) : null

  const lessonRows = versionId
    ? (await db.query(
        `select status, count(*)::int as n from tt_lessons where version_id = ${versionId} group by status`,
      )) as Record<string, unknown>[]
    : []

  const auditCount = (await db.query(
    `select count(*)::int as n from tt_audit where school_id = ${sid} and created_at >= current_date - 30`,
  )) as Record<string, unknown>[]

  let assigned = 0
  let unassigned = 0
  for (const r of lessonRows) {
    if (String(r.status) === 'assigned' || String(r.status) === 'locked') assigned += Number(r.n ?? 0)
    else unassigned += Number(r.n ?? 0)
  }
  const total = assigned + unassigned

  return c.json({
    current_version_id: versionId,
    lessons: {
      total,
      assigned,
      unassigned,
      coverage_pct: total > 0 ? Math.round((assigned / total) * 100) : null,
      by_status: Object.fromEntries(lessonRows.map((r) => [String(r.status), Number(r.n ?? 0)])),
    },
    audit_events_30d: Number(auditCount[0]?.n ?? 0),
  })
})
