// Quick script to set Ahmad Pratama (NIM 202200001) status to AKTIF
import { db } from '../src/lib/db'

async function main() {
  const updated = await db.mahasiswa.updateMany({
    where: { nim: '202200001' },
    data: { status: 'AKTIF' },
  })
  console.log(`✅ Updated ${updated.count} mahasiswa record(s): set Ahmad Pratama (NIM 202200001) to AKTIF`)

  // Verify
  const mhs = await db.mahasiswa.findUnique({ where: { nim: '202200001' } })
  console.log(`   Verified: nama=${mhs?.nama}, nim=${mhs?.nim}, status=${mhs?.status}`)
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
