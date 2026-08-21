/**
 * AI routes — chat, reports, analytics, finance insights, admin config.
 *
 * Mounted at /api/v1/ai in index.ts.
 */

import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { requireAuth } from '../lib/auth'
import { resolveTenant, requireWrite, tenantSchoolId, isSuperAdmin } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import { createProvider, type AiProviderName, isProviderName, type AiMessage } from '../lib/ai-provider'
import { checkRateLimit, recordUsage, getUserUsage, getSchoolUsage, isFeatureEnabled } from '../lib/ai-ratelimit'
import { buildChatPrompt, getFinanceSummary, getSchoolContext } from '../lib/ai-rag'
import type { Bindings } from '../lib/env'
import type { Sql } from '../lib/db'

export const aiRoutes = new Hono<{ Bindings: Bindings }>()

// ── Provider resolution ────────────────────────────────────────────────

type ResolvedProvider = {
  provider: AiProviderName
  apiKey: string
  model: string
}

/**
 * Resolve which API key + model to use for a given school.
 * Priority: per-school override → global default.
 */
async function resolveProvider(
  db: Sql,
  schoolId: number | null,
): Promise<ResolvedProvider | null> {
  // Try per-school key first
  if (schoolId) {
    const schoolKey = (await db`
      select provider, api_key_enc, default_model
      from ai_school_keys
      where school_id = ${schoolId} and status = 'active'
      order by updated_at desc
      limit 1
    `)[0]
    if (schoolKey && isProviderName(schoolKey.provider)) {
      return {
        provider: schoolKey.provider,
        apiKey: schoolKey.api_key_enc, // TODO: decrypt with AI_ENCRYPTION_KEY
        model: schoolKey.default_model ?? getDefaultModel(schoolKey.provider),
      }
    }
  }

  // Fall back to global key
  const globalKey = (await db`
    select provider, api_key_enc, default_model
    from ai_provider_keys
    where status = 'active'
    order by updated_at desc
    limit 1
  `)[0]

  if (!globalKey || !isProviderName(globalKey.provider)) return null

  return {
    provider: globalKey.provider,
    apiKey: globalKey.api_key_enc, // TODO: decrypt with AI_ENCRYPTION_KEY
    model: globalKey.default_model ?? getDefaultModel(globalKey.provider),
  }
}

function getDefaultModel(provider: AiProviderName): string {
  const defaults: Record<AiProviderName, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-20241022',
    gemini: 'gemini-2.0-flash',
    groq: 'llama-3.3-70b-versatile',
    cloudflare: '@cf/meta/llama-3.3-70b-instruct-fp16',
  }
  return defaults[provider]
}

// ── SSE helper ─────────────────────────────────────────────────────────

