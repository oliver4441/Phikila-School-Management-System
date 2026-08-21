/**
 * RAG (Retrieval-Augmented Generation) pipeline.
 *
 * Queries the school's Postgres database for relevant context, then composes
 * a system prompt so the LLM answers grounded in real data.  Every query is
 * parameterised — the AI never touches raw credentials.
 */

import type { Sql } from './db'

// ── Context types ──────────────────────────────────────────────────────

export type SchoolContext = {
  schoolName: string
  academicYear: string | null
  term: string | null
}

export type StudentSummary = {
  id: number
  first_name: string
  last_name: string
  class_name: string | null
  avg_score: number | null
  attendance_rate: number | null
  recent_grades: { subject: string; score: number; grade: string }[]
}

export type ClassSummary = {
  class_name: string
  student_count: number
  avg_score: number | null
  attendance_rate: number | null
  top_students: { name: string; avg: number }[]
  struggling_students: { name: string; avg: number }[]
}

export type FinanceSummary = {
  total_expected: number
  total_collected: number
  collection_rate: number
  outstanding_count: number
  overdue_count: number
  recent_payments: { student: string; amount: number; date: string }[]
}

// ── RAG context builders ───────────────────────────────────────────────

/**
 * Fetch basic school context for prompt composition.
 */
export async function getSchoolContext(db: Sql, schoolId: number): Promise<SchoolContext> {
  const [info] = await db`select name, academic_year, term from school_info where id = ${schoolId} limit 1`
  return {
    schoolName: info?.name ?? 'Unknown School',
    academicYear: info?.academic_year ?? null,
    term: info?.term ?? null,
  }
}

/**
 * Fetch class summary including grades and attendance.
 */
export async function getClassSummary(
  db: Sql,
  schoolId: number,
  className: string,
): Promise<ClassSummary | null> {
  // Find the class
  const classes = await db`
    select id, name, student_count
    from class_registers
    where school_id = ${schoolId} and lower(name) like lower(${`%${className}%`})
    order by student_count desc
    limit 1
  `
  if (!classes.length) return null
  const cls = classes[0]

  // Get enrolled students with their exam averages
  const students = await db`
    select s.id, s.first_name, s.last_name,
           avg(ee.score) as avg_score
    from students s
    left join exam_entries ee on ee.student_id = s.id and ee.school_id = ${schoolId}
    where s.school_id = ${schoolId} and s.class_id = ${cls.id}
    group by s.id, s.first_name, s.last_name
    order by avg_score desc nulls last
  `

  // Get attendance rate
  const attRows = await db`
    select
      count(*)::int as total,
      count(*) filter (where ar.status = 'present')::int as present
    from attendance_records ar
    join attendance_sessions asess on asess.id = ar.session_id
    where ar.school_id = ${schoolId} and asess.class_id = ${cls.id}
  `
  const attTotal = attRows[0]?.total ?? 0
  const attPresent = attRows[0]?.present ?? 0

  const avgScore = students.length
    ? students.reduce((sum: number, s: Record<string, unknown>) => sum + (Number(s.avg_score) || 0), 0) / students.length
    : null

  return {
    class_name: String(cls.name),
    student_count: Number(cls.student_count),
    avg_score: avgScore ? Math.round(avgScore * 10) / 10 : null,
    attendance_rate: attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null,
    top_students: students
      .slice(0, 5)
      .map((s: Record<string, unknown>) => ({
        name: `${s.first_name} ${s.last_name}`,
        avg: Math.round(Number(s.avg_score) || 0),
      })),
    struggling_students: students
      .filter((s: Record<string, unknown>) => (Number(s.avg_score) || 0) < 50)
      .map((s: Record<string, unknown>) => ({
        name: `${s.first_name} ${s.last_name}`,
        avg: Math.round(Number(s.avg_score) || 0),
      })),
  }
}

/**
 * Fetch finance summary for the current term/year.
 */
export async function getFinanceSummary(
  db: Sql,
  schoolId: number,
): Promise<FinanceSummary> {
  const invoices = await db`
    select
      count(*)::int as total_count,
      coalesce(sum(amount), 0)::numeric as total_expected,
      count(*) filter (where status = 'paid')::int as paid_count,
      coalesce(sum(amount) filter (where status = 'paid'), 0)::numeric as total_collected,
      count(*) filter (where status = 'pending')::int as outstanding_count,
      count(*) filter (where status = 'pending' and due_date < current_date)::int as overdue_count
    from student_invoices
    where school_id = ${schoolId}
  `

  const inv = invoices[0] ?? {}
  const totalExpected = Number(inv.total_expected) || 0
  const totalCollected = Number(inv.total_collected) || 0

  const payments = await db`
    select
      coalesce(s.first_name || ' ' || s.last_name, 'Unknown') as student,
      p.amount,
      p.created_at::text as date
    from payments p
    left join students s on s.id = p.student_id
    where p.school_id = ${schoolId}
    order by p.created_at desc
    limit 5
  `

  return {
    total_expected: totalExpected,
    total_collected: totalCollected,
    collection_rate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
    outstanding_count: Number(inv.outstanding_count) || 0,
    overdue_count: Number(inv.overdue_count) || 0,
    recent_payments: payments.map((p: Record<string, unknown>) => ({
      student: String(p.student),
      amount: Number(p.amount),
      date: String(p.date).slice(0, 10),
    })),
  }
}

