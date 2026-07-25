import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list absensi with mahasiswa (include prodi) + kelompok
// Support ?kelompokId=, ?status=, ?tanggal= (date-only compare), ?search= (by nim/nama mahasiswa)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const kelompokId = searchParams.get('kelompokId')?.trim() ?? ''
    const status = searchParams.get('status')?.trim().toUpperCase() ?? ''
    const tanggal = searchParams.get('tanggal')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    // Date-only filter: build start/end of day for equality check
    let dateFilter: { gte?: Date; lt?: Date } | undefined
    if (tanggal) {
      const start = new Date(tanggal)
      if (!isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        dateFilter = { gte: start, lt: end }
      }
    }

    const where: Record<string, unknown> = {}
    if (kelompokId) where.kelompokId = kelompokId
    if (status && ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'].includes(status)) {
      where.status = status
    }
    if (dateFilter) where.tanggal = dateFilter
    if (search) {
      where.mahasiswa = {
        OR: [
          { nim: { contains: search } },
          { nama: { contains: search } },
        ],
      }
    }

    const data = await db.absensi.findMany({
      where,
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
      },
      orderBy: [{ tanggal: 'desc' }, { jamMasuk: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/absensi]', e)
    return NextResponse.json({ error: 'Gagal memuat data absensi' }, { status: 500 })
  }
}

// POST - create absensi record
// Body: { mahasiswaId, kelompokId, tanggal, status, keterangan?, latitude?, longitude?, fotoSelfie? }
// Set jamMasuk to now if status === 'HADIR'
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    const required = ['mahasiswaId', 'kelompokId', 'tanggal', 'status']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    const validStatus = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA']
    if (!validStatus.includes(body.status)) {
      return NextResponse.json({ error: 'Status tidak valid (HADIR/IZIN/SAKIT/ALPHA)' }, { status: 400 })
    }

    // Parse tanggal (date-only, set to noon to avoid TZ issues)
    const tanggal = new Date(body.tanggal)
    if (isNaN(tanggal.getTime())) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    }
    tanggal.setHours(12, 0, 0, 0)

    // Optional numeric fields
    const lat = body.latitude !== undefined && body.latitude !== null && body.latitude !== ''
      ? Number(body.latitude) : null
    const lng = body.longitude !== undefined && body.longitude !== null && body.longitude !== ''
      ? Number(body.longitude) : null
    if (lat !== null && Number.isNaN(lat)) {
      return NextResponse.json({ error: 'Latitude tidak valid' }, { status: 400 })
    }
    if (lng !== null && Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Longitude tidak valid' }, { status: 400 })
    }

    // Verify mahasiswa & kelompok exist
    const [mhs, kel] = await Promise.all([
      db.mahasiswa.findUnique({ where: { id: body.mahasiswaId } }),
      db.kelompok.findUnique({ where: { id: body.kelompokId } }),
    ])
    if (!mhs) return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 400 })
    if (!kel) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 400 })

    const created = await db.absensi.create({
      data: {
        mahasiswaId: body.mahasiswaId,
        kelompokId: body.kelompokId,
        tanggal,
        status: body.status,
        jamMasuk: body.status === 'HADIR' ? new Date() : null,
        jamPulang: null,
        latitude: lat,
        longitude: lng,
        fotoSelfie: body.fotoSelfie?.trim() || null,
        keterangan: body.keterangan?.trim() || null,
      },
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/absensi]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Mahasiswa atau kelompok tidak valid' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal membuat absensi' }, { status: 500 })
  }
}
