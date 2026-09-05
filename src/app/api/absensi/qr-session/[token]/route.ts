import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/absensi/qr-session/[token]?mahasiswaId=xxx
// Validate token: check exists, active, started, not expired
// If mahasiswaId provided, also check if mahasiswa belongs to the kelompok
// Returns: session info + validation result
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { searchParams } = new URL(req.url)
    const mahasiswaId = searchParams.get('mahasiswaId')?.trim() ?? ''

    // Normalize token to uppercase before lookup. Both HARIAN tokens (generated
    // uppercase) and PERIODE tokens (now also generated uppercase — see
    // /api/absensi/active-sessions) are stored uppercase in the DB.
    const session = await db.qrSession.findUnique({
      where: { token: token.toUpperCase() },
      include: { kelompok: true },
    })

    if (!session) {
      return NextResponse.json({
        valid: false,
        reason: 'Token tidak ditemukan. Pastikan kode QR yang Anda scan benar.',
      }, { status: 404 })
    }

    if (!session.isActive) {
      return NextResponse.json({
        valid: false,
        reason: 'Sesi absensi ini sudah dinonaktifkan.',
      }, { status: 410 })
    }

    const now = new Date()
    // For PERIODE sessions with a startsAt, session must have started
    if (session.startsAt && now < session.startsAt) {
      return NextResponse.json({
        valid: false,
        reason: `Sesi belum dimulai. Berlaku mulai ${new Date(session.startsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      }, { status: 410 })
    }

    if (now > session.expiresAt) {
      return NextResponse.json({
        valid: false,
        reason: 'QR Code sudah kedaluwarsa. Minta admin/dosen membuat QR baru.',
      }, { status: 410 })
    }

    // If mahasiswaId provided, verify membership
    let isMember = true
    let alreadyCheckedIn = false
    let masukDone = false
    let pulangDone = false
    let jamMasuk: string | null = null
    let jamPulang: string | null = null
    let mhsInfo = null

    if (mahasiswaId) {
      const mhs = await db.mahasiswa.findUnique({
        where: { id: mahasiswaId },
        include: { prodi: true },
      })
      if (!mhs) {
        return NextResponse.json({
          valid: false,
          reason: 'Data mahasiswa tidak ditemukan. Silakan login ulang.',
        }, { status: 404 })
      }
      mhsInfo = { id: mhs.id, nim: mhs.nim, nama: mhs.nama, prodi: mhs.prodi?.nama ?? '-' }

      // Check if mahasiswa is a member of the kelompok
      const membership = await db.kelompokMember.findUnique({
        where: { kelompokId_mahasiswaId: { kelompokId: session.kelompokId, mahasiswaId } },
      })
      if (!membership) {
        isMember = false
      }

      // Check today's existing record for this session.
      // Use WIB date boundaries so the check is consistent regardless of server TZ.
      const isPeriode = session.tipeSesi === 'PERIODE'
      const WIB_TZ = 'Asia/Jakarta'
      const wibDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: WIB_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date())
      const dayStart = new Date(`${wibDateStr}T00:00:00.000Z`)
      const dayEnd = new Date(`${wibDateStr}T23:59:59.999Z`)
      const existingWhere = isPeriode
        ? { mahasiswaId, tanggal: { gte: dayStart, lte: dayEnd } }
        : { mahasiswaId, qrSessionId: session.id }
      const existing = await db.absensi.findFirst({
        where: existingWhere,
        select: { id: true, jamMasuk: true, jamPulang: true },
      })
      if (existing) {
        alreadyCheckedIn = true
        masukDone = !!existing.jamMasuk
        pulangDone = !!existing.jamPulang
        jamMasuk = existing.jamMasuk ?? null
        jamPulang = existing.jamPulang ?? null
      }
    }

    const remainingMs = session.expiresAt.getTime() - Date.now()
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000))

    return NextResponse.json({
      valid: true,
      session: {
        id: session.id,
        token: session.token,
        kelompok: {
          id: session.kelompok.id,
          nama: session.kelompok.nama,
          tipe: session.kelompok.tipe,
        },
        tanggal: session.tanggal,
        tipeSesi: session.tipeSesi,
        startsAt: session.startsAt,
        expiresAt: session.expiresAt,
        remainingSeconds,
      },
      mahasiswa: mhsInfo,
      isMember,
      // Back-compat: alreadyCheckedIn == masukDone (MASUK has been recorded)
      alreadyCheckedIn,
      masukDone,
      pulangDone,
      jamMasuk,
      jamPulang,
    })
  } catch (e) {
    console.error('[GET /api/absensi/qr-session/[token]]', e)
    return NextResponse.json({ error: 'Gagal memvalidasi token' }, { status: 500 })
  }
}
