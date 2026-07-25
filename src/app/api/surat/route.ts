import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_JENIS = ['TUGAS', 'PENGANTAR', 'IZIN', 'PENEMPATAN', 'BALASAN', 'SELESAI']
const VALID_STATUS = ['DRAFT', 'DIKIRIM', 'SELESAI']

// GET - list surat
// Support ?jenis=, ?status=, ?search= (nomor, perihal, pemohon)
// Ordered by tanggal desc
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const jenis = searchParams.get('jenis')?.trim().toUpperCase() ?? ''
    const status = searchParams.get('status')?.trim().toUpperCase() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    const where: Record<string, unknown> = {}
    if (jenis && VALID_JENIS.includes(jenis)) where.jenis = jenis
    if (status && VALID_STATUS.includes(status)) where.status = status
    if (search) {
      where.OR = [
        { nomor: { contains: search } },
        { perihal: { contains: search } },
        { pemohon: { contains: search } },
      ]
    }

    const data = await db.surat.findMany({
      where,
      orderBy: { tanggal: 'desc' },
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/surat]', e)
    return NextResponse.json({ error: 'Gagal memuat data surat' }, { status: 500 })
  }
}

// POST - create surat
// Auto-generate nomor if not provided: format {seq:03d}/KKN-PLP/{year}
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    const required = ['jenis', 'perihal', 'pemohon', 'tujuan']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    if (!VALID_JENIS.includes(body.jenis)) {
      return NextResponse.json({ error: 'Jenis surat tidak valid' }, { status: 400 })
    }

    const status = body.status ? String(body.status).toUpperCase() : 'DRAFT'
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid (DRAFT/DIKIRIM/SELESAI)' }, { status: 400 })
    }

    // Auto-generate nomor if not provided
    let nomor = String(body.nomor ?? '').trim()
    if (!nomor) {
      const year = new Date().getFullYear()
      const count = await db.surat.count()
      const seq = (count + 1).toString().padStart(3, '0')
      nomor = `${seq}/KKN-PLP/${year}`
    }

    // Parse tanggal (default now)
    let tanggal = new Date()
    if (body.tanggal) {
      const t = new Date(body.tanggal)
      if (!isNaN(t.getTime())) tanggal = t
    }

    const created = await db.surat.create({
      data: {
        nomor,
        jenis: body.jenis,
        perihal: String(body.perihal).trim(),
        tanggal,
        pemohon: String(body.pemohon).trim(),
        tujuan: String(body.tujuan).trim(),
        status,
        konten: String(body.konten ?? '').trim(),
        filePdf: body.filePdf?.trim() || null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('[POST /api/surat]', e)
    return NextResponse.json({ error: 'Gagal membuat surat' }, { status: 500 })
  }
}
