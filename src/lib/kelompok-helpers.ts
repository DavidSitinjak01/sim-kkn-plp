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
 * Kalau error APAPUN di first try, retry tanpa koordinator.
 * Catch BROAD — semua error retry, bukan hanya P2021.
 */
export async function withKoordinatorFallback<T>(
  fn: (skipKoordinator: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await fn(false)
  } catch (firstErr: any) {
    // ANY error di first try → retry tanpa koordinator.
    // Kalau error BUKAN karena koordinatorId, retry juga akan gagal,
    // dan kita throw firstErr (error asli) untuk diagnosis.
    console.warn('[withKoordinatorFallback] First try failed, retry tanpa koordinator:', firstErr?.code || firstErr?.message?.substring(0, 100))
    try {
      return await fn(true)
    } catch (retryErr) {
      // Retry juga gagal — throw error asli (bukan retry error)
      throw firstErr
    }
  }
}
