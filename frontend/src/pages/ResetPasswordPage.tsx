import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Alert } from '../components/Alert'
import { PasswordField } from '../components/Field'
import { Spinner } from '../components/States'
import { useAuth } from '../lib/auth'
import { Link, useNavigate, useSearchParams } from '../lib/router'
import { assessPassword, MINIMUM_PASSWORD_LENGTH } from '../lib/password'
import { useToast } from '../components/Toast'

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const params = useSearchParams()
  const { notify } = useToast()

  const mode = params.get('mode')
  const oobCode = params.get('oobCode')
  const linkValid = mode === 'resetPassword' && Boolean(oobCode)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const strength = useMemo(() => assessPassword(password), [password])

  useEffect(() => {
    document.title = 'Choose a new password · Phikila School System'
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const next: typeof errors = {}
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      next.password = `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`
    }
    if (confirmPassword !== password) next.confirmPassword = 'Both passwords must match.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    const result = await updatePassword(password)

    if (!result.ok) {
      setSubmitting(false)
      setFormError(result.message)
      return
    }

    setSubmitting(false)
    notify('Password updated. Sign in with your new password.', 'success')
    navigate('/login?notice=password-updated', { replace: true })
  }

  // Firebase reset links carry the code in the URL; no session is created.
  // A link without the expected code is missing, already used, or expired.
  if (!linkValid) {
    return (
      <AuthLayout
        title="Reset link not valid"
        subtitle="This password reset link cannot be used."
        footer={
          <p className="auth-shell__footer-text">
            Need help? <Link to="/login">Back to sign in</Link>
          </p>
        }
      >
        <Alert tone="error" title="Link expired or already used">
          Password reset links can only be used once and expire after a short time. Request a new
          one to continue.
        </Alert>
        <Link className="button button--primary button--block" to="/forgot-password">
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Set a new password for your account.">
      {formError && (
        <Alert tone="error" title="We could not update your password">
          {formError}
        </Alert>
      )}
      <form className="form" onSubmit={handleSubmit} noValidate>
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          value={password}
          required
          hint={`At least ${MINIMUM_PASSWORD_LENGTH} characters.`}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          footer={
            password ? (
              <p className="strength__text" role="status">
                Password strength: <strong>{strength.label}</strong>
              </p>
            ) : null
          }
        />
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          required
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
        />
        <button className="button button--primary button--block" type="submit" disabled={submitting}>
          {submitting && <Spinner label="Updating password" />}
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}