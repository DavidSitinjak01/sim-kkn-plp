import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// POST - daftarkan / perbarui foto wajah mahasiswa (superadmin side)
// Body: { fotoWajah: "<base64 data URL>" }
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const fotoWajah = String(body?.fotoWajah ?? '').trim()

    if (!fotoWajah) {
      return NextResponse.json({ error: 'Foto wajah wajib diisi' }, { status: 400 })
    }

    // Validasi: harus data URL PNG/JPEG
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(fotoWajah)) {
      return NextResponse.json({ error: 'Format foto tidak valid (harus PNG/JPEG/WebP base64)' }, { status: 400 })
    }

    // Batasi ukuran ~2.5MB (base64)
    if (fotoWajah.length > 3_500_000) {
      return NextResponse.json({ error: 'Ukuran foto terlalu besar (maks ~2.5MB)' }, { status: 400 })
    }

    const mhs = await db.mahasiswa.findUnique({ where: { id } })
    if (!mhs) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }

    const updated = await db.mahasiswa.update({
      where: { id },
      data: { fotoWajah },
      select: { id: true, nama: true, fotoWajah: true },
    })

    return NextResponse.json({
      success: true,
      message: `Foto wajah ${updated.nama} berhasil didaftarkan`,
      data: updated,
    })
  } catch (e: any) {
    console.error('[POST /api/mahasiswa/:id/daftar-wajah]', e)
    return NextResponse.json({ error: 'Gagal mendaftarkan foto wajah' }, { status: 500 })
  }
}

// DELETE - hapus foto wajah mahasiswa
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const mhs = await db.mahasiswa.findUnique({ where: { id } })
    if (!mhs) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }
    await db.mahasiswa.update({
      where: { id },
      data: { fotoWajah: null, absensiToken: null },
    })
    return NextResponse.json({ success: true, message: 'Foto wajah & link absensi dihapus' })
  } catch (e: any) {
    console.error('[DELETE /api/mahasiswa/:id/daftar-wajah]', e)
    return NextResponse.json({ error: 'Gagal menghapus foto wajah' }, { status: 500 })
  }
}