function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function sseChunk(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ── Chat (SSE streaming) ──────────────────────────────────────────────

aiRoutes.post('/chat', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)

  // Check feature toggle
  if (!(await isFeatureEnabled(db, 'chat', sid))) {
    return c.json({ detail: 'Chat assistant is not enabled for this school.' }, 403)
  }

  // Check rate limit
  const rl = await checkRateLimit(db, user!.id, sid)
  if (!rl.allowed) {
    return c.json(
      {
        detail: 'Daily AI limit reached.',
        limit_type: 'user',
        retry_after_seconds: rl.retryAfterSeconds,
        usage: { current: rl.current, limit: rl.limit },
      },
      429,
    )
  }

  // Parse request body
  const body = await c.req.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : null
  if (!message) return c.json({ detail: 'A message is required.' }, 400)
  if (message.length > 2000) return c.json({ detail: 'Message too long (max 2000 characters).' }, 400)

  // Resolve provider
  const resolved = await resolveProvider(db, sid)
  if (!resolved) {
    return c.json({ detail: 'No AI provider is configured. Ask your administrator to connect one.' }, 503)
  }

  // Build RAG prompt
  const { systemPrompt } = await buildChatPrompt(db, sid ?? 1, message)

  // Load recent chat history (last 10 message pairs = 20 messages)
  const history = await db`
    select role, content
    from ai_chat_history
    where user_id = ${user!.id} and school_id = ${sid}
    order by created_at desc
    limit 20
  `
  const historyMessages: AiMessage[] = history.reverse().map((h) => ({
    role: h.role as 'user' | 'assistant',
    content: String(h.content),
  }))

  const messages: AiMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: message },
  ]

  // Start streaming
  const provider = createProvider(resolved.provider, resolved.apiKey)
  const startTime = Date.now()

  // Save user message to history
  await db`
    insert into ai_chat_history (user_id, school_id, role, content)
    values (${user!.id}, ${sid}, 'user', ${message})
  `

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''
      let tokensIn = 0
      let tokensOut = 0

      try {
        for await (const chunk of provider.chat({
          messages,
          model: resolved.model,
          maxTokens: 2048,
        })) {
          if (chunk.type === 'token') {
            fullResponse += chunk.content
            tokensOut++
            controller.enqueue(
              encoder.encode(sseChunk('token', { token: chunk.content })),
            )
          } else if (chunk.type === 'done') {
            tokensIn = chunk.usage.tokens_in || tokensIn
            tokensOut = chunk.usage.tokens_out || tokensOut
          }
        }

        // Save assistant message to history
        await db`
          insert into ai_chat_history (user_id, school_id, role, content, tokens_used)
          values (${user!.id}, ${sid}, 'assistant', ${fullResponse}, ${tokensOut})
        `

        // Record usage
        await recordUsage(db, {
          userId: user!.id,
          schoolId: sid,
          requestType: 'chat',
          tokensIn,
          tokensOut,
          model: resolved.model,
          provider: resolved.provider,
        })

        // Audit log
        const durationMs = Date.now() - startTime
        await db`
          insert into ai_audit_log (user_id, school_id, action, request_type, tokens_in, tokens_out, model, provider, duration_ms)
          values (${user!.id}, ${sid}, 'chat.send', 'chat', ${tokensIn}, ${tokensOut}, ${resolved.model}, ${resolved.provider}, ${durationMs})
        `

        // Get updated usage for the client
        const usage = await getUserUsage(db, user!.id)

        controller.enqueue(
          encoder.encode(sseChunk('done', { usage: { tokens_in: tokensIn, tokens_out: tokensOut }, rate_limit: usage })),
        )
      } catch (err) {
        const durationMs = Date.now() - startTime
        const errMsg = (err as Error).message

        // Audit log the failure
        await db`
          insert into ai_audit_log (user_id, school_id, action, request_type, success, error_message, model, provider, duration_ms)
          values (${user!.id}, ${sid}, 'chat.send', 'chat', false, ${errMsg}, ${resolved.model}, ${resolved.provider}, ${durationMs})
        `

        controller.enqueue(
          encoder.encode(sseChunk('error', { detail: 'AI service temporarily unavailable. Please try again.' })),
        )
      } finally {
        controller.close()
      }
    },
  })

  return sseResponse(stream)
})

// ── Chat history ───────────────────────────────────────────────────────

aiRoutes.get('/chat/history', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)

  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10) || 20))

  const rows = await db`
    select id, role, content, tokens_used, created_at
    from ai_chat_history
    where user_id = ${user!.id} and (${sid}::bigint is null or school_id = ${sid})
    order by created_at desc
    limit ${limit}
  `

  return c.json(rows.reverse())
})

aiRoutes.delete('/chat/history', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)

  await db`
    delete from ai_chat_history
    where user_id = ${user!.id} and (${sid}::bigint is null or school_id = ${sid})
  `

  return c.body(null, 204)
})

// ── Usage ──────────────────────────────────────────────────────────────

aiRoutes.get('/usage', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  const usage = await getUserUsage(db, user!.id)
  return c.json(usage)
})

