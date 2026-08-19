import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const libraryRoutes = new Hono<{ Bindings: Bindings }>()

libraryRoutes.get('/books', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from library_books where school_id = ${sid} order by title`
  return c.json(rows)
})

libraryRoutes.get('/books/stats', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const [books, loans] = await Promise.all([
    db`select total_copies from library_books where school_id = ${sid}`,
    db`select status from library_loans where school_id = ${sid}`,
  ])
  const totalCopies = books.reduce((acc, b) => acc + Number(b.total_copies ?? 0), 0)
  const activeLoans = loans.filter((l) => l.status === 'on_loan' || l.status === 'overdue').length
  return c.json({ total_titles: books.length, total_copies: totalCopies, active_loans: activeLoans })
})

libraryRoutes.post('/books', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'library_books', { school_id: sid, ...body })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

libraryRoutes.get('/books/:bookId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const bookId = c.req.param('bookId')
  const book = (await db`select * from library_books where id = ${bookId} and school_id = ${sid} limit 1`)[0]
  if (!book) return c.json({ detail: 'Book not found.' }, 404)
  const loans = await db`select * from library_loans where book_id = ${bookId} and school_id = ${sid} order by loan_date desc`
  return c.json({ ...book, loans })
})

libraryRoutes.patch('/books/:bookId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const ok = await db`select 1 from library_books where id = ${c.req.param('bookId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Book not found.' }, 404)
  const updated = await updateRowById(db, 'library_books', c.req.param('bookId'), { ...body, school_id: sid })
  return c.json(updated)
})

libraryRoutes.delete('/books/:bookId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const ok = await db`select 1 from library_books where id = ${c.req.param('bookId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Book not found.' }, 404)
  await deleteRowById(db, 'library_books', c.req.param('bookId'))
  return c.body(null, 204)
})

libraryRoutes.get('/loans', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from library_loans where school_id = ${sid} order by loan_date desc`
  return c.json(rows)
})

libraryRoutes.post('/loans', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(db, 'library_loans', {
      school_id: sid,
      book_id: body.book_id,
      borrower_type: body.borrower_type ?? 'student',
      borrower_id: body.borrower_id ?? null,
      borrower_name: body.borrower_name ?? '',
      loan_date: body.loan_date ?? body.loaned_at ?? new Date().toISOString().slice(0, 10),
      due_date: body.due_date ?? null,
      status: body.status ?? 'on_loan',
    })
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

libraryRoutes.post('/loans/:loanId/return', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const loanId = c.req.param('loanId')
  const loan = (await db`select * from library_loans where id = ${loanId} and school_id = ${sid} limit 1`)[0]
  if (!loan) return c.json({ detail: 'Loan not found.' }, 404)
  if (loan.status === 'returned') return c.json({ detail: 'Loan already returned.' }, 409)
  const rows = await db`update library_loans set status = 'returned', returned_date = current_date where id = ${loanId} and school_id = ${sid} returning *`
  return c.json(rows[0])
})