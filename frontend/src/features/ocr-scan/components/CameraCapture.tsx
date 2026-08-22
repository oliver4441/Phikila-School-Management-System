import { useEffect, useRef, useState } from 'react'
import { Alert } from '../../../components/Alert'

export function CameraCapture({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mediaStream: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        mediaStream = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setStreaming(true)
        }
      })
      .catch(() => setError('Camera access denied. Please allow camera permissions.'))

    return () => {
      mediaStream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000' }}>
      {error && <Alert tone="error">{error}</Alert>}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: streaming ? 'block' : 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {!streaming && !error && (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: '#999' }}>
          <p>Initializing camera…</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', justifyContent: 'center' }}>
        <button className="button button--primary" onClick={capture} disabled={!streaming}>
          📸 Capture
        </button>
        <button className="button button--secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
