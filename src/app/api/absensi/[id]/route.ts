import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// GET - single absensi by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.absensi.findUnique({
      where: { id },
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
      },
    })
    if (!data) {
      return NextResponse.json({ error: 'Absensi tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/absensi/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat absensi' }, { status: 500 })
  }
}

// PUT - update absensi
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.absensi.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Absensi tidak ditemukan' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!['HADIR', 'IZIN', 'SAKIT', 'ALPHA'].includes(body.status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      }
      updateData.status = body.status
      // If switching to HADIR and no jamMasuk set, set to now
      if (body.status === 'HADIR' && !existing.jamMasuk) {
        updateData.jamMasuk = new Date()
      }
      if (body.status !== 'HADIR') {
        updateData.jamMasuk = existing.jamMasuk
        updateData.jamPulang = existing.jamPulang
      }
    }

    if (body.tanggal !== undefined) {
      const tgl = new Date(body.tanggal)
      if (isNaN(tgl.getTime())) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
      }
      tgl.setHours(12, 0, 0, 0)
      updateData.tanggal = tgl
    }

    if (body.keterangan !== undefined) {
      updateData.keterangan = body.keterangan ? String(body.keterangan).trim() : null
    }

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
    if (body.fotoSelfie !== undefined) {
      updateData.fotoSelfie = body.fotoSelfie ? String(body.fotoSelfie).trim() : null
    }
    if (body.jamMasuk !== undefined) {
      updateData.jamMasuk = body.jamMasuk ? new Date(body.jamMasuk) : null
    }
    if (body.jamPulang !== undefined) {
      updateData.jamPulang = body.jamPulang ? new Date(body.jamPulang) : null
    }
    if (body.mahasiswaId !== undefined) updateData.mahasiswaId = body.mahasiswaId
    if (body.kelompokId !== undefined) updateData.kelompokId = body.kelompokId

    const updated = await db.absensi.update({
      where: { id },
      data: updateData,
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PUT /api/absensi/:id]', e)
    return NextResponse.json({ error: 'Gagal memperbarui absensi' }, { status: 500 })
  }
}

// DELETE - remove absensi
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.absensi.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Absensi tidak ditemukan' }, { status: 404 })
    }
    await db.absensi.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Absensi berhasil dihapus' })
  } catch (e) {
    console.error('[DELETE /api/absensi/:id]', e)
    return NextResponse.json({ error: 'Gagal menghapus absensi' }, { status: 500 })
  }
}
