import { apiFetch } from './api'

const BASE = '/api/v1/library'

export type Book = {
  id: number
  title: string
  author: string | null
  isbn: string | null
  category: string
  shelf_location: string | null
  total_copies: number
  available_copies: number
  status: string
  created_at: string
  updated_at: string
}

export type LibraryStats = {
  total_titles: number
  total_copies: number
  active_loans: number
}

export type LoanStatus = 'on_loan' | 'returned' | 'overdue'

export type Loan = {
  id: number
  book_id: number
  borrower_type: string
  borrower_id: number | null
  borrower_name: string
  loan_date: string
  due_date: string | null
  returned_date: string | null
  status: LoanStatus
  created_at: string
}

export type BookInput = {
  title: string
  author?: string | null
  isbn?: string | null
  category?: string
  shelf_location?: string | null
  total_copies?: number
  available_copies?: number
}

export type LoanInput = {
  book_id: number
  borrower_type?: string
  borrower_id?: number | null
  borrower_name: string
  loan_date?: string
  due_date?: string | null
}

const get = <T,>(path: string) => apiFetch<T>(path)
const send = <T,>(path: string, method: string, body?: unknown) =>
  apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const library = {
  books: () => get<Book[]>(`${BASE}/books`),
  stats: () => get<LibraryStats>(`${BASE}/books/stats`),
  createBook: (payload: BookInput) => send<Book>(`${BASE}/books`, 'POST', payload),
  updateBook: (id: number, payload: Record<string, unknown>) => send<Book>(`${BASE}/books/${id}`, 'PATCH', payload),
  removeBook: (id: number) => send<void>(`${BASE}/books/${id}`, 'DELETE'),

  loans: () => get<Loan[]>(`${BASE}/loans`),
  createLoan: (payload: LoanInput) => send<Loan>(`${BASE}/loans`, 'POST', payload),
  returnLoan: (id: number) => send<Loan>(`${BASE}/loans/${id}/return`, 'POST'),
}