'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  GraduationCap, Plus, FileSpreadsheet, FileText, Pencil, Trash2, Loader2,
  UserCheck, Building2, Layers,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
interface Prodi {
  id: string
  kode: string
  nama: string
  jenjang: string
}
interface Fakultas {
  id: string
  kode: string
  nama: string
  dekan: string | null
  prodi: Prodi[]
}

interface Dosen {
  id: string
  nidn: string
  nama: string
  email: string
  noHp: string
  fakultasId: string
  fakultas: Fakultas
  prodiId: string | null
  prodi: Prodi | null
  jabatan: string
  keahlian: string | null
  foto: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface FormState {
  nidn: string
  nama: string
  email: string
  noHp: string
  fakultasId: string
  prodiId: string
  jabatan: string
  keahlian: string
  status: string
  foto: string
}

const EMPTY_FORM: FormState = {
  nidn: '', nama: '', email: '', noHp: '', fakultasId: '', prodiId: '',
  jabatan: '', keahlian: '', status: 'AKTIF', foto: '',
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DosenView() {
  const [data, setData] = useState<Dosen[]>([])
  const [fakultasList, setFakultasList] = useState<Fakultas[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [deleteTarget, setDeleteTarget] = useState<Dosen | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const res = await fetch('/api/dosen')
      if (!res.ok) throw new Error('Gagal memuat data')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data dosen')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  const fetchFakultas = useCallback(async () => {
    try {
      const res = await fetch('/api/fakultas')
      if (!res.ok) return
      const json = await res.json()
      setFakultasList(json)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchFakultas()
  }, [fetchData, fetchFakultas])

  // Prodi options filtered by selected fakultas
  const prodiOptions = useMemo(() => {
    if (!form.fakultasId) return []
    const f = fakultasList.find((x) => x.id === form.fakultasId)
    return f?.prodi ?? []
  }, [form.fakultasId, fakultasList])

  // ============ Stats ============
  const stats = useMemo(() => {
    const total = data.length
    const aktif = data.filter((d) => d.status === 'AKTIF').length

    // Count per fakultas
    const perFakultas = new Map<string, number>()
    for (const d of data) {
      const key = d.fakultas?.nama ?? 'Lainnya'
      perFakultas.set(key, (perFakultas.get(key) ?? 0) + 1)
    }
    let topFakultas = '-'
    let topFakultasCount = 0
    for (const [k, v] of perFakultas.entries()) {
      if (v > topFakultasCount) {
        topFakultas = k
        topFakultasCount = v
      }
    }

    // Average dosen per prodi (only those with prodiId)
    const perProdi = new Map<string, number>()
    let withProdi = 0
    for (const d of data) {
      if (d.prodiId) {
        perProdi.set(d.prodiId, (perProdi.get(d.prodiId) ?? 0) + 1)
        withProdi++
      }
    }
    const prodiCount = perProdi.size
    const avgPerProdi = prodiCount > 0 ? (withProdi / prodiCount) : 0

    return {
      total,
      aktif,
      topFakultas,
      topFakultasCount,
      prodiCount,
      avgPerProdi: avgPerProdi.toFixed(1),
    }
  }, [data])

  // ============ Form handlers ============
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setDialogOpen(true)
  }

  const openEdit = (d: Dosen) => {
    setForm({
      nidn: d.nidn,
      nama: d.nama,
      email: d.email,
      noHp: d.noHp,
      fakultasId: d.fakultasId,
      prodiId: d.prodiId ?? '',
      jabatan: d.jabatan,
      keahlian: d.keahlian ?? '',
      status: d.status,
      foto: d.foto ?? '',
    })
    setEditId(d.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nidn.trim() || !form.nama.trim() || !form.email.trim() || !form.fakultasId || !form.jabatan.trim()) {
      toast.error('Lengkapi field wajib (NIDN, Nama, Email, Fakultas, Jabatan)')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        prodiId: form.prodiId || null,
        keahlian: form.keahlian.trim() || null,
        foto: form.foto.trim() || null,
      }
      const url = editId ? `/api/dosen/${editId}` : '/api/dosen'
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
      toast.success(editId ? 'Data dosen diperbarui' : 'Dosen berhasil ditambahkan')
      setDialogOpen(false)
      fetchData({ silent: true })
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
      const res = await fetch(`/api/dosen/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus')
      toast.success(`Dosen ${deleteTarget.nama} berhasil dihapus`)
      setDeleteTarget(null)
      fetchData({ silent: true })
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
    const headers = ['NIDN', 'Nama', 'Email', 'No HP', 'Fakultas', 'Prodi', 'Jabatan', 'Keahlian', 'Status']
    const rows = data.map((d) => [
      d.nidn, d.nama, d.email, d.noHp,
      d.fakultas?.nama ?? '-', d.prodi?.nama ?? '-',
      d.jabatan, d.keahlian ?? '-', d.status,
    ])
    exportToCSV('data-dosen', headers, rows)
  }

  const handleExportPDF = () => {
    if (!data.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }
    const headers = ['NIDN', 'Nama', 'Email', 'No HP', 'Fakultas', 'Prodi', 'Jabatan', 'Keahlian', 'Status']
    const rows = data.map((d) => [
      d.nidn, d.nama, d.email, d.noHp,
      d.fakultas?.nama ?? '-', d.prodi?.nama ?? '-',
      d.jabatan, d.keahlian ?? '-', d.status,
    ])
    exportToPDF('Data Dosen', generateTableHTML('Data Dosen Pendamping', headers, rows))
  }

  // ============ Columns ============
  const columns: Column<Dosen>[] = useMemo(() => [
    {
      key: 'aksi', header: 'Aksi', sortable: false, className: 'text-left',
      render: (d) => (
        <div className="flex items-center justify-start gap-1">
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
      key: 'nidn', header: 'NIDN', sortable: true, className: 'font-mono text-xs',
    },
    {
      key: 'nama', header: 'Nama Dosen', sortable: true,
      render: (d) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="w-9 h-9 border">
            {d.foto ? <AvatarImage src={d.foto} alt={d.nama} /> : null}
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {getInitials(d.nama)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium truncate">{d.nama}</p>
            <p className="text-xs text-muted-foreground truncate">{d.jabatan}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email', header: 'Email', sortable: true,
      render: (d) => <span className="text-sm text-muted-foreground">{d.email}</span>,
    },
    {
      key: 'noHp', header: 'No HP',
      render: (d) => <span className="text-sm">{d.noHp || '-'}</span>,
    },
    {
      key: 'fakultas', header: 'Fakultas', sortable: true, sortValue: (d) => d.fakultas?.nama ?? '',
      render: (d) => (
        <Badge variant="outline" className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800">
          {d.fakultas?.nama ?? '-'}
        </Badge>
      ),
    },
    {
      key: 'prodi', header: 'Prodi', sortable: true, sortValue: (d) => d.prodi?.nama ?? '',
      render: (d) => (
        <span className="text-sm">{d.prodi?.nama ?? <span className="text-muted-foreground italic">—</span>}</span>
      ),
    },
    {
      key: 'jabatan', header: 'Jabatan', sortable: true,
      render: (d) => <span className="text-sm">{d.jabatan}</span>,
    },
    {
      key: 'keahlian', header: 'Keahlian',
      render: (d) => (
        d.keahlian ? (
          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[180px]">{d.keahlian}</span>
        ) : <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: 'status', header: 'Status', sortable: true,
      render: (d) => (
        <Badge variant="outline" className={d.status === 'AKTIF'
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}>
          {d.status}
        </Badge>
      ),
    },
  ], [])

  // ============ Stat cards ============
  const statCards = [
    { label: 'Total Dosen', value: stats.total, icon: GraduationCap, color: 'from-emerald-500 to-emerald-600', sub: 'seluruh data' },
    { label: 'Dosen Aktif', value: stats.aktif, icon: UserCheck, color: 'from-teal-500 to-teal-600', sub: 'status aktif' },
    { label: 'Fakultas Terbanyak', value: stats.topFakultasCount, icon: Building2, color: 'from-violet-500 to-violet-600', sub: stats.topFakultas },
    { label: 'Rata-rata / Prodi', value: stats.avgPerProdi, icon: Layers, color: 'from-amber-500 to-orange-600', sub: `${stats.prodiCount} prodi` },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Dosen Pendamping"
        description="Kelola data dosen pembimbing lapangan KKN & PLP"
        icon={GraduationCap}
        breadcrumb={['Data Master', 'Data Dosen']}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="w-4 h-4" /> Export PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Tambah Dosen
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
                      <p className="text-2xl font-bold mt-1 truncate">{c.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.sub}</p>
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
          searchKeys={['nidn', 'nama', 'email']}
          pageSize={10}
          emptyMessage="Belum ada data dosen. Klik 'Tambah Dosen' untuk menambahkan."
          getRowId={(d) => d.id}
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditId(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Dosen' : 'Tambah Dosen'}</DialogTitle>
            <DialogDescription>
              {editId ? 'Perbarui informasi dosen.' : 'Lengkapi data dosen baru.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nidn">NIDN <span className="text-rose-500">*</span></Label>
                <Input id="nidn" value={form.nidn} onChange={(e) => setForm({ ...form, nidn: e.target.value })} placeholder="0021234567" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nama">Nama Lengkap <span className="text-rose-500">*</span></Label>
                <Input id="nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Dr. Nama Dosen, M.Kom" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-rose-500">*</span></Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="dosen@kknplp.ac.id" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="noHp">No. HP</Label>
                <Input id="noHp" value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} placeholder="0812..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fakultasId">Fakultas <span className="text-rose-500">*</span></Label>
                <Select
                  value={form.fakultasId}
                  onValueChange={(v) => setForm({ ...form, fakultasId: v, prodiId: '' })}
                >
                  <SelectTrigger id="fakultasId" className="w-full"><SelectValue placeholder="Pilih fakultas..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {fakultasList.length === 0 ? (
                      <SelectItem value="_" disabled>Memuat fakultas...</SelectItem>
                    ) : (
                      fakultasList.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nama}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodiId">Program Studi (opsional)</Label>
                <Select
                  value={form.prodiId}
                  onValueChange={(v) => setForm({ ...form, prodiId: v })}
                  disabled={!form.fakultasId}
                >
                  <SelectTrigger id="prodiId" className="w-full"><SelectValue placeholder="Pilih prodi..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {prodiOptions.length === 0 ? (
                      <SelectItem value="_" disabled>Tidak ada prodi</SelectItem>
                    ) : (
                      prodiOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jabatan">Jabatan <span className="text-rose-500">*</span></Label>
                <Input id="jabatan" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} placeholder="Lektor, Asisten Ahli, dll" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AKTIF">AKTIF</SelectItem>
                    <SelectItem value="NONAKTIF">NONAKTIF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="keahlian">Bidang Keahlian</Label>
                <Textarea id="keahlian" value={form.keahlian} onChange={(e) => setForm({ ...form, keahlian: e.target.value })} placeholder="Pemrograman Web, Basis Data, Machine Learning..." rows={2} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="foto">URL Foto (opsional)</Label>
                <Input id="foto" value={form.foto} onChange={(e) => setForm({ ...form, foto: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editId ? 'Simpan Perubahan' : 'Tambah Dosen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Dosen</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.nama}</strong> ({deleteTarget?.nidn})?
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
