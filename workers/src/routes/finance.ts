import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { deleteRowById, insertRow, updateRowById } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const financeRoutes = new Hono<{ Bindings: Bindings }>()

const PAYMENT_SELECT = `
  select id, coalesce(school_id, 1) as school_id, coalesce(invoice_id, 0) as invoice_id,
         student_id, amount, coalesce(payment_method, method) as payment_method,
         coalesce(reference_number, reference) as reference_number, notes,
         coalesce(received_by, created_by::text) as received_by, status,
         journal_id, reversed_at, reversal_reason, created_at
  from payments
`

const INVOICE_SELECT = `
  select i.id, coalesce(i.school_id, 1) as school_id, i.student_id, i.fee_structure_id, i.amount,
         coalesce(i.balance, i.amount)
           - coalesce((select sum(p.amount) from payments p
                       where p.invoice_id = i.id and p.reversed_at is null and p.status <> 'reversed'), 0)
           as balance,
         i.status, i.due_date, i.created_at
  from student_invoices i
`

const FEE_SELECT = `
  select id, coalesce(school_id, 1) as school_id, name, description,
         academic_year_id, term_id, level_id, amount,
         coalesce(currency, 'KES') as currency, coalesce(status, 'active') as status, created_at
  from fee_structures
`

const INBOX_SELECT = `
  select id, coalesce(school_id, 1) as school_id, source,
         coalesce(source_account, sender_phone) as source_account,
         coalesce(account_name, sender_name) as account_name,
         coalesce(raw_message, narration) as raw_message, amount,
         coalesce(external_reference, transaction_id) as external_reference,
         student_identifier, coalesce(received_at, created_at) as received_at, payment_channel,
         coalesce(matched_student_id, student_id) as matched_student_id, match_method, match_confidence,
         status, duplicate_of, posted_payment_id, posted_at,
         coalesce(reviewed_by, matched_by) as reviewed_by, reviewed_at, notes, created_at
  from payment_inbox
`

function mapPaymentWrite(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...body }
  if (body.payment_method !== undefined) data.method = body.payment_method
  if (body.reference_number !== undefined) data.reference = body.reference_number
  if (body.received_by !== undefined) data.created_by = body.received_by
  return data
}

financeRoutes.get('/overview', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const [inv, pay] = await Promise.all([
    db.query(`select coalesce(sum(amount), 0)::numeric as n, count(*)::int as c from student_invoices where school_id = ${sid}`),
    db.query(
      `select coalesce(sum(amount), 0)::numeric as n from payments where school_id = ${sid} and reversed_at is null and status <> 'reversed'`,
    ),
  ])
  const totalInvoiced = Number(inv[0]?.n ?? 0)
  const totalCollected = Number(pay[0]?.n ?? 0)
  const invoicesCount = Number(inv[0]?.c ?? 0)
  const statusRows = (await db.query(
    `select status, count(*)::int as n from student_invoices where school_id = ${sid} group by status`,
  )) as Record<string, unknown>[]
  let paidCount = 0
  let pendingCount = 0
  for (const r of statusRows) {
    if (String(r.status) === 'paid') paidCount += Number(r.n)
    else pendingCount += Number(r.n)
  }
  return c.json({
    total_invoiced: totalInvoiced,
    total_collected: totalCollected,
    total_outstanding: totalInvoiced - totalCollected,
    invoices_count: invoicesCount,
    paid_count: paidCount,
    pending_count: pendingCount,
  })
})

financeRoutes.get('/fee-structures', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(`${FEE_SELECT} where school_id = ${sid} order by id`)
  return c.json(rows)
})

