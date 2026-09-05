import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list link penting, optionally filtered by ?kategori= or ?status=
// Ordered by urutan asc, then createdAt desc
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const kategori = searchParams.get('kategori')?.trim() ?? ''
    const status = searchParams.get('status')?.trim().toUpperCase() ?? ''

    const where: Record<string, unknown> = {}
    if (kategori) where.kategori = kategori
    if (status === 'AKTIF' || status === 'NONAKTIF') where.status = status

    const links = await db.linkPenting.findMany({
      where,
      orderBy: [{ urutan: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(links)
  } catch (e) {
    console.error('[GET /api/link-penting]', e)
    return NextResponse.json({ error: 'Gagal memuat link penting' }, { status: 500 })
  }
}

// POST - create new link penting
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.judul || String(body.judul).trim() === '') {
      return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 })
    }
    if (!body.url || String(body.url).trim() === '') {
      return NextResponse.json({ error: 'URL wajib diisi' }, { status: 400 })
    }

    // Normalize & validate URL
    let url = String(body.url).trim()
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'URL tidak valid' }, { status: 400 })
    }

    const status = body.status ? String(body.status).toUpperCase() : 'AKTIF'
    if (status !== 'AKTIF' && status !== 'NONAKTIF') {
      return NextResponse.json({ error: 'Status tidak valid (AKTIF/NONAKTIF)' }, { status: 400 })
    }

    const created = await db.linkPenting.create({
      data: {
        judul: String(body.judul).trim(),
        url,
        deskripsi: body.deskripsi ? String(body.deskripsi).trim() : null,
        kategori: body.kategori ? String(body.kategori).trim() : 'Umum',
        icon: body.icon ? String(body.icon).trim() : null,
        urutan: Number.isFinite(Number(body.urutan)) ? Number(body.urutan) : 0,
        status,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('[POST /api/link-penting]', e)
    return NextResponse.json({ error: 'Gagal membuat link penting' }, { status: 500 })
  }
}
