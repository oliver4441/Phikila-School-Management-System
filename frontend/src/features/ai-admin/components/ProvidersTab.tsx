import { useState, type FormEvent } from 'react'
import { Badge, Spinner } from '../../../components/States'
import { Field, PasswordField } from '../../../components/Field'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { friendlyApiError } from '../../../lib/api'
import { saveProviderConfig, removeProvider } from '../../../lib/ai'
import { PROVIDERS } from '../helpers'
import type { TabProps } from '../helpers'

export function ProvidersTab({ config, onReload, notify }: TabProps) {
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
