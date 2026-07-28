/**
 * One-off migration: backfill `username` for existing User rows.
 *
 * Strategy:
 * - If row already has username set, skip.
 * - Else derive username from email (part before "@"). E.g. "superadmin@kknplp.ac.id" -> "superadmin".
 * - Normalize to lowercase, trim.
 * - De-duplicate collisions by appending a numeric suffix (e.g. "suparman", "suparman2").
 *
 * Run: `bun run scripts/backfill-username.ts`
 */
import { db } from '@/lib/db'

function toUsername(email: string | null | undefined): string {
  if (!email) return ''
  const base = email.trim().toLowerCase().split('@')[0] ?? ''
  return base.replace(/[^a-z0-9._-]/g, '')
}

async function main() {
  const users = await db.user.findMany({ select: { id: true, username: true, email: true, name: true } })
  console.log(`Found ${users.length} users to inspect`)

  // Build set of existing usernames (lowercase) to dedupe against
  const taken = new Set<string>()
  for (const u of users) {
    if (u.username) taken.add(u.username.toLowerCase())
  }

  let updated = 0
  let skipped = 0

  for (const u of users) {
    if (u.username && u.username.trim() !== '') {
      skipped++
      continue
    }
    let username = toUsername(u.email)
    if (!username) {
      // fallback: slugify name
      username = (u.name || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 30)
    }
    if (!username) username = 'user'

    // De-dup
    let candidate = username
    let n = 2
    while (taken.has(candidate.toLowerCase())) {
      candidate = `${username}${n}`
      n++
    }
    username = candidate
    taken.add(username.toLowerCase())

    await db.user.update({ where: { id: u.id }, data: { username } })
    console.log(`  • ${u.email ?? '(no email)'} -> username="${username}"`)
    updated++
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already set): ${skipped}`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
