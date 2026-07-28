import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseFormFields,
  parseResponseData,
  type FormFieldDef,
} from '@/lib/form-field-def'

// ============ GET - list responses (admin) ============
// Query params:
//   formId?  - filter by form
//   status?  - PENDING / APPROVED / REJECTED / IMPORTED
//   search?  - matches parsed data.namaLengkap / data.nim (loose)
// Returns responses with their form (form.fields parsed), ordered by createdAt desc.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const formId = searchParams.get('formId')?.trim() || null
    const status = searchParams.get('status')?.trim() || null
    const search = searchParams.get('search')?.trim() ?? ''

    const where: any = {}
    if (formId) where.formId = formId
    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'IMPORTED'].includes(status)) {
      where.status = status
    }
    // search filter applied in JS after fetch (SQLite can't JSON-query)
    if (search) {
      where.OR = [
        { data: { contains: search } },
      ]
    }

    const rows = await db.pendaftaranResponse.findMany({
      where,
      include: { form: true },
      orderBy: { createdAt: 'desc' },
    })

    const result = rows
      .map((r) => {
        const fields: FormFieldDef[] = parseFormFields(r.form?.fields)
        const data = parseResponseData(r.data)
        return {
          id: r.id,
          formId: r.formId,
          form: r.form
            ? {
                id: r.form.id,
                nama: r.form.nama,
                deskripsi: r.form.deskripsi,
                fields,
              }
            : null,
          data,
          status: r.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'IMPORTED',
          catatan: r.catatan,
          importedMahasiswaId: r.importedMahasiswaId,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }
      })
      .filter((r) => {
        if (!search) return true
        const s = search.toLowerCase()
        const nama = (r.data?.namaLengkap || '').toLowerCase()
        const nim = (r.data?.nim || '').toLowerCase()
        const prodi = (r.data?.prodiNama || '').toLowerCase()
        return nama.includes(s) || nim.includes(s) || prodi.includes(s)
      })

    return NextResponse.json(result)
  } catch (e) {
    console.error('[GET /api/pendaftaran-responses]', e)
    return NextResponse.json({ error: 'Gagal memuat pendaftaran masuk' }, { status: 500 })
  }
}
