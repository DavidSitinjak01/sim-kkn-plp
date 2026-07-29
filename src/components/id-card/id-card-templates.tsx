'use client'

/**
 * id-card-templates.tsx
 *
 * 4 desain template Kartu Tanda Mahasiswa (KTM / ID Card) — PORTRAIT CR80.
 * Desain MEGAH dengan ornamen emas, border berhias, pola background, watermark,
 * triple-ring photo, ribbon header, ornamental divider, dan gold seal footer.
 *
 * Semua template mengikuti desain referensi pengguna:
 *   - Orientasi portrait (54mm × 85.6mm, rasio ~2:3)
 *   - Layout dua-warna (two-tone split): bagian atas warna terang, bagian bawah warna
 *     jenuh, dengan foto lingkaran besar centered di batas kedua area.
 *
 * Elemen megah yang ditambahkan:
 *   - Border emas ganda di seluruh kartu + border dalam tipis
 *   - Corner flourishes (SVG ornament) di 4 sudut
 *   - Pola background (damask/geometric/dots) di section atas dengan opacity rendah
 *   - Watermark monogram kampus besar di belakang foto (sangat faint)
 *   - Triple-ring photo frame (emas luar + putih tengah + warna dalam)
 *   - Ribbon-style header dengan gold trim
 *   - Ornamental divider dengan center medallion
 *   - Gold accent text untuk NIM (letter-spaced, monospace)
 *   - Serif font untuk nama (Georgia — kesan akademik/formal)
 *   - Gold seal/badge footer
 *
 * 4 template dengan kombinasi warna & variasi desain berbeda:
 *   1. "Cyan Nias"      — Mint + Cyan, gold ornaments, damask pattern
 *   2. "Royal Purple"   — Lavender + Deep Purple, gold filigree, baroque pattern
 *   3. "Sunset Coral"   — Cream + Coral, gold geometric, art deco pattern
 *   4. "Forest Emerald" — Sage + Emerald, gold botanical, islamic geometric pattern
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

export interface IdCardLogos {
  kampus: string
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
    nama: 'Royal Cyan',
    deskripsi: 'Mint + cyan dengan ornamen emas, pola damask, dan border berhias. Megah & elegan.',
    orientasi: 'portrait',
    accent: '#00BCD4',
    icon: IdCardIcon,
  },
  {
    id: 'royal-purple',
    nama: 'Imperial Purple',
    deskripsi: 'Lavender + ungu royal dengan filigree emas, pola barok, watermark seal kerajaan.',
    orientasi: 'portrait',
    accent: '#6A1B9A',
    icon: Gem,
  },
  {
    id: 'sunset-coral',
    nama: 'Golden Sunset',
    deskripsi: 'Cream + coral dengan geometri emas art deco, sunburst ornament, aksen diagonal.',
    orientasi: 'portrait',
    accent: '#E53935',
    icon: Sun,
  },
  {
    id: 'forest-emerald',
    nama: 'Royal Emerald',
    deskripsi: 'Sage + emerald dengan ornamen botanis emas, pola geometris islami, crest watermark.',
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

/** Ambil inisial besar untuk watermark monogram (2 huruf pertama dari kata pertama) */
function getMonogram(namaKampus: string): string {
  const parts = namaKampus.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  // Ambil huruf pertama dari 2 kata pertama yang bukan "Universitas"
  const meaningful = parts.filter(p => !/^(universitas|univ|u)\.?$/i.test(p))
  const src = meaningful.length >= 2 ? meaningful : parts
  return (src[0][0] + src[1][0]).toUpperCase()
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Format tanggal lahir → "dd Mmm yyyy" */
export function formatTanggal(tgl: string | Date): string {
  try {
    const d = typeof tgl === 'string' ? new Date(tgl) : tgl
    if (isNaN(d.getTime())) return '-'
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des']
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`
  } catch {
    return '-'
  }
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
  const tipeLabel = k.tipe === 'KKN'
    ? 'KKN'
    : k.tipe === 'PLP1'
    ? 'PLP 1'
    : k.tipe === 'PLP2'
    ? 'PLP 2'
    : k.tipe
  return `Kelompok ${tipeLabel} - ${k.nama}`
}

function getLokasiLabel(m: IdCardMahasiswa): string {
  const k = getKelompok(m)
  if (!k?.desa) return '-'
  const d = k.desa
  if (k.tipe === 'KKN') return `Desa ${d.nama}`
  return d.nama
}

function getDosenLabel(m: IdCardMahasiswa): string {
  const k = getKelompok(m)
  if (!k?.dosen) return '-'
  const d = k.dosen
  const fak = d.fakultas?.nama || ''
  const prod = d.prodi?.nama || ''
  const fakShort = fak
    ? fak
        .replace(/^Fakultas\s+/i, 'F')
        .replace(/\bKeguruan\b/i, 'K')
        .replace(/\bIlmu\b/i, 'I')
        .replace(/\bPendidikan\b/i, 'P')
        .replace(/\bdan\b/gi, '')
        .replace(/\s+/g, '')
        .toUpperCase()
    : ''
  const fakultasPart = fakShort ? `Dosen ${fakShort}` : 'Dosen Pembimbing'
  return prod ? `${fakultasPart} - ${prod}` : fakultasPart
}

// ============================================================
//  PALETTE — 4 template color schemes (dengan gold accents)
// ============================================================

interface TemplatePalette {
  // Background colors
  topBg: string         // light section background
  topBgGradient: string // gradient overlay for top section (adds depth)
  bottomBg: string      // saturated section background
  bottomBgGradient: string // gradient overlay for bottom (shimmer)
  // Photo ring
  ringColor: string     // inner ring around photo
  // Gold ornaments
  gold: string          // primary gold (#FFD700-ish)
  goldDeep: string      // deeper gold for borders/shadows
  goldSoft: string      // soft gold for patterns (rgba)
  // Text
  textOnLight: string
  textOnSaturated: string
  textLabel: string
  textValue: string
  textGold: string      // gold-tinted text for accents
  // Header panel
  headerBg: string
  headerBorder: string
  // Misc
  shadowColor: string
  watermarkColor: string // very faint monogram color
}

const GOLD = '#D4AF37'       // classic royal gold
const GOLD_DEEP = '#B8860B'  // dark goldenrod
const GOLD_SOFT = 'rgba(212, 175, 55, 0.15)'
const GOLD_BRIGHT = '#FFD700'

const PALETTES: Record<TemplateId, TemplatePalette> = {
  'cyan-nias': {
    topBg: '#D4EDEB',
    topBgGradient: 'linear-gradient(135deg, #E8F5F3 0%, #D4EDEB 50%, #B8E0DC 100%)',
    bottomBg: '#00BCD4',
    bottomBgGradient: 'linear-gradient(160deg, #00BCD4 0%, #0097A7 50%, #006978 100%)',
    ringColor: '#FF9800',
    gold: GOLD,
    goldDeep: GOLD_DEEP,
    goldSoft: GOLD_SOFT,
    textOnLight: '#0a2a30',
    textOnSaturated: '#ffffff',
    textLabel: '#B2EBF2',
    textValue: '#ffffff',
    textGold: GOLD_BRIGHT,
    headerBg: '#ffffff',
    headerBorder: GOLD,
    shadowColor: 'rgba(0, 60, 70, 0.25)',
    watermarkColor: 'rgba(0, 96, 100, 0.10)',
  },
  'royal-purple': {
    topBg: '#EDE7F6',
    topBgGradient: 'linear-gradient(135deg, #F3E5F5 0%, #EDE7F6 50%, #D1C4E9 100%)',
    bottomBg: '#6A1B9A',
    bottomBgGradient: 'linear-gradient(160deg, #7B1FA2 0%, #6A1B9A 50%, #4A148C 100%)',
    ringColor: '#FFD700',
    gold: GOLD,
    goldDeep: GOLD_DEEP,
    goldSoft: 'rgba(212, 175, 55, 0.18)',
    textOnLight: '#1a0a2e',
    textOnSaturated: '#ffffff',
    textLabel: '#E1BEE7',
    textValue: '#ffffff',
    textGold: '#FFE082',
    headerBg: '#ffffff',
    headerBorder: GOLD,
    shadowColor: 'rgba(60, 0, 100, 0.30)',
    watermarkColor: 'rgba(74, 20, 140, 0.12)',
  },
  'sunset-coral': {
    topBg: '#FFF3E0',
    topBgGradient: 'linear-gradient(135deg, #FFF8E1 0%, #FFF3E0 50%, #FFE0B2 100%)',
    bottomBg: '#E53935',
    bottomBgGradient: 'linear-gradient(160deg, #EF5350 0%, #E53935 50%, #C62828 100%)',
    ringColor: '#00897B',
    gold: GOLD,
    goldDeep: GOLD_DEEP,
    goldSoft: 'rgba(212, 175, 55, 0.18)',
    textOnLight: '#2a0a0a',
    textOnSaturated: '#ffffff',
    textLabel: '#FFCDD2',
    textValue: '#ffffff',
    textGold: '#FFE082',
    headerBg: '#ffffff',
    headerBorder: GOLD,
    shadowColor: 'rgba(120, 20, 20, 0.25)',
    watermarkColor: 'rgba(198, 40, 40, 0.10)',
  },
  'forest-emerald': {
    topBg: '#E8F5E9',
    topBgGradient: 'linear-gradient(135deg, #F1F8E9 0%, #E8F5E9 50%, #C8E6C9 100%)',
    bottomBg: '#2E7D32',
    bottomBgGradient: 'linear-gradient(160deg, #388E3C 0%, #2E7D32 50%, #1B5E20 100%)',
    ringColor: '#FFB300',
    gold: GOLD,
    goldDeep: GOLD_DEEP,
    goldSoft: 'rgba(212, 175, 55, 0.18)',
    textOnLight: '#0a2a0a',
    textOnSaturated: '#ffffff',
    textLabel: '#C8E6C9',
    textValue: '#ffffff',
    textGold: '#FFE082',
    headerBg: '#ffffff',
    headerBorder: GOLD,
    shadowColor: 'rgba(20, 60, 20, 0.28)',
    watermarkColor: 'rgba(27, 94, 32, 0.12)',
  },
}

// ============================================================
//  PATTERN GENERATORS — background patterns per variant
// ============================================================

/** Generate CSS background pattern untuk top section (React inline style) */
function getPatternStyle(variant: TemplateId, palette: TemplatePalette): CSSProperties {
  const g = palette.goldSoft
  if (variant === 'cyan-nias') {
    // Damask pattern — repeating floral diamonds
    return {
      backgroundImage: `
        radial-gradient(circle at 50% 50%, ${g} 1px, transparent 1.5px),
        radial-gradient(circle at 0% 0%, ${g} 0.8px, transparent 1.2px),
        radial-gradient(circle at 100% 100%, ${g} 0.8px, transparent 1.2px)
      `,
      backgroundSize: '12px 12px, 12px 12px, 12px 12px',
      backgroundPosition: '0 0, 0 0, 0 0',
    }
  }
  if (variant === 'royal-purple') {
    // Baroque — large radial fleur-de-lis style
    return {
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, ${g} 0%, transparent 35%),
        radial-gradient(circle at 50% 50%, ${palette.goldSoft} 2px, transparent 3px)
      `,
      backgroundSize: '24px 24px, 8px 8px',
    }
  }
  if (variant === 'sunset-coral') {
    // Art deco — diagonal stripes + chevrons
    return {
      backgroundImage: `
        repeating-linear-gradient(45deg, ${g} 0, ${g} 1px, transparent 1px, transparent 10px),
        repeating-linear-gradient(-45deg, ${palette.goldSoft} 0, ${palette.goldSoft} 1px, transparent 1px, transparent 10px)
      `,
      backgroundSize: '14px 14px, 14px 14px',
    }
  }
  // forest-emerald — Islamic geometric dots + stars
  return {
    backgroundImage: `
      radial-gradient(circle, ${g} 1px, transparent 1.5px),
      radial-gradient(circle at 50% 50%, ${palette.goldSoft} 1.5px, transparent 2.5px)
    `,
    backgroundSize: '10px 10px, 20px 20px',
    backgroundPosition: '0 0, 5px 5px',
  }
}

