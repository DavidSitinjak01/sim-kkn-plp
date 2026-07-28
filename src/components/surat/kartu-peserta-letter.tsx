'use client'

/**
 * KartuPesertaLetter
 *
 * Komponen preview + cetak untuk "KARTU PESERTA" mahasiswa KKN & PLP
 * sesuai template yang diberikan user (Universitas Nias Raya).
 *
 * Format kartu (portrait, ~9:16):
 *  - Bagian atas: background abu-abu muda, sudut bawah membulat
 *    - 3 logo di header (Tut Wuri Handayani | Logo Kampus | Kampus Merdeka)
 *  - Foto mahasiswa: lingkaran, border ganda (putih luar, oranye dalam)
 *    overlap batas atas-buram
 *  - Bagian bawah: background berwarna (CYAN untuk KKN, MAROON untuk PLP)
 *  - Info: Nama, NIM, Prodi, Kelompok, Lokasi, Dosen + Universitas
 *
 * Data sources:
 *  - /api/kelompok/[id]  → kelompok + members + sekolah/desa + dosen
 *  - /api/pengaturan     → identitas instansi, logo_url
 */

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Printer, IdCard } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// ============ Types ============
interface Prodi { id: string; kode: string; nama: string; jenjang: string }
interface Fakultas { id: string; kode: string; nama: string }
interface Mahasiswa {
  id: string; nim: string; nama: string; foto: string | null
  jenisKelamin: string
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

// ============ Default pengaturan (fallback) ============
// Note: logo_tut_wuri_url & logo_kampus_merdeka_url fall back to the
// built-in SVG assets in /public when not set by the admin. Admins can
// upload higher-quality PNG/JPG logos via Pengaturan > Logo Kartu Peserta.
const DEFAULT_PENGATURAN: Record<string, string> = {
  logo_url: '/logo.png',
  logo_tut_wuri_url: '',
  logo_kampus_merdeka_url: '',
  yayasan: 'YAYASAN PENDIDIKAN NIAS SELATAN',
  nama_kampus: 'UNIVERSITAS NIAS RAYA',
  alamat_kampus: 'Jl. Pramuka, Nari-nari, Kelurahan Pasar Telukdalam 22865',
  tahun_akademik: '2024/2025',
}

// ============ Helpers ============

/** Warna tema kartu berdasarkan tipe kelompok */
function cardTheme(tipe: string) {
  switch (tipe) {
    case 'KKN':
      return {
        bottomBg: '#06b6d4',      // cyan-500
        bottomBgDark: '#0891b2',  // cyan-600
        label: 'KARTU PESERTA KKN',
        kelompokLabel: 'Kelompok KKN',
        lokasiLabel: 'Desa',
      }
    case 'PLP1':
    case 'PLP2':
      return {
        bottomBg: '#7f1d1d',      // maroon-900
        bottomBgDark: '#991b1b',  // maroon-800
        label: 'KARTU PESERTA PLP',
        kelompokLabel: `Kelompok PLP ${tipe === 'PLP1' ? 'I' : 'II'}`,
        lokasiLabel: 'Sekolah',
      }
    default:
      return {
        bottomBg: '#06b6d4',
        bottomBgDark: '#0891b2',
        label: 'KARTU PESERTA',
        kelompokLabel: 'Kelompok',
        lokasiLabel: 'Lokasi',
      }
  }
}

/** Inisial dari nama untuk placeholder foto */
function getInitials(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Convert image URL to base64 data URL for embedding in print window */
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
export function KartuPesertaLetter({ kelompokId }: Props) {
  const [kelompok, setKelompok] = useState<Kelompok | null>(null)
  const [pengaturan, setPengaturan] = useState<Pengaturan>(DEFAULT_PENGATURAN)
  const [logoBase64, setLogoBase64] = useState<string | null>(null)
  const [tutWuriBase64, setTutWuriBase64] = useState<string | null>(null)
  const [merdekaBase64, setMerdekaBase64] = useState<string | null>(null)
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
      // Sort members by NIM for consistent ordering (guard against missing members)
      if (Array.isArray(kel.members)) {
        kel.members.sort((a, b) => (a.mahasiswa?.nim ?? '').localeCompare(b.mahasiswa?.nim ?? ''))
      } else {
        kel.members = []
      }
      setKelompok(kel)
      const setJson = await setRes.json() as Pengaturan
      setPengaturan({ ...DEFAULT_PENGATURAN, ...setJson })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat data'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [kelompokId])

  // Resolve the 3 logo sources. Admin-uploaded logos (stored in pengaturan
  // as data: URLs or remote URLs) take priority; otherwise fall back to the
  // built-in SVG assets in /public.
  const tutWuriSrc = pengaturan.logo_tut_wuri_url || '/logo-tut-wuri.svg'
  const merdekaSrc = pengaturan.logo_kampus_merdeka_url || '/logo-kampus-merdeka.svg'

  // Fetch all 3 logos as base64 (for print window embedding)
  useEffect(() => {
    const logoUrl = pengaturan.logo_url || '/logo.png'
    imageUrlToBase64(logoUrl).then(setLogoBase64)
    imageUrlToBase64(tutWuriSrc).then(setTutWuriBase64)
    imageUrlToBase64(merdekaSrc).then(setMerdekaBase64)
  }, [pengaturan.logo_url, tutWuriSrc, merdekaSrc])

  useEffect(() => { fetchData() }, [fetchData])

  // ============ Print handler ============
  const handlePrint = async () => {
    if (!kelompok) return
    setPrinting(true)
    try {
      const logos = {
        kampus: logoBase64 ?? '',
        tutWuri: tutWuriBase64 ?? '',
        merdeka: merdekaBase64 ?? '',
      }
      const html = buildPrintHtml(kelompok, pengaturan, logos)
      const win = window.open('', '_blank', 'width=900,height=700')
      if (!win) {
        toast.error('Popup diblokir. Izinkan popup untuk mencetak.')
        return
      }
      win.document.write(html)
      win.document.close()
      setTimeout(() => win.print(), 800)
      toast.success('Membuka dialog cetak...')
    } catch {
      toast.error('Gagal mencetak kartu')
    } finally {
      setPrinting(false)
    }
  }

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
        <IdCard className="w-10 h-10 mx-auto opacity-40" />
        <p>{errorMsg || 'Data kelompok tidak ditemukan.'}</p>
        <Button size="sm" variant="outline" onClick={() => fetchData()}>
          <Loader2 className="w-4 h-4 mr-1.5" />Coba Lagi
        </Button>
      </div>
    )
  }

