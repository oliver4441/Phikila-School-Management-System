import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID

export const firebaseAvailable = Boolean(apiKey && authDomain && projectId)

let app: FirebaseApp | null = null
if (firebaseAvailable) {
  app = getApps().length ? getApp() : initializeApp({ apiKey, authDomain, projectId })
}

/** Firebase Auth instance, or null when Firebase is not configured. */
export const firebaseAuth: Auth | null = app ? getAuth(app) : null

/** Resolve the current Firebase ID token, or null when signed out. */
export async function getFirebaseIdToken(): Promise<string | null> {
  if (!firebaseAuth) return null
  const user = firebaseAuth.currentUser
  if (!user) return null
  try {
    return await user.getIdToken()
  } catch {
    return null
  }
}