# AI Features for Phikila School Management System

## Specification

**Date:** August 20, 2026
**Status:** Draft — awaiting review

---

## 1. Overview

Add AI-powered features to the Phikila School Management System, accessible via a global floating chat widget and module-specific tools. The system uses a **Bring-Your-Own-Key (BYOK)** model where the super admin manages LLM provider API keys centrally, with an optional per-school override. Features are role-gated, rate-limited per user and per school, and responses stream in real time via Server-Sent Events (SSE).

### Goals

- Keep the application free for end users (schools pay for their own API keys or use the global default).
- Enforce per-user and per-school rate limits to control costs.
- Deliver fast, streaming responses for a smooth experience.
- Gracefully degrade when AI providers are unreachable (queue for retry).
- Maintain security: AI never sees raw database credentials; it queries through controlled, read-only SQL functions.

---

## 2. Existing Architecture Context

| Layer | Stack |
|-------|-------|
| Backend | Cloudflare Worker — Hono + `@neondatabase/serverless` against Neon Postgres |
| Frontend | React + Vite, custom history-API router (no React Router) |
| Auth | Firebase Auth (browser) → backend HS256 JWT |
| Tenancy | Multi-school with roles: `super_admin`, `admin`, `academics`, `finance`, `teacher`, `student`, `viewer` |
| Storage | R2 bucket `phikila-storage` for media |
| Existing AI stubs | `workers/src/routes/llm.ts` (501 stubs for provider management), `workers/src/routes/ocr.ts` (501 stubs), `CopilotPage.tsx` (schedule copilot UI), `LlmProvidersPage.tsx` (provider connection UI) |

The existing `LlmProvidersPage` already has UI for connecting providers and managing models. The `llm.ts` backend route returns 501 for all endpoints. This spec replaces those stubs with real implementations.

---

## 3. Feature Set

### 3.1 Global Floating Chat Widget

A chat bubble accessible from **any page** in the application. Users can ask natural-language questions about school data and receive AI-generated answers grounded in the school's database (RAG).

**Scope:** Read-only queries against the school's data. The AI does not modify data directly through chat.

**Examples:**
- "How is Form 3A performing in Mathematics this term?"
- "Which students have more than 3 absences this month?"
- "Summarize the finance status for Term 2"
- "List all pending admission applications"

### 3.2 Report / Document Generation

AI generates structured documents in **Markdown**, with export to **PDF** and **Word (DOCX)** formats.

**Use cases:**
- Term report cards for students
- Parent letters and notifications
- Performance summaries for classes or departments
- Meeting minutes summaries from board notes

### 3.3 Grade Analytics & Predictions

AI analyzes examination data to produce insights:

- Identify students whose performance is declining
- Predict which students are at risk of failing
- Compare class performance across terms
- Highlight subjects with unusual score distributions

### 3.4 Finance Insights & Payment Matching

AI analyzes financial data:

- **Auto-match payments to invoices** with human approval before posting
- Detect anomalies (e.g., duplicate payments, unusually large transactions)
- Summarize financial health (collection rates, outstanding balances)
- Flag overdue invoices

---

## 4. BYOK Key Management

### 4.1 Key Hierarchy

```
Global Default Key (managed by super admin)
  └─ Per-School Override Key (optional, managed by super admin)
       └─ User-level limits (rate limits, not keys)
```

- The **super admin** manages all API keys from a dedicated admin panel.
- A **global default key** applies to all schools unless overridden.
- An optional **per-school key** can be set to isolate usage and costs.
- Individual users never provide their own API keys.

### 4.2 Provider Support

Initially support these providers (matching the existing `LlmProvidersPage` UI):

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| Google Gemini | 15 RPM, 1M tokens/day | Best free tier |
| Groq | 30 RPM, 14,400 req/day | Fastest inference |
| OpenAI | $5 credit for new accounts | GPT-4o-mini for cost efficiency |
| Anthropic | No free tier | Claude 3.5 Haiku for cost efficiency |
| Cloudflare Workers AI | 10K req/day free | Already on Cloudflare stack |