// ── System prompt composition ──────────────────────────────────────────

/**
 * Build the system prompt for a chat request, including all retrieved context.
 */
export async function buildChatPrompt(
  db: Sql,
  schoolId: number,
  question: string,
): Promise<{ systemPrompt: string; contextSummary: string }> {
  const ctx = await getSchoolContext(db, schoolId)

  // Detect intent from the question (simple keyword matching)
  const lowerQ = question.toLowerCase()
  const isGradeQuery = /\b(grade|score|exam|result|average|performance|mark)\b/.test(lowerQ)
  const isFinanceQuery = /\b(finance|payment|invoice|fee|money|balance|collection)\b/.test(lowerQ)
  const isAttendanceQuery = /\b(attend|absent|present|late|truancy)\b/.test(lowerQ)
  const isStudentQuery = /\b(student|learner|pupil|enrol)\b/.test(lowerQ)

  // Extract class name if mentioned (e.g., "Form 3A", "Grade 4")
  const classMatch = question.match(/\b(form|grade|class)\s+(\d+[a-z]?)\b/i)
  const className = classMatch ? classMatch[0] : null

  const contextParts: string[] = []

  // Always include school context
  contextParts.push(`School: ${ctx.schoolName}`)
  if (ctx.academicYear) contextParts.push(`Academic Year: ${ctx.academicYear}`)
  if (ctx.term) contextParts.push(`Term: ${ctx.term}`)

  // Fetch relevant data based on detected intent
  if (isGradeQuery || isStudentQuery) {
    if (className) {
      const classSummary = await getClassSummary(db, schoolId, className)
      if (classSummary) {
        contextParts.push(`\nClass: ${classSummary.class_name} (${classSummary.student_count} students)`)
        if (classSummary.avg_score !== null) contextParts.push(`Class average: ${classSummary.avg_score}%`)
        if (classSummary.attendance_rate !== null) contextParts.push(`Attendance rate: ${classSummary.attendance_rate}%`)
        if (classSummary.top_students.length) {
          contextParts.push('Top students:')
          for (const s of classSummary.top_students) contextParts.push(`  - ${s.name}: ${s.avg}%`)
        }
        if (classSummary.struggling_students.length) {
          contextParts.push('Students below 50%:')
          for (const s of classSummary.struggling_students) contextParts.push(`  - ${s.name}: ${s.avg}%`)
        }
      }
    }
  }

  if (isFinanceQuery) {
    const finance = await getFinanceSummary(db, schoolId)
    contextParts.push('\nFinancial Summary:')
    contextParts.push(`  Total expected: KES ${finance.total_expected.toLocaleString()}`)
    contextParts.push(`  Collected: KES ${finance.total_collected.toLocaleString()}`)
    contextParts.push(`  Collection rate: ${finance.collection_rate}%`)
    contextParts.push(`  Outstanding invoices: ${finance.outstanding_count}`)
    contextParts.push(`  Overdue invoices: ${finance.overdue_count}`)
    if (finance.recent_payments.length) {
      contextParts.push('  Recent payments:')
      for (const p of finance.recent_payments) {
        contextParts.push(`    - ${p.student}: KES ${p.amount.toLocaleString()} (${p.date})`)
      }
    }
  }

  if (isAttendanceQuery && !isGradeQuery) {
    // General attendance stats
    const attStats = await db`
      select
        count(*)::int as total,
        count(*) filter (where ar.status = 'present')::int as present,
        count(*) filter (where ar.status = 'absent')::int as absent,
        count(*) filter (where ar.status = 'late')::int as late
      from attendance_records ar
      where ar.school_id = ${schoolId}
        and ar.created_at >= now() - interval '30 days'
    `
    if (attStats.length) {
      const s = attStats[0]
      contextParts.push('\nAttendance (last 30 days):')
      contextParts.push(`  Total records: ${s.total}`)
      contextParts.push(`  Present: ${s.present}`)
      contextParts.push(`  Absent: ${s.absent}`)
      contextParts.push(`  Late: ${s.late}`)
    }
  }

  const contextSummary = contextParts.join('\n')

  const systemPrompt = `You are an AI assistant for ${ctx.schoolName}, a school management system.
You have access to the school's data and should answer questions accurately based on it.

Current context:
${contextSummary}

Guidelines:
- Answer concisely and clearly. Use bullet points and formatting for readability.
- When discussing students, use their full names.
- When discussing financial figures, always specify the currency (KES).
- If you don't have enough data to answer, say so honestly.
- Never fabricate data. Only report what you can see in the context.
- Keep responses focused and actionable. Teachers and administrators are busy.`

  return { systemPrompt, contextSummary }
}
