import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../components/States'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { friendlyApiError } from '../lib/api'
import { board, type BoardMember, type BoardMeeting, type Resolution } from '../lib/board'

export default function BoardPage() {
  const [members, setMembers] = useState<BoardMember[] | null>(null)
  const [meetings, setMeetings] = useState<BoardMeeting[] | null>(null)
  const [resolutions, setResolutions] = useState<Resolution[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<'members' | 'meetings' | 'resolutions'>('members')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<BoardMember | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, mt, r] = await Promise.all([board.members(), board.meetings(), board.resolutions()])
      setMembers(m)
      setMeetings(mt)
      setResolutions(r)
    } catch (err) {
      setError(friendlyApiError(err, 'load board data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function removeMember(id: number) {
    setBusy(true)
    setError(null)
    try {
      await board.removeMember(id)
      await load()
      setRemoveTarget(null)
    } catch (err) {
      setError(friendlyApiError(err, 'remove member'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Board Management"
        description="Members, meetings and resolutions"
        actions={
          <button className="button button--primary button--sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Close' : section === 'members' ? '+ Add Member' : section === 'meetings' ? '+ Schedule Meeting' : '+ Add Resolution'}
          </button>
        }
      />

      {error ? (
        <ErrorState title="Board data could not load" message={error} onRetry={load} retryLabel="Retry" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            <button className={`button button--${section === 'members' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('members'); setShowForm(false) }}>
              Members ({members?.length ?? 0})
            </button>
            <button className={`button button--${section === 'meetings' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('meetings'); setShowForm(false) }}>
              Meetings ({meetings?.length ?? 0})
            </button>
            <button className={`button button--${section === 'resolutions' ? 'primary' : 'secondary'} button--sm`} onClick={() => { setSection('resolutions'); setShowForm(false) }}>
              Resolutions ({resolutions?.length ?? 0})
            </button>
          </div>

          {showForm && (section === 'members'
            ? <MemberForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />
            : section === 'meetings'
              ? <MeetingForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />
              : <ResolutionForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} meetings={meetings ?? []} />)}

          {loading ? (
            <LoadingBlock label="Loading board data" rows={5} />
          ) : section === 'members' ? (
            !members?.length ? (
              <EmptyState title="No board members" description="Add the first board member to get started." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Position</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Email</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Phone</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Term</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: 'var(--space-2)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                        <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{m.full_name}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{m.position}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{m.email || '—'}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{m.phone || '—'}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{m.term_start || '—'} → {m.term_end || '—'}</td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <Badge tone={m.status === 'Active' ? 'success' : m.status === 'Resigned' ? 'danger' : 'warning'}>{m.status}</Badge>
                        </td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <button className="button button--ghost button--sm" disabled={busy} onClick={() => setRemoveTarget(m)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : section === 'meetings' ? (
            !meetings?.length ? (
              <EmptyState title="No meetings" description="Schedule the first board meeting." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Title</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Time</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Location</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((mt) => (
                      <tr key={mt.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                        <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{mt.title}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{mt.meeting_date}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{mt.start_time || '—'}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{mt.location || '—'}</td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <Badge tone={mt.status === 'held' ? 'success' : mt.status === 'cancelled' ? 'danger' : 'warning'}>{mt.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : !resolutions?.length ? (
            <EmptyState title="No resolutions" description="Record resolutions from board meetings." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Meeting</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Adopted</th>
                  </tr>
                </thead>
                <tbody>
                  {resolutions.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                      <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{r.title}</td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        {r.meeting_id ? meetings?.find((mt) => mt.id === r.meeting_id)?.title ?? `#${r.meeting_id}` : '—'}
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>
                        <Badge tone={r.status === 'adopted' ? 'success' : r.status === 'archived' ? 'neutral' : 'warning'}>{r.status}</Badge>
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>{r.adopted_at ? new Date(r.adopted_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove board member"
        description={removeTarget ? `Remove ${removeTarget.full_name} (${removeTarget.position}) from the board? This cannot be undone.` : ''}
        confirmLabel={busy ? 'Removing…' : 'Remove'}
        destructive
        onConfirm={() => removeTarget && removeMember(removeTarget.id)}
        onCancel={() => { if (!busy) setRemoveTarget(null) }}
      />
    </div>
  )
}

function MemberForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ full_name: '', position: '', email: '', phone: '', term_start: '', term_end: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await board.createMember({
        full_name: form.full_name,
        position: form.position,
        email: form.email || null,
        phone: form.phone || null,
        term_start: form.term_start || null,
        term_end: form.term_end || null,
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'add member'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Add Board Member</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 12rem' }}>
            <label className="field__label">Full Name *</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Position *</label>
            <input className="input" required value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="e.g. Chairperson" />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Term Start</label>
            <input className="input" type="date" value={form.term_start} onChange={(e) => setForm({ ...form, term_start: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Term End</label>
            <input className="input" type="date" value={form.term_end} onChange={(e) => setForm({ ...form, term_end: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Member'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

function MeetingForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: '', meeting_date: '', start_time: '', location: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await board.createMeeting({
        title: form.title,
        meeting_date: form.meeting_date,
        start_time: form.start_time || null,
        location: form.location || null,
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'schedule meeting'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Schedule Meeting</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 14rem' }}>
            <label className="field__label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Date *</label>
            <input className="input" required type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 6rem' }}>
            <label className="field__label">Time</label>
            <input className="input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Location</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Schedule Meeting'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

function ResolutionForm({ onCreated, onCancel, meetings }: { onCreated: () => void; onCancel: () => void; meetings: BoardMeeting[] }) {
  const [form, setForm] = useState({ meeting_id: '', title: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await board.createResolution({
        meeting_id: form.meeting_id ? Number(form.meeting_id) : null,
        title: form.title,
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'add resolution'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Add Resolution</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 12rem' }}>
            <label className="field__label">Meeting</label>
            <select className="input" value={form.meeting_id} onChange={(e) => setForm({ ...form, meeting_id: e.target.value })}>
              <option value="">No meeting</option>
              {meetings.map((mt) => (
                <option key={mt.id} value={mt.id}>{mt.title} ({mt.meeting_date})</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 16rem' }}>
            <label className="field__label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Resolution'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}