The super admin selects which provider to use as the global default. The system uses the cheapest/fastest model available from the connected provider.

### 4.3 Key Storage

API keys are stored encrypted in a new `ai_provider_keys` table (see Section 6). The existing `LlmProvidersPage` UI already handles key submission; the backend just needs to actually store and use them.

---

## 5. Rate Limiting

### 5.1 Default Limits

| Scope | Default Limit | Period |
|-------|---------------|--------|
| Per user | 50 requests | Per day (rolling 24h) |
| Per school | 500 requests | Per day (rolling 24h) |

These defaults are configurable by the super admin through the admin panel.

### 5.2 Enforcement

- Rate limits are checked **before** forwarding the request to the LLM provider.
- Enforcement happens in the Cloudflare Worker (edge), using a database-backed counter.
- When a limit is hit, return HTTP `429 Too Many Requests` with:
  ```json
  {
    "detail": "Daily AI limit reached",
    "limit_type": "user" | "school",
    "retry_after_seconds": 3600,
    "usage": { "current": 50, "limit": 50 }
  }
  ```
- The frontend displays a friendly message with the retry timer.

### 5.3 Storage

Usage counters are stored in Neon Postgres (source of truth) with a table `ai_usage` (see Section 6). A lightweight in-memory cache per worker invocation reduces DB writes for rapid successive requests.

### 5.4 Role-Based Adjustments (Future)

The current implementation uses uniform limits. A future iteration can override per-role:
- Students: 10/day
- Teachers: 30/day
- Admins: 100/day

This is deferred to keep the initial implementation simple.

---

## 6. Database Schema

### 6.1 New Migration: `009_ai_features.sql`

```sql
-- AI provider keys (encrypted at rest via application-level encryption)
CREATE TABLE IF NOT EXISTS ai_provider_keys (
  id            SERIAL PRIMARY KEY,
  provider      TEXT NOT NULL,              -- 'openai', 'anthropic', 'gemini', 'groq', 'cloudflare'
  api_key_enc   TEXT NOT NULL,              -- encrypted API key
  api_key_hint  TEXT,                       -- last 4 chars for display
  status        TEXT NOT NULL DEFAULT 'active',  -- active, revoked
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider)
);

-- Per-school key override (optional)
CREATE TABLE IF NOT EXISTS ai_school_keys (
  id            SERIAL PRIMARY KEY,
  school_id     INTEGER NOT NULL REFERENCES school_info(id),
  provider      TEXT NOT NULL,
  api_key_enc   TEXT NOT NULL,
  api_key_hint  TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, provider)
);

-- AI usage tracking (rate limiting)
CREATE TABLE IF NOT EXISTS ai_usage (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  school_id     INTEGER,                   -- null for platform-wide ops
  request_type  TEXT NOT NULL,             -- 'chat', 'report', 'analytics', 'finance_insight'
  tokens_in     INTEGER DEFAULT 0,
  tokens_out    INTEGER DEFAULT 0,
  model         TEXT,
  provider      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast rate-limit queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day
  ON ai_usage (user_id, created_at)
  WHERE created_at > now() - interval '24 hours';

CREATE INDEX IF NOT EXISTS idx_ai_usage_school_day
  ON ai_usage (school_id, created_at)
  WHERE created_at > now() - interval '24 hours' AND school_id IS NOT NULL;

-- Chat history (for context continuity)
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  school_id     INTEGER,
  role          TEXT NOT NULL,              -- 'user', 'assistant'
  content       TEXT NOT NULL,
  tokens_used   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_user
  ON ai_chat_history (user_id, school_id, created_at DESC);

-- Rate limit configuration (super admin configurable)
CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id            SERIAL PRIMARY KEY,
  scope         TEXT NOT NULL,              -- 'global', 'school', 'role'
  scope_id      TEXT,                       -- school_id or role name
  daily_limit   INTEGER NOT NULL DEFAULT 50,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (scope, scope_id)
);

-- Insert defaults
INSERT INTO ai_rate_limits (scope, scope_id, daily_limit)
VALUES ('global', NULL, 500)
ON CONFLICT DO NOTHING;

-- AI feature toggles per school
CREATE TABLE IF NOT EXISTS ai_feature_toggles (
  id            SERIAL PRIMARY KEY,
  school_id     INTEGER,                   -- null = global default
  feature       TEXT NOT NULL,             -- 'chat', 'reports', 'grade_analytics', 'finance_insight'
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, feature)
);

-- AI audit log
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  school_id     INTEGER,
  action        TEXT NOT NULL,             -- 'chat.send', 'report.generate', 'finance.match'
  request_type  TEXT,
  tokens_in     INTEGER DEFAULT 0,
  tokens_out    INTEGER DEFAULT 0,
  model         TEXT,
  provider      TEXT,
  success       BOOLEAN DEFAULT true,
  error_message TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_school
  ON ai_audit_log (school_id, created_at DESC);
```

