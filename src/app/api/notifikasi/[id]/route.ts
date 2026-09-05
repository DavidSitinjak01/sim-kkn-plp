import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/notifikasi/[id]  — delete a single notification
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
    }
    await db.notifikasi.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[DELETE /api/notifikasi/[id]]', e)
    return NextResponse.json({ error: 'Gagal menghapus notifikasi' }, { status: 500 })
  }
}

// PATCH /api/notifikasi/[id]  Body: { dibaca: boolean }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
    }
    const body = await req.json()
    const updated = await db.notifikasi.update({
      where: { id },
      data: { dibaca: body.dibaca !== false },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PATCH /api/notifikasi/[id]]', e)
    return NextResponse.json({ error: 'Gagal memperbarui notifikasi' }, { status: 500 })
  }
}
