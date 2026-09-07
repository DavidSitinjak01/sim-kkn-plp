import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProdiKuotaStatus, setProdiKuota } from '@/lib/prodi-kuota'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/desa/[id]/prodi-kuota
 *
 * Mengembalikan status kuota per prodi untuk sebuah desa (KKN):
 *   [{ prodiId, prodiNama, prodiKode, jenjang, current, max, overridden, exceeded }]
 *
 * RESILIENT: Kalau tabel prodi-kuota belum ada di DB (production belum di-migrate),
 * return 503 dengan pesan migrasi yang jelas.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const desa = await db.desa.findUnique({ where: { id }, select: { id: true } })
    if (!desa) {
      return NextResponse.json({ error: 'Desa tidak ditemukan' }, { status: 404 })
    }
    const status = await getProdiKuotaStatus('desa', id)
    return NextResponse.json(status)
  } catch (e: any) {
    console.error('[GET /api/desa/:id/prodi-kuota]', e)
    if (e?.code === 'P2021' || /does not exist/i.test(e?.message ?? '')) {
      return NextResponse.json(
        { error: 'Fitur batas prodi belum aktif di production DB. Jalankan `prisma db push` untuk mengaktifkannya.', code: 'SCHEMA_NOT_MIGRATED' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Gagal memuat status kuota prodi' }, { status: 500 })
  }
}

/**
 * PUT /api/desa/[id]/prodi-kuota
 *
 * Body: { items: [{ prodiId, maxKuota }] }
 *   - maxKuota: 0 = unlimited, 1+ = batas eksplisit, default 3
 *
 * Strategy: replace-all (delete existing overrides, insert new ones).
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const desa = await db.desa.findUnique({ where: { id }, select: { id: true } })
    if (!desa) {
      return NextResponse.json({ error: 'Desa tidak ditemukan' }, { status: 404 })
    }

    const body = await req.json()
    const items = Array.isArray(body?.items) ? body.items : null
    if (!items) {
      return NextResponse.json({ error: 'Body harus { items: [{ prodiId, maxKuota }] }' }, { status: 400 })
    }

    for (const it of items) {
      if (!it?.prodiId || typeof it.prodiId !== 'string') {
        return NextResponse.json({ error: 'Setiap item harus { prodiId, maxKuota }' }, { status: 400 })
      }
      const mk = Number(it.maxKuota)
      if (!Number.isInteger(mk) || mk < 0) {
        return NextResponse.json({ error: `maxKuota untuk prodi ${it.prodiId} tidak valid (harus integer >= 0)` }, { status: 400 })
      }
    }

    await setProdiKuota('desa', id, items.map((it: any) => ({ prodiId: it.prodiId, maxKuota: Number(it.maxKuota) })))

    const status = await getProdiKuotaStatus('desa', id)
    return NextResponse.json({ success: true, status })
  } catch (e: any) {
    console.error('[PUT /api/desa/:id/prodi-kuota]', e)
    if (e?.code === 'P2021' || /does not exist/i.test(e?.message ?? '') || /prisma db push/i.test(e?.message ?? '')) {
      return NextResponse.json(
        { error: 'Fitur batas prodi belum aktif di production DB. Jalankan `prisma db push` untuk mengaktifkannya.', code: 'SCHEMA_NOT_MIGRATED' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Gagal menyimpan kuota prodi' }, { status: 500 })
  }
}
