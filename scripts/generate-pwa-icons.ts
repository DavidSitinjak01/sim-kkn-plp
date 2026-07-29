/**
 * Generate PWA icons optimized for Android adaptive icons.
 *
 * Key fix: ALL icons now use the SAME design with content inside the 80%
 * "safe zone" (center 64% of canvas) and a full-bleed gradient background.
 * This makes them work as BOTH `any` and `maskable` — Android will apply
 * its adaptive icon mask cleanly without cropping the graduation cap.
 *
 * Outputs (in /public/icons/):
 *   - icon-192.png          (192×192, any maskable)
 *   - icon-512.png          (512×512, any maskable)
 *   - icon-512-maskable.png (alias of icon-512 for backward compat)
 *   - apple-touch-icon.png  (180×180, iOS — no rounded corners, iOS adds them)
 *   - favicon-32.png        (32×32)
 *   - favicon-16.png        (16×16)
 *   - favicon-64.png        (64×64)
 *
 * Run:  bun scripts/generate-pwa-icons.ts
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_ICONS = resolve(__dirname, '../public/icons')

// ---------------------------------------------------------------------------
// Design tokens — match app's bg-gradient-primary
// ---------------------------------------------------------------------------
const GRAD_STOP_1 = '#0e7490' // teal-700 (oklch 0.5 0.18 255 ≈ teal)
const GRAD_STOP_2 = '#155e75' // teal-800 (oklch 0.4 0.16 260 ≈ darker teal)

/**
 * Build the canonical icon SVG.
 *
 * Design rules for Android adaptive icon compatibility:
 *   - Full-bleed background (fills 100% of canvas → no white borders after masking)
 *   - All content inside the central 80% "safe zone" (Android guarantees this
 *     area is visible regardless of device mask shape: circle/squircle/rounded)
 *   - Graduation cap scaled to ~38% of canvas, centered slightly above middle
 *   - "KKN & PLP" wordmark below cap, also inside safe zone
 *
 * @param size  output canvas size in pixels
 */
function buildIconSvg(size: number): string {
  // Cap occupies 40% of canvas width — well inside the 80% safe zone.
  // lucide GraduationCap is 24 units wide → scale = 0.4 * size / 24
  const capScale = (size * 0.4) / 24
  const capWidth = 24 * capScale
  const capOffsetX = (size - capWidth) / 2
  const capOffsetY = size * 0.16 // cap top at 16% → cap spans 16%–56%

  // Wordmark below cap — baseline at 76%, fontSize 11%
  const fontSize = size * 0.11
  const textY = size * 0.78

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${GRAD_STOP_1}"/>
      <stop offset="100%" stop-color="${GRAD_STOP_2}"/>
    </linearGradient>
  </defs>
  <!-- Full-bleed gradient background — required for maskable -->
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <!-- Subtle decorative circles (kept low-opacity so they don't compete) -->
  <circle cx="${size * 0.85}" cy="${size * 0.15}" r="${size * 0.35}" fill="#ffffff" opacity="0.05"/>
  <circle cx="${size * 0.12}" cy="${size * 0.88}" r="${size * 0.28}" fill="#ffffff" opacity="0.04"/>
  <!-- Graduation cap (lucide GraduationCap) — centered, inside safe zone -->
  <g transform="translate(${capOffsetX} ${capOffsetY}) scale(${capScale})" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>
  <!-- Wordmark — inside safe zone, no overlap with cap -->
  <text x="${size / 2}" y="${textY}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="${fontSize}" letter-spacing="${size * 0.004}" fill="#ffffff">KKN &amp; PLP</text>
</svg>`
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

async function render(svg: string, size: number, file: string) {
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(file)
  console.log('  ✓', file)
}

async function main() {
  await mkdir(PUBLIC_ICONS, { recursive: true })

  console.log('Generating PWA icons (Android adaptive-icon optimized) in', PUBLIC_ICONS)

  // Canonical icons — single design, works as both `any` and `maskable`.
  await render(buildIconSvg(192), 192, resolve(PUBLIC_ICONS, 'icon-192.png'))
  await render(buildIconSvg(512), 512, resolve(PUBLIC_ICONS, 'icon-512.png'))

  // Maskable alias (same image) — kept for backward compat with any old
  // manifest references, and so Android finds a maskable-purpose entry.
  await render(buildIconSvg(192), 192, resolve(PUBLIC_ICONS, 'icon-192-maskable.png'))
  await render(buildIconSvg(512), 512, resolve(PUBLIC_ICONS, 'icon-512-maskable.png'))

  // Apple touch icon (iOS uses 180×180, applies its own rounded mask)
  await render(buildIconSvg(180), 180, resolve(PUBLIC_ICONS, 'apple-touch-icon.png'))

  // Favicons
  await render(buildIconSvg(64), 64, resolve(PUBLIC_ICONS, 'favicon-64.png'))
  await render(buildIconSvg(32), 32, resolve(PUBLIC_ICONS, 'favicon-32.png'))
  await render(buildIconSvg(16), 16, resolve(PUBLIC_ICONS, 'favicon-16.png'))

  // Also write a 256×256 icon for Chrome on Android <192 fallback.
  await render(buildIconSvg(256), 256, resolve(PUBLIC_ICONS, 'icon-256.png'))

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
