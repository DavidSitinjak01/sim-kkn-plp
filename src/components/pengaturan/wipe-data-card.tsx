'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Trash2, AlertTriangle, Loader2, ShieldAlert, Database, Users, School,
  MapPin, QrCode, ClipboardCheck, GitBranch,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface TargetOption {
  key: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const TARGETS: TargetOption[] = [
  {
    key: 'mahasiswa',
    label: 'Data Mahasiswa',
    description: 'Hapus semua mahasiswa beserta keanggotaan kelompok. Absensi & penilaian otomatis ikut terhapus jika tidak dipilih terpisah.',
    icon: Users,
    color: 'text-blue-600',
  },
  {
    key: 'sekolah',
    label: 'Data Sekolah PLP',
    description: 'Hapus semua sekolah tempat PLP. Kelompok PLP yang sudah dibuat akan di-detach (sekolah di-null), kelompok tetap ada.',
    icon: School,
    color: 'text-emerald-600',
  },
  {
    key: 'desa',
    label: 'Data Desa KKN',
    description: 'Hapus semua desa tempat KKN. Kelompok KKN yang sudah dibuat akan di-detach (desa di-null), kelompok tetap ada.',
    icon: MapPin,
    color: 'text-amber-600',
  },
  {
    key: 'absensi',
    label: 'Data Absensi',
    description: 'Hapus semua record absensi mahasiswa (HADIR/IZIN/SAKIT/ALPHA). Mahasiswa & kelompok tetap ada.',
    icon: QrCode,
    color: 'text-purple-600',
  },
  {
    key: 'penilaian',
    label: 'Data Penilaian',
    description: 'Hapus semua record nilai mahasiswa (semua jenis: KKN/PLP1/PLP2). Mahasiswa & dosen tetap ada.',
    icon: ClipboardCheck,
    color: 'text-rose-600',
  },
  {
    key: 'kelompok',
    label: 'Data Kelompok KKN/PLP',
    description: 'Hapus semua kelompok KKN & PLP. Absensi, penilaian, dan keanggotaan kelompok akan otomatis dihapus juga.',
    icon: GitBranch,
    color: 'text-cyan-600',
  },
]

const CONFIRM_PHRASE = 'HAPUS SEMUA'

interface WipeDataCardProps {
  onWiped?: () => void
}

export function WipeDataCard({ onWiped }: WipeDataCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [loadingCounts, setLoadingCounts] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [wiping, setWiping] = useState(false)

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      const json = await res.json()
      setCounts({
        mahasiswa: json?.totalMahasiswa ?? json?.mahasiswa ?? 0,
        sekolah: json?.totalSekolah ?? json?.sekolah ?? 0,
        desa: json?.totalDesa ?? json?.desa ?? 0,
        absensi: json?.totalAbsensi ?? json?.absensi ?? 0,
        penilaian: json?.totalPenilaian ?? json?.penilaian ?? 0,
        kelompok: json?.totalKelompok ?? json?.kelompok ?? 0,
      })
    } catch {
      setCounts(null)
    } finally {
      setLoadingCounts(false)
    }
  }, [])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  const toggleTarget = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleOpenConfirm = () => {
    if (selected.size === 0) {
      toast.error('Pilih minimal satu jenis data untuk dihapus')
      return
    }
    setConfirmText('')
    setConfirmOpen(true)
  }

  const handleWipe = async () => {
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      toast.error(`Ketik "${CONFIRM_PHRASE}" untuk konfirmasi`)
      return
    }
    setWiping(true)
    try {
      const res = await fetch('/api/wipe-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus data')

      const parts: string[] = []
      const d = json.deleted || {}
      if (d.mahasiswa > 0) parts.push(`${d.mahasiswa} mahasiswa`)
      if (d.sekolah > 0) parts.push(`${d.sekolah} sekolah`)
      if (d.desa > 0) parts.push(`${d.desa} desa`)
      if (d.absensi > 0) parts.push(`${d.absensi} absensi`)
      if (d.penilaian > 0) parts.push(`${d.penilaian} penilaian`)
      if (d.kelompok > 0) parts.push(`${d.kelompok} kelompok`)
      if (d.kelompokMember > 0) parts.push(`${d.kelompokMember} keanggotaan kelompok`)

      toast.success('Data berhasil dihapus', {
        description: parts.length > 0 ? parts.join(', ') : 'Tidak ada data yang dihapus',
        duration: 8000,
      })
      setConfirmOpen(false)
      setSelected(new Set())
      setConfirmText('')
      fetchCounts()
      onWiped?.()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus data')
    } finally {
      setWiping(false)
    }
  }

  return (
    <Card className="border-rose-200 dark:border-rose-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
          <ShieldAlert className="w-5 h-5" />
          Reset Data Operasional
        </CardTitle>
        <CardDescription>
          Hapus massal data aplikasi. <strong className="text-rose-600">Tindakan ini permanen dan tidak dapat dibatalkan.</strong> Pastikan
          Anda sudah membuat backup sebelum melanjutkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30 p-4">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 dark:text-rose-200 space-y-1">
            <p className="font-semibold">Peringatan Kritis</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Semua data yang dipilih akan <strong>dihapus permanen</strong></li>
              <li>Tidak ada undo — pastikan Anda sudah backup</li>
              <li>Data terkait (absensi, penilaian, keanggotaan kelompok) akan ikut dihapus otomatis jika parent dihapus</li>
              <li>Akun login, program studi, fakultas, dosen, dan pengaturan aplikasi <strong>tidak akan dihapus</strong></li>
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Pilih jenis data yang akan dihapus:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TARGETS.map((t) => {
              const Icon = t.icon
              const isSelected = selected.has(t.key)
              const count = counts?.[t.key]
              return (
                <label
                  key={t.key}
                  htmlFor={`wipe-${t.key}`}
                  className={`
                    relative flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all
                    ${isSelected
                      ? 'border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30'
                      : 'border-border hover:bg-muted/50'}
                  `}
                >
                  <Checkbox
                    id={`wipe-${t.key}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleTarget(t.key)}
                    className="mt-0.5 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                  />
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{t.label}</p>
                      {loadingCounts ? (
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      ) : count !== undefined && count > 0 ? (
                        <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                          {count}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {t.description}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3"
          >
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>{selected.size} jenis data</strong> terpilih untuk dihapus. Klik tombol di bawah
              untuk melanjutkan.
            </p>
          </motion.div>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t bg-rose-50/50 dark:bg-rose-950/20 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchCounts}
          disabled={loadingCounts || wiping}
        >
          {loadingCounts ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Database className="w-4 h-4 mr-1" />}
          Refresh Count
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleOpenConfirm}
          disabled={selected.size === 0 || wiping}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Hapus {selected.size > 0 ? `(${selected.size})` : 'Data'}
        </Button>
      </CardFooter>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !wiping && setConfirmOpen(o)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5" />
              Konfirmasi Hapus Data
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Anda akan menghapus <strong>{selected.size} jenis data</strong> berikut secara permanen:
                </p>
                <ul className="list-disc list-inside text-xs space-y-0.5 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-md">
                  {TARGETS.filter((t) => selected.has(t.key)).map((t) => (
                    <li key={t.key}>
                      <strong>{t.label}</strong>
                      {counts?.[t.key] ? ` (${counts[t.key]} record)` : ''}
                    </li>
                  ))}
                </ul>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
                  <p className="text-[11px] text-amber-800 dark:text-amber-200">
                    ⚠️ Data yang sudah dihapus <strong>tidak dapat dikembalikan</strong>. Pastikan Anda
                    sudah membuat backup jika diperlukan.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-text" className="text-xs">
                    Ketik <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-rose-600">{CONFIRM_PHRASE}</code> untuk konfirmasi:
                  </Label>
                  <Input
                    id="confirm-text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    className="font-mono"
                    autoComplete="off"
                    disabled={wiping}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wiping}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWipe}
              disabled={wiping || confirmText.trim() !== CONFIRM_PHRASE}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {wiping ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Hapus Permanen
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
