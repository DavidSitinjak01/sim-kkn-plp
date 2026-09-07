import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list all dosen with fakultas + prodi
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() ?? ''

    const where = search
      ? {
          OR: [
            { nidn: { contains: search } },
            { nama: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}

    const data = await db.dosen.findMany({
      where,
      include: {
        fakultas: true,
        prodi: true,
      },
      orderBy: { nama: 'asc' },
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/dosen]', e)
    return NextResponse.json({ error: 'Gagal memuat data dosen' }, { status: 500 })
  }
}

// POST - create new dosen
// Field wajib: nama saja. nidn, email, noHp, fakultasId, prodiId, jabatan — opsional.
// (Sesuai permintaan user: "yang penting ada nama itu sudah mewakili".)
export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body.nama || String(body.nama).trim() === '') {
      return NextResponse.json({ error: 'Field nama wajib diisi' }, { status: 400 })
    }

    const validStatus = ['AKTIF', 'NONAKTIF']
    const status = body.status ?? 'AKTIF'
    if (!validStatus.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    // NIDN kalau diisi, harus unik
    const nidn = body.nidn ? String(body.nidn).trim() : null
    if (nidn) {
      const exist = await db.dosen.findUnique({ where: { nidn } })
      if (exist) {
        return NextResponse.json({ error: `NIDN "${nidn}" sudah terdaftar di dosen "${exist.nama}"` }, { status: 400 })
      }
    }

    // Jabatan default kalau kosong
    const jabatan = body.jabatan && String(body.jabatan).trim() !== ''
      ? String(body.jabatan).trim()
      : 'Dosen Pendamping'

    const created = await db.dosen.create({
      data: {
        nidn,
        nama: String(body.nama).trim(),
        email: body.email ? String(body.email).trim().toLowerCase() : null,
        noHp: body.noHp ? String(body.noHp).trim() : null,
        fakultasId: body.fakultasId || null,
        prodiId: body.prodiId || null,
        jabatan,
        keahlian: body.keahlian?.trim() || null,
        foto: body.foto?.trim() || null,
        status,
      },
      include: { fakultas: true, prodi: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/dosen]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIDN atau email sudah terdaftar' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal membuat dosen' }, { status: 500 })
  }
}
