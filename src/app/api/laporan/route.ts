import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_TYPES = ['mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'penempatan', 'persuratan', 'nilai']

// Helper: parse ?from= and ?to= (YYYY-MM-DD) into a date filter (gte/lt)
function buildDateRange(from?: string, to?: string, field: 'tanggal' | 'createdAt' = 'tanggal') {
  const filter: Record<string, Date> = {}
  if (from) {
    const d = new Date(from)
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0)
      filter.gte = d
    }
  }
  if (to) {
    const d = new Date(to)
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      filter.lte = d
    }
  }
  return Object.keys(filter).length > 0 ? { [field]: filter } : {}
}

// GET /api/laporan?type=...&from=YYYY-MM-DD&to=YYYY-MM-DD&[extra filters]
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') ?? '').trim().toLowerCase()
    const from = searchParams.get('from')?.trim() ?? ''
    const to = searchParams.get('to')?.trim() ?? ''

    if (!type) {
      return NextResponse.json({ error: 'Parameter type wajib diisi' }, { status: 400 })
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `Type tidak valid. Pilihan: ${VALID_TYPES.join(', ')}` }, { status: 400 })
    }

    switch (type) {
      case 'mahasiswa': {
        const data = await db.mahasiswa.findMany({
          include: { prodi: { include: { fakultas: true } } },
          orderBy: [{ angkatan: 'desc' }, { nama: 'asc' }],
        })
        return NextResponse.json(data)
      }

      case 'dosen': {
        const data = await db.dosen.findMany({
          include: { fakultas: true, prodi: true },
          orderBy: [{ nama: 'asc' }],
        })
        return NextResponse.json(data)
      }

      case 'desa': {
        const data = await db.desa.findMany({
          include: { _count: { select: { kelompok: true } } },
          orderBy: [{ nama: 'asc' }],
        })
        return NextResponse.json(data)
      }

      case 'sekolah': {
        const data = await db.sekolah.findMany({
          include: { _count: { select: { kelompok: true } } },
          orderBy: [{ jenjang: 'asc' }, { nama: 'asc' }],
        })
        return NextResponse.json(data)
      }

      case 'absensi': {
        const kelompokId = searchParams.get('kelompokId')?.trim() ?? ''
        const where: Record<string, unknown> = {}
        if (kelompokId) where.kelompokId = kelompokId
        Object.assign(where, buildDateRange(from, to, 'tanggal'))
        const data = await db.absensi.findMany({
          where,
          include: {
            mahasiswa: { include: { prodi: true } },
            kelompok: true,
          },
          orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
        })
        return NextResponse.json(data)
      }

      case 'penempatan': {
        const tipe = searchParams.get('tipe')?.trim().toUpperCase() ?? ''
        const where: Record<string, unknown> = {}
        if (tipe && ['KKN', 'PLP1', 'PLP2'].includes(tipe)) where.tipe = tipe
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
      }

      case 'persuratan': {
        const jenis = searchParams.get('jenis')?.trim().toUpperCase() ?? ''
        const status = searchParams.get('status')?.trim().toUpperCase() ?? ''
        const where: Record<string, unknown> = {}
        if (jenis) where.jenis = jenis
        if (status) where.status = status
        Object.assign(where, buildDateRange(from, to, 'tanggal'))
        const data = await db.surat.findMany({
          where,
          orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }],
        })
        return NextResponse.json(data)
      }

      case 'nilai': {
        const jenis = searchParams.get('jenis')?.trim().toUpperCase() ?? ''
        const kelompokId = searchParams.get('kelompokId')?.trim() ?? ''
        const where: Record<string, unknown> = {}
        if (jenis && ['KKN', 'PLP1', 'PLP2'].includes(jenis)) where.jenis = jenis
        if (kelompokId) where.kelompokId = kelompokId
        const data = await db.penilaian.findMany({
          where,
          include: {
            mahasiswa: { include: { prodi: true } },
            kelompok: true,
            dosen: true,
          },
          orderBy: [{ createdAt: 'desc' }],
        })
        return NextResponse.json(data)
      }

      default:
        return NextResponse.json({ error: 'Type tidak valid' }, { status: 400 })
    }
  } catch (e) {
    console.error('[GET /api/laporan]', e)
    return NextResponse.json({ error: 'Gagal memuat laporan' }, { status: 500 })
  }
}
