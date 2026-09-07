import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list all dosen with fakultas + prodi
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() ?? ''

    const where = search
      ? {
          OR: [
            { nidn: { contains: search } },
            { nama: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}

    const data = await db.dosen.findMany({
      where,
      include: {
        fakultas: true,
        prodi: true,
      },
      orderBy: { nama: 'asc' },
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/dosen]', e)
    return NextResponse.json({ error: 'Gagal memuat data dosen' }, { status: 500 })
  }
}

// POST - create new dosen
// Field wajib: nama saja. nidn, email, noHp, fakultasId, prodiId, jabatan — opsional.
// (Sesuai permintaan user: "yang penting ada nama itu sudah mewakili".)
export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body.nama || String(body.nama).trim() === '') {
      return NextResponse.json({ error: 'Field nama wajib diisi' }, { status: 400 })
    }

    const validStatus = ['AKTIF', 'NONAKTIF']
    const status = body.status ?? 'AKTIF'
    if (!validStatus.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    // NIDN kalau diisi, harus unik
    const nidn = body.nidn ? String(body.nidn).trim() : null
    if (nidn) {
      const exist = await db.dosen.findUnique({ where: { nidn } })
      if (exist) {
        return NextResponse.json({ error: `NIDN "${nidn}" sudah terdaftar di dosen "${exist.nama}"` }, { status: 400 })
      }
    }

    // Jabatan default kalau kosong
    const jabatan = body.jabatan && String(body.jabatan).trim() !== ''
      ? String(body.jabatan).trim()
      : 'Dosen Pendamping'

    const created = await db.dosen.create({
      data: {
        nidn,
        nama: String(body.nama).trim(),
        email: body.email ? String(body.email).trim().toLowerCase() : null,
        noHp: body.noHp ? String(body.noHp).trim() : null,
        fakultasId: body.fakultasId || null,
        prodiId: body.prodiId || null,
        jabatan,
        keahlian: body.keahlian?.trim() || null,
        foto: body.foto?.trim() || null,
        status,
      },
      include: { fakultas: true, prodi: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/dosen]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIDN atau email sudah terdaftar' }, { status: 400 })
    }
    // P2011 = Null constraint violation (kalau production DB belum di-migrate
    // dan masih punya nidn NOT NULL, sementara user kirim nidn kosong)
    if (e?.code === 'P2011') {
      const field = Array.isArray(e?.meta?.target) ? e.meta.target.join(', ') : 'field'
      return NextResponse.json(
        {
          error: `Production DB belum di-migrate. Field "${field}" masih NOT NULL. Jalankan \`prisma db push\` pada production Neon DB untuk mengaktifkan fitur field opsional.`,
          code: 'SCHEMA_NOT_MIGRATED',
          field,
        },
        { status: 503 },
      )
    }
    // P2021 = tabel belum ada di DB (SekolahProdiKuota / DesaProdiKuota belum di-migrate)
    if (e?.code === 'P2021') {
      return NextResponse.json(
        { error: 'Tabel belum tersedia di production DB. Jalankan `prisma db push` untuk mengaktifkan fitur baru.', code: 'SCHEMA_NOT_MIGRATED' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Gagal membuat dosen' }, { status: 500 })
  }
}
