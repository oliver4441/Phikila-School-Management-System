import { useCallback } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../components/States'
import { SchoolIcon } from '../components/icons'
import { api, friendlyApiError, type SchoolProfile } from '../lib/api'
import { useAsync } from '../lib/useAsync'

export function SchoolPage() {
  const toMessage = useCallback(
    (error: unknown) => friendlyApiError(error, 'load the school profile'),
    [],
  )
  const { data, loading, error, reload } = useAsync<SchoolProfile>(api.school, toMessage)

  const notSetUp = !loading && !error && data === null

  return (
    <>
      <PageHeader
        title="School profile"
        description="Registration and contact details held for this school."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'School profile' }]}
      />

      <section className="card section">
        {loading ? (
          <LoadingBlock label="Loading the school profile" rows={5} />
        ) : error ? (
          <ErrorState title="School profile could not load" message={error} onRetry={reload} />
        ) : notSetUp ? (
          <EmptyState
            title="No school profile yet"
            description="A school profile has not been created for this system. An administrator can create it through the API or an administrative tool."
            icon={<SchoolIcon width={22} height={22} />}
          />
        ) : data ? (
          <dl className="detail-list detail-list--two">
            <div>
              <dt>Name</dt>
              <dd>{data.name}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{data.slug || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Established</dt>
              <dd>{data.establishment_year || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{data.phone || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{data.email || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{data.address || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{data.timezone || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Academic year</dt>
              <dd>{data.academic_year || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Term</dt>
              <dd>{data.term || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Periods per day</dt>
              <dd>{data.session_count ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {data.status === 'active' || !data.status ? (
                  <Badge tone="success">Active</Badge>
                ) : (
                  <Badge tone="warning">{data.status}</Badge>
                )}
              </dd>
            </div>
            {data.motto && (
              <div className="detail-list__full">
                <dt>Motto</dt>
                <dd>{data.motto}</dd>
              </div>
            )}
          </dl>
        ) : null}
      </section>
    </>
  )
}