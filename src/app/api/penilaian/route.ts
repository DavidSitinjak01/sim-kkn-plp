import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_JENIS = ['KKN', 'PLP1', 'PLP2']

// GET - list penilaian with mahasiswa (prodi) + kelompok + dosen
// Support ?kelompokId=, ?jenis=, ?mahasiswaId=
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const kelompokId = searchParams.get('kelompokId')?.trim() ?? ''
    const jenis = searchParams.get('jenis')?.trim().toUpperCase() ?? ''
    const mahasiswaId = searchParams.get('mahasiswaId')?.trim() ?? ''

    const where: Record<string, unknown> = {}
    if (kelompokId) where.kelompokId = kelompokId
    if (jenis && VALID_JENIS.includes(jenis)) where.jenis = jenis
    if (mahasiswaId) where.mahasiswaId = mahasiswaId

    const data = await db.penilaian.findMany({
      where,
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
        dosen: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/penilaian]', e)
    return NextResponse.json({ error: 'Gagal memuat data penilaian' }, { status: 500 })
  }
}

// POST - create penilaian
// Body: { mahasiswaId, kelompokId, dosenId?, jenis, aspek, nilai }
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const required = ['mahasiswaId', 'kelompokId', 'jenis', 'aspek', 'nilai']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    if (!VALID_JENIS.includes(body.jenis)) {
      return NextResponse.json({ error: 'Jenis penilaian tidak valid (KKN/PLP1/PLP2)' }, { status: 400 })
    }

    const nilai = Number(body.nilai)
    if (Number.isNaN(nilai) || nilai < 0 || nilai > 100) {
      return NextResponse.json({ error: 'Nilai harus berupa angka 0-100' }, { status: 400 })
    }

    // Verify mahasiswa & kelompok exist
    const [mhs, kel] = await Promise.all([
      db.mahasiswa.findUnique({ where: { id: body.mahasiswaId } }),
      db.kelompok.findUnique({ where: { id: body.kelompokId } }),
    ])
    if (!mhs) return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 400 })
    if (!kel) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 400 })

    // Verify dosen if provided
    if (body.dosenId) {
      const dosen = await db.dosen.findUnique({ where: { id: body.dosenId } })
      if (!dosen) return NextResponse.json({ error: 'Dosen tidak ditemukan' }, { status: 400 })
    }

    const created = await db.penilaian.create({
      data: {
        mahasiswaId: body.mahasiswaId,
        kelompokId: body.kelompokId,
        dosenId: body.dosenId || null,
        jenis: body.jenis,
        aspek: String(body.aspek).trim(),
        nilai,
      },
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
        dosen: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('[POST /api/penilaian]', e)
    return NextResponse.json({ error: 'Gagal membuat penilaian' }, { status: 500 })
  }
}
