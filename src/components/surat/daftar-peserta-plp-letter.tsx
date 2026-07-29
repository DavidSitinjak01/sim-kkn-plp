'use client'

/**
 * DaftarPesertaPLPLetter
 *
 * Komponen preview + cetak untuk format surat "DAFTAR PESERTA
 * PENGENALAN LINGKUNGAN PERSEKOLAHAN (PLP) II" sesuai template PDF
 * yang diberikan user (Universitas Nias Raya).
 *
 * Fitur:
 *  - Render preview di dalam Dialog (A4 ratio, logo di header)
 *  - Print: buka window baru, inject logo sebagai base64 data URL
 *    (agar muncul di print window), generate HTML format surat
 *
 * Data sources:
 *  - /api/kelompok/[id]  → kelompok + members + sekolah + dosen
 *  - /api/pengaturan     → identitas instansi, panitia, logo_url
 */

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// ============ Types ============
interface Prodi { id: string; kode: string; nama: string; jenjang: string }
interface Fakultas { id: string; kode: string; nama: string }
interface Mahasiswa {
  id: string; nim: string; nama: string
  prodi: Prodi & { fakultas: Fakultas }
}
interface Member { id: string; mahasiswa: Mahasiswa }
interface Dosen { id: string; nidn: string; nama: string; noHp: string }
interface Sekolah { id: string; nama: string; jenjang: string; alamat: string }
interface Desa { id: string; nama: string; kecamatan: string; kabupaten: string }
interface Kelompok {
  id: string; nama: string; tipe: string; tahunAkademik: string; semester: string
  dosen: Dosen | null; sekolah: Sekolah | null; desa: Desa | null
  members: Member[]
  _count?: { members: number }
}

type Pengaturan = Record<string, string>

interface Props {
  kelompokId: string
  onClose?: () => void
}

// ============ Default pengaturan (fallback jika key tidak ada di DB) ============
// Default values match EXACTLY the user-uploaded PDF template (Universitas Nias Raya).
const DEFAULT_PENGATURAN: Record<string, string> = {
  logo_url: '/logo.png',
  yayasan: 'YAYASAN PENDIDIKAN NIAS SELATAN',
  panitia_plp: 'PANITIA PENGENALAN LAPANGAN PERSEKOLAHAN II',
  panitia_kkn: 'PANITIA KULIAH KERJA NYATA',
  izin_operasional: 'Kepmendikbudristek Nomor 363/E/O/2021',
  ketua_panitia: 'Antonius Sarumaha, M.Pd',
  ketua_panitia_nidn: '0118058405',
  sekretaris_panitia: 'Adam Smith Bago, S.Si., M.Pd',
  sekretaris_panitia_nidn: '0101018409',
  koordinator_lapangan: 'Samalua Waoma, S.E., M.M., M.Ak.',
  nama_kampus: 'UNIVERSITAS NIAS RAYA',
  // Alamat + Telp/Fax dalam SATU BARIS dengan separator ' • ' (sesuai PDF asli).
  alamat_kampus: 'Jl. Pramuka, Nari-nari, Kehurahan Pasar Telukdalam 22865 • Kabupaten Nias Selatan, Sumatra Utara, Telp/Fax (0630) 7321325',
  no_telepon: '(0630) 7321325',
  email_kampus: '',
  tahun_akademik: '2024/2025',
}

// ============ Helpers ============
function tipeLabel(tipe: string): string {
  switch (tipe) {
    case 'PLP1': return 'I'
    case 'PLP2': return 'II'
    default: return ''
  }
}

/**
 * Build the surat title (3 lines) based on kelompok tipe.
 * KKN  -> "DAFTAR PESERTA / KULIAH KERJA NYATA (KKN) / FKIP <KAMPUS>"
 * PLP1 -> "DAFTAR PESERTA / PENGENALAN LINGKUNGAN PERSEKOLAHAN (PLP) I / FKIP <KAMPUS>"
 * PLP2 -> "DAFTAR PESERTA / PENGENALAN LINGKUNGAN PERSEKOLAHAN (PLP) II / FKIP <KAMPUS>"
 */
