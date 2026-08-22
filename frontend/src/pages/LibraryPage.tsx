import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../components/States'
import { DataTable, type Column } from '../components/DataTable'
import { friendlyApiError } from '../lib/api'
import { library, type Book, type Loan } from '../lib/library'

const BOOK_COLUMNS: Column<Book>[] = [
  { key: 'title', header: 'Title', sortable: true, value: (b) => b.title, render: (b) => <strong>{b.title}</strong> },
  { key: 'author', header: 'Author', sortable: true, value: (b) => b.author || '', render: (b) => b.author || '—' },
  { key: 'category', header: 'Category', value: (b) => b.category, render: (b) => b.category },
  {
    key: 'copies',
    header: 'Copies',
    sortable: true,
    value: (b) => b.available_copies,
    render: (b) => `${b.available_copies} / ${b.total_copies}`,
  },
  {
    key: 'status',
    header: 'Status',
    value: (b) => b.status,
    render: (b) => <Badge tone={b.available_copies > 0 ? 'success' : 'warning'}>{b.status}</Badge>,
  },
]

function loanColumns(titleOf: (loan: Loan) => string): Column<Loan>[] {
  return [
    {
      key: 'borrower',
      header: 'Borrower',
      sortable: true,
      value: (l) => l.borrower_name,
      render: (l) => <strong>{l.borrower_name}</strong>,
    },
    { key: 'type', header: 'Type', value: (l) => l.borrower_type, render: (l) => l.borrower_type },
    { key: 'book', header: 'Book', sortable: true, value: titleOf, render: titleOf },
    { key: 'loan_date', header: 'Loan Date', sortable: true, value: (l) => l.loan_date, render: (l) => l.loan_date },
    { key: 'due_date', header: 'Due', sortable: true, value: (l) => l.due_date || '', render: (l) => l.due_date || '—' },
    {
      key: 'status',
      header: 'Status',
      value: (l) => l.status,
      render: (l) => (
        <Badge tone={l.status === 'returned' ? 'success' : l.status === 'overdue' ? 'danger' : 'warning'}>{l.status}</Badge>
      ),
    },
  ]
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[] | null>(null)
  const [loans, setLoans] = useState<Loan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<'books' | 'loans'>('books')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [b, l] = await Promise.all([library.books(), library.loans()])
      setBooks(b)
      setLoans(l)
    } catch (err) {
      setError(friendlyApiError(err, 'load library'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function returnLoan(id: number) {
    setBusy(true)
    setError(null)
    try {
      await library.returnLoan(id)
      await load()
    } catch (err) {
      setError(friendlyApiError(err, 'return book'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Library"
        description={`Books and loans`}
        actions={
          <button className="button button--primary button--sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Close' : section === 'books' ? '+ Add Book' : '+ Issue Loan'}
          </button>
        }
      />

      {error ? (
        <ErrorState title="Library could not load" message={error} onRetry={load} retryLabel="Retry" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <button className={`button button--${section === 'books' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('books'); setShowForm(false) }}>
              Books ({books?.length ?? 0})
            </button>
            <button className={`button button--${section === 'loans' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('loans'); setShowForm(false) }}>
              Loans ({loans?.length ?? 0})
            </button>
          </div>

          {showForm && (section === 'books'
            ? <BookForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />
            : <LoanForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} books={books ?? []} />)}

          {loading ? (
            <LoadingBlock label="Loading library" rows={5} />
          ) : section === 'books' ? (
            !books?.length ? (
              <EmptyState title="No books" description="Add your first book title to get started." />
            ) : (
              <DataTable caption="Library books" columns={BOOK_COLUMNS} rows={books} rowKey={(b) => b.id} searchable searchPlaceholder="Search titles…" pageSize={25} />
            )
          ) : !loans?.length ? (
            <EmptyState title="No loans" description="Issue a book to a student, teacher or staff member." />
          ) : (
            <DataTable
              caption="Book loans"
              columns={loanColumns((l) => books?.find((b) => b.id === l.book_id)?.title ?? `#${l.book_id}`)}
              rows={loans}
              rowKey={(l) => l.id}
              searchable
              searchPlaceholder="Search borrowers…"
              pageSize={25}
              rowActions={(l) =>
                l.status !== 'returned' ? (
                  <button className="button button--secondary button--sm" disabled={busy} onClick={() => returnLoan(l.id)}>
                    Return
                  </button>
                ) : null
              }
            />
          )}
        </>
      )}
    </div>
  )
}

function BookForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: '', author: '', isbn: '', category: 'General', shelf_location: '', total_copies: '1' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await library.createBook({
        title: form.title,
        author: form.author || null,
        isbn: form.isbn || null,
        category: form.category,
        shelf_location: form.shelf_location || null,
        total_copies: Number(form.total_copies || 1),
        available_copies: Number(form.total_copies || 1),
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'add book'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Add Book</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 14rem' }}>
            <label className="field__label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Author</label>
            <input className="input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">ISBN</label>
            <input className="input" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Category</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Shelf Location</label>
            <input className="input" value={form.shelf_location} onChange={(e) => setForm({ ...form, shelf_location: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 6rem' }}>
            <label className="field__label">Copies</label>
            <input className="input" type="number" min="1" value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Book'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

function LoanForm({ onCreated, onCancel, books }: { onCreated: () => void; onCancel: () => void; books: Book[] }) {
  const [form, setForm] = useState({ book_id: '', borrower_type: 'student', borrower_name: '', due_date: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await library.createLoan({
        book_id: Number(form.book_id),
        borrower_type: form.borrower_type,
        borrower_name: form.borrower_name,
        due_date: form.due_date || null,
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'issue loan'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Issue Loan</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 14rem' }}>
            <label className="field__label">Book *</label>
            <select className="input" required value={form.book_id} onChange={(e) => setForm({ ...form, book_id: e.target.value })}>
              <option value="">Select…</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Borrower Type</label>
            <select className="input" value={form.borrower_type} onChange={(e) => setForm({ ...form, borrower_type: e.target.value })}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Borrower Name *</label>
            <input className="input" required value={form.borrower_name} onChange={(e) => setForm({ ...form, borrower_name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Due Date</label>
            <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Issue Loan'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}