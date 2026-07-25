import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// GET - single kelompok with members (include mahasiswa+prodi), desa, sekolah, dosen
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.kelompok.findUnique({
      where: { id },
      include: {
        desa: true,
        sekolah: true,
        dosen: true,
        members: {
          include: {
            mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
          },
          orderBy: [{ mahasiswa: { nim: 'asc' } }],
        },
        _count: { select: { members: true } },
      },
    })
    if (!data) {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/kelompok/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat kelompok' }, { status: 500 })
  }
}

// PUT - update kelompok
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.kelompok.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.nama !== undefined) updateData.nama = String(body.nama).trim()
    if (body.tipe !== undefined) {
      if (!['KKN', 'PLP1', 'PLP2'].includes(body.tipe)) {
        return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 })
      }
      updateData.tipe = body.tipe
    }
    if (body.tahunAkademik !== undefined) updateData.tahunAkademik = String(body.tahunAkademik).trim()
    if (body.semester !== undefined) {
      if (!['GANJIL', 'GENAP'].includes(body.semester)) {
        return NextResponse.json({ error: 'Semester tidak valid' }, { status: 400 })
      }
      updateData.semester = body.semester
    }
    if (body.dosenId !== undefined) {
      updateData.dosenId = body.dosenId || null
    }
    if (body.desaId !== undefined) updateData.desaId = body.desaId || null
    if (body.sekolahId !== undefined) updateData.sekolahId = body.sekolahId || null
    if (body.status !== undefined) {
      if (!['AKTIF', 'NONAKTIF', 'SELESAI'].includes(body.status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      }
      updateData.status = body.status
    }

    const updated = await db.kelompok.update({
      where: { id },
      data: updateData,
      include: {
        desa: true,
        sekolah: true,
        dosen: true,
        _count: { select: { members: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('[PUT /api/kelompok/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Referensi tidak valid' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui kelompok' }, { status: 500 })
  }
}

// DELETE - remove kelompok (cascade will remove members & absensi relations are blocked)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.kelompok.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    }

    await db.kelompok.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Kelompok berhasil dihapus' })
  } catch (e: any) {
    console.error('[DELETE /api/kelompok/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Kelompok tidak dapat dihapus karena masih memiliki absensi/penilaian terkait' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Gagal menghapus kelompok' }, { status: 500 })
  }
}
