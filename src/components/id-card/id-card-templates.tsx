'use client'

/**
 * id-card-templates.tsx
 *
 * 4 desain template Kartu Tanda Mahasiswa (KTM / ID Card) — PORTRAIT.
 *
 * *** TATA LETAK 100% IDENTIK DENGAN REFERENSI (kartu-peserta) ***
 *   - Orientasi portrait (preview 300×480px, print 85mm×128mm)
 *   - Bagian ATAS (42%): gradient terang, sudut bawah membulat (50% 28%)
 *     - 3 LOGO sejajar di header: Tut Wuri Handayani | Logo Kampus | Kampus Merdeka
 *   - Foto mahasiswa: lingkaran, padding putih + ring berwarna tema, overlap batas atas-bawah
 *   - Bagian BAWAH (58%): gradient warna jenuh (per palette)
 *     - Label banner (pill putih)
 *     - Nama, NIM, Prodi
 *     - Divider
 *     - Kelompok, Lokasi, DPL
 *     - Nama universitas di paling bawah (teks putih)
 *
 * *** "MEGAH" HANYA MELALUI OVERLAY (tidak menggeser konten) ***
 *   - Border emas ganda mengelilingi seluruh kartu
 *   - Corner flourishes (SVG ornamen) di 4 sudut
 *   - Pola background halus di section atas (opacity rendah)
 *   - Gradient kaya (bukan flat) untuk top & bottom — tetap warna tema
 *   - Ring foto = warna tema per palette
 *   - Shimmer overlay halus di section bawah
 *   - Aksen garis emas tipis di bawah banner
 *
 * Yang BERUBAH per template: hanya WARNA (palette) + POLA dekoratif.
 * Yang TETAP (persis referensi): posisi 3 logo, posisi foto, urutan & posisi
 * semua field teks, ukuran kartu, proporsi 42/58.
 */

import {
  IdCard as IdCardIcon, Sun, Leaf, Gem,
} from 'lucide-react'
import type { CSSProperties } from 'react'

// ============ Types ============
interface Prodi { id: string; kode: string; nama: string; jenjang: string }
interface Fakultas { id: string; kode: string; nama: string }
interface Desa { id: string; nama: string; kecamatan: string | null; kabupaten: string | null }
interface DosenLengkap {
  id: string
  nama: string
  nidn: string
  fakultas: Fakultas | null
  prodi: Prodi | null
}
interface KelompokLengkap {
  id: string
  nama: string
  tipe: string // KKN, PLP1, PLP2
  desa: Desa | null
  dosen: DosenLengkap | null
}
interface KelompokMemberLengkap {
  id: string
  kelompok: KelompokLengkap
}

export interface IdCardMahasiswa {
  id: string
  nim: string
  nama: string
  jenisKelamin: string // L | P
  tempatLahir: string
  tanggalLahir: string | Date
  alamat: string
  noHp: string
  email: string
  foto: string | null
  semester: number
  angkatan: number
  status: string
  prodi: Prodi & { fakultas: Fakultas }
  // Optional, hanya terisi jika fetch dengan ?withKelompok=true
  kelompokMember?: KelompokMemberLengkap[]
}

export type IdCardPengaturan = Record<string, string>

/** 3 logo yang ditampilkan di header (URL untuk preview, base64 untuk print). */
export interface IdCardLogos {
  kampus: string
  tutWuri: string
  merdeka: string
}

export type TemplateId = 'cyan-nias' | 'royal-purple' | 'sunset-coral' | 'forest-emerald'

export interface IdCardTemplateMeta {
  id: TemplateId
  nama: string
  deskripsi: string
  orientasi: 'portrait'
  accent: string // hex color preview swatch
  icon: typeof IdCardIcon
}

export const ID_CARD_TEMPLATES: IdCardTemplateMeta[] = [
  {
    id: 'cyan-nias',
    nama: 'Cyan Nias',
    deskripsi: 'Mint + cyan dengan ornamen emas & pola damask halus.',
    orientasi: 'portrait',
    accent: '#00BCD4',
    icon: IdCardIcon,
  },
  {
    id: 'royal-purple',
    nama: 'Royal Purple',
    deskripsi: 'Lavender + ungu royal dengan filigree emas & pola barok.',
    orientasi: 'portrait',
    accent: '#7B1FA2',
    icon: Gem,
  },
  {
    id: 'sunset-coral',
    nama: 'Sunset Coral',
    deskripsi: 'Cream + coral dengan geometri emas art deco.',
    orientasi: 'portrait',
    accent: '#E53935',
    icon: Sun,
  },
  {
    id: 'forest-emerald',
    nama: 'Forest Emerald',
    deskripsi: 'Sage + emerald dengan ornamen botanis emas.',
    orientasi: 'portrait',
    accent: '#2E7D32',
    icon: Leaf,
  },
]

