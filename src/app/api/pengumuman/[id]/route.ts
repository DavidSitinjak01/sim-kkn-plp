import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_PRIORITAS = ['URGENT', 'NORMAL', 'INFO']

type Params = { params: Promise<{ id: string }> }

// GET - single pengumuman by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.pengumuman.findUnique({ where: { id } })
    if (!data) {
      return NextResponse.json({ error: 'Pengumuman tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/pengumuman/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat pengumuman' }, { status: 500 })
  }
}

// PUT - update pengumuman
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.pengumuman.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Pengumuman tidak ditemukan' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.prioritas !== undefined) {
      if (!VALID_PRIORITAS.includes(body.prioritas)) {
        return NextResponse.json({ error: 'Prioritas tidak valid' }, { status: 400 })
      }
      updateData.prioritas = body.prioritas
    }

    if (body.judul !== undefined) updateData.judul = String(body.judul).trim()
    if (body.konten !== undefined) updateData.konten = String(body.konten).trim()
    if (body.penulis !== undefined) updateData.penulis = body.penulis ? String(body.penulis).trim() : null

    if (body.tanggal !== undefined) {
      const t = new Date(body.tanggal)
      if (isNaN(t.getTime())) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
      }
      updateData.tanggal = t
    }

    const updated = await db.pengumuman.update({ where: { id }, data: updateData })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PUT /api/pengumuman/:id]', e)
    return NextResponse.json({ error: 'Gagal memperbarui pengumuman' }, { status: 500 })
  }
}

// DELETE - remove pengumuman
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.pengumuman.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Pengumuman tidak ditemukan' }, { status: 404 })
    }
    await db.pengumuman.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Pengumuman berhasil dihapus' })
  } catch (e) {
    console.error('[DELETE /api/pengumuman/:id]', e)
    return NextResponse.json({ error: 'Gagal menghapus pengumuman' }, { status: 500 })
  }
}
