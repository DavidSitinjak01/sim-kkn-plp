'use client'

/**
 * id-card-templates.tsx
 *
 * Berisi 4 desain template Kartu Tanda Mahasiswa (KTM / ID Card):
 *   1. "Modern Landscape"  — Landscape, foto kiri, info kanan, aksen emerald
 *   2. "Classic Portrait"  — Portrait, header logo, foto tengah, tabel info, maroon klasik
 *   3. "Vertical Modern"   — Portrait, header gradient, foto lingkaran, aksen cyan
 *   4. "Minimalist"        — Landscape, bersih, aksen tipis slate/amber
 *
 * Setiap template memiliki:
 *   - <TemplateName>Preview  → komponen React untuk live preview di layar
 *   - build<Name>CardHtml()  → string HTML untuk satu kartu (digabung di print window)
 *
 * Export utama:
 *   - ID_CARD_TEMPLATES        → array metadata template (id, nama, deskripsi, orientasi)
 *   - TemplatePreview          → komponen yang merender preview sesuai templateId
 *   - buildPrintDocumentHtml() → menyusun dokumen HTML lengkap (semua kartu) untuk print window
 */

import { IdCard as IdCardIcon, GraduationCap, ShieldCheck, Sparkles, Layout } from 'lucide-react'

// ============ Types ============
interface Prodi { id: string; kode: string; nama: string; jenjang: string }
interface Fakultas { id: string; kode: string; nama: string }

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
}

export type IdCardPengaturan = Record<string, string>

export interface IdCardLogos {
  kampus: string
}

export type TemplateId = 'modern-landscape' | 'classic-portrait' | 'vertical-modern' | 'minimalist'

export interface IdCardTemplateMeta {
  id: TemplateId
  nama: string
  deskripsi: string
  orientasi: 'landscape' | 'portrait'
  accent: string // hex color preview swatch
  icon: typeof IdCardIcon
}