// ============ Helpers ============

/** Inisial dari nama untuk placeholder foto */
export function getInitials(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Convert image URL/dataURL to base64 data URL for print embedding */
export async function imageUrlToBase64(url: string): Promise<string | null> {
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

// ============ Derived field helpers ============

function getKelompok(m: IdCardMahasiswa): KelompokLengkap | null {
  if (!m.kelompokMember || m.kelompokMember.length === 0) return null
  return m.kelompokMember[0]?.kelompok ?? null
}

function getKelompokLabel(m: IdCardMahasiswa): string {
  const k = getKelompok(m)
  if (!k) return '-'
  // Extract trailing number (e.g. "1" or "1-1") from kelompok nama — sama persis
  // dengan referensi kartu-peserta.
  const num = k.nama.match(/\d+(-\d+)?$/)?.[0] || k.nama
  const tipeLabel = k.tipe === 'KKN'
    ? 'KKN'
    : k.tipe === 'PLP1'
    ? 'PLP 1'
    : k.tipe === 'PLP2'
    ? 'PLP 2'
    : k.tipe
  return `${tipeLabel} - ${num}`
}

function getLokasiLabel(m: IdCardMahasiswa): string {
  const k = getKelompok(m)
  if (!k?.desa) return '-'
  return k.desa.nama
}

function getDosenLabel(m: IdCardMahasiswa): string {
  const k = getKelompok(m)
  if (!k?.dosen) return '-'
  return k.dosen.nama
}

// ============================================================
//  PALETTE — 4 template color schemes (dengan gold accents)
//  Bottom gradient dibuat medium-saturation supaya teks hitam
//  (sama persis dengan referensi) tetap terbaca.
// ============================================================

interface TemplatePalette {
  // Background colors
  topBgGradient: string   // gradient untuk top section (terang, tinted tema)
  bottomBg: string        // awal gradient bottom
  bottomBgDark: string    // akhir gradient bottom
  bottomBgGradient: string
  // Photo ring (inner border warna tema)
  ringColor: string
  // Gold ornaments
  gold: string
  goldSoft: string        // rgba soft gold for patterns
  // Misc
  shadowColor: string
  patternColor: string    // very faint pattern color di top section
}

const GOLD = '#D4AF37'
const GOLD_SOFT = 'rgba(212, 175, 55, 0.16)'

const PALETTES: Record<TemplateId, TemplatePalette> = {
  'cyan-nias': {
    topBgGradient: 'linear-gradient(180deg, #E0F7FA 0%, #B2EBF2 100%)',
    bottomBg: '#00BCD4',
    bottomBgDark: '#00838F',
    bottomBgGradient: 'linear-gradient(180deg, #00BCD4 0%, #00838F 100%)',
    ringColor: '#FF9800',
    gold: GOLD,
    goldSoft: GOLD_SOFT,
    shadowColor: 'rgba(0, 60, 70, 0.25)',
    patternColor: 'rgba(0, 96, 100, 0.10)',
  },
  'royal-purple': {
    topBgGradient: 'linear-gradient(180deg, #F3E5F5 0%, #D1C4E9 100%)',
    bottomBg: '#9C27B0',
    bottomBgDark: '#6A1B9A',
    bottomBgGradient: 'linear-gradient(180deg, #9C27B0 0%, #6A1B9A 100%)',
    ringColor: '#FFD700',
    gold: GOLD,
    goldSoft: 'rgba(212, 175, 55, 0.18)',
    shadowColor: 'rgba(60, 0, 100, 0.30)',
    patternColor: 'rgba(74, 20, 140, 0.10)',
  },
  'sunset-coral': {
    topBgGradient: 'linear-gradient(180deg, #FFF3E0 0%, #FFE0B2 100%)',
    bottomBg: '#EF5350',
    bottomBgDark: '#C62828',
    bottomBgGradient: 'linear-gradient(180deg, #EF5350 0%, #C62828 100%)',
    ringColor: '#00897B',
    gold: GOLD,
    goldSoft: 'rgba(212, 175, 55, 0.18)',
    shadowColor: 'rgba(120, 20, 20, 0.25)',
    patternColor: 'rgba(198, 40, 40, 0.10)',
  },
  'forest-emerald': {
    topBgGradient: 'linear-gradient(180deg, #E8F5E9 0%, #C8E6C9 100%)',
    bottomBg: '#43A047',
    bottomBgDark: '#2E7D32',
    bottomBgGradient: 'linear-gradient(180deg, #43A047 0%, #2E7D32 100%)',
    ringColor: '#FFB300',
    gold: GOLD,
    goldSoft: 'rgba(212, 175, 55, 0.18)',
    shadowColor: 'rgba(20, 60, 20, 0.28)',
    patternColor: 'rgba(27, 94, 32, 0.10)',
  },
}

// ============================================================
//  PATTERN GENERATORS — background patterns halus per variant
//  (overlay di top section, opacity rendah, TIDAK menggeser konten)
// ============================================================

/** Generate CSS background pattern untuk top section (React inline style) */
function getPatternStyle(variant: TemplateId, palette: TemplatePalette): CSSProperties {
  const g = palette.goldSoft
  if (variant === 'cyan-nias') {
    // Damask — repeating floral diamonds
    return {
      backgroundImage: `
        radial-gradient(circle at 50% 50%, ${g} 1px, transparent 1.5px),
        radial-gradient(circle at 0% 0%, ${g} 0.8px, transparent 1.2px),
        radial-gradient(circle at 100% 100%, ${g} 0.8px, transparent 1.2px)
      `,
      backgroundSize: '12px 12px, 12px 12px, 12px 12px',
    }
  }
  if (variant === 'royal-purple') {
    // Baroque — large radial fleur
    return {
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, ${g} 0%, transparent 35%),
        radial-gradient(circle at 50% 50%, ${g} 2px, transparent 3px)
      `,
      backgroundSize: '24px 24px, 8px 8px',
    }
  }
  if (variant === 'sunset-coral') {
    // Art deco — diagonal stripes
    return {
      backgroundImage: `
        repeating-linear-gradient(45deg, ${g} 0, ${g} 1px, transparent 1px, transparent 10px),
        repeating-linear-gradient(-45deg, ${g} 0, ${g} 1px, transparent 1px, transparent 10px)
      `,
      backgroundSize: '14px 14px, 14px 14px',
    }
  }
  // forest-emerald — Islamic geometric dots
  return {
    backgroundImage: `
      radial-gradient(circle, ${g} 1px, transparent 1.5px),
      radial-gradient(circle at 50% 50%, ${g} 1.5px, transparent 2.5px)
    `,
    backgroundSize: '10px 10px, 20px 20px',
    backgroundPosition: '0 0, 5px 5px',
  }
}

/** Generate pattern CSS string untuk print version (mm-based) */
function getPatternCss(variant: TemplateId, palette: TemplatePalette): string {
  const g = palette.goldSoft
  if (variant === 'cyan-nias') {
    return `
      background-image:
        radial-gradient(circle at 50% 50%, ${g} 0.3mm, transparent 0.4mm),
        radial-gradient(circle at 0% 0%, ${g} 0.2mm, transparent 0.3mm),
        radial-gradient(circle at 100% 100%, ${g} 0.2mm, transparent 0.3mm);
      background-size: 3mm 3mm, 3mm 3mm, 3mm 3mm;
    `
  }
  if (variant === 'royal-purple') {
    return `
      background-image:
        radial-gradient(ellipse at 50% 50%, ${g} 0%, transparent 35%),
        radial-gradient(circle at 50% 50%, ${g} 0.5mm, transparent 0.8mm);
      background-size: 6mm 6mm, 2mm 2mm;
    `
  }
  if (variant === 'sunset-coral') {
    return `
      background-image:
        repeating-linear-gradient(45deg, ${g} 0, ${g} 0.25mm, transparent 0.25mm, transparent 2.5mm),
        repeating-linear-gradient(-45deg, ${g} 0, ${g} 0.25mm, transparent 0.25mm, transparent 2.5mm);
      background-size: 3.5mm 3.5mm, 3.5mm 3.5mm;
    `
  }
  return `
    background-image:
      radial-gradient(circle, ${g} 0.25mm, transparent 0.4mm),
      radial-gradient(circle at 50% 50%, ${g} 0.4mm, transparent 0.6mm);
    background-size: 2.5mm 2.5mm, 5mm 5mm;
    background-position: 0 0, 1.25mm 1.25mm;
  `
}

// ============================================================
//  SVG ORNAMENT COMPONENTS (overlay — tidak menggeser konten)
// ============================================================

/** Corner flourish — ornamen emas di sudut kartu (overlay) */
function CornerFlourish({ size, color, flip = false }: { size: number; color: string; flip?: boolean }) {
  const transform = flip ? 'scale(-1, 1) translate(-50, 0)' : undefined
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      fill="none"
      style={{ display: 'block' }}
    >
      <g transform={transform}>
        <path d="M4,4 L4,22" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M4,4 L22,4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M4,14 Q12,14 14,4" stroke={color} strokeWidth="0.7" fill="none" strokeLinecap="round" />
        <path d="M4,18 Q16,18 18,4" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" opacity="0.7" />
        <circle cx="4" cy="4" r="1.8" fill={color} />
        <circle cx="14" cy="14" r="0.8" fill={color} />
        <path d="M8,8 Q10,6 12,8 Q10,10 8,8 Z" fill={color} opacity="0.8" />
      </g>
    </svg>
  )
}

// ============================================================
//  SHARED CARD DATA
// ============================================================

interface CardData {
  nama: string
  nim: string
  prodiNama: string
  kelompokLabel: string
  lokasiLabel: string
  dosenLabel: string
  namaKampus: string
  foto: string | null
  initials: string
  bannerText: string
}

function buildCardData(m: IdCardMahasiswa, p: IdCardPengaturan): CardData {
  const k = getKelompok(m)
  const namaKampus = p.nama_kampus || 'UNIVERSITAS'
  const tipe = k?.tipe ?? 'KKN'
  // Banner label mengikuti referensi: "KARTU PESERTA KKN" / "KARTU PESERTA PLP"
  const tipeLabel = tipe === 'KKN'
    ? 'KKN'
    : tipe === 'PLP1'
    ? 'PLP 1'
    : tipe === 'PLP2'
    ? 'PLP 2'
    : tipe
  return {
    nama: m.nama,
    nim: m.nim,
    prodiNama: m.prodi?.nama || '-',
    kelompokLabel: getKelompokLabel(m),
    lokasiLabel: getLokasiLabel(m),
    dosenLabel: getDosenLabel(m),
    namaKampus,
    foto: m.foto,
    initials: getInitials(m.nama),
    bannerText: `KARTU PESERTA ${tipeLabel}`,
  }
}

// ============================================================
//  REACT PREVIEWS (pixel-scaled, PERSIS referensi 300×480px)
// ============================================================

const PREVIEW_W = 300
const PREVIEW_H = 480 // persis sama dengan kartu-peserta

interface PreviewProps {
  m: IdCardMahasiswa
  p: IdCardPengaturan
  logos: IdCardLogos
  palette: TemplatePalette
  variant: TemplateId
}

/**
 * CardPreview — tata letak 100% identik dengan referensi kartu-peserta.
 * Megah hanya dari overlay (border emas, corner flourish, gradient, pattern).
 */
function CardPreview({
  m, p, logos, palette, variant,
}: PreviewProps) {
  const data = buildCardData(m, p)
  const W = PREVIEW_W
  const H = PREVIEW_H
  const patternStyle = getPatternStyle(variant, palette)

  return (
    <div
      style={{
        width: W,
        height: H,
        borderRadius: '18px',
        background: '#fff',
        boxShadow: `0 15px 40px -10px ${palette.shadowColor}, 0 0 0 1px rgba(0,0,0,0.05)`,
        fontFamily: 'Arial, Helvetica, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ===== OVERLAY: GOLD DOUBLE BORDER (tidak menggeser konten) ===== */}
      <div style={{
        position: 'absolute',
        inset: 0,
        border: `2px solid ${palette.gold}`,
        borderRadius: '18px',
        pointerEvents: 'none',
        zIndex: 10,
      }} />
      <div style={{
        position: 'absolute',
        inset: 4,
        border: `0.5px solid ${palette.gold}`,
        borderRadius: '14px',
        opacity: 0.6,
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* ===== OVERLAY: CORNER FLOURISHES (tidak menggeser konten) ===== */}
      <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 11 }}>
        <CornerFlourish size={26} color={palette.gold} />
      </div>
      <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 11, transform: 'scaleX(-1)' }}>
        <CornerFlourish size={26} color={palette.gold} />
      </div>
      <div style={{ position: 'absolute', bottom: 6, left: 6, zIndex: 11, transform: 'scaleY(-1)' }}>
        <CornerFlourish size={26} color={palette.gold} />
      </div>
      <div style={{ position: 'absolute', bottom: 6, right: 6, zIndex: 11, transform: 'scale(-1, -1)' }}>
        <CornerFlourish size={26} color={palette.gold} />
      </div>

      {/* ===== TOP SECTION (42%, gradient + rounded bottom corners) =====
          PERSIS referensi: borderBottomLeftRadius 50% 28%, 3 logo sejajar */}
      <div
        style={{
          background: palette.topBgGradient,
          height: '42%',
          borderBottomLeftRadius: '50% 28%',
          borderBottomRightRadius: '50% 28%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '14px',
          ...patternStyle,
        }}
      >
        {/* 3 Logos row — PERSIS referensi: Tut Wuri | Kampus | Merdeka */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
          padding: '0 10px',
        }}>
          {/* Left: Tut Wuri Handayani */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '56px' }}>
            {logos.tutWuri ? (
              <img
                src={logos.tutWuri}
                alt="Tut Wuri Handayani"
                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget.style.display = 'none') }}
              />
            ) : null}
          </div>

          {/* Center: Logo Kampus */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {logos.kampus ? (
              <img
                src={logos.kampus}
                alt="Logo Kampus"
                style={{ width: '54px', height: '54px', objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget.style.display = 'none') }}
              />
            ) : null}
          </div>

          {/* Right: Kampus Merdeka */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '56px' }}>
            {logos.merdeka ? (
              <img
                src={logos.merdeka}
                alt="Kampus Merdeka"
                style={{ width: '48px', height: '56px', objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget.style.display = 'none') }}
              />
            ) : null}
          </div>
        </div>

        {/* Photo — PERSIS referensi: lingkaran, padding putih, ring warna tema,
            overlap batas atas-bawah */}
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
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: `3px solid ${palette.ringColor}`,
              overflow: 'hidden',
              background: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {data.foto ? (
              <img
                src={data.foto}
                alt={data.nama}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                  const parent = t.parentElement
                  if (parent) {
                    parent.innerHTML = `<span style="font-size:28px;font-weight:bold;color:#64748b">${data.initials}</span>`
                  }
                }}
              />
            ) : (
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#64748b' }}>{data.initials}</span>
            )}
          </div>
        </div>
      </div>

      {/* ===== BOTTOM SECTION (58%, gradient warna tema) =====
          PERSIS referensi: banner, nama, NIM, prodi, divider, kelompok,
          lokasi, DPL, universitas di paling bawah */}
      <div
        style={{
          background: palette.bottomBgGradient,
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
          position: 'relative',
        }}
      >
        {/* OVERLAY: shimmer halus (tidak menggeser konten) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Label banner — PERSIS referensi: pill putih */}
        <div style={{
          position: 'relative',
          background: '#fff',
          padding: '3px 14px',
          borderRadius: '10px',
          fontSize: '9px',
          fontWeight: 800,
          color: palette.bottomBgDark,
          letterSpacing: '0.5px',
          marginBottom: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}>
          {data.bannerText}
          {/* Aksen garis emas tipis di bawah banner (overlay, tidak menggeser) */}
          <div style={{
            position: 'absolute',
            bottom: '-3px',
            left: '10%',
            right: '10%',
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${palette.gold}, transparent)`,
          }} />
        </div>

        {/* Nama */}
        <div style={{
          fontSize: '13px',
          fontWeight: 800,
          color: '#000',
          lineHeight: 1.2,
          padding: '0 8px',
          maxWidth: '270px',
          wordBreak: 'break-word',
          position: 'relative',
          zIndex: 2,
        }}>
          {data.nama}
        </div>

        {/* NIM */}
        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#000',
          fontFamily: 'monospace',
          marginTop: '3px',
          position: 'relative',
          zIndex: 2,
        }}>
          {data.nim}
        </div>

        {/* Prodi */}
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#1f2937',
          marginTop: '4px',
          textTransform: 'uppercase',
          position: 'relative',
          zIndex: 2,
        }}>
          {data.prodiNama}
        </div>

        {/* Divider */}
        <div style={{
          width: '60%',
          height: '1px',
          background: 'rgba(0,0,0,0.25)',
          margin: '8px 0',
          position: 'relative',
          zIndex: 2,
        }} />

        {/* Kelompok */}
        <div style={{
          fontSize: '11px',
          fontWeight: 800,
          color: '#000',
          position: 'relative',
          zIndex: 2,
        }}>
          {data.kelompokLabel}
        </div>

        {/* Lokasi */}
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color: '#1f2937',
          marginTop: '2px',
          maxWidth: '260px',
          lineHeight: 1.2,
          position: 'relative',
          zIndex: 2,
        }}>
          Lokasi: {data.lokasiLabel}
        </div>

        {/* Dosen */}
        <div style={{
          fontSize: '9px',
          fontWeight: 600,
          color: '#1f2937',
          marginTop: '6px',
          maxWidth: '260px',
          lineHeight: 1.2,
          position: 'relative',
          zIndex: 2,
        }}>
          DPL: {data.dosenLabel}
        </div>

        {/* Universitas (paling bawah, teks putih) */}
        <div style={{
          fontSize: '8px',
          fontWeight: 800,
          color: '#fff',
          marginTop: 'auto',
          marginBottom: '10px',
          letterSpacing: '0.8px',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 2,
        }}>
          {data.namaKampus}
        </div>
      </div>
    </div>
  )
}

