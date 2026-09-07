import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

/**
 * Helper untuk import dosen dari Excel.
 *
 * Field wajib: NAMA saja.
 * Lainnya (NIDN, Email, No HP, Fakultas, Prodi, Jabatan) — opsional.
 *
 * Auto-detect kolom berdasarkan header (case-insensitive, partial match):
 *   - Nama: "Nama Dosen" | "Nama" | "Dosen Pendamping" | "Koordinator Lapangan" | "Nama Lengkap" | "Dosen"
 *   - NIDN: "NIDN" | "NIP"
 *   - Prodi: "Prodi" | "Program Studi"
 *   - Email: "Email" | "E-mail"
 *   - No HP: "No HP" | "No. HP" | "Nomor HP" | "No Hp" | "No. Telepon" | "Nomor Telepon" | "No WA"
 *   - Fakultas: "Fakultas"
 *
 * Multi-name-column support:
 *   Kalau file punya 2+ kolom nama (mis. "Koordinator Lapangan" + "Dosen Pendamping"),
 *   masing-masing kolom akan dianggap sebagai list nama tersendiri, dengan jabatan
 *   diambil dari header kolom tersebut (lower-cased & title-cased).
 */

/** Pola pencarian kolom (urutan = prioritas). */
export const KOLOM_PATTERNS = {
  nama: [
    'nama dosen', 'nama lengkap', 'nama',
    'dosen pendamping', 'koordinator lapangan', 'dosen',
    'pembimbing', 'koordinator',
  ],
  nidn: ['nidn', 'nip'],
  prodi: ['program studi', 'prodi'],
  email: ['e-mail', 'email'],
  noHp: ['no. telepon', 'nomor telepon', 'no. hp', 'no hp', 'nomor hp', 'no hp', 'no wa', 'nomor wa', 'telepon', 'telp'],
  fakultas: ['fakultas'],
} as const

export type KolomKey = keyof typeof KOLOM_PATTERNS

/** Cari index kolom berdasarkan daftar pola (case-insensitive, includes). */
export function findCol(headers: string[], patterns: readonly string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toLowerCase().trim()
    if (!h) continue
    // Exact match dulu (utamakan kolom yang persis sama)
    if (patterns.includes(h)) return i
  }
  // Kalau tidak ada exact, cari partial match
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toLowerCase().trim()
    if (!h) continue
    if (patterns.some((p) => h.includes(p))) return i
  }
  return -1
}

/**
 * Cari SEMUA kolom yang cocok dengan pola nama.
 * Dipakai untuk file seperti "Korlap PLP.xlsx" yang punya 2 kolom nama
 * (Koordinator Lapangan + Dosen Pendamping).
 */
export function findAllNameCols(headers: string[]): Array<{ index: number; header: string; jabatan: string }> {
  const result: Array<{ index: number; header: string; jabatan: string }> = []
  const namaPatterns = KOLOM_PATTERNS.nama
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toLowerCase().trim()
    if (!h) continue
    // Exact match lebih dipercaya daripada partial
    const isExact = namaPatterns.includes(h)
    const isPartial = namaPatterns.some((p) => h.includes(p))
    if (isExact || isPartial) {
      // Jabatan inferensi dari header kolom
      let jabatan = 'Dosen Pendamping' // default
      if (h.includes('koordinator')) jabatan = 'Koordinator Lapangan'
      else if (h.includes('pendamping')) jabatan = 'Dosen Pendamping'
      else if (h.includes('pembimbing')) jabatan = 'Dosen Pembimbing'
      result.push({ index: i, header: headers[i], jabatan })
    }
  }
  return result
}

/** Match prodi by name (exact case-insensitive, fallback keyword). */
const PRODI_KEYWORD_MAP: Record<string, string[]> = {
  'Pendidikan Matematika': ['matematika', 'mtk'],
  'Pendidikan Biologi': ['biologi', 'bio'],
  'Pendidikan Fisika': ['fisika', 'fis'],
  'Pendidikan Bahasa Indonesia': ['bahasa indonesia', 'bhs indonesia', 'sastra indonesia'],
  'Pendidikan Bahasa Inggris': ['bahasa inggris', 'bhs inggris', 'english'],
  'Teknik Informatika': ['informatika', 'ilkom'],
  'Teknik Sipil': ['sipil'],
  'Ilmu Sosial': ['ilmu sosial', 'isos', 'sosiologi'],
  'Teknik Mesin': ['mesin'],
  'Manajemen': ['manajemen'],
  'Akuntansi': ['akuntansi'],
  'Ilmu Hukum': ['hukum'],
}

