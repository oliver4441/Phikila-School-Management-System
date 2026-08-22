import { PageHeader } from '../../components/PageHeader'
import { Alert } from '../../components/Alert'
import { EmptyState, LoadingBlock } from '../../components/States'
import type { DocumentType } from './types'
import { generatePdf } from './helpers/generatePdf'
import { CameraCapture } from './components/CameraCapture'
import { ScanResultCard } from './components/ScanResultCard'
import { useOcrScan } from './hooks/useOcrScan'

export function OcrScanPage() {
  const {
    fileRef,
    selectedFile,
    previewUrl,
    docType,
    setDocType,
    scanning,
    lastResult,
    uploadError,
    showCamera,
    setShowCamera,
    ocrUnavailable,
    activeTab,
    setActiveTab,
    history,
    historyLoading,
    backendData,
    selectFile,
    handleFileChange,
    handleCameraCapture,
    handleUpload,
    clearSelection,
  } = useOcrScan()

  if (showCamera) {
    return (
      <>
        <PageHeader
          title="Document Scanner"
          description="Use your camera to capture a document."
        />
        <section className="section card">
          <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Document Scanner"
        description="Upload or photograph exam papers, student documents, and timetables to extract structured data."
      />

      {/* ---- Tab bar ---- */}
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upload'}
          className={`button ${activeTab === 'upload' ? 'button--primary' : 'button--secondary'} button--sm`}
          onClick={() => setActiveTab('upload')}
        >
          📄 Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          className={`button ${activeTab === 'history' ? 'button--primary' : 'button--secondary'} button--sm`}
          onClick={() => setActiveTab('history')}
        >
          📋 History {history?.length ? `(${history.length})` : ''}
        </button>
      </div>

      {ocrUnavailable && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert tone="info" title="Document scanning is not available on this deployment">
            {uploadError}
          </Alert>
        </div>
      )}

      {activeTab === 'upload' && (
        <>
          {/* ---- Upload area ---- */}
          <section className="section card" style={{ marginBottom: 'var(--space-4)' }}>
            <h2 className="section__title">Capture or Upload</h2>

            {/* Source buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <button
                type="button"
                className="button button--primary"
                onClick={() => fileRef.current?.click()}
                style={{ flex: '1 1 10rem' }}
              >
                📁 Choose File
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setShowCamera(true)}
                style={{ flex: '1 1 10rem' }}
              >
                📷 Take Photo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const file = e.dataTransfer.files[0]
                if (file) selectFile(file)
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
                minHeight: selectedFile ? 'auto' : '8rem',
                padding: 'var(--space-4)',
                border: '2px dashed var(--color-line-strong)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface-muted)',
                textAlign: 'center',
              }}
            >
              {selectedFile ? (
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap', width: '100%' }}>
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: 'var(--radius-md)', objectFit: 'contain' }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: '12rem' }}>
                    <p style={{ fontWeight: 600 }}>{selectedFile.name}</p>
                    <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.85rem' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'unknown'}
                    </p>
                    <button className="button button--ghost button--sm" onClick={clearSelection} style={{ marginTop: 'var(--space-2)' }}>
                      ✕ Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: '2rem' }}>📄</span>
                  <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.9rem' }}>
                    Drag and drop a file here, or use the buttons above
                  </p>
                  <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.8rem' }}>
                    JPEG, PNG, WebP, TIFF, BMP, PDF — up to 10 MB
                  </p>
                </>
              )}
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-4)', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 12rem' }}>
                <label className="field__label" htmlFor="doc-type">Document type</label>
                <select
                  id="doc-type"
                  className="input"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType | '')}
                >
                  <option value="">Auto-detect</option>
                  <option value="exam_sheet">Exam / Results</option>
                  <option value="student_document">Student Document</option>
                  <option value="timetable">Timetable</option>
                  <option value="general">General Document</option>
                </select>
              </div>

              {backendData && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-ink-muted)', paddingBottom: '0.65rem' }}>
                  Engine: {backendData.backends.find((b) => b.available)?.label || 'None available'}
                </div>
              )}

              <button
                type="button"
                className="button button--primary"
                disabled={!selectedFile || scanning || ocrUnavailable}
                onClick={handleUpload}
              >
                {scanning ? '⏳ Scanning…' : '🔍 Scan Document'}
              </button>
            </div>

            {uploadError && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Alert tone="error" title="Scan failed">
                  {uploadError}
                </Alert>
              </div>
            )}
          </section>

          {/* ---- Last result ---- */}
          {lastResult && (
            <ScanResultCard
              scan={lastResult}
              onExportPdf={() => generatePdf(lastResult)}
            />
          )}
        </>
      )}

      {activeTab === 'history' && (
        <section className="section card">
          <h2 className="section__title">Recent Scans</h2>
          {historyLoading ? (
            <LoadingBlock label="Loading scan history" rows={3} />
          ) : !history?.length ? (
            <EmptyState
              title="No scans yet"
              description="Upload or photograph a document to get started."
              icon={<span style={{ fontSize: '1.5rem' }}>📋</span>}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {history.map((scan) => (
                <ScanResultCard
                  key={scan.id}
                  scan={scan}
                  compact
                  onExportPdf={() => generatePdf(scan)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}
