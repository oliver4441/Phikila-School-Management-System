import { useState } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { EmptyState, ErrorState, LoadingBlock } from '../../../components/States'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { TimetableGrid } from '../../../components/TimetableGrid'
import { CalendarIcon } from '../../../components/icons'
import { Link } from '../../../lib/router'
import { formatSavedAt } from '../../../lib/offline'
import { activeDays } from '../../../lib/scheduling'
import { useTimetableData } from '../hooks/useTimetableData'
import { useTimetableActions } from '../hooks/useTimetableActions'
import { exportCsv, exportIcs, exportPng } from '../lib/timetableExports'
import { CommandPalette } from './CommandPalette'
import { ConflictsPanel } from './ConflictsPanel'
import { LessonDetailsPanel } from './LessonDetailsPanel'
import { TimetableToolbar } from './TimetableToolbar'
import { UnassignedPanel } from './UnassignedPanel'

export function TimetablePage() {
  const {
    bundle,
    loading,
    error,
    stale,
    filter,
    setFilter,
    dayFilter,
    setDayFilter,
    load,
    currentSlot,
    meta,
    conflicted,
    visible,
    hardCount,
    softCount,
    readOnly,
  } = useTimetableData()
  const [zoom, setZoom] = useState(1)
  const [dense, setDense] = useState(false)
  const {
    selected,
    setSelected,
    explanation,
    setExplanation,
    busy,
    publishing,
    confirmPublish,
    setConfirmPublish,
    confirmingDelete,
    setConfirmingDelete,
    paletteOpen,
    setPaletteOpen,
    handleMove,
    handleResize,
    handlePatch,
    handleDropUnassigned,
    handleDuplicate,
    handleDelete,
    handleAssignRooms,
    askWhy,
    applyAlternative,
    handlePublish,
  } = useTimetableActions({ bundle, readOnly, load })

  if (loading) {
    return (
      <>
        <PageHeader title="Timetable" description="The current working timetable." />
        <div className="card section">
          <LoadingBlock label="Loading the timetable" rows={8} />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Timetable" />
        <ErrorState title="Timetable could not load" message={error} onRetry={load} />
      </>
    )
  }

  const version = bundle?.version
  const days = activeDays(bundle?.calendar.days ?? [])
  const selectedIsConflicted = selected ? conflicted.has(selected.id) : false

  return (
    <>
      <PageHeader
        title="Timetable"
        description={
          version
            ? `Version ${version.number} · ${version.status}`
            : 'No timetable has been generated yet.'
        }
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Timetable' }]}
        actions={
          <>
            <Link className="button button--secondary button--sm" to="/scheduling/generate">
              Generate
            </Link>
            {version && version.status !== 'published' && (
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={() => setConfirmPublish(true)}
                disabled={publishing || hardCount > 0}
                title={hardCount > 0 ? 'Resolve hard conflicts first' : undefined}
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            )}
          </>
        }
      />

      {stale && (
        <Alert tone="info" title="Offline copy">
          Showing the timetable saved on this device {formatSavedAt(stale)}. It will refresh when
          you are back online.
        </Alert>
      )}

      {!version || !bundle ? (
        <div className="card section">
          <EmptyState
            title="No timetable yet"
            description="Add your teachers, subjects, classes and rooms, then generate a timetable."
            icon={<CalendarIcon width={22} height={22} />}
            action={
              <Link className="button button--primary button--sm" to="/scheduling/generate">
                Generate a timetable
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <TimetableToolbar
            bundle={bundle}
            filter={filter}
            setFilter={setFilter}
            dayFilter={dayFilter}
            setDayFilter={setDayFilter}
            zoom={zoom}
            setZoom={setZoom}
            dense={dense}
            setDense={setDense}
            days={days}
            hardCount={hardCount}
            softCount={softCount}
            qualityOverall={version.quality?.overall}
            onExportCsv={() => exportCsv(bundle, visible, meta)}
            onExportIcs={() => exportIcs(bundle, visible, meta)}
            onExportPng={() => exportPng(bundle, visible, meta)}
          />

          {readOnly && (
            <Alert tone="info" title="Published timetable">
              Published versions are read-only so everyone sees the same schedule. Restore it as a
              draft from <Link to="/versions">Versions</Link> to make changes.
            </Alert>
          )}

          {!readOnly && bundle.unassigned.length > 0 && (
            <UnassignedPanel unassigned={bundle.unassigned} />
          )}

          <div className="workspace">
            <div className="card section workspace__grid">
              <TimetableGrid
                days={days}
                periods={bundle.calendar.periods}
                lessons={visible}
                meta={meta}
                conflicted={conflicted}
                selectedId={selected?.id ?? null}
                readOnly={readOnly || busy}
                zoom={zoom}
                dense={dense}
                currentSlot={currentSlot}
                onSelect={(lesson) => {
                  setSelected(lesson)
                  setExplanation(null)
                }}
                onMove={handleMove}
                onResize={handleResize}
                onDropUnassigned={handleDropUnassigned}
                secondary={(lesson) =>
                  filter.scope === 'class'
                    ? null
                    : (meta.classes.get(lesson.class_id)?.name ?? null)
                }
              />
            </div>

            <aside className="workspace__panel" aria-label="Lesson details">
              <LessonDetailsPanel
                selected={selected}
                meta={meta}
                days={days}
                periods={bundle.calendar.periods}
                teachers={bundle.teachers}
                rooms={bundle.rooms}
                selectedIsConflicted={selectedIsConflicted}
                readOnly={readOnly}
                busy={busy}
                explanation={explanation}
                onClose={() => {
                  setSelected(null)
                  setExplanation(null)
                }}
                onPatch={handlePatch}
                onDuplicate={handleDuplicate}
                onRequestDelete={() => selected && setConfirmingDelete(selected)}
                onAskWhy={askWhy}
                onApplyAlternative={applyAlternative}
              />

              {(bundle.conflicts.length ?? 0) > 0 && (
                <ConflictsPanel
                  conflicts={bundle.conflicts}
                  readOnly={readOnly}
                  onAssignRooms={handleAssignRooms}
                />
              )}
            </aside>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmingDelete !== null}
        title="Delete this lesson?"
        description={
          confirmingDelete
            ? `${meta.subjects.get(confirmingDelete.subject_id)?.name ?? 'This lesson'} for ${
                meta.classes.get(confirmingDelete.class_id)?.name ?? 'its class'
              } will be removed from the timetable. Its requirement period becomes unscheduled and can be placed again from the unassigned panel.`
            : ''
        }
        confirmLabel="Delete lesson"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(null)}
      />

      <ConfirmDialog
        open={confirmPublish}
        title="Publish this timetable?"
        description={`Version ${version?.number ?? ''} becomes the live timetable for every class. Existing schedules are replaced. You can restore any earlier version from the Versions page.`}
        confirmLabel={publishing ? 'Publishing…' : 'Publish timetable'}
        destructive
        onConfirm={handlePublish}
        onCancel={() => setConfirmPublish(false)}
      />

      {paletteOpen && (
        <CommandPalette bundle={bundle} onFilter={setFilter} onClose={() => setPaletteOpen(false)} />
      )}
    </>
  )
}
