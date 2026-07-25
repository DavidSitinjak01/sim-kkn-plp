import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const prodi = await db.programStudi.findMany({
      include: { fakultas: true },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json(prodi)
  } catch (e) {
    return NextResponse.json({ error: 'Gagal memuat data prodi' }, { status: 500 })
  }
}
