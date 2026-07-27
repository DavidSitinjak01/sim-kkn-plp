'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import {
  QrCode, CalendarDays, CalendarRange, ScanLine, FileSpreadsheet, FileText,
  Pencil, Trash2, Loader2, MapPin, CheckCircle2, AlertCircle, Users, XCircle,
  Clock, LogIn, LogOut, Info, Camera,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, generateTableHTML, formatDate, formatDateShort,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ============ Types ============
interface Prodi { id: string; kode: string; nama: string }
interface Mahasiswa {
  id: string; nim: string; nama: string; jenisKelamin: string
  prodi: Prodi | null
}
interface Kelompok {
  id: string; nama: string; tipe: string; tahunAkademik: string
  semester: string; status: string
}
interface Absensi {
  id: string
  mahasiswaId: string
  kelompokId: string
  tanggal: string
  jamMasuk: string | null
  jamPulang: string | null
  latitude: number | null
  longitude: number | null
  fotoSelfie: string | null
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA'
  keterangan: string | null
  createdAt: string
  updatedAt: string
  mahasiswa: Mahasiswa
  kelompok: Kelompok
}
interface RekapRow {
  mahasiswaId: string
  nim: string
  nama: string
  prodi: string
  kelompokNama: string
  hadir: number
  izin: number
  sakit: number
  alpha: number
  total: number
}

const STATUS_OPTIONS = [
  { value: 'HADIR', label: 'Hadir' },
  { value: 'IZIN', label: 'Izin' },
  { value: 'SAKIT', label: 'Sakit' },
  { value: 'ALPHA', label: 'Alpha' },
]

function statusBadge(s: string) {
  const map: Record<string, { cls: string; label: string }> = {
    HADIR: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', label: 'Hadir' },
    IZIN: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800', label: 'Izin' },
    SAKIT: { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800', label: 'Sakit' },
    ALPHA: { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800', label: 'Alpha' },
  }
  const m = map[s] ?? map.ALPHA
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  )
}

function formatTime(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function todayStr() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function currentMonthStr() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

// ============ Main View ============
export function AbsensiView() {
  const [tab, setTab] = useState('harian')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absensi Mahasiswa"
        description="Catat dan pantau kehadiran mahasiswa KKN & PLP dengan QR Code"
        icon={QrCode}
        breadcrumb={['Operasional', 'Absensi']}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
          <TabsTrigger value="harian" className="gap-1.5">
            <CalendarDays className="w-4 h-4" /> Rekap Harian
          </TabsTrigger>
          <TabsTrigger value="bulanan" className="gap-1.5">
            <CalendarRange className="w-4 h-4" /> Rekap Bulanan
          </TabsTrigger>
          <TabsTrigger value="scanner" className="gap-1.5">
            <ScanLine className="w-4 h-4" /> QR Scanner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="harian">
          <RekapHarianTab />
        </TabsContent>
        <TabsContent value="bulanan">
          <RekapBulananTab />
        </TabsContent>
        <TabsContent value="scanner">
          <QrScannerTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============ Shared kelompok loader hook ============
function useKelompokList() {
  const [list, setList] = useState<Kelompok[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/kelompok')
        if (!res.ok) throw new Error('Gagal')
        const json = await res.json()
        setList(json)
      } catch {
        toast.error('Gagal memuat daftar kelompok')
      } finally {
        setLoading(false)
      }
    })()
  }, [])
  return { list, loading }
}

