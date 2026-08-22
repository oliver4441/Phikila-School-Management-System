import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LoadingBlock } from './States'

export type Column<T> = {
  key: string
  header: string
  /** Cell content. */
  render: (row: T) => ReactNode
  /** Hidden on narrow screens when the table scrolls; still shown in card view. */
  secondary?: boolean
  /** Enables click-to-sort on this column's header. */
  sortable?: boolean
  /** Comparable value used for sorting and search matching. */
  value?: (row: T) => string | number
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * One table implementation for the whole application.
 *
 * Wide screens get a real <table>. Narrow screens get a definition-style card
 * per row, which keeps every value readable and never forces the page to
 * scroll horizontally.
 *
 * Optional capabilities (all off unless enabled): client-side search,
 * per-column sort, pagination, and row selection with a bulk-actions slot.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  loadingLabel = 'Loading data',
  empty,
  rowActions,
  searchable = false,
  searchPlaceholder = 'Search…',
  pageSize,
  selectable = false,
  selectedIds,
  onSelectedIdsChange,
  bulkActions,
  toolbarExtra,
}: {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  loading?: boolean
  loadingLabel?: string
  empty?: ReactNode
  rowActions?: (row: T) => ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  pageSize?: number
  selectable?: boolean
  selectedIds?: Set<string | number>
  onSelectedIdsChange?: (ids: Set<string | number>) => void
  bulkActions?: (selectedIds: Set<string | number>) => ReactNode
  toolbarExtra?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState>(null)
  const [page, setPage] = useState(0)

  const processed = useMemo(() => {
    let out = rows
    if (searchable && query.trim()) {
      const q = query.trim().toLowerCase()
      out = out.filter((row) =>
        columns.some((col) => {
          const v = col.value?.(row)
          return v !== undefined && String(v).toLowerCase().includes(q)
        }),
      )
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      const accessor = col?.value
      if (accessor) {
        const sorted = [...out].sort((a, b) => compareValues(accessor(a), accessor(b)))
        if (sort.dir === 'desc') sorted.reverse()
        out = sorted
      }
    }
    return out
  }, [rows, columns, query, sort, searchable])

  const paginationOn = typeof pageSize === 'number' && pageSize > 0
  const pageCount = paginationOn ? Math.max(1, Math.ceil(processed.length / pageSize!)) : 1
  const safePage = Math.min(page, pageCount - 1)
  const visible = paginationOn
    ? processed.slice(safePage * pageSize!, safePage * pageSize! + pageSize!)
    : processed

  useEffect(() => {
    setPage(0)
  }, [query, sort])

  const allKeys = visible.map(rowKey)
  const allSelected = selectable && allKeys.length > 0 && allKeys.every((k) => selectedIds?.has(k))
  const someSelected = selectable && !allSelected && allKeys.some((k) => selectedIds?.has(k))

  const toggleAll = () => {
    if (!onSelectedIdsChange) return
    const next = new Set(selectedIds ?? [])
    if (allSelected) allKeys.forEach((k) => next.delete(k))
    else allKeys.forEach((k) => next.add(k))
    onSelectedIdsChange(next)
  }

  const toggleOne = (key: string | number) => {
    if (!onSelectedIdsChange) return
    const next = new Set(selectedIds ?? [])
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectedIdsChange(next)
  }

  const cycleSort = (key: string) => {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  if (loading) return <LoadingBlock label={loadingLabel} rows={4} />
  if (rows.length === 0) return <>{empty}</>

  const hasToolbar = searchable || toolbarExtra || (selectable && selectedIds && selectedIds.size > 0)

  return (
    <>
      {hasToolbar && (
        <div className="toolbar" role="group" aria-label={`${caption} controls`}>
          {searchable && (
            <div className="search">
              <span className="search__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                className="input input--search"
                placeholder={searchPlaceholder}
                aria-label={`Search ${caption.toLowerCase()}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          {toolbarExtra}
          {selectable && selectedIds && selectedIds.size > 0 && bulkActions && (
            <div className="form__row form__row--between" style={{ marginLeft: 'auto' }}>
              <span className="badge">{selectedIds.size} selected</span>
              {bulkActions(selectedIds)}
            </div>
          )}
        </div>
      )}

      <div className="table-wrap" role="region" aria-label={caption} tabIndex={0}>
        <table className="table">
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={Boolean(allSelected)}
                    ref={(el) => {
                      if (el) el.indeterminate = Boolean(someSelected)
                    }}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sort?.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {column.sortable && column.value ? (
                    <button
                      type="button"
                      onClick={() => cycleSort(column.key)}
                      style={{ all: 'unset', cursor: 'pointer', font: 'inherit', color: 'inherit', display: 'inline-flex', gap: '0.25rem' }}
                      aria-label={`Sort by ${column.header}`}
                    >
                      {column.header}
                      <span aria-hidden="true">{sort?.key === column.key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
              {rowActions && (
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0) + (selectable ? 1 : 0)}>
                  No matches for your filters.
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const key = rowKey(row)
              return (
                <tr key={key}>
                  {selectable && (
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selectedIds?.has(key) ?? false}
                        onChange={() => toggleOne(key)}
                      />
                    </td>
                  )}
                  {columns.map((column, index) => (
                    <td key={column.key} data-primary={index === 0 || undefined}>
                      {column.render(row)}
                    </td>
                  ))}
                  {rowActions && <td className="table__actions">{rowActions(row)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="record-cards" aria-label={caption}>
        {visible.map((row) => {
          const key = rowKey(row)
          return (
            <li className="record-card" key={key}>
              {selectable && (
                <label className="record-card__row">
                  <input
                    type="checkbox"
                    aria-label="Select record"
                    checked={selectedIds?.has(key) ?? false}
                    onChange={() => toggleOne(key)}
                  />
                </label>
              )}
              <dl>
                {columns.map((column) => (
                  <div className="record-card__row" key={column.key}>
                    <dt>{column.header}</dt>
                    <dd>{column.render(row)}</dd>
                  </div>
                ))}
              </dl>
              {rowActions && <div className="record-card__actions">{rowActions(row)}</div>}
            </li>
          )
        })}
      </ul>

      {paginationOn && processed.length > 0 && (
        <nav className="pagination" aria-label={`${caption} pagination`}>
          <button
            type="button"
            className="button button--ghost button--sm"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </button>
          <span>
            Page {safePage + 1} of {pageCount} · {processed.length} records
          </span>
          <button
            type="button"
            className="button button--ghost button--sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  )
}
