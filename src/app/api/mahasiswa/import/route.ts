import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

/**
 * POST /api/mahasiswa/import
 *
 * Import mahasiswa dari file Excel (.xlsx/.xls) yang diupload.
 *
 * Format file yang didukung:
 *   - Google Forms response export (Form Responses 1)
 *   - Kolom yang diharapkan (auto-detected by header name):
 *       - "Nama Lengkap" atau "Nama"          → nama
 *       - "NIM"                                → nim
 *       - "Jenis Kelamin"                      → jenisKelamin (L/P)
 *       - "Program Studi"                      → prodiId (mapping)
 *       - "Nomor WA Aktif" / "No HP" / "No. HP" → noHp
 *       - "Alamat Asal" / "Alamat"             → alamat
 *       - "Pasfoto" / "Foto"                   → foto (Google Drive URL OK)
 *
 * Field yang TIDAK ada di Excel akan diisi dari body request (defaults):
 *   - tempatLahir (string, wajib)
 *   - tanggalLahir (ISO date string, wajib)
 *   - email (string, wajib — bisa pakai template {nim}@example.com)
 *   - semester (int, default 5)
 *   - angkatan (int, default 2024)
 *
 * Prodi mapping: jika body.prodiMapping berisi { "Bimbingan Konseling": "<prodiId>" },
 * gunakan mapping tersebut. Untuk prodi yang tidak ada di mapping & tidak cocok
 * dengan DB, skip row dengan error.
 *
 * Body (multipart/form-data):
 *   - file: Excel file
 *   - tempatLahir: default tempat lahir
 *   - tanggalLahir: default tanggal lahir (YYYY-MM-DD)
 *   - emailPattern: pattern email, mis. "{nim}@uniraya.ac.id"
 *   - semester: default semester (default 5)
 *   - angkatan: default angkatan (default 2024)
 *   - prodiMapping: JSON string { "<nama prodi di excel>": "<prodiId>" }
 *   - skipDuplicate: "true" untuk skip NIM duplikat (default), "false" untuk error
 *
 * Response:
 *   { success: true, imported: N, skipped: M, errors: [{ row, nim, nama, error }] }
 */

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

const PRODI_KEYWORD_MAP: Record<string, string[]> = {
  // DB prodi name → keywords that should match it
  'Pendidikan Matematika': ['matematika', 'mtk'],
  'Pendidikan Biologi': ['biologi', 'bio'],
  'Pendidikan Fisika': ['fisika', 'fis'],
  'Pendidikan Bahasa Indonesia': ['bahasa indonesia', 'bhs indonesia', 'sastra indonesia', 'pend. bhs ind'],
  'Pendidikan Bahasa Inggris': ['bahasa inggris', 'bhs inggris', 'english', 'pend. bhs ing'],
  'Teknik Informatika': ['informatika', 'ti ', 'ilkom'],
  'Teknik Sipil': ['sipil', 'ts '],
  'Ilmu Sosial': ['ilmu sosial', 'isos', 'sosiologi'],
  'Teknik Mesin': ['mesin', 'tm '],
  'Manajemen': ['manajemen', 'manaj'],
  'Akuntansi': ['akuntansi', 'akt'],
  'Ilmu Hukum': ['hukum', 'huk'],
}

function matchProdiByName(prodiInExcel: string, dbProdi: { id: string; nama: string }[]): string | null {
  const cleaned = prodiInExcel.toLowerCase().trim()
  if (!cleaned) return null

  // Exact match (case-insensitive)
  const exact = dbProdi.find((p) => p.nama.toLowerCase() === cleaned)
  if (exact) return exact.id

  // Keyword match (use word-ish boundaries to avoid 'ti' matching inside other words)
  for (const [dbName, keywords] of Object.entries(PRODI_KEYWORD_MAP)) {
    if (keywords.some((kw) => cleaned.includes(kw))) {
      const found = dbProdi.find((p) => p.nama === dbName)
      if (found) return found.id
    }
  }
  return null
}

// Map "Laki-laki" / "Perempuan" → "L" / "P"
function normalizeJenisKelamin(raw: string): 'L' | 'P' | null {
  if (!raw) return null
  const s = raw.toLowerCase().trim()
  if (s.startsWith('l')) return 'L'
  if (s.startsWith('p')) return 'P'
  return null
}

