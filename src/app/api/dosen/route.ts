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
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const required = ['nidn', 'nama', 'email', 'noHp', 'fakultasId', 'jabatan']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    const validStatus = ['AKTIF', 'NONAKTIF']
    const status = body.status ?? 'AKTIF'
    if (!validStatus.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const exist = await db.dosen.findUnique({ where: { nidn: body.nidn } })
    if (exist) {
      return NextResponse.json({ error: 'NIDN sudah terdaftar' }, { status: 400 })
    }

    const created = await db.dosen.create({
      data: {
        nidn: body.nidn.trim(),
        nama: body.nama.trim(),
        email: body.email.trim().toLowerCase(),
        noHp: body.noHp.trim(),
        fakultasId: body.fakultasId,
        prodiId: body.prodiId || null,
        jabatan: body.jabatan.trim(),
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
