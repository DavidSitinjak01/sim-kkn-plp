'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import {
  FileText, Plus, Pencil, Trash2, Loader2, Eye, Printer, FileSpreadsheet, FileText as FilePdf,
  Mail, Send, FileCheck2, FileEdit, ClipboardList, ScrollText, FileSignature, Users, Settings, IdCard,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import {
  exportToCSV, exportToPDF, generateTableHTML, formatDate, formatDateShort, printData,
} from '@/lib/export-utils'
import { useAppStore } from '@/lib/store'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { DaftarPesertaPLPLetter } from '@/components/surat/daftar-peserta-plp-letter'
import { KartuPesertaLetter } from '@/components/surat/kartu-peserta-letter'

// ============ Types ============
interface Surat {
  id: string
  nomor: string
  jenis: string
  perihal: string
  tanggal: string
  pemohon: string
  tujuan: string
  status: string
  konten: string
  filePdf: string | null
  createdAt: string
  updatedAt: string
}

interface FormState {
  nomor: string
  jenis: string
  perihal: string
  pemohon: string
  tujuan: string
  status: string
  konten: string
}

interface PlpKelompok {
  id: string
  nama: string
  tipe: string
  tahunAkademik: string
  semester: string
  sekolah: { id: string; nama: string; jenjang: string } | null
  desa: { id: string; nama: string; kecamatan: string; kabupaten: string } | null
  dosen: { id: string; nama: string; noHp: string } | null
  _count: { members: number }
}
const EMPTY_FORM: FormState = {
  nomor: '', jenis: 'TUGAS', perihal: '', pemohon: '', tujuan: '', status: 'DRAFT', konten: '',
}

const JENIS_OPTIONS = [
  { value: 'TUGAS', label: 'Surat Tugas' },
  { value: 'PENGANTAR', label: 'Surat Pengantar' },
  { value: 'IZIN', label: 'Surat Izin' },
  { value: 'PENEMPATAN', label: 'Surat Penempatan' },
  { value: 'BALASAN', label: 'Surat Balasan' },
  { value: 'SELESAI', label: 'Surat Keterangan Selesai' },
]

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'DIKIRIM', label: 'Dikirim' },
  { value: 'SELESAI', label: 'Selesai' },
]

function jenisBadge(j: string) {
  const map: Record<string, string> = {
    TUGAS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    PENGANTAR: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    IZIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    PENEMPATAN: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    BALASAN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    SELESAI: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  }
  const label = JENIS_OPTIONS.find(o => o.value === j)?.label ?? j
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${map[j] ?? ''}`}>{label}</span>
}

function statusBadge(s: string) {
  const map: Record<string, { cls: string; label: string; icon?: React.ReactNode }> = {
    DRAFT: { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800', label: 'Draft', icon: <FileEdit className="w-3 h-3" /> },
    DIKIRIM: { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800', label: 'Dikirim', icon: <Send className="w-3 h-3" /> },
    SELESAI: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', label: 'Selesai', icon: <FileCheck2 className="w-3 h-3" /> },
  }
  const m = map[s] ?? { cls: 'bg-muted text-muted-foreground border-border', label: s }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${m.cls}`}>{m.icon}{m.label}</span>
}

// ============ Stat Card ============
function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>, label: string, value: number | string, color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
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

