import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyFace } from '@/lib/face-verify'
import { notifyDosenAbsensi } from '@/lib/whatsapp'

type Params = { params: Promise<{ token: string }> }

// Format tanggal untuk label pesan & UI
function todayStr(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * GET - public endpoint untuk ambil info mahasiswa berdasarkan token.
 * Tidak perlu auth. Dipakai oleh halaman absensi wajah publik.
 *
 * Response (data minimal untuk absensi — TIDAK mengembalikan foto wajah terdaftar):
 *   { nama, nim, prodiNama, jenjang, kelompokNama, tipe, lokasi, dosenNama }
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params
    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 })
    }

    const mhs = await db.mahasiswa.findUnique({
      where: { absensiToken: token },
      include: {
        prodi: { include: { fakultas: true } },
        kelompokMember: {
          include: {
            kelompok: {
              include: {
                dosen: true,
                desa: true,
                sekolah: true,
              },
            },
          },
        },
      },
    })

    if (!mhs) {
      return NextResponse.json({ error: 'Link absensi tidak ditemukan atau sudah dicabut' }, { status: 404 })
    }
    if (!mhs.fotoWajah) {
      return NextResponse.json({ error: 'Mahasiswa belum mendaftarkan wajah. Hubungi admin.' }, { status: 400 })
    }

    const member = mhs.kelompokMember[0]
    const kel = member?.kelompok ?? null
    const lokasi = kel?.desa?.nama || kel?.sekolah?.nama || '-'

    // Cek apakah mahasiswa sudah absen HADIR hari ini (anti dobel absen)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const existing = await db.absensi.findFirst({
      where: {
        mahasiswaId: mhs.id,
        tanggal: { gte: start, lt: end },
        status: 'HADIR',
      },
      select: { id: true, jamMasuk: true },
    })

    return NextResponse.json({
      nama: mhs.nama,
      nim: mhs.nim,
      prodiNama: mhs.prodi?.nama ?? '-',
      jenjang: mhs.prodi?.jenjang ?? '-',
      kelompokNama: kel?.nama ?? '-',
      tipe: kel?.tipe ?? '-',
      lokasi,
      dosenNama: kel?.dosen?.nama ?? '-',
      sudahAbsenHariIni: !!existing,
      jamAbsen: existing?.jamMasuk
        ? new Date(existing.jamMasuk).toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
    })
  } catch (e: any) {
    console.error('[GET /api/absensi-wajah/:token]', e)
    return NextResponse.json({ error: 'Gagal memuat info absensi' }, { status: 500 })
  }
}

/**
 * POST - public endpoint untuk submit absensi wajah.
 * Body: { fotoCapture: "<base64 data URL>" }
 *
 * Alur:
 *   1. Validasi token & mahasiswa
 *   2. Cek apakah sudah absen hari ini (tolak jika sudah)
 *   3. Verifikasi wajah via VLM (fotoTerdaftar vs fotoCapture)
 *   4. Jika match → simpan Absensi (status HADIR) + kirim WA ke DPL
 *   5. Return hasil verifikasi + status WA
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params
    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 })
    }

    const body = await req.json()
    const fotoCapture = String(body?.fotoCapture ?? '').trim()
    if (!fotoCapture) {
      return NextResponse.json({ error: 'Foto wajah wajib diisi' }, { status: 400 })
    }
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(fotoCapture)) {
      return NextResponse.json({ error: 'Format foto tidak valid' }, { status: 400 })
    }
    if (fotoCapture.length > 3_500_000) {
      return NextResponse.json({ error: 'Ukuran foto terlalu besar (maks ~2.5MB)' }, { status: 400 })
    }

    const mhs = await db.mahasiswa.findUnique({
      where: { absensiToken: token },
      include: {
        prodi: true,
        kelompokMember: {
          include: {
            kelompok: {
              include: {
                dosen: true,
                desa: true,
                sekolah: true,
              },
            },
          },
        },
      },
    })

    if (!mhs) {
      return NextResponse.json({ error: 'Link absensi tidak ditemukan atau sudah dicabut' }, { status: 404 })
    }
    if (!mhs.fotoWajah) {
      return NextResponse.json({ error: 'Mahasiswa belum mendaftarkan wajah. Hubungi admin.' }, { status: 400 })
    }

    // 1) Cek kelompok
    const member = mhs.kelompokMember[0]
    const kel = member?.kelompok ?? null
    if (!kel) {
      return NextResponse.json({
        error: 'Mahasiswa belum ditempatkan di kelompok KKN/PLP. Hubungi admin.',
      }, { status: 400 })
    }

    // 2) Cek apakah sudah absen hari ini
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const existing = await db.absensi.findFirst({
      where: {
        mahasiswaId: mhs.id,
        tanggal: { gte: start, lt: end },
        status: 'HADIR',
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({
        error: 'Anda sudah melakukan absensi HADIR hari ini. Tidak dapat absen lagi.',
      }, { status: 400 })
    }

    // 3) Verifikasi wajah via VLM
    const verify = await verifyFace(mhs.fotoWajah, fotoCapture)
    if (!verify.match) {
      console.warn(`[absensi-wajah] VERIFIKASI GAGAL | Mhs: ${mhs.nama} (${mhs.nim}) | Reason: ${verify.reason}`)
      return NextResponse.json({
        success: false,
        match: false,
        confidence: verify.confidence,
        reason: verify.reason,
        error: 'Verifikasi wajah GAGAL. Pastikan wajah Anda terlihat jelas dan sesuai foto terdaftar.',
      }, { status: 400 })
    }

    // 4) Simpan absensi (HADIR)
    const tanggal = new Date(todayStr() + 'T12:00:00')
    const created = await db.absensi.create({
      data: {
        mahasiswaId: mhs.id,
        kelompokId: kel.id,
        tanggal,
        status: 'HADIR',
        jamMasuk: new Date(),
        jamPulang: null,
        // Simpan foto capture sebagai fotoSelfie (audit trail)
        fotoSelfie: fotoCapture,
        keterangan: `Absensi wajah (confidence: ${verify.confidence})`,
      },
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
        kelompok: true,
      },
    })

    // 5) Kirim WA ke DPL (fire-and-forget, jangan block response)
    notifyDosenAbsensi({ absensiId: created.id, tipe: 'MASUK' }).catch((e) => {
      console.error('[absensi-wajah POST] WA notify error:', e)
    })

    console.log(
      `[absensi-wajah] BERHASIL | Mhs: ${mhs.nama} (${mhs.nim}) | Kel: ${kel.nama} | ` +
        `Confidence: ${verify.confidence} | Jam: ${new Date().toLocaleTimeString('id-ID')}`,
    )

    return NextResponse.json({
      success: true,
      match: true,
      confidence: verify.confidence,
      reason: verify.reason,
      data: {
        nama: mhs.nama,
        nim: mhs.nim,
        kelompok: kel.nama,
        jamMasuk: created.jamMasuk
          ? new Date(created.jamMasuk).toLocaleTimeString('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
            })
          : null,
      },
    })
  } catch (e: any) {
    console.error('[POST /api/absensi-wajah/:token]', e)
    return NextResponse.json({ error: 'Gagal memproses absensi wajah' }, { status: 500 })
  }
}
