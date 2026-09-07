import { db } from '@/lib/db'

/**
 * Batas default (jumlah maksimal mahasiswa per prodi per lokasi)
 * ketika tidak ada row override di tabel SekolahProdiKuota / DesaProdiKuota.
 */
export const DEFAULT_MAX_PER_PRODI = 3

export type LokasiType = 'sekolah' | 'desa'

export interface ProdiKuotaStatus {
  prodiId: string
  prodiNama: string
  prodiKode: string
  jenjang: string
  /** Jumlah mahasiswa dari prodi ini yang sudah ter-assign ke kelompok di lokasi tsb. */
  current: number
  /** Batas maksimal untuk prodi ini di lokasi tsb. */
  max: number
  /** True kalau ada override eksplisit di tabel prodiKuota. */
  overridden: boolean
  /** True kalau current > max (existing data yang melanggar). */
  exceeded: boolean
}

/**
 * Ambil daftar prodi dengan status kuota (current vs max) untuk sebuah lokasi.
 * Dipakai oleh UI Kelola Anggota & UI manajemen prodi-kuota di sekolah/desa.
 */
export async function getProdiKuotaStatus(
  lokasiType: LokasiType,
  lokasiId: string,
): Promise<ProdiKuotaStatus[]> {
  const lokasiField = lokasiType === 'sekolah' ? 'sekolahId' : 'desaId'

  // 1. Ambil semua prodi
  const allProdi = await db.programStudi.findMany({
    select: { id: true, nama: true, kode: true, jenjang: true },
    orderBy: { nama: 'asc' },
  })

  // 2. Ambil override yang ada
  const overrides = await (lokasiType === 'sekolah'
    ? db.sekolahProdiKuota.findMany({ where: { sekolahId: lokasiId } })
    : db.desaProdiKuota.findMany({ where: { desaId: lokasiId } }))
  const overrideMap = new Map(overrides.map((o) => [o.prodiId, o.maxKuota]))

  // 3. Hitung distribusi current per prodi di lokasi ini
  //    KelompokMember → Kelompok → lokasiId, lalu group by mahasiswa.prodiId.
  //    Karena Prisma tidak support groupBy melalui relasi bertingkat dengan
  //    filter dinamis di SQLite, kita query manual.
  const members = await db.kelompokMember.findMany({
    where: {
      kelompok: { [lokasiField]: lokasiId },
    },
    select: {
      mahasiswa: { select: { prodiId: true } },
    },
  })
  const countByProdi = new Map<string, number>()
  for (const m of members) {
    const pid = m.mahasiswa.prodiId
    countByProdi.set(pid, (countByProdi.get(pid) ?? 0) + 1)
  }

  // 4. Gabung jadi status list
  return allProdi.map((p) => {
    const max = overrideMap.has(p.id)
      ? (overrideMap.get(p.id) as number)
      : DEFAULT_MAX_PER_PRODI
    const current = countByProdi.get(p.id) ?? 0
    return {
      prodiId: p.id,
      prodiNama: p.nama,
      prodiKode: p.kode,
      jenjang: p.jenjang,
      current,
      max,
      overridden: overrideMap.has(p.id),
      exceeded: current > max,
    }
  })
}

/**
 * Cek apakah seorang mahasiswa bisa di-assign ke kelompok yang terkait lokasi ini.
 *
 * @param lokasiType 'sekolah' | 'desa'
 * @param lokasiId   id sekolah/desa dari kelompok tujuan
 * @param prodiId    prodi mahasiswa yang ingin di-assign
 * @param options.excludeKelompokId  Untuk mode transfer/pindah: kelompok asal.
 *        Kalau kelompok asal punya lokasiId yang sama dengan tujuan, berarti
 *        mahasiswa sudah dihitung di current count lokasi tsb — jadi skip cek
 *        (tidak menambah jumlah baru).
 *
 * @returns { ok, current, max, message? }
 *   - ok=true  → boleh di-assign
 *   - ok=false → sudah penuh, kirim pesan ke UI
 */
