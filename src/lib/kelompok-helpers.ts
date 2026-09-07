import { db } from '@/lib/db'

/**
 * Helper: jalankan query Kelompok dengan include koordinator.
 * Kalau kolom koordinatorId belum ada di DB (production belum di-migrate),
 * fallback ke query tanpa include koordinator.
 *
 * Dipakai di GET (list), GET (detail), POST (create), PUT (update).
 */

/** Build include object untuk Kelompok, dengan opsi skip koordinator. */
export function buildKelompokInclude(skipKoordinator = false) {
  const include: Record<string, unknown> = {
    desa: true,
    sekolah: true,
    dosen: true,
    _count: { select: { members: true } },
  }
  if (!skipKoordinator) {
    include.koordinator = true
  }
  return include
}

/** Build members include (untuk GET detail kelompok). */
export function buildKelompokDetailInclude(skipKoordinator = false) {
  const include: Record<string, unknown> = {
    desa: true,
    sekolah: true,
    dosen: true,
    members: {
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
      },
    },
    _count: { select: { members: true } },
  }
  if (!skipKoordinator) {
    include.koordinator = true
  }
  return include
}

/** Build create/update data, skip koordinatorId kalau kolom belum ada. */
export function buildKelompokData(body: any, skipKoordinator = false) {
  const data: Record<string, unknown> = {
    nama: body.nama?.trim(),
    tipe: body.tipe,
    tahunAkademik: body.tahunAkademik?.trim(),
    semester: body.semester,
    desaId: body.desaId || null,
    sekolahId: body.sekolahId || null,
    dosenId: body.dosenId || null,
    status: body.status || 'AKTIF',
  }
  if (!skipKoordinator) {
    data.koordinatorId = body.koordinatorId || null
  }
  return data
}

/**
 * Jalankan fungsi Prisma yang melibatkan kolom koordinator.
 * Kalau error P2021 (column does not exist), retry tanpa koordinator.
 *
 * Usage:
 *   const data = await withKoordinatorFallback(async (skip) => {
 *     return db.kelompok.findMany({ include: buildKelompokInclude(skip) })
 *   })
 */
export async function withKoordinatorFallback<T>(
  fn: (skipKoordinator: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await fn(false)
  } catch (e: any) {
    // P2021 = table/column does not exist in current database
    // P2009 = validation error (kadang muncul kalau field tidak dikenal)
    if (e?.code === 'P2021' || e?.code === 'P2009' || /does not exist/i.test(e?.message ?? '')) {
      console.warn('[withKoordinatorFallback] Kolom koordinatorId belum ada di DB — retry tanpa koordinator. Jalankan `prisma db push` untuk mengaktifkan fitur koordinator lapangan.')
      return await fn(true)
    }
    throw e
  }
}

/** Cek apakah error terkait kolom koordinatorId belum ada di DB. */
export function isKoordinatorColumnMissing(e: any): boolean {
  return e?.code === 'P2021' || e?.code === 'P2009' || /does not exist/i.test(e?.message ?? '')
}
