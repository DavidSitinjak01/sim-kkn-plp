import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_TIPE = ['KKN', 'PLP', 'UMUM']

// GET - list agenda
// Support ?upcoming=true (future only), ?tipe=
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const upcoming = searchParams.get('upcoming') === 'true'
    const tipe = searchParams.get('tipe')?.trim().toUpperCase() ?? ''

    const where: Record<string, unknown> = {}
    if (upcoming) {
      where.tanggal = { gte: new Date() }
    }
    if (tipe && VALID_TIPE.includes(tipe)) {
      where.tipe = tipe
    }

    const data = await db.agenda.findMany({
      where,
      orderBy: { tanggal: 'asc' },
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/agenda]', e)
    return NextResponse.json({ error: 'Gagal memuat data agenda' }, { status: 500 })
  }
}

// POST - create agenda
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const required = ['judul', 'tanggal', 'tipe']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    if (!VALID_TIPE.includes(body.tipe)) {
      return NextResponse.json({ error: 'Tipe agenda tidak valid (KKN/PLP/UMUM)' }, { status: 400 })
    }

    const tanggal = new Date(body.tanggal)
    if (isNaN(tanggal.getTime())) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    }

    const created = await db.agenda.create({
      data: {
        judul: String(body.judul).trim(),
        tanggal,
        lokasi: body.lokasi ? String(body.lokasi).trim() : null,
        deskripsi: body.deskripsi ? String(body.deskripsi).trim() : null,
        tipe: body.tipe,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('[POST /api/agenda]', e)
    return NextResponse.json({ error: 'Gagal membuat agenda' }, { status: 500 })
  }
}
