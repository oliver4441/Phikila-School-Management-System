import { Badge } from '../../../components/States'
import { Link } from '../../../lib/router'
import type { Conflict } from '../../../lib/scheduling'

export function ConflictsPanel({
  conflicts,
  readOnly,
  onAssignRooms,
}: {
  conflicts: Conflict[]
  readOnly: boolean
  onAssignRooms: () => void
}) {
  return (
    <div className="card section">
      <div className="unassigned__head">
        <h2 className="section__title">Conflicts</h2>
        {!readOnly && (
          <button type="button" className="button button--ghost button--sm" onClick={onAssignRooms}>
            Assign rooms
          </button>
        )}
      </div>
      <ul className="conflict-list">
        {conflicts.slice(0, 12).map((conflict, index) => (
          <li key={index} className={`conflict conflict--${conflict.severity}`}>
            <Badge tone={conflict.severity === 'hard' ? 'danger' : 'warning'}>
              {conflict.severity === 'hard' ? 'Blocking' : 'Warning'}
            </Badge>
            <span>{conflict.message}</span>
          </li>
        ))}
      </ul>
      {conflicts.length > 12 && (
        <p className="form__note">
          Showing 12 of {conflicts.length}.{' '}
          <Link className="link" to="/analytics">
            See the full analysis
          </Link>
          .
        </p>
      )}
    </div>
  )
}