// ============ TAB 1: Rekap Harian ============
function RekapHarianTab() {
  const { list: kelompokList, loading: kelompokLoading } = useKelompokList()
  const [data, setData] = useState<Absensi[]>([])
  const [loading, setLoading] = useState(true)
  const [tanggal, setTanggal] = useState(todayStr())
  const [kelompokId, setKelompokId] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [editTarget, setEditTarget] = useState<Absensi | null>(null)
  const [editStatus, setEditStatus] = useState<string>('HADIR')
  const [editKeterangan, setEditKeterangan] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Absensi | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('tanggal', tanggal)
      if (kelompokId !== 'ALL') params.set('kelompokId', kelompokId)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const res = await fetch(`/api/absensi?${params.toString()}`)
      if (!res.ok) throw new Error('Gagal')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat absensi harian')
    } finally {
      setLoading(false)
    }
  }, [tanggal, kelompokId, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Stats
  const stats = useMemo(() => {
    const total = data.length
    const hadir = data.filter((d) => d.status === 'HADIR').length
    const izinSakit = data.filter((d) => d.status === 'IZIN' || d.status === 'SAKIT').length
    const alpha = data.filter((d) => d.status === 'ALPHA').length
    return { total, hadir, izinSakit, alpha }
  }, [data])

  const openEdit = (a: Absensi) => {
    setEditTarget(a)
    setEditStatus(a.status)
    setEditKeterangan(a.keterangan ?? '')
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    try {
      const res = await fetch(`/api/absensi/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, keterangan: editKeterangan }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan')
      toast.success('Status absensi diperbarui')
      setEditTarget(null)
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/absensi/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus')
      toast.success('Absensi berhasil dihapus')
      setDeleteTarget(null)
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  // Export
  const handleExportCSV = () => {
    if (!data.length) { toast.error('Tidak ada data untuk diexport'); return }
    const headers = ['Tanggal', 'NIM', 'Nama Mahasiswa', 'Kelompok', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan', 'Latitude', 'Longitude']
    const rows = data.map((d) => [
      formatDateShort(d.tanggal), d.mahasiswa.nim, d.mahasiswa.nama, d.kelompok?.nama ?? '-',
      formatTime(d.jamMasuk), formatTime(d.jamPulang), d.status, d.keterangan ?? '-',
      d.latitude ?? '-', d.longitude ?? '-',
    ])
    exportToCSV(`absensi-harian-${tanggal}`, headers, rows)
  }
  const handleExportPDF = () => {
    if (!data.length) { toast.error('Tidak ada data untuk diexport'); return }
    const headers = ['Tanggal', 'NIM', 'Nama', 'Kelompok', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan']
    const rows = data.map((d) => [
      formatDateShort(d.tanggal), d.mahasiswa.nim, d.mahasiswa.nama, d.kelompok?.nama ?? '-',
      formatTime(d.jamMasuk), formatTime(d.jamPulang), d.status, d.keterangan ?? '-',
    ])
    exportToPDF(`Absensi Harian - ${formatDateShort(tanggal)}`, generateTableHTML(`Rekap Absensi Harian - ${formatDate(tanggal)}`, headers, rows))
  }

  const columns: Column<Absensi>[] = useMemo(() => [
    {
      key: 'aksi', header: 'Aksi', sortable: false, className: 'text-left',
      render: (a) => (
        <div className="flex items-center justify-start gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} title="Ubah Status">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => setDeleteTarget(a)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    {
      key: 'mahasiswa', header: 'Mahasiswa', sortable: true, sortValue: (a) => a.mahasiswa.nama,
      render: (a) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-xs font-semibold">
            {a.mahasiswa.nama.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{a.mahasiswa.nama}</p>
            <p className="text-xs text-muted-foreground font-mono">{a.mahasiswa.nim}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'kelompok', header: 'Kelompok', sortable: true, sortValue: (a) => a.kelompok?.nama ?? '',
      render: (a) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{a.kelompok?.nama ?? '-'}</p>
          <p className="text-xs text-muted-foreground">{a.kelompok?.tipe ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'jamMasuk', header: 'Jam Masuk', sortable: false, className: 'text-center',
      render: (a) => (
        <span className="inline-flex items-center gap-1 text-xs">
          <LogIn className="w-3 h-3 text-emerald-600" />
          {formatTime(a.jamMasuk)}
        </span>
      ),
    },
    {
      key: 'jamPulang', header: 'Jam Pulang', sortable: false, className: 'text-center',
      render: (a) => (
        <span className="inline-flex items-center gap-1 text-xs">
          <LogOut className="w-3 h-3 text-rose-600" />
          {formatTime(a.jamPulang)}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', sortable: true, sortValue: (a) => a.status, className: 'text-center',
      render: (a) => statusBadge(a.status),
    },
    {
      key: 'lokasi', header: 'Lokasi', sortable: false,
      render: (a) => (
        a.latitude != null && a.longitude != null ? (
          <a
            href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 hover:underline"
            title="Lihat di Google Maps"
          >
            <MapPin className="w-3 h-3" />
            {a.latitude.toFixed(3)}, {a.longitude.toFixed(3)}
          </a>
        ) : <span className="text-xs text-muted-foreground">Tidak ada</span>
      ),
    },
  ], [])

  const statCards = [
    { label: 'Total Hari Ini', value: stats.total, icon: Users, color: 'from-slate-500 to-slate-600' },
    { label: 'Hadir', value: stats.hadir, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Izin / Sakit', value: stats.izinSakit, icon: AlertCircle, color: 'from-amber-500 to-orange-500' },
    { label: 'Alpha', value: stats.alpha, icon: XCircle, color: 'from-rose-500 to-rose-600' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <Card>
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tanggal</Label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kelompok</Label>
              <Select value={kelompokId} onValueChange={setKelompokId}>
                <SelectTrigger><SelectValue placeholder="Semua Kelompok" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Kelompok</SelectItem>
                  {kelompokList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Semua Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aksi Cetak</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="flex-1">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex-1">
                  <FileText className="w-4 h-4" /> PDF
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white shrink-0`}>
                    <c.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
                    <p className="text-2xl font-bold">{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {loading || kelompokLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <DataTable
          data={data}
          columns={columns}
          searchable
          searchKeys={['mahasiswa']}
          pageSize={10}
          emptyMessage="Belum ada data absensi untuk filter yang dipilih"
          getRowId={(a) => a.id}
        />
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" /> Ubah Status Absensi
            </DialogTitle>
            <DialogDescription>
              {editTarget && (
                <>Perbarui status kehadiran untuk <strong>{editTarget.mahasiswa.nama}</strong> ({editTarget.mahasiswa.nim})</>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Status <span className="text-rose-500">*</span></Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ket">Keterangan</Label>
              <Input id="ket" value={editKeterangan} onChange={(e) => setEditKeterangan(e.target.value)} placeholder="Keterangan tambahan (opsional)" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Absensi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus record absensi <strong>{deleteTarget?.mahasiswa.nama}</strong> pada <strong>{deleteTarget && formatDateShort(deleteTarget.tanggal)}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============ TAB 2: Rekap Bulanan ============
function RekapBulananTab() {
  const { list: kelompokList, loading: kelompokLoading } = useKelompokList()
  const [data, setData] = useState<RekapRow[]>([])
  const [loading, setLoading] = useState(true)
  const [bulan, setBulan] = useState(currentMonthStr())
  const [kelompokId, setKelompokId] = useState('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('bulan', bulan)
      if (kelompokId !== 'ALL') params.set('kelompokId', kelompokId)
      const res = await fetch(`/api/absensi/rekap?${params.toString()}`)
      if (!res.ok) throw new Error('Gagal')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat rekap bulanan')
    } finally {
      setLoading(false)
    }
  }, [bulan, kelompokId])

  useEffect(() => { fetchData() }, [fetchData])

  const stats = useMemo(() => {
    const totalMhs = data.length
    const totalHadir = data.reduce((s, r) => s + r.hadir, 0)
    const totalRecords = data.reduce((s, r) => s + r.total, 0)
    const avgKehadiran = totalRecords > 0 ? Math.round((totalHadir / totalRecords) * 100) : 0
    const totalAlpha = data.reduce((s, r) => s + r.alpha, 0)
    return { totalMhs, totalHadir, avgKehadiran, totalAlpha }
  }, [data])

  const handleExportCSV = () => {
    if (!data.length) { toast.error('Tidak ada data untuk diexport'); return }
    const headers = ['NIM', 'Nama', 'Prodi', 'Kelompok', 'Hadir', 'Izin', 'Sakit', 'Alpha', 'Total', 'Persentase %']
    const rows = data.map((r) => {
      const pct = r.total > 0 ? Math.round((r.hadir / r.total) * 100) : 0
      return [r.nim, r.nama, r.prodi, r.kelompokNama, r.hadir, r.izin, r.sakit, r.alpha, r.total, pct]
    })
    exportToCSV(`rekap-bulanan-${bulan}`, headers, rows)
  }
  const handleExportPDF = () => {
    if (!data.length) { toast.error('Tidak ada data untuk diexport'); return }
    const headers = ['NIM', 'Nama', 'Hadir', 'Izin', 'Sakit', 'Alpha', 'Total', '%']
    const rows = data.map((r) => {
      const pct = r.total > 0 ? Math.round((r.hadir / r.total) * 100) : 0
      return [r.nim, r.nama, r.hadir, r.izin, r.sakit, r.alpha, r.total, pct + '%']
    })
    exportToPDF(`Rekap Bulanan ${bulan}`, generateTableHTML(`Rekap Kehadiran Bulanan ${bulan}`, headers, rows))
  }

  const columns: Column<RekapRow>[] = useMemo(() => [
    {
      key: 'nama', header: 'Mahasiswa', sortable: true, sortValue: (r) => r.nama,
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-xs font-semibold">
            {r.nama.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{r.nama}</p>
            <p className="text-xs text-muted-foreground font-mono">{r.nim}</p>
          </div>
        </div>
      ),
    },
    { key: 'prodi', header: 'Prodi', sortable: true, render: (r) => <span className="text-xs">{r.prodi}</span> },
    { key: 'kelompokNama', header: 'Kelompok', sortable: true, render: (r) => <span className="text-xs">{r.kelompokNama}</span> },
    { key: 'hadir', header: 'Hadir', sortable: true, sortValue: (r) => r.hadir, className: 'text-center', render: (r) => <span className="font-semibold text-emerald-600">{r.hadir}</span> },
    { key: 'izin', header: 'Izin', sortable: true, sortValue: (r) => r.izin, className: 'text-center', render: (r) => <span className="text-amber-600">{r.izin}</span> },
    { key: 'sakit', header: 'Sakit', sortable: true, sortValue: (r) => r.sakit, className: 'text-center', render: (r) => <span className="text-sky-600">{r.sakit}</span> },
    { key: 'alpha', header: 'Alpha', sortable: true, sortValue: (r) => r.alpha, className: 'text-center', render: (r) => <span className="text-rose-600">{r.alpha}</span> },
    { key: 'total', header: 'Total', sortable: true, sortValue: (r) => r.total, className: 'text-center', render: (r) => <span className="font-semibold">{r.total}</span> },
    {
      key: 'persentase', header: 'Persentase Kehadiran', sortable: true, sortValue: (r) => r.total > 0 ? r.hadir / r.total : 0,
      render: (r) => {
        const pct = r.total > 0 ? Math.round((r.hadir / r.total) * 100) : 0
        const color = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'
        const barClass = pct >= 80 ? '[&>[data-slot=progress-indicator]]:bg-emerald-500' : pct >= 60 ? '[&>[data-slot=progress-indicator]]:bg-amber-500' : '[&>[data-slot=progress-indicator]]:bg-rose-500'
        return (
          <div className="flex items-center gap-2 min-w-[140px]">
            <Progress value={pct} className={`flex-1 h-2 ${barClass}`} />
            <span className={`text-xs font-semibold ${color} w-9 text-right`}>{pct}%</span>
          </div>
        )
      },
    },
  ], [])

  const statCards = [
    { label: 'Mahasiswa', value: stats.totalMhs, icon: Users, color: 'from-slate-500 to-slate-600' },
    { label: 'Total Hadir', value: stats.totalHadir, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Rata-rata Kehadiran', value: stats.avgKehadiran + '%', icon: CalendarRange, color: 'from-violet-500 to-purple-500' },
    { label: 'Total Alpha', value: stats.totalAlpha, icon: XCircle, color: 'from-rose-500 to-rose-600' },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Bulan</Label>
              <Input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kelompok</Label>
              <Select value={kelompokId} onValueChange={setKelompokId}>
                <SelectTrigger><SelectValue placeholder="Semua Kelompok" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Kelompok</SelectItem>
                  {kelompokList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2 flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="flex-1">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex-1">
                <FileText className="w-4 h-4" /> Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading || kelompokLoading ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white shrink-0`}>
                      <c.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
                      <p className="text-2xl font-bold truncate">{c.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <DataTable
            data={data}
            columns={columns}
            searchable
            searchKeys={['nama', 'nim']}
            pageSize={10}
            emptyMessage="Belum ada data rekap untuk bulan & kelompok terpilih"
            getRowId={(r) => r.mahasiswaId}
          />
        </>
      )}
    </div>
  )
}

// ============ TAB 3: QR Scanner ============
function QrScannerTab() {
  const { list: kelompokList, loading: kelompokLoading } = useKelompokList()
  const [mhsList, setMhsList] = useState<Mahasiswa[]>([])
  const [recentScans, setRecentScans] = useState<Absensi[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [scanInput, setScanInput] = useState('')
  const [selectedMhsId, setSelectedMhsId] = useState('')
  const [kelompokId, setKelompokId] = useState('')
  const [status, setStatus] = useState('HADIR')
  const [keterangan, setKeterangan] = useState('')
  // Selfie photo captured as JPEG data URL (base64) — stored in Absensi.fotoSelfie
  const [fotoSelfie, setFotoSelfie] = useState('')
  // Full-size photo preview (click thumbnail in recent scans to open)
  const [previewPhoto, setPreviewPhoto] = useState('')

  // QR preview state — encode a dummy mahasiswa ID
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const dummyPayload = useMemo(() => {
    // Build a small payload that contains a mahasiswa ID
    return JSON.stringify({ type: 'KKN-PLP-ABSENSI', mhsId: selectedMhsId || 'SCAN-DEMO' })
  }, [selectedMhsId])

  useEffect(() => {
    // Load mahasiswa list (lightweight, just nim+nama+id)
    (async () => {
      try {
        const res = await fetch('/api/mahasiswa')
        if (!res.ok) throw new Error('Gagal')
        const json = await res.json()
        setMhsList(json)
      } catch {
        // silent — toast error too noisy
      }
    })()
  }, [])

  useEffect(() => {
    // Generate QR code as data URL
    QRCode.toDataURL(dummyPayload, { width: 256, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [dummyPayload])

  const fetchRecent = useCallback(async () => {
    setLoadingRecent(true)
    try {
      // get last 10 created (no filter)
      const res = await fetch('/api/absensi?search=')
      if (!res.ok) throw new Error('Gagal')
      const json: Absensi[] = await res.json()
      // Sort by createdAt desc and take 10
      const sorted = [...json].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)
      setRecentScans(sorted)
    } catch {
      // silent
    } finally {
      setLoadingRecent(false)
    }
  }, [])

  useEffect(() => { fetchRecent() }, [fetchRecent])

  // Resolve NIM scan input → mahasiswaId
  const resolvedMhsId = useMemo(() => {
    const trimmed = scanInput.trim()
    if (!trimmed) return selectedMhsId
    // If matches an id directly
    const byId = mhsList.find((m) => m.id === trimmed)
    if (byId) return byId.id
    // By NIM
    const byNim = mhsList.find((m) => m.nim.toLowerCase() === trimmed.toLowerCase())
    if (byNim) return byNim.id
    return selectedMhsId
  }, [scanInput, selectedMhsId, mhsList])

  const resolvedMhs = useMemo(() => mhsList.find((m) => m.id === resolvedMhsId) || null, [mhsList, resolvedMhsId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvedMhsId) {
      toast.error('Pilih mahasiswa atau masukkan NIM hasil scan')
      return
    }
    if (!kelompokId) {
      toast.error('Pilih kelompok terlebih dahulu')
      return
    }
    // Foto selfie wajib untuk status HADIR sebagai bukti kehadiran
    if (status === 'HADIR' && !fotoSelfie) {
      toast.error('Foto selfie wajib diambil untuk status Hadir')
      return
    }
    setSaving(true)
    try {
      const today = todayStr()
      const res = await fetch('/api/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mahasiswaId: resolvedMhsId,
          kelompokId,
          tanggal: today,
          status,
          keterangan: keterangan || undefined,
          fotoSelfie: fotoSelfie || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan')
      toast.success(`Absensi ${resolvedMhs?.nama ?? ''} (${status}) berhasil dicatat`)
      setScanInput('')
      setKeterangan('')
      setSelectedMhsId('')
      setStatus('HADIR')
      setFotoSelfie('')
      fetchRecent()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan absensi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* LEFT: QR preview + form */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-2 text-xs bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg p-3">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                <strong>Absensi dengan Foto Selfie.</strong> Pilih mahasiswa (atau ketik NIM), kelompok, dan status kehadiran.
                Untuk status <strong>Hadir</strong>, ambil foto selfie sebagai bukti kehadiran menggunakan kamera perangkat.
                Foto disimpan otomatis bersama data absensi.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 items-start">
              {/* Selfie capture (replaces demo QR display) */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Foto Selfie {status === 'HADIR' && <span className="text-rose-500">*</span>}
                  {status !== 'HADIR' && <span className="text-muted-foreground">(opsional)</span>}
                </Label>
                <SelfieCapture value={fotoSelfie} onChange={setFotoSelfie} />
                {qrDataUrl && status !== 'HADIR' && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    QR ref: <span className="font-mono">{resolvedMhs?.nim ?? 'SCAN-DEMO'}</span>
                  </p>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scan" className="text-xs">Hasil Scan / NIM</Label>
                  <Input
                    id="scan"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Scan QR atau ketik NIM..."
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Atau Pilih Mahasiswa</Label>
                  <Select value={selectedMhsId} onValueChange={(v) => { setSelectedMhsId(v); setScanInput('') }}>
                    <SelectTrigger><SelectValue placeholder="Pilih mahasiswa" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {mhsList.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nim} - {m.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {resolvedMhs && (
                  <div className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md p-2">
                    Ditemukan: <strong>{resolvedMhs.nim}</strong> - {resolvedMhs.nama}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Kelompok <span className="text-rose-500">*</span></Label>
                  <Select value={kelompokId} onValueChange={setKelompokId} disabled={kelompokLoading}>
                    <SelectTrigger><SelectValue placeholder="Pilih kelompok" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {kelompokList.map((k) => (
                        <SelectItem key={k.id} value={k.id}>{k.nama} ({k.tipe})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ket" className="text-xs">Keterangan</Label>
                  <Input id="ket" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Keterangan (opsional)" />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <QrCode className="w-4 h-4 mr-1" />}
                  Catat Kehadiran
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: recent scans */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" /> Scan Terbaru
              </h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchRecent} disabled={loadingRecent}>
                {loadingRecent ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
              </Button>
            </div>
            {loadingRecent ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}
              </div>
            ) : recentScans.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Belum ada scan terbaru
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {recentScans.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                    {s.fotoSelfie ? (
                      <img
                        src={s.fotoSelfie}
                        alt={`Selfie ${s.mahasiswa?.nama ?? ''}`}
                        title="Klik untuk perbesar"
                        onClick={() => setPreviewPhoto(s.fotoSelfie as string)}
                        className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-primary/40 cursor-pointer hover:border-primary transition-colors"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground text-xs font-semibold">
                        {s.mahasiswa?.nama?.charAt(0) ?? '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.mahasiswa?.nama ?? '-'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.mahasiswa?.nim ?? ''} · {formatDateShort(s.tanggal)} · {formatTime(s.jamMasuk)}
                      </p>
                    </div>
                    {statusBadge(s.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full-size photo preview dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={(o) => !o && setPreviewPhoto('')}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Foto Selfie Absensi</DialogTitle>
            <DialogDescription>Bukti foto kehadiran mahasiswa</DialogDescription>
          </DialogHeader>
          {previewPhoto && (
            <img src={previewPhoto} alt="Foto Selfie" className="w-full rounded-lg border border-border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ Selfie Capture Component ============
// Uses getUserMedia to access the camera, captures a frame to canvas,
// and returns a JPEG data URL (base64) — stored in Absensi.fotoSelfie.
// Requires HTTPS or localhost (browser security requirement for camera access).
function SelfieCapture({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setActive(true)
    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setError('Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, lalu coba lagi.')
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        setError('Kamera tidak ditemukan pada perangkat ini.')
      } else if (e?.name === 'NotReadableError') {
        setError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.')
      } else {
        setError(e?.message || 'Gagal mengakses kamera')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    // Square crop centered on the face (selfie style)
    const size = Math.min(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror horizontally to match the live preview orientation
    ctx.translate(size, 0)
    ctx.scale(-1, 1)
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)
    // JPEG 0.7 quality keeps the base64 payload ~20-40KB (reasonable for DB storage)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    onChange(dataUrl)
    stopCamera()
  }, [onChange, stopCamera])

  // Release camera stream when component unmounts
  useEffect(() => () => stopCamera(), [stopCamera])

  // ----- State: photo already captured -----
  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted/40">
          <img src={value} alt="Foto Selfie" className="w-full aspect-square object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 h-7"
            onClick={() => onChange('')}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
          </Button>
        </div>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Foto selfie siap disimpan
        </p>
      </div>
    )
  }

  // ----- State: camera active (live preview) -----
  if (active) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl overflow-hidden border border-border bg-black aspect-square">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Face guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-40 border-2 border-white/70 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded-full">
            Posisikan wajah di dalam lingkaran
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={capturePhoto} className="flex-1">
            <Camera className="w-4 h-4 mr-1" /> Ambil Foto
          </Button>
          <Button type="button" variant="outline" onClick={stopCamera}>
            Batal
          </Button>
        </div>
      </div>
    )
  }

  // ----- State: idle (camera not started) -----
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startCamera}
        disabled={loading}
        className="w-full aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-accent/40 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-8 h-8 animate-spin" />
        ) : (
          <>
            <Camera className="w-10 h-10" />
            <span className="text-sm font-medium">Buka Kamera</span>
            <span className="text-xs text-center px-4">Ambil foto selfie sebagai bukti kehadiran</span>
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