aiRoutes.get('/usage/school', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)

  // Only admins can see school-wide usage
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error

  const usage = await getSchoolUsage(db, sid)
  return c.json(usage)
})

// ── Grade analytics ────────────────────────────────────────────────────

aiRoutes.post('/analytics/grades', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)

  // Check feature toggle
  if (!(await isFeatureEnabled(db, 'grade_analytics', sid))) {
    return c.json({ detail: 'Grade analytics is not enabled for this school.' }, 403)
  }

  // Check rate limit
  const rl = await checkRateLimit(db, user!.id, sid)
  if (!rl.allowed) {
    return c.json({ detail: 'Daily AI limit reached.', retry_after_seconds: rl.retryAfterSeconds }, 429)
  }

  const body = await c.req.json().catch(() => ({}))
  const { className, examinationId } = body

  // Resolve provider
  const resolved = await resolveProvider(db, sid)
  if (!resolved) {
    return c.json({ detail: 'No AI provider is configured.' }, 503)
  }

  // Build analytics prompt
  const ctx = await getSchoolContext(db, sid)
  const contextParts = [`School: ${ctx.schoolName}`, `Year: ${ctx.academicYear ?? 'N/A'}`, `Term: ${ctx.term ?? 'N/A'}`]

  if (className) {
    const classRows = await db`
      select cr.name, cr.student_count
      from class_registers cr
      where cr.school_id = ${sid} and lower(cr.name) like lower(${`%${className}%`})
      limit 1
    `
    if (classRows.length) {
      contextParts.push(`Class: ${classRows[0].name} (${classRows[0].student_count} students)`)

      // Get exam results for this class
      const results = await db`
        select s.first_name, s.last_name, sub.subject_name, ee.score, ee.grade
        from exam_entries ee
        join students s on s.id = ee.student_id
        join exam_subjects sub on sub.id = ee.exam_subject_id
        where s.school_id = ${sid} and s.class_id = (select id from class_registers where school_id = ${sid} and lower(name) like lower(${`%${className}%`}) limit 1)
        order by s.last_name, sub.subject_name
        limit 100
      `
      if (results.length) {
        contextParts.push(`\nExam results (${results.length} entries):`)
        for (const r of results) {
          contextParts.push(`  ${r.first_name} ${r.last_name} — ${r.subject_name}: ${r.score}% (${r.grade})`)
        }
      }
    }
  }

  const systemPrompt = `You are an education analytics AI for ${ctx.schoolName}. Analyze the provided grade data and produce actionable insights.

Format your response as markdown with:
1. **Performance Overview** — class averages, pass rates
2. **Students at Risk** — those scoring below 50%, with trend if available
3. **Strengths** — top-performing subjects/students
4. **Recommendations** — specific, actionable steps for teachers

Be concise and data-driven. Use bullet points.`

  const messages: AiMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Analyze the grade data:\n\n${contextParts.join('\n')}` },
  ]

  // Stream response
  const provider = createProvider(resolved.provider, resolved.apiKey)
  const startTime = Date.now()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''
      let tokensIn = 0
      let tokensOut = 0

      try {
        for await (const chunk of provider.chat({ messages, model: resolved.model })) {
          if (chunk.type === 'token') {
            fullResponse += chunk.content
            tokensOut++
            controller.enqueue(encoder.encode(sseChunk('token', { token: chunk.content })))
          } else if (chunk.type === 'done') {
            tokensIn = chunk.usage.tokens_in || tokensIn
            tokensOut = chunk.usage.tokens_out || tokensOut
          }
        }

        await recordUsage(db, { userId: user!.id, schoolId: sid, requestType: 'grade_analytics', tokensIn, tokensOut, model: resolved.model, provider: resolved.provider })
        const durationMs = Date.now() - startTime
        await db`insert into ai_audit_log (user_id, school_id, action, request_type, tokens_in, tokens_out, model, provider, duration_ms) values (${user!.id}, ${sid}, 'analytics.grades', 'grade_analytics', ${tokensIn}, ${tokensOut}, ${resolved.model}, ${resolved.provider}, ${durationMs})`

        controller.enqueue(encoder.encode(sseChunk('done', { usage: { tokens_in: tokensIn, tokens_out: tokensOut } })))
      } catch (err) {
        const durationMs = Date.now() - startTime
        await db`insert into ai_audit_log (user_id, school_id, action, request_type, success, error_message, model, provider, duration_ms) values (${user!.id}, ${sid}, 'analytics.grades', 'grade_analytics', false, ${(err as Error).message}, ${resolved.model}, ${resolved.provider}, ${durationMs})`
        controller.enqueue(encoder.encode(sseChunk('error', { detail: 'Analytics service temporarily unavailable.' })))
      } finally {
        controller.close()
      }
    },
  })

  return sseResponse(stream)
})

// ── Finance insights ───────────────────────────────────────────────────

aiRoutes.post('/analytics/finance', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)

  // Finance role required
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error

  if (!(await isFeatureEnabled(db, 'finance_insight', sid))) {
    return c.json({ detail: 'Finance insights are not enabled for this school.' }, 403)
  }

  const rl = await checkRateLimit(db, user!.id, sid)
  if (!rl.allowed) {
    return c.json({ detail: 'Daily AI limit reached.', retry_after_seconds: rl.retryAfterSeconds }, 429)
  }

  const resolved = await resolveProvider(db, sid)
  if (!resolved) return c.json({ detail: 'No AI provider is configured.' }, 503)

  const ctx = await getSchoolContext(db, sid)
  const finance = await getFinanceSummary(db, sid)

  const contextParts = [
    `School: ${ctx.schoolName}`,
    `Year: ${ctx.academicYear ?? 'N/A'}`,
    `Term: ${ctx.term ?? 'N/A'}`,
    '',
    'Financial Summary:',
    `  Total expected: KES ${finance.total_expected.toLocaleString()}`,
    `  Collected: KES ${finance.total_collected.toLocaleString()}`,
    `  Collection rate: ${finance.collection_rate}%`,
    `  Outstanding invoices: ${finance.outstanding_count}`,
    `  Overdue invoices: ${finance.overdue_count}`,
  ]

  if (finance.recent_payments.length) {
    contextParts.push('  Recent payments:')
    for (const p of finance.recent_payments) {
      contextParts.push(`    - ${p.student}: KES ${p.amount.toLocaleString()} (${p.date})`)
    }
  }

  const systemPrompt = `You are a financial analysis AI for ${ctx.schoolName}. Analyze the provided financial data.

