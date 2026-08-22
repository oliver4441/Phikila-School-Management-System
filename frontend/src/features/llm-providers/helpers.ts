import type { Provider } from '../../lib/platform'

export function relative(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return 'never'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export function money(value: number | null): string {
  if (value === null) return '—'
  if (value === 0) return 'Free'
  return `$${value.toFixed(2)}/M`
}

export function statusTone(status: Provider['status']): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'connected') return 'success'
  if (status === 'invalid_credential') return 'danger'
  if (status === 'not_configured') return 'neutral'
  return 'warning'
}
