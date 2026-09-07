import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/**
 * GET /api/dosen/import/template
 *
 * Download template Excel (.xlsx) untuk import dosen.
 *
 * Format fleksibel — yang penting ada kolom "Nama Dosen" (atau "Nama",
 * "Dosen Pendamping", "Koordinator Lapangan"). Lainnya opsional.
 *
 * Kolom (urutan):
 *   1. No                       — nomor urut (opsional)
 *   2. Nama Dosen               — wajib (atau "Dosen Pendamping" / "Koordinator Lapangan")
 *   3. NIDN                     — opsional
 *   4. Fakultas                 — opsional
 *   5. Program Studi            — opsional
 *   6. Email                    — opsional
 *   7. No HP                    — opsional
 *   8. Jabatan                  — opsional (default: Dosen Pendamping)
 *
 * Untuk import Korlap + Dosen Pendamping sekaligus, gunakan 2 kolom nama:
 *   - Kolom "Koordinator Lapangan"
 *   - Kolom "Dosen Pendamping"
 * Sistem otomatis deteksi kedua kolom dan set jabatan sesuai header.
 *
 * Response: file .xlsx
 */
export async function GET() {
  const headers = [
    'No',
    'Nama Dosen',
    'NIDN',
    'Fakultas',
    'Program Studi',
    'Email',
    'No HP',
    'Jabatan',
  ]

  const samples: (string | number)[][] = [
    [1, 'Dr. Budi Santoso, M.Kom.', '0021234567', 'Fakultas Teknik', 'Teknik Informatika', 'budi@uniraya.ac.id', '081234567890', 'Dosen Pendamping'],
    [2, 'Dra. Siti Aminah, M.Pd.', '', 'Fakultas Keguruan dan Ilmu Pendidikan', 'Pendidikan Matematika', '', '', 'Dosen Pendamping'],
    [3, 'Prof. Ahmad Hidayat, Ph.D.', '0019876543', '', '', 'ahmid@uniraya.ac.id', '', 'Lektor'],
  ]

  const notes: (string | number)[][] = [
    [''],
    ['CATATAN:'],
    ['- Kolom wajib: "Nama Dosen" (atau "Nama", "Dosen Pendamping", "Koordinator Lapangan")'],
    ['- Kolom lain (NIDN, Fakultas, Prodi, Email, No HP, Jabatan) — opsional, boleh kosong'],
    ['- NIDN: kalau diisi harus unik. Kalau kosong, sistem tetap menerima (cukup nama).'],
    ['- Fakultas & Prodi akan auto-match ke database. Kalau tidak match, akan diabaikan.'],
    ['- Jabatan default: "Dosen Pendamping". Bisa diisi: Dosen Pendamping / Koordinator Lapangan / Lainnya.'],
    ['', ''],
    ['FORMAT ALTERNATIF (untuk Korlap + Dosen Pendamping sekaligus):'],
    ['No', 'Koordinator Lapangan', 'Dosen Pendamping'],
    [1, 'M. Yunus Laia, S.S.,S.H.,M.S', 'Kaminudin Telumbanua, S.Pd.,M.M'],
    [2, 'Progresif Bu\'ulolo, S.Kom.,M.Kom', 'Walsyukurniat Zendrato, S.Pd.,M.M'],
    ['', ''],
    ['Dengan format di atas, sistem otomatis deteksi 2 kolom nama dan set jabatan sesuai header.'],
    ['Field NIDN/Email/Fakultas bisa ditambahkan sebagai kolom tambahan bila perlu.'],
  ]

  const aoa: (string | number)[][] = [headers, ...samples, ...notes]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 30 },  // Nama Dosen
    { wch: 15 },  // NIDN
    { wch: 35 },  // Fakultas
    { wch: 28 },  // Program Studi
    { wch: 25 },  // Email
    { wch: 16 },  // No HP
    { wch: 22 },  // Jabatan
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template Import Dosen')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template-import-dosen.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
