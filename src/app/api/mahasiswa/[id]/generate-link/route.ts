import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

type Params = { params: Promise<{ id: string }> }

function generateToken(): string {
  // 24 char hex token — cukup unik & tidak mudah ditebak
  return randomBytes(12).toString('hex')
}

// POST - generate / regenerate link absensi wajah unik untuk mahasiswa
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const mhs = await db.mahasiswa.findUnique({ where: { id } })
    if (!mhs) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }

    if (!mhs.fotoWajah) {
      return NextResponse.json({
        error: 'Mahasiswa belum mendaftarkan foto wajah. Silakan daftarkan wajah terlebih dahulu.',
      }, { status: 400 })
    }

    const token = generateToken()
    await db.mahasiswa.update({
      where: { id },
      data: { absensiToken: token },
    })

    return NextResponse.json({
      success: true,
      token,
      message: 'Link absensi wajah berhasil dibuat',
    })
  } catch (e: any) {
    console.error('[POST /api/mahasiswa/:id/generate-link]', e)
    return NextResponse.json({ error: 'Gagal membuat link absensi' }, { status: 500 })
  }
}

// DELETE - revoke link absensi (hapus token, simpan foto wajah)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const mhs = await db.mahasiswa.findUnique({ where: { id } })
    if (!mhs) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }
    await db.mahasiswa.update({
      where: { id },
      data: { absensiToken: null },
    })
    return NextResponse.json({ success: true, message: 'Link absensi dicabut' })
  } catch (e: any) {
    console.error('[DELETE /api/mahasiswa/:id/generate-link]', e)
    return NextResponse.json({ error: 'Gagal mencabut link' }, { status: 500 })
  }
}
