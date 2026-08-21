import { sign, verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export type TokenClaims = JWTPayload & {
  sub: string
  email?: string
  role?: string
}

export async function signToken(
  env: { JWT_SECRET: string },
  claims: { sub: string; email?: string; role?: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: JWTPayload = { ...claims, iat: now, exp: now + SESSION_TTL_SECONDS }
  return sign(payload, env.JWT_SECRET)
}

export async function verifyToken(env: { JWT_SECRET: string }, token: string): Promise<TokenClaims | null> {
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256')
    if (typeof payload.sub !== 'string') return null
    return payload as TokenClaims
  } catch {
    return null
  }
}
