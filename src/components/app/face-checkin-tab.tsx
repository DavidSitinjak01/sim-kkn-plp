'use client'

/**
 * FaceCheckinTab
 *
 * Mahasiswa-facing tab that lets the student pick an active attendance session
 * and verify their face (instead of typing a QR token). Reuses the shared
 * <FaceCamera /> component and the `/api/absensi/face-checkin` endpoint.
 *
 * Flow:
 *   1. Resolve the logged-in user's mahasiswa record (by userId / email / name).
 *   2. Fetch the user's face registration status.
 *   3. Fetch active sessions for the user's kelompok(s) every 10s.
 *   4. On "Verifikasi Wajah & Check-in", open a dialog with the FaceCamera.
 *   5. On capture, POST to /api/absensi/face-checkin. Show success / retry / fatal error.
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ScanFace, CheckCircle2, XCircle, Loader2, Clock, Users, AlertCircle, RefreshCw, CalendarRange,
  LogIn, LogOut,
} from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FaceCamera, type FaceCaptureResult } from '@/components/app/face-camera'
import { formatDateShort } from '@/lib/export-utils'

// ============ Types ============
interface Prodi { id: string; kode: string; nama: string }
interface Mahasiswa {
  id: string
  nim: string
  nama: string
  email?: string
  userId?: string
  prodi: Prodi | null
}
interface SessionKelompok {
  id: string
  nama: string
  tipe: string
  tahunAkademik: string
  semester: string
}
interface ActiveSession {
  id: string
  token: string
  kelompok: SessionKelompok
  tanggal: string
  tipeSesi: string
  startsAt: string | null
  expiresAt: string
  remainingSeconds: number
  alreadyCheckedIn: boolean
  // New: separate masuk/pulang state so the UI can show which button is enabled
  masukDone?: boolean
  pulangDone?: boolean
  jamMasuk?: string | null
  jamPulang?: string | null
  absensi: { id: string; status: string; jamMasuk: string | null; jamPulang?: string | null } | null
}
interface AbsensiKelompokInfo {
  id: string
  nama: string
  tipe: string
  tahunAkademik: string
  semester: string
}
interface AbsensiDetail {
  id: string
  tanggal: string
  jamMasuk: string | null
  jamPulang?: string | null
  kelompok: AbsensiKelompokInfo
}
interface SuccessInfo {
  message: string
  distance: number
  tipe: 'MASUK' | 'PULANG'
  absensi: AbsensiDetail
  notifiedDosen?: boolean
  dosenNama?: string | null
}

type DialogView = 'camera' | 'success' | 'error-retry' | 'error-fatal'

const FACE_MATCH_THRESHOLD = 0.55

export function FaceCheckinTab() {
  const user = useAppStore((s) => s.user)

  // ---- Mahasiswa lookup ----
  const [mhsId, setMhsId] = useState<string | null>(null)
  const [mhsInfo, setMhsInfo] = useState<{ nim: string; nama: string; prodi: string } | null>(null)
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null)

  // ---- Sessions ----
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // ---- Verification dialog ----
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null)
  // pendingTipe: which action the user clicked ('MASUK' or 'PULANG'). Sent to the API
  // so the backend knows whether to create a new record or update jamPulang.
  const [pendingTipe, setPendingTipe] = useState<'MASUK' | 'PULANG'>('MASUK')
  const [dialogView, setDialogView] = useState<DialogView>('camera')
  const [checkingIn, setCheckingIn] = useState(false)
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [errorDistance, setErrorDistance] = useState<number | null>(null)

  // ============ Resolve mahasiswa linked to logged-in user ============
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/mahasiswa')
        if (!res.ok) return
        const json: Mahasiswa[] = await res.json()
        let found: Mahasiswa | undefined
        if (user?.id) found = json.find((m) => m.userId === user.id)
        if (!found && user?.email) {
          found = json.find((m) => m.email?.toLowerCase() === user.email.toLowerCase())
        }
        if (!found && user?.name) {
          found = json.find((m) => m.nama.toLowerCase() === user.name.toLowerCase())
        }
        if (cancelled) return
        if (found) {
          setMhsId(found.id)
          setMhsInfo({ nim: found.nim, nama: found.nama, prodi: found.prodi?.nama ?? '-' })
        }
      } catch {
        // silent
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  // ============ Check face registration status ============
  useEffect(() => {
    if (!mhsId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/mahasiswa/${mhsId}/face`)
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        setFaceRegistered(!!json.registered)
      } catch {
        if (!cancelled) setFaceRegistered(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mhsId])

  // ============ Fetch active sessions ============
  const fetchSessions = useCallback(
    async (silent = false) => {
      if (!mhsId) return
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await fetch(
          `/api/absensi/active-sessions?mahasiswaId=${encodeURIComponent(mhsId)}`
        )
        if (!res.ok) throw new Error('Gagal memuat sesi')
        const json = await res.json()
        setSessions(Array.isArray(json.sessions) ? (json.sessions as ActiveSession[]) : [])
      } catch {
        if (!silent) toast.error('Gagal memuat daftar sesi aktif')
      } finally {
        if (!silent) setLoading(false)
        else setRefreshing(false)
      }
    },
    [mhsId]
  )

  useEffect(() => {
    if (mhsId) fetchSessions()
  }, [mhsId, fetchSessions])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!mhsId) return
    const interval = setInterval(() => fetchSessions(true), 10000)
    return () => clearInterval(interval)
  }, [mhsId, fetchSessions])

  // ============ Open verification dialog ============
  // tipe: 'MASUK' → create new record with jamMasuk
  //       'PULANG' → update existing record's jamPulang
  const openVerification = (session: ActiveSession, tipe: 'MASUK' | 'PULANG') => {
    if (tipe === 'MASUK' && session.masukDone) return
    if (tipe === 'PULANG' && (!session.masukDone || session.pulangDone)) return
    setSelectedSession(session)
    setPendingTipe(tipe)
    setDialogView('camera')
    setSuccessInfo(null)
    setErrorMessage('')
    setErrorDistance(null)
    setDialogOpen(true)
  }

  // ============ Handle face capture → check-in ============
  const handleCapture = useCallback(
    async (result: FaceCaptureResult) => {
      if (!mhsId || !selectedSession) return
      setCheckingIn(true)
      try {
        const res = await fetch('/api/absensi/face-checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mahasiswaId: mhsId,
            sessionId: selectedSession.id,
            descriptor: result.descriptor,
            fotoSelfie: result.dataUrl,
            tipe: pendingTipe,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          // Distance provided → face didn't match, allow retry
          if (typeof json.distance === 'number' && typeof json.threshold === 'number') {
            setErrorDistance(json.distance as number)
            setErrorMessage(
              typeof json.error === 'string'
                ? json.error
                : 'Verifikasi wajah gagal. Wajah tidak cocok dengan data terdaftar.'
            )
            setDialogView('error-retry')
          } else {
            // Fatal error (not registered / not member / already checked-in / expired)
            setErrorMessage(
              typeof json.error === 'string' ? json.error : 'Gagal melakukan verifikasi wajah'
            )
            setDialogView('error-fatal')
          }
          toast.error(
            typeof json.error === 'string' ? json.error : 'Verifikasi wajah gagal'
          )
          return
        }
        // Success
        const absensi = json.absensi as AbsensiDetail
        const tipe: 'MASUK' | 'PULANG' =
          json.tipe === 'PULANG' ? 'PULANG' : 'MASUK'
        setSuccessInfo({
          message:
            typeof json.message === 'string'
              ? json.message
              : 'Verifikasi wajah berhasil!',
          distance: typeof json.distance === 'number' ? (json.distance as number) : 0,
          tipe,
          absensi,
          notifiedDosen: Boolean(json.notifiedDosen),
          dosenNama: typeof json.dosenNama === 'string' ? json.dosenNama : null,
        })
        setDialogView('success')
        toast.success(
          typeof json.message === 'string' ? json.message : 'Check-in berhasil!'
        )
        // Refresh sessions list (silent) so alreadyCheckedIn/masukDone/pulangDone badges update
        fetchSessions(true)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal melakukan verifikasi wajah'
        setErrorMessage(msg)
        setDialogView('error-fatal')
        toast.error(msg)
      } finally {
        setCheckingIn(false)
      }
    },
    [mhsId, selectedSession, fetchSessions, pendingTipe]
  )

  const handleRetry = () => {
    setDialogView('camera')
    setErrorMessage('')
    setErrorDistance(null)
  }

  const handleDone = () => {
    setDialogOpen(false)
    setSelectedSession(null)
    setPendingTipe('MASUK')
    setSuccessInfo(null)
    setErrorMessage('')
    setErrorDistance(null)
    setDialogView('camera')
  }

  // ============ Render ============
  return (
    <div className="space-y-4">
      {/* Mahasiswa info card */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {mhsInfo ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                {mhsInfo.nama.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{mhsInfo.nama}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{mhsInfo.nim}</p>
                <p className="text-xs text-muted-foreground truncate" title={mhsInfo.prodi}>{mhsInfo.prodi}</p>
              </div>
              {faceRegistered === true && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 shrink-0 text-[10px] sm:text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> <span className="hidden sm:inline">Wajah </span>Terdaftar
                </Badge>
              )}
              {faceRegistered === false && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800 shrink-0 text-[10px] sm:text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" /> <span className="hidden sm:inline">Wajah </span>Belum
                </Badge>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-2">
              <Skeleton className="w-10 h-10 sm:w-11 sm:h-11 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning: face not registered */}
      {faceRegistered === false && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-amber-700 dark:text-amber-300 text-sm">
              Wajah belum terdaftar
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Hubungi admin/dosen untuk mendaftarkan wajah Anda. Verifikasi wajah
              tidak dapat dilakukan sampai wajah Anda terdaftar.
            </p>
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Sesi Absensi Aktif
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => fetchSessions(false)}
          disabled={refreshing || loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              Belum ada sesi absensi aktif untuk kelompok Anda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Minta dosen/admin untuk membuka sesi absensi.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              disabled={faceRegistered === false}
              onVerifyMasuk={() => openVerification(s, 'MASUK')}
              onVerifyPulang={() => openVerification(s, 'PULANG')}
            />
          ))}
        </div>
      )}

      {/* ============ Verification Dialog ============ */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) handleDone()
          else setDialogOpen(o)
        }}
      >
        <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-primary" />
              {pendingTipe === 'PULANG' ? 'Verifikasi Wajah — Check-out Pulang' : 'Verifikasi Wajah — Check-in Masuk'}
            </DialogTitle>
            <DialogDescription>
              {selectedSession && (
                <>
                  Sesi: <span className="font-medium text-foreground">{selectedSession.kelompok.nama}</span>{' '}
                  · {formatDateShort(selectedSession.tanggal)}
                  {pendingTipe === 'PULANG' ? ' · Catat kepulangan' : ' · Catat kedatangan'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {dialogView === 'camera' && (
              <motion.div
                key="camera"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <FaceCamera
                  onCapture={handleCapture}
                  busy={checkingIn}
                  captureLabel={pendingTipe === 'PULANG' ? 'Verifikasi & Check-out' : 'Verifikasi & Check-in'}
                />
              </motion.div>
            )}

            {dialogView === 'success' && successInfo && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <div className="flex flex-col items-center text-center py-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                    successInfo.tipe === 'PULANG'
                      ? 'bg-amber-100 dark:bg-amber-900/40'
                      : 'bg-emerald-100 dark:bg-emerald-900/40'
                  }`}>
                    {successInfo.tipe === 'PULANG' ? (
                      <LogOut className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <LogIn className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <p className={`font-semibold ${
                    successInfo.tipe === 'PULANG'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {successInfo.tipe === 'PULANG' ? 'Check-out Pulang Berhasil!' : 'Check-in Masuk Berhasil!'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{successInfo.message}</p>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Kelompok</span>
                    <span className="font-medium text-right">
                      {successInfo.absensi.kelompok?.nama ?? '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Tanggal</span>
                    <span className="font-medium">
                      {formatDateShort(successInfo.absensi.tanggal)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <LogIn className="w-3 h-3 text-emerald-600" /> Jam Masuk
                    </span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      {successInfo.absensi.jamMasuk
                        ? new Date(successInfo.absensi.jamMasuk).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <LogOut className="w-3 h-3 text-amber-600" /> Jam Pulang
                    </span>
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      {successInfo.absensi.jamPulang
                        ? new Date(successInfo.absensi.jamPulang).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Skor Kecocokan</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {successInfo.distance.toFixed(3)}{' '}
                      <span className="text-xs text-muted-foreground">
                        (≤ {FACE_MATCH_THRESHOLD})
                      </span>
                    </span>
                  </div>
                </div>

                {/* Dosen notification feedback */}
                {successInfo.notifiedDosen ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Notifikasi terkirim ke dosen pendamping
                      </p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                        {successInfo.dosenNama
                          ? `Dosen: ${successInfo.dosenNama}`
                          : 'Dosen pendamping akan menerima notifikasi check-in Anda.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        Kelompok belum memiliki dosen pendamping
                      </p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                        Absensi tetap tercatat, namun tidak ada dosen yang dinotifikasi.
                      </p>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button onClick={handleDone} className="w-full">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Selesai
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

            {dialogView === 'error-retry' && (
              <motion.div
                key="error-retry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <div className="flex flex-col items-center text-center py-3">
                  <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center mb-3">
                    <XCircle className="w-10 h-10 text-rose-600 dark:text-rose-400" />
                  </div>
                  <p className="font-semibold text-rose-700 dark:text-rose-300">
                    Verifikasi Gagal
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    {errorMessage}
                  </p>
                  {errorDistance !== null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Jarak wajah:{' '}
                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {errorDistance.toFixed(3)}
                      </span>{' '}
                      · Ambang:{' '}
                      <span className="font-mono">{FACE_MATCH_THRESHOLD}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleRetry} className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
                  </Button>
                  <Button variant="outline" onClick={handleDone} className="flex-1">
                    Tutup
                  </Button>
                </div>
              </motion.div>
            )}

            {dialogView === 'error-fatal' && (
              <motion.div
                key="error-fatal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <div className="flex flex-col items-center text-center py-3">
                  <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center mb-3">
                    <AlertCircle className="w-10 h-10 text-rose-600 dark:text-rose-400" />
                  </div>
                  <p className="font-semibold text-rose-700 dark:text-rose-300">
                    Tidak Dapat Melanjutkan
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    {errorMessage}
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={handleDone} variant="outline" className="w-full">
                    Tutup
                  </Button>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ SessionCard sub-component ============
function SessionCard({
  session,
  disabled,
  onVerifyMasuk,
  onVerifyPulang,
}: {
  session: ActiveSession
  disabled: boolean
  onVerifyMasuk: () => void
  onVerifyPulang: () => void
}) {
  // Derive remaining time from the server-provided expiresAt timestamp.
  // We tick a "now" counter every second to refresh the derived value.
  // (Calling setState inside the interval callback is allowed by the
  //  react-hooks/set-state-in-effect rule because it's not synchronous.)
  const [now, setNow] = useState<number>(() => Date.now())

  const isPeriode = session.tipeSesi === 'PERIODE'
  // For PERIODE sessions we don't need a per-second tick (expiry is days away)
  useEffect(() => {
    if (isPeriode) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [isPeriode])

  const expiresAtMs = new Date(session.expiresAt).getTime()
  const remaining = Math.max(0, Math.floor((expiresAtMs - now) / 1000))

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  // Derived masuk/pulang state — fall back to alreadyCheckedIn for back-compat
  // (older API responses without masukDone/pulangDone will still work)
  const masukDone = session.masukDone ?? session.alreadyCheckedIn
  const pulangDone = session.pulangDone ?? false
  const jamMasuk = session.jamMasuk ?? session.absensi?.jamMasuk ?? null
  const jamPulang = session.jamPulang ?? session.absensi?.jamPulang ?? null

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{session.kelompok.nama}</p>
            <p className="text-xs text-muted-foreground">
              {session.kelompok.tipe} · {formatDateShort(session.tanggal)}
            </p>
          </div>
          {masukDone && pulangDone ? (
            <Badge className="bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800 shrink-0">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Lengkap
            </Badge>
          ) : isPeriode ? (
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800 shrink-0">
              <CalendarRange className="w-3 h-3 mr-1" /> Periode
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 font-mono">
              <Clock className="w-3 h-3 mr-1" />
              {mins}m {String(secs).padStart(2, '0')}s
            </Badge>
          )}
        </div>

        {isPeriode ? (
          <div className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/10 rounded-md px-2 py-1.5">
            <CalendarRange className="w-3 h-3 shrink-0" />
            <span className="truncate">Sesi periode · aktif hingga {formatDateShort(session.expiresAt)}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            TA {session.kelompok.tahunAkademik} · {session.kelompok.semester}
          </div>
        )}

        {isPeriode && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            TA {session.kelompok.tahunAkademik} · {session.kelompok.semester}
          </div>
        )}

        {/* ============ Masuk / Pulang status (perbedaan visual jelas) ============ */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`p-2.5 rounded-lg border ${
            masukDone
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-muted/40 border-border'
          }`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <LogIn className={`w-3 h-3 ${masukDone ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              <span className="text-[11px] font-semibold">Masuk</span>
            </div>
            {masukDone && jamMasuk ? (
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {new Date(jamMasuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Belum</p>
            )}
          </div>
          <div className={`p-2.5 rounded-lg border ${
            pulangDone
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-muted/40 border-border'
          }`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <LogOut className={`w-3 h-3 ${pulangDone ? 'text-amber-600' : 'text-muted-foreground'}`} />
              <span className="text-[11px] font-semibold">Pulang</span>
            </div>
            {pulangDone && jamPulang ? (
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {new Date(jamPulang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Belum</p>
            )}
          </div>
        </div>

        {/* ============ Masuk / Pulang action buttons (mode bertingkat di mobile) ============ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            onClick={onVerifyMasuk}
            disabled={disabled || masukDone}
            className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <LogIn className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold">
              {masukDone ? 'Sudah Masuk' : 'Masuk'}
            </span>
          </Button>
          <Button
            onClick={onVerifyPulang}
            disabled={disabled || !masukDone || pulangDone}
            className="h-11 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold">
              {!masukDone ? 'Belum Masuk' : pulangDone ? 'Sudah Pulang' : 'Pulang'}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
