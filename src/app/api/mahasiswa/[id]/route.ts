import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// GET - single mahasiswa by id
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.mahasiswa.findUnique({
      where: { id },
      include: { prodi: { include: { fakultas: true } } },
    })
    if (!data) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/mahasiswa/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat mahasiswa' }, { status: 500 })
  }
}

// PUT - update mahasiswa
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.mahasiswa.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }

    if (body.jenisKelamin && !['L', 'P'].includes(body.jenisKelamin)) {
      return NextResponse.json({ error: 'Jenis kelamin harus L atau P' }, { status: 400 })
    }

    const validStatus = ['AKTIF', 'LULUS', 'CUTI', 'DO']
    if (body.status && !validStatus.includes(body.status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    // If NIM changed, check uniqueness
    if (body.nim && body.nim !== existing.nim) {
      const dup = await db.mahasiswa.findUnique({ where: { nim: body.nim } })
      if (dup) {
        return NextResponse.json({ error: 'NIM sudah digunakan' }, { status: 400 })
      }
    }

    const updated = await db.mahasiswa.update({
      where: { id },
      data: {
        ...(body.nim !== undefined && { nim: body.nim.trim() }),
        ...(body.nama !== undefined && { nama: body.nama.trim() }),
        ...(body.jenisKelamin !== undefined && { jenisKelamin: body.jenisKelamin }),
        ...(body.tempatLahir !== undefined && { tempatLahir: body.tempatLahir.trim() }),
        ...(body.tanggalLahir !== undefined && { tanggalLahir: new Date(body.tanggalLahir) }),
        ...(body.alamat !== undefined && { alamat: body.alamat.trim() }),
        ...(body.noHp !== undefined && { noHp: body.noHp.trim() }),
        ...(body.email !== undefined && { email: body.email.trim().toLowerCase() }),
        ...(body.prodiId !== undefined && { prodiId: body.prodiId }),
        ...(body.semester !== undefined && { semester: Number(body.semester) }),
        ...(body.angkatan !== undefined && { angkatan: Number(body.angkatan) }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.foto !== undefined && { foto: body.foto?.trim() || null }),
      },
      include: { prodi: { include: { fakultas: true } } },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('[PUT /api/mahasiswa/:id]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIM atau email sudah terdaftar' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui mahasiswa' }, { status: 500 })
  }
}

// DELETE - remove mahasiswa
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.mahasiswa.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }

    await db.mahasiswa.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Mahasiswa berhasil dihapus' })
  } catch (e: any) {
    console.error('[DELETE /api/mahasiswa/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Mahasiswa tidak dapat dihapus karena masih memiliki data terkait (absensi/penilaian/kelompok)' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Gagal menghapus mahasiswa' }, { status: 500 })
  }
}
