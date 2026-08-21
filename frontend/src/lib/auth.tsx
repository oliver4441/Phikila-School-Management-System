import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth'
import { firebaseAuth, getFirebaseIdToken } from './firebase'
import { friendlyAuthError } from './authErrors'
import { apiFetch, exchangeFirebaseIdToken, type ApiSession } from './api'
import { getStoredSession, setStoredSession } from './authSession'

export type AuthResult = { ok: true; message?: string } | { ok: false; message: string }

/**
 * What a new user *asks* for at signup. It is only ever a request: the server
 * records it for review and grants nothing until a super admin approves it.
 */
export type AccessRequestDraft = {
  requested_role: string
  school_id: number | null
  school_name: string | null
}

/** Structural view of the signed-in user used across the app. */
export type AuthUser = {
  id: string
  email: string | null
  user_metadata?: Record<string, unknown> | null
}

export type AuthSession = {
  access_token: string
  user: AuthUser
}

type AuthContextValue = {
  session: AuthSession | null
  user: AuthUser | null
  /** True until the persisted session has been restored. */
  initialising: boolean
  /** True while the user is inside a password-recovery link flow. */
  recoveryMode: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
  signUp: (
    fullName: string,
    email: string,
    password: string,
    request?: AccessRequestDraft,
  ) => Promise<AuthResult & { needsEmailConfirmation?: boolean }>
  signOut: () => Promise<AuthResult>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function displayName(user: AuthUser | null): string {
  if (!user) return ''
  const metadata = user.user_metadata as { full_name?: string; name?: string } | undefined
  return metadata?.full_name?.trim() || metadata?.name?.trim() || user.email || 'Signed-in user'
}

/**
 * Firebase Auth provider. Signs the browser in with Firebase (email/password or
 * Google), exchanges the ID token for the backend's own session token via
 * `/api/v1/auth/firebase`, and stores that session for the API layer.
 */
function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession())
  const [initialising, setInitialising] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('mode') === 'resetPassword' && Boolean(params.get('oobCode'))
  })

  // Keep the stored session in sync with state so the API layer always sees it.
  useEffect(() => {
    setStoredSession(session as ApiSession | null)
  }, [session])

  // Restore a valid backend session when a stored one exists and the browser
  // is signed in with Firebase.
  useEffect(() => {
    let active = true
    const stored = getStoredSession()
    if (!stored) {
      setInitialising(false)
      return
    }
    const restore = async () => {
      const idToken = await getFirebaseIdToken()
      if (!active) return
      if (!idToken) {
        setStoredSession(null)
        setSession(null)
        setInitialising(false)
        return
      }
      try {
        const fresh = await exchangeFirebaseIdToken(idToken)
        if (!active) return
        setSession(fresh)
      } catch {
        if (active) setSession(stored)
      } finally {
        if (active) setInitialising(false)
      }
    }
    void restore()
    return () => {
      active = false
    }
  }, [])

  // Follow Firebase sign-in state: on change, exchange the ID token for a
  // backend session.
  useEffect(() => {
    if (!firebaseAuth) {
      setInitialising(false)
      return
    }
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        setStoredSession(null)
        setSession(null)
        setInitialising(false)
        return
      }
      try {
        const idToken = await firebaseUser.getIdToken()
        const fresh = await exchangeFirebaseIdToken(idToken)
        setSession(fresh)
      } catch {
        setStoredSession(null)
        setSession(null)
      } finally {
        setInitialising(false)
      }
    })
    return () => unsubscribe()
  }, [])

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    if (!firebaseAuth) return { ok: false, message: 'Sign-in is not configured on this deployment.' }
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
      return { ok: true, message: 'Signed in.' }
    } catch (error) {
      return { ok: false, message: friendlyAuthError(error, 'We could not sign you in.') }
    }
  }, [])

  const signInWithGoogle = useCallback<AuthContextValue['signInWithGoogle']>(async () => {
    if (!firebaseAuth) return { ok: false, message: 'Sign-in is not configured on this deployment.' }
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
      return { ok: true, message: 'Signed in.' }
    } catch (error) {
      return { ok: false, message: friendlyAuthError(error, 'We could not sign you in.') }
    }
  }, [])

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (fullName, email, password, request) => {
      if (!firebaseAuth) return { ok: false, message: 'Account creation is not available on this deployment.' }
      try {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
        if (credential.user) {
          await updateProfile(credential.user, { displayName: fullName.trim() || null })
        }
        const idToken = await getFirebaseIdToken()
        if (idToken) {
          try {
            const fresh = await exchangeFirebaseIdToken(idToken)
            setSession(fresh)
          } catch {
            // Sign-in still succeeded; the AccessGate retries the request.
          }
          if (request) {
            try {
              await apiFetch('/api/v1/platform/access-requests', {
                method: 'POST',
                body: JSON.stringify({
                  requested_role: request.requested_role,
                  school_id: request.school_id,
                  school_name: request.school_name,
                }),
              })
            } catch {
              // A failed request submission must not block account creation; the
              // AccessGate retries it the next time the user opens the app.
            }
          }
        }
        return { ok: true, message: 'Your account is ready.' }
      } catch (error) {
        return {
          ok: false,
          message: friendlyAuthError(error, 'We could not create your account. Please try again.'),
        }
      }
    },
    [],
  )

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    if (!firebaseAuth) {
      setStoredSession(null)
      setSession(null)
      return { ok: true, message: 'You have been signed out.' }
    }
    try {
      await firebaseSignOut(firebaseAuth)
    } catch {
      // Local state is cleared regardless of the remote sign-out result.
    }
    setStoredSession(null)
    setSession(null)
    setRecoveryMode(false)
    return { ok: true, message: 'You have been signed out.' }
  }, [])

  const requestPasswordReset = useCallback<AuthContextValue['requestPasswordReset']>(async (email) => {
    if (!firebaseAuth) return { ok: false, message: 'Password reset is not available on this deployment.' }
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim(), {
        url: `${window.location.origin}/reset-password`,
      })
      return {
        ok: true,
        message: 'If an account exists for that address, a password reset email is on its way.',
      }
    } catch (error) {
      if (/rate limit|too many requests|too-many-requests/i.test(friendlyAuthError(error, ''))) {
        return { ok: false, message: 'Too many attempts. Try again shortly.' }
      }
      return {
        ok: true,
        message: 'If an account exists for that address, a password reset email is on its way.',
      }
    }
  }, [])

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(async (password) => {
    if (!firebaseAuth) return { ok: false, message: 'Password updates are not available on this deployment.' }
    const params = new URLSearchParams(window.location.search)
    const oobCode = params.get('oobCode')
    if (!oobCode) {
      return { ok: false, message: 'This password reset link cannot be used. Request a new one.' }
    }
    try {
      await confirmPasswordReset(firebaseAuth, oobCode, password)
      await firebaseSignOut(firebaseAuth)
      setStoredSession(null)
      setSession(null)
      setRecoveryMode(false)
      return { ok: true, message: 'Your password has been updated.' }
    } catch (error) {
      return {
        ok: false,
        message: friendlyAuthError(error, 'We could not update your password. Please try again.'),
      }
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: (session?.user as AuthUser | undefined) ?? null,
      initialising,
      recoveryMode,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [session, initialising, recoveryMode, signIn, signInWithGoogle, signUp, signOut, requestPasswordReset, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}