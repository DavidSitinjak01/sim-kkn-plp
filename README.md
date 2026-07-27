# SIM KKN & PLP — Sistem Informasi Manajemen KKN & PLP

Sistem informasi terpadu untuk manajemen Kuliah Kerja Nyata (KKN) & Praktek Lapangan Pembelajaran (PLP) di lingkungan universitas. Dibangun dengan Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, dan Prisma ORM.

## ✨ Fitur Utama

- **Dashboard** — statistik & visualisasi real-time
- **Data Mahasiswa & Dosen** — CRUD lengkap dengan export Excel/PDF
- **Desa KKN & Sekolah PLP** — manajemen lokasi penempatan
- **Pembagian Kelompok** — penempatan mahasiswa + cetak SK
- **Absensi** — QR scanner + notifikasi WhatsApp otomatis ke dosen pembimbing
- **Persuratan** — generator surat dengan QR verifikasi
- **Penilaian** — multi-aspek dengan nilai akhir otomatis
- **Agenda & Pengumuman** — informasi kegiatan
- **Manajemen Akun** — 6 role dengan RBAC (Super Admin, Admin Fakultas, Admin Prodi, Dosen, Mahasiswa, Pimpinan)
- **Log Aktivitas** — audit trail
- **Pengaturan** — branding (logo, favicon, nama kampus), WhatsApp gateway
- **Dark Mode** & responsif mobile

## 🛠 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Bahasa | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | PostgreSQL (via Prisma ORM) |
| State | Zustand + TanStack Query |
| Charts | Recharts |
| Animasi | Framer Motion |

## 📋 Persyaratan

- Node.js 18.18+ atau Bun 1.1+
- PostgreSQL database (lokasi lokal atau cloud)

## 🚀 Deploy ke Vercel

### 1. Siapkan Database PostgreSQL

Buat database PostgreSQL. Rekomendasi provider gratis yang kompatibel dengan Vercel:

- **Neon** (https://neon.tech) — serverless Postgres, paling cocok untuk Vercel
- **Supabase** (https://supabase.com) — Postgres + fitur tambahan
- **Vercel Postgres** — langsung dari dashboard Vercel

Salin connection string, contoh:
```
postgresql://user:password@ep-xxx.region.aws.neon.tech/sim_kkn_plp?sslmode=require
```

### 2. Push Project ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: SIM KKN & PLP"
git branch -M main
git remote add origin https://github.com/USERNAME/sim-kkn-plp.git
git push -u origin main
```

### 3. Deploy di Vercel

1. Buka https://vercel.com dan login dengan GitHub
2. Klik **Add New → Project**
3. Import repository `sim-kkn-plp`
4. Vercel otomatis mendeteksi Next.js. Di bagian **Environment Variables**, tambahkan:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `postgresql://...` (connection string dari langkah 1) |

5. Klik **Deploy** — tunggu hingga selesai (±2 menit)

### 4. Inisialisasi Database

Setelah deploy sukses, jalankan schema & seed ke database production. Bisa dilakukan dengan 2 cara:

**Cara A — Via Vercel CLI (rekomendasi):**
```bash
npm i -g vercel
vercel login
vercel link          # hubungkan ke project Vercel
vercel env pull .env.production.local   # tarik DATABASE_URL dari Vercel

npx prisma db push    # buat semua tabel
bun prisma/seed.ts    # isi data awal (akun demo, fakultas, prodi, mahasiswa, dll)
```

**Cara B — Via dashboard database provider:**
Jalankan SQL dari `prisma/schema.prisma` manual di console database Anda, lalu seed via local dengan `DATABASE_URL` production.

### 5. Akses Aplikasi

Setelah seeding selesai, buka URL Vercel project Anda. Login dengan akun demo:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@kknplp.ac.id` | `password123` |
| Admin Fakultas | `admin.fkip@kknplp.ac.id` | `password123` |
| Admin Prodi | `admin.prodi@kknplp.ac.id` | `password123` |
| Dosen | `dosen@kknplp.ac.id` | `password123` |
| Mahasiswa | `mahasiswa@kknplp.ac.id` | `password123` |
| Pimpinan | `pimpinan@kknplp.ac.id` | `password123` |

> ⚠️ **Penting**: Ganti password default setelah login pertama melalui menu Manajemen Akun.

## 💻 Development Lokal

```bash
# 1. Install dependencies
bun install

# 2. Siapkan environment
cp .env.example .env
# Edit .env, isi DATABASE_URL dengan Postgres local/cloud Anda

# 3. Buat schema & seed database
bun run db:push
bun run db:seed

# 4. Jalankan dev server
bun run dev
```

Buka http://localhost:3000

## 📂 Struktur Project

```
├── prisma/
│   ├── schema.prisma      # Skema database (16 model)
│   └── seed.ts            # Data awal (akun, fakultas, mahasiswa, dll)
├── src/
│   ├── app/
│   │   ├── api/           # API routes (REST)
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Entry point
│   ├── components/
│   │   ├── app/           # Shell, sidebar, header, login
│   │   ├── shared/        # DataTable, PageHeader
│   │   ├── ui/            # shadcn/ui components
│   │   └── views/         # 15 modul halaman
│   ├── hooks/             # Custom React hooks
│   └── lib/               # db, utils, store, branding, whatsapp
├── public/                # Static assets
├── .env.example           # Template environment variables
├── vercel.json            # Konfigurasi Vercel
└── package.json
```

## 🔔 Konfigurasi WhatsApp Gateway (Opsional)

Notifikasi WhatsApp otomatis terkirim ke dosen pembimbing saat mahasiswa absen (check-in/check-out). Ada 3 mode:

1. **Nonaktif** (default) — tidak ada notifikasi
2. **Simulasi** — `WA_API_KEY` kosong, pesan dicetak di log server
3. **Live** — isi `WA_API_KEY` dengan token Fonnte asli

Konfigurasi via menu **Pengaturan → Integrasi → WhatsApp Gateway**, atau set environment variable `WA_API_KEY` di Vercel.

## 📝 License

MIT — bebas digunakan dan dimodifikasi.
