import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '../../../lib/router'
import type { Bundle, Filter } from '../types'

export function CommandPalette({
  bundle,
  onFilter,
  onClose,
}: {
  bundle: Bundle | null
  onFilter: (filter: Filter) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const nav = [
      { label: 'Dashboard', to: '/' },
      { label: 'Timetable', to: '/timetable' },
      { label: 'My timetable', to: '/my-timetable' },
      { label: 'Days & periods', to: '/setup/periods' },
      { label: 'Teachers', to: '/setup/teachers' },
      { label: 'Subjects', to: '/setup/subjects' },
      { label: 'Classes', to: '/setup/classes' },
      { label: 'Rooms', to: '/setup/rooms' },
      { label: 'Lesson requirements', to: '/scheduling/requirements' },
      { label: 'Generate timetable', to: '/scheduling/generate' },
      { label: 'Copilot', to: '/scheduling/copilot' },
      { label: 'Analytics', to: '/analytics' },
      { label: 'Versions', to: '/versions' },
    ]
    const people: { label: string; action: () => void }[] = [
      ...(bundle?.teachers ?? []).map((t) => ({
        label: `Show teacher: ${t.name}`,
        action: () => onFilter({ scope: 'teacher', id: t.id }),
      })),
      ...(bundle?.classes ?? []).map((c) => ({
        label: `Show class: ${c.name}`,
        action: () => onFilter({ scope: 'class', id: c.id }),
      })),
      ...(bundle?.rooms ?? []).map((r) => ({
        label: `Show room: ${r.name}`,
        action: () => onFilter({ scope: 'room', id: r.id }),
      })),
      ...(bundle?.subjects ?? []).map((s) => ({
        label: `Show subject: ${s.name}`,
        action: () => onFilter({ scope: 'subject', id: s.id }),
      })),
    ]
    const filtered = [
      ...nav.filter((item) => item.label.toLowerCase().includes(q)).map((item) => ({
        label: `Go to ${item.label}`,
        action: () => navigate(item.to),
      })),
      ...people.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 10),
    ]
    return filtered.slice(0, 12)
  }, [query, bundle, navigate, onFilter])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="palette__panel">
        <input
          className="input palette__input"
          placeholder="Search pages, teachers, classes, rooms…"
          aria-label="Command palette search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
        <ul className="palette__list">
          {items.length === 0 && <li className="palette__empty">No matches</li>}
          {items.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                className="palette__item"
                onClick={() => {
                  item.action()
                  onClose()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="palette__hint">Type to filter · Enter to open · Esc to close</p>
      </div>
    </div>
  )
}
