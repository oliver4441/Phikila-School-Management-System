import { Alert } from '../../../components/Alert'
import { EmptyState } from '../../../components/States'
import type { LessonMeta } from '../../../components/TimetableGrid'
import {
  CalendarIcon,
  CloseIcon,
  AlertIcon,
  CheckIcon,
  DuplicateIcon,
  TrashIcon,
  LockIcon,
  UnlockIcon,
} from '../../../components/icons'
import type { Alternative, Explanation, Lesson, LessonPatch, Period, Room, Teacher } from '../../../lib/scheduling'
import { MoveExplorer } from './MoveExplorer'

type Props = {
  selected: Lesson | null
  meta: LessonMeta
  days: { index: number; name: string }[]
  periods: Period[]
  teachers: Teacher[]
  rooms: Room[]
  selectedIsConflicted: boolean
  readOnly: boolean
  busy: boolean
  explanation: Explanation | null
  onClose: () => void
  onPatch: (lesson: Lesson, patch: LessonPatch, success: string) => void
  onDuplicate: () => void
  onRequestDelete: () => void
  onAskWhy: (lesson: Lesson, day: number, period: number) => void
  onApplyAlternative: (alt: Alternative) => void
}

export function LessonDetailsPanel({
  selected,
  meta,
  days,
  periods,
  teachers,
  rooms,
  selectedIsConflicted,
  readOnly,
  busy,
  explanation,
  onClose,
  onPatch,
  onDuplicate,
  onRequestDelete,
  onAskWhy,
  onApplyAlternative,
}: Props) {
  if (!selected) {
    return (
      <div className="card section">
        <EmptyState
          title="No lesson selected"
          description="Choose a lesson in the grid to see its details, move it, or ask why a slot is blocked."
          icon={<CalendarIcon width={22} height={22} />}
        />
      </div>
    )
  }

  return (
    <div className="card section">
      <div className="panel__head">
        <h2 className="section__title">
          <span
            className="subject-swatch"
            style={{ background: meta.subjects.get(selected.subject_id)?.colour ?? '#0F2A47' }}
            aria-hidden="true"
          />
          {meta.subjects.get(selected.subject_id)?.name ?? 'Lesson'}
        </h2>
        <button
          type="button"
          className="icon-button icon-button--subtle"
          onClick={onClose}
          aria-label="Close lesson details"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>

      {selectedIsConflicted && (
        <Alert tone="error" title="This lesson has a conflict">
          See the conflicts list below for the exact reason.
        </Alert>
      )}
      {selected.is_locked && (
        <Alert tone="info" title="Locked">
          This lesson stays in its slot when the timetable is regenerated.
        </Alert>
      )}

      <dl className="detail-list">
        <div>
          <dt>Slot</dt>
          <dd>
            {days.find((d) => d.index === selected.day_index)?.name},{' '}
            {
              periods.find((p) => p.index === selected.period_index)
                ?.name
            }
            {selected.duration > 1 && ` · ${selected.duration} periods`}
          </dd>
        </div>
        <div>
          <dt>Class</dt>
          <dd>{meta.classes.get(selected.class_id)?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Teacher</dt>
          <dd>
            {selected.teacher_id
              ? (meta.teachers.get(selected.teacher_id)?.name ?? '—')
              : 'Unassigned'}
          </dd>
        </div>
        <div>
          <dt>Room</dt>
          <dd>
            {selected.room_id ? (meta.rooms.get(selected.room_id)?.name ?? '—') : 'No room'}
          </dd>
        </div>
      </dl>

      {readOnly ? (
        <p className="form__note">Published timetables are read-only.</p>
      ) : (
        <>
          <h3 className="panel__subtitle">Edit lesson</h3>

          <div className="field field--inline">
            <label className="field__label" htmlFor="edit-day">
              Day
            </label>
            <select
              id="edit-day"
              className="input input--select"
              value={selected.day_index}
              onChange={(event) =>
                onPatch(selected, { day_index: Number(event.target.value) }, 'Lesson moved.')
              }
            >
              {days.map((d) => (
                <option key={d.index} value={d.index}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field field--inline">
            <label className="field__label" htmlFor="edit-period">
              Period
            </label>
            <select
              id="edit-period"
              className="input input--select"
              value={selected.period_index}
              onChange={(event) =>
                onPatch(selected, { period_index: Number(event.target.value) }, 'Lesson moved.')
              }
            >
              {periods
                .filter((p) => p.is_teaching)
                .map((p) => (
                  <option key={p.index} value={p.index}>
                    {p.name} ({p.start_time})
                  </option>
                ))}
            </select>
          </div>

          <div className="field field--inline">
            <label className="field__label" htmlFor="edit-duration">
              Duration
            </label>
            <select
              id="edit-duration"
              className="input input--select"
              value={selected.duration}
              onChange={(event) =>
                onPatch(selected, { duration: Number(event.target.value) }, 'Duration updated.')
              }
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'period' : 'periods'}
                </option>
              ))}
            </select>
          </div>

          <div className="field field--inline">
            <label className="field__label" htmlFor="edit-teacher">
              Teacher
            </label>
            <select
              id="edit-teacher"
              className="input input--select"
              value={selected.teacher_id ?? ''}
              onChange={(event) =>
                onPatch(
                  selected,
                  { teacher_id: event.target.value ? Number(event.target.value) : null },
                  'Teacher updated.',
                )
              }
            >
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field field--inline">
            <label className="field__label" htmlFor="edit-room">
              Room
            </label>
            <select
              id="edit-room"
              className="input input--select"
              value={selected.room_id ?? ''}
              onChange={(event) =>
                onPatch(
                  selected,
                  { room_id: event.target.value ? Number(event.target.value) : null },
                  'Room updated.',
                )
              }
            >
              <option value="">No room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="panel__actions">
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() =>
                onPatch(
                  selected,
                  { is_locked: !selected.is_locked },
                  selected.is_locked ? 'Lesson unlocked.' : 'Lesson locked.',
                )
              }
            >
              {selected.is_locked ? <UnlockIcon width={14} height={14} /> : <LockIcon width={14} height={14} />}
              {selected.is_locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={onDuplicate}
              disabled={busy}
            >
              <DuplicateIcon width={14} height={14} /> Duplicate
            </button>
            <button
              type="button"
              className="button button--danger button--sm"
              onClick={onRequestDelete}
              disabled={busy}
            >
              <TrashIcon width={14} height={14} /> Delete
            </button>
          </div>

          <h3 className="panel__subtitle">Move this lesson</h3>
          <p className="form__note">
            Drag the card, or select a cell and press Enter. Ask why a slot is blocked
            before moving.
          </p>
          <MoveExplorer
            days={days}
            periods={periods}
            onAsk={(day, period) => onAskWhy(selected, day, period)}
          />
        </>
      )}

      {explanation && (
        <div className="explain">
          <h3 className="panel__subtitle">
            {explanation.allowed ? (
              <>
                <CheckIcon width={16} height={16} /> That slot is free
              </>
            ) : (
              <>
                <AlertIcon width={16} height={16} /> Why it cannot go there
              </>
            )}
          </h3>
          {explanation.reasons.length > 0 && (
            <ul className="explain__list">
              {explanation.reasons.map((reason, index) => (
                <li key={index}>
                  <strong>{reason.factor}:</strong> {reason.detail}
                </li>
              ))}
            </ul>
          )}
          {explanation.alternatives.length > 0 && (
            <>
              <h4 className="explain__alt-title">Suggested alternatives</h4>
              <ul className="explain__alts">
                {explanation.alternatives.map((alt) => (
                  <li key={`${alt.day}:${alt.period}`}>
                    <button
                      type="button"
                      className="button button--secondary button--sm"
                      onClick={() => onApplyAlternative(alt)}
                      disabled={busy || readOnly}
                    >
                      {alt.day_name} {alt.period_name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
