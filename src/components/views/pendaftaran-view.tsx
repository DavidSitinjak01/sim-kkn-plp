'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Users, Copy, Check, X, Trash2, Eye, UserPlus, Loader2, Search, Bike,
  Phone, Calendar, GraduationCap, Clock, UserCheck, MoreVertical, Inbox,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'

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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ============ Types (exported for reuse) ============
export interface Pendaftaran {
  id: string
  namaLengkap: string
  nim: string
  prodiId: string | null
  prodiNama: string
  jurusan: string
  jenisKelamin: 'L' | 'P'
  noWa: string
  punyaMotor: boolean
  alamat: string
  foto: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IMPORTED'
  catatan: string | null
  importedMahasiswaId: string | null
  createdAt: string
  updatedAt: string
  prodi?: { id: string; nama: string; jenjang: string; fakultas: { id: string; nama: string } } | null
}

interface Prodi {
  id: string
  kode: string
  nama: string
  jenjang: string
  fakultas: { id: string; nama: string }
}

type StatusFilter = 'SEMUA' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'IMPORTED'

interface ImportFormState {
  tempatLahir: string
  tanggalLahir: string
  email: string
  semester: string
  angkatan: string
  prodiId: string
}

// ============ Constants ============
const STATUS_STYLES: Record<Pendaftaran['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  IMPORTED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
}

const STATUS_LABELS: Record<Pendaftaran['status'], string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  IMPORTED: 'Diimpor',
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'SEMUA', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'IMPORTED', label: 'Diimpor' },
]

// ============ Helpers ============
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDateShort(iso: string) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

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

