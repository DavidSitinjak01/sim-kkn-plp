import { db } from '@/lib/db'

/**
 * WhatsApp Notification Helper
 *
 * Mendukung 3 mode operasi (otomatis dipilih berdasarkan konfigurasi Pengaturan):
 * 1. disabled  — wa_enabled='false' → tidak kirim apa-apa (hanya log)
 * 2. simulasi  — wa_enabled='true' tapi wa_gateway/wa_api_key kosong → log pesan ke console (untuk testing tanpa API key asli)
 * 3. live      — wa_enabled='true' + wa_gateway + wa_api_key terisi → POST ke gateway (Fonnte-compatible)
 *
 * Kompatibel dengan Fonnte (https://api.fonnte.com/send):
 *   Header: Authorization: <token>
 *   Body (JSON): { target: "62xxx", message: "..." }
 */

export type WaMode = 'live' | 'simulasi' | 'disabled'

export interface WaResult {
  ok: boolean
  mode: WaMode
  detail?: string
  recipient?: string
  message?: string
}

interface WaConfig {
  enabled: boolean
  url: string
  token: string
  sender: string
}

// Cache config selama 60 detik untuk hindari query DB berulang dalam satu request
let cachedConfig: { data: WaConfig; ts: number } | null = null
const CONFIG_TTL_MS = 60_000

async function getWaConfig(): Promise<WaConfig> {
  const now = Date.now()
  if (cachedConfig && now - cachedConfig.ts < CONFIG_TTL_MS) {
    return cachedConfig.data
  }
  const rows = await db.pengaturan.findMany({
    where: { key: { in: ['wa_enabled', 'wa_gateway', 'wa_api_key', 'wa_sender'] } },
  })
  const cfg: Record<string, string> = {}
  for (const r of rows) cfg[r.key] = r.value
  const data: WaConfig = {
    enabled: cfg.wa_enabled === 'true',
    url: (cfg.wa_gateway || '').trim(),
    token: (cfg.wa_api_key || '').trim(),
    sender: (cfg.wa_sender || '').trim(),
  }
  cachedConfig = { data, ts: now }
  return data
}

/** Normalisasi nomor HP Indonesia ke format 62xxx (tanpa +, spasi, atau strip) */
export function normalizeWaNumber(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return '62' + digits.slice(1)
  // Asumsi nomor lokal tanpa prefix 0/62
  return '62' + digits
}

/** Kirim WA ke satu nomor. Tidak throw — selalu return WaResult. */
export async function sendWhatsApp(payload: { to: string; message: string }): Promise<WaResult> {
  const to = normalizeWaNumber(payload.to)
  if (to.length < 10) {
    return {
      ok: false,
      mode: 'disabled',
      detail: `Nomor WA tidak valid: "${payload.to}" → "${to}"`,
      recipient: payload.to,
    }
  }

  const cfg = await getWaConfig()

  // Mode 1: disabled
  if (!cfg.enabled) {
    console.log('[WA:DISABLED] notifikasi dinonaktifkan di Pengaturan. To:', to)
    return {
      ok: true,
      mode: 'disabled',
      detail: 'WhatsApp notifikasi dinonaktifkan di Pengaturan',
      recipient: to,
    }
  }

  // Mode 2: simulasi (enabled tapi belum dikonfigurasi gateway/token)
  if (!cfg.url || !cfg.token || cfg.url === 'https://api.whatsapp.com') {
    console.log('═══════════════════════════════════════════════════════')
    console.log('[WA:SIMULASI] (gateway belum dikonfigurasi — pesan tidak benar-benar terkirim)')
    console.log('  To     :', to)
    console.log('  Message:')
    console.log(payload.message.split('\n').map((l) => '    ' + l).join('\n'))
    console.log('═══════════════════════════════════════════════════════')
    return {
      ok: true,
      mode: 'simulasi',
      detail: 'Mode simulasi — WA Gateway belum dikonfigurasi. Pesan dicatat di log server.',
      recipient: to,
      message: payload.message,
    }
  }

  // Mode 3: live — POST ke gateway (Fonnte-compatible)
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        Authorization: cfg.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: to,
        message: payload.message,
        ...(cfg.sender ? { sender: cfg.sender } : {}),
      }),
      // Jangan biarkan gateway lambat memblock request absensi
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[WA:LIVE] HTTP error', res.status, txt.slice(0, 300))
      return {
        ok: false,
        mode: 'live',
        detail: `Gateway merespons HTTP ${res.status}: ${txt.slice(0, 200)}`,
        recipient: to,
      }
    }

    // Beberapa gateway return { status: true/false }
    let body: any = null
    try {
      body = await res.json()
    } catch {
      /* ignore — anggap sukses karena HTTP 2xx */
    }
    if (body && typeof body === 'object' && body.status === false) {
      return {
        ok: false,
        mode: 'live',
        detail: `Gateway menolak: ${body.message || body.reason || JSON.stringify(body).slice(0, 200)}`,
        recipient: to,
      }
    }

    return {
      ok: true,
      mode: 'live',
      detail: body?.message || 'Terkirim',
      recipient: to,
    }
  } catch (e: any) {
    console.error('[WA:LIVE] network/timeout error:', e?.message)
    return {
      ok: false,
      mode: 'live',
      detail: `Gagal kirim WA: ${e?.name === 'TimeoutError' ? 'timeout (15s)' : e?.message || 'network error'}`,
      recipient: to,
    }
  }
}

