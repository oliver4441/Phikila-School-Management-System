import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../components/States'
import { friendlyApiError } from '../lib/api'
import { useToast } from '../components/Toast'
import { attendance, type AttendanceSession } from '../lib/attendance'
import { students, type Student } from '../lib/students'

export default function AttendancePage() {
  const { notify } = useToast()
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)
  const [classStudents, setClassStudents] = useState<Student[]>([])
  const [showNewSession, setShowNewSession] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await attendance.listSessions()
      setSessions(result)
    } catch (err) {
      setError(friendlyApiError(err, 'load attendance'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function openSession(classId: number, date: string) {
    if (busy) return
    setBusy(true)
    try {
      const session = await attendance.openSession(classId, date)
      setSessions([session, ...sessions])
      setShowNewSession(false)
      notify(`Register opened for class ${classId}.`, 'success')
    } catch (err) {
      notify(friendlyApiError(err, 'open attendance session'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function markStudent(studentId: number, status: string) {
    if (!selectedSession || busy) return
    setBusy(true)
    try {
      await attendance.mark(selectedSession.id, studentId, status)
      const updated = await attendance.listSessions({ class_id: selectedSession.class_id })
      const s = updated.find((x) => x.id === selectedSession.id)
      if (s) setSelectedSession(s)
      notify('Attendance updated.', 'success')
    } catch (err) {
      notify(friendlyApiError(err, 'mark attendance'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function bulkPresent() {
    if (!selectedSession || !classStudents.length || busy) return
    setBusy(true)
    const ids = classStudents.map((s) => s.id)
    try {
      await attendance.bulkMark(selectedSession.id, ids, 'present')
      notify('Marked all students present.', 'success')
      await load()
      setSelectedSession(null)
    } catch (err) {
      notify(friendlyApiError(err, 'bulk mark'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Track student attendance by class and date."
        actions={
          <button className="button button--primary button--sm" onClick={() => setShowNewSession(!showNewSession)}>
            {showNewSession ? '✕ Close' : '+ Open Register'}
          </button>
        }
      />

      {showNewSession && (
        <NewSessionForm busy={busy} onSubmit={openSession} onCancel={() => setShowNewSession(false)} />
      )}

      {selectedSession && (
        <MarkingPanel
          session={selectedSession}
          students={classStudents}
          busy={busy}
          onMark={markStudent}
          onBulkPresent={bulkPresent}
          onClose={() => setSelectedSession(null)}
        />
      )}

      {error ? (
        <ErrorState title="Attendance could not load" message={error} onRetry={load} retryLabel="Retry" />
      ) : loading ? (
        <LoadingBlock label="Loading attendance" rows={4} />
      ) : !sessions.length ? (
        <EmptyState title="No attendance sessions" description="Open a register for a class to start tracking attendance." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {sessions.map((s) => (
            <div key={s.id} className="card" style={{ padding: 'var(--space-3)', cursor: 'pointer' }}
              onClick={async () => {
                setSelectedSession(s)
                try {
                  const result = await students.list({ class_id: s.class_id, page_size: 100 })
                  setClassStudents(result.items)
                } catch { /* ignore */ }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Class #{s.class_id}</strong> — {s.date}
                  <span style={{ color: 'var(--color-ink-muted)', fontSize: '0.85rem', marginLeft: 'var(--space-2)' }}>
                    {s.records?.length || 0} records
                  </span>
                </div>
                <Badge tone={s.status === 'open' ? 'success' : 'warning'}>{s.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewSessionForm({ busy, onSubmit, onCancel }: { busy: boolean; onSubmit: (classId: number, date: string) => void; onCancel: () => void }) {
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Open Attendance Register</h2>
      <form style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); if (classId && date) onSubmit(Number(classId), date) }}>
        <div className="field">
          <label className="field__label" htmlFor="att-class">Class ID</label>
          <input id="att-class" className="input" type="number" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="e.g. 1" required />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="att-date">Date</label>
          <input id="att-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <button type="submit" className="button button--primary" disabled={!classId || !date || busy}>{busy ? 'Opening…' : 'Open'}</button>
        <button type="button" className="button button--secondary" onClick={onCancel}>Cancel</button>
      </form>
    </div>
  )
}

function MarkingPanel({ session, students: studs, busy, onMark, onBulkPresent, onClose }: {
  session: AttendanceSession; students: Student[]; busy: boolean;
  onMark: (studentId: number, status: string) => void; onBulkPresent: () => void; onClose: () => void
}) {
  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h2 className="section__title" style={{ marginBottom: 0 }}>Mark Attendance — {session.date}</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary button--sm" onClick={onBulkPresent} disabled={busy || studs.length === 0}>✓ All Present</button>
          <button className="button button--ghost button--sm" onClick={onClose} aria-label="Close marking panel">✕</button>
        </div>
      </div>
      {studs.length === 0 ? (
        <p style={{ color: 'var(--color-ink-muted)' }}>No students in this class.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {studs.map((s: Student) => {
            const record = session.records?.find((r) => r.student_id === s.id)
            return (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)' }}>
                <span>{s.first_name} {s.last_name} <span style={{ color: 'var(--color-ink-muted)', fontSize: '0.8rem' }}>({s.admission_number})</span></span>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }} role="group" aria-label={`Attendance for ${s.first_name} ${s.last_name}`}>
                  {(['present', 'absent', 'late', 'excused'] as const).map((st) => (
                    <button key={st} className={`button button--sm ${record?.status === st ? 'button--primary' : 'button--ghost'}`}
                      aria-label={`Mark ${s.first_name} ${s.last_name} as ${st}`}
                      aria-pressed={record?.status === st}
                      disabled={busy}
                      onClick={() => onMark(s.id, st)}>
                      {st.charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
