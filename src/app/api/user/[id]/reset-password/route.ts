import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

const DEFAULT_PASSWORD = 'password123'

// POST - reset user password to default "password123"
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    const hashed = bcrypt.hashSync(DEFAULT_PASSWORD, 10)
    await db.user.update({
      where: { id },
      data: { password: hashed },
    })

    return NextResponse.json({
      success: true,
      message: `Password berhasil direset ke default ("${DEFAULT_PASSWORD}")`,
    })
  } catch (e) {
    console.error('[POST /api/user/:id/reset-password]', e)
    return NextResponse.json({ error: 'Gagal mereset password' }, { status: 500 })
  }
}
