'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Info,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface PreviewRow {
  row: number
  nama: string
  nidn: string | null
  email: string | null
  noHp: string | null
  prodiName: string
  prodiId: string | null
  fakultasName: string
  fakultasId: string | null
  jabatan: string
  fromColumn: string
}

interface PreviewResult {
  totalRows: number
  headers: string[]
  nameColumns: Array<{ index: number; header: string; jabatan: string }>
  detectedColumns: Record<string, number>
  preview: PreviewRow[]
  matchedProdi: Array<{ excelName: string; dbProdi: { id: string; nama: string } }>
  unmatchedProdi: Array<{ excelName: string; count: number }>
  matchedFakultas: Array<{ excelName: string; dbFakultas: { id: string; nama: string } }>
  unmatchedFakultas: Array<{ excelName: string; count: number }>
  availableProdi: { id: string; nama: string }[]
  availableFakultas: { id: string; nama: string }[]
}

interface ImportResult {
  success: boolean
  imported: number
  updated: number
  skipped: number
  errors: Array<{ row: number; nama: string; error: string }>
  totalRows: number
}

interface ImportExcelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const JABATAN_OPTIONS = [
  'Dosen Pendamping',
  'Koordinator Lapangan',
  'Dosen Pembimbing',
  'Pembimbing Akademik',
  'Lektor',
  'Asisten Ahli',
  'Tenaga Pengajar',
  'Lainnya',
]

