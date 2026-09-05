import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface Params {
  params: Promise<{ id: string }>
}

// GET - single link penting by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const link = await db.linkPenting.findUnique({ where: { id } })
    if (!link) {
      return NextResponse.json({ error: 'Link tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(link)
  } catch (e) {
    console.error('[GET /api/link-penting/[id]]', e)
    return NextResponse.json({ error: 'Gagal memuat link' }, { status: 500 })
  }
}

// PUT - update link penting
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.linkPenting.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Link tidak ditemukan' }, { status: 404 })
    }

    // Validate required fields if provided
    if (body.judul !== undefined && String(body.judul).trim() === '') {
      return NextResponse.json({ error: 'Judul tidak boleh kosong' }, { status: 400 })
    }
    if (body.url !== undefined && String(body.url).trim() === '') {
      return NextResponse.json({ error: 'URL tidak boleh kosong' }, { status: 400 })
    }

    // Normalize & validate URL if provided
    let url: string | undefined
    if (body.url !== undefined) {
      url = String(body.url).trim()
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url
      }
      try {
        new URL(url)
      } catch {
        return NextResponse.json({ error: 'URL tidak valid' }, { status: 400 })
      }
    }

    let status: string | undefined
    if (body.status !== undefined) {
      status = String(body.status).toUpperCase()
      if (status !== 'AKTIF' && status !== 'NONAKTIF') {
        return NextResponse.json({ error: 'Status tidak valid (AKTIF/NONAKTIF)' }, { status: 400 })
      }
    }

    const updated = await db.linkPenting.update({
      where: { id },
      data: {
        ...(body.judul !== undefined && { judul: String(body.judul).trim() }),
        ...(url !== undefined && { url }),
        ...(body.deskripsi !== undefined && { deskripsi: body.deskripsi ? String(body.deskripsi).trim() : null }),
        ...(body.kategori !== undefined && { kategori: String(body.kategori).trim() || 'Umum' }),
        ...(body.icon !== undefined && { icon: body.icon ? String(body.icon).trim() : null }),
        ...(body.urutan !== undefined && Number.isFinite(Number(body.urutan)) && { urutan: Number(body.urutan) }),
        ...(status !== undefined && { status }),
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PUT /api/link-penting/[id]]', e)
    return NextResponse.json({ error: 'Gagal memperbarui link' }, { status: 500 })
  }
}

// DELETE - remove link penting
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.linkPenting.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Link tidak ditemukan' }, { status: 404 })
    }
    await db.linkPenting.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[DELETE /api/link-penting/[id]]', e)
    return NextResponse.json({ error: 'Gagal menghapus link' }, { status: 500 })
  }
}
