import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list all desa with kelompok count, support ?search= (nama, kecamatan, kabupaten)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() ?? ''

    const where = search
      ? {
          OR: [
            { nama: { contains: search } },
            { kecamatan: { contains: search } },
            { kabupaten: { contains: search } },
            { provinsi: { contains: search } },
          ],
        }
      : {}

    const data = await db.desa.findMany({
      where,
      include: {
        _count: { select: { kelompok: true } },
      },
      orderBy: [{ kabupaten: 'asc' }, { nama: 'asc' }],
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/desa]', e)
    return NextResponse.json({ error: 'Gagal memuat data desa' }, { status: 500 })
  }
}

// POST - create new desa
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    const required = ['nama', 'kecamatan', 'kabupaten', 'provinsi']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    // Parse numeric / optional fields
    const lat = body.latitude !== undefined && body.latitude !== null && body.latitude !== '' ? Number(body.latitude) : null
    const lng = body.longitude !== undefined && body.longitude !== null && body.longitude !== '' ? Number(body.longitude) : null

    if (lat !== null && Number.isNaN(lat)) {
      return NextResponse.json({ error: 'Latitude tidak valid' }, { status: 400 })
    }
    if (lng !== null && Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Longitude tidak valid' }, { status: 400 })
    }

    const kuota = body.kuota !== undefined && body.kuota !== null && body.kuota !== '' ? Number(body.kuota) : 0
    if (Number.isNaN(kuota) || kuota < 0) {
      return NextResponse.json({ error: 'Kuota tidak valid' }, { status: 400 })
    }

    const created = await db.desa.create({
      data: {
        nama: body.nama.trim(),
        kecamatan: body.kecamatan.trim(),
        kabupaten: body.kabupaten.trim(),
        provinsi: body.provinsi.trim(),
        kodePos: body.kodePos?.trim() || null,
        latitude: lat,
        longitude: lng,
        kuota,
        keterangan: body.keterangan?.trim() || null,
        foto: body.foto?.trim() || null,
      },
      include: { _count: { select: { kelompok: true } } },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/desa]', e)
    return NextResponse.json({ error: 'Gagal membuat desa' }, { status: 500 })
  }
}
