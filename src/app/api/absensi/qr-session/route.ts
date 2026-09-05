import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

// POST - Generate a new QR session for attendance
// Body: {
//   kelompokId: string (required),
//   createdBy: string (required),
//   tipeSesi?: "HARIAN" | "PERIODE" (default "HARIAN"),
//   durationMinutes?: number (for HARIAN, default 5, max 60),
//   startsAt?: string|Date (for PERIODE — default: kelompok.tanggalMulai or now),
//   endsAt?: string|Date (for PERIODE — default: kelompok.tanggalSelesai end-of-day),
//   tanggal?: string|Date (default today)
// }
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.kelompokId || String(body.kelompokId).trim() === '') {
      return NextResponse.json({ error: 'Kelompok wajib dipilih' }, { status: 400 })
    }
    if (!body.createdBy || String(body.createdBy).trim() === '') {
      return NextResponse.json({ error: 'createdBy wajib diisi' }, { status: 400 })
    }

    // Verify kelompok exists (with periode dates for PERIODE sessions)
    const kel = await db.kelompok.findUnique({ where: { id: body.kelompokId } })
    if (!kel) {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 400 })
    }

    const tipeSesi = String(body.tipeSesi || 'HARIAN').toUpperCase() === 'PERIODE' ? 'PERIODE' : 'HARIAN'

    // Generate unique token (8 char hex for easy manual entry)
    const token = randomBytes(4).toString('hex').toUpperCase()

    // Helper: parse a date input (string|Date) → Date or null
    const parseDate = (v: unknown): Date | null => {
      if (!v) return null
      const d = v instanceof Date ? v : new Date(String(v))
      return isNaN(d.getTime()) ? null : d
    }

    // Tanggal: default today at noon (to avoid TZ issues), else parse provided date
    let tanggal = new Date()
    const parsedTanggal = parseDate(body.tanggal)
    if (parsedTanggal) tanggal = parsedTanggal
    tanggal.setHours(12, 0, 0, 0)

    let startsAt: Date | null = null
    let expiresAt: Date

    if (tipeSesi === 'PERIODE') {
      // PERIODE session — active throughout the KKN/PLP program duration.
      // startsAt: body.startsAt → kelompok.tanggalMulai → now
      // expiresAt: body.endsAt → kelompok.tanggalSelesai (end of day) → now+30days fallback
      const s = parseDate(body.startsAt) ?? kel.tanggalMulai
      const e = parseDate(body.endsAt) ?? kel.tanggalSelesai

      if (!s && !kel.tanggalMulai) {
        return NextResponse.json({
          error: 'Periode KKN/PLP belum diatur untuk kelompok ini. Atur tanggal mulai & selesai di menu Pembagian KKN & PLP, atau sertakan startsAt/endsAt pada permintaan.',
        }, { status: 400 })
      }

      startsAt = s ? new Date(s) : new Date()
      startsAt.setHours(0, 0, 0, 0)

      if (e) {
        expiresAt = new Date(e)
        expiresAt.setHours(23, 59, 59, 999)
      } else {
        // Fallback: 30 days from now if no end date available
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        expiresAt.setHours(23, 59, 59, 999)
      }

      if (expiresAt.getTime() <= startsAt.getTime()) {
        return NextResponse.json({
          error: 'Tanggal selesai periode harus setelah tanggal mulai.',
        }, { status: 400 })
      }
    } else {
      // HARIAN session — short-lived (minutes)
      const durationMinutes = Math.min(Math.max(Number(body.durationMinutes) || 5, 1), 60)
      expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
    }

    // Deactivate any previous active sessions for this kelompok (only 1 active at a time)
    await db.qrSession.updateMany({
      where: { kelompokId: body.kelompokId, isActive: true },
      data: { isActive: false },
    })

    const session = await db.qrSession.create({
      data: {
        token,
        kelompokId: body.kelompokId,
        tanggal,
        createdBy: String(body.createdBy).trim(),
        tipeSesi,
        startsAt: tipeSesi === 'PERIODE' ? startsAt : null,
        expiresAt,
        isActive: true,
      },
      include: {
        kelompok: true,
      },
    })

    return NextResponse.json(session, { status: 201 })
  } catch (e) {
    console.error('[POST /api/absensi/qr-session]', e)
    return NextResponse.json({ error: 'Gagal membuat QR session' }, { status: 500 })
  }
}

// GET - List active QR sessions (optionally filter by kelompokId)
// ?kelompokId=xxx  →  filter by kelompok
// ?active=true      →  only active, not-yet-started-but-active, and not expired
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const kelompokId = searchParams.get('kelompokId')?.trim() ?? ''
    const activeOnly = searchParams.get('active') === 'true'

    const where: Record<string, unknown> = {}
    if (kelompokId) where.kelompokId = kelompokId
    if (activeOnly) {
      const now = new Date()
      where.isActive = true
      where.expiresAt = { gt: now }
      // Active = (startsAt IS NULL OR startsAt <= now)
      where.OR = [{ startsAt: null }, { startsAt: { lte: now } }]
    }

    const sessions = await db.qrSession.findMany({
      where,
      include: { kelompok: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json(sessions)
  } catch (e) {
    console.error('[GET /api/absensi/qr-session]', e)
    return NextResponse.json({ error: 'Gagal memuat QR sessions' }, { status: 500 })
  }
}
