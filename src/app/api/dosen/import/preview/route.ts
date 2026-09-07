import { NextResponse } from 'next/server'
import { parseDosenExcel } from '@/lib/dosen-import'

/**
 * POST /api/dosen/import/preview
 *
 * Parse file Excel dosen → return preview + auto-matched prodi/fakultas.
 * TIDAK menyimpan ke DB.
 *
 * Body (multipart/form-data):
 *   - file: Excel file (.xlsx, .xls, .csv)
 *
 * Response: PreviewResult (lihat src/lib/dosen-import.ts)
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
    const result = await parseDosenExcel(file)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[POST /api/dosen/import/preview]', e)
    return NextResponse.json(
      { error: e?.message || 'Gagal memproses file Excel' },
      { status: 500 },
    )
  }
}