export function ImportExcelDialog({ open, onOpenChange, onSuccess }: ImportExcelDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<'upload' | 'configure' | 'importing' | 'done'>('upload')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [prodiMapping, setProdiMapping] = useState<Record<string, string>>({})
  const [fakultasMapping, setFakultasMapping] = useState<Record<string, string>>({})
  const [jabatanOverride, setJabatanOverride] = useState<string>('') // '' = auto (pakai header kolom)
  const [skipDuplicate, setSkipDuplicate] = useState(true)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setStep('upload')
    setPreview(null)
    setProdiMapping({})
    setFakultasMapping({})
    setJabatanOverride('')
    setResult(null)
    setLoading(false)
  }, [])

  const handleClose = (open: boolean) => {
    if (!open) reset()
    onOpenChange(open)
  }

  // ── Step 1: Upload & preview ──────────────────────────────────────────
  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) return
    if (!/\.(xlsx|xls|csv)$/i.test(selectedFile.name)) {
      toast.error('File harus berformat .xlsx, .xls, atau .csv')
      return
    }
    setFile(selectedFile)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await fetch('/api/dosen/import/preview', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal memproses file')

      // Init prodi & fakultas mapping dari auto-match
      const initProdiMap: Record<string, string> = {}
      json.matchedProdi.forEach((m: { excelName: string; dbProdi: { id: string } }) => {
        initProdiMap[m.excelName] = m.dbProdi.id
      })
      setProdiMapping(initProdiMap)

      const initFakultasMap: Record<string, string> = {}
      json.matchedFakultas.forEach((m: { excelName: string; dbFakultas: { id: string } }) => {
        initFakultasMap[m.excelName] = m.dbFakultas.id
      })
      setFakultasMapping(initFakultasMap)

      // Default jabatanOverride: kalau cuma 1 kolom nama dengan header generik
      // (mis. "Nama Dosen" / "Nama"), pakai "Dosen Pendamping".
      // Kalau ada kolom spesifik (Koordinator Lapangan / Dosen Pendamping), biarkan kosong (auto).
      if (json.nameColumns.length === 1) {
        const jab = json.nameColumns[0].jabatan
        setJabatanOverride(jab)
      } else {
        setJabatanOverride('') // multi-column → pakai header kolom masing-masing
      }

      setPreview(json)
      setStep('configure')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membaca file Excel')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Configure & import ────────────────────────────────────────
  const handleImport = async () => {
    if (preview?.unmatchedProdi.length) {
      const stillUnmapped = preview.unmatchedProdi.filter((p) => !prodiMapping[p.excelName])
      if (stillUnmapped.length > 0) {
        toast.error(`Masih ada ${stillUnmapped.length} program studi belum dipetakan. Contoh: ${stillUnmapped[0].excelName}`)
        return
      }
    }
    if (preview?.unmatchedFakultas.length) {
      const stillUnmapped = preview.unmatchedFakultas.filter((f) => !fakultasMapping[f.excelName])
      if (stillUnmapped.length > 0) {
        toast.error(`Masih ada ${stillUnmapped.length} fakultas belum dipetakan. Contoh: ${stillUnmapped[0].excelName}`)
        return
      }
    }

    setStep('importing')
    setLoading(true)
    try {
      const fd = new FormData()
      if (!file) throw new Error('File tidak ditemukan')
      fd.append('file', file)
      fd.append('jabatanOverride', jabatanOverride)
      fd.append('prodiMapping', JSON.stringify(prodiMapping))
      fd.append('fakultasMapping', JSON.stringify(fakultasMapping))
      fd.append('skipDuplicate', skipDuplicate ? 'true' : 'false')

      const res = await fetch('/api/dosen/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal import')

      setResult(json)
      setStep('done')
      if (json.imported > 0 || json.updated > 0) {
        toast.success(`Berhasil: ${json.imported} baru + ${json.updated} diperbarui${json.skipped > 0 ? ` + ${json.skipped} di-skip` : ''}`)
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengimpor data')
      setStep('configure')
    } finally {
      setLoading(false)
    }
  }

  // ── Download template ─────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    try {
      toast.info('Mengunduh template Excel...')
      const res = await fetch('/api/dosen/import/template')
      if (!res.ok) throw new Error('Gagal mengunduh template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template-import-dosen.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Template berhasil diunduh')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengunduh template')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Import Data Dosen dari Excel
          </DialogTitle>
          <DialogDescription>
            Upload file Excel untuk menambahkan banyak dosen sekaligus. Hanya kolom <strong>Nama</strong> yang wajib — lainnya opsional.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            {/* ─────────────── Step 1: Upload ─────────────── */}
            {step === 'upload' && (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-emerald-50', 'dark:bg-emerald-900/10', 'border-emerald-400') }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('bg-emerald-50', 'dark:bg-emerald-900/10', 'border-emerald-400') }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('bg-emerald-50', 'dark:bg-emerald-900/10', 'border-emerald-400')
                    const f = e.dataTransfer.files[0]
                    if (f) handleFileSelect(f)
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />
                  {loading ? (
                    <Loader2 className="w-10 h-10 mx-auto animate-spin text-muted-foreground mb-3" />
                  ) : (
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  )}
                  <p className="text-sm font-medium">
                    {loading ? 'Memproses file...' : 'Klik atau drag file ke sini'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: .xlsx, .xls, .csv
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex gap-2 items-start">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                      <p className="font-semibold">Format kolom yang dideteksi otomatis:</p>
                      <ul className="list-disc list-inside space-y-0.5 ml-1">
                        <li><strong>Nama Dosen</strong> / Nama / Dosen Pendamping / Koordinator Lapangan (wajib)</li>
                        <li>NIDN / NIP (opsional)</li>
                        <li>Fakultas (opsional, auto-match ke DB)</li>
                        <li>Program Studi (opsional, auto-match)</li>
                        <li>Email (opsional)</li>
                        <li>No HP / No. HP / Nomor HP (opsional)</li>
                      </ul>
                      <p className="mt-2 italic">
                        File dengan 2 kolom nama (mis. "Koordinator Lapangan" + "Dosen Pendamping") akan otomatis di-import dengan jabatan sesuai header kolom.
                      </p>
                    </div>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="w-full">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  Download Template Excel (.xlsx)
                </Button>
              </div>
            )}

            {/* ─────────────── Step 2: Configure ─────────────── */}
            {step === 'configure' && preview && (
              <div className="space-y-4">
                {/* File info */}
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {preview.totalRows} dosen terdeteksi dari {preview.nameColumns.length} kolom nama
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => { reset(); fileInputRef.current?.click() }}
                  >
                    Ganti File
                  </Button>
                </div>

                {/* Detected columns info */}
                <div className="bg-muted/30 border rounded-md p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-sm">Kolom Terdeteksi:</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {preview.nameColumns.map((nc, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Badge variant="default" className="text-[9px] h-4 px-1">NAMA</Badge>
                        <span className="font-mono text-xs truncate" title={nc.header}>{nc.header}</span>
                        <span className="text-muted-foreground">→ {nc.jabatan}</span>
                      </div>
                    ))}
                    {preview.detectedColumns.nidn !== -1 && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">NIDN</Badge>
                        <span className="font-mono text-xs truncate">{preview.headers[preview.detectedColumns.nidn]}</span>
                      </div>
                    )}
                    {preview.detectedColumns.email !== -1 && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">EMAIL</Badge>
                        <span className="font-mono text-xs truncate">{preview.headers[preview.detectedColumns.email]}</span>
                      </div>
                    )}
                    {preview.detectedColumns.noHp !== -1 && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">HP</Badge>
                        <span className="font-mono text-xs truncate">{preview.headers[preview.detectedColumns.noHp]}</span>
                      </div>
                    )}
                    {preview.detectedColumns.fakultas !== -1 && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">FAKULTAS</Badge>
                        <span className="font-mono text-xs truncate">{preview.headers[preview.detectedColumns.fakultas]}</span>
                      </div>
                    )}
                    {preview.detectedColumns.prodi !== -1 && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">PRODI</Badge>
                        <span className="font-mono text-xs truncate">{preview.headers[preview.detectedColumns.prodi]}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Unmatched fakultas mapping */}
                {preview.unmatchedFakultas.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {preview.unmatchedFakultas.length} fakultas butuh pemetaan manual
                      </p>
                    </div>
                    <div className="space-y-2 pl-6">
                      {preview.unmatchedFakultas.map((f) => (
                        <div key={f.excelName} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate font-mono">{f.excelName}</p>
                            <p className="text-[10px] text-muted-foreground">{f.count} dosen</p>
                          </div>
                          <Select
                            value={fakultasMapping[f.excelName] || ''}
                            onValueChange={(v) => setFakultasMapping((prev) => ({ ...prev, [f.excelName]: v }))}
                          >
                            <SelectTrigger className="w-[220px] h-8 text-xs">
                              <SelectValue placeholder="Pilih fakultas..." />
                            </SelectTrigger>
                            <SelectContent>
                              {preview.availableFakultas.map((fk) => (
                                <SelectItem key={fk.id} value={fk.id} className="text-xs">
                                  {fk.nama}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auto-matched fakultas */}
                {preview.matchedFakultas.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {preview.matchedFakultas.length} fakultas terpetakan otomatis
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {preview.matchedFakultas.map((m) => (
                        <Badge key={m.excelName} variant="secondary" className="text-[10px]">
                          {m.excelName} → {m.dbFakultas.nama}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched prodi mapping */}
                {preview.unmatchedProdi.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {preview.unmatchedProdi.length} program studi butuh pemetaan manual
                      </p>
                    </div>
                    <div className="space-y-2 pl-6">
                      {preview.unmatchedProdi.map((p) => (
                        <div key={p.excelName} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate font-mono">{p.excelName}</p>
                            <p className="text-[10px] text-muted-foreground">{p.count} dosen</p>
                          </div>
                          <Select
                            value={prodiMapping[p.excelName] || ''}
                            onValueChange={(v) => setProdiMapping((prev) => ({ ...prev, [p.excelName]: v }))}
                          >
                            <SelectTrigger className="w-[220px] h-8 text-xs">
                              <SelectValue placeholder="Pilih prodi..." />
                            </SelectTrigger>
                            <SelectContent>
                              {preview.availableProdi.map((pr) => (
                                <SelectItem key={pr.id} value={pr.id} className="text-xs">
                                  {pr.nama}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auto-matched prodi */}
                {preview.matchedProdi.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {preview.matchedProdi.length} program studi terpetakan otomatis
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {preview.matchedProdi.map((m) => (
                        <Badge key={m.excelName} variant="secondary" className="text-[10px]">
                          {m.excelName} → {m.dbProdi.nama}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Jabatan default (hanya jika 1 kolom nama) */}
                {preview.nameColumns.length === 1 && (
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-xs">Jabatan Default untuk Import Ini</Label>
                    <Select value={jabatanOverride} onValueChange={setJabatanOverride}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {JABATAN_OPTIONS.map((j) => (
                          <SelectItem key={j} value={j}>{j}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Semua dosen dari file ini akan diberi jabatan ini. Bisa di-edit per-dosen setelah import.
                    </p>
                  </div>
                )}

                {preview.nameColumns.length > 1 && (
                  <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-md p-2.5 text-xs text-sky-800 dark:text-sky-200">
                    <p>
                      <strong>Multi-kolom nama terdeteksi.</strong> Setiap kolom akan di-import dengan
                      jabatan sesuai header-nya masing-masing:
                    </p>
                    <ul className="mt-1 list-disc list-inside">
                      {preview.nameColumns.map((nc, i) => (
                        <li key={i}><span className="font-mono">{nc.header}</span> → {nc.jabatan}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="skip-dup-dosen"
                    checked={skipDuplicate}
                    onCheckedChange={(v) => setSkipDuplicate(v === true)}
                  />
                  <Label htmlFor="skip-dup-dosen" className="text-xs cursor-pointer">
                    Update dosen yang sudah ada (by NIDN atau nama exact) — rekomendasi: ON
                  </Label>
                </div>

                {/* Preview rows */}
                <details className="border-t pt-3">
                  <summary className="text-sm font-semibold cursor-pointer">
                    Preview {Math.min(preview.preview.length, 30)} baris pertama
                  </summary>
                  <div className="mt-2 overflow-x-auto border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left font-medium">Baris</th>
                          <th className="p-2 text-left font-medium">Nama</th>
                          <th className="p-2 text-left font-medium">NIDN</th>
                          <th className="p-2 text-left font-medium">Jabatan</th>
                          <th className="p-2 text-left font-medium">Fakultas</th>
                          <th className="p-2 text-left font-medium">Prodi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 text-muted-foreground">{r.row}</td>
                            <td className="p-2">{r.nama}</td>
                            <td className="p-2 font-mono text-muted-foreground">{r.nidn || '-'}</td>
                            <td className="p-2">
                              <Badge variant="secondary" className="text-[9px] h-4 px-1">{r.jabatan}</Badge>
                            </td>
                            <td className="p-2 max-w-[120px] truncate" title={r.fakultasName}>{r.fakultasName || '-'}</td>
                            <td className="p-2 max-w-[120px] truncate" title={r.prodiName}>{r.prodiName || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}

            {/* ─────────────── Step 3: Importing ─────────────── */}
            {step === 'importing' && (
              <div className="py-12 text-center">
                <Loader2 className="w-10 h-10 mx-auto animate-spin text-emerald-600 mb-3" />
                <p className="text-sm font-medium">Mengimpor data dosen...</p>
                <p className="text-xs text-muted-foreground mt-1">Mohon tunggu, jangan tutup dialog</p>
              </div>
            )}

            {/* ─────────────── Step 4: Done ─────────────── */}
            {step === 'done' && result && (
              <div className="space-y-4">
                <div className={`rounded-lg p-4 text-center ${result.imported > 0 || result.updated > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
                  <CheckCircle2 className={`w-10 h-10 mx-auto mb-2 ${result.imported > 0 || result.updated > 0 ? 'text-emerald-600' : 'text-amber-500'}`} />
                  <p className="text-lg font-bold">
                    {result.imported} baru + {result.updated} diperbarui
                    {result.skipped > 0 && <span className="text-sm text-muted-foreground"> + {result.skipped} di-skip</span>}
                  </p>
                  {result.errors.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Semua data berhasil diproses
                    </p>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      Detail ({result.errors.length} catatan)
                    </p>
                    <ScrollArea className="h-[200px] border rounded-md">
                      <div className="divide-y">
                        {result.errors.map((err, i) => (
                          <div key={i} className="p-2 text-xs flex gap-2">
                            <Badge variant="outline" className="text-[10px] h-5">B{err.row}</Badge>
                            <span className="text-muted-foreground truncate max-w-[150px]" title={err.nama}>{err.nama || '-'}</span>
                            <span className="flex-1" title={err.error}>{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Batal
            </Button>
          )}
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={reset}>
                <Upload className="w-4 h-4 mr-1" />
                Upload Ulang
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Import {preview?.totalRows ?? 0} Dosen
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => handleClose(false)}>
              Selesai
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
