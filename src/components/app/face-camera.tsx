'use client'

/**
 * FaceCamera — reusable camera component with live face detection.
 *
 * Features:
 *  - Loads face-api.js models on mount (lazy)
 *  - Shows live video stream with mirrored preview
 *  - Real-time face detection with overlay box
 *  - "Capture" button — calls onCapture(descriptor, frame) when face detected
 *  - Graceful handling of camera permission errors & missing face
 *
 * Used by:
 *  - FaceRegistrationDialog
 *  - FaceCheckinTab
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, CameraOff, RefreshCw, ScanFace, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import {
  loadModels, detectFace, startCamera, stopCamera, captureFrame,
  descriptorToArray,
} from '@/lib/face-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface FaceCaptureResult {
  descriptor: number[]
  dataUrl: string
  score: number
}

interface FaceCameraProps {
  /** Called when user clicks "Capture" and a face is detected. */
  onCapture: (result: FaceCaptureResult) => void | Promise<void>
  /** Disable capture button (e.g., during processing). */
  busy?: boolean
  /** Optional: button label. Default "Tangkap Wajah". */
  captureLabel?: string
  /** Optional: hide capture button (used in passive mode). */
  hideCaptureButton?: boolean
  /** Optional: auto-capture when face is stable. Default false. */
  autoCapture?: boolean
  /** Optional: min detection score (0-1) for capture to be allowed. Default 0.5 */
  minScore?: number
  /** Optional: className for outer div */
  className?: string
}

type Status =
  | 'loading-models'
  | 'requesting-camera'
  | 'live'
  | 'no-face'
  | 'captured'
  | 'error'
  | 'denied'

