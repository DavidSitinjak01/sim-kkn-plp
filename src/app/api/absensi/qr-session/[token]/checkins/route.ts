import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/absensi/qr-session/[token]/checkins
// Returns list of mahasiswa who have checked in for this QR session.
// For PERIODE sessions, only TODAY's check-ins are returned (so the live panel
// shows today's attendance, not the accumulated history across the whole period).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Normalize token to uppercase before lookup.
    const session = await db.qrSession.findUnique({
      where: { token: token.toUpperCase() },
    })

    if (!session) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 404 })
    }

    const isPeriode = session.tipeSesi === 'PERIODE'
    const checkinsWhere: { qrSessionId: string; tanggal?: { gte: Date; lte: Date } } = {
      qrSessionId: session.id,
    }
    if (isPeriode) {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date()
      dayEnd.setHours(23, 59, 59, 999)
      checkinsWhere.tanggal = { gte: dayStart, lte: dayEnd }
    }

    const checkins = await db.absensi.findMany({
      where: checkinsWhere,
      include: {
        mahasiswa: { include: { prodi: true } },
      },
      orderBy: { jamMasuk: 'desc' },
    })

    // Also get all members of the kelompok to show who hasn't checked in
    // For PERIODE sessions, "not checked in" = hasn't checked in TODAY
    const allMembers = await db.kelompokMember.findMany({
      where: { kelompokId: session.kelompokId },
      include: {
        mahasiswa: { include: { prodi: true } },
      },
    })

    const checkedInIds = new Set(checkins.map((c) => c.mahasiswaId))
    const notCheckedIn = allMembers
      .filter((m) => !checkedInIds.has(m.mahasiswaId))
      .map((m) => ({
        id: m.mahasiswa.id,
        nim: m.mahasiswa.nim,
        nama: m.mahasiswa.nama,
        prodi: m.mahasiswa.prodi?.nama ?? '-',
      }))

    return NextResponse.json({
      session: {
        id: session.id,
        token: session.token,
        kelompokId: session.kelompokId,
        tanggal: session.tanggal,
        tipeSesi: session.tipeSesi,
        startsAt: session.startsAt,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
      },
      checkins: checkins.map((c) => ({
        id: c.id,
        mahasiswaId: c.mahasiswaId,
        nim: c.mahasiswa.nim,
        nama: c.mahasiswa.nama,
        prodi: c.mahasiswa.prodi?.nama ?? '-',
        status: c.status,
        jamMasuk: c.jamMasuk,
        keterangan: c.keterangan,
      })),
      notCheckedIn,
      totalMembers: allMembers.length,
      totalCheckedIn: checkins.length,
    })
  } catch (e) {
    console.error('[GET /api/absensi/qr-session/[token]/checkins]', e)
    return NextResponse.json({ error: 'Gagal memuat data check-in' }, { status: 500 })
  }
}
