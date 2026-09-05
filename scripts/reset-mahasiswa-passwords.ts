// One-time script: reset all mahasiswa User passwords to "123456"
// Run this once so existing mahasiswa accounts match the new default password scheme.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🔄 Resetting all mahasiswa User passwords to "123456"...')

  // Find all Users with role=MAHASISWA
  const users = await db.user.findMany({
    where: { role: 'MAHASISWA' },
    include: { mahasiswa: true },
  })
  console.log(`   Found ${users.length} mahasiswa User accounts`)

  const hash = bcrypt.hashSync('123456', 10)
  let updated = 0
  let alreadyLinked = 0
  let unlinkedSkipped = 0

  for (const u of users) {
    if (!u.mahasiswa) {
      // User exists but not linked to a Mahasiswa record — skip (probably orphan)
      unlinkedSkipped++
      continue
    }
    // Sync name with Mahasiswa.nama (in case they diverged) + set password
    await db.user.update({
      where: { id: u.id },
      data: {
        password: hash,
        name: u.mahasiswa.nama,
        status: 'AKTIF',
      },
    })
    updated++
    alreadyLinked++
  }

  console.log(`\n✅ Done!`)
  console.log(`   - ${updated} accounts reset to password "123456"`)
  console.log(`   - ${alreadyLinked} accounts already linked to Mahasiswa records`)
  console.log(`   - ${unlinkedSkipped} orphan Users skipped`)

  // Quick verification: try to find Ahmad Pratama and confirm
  const ap = await db.user.findFirst({
    where: { name: 'Ahmad Pratama', role: 'MAHASISWA' },
    include: { mahasiswa: true },
  })
  if (ap) {
    const ok = bcrypt.compareSync('123456', ap.password)
    console.log(`\n   Verify Ahmad Pratama: name=${ap.name}, email=${ap.email}, password matches "123456" = ${ok}`)
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
