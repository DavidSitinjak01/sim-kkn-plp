'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Users, Plus, FileSpreadsheet, FileText, Pencil, Trash2, Loader2, UserCheck, UserX, Venus, Mars,
  ImageIcon, Camera, ScanFace, Link2, Copy, Check, X,
} from 'lucide-react'
import { PhotoEditorDialog } from '@/components/photo-editor/photo-editor-dialog'

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
  fakultas: { id: string; nama: string }
}

interface Mahasiswa {
  id: string
  nim: string
  nama: string
  jenisKelamin: string
  tempatLahir: string
  tanggalLahir: string
  alamat: string
  noHp: string
  email: string
  prodiId: string
  prodi: Prodi
  semester: number
  angkatan: number
  status: string
  foto: string | null
  fotoWajah: string | null
  absensiToken: string | null
  createdAt: string
  updatedAt: string
}

interface FormState {
  nim: string
  nama: string
  jenisKelamin: string
  tempatLahir: string
  tanggalLahir: string
  alamat: string
  noHp: string
  email: string
  prodiId: string
  semester: string
  angkatan: string
  status: string
  foto: string
}

const EMPTY_FORM: FormState = {
  nim: '', nama: '', jenisKelamin: 'L', tempatLahir: '', tanggalLahir: '',
  alamat: '', noHp: '', email: '', prodiId: '', semester: '1', angkatan: String(new Date().getFullYear()),
  status: 'AKTIF', foto: '',
}

