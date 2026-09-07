import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list all kelompok with desa/sekolah/dosen + _count members
// Support ?tipe= filter (KKN/PLP1/PLP2)
//
// BULLETPROOF: pakai `select` dengan field yang PASTI ada di DB lama.
// JANGAN include koordinatorId — kolom belum ada di production DB.
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
      select: {
        id: true,
        nama: true,
        tipe: true,
        tahunAkademik: true,
        semester: true,
        desaId: true,
        desa: true,
        sekolahId: true,
        sekolah: true,
        dosenId: true,
        dosen: true,
        status: true,
        createdAt: true,
        updatedAt: true,
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
// BULLETPROOF: JANGAN PERNAH include koordinatorId — kolom belum ada di DB.
// Field ini di-skip sampai user menjalankan `prisma db push`.
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

    const isKKN = body.tipe === 'KKN'
    if (isKKN && !body.desaId) {
      return NextResponse.json({ error: 'Kelompok KKN wajib memiliki desa' }, { status: 400 })
    }
    if (!isKKN && !body.sekolahId) {
      return NextResponse.json({ error: 'Kelompok PLP wajib memiliki sekolah' }, { status: 400 })
    }

    const status = body.status ?? 'AKTIF'
    if (!['AKTIF', 'NONAKTIF', 'SELESAI'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    // Build create data — JANGAN include koordinatorId
    const createData: Record<string, unknown> = {
      nama: body.nama.trim(),
      tipe: body.tipe,
      tahunAkademik: body.tahunAkademik.trim(),
      semester: body.semester,
      desaId: isKKN ? body.desaId : null,
      sekolahId: !isKKN ? body.sekolahId : null,
      dosenId: body.dosenId || null,
      status,
    }
    // ⚠️ koordinatorId TIDAK di-include — kolom belum ada di production DB.

    // Create dengan select MINIMAL (TIDAK include koordinatorId)
    const created = await db.kelompok.create({
      data: createData as any,
      select: {
        id: true,
        nama: true,
        tipe: true,
        tahunAkademik: true,
        semester: true,
        desaId: true,
        desa: true,
        sekolahId: true,
        sekolah: true,
        dosenId: true,
        dosen: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { members: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/kelompok]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Dosen/desa/sekolah yang dipilih tidak valid' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal membuat kelompok. ' + (e?.message || '') }, { status: 500 })
  }
}
