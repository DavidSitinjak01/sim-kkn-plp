'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  FileEdit, Plus, Pencil, Trash2, Eye, Check, X, UserPlus, Loader2, Search,
  Copy, Inbox, ArrowUp, ArrowDown, GripVertical, MoreVertical, Star, Send,
  Image as ImageIcon, Clock, UserCheck, AlertCircle, FileText, ExternalLink,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  FIELD_TYPES, SYSTEM_FIELD_TEMPLATES, REQUIRED_SYSTEM_KEYS,
  slugifyKey, generateFieldId,
  type FormFieldDef, type FieldType,
} from '@/lib/form-field-def'

// ============ Types ============
interface FormSummary {
  id: string
  nama: string
  deskripsi: string | null
  isPublished: boolean
  isDefault: boolean
  fields: FormFieldDef[]
  createdAt: string
  updatedAt: string
  _count?: { responses: number }
}

type ResponseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IMPORTED'

interface ResponseRow {
  id: string
  formId: string
  form: { id: string; nama: string; deskripsi: string | null; fields: FormFieldDef[] } | null
  data: Record<string, string>
  status: ResponseStatus
  catatan: string | null
  importedMahasiswaId: string | null
  createdAt: string
  updatedAt: string
}

interface Prodi {
  id: string
  kode: string
  nama: string
  jenjang: string
  fakultas: { id: string; nama: string }
}

// ============ Constants ============
const STATUS_STYLES: Record<ResponseStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  IMPORTED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
}

const STATUS_LABELS: Record<ResponseStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  IMPORTED: 'Diimpor',
}

const STATUS_FILTERS: { value: 'SEMUA' | ResponseStatus; label: string }[] = [
  { value: 'SEMUA', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'IMPORTED', label: 'Diimpor' },
]

const FIELD_TYPE_LABELS: Record<FieldType, string> = FIELD_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<FieldType, string>
)

// ============ Helpers ============
function formatDateTime(iso: string) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise<void>((resolve) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      /* noop */
    }
    resolve()
  })
}

// Extract a "best-effort" display string for a given field from response data.
function displayValue(data: Record<string, string>, field: FormFieldDef): string {
  const v = data[field.key]
  if (v === undefined || v === null || v === '') return '-'
  if (field.type === 'checkbox') return v === 'true' ? 'Ya' : 'Tidak'
  return v
}

// Check whether a form has all required system keys (for import-to-mahasiswa).
function hasRequiredSystemKeys(fields: FormFieldDef[]): boolean {
  const keys = new Set(fields.map((f) => f.key))
  return REQUIRED_SYSTEM_KEYS.every((k) => keys.has(k))
}

// ============ Main Component ============
export function FormPendaftaranView() {
  const [tab, setTab] = useState<'forms' | 'responses'>('forms')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formulir Pendaftaran"
        description="Susun form pendaftaran yang akan diisi calon peserta KKN/PLP"
        icon={FileEdit}
        breadcrumb={['Pendaftaran', 'Formulir']}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'forms' | 'responses')}>
        <TabsList>
          <TabsTrigger value="forms" className="gap-1.5">
            <FileEdit className="w-4 h-4" />
            Formulir
          </TabsTrigger>
          <TabsTrigger value="responses" className="gap-1.5">
            <Inbox className="w-4 h-4" />
            Pendaftaran Masuk
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'forms' ? <FormsTab /> : <ResponsesTab />}
    </div>
  )
}

export default FormPendaftaranView

// =====================================================
// ============ TAB 1: FORMS (FORM BUILDER) ============
// =====================================================