Format your response as markdown:
1. **Financial Health** — collection rate, trends
2. **Outstanding** — overdue invoices, amounts at risk
3. **Anomalies** — unusual patterns, potential issues
4. **Recommendations** — steps to improve collection

Be concise. Use KES for all amounts.`

  const messages: AiMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextParts.join('\n') },
  ]

  const provider = createProvider(resolved.provider, resolved.apiKey)
  const startTime = Date.now()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''
      let tokensIn = 0
      let tokensOut = 0

      try {
        for await (const chunk of provider.chat({ messages, model: resolved.model })) {
          if (chunk.type === 'token') {
            fullResponse += chunk.content
            tokensOut++
            controller.enqueue(encoder.encode(sseChunk('token', { token: chunk.content })))
          } else if (chunk.type === 'done') {
            tokensIn = chunk.usage.tokens_in || tokensIn
            tokensOut = chunk.usage.tokens_out || tokensOut
          }
        }

        await recordUsage(db, { userId: user!.id, schoolId: sid, requestType: 'finance_insight', tokensIn, tokensOut, model: resolved.model, provider: resolved.provider })
        const durationMs = Date.now() - startTime
        await db`insert into ai_audit_log (user_id, school_id, action, request_type, tokens_in, tokens_out, model, provider, duration_ms) values (${user!.id}, ${sid}, 'finance.insight', 'finance_insight', ${tokensIn}, ${tokensOut}, ${resolved.model}, ${resolved.provider}, ${durationMs})`

        controller.enqueue(encoder.encode(sseChunk('done', { usage: { tokens_in: tokensIn, tokens_out: tokensOut } })))
      } catch (err) {
        const durationMs = Date.now() - startTime
        await db`insert into ai_audit_log (user_id, school_id, action, request_type, success, error_message, model, provider, duration_ms) values (${user!.id}, ${sid}, 'finance.insight', 'finance_insight', false, ${(err as Error).message}, ${resolved.model}, ${resolved.provider}, ${durationMs})`
        controller.enqueue(encoder.encode(sseChunk('error', { detail: 'Finance analysis temporarily unavailable.' })))
      } finally {
        controller.close()
      }
    },
  })

  return sseResponse(stream)
})

// ── Report generation ──────────────────────────────────────────────────

aiRoutes.post('/reports/generate', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)

  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error

  if (!(await isFeatureEnabled(db, 'reports', sid))) {
    return c.json({ detail: 'Report generation is not enabled for this school.' }, 403)
  }

  const rl = await checkRateLimit(db, user!.id, sid)
  if (!rl.allowed) {
    return c.json({ detail: 'Daily AI limit reached.', retry_after_seconds: rl.retryAfterSeconds }, 429)
  }

  const body = await c.req.json().catch(() => ({}))
  const { type, targetId, className } = body as { type?: string; targetId?: number; className?: string }

  const resolved = await resolveProvider(db, sid)
  if (!resolved) return c.json({ detail: 'No AI provider is configured.' }, 503)

  const ctx = await getSchoolContext(db, sid)
  const contextParts = [`School: ${ctx.schoolName}`, `Year: ${ctx.academicYear ?? 'N/A'}`, `Term: ${ctx.term ?? 'N/A'}`]

  // Build context based on report type
  if (type === 'class' && className) {
    const classRows = await db`
      select cr.name, cr.student_count
      from class_registers cr
      where cr.school_id = ${sid} and lower(cr.name) like lower(${`%${className}%`})
      limit 1
    `
    if (classRows.length) {
      contextParts.push(`Class: ${classRows[0].name}`)
      contextParts.push(`Students: ${classRows[0].student_count}`)

      const results = await db`
        select s.first_name, s.last_name, avg(ee.score)::numeric as avg_score
        from students s
        left join exam_entries ee on ee.student_id = s.id and ee.school_id = ${sid}
        where s.school_id = ${sid} and s.class_id = (select id from class_registers where school_id = ${sid} and lower(name) like lower(${`%${className}%`}) limit 1)
        group by s.id, s.first_name, s.last_name
        order by avg_score desc nulls last
      `
      if (results.length) {
        contextParts.push('\nStudent results:')
        for (const r of results) {
          contextParts.push(`  ${r.first_name} ${r.last_name}: ${Math.round(Number(r.avg_score) || 0)}%`)
        }
      }
    }
  }

  const systemPrompt = `You are a report generation AI for ${ctx.schoolName}. Generate a professional school report in markdown.

