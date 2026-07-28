import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Login uses `username` (plain name, NOT email format).
    // For backward compatibility, also accept legacy `email` field if `username` is missing.
    const usernameRaw = (body.username ?? body.email ?? '').toString()
    const password = body.password

    if (!usernameRaw || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
    }

    const username = usernameRaw.trim().toLowerCase()

    // Look up by username (case-insensitive — stored lowercase by API on create/update).
    const user = await db.user.findUnique({
      where: { username },
    })

    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    if (user.status !== 'AKTIF') {
      return NextResponse.json({ error: 'Akun Anda dinonaktifkan. Hubungi administrator.' }, { status: 403 })
    }

    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    await db.aktivitas.create({
      data: { userId: user.id, aksi: 'LOGIN', modul: 'AUTH', detail: 'Login berhasil', ip: req.headers.get('x-forwarded-for') || 'unknown' }
    })

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
    })
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
