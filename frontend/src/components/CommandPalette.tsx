import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { normalisePath, useNavigate, useRouter } from '../lib/router'
import { SearchIcon } from './icons'

/** Every entry the palette can jump to. */
export type PaletteItem = {
  to: string
  label: string
  group: string
  icon?: ReactNode
}

type Props = {
  open: boolean
  onClose: () => void
  items: PaletteItem[]
}

/** Simple fuzzy: returns true if all chars of `q` appear in `s` in order. */
function fuzzyMatch(query: string, s: string): boolean {
  let qi = 0
  for (let si = 0; si < s.length && qi < query.length; si++) {
    if (s[si] === query[qi]) qi++
  }
  return qi === query.length
}

export function CommandPalette({ open, onClose, items }: Props) {
  const navigate = useNavigate()
  const { pathname } = useRouter()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const currentPath = normalisePath(pathname)

  const filtered = useMemo(() => {
    if (!query.trim()) return items.filter((i) => i.to !== currentPath)
    const q = query.toLowerCase()
    return items.filter(
      (i) =>
        i.to !== currentPath &&
        (fuzzyMatch(q, i.label.toLowerCase()) ||
          fuzzyMatch(q, i.to.toLowerCase()) ||
          fuzzyMatch(q, i.group.toLowerCase())),
    )
  }, [query, items, currentPath])

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(0)
  }, [filtered.length, query])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const goTo = useCallback(
    (to: string) => {
      onClose()
      if (to !== currentPath) navigate(to)
    },
    [onClose, navigate, currentPath],
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIdx]) goTo(filtered[activeIdx].to)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className="palette-overlay"
      role="dialog"
      aria-modal
      aria-label="Command palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="palette">
        <div className="palette__input-row">
          <SearchIcon width={18} height={18} className="palette__search-icon" />
          <input
            ref={inputRef}
            className="palette__input"
            type="text"
            placeholder="Search pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="palette__close"
            onClick={onClose}
            aria-label="Close command palette"
          >
            <kbd>Esc</kbd>
          </button>
        </div>

        <div className="palette__list" ref={listRef} role="listbox">
          {filtered.length === 0 ? (
            <p className="palette__empty">No matching pages found.</p>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.to}
                type="button"
                className={`palette__item ${idx === activeIdx ? 'palette__item--active' : ''}`}
                role="option"
                aria-selected={idx === activeIdx}
                onClick={() => goTo(item.to)}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                {item.icon && <span className="palette__item-icon" aria-hidden="true">{item.icon}</span>}
                <span className="palette__item-label">{item.label}</span>
                <span className="palette__item-group">{item.group}</span>
              </button>
            ))
          )}
        </div>

        <div className="palette__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

// ── Global shortcut hook ───────────────────────────────────────────────

export function useCommandPaletteShortcut(onToggle: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onToggle()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onToggle])
}