function CyanNiasPreview(props: Omit<PreviewProps, 'palette' | 'variant'>) {
  return <CardPreview {...props} palette={PALETTES['cyan-nias']} variant="cyan-nias" />
}
function RoyalPurplePreview(props: Omit<PreviewProps, 'palette' | 'variant'>) {
  return <CardPreview {...props} palette={PALETTES['royal-purple']} variant="royal-purple" />
}
function SunsetCoralPreview(props: Omit<PreviewProps, 'palette' | 'variant'>) {
  return <CardPreview {...props} palette={PALETTES['sunset-coral']} variant="sunset-coral" />
}
function ForestEmeraldPreview(props: Omit<PreviewProps, 'palette' | 'variant'>) {
  return <CardPreview {...props} palette={PALETTES['forest-emerald']} variant="forest-emerald" />
}

// ============================================================
//  PRINT HTML BUILDERS (mm-based, PERSIS referensi 85mm×128mm)
// ============================================================

/** SVG string untuk corner flourish (print version) */
function cornerFlourishSvg(gold: string, rotate = 0): string {
  const transform = rotate ? ` transform="rotate(${rotate} 25 25)"` : ''
  return `<svg width="6mm" height="6mm" viewBox="0 0 50 50" fill="none" style="display:block;position:absolute;">` +
    `<g${transform}>` +
    `<path d="M4,4 L4,22" stroke="${gold}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M4,4 L22,4" stroke="${gold}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M4,14 Q12,14 14,4" stroke="${gold}" stroke-width="0.7" fill="none" stroke-linecap="round"/>` +
    `<path d="M4,18 Q16,18 18,4" stroke="${gold}" stroke-width="0.5" fill="none" stroke-linecap="round" opacity="0.7"/>` +
    `<circle cx="4" cy="4" r="1.8" fill="${gold}"/>` +
    `<circle cx="14" cy="14" r="0.8" fill="${gold}"/>` +
    `<path d="M8,8 Q10,6 12,8 Q10,10 8,8 Z" fill="${gold}" opacity="0.8"/>` +
    `</g></svg>`
}

