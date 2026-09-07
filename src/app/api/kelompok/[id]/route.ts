import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildKelompokDetailInclude, buildKelompokInclude, withKoordinatorFallback, isKoordinatorColumnMissing } from '@/lib/kelompok-helpers'

type Params = { params: Promise<{ id: string }> }

// GET - single kelompok with members (include mahasiswa+prodi), desa, sekolah, dosen
// RESILIENT: fallback kalau kolom koordinatorId belum ada di DB.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await withKoordinatorFallback(async (skip) => {
      return db.kelompok.findUnique({
        where: { id },
        include: buildKelompokDetailInclude(skip),
      })
    })
    if (!data) {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    }
    // Sort members by prodi (A-Z), then by nama (A-Z)
    if (Array.isArray(data.members)) {
      data.members.sort((a, b) => {
        const prodiA = a.mahasiswa?.prodi?.nama ?? ''
        const prodiB = b.mahasiswa?.prodi?.nama ?? ''
        if (prodiA !== prodiB) return prodiA.localeCompare(prodiB)
        const namaA = a.mahasiswa?.nama ?? ''
        const namaB = b.mahasiswa?.nama ?? ''
        return namaA.localeCompare(namaB)
      })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/kelompok/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat kelompok' }, { status: 500 })
  }
}

// PUT - update kelompok
// RESILIENT: kalau body berisi koordinatorId tapi kolom belum ada di DB,
// skip field tersebut & lanjutkan update field lain.
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
    if (body.koordinatorId !== undefined) {
      updateData.koordinatorId = body.koordinatorId || null
    }
    if (body.desaId !== undefined) updateData.desaId = body.desaId || null
    if (body.sekolahId !== undefined) updateData.sekolahId = body.sekolahId || null
    if (body.status !== undefined) {
      if (!['AKTIF', 'NONAKTIF', 'SELESAI'].includes(body.status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      }
      updateData.status = body.status
    }

    const updated = await withKoordinatorFallback(async (skip) => {
      // Kalau skip (kolom belum ada), hapus koordinatorId dari updateData
      const dataToUse = { ...updateData }
      if (skip) delete dataToUse.koordinatorId
      return db.kelompok.update({
        where: { id },
        data: dataToUse,
        include: buildKelompokInclude(skip),
      })
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
