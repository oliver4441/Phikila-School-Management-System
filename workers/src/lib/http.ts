import { Hono } from 'hono'

type Env<B> = {
  Bindings: B
}

/** Base Hono app with CORS for the Vercel-hosted frontend. */
export function createApp<B extends object = Record<string, unknown>>(): Hono<Env<B>> {
  const app = new Hono<Env<B>>()
  app.use('*', async (c, next) => {
    c.res.headers.set('Access-Control-Allow-Origin', '*')
    c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (c.req.method === 'OPTIONS') return c.body(null, 204)
    return next()
  })
  return app
}

export function jsonError(c: { json: (body: unknown, status?: number) => Response }, message: string, status = 400) {
  return c.json({ detail: message }, status)
}
