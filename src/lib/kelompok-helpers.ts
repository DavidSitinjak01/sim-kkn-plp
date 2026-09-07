import { db } from '@/lib/db'

/**
 * Helper untuk query Kelompok yang RESILIENT terhadap production DB yang belum
 * punya kolom `koordinatorId`.
 *
 * Strategi: pakai `select` (bukan `include`) untuk kontrol EXACT kolom yang
 * di-query. Jangan pernah select `koordinatorId` atau `koordinator` kecuali
 * kalau dipastikan kolomnya sudah ada.
 *
 * `include` selalu return ALL scalar fields (termasuk koordinatorId) → error
 * kalau kolom belum ada. `select` hanya return field yang dispesifikkan → safe.
 */

/** Build select object untuk Kelompok — HANYA field yang pasti ada di DB lama. */
export function buildKelompokSelect(includeKoordinator = false) {
  const select: Record<string, unknown> = {
    id: true,
    nama: true,
    tipe: true,
    tahunAkademik: true,
    semester: true,
    desaId: true,
    desa: true,
    sekolahId: true,
    sekolah: true,
    dosenId: true,
    dosen: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { members: true } },
  }
  if (includeKoordinator) {
    select.koordinatorId = true
    select.koordinator = true
  }
  return select
}

/** Build select object untuk GET detail (include members + mahasiswa). */
export function buildKelompokDetailSelect(includeKoordinator = false) {
  const select: Record<string, unknown> = {
    id: true,
    nama: true,
    tipe: true,
    tahunAkademik: true,
    semester: true,
    desaId: true,
    desa: true,
    sekolahId: true,
    sekolah: true,
    dosenId: true,
    dosen: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    members: {
      include: {
        mahasiswa: { include: { prodi: { include: { fakultas: true } } } },
      },
    },
    _count: { select: { members: true } },
  }
  if (includeKoordinator) {
    select.koordinatorId = true
    select.koordinator = true
  }
  return select
}

/** Build create/update data — jangan include koordinatorId kalau skip. */
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
 * Jalankan fungsi Prisma yang melibatkan Kelompok.
 * Kalau error (kolom koordinatorId belum ada), retry tanpa koordinator.
 *
 * Menggunakan `select` (bukan `include`) supaya hanya field yang dispesifikkan
 * yang di-query. Ini mencegah Prisma mencoba SELECT kolom yang belum ada.
 */
export async function withKoordinatorFallback<T>(
  fn: (skipKoordinator: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await fn(false)
  } catch (e: any) {
    // Catch BROAD error — kolom tidak ada bisa throw berbagai error code:
    // P2021 (table not exist), P2009 (validation), P2010 (raw query failed),
    // atau PrismaClientUnknownRequestError (no code).
    // Cek by error message pattern + error code.
    const isColumnMissing =
      e?.code === 'P2021' ||
      e?.code === 'P2009' ||
      e?.code === 'P2010' ||
      /does not exist/i.test(e?.message ?? '') ||
      /koordinator/i.test(e?.message ?? '') ||
      /unknown column/i.test(e?.message ?? '')

    if (isColumnMissing) {
      console.warn('[withKoordinatorFallback] Kolom koordinatorId belum ada di DB — retry tanpa koordinator.')
      try {
        return await fn(true)
      } catch (retryErr) {
        // Retry juga gagal — throw error asli (bukan retry error) supaya
        // user lihat pesan error yang akurat
        console.error('[withKoordinatorFallback] Retry juga gagal:', retryErr)
        throw e
      }
    }
    throw e
  }
}
