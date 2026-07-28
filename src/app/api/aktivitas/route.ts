import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - list all aktivitas, support ?modul=, ?aksi=, ?userId=
// Ordered by createdAt desc, limit 200
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const modul = searchParams.get('modul')?.trim() ?? ''
    const aksi = searchParams.get('aksi')?.trim().toUpperCase() ?? ''
    const userId = searchParams.get('userId')?.trim() ?? ''

    const where: Record<string, unknown> = {}
    if (modul) where.modul = modul
    if (aksi) where.aksi = aksi
    if (userId) where.userId = userId

    const data = await db.aktivitas.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, username: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/aktivitas]', e)
    return NextResponse.json({ error: 'Gagal memuat data aktivitas' }, { status: 500 })
  }
}
