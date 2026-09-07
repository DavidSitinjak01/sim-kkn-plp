import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/wipe-data
 *
 * Hapus massal data operasional. Body:
 *   {
 *     targets: string[]  // array of: 'mahasiswa' | 'sekolah' | 'desa' | 'absensi' | 'penilaian' | 'kelompok'
 *   }
 *
 * Aturan hapus (urutan untuk hindari FK constraint):
 *   - 'absensi'    → db.absensi.deleteMany({})
 *   - 'penilaian'  → db.penilaian.deleteMany({})
 *   - 'kelompokMember' → db.kelompokMember.deleteMany({})  (auto jika mahasiswa/kelompok dihapus)
 *   - 'mahasiswa'  → db.mahasiswa.deleteMany({})  (FK absensi/penilaian harus sudah dihapus)
 *   - 'sekolah'    → detach Kelompok.sekolahId=null → db.sekolah.deleteMany({})
 *   - 'desa'       → detach Kelompok.desaId=null → db.desa.deleteMany({})
 *   - 'kelompok'   → db.kelompok.deleteMany({})  (FK absensi/penilaian harus sudah dihapus)
 *
 * Operasi dijalankan dalam satu transaksi atomik: semua atau tidak sama sekali.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const targets: string[] = Array.isArray(body?.targets) ? body.targets : []
    if (targets.length === 0) {
      return NextResponse.json({ error: 'Tidak ada target yang dipilih' }, { status: 400 })
    }

    const VALID = ['mahasiswa', 'sekolah', 'desa', 'absensi', 'penilaian', 'kelompok']
    const invalid = targets.filter((t) => !VALID.includes(t))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Target tidak valid: ${invalid.join(', ')}. Valid: ${VALID.join(', ')}` },
        { status: 400 },
      )
    }

    // ── Hitung data sebelum hapus (untuk laporan) ─────────────────────────
    // SAFETY: kalau 'kelompok' dipilih, auto-juga hitung absensi & penilaian
    // (karena akan dihapus juga untuk hindari FK constraint error).
    const willDeleteAbsensi = targets.includes('absensi') || targets.includes('kelompok')
    const willDeletePenilaian = targets.includes('penilaian') || targets.includes('kelompok')
    const willDeleteKelompokMember = targets.includes('mahasiswa') || targets.includes('kelompok')

    const before = {
      absensi: willDeleteAbsensi ? await db.absensi.count() : 0,
      penilaian: willDeletePenilaian ? await db.penilaian.count() : 0,
      kelompokMember: willDeleteKelompokMember ? await db.kelompokMember.count() : 0,
      mahasiswa: targets.includes('mahasiswa') ? await db.mahasiswa.count() : 0,
      sekolah: targets.includes('sekolah') ? await db.sekolah.count() : 0,
      desa: targets.includes('desa') ? await db.desa.count() : 0,
      kelompok: targets.includes('kelompok') ? await db.kelompok.count() : 0,
    }

    // ── Bangun transaction berurutan ─────────────────────────────────────
    // Urutan penting! Child dulu, baru parent.
    //
    // SAFETY: kalau 'kelompok' dipilih, auto-juga hapus absensi & penilaian
    // yang punya FK ke kelompok (onDelete tidak cascade di schema), supaya
    // tidak error P2003 (FK constraint).
    const effectiveTargets = new Set(targets)
    if (effectiveTargets.has('kelompok')) {
      effectiveTargets.add('absensi')
      effectiveTargets.add('penilaian')
    }

    const ops: any[] = []

    if (effectiveTargets.has('absensi')) {
      ops.push(db.absensi.deleteMany({}))
    }
    if (effectiveTargets.has('penilaian')) {
      ops.push(db.penilaian.deleteMany({}))
    }
    if (effectiveTargets.has('mahasiswa') || effectiveTargets.has('kelompok')) {
      ops.push(db.kelompokMember.deleteMany({}))
    }
    if (effectiveTargets.has('mahasiswa')) {
      ops.push(db.mahasiswa.deleteMany({}))
    }
    if (effectiveTargets.has('sekolah')) {
      ops.push(db.kelompok.updateMany({ where: {}, data: { sekolahId: null } }))
      ops.push(db.sekolah.deleteMany({}))
    }
    if (effectiveTargets.has('desa')) {
      ops.push(db.kelompok.updateMany({ where: {}, data: { desaId: null } }))
      ops.push(db.desa.deleteMany({}))
    }
    if (effectiveTargets.has('kelompok')) {
      ops.push(db.kelompok.deleteMany({}))
    }

    if (ops.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada operasi yang dijalankan', deleted: {} })
    }

    await db.$transaction(ops)

    return NextResponse.json({
      success: true,
      deleted: {
        absensi: before.absensi,
        penilaian: before.penilaian,
        kelompokMember: before.kelompokMember,
        mahasiswa: before.mahasiswa,
        sekolah: before.sekolah,
        desa: before.desa,
        kelompok: before.kelompok,
      },
    })
  } catch (e: any) {
    console.error('[POST /api/wipe-data]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Gagal menghapus — masih ada data yang mereferensikan tabel ini. Hapus data terkait terlebih dahulu.' },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: 'Gagal menghapus data: ' + (e?.message || 'unknown error') },
      { status: 500 },
    )
  }
}