/**
 * Kirim rekap absensi (harian atau bulanan) sebuah kelompok ke dosen pembimbingnya.
 *
 * @param kelompokId  ID Kelompok yang rekapnya dikirim
 * @param tipe        'HARIAN' atau 'BULANAN'
 * @param records     Array absensi yang sudah di-fetch + include relasinya.
 *                    Untuk HARIAN: semua record tanggal tsb. Untuk BULANAN:
 *                    sudah digabung per-mahasiswa (count per status).
 * @param periodeLabel Label periode untuk header pesan, mis. "Senin, 12 Mei 2025"
 *                     atau "Mei 2025".
 */
export async function notifyDosenRekap(args: {
  kelompokId: string
  tipe: 'HARIAN' | 'BULANAN'
  records: Array<{
    nim: string
    nama: string
    status: string
    jamMasuk: Date | string | null
    jamPulang: Date | string | null
    keterangan?: string | null
  }>
  periodeLabel: string
}): Promise<WaResult> {
  try {
    const kel = await db.kelompok.findUnique({
      where: { id: args.kelompokId },
      include: { dosen: true, desa: true, sekolah: true },
    })
    if (!kel) {
      return { ok: false, mode: 'disabled', detail: 'Kelompok tidak ditemukan' }
    }
    const dosen = kel.dosen
    if (!dosen) {
      return {
        ok: false,
        mode: 'disabled',
        detail: `Kelompok "${kel.nama}" tidak punya dosen pembimbing`,
      }
    }
    if (!dosen.noHp) {
      return {
        ok: false,
        mode: 'disabled',
        detail: `Dosen ${dosen.nama} tidak punya nomor WA`,
      }
    }

    const tipeLabel = args.tipe === 'HARIAN' ? 'HARIAN' : 'BULANAN'
    const tipeEmoji = args.tipe === 'HARIAN' ? '📋' : '📊'
    const lokasi = kel.desa?.nama || kel.sekolah?.nama || '-'

    const total = args.records.length
    const hadir = args.records.filter((r) => r.status === 'HADIR').length
    const izin = args.records.filter((r) => r.status === 'IZIN').length
    const sakit = args.records.filter((r) => r.status === 'SAKIT').length
    const alpha = args.records.filter((r) => r.status === 'ALPHA').length

    // Batasi daftar nama supaya pesan tidak melebihi batas WA (~4096 char).
    // Tampilkan maksimal 15 baris; sisanya diringkas.
    const lines: string[] = []
    const shown = args.records.slice(0, 15)
    for (const r of shown) {
      const jam =
        r.jamMasuk
          ? new Date(r.jamMasuk).toLocaleTimeString('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-'
      const statusEmoji =
        r.status === 'HADIR' ? '✅'
        : r.status === 'IZIN' ? '🟨'
        : r.status === 'SAKIT' ? '🩺'
        : '⬛'
      lines.push(`${statusEmoji} ${r.nim} — ${r.nama} (${jam})`)
    }
    if (args.records.length > 15) {
      lines.push(`... dan ${args.records.length - 15} lainnya`)
    }
    const detail = lines.length > 0 ? lines.join('\n') : '(Belum ada absensi)'

    const message = `${tipeEmoji} *REKAP ABSENSI ${tipeLabel}*

Kelompok: *${kel.nama}* (${kel.tipe})
Lokasi: ${lokasi}
DPL: ${dosen.nama}
Periode: ${args.periodeLabel}

*Ringkasan:* Total ${total} | Hadir ${hadir} | Izin ${izin} | Sakit ${sakit} | Alpha ${alpha}

*Detail Mahasiswa:*
${detail}

— SIM KKN & PLP Universitas Nusantara Jaya`

    const result = await sendWhatsApp({ to: dosen.noHp, message })

    console.log(
      `[WA-REKAP] ${tipeLabel} | Kelompok: ${kel.nama} | Dosen: ${dosen.nama} ` +
        `(${result.recipient ?? dosen.noHp}) | Mode: ${result.mode} | ` +
        `Status: ${result.ok ? 'OK' : 'GAGAL — ' + (result.detail ?? '')}`,
    )

    return result
  } catch (e: any) {
    console.error('[notifyDosenRekap] error:', e)
    return { ok: false, mode: 'disabled', detail: e?.message || 'unknown error' }
  }
}

/**
 * Kirim notifikasi absensi ke dosen pembimbing kelompok mahasiswa.
 * Dipanggil dari API absensi setelah record dibuat/diupdate.
 *
 * @param absensiId  ID record Absensi
 * @param tipe       'MASUK' = check-in, 'PULANG' = check-out
 */
export async function notifyDosenAbsensi(args: {
  absensiId: string
  tipe: 'MASUK' | 'PULANG'
}): Promise<WaResult> {
  try {
    const absen = await db.absensi.findUnique({
      where: { id: args.absensiId },
      include: {
        mahasiswa: { include: { prodi: true } },
        kelompok: { include: { dosen: true, desa: true, sekolah: true } },
      },
    })
    if (!absen) {
      return { ok: false, mode: 'disabled', detail: 'Absensi tidak ditemukan' }
    }

    const dosen = absen.kelompok?.dosen
    if (!dosen) {
      return {
        ok: false,
        mode: 'disabled',
        detail: `Kelompok "${absen.kelompok?.nama ?? '-'}" tidak punya dosen pembimbing`,
      }
    }

    if (!dosen.noHp) {
      return {
        ok: false,
        mode: 'disabled',
        detail: `Dosen ${dosen.nama} tidak punya nomor WA`,
      }
    }

    // Label header menyesuaikan status absensi:
    //  - HADIR + MASUK → "CHECK-IN MASUK"
    //  - HADIR + PULANG → "CHECK-OUT PULANG"
    //  - IZIN/SAKIT/ALPHA → label sesuai status (tidak ada jam check-in/out)
    let tipeLabel: string
    let tipeEmoji: string
    if (absen.status === 'HADIR') {
      if (args.tipe === 'MASUK') {
        tipeLabel = 'CHECK-IN MASUK'
        tipeEmoji = '🟢'
      } else {
        tipeLabel = 'CHECK-OUT PULANG'
        tipeEmoji = '🟠'
      }
    } else if (absen.status === 'IZIN') {
      tipeLabel = 'IZIN'
      tipeEmoji = '🟨'
    } else if (absen.status === 'SAKIT') {
      tipeLabel = 'SAKIT'
      tipeEmoji = '🩺'
    } else {
      tipeLabel = 'ALPHA'
      tipeEmoji = '⬛'
    }

    const jamSource = args.tipe === 'MASUK' ? absen.jamMasuk : absen.jamPulang
    const jam = jamSource
      ? new Date(jamSource).toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-'
    const tgl = new Date(absen.tanggal).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const lokasi = absen.kelompok?.desa?.nama || absen.kelompok?.sekolah?.nama || '-'

    const ketLine = absen.keterangan ? `\nKeterangan: ${absen.keterangan}` : ''

    const message = `${tipeEmoji} *NOTIFIKASI ABSENSI ${tipeLabel}*

Mahasiswa: *${absen.mahasiswa.nama}*
NIM: ${absen.mahasiswa.nim}
Prodi: ${absen.mahasiswa.prodi?.nama ?? '-'}

Kelompok: ${absen.kelompok?.nama ?? '-'} (${absen.kelompok?.tipe ?? '-'})
Lokasi: ${lokasi}

Tanggal: ${tgl}
Jam: ${jam} WIB
Status: ${absen.status}${ketLine}

— SIM KKN & PLP Universitas Nusantara Jaya`

    const result = await sendWhatsApp({ to: dosen.noHp, message })

    // Log ke console (audit trail) — best-effort, jangan block
    console.log(
      `[WA-NOTIF] ${tipeLabel} | Mhs: ${absen.mahasiswa.nama} (${absen.mahasiswa.nim}) | ` +
        `Dosen: ${dosen.nama} (${result.recipient ?? dosen.noHp}) | ` +
        `Mode: ${result.mode} | Status: ${result.ok ? 'OK' : 'GAGAL — ' + (result.detail ?? '')}`,
    )

    return result
  } catch (e: any) {
    console.error('[notifyDosenAbsensi] error:', e)
    return { ok: false, mode: 'disabled', detail: e?.message || 'unknown error' }
  }
}
