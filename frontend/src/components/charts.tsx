import { useId } from 'react'

type Point = { label: string; value: number }

function buildPath(values: number[], width: number, height: number, pad: number): string {
  const max = Math.max(...values, 1)
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = pad + i * step
      const y = height - pad - (v / max) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function AreaChart({
  points,
  ariaLabel,
  height = 180,
}: {
  points: Point[]
  ariaLabel: string
  height?: number
}) {
  const gradientId = useId()
  if (points.length === 0) {
    return <p className="state__message">No data yet.</p>
  }
  const values = points.map((p) => p.value)
  const width = 600
  const pad = 8
  const line = buildPath(values, width, height, pad)
  const area = `${line} L${(width - pad).toFixed(1)},${height - pad} L${pad},${height - pad} Z`
  const max = Math.max(...values, 1)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-emerald)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--brand-emerald)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={pad}
          x2={width - pad}
          y1={pad + f * (height - pad * 2)}
          y2={pad + f * (height - pad * 2)}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
      ))}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--brand-emerald)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <text x={pad} y={pad + 4} fontSize="10" fill="var(--color-ink-muted)" fontFamily="var(--font-mono)">
        {max}
      </text>
      <text x={pad} y={height - pad - 4} fontSize="10" fill="var(--color-ink-muted)" fontFamily="var(--font-mono)">
        0
      </text>
    </svg>
  )
}

export function BarChart({
  points,
  ariaLabel,
  height = 180,
  formatValue,
}: {
  points: Point[]
  ariaLabel: string
  height?: number
  formatValue?: (v: number) => string
}) {
  if (points.length === 0) {
    return <p className="state__message">No data yet.</p>
  }
  const max = Math.max(...points.map((p) => p.value), 1)
  return (
    <div role="img" aria-label={ariaLabel}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', height }}>
        {points.map((p) => (
          <div key={p.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
            <span
              title={`${p.label}: ${formatValue ? formatValue(p.value) : p.value}`}
              style={{
                width: '100%',
                maxWidth: '3rem',
                height: `${Math.max((p.value / max) * 100, 2)}%`,
                background: 'linear-gradient(180deg, var(--brand-emerald), var(--brand-navy-deep))',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                minHeight: 2,
              }}
            />
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--color-ink-muted)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
