import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const libraryRoutes = new Hono<{ Bindings: Bindings }>()

libraryRoutes.get('/books', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from library_books order by title`
  return c.json(rows)
})

libraryRoutes.get('/books/stats', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const [books, loans] = await Promise.all([
    db`select total_copies from library_books`,
    db`select status from library_loans`,
  ])
  const totalCopies = books.reduce((acc, b) => acc + Number(b.total_copies ?? 0), 0)
  const activeLoans = loans.filter((l) => l.status === 'on_loan' || l.status === 'overdue').length
  return c.json({ total_titles: books.length, total_copies: totalCopies, active_loans: activeLoans })
})

libraryRoutes.post('/books', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  try {
    const row = await insertRow(createSql(c.env), 'library_books', body)
    return c.json(row, 201)
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
})

libraryRoutes.get('/books/:bookId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const bookId = c.req.param('bookId')
  const book = (await db`select * from library_books where id = ${bookId} limit 1`)[0]
  if (!book) return c.json({ detail: 'Book not found.' }, 404)
  const loans = await db`select * from library_loans where book_id = ${bookId} order by loan_date desc`
  return c.json({ ...book, loans })
})

libraryRoutes.patch('/books/:bookId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const updated = await updateRowById(createSql(c.env), 'library_books', c.req.param('bookId'), body)
  return c.json(updated)
})

libraryRoutes.delete('/books/:bookId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'library_books', c.req.param('bookId'))
  return c.body(null, 204)
})

libraryRoutes.get('/loans', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from library_loans order by loan_date desc`
  return c.json(rows)
})

libraryRoutes.post('/loans', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  try {
    const row = await insertRow(db, 'library_loans', {
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
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const loanId = c.req.param('loanId')
  const loan = (await db`select * from library_loans where id = ${loanId} limit 1`)[0]
  if (!loan) return c.json({ detail: 'Loan not found.' }, 404)
  if (loan.status === 'returned') return c.json({ detail: 'Loan already returned.' }, 409)
  const rows = await db`update library_loans set status = 'returned', returned_date = current_date where id = ${loanId} returning *`
  return c.json(rows[0])
})