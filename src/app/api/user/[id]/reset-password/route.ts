import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

const DEFAULT_PASSWORD = 'password123'

// POST - reset user password
// Body (optional): { password?: string }
//   - If `password` is provided and valid (min 6 chars), use it as the new password.
//   - If `password` is empty/omitted, reset to default "password123".
//   - Admin can use this to set a specific password for a user without going
//     through the full Edit User dialog.
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      // Body is optional (e.g. when called without a body); default to reset.
      body = {}
    }

    let newPassword = DEFAULT_PASSWORD
    const customPassword = body?.password
    if (customPassword !== undefined && customPassword !== null && String(customPassword).trim() !== '') {
      const pwd = String(customPassword).trim()
      if (pwd.length < 6) {
        return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
      }
      newPassword = pwd
    }

    const hashed = bcrypt.hashSync(newPassword, 10)
    await db.user.update({
      where: { id },
      data: { password: hashed },
    })

    const isDefault = newPassword === DEFAULT_PASSWORD
    return NextResponse.json({
      success: true,
      message: isDefault
        ? `Password berhasil direset ke default ("${DEFAULT_PASSWORD}")`
        : 'Password berhasil diubah ke password baru yang Anda tentukan',
      isDefault,
    })
  } catch (e) {
    console.error('[POST /api/user/:id/reset-password]', e)
    return NextResponse.json({ error: 'Gagal mereset password' }, { status: 500 })
  }
}
