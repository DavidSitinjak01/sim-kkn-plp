import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ GET single pendaftaran ============
export async function GET(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const data = await db.pendaftaran.findUnique({
      where: { id },
      include: { prodi: { include: { fakultas: true } } },
    })
    if (!data) return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/pendaftaran/[id]]', e)
    return NextResponse.json({ error: 'Gagal memuat data pendaftaran' }, { status: 500 })
  }
}

// ============ PATCH - update status (approve/reject) OR full data edit ============
// Two modes:
//   1) JSON body { status, catatan }       -> update status only (approve/reject flow)
//   2) JSON body { edit: true, ...fields } -> edit all data fields (admin correction)
export async function PATCH(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json()

    const existing = await db.pendaftaran.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })

    // ============ Mode 1: Status update (approve/reject) ============
    if (!body.edit) {
      const { status, catatan } = body
      if (!['PENDING', 'APPROVED', 'REJECTED', 'IMPORTED'].includes(status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
      }
      const updated = await db.pendaftaran.update({
        where: { id },
        data: {
          status,
          catatan: catatan !== undefined ? String(catatan ?? '') : existing.catatan,
        },
      })
      return NextResponse.json(updated)
    }

    // ============ Mode 2: Full data edit (admin correction) ============
    // Editable fields: namaLengkap, nim, prodiId, prodiNama, jurusan,
    //                  jenisKelamin, noWa, punyaMotor, alamat, foto, catatan
    const namaLengkap = (body.namaLengkap as string | undefined)?.trim() ?? ''
    const nim = (body.nim as string | undefined)?.trim() ?? ''
    const prodiNama = (body.prodiNama as string | undefined)?.trim() ?? ''
    const jurusan = (body.jurusan as string | undefined)?.trim() ?? ''
    const jenisKelamin = (body.jenisKelamin as string | undefined)?.trim() ?? ''
    const noWa = (body.noWa as string | undefined)?.trim() ?? ''
    const punyaMotorVal = (body.punyaMotor as string | undefined)?.trim() ?? ''
    const alamat = (body.alamat as string | undefined)?.trim() ?? ''
    const prodiIdRaw = (body.prodiId as string | undefined)?.trim() ?? ''
    const foto = (body.foto as string | undefined)?.trim() ?? ''
    const catatan = (body.catatan as string | undefined)?.trim() ?? ''

    // Validation
    if (!namaLengkap) return NextResponse.json({ error: 'Nama lengkap wajib diisi' }, { status: 400 })
    if (!nim) return NextResponse.json({ error: 'NIM wajib diisi' }, { status: 400 })
    if (!prodiNama) return NextResponse.json({ error: 'Program Studi wajib diisi' }, { status: 400 })
    if (!jurusan) return NextResponse.json({ error: 'Jurusan wajib diisi' }, { status: 400 })
    if (!['L', 'P'].includes(jenisKelamin)) {
      return NextResponse.json({ error: 'Jenis kelamin tidak valid (harus L atau P)' }, { status: 400 })
    }
    if (!noWa) return NextResponse.json({ error: 'No WhatsApp aktif wajib diisi' }, { status: 400 })
    if (!['true', 'false'].includes(punyaMotorVal)) {
      return NextResponse.json({ error: 'Ketersediaan kendaraan motor wajib dipilih' }, { status: 400 })
    }
    if (!alamat) return NextResponse.json({ error: 'Alamat wajib diisi' }, { status: 400 })

    // If foto is provided (data URL), validate it is a valid image data URL
    if (foto && !foto.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Format foto tidak valid' }, { status: 400 })
    }

    // NIM uniqueness check (exclude current record)
    const dup = await db.pendaftaran.findFirst({
      where: { nim, NOT: { id } },
      select: { id: true },
    })
    if (dup) {
      return NextResponse.json({ error: 'NIM sudah digunakan pendaftar lain' }, { status: 400 })
    }
    // Also ensure not colliding with an existing Mahasiswa record (unless it's this
    // pendaftaran's own imported mahasiswa)
    const mhsDup = await db.mahasiswa.findFirst({
      where: { nim, ...(existing.importedMahasiswaId ? { NOT: { id: existing.importedMahasiswaId } } : {}) },
      select: { id: true },
    })
    if (mhsDup) {
      return NextResponse.json({ error: 'NIM sudah terdaftar sebagai mahasiswa aktif' }, { status: 400 })
    }

    // Validate prodiId if provided
    let validProdiId: string | null = null
    if (prodiIdRaw) {
      const prodi = await db.programStudi.findUnique({ where: { id: prodiIdRaw } })
      if (prodi) validProdiId = prodi.id
    }

    const updated = await db.pendaftaran.update({
      where: { id },
      data: {
        namaLengkap,
        nim,
        prodiId: validProdiId,
        prodiNama,
        jurusan,
        jenisKelamin,
        noWa,
        punyaMotor: punyaMotorVal === 'true',
        alamat,
        // Only overwrite foto if a new one is provided (keep old photo if empty)
        ...(foto ? { foto } : {}),
        catatan,
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('[PATCH /api/pendaftaran/[id]]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIM sudah digunakan pendaftar lain' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui data pendaftaran' }, { status: 500 })
  }
}

// ============ DELETE - remove pendaftaran ============
export async function DELETE(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const existing = await db.pendaftaran.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })

    await db.pendaftaran.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[DELETE /api/pendaftaran/[id]]', e)
    return NextResponse.json({ error: 'Gagal menghapus pendaftaran' }, { status: 500 })
  }
}
