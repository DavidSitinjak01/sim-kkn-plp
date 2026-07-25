import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_JENIS = ['KKN', 'PLP1', 'PLP2']

type Params = { params: Promise<{ id: string }> }

// GET - single penilaian by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.penilaian.findUnique({
      where: { id },
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
        dosen: true,
      },
    })
    if (!data) {
      return NextResponse.json({ error: 'Penilaian tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/penilaian/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat penilaian' }, { status: 500 })
  }
}

// PUT - update penilaian
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.penilaian.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Penilaian tidak ditemukan' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.jenis !== undefined) {
      if (!VALID_JENIS.includes(body.jenis)) {
        return NextResponse.json({ error: 'Jenis penilaian tidak valid' }, { status: 400 })
      }
      updateData.jenis = body.jenis
    }

    if (body.nilai !== undefined) {
      const nilai = Number(body.nilai)
      if (Number.isNaN(nilai) || nilai < 0 || nilai > 100) {
        return NextResponse.json({ error: 'Nilai harus berupa angka 0-100' }, { status: 400 })
      }
      updateData.nilai = nilai
    }

    if (body.aspek !== undefined) updateData.aspek = String(body.aspek).trim()
    if (body.mahasiswaId !== undefined) updateData.mahasiswaId = body.mahasiswaId
    if (body.kelompokId !== undefined) updateData.kelompokId = body.kelompokId
    if (body.dosenId !== undefined) updateData.dosenId = body.dosenId || null

    const updated = await db.penilaian.update({
      where: { id },
      data: updateData,
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
        dosen: true,
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PUT /api/penilaian/:id]', e)
    return NextResponse.json({ error: 'Gagal memperbarui penilaian' }, { status: 500 })
  }
}

// DELETE - remove penilaian
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.penilaian.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Penilaian tidak ditemukan' }, { status: 404 })
    }
    await db.penilaian.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Penilaian berhasil dihapus' })
  } catch (e) {
    console.error('[DELETE /api/penilaian/:id]', e)
    return NextResponse.json({ error: 'Gagal menghapus penilaian' }, { status: 500 })
  }
}
