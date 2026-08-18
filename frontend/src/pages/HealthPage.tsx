import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../components/States'
import { friendlyApiError } from '../lib/api'
import { health, type HealthRecord, type WelfareCase } from '../lib/health'

const RECORD_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  medical: 'danger',
  checkup: 'success',
  immunization: 'warning',
  incident: 'neutral',
}

const WELFARE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  resolved: 'success',
  closed: 'neutral',
  in_progress: 'warning',
  open: 'danger',
}

export default function HealthPage() {
  const [records, setRecords] = useState<HealthRecord[] | null>(null)
  const [welfare, setWelfare] = useState<WelfareCase[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<'records' | 'welfare'>('records')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, w] = await Promise.all([health.records(), health.welfare()])
      setRecords(r)
      setWelfare(w)
    } catch (err) {
      setError(friendlyApiError(err, 'load health data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <PageHeader
        title="Health & Welfare"
        description={`Health records and welfare cases`}
        actions={
          <button className="button button--primary button--sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Close' : section === 'records' ? '+ Add Record' : '+ Open Case'}
          </button>
        }
      />

      {error ? (
        <ErrorState title="Health data could not load" message={error} onRetry={load} retryLabel="Retry" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <button className={`button button--${section === 'records' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('records'); setShowForm(false) }}>
              Health Records ({records?.length ?? 0})
            </button>
            <button className={`button button--${section === 'welfare' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('welfare'); setShowForm(false) }}>
              Welfare Cases ({welfare?.length ?? 0})
            </button>
          </div>

          {showForm && (section === 'records'
            ? <RecordForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />
            : <WelfareForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />)}

          {loading ? (
            <LoadingBlock label="Loading health data" rows={5} />
          ) : section === 'records' ? (
            !records?.length ? (
              <EmptyState title="No health records" description="Add medical, checkup, immunization or incident records for students." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Student</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Title</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Handler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                        <td style={{ padding: 'var(--space-2)' }}>{r.date}</td>
                        <td style={{ padding: 'var(--space-2)' }}><Badge tone={RECORD_TONE[r.record_type] ?? 'neutral'}>{r.record_type}</Badge></td>
                        <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>#{r.student_id}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{r.title}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{r.handler_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : !welfare?.length ? (
            <EmptyState title="No welfare cases" description="Open a counselling, support, disciplinary or other case." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Student</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Assigned To</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {welfare.map((w) => (
                    <tr key={w.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                      <td style={{ padding: 'var(--space-2)' }}>{w.case_type}</td>
                      <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{w.student_id ? `#${w.student_id}` : '—'}</td>
                      <td style={{ padding: 'var(--space-2)' }}>{w.title}</td>
                      <td style={{ padding: 'var(--space-2)' }}>{w.assigned_to || '—'}</td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        <Badge tone={WELFARE_TONE[w.status] ?? 'neutral'}>{w.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RecordForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    student_id: '', record_type: 'medical', date: '', title: '',
    blood_group: '', allergies: '', medication: '', handler_name: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await health.createRecord({
        student_id: Number(form.student_id),
        record_type: form.record_type as HealthRecord['record_type'],
        date: form.date || undefined,
        title: form.title,
        blood_group: form.blood_group || null,
        allergies: form.allergies || null,
        medication: form.medication || null,
        handler_name: form.handler_name || null,
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'add health record'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Add Health Record</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Student ID *</label>
            <input className="input" required type="number" min="1" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Type *</label>
            <select className="input" value={form.record_type} onChange={(e) => setForm({ ...form, record_type: e.target.value })}>
              <option value="medical">Medical</option>
              <option value="checkup">Checkup</option>
              <option value="immunization">Immunization</option>
              <option value="incident">Incident</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Date</label>
            <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 12rem' }}>
            <label className="field__label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Blood Group</label>
            <input className="input" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Allergies</label>
            <input className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Medication</label>
            <input className="input" value={form.medication} onChange={(e) => setForm({ ...form, medication: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Handler</label>
            <input className="input" value={form.handler_name} onChange={(e) => setForm({ ...form, handler_name: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Record'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

function WelfareForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ student_id: '', case_type: 'counseling', title: '', assigned_to: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await health.createWelfare({
        student_id: form.student_id ? Number(form.student_id) : null,
        case_type: form.case_type,
        title: form.title,
        assigned_to: form.assigned_to || null,
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'open welfare case'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Open Welfare Case</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Student ID</label>
            <input className="input" type="number" min="1" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Case Type *</label>
            <select className="input" value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })}>
              <option value="counseling">Counseling</option>
              <option value="support">Support</option>
              <option value="disciplinary">Disciplinary</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 12rem' }}>
            <label className="field__label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Assigned To</label>
            <input className="input" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Open Case'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}