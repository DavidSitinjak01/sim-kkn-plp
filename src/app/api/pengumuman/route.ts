import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_PRIORITAS = ['URGENT', 'NORMAL', 'INFO']

// GET - list pengumuman, ordered by tanggal desc
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = searchParams.get('limit')
    const prioritas = searchParams.get('prioritas')?.trim().toUpperCase() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    const where: Record<string, unknown> = {}
    if (prioritas && VALID_PRIORITAS.includes(prioritas)) where.prioritas = prioritas
    if (search) {
      where.OR = [
        { judul: { contains: search } },
        { konten: { contains: search } },
      ]
    }

    const pengumuman = await db.pengumuman.findMany({
      where,
      take: limit ? parseInt(limit) : undefined,
      orderBy: { tanggal: 'desc' },
    })
    return NextResponse.json(pengumuman)
  } catch (e) {
    console.error('[GET /api/pengumuman]', e)
    return NextResponse.json({ error: 'Gagal memuat pengumuman' }, { status: 500 })
  }
}

// POST - create pengumuman
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const required = ['judul', 'konten']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    const prioritas = body.prioritas ? String(body.prioritas).toUpperCase() : 'NORMAL'
    if (!VALID_PRIORITAS.includes(prioritas)) {
      return NextResponse.json({ error: 'Prioritas tidak valid (URGENT/NORMAL/INFO)' }, { status: 400 })
    }

    let tanggal = new Date()
    if (body.tanggal) {
      const t = new Date(body.tanggal)
      if (!isNaN(t.getTime())) tanggal = t
    }

    const created = await db.pengumuman.create({
      data: {
        judul: String(body.judul).trim(),
        konten: String(body.konten).trim(),
        prioritas,
        tanggal,
        penulis: body.penulis ? String(body.penulis).trim() : null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('[POST /api/pengumuman]', e)
    return NextResponse.json({ error: 'Gagal membuat pengumuman' }, { status: 500 })
  }
}