// ============ Template Definitions ============
const SURAT_TEMPLATES = [
  {
    jenis: 'TUGAS',
    judul: 'Surat Tugas',
    desc: 'Surat penugasan mahasiswa untuk melaksanakan KKN/PLP di lokasi tertentu.',
    icon: ClipboardList,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    template: `Dekan Fakultas [NAMA FAKULTAS], Universitas Nusantara Jaya, dengan ini menugaskan:\n\nNama       : [NAMA MAHASISWA]\nNIM        : [NIM]\nProdi      : [PROGRAM STUDI]\n\nUntuk melaksanakan Kuliah Kerja Nyata (KKN) di [LOKASI] pada periode [TANGGAL MULAI] s/d [TANGGAL SELESAI].\n\nDemikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.`,
  },
  {
    jenis: 'PENGANTAR',
    judul: 'Surat Pengantar',
    desc: 'Surat pengantar mahasiswa untuk keperluan administrasi di instansi terkait.',
    icon: Mail,
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    template: `Dengan ini kami memberikan surat pengantar kepada:\n\nNama       : [NAMA MAHASISWA]\nNIM        : [NIM]\nKeperluan  : [KEPERLUAN]\n\nKepada Yth. [TUJUAN INSTANSI] di tempat. Surat pengantar ini berlaku untuk [JUMLAH HARI] hari sejak diterbitkan.\n\nAtas perhatian dan kerja sama yang baik, kami ucapkan terima kasih.`,
  },
  {
    jenis: 'IZIN',
    judul: 'Surat Izin',
    desc: 'Surat izin kegiatan/penelitian mahasiswa di lokasi KKN/PLP.',
    icon: FileSignature,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    template: `Sehubungan dengan pelaksanaan program [NAMA PROGRAM], kami memohon izin kepada:\n\nYth. [PEJABAT TUJUAN]\nInstansi : [NAMA INSTANSI]\n\nUntuk melaksanakan kegiatan [JENIS KEGIATAN] yang akan dilakukan pada tanggal [TANGGAL] di [LOKASI].\n\nDemikian surat izin ini kami sampaikan, atas izin dan kerja samanya kami ucapkan terima kasih.`,
  },
  {
    jenis: 'PENEMPATAN',
    judul: 'Surat Penempatan',
    desc: 'Surat penempatan mahasiswa KKN/PLP di lokasi tertentu.',
    icon: FileText,
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    template: `Berdasarkan hasil koordinasi, kami menempatkan mahasiswa berikut:\n\nNama       : [NAMA MAHASISWA]\nNIM        : [NIM]\nKelompok   : [NAMA KELOMPOK]\n\nDi [LOKASI PENEMPATAN] untuk periode [TANGGAL MULAI] s/d [TANGGAL SELESAI].\n\nAdapun kegiatan yang akan dilaksanakan meliputi [URAIAN KEGIATAN]. Mohon arahan dan bimbingan selama penempatan.`,
  },
  {
    jenis: 'BALASAN',
    judul: 'Surat Balasan',
    desc: 'Surat balasan dari instansi mitra terkait penerimaan mahasiswa.',
    icon: ScrollText,
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    template: `Sehubungan dengan surat pengantar dari Universitas Nusantara Jaya Nomor [NOMOR SURAT MASUK] tanggal [TANGGAL MASUK], dengan ini kami menyatakan:\n\n1. Telah menerima mahasiswa untuk melaksanakan [JENIS KEGIATAN]\n2. Penempatan dilakukan di [LOKASI]\n3. Periode kegiatan [TANGGAL MULAI] s/d [TANGGAL SELESAI]\n\nDemikian surat balasan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.`,
  },
  {
    jenis: 'SELESAI',
    judul: 'Surat Keterangan Selesai',
    desc: 'Surat keterangan telah menyelesaikan kegiatan KKN/PLP.',
    icon: FileCheck2,
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    template: `Yang bertanda tangan di bawah ini, kami menerangkan bahwa:\n\nNama       : [NAMA MAHASISWA]\nNIM        : [NIM]\nProdi      : [PROGRAM STUDI]\n\nTelah menyelesaikan kegiatan [JENIS KEGIATAN] di [LOKASI] pada periode [TANGGAL MULAI] s/d [TANGGAL SELESAI] dengan predikat [PREDIKAT].\n\nSurat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`,
  },
]

