/**
 * sync-prisma-provider.ts
 *
 * Switches the Prisma datasource provider in prisma/schema.prisma based on
 * the DATABASE_URL environment variable:
 *
 *   - DATABASE_URL starts with "file:"  -> provider = "sqlite"   (local dev)
 *   - DATABASE_URL starts with "postgres" -> provider = "postgresql" (Vercel/Neon/Supabase)
 *
 * Why this exists:
 * Vercel's serverless filesystem is ephemeral, so SQLite files are lost on
 * every cold start. For production we MUST use a managed PostgreSQL. But for
 * local dev, SQLite is far more convenient (no docker, no DB server).
 *
 * This script is invoked automatically via the `predev`, `prebuild`,
 * `predb:push`, `predb:seed`, and `postinstall` npm scripts so the schema
 * is always in sync with the active DATABASE_URL before any Prisma command
 * runs. On Vercel, `postinstall` fires during install and switches to
 * postgresql before `prisma generate`.
 *
 * This is a workaround for Prisma not supporting a dynamic provider via
 * env var (https://github.com/prisma/prisma/issues/7247). It is idempotent
 * and safe to run multiple times.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')

if (!existsSync(schemaPath)) {
  console.error('❌ prisma/schema.prisma not found')
  process.exit(1)
}

const dbUrl = process.env.DATABASE_URL || ''
const wantsSqlite = dbUrl.startsWith('file:')
const wantsPostgres = dbUrl.startsWith('postgres')
const targetProvider = wantsSqlite ? 'sqlite' : wantsPostgres ? 'postgresql' : null

if (!targetProvider) {
  // DATABASE_URL is empty or unrecognized — leave schema untouched so we
  // don't accidentally break a working setup. Prisma will complain at
  // runtime with a clearer error.
  console.warn(
    '⚠️  DATABASE_URL is not set or unrecognized (expected "file:..." or "postgres...").\n' +
      '    Leaving prisma/schema.prisma provider unchanged.\n' +
      '    Set DATABASE_URL in .env (local) or Vercel project settings (prod).',
  )
  process.exit(0)
}

const original = readFileSync(schemaPath, 'utf8')

// Match:  provider = "sqlite"      OR      provider = "postgresql"
// (with any surrounding whitespace)
const providerRegex = /(\bprovider\s*=\s*)"(sqlite|postgresql)"/
const match = original.match(providerRegex)

if (!match) {
  console.error('❌ Could not find `provider = "..."` in prisma/schema.prisma')
  process.exit(1)
}

const currentProvider = match[2]
if (currentProvider === targetProvider) {
  console.log(`✓ Prisma provider already set to "${targetProvider}" (matches DATABASE_URL)`)
  process.exit(0)
}

const updated = original.replace(providerRegex, `${match[1]}"${targetProvider}"`)
writeFileSync(schemaPath, updated)
console.log(`✓ Switched Prisma provider: "${currentProvider}" -> "${targetProvider}" (based on DATABASE_URL)`)