/** Generate pattern CSS string untuk print version */
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
        radial-gradient(circle at 50% 50%, ${palette.goldSoft} 0.5mm, transparent 0.8mm);
      background-size: 6mm 6mm, 2mm 2mm;
    `
  }
  if (variant === 'sunset-coral') {
    return `
      background-image:
        repeating-linear-gradient(45deg, ${g} 0, ${g} 0.25mm, transparent 0.25mm, transparent 2.5mm),
        repeating-linear-gradient(-45deg, ${palette.goldSoft} 0, ${palette.goldSoft} 0.25mm, transparent 0.25mm, transparent 2.5mm);
      background-size: 3.5mm 3.5mm, 3.5mm 3.5mm;
    `
  }
  return `
    background-image:
      radial-gradient(circle, ${g} 0.25mm, transparent 0.4mm),
      radial-gradient(circle at 50% 50%, ${palette.goldSoft} 0.4mm, transparent 0.6mm);
    background-size: 2.5mm 2.5mm, 5mm 5mm;
    background-position: 0 0, 1.25mm 1.25mm;
  `
}

// ============================================================
//  SVG ORNAMENT COMPONENTS
// ============================================================

/** Corner flourish — ornamental SVG untuk sudut kartu */
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
        {/* L-shaped border lines */}
        <path d="M4,4 L4,22" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M4,4 L22,4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        {/* Inner curves (flourish) */}
        <path d="M4,14 Q12,14 14,4" stroke={color} strokeWidth="0.7" fill="none" strokeLinecap="round" />
        <path d="M4,18 Q16,18 18,4" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" opacity="0.7" />
        {/* Decorative dots */}
        <circle cx="4" cy="4" r="1.8" fill={color} />
        <circle cx="14" cy="14" r="0.8" fill={color} />
        {/* Small leaf swirl */}
        <path d="M8,8 Q10,6 12,8 Q10,10 8,8 Z" fill={color} opacity="0.8" />
      </g>
    </svg>
  )
}

/** Ornamental divider dengan center medallion */
function OrnamentalDivider({ width, color, goldColor }: { width: number; color: string; goldColor: string }) {
  return (
    <svg
      width={width}
      height={16}
      viewBox="0 0 200 16"
      fill="none"
      style={{ display: 'block' }}
    >
      {/* Left line */}
      <line x1="0" y1="8" x2="70" y2="8" stroke={goldColor} strokeWidth="0.6" opacity="0.7" />
      {/* Left flourish */}
      <path d="M70,8 Q78,4 82,8" stroke={goldColor} strokeWidth="0.8" fill="none" />
      {/* Center medallion */}
      <circle cx="100" cy="8" r="5" fill="none" stroke={goldColor} strokeWidth="1" />
      <circle cx="100" cy="8" r="2.5" fill="none" stroke={goldColor} strokeWidth="0.6" />
      <circle cx="100" cy="8" r="0.8" fill={goldColor} />
      {/* Diamond accents */}
      <path d="M88,8 L90,6 L92,8 L90,10 Z" fill={goldColor} opacity="0.7" />
      <path d="M108,8 L110,6 L112,8 L110,10 Z" fill={goldColor} opacity="0.7" />
      {/* Right flourish */}
      <path d="M118,8 Q122,4 130,8" stroke={goldColor} strokeWidth="0.8" fill="none" />
      {/* Right line */}
      <line x1="130" y1="8" x2="200" y2="8" stroke={goldColor} strokeWidth="0.6" opacity="0.7" />
    </svg>
  )
}

/** Watermark monogram — large faint letters di belakang foto */
function WatermarkMonogram({ letters, color, size }: { letters: string; color: string; size: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: size,
        fontWeight: 900,
        fontFamily: 'Georgia, "Times New Roman", serif',
        color,
        letterSpacing: '4px',
        userSelect: 'none',
        pointerEvents: 'none',
        zIndex: 0,
        textShadow: '0 0 20px rgba(255,255,255,0.3)',
      }}
    >
      {letters}
    </div>
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
  monogram: string
  foto: string | null
  initials: string
  tipeKkn: boolean
}

function buildCardData(m: IdCardMahasiswa, p: IdCardPengaturan): CardData {
  const k = getKelompok(m)
  const namaKampus = p.nama_kampus || 'UNIVERSITAS'
  return {
    nama: m.nama,
    nim: m.nim,
    prodiNama: m.prodi?.nama || '-',
    kelompokLabel: getKelompokLabel(m),
    lokasiLabel: getLokasiLabel(m),
    dosenLabel: getDosenLabel(m),
    namaKampus,
    monogram: getMonogram(namaKampus),
    foto: m.foto,
    initials: getInitials(m.nama),
    tipeKkn: k?.tipe === 'KKN' || !k,
  }
}

// ============================================================
//  REACT PREVIEWS (pixel-scaled for screen)
// ============================================================

const PREVIEW_W = 300
const PREVIEW_H = 476 // 300 / 0.631 ≈ 476

interface PreviewProps {
  m: IdCardMahasiswa
  p: IdCardPengaturan
  logoUrl: string
  palette: TemplatePalette
  variant: TemplateId
}

/** Triple-ring photo frame: gold outer + white middle + color inner */
function PhotoBlockGrand({
  foto, initials, ringColor, goldColor, size,
}: {
  foto: string | null
  initials: string
  ringColor: string
  goldColor: string
  size: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: goldColor,
        padding: size * 0.04,
        boxShadow: `
          0 0 0 1px ${goldColor},
          0 6px 18px rgba(0,0,0,0.25),
          0 0 25px rgba(255,215,0,0.25)
        `,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* White middle ring */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: '#fff',
          padding: size * 0.04,
        }}
      >
        {/* Color inner ring + photo */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `${Math.max(1.5, size * 0.02)}px solid ${ringColor}`,
            overflow: 'hidden',
            background: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {foto ? (
            <img
              src={foto}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                const t = e.currentTarget
                t.style.display = 'none'
                const parent = t.parentElement
                if (parent) {
                  parent.innerHTML = `<span style="font-size:${size * 0.32}px;font-weight:700;color:#475569;font-family:Georgia,serif">${initials}</span>`
                }
              }}
            />
          ) : (
            <span style={{ fontSize: size * 0.32, fontWeight: 700, color: '#475569', fontFamily: 'Georgia, serif' }}>{initials}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Ribbon-style header panel dengan gold trim */
function HeaderPanelGrand({
  logoUrl, namaKampus, palette, width,
}: {
  logoUrl: string
  namaKampus: string
  palette: TemplatePalette
  width: number
}) {
  const logoSize = width * 0.16
  return (
    <div
      style={{
        position: 'relative',
        background: palette.headerBg,
        borderRadius: width * 0.025,
        padding: `${width * 0.02}px ${width * 0.035}px`,
        boxShadow: `
          0 2px 8px rgba(0,0,0,0.12),
          0 0 0 1px ${palette.gold}40
        `,
        display: 'flex',
        alignItems: 'center',
        gap: width * 0.025,
        maxWidth: '90%',
        // Gold double border effect
        border: `1px solid ${palette.gold}60`,
      }}
    >
      {/* Gold corner accents on header */}
      <div style={{ position: 'absolute', top: -1, left: -1, width: 8, height: 8, borderTop: `1.5px solid ${palette.gold}`, borderLeft: `1.5px solid ${palette.gold}` }} />
      <div style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderTop: `1.5px solid ${palette.gold}`, borderRight: `1.5px solid ${palette.gold}` }} />
      <div style={{ position: 'absolute', bottom: -1, left: -1, width: 8, height: 8, borderBottom: `1.5px solid ${palette.gold}`, borderLeft: `1.5px solid ${palette.gold}` }} />
      <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderBottom: `1.5px solid ${palette.gold}`, borderRight: `1.5px solid ${palette.gold}` }} />

      {/* Logo dalam circular gold frame */}
      {logoUrl ? (
        <div
          style={{
            width: logoSize,
            height: logoSize,
            borderRadius: '50%',
            border: `1.5px solid ${palette.gold}`,
            padding: 1,
            background: '#fff',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 8px ${palette.goldSoft}`,
          }}
        >
          <img
            src={logoUrl}
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget.style.display = 'none') }}
          />
        </div>
      ) : (
        <div
          style={{
            width: logoSize, height: logoSize, borderRadius: '50%',
            border: `1.5px solid ${palette.gold}`, background: palette.goldSoft,
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <div
          style={{
            fontSize: width * 0.038,
            fontWeight: 800,
            color: palette.textOnLight,
            letterSpacing: '0.5px',
            lineHeight: 1.1,
            textTransform: 'uppercase',
            wordBreak: 'break-word',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {namaKampus}
        </div>
        {/* Gold separator under university name */}
        <div style={{
          width: '60%',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${palette.gold}, transparent)`,
          margin: '2px auto',
        }} />
        <div
          style={{
            fontSize: width * 0.024,
            fontWeight: 700,
            color: palette.goldDeep,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
          }}
        >
          ✦ Kartu Tanda Mahasiswa ✦
        </div>
      </div>
    </div>
  )
}

/** Info block dengan ornamental dividers & gold accents */
function InfoBlockGrand({
  data, palette, width,
}: {
  data: CardData
  palette: TemplatePalette
  width: number
}) {
  const labelStyle: CSSProperties = {
    fontSize: width * 0.024,
    fontWeight: 700,
    color: palette.textLabel,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    marginBottom: 2,
  }
  const valueStyle: CSSProperties = {
    fontSize: width * 0.034,
    fontWeight: 600,
    color: palette.textValue,
    lineHeight: 1.2,
    wordBreak: 'break-word',
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: width * 0.008,
        width: '94%',
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Name (serif, grand) */}
      <div style={{
        fontSize: width * 0.046,
        fontWeight: 700,
        color: palette.textValue,
        lineHeight: 1.15,
        wordBreak: 'break-word',
        fontFamily: 'Georgia, "Times New Roman", serif',
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
        maxWidth: '95%',
      }}>
        {data.nama}
      </div>

      {/* NIM dengan gold accent + letter spacing */}
      <div style={{
        fontSize: width * 0.038,
        fontWeight: 700,
        color: palette.textGold,
        fontFamily: 'Georgia, serif',
        letterSpacing: '1.5px',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}>
        {data.nim}
      </div>

      {/* Prodi */}
      <div style={{
        fontSize: width * 0.028,
        fontWeight: 600,
        color: palette.textValue,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        marginTop: 1,
        opacity: 0.95,
      }}>
        {data.prodiNama}
      </div>

      {/* Ornamental divider */}
      <div style={{ margin: `${width * 0.008}px 0` }}>
        <OrnamentalDivider width={width * 0.5} color={palette.textLabel} goldColor={palette.gold} />
      </div>

      {/* Info rows dengan label kiri + value kanan */}
      <div style={{ width: '88%', display: 'flex', flexDirection: 'column', gap: width * 0.006 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: width * 0.02 }}>
          <span style={{ ...labelStyle, marginBottom: 0, minWidth: width * 0.18, textAlign: 'left' }}>Kelompok</span>
          <span style={{ ...valueStyle, fontSize: width * 0.028, textAlign: 'left', flex: 1 }}>{data.kelompokLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: width * 0.02 }}>
          <span style={{ ...labelStyle, marginBottom: 0, minWidth: width * 0.18, textAlign: 'left' }}>Lokasi {data.tipeKkn ? 'KKN' : 'PLP'}</span>
          <span style={{ ...valueStyle, fontSize: width * 0.028, textAlign: 'left', flex: 1 }}>{data.lokasiLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: width * 0.02 }}>
          <span style={{ ...labelStyle, marginBottom: 0, minWidth: width * 0.18, textAlign: 'left' }}>Dosen</span>
          <span style={{ ...valueStyle, fontSize: width * 0.024, textAlign: 'left', flex: 1, opacity: 0.92 }}>{data.dosenLabel}</span>
        </div>
      </div>

      {/* Gold seal footer */}
      <div style={{
        marginTop: width * 0.012,
        display: 'flex',
        alignItems: 'center',
        gap: width * 0.015,
      }}>
        {/* Left gold line */}
        <div style={{
          width: width * 0.08,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${palette.gold})`,
        }} />
        <div style={{
          padding: `${width * 0.008}px ${width * 0.025}px`,
          background: `linear-gradient(135deg, ${palette.gold}, ${palette.goldDeep})`,
          borderRadius: width * 0.015,
          fontSize: width * 0.022,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          fontFamily: 'Georgia, serif',
          boxShadow: `0 2px 6px ${palette.shadowColor}`,
          textShadow: '0 1px 1px rgba(0,0,0,0.3)',
        }}>
          ✦ {data.namaKampus} ✦
        </div>
        {/* Right gold line */}
        <div style={{
          width: width * 0.08,
          height: 1,
          background: `linear-gradient(90deg, ${palette.gold}, transparent)`,
        }} />
      </div>
    </div>
  )
}

// ============================================================
//  MAIN CARD PREVIEW
// ============================================================

function CardPreview({
  m, p, logoUrl, palette, variant,
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
        borderRadius: W * 0.035,
        background: '#fff',
        boxShadow: `
          0 15px 40px -10px ${palette.shadowColor},
          0 0 0 1px rgba(0,0,0,0.05)
        `,
        fontFamily: 'Arial, Helvetica, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ===== GOLD DOUBLE BORDER (outer) ===== */}
      <div style={{
        position: 'absolute',
        inset: 0,
        border: `2px solid ${palette.gold}`,
        borderRadius: W * 0.035,
        pointerEvents: 'none',
        zIndex: 10,
      }} />
      {/* Inner thin gold border */}
      <div style={{
        position: 'absolute',
        inset: 4,
        border: `0.5px solid ${palette.gold}80`,
        borderRadius: W * 0.03,
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* ===== CORNER FLOURISHES ===== */}
      <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 11 }}>
        <CornerFlourish size={28} color={palette.gold} />
      </div>
      <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 11, transform: 'scaleX(-1)' }}>
        <CornerFlourish size={28} color={palette.gold} />
      </div>
      <div style={{ position: 'absolute', bottom: 6, left: 6, zIndex: 11, transform: 'scaleY(-1)' }}>
        <CornerFlourish size={28} color={palette.gold} />
      </div>
      <div style={{ position: 'absolute', bottom: 6, right: 6, zIndex: 11, transform: 'scale(-1, -1)' }}>
        <CornerFlourish size={28} color={palette.gold} />
      </div>

      {/* ===== TOP SECTION (light bg with gradient + pattern) ===== */}
      <div
        style={{
          background: palette.topBgGradient,
          height: H * 0.40,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: H * 0.045,
          ...patternStyle,
        }}
      >
        {/* Watermark monogram di belakang (faint) */}
        <WatermarkMonogram
          letters={data.monogram}
          color={palette.watermarkColor}
          size={W * 0.28}
        />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <HeaderPanelGrand logoUrl={logoUrl} namaKampus={data.namaKampus} palette={palette} width={W} />
        </div>
      </div>

      {/* ===== BOTTOM SECTION (saturated bg with gradient shimmer) ===== */}
      <div
        style={{
          background: palette.bottomBgGradient,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: H * 0.095, // space for overlapping photo
          paddingBottom: H * 0.025,
          position: 'relative',
        }}
      >
        {/* Subtle shimmer overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <InfoBlockGrand data={data} palette={palette} width={W} />
      </div>

      {/* ===== PHOTO — triple ring, overlapping split ===== */}
      <div
        style={{
          position: 'absolute',
          top: H * 0.295,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
        }}
      >
        <PhotoBlockGrand
          foto={data.foto}
          initials={data.initials}
          ringColor={palette.ringColor}
          goldColor={palette.gold}
          size={W * 0.32}
        />
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
//  PRINT HTML BUILDERS (mm-based, for actual print)
// ============================================================

/** SVG string untuk corner flourish (print version) */
function cornerFlourishSvg(gold: string, rotate = 0): string {
  const transform = rotate ? ` transform="rotate(${rotate} 25 25)"` : ''
  return `<svg width="7mm" height="7mm" viewBox="0 0 50 50" fill="none" style="display:block;position:absolute;">` +
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

/** SVG string untuk ornamental divider (print version) */
function ornamentalDividerSvg(gold: string, widthMm: number): string {
  return `<svg width="${widthMm}mm" height="4mm" viewBox="0 0 200 16" fill="none" style="display:block;margin:0 auto;">` +
    `<line x1="0" y1="8" x2="70" y2="8" stroke="${gold}" stroke-width="0.6" opacity="0.7"/>` +
    `<path d="M70,8 Q78,4 82,8" stroke="${gold}" stroke-width="0.8" fill="none"/>` +
    `<circle cx="100" cy="8" r="5" fill="none" stroke="${gold}" stroke-width="1"/>` +
    `<circle cx="100" cy="8" r="2.5" fill="none" stroke="${gold}" stroke-width="0.6"/>` +
    `<circle cx="100" cy="8" r="0.8" fill="${gold}"/>` +
    `<path d="M88,8 L90,6 L92,8 L90,10 Z" fill="${gold}" opacity="0.7"/>` +
    `<path d="M108,8 L110,6 L112,8 L110,10 Z" fill="${gold}" opacity="0.7"/>` +
    `<path d="M118,8 Q122,4 130,8" stroke="${gold}" stroke-width="0.8" fill="none"/>` +
    `<line x1="130" y1="8" x2="200" y2="8" stroke="${gold}" stroke-width="0.6" opacity="0.7"/>` +
    `</svg>`
}

function buildCardHtml(
  m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string,
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
  const monogram = escapeHtml(data.monogram)
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'" />`
    : ''

  const patternCss = getPatternCss(variant, palette)

  return `
  <div class="card card-portrait ${variant}" style="
    --top-bg:${palette.topBg};
    --top-bg-grad:${palette.topBgGradient};
    --bottom-bg:${palette.bottomBg};
    --bottom-bg-grad:${palette.bottomBgGradient};
    --ring:${palette.ringColor};
    --gold:${palette.gold};
    --gold-deep:${palette.goldDeep};
    --gold-soft:${palette.goldSoft};
    --text-light:${palette.textOnLight};
    --text-sat:${palette.textOnSaturated};
    --text-label:${palette.textLabel};
    --text-value:${palette.textValue};
    --text-gold:${palette.textGold};
    --header-bg:${palette.headerBg};
    --watermark:${palette.watermarkColor};
  ">
    <!-- Outer gold border -->
    <div class="border-outer"></div>
    <!-- Inner thin gold border -->
    <div class="border-inner"></div>

    <!-- Corner flourishes -->
    <div class="corner corner-tl">${cornerFlourishSvg(palette.gold)}</div>
    <div class="corner corner-tr">${cornerFlourishSvg(palette.gold, 90)}</div>
    <div class="corner corner-bl">${cornerFlourishSvg(palette.gold, 270)}</div>
    <div class="corner corner-br">${cornerFlourishSvg(palette.gold, 180)}</div>

    <!-- TOP SECTION -->
    <div class="top-section" style="${patternCss}">
      <div class="watermark">${monogram}</div>
      <div class="header-panel">
        <div class="header-corner header-corner-tl"></div>
        <div class="header-corner header-corner-tr"></div>
        <div class="header-corner header-corner-bl"></div>
        <div class="header-corner header-corner-br"></div>
        <div class="logo-circle">${logoImg}</div>
        <div class="header-text">
          <div class="header-kampus">${namaKampus}</div>
          <div class="header-divider"></div>
          <div class="header-sub">✦ Kartu Tanda Mahasiswa ✦</div>
        </div>
      </div>
    </div>

    <!-- BOTTOM SECTION -->
    <div class="bottom-section">
      <div class="shimmer-overlay"></div>
      <div class="info-block">
        <div class="info-name">${nama}</div>
        <div class="info-nim">${nim}</div>
        <div class="info-prodi">${prodiNama}</div>
        <div class="info-divider-wrap">${ornamentalDividerSvg(palette.gold, 25)}</div>
        <div class="info-rows">
          <div class="info-row">
            <span class="info-label">Kelompok</span>
            <span class="info-value">${kelompokLabel}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Lokasi ${data.tipeKkn ? 'KKN' : 'PLP'}</span>
            <span class="info-value">${lokasiLabel}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Dosen</span>
            <span class="info-value info-value-sm">${dosenLabel}</span>
          </div>
        </div>
        <div class="footer-seal">
          <div class="footer-line-l"></div>
          <div class="footer-badge">✦ ${namaKampus} ✦</div>
          <div class="footer-line-r"></div>
        </div>
      </div>
    </div>

    <!-- PHOTO (triple ring, overlapping) -->
    <div class="photo-anchor">
      <div class="photo-outer">
        <div class="photo-middle">
          <div class="photo-inner">
            ${foto
              ? `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:6mm;font-weight:700;color:#475569;font-family:Georgia,serif\\'>${data.initials}</span>'" />`
              : `<span style="font-size:6mm;font-weight:700;color:#475569;font-family:Georgia,serif">${data.initials}</span>`
            }
          </div>
        </div>
      </div>
    </div>
  </div>
  `
}

function buildCyanNiasCardHtml(m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string): string {
  return buildCardHtml(m, p, logoBase64, PALETTES['cyan-nias'], 'cyan-nias')
}
function buildRoyalPurpleCardHtml(m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string): string {
  return buildCardHtml(m, p, logoBase64, PALETTES['royal-purple'], 'royal-purple')
}
function buildSunsetCoralCardHtml(m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string): string {
  return buildCardHtml(m, p, logoBase64, PALETTES['sunset-coral'], 'sunset-coral')
}
function buildForestEmeraldCardHtml(m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string): string {
  return buildCardHtml(m, p, logoBase64, PALETTES['forest-emerald'], 'forest-emerald')
}

// ============================================================
//  TEMPLATE PREVIEW DISPATCHER
// ============================================================
interface TemplatePreviewProps {
  templateId: TemplateId
  m: IdCardMahasiswa
  p: IdCardPengaturan
  logoUrl: string
}

export function TemplatePreview({ templateId, m, p, logoUrl }: TemplatePreviewProps) {
  switch (templateId) {
    case 'cyan-nias':
      return <CyanNiasPreview m={m} p={p} logoUrl={logoUrl} />
    case 'royal-purple':
      return <RoyalPurplePreview m={m} p={p} logoUrl={logoUrl} />
    case 'sunset-coral':
      return <SunsetCoralPreview m={m} p={p} logoUrl={logoUrl} />
    case 'forest-emerald':
      return <ForestEmeraldPreview m={m} p={p} logoUrl={logoUrl} />
    default:
      return <CyanNiasPreview m={m} p={p} logoUrl={logoUrl} />
  }
}

// ============================================================
//  PRINT HTML BUILDER (full document)
// ============================================================
function buildCardsForTemplate(
  templateId: TemplateId,
  list: IdCardMahasiswa[],
  p: IdCardPengaturan,
  logoBase64: string,
): string {
  const fn = templateId === 'royal-purple'
    ? buildRoyalPurpleCardHtml
    : templateId === 'sunset-coral'
    ? buildSunsetCoralCardHtml
    : templateId === 'forest-emerald'
    ? buildForestEmeraldCardHtml
    : buildCyanNiasCardHtml
  return list.map((m) => fn(m, p, logoBase64)).join('\n')
}

/** CSS untuk print document — versi MEGAH dengan ornaments */
function buildPrintCss(_templateId: TemplateId): string {
  return `
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
      justify-items: center;
    }
    .card {
      width: 54mm;
      height: 85.6mm;
      border-radius: 3mm;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 0.5mm 1.5mm rgba(0,0,0,0.15);
      position: relative;
      page-break-inside: avoid;
      font-family: Arial, Helvetica, sans-serif;
      display: flex;
      flex-direction: column;
    }
    @media print {
      .card { box-shadow: none; }
    }

    /* ============ GOLD BORDERS ============ */
    .border-outer {
      position: absolute;
      inset: 0;
      border: 0.5mm solid var(--gold);
      border-radius: 3mm;
      pointer-events: none;
      z-index: 10;
    }
    .border-inner {
      position: absolute;
      inset: 1mm;
      border: 0.15mm solid var(--gold);
      opacity: 0.6;
      border-radius: 2.5mm;
      pointer-events: none;
      z-index: 10;
    }

    /* ============ CORNER FLOURISHES ============ */
    .corner {
      position: absolute;
      width: 7mm;
      height: 7mm;
      z-index: 11;
      pointer-events: none;
    }
    .corner-tl { top: 1.2mm; left: 1.2mm; }
    .corner-tr { top: 1.2mm; right: 1.2mm; transform: scaleX(-1); }
    .corner-bl { bottom: 1.2mm; left: 1.2mm; transform: scaleY(-1); }
    .corner-br { bottom: 1.2mm; right: 1.2mm; transform: scale(-1, -1); }

    /* ============ TOP SECTION ============ */
    .top-section {
      background: var(--top-bg-grad);
      height: 34mm;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 3.5mm;
    }

    /* Watermark monogram */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 14mm;
      font-weight: 900;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--watermark);
      letter-spacing: 1mm;
      pointer-events: none;
      z-index: 0;
      text-shadow: 0 0 5mm rgba(255,255,255,0.3);
    }

    /* ============ HEADER PANEL (ribbon style) ============ */
    .header-panel {
      position: relative;
      background: var(--header-bg);
      border-radius: 1.2mm;
      padding: 1.2mm 2mm;
      box-shadow: 0 0.6mm 1.5mm rgba(0,0,0,0.12), 0 0 0 0.15mm var(--gold);
      display: flex;
      align-items: center;
      gap: 1.2mm;
      max-width: 90%;
      border: 0.15mm solid var(--gold);
      z-index: 2;
    }
    .header-corner {
      position: absolute;
      width: 2mm;
      height: 2mm;
    }
    .header-corner-tl { top: -0.15mm; left: -0.15mm; border-top: 0.3mm solid var(--gold); border-left: 0.3mm solid var(--gold); }
    .header-corner-tr { top: -0.15mm; right: -0.15mm; border-top: 0.3mm solid var(--gold); border-right: 0.3mm solid var(--gold); }
    .header-corner-bl { bottom: -0.15mm; left: -0.15mm; border-bottom: 0.3mm solid var(--gold); border-left: 0.3mm solid var(--gold); }
    .header-corner-br { bottom: -0.15mm; right: -0.15mm; border-bottom: 0.3mm solid var(--gold); border-right: 0.3mm solid var(--gold); }

    .logo-circle {
      width: 8mm;
      height: 8mm;
      border-radius: 50%;
      border: 0.3mm solid var(--gold);
      padding: 0.3mm;
      background: #fff;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 2mm var(--gold-soft);
    }
    .header-text { flex: 1; min-width: 0; text-align: center; }
    .header-kampus {
      font-size: 2mm;
      font-weight: 800;
      color: var(--text-light);
      letter-spacing: 0.15mm;
      line-height: 1.1;
      text-transform: uppercase;
      word-break: break-word;
      font-family: Georgia, "Times New Roman", serif;
    }
    .header-divider {
      width: 60%;
      height: 0.2mm;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
      margin: 0.4mm auto;
    }
    .header-sub {
      font-size: 1.3mm;
      font-weight: 700;
      color: var(--gold-deep);
      letter-spacing: 0.4mm;
      text-transform: uppercase;
    }

    /* ============ BOTTOM SECTION ============ */
    .bottom-section {
      background: var(--bottom-bg-grad);
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 8.5mm;
      padding-bottom: 2mm;
      position: relative;
    }
    .shimmer-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
      pointer-events: none;
    }

    /* ============ PHOTO (triple ring) ============ */
    .photo-anchor {
      position: absolute;
      top: 24mm;
      left: 50%;
      transform: translateX(-50%);
      z-index: 5;
    }
    .photo-outer {
      width: 17mm;
      height: 17mm;
      border-radius: 50%;
      background: var(--gold);
      padding: 0.6mm;
      box-shadow:
        0 0 0 0.25mm var(--gold),
        0 1mm 3mm rgba(0,0,0,0.25),
        0 0 5mm rgba(255,215,0,0.25);
    }
    .photo-middle {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #fff;
      padding: 0.6mm;
    }
    .photo-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 0.3mm solid var(--ring);
      overflow: hidden;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ============ INFO BLOCK ============ */
    .info-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.3mm;
      width: 94%;
      position: relative;
      z-index: 2;
    }
    .info-name {
      font-size: 2.7mm;
      font-weight: 700;
      color: var(--text-value);
      line-height: 1.15;
      word-break: break-word;
      font-family: Georgia, "Times New Roman", serif;
      text-shadow: 0 0.3mm 0.5mm rgba(0,0,0,0.2);
      max-width: 95%;
    }
    .info-nim {
      font-size: 2.2mm;
      font-weight: 700;
      color: var(--text-gold);
      font-family: Georgia, serif;
      letter-spacing: 0.5mm;
      text-shadow: 0 0.3mm 0.5mm rgba(0,0,0,0.3);
    }
    .info-prodi {
      font-size: 1.7mm;
      font-weight: 600;
      color: var(--text-value);
      text-transform: uppercase;
      letter-spacing: 0.25mm;
      margin-top: 0.2mm;
      opacity: 0.95;
    }
    .info-divider-wrap {
      margin: 0.6mm 0;
      display: flex;
      justify-content: center;
    }
    .info-rows {
      width: 88%;
      display: flex;
      flex-direction: column;
      gap: 0.4mm;
    }
    .info-row {
      display: flex;
      align-items: center;
      gap: 0.8mm;
    }
    .info-label {
      font-size: 1.4mm;
      font-weight: 700;
      color: var(--text-label);
      letter-spacing: 0.2mm;
      text-transform: uppercase;
      min-width: 9mm;
      text-align: left;
    }
    .info-value {
      font-size: 1.7mm;
      font-weight: 600;
      color: var(--text-value);
      line-height: 1.2;
      word-break: break-word;
      text-align: left;
      flex: 1;
    }
    .info-value-sm { font-size: 1.5mm; opacity: 0.92; }

    /* ============ FOOTER GOLD SEAL ============ */
    .footer-seal {
      margin-top: 0.8mm;
      display: flex;
      align-items: center;
      gap: 0.8mm;
    }
    .footer-line-l {
      width: 4mm;
      height: 0.2mm;
      background: linear-gradient(90deg, transparent, var(--gold));
    }
    .footer-line-r {
      width: 4mm;
      height: 0.2mm;
      background: linear-gradient(90deg, var(--gold), transparent);
    }
    .footer-badge {
      padding: 0.4mm 1.3mm;
      background: linear-gradient(135deg, var(--gold), var(--gold-deep));
      border-radius: 0.8mm;
      font-size: 1.3mm;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.25mm;
      text-transform: uppercase;
      font-family: Georgia, serif;
      box-shadow: 0 0.5mm 1.5mm rgba(0,0,0,0.2);
      text-shadow: 0 0.3mm 0.3mm rgba(0,0,0,0.3);
    }
  `
}

/** Susun dokumen HTML lengkap untuk print window */
export function buildPrintDocumentHtml(
  templateId: TemplateId,
  list: IdCardMahasiswa[],
  p: IdCardPengaturan,
  logoBase64: string,
): string {
  const cards = buildCardsForTemplate(templateId, list, p, logoBase64)
  const css = buildPrintCss(templateId)
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
