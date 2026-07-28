import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ POST - import pendaftaran ke tabel Mahasiswa ============
// Body: {
//   tempatLahir, tanggalLahir (ISO date), email, semester (int), angkatan (int),
//   prodiId (optional override)
// }
// Membuat record Mahasiswa baru dari data Pendaftaran, lalu set status IMPORTED.
export async function POST(req: Request, context: any) {
  try {
    const params = context?.params instanceof Promise ? await context.params : context?.params
    const id = params?.id as string
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await req.json()
    const { tempatLahir, tanggalLahir, email, semester, angkatan, prodiId } = body

    // Validate extra required fields for Mahasiswa
    if (!tempatLahir || !tempatLahir.trim()) {
      return NextResponse.json({ error: 'Tempat lahir wajib diisi' }, { status: 400 })
    }
    if (!tanggalLahir) {
      return NextResponse.json({ error: 'Tanggal lahir wajib diisi' }, { status: 400 })
    }
    const parsedDate = new Date(tanggalLahir)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Tanggal lahir tidak valid' }, { status: 400 })
    }
    if (!email || !email.trim()) {
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

    const pendaftaran = await db.pendaftaran.findUnique({ where: { id } })
    if (!pendaftaran) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    }

    // Re-check NIM uniqueness (in case mahasiswa was added after pendaftaran)
    const existMhs = await db.mahasiswa.findUnique({ where: { nim: pendaftaran.nim } })
    if (existMhs) {
      // Already imported — link it
      await db.pendaftaran.update({
        where: { id },
        data: { status: 'IMPORTED', importedMahasiswaId: existMhs.id },
      })
      return NextResponse.json({ success: true, mahasiswaId: existMhs.id, alreadyExisted: true })
    }

    // Resolve prodiId: use override if provided, else pendaftaran.prodiId
    let finalProdiId = prodiId || pendaftaran.prodiId
    if (!finalProdiId) {
      return NextResponse.json({ error: 'Program Studi belum dipilih. Pilih prodi terlebih dahulu.' }, { status: 400 })
    }
    const prodi = await db.programStudi.findUnique({ where: { id: finalProdiId } })
    if (!prodi) {
      return NextResponse.json({ error: 'Program Studi tidak ditemukan' }, { status: 400 })
    }

    // Create Mahasiswa
    const newMhs = await db.mahasiswa.create({
      data: {
        nim: pendaftaran.nim,
        nama: pendaftaran.namaLengkap,
        jenisKelamin: pendaftaran.jenisKelamin as 'L' | 'P',
        tempatLahir: tempatLahir.trim(),
        tanggalLahir: parsedDate,
        alamat: pendaftaran.alamat,
        noHp: pendaftaran.noWa,
        email: email.trim(),
        prodiId: finalProdiId,
        semester: sem,
        angkatan: angk,
        status: 'AKTIF',
        foto: pendaftaran.foto, // carry over the photo data URL
      },
    })

    // Mark pendaftaran as IMPORTED
    await db.pendaftaran.update({
      where: { id },
      data: { status: 'IMPORTED', importedMahasiswaId: newMhs.id },
    })

    return NextResponse.json({ success: true, mahasiswaId: newMhs.id })
  } catch (e: any) {
    console.error('[POST /api/pendaftaran/[id]/import]', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'NIM atau Email sudah terdaftar di Data Mahasiswa' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Gagal mengimpor pendaftaran ke Data Mahasiswa' }, { status: 500 })
  }
}
