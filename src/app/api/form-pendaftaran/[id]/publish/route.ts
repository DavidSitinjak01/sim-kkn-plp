import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ POST - toggle publish & set-as-default ============
// Body: { publish?: boolean, setDefault?: boolean }
// - If `publish` is true → set isPublished=true
// - If `publish` is false → set isPublished=false
// - If `setDefault` is true → set THIS form's isDefault=true AND unset isDefault
//   on ALL other forms (only one default at a time). Setting setDefault=true
//   also implicitly publishes the form.
// - If `setDefault` is false → unset isDefault on this form.
export async function POST(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const publish = typeof body?.publish === 'boolean' ? body.publish : null
    const setDefault = typeof body?.setDefault === 'boolean' ? body.setDefault : null

    if (publish === null && setDefault === null) {
      return NextResponse.json(
        { error: 'Tidak ada aksi yang diminta (publish / setDefault)' },
        { status: 400 }
      )
    }

    const existing = await db.formPendaftaran.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Form tidak ditemukan' }, { status: 404 })

    const data: any = {}

    if (publish !== null) {
      data.isPublished = publish
    }

    if (setDefault === true) {
      // Make this form default; unset others first
      await db.formPendaftaran.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      })
      data.isDefault = true
      // Setting as default implicitly publishes the form so the public link works.
      data.isPublished = true
    } else if (setDefault === false) {
      data.isDefault = false
    }

    const updated = await db.formPendaftaran.update({ where: { id }, data })

    return NextResponse.json({
      id: updated.id,
      nama: updated.nama,
      deskripsi: updated.deskripsi,
      isPublished: updated.isPublished,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    })
  } catch (e: any) {
    console.error('[POST /api/form-pendaftaran/[id]/publish]', e)
    return NextResponse.json({ error: 'Gagal mengubah status publish form' }, { status: 500 })
  }
}
