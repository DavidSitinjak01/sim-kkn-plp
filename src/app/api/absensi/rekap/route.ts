import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - rekap absensi bulanan per mahasiswa
// Support ?kelompokId= and ?bulan= (YYYY-MM)
// Return array of { mahasiswaId, nim, nama, hadir, izin, sakit, alpha, total }
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const kelompokId = searchParams.get('kelompokId')?.trim() ?? ''
    const bulan = searchParams.get('bulan')?.trim() ?? ''

    const where: Record<string, unknown> = {}
    if (kelompokId) where.kelompokId = kelompokId

    // Filter by month if provided (YYYY-MM)
    if (bulan && /^\d{4}-\d{2}$/.test(bulan)) {
      const [yearStr, monthStr] = bulan.split('-')
      const year = Number(yearStr)
      const month = Number(monthStr)
      if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
        const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
        const end = new Date(year, month, 1, 0, 0, 0, 0)
        where.tanggal = { gte: start, lt: end }
      }
    }

    const records = await db.absensi.findMany({
      where,
      include: {
        mahasiswa: { include: { prodi: true } },
        kelompok: true,
      },
      orderBy: [{ mahasiswa: { nim: 'asc' } }],
    })

    // Group by mahasiswaId
    const map = new Map<string, {
      mahasiswaId: string
      nim: string
      nama: string
      prodi: string
      kelompokNama: string
      hadir: number
      izin: number
      sakit: number
      alpha: number
      total: number
    }>()

    for (const r of records) {
      const key = r.mahasiswaId
      if (!map.has(key)) {
        map.set(key, {
          mahasiswaId: r.mahasiswaId,
          nim: r.mahasiswa.nim,
          nama: r.mahasiswa.nama,
          prodi: r.mahasiswa.prodi?.nama ?? '-',
          kelompokNama: r.kelompok?.nama ?? '-',
          hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0,
        })
      }
      const row = map.get(key)!
      row.total += 1
      if (r.status === 'HADIR') row.hadir += 1
      else if (r.status === 'IZIN') row.izin += 1
      else if (r.status === 'SAKIT') row.sakit += 1
      else if (r.status === 'ALPHA') row.alpha += 1
    }

    return NextResponse.json(Array.from(map.values()))
  } catch (e) {
    console.error('[GET /api/absensi/rekap]', e)
    return NextResponse.json({ error: 'Gagal memuat rekap absensi' }, { status: 500 })
  }
}
