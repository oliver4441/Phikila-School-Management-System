import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, ErrorState, LoadingBlock, Spinner } from '../components/States'
import { Field, PasswordField } from '../components/Field'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { friendlyApiError } from '../lib/api'
import {
  getAdminConfig,
  saveProviderConfig,
  removeProvider,
  saveRateLimit,
  saveFeatureToggle,
  getAuditLog,
  featureLabel,
  type AiAdminConfig,
  type AiAuditEntry,
} from '../lib/ai'
import { SparkIcon } from '../components/icons'

// ── Tab bar ────────────────────────────────────────────────────────────

type Tab = 'providers' | 'limits' | 'features' | 'usage' | 'audit'

const TABS: { key: Tab; label: string }[] = [
  { key: 'providers', label: 'Providers' },
  { key: 'limits', label: 'Rate Limits' },
  { key: 'features', label: 'Features' },
  { key: 'usage', label: 'Usage' },
  { key: 'audit', label: 'Audit Log' },
]

// ── Main page ──────────────────────────────────────────────────────────

export function AiAdminPage() {
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>('providers')
  const [config, setConfig] = useState<AiAdminConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setConfig(await getAdminConfig())
    } catch (err) {
      setError(friendlyApiError(err, 'load AI configuration'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <PageHeader
        title="AI Configuration"
        description="Manage language model providers, rate limits, and feature toggles for all schools."
        breadcrumbs={[{ label: 'Settings' }, { label: 'AI Configuration' }]}
      />

      {error ? (
        <ErrorState title="Configuration could not load" message={error} onRetry={load} />
      ) : loading ? (
        <div className="card section">
          <LoadingBlock label="Loading AI configuration" rows={6} />
        </div>
      ) : !config ? (
        <EmptyState
          title="No configuration"
          description="AI configuration could not be loaded."
          icon={<SparkIcon width={22} height={22} />}
        />
      ) : (
        <>
          {/* Tab bar */}
          <nav className="ai-admin-tabs" aria-label="AI settings">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`ai-admin-tab ${tab === t.key ? 'ai-admin-tab--active' : ''}`}
                onClick={() => setTab(t.key)}
                aria-selected={tab === t.key}
                role="tab"
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          {tab === 'providers' && <ProvidersTab config={config} onReload={load} notify={notify} />}
          {tab === 'limits' && <LimitsTab config={config} onReload={load} notify={notify} />}
          {tab === 'features' && <FeaturesTab config={config} onReload={load} notify={notify} />}
          {tab === 'usage' && <UsageTab />}
          {tab === 'audit' && <AuditTab />}
        </>
      )}
    </>
  )
}

// ── Providers tab ──────────────────────────────────────────────────────

