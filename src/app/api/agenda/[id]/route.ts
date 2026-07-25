import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_TIPE = ['KKN', 'PLP', 'UMUM']

type Params = { params: Promise<{ id: string }> }

// GET - single agenda by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.agenda.findUnique({ where: { id } })
    if (!data) {
      return NextResponse.json({ error: 'Agenda tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/agenda/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat agenda' }, { status: 500 })
  }
}

// PUT - update agenda
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.agenda.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Agenda tidak ditemukan' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.tipe !== undefined) {
      if (!VALID_TIPE.includes(body.tipe)) {
        return NextResponse.json({ error: 'Tipe agenda tidak valid' }, { status: 400 })
      }
      updateData.tipe = body.tipe
    }

    if (body.judul !== undefined) updateData.judul = String(body.judul).trim()
    if (body.lokasi !== undefined) updateData.lokasi = body.lokasi ? String(body.lokasi).trim() : null
    if (body.deskripsi !== undefined) updateData.deskripsi = body.deskripsi ? String(body.deskripsi).trim() : null

    if (body.tanggal !== undefined) {
      const t = new Date(body.tanggal)
      if (isNaN(t.getTime())) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
      }
      updateData.tanggal = t
    }

    const updated = await db.agenda.update({ where: { id }, data: updateData })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PUT /api/agenda/:id]', e)
    return NextResponse.json({ error: 'Gagal memperbarui agenda' }, { status: 500 })
  }
}

// DELETE - remove agenda
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.agenda.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Agenda tidak ditemukan' }, { status: 404 })
    }
    await db.agenda.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Agenda berhasil dihapus' })
  } catch (e) {
    console.error('[DELETE /api/agenda/:id]', e)
    return NextResponse.json({ error: 'Gagal menghapus agenda' }, { status: 500 })
  }
}