function judulSurat(tipe: string, namaKampus: string): { line1: string; line2: string; line3: string } {
  const fkip = `FKIP ${namaKampus}`
  switch (tipe) {
    case 'KKN':
      return {
        line1: 'DAFTAR PESERTA',
        line2: 'KULIAH KERJA NYATA (KKN)',
        line3: fkip,
      }
    case 'PLP1':
    case 'PLP2':
      return {
        line1: 'DAFTAR PESERTA',
        line2: `PENGENALAN LINGKUNGAN PERSEKOLAHAN (PLP) ${tipeLabel(tipe)}`,
        line3: fkip,
      }
    default:
      return {
        line1: 'DAFTAR PESERTA',
        line2: 'KULIAH KERJA NYATA / PLP',
        line3: fkip,
      }
  }
}

/**
 * Resolve the panitia (committee) label based on tipe.
 *  - KKN  -> use panitia_kkn setting (fallback to "PANITIA KULIAH KERJA NYATA")
 *  - PLP* -> use panitia_plp setting with correct Roman numeral appended
 */
function panitiaLabelFor(tipe: string, p: Pengaturan): string {
  if (tipe === 'KKN') {
    return p.panitia_kkn || 'PANITIA KULIAH KERJA NYATA'
  }
  const roman = tipeLabel(tipe)
  const base = p.panitia_plp || 'PANITIA PENGENALAN LAPANGAN PERSEKOLAHAN'
  if (!roman) return base
  // Remove any trailing Roman numeral (I, II, III, ...) and re-append correct one
  const stripped = base.replace(/\s+I+\s*$/i, '').trimEnd()
  return `${stripped} ${roman}`
}

/** Lokasi label + nama based on tipe (KKN -> Desa, PLP -> Sekolah) */
function lokasiInfo(tipe: string, kelompok: Kelompok): { label: string; nama: string } {
  if (tipe === 'KKN') {
    return { label: 'Desa Mitra', nama: kelompok.desa?.nama ?? '-' }
  }
  return { label: 'Sekolah Mitra', nama: kelompok.sekolah?.nama ?? '-' }
}

