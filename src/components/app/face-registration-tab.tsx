'use client'

/**
 * FaceRegistrationTab
 *
 * Admin / dosen tab for registering (or removing) mahasiswa face descriptors.
 *
 * Features:
 *   - Server-side search (NIM / nama) with debounce.
 *   - Statistic cards: total / registered / unregistered.
 *   - DataTable with columns: Aksi · NIM · Nama · Prodi · Status Wajah · Tanggal Registrasi.
 *   - "Daftar Wajah" button opens <FaceRegistrationDialog />.
 *   - "Hapus" button (only when registered) opens an AlertDialog confirmation.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ScanFace, Search, Trash2, Loader2, Users, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/export-utils'
import {
  FaceRegistrationDialog,
} from '@/components/app/face-registration-dialog'

// ============ Types ============
interface Prodi { id: string; kode: string; nama: string }
interface Fakultas { id: string; kode: string; nama: string }
interface MahasiswaRow {
  id: string
  nim: string
  nama: string
  email?: string
  faceDescriptor: string | null
  faceRegisteredAt: string | null
  prodi: (Prodi & { fakultas?: Fakultas | null }) | null
}

type StatTone = 'slate' | 'emerald' | 'amber'

export function FaceRegistrationTab() {
  const [data, setData] = useState<MahasiswaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // ---- Registration dialog ----
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMhs, setSelectedMhs] = useState<{
    id: string
    nim: string
    nama: string
  } | null>(null)

  // ---- Delete confirmation ----
  const [deleteTarget, setDeleteTarget] = useState<MahasiswaRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ---------- Debounce search input ----------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // ---------- Fetch mahasiswa list (server-side search) ----------
  const fetchData = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const url = q
        ? `/api/mahasiswa?search=${encodeURIComponent(q)}`
        : '/api/mahasiswa'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Gagal memuat data')
      const json: MahasiswaRow[] = await res.json()
      setData(json)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat data mahasiswa'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(debouncedSearch)
  }, [debouncedSearch, fetchData])

  // ---------- Statistics ----------
  const stats = useMemo(() => {
    const total = data.length
    const registered = data.filter((m) => !!m.faceDescriptor).length
    return { total, registered, unregistered: total - registered }
  }, [data])

  // ---------- Handlers ----------
  const openRegister = (m: MahasiswaRow) => {
    setSelectedMhs({ id: m.id, nim: m.nim, nama: m.nama })
    setDialogOpen(true)
  }

  const handleRegistered = () => {
    fetchData(debouncedSearch)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/mahasiswa/${deleteTarget.id}/face`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus data wajah')
      toast.success(json?.message || 'Data wajah berhasil dihapus')
      setDeleteTarget(null)
      fetchData(debouncedSearch)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menghapus data wajah'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  // ---------- Table columns ----------
  const columns: Column<MahasiswaRow>[] = useMemo(
    () => [
      {
        key: 'aksi',
        header: 'Aksi',
        sortable: false,
        className: 'text-left',
        render: (row) => (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => openRegister(row)}>
              <ScanFace className="w-3.5 h-3.5 mr-1.5" />
              {row.faceDescriptor ? 'Daftar Ulang' : 'Daftar Wajah'}
            </Button>
            {row.faceDescriptor && (
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                onClick={() => setDeleteTarget(row)}
                title="Hapus Data Wajah"
                aria-label={`Hapus data wajah ${row.nama}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ),
      },
      {
        key: 'nim',
        header: 'NIM',
        sortable: true,
        className: 'font-mono text-xs',
      },
      {
        key: 'nama',
        header: 'Nama',
        sortable: true,
        className: 'font-medium',
      },
      {
        key: 'prodi',
        header: 'Prodi',
        sortable: true,
        sortValue: (row) => row.prodi?.nama ?? '~',
        render: (row) => row.prodi?.nama ?? '-',
      },
      {
        key: 'status',
        header: 'Status Wajah',
        sortable: true,
        sortValue: (row) => (row.faceDescriptor ? '1-terdaftar' : '0-belum'),
        render: (row) =>
          row.faceDescriptor ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Terdaftar
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <XCircle className="w-3 h-3 mr-1" /> Belum
            </Badge>
          ),
      },
      {
        key: 'faceRegisteredAt',
        header: 'Tanggal Registrasi',
        sortable: true,
        sortValue: (row) => row.faceRegisteredAt ?? '~',
        render: (row) => (row.faceRegisteredAt ? formatDate(row.faceRegisteredAt) : '-'),
      },
    ],
    []
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Registrasi Wajah Mahasiswa"
        description="Daftarkan wajah mahasiswa untuk verifikasi absensi berbasis pengenalan wajah"
        icon={ScanFace}
        breadcrumb={['Operasional', 'Absensi', 'Registrasi Wajah']}
      />

      {/* Statistics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-muted-foreground" />}
          label="Total Mahasiswa"
          value={loading ? null : stats.total}
          tone="slate"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          label="Wajah Terdaftar"
          value={loading ? null : stats.registered}
          tone="emerald"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
          label="Belum Terdaftar"
          value={loading ? null : stats.unregistered}
          tone="amber"
        />
      </div>

      {/* Search input (server-side) */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari mahasiswa berdasarkan NIM atau nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Cari mahasiswa"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearch('')}
            title="Hapus pencarian"
            aria-label="Hapus pencarian"
          >
            <XCircle className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* DataTable */}
      {loading ? (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <DataTable
          data={data}
          columns={columns}
          searchable={false}
          pageSize={10}
          getRowId={(row) => row.id}
          emptyMessage={
            search
              ? 'Tidak ada mahasiswa yang cocok dengan pencarian'
              : 'Belum ada data mahasiswa'
          }
        />
      )}

      {/* Registration dialog */}
      <FaceRegistrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mahasiswa={selectedMhs}
        onRegistered={handleRegistered}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Wajah?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus data wajah mahasiswa{' '}
              <span className="font-semibold text-foreground">
                {deleteTarget?.nama}
              </span>{' '}
              (<span className="font-mono">{deleteTarget?.nim}</span>). Mahasiswa
              tidak akan dapat melakukan check-in wajah sampai mendaftarkan ulang
              wajahnya. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={deleting} className="w-full sm:w-auto mt-0">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600 w-full sm:w-auto"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============ StatCard sub-component ============
function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | null
  tone: StatTone
}) {
  const toneClass: Record<StatTone, string> = {
    slate: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800',
    emerald:
      'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={toneClass[tone]}>
        <CardContent className="p-3 sm:p-4 flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-background/60 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{label}</p>
            {value === null ? (
              <Skeleton className="h-6 w-12 mt-0.5" />
            ) : (
              <p className="text-lg sm:text-xl font-bold">{value}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
