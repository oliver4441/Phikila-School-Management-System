import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { requireAuth } from '../lib/auth'
import { verifyFirebaseToken } from '../lib/firebase'
import { signToken } from '../lib/jwt'
import type { Bindings } from '../lib/env'

export const authRoutes = new Hono<{ Bindings: Bindings }>()

async function exchangeFirebaseToken(env: Bindings, idToken: string) {
  const claims = await verifyFirebaseToken(env, idToken)
  if (!claims) return null
  const db = createSql(env)
  const firebaseUid = claims.uid || claims.sub
  const email = claims.email ?? null
  const fullName = claims.name ?? null

  const existing = await db`select id from users where firebase_uid = ${firebaseUid}`
  let userId: string
  if (existing.length) {
    userId = String(existing[0].id)
    await db`update users set email = coalesce(${email}, email), full_name = coalesce(${fullName}, full_name), updated_at = now() where id = ${userId}`
  } else {
    const created = await db`insert into users (id, firebase_uid, email, full_name, role, status) values (gen_random_uuid(), ${firebaseUid}, ${email}, ${fullName}, 'user', 'active') returning id`
    userId = String(created[0].id)
  }

  const [me] = await db`select role from users where id = ${userId}`
  const role = (me?.role as string | null) ?? 'user'
  const accessToken = await signToken(env, { sub: userId, email: email ?? '', role })
  return { access_token: accessToken, user: { id: userId, email, role } }
}

/** Exchange a Firebase Auth ID token for an app session token. */
authRoutes.post('/firebase', async (c) => {
  const body = await c.req.json().catch(() => null)
  const idToken =
    typeof body?.id_token === 'string' ? body.id_token : typeof body?.idToken === 'string' ? body.idToken : null
  if (!idToken) return c.json({ detail: 'Missing id_token.' }, 400)
  const result = await exchangeFirebaseToken(c.env, idToken)
  if (!result) return c.json({ detail: 'Invalid credentials.' }, 401)
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
  if (!result) return c.json({ detail: 'Invalid credentials.' }, 401)
  return c.json(result)
})

authRoutes.get('/me', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error
  return c.json({ id: user!.id, email: user!.email, role: user!.role })
})