---

## 7. Backend Architecture

### 7.1 New Route Module: `workers/src/routes/ai.ts`

Mount at `/api/v1/ai` in `workers/src/index.ts`.

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/chat` | requireAuth | Send a chat message, receive streamed SSE response |
| `GET` | `/chat/history` | requireAuth | Get recent chat history for the current user + school |
| `DELETE` | `/chat/history` | requireAuth | Clear chat history |
| `POST` | `/reports/generate` | requireAuth + write role | Generate a report document |
| `GET` | `/reports/:id` | requireAuth | Download a generated report |
| `POST` | `/analytics/grades` | requireAuth | Get grade analytics for a class or student |
| `POST` | `/analytics/finance` | requireAuth + finance role | Get finance insights |
| `POST` | `/finance/match` | requireAuth + finance role | Auto-match payments to invoices (returns suggestions for approval) |
| `POST` | `/finance/match/:matchId/approve` | requireAuth + finance role | Approve a suggested match |
| `GET` | `/usage` | requireAuth | Get current user's usage stats |
| `GET` | `/usage/school` | requireAuth + admin role | Get school-wide usage stats |
| `GET` | `/admin/config` | requireAuth + super_admin | Get all AI configuration |
| `PUT` | `/admin/config` | requireAuth + super_admin | Update AI configuration |
| `PUT` | `/admin/limits` | requireAuth + super_admin | Update rate limits |
| `GET` | `/admin/audit` | requireAuth + super_admin | Get AI audit log |

### 7.2 Streaming Implementation

The chat endpoint uses SSE (Server-Sent Events) for real-time token delivery:

```
POST /api/v1/ai/chat
Content-Type: application/json
Accept: text/event-stream

{
  "message": "How is Form 3A performing?",
  "context": { "module": "examinations" }
}

Response: text/event-stream
event: token
data: {"token":"Based on the examination data..."}

event: token
data: {"token":" Form 3A has an average score of 72%"}

event: done
data: {"usage":{"tokens_in":450,"tokens_out":120},"model":"gpt-4o-mini"}

event: error
data: {"detail":"Rate limit exceeded"}
```

### 7.3 RAG Pipeline (Chat)

1. **Parse** the user's question to identify intent and relevant entities (class, student, subject, date range).
2. **Query** the school's database using parameterized, read-only SQL functions:
   - `ai_get_class_summary(school_id, class_name)` → enrollment, recent grades, attendance
   - `ai_get_student_summary(school_id, student_id)` → grades, attendance, health records
   - `ai_get_finance_summary(school_id, term)` → payments, invoices, balances
   - `ai_get_attendance_summary(school_id, date_range)` → attendance rates by class
3. **Compose** a system prompt with the retrieved data as context.
4. **Stream** the LLM response back to the client.
5. **Log** the interaction to `ai_usage` and `ai_audit_log`.

### 7.4 Provider Abstraction

Create `workers/src/lib/ai-provider.ts` — a unified interface for all supported providers:

```typescript
type AiProvider = {
  name: string
  chat(params: {
    messages: { role: string; content: string }[]
    model: string
    stream: boolean
    maxTokens?: number
  }): AsyncGenerator<{ type: 'token' | 'done'; content?: string; usage?: TokenUsage }>
}