The report should include:
1. Title and school name
2. Academic period
3. Summary statistics
4. Detailed breakdown by student/class
5. Performance trends
6. Recommendations

Format it cleanly with proper markdown headings, tables where appropriate, and clear sections.`

  const messages: AiMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate a ${type ?? 'term'} report:\n\n${contextParts.join('\n')}` },
  ]

  const provider = createProvider(resolved.provider, resolved.apiKey)
  const startTime = Date.now()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''
      let tokensIn = 0
      let tokensOut = 0

      try {
        for await (const chunk of provider.chat({ messages, model: resolved.model })) {
          if (chunk.type === 'token') {
            fullResponse += chunk.content
            tokensOut++
            controller.enqueue(encoder.encode(sseChunk('token', { token: chunk.content })))
          } else if (chunk.type === 'done') {
            tokensIn = chunk.usage.tokens_in || tokensIn
            tokensOut = chunk.usage.tokens_out || tokensOut
          }
        }

        await recordUsage(db, { userId: user!.id, schoolId: sid, requestType: 'report', tokensIn, tokensOut, model: resolved.model, provider: resolved.provider })
        const durationMs = Date.now() - startTime
        await db`insert into ai_audit_log (user_id, school_id, action, request_type, tokens_in, tokens_out, model, provider, duration_ms) values (${user!.id}, ${sid}, 'report.generate', 'report', ${tokensIn}, ${tokensOut}, ${resolved.model}, ${resolved.provider}, ${durationMs})`

        controller.enqueue(encoder.encode(sseChunk('done', { usage: { tokens_in: tokensIn, tokens_out: tokensOut } })))
      } catch (err) {
        const durationMs = Date.now() - startTime
        await db`insert into ai_audit_log (user_id, school_id, action, request_type, success, error_message, model, provider, duration_ms) values (${user!.id}, ${sid}, 'report.generate', 'report', false, ${(err as Error).message}, ${resolved.model}, ${resolved.provider}, ${durationMs})`
        controller.enqueue(encoder.encode(sseChunk('error', { detail: 'Report generation temporarily unavailable.' })))
      } finally {
        controller.close()
      }
    },
  })

  return sseResponse(stream)
})

