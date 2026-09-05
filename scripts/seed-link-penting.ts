// One-off seed script: insert default LinkPenting rows (SISTER, SIAKAD, dll).
// Run with: bunx tsx scripts/seed-link-penting.ts
import { db } from '../src/lib/db'

const SEED_LINKS = [
  {
    judul: 'SISTER UNIRAYA',
    url: 'https://sister.uniraya.ac.id',
    deskripsi: 'Sistem Informasi Terpadu Ressort & Akademik — portal utama untuk manajemen data akademik kampus.',
    kategori: 'Sistem Informasi',
    icon: 'building',
    urutan: 1,
  },
  {
    judul: 'SIAKAD',
    url: 'https://siakad.uniraya.ac.id',
    deskripsi: 'Sistem Informasi Akademik untuk pengelolaan KRS, KHS, jadwal kuliah, dan transkrip nilai mahasiswa.',
    kategori: 'Akademik',
    icon: 'graduation',
    urutan: 2,
  },
  {
    judul: 'E-Learning UNIRAYA',
    url: 'https://elearning.uniraya.ac.id',
    deskripsi: 'Platform pembelajaran daring untuk mata kuliah, materi, tugas, dan kuis.',
    kategori: 'Akademik',
    icon: 'book',
    urutan: 3,
  },
  {
    judul: 'Simpeg (Kepegawaian)',
    url: 'https://simpeg.uniraya.ac.id',
    deskripsi: 'Sistem Informasi Kepegawaian untuk data dosen, tendik, dan administrasi SDM.',
    kategori: 'Kepegawaian',
    icon: 'users',
    urutan: 4,
  },
  {
    judul: 'Repository Jurnal',
    url: 'https://repository.uniraya.ac.id',
    deskripsi: 'Repositori digital publikasi ilmiah, jurnal, dan karya akademik dosen & mahasiswa.',
    kategori: 'Akademik',
    icon: 'file',
    urutan: 5,
  },
  {
    judul: 'Website UNIRAYA',
    url: 'https://uniraya.ac.id',
    deskripsi: 'Website resmi Universitas Nias Raya — informasi publik, berita, dan pengumuman kampus.',
    kategori: 'Umum',
    icon: 'globe',
    urutan: 6,
  },
] as const

async function main() {
  console.log('Seeding LinkPenting...')
  let inserted = 0
  let skipped = 0
  for (const link of SEED_LINKS) {
    // Skip if a link with the same URL already exists (idempotent).
    const existing = await db.linkPenting.findFirst({ where: { url: link.url } })
    if (existing) {
      skipped++
      continue
    }
    await db.linkPenting.create({
      data: {
        judul: link.judul,
        url: link.url,
        deskripsi: link.deskripsi,
        kategori: link.kategori,
        icon: link.icon,
        urutan: link.urutan,
        status: 'AKTIF',
      },
    })
    inserted++
    console.log(`  + ${link.judul}`)
  }
  console.log(`\nDone. Inserted: ${inserted}, skipped (already exist): ${skipped}`)
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
