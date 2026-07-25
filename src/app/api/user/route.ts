import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN_FAKULTAS', 'ADMIN_PRODI', 'DOSEN', 'MAHASISWA', 'PIMPINAN']
const VALID_STATUS = ['AKTIF', 'NONAKTIF']

// Public select (NEVER include password)
const PUBLIC_SELECT = {
  id: true,
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
// Support ?role=, ?status=, ?search= (email, name)
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
        { email: { contains: search } },
        { name: { contains: search } },
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
// Body: { email, password, name, role, phone?, status? }
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const required = ['email', 'password', 'name', 'role']
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

    const email = String(body.email).trim().toLowerCase()
    // Basic email shape check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
    }

    // Check duplicate email
    const exist = await db.user.findUnique({ where: { email } })
    if (exist) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
    }

    const status = body.status ?? 'AKTIF'
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const hashed = bcrypt.hashSync(String(body.password), 10)

    const created = await db.user.create({
      data: {
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
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal membuat user' }, { status: 500 })
  }
}
