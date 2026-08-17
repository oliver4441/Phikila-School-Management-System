import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const financeRoutes = new Hono<{ Bindings: Bindings }>()

financeRoutes.get('/overview', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const [fees, invoices, payments, inbox, accounts] = await Promise.all([
    db`select * from fee_structures`,
    db`select * from student_invoices`,
    db`select * from payments`,
    db`select * from payment_inbox`,
    db`select * from chart_of_accounts`,
  ])
  return c.json({
    fee_structures: fees,
    invoices,
    payments,
    payment_inbox: inbox,
    chart_of_accounts: accounts,
  })
})

financeRoutes.get('/fee-structures', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from fee_structures order by id`
  return c.json(rows)
})

financeRoutes.post('/fee-structures', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'fee_structures', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.patch('/fee-structures/:id', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'fee_structures', c.req.param('id'), body)
  return c.json(updated)
})

financeRoutes.delete('/fee-structures/:id', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'fee_structures', c.req.param('id'))
  return c.body(null, 204)
})

financeRoutes.get('/invoices', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from student_invoices order by created_at desc`
  return c.json(rows)
})

financeRoutes.post('/invoices', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'student_invoices', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.patch('/invoices/:id', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'student_invoices', c.req.param('id'), body)
  return c.json(updated)
})

financeRoutes.get('/payments', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from payments order by created_at desc`
  return c.json(rows)
})

financeRoutes.post('/payments', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  let payment: Record<string, unknown>
  try {
    payment = await insertRow(db, 'payments', body)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
  if (body.reference) {
    await db`update payment_inbox set status = 'matched' where reference = ${body.reference}`
  }
  return c.json(payment, 201)
})

financeRoutes.get('/payment-inbox', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from payment_inbox order by created_at desc`
  return c.json(rows)
})

financeRoutes.patch('/payment-inbox/:id', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'payment_inbox', c.req.param('id'), body)
  return c.json(updated)
})

financeRoutes.get('/receipts', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from finance_receipts order by created_at desc`
  return c.json(rows)
})

financeRoutes.post('/receipts', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'finance_receipts', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.get('/chart-of-accounts', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from chart_of_accounts order by code`
  return c.json(rows)
})

financeRoutes.post('/chart-of-accounts', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'chart_of_accounts', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

financeRoutes.get('/journals', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from finance_journals order by created_at desc`
  return c.json(rows)
})

financeRoutes.post('/journals', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  let journal: Record<string, unknown>
  try {
    journal = await insertRow(db, 'finance_journals', body)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
  if (Array.isArray(body.entries)) {
    for (const e of body.entries as Record<string, unknown>[]) {
      await db`insert into finance_journal_entries (journal_id, account_id, debit, credit, description) values (${journal.id}, ${e.account_id ?? null}, ${e.debit ?? 0}, ${e.credit ?? 0}, ${e.description ?? null})`
    }
  }
  return c.json(journal, 201)
})
