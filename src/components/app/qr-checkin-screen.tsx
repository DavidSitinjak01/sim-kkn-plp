'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  CheckCircle2, Loader2, XCircle, Clock, MapPin, Users, LogIn,
  ArrowRight, Sparkles, AlertTriangle, RotateCw,
} from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// sessionStorage key for pending QR check-in token
export const PENDING_QR_TOKEN_KEY = 'pendingQrToken'

type Status = 'loading' | 'success' | 'error' | 'already' | 'login-required' | 'not-mahasiswa'

interface CheckinResult {
  message: string
  absensi?: {
    id: string
    tanggal: string
    jamMasuk: string
    status: string
    keterangan: string | null
    mahasiswa: { nama: string; nim: string; prodi?: { nama: string | null } | null }
    kelompok: { nama: string; tipe: string }
  }
}

interface QrCheckinScreenProps {
  token: string
  onDone: () => void
}

export function QrCheckinScreen({ token, onDone }: QrCheckinScreenProps) {
  const user = useAppStore((s) => s.user)
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [mahasiswaInfo, setMahasiswaInfo] = useState<{ nama: string; nim: string; prodi?: string | null } | null>(null)

  const performCheckin = useCallback(async () => {
    if (!user) {
      setStatus('login-required')
      return
    }
    if (user.role !== 'MAHASISWA') {
      setStatus('not-mahasiswa')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      // 1. Find the matching Mahasiswa profile for this user
      const mhsRes = await fetch('/api/mahasiswa?search=' + encodeURIComponent(user.email || user.name || ''))
      if (!mhsRes.ok) throw new Error('Gagal mencari data mahasiswa')
      const mhsJson = await mhsRes.json()
      const list: any[] = mhsJson?.data || mhsJson?.items || mhsJson || []
      const arr = Array.isArray(list) ? list : []

      // Match by userId first, then email, then name
      const me =
        arr.find((m: any) => m.userId === user.id) ||
        arr.find((m: any) => m.email?.toLowerCase() === user.email?.toLowerCase()) ||
        arr.find((m: any) => m.nama?.toLowerCase() === user.name?.toLowerCase())

      if (!me) {
        setStatus('error')
        setErrorMsg('Profil mahasiswa tidak ditemukan untuk akun Anda. Hubungi admin.')
        return
      }

      setMahasiswaInfo({
        nama: me.nama,
        nim: me.nim,
        prodi: me.prodi?.nama ?? null,
      })

      // 2. Submit check-in
      const res = await fetch('/api/absensi/qr-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          mahasiswaId: me.id,
        }),
      })

      const json = await res.json()

      if (res.status === 409) {
        // Already checked-in
        setStatus('already')
        setResult(json)
        return
      }
      if (!res.ok) {
        setStatus('error')
        setErrorMsg(json?.error || 'Gagal melakukan check-in')
        return
      }

      setStatus('success')
      setResult(json)
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err?.message || 'Terjadi kesalahan jaringan')
    }
  }, [user, token])

  useEffect(() => {
    performCheckin()
  }, [performCheckin])

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return '-'
    }
  }
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return '-'
    }
  }

  // -------- LOGIN REQUIRED --------
  if (status === 'login-required') {
    const goToLogin = () => {
      try {
        sessionStorage.setItem(PENDING_QR_TOKEN_KEY, token)
      } catch {}
      router.replace('/')
    }
    return (
      <Wrapper>
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-foreground">Login Diperlukan</h2>
              <p className="text-sm text-muted-foreground">
                Anda belum login. Silakan login terlebih dahulu sebagai <strong>Mahasiswa</strong> untuk melakukan check-in absensi.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Token: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{token}</code>
              </p>
            </div>
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-3 text-xs text-sky-700 dark:text-sky-300 text-left">
              <p className="font-semibold mb-1">Setelah login berhasil:</p>
              <p>Absensi akan otomatis tercatat — Anda tidak perlu memasukkan token lagi.</p>
            </div>
            <Button onClick={goToLogin} className="w-full" size="lg">
              Ke Halaman Login <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </Wrapper>
    )
  }

  // -------- NOT MAHASISWA --------
  if (status === 'not-mahasiswa') {
    return (
      <Wrapper>
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-foreground">Akun Tidak Berhak Absensi</h2>
              <p className="text-sm text-muted-foreground">
                Akun Anda (<strong>{user?.name}</strong> · {user?.role}) tidak terdaftar sebagai Mahasiswa.
                Check-in absensi hanya tersedia untuk akun mahasiswa.
              </p>
            </div>
            <Button onClick={onDone} className="w-full">
              Kembali ke Dashboard <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </Wrapper>
    )
  }

  // -------- LOADING --------
  if (status === 'loading') {
    return (
      <Wrapper>
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 px-6 text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold">Memproses Absensi...</h2>
              <p className="text-sm text-muted-foreground">
                {mahasiswaInfo
                  ? `Mencatat kehadiran ${mahasiswaInfo.nama}`
                  : 'Menghubungkan ke server'}
              </p>
            </div>
          </CardContent>
        </Card>
      </Wrapper>
    )
  }

  // -------- ERROR --------
  if (status === 'error') {
    return (
      <Wrapper>
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center"
            >
              <XCircle className="w-9 h-9 text-rose-600 dark:text-rose-400" />
            </motion.div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-foreground">Check-in Gagal</h2>
              <p className="text-sm text-muted-foreground">{errorMsg || 'Terjadi kesalahan'}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Token: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{token}</code>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onDone()} className="flex-1">
                Kembali
              </Button>
              <Button onClick={performCheckin} className="flex-1">
                <RotateCw className="w-4 h-4 mr-1" /> Coba Lagi
              </Button>
            </div>
          </CardContent>
        </Card>
      </Wrapper>
    )
  }

  // -------- ALREADY CHECKED-IN --------
  if (status === 'already') {
    const abs = result?.absensi
    return (
      <Wrapper>
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"
            >
              <CheckCircle2 className="w-11 h-11 text-amber-600 dark:text-amber-400" />
            </motion.div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-foreground">Sudah Tercatat Hadir</h2>
              <p className="text-sm text-muted-foreground">
                Anda sudah melakukan absensi untuk sesi ini sebelumnya.
              </p>
            </div>
            {abs && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2 text-left text-sm">
                <Row icon={<Users className="w-4 h-4" />} label="Mahasiswa" value={`${abs.mahasiswa.nama} (${abs.mahasiswa.nim})`} />
                <Row icon={<MapPin className="w-4 h-4" />} label="Kelompok" value={abs.kelompok.nama} />
                <Row icon={<Clock className="w-4 h-4" />} label="Jam Masuk" value={formatTime(abs.jamMasuk)} />
              </div>
            )}
            <Button onClick={onDone} className="w-full">
              Kembali ke Dashboard <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </Wrapper>
    )
  }

  // -------- SUCCESS --------
  const abs = result?.absensi
  return (
    <Wrapper>
      <Card className="w-full max-w-md overflow-hidden">
        {/* Confetti header */}
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 pt-8 pb-6 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 left-4 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" />
            <div className="absolute top-6 right-8 w-1.5 h-1.5 bg-pink-300 rounded-full animate-pulse" />
            <div className="absolute bottom-4 left-10 w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse" />
            <div className="absolute bottom-8 right-4 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" />
          </div>
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="mx-auto w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-3"
          >
            <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold"
          >
            Terima Kasih! 🎉
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-emerald-50 text-sm mt-1"
          >
            Absensi Anda berhasil tercatat
          </motion.p>
        </div>

        <CardContent className="pt-6 pb-6 px-6 space-y-4">
          {/* Student info */}
          {abs && (
            <div className="space-y-3">
              <div className="text-center pb-3 border-b">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Selamat Datang</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{abs.mahasiswa.nama}</p>
                <p className="text-xs text-muted-foreground font-mono">{abs.mahasiswa.nim}</p>
                {abs.mahasiswa.prodi?.nama && (
                  <p className="text-xs text-muted-foreground mt-0.5">{abs.mahasiswa.prodi.nama}</p>
                )}
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-2.5">
                <Row icon={<Sparkles className="w-4 h-4 text-emerald-600" />} label="Status" value="HADIR" valueClass="font-bold text-emerald-700 dark:text-emerald-300" />
                <Row icon={<Users className="w-4 h-4 text-emerald-600" />} label="Kelompok" value={abs.kelompok.nama} />
                <Row icon={<MapPin className="w-4 h-4 text-emerald-600" />} label="Tipe" value={abs.kelompok.tipe} />
                <Row icon={<Clock className="w-4 h-4 text-emerald-600" />} label="Jam Masuk" value={formatTime(abs.jamMasuk)} valueClass="font-mono font-bold" />
                <Row icon={<Clock className="w-4 h-4 text-emerald-600" />} label="Tanggal" value={formatDate(abs.tanggal)} />
              </div>
            </div>
          )}

          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-3 text-xs text-sky-700 dark:text-sky-300 text-center">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
            Anda dapat menutup halaman ini. Absensi tersimpan otomatis di sistem.
          </div>

          <Button onClick={onDone} className="w-full" size="lg">
            Kembali ke Dashboard <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </Wrapper>
  )
}

function Row({
  icon, label, value, valueClass = '',
}: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
        {icon} {label}
      </span>
      <span className={`text-sm text-foreground text-right truncate ${valueClass}`}>{value}</span>
    </div>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {children}
      </motion.div>
    </div>
  )
}