  if (kelompok.members.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <IdCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Belum ada anggota kelompok. Tambahkan mahasiswa terlebih dahulu di menu Pembagian KKN &amp; PLP.</p>
      </div>
    )
  }

  const theme = cardTheme(kelompok.tipe)
  const logoUrl = pengaturan.logo_url || '/logo.png'
  // tutWuriSrc & merdekaSrc already resolved above (with admin upload priority)

  return (
    <div className="space-y-4">
      {/* Action buttons + info */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {kelompok.members.length} kartu peserta &middot; {kelompok.nama}
        </p>
        <Button onClick={handlePrint} disabled={printing}>
          {printing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />}
          Cetak Semua Kartu
        </Button>
      </div>

      {/* Card grid preview */}
      <div className="bg-muted/30 rounded-lg border p-4 overflow-auto" style={{ maxHeight: '70vh' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
          {kelompok.members.map((m) => (
            <CardPreview
              key={m.id}
              member={m}
              kelompok={kelompok}
              pengaturan={pengaturan}
              logoUrl={logoUrl}
              tutWuriSrc={tutWuriSrc}
              merdekaSrc={merdekaSrc}
              theme={theme}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ============ Single Card Preview (React) ============
interface CardPreviewProps {
  member: Member
  kelompok: Kelompok
  pengaturan: Pengaturan
  logoUrl: string
  tutWuriSrc: string
  merdekaSrc: string
  theme: ReturnType<typeof cardTheme>
}

function CardPreview({ member, kelompok, pengaturan, logoUrl, tutWuriSrc, merdekaSrc, theme }: CardPreviewProps) {
  const m = member.mahasiswa
  const lokasi = kelompok.tipe === 'KKN'
    ? (kelompok.desa?.nama ?? '-')
    : (kelompok.sekolah?.nama ?? '-')
  const dosenText = kelompok.dosen?.nama ?? '-'
  const fotoUrl = m.foto || null
  // Extract trailing number (e.g. "1" or "1-1") from kelompok nama
  const kelompokNum = kelompok.nama.match(/\d+(-\d+)?$/)?.[0] || kelompok.nama

  return (
    <div
      className="bg-white shadow-lg overflow-hidden flex flex-col"
      style={{
        width: '300px',
        height: '480px',
        borderRadius: '18px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        position: 'relative',
      }}
    >
      {/* ===== TOP SECTION (gray with rounded bottom) ===== */}
      <div
        style={{
          background: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
          height: '42%',
          borderBottomLeftRadius: '50% 28%',
          borderBottomRightRadius: '50% 28%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '14px',
        }}
      >
        {/* 3 Logos row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', padding: '0 10px' }}>
          {/* Left: Tut Wuri Handayani (admin-uploaded or built-in SVG) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '56px' }}>
            <img
              src={tutWuriSrc}
              alt="Tut Wuri Handayani"
              style={{ width: '48px', height: '48px', objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget.style.display = 'none') }}
            />
          </div>

          {/* Center: University logo (no caption text — logo only) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo Kampus"
                style={{ width: '54px', height: '54px', objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget.style.display = 'none') }}
              />
            )}
          </div>

          {/* Right: Kampus Merdeka (admin-uploaded or built-in SVG) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '56px' }}>
            <img
              src={merdekaSrc}
              alt="Kampus Merdeka"
              style={{ width: '48px', height: '56px', objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget.style.display = 'none') }}
            />
          </div>
        </div>

        {/* Photo (overlapping boundary) */}
        <div
          style={{
            position: 'absolute',
            bottom: '-38px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '104px',
            height: '104px',
            borderRadius: '50%',
            background: '#fff',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '100%', height: '100%', borderRadius: '50%',
              border: '3px solid #f59e0b',
              overflow: 'hidden',
              background: '#e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {fotoUrl ? (
              <img src={fotoUrl} alt={m.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                  const p = t.parentElement
                  if (p) p.innerHTML = `<span style="font-size:28px;font-weight:bold;color:#64748b">${getInitials(m.nama)}</span>`
                }}
              />
            ) : (
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#64748b' }}>{getInitials(m.nama)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ===== BOTTOM SECTION (colored) ===== */}
      <div
        style={{
          background: `linear-gradient(180deg, ${theme.bottomBg} 0%, ${theme.bottomBgDark} 100%)`,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: '48px',
          paddingLeft: '12px',
          paddingRight: '12px',
          textAlign: 'center',
          color: '#000',
        }}
      >
        {/* Label banner */}
        <div style={{
          background: '#fff',
          padding: '3px 14px',
          borderRadius: '10px',
          fontSize: '9px',
          fontWeight: 800,
          color: theme.bottomBgDark,
          letterSpacing: '0.5px',
          marginBottom: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}>
          {theme.label}
        </div>

        {/* Nama */}
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#000', lineHeight: 1.2, padding: '0 8px', maxWidth: '270px', wordBreak: 'break-word' }}>
          {m.nama}
        </div>

        {/* NIM */}
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#000', fontFamily: 'monospace', marginTop: '3px' }}>
          {m.nim}
        </div>

        {/* Prodi */}
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#1f2937', marginTop: '4px', textTransform: 'uppercase' }}>
          {m.prodi.nama}
        </div>

        {/* Divider */}
        <div style={{ width: '60%', height: '1px', background: 'rgba(0,0,0,0.25)', margin: '8px 0' }} />

        {/* Kelompok */}
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#000' }}>
          {theme.kelompokLabel} - {kelompokNum}
        </div>

        {/* Lokasi */}
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', marginTop: '2px', maxWidth: '260px', lineHeight: 1.2 }}>
          {theme.lokasiLabel}: {lokasi}
        </div>

        {/* Dosen */}
        <div style={{ fontSize: '9px', fontWeight: 600, color: '#1f2937', marginTop: '6px', maxWidth: '260px', lineHeight: 1.2 }}>
          DPL: {dosenText}
        </div>

        {/* Universitas (bottom) */}
        <div style={{
          fontSize: '8px', fontWeight: 800, color: '#fff', marginTop: 'auto', marginBottom: '10px',
          letterSpacing: '0.8px', textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}>
          {pengaturan.nama_kampus}
        </div>
      </div>
    </div>
  )
}

// ============ Print HTML Builder ============
interface PrintLogos {
  kampus: string
  tutWuri: string
  merdeka: string
}

function buildPrintHtml(kelompok: Kelompok, p: Pengaturan, logos: PrintLogos): string {
  const theme = cardTheme(kelompok.tipe)
  const kampusImg = logos.kampus
    ? `<img src="${logos.kampus}" alt="Logo Kampus" style="width:54px;height:54px;object-fit:contain;" />`
    : ''
  const tutWuriImg = logos.tutWuri
    ? `<img src="${logos.tutWuri}" alt="Tut Wuri Handayani" style="width:48px;height:48px;object-fit:contain;" />`
    : ''
  const merdekaImg = logos.merdeka
    ? `<img src="${logos.merdeka}" alt="Kampus Merdeka" style="width:48px;height:56px;object-fit:contain;" />`
    : ''

  // Extract trailing number (e.g. "1" or "1-1") from kelompok nama
  const kelompokNum = kelompok.nama.match(/\d+(-\d+)?$/)?.[0] || kelompok.nama

  const cardsHtml = kelompok.members.map((m) => {
    const lokasi = kelompok.tipe === 'KKN'
      ? (kelompok.desa?.nama ?? '-')
      : (kelompok.sekolah?.nama ?? '-')
    const dosenText = escapeHtml(kelompok.dosen?.nama ?? '-')
    const fotoUrl = m.mahasiswa.foto || ''
    const fotoHtml = fotoUrl
      ? `<img src="${escapeHtml(fotoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:28px;font-weight:bold;color:#64748b\\'>${getInitials(m.mahasiswa.nama)}</span>'" />`
      : `<span style="font-size:28px;font-weight:bold;color:#64748b">${getInitials(m.mahasiswa.nama)}</span>`

    return `
    <div class="card">
      <!-- TOP -->
      <div class="top">
        <div class="logos">
          <div class="logo-side">
            ${tutWuriImg}
          </div>
          <div class="logo-center">
            ${kampusImg}
          </div>
          <div class="logo-side">
            ${merdekaImg}
          </div>
        </div>
        <!-- Photo -->
        <div class="photo-wrap">
          <div class="photo-inner">
            ${fotoHtml}
          </div>
        </div>
      </div>
      <!-- BOTTOM -->
      <div class="bottom" style="background:linear-gradient(180deg, ${theme.bottomBg} 0%, ${theme.bottomBgDark} 100%);">
        <div class="banner">${theme.label}</div>
        <div class="name">${escapeHtml(m.mahasiswa.nama)}</div>
        <div class="nim">${escapeHtml(m.mahasiswa.nim)}</div>
        <div class="prodi">${escapeHtml(m.mahasiswa.prodi.nama)}</div>
        <div class="divider"></div>
        <div class="kelompok">${theme.kelompokLabel} - ${escapeHtml(kelompokNum)}</div>
        <div class="lokasi">${theme.lokasiLabel}: ${escapeHtml(lokasi)}</div>
        <div class="dosen">DPL: ${dosenText}</div>
        <div class="univ">${escapeHtml(p.nama_kampus)}</div>
      </div>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Kartu Peserta — ${escapeHtml(kelompok.nama)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
  }
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6mm;
    justify-items: center;
  }
  .card {
    width: 85mm;
    height: 128mm;
    border-radius: 4mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    position: relative;
    page-break-inside: avoid;
  }
  .top {
    background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
    height: 42%;
    border-bottom-left-radius: 50% 28%;
    border-bottom-right-radius: 50% 28%;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 4mm;
  }
  .logos {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    padding: 0 4mm;
  }
  .logo-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16mm;
  }
  .logo-center {
    display: flex; flex-direction: column; align-items: center;
  }
  .logo-cap {
    font-size: 1.8mm; color: #475569; margin-top: 0.5mm;
    text-align: center; line-height: 1.1; font-weight: 700; text-transform: uppercase;
  }
  .photo-wrap {
    position: absolute;
    bottom: -10mm;
    left: 50%;
    transform: translateX(-50%);
    width: 26mm; height: 26mm;
    border-radius: 50%;
    background: #fff;
    padding: 1mm;
    box-shadow: 0 1mm 3mm rgba(0,0,0,0.25);
    z-index: 2;
  }
  .photo-inner {
    width: 100%; height: 100%; border-radius: 50%;
    border: 0.8mm solid #f59e0b;
    overflow: hidden;
    background: #e2e8f0;
    display: flex; align-items: center; justify-content: center;
  }
  .bottom {
    flex: 1;
    display: flex; flex-direction: column; align-items: center;
    justify-content: flex-start;
    padding-top: 13mm;
    text-align: center;
    color: #000;
  }
  .banner {
    background: #fff;
    padding: 0.8mm 3.5mm;
    border-radius: 2.5mm;
    font-size: 2.6mm; font-weight: 800;
    color: ${theme.bottomBgDark};
    letter-spacing: 0.2mm;
    margin-bottom: 2mm;
    box-shadow: 0 0.5mm 1mm rgba(0,0,0,0.2);
  }
  .name {
    font-size: 3.4mm; font-weight: 800; color: #000;
    line-height: 1.2; padding: 0 2mm; max-width: 70mm; word-break: break-word;
  }
  .nim {
    font-size: 3.1mm; font-weight: 700; color: #000;
    font-family: monospace; margin-top: 0.8mm;
  }
  .prodi {
    font-size: 2.6mm; font-weight: 700; color: #1f2937;
    margin-top: 1mm; text-transform: uppercase;
  }
  .divider {
    width: 60%; height: 0.3mm;
    background: rgba(0,0,0,0.25); margin: 2mm 0;
  }
  .kelompok {
    font-size: 2.9mm; font-weight: 800; color: #000;
  }
  .lokasi {
    font-size: 2.6mm; font-weight: 600; color: #1f2937;
    margin-top: 0.5mm; max-width: 68mm; line-height: 1.2;
  }
  .dosen {
    font-size: 2.4mm; font-weight: 600; color: #1f2937;
    margin-top: 1.5mm; max-width: 68mm; line-height: 1.2;
  }
  .univ {
    font-size: 2.2mm; font-weight: 800; color: #fff;
    margin-top: auto; margin-bottom: 2.5mm;
    letter-spacing: 0.2mm; text-shadow: 0 0.5mm 1mm rgba(0,0,0,0.3);
  }
  @media print {
    .cards-grid { gap: 4mm; }
    .card { box-shadow: none; }
  }
</style>
</head>
<body>
<div class="cards-grid">
  ${cardsHtml}
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
