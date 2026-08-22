import { useCallback, useEffect, useState } from 'react'
import { Alert } from '../../../components/Alert'
import { Badge, EmptyState, LoadingBlock } from '../../../components/States'
import { friendlyApiError } from '../../../lib/api'
import { getAuditLog, type AiAuditEntry } from '../../../lib/ai'
import { SparkIcon } from '../../../components/icons'

export function AuditTab() {
  const [audit, setAudit] = useState<AiAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAudit(await getAuditLog({ limit: 100 }))
    } catch (err) {
      setError(friendlyApiError(err, 'load audit log'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="card section">
      <h2 className="section__title">AI Audit Log</h2>
      <p className="form__note" style={{ marginBottom: 'var(--space-4)' }}>
        Searchable log of all AI interactions across schools.
      </p>

      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : loading ? (
        <LoadingBlock label="Loading audit log" rows={5} />
      ) : audit.length === 0 ? (
        <EmptyState
          title="No AI activity yet"
          description="Audit entries will appear here once users start interacting with AI features."
          icon={<SparkIcon width={22} height={22} />}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>School</th>
                <th>Tokens</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.at).toLocaleString()}</td>
                  <td>{entry.actor ?? '—'}</td>
                  <td>{entry.action}</td>
                  <td>{entry.school_name ?? '—'}</td>
                  <td>{(entry.tokens_in + entry.tokens_out).toLocaleString()}</td>
                  <td>{entry.duration_ms != null ? `${entry.duration_ms}ms` : '—'}</td>
                  <td>
                    <Badge tone={entry.success ? 'success' : 'danger'}>
                      {entry.success ? 'OK' : 'Error'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
