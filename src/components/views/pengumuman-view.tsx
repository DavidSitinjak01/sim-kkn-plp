'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Megaphone, Plus, Pencil, Trash2, Loader2, Eye, FileSpreadsheet, FileText as FilePdf,
  AlertTriangle, Info, Bell, CalendarClock,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, generateTableHTML, formatDate, formatDateShort,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
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
interface Pengumuman {
  id: string
  judul: string
  konten: string
  prioritas: string
  tanggal: string
  penulis: string | null
  createdAt: string
  updatedAt: string
}

interface FormState {
  judul: string
  konten: string
  prioritas: string
  penulis: string
}
const EMPTY_FORM: FormState = {
  judul: '', konten: '', prioritas: 'NORMAL', penulis: '',
}

const PRIORITAS_OPTIONS = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'INFO', label: 'Info' },
]

function prioritasBadge(p: string) {
  const map: Record<string, { cls: string; icon?: React.ReactNode; label: string }> = {
    URGENT: {
      cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      icon: <AlertTriangle className="w-3 h-3" />, label: 'Urgent',
    },
    NORMAL: {
      cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      icon: <Bell className="w-3 h-3" />, label: 'Normal',
    },
    INFO: {
      cls: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800',
      icon: <Info className="w-3 h-3" />, label: 'Info',
    },
  }
  const m = map[p] ?? { cls: 'bg-muted text-muted-foreground border-border', label: p }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${m.cls}`}>{m.icon}{m.label}</span>
}

// ============ Stat Card ============
function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>, label: string, value: number | string, color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold tracking-tight">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============ Main View ============
export function PengumumanView() {
  const [data, setData] = useState<Pengumuman[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPrioritas, setFilterPrioritas] = useState('ALL')

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [viewing, setViewing] = useState<Pengumuman | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Pengumuman | null>(null)
  const [editing, setEditing] = useState<Pengumuman | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const res = await fetch('/api/pengumuman')
      if (!res.ok) throw new Error('Gagal')
      const json: Pengumuman[] = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat pengumuman')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    if (filterPrioritas === 'ALL') return data
    return data.filter(p => p.prioritas === filterPrioritas)
  }, [data, filterPrioritas])

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    return {
      total: data.length,
      urgent: data.filter(p => p.prioritas === 'URGENT').length,
      bulanIni: data.filter(p => {
        const d = new Date(p.tanggal)
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear
      }).length,
    }
  }, [data])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (p: Pengumuman) => {
    setEditing(p)
    setForm({
      judul: p.judul, konten: p.konten, prioritas: p.prioritas, penulis: p.penulis ?? '',
    })
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form.judul.trim() || !form.konten.trim()) {
      toast.error('Judul dan konten wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/pengumuman/${editing.id}` : '/api/pengumuman'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: form.judul,
          konten: form.konten,
          prioritas: form.prioritas,
          penulis: form.penulis || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menyimpan')
      }
      toast.success(editing ? 'Pengumuman diperbarui' : 'Pengumuman dibuat')
      setFormOpen(false)
      fetchData({ silent: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/pengumuman/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal')
      toast.success('Pengumuman dihapus')
      setDeleteTarget(null)
      fetchData({ silent: true })
    } catch {
      toast.error('Gagal menghapus pengumuman')
    } finally {
      setDeleting(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['Judul', 'Prioritas', 'Tanggal', 'Penulis']
    const rows = filtered.map(p => [
      p.judul, p.prioritas, formatDateShort(p.tanggal), p.penulis ?? '-',
    ])
    exportToCSV('pengumuman', headers, rows)
  }

  const handleExportPDF = () => {
    const headers = ['Judul', 'Prioritas', 'Tanggal', 'Penulis']
    const rows = filtered.map(p => [
      p.judul, p.prioritas, formatDateShort(p.tanggal), p.penulis ?? '-',
    ])
    exportToPDF('Daftar Pengumuman', generateTableHTML('Daftar Pengumuman', headers, rows))
  }

  const columns: Column<Pengumuman>[] = [
    {
      key: 'aksi', header: 'Aksi', sortable: false, width: '140px',
      render: (p) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewing(p)} title="Lihat">
            <Eye className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-600" onClick={() => openEdit(p)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => setDeleteTarget(p)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    { key: 'judul', header: 'Judul', sortable: true, render: (p) => (
      <button onClick={() => setViewing(p)} className="text-left hover:underline">
        <span className="font-medium text-sm">{p.judul}</span>
      </button>
    ) },
    { key: 'prioritas', header: 'Prioritas', sortable: true, render: (p) => prioritasBadge(p.prioritas) },
    {
      key: 'tanggal', header: 'Tanggal', sortable: true, sortValue: (p) => new Date(p.tanggal).getTime(),
      render: (p) => <span className="text-xs text-muted-foreground">{formatDate(p.tanggal)}</span>,
    },
    { key: 'penulis', header: 'Penulis', sortable: true, render: (p) => (
      <span className="text-xs">{p.penulis ?? <span className="text-muted-foreground italic">Administrator</span>}</span>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Pengumuman"
        description="Pengumuman resmi dan informasi penting terkait KKN & PLP"
        icon={Megaphone}
        breadcrumb={['Informasi', 'Pengumuman']}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading}>
              <FilePdf className="w-4 h-4 mr-1.5" />PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />Tambah Pengumuman
            </Button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard icon={Megaphone} label="Total Pengumuman" value={stats.total} color="bg-primary/10 text-primary" />
        <StatCard icon={AlertTriangle} label="Urgent" value={stats.urgent} color="bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300" />
        <StatCard icon={CalendarClock} label="Bulan Ini" value={stats.bulanIni} color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" />
      </div>

      {/* Filter */}
      <Card className="mb-4">
        <CardContent className="p-4 flex items-center gap-3">
          <Label className="text-xs">Filter Prioritas:</Label>
          <Select value={filterPrioritas} onValueChange={setFilterPrioritas}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              {PRIORITAS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Data table */}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          searchable
          searchKeys={['judul', 'konten']}
          getRowId={(p) => p.id}
          emptyMessage="Belum ada pengumuman"
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pengumuman' : 'Tambah Pengumuman'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Perbarui informasi pengumuman.' : 'Buat pengumuman baru untuk disebarkan ke mahasiswa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Judul <span className="text-rose-500">*</span></Label>
              <Input
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                placeholder="Judul pengumuman"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioritas</Label>
                <Select value={form.prioritas} onValueChange={(v) => setForm({ ...form, prioritas: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITAS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Penulis</Label>
                <Input
                  value={form.penulis}
                  onChange={(e) => setForm({ ...form, penulis: e.target.value })}
                  placeholder="Nama penulis (opsional)"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Konten <span className="text-rose-500">*</span></Label>
              <Textarea
                value={form.konten}
                onChange={(e) => setForm({ ...form, konten: e.target.value })}
                placeholder="Isi pengumuman..."
                className="min-h-[200px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {editing ? 'Simpan' : 'Terbitkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="leading-snug">{viewing?.judul}</DialogTitle>
                <DialogDescription className="mt-1">
                  Dipublikasikan pada {viewing && formatDate(viewing.tanggal, true)}
                </DialogDescription>
              </div>
              {viewing && prioritasBadge(viewing.prioritas)}
            </div>
          </DialogHeader>
          <div className="border-t pt-4">
            <ScrollArea className="h-[300px] pr-2">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{viewing?.konten}</p>
            </ScrollArea>
            {viewing?.penulis && (
              <p className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                — {viewing.penulis}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Tutup</Button>
            {viewing && (
              <Button variant="default" onClick={() => { const v = viewing; setViewing(null); openEdit(v) }}>
                <Pencil className="w-4 h-4 mr-1.5" />Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengumuman?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengumuman <strong>{deleteTarget?.judul}</strong> akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
