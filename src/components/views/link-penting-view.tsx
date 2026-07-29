'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Link2, Plus, Pencil, Trash2, Loader2, ExternalLink, Search, LinkIcon,
  Globe, GraduationCap, Users, FileText, BookOpen, Building2, MoreHorizontal,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
interface LinkPenting {
  id: string
  judul: string
  url: string
  deskripsi: string | null
  kategori: string
  icon: string | null
  urutan: number
  status: string
  createdAt: string
  updatedAt: string
}

interface FormState {
  judul: string
  url: string
  deskripsi: string
  kategori: string
  icon: string
  urutan: string
  status: string
}
const EMPTY_FORM: FormState = {
  judul: '', url: '', deskripsi: '', kategori: 'Umum', icon: 'default', urutan: '0', status: 'AKTIF',
}

const KATEGORI_OPTIONS = [
  { value: 'Akademik', label: 'Akademik', icon: GraduationCap },
  { value: 'Kepegawaian', label: 'Kepegawaian', icon: Users },
  { value: 'Sistem Informasi', label: 'Sistem Informasi', icon: FileText },
  { value: 'Umum', label: 'Umum', icon: Globe },
]

const ICON_OPTIONS = [
  { value: 'default', label: 'Default (Link)', icon: LinkIcon },
  { value: 'globe', label: 'Globe', icon: Globe },
  { value: 'graduation', label: 'Graduation', icon: GraduationCap },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'file', label: 'File', icon: FileText },
  { value: 'book', label: 'Book', icon: BookOpen },
  { value: 'building', label: 'Building', icon: Building2 },
]

function iconForName(name: string | null) {
  const found = ICON_OPTIONS.find(o => o.value === name)
  return found ? found.icon : LinkIcon
}

function kategoriColor(kategori: string) {
  const map: Record<string, string> = {
    'Akademik': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    'Kepegawaian': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'Sistem Informasi': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    'Umum': 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800',
  }
  return map[kategori] ?? map['Umum']
}

