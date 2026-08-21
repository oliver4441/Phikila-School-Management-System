import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, LoadingBlock, Spinner } from '../components/States'
import { friendlyApiError } from '../lib/api'
import { useToast } from '../components/Toast'
import { examinations, type ExamSeries, type Examination, type StudentResult } from '../lib/examinations'
import { streamAnalytics } from '../lib/ai'

export default function ExaminationsPage() {
  const { notify } = useToast()
  const [series, setSeries] = useState<ExamSeries[]>([])
  const [exams, setExams] = useState<Examination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedExam, setSelectedExam] = useState<Examination | null>(null)
  const [results, setResults] = useState<StudentResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [showNewSeries, setShowNewSeries] = useState(false)
  const [showNewExam, setShowNewExam] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, e] = await Promise.all([examinations.listSeries(), examinations.list()])
      setSeries(s)
      setExams(e)
    } catch (err) {
      setError(friendlyApiError(err, 'load examinations'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function loadResults(examId: number) {
    setSelectedExam(exams.find((e) => e.id === examId) || null)
    setResults([])
    setResultsLoading(true)
    try {
      const r = await examinations.generateResults(examId)
      setResults(r)
    } catch (err) {
      notify(friendlyApiError(err, 'generate results'), 'error')
      setSelectedExam(null)
    } finally {
      setResultsLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Examinations"
        description="Manage exam series, score entry, and results."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="button button--secondary button--sm" onClick={() => setShowNewSeries(!showNewSeries)}>+ Series</button>
            <button className="button button--primary button--sm" onClick={() => setShowNewExam(!showNewExam)}>+ Exam</button>
          </div>
        }
      />

      {error && <Alert tone="error" title="Examinations could not load">{error}</Alert>}

      {showNewSeries && <NewSeriesForm onCreated={() => { setShowNewSeries(false); void load() }} onCancel={() => setShowNewSeries(false)} />}
      {showNewExam && <NewExamForm series={series} onCreated={() => { setShowNewExam(false); void load() }} onCancel={() => setShowNewExam(false)} />}

      {selectedExam && (
        <ResultsTable
          exam={selectedExam}
          results={results}
          loading={resultsLoading}
          onClose={() => { setSelectedExam(null); setResults([]) }}
        />
      )}

      {loading ? (
        <LoadingBlock label="Loading examinations" rows={4} />
      ) : (
        <>
          {series.length > 0 && (
            <section className="section" style={{ marginBottom: 'var(--space-4)' }}>
              <h2 className="section__title">Exam Series</h2>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {series.map((s) => (
                  <div key={s.id} className="card" style={{ padding: 'var(--space-3)', flex: '1 1 14rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong>{s.name}</strong>
                    <Badge tone={s.status === 'active' ? 'success' : 'warning'}>{s.status}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="section">
            <h2 className="section__title">Examinations</h2>
            {!exams.length ? (
              <EmptyState title="No examinations" description="Create an exam series and add examinations to get started." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {exams.map((e) => (
                  <div key={e.id} className="card" style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <div>
                      <strong>{e.name}</strong>
                      <span style={{ color: 'var(--color-ink-muted)', fontSize: '0.85rem', marginLeft: 'var(--space-2)' }}>
                        {e.total_marks} marks · Pass: {e.passing_marks}
                        {e.exam_date ? ` · ${e.exam_date}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <Badge tone={e.status === 'active' ? 'success' : 'warning'}>{e.status}</Badge>
                      <button className="button button--ghost button--sm" onClick={() => void loadResults(e.id)}>Results</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function NewSeriesForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">New Exam Series</h2>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
          <label className="field__label" htmlFor="series-name">Series Name</label>
          <input id="series-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026 Mid-Term" />
        </div>
        <button className="button button--primary" disabled={!name.trim() || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              await examinations.createSeries({ name: name.trim() })
              notify('Exam series created.', 'success')
              onCreated()
            } catch (err) {
              notify(friendlyApiError(err, 'create the exam series'), 'error')
              setSubmitting(false)
            }
          }}>
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button className="button button--secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function NewExamForm({ series, onCreated, onCancel }: { series: ExamSeries[]; onCreated: () => void; onCancel: () => void }) {
  const { notify } = useToast()
  const [form, setForm] = useState({ series_id: series[0]?.id ?? 0, name: '', total_marks: 100, passing_marks: 50 })
  const [submitting, setSubmitting] = useState(false)
  const noSeries = series.length === 0
  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">New Examination</h2>
      {noSeries ? (
        <Alert tone="info">Create an exam series first, then you can add examinations to it.</Alert>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field">
            <label className="field__label" htmlFor="exam-series">Series</label>
            <select id="exam-series" className="input" value={form.series_id} onChange={(e) => setForm({ ...form, series_id: Number(e.target.value) })}>
              {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
            <label className="field__label" htmlFor="exam-name">Exam Name</label>
            <input id="exam-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics Mid-Term" />
          </div>
          <div className="field"><label className="field__label" htmlFor="exam-total">Total</label><input id="exam-total" className="input" type="number" min={1} value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: Number(e.target.value) })} /></div>
          <div className="field"><label className="field__label" htmlFor="exam-pass">Pass</label><input id="exam-pass" className="input" type="number" min={0} value={form.passing_marks} onChange={(e) => setForm({ ...form, passing_marks: Number(e.target.value) })} /></div>
          <button className="button button--primary" disabled={!form.name.trim() || !form.series_id || submitting}
            onClick={async () => {
              setSubmitting(true)
              try {
                await examinations.create(form)
                notify('Examination created.', 'success')
                onCreated()
              } catch (err) {
                notify(friendlyApiError(err, 'create the examination'), 'error')
                setSubmitting(false)
              }
            }}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
          <button className="button button--secondary" onClick={onCancel}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function ResultsTable({ exam, results, loading, onClose }: { exam: Examination; results: StudentResult[]; loading: boolean; onClose: () => void }) {
  const { notify } = useToast()
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showAi, setShowAi] = useState(false)

  function runAiAnalysis() {
    if (aiLoading || results.length === 0) return
    setShowAi(true)
    setAiLoading(true)
    setAiAnalysis('')

    streamAnalytics({
      endpoint: '/analytics/grades',
      body: { className: exam.name },
      onToken: (token) => setAiAnalysis((prev) => prev + token),
      onDone: () => setAiLoading(false),
      onError: (detail) => {
        setAiLoading(false)
        notify(detail, 'error')
      },
    })
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <h2 className="section__title" style={{ marginBottom: 0 }}>Results — {exam.name}</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--secondary button--sm" onClick={runAiAnalysis} disabled={aiLoading || results.length === 0}>
            {aiLoading ? <><Spinner label="Analyzing" /> Analyzing…</> : '✦ AI Analysis'}
          </button>
          <button className="button button--ghost button--sm" onClick={onClose}>✕ Close</button>
        </div>
      </div>
      {loading ? (
        <LoadingBlock label="Generating results" rows={3} />
      ) : results.length === 0 ? (
        <EmptyState title="No results yet" description="Scores have not been entered for this examination. Once entries exist, results will appear here." />
      ) : (
        <>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-3)' }}>
            {results.length} students · Total: {exam.total_marks} · Pass: {exam.passing_marks}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>#</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Adm No</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'right' }}>Average</th>
                  <th style={{ padding: 'var(--space-2)', textAlign: 'right' }}>Position</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.student_id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                    <td style={{ padding: 'var(--space-2)' }}>{i + 1}</td>
                    <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{r.student_name}</td>
                    <td style={{ padding: 'var(--space-2)' }}>{r.admission_number}</td>
                    <td style={{ padding: 'var(--space-2)', textAlign: 'right', fontWeight: 700 }}>{r.average}</td>
                    <td style={{ padding: 'var(--space-2)', textAlign: 'right' }}>{r.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>          </div>
        </>
      )}

      {/* AI Analysis panel */}
      {showAi && (
        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>✦ Grade Analysis</h3>
            <button className="button button--ghost button--sm" onClick={() => { setShowAi(false); setAiAnalysis('') }}>✕ Dismiss</button>
          </div>
          {aiLoading && !aiAnalysis && (
            <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.875rem' }}><Spinner label="Analyzing grades" /> Analyzing grades…</p>
          )}
          {aiAnalysis && (
            <div
              style={{ fontSize: '0.9rem', lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
            />
          )}
        </div>
      )}
    </div>
  )
}
