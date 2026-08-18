import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, ErrorState } from '../components/States'
import { DataTable, type Column } from '../components/DataTable'
import { Field } from '../components/Field'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LayersIcon, SearchIcon } from '../components/icons'
import { friendlyApiError } from '../lib/api'
import { scheduling } from '../lib/scheduling'
import { useToast } from '../components/Toast'

type Constraint = {
  id: number
  type: string
  subject?: string | null
  payload?: Record<string, unknown> | null
  active?: boolean | null
  created_at?: string | null
}

export function ConstraintsPage() {
  const { notify } = useToast()
  const [rows, setRows] = useState<Constraint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rule, setRule] = useState('')
  const [subject, setSubject] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Constraint | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setRows((await scheduling.constraints()) as Constraint[]) }
    catch (err) { setError(friendlyApiError(err, 'load scheduling constraints')) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term)) : rows
  }, [rows, query])

  async function create() {
    if (!rule.trim() || saving) return
    setSaving(true)
    try {
      // tt_constraints requires `type`; subject and active are optional extras.
      await scheduling.createConstraint({
        type: rule.trim(),
        subject: subject.trim() || null,
        active: true,
      })
      notify('Constraint added.', 'success'); setRule(''); setSubject(''); setFormOpen(false); await load()
    } catch (err) { notify(friendlyApiError(err, 'create the constraint'), 'error') }
    finally { setSaving(false) }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try { await scheduling.deleteConstraint(pendingDelete.id); notify('Constraint removed.', 'success'); setPendingDelete(null); await load() }
    catch (err) { notify(friendlyApiError(err, 'remove the constraint'), 'error') }
    finally { setDeleting(false) }
  }

  const columns: Column<Constraint>[] = [
    { key: 'type', header: 'Constraint', render: (row) => row.type },
    { key: 'subject', header: 'Applies to', render: (row) => row.subject || '—' },
    { key: 'active', header: 'Status', render: (row) => <Badge tone={row.active === false ? 'warning' : 'success'}>{row.active === false ? 'Inactive' : 'Active'}</Badge> },
  ]

  return <>
    <PageHeader title="Scheduling constraints" description="Rules and preferences the timetable solver must respect or optimize." breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Timetable' }, { label: 'Constraints' }]} actions={<button className="button button--primary button--sm" type="button" onClick={() => setFormOpen((value) => !value)}>Add constraint</button>} />
    {formOpen && <section className="card section">
      <h2 className="section__title">New constraint</h2>
      <Alert tone="info">The backend remains the authority for supported constraint types and validation.</Alert>
      <div className="form form--grid">
        <Field label="Rule" required value={rule} onChange={(e) => setRule(e.target.value)} hint="e.g. No lesson overlaps for Form 2A on Monday" />
        <Field label="Applies to" value={subject} onChange={(e) => setSubject(e.target.value)} hint="optional — e.g. a teacher, class or room" />
        <div className="form__row form--grid__full"><button className="button button--primary" type="button" disabled={!rule.trim() || saving} onClick={() => void create()}>{saving ? 'Saving…' : 'Save constraint'}</button><button className="button button--secondary" type="button" onClick={() => setFormOpen(false)}>Cancel</button></div>
      </div>
    </section>}
    {error ? <ErrorState title="Constraints could not load" message={error} onRetry={load} /> : <section className="card section">
      <div className="toolbar"><div className="search"><SearchIcon className="search__icon" width={18} height={18} /><label className="visually-hidden" htmlFor="constraint-search">Search constraints</label><input id="constraint-search" className="input input--search" type="search" placeholder="Search constraints" value={query} onChange={(e) => setQuery(e.target.value)} /></div>{!loading && <span className="toolbar__count">{filtered.length} of {rows.length}</span>}</div>
      <DataTable caption="Scheduling constraints" columns={columns} rows={filtered} rowKey={(row) => row.id} loading={loading} loadingLabel="Loading constraints" empty={<EmptyState title="No constraints yet" description="Add constraints when the school needs rules beyond the default scheduling engine." icon={<LayersIcon width={22} height={22} />} />} rowActions={(row) => <button className="button button--ghost button--sm" type="button" onClick={() => setPendingDelete(row)}>Delete</button>} />
    </section>}
    <ConfirmDialog open={pendingDelete !== null} title="Delete constraint?" description={pendingDelete ? `"${pendingDelete.type}" will be permanently removed. This cannot be undone.` : ''} confirmLabel="Delete" destructive onConfirm={() => void confirmDelete()} onCancel={() => setPendingDelete(null)} />
  </>
}