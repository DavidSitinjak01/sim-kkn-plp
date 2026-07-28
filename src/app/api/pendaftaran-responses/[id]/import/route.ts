import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseFormFields,
  parseResponseData,
  REQUIRED_SYSTEM_KEYS,
} from '@/lib/form-field-def'

// ============ POST - import response to Mahasiswa ============
// Body: { tempatLahir, tanggalLahir (ISO), email, semester (int), angkatan (int), prodiId }
// Reads response.data JSON + form.fields, extracts system keys.
// Validates all required system keys present (returns 400 with clear message if missing).
// Creates Mahasiswa record. Marks response status='IMPORTED'.
// Returns { success: true, mahasiswaId }.
export async function POST(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json()
    const { tempatLahir, tanggalLahir, email, semester, angkatan, prodiId } = body

    // Validate extra required fields for Mahasiswa
    if (!tempatLahir || !String(tempatLahir).trim()) {
      return NextResponse.json({ error: 'Tempat lahir wajib diisi' }, { status: 400 })
    }
    if (!tanggalLahir) {
      return NextResponse.json({ error: 'Tanggal lahir wajib diisi' }, { status: 400 })
    }
    const parsedDate = new Date(tanggalLahir)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Tanggal lahir tidak valid' }, { status: 400 })
    }
    if (!email || !String(email).trim()) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }
    const sem = Number(semester)
    if (!Number.isInteger(sem) || sem < 1) {
      return NextResponse.json({ error: 'Semester tidak valid' }, { status: 400 })
    }
    const angk = Number(angkatan)
    if (!Number.isInteger(angk) || angk < 2000) {
      return NextResponse.json({ error: 'Angkatan tidak valid' }, { status: 400 })
    }
    if (!prodiId || !String(prodiId).trim()) {
      return NextResponse.json({ error: 'Program Studi wajib dipilih' }, { status: 400 })
    }

    const response = await db.pendaftaranResponse.findUnique({
      where: { id },
      include: { form: true },
    })
    if (!response) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    }

    const fields = parseFormFields(response.form?.fields)
    const data = parseResponseData(response.data)

    // Validate presence of all required system keys
    const fieldKeys = new Set(fields.map((f) => f.key))
    const missingKeys = REQUIRED_SYSTEM_KEYS.filter((k) => !fieldKeys.has(k))
    if (missingKeys.length > 0) {
      return NextResponse.json(
        {
          error: `Form belum memiliki field sistem yang wajib: ${missingKeys.join(', ')}. Tambahkan field ini ke form sebelum mengimpor.`,
        },
        { status: 400 }
      )
    }

    // Extract values
    const namaLengkap = (data['namaLengkap'] || '').trim()
    const nim = (data['nim'] || '').trim()
    const jenisKelaminRaw = (data['jenisKelamin'] || '').trim().toUpperCase()
    const noWa = (data['noWa'] || '').trim()
    const alamat = (data['alamat'] || '').trim()
    const foto = (data['foto'] || '').trim()

    if (!namaLengkap) {
      return NextResponse.json({ error: 'Nama lengkap tidak ditemukan di data pendaftaran' }, { status: 400 })
    }
    if (!nim) {
      return NextResponse.json({ error: 'NIM tidak ditemukan di data pendaftaran' }, { status: 400 })
    }
    if (!['L', 'P'].includes(jenisKelaminRaw)) {
      return NextResponse.json(
        { error: `Jenis kelamin tidak valid (harus L atau P), ditemukan: "${jenisKelaminRaw}"` },
        { status: 400 }
      )
    }
    if (!noWa) {
      return NextResponse.json({ error: 'Nomor WhatsApp tidak ditemukan di data pendaftaran' }, { status: 400 })
    }
    if (!alamat) {
      return NextResponse.json({ error: 'Alamat tidak ditemukan di data pendaftaran' }, { status: 400 })
    }

    // Verify prodi exists
    const prodi = await db.programStudi.findUnique({ where: { id: String(prodiId).trim() } })
    if (!prodi) {
      return NextResponse.json({ error: 'Program Studi tidak ditemukan' }, { status: 400 })
    }

    // Re-check NIM uniqueness against Mahasiswa
    const existMhs = await db.mahasiswa.findUnique({ where: { nim } })
    if (existMhs) {
      // Already imported — link it
      await db.pendaftaranResponse.update({
        where: { id },
        data: { status: 'IMPORTED', importedMahasiswaId: existMhs.id },
      })
      return NextResponse.json({ success: true, mahasiswaId: existMhs.id, alreadyExisted: true })
    }

    // Create Mahasiswa
    const newMhs = await db.mahasiswa.create({
      data: {
        nim,
        nama: namaLengkap,
        jenisKelamin: jenisKelaminRaw as 'L' | 'P',
        tempatLahir: String(tempatLahir).trim(),
        tanggalLahir: parsedDate,
        alamat,
        noHp: noWa,
        email: String(email).trim(),
        prodiId: prodi.id,
        semester: sem,
        angkatan: angk,
        status: 'AKTIF',
        foto: foto || null,
      },
    })

    // Mark response as IMPORTED
    await db.pendaftaranResponse.update({
      where: { id },
      data: { status: 'IMPORTED', importedMahasiswaId: newMhs.id },
    })

    return NextResponse.json({ success: true, mahasiswaId: newMhs.id })
  } catch (e: any) {
    console.error('[POST /api/pendaftaran-responses/[id]/import]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'NIM atau Email sudah terdaftar di Data Mahasiswa' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Gagal mengimpor pendaftaran ke Data Mahasiswa' },
      { status: 500 }
    )
  }
}
