import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseFormFields,
  type FormFieldDef,
} from '@/lib/form-field-def'

// ============ PUBLIC ENDPOINT (no auth) ============

// GET — return the default (isDefault=true) published (isPublished=true) form
// with its parsed fields, ordered by `order`. If none, returns `{ form: null }`.
export async function GET() {
  try {
    const form = await db.formPendaftaran.findFirst({
      where: { isDefault: true, isPublished: true },
      orderBy: { updatedAt: 'desc' },
    })

    if (!form) {
      return NextResponse.json({ form: null })
    }

    const fields = parseFormFields(form.fields)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    return NextResponse.json({
      form: {
        id: form.id,
        nama: form.nama,
        deskripsi: form.deskripsi,
        fields,
      },
    })
  } catch (e) {
    console.error('[GET /api/pendaftaran-public]', e)
    return NextResponse.json({ error: 'Gagal memuat form pendaftaran' }, { status: 500 })
  }
}

// ============ POST - public submit ============
// Accepts multipart/form-data (because of file-image uploads).
// For each field in the form, read its value from formData by key.
// - file-image: read File, validate type (jpg/png/webp) & size (≤5MB),
//   convert to base64 data URL.
// - checkbox: value is "true"/"false".
// - all others: read as string.
// Validates required fields.
// Checks NIM uniqueness (against PendaftaranResponse + Mahasiswa).
export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const formId = (formData.get('__formId') as string | null)?.trim() || null

    // If formId not provided, fall back to the current default published form.
    let form = formId
      ? await db.formPendaftaran.findUnique({ where: { id: formId } })
      : await db.formPendaftaran.findFirst({
          where: { isDefault: true, isPublished: true },
          orderBy: { updatedAt: 'desc' },
        })

    if (!form) {
      return NextResponse.json(
        { error: 'Form pendaftaran tidak tersedia' },
        { status: 400 }
      )
    }

    // Only accept submissions against a published form
    if (!form.isPublished) {
      return NextResponse.json(
        { error: 'Form pendaftaran ini sedang tidak aktif' },
        { status: 400 }
      )
    }

    const fields: FormFieldDef[] = parseFormFields(form.fields)
    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'Form belum memiliki field' },
        { status: 400 }
      )
    }

    const data: Record<string, string> = {}
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

    // Process each field in declaration order
    for (const field of fields) {
      const raw = formData.get(field.key)

      if (field.type === 'file-image') {
        if (!raw || !(raw instanceof File) || raw.size === 0) {
          if (field.required) {
            return NextResponse.json(
              { error: `Field "${field.label}" wajib diunggah` },
              { status: 400 }
            )
          }
          // optional & missing → skip
          continue
        }
        const file = raw as File
        if (!allowedImageTypes.includes(file.type)) {
          return NextResponse.json(
            { error: `Field "${field.label}": format harus JPG, PNG, atau WebP` },
            { status: 400 }
          )
        }
        if (file.size > MAX_IMAGE_SIZE) {
          return NextResponse.json(
            { error: `Field "${field.label}": ukuran melebihi 5MB` },
            { status: 400 }
          )
        }
        // Convert to base64 data URL
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        data[field.key] = `data:${file.type};base64,${base64}`
        continue
      }

      // Non-file fields
      let value = typeof raw === 'string' ? raw.trim() : ''

      if (field.type === 'checkbox') {
        // Checkbox value should be "true" / "false"
        // We accept the string as-is, but normalize empty to "false".
        if (value !== 'true' && value !== 'false') {
          value = value ? 'true' : 'false'
        }
      }

      if (field.required && !value) {
        return NextResponse.json(
          { error: `Field "${field.label}" wajib diisi` },
          { status: 400 }
        )
      }

      // Type-specific validation
      if (value) {
        if (field.type === 'email') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return NextResponse.json(
              { error: `Field "${field.label}": format email tidak valid` },
              { status: 400 }
            )
          }
        }
        if (field.type === 'number') {
          if (!/^-?\d+(\.\d+)?$/.test(value)) {
            return NextResponse.json(
              { error: `Field "${field.label}": harus berupa angka` },
              { status: 400 }
            )
          }
        }
        if (field.type === 'radio' || field.type === 'select') {
          if (field.options && field.options.length > 0 && !field.options.includes(value)) {
            return NextResponse.json(
              { error: `Field "${field.label}": nilai tidak valid` },
              { status: 400 }
            )
          }
        }
      }

      // Skip storing empty optional values? Keep them as empty string for completeness.
      data[field.key] = value
    }

    // NIM uniqueness check (only if a nim field exists).
    // SQLite can't query JSON natively, so we fetch candidate rows that contain
    // the nim string (cheap LIKE) and verify by parsing in JS.
    const nimField = fields.find((f) => f.key === 'nim')
    if (nimField) {
      const nimValue = (data['nim'] || '').trim()
      if (nimValue) {
        const candidateRows = await db.pendaftaranResponse.findMany({
          where: { data: { contains: nimValue } },
          select: { data: true },
        })
        const duplicate = candidateRows.some((r) => {
          try {
            const parsed = JSON.parse(r.data)
            return parsed?.nim === nimValue
          } catch {
            return false
          }
        })
        if (duplicate) {
          return NextResponse.json(
            { error: 'NIM sudah pernah mendaftar' },
            { status: 400 }
          )
        }

        const existMhs = await db.mahasiswa.findUnique({ where: { nim: nimValue } })
        if (existMhs) {
          return NextResponse.json(
            { error: 'NIM sudah terdaftar sebagai mahasiswa aktif' },
            { status: 400 }
          )
        }
      }
    }

    const created = await db.pendaftaranResponse.create({
      data: {
        formId: form.id,
        data: JSON.stringify(data),
        status: 'PENDING',
      },
    })

    return NextResponse.json(
      { success: true, id: created.id, message: 'Pendaftaran berhasil dikirim' },
      { status: 201 }
    )
  } catch (e: any) {
    console.error('[POST /api/pendaftaran-public]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Data sudah ada (duplikat)' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal mengirim pendaftaran' }, { status: 500 })
  }
}
