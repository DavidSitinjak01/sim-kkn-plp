import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN_FAKULTAS', 'ADMIN_PRODI', 'DOSEN', 'MAHASISWA', 'PIMPINAN']
const VALID_STATUS = ['AKTIF', 'NONAKTIF']

// Username must be 3-30 chars: letters, digits, dot, underscore, hyphen.
// NO email format, NO spaces.
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Public select (NEVER include password)
const PUBLIC_SELECT = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  avatar: true,
  status: true,
  phone: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
}

// GET - list all users (excludes password)
// Support ?role=, ?status=, ?search= (username, name, email)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')?.trim().toUpperCase() ?? ''
    const status = searchParams.get('status')?.trim().toUpperCase() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    const where: Record<string, unknown> = {}
    if (role && VALID_ROLES.includes(role)) where.role = role
    if (status && VALID_STATUS.includes(status)) where.status = status
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { name: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const data = await db.user.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/user]', e)
    return NextResponse.json({ error: 'Gagal memuat data user' }, { status: 500 })
  }
}

// POST - create new user
// Body: { username, password, name, role, email?, phone?, status? }
// username = plain login name (NOT email format, min 3 chars, alphanum + . _ -)
// email = optional contact email
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const required = ['username', 'password', 'name', 'role']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
        return NextResponse.json({ error: `Field ${f} wajib diisi` }, { status: 400 })
      }
    }

    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }

    if (String(body.password).length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    const username = String(body.username).trim().toLowerCase()
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: 'Username 3-30 karakter, hanya huruf/angka/titik/underscore/tanda hubung. Tidak boleh format email.' },
        { status: 400 }
      )
    }
    // Reject if it looks like an email
    if (EMAIL_RE.test(username) || username.includes('@')) {
      return NextResponse.json({ error: 'Username tidak boleh berupa email. Gunakan nama biasa.' }, { status: 400 })
    }

    // Optional email validation
    let email: string | null = null
    if (body.email !== undefined && body.email !== null && String(body.email).trim() !== '') {
      email = String(body.email).trim().toLowerCase()
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
      }
    }

    // Check duplicate username
    const exist = await db.user.findUnique({ where: { username } })
    if (exist) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 400 })
    }

    // Check duplicate email (if provided)
    if (email) {
      const dupEmail = await db.user.findUnique({ where: { email } })
      if (dupEmail) {
        return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
      }
    }

    const status = body.status ?? 'AKTIF'
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const hashed = bcrypt.hashSync(String(body.password), 10)

    const created = await db.user.create({
      data: {
        username,
        email,
        password: hashed,
        name: String(body.name).trim(),
        role: body.role,
        phone: body.phone?.trim() || null,
        avatar: body.avatar?.trim() || null,
        status,
      },
      select: PUBLIC_SELECT,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/user]', e)
    if (e?.code === 'P2002') {
      const target = e?.meta?.target?.[0] ?? 'username'
      return NextResponse.json(
        { error: target === 'email' ? 'Email sudah terdaftar' : 'Username sudah digunakan' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Gagal membuat user' }, { status: 500 })
  }
}
