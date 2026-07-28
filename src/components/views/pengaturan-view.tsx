'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Settings, Save, Loader2, Building2, CalendarDays, Plug, Palette,
  Database, Download, Upload, ShieldCheck, Moon, Sun, Mail, MessageSquare,
  MapPin, QrCode, Info, Send, Bell, AlertCircle, CheckCircle2, Link as LinkIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { refreshBranding } from '@/lib/branding'

// ============ Types ============
type SettingsMap = Record<string, string>

const DEFAULT_SETTINGS: SettingsMap = {
  nama_kampus: '',
  alamat_kampus: '',
  no_telepon: '',
  email_kampus: '',
  website: '',
  logo_url: '',
  favicon_url: '',
  tahun_akademik: '',
  semester: 'GANJIL',
  smtp_host: '',
  smtp_port: '',
  wa_gateway: '',
  wa_api_key: '',
  wa_sender: '',
  wa_enabled: 'false',
  maps_api_key: '',
  qr_code_setting: 'enabled',
  theme: 'light',
}

export function PengaturanView() {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingWa, setTestingWa] = useState(false)
  const [waTestNumber, setWaTestNumber] = useState('')

  // Theme store integration (read-only display)
  const theme = useAppStore(s => s.theme)
  const toggleTheme = useAppStore(s => s.toggleTheme)

  // Restore file input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pengaturan')
      if (!res.ok) throw new Error('Gagal')
      const json: SettingsMap = await res.json()
      setSettings({ ...DEFAULT_SETTINGS, ...json })
    } catch {
      toast.error('Gagal memuat pengaturan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ============ Save handlers (per tab) ============
  const saveSettings = async (keys: string[]) => {
    setSaving(true)
    try {
      const payload: SettingsMap = {}
      for (const k of keys) {
        let v = String(settings[k] ?? '')
        // Sanitize URL fields: extract clean URL from any pasted HTML/BBCode/Markdown
        // to prevent broken logo/favicon (common mistake: paste imgbb share code)
        if (k === 'logo_url' || k === 'favicon_url') {
          v = v.trim()
          // If contains HTML tags or BBCode, extract the http(s) URL
          if (v && /<[a-z!]/i.test(v)) {
            const m = v.match(/https?:\/\/[^\s"'<>\]]+\.(?:png|jpg|jpeg|gif|svg|webp|ico)(?:\?[^\s"'<>\]]*)?/i)
              || v.match(/https?:\/\/[^\s"'<>\]]+/i)
            v = m ? m[0] : ''
          }
        }
        payload[k] = v
      }
      const res = await fetch('/api/pengaturan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      // Merge returned settings
      if (json?.settings) setSettings(prev => ({ ...prev, ...json.settings }))
      toast.success('Pengaturan berhasil disimpan')
      // Refresh branding global (logo/favicon/nama kampus) agar langsung diterapkan
      refreshBranding()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // ============ Test WhatsApp ============
  const handleTestWa = async () => {
    if (!waTestNumber.trim()) {
      toast.error('Masukkan nomor WA tujuan untuk test')
      return
    }
    setTestingWa(true)
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: waTestNumber.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || json?.detail || 'Gagal')
      }
      if (json.mode === 'live') {
        toast.success(`✅ Pesan test terkirim ke ${json.recipient} (LIVE)`)
      } else if (json.mode === 'simulasi') {
        toast.info(`🧪 Mode SIMULASI — pesan dicatat di log server. Lihat dev.log.`, {
          description: 'Gateway belum dikonfigurasi. Isi URL + Token untuk kirim nyata.',
        })
      } else {
        toast.warning('⚠️ Notifikasi WA dinonaktifkan. Aktifkan toggle lalu coba lagi.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengirim test WA')
    } finally {
      setTestingWa(false)
    }
  }

  // ============ Backup & Restore ============
  const handleBackup = async () => {
    try {
      const res = await fetch('/api/pengaturan')
      if (!res.ok) throw new Error('Gagal')
      const all: SettingsMap = await res.json()
      const blob = new Blob([JSON.stringify({
        meta: {
          app: 'SIM KKN & PLP — Universitas Nusantara Jaya',
          exportedAt: new Date().toISOString(),
          type: 'pengaturan-backup',
        },
        settings: all,
      }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-pengaturan-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup berhasil diunduh')
    } catch {
      toast.error('Gagal membuat backup')
    }
  }

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const settingsToRestore: SettingsMap | undefined = parsed?.settings
      if (!settingsToRestore || typeof settingsToRestore !== 'object') {
        throw new Error('Format file backup tidak valid')
      }
      // Simulated restore: PUT to backend
      const res = await fetch('/api/pengaturan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToRestore }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      setSettings(prev => ({ ...prev, ...settingsToRestore }))
      toast.success(`Restore berhasil (${Object.keys(settingsToRestore).length} pengaturan)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal restore')
    } finally {
      // Reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ============ Render helpers ============
  const Field = ({
    label, value, onChange, placeholder, type = 'text', description,
  }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    type?: string; description?: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )

  // Extract a valid image URL from arbitrary user input.
  // Handles common mistakes:
  //  - Full imgbb/HTML snippet: '<a href="..."><img src="https://i.ibb.co/xxx/logo.png">'
  //  - BBCode: '[img]https://.../logo.png[/img]'
  //  - Markdown: '![alt](https://.../logo.png)'
  //  - Plain URL: 'https://.../logo.png'
  // Returns '' if no valid http(s) URL found.
  const extractImageUrl = (raw: string): string => {
    if (!raw) return ''
    const s = raw.trim()
    // Fast path: already a clean URL
    if (/^https?:\/\/\S+\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(s)) return s
    // Try to find any http(s) URL ending with an image extension
    const m = s.match(/https?:\/\/[^\s"'<>\]]+\.(?:png|jpg|jpeg|gif|svg|webp|ico)(?:\?[^\s"'<>\]]*)?/i)
    if (m) return m[0]
    // Fallback: any http(s) URL (user might link a page that serves an image)
    const m2 = s.match(/https?:\/\/[^\s"'<>\]]+/i)
    return m2 ? m2[0] : ''
  }

  // URL field with validation + auto-extraction from pasted HTML/BBCode/Markdown.
  // Prevents users from accidentally saving HTML snippets (like imgbb share codes)
  // as the logo/favicon URL, which would break the image display.
  const UrlField = ({
    label, value, onChange, placeholder, description,
  }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; description?: string;
  }) => {
    const extracted = extractImageUrl(value)
    const isClean = !value || value === extracted
    return (
      <div className="space-y-1.5">
        <Label className="text-sm flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5" /> {label}
        </Label>
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            // Auto-clean on blur: if user pasted HTML/markdown, extract the URL
            if (value && !isClean) {
              onChange(extracted)
              toast.success('URL otomatis dibersihkan dari format HTML/BBCode')
            }
          }}
          placeholder={placeholder}
          className={!isClean ? 'border-amber-400' : ''}
        />
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {!isClean && (
          <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Tampaknya Anda mem-paste kode HTML, bukan URL gambar.</p>
              <p className="mt-0.5">URL yang akan disimpan: <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">{extracted || '(tidak ditemukan URL valid)'}</code></p>
              <p className="mt-0.5 text-muted-foreground">Klik di luar kolom untuk otomatis membersihkan, atau hapus manual.</p>
            </div>
          </div>
        )}
        {isClean && extracted && /^https?:\/\//.test(extracted) && (
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-emerald-600 dark:text-emerald-400">URL valid</span>
            <img src={extracted} alt="Preview" className="w-8 h-8 rounded border border-border object-contain bg-muted/30" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </div>
        )}
        {isClean && value && !extracted && (
          <p className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-3 h-3" /> URL tidak valid — harus diawali http:// atau https://
          </p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pengaturan Aplikasi"
          description="Kelola konfigurasi sistem dan preferensi aplikasi"
          icon={Settings}
          breadcrumb={['Sistem', 'Pengaturan']}
        />
        <Skeleton className="h-12 w-full max-w-2xl rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Aplikasi"
        description="Kelola konfigurasi sistem dan preferensi aplikasi"
        icon={Settings}
        breadcrumb={['Sistem', 'Pengaturan']}
      />

      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="h-auto flex flex-wrap gap-1">
          <TabsTrigger value="profil"><Building2 className="w-4 h-4" />Profil Universitas</TabsTrigger>
          <TabsTrigger value="akademik"><CalendarDays className="w-4 h-4" />Tahun Akademik</TabsTrigger>
          <TabsTrigger value="integrasi"><Plug className="w-4 h-4" />Integrasi</TabsTrigger>
          <TabsTrigger value="tampilan"><Palette className="w-4 h-4" />Tampilan</TabsTrigger>
          <TabsTrigger value="backup"><Database className="w-4 h-4" />Backup & Restore</TabsTrigger>
        </TabsList>

        {/* Profil Universitas */}
        <TabsContent value="profil">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />Profil Universitas</CardTitle>
                <CardDescription>Informasi identitas institusi yang ditampilkan pada kop surat, dokumen, dan header aplikasi.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm">Nama Kampus</Label>
                  <Input value={settings.nama_kampus ?? ''} onChange={(e) => update('nama_kampus', e.target.value)} placeholder="Universitas Nusantara Jaya" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm">Alamat</Label>
                  <Textarea value={settings.alamat_kampus ?? ''} onChange={(e) => update('alamat_kampus', e.target.value)} placeholder="Jl. Pendidikan No. 1, Jakarta Selatan" rows={2} />
                </div>
                <Field label="No. Telepon" value={settings.no_telepon ?? ''} onChange={(v) => update('no_telepon', v)} placeholder="021-12345678" />
                <Field label="Email Kampus" value={settings.email_kampus ?? ''} onChange={(v) => update('email_kampus', v)} placeholder="info@nusantarajaya.ac.id" type="email" />
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm">Website</Label>
                  <Input value={settings.website ?? ''} onChange={(e) => update('website', e.target.value)} placeholder="https://nusantarajaya.ac.id" />
                </div>
                <UrlField label="URL Logo" value={settings.logo_url ?? ''} onChange={(v) => update('logo_url', v)} placeholder="https://.../logo.png" description="Tautan langsung ke gambar logo kampus (PNG/SVG/JPG). JANGAN paste kode HTML — cukup URL gambar saja." />
                <UrlField label="URL Favicon" value={settings.favicon_url ?? ''} onChange={(v) => update('favicon_url', v)} placeholder="https://.../favicon.png" description="Tautan gambar favicon (PNG/ICO/SVG, ukuran kecil 32x32 atau 64x64)." />
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t bg-muted/30 py-3">
                <Button onClick={() => saveSettings(['nama_kampus', 'alamat_kampus', 'no_telepon', 'email_kampus', 'website', 'logo_url', 'favicon_url'])} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Simpan Perubahan
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tahun Akademik */}
        <TabsContent value="akademik">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" />Tahun Akademik & Semester</CardTitle>
                <CardDescription>Periode akademik aktif yang digunakan pada penempatan KKN & PLP serta filter laporan.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tahun Akademik" value={settings.tahun_akademik ?? ''} onChange={(v) => update('tahun_akademik', v)} placeholder="2024/2025" description="Format: YYYY/YYYY" />
                <div className="space-y-1.5">
                  <Label className="text-sm">Semester</Label>
                  <Select value={settings.semester ?? 'GANJIL'} onValueChange={(v) => update('semester', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GANJIL">Ganjil</SelectItem>
                      <SelectItem value="GENAP">Genap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t bg-muted/30 py-3">
                <Button onClick={() => saveSettings(['tahun_akademik', 'semester'])} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Simpan Perubahan
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Integrasi */}
        <TabsContent value="integrasi">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Mail className="w-5 h-5 text-primary" />Email SMTP</CardTitle>
                <CardDescription className="text-xs">Konfigurasi server email untuk notifikasi sistem & pengiriman surat elektronik.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="SMTP Host" value={settings.smtp_host ?? ''} onChange={(v) => update('smtp_host', v)} placeholder="smtp.gmail.com" />
                <Field label="SMTP Port" value={settings.smtp_port ?? ''} onChange={(v) => update('smtp_port', v)} placeholder="587" type="number" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="w-5 h-5 text-primary" />WhatsApp Gateway</CardTitle>
                <CardDescription className="text-xs">
                  Notifikasi otomatis ke dosen pembimbing saat mahasiswa check-in masuk & check-out pulang. Kompatibel dengan Fonnte.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Toggle aktifkan */}
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-start gap-2.5">
                    <Bell className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Aktifkan Notifikasi WA</p>
                      <p className="text-xs text-muted-foreground">
                        Saat aktif, setiap absensi HADIR (masuk/pulang) otomatis mengirim WA ke dosen pembimbing kelompok.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.wa_enabled === 'true'}
                    onCheckedChange={(v) => update('wa_enabled', v ? 'true' : 'false')}
                  />
                </div>

                <Field
                  label="URL WA Gateway"
                  value={settings.wa_gateway ?? ''}
                  onChange={(v) => update('wa_gateway', v)}
                  placeholder="https://api.fonnte.com/send"
                  description="Endpoint gateway WA. Contoh Fonnte: https://api.fonnte.com/send"
                />
                <Field
                  label="Token / API Key"
                  value={settings.wa_api_key ?? ''}
                  onChange={(v) => update('wa_api_key', v)}
                  placeholder="Token dari Fonnte (format: xxxxxxxx-xxxx-xxxx)"
                  type="password"
                  description="Token authorization dari provider gateway. Disimpan di DB, hanya tampil sebagai ••••."
                />
                <Field
                  label="Nomor Pengirim (opsional)"
                  value={settings.wa_sender ?? ''}
                  onChange={(v) => update('wa_sender', v)}
                  placeholder="6281xxxxxxxxx"
                  description="Nomor pengirim terdaftar di gateway (untuk multi-device). Kosongkan jika tidak diperlukan."
                />

                {/* Status info */}
                <div className={`text-xs rounded-lg p-3 border ${
                  settings.wa_enabled === 'true'
                    ? (settings.wa_gateway && settings.wa_api_key && settings.wa_gateway !== 'https://api.whatsapp.com'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300')
                    : 'bg-muted/40 border-border text-muted-foreground'
                }`}>
                  {settings.wa_enabled === 'true'
                    ? (settings.wa_gateway && settings.wa_api_key && settings.wa_gateway !== 'https://api.whatsapp.com'
                        ? '● Mode LIVE — notifikasi akan dikirim nyata ke nomor dosen.'
                        : '● Mode SIMULASI — pesan dicatat di log server (gateway belum dikonfigurasi).')
                    : '○ Notifikasi WA NONAKTIF — tidak ada pesan yang dikirim.'}
                </div>

                {/* Test kirim WA */}
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-sm">Test Kirim WA</Label>
                  <div className="flex gap-2">
                    <Input
                      value={waTestNumber}
                      onChange={(e) => setWaTestNumber(e.target.value)}
                      placeholder="0812xxxxxxxx (nomor test)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTestWa}
                      disabled={testingWa || !waTestNumber.trim()}
                      className="shrink-0"
                    >
                      {testingWa ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                      Test Kirim
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Kirim pesan test ke nomor di atas untuk memverifikasi konfigurasi. Simpan pengaturan dulu sebelum test.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><MapPin className="w-5 h-5 text-primary" />Google Maps API Key</CardTitle>
                <CardDescription className="text-xs">API key untuk validasi koordinat lokasi KKN/PLP & embed peta.</CardDescription>
              </CardHeader>
              <CardContent>
                <Field label="Maps API Key" value={settings.maps_api_key ?? ''} onChange={(v) => update('maps_api_key', v)} placeholder="AIzaSy..." />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><QrCode className="w-5 h-5 text-primary" />Pengaturan QR Code</CardTitle>
                <CardDescription className="text-xs">Konfigurasi mode QR code untuk absensi mahasiswa KKN/PLP.</CardDescription>
              </CardHeader>
              <CardContent>
                <Field label="Mode QR Code" value={settings.qr_code_setting ?? ''} onChange={(v) => update('qr_code_setting', v)} placeholder="enabled / disabled / strict" description="enabled = aktif, disabled = nonaktif, strict = wajib lokasi" />
              </CardContent>
            </Card>

            <div className="lg:col-span-2 flex justify-end">
              <Button onClick={() => saveSettings(['smtp_host', 'smtp_port', 'wa_gateway', 'wa_api_key', 'wa_sender', 'wa_enabled', 'maps_api_key', 'qr_code_setting'])} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Simpan Semua Integrasi
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        {/* Tampilan */}
        <TabsContent value="tampilan">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" />Tampilan & Tema</CardTitle>
                <CardDescription>Preferensi tampilan aplikasi. Tema dapat juga diubah cepat dari tombol di header aplikasi.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-900 text-amber-300' : 'bg-amber-100 text-amber-600'}`}>
                      {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium">Mode Tampilan</p>
                      <p className="text-xs text-muted-foreground">
                        Saat ini: <Badge variant="outline" className="ml-1">{theme === 'dark' ? 'Gelap' : 'Terang'}</Badge>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{theme === 'dark' ? 'Gelap' : 'Terang'}</span>
                    <Switch checked={theme === 'dark'} onCheckedChange={() => toggleTheme()} />
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30 p-4">
                  <Info className="w-5 h-5 text-sky-600 dark:text-sky-300 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-sky-900 dark:text-sky-200">Catatan Tema</p>
                    <p className="text-sky-700 dark:text-sky-300 mt-0.5 text-xs">
                      Preferensi tema disimpan otomatis di browser Anda. Gunakan tombol toggle tema di kanan atas header untuk beralih cepat antara mode terang dan gelap.
                      Pengaturan tema di sini hanya tampilan/informasi dan tidak perlu disimpan.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sun className="w-4 h-4 text-amber-500" />
                      <p className="font-medium text-sm">Mode Terang</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Tampilan default dengan latar terang. Cocok untuk penggunaan siang hari.</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Moon className="w-4 h-4 text-violet-500" />
                      <p className="font-medium text-sm">Mode Gelap</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Mengurangi ketegangan mata di lingkungan minim cahaya.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Backup & Restore */}
        <TabsContent value="backup">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5 text-primary" />Backup Database</CardTitle>
                <CardDescription>Unduh file backup konfigurasi aplikasi (semua pengaturan) dalam format JSON.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 mb-4">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Backup Simulasi</p>
                    <p className="mt-0.5">
                      Tombol di bawah akan mengunduh file JSON berisi seluruh konfigurasi pengaturan aplikasi.
                      Backup ini bersifat <strong>simulasi</strong> — untuk backup database penuh (termasuk data mahasiswa/dosen/dll),
                      gunakan tool database administratif terpisah.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-start border-t bg-muted/30 py-3">
                <Button onClick={handleBackup}>
                  <Download className="w-4 h-4 mr-1.5" />Backup Pengaturan
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />Restore Database</CardTitle>
                <CardDescription>Unggah file backup JSON untuk memulihkan konfigurasi pengaturan.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-4 mb-4">
                  <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-800 dark:text-rose-200">
                    <p className="font-medium">Peringatan Restore</p>
                    <p className="mt-0.5">
                      Operasi restore akan <strong>menimpa</strong> pengaturan aplikasi saat ini dengan data dari file backup.
                      Pastikan file backup berasal dari sumber terpercaya. Restore di sini bersifat <strong>simulasi</strong> pada tabel Pengaturan saja.
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreFile}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0
                    file:text-sm file:font-medium file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90 cursor-pointer"
                />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
