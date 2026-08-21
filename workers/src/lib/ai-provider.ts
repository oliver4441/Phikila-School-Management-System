/**
 * AI provider abstraction.
 *
 * Each provider implements the same interface so the rest of the app
 * never cares which LLM is behind the curtain.  Streaming is first-class:
 * every call returns an async generator of typed chunks.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type TokenUsage = { tokens_in: number; tokens_out: number }

export type AiStreamChunk =
  | { type: 'token'; content: string }
  | { type: 'done'; usage: TokenUsage }

export type AiProviderName = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'cloudflare'

export interface AiProvider {
  readonly name: AiProviderName

  /** Stream a chat completion. Yields token chunks, then a final done. */
  chat(params: {
    messages: AiMessage[]
    model: string
    maxTokens?: number
  }): AsyncGenerator<AiStreamChunk>
}

// ── Provider registry ──────────────────────────────────────────────────

const registry: Record<AiProviderName, (apiKey: string) => AiProvider> = {
  openai: (k) => new OpenAiProvider(k),
  anthropic: (k) => new AnthropicProvider(k),
  gemini: (k) => new GeminiProvider(k),
  groq: (k) => new GroqProvider(k),
  cloudflare: (k) => new CloudflareProvider(k),
}

export function createProvider(name: AiProviderName, apiKey: string): AiProvider {
  const factory = registry[name]
  if (!factory) throw new Error(`Unsupported AI provider: ${name}`)
  return factory(apiKey)
}

export function isProviderName(value: string): value is AiProviderName {
  return value in registry
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Parse SSE lines from a ReadableStream, yielding data payloads. */
async function* sseLines(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          yield line.slice(6).trim()
        }
      }
    }
    // Flush remaining
    if (buffer.startsWith('data: ')) {
      yield buffer.slice(6).trim()
    }
  } finally {
    reader.releaseLock()
  }
}

// ── OpenAI ─────────────────────────────────────────────────────────────

class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const
  constructor(private apiKey: string) {}

  async *chat(params: {
    messages: AiMessage[]
    model: string
    maxTokens?: number
  }): AsyncGenerator<AiStreamChunk> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens ?? 2048,
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI error ${response.status}: ${err}`)
    }

    let tokensIn = 0
    let tokensOut = 0

    for await (const line of sseLines(response)) {
      if (line === '[DONE]') break
      try {
        const obj = JSON.parse(line)
        const delta = obj.choices?.[0]?.delta?.content
        if (delta) {
          tokensOut++
          yield { type: 'token', content: delta }
        }
        if (obj.usage) {
          tokensIn = obj.usage.prompt_tokens ?? 0
          tokensOut = obj.usage.completion_tokens ?? 0
        }
      } catch {
        // skip malformed lines
      }
    }

    yield { type: 'done', usage: { tokens_in: tokensIn, tokens_out: tokensOut } }
  }
}

// ── Anthropic ──────────────────────────────────────────────────────────

class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const
  constructor(private apiKey: string) {}

  async *chat(params: {
    messages: AiMessage[]
    model: string
    maxTokens?: number
  }): AsyncGenerator<AiStreamChunk> {
    // Anthropic uses a separate system param
    const systemMsgs = params.messages.filter((m) => m.role === 'system')
    const nonSystem = params.messages.filter((m) => m.role !== 'system')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 2048,
        system: systemMsgs.map((m) => m.content).join('\n') || undefined,
        messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic error ${response.status}: ${err}`)
    }

    let tokensIn = 0
    let tokensOut = 0

    for await (const line of sseLines(response)) {
      try {
        const obj = JSON.parse(line)
        if (obj.type === 'content_block_delta' && obj.delta?.text) {
          tokensOut++
          yield { type: 'token', content: obj.delta.text }
        }
        if (obj.type === 'message_delta' && obj.usage) {
          tokensOut = obj.usage.output_tokens ?? tokensOut
        }
        if (obj.type === 'message_start' && obj.message?.usage) {
          tokensIn = obj.message.usage.input_tokens ?? 0
        }
      } catch {
        // skip malformed lines
      }
    }

    yield { type: 'done', usage: { tokens_in: tokensIn, tokens_out: tokensOut } }
  }
}

