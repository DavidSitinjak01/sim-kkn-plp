'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ClipboardCheck, Plus, Pencil, Trash2, Loader2, FileSpreadsheet, FileText as FilePdf,
  Award, TrendingUp, Trophy, Users, GraduationCap,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, generateTableHTML,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
interface Prodi { id: string; nama: string }
interface Fakultas { id: string; nama: string }
interface Mahasiswa {
  id: string; nim: string; nama: string; prodi: Prodi & { fakultas: Fakultas } | null
}
interface Dosen {
  id: string; nidn: string; nama: string; jabatan: string
}
interface KelompokMember {
  id: string; kelompokId: string; mahasiswaId: string; mahasiswa: Mahasiswa; createdAt: string
}
interface Kelompok {
  id: string; nama: string; tipe: string; tahunAkademik: string
  semester: string; status: string
  dosenId: string | null; dosen: Dosen | null
  _count?: { members: number }
  members?: KelompokMember[]
}
interface Penilaian {
  id: string
  mahasiswaId: string
  kelompokId: string
  dosenId: string | null
  dosen: Dosen | null
  jenis: string
  aspek: string
  nilai: number
  createdAt: string
  updatedAt: string
  mahasiswa: Mahasiswa
  kelompok: Kelompok
}

const ASPEK_LIST = ['Keaktifan', 'Tanggung Jawab', 'Kerja Sama', 'Keterampilan', 'Laporan Akhir']

const JENIS_OPTIONS = [
  { value: 'ALL', label: 'Semua Jenis' },
  { value: 'KKN', label: 'KKN' },
  { value: 'PLP1', label: 'PLP 1' },
  { value: 'PLP2', label: 'PLP 2' },
]

