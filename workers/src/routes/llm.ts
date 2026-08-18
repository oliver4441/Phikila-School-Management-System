import { Hono } from 'hono'
import { requireAuth } from '../lib/auth'

export const llmRoutes = new Hono()

const NOT_AVAILABLE = 'LLM provider management is not available on this deployment. No AI features require it right now.'

const routes: { method: 'get' | 'post' | 'put' | 'patch' | 'delete'; path: string }[] = [
  { method: 'get', path: '/providers' },
  { method: 'post', path: '/providers/:provider/connect' },
  { method: 'post', path: '/providers/:provider/test' },
  { method: 'delete', path: '/providers/:provider/credential' },
  { method: 'get', path: '/providers/:provider/models' },
  { method: 'post', path: '/providers/:provider/models/refresh' },
  { method: 'patch', path: '/models/:modelPk' },
  { method: 'post', path: '/models/:modelPk/test' },
  { method: 'get', path: '/default' },
  { method: 'put', path: '/default' },
]

for (const r of routes) {
  llmRoutes.on(r.method, r.path, async (c) => {
    const { error } = requireAuth(c as never)
    if (error) return error
    return c.json({ detail: NOT_AVAILABLE }, 501)
  })
}
