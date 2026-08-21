import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const allowedPublicVariables = new Set([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_API_URL',
])

// Vercel injects several VITE_VERCEL_* system variables at build time when the
// Git integration is enabled. They are Vercel-managed public build metadata
// (repo, deployment, commit info), not application secrets. Allow the whole
// VITE_VERCEL_* prefix while keeping strict validation for every other VITE_*
// variable.

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '.', 'VITE_')

  // The three Firebase publishable values are required together for signing
  // in with Firebase (email/password and Google). A partial set is a
  // configuration error: sign-in would fail at runtime for a confusing reason.
  const firebaseValues = [
    environment['VITE_FIREBASE_API_KEY']?.trim(),
    environment['VITE_FIREBASE_AUTH_DOMAIN']?.trim(),
    environment['VITE_FIREBASE_PROJECT_ID']?.trim(),
  ]
  if (firebaseValues.some((value) => Boolean(value)) && !firebaseValues.every(Boolean)) {
    throw new Error(
      'VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN and VITE_FIREBASE_PROJECT_ID must all be set together',
    )
  }

  const unexpected = Object.keys(environment).filter(
    (name) =>
      name.startsWith('VITE_') &&
      !name.startsWith('VITE_VERCEL_') &&
      !allowedPublicVariables.has(name),
  )
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected VITE_* variables would be exposed to browsers: ${unexpected.join(', ')}`,
    )
  }

  return {
    plugins: [react()],
    server: {
      // Local development only. Vite rejects unknown Host headers, which blocks
      // remote dev/preview sandboxes (e.g. cloud workspaces). Production is
      // served by FastAPI/Vercel and never uses this dev server.
      allowedHosts: ['localhost', '127.0.0.1', '.e2b.app'],
      proxy: {
        // Forward API and health requests to the Cloudflare Worker backend
        // during local development (`wrangler dev` runs on :8787).
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  }
})
