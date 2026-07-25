import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN_FAKULTAS', 'ADMIN_PRODI', 'DOSEN', 'MAHASISWA', 'PIMPINAN']
const VALID_STATUS = ['AKTIF', 'NONAKTIF']

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

// GET - single user by id (exclude password)
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const data = await db.user.findUnique({ where: { id }, select: PUBLIC_SELECT })
    if (!data) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/user/:id]', e)
    return NextResponse.json({ error: 'Gagal memuat user' }, { status: 500 })
  }
}

// PUT - update user. If password provided, hash it; else don't touch password.
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    if (body.role && !VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }

    if (body.status && !VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    // Email uniqueness check (if changed)
    if (body.email && body.email !== existing.email) {
      const email = String(body.email).trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
      }
      const dup = await db.user.findUnique({ where: { email } })
      if (dup) {
        return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 400 })
      }
    }

    // Optional password update
    let hashed: string | undefined
    if (body.password !== undefined && body.password !== null && String(body.password).trim() !== '') {
      if (String(body.password).length < 6) {
        return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
      }
      hashed = bcrypt.hashSync(String(body.password), 10)
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(body.email !== undefined && { email: String(body.email).trim().toLowerCase() }),
        ...(body.name !== undefined && { name: String(body.name).trim() }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(body.avatar !== undefined && { avatar: body.avatar?.trim() || null }),
        ...(hashed !== undefined && { password: hashed }),
      },
      select: PUBLIC_SELECT,
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('[PUT /api/user/:id]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui user' }, { status: 500 })
  }
}

// DELETE - remove user
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    await db.user.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'User berhasil dihapus' })
  } catch (e: any) {
    console.error('[DELETE /api/user/:id]', e)
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'User tidak dapat dihapus karena masih memiliki data terkait' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Gagal menghapus user' }, { status: 500 })
  }
}
