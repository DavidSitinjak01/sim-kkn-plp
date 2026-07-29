'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, CheckCircle2, GraduationCap, Loader2, Upload, X,
  AlertCircle, FileEdit,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'

import type { FormFieldDef } from '@/lib/form-field-def'

interface PublicForm {
  id: string
  nama: string
  deskripsi: string | null
  fields: FormFieldDef[]
}

interface Branding {
  namaKampus: string
  logoUrl: string
  yayasan: string
  alamatKampus: string
}

const DEFAULT_BRANDING: Branding = {
  namaKampus: 'Universitas Nias Raya',
  logoUrl: '',
  yayasan: '',
  alamatKampus: '',
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

// ============ Main Component ============
export function PendaftaranFormDinamis() {
  const [form, setForm] = useState<PublicForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING)

  // form state: { [fieldKey]: string }
  const [values, setValues] = useState<Record<string, string>>({})
  // file state: { [fieldKey]: File }
  const [files, setFiles] = useState<Record<string, File>>({})
  // file preview object URLs
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Fetch form + branding on mount
  useEffect(() => {
    let mounted = true
    Promise.all([
      fetch('/api/pendaftaran-public', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/pengaturan', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
    ])
      .then(([formRes, pengaturan]) => {
        if (!mounted) return
        if (formRes?.form) {
          setForm(formRes.form)
          // Initialize values for checkbox fields default to "false"
          const initVals: Record<string, string> = {}
          for (const f of formRes.form.fields) {
            if (f.type === 'checkbox') initVals[f.key] = 'false'
          }
          setValues(initVals)
        } else {
          setNotAvailable(true)
        }
        // Branding
        if (pengaturan && typeof pengaturan === 'object') {
          setBranding({
            namaKampus: (pengaturan.nama_kampus ?? '').trim() || DEFAULT_BRANDING.namaKampus,
            logoUrl: (pengaturan.logo_url ?? '').trim(),
            yayasan: (pengaturan.yayasan ?? '').trim(),
            alamatKampus: (pengaturan.alamat_kampus ?? '').trim(),
          })
        }
      })
      .catch(() => {
        if (mounted) setNotAvailable(true)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(filePreviews).forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [filePreviews])

  const handleFieldChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => {
      const next = { ...prev }
      if (file) next[key] = file
      else delete next[key]
      return next
    })
    setFilePreviews((prev) => {
      // Revoke old URL
      if (prev[key]) URL.revokeObjectURL(prev[key])
      const next = { ...prev }
      if (file) next[key] = URL.createObjectURL(file)
      else delete next[key]
      return next
    })
    // Also store empty string in values to keep key set
    setValues((prev) => ({ ...prev, [key]: file ? file.name : '' }))
  }

  const validate = (): string | null => {
    if (!form) return null
    for (const f of form.fields) {
      if (f.type === 'file-image') {
        if (f.required && !files[f.key]) {
          return `Field "${f.label}" wajib diunggah`
        }
        const file = files[f.key]
        if (file) {
          if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return `Field "${f.label}": format harus JPG, PNG, atau WebP`
          }
          if (file.size > MAX_IMAGE_SIZE) {
            return `Field "${f.label}": ukuran melebihi 5MB`
          }
        }
        continue
      }
      const v = (values[f.key] ?? '').trim()
      if (f.required && !v) {
        return `Field "${f.label}" wajib diisi`
      }
      if (v) {
        if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          return `Field "${f.label}": format email tidak valid`
        }
        if (f.type === 'number' && !/^-?\d+(\.\d+)?$/.test(v)) {
          return `Field "${f.label}": harus berupa angka`
        }
        if ((f.type === 'radio' || f.type === 'select') && f.options && !f.options.includes(v)) {
          return `Field "${f.label}": nilai tidak valid`
        }
      }
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!form) return

    const err = validate()
    if (err) {
      setSubmitError(err)
      toast.error(err)
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('__formId', form.id)
      for (const f of form.fields) {
        if (f.type === 'file-image') {
          const file = files[f.key]
          if (file) fd.append(f.key, file)
        } else {
          fd.append(f.key, values[f.key] ?? '')
        }
      }
      const res = await fetch('/api/pendaftaran-public', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal mengirim pendaftaran')
      }
      setSubmitted(true)
      toast.success('Pendaftaran berhasil dikirim')
      // Scroll to top so the success screen is visible
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      setSubmitError(e?.message || 'Gagal mengirim pendaftaran')
      toast.error(e?.message || 'Gagal mengirim pendaftaran')
    } finally {
      setSubmitting(false)
    }
  }

  // ============ Loading state ============
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Memuat form pendaftaran...</p>
      </div>
    )
  }

  // ============ Form not available ============
  if (notAvailable || !form) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-2">
              <AlertCircle className="w-7 h-7 text-muted-foreground" />
            </div>
            <CardTitle>Pendaftaran Belum Tersedia</CardTitle>
            <CardDescription>
              Form pendaftaran sedang tidak dibuka atau belum dikonfigurasi panitia. Silakan hubungi panitia atau coba lagi nanti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/'
              }}
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============ Success screen ============
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <CardTitle className="text-emerald-700 dark:text-emerald-300">Pendaftaran Berhasil</CardTitle>
            <CardDescription>
              Pendaftaran Anda telah berhasil dikirim. Tim panitia akan menghubungi Anda melalui WhatsApp untuk informasi selanjutnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              className="w-full"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/'
              }}
            >
              Kembali ke Beranda
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============ Form screen ============
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`Logo ${branding.namaKampus}`}
              className="w-10 h-10 object-contain rounded-md shrink-0 bg-white/80 dark:bg-white/10 p-0.5"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight truncate">{branding.namaKampus}</p>
            {branding.yayasan && (
              <p className="text-[11px] text-muted-foreground truncate">{branding.yayasan}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/'
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Beranda</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileEdit className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl">{form.nama}</CardTitle>
                {form.deskripsi && (
                  <CardDescription className="mt-1 whitespace-pre-wrap">
                    {form.deskripsi}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            {submitError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Gagal Mengirim</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {form.fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.key] ?? ''}
                  file={files[field.key] ?? null}
                  filePreview={filePreviews[field.key] ?? ''}
                  onChange={(v) => handleFieldChange(field.key, v)}
                  onFileChange={(f) => handleFileChange(field.key, f)}
                />
              ))}

              <div className="pt-2">
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Mengirim...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Kirim Pendaftaran
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Pastikan seluruh data sudah benar sebelum mengirim.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-background py-4 px-6">
        <div className="max-w-2xl mx-auto text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {branding.namaKampus}</p>
          {branding.alamatKampus && <p className="mt-0.5">{branding.alamatKampus}</p>}
        </div>
      </footer>
    </div>
  )
}

