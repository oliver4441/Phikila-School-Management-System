import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { Alert } from '../../../components/Alert'
import { Badge, ErrorState, LoadingBlock } from '../../../components/States'
import { Field } from '../../../components/Field'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useToast } from '../../../components/Toast'
import { friendlyApiError } from '../../../lib/api'
import { platform, type PlatformAdmin } from '../../../lib/platform'

/* ==================================================== platform admin roster */
export function PlatformAdminsPage() {
  const { notify } = useToast()
  const [admins, setAdmins] = useState<PlatformAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<PlatformAdmin | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAdmins(await platform.admins())
    } catch (err) {
      setError(friendlyApiError(err, 'load platform administrators'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function grant(event: FormEvent) {
    event.preventDefault()
    if (saving || !email.trim()) return
    setSaving(true)
    try {
      await platform.grantAdmin(email.trim())
      notify('Platform access granted.', 'success')
      setEmail('')
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'grant platform access'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function revoke(admin: PlatformAdmin) {
    try {
      await platform.revokeAdmin(admin.user_id)
      notify('Platform access revoked.', 'success')
      setConfirm(null)
      await load()
    } catch (err) {
      notify(friendlyApiError(err, 'revoke platform access'), 'error')
    }
  }

  const isLast = admins.length <= 1

  return (
    <>
      <PageHeader
        title="Platform administrators"
        description="Accounts with full access to every school."
        breadcrumbs={[{ label: 'Platform', to: '/platform' }, { label: 'Administrators' }]}
      />

      <Alert tone="info" title="Platform access is powerful">
        A platform administrator can see and change every school. Grant it sparingly. It can only
        ever be granted by someone who already holds it.
      </Alert>

      {error ? (
        <ErrorState title="Administrators could not load" message={error} onRetry={load} />
      ) : (
        <>
          <section className="card section">
            <h2 className="section__title">Grant platform access</h2>
            <form className="form form--grid" onSubmit={grant}>
              <Field
                label="Email address"
                type="email"
                autoComplete="email"
                hint="The account must have signed in at least once."
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <div className="form__row form--grid__full">
                <button className="button button--primary" type="submit" disabled={saving}>
                  {saving ? 'Granting…' : 'Grant access'}
                </button>
              </div>
            </form>
          </section>

          <section className="card section">
            <h2 className="section__title">Current administrators</h2>
            {loading ? (
              <LoadingBlock label="Loading administrators" rows={2} />
            ) : (
              <ul className="admin-list">
                {admins.map((admin) => (
                  <li className="admin-row" key={admin.user_id}>
                    <div>
                      <p className="admin-row__email">
                        {admin.email ?? admin.user_id}
                        {admin.is_self && <Badge>You</Badge>}
                      </p>
                      <p className="admin-row__meta">
                        Granted by {admin.granted_by === 'bootstrap' ? 'server bootstrap' : admin.granted_by}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button button--ghost button--sm"
                      disabled={isLast}
                      title={isLast ? 'The last platform administrator cannot be removed' : undefined}
                      onClick={() => setConfirm(admin)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {isLast && !loading && (
              <p className="form__note">
                This is the only platform administrator. Grant access to someone else before
                removing it, so the platform is never left without an administrator.
              </p>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title="Revoke platform access?"
        description={`${confirm?.email ?? 'This account'} will lose access to every school and to platform settings.${confirm?.is_self ? ' This is your own account — you will be locked out of platform administration immediately.' : ''}`}
        confirmLabel="Revoke access"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && revoke(confirm)}
      />
    </>
  )
}
