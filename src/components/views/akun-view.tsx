'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  UserCog, Plus, FileSpreadsheet, FileText as FilePdf, Pencil, Trash2, Loader2,
  Users, UserCheck, UserX, KeyRound, Power, ShieldCheck,
  Eye, EyeOff, Dices, Info,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// ============ Types ============
type Role = 'SUPER_ADMIN' | 'ADMIN_FAKULTAS' | 'ADMIN_PRODI' | 'DOSEN' | 'MAHASISWA' | 'PIMPINAN'

interface User {
  id: string
  username: string
  email: string | null
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
  username: string
  email: string
  password: string
  role: string
  phone: string
  status: string
}

const EMPTY_FORM: FormState = {
  name: '', username: '', email: '', password: '', role: 'MAHASISWA', phone: '', status: 'AKTIF',
}

// Username: 3-30 chars, lowercase letters/digits/dot/underscore/hyphen. NOT email.
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/

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

// Human-readable description of what each role can access — shown as hint in the form
const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Akses penuh ke SELURUH modul sistem, termasuk Manajemen Akun & Pengaturan.',
  ADMIN_FAKULTAS: 'Panitia tingkat fakultas: kelola mahasiswa, dosen, desa, sekolah, absensi, pembagian, persuratan, penilaian, laporan, agenda, pengumuman, pendaftaran.',
  ADMIN_PRODI: 'Panitia tingkat prodi: kelola mahasiswa, absensi, pembagian, persuratan, penilaian, laporan, agenda, pengumuman, pendaftaran.',
  DOSEN: 'Dosen Pembimbing: lihat dashboard, data mahasiswa bimbingan, absensi, pembagian, penilaian, agenda, pengumuman.',
  MAHASISWA: 'Peserta KKN/PLP: dashboard pribadi, absensi diri, agenda, pengumuman.',
  PIMPINAN: 'Pimpinan institusi: monitor dashboard, data mahasiswa/dosen/desa/sekolah, absensi, pembagian, laporan, agenda, pengumuman.',
}