export async function checkProdiKuota(
  lokasiType: LokasiType,
  lokasiId: string,
  prodiId: string,
  options?: { excludeKelompokId?: string },
): Promise<{ ok: boolean; current: number; max: number; message?: string }> {
  const lokasiField = lokasiType === 'sekolah' ? 'sekolahId' : 'desaId'

  // Cek apakah kelompok asal (kalau ada) berlokasi sama → pindah internal, skip
  if (options?.excludeKelompokId) {
    const sourceKel = await db.kelompok.findUnique({
      where: { id: options.excludeKelompokId },
      select: { [lokasiField]: true },
    })
    // @ts-expect-error dynamic field access
    if (sourceKel && sourceKel[lokasiField] === lokasiId) {
      // Pindah internal di lokasi yang sama — tidak menambah anggota per prodi
      // Ambil max & current untuk info saja
      const status = (await getProdiKuotaStatus(lokasiType, lokasiId)).find((s) => s.prodiId === prodiId)
      return { ok: true, current: status?.current ?? 0, max: status?.max ?? DEFAULT_MAX_PER_PRODI }
    }
  }

  // Hitung jumlah mahasiswa prodi ini di lokasi tujuan
  const count = await db.kelompokMember.count({
    where: {
      kelompok: { [lokasiField]: lokasiId },
      mahasiswa: { prodiId },
    },
  })

  // Ambil batas (override atau default)
  const override = await (lokasiType === 'sekolah'
    ? db.sekolahProdiKuota.findUnique({
        where: { sekolahId_prodiId: { sekolahId: lokasiId, prodiId } },
      })
    : db.desaProdiKuota.findUnique({
        where: { desaId_prodiId: { desaId: lokasiId, prodiId } },
      }))
  const max = override?.maxKuota ?? DEFAULT_MAX_PER_PRODI

  // max = 0 artinya unlimited (sengaja disable cek)
  if (max <= 0) {
    return { ok: true, current: count, max: 0 }
  }

  if (count >= max) {
    const lokasiLabel = lokasiType === 'sekolah' ? 'sekolah' : 'desa'
    const prodi = await db.programStudi.findUnique({ where: { id: prodiId }, select: { nama: true } })
    return {
      ok: false,
      current: count,
      max,
      message: `Batas maksimal ${max} mahasiswa dari prodi "${prodi?.nama ?? prodiId}" sudah tercapai di ${lokasiLabel} ini. Pilih mahasiswa dari prodi lain atau naikkan batas di pengaturan ${lokasiLabel}.`,
    }
  }

  return { ok: true, current: count, max }
}

/**
 * Bulk upsert batas prodi-kuota untuk sebuah lokasi.
 * Body: { items: [{ prodiId, maxKuota }] }
 * - maxKuota = 0 → unlimited
 * - Hanya simpan row yang nilainya berbeda dari default (3)
 *   (untuk hemat row & tetap idempotent)
 */
export async function setProdiKuota(
  lokasiType: LokasiType,
  lokasiId: string,
  items: Array<{ prodiId: string; maxKuota: number }>,
): Promise<void> {
  // Hapus semua override yang ada dulu (replace strategy)
  if (lokasiType === 'sekolah') {
    await db.sekolahProdiKuota.deleteMany({ where: { sekolahId: lokasiId } })
    // Insert yang baru (hanya yang tidak sama dengan default)
    const toCreate = items
      .filter((it) => Number.isInteger(it.maxKuota) && it.maxKuota >= 0 && it.maxKuota !== DEFAULT_MAX_PER_PRODI)
      .map((it) => ({ sekolahId: lokasiId, prodiId: it.prodiId, maxKuota: it.maxKuota }))
    if (toCreate.length > 0) {
      await db.sekolahProdiKuota.createMany({ data: toCreate })
    }
  } else {
    await db.desaProdiKuota.deleteMany({ where: { desaId: lokasiId } })
    const toCreate = items
      .filter((it) => Number.isInteger(it.maxKuota) && it.maxKuota >= 0 && it.maxKuota !== DEFAULT_MAX_PER_PRODI)
      .map((it) => ({ desaId: lokasiId, prodiId: it.prodiId, maxKuota: it.maxKuota }))
    if (toCreate.length > 0) {
      await db.desaProdiKuota.createMany({ data: toCreate })
    }
  }
}