// ── Google Gemini ──────────────────────────────────────────────────────

class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const
  constructor(private apiKey: string) {}

  async *chat(params: {
    messages: AiMessage[]
    model: string
    maxTokens?: number
  }): AsyncGenerator<AiStreamChunk> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`

    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const systemMsgs = params.messages.filter((m) => m.role === 'system')

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemMsgs.length
          ? { parts: [{ text: systemMsgs.map((m) => m.content).join('\n') }] }
          : undefined,
        generationConfig: {
          maxOutputTokens: params.maxTokens ?? 2048,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gemini error ${response.status}: ${err}`)
    }

    let tokensIn = 0
    let tokensOut = 0

    for await (const line of sseLines(response)) {
      try {
        const obj = JSON.parse(line)
        const text = obj.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          tokensOut++
          yield { type: 'token', content: text }
        }
        if (obj.usageMetadata) {
          tokensIn = obj.usageMetadata.promptTokenCount ?? 0
          tokensOut = obj.usageMetadata.candidatesTokenCount ?? tokensOut
        }
      } catch {
        // skip malformed lines
      }
    }

    yield { type: 'done', usage: { tokens_in: tokensIn, tokens_out: tokensOut } }
  }
}

// ── Groq ───────────────────────────────────────────────────────────────

class GroqProvider implements AiProvider {
  readonly name = 'groq' as const
  constructor(private apiKey: string) {}

  async *chat(params: {
    messages: AiMessage[]
    model: string
    maxTokens?: number
  }): AsyncGenerator<AiStreamChunk> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.maxTokens ?? 2048,
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Groq error ${response.status}: ${err}`)
    }

    // Groq uses the OpenAI-compatible format
    let tokensIn = 0
    let tokensOut = 0

    for await (const line of sseLines(response)) {
      if (line === '[DONE]') break
      try {
        const obj = JSON.parse(line)
        const delta = obj.choices?.[0]?.delta?.content
        if (delta) {
          tokensOut++
          yield { type: 'token', content: delta }
        }
        if (obj.usage) {
          tokensIn = obj.usage.prompt_tokens ?? 0
          tokensOut = obj.usage.completion_tokens ?? 0
        }
      } catch {
        // skip malformed lines
      }
    }

    yield { type: 'done', usage: { tokens_in: tokensIn, tokens_out: tokensOut } }
  }
}

// ── Cloudflare Workers AI ──────────────────────────────────────────────

class CloudflareProvider implements AiProvider {
  readonly name = 'cloudflare' as const
  constructor(private apiKey: string) {}

  async *chat(params: {
    messages: AiMessage[]
    model: string
    maxTokens?: number
  }): AsyncGenerator<AiStreamChunk> {
    // Cloudflare Workers AI uses the REST API with account ID embedded in the key
    // Format: "cf_account_id:api_token"
    const [accountId, token] = this.apiKey.includes(':')
      ? this.apiKey.split(':')
      : ['', this.apiKey]

    const url = accountId
      ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${params.model}`
      : `https://api.cloudflare.com/client/v4/accounts/ai/run/${params.model}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: params.messages,
        stream: true,
        max_tokens: params.maxTokens ?? 2048,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Cloudflare AI error ${response.status}: ${err}`)
    }

    let tokensIn = 0
    let tokensOut = 0

    for await (const line of sseLines(response)) {
      try {
        const obj = JSON.parse(line)
        const text = obj.response ?? obj.result?.response
        if (text) {
          tokensOut++
          yield { type: 'token', content: text }
        }
        if (obj.usage) {
          tokensIn = obj.usage.prompt_tokens ?? 0
          tokensOut = obj.usage.completion_tokens ?? tokensOut
        }
      } catch {
        // skip malformed lines
      }
    }

    yield { type: 'done', usage: { tokens_in: tokensIn, tokens_out: tokensOut } }
  }
}
