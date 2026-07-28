import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseFormFields,
  findDuplicateFieldKey,
  type FormFieldDef,
} from '@/lib/form-field-def'

// ============ GET - list all forms (admin) ============
export async function GET() {
  try {
    const forms = await db.formPendaftaran.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { responses: true } } },
    })

    const result = forms.map((f) => ({
      id: f.id,
      nama: f.nama,
      deskripsi: f.deskripsi,
      isPublished: f.isPublished,
      isDefault: f.isDefault,
      fields: parseFormFields(f.fields),
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      _count: { responses: f._count?.responses ?? 0 },
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error('[GET /api/form-pendaftaran]', e)
    return NextResponse.json({ error: 'Gagal memuat daftar form' }, { status: 500 })
  }
}

// ============ POST - create a new form ============
// Body: { nama, deskripsi?, fields? }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const nama = (body?.nama as string | undefined)?.trim() ?? ''
    const deskripsi = (body?.deskripsi as string | undefined)?.trim() || null
    const fieldsRaw = body?.fields

    if (!nama) {
      return NextResponse.json({ error: 'Nama form wajib diisi' }, { status: 400 })
    }

    // Normalize fields
    let fields: FormFieldDef[] = []
    if (Array.isArray(fieldsRaw)) {
      fields = (fieldsRaw as any[])
        .filter((f) => f && typeof f === 'object')
        .map((f) => ({
          id: String(f.id ?? ''),
          key: String(f.key ?? '').trim(),
          label: String(f.label ?? '').trim(),
          type: String(f.type ?? 'text') as FormFieldDef['type'],
          required: Boolean(f.required),
          helpText: f.helpText ? String(f.helpText) : undefined,
          placeholder: f.placeholder ? String(f.placeholder) : undefined,
          options: Array.isArray(f.options) ? f.options.map(String) : undefined,
          order: Number.isFinite(Number(f.order)) ? Number(f.order) : 0,
        }))
        .filter((f) => f.id && f.key && f.label)
      // re-sequence order
      fields = fields.map((f, i) => ({ ...f, order: i }))
    }

    // Validate field keys unique
    const dup = findDuplicateFieldKey(fields)
    if (dup) {
      return NextResponse.json(
        { error: `Key field harus unik. Duplikat: "${dup}"` },
        { status: 400 }
      )
    }

    const created = await db.formPendaftaran.create({
      data: {
        nama,
        deskripsi,
        fields: JSON.stringify(fields),
        isPublished: false,
        isDefault: false,
      },
    })

    return NextResponse.json(
      {
        id: created.id,
        nama: created.nama,
        deskripsi: created.deskripsi,
        isPublished: created.isPublished,
        isDefault: created.isDefault,
        fields: parseFormFields(created.fields),
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      { status: 201 }
    )
  } catch (e: any) {
    console.error('[POST /api/form-pendaftaran]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Form sudah ada (constraint unik)' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal membuat form' }, { status: 500 })
  }
}