financeRoutes.post('/fee-structures', async (c) => {
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
    const row = await insertRow(db, 'fee_structures', { school_id: sid, ...body })
    const [fee] = await db.query(`${FEE_SELECT} where id = $1 and school_id = ${sid}`, [row.id])
    return c.json(fee, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.patch('/fee-structures/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db.query(`select 1 from fee_structures where id = $1 and school_id = ${sid}`, [c.req.param('id')])
  if (!ok[0]) return c.json({ detail: 'Fee structure not found.' }, 404)
  const updated = await updateRowById(db, 'fee_structures', c.req.param('id'), body as Record<string, unknown>)
  return c.json(updated)
})

financeRoutes.delete('/fee-structures/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const ok = await db.query(`select 1 from fee_structures where id = $1 and school_id = ${sid}`, [c.req.param('id')])
  if (!ok[0]) return c.json({ detail: 'Fee structure not found.' }, 404)
  await deleteRowById(db, 'fee_structures', c.req.param('id'))
  return c.body(null, 204)
})

financeRoutes.get('/invoices', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const q = c.req.query()
  const where: string[] = []
  const params: unknown[] = []
  params.push(sid)
  where.push(`i.school_id = $${params.length}`)
  if (q.student_id) {
    params.push(q.student_id)
    where.push(`i.student_id = $${params.length}`)
  }
  if (q.status) {
    params.push(q.status)
    where.push(`lower(i.status) = lower($${params.length})`)
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  const rows = await db.query(`${INVOICE_SELECT} ${whereSql} order by i.created_at desc`, params)
  return c.json(rows)
})

financeRoutes.post('/invoices', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  if (!(body as Record<string, unknown>).student_id) return jsonError(c, 'student_id is required.', 400)
  try {
    const row = await insertRow(db, 'student_invoices', { school_id: sid, ...body })
    const [invoice] = await db.query(`${INVOICE_SELECT} where i.id = $1 and i.school_id = ${sid}`, [row.id])
    return c.json(invoice, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.patch('/invoices/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db.query(`select 1 from student_invoices where id = $1 and school_id = ${sid}`, [c.req.param('id')])
  if (!ok[0]) return c.json({ detail: 'Invoice not found.' }, 404)
  const updated = await updateRowById(db, 'student_invoices', c.req.param('id'), body as Record<string, unknown>)
  return c.json(updated)
})

financeRoutes.get('/payments', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const studentId = c.req.query('student_id')
  const rows = await db.query(
    `${PAYMENT_SELECT} ${studentId ? `where student_id = $1 and school_id = ${sid}` : `where school_id = ${sid}`} order by created_at desc`,
    studentId ? [studentId] : [],
  )
  return c.json(rows)
})

financeRoutes.post('/payments', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  if ((body as Record<string, unknown>).student_id == null) return jsonError(c, 'student_id is required.', 400)
  try {
    const row = await insertRow(db, 'payments', { school_id: sid, ...mapPaymentWrite(body as Record<string, unknown>) })
    const [payment] = await db.query(`${PAYMENT_SELECT} where id = $1 and school_id = ${sid}`, [row.id])
    return c.json(payment, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.post('/payments/decode', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const body = await c.req.json().catch(() => ({}))
  const message = String((body as Record<string, unknown>).message ?? '')
  const amountMatch = message.match(/(?:Ksh|KES)\s*([\d,]+(?:\.\d{2})?)/i)
  const phoneMatch = message.match(/0?\d{9}/)
  const nameMatch = message.match(/([A-Z][A-Za-z .'-]{3,})/g)
  return c.json({
    parsed: !!amountMatch,
    message,
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
    sender_phone: phoneMatch?.[0] ?? null,
    sender_name: nameMatch?.[nameMatch.length - 1] ?? null,
    channel: 'mpesa',
  })
})

financeRoutes.post('/payments/:id/reverse', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const rows = await db.query(
    `update payments set reversed_at = now(), status = 'reversed', reversal_reason = $1 where id = $2 and school_id = ${sid} returning id`,
    [(body as Record<string, unknown>).reason ?? 'Reversed by administrator', c.req.param('id')],
  )
  if (!rows[0]) return c.json({ detail: 'Payment not found.' }, 404)
  const [payment] = await db.query(`${PAYMENT_SELECT} where id = $1 and school_id = ${sid}`, [c.req.param('id')])
  return c.json(payment)
})

financeRoutes.get('/receipts', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(
    `select id, 1 as school_id, receipt_number, payment_id, student_id, amount, 'issued' as status,
            null as issued_by, issued_at
     from finance_receipts where school_id = ${sid} order by issued_at desc`,
  )
  return c.json(rows)
})

financeRoutes.post('/receipts', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'finance_receipts', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.get('/payment-inbox', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const status = c.req.query('status')
  const rows = await db.query(
    `${INBOX_SELECT} ${status ? `where lower(status) = lower($1) and school_id = ${sid}` : `where school_id = ${sid}`} order by created_at desc`,
    status ? [status] : [],
  )
  return c.json(rows)
})

financeRoutes.patch('/payment-inbox/:id', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db.query(`select 1 from payment_inbox where id = $1 and school_id = ${sid}`, [c.req.param('id')])
  if (!ok[0]) return c.json({ detail: 'Inbox item not found.' }, 404)
  const updated = await updateRowById(db, 'payment_inbox', c.req.param('id'), body as Record<string, unknown>)
  return c.json(updated)
})

financeRoutes.post('/payment-inbox/:id/post', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const inboxId = c.req.param('id')
  const [item] = await db.query(`${INBOX_SELECT} where id = $1 and school_id = ${sid} limit 1`, [inboxId]) as Record<string, unknown>[]
  if (!item) return c.json({ detail: 'Inbox item not found.' }, 404)
  if (!item.matched_student_id) return jsonError(c, 'This payment has no matched student yet.', 400)

  const paymentRow = await insertRow(db, 'payments', {
    student_id: item.matched_student_id,
    invoice_id: (body as Record<string, unknown>).invoice_id ?? null,
    amount: item.amount,
    payment_method: String(item.payment_channel ?? item.source ?? 'cash'),
    reference_number: item.external_reference,
    status: 'completed',
    received_by: ten.ctx.user.id,
    school_id: sid,
  })
  await db.query(
    `update payment_inbox set status = 'posted', posted_payment_id = $1, posted_at = now(), reviewed_by = $2, reviewed_at = now() where id = $3 and school_id = ${sid}`,
    [paymentRow.id, ten.ctx.user.id, inboxId],
  )
  const [updated] = await db.query(`${INBOX_SELECT} where id = $1 and school_id = ${sid}`, [inboxId])
  return c.json(updated)
})

financeRoutes.get('/students/:studentId/balance', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const studentId = c.req.param('studentId')
  const student = (await db.query(
    `select first_name, last_name, admission_number from students where id = $1 and school_id = ${sid} limit 1`,
    [studentId],
  )) as Record<string, unknown>[]
  if (!student[0]) return c.json({ detail: 'Student not found.' }, 404)
  const [inv] = await db.query(
    `select coalesce(sum(amount), 0)::numeric as n from student_invoices where student_id = $1 and school_id = ${sid}`,
    [studentId],
  )
  const [pay] = await db.query(
    `select coalesce(sum(amount), 0)::numeric as n from payments where student_id = $1 and school_id = ${sid} and reversed_at is null and status <> 'reversed'`,
    [studentId],
  )
  const totalInvoiced = Number(inv?.n ?? 0)
  const totalPaid = Number(pay?.n ?? 0)
  return c.json({
    student_id: Number(studentId),
    student_name: `${student[0].first_name} ${student[0].last_name ?? ''}`.trim(),
    total_invoiced: totalInvoiced,
    total_paid: totalPaid,
    balance: totalInvoiced - totalPaid,
  })
})

financeRoutes.get('/bank-accounts', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(
    `select id, coalesce(school_id, 1) as school_id, bank_name, branch_name, account_name,
            account_identifier, coalesce(currency, 'KES') as currency, opening_balance, status
     from bank_accounts where school_id = ${sid} order by id`,
  )
  return c.json(rows)
})

financeRoutes.get('/cash-books', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(
    `select id, coalesce(school_id, 1) as school_id, name, book_type, bank_account_id, opening_balance, status
     from cash_books where school_id = ${sid} order by id`,
  )
  return c.json(rows)
})

