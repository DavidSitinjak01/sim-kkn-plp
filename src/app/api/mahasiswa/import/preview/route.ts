import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

/**
 * POST /api/mahasiswa/import/preview
 *
 * Parse file Excel dan return preview data + prodi mapping suggestions
 * TANPA menyimpan ke database.
 *
 * Response:
 *   {
 *     totalRows: number,
 *     headers: string[],
 *     detectedColumns: { nama, nim, jk, prodi, noHp, alamat, foto },
 *     preview: [{ row, nim, nama, jenisKelamin, prodiName, alamat, noHp, fotoUrl }],
 *     unmatchedProdi: [{ prodiName, count }],  // prodi yang butuh manual mapping
 *     matchedProdi: [{ excelName, dbProdi: { id, nama } }],
 *     availableProdi: [{ id, nama }]
 *   }
 */

const PRODI_KEYWORD_MAP: Record<string, string[]> = {
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

function matchProdiByName(prodiInExcel: string, dbProdi: { id: string; nama: string }[]): { id: string; nama: string } | null {
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

function findCol(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toLowerCase()
    if (patterns.some((p) => h.includes(p))) return i
  }
  return -1
}

function normalizeJenisKelamin(raw: string): 'L' | 'P' | null {
  if (!raw) return null
  const s = raw.toLowerCase().trim()
  if (s.startsWith('l')) return 'L'
  if (s.startsWith('p')) return 'P'
  return null
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File Excel wajib diupload' }, { status: 400 })
    }

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      return NextResponse.json({ error: 'Sheet tidak ditemukan' }, { status: 400 })
    }
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false })
    if (rows.length < 2) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    }
    const headers = (rows[0] || []).map((h) => String(h || '').trim())

    const colNama = findCol(headers, ['nama lengkap', 'nama'])
    const colNim = findCol(headers, ['nim'])
    const colJK = findCol(headers, ['jenis kelamin', 'jk'])
    const colProdi = findCol(headers, ['program studi', 'prodi'])
    const colNoHp = findCol(headers, ['nomor wa', 'no wa', 'no hp', 'no. hp', 'nomor hp', 'nomor telepon', 'no telepon'])
    const colAlamat = findCol(headers, ['alamat asal', 'alamat'])
    const colFoto = findCol(headers, ['pasfoto', 'foto'])

    const dbProdi = await db.programStudi.findMany({ select: { id: true, nama: true } })

    const prodiStats = new Map<string, { count: number; matched: { id: string; nama: string } | null }>()
    const previewRows: Array<{
      row: number
      nim: string
      nama: string
      jenisKelamin: 'L' | 'P' | null
      prodiName: string
      alamat: string
      noHp: string
      fotoUrl: string | null
    }> = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || []
      const nim = String(row[colNim] || '').trim()
      const nama = String(row[colNama] || '').trim()
      if (!nim && !nama) continue

      const prodiName = colProdi !== -1 ? String(row[colProdi] || '').trim() : ''
      if (prodiName) {
        if (!prodiStats.has(prodiName)) {
          const matched = matchProdiByName(prodiName, dbProdi)
          prodiStats.set(prodiName, { count: 1, matched })
        } else {
          prodiStats.get(prodiName)!.count++
        }
      }

      previewRows.push({
        row: i + 1,
        nim,
        nama,
        jenisKelamin: colJK !== -1 ? normalizeJenisKelamin(String(row[colJK] || '')) : null,
        prodiName,
        alamat: colAlamat !== -1 ? String(row[colAlamat] || '').trim() : '',
        noHp: colNoHp !== -1 ? String(row[colNoHp] || '').trim() : '',
        fotoUrl: colFoto !== -1 ? String(row[colFoto] || '').trim() : null,
      })
    }

    const matchedProdi: Array<{ excelName: string; dbProdi: { id: string; nama: string } }> = []
    const unmatchedProdi: Array<{ excelName: string; count: number }> = []
    for (const [excelName, stat] of prodiStats.entries()) {
      if (stat.matched) {
        matchedProdi.push({ excelName, dbProdi: stat.matched })
      } else {
        unmatchedProdi.push({ excelName, count: stat.count })
      }
    }

    return NextResponse.json({
      totalRows: previewRows.length,
      headers,
      detectedColumns: {
        nama: colNama,
        nim: colNim,
        jk: colJK,
        prodi: colProdi,
        noHp: colNoHp,
        alamat: colAlamat,
        foto: colFoto,
      },
      preview: previewRows.slice(0, 20),
      matchedProdi,
      unmatchedProdi,
      availableProdi: dbProdi,
    })
  } catch (e: any) {
    console.error('[POST /api/mahasiswa/import/preview]', e)
    return NextResponse.json(
      { error: 'Gagal memproses file Excel: ' + (e?.message || 'unknown error') },
      { status: 500 },
    )
  }
}
