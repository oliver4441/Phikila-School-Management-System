type FirebaseKeyCache = { keys: Map<string, CryptoKey>; fetchedAt: number }

let keyCache: FirebaseKeyCache | null = null
const KEY_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

type FirebaseJwk = { kid: string; n: string; e: string; kty: string; alg: string }

export type FirebaseClaims = {
  iss: string
  aud: string
  exp: number
  iat: number
  sub: string
  uid: string
  email?: string
  name?: string
  email_verified?: boolean
  picture?: string
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function decodeSegment(segment: string): string {
  return new TextDecoder().decode(base64UrlToBytes(segment))
}

async function getPublicKeys(): Promise<Map<string, CryptoKey>> {
  if (keyCache && Date.now() - keyCache.fetchedAt < KEY_CACHE_TTL_MS) return keyCache.keys
  const res = await fetch(JWKS_URL)
  if (!res.ok) throw new Error(`Firebase JWKS fetch failed: ${res.status}`)
  const payload = (await res.json()) as { keys?: FirebaseJwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of payload.keys ?? []) {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256' },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    keys.set(jwk.kid, key)
  }
  keyCache = { keys, fetchedAt: Date.now() }
  return keys
}

/**
 * Verifies a Firebase Auth ID token (RS256, signed by Google's
 * `securetoken@system.gserviceaccount.com` keys) and returns its claims.
 * Returns null when the token is invalid, expired, or from another project.
 */
export async function verifyFirebaseToken(
  env: { FIREBASE_PROJECT_ID: string },
  idToken: string,
): Promise<FirebaseClaims | null> {
  try {
    const parts = idToken.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, sigB64] = parts
    const header = JSON.parse(decodeSegment(headerB64)) as { alg?: string; kid?: string }
    const claims = JSON.parse(decodeSegment(payloadB64)) as Partial<FirebaseClaims>
    if (header.alg !== 'RS256') return null
    if (claims.aud !== env.FIREBASE_PROJECT_ID) return null
    if (claims.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) return null
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null
    if (typeof claims.iat !== 'number' || claims.iat * 1000 > Date.now() + 60_000) return null
    if (!header.kid) return null
    const keys = await getPublicKeys()
    const key = keys.get(header.kid)
    if (!key) return null
    const signature = base64UrlToBytes(sigB64)
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, signature, data)
    if (!ok) return null
    return claims as FirebaseClaims
  } catch {
    return null
  }
}
