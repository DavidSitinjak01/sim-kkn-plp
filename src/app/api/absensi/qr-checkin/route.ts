import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/absensi/qr-checkin
// Body: { token, mahasiswaId, tipe?: 'MASUK' | 'PULANG', latitude?, longitude? }
//
// Mahasiswa scans QR → submits token → backend validates & records attendance.
//
// tipe='MASUK' (default):
//   - Creates new Absensi record with status HADIR, jamMasuk = now
//   - Blocks if already checked-in (today for PERIODE, ever for HARIAN)
//
// tipe='PULANG':
//   - Finds today's existing MASUK record (jamMasuk != null, jamPulang == null)
//   - Updates jamPulang = now
//   - Returns 404 if no MASUK record found
//   - Returns 409 if already checked-out (jamPulang != null)
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.token || String(body.token).trim() === '') {
      return NextResponse.json({ error: 'Token wajib diisi' }, { status: 400 })
    }
    if (!body.mahasiswaId || String(body.mahasiswaId).trim() === '') {
      return NextResponse.json({ error: 'Mahasiswa wajib login terlebih dahulu' }, { status: 400 })
    }

    const token = String(body.token).trim()

    // Normalize tipe — default to MASUK
    const tipe: 'MASUK' | 'PULANG' =
      body.tipe === 'PULANG' ? 'PULANG' : 'MASUK'

    // Find the session (uppercase token — both HARIAN and PERIODE tokens are
    // stored uppercase in the DB).
    const session = await db.qrSession.findUnique({
      where: { token: token.toUpperCase() },
      include: { kelompok: true },
    })

    if (!session) {
      return NextResponse.json({
        error: 'Token tidak ditemukan. Pastikan kode QR yang Anda scan benar.',
      }, { status: 404 })
    }

    if (!session.isActive) {
      return NextResponse.json({
        error: 'Sesi absensi ini sudah dinonaktifkan.',
      }, { status: 410 })
    }

    const now = new Date()
    // For PERIODE sessions with a startsAt, session must have started
    if (session.startsAt && now < session.startsAt) {
      return NextResponse.json({
        error: `Sesi belum dimulai. Berlaku mulai ${new Date(session.startsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      }, { status: 410 })
    }

    if (now > session.expiresAt) {
      return NextResponse.json({
        error: 'QR Code sudah kedaluwarsa. Minta admin/dosen membuat QR baru.',
      }, { status: 410 })
    }

    // Verify mahasiswa exists
    const mhs = await db.mahasiswa.findUnique({
      where: { id: body.mahasiswaId },
      include: { prodi: true },
    })
    if (!mhs) {
      return NextResponse.json({
        error: 'Data mahasiswa tidak ditemukan.',
      }, { status: 404 })
    }

    // Check if mahasiswa is a member of the kelompok
    const membership = await db.kelompokMember.findUnique({
      where: { kelompokId_mahasiswaId: { kelompokId: session.kelompokId, mahasiswaId: mhs.id } },
    })
    if (!membership) {
      return NextResponse.json({
        error: `Anda bukan anggota kelompok "${session.kelompok.nama}". Tidak dapat melakukan absensi.`,
      }, { status: 403 })
    }

    // Compute "today" range in WIB (Asia/Jakarta) to be consistent with face-checkin
    // and the /api/absensi GET date filter (gte: YYYY-MM-DDT00:00:00Z, lt: next day).
    const WIB_TZ = 'Asia/Jakarta'
    const wibDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: WIB_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const dayStart = new Date(`${wibDateStr}T00:00:00.000Z`)
    const dayEnd = new Date(`${wibDateStr}T23:59:59.999Z`)

    const isPeriode = session.tipeSesi === 'PERIODE'

    // Find today's existing record for this session (PERIODE → by date; HARIAN → by session id)
    // NOTE: do NOT filter by qrSessionId for PERIODE — admin-created manual records
    // (qrSessionId=null) should also block duplicate check-in.
    const todayExistingWhere = isPeriode
      ? { mahasiswaId: mhs.id, tanggal: { gte: dayStart, lte: dayEnd } }
      : { mahasiswaId: mhs.id, qrSessionId: session.id }
    const existing = await db.absensi.findFirst({
      where: todayExistingWhere,
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
      },
    })

    // ============ PULANG flow ============
    if (tipe === 'PULANG') {
      if (!existing || !existing.jamMasuk) {
        return NextResponse.json({
          error: 'Anda belum melakukan check-in Masuk. Silakan check-in Masuk terlebih dahulu sebelum check-out Pulang.',
        }, { status: 404 })
      }
      if (existing.jamPulang) {
        return NextResponse.json({
          error: `Anda sudah melakukan check-out Pulang pada pukul ${new Date(existing.jamPulang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.`,
          message: 'Sudah check-out Pulang untuk sesi ini.',
          absensi: existing,
        }, { status: 409 })
      }
      // Update jamPulang
      const updated = await db.absensi.update({
        where: { id: existing.id },
        data: {
          jamPulang: now,
          keterangan: `${existing.keterangan ?? ''} | Check-out via QR (token: ${session.token})`.trim(),
        },
        include: {
          mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
          kelompok: true,
        },
      })
      return NextResponse.json({
        success: true,
        message: `Check-out Pulang berhasil! Selamat istirahat, ${mhs.nama}.`,
        tipe: 'PULANG',
        absensi: updated,
      }, { status: 200 })
    }

    // ============ MASUK flow (default) ============
    if (existing) {
      return NextResponse.json({
        error: isPeriode
          ? 'Anda sudah melakukan check-in Masuk hari ini untuk sesi ini. Silakan lakukan check-out Pulang saat mau pulang.'
          : 'Anda sudah melakukan check-in Masuk untuk sesi ini.',
        message: `Anda sudah tercatat hadir pada sesi ini.`,
        absensi: existing,
      }, { status: 409 })
    }

    // Optional GPS coordinates
    const lat = body.latitude !== undefined && body.latitude !== null && body.latitude !== ''
      ? Number(body.latitude) : null
    const lng = body.longitude !== undefined && body.longitude !== null && body.longitude !== ''
      ? Number(body.longitude) : null

    // Create the Absensi record — status HADIR, jamMasuk = now
    // For PERIODE sessions, use TODAY's date in WIB normalized to noon UTC so it
    // matches the daily recap filter (gte: YYYY-MM-DDT00:00:00Z).
    const absensiTanggal = isPeriode
      ? new Date(`${wibDateStr}T12:00:00.000Z`)
      : new Date(session.tanggal.getTime())
    const absensi = await db.absensi.create({
      data: {
        mahasiswaId: mhs.id,
        kelompokId: session.kelompokId,
        tanggal: absensiTanggal,
        status: 'HADIR',
        jamMasuk: now,
        jamPulang: null,
        latitude: lat !== null && !Number.isNaN(lat) ? lat : null,
        longitude: lng !== null && !Number.isNaN(lng) ? lng : null,
        fotoSelfie: null,
        keterangan: `Check-in Masuk via QR (token: ${session.token})`,
        qrSessionId: session.id,
      },
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Check-in Masuk berhasil! Selamat datang, ${mhs.nama}.`,
      tipe: 'MASUK',
      absensi,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/absensi/qr-checkin]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({
        error: 'Anda sudah melakukan absensi untuk sesi ini.',
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Gagal melakukan check-in absensi' }, { status: 500 })
  }
}