// ============ Letter Preview Component ============
function LetterPreview({ surat, qrDataUrl }: { surat: Surat, qrDataUrl: string | null }) {
  return (
    <div className="bg-white text-black p-6 rounded-lg border shadow-inner relative" style={{ minHeight: 400 }}>
      {/* Kop Surat */}
      <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
        <h2 className="text-lg font-bold tracking-wide">UNIVERSITAS NUSANTARA JAYA</h2>
        <p className="text-sm font-semibold">{JENIS_OPTIONS.find(o => o.value === surat.jenis)?.label ?? surat.jenis}</p>
        <p className="text-xs text-slate-600">Jl. Pendidikan No. 1, Jakarta Selatan | Telp: 021-12345678</p>
      </div>

      {/* Nomor + Tanggal */}
      <div className="flex justify-between text-xs mb-4">
        <div>
          <p>Nomor    : <span className="font-mono">{surat.nomor}</span></p>
          <p>Perihal  : <span className="font-semibold">{surat.perihal}</span></p>
        </div>
        <div className="text-right">
          <p>Jakarta, {formatDate(surat.tanggal)}</p>
        </div>
      </div>

      {/* Tujuan */}
      <p className="text-sm mb-4">Kepada Yth.<br />{surat.tujuan}</p>

      {/* Body */}
      <div className="text-sm whitespace-pre-wrap leading-relaxed mb-6">
        {surat.konten || '(Konten surat kosong)'}
      </div>

      {/* Signature */}
      <div className="flex justify-end text-sm">
        <div className="text-center">
          <p>Mengetahui,</p>
          <p>Dekan Fakultas</p>
          <div className="my-8" />
          <p className="font-semibold underline">Prof. Dr. Bambang Sutrisno</p>
          <p className="text-xs">NIDN. 0023456789</p>
        </div>
      </div>

      {/* QR Code in corner */}
      {qrDataUrl && (
        <div className="absolute bottom-4 left-4 text-center">
          <img src={qrDataUrl} alt="QR Verifikasi" className="w-20 h-20 mx-auto" />
          <p className="text-[10px] text-slate-600 mt-1">Scan untuk verifikasi</p>
        </div>
      )}
    </div>
  )
}

