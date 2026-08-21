import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { SparkIcon, CloseIcon } from './icons'
import { Spinner } from './States'
import { streamChat, getChatHistory, clearChatHistory, type AiChatMessage, type AiUsage } from '../lib/ai'
import { useToast } from './Toast'

// ── Simple markdown → HTML (safe subset) ───────────────────────────────

function renderMarkdown(text: string): string {
  return text
    // Code blocks
    .replace(/```[\s\S]*?```/g, (m) => `<pre class="ai-chat-code">${m.slice(3, -3).replace(/^\w+\n/, '')}</pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="ai-chat-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[•\-]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul class="ai-chat-list">${m}</ul>`)
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="ai-chat-h">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="ai-chat-h">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="ai-chat-h">$1</h2>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="ai-chat-para">')
    .replace(/\n/g, '<br/>')
    // Wrap in paragraph
    .replace(/^(.+)/, '<p class="ai-chat-para">$1')
    .replace(/(.+)$/, '$1</p>')
}

// ── Typing indicator ───────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="ai-chat-typing" aria-label="AI is typing">
      <span className="ai-chat-typing__dot" />
      <span className="ai-chat-typing__dot" />
      <span className="ai-chat-typing__dot" />
    </div>
  )
}

// ── Rate limit bar ─────────────────────────────────────────────────────

function RateLimitBar({ usage }: { usage: AiUsage | null }) {
  if (!usage) return null
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100))
  const tone = pct >= 95 ? 'danger' : pct >= 80 ? 'warning' : ''

  return (
    <div className="ai-chat-limit">
      <span>
        {usage.used} / {usage.limit} messages used today
      </span>
      <div className="ai-chat-limit__bar">
        <div
          className={`ai-chat-limit__fill ${tone ? `ai-chat-limit__fill--${tone}` : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Main widget ────────────────────────────────────────────────────────

const EXAMPLES = [
  'How is Form 3A performing in Mathematics?',
  'Summarize the finance status this term',
  'Which students have been absent recently?',
  'Show me attendance trends',
]

export function AiChatWidget() {
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [usage, setUsage] = useState<AiUsage | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load history when panel opens
  useEffect(() => {
    if (!open || messages.length > 0) return
    setLoadingHistory(true)
    getChatHistory(20)
      .then((history) => {
        setMessages(history)
        // Get usage
        return import('../lib/ai').then((m) => m.getUsage())
      })
      .then((u) => setUsage(u))
      .catch(() => {
        // ignore — will show empty state
      })
      .finally(() => setLoadingHistory(false))
  }, [open, messages.length])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamedText])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const canSend = useMemo(() => input.trim().length > 0 && !streaming, [input, streaming])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return

      const userMsg: AiChatMessage = {
        id: Date.now(),
        role: 'user',
        content: text.trim(),
        tokens_used: 0,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setStreaming(true)
      setStreamedText('')
      setNewMessageCount(0)

      const controller = new AbortController()
      abortRef.current = controller

      let fullResponse = ''

      await streamChat({
        message: text.trim(),
        signal: controller.signal,
        onToken: (token) => {
          fullResponse += token
          setStreamedText(fullResponse)
        },
        onDone: (tokenUsage, rateLimit) => {
          const assistantMsg: AiChatMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: fullResponse,
            tokens_used: tokenUsage.tokens_out,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, assistantMsg])
          setStreamedText('')
          setStreaming(false)
          if (rateLimit) setUsage(rateLimit)
        },
        onError: (detail) => {
          setStreaming(false)
          setStreamedText('')
          notify(detail, 'error')
        },
      })
    },
    [streaming, notify],
  )

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      sendMessage(input)
    },
    [input, sendMessage],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage(input)
      }
    },
    [input, sendMessage],
  )

  const handleClear = useCallback(() => {
    clearChatHistory()
      .then(() => {
        setMessages([])
        notify('Chat history cleared.', 'success')
      })
      .catch(() => notify('Could not clear history.', 'error'))
  }, [notify])

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) setNewMessageCount(0)
      return !prev
    })
  }, [])

  // ── Render ─────────────────────────────────────────────────────────

  // Bubble (collapsed state)
  if (!open) {
    return (
      <button
        type="button"
        className="ai-chat-bubble"
        onClick={handleToggle}
        aria-label="Open AI chat assistant"
        title="Ask Phikila AI"
      >
        <SparkIcon width={22} height={22} />
        {newMessageCount > 0 && <span className="ai-chat-bubble__badge" />}
      </button>
    )
  }

  // Panel (open state)
  return (
    <div className="ai-chat-panel" role="dialog" aria-label="AI chat assistant">
      {/* Header */}
      <div className="ai-chat-header">
        <span className="ai-chat-header__title">
          <SparkIcon width={18} height={18} />
          Phikila AI
        </span>
        <span className="ai-chat-header__actions">
          <button
            type="button"
            className="ai-chat-header__btn"
            onClick={handleClear}
            title="Clear chat history"
            aria-label="Clear chat history"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </svg>
          </button>
          <button
            type="button"
            className="ai-chat-header__btn"
            onClick={handleToggle}
            aria-label="Close chat"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </span>
      </div>

      {/* Rate limit */}
      <RateLimitBar usage={usage} />

      {/* Messages */}
      <div className="ai-chat-messages">
        {loadingHistory && (
          <div className="ai-chat-msg ai-chat-msg--ai">
            <Spinner label="Loading history" />
          </div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="ai-chat-welcome">
            <p>
              <strong>Welcome to Phikila AI!</strong>
            </p>
            <p style={{ marginTop: 'var(--space-2)', color: 'var(--color-ink-muted)', fontSize: '0.875rem' }}>
              Ask me about students, grades, attendance, or finances. I have access to your school&apos;s data and will answer based on it.
            </p>
            <div className="chip-list" style={{ marginTop: 'var(--space-3)' }}>
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => sendMessage(example)}
                  >
                    {example}
                  </button>
                </li>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ai-chat-msg ai-chat-msg--${msg.role === 'user' ? 'user' : 'ai'}`}
          >
            {msg.role === 'assistant' ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
            ) : (
              msg.content
            )}
          </div>
        ))}

        {/* Streaming response */}
        {streaming && streamedText && (
          <div className="ai-chat-msg ai-chat-msg--ai">
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamedText) }} />
          </div>
        )}

        {/* Typing indicator */}
        {streaming && !streamedText && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="ai-chat-input" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="ai-chat-input__field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your school…"
          rows={1}
          maxLength={2000}
          disabled={streaming}
        />
        <button
          type="submit"
          className="ai-chat-input__send"
          disabled={!canSend}
          aria-label="Send message"
        >
          {streaming ? (
            <Spinner label="Sending" />
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
