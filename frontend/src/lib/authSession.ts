export type AuthStoredSession = {
  access_token: string
  user: { id: string; email: string | null; role: string | null }
}

const SESSION_KEY = 'phikila.session'

export function getStoredSession(): AuthStoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthStoredSession
    if (!parsed?.access_token || !parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

export function setStoredSession(session: AuthStoredSession | null): void {
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(SESSION_KEY)
  }
}