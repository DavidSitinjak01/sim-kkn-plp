import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseFormFields,
  findDuplicateFieldKey,
  type FormFieldDef,
} from '@/lib/form-field-def'

// ============ GET - single form (admin) ============
export async function GET(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const form = await db.formPendaftaran.findUnique({
      where: { id },
      include: { _count: { select: { responses: true } } },
    })
    if (!form) return NextResponse.json({ error: 'Form tidak ditemukan' }, { status: 404 })

    return NextResponse.json({
      id: form.id,
      nama: form.nama,
      deskripsi: form.deskripsi,
      isPublished: form.isPublished,
      isDefault: form.isDefault,
      fields: parseFormFields(form.fields),
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      _count: { responses: form._count?.responses ?? 0 },
    })
  } catch (e) {
    console.error('[GET /api/form-pendaftaran/[id]]', e)
    return NextResponse.json({ error: 'Gagal memuat form' }, { status: 500 })
  }
}

// ============ PATCH - update form metadata & fields ============
// Body: { nama?, deskripsi?, fields? }
// NOTE: isPublished/isDefault are NOT changed here — use /publish endpoint.
export async function PATCH(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json()

    const existing = await db.formPendaftaran.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Form tidak ditemukan' }, { status: 404 })

    const data: any = {}
    if (typeof body?.nama === 'string') {
      const nama = body.nama.trim()
      if (!nama) return NextResponse.json({ error: 'Nama form wajib diisi' }, { status: 400 })
      data.nama = nama
    }
    if (typeof body?.deskripsi === 'string') {
      data.deskripsi = body.deskripsi.trim() || null
    }
    if (Array.isArray(body?.fields)) {
      let fields: FormFieldDef[] = (body.fields as any[])
        .filter((f) => f && typeof f === 'object')
        .map((f, i) => ({
          id: String(f.id ?? ''),
          key: String(f.key ?? '').trim(),
          label: String(f.label ?? '').trim(),
          type: String(f.type ?? 'text') as FormFieldDef['type'],
          required: Boolean(f.required),
          helpText: f.helpText ? String(f.helpText) : undefined,
          placeholder: f.placeholder ? String(f.placeholder) : undefined,
          options: Array.isArray(f.options) ? f.options.map(String) : undefined,
          order: Number.isFinite(Number(f.order)) ? Number(f.order) : i,
        }))
        .filter((f) => f.id && f.key && f.label)
      fields = fields.map((f, i) => ({ ...f, order: i }))

      const dup = findDuplicateFieldKey(fields)
      if (dup) {
        return NextResponse.json(
          { error: `Key field harus unik. Duplikat: "${dup}"` },
          { status: 400 }
        )
      }
      data.fields = JSON.stringify(fields)
    }

    const updated = await db.formPendaftaran.update({ where: { id }, data })

    return NextResponse.json({
      id: updated.id,
      nama: updated.nama,
      deskripsi: updated.deskripsi,
      isPublished: updated.isPublished,
      isDefault: updated.isDefault,
      fields: parseFormFields(updated.fields),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    })
  } catch (e: any) {
    console.error('[PATCH /api/form-pendaftaran/[id]]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Constraint unik terlanggar' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui form' }, { status: 500 })
  }
}

// ============ DELETE - delete form (cascade deletes responses) ============
export async function DELETE(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const existing = await db.formPendaftaran.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Form tidak ditemukan' }, { status: 404 })

    await db.formPendaftaran.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[DELETE /api/form-pendaftaran/[id]]', e)
    return NextResponse.json({ error: 'Gagal menghapus form' }, { status: 500 })
  }
}