function ProvidersTab({
  config,
  onReload,
  notify,
}: {
  config: AiAdminConfig
  onReload: () => void
  notify: (msg: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (saving || !apiKey.trim()) return
    setSaving(true)
    try {
      await saveProviderConfig({ provider, api_key: apiKey.trim(), model: model.trim() || undefined })
      notify(`${provider} key saved.`, 'success')
      setApiKey('')
      setModel('')
      await onReload()
    } catch (err) {
      notify(friendlyApiError(err, 'save provider key'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(prov: string) {
    try {
      await removeProvider(prov)
      notify(`${prov} key removed.`, 'success')
      setConfirmRemove(null)
      await onReload()
    } catch (err) {
      notify(friendlyApiError(err, 'remove provider key'), 'error')
    }
  }

  const PROVIDERS = [
    { value: 'openai', label: 'OpenAI', hint: 'GPT-4o-mini recommended' },
    { value: 'anthropic', label: 'Anthropic', hint: 'Claude 3.5 Haiku' },
    { value: 'gemini', label: 'Google Gemini', hint: 'Gemini 2.0 Flash (free tier)' },
    { value: 'groq', label: 'Groq', hint: 'Llama 3.3 70B (fast, free tier)' },
    { value: 'cloudflare', label: 'Cloudflare Workers AI', hint: 'Free tier on Cloudflare' },
  ]

  return (
    <>
      {/* Global default provider */}
      <section className="card section">
        <h2 className="section__title">Global Default Provider</h2>
        <p className="form__note" style={{ marginBottom: 'var(--space-4)' }}>
          This key is used for all schools unless overridden. Keys are encrypted at rest and never sent to the browser.
        </p>

        {config.providers.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            {config.providers.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <div>
                  <strong>{p.provider}</strong>
                  {p.default_model && (
                    <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-ink-muted)', fontSize: '0.85rem' }}>
                      · {p.default_model}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Badge tone={p.status === 'active' ? 'success' : 'danger'}>
                    {p.api_key_hint ? `••••${p.api_key_hint}` : 'No key'}
                  </Badge>
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => setConfirmRemove(p.provider)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form className="form form--grid" onSubmit={handleSave}>
          <div className="field">
            <label className="field__label" htmlFor="ai-provider">
              Provider
            </label>
            <select
              id="ai-provider"
              className="input input--select"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} — {p.hint}
                </option>
              ))}
            </select>
          </div>
          <PasswordField
            label="API Key"
            required
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Field
            label="Default Model"
            hint="Leave blank for provider default."
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={PROVIDERS.find((p) => p.value === provider)?.hint ?? ''}
          />
          <div className="form__row form--grid__full">
            <button className="button button--primary" type="submit" disabled={saving || !apiKey.trim()}>
              {saving ? <><Spinner label="Testing" /> Testing & saving…</> : 'Test & Save Key'}
            </button>
          </div>
        </form>
      </section>

      {/* Per-school overrides */}
      <section className="card section">
        <h2 className="section__title">Per-School Overrides</h2>
        {config.school_overrides.length === 0 ? (
          <p className="form__note">No per-school overrides configured. All schools use the global default.</p>
        ) : (
          <div className="table-wrap" style={{ marginBottom: 'var(--space-3)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {config.school_overrides.map((o) => (
                  <tr key={o.id}>
                    <td>{o.school_name}</td>
                    <td>{o.provider}</td>
                    <td>{o.default_model ?? '—'}</td>
                    <td>
                      <Badge tone={o.status === 'active' ? 'success' : 'danger'}>
                        {o.status === 'active' ? 'Active' : 'Revoked'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmRemove !== null}
        title={`Remove ${confirmRemove ?? ''} key?`}
        description="The stored credential will be deleted. AI requests will fail until a new key is connected."
        confirmLabel="Remove key"
        destructive
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && handleRemove(confirmRemove)}
      />
    </>
  )
}

// ── Rate Limits tab ────────────────────────────────────────────────────

function LimitsTab({
  config,
  onReload,
  notify,
}: {
  config: AiAdminConfig
  onReload: () => void
  notify: (msg: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const globalLimit = config.rate_limits.find((r) => r.scope === 'global')?.daily_limit ?? 500
  const [dailyLimit, setDailyLimit] = useState(String(globalLimit))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const limit = parseInt(dailyLimit, 10)
    if (!limit || limit < 1) {
      notify('Enter a valid limit.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveRateLimit({ scope: 'global', daily_limit: limit })
      notify('Global rate limit updated.', 'success')
      await onReload()
    } catch (err) {
      notify(friendlyApiError(err, 'update rate limit'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card section">
      <h2 className="section__title">Global Rate Limits</h2>
      <p className="form__note" style={{ marginBottom: 'var(--space-4)' }}>
        Default daily limits applied to all schools. Per-school overrides can increase or decrease this.
      </p>

      <div className="form form--grid">
        <Field
          label="Per-user daily limit"
          type="number"
          hint="Maximum AI requests per user per day"
          value={dailyLimit}
          onChange={(e) => setDailyLimit(e.target.value)}
        />
        <div className="form__row form--grid__full" style={{ alignItems: 'flex-end' }}>
          <button
            className="button button--primary"
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Limit'}
          </button>
        </div>
      </div>

      {config.rate_limits.filter((r) => r.scope !== 'global').length > 0 && (
        <>
          <h3 className="panel__subtitle" style={{ marginTop: 'var(--space-4)' }}>
            Per-School Overrides
          </h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Daily Limit</th>
                </tr>
              </thead>
              <tbody>
                {config.rate_limits
                  .filter((r) => r.scope !== 'global')
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.scope}</td>
                      <td>{r.daily_limit}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

// ── Features tab ───────────────────────────────────────────────────────

const FEATURES = ['chat', 'reports', 'grade_analytics', 'finance_insight'] as const

function FeaturesTab({
  config,
  onReload,
  notify,
}: {
  config: AiAdminConfig
  onReload: () => void
  notify: (msg: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const globalToggles = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const f of FEATURES) map[f] = true // default enabled
    for (const t of config.feature_toggles) {
      if (t.school_id === null) map[t.feature] = t.enabled
    }
    return map
  }, [config.feature_toggles])

  async function toggleFeature(feature: string, enabled: boolean) {
    try {
      await saveFeatureToggle({ feature, enabled })
      notify(`${featureLabel(feature)} ${enabled ? 'enabled' : 'disabled'}.`, 'success')
      await onReload()
    } catch (err) {
      notify(friendlyApiError(err, 'toggle feature'), 'error')
    }
  }

  return (
    <section className="card section">
      <h2 className="section__title">Global Feature Toggles</h2>
      <p className="form__note" style={{ marginBottom: 'var(--space-4)' }}>
        Enable or disable AI features for all schools. Per-school overrides can override these.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {FEATURES.map((f) => (
          <div
            key={f}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div>
              <strong>{featureLabel(f)}</strong>
              <p className="form__note" style={{ marginTop: '0.15rem' }}>
                {f === 'chat' && 'Natural language chat assistant accessible from any page'}
                {f === 'reports' && 'AI-powered report card and document generation'}
                {f === 'grade_analytics' && 'Performance analysis and student risk predictions'}
                {f === 'finance_insight' && 'Payment matching, anomaly detection, financial summaries'}
              </p>
            </div>
            <button
              type="button"
              className={`ai-toggle ${globalToggles[f] ? 'ai-toggle--on' : ''}`}
              onClick={() => toggleFeature(f, !globalToggles[f])}
              role="switch"
              aria-checked={globalToggles[f]}
              aria-label={`${globalToggles[f] ? 'Disable' : 'Enable'} ${featureLabel(f)}`}
            >
              <span className="ai-toggle__dot" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Usage tab ──────────────────────────────────────────────────────────

function UsageTab() {
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

// ── Audit tab ──────────────────────────────────────────────────────────

function AuditTab() {
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