function buildCardHtml(
  m: IdCardMahasiswa, p: IdCardPengaturan, logos: IdCardLogos,
  palette: TemplatePalette, variant: TemplateId,
): string {
  const data = buildCardData(m, p)
  const namaKampus = escapeHtml(data.namaKampus)
  const nama = escapeHtml(data.nama)
  const nim = escapeHtml(data.nim)
  const prodiNama = escapeHtml(data.prodiNama)
  const kelompokLabel = escapeHtml(data.kelompokLabel)
  const lokasiLabel = escapeHtml(data.lokasiLabel)
  const dosenLabel = escapeHtml(data.dosenLabel)
  const foto = data.foto ? escapeHtml(data.foto) : ''

  const kampusImg = logos.kampus
    ? `<img src="${logos.kampus}" alt="" style="width:14mm;height:14mm;object-fit:contain;" onerror="this.style.display='none'" />`
    : ''
  const tutWuriImg = logos.tutWuri
    ? `<img src="${logos.tutWuri}" alt="" style="width:13mm;height:13mm;object-fit:contain;" onerror="this.style.display='none'" />`
    : ''
  const merdekaImg = logos.merdeka
    ? `<img src="${logos.merdeka}" alt="" style="width:13mm;height:15mm;object-fit:contain;" onerror="this.style.display='none'" />`
    : ''

  const patternCss = getPatternCss(variant, palette)

  return `
  <div class="card ${variant}" style="
    --top-bg-grad:${palette.topBgGradient};
    --bottom-bg-grad:${palette.bottomBgGradient};
    --ring:${palette.ringColor};
    --gold:${palette.gold};
    --bottom-dark:${palette.bottomBgDark};
  ">
    <!-- Overlay: gold double border -->
    <div class="border-outer"></div>
    <div class="border-inner"></div>

    <!-- Overlay: corner flourishes -->
    <div class="corner corner-tl">${cornerFlourishSvg(palette.gold)}</div>
    <div class="corner corner-tr">${cornerFlourishSvg(palette.gold, 90)}</div>
    <div class="corner corner-bl">${cornerFlourishSvg(palette.gold, 270)}</div>
    <div class="corner corner-br">${cornerFlourishSvg(palette.gold, 180)}</div>

    <!-- TOP SECTION (42%) -->
    <div class="top-section" style="${patternCss}">
      <div class="logos">
        <div class="logo-side">${tutWuriImg}</div>
        <div class="logo-center">${kampusImg}</div>
        <div class="logo-side">${merdekaImg}</div>
      </div>
      <!-- Photo (overlap boundary) -->
      <div class="photo-wrap">
        <div class="photo-inner">
          ${foto
            ? `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:7mm;font-weight:bold;color:#64748b\\'>${data.initials}</span>'" />`
            : `<span style="font-size:7mm;font-weight:bold;color:#64748b">${data.initials}</span>`
          }
        </div>
      </div>
    </div>

    <!-- BOTTOM SECTION (58%) -->
    <div class="bottom-section">
      <div class="shimmer-overlay"></div>
      <div class="banner">
        ${escapeHtml(data.bannerText)}
        <div class="banner-accent"></div>
      </div>
      <div class="name">${nama}</div>
      <div class="nim">${nim}</div>
      <div class="prodi">${prodiNama}</div>
      <div class="divider"></div>
      <div class="kelompok">${kelompokLabel}</div>
      <div class="lokasi">Lokasi: ${lokasiLabel}</div>
      <div class="dosen">DPL: ${dosenLabel}</div>
      <div class="univ">${namaKampus}</div>
    </div>
  </div>
  `
}

// ============================================================
//  TEMPLATE PREVIEW DISPATCHER
// ============================================================
interface TemplatePreviewProps {
  templateId: TemplateId
  m: IdCardMahasiswa
  p: IdCardPengaturan
  logos: IdCardLogos
}

export function TemplatePreview({ templateId, m, p, logos }: TemplatePreviewProps) {
  switch (templateId) {
    case 'cyan-nias':
      return <CyanNiasPreview m={m} p={p} logos={logos} />
    case 'royal-purple':
      return <RoyalPurplePreview m={m} p={p} logos={logos} />
    case 'sunset-coral':
      return <SunsetCoralPreview m={m} p={p} logos={logos} />
    case 'forest-emerald':
      return <ForestEmeraldPreview m={m} p={p} logos={logos} />
    default:
      return <CyanNiasPreview m={m} p={p} logos={logos} />
  }
}

// ============================================================
//  PRINT HTML BUILDER (full document)
// ============================================================
function buildCardsForTemplate(
  templateId: TemplateId,
  list: IdCardMahasiswa[],
  p: IdCardPengaturan,
  logos: IdCardLogos,
): string {
  const palette = PALETTES[templateId]
  return list.map((m) => buildCardHtml(m, p, logos, palette, templateId)).join('\n')
}

/**
 * CSS untuk print document — tata letak PERSIS referensi kartu-peserta
 * (85mm×128mm, 2 kolom per A4), dengan overlay megah (border emas,
 * corner flourish, pattern, shimmer).
 */
function buildPrintCss(): string {
  return `
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
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
      background: #fff;
      box-shadow: 0 1mm 3mm rgba(0,0,0,0.15);
      position: relative;
      page-break-inside: avoid;
      font-family: Arial, Helvetica, sans-serif;
      display: flex;
      flex-direction: column;
    }
    @media print {
      .card { box-shadow: none; }
      .cards-grid { gap: 4mm; }
    }

    /* ============ OVERLAY: GOLD BORDERS ============ */
    .border-outer {
      position: absolute;
      inset: 0;
      border: 0.6mm solid var(--gold);
      border-radius: 4mm;
      pointer-events: none;
      z-index: 10;
    }
    .border-inner {
      position: absolute;
      inset: 1.2mm;
      border: 0.15mm solid var(--gold);
      opacity: 0.6;
      border-radius: 3mm;
      pointer-events: none;
      z-index: 10;
    }

    /* ============ OVERLAY: CORNER FLOURISHES ============ */
    .corner {
      position: absolute;
      width: 6mm;
      height: 6mm;
      z-index: 11;
      pointer-events: none;
    }
    .corner-tl { top: 1.5mm; left: 1.5mm; }
    .corner-tr { top: 1.5mm; right: 1.5mm; transform: scaleX(-1); }
    .corner-bl { bottom: 1.5mm; left: 1.5mm; transform: scaleY(-1); }
    .corner-br { bottom: 1.5mm; right: 1.5mm; transform: scale(-1, -1); }

    /* ============ TOP SECTION (42%) ============ */
    .top-section {
      background: var(--top-bg-grad);
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
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* ============ PHOTO (overlap boundary) ============ */
    .photo-wrap {
      position: absolute;
      bottom: -10mm;
      left: 50%;
      transform: translateX(-50%);
      width: 26mm;
      height: 26mm;
      border-radius: 50%;
      background: #fff;
      padding: 1mm;
      box-shadow: 0 1mm 3mm rgba(0,0,0,0.25);
      z-index: 2;
    }
    .photo-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 0.8mm solid var(--ring);
      overflow: hidden;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ============ BOTTOM SECTION (58%) ============ */
    .bottom-section {
      background: var(--bottom-bg-grad);
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 13mm;
      padding-left: 3mm;
      padding-right: 3mm;
      padding-bottom: 2mm;
      text-align: center;
      color: #000;
      position: relative;
    }
    .shimmer-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
      pointer-events: none;
    }
    .banner {
      position: relative;
      background: #fff;
      padding: 0.8mm 3.5mm;
      border-radius: 2.5mm;
      font-size: 2.6mm;
      font-weight: 800;
      color: var(--bottom-dark);
      letter-spacing: 0.2mm;
      margin-bottom: 2mm;
      box-shadow: 0 0.5mm 1mm rgba(0,0,0,0.2);
      z-index: 2;
    }
    .banner-accent {
      position: absolute;
      bottom: -0.8mm;
      left: 10%;
      right: 10%;
      height: 0.2mm;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
    }
    .name {
      font-size: 3.4mm;
      font-weight: 800;
      color: #000;
      line-height: 1.2;
      padding: 0 2mm;
      max-width: 70mm;
      word-break: break-word;
      position: relative;
      z-index: 2;
    }
    .nim {
      font-size: 3.1mm;
      font-weight: 700;
      color: #000;
      font-family: monospace;
      margin-top: 0.8mm;
      position: relative;
      z-index: 2;
    }
    .prodi {
      font-size: 2.6mm;
      font-weight: 700;
      color: #1f2937;
      margin-top: 1mm;
      text-transform: uppercase;
      position: relative;
      z-index: 2;
    }
    .divider {
      width: 60%;
      height: 0.3mm;
      background: rgba(0,0,0,0.25);
      margin: 2mm 0;
      position: relative;
      z-index: 2;
    }
    .kelompok {
      font-size: 2.9mm;
      font-weight: 800;
      color: #000;
      position: relative;
      z-index: 2;
    }
    .lokasi {
      font-size: 2.6mm;
      font-weight: 600;
      color: #1f2937;
      margin-top: 0.5mm;
      max-width: 68mm;
      line-height: 1.2;
      position: relative;
      z-index: 2;
    }
    .dosen {
      font-size: 2.4mm;
      font-weight: 600;
      color: #1f2937;
      margin-top: 1.5mm;
      max-width: 68mm;
      line-height: 1.2;
      position: relative;
      z-index: 2;
    }
    .univ {
      font-size: 2.2mm;
      font-weight: 800;
      color: #fff;
      margin-top: auto;
      margin-bottom: 2.5mm;
      letter-spacing: 0.2mm;
      text-shadow: 0 0.5mm 1mm rgba(0,0,0,0.3);
      position: relative;
      z-index: 2;
    }
  `
}

/** Susun dokumen HTML lengkap untuk print window */
export function buildPrintDocumentHtml(
  templateId: TemplateId,
  list: IdCardMahasiswa[],
  p: IdCardPengaturan,
  logos: IdCardLogos,
): string {
  const cards = buildCardsForTemplate(templateId, list, p, logos)
  const css = buildPrintCss()
  const title = `Cetak ID Card — ${list.length} mahasiswa`

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
${css}
</style>
</head>
<body>
<div class="cards-grid">
${cards}
</div>
</body>
</html>`
}
