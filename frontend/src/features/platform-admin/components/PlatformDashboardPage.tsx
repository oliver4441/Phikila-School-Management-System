import { useCallback } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { Alert } from '../../../components/Alert'
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '../../../components/States'
import { DashboardIcon, InboxIcon, LayersIcon, SchoolIcon, UserIcon } from '../../../components/icons'
import { Link } from '../../../lib/router'
import { friendlyApiError } from '../../../lib/api'
import { useAsync } from '../../../lib/useAsync'
import { platform, type PlatformOverview } from '../../../lib/platform'

/* ======================================================= platform dashboard */
export function PlatformDashboardPage() {
  const toMessage = useCallback(
    (error: unknown) => friendlyApiError(error, 'load the platform dashboard'),
    [],
  )
  const { data, loading, error, reload } = useAsync<PlatformOverview>(platform.overview, toMessage)

  const cards = [
    { label: 'Schools', value: data?.schools ?? 0, detail: 'Registered institutions', to: '/platform/schools', icon: <SchoolIcon /> },
    { label: 'Users with access', value: data?.users ?? 0, detail: 'Approved platform users', to: '/platform/schools', icon: <UserIcon /> },
    { label: 'Teachers', value: data?.teachers ?? 0, detail: 'Across all schools', to: '/platform/schools', icon: <UserIcon /> },
    { label: 'Classes', value: data?.classes ?? 0, detail: 'Active teaching groups', to: '/platform/schools', icon: <LayersIcon /> },
    {
      label: 'Pending requests',
      value: data?.pending_requests ?? 0,
      detail: 'Awaiting a decision',
      to: '/platform/requests',
      icon: <InboxIcon />,
      highlight: (data?.pending_requests ?? 0) > 0,
    },
    { label: 'Platform admins', value: data?.super_admins ?? 0, detail: 'Deployment administrators', to: '/platform/admins', icon: <DashboardIcon /> },
  ]

  return (
    <div className="dashboard-page platform-dashboard">
      <PageHeader
        title="Platform dashboard"
        description="A clear operational view across every school on this deployment."
        breadcrumbs={[{ label: 'Platform' }, { label: 'Dashboard' }]}
        actions={
          <Link className="button button--primary button--sm" to="/platform/schools">
            Manage schools
          </Link>
        }
      />

      {error ? (
        <ErrorState title="Dashboard could not load" message={error} onRetry={reload} />
      ) : (
        <>
          {(data?.pending_requests ?? 0) > 0 && (
            <Alert tone="info" title="Accounts are waiting for approval">
              {data!.pending_requests} {data!.pending_requests === 1 ? 'person has' : 'people have'}{' '}
              requested access. <Link to="/platform/requests">Review requests</Link>.
            </Alert>
          )}

          <ul className="summary-grid">
            {cards.map((card) => (
              <li className="summary-card" key={card.label}>
                <Link className="summary-card__link" to={card.to}>
                  <span className="summary-card__icon" aria-hidden="true">{card.icon}</span>
                  <span className="summary-card__label">{card.label}</span>
                  <span
                    className={`summary-card__value ${card.highlight ? 'summary-card__value--warning' : ''}`}
                  >
                    {loading ? <Skeleton width="3rem" height="1.6rem" /> : card.value}
                  </span>
                  <span className="summary-card__detail">{card.detail}</span>
                </Link>
              </li>
            ))}
          </ul>

          <section className="card section dashboard-panel platform-dashboard__activity">
            <div className="dashboard-section__head">
              <div><p>Deployment activity</p><h2 className="section__title">Recent platform activity</h2></div>
              <span>Latest changes</span>
            </div>
            {loading ? (
              <LoadingBlock label="Loading recent activity" rows={3} />
            ) : (data?.recent.length ?? 0) === 0 ? (
              <EmptyState
                title="Nothing yet"
                description="School and administrator changes will be recorded here."
              />
            ) : (
              <ul className="activity-list">
                {data!.recent.map((entry, index) => (
                  <li className="activity" key={index}>
                    <span className="activity__dot" aria-hidden="true" />
                    <div>
                      <p className="activity__summary">{entry.summary}</p>
                      <p className="activity__meta">
                        {entry.actor ?? 'system'}
                        {entry.at ? ` · ${new Date(entry.at).toLocaleString()}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
