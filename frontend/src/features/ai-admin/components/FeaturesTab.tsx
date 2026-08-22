import { useMemo } from 'react'
import { friendlyApiError } from '../../../lib/api'
import { saveFeatureToggle, featureLabel } from '../../../lib/ai'
import { FEATURES } from '../helpers'
import type { TabProps } from '../helpers'

export function FeaturesTab({ config, onReload, notify }: TabProps) {
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
