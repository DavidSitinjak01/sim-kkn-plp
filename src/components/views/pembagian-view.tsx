'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  GitBranch, Plus, Pencil, Trash2, Loader2, Users, Printer, FileSpreadsheet, FileText,
  Building2, School, UserCheck, Search, UserPlus, UserMinus, Layers, ArrowRightLeft,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, generateTableHTML, formatDate, printData,
} from '@/lib/export-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
interface Prodi { id: string; nama: string }
interface Mahasiswa {
  id: string; nim: string; nama: string; jenisKelamin: string; prodi: Prodi | null
}
interface Dosen {
  id: string; nidn: string; nama: string; jabatan: string
}
interface Desa {
  id: string; nama: string; kecamatan: string; kabupaten: string; kuota: number
}
interface Sekolah {
  id: string; nama: string; jenjang: string; alamat: string; kuota: number
}
interface KelompokMember {
  id: string
  kelompokId: string
  mahasiswaId: string
  mahasiswa: Mahasiswa
  createdAt: string
}
interface Kelompok {
  id: string
  nama: string
  tipe: 'KKN' | 'PLP1' | 'PLP2'
  tahunAkademik: string
  semester: string
  desaId: string | null
  desa: Desa | null
  sekolahId: string | null
  sekolah: Sekolah | null
  dosenId: string | null
  dosen: Dosen | null
  status: string
  createdAt: string
  updatedAt: string
  _count?: { members: number }
  members?: KelompokMember[]
}

const TIPE_OPTIONS = [
  { value: 'KKN', label: 'KKN' },
  { value: 'PLP1', label: 'PLP 1' },
  { value: 'PLP2', label: 'PLP 2' },
]
const SEMESTER_OPTIONS = [
  { value: 'GANJIL', label: 'Ganjil' },
  { value: 'GENAP', label: 'Genap' },
]

function tipeBadge(t: string) {
  const map: Record<string, string> = {
    KKN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    PLP1: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    PLP2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${map[t] ?? ''}`}>
      {t === 'PLP1' ? 'PLP 1' : t === 'PLP2' ? 'PLP 2' : t}
    </span>
  )
}

function statusBadge(s: string) {
  const map: Record<string, { cls: string; label: string }> = {
    AKTIF: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', label: 'Aktif' },
    NONAKTIF: { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800', label: 'Non-Aktif' },
    SELESAI: { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800', label: 'Selesai' },
  }
  const m = map[s] ?? { cls: 'bg-muted text-muted-foreground border-border', label: s }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${m.cls}`}>{m.label}</span>
}

interface FormState {
  nama: string
  tipe: string
  tahunAkademik: string
  semester: string
  dosenId: string
  desaId: string
  sekolahId: string
  status: string
}
const EMPTY_FORM: FormState = {
  nama: '', tipe: 'KKN', tahunAkademik: '2024/2025', semester: 'GANJIL',
  dosenId: '', desaId: '', sekolahId: '', status: 'AKTIF',
}

