import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/**
 * GET /api/mahasiswa/import/template
 *
 * Download template Excel (.xlsx) untuk import data mahasiswa.
 * Format mengikuti struktur Google Forms response export (12 kolom)
 * agar user tinggal copy-paste data dari file Google Forms ke template ini.
 *
 * Kolom (urutan):
 *   1. No                       — nomor urut (opsional, auto-skip)
 *   2. Nama Lengkap             — wajib
 *   3. NIM                      — wajib, unik
 *   4. Jenis Kelamin            — Laki-laki / Perempuan
 *   5. Program Studi            — nama prodi (akan auto-match ke DB)
 *   6. Nomor WA Aktif           — No HP/WA mahasiswa
 *   7. Nomor HP/WA orangtua/Wali — opsional
 *   8. Alamat Asal              — alamat lengkap
 *   9. Pasfoto (URL)            — link Google Drive / URL foto (opsional)
 *   10. Bukti pembayaran        — opsional (auto-skip)
 *   11. Bukti pembayaran panduan — opsional (auto-skip)
 *   12. Pernyataan              — opsional (auto-skip)
 *
 * Response: file .xlsx
 */
export async function GET() {
  const headers = [
    'No',
    'Nama Lengkap',
    'NIM',
    'Jenis Kelamin',
    'Program Studi',
    'Nomor WA Aktif',
    'Nomor HP/WA orangtua/Wali',
    'Alamat Asal (Desa/ Kelurahan, Kecamatan, Kabupaten/ Kota)',
    'Pasfoto (mengenakan jaket almamater Uniraya dengan latar biru) ukuran 3x4 cm',
    'Bukti pembayaran biaya PLP II',
    'Bukti pembayaran biaya Panduan PLP II',
    'Saya menyatakan dan menjamin bahwa seluruh data yang saya input adalah benar, lengkap, dan dapat dipertanggungjawabkan.',
  ]

  const samples: (string | number)[][] = [
    [
      1,
      'Budi Santoso',
      '23200211001',
      'Laki-laki',
      'Pendidikan Bahasa Inggris',
      '081234567890',
      '081298765432',
      'Desa Contoh, Kec. Contoh, Kab. Nias Selatan, Sumatera Utara',
      'https://drive.google.com/open?id=XXXXX',
      '',
      '',
      '✔',
    ],
    [
      2,
      'Siti Aminah',
      '23200211002',
      'Perempuan',
      'Pendidikan Matematika',
      '081234567891',
      '081298765433',
      'Jl. Pendidikan No. 1, Gunungsitoli',
      '',
      '',
      '',
      '✔',
    ],
  ]

  const notes: (string | number)[][] = [
    [''],
    ['CATATAN:'],
    ['- Kolom No, Nomor HP ortu, Bukti pembayaran, dan Pernyataan akan diabaikan saat import'],
    ['- Kolom wajib: Nama Lengkap, NIM, Jenis Kelamin, Program Studi'],
    ['- Program Studi akan auto-match ke database. Jika tidak match, akan diminta mapping manual.'],
    ['- Pasfoto: isi dengan URL Google Drive atau biarkan kosong'],
    ['- NIM duplikat akan dilewati (kecuali matikan opsi Skip Duplicate)'],
    ['- Tempat Lahir, Tanggal Lahir, Email, Semester, Angkatan diisi di form import (default)'],
  ]

  const aoa: (string | number)[][] = [headers, ...samples, ...notes]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 25 },  // Nama Lengkap
    { wch: 15 },  // NIM
    { wch: 12 },  // Jenis Kelamin
    { wch: 28 },  // Program Studi
    { wch: 16 },  // Nomor WA
    { wch: 20 },  // Nomor HP ortu
    { wch: 40 },  // Alamat
    { wch: 35 },  // Pasfoto
    { wch: 18 },  // Bukti pembayaran
    { wch: 22 },  // Bukti panduan
    { wch: 30 },  // Pernyataan
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template Import')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template-import-mahasiswa.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
