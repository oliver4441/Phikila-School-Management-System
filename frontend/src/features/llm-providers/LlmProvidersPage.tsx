import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Alert } from '../../components/Alert'
import { ErrorState, LoadingBlock } from '../../components/States'
import { useToast } from '../../components/Toast'
import { ApiError, friendlyApiError } from '../../lib/api'
import { llm, type Provider } from '../../lib/platform'
import { ProviderCard } from './components/ProviderCard'

/**
 * Settings → AI / LLM providers.
 *
 * The API key is submitted once to our own backend and then dropped from React
 * state. It is never stored in localStorage, never echoed back by the API, and
 * the browser never calls a provider directly.
 */
export function LlmProvidersPage() {
  const { notify } = useToast()
  const [providers, setProviders] = useState<Provider[]>([])
  const [encryptionReady, setEncryptionReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notAvailable, setNotAvailable] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [defaults, setDefaults] = useState<{ provider: string | null; model_id: string | null }>({
    provider: null,
    model_id: null,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotAvailable(false)
    try {
      const [data, def] = await Promise.all([llm.providers(), llm.getDefault()])
      setProviders(data.providers)
      setEncryptionReady(data.encryption_configured)
      setDefaults(def)
    } catch (err) {
      // 501 is a deliberate "not on this deployment" stub — not retryable.
      setNotAvailable(err instanceof ApiError && err.status === 501)
      setError(friendlyApiError(err, 'load AI provider settings'))
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
        title="AI providers"
        description="Connect a language-model provider. Keys are encrypted on the server and never sent to the browser."
        breadcrumbs={[{ label: 'Settings' }, { label: 'AI providers' }]}
      />

      {!encryptionReady && (
        <Alert tone="error" title="Encryption is not configured">
          Set the <code>LLM_ENCRYPTION_KEY</code> environment variable on the server before
          connecting a provider. Credentials cannot be stored securely without it.
        </Alert>
      )}

      {defaults.model_id && (
        <Alert tone="info" title="Default model">
          {defaults.provider} · <strong>{defaults.model_id}</strong>
        </Alert>
      )}

      {notAvailable ? (
        <Alert tone="info" title="AI providers are not available on this deployment">
          {error}
        </Alert>
      ) : error ? (
        <ErrorState title="Provider settings could not load" message={error} onRetry={load} />
      ) : loading ? (
        <div className="card section">
          <LoadingBlock label="Loading AI providers" rows={4} />
        </div>
      ) : (
        <div className="provider-grid">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.provider}
              provider={provider}
              expanded={expanded === provider.provider}
              defaultModelId={
                defaults.provider === provider.provider ? defaults.model_id : null
              }
              onToggle={() =>
                setExpanded((current) =>
                  current === provider.provider ? null : provider.provider,
                )
              }
              onChanged={load}
              notify={notify}
            />
          ))}
        </div>
      )}
    </>
  )
}
