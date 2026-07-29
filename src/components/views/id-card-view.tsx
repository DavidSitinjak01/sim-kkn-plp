'use client'

/**
 * IdCardView
 *
 * Halaman cetak Kartu Tanda Mahasiswa (KTM / ID Card).
 *
 * Fitur:
 *  - Pilihan 4 desain template (Modern Landscape, Classic Portrait,
 *    Vertical Modern, Minimalist)
 *  - Pencarian mahasiswa berdasarkan nama / NIM / prodi
 *  - Multi-select mahasiswa untuk cetak batch
 *  - Live preview real-time sesuai template & mahasiswa yang dipilih
 *  - Cetak terpilih / cetak semua (filtered)
 *
 * Data sources:
 *  - GET /api/mahasiswa      → daftar mahasiswa + prodi + fakultas
 *  - GET /api/pengaturan     → identitas kampus, logo_url, dll
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  IdCard as IdCardIcon, Search, Printer, Loader2, Users, CheckCheck,
  X, ChevronLeft, ChevronRight, Layout, AlertCircle, User,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  ID_CARD_TEMPLATES, TemplatePreview, buildPrintDocumentHtml,
  imageUrlToBase64, getInitials,
  type TemplateId, type IdCardMahasiswa, type IdCardPengaturan,
} from '@/components/id-card/id-card-templates'

// ============ Default pengaturan (fallback) ============
const DEFAULT_PENGATURAN: IdCardPengaturan = {
  logo_url: '/logo.png',
  nama_kampus: 'UNIVERSITAS NIAS RAYA',
  alamat_kampus: 'Jl. Pramuka, Nari-nari, Kelurahan Pasar Telukdalam 22865',
  no_telepon: '',
  email_kampus: '',
  website: '',
}

// ============ Main View ============
export function IdCardView() {
  const [mahasiswaList, setMahasiswaList] = useState<IdCardMahasiswa[]>([])
  const [pengaturan, setPengaturan] = useState<IdCardPengaturan>(DEFAULT_PENGATURAN)
  const [logoBase64, setLogoBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [printingAll, setPrintingAll] = useState(false)

  const [templateId, setTemplateId] = useState<TemplateId>('modern-landscape')
  const [search, setSearch] = useState('')
  const [filterProdi, setFilterProdi] = useState('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewId, setPreviewId] = useState<string | null>(null)

  // ---------- Fetch data ----------
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [mhsRes, setRes] = await Promise.all([
        fetch('/api/mahasiswa', { cache: 'no-store' }),
        fetch('/api/pengaturan', { cache: 'no-store' }),
      ])
      if (!mhsRes.ok) throw new Error('Gagal memuat data mahasiswa')
      const mhsData = await mhsRes.json() as IdCardMahasiswa[]
      setMahasiswaList(mhsData)

      if (setRes.ok) {
        const setJson = await setRes.json() as Record<string, string>
        setPengaturan({ ...DEFAULT_PENGATURAN, ...setJson })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat data'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Convert logo to base64 for print embedding
  useEffect(() => {
    const logoUrl = pengaturan.logo_url || '/logo.png'
    imageUrlToBase64(logoUrl).then(setLogoBase64)
  }, [pengaturan.logo_url])

  // ---------- Derived data ----------
  const prodiOptions = useMemo(() => {
    const map = new Map<string, string>()
    mahasiswaList.forEach(m => {
      if (m.prodi) map.set(m.prodi.id, m.prodi.nama)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [mahasiswaList])

  const filtered = useMemo(() => {
    let result = mahasiswaList
    if (filterProdi !== 'ALL') {
      result = result.filter(m => m.prodi?.id === filterProdi)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(m =>
        m.nama.toLowerCase().includes(q) ||
        m.nim.toLowerCase().includes(q) ||
        (m.prodi?.nama?.toLowerCase().includes(q) ?? false)
      )
    }
    return result
  }, [mahasiswaList, search, filterProdi])

  const selectedList = useMemo(
    () => filtered.filter(m => selectedIds.has(m.id)),
    [filtered, selectedIds]
  )

  // Preview mahasiswa: explicitly chosen, else first selected, else first filtered
  const previewMhs = useMemo(() => {
    if (previewId) {
      const found = mahasiswaList.find(m => m.id === previewId)
      if (found) return found
    }
    if (selectedList.length > 0) return selectedList[0]
    if (filtered.length > 0) return filtered[0]
    return null
  }, [previewId, selectedList, filtered, mahasiswaList])

  const previewIndex = useMemo(() => {
    if (!previewMhs) return -1
    return filtered.findIndex(m => m.id === previewMhs.id)
  }, [previewMhs, filtered])

  const currentTemplate = useMemo(
    () => ID_CARD_TEMPLATES.find(t => t.id === templateId)!,
    [templateId]
  )

  const stats = useMemo(() => ({
    total: mahasiswaList.length,
    filtered: filtered.length,
    selected: selectedIds.size,
  }), [mahasiswaList, filtered, selectedIds])

  // ---------- Selection handlers ----------
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map(m => m.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // ---------- Preview navigation ----------
  const goPrev = () => {
    if (filtered.length === 0) return
    const idx = previewIndex < 0 ? 0 : (previewIndex - 1 + filtered.length) % filtered.length
    setPreviewId(filtered[idx].id)
  }
  const goNext = () => {
    if (filtered.length === 0) return
    const idx = previewIndex < 0 ? 0 : (previewIndex + 1) % filtered.length
    setPreviewId(filtered[idx].id)
  }

  // ---------- Print handlers ----------
  const openPrintWindow = (list: IdCardMahasiswa[]) => {
    if (list.length === 0) {
      toast.error('Tidak ada mahasiswa untuk dicetak')
      return
    }
    const html = buildPrintDocumentHtml(templateId, list, pengaturan, logoBase64 ?? '')
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) {
      toast.error('Popup diblokir. Izinkan popup untuk mencetak.')
      return
    }
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 800)
  }

  const handlePrintSelected = async () => {
    if (selectedList.length === 0) {
      toast.error('Pilih minimal satu mahasiswa untuk dicetak')
      return
    }
    setPrinting(true)
    try {
      openPrintWindow(selectedList)
      toast.success(`Mencetak ${selectedList.length} ID card...`)
    } catch {
      toast.error('Gagal mencetak ID card')
    } finally {
      setPrinting(false)
    }
  }

  const handlePrintAll = async () => {
    if (filtered.length === 0) {
      toast.error('Tidak ada mahasiswa untuk dicetak')
      return
    }
    setPrintingAll(true)
    try {
      openPrintWindow(filtered)
      toast.success(`Mencetak ${filtered.length} ID card...`)
    } catch {
      toast.error('Gagal mencetak ID card')
    } finally {
      setPrintingAll(false)
    }
  }

  const handlePrintOne = (m: IdCardMahasiswa) => {
    try {
      openPrintWindow([m])
      toast.success(`Mencetak ID card: ${m.nama}`)
    } catch {
      toast.error('Gagal mencetak ID card')
    }
  }

  // ---------- Render ----------
  return (
    <div>
      <PageHeader
        title="Cetak ID Card Mahasiswa"
        description="Pilih desain, pilih mahasiswa, dan cetak Kartu Tanda Mahasiswa (KTM)."
        icon={IdCardIcon}
        breadcrumb={['Sistem', 'Cetak ID Card']}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Total Mahasiswa</p>
                <p className="text-xl font-bold tracking-tight">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                <Search className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Hasil Filter</p>
                <p className="text-xl font-bold tracking-tight">{stats.filtered}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Terpilih</p>
                <p className="text-xl font-bold tracking-tight">{stats.selected}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Template Gallery */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Layout className="w-4 h-4 text-primary" />
                Pilih Desain ID Card
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Pilih salah satu dari 4 desain template yang tersedia.</p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {currentTemplate.orientasi === 'landscape' ? 'Landscape' : 'Portrait'}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ID_CARD_TEMPLATES.map((t) => {
              const active = t.id === templateId
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    'text-left rounded-xl border-2 p-3 transition-all relative group',
                    active
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-accent/40'
                  )}
                >
                  {active && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <CheckCheck className="w-3 h-3" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${t.accent}20`, color: t.accent }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={cn('text-sm font-semibold', active && 'text-primary')}>{t.nama}</span>
                  </div>
                  {/* Mini preview swatch */}
                  <div
                    className="rounded-md mb-2 flex items-center justify-center text-[8px] font-bold text-white/90"
                    style={{
                      background: `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)`,
                      height: t.orientasi === 'portrait' ? '52px' : '34px',
                    }}
                  >
                    {t.orientasi === 'portrait' ? 'PORTRAIT' : 'LANDSCAPE'}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">{t.deskripsi}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Search & filter bar */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIM, atau prodi..."
              className="pl-9 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Prodi:</Label>
            <Select value={filterProdi} onValueChange={setFilterProdi}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Prodi</SelectItem>
                {prodiOptions.map(([id, nama]) => (
                  <SelectItem key={id} value={id}>{nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main: List + Preview */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      ) : mahasiswaList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <IdCardIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Belum ada data mahasiswa</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              Tambahkan data mahasiswa terlebih dahulu di menu Data Mahasiswa sebelum mencetak ID Card.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left: Mahasiswa list */}
          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              {/* List header */}
              <div className="flex items-center justify-between gap-2 p-3 border-b border-border sticky top-0 bg-card rounded-t-xl z-10">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={(checked) => {
                      if (checked) selectAllFiltered()
                      else clearSelection()
                    }}
                  />
                  <span className="text-xs font-medium">
                    {filtered.length} mahasiswa
                    {selectedIds.size > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px] h-5">{selectedIds.size} dipilih</Badge>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllFiltered} disabled={filtered.length === 0}>
                    Pilih Semua
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection} disabled={selectedIds.size === 0}>
                    Reset
                  </Button>
                </div>
              </div>

              {/* List */}
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Tidak ada mahasiswa yang cocok dengan filter.</p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
                  {filtered.map((m, idx) => {
                    const isSelected = selectedIds.has(m.id)
                    const isPreview = previewMhs?.id === m.id
                    return (
                      <div
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewId(m.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setPreviewId(m.id)
                          }
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isPreview ? 'bg-primary/10' : 'hover:bg-accent/40'
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(m.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
                          {m.foto ? (
                            <img
                              src={m.foto}
                              alt={m.nama}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const t = e.currentTarget
                                t.style.display = 'none'
                                const p = t.parentElement
                                if (p) p.innerHTML = `<span class="text-[10px] font-bold text-muted-foreground">${getInitials(m.nama)}</span>`
                              }}
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">{getInitials(m.nama)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{m.nama}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{m.nim}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{m.prodi?.nama ?? '-'}</p>
                        </div>
                        {isSelected && (
                          <Badge variant="default" className="text-[9px] h-5 shrink-0">Dipilih</Badge>
                        )}
                        {isPreview && !isSelected && (
                          <Badge variant="outline" className="text-[9px] h-5 shrink-0 border-primary text-primary">Preview</Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Preview pane */}
          <Card className="lg:col-span-3">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <IdCardIcon className="w-4 h-4 text-primary" />
                    Preview Desain "{currentTemplate.nama}"
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Klik mahasiswa di daftar untuk melihat preview-nya di sini.
                  </p>
                </div>
                {previewMhs && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={goPrev} disabled={filtered.length <= 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">
                      {previewIndex >= 0 ? `${previewIndex + 1} / ${filtered.length}` : '-'}
                    </span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={goNext} disabled={filtered.length <= 1}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Preview canvas */}
              <div className="bg-muted/30 rounded-lg border p-6 flex items-center justify-center min-h-[520px] overflow-auto">
                {previewMhs ? (
                  <motion.div
                    key={`${templateId}-${previewMhs.id}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TemplatePreview
                      templateId={templateId}
                      m={previewMhs}
                      p={pengaturan}
                      logoUrl={pengaturan.logo_url || '/logo.png'}
                    />
                  </motion.div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <IdCardIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Pilih mahasiswa untuk melihat preview ID Card.</p>
                  </div>
                )}
              </div>

              {/* Preview info + single print */}
              {previewMhs && (
                <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{previewMhs.nama}</span>
                    <span className="mx-1.5">•</span>
                    <span className="font-mono">{previewMhs.nim}</span>
                    <span className="mx-1.5">•</span>
                    <span>{previewMhs.prodi?.nama}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handlePrintOne(previewMhs)}>
                    <Printer className="w-4 h-4 mr-1.5" />
                    Cetak Kartu Ini
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky action bar (bottom) */}
      {!loading && mahasiswaList.length > 0 && (
        <div className="sticky bottom-4 mt-4 z-20">
          <Card className="border-primary/30 shadow-lg">
            <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Printer className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    Desain: <span className="text-primary">{currentTemplate.nama}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} mahasiswa terpilih untuk dicetak`
                      : `Akan mencetak semua ${filtered.length} mahasiswa (filtered)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={handlePrintAll}
                  disabled={printingAll || filtered.length === 0}
                >
                  {printingAll ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}
                  Cetak Semua ({filtered.length})
                </Button>
                <Button
                  onClick={handlePrintSelected}
                  disabled={printing || selectedIds.size === 0}
                >
                  {printing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}
                  Cetak Terpilih ({selectedIds.size})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Helper notice */}
      {!loading && mahasiswaList.length > 0 && selectedIds.size === 0 && (
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 border border-border">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">Tips:</strong> Centang mahasiswa yang ingin dicetak (bisa banyak sekaligus),
            lalu klik <strong>Cetak Terpilih</strong>. Atau gunakan <strong>Cetak Semua</strong> untuk mencetak seluruh
            mahasiswa sesuai filter. Pastikan izinkan popup dari situs ini agar jendela cetak dapat muncul.
          </p>
        </div>
      )}
    </div>
  )
}