financeRoutes.get('/bank-reconciliations', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(
    `select id, coalesce(school_id, 1) as school_id, bank_account_id, statement_date,
            statement_balance, book_balance, difference, status, reconciled_by, reconciled_at, notes
     from bank_reconciliations where school_id = ${sid} order by statement_date desc`,
  )
  return c.json(rows)
})

financeRoutes.post('/bank-reconciliations', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'bank_reconciliations', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.post('/bank-accounts/:bankAccountId/statement-import', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const bankAccountId = c.req.param('bankAccountId')
  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  let filename = 'statement.csv'
  if (file && typeof file === 'object' && 'name' in file) {
    const nm = (file as { name?: unknown }).name
    if (typeof nm === 'string') filename = nm
  }
  return c.json({ bank_account_id: Number(bankAccountId), filename, imported: 0, duplicates: 0 })
})

// Legacy endpoints kept for compatibility
financeRoutes.get('/chart-of-accounts', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(`select * from chart_of_accounts where school_id = ${sid} order by code`)
  return c.json(rows)
})

financeRoutes.post('/chart-of-accounts', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'chart_of_accounts', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.get('/journals', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db.query(`select * from finance_journals where school_id = ${sid} order by created_at desc`)
  return c.json(rows)
})

financeRoutes.post('/journals', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  let journal: Record<string, unknown>
  try {
    journal = await insertRow(db, 'finance_journals', { school_id: sid, ...body })
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
  if (Array.isArray((body as Record<string, unknown>).entries)) {
    for (const e of (body as Record<string, unknown>).entries as Record<string, unknown>[]) {
      await db.query(
        `insert into finance_journal_entries (journal_id, account_id, debit, credit, description) values ($1, $2, $3, $4, $5)`,
        [journal.id, e.account_id ?? null, e.debit ?? 0, e.credit ?? 0, e.description ?? null],
      )
    }
  }
  return c.json(journal, 201)
})