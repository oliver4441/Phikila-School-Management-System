import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { ErrorState, LoadingBlock } from '../components/States'
import { AreaChart, BarChart } from '../components/charts'
import { useAsync } from '../lib/useAsync'
import { friendlyApiError } from '../lib/api'
import { analytics } from '../lib/analytics'

function money(n: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)
}

export default function InsightsPage() {
  const state = useAsync(
    () => Promise.all([analytics.attendanceSummary(30), analytics.financeSummary(90), analytics.timetableHealth()]),
    (err) => `Couldn't load analytics — ${friendlyApiError(err, 'load analytics')}`,
    [],
  )

  if (state.loading) return <LoadingBlock label="Loading insights" rows={6} />
  if (state.error) {
    return (
      <>
        <PageHeader title="Insights" description="School-wide trends across attendance, finance and timetabling." />
        <ErrorState title="Analytics could not load" message={state.error} onRetry={state.reload} retryLabel="Retry" />
      </>
    )
  }
  const [attendance, finance, health] = state.data ?? []

  return (
    <div>
      <PageHeader
        title="Insights"
        description="School-wide trends across attendance, finance and timetabling."
      />

      <div className="summary-grid" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card section summary-card">
          <span className="summary-card__label">Attendance rate · 30d</span>
          <p className="summary-card__value">{attendance?.totals.rate != null ? `${attendance.totals.rate}%` : '—'}</p>
          <span className="summary-card__detail">{attendance?.totals.marked ?? 0} records marked</span>
        </div>
        <div className="card section summary-card">
          <span className="summary-card__label">Collected · 90d</span>
          <p className="summary-card__value">{money(finance?.totals.collected ?? 0)}</p>
          <span className="summary-card__detail">{finance?.series.reduce((a, m) => a + m.payments, 0) ?? 0} payments</span>
        </div>
        <div className="card section summary-card">
          <span className="summary-card__label">Outstanding</span>
          <p className="summary-card__value">{money(finance?.totals.outstanding ?? 0)}</p>
          <span className="summary-card__detail">{money(finance?.totals.invoiced ?? 0)} invoiced</span>
        </div>
        <div className="card section summary-card">
          <span className="summary-card__label">Timetable coverage</span>
          <p className="summary-card__value">{health?.lessons.coverage_pct != null ? `${health.lessons.coverage_pct}%` : '—'}</p>
          <span className="summary-card__detail">
            {health?.lessons.unassigned ?? 0} unassigned of {health?.lessons.total ?? 0}
          </span>
        </div>
      </div>

      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div className="dashboard-columns">
        <section className="card section" aria-label="Attendance trend">
          <h2 className="section__title">Daily attendance rate — last 30 days</h2>
          <AreaChart
            ariaLabel="Daily attendance rate for the last 30 days"
            points={(attendance?.series ?? []).map((d) => ({ label: d.date, value: d.rate ?? 0 }))}
          />
        </section>

        <section className="card section" aria-label="Finance by month">
          <h2 className="section__title">Fees collected by month</h2>
          <BarChart
            ariaLabel="Fees collected per month over the last 90 days"
            points={(finance?.series ?? []).map((m) => ({ label: m.month.slice(2), value: m.collected }))}
            formatValue={money}
          />
        </section>

        <section className="card section" aria-label="Outstanding balances">
          <h2 className="section__title">Outstanding by month</h2>
          <BarChart
            ariaLabel="Outstanding fees per month"
            points={(finance?.series ?? []).map((m) => ({ label: m.month.slice(2), value: m.outstanding }))}
            formatValue={money}
          />
        </section>

        <section className="card section" aria-label="Timetable health">
          <h2 className="section__title">Timetable health</h2>
          <dl className="detail-list detail-list--two">
            <div>
              <dt>Assigned lessons</dt>
              <dd>{health?.lessons.assigned ?? 0}</dd>
            </div>
            <div>
              <dt>Unassigned lessons</dt>
              <dd>{health?.lessons.unassigned ?? 0}</dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>{health?.lessons.coverage_pct != null ? `${health.lessons.coverage_pct}%` : '—'}</dd>
            </div>
            <div>
              <dt>Audit events · 30d</dt>
              <dd>{health?.audit_events_30d ?? 0}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}
