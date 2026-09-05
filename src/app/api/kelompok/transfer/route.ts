import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - move or swap a mahasiswa between two kelompok (same tipe)
// Body:
//  {
//    mahasiswaId: string,          // peserta yang akan dipindah/ditukar
//    fromKelompokId: string,       // kelompok asal
//    toKelompokId: string,         // kelompok tujuan
//    mode: 'MOVE' | 'SWAP',
//    swapWithMahasiswaId?: string  // wajib jika mode === 'SWAP'
//  }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { mahasiswaId, fromKelompokId, toKelompokId, mode, swapWithMahasiswaId } = body ?? {}

    // ---- basic validation ----
    if (!mahasiswaId || !fromKelompokId || !toKelompokId) {
      return NextResponse.json(
        { error: 'mahasiswaId, fromKelompokId, toKelompokId wajib diisi' },
        { status: 400 }
      )
    }
    if (!['MOVE', 'SWAP'].includes(mode)) {
      return NextResponse.json({ error: 'Mode tidak valid (MOVE/SWAP)' }, { status: 400 })
    }
    if (fromKelompokId === toKelompokId) {
      return NextResponse.json({ error: 'Kelompok asal dan tujuan tidak boleh sama' }, { status: 400 })
    }
    if (mode === 'SWAP' && !swapWithMahasiswaId) {
      return NextResponse.json(
        { error: 'swapWithMahasiswaId wajib diisi untuk mode SWAP' },
        { status: 400 }
      )
    }
    if (mode === 'SWAP' && swapWithMahasiswaId === mahasiswaId) {
      return NextResponse.json(
        { error: 'Peserta yang ditukar tidak boleh sama dengan peserta asal' },
        { status: 400 }
      )
    }

    // ---- fetch kelompok asal & tujuan ----
    const [fromKel, toKel] = await Promise.all([
      db.kelompok.findUnique({
        where: { id: fromKelompokId },
        include: {
          desa: true,
          sekolah: true,
          members: true,
          _count: { select: { members: true } },
        },
      }),
      db.kelompok.findUnique({
        where: { id: toKelompokId },
        include: {
          desa: true,
          sekolah: true,
          members: true,
          _count: { select: { members: true } },
        },
      }),
    ])

    if (!fromKel) {
      return NextResponse.json({ error: 'Kelompok asal tidak ditemukan' }, { status: 404 })
    }
    if (!toKel) {
      return NextResponse.json({ error: 'Kelompok tujuan tidak ditemukan' }, { status: 404 })
    }

    // ---- tipe harus sama (KKN <-> KKN, PLP1 <-> PLP1, dst) ----
    if (fromKel.tipe !== toKel.tipe) {
      return NextResponse.json(
        {
          error: `Tipe kelompok tidak cocok. Asal: ${fromKel.tipe}, Tujuan: ${toKel.tipe}. Pergantian peserta hanya boleh antar kelompok dengan tipe yang sama.`,
        },
        { status: 400 }
      )
    }

    // ---- verify mahasiswa is a member of fromKelompok ----
    const fromMember = fromKel.members.find((m) => m.mahasiswaId === mahasiswaId)
    if (!fromMember) {
      return NextResponse.json(
        { error: 'Peserta tidak terdaftar di kelompok asal' },
        { status: 400 }
      )
    }

    // ---- verify mahasiswa not already in toKelompok ----
    const alreadyInTarget = toKel.members.some((m) => m.mahasiswaId === mahasiswaId)
    if (alreadyInTarget) {
      return NextResponse.json(
        { error: 'Peserta sudah terdaftar di kelompok tujuan' },
        { status: 400 }
      )
    }

    // ---- SWAP mode: verify swapWithMahasiswaId is member of toKelompok ----
    let swapMember: { id: string; mahasiswaId: string; kelompokId: string } | undefined
    if (mode === 'SWAP') {
      swapMember = toKel.members.find((m) => m.mahasiswaId === swapWithMahasiswaId)
      if (!swapMember) {
        return NextResponse.json(
          { error: 'Peserta yang ditukar tidak terdaftar di kelompok tujuan' },
          { status: 400 }
        )
      }
      // also ensure swap target is not already in fromKelompok
      const swapAlreadyInFrom = fromKel.members.some((m) => m.mahasiswaId === swapWithMahasiswaId)
      if (swapAlreadyInFrom) {
        return NextResponse.json(
          { error: 'Peserta yang ditukar sudah terdaftar di kelompok asal' },
          { status: 400 }
        )
      }
    }

    // ---- kuota check for MOVE mode (SWAP doesn't change counts) ----
    if (mode === 'MOVE') {
      // 1. Cek kuota kelompok tujuan (toKel.kuota)
      if (toKel.kuota > 0 && toKel._count.members >= toKel.kuota) {
        return NextResponse.json(
          {
            error: `Kuota kelompok tujuan sudah penuh (${toKel._count.members}/${toKel.kuota} anggota). Gunakan mode Tukar Peserta sebagai gantinya.`,
            code: 'KUOTA_KELOMPOK_PENUH',
          },
          { status: 400 }
        )
      }
      // 2. Cek kuota lokasi tujuan (desa/sekolah)
      const kuotaLokasi = toKel.desa?.kuota ?? toKel.sekolah?.kuota ?? 0
      const lokasiField = toKel.tipe === 'KKN' ? 'desaId' : 'sekolahId'
      const lokasiId = toKel.tipe === 'KKN' ? toKel.desaId : toKel.sekolahId
      if (lokasiId && kuotaLokasi > 0) {
        const totalAnggotaDiLokasiTujuan = await db.kelompokMember.count({
          where: { kelompok: { [lokasiField]: lokasiId } },
        })
        if (totalAnggotaDiLokasiTujuan >= kuotaLokasi) {
          return NextResponse.json(
            {
              error: `Kuota lokasi tujuan sudah penuh (${totalAnggotaDiLokasiTujuan}/${kuotaLokasi} mahasiswa). Gunakan mode Tukar Peserta sebagai gantinya.`,
              code: 'KUOTA_LOKASI_PENUH',
            },
            { status: 400 }
          )
        }
      }
    }

    // ---- execute transaction ----
    // MOVE: delete fromMember, create new member in toKelompok
    // SWAP: update fromMember.kelompokId -> toKelompokId, update swapMember.kelompokId -> fromKelompokId
    if (mode === 'MOVE') {
      await db.$transaction([
        db.kelompokMember.delete({ where: { id: fromMember.id } }),
        db.kelompokMember.create({
          data: { kelompokId: toKelompokId, mahasiswaId },
        }),
      ])
    } else {
      // SWAP
      await db.$transaction([
        // update fromMember to toKelompok
        db.kelompokMember.update({
          where: { id: fromMember.id },
          data: { kelompokId: toKelompokId },
        }),
        // update swapMember to fromKelompok
        db.kelompokMember.update({
          where: { id: swapMember!.id },
          data: { kelompokId: fromKelompokId },
        }),
      ])
    }

    // ---- record aktivitas (best effort, ignore failure) ----
    try {
      const mhs = await db.mahasiswa.findUnique({
        where: { id: mahasiswaId },
        select: { nama: true, nim: true },
      })
      const detail =
        mode === 'MOVE'
          ? `${mhs?.nama ?? mahasiswaId} (${mhs?.nim ?? ''}) dipindahkan dari "${fromKel.nama}" ke "${toKel.nama}"`
          : `${mhs?.nama ?? mahasiswaId} (${mhs?.nim ?? ''}) ditukar antara "${fromKel.nama}" dan "${toKel.nama}"`

      await db.aktivitas.create({
        data: {
          aksi: mode === 'MOVE' ? 'PINDAH_PESERTA' : 'TUKAR_PESERTA',
          modul: 'PEMBAGIAN',
          detail,
        },
      })
    } catch {
      // ignore aktivitas logging failure
    }

    return NextResponse.json({
      success: true,
      message:
        mode === 'MOVE'
          ? 'Peserta berhasil dipindahkan ke kelompok tujuan'
          : 'Peserta berhasil ditukar antar kelompok',
      mode,
      fromKelompokId,
      toKelompokId,
      mahasiswaId,
      swapWithMahasiswaId: mode === 'SWAP' ? swapWithMahasiswaId : undefined,
    })
  } catch (e: any) {
    console.error('[POST /api/kelompok/transfer]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Peserta sudah terdaftar di kelompok tujuan' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Gagal memindahkan/menukar peserta' },
      { status: 500 }
    )
  }
}