function FormsTab() {
  const [forms, setForms] = useState<FormSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FormSummary | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<FormSummary | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchForms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/form-pendaftaran', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat')
      const data = await res.json()
      setForms(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Gagal memuat daftar form')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchForms()
  }, [fetchForms])

  const handleOpenCreate = () => {
    setEditTarget(null)
    setEditorKey((k) => k + 1)
    setEditorOpen(true)
  }

  const handleOpenEdit = (form: FormSummary) => {
    setEditTarget(form)
    setEditorKey((k) => k + 1)
    setEditorOpen(true)
  }

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/?daftar=true`
    try {
      await copyToClipboard(link)
      toast.success('Link form pendaftaran disalin', { description: link })
    } catch {
      toast.error('Gagal menyalin link')
    }
  }

  const handleTogglePublish = async (form: FormSummary) => {
    setBusyId(form.id)
    try {
      const res = await fetch(`/api/form-pendaftaran/${form.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: !form.isPublished }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Gagal mengubah status')
      }
      toast.success(form.isPublished ? 'Form dinonaktifkan' : 'Form dipublikasikan')
      await fetchForms()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengubah status publish')
    } finally {
      setBusyId(null)
    }
  }

  const handleSetDefault = async (form: FormSummary) => {
    setBusyId(form.id)
    try {
      const res = await fetch(`/api/form-pendaftaran/${form.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setDefault: !form.isDefault }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Gagal mengatur form default')
      }
      toast.success(form.isDefault ? 'Form tidak lagi menjadi default' : 'Form dijadikan default (otomatis dipublikasikan)')
      await fetchForms()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengatur default')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      const res = await fetch(`/api/form-pendaftaran/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Gagal menghapus form')
      }
      toast.success('Form dihapus')
      setDeleteTarget(null)
      await fetchForms()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus form')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            Kelola seluruh form pendaftaran. Pilih satu form sebagai <span className="font-semibold">default</span> untuk ditampilkan di link publik.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
            <Copy className="w-4 h-4" /> Salin Link Form
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
            <Plus className="w-4 h-4" /> Buat Form Baru
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-2/3 mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <FileEdit className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Belum ada form pendaftaran</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Buat form pertama Anda, tambahkan field yang dibutuhkan, lalu set sebagai default agar muncul di link publik.
              </p>
            </div>
            <Button onClick={handleOpenCreate} className="gap-1.5">
              <Plus className="w-4 h-4" /> Buat Form Baru
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {forms.map((form) => {
            const fieldCount = form.fields.length
            const responseCount = form._count?.responses ?? 0
            const isBusy = busyId === form.id
            return (
              <Card key={form.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{form.nama}</h3>
                        {form.isDefault && (
                          <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
                            <Star className="w-3 h-3" /> Default
                          </Badge>
                        )}
                        <Badge variant="outline" className={form.isPublished
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
                          : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'}>
                          {form.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      {form.deskripsi ? (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{form.deskripsi}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic mb-2">Tanpa deskripsi</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> {fieldCount} field
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Inbox className="w-3.5 h-3.5" /> {responseCount} pendaftar
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Diperbarui {formatDateTime(form.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={() => handleOpenEdit(form)} disabled={isBusy}>
                        <Pencil className="w-4 h-4" /> Edit
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="gap-1.5 h-8"
                        onClick={() => handleTogglePublish(form)}
                        disabled={isBusy || form.isDefault}
                        title={form.isDefault ? 'Form default harus selalu published' : undefined}
                      >
                        {form.isPublished ? <X className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {form.isPublished ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="gap-1.5 h-8"
                        onClick={() => handleSetDefault(form)}
                        disabled={isBusy}
                      >
                        <Star className={`w-4 h-4 ${form.isDefault ? 'fill-emerald-500 text-emerald-600' : ''}`} />
                        {form.isDefault ? 'Hapus Default' : 'Jadikan Default'}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isBusy}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={handleCopyLink}>
                            <Copy className="w-4 h-4" /> Salin Link Publik
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open('/?daftar=true', '_blank')}>
                            <ExternalLink className="w-4 h-4" /> Buka Link Publik
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(form)}
                            disabled={isBusy}
                          >
                            <Trash2 className="w-4 h-4" /> Hapus Form
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Builder / Editor Dialog */}
      <FormEditorDialog
        key={editorKey}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editTarget={editTarget}
        onSaved={fetchForms}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus form &ldquo;{deleteTarget?.nama}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus form beserta seluruh pendaftaran masuk yang terkait. Aksi ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === deleteTarget?.id}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busyId === deleteTarget?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busyId === deleteTarget?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

// =====================================================
// ============ FORM EDITOR DIALOG (BUILDER) ===========
// =====================================================

interface FormEditorDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  editTarget: FormSummary | null
  onSaved: () => void
}

function FormEditorDialog({ open, onOpenChange, editTarget, onSaved }: FormEditorDialogProps) {
  // State is initialized lazily from editTarget. The parent passes a `key`
  // that bumps on every open so this component remounts with fresh state.
  const [nama, setNama] = useState(editTarget?.nama ?? '')
  const [deskripsi, setDeskripsi] = useState(editTarget?.deskripsi ?? '')
  const [fields, setFields] = useState<FormFieldDef[]>(
    editTarget?.fields ? editTarget.fields.map((f) => ({ ...f })) : []
  )
  const [saving, setSaving] = useState(false)
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false)
  const [fieldEditTarget, setFieldEditTarget] = useState<FormFieldDef | null>(null)
  const [fieldEditorKey, setFieldEditorKey] = useState(0)
  const [systemMenuOpen, setSystemMenuOpen] = useState(false)

  const handleAddField = () => {
    setFieldEditTarget(null)
    setFieldEditorKey((k) => k + 1)
    setFieldEditorOpen(true)
  }

  const handleEditField = (field: FormFieldDef) => {
    setFieldEditTarget(field)
    setFieldEditorKey((k) => k + 1)
    setFieldEditorOpen(true)
  }

  const handleSaveField = (field: FormFieldDef) => {
    setFields((prev) => {
      // Determine if this is an update or insert
      const exists = prev.some((f) => f.id === field.id)
      const next = exists
        ? prev.map((f) => (f.id === field.id ? field : f))
        : [...prev, { ...field, order: prev.length }]
      // Re-sequence order
      return next.map((f, i) => ({ ...f, order: i }))
    })
    setFieldEditorOpen(false)
    setFieldEditTarget(null)
  }

  const handleDeleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i })))
  }

  const handleMoveField = (id: string, dir: -1 | 1) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id)
      if (idx === -1) return prev
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.splice(newIdx, 0, item)
      return next.map((f, i) => ({ ...f, order: i }))
    })
  }

  const handleAddSystemField = (template: Omit<FormFieldDef, 'id' | 'order'>) => {
    // Skip if a field with the same key already exists
    if (fields.some((f) => f.key === template.key)) {
      toast.error(`Field dengan key &ldquo;${template.key}&rdquo; sudah ada`)
      setSystemMenuOpen(false)
      return
    }
    const newField: FormFieldDef = {
      ...template,
      id: generateFieldId(),
      order: fields.length,
    }
    setFields((prev) => [...prev, newField].map((f, i) => ({ ...f, order: i })))
    toast.success(`Field &ldquo;${template.label}&rdquo; ditambahkan`)
    setSystemMenuOpen(false)
  }

  const handleSave = async () => {
    if (!nama.trim()) {
      toast.error('Nama form wajib diisi')
      return
    }
    // Validate field keys unique
    const seen = new Set<string>()
    for (const f of fields) {
      if (!f.key.trim()) {
        toast.error(`Field &ldquo;${f.label}&rdquo; tidak memiliki key`)
        return
      }
      if (seen.has(f.key)) {
        toast.error(`Key field duplikat: &ldquo;${f.key}&rdquo;`)
        return
      }
      seen.add(f.key)
    }

    setSaving(true)
    try {
      const payload = {
        nama: nama.trim(),
        deskripsi: deskripsi.trim() || null,
        fields: fields.map((f, i) => ({ ...f, order: i })),
      }
      const url = editTarget
        ? `/api/form-pendaftaran/${editTarget.id}`
        : '/api/form-pendaftaran'
      const method = editTarget ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Gagal menyimpan form')
      }
      toast.success(editTarget ? 'Form diperbarui' : 'Form dibuat')
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan form')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTarget ? 'Edit Form' : 'Buat Form Baru'}</DialogTitle>
          <DialogDescription>
            Susun metadata form dan field-field yang akan diisi oleh calon peserta KKN/PLP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Metadata */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="form-nama">Nama Form <span className="text-destructive">*</span></Label>
              <Input
                id="form-nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="cth. Pendaftaran KKN 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-deskripsi">Deskripsi (opsional)</Label>
              <Textarea
                id="form-deskripsi"
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Deskripsi singkat form yang ditampilkan ke mahasiswa"
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Fields section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">Field Form</h4>
                <p className="text-xs text-muted-foreground">
                  Drag-and-drop tidak digunakan; gunakan panah atas/bawah untuk mengurutkan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu open={systemMenuOpen} onOpenChange={setSystemMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Star className="w-4 h-4" /> Tambah Field Sistem
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 max-h-80 overflow-y-auto">
                    <DropdownMenuLabel>Field Sistem (untuk Import Mahasiswa)</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SYSTEM_FIELD_TEMPLATES.map((tpl) => (
                      <DropdownMenuItem
                        key={tpl.key}
                        onClick={() => handleAddSystemField(tpl)}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <span className="text-sm font-medium">{tpl.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          key: <code className="font-mono">{tpl.key}</code> · {FIELD_TYPE_LABELS[tpl.type]}{tpl.required ? ' · wajib' : ''}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" onClick={handleAddField} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Tambah Field
                </Button>
              </div>
            </div>

            {/* Field rows */}
            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada field. Klik &ldquo;Tambah Field&rdquo; atau gunakan field sistem.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    index={idx}
                    total={fields.length}
                    onMoveUp={() => handleMoveField(field.id, -1)}
                    onMoveDown={() => handleMoveField(field.id, 1)}
                    onEdit={() => handleEditField(field)}
                    onDelete={() => handleDeleteField(field.id)}
                  />
                ))}
              </div>
            )}

            {/* Required system keys status */}
            <SystemKeyStatus fields={fields} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {editTarget ? 'Simpan Perubahan' : 'Buat Form'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Field editor sub-dialog */}
      <FieldEditorDialog
        key={fieldEditorKey}
        open={fieldEditorOpen}
        onOpenChange={setFieldEditorOpen}
        editTarget={fieldEditTarget}
        existingKeys={fields.filter((f) => f.key !== fieldEditTarget?.key).map((f) => f.key)}
        onSave={handleSaveField}
      />
    </Dialog>
  )
}

