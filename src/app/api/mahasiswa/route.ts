import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list all mahasiswa with prodi + fakultas
// Query params:
//   - search: filter by nim/nama/email
//   - withKelompok: "true" → include latest KelompokMember + kelompok (with desa & dosen.fakultas)
//                   Used by ID Card printer to show Kelompok KKN, Lokasi, Dosen Pembimbing.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() ?? ''
    const withKelompok = searchParams.get('withKelompok') === 'true'

    const where = search
      ? {
          OR: [
            { nim: { contains: search } },
            { nama: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}

    const data = await db.mahasiswa.findMany({
      where,
      include: {
        prodi: { include: { fakultas: true } },
        ...(withKelompok
          ? {
              kelompokMember: {
                include: {
                  kelompok: {
                    include: {
                      desa: true,
                      dosen: { include: { fakultas: true, prodi: true } },
                    },
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: 1, // latest assignment only
              },
            }
          : {}),
      },
      orderBy: [{ angkatan: 'desc' }, { nama: 'asc' }],
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/mahasiswa]', e)
    return NextResponse.json({ error: 'Gagal memuat data mahasiswa' }, { status: 500 })
  }
}

// POST - create new mahasiswa
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    const required = ['nim', 'nama', 'jenisKelamin', 'tempatLahir', 'tanggalLahir', 'alamat', 'noHp', 'email', 'prodiId', 'semester', 'angkatan']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    if (!['L', 'P'].includes(body.jenisKelamin)) {
      return NextResponse.json({ error: 'Jenis kelamin harus L atau P' }, { status: 400 })
    }

    const validStatus = ['AKTIF', 'LULUS', 'CUTI', 'DO']
    const status = body.status ?? 'AKTIF'
    if (!validStatus.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    // Check duplicate NIM
    const exist = await db.mahasiswa.findUnique({ where: { nim: body.nim } })
    if (exist) {
      return NextResponse.json({ error: 'NIM sudah terdaftar' }, { status: 400 })
    }

    const created = await db.mahasiswa.create({
      data: {
        nim: body.nim.trim(),
        nama: body.nama.trim(),
        jenisKelamin: body.jenisKelamin,
        tempatLahir: body.tempatLahir.trim(),
        tanggalLahir: new Date(body.tanggalLahir),
        alamat: body.alamat.trim(),
        noHp: body.noHp.trim(),
        email: body.email.trim().toLowerCase(),
        prodiId: body.prodiId,
        semester: Number(body.semester),
        angkatan: Number(body.angkatan),
        status,
        foto: body.foto?.trim() || null,
      },
      include: { prodi: { include: { fakultas: true } } },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/mahasiswa]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIM atau email sudah terdaftar' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal membuat mahasiswa' }, { status: 500 })
  }
}
