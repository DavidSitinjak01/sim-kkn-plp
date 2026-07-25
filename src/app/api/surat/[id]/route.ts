import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_JENIS = ['TUGAS', 'PENGANTAR', 'IZIN', 'PENEMPATAN', 'BALASAN', 'SELESAI']
const VALID_STATUS = ['DRAFT', 'DIKIRIM', 'SELESAI']

type Params = { params: Promise<{ id: string }> }

// GET - single surat by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.surat.findUnique({ where: { id } })
    if (!data) {
      return NextResponse.json({ error: 'Surat tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/surat/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat surat' }, { status: 500 })
  }
}

// PUT - update surat
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.surat.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Surat tidak ditemukan' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.jenis !== undefined) {
      if (!VALID_JENIS.includes(body.jenis)) {
        return NextResponse.json({ error: 'Jenis surat tidak valid' }, { status: 400 })
      }
      updateData.jenis = body.jenis
    }

    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      }
      updateData.status = body.status
    }

    if (body.nomor !== undefined) updateData.nomor = String(body.nomor).trim()
    if (body.perihal !== undefined) updateData.perihal = String(body.perihal).trim()
    if (body.pemohon !== undefined) updateData.pemohon = String(body.pemohon).trim()
    if (body.tujuan !== undefined) updateData.tujuan = String(body.tujuan).trim()
    if (body.konten !== undefined) updateData.konten = String(body.konten).trim()
    if (body.filePdf !== undefined) updateData.filePdf = body.filePdf ? String(body.filePdf).trim() : null

    if (body.tanggal !== undefined) {
      const t = new Date(body.tanggal)
      if (isNaN(t.getTime())) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
      }
      updateData.tanggal = t
    }

    const updated = await db.surat.update({ where: { id }, data: updateData })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PUT /api/surat/:id]', e)
    return NextResponse.json({ error: 'Gagal memperbarui surat' }, { status: 500 })
  }
}

// DELETE - remove surat
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.surat.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Surat tidak ditemukan' }, { status: 404 })
    }
    await db.surat.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Surat berhasil dihapus' })
  } catch (e) {
    console.error('[DELETE /api/surat/:id]', e)
    return NextResponse.json({ error: 'Gagal menghapus surat' }, { status: 500 })
  }
}
