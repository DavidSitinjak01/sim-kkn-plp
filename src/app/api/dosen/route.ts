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
//
// RESILIENT: Kalau production DB belum di-migrate (kolom masih NOT NULL),
// retry create dengan placeholder values supaya dosen tetap tersimpan.
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

    // Build data untuk create
    const createData = {
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
    }

    let created
    try {
      // Coba create normal
      created = await db.dosen.create({
        data: createData,
        include: { fakultas: true, prodi: true },
      })
    } catch (createErr: any) {
      // P2011 = Null constraint violation → production DB masih NOT NULL
      // untuk kolom yang sudah optional di schema. Retry dengan placeholder.
      if (createErr?.code === 'P2011') {
        const violatedFields: string[] = Array.isArray(createErr?.meta?.target)
          ? createErr.meta.target
          : []
        console.warn(`[POST /api/dosen] P2011 violation, retry dengan placeholder. Fields: ${violatedFields.join(', ')}`)

        // Cache first fakultas ID untuk placeholder
        const firstFakultas = await db.fakultas.findFirst({ select: { id: true } })

        // Build retry data dengan placeholder
        const retryData: any = { ...createData }
        for (const f of violatedFields) {
          if (f === 'fakultasId' && !retryData.fakultasId && firstFakultas) {
            retryData.fakultasId = firstFakultas.id
          } else if (f === 'email' && !retryData.email) {
            const slug = (retryData.nidn || retryData.nama.toLowerCase().replace(/[^a-z0-9]+/g, '.')).slice(0, 30)
            retryData.email = `${slug}@placeholder.ac.id`
          } else if (f === 'noHp' && !retryData.noHp) {
            retryData.noHp = '-'
          } else if (f === 'nidn' && !retryData.nidn) {
            retryData.nidn = `TMP${Date.now()}${Math.floor(Math.random() * 1000)}`
          }
        }
        try {
          created = await db.dosen.create({
            data: retryData,
            include: { fakultas: true, prodi: true },
          })
        } catch (retryErr: any) {
          console.error('[POST /api/dosen] retry juga gagal:', retryErr)
          if (retryErr?.code === 'P2002') {
            return NextResponse.json({ error: 'NIDN atau email sudah terdaftar' }, { status: 400 })
          }
          return NextResponse.json(
            { error: 'Gagal membuat dosen setelah retry. Production DB mungkin belum di-migrate. Jalankan `prisma db push`.' },
            { status: 500 },
          )
        }
      } else {
        throw createErr
      }
    }

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/dosen]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIDN atau email sudah terdaftar' }, { status: 400 })
    }
    // P2021 = tabel belum ada di DB
    if (e?.code === 'P2021') {
      return NextResponse.json(
        { error: 'Tabel belum tersedia di production DB. Jalankan `prisma db push` untuk mengaktifkan fitur baru.', code: 'SCHEMA_NOT_MIGRATED' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Gagal membuat dosen' }, { status: 500 })
  }
}
