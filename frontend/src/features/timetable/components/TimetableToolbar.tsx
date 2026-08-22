import { Badge } from '../../../components/States'
import { MinusIcon, PlusIcon, PrintIcon, DownloadIcon } from '../../../components/icons'
import type { Bundle, Filter, Scope } from '../types'

export function TimetableToolbar({
  bundle,
  filter,
  setFilter,
  dayFilter,
  setDayFilter,
  zoom,
  setZoom,
  dense,
  setDense,
  days,
  hardCount,
  softCount,
  qualityOverall,
  onExportCsv,
  onExportIcs,
  onExportPng,
}: {
  bundle: Bundle
  filter: Filter
  setFilter: React.Dispatch<React.SetStateAction<Filter>>
  dayFilter: number | null
  setDayFilter: React.Dispatch<React.SetStateAction<number | null>>
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  dense: boolean
  setDense: React.Dispatch<React.SetStateAction<boolean>>
  days: { index: number; name: string }[]
  hardCount: number
  softCount: number
  qualityOverall: number | undefined
  onExportCsv: () => void
  onExportIcs: () => void
  onExportPng: () => void
}) {
  return (
    <>
      <div className="toolbar timetable-toolbar">
        <div className="field field--inline">
          <label className="field__label" htmlFor="tt-scope">
            View
          </label>
          <select
            id="tt-scope"
            className="input input--select"
            value={filter.scope}
            onChange={(event) =>
              setFilter({ scope: event.target.value as Scope, id: null })
            }
          >
            <option value="all">Whole school</option>
            <option value="class">By class / student</option>
            <option value="teacher">By teacher</option>
            <option value="room">By room</option>
            <option value="subject">By subject</option>
          </select>
        </div>

        {filter.scope !== 'all' && (
          <div className="field field--inline">
            <label className="field__label" htmlFor="tt-target">
              {filter.scope === 'class'
                ? 'Class'
                : filter.scope === 'teacher'
                  ? 'Teacher'
                  : filter.scope === 'room'
                    ? 'Room'
                    : 'Subject'}
            </label>
            <select
              id="tt-target"
              className="input input--select"
              value={filter.id ?? ''}
              onChange={(event) =>
                setFilter((current) => ({
                  ...current,
                  id: event.target.value ? Number(event.target.value) : null,
                }))
              }
            >
              <option value="">Choose…</option>
              {(filter.scope === 'class'
                ? bundle.classes
                : filter.scope === 'teacher'
                  ? bundle.teachers
                  : filter.scope === 'room'
                    ? bundle.rooms
                    : bundle.subjects
              ).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="toolbar__spacer" />

        <div className="timetable-toolbar__status">
          {hardCount > 0 ? (
            <Badge tone="danger">{hardCount} hard conflicts</Badge>
          ) : (
            <Badge tone="success">No hard conflicts</Badge>
          )}
          {softCount > 0 && <Badge tone="warning">{softCount} warnings</Badge>}
          {qualityOverall !== undefined && (
            <Badge>Quality {qualityOverall}/100</Badge>
          )}
        </div>
      </div>

      <div className="toolbar timetable-toolbar timetable-toolbar--secondary">
        <div className="day-chips" role="group" aria-label="Filter by day">
          <button
            type="button"
            className={`day-chip ${dayFilter === null ? 'day-chip--active' : ''}`}
            onClick={() => setDayFilter(null)}
          >
            All days
          </button>
          {days.map((day) => (
            <button
              key={day.index}
              type="button"
              className={`day-chip ${dayFilter === day.index ? 'day-chip--active' : ''}`}
              onClick={() => setDayFilter((current) => (current === day.index ? null : day.index))}
            >
              {day.name.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="toolbar__spacer" />

        <div className="toolbar__group" aria-label="Zoom and density">
          <button
            type="button"
            className="icon-button icon-button--subtle"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
            disabled={zoom <= 0.75}
          >
            <MinusIcon width={16} height={16} />
          </button>
          <span className="toolbar__zoom-label" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="icon-button icon-button--subtle"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(1.25, Number((z + 0.25).toFixed(2))))}
            disabled={zoom >= 1.25}
          >
            <PlusIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className={`button button--ghost button--sm ${dense ? 'button--active' : ''}`}
            onClick={() => setDense((d) => !d)}
            aria-pressed={dense}
            aria-label="Toggle compact density"
            title="Toggle compact density"
          >
            Compact
          </button>
        </div>

        <div className="toolbar__group" aria-label="Export">
          <button type="button" className="button button--ghost button--sm" onClick={() => window.print()} aria-label="Print or save as PDF" title="Print or save as PDF">
            <PrintIcon width={14} height={14} /> Print
          </button>
          <button type="button" className="button button--ghost button--sm" onClick={onExportCsv} aria-label="Download CSV" title="Download CSV">
            CSV
          </button>
          <button type="button" className="button button--ghost button--sm" onClick={onExportIcs} aria-label="Download calendar file (.ics)" title="Download calendar file (.ics)">
            Calendar
          </button>
          <button type="button" className="button button--ghost button--sm" onClick={onExportPng} aria-label="Download PNG image" title="Download PNG image">
            <DownloadIcon width={14} height={14} /> PNG
          </button>
        </div>
      </div>
    </>
  )
}
