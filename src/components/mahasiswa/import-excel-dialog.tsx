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

interface AvailableProdi {
  id: string
  nama: string
}

interface PreviewRow {
  row: number
  nim: string
  nama: string
  jenisKelamin: 'L' | 'P' | null
  prodiName: string
  alamat: string
  noHp: string
  fotoUrl: string | null
}

interface PreviewResult {
  totalRows: number
  headers: string[]
  detectedColumns: Record<string, number>
  preview: PreviewRow[]
  matchedProdi: Array<{ excelName: string; dbProdi: { id: string; nama: string } }>
  unmatchedProdi: Array<{ excelName: string; count: number }>
  availableProdi: AvailableProdi[]
}

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: Array<{ row: number; nim: string; nama: string; error: string }>
  totalRows: number
}

interface ImportExcelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportExcelDialog({ open, onOpenChange, onSuccess }: ImportExcelDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<'upload' | 'configure' | 'importing' | 'done'>('upload')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [prodiMapping, setProdiMapping] = useState<Record<string, string>>({})
  const [defaults, setDefaults] = useState({
    tempatLahir: '',
    tanggalLahir: '',
    emailPattern: '{nim}@uniraya.ac.id',
    semester: '5',
    angkatan: '2024',
  })
  const [skipDuplicate, setSkipDuplicate] = useState(true)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setStep('upload')
    setPreview(null)
    setProdiMapping({})
    setResult(null)
    setLoading(false)
  }, [])

  const handleClose = (open: boolean) => {
    if (!open) reset()
    onOpenChange(open)
  }

  // ── Step 1: Upload file & preview ────────────────────────────────────────
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
      const res = await fetch('/api/mahasiswa/import/preview', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal memproses file')

      // Initialize prodi mapping from auto-matched results
      const initialMap: Record<string, string> = {}
      json.matchedProdi.forEach((m: { excelName: string; dbProdi: { id: string } }) => {
        initialMap[m.excelName] = m.dbProdi.id
      })
      setProdiMapping(initialMap)
      setPreview(json)
      setStep('configure')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membaca file Excel')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Configure defaults & mapping, then import ───────────────────
  const handleImport = async () => {
    if (!defaults.tempatLahir.trim()) {
      toast.error('Tempat lahir default wajib diisi')
      return
    }
    if (!defaults.tanggalLahir) {
      toast.error('Tanggal lahir default wajib diisi')
      return
    }

    if (preview?.unmatchedProdi.length) {
      const stillUnmapped = preview.unmatchedProdi.filter((p) => !prodiMapping[p.excelName])
      if (stillUnmapped.length > 0) {
        toast.error(`Masih ada ${stillUnmapped.length} program studi belum dipetakan. Contoh: ${stillUnmapped[0].excelName}`)
        return
      }
    }

    setStep('importing')
    setLoading(true)
    try {
      const fd = new FormData()
      if (!file) throw new Error('File tidak ditemukan')
      fd.append('file', file)
      fd.append('tempatLahir', defaults.tempatLahir)
      fd.append('tanggalLahir', defaults.tanggalLahir)
      fd.append('emailPattern', defaults.emailPattern)
      fd.append('semester', defaults.semester)
      fd.append('angkatan', defaults.angkatan)
      fd.append('prodiMapping', JSON.stringify(prodiMapping))
      fd.append('skipDuplicate', skipDuplicate ? 'true' : 'false')

      const res = await fetch('/api/mahasiswa/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal import')

      setResult(json)
      setStep('done')
      if (json.imported > 0) {
        toast.success(`Berhasil mengimpor ${json.imported} mahasiswa`)
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengimpor data')
      setStep('configure')
    } finally {
      setLoading(false)
    }
  }

  // ── Download template ────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = ['Nama Lengkap', 'NIM', 'Jenis Kelamin', 'Program Studi', 'Nomor WA Aktif', 'Alamat Asal', 'Pasfoto (URL)']
    const sample = [
      ['Budi Santoso', '23200211001', 'Laki-laki', 'Pendidikan Bahasa Inggris', '081234567890', 'Desa Contoh, Kec. Contoh, Nias Selatan', ''],
      ['Siti Aminah', '23200211002', 'Perempuan', 'Pendidikan Matematika', '081234567891', 'Jl. Contoh No. 1', ''],
    ]
    const csv = [headers, ...sample].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-import-mahasiswa.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Import Data Mahasiswa dari Excel
          </DialogTitle>
          <DialogDescription>
            Upload file Excel/CSV untuk menambahkan banyak mahasiswa sekaligus.
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
                        <li>Nama Lengkap / Nama</li>
                        <li>NIM</li>
                        <li>Jenis Kelamin (Laki-laki / Perempuan)</li>
                        <li>Program Studi</li>
                        <li>Nomor WA / No HP</li>
                        <li>Alamat Asal / Alamat</li>
                        <li>Pasfoto / Foto (URL Google Drive OK)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="w-full">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  Download Template CSV
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
                        {preview.totalRows} baris data terdeteksi
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
                            <p className="text-[10px] text-muted-foreground">{p.count} mahasiswa</p>
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

                {/* Auto-matched prodi (info only) */}
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

                {/* Default values for missing fields */}
                <div className="space-y-3 border-t pt-3">
                  <p className="text-sm font-semibold">
                    Nilai default untuk field yang tidak ada di Excel
                  </p>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Data Excel tidak memiliki kolom tempat lahir, tanggal lahir, email, semester, angkatan.
                    Isi default ini akan diterapkan ke SEMUA mahasiswa yang diimpor.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tempat Lahir <span className="text-rose-500">*</span></Label>
                      <Input
                        value={defaults.tempatLahir}
                        onChange={(e) => setDefaults((d) => ({ ...d, tempatLahir: e.target.value }))}
                        placeholder="mis. Gunungsitoli"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tanggal Lahir <span className="text-rose-500">*</span></Label>
                      <Input
                        type="date"
                        value={defaults.tanggalLahir}
                        onChange={(e) => setDefaults((d) => ({ ...d, tanggalLahir: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Pattern Email</Label>
                      <Input
                        value={defaults.emailPattern}
                        onChange={(e) => setDefaults((d) => ({ ...d, emailPattern: e.target.value }))}
                        placeholder="{nim}@uniraya.ac.id"
                        className="h-8 text-xs font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Gunakan <code className="bg-muted px-1 rounded">{'{nim}'}</code> untuk NIM, <code className="bg-muted px-1 rounded">{'{nama}'}</code> untuk nama (huruf kecil, spasi → titik)
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Semester</Label>
                      <Input
                        type="number"
                        value={defaults.semester}
                        onChange={(e) => setDefaults((d) => ({ ...d, semester: e.target.value }))}
                        className="h-8 text-xs"
                        min="1" max="14"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Angkatan</Label>
                      <Input
                        type="number"
                        value={defaults.angkatan}
                        onChange={(e) => setDefaults((d) => ({ ...d, angkatan: e.target.value }))}
                        className="h-8 text-xs"
                        min="2000" max="2099"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="skip-dup"
                      checked={skipDuplicate}
                      onCheckedChange={(v) => setSkipDuplicate(v === true)}
                    />
                    <Label htmlFor="skip-dup" className="text-xs cursor-pointer">
                      Lewati NIM yang sudah terdaftar (rekomendasi: ON)
                    </Label>
                  </div>
                </div>

                {/* Preview rows */}
                <details className="border-t pt-3">
                  <summary className="text-sm font-semibold cursor-pointer">
                    Preview 20 baris pertama
                  </summary>
                  <div className="mt-2 overflow-x-auto border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left font-medium">Baris</th>
                          <th className="p-2 text-left font-medium">NIM</th>
                          <th className="p-2 text-left font-medium">Nama</th>
                          <th className="p-2 text-left font-medium">JK</th>
                          <th className="p-2 text-left font-medium">Prodi</th>
                          <th className="p-2 text-left font-medium">No HP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 text-muted-foreground">{r.row}</td>
                            <td className="p-2 font-mono">{r.nim}</td>
                            <td className="p-2">{r.nama}</td>
                            <td className="p-2">{r.jenisKelamin === 'L' ? 'L' : r.jenisKelamin === 'P' ? 'P' : '?'}</td>
                            <td className="p-2 max-w-[150px] truncate" title={r.prodiName}>{r.prodiName}</td>
                            <td className="p-2">{r.noHp}</td>
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
                <p className="text-sm font-medium">Mengimpor data mahasiswa...</p>
                <p className="text-xs text-muted-foreground mt-1">Mohon tunggu, jangan tutup dialog</p>
              </div>
            )}

            {/* ─────────────── Step 4: Done ─────────────── */}
            {step === 'done' && result && (
              <div className="space-y-4">
                <div className={`rounded-lg p-4 text-center ${result.imported > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
                  <CheckCircle2 className={`w-10 h-10 mx-auto mb-2 ${result.imported > 0 ? 'text-emerald-600' : 'text-amber-500'}`} />
                  <p className="text-lg font-bold">
                    {result.imported} mahasiswa berhasil diimpor
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.skipped} dilewati (NIM duplikat)
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
                            <span className="text-muted-foreground font-mono">{err.nim || '-'}</span>
                            <span className="flex-1 truncate" title={err.error}>{err.error}</span>
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
                Import {preview?.totalRows ?? 0} Mahasiswa
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
