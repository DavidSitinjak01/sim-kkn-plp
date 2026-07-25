import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const fakultas = await db.fakultas.findMany({
      include: { prodi: true },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json(fakultas)
  } catch (e) {
    return NextResponse.json({ error: 'Gagal memuat data fakultas' }, { status: 500 })
  }
}
