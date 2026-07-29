import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyDosenRekap, type WaMode } from '@/lib/whatsapp'

// POST - kirim rekap absensi (harian atau bulanan) ke dosen pembimbing kelompok
//
// Body:
//   {
//     "kelompokId": "<id>",
//     "tipe": "HARIAN" | "BULANAN",
//     "tanggal": "YYYY-MM-DD",   // wajib jika tipe=HARIAN
//     "bulan": "YYYY-MM"          // wajib jika tipe=BULANAN
//   }
//
// Response:
//   {
//     "ok": true,
//     "mode": "live" | "simulasi" | "disabled",
//     "detail": "...",
//     "recipient": "62xxx",
//     "kelompok": "Kelompok 1 (KKN)",
//     "dosen": "Dr. Yulius"
//   }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { kelompokId, tipe } = body as { kelompokId?: string; tipe?: string }

    if (!kelompokId) {
      return NextResponse.json({ error: 'kelompokId wajib diisi' }, { status: 400 })
    }
    if (tipe !== 'HARIAN' && tipe !== 'BULANAN') {
      return NextResponse.json({ error: 'tipe harus HARIAN atau BULANAN' }, { status: 400 })
    }

    // ===== Validasi kelompok & dosen SEBELUM query berat =====
    const kel = await db.kelompok.findUnique({
      where: { id: kelompokId },
      include: { dosen: true, desa: true, sekolah: true },
    })
    if (!kel) {
      return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    }
    if (!kel.dosen) {
      return NextResponse.json({
        ok: false,
        mode: 'disabled' as WaMode,
        error: `Kelompok "${kel.nama}" tidak memiliki Dosen Pembimbing (DPL). Silakan tentukan DPL pada menu Pembagian KKN & PLP.`,
      }, { status: 400 })
    }
    if (!kel.dosen.noHp) {
      return NextResponse.json({
        ok: false,
        mode: 'disabled' as WaMode,
        error: `Dosen ${kel.dosen.nama} tidak memiliki nomor WhatsApp. Lengkapi data dosen pada menu Data Dosen.`,
      }, { status: 400 })
    }

    // ===== Tentukan filter tanggal berdasarkan tipe =====
    let where: { kelompokId: string; tanggal?: { gte: Date; lt: Date } } = { kelompokId }
    let periodeLabel = ''

    if (tipe === 'HARIAN') {
      const tanggalStr = String(body.tanggal ?? '').trim()
      if (!tanggalStr) {
        return NextResponse.json({ error: 'tanggal wajib diisi untuk tipe HARIAN (format YYYY-MM-DD)' }, { status: 400 })
      }
      const start = new Date(tanggalStr)
      if (isNaN(start.getTime())) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
      }
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      where = { kelompokId, tanggal: { gte: start, lt: end } }
      periodeLabel = start.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } else {
      // BULANAN
      const bulanStr = String(body.bulan ?? '').trim()
      if (!/^\d{4}-\d{2}$/.test(bulanStr)) {
        return NextResponse.json({ error: 'bulan wajib diisi untuk tipe BULANAN (format YYYY-MM)' }, { status: 400 })
      }
      const [yearStr, monthStr] = bulanStr.split('-')
      const year = Number(yearStr)
      const month = Number(monthStr)
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json({ error: 'Format bulan tidak valid' }, { status: 400 })
      }
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
      const end = new Date(year, month, 1, 0, 0, 0, 0)
      where = { kelompokId, tanggal: { gte: start, lt: end } }
      periodeLabel = start.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        month: 'long',
        year: 'numeric',
      })
    }

    // ===== Ambil semua absensi kelompok untuk periode tsb =====
    const records = await db.absensi.findMany({
      where,
      include: { mahasiswa: true },
      orderBy: [{ tanggal: 'asc' }, { jamMasuk: 'asc' }],
    })

    // Format records untuk notifyDosenRekap
    const formattedRecords = records.map((r) => ({
      nim: r.mahasiswa.nim,
      nama: r.mahasiswa.nama,
      status: r.status,
      jamMasuk: r.jamMasuk,
      jamPulang: r.jamPulang,
      keterangan: r.keterangan,
    }))

    // ===== Kirim WA =====
    const result = await notifyDosenRekap({
      kelompokId,
      tipe,
      records: formattedRecords,
      periodeLabel,
    })

    return NextResponse.json({
      ok: result.ok,
      mode: result.mode,
      detail: result.detail,
      recipient: result.recipient,
      kelompok: `${kel.nama} (${kel.tipe})`,
      dosen: kel.dosen.nama,
      jumlahRecord: records.length,
      periodeLabel,
    })
  } catch (e: any) {
    console.error('[POST /api/absensi/notify]', e)
    return NextResponse.json({ error: 'Gagal mengirim notifikasi rekap' }, { status: 500 })
  }
}
