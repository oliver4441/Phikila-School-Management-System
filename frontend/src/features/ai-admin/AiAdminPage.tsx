import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/States'
import { useToast } from '../../components/Toast'
import { friendlyApiError } from '../../lib/api'
import { getAdminConfig, type AiAdminConfig } from '../../lib/ai'
import { SparkIcon } from '../../components/icons'
import { TABS } from './helpers'
import type { Tab } from './helpers'
import { ProvidersTab } from './components/ProvidersTab'
import { LimitsTab } from './components/LimitsTab'
import { FeaturesTab } from './components/FeaturesTab'
import { UsageTab } from './components/UsageTab'
import { AuditTab } from './components/AuditTab'

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
