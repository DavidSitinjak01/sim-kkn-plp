import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  // Idempotency guard: if the database already has data, skip seeding.
  // This makes the seed safe to run on every Vercel build (via vercel.json
  // buildCommand) without failing on unique-constraint violations when the
  // database was already seeded by a previous deploy or manually.
  //
  // To force a re-seed (e.g. after schema changes), truncate the tables
  // first via the Neon dashboard SQL editor:
  //   TRUNCATE "Pengaturan", "Aktivitas", "Agenda", "Pengumuman",
  //     "Penilaian", "Surat", "Absensi", "KelompokMember", "Kelompok",
  //     "Sekolah", "Desa", "Mahasiswa", "Dosen", "User", "ProgramStudi",
  //     "Fakultas" CASCADE;
  // …then trigger a Vercel redeploy.
  const existing = await db.user.count()
  if (existing > 0) {
    console.log(`ℹ️  Database already has ${existing} users — skipping seed (idempotent).`)
    console.log('   To force re-seed, truncate tables via Neon SQL editor first.')
    return
  }

  console.log('🌱 Seeding database...')

  // ============ FAKULTAS & PRODI ============
  const fakultasList = [
    { kode: 'FKIP', nama: 'Fakultas Keguruan dan Ilmu Pendidikan', dekan: 'Prof. Dr. Sutrisno, M.Pd.' },
    { kode: 'FT', nama: 'Fakultas Teknik', dekan: 'Prof. Ir. Bambang S., Ph.D.' },
    { kode: 'FE', nama: 'Fakultas Ekonomi', dekan: 'Dr. Hendra Wijaya, M.M.' },
    { kode: 'FISIP', nama: 'Fakultas Ilmu Sosial dan Politik', dekan: 'Dr. Rina Marlina, M.Si.' },
    { kode: 'FH', nama: 'Fakultas Hukum', dekan: 'Prof. Dr. Ahmad Fauzi, S.H., M.H.' },
  ]
  const fakultas = await Promise.all(fakultasList.map(f => db.fakultas.create({ data: f })))

  const prodiData = [
    { kode: 'PEND-MTK', nama: 'Pendidikan Matematika', jenjang: 'S1', fakultasId: fakultas[0].id },
    { kode: 'PEND-BIO', nama: 'Pendidikan Biologi', jenjang: 'S1', fakultasId: fakultas[0].id },
    { kode: 'PEND-FIS', nama: 'Pendidikan Fisika', jenjang: 'S1', fakultasId: fakultas[0].id },
    { kode: 'PEND-BHS', nama: 'Pendidikan Bahasa Indonesia', jenjang: 'S1', fakultasId: fakultas[0].id },
    { kode: 'PEND-ING', nama: 'Pendidikan Bahasa Inggris', jenjang: 'S1', fakultasId: fakultas[0].id },
    { kode: 'TI', nama: 'Teknik Informatika', jenjang: 'S1', fakultasId: fakultas[1].id },
    { kode: 'TS', nama: 'Teknik Sipil', jenjang: 'S1', fakultasId: fakultas[1].id },
    { kode: 'TM', nama: 'Teknik Mesin', jenjang: 'S1', fakultasId: fakultas[1].id },
    { kode: 'MAN', nama: 'Manajemen', jenjang: 'S1', fakultasId: fakultas[2].id },
    { kode: 'AKT', nama: 'Akuntansi', jenjang: 'S1', fakultasId: fakultas[2].id },
    { kode: 'ISO', nama: 'Ilmu Sosial', jenjang: 'S1', fakultasId: fakultas[3].id },
    { kode: 'HUK', nama: 'Ilmu Hukum', jenjang: 'S1', fakultasId: fakultas[4].id },
  ]
  const prodi = await Promise.all(prodiData.map(p => db.programStudi.create({ data: p })))

  // ============ USERS (with hashed passwords) ============
  const hashPass = (pw: string) => bcrypt.hashSync(pw, 10)
  const defaultPass = hashPass('password123')

  const users = [
    { email: 'superadmin@kknplp.ac.id', name: 'Super Administrator', role: 'SUPER_ADMIN', password: defaultPass, phone: '081234567801' },
    { email: 'admin.fkip@kknplp.ac.id', name: 'Admin FKIP', role: 'ADMIN_FAKULTAS', password: defaultPass, phone: '081234567802' },
    { email: 'admin.prodi@kknplp.ac.id', name: 'Admin Prodi', role: 'ADMIN_PRODI', password: defaultPass, phone: '081234567803' },
    { email: 'pimpinan@kknplp.ac.id', name: 'Rektor Universitas', role: 'PIMPINAN', password: defaultPass, phone: '081234567804' },
  ]
  const userRecords = await Promise.all(users.map(u => db.user.create({ data: u })))

  // ============ DOSEN ============
  const dosenData = [
    { nidn: '0010101', nama: 'Dr. Suparman, M.Pd.', email: 'suparman@kknplp.ac.id', noHp: '081200010001', fakultasId: fakultas[0].id, prodiId: prodi[0].id, jabatan: 'Lektor Kepala', keahlian: 'Pendidikan Matematika, KKN' },
    { nidn: '0010102', nama: 'Dr. Siti Aminah, M.Si.', email: 'siti.aminah@kknplp.ac.id', noHp: '081200010002', fakultasId: fakultas[0].id, prodiId: prodi[1].id, jabatan: 'Lektor', keahlian: 'Pendidikan Biologi, PLP' },
    { nidn: '0020101', nama: 'Ir. Joko Susilo, M.T.', email: 'joko.susilo@kknplp.ac.id', noHp: '081200010003', fakultasId: fakultas[1].id, prodiId: prodi[5].id, jabatan: 'Lektor', keahlian: 'Teknik Informatika' },
    { nidn: '0030101', nama: 'Dr. Maya Sari, M.M.', email: 'maya.sari@kknplp.ac.id', noHp: '081200010004', fakultasId: fakultas[2].id, prodiId: prodi[8].id, jabatan: 'Lektor Kepala', keahlian: 'Manajemen, Kewirausahaan' },
    { nidn: '0010103', nama: 'Prof. Dr. Hartono, M.Pd.', email: 'hartono@kknplp.ac.id', noHp: '081200010005', fakultasId: fakultas[0].id, prodiId: prodi[4].id, jabatan: 'Guru Besar', keahlian: 'Pendidikan Bahasa Inggris' },
    { nidn: '0040101', nama: 'Dr. Andi Pratama, M.Si.', email: 'andi.pratama@kknplp.ac.id', noHp: '081200010006', fakultasId: fakultas[3].id, prodiId: prodi[10].id, jabatan: 'Lektor', keahlian: 'Sosiologi Pedesaan' },
    { nidn: '0020102', nama: 'Dr. Dewi Lestari, M.T.', email: 'dewi.lestari@kknplp.ac.id', noHp: '081200010007', fakultasId: fakultas[1].id, prodiId: prodi[6].id, jabatan: 'Lektor', keahlian: 'Teknik Sipil, Infrastruktur' },
    { nidn: '0050101', nama: 'Dr. Rudi Hartono, S.H., M.H.', email: 'rudi.hartono@kknplp.ac.id', noHp: '081200010008', fakultasId: fakultas[4].id, prodiId: prodi[11].id, jabatan: 'Lektor Kepala', keahlian: 'Hukum Tata Negara' },
  ]
  const dosen: any[] = []
  for (const d of dosenData) {
    const u = await db.user.create({ data: { email: d.email, password: defaultPass, name: d.nama, role: 'DOSEN', phone: d.noHp } })
    const dos = await db.dosen.create({ data: { ...d, userId: u.id } })
    dosen.push(dos)
  }

  // ============ MAHASISWA ============
  const namaDepan = ['Ahmad', 'Siti', 'Muhammad', 'Dewi', 'Rizki', 'Putri', 'Andi', 'Sri', 'Budi', 'Rina', 'Eko', 'Yuni', 'Fajar', 'Lina', 'Agus', 'Maya', 'Bayu', 'Nur', 'Dian', 'Ari', 'Intan', 'Rudi', 'Wati', 'Hadi', 'Sari', 'Joko', 'Endah', 'Tio', 'Rahma', 'Yoga']
  const namaBelakang = ['Pratama', 'Sari', 'Wijaya', 'Hidayat', 'Saputra', 'Anggraini', 'Kusuma', 'Maulana', 'Permana', 'Lestari', 'Setiawan', 'Rahmawati', 'Nugroho', 'Wulandari', 'Pradana', 'Fitriani', 'Hartono', 'Yulianti', 'Santoso', 'Pertiwi']
  const prodiIds = prodi.map(p => p.id)
  const angkatan = [2021, 2022, 2023]
  let mhsCount = 0
  const mhsRecords: any[] = []
  for (let i = 0; i < 120; i++) {
    const nama = `${namaDepan[i % namaDepan.length]} ${namaBelakang[(i * 3) % namaBelakang.length]}`
    const nim = `2022${String(i + 1).padStart(5, '0')}`
    const p = prodiIds[i % prodiIds.length]
    const jk = i % 2 === 0 ? 'L' : 'P'
    const sem = angkatan[i % 3] === 2021 ? 7 : angkatan[i % 3] === 2022 ? 5 : 3
    const email = `mhs${i + 1}@mhs.kknplp.ac.id`
    const status = i % 15 === 0 ? 'CUTI' : 'AKTIF'
    const mhs = await db.mahasiswa.create({
      data: {
        nim, nama, jenisKelamin: jk,
        tempatLahir: ['Surabaya', 'Malang', 'Jakarta', 'Bandung', 'Medan'][i % 5],
        tanggalLahir: new Date(2001 + (i % 4), i % 12, (i % 27) + 1),
        alamat: `Jl. Merdeka No. ${i + 1}, Kota`,
        noHp: `0812${String(34000000 + i).padStart(8, '0')}`,
        email,
        prodiId: p,
        semester: sem,
        angkatan: angkatan[i % 3],
        status,
      }
    })
    mhsRecords.push(mhs)
    mhsCount++
  }
  console.log(`Created ${mhsCount} mahasiswa`)

  // ============ DESA KKN ============
  const desaData = [
    { nama: 'Desa Sukamaju', kecamatan: 'Cibadak', kabupaten: 'Sukabumi', provinsi: 'Jawa Barat', kodePos: '43357', latitude: -6.8915, longitude: 106.8234, kuota: 35, keterangan: 'Desa potensi pertanian dan UMKM' },
    { nama: 'Desa Tirta Makmur', kecamatan: 'Leuwiliang', kabupaten: 'Bogor', provinsi: 'Jawa Barat', kodePos: '16640', latitude: -6.5645, longitude: 106.6891, kuota: 30, keterangan: 'Desa wisata air terjun' },
    { nama: 'Desa Sumber Rejeki', kecamatan: 'Pancoran', kabupaten: 'Cianjur', provinsi: 'Jawa Barat', kodePos: '43253', latitude: -6.8145, longitude: 107.1432, kuota: 40, keterangan: 'Potensi perkebunan teh' },
    { nama: 'Desa Margamulya', kecamatan: 'Pacet', kabupaten: 'Bandung', provinsi: 'Jawa Barat', kodePos: '40382', latitude: -6.7234, longitude: 107.5123, kuota: 30, keterangan: 'Desa hortikultura' },
    { nama: 'Desa Cipta Karya', kecamatan: 'Cugenang', kabupaten: 'Cianjur', provinsi: 'Jawa Barat', kodePos: '43252', latitude: -6.7567, longitude: 107.2345, kuota: 25, keterangan: 'Pengembangan koperasi desa' },
    { nama: 'Desa Sejahtera', kecamatan: 'Banjar', kabupaten: 'Garut', provinsi: 'Jawa Barat', kodePos: '44185', latitude: -7.1234, longitude: 107.8456, kuota: 35, keterangan: 'Ekowisata dan pertanian organik' },
    { nama: 'Desa Makmur Jaya', kecamatan: 'Sukaraja', kabupaten: 'Sukabumi', provinsi: 'Jawa Barat', kodePos: '43393', latitude: -6.9456, longitude: 106.9123, kuota: 30, keterangan: 'Industri kerajinan bambu' },
    { nama: 'Desa Tani Makmur', kecamatan: 'Caringin', kabupaten: 'Bogor', provinsi: 'Jawa Barat', kodePos: '16730', latitude: -6.4890, longitude: 106.7234, kuota: 28, keterangan: 'Sentra pertanian padi' },
  ]
  const desa = await Promise.all(desaData.map(d => db.desa.create({ data: d })))

  // ============ SEKOLAH PLP ============
  const sekolahData = [
    { nama: 'SMA Negeri 1 Cibadak', jenjang: 'SMA', alamat: 'Jl. Raya Cibadak No. 45', kecamatan: 'Cibadak', kabupaten: 'Sukabumi', provinsi: 'Jawa Barat', kepalaSekolah: 'Drs. H. Asep Sukirman, M.Pd.', noHp: '0266-531234', email: 'sman1cibadak@sch.id', latitude: -6.8923, longitude: 106.8256, kuota: 20 },
    { nama: 'SMP Negeri 2 Leuwiliang', jenjang: 'SMP', alamat: 'Jl. Mayor Oking No. 12', kecamatan: 'Leuwiliang', kabupaten: 'Bogor', provinsi: 'Jawa Barat', kepalaSekolah: 'Hj. Sumarni, M.Pd.', noHp: '0251-861234', email: 'smpn2leu@sch.id', latitude: -6.5656, longitude: 106.6912, kuota: 18 },
    { nama: 'SMA Negeri 3 Cianjur', jenjang: 'SMA', alamat: 'Jl. Siti Jenab No. 88', kecamatan: 'Cianjur', kabupaten: 'Cianjur', provinsi: 'Jawa Barat', kepalaSekolah: 'Dr. H. Endang Supriadi, M.Si.', noHp: '0263-281234', email: 'sman3cianjur@sch.id', latitude: -6.8178, longitude: 107.1456, kuota: 22 },
    { nama: 'SMK Negeri 1 Bandung', jenjang: 'SMK', alamat: 'Jl. Wastukencana No. 9', kecamatan: 'Bandung', kabupaten: 'Bandung', provinsi: 'Jawa Barat', kepalaSekolah: 'Ir. H. Bambang Wijaya, M.M.', noHp: '022-4231234', email: 'smkn1bdg@sch.id', latitude: -6.7256, longitude: 107.5178, kuota: 25 },
    { nama: 'SMP Negeri 5 Garut', jenjang: 'SMP', alamat: 'Jl. Ahmad Yani No. 67', kecamatan: 'Garut', kabupaten: 'Garut', provinsi: 'Jawa Barat', kepalaSekolah: 'Drs. H. Tatang Sutisna', noHp: '0262-231234', email: 'smpn5garut@sch.id', latitude: -7.1267, longitude: 107.8478, kuota: 16 },
    { nama: 'SMA Negeri 4 Sukabumi', jenjang: 'SMA', alamat: 'Jl. Rumah Sakit No. 23', kecamatan: 'Sukaraja', kabupaten: 'Sukabumi', provinsi: 'Jawa Barat', kepalaSekolah: 'Dr. Hj. Rina Susanti, M.Pd.', noHp: '0266-221234', email: 'sman4sukabumi@sch.id', latitude: -6.9478, longitude: 106.9178, kuota: 20 },
  ]
  const sekolah = await Promise.all(sekolahData.map(s => db.sekolah.create({ data: s })))

  // ============ KELOMPOK ============
  const kelompokKKN: any[] = []
  for (let i = 0; i < 6; i++) {
    const k = await db.kelompok.create({
      data: {
        nama: `Kelompok KKN ${i + 1}`,
        tipe: 'KKN',
        tahunAkademik: '2024/2025',
        semester: 'GANJIL',
        desaId: desa[i % desa.length].id,
        dosenId: dosen[i % dosen.length].id,
      }
    })
    kelompokKKN.push(k)
  }
  const kelompokPLP1: any[] = []
  for (let i = 0; i < 3; i++) {
    const k = await db.kelompok.create({
      data: {
        nama: `Kelompok PLP 1-${i + 1}`,
        tipe: 'PLP1',
        tahunAkademik: '2024/2025',
        semester: 'GANJIL',
        sekolahId: sekolah[i % sekolah.length].id,
        dosenId: dosen[(i + 1) % dosen.length].id,
      }
    })
    kelompokPLP1.push(k)
  }
  const kelompokPLP2: any[] = []
  for (let i = 0; i < 3; i++) {
    const k = await db.kelompok.create({
      data: {
        nama: `Kelompok PLP 2-${i + 1}`,
        tipe: 'PLP2',
        tahunAkademik: '2024/2025',
        semester: 'GANJIL',
        sekolahId: sekolah[(i + 3) % sekolah.length].id,
        dosenId: dosen[(i + 2) % dosen.length].id,
      }
    })
    kelompokPLP2.push(k)
  }

  // Assign mahasiswa to kelompok KKN
  let mhsIdx = 0
  for (const k of kelompokKKN) {
    const anggota = mhsRecords.slice(mhsIdx, mhsIdx + 15)
    for (const m of anggota) {
      await db.kelompokMember.create({ data: { kelompokId: k.id, mahasiswaId: m.id } })
    }
    mhsIdx += 15
  }
  // Assign to PLP1
  for (const k of kelompokPLP1) {
    const anggota = mhsRecords.slice(mhsIdx, mhsIdx + 10)
    for (const m of anggota) {
      await db.kelompokMember.create({ data: { kelompokId: k.id, mahasiswaId: m.id } })
    }
    mhsIdx += 10
  }
  // Assign to PLP2
  for (const k of kelompokPLP2) {
    const anggota = mhsRecords.slice(mhsIdx, mhsIdx + 8)
    for (const m of anggota) {
      await db.kelompokMember.create({ data: { kelompokId: k.id, mahasiswaId: m.id } })
    }
    mhsIdx += 8
  }

  // ============ ABSENSI (last 14 days) ============
  const today = new Date()
  const allKelompok = [...kelompokKKN, ...kelompokPLP1, ...kelompokPLP2]
  for (const k of allKelompok) {
    const members = await db.kelompokMember.findMany({ where: { kelompokId: k.id } })
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const date = new Date(today)
      date.setDate(date.getDate() - dayOffset)
      // skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue
      for (const m of members) {
        const r = Math.random()
        let status = 'HADIR'
        if (r < 0.05) status = 'ALPHA'
        else if (r < 0.1) status = 'IZIN'
        else if (r < 0.13) status = 'SAKIT'
        await db.absensi.create({
          data: {
            mahasiswaId: m.mahasiswaId,
            kelompokId: k.id,
            tanggal: date,
            jamMasuk: status === 'HADIR' ? new Date(date.setHours(7, Math.floor(Math.random() * 30), 0)) : null,
            jamPulang: status === 'HADIR' ? new Date(date.setHours(16, Math.floor(Math.random() * 30), 0)) : null,
            latitude: k.desaId ? -6.8 + Math.random() * 0.3 : null,
            longitude: k.desaId ? 106.7 + Math.random() * 0.3 : null,
            status,
            keterangan: status !== 'HADIR' ? 'Keterangan: ' + status.toLowerCase() : null,
          }
        })
      }
    }
  }

  // ============ SURAT ============
  const suratData = [
    { nomor: '001/KKN-PLP/2024', jenis: 'TUGAS', perihal: 'Surat Tugas KKN 2024', pemohon: 'Dekan FKIP', tujuan: 'Seluruh Mahasiswa', status: 'SELESAI', konten: 'Diberikan surat tugas kepada mahasiswa untuk melaksanakan KKN...' },
    { nomor: '002/KKN-PLP/2024', jenis: 'PENGANTAR', perihal: 'Surat Pengantar Penempatan', pemohon: 'Ketua Kelompok 1', tujuan: 'Kepala Desa Sukamaju', status: 'SELESAI', konten: 'Dengan ini kami sampaikan pengantar penempatan mahasiswa KKN...' },
    { nomor: '003/KKN-PLP/2024', jenis: 'PENEMPATAN', perihal: 'Surat Penempatan PLP 1', pemohon: 'Koordinator PLP', tujuan: 'SMA Negeri 1 Cibadak', status: 'DIKIRIM', konten: 'Sehubungan dengan pelaksanaan PLP 1, kami menempatkan mahasiswa...' },
    { nomor: '004/KKN-PLP/2024', jenis: 'BALASAN', perihal: 'Surat Balasan Sekolah', pemohon: 'Kepala SMA Negeri 1', tujuan: 'Universitas', status: 'SELESAI', konten: 'Sehubungan dengan surat penempatan, kami menyatakan persetujuan...' },
    { nomor: '005/KKN-PLP/2024', jenis: 'IZIN', perihal: 'Surat Izin Observasi', pemohon: 'Mahasiswa Kelompok 2', tujuan: 'Dinas Sosial', status: 'DRAFT', konten: 'Kami mahasiswa memohon izin untuk melakukan observasi...' },
    { nomor: '006/KKN-PLP/2024', jenis: 'SELESAI', perihal: 'Surat Keterangan Selesai KKN', pemohon: 'Kelompok KKN 1', tujuan: 'Universitas', status: 'DRAFT', konten: 'Menyatakan bahwa mahasiswa telah menyelesaikan KKN...' },
  ]
  await Promise.all(suratData.map(s => db.surat.create({ data: s })))

  // ============ PENILAIAN (sample) ============
  const aspekNilai = ['Keaktifan', 'Tanggung Jawab', 'Kerja Sama', 'Keterampilan', 'Laporan Akhir']
  for (const k of allKelompok.slice(0, 3)) {
    const members = await db.kelompokMember.findMany({ where: { kelompokId: k.id } })
    for (const m of members.slice(0, 10)) {
      for (const aspek of aspekNilai) {
        await db.penilaian.create({
          data: {
            mahasiswaId: m.mahasiswaId,
            kelompokId: k.id,
            dosenId: k.dosenId,
            jenis: k.tipe,
            aspek,
            nilai: 70 + Math.floor(Math.random() * 30),
          }
        })
      }
    }
  }

  // ============ PENGUMUMAN ============
  const pengumumanData = [
    { judul: 'Pembukaan Pendaftaran KKN Semester Ganjil 2024/2025', konten: 'Diberitahukan kepada seluruh mahasiswa yang berminat mengikuti KKN semester ganjil 2024/2025 dapat mendaftar mulai tanggal 1 September 2024.', prioritas: 'URGENT', penulis: 'Koord. KKN' },
    { judul: 'Jadwal Briefing PLP 1', konten: 'Briefing PLP 1 akan dilaksanakan pada tanggal 15 September 2024 di Aula Universitas.', prioritas: 'NORMAL', penulis: 'Koord. PLP' },
    { judul: 'Pengumpulan Laporan Akhir KKN', konten: 'Batas akhir pengumpulan laporan akhir KKN adalah 31 Januari 2025.', prioritas: 'NORMAL', penulis: 'Sekretariat' },
    { judul: 'Workshop Metodologi Penelitian KKN', konten: 'Workshop akan dilaksanakan pada 10 September 2024 untuk seluruh peserta KKN.', prioritas: 'INFO', penulis: 'Koord. KKN' },
    { judul: 'Perubahan Lokasi PLP 2', konten: 'Terdapat perubahan lokasi PLP 2 untuk kelompok 3, silakan cek dashboard.', prioritas: 'URGENT', penulis: 'Koord. PLP' },
  ]
  await Promise.all(pengumumanData.map(p => db.pengumuman.create({ data: p })))

  // ============ AGENDA ============
  const agendaData = [
    { judul: 'Briefing KKN Gelombang 1', tanggal: new Date(today.getTime() + 5 * 86400000), lokasi: 'Aula Universitas', deskripsi: 'Briefing untuk seluruh peserta KKN', tipe: 'KKN' },
    { judul: 'Pelaksanaan PLP 1', tanggal: new Date(today.getTime() + 12 * 86400000), lokasi: 'Sekolah Mitra', deskripsi: 'Pelaksanaan PLP 1 dimulai', tipe: 'PLP' },
    { judul: 'Monitoring KKN', tanggal: new Date(today.getTime() + 20 * 86400000), lokasi: 'Desa Binaan', deskripsi: 'Monitoring oleh dosen pendamping', tipe: 'KKN' },
    { judul: 'Ujian Akhir Laporan KKN', tanggal: new Date(today.getTime() + 45 * 86400000), lokasi: 'Ruang Sidang', deskripsi: 'Presentasi laporan akhir KKN', tipe: 'KKN' },
    { judul: 'Wisuda & Pelepasan', tanggal: new Date(today.getTime() + 60 * 86400000), lokasi: 'Auditorium', deskripsi: 'Wisuda dan pelepasan peserta', tipe: 'UMUM' },
  ]
  await Promise.all(agendaData.map(a => db.agenda.create({ data: a })))

  // ============ AKTIVITAS ============
  const aktivitasData = [
    { userId: userRecords[0].id, aksi: 'LOGIN', modul: 'AUTH', detail: 'Login ke sistem' },
    { userId: userRecords[0].id, aksi: 'CREATE', modul: 'MAHASISWA', detail: 'Menambahkan 120 data mahasiswa' },
    { userId: userRecords[0].id, aksi: 'CREATE', modul: 'DOSEN', detail: 'Menambahkan 8 data dosen' },
    { userId: userRecords[0].id, aksi: 'CREATE', modul: 'KELOMPOK', detail: 'Membuat 12 kelompok KKN & PLP' },
    { userId: userRecords[1].id, aksi: 'VIEW', modul: 'DASHBOARD', detail: 'Melihat dashboard' },
    { userId: userRecords[0].id, aksi: 'UPDATE', modul: 'PENGATURAN', detail: 'Mengubah pengaturan aplikasi' },
  ]
  await Promise.all(aktivitasData.map(a => db.aktivitas.create({ data: a })))

  // ============ PENGATURAN ============
  const pengaturanData = [
    { key: 'nama_kampus', value: 'Universitas Nusantara Jaya' },
    { key: 'alamat_kampus', value: 'Jl. Pendidikan No. 1, Jakarta Selatan' },
    { key: 'no_telepon', value: '021-12345678' },
    { key: 'email_kampus', value: 'info@nusantarajaya.ac.id' },
    { key: 'website', value: 'https://nusantarajaya.ac.id' },
    { key: 'tahun_akademik', value: '2024/2025' },
    { key: 'semester', value: 'GANJIL' },
    { key: 'theme', value: 'light' },
    { key: 'smtp_host', value: 'smtp.gmail.com' },
    { key: 'smtp_port', value: '587' },
    { key: 'wa_gateway', value: 'https://api.fonnte.com/send' },
    { key: 'wa_api_key', value: '' },
    { key: 'wa_sender', value: '' },
    { key: 'wa_enabled', value: 'false' },
    { key: 'maps_api_key', value: 'AIzaSyXXXXXXXXXXXXXXXXX' },
    // ============ IDENTITAS SURAT (untuk format Daftar Peserta PLP) ============
    { key: 'logo_url', value: '/logo.png' },
    { key: 'yayasan', value: 'Yayasan Pendidikan Nias Selatan' },
    { key: 'panitia_plp', value: 'Panitia Pengenalan Lapangan Persekolahan II' },
    { key: 'izin_operasional', value: 'Kepmendikbudristek Nomor 363/E/O/2021' },
    { key: 'ketua_panitia', value: 'Antonius Sarumaha, M.Pd.' },
    { key: 'ketua_panitia_nidn', value: '0118058405' },
    { key: 'sekretaris_panitia', value: 'Adam Smith Bago, S.Si., M.Pd.' },
    { key: 'sekretaris_panitia_nidn', value: '0101018409' },
    { key: 'koordinator_lapangan', value: 'Samalua Waoma, S.E., M.M., M.Ak.' },
  ]
  await Promise.all(pengaturanData.map(p => db.pengaturan.create({ data: p })))

  console.log('✅ Seeding complete!')
  console.log(`   - ${fakultas.length} Fakultas`)
  console.log(`   - ${prodi.length} Program Studi`)
  console.log(`   - ${userRecords.length} Users (admin)`)
  console.log(`   - ${dosen.length} Dosen`)
  console.log(`   - ${mhsCount} Mahasiswa`)
  console.log(`   - ${desa.length} Desa KKN`)
  console.log(`   - ${sekolah.length} Sekolah PLP`)
  console.log(`   - ${allKelompok.length} Kelompok`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
