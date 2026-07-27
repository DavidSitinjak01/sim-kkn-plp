'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  CalendarDays, Plus, Pencil, Trash2, Loader2, MapPin, ChevronLeft, ChevronRight,
  Clock, FileSpreadsheet, FileText, Printer,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, generateTableHTML, formatDate,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
interface Agenda {
  id: string
  judul: string
  tanggal: string
  lokasi: string | null
  deskripsi: string | null
  tipe: string
  createdAt: string
  updatedAt: string
}

const TIPE_OPTIONS = [
  { value: 'ALL', label: 'Semua Tipe' },
  { value: 'KKN', label: 'KKN' },
  { value: 'PLP', label: 'PLP' },
  { value: 'UMUM', label: 'Umum' },
]

const TIPE_FORM_OPTIONS = [
  { value: 'KKN', label: 'KKN' },
  { value: 'PLP', label: 'PLP' },
  { value: 'UMUM', label: 'Umum' },
]

function tipeBadge(t: string) {
  const map: Record<string, string> = {
    KKN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    PLP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    UMUM: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${map[t] ?? ''}`}>{t}</span>
}

function toLocalDatetimeInputValue(d: Date) {
  // YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ============ Calendar Tab ============
function CalendarTab({ data, onEdit, onDelete, onAdd }: {
  data: Agenda[]
  onEdit: (a: Agenda) => void
  onDelete: (a: Agenda) => void
  onAdd: () => void
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const monthName = cursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  // Build calendar grid (Sun = 0 .. Sat = 6)
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Group agenda by date string
  const agendaByDay = useMemo(() => {
    const map = new Map<string, Agenda[]>()
    data.forEach(a => {
      const d = new Date(a.tanggal)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    })
    return map
  }, [data])

  const cells: { day: number | null; dateStr: string | null }[] = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, dateStr })
  }
  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null })

  const prevMonth = () => setCursor(new Date(year, month - 1, 1))
  const nextMonth = () => setCursor(new Date(year, month + 1, 1))
  const goToday = () => {
    const d = new Date()
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelectedDate(todayStr)
  }

  const selectedAgenda = selectedDate ? (agendaByDay.get(selectedDate) ?? []) : []

  const weekDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Calendar */}
      <Card className="lg:col-span-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <h3 className="font-semibold text-lg ml-2">{monthName}</h3>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>Hari Ini</Button>
              <Button size="sm" onClick={onAdd}>
                <Plus className="w-4 h-4 mr-1.5" />Tambah
              </Button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map(w => (
              <div key={w} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {w}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c.day) return <div key={i} className="min-h-[64px] rounded-md bg-muted/30" />
              const ags = agendaByDay.get(c.dateStr!) ?? []
              const isToday = c.dateStr === todayStr
              const isSelected = c.dateStr === selectedDate
              const hasAgenda = ags.length > 0
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(c.dateStr)}
                  className={`min-h-[64px] rounded-md border p-1.5 text-left transition-all hover:border-primary/40 hover:shadow-sm ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                  } ${isToday ? 'ring-2 ring-primary/40' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>{c.day}</span>
                    {hasAgenda && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {ags.length}
                      </span>
                    )}
                  </div>
                  {hasAgenda && (
                    <div className="mt-1 space-y-0.5">
                      {ags.slice(0, 2).map(a => (
                        <div
                          key={a.id}
                          className={`text-[10px] truncate px-1 py-0.5 rounded ${
                            a.tipe === 'KKN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : a.tipe === 'PLP' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
                          }`}
                          title={a.judul}
                        >
                          {a.judul}
                        </div>
                      ))}
                      {ags.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{ags.length - 2} lainnya</div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Side panel - agenda for selected day */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Agenda Hari</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {selectedDate
              ? new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              : 'Pilih tanggal untuk melihat agenda'}
          </p>
          <ScrollArea className="h-[420px] pr-2">
            {selectedAgenda.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                <CalendarDays className="w-8 h-8 mb-2 opacity-40" />
                Tidak ada agenda
              </div>
            ) : (
              <div className="space-y-3">
                {selectedAgenda.map(a => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border p-3 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm leading-snug">{a.judul}</h4>
                      {tipeBadge(a.tipe)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(a.tanggal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {a.lokasi && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{a.lokasi}
                        </span>
                      )}
                    </div>
                    {a.deskripsi && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.deskripsi}</p>
                    )}
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-600" onClick={() => onEdit(a)}>
                        <Pencil className="w-3 h-3 mr-1" />Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" onClick={() => onDelete(a)}>
                        <Trash2 className="w-3 h-3 mr-1" />Hapus
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// ============ Main View ============
export function AgendaView() {
  const [data, setData] = useState<Agenda[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTipe, setFilterTipe] = useState('ALL')

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Agenda | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Agenda | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({
    judul: '', tanggal: toLocalDatetimeInputValue(new Date()),
    lokasi: '', deskripsi: '', tipe: 'UMUM',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agenda')
      if (!res.ok) throw new Error('Gagal')
      const json: Agenda[] = await res.json()
      // Sort client-side by tanggal asc (API returns asc by default)
      setData(json)
    } catch {
      toast.error('Gagal memuat data agenda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    if (filterTipe === 'ALL') return data
    return data.filter(a => a.tipe === filterTipe)
  }, [data, filterTipe])

  const openCreate = () => {
    setEditing(null)
    setForm({
      judul: '', tanggal: toLocalDatetimeInputValue(new Date()),
      lokasi: '', deskripsi: '', tipe: 'UMUM',
    })
    setFormOpen(true)
  }

  const openEdit = (a: Agenda) => {
    setEditing(a)
    setForm({
      judul: a.judul,
      tanggal: toLocalDatetimeInputValue(new Date(a.tanggal)),
      lokasi: a.lokasi ?? '',
      deskripsi: a.deskripsi ?? '',
      tipe: a.tipe,
    })
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form.judul.trim() || !form.tanggal || !form.tipe) {
      toast.error('Judul, tanggal, dan tipe wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/agenda/${editing.id}` : '/api/agenda'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: form.judul,
          tanggal: new Date(form.tanggal).toISOString(),
          lokasi: form.lokasi.trim() || null,
          deskripsi: form.deskripsi.trim() || null,
          tipe: form.tipe,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menyimpan')
      }
      toast.success(editing ? 'Agenda diperbarui' : 'Agenda ditambahkan')
      setFormOpen(false)
      fetchData()
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
      const res = await fetch(`/api/agenda/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal')
      toast.success('Agenda dihapus')
      setDeleteTarget(null)
      fetchData()
    } catch {
      toast.error('Gagal menghapus agenda')
    } finally {
      setDeleting(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['Judul', 'Tanggal', 'Lokasi', 'Tipe', 'Deskripsi']
    const rows = filtered.map(a => [
      a.judul, formatDate(a.tanggal, true), a.lokasi ?? '-', a.tipe, a.deskripsi ?? '-',
    ])
    exportToCSV('agenda', headers, rows)
  }

  const handleExportPDF = () => {
    const headers = ['Judul', 'Tanggal', 'Lokasi', 'Tipe', 'Deskripsi']
    const rows = filtered.map(a => [
      a.judul, formatDate(a.tanggal, true), a.lokasi ?? '-', a.tipe, a.deskripsi ?? '-',
    ])
    exportToPDF('Daftar Agenda', generateTableHTML('Daftar Agenda Kegiatan', headers, rows))
  }

  const columns: Column<Agenda>[] = [
    {
      key: 'aksi', header: 'Aksi', sortable: false, width: '110px',
      render: (a) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-600" onClick={() => openEdit(a)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => setDeleteTarget(a)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    { key: 'judul', header: 'Judul', sortable: true, render: (a) => <span className="font-medium">{a.judul}</span> },
    {
      key: 'tanggal', header: 'Tanggal', sortable: true, sortValue: (a) => new Date(a.tanggal).getTime(),
      render: (a) => (
        <div className="text-xs">
          <p>{formatDate(a.tanggal)}</p>
          <p className="text-muted-foreground">{new Date(a.tanggal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
        </div>
      ),
    },
    { key: 'lokasi', header: 'Lokasi', sortable: true, render: (a) => (
      a.lokasi ? <span className="inline-flex items-center gap-1 text-xs"><MapPin className="w-3 h-3 text-muted-foreground" />{a.lokasi}</span> : <span className="text-muted-foreground text-xs">-</span>
    ) },
    { key: 'tipe', header: 'Tipe', sortable: true, render: (a) => tipeBadge(a.tipe) },
    { key: 'deskripsi', header: 'Deskripsi', sortable: false, render: (a) => (
      <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground" title={a.deskripsi ?? ''}>{a.deskripsi ?? '-'}</span>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Agenda Kegiatan"
        description="Jadwal kegiatan KKN, PLP, dan umum"
        icon={CalendarDays}
        breadcrumb={['Informasi', 'Agenda']}
      />

      <Tabs defaultValue="kalender">
        <TabsList className="mb-4">
          <TabsTrigger value="kalender"><CalendarDays className="w-4 h-4 mr-2" />Kalender</TabsTrigger>
          <TabsTrigger value="daftar"><FileText className="w-4 h-4 mr-2" />Daftar</TabsTrigger>
        </TabsList>

        <TabsContent value="kalender">
          {loading ? (
            <Skeleton className="h-[600px] w-full" />
          ) : (
            <CalendarTab
              data={data}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onAdd={openCreate}
            />
          )}
        </TabsContent>

        <TabsContent value="daftar" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="flex gap-2">
                <Select value={filterTipe} onValueChange={setFilterTipe}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading}>
                  <Printer className="w-4 h-4 mr-1.5" />PDF
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1.5" />Tambah Agenda
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DataTable
              data={filtered}
              columns={columns}
              searchable
              searchKeys={['judul', 'lokasi']}
              getRowId={(a) => a.id}
              emptyMessage="Belum ada agenda"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Agenda' : 'Tambah Agenda'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Perbarui data agenda.' : 'Buat agenda kegiatan baru.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Judul <span className="text-rose-500">*</span></Label>
              <Input
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                placeholder="Judul agenda"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tanggal & Waktu <span className="text-rose-500">*</span></Label>
                <Input
                  type="datetime-local"
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipe <span className="text-rose-500">*</span></Label>
                <Select value={form.tipe} onValueChange={(v) => setForm({ ...form, tipe: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPE_FORM_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Lokasi</Label>
              <Input
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                placeholder="Lokasi kegiatan"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                placeholder="Deskripsi agenda"
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {editing ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Agenda?</AlertDialogTitle>
            <AlertDialogDescription>
              Agenda <strong>{deleteTarget?.judul}</strong> akan dihapus permanen.
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
