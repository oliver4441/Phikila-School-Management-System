import { useCallback, useRef, useState } from 'react'
import { ApiError, friendlyApiError, apiFetch } from '../../../lib/api'
import { useAsync } from '../../../lib/useAsync'
import type { BackendInfo, DocumentType, ScanResult } from '../types'

export function useOcrScan() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [docType, setDocType] = useState<DocumentType | ''>('')
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [ocrUnavailable, setOcrUnavailable] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload')

  // Load scan history
  const toMsg = useCallback((e: unknown) => friendlyApiError(e, 'load scans'), [])
  const { data: history, loading: historyLoading, reload: reloadHistory } =
    useAsync<ScanResult[]>(() => apiFetch<ScanResult[]>('/api/v1/ocr/scans?limit=20'), toMsg)

  // Load available backends
  const { data: backendData } = useAsync<{ backends: BackendInfo[] }>(
    () => apiFetch<{ backends: BackendInfo[] }>('/api/v1/ocr/backends'),
    toMsg,
  )

  function selectFile(file: File) {
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setLastResult(null)
    setUploadError(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) selectFile(file)
  }

  function handleCameraCapture(blob: Blob) {
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
    selectFile(file)
    setShowCamera(false)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setScanning(true)
    setUploadError(null)
    setLastResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (docType) formData.append('document_type', docType)

      const result = await apiFetch<ScanResult>('/api/v1/ocr/scan', {
        method: 'POST',
        body: formData,
        headers: {},
      })
      setLastResult(result)
      setActiveTab('history')
      reloadHistory()
    } catch (err) {
      // 501 is a deliberate "not on this deployment" stub — not retryable.
      if (err instanceof ApiError && err.status === 501) setOcrUnavailable(true)
      setUploadError(friendlyApiError(err, 'scan the document'))
    } finally {
      setScanning(false)
    }
  }

  function clearSelection() {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setLastResult(null)
    setUploadError(null)
  }

  return {
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
  }
}