function jenisBadge(j: string) {
  const map: Record<string, string> = {
    KKN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    PLP1: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    PLP2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${map[j] ?? ''}`}>{j === 'PLP1' ? 'PLP 1' : j === 'PLP2' ? 'PLP 2' : j}</span>
}

function nilaiBadge(n: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) {
    return <span className="text-xs text-muted-foreground">-</span>
  }
  let cls = 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
  if (n >= 85) cls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
  else if (n >= 70) cls = 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800'
  else if (n >= 60) cls = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold ${cls}`}>{n.toFixed(1)}</span>
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

// ============ Mahasiswa Row (pivoted) ============
interface MahasiswaRow {
  key: string
  mahasiswaId: string
  nim: string
  nama: string
  byAspek: Record<string, Penilaian | undefined>
  nilaiAkhir: number | null
  kelompokId: string
}

// ============ Main View ============
export function PenilaianView() {
  const [data, setData] = useState<Penilaian[]>([])
  const [kelompokList, setKelompokList] = useState<Kelompok[]>([])
  const [members, setMembers] = useState<Mahasiswa[]>([])
  const [dosenList, setDosenList] = useState<Dosen[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(false)

  const [filterJenis, setFilterJenis] = useState('ALL')
  const [filterKelompok, setFilterKelompok] = useState('ALL')

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Penilaian | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Penilaian | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [form, setForm] = useState({
    mahasiswaId: '', kelompokId: '', dosenId: '', jenis: 'KKN',
    aspek: ASPEK_LIST[0], nilai: '',
  })

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [kRes, dRes] = await Promise.all([
          fetch('/api/kelompok'),
          fetch('/api/dosen'),
        ])
        if (kRes.ok) setKelompokList(await kRes.json())
        if (dRes.ok) setDosenList(await dRes.json())
      } catch {
        toast.error('Gagal memuat data referensi')
      }
    })()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterJenis !== 'ALL') params.set('jenis', filterJenis)
      if (filterKelompok !== 'ALL') params.set('kelompokId', filterKelompok)
      const res = await fetch(`/api/penilaian?${params.toString()}`)
      if (!res.ok) throw new Error('Gagal')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data penilaian')
    } finally {
      setLoading(false)
    }
  }, [filterJenis, filterKelompok])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch members when filterKelompok changes
  useEffect(() => {
    if (filterKelompok === 'ALL') {
      setMembers([])
      return
    }
    setLoadingMembers(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/kelompok/${filterKelompok}`)
        if (!res.ok) throw new Error('Gagal')
        const json: Kelompok = await res.json()
        setMembers(json.members?.map(m => m.mahasiswa) ?? [])
      } catch {
        toast.error('Gagal memuat anggota kelompok')
      } finally {
        setLoadingMembers(false)
      }
    })()
  }, [filterKelompok])

  // Build pivot rows for "Per Mahasiswa" view
  const pivotRows = useMemo<MahasiswaRow[]>(() => {
    // Determine which mahasiswa to show: if kelompok selected, use members; else use unique mahasiswa in penilaian
    let baseMhs: { id: string; nim: string; nama: string }[] = []
    if (filterKelompok !== 'ALL' && members.length > 0) {
      baseMhs = members.map(m => ({ id: m.id, nim: m.nim, nama: m.nama }))
    } else {
      const map = new Map<string, { id: string; nim: string; nama: string }>()
      data.forEach(p => {
        if (!map.has(p.mahasiswaId)) {
          map.set(p.mahasiswaId, {
            id: p.mahasiswa.id, nim: p.mahasiswa.nim, nama: p.mahasiswa.nama,
          })
        }
      })
      baseMhs = Array.from(map.values())
    }
    // Build penilaian lookup: mahasiswaId -> aspek -> penilaian
    const lookup = new Map<string, Map<string, Penilaian>>()
    data.forEach(p => {
      if (!lookup.has(p.mahasiswaId)) lookup.set(p.mahasiswaId, new Map())
      lookup.get(p.mahasiswaId)!.set(p.aspek, p)
    })
    return baseMhs.map(m => {
      const byAspek: Record<string, Penilaian | undefined> = {}
      let sum = 0, count = 0
      ASPEK_LIST.forEach(a => {
        const p = lookup.get(m.id)?.get(a)
        byAspek[a] = p
        if (p) { sum += p.nilai; count++ }
      })
      return {
        key: m.id,
        mahasiswaId: m.id,
        nim: m.nim,
        nama: m.nama,
        byAspek,
        nilaiAkhir: count > 0 ? sum / count : null,
        kelompokId: filterKelompok !== 'ALL' ? filterKelompok : (data.find(p => p.mahasiswaId === m.id)?.kelompokId ?? ''),
      }
    })
  }, [data, members, filterKelompok])

  // Stats
  const stats = useMemo(() => {
    const total = data.length
    const avg = total > 0 ? data.reduce((a, p) => a + p.nilai, 0) / total : 0
    const max = total > 0 ? Math.max(...data.map(p => p.nilai)) : 0
    const uniqueMhs = new Set(data.map(p => p.mahasiswaId)).size
    return { total, avg, max, uniqueMhs }
  }, [data])

  const openCreate = () => {
    setEditing(null)
    const defaultKelompok = filterKelompok !== 'ALL' ? filterKelompok : (kelompokList[0]?.id ?? '')
    const kel = kelompokList.find(k => k.id === defaultKelompok)
    const defaultJenis = kel?.tipe ?? (filterJenis !== 'ALL' ? filterJenis : 'KKN')
    setForm({
      mahasiswaId: '', kelompokId: defaultKelompok, dosenId: kel?.dosenId ?? '',
      jenis: defaultJenis,
      aspek: ASPEK_LIST[0], nilai: '',
    })
    setFormOpen(true)
  }

  const openEdit = (p: Penilaian) => {
    setEditing(p)
    setForm({
      mahasiswaId: p.mahasiswaId, kelompokId: p.kelompokId, dosenId: p.dosenId ?? '',
      jenis: p.jenis, aspek: p.aspek, nilai: String(p.nilai),
    })
    setFormOpen(true)
  }

  const openEditByMahasiswaAspek = (m: MahasiswaRow, aspek: string) => {
    const existing = m.byAspek[aspek]
    if (existing) {
      openEdit(existing)
    } else {
      setEditing(null)
      setForm({
        mahasiswaId: m.mahasiswaId, kelompokId: m.kelompokId,
        dosenId: kelompokList.find(k => k.id === m.kelompokId)?.dosenId ?? '',
        jenis: kelompokList.find(k => k.id === m.kelompokId)?.tipe ?? 'KKN',
        aspek, nilai: '',
      })
      setFormOpen(true)
    }
  }

  const submitForm = async () => {
    if (!form.mahasiswaId || !form.kelompokId || !form.aspek || form.nilai === '') {
      toast.error('Lengkapi semua field wajib')
      return
    }
    const nilaiNum = Number(form.nilai)
    if (Number.isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      toast.error('Nilai harus angka 0-100')
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/penilaian/${editing.id}` : '/api/penilaian'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mahasiswaId: form.mahasiswaId,
          kelompokId: form.kelompokId,
          dosenId: form.dosenId || null,
          jenis: form.jenis,
          aspek: form.aspek,
          nilai: nilaiNum,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menyimpan')
      }
      toast.success(editing ? 'Penilaian diperbarui' : 'Penilaian ditambahkan')
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
      const res = await fetch(`/api/penilaian/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal')
      toast.success('Penilaian dihapus')
      setDeleteTarget(null)
      fetchData()
    } catch {
      toast.error('Gagal menghapus penilaian')
    } finally {
      setDeleting(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['NIM', 'Nama Mahasiswa', 'Aspek', 'Nilai', 'Jenis', 'Kelompok', 'Dosen']
    const rows = data.map(p => [
      p.mahasiswa.nim, p.mahasiswa.nama, p.aspek, p.nilai,
      p.jenis, p.kelompok?.nama ?? '-', p.dosen?.nama ?? '-',
    ])
    exportToCSV('penilaian', headers, rows)
  }

  const handleExportPDF = () => {
    const headers = ['NIM', 'Nama', 'Aspek', 'Nilai', 'Jenis', 'Kelompok', 'Dosen']
    const rows = data.map(p => [
      p.mahasiswa.nim, p.mahasiswa.nama, p.aspek, p.nilai.toFixed(1),
      p.jenis, p.kelompok?.nama ?? '-', p.dosen?.nama ?? '-',
    ])
    exportToPDF('Daftar Penilaian', generateTableHTML('Daftar Penilaian Mahasiswa', headers, rows))
  }

  // ============ Per Mahasiswa columns ============
  const perMhsColumns: Column<MahasiswaRow>[] = useMemo(() => {
    const cols: Column<MahasiswaRow>[] = [
      { key: 'nim', header: 'NIM', sortable: true, render: (r) => <span className="font-mono text-xs">{r.nim}</span> },
      { key: 'nama', header: 'Nama Mahasiswa', sortable: true, render: (r) => <span className="font-medium">{r.nama}</span> },
    ]
    ASPEK_LIST.forEach(a => {
      cols.push({
        key: `aspek-${a}`, header: a, sortable: false, width: '120px',
        render: (r) => {
          const p = r.byAspek[a]
          return (
            <button
              onClick={() => openEditByMahasiswaAspek(r, a)}
              className="hover:underline"
              title={p ? 'Edit nilai' : `Input nilai ${a}`}
            >
              {p ? nilaiBadge(p.nilai) : <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-xs text-muted-foreground border-dashed">belum</span>}
            </button>
          )
        },
      })
    })
    cols.push({
      key: 'nilaiAkhir', header: 'Nilai Akhir', sortable: true, sortValue: (r) => r.nilaiAkhir ?? -1,
      render: (r) => nilaiBadge(r.nilaiAkhir),
    })
    cols.unshift({
      key: 'aksi', header: 'Aksi', sortable: false, width: '100px',
      render: (r) => (
        <Button size="sm" variant="ghost" className="h-8 px-2 text-amber-600" onClick={() => openEditByMahasiswaAspek(r, ASPEK_LIST[0])}>
          <Pencil className="w-3.5 h-3.5 mr-1" /> Nilai
        </Button>
      ),
    })
    return cols
  }, [data, members, filterKelompok])

  // ============ Per Aspek columns ============
  const perAspekColumns: Column<Penilaian>[] = [
    {
      key: 'aksi', header: 'Aksi', sortable: false, width: '110px',
      render: (p) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-600" onClick={() => openEdit(p)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => setDeleteTarget(p)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    { key: 'mhs', header: 'Mahasiswa', sortable: true, sortValue: (p) => p.mahasiswa.nama, render: (p) => (
      <div>
        <p className="font-medium text-sm">{p.mahasiswa.nama}</p>
        <p className="text-xs text-muted-foreground font-mono">{p.mahasiswa.nim}</p>
      </div>
    ) },
    { key: 'aspek', header: 'Aspek', sortable: true, render: (p) => <span className="text-sm">{p.aspek}</span> },
    { key: 'nilai', header: 'Nilai', sortable: true, render: (p) => nilaiBadge(p.nilai) },
    { key: 'jenis', header: 'Jenis', sortable: true, render: (p) => jenisBadge(p.jenis) },
    { key: 'kelompok', header: 'Kelompok', sortable: true, sortValue: (p) => p.kelompok?.nama ?? '', render: (p) => <span className="text-xs">{p.kelompok?.nama ?? '-'}</span> },
    { key: 'dosen', header: 'Dosen', sortable: true, sortValue: (p) => p.dosen?.nama ?? '', render: (p) => <span className="text-xs">{p.dosen?.nama ?? '-'}</span> },
  ]

  // When form kelompok changes, set jenis from kelompok
  const onFormKelompokChange = (kid: string) => {
    const k = kelompokList.find(x => x.id === kid)
    setForm(f => ({ ...f, kelompokId: kid, jenis: k?.tipe ?? f.jenis, dosenId: k?.dosenId ?? f.dosenId }))
  }

  // Members for form (if form kelompok differs from filterKelompok, fetch them too via api)
  const [formMembers, setFormMembers] = useState<Mahasiswa[]>([])
  useEffect(() => {
    if (!form.kelompokId) {
      setFormMembers([])
      return
    }
    if (form.kelompokId === filterKelompok && members.length > 0) {
      setFormMembers(members)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/kelompok/${form.kelompokId}`)
        if (!res.ok) return
        const json: Kelompok = await res.json()
        if (!cancelled) setFormMembers(json.members?.map(m => m.mahasiswa) ?? [])
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [form.kelompokId, filterKelompok, members])

  return (
    <div>
      <PageHeader
        title="Penilaian Mahasiswa"
        description="Input dan rekap nilai mahasiswa KKN & PLP per aspek penilaian"
        icon={ClipboardCheck}
        breadcrumb={['Operasional', 'Penilaian']}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading}>
              <FilePdf className="w-4 h-4 mr-1.5" />PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />Input Nilai
            </Button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon={ClipboardCheck} label="Total Penilaian" value={stats.total} color="bg-primary/10 text-primary" />
        <StatCard icon={TrendingUp} label="Rata-rata Nilai" value={stats.total > 0 ? stats.avg.toFixed(1) : '-'} color="bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" />
        <StatCard icon={Trophy} label="Nilai Tertinggi" value={stats.total > 0 ? stats.max.toFixed(1) : '-'} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" />
        <StatCard icon={Users} label="Mahasiswa Dinilai" value={stats.uniqueMhs} color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" />
      </div>

      {/* Filter */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Jenis</Label>
            <Select value={filterJenis} onValueChange={setFilterJenis}>
              <SelectTrigger className="w-full sm:w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {JENIS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Kelompok</Label>
            <Select value={filterKelompok} onValueChange={setFilterKelompok}>
              <SelectTrigger className="w-full sm:w-[240px] h-9"><SelectValue placeholder="Semua Kelompok" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Kelompok</SelectItem>
                {kelompokList.map(k => (
                  <SelectItem key={k.id} value={k.id}>{k.nama} ({k.tipe})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loadingMembers && <div className="flex items-end gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Memuat anggota...</div>}
        </CardContent>
      </Card>

      <Tabs defaultValue="per-mhs">
        <TabsList className="mb-4">
          <TabsTrigger value="per-mhs"><Users className="w-4 h-4 mr-2" />Per Mahasiswa</TabsTrigger>
          <TabsTrigger value="per-aspek"><Award className="w-4 h-4 mr-2" />Per Aspek</TabsTrigger>
        </TabsList>

        <TabsContent value="per-mhs">
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DataTable
              data={pivotRows}
              columns={perMhsColumns}
              searchable
              searchKeys={['nim', 'nama']}
              getRowId={(r) => r.key}
              pageSize={10}
              emptyMessage="Belum ada data mahasiswa"
            />
          )}
        </TabsContent>

        <TabsContent value="per-aspek">
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DataTable
              data={data}
              columns={perAspekColumns}
              searchable
              searchKeys={['aspek']}
              getRowId={(p) => p.id}
              pageSize={10}
              emptyMessage="Belum ada data penilaian"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Input Nilai Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Penilaian' : 'Input Nilai'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Perbarui nilai mahasiswa.' : 'Tambah penilaian mahasiswa per aspek.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Kelompok <span className="text-rose-500">*</span></Label>
              <Select value={form.kelompokId} onValueChange={onFormKelompokChange}>
                <SelectTrigger><SelectValue placeholder="Pilih kelompok" /></SelectTrigger>
                <SelectContent>
                  {kelompokList.map(k => <SelectItem key={k.id} value={k.id}>{k.nama} ({k.tipe})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mahasiswa <span className="text-rose-500">*</span></Label>
              <Select value={form.mahasiswaId} onValueChange={(v) => setForm({ ...form, mahasiswaId: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih mahasiswa" /></SelectTrigger>
                <SelectContent>
                  {formMembers.length === 0 ? (
                    <SelectItem value="_empty" disabled>Pilih kelompok dahulu</SelectItem>
                  ) : (
                    formMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.nim} - {m.nama}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Aspek <span className="text-rose-500">*</span></Label>
                <Select value={form.aspek} onValueChange={(v) => setForm({ ...form, aspek: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASPEK_LIST.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nilai (0-100) <span className="text-rose-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={form.nilai}
                  onChange={(e) => setForm({ ...form, nilai: e.target.value })}
                  placeholder="0-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jenis</Label>
                <Input value={form.jenis} disabled className="bg-muted/50 font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label>Dosen Penilai</Label>
                <Select value={form.dosenId} onValueChange={(v) => setForm({ ...form, dosenId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih dosen" /></SelectTrigger>
                  <SelectContent>
                    {dosenList.map(d => <SelectItem key={d.id} value={d.id}>{d.nama} ({d.nidn})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <GraduationCap className="w-4 h-4 mr-1.5" />}
              {editing ? 'Simpan' : 'Simpan Nilai'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Penilaian?</AlertDialogTitle>
            <AlertDialogDescription>
              Penilaian untuk <strong>{deleteTarget?.mahasiswa.nama}</strong> aspek <strong>{deleteTarget?.aspek}</strong> akan dihapus permanen.
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