export function matchProdiByName(
  prodiInExcel: string,
  dbProdi: { id: string; nama: string }[],
): { id: string; nama: string } | null {
  const cleaned = prodiInExcel.toLowerCase().trim()
  if (!cleaned) return null
  const exact = dbProdi.find((p) => p.nama.toLowerCase() === cleaned)
  if (exact) return exact
  for (const [dbName, keywords] of Object.entries(PRODI_KEYWORD_MAP)) {
    if (keywords.some((kw) => cleaned.includes(kw))) {
      const found = dbProdi.find((p) => p.nama === dbName)
      if (found) return found
    }
  }
  return null
}

/** Match fakultas by name (exact case-insensitive, fallback keyword). */
const FAKULTAS_KEYWORD_MAP: Record<string, string[]> = {
  'Fakultas Keguruan dan Ilmu Pendidikan': ['keguruan', 'fkip', 'pendidikan'],
  'Fakultas Teknik': ['teknik', 'ft'],
  'Fakultas Ekonomi': ['ekonomi', 'fe'],
  'Fakultas Hukum': ['hukum', 'fh'],
  'Fakultas Ilmu Sosial dan Politik': ['ilmu sosial', 'fisip', 'sosial dan politik'],
}

export function matchFakultasByName(
  fakultasInExcel: string,
  dbFakultas: { id: string; nama: string }[],
): { id: string; nama: string } | null {
  const cleaned = fakultasInExcel.toLowerCase().trim()
  if (!cleaned) return null
  const exact = dbFakultas.find((f) => f.nama.toLowerCase() === cleaned)
  if (exact) return exact
  for (const [dbName, keywords] of Object.entries(FAKULTAS_KEYWORD_MAP)) {
    if (keywords.some((kw) => cleaned.includes(kw))) {
      const found = dbFakultas.find((f) => f.nama === dbName)
      if (found) return found
    }
  }
  return null
}

export interface ParsedDosenRow {
  row: number
  nama: string
  nidn: string | null
  email: string | null
  noHp: string | null
  prodiName: string
  prodiId: string | null
  fakultasName: string
  fakultasId: string | null
  jabatan: string
  /** Sumber kolom nama (header text) — untuk display di preview */
  fromColumn: string
}

export interface PreviewResult {
  totalRows: number
  headers: string[]
  nameColumns: Array<{ index: number; header: string; jabatan: string }>
  detectedColumns: Record<KolomKey, number>
  preview: ParsedDosenRow[]
  matchedProdi: Array<{ excelName: string; dbProdi: { id: string; nama: string } }>
  unmatchedProdi: Array<{ excelName: string; count: number }>
  matchedFakultas: Array<{ excelName: string; dbFakultas: { id: string; nama: string } }>
  unmatchedFakultas: Array<{ excelName: string; count: number }>
  availableProdi: { id: string; nama: string }[]
  availableFakultas: { id: string; nama: string }[]
}

/**
 * Parse file Excel → array of ParsedDosenRow + metadata.
 * Tidak menyimpan ke DB.
 */
