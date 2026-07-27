'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  School, Plus, FileSpreadsheet, FileText, Pencil, Trash2, Loader2,
  Users, Layers, Building2, GraduationCap, ExternalLink, Filter,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, generateTableHTML,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
interface Sekolah {
  id: string
  nama: string
  jenjang: string // SD, SMP, SMA, SMK
  alamat: string
  kecamatan: string
  kabupaten: string
  provinsi: string
  kepalaSekolah: string
  noHp: string
  email: string | null
  latitude: number | null
  longitude: number | null
  kuota: number
  createdAt: string
  updatedAt: string
  _count?: { kelompok: number }
}

interface FormState {
  nama: string
  jenjang: string
  alamat: string
  kecamatan: string
  kabupaten: string
  provinsi: string
  kepalaSekolah: string
  noHp: string
  email: string
  latitude: string
  longitude: string
  kuota: string
}

const EMPTY_FORM: FormState = {
  nama: '', jenjang: 'SD', alamat: '', kecamatan: '', kabupaten: '', provinsi: '',
  kepalaSekolah: '', noHp: '', email: '', latitude: '', longitude: '', kuota: '0',
}

const JENJANG_STYLES: Record<string, string> = {
  SD: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  SMP: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  SMA: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  SMK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
}

export function SekolahView() {
  const [data, setData] = useState<Sekolah[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [deleteTarget, setDeleteTarget] = useState<Sekolah | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [jenjangFilter, setJenjangFilter] = useState<string>('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sekolah')
      if (!res.ok) throw new Error('Gagal memuat data')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data sekolah')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ============ Filtered by jenjang ============
  const filteredData = useMemo(() => {
    if (jenjangFilter === 'ALL') return data
    return data.filter((s) => s.jenjang === jenjangFilter)
  }, [data, jenjangFilter])

  // ============ Stats ============
  const stats = useMemo(() => {
    const total = data.length
    const totalKuota = data.reduce((sum, s) => sum + (s.kuota || 0), 0)
    const totalKelompok = data.reduce((sum, s) => sum + (s._count?.kelompok ?? 0), 0)
    const perJenjang = {
      SD: data.filter((s) => s.jenjang === 'SD').length,
      SMP: data.filter((s) => s.jenjang === 'SMP').length,
      SMA: data.filter((s) => s.jenjang === 'SMA').length,
      SMK: data.filter((s) => s.jenjang === 'SMK').length,
    }
    return { total, totalKuota, totalKelompok, perJenjang }
  }, [data])

  // ============ Form handlers ============
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setDialogOpen(true)
  }

  const openEdit = (s: Sekolah) => {
    setForm({
      nama: s.nama,
      jenjang: s.jenjang,
      alamat: s.alamat,
      kecamatan: s.kecamatan,
      kabupaten: s.kabupaten,
      provinsi: s.provinsi,
      kepalaSekolah: s.kepalaSekolah,
      noHp: s.noHp,
      email: s.email ?? '',
      latitude: s.latitude != null ? String(s.latitude) : '',
      longitude: s.longitude != null ? String(s.longitude) : '',
      kuota: String(s.kuota ?? 0),
    })
    setEditId(s.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nama.trim() || !form.jenjang || !form.alamat.trim() || !form.kecamatan.trim() ||
        !form.kabupaten.trim() || !form.provinsi.trim() || !form.kepalaSekolah.trim() || !form.noHp.trim()) {
      toast.error('Lengkapi semua field wajib')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        latitude: form.latitude === '' ? null : form.latitude,
        longitude: form.longitude === '' ? null : form.longitude,
      }
      const url = editId ? `/api/sekolah/${editId}` : '/api/sekolah'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal menyimpan')
      }
      toast.success(editId ? 'Data sekolah diperbarui' : 'Sekolah berhasil ditambahkan')
      setDialogOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan data')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/sekolah/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus')
      toast.success(`Sekolah ${deleteTarget.nama} berhasil dihapus`)
      setDeleteTarget(null)
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus data')
    } finally {
      setDeleting(false)
    }
  }

  // ============ Export ============
  const handleExportCSV = () => {
    if (!filteredData.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }
    const headers = ['Nama', 'Jenjang', 'Alamat', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Kepala Sekolah', 'No HP', 'Email', 'Latitude', 'Longitude', 'Kuota']
    const rows = filteredData.map((s) => [
      s.nama, s.jenjang, s.alamat, s.kecamatan, s.kabupaten, s.provinsi,
      s.kepalaSekolah, s.noHp, s.email ?? '-', s.latitude ?? '-', s.longitude ?? '-',
      s.kuota,
    ])
    exportToCSV('data-sekolah-plp', headers, rows)
  }

  const handleExportPDF = () => {
    if (!filteredData.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }
    const headers = ['Nama', 'Jenjang', 'Kecamatan', 'Kabupaten', 'Kepala Sekolah', 'No HP', 'Kuota']
    const rows = filteredData.map((s) => [
      s.nama, s.jenjang, s.kecamatan, s.kabupaten, s.kepalaSekolah, s.noHp, s.kuota,
    ])
    exportToPDF('Data Sekolah PLP', generateTableHTML('Data Sekolah PLP', headers, rows))
  }

  // ============ Columns ============
  const columns: Column<Sekolah>[] = useMemo(() => [
    {
      key: 'aksi', header: 'Aksi', sortable: false, className: 'text-left',
      render: (s) => (
        <div className="flex items-center justify-start gap-1">
          {s.latitude != null && s.longitude != null && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/20"
              onClick={() => window.open(`https://www.google.com/maps?q=${s.latitude},${s.longitude}`, '_blank', 'noopener,noreferrer')}
              title="Lihat di Google Maps"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => setDeleteTarget(s)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    {
      key: 'nama', header: 'Nama Sekolah', sortable: true,
      render: (s) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 flex items-center justify-center shrink-0">
            <School className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{s.nama}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[220px]">{s.alamat}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'jenjang', header: 'Jenjang', sortable: true, className: 'text-center',
      render: (s) => (
        <Badge variant="outline" className={JENJANG_STYLES[s.jenjang] ?? ''}>
          {s.jenjang}
        </Badge>
      ),
    },
    {
      key: 'kecamatan', header: 'Kecamatan', sortable: true,
      render: (s) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{s.kecamatan}</p>
          <p className="text-xs text-muted-foreground truncate">{s.kabupaten}, {s.provinsi}</p>
        </div>
      ),
    },
    {
      key: 'kepalaSekolah', header: 'Kepala Sekolah', sortable: true,
      render: (s) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{s.kepalaSekolah}</p>
          <p className="text-xs text-muted-foreground truncate font-mono">{s.noHp}</p>
        </div>
      ),
    },
    {
      key: 'email', header: 'Email', sortable: true,
      render: (s) => s.email ? (
        <span className="text-xs text-muted-foreground truncate block max-w-[160px]">{s.email}</span>
      ) : <span className="text-muted-foreground text-xs">-</span>,
    },
    {
      key: 'kuota', header: 'Kuota', sortable: true, className: 'text-center',
      render: (s) => (
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-semibold">
          {s.kuota}
        </span>
      ),
    },
    {
      key: 'kelompok', header: 'Kelompok', sortable: true, sortValue: (s) => s._count?.kelompok ?? 0, className: 'text-center',
      render: (s) => {
        const count = s._count?.kelompok ?? 0
        return (
          <Badge variant="outline" className={count > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-muted text-muted-foreground'}>
            {count} kelompok
          </Badge>
        )
      },
    },
  ], [])

  // ============ Stat cards ============
  const statCards = [
    { label: 'Total Sekolah', value: stats.total, icon: School, color: 'from-violet-500 to-purple-600', sub: 'lokasi PLP' },
    { label: 'Total Kuota', value: stats.totalKuota, icon: Users, color: 'from-amber-500 to-orange-500', sub: 'kapasitas mahasiswa' },
    { label: 'Kelompok Terpasang', value: stats.totalKelompok, icon: Layers, color: 'from-emerald-500 to-teal-600', sub: 'kelompok PLP' },
    { label: 'SD / SMP', value: `${stats.perJenjang.SD} / ${stats.perJenjang.SMP}`, icon: GraduationCap, color: 'from-sky-500 to-cyan-600', sub: 'jenjang dasar & menengah' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Sekolah PLP"
        description="Kelola lokasi sekolah untuk penempatan PLP"
        icon={School}
        breadcrumb={['Data Master', 'Sekolah PLP']}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="w-4 h-4" /> Export PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Tambah Sekolah
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
                      <p className="text-2xl font-bold mt-1">{c.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white shrink-0`}>
                      <c.icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Jenjang distribution mini-bar */}
      {!loading && data.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
                <Building2 className="w-4 h-4" /> Distribusi Jenjang
              </div>
              <div className="flex flex-wrap gap-2">
                {(['SD', 'SMP', 'SMA', 'SMK'] as const).map((j) => (
                  <button
                    key={j}
                    onClick={() => setJenjangFilter(jenjangFilter === j ? 'ALL' : j)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${jenjangFilter === j ? JENJANG_STYLES[j] : 'bg-background border-border hover:bg-accent'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${jenjangFilter === j ? 'bg-current' : 'bg-muted-foreground/40'}`} />
                    {j} <span className="font-bold">{stats.perJenjang[j]}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter + Data table */}
      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter Jenjang:</span>
            </div>
            <Select value={jenjangFilter} onValueChange={setJenjangFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder="Semua Jenjang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Jenjang ({stats.total})</SelectItem>
                <SelectItem value="SD">SD ({stats.perJenjang.SD})</SelectItem>
                <SelectItem value="SMP">SMP ({stats.perJenjang.SMP})</SelectItem>
                <SelectItem value="SMA">SMA ({stats.perJenjang.SMA})</SelectItem>
                <SelectItem value="SMK">SMK ({stats.perJenjang.SMK})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            data={filteredData}
            columns={columns}
            searchable
            searchKeys={['nama', 'kecamatan', 'kabupaten', 'provinsi', 'kepalaSekolah', 'jenjang']}
            pageSize={10}
            emptyMessage="Belum ada data sekolah. Klik 'Tambah Sekolah' untuk menambahkan."
            getRowId={(s) => s.id}
          />
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditId(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              {editId ? 'Edit Sekolah' : 'Tambah Sekolah'}
            </DialogTitle>
            <DialogDescription>
              {editId ? 'Perbarui informasi sekolah lokasi PLP.' : 'Lengkapi data sekolah lokasi penempatan PLP.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nama">Nama Sekolah <span className="text-rose-500">*</span></Label>
                <Input id="nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="SDN Sukamaju 01" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jenjang">Jenjang <span className="text-rose-500">*</span></Label>
                <Select value={form.jenjang} onValueChange={(v) => setForm({ ...form, jenjang: v })}>
                  <SelectTrigger id="jenjang" className="w-full"><SelectValue placeholder="Pilih jenjang..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SD">SD (Sekolah Dasar)</SelectItem>
                    <SelectItem value="SMP">SMP (Sekolah Menengah Pertama)</SelectItem>
                    <SelectItem value="SMA">SMA (Sekolah Menengah Atas)</SelectItem>
                    <SelectItem value="SMK">SMK (Sekolah Menengah Kejuruan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kuota">Kuota Mahasiswa</Label>
                <Input id="kuota" type="number" min={0} value={form.kuota} onChange={(e) => setForm({ ...form, kuota: e.target.value })} placeholder="15" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="alamat">Alamat Lengkap <span className="text-rose-500">*</span></Label>
                <Textarea id="alamat" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} placeholder="Jl. Pendidikan No. 1, Kel. Sukamaju" rows={2} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kecamatan">Kecamatan <span className="text-rose-500">*</span></Label>
                <Input id="kecamatan" value={form.kecamatan} onChange={(e) => setForm({ ...form, kecamatan: e.target.value })} placeholder="Cibadak" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kabupaten">Kabupaten <span className="text-rose-500">*</span></Label>
                <Input id="kabupaten" value={form.kabupaten} onChange={(e) => setForm({ ...form, kabupaten: e.target.value })} placeholder="Sukabumi" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provinsi">Provinsi <span className="text-rose-500">*</span></Label>
                <Input id="provinsi" value={form.provinsi} onChange={(e) => setForm({ ...form, provinsi: e.target.value })} placeholder="Jawa Barat" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kepalaSekolah">Kepala Sekolah <span className="text-rose-500">*</span></Label>
                <Input id="kepalaSekolah" value={form.kepalaSekolah} onChange={(e) => setForm({ ...form, kepalaSekolah: e.target.value })} placeholder="Drs. Budi Santoso, M.Pd." required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="noHp">No. HP <span className="text-rose-500">*</span></Label>
                <Input id="noHp" value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} placeholder="0812..." required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="sekolah@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-6.9278" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="107.6109" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editId ? 'Simpan Perubahan' : 'Tambah Sekolah'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Sekolah</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus sekolah <strong>{deleteTarget?.nama}</strong> ({deleteTarget?.jenjang})?
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
