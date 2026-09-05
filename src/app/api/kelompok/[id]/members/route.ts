import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// POST - add member { mahasiswaId, moveFromKelompokId? }
//
// Aturan ANTI-DUPLIKASI:
//   Seorang mahasiswa hanya boleh terdaftar di SATU kelompok per tahun akademik,
//   tidak boleh di 2 kelompok sekalipun tipenya berbeda (KKN vs PLP1 vs PLP2).
//
// Jika `moveFromKelompokId` diisi, ini adalah operasi PINDAH (transfer):
//   1. Hapus mahasiswa dari kelompok asal (moveFromKelompokId)
//   2. Tambahkan ke kelompok tujuan (id)
//   Dilakukan dalam transaction agar atomic — kalau salah satu gagal, semua rollback.
//   Tipe kelompok asal & tujuan BOLEH berbeda (pindah KKN -> PLP2 dsb.) karena
//   user secara eksplisit memilih untuk memindahkan.
//
// Jika tidak diisi, ini adalah operasi TAMBAH biasa.
//   Akan ditolak bila mahasiswa sudah terdaftar di kelompok lain pada tahun akademik yang sama.
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.mahasiswaId) {
      return NextResponse.json({ error: 'mahasiswaId wajib diisi' }, { status: 400 })
    }

    // Verify kelompok tujuan & mahasiswa exist
    const [kel, mhs] = await Promise.all([
      db.kelompok.findUnique({ where: { id } }),
      db.mahasiswa.findUnique({ where: { id: body.mahasiswaId } }),
    ])
    if (!kel) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 })
    if (!mhs) return NextResponse.json({ error: 'Mahasiswa tidak ditemukan' }, { status: 400 })

    // ===== Anti-duplikasi: cek kelompok lain pada tahun akademik yang sama =====
    // Mahasiswa tidak boleh ada di 2 kelompok (apapun tipenya) pada tahun akademik yang sama.
    const existingMemberships = await db.kelompokMember.findMany({
      where: { mahasiswaId: body.mahasiswaId },
      include: { kelompok: { select: { id: true, nama: true, tipe: true, tahunAkademik: true } } },
    })
    const conflictSameYear = existingMemberships.find(
      (m) => m.kelompok.tahunAkademik === kel.tahunAkademik && m.kelompokId !== id,
    )

    // ===== Transfer (pindah antar kelompok) =====
    if (body.moveFromKelompokId && body.moveFromKelompokId !== id) {
      const sourceId = body.moveFromKelompokId as string

      // Verify source kelompok exists
      const sourceKel = await db.kelompok.findUnique({ where: { id: sourceId } })
      if (!sourceKel) {
        return NextResponse.json({ error: 'Kelompok asal tidak ditemukan' }, { status: 404 })
      }
      // Tipe BOLEH berbeda — user secara eksplisit memilih untuk memindahkan antar tipe.
      // Tapi tahun akademik HARUS sama agar tidak menduplikasi entry historis.
      if (sourceKel.tahunAkademik !== kel.tahunAkademik) {
        return NextResponse.json(
          { error: 'Tahun akademik kelompok asal & tujuan berbeda — tidak bisa pindah antar tahun' },
          { status: 400 },
        )
      }

      // Safety net: pastikan tidak ada konflik di kelompok lain (selain source) di tahun yang sama
      const otherConflict = existingMemberships.find(
        (m) => m.kelompokId !== sourceId && m.kelompokId !== id && m.kelompok.tahunAkademik === kel.tahunAkademik,
      )
      if (otherConflict) {
        return NextResponse.json(
          {
            error: `Mahasiswa masih terdaftar di kelompok lain: "${otherConflict.kelompok.nama}" (${otherConflict.kelompok.tipe}). Keluarkan dahulu sebelum memindahkan.`,
          },
          { status: 400 },
        )
      }

      // Atomic transfer: delete from source + create in target
      try {
        const created = await db.$transaction(async (tx) => {
          // 1. Find & delete membership in source kelompok
          const existing = await tx.kelompokMember.findUnique({
            where: {
              kelompokId_mahasiswaId: { kelompokId: sourceId, mahasiswaId: body.mahasiswaId },
            },
          })
          if (!existing) {
            throw new Error('MAHASISWA_NOT_IN_SOURCE')
          }
          await tx.kelompokMember.delete({ where: { id: existing.id } })

          // 2. Create membership in target kelompok
          return tx.kelompokMember.create({
            data: {
              kelompokId: id,
              mahasiswaId: body.mahasiswaId,
            },
            include: {
              mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
            },
          })
        })
        return NextResponse.json(
          { ...created, moved: true, fromKelompokId: sourceId, toKelompokId: id },
          { status: 201 },
        )
      } catch (e: any) {
        if (e?.message === 'MAHASISWA_NOT_IN_SOURCE') {
          return NextResponse.json(
            { error: 'Mahasiswa tidak terdaftar di kelompok asal' },
            { status: 400 },
          )
        }
        if (e?.code === 'P2002') {
          return NextResponse.json(
            { error: 'Mahasiswa sudah terdaftar di kelompok tujuan' },
            { status: 400 },
          )
        }
        throw e
      }
    }

    // ===== Add biasa — tolak bila sudah ada di kelompok lain (same tahunAkademik) =====
    if (conflictSameYear) {
      const k = conflictSameYear.kelompok
      const tipeLabel = k.tipe === 'KKN' ? 'KKN' : k.tipe === 'PLP1' ? 'PLP 1' : 'PLP 2'
      return NextResponse.json(
        {
          error: `Mahasiswa sudah terdaftar di kelompok "${k.nama}" (${tipeLabel}, TA ${k.tahunAkademik}). Mahasiswa tidak boleh berada di 2 kelompok pada tahun akademik yang sama. Gunakan fitur "Pindah" untuk memindahkan.`,
          conflict: { kelompokId: k.id, kelompokNama: k.nama, tipe: k.tipe, tahunAkademik: k.tahunAkademik },
        },
        { status: 409 },
      )
    }

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
