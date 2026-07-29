'use client'

/**
 * id-card-templates.tsx
 *
 * 4 desain template Kartu Tanda Mahasiswa (KTM / ID Card) — PORTRAIT CR80.
 *
 * Semua template mengikuti desain referensi pengguna:
 *   - Orientasi portrait (54mm × 85.6mm, rasio ~2:3)
 *   - Layout dua-warna (two-tone split): bagian atas warna terang, bagian bawah warna
 *     jenuh, dengan foto lingkaran besar centered di batas kedua area.
 *   - Logo kampus + nama kampus di panel header atas.
 *   - Info mahasiswa center-aligned di bagian bawah:
 *       Nama → NIM → Program Studi → Kelompok KKN → Lokasi → Dosen Pembimbing
 *
 * 4 template dengan kombinasi warna & variasi desain berbeda:
 *   1. "Cyan Nias"     — Mint (#D4EDEB) + Cyan (#00BCD4), ring foto oranye, split lurus
 *   2. "Royal Purple"  — Lavender (#EDE7F6) + Deep Purple (#6A1B9A), ring foto emas, split melengkung
 *   3. "Sunset Coral"  — Cream (#FFF3E0) + Coral (#E53935), ring foto teal, split diagonal
 *   4. "Forest Emerald"— Sage (#E8F5E9) + Emerald (#2E7D32), ring foto amber, pola titik dekoratif
 *
 * Setiap template memiliki:
 *   - <Name>Preview  → komponen React untuk live preview di layar (pixel-scaled)
 *   - build<Name>CardHtml() → string HTML untuk satu kartu (digabung di print window, ukuran mm)
 *
 * Export utama:
 *   - ID_CARD_TEMPLATES        → array metadata template (id, nama, deskripsi, accent)
 *   - TemplatePreview          → komponen yang merender preview sesuai templateId
 *   - buildPrintDocumentHtml() → menyusun dokumen HTML lengkap (semua kartu) untuk print window
 */

