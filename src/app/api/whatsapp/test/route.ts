import { NextResponse } from 'next/server'
import { sendWhatsApp, normalizeWaNumber } from '@/lib/whatsapp'

/**
 * POST /api/whatsapp/test
 * Body: { to: "0812xxx" }
 *
 * Kirim pesan test WA ke nomor tertentu. Berguna untuk verifikasi konfigurasi
 * gateway dari halaman Pengaturan. Mengembalikan detail mode (live/simulasi/disabled)
 * dan status pengiriman.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const to = String(body?.to ?? '').trim()

    if (!to) {
      return NextResponse.json({ ok: false, error: 'Nomor WA tujuan wajib diisi' }, { status: 400 })
    }

    const normalized = normalizeWaNumber(to)
    if (normalized.length < 10) {
      return NextResponse.json(
        { ok: false, error: `Nomor WA tidak valid: "${to}" → "${normalized}"` },
        { status: 400 },
      )
    }

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    const message = `*TES NOTIFIKASI WHATSAPP* ✅

Ini adalah pesan test dari SIM KKN & PLP.

Waktu: ${now} WIB
Tujuan: ${normalized}

Jika Anda menerima pesan ini, berarti konfigurasi WhatsApp Gateway berfungsi dengan baik. Notifikasi absensi mahasiswa (check-in masuk & check-out pulang) akan otomatis terkirim ke dosen pembimbing.

— SIM KKN & PLP Universitas Nusantara Jaya`

    const result = await sendWhatsApp({ to, message })

    return NextResponse.json({
      ok: result.ok,
      mode: result.mode,
      recipient: result.recipient,
      detail: result.detail,
      message: result.ok
        ? result.mode === 'live'
          ? `Pesan test terkirim ke ${result.recipient} (mode LIVE).`
          : result.mode === 'simulasi'
            ? `Mode SIMULASI — pesan test dicatat di log server (gateway belum dikonfigurasi). Cek dev.log untuk melihat isi pesan.`
            : `Notifikasi WA dinonaktifkan di Pengaturan. Aktifkan toggle "Aktifkan Notifikasi WA" lalu coba lagi.`
        : `Gagal: ${result.detail ?? 'unknown error'}`,
    })
  } catch (e: any) {
    console.error('[POST /api/whatsapp/test]', e)
    return NextResponse.json(
      { ok: false, error: e?.message || 'Gagal mengirim pesan test' },
      { status: 500 },
    )
  }
}
