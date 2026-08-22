import { UNASSIGNED_DRAG_TYPE } from '../../../components/TimetableGrid'
import type { Unassigned } from '../../../lib/scheduling'

export function UnassignedPanel({ unassigned }: { unassigned: Unassigned[] }) {
  return (
    <div className="card section unassigned">
      <div className="unassigned__head">
        <h2 className="section__title">Unassigned lessons</h2>
        <p className="form__note">
          Drag a chip onto the grid to schedule it. {unassigned.length} remaining.
        </p>
      </div>
      <ul className="unassigned__list">
        {unassigned.map((item) => (
          <li key={item.requirement_id}>
            <button
              type="button"
              className="unassigned-chip"
              draggable
              style={{ '--subject-colour': item.subject_colour } as React.CSSProperties}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy'
                event.dataTransfer.setData(UNASSIGNED_DRAG_TYPE, String(item.requirement_id))
                event.dataTransfer.setData('text/plain', `${item.subject_name} ${item.class_name}`)
              }}
              title={`${item.subject_name} for ${item.class_name} — ${item.remaining} of ${item.periods_per_week} left to schedule`}
            >
              <span className="unassigned-chip__subject">{item.subject_name}</span>
              <span className="unassigned-chip__class">{item.class_name}</span>
              {item.teacher_name && (
                <span className="unassigned-chip__meta">{item.teacher_name}</span>
              )}
              <span className="unassigned-chip__count">
                {item.remaining}/{item.periods_per_week}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