function StatusBadge({ status }: { status: Pendaftaran['status'] }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

// ============ Sub: Stat Card ============
function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: string
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card>
        <CardContent className="p-3 sm:p-4 flex items-center gap-3">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg sm:text-xl font-bold tracking-tight leading-tight">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============ Sub: Row Actions ============
function RowActions({
  pendaftaran,
  busy,
  onDetail,
  onApprove,
  onReject,
  onImport,
  onDelete,
}: {
  pendaftaran: Pendaftaran
  busy: boolean
  onDetail: (p: Pendaftaran) => void
  onApprove: (p: Pendaftaran) => void
  onReject: (p: Pendaftaran) => void
  onImport: (p: Pendaftaran) => void
  onDelete: (p: Pendaftaran) => void
}) {
  const canApprove = pendaftaran.status === 'PENDING' || pendaftaran.status === 'REJECTED'
  const canReject = pendaftaran.status === 'PENDING' || pendaftaran.status === 'APPROVED'
  const canImport = pendaftaran.status !== 'IMPORTED'
  const canDelete = pendaftaran.status !== 'IMPORTED'

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => onDetail(pendaftaran)}
        disabled={busy}
      >
        <Eye className="w-4 h-4" />
        <span className="hidden sm:inline">Detail</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canApprove && (
            <DropdownMenuItem onClick={() => onApprove(pendaftaran)}>
              <Check className="w-4 h-4 text-emerald-600" /> Setujui
            </DropdownMenuItem>
          )}
          {canReject && (
            <DropdownMenuItem onClick={() => onReject(pendaftaran)}>
              <X className="w-4 h-4 text-rose-600" /> Tolak
            </DropdownMenuItem>
          )}
          {canImport && (
            <DropdownMenuItem onClick={() => onImport(pendaftaran)}>
              <UserPlus className="w-4 h-4 text-sky-600" /> Import ke Mahasiswa
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(pendaftaran)}>
                <Trash2 className="w-4 h-4" /> Hapus
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ============ Main Component ============
export function PendaftaranView() {
  const [list, setList] = useState<Pendaftaran[]>([])
  const [prodiList, setProdiList] = useState<Prodi[]>([])
  const [loading, setLoading] = useState(true)
  const [prodiLoading, setProdiLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('SEMUA')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Dialog states
  const [detail, setDetail] = useState<Pendaftaran | null>(null)
  const [importTarget, setImportTarget] = useState<Pendaftaran | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Pendaftaran | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Pendaftaran | null>(null)

  // Form states
  const [importForm, setImportForm] = useState<ImportFormState>({
    tempatLahir: '', tanggalLahir: '', email: '',
    semester: '6', angkatan: String(new Date().getFullYear()), prodiId: '',
  })
  const [rejectReason, setRejectReason] = useState('')

  // Loading states
  const [importing, setImporting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // ============ Fetchers ============
  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'SEMUA') params.set('status', statusFilter)
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/pendaftaran${qs}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat')
      const json = (await res.json()) as Pendaftaran[]
      setList(Array.isArray(json) ? json : [])
    } catch {
      toast.error('Gagal memuat data pendaftaran')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, debouncedSearch])

  const fetchProdi = useCallback(async () => {
    setProdiLoading(true)
    try {
      const res = await fetch('/api/prodi', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as Prodi[]
      setProdiList(Array.isArray(json) ? json : [])
    } catch {
      // silent
    } finally {
      setProdiLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    fetchProdi()
  }, [fetchProdi])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // ============ Stats (computed from current filtered list for context) ============
  const stats = useMemo(() => {
    // Compute from current list, but better reflect global by re-tallying available items
    const total = list.length
    const pending = list.filter((p) => p.status === 'PENDING').length
    const approved = list.filter((p) => p.status === 'APPROVED').length
    const rejected = list.filter((p) => p.status === 'REJECTED').length
    const imported = list.filter((p) => p.status === 'IMPORTED').length
    return { total, pending, approved, rejected, imported }
  }, [list])

  // ============ Actions ============
  const copyLink = () => {
    try {
      const link = window.location.origin + '/?daftar=true'
      navigator.clipboard.writeText(link)
      toast.success('Link pendaftaran disalin', { description: link })
    } catch {
      toast.error('Gagal menyalin link')
    }
  }

  const handleApprove = async (p: Pendaftaran) => {
    setBusyId(p.id)
    try {
      const res = await fetch(`/api/pendaftaran/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', catatan: '' }),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal menyetujui')
      toast.success(`Pendaftaran ${p.namaLengkap} disetujui`)
      setDetail((d) => (d && d.id === p.id ? { ...d, status: 'APPROVED' } : d))
      fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyetujui pendaftaran')
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (p: Pendaftaran) => {
    setRejectTarget(p)
    setRejectReason(p.catatan ?? '')
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      toast.error('Alasan penolakan wajib diisi')
      return
    }
    setRejecting(true)
    try {
      const res = await fetch(`/api/pendaftaran/${rejectTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', catatan: rejectReason.trim() }),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal menolak')
      toast.success(`Pendaftaran ${rejectTarget.namaLengkap} ditolak`)
      setRejectTarget(null)
      setRejectReason('')
      setDetail((d) => (d && d.id === rejectTarget.id ? { ...d, status: 'REJECTED', catatan: rejectReason.trim() } : d))
      fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menolak pendaftaran')
    } finally {
      setRejecting(false)
    }
  }

  const openImport = (p: Pendaftaran) => {
    setImportTarget(p)
    setImportForm({
      tempatLahir: '',
      tanggalLahir: '',
      email: '',
      semester: '6',
      angkatan: String(new Date().getFullYear()),
      prodiId: p.prodiId ?? '',
    })
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importTarget) return
    if (!importForm.tempatLahir.trim()) return toast.error('Tempat lahir wajib diisi')
    if (!importForm.tanggalLahir) return toast.error('Tanggal lahir wajib diisi')
    if (!importForm.email.trim()) return toast.error('Email wajib diisi')
    if (!importForm.prodiId) return toast.error('Program studi wajib dipilih')

    setImporting(true)
    try {
      const res = await fetch(`/api/pendaftaran/${importTarget.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempatLahir: importForm.tempatLahir.trim(),
          tanggalLahir: importForm.tanggalLahir,
          email: importForm.email.trim(),
          semester: Number(importForm.semester),
          angkatan: Number(importForm.angkatan),
          prodiId: importForm.prodiId,
        }),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal mengimpor')
      toast.success('Berhasil diimpor ke Data Mahasiswa', {
        description: `${importTarget.namaLengkap} kini menjadi mahasiswa aktif`,
      })
      setImportTarget(null)
      setDetail(null)
      fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengimpor pendaftaran')
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/pendaftaran/${deleteTarget.id}`, { method: 'DELETE', cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus')
      toast.success(`Pendaftaran ${deleteTarget.namaLengkap} dihapus`)
      setDeleteTarget(null)
      setDetail(null)
      fetchList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus pendaftaran')
    } finally {
      setDeleting(false)
    }
  }

  // ============ Render ============
  return (
    <div className="space-y-5">
      <PageHeader
        title="Pendaftaran Peserta KKN/PLP"
        description="Kelola pendaftaran calon peserta yang masuk dari form publik"
        icon={Users}
        breadcrumb={['Pendaftaran']}
        actions={
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="w-4 h-4" /> Salin Link Form
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <StatCard icon={Users} label="Total Pendaftar" value={stats.total} color="bg-primary/10 text-primary" />
            <StatCard icon={Clock} label="Menunggu" value={stats.pending} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />
            <StatCard icon={Check} label="Disetujui" value={stats.approved} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
            <StatCard icon={X} label="Ditolak" value={stats.rejected} color="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" />
            <StatCard icon={UserCheck} label="Diimpor" value={stats.imported} color="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" />
          </>
        )}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="w-full sm:w-auto grid grid-cols-5 sm:flex h-auto">
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="text-xs sm:text-sm px-2 sm:px-3">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIM, prodi, jurusan..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Table / List */}
      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Belum ada pendaftaran masuk</p>
              <p className="text-sm text-muted-foreground mt-1">
                {statusFilter !== 'SEMUA' || debouncedSearch
                  ? 'Coba ubah filter atau kata kunci pencarian.'
                  : 'Bagikan link form pendaftaran agar calon peserta dapat mendaftar.'}
              </p>
            </div>
            {statusFilter === 'SEMUA' && !debouncedSearch && (
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="w-4 h-4" /> Salin Link Form
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Pendaftar</TableHead>
                    <TableHead>Prodi &amp; Jurusan</TableHead>
                    <TableHead className="text-center">JK</TableHead>
                    <TableHead>No. WA</TableHead>
                    <TableHead className="text-center">Motor</TableHead>
                    <TableHead>Tgl. Daftar</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="w-9 h-9 border shrink-0">
                            {p.foto ? <AvatarImage src={p.foto} alt={p.namaLengkap} /> : null}
                            <AvatarFallback className="text-xs">
                              {getInitials(p.namaLengkap)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]">{p.namaLengkap}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{p.nim}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-sm truncate max-w-[180px]">{p.prodiNama || '-'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.jurusan || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={p.jenisKelamin === 'L'
                          ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                          : 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800'}>
                          {p.jenisKelamin}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">{p.noWa}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={p.punyaMotor
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-muted text-muted-foreground border-border'}>
                          <Bike className="w-3 h-3 mr-1" />{p.punyaMotor ? 'Ya' : 'Tidak'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDateShort(p.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <RowActions
                          pendaftaran={p}
                          busy={busyId === p.id}
                          onDetail={setDetail}
                          onApprove={handleApprove}
                          onReject={openReject}
                          onImport={openImport}
                          onDelete={setDeleteTarget}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {list.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 border shrink-0">
                      {p.foto ? <AvatarImage src={p.foto} alt={p.namaLengkap} /> : null}
                      <AvatarFallback className="text-xs">{getInitials(p.namaLengkap)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.namaLengkap}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{p.nim}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{p.prodiNama || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate font-mono">{p.noWa}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Bike className="w-3.5 h-3.5 shrink-0" />
                      <span>{p.punyaMotor ? 'Punya motor' : 'Tidak punya motor'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{formatDateShort(p.createdAt)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-end gap-1">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setDetail(p)}>
                      <Eye className="w-4 h-4" /> Detail
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === p.id}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {(p.status === 'PENDING' || p.status === 'REJECTED') && (
                          <DropdownMenuItem onClick={() => handleApprove(p)}>
                            <Check className="w-4 h-4 text-emerald-600" /> Setujui
                          </DropdownMenuItem>
                        )}
                        {(p.status === 'PENDING' || p.status === 'APPROVED') && (
                          <DropdownMenuItem onClick={() => openReject(p)}>
                            <X className="w-4 h-4 text-rose-600" /> Tolak
                          </DropdownMenuItem>
                        )}
                        {p.status !== 'IMPORTED' && (
                          <DropdownMenuItem onClick={() => openImport(p)}>
                            <UserPlus className="w-4 h-4 text-sky-600" /> Import ke Mahasiswa
                          </DropdownMenuItem>
                        )}
                        {p.status !== 'IMPORTED' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>
                              <Trash2 className="w-4 h-4" /> Hapus
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ============ Detail Dialog ============ */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Detail Pendaftaran</DialogTitle>
                <DialogDescription>
                  Data pendaftaran calon peserta KKN/PLP
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="shrink-0 mx-auto sm:mx-0">
                  <div className="w-[150px] h-[200px] rounded-lg overflow-hidden border bg-muted">
                    {detail.foto ? (
                       
                      <img src={detail.foto} alt={detail.namaLengkap} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Users className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex justify-center sm:justify-start">
                    <StatusBadge status={detail.status} />
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <DetailItem label="Nama Lengkap" value={detail.namaLengkap} />
                  <DetailItem label="NIM" value={detail.nim} mono />
                  <DetailItem label="Jenis Kelamin" value={detail.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                  <DetailItem label="No. WhatsApp" value={detail.noWa} mono />
                  <DetailItem label="Prodi" value={detail.prodiNama || '-'} />
                  <DetailItem label="Jurusan" value={detail.jurusan || '-'} />
                  <DetailItem label="Fakultas" value={detail.prodi?.fakultas?.nama ?? '-'} />
                  <DetailItem label="Punya Motor" value={detail.punyaMotor ? 'Ya' : 'Tidak'} />
                  <DetailItem label="Tanggal Daftar" value={formatDateTime(detail.createdAt)} full />
                  <DetailItem label="Alamat" value={detail.alamat || '-'} full />
                  {detail.catatan && (
                    <DetailItem label="Catatan Admin" value={detail.catatan} full />
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => setImportTarget(detail)}
                    disabled={detail.status === 'IMPORTED' || busyId === detail.id}
                  >
                    <UserPlus className="w-4 h-4" /> Import ke Mahasiswa
                  </Button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  {detail.status === 'IMPORTED' ? (
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setDetail(null)}>
                      Tutup
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        onClick={() => openReject(detail)}
                        disabled={busyId === detail.id}
                      >
                        <X className="w-4 h-4" /> Tolak
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(detail)}
                        disabled={detail.status === 'APPROVED' || busyId === detail.id}
                      >
                        {busyId === detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Setujui
                      </Button>
                    </>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ Import Dialog ============ */}
      <Dialog open={!!importTarget} onOpenChange={(o) => { if (!o) setImportTarget(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          {importTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Import ke Data Mahasiswa</DialogTitle>
                <DialogDescription>
                  Lengkapi data tambahan untuk membuat record Mahasiswa baru.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleImport} className="space-y-4">
                {/* Preview from pendaftaran */}
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Data dari Pendaftaran (read-only)
                  </p>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-16 rounded-md overflow-hidden border bg-background shrink-0">
                      {importTarget.foto ? (
                         
                        <img src={importTarget.foto} alt={importTarget.namaLengkap} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Users className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <div><span className="text-muted-foreground">Nama:</span> <span className="font-medium">{importTarget.namaLengkap}</span></div>
                      <div><span className="text-muted-foreground">NIM:</span> <span className="font-mono">{importTarget.nim}</span></div>
                      <div><span className="text-muted-foreground">JK:</span> {importTarget.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</div>
                      <div><span className="text-muted-foreground">No. WA:</span> <span className="font-mono">{importTarget.noWa}</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Alamat:</span> {importTarget.alamat || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Additional fields */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="imp-tempat">Tempat Lahir <span className="text-rose-500">*</span></Label>
                    <Input
                      id="imp-tempat"
                      value={importForm.tempatLahir}
                      onChange={(e) => setImportForm({ ...importForm, tempatLahir: e.target.value })}
                      placeholder="Contoh: Gunungsitoli"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imp-tanggal">Tanggal Lahir <span className="text-rose-500">*</span></Label>
                    <Input
                      id="imp-tanggal"
                      type="date"
                      value={importForm.tanggalLahir}
                      onChange={(e) => setImportForm({ ...importForm, tanggalLahir: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="imp-email">Email <span className="text-rose-500">*</span></Label>
                    <Input
                      id="imp-email"
                      type="email"
                      value={importForm.email}
                      onChange={(e) => setImportForm({ ...importForm, email: e.target.value })}
                      placeholder="mhs@kampus.ac.id"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imp-semester">Semester <span className="text-rose-500">*</span></Label>
                    <Input
                      id="imp-semester"
                      type="number"
                      min={1}
                      max={14}
                      value={importForm.semester}
                      onChange={(e) => setImportForm({ ...importForm, semester: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imp-angkatan">Angkatan <span className="text-rose-500">*</span></Label>
                    <Input
                      id="imp-angkatan"
                      type="number"
                      min={2000}
                      max={2100}
                      value={importForm.angkatan}
                      onChange={(e) => setImportForm({ ...importForm, angkatan: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="imp-prodi">Program Studi <span className="text-rose-500">*</span></Label>
                    <Select
                      value={importForm.prodiId}
                      onValueChange={(v) => setImportForm({ ...importForm, prodiId: v })}
                    >
                      <SelectTrigger id="imp-prodi" className="w-full">
                        <SelectValue placeholder={prodiLoading ? 'Memuat prodi...' : 'Pilih prodi...'} />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {prodiList.length === 0 ? (
                          <SelectItem value="_" disabled>Prodi tidak tersedia</SelectItem>
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
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setImportTarget(null)} disabled={importing}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={importing}>
                    {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
                    Import Mahasiswa
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ Reject Dialog ============ */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason('') } }}>
        <DialogContent className="sm:max-w-md">
          {rejectTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Tolak Pendaftaran</DialogTitle>
                <DialogDescription>
                  Berikan alasan penolakan untuk <strong>{rejectTarget.namaLengkap}</strong> ({rejectTarget.nim}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="reject-reason">Alasan Penolakan <span className="text-rose-500">*</span></Label>
                <Textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Berkas tidak lengkap, NIM sudah terdaftar, dll."
                  rows={4}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason('') }} disabled={rejecting}>
                  Batal
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={rejecting || !rejectReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {rejecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                  Tolak Pendaftaran
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ Delete Dialog ============ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pendaftaran</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pendaftaran <strong>{deleteTarget?.namaLengkap}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete() }}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============ Detail Item helper ============
function DetailItem({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? 'font-mono' : ''} break-words`}>{value || '-'}</p>
    </div>
  )
}

export default PendaftaranView
