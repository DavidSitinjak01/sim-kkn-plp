'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  UserCog, Plus, FileSpreadsheet, FileText as FilePdf, Pencil, Trash2, Loader2,
  Users, UserCheck, UserX, KeyRound, Power, ShieldCheck,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, generateTableHTML, formatDate,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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

// ============ Types ============
type Role = 'SUPER_ADMIN' | 'ADMIN_FAKULTAS' | 'ADMIN_PRODI' | 'DOSEN' | 'MAHASISWA' | 'PIMPINAN'

interface User {
  id: string
  email: string
  name: string
  role: string
  avatar: string | null
  status: string
  phone: string | null
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

interface FormState {
  name: string
  email: string
  password: string
  role: string
  phone: string
  status: string
}

const EMPTY_FORM: FormState = {
  name: '', email: '', password: '', role: 'MAHASISWA', phone: '', status: 'AKTIF',
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN_FAKULTAS', label: 'Admin Fakultas' },
  { value: 'ADMIN_PRODI', label: 'Admin Prodi' },
  { value: 'DOSEN', label: 'Dosen Pendamping' },
  { value: 'MAHASISWA', label: 'Mahasiswa' },
  { value: 'PIMPINAN', label: 'Pimpinan' },
]

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  ADMIN_FAKULTAS: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  ADMIN_PRODI: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  DOSEN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  MAHASISWA: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  PIMPINAN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
}

const ROLE_LABEL: Record<string, string> = ROLE_OPTIONS.reduce((acc, r) => {
  acc[r.value] = r.label
  return acc
}, {} as Record<string, string>)

// ============ Role Permission Matrix ============
const ALL_MODULES = [
  'Dashboard', 'Mahasiswa', 'Dosen', 'Desa', 'Sekolah', 'Absensi',
  'Pembagian', 'Persuratan', 'Penilaian', 'Akun', 'Laporan',
  'Pengaturan', 'Agenda', 'Pengumuman', 'Aktivitas',
]

