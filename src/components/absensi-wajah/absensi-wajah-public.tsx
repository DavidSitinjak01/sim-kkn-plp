'use client'

/**
 * AbsensiWajahPublic
 *
 * Public, student-facing face attendance page. Reached via a link containing
 * a per-student token (`?token=...`). No auth required.
 *
 * Flow:
 *   1. Read `token` from URL search params.
 *   2. GET /api/absensi-wajah/{token} → student info card.
 *   3. If already checked in today → "sudah absen" screen.
 *   4. Otherwise → webcam capture interface.
 *   5. On submit → POST /api/absensi-wajah/{token} with `{ fotoCapture }`.
 *      - success → green success screen (jamMasuk, kelompok, confidence).
 *      - verify failed → inline error + retry.
 *      - already absen → "sudah absen" screen.
 *      - other error → generic error + retry.
 *
 * Pure client component. No 'use server'. z-ai-web-dev-sdk is NOT used here.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ScanFace,
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  User,
  MapPin,
  GraduationCap,
  Users,
  Clock,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ---------- Types ----------

type ConfidenceLevel = 'TINGGI' | 'SEDANG' | 'RENDAH'

interface StudentInfo {
  nama: string
  nim: string
  prodiNama: string
  jenjang: string
  kelompokNama: string
  tipe: string
  lokasi: string
  dosenNama: string
  sudahAbsenHariIni: boolean
  jamAbsen: string | null
}

interface SubmitSuccess {
  success: true
  match: true
  confidence: ConfidenceLevel
  reason: string
  data: {
    nama: string
    nim: string
    kelompok: string
    jamMasuk: string | null
  }
}

type LoadState = 'loading' | 'loaded' | 'error'
type CameraState = 'idle' | 'starting' | 'live' | 'error'
type SubmitState =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'verify-failed'
  | 'already-absen'
  | 'error'

// ---------- Component ----------

export function AbsensiWajahPublic() {
  const searchParams = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()

  // Info fetch state
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null)
  const [loadError, setLoadError] = useState<string>('')

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [cameraError, setCameraError] = useState<string>('')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)

  // Submit state
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitResult, setSubmitResult] = useState<SubmitSuccess | null>(null)
  const [submitError, setSubmitError] = useState<string>('')
  const [submitReason, setSubmitReason] = useState<string>('')
  const [submitConfidence, setSubmitConfidence] = useState<ConfidenceLevel | null>(null)

  // ---------- Fetch student info ----------

  const fetchInfo = useCallback(async () => {
    if (!token) {
      setLoadState('error')
      setLoadError(
        'Link absensi tidak valid. Pastikan Anda membuka link lengkap yang diberikan oleh admin.',
      )
      return
    }
    setLoadState('loading')
    setStudentInfo(null)
    setLoadError('')
    try {
      const res = await fetch(`/api/absensi-wajah/${encodeURIComponent(token)}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const data: any = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          (data && typeof data.error === 'string' && data.error) ||
          'Gagal memuat informasi absensi.'
        setLoadError(msg)
        setLoadState('error')
        return
      }
      setStudentInfo(data as StudentInfo)
      setLoadState('loaded')
    } catch {
      setLoadError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.')
      setLoadState('error')
    }
  }, [token])

  useEffect(() => {
    fetchInfo()
  }, [fetchInfo])

  // ---------- Camera helpers ----------

  const stopCamera = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      // Detach stream so the video element releases the device.
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError('')
    setCameraState('starting')
    setCapturedPhoto(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera.')
      }
      // Release any prior stream before requesting a new one.
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      })
      streamRef.current = stream
      // videoRef.current is guaranteed mounted here because the <video> element
      // is rendered whenever capturedPhoto is null (it is, since we just reset it).
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Kick off playback; ignore rejection (autoplay issues handled by muted/playsInline).
        await videoRef.current.play().catch(() => undefined)
      }
      setCameraState('live')
    } catch (e: any) {
      const errName: string = e?.name ?? ''
      let msg =
        'Gagal mengakses kamera. Pastikan Anda memberikan izin kamera pada browser.'
      if (errName === 'NotAllowedError' || errName === 'SecurityError') {
        msg =
          'Akses kamera ditolak. Mohon izinkan kamera pada pengaturan browser, lalu coba lagi.'
      } else if (errName === 'NotFoundError' || errName === 'OverconstrainedError') {
        msg = 'Kamera tidak ditemukan pada perangkat ini.'
      } else if (errName === 'NotReadableError') {
        msg =
          'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.'
      } else if (typeof e?.message === 'string' && e.message) {
        msg = e.message
      }
      setCameraError(msg)
      setCameraState('error')
      toast.error(msg)
      stopCamera()
    }
  }, [stopCamera])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) {
      toast.error('Kamera belum siap. Tunggu sebentar lalu coba lagi.')
      return
    }

    // Center-crop to a square so the captured JPEG matches the circular preview.
    const side = Math.min(vw, vh)
    const sx = (vw - side) / 2
    const sy = (vh - side) / 2
    canvas.width = side
    canvas.height = side

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      toast.error('Tidak dapat memproses gambar dari kamera.')
      return
    }

    // Mirror horizontally so the saved photo matches the on-screen selfie preview.
    ctx.translate(side, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedPhoto(dataUrl)

    // Release the camera now that we have the still image.
    stopCamera()
    setCameraState('idle')
  }, [stopCamera])

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null)
    setSubmitState('idle')
    setSubmitError('')
    setSubmitReason('')
    setSubmitConfidence(null)
    setSubmitResult(null)
    // Reopen camera for a fresh capture.
    startCamera()
  }, [startCamera])

  // ---------- Submit ----------

  const submitAbsensi = useCallback(async () => {
    if (!token || !capturedPhoto) return
    setSubmitState('submitting')
    setSubmitError('')
    setSubmitReason('')
    setSubmitConfidence(null)
    setSubmitResult(null)

    try {
      const res = await fetch(`/api/absensi-wajah/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoCapture: capturedPhoto }),
      })
      const data: any = await res.json().catch(() => ({}))

      // Case: already checked in today (server-side guard).
      if (
        !res.ok &&
        typeof data?.error === 'string' &&
        data.error.toLowerCase().includes('sudah melakukan absensi')
      ) {
        setSubmitState('already-absen')
        // Refresh info so we can show jamAbsen.
        fetchInfo()
        return
      }

      // Case: face verification failed.
      if (!res.ok && data?.success === false && data?.match === false) {
        setSubmitConfidence((data.confidence as ConfidenceLevel | undefined) ?? null)
        setSubmitReason(
          typeof data.reason === 'string' && data.reason ? data.reason : '',
        )
        setSubmitError(
          (typeof data.error === 'string' && data.error) ||
            'Verifikasi wajah GAGAL. Pastikan wajah Anda terlihat jelas.',
        )
        setSubmitState('verify-failed')
        return
      }

      // Any other error.
      if (!res.ok) {
        setSubmitError(
          (typeof data?.error === 'string' && data.error) ||
            'Gagal memproses absensi. Silakan coba lagi.',
        )
        setSubmitState('error')
        return
      }

      // Success.
      setSubmitResult(data as SubmitSuccess)
      setSubmitState('success')
      toast.success('Absensi berhasil tercatat!')
      // Safety: stop camera if still running.
      stopCamera()
    } catch {
      setSubmitError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.')
      setSubmitState('error')
    }
  }, [token, capturedPhoto, fetchInfo, stopCamera])

  // ---------- Cleanup on unmount ----------

  useEffect(() => {
    return () => {
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  // ---------- Render helpers ----------

  function renderHeader() {
    return (
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center text-white">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Absensi Wajah</p>
            <p className="text-[10px] text-muted-foreground leading-tight">SIM KKN & PLP</p>
          </div>
        </div>
      </header>
    )
  }

  function renderFooter() {
    return (
      <footer className="mt-auto border-t bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          © SIM KKN & PLP
        </div>
      </footer>
    )
  }

  function renderInfoRow(icon: ReactNode, label: string, value: ReactNode) {
    return (
      <div className="flex items-start gap-3 py-3 border-b border-border/60 last:border-0">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-sm font-medium break-words">{value}</p>
        </div>
      </div>
    )
  }

  function renderStudentCard(info: StudentInfo) {
    const tipeLabel = info.tipe === 'PLP' ? 'PLP' : info.tipe === 'KKN' ? 'KKN' : info.tipe || '-'
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">Informasi Mahasiswa</CardTitle>
              <CardDescription>
                Pastikan data berikut benar sebelum melakukan absensi.
              </CardDescription>
            </div>
            <Badge variant={info.tipe === 'PLP' ? 'secondary' : 'default'} className="shrink-0">
              {tipeLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {renderInfoRow(<User className="w-4 h-4" />, 'Nama', info.nama || '-')}
          {renderInfoRow(<GraduationCap className="w-4 h-4" />, 'NIM', info.nim || '-')}
          {renderInfoRow(
            <GraduationCap className="w-4 h-4" />,
            'Program Studi',
            info.prodiNama && info.prodiNama !== '-'
              ? `${info.prodiNama} (${info.jenjang || '-'})`
              : '-',
          )}
          {renderInfoRow(<Users className="w-4 h-4" />, 'Kelompok', info.kelompokNama || '-')}
          {renderInfoRow(<MapPin className="w-4 h-4" />, 'Lokasi', info.lokasi || '-')}
          {renderInfoRow(<User className="w-4 h-4" />, 'Dosen Pembimbing', info.dosenNama || '-')}
        </CardContent>
      </Card>
    )
  }

  // ---------- Renders ----------

  // Loading
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {renderHeader()}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Memuat informasi absensi…</p>
          </div>
        </main>
        {renderFooter()}
      </div>
    )
  }

  // Load error
  if (loadState === 'error') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {renderHeader()}
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle>Link Tidak Dapat Dibuka</CardTitle>
              <CardDescription>
                {loadError || 'Terjadi kesalahan saat memuat halaman.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={fetchInfo} variant="outline" className="w-full">
                <RefreshCw className="w-4 h-4" />
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        </main>
        {renderFooter()}
      </div>
    )
  }

  const info = studentInfo
  if (!info) {
    // Defensive guard; should not happen because loadState==='loaded' implies info set.
    return null
  }

  // Success (priority over already-absen so we don't yank the success screen away)
  if (submitState === 'success' && submitResult) {
    const conf = submitResult.confidence
    const confVariant: 'default' | 'secondary' | 'outline' =
      conf === 'TINGGI' ? 'default' : conf === 'SEDANG' ? 'secondary' : 'outline'
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {renderHeader()}
        <main className="flex-1 p-4">
          <div className="container max-w-2xl mx-auto space-y-4 pt-4">
            <Card className="border-primary/30">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Absensi Berhasil!</CardTitle>
                <CardDescription>
                  Kehadiran Anda telah tercatat. Notifikasi juga dikirim ke dosen pembimbing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted p-4 grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nama</p>
                    <p className="text-sm font-semibold break-words">
                      {submitResult.data.nama || '-'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">NIM</p>
                    <p className="text-sm font-semibold break-words">
                      {submitResult.data.nim || '-'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Kelompok
                    </p>
                    <p className="text-sm font-semibold break-words">
                      {submitResult.data.kelompok || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Jam Masuk
                    </p>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {submitResult.data.jamMasuk ?? '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <ScanFace className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Tingkat Kecocokan Wajah</span>
                  </div>
                  <Badge variant={confVariant}>{conf}</Badge>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Tutup halaman ini. Anda dapat kembali besok hari untuk absensi berikutnya.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
        {renderFooter()}
      </div>
    )
  }

  // Already checked in (from initial GET or detected after submit)
  if (info.sudahAbsenHariIni || submitState === 'already-absen') {
    const jam = info.jamAbsen ?? submitResult?.data?.jamMasuk ?? null
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {renderHeader()}
        <main className="flex-1 p-4">
          <div className="container max-w-2xl mx-auto space-y-4 pt-4">
            <Card className="border-primary/30">
              <CardHeader className="text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <CardTitle>Anda Sudah Absen Hari Ini</CardTitle>
                <CardDescription>
                  Anda telah tercatat HADIR pada absensi wajah hari ini. Tidak perlu absen lagi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted p-4 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Jam Absen
                    </p>
                    <p className="text-lg font-semibold">{jam ?? '-'}</p>
                  </div>
                </div>
                {renderStudentCard(info)}
              </CardContent>
            </Card>
          </div>
        </main>
        {renderFooter()}
      </div>
    )
  }

  // Default: capture + submit flow
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {renderHeader()}
      <main className="flex-1 p-4">
        <div className="container max-w-2xl mx-auto space-y-4 pt-4">
          {renderStudentCard(info)}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verifikasi Wajah</CardTitle>
              <CardDescription>
                Aktifkan kamera, posisikan wajah di tengah, lalu ambil foto untuk verifikasi
                kehadiran.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Camera / preview area */}
              <div className="flex justify-center">
                <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full overflow-hidden border-4 border-primary/20 bg-muted flex items-center justify-center">
                  {/* Hidden canvas used to convert video frame → JPEG data URL */}
                  <canvas ref={canvasRef} className="hidden" />

                  {capturedPhoto ? (
                    <img
                      src={capturedPhoto}
                      alt="Foto hasil jepret untuk verifikasi wajah"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      {/* Live video is always mounted when no captured photo, so the ref is
                          available when startCamera() runs. Visually hidden until 'live'. */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                          'absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity',
                          cameraState === 'live' ? 'opacity-100' : 'opacity-0',
                        )}
                      />

                      {/* Placeholder overlay when camera not live */}
                      {cameraState !== 'live' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-2 text-muted-foreground">
                          {cameraState === 'starting' ? (
                            <Loader2 className="w-10 h-10 animate-spin" />
                          ) : (
                            <ScanFace className="w-12 h-12" />
                          )}
                          <p className="text-sm font-medium">
                            {cameraState === 'starting'
                              ? 'Menyalakan kamera…'
                              : cameraState === 'error'
                                ? cameraError || 'Kamera tidak dapat diakses.'
                                : 'Kamera belum aktif'}
                          </p>
                          {cameraState === 'idle' && (
                            <p className="text-xs">Tekan tombol di bawah untuk mulai.</p>
                          )}
                        </div>
                      )}

                      {/* Face guide overlay (live only) */}
                      {cameraState === 'live' && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="w-[55%] h-[72%] rounded-[50%] border-2 border-dashed border-white/70" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Camera error message */}
              {cameraState === 'error' && cameraError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Verify-failed message (face didn't match) */}
              {submitState === 'verify-failed' && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <div className="flex items-start gap-2 text-destructive">
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{submitError}</p>
                  </div>
                  {submitReason && (
                    <p className="text-xs text-destructive/80 pl-6">{submitReason}</p>
                  )}
                  {submitConfidence && (
                    <p className="text-xs text-muted-foreground pl-6">
                      Tingkat kecocokan: {submitConfidence}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground pl-6">
                    Pastikan wajah terlihat jelas, pencahayaan cukup, dan ambil foto ulang.
                  </p>
                </div>
              )}

              {/* Generic submit error */}
              {submitState === 'error' && submitError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                {!capturedPhoto && cameraState !== 'live' && cameraState !== 'starting' && (
                  <Button onClick={startCamera} className="w-full" size="lg">
                    <Camera className="w-4 h-4" />
                    Mulai Kamera
                  </Button>
                )}

                {!capturedPhoto && cameraState === 'starting' && (
                  <Button disabled className="w-full" size="lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyalakan Kamera…
                  </Button>
                )}

                {!capturedPhoto && cameraState === 'live' && (
                  <Button onClick={capturePhoto} className="w-full" size="lg">
                    <Camera className="w-4 h-4" />
                    Ambil Foto
                  </Button>
                )}

                {capturedPhoto && (
                  <>
                    <Button
                      onClick={submitAbsensi}
                      disabled={submitState === 'submitting'}
                      className="w-full sm:flex-1"
                      size="lg"
                    >
                      {submitState === 'submitting' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memverifikasi…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Kirim Absensi
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={retakePhoto}
                      variant="outline"
                      disabled={submitState === 'submitting'}
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Ambil Ulang
                    </Button>
                  </>
                )}
              </div>

              {/* Helper tips */}
              {!capturedPhoto && (
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                  <li>Pastikan wajah berada di dalam lingkaran dan menghadap kamera.</li>
                  <li>Gunakan pencahayaan yang cukup, hindari silau.</li>
                  <li>Lepaskan masker, kacamata hitam, atau penutup wajah lainnya.</li>
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      {renderFooter()}
    </div>
  )
}
