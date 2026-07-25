import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list all sekolah with kelompok count, support ?search= (nama, kecamatan, kabupaten, jenjang)
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
            { jenjang: { contains: search } },
            { kepalaSekolah: { contains: search } },
          ],
        }
      : {}

    const data = await db.sekolah.findMany({
      where,
      include: {
        _count: { select: { kelompok: true } },
      },
      orderBy: [{ jenjang: 'asc' }, { nama: 'asc' }],
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/sekolah]', e)
    return NextResponse.json({ error: 'Gagal memuat data sekolah' }, { status: 500 })
  }
}

// POST - create new sekolah
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    const required = ['nama', 'jenjang', 'alamat', 'kecamatan', 'kabupaten', 'provinsi', 'kepalaSekolah', 'noHp']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    // Validate jenjang
    const validJenjang = ['SD', 'SMP', 'SMA', 'SMK']
    if (!validJenjang.includes(body.jenjang)) {
      return NextResponse.json({ error: 'Jenjang harus salah satu dari: SD, SMP, SMA, SMK' }, { status: 400 })
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

    const created = await db.sekolah.create({
      data: {
        nama: body.nama.trim(),
        jenjang: body.jenjang,
        alamat: body.alamat.trim(),
        kecamatan: body.kecamatan.trim(),
        kabupaten: body.kabupaten.trim(),
        provinsi: body.provinsi.trim(),
        kepalaSekolah: body.kepalaSekolah.trim(),
        noHp: body.noHp.trim(),
        email: body.email?.trim() || null,
        latitude: lat,
        longitude: lng,
        kuota,
      },
      include: { _count: { select: { kelompok: true } } },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/sekolah]', e)
    return NextResponse.json({ error: 'Gagal membuat sekolah' }, { status: 500 })
  }
}