// Build access map (true = ✓, false = —) for each role based on MENU_ACCESS logic
const ROLE_PERMISSIONS: Record<Role, boolean[]> = {
  SUPER_ADMIN:    ALL_MODULES.map(() => true),
  ADMIN_FAKULTAS: ALL_MODULES.map((m) => !['Akun', 'Pengaturan', 'Aktivitas'].includes(m)),
  ADMIN_PRODI:    ALL_MODULES.map((m) => ['Dashboard', 'Mahasiswa', 'Absensi', 'Pembagian', 'Persuratan', 'Penilaian', 'Laporan', 'Agenda', 'Pengumuman'].includes(m)),
  DOSEN:          ALL_MODULES.map((m) => ['Dashboard', 'Mahasiswa', 'Absensi', 'Pembagian', 'Penilaian', 'Agenda', 'Pengumuman'].includes(m)),
  MAHASISWA:      ALL_MODULES.map((m) => ['Dashboard', 'Absensi', 'Agenda', 'Pengumuman'].includes(m)),
  PIMPINAN:       ALL_MODULES.map((m) => ['Dashboard', 'Mahasiswa', 'Dosen', 'Desa', 'Sekolah', 'Absensi', 'Pembagian', 'Laporan', 'Agenda', 'Pengumuman'].includes(m)),
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
export function AkunView() {
  const [data, setData] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // Action states
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetting, setResetting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user')
      if (!res.ok) throw new Error('Gagal')
      const json: User[] = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data user')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    return data.filter(u => {
      if (filterRole !== 'ALL' && u.role !== filterRole) return false
      if (filterStatus !== 'ALL' && u.status !== filterStatus) return false
      return true
    })
  }, [data, filterRole, filterStatus])

  const stats = useMemo(() => {
    const total = data.length
    const aktif = data.filter(u => u.status === 'AKTIF').length
    const nonaktif = total - aktif
    const perRole: Record<string, number> = {}
    for (const r of ROLE_OPTIONS) perRole[r.value] = 0
    for (const u of data) {
      if (perRole[u.role] !== undefined) perRole[u.role]++
    }
    return { total, aktif, nonaktif, perRole }
  }, [data])

  // ============ Form handlers ============
  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      phone: u.phone ?? '',
      status: u.status,
    })
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.role) {
      toast.error('Nama, email, dan role wajib diisi')
      return
    }
    if (!editing && !form.password.trim()) {
      toast.error('Password wajib diisi untuk user baru')
      return
    }
    setSubmitting(true)
    try {
      const isEdit = !!editing
      const url = isEdit ? `/api/user/${editing!.id}` : '/api/user'
      const method = isEdit ? 'PUT' : 'POST'
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        phone: form.phone.trim() || null,
        status: form.status,
      }
      // include password only if provided
      if (form.password.trim()) payload.password = form.password.trim()
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan')
      toast.success(isEdit ? 'User diperbarui' : 'User dibuat')
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
      const res = await fetch(`/api/user/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      toast.success(`User ${deleteTarget.name} dihapus`)
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return
    setResetting(true)
    try {
      const res = await fetch(`/api/user/${resetTarget.id}/reset-password`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      toast.success(`Password ${resetTarget.name} direset ke "password123"`)
      setResetTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal reset password')
    } finally {
      setResetting(false)
    }
  }

  const handleToggleStatus = async (u: User) => {
    const next = u.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'
    setTogglingId(u.id)
    try {
      const res = await fetch(`/api/user/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      toast.success(`User ${u.name} ${next === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}`)
      fetchData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengubah status')
    } finally {
      setTogglingId(null)
    }
  }

  // ============ Export ============
  const handleExportCSV = () => {
    const headers = ['Nama', 'Email', 'Role', 'Status', 'Telepon', 'Last Login']
    const rows = filtered.map(u => [
      u.name, u.email, ROLE_LABEL[u.role] ?? u.role, u.status,
      u.phone ?? '-', u.lastLogin ? formatDate(u.lastLogin, true) : '-',
    ])
    exportToCSV('data-akun', headers, rows)
  }

  const handleExportPDF = () => {
    const headers = ['Nama', 'Email', 'Role', 'Status', 'Telepon', 'Last Login']
    const rows = filtered.map(u => [
      u.name, u.email, ROLE_LABEL[u.role] ?? u.role, u.status,
      u.phone ?? '-', u.lastLogin ? formatDate(u.lastLogin, true) : '-',
    ])
    exportToPDF('Daftar Akun User', generateTableHTML('Daftar Akun User', headers, rows))
  }

  // ============ Columns ============
  const columns: Column<User>[] = [
    {
      key: 'aksi', header: 'Aksi', sortable: false, width: '180px',
      render: (u) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(u)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20" onClick={() => setResetTarget(u)} title="Reset Password">
            <KeyRound className="w-4 h-4" />
          </Button>
          <Button
            size="sm" variant="ghost" className="h-8 w-8 p-0"
            onClick={() => handleToggleStatus(u)}
            disabled={togglingId === u.id}
            title={u.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}
          >
            {togglingId === u.id
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Power className={`w-4 h-4 ${u.status === 'AKTIF' ? 'text-emerald-600' : 'text-zinc-400'}`} />}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => setDeleteTarget(u)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    {
      key: 'name', header: 'Nama', sortable: true,
      render: (u) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="w-9 h-9 border">
            {u.avatar ? <AvatarImage src={u.avatar} alt={u.name} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary">{getInitials(u.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium truncate">{u.name}</p>
            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email', header: 'Email', sortable: true, className: 'hidden md:table-cell',
      render: (u) => <span className="text-sm text-muted-foreground">{u.email}</span>,
    },
    {
      key: 'role', header: 'Role', sortable: true,
      render: (u) => (
        <Badge variant="outline" className={ROLE_BADGE[u.role] ?? ''}>
          {ROLE_LABEL[u.role] ?? u.role}
        </Badge>
      ),
    },
    {
      key: 'status', header: 'Status', sortable: true,
      render: (u) => (
        <Badge variant="outline" className={u.status === 'AKTIF'
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}>
          {u.status}
        </Badge>
      ),
    },
    {
      key: 'phone', header: 'Telepon', sortable: false, className: 'hidden lg:table-cell',
      render: (u) => <span className="text-sm">{u.phone ?? <span className="text-muted-foreground">—</span>}</span>,
    },
    {
      key: 'lastLogin', header: 'Last Login', sortable: true, sortValue: (u) => u.lastLogin ? new Date(u.lastLogin).getTime() : 0,
      className: 'hidden xl:table-cell',
      render: (u) => (
        <span className="text-xs text-muted-foreground">
          {u.lastLogin ? formatDate(u.lastLogin, true) : <span className="italic">Belum pernah</span>}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Akun"
        description="Kelola akun pengguna sistem dan hak akses role"
        icon={UserCog}
        breadcrumb={['Sistem', 'Manajemen Akun']}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading}>
              <FilePdf className="w-4 h-4 mr-1.5" />PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />Tambah User
            </Button>
          </div>
        }
      />

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total User" value={stats.total} color="bg-primary/10 text-primary" />
            <StatCard icon={UserCheck} label="Aktif" value={stats.aktif} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" />
            <StatCard icon={UserX} label="Nonaktif" value={stats.nonaktif} color="bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300" />
            <StatCard icon={ShieldCheck} label="Total Role" value={ROLE_OPTIONS.length} color="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300" />
          </div>

          {/* Per-role distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Distribusi per Role</CardTitle>
              <CardDescription className="text-xs">Jumlah pengguna aktif & nonaktif per role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(r => (
                  <Badge key={r.value} variant="outline" className={`py-1.5 px-3 ${ROLE_BADGE[r.value]}`}>
                    {r.label}: <span className="font-bold ml-1">{stats.perRole[r.value] ?? 0}</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Role Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Matriks Hak Akses Role
          </CardTitle>
          <CardDescription>
            Informasi modul yang dapat diakses oleh masing-masing role (✓ = akses, — = tidak ada akses)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Modul</TableHead>
                  {ROLE_OPTIONS.map(r => (
                    <TableHead key={r.value} className="text-center min-w-[110px]">{r.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_MODULES.map((m, idx) => (
                  <TableRow key={m}>
                    <TableCell className="font-medium sticky left-0 bg-background z-10">{m}</TableCell>
                    {ROLE_OPTIONS.map(r => (
                      <TableCell key={r.value} className="text-center">
                        {ROLE_PERMISSIONS[r.value][idx] ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold">✓</span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Role:</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Role</SelectItem>
                {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Status:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="AKTIF">AKTIF</SelectItem>
                <SelectItem value="NONAKTIF">NONAKTIF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(filterRole !== 'ALL' || filterStatus !== 'ALL') && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterRole('ALL'); setFilterStatus('ALL') }}>
              Reset Filter
            </Button>
          )}
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
          searchKeys={['name', 'email']}
          getRowId={(u) => u.id}
          emptyMessage="Belum ada user. Klik 'Tambah User' untuk membuat."
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null) }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Tambah User'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Perbarui informasi akun pengguna.' : 'Buat akun pengguna baru dengan role tertentu.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nama Lengkap <span className="text-rose-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama lengkap user"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-rose-500">*</span></Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@kknplp.ac.id"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telepon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0812..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password {!editing && <span className="text-rose-500">*</span>}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? 'Kosongkan jika tidak diubah (min 6 karakter)' : 'Min 6 karakter'}
              />
              {editing && <p className="text-[11px] text-muted-foreground">Kosongkan untuk mempertahankan password lama.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role <span className="text-rose-500">*</span></Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AKTIF">AKTIF</SelectItem>
                  <SelectItem value="NONAKTIF">NONAKTIF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>Batal</Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {editing ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password confirmation */}
      <AlertDialog open={!!resetTarget} onOpenChange={(o) => { if (!o) setResetTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password User?</AlertDialogTitle>
            <AlertDialogDescription>
              Password user <strong>{resetTarget?.name}</strong> ({resetTarget?.email}) akan direset ke default <code className="bg-muted px-1.5 py-0.5 rounded text-xs">password123</code>. User dapat login kembali dengan password default dan disarankan menggantinya segera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={resetting}
              className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
            >
              {resetting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1.5" />}
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User?</AlertDialogTitle>
            <AlertDialogDescription>
              User <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
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
