import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// GET - single sekolah by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.sekolah.findUnique({
      where: { id },
      include: { _count: { select: { kelompok: true } } },
    })
    if (!data) {
      return NextResponse.json({ error: 'Sekolah tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/sekolah/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat sekolah' }, { status: 500 })
  }
}

// PUT - update sekolah
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.sekolah.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sekolah tidak ditemukan' }, { status: 404 })
    }

    if (body.jenjang !== undefined && !['SD', 'SMP', 'SMA', 'SMK'].includes(body.jenjang)) {
      return NextResponse.json({ error: 'Jenjang tidak valid' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.nama !== undefined) updateData.nama = String(body.nama).trim()
    if (body.jenjang !== undefined) updateData.jenjang = body.jenjang
    if (body.alamat !== undefined) updateData.alamat = String(body.alamat).trim()
    if (body.kecamatan !== undefined) updateData.kecamatan = String(body.kecamatan).trim()
    if (body.kabupaten !== undefined) updateData.kabupaten = String(body.kabupaten).trim()
    if (body.provinsi !== undefined) updateData.provinsi = String(body.provinsi).trim()
    if (body.kepalaSekolah !== undefined) updateData.kepalaSekolah = String(body.kepalaSekolah).trim()
    if (body.noHp !== undefined) updateData.noHp = String(body.noHp).trim()
    if (body.email !== undefined) updateData.email = body.email ? String(body.email).trim() : null

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

    const updated = await db.sekolah.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { kelompok: true } } },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('[PUT /api/sekolah/:id]', e)
    return NextResponse.json({ error: 'Gagal memperbarui sekolah' }, { status: 500 })
  }
}

// DELETE - remove sekolah
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.sekolah.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sekolah tidak ditemukan' }, { status: 404 })
    }

    await db.sekolah.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Sekolah berhasil dihapus' })
  } catch (e: any) {
    console.error('[DELETE /api/sekolah/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Sekolah tidak dapat dihapus karena masih memiliki kelompok PLP yang terhubung' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Gagal menghapus sekolah' }, { status: 500 })
  }
}
