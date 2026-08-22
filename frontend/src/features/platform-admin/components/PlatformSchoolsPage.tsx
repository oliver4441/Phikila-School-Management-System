import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { Alert } from '../../../components/Alert'
import { Badge, EmptyState, ErrorState } from '../../../components/States'
import { DataTable, type Column } from '../../../components/DataTable'
import { Field } from '../../../components/Field'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { SchoolIcon, SearchIcon } from '../../../components/icons'
import { useToast } from '../../../components/Toast'
import { useNavigate } from '../../../lib/router'
import { friendlyApiError } from '../../../lib/api'
import { platform, type School } from '../../../lib/platform'

/* ============================================================ schools list */
export function PlatformSchoolsPage() {
  const { notify } = useToast()
  const navigate = useNavigate()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<School | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSchools(await platform.schools(search || undefined, status))
    } catch (err) {
      setError(friendlyApiError(err, 'load schools'))
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleStatus(school: School) {
    if (busy) return
    setBusy(true)
    try {
      await platform.setSchoolStatus(school.id, school.status !== 'active')
      notify(
        school.status === 'active' ? 'School deactivated.' : 'School activated.',
        'success',
      )
      setConfirm(null)
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'change the school status'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<School>[] = [
    { key: 'name', header: 'School', render: (row) => row.name },
    { key: 'slug', header: 'Code', render: (row) => row.slug },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.status === 'active' ? 'success' : 'warning'}>
          {row.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    { key: 'users', header: 'Users', render: (row) => row.users },
    { key: 'teachers', header: 'Teachers', render: (row) => row.teachers },
    { key: 'classes', header: 'Classes', render: (row) => row.classes },
  ]

  return (
    <>
      <PageHeader
        title="Schools"
        description="Every school on the platform."
        breadcrumbs={[{ label: 'Platform', to: '/platform' }, { label: 'Schools' }]}
        actions={
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={() => setCreating(true)}
          >
            Add school
          </button>
        }
      />

      {creating && (
        <CreateSchoolForm
          onCancel={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false)
            await load()
          }}
        />
      )}

      {error ? (
        <ErrorState title="Schools could not load" message={error} onRetry={load} />
      ) : (
        <section className="card section">
          <div className="toolbar">
            <div className="search">
              <SearchIcon className="search__icon" width={18} height={18} />
              <label className="visually-hidden" htmlFor="school-search">
                Search schools
              </label>
              <input
                id="school-search"
                className="input input--search"
                type="search"
                placeholder="Search schools"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="field field--inline">
              <label className="field__label" htmlFor="school-status">
                Status
              </label>
              <select
                id="school-status"
                className="input input--select"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <DataTable
            caption="Schools"
            columns={columns}
            rows={schools}
            rowKey={(row) => row.id}
            loading={loading}
            loadingLabel="Loading schools"
            empty={
              <EmptyState
                title={search ? 'No matching schools' : 'No schools yet'}
                description={
                  search
                    ? 'Nothing matches your search.'
                    : 'Create the first school to start using the platform.'
                }
                icon={<SchoolIcon width={22} height={22} />}
                action={
                  !search ? (
                    <button
                      type="button"
                      className="button button--primary button--sm"
                      onClick={() => setCreating(true)}
                    >
                      Add school
                    </button>
                  ) : undefined
                }
              />
            }
            rowActions={(row) => (
              <>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() => navigate(`/platform/schools/detail?id=${row.id}`)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() =>
                    row.status === 'active' ? setConfirm(row) : toggleStatus(row)
                  }
                >
                  {row.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </>
            )}
          />
        </section>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={`Deactivate ${confirm?.name ?? 'this school'}?`}
        description="This prevents its users from accessing the application. All existing data is retained and the school can be reactivated at any time."
        confirmLabel={busy ? 'Working…' : 'Deactivate school'}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && toggleStatus(confirm)}
      />
    </>
  )
}

function CreateSchoolForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: () => void
}) {
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const next: Record<string, string> = {}
    if (name.trim().length < 3) next.name = 'Enter the full school name (3 characters or more).'
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug.trim().toLowerCase())) {
      next.slug = 'Use lowercase letters, numbers and hyphens only.'
    }
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      await platform.createSchool({ name: name.trim(), slug: slug.trim().toLowerCase() })
      notify('School created.', 'success')
      onCreated()
    } catch (err) {
      setFormError(friendlyApiError(err, 'create the school'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card section">
      <h2 className="section__title">New school</h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <form className="form form--grid" onSubmit={submit} noValidate>
        <Field
          label="School name"
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (!slug) {
              setSlug(
                event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
              )
            }
          }}
          error={errors.name}
        />
        <Field
          label="School code"
          required
          hint="A short unique identifier used in URLs, e.g. phikila-academy."
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          error={errors.slug}
        />
        <div className="form__row form--grid__full">
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create school'}
          </button>
          <button className="button button--secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
