import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { requireAuth } from '../lib/auth'
import { verifyFirebaseToken } from '../lib/firebase'
import { signToken } from '../lib/jwt'
import type { Bindings } from '../lib/env'

export const authRoutes = new Hono<{ Bindings: Bindings }>()

export type ExchangeResult =
  | { access_token: string; user: { id: string; email: string | null; role: string } }
  | { error: 'no_account' }

async function exchangeFirebaseToken(env: Bindings, idToken: string): Promise<ExchangeResult | null> {
  const claims = await verifyFirebaseToken(env, idToken)
  if (!claims) return null
  const db = createSql(env)
  const firebaseUid = claims.uid || claims.sub
  const email = claims.email ?? null
  const fullName = claims.name ?? null
  const provider = claims.firebase?.sign_in_provider ?? null

  // An account is matched by its linked Firebase uid first, then by email so
  // that a Google login maps onto an account that was created by email.
  let existing = await db`select id from users where firebase_uid = ${firebaseUid}`
  if (!existing.length && email) {
    existing = await db`select id from users where lower(email) = lower(${email})`
  }

  let userId: string | null = null
  if (existing.length) {
    userId = String(existing[0].id)
    await db`
      update users set
        email = coalesce(${email}, email),
        full_name = coalesce(${fullName}, full_name),
        firebase_uid = coalesce(users.firebase_uid, ${firebaseUid}),
        updated_at = now()
      where id = ${userId}
    `
  } else if (provider === 'google.com') {
    // Google sign-in only works for accounts that already exist. It never
    // creates one, so a random Google identity cannot gain an account here.
    return { error: 'no_account' }
  } else {
    const created = await db`insert into users (id, firebase_uid, email, full_name, role, status) values (gen_random_uuid(), ${firebaseUid}, ${email}, ${fullName}, 'user', 'active') returning id`
    userId = String(created[0].id)
  }

  const [me] = await db`select role from users where id = ${userId}`
  const role = (me?.role as string | null) ?? 'user'
  const accessToken = await signToken(env, { sub: userId, email: email ?? '', role })
  return { access_token: accessToken, user: { id: userId, email, role } }
}

/** Handle a failed exchange uniformly: 401 with a reason the UI can show. */
function exchangeFailure(
  c: { json: (body: unknown, status?: number) => Response },
  result: ExchangeResult | null,
) {
  if (result && 'error' in result) {
    return c.json({ detail: 'No account found for this email. Ask a school administrator to create your account.' }, 401)
  }
  return c.json({ detail: 'Invalid credentials.' }, 401)
}

/** Exchange a Firebase Auth ID token for an app session token. */
authRoutes.post('/firebase', async (c) => {
  const body = await c.req.json().catch(() => null)
  const idToken =
    typeof body?.id_token === 'string' ? body.id_token : typeof body?.idToken === 'string' ? body.idToken : null
  if (!idToken) return c.json({ detail: 'Missing id_token.' }, 400)
  const result = await exchangeFirebaseToken(c.env, idToken)
  if (!result || 'error' in result) return exchangeFailure(c, result)
  return c.json(result)
})

/** Legacy login endpoint. Accepts a Firebase ID token (JSON or form). */
authRoutes.post('/login', async (c) => {
  const contentType = c.req.header('content-type') ?? ''
  let idToken: string | null = null
  if (contentType.includes('application/json')) {
    const body = await c.req.json().catch(() => null)
    idToken = typeof body?.id_token === 'string' ? body.id_token : typeof body?.idToken === 'string' ? body.idToken : null
  } else {
    const form = await c.req.formData().catch(() => null)
    const value = form?.get('id_token')
    idToken = value ? String(value) : null
  }
  if (!idToken) return c.json({ detail: 'Missing id_token.' }, 400)
  const result = await exchangeFirebaseToken(c.env, idToken)
  if (!result || 'error' in result) return exchangeFailure(c, result)
  return c.json(result)
})

authRoutes.get('/me', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  return c.json({ id: user!.id, email: user!.email, role: user!.role })
})
