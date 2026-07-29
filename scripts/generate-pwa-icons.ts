/**
 * Generate PWA icons from a single SVG source.
 *
 * Outputs (in /public/icons/):
 *   - icon-192.png          (any/standard)
 *   - icon-512.png          (any/standard)
 *   - icon-512-maskable.png (maskable — content inside 80% safe zone)
 *   - apple-touch-icon.png  (180×180, iOS)
 *   - favicon-32.png        (32×32)
 *   - favicon-16.png        (16×16)
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
// Icon SVG sources
// ---------------------------------------------------------------------------

// Primary gradient — matches app's bg-gradient-primary
// (oklch(0.5 0.18 255) → oklch(0.4 0.16 260))
const GRAD_STOP_1 = '#0e7490' // teal-700 (close visual match to oklch(0.5 0.18 255))
const GRAD_STOP_2 = '#155e75' // teal-800 (close visual match to oklch(0.4 0.16 260))

// Standard icon (graduation cap fills most of the canvas).
// ViewBox 0 0 512 512. Cap is centered with ~62% size.
const STANDARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${GRAD_STOP_1}"/>
      <stop offset="100%" stop-color="${GRAD_STOP_2}"/>
    </linearGradient>
  </defs>
  <!-- Full-bleed gradient background (no rounded corners — Android will mask) -->
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- Subtle decorative arc -->
  <circle cx="430" cy="90" r="180" fill="#ffffff" opacity="0.06"/>
  <circle cx="90" cy="430" r="140" fill="#ffffff" opacity="0.05"/>
  <!-- Graduation cap (lucide GraduationCap, scaled from 24→ ~300, centered) -->
  <g transform="translate(106 130) scale(12.5)" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>
  <!-- Wordmark -->
  <text x="256" y="430" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="58" letter-spacing="3" fill="#ffffff">KKN &amp; PLP</text>
</svg>`

// Maskable icon — content scaled down to ~72% so it sits inside the
// 80% safe zone that Android adaptive icons guarantee.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${GRAD_STOP_1}"/>
      <stop offset="100%" stop-color="${GRAD_STOP_2}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- Content centered within ~70% safe area -->
  <g transform="translate(156 170) scale(8.3)" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>
  <text x="256" y="380" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="44" letter-spacing="2" fill="#ffffff">KKN &amp; PLP</text>
</svg>`

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

async function render(svg: string, size: number, file: string) {
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(file)
  console.log('  ✓', file)
}

async function main() {
  await mkdir(PUBLIC_ICONS, { recursive: true })

  console.log('Generating PWA icons in', PUBLIC_ICONS)

  await render(STANDARD_SVG, 192, resolve(PUBLIC_ICONS, 'icon-192.png'))
  await render(STANDARD_SVG, 512, resolve(PUBLIC_ICONS, 'icon-512.png'))
  await render(MASKABLE_SVG, 192, resolve(PUBLIC_ICONS, 'icon-192-maskable.png'))
  await render(MASKABLE_SVG, 512, resolve(PUBLIC_ICONS, 'icon-512-maskable.png'))
  await render(STANDARD_SVG, 180, resolve(PUBLIC_ICONS, 'apple-touch-icon.png'))
  await render(STANDARD_SVG, 32, resolve(PUBLIC_ICONS, 'favicon-32.png'))
  await render(STANDARD_SVG, 16, resolve(PUBLIC_ICONS, 'favicon-16.png'))

  // Also write a favicon.ico-compatible PNG (browsers accept PNG renamed .ico
  // for the shortcut icon; we keep .png to avoid binary ico encoding complexity).
  await render(STANDARD_SVG, 64, resolve(PUBLIC_ICONS, 'favicon-64.png'))

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