function SystemKeyStatus({ fields }: { fields: FormFieldDef[] }) {
  const fieldKeys = new Set(fields.map((f) => f.key))
  const missing = REQUIRED_SYSTEM_KEYS.filter((k) => !fieldKeys.has(k))
  const ok = missing.length === 0
  return (
    <div className={`text-xs rounded-md border p-3 ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>
      {ok ? (
        <div className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> Form memiliki seluruh field sistem yang wajib untuk Import ke Mahasiswa.
        </div>
      ) : (
        <div className="flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Field sistem wajib belum lengkap:</p>
            <p className="mt-0.5">
              Tambahkan field dengan key: <code className="font-mono">{missing.join(', ')}</code>.
              Tanpa field ini, tombol Import ke Mahasiswa akan dinonaktifkan.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldRow({
  field, index, total, onMoveUp, onMoveDown, onEdit, onDelete,
}: {
  field: FormFieldDef
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card p-2.5">
      <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
        <GripVertical className="w-4 h-4 hidden sm:block" />
        <span className="text-xs font-mono w-6 text-right">{index + 1}.</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm truncate">{field.label}</p>
          {field.required && <span className="text-destructive text-xs">*</span>}
          <Badge variant="secondary" className="text-[10px] font-mono">{field.key}</Badge>
          <Badge variant="outline" className="text-[10px]">{FIELD_TYPE_LABELS[field.type]}</Badge>
          {field.options && field.options.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{field.options.length} opsi</Badge>
          )}
        </div>
        {field.helpText && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{field.helpText}</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveUp} disabled={index === 0}>
          <ArrowUp className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveDown} disabled={index === total - 1}>
          <ArrowDown className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

// =====================================================
// ============ FIELD EDITOR SUB-DIALOG ================
// =====================================================

interface FieldEditorDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  editTarget: FormFieldDef | null
  existingKeys: string[]
  onSave: (field: FormFieldDef) => void
}

function FieldEditorDialog({ open, onOpenChange, editTarget, existingKeys, onSave }: FieldEditorDialogProps) {
  // State is initialized lazily from editTarget. The parent passes a `key`
  // that bumps on every open so this component remounts with fresh state.
  const [label, setLabel] = useState(editTarget?.label ?? '')
  const [key, setKey] = useState(editTarget?.key ?? '')
  const [type, setType] = useState<FieldType>(editTarget?.type ?? 'text')
  const [required, setRequired] = useState(editTarget?.required ?? false)
  const [helpText, setHelpText] = useState(editTarget?.helpText ?? '')
  const [placeholder, setPlaceholder] = useState(editTarget?.placeholder ?? '')
  const [optionsText, setOptionsText] = useState(editTarget?.options?.join(', ') ?? '')
  // keyTouched = true if editing an existing field (don't auto-slug) OR if the user manually edited the key
  const [keyTouched, setKeyTouched] = useState(!!editTarget)

  // Auto-derive key from label (only if user hasn't manually edited key).
  // Implemented as event-handler side-effect rather than useEffect+setState
  // to satisfy react-hooks/set-state-in-effect lint rule.
  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel)
    if (!keyTouched) {
      setKey(slugifyKey(newLabel))
    }
  }

  const handleKeyChange = (newKey: string) => {
    setKey(newKey)
    setKeyTouched(true)
  }

  const needsOptions = type === 'select' || type === 'radio'

  const handleSave = () => {
    const trimmedLabel = label.trim()
    const trimmedKey = key.trim()
    if (!trimmedLabel) {
      toast.error('Label field wajib diisi')
      return
    }
    if (!trimmedKey) {
      toast.error('Key field wajib diisi')
      return
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedKey)) {
      toast.error('Key harus berupa slug (huruf/angka/underscore, tidak boleh diawali angka)')
      return
    }
    if (existingKeys.includes(trimmedKey)) {
      toast.error(`Key &ldquo;${trimmedKey}&rdquo; sudah digunakan field lain`)
      return
    }
    const options = needsOptions
      ? optionsText.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined
    if (needsOptions && (!options || options.length === 0)) {
      toast.error('Field pilihan membutuhkan minimal 1 opsi')
      return
    }

    onSave({
      id: editTarget?.id ?? generateFieldId(),
      label: trimmedLabel,
      key: trimmedKey,
      type,
      required,
      helpText: helpText.trim() || undefined,
      placeholder: placeholder.trim() || undefined,
      options,
      order: editTarget?.order ?? 0,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editTarget ? 'Edit Field' : 'Tambah Field'}</DialogTitle>
          <DialogDescription>
            Konfigurasikan field form yang akan diisi oleh pendaftar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="field-label">Label <span className="text-destructive">*</span></Label>
            <Input
              id="field-label"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="cth. Nama Lengkap"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-key">Key (slug) <span className="text-destructive">*</span></Label>
            <Input
              id="field-key"
              value={key}
              onChange={(e) => {
                handleKeyChange(e.target.value)
              }}
              placeholder="cth. namaLengkap"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Identifier unik. Digunakan sebagai key jawaban pendaftar.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="field-type">Tipe Field</Label>
              <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
                <SelectTrigger id="field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Wajib Diisi?</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border">
                <Switch checked={required} onCheckedChange={setRequired} id="field-required" />
                <Label htmlFor="field-required" className="text-sm cursor-pointer">
                  {required ? 'Wajib' : 'Opsional'}
                </Label>
              </div>
            </div>
          </div>
          {needsOptions && (
            <div className="space-y-1.5">
              <Label htmlFor="field-options">Opsi (pisahkan dengan koma) <span className="text-destructive">*</span></Label>
              <Input
                id="field-options"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="cth. L, P  atau cth. S1, S2, S3"
              />
              <p className="text-xs text-muted-foreground">
                Pisahkan tiap opsi dengan koma.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="field-placeholder">Placeholder (opsional)</Label>
            <Input
              id="field-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="cth. Masukkan nama lengkap"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-help">Teks Bantuan (opsional)</Label>
            <Textarea
              id="field-help"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              placeholder="Petunjuk singkat untuk pendaftar"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} className="gap-1.5">
            <Check className="w-4 h-4" /> {editTarget ? 'Simpan Field' : 'Tambah Field'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// ============ TAB 2: RESPONSES (PENDAFTARAN MASUK) ===
// =====================================================

function ResponsesTab() {
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [forms, setForms] = useState<FormSummary[]>([])
  const [prodiList, setProdiList] = useState<Prodi[]>([])
  const [loading, setLoading] = useState(true)

  const [formFilter, setFormFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | ResponseStatus>('SEMUA')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [detail, setDetail] = useState<ResponseRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ResponseRow | null>(null)
  const [importTarget, setImportTarget] = useState<ResponseRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ResponseRow | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchResponses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (formFilter !== 'all') params.set('formId', formFilter)
      if (statusFilter !== 'SEMUA') params.set('status', statusFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/pendaftaran-responses?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat')
      const data = await res.json()
      setResponses(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Gagal memuat pendaftaran masuk')
    } finally {
      setLoading(false)
    }
  }, [formFilter, statusFilter, debouncedSearch])

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch('/api/form-pendaftaran', { cache: 'no-store' })
      const data = await res.json()
      if (Array.isArray(data)) setForms(data)
    } catch {
      /* ignore */
    }
  }, [])

  const fetchProdi = useCallback(async () => {
    try {
      const res = await fetch('/api/prodi', { cache: 'no-store' })
      const data = await res.json()
      if (Array.isArray(data)) setProdiList(data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchForms()
    fetchProdi()
  }, [fetchForms, fetchProdi])

  useEffect(() => {
    fetchResponses()
  }, [fetchResponses])

  const handleApprove = async (r: ResponseRow) => {
    setBusyId(r.id)
    try {
      const res = await fetch(`/api/pendaftaran-responses/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', catatan: r.catatan ?? '' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Gagal menyetujui')
      }
      toast.success('Pendaftaran disetujui')
      await fetchResponses()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyetujui pendaftaran')
    } finally {
      setBusyId(null)
    }
  }

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      toast.error('Alasan penolakan wajib diisi')
      return
    }
    setBusyId(rejectTarget.id)
    try {
      const res = await fetch(`/api/pendaftaran-responses/${rejectTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', catatan: rejectReason.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Gagal menolak')
      }
      toast.success('Pendaftaran ditolak')
      setRejectTarget(null)
      setRejectReason('')
      await fetchResponses()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menolak pendaftaran')
    } finally {
      setBusyId(null)
    }
  }

  const handleDeleteResponse = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      const res = await fetch(`/api/pendaftaran-responses/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Gagal menghapus')
      }
      toast.success('Pendaftaran dihapus')
      setDeleteTarget(null)
      await fetchResponses()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus pendaftaran')
    } finally {
      setBusyId(null)
    }
  }

  const handleImported = () => {
    setImportTarget(null)
    fetchResponses()
  }

  const stats = useMemo(() => {
    const total = responses.length
    const pending = responses.filter((r) => r.status === 'PENDING').length
    const approved = responses.filter((r) => r.status === 'APPROVED').length
    const rejected = responses.filter((r) => r.status === 'REJECTED').length
    const imported = responses.filter((r) => r.status === 'IMPORTED').length
    return { total, pending, approved, rejected, imported }
  }, [responses])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <ResponseStatCard label="Total" value={stats.total} color="bg-muted text-foreground" icon={Inbox} />
        <ResponseStatCard label="Menunggu" value={stats.pending} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" icon={Clock} />
        <ResponseStatCard label="Disetujui" value={stats.approved} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" icon={Check} />
        <ResponseStatCard label="Ditolak" value={stats.rejected} color="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" icon={X} />
        <ResponseStatCard label="Diimpor" value={stats.imported} color="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" icon={UserCheck} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'SEMUA' | ResponseStatus)}>
          <TabsList className="flex-wrap h-auto">
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Select value={formFilter} onValueChange={setFormFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Semua Form" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Form</SelectItem>
              {forms.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama / NIM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : responses.length === 0 ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center text-center gap-2">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Belum ada pendaftaran masuk</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Pendaftaran dari form publik akan muncul di sini. Pastikan minimal satu form sudah dipublikasikan dan dijadikan default.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pendaftar</TableHead>
                  <TableHead>NIM</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Tgl Daftar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((r) => {
                  const nama = r.data?.namaLengkap || '-'
                  const nim = r.data?.nim || '-'
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{nama}</TableCell>
                      <TableCell className="font-mono text-xs">{nim}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {r.form?.nama || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ResponseRowActions
                          row={r}
                          busy={busyId === r.id}
                          canImport={!!r.form && hasRequiredSystemKeys(r.form.fields) && r.status !== 'IMPORTED'}
                          onDetail={() => setDetail(r)}
                          onApprove={() => handleApprove(r)}
                          onReject={() => { setRejectTarget(r); setRejectReason(r.catatan ?? '') }}
                          onImport={() => setImportTarget(r)}
                          onDelete={() => setDeleteTarget(r)}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {responses.map((r) => {
              const nama = r.data?.namaLengkap || '-'
              const nim = r.data?.nim || '-'
              return (
                <Card key={r.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{nama}</p>
                        <p className="text-xs text-muted-foreground font-mono">{nim}</p>
                      </div>
                      <Badge variant="outline" className={STATUS_STYLES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground truncate">{r.form?.nama || '-'}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDateTime(r.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <ResponseRowActions
                        row={r}
                        busy={busyId === r.id}
                        canImport={!!r.form && hasRequiredSystemKeys(r.form.fields) && r.status !== 'IMPORTED'}
                        onDetail={() => setDetail(r)}
                        onApprove={() => handleApprove(r)}
                        onReject={() => { setRejectTarget(r); setRejectReason(r.catatan ?? '') }}
                        onImport={() => setImportTarget(r)}
                        onDelete={() => setDeleteTarget(r)}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <ResponseDetailDialog
        row={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onApprove={(r) => { setDetail(null); handleApprove(r) }}
        onReject={(r) => { setDetail(null); setRejectTarget(r); setRejectReason(r.catatan ?? '') }}
        onImport={(r) => { setDetail(null); setImportTarget(r) }}
      />

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Pendaftaran</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan. Catatan ini akan terlihat oleh pendaftar jika diperlukan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Alasan Penolakan <span className="text-destructive">*</span></Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="cth. NIM sudah terdaftar, silakan hubungi panitia."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={busyId === rejectTarget?.id}>Batal</Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={busyId === rejectTarget?.id}
              className="gap-1.5"
            >
              {busyId === rejectTarget?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Tolak Pendaftaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ResponseImportDialog
        row={importTarget}
        prodiList={prodiList}
        onOpenChange={(o) => !o && setImportTarget(null)}
        onImported={handleImported}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pendaftaran ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Pendaftaran atas nama <span className="font-semibold">{deleteTarget?.data?.namaLengkap || '-'}</span> akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === deleteTarget?.id}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteResponse}
              disabled={busyId === deleteTarget?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busyId === deleteTarget?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

function ResponseStatCard({
  label, value, color, icon: Icon,
}: {
  label: string
  value: number
  color: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ResponseRowActions({
  row, busy, canImport, onDetail, onApprove, onReject, onImport, onDelete,
}: {
  row: ResponseRow
  busy: boolean
  canImport: boolean
  onDetail: () => void
  onApprove: () => void
  onReject: () => void
  onImport: () => void
  onDelete: () => void
}) {
  const canApprove = row.status === 'PENDING' || row.status === 'REJECTED'
  const canReject = row.status === 'PENDING' || row.status === 'APPROVED'
  const canDelete = row.status !== 'IMPORTED'

  const importTrigger = (
    <DropdownMenuItem
      onClick={canImport ? onImport : undefined}
      disabled={!canImport}
      className={canImport ? '' : 'opacity-50 cursor-not-allowed'}
    >
      <UserPlus className="w-4 h-4 text-sky-600" /> Import ke Mahasiswa
    </DropdownMenuItem>
  )

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onDetail} disabled={busy}>
        <Eye className="w-4 h-4" />
        <span className="hidden lg:inline">Detail</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canApprove && (
            <DropdownMenuItem onClick={onApprove}>
              <Check className="w-4 h-4 text-emerald-600" /> Setujui
            </DropdownMenuItem>
          )}
          {canReject && (
            <DropdownMenuItem onClick={onReject}>
              <X className="w-4 h-4 text-rose-600" /> Tolak
            </DropdownMenuItem>
          )}
          {canImport ? (
            importTrigger
          ) : row.status === 'IMPORTED' ? null : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{importTrigger}</div>
              </TooltipTrigger>
              <TooltipContent>
                Form belum memiliki field sistem wajib (namaLengkap, nim, jenisKelamin, noWa, alamat).
              </TooltipContent>
            </Tooltip>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4" /> Hapus
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ResponseDetailDialog({
  row, onOpenChange, onApprove, onReject, onImport,
}: {
  row: ResponseRow | null
  onOpenChange: (o: boolean) => void
  onApprove: (r: ResponseRow) => void
  onReject: (r: ResponseRow) => void
  onImport: (r: ResponseRow) => void
}) {
  if (!row) return null
  const fields = row.form?.fields ?? []
  const canImport = !!row.form && hasRequiredSystemKeys(fields) && row.status !== 'IMPORTED'
  const canApprove = row.status === 'PENDING' || row.status === 'REJECTED'
  const canReject = row.status === 'PENDING' || row.status === 'APPROVED'

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Pendaftaran</DialogTitle>
          <DialogDescription>
            Form: <span className="font-medium text-foreground">{row.form?.nama || '-'}</span> · Dikirim {formatDateTime(row.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={STATUS_STYLES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
            {row.importedMahasiswaId && (
              <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700">
                ID Mahasiswa: <span className="font-mono ml-1">{row.importedMahasiswaId.slice(-8)}</span>
              </Badge>
            )}
          </div>

          {row.catatan && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Catatan Admin:</p>
              <p className="text-amber-900 dark:text-amber-200 whitespace-pre-wrap">{row.catatan}</p>
            </div>
          )}

          {/* Render all fields */}
          <div className="space-y-2">
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">Form tidak memiliki field.</p>
            ) : (
              fields.map((field) => {
                const value = row.data?.[field.key]
                const isImage = field.type === 'file-image'
                return (
                  <div key={field.id} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-2 border-b last:border-0">
                    <div className="text-sm text-muted-foreground">
                      {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
                    </div>
                    <div className="sm:col-span-2 text-sm break-words">
                      {isImage && value ? (
                        <img
                          src={value}
                          alt={field.label}
                          className="max-w-[150px] max-h-[200px] rounded border object-cover"
                        />
                      ) : isImage ? (
                        <span className="text-muted-foreground italic">Tidak ada foto</span>
                      ) : (
                        <span className="whitespace-pre-wrap">{displayValue(row.data ?? {}, field)}</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {canApprove && (
            <Button variant="outline" className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => onApprove(row)}>
              <Check className="w-4 h-4" /> Setujui
            </Button>
          )}
          {canReject && (
            <Button variant="outline" className="gap-1.5 text-rose-700 border-rose-300 hover:bg-rose-50" onClick={() => onReject(row)}>
              <X className="w-4 h-4" /> Tolak
            </Button>
          )}
          {canImport && (
            <Button variant="outline" className="gap-1.5 text-sky-700 border-sky-300 hover:bg-sky-50" onClick={() => onImport(row)}>
              <UserPlus className="w-4 h-4" /> Import ke Mahasiswa
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResponseImportDialog({
  row, prodiList, onOpenChange, onImported,
}: {
  row: ResponseRow | null
  prodiList: Prodi[]
  onOpenChange: (o: boolean) => void
  onImported: () => void
}) {
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        {row && (
          <ResponseImportDialogInner
            key={row.id}
            row={row}
            prodiList={prodiList}
            onOpenChange={onOpenChange}
            onImported={onImported}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ResponseImportDialogInner({
  row, prodiList, onOpenChange, onImported,
}: {
  row: ResponseRow
  prodiList: Prodi[]
  onOpenChange: (o: boolean) => void
  onImported: () => void
}) {
  // Lazy initial state from row — remounts via key when target changes.
  const [form, setForm] = useState({
    tempatLahir: '',
    tanggalLahir: '',
    email: row.data?.email || '',
    semester: '6',
    angkatan: String(new Date().getFullYear()),
    prodiId: '',
  })
  const [saving, setSaving] = useState(false)

  const fields = row.form?.fields ?? []
  const canImport = !!row.form && hasRequiredSystemKeys(fields)

  const handleSubmit = async () => {
    if (!form.tempatLahir.trim()) return toast.error('Tempat lahir wajib diisi')
    if (!form.tanggalLahir) return toast.error('Tanggal lahir wajib diisi')
    if (!form.email.trim()) return toast.error('Email wajib diisi')
    if (!form.prodiId) return toast.error('Program studi wajib dipilih')
    const sem = Number(form.semester)
    if (!Number.isInteger(sem) || sem < 1) return toast.error('Semester tidak valid')
    const angk = Number(form.angkatan)
    if (!Number.isInteger(angk) || angk < 2000) return toast.error('Angkatan tidak valid')

    setSaving(true)
    try {
      const res = await fetch(`/api/pendaftaran-responses/${row.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempatLahir: form.tempatLahir.trim(),
          tanggalLahir: form.tanggalLahir,
          email: form.email.trim(),
          semester: sem,
          angkatan: angk,
          prodiId: form.prodiId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Gagal mengimpor')
      toast.success('Pendaftaran berhasil diimpor ke Data Mahasiswa')
      onImported()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengimpor pendaftaran')
    } finally {
      setSaving(false)
    }
  }

  // Preview extracted data
  const previewData = fields.filter((f) =>
    ['namaLengkap', 'nim', 'jenisKelamin', 'noWa', 'alamat', 'prodiNama', 'jurusan'].includes(f.key)
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import ke Data Mahasiswa</DialogTitle>
        <DialogDescription>
          Lengkapi data berikut untuk menambahkan pendaftar ke tabel Mahasiswa.
        </DialogDescription>
      </DialogHeader>

      {!canImport ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">Form belum bisa diimpor</p>
            <p className="text-amber-700 dark:text-amber-200 mt-1">
              Form harus memiliki field sistem wajib: namaLengkap, nim, jenisKelamin, noWa, alamat.
              Tambahkan field ini ke form terlebih dahulu di tab Formulir.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Preview */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Data dari Pendaftaran:</p>
            {previewData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tidak ada field sistem yang cocok.</p>
            ) : previewData.map((f) => (
              <div key={f.id} className="grid grid-cols-3 gap-2 text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="col-span-2 font-medium break-words">
                  {f.type === 'file-image' && row.data?.[f.key] ? (
                    <span className="text-emerald-600 inline-flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> tersedia
                    </span>
                  ) : displayValue(row.data ?? {}, f)}
                </span>
              </div>
            ))}
          </div>

          {/* Additional form */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="imp-tempat">Tempat Lahir <span className="text-destructive">*</span></Label>
              <Input id="imp-tempat" value={form.tempatLahir} onChange={(e) => setForm({ ...form, tempatLahir: e.target.value })} placeholder="cth. Gunungsitoli" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-tgl">Tanggal Lahir <span className="text-destructive">*</span></Label>
              <Input id="imp-tgl" type="date" value={form.tanggalLahir} onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-email">Email <span className="text-destructive">*</span></Label>
              <Input id="imp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="mahasiswa@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-prodi">Program Studi <span className="text-destructive">*</span></Label>
              <Select value={form.prodiId} onValueChange={(v) => setForm({ ...form, prodiId: v })}>
                <SelectTrigger id="imp-prodi"><SelectValue placeholder="Pilih prodi" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {prodiList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nama} ({p.jenjang}) — {p.fakultas.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-sem">Semester <span className="text-destructive">*</span></Label>
              <Input id="imp-sem" type="number" min={1} max={14} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-angk">Angkatan <span className="text-destructive">*</span></Label>
              <Input id="imp-angk" type="number" min={2000} max={new Date().getFullYear() + 1} value={form.angkatan} onChange={(e) => setForm({ ...form, angkatan: e.target.value })} />
            </div>
          </div>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
        <Button onClick={handleSubmit} disabled={!canImport || saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Import ke Mahasiswa
        </Button>
      </DialogFooter>
    </>
  )
}
