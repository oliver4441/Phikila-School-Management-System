import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../components/States'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { friendlyApiError } from '../lib/api'
import { principal, type Announcement, type Insight } from '../lib/principal'

const PRIORITY_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  urgent: 'danger',
  important: 'warning',
  normal: 'neutral',
}

export default function PrincipalPage() {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null)
  const [insights, setInsights] = useState<Insight[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<'announcements' | 'insights'>('announcements')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, i] = await Promise.all([principal.announcements(), principal.insights()])
      setAnnouncements(a)
      setInsights(i)
    } catch (err) {
      setError(friendlyApiError(err, 'load principal data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function publish(a: Announcement) {
    setBusy(true)
    setError(null)
    try {
      await principal.updateAnnouncement(a.id, {
        status: 'published',
        published_at: new Date().toISOString(),
      })
      await load()
    } catch (err) {
      setError(friendlyApiError(err, 'publish announcement'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(a: Announcement) {
    setBusy(true)
    setError(null)
    try {
      await principal.removeAnnouncement(a.id)
      await load()
      setDeleteTarget(null)
    } catch (err) {
      setError(friendlyApiError(err, 'delete announcement'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Principal"
        description="Announcements and leadership insights"
        actions={
          <button className="button button--primary button--sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Close' : section === 'announcements' ? '+ New Announcement' : '+ Add Insight'}
          </button>
        }
      />

      {error ? (
        <ErrorState title="Principal data could not load" message={error} onRetry={load} retryLabel="Retry" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <button className={`button button--${section === 'announcements' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('announcements'); setShowForm(false) }}>
              Announcements ({announcements?.length ?? 0})
            </button>
            <button className={`button button--${section === 'insights' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('insights'); setShowForm(false) }}>
              Insights ({insights?.length ?? 0})
            </button>
          </div>

          {showForm && (section === 'announcements'
            ? <AnnouncementForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />
            : <InsightForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />)}

          {loading ? (
            <LoadingBlock label="Loading principal data" rows={5} />
          ) : section === 'announcements' ? (
            !announcements?.length ? (
              <EmptyState title="No announcements" description="Create your first announcement to share with the school community." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Title</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Audience</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Priority</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Published</th>
                      <th style={{ padding: 'var(--space-2)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((a) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                        <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{a.title}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{a.audience}</td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <Badge tone={PRIORITY_TONE[a.priority] ?? 'neutral'}>{a.priority}</Badge>
                        </td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <Badge tone={a.status === 'published' ? 'success' : a.status === 'archived' ? 'neutral' : 'warning'}>{a.status}</Badge>
                        </td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          {a.published_at ? new Date(a.published_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            {a.status !== 'published' && (
                              <button className="button button--secondary button--sm" disabled={busy} onClick={() => publish(a)}>
                                Publish
                              </button>
                            )}
                            <button className="button button--ghost button--sm" disabled={busy} onClick={() => setDeleteTarget(a)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : !insights?.length ? (
            <EmptyState title="No insights" description="Add leadership insights for the school dashboard." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Summary</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Severity</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.map((i) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                      <td style={{ padding: 'var(--space-2)' }}>{i.insight_type}</td>
                      <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{i.title}</td>
                      <td style={{ padding: 'var(--space-2)' }}>{i.summary || '—'}</td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        <Badge tone={i.severity === 'critical' ? 'danger' : i.severity === 'warning' ? 'warning' : 'neutral'}>{i.severity}</Badge>
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>{i.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete announcement"
        description={deleteTarget ? `Delete "${deleteTarget.title}"? This cannot be undone.` : ''}
        confirmLabel={busy ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        onCancel={() => { if (!busy) setDeleteTarget(null) }}
      />
    </div>
  )
}

function AnnouncementForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', priority: 'normal' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await principal.createAnnouncement(form)
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'create announcement'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">New Announcement</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 14rem' }}>
            <label className="field__label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Audience</label>
            <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all">All</option>
              <option value="teachers">Teachers</option>
              <option value="students">Students</option>
              <option value="parents">Parents</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Priority</label>
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field__label">Body *</label>
          <textarea className="input" required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Create Announcement'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

function InsightForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ insight_type: 'academics', title: '', summary: '', severity: 'info' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await principal.createInsight({
        insight_type: form.insight_type,
        title: form.title,
        summary: form.summary || null,
        severity: form.severity as Insight['severity'],
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'add insight'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Add Insight</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Type</label>
            <select className="input" value={form.insight_type} onChange={(e) => setForm({ ...form, insight_type: e.target.value })}>
              <option value="attendance">Attendance</option>
              <option value="finance">Finance</option>
              <option value="academics">Academics</option>
              <option value="welfare">Welfare</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 14rem' }}>
            <label className="field__label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Severity</label>
            <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 16rem' }}>
            <label className="field__label">Summary</label>
            <input className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Insight'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}