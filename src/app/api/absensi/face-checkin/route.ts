import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ POST /api/absensi/face-checkin ============
// Body: {
//   mahasiswaId: string,
//   sessionId: string,           // QrSession id (the open attendance session)
//   descriptor: number[],        // 128-d face descriptor from client
//   fotoSelfie?: string,         // optional base64 capture for audit
//   tipe?: 'MASUK' | 'PULANG',   // default 'MASUK'
//   latitude?, longitude?
// }
//
// Server validates:
//  1. Mahasiswa exists & has faceDescriptor registered
//  2. Session exists, active, not expired
//  3. Mahasiswa is a member of session.kelompok
//  4. Descriptor matches stored descriptor (Euclidean distance < 0.55)
//
// tipe='MASUK': creates Absensi record with jamMasuk = now (blocks if already exists today)
// tipe='PULANG': updates today's Absensi record's jamPulang = now (blocks if no MASUK or already has jamPulang)
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.mahasiswaId || typeof body.mahasiswaId !== 'string') {
      return NextResponse.json({ error: 'Mahasiswa wajib login terlebih dahulu' }, { status: 400 })
    }
    if (!body.sessionId || typeof body.sessionId !== 'string') {
      return NextResponse.json({ error: 'Sesi absensi wajib dipilih' }, { status: 400 })
    }
    if (!body.descriptor || !Array.isArray(body.descriptor) || body.descriptor.length !== 128) {
      return NextResponse.json({ error: 'Data wajah tidak valid' }, { status: 400 })
    }

    // Normalize tipe — default MASUK
    const tipe: 'MASUK' | 'PULANG' =
      body.tipe === 'PULANG' ? 'PULANG' : 'MASUK'

    // 1. Find mahasiswa with their stored descriptor
    const mhs = await db.mahasiswa.findUnique({
      where: { id: body.mahasiswaId },
      include: { prodi: true },
    })
    if (!mhs) {
      return NextResponse.json({ error: 'Data mahasiswa tidak ditemukan' }, { status: 404 })
    }
    if (!mhs.faceDescriptor) {
      return NextResponse.json({
        error: 'Wajah Anda belum terdaftar. Silakan lakukan registrasi wajah terlebih dahulu di menu Absensi → Registrasi Wajah.',
      }, { status: 403 })
    }

    // 2. Find the session
    const session = await db.qrSession.findUnique({
      where: { id: body.sessionId },
      include: {
        kelompok: {
          include: {
            dosen: { include: { user: true } },
          },
        },
      },
    })
    if (!session) {
      return NextResponse.json({ error: 'Sesi absensi tidak ditemukan' }, { status: 404 })
    }
    if (!session.isActive) {
      return NextResponse.json({ error: 'Sesi absensi sudah dinonaktifkan' }, { status: 410 })
    }
    const now = new Date()
    // For PERIODE sessions with a startsAt, session must have started
    if (session.startsAt && now < session.startsAt) {
      return NextResponse.json({
        error: `Sesi belum dimulai. Berlaku mulai ${new Date(session.startsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      }, { status: 410 })
    }
    if (now > session.expiresAt) {
      return NextResponse.json({ error: 'Sesi absensi sudah kedaluwarsa' }, { status: 410 })
    }

    // 3. Check membership
    const membership = await db.kelompokMember.findUnique({
      where: {
        kelompokId_mahasiswaId: {
          kelompokId: session.kelompokId,
          mahasiswaId: mhs.id,
        },
      },
    })
    if (!membership) {
      return NextResponse.json({
        error: `Anda bukan anggota kelompok "${session.kelompok.nama}". Tidak dapat absensi.`,
      }, { status: 403 })
    }

    // 4. Find today's existing record
    //    - PERIODE session → find by mahasiswaId + today's WIB date (NOT filtered by qrSessionId
    //      so admin manual records also block duplicate check-in)
    //    - HARIAN session  → find by mahasiswaId + qrSessionId
    //
    // IMPORTANT (timezone fix): "TODAY" must be computed in WIB (Asia/Jakarta).
    const isPeriode = session.tipeSesi === 'PERIODE'
    const WIB_TZ = 'Asia/Jakarta'
    const wibDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: WIB_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const dayStart = new Date(`${wibDateStr}T00:00:00.000Z`)
    const dayEnd = new Date(`${wibDateStr}T23:59:59.999Z`)
    const existingWhere = isPeriode
      ? { mahasiswaId: mhs.id, tanggal: { gte: dayStart, lte: dayEnd } }
      : { mahasiswaId: mhs.id, qrSessionId: session.id }
    const existing = await db.absensi.findFirst({ where: existingWhere })

    // 5. Compare descriptors (Euclidean distance) — done BEFORE writing so we
    //    reject spoofed PULANG attempts by unverified faces.
    const storedDescriptor: number[] = JSON.parse(mhs.faceDescriptor)
    const incomingDescriptor: number[] = body.descriptor.map((n: unknown) => Number(n))

    if (storedDescriptor.length !== 128 || incomingDescriptor.length !== 128) {
      return NextResponse.json({ error: 'Data descriptor tidak valid' }, { status: 400 })
    }

    let sumSquares = 0
    for (let i = 0; i < 128; i++) {
      const diff = storedDescriptor[i] - incomingDescriptor[i]
      sumSquares += diff * diff
    }
    const distance = Math.sqrt(sumSquares)

    // Threshold: 0.55 — stricter than default 0.5 to allow some lighting variance
    const THRESHOLD = 0.55
    if (distance >= THRESHOLD) {
      return NextResponse.json({
        error: `Verifikasi wajah GAGAL. Wajah tidak cocok dengan data terdaftar (jarak: ${distance.toFixed(3)}, ambang: ${THRESHOLD}). Silakan coba lagi dalam kondisi pencahayaan yang lebih baik.`,
        distance: Number(distance.toFixed(4)),
        threshold: THRESHOLD,
      }, { status: 403 })
    }

    // 6a. PULANG flow — update jamPulang on existing MASUK record
    if (tipe === 'PULANG') {
      if (!existing || !existing.jamMasuk) {
        return NextResponse.json({
          error: 'Anda belum melakukan check-in Masuk. Silakan check-in Masuk terlebih dahulu sebelum check-out Pulang.',
        }, { status: 404 })
      }
      if (existing.jamPulang) {
        return NextResponse.json({
          error: `Anda sudah melakukan check-out Pulang pada pukul ${new Date(existing.jamPulang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.`,
          absensi: existing,
        }, { status: 409 })
      }
      const updated = await db.absensi.update({
        where: { id: existing.id },
        data: {
          jamPulang: now,
          keterangan: `${existing.keterangan ?? ''} | Check-out via Face Recognition (jarak: ${distance.toFixed(3)})`.trim(),
        },
        include: {
          mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
          kelompok: true,
        },
      })

      // Notify dosen pendamping about the check-out
      const dosen = session.kelompok.dosen
      if (dosen?.userId) {
        try {
          await db.notifikasi.create({
            data: {
              userId: dosen.userId,
              judul: `Check-out ${mhs.nama}`,
              konten: `${mhs.nama} (${mhs.nim}) telah melakukan check-out via Face Recognition pada kelompok "${session.kelompok.nama}" pukul ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.`,
              tipe: 'CHECKIN',
              data: JSON.stringify({
                absensiId: updated.id,
                mahasiswaId: mhs.id,
                mahasiswaNama: mhs.nama,
                mahasiswaNim: mhs.nim,
                kelompokId: session.kelompokId,
                kelompokNama: session.kelompok.nama,
                tipeKelompok: session.kelompok.tipe,
                tanggal: session.tanggal,
                jamPulang: updated.jamPulang,
                tipeAbsen: 'PULANG',
                jarakWajah: Number(distance.toFixed(4)),
              }),
            },
          })
        } catch (notifErr) {
          console.error('[face-checkin] Gagal membuat notifikasi dosen (PULANG):', notifErr)
        }
      }

      return NextResponse.json({
        success: true,
        message: `Check-out Pulang berhasil! Selamat istirahat, ${mhs.nama}.`,
        tipe: 'PULANG',
        distance: Number(distance.toFixed(4)),
        absensi: updated,
        notifiedDosen: Boolean(dosen?.userId),
        dosenNama: dosen?.nama ?? null,
      }, { status: 200 })
    }

    // 6b. MASUK flow — create new Absensi record
    if (existing) {
      return NextResponse.json({
        error: isPeriode
          ? 'Anda sudah melakukan check-in Masuk hari ini untuk sesi ini. Silakan lakukan check-out Pulang saat mau pulang.'
          : 'Anda sudah melakukan check-in Masuk untuk sesi ini.',
        absensi: existing,
      }, { status: 409 })
    }

    // Optional GPS coordinates
    const lat = body.latitude !== undefined && body.latitude !== null && body.latitude !== ''
      ? Number(body.latitude) : null
    const lng = body.longitude !== undefined && body.longitude !== null && body.longitude !== ''
      ? Number(body.longitude) : null

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
        fotoSelfie: typeof body.fotoSelfie === 'string' ? body.fotoSelfie : null,
        keterangan: `Check-in Masuk via Face Recognition (jarak: ${distance.toFixed(3)})`,
        qrSessionId: session.id,
      },
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
      },
    })

    // 7. Notify the supervising lecturer (dosen pendamping) about the check-in
    const dosen = session.kelompok.dosen
    if (dosen?.userId) {
      try {
        await db.notifikasi.create({
          data: {
            userId: dosen.userId,
            judul: `Absensi ${mhs.nama}`,
            konten: `${mhs.nama} (${mhs.nim}) telah melakukan check-in via Face Recognition pada kelompok "${session.kelompok.nama}" pukul ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.`,
            tipe: 'CHECKIN',
            data: JSON.stringify({
              absensiId: absensi.id,
              mahasiswaId: mhs.id,
              mahasiswaNama: mhs.nama,
              mahasiswaNim: mhs.nim,
              kelompokId: session.kelompokId,
              kelompokNama: session.kelompok.nama,
              tipeKelompok: session.kelompok.tipe,
              tanggal: session.tanggal,
              jamMasuk: absensi.jamMasuk,
              tipeAbsen: 'MASUK',
              jarakWajah: Number(distance.toFixed(4)),
            }),
          },
        })
      } catch (notifErr) {
        // Non-fatal: don't fail the check-in if notification creation fails
        console.error('[face-checkin] Gagal membuat notifikasi dosen:', notifErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Verifikasi wajah berhasil! Selamat datang, ${mhs.nama}.`,
      tipe: 'MASUK',
      distance: Number(distance.toFixed(4)),
      absensi,
      notifiedDosen: Boolean(dosen?.userId),
      dosenNama: dosen?.nama ?? null,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/absensi/face-checkin]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({
        error: 'Anda sudah melakukan absensi untuk sesi ini.',
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Gagal melakukan verifikasi wajah' }, { status: 500 })
  }
}