export function PembagianView() {
  const [data, setData] = useState<Kelompok[]>([])
  const [dosenList, setDosenList] = useState<Dosen[]>([])
  const [desaList, setDesaList] = useState<Desa[]>([])
  const [sekolahList, setSekolahList] = useState<Sekolah[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [tipeFilter, setTipeFilter] = useState('ALL')
  const [tahunFilter, setTahunFilter] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [deleteTarget, setDeleteTarget] = useState<Kelompok | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [membersTarget, setMembersTarget] = useState<Kelompok | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tipeFilter !== 'ALL') params.set('tipe', tipeFilter)
      if (tahunFilter) params.set('tahunAkademik', tahunFilter)
      const res = await fetch(`/api/kelompok?${params.toString()}`)
      if (!res.ok) throw new Error('Gagal')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Gagal memuat data kelompok')
    } finally {
      setLoading(false)
    }
  }, [tipeFilter, tahunFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Load supporting lists
  useEffect(() => {
    (async () => {
      try {
        const [d, ds, sk] = await Promise.all([
          fetch('/api/dosen').then((r) => r.json()),
          fetch('/api/desa').then((r) => r.json()),
          fetch('/api/sekolah').then((r) => r.json()),
        ])
        setDosenList(d)
        setDesaList(ds)
        setSekolahList(sk)
      } catch {
        // silent
      }
    })()
  }, [])

  // Stats
  const stats = useMemo(() => ({
    total: data.length,
    kkn: data.filter((k) => k.tipe === 'KKN').length,
    plp1: data.filter((k) => k.tipe === 'PLP1').length,
    plp2: data.filter((k) => k.tipe === 'PLP2').length,
  }), [data])

  // Form handlers
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setDialogOpen(true)
  }
  const openEdit = (k: Kelompok) => {
    setForm({
      nama: k.nama,
      tipe: k.tipe,
      tahunAkademik: k.tahunAkademik,
      semester: k.semester,
      dosenId: k.dosenId ?? '',
      desaId: k.desaId ?? '',
      sekolahId: k.sekolahId ?? '',
      status: k.status,
    })
    setEditId(k.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nama.trim() || !form.tahunAkademik.trim()) {
      toast.error('Nama dan Tahun Akademik wajib diisi')
      return
    }
    const isKKN = form.tipe === 'KKN'
    if (isKKN && !form.desaId) {
      toast.error('Kelompok KKN wajib memiliki desa')
      return
    }
    if (!isKKN && !form.sekolahId) {
      toast.error('Kelompok PLP wajib memiliki sekolah')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        dosenId: form.dosenId || undefined,
        desaId: isKKN ? form.desaId : undefined,
        sekolahId: !isKKN ? form.sekolahId : undefined,
      }
      const url = editId ? `/api/kelompok/${editId}` : '/api/kelompok'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan')
      toast.success(editId ? 'Kelompok diperbarui' : 'Kelompok berhasil ditambahkan')
      setDialogOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/kelompok/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus')
      toast.success(`Kelompok ${deleteTarget.nama} dihapus`)
      setDeleteTarget(null)
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  // Export
  const handleExportCSV = () => {
    if (!data.length) { toast.error('Tidak ada data'); return }
    const headers = ['Nama', 'Tipe', 'Tahun', 'Semester', 'Lokasi', 'Dosen', 'Anggota', 'Kuota', 'Status']
    const rows = data.map((k) => [
      k.nama, k.tipe, k.tahunAkademik, k.semester,
      k.desa?.nama ?? k.sekolah?.nama ?? '-',
      k.dosen?.nama ?? '-', k._count?.members ?? 0,
      k.desa?.kuota ?? k.sekolah?.kuota ?? '-', k.status,
    ])
    exportToCSV('data-pembagian-kkn-plp', headers, rows)
  }
  const handleExportPDF = () => {
    if (!data.length) { toast.error('Tidak ada data'); return }
    const headers = ['Nama', 'Tipe', 'Tahun', 'Lokasi', 'Dosen', 'Anggota', 'Kuota', 'Status']
    const rows = data.map((k) => [
      k.nama, k.tipe, k.tahunAkademik,
      k.desa?.nama ?? k.sekolah?.nama ?? '-',
      k.dosen?.nama ?? '-', k._count?.members ?? 0,
      k.desa?.kuota ?? k.sekolah?.kuota ?? '-', k.status,
    ])
    exportToPDF('Data Pembagian KKN & PLP', generateTableHTML('Data Pembagian KKN & PLP', headers, rows))
  }

  // Cetak SK
  const handleCetakSK = (k: Kelompok) => {
    // Fetch full kelompok (with members) to ensure we have all data for the letter
    fetch(`/api/kelompok/${k.id}`)
      .then((r) => r.json())
      .then((detail: Kelompok) => {
        const members = detail.members ?? []
        const lokasi = detail.desa?.nama ?? detail.sekolah?.nama ?? '-'
        const lokasiLabel = detail.tipe === 'KKN' ? 'Desa' : 'Sekolah'
        const dosenNama = detail.dosen?.nama ?? '-'
        const dosenNidn = detail.dosen?.nidn ?? '-'
        const today = formatDate(new Date())
        const nomor = `${Math.floor(Math.random() * 900) + 100}/UNJ/${detail.tipe}/${new Date().getFullYear()}`

        const html = `
          <div style="margin-bottom:20px;">
            <p style="text-align:right; font-size:11px; margin:0 0 4px;">Nomor: ${nomor}</p>
            <p style="text-align:right; font-size:11px; margin:0 0 4px;">Jakarta, ${today}</p>
            <p style="text-align:right; font-size:11px; margin:0 0 12px;">Lampiran: 1 (satu) berkas</p>
            <p style="font-size:11px; margin:0 0 4px;">Kepada Yth.</p>
            <p style="font-size:11px; margin:0 0 4px;">Kepala ${lokasiLabel} ${lokasi}</p>
            <p style="font-size:11px; margin:0 0 16px;">di Tempat</p>
          </div>
          <p style="font-size:12px; margin:0 0 12px;">Dengan hormat,</p>
          <p style="font-size:12px; line-height:1.6; margin:0 0 16px; text-align:justify;">
            Sehubungan dengan pelaksanaan ${detail.tipe === 'KKN' ? 'Kuliah Kerja Nyata (KKN)' : 'Praktik Lapangan Persekolahan (PLP)'} Tahun Akademik ${detail.tahunAkademik} Semester ${detail.semester === 'GANJIL' ? 'Ganjil' : 'Genap'},
            dengan ini kami sampaikan kepada Saudara/i bahwa mahasiswa berikut telah ditetapkan sebagai peserta
            yang akan melaksanakan kegiatan di ${lokasiLabel} ${lokasi}:
          </p>
          <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px;">
            <thead>
              <tr>
                <th style="border:1px solid #999; padding:6px; width:32px;">No.</th>
                <th style="border:1px solid #999; padding:6px;">NIM</th>
                <th style="border:1px solid #999; padding:6px;">Nama Mahasiswa</th>
                <th style="border:1px solid #999; padding:6px;">Program Studi</th>
              </tr>
            </thead>
            <tbody>
              ${members.length === 0
                ? `<tr><td colspan="4" style="border:1px solid #999; padding:6px; text-align:center;">Belum ada anggota kelompok</td></tr>`
                : members.map((m, i) => `
                  <tr>
                    <td style="border:1px solid #999; padding:6px; text-align:center;">${i + 1}</td>
                    <td style="border:1px solid #999; padding:6px;">${m.mahasiswa.nim}</td>
                    <td style="border:1px solid #999; padding:6px;">${m.mahasiswa.nama}</td>
                    <td style="border:1px solid #999; padding:6px;">${m.mahasiswa.prodi?.nama ?? '-'}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
          <p style="font-size:12px; line-height:1.6; margin:0 0 8px; text-align:justify;">
            Kelompok tersebut di atas dibimbing oleh Dosen Pendamping:
          </p>
          <p style="font-size:12px; margin:0 0 16px; padding-left:24px;">
            Nama: <strong>${dosenNama}</strong><br/>
            NIDN: ${dosenNidn}
          </p>
          <p style="font-size:12px; line-height:1.6; margin:0 0 16px; text-align:justify;">
            Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.
            Atas perhatian dan kerja samanya, diucapkan terima kasih.
          </p>
          <div style="display:flex; justify-content:space-between; margin-top:30px;">
            <div style="font-size:11px;">
              <p style="margin:0;">Mengetahui,</p>
              <p style="margin:0 0 60px;">Ketua Lembaga KKN & PLP</p>
              <p style="margin:0;"><strong>Dr. H. Sutrisno, M.Si.</strong></p>
            </div>
            <div style="font-size:11px; text-align:right;">
              <p style="margin:0;">Hormat kami,</p>
              <p style="margin:0 0 60px;">Koordinator ${detail.tipe === 'KKN' ? 'KKN' : 'PLP'}</p>
              <p style="margin:0;"><strong>${dosenNama}</strong></p>
            </div>
          </div>
          <p style="font-size:10px; color:#666; margin-top:16px; border-top:1px dashed #ccc; padding-top:8px;">
            SK Pembagian Kelompok ${detail.nama} — ${detail.tipe} TA ${detail.tahunAkademik}
          </p>
        `
        printData(`SK Pembagian - ${detail.nama}`, html)
      })
      .catch(() => toast.error('Gagal menyiapkan SK'))
  }

  // Columns
  const columns: Column<Kelompok>[] = useMemo(() => [
    {
      key: 'aksi', header: 'Aksi', sortable: false, className: 'text-left',
      render: (k) => (
        <div className="flex items-center justify-start gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20" onClick={() => setMembersTarget(k)} title="Kelola Anggota">
            <Users className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/20" onClick={() => handleCetakSK(k)} title="Cetak SK">
            <Printer className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(k)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => setDeleteTarget(k)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    {
      key: 'nama', header: 'Nama Kelompok', sortable: true,
      render: (k) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${k.tipe === 'KKN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : k.tipe === 'PLP1' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            <GitBranch className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{k.nama}</p>
            <p className="text-xs text-muted-foreground">{k.tahunAkademik} · {k.semester === 'GANJIL' ? 'Ganjil' : 'Genap'}</p>
          </div>
        </div>
      ),
    },
    { key: 'tipe', header: 'Tipe', sortable: true, className: 'text-center', render: (k) => tipeBadge(k.tipe) },
    {
      key: 'semester', header: 'Tahun / Semester', sortable: true, sortValue: (k) => `${k.tahunAkademik}-${k.semester}`,
      render: (k) => (
        <div className="text-xs">
          <p className="font-medium">{k.tahunAkademik}</p>
          <p className="text-muted-foreground">{k.semester === 'GANJIL' ? 'Ganjil' : 'Genap'}</p>
        </div>
      ),
    },
    {
      key: 'lokasi', header: 'Lokasi', sortable: true, sortValue: (k) => k.desa?.nama ?? k.sekolah?.nama ?? '',
      render: (k) => (
        <div className="flex items-center gap-1.5 min-w-0">
          {k.tipe === 'KKN' ? (
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <School className="w-4 h-4 text-violet-600 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm truncate">{k.desa?.nama ?? k.sekolah?.nama ?? '-'}</p>
            <p className="text-xs text-muted-foreground truncate">
              {k.desa ? `${k.desa.kecamatan}, ${k.desa.kabupaten}` : k.sekolah ? k.sekolah.jenjang : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'dosen', header: 'Dosen Pendamping', sortable: true, sortValue: (k) => k.dosen?.nama ?? '',
      render: (k) => (
        k.dosen ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <UserCheck className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm truncate">{k.dosen.nama}</p>
              <p className="text-xs text-muted-foreground font-mono">{k.dosen.nidn}</p>
            </div>
          </div>
        ) : <span className="text-xs text-muted-foreground">Belum ditetapkan</span>
      ),
    },
    {
      key: 'anggota', header: 'Anggota', sortable: true, sortValue: (k) => k._count?.members ?? 0, className: 'text-center',
      render: (k) => {
        const count = k._count?.members ?? 0
        const kuota = k.desa?.kuota ?? k.sekolah?.kuota ?? 0
        const over = kuota > 0 && count > kuota
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-semibold">{count}</span>
            {kuota > 0 && (
              <span className={`text-xs ${over ? 'text-rose-600 font-semibold' : 'text-muted-foreground'}`}>/ {kuota}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'kuota', header: 'Kuota Lokasi', sortable: true, sortValue: (k) => k.desa?.kuota ?? k.sekolah?.kuota ?? 0, className: 'text-center',
      render: (k) => {
        const kuota = k.desa?.kuota ?? k.sekolah?.kuota ?? 0
        const count = k._count?.members ?? 0
        if (kuota === 0) return <span className="text-xs text-muted-foreground">-</span>
        const over = count > kuota
        return (
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold ${over ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            {kuota}
          </span>
        )
      },
    },
    { key: 'status', header: 'Status', sortable: true, className: 'text-center', render: (k) => statusBadge(k.status) },
  ], [])

  const isKKNForm = form.tipe === 'KKN'

  const statCards = [
    { label: 'Total Kelompok', value: stats.total, icon: Layers, color: 'from-slate-500 to-slate-600' },
    { label: 'Kelompok KKN', value: stats.kkn, icon: Building2, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Kelompok PLP 1', value: stats.plp1, icon: School, color: 'from-violet-500 to-purple-500' },
    { label: 'Kelompok PLP 2', value: stats.plp2, icon: School, color: 'from-amber-500 to-orange-500' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pembagian KKN & PLP"
        description="Kelola pembagian kelompok peserta KKN dan PLP beserta lokasi & dosen pendamping"
        icon={GitBranch}
        breadcrumb={['Operasional', 'Pembagian']}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="w-4 h-4" /> PDF
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Tambah Kelompok
            </Button>
          </>
        }
      />

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipe</Label>
              <Select value={tipeFilter} onValueChange={setTipeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Tipe</SelectItem>
                  {TIPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tahun Akademik</Label>
              <Input value={tahunFilter} onChange={(e) => setTahunFilter(e.target.value)} placeholder="cth: 2024/2025" />
            </div>
            <div className="space-y-1.5 flex items-end">
              {tahunFilter && (
                <Button variant="ghost" size="sm" onClick={() => setTahunFilter('')} className="text-xs">
                  Reset Filter
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white shrink-0`}>
                    <c.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
                    <p className="text-2xl font-bold">{c.value}</p>
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
          searchKeys={['nama']}
          pageSize={10}
          emptyMessage="Belum ada kelompok. Klik 'Tambah Kelompok' untuk membuat."
          getRowId={(k) => k.id}
        />
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditId(null) }}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              {editId ? 'Edit Kelompok' : 'Tambah Kelompok'}
            </DialogTitle>
            <DialogDescription>
              {editId ? 'Perbarui informasi kelompok KKN/PLP.' : 'Lengkapi data kelompok baru.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nama">Nama Kelompok <span className="text-rose-500">*</span></Label>
                <Input id="nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="cth: Kelompok KKN 01 Desa Sukamaju" required />
              </div>
              <div className="space-y-1.5">
                <Label>Tipe <span className="text-rose-500">*</span></Label>
                <Select
                  value={form.tipe}
                  onValueChange={(v) => setForm({ ...form, tipe: v, desaId: '', sekolahId: '' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Semester <span className="text-rose-500">*</span></Label>
                <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEMESTER_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tahun">Tahun Akademik <span className="text-rose-500">*</span></Label>
                <Input id="tahun" value={form.tahunAkademik} onChange={(e) => setForm({ ...form, tahunAkademik: e.target.value })} placeholder="2024/2025" required />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AKTIF">Aktif</SelectItem>
                    <SelectItem value="NONAKTIF">Non-Aktif</SelectItem>
                    <SelectItem value="SELESAI">Selesai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dosen Pendamping</Label>
                <Select value={form.dosenId} onValueChange={(v) => setForm({ ...form, dosenId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih dosen" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {dosenList.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Lokasi select — desa for KKN, sekolah for PLP */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  {isKKNForm ? 'Desa (KKN)' : 'Sekolah (PLP)'} <span className="text-rose-500">*</span>
                </Label>
                {isKKNForm ? (
                  <Select value={form.desaId} onValueChange={(v) => setForm({ ...form, desaId: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih desa" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {desaList.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.nama} ({d.kabupaten}, kuota {d.kuota})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={form.sekolahId} onValueChange={(v) => setForm({ ...form, sekolahId: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {sekolahList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nama} ({s.jenjang}, kuota {s.kuota})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editId ? 'Simpan Perubahan' : 'Tambah Kelompok'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Kelola Anggota dialog */}
      {membersTarget && (
        <KelolaAnggotaDialog
          kelompok={membersTarget}
          onClose={() => setMembersTarget(null)}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kelompok</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kelompok <strong>{deleteTarget?.nama}</strong>?
              Seluruh data anggota akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
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
    </div>
  )
}

// ============ Kelola Anggota Dialog ============
// Dual-list box dengan dukungan PERPINDAHAN ANGGOTA antar kelompok (same tipe):
//  - Panel kanan menampilkan badge "Di: Kelompok X" untuk mhs yang sudah ada di kelompok lain
//  - Klik "+" pada mhs yang sudah di kelompok lain → konfirmasi → atomic transfer
//  - Panel kiri: tombol "Pindah" per anggota → buka dialog pilih kelompok tujuan
function KelolaAnggotaDialog({ kelompok, onClose }: { kelompok: Kelompok; onClose: () => void }) {
  const [detail, setDetail] = useState<Kelompok | null>(null)
  const [loading, setLoading] = useState(true)
  const [mhsList, setMhsList] = useState<Mahasiswa[]>([])
  // Map mahasiswaId -> kelompok lain tempat dia terdaftar (same tahunAkademik, semua tipe)
  const [otherMembership, setOtherMembership] = useState<Record<string, { id: string; nama: string; tipe: string }>>({})
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  // Transfer confirmation state
  const [pendingMove, setPendingMove] = useState<{ mhs: Mahasiswa; fromKelompok: { id: string; nama: string; tipe: string } } | null>(null)
  // Move-to dialog state (pindah dari current member ke kelompok lain)
  const [moveToTarget, setMoveToTarget] = useState<Mahasiswa | null>(null)
  const [peerKelompok, setPeerKelompok] = useState<Kelompok[]>([])
  const [selectedTargetKelompok, setSelectedTargetKelompok] = useState<string>('')

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kelompok/${kelompok.id}`)
      if (!res.ok) throw new Error('Gagal')
      const json: Kelompok = await res.json()
      setDetail(json)
    } catch {
      toast.error('Gagal memuat detail kelompok')
    } finally {
      setLoading(false)
    }
  }, [kelompok.id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  // Load all mahasiswa + peer kelompok (SEMUA tipe, same tahunAkademik)
  // Anti-duplikasi: mahasiswa tidak boleh ada di 2 kelompok pada tahun akademik yang sama,
  // walau tipenya berbeda (KKN vs PLP1 vs PLP2). Karena itu peer fetch TIDAK difilter per tipe.
  // Then figure out each mahasiswa's other-group membership so we can show badges + enable transfer.
  useEffect(() => {
    (async () => {
      try {
        const [mhsRes, peerRes] = await Promise.all([
          fetch('/api/mahasiswa'),
          fetch('/api/kelompok'),
        ])
        if (mhsRes.ok) setMhsList(await mhsRes.json() as Mahasiswa[])
        if (peerRes.ok) {
          const allK = (await peerRes.json() as Kelompok[]).filter(
            (k) => k.id !== kelompok.id && k.tahunAkademik === kelompok.tahunAkademik,
          )
          setPeerKelompok(allK)
          // Fetch each peer's members to build the membership map
          // (do it in parallel — typically just a few kelompok)
          const entries: Record<string, { id: string; nama: string; tipe: string }> = {}
          await Promise.all(
            allK.map(async (k) => {
              try {
                const r = await fetch(`/api/kelompok/${k.id}`)
                if (!r.ok) return
                const full = await r.json() as Kelompok
                for (const m of full.members ?? []) {
                  entries[m.mahasiswaId] = { id: k.id, nama: k.nama, tipe: k.tipe }
                }
              } catch {
                // silent — skip this kelompok on error
              }
            }),
          )
          setOtherMembership(entries)
        }
      } catch {
        // silent
      }
    })()
  }, [kelompok.id, kelompok.tahunAkademik])

  const memberIds = useMemo(() => new Set((detail?.members ?? []).map((m) => m.mahasiswaId)), [detail])

  const available = useMemo(() => {
    let list = mhsList.filter((m) => !memberIds.has(m.id))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((m) => m.nim.toLowerCase().includes(q) || m.nama.toLowerCase().includes(q))
    }
    // Sort: mahasiswa yang sudah di kelompok lain (perlu pindah) didahulukan,
    // supaya admin gampang lihat siapa yang bisa ditukar.
    list = [...list].sort((a, b) => {
      const aInOther = otherMembership[a.id] ? 0 : 1
      const bInOther = otherMembership[b.id] ? 0 : 1
      if (aInOther !== bInOther) return aInOther - bInOther
      return a.nama.localeCompare(b.nama)
    })
    return list.slice(0, 60)
  }, [mhsList, memberIds, search, otherMembership])

  const handleAdd = async (mhs: Mahasiswa) => {
    const other = otherMembership[mhs.id]
    // Jika mhs sudah ada di kelompok lain (same tipe), tampilkan konfirmasi transfer
    if (other) {
      setPendingMove({ mhs, fromKelompok: other })
      return
    }
    // Otherwise, add biasa
    await doAdd(mhs.id)
  }

  const doAdd = async (mhsId: string, moveFromKelompokId?: string) => {
    setBusy(mhsId)
    try {
      const res = await fetch(`/api/kelompok/${kelompok.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mahasiswaId: mhsId, moveFromKelompokId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menambah')
      if (json?.moved) {
        toast.success(`Anggota dipindahkan dari "${pendingMove?.fromKelompok.nama ?? 'kelompok lain'}"`)
      } else {
        toast.success('Anggota ditambahkan')
      }
      setPendingMove(null)
      // Refresh detail + other-membership map (mahasiswa yang bergerak perlu update badge-nya)
      fetchDetail()
      refreshOtherMembership()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menambahkan anggota')
      // Bila konflik (409) — refresh membership map supaya badge muncul
      refreshOtherMembership()
    } finally {
      setBusy(null)
    }
  }

  const refreshOtherMembership = async () => {
    try {
      const entries: Record<string, { id: string; nama: string; tipe: string }> = {}
      await Promise.all(
        peerKelompok.map(async (k) => {
          try {
            const r = await fetch(`/api/kelompok/${k.id}`)
            if (!r.ok) return
            const full = await r.json() as Kelompok
            for (const m of full.members ?? []) {
              entries[m.mahasiswaId] = { id: k.id, nama: k.nama, tipe: k.tipe }
            }
          } catch {
            // silent
          }
        }),
      )
      setOtherMembership(entries)
    } catch {
      // silent
    }
  }

  const handleRemove = async (mhsId: string) => {
    setBusy(mhsId)
    try {
      const res = await fetch(`/api/kelompok/${kelompok.id}/members?mahasiswaId=${encodeURIComponent(mhsId)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus')
      toast.success('Anggota dihapus dari kelompok')
      fetchDetail()
      refreshOtherMembership()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus anggota')
    } finally {
      setBusy(null)
    }
  }

  // Handle "Pindah ke kelompok lain" dari panel kiri
  const handleMoveTo = async () => {
    if (!moveToTarget || !selectedTargetKelompok) return
    setBusy(moveToTarget.id)
    try {
      const res = await fetch(`/api/kelompok/${selectedTargetKelompok}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mahasiswaId: moveToTarget.id, moveFromKelompokId: kelompok.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal memindahkan')
      const targetName = peerKelompok.find((k) => k.id === selectedTargetKelompok)?.nama ?? 'kelompok tujuan'
      toast.success(`Anggota dipindahkan ke "${targetName}"`)
      setMoveToTarget(null)
      setSelectedTargetKelompok('')
      fetchDetail()
      refreshOtherMembership()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memindahkan anggota')
    } finally {
      setBusy(null)
    }
  }

  const kuota = detail?.desa?.kuota ?? detail?.sekolah?.kuota ?? 0
  const anggotaCount = detail?.members?.length ?? 0
  const overKuota = kuota > 0 && anggotaCount > kuota

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" /> Kelola Anggota
          </DialogTitle>
          <DialogDescription>
            Kelompok <strong>{kelompok.nama}</strong> — {kelompok.tipe === 'KKN' ? 'KKN' : kelompok.tipe === 'PLP1' ? 'PLP 1' : 'PLP 2'} TA {kelompok.tahunAkademik}
          </DialogDescription>
        </DialogHeader>

        {/* Info row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-xs text-muted-foreground">Lokasi</p>
            <p className="font-medium truncate">{detail?.desa?.nama ?? detail?.sekolah?.nama ?? '-'}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-xs text-muted-foreground">Dosen Pendamping</p>
            <p className="font-medium truncate">{detail?.dosen?.nama ?? '-'}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-xs text-muted-foreground">Anggota</p>
            <p className={`font-medium ${overKuota ? 'text-rose-600' : ''}`}>
              {anggotaCount} {kuota > 0 ? `/ ${kuota}` : ''} {overKuota && <span className="text-xs">⚠ melebihi kuota</span>}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-xs text-muted-foreground">Tipe</p>
            <p className="font-medium">{kelompok.tipe === 'KKN' ? 'KKN' : kelompok.tipe === 'PLP1' ? 'PLP 1' : 'PLP 2'}</p>
          </div>
        </div>

        {/* Helper hint */}
        <div className="rounded-md border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30 px-3 py-2 text-xs text-sky-800 dark:text-sky-200 flex items-start gap-2">
          <ArrowRightLeft className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>Anti-duplikasi:</strong> Mahasiswa hanya boleh di <strong>satu kelompok per tahun akademik</strong> (tidak boleh di 2 kelompok, walau tipenya berbeda — KKN/PLP 1/PLP 2).
            Klik tombol <kbd className="px-1 rounded bg-white dark:bg-sky-900/50 border">+</kbd> pada mahasiswa ber-badge kelompok lain untuk memindahkannya ke sini,
            atau klik <kbd className="px-1 rounded bg-white dark:bg-sky-900/50 border">Pindah</kbd> pada anggota saat ini.
          </span>
        </div>

        {/* Two columns: members | available */}
        <div className="grid md:grid-cols-2 gap-4 mt-1 min-h-0 flex-1">
          {/* Current members */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" /> Anggota Saat Ini ({anggotaCount})
              </h4>
            </div>
            <ScrollArea className="h-[320px] pr-3 rounded-lg border border-border">
              {loading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
                </div>
              ) : anggotaCount === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Belum ada anggota. Tambahkan dari daftar di samping.</div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {detail?.members?.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/30 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-xs font-semibold">
                        {m.mahasiswa.nama.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.mahasiswa.nama}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.mahasiswa.nim}</p>
                      </div>
                      {/* Pindah ke kelompok lain */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                        onClick={() => {
                          setMoveToTarget(m.mahasiswa)
                          setSelectedTargetKelompok('')
                        }}
                        disabled={busy === m.mahasiswaId || peerKelompok.length === 0}
                        title={peerKelompok.length === 0 ? 'Tidak ada kelompok lain' : 'Pindah ke kelompok lain'}
                      >
                        {busy === m.mahasiswaId ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                      </Button>
                      {/* Keluarkan */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        onClick={() => handleRemove(m.mahasiswaId)}
                        disabled={busy === m.mahasiswaId}
                        title="Keluarkan"
                      >
                        {busy === m.mahasiswaId ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Available mahasiswa */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-violet-600" /> Tambah Mahasiswa
              </h4>
              {peerKelompok.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {Object.keys(otherMembership).length} mhs di kelompok lain
                </span>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NIM atau nama..."
                className="pl-8 h-9"
              />
            </div>
            <ScrollArea className="h-[290px] pr-3 rounded-lg border border-border">
              {mhsList.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Memuat daftar mahasiswa...</div>
              ) : available.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Tidak ada mahasiswa yang cocok</div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {available.map((m) => {
                    const other = otherMembership[m.id]
                    return (
                      <div key={m.id} className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${other ? 'border-violet-200 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20' : 'border-border hover:bg-accent/30'}`}>
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold">
                          {m.nama.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{m.nama}</p>
                          <p className="text-xs text-muted-foreground font-mono">{m.nim}</p>
                          {other && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800 truncate max-w-full">
                              ↗ Di: {other.tipe === 'KKN' ? 'KKN' : other.tipe === 'PLP1' ? 'PLP 1' : 'PLP 2'} · {other.nama}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${other ? 'text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
                          onClick={() => handleAdd(m)}
                          disabled={busy === m.id}
                          title={other ? `Pindahkan dari ${other.nama}` : 'Tambahkan'}
                        >
                          {busy === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>

      {/* ===== Konfirmasi Pindah (klik + pada mhs yang sudah di kelompok lain) ===== */}
      <AlertDialog open={!!pendingMove} onOpenChange={(o) => { if (!o) setPendingMove(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-violet-600" /> Pindahkan Anggota?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingMove?.mhs.nama}</strong> ({pendingMove?.mhs.nim}) saat ini terdaftar di{' '}
              <strong>
                &ldquo;{pendingMove?.fromKelompok.nama}&rdquo;
              </strong>
              {pendingMove && (
                <span className="ml-1 text-xs">
                  ({pendingMove.fromKelompok.tipe === 'KKN' ? 'KKN' : pendingMove.fromKelompok.tipe === 'PLP1' ? 'PLP 1' : 'PLP 2'})
                </span>
              )}
              .
              <br />
              Pindahkan ke kelompok <strong>&ldquo;{kelompok.nama}&rdquo;</strong>{' '}
              <span className="text-xs">
                ({kelompok.tipe === 'KKN' ? 'KKN' : kelompok.tipe === 'PLP1' ? 'PLP 1' : 'PLP 2'})
              </span>?
              <br />
              <span className="text-xs text-muted-foreground">Mahasiswa akan otomatis dikeluarkan dari kelompok asal.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingMove && doAdd(pendingMove.mhs.id, pendingMove.fromKelompok.id)}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Ya, Pindahkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Dialog Pindah ke Kelompok Lain (klik tombol panah pada anggota saat ini) ===== */}
      <Dialog open={!!moveToTarget} onOpenChange={(o) => { if (!o) { setMoveToTarget(null); setSelectedTargetKelompok('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-violet-600" /> Pindah ke Kelompok Lain
            </DialogTitle>
            <DialogDescription>
              Pilih kelompok tujuan untuk <strong>{moveToTarget?.nama}</strong> ({moveToTarget?.nim}).
              Mahasiswa akan dikeluarkan dari <strong>&ldquo;{kelompok.nama}&rdquo;</strong> dan dimasukkan ke kelompok tujuan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {peerKelompok.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada kelompok lain dengan tahun akademik yang sama.
              </p>
            ) : (
              <Select value={selectedTargetKelompok} onValueChange={setSelectedTargetKelompok}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelompok tujuan..." />
                </SelectTrigger>
                <SelectContent>
                  {peerKelompok.map((k) => {
                    const tipeLabel = k.tipe === 'KKN' ? 'KKN' : k.tipe === 'PLP1' ? 'PLP 1' : 'PLP 2'
                    return (
                      <SelectItem key={k.id} value={k.id}>
                        {tipeLabel} · {k.nama} — {k._count?.members ?? 0} anggota · {k.desa?.nama ?? k.sekolah?.nama ?? '-'}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMoveToTarget(null); setSelectedTargetKelompok('') }}>Batal</Button>
            <Button
              onClick={handleMoveTo}
              disabled={!selectedTargetKelompok || busy === moveToTarget?.id}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {busy === moveToTarget?.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1.5" />}
              Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