// ── Admin: provider config ─────────────────────────────────────────────

aiRoutes.get('/admin/config', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  if (!(await isSuperAdmin(db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)

  const [globalKeys, schoolKeys, rateLimits, features] = await Promise.all([
    db`select id, provider, default_model, api_key_hint, status, created_at, updated_at from ai_provider_keys order by updated_at desc`,
    db`
      select sk.id, sk.school_id, si.name as school_name, sk.provider, sk.default_model, sk.api_key_hint, sk.status
      from ai_school_keys sk
      join school_info si on si.id = sk.school_id
      order by sk.school_id
    `,
    db`select id, scope, daily_limit from ai_rate_limits order by scope`,
    db`
      select ft.id, ft.school_id, si.name as school_name, ft.feature, ft.enabled
      from ai_feature_toggles ft
      left join school_info si on si.id = ft.school_id
      order by ft.school_id nulls first, ft.feature
    `,
  ])

  return c.json({
    providers: globalKeys,
    school_overrides: schoolKeys,
    rate_limits: rateLimits,
    feature_toggles: features,
  })
})

aiRoutes.put('/admin/config', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  if (!(await isSuperAdmin(db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)

  const body = await c.req.json().catch(() => ({}))

  // Save provider key
  if (body.provider && body.api_key) {
    const provider = String(body.provider)
    const apiKey = String(body.api_key)
    const hint = apiKey.slice(-4)
    const model = body.model ? String(body.model) : null

    await db`
      insert into ai_provider_keys (provider, api_key_enc, api_key_hint, default_model, status)
      values (${provider}, ${apiKey}, ${hint}, ${model}, 'active')
      on conflict (provider) do update set
        api_key_enc = excluded.api_key_enc,
        api_key_hint = excluded.api_key_hint,
        default_model = coalesce(excluded.default_model, ai_provider_keys.default_model),
        status = 'active',
        updated_at = now()
    `
    return c.json({ ok: true })
  }

  // Save school override
  if (body.school_id && body.school_provider && body.school_api_key) {
    const schoolId = Number(body.school_id)
    const provider = String(body.school_provider)
    const apiKey = String(body.school_api_key)
    const hint = apiKey.slice(-4)
    const model = body.school_model ? String(body.school_model) : null

    await db`
      insert into ai_school_keys (school_id, provider, api_key_enc, api_key_hint, default_model, status)
      values (${schoolId}, ${provider}, ${apiKey}, ${hint}, ${model}, 'active')
      on conflict (school_id, provider) do update set
        api_key_enc = excluded.api_key_enc,
        api_key_hint = excluded.api_key_hint,
        default_model = coalesce(excluded.default_model, ai_school_keys.default_model),
        status = 'active'
    `
    return c.json({ ok: true })
  }

  return c.json({ detail: 'Provide provider + api_key, or school_id + school_provider + school_api_key.' }, 400)
})

aiRoutes.delete('/admin/config/:provider', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  if (!(await isSuperAdmin(db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)

  const provider = c.req.param('provider')
  await db`update ai_provider_keys set status = 'revoked', updated_at = now() where provider = ${provider}`
  return c.body(null, 204)
})

// ── Admin: rate limits ─────────────────────────────────────────────────

aiRoutes.put('/admin/limits', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  if (!(await isSuperAdmin(db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const { scope, daily_limit } = body

  if (!scope || typeof daily_limit !== 'number') {
    return c.json({ detail: 'scope and daily_limit are required.' }, 400)
  }

  await db`
    insert into ai_rate_limits (scope, daily_limit)
    values (${String(scope)}, ${daily_limit})
    on conflict (scope) do update set daily_limit = excluded.daily_limit, updated_at = now()
  `

  return c.json({ ok: true })
})

// ── Admin: feature toggles ─────────────────────────────────────────────

aiRoutes.put('/admin/features', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  if (!(await isSuperAdmin(db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const { feature, enabled, school_id } = body

  if (!feature || typeof enabled !== 'boolean') {
    return c.json({ detail: 'feature and enabled are required.' }, 400)
  }

  const schoolIdVal = school_id != null ? Number(school_id) : null

  await db`
    insert into ai_feature_toggles (school_id, feature, enabled)
    values (${schoolIdVal}, ${String(feature)}, ${enabled})
    on conflict (school_id, feature) do update set enabled = excluded.enabled, updated_at = now()
  `

  return c.json({ ok: true })
})

// ── Admin: audit log ───────────────────────────────────────────────────

aiRoutes.get('/admin/audit', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  if (!(await isSuperAdmin(db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)

  const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
  const schoolFilter = c.req.query('school_id')

  let rows
  if (schoolFilter) {
    rows = await db.query(
      `select al.id, al.created_at as at, u.email as actor, al.action, al.request_type,
              al.tokens_in, al.tokens_out, al.model, al.provider, al.success, al.error_message, al.duration_ms,
              si.name as school_name
       from ai_audit_log al
       left join users u on u.id = al.user_id
       left join school_info si on si.id = al.school_id
       where al.school_id = $1
       order by al.created_at desc limit $2`,
      [schoolFilter, limit],
    )
  } else {
    rows = await db.query(
      `select al.id, al.created_at as at, u.email as actor, al.action, al.request_type,
              al.tokens_in, al.tokens_out, al.model, al.provider, al.success, al.error_message, al.duration_ms,
              si.name as school_name
       from ai_audit_log al
       left join users u on u.id = al.user_id
       left join school_info si on si.id = al.school_id
       order by al.created_at desc limit $1`,
      [limit],
    )
  }

  return c.json(rows)
})

// ── Admin: feature check ───────────────────────────────────────────────

aiRoutes.get('/admin/features', async (c) => {
  const { error, user } = requireAuth(c as never)
  if (error) return error

  const db = createSql(c.env)
  if (!(await isSuperAdmin(db, user!.id))) return c.json({ detail: 'Forbidden' }, 403)

  const rows = await db`
    select ft.id, ft.school_id, si.name as school_name, ft.feature, ft.enabled
    from ai_feature_toggles ft
    left join school_info si on si.id = ft.school_id
    order by ft.school_id nulls first, ft.feature
  `

  return c.json(rows)
})
