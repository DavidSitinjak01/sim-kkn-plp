import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ Helper: build params ============
function getParams(context: any): { id: string } {
  // Next.js 15/16 passes params as a Promise; support both sync and async shapes
  const p = context?.params
  if (!p) return { id: '' }
  if (p instanceof Promise) return { id: '' } // handled in handler via await
  return { id: (p.id as string) || '' }
}

// ============ GET single pendaftaran ============
export async function GET(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const data = await db.pendaftaran.findUnique({
      where: { id },
      include: { prodi: { include: { fakultas: true } } },
    })
    if (!data) return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/pendaftaran/[id]]', e)
    return NextResponse.json({ error: 'Gagal memuat data pendaftaran' }, { status: 500 })
  }
}

// ============ PATCH - update status (approve/reject) ============
// Body: { status: 'APPROVED' | 'REJECTED', catatan?: string }
export async function PATCH(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json()
    const { status, catatan } = body

    if (!['PENDING', 'APPROVED', 'REJECTED', 'IMPORTED'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const existing = await db.pendaftaran.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })

    const updated = await db.pendaftaran.update({
      where: { id },
      data: {
        status,
        catatan: catatan !== undefined ? String(catatan ?? '') : existing.catatan,
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PATCH /api/pendaftaran/[id]]', e)
    return NextResponse.json({ error: 'Gagal memperbarui status pendaftaran' }, { status: 500 })
  }
}

// ============ DELETE - remove pendaftaran ============
export async function DELETE(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const existing = await db.pendaftaran.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })

    await db.pendaftaran.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[DELETE /api/pendaftaran/[id]]', e)
    return NextResponse.json({ error: 'Gagal menghapus pendaftaran' }, { status: 500 })
  }
}
