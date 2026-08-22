import { useState, type FormEvent } from 'react'
import { Alert } from '../../../components/Alert'
import { Badge, Spinner } from '../../../components/States'
import { PasswordField } from '../../../components/Field'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { friendlyApiError } from '../../../lib/api'
import { llm, PROVIDER_STATUS_LABEL, type Provider } from '../../../lib/platform'
import { relative, statusTone } from '../helpers'
import { ModelManager } from './ModelManager'

type Notify = (message: string, tone?: 'success' | 'error' | 'info') => void

export function ProviderCard({
  provider,
  expanded,
  defaultModelId,
  onToggle,
  onChanged,
  notify,
}: {
  provider: Provider
  expanded: boolean
  defaultModelId: string | null
  onToggle: () => void
  onChanged: () => void
  notify: Notify
}) {
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function connect(event: FormEvent) {
    event.preventDefault()
    if (connecting) return
    setConnecting(true)
    setFormError(null)
    try {
      await llm.connect(provider.provider, apiKey)
      // Drop the key from component state the moment it is accepted.
      setApiKey('')
      setShowForm(false)
      notify(`${provider.label} connected.`, 'success')
      onChanged()
    } catch (err) {
      setFormError(friendlyApiError(err, `connect ${provider.label}`))
    } finally {
      setConnecting(false)
    }
  }

  async function test() {
    setTesting(true)
    try {
      const result = await llm.test(provider.provider)
      notify(result.message, result.ok ? 'success' : 'error')
      onChanged()
    } catch (err) {
      notify(friendlyApiError(err, `test ${provider.label}`), 'error')
    } finally {
      setTesting(false)
    }
  }

  async function disconnect() {
    if (removing) return
    setRemoving(true)
    try {
      await llm.disconnect(provider.provider)
      setConfirmRemove(false)
      notify(`${provider.label} disconnected.`, 'success')
      onChanged()
    } catch (err) {
      notify(friendlyApiError(err, `remove the ${provider.label} key`), 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <section className="card section provider-card" aria-labelledby={`prov-${provider.provider}`}>
      <div className="provider-card__head">
        <div>
          <h2 className="section__title" id={`prov-${provider.provider}`}>
            {provider.label}
          </h2>
          <p className="provider-card__status">
            {/* Icon + text, never colour alone. */}
            <Badge tone={statusTone(provider.status)}>
              {PROVIDER_STATUS_LABEL[provider.status]}
            </Badge>
            {provider.connected && (
              <span className="provider-card__meta">
                {provider.models_available} models · {provider.models_enabled} enabled · tested{' '}
                {relative(provider.last_tested_at)}
              </span>
            )}
          </p>
        </div>
      </div>

      {provider.last_error && provider.status !== 'connected' && (
        <Alert tone="error">{provider.last_error}</Alert>
      )}

      {provider.api_key_configured ? (
        <>
          <dl className="detail-list">
            <div>
              <dt>API key</dt>
              <dd>
                <span className="api-key-mask">{provider.api_key_hint}</span>{' '}
                <Badge tone="success">Configured</Badge>
              </dd>
            </div>
          </dl>
          <div className="form__row">
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={test}
              disabled={testing}
            >
              {testing && <Spinner label="Testing" />}
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => setShowForm((v) => !v)}
            >
              Replace key
            </button>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={() => setConfirmRemove(true)}
            >
              Remove
            </button>
            <button type="button" className="button button--primary button--sm" onClick={onToggle}>
              {expanded ? 'Hide models' : 'Manage models'}
            </button>
          </div>
        </>
      ) : (
        !showForm && (
          <div className="form__row">
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={() => setShowForm(true)}
            >
              Connect
            </button>
            <a
              className="link"
              href={provider.docs_url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Provider documentation
            </a>
          </div>
        )
      )}

      {showForm && (
        <form className="form" onSubmit={connect} noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <PasswordField
            label="API key"
            required
            autoComplete="off"
            hint={provider.key_hint}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <p className="form__note">
            The key is sent once to this application's own server, encrypted, and never returned
            to the browser.
          </p>
          <div className="form__row">
            <button className="button button--primary" type="submit" disabled={connecting || !apiKey}>
              {connecting && <Spinner label="Testing connection" />}
              {connecting ? 'Testing connection…' : 'Test and save'}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setShowForm(false)
                setApiKey('')
                setFormError(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {expanded && provider.connected && (
        <ModelManager
          provider={provider}
          defaultModelId={defaultModelId}
          onChanged={onChanged}
          notify={notify}
        />
      )}

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove the ${provider.label} key?`}
        description="The stored credential is deleted and all its models are disabled. You can reconnect at any time with a new key."
        confirmLabel="Remove key"
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={disconnect}
      />
    </section>
  )
}
