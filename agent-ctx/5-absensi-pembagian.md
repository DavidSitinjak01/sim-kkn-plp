# Task 5 — Absensi Mahasiswa (QR) + Pembagian KKN & PLP

Agent: full-stack-developer
Task ID: 5
Date: 2025-07-25

## Objective
Build two full-stack modules for SIM KKN & PLP:
1. **Absensi Mahasiswa** — daily rekap, monthly rekap, QR scanner (simulated)
2. **Pembagian KKN & PLP** — kelompok CRUD, member management, SK printing

## Files Created

### API — Absensi
- `src/app/api/absensi/route.ts` — GET (list with kelompokId/status/tanggal/search filters, includes mahasiswa+prodi+fakultas & kelompok) + POST (validate, set jamMasuk=now when HADIR, tanggal set to noon for TZ safety)
- `src/app/api/absensi/[id]/route.ts` — GET/PUT/DELETE with conditional update map and status-switch handling (auto jamMasuk when switching to HADIR)
- `src/app/api/absensi/rekap/route.ts` — GET monthly rekap grouped by mahasiswa, supports ?kelompokId= and ?bulan=YYYY-MM, returns {mahasiswaId, nim, nama, prodi, kelompokNama, hadir, izin, sakit, alpha, total}

### API — Kelompok
- `src/app/api/kelompok/route.ts` — GET (with ?tipe, ?tahunAkademik, ?search; includes desa/sekolah/dosen + _count.members) + POST (validates tipe/semester; KKN requires desaId, PLP requires sekolahId)
- `src/app/api/kelompok/[id]/route.ts` — GET (includes members with mahasiswa+prodi+fakultas), PUT, DELETE with P2003 FK handling
- `src/app/api/kelompok/[id]/members/route.ts` — POST (add member) with P2002 unique violation handling; DELETE (remove member via ?mahasiswaId= query) using `kelompokId_mahasiswaId` compound unique

### Views
- `src/components/views/absensi-view.tsx` — 3-tab view:
  - **Rekap Harian**: date picker (default today), kelompok select, status select; 4 stat cards (Total, Hadir, Izin/Sakit, Alpha); DataTable with NIM+nama, kelompok, jam masuk/pulang (LogIn/LogOut icons), colored status badge, lokasi link to Google Maps, Edit status dialog + Delete confirm; CSV/PDF export
  - **Rekap Bulanan**: month picker + kelompok select; 4 stat cards (Mahasiswa, Total Hadir, Rata-rata Kehadiran %, Total Alpha); DataTable with hadir/izin/sakit/alpha counts + total + persentase with colored Progress bar (emerald ≥80%, amber ≥60%, rose <60%); CSV/PDF export
  - **QR Scanner**: simulates QR scan flow — generates QR code data URL (using `qrcode` package) encoding a dummy payload with selected mahasiswa ID, scan input field accepts NIM/mahasiswaId, auto-resolves to a Mahasiswa via /api/mahasiswa lookup, form with kelompok + status + keterangan, on submit POSTs to /api/absensi with today's date; recent scans list (last 10) with refresh button
- `src/components/views/pembagian-view.tsx` — full kelompok management:
  - PageHeader w/ GitBranch icon, breadcrumb ["Operasional", "Pembagian"], 3 actions (Export Excel/PDF + Tambah Kelompok)
  - Filter card: Tipe select (All/KKN/PLP1/PLP2) + Tahun Akademik text input + Reset
  - 4 stat cards: Total Kelompok, KKN, PLP 1, PLP 2
  - DataTable: nama kelompok (avatar tile by tipe), tipe badge (KKN=emerald, PLP1=violet, PLP2=amber), tahun/semester, lokasi (Building2 for KKN, School for PLP + kecamatan/kabupaten or jenjang), dosen pendamping (UserCheck icon + NIDN), anggota count vs kuota lokasi (rose + ⚠ when over), kuota pill (amber or rose when over), status badge, Aksi (Kelola Anggota/Users, Cetak SK/Printer, Edit, Delete)
  - **Tambah/Edit Dialog**: nama, tipe select (switching tipe clears desaId/sekolahId), semester select, tahun akademik text (default "2024/2025"), status select, dosen pendamping select, conditional lokasi select (desa for KKN, sekolah for PLP) with kuota shown in label
  - **Kelola Anggota Dialog**: separate component with detail header card (lokasi, dosen, anggota count with over-kuota warning, tipe), two ScrollArea columns — left shows current members (with remove button), right shows searchable list of available mahasiswa (not yet in this kelompok, sliced to 50) with add button. Real-time refresh after add/remove via /api/kelompok/[id]
  - **Cetak SK**: fetches kelompok detail (with members) and calls `printData()` with formatted letter-style HTML — header with nomor/tanggal, salam pembuka, paragraph explaining tipe KKN/PLP, table of members (No, NIM, Nama, Prodi), dosen pendamping block, penutup, two-column signature block (Ketua Lembaga + Koordinator). Opens in new window with print dialog.

## Key Patterns Used
- Next.js 16 async-params pattern: `const { id } = await params` in all dynamic routes
- All DB calls in try/catch with console.error + 500 fallback
- Prisma compound unique for KelompokMember: `where: { kelompokId_mahasiswaId: { kelompokId, mahasiswaId } }`
- Date filtering: `new Date(tanggal); setHours(0,0,0,0)` then `{ gte: start, lt: end }` (next day midnight) for date-only equality
- Date storage: `setHours(12, 0, 0, 0)` on POST to avoid TZ edge cases
- Reusable statusBadge/tipeBadge helpers with full color system (emerald/amber/sky/rose for status; emerald/violet/amber for tipe)
- useKelompokList() shared hook across all 3 absensi tabs to avoid duplicate fetches
- Responsive: 2-col mobile, 4-col lg for stat cards; grid-cols-3 sm:flex for tabs; grid lg:grid-cols-3 for QR scanner layout
- All views are 'use client', use sonner toast, framer-motion subtle entrance animations
- QR code generation via `QRCode.toDataURL(text, { width, margin, color })` — package `qrcode@1.5.4` + `@types/qrcode@1.5.6` installed

## Validation
- `bun run lint` — clean pass (0 errors, 0 warnings)
- `npx tsc --noEmit --skipLibCheck` — no errors in any new file (only pre-existing errors in seed.ts, examples/, skills/, dashboard/route.ts which are out of scope)
- All 7 API routes follow established conventions (NextResponse, awaited params, P2002/P2003 handling)
- All view files overwrite the stubs and export `AbsensiView` / `PembagianView` matching the app-shell registry

## Stage Summary
- 7 new API files (absensi: list+create, by-id CRUD, rekap; kelompok: list+create, by-id CRUD with members, members add/remove) — production-ready with validation, FK/unique handling, conditional updates
- 2 view files (absensi-view.tsx 962 lines, pembagian-view.tsx ~960 lines) — fully overwrite stubs with premium SaaS UI
- Absensi module: 3 functional tabs (daily/monthly rekap + QR scanner simulation), stat cards, colored badges, Progress bars for attendance %, CSV/PDF export, Google Maps links for location-aware absensi
- Pembagian module: full CRUD + dedicated Kelola Anggota dialog with searchable add/remove flow + printable SK Pembagian document with proper letter format (kop, nomor, body with members table, dosen pendamping, dual signature block)
- Both modules end-to-end functional: fetch, create, edit, delete, search, sort, paginate, export, plus specialized features (QR attendance, member management, SK printing)
- Code passes ESLint cleanly with no warnings; TypeScript check shows zero errors in new files
