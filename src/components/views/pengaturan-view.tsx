'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Settings, Save, Loader2, Building2, CalendarDays, Plug, Palette,
  Database, Download, Upload, ShieldCheck, Moon, Sun, Mail, MessageSquare,
  MapPin, QrCode, Info, Send, Bell, AlertCircle,
  Users, FileText, BadgeCheck, IdCard, Image as ImageIcon, Trash2,
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
  // Identitas Surat / Kepanitiaan PLP (dipakai pada format Daftar Peserta PLP)
  yayasan: '',
  panitia_plp: '',
  izin_operasional: '',
  ketua_panitia: '',
  ketua_panitia_nidn: '',
  sekretaris_panitia: '',
  sekretaris_panitia_nidn: '',
  koordinator_lapangan: '',
  // Logo Kartu Peserta (ID Card) — admin-upload base64 data URL or remote URL.
  // Falls back to built-in /public SVGs when empty.
  logo_tut_wuri_url: '',
  logo_kampus_merdeka_url: '',
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

      <Tabs defaultValue={typeof window !== 'undefined' && (window.location.hash === '#panitia' ? 'panitia' : window.location.hash === '#logo-kartu' ? 'logo-kartu' : '') ? (window.location.hash === '#panitia' ? 'panitia' : 'logo-kartu') : 'profil'} className="w-full">
        <TabsList className="h-auto flex flex-wrap gap-1">
          <TabsTrigger value="profil"><Building2 className="w-4 h-4" />Profil Universitas</TabsTrigger>
          <TabsTrigger value="akademik"><CalendarDays className="w-4 h-4" />Tahun Akademik</TabsTrigger>
          <TabsTrigger value="panitia"><Users className="w-4 h-4" />Kepanitiaan PLP</TabsTrigger>
          <TabsTrigger value="logo-kartu"><IdCard className="w-4 h-4" />Logo Kartu Peserta</TabsTrigger>
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
                <div className="sm:col-span-2">
                  <LogoUploader
                    label="Logo Aplikasi"
                    description="Logo kampus yang tampil pada sidebar, header aplikasi, dan halaman pendaftaran mahasiswa. Unggah file gambar (PNG/SVG/JPG/WEBP, maks 2MB) atau tempel URL gambar."
                    defaultSrc=""
                    value={settings.logo_url ?? ''}
                    onChange={(v) => update('logo_url', v)}
                    onReset={() => update('logo_url', '')}
                  />
                </div>
                <div className="sm:col-span-2">
                  <LogoUploader
                    label="Favicon"
                    description="Ikon kecil pada tab browser. Disarankan PNG/ICO/SVG ukuran 32x32 atau 64x64, maks 512KB."
                    defaultSrc=""
                    maxSizeMb={0.5}
                    value={settings.favicon_url ?? ''}
                    onChange={(v) => update('favicon_url', v)}
                    onReset={() => update('favicon_url', '')}
                  />
                </div>
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

        {/* Kepanitiaan PLP */}
        <TabsContent value="panitia">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Kepanitiaan PLP &amp; Identitas Surat</CardTitle>
                <CardDescription>
                  Data ini dipakai pada format surat <strong>Daftar Peserta PLP</strong> (menu Persuratan).
                  Ubah nilai di bawah jika ada perubahan kepanitiaan — surat yang dicetak selanjutnya akan otomatis menggunakan data terbaru.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ===== Bagian Kop Surat ===== */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kop Surat</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-sm">Yayasan</Label>
                      <Input value={settings.yayasan ?? ''} onChange={(e) => update('yayasan', e.target.value)} placeholder="YAYASAN PENDIDIKAN NIAS SELATAN" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-sm">Nama Panitia (dicetak di kop surat)</Label>
                      <Input value={settings.panitia_plp ?? ''} onChange={(e) => update('panitia_plp', e.target.value)} placeholder="PANITIA PENGENALAN LAPANGAN PERSEKOLAHAN II" />
                      <p className="text-xs text-muted-foreground">Tuliskan lengkap dengan romawi (I atau II) sesuai periode PLP yang sedang berjalan.</p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-sm">Izin Operasional</Label>
                      <Input value={settings.izin_operasional ?? ''} onChange={(e) => update('izin_operasional', e.target.value)} placeholder="Kepmendikbudristek Nomor 363/E/O/2021" />
                    </div>
                  </div>
                </div>

                {/* ===== Bagian Kepanitiaan ===== */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <BadgeCheck className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pengurus Panitia</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ketua */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Nama Ketua Panitia</Label>
                      <Input value={settings.ketua_panitia ?? ''} onChange={(e) => update('ketua_panitia', e.target.value)} placeholder="Antonius Sarumaha, M.Pd" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">NIDN Ketua</Label>
                      <Input value={settings.ketua_panitia_nidn ?? ''} onChange={(e) => update('ketua_panitia_nidn', e.target.value)} placeholder="0118058405" />
                    </div>
                    {/* Sekretaris */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Nama Sekretaris Panitia</Label>
                      <Input value={settings.sekretaris_panitia ?? ''} onChange={(e) => update('sekretaris_panitia', e.target.value)} placeholder="Adam Smith Bago, S.Si., M.Pd" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">NIDN Sekretaris</Label>
                      <Input value={settings.sekretaris_panitia_nidn ?? ''} onChange={(e) => update('sekretaris_panitia_nidn', e.target.value)} placeholder="0101018409" />
                    </div>
                    {/* Koordinator Lapangan */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-sm font-medium">Koordinator Lapangan</Label>
                      <Input value={settings.koordinator_lapangan ?? ''} onChange={(e) => update('koordinator_lapangan', e.target.value)} placeholder="Samalua Waoma, S.E., M.M., M.Ak." />
                      <p className="text-xs text-muted-foreground">Nama dosen/staff yang ditunjuk sebagai koordinator lapangan PLP.</p>
                    </div>
                  </div>
                </div>

                {/* Info preview */}
                <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30 p-4">
                  <Info className="w-5 h-5 text-sky-600 dark:text-sky-300 shrink-0 mt-0.5" />
                  <div className="text-xs text-sky-800 dark:text-sky-200">
                    <p className="font-medium">Tips</p>
                    <p className="mt-0.5">
                      Setelah menyimpan, perubahan akan langsung tampil pada menu <strong>Persuratan → Daftar Peserta PLP → Cetak</strong>.
                      Pastikan nama &amp; NIDN sudah benar sebelum mencetak surat resmi.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t bg-muted/30 py-3">
                <Button
                  onClick={() => saveSettings([
                    'yayasan', 'panitia_plp', 'izin_operasional',
                    'ketua_panitia', 'ketua_panitia_nidn',
                    'sekretaris_panitia', 'sekretaris_panitia_nidn',
                    'koordinator_lapangan',
                  ])}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Simpan Perubahan
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Logo Kartu Peserta (ID Card) */}
        <TabsContent value="logo-kartu">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><IdCard className="w-5 h-5 text-primary" />Logo Kartu Peserta (ID Card)</CardTitle>
                <CardDescription>
                  Unggah logo berkualitas tinggi (PNG/JPG/SVG) untuk dipakai pada cetakan Kartu Peserta
                  mahasiswa KKN &amp; PLP. Logo yang diunggah akan otomatis dipakai pada menu
                  <strong> Persuratan &rarr; Kartu Peserta (ID Card)</strong>. Jika kosong, sistem memakai logo bawaan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Tips hasil cetak terbaik:</p>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      <li>Gunakan PNG dengan latar <strong>transparan</strong> (resolusi minimal 512×512 px).</li>
                      <li>Ukuran file maksimal <strong>2 MB</strong> per logo.</li>
                      <li>Logo akan otomatis di-embed ke file PDF saat dicetak (tidak bergantung koneksi internet).</li>
                      <li>Logo Kampus memakai kolom <em>URL Logo</em> di tab <strong>Profil Universitas</strong>.</li>
                    </ul>
                  </div>
                </div>

                <LogoUploader
                  label="Logo Tut Wuri Handayani"
                  description="Logo Kemendikbud RI (Tut Wuri Handayani). Tampil di sisi kiri atas kartu peserta."
                  defaultSrc="/logo-tut-wuri.svg"
                  value={settings.logo_tut_wuri_url ?? ''}
                  onChange={(v) => update('logo_tut_wuri_url', v)}
                  onReset={() => update('logo_tut_wuri_url', '')}
                />

                <LogoUploader
                  label="Logo Kampus Merdeka"
                  description="Logo program Kampus Merdeka. Tampil di sisi kanan atas kartu peserta."
                  defaultSrc="/logo-kampus-merdeka.svg"
                  value={settings.logo_kampus_merdeka_url ?? ''}
                  onChange={(v) => update('logo_kampus_merdeka_url', v)}
                  onReset={() => update('logo_kampus_merdeka_url', '')}
                />
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t bg-muted/30 py-3">
                <Button onClick={() => saveSettings(['logo_tut_wuri_url', 'logo_kampus_merdeka_url'])} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Simpan Logo Kartu
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

// ============ Logo Uploader (for ID Card logos) ============
// Allows admin to upload a high-quality logo (converted to base64 data URL)
// or paste a remote URL. Falls back to a built-in default SVG when empty.
// Stored in Pengaturan as `logo_tut_wuri_url` / `logo_kampus_merdeka_url`.
interface LogoUploaderProps {
  label: string
  description: string
  defaultSrc: string
  value: string
  onChange: (v: string) => void
  onReset: () => void
  maxSizeMb?: number
}

function LogoUploader({ label, description, defaultSrc, value, onChange, onReset, maxSizeMb = 2 }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Determine the source type for display
  const isDataUrl = value.startsWith('data:')
  const isRemoteUrl = /^https?:\/\//.test(value)
  const previewSrc = value || defaultSrc

  const handleFile = async (file: File) => {
    setError(null)
    // Validate type (PNG/JPG/SVG/WEBP/GIF/ICO)
    if (!/^image\/(png|jpe?g|svg\+xml|webp|gif|x-icon|vnd\.microsoft\.icon)$/i.test(file.type)) {
      setError('Format file tidak didukung. Gunakan PNG, JPG, SVG, WEBP, atau ICO.')
      return
    }
    // Validate size
    const maxBytes = maxSizeMb * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`Ukuran file ${Math.round(file.size / 1024)} KB melebihi batas ${maxSizeMb} MB.`)
      return
    }
    setBusy(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Gagal membaca file'))
        reader.readAsDataURL(file)
      })
      onChange(dataUrl)
      toast.success(`Logo "${label}" berhasil dimuat. Klik Simpan untuk menyimpan.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memproses file')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-sm flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> {label}
          </Label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        {/* Source badge */}
        <Badge variant="outline" className={
          isDataUrl ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
          : isRemoteUrl ? 'border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300'
          : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
        }>
          {isDataUrl ? 'Unggahan (base64)' : isRemoteUrl ? 'URL Eksternal' : 'Bawaan'}
        </Badge>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Preview */}
        <div className="shrink-0">
          <div className="w-28 h-28 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={label}
                className="max-w-full max-h-full object-contain p-2"
                onError={(e) => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                  const p = t.parentElement
                  if (p) p.innerHTML = '<span class="text-xs text-muted-foreground text-center px-2">Gagal memuat</span>'
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="w-7 h-7 opacity-40" />
                <span className="text-[10px] text-center px-2">Belum ada logo</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1">Pratinjau</p>
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-2">
          {/* Drop zone + upload button */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2.5 flex items-center gap-2"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
              {busy ? 'Memuat...' : 'Pilih File'}
            </Button>
            <span className="text-xs text-muted-foreground">atau seret &amp; lepas file ke sini</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>

          {/* URL input (alternative) */}
          <div className="flex items-center gap-2">
            <Input
              type="url"
              value={isDataUrl ? '' : value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://.../logo.png (opsional)"
              className="text-xs h-8"
            />
          </div>

          {/* Reset button */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { onReset(); setError(null) }}
              disabled={!value || busy}
              className="text-xs h-7 px-2 text-muted-foreground"
            >
              <Trash2 className="w-3 h-3 mr-1" />Gunakan logo bawaan
            </Button>
            {isDataUrl && (
              <span className="text-[10px] text-muted-foreground">
                {Math.round(value.length * 0.75 / 1024)} KB
              </span>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3 h-3" />{error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