// Implementations:
// - OpenAiProvider (OpenAI API)
// - AnthropicProvider (Anthropic API)
// - GeminiProvider (Google Gemini API)
// - GroqProvider (Groq API)
// - CloudflareProvider (Workers AI)
```

### 7.5 Key Resolution

When handling an AI request:

1. Check if the school has a per-school key → use it.
2. Otherwise, use the global default key.
3. If no key is configured, return a clear error: "AI is not configured for this school."
4. Encrypt/decrypt keys using a worker secret `AI_ENCRYPTION_KEY`.

### 7.6 Report Generation

Reports are generated as Markdown, then converted to PDF/DOCX:

- **Markdown:** Direct from LLM output.
- **PDF:** Use a lightweight library (e.g., `@react-pdf/renderer` on the server, or a Markdown-to-PDF conversion).
- **DOCX:** Use `docx` npm package to convert structured Markdown to Word format.

Generated reports are stored in R2 and served via the existing `/static/` route.

### 7.7 Finance Auto-Matching

The AI matching flow:

1. User triggers "Auto-match" on the payment inbox page.
2. Backend sends unmatched payments + pending invoices to the LLM.
3. LLM returns suggested matches with confidence scores.
4. Matches with confidence ≥ 80% are auto-suggested; lower confidence ones are flagged for manual review.
5. User approves/rejects each match via the UI.
6. Approved matches create payment records and update invoice status.

---

## 8. Frontend Architecture

### 8.1 Global Floating Chat Widget

New component: `frontend/src/components/AiChatWidget.tsx`

**Behavior:**
- Fixed-position chat bubble in bottom-right corner (like Intercom/Drift).
- Clicking the bubble opens a chat panel.
- Messages stream in real time (SSE via `EventSource` or `fetch` with `ReadableStream`).
- Shows rate limit status (e.g., "42/50 messages used today").
- Persists chat history per user + school.
- "Clear history" button.
- Loading/thinking indicator while AI processes.

**Integration:**
- Add `<AiChatWidget />` to `AppShell.tsx` (always visible when authenticated).
- Conditionally render based on feature toggle (`ai_feature_toggles` for `chat` feature).

### 8.2 Module-Specific AI Features

Each module gets AI buttons/panels that call the appropriate backend endpoint:

| Module | AI Feature | UI Element |
|--------|------------|------------|
| Examinations | Grade analytics | "AI Analysis" button on exam results page → shows declining students, predictions |
| Finance | Payment matching | "Auto-Match" button on payment inbox → shows match suggestions with approve/reject |
| Finance | Insights | "AI Summary" panel on finance dashboard → financial health overview |
| Reports | Document generation | "Generate Report" button on student/class pages → Markdown + PDF/DOCX download |
| Principal | AI insights | "AI Insights" section on principal page → auto-generated leadership insights |

### 8.3 Super Admin AI Panel

New page: `frontend/src/pages/AiAdminPage.tsx`
Route: `/settings/ai`

**Sections:**
1. **Provider Configuration** — extend existing `LlmProvidersPage` with actual key storage
2. **Default Model** — select which model to use globally
3. **Per-School Overrides** — list schools, set per-school API key overrides
4. **Rate Limits** — configure daily limits per user and per school
5. **Feature Toggles** — enable/disable AI features globally or per school
6. **Usage Analytics** — charts showing token usage, costs, request counts by school/user
7. **Audit Log** — searchable log of all AI interactions

### 8.4 Export Components

New components for report export:

- `frontend/src/components/ReportExporter.tsx` — renders Markdown, offers PDF/DOCX download buttons
- PDF generation via `@react-pdf/renderer` (client-side) or server-side via the worker
- DOCX generation via `docx` npm package (client-side)

---

## 9. Role-Based Access Matrix

| Feature | super_admin | admin | academics | finance | teacher | student | viewer |
|---------|:-----------:|:-----:|:---------:|:-------:|:-------:|:-------:|:------:|
| Chat assistant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Report generation | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Grade analytics | ✅ | ✅ | ✅ | ❌ | ✅ | ✅* | ❌ |
| Finance insights | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Finance auto-match | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| AI admin panel | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configure providers | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View usage stats | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

\* Students can view their own grade analytics only.

---

## 10. Offline / Degradation Handling

When the AI provider is unreachable:

1. **Queue the request** with a short TTL (5 minutes).
2. Show the user: "AI is temporarily unavailable. Your request has been queued and will be processed shortly."
3. A background retry mechanism (using Cloudflare Worker's waitUntil or a cron trigger) processes queued requests.
4. If the queue fails after 3 retries, notify the user and log the failure.
5. Module-specific features (finance matching, grade analytics) fall back to computed (non-AI) summaries if available.

---

## 11. Security Considerations

- **API keys** are encrypted at rest using `AI_ENCRYPTION_KEY` (worker secret). Never logged or returned to the frontend.
- **RAG queries** use parameterized SQL only. The AI never has access to raw database credentials.
- **Chat history** is scoped to user + school. Users can only see their own conversations.
- **Finance auto-match** requires the `finance` role. Matched data is sanitized before sending to the LLM (no raw bank account numbers).
- **Rate limits** prevent abuse. The 429 response includes retry-after information.
- **Audit log** records all AI interactions for compliance and debugging.

---

## 12. Performance Considerations

- **SSE streaming** starts delivering tokens within ~200ms of the first token from the provider.
- **Database queries for RAG** are limited to 5-second timeouts. If the DB is slow, the AI responds with general knowledge and notes that specific data was unavailable.
- **In-memory rate limit cache** reduces DB writes. Counter is flushed to DB every 60 seconds or on worker eviction.
- **Chat history** is limited to the last 20 messages for context window management.
- **Report generation** uses streaming where possible; PDF/DOCX conversion happens client-side to avoid worker timeout limits.

---

## 13. Migration Plan

### Phase 1: Core Infrastructure
1. Add database migration (`009_ai_features.sql`)
2. Implement `ai-provider.ts` with provider abstraction
3. Implement `ai.ts` route with chat endpoint (SSE streaming)
4. Implement rate limiting middleware
5. Add key management to the backend

### Phase 2: Chat Widget
6. Build `AiChatWidget.tsx` frontend component
7. Integrate into `AppShell.tsx`
8. Add chat history persistence

### Phase 3: Module Features
9. Grade analytics endpoint + UI
10. Finance insights endpoint + UI
11. Finance auto-match endpoint + UI
12. Report generation endpoint + export UI

### Phase 4: Admin Panel
13. Build `AiAdminPage.tsx` with provider config, rate limits, feature toggles
14. Usage analytics dashboard
15. Audit log viewer

### Phase 5: Polish
16. Offline queue handling
17. Error handling and graceful degradation
18. Performance optimization (caching, query tuning)

---

## 14. Open Questions

1. **Encryption library:** Which npm package for encrypting API keys at rest? (`crypto-js`, `node:crypto` built-in, or Cloudflare Workers native `crypto`)
2. **PDF/DOCX generation:** Client-side (heavier bundle) vs. server-side (worker timeout risk)? Recommend client-side for MVP.
3. **Chat context window:** How many previous messages should be included in the LLM context? (Recommended: last 10 message pairs)
4. **Cost tracking:** Should we estimate dollar cost per request based on provider pricing, or just track token counts?
5. **Model selection:** Should the super admin pick a single model globally, or allow different models for different features (e.g., cheaper model for chat, stronger model for analytics)?