// ============ Field Renderer ============
function FieldRenderer({
  field, value, file, filePreview, onChange, onFileChange,
}: {
  field: FormFieldDef
  value: string
  file: File | null
  filePreview: string
  onChange: (v: string) => void
  onFileChange: (f: File | null) => void
}) {
  const inputId = `field-${field.id}`

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      {field.type === 'text' && (
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      )}

      {field.type === 'textarea' && (
        <Textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          required={field.required}
        />
      )}

      {field.type === 'number' && (
        <Input
          id={inputId}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      )}

      {field.type === 'email' && (
        <Input
          id={inputId}
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      )}

      {field.type === 'tel' && (
        <Input
          id={inputId}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      )}

      {field.type === 'date' && (
        <Input
          id={inputId}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      )}

      {field.type === 'select' && (
        <Select value={value} onValueChange={onChange} required={field.required}>
          <SelectTrigger id={inputId}>
            <SelectValue placeholder={field.placeholder || 'Pilih salah satu'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'radio' && (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-4 pt-1">
          {(field.options ?? []).map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem value={opt} id={`${inputId}-${opt}`} />
              <Label htmlFor={`${inputId}-${opt}`} className="text-sm font-normal cursor-pointer">
                {opt === 'L' ? 'Laki-laki' : opt === 'P' ? 'Perempuan' : opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {field.type === 'checkbox' && (
        <div className="flex items-center gap-3 pt-1">
          <Switch
            id={inputId}
            checked={value === 'true'}
            onCheckedChange={(c) => onChange(c ? 'true' : 'false')}
          />
          <Label htmlFor={inputId} className="text-sm text-muted-foreground cursor-pointer">
            {value === 'true' ? 'Ya' : 'Tidak'}
          </Label>
        </div>
      )}

      {field.type === 'file-image' && (
        <FileImageInput
          field={field}
          file={file}
          preview={filePreview}
          onChange={onFileChange}
          inputId={inputId}
        />
      )}

      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  )
}

function FileImageInput({
  field, file, preview, onChange, inputId,
}: {
  field: FormFieldDef
  file: File | null
  preview: string
  onChange: (f: File | null) => void
  inputId: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelect = () => inputRef.current?.click()

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (f) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        toast.error('Format foto harus JPG, PNG, atau WebP')
        return
      }
      if (f.size > MAX_IMAGE_SIZE) {
        toast.error('Ukuran foto melebihi 5MB')
        return
      }
    }
    onChange(f)
    // Reset input value so the same file can be picked again after removal
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePick}
        className="hidden"
      />
      {preview ? (
        <div className="flex items-start gap-3">
          <img
            src={preview}
            alt={field.label}
            className="w-24 h-28 object-cover rounded-md border border-border"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file?.name}</p>
            <p className="text-xs text-muted-foreground">
              {file ? `${(file.size / 1024).toFixed(1)} KB · ${file.type}` : ''}
            </p>
            <div className="flex gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSelect} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Ganti
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange(null)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" /> Hapus
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSelect}
          className="w-full border-2 border-dashed border-border rounded-lg p-6 hover:border-primary/50 hover:bg-muted/30 transition-colors text-center"
        >
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Klik untuk unggah foto</p>
          <p className="text-xs text-muted-foreground mt-0.5">JPG / PNG / WebP, maksimal 5MB</p>
        </button>
      )}
    </div>
  )
}

export default PendaftaranFormDinamis
