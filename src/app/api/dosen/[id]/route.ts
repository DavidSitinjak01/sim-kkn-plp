import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// GET - single dosen by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.dosen.findUnique({
      where: { id },
      include: { fakultas: true, prodi: true },
    })
    if (!data) {
      return NextResponse.json({ error: 'Dosen tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/dosen/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat dosen' }, { status: 500 })
  }
}

// PUT - update dosen
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.dosen.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Dosen tidak ditemukan' }, { status: 404 })
    }

    const validStatus = ['AKTIF', 'NONAKTIF']
    if (body.status && !validStatus.includes(body.status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    if (body.nidn && body.nidn !== existing.nidn) {
      const dup = await db.dosen.findUnique({ where: { nidn: body.nidn } })
      if (dup) {
        return NextResponse.json({ error: 'NIDN sudah digunakan' }, { status: 400 })
      }
    }

    const updated = await db.dosen.update({
      where: { id },
      data: {
        ...(body.nidn !== undefined && { nidn: body.nidn.trim() }),
        ...(body.nama !== undefined && { nama: body.nama.trim() }),
        ...(body.email !== undefined && { email: body.email.trim().toLowerCase() }),
        ...(body.noHp !== undefined && { noHp: body.noHp.trim() }),
        ...(body.fakultasId !== undefined && { fakultasId: body.fakultasId }),
        ...(body.prodiId !== undefined && { prodiId: body.prodiId || null }),
        ...(body.jabatan !== undefined && { jabatan: body.jabatan.trim() }),
        ...(body.keahlian !== undefined && { keahlian: body.keahlian?.trim() || null }),
        ...(body.foto !== undefined && { foto: body.foto?.trim() || null }),
        ...(body.status !== undefined && { status: body.status }),
      },
      include: { fakultas: true, prodi: true },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('[PUT /api/dosen/:id]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIDN atau email sudah terdaftar' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui dosen' }, { status: 500 })
  }
}

// DELETE - remove dosen
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.dosen.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Dosen tidak ditemukan' }, { status: 404 })
    }

    await db.dosen.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Dosen berhasil dihapus' })
  } catch (e: any) {
    console.error('[DELETE /api/dosen/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Dosen tidak dapat dihapus karena masih memiliki data terkait (kelompok/penilaian)' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Gagal menghapus dosen' }, { status: 500 })
  }
}
