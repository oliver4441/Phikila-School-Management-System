import type { AiAdminConfig } from '../../lib/ai'

export type Tab = 'providers' | 'limits' | 'features' | 'usage' | 'audit'

export const TABS: { key: Tab; label: string }[] = [
  { key: 'providers', label: 'Providers' },
  { key: 'limits', label: 'Rate Limits' },
  { key: 'features', label: 'Features' },
  { key: 'usage', label: 'Usage' },
  { key: 'audit', label: 'Audit Log' },
]

export const FEATURES = ['chat', 'reports', 'grade_analytics', 'finance_insight'] as const

export const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', hint: 'GPT-4o-mini recommended' },
  { value: 'anthropic', label: 'Anthropic', hint: 'Claude 3.5 Haiku' },
  { value: 'gemini', label: 'Google Gemini', hint: 'Gemini 2.0 Flash (free tier)' },
  { value: 'groq', label: 'Groq', hint: 'Llama 3.3 70B (fast, free tier)' },
  { value: 'cloudflare', label: 'Cloudflare Workers AI', hint: 'Free tier on Cloudflare' },
]

export interface TabProps {
  config: AiAdminConfig
  onReload: () => void
  notify: (msg: string, tone?: 'success' | 'error' | 'info') => void
}
