import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - return all pengaturan as { key: value } object
export async function GET() {
  try {
    const rows = await db.pengaturan.findMany()
    const obj: Record<string, string> = {}
    for (const r of rows) obj[r.key] = r.value
    return NextResponse.json(obj)
  } catch (e) {
    console.error('[GET /api/pengaturan]', e)
    return NextResponse.json({ error: 'Gagal memuat pengaturan' }, { status: 500 })
  }
}

// PUT - update multiple settings at once
// Body: { settings: { key: value, ... } } — upsert each
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const settings: Record<string, string> = body?.settings
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ error: 'Body harus berisi { settings: { key: value } }' }, { status: 400 })
    }

    const entries = Object.entries(settings)
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Tidak ada pengaturan yang dikirim' }, { status: 400 })
    }

    // Upsert each key — value must be string
    await Promise.all(
      entries.map(([key, value]) => {
        let val = String(value ?? '')
        // Server-side sanitization for URL fields: if user somehow sent HTML
        // (e.g. imgbb share code), extract the real image URL. Prevents
        // broken logo/favicon from being persisted in the database.
        if (key === 'logo_url' || key === 'favicon_url') {
          val = val.trim()
          if (val && /<[a-z!]/i.test(val)) {
            const m = val.match(/https?:\/\/[^\s"'<>\]]+\.(?:png|jpg|jpeg|gif|svg|webp|ico)(?:\?[^\s"'<>\]]*)?/i)
              || val.match(/https?:\/\/[^\s"'<>\]]+/i)
            val = m ? m[0] : ''
          }
        }
        return db.pengaturan.upsert({
          where: { key },
          update: { value: val },
          create: { key, value: val },
        })
      })
    )

    // Return the updated state for convenience
    const rows = await db.pengaturan.findMany()
    const obj: Record<string, string> = {}
    for (const r of rows) obj[r.key] = r.value

    return NextResponse.json({ success: true, settings: obj })
  } catch (e) {
    console.error('[PUT /api/pengaturan]', e)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
  }
}
