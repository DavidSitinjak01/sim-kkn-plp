'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Bike,
  Camera,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MapPin,
  Phone,
  Upload,
  User,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

// ---------- Types ----------
type Prodi = {
  id: string
  kode: string
  nama: string
  jenjang: string
  fakultas: { id: string; kode: string; nama: string }
}

type FormState = {
  namaLengkap: string
  nim: string
  prodiSelectValue: string // prodi.id | '__lainnya__' | ''
  prodiNamaCustom: string
  jurusan: string
  jenisKelamin: '' | 'L' | 'P'
  noWa: string
  punyaMotor: '' | 'true' | 'false'
  alamat: string
}

const EMPTY_FORM: FormState = {
  namaLengkap: '',
  nim: '',
  prodiSelectValue: '',
  prodiNamaCustom: '',
  jurusan: '',
  jenisKelamin: '',
  noWa: '',
  punyaMotor: '',
  alamat: '',
}

const LAINNYA_VALUE = '__lainnya__'
const MAX_FOTO_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_FOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const WA_REGEX = /^(\+62|62|0)8[1-9][0-9]{6,11}$/

// ---------- Component ----------
export function PendaftaranForm() {
  const [pengaturan, setPengaturan] = useState<{
    namaKampus: string
    logoUrl: string
    yayasan: string
    alamatKampus: string
  }>({ namaKampus: 'Universitas Nias Raya', logoUrl: '', yayasan: '', alamatKampus: '' })
  const [prodiList, setProdiList] = useState<Prodi[]>([])
  const [prodiLoading, setProdiLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ nama: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch pengaturan + prodi list on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [resPeng, resProdi] = await Promise.all([
          fetch('/api/pengaturan', { cache: 'no-store' }),
          fetch('/api/prodi', { cache: 'no-store' }),
        ])
        if (resPeng.ok) {
          const data: Record<string, string> = await resPeng.json()
          if (mounted) {
            setPengaturan({
              namaKampus: (data.nama_kampus ?? '').trim() || 'Universitas Nias Raya',
              logoUrl: (data.logo_url ?? '').trim(),
              yayasan: (data.yayasan ?? '').trim(),
              alamatKampus: (data.alamat_kampus ?? '').trim(),
            })
          }
        }
        if (resProdi.ok) {
          const data: Prodi[] = await resProdi.json()
          if (mounted) setProdiList(Array.isArray(data) ? data : [])
        } else if (mounted) {
          toast.error('Gagal memuat daftar program studi')
        }
      } catch {
        if (mounted) toast.error('Gagal memuat data. Periksa koneksi Anda.')
      } finally {
        if (mounted) setProdiLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Cleanup foto preview object URL when changed/unmount
  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    }
  }, [fotoPreview])

  // ---------- Field handlers ----------
  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleProdiChange(value: string) {
    if (value === LAINNYA_VALUE) {
      // Switch to custom mode: clear auto-filled jurusan & prodiId
      setForm((prev) => ({
        ...prev,
        prodiSelectValue: LAINNYA_VALUE,
        // keep jurusan as-is so user can edit freely
      }))
    } else {
      const prodi = prodiList.find((p) => p.id === value)
      setForm((prev) => ({
        ...prev,
        prodiSelectValue: value,
        prodiNamaCustom: '',
        // Auto-fill jurusan with the faculty name when a real prodi is chosen.
        // User can still edit afterwards.
        jurusan: prodi?.fakultas?.nama ?? prev.jurusan,
      }))
    }
    setErrors((prev) => {
      const next = { ...prev }
      delete next.prodi
      delete next.prodiNamaCustom
      delete next.jurusan
      return next
    })
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input value so the same file can be re-selected after removal
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (!ALLOWED_FOTO_TYPES.includes(file.type)) {
      const msg = 'Format foto harus JPG, PNG, atau WebP'
      setErrors((prev) => ({ ...prev, foto: msg }))
      toast.error(msg)
      return
    }
    if (file.size > MAX_FOTO_BYTES) {
      const msg = 'Ukuran foto melebihi 5MB'
      setErrors((prev) => ({ ...prev, foto: msg }))
      toast.error(msg)
      return
    }

    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.foto
      return next
    })
  }

  function removeFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFoto(null)
    setFotoPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setErrors((prev) => {
      const next = { ...prev }
      delete next.foto
      return next
    })
  }

  // ---------- Validation ----------
  function validate(): boolean {
    const nextErrors: Record<string, string> = {}

    if (!form.namaLengkap.trim()) nextErrors.namaLengkap = 'Nama lengkap wajib diisi'

    if (!form.nim.trim()) {
      nextErrors.nim = 'NIM wajib diisi'
    } else if (form.nim.trim().length < 5) {
      nextErrors.nim = 'NIM minimal 5 karakter'
    }

    if (!form.prodiSelectValue) {
      nextErrors.prodi = 'Program studi wajib dipilih'
    } else if (form.prodiSelectValue === LAINNYA_VALUE && !form.prodiNamaCustom.trim()) {
      nextErrors.prodiNamaCustom = 'Nama program studi wajib diisi'
    }

    if (!form.jurusan.trim()) nextErrors.jurusan = 'Jurusan wajib diisi'

    if (!form.jenisKelamin) nextErrors.jenisKelamin = 'Jenis kelamin wajib dipilih'

    if (!form.noWa.trim()) {
      nextErrors.noWa = 'No WhatsApp wajib diisi'
    } else {
      const digits = form.noWa.replace(/\D/g, '')
      if (!WA_REGEX.test(form.noWa.trim()) && digits.length < 10) {
        nextErrors.noWa = 'Format No WhatsApp tidak valid (min 10 digit, contoh: 0812xxxx atau +62812xxxx)'
      }
    }

    if (!form.punyaMotor) nextErrors.punyaMotor = 'Ketersediaan motor wajib dipilih'

    if (!form.alamat.trim()) nextErrors.alamat = 'Alamat wajib diisi'

    if (!foto) nextErrors.foto = 'Pass foto 3x4 wajib diunggah'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // ---------- Submit ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    if (!validate()) {
      toast.error('Periksa kembali isian form Anda')
      return
    }

    setLoading(true)

    try {
      const fd = new FormData()
      fd.append('namaLengkap', form.namaLengkap.trim())
      fd.append('nim', form.nim.trim())

      if (form.prodiSelectValue && form.prodiSelectValue !== LAINNYA_VALUE) {
        fd.append('prodiId', form.prodiSelectValue)
        const prodi = prodiList.find((p) => p.id === form.prodiSelectValue)
        fd.append('prodiNama', prodi?.nama ?? '')
      } else {
        fd.append('prodiNama', form.prodiNamaCustom.trim())
      }

      fd.append('jurusan', form.jurusan.trim())
      fd.append('jenisKelamin', form.jenisKelamin)
      fd.append('noWa', form.noWa.trim())
      fd.append('punyaMotor', form.punyaMotor) // 'true' | 'false'
      fd.append('alamat', form.alamat.trim())
      if (foto) fd.append('foto', foto)

      const res = await fetch('/api/pendaftaran', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 201 && data?.success) {
        setSuccess({ nama: form.namaLengkap.trim() })
        toast.success('Pendaftaran berhasil dikirim')
        return
      }

      const message = data?.error || 'Gagal mengirim pendaftaran. Silakan coba lagi.'
      setSubmitError(message)
      toast.error(message)
    } catch {
      const message = 'Terjadi kesalahan jaringan. Silakan coba lagi.'
      setSubmitError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setForm(EMPTY_FORM)
    setFoto(null)
    setFotoPreview('')
    setErrors({})
    setSubmitError('')
    setSuccess(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---------- Derived ----------
  const isLainnya = form.prodiSelectValue === LAINNYA_VALUE
  const logoSrc = pengaturan.logoUrl || '/logo.png'
  const namaKampus = pengaturan.namaKampus || 'Universitas Nias Raya'
  const yayasan = pengaturan.yayasan || ''

  // ---------- Success Screen ----------
  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
        <Header logoSrc={logoSrc} namaKampus={namaKampus} yayasan={yayasan} />
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <Card className="w-full max-w-xl shadow-md">
            <CardContent className="pt-8 pb-8 px-6 sm:px-10 text-center flex flex-col items-center gap-4">
              <div className="size-20 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Pendaftaran Berhasil!</h2>
              <p className="text-base text-muted-foreground">
                Terima kasih, <span className="font-semibold text-foreground">{success.nama}</span>.
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                Pendaftaran berhasil dikirim. Tim akan menghubungi Anda via WhatsApp.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Daftar Lagi
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    window.location.href = '/'
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Kembali ke Beranda
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  // ---------- Form Screen ----------
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <Header logoSrc={logoSrc} namaKampus={namaKampus} yayasan={yayasan} />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Formulir Pendaftaran Peserta KKN / PLP</CardTitle>
            <CardDescription>
              Isi data berikut dengan benar. Field bertanda <span className="text-destructive">*</span> wajib diisi.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {submitError && (
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Gagal mengirim pendaftaran</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
              {/* Nama lengkap — full width */}
              <Field
                label="Nama Lengkap"
                required
                icon={<User className="size-4 text-muted-foreground" />}
                error={errors.namaLengkap}
              >
                <Input
                  value={form.namaLengkap}
                  onChange={(e) => updateField('namaLengkap', e.target.value)}
                  placeholder="cth. Budi Santoso"
                  disabled={loading}
                  aria-invalid={!!errors.namaLengkap}
                  autoComplete="name"
                />
              </Field>

              {/* NIM + No WA — 2 cols on md */}
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="NIM"
                  required
                  icon={<GraduationCap className="size-4 text-muted-foreground" />}
                  error={errors.nim}
                >
                  <Input
                    value={form.nim}
                    onChange={(e) => updateField('nim', e.target.value)}
                    placeholder="cth. 20210001"
                    disabled={loading}
                    aria-invalid={!!errors.nim}
                    inputMode="numeric"
                  />
                </Field>

                <Field
                  label="No WhatsApp Aktif"
                  required
                  icon={<Phone className="size-4 text-muted-foreground" />}
                  error={errors.noWa}
                >
                  <Input
                    value={form.noWa}
                    onChange={(e) => updateField('noWa', e.target.value)}
                    placeholder="0812xxxxxxx"
                    disabled={loading}
                    aria-invalid={!!errors.noWa}
                    inputMode="tel"
                  />
                </Field>
              </div>

              {/* Program Studi — full width */}
              <Field
                label="Program Studi"
                required
                icon={<GraduationCap className="size-4 text-muted-foreground" />}
                error={errors.prodi}
              >
                <Select
                  value={form.prodiSelectValue}
                  onValueChange={handleProdiChange}
                  disabled={loading || prodiLoading}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.prodi}>
                    <SelectValue
                      placeholder={prodiLoading ? 'Memuat...' : 'Pilih program studi'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {prodiList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.jenjang ? `${p.jenjang} ` : ''}{p.nama}
                      </SelectItem>
                    ))}
                    <SelectItem value={LAINNYA_VALUE}>Lainnya...</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Custom prodiNama when "Lainnya..." selected */}
              {isLainnya && (
                <Field
                  label="Nama Program Studi (Lainnya)"
                  required
                  icon={<GraduationCap className="size-4 text-muted-foreground" />}
                  error={errors.prodiNamaCustom}
                >
                  <Input
                    value={form.prodiNamaCustom}
                    onChange={(e) => updateField('prodiNamaCustom', e.target.value)}
                    placeholder="Tulis nama program studi Anda"
                    disabled={loading}
                    aria-invalid={!!errors.prodiNamaCustom}
                  />
                </Field>
              )}

              {/* Jurusan — auto-filled, editable */}
              <Field
                label="Jurusan / Fakultas"
                required
                icon={<GraduationCap className="size-4 text-muted-foreground" />}
                error={errors.jurusan}
                hint={isLainnya ? undefined : 'Terisi otomatis dari fakultas prodi, dapat diedit manual.'}
              >
                <Input
                  value={form.jurusan}
                  onChange={(e) => updateField('jurusan', e.target.value)}
                  placeholder="cth. Fakultas Keguruan dan Ilmu Pendidikan"
                  disabled={loading}
                  aria-invalid={!!errors.jurusan}
                />
              </Field>

              {/* Jenis Kelamin + Punya Motor — 2 cols on md */}
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Jenis Kelamin"
                  required
                  error={errors.jenisKelamin}
                >
                  <RadioGroup
                    value={form.jenisKelamin}
                    onValueChange={(v) => updateField('jenisKelamin', v as 'L' | 'P')}
                    className="flex gap-6"
                    disabled={loading}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="L" id="jk-l" />
                      <Label htmlFor="jk-l" className="font-normal cursor-pointer">Laki-laki</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="P" id="jk-p" />
                      <Label htmlFor="jk-p" className="font-normal cursor-pointer">Perempuan</Label>
                    </div>
                  </RadioGroup>
                </Field>

                <Field
                  label="Memiliki Motor (Kendaraan)?"
                  required
                  icon={<Bike className="size-4 text-muted-foreground" />}
                  error={errors.punyaMotor}
                >
                  <RadioGroup
                    value={form.punyaMotor}
                    onValueChange={(v) => updateField('punyaMotor', v as 'true' | 'false')}
                    className="flex gap-6"
                    disabled={loading}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="true" id="motor-y" />
                      <Label htmlFor="motor-y" className="font-normal cursor-pointer">Ya</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="false" id="motor-t" />
                      <Label htmlFor="motor-t" className="font-normal cursor-pointer">Tidak</Label>
                    </div>
                  </RadioGroup>
                </Field>
              </div>

              {/* Alamat — full width */}
              <Field
                label="Alamat"
                required
                icon={<MapPin className="size-4 text-muted-foreground" />}
                error={errors.alamat}
              >
                <Textarea
                  value={form.alamat}
                  onChange={(e) => updateField('alamat', e.target.value)}
                  placeholder="Tulis alamat lengkap Anda"
                  disabled={loading}
                  aria-invalid={!!errors.alamat}
                  rows={3}
                />
              </Field>

              {/* Pass Foto — full width */}
              <Field
                label="Pass Foto ukuran 3x4"
                required
                icon={<Camera className="size-4 text-muted-foreground" />}
                error={errors.foto}
                hint="Format JPG / PNG / WebP. Maksimal 5MB."
              >
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Preview / placeholder */}
                  <div className="relative shrink-0 size-28 rounded-md border border-dashed border-input bg-muted/40 overflow-hidden flex items-center justify-center">
                    {fotoPreview ? (
                       
                      <img
                        src={fotoPreview}
                        alt="Preview foto"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Camera className="size-8 text-muted-foreground/60" />
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-2 w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFotoChange}
                      disabled={loading}
                      className="hidden"
                      id="foto-input"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-4" />
                        {foto ? 'Ganti Foto' : 'Unggah Foto'}
                      </Button>
                      {foto && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={loading}
                          onClick={removeFoto}
                        >
                          Hapus
                        </Button>
                      )}
                    </div>
                    {foto && (
                      <p className="text-xs text-muted-foreground truncate">
                        {foto.name} ({(foto.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>
                </div>
              </Field>

              {/* Submit */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto sm:min-w-40"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    'Kirim Pendaftaran'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/'
                  }}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft className="size-4" />
                  Kembali ke Beranda
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}

// ---------- Sub-components ----------
function Header({
  logoSrc,
  namaKampus,
  yayasan,
}: {
  logoSrc: string
  namaKampus: string
  yayasan: string
}) {
  return (
    <header className="w-full border-b bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          { }
          <img
            src={logoSrc}
            alt={`Logo ${namaKampus}`}
            className="size-10 rounded-md object-contain bg-background shrink-0"
            onError={(e) => {
              const t = e.currentTarget
              if (t.src !== '/logo.png') {
                t.src = '/logo.png'
              }
            }}
          />
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold leading-tight truncate">
              {namaKampus}
            </p>
            {yayasan && (
              <p className="text-xs text-muted-foreground truncate">{yayasan}</p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            window.location.href = '/'
          }}
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Kembali ke Beranda</span>
          <span className="sm:hidden">Beranda</span>
        </Button>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-auto py-4 px-4 text-center text-xs text-muted-foreground">
      &copy; {new Date().getFullYear()} SIM KKN &amp; PLP. Semua hak cipta dilindungi.
    </footer>
  )
}

function Field({
  label,
  required,
  icon,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  icon?: React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {icon}
        <span>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
      </Label>
      <div id={id}>{children}</div>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