export async function parseDosenExcel(file: File): Promise<PreviewResult> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Sheet tidak ditemukan dalam file Excel')
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false })
  if (rows.length < 2) throw new Error('File Excel kosong (tidak ada data)')

  const headers = (rows[0] || []).map((h) => String(h || '').trim())

  // Cari semua kolom nama (bisa 1 atau lebih)
  const nameColumns = findAllNameCols(headers)
  if (nameColumns.length === 0) {
    throw new Error(`Tidak ditemukan kolom nama. Pastikan ada kolom "Nama Dosen", "Nama", "Dosen Pendamping", atau "Koordinator Lapangan". Kolom yang terdeteksi: ${headers.join(', ')}`)
  }

  // Cari kolom optional lainnya (prioritas: jangan match kolom nama yang sudah ter-deteksi)
  const nameIdxSet = new Set(nameColumns.map((n) => n.index))
  const findColExcludeNames = (patterns: readonly string[]): number => {
    for (let i = 0; i < headers.length; i++) {
      if (nameIdxSet.has(i)) continue
      const h = (headers[i] || '').toLowerCase().trim()
      if (!h) continue
      if (patterns.includes(h)) return i
    }
    for (let i = 0; i < headers.length; i++) {
      if (nameIdxSet.has(i)) continue
      const h = (headers[i] || '').toLowerCase().trim()
      if (!h) continue
      if (patterns.some((p) => h.includes(p))) return i
    }
    return -1
  }

  const colNidn = findColExcludeNames(KOLOM_PATTERNS.nidn)
  const colProdi = findColExcludeNames(KOLOM_PATTERNS.prodi)
  const colEmail = findColExcludeNames(KOLOM_PATTERNS.email)
  const colNoHp = findColExcludeNames(KOLOM_PATTERNS.noHp)
  const colFakultas = findColExcludeNames(KOLOM_PATTERNS.fakultas)

  // Fetch master data
  const [dbProdi, dbFakultas] = await Promise.all([
    db.programStudi.findMany({ select: { id: true, nama: true } }),
    db.fakultas.findMany({ select: { id: true, nama: true } }),
  ])

  const prodiStats = new Map<string, { count: number; matched: { id: string; nama: string } | null }>()
  const fakultasStats = new Map<string, { count: number; matched: { id: string; nama: string } | null }>()
  const parsedRows: ParsedDosenRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || []
    // Untuk setiap kolom nama yang terdeteksi, ambil nama
    for (const nc of nameColumns) {
      const namaRaw = String(row[nc.index] || '').trim()
      if (!namaRaw) continue

      const nidn = colNidn !== -1 ? String(row[colNidn] || '').trim() || null : null
      const email = colEmail !== -1 ? String(row[colEmail] || '').trim() || null : null
      const noHp = colNoHp !== -1 ? String(row[colNoHp] || '').trim() || null : null
      const prodiName = colProdi !== -1 ? String(row[colProdi] || '').trim() : ''
      const fakultasName = colFakultas !== -1 ? String(row[colFakultas] || '').trim() : ''

      // Track prodi & fakultas for stats
      let prodiId: string | null = null
      if (prodiName) {
        if (!prodiStats.has(prodiName)) {
          const matched = matchProdiByName(prodiName, dbProdi)
          prodiStats.set(prodiName, { count: 1, matched })
        } else {
          prodiStats.get(prodiName)!.count++
        }
        prodiId = prodiStats.get(prodiName)?.matched?.id ?? null
      }

      let fakultasId: string | null = null
      if (fakultasName) {
        if (!fakultasStats.has(fakultasName)) {
          const matched = matchFakultasByName(fakultasName, dbFakultas)
          fakultasStats.set(fakultasName, { count: 1, matched })
        } else {
          fakultasStats.get(fakultasName)!.count++
        }
        fakultasId = fakultasStats.get(fakultasName)?.matched?.id ?? null
      }

      parsedRows.push({
        row: i + 1,
        nama: namaRaw,
        nidn,
        email,
        noHp,
        prodiName,
        prodiId,
        fakultasName,
        fakultasId,
        jabatan: nc.jabatan,
        fromColumn: nc.header,
      })
    }
  }

  // Build matched/unmatched lists
  const matchedProdi: Array<{ excelName: string; dbProdi: { id: string; nama: string } }> = []
  const unmatchedProdi: Array<{ excelName: string; count: number }> = []
  for (const [excelName, stat] of prodiStats.entries()) {
    if (stat.matched) matchedProdi.push({ excelName, dbProdi: stat.matched })
    else unmatchedProdi.push({ excelName, count: stat.count })
  }

  const matchedFakultas: Array<{ excelName: string; dbFakultas: { id: string; nama: string } }> = []
  const unmatchedFakultas: Array<{ excelName: string; count: number }> = []
  for (const [excelName, stat] of fakultasStats.entries()) {
    if (stat.matched) matchedFakultas.push({ excelName, dbFakultas: stat.matched })
    else unmatchedFakultas.push({ excelName, count: stat.count })
  }

  return {
    totalRows: parsedRows.length,
    headers,
    nameColumns,
    detectedColumns: {
      nama: nameColumns[0]?.index ?? -1,
      nidn: colNidn,
      prodi: colProdi,
      email: colEmail,
      noHp: colNoHp,
      fakultas: colFakultas,
    },
    preview: parsedRows.slice(0, 30),
    matchedProdi,
    unmatchedProdi,
    matchedFakultas,
    unmatchedFakultas,
    availableProdi: dbProdi,
    availableFakultas: dbFakultas,
  }
}

/**
 * Cari dosen existing by NIDN (kalau ada) atau by nama exact (case-insensitive).
 * Dipakai untuk strategi UPSERT di import.
 */
export async function findExistingDosen(opts: { nidn?: string | null; nama: string }) {
  if (opts.nidn) {
    const byNidn = await db.dosen.findUnique({ where: { nidn: opts.nidn } })
    if (byNidn) return byNidn
  }
  // Fallback: cari by nama exact (case-insensitive)
  // SQLite: contains dengan mode insensitive default
  const byNama = await db.dosen.findFirst({
    where: { nama: { equals: opts.nama } },
  })
  return byNama
}