export const ID_CARD_TEMPLATES: IdCardTemplateMeta[] = [
  {
    id: 'modern-landscape',
    nama: 'Modern Landscape',
    deskripsi: 'Orientasi landscape dengan foto di kiri dan info di kanan. Aksen emerald yang modern.',
    orientasi: 'landscape',
    accent: '#059669',
    icon: Layout,
  },
  {
    id: 'classic-portrait',
    nama: 'Classic Portrait',
    deskripsi: 'Orientasi portrait klasik dengan header logo, foto, dan tabel info. Aksen maroon akademik.',
    orientasi: 'portrait',
    accent: '#991b1b',
    icon: GraduationCap,
  },
  {
    id: 'vertical-modern',
    nama: 'Vertical Modern',
    deskripsi: 'Portrait modern dengan header gradient, foto lingkaran, dan info di bawah. Aksen cyan segar.',
    orientasi: 'portrait',
    accent: '#0891b2',
    icon: Sparkles,
  },
  {
    id: 'minimalist',
    nama: 'Minimalist',
    deskripsi: 'Landscape minimalis dengan whitespace lega dan aksen tipis. Profesional dan bersih.',
    orientasi: 'landscape',
    accent: '#475569',
    icon: ShieldCheck,
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

/** Jenis kelamin label */
function jkLabel(jk: string): string {
  return jk === 'L' ? 'Laki-laki' : jk === 'P' ? 'Perempuan' : '-'
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

// ============================================================
//  TEMPLATE 1: MODERN LANDSCAPE
// ============================================================

function ModernLandscapePreview({
  m, p, logoUrl,
}: { m: IdCardMahasiswa; p: IdCardPengaturan; logoUrl: string }) {
  const namaKampus = p.nama_kampus || 'UNIVERSITAS'
  const alamat = p.alamat_kampus || ''
  const foto = m.foto

  return (
    <div
      style={{
        width: '340px',
        height: '214px',
        borderRadius: '14px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #059669 0%, #047857 60%, #065f46 100%)',
          height: '46px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#fff',
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo"
            style={{ width: '30px', height: '30px', objectFit: 'contain', background: '#fff', borderRadius: '6px', padding: '2px' }}
            onError={(e) => { (e.currentTarget.style.display = 'none') }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.3px', lineHeight: 1.1, textTransform: 'uppercase' }}>
            {namaKampus}
          </div>
          <div style={{ fontSize: '8px', opacity: 0.85, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alamat}
          </div>
        </div>
        <div style={{ fontSize: '8px', fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.3px' }}>
          KTM
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', padding: '10px 12px', gap: '12px', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '78px',
            height: '98px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#e2e8f0',
            border: '2px solid #059669',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {foto ? (
            <img
              src={foto}
              alt={m.nama}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                const t = e.currentTarget
                t.style.display = 'none'
                const parent = t.parentElement
                if (parent) parent.innerHTML = `<span style="font-size:22px;font-weight:bold;color:#64748b">${getInitials(m.nama)}</span>`
              }}
            />
          ) : (
            <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#64748b' }}>{getInitials(m.nama)}</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.15, wordBreak: 'break-word' }}>
            {m.nama}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#059669', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
            {m.nim}
          </div>
          <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: '2px 6px', fontSize: '8.5px', lineHeight: 1.3 }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Prodi</span>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>{m.prodi.nama}</span>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Fakultas</span>
            <span style={{ color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.prodi.fakultas.nama}</span>
            <span style={{ color: '#64748b', fontWeight: 600 }}>TTL</span>
            <span style={{ color: '#0f172a', fontWeight: 500 }}>{m.tempatLahir}, {formatTanggal(m.tanggalLahir)}</span>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Semester</span>
            <span style={{ color: '#0f172a', fontWeight: 500 }}>{m.semester} &middot; Angkatan {m.angkatan}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#f1f5f9',
          borderTop: '1px solid #e2e8f0',
          padding: '4px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '7.5px',
          color: '#475569',
        }}
      >
        <span>{p.no_telepon || p.email_kampus || ''}</span>
        <span style={{ fontWeight: 700, color: '#059669' }}>Berlaku selama masa studi</span>
      </div>
    </div>
  )
}

function buildModernLandscapeCardHtml(m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string): string {
  const namaKampus = escapeHtml(p.nama_kampus || 'UNIVERSITAS')
  const alamat = escapeHtml(p.alamat_kampus || '')
  const foto = m.foto ? escapeHtml(m.foto) : ''
  const fotoHtml = foto
    ? `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:6mm;font-weight:bold;color:#64748b\\'>${getInitials(m.nama)}</span>'" />`
    : `<span style="font-size:6mm;font-weight:bold;color:#64748b">${getInitials(m.nama)}</span>`
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="" style="width:9mm;height:9mm;object-fit:contain;background:#fff;border-radius:1.5mm;padding:0.5mm;" />`
    : ''

  return `
  <div class="card card-landscape">
    <div class="ml-header">
      ${logoImg}
      <div class="ml-header-text">
        <div class="ml-kampus">${namaKampus}</div>
        <div class="ml-alamat">${alamat}</div>
      </div>
      <div class="ml-badge">KTM</div>
    </div>
    <div class="ml-body">
      <div class="ml-photo">${fotoHtml}</div>
      <div class="ml-info">
        <div class="ml-name">${escapeHtml(m.nama)}</div>
        <div class="ml-nim">${escapeHtml(m.nim)}</div>
        <div class="ml-divider"></div>
        <div class="ml-grid">
          <span class="ml-label">Prodi</span><span class="ml-val">${escapeHtml(m.prodi.nama)}</span>
          <span class="ml-label">Fakultas</span><span class="ml-val">${escapeHtml(m.prodi.fakultas.nama)}</span>
          <span class="ml-label">TTL</span><span class="ml-val">${escapeHtml(m.tempatLahir)}, ${formatTanggal(m.tanggalLahir)}</span>
          <span class="ml-label">Semester</span><span class="ml-val">${m.semester} &middot; Angkatan ${m.angkatan}</span>
        </div>
      </div>
    </div>
    <div class="ml-footer">
      <span>${escapeHtml(p.no_telepon || p.email_kampus || '')}</span>
      <span class="ml-footer-accent">Berlaku selama masa studi</span>
    </div>
  </div>`
}

// ============================================================
//  TEMPLATE 2: CLASSIC PORTRAIT
// ============================================================

function ClassicPortraitPreview({
  m, p, logoUrl,
}: { m: IdCardMahasiswa; p: IdCardPengaturan; logoUrl: string }) {
  const namaKampus = p.nama_kampus || 'UNIVERSITAS'
  const foto = m.foto

  return (
    <div
      style={{
        width: '300px',
        height: '470px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        border: '3px solid #991b1b',
        position: 'relative',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
          padding: '10px 12px 8px',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ width: '34px', height: '34px', objectFit: 'contain', background: '#fff', borderRadius: '50%', padding: '2px' }}
              onError={(e) => { (e.currentTarget.style.display = 'none') }}
            />
          )}
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px', lineHeight: 1.1, textTransform: 'uppercase' }}>
              {namaKampus}
            </div>
            <div style={{ fontSize: '7.5px', opacity: 0.9, marginTop: '1px' }}>
              Kartu Tanda Mahasiswa
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 8px', background: '#fff' }}>
        <div
          style={{
            width: '108px',
            height: '128px',
            border: '2px solid #991b1b',
            padding: '2px',
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              width: '100%', height: '100%', overflow: 'hidden', background: '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {foto ? (
              <img
                src={foto}
                alt={m.nama}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                  const parent = t.parentElement
                  if (parent) parent.innerHTML = `<span style="font-size:28px;font-weight:bold;color:#94a3b8">${getInitials(m.nama)}</span>`
                }}
              />
            ) : (
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#94a3b8' }}>{getInitials(m.nama)}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#7f1d1d', lineHeight: 1.15, wordBreak: 'break-word', padding: '0 4px' }}>
            {m.nama}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
            {m.nim}
          </div>
        </div>
        <div style={{ height: '1px', background: '#991b1b', margin: '4px 0 6px' }} />
        <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '2px 0', color: '#64748b', fontWeight: 600, width: '38%' }}>Tempat/Tgl Lahir</td><td style={{ padding: '2px 0', color: '#0f172a', fontWeight: 500 }}>: {m.tempatLahir}, {formatTanggal(m.tanggalLahir)}</td></tr>
            <tr><td style={{ padding: '2px 0', color: '#64748b', fontWeight: 600 }}>Jenis Kelamin</td><td style={{ padding: '2px 0', color: '#0f172a', fontWeight: 500 }}>: {jkLabel(m.jenisKelamin)}</td></tr>
            <tr><td style={{ padding: '2px 0', color: '#64748b', fontWeight: 600 }}>Program Studi</td><td style={{ padding: '2px 0', color: '#0f172a', fontWeight: 500 }}>: {m.prodi.nama}</td></tr>
            <tr><td style={{ padding: '2px 0', color: '#64748b', fontWeight: 600 }}>Fakultas</td><td style={{ padding: '2px 0', color: '#0f172a', fontWeight: 500 }}>: {m.prodi.fakultas.nama}</td></tr>
            <tr><td style={{ padding: '2px 0', color: '#64748b', fontWeight: 600, verticalAlign: 'top' }}>Alamat</td><td style={{ padding: '2px 0', color: '#0f172a', fontWeight: 500 }}>: {m.alamat}</td></tr>
            <tr><td style={{ padding: '2px 0', color: '#64748b', fontWeight: 600 }}>No. HP</td><td style={{ padding: '2px 0', color: '#0f172a', fontWeight: 500 }}>: {m.noHp}</td></tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          background: '#7f1d1d',
          padding: '6px 14px',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '8px',
        }}
      >
        <span style={{ fontWeight: 600 }}>Semester {m.semester}</span>
        <span style={{ fontWeight: 700, fontStyle: 'italic' }}>{p.website || ''}</span>
      </div>
    </div>
  )
}

function buildClassicPortraitCardHtml(m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string): string {
  const namaKampus = escapeHtml(p.nama_kampus || 'UNIVERSITAS')
  const foto = m.foto ? escapeHtml(m.foto) : ''
  const fotoHtml = foto
    ? `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:7mm;font-weight:bold;color:#94a3b8\\'>${getInitials(m.nama)}</span>'" />`
    : `<span style="font-size:7mm;font-weight:bold;color:#94a3b8">${getInitials(m.nama)}</span>`
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="" style="width:9mm;height:9mm;object-fit:contain;background:#fff;border-radius:50%;padding:0.5mm;" />`
    : ''

  return `
  <div class="card card-portrait cp-card">
    <div class="cp-header">
      ${logoImg}
      <div class="cp-header-text">
        <div class="cp-kampus">${namaKampus}</div>
        <div class="cp-sub">Kartu Tanda Mahasiswa</div>
      </div>
    </div>
    <div class="cp-photo-wrap">
      <div class="cp-photo">${fotoHtml}</div>
    </div>
    <div class="cp-body">
      <div class="cp-name">${escapeHtml(m.nama)}</div>
      <div class="cp-nim">${escapeHtml(m.nim)}</div>
      <div class="cp-divider"></div>
      <table class="cp-table">
        <tr><td class="cp-label">Tempat/Tgl Lahir</td><td class="cp-val">: ${escapeHtml(m.tempatLahir)}, ${formatTanggal(m.tanggalLahir)}</td></tr>
        <tr><td class="cp-label">Jenis Kelamin</td><td class="cp-val">: ${jkLabel(m.jenisKelamin)}</td></tr>
        <tr><td class="cp-label">Program Studi</td><td class="cp-val">: ${escapeHtml(m.prodi.nama)}</td></tr>
        <tr><td class="cp-label">Fakultas</td><td class="cp-val">: ${escapeHtml(m.prodi.fakultas.nama)}</td></tr>
        <tr><td class="cp-label" style="vertical-align:top;">Alamat</td><td class="cp-val">: ${escapeHtml(m.alamat)}</td></tr>
        <tr><td class="cp-label">No. HP</td><td class="cp-val">: ${escapeHtml(m.noHp)}</td></tr>
      </table>
    </div>
    <div class="cp-footer">
      <span>Semester ${m.semester}</span>
      <span style="font-style:italic;">${escapeHtml(p.website || '')}</span>
    </div>
  </div>`
}

// ============================================================
//  TEMPLATE 3: VERTICAL MODERN
// ============================================================

function VerticalModernPreview({
  m, p, logoUrl,
}: { m: IdCardMahasiswa; p: IdCardPengaturan; logoUrl: string }) {
  const namaKampus = p.nama_kampus || 'UNIVERSITAS'
  const foto = m.foto

  return (
    <div
      style={{
        width: '300px',
        height: '460px',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)',
          height: '140px',
          position: 'relative',
          padding: '14px 14px 0',
          color: '#fff',
        }}
      >
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
        <div style={{ position: 'absolute', top: '20px', right: '40px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ width: '28px', height: '28px', objectFit: 'contain', background: '#fff', borderRadius: '6px', padding: '2px' }}
              onError={(e) => { (e.currentTarget.style.display = 'none') }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.4px', lineHeight: 1.1, textTransform: 'uppercase' }}>
              {namaKampus}
            </div>
            <div style={{ fontSize: '7.5px', opacity: 0.9, marginTop: '1px' }}>Kartu Tanda Mahasiswa</div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '-38px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '82px',
            height: '82px',
            borderRadius: '50%',
            background: '#fff',
            padding: '3px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '100%', height: '100%', borderRadius: '50%',
              border: '2px solid #06b6d4',
              overflow: 'hidden',
              background: '#e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {foto ? (
              <img
                src={foto}
                alt={m.nama}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                  const parent = t.parentElement
                  if (parent) parent.innerHTML = `<span style="font-size:22px;font-weight:bold;color:#64748b">${getInitials(m.nama)}</span>`
                }}
              />
            ) : (
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#64748b' }}>{getInitials(m.nama)}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '46px 16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', lineHeight: 1.15, wordBreak: 'break-word', maxWidth: '260px' }}>
          {m.nama}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0891b2', fontFamily: 'monospace', marginTop: '2px', letterSpacing: '0.5px' }}>
          {m.nim}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%', marginTop: '10px' }}>
          <div style={{ background: '#f0f9ff', borderLeft: '3px solid #06b6d4', borderRadius: '0 6px 6px 0', padding: '4px 8px', fontSize: '8.5px', textAlign: 'left' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Prodi</span>
            <span style={{ color: '#0f172a', fontWeight: 700, marginLeft: '4px' }}>{m.prodi.nama}</span>
          </div>
          <div style={{ background: '#f0f9ff', borderLeft: '3px solid #06b6d4', borderRadius: '0 6px 6px 0', padding: '4px 8px', fontSize: '8.5px', textAlign: 'left' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Fakultas</span>
            <span style={{ color: '#0f172a', fontWeight: 700, marginLeft: '4px' }}>{m.prodi.fakultas.nama}</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ flex: 1, background: '#f0f9ff', borderLeft: '3px solid #06b6d4', borderRadius: '0 6px 6px 0', padding: '4px 8px', fontSize: '8.5px', textAlign: 'left' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Sem</span>
              <span style={{ color: '#0f172a', fontWeight: 700, marginLeft: '4px' }}>{m.semester}</span>
            </div>
            <div style={{ flex: 1, background: '#f0f9ff', borderLeft: '3px solid #06b6d4', borderRadius: '0 6px 6px 0', padding: '4px 8px', fontSize: '8.5px', textAlign: 'left' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Angkatan</span>
              <span style={{ color: '#0f172a', fontWeight: 700, marginLeft: '4px' }}>{m.angkatan}</span>
            </div>
          </div>
          <div style={{ background: '#f0f9ff', borderLeft: '3px solid #06b6d4', borderRadius: '0 6px 6px 0', padding: '4px 8px', fontSize: '8.5px', textAlign: 'left' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>TTL</span>
            <span style={{ color: '#0f172a', fontWeight: 700, marginLeft: '4px' }}>{m.tempatLahir}, {formatTanggal(m.tanggalLahir)}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'linear-gradient(90deg, #0891b2 0%, #06b6d4 100%)',
          padding: '6px 14px',
          color: '#fff',
          textAlign: 'center',
          fontSize: '8px',
          fontWeight: 700,
          letterSpacing: '0.4px',
        }}
      >
        {p.no_telepon ? `${p.no_telepon}  •  ` : ''}{p.email_kampus || ''}
      </div>
    </div>
  )
}

function buildVerticalModernCardHtml(m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string): string {
  const namaKampus = escapeHtml(p.nama_kampus || 'UNIVERSITAS')
  const foto = m.foto ? escapeHtml(m.foto) : ''
  const fotoHtml = foto
    ? `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:6mm;font-weight:bold;color:#64748b\\'>${getInitials(m.nama)}</span>'" />`
    : `<span style="font-size:6mm;font-weight:bold;color:#64748b">${getInitials(m.nama)}</span>`
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="" style="width:8mm;height:8mm;object-fit:contain;background:#fff;border-radius:1.5mm;padding:0.5mm;" />`
    : ''

  return `
  <div class="card card-portrait vm-card">
    <div class="vm-header">
      <div class="vm-deco1"></div>
      <div class="vm-deco2"></div>
      <div class="vm-header-row">
        ${logoImg}
        <div class="vm-header-text">
          <div class="vm-kampus">${namaKampus}</div>
          <div class="vm-sub">Kartu Tanda Mahasiswa</div>
        </div>
      </div>
      <div class="vm-photo-wrap">
        <div class="vm-photo">${fotoHtml}</div>
      </div>
    </div>
    <div class="vm-body">
      <div class="vm-name">${escapeHtml(m.nama)}</div>
      <div class="vm-nim">${escapeHtml(m.nim)}</div>
      <div class="vm-chips">
        <div class="vm-chip"><span class="vm-chip-label">Prodi</span><span class="vm-chip-val">${escapeHtml(m.prodi.nama)}</span></div>
        <div class="vm-chip"><span class="vm-chip-label">Fakultas</span><span class="vm-chip-val">${escapeHtml(m.prodi.fakultas.nama)}</span></div>
        <div class="vm-chip-row">
          <div class="vm-chip"><span class="vm-chip-label">Sem</span><span class="vm-chip-val">${m.semester}</span></div>
          <div class="vm-chip"><span class="vm-chip-label">Angkatan</span><span class="vm-chip-val">${m.angkatan}</span></div>
        </div>
        <div class="vm-chip"><span class="vm-chip-label">TTL</span><span class="vm-chip-val">${escapeHtml(m.tempatLahir)}, ${formatTanggal(m.tanggalLahir)}</span></div>
      </div>
    </div>
    <div class="vm-footer">${escapeHtml(p.no_telepon ? p.no_telepon + '  •  ' : '')}${escapeHtml(p.email_kampus || '')}</div>
  </div>`
}

// ============================================================
//  TEMPLATE 4: MINIMALIST
// ============================================================

function MinimalistPreview({
  m, p, logoUrl,
}: { m: IdCardMahasiswa; p: IdCardPengaturan; logoUrl: string }) {
  const namaKampus = p.nama_kampus || 'UNIVERSITAS'
  const foto = m.foto

  return (
    <div
      style={{
        width: '340px',
        height: '214px',
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        position: 'relative',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ width: '96px', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 8px', borderRight: '1px solid #e2e8f0', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #475569, #f59e0b)' }} />
        <div
          style={{
            width: '74px',
            height: '90px',
            borderRadius: '6px',
            overflow: 'hidden',
            background: '#e2e8f0',
            border: '1px solid #cbd5e1',
          }}
        >
          {foto ? (
            <img
              src={foto}
              alt={m.nama}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                const t = e.currentTarget
                t.style.display = 'none'
                const parent = t.parentElement
                if (parent) parent.innerHTML = `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#94a3b8">${getInitials(m.nama)}</span>`
              }}
            />
          ) : (
            <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: '#94a3b8' }}>{getInitials(m.nama)}</span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ width: '20px', height: '20px', objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget.style.display = 'none') }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase', lineHeight: 1.1 }}>
              {namaKampus}
            </div>
            <div style={{ fontSize: '7px', color: '#94a3b8', marginTop: '1px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Kartu Tanda Mahasiswa
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: '#e2e8f0', marginBottom: '8px' }} />

        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', lineHeight: 1.15, wordBreak: 'break-word' }}>
          {m.nama}
        </div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', fontFamily: 'monospace', marginTop: '1px', letterSpacing: '0.5px' }}>
          {m.nim}
        </div>

        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '8.5px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: '#94a3b8', fontWeight: 600, minWidth: '48px' }}>Prodi</span>
            <span style={{ color: '#334155', fontWeight: 500 }}>{m.prodi.nama}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: '#94a3b8', fontWeight: 600, minWidth: '48px' }}>Fakultas</span>
            <span style={{ color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.prodi.fakultas.nama}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: '#94a3b8', fontWeight: 600, minWidth: '48px' }}>TTL</span>
            <span style={{ color: '#334155', fontWeight: 500 }}>{m.tempatLahir}, {formatTanggal(m.tanggalLahir)}</span>
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '7px', color: '#94a3b8' }}>Sem {m.semester} / {m.angkatan}</span>
          <span style={{ fontSize: '7px', fontWeight: 700, color: '#f59e0b' }}>BERLAKU SELAMA STUDI</span>
        </div>
      </div>
    </div>
  )
}

