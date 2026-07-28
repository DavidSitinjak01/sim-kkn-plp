import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ GET - list all pendaftaran (admin only) ============
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')?.trim() // PENDING, APPROVED, REJECTED, IMPORTED
    const search = searchParams.get('search')?.trim() ?? ''

    const where: any = {}
    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'IMPORTED'].includes(status)) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { namaLengkap: { contains: search } },
        { nim: { contains: search } },
        { prodiNama: { contains: search } },
        { jurusan: { contains: search } },
      ]
    }

    const data = await db.pendaftaran.findMany({
      where,
      include: {
        prodi: { include: { fakultas: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/pendaftaran]', e)
    return NextResponse.json({ error: 'Gagal memuat data pendaftaran' }, { status: 500 })
  }
}

// ============ POST - public submit (no auth required) ============
// Accepts multipart/form-data with photo file (max 5MB)
// Fields: namaLengkap, nim, prodiId (optional), prodiNama, jurusan,
//         jenisKelamin (L/P), noWa, punyaMotor (true/false), alamat, foto (File)
export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const namaLengkap = (formData.get('namaLengkap') as string | null)?.trim() ?? ''
    const nim = (formData.get('nim') as string | null)?.trim() ?? ''
    const prodiId = (formData.get('prodiId') as string | null)?.trim() || null
    const prodiNama = (formData.get('prodiNama') as string | null)?.trim() ?? ''
    const jurusan = (formData.get('jurusan') as string | null)?.trim() ?? ''
    const jenisKelamin = (formData.get('jenisKelamin') as string | null)?.trim() ?? ''
    const noWa = (formData.get('noWa') as string | null)?.trim() ?? ''
    const punyaMotorVal = (formData.get('punyaMotor') as string | null)?.trim() ?? ''
    const alamat = (formData.get('alamat') as string | null)?.trim() ?? ''
    const fotoFile = formData.get('foto') as File | null

    // ============ Validation ============
    if (!namaLengkap) return NextResponse.json({ error: 'Nama lengkap wajib diisi' }, { status: 400 })
    if (!nim) return NextResponse.json({ error: 'NIM wajib diisi' }, { status: 400 })
    if (!prodiNama) return NextResponse.json({ error: 'Program Studi wajib diisi' }, { status: 400 })
    if (!jurusan) return NextResponse.json({ error: 'Jurusan wajib diisi' }, { status: 400 })
    if (!['L', 'P'].includes(jenisKelamin)) {
      return NextResponse.json({ error: 'Jenis kelamin tidak valid (harus L atau P)' }, { status: 400 })
    }
    if (!noWa) return NextResponse.json({ error: 'No WhatsApp aktif wajib diisi' }, { status: 400 })
    if (!['true', 'false'].includes(punyaMotorVal)) {
      return NextResponse.json({ error: 'Ketersediaan kendaraan motor wajib dipilih' }, { status: 400 })
    }
    if (!alamat) return NextResponse.json({ error: 'Alamat wajib diisi' }, { status: 400 })
    if (!fotoFile) return NextResponse.json({ error: 'Pass foto 3x4 wajib diunggah' }, { status: 400 })

    // Validate photo type & size (max 5MB)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(fotoFile.type)) {
      return NextResponse.json({ error: 'Format foto harus JPG, PNG, atau WebP' }, { status: 400 })
    }
    const MAX_SIZE = 5 * 1024 * 1024 // 5MB
    if (fotoFile.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran foto melebihi 5MB' }, { status: 400 })
    }

    // Check duplicate NIM (in pendaftaran AND mahasiswa)
    const existPendaftaran = await db.pendaftaran.findUnique({ where: { nim } })
    if (existPendaftaran) {
      return NextResponse.json({ error: 'NIM sudah pernah mendaftar' }, { status: 400 })
    }
    const existMahasiswa = await db.mahasiswa.findUnique({ where: { nim } })
    if (existMahasiswa) {
      return NextResponse.json({ error: 'NIM sudah terdaftar sebagai mahasiswa aktif' }, { status: 400 })
    }

    // Convert photo to base64 data URL for storage (works on both SQLite & Vercel/Postgres)
    const arrayBuffer = await fotoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const fotoDataUrl = `data:${fotoFile.type};base64,${base64}`

    // Validate prodiId if provided
    let validProdiId: string | null = null
    if (prodiId) {
      const prodi = await db.programStudi.findUnique({ where: { id: prodiId } })
      if (prodi) validProdiId = prodi.id
    }

    const created = await db.pendaftaran.create({
      data: {
        namaLengkap,
        nim,
        prodiId: validProdiId,
        prodiNama,
        jurusan,
        jenisKelamin,
        noWa,
        punyaMotor: punyaMotorVal === 'true',
        alamat,
        foto: fotoDataUrl,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ success: true, id: created.id, message: 'Pendaftaran berhasil dikirim' }, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/pendaftaran]', e)
    // Prisma unique constraint violation
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIM sudah pernah mendaftar' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal mengirim pendaftaran' }, { status: 500 })
  }
}
