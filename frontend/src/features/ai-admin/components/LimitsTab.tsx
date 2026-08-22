import { useState } from 'react'
import { Field } from '../../../components/Field'
import { friendlyApiError } from '../../../lib/api'
import { saveRateLimit } from '../../../lib/ai'
import type { TabProps } from '../helpers'

export function LimitsTab({ config, onReload, notify }: TabProps) {
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
