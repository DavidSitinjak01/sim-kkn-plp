import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ POST /api/mahasiswa/[id]/face ============
// Register face descriptor for a mahasiswa.
// Body: { descriptor: number[] (128 floats) }
// Returns: { success: true, mahasiswa }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.descriptor || !Array.isArray(body.descriptor) || body.descriptor.length !== 128) {
      return NextResponse.json(
        { error: 'Descriptor wajah tidak valid (harus array 128 angka)' },
        { status: 400 }
      )
    }

    // Validate all are numbers
    const descriptor = body.descriptor.map((n: unknown) => Number(n))
    if (descriptor.some((n: number) => Number.isNaN(n))) {
      return NextResponse.json(
        { error: 'Descriptor mengandung nilai non-numerik' },
        { status: 400 }
      )
    }

    // Check mahasiswa exists
    const mhs = await db.mahasiswa.findUnique({ where: { id } })
    if (!mhs) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }

    // Save descriptor as JSON string
    const updated = await db.mahasiswa.update({
      where: { id },
      data: {
        faceDescriptor: JSON.stringify(descriptor),
        faceRegisteredAt: new Date(),
      },
      select: {
        id: true,
        nim: true,
        nama: true,
        faceDescriptor: true,
        faceRegisteredAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Wajah ${mhs.nama} berhasil terdaftar`,
      mahasiswa: updated,
    })
  } catch (e) {
    console.error('[POST /api/mahasiswa/[id]/face]', e)
    return NextResponse.json({ error: 'Gagal mendaftarkan wajah' }, { status: 500 })
  }
}

// ============ DELETE /api/mahasiswa/[id]/face ============
// Clear face descriptor for a mahasiswa.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const mhs = await db.mahasiswa.findUnique({ where: { id } })
    if (!mhs) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }

    await db.mahasiswa.update({
      where: { id },
      data: {
        faceDescriptor: null,
        faceRegisteredAt: null,
      },
    })

    return NextResponse.json({ success: true, message: 'Data wajah berhasil dihapus' })
  } catch (e) {
    console.error('[DELETE /api/mahasiswa/[id]/face]', e)
    return NextResponse.json({ error: 'Gagal menghapus data wajah' }, { status: 500 })
  }
}

// ============ GET /api/mahasiswa/[id]/face ============
// Check if mahasiswa has face registered.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const mhs = await db.mahasiswa.findUnique({
      where: { id },
      select: {
        id: true,
        nim: true,
        nama: true,
        faceDescriptor: true,
        faceRegisteredAt: true,
      },
    })

    if (!mhs) {
      return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      registered: !!mhs.faceDescriptor,
      registeredAt: mhs.faceRegisteredAt,
      mahasiswa: { id: mhs.id, nim: mhs.nim, nama: mhs.nama },
    })
  } catch (e) {
    console.error('[GET /api/mahasiswa/[id]/face]', e)
    return NextResponse.json({ error: 'Gagal memeriksa status wajah' }, { status: 500 })
  }
}
