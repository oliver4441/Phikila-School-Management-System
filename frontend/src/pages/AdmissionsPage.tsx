import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../components/States'
import { friendlyApiError } from '../lib/api'
import { admissions, type Application } from '../lib/admissions'

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  enrolled: 'success',
  accepted: 'success',
  shortlisted: 'warning',
  pending: 'neutral',
  rejected: 'danger',
}

export default function AdmissionsPage() {
  const [items, setItems] = useState<Application[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Application | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await admissions.applications())
    } catch (err) {
      setError(friendlyApiError(err, 'load applications'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <PageHeader
        title="Admissions"
        description={`Admission applications — ${items?.length ?? 0} total`}
        actions={
          <button className="button button--primary button--sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Close' : '+ New Application'}
          </button>
        }
      />

      {showForm && <ApplicationForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />}

      {selected && <ApplicationDetail application={selected} onClose={() => setSelected(null)} onChanged={load} />}

      {error ? (
        <ErrorState title="Applications could not load" message={error} onRetry={load} retryLabel="Retry" />
      ) : loading ? (
        <LoadingBlock label="Loading applications" rows={5} />
      ) : !items?.length ? (
        <EmptyState title="No applications" description="Create your first admission application to get started." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>No</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Applicant</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Level</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Parent</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                <th style={{ padding: 'var(--space-2)' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                  <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{a.application_number ?? `#${a.id}`}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{a.first_name} {a.middle_name} {a.last_name}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{a.applying_for_level || '—'}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{a.parent_name || '—'}</td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{a.status}</Badge>
                  </td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <button className="button button--ghost button--sm" onClick={() => setSelected(a)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ApplicationForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', middle_name: '',
    gender: '', date_of_birth: '', applying_for_level: '', previous_school: '',
    parent_name: '', parent_phone: '', parent_email: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await admissions.create({
        ...form,
        middle_name: form.middle_name || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        applying_for_level: form.applying_for_level || null,
        previous_school: form.previous_school || null,
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
        parent_email: form.parent_email || null,
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'create application'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">New Admission Application</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">First Name *</label>
            <input className="input" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Middle Name</label>
            <input className="input" value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Last Name *</label>
            <input className="input" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Gender</label>
            <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Select…</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Date of Birth</label>
            <input className="input" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Applying For Level</label>
            <input className="input" value={form.applying_for_level} onChange={(e) => setForm({ ...form, applying_for_level: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Previous School</label>
            <input className="input" value={form.previous_school} onChange={(e) => setForm({ ...form, previous_school: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Parent Name</label>
            <input className="input" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Parent Phone</label>
            <input className="input" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Parent Email</label>
            <input className="input" type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Submit Application'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

function ApplicationDetail({ application, onClose, onChanged }: {
  application: Application
  onClose: () => void
  onChanged: () => void
}) {
  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState('')

  async function updateStatus(status: string) {
    setBusy(true)
    setError(null)
    try {
      await admissions.update(application.id, {
        status,
        decision_note: note || null,
        decided_at: new Date().toISOString(),
      })
      setDecision(status)
      onChanged()
    } catch (err) {
      setError(friendlyApiError(err, 'update application'))
    } finally {
      setBusy(false)
    }
  }

  async function enroll() {
    setBusy(true)
    setError(null)
    try {
      await admissions.enroll(application.id, { stream: stream || undefined })
      onChanged()
      onClose()
    } catch (err) {
      setError(friendlyApiError(err, 'enroll applicant'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h2 className="section__title" style={{ marginBottom: 0 }}>
          {application.first_name} {application.last_name}
        </h2>
        <button className="button button--ghost button--sm" onClick={onClose}>✕ Close</button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: 'var(--space-3)' }}>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Application No</dt><dd style={{ fontWeight: 600 }}>{application.application_number ?? `#${application.id}`}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Gender</dt><dd>{application.gender || '—'}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>DOB</dt><dd>{application.date_of_birth || '—'}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Level</dt><dd>{application.applying_for_level || '—'}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Previous School</dt><dd>{application.previous_school || '—'}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Status</dt><dd><Badge tone={STATUS_TONE[application.status] ?? 'neutral'}>{application.status}</Badge></dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Parent</dt><dd>{application.parent_name || '—'}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Parent Phone</dt><dd>{application.parent_phone || '—'}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Parent Email</dt><dd>{application.parent_email || '—'}</dd></div>
      </dl>

      {application.status !== 'enrolled' && (
        <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-line)', paddingTop: 'var(--space-3)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Decision</h3>
          <div className="field" style={{ marginBottom: 'var(--space-2)' }}>
            <label className="field__label">Decision note</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the decision" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {['accepted', 'shortlisted', 'rejected'].map((status) => (
              <button key={status} className={`button button--${decision === status ? 'primary' : 'secondary'} button--sm`} disabled={busy} onClick={() => updateStatus(status)}>
                {status === 'accepted' ? 'Accept' : status === 'shortlisted' ? 'Shortlist' : 'Reject'}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <div className="field" style={{ flex: '0 1 12rem' }}>
              <label className="field__label">Stream</label>
              <input className="input" value={stream} onChange={(e) => setStream(e.target.value)} placeholder="e.g. A" />
            </div>
            <button className="button button--primary button--sm" disabled={busy} onClick={enroll}>
              Enroll as Student
            </button>
          </div>
        </div>
      )}
    </div>
  )
}