import {
  IdCard as IdCardIcon, Sun, Leaf, Gem,
} from 'lucide-react'

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
    nama: 'Cyan Nias',
    deskripsi: 'Mint terang di atas + cyan jenuh di bawah, ring foto oranye. Inspirasi desain asli.',
    orientasi: 'portrait',
    accent: '#00BCD4',
    icon: IdCardIcon,
  },
  {
    id: 'royal-purple',
    nama: 'Royal Purple',
    deskripsi: 'Lavender di atas + ungu royal di bawah, ring foto emas, separator melengkung elegan.',
    orientasi: 'portrait',
    accent: '#6A1B9A',
    icon: Gem,
  },
  {
    id: 'sunset-coral',
    nama: 'Sunset Coral',
    deskripsi: 'Cream hangat di atas + coral merah di bawah, ring foto teal, aksen diagonal dinamis.',
    orientasi: 'portrait',
    accent: '#E53935',
    icon: Sun,
  },
  {
    id: 'forest-emerald',
    nama: 'Forest Emerald',
    deskripsi: 'Sage lembut di atas + emerald gelap di bawah, ring foto amber, pola titik dekoratif.',
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

/** Ambil kelompok terbaru dari mahasiswa (latest KelompokMember) */
function getKelompok(m: IdCardMahasiswa): KelompokLengkap | null {
  if (!m.kelompokMember || m.kelompokMember.length === 0) return null
  // API sudah orderBy createdAt desc + take 1, jadi ambil pertama
  return m.kelompokMember[0]?.kelompok ?? null
}

/** Label kelompok, mis. "Kelompok KKN - 10" atau "Kelompok PLP 1 - 5" */
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

/** Nama desa/lokasi KKN */
function getLokasiLabel(m: IdCardMahasiswa): string {
  const k = getKelompok(m)
  if (!k?.desa) return '-'
  const d = k.desa
  // "Desa Lahusa Balaekha" atau "SMA Negeri 1 ..." untuk PLP
  if (k.tipe === 'KKN') return `Desa ${d.nama}`
  return d.nama
}

/** "Dosen FKIP - Bahasa dan Sastra" format */
function getDosenLabel(m: IdCardMahasiswa): string {
  const k = getKelompok(m)
  if (!k?.dosen) return '-'
  const d = k.dosen
  const fak = d.fakultas?.nama || ''
  const prod = d.prodi?.nama || ''
  // Singkatan fakultas: "Fakultas Keguruan dan Ilmu Pendidikan" → "FKIP"
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
//  PALETTE — 4 template color schemes
// ============================================================

interface TemplatePalette {
  // Background colors
  topBg: string         // light section background
  bottomBg: string      // saturated section background
  // Photo ring
  ringColor: string     // outer ring around photo
  // Text
  textOnLight: string   // text color on light section
  textOnSaturated: string // text color on saturated section
  textLabel: string     // label text color on saturated section
  textValue: string     // value text color on saturated section
  // Header panel
  headerBg: string      // white-ish panel bg behind logo
  headerBorder: string
  // Misc
  shadowColor: string
  accentSoft: string    // soft accent for decorative elements
}

const PALETTES: Record<TemplateId, TemplatePalette> = {
  'cyan-nias': {
    topBg: '#D4EDEB',
    bottomBg: '#00BCD4',
    ringColor: '#FF9800',
    textOnLight: '#1a1a1a',
    textOnSaturated: '#0a2a30',
    textLabel: '#004d5a',
    textValue: '#0a1a1d',
    headerBg: '#ffffff',
    headerBorder: '#b8e0dc',
    shadowColor: 'rgba(0, 60, 70, 0.15)',
    accentSoft: 'rgba(255, 152, 0, 0.18)',
  },
  'royal-purple': {
    topBg: '#EDE7F6',
    bottomBg: '#6A1B9A',
    ringColor: '#FFD700',
    textOnLight: '#1a0a2e',
    textOnSaturated: '#ffffff',
    textLabel: '#e1bee7',
    textValue: '#ffffff',
    headerBg: '#ffffff',
    headerBorder: '#d1c4e9',
    shadowColor: 'rgba(60, 0, 100, 0.25)',
    accentSoft: 'rgba(255, 215, 0, 0.20)',
  },
  'sunset-coral': {
    topBg: '#FFF3E0',
    bottomBg: '#E53935',
    ringColor: '#00897B',
    textOnLight: '#2a0a0a',
    textOnSaturated: '#ffffff',
    textLabel: '#ffdfe0',
    textValue: '#ffffff',
    headerBg: '#ffffff',
    headerBorder: '#ffe0b2',
    shadowColor: 'rgba(120, 20, 20, 0.20)',
    accentSoft: 'rgba(0, 137, 123, 0.18)',
  },
  'forest-emerald': {
    topBg: '#E8F5E9',
    bottomBg: '#2E7D32',
    ringColor: '#FFB300',
    textOnLight: '#0a2a0a',
    textOnSaturated: '#ffffff',
    textLabel: '#c8e6c9',
    textValue: '#ffffff',
    headerBg: '#ffffff',
    headerBorder: '#c8e6c9',
    shadowColor: 'rgba(20, 60, 20, 0.22)',
    accentSoft: 'rgba(255, 179, 0, 0.20)',
  },
}

// ============================================================
//  SHARED CARD STRUCTURE
// ============================================================
//
//  ┌─────────────────────────┐
//  │  [TOP BG - light]        │
//  │   ┌───────────────┐      │
//  │   │  Logo Kampus  │      │  ← header panel (rounded)
//  │   │  Nama Kampus  │      │
//  │   └───────────────┘      │
//  │      ╭───────╮           │  ← circular photo (overlapping split)
//  │      │ foto  │           │
//  │      ╰───────╯           │
//  │  [BOTTOM BG - saturated] │
//  │       NAMA LENGKAP       │  ← bold large
//  │         NIM              │
//  │      PROGRAM STUDI       │
//  │                          │
//  │   Kelompok KKN - 10      │
//  │   Desa Lahusa ...        │
//  │                          │
//  │   Dosen FKIP - ...       │
//  │   UNIVERSITAS NIAS RAYA  │  ← institution footer
//  └─────────────────────────┘
//
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
  tipeKkn: boolean // apakah ini kartu KKN (vs PLP)
}

function buildCardData(m: IdCardMahasiswa, p: IdCardPengaturan): CardData {
  const k = getKelompok(m)
  return {
    nama: m.nama,
    nim: m.nim,
    prodiNama: m.prodi?.nama || '-',
    kelompokLabel: getKelompokLabel(m),
    lokasiLabel: getLokasiLabel(m),
    dosenLabel: getDosenLabel(m),
    namaKampus: p.nama_kampus || 'UNIVERSITAS',
    foto: m.foto,
    initials: getInitials(m.nama),
    tipeKkn: k?.tipe === 'KKN' || !k, // default tampilkan KKN jika tidak ada kelompok
  }
}

// ============================================================
//  REACT PREVIEWS (pixel-scaled for screen)
// ============================================================
//
//  Preview menggunakan ukuran pixel (bukan mm) agar tampil proporsional di layar.
//  Rasio dipertahankan sama dengan print (54mm : 85.6mm ≈ 0.631 : 1).
//  Preview size: 280px × 444px (rasio yang sama).

const PREVIEW_W = 280
const PREVIEW_H = 444 // 280 / 0.631 ≈ 444

interface PreviewProps {
  m: IdCardMahasiswa
  p: IdCardPengaturan
  logoUrl: string
  palette: TemplatePalette
  variant: TemplateId
}

function PhotoBlock({
  foto, initials, ringColor, size, onErrorInitials,
}: {
  foto: string | null
  initials: string
  ringColor: string
  size: number
  onErrorInitials?: boolean
}) {
  const dim = size
  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        background: '#fff',
        padding: dim * 0.06,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: `${Math.max(2, dim * 0.025)}px solid ${ringColor}`,
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
              if (onErrorInitials === false) return
              const t = e.currentTarget
              t.style.display = 'none'
              const parent = t.parentElement
              if (parent) {
                parent.innerHTML = `<span style="font-size:${dim * 0.36}px;font-weight:700;color:#475569">${initials}</span>`
              }
            }}
          />
        ) : (
          <span style={{ fontSize: dim * 0.36, fontWeight: 700, color: '#475569' }}>{initials}</span>
        )}
      </div>
    </div>
  )
}

/** Header panel berisi logo + nama kampus */
function HeaderPanel({
  logoUrl, namaKampus, palette, width,
}: {
  logoUrl: string
  namaKampus: string
  palette: TemplatePalette
  width: number
}) {
  const logoSize = width * 0.18
  return (
    <div
      style={{
        background: palette.headerBg,
        borderRadius: width * 0.04,
        padding: `${width * 0.025}px ${width * 0.04}px`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        display: 'flex',
        alignItems: 'center',
        gap: width * 0.03,
        maxWidth: '88%',
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo"
          style={{
            width: logoSize,
            height: logoSize,
            objectFit: 'contain',
            flexShrink: 0,
          }}
          onError={(e) => { (e.currentTarget.style.display = 'none') }}
        />
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: width * 0.038,
            fontWeight: 800,
            color: palette.textOnLight,
            letterSpacing: '0.3px',
            lineHeight: 1.1,
            textTransform: 'uppercase',
            wordBreak: 'break-word',
          }}
        >
          {namaKampus}
        </div>
        <div
          style={{
            fontSize: width * 0.028,
            fontWeight: 600,
            color: palette.textOnLight,
            opacity: 0.7,
            marginTop: 2,
            letterSpacing: '0.5px',
          }}
        >
          KARTU TANDA MAHASISWA
        </div>
      </div>
    </div>
  )
}

/** Info block di bagian bawah (saturated bg) */
function InfoBlock({
  data, palette, width,
}: {
  data: CardData
  palette: TemplatePalette
  width: number
}) {
  const labelStyle: React.CSSProperties = {
    fontSize: width * 0.028,
    fontWeight: 600,
    color: palette.textLabel,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    marginBottom: 2,
  }
  const valueStyle: React.CSSProperties = {
    fontSize: width * 0.038,
    fontWeight: 700,
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
        gap: width * 0.015,
        width: '92%',
      }}
    >
      {/* Name (largest) */}
      <div style={{ ...valueStyle, fontSize: width * 0.05, fontWeight: 800, lineHeight: 1.15 }}>
        {data.nama}
      </div>
      {/* NIM */}
      <div style={{
        fontSize: width * 0.042,
        fontWeight: 700,
        color: palette.textValue,
        fontFamily: 'monospace',
        letterSpacing: '0.5px',
      }}>
        {data.nim}
      </div>
      {/* Prodi */}
      <div style={{
        fontSize: width * 0.034,
        fontWeight: 700,
        color: palette.textValue,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        marginTop: 2,
      }}>
        {data.prodiNama}
      </div>

      {/* Divider */}
      <div style={{
        width: '40%',
        height: 1,
        background: palette.textLabel,
        opacity: 0.4,
        margin: `${width * 0.015}px 0`,
      }} />

      {/* Kelompok */}
      <div style={{ width: '100%' }}>
        <div style={labelStyle}>Kelompok</div>
        <div style={valueStyle}>{data.kelompokLabel}</div>
      </div>

      {/* Lokasi */}
      <div style={{ width: '100%', marginTop: width * 0.005 }}>
        <div style={labelStyle}>Lokasi {data.tipeKkn ? 'KKN' : 'PLP'}</div>
        <div style={valueStyle}>{data.lokasiLabel}</div>
      </div>

      {/* Dosen Pembimbing */}
      <div style={{ width: '100%', marginTop: width * 0.005 }}>
        <div style={labelStyle}>Dosen Pembimbing</div>
        <div style={{ ...valueStyle, fontSize: width * 0.034 }}>{data.dosenLabel}</div>
      </div>

      {/* Institution footer */}
      <div style={{
        marginTop: width * 0.02,
        padding: `${width * 0.012}px ${width * 0.03}px`,
        background: 'rgba(255,255,255,0.12)',
        borderRadius: width * 0.02,
        fontSize: width * 0.03,
        fontWeight: 700,
        color: palette.textValue,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}>
        {data.namaKampus}
      </div>
    </div>
  )
}

function CardPreview({
  m, p, logoUrl, palette, variant,
}: PreviewProps) {
  const data = buildCardData(m, p)
  const W = PREVIEW_W
  const H = PREVIEW_H

  // Decorative element berbeda per variant
  const renderDecoration = () => {
    if (variant === 'cyan-nias') {
      // Straight split, no extra decoration
      return null
    }
    if (variant === 'royal-purple') {
      // Curved wave separator
      return (
        <svg
          style={{ position: 'absolute', top: H * 0.36, left: 0, width: '100%', height: H * 0.06, pointerEvents: 'none' }}
          viewBox="0 0 280 28"
          preserveAspectRatio="none"
        >
          <path d="M0,14 Q70,0 140,14 T280,14 L280,28 L0,28 Z" fill={palette.bottomBg} />
        </svg>
      )
    }
    if (variant === 'sunset-coral') {
      // Diagonal stripe accent
      return (
        <div
          style={{
            position: 'absolute',
            top: H * 0.34,
            left: 0,
            width: '100%',
            height: H * 0.04,
            background: palette.ringColor,
            opacity: 0.85,
            transform: 'skewY(-2deg)',
            transformOrigin: 'left center',
            pointerEvents: 'none',
          }}
        />
      )
    }
    if (variant === 'forest-emerald') {
      // Dot pattern decoration in top-right corner
      const dots: React.ReactNode[] = []
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          dots.push(
            <div
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                top: 10 + r * 8,
                right: 10 + c * 8,
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: palette.ringColor,
                opacity: 0.45,
              }}
            />
          )
        }
      }
      return <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, pointerEvents: 'none' }}>{dots}</div>
    }
    return null
  }

  return (
    <div
      style={{
        width: W,
        height: H,
        borderRadius: W * 0.04,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: `0 12px 30px -8px ${palette.shadowColor}, 0 0 0 1px rgba(0,0,0,0.05)`,
        fontFamily: 'Arial, Helvetica, sans-serif',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* TOP SECTION (light bg) */}
      <div
        style={{
          background: palette.topBg,
          height: H * 0.42,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: H * 0.04,
        }}
      >
        <HeaderPanel logoUrl={logoUrl} namaKampus={data.namaKampus} palette={palette} width={W} />
        {renderDecoration()}
      </div>

      {/* BOTTOM SECTION (saturated bg) */}
      <div
        style={{
          background: palette.bottomBg,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: H * 0.10, // space for overlapping photo
          paddingBottom: H * 0.03,
          position: 'relative',
        }}
      >
        <InfoBlock data={data} palette={palette} width={W} />
      </div>

      {/* PHOTO — absolute positioned, overlapping the split */}
      <div
        style={{
          position: 'absolute',
          top: H * 0.30,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
        }}
      >
        <PhotoBlock
          foto={data.foto}
          initials={data.initials}
          ringColor={palette.ringColor}
          size={W * 0.34}
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

interface PrintProps {
  m: IdCardMahasiswa
  p: IdCardPengaturan
  logoBase64: string
}

function photoHtml(foto: string | null, initials: string, ringColor: string, sizeMm: number): string {
  const inner = foto
    ? `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:${sizeMm * 0.36}mm;font-weight:700;color:#475569\\'>${initials}</span>'" />`
    : `<span style="font-size:${sizeMm * 0.36}mm;font-weight:700;color:#475569">${initials}</span>`
  return `
    <div class="photo-wrap" style="width:${sizeMm}mm;height:${sizeMm}mm;">
      <div class="photo-inner" style="border-color:${ringColor};">
        ${inner}
      </div>
    </div>
  `
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
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="" style="width:9mm;height:9mm;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'" />`
    : ''

  // Decoration per variant (in mm)
  let decorationHtml = ''
  if (variant === 'royal-purple') {
    decorationHtml = `
      <svg class="deco-wave" viewBox="0 0 280 28" preserveAspectRatio="none">
        <path d="M0,14 Q70,0 140,14 T280,14 L280,28 L0,28 Z" fill="${palette.bottomBg}" />
      </svg>
    `
  } else if (variant === 'sunset-coral') {
    decorationHtml = `<div class="deco-stripe" style="background:${palette.ringColor};"></div>`
  } else if (variant === 'forest-emerald') {
    decorationHtml = `<div class="deco-dots"></div>`
  }

  return `
  <div class="card card-portrait ${variant}" style="
    --top-bg:${palette.topBg};
    --bottom-bg:${palette.bottomBg};
    --ring:${palette.ringColor};
    --text-light:${palette.textOnLight};
    --text-sat:${palette.textOnSaturated};
    --text-label:${palette.textLabel};
    --text-value:${palette.textValue};
    --header-bg:${palette.headerBg};
    --shadow:${palette.shadowColor};
  ">
    <div class="top-section">
      <div class="header-panel">
        ${logoImg}
        <div class="header-text">
          <div class="header-kampus">${namaKampus}</div>
          <div class="header-sub">KARTU TANDA MAHASISWA</div>
        </div>
      </div>
      ${decorationHtml}
    </div>
    <div class="bottom-section">
      <div class="info-block">
        <div class="info-name">${nama}</div>
        <div class="info-nim">${nim}</div>
        <div class="info-prodi">${prodiNama}</div>
        <div class="info-divider"></div>
        <div class="info-row">
          <div class="info-label">Kelompok</div>
          <div class="info-value">${kelompokLabel}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Lokasi ${data.tipeKkn ? 'KKN' : 'PLP'}</div>
          <div class="info-value">${lokasiLabel}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Dosen Pembimbing</div>
          <div class="info-value info-value-sm">${dosenLabel}</div>
        </div>
        <div class="info-footer">${namaKampus}</div>
      </div>
    </div>
    <div class="photo-anchor">
      ${photoHtml(foto || null, data.initials, palette.ringColor, 18)}
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

/** CSS untuk print document. Semua template portrait CR80. */
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
      box-shadow: 0 0.5mm 1.5mm rgba(0,0,0,0.12);
      position: relative;
      page-break-inside: avoid;
      font-family: Arial, Helvetica, sans-serif;
      display: flex;
      flex-direction: column;
    }
    @media print {
      .card { box-shadow: none; }
    }

    /* ============ TOP SECTION (light bg) ============ */
    .top-section {
      background: var(--top-bg);
      height: 36mm; /* ~42% of 85.6mm */
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 3mm;
    }

    /* ============ HEADER PANEL ============ */
    .header-panel {
      background: var(--header-bg);
      border-radius: 2mm;
      padding: 1.5mm 2.5mm;
      box-shadow: 0 0.6mm 1.5mm rgba(0,0,0,0.10);
      display: flex;
      align-items: center;
      gap: 1.5mm;
      max-width: 88%;
    }
    .header-text { flex: 1; min-width: 0; }
    .header-kampus {
      font-size: 2.1mm;
      font-weight: 800;
      color: var(--text-light);
      letter-spacing: 0.1mm;
      line-height: 1.1;
      text-transform: uppercase;
      word-break: break-word;
    }
    .header-sub {
      font-size: 1.5mm;
      font-weight: 600;
      color: var(--text-light);
      opacity: 0.7;
      margin-top: 0.3mm;
      letter-spacing: 0.2mm;
    }

    /* ============ DECORATIONS (per variant) ============ */
    .deco-wave {
      position: absolute;
      top: 30mm;
      left: 0;
      width: 100%;
      height: 5mm;
      pointer-events: none;
    }
    .deco-stripe {
      position: absolute;
      top: 28mm;
      left: 0;
      width: 100%;
      height: 3mm;
      opacity: 0.85;
      transform: skewY(-2deg);
      transform-origin: left center;
    }
    .deco-dots {
      position: absolute;
      top: 1mm;
      right: 1mm;
      width: 12mm;
      height: 12mm;
      pointer-events: none;
      background-image: radial-gradient(circle, var(--ring) 0.4mm, transparent 0.5mm);
      background-size: 3mm 3mm;
      background-position: 0 0;
      opacity: 0.45;
    }

    /* ============ BOTTOM SECTION (saturated bg) ============ */
    .bottom-section {
      background: var(--bottom-bg);
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 9mm; /* space for overlapping photo */
      padding-bottom: 2.5mm;
      position: relative;
    }

    /* ============ PHOTO (overlap) ============ */
    .photo-anchor {
      position: absolute;
      top: 25mm;
      left: 50%;
      transform: translateX(-50%);
      z-index: 5;
    }
    .photo-wrap {
      border-radius: 50%;
      background: #fff;
      padding: 1mm;
      box-shadow: 0 0.8mm 2.5mm rgba(0,0,0,0.18);
    }
    .photo-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 0.5mm solid var(--ring);
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
      gap: 0.5mm;
      width: 92%;
    }
    .info-name {
      font-size: 2.8mm;
      font-weight: 800;
      color: var(--text-value);
      line-height: 1.15;
      word-break: break-word;
    }
    .info-nim {
      font-size: 2.4mm;
      font-weight: 700;
      color: var(--text-value);
      font-family: monospace;
      letter-spacing: 0.1mm;
    }
    .info-prodi {
      font-size: 2mm;
      font-weight: 700;
      color: var(--text-value);
      text-transform: uppercase;
      letter-spacing: 0.1mm;
      margin-top: 0.3mm;
    }
    .info-divider {
      width: 40%;
      height: 0.2mm;
      background: var(--text-label);
      opacity: 0.4;
      margin: 0.8mm 0;
    }
    .info-row { width: 100%; margin-top: 0.3mm; }
    .info-label {
      font-size: 1.6mm;
      font-weight: 600;
      color: var(--text-label);
      letter-spacing: 0.2mm;
      text-transform: uppercase;
      margin-bottom: 0.2mm;
    }
    .info-value {
      font-size: 2.2mm;
      font-weight: 700;
      color: var(--text-value);
      line-height: 1.2;
      word-break: break-word;
    }
    .info-value-sm { font-size: 1.9mm; }
    .info-footer {
      margin-top: 1mm;
      padding: 0.6mm 1.5mm;
      background: rgba(255,255,255,0.12);
      border-radius: 1mm;
      font-size: 1.7mm;
      font-weight: 700;
      color: var(--text-value);
      letter-spacing: 0.2mm;
      text-transform: uppercase;
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
