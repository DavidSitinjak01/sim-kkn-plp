'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  FileBarChart, Users, GraduationCap, MapPin, School, CalendarCheck,
  GitBranch, FileText, ClipboardCheck, Loader2, FileSpreadsheet,
  Printer, BarChart3, Sparkles, CalendarRange, Filter as FilterIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, printData, generateTableHTML,
  formatDate, formatDateShort,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ============ Report type metadata ============
type ReportType =
  | 'mahasiswa' | 'dosen' | 'desa' | 'sekolah'
  | 'absensi' | 'penempatan' | 'persuratan' | 'nilai'

interface ReportMeta {
  key: ReportType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  hasDateFilter: boolean
  extraFilter?: 'kelompok' | 'jenis' | 'tipe' | 'status'
}

const REPORT_TYPES: ReportMeta[] = [
  { key: 'mahasiswa', label: 'Mahasiswa', description: 'Data lengkap mahasiswa peserta KKN & PLP', icon: Users, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300', hasDateFilter: false },
  { key: 'dosen', label: 'Dosen', description: 'Daftar dosen pembimbing lapangan', icon: GraduationCap, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300', hasDateFilter: false },
  { key: 'desa', label: 'Desa KKN', description: 'Lokasi desa tempat KKN', icon: MapPin, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300', hasDateFilter: false },
  { key: 'sekolah', label: 'Sekolah PLP', description: 'Sekolah tempat PLP 1 & 2', icon: School, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300', hasDateFilter: false },
  { key: 'absensi', label: 'Absensi', description: 'Rekap kehadiran mahasiswa', icon: CalendarCheck, color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300', hasDateFilter: true, extraFilter: 'kelompok' },
  { key: 'penempatan', label: 'Penempatan', description: 'Pembagian kelompok KKN & PLP', icon: GitBranch, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300', hasDateFilter: false, extraFilter: 'tipe' },
  { key: 'persuratan', label: 'Persuratan', description: 'Arsip surat menyurat', icon: FileText, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300', hasDateFilter: true, extraFilter: 'status' },
  { key: 'nilai', label: 'Nilai', description: 'Rekap penilaian mahasiswa', icon: ClipboardCheck, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300', hasDateFilter: false, extraFilter: 'jenis' },
]

// ============ Types for each report ============
interface ProdiLite { id: string; kode: string; nama: string; jenjang: string }
interface FakultasLite { id: string; kode: string; nama: string }
interface MahasiswaRow {
  id: string; nim: string; nama: string; jenisKelamin: string
  prodi: ProdiLite & { fakultas: FakultasLite } | null
  semester: number; angkatan: number; status: string
}
interface DosenRow {
  id: string; nidn: string; nama: string; jabatan: string; status: string
  fakultas: FakultasLite | null; prodi: ProdiLite | null
}
interface DesaRow {
  id: string; nama: string; kecamatan: string; kabupaten: string; provinsi: string
  kuota: number; _count: { kelompok: number }
}
interface SekolahRow {
  id: string; nama: string; jenjang: string; kecamatan: string; kabupaten: string
  kepalaSekolah: string; kuota: number; _count: { kelompok: number }
}
interface AbsensiRow {
  id: string; tanggal: string; jamMasuk: string | null; jamPulang: string | null; status: string
  mahasiswa: { nim: string; nama: string; prodi: ProdiLite | null }
  kelompok: { id: string; nama: string; tipe: string }
}
interface PenempatanRow {
  id: string; nama: string; tipe: string; tahunAkademik: string; semester: string; status: string
  desa: { nama: string; kecamatan: string; kabupaten: string } | null
  sekolah: { nama: string; jenjang: string } | null
  dosen: { nama: string; nidn: string } | null
  _count: { members: number }
}
interface PersuratanRow {
  id: string; nomor: string; jenis: string; perihal: string; tanggal: string; status: string; pemohon: string
}
interface NilaiRow {
  id: string; aspek: string; nilai: number; jenis: string
  mahasiswa: { nim: string; nama: string; prodi: ProdiLite | null }
  kelompok: { nama: string; tipe: string }
  dosen: { nama: string; nidn: string } | null
}
interface KelompokLite {
  id: string; nama: string; tipe: string; tahunAkademik: string; semester: string
}

// ============ Helpers ============
function jkBadge(jk: string) {
  const isP = jk === 'P'
  return (
    <Badge variant="outline" className={isP
      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border-pink-200 dark:border-pink-800'
      : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800'}>
      {isP ? 'Perempuan' : 'Laki-laki'}
    </Badge>
  )
}

function statusBadge(s: string, kind: 'user' | 'default' = 'default') {
  const palettes: Record<string, string> = {
    AKTIF: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    NONAKTIF: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    LULUS: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    CUTI: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    DO: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    SELESAI: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  }
  const cls = palettes[s] ?? 'bg-muted text-muted-foreground border-border'
  return <Badge variant="outline" className={cls}>{s}</Badge>
}

function formatTime(d: string | null) {
  if (!d) return <span className="text-muted-foreground">—</span>
  return <span className="font-mono text-xs">{new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
}

function formatTanggal(d: string) {
  return <span className="text-xs text-muted-foreground">{formatDateShort(d)}</span>
}

function nilaiBadge(n: number) {
  const cls = n >= 85 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    : n >= 70 ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800'
    : n >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
  return <Badge variant="outline" className={cls}>{n.toFixed(1)}</Badge>
}

function tipeBadge(t: string) {
  const map: Record<string, string> = {
    KKN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    PLP1: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    PLP2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  }
  return <Badge variant="outline" className={map[t] ?? ''}>{t}</Badge>
}

function jenisSuratBadge(j: string) {
  const map: Record<string, string> = {
    TUGAS: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    PENGANTAR: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    IZIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    PENEMPATAN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    BALASAN: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    SELESAI: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  }
  return <Badge variant="outline" className={map[j] ?? ''}>{j}</Badge>
}

function statusSuratBadge(s: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    DIKIRIM: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    SELESAI: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  }
  return <Badge variant="outline" className={map[s] ?? ''}>{s}</Badge>
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
export function LaporanView() {
  const [selected, setSelected] = useState<ReportType | null>(null)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  // Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [kelompokList, setKelompokList] = useState<KelompokLite[]>([])
  const [filterKelompok, setFilterKelompok] = useState('ALL')
  const [filterJenis, setFilterJenis] = useState('ALL')
  const [filterTipe, setFilterTipe] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')

  // Fetch kelompok list once for the absensi filter
  const fetchKelompok = useCallback(async () => {
    try {
      const res = await fetch('/api/kelompok')
      if (!res.ok) return
      const json: KelompokLite[] = await res.json()
      setKelompokList(json)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => { fetchKelompok() }, [fetchKelompok])

  const meta = useMemo(() => REPORT_TYPES.find(r => r.key === selected) ?? null, [selected])

  const buildQuery = useCallback(() => {
    if (!selected) return ''
    const p = new URLSearchParams()
    p.set('type', selected)
    if (meta?.hasDateFilter) {
      if (fromDate) p.set('from', fromDate)
      if (toDate) p.set('to', toDate)
    }
    if (selected === 'absensi' && filterKelompok !== 'ALL') p.set('kelompokId', filterKelompok)
    if (selected === 'penempatan' && filterTipe !== 'ALL') p.set('tipe', filterTipe)
    if (selected === 'persuratan' && filterStatus !== 'ALL') p.set('status', filterStatus)
    if (selected === 'persuratan' && filterJenis !== 'ALL') p.set('jenis', filterJenis)
    if (selected === 'nilai' && filterJenis !== 'ALL') p.set('jenis', filterJenis)
    if (selected === 'nilai' && filterKelompok !== 'ALL') p.set('kelompokId', filterKelompok)
    return p.toString()
  }, [selected, meta, fromDate, toDate, filterKelompok, filterJenis, filterTipe, filterStatus])

  const handleGenerate = async () => {
    if (!selected) return
    setLoading(true)
    setGenerated(false)
    try {
      const res = await fetch(`/api/laporan?${buildQuery()}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Gagal memuat laporan')
      }
      const json = await res.json()
      setData(json)
      setGenerated(true)
      toast.success(`Laporan ${meta?.label} berhasil dibuat (${json.length} data)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat laporan')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  // Reset filters when changing report type
  const handleSelect = (key: ReportType) => {
    setSelected(key)
    setData([])
    setGenerated(false)
    setFromDate(''); setToDate('')
    setFilterKelompok('ALL'); setFilterJenis('ALL'); setFilterTipe('ALL'); setFilterStatus('ALL')
  }

  // ============ Stats per type ============
  const stats = useMemo(() => {
    if (!data.length) return []
    switch (selected) {
      case 'mahasiswa': {
        const mhs = data as MahasiswaRow[]
        const aktif = mhs.filter(m => m.status === 'AKTIF').length
        const lk = mhs.filter(m => m.jenisKelamin === 'L').length
        const pr = mhs.filter(m => m.jenisKelamin === 'P').length
        return [
          { label: 'Total Mahasiswa', value: mhs.length, icon: Users, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
          { label: 'Aktif', value: aktif, icon: Users, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
          { label: 'Laki-laki', value: lk, icon: Users, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' },
          { label: 'Perempuan', value: pr, icon: Users, color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300' },
        ]
      }
      case 'dosen': {
        const ds = data as DosenRow[]
        const aktif = ds.filter(d => d.status === 'AKTIF').length
        const fakultasSet = new Set(ds.map(d => d.fakultas?.nama).filter(Boolean))
        const prodiSet = new Set(ds.map(d => d.prodi?.nama).filter(Boolean))
        return [
          { label: 'Total Dosen', value: ds.length, icon: GraduationCap, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
          { label: 'Aktif', value: aktif, icon: GraduationCap, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
          { label: 'Fakultas', value: fakultasSet.size, icon: GraduationCap, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' },
          { label: 'Prodi Covered', value: prodiSet.size, icon: GraduationCap, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
        ]
      }
      case 'desa': {
        const ds = data as DesaRow[]
        const totalKuota = ds.reduce((s, d) => s + (d.kuota || 0), 0)
        const totalKelompok = ds.reduce((s, d) => s + (d._count?.kelompok ?? 0), 0)
        const kabSet = new Set(ds.map(d => d.kabupaten))
        return [
          { label: 'Total Desa', value: ds.length, icon: MapPin, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
          { label: 'Total Kuota', value: totalKuota, icon: MapPin, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
          { label: 'Kelompok Aktif', value: totalKelompok, icon: GitBranch, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
          { label: 'Kabupaten', value: kabSet.size, icon: MapPin, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' },
        ]
      }
      case 'sekolah': {
        const ss = data as SekolahRow[]
        const totalKuota = ss.reduce((s, x) => s + (x.kuota || 0), 0)
        const totalKelompok = ss.reduce((s, x) => s + (x._count?.kelompok ?? 0), 0)
        const jenjangSet = new Set(ss.map(x => x.jenjang))
        return [
          { label: 'Total Sekolah', value: ss.length, icon: School, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' },
          { label: 'Total Kuota', value: totalKuota, icon: School, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
          { label: 'Kelompok Aktif', value: totalKelompok, icon: GitBranch, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
          { label: 'Jenjang', value: jenjangSet.size, icon: School, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
        ]
      }
      case 'absensi': {
        const abs = data as AbsensiRow[]
        const hadir = abs.filter(a => a.status === 'HADIR').length
        const izinSakit = abs.filter(a => a.status === 'IZIN' || a.status === 'SAKIT').length
        const alpha = abs.filter(a => a.status === 'ALPHA').length
        const persen = abs.length > 0 ? Math.round((hadir / abs.length) * 100) : 0
        return [
          { label: 'Total Absensi', value: abs.length, icon: CalendarCheck, color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' },
          { label: 'Hadir', value: hadir, icon: CalendarCheck, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
          { label: 'Izin / Sakit', value: izinSakit, icon: CalendarCheck, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
          { label: 'Kehadiran %', value: `${persen}%`, icon: BarChart3, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
        ]
      }
      case 'penempatan': {
        const ps = data as PenempatanRow[]
        const kkn = ps.filter(p => p.tipe === 'KKN').length
        const plp = ps.filter(p => p.tipe !== 'KKN').length
        const totalAnggota = ps.reduce((s, p) => s + (p._count?.members ?? 0), 0)
        return [
          { label: 'Total Kelompok', value: ps.length, icon: GitBranch, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300' },
          { label: 'KKN', value: kkn, icon: GitBranch, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
          { label: 'PLP', value: plp, icon: GitBranch, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' },
          { label: 'Total Anggota', value: totalAnggota, icon: Users, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
        ]
      }
      case 'persuratan': {
        const ss = data as PersuratanRow[]
        const selesai = ss.filter(s => s.status === 'SELESAI').length
        const draft = ss.filter(s => s.status === 'DRAFT').length
        const dikirim = ss.filter(s => s.status === 'DIKIRIM').length
        return [
          { label: 'Total Surat', value: ss.length, icon: FileText, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' },
          { label: 'Selesai', value: selesai, icon: FileText, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
          { label: 'Dikirim', value: dikirim, icon: FileText, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
          { label: 'Draft', value: draft, icon: FileText, color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300' },
        ]
      }
      case 'nilai': {
        const ns = data as NilaiRow[]
        const avg = ns.length > 0 ? (ns.reduce((s, n) => s + (n.nilai || 0), 0) / ns.length) : 0
        const max = ns.length > 0 ? Math.max(...ns.map(n => n.nilai || 0)) : 0
        const min = ns.length > 0 ? Math.min(...ns.map(n => n.nilai || 0)) : 0
        return [
          { label: 'Total Penilaian', value: ns.length, icon: ClipboardCheck, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300' },
          { label: 'Rata-rata', value: avg.toFixed(1), icon: BarChart3, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
          { label: 'Tertinggi', value: max.toFixed(1), icon: ClipboardCheck, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
          { label: 'Terendah', value: min.toFixed(1), icon: ClipboardCheck, color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' },
        ]
      }
      default:
        return []
    }
  }, [data, selected])

  // ============ Column definitions per type ============
  const columns: Column<any>[] = useMemo(() => {
    switch (selected) {
      case 'mahasiswa': {
        const c: Column<MahasiswaRow>[] = [
          { key: 'nim', header: 'NIM', sortable: true, className: 'font-mono text-xs' },
          { key: 'nama', header: 'Nama', sortable: true,
            render: (m) => <span className="font-medium">{m.nama}</span> },
          { key: 'jenisKelamin', header: 'JK', sortable: true, render: (m) => jkBadge(m.jenisKelamin) },
          { key: 'prodi', header: 'Prodi', sortable: true, sortValue: (m) => m.prodi?.nama ?? '',
            render: (m) => <span className="text-sm">{m.prodi?.nama ?? '-'}</span> },
          { key: 'fakultas', header: 'Fakultas', sortable: true, sortValue: (m) => m.prodi?.fakultas?.nama ?? '',
            render: (m) => <span className="text-sm text-muted-foreground">{m.prodi?.fakultas?.nama ?? '-'}</span> },
          { key: 'semester', header: 'Semester', sortable: true, render: (m) => <span className="text-sm">{m.semester}</span> },
          { key: 'angkatan', header: 'Angkatan', sortable: true, render: (m) => <span className="text-sm">{m.angkatan}</span> },
          { key: 'status', header: 'Status', sortable: true, render: (m) => statusBadge(m.status) },
        ]
        return c as Column<any>[]
      }
      case 'dosen': {
        const c: Column<DosenRow>[] = [
          { key: 'nidn', header: 'NIDN', sortable: true, className: 'font-mono text-xs' },
          { key: 'nama', header: 'Nama', sortable: true, render: (d) => <span className="font-medium">{d.nama}</span> },
          { key: 'fakultas', header: 'Fakultas', sortable: true, sortValue: (d) => d.fakultas?.nama ?? '',
            render: (d) => <span className="text-sm">{d.fakultas?.nama ?? '-'}</span> },
          { key: 'prodi', header: 'Prodi', sortable: true, sortValue: (d) => d.prodi?.nama ?? '',
            render: (d) => <span className="text-sm">{d.prodi?.nama ?? '-'}</span> },
          { key: 'jabatan', header: 'Jabatan', sortable: true, render: (d) => <span className="text-sm">{d.jabatan}</span> },
          { key: 'status', header: 'Status', sortable: true, render: (d) => statusBadge(d.status) },
        ]
        return c as Column<any>[]
      }
      case 'desa': {
        const c: Column<DesaRow>[] = [
          { key: 'nama', header: 'Nama', sortable: true, render: (d) => <span className="font-medium">{d.nama}</span> },
          { key: 'kecamatan', header: 'Kecamatan', sortable: true, render: (d) => <span className="text-sm">{d.kecamatan}</span> },
          { key: 'kabupaten', header: 'Kabupaten', sortable: true, render: (d) => <span className="text-sm">{d.kabupaten}</span> },
          { key: 'provinsi', header: 'Provinsi', sortable: true, render: (d) => <span className="text-sm text-muted-foreground">{d.provinsi}</span> },
          { key: 'kuota', header: 'Kuota', sortable: true, render: (d) => <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800">{d.kuota}</Badge> },
          { key: 'kelompok', header: 'Kelompok', sortable: true, sortValue: (d) => d._count?.kelompok ?? 0,
            render: (d) => <Badge variant="outline" className={d._count?.kelompok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : ''}>{d._count?.kelompok ?? 0}</Badge> },
        ]
        return c as Column<any>[]
      }
      case 'sekolah': {
        const c: Column<SekolahRow>[] = [
          { key: 'nama', header: 'Nama', sortable: true, render: (s) => <span className="font-medium">{s.nama}</span> },
          { key: 'jenjang', header: 'Jenjang', sortable: true, render: (s) => <Badge variant="outline" className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800">{s.jenjang}</Badge> },
          { key: 'kecamatan', header: 'Kecamatan', sortable: true, render: (s) => <span className="text-sm">{s.kecamatan}</span> },
          { key: 'kabupaten', header: 'Kabupaten', sortable: true, render: (s) => <span className="text-sm">{s.kabupaten}</span> },
          { key: 'kepalaSekolah', header: 'Kepala Sekolah', sortable: true, render: (s) => <span className="text-sm">{s.kepalaSekolah}</span> },
          { key: 'kuota', header: 'Kuota', sortable: true, render: (s) => <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800">{s.kuota}</Badge> },
        ]
        return c as Column<any>[]
      }
      case 'absensi': {
        const c: Column<AbsensiRow>[] = [
          { key: 'mahasiswa', header: 'Mahasiswa', sortable: true, sortValue: (a) => a.mahasiswa?.nama ?? '',
            render: (a) => (
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{a.mahasiswa?.nama ?? '-'}</p>
                <p className="text-xs text-muted-foreground font-mono">{a.mahasiswa?.nim ?? '-'}</p>
              </div>
            ) },
          { key: 'kelompok', header: 'Kelompok', sortable: true, sortValue: (a) => a.kelompok?.nama ?? '',
            render: (a) => (
              <div className="min-w-0">
                <p className="text-sm truncate">{a.kelompok?.nama ?? '-'}</p>
                <span className="inline-block mt-0.5">{a.kelompok && tipeBadge(a.kelompok.tipe)}</span>
              </div>
            ) },
          { key: 'tanggal', header: 'Tanggal', sortable: true, sortValue: (a) => new Date(a.tanggal).getTime(),
            render: (a) => formatTanggal(a.tanggal) },
          { key: 'jamMasuk', header: 'Jam Masuk', sortable: false, render: (a) => formatTime(a.jamMasuk) },
          { key: 'jamPulang', header: 'Jam Pulang', sortable: false, render: (a) => formatTime(a.jamPulang) },
          { key: 'status', header: 'Status', sortable: true,
            render: (a) => {
              const cls = a.status === 'HADIR' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : a.status === 'IZIN' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : a.status === 'SAKIT' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              return <Badge variant="outline" className={cls}>{a.status}</Badge>
            } },
        ]
        return c as Column<any>[]
      }
      case 'penempatan': {
        const c: Column<PenempatanRow>[] = [
          { key: 'nama', header: 'Kelompok', sortable: true, render: (p) => <span className="font-medium">{p.nama}</span> },
          { key: 'tipe', header: 'Tipe', sortable: true, render: (p) => tipeBadge(p.tipe) },
          { key: 'lokasi', header: 'Lokasi', sortable: false,
            render: (p) => (
              <span className="text-sm">
                {p.desa ? `${p.desa.nama} — ${p.desa.kabupaten}`
                  : p.sekolah ? `${p.sekolah.nama} (${p.sekolah.jenjang})`
                  : <span className="text-muted-foreground">—</span>}
              </span>
            ) },
          { key: 'dosen', header: 'Dosen', sortable: false,
            render: (p) => (
              <div className="min-w-0">
                <p className="text-sm truncate">{p.dosen?.nama ?? <span className="text-muted-foreground">—</span>}</p>
                {p.dosen && <p className="text-xs text-muted-foreground font-mono">{p.dosen.nidn}</p>}
              </div>
            ) },
          { key: 'members', header: 'Anggota', sortable: true, sortValue: (p) => p._count?.members ?? 0,
            render: (p) => <Badge variant="outline" className="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800">{p._count?.members ?? 0}</Badge> },
        ]
        return c as Column<any>[]
      }
      case 'persuratan': {
        const c: Column<PersuratanRow>[] = [
          { key: 'nomor', header: 'Nomor', sortable: true, className: 'font-mono text-xs',
            render: (s) => <span className="font-mono text-xs">{s.nomor}</span> },
          { key: 'jenis', header: 'Jenis', sortable: true, render: (s) => jenisSuratBadge(s.jenis) },
          { key: 'perihal', header: 'Perihal', sortable: true,
            render: (s) => <span className="text-sm line-clamp-1 max-w-[280px]">{s.perihal}</span> },
          { key: 'tanggal', header: 'Tanggal', sortable: true, sortValue: (s) => new Date(s.tanggal).getTime(),
            render: (s) => formatTanggal(s.tanggal) },
          { key: 'status', header: 'Status', sortable: true, render: (s) => statusSuratBadge(s.status) },
        ]
        return c as Column<any>[]
      }
      case 'nilai': {
        const c: Column<NilaiRow>[] = [
          { key: 'mahasiswa', header: 'Mahasiswa', sortable: true, sortValue: (n) => n.mahasiswa?.nama ?? '',
            render: (n) => (
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{n.mahasiswa?.nama ?? '-'}</p>
                <p className="text-xs text-muted-foreground font-mono">{n.mahasiswa?.nim ?? '-'}</p>
              </div>
            ) },
          { key: 'kelompok', header: 'Kelompok', sortable: true, sortValue: (n) => n.kelompok?.nama ?? '',
            render: (n) => <span className="text-sm">{n.kelompok?.nama ?? '-'}</span> },
          { key: 'jenis', header: 'Jenis', sortable: true, render: (n) => tipeBadge(n.jenis) },
          { key: 'aspek', header: 'Aspek', sortable: true, render: (n) => <span className="text-sm">{n.aspek}</span> },
          { key: 'nilai', header: 'Nilai', sortable: true, sortValue: (n) => n.nilai,
            render: (n) => nilaiBadge(n.nilai) },
          { key: 'dosen', header: 'Dosen', sortable: false,
            render: (n) => <span className="text-sm">{n.dosen?.nama ?? <span className="text-muted-foreground">—</span>}</span> },
        ]
        return c as Column<any>[]
      }
      default:
        return []
    }
  }, [selected])

  // ============ Export ============
  const buildExportRows = (): { headers: string[]; rows: (string | number)[][] } => {
    switch (selected) {
      case 'mahasiswa': {
        const m = data as MahasiswaRow[]
        return {
          headers: ['NIM', 'Nama', 'JK', 'Prodi', 'Fakultas', 'Semester', 'Angkatan', 'Status'],
          rows: m.map(r => [r.nim, r.nama, r.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan', r.prodi?.nama ?? '-', r.prodi?.fakultas?.nama ?? '-', r.semester, r.angkatan, r.status]),
        }
      }
      case 'dosen': {
        const d = data as DosenRow[]
        return {
          headers: ['NIDN', 'Nama', 'Fakultas', 'Prodi', 'Jabatan', 'Status'],
          rows: d.map(r => [r.nidn, r.nama, r.fakultas?.nama ?? '-', r.prodi?.nama ?? '-', r.jabatan, r.status]),
        }
      }
      case 'desa': {
        const d = data as DesaRow[]
        return {
          headers: ['Nama', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Kuota', 'Kelompok'],
          rows: d.map(r => [r.nama, r.kecamatan, r.kabupaten, r.provinsi, r.kuota, r._count?.kelompok ?? 0]),
        }
      }
      case 'sekolah': {
        const s = data as SekolahRow[]
        return {
          headers: ['Nama', 'Jenjang', 'Kecamatan', 'Kabupaten', 'Kepala Sekolah', 'Kuota'],
          rows: s.map(r => [r.nama, r.jenjang, r.kecamatan, r.kabupaten, r.kepalaSekolah, r.kuota]),
        }
      }
      case 'absensi': {
        const a = data as AbsensiRow[]
        return {
          headers: ['Mahasiswa', 'NIM', 'Kelompok', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status'],
          rows: a.map(r => [
            r.mahasiswa?.nama ?? '-', r.mahasiswa?.nim ?? '-', r.kelompok?.nama ?? '-',
            formatDateShort(r.tanggal),
            r.jamMasuk ? new Date(r.jamMasuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
            r.jamPulang ? new Date(r.jamPulang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
            r.status,
          ]),
        }
      }
      case 'penempatan': {
        const p = data as PenempatanRow[]
        return {
          headers: ['Kelompok', 'Tipe', 'Lokasi', 'Dosen', 'Anggota'],
          rows: p.map(r => [
            r.nama, r.tipe,
            r.desa ? `${r.desa.nama} — ${r.desa.kabupaten}` : r.sekolah ? `${r.sekolah.nama} (${r.sekolah.jenjang})` : '-',
            r.dosen?.nama ?? '-',
            r._count?.members ?? 0,
          ]),
        }
      }
      case 'persuratan': {
        const s = data as PersuratanRow[]
        return {
          headers: ['Nomor', 'Jenis', 'Perihal', 'Tanggal', 'Status'],
          rows: s.map(r => [r.nomor, r.jenis, r.perihal, formatDateShort(r.tanggal), r.status]),
        }
      }
      case 'nilai': {
        const n = data as NilaiRow[]
        return {
          headers: ['Mahasiswa', 'NIM', 'Kelompok', 'Jenis', 'Aspek', 'Nilai', 'Dosen'],
          rows: n.map(r => [r.mahasiswa?.nama ?? '-', r.mahasiswa?.nim ?? '-', r.kelompok?.nama ?? '-', r.jenis, r.aspek, r.nilai, r.dosen?.nama ?? '-']),
        }
      }
      default:
        return { headers: [], rows: [] }
    }
  }

  const handleExportCSV = () => {
    if (!data.length) { toast.error('Belum ada data untuk diexport'); return }
    const { headers, rows } = buildExportRows()
    exportToCSV(`laporan-${selected}`, headers, rows)
  }

  const handleExportPDF = () => {
    if (!data.length) { toast.error('Belum ada data untuk diexport'); return }
    const { headers, rows } = buildExportRows()
    exportToPDF(`Laporan ${meta?.label ?? ''}`, generateTableHTML(`Laporan ${meta?.label ?? ''}`, headers, rows))
  }

  const handlePrint = () => {
    if (!data.length) { toast.error('Belum ada data untuk dicetak'); return }
    const { headers, rows } = buildExportRows()
    // Build date range info if applicable
    const dateInfo = meta?.hasDateFilter && (fromDate || toDate)
      ? `<p>Periode: ${fromDate ? formatDate(fromDate) : 'Awal'} s/d ${toDate ? formatDate(toDate) : 'Akhir'}</p>`
      : ''
    const html = `
      <h2>Laporan ${meta?.label ?? ''}</h2>
      <p>Total data: ${data.length} record</p>
      ${dateInfo}
      ${generateTableHTML(`Laporan ${meta?.label ?? ''}`, headers, rows)}
    `
    printData(`Laporan ${meta?.label ?? ''}`, html)
  }

  // ============ Render extra filter ============
  const renderExtraFilter = () => {
    if (!meta?.extraFilter) return null
    switch (meta.extraFilter) {
      case 'kelompok':
        return (
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Kelompok:</Label>
            <Select value={filterKelompok} onValueChange={setFilterKelompok}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="ALL">Semua Kelompok</SelectItem>
                {kelompokList.map(k => (
                  <SelectItem key={k.id} value={k.id}>{k.nama} ({k.tipe})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      case 'jenis':
        return (
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Jenis:</Label>
            <Select value={filterJenis} onValueChange={setFilterJenis}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="KKN">KKN</SelectItem>
                <SelectItem value="PLP1">PLP 1</SelectItem>
                <SelectItem value="PLP2">PLP 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      case 'tipe':
        return (
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Tipe:</Label>
            <Select value={filterTipe} onValueChange={setFilterTipe}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="KKN">KKN</SelectItem>
                <SelectItem value="PLP1">PLP 1</SelectItem>
                <SelectItem value="PLP2">PLP 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      case 'status':
        return (
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Status:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="DIKIRIM">Dikirim</SelectItem>
                <SelectItem value="SELESAI">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan"
        description="Generate laporan operasional KKN & PLP dalam berbagai format"
        icon={FileBarChart}
        breadcrumb={['Sistem', 'Laporan']}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left sidebar: report type cards */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 pb-2">
            <FilterIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pilih Jenis Laporan</span>
          </div>
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon
            const active = selected === rt.key
            return (
              <motion.button
                key={rt.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleSelect(rt.key)}
                className={`w-full text-left rounded-xl border p-3 transition-all hover:shadow-md ${
                  active
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${rt.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium text-sm ${active ? 'text-primary' : ''}`}>{rt.label}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{rt.description}</p>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Right: report panel */}
        <div className="space-y-4">
          {!selected ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Selamat Datang di Modul Laporan</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Pilih jenis laporan dari panel di samping untuk mulai menggenerate laporan operasional KKN & PLP.
                  Anda dapat mencetak, mengexport PDF, dan mengexport Excel setiap laporan yang ditampilkan.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 max-w-2xl">
                  {REPORT_TYPES.slice(0, 4).map(rt => {
                    const Icon = rt.icon
                    return (
                      <div key={rt.key} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-muted/30">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{rt.label}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filter row */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <CalendarRange className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Filter & Generate Laporan {meta?.label}</span>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    {meta?.hasDateFilter && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Dari Tanggal</Label>
                          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[180px] h-9" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Sampai Tanggal</Label>
                          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[180px] h-9" />
                        </div>
                      </>
                    )}
                    {renderExtraFilter()}
                    <div className="ml-auto">
                      <Button onClick={handleGenerate} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                        Generate Laporan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              {generated && stats.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {stats.map((s, i) => (
                    <StatCard key={i} icon={s.icon} label={s.label} value={s.value} color={s.color} />
                  ))}
                </div>
              )}

              {/* Data table + actions */}
              {loading ? (
                <Skeleton className="h-96 rounded-xl" />
              ) : generated ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Laporan {meta?.label}</h3>
                      <p className="text-xs text-muted-foreground">{data.length} record ditampilkan</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-1.5" />Print
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportPDF}>
                        <FileText className="w-4 h-4 mr-1.5" />Export PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <FileSpreadsheet className="w-4 h-4 mr-1.5" />Export Excel
                      </Button>
                    </div>
                  </div>
                  <DataTable
                    data={data}
                    columns={columns}
                    searchable
                    searchKeys={['nama', 'nim', 'nidn', 'nomor', 'perihal', 'aspek']}
                    pageSize={15}
                    getRowId={(r: any) => r.id}
                    emptyMessage="Tidak ada data untuk laporan ini dengan filter saat ini."
                  />
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center text-center py-12">
                    <BarChart3 className="w-10 h-10 text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium">Belum ada data yang digenerate</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Klik <strong>Generate Laporan</strong> di atas untuk memuat data {meta?.label}.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