function buildMinimalistCardHtml(m: IdCardMahasiswa, p: IdCardPengaturan, logoBase64: string): string {
  const namaKampus = escapeHtml(p.nama_kampus || 'UNIVERSITAS')
  const foto = m.foto ? escapeHtml(m.foto) : ''
  const fotoHtml = foto
    ? `<img src="${foto}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:5mm;font-weight:bold;color:#94a3b8\\'>${getInitials(m.nama)}</span>'" />`
    : `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:5mm;font-weight:bold;color:#94a3b8">${getInitials(m.nama)}</span>`
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="" style="width:6mm;height:6mm;object-fit:contain;" />`
    : ''

  return `
  <div class="card card-landscape mn-card">
    <div class="mn-left">
      <div class="mn-accent"></div>
      <div class="mn-photo">${fotoHtml}</div>
    </div>
    <div class="mn-right">
      <div class="mn-header">
        ${logoImg}
        <div class="mn-header-text">
          <div class="mn-kampus">${namaKampus}</div>
          <div class="mn-sub">Kartu Tanda Mahasiswa</div>
        </div>
      </div>
      <div class="mn-divider"></div>
      <div class="mn-name">${escapeHtml(m.nama)}</div>
      <div class="mn-nim">${escapeHtml(m.nim)}</div>
      <div class="mn-info">
        <div class="mn-row"><span class="mn-label">Prodi</span><span class="mn-val">${escapeHtml(m.prodi.nama)}</span></div>
        <div class="mn-row"><span class="mn-label">Fakultas</span><span class="mn-val">${escapeHtml(m.prodi.fakultas.nama)}</span></div>
        <div class="mn-row"><span class="mn-label">TTL</span><span class="mn-val">${escapeHtml(m.tempatLahir)}, ${formatTanggal(m.tanggalLahir)}</span></div>
      </div>
      <div class="mn-footer">
        <span>Sem ${m.semester} / ${m.angkatan}</span>
        <span class="mn-footer-accent">BERLAKU SELAMA STUDI</span>
      </div>
    </div>
  </div>`
}

// ============ Template Preview Dispatcher ============
interface TemplatePreviewProps {
  templateId: TemplateId
  m: IdCardMahasiswa
  p: IdCardPengaturan
  logoUrl: string
}

export function TemplatePreview({ templateId, m, p, logoUrl }: TemplatePreviewProps) {
  switch (templateId) {
    case 'modern-landscape':
      return <ModernLandscapePreview m={m} p={p} logoUrl={logoUrl} />
    case 'classic-portrait':
      return <ClassicPortraitPreview m={m} p={p} logoUrl={logoUrl} />
    case 'vertical-modern':
      return <VerticalModernPreview m={m} p={p} logoUrl={logoUrl} />
    case 'minimalist':
      return <MinimalistPreview m={m} p={p} logoUrl={logoUrl} />
    default:
      return <ModernLandscapePreview m={m} p={p} logoUrl={logoUrl} />
  }
}

// ============ Print HTML Builder (full document) ============
function buildCardsForTemplate(
  templateId: TemplateId,
  list: IdCardMahasiswa[],
  p: IdCardPengaturan,
  logoBase64: string,
): string {
  const fn = templateId === 'classic-portrait'
    ? buildClassicPortraitCardHtml
    : templateId === 'vertical-modern'
    ? buildVerticalModernCardHtml
    : templateId === 'minimalist'
    ? buildMinimalistCardHtml
    : buildModernLandscapeCardHtml
  return list.map((m) => fn(m, p, logoBase64)).join('\n')
}

/** CSS untuk print document. Berbeda per template (orientasi & ukuran). */
function buildPrintCss(templateId: TemplateId): string {
  const isPortrait = templateId === 'classic-portrait' || templateId === 'vertical-modern'

  const base = `
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
    .cards-grid {
      display: grid;
      gap: 4mm;
      justify-items: center;
    }
    .card {
      position: relative;
      page-break-inside: avoid;
      overflow: hidden;
      box-shadow: 0 0.5mm 1.5mm rgba(0,0,0,0.12);
    }
    @media print {
      .card { box-shadow: none; }
    }
  `

  const gridCols = isPortrait
    ? `.cards-grid { grid-template-columns: repeat(3, 1fr); }`
    : `.cards-grid { grid-template-columns: repeat(2, 1fr); }`

  const dims = isPortrait
    ? `.card { width: 54mm; height: 85.6mm; border-radius: 3mm; }`
    : `.card { width: 85.6mm; height: 54mm; border-radius: 3mm; }`

  let templateCss = ''
  if (templateId === 'modern-landscape') {
    templateCss = `
      .card-landscape { display: flex; flex-direction: column; }
      .ml-header { background: linear-gradient(135deg, #059669 0%, #047857 60%, #065f46 100%); height: 12mm; padding: 0 3.5mm; display: flex; align-items: center; gap: 2mm; color: #fff; }
      .ml-header-text { flex: 1; min-width: 0; }
      .ml-kampus { font-size: 2.8mm; font-weight: 800; letter-spacing: 0.1mm; line-height: 1.1; text-transform: uppercase; }
      .ml-alamat { font-size: 1.9mm; opacity: 0.85; margin-top: 0.3mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ml-badge { font-size: 2mm; font-weight: 700; background: rgba(255,255,255,0.2); padding: 0.5mm 1.5mm; border-radius: 1mm; letter-spacing: 0.1mm; }
      .ml-body { flex: 1; display: flex; padding: 2.5mm 3mm; gap: 3mm; }
      .ml-photo { width: 20mm; height: 25mm; border-radius: 2mm; overflow: hidden; background: #e2e8f0; border: 0.5mm solid #059669; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
      .ml-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3mm; }
      .ml-name { font-size: 3.3mm; font-weight: 800; color: #0f172a; line-height: 1.15; word-break: break-word; }
      .ml-nim { font-size: 2.6mm; font-weight: 700; color: #059669; font-family: monospace; letter-spacing: 0.1mm; }
      .ml-divider { height: 0.2mm; background: #e2e8f0; margin: 1mm 0; }
      .ml-grid { display: grid; grid-template-columns: 13mm 1fr; gap: 0.5mm 1.5mm; font-size: 2.2mm; line-height: 1.3; }
      .ml-label { color: #64748b; font-weight: 600; }
      .ml-val { color: #0f172a; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
      .ml-footer { background: #f1f5f9; border-top: 0.2mm solid #e2e8f0; padding: 1mm 3.5mm; display: flex; justify-content: space-between; align-items: center; font-size: 1.9mm; color: #475569; }
      .ml-footer-accent { font-weight: 700; color: #059669; }
    `
  } else if (templateId === 'classic-portrait') {
    templateCss = `
      .card-portrait { display: flex; flex-direction: column; }
      .cp-card { border: 0.8mm solid #991b1b; }
      .cp-header { background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); padding: 2.5mm 3mm 2mm; color: #fff; display: flex; align-items: center; gap: 2mm; }
      .cp-header-text { flex: 1; }
      .cp-kampus { font-size: 2.6mm; font-weight: 800; letter-spacing: 0.1mm; line-height: 1.1; text-transform: uppercase; }
      .cp-sub { font-size: 1.9mm; opacity: 0.9; margin-top: 0.3mm; }
      .cp-photo-wrap { display: flex; justify-content: center; padding: 3mm 0 2mm; background: #fff; }
      .cp-photo { width: 27mm; height: 32mm; border: 0.5mm solid #991b1b; padding: 0.5mm; background: #fff; box-shadow: 0 0.5mm 2mm rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .cp-body { flex: 1; padding: 2mm 3.5mm; display: flex; flex-direction: column; }
      .cp-name { font-size: 3.3mm; font-weight: 800; color: #7f1d1d; line-height: 1.15; word-break: break-word; text-align: center; }
      .cp-nim { font-size: 2.8mm; font-weight: 700; color: #0f172a; font-family: monospace; text-align: center; margin-top: 0.5mm; }
      .cp-divider { height: 0.3mm; background: #991b1b; margin: 1.5mm 0; }
      .cp-table { width: 100%; font-size: 2.2mm; border-collapse: collapse; }
      .cp-table td { padding: 0.4mm 0; }
      .cp-label { color: #64748b; font-weight: 600; width: 42%; }
      .cp-val { color: #0f172a; font-weight: 500; }
      .cp-footer { background: #7f1d1d; padding: 1.5mm 3.5mm; color: #fff; display: flex; justify-content: space-between; align-items: center; font-size: 2mm; }
    `
  } else if (templateId === 'vertical-modern') {
    templateCss = `
      .card-portrait { display: flex; flex-direction: column; }
      .vm-header { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%); height: 38mm; position: relative; padding: 3.5mm 3.5mm 0; color: #fff; overflow: hidden; }
      .vm-deco1 { position: absolute; top: -5mm; right: -5mm; width: 20mm; height: 20mm; border-radius: 50%; background: rgba(255,255,255,0.12); }
      .vm-deco2 { position: absolute; top: 5mm; right: 10mm; width: 10mm; height: 10mm; border-radius: 50%; background: rgba(255,255,255,0.08); }
      .vm-header-row { display: flex; align-items: center; gap: 2mm; position: relative; z-index: 1; }
      .vm-header-text { flex: 1; }
      .vm-kampus { font-size: 2.6mm; font-weight: 800; letter-spacing: 0.1mm; line-height: 1.1; text-transform: uppercase; }
      .vm-sub { font-size: 1.9mm; opacity: 0.9; margin-top: 0.3mm; }
      .vm-photo-wrap { position: absolute; bottom: -10mm; left: 50%; transform: translateX(-50%); width: 22mm; height: 22mm; border-radius: 50%; background: #fff; padding: 0.8mm; box-shadow: 0 1mm 3.5mm rgba(0,0,0,0.25); z-index: 2; }
      .vm-photo { width: 100%; height: 100%; border-radius: 50%; border: 0.5mm solid #06b6d4; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center; }
      .vm-body { flex: 1; padding: 12mm 4mm 3mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
      .vm-name { font-size: 3.5mm; font-weight: 800; color: #0f172a; line-height: 1.15; word-break: break-word; max-width: 65mm; }
      .vm-nim { font-size: 2.8mm; font-weight: 700; color: #0891b2; font-family: monospace; margin-top: 0.5mm; letter-spacing: 0.1mm; }
      .vm-chips { display: flex; flex-direction: column; gap: 1.2mm; width: 100%; margin-top: 2.5mm; }
      .vm-chip { background: #f0f9ff; border-left: 0.8mm solid #06b6d4; border-radius: 0 1.5mm 1.5mm 0; padding: 1mm 2mm; font-size: 2.2mm; text-align: left; }
      .vm-chip-label { color: #64748b; font-weight: 600; }
      .vm-chip-val { color: #0f172a; font-weight: 700; margin-left: 1mm; }
      .vm-chip-row { display: flex; gap: 1mm; }
      .vm-chip-row .vm-chip { flex: 1; }
      .vm-footer { background: linear-gradient(90deg, #0891b2 0%, #06b6d4 100%); padding: 1.5mm 3.5mm; color: #fff; text-align: center; font-size: 1.9mm; font-weight: 700; letter-spacing: 0.1mm; }
    `
  } else { // minimalist
    templateCss = `
      .card-landscape { display: flex; }
      .mn-card { border: 0.2mm solid #e2e8f0; }
      .mn-left { width: 24mm; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3mm 2mm; border-right: 0.2mm solid #e2e8f0; position: relative; }
      .mn-accent { position: absolute; top: 0; left: 0; right: 0; height: 1mm; background: linear-gradient(90deg, #475569, #f59e0b); }
      .mn-photo { width: 18.5mm; height: 22.5mm; border-radius: 1.5mm; overflow: hidden; background: #e2e8f0; border: 0.2mm solid #cbd5e1; display: flex; align-items: center; justify-content: center; }
      .mn-right { flex: 1; display: flex; flex-direction: column; padding: 3.5mm 4mm; }
      .mn-header { display: flex; align-items: center; gap: 2mm; margin-bottom: 2mm; }
      .mn-header-text { flex: 1; }
      .mn-kampus { font-size: 2.3mm; font-weight: 800; color: #0f172a; letter-spacing: 0.15mm; text-transform: uppercase; line-height: 1.1; }
      .mn-sub { font-size: 1.7mm; color: #94a3b8; margin-top: 0.3mm; letter-spacing: 0.08mm; text-transform: uppercase; }
      .mn-divider { height: 0.2mm; background: #e2e8f0; margin-bottom: 2mm; }
      .mn-name { font-size: 3.5mm; font-weight: 800; color: #0f172a; line-height: 1.15; word-break: break-word; }
      .mn-nim { font-size: 2.6mm; font-weight: 700; color: #475569; font-family: monospace; margin-top: 0.3mm; letter-spacing: 0.1mm; }
      .mn-info { margin-top: 2mm; display: flex; flex-direction: column; gap: 0.5mm; font-size: 2.1mm; }
      .mn-row { display: flex; gap: 1.5mm; }
      .mn-label { color: #94a3b8; font-weight: 600; min-width: 12mm; }
      .mn-val { color: #334155; font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
      .mn-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 1.5mm; border-top: 0.2mm solid #f1f5f9; }
      .mn-footer > span:first-child { font-size: 1.7mm; color: #94a3b8; }
      .mn-footer-accent { font-size: 1.7mm; font-weight: 700; color: #f59e0b; }
    `
  }

  return `${base}\n${gridCols}\n${dims}\n${templateCss}`
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
