import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  const defaultPass = bcrypt.hashSync('password123', 10)
  const mahasiswas = await db.mahasiswa.findMany({
    where: { userId: null },
  })

  console.log(`Found ${mahasiswas.length} mahasiswa without user accounts`)

  let created = 0
  for (const m of mahasiswas) {
    const existing = await db.user.findUnique({ where: { email: m.email } })
    if (existing) {
      await db.mahasiswa.update({ where: { id: m.id }, data: { userId: existing.id } })
      continue
    }
    const u = await db.user.create({
      data: {
        email: m.email,
        password: defaultPass,
        name: m.nama,
        role: 'MAHASISWA',
        phone: m.noHp,
        status: 'AKTIF',
      },
    })
    await db.mahasiswa.update({ where: { id: m.id }, data: { userId: u.id } })
    created++
  }

  console.log(`Created ${created} new user accounts for mahasiswa`)
  console.log('Done!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