// ============ Main View ============
export function LinkPentingView() {
  const [data, setData] = useState<LinkPenting[]>([])
  const [loading, setLoading] = useState(true)
  const [filterKategori, setFilterKategori] = useState('ALL')
  const [search, setSearch] = useState('')

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LinkPenting | null>(null)
  const [editing, setEditing] = useState<LinkPenting | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/link-penting')
      if (!res.ok) throw new Error('Gagal')
      const json: LinkPenting[] = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat link penting')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Close action menu on outside click
  useEffect(() => {
    const handler = () => setMenuOpenId(null)
    if (menuOpenId) {
      window.addEventListener('click', handler)
      return () => window.removeEventListener('click', handler)
    }
  }, [menuOpenId])

  // Only show AKTIF links in the public grid view; NONAKTIF is admin-only filter
  const filtered = useMemo(() => {
    let result = data
    if (filterKategori !== 'ALL') {
      result = result.filter(l => l.kategori === filterKategori)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.judul.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.deskripsi?.toLowerCase().includes(q) ?? false)
      )
    }
    return result
  }, [data, filterKategori, search])

  // Group by kategori for display
  const grouped = useMemo(() => {
    const map = new Map<string, LinkPenting[]>()
    filtered.forEach(l => {
      const arr = map.get(l.kategori) ?? []
      arr.push(l)
      map.set(l.kategori, arr)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const stats = useMemo(() => ({
    total: data.length,
    aktif: data.filter(l => l.status === 'AKTIF').length,
    kategori: new Set(data.map(l => l.kategori)).size,
  }), [data])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (l: LinkPenting) => {
    setEditing(l)
    setForm({
      judul: l.judul,
      url: l.url,
      deskripsi: l.deskripsi ?? '',
      kategori: l.kategori,
      icon: l.icon ?? 'default',
      urutan: String(l.urutan),
      status: l.status,
    })
    setFormOpen(true)
    setMenuOpenId(null)
  }

  const submitForm = async () => {
    if (!form.judul.trim() || !form.url.trim()) {
      toast.error('Judul dan URL wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/link-penting/${editing.id}` : '/api/link-penting'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: form.judul,
          url: form.url,
          deskripsi: form.deskripsi || null,
          kategori: form.kategori,
          icon: form.icon === 'default' ? null : form.icon,
          urutan: Number(form.urutan) || 0,
          status: form.status,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menyimpan')
      }
      toast.success(editing ? 'Link diperbarui' : 'Link ditambahkan')
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
      const res = await fetch(`/api/link-penting/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal')
      toast.success('Link dihapus')
      setDeleteTarget(null)
      fetchData()
    } catch {
      toast.error('Gagal menghapus link')
    } finally {
      setDeleting(false)
    }
  }

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <PageHeader
        title="Link Penting"
        description="Kumpulan tautan eksternal untuk admin (SISTER, SIAKAD, e-learning, dll)"
        icon={Link2}
        breadcrumb={['Sistem', 'Link Penting']}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />Tambah Link
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Total Link</p>
                <p className="text-xl font-bold tracking-tight">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Link Aktif</p>
                <p className="text-xl font-bold tracking-tight">{stats.aktif}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Kategori</p>
                <p className="text-xl font-bold tracking-tight">{stats.kategori}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search & filter */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari link berdasarkan judul, URL, atau deskripsi..."
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Kategori:</Label>
            <Select value={filterKategori} onValueChange={setFilterKategori}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Kategori</SelectItem>
                {KATEGORI_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Card grid grouped by kategori */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Link2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Belum ada link penting</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              {search || filterKategori !== 'ALL'
                ? 'Tidak ada link yang cocok dengan filter Anda. Coba reset filter.'
                : 'Klik "Tambah Link" untuk mulai menambahkan tautan eksternal seperti SISTER, SIAKAD, e-learning, dll.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([kategori, links]) => (
            <div key={kategori}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{kategori}</h3>
                <Badge variant="outline" className="text-[10px] h-5">{links.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {links.map((l, idx) => {
                  const Icon = iconForName(l.icon)
                  const isNonaktif = l.status === 'NONAKTIF'
                  return (
                    <motion.div
                      key={l.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <Card className={`card-hover group relative ${isNonaktif ? 'opacity-60' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${kategoriColor(l.kategori)}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  onClick={() => !isNonaktif && openLink(l.url)}
                                  className="text-left min-w-0 flex-1"
                                  disabled={isNonaktif}
                                >
                                  <p className="font-medium text-sm truncate hover:text-primary transition-colors">
                                    {l.judul}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                                    {(() => {
                                      try { return new URL(l.url).hostname.replace('www.', '') }
                                      catch { return l.url }
                                    })()}
                                  </p>
                                </button>
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setMenuOpenId(menuOpenId === l.id ? null : l.id)
                                    }}
                                    className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                    title="Aksi"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                  {menuOpenId === l.id && (
                                    <div
                                      className="absolute right-0 top-8 z-10 w-32 rounded-md border border-border bg-popover shadow-md py-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => openLink(l.url)}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" /> Buka
                                      </button>
                                      <button
                                        onClick={() => openEdit(l)}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2 text-amber-600"
                                      >
                                        <Pencil className="w-3.5 h-3.5" /> Edit
                                      </button>
                                      <button
                                        onClick={() => { setDeleteTarget(l); setMenuOpenId(null) }}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2 text-rose-600"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {l.deskripsi && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{l.deskripsi}</p>
                              )}
                              <div className="flex items-center gap-2 mt-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium ${kategoriColor(l.kategori)}`}>
                                  {l.kategori}
                                </span>
                                {isNonaktif && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium bg-muted text-muted-foreground border-border">
                                    Nonaktif
                                  </span>
                                )}
                                <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Link' : 'Tambah Link Penting'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Perbarui informasi link.' : 'Tambahkan tautan eksternal baru untuk admin.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Judul <span className="text-rose-500">*</span></Label>
              <Input
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                placeholder="mis. SISTER UNIRAYA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL <span className="text-rose-500">*</span></Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="mis. https://sister.uniraya.ac.id"
              />
              <p className="text-[11px] text-muted-foreground">URL akan otomatis diawali https:// jika tidak ditulis.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                placeholder="Deskripsi singkat tentang link ini (opsional)"
                className="min-h-[70px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KATEGORI_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Urutan</Label>
                <Input
                  type="number"
                  value={form.urutan}
                  onChange={(e) => setForm({ ...form, urutan: e.target.value })}
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground">Angka lebih kecil tampil lebih dulu.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AKTIF">Aktif</SelectItem>
                    <SelectItem value="NONAKTIF">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            <AlertDialogTitle>Hapus Link?</AlertDialogTitle>
            <AlertDialogDescription>
              Link <strong>{deleteTarget?.judul}</strong> akan dihapus permanen.
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
