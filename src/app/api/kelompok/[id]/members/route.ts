import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// POST - add member { mahasiswaId }
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.mahasiswaId) {
      return NextResponse.json({ error: 'mahasiswaId wajib diisi' }, { status: 400 })
    }

    // Verify kelompok & mahasiswa exist
    const [kel, mhs] = await Promise.all([
      db.kelompok.findUnique({ where: { id } }),
      db.mahasiswa.findUnique({ where: { id: body.mahasiswaId } }),
    ])
    if (!kel) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    if (!mhs) return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 400 })

    const created = await db.kelompokMember.create({
      data: {
        kelompokId: id,
        mahasiswaId: body.mahasiswaId,
      },
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/kelompok/:id/members]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Mahasiswa sudah terdaftar di kelompok ini' }, { status: 400 })
    }
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Referensi tidak valid' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal menambahkan anggota' }, { status: 500 })
  }
}

// DELETE - remove member using query param ?mahasiswaId=
export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const mahasiswaId = searchParams.get('mahasiswaId')?.trim() ?? ''

    if (!mahasiswaId) {
      return NextResponse.json({ error: 'Query mahasiswaId wajib diisi' }, { status: 400 })
    }

    const member = await db.kelompokMember.findUnique({
      where: {
        kelompokId_mahasiswaId: { kelompokId: id, mahasiswaId },
      },
    })
    if (!member) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan di kelompok ini' }, { status: 404 })
    }

    await db.kelompokMember.delete({
      where: { id: member.id },
    })

    return NextResponse.json({ success: true, message: 'Anggota berhasil dihapus dari kelompok' })
  } catch (e) {
    console.error('[DELETE /api/kelompok/:id/members]', e)
    return NextResponse.json({ error: 'Gagal menghapus anggota' }, { status: 500 })
  }
}