export function FaceCamera({
  onCapture,
  busy = false,
  captureLabel = 'Tangkap Wajah',
  hideCaptureButton = false,
  autoCapture = false,
  minScore = 0.5,
  className,
}: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastCaptureRef = useRef<number>(0)
  const autoCaptureTriggeredRef = useRef<boolean>(false)

  const [status, setStatus] = useState<Status>('loading-models')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [faceDetected, setFaceDetected] = useState<boolean>(false)
  const [detectionScore, setDetectionScore] = useState<number>(0)
  const [processing, setProcessing] = useState<boolean>(false)

  // ---------- Load models + start camera on mount ----------
  const init = useCallback(async () => {
    setStatus('loading-models')
    setErrorMsg('')
    try {
      await loadModels()
    } catch (e: any) {
      console.error('Failed to load face-api models', e)
      setStatus('error')
      setErrorMsg('Gagal memuat model AI wajah. Pastikan koneksi internet stabil lalu refresh halaman.')
      return
    }

    setStatus('requesting-camera')
    try {
      const stream = await startCamera()
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('live')
      startDetectionLoop()
    } catch (e: any) {
      console.error('Camera error', e)
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setStatus('denied')
        setErrorMsg('Akses kamera ditolak. Berikan izin kamera di pengaturan browser, lalu coba lagi.')
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        setStatus('error')
        setErrorMsg('Kamera tidak ditemukan pada perangkat ini.')
      } else {
        setStatus('error')
        setErrorMsg(e?.message || 'Gagal mengakses kamera')
      }
    }
  }, [])

  useEffect(() => {
    init()
    return () => {
      // Cleanup on unmount
      stopCamera(streamRef.current)
      streamRef.current = null
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ---------- Detection loop (throttled) ----------
  const startDetectionLoop = useCallback(() => {
    let lastRun = 0
    const THROTTLE_MS = 200 // detect at ~5 fps

    const loop = async () => {
      const now = Date.now()
      if (now - lastRun > THROTTLE_MS && videoRef.current && videoRef.current.readyState >= 2) {
        lastRun = now
        try {
          const result = await detectFace(videoRef.current)
          if (result) {
            setFaceDetected(true)
            setDetectionScore(result.score)
            drawOverlay(result.box)
            // Auto-capture if score is high and 2s elapsed since last capture
            if (autoCapture && !autoCaptureTriggeredRef.current && result.score >= Math.max(minScore, 0.7)) {
              const now2 = Date.now()
              if (now2 - lastCaptureRef.current > 2000) {
                autoCaptureTriggeredRef.current = true
                await handleCapture()
              }
            }
          } else {
            setFaceDetected(false)
            setDetectionScore(0)
            clearOverlay()
          }
        } catch (e) {
          // Silent — detection errors are non-fatal
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [autoCapture, minScore])

  const drawOverlay = (box: { x: number; y: number; width: number; height: number }) => {
    const canvas = overlayRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    // Match canvas size to displayed video size
    const w = video.clientWidth
    const h = video.clientHeight
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)

    // Video is mirrored — mirror the box too
    const scaleX = w / video.videoWidth
    const scaleY = h / video.videoHeight
    const mirroredX = (video.videoWidth - box.x - box.width) * scaleX

    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    // Draw rounded rect
    const x = mirroredX
    const y = box.y * scaleY
    const bw = box.width * scaleX
    const bh = box.height * scaleY
    const r = 8
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + bw - r, y)
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + r)
    ctx.lineTo(x + bw, y + bh - r)
    ctx.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh)
    ctx.lineTo(x + r, y + bh)
    ctx.quadraticCurveTo(x, y + bh, x, y + bh - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.stroke()

    // Corner accents for "scanner" feel
    ctx.strokeStyle = '#059669'
    ctx.lineWidth = 5
    const cornerLen = Math.min(bw, bh) * 0.18
    const corners = [
      [x, y + cornerLen, x, y, x + cornerLen, y],
      [x + bw - cornerLen, y, x + bw, y, x + bw, y + cornerLen],
      [x + bw, y + bh - cornerLen, x + bw, y + bh, x + bw - cornerLen, y + bh],
      [x + cornerLen, y + bh, x, y + bh, x, y + bh - cornerLen],
    ]
    corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x3, y3)
      ctx.stroke()
    })
  }

  const clearOverlay = () => {
    const canvas = overlayRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // ---------- Capture handler ----------
  const handleCapture = useCallback(async () => {
    if (busy || processing) return
    if (!videoRef.current) return
    setProcessing(true)
    try {
      const result = await detectFace(videoRef.current)
      if (!result) {
        toast.error('Wajah tidak terdeteksi. Posisikan wajah di tengah kamera.')
        return
      }
      if (result.score < minScore) {
        toast.error(`Wajah kurang jelas (skor: ${(result.score * 100).toFixed(0)}%). Cari pencahayaan yang lebih baik.`)
        return
      }
      const frame = captureFrame(videoRef.current, 480)
      if (!frame) {
        toast.error('Gagal menangkap frame kamera')
        return
      }
      lastCaptureRef.current = Date.now()
      await onCapture({
        descriptor: descriptorToArray(result.descriptor),
        dataUrl: frame.dataUrl,
        score: result.score,
      })
    } catch (e: any) {
      console.error(e)
      toast.error('Gagal memproses wajah: ' + (e?.message || 'unknown error'))
    } finally {
      setProcessing(false)
      autoCaptureTriggeredRef.current = false
    }
  }, [busy, processing, minScore, onCapture])

  // ---------- Retry / refresh ----------
  const handleRetry = () => {
    stopCamera(streamRef.current)
    streamRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setFaceDetected(false)
    setDetectionScore(0)
    init()
  }

  return (
    <div className={className}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Camera viewport */}
          <div className="relative aspect-[4/3] bg-slate-900 dark:bg-slate-950 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Top-left status badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-white text-xs">
              {status === 'live' && faceDetected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Wajah terdeteksi · {(detectionScore * 100).toFixed(0)}%</span>
                </>
              ) : status === 'live' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Mencari wajah...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Memuat...</span>
                </>
              )}
            </div>

            {/* Scanner overlay frame (cosmetic) */}
            {status === 'live' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-2/3 h-2/3 border-2 border-dashed border-white/20 rounded-2xl" />
              </div>
            )}

            {/* Loading / error states */}
            <AnimatePresence>
              {(status === 'loading-models' || status === 'requesting-camera') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-slate-900/80"
                >
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                  <p className="text-sm">
                    {status === 'loading-models'
                      ? 'Memuat model AI wajah (~13MB)...'
                      : 'Meminta izin kamera...'}
                  </p>
                </motion.div>
              )}

              {(status === 'error' || status === 'denied') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-slate-900/95 p-6 text-center"
                >
                  {status === 'denied' ? (
                    <CameraOff className="w-12 h-12 text-rose-400" />
                  ) : (
                    <AlertTriangle className="w-12 h-12 text-amber-400" />
                  )}
                  <p className="text-sm font-medium">{errorMsg}</p>
                  <Button size="sm" variant="secondary" onClick={handleRetry} className="mt-2">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Coba Lagi
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          {!hideCaptureButton && (
            <div className="p-3 border-t flex items-center gap-2 sm:gap-3">
              <Button
                onClick={handleCapture}
                disabled={busy || processing || !faceDetected || status !== 'live'}
                className="flex-1"
                size="lg"
              >
                {processing || busy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ScanFace className="w-4 h-4 mr-2" />
                )}
                {processing ? 'Memproses...' : busy ? 'Menyimpan...' : captureLabel}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={handleRetry}
                title="Mulai ulang kamera"
                disabled={status === 'loading-models' || status === 'requesting-camera'}
                className="shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Helper text */}
      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg">
        <Camera className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-foreground mb-0.5">Tips Verifikasi Wajah</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Posisikan wajah di tengah bingkai, menghadap langsung ke kamera</li>
            <li>Pastikan pencahayaan cukup (tidak terlalu gelap / silau)</li>
            <li>Lepas kacamata gelap / masker yang menutupi wajah</li>
            <li>Jaga jarak 30–60 cm dari kamera</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
