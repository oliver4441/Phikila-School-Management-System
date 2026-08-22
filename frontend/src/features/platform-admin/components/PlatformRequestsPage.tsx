import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../../../components/States'
import { UserIcon } from '../../../components/icons'
import { useToast } from '../../../components/Toast'
import { friendlyApiError } from '../../../lib/api'
import { platform, type AccessRequest, type School } from '../../../lib/platform'
import { ROLE_LABELS } from '../constants'

/* ========================================================= access requests */
export function PlatformRequestsPage() {
  const { notify } = useToast()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, allSchools] = await Promise.all([
        platform.accessRequests(filter),
        platform.schools(),
      ])
      setRequests(rows)
      setSchools(allSchools)
    } catch (err) {
      setError(friendlyApiError(err, 'load access requests'))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(row: AccessRequest, approve: boolean, role: string, schoolId: number) {
    setBusy(row.id)
    try {
      await platform.decideRequest(row.id, {
        approve,
        role: approve ? role : undefined,
        school_id: approve ? schoolId : undefined,
      })
      notify(approve ? 'Access approved.' : 'Request declined.', 'success')
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'record that decision'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Access requests"
        description="People who signed up and are waiting to be approved."
        breadcrumbs={[{ label: 'Platform', to: '/platform' }, { label: 'Access requests' }]}
      />

      {error ? (
        <ErrorState title="Requests could not load" message={error} onRetry={load} />
      ) : (
        <section className="card section">
          <div className="toolbar">
            <div className="field field--inline">
              <label className="field__label" htmlFor="req-filter">
                Show
              </label>
              <select
                id="req-filter"
                className="input input--select"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingBlock label="Loading access requests" rows={3} />
          ) : requests.length === 0 ? (
            <EmptyState
              title={filter === 'pending' ? 'No requests waiting' : 'Nothing to show'}
              description={
                filter === 'pending'
                  ? 'New signups appear here for approval.'
                  : 'No requests match this filter.'
              }
              icon={<UserIcon width={22} height={22} />}
            />
          ) : (
            <ul className="request-list">
              {requests.map((row) => (
                <RequestCard
                  key={row.id}
                  request={row}
                  schools={schools}
                  busy={busy === row.id}
                  onDecide={decide}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function RequestCard({
  request,
  schools,
  busy,
  onDecide,
}: {
  request: AccessRequest
  schools: School[]
  busy: boolean
  onDecide: (row: AccessRequest, approve: boolean, role: string, schoolId: number) => void
}) {
  const [role, setRole] = useState(request.requested_role)
  const [schoolId, setSchoolId] = useState<string>(
    request.requested_school_id ? String(request.requested_school_id) : '',
  )
  const pending = request.status === 'pending'

  return (
    <li className="request-card">
      <div className="request-card__head">
        <div>
          <p className="request-card__email">{request.email}</p>
          <p className="request-card__meta">
            Asked to join <strong>{request.requested_school_name ?? 'an unnamed school'}</strong> as{' '}
            <strong>{ROLE_LABELS[request.requested_role] ?? request.requested_role}</strong>
          </p>
        </div>
        <Badge
          tone={
            request.status === 'approved'
              ? 'success'
              : request.status === 'rejected'
                ? 'danger'
                : 'warning'
          }
        >
          {request.status}
        </Badge>
      </div>

      {request.note && <p className="request-card__note">“{request.note}”</p>}

      {pending && (
        <>
          <p className="form__note">
            You decide the actual role and school. The request above is only what they asked for.
          </p>
          <div className="request-card__controls">
            <div className="field field--inline">
              <label className="field__label" htmlFor={`role-${request.id}`}>
                Grant role
              </label>
              <select
                id={`role-${request.id}`}
                className="input input--select"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--inline">
              <label className="field__label" htmlFor={`school-${request.id}`}>
                At school
              </label>
              <select
                id={`school-${request.id}`}
                className="input input--select"
                value={schoolId}
                onChange={(event) => setSchoolId(event.target.value)}
              >
                <option value="">Choose…</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form__row">
            <button
              type="button"
              className="button button--primary button--sm"
              disabled={busy || !schoolId}
              onClick={() => onDecide(request, true, role, Number(schoolId))}
            >
              {busy ? 'Working…' : 'Approve'}
            </button>
            <button
              type="button"
              className="button button--secondary button--sm"
              disabled={busy}
              onClick={() => onDecide(request, false, role, 0)}
            >
              Decline
            </button>
          </div>
        </>
      )}
    </li>
  )
}
