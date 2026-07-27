'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  MapPin, Plus, FileSpreadsheet, FileText, Pencil, Trash2, Loader2,
  Users, Layers, Building2, MapPinned, ExternalLink,
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

// ============ Types ============
interface Desa {
  id: string
  nama: string
  kecamatan: string
  kabupaten: string
  provinsi: string
  kodePos: string | null
  latitude: number | null
  longitude: number | null
  kuota: number
  keterangan: string | null
  foto: string | null
  createdAt: string
  updatedAt: string
  _count?: { kelompok: number }
}

interface FormState {
  nama: string
  kecamatan: string
  kabupaten: string
  provinsi: string
  kodePos: string
  latitude: string
  longitude: string
  kuota: string
  keterangan: string
}

const EMPTY_FORM: FormState = {
  nama: '', kecamatan: '', kabupaten: '', provinsi: '',
  kodePos: '', latitude: '', longitude: '', kuota: '0', keterangan: '',
}

export function DesaView() {
  const [data, setData] = useState<Desa[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [deleteTarget, setDeleteTarget] = useState<Desa | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/desa')
      if (!res.ok) throw new Error('Gagal memuat data')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data desa')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ============ Stats ============
  const stats = useMemo(() => {
    const total = data.length
    const totalKuota = data.reduce((sum, d) => sum + (d.kuota || 0), 0)
    const totalKelompok = data.reduce((sum, d) => sum + (d._count?.kelompok ?? 0), 0)
    const kabupatenUnik = new Set(data.map((d) => d.kabupaten)).size
    return { total, totalKuota, totalKelompok, kabupatenUnik }
  }, [data])

  // ============ Form handlers ============
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setDialogOpen(true)
  }

  const openEdit = (d: Desa) => {
    setForm({
      nama: d.nama,
      kecamatan: d.kecamatan,
      kabupaten: d.kabupaten,
      provinsi: d.provinsi,
      kodePos: d.kodePos ?? '',
      latitude: d.latitude != null ? String(d.latitude) : '',
      longitude: d.longitude != null ? String(d.longitude) : '',
      kuota: String(d.kuota ?? 0),
      keterangan: d.keterangan ?? '',
    })
    setEditId(d.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nama.trim() || !form.kecamatan.trim() || !form.kabupaten.trim() || !form.provinsi.trim()) {
      toast.error('Lengkapi field wajib (Nama, Kecamatan, Kabupaten, Provinsi)')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        latitude: form.latitude === '' ? null : form.latitude,
        longitude: form.longitude === '' ? null : form.longitude,
      }
      const url = editId ? `/api/desa/${editId}` : '/api/desa'
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
      toast.success(editId ? 'Data desa diperbarui' : 'Desa berhasil ditambahkan')
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
      const res = await fetch(`/api/desa/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus')
      toast.success(`Desa ${deleteTarget.nama} berhasil dihapus`)
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
    if (!data.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }
    const headers = ['Nama', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Kode Pos', 'Latitude', 'Longitude', 'Kuota', 'Keterangan']
    const rows = data.map((d) => [
      d.nama, d.kecamatan, d.kabupaten, d.provinsi,
      d.kodePos ?? '-', d.latitude ?? '-', d.longitude ?? '-',
      d.kuota, d.keterangan ?? '-',
    ])
    exportToCSV('data-desa-kkn', headers, rows)
  }

  const handleExportPDF = () => {
    if (!data.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }
    const headers = ['Nama', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Kode Pos', 'Lat', 'Lng', 'Kuota', 'Keterangan']
    const rows = data.map((d) => [
      d.nama, d.kecamatan, d.kabupaten, d.provinsi,
      d.kodePos ?? '-', d.latitude ?? '-', d.longitude ?? '-',
      d.kuota, d.keterangan ?? '-',
    ])
    exportToPDF('Data Desa KKN', generateTableHTML('Data Desa KKN', headers, rows))
  }

  // ============ Columns ============
  const columns: Column<Desa>[] = useMemo(() => [
    {
      key: 'aksi', header: 'Aksi', sortable: false, className: 'text-left',
      render: (d) => (
        <div className="flex items-center justify-start gap-1">
          {d.latitude != null && d.longitude != null && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/20"
              onClick={() => window.open(`https://www.google.com/maps?q=${d.latitude},${d.longitude}`, '_blank', 'noopener,noreferrer')}
              title="Lihat di Google Maps"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => setDeleteTarget(d)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    {
      key: 'nama', header: 'Nama Desa', sortable: true,
      render: (d) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{d.nama}</p>
            {d.keterangan ? (
              <p className="text-xs text-muted-foreground truncate max-w-[220px]">{d.keterangan}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'lokasi', header: 'Lokasi', sortable: true, sortValue: (d) => d.kabupaten,
      render: (d) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{d.kecamatan}, {d.kabupaten}</p>
          <p className="text-xs text-muted-foreground truncate">{d.provinsi}</p>
        </div>
      ),
    },
    {
      key: 'kodePos', header: 'Kode Pos', sortable: true, className: 'text-center',
      render: (d) => d.kodePos ? (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-muted text-xs font-mono">{d.kodePos}</span>
      ) : <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'koordinat', header: 'Koordinat', sortable: false,
      render: (d) => (
        d.latitude != null && d.longitude != null ? (
          <div className="text-xs font-mono text-muted-foreground leading-tight">
            <div>Lat: {d.latitude.toFixed(5)}</div>
            <div>Lng: {d.longitude.toFixed(5)}</div>
          </div>
        ) : <span className="text-muted-foreground text-xs">Belum diatur</span>
      ),
    },
    {
      key: 'kuota', header: 'Kuota', sortable: true, className: 'text-center',
      render: (d) => (
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-semibold">
          {d.kuota}
        </span>
      ),
    },
    {
      key: 'kelompok', header: 'Kelompok', sortable: true, sortValue: (d) => d._count?.kelompok ?? 0, className: 'text-center',
      render: (d) => {
        const count = d._count?.kelompok ?? 0
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
    { label: 'Total Desa', value: stats.total, icon: MapPin, color: 'from-emerald-500 to-emerald-600', sub: 'lokasi KKN' },
    { label: 'Total Kuota', value: stats.totalKuota, icon: Users, color: 'from-amber-500 to-orange-500', sub: 'kapasitas mahasiswa' },
    { label: 'Kelompok Terpasang', value: stats.totalKelompok, icon: Layers, color: 'from-violet-500 to-purple-500', sub: 'kelompok KKN' },
    { label: 'Kabupaten Unik', value: stats.kabupatenUnik, icon: Building2, color: 'from-teal-500 to-cyan-600', sub: 'wilayah tersebar' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Desa KKN"
        description="Kelola lokasi penempatan KKN di berbagai desa"
        icon={MapPin}
        breadcrumb={['Data Master', 'Desa KKN']}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="w-4 h-4" /> Export PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Tambah Desa
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

      {/* Data table */}
      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <DataTable
          data={data}
          columns={columns}
          searchable
          searchKeys={['nama', 'kecamatan', 'kabupaten', 'provinsi']}
          pageSize={10}
          emptyMessage="Belum ada data desa. Klik 'Tambah Desa' untuk menambahkan."
          getRowId={(d) => d.id}
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditId(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPinned className="w-5 h-5 text-primary" />
              {editId ? 'Edit Desa' : 'Tambah Desa'}
            </DialogTitle>
            <DialogDescription>
              {editId ? 'Perbarui informasi lokasi desa KKN.' : 'Lengkapi data desa lokasi penempatan KKN.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nama">Nama Desa <span className="text-rose-500">*</span></Label>
                <Input id="nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Desa Sukamaju" required />
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
                <Label htmlFor="kodePos">Kode Pos</Label>
                <Input id="kodePos" value={form.kodePos} onChange={(e) => setForm({ ...form, kodePos: e.target.value })} placeholder="16710" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-6.9278" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="107.6109" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kuota">Kuota Mahasiswa</Label>
                <Input id="kuota" type="number" min={0} value={form.kuota} onChange={(e) => setForm({ ...form, kuota: e.target.value })} placeholder="20" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="keterangan">Keterangan</Label>
                <Textarea id="keterangan" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Karakteristik desa, akses jalan, potensi, dll." rows={3} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editId ? 'Simpan Perubahan' : 'Tambah Desa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Desa</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus desa <strong>{deleteTarget?.nama}</strong> ({deleteTarget?.kabupaten})?
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
