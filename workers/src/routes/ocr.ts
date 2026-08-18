import { Hono } from 'hono'
import { requireAuth } from '../lib/auth'

export const ocrRoutes = new Hono()

const NOT_AVAILABLE = 'Document scanning is not available on this deployment. No OCR engine is configured.'

ocrRoutes.get('/scans', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  return c.json([])
})

ocrRoutes.get('/backends', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  return c.json({ backends: [] })
})

ocrRoutes.post('/scan', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  return c.json({ detail: NOT_AVAILABLE }, 501)
})
