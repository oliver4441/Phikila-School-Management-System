import { useState } from 'react'
import { Alert } from '../../../components/Alert'
import { Badge } from '../../../components/States'
import type { ScanResult } from '../types'
import { DOC_TYPE_LABELS } from '../types'
import { ParsedDataView } from './ParsedDataView'

export function ScanResultCard({
  scan,
  compact = false,
  onExportPdf,
}: {
  scan: ScanResult
  compact?: boolean
  onExportPdf?: () => void
}) {
  const [expanded, setExpanded] = useState(!compact)

  return (
    <div
      className="card"
      style={{ padding: 'var(--space-4)', marginBottom: compact ? 0 : 'var(--space-4)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <p style={{ fontWeight: 600 }}>{scan.filename}</p>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.8125rem' }}>
            {DOC_TYPE_LABELS[scan.document_type] || scan.document_type}
            {scan.processing_time_ms ? ` · ${scan.processing_time_ms.toFixed(0)}ms` : ''}
            {scan.created_at ? ` · ${new Date(scan.created_at).toLocaleString()}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Badge tone={scan.status === 'completed' ? 'success' : scan.status === 'failed' ? 'danger' : 'warning'}>
            {scan.status}
          </Badge>
          {scan.status === 'completed' && onExportPdf && (
            <button className="button button--ghost button--sm" onClick={onExportPdf} title="Export as PDF">
              📥 PDF
            </button>
          )}
          {compact && (
            <button className="button button--ghost button--sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {expanded && scan.status === 'completed' && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          {scan.error && <Alert tone="error">{scan.error}</Alert>}

          {scan.parsed_data && <ParsedDataView data={scan.parsed_data} />}

          {scan.raw_text && (
            <details style={{ marginTop: 'var(--space-3)' }}>
              <summary className="link" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                Show raw OCR text
              </summary>
              <pre style={{
                marginTop: 'var(--space-2)',
                padding: 'var(--space-3)',
                background: 'var(--color-surface-muted)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                maxHeight: '20rem',
                overflowY: 'auto',
              }}>
                {scan.raw_text}
              </pre>
            </details>
          )}
        </div>
      )}

      {expanded && scan.status === 'failed' && scan.error && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Alert tone="error">{scan.error}</Alert>
        </div>
      )}
    </div>
  )
}
