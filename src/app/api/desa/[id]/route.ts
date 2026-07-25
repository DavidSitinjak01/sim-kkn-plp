import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// GET - single desa by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.desa.findUnique({
      where: { id },
      include: { _count: { select: { kelompok: true } } },
    })
    if (!data) {
      return NextResponse.json({ error: 'Desa tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/desa/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat desa' }, { status: 500 })
  }
}

// PUT - update desa
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.desa.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Desa tidak ditemukan' }, { status: 404 })
    }

    // Build update data with conditional fields
    const updateData: Record<string, unknown> = {}

    if (body.nama !== undefined) updateData.nama = String(body.nama).trim()
    if (body.kecamatan !== undefined) updateData.kecamatan = String(body.kecamatan).trim()
    if (body.kabupaten !== undefined) updateData.kabupaten = String(body.kabupaten).trim()
    if (body.provinsi !== undefined) updateData.provinsi = String(body.provinsi).trim()
    if (body.kodePos !== undefined) updateData.kodePos = body.kodePos ? String(body.kodePos).trim() : null
    if (body.keterangan !== undefined) updateData.keterangan = body.keterangan ? String(body.keterangan).trim() : null
    if (body.foto !== undefined) updateData.foto = body.foto ? String(body.foto).trim() : null

    if (body.latitude !== undefined) {
      const lat = body.latitude === null || body.latitude === '' ? null : Number(body.latitude)
      if (lat !== null && Number.isNaN(lat)) {
        return NextResponse.json({ error: 'Latitude tidak valid' }, { status: 400 })
      }
      updateData.latitude = lat
    }
    if (body.longitude !== undefined) {
      const lng = body.longitude === null || body.longitude === '' ? null : Number(body.longitude)
      if (lng !== null && Number.isNaN(lng)) {
        return NextResponse.json({ error: 'Longitude tidak valid' }, { status: 400 })
      }
      updateData.longitude = lng
    }
    if (body.kuota !== undefined) {
      const kuota = body.kuota === '' ? 0 : Number(body.kuota)
      if (Number.isNaN(kuota) || kuota < 0) {
        return NextResponse.json({ error: 'Kuota tidak valid' }, { status: 400 })
      }
      updateData.kuota = kuota
    }

    const updated = await db.desa.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { kelompok: true } } },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('[PUT /api/desa/:id]', e)
    return NextResponse.json({ error: 'Gagal memperbarui desa' }, { status: 500 })
  }
}

// DELETE - remove desa
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.desa.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Desa tidak ditemukan' }, { status: 404 })
    }

    await db.desa.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Desa berhasil dihapus' })
  } catch (e: any) {
    console.error('[DELETE /api/desa/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Desa tidak dapat dihapus karena masih memiliki kelompok KKN yang terhubung' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Gagal menghapus desa' }, { status: 500 })
  }
}
