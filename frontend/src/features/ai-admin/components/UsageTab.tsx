import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../components/Alert'
import { friendlyApiError } from '../../../lib/api'
import { getAuditLog, featureLabel, type AiAuditEntry } from '../../../lib/ai'

export function UsageTab() {
  const [audit, setAudit] = useState<AiAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAudit(await getAuditLog({ limit: 50 }))
    } catch (err) {
      setError(friendlyApiError(err, 'load usage data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Aggregate stats from audit log
  const stats = useMemo(() => {
    const bySchool = new Map<string, { requests: number; tokens: number }>()
    const byFeature = new Map<string, { requests: number; tokens: number }>()
    let totalTokens = 0

    for (const entry of audit) {
      const school = entry.school_name ?? 'Unknown'
      const prev = bySchool.get(school) ?? { requests: 0, tokens: 0 }
      prev.requests++
      prev.tokens += entry.tokens_in + entry.tokens_out
      bySchool.set(school, prev)

      const feat = entry.request_type ?? 'other'
      const pf = byFeature.get(feat) ?? { requests: 0, tokens: 0 }
      pf.requests++
      pf.tokens += entry.tokens_in + entry.tokens_out
      byFeature.set(feat, pf)

      totalTokens += entry.tokens_in + entry.tokens_out
    }

    return {
      totalRequests: audit.length,
      totalTokens,
      bySchool: Array.from(bySchool.entries()).map(([name, data]) => ({ name, ...data })),
      byFeature: Array.from(byFeature.entries()).map(([name, data]) => ({ name, ...data })),
    }
  }, [audit])

  return (
    <>
      {/* Summary cards */}
      <div className="summary-grid" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="summary-card">
          <div className="summary-card__link">
            <span className="summary-card__label">Total Requests</span>
            <span className="summary-card__value">{loading ? '—' : stats.totalRequests}</span>
            <span className="summary-card__detail">Last 50 interactions</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card__link">
            <span className="summary-card__label">Total Tokens</span>
            <span className="summary-card__value">{loading ? '—' : stats.totalTokens.toLocaleString()}</span>
            <span className="summary-card__detail">Input + output combined</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card__link">
            <span className="summary-card__label">Active Schools</span>
            <span className="summary-card__value">{loading ? '—' : stats.bySchool.length}</span>
            <span className="summary-card__detail">Using AI features</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card__link">
            <span className="summary-card__label">Feature Types</span>
            <span className="summary-card__value">{loading ? '—' : stats.byFeature.length}</span>
            <span className="summary-card__detail">Active AI features</span>
          </div>
        </div>
      </div>

      {/* By feature */}
      {stats.byFeature.length > 0 && (
        <section className="card section">
          <h2 className="section__title">Usage by Feature</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Requests</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {stats.byFeature.map((f) => (
                  <tr key={f.name}>
                    <td>{featureLabel(f.name)}</td>
                    <td>{f.requests}</td>
                    <td>{f.tokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* By school */}
      {stats.bySchool.length > 0 && (
        <section className="card section">
          <h2 className="section__title">Usage by School</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Requests</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {stats.bySchool.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.requests}</td>
                    <td>{s.tokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {error && <Alert tone="error">{error}</Alert>}
    </>
  )
}
