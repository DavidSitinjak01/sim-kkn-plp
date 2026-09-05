import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

// ============ GET /api/absensi/active-sessions ============
// Returns active (not expired, already-started) QR sessions for the mahasiswa's kelompok(s).
// Query params: ?mahasiswaId=xxx
//
// Used by the Face Check-in screen so the mahasiswa can pick which session
// to check-in to without needing to scan a QR code.
//
// AUTO-PERIODE FEATURE:
// Jika kelompok mahasiswa memiliki tanggalMulai & tanggalSelesai (periode KKN/PLP)
// dan hari ini berada di dalam periode tersebut, sistem akan otomatis membuat
// (lazy-create) satu QrSession PERIODE untuk kelompok itu bila belum ada.
// Tujuannya: dosen tidak perlu manual membuka sesi absensi setiap hari —
// sesi aktif sepanjang KKN/PLP.
//
// "Active" = isActive === true AND expiresAt > now AND (startsAt IS NULL OR startsAt <= now)
// "alreadyCheckedIn":
//   - HARIAN session → checked in at all for this session
//   - PERIODE session → checked in TODAY for this session (can check in again tomorrow)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const mahasiswaId = searchParams.get('mahasiswaId')?.trim()

    if (!mahasiswaId) {
      return NextResponse.json({ error: 'mahasiswaId wajib diisi' }, { status: 400 })
    }

    // Verify mahasiswa exists
    const mhs = await db.mahasiswa.findUnique({
      where: { id: mahasiswaId },
      select: { id: true, nim: true, nama: true },
    })
    if (!mhs) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }

    // Find all kelompok the mahasiswa is a member of — include periode dates & status
    const memberships = await db.kelompokMember.findMany({
      where: { mahasiswaId },
      select: {
        kelompokId: true,
        kelompok: {
          select: {
            id: true,
            nama: true,
            tipe: true,
            tahunAkademik: true,
            semester: true,
            status: true,
            tanggalMulai: true,
            tanggalSelesai: true,
          },
        },
      },
    })
    if (memberships.length === 0) {
      return NextResponse.json({
        sessions: [],
        message: 'Anda belum tergabung dalam kelompok manapun',
      })
    }

    const kelompokIds = memberships.map((m) => m.kelompokId)
    const now = new Date()

    // === AUTO-CREATE PERIODE SESSIONS ===
    // Untuk setiap kelompok yang:
    //  - status = AKTIF
    //  - memiliki tanggalMulai & tanggalSelesai
    //  - hari ini berada dalam periode (tanggalMulai <= now <= tanggalSelesai)
    //  - belum memiliki QrSession PERIODE yang masih aktif (isActive=true, belum expired)
    // → buat satu QrSession PERIODE baru (lazy creation)
    for (const m of memberships) {
      const k = m.kelompok
      if (k.status !== 'AKTIF') continue
      if (!k.tanggalMulai || !k.tanggalSelesai) continue
      const mulai = new Date(k.tanggalMulai)
      const selesai = new Date(k.tanggalSelesai)
      // Normalize: selesai set ke akhir hari agar inklusif
      selesai.setHours(23, 59, 59, 999)
      if (now < mulai || now > selesai) continue

      // Cek apakah sudah ada PERIODE session aktif untuk kelompok ini
      const existingPeriode = await db.qrSession.findFirst({
        where: {
          kelompokId: k.id,
          tipeSesi: 'PERIODE',
          isActive: true,
          expiresAt: { gt: now },
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        select: { id: true },
      })
      if (existingPeriode) continue // sudah ada, skip

      // Buat PERIODE session baru. Token di-generate uppercase agar konsisten
      // dengan HARIAN tokens dan kompatibel dengan lookup di route lain yang
      // men-normalisasi token ke uppercase.
      try {
        await db.qrSession.create({
          data: {
            token: `PERIODE-${k.id}-${randomUUID().slice(0, 8)}`.toUpperCase(),
            kelompokId: k.id,
            tanggal: mulai,
            createdBy: 'SISTEM (auto-periode)',
            tipeSesi: 'PERIODE',
            startsAt: mulai,
            expiresAt: selesai,
            isActive: true,
          },
        })
      } catch (err) {
        // Non-fatal: jika gagal membuat (race condition dgn request lain), lanjutkan
        console.error('[active-sessions] Gagal auto-create PERIODE session for', k.id, err)
      }
    }

    // Find active, not-expired, already-started sessions for these kelompok
    const sessions = await db.qrSession.findMany({
      where: {
        kelompokId: { in: kelompokIds },
        isActive: true,
        expiresAt: { gt: now },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      include: {
        kelompok: {
          select: {
            id: true,
            nama: true,
            tipe: true,
            tahunAkademik: true,
            semester: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Build "today" range in WIB (Asia/Jakarta) for PERIODE daily check-in.
    // Using WIB ensures records stamped with a WIB date match "today" regardless
    // of the server's local timezone (UTC).
    const WIB_TZ = 'Asia/Jakarta'
    const wibDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: WIB_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const dayStart = new Date(`${wibDateStr}T00:00:00.000Z`)
    const dayEnd = new Date(`${wibDateStr}T23:59:59.999Z`)

    // For each session, also report whether this mahasiswa has checked-in MASUK
    // and/or PULANG today (PERIODE) or for the session (HARIAN).
    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const isPeriode = s.tipeSesi === 'PERIODE'
        // PERIODE → match by mahasiswaId + today's WIB date (do NOT filter by
        // qrSessionId so admin manual records also count as "already checked in")
        // HARIAN  → match by mahasiswaId + qrSessionId
        const existingWhere = isPeriode
          ? { mahasiswaId, tanggal: { gte: dayStart, lte: dayEnd } }
          : { mahasiswaId, qrSessionId: s.id }
        const existing = await db.absensi.findFirst({
          where: existingWhere,
          select: {
            id: true,
            status: true,
            jamMasuk: true,
            jamPulang: true,
          },
        })
        return {
          id: s.id,
          token: s.token,
          kelompok: s.kelompok,
          tanggal: s.tanggal,
          tipeSesi: s.tipeSesi,
          startsAt: s.startsAt,
          expiresAt: s.expiresAt,
          remainingSeconds: Math.max(0, Math.floor((s.expiresAt.getTime() - now.getTime()) / 1000)),
          // Back-compat: alreadyCheckedIn means MASUK has been recorded.
          alreadyCheckedIn: !!existing,
          masukDone: !!existing?.jamMasuk,
          pulangDone: !!existing?.jamPulang,
          jamMasuk: existing?.jamMasuk ?? null,
          jamPulang: existing?.jamPulang ?? null,
          absensi: existing,
        }
      })
    )

    return NextResponse.json({
      sessions: enriched,
      mahasiswa: mhs,
    })
  } catch (e) {
    console.error('[GET /api/absensi/active-sessions]', e)
    return NextResponse.json({ error: 'Gagal memuat sesi aktif' }, { status: 500 })
  }
}
