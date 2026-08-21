import { Hono } from 'hono'
import { createApp } from './lib/http'
import { createSql } from './lib/db'
import { authMiddleware, requireAuth } from './lib/auth'
import { getSchoolIdHeader } from './lib/tenancy'
import type { Bindings } from './lib/env'
import { authRoutes } from './routes/auth'
import { platformRoutes } from './routes/platform'
import { schoolRoutes } from './routes/school'
import { academicsRoutes } from './routes/academics'
import { studentsRoutes } from './routes/students'
import { teachersRoutes } from './routes/teachers'
import { attendanceRoutes } from './routes/attendance'
import { examinationsRoutes } from './routes/examinations'
import { financeRoutes } from './routes/finance'
import { schedulingRoutes } from './routes/scheduling'
import { admissionsRoutes } from './routes/admissions'
import { healthRoutes } from './routes/health'
import { inventoryRoutes } from './routes/inventory'
import { libraryRoutes } from './routes/library'
import { boardRoutes } from './routes/board'
import { principalRoutes } from './routes/principal'
import { llmRoutes } from './routes/llm'
import { ocrRoutes } from './routes/ocr'
import { aiRoutes } from './routes/ai'

const app = createApp<Bindings>()

app.use('/api/v1/*', authMiddleware)

app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/platform', platformRoutes)
app.route('/api/v1/school', schoolRoutes)
app.route('/api/v1/academics', academicsRoutes)
app.route('/api/v1/students', studentsRoutes)
app.route('/api/v1/teachers', teachersRoutes)
app.route('/api/v1/attendance', attendanceRoutes)
app.route('/api/v1/examinations', examinationsRoutes)
app.route('/api/v1/finance', financeRoutes)
app.route('/api/v1/scheduling', schedulingRoutes)
app.route('/api/v1/admissions', admissionsRoutes)
app.route('/api/v1/health', healthRoutes)
app.route('/api/v1/inventory', inventoryRoutes)
app.route('/api/v1/library', libraryRoutes)
app.route('/api/v1/board', boardRoutes)
app.route('/api/v1/principal', principalRoutes)
app.route('/api/v1/llm', llmRoutes)
app.route('/api/v1/ocr', ocrRoutes)
app.route('/api/v1/ai', aiRoutes)

app.get('/health', (c) => c.json({ status: 'ok' }))

app.post('/api/v1/upload', async (c) => {
  const { error } = requireAuth(c)
  if (error) return error
  const form = await c.req.formData()
  const entry = form.get('file')
  if (!entry || typeof entry === 'string') return c.json({ detail: 'No file provided.' }, 400)
  const file = entry as unknown as { name?: string; type?: string; stream: () => ReadableStream }
  const name = typeof form.get('filename') === 'string' ? String(form.get('filename')) : file.name || 'upload'
  const scope = getSchoolIdHeader(c) ?? `u_${c.get('authUser')!.id}`
  const key = `school_${scope}/${Date.now()}-${name.replace(/[^\w.\-]+/g, '_')}`
  await c.env.MEDIA!.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })
  return c.json({ url: `/static/${key}` })
})

app.get('/static/:key', authMiddleware, async (c) => {
  const { error } = requireAuth(c)
  if (error) return error
  const key = c.req.param('key')
  const obj = await c.env.MEDIA!.get(key)
  if (!obj) return c.notFound()
  const headers = new Headers()
  if (obj.httpMetadata?.contentType) headers.set('Content-Type', obj.httpMetadata.contentType)
  if (obj.httpMetadata?.cacheControl) headers.set('Cache-Control', obj.httpMetadata.cacheControl)
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(obj.body, { headers })
})

app.get('/debug/auth', authMiddleware, (c) => {
  const authUser = c.get('authUser')
  return c.json({
    hasAuthUser: !!authUser,
    authUser: authUser ? { id: authUser.id, email: authUser.email, role: authUser.role } : null,
  })
})

app.get('/debug/db', async (c) => {
  const hasDb = !!c.env.DATABASE_URL
  const hasJwt = !!c.env.JWT_SECRET
  try {
    const db = createSql(c.env)
    const r = await db`select 1 as ok, current_database() as db`
    return c.json({ hasDb, hasJwt, ok: true, row: r[0] })
  } catch (err) {
    return c.json({ hasDb, hasJwt, ok: false, error: (err as Error).message, cause: String((err as Error).cause ?? '') }, 500)
  }
})

app.notFound((c) => c.json({ detail: 'Not found' }, 404))

export default app
