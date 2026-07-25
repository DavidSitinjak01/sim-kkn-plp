'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  History, FileSpreadsheet, Loader2, LogIn, Plus, Trash2, Eye, Activity, CalendarClock, User as UserIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, formatDate,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ============ Types ============
interface User {
  id: string; name: string; email: string; role: string
}
interface Aktivitas {
  id: string
  userId: string | null
  user: User | null
  aksi: string
  modul: string
  detail: string | null
  ip: string | null
  createdAt: string
}

const AKSI_OPTIONS = [
  { value: 'ALL', label: 'Semua Aksi' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'VIEW', label: 'View' },
]

function aksiBadge(a: string) {
  const map: Record<string, { cls: string; icon?: React.ReactNode; label: string }> = {
    LOGIN: { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800', icon: <LogIn className="w-3 h-3" />, label: 'Login' },
    CREATE: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: <Plus className="w-3 h-3" />, label: 'Create' },
    UPDATE: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: <History className="w-3 h-3" />, label: 'Update' },
    DELETE: { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800', icon: <Trash2 className="w-3 h-3" />, label: 'Delete' },
    VIEW: { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800', icon: <Eye className="w-3 h-3" />, label: 'View' },
  }
  const m = map[a.toUpperCase()] ?? { cls: 'bg-muted text-muted-foreground border-border', label: a }
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
export function AktivitasView() {
  const [data, setData] = useState<Aktivitas[]>([])
  const [loading, setLoading] = useState(true)
  const [filterModul, setFilterModul] = useState('ALL')
  const [filterAksi, setFilterAksi] = useState('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterModul !== 'ALL') params.set('modul', filterModul)
      if (filterAksi !== 'ALL') params.set('aksi', filterAksi)
      const res = await fetch(`/api/aktivitas?${params.toString()}`)
      if (!res.ok) throw new Error('Gagal')
      const json: Aktivitas[] = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat log aktivitas')
    } finally {
      setLoading(false)
    }
  }, [filterModul, filterAksi])

  useEffect(() => { fetchData() }, [fetchData])

  // Build distinct modul options from data
  const modulOptions = useMemo(() => {
    const set = new Set<string>()
    data.forEach(a => set.add(a.modul))
    return Array.from(set).sort()
  }, [data])

  // Stats (computed from full unfiltered server response)
  // Note: stats computed from filtered set (data already reflects current filters)
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = data.filter(a => new Date(a.createdAt).getTime() >= today.getTime()).length
    return {
      total: data.length,
      hariIni: todayCount,
      login: data.filter(a => a.aksi.toUpperCase() === 'LOGIN').length,
      create: data.filter(a => a.aksi.toUpperCase() === 'CREATE').length,
    }
  }, [data])

  const handleExportCSV = () => {
    const headers = ['Waktu', 'User', 'Aksi', 'Modul', 'Detail', 'IP']
    const rows = data.map(a => [
      formatDate(a.createdAt, true),
      a.user?.name ?? 'Sistem',
      a.aksi, a.modul, a.detail ?? '-', a.ip ?? '-',
    ])
    exportToCSV('log-aktivitas', headers, rows)
  }

  const columns: Column<Aktivitas>[] = [
    {
      key: 'createdAt', header: 'Waktu', sortable: true, sortValue: (a) => new Date(a.createdAt).getTime(),
      render: (a) => (
        <div className="text-xs">
          <p>{formatDate(a.createdAt, true)}</p>
          <p className="text-muted-foreground">{new Date(a.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
        </div>
      ),
    },
    {
      key: 'user', header: 'User', sortable: true, sortValue: (a) => a.user?.name ?? 'Sistem',
      render: (a) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UserIcon className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{a.user?.name ?? 'Sistem'}</p>
            {a.user?.email && <p className="text-[10px] text-muted-foreground truncate">{a.user.email}</p>}
          </div>
        </div>
      ),
    },
    { key: 'aksi', header: 'Aksi', sortable: true, render: (a) => aksiBadge(a.aksi) },
    {
      key: 'modul', header: 'Modul', sortable: true,
      render: (a) => <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs font-mono">{a.modul}</span>,
    },
    {
      key: 'detail', header: 'Detail', sortable: false,
      render: (a) => <span className="text-xs text-muted-foreground line-clamp-1 max-w-md" title={a.detail ?? ''}>{a.detail ?? '-'}</span>,
    },
    {
      key: 'ip', header: 'IP', sortable: true,
      render: (a) => a.ip ? <span className="font-mono text-xs text-muted-foreground">{a.ip}</span> : <span className="text-xs text-muted-foreground">-</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Log Aktivitas"
        description="Riwayat aktivitas pengguna pada sistem (read-only)"
        icon={History}
        breadcrumb={['Informasi', 'Log Aktivitas']}
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />Export Excel
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Activity} label="Total Aktivitas" value={stats.total} color="bg-primary/10 text-primary" />
        <StatCard icon={CalendarClock} label="Hari Ini" value={stats.hariIni} color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" />
        <StatCard icon={LogIn} label="Login" value={stats.login} color="bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" />
        <StatCard icon={Plus} label="Create" value={stats.create} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Modul</Label>
            <Select value={filterModul} onValueChange={setFilterModul}>
              <SelectTrigger className="w-full sm:w-[200px] h-9"><SelectValue placeholder="Semua Modul" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Modul</SelectItem>
                {modulOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Aksi</Label>
            <Select value={filterAksi} onValueChange={setFilterAksi}>
              <SelectTrigger className="w-full sm:w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AKSI_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(filterModul !== 'ALL' || filterAksi !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-auto"
              onClick={() => { setFilterModul('ALL'); setFilterAksi('ALL') }}
            >
              Reset Filter
            </Button>
          )}
          {loading && <div className="flex items-end gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Memuat...</div>}
        </CardContent>
      </Card>

      {/* Data table */}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <DataTable
          data={data}
          columns={columns}
          searchable
          searchKeys={['modul', 'detail', 'ip']}
          pageSize={15}
          getRowId={(a) => a.id}
          emptyMessage="Belum ada aktivitas tercatat"
        />
      )}
    </div>
  )
}