const STATUS_STYLES: Record<string, string> = {
  AKTIF: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  CUTI: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  LULUS: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  DO: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function MahasiswaView() {
  const [data, setData] = useState<Mahasiswa[]>([])
  const [prodiList, setProdiList] = useState<Prodi[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [deleteTarget, setDeleteTarget] = useState<Mahasiswa | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)

  // === State Daftar Wajah (face registration) ===
  const [wajahTarget, setWajahTarget] = useState<Mahasiswa | null>(null)
  const [wajahFoto, setWajahFoto] = useState<string>('')
  const [wajahSaving, setWajahSaving] = useState(false)

  // === State Link Absensi ===
  const [linkTarget, setLinkTarget] = useState<Mahasiswa | null>(null)
  const [linkGenerating, setLinkGenerating] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mahasiswa')
      if (!res.ok) throw new Error('Gagal memuat data')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data mahasiswa')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProdi = useCallback(async () => {
    try {
      const res = await fetch('/api/prodi')
      if (!res.ok) return
      const json = await res.json()
      setProdiList(json)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchProdi()
  }, [fetchData, fetchProdi])

  // ============ Stats ============
  const stats = useMemo(() => {
    const total = data.length
    const aktif = data.filter((d) => d.status === 'AKTIF').length
    const laki = data.filter((d) => d.jenisKelamin === 'L').length
    const perempuan = data.filter((d) => d.jenisKelamin === 'P').length
    return { total, aktif, laki, perempuan }
  }, [data])

  // ============ Form handlers ============
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setDialogOpen(true)
  }

  const openEdit = (m: Mahasiswa) => {
    setForm({
      nim: m.nim,
      nama: m.nama,
      jenisKelamin: m.jenisKelamin,
      tempatLahir: m.tempatLahir,
      tanggalLahir: m.tanggalLahir ? new Date(m.tanggalLahir).toISOString().slice(0, 10) : '',
      alamat: m.alamat,
      noHp: m.noHp,
      email: m.email,
      prodiId: m.prodiId,
      semester: String(m.semester),
      angkatan: String(m.angkatan),
      status: m.status,
      foto: m.foto ?? '',
    })
    setEditId(m.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!form.nim.trim() || !form.nama.trim() || !form.prodiId || !form.email.trim() || !form.tanggalLahir) {
      toast.error('Lengkapi field wajib (NIM, Nama, Email, Prodi, Tanggal Lahir)')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        semester: Number(form.semester),
        angkatan: Number(form.angkatan),
        foto: form.foto.trim() || null,
      }
      const url = editId ? `/api/mahasiswa/${editId}` : '/api/mahasiswa'
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
      toast.success(editId ? 'Data mahasiswa diperbarui' : 'Mahasiswa berhasil ditambahkan')
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
      const res = await fetch(`/api/mahasiswa/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus')
      toast.success(`Mahasiswa ${deleteTarget.nama} berhasil dihapus`)
      setDeleteTarget(null)
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus data')
    } finally {
      setDeleting(false)
    }
  }

  // ============ Photo editor save ============
  // Saves the cropped base64 foto to the backend immediately (PUT /api/mahasiswa/[id]).
  // Also updates local `data` + `form.foto` so the preview stays in sync without a refetch.
  const handleSavePhoto = async (base64DataUrl: string) => {
    if (!editId) {
      toast.error('Simpan data mahasiswa terlebih dahulu sebelum mengatur foto.')
      return
    }
    setPhotoSaving(true)
    try {
      const res = await fetch(`/api/mahasiswa/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto: base64DataUrl }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan foto')
      // Update local state
      setData(prev => prev.map(m => m.id === editId ? { ...m, foto: base64DataUrl } : m))
      setForm(prev => ({ ...prev, foto: base64DataUrl }))
      toast.success('Foto berhasil diperbarui')
      setPhotoEditorOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan foto')
      throw err  // re-throw so the dialog keeps its loading state honest
    } finally {
      setPhotoSaving(false)
    }
  }

  // ============ Daftar Wajah (face registration) ============
  const openWajahDialog = (m: Mahasiswa) => {
    setWajahTarget(m)
    setWajahFoto(m.fotoWajah ?? '')
  }

  const handleUploadWajah = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar')
      return
    }
    if (file.size > 3_500_000) {
      toast.error('Ukuran gambar terlalu besar (maks ~2.5MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setWajahFoto(reader.result as string)
    reader.onerror = () => toast.error('Gagal membaca file')
    reader.readAsDataURL(file)
  }

  const handleSaveWajah = async () => {
    if (!wajahTarget) return
    if (!wajahFoto) {
      toast.error('Silakan unggah foto wajah terlebih dahulu')
      return
    }
    setWajahSaving(true)
    try {
      const res = await fetch(`/api/mahasiswa/${wajahTarget.id}/daftar-wajah`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoWajah: wajahFoto }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal mendaftarkan wajah')
      setData(prev => prev.map(m => m.id === wajahTarget.id ? { ...m, fotoWajah: wajahFoto } : m))
      toast.success(`Wajah ${wajahTarget.nama} berhasil didaftarkan`)
      setWajahTarget({ ...wajahTarget, fotoWajah: wajahFoto })
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mendaftarkan wajah')
    } finally {
      setWajahSaving(false)
    }
  }

  const handleHapusWajah = async () => {
    if (!wajahTarget) return
    setWajahSaving(true)
    try {
      const res = await fetch(`/api/mahasiswa/${wajahTarget.id}/daftar-wajah`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus wajah')
      setData(prev => prev.map(m => m.id === wajahTarget.id ? { ...m, fotoWajah: null, absensiToken: null } : m))
      toast.success('Foto wajah & link absensi dihapus')
      setWajahTarget({ ...wajahTarget, fotoWajah: null, absensiToken: null })
      setWajahFoto('')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus wajah')
    } finally {
      setWajahSaving(false)
    }
  }

  // ============ Link Absensi Wajah ============
  const openLinkDialog = (m: Mahasiswa) => {
    setLinkTarget(m)
    setLinkCopied(false)
  }

  const handleGenerateLink = async () => {
    if (!linkTarget) return
    setLinkGenerating(true)
    try {
      const res = await fetch(`/api/mahasiswa/${linkTarget.id}/generate-link`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal membuat link')
      setData(prev => prev.map(m => m.id === linkTarget.id ? { ...m, absensiToken: json.token } : m))
      setLinkTarget({ ...linkTarget, absensiToken: json.token })
      toast.success('Link absensi berhasil dibuat')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membuat link')
    } finally {
      setLinkGenerating(false)
    }
  }

  const handleRevokeLink = async () => {
    if (!linkTarget) return
    setLinkGenerating(true)
    try {
      const res = await fetch(`/api/mahasiswa/${linkTarget.id}/generate-link`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal mencabut link')
      setData(prev => prev.map(m => m.id === linkTarget.id ? { ...m, absensiToken: null } : m))
      setLinkTarget({ ...linkTarget, absensiToken: null })
      toast.success('Link absensi dicabut')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mencabut link')
    } finally {
      setLinkGenerating(false)
    }
  }

  const linkUrl = linkTarget?.absensiToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?absensi=wajah&token=${linkTarget.absensiToken}`
    : ''

  const handleCopyLink = async () => {
    if (!linkUrl) return
    try {
      await navigator.clipboard.writeText(linkUrl)
      setLinkCopied(true)
      toast.success('Link disalin ke clipboard')
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      toast.error('Gagal menyalin link')
    }
  }

  // ============ Export ============
  const handleExportCSV = () => {
    if (!data.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }
    const headers = ['NIM', 'Nama', 'JK', 'Tempat Lahir', 'Tanggal Lahir', 'Email', 'No HP', 'Prodi', 'Fakultas', 'Semester', 'Angkatan', 'Status']
    const rows = data.map((d) => [
      d.nim, d.nama, d.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan',
      d.tempatLahir, formatDate(d.tanggalLahir), d.email, d.noHp,
      d.prodi?.nama ?? '-', d.prodi?.fakultas?.nama ?? '-',
      d.semester, d.angkatan, d.status,
    ])
    exportToCSV('data-mahasiswa', headers, rows)
  }

  const handleExportPDF = () => {
    if (!data.length) {
      toast.error('Tidak ada data untuk diexport')
      return
    }
    const headers = ['NIM', 'Nama', 'JK', 'Tempat Lahir', 'Tgl Lahir', 'Email', 'No HP', 'Prodi', 'Fakultas', 'Smt', 'Angkatan', 'Status']
    const rows = data.map((d) => [
      d.nim, d.nama, d.jenisKelamin === 'L' ? 'L' : 'P',
      d.tempatLahir, formatDate(d.tanggalLahir), d.email, d.noHp,
      d.prodi?.nama ?? '-', d.prodi?.fakultas?.nama ?? '-',
      d.semester, d.angkatan, d.status,
    ])
    exportToPDF('Data Mahasiswa', generateTableHTML('Data Mahasiswa', headers, rows))
  }

  // ============ Columns ============
  const columns: Column<Mahasiswa>[] = useMemo(() => [
    {
      key: 'aksi', header: 'Aksi', sortable: false, className: 'text-left',
      render: (m) => (
        <div className="flex items-center justify-start gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openWajahDialog(m)}
            title={m.fotoWajah ? 'Lihat / Edit Wajah Terdaftar' : 'Daftarkan Wajah'}
          >
            <ScanFace className={`w-4 h-4 ${m.fotoWajah ? 'text-emerald-600' : 'text-muted-foreground'}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openLinkDialog(m)}
            title={m.absensiToken ? 'Lihat / Bagikan Link Absensi' : 'Generate Link Absensi'}
            disabled={!m.fotoWajah}
          >
            <Link2 className={`w-4 h-4 ${m.absensiToken ? 'text-primary' : 'text-muted-foreground'}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => setDeleteTarget(m)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    {
      key: 'nim', header: 'NIM', sortable: true, className: 'font-mono text-xs',
    },
    {
      key: 'nama', header: 'Nama', sortable: true,
      render: (m) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="w-9 h-9 border">
            {m.foto ? <AvatarImage src={m.foto} alt={m.nama} /> : null}
            <AvatarFallback className={m.jenisKelamin === 'L' ? 'bg-primary/10 text-primary' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'}>
              {getInitials(m.nama)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium truncate">{m.nama}</p>
            <p className="text-xs text-muted-foreground truncate">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'jenisKelamin', header: 'JK', sortable: true, className: 'text-center',
      render: (m) => (
        <Badge variant="outline" className={m.jenisKelamin === 'L' ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800' : 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800'}>
          {m.jenisKelamin === 'L' ? 'Pria' : 'Wanita'}
        </Badge>
      ),
    },
    {
      key: 'prodi', header: 'Program Studi', sortable: true, sortValue: (m) => m.prodi?.nama ?? '',
      render: (m) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{m.prodi?.nama ?? '-'}</p>
          <p className="text-xs text-muted-foreground truncate">{m.prodi?.fakultas?.nama ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'semester', header: 'Smt', sortable: true, className: 'text-center',
      render: (m) => <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted text-xs font-semibold">{m.semester}</span>,
    },
    {
      key: 'angkatan', header: 'Angkatan', sortable: true, className: 'text-center',
      render: (m) => <span className="text-sm font-medium">{m.angkatan}</span>,
    },
    {
      key: 'status', header: 'Status', sortable: true,
      render: (m) => (
        <Badge variant="outline" className={STATUS_STYLES[m.status] ?? ''}>
          {m.status}
        </Badge>
      ),
    },
  ], [])

  // ============ Stat cards ============
  const statCards = [
    { label: 'Total Mahasiswa', value: stats.total, icon: Users, color: 'from-blue-500 to-blue-600', sub: 'seluruh data' },
    { label: 'Mahasiswa Aktif', value: stats.aktif, icon: UserCheck, color: 'from-emerald-500 to-emerald-600', sub: 'status aktif' },
    { label: 'Laki-laki', value: stats.laki, icon: Mars, color: 'from-cyan-500 to-cyan-600', sub: 'jenis kelamin L' },
    { label: 'Perempuan', value: stats.perempuan, icon: Venus, color: 'from-pink-500 to-pink-600', sub: 'jenis kelamin P' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Mahasiswa"
        description="Kelola data mahasiswa peserta KKN & PLP"
        icon={Users}
        breadcrumb={['Data Master', 'Data Mahasiswa']}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="w-4 h-4" /> Export PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Tambah Mahasiswa
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
          searchKeys={['nim', 'nama', 'email']}
          pageSize={10}
          emptyMessage="Belum ada data mahasiswa. Klik 'Tambah Mahasiswa' untuk menambahkan."
          getRowId={(m) => m.id}
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditId(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Mahasiswa' : 'Tambah Mahasiswa'}</DialogTitle>
            <DialogDescription>
              {editId ? 'Perbarui informasi mahasiswa.' : 'Lengkapi data mahasiswa baru.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nim">NIM <span className="text-rose-500">*</span></Label>
                <Input id="nim" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })} placeholder="22510001" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nama">Nama Lengkap <span className="text-rose-500">*</span></Label>
                <Input id="nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama mahasiswa" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jenisKelamin">Jenis Kelamin <span className="text-rose-500">*</span></Label>
                <Select value={form.jenisKelamin} onValueChange={(v) => setForm({ ...form, jenisKelamin: v })}>
                  <SelectTrigger id="jenisKelamin" className="w-full"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tanggalLahir">Tanggal Lahir <span className="text-rose-500">*</span></Label>
                <Input id="tanggalLahir" type="date" value={form.tanggalLahir} onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tempatLahir">Tempat Lahir</Label>
                <Input id="tempatLahir" value={form.tempatLahir} onChange={(e) => setForm({ ...form, tempatLahir: e.target.value })} placeholder="Jakarta" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="noHp">No. HP</Label>
                <Input id="noHp" value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} placeholder="0812..." />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="email">Email <span className="text-rose-500">*</span></Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="mhs@kknplp.ac.id" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodiId">Program Studi <span className="text-rose-500">*</span></Label>
                <Select value={form.prodiId} onValueChange={(v) => setForm({ ...form, prodiId: v })}>
                  <SelectTrigger id="prodiId" className="w-full"><SelectValue placeholder="Pilih prodi..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {prodiList.length === 0 ? (
                      <SelectItem value="_" disabled>Memuat prodi...</SelectItem>
                    ) : (
                      prodiList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nama} — {p.fakultas?.nama ?? ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AKTIF">AKTIF</SelectItem>
                    <SelectItem value="CUTI">CUTI</SelectItem>
                    <SelectItem value="LULUS">LULUS</SelectItem>
                    <SelectItem value="DO">DO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="semester">Semester</Label>
                <Input id="semester" type="number" min={1} max={14} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="angkatan">Angkatan</Label>
                <Input id="angkatan" type="number" min={2000} max={2100} value={form.angkatan} onChange={(e) => setForm({ ...form, angkatan: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="alamat">Alamat</Label>
                <Textarea id="alamat" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} placeholder="Alamat lengkap" rows={2} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Foto Mahasiswa</Label>
                <div className="flex items-center gap-4 p-3 rounded-lg border border-input bg-muted/30">
                  {/* Thumbnail preview */}
                  <div className="w-20 h-20 rounded-full border-2 border-primary/30 bg-background overflow-hidden flex items-center justify-center shrink-0">
                    {form.foto ? (
                      <img
                        src={form.foto}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-2">
                      Atur posisi & zoom foto secara presisi agar wajah pas di lingkaran ID Card.
                      {!editId && ' (Simpan data mahasiswa dulu sebelum mengatur foto.)'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPhotoEditorOpen(true)}
                        disabled={!editId}
                      >
                        <Camera className="w-4 h-4 mr-1.5" />
                        {form.foto ? 'Atur Ulang Foto' : 'Unggah & Atur Foto'}
                      </Button>
                      {form.foto && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setForm({ ...form, foto: '' })}
                        >
                          Hapus Foto
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editId ? 'Simpan Perubahan' : 'Tambah Mahasiswa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Mahasiswa</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.nama}</strong> ({deleteTarget?.nim})?
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

      {/* Photo editor dialog — lets admin pan/zoom/rotate foto precisely */}
      <PhotoEditorDialog
        open={photoEditorOpen}
        onOpenChange={setPhotoEditorOpen}
        initialFoto={form.foto || null}
        studentName={form.nama}
        onSave={handleSavePhoto}
      />

      {/* === Dialog Daftar Wajah (Face Registration) === */}
      <Dialog open={!!wajahTarget} onOpenChange={(o) => { if (!o) { setWajahTarget(null); setWajahFoto('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-primary" /> Daftar Wajah Mahasiswa
            </DialogTitle>
            <DialogDescription>
              {wajahTarget && (
                <>Daftarkan foto wajah untuk <strong>{wajahTarget.nama}</strong> ({wajahTarget.nim}).<br />
                Foto ini dipakai untuk verifikasi saat mahasiswa melakukan absensi wajah.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview foto wajah */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                {wajahFoto ? (
                  <img src={wajahFoto} alt="Foto wajah" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-muted-foreground p-4">
                    <ScanFace className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Belum ada foto wajah</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 w-full">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <label className="cursor-pointer">
                    <ImageIcon className="w-4 h-4 mr-1.5" />
                    {wajahFoto ? 'Ganti Foto' : 'Unggah Foto'}
                    <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleUploadWajah} />
                  </label>
                </Button>
                {wajahFoto && (
                  <Button variant="outline" size="sm" onClick={() => setWajahFoto('')} disabled={wajahSaving}>
                    <X className="w-4 h-4 mr-1.5" /> Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-foreground">Tips foto wajah:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Pastikan wajah terlihat jelas, tegak, menghadap kamera</li>
                <li>Pencahayaan cukup, tidak gelap/backlight</li>
                <li>Tanpa kacamata gelap / masker / topi yang menutupi wajah</li>
                <li>Ekspresi netral, mulut tertutup</li>
              </ul>
            </div>

            {wajahTarget?.absensiToken && (
              <div className="text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 text-amber-800 dark:text-amber-300">
                ⚠️ Mengubah foto wajah akan memengaruhi verifikasi absensi. Link absensi yang sudah ada tetap aktif.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {wajahTarget?.fotoWajah && (
              <Button variant="outline" onClick={handleHapusWajah} disabled={wajahSaving} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 mr-auto">
                {wajahSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Hapus
              </Button>
            )}
            <Button variant="outline" onClick={() => { setWajahTarget(null); setWajahFoto('') }} disabled={wajahSaving}>
              Tutup
            </Button>
            <Button onClick={handleSaveWajah} disabled={!wajahFoto || wajahSaving}>
              {wajahSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Simpan Wajah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog Link Absensi Wajah === */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => { if (!o) setLinkTarget(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" /> Link Absensi Wajah
            </DialogTitle>
            <DialogDescription>
              {linkTarget && (
                <>Bagikan link ini ke <strong>{linkTarget.nama}</strong> ({linkTarget.nim}). Mahasiswa cukup buka link & lakukan absensi wajah — tidak perlu login.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {linkTarget && !linkTarget.fotoWajah ? (
              <div className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-800 dark:text-amber-300">
                ⚠️ Mahasiswa ini belum mendaftarkan wajah. Silakan daftarkan wajah terlebih dahulu (ikon <ScanFace className="w-4 h-4 inline" /> di kolom Aksi) sebelum membuat link absensi.
              </div>
            ) : linkTarget?.absensiToken ? (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Link Absensi (klik untuk salin)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={linkUrl} className="font-mono text-xs flex-1" onFocus={(e) => e.currentTarget.select()} />
                    <Button size="icon" onClick={handleCopyLink} title="Salin link">
                      {linkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="text-xs bg-muted/40 rounded-lg p-3 space-y-1">
                  <p className="font-semibold text-foreground">Status:</p>
                  <p>✅ Wajah terdaftar</p>
                  <p>✅ Link aktif & dapat dibagikan ke mahasiswa</p>
                  <p className="text-muted-foreground">Mahasiswa dapat absen 1× per hari (status HADIR).</p>
                </div>
              </>
            ) : (
              <div className="text-sm bg-muted/40 rounded-lg p-3 space-y-1">
                <p>Belum ada link aktif. Klik <strong>"Buat Link Absensi"</strong> untuk membuat link unik.</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {linkTarget?.absensiToken && (
              <Button variant="outline" onClick={handleRevokeLink} disabled={linkGenerating} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 mr-auto">
                {linkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Cabut Link
              </Button>
            )}
            <Button variant="outline" onClick={() => setLinkTarget(null)} disabled={linkGenerating}>
              Tutup
            </Button>
            {!linkTarget?.absensiToken && linkTarget?.fotoWajah && (
              <Button onClick={handleGenerateLink} disabled={linkGenerating}>
                {linkGenerating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Buat Link Absensi
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
