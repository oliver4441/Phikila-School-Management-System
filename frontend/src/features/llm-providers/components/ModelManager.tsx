import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '../../../components/Alert'
import { Badge, EmptyState, ErrorState, LoadingBlock, Spinner } from '../../../components/States'
import { AlertIcon, CheckIcon, SearchIcon, SparkIcon } from '../../../components/icons'
import { friendlyApiError } from '../../../lib/api'
import {
  llm,
  type LlmModel,
  type ModelTestResult,
  type Provider,
} from '../../../lib/platform'
import { money } from '../helpers'

type Notify = (message: string, tone?: 'success' | 'error' | 'info') => void

export function ModelManager({
  provider,
  defaultModelId,
  onChanged,
  notify,
}: {
  provider: Provider
  defaultModelId: string | null
  onChanged: () => void
  notify: Notify
}) {
  const [models, setModels] = useState<LlmModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [result, setResult] = useState<ModelTestResult | null>(null)
  const [onlyEnabled, setOnlyEnabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setModels(await llm.models(provider.provider))
    } catch (err) {
      setError(friendlyApiError(err, 'load models'))
    } finally {
      setLoading(false)
    }
  }, [provider.provider])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return models.filter((model) => {
      if (onlyEnabled && !model.enabled) return false
      if (!term) return true
      return (
        model.model_id.toLowerCase().includes(term) ||
        (model.display_name ?? '').toLowerCase().includes(term)
      )
    })
  }, [models, search, onlyEnabled])

  const enabled = models.filter((m) => m.enabled)

  async function refresh() {
    setRefreshing(true)
    try {
      const out = await llm.refresh(provider.provider)
      notify(`${out.models_available} models available (${out.added} new).`, 'success')
      await load()
      onChanged()
    } catch (err) {
      notify(friendlyApiError(err, 'refresh models'), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  async function toggle(model: LlmModel) {
    setBusy(model.id)
    try {
      await llm.setEnabled(model.id, !model.enabled)
      await load()
      onChanged()
    } catch (err) {
      notify(friendlyApiError(err, 'change that model'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function test(model: LlmModel) {
    setBusy(model.id)
    setResult(null)
    try {
      const out = await llm.testModel(model.id)
      setResult(out)
      notify(out.message, out.ok ? 'success' : 'error')
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'test that model'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function makeDefault(model: LlmModel) {
    try {
      await llm.setDefault(provider.provider, model.model_id)
      notify(`${model.model_id} is now the default model.`, 'success')
      onChanged()
    } catch (err) {
      notify(friendlyApiError(err, 'set the default model'), 'error')
    }
  }

  return (
    <div className="model-manager">
      <div className="toolbar">
        <div className="search">
          <SearchIcon className="search__icon" width={18} height={18} />
          <label className="visually-hidden" htmlFor={`search-${provider.provider}`}>
            Search {provider.label} models
          </label>
          <input
            id={`search-${provider.provider}`}
            className="input input--search"
            type="search"
            placeholder="Search models"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyEnabled}
            onChange={(event) => setOnlyEnabled(event.target.checked)}
          />
          Enabled only
        </label>
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing && <Spinner label="Refreshing" />}
          {refreshing ? 'Refreshing…' : 'Refresh models'}
        </button>
      </div>

      {result && (
        <Alert tone={result.ok ? 'success' : 'error'} title={result.ok ? 'Model responded' : 'Model test failed'}>
          <span className="model-result">
            {result.ok ? <CheckIcon width={16} height={16} /> : <AlertIcon width={16} height={16} />}
            {result.message}
            {result.latency_ms !== null && ` · ${result.latency_ms} ms`}
            {` · ${result.provider}/${result.model_id}`}
          </span>
        </Alert>
      )}

      {error ? (
        <ErrorState title="Models could not load" message={error} onRetry={load} />
      ) : loading ? (
        <LoadingBlock label={`Fetching ${provider.label} models`} rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={search ? 'No matching models' : 'No models yet'}
          description={
            search
              ? 'Nothing matches your search. Clear it to see the full catalogue.'
              : 'Refresh the catalogue to fetch the models this provider offers.'
          }
          icon={<SparkIcon width={22} height={22} />}
          action={
            !search ? (
              <button type="button" className="button button--primary button--sm" onClick={refresh}>
                Refresh models
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="form__note">
            Showing {visible.length} of {models.length} models · {enabled.length} enabled
          </p>
          <ul className="model-list">
            {visible.slice(0, 60).map((model) => (
              <li className="model-row" key={model.id}>
                <div className="model-row__main">
                  <p className="model-row__id">
                    {model.display_name || model.model_id}
                    {defaultModelId === model.model_id && <Badge tone="success">Default</Badge>}
                    {model.enabled ? (
                      <Badge tone="success">Enabled</Badge>
                    ) : (
                      <Badge>Disabled</Badge>
                    )}
                  </p>
                  <p className="model-row__meta">{model.model_id}</p>
                  <p className="model-row__meta">
                    {model.context_window
                      ? `${model.context_window.toLocaleString()} ctx`
                      : 'Context unknown'}{' '}
                    · in {money(model.input_price)} · out {money(model.output_price)}
                    {model.supports_tools ? ' · tools' : ''}
                    {model.supports_vision ? ' · vision' : ''}
                  </p>
                  {model.last_tested_at && (
                    <p className="model-row__meta">
                      Last test:{' '}
                      {model.last_test_ok
                        ? `passed in ${model.last_test_ms} ms`
                        : model.last_test_error || 'failed'}
                    </p>
                  )}
                </div>
                <div className="model-row__actions">
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => toggle(model)}
                    disabled={busy === model.id}
                  >
                    {model.enabled ? 'Disable' : 'Enable'}
                  </button>
                  {model.enabled && (
                    <>
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        onClick={() => test(model)}
                        disabled={busy === model.id}
                      >
                        {busy === model.id ? 'Testing…' : 'Test'}
                      </button>
                      {defaultModelId !== model.model_id && (
                        <button
                          type="button"
                          className="button button--ghost button--sm"
                          onClick={() => makeDefault(model)}
                        >
                          Set default
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {visible.length > 60 && (
            <p className="form__note">
              Showing the first 60 matches. Use search to narrow the list.
            </p>
          )}
        </>
      )}
    </div>
  )
}
