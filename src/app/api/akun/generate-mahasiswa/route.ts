import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// ============ GET /api/akun/generate-mahasiswa ============
// Returns list of all mahasiswa + their account status (has User account or not)
// Used by the admin UI to show pending accounts before generation.
export async function GET() {
  try {
    const allMhs = await db.mahasiswa.findMany({
      include: {
        prodi: { select: { nama: true } },
        user: { select: { id: true, email: true, name: true, status: true, lastLogin: true } },
      },
      orderBy: [{ angkatan: 'desc' }, { nama: 'asc' }],
    })

    const data = allMhs.map((m) => ({
      id: m.id,
      nim: m.nim,
      nama: m.nama,
      prodi: m.prodi?.nama ?? '-',
      angkatan: m.angkatan,
      status: m.status,
      hasAccount: !!m.user,
      userEmail: m.user?.email ?? null,
      userName: m.user?.name ?? null,
      userStatus: m.user?.status ?? null,
      lastLogin: m.user?.lastLogin ?? null,
    }))

    const summary = {
      total: data.length,
      withAccount: data.filter((d) => d.hasAccount).length,
      withoutAccount: data.filter((d) => !d.hasAccount).length,
      aktifMhs: data.filter((d) => d.status === 'AKTIF').length,
    }

    return NextResponse.json({ data, summary })
  } catch (e) {
    console.error('[GET /api/akun/generate-mahasiswa]', e)
    return NextResponse.json({ error: 'Gagal memuat data mahasiswa' }, { status: 500 })
  }
}

// ============ POST /api/akun/generate-mahasiswa ============
// Body: {
//   password?: string (default "123456")
//   mode: 'all' | 'missing' | 'selected'
//   mahasiswaIds?: string[] (required when mode='selected')
// }
// - mode='missing': only generate accounts for mahasiswa without linked User
// - mode='all': generate/update ALL mahasiswa accounts (existing users get password reset to default)
// - mode='selected': only process the specified mahasiswa IDs
//
// For each processed mahasiswa:
// - If no User: create User (email = mhs.{nim}@mhs.kknplp.ac.id, name = mhs.nama, password = bcrypt(password), role=MAHASISWA, status=AKTIF)
// - If User exists: update password to bcrypt(password), ensure name = mhs.nama, status=AKTIF
// - Link Mahasiswa.userId = User.id
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const password = String(body?.password ?? '123456').trim() || '123456'
    const mode: 'all' | 'missing' | 'selected' = body?.mode ?? 'missing'
    const mahasiswaIds: string[] = Array.isArray(body?.mahasiswaIds) ? body.mahasiswaIds : []

    if (mode === 'selected' && mahasiswaIds.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu mahasiswa untuk diproses' }, { status: 400 })
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'Password minimal 4 karakter' }, { status: 400 })
    }

    // Build where clause
    const where: Record<string, unknown> = {}
    if (mode === 'selected') {
      where.id = { in: mahasiswaIds }
    }

    const mahasiswas = await db.mahasiswa.findMany({
      where,
      include: { user: true },
      orderBy: [{ angkatan: 'desc' }, { nama: 'asc' }],
    })

    if (mahasiswas.length === 0) {
      return NextResponse.json({ error: 'Tidak ada mahasiswa yang cocok dengan kriteria' }, { status: 404 })
    }

    const hashedPassword = bcrypt.hashSync(password, 10)

    let created = 0
    let updated = 0
    let skipped = 0
    const results: {
      mahasiswaId: string
      nim: string
      nama: string
      action: 'created' | 'updated' | 'skipped'
      username: string
      email: string
    }[] = []

    for (const m of mahasiswas) {
      // Skip non-AKTIF mahasiswa
      if (m.status !== 'AKTIF') {
        skipped++
        results.push({
          mahasiswaId: m.id, nim: m.nim, nama: m.nama,
          action: 'skipped', username: m.nama, email: '-',
        })
        continue
      }

      // For 'missing' mode, skip mahasiswa that already have a User
      if (mode === 'missing' && m.user) {
        skipped++
        results.push({
          mahasiswaId: m.id, nim: m.nim, nama: m.nama,
          action: 'skipped', username: m.nama, email: m.user.email,
        })
        continue
      }

      const email = `mhs.${m.nim}@mhs.kknplp.ac.id`

      if (m.user) {
        // Update existing User: reset password + sync name + ensure AKTIF
        await db.user.update({
          where: { id: m.user.id },
          data: {
            password: hashedPassword,
            name: m.nama, // keep in sync with Mahasiswa.nama
            status: 'AKTIF',
          },
        })
        updated++
        results.push({
          mahasiswaId: m.id, nim: m.nim, nama: m.nama,
          action: 'updated', username: m.nama, email,
        })
      } else {
        // Check email collision (extremely unlikely since NIM is unique, but be safe)
        const existingByEmail = await db.user.findUnique({ where: { email } })
        if (existingByEmail) {
          // Link the existing user instead of creating a new one
          await db.user.update({
            where: { id: existingByEmail.id },
            data: {
              password: hashedPassword,
              name: m.nama,
              role: 'MAHASISWA',
              status: 'AKTIF',
            },
          })
          await db.mahasiswa.update({
            where: { id: m.id },
            data: { userId: existingByEmail.id },
          })
          updated++
          results.push({
            mahasiswaId: m.id, nim: m.nim, nama: m.nama,
            action: 'updated', username: m.nama, email,
          })
        } else {
          // Create new User + link
          const newUser = await db.user.create({
            data: {
              email,
              password: hashedPassword,
              name: m.nama,
              role: 'MAHASISWA',
              status: 'AKTIF',
              phone: m.noHp,
            },
          })
          await db.mahasiswa.update({
            where: { id: m.id },
            data: { userId: newUser.id },
          })
          created++
          results.push({
            mahasiswaId: m.id, nim: m.nim, nama: m.nama,
            action: 'created', username: m.nama, email,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: mahasiswas.length,
        created,
        updated,
        skipped,
        defaultPassword: password,
      },
      results,
    })
  } catch (e: any) {
    console.error('[POST /api/akun/generate-mahasiswa]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({
        error: 'Konflik email. Ada akun dengan email yang sama sudah ada. Coba lagi.',
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Gagal generate akun mahasiswa' }, { status: 500 })
  }
}
