import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseFormFields,
  parseResponseData,
  type FormFieldDef,
} from '@/lib/form-field-def'

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'IMPORTED']

// ============ GET - single response with its form ============
export async function GET(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const r = await db.pendaftaranResponse.findUnique({
      where: { id },
      include: { form: true },
    })
    if (!r) return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })

    const fields: FormFieldDef[] = parseFormFields(r.form?.fields)
    const data = parseResponseData(r.data)

    return NextResponse.json({
      id: r.id,
      formId: r.formId,
      form: r.form
        ? {
            id: r.form.id,
            nama: r.form.nama,
            deskripsi: r.form.deskripsi,
            fields,
          }
        : null,
      data,
      status: r.status,
      catatan: r.catatan,
      importedMahasiswaId: r.importedMahasiswaId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })
  } catch (e) {
    console.error('[GET /api/pendaftaran-responses/[id]]', e)
    return NextResponse.json({ error: 'Gagal memuat pendaftaran' }, { status: 500 })
  }
}

// ============ PATCH - update status & catatan ============
// Body: { status: 'PENDING'|'APPROVED'|'REJECTED'|'IMPORTED', catatan? }
export async function PATCH(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json()
    const status = (body?.status as string | undefined)?.trim() ?? ''
    const catatan =
      typeof body?.catatan === 'string' ? body.catatan.trim() || null : null

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const existing = await db.pendaftaranResponse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    }

    const updated = await db.pendaftaranResponse.update({
      where: { id },
      data: {
        status,
        catatan: catatan !== null ? catatan : existing.catatan,
      },
    })

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      catatan: updated.catatan,
      updatedAt: updated.updatedAt,
    })
  } catch (e: any) {
    console.error('[PATCH /api/pendaftaran-responses/[id]]', e)
    return NextResponse.json({ error: 'Gagal memperbarui pendaftaran' }, { status: 500 })
  }
}

// ============ DELETE - delete response ============
export async function DELETE(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const existing = await db.pendaftaranResponse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    }

    await db.pendaftaranResponse.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[DELETE /api/pendaftaran-responses/[id]]', e)
    return NextResponse.json({ error: 'Gagal menghapus pendaftaran' }, { status: 500 })
  }
}
