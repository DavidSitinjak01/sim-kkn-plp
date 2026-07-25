import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list all kelompok with desa/sekolah/dosen + _count members
// Support ?tipe= filter (KKN/PLP1/PLP2)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tipe = searchParams.get('tipe')?.trim().toUpperCase() ?? ''
    const tahun = searchParams.get('tahunAkademik')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    const where: Record<string, unknown> = {}
    if (tipe && ['KKN', 'PLP1', 'PLP2'].includes(tipe)) where.tipe = tipe
    if (tahun) where.tahunAkademik = { contains: tahun }
    if (search) where.nama = { contains: search }

    const data = await db.kelompok.findMany({
      where,
      include: {
        desa: true,
        sekolah: true,
        dosen: true,
        _count: { select: { members: true } },
      },
      orderBy: [{ tipe: 'asc' }, { nama: 'asc' }],
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/kelompok]', e)
    return NextResponse.json({ error: 'Gagal memuat data kelompok' }, { status: 500 })
  }
}

// POST - create new kelompok
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const required = ['nama', 'tipe', 'tahunAkademik', 'semester']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    if (!['KKN', 'PLP1', 'PLP2'].includes(body.tipe)) {
      return NextResponse.json({ error: 'Tipe tidak valid (KKN/PLP1/PLP2)' }, { status: 400 })
    }
    if (!['GANJIL', 'GENAP'].includes(body.semester)) {
      return NextResponse.json({ error: 'Semester tidak valid (GANJIL/GENAP)' }, { status: 400 })
    }

    // KKN must have desaId, PLP must have sekolahId
    const isKKN = body.tipe === 'KKN'
    if (isKKN && !body.desaId) {
      return NextResponse.json({ error: 'Kelompok KKN wajib memiliki desa' }, { status: 400 })
    }
    if (!isKKN && !body.sekolahId) {
      return NextResponse.json({ error: 'Kelompok PLP wajib memiliki sekolah' }, { status: 400 })
    }

    // Status default AKTIF
    const status = body.status ?? 'AKTIF'
    if (!['AKTIF', 'NONAKTIF', 'SELESAI'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const created = await db.kelompok.create({
      data: {
        nama: body.nama.trim(),
        tipe: body.tipe,
        tahunAkademik: body.tahunAkademik.trim(),
        semester: body.semester,
        desaId: isKKN ? body.desaId : null,
        sekolahId: !isKKN ? body.sekolahId : null,
        dosenId: body.dosenId || null,
        status,
      },
      include: {
        desa: true,
        sekolah: true,
        dosen: true,
        _count: { select: { members: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/kelompok]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Dosen/desa/sekolah yang dipilih tidak valid' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal membuat kelompok' }, { status: 500 })
  }
}
