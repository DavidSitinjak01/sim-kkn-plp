import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ Kategori Reset ============
// - transaksional: Absensi, QrSession, Surat, Penilaian, Pengumuman, Agenda, Aktivitas
// - pembagian:     KelompokMember, Kelompok
// - lokasi:        Desa, Sekolah
// - mahasiswa:     Mahasiswa + User MAHASISWA terkait
// - dosen:         Dosen + User DOSEN terkait
//
// Yang TIDAK PERNAH direset:
// - User staf (SUPER_ADMIN, ADMIN_FAKULTAS, ADMIN_PRODI, PIMPINAN)
// - Fakultas, ProgramStudi (struktur institusi)
// - Pengaturan (konfigurasi sistem)

export type ResetCategory = 'transaksional' | 'pembagian' | 'lokasi' | 'mahasiswa' | 'dosen'

const ALL_CATEGORIES: ResetCategory[] = [
  'transaksional', 'pembagian', 'lokasi', 'mahasiswa', 'dosen',
]

// ============ GET /api/super-admin/reset-data ============
// Mengembalikan jumlah record per tabel (untuk preview sebelum reset).
export async function GET() {
  try {
    const [
      absensi, qrSession, surat, penilaian, pengumuman, agenda, aktivitas,
      kelompokMember, kelompok, desa, sekolah,
      mahasiswa, dosen,
      userMahasiswa, userDosen, userStaf,
    ] = await Promise.all([
      db.absensi.count(),
      db.qrSession.count(),
      db.surat.count(),
      db.penilaian.count(),
      db.pengumuman.count(),
      db.agenda.count(),
      db.aktivitas.count(),
      db.kelompokMember.count(),
      db.kelompok.count(),
      db.desa.count(),
      db.sekolah.count(),
      db.mahasiswa.count(),
      db.dosen.count(),
      db.user.count({ where: { role: 'MAHASISWA' } }),
      db.user.count({ where: { role: 'DOSEN' } }),
      db.user.count({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN_FAKULTAS', 'ADMIN_PRODI', 'PIMPINAN'] } } }),
    ])

    const counts = {
      transaksional: {
        label: 'Data Transaksional',
        items: [
          { key: 'absensi', label: 'Absensi', count: absensi },
          { key: 'qrSession', label: 'QR Session', count: qrSession },
          { key: 'surat', label: 'Surat', count: surat },
          { key: 'penilaian', label: 'Penilaian', count: penilaian },
          { key: 'pengumuman', label: 'Pengumuman', count: pengumuman },
          { key: 'agenda', label: 'Agenda', count: agenda },
          { key: 'aktivitas', label: 'Log Aktivitas', count: aktivitas },
        ],
        total: absensi + qrSession + surat + penilaian + pengumuman + agenda + aktivitas,
      },
      pembagian: {
        label: 'Data Pembagian KKN/PLP',
        items: [
          { key: 'kelompokMember', label: 'Anggota Kelompok', count: kelompokMember },
          { key: 'kelompok', label: 'Kelompok', count: kelompok },
        ],
        total: kelompokMember + kelompok,
      },
      lokasi: {
        label: 'Data Lokasi',
        items: [
          { key: 'desa', label: 'Desa', count: desa },
          { key: 'sekolah', label: 'Sekolah', count: sekolah },
        ],
        total: desa + sekolah,
      },
      mahasiswa: {
        label: 'Data Mahasiswa',
        items: [
          { key: 'mahasiswa', label: 'Mahasiswa', count: mahasiswa },
          { key: 'userMahasiswa', label: 'Akun User Mahasiswa', count: userMahasiswa },
        ],
        total: mahasiswa + userMahasiswa,
      },
      dosen: {
        label: 'Data Dosen',
        items: [
          { key: 'dosen', label: 'Dosen', count: dosen },
          { key: 'userDosen', label: 'Akun User Dosen', count: userDosen },
        ],
        total: dosen + userDosen,
      },
      // Info yang dipertahankan
      preserved: {
        userStaf,
        label: 'Akun Staf (Super Admin, Admin, Pimpinan) + Fakultas/Prodi + Pengaturan',
      },
    }

    return NextResponse.json({ counts })
  } catch (e) {
    console.error('[GET /api/super-admin/reset-data]', e)
    return NextResponse.json({ error: 'Gagal memuat ringkasan data' }, { status: 500 })
  }
}

// ============ POST /api/super-admin/reset-data ============
// Body: {
//   categories: ResetCategory[]  // kategori yang akan direset
//   confirmText: string          // WAJIB = "HAPUS SEMUA" sebagai konfirmasi
//   actorName?: string           // untuk log aktivitas
// }
//
// Mengembalikan:
//   { success: true, deleted: {...} }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const categories: ResetCategory[] = Array.isArray(body?.categories)
      ? body.categories.filter((c: string): c is ResetCategory =>
          ALL_CATEGORIES.includes(c as ResetCategory))
      : []
    const confirmText = String(body?.confirmText ?? '').trim()
    const actorName = String(body?.actorName ?? 'Super Admin').trim() || 'Super Admin'

    if (categories.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu kategori untuk direset' }, { status: 400 })
    }
    if (confirmText !== 'HAPUS SEMUA') {
      return NextResponse.json({
        error: 'Konfirmasi gagal. Ketik "HAPUS SEMUA" (huruf besar) pada kolom konfirmasi.',
      }, { status: 400 })
    }

    const deleted: Record<string, number> = {}
    const doneCategories: string[] = []

    // Prisma transaction untuk atomicity
    await db.$transaction(async (tx) => {
      // Urutan hapus penting untuk menghindari constraint FK error:
      // 1. Anak-anak dulu (yang punya FK ke parent)

      // ============ Kategori: transaksional ============
      if (categories.includes('transaksional')) {
        deleted.absensi = await tx.absensi.deleteMany({})
        deleted.qrSession = await tx.qrSession.deleteMany({})
        deleted.surat = await tx.surat.deleteMany({})
        deleted.penilaian = await tx.penilaian.deleteMany({})
        deleted.pengumuman = await tx.pengumuman.deleteMany({})
        deleted.agenda = await tx.agenda.deleteMany({})
        deleted.aktivitas = await tx.aktivitas.deleteMany({})
        doneCategories.push('transaksional')
      }

      // ============ Kategori: pembagian ============
      // Hapus KelompokMember dulu, lalu Kelompok
      if (categories.includes('pembagian')) {
        deleted.kelompokMember = await tx.kelompokMember.deleteMany({})
        deleted.kelompok = await tx.kelompok.deleteMany({})
        doneCategories.push('pembagian')
      }

      // ============ Kategori: lokasi ============
      // Jika hanya lokasi tanpa pembagian, kita tetap perlu hapus Kelompok yang berelasi ke Desa/Sekolah
      if (categories.includes('lokasi')) {
        if (!categories.includes('pembagian')) {
          // Auto-cleanup kelompok yang ber-reference ke desa/sekolah
          const allDesaIds = await tx.desa.findMany({ select: { id: true } })
          const allSekolahIds = await tx.sekolah.findMany({ select: { id: true } })
          const desaIds = allDesaIds.map(d => d.id)
          const sekolahIds = allSekolahIds.map(s => s.id)

          if (desaIds.length > 0 || sekolahIds.length > 0) {
            await tx.kelompokMember.deleteMany({
              where: { kelompok: { OR: [{ desaId: { in: desaIds } }, { sekolahId: { in: sekolahIds } }] } },
            })
            await tx.kelompok.deleteMany({
              where: { OR: [{ desaId: { in: desaIds } }, { sekolahId: { in: sekolahIds } }] },
            })
          }
        }
        deleted.desa = await tx.desa.deleteMany({})
        deleted.sekolah = await tx.sekolah.deleteMany({})
        doneCategories.push('lokasi')
      }

      // ============ Kategori: mahasiswa ============
      // Hapus Absensi, Penilaian, KelompokMember yang berelasi ke Mahasiswa dulu
      // (jika belum dihapus di kategori transaksional/pembagian)
      if (categories.includes('mahasiswa')) {
        await tx.absensi.deleteMany({})
        await tx.penilaian.deleteMany({})
        await tx.kelompokMember.deleteMany({})

        // Dapatkan daftar userId mahasiswa sebelum hapus mahasiswa
        const mahasiswaWithUsers = await tx.mahasiswa.findMany({
          where: { userId: { not: null } },
          select: { userId: true },
        })
        const userIdsToDelete = mahasiswaWithUsers
          .map(m => m.userId)
          .filter((id): id is string => !!id)

        // Hapus semua Mahasiswa (akan cascade hapus KelompokMember karena onDelete: Cascade)
        deleted.mahasiswa = await tx.mahasiswa.deleteMany({})

        // Hapus User MAHASISWA yang ter-link
        if (userIdsToDelete.length > 0) {
          deleted.userMahasiswa = await tx.user.deleteMany({
            where: { id: { in: userIdsToDelete }, role: 'MAHASISWA' },
          })
        } else {
          deleted.userMahasiswa = await tx.user.deleteMany({ where: { role: 'MAHASISWA' } })
        }
        doneCategories.push('mahasiswa')
      }

      // ============ Kategori: dosen ============
      // Hapus Penilaian FK ke Dosen, Kelompok FK ke Dosen dulu (jika belum dihapus)
      if (categories.includes('dosen')) {
        // Penilaian FK ke Dosen nullable, kalau transaksional belum dihapus, hapus dulu
        await tx.penilaian.deleteMany({ where: { dosenId: { not: null } } })
        // Kelompok FK ke Dosen nullable, kalau pembagian belum dihapus, unlink dosenId (lebih aman)
        if (!categories.includes('pembagian')) {
          await tx.kelompok.updateMany({
            where: { dosenId: { not: null } },
            data: { dosenId: null },
          })
        }

        // Dapatkan userId dosen sebelum hapus
        const dosenWithUsers = await tx.dosen.findMany({
          where: { userId: { not: null } },
          select: { userId: true },
        })
        const userIdsToDelete = dosenWithUsers
          .map(d => d.userId)
          .filter((id): id is string => !!id)

        deleted.dosen = await tx.dosen.deleteMany({})

        if (userIdsToDelete.length > 0) {
          deleted.userDosen = await tx.user.deleteMany({
            where: { id: { in: userIdsToDelete }, role: 'DOSEN' },
          })
        } else {
          deleted.userDosen = await tx.user.deleteMany({ where: { role: 'DOSEN' } })
        }
        doneCategories.push('dosen')
      }

      // ============ Log aktivitas reset (di akhir) ============
      await tx.aktivitas.create({
        data: {
          userId: null,
          aksi: 'RESET_DATA',
          modul: 'SUPER_ADMIN',
          detail: `Reset data oleh ${actorName}. Kategori: ${doneCategories.join(', ')}. ` +
                  `Total record dihapus: ${Object.values(deleted).reduce((a, b) => a + b, 0)}`,
          ip: null,
        },
      })
    })

    const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      deleted,
      summary: {
        categories: doneCategories,
        totalDeleted,
      },
    })
  } catch (e: any) {
    console.error('[POST /api/super-admin/reset-data]', e)
    if (e?.code === 'P2003') {
      // Foreign key constraint failed
      return NextResponse.json({
        error: 'Gagal reset: ada data yang masih berelasi dengan data lain. Coba reset kategori "Pembagian" dan "Transaksional" terlebih dahulu sebelum reset "Lokasi".',
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Gagal reset data. Silakan coba lagi.' }, { status: 500 })
  }
}
