import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../../../components/States'
import { DataTable, type Column } from '../../../components/DataTable'
import { Field } from '../../../components/Field'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { UserIcon } from '../../../components/icons'
import { useToast } from '../../../components/Toast'
import { useSearchParams } from '../../../lib/router'
import { friendlyApiError } from '../../../lib/api'
import { platform, type School, type SchoolUser } from '../../../lib/platform'
import { ROLE_LABELS } from '../constants'

/* ========================================================== school details */
export function PlatformSchoolDetailPage() {
  const params = useSearchParams()
  const { notify } = useToast()
  const schoolId = Number(params.get('id') || 0)

  const [school, setSchool] = useState<School | null>(null)
  const [users, setUsers] = useState<SchoolUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('admin')
  const [adding, setAdding] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<SchoolUser | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [detail, members] = await Promise.all([
        platform.school(schoolId),
        platform.schoolUsers(schoolId),
      ])
      setSchool(detail)
      setUsers(members)
    } catch (err) {
      setError(friendlyApiError(err, 'load this school'))
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    void load()
  }, [load])

  async function addAdmin(event: FormEvent) {
    event.preventDefault()
    if (adding || !email.trim()) return
    setAdding(true)
    try {
      await platform.addAdministrator(schoolId, email.trim(), role)
      notify('Administrator assigned.', 'success')
      setEmail('')
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'assign that administrator'), 'error')
    } finally {
      setAdding(false)
    }
  }

  async function remove(user: SchoolUser) {
    if (removing) return
    setRemoving(true)
    try {
      await platform.removeAdministrator(schoolId, user.user_id)
      notify('Access removed.', 'success')
      setConfirmRemove(null)
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'remove that user'), 'error')
    } finally {
      setRemoving(false)
    }
  }

  const columns: Column<SchoolUser>[] = [
    { key: 'email', header: 'Email', render: (row) => row.email || row.user_id },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <Badge>{ROLE_LABELS[row.role] ?? row.role}</Badge>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) =>
        row.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Inactive</Badge>,
    },
  ]

  return (
    <>
      <PageHeader
        title={school?.name ?? 'School'}
        description={school ? `Code ${school.slug}` : undefined}
        breadcrumbs={[
          { label: 'Platform', to: '/platform' },
          { label: 'Schools', to: '/platform/schools' },
          { label: school?.name ?? 'School' },
        ]}
      />

      {error ? (
        <ErrorState title="School could not load" message={error} onRetry={load} />
      ) : loading ? (
        <div className="card section">
          <LoadingBlock label="Loading school" rows={4} />
        </div>
      ) : !school ? (
        <EmptyState title="School not found" description="This school may have been removed." />
      ) : (
        <>
          <section className="card section">
            <h2 className="section__title">Overview</h2>
            <dl className="detail-list detail-list--two">
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge tone={school.status === 'active' ? 'success' : 'warning'}>
                    {school.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt>Users</dt>
                <dd>{school.users}</dd>
              </div>
              <div>
                <dt>Teachers</dt>
                <dd>{school.teachers}</dd>
              </div>
              <div>
                <dt>Classes</dt>
                <dd>{school.classes}</dd>
              </div>
            </dl>
          </section>

          <section className="card section">
            <h2 className="section__title">Administrators and members</h2>
            <form className="form form--grid" onSubmit={addAdmin}>
              <Field
                label="Email address"
                type="email"
                autoComplete="email"
                hint="The person must have signed in at least once."
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <div className="field">
                <label className="field__label" htmlFor="assign-role">
                  Role
                </label>
                <select
                  id="assign-role"
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
              <div className="form__row form--grid__full">
                <button className="button button--primary" type="submit" disabled={adding}>
                  {adding ? 'Assigning…' : 'Assign role'}
                </button>
              </div>
            </form>

            <DataTable
              caption="School members"
              columns={columns}
              rows={users}
              rowKey={(row) => row.user_id}
              empty={
                <EmptyState
                  title="No members yet"
                  description="Assign an administrator so this school can be managed."
                  icon={<UserIcon width={22} height={22} />}
                />
              }
              rowActions={(row) => (
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() => setConfirmRemove(row)}
                >
                  Remove
                </button>
              )}
            />
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove this person's access?"
        description={`${confirmRemove?.email ?? 'This user'} will lose access to ${school?.name ?? 'this school'}. Their account and data are retained.`}
        confirmLabel={removing ? 'Removing…' : 'Remove access'}
        destructive
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && remove(confirmRemove)}
      />
    </>
  )
}
