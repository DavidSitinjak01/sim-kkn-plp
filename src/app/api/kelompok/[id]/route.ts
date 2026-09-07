import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildKelompokDetailSelect, buildKelompokSelect, buildKelompokData, withKoordinatorFallback } from '@/lib/kelompok-helpers'

type Params = { params: Promise<{ id: string }> }

// GET - single kelompok with members, desa, sekolah, dosen
// RESILIENT: pakai `select` bukan `include`, fallback kalau koordinatorId belum ada.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await withKoordinatorFallback(async (skip) => {
      return db.kelompok.findUnique({
        where: { id },
        select: buildKelompokDetailSelect(!skip),
      })
    })
    if (!data) {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    }
    // Sort members by prodi (A-Z), then by nama (A-Z)
    if (Array.isArray((data as any).members)) {
      ;(data as any).members.sort((a: any, b: any) => {
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
      const dataToUse = { ...updateData }
      if (skip) delete dataToUse.koordinatorId
      return db.kelompok.update({
        where: { id },
        data: dataToUse,
        select: buildKelompokSelect(!skip),
      })
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('[PUT /api/kelompok/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Referensi tidak valid' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui kelompok. ' + (e?.message || '') }, { status: 500 })
  }
}

// DELETE - remove kelompok
// RESILIENT:
// 1. Manual cascade hapus Absensi, Penilaian, KelompokMember dulu (schema
//    Absensi & Penilaian tidak pakai onDelete: Cascade — kalau tidak dihapus
//    manual, FK constraint P2003 akan block delete Kelompok).
// 2. Pakai `select` (bukan default return all) supaya tidak error kalau
//    kolom koordinatorId belum ada di DB.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.kelompok.findUnique({
      where: { id },
      select: { id: true, nama: true }, // select minimal, avoid koordinatorId
    })
    if (!existing) {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    }

    // Manual cascade: hapus child records dulu dalam transaction atomik.
    // Urutan: Absensi → Penilaian → KelompokMember → Kelompok.
    // Kalau ada tabel yang belum ada di DB (mis. koordinator-related), skip.
    try {
      await db.$transaction([
        db.absensi.deleteMany({ where: { kelompokId: id } }),
        db.penilaian.deleteMany({ where: { kelompokId: id } }),
        db.kelompokMember.deleteMany({ where: { kelompokId: id } }),
        db.kelompok.delete({ where: { id } }),
      ])
    } catch (txErr: any) {
      // Kalau transaction gagal (mis. tabel belum ada), coba hapus satu-satu
      // dengan fallback. Yang penting Kelompok terhapus di akhir.
      console.warn('[DELETE /api/kelompok/:id] transaction gagal, coba manual:', txErr?.message)
      try { await db.absensi.deleteMany({ where: { kelompokId: id } }) } catch {}
      try { await db.penilaian.deleteMany({ where: { kelompokId: id } }) } catch {}
      try { await db.kelompokMember.deleteMany({ where: { kelompokId: id } }) } catch {}
      await db.kelompok.delete({ where: { id } })
    }

    return NextResponse.json({ success: true, message: 'Kelompok berhasil dihapus' })
  } catch (e: any) {
    console.error('[DELETE /api/kelompok/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Kelompok tidak dapat dihapus karena masih memiliki data terkait (absensi/penilaian). Hapus data tersebut terlebih dahulu.' },
        { status: 400 }
      )
    }
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Gagal menghapus kelompok. ' + (e?.message || `Code: ${e?.code || '-'}`) },
      { status: 500 },
    )
  }
}
