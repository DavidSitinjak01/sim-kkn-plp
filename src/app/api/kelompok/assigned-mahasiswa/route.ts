import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - returns list of mahasiswa already assigned to a kelompok of the given tipe
// Query: ?tipe=KKN|PLP1|PLP2
// Response: [{ mahasiswaId, kelompokId, kelompokNama, tipe }]
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tipe = searchParams.get('tipe')?.trim().toUpperCase() ?? ''

    if (!tipe || !['KKN', 'PLP1', 'PLP2'].includes(tipe)) {
      return NextResponse.json(
        { error: 'Parameter tipe wajib diisi (KKN/PLP1/PLP2)' },
        { status: 400 }
      )
    }

    const members = await db.kelompokMember.findMany({
      where: { kelompok: { tipe } },
      select: {
        mahasiswaId: true,
        kelompokId: true,
        kelompok: { select: { nama: true, tipe: true } },
      },
    })

    const result = members.map((m) => ({
      mahasiswaId: m.mahasiswaId,
      kelompokId: m.kelompokId,
      kelompokNama: m.kelompok.nama,
      tipe: m.kelompok.tipe,
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error('[GET /api/kelompok/assigned-mahasiswa]', e)
    return NextResponse.json(
      { error: 'Gagal memuat data penugasan mahasiswa' },
      { status: 500 }
    )
  }
}