// Generate a random alphanumeric password (8 chars, easy to communicate)
function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 8; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}

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

  // Password field visibility (Add/Edit dialog)
  const [showPassword, setShowPassword] = useState(false)

  // Reset password dialog: choose default vs custom password
  const [resetMode, setResetMode] = useState<'default' | 'custom'>('default')
  const [resetCustomPassword, setResetCustomPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)

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
    setShowPassword(false)
    setFormOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name,
      username: u.username,
      email: u.email ?? '',
      password: '',
      role: u.role,
      phone: u.phone ?? '',
      status: u.status,
    })
    setShowPassword(false)
    setFormOpen(true)
  }

  // Open the reset password dialog for a user (resets all reset-state)
  const openResetPassword = (u: User) => {
    setResetTarget(u)
    setResetMode('default')
    setResetCustomPassword('')
    setShowResetPassword(false)
  }

  const submitForm = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.role) {
      toast.error('Nama, username, dan role wajib diisi')
      return
    }
    const username = form.username.trim().toLowerCase()
    if (!USERNAME_RE.test(username) || username.includes('@')) {
      toast.error('Username 3-30 karakter, hanya huruf/angka/titik/underscore/tanda hubung. Tidak boleh email.')
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
        username,
        email: form.email.trim() || null,
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
    // Validate custom password if that mode is selected
    if (resetMode === 'custom') {
      if (resetCustomPassword.trim().length < 6) {
        toast.error('Password baru minimal 6 karakter')
        return
      }
    }
    setResetting(true)
    try {
      const body: Record<string, string> = {}
      if (resetMode === 'custom') body.password = resetCustomPassword.trim()
      const res = await fetch(`/api/user/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      toast.success(
        resetMode === 'custom'
          ? `Password ${resetTarget.name} berhasil diubah ke password baru`
          : `Password ${resetTarget.name} direset ke "password123"`
      )
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
    const headers = ['Nama', 'Username', 'Email', 'Role', 'Status', 'Telepon', 'Last Login']
    const rows = filtered.map(u => [
      u.name, u.username, u.email ?? '-', ROLE_LABEL[u.role] ?? u.role, u.status,
      u.phone ?? '-', u.lastLogin ? formatDate(u.lastLogin, true) : '-',
    ])
    exportToCSV('data-akun', headers, rows)
  }

  const handleExportPDF = () => {
    const headers = ['Nama', 'Username', 'Email', 'Role', 'Status', 'Telepon', 'Last Login']
    const rows = filtered.map(u => [
      u.name, u.username, u.email ?? '-', ROLE_LABEL[u.role] ?? u.role, u.status,
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
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20" onClick={() => openResetPassword(u)} title="Reset Password">
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
            <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'username', header: 'Username', sortable: true, className: 'hidden md:table-cell',
      render: (u) => <span className="text-sm font-mono text-muted-foreground">@{u.username}</span>,
    },
    {
      key: 'email', header: 'Email', sortable: false, className: 'hidden lg:table-cell',
      render: (u) => (
        <span className="text-sm text-muted-foreground">{u.email ?? <span className="italic text-muted-foreground/60">—</span>}</span>
      ),
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
          searchKeys={['name', 'username', 'email']}
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
              <Label>Username <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                <Input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="mis. superadmin, admin.fkip, dosen01"
                  className="pl-7 font-mono lowercase"
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Username untuk login. 3-30 karakter, hanya huruf kecil/angka/titik/underscore/tanda hubung. <strong>Tidak boleh format email.</strong>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-muted-foreground text-[11px] font-normal">(opsional)</span></Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com (opsional)"
              />
              <p className="text-[11px] text-muted-foreground">Hanya untuk kontak. Tidak digunakan untuk login.</p>
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
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editing ? 'Kosongkan jika tidak diubah (min 6 karakter)' : 'Min 6 karakter'}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => {
                    const pwd = generatePassword()
                    setForm((prev) => ({ ...prev, password: pwd }))
                    setShowPassword(true)
                    toast.success(`Password dihasilkan: ${pwd}`, { description: 'Pesan password ini ke user yang bersangkutan.' })
                  }}
                  title="Buat password acak"
                >
                  <Dices className="w-4 h-4" /> Acak
                </Button>
              </div>
              {editing
                ? <p className="text-[11px] text-muted-foreground">Kosongkan untuk mempertahankan password lama. Isi untuk mengganti password user.</p>
                : <p className="text-[11px] text-muted-foreground">Minimal 6 karakter. Klik "Acak" untuk membuat password otomatis.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role <span className="text-rose-500">*</span></Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {ROLE_DESCRIPTIONS[form.role] && (
                <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/40 border border-border rounded-md p-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  <span>{ROLE_DESCRIPTIONS[form.role]}</span>
                </div>
              )}
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

      {/* Reset Password dialog — choose default vs custom password */}
      <AlertDialog open={!!resetTarget} onOpenChange={(o) => { if (!o) setResetTarget(null) }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password User</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span>
                Pilih metode reset password untuk <strong>{resetTarget?.name}</strong> (@{resetTarget?.username}).
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-1">
            <RadioGroup
              value={resetMode}
              onValueChange={(v) => setResetMode(v as 'default' | 'custom')}
              className="space-y-2"
            >
              <label htmlFor="reset-default" className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <RadioGroupItem value="default" id="reset-default" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Reset ke password default</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Password akan direset ke <code className="bg-muted px-1 py-0.5 rounded text-[11px]">password123</code>. User disarankan menggantinya setelah login.
                  </p>
                </div>
              </label>
              <label htmlFor="reset-custom" className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <RadioGroupItem value="custom" id="reset-custom" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Atur password baru</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Masukkan password baru (minimal 6 karakter). Cocok untuk memberi password sementara yang mudah diingat.
                  </p>
                </div>
              </label>
            </RadioGroup>

            {resetMode === 'custom' && (
              <div className="space-y-1.5 pl-1">
                <Label className="text-xs">Password Baru</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetCustomPassword}
                      onChange={(e) => setResetCustomPassword(e.target.value)}
                      placeholder="Min 6 karakter"
                      className="pr-9"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      title={showResetPassword ? 'Sembunyikan' : 'Tampilkan'}
                      tabIndex={-1}
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => {
                      const pwd = generatePassword()
                      setResetCustomPassword(pwd)
                      setShowResetPassword(true)
                      toast.success(`Password dihasilkan: ${pwd}`)
                    }}
                    title="Buat password acak"
                  >
                    <Dices className="w-4 h-4" /> Acak
                  </Button>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={resetting || (resetMode === 'custom' && resetCustomPassword.trim().length < 6)}
              className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
            >
              {resetting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1.5" />}
              {resetMode === 'custom' ? 'Atur Password Baru' : 'Reset Password'}
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
              User <strong>{deleteTarget?.name}</strong> (@{deleteTarget?.username}) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
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
