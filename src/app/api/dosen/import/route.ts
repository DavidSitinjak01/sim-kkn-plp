import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import {
  findAllNameCols,
  findCol,
  KOLOM_PATTERNS,
  matchProdiByName,
  matchFakultasByName,
  findExistingDosen,
} from '@/lib/dosen-import'

/**
 * POST /api/dosen/import
 *
 * Import dosen dari Excel. Hanya field `nama` yang wajib — lainnya opsional.
 *
 * Body (multipart/form-data):
 *   - file: Excel file (.xlsx, .xls, .csv)
 *   - jabatanOverride (opsional): jabatan default untuk semua dosen
 *       kalau tidak ada kolom nama spesifik (mis. "Koordinator Lapangan").
 *       Default: "Dosen Pendamping".
 *   - prodiMapping (opsional, JSON): { "<nama prodi di excel>": "<prodiId>" }
 *   - fakultasMapping (opsional, JSON): { "<nama fakultas di excel>": "<fakultasId>" }
 *   - skipDuplicate (opsional, "true"/"false", default true):
 *       true → skip dosen yang sudah ada (by NIDN atau nama exact)
 *       false → tetap error kalau NIDN konflik
 *
 * Strategi UPSERT:
 *   - Cari existing by NIDN (kalau ada NIDN), fallback by nama exact (case-insensitive)
 *   - Kalau ada → UPDATE (merge field yang baru, tidak overwrite yang kosong)
 *   - Kalau tidak ada → CREATE baru
 *
 * Response:
 *   { success, imported, updated, skipped, errors, totalRows }
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File Excel wajib diupload' }, { status: 400 })
    }
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return NextResponse.json({ error: 'File harus berformat .xlsx, .xls, atau .csv' }, { status: 400 })
    }

    const jabatanOverride = (formData.get('jabatanOverride') as string | null)?.trim() || ''
    const skipDuplicate = (formData.get('skipDuplicate') as string | null) !== 'false'

    let prodiMapping: Record<string, string> = {}
    let fakultasMapping: Record<string, string> = {}
    try {
      const pm = formData.get('prodiMapping') as string | null
      if (pm) prodiMapping = JSON.parse(pm)
      const fm = formData.get('fakultasMapping') as string | null
      if (fm) fakultasMapping = JSON.parse(fm)
    } catch {
      return NextResponse.json({ error: 'Format prodiMapping/fakultasMapping tidak valid JSON' }, { status: 400 })
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

    // Cari semua kolom nama (bisa 1 atau lebih)
    const nameColumns = findAllNameCols(headers)
    if (nameColumns.length === 0) {
      return NextResponse.json(
        { error: `Tidak ditemukan kolom nama. Pastikan ada kolom "Nama Dosen", "Nama", "Dosen Pendamping", atau "Koordinator Lapangan". Kolom yang terdeteksi: ${headers.join(', ')}` },
        { status: 400 },
      )
    }

    // Cari kolom optional (exclude name columns)
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
    const colJabatan = findColExcludeNames(KOLOM_PATTERNS.jabatan)

    // Fetch master data
    const [dbProdi, dbFakultas] = await Promise.all([
      db.programStudi.findMany({ select: { id: true, nama: true } }),
      db.fakultas.findMany({ select: { id: true, nama: true } }),
    ])

    // ── Process each row ────────────────────────────────────────────────
    const errors: { row: number; nama: string; error: string }[] = []
    let imported = 0
    let updated = 0
    let skipped = 0
    let placeholderUsed = 0 // count rows that needed placeholder fallback

    // Track baris kosong berurutan untuk stop di section notes
    let consecutiveEmptyRows = 0
    const MAX_CONSECUTIVE_EMPTY = 2

    // Helper: cek marker notes (CATATAN:, FORMAT ALTERNATIF, dll)
    const isNotesMarkerRow = (row: string[]): boolean => {
      if (!row || row.length === 0) return false
      const firstCell = String(row[0] || '').trim().toLowerCase()
      if (!firstCell) return false
      if (/^catatan:?$/i.test(firstCell)) return true
      if (firstCell.startsWith('format alternatif')) return true
      if (/^note:?$/i.test(firstCell)) return true
      if (/^keterangan:?$/i.test(firstCell)) return true
      return false
    }

    // Detect old DB schema (NOT NULL columns) & cache placeholder fakultasId
    // Kalau P2011 terjadi di create, kita pakai placeholder & retry.
    let cachedFirstFakultasId: string | null | undefined = undefined // undefined = belum di-cache

    const tryCreateDosen = async (data: {
      nidn: string | null
      nama: string
      email: string | null
      noHp: string | null
      fakultasId: string | null
      prodiId: string | null
      jabatan: string
    }): Promise<{ ok: boolean; error?: string; placeholderUsed?: boolean }> => {
      try {
        await db.dosen.create({
          data: {
            nidn: data.nidn,
            nama: data.nama,
            email: data.email,
            noHp: data.noHp,
            fakultasId: data.fakultasId,
            prodiId: data.prodiId,
            jabatan: data.jabatan,
            status: 'AKTIF',
          },
        })
        return { ok: true }
      } catch (e: any) {
        // P2011 = null constraint violation → production DB masih NOT NULL
        // untuk kolom yang sudah optional di schema. Retry dengan placeholder.
        if (e?.code === 'P2011') {
          // Cache first fakultas ID untuk placeholder (kalau belum di-cache)
          if (cachedFirstFakultasId === undefined) {
            const firstFak = await db.fakultas.findFirst({ select: { id: true } })
            cachedFirstFakultasId = firstFak?.id ?? null
          }
          if (!cachedFirstFakultasId) {
            return { ok: false, error: 'Tidak ada fakultas di database. Tambahkan minimal 1 fakultas.' }
          }

          // Build retry data dengan placeholder untuk SEMUA field opsional yang kosong.
          // (Tidak hanya yang di violatedFields — supaya kalau DB punya multi NOT NULL
          // constraints, semua keisi sekaligus dalam 1 retry.)
          const retryData: any = { ...data }
          if (!retryData.nidn) {
            retryData.nidn = `TMP${Date.now()}${Math.floor(Math.random() * 10000)}`
          }
          if (!retryData.email) {
            const slug = (retryData.nidn || data.nama.toLowerCase().replace(/[^a-z0-9]+/g, '.')).slice(0, 30)
            retryData.email = `${slug}@placeholder.ac.id`
          }
          if (!retryData.noHp) {
            retryData.noHp = '-'
          }
          if (!retryData.fakultasId) {
            retryData.fakultasId = cachedFirstFakultasId
          }

          try {
            await db.dosen.create({
              data: {
                nidn: retryData.nidn,
                nama: retryData.nama,
                email: retryData.email,
                noHp: retryData.noHp,
                fakultasId: retryData.fakultasId,
                prodiId: retryData.prodiId,
                jabatan: retryData.jabatan,
                status: 'AKTIF',
              },
            })
            return { ok: true, placeholderUsed: true }
          } catch (e2: any) {
            // P2002 = unique violation. Coba lagi dengan NIDN/email yang lebih random.
            if (e2?.code === 'P2002') {
              const slug = (data.nama.toLowerCase().replace(/[^a-z0-9]+/g, '.')).slice(0, 20)
              retryData.nidn = `TMP${Date.now()}${Math.floor(Math.random() * 99999)}`
              retryData.email = `${slug}.${Date.now()}@placeholder.ac.id`
              try {
                await db.dosen.create({
                  data: {
                    nidn: retryData.nidn,
                    nama: retryData.nama,
                    email: retryData.email,
                    noHp: retryData.noHp,
                    fakultasId: retryData.fakultasId,
                    prodiId: retryData.prodiId,
                    jabatan: retryData.jabatan,
                    status: 'AKTIF',
                  },
                })
                return { ok: true, placeholderUsed: true }
              } catch (e3: any) {
                return { ok: false, error: e3?.message || `Code: ${e3?.code}` }
              }
            }
            return { ok: false, error: e2?.message || `Code: ${e2?.code}` }
          }
        }
        // P2021 = table not exist
        if (e?.code === 'P2021') {
          return { ok: false, error: 'Tabel belum tersedia di DB. Jalankan `prisma db push` di production.' }
        }
        return { ok: false, error: e?.message || 'unknown error' }
      }
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || []

      // Stop di section notes
      if (isNotesMarkerRow(row as string[])) break

      let rowHadData = false
      // Untuk setiap kolom nama yang terdeteksi
      for (const nc of nameColumns) {
        const namaRaw = String(row[nc.index] || '').trim()
        if (!namaRaw) continue // skip cell kosong

        rowHadData = true

        const nidn = colNidn !== -1 ? String(row[colNidn] || '').trim() || null : null
        const email = colEmail !== -1 ? String(row[colEmail] || '').trim() || null : null
        const noHp = colNoHp !== -1 ? String(row[colNoHp] || '').trim() || null : null
        const prodiName = colProdi !== -1 ? String(row[colProdi] || '').trim() : ''
        const fakultasName = colFakultas !== -1 ? String(row[colFakultas] || '').trim() : ''

        // Jabatan: prioritas kolom "Jabatan" eksplisit > dari header kolom nama > override user.
        const jabatanFromCol = colJabatan !== -1 ? String(row[colJabatan] || '').trim() : ''
        let jabatan = jabatanFromCol || nc.jabatan
        if (!jabatanFromCol && jabatanOverride && nameColumns.length === 1) {
          jabatan = jabatanOverride
        }

        // Resolve prodi
        let prodiId: string | null = null
        if (prodiName) {
          prodiId = prodiMapping[prodiName] || matchProdiByName(prodiName, dbProdi)?.id || null
        }

        // Resolve fakultas
        let fakultasId: string | null = null
        if (fakultasName) {
          fakultasId = fakultasMapping[fakultasName] || matchFakultasByName(fakultasName, dbFakultas)?.id || null
        }

        try {
          const existing = await findExistingDosen({ nidn, nama: namaRaw })

          if (existing) {
            if (skipDuplicate) {
              // Update field yang baru (merge — jangan overwrite field kosong dengan null)
              const updateData: any = {}
              if (namaRaw && namaRaw !== existing.nama) updateData.nama = namaRaw
              if (nidn && !existing.nidn) updateData.nidn = nidn
              if (email && !existing.email) updateData.email = email.toLowerCase()
              if (noHp && !existing.noHp) updateData.noHp = noHp
              if (fakultasId && !existing.fakultasId) updateData.fakultasId = fakultasId
              if (prodiId && !existing.prodiId) updateData.prodiId = prodiId
              if (jabatan && existing.jabatan !== jabatan) updateData.jabatan = jabatan

              if (Object.keys(updateData).length > 0) {
                await db.dosen.update({ where: { id: existing.id }, data: updateData })
                updated++
              } else {
                skipped++
              }
            } else {
              errors.push({ row: i + 1, nama: namaRaw, error: `Dosen sudah ada: "${existing.nama}" (NIDN: ${existing.nidn ?? '-'})` })
            }
          } else {
            // Create baru — pakai tryCreateDosen yang resilient terhadap old DB schema
            const result = await tryCreateDosen({
              nidn,
              nama: namaRaw,
              email: email?.toLowerCase() || null,
              noHp: noHp || null,
              fakultasId: fakultasId || null,
              prodiId: prodiId || null,
              jabatan,
            })
            if (result.ok) {
              imported++
              if (result.placeholderUsed) placeholderUsed++
            } else {
              errors.push({ row: i + 1, nama: namaRaw, error: result.error || 'Gagal create' })
            }
          }
        } catch (e: any) {
          if (e?.code === 'P2002') {
            errors.push({ row: i + 1, nama: namaRaw, error: `NIDN/email sudah digunakan dosen lain` })
          } else {
            errors.push({ row: i + 1, nama: namaRaw, error: e?.message || 'unknown error' })
          }
        }
      }

      // Update counter baris kosong berurutan
      if (rowHadData) {
        consecutiveEmptyRows = 0
      } else {
        consecutiveEmptyRows++
        if (consecutiveEmptyRows >= MAX_CONSECUTIVE_EMPTY) break
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      errors,
      totalRows: rows.length - 1,
      placeholderUsed, // info: berapa row yang pakai placeholder fallback
    })
  } catch (e: any) {
    console.error('[POST /api/dosen/import]', e)
    return NextResponse.json(
      { error: e?.message || 'Gagal mengimpor file Excel' },
      { status: 500 },
    )
  }
}
