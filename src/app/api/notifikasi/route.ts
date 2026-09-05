import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/notifikasi?userId=xxx&onlyUnread=true&limit=20
// Returns notifications for the given user (most recent first)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')?.trim() ?? ''
    const onlyUnread = searchParams.get('onlyUnread') === 'true'
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam) || 50, 200) : 50

    if (!userId) {
      return NextResponse.json({ error: 'userId wajib diisi' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId }
    if (onlyUnread) where.dibaca = false

    const [items, unreadCount] = await Promise.all([
      db.notifikasi.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.notifikasi.count({ where: { userId, dibaca: false } }),
    ])

    // Parse the `data` JSON field for convenience
    const parsed = items.map((n) => {
      let data: any = null
      try {
        if (n.data) data = JSON.parse(n.data)
      } catch { /* ignore parse errors */ }
      return { ...n, data }
    })

    return NextResponse.json({ items: parsed, unreadCount })
  } catch (e) {
    console.error('[GET /api/notifikasi]', e)
    return NextResponse.json({ error: 'Gagal memuat notifikasi' }, { status: 500 })
  }
}

// POST /api/notifikasi
// Body: { userId, judul, konten, tipe?, data? }
// Used by admin/system to push a notification to a specific user
export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body.userId || typeof body.userId !== 'string') {
      return NextResponse.json({ error: 'userId wajib diisi' }, { status: 400 })
    }
    if (!body.judul || typeof body.judul !== 'string') {
      return NextResponse.json({ error: 'judul wajib diisi' }, { status: 400 })
    }
    if (!body.konten || typeof body.konten !== 'string') {
      return NextResponse.json({ error: 'konten wajib diisi' }, { status: 400 })
    }

    const created = await db.notifikasi.create({
      data: {
        userId: body.userId,
        judul: String(body.judul).trim(),
        konten: String(body.konten).trim(),
        tipe: typeof body.tipe === 'string' ? String(body.tipe) : 'SISTEM',
        data: body.data ? (typeof body.data === 'string' ? body.data : JSON.stringify(body.data)) : null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('[POST /api/notifikasi]', e)
    return NextResponse.json({ error: 'Gagal membuat notifikasi' }, { status: 500 })
  }
}

// PATCH /api/notifikasi  Body: { userId, markAllRead?: true } OR { id, dibaca: true }
// Marks one or all notifications as read for a user
export async function PATCH(req: Request) {
  try {
    const body = await req.json()

    if (body.markAllRead && body.userId) {
      const result = await db.notifikasi.updateMany({
        where: { userId: body.userId, dibaca: false },
        data: { dibaca: true },
      })
      return NextResponse.json({ success: true, updated: result.count })
    }

    if (body.id && typeof body.id === 'string') {
      const updated = await db.notifikasi.update({
        where: { id: body.id },
        data: { dibaca: body.dibaca !== false },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
  } catch (e) {
    console.error('[PATCH /api/notifikasi]', e)
    return NextResponse.json({ error: 'Gagal memperbarui notifikasi' }, { status: 500 })
  }
}
