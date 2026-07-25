import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [
      mahasiswa, dosen, desa, sekolah, kelompok, surat, pengumuman, agenda, absensiToday
    ] = await Promise.all([
      db.mahasiswa.count(),
      db.dosen.count(),
      db.desa.count(),
      db.sekolah.count(),
      db.kelompok.count(),
      db.surat.count(),
      db.pengumuman.count({ where: { tanggal: { gte: new Date(Date.now() - 30 * 86400000) } } }),
      db.agenda.count({ where: { tanggal: { gte: new Date() } } }),
      db.absensi.count({ where: { tanggal: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ])

    // Charts data
    // 1. Peserta per prodi (top 8)
    const mhsPerProdi = await db.mahasiswa.groupBy({
      by: ['prodiId'],
      _count: true,
    })
    const prodiIds = mhsPerProdi.map(m => m.prodiId)
    const prodis = await db.programStudi.findMany({ where: { id: { in: prodiIds } } })
    const pesertaPerProdi = mhsPerProdi.map(m => {
      const p = prodis.find(p => p.id === m.prodiId)
      return { name: p?.nama || 'N/A', value: m._count }
    }).sort((a, b) => b.value - a.value).slice(0, 8)

    // 2. Kelompok by tipe
    const kelompokKKN = await db.kelompok.count({ where: { tipe: 'KKN' } })
    const kelompokPLP1 = await db.kelompok.count({ where: { tipe: 'PLP1' } })
    const kelompokPLP2 = await db.kelompok.count({ where: { tipe: 'PLP2' } })

    // 3. Absensi last 7 days
    const absensiTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      const [hadir, izin, sakit, alpha] = await Promise.all([
        db.absensi.count({ where: { tanggal: { gte: date, lt: nextDate }, status: 'HADIR' } }),
        db.absensi.count({ where: { tanggal: { gte: date, lt: nextDate }, status: 'IZIN' } }),
        db.absensi.count({ where: { tanggal: { gte: date, lt: nextDate }, status: 'SAKIT' } }),
        db.absensi.count({ where: { tanggal: { gte: date, lt: nextDate }, status: 'ALPHA' } }),
      ])
      absensiTrend.push({
        name: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        Hadir: hadir, Izin: izin, Sakit: sakit, Alpha: alpha,
      })
    }

    // 4. Mahasiswa per angkatan
    const mhsPerAngkatan = await db.mahasiswa.groupBy({
      by: ['angkatan'],
      _count: true,
      orderBy: { angkatan: 'asc' },
    })

    // 5. Distribution KKN vs PLP
    const mhsKKN = await db.kelompokMember.count({
      where: { kelompok: { tipe: 'KKN' } }
    })
    const mhsPLP1 = await db.kelompokMember.count({
      where: { kelompok: { tipe: 'PLP1' } }
    })
    const mhsPLP2 = await db.kelompokMember.count({
      where: { kelompok: { tipe: 'PLP2' } }
    })

    // Recent notifications
    const recentPengumuman = await db.pengumuman.findMany({
      take: 5,
      orderBy: { tanggal: 'desc' },
    })
    const upcomingAgenda = await db.agenda.findMany({
      where: { tanggal: { gte: new Date() } },
      take: 5,
      orderBy: { tanggal: 'asc' },
    })
    const recentAktivitas = await db.aktivitas.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    })

    return NextResponse.json({
      stats: {
        mahasiswa, dosen, desa, sekolah, kelompok, surat,
        pengumuman, agenda, absensiToday,
      },
      charts: {
        pesertaPerProdi,
        kelompokByTipe: [
          { name: 'KKN', value: kelompokKKN },
          { name: 'PLP 1', value: kelompokPLP1 },
          { name: 'PLP 2', value: kelompokPLP2 },
        ],
        absensiTrend,
        mhsPerAngkatan: mhsPerAngkatan.map(m => ({ name: String(m.angkatan), value: m._count })),
        distribusi: [
          { name: 'KKN', value: mhsKKN },
          { name: 'PLP 1', value: mhsPLP1 },
          { name: 'PLP 2', value: mhsPLP2 },
        ],
      },
      recentPengumuman,
      upcomingAgenda,
      recentAktivitas,
    })
  } catch (e) {
    console.error('Dashboard error:', e)
    return NextResponse.json({ error: 'Gagal memuat data dashboard' }, { status: 500 })
  }
}