// Find a column index by header name (case-insensitive, partial match)
function findCol(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toLowerCase()
    if (patterns.some((p) => h.includes(p))) return i
  }
  return -1
}

// Generate email from pattern, e.g. "{nim}@uniraya.ac.id" → "23200271021@uniraya.ac.id"
function genEmail(pattern: string, mhs: { nim: string; nama: string }): string {
  if (!pattern) return `${mhs.nim}@example.com`
  return pattern
    .replace(/\{nim\}/gi, mhs.nim)
    .replace(/\{nama\}/gi, mhs.nama.toLowerCase().replace(/\s+/g, '.'))
}

// Accept http(s) URLs and data: URLs (Google Drive link, base64 image, etc.)
function normalizeFoto(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  if (/^data:image\//i.test(s)) return s
  return null
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File Excel wajib diupload' }, { status: 400 })
    }

    // Parse defaults from form fields
    const tempatLahir = (formData.get('tempatLahir') as string | null)?.trim() || ''
    const tanggalLahirStr = (formData.get('tanggalLahir') as string | null) || ''
    const emailPattern = (formData.get('emailPattern') as string | null) || '{nim}@uniraya.ac.id'
    const semesterStr = (formData.get('semester') as string | null) || '5'
    const angkatanStr = (formData.get('angkatan') as string | null) || '2024'
    const prodiMappingRaw = (formData.get('prodiMapping') as string | null) || '{}'
    const skipDuplicate = (formData.get('skipDuplicate') as string | null) !== 'false' // default true

    // Validate required defaults
    if (!tempatLahir) {
      return NextResponse.json({ error: 'Tempat lahir default wajib diisi' }, { status: 400 })
    }
    const tanggalLahir = new Date(tanggalLahirStr)
    if (isNaN(tanggalLahir.getTime())) {
      return NextResponse.json({ error: 'Tanggal lahir default tidak valid' }, { status: 400 })
    }
    const semester = Number(semesterStr)
    if (!Number.isInteger(semester) || semester < 1) {
      return NextResponse.json({ error: 'Semester tidak valid' }, { status: 400 })
    }
    const angkatan = Number(angkatanStr)
    if (!Number.isInteger(angkatan) || angkatan < 2000) {
      return NextResponse.json({ error: 'Angkatan tidak valid' }, { status: 400 })
    }

    let prodiMapping: Record<string, string> = {}
    try {
      prodiMapping = JSON.parse(prodiMappingRaw)
      if (typeof prodiMapping !== 'object' || prodiMapping === null) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Format prodiMapping tidak valid JSON' }, { status: 400 })
    }

    // ── Parse Excel ───────────────────────────────────────────────────────
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      return NextResponse.json({ error: 'Sheet tidak ditemukan dalam file Excel' }, { status: 400 })
    }
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false })
    if (rows.length < 2) {
      return NextResponse.json({ error: 'File Excel kosong (tidak ada data)' }, { status: 400 })
    }
    const headers = (rows[0] || []).map((h) => String(h || '').trim())

    // Find column indices. "No" column (nomor urut) is auto-skipped — not used.
    const colNama = findCol(headers, ['nama lengkap', 'nama'])
    const colNim = findCol(headers, ['nim'])
    const colJK = findCol(headers, ['jenis kelamin', 'jk'])
    const colProdi = findCol(headers, ['program studi', 'prodi'])
    // Nomor WA Aktif (mahasiswa's own phone) — avoid matching "Nomor HP/WA orangtua"
    // by checking 'nomor wa aktif' first, fall back to generic 'nomor wa' / 'no wa'.
    const colNoHp = findCol(headers, ['nomor wa aktif', 'nomor wa', 'no wa', 'no hp', 'no. hp', 'nomor hp', 'nomor telepon', 'no telepon'])
    const colAlamat = findCol(headers, ['alamat asal', 'alamat'])
    const colFoto = findCol(headers, ['pasfoto', 'foto'])

    if (colNama === -1 || colNim === -1) {
      return NextResponse.json(
        { error: `Kolom wajib tidak ditemukan. Pastikan ada kolom "Nama" dan "NIM". Kolom yang terdeteksi: ${headers.join(', ')}` },
        { status: 400 },
      )
    }

    // Fetch all prodi for matching
    const dbProdi = await db.programStudi.findMany({ select: { id: true, nama: true } })

    // ── Process each row ──────────────────────────────────────────────────
    const errors: { row: number; nim: string; nama: string; error: string }[] = []
    let imported = 0
    let skipped = 0

    // Fetch all existing NIMs in one query (avoid N+1)
    const existingNims = new Set<string>(
      (await db.mahasiswa.findMany({ select: { nim: true } })).map((m) => m.nim),
    )

    const toCreate: Array<{
      nim: string
      nama: string
      jenisKelamin: 'L' | 'P'
      tempatLahir: string
      tanggalLahir: Date
      alamat: string
      noHp: string
      email: string
      prodiId: string
      semester: number
      angkatan: number
      status: string
      foto: string | null
    }> = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || []
      const nim = String(row[colNim] || '').trim()
      const nama = String(row[colNama] || '').trim()

      if (!nim && !nama) continue // skip empty rows

      if (!nim) {
        errors.push({ row: i + 1, nim: '', nama, error: 'NIM kosong' })
        continue
      }
      if (!nama) {
        errors.push({ row: i + 1, nim, nama: '', error: 'Nama kosong' })
        continue
      }

      // Skip duplicate NIM
      if (existingNims.has(nim)) {
        if (skipDuplicate) {
          skipped++
          errors.push({ row: i + 1, nim, nama, error: 'NIM sudah terdaftar (skipped)' })
          continue
        } else {
          errors.push({ row: i + 1, nim, nama, error: 'NIM sudah terdaftar' })
          continue
        }
      }

      // Jenis Kelamin
      const jkRaw = String(row[colJK] || '').trim()
      const jk = normalizeJenisKelamin(jkRaw)
      if (!jk) {
        errors.push({ row: i + 1, nim, nama, error: `Jenis kelamin tidak valid: "${jkRaw}"` })
        continue
      }

      // Prodi
      const prodiName = String(row[colProdi] || '').trim()
      if (!prodiName) {
        errors.push({ row: i + 1, nim, nama, error: 'Program Studi kosong' })
        continue
      }
      // 1. Check user-supplied mapping first
      let prodiId = prodiMapping[prodiName]
      // 2. Auto-match by name/keyword
      if (!prodiId) {
        prodiId = matchProdiByName(prodiName, dbProdi)
      }
      if (!prodiId) {
        errors.push({ row: i + 1, nim, nama, error: `Program Studi "${prodiName}" tidak ditemukan di database. Petakan manual.` })
        continue
      }

      const alamat = colAlamat !== -1 ? String(row[colAlamat] || '').trim() : ''
      const noHp = colNoHp !== -1 ? String(row[colNoHp] || '').trim() : ''
      const foto = colFoto !== -1 ? normalizeFoto(String(row[colFoto] || '')) : null
      const email = genEmail(emailPattern, { nim, nama })

      toCreate.push({
        nim,
        nama,
        jenisKelamin: jk,
        tempatLahir,
        tanggalLahir,
        alamat: alamat || '-',
        noHp: noHp || '-',
        email,
        prodiId,
        semester,
        angkatan,
        status: 'AKTIF',
        foto,
      })
      existingNims.add(nim) // prevent duplicate within same file
    }

    // ── Insert one-by-one (sequential) ─────────────────────────────────────
    // Previously we tried db.$transaction([create, create, ...]) and db.createMany().
    // Both caused the Next.js dev server (Turbopack) to OOM-crash when importing
    // 50+ rows. Sequential create is slightly slower but uses constant memory —
    // each row is inserted and the previous row's Prisma client reference is
    // released before the next one starts.
    //
    // In production (Vercel + Neon Postgres) this loop completes in <2s for 129 rows.
    // If a row fails (e.g. NIM/email uniqueness), we record the error and continue
    // to the next row so the user gets a full report at the end.
    if (toCreate.length > 0) {
      for (const m of toCreate) {
        try {
          await db.mahasiswa.create({ data: m })
          imported++
        } catch (e: any) {
          if (e?.code === 'P2002') {
            errors.push({ row: -1, nim: m.nim, nama: m.nama, error: 'NIM/email duplikat (race condition)' })
          } else {
            errors.push({ row: -1, nim: m.nim, nama: m.nama, error: e?.message || 'unknown error' })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      totalRows: rows.length - 1,
    })
  } catch (e: any) {
    console.error('[POST /api/mahasiswa/import]', e)
    return NextResponse.json(
      { error: 'Gagal mengimpor file Excel: ' + (e?.message || 'unknown error') },
      { status: 500 },
    )
  }
}