/**
 * Convert image URL to base64 data URL for embedding in print window.
 * Handles both relative (/logo.png) and absolute URLs.
 */
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ============ Main Component ============
export function DaftarPesertaPLPLetter({ kelompokId }: Props) {
  const [kelompok, setKelompok] = useState<Kelompok | null>(null)
  const [pengaturan, setPengaturan] = useState<Pengaturan>(DEFAULT_PENGATURAN)
  const [logoBase64, setLogoBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!kelompokId) {
      setErrorMsg('ID Kelompok tidak valid.')
      setLoading(false)
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const [kelRes, setRes] = await Promise.all([
        fetch(`/api/kelompok/${kelompokId}`, { cache: 'no-store' }),
        fetch('/api/pengaturan', { cache: 'no-store' }),
      ])
      if (!kelRes.ok) {
        const errBody = await kelRes.json().catch(() => ({}))
        throw new Error(errBody?.error || `Gagal memuat kelompok (HTTP ${kelRes.status})`)
      }
      const kel = await kelRes.json() as Kelompok
      if (Array.isArray(kel.members)) {
        kel.members.sort((a, b) => (a.mahasiswa?.nim ?? '').localeCompare(b.mahasiswa?.nim ?? ''))
      } else {
        kel.members = []
      }
      setKelompok(kel)
      const setJson = await setRes.json() as Pengaturan
      // Merge with defaults so missing keys still have values
      setPengaturan({ ...DEFAULT_PENGATURAN, ...setJson })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat data'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [kelompokId])

  // Fetch logo as base64 when pengaturan.logo_url is known
  useEffect(() => {
    const logoUrl = pengaturan.logo_url || '/logo.png'
    imageUrlToBase64(logoUrl).then(setLogoBase64)
  }, [pengaturan.logo_url])

  useEffect(() => { fetchData() }, [fetchData])

  // ============ Print handler ============
  const handlePrint = async () => {
    if (!kelompok) return
    setPrinting(true)
    try {
      const logo = logoBase64 ?? ''
      const html = buildPrintHtml(kelompok, pengaturan, logo)
      const win = window.open('', '_blank', 'width=900,height=700')
      if (!win) {
        toast.error('Popup diblokir. Izinkan popup untuk mencetak.')
        return
      }
      win.document.write(html)
      win.document.close()
      // Wait for logo image to load before printing
      setTimeout(() => win.print(), 600)
      toast.success('Membuka dialog cetak...')
    } catch (e) {
      toast.error('Gagal mencetak surat')
    } finally {
      setPrinting(false)
    }
  }

  // ============ Loading state ============
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Memuat data...</span>
      </div>
    )
  }

  if (!kelompok) {
    return (
      <div className="py-12 text-center text-muted-foreground space-y-3">
        <Printer className="w-10 h-10 mx-auto opacity-40" />
        <p>{errorMsg || 'Data kelompok tidak ditemukan.'}</p>
        <Button size="sm" variant="outline" onClick={() => fetchData()}>
          <Loader2 className="w-4 h-4 mr-1.5" />Coba Lagi
        </Button>
      </div>
    )
  }

  const judul = judulSurat(kelompok.tipe, pengaturan.nama_kampus)
  const panitiaText = panitiaLabelFor(kelompok.tipe, pengaturan)
  const lokasi = lokasiInfo(kelompok.tipe, kelompok)
  const logoUrl = pengaturan.logo_url || '/logo.png'

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button onClick={handlePrint} disabled={printing}>
          {printing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}
          Cetak / PDF
        </Button>
      </div>

      {/* Letter Preview (A4 ratio) */}
      <div className="bg-white text-black rounded-lg border shadow-inner overflow-auto" style={{ maxHeight: '70vh' }}>
        <div className="mx-auto bg-white" style={{ width: '100%', maxWidth: '794px', padding: '40px 50px', fontFamily: 'Times New Roman, serif' }}>
          {/* ===== KOP SURAT =====
             Layout: logo absolute di kiri (90px), blok teks KOP diberi margin
             kiri-kanan 100px agar teks (terutama baris alamat yang panjang)
             TIDAK tertutup logo. Karena margin kiri = margin kanan (simetris),
             titik tengah teks tetap sama dengan titik tengah judul surat di
             bawahnya → KOP & keterangan surat tetap SEJAJAR. */}
          <div style={{ position: 'relative', borderBottom: '3px double #000', paddingBottom: '10px', marginBottom: '6px', minHeight: '90px' }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                style={{ position: 'absolute', left: 0, top: 0, width: '90px', height: '90px', objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget.style.display = 'none') }}
              />
            )}
            <div style={{ margin: '0 100px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 'normal', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{pengaturan.yayasan}</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{pengaturan.nama_kampus}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{panitiaText}</div>
              <div style={{ fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }}>Izin Operasional: {pengaturan.izin_operasional}</div>
              <div style={{ fontSize: '10px', marginTop: '2px' }}>{pengaturan.alamat_kampus}</div>
            </div>
          </div>

          {/* ===== JUDUL SURAT ===== (jarak lebar dari kop sesuai PDF) */}
          <div style={{ textAlign: 'center', margin: '28px 0 18px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{judul.line1}</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>{judul.line2}</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{judul.line3}</div>
          </div>

          {/* ===== INFO KELOMPOK ===== */}
          <div style={{ fontSize: '12px', marginBottom: '14px', lineHeight: '1.7' }}>
            <div><span style={{ display: 'inline-block', width: '180px' }}>Kelompok</span>: {kelompok.nama}</div>
            <div><span style={{ display: 'inline-block', width: '180px' }}>{lokasi.label}</span>: {lokasi.nama}</div>
            <div><span style={{ display: 'inline-block', width: '180px' }}>DPL/WA</span>: {kelompok.dosen ? `${kelompok.dosen.nama}/${kelompok.dosen.noHp}` : '-'}</div>
            <div><span style={{ display: 'inline-block', width: '180px' }}>Koordinator Lapangan</span>: {pengaturan.koordinator_lapangan}</div>
          </div>

          {/* ===== TABEL PESERTA ===== */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', width: '40px' }}>No</th>
                <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', width: '160px' }}>NIM</th>
                <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center' }}>Nama Mahasiswa</th>
                <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', width: '220px' }}>Program Studi</th>
              </tr>
            </thead>
            <tbody>
              {kelompok.members.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '14px', textAlign: 'center', fontStyle: 'italic' }}>
                    Belum ada anggota kelompok
                  </td>
                </tr>
              ) : (
                kelompok.members.map((m, i) => (
                  <tr key={m.id}>
                    <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '5px 8px', fontFamily: 'monospace' }}>{m.mahasiswa.nim}</td>
                    <td style={{ border: '1px solid #000', padding: '5px 8px' }}>{m.mahasiswa.nama}</td>
                    <td style={{ border: '1px solid #000', padding: '5px 8px' }}>{m.mahasiswa.prodi.nama}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* ===== FOOTER / TANDA TANGAN ===== (sesuai PDF: ruang tanda tangan ~5cm, NIDN bold) */}
          <div style={{ textAlign: 'center', marginTop: '24px', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{panitiaText}</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>FKIP {pengaturan.nama_kampus} T.A {pengaturan.tahun_akademik}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', fontSize: '12px' }}>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div>Ketua,</div>
              <div style={{ height: '120px' }} />
              <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{pengaturan.ketua_panitia}</div>
              <div style={{ fontWeight: 'bold' }}>NIDN {pengaturan.ketua_panitia_nidn}</div>
            </div>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div>Sekretaris,</div>
              <div style={{ height: '120px' }} />
              <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{pengaturan.sekretaris_panitia}</div>
              <div style={{ fontWeight: 'bold' }}>NIDN {pengaturan.sekretaris_panitia_nidn}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ Print HTML Builder ============
function buildPrintHtml(kelompok: Kelompok, p: Pengaturan, logoBase64: string): string {
  const judul = judulSurat(kelompok.tipe, p.nama_kampus)
  const panitiaText = panitiaLabelFor(kelompok.tipe, p)
  const lokasi = lokasiInfo(kelompok.tipe, kelompok)
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="width:85px;height:85px;object-fit:contain;flex-shrink:0;" />`
    : ''

  const rowsHtml = kelompok.members.length === 0
    ? `<tr><td colspan="4" style="border:1px solid #000;padding:14px;text-align:center;font-style:italic;">Belum ada anggota kelompok</td></tr>`
    : kelompok.members.map((m, i) => `
        <tr>
          <td style="border:1px solid #000;padding:5px 8px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid #000;padding:5px 8px;font-family:monospace;">${escapeHtml(m.mahasiswa.nim)}</td>
          <td style="border:1px solid #000;padding:5px 8px;">${escapeHtml(m.mahasiswa.nama)}</td>
          <td style="border:1px solid #000;padding:5px 8px;">${escapeHtml(m.mahasiswa.prodi.nama)}</td>
        </tr>
      `).join('')

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>${judul.line1} ${judul.line2} — ${escapeHtml(kelompok.nama)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    color: #000;
    margin: 0;
    padding: 0;
    font-size: 12pt;
  }
  .page {
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 5mm;
  }
  .kop {
    position: relative;
    border-bottom: 3px double #000;
    padding-bottom: 10px;
    margin-bottom: 18px;
    min-height: 90px;
  }
  .kop .text { margin: 0 100px; text-align: center; }
  .kop img { position: absolute; left: 0; top: 0; width: 90px; height: 90px; object-fit: contain; }
  .yayasan { font-size: 12px; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; }
  .universitas { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
  .panitia { font-size: 12px; font-weight: bold; letter-spacing: 0.3px; text-transform: uppercase; }
  .izin { font-size: 10px; font-style: italic; margin-top: 2px; }
  .alamat { font-size: 10px; margin-top: 2px; }
  .judul { text-align: center; margin: 28px 0 18px; }
  .judul .line1 { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .judul .line2 { font-size: 14px; font-weight: bold; text-transform: uppercase; }
  .judul .line3 { font-size: 13px; font-weight: bold; text-transform: uppercase; }
  .info { font-size: 12px; margin-bottom: 14px; line-height: 1.7; }
  .info .label { display: inline-block; width: 180px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
  th { border: 1px solid #000; padding: 6px 8px; text-align: center; background: #f0f0f0; }
  td { border: 1px solid #000; padding: 5px 8px; }
  .footer-title { text-align: center; margin-top: 24px; margin-bottom: 8px; }
  .footer-title .l1 { font-size: 12px; font-weight: bold; }
  .footer-title .l2 { font-size: 12px; font-weight: bold; }
  .signature { display: flex; justify-content: space-between; margin-top: 24px; font-size: 12px; }
  .signature .col { text-align: center; width: 45%; }
  .signature .space { height: 120px; }
  .signature .name { font-weight: bold; text-decoration: underline; }
  .signature .nidn { font-weight: bold; }
  @media print {
    .no-print { display: none; }
    body { font-size: 11pt; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- KOP SURAT -->
  <div class="kop">
    ${logoImg}
    <div class="text">
      <div class="yayasan">${escapeHtml(p.yayasan)}</div>
      <div class="universitas">${escapeHtml(p.nama_kampus)}</div>
      <div class="panitia">${escapeHtml(panitiaText)}</div>
      <div class="izin">Izin Operasional: ${escapeHtml(p.izin_operasional)}</div>
      <div class="alamat">${escapeHtml(p.alamat_kampus)}</div>
    </div>
  </div>

  <!-- JUDUL -->
  <div class="judul">
    <div class="line1">${escapeHtml(judul.line1)}</div>
    <div class="line2">${escapeHtml(judul.line2)}</div>
    <div class="line3">${escapeHtml(judul.line3)}</div>
  </div>

  <!-- INFO -->
  <div class="info">
    <div><span class="label">Kelompok</span>: ${escapeHtml(kelompok.nama)}</div>
    <div><span class="label">${escapeHtml(lokasi.label)}</span>: ${escapeHtml(lokasi.nama)}</div>
    <div><span class="label">DPL/WA</span>: ${kelompok.dosen ? escapeHtml(kelompok.dosen.nama) + '/' + escapeHtml(kelompok.dosen.noHp) : '-'}</div>
    <div><span class="label">Koordinator Lapangan</span>: ${escapeHtml(p.koordinator_lapangan)}</div>
  </div>

  <!-- TABEL -->
  <table>
    <thead>
      <tr>
        <th style="width:40px;">No</th>
        <th style="width:160px;">NIM</th>
        <th>Nama Mahasiswa</th>
        <th style="width:220px;">Program Studi</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <!-- FOOTER -->
  <div class="footer-title">
    <div class="l1">${escapeHtml(panitiaText)}</div>
    <div class="l2">FKIP ${escapeHtml(p.nama_kampus)} T.A ${escapeHtml(p.tahun_akademik)}</div>
  </div>

  <div class="signature">
    <div class="col">
      <div>Ketua,</div>
      <div class="space"></div>
      <div class="name">${escapeHtml(p.ketua_panitia)}</div>
      <div class="nidn">NIDN ${escapeHtml(p.ketua_panitia_nidn)}</div>
    </div>
    <div class="col">
      <div>Sekretaris,</div>
      <div class="space"></div>
      <div class="name">${escapeHtml(p.sekretaris_panitia)}</div>
      <div class="nidn">NIDN ${escapeHtml(p.sekretaris_panitia_nidn)}</div>
    </div>
  </div>
</div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