// ============ Main View ============
export function PersuratanView() {
  const [data, setData] = useState<Surat[]>([])
  const [loading, setLoading] = useState(true)
  const [filterJenis, setFilterJenis] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')

  // Daftar Peserta PLP state
  const [plpKelompok, setPlpKelompok] = useState<PlpKelompok[]>([])
  const [plpLoading, setPlpLoading] = useState(false)
  const [letterKelompokId, setLetterKelompokId] = useState<string | null>(null)
  const [kartuKelompokId, setKartuKelompokId] = useState<string | null>(null)

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Surat | null>(null)
  const [viewing, setViewing] = useState<Surat | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Navigation: jump to Pengaturan > Kepanitiaan PLP tab
  const setView = useAppStore(s => s.setView)
  const goToKepanitiaan = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '#panitia'
    }
    setView('pengaturan')
  }

  // Template dialog
  const [templateOpen, setTemplateOpen] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/surat')
      if (!res.ok) throw new Error('Gagal memuat')
      const json = await res.json()
      setData(json)
    } catch (e) {
      toast.error('Gagal memuat data surat')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch KKN + PLP kelompok for "Daftar Peserta" tab
  const fetchPlpKelompok = useCallback(async () => {
    setPlpLoading(true)
    try {
      // Fetch KKN, PLP1, PLP2 in parallel
      const [r0, r1, r2] = await Promise.all([
        fetch('/api/kelompok?tipe=KKN'),
        fetch('/api/kelompok?tipe=PLP1'),
        fetch('/api/kelompok?tipe=PLP2'),
      ])
      if (!r0.ok || !r1.ok || !r2.ok) throw new Error('Gagal memuat')
      const [d0, d1, d2] = await Promise.all([r0.json(), r1.json(), r2.json()])
      setPlpKelompok([...d0, ...d1, ...d2] as PlpKelompok[])
    } catch {
      toast.error('Gagal memuat data kelompok')
    } finally {
      setPlpLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlpKelompok() }, [fetchPlpKelompok])

  // Filter data client-side (already fetched all, then apply filters)
  const filtered = useMemo(() => {
    return data.filter(s => {
      if (filterJenis !== 'ALL' && s.jenis !== filterJenis) return false
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false
      return true
    })
  }, [data, filterJenis, filterStatus])

  // Stats
  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    return {
      total: data.length,
      selesai: data.filter(s => s.status === 'SELESAI').length,
      draft: data.filter(s => s.status === 'DRAFT').length,
      bulanIni: data.filter(s => {
        const d = new Date(s.tanggal)
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear
      }).length,
    }
  }, [data])

  // Generate QR when viewing
  useEffect(() => {
    if (!viewing) {
      setQrDataUrl(null)
      return
    }
    const text = `SURAT|${viewing.nomor}|${viewing.id}`
    QRCode.toDataURL(text, { width: 200, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [viewing])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (s: Surat) => {
    setEditing(s)
    setForm({
      nomor: s.nomor, jenis: s.jenis, perihal: s.perihal, pemohon: s.pemohon,
      tujuan: s.tujuan, status: s.status, konten: s.konten,
    })
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form.perihal.trim() || !form.pemohon.trim() || !form.tujuan.trim()) {
      toast.error('Perihal, pemohon, dan tujuan wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/surat/${editing.id}` : '/api/surat'
      const method = editing ? 'PUT' : 'POST'
      const body: Record<string, unknown> = {
        jenis: form.jenis, perihal: form.perihal, pemohon: form.pemohon,
        tujuan: form.tujuan, status: form.status, konten: form.konten,
      }
      if (editing) body.nomor = form.nomor
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menyimpan')
      }
      toast.success(editing ? 'Surat berhasil diperbarui' : 'Surat berhasil dibuat')
      setFormOpen(false)
      fetchData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/surat/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast.success('Surat berhasil dihapus')
      setDeleteId(null)
      fetchData()
    } catch (e) {
      toast.error('Gagal menghapus surat')
    } finally {
      setDeleting(false)
    }
  }

  const handleCetak = async (s: Surat) => {
    const text = `SURAT|${s.nomor}|${s.id}`
    let qr = ''
    try {
      qr = await QRCode.toDataURL(text, { width: 120, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
    } catch { /* skip */ }
    const html = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:0 30px;">
        <div>
          <p style="margin:0 0 4px;"><strong>Nomor:</strong> ${s.nomor}</p>
          <p style="margin:0 0 4px;"><strong>Perihal:</strong> ${s.perihal}</p>
          <p style="margin:0;"><strong>Tanggal:</strong> ${formatDate(s.tanggal)}</p>
        </div>
        ${qr ? `<div style="text-align:center;"><img src="${qr}" width="100" height="100" /><p style="font-size:9px; color:#666; margin:2px 0 0;">Scan untuk verifikasi</p></div>` : ''}
      </div>
      <div style="padding:20px 30px;">
        <p style="margin:0 0 12px;">Kepada Yth.<br/><strong>${s.tujuan}</strong></p>
        <p style="white-space:pre-wrap; line-height:1.6; font-size:12px;">${(s.konten || '(Konten surat kosong)').replace(/</g, '&lt;')}</p>
        <div style="margin-top:40px; text-align:right;">
          <p>Jakarta, ${formatDate(s.tanggal)}</p>
          <p>Mengetahui,<br/>Dekan Fakultas</p>
          <div style="height:70px;"></div>
          <p style="text-decoration:underline; font-weight:bold;">Prof. Dr. Bambang Sutrisno</p>
          <p style="font-size:10px; color:#666;">NIDN. 0023456789</p>
        </div>
        <p style="margin-top:30px; font-size:10px; color:#999; border-top:1px dashed #ccc; padding-top:8px;">
          Pemohon: ${s.pemohon} | Status: ${s.status} | Dokumen ini sah tanpa tanda tangan basah apabila QR Code dapat diverifikasi.
        </p>
      </div>
    `
    printData(`Surat - ${s.nomor}`, html)
  }

  const handleExportCSV = () => {
    const headers = ['Nomor', 'Jenis', 'Perihal', 'Pemohon', 'Tujuan', 'Tanggal', 'Status']
    const rows = filtered.map(s => [
      s.nomor, s.jenis, s.perihal, s.pemohon, s.tujuan,
      formatDateShort(s.tanggal), s.status,
    ])
    exportToCSV('persuratan', headers, rows)
  }

  const handleExportPDF = () => {
    const headers = ['Nomor', 'Jenis', 'Perihal', 'Pemohon', 'Tujuan', 'Tanggal', 'Status']
    const rows = filtered.map(s => [
      s.nomor, s.jenis, s.perihal, s.pemohon, s.tujuan,
      formatDateShort(s.tanggal), s.status,
    ])
    exportToPDF('Daftar Surat', generateTableHTML('Daftar Surat', headers, rows))
  }

  const columns: Column<Surat>[] = [
    {
      key: 'aksi', header: 'Aksi', sortable: false, width: '180px',
      render: (s) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewing(s)} title="Lihat">
            <Eye className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-sky-600" onClick={() => handleCetak(s)} title="Cetak">
            <Printer className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-600" onClick={() => openEdit(s)} title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => setDeleteId(s.id)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
    {
      key: 'nomor', header: 'Nomor Surat', sortable: true,
      render: (s) => <span className="font-mono text-xs font-semibold">{s.nomor}</span>,
    },
    { key: 'jenis', header: 'Jenis', sortable: true, render: (s) => jenisBadge(s.jenis) },
    { key: 'perihal', header: 'Perihal', sortable: true, render: (s) => (
      <span className="line-clamp-1 max-w-xs" title={s.perihal}>{s.perihal}</span>
    ) },
    { key: 'pemohon', header: 'Pemohon', sortable: true, render: (s) => (
      <span className="line-clamp-1 max-w-[160px]" title={s.pemohon}>{s.pemohon}</span>
    ) },
    { key: 'tujuan', header: 'Tujuan', sortable: true, render: (s) => (
      <span className="line-clamp-1 max-w-[160px] text-muted-foreground" title={s.tujuan}>{s.tujuan}</span>
    ) },
    {
      key: 'tanggal', header: 'Tanggal', sortable: true, sortValue: (s) => new Date(s.tanggal).getTime(),
      render: (s) => <span className="text-xs text-muted-foreground">{formatDateShort(s.tanggal)}</span>,
    },
    { key: 'status', header: 'Status', sortable: true, render: (s) => statusBadge(s.status) },
  ]

  const selectedTemplate = SURAT_TEMPLATES.find(t => t.jenis === templateOpen) || null

  return (
    <div>
      <PageHeader
        title="Persuratan"
        description="Manajemen surat menyurat terkait KKN & PLP"
        icon={FileText}
        breadcrumb={['Operasional', 'Persuratan']}
      />

      <Tabs defaultValue="daftar">
        <TabsList className="mb-4">
          <TabsTrigger value="daftar"><FileText className="w-4 h-4 mr-2" />Daftar Surat</TabsTrigger>
          <TabsTrigger value="template"><ClipboardList className="w-4 h-4 mr-2" />Template Surat</TabsTrigger>
          <TabsTrigger value="daftar-peserta"><IdCard className="w-4 h-4 mr-2" />Daftar & Kartu Peserta KKN/PLP</TabsTrigger>
        </TabsList>

        <TabsContent value="daftar" className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={FileText} label="Total Surat" value={stats.total} color="bg-primary/10 text-primary" />
            <StatCard icon={FileCheck2} label="Selesai" value={stats.selesai} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" />
            <StatCard icon={FileEdit} label="Draft" value={stats.draft} color="bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300" />
            <StatCard icon={Mail} label="Bulan Ini" value={stats.bulanIni} color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" />
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Select value={filterJenis} onValueChange={setFilterJenis}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Jenis" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Jenis</SelectItem>
                    {JENIS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading}>
                  <FilePdf className="w-4 h-4 mr-1.5" />PDF
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1.5" />Tambah Surat
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data table */}
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DataTable
              data={filtered}
              columns={columns}
              searchKeys={['nomor', 'perihal', 'pemohon', 'tujuan']}
              getRowId={(s) => s.id}
              emptyMessage="Belum ada surat"
            />
          )}
        </TabsContent>

        <TabsContent value="template" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Template Surat</h3>
              </div>
              <p className="text-sm text-muted-foreground">Klik salah satu kartu untuk melihat format template surat.</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SURAT_TEMPLATES.map((t, i) => {
              const Icon = t.icon
              return (
                <motion.div
                  key={t.jenis}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
                    onClick={() => setTemplateOpen(t.jenis)}
                  >
                    <CardContent className="p-5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${t.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">{t.judul}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.desc}</p>
                      <div className="mt-3 flex items-center text-xs font-medium text-primary group-hover:gap-2 transition-all">
                        <Eye className="w-3.5 h-3.5 mr-1" /> Lihat Template
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </TabsContent>

        {/* ===== Tab: Daftar Peserta PLP ===== */}
        <TabsContent value="daftar-peserta" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Daftar &amp; Kartu Peserta KKN/PLP</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pilih kelompok KKN atau PLP untuk mencetak daftar peserta (format surat resmi)
                    atau kartu peserta (ID card) untuk setiap mahasiswa.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={goToKepanitiaan} className="shrink-0">
                  <Settings className="w-4 h-4 mr-1.5" />Edit Kepanitiaan
                </Button>
              </div>
            </CardContent>
          </Card>

          {plpLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : plpKelompok.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Belum ada kelompok KKN/PLP. Buat kelompok di menu Pembagian KKN &amp; PLP terlebih dahulu.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plpKelompok.map((k, i) => {
                const tipeBadge = k.tipe === 'KKN' ? 'KKN' : k.tipe === 'PLP2' ? 'PLP II' : 'PLP I'
                const isKkn = k.tipe === 'KKN'
                const lokasiNama = isKkn ? (k.desa?.nama ?? '-') : (k.sekolah?.nama ?? '-')
                return (
                <motion.div
                  key={k.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                >
                  <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <h4 className="font-semibold leading-tight">{k.nama}</h4>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${
                            isKkn
                              ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                              : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                          }`}>
                            {tipeBadge}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1 mb-4 flex-1">
                        <p><span className="font-medium text-foreground">{isKkn ? 'Desa' : 'Sekolah'}:</span> {lokasiNama}</p>
                        <p><span className="font-medium text-foreground">DPL:</span> {k.dosen?.nama ?? '-'}</p>
                        <p><span className="font-medium text-foreground">Anggota:</span> {k._count.members} mahasiswa</p>
                        <p><span className="font-medium text-foreground">T.A:</span> {k.tahunAkademik} {k.semester === 'GANJIL' ? 'Ganjil' : 'Genap'}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" className="w-full" onClick={() => setKartuKelompokId(k.id)}>
                          <IdCard className="w-4 h-4 mr-1.5" />Cetak Kartu Peserta
                        </Button>
                        {!isKkn && (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => setLetterKelompokId(k.id)}>
                            <Printer className="w-4 h-4 mr-1.5" />Cetak Daftar Peserta
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Surat' : 'Tambah Surat'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Perbarui data surat.' : 'Buat surat baru. Nomor surat akan digenerate otomatis jika dikosongkan.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Jenis Surat <span className="text-rose-500">*</span></Label>
              <Select value={form.jenis} onValueChange={(v) => setForm({ ...form, jenis: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JENIS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nomor Surat</Label>
              <Input
                value={form.nomor}
                onChange={(e) => setForm({ ...form, nomor: e.target.value })}
                placeholder={editing ? '' : 'Kosongkan untuk auto-generate (format: 001/KKN-PLP/2024)'}
              />
              {!editing && <p className="text-xs text-muted-foreground">Otomatis: {String(data.length + 1).padStart(3, '0')}/KKN-PLP/{new Date().getFullYear()}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Perihal <span className="text-rose-500">*</span></Label>
              <Input
                value={form.perihal}
                onChange={(e) => setForm({ ...form, perihal: e.target.value })}
                placeholder="Perihal surat"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pemohon <span className="text-rose-500">*</span></Label>
              <Input
                value={form.pemohon}
                onChange={(e) => setForm({ ...form, pemohon: e.target.value })}
                placeholder="Nama pemohon / unit"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tujuan <span className="text-rose-500">*</span></Label>
              <Input
                value={form.tujuan}
                onChange={(e) => setForm({ ...form, tujuan: e.target.value })}
                placeholder="Tujuan surat / instansi"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Konten Surat</Label>
              <Textarea
                value={form.konten}
                onChange={(e) => setForm({ ...form, konten: e.target.value })}
                placeholder="Isi konten surat..."
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={submitForm} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {editing ? 'Simpan' : 'Buat Surat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pratinjau Surat</DialogTitle>
            <DialogDescription>Verifikasi dokumen dengan memindai QR Code pada surat.</DialogDescription>
          </DialogHeader>
          {viewing && <LetterPreview surat={viewing} qrDataUrl={qrDataUrl} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Tutup</Button>
            {viewing && (
              <Button onClick={() => handleCetak(viewing)}>
                <Printer className="w-4 h-4 mr-1.5" />Cetak
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={!!templateOpen} onOpenChange={(o) => { if (!o) setTemplateOpen(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.judul ?? 'Template'}</DialogTitle>
            <DialogDescription>{selectedTemplate?.desc}</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="bg-white text-black p-6 rounded-lg border shadow-inner">
              <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
                <h2 className="text-lg font-bold tracking-wide">UNIVERSITAS NUSANTARA JAYA</h2>
                <p className="text-sm font-semibold">{selectedTemplate.judul}</p>
                <p className="text-xs text-slate-600">Jl. Pendidikan No. 1, Jakarta Selatan | Telp: 021-12345678</p>
              </div>
              <div className="flex justify-between text-xs mb-4">
                <div>
                  <p>Nomor    : <span className="font-mono">[XXX]/KKN-PLP/[TAHUN]</span></p>
                  <p>Perihal  : <span className="font-semibold">{selectedTemplate.judul}</span></p>
                </div>
                <div className="text-right"><p>Jakarta, [TANGGAL]</p></div>
              </div>
              <p className="text-sm mb-4">Kepada Yth.<br />[TUJUAN INSTANSI]</p>
              <div className="text-sm whitespace-pre-wrap leading-relaxed mb-6">{selectedTemplate.template}</div>
              <div className="flex justify-end text-sm">
                <div className="text-center">
                  <p>Mengetahui,</p>
                  <p>Dekan Fakultas</p>
                  <div className="my-8" />
                  <p className="font-semibold underline">Prof. Dr. Bambang Sutrisno</p>
                  <p className="text-xs">NIDN. 0023456789</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Daftar Peserta PLP Letter Dialog ===== */}
      <Dialog open={!!letterKelompokId} onOpenChange={(o) => { if (!o) setLetterKelompokId(null) }}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Daftar Peserta PLP</DialogTitle>
            <DialogDescription>
              Pratinjau daftar peserta sesuai format resmi panitia. Klik &quot;Cetak / PDF&quot; untuk mencetak atau menyimpan sebagai PDF.
            </DialogDescription>
          </DialogHeader>
          {letterKelompokId && <DaftarPesertaPLPLetter kelompokId={letterKelompokId} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLetterKelompokId(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Kartu Peserta (ID Card) Dialog ===== */}
      <Dialog open={!!kartuKelompokId} onOpenChange={(o) => { if (!o) setKartuKelompokId(null) }}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kartu Peserta (ID Card)</DialogTitle>
            <DialogDescription>
              Pratinjau kartu peserta untuk setiap mahasiswa. Klik &quot;Cetak Semua Kartu&quot; untuk mencetak atau menyimpan sebagai PDF.
            </DialogDescription>
          </DialogHeader>
          {kartuKelompokId && <KartuPesertaLetter kelompokId={kartuKelompokId} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKartuKelompokId(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Surat?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Surat akan dihapus permanen dari sistem.
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
