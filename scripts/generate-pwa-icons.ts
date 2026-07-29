/**
 * Generate PWA icons using the Kampus Merdeka logo on a teal gradient
 * background (matches the app's primary theme color).
 *
 * Design:
 *   - Full-bleed teal gradient background (required for Android maskable)
 *   - Kampus Merdeka shield logo centered in the 80% safe zone (~70% size)
 *   - Logo retains its original blue shield + graduation cap + "KAMPUS MERDEKA" text
 *
 * Outputs (in /public/icons/):
 *   - icon-192.png, icon-256.png, icon-512.png (any maskable)
 *   - apple-touch-icon.png (180×180)
 *   - favicon-64/32/16.png
 *
 * Run:  bun scripts/generate-pwa-icons.ts
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_ICONS = resolve(__dirname, '../public/icons')
const KM_SVG_PATH = resolve(__dirname, '../public/logo-kampus-merdeka.svg')

// App theme gradient (matches bg-gradient-primary in globals.css)
const GRAD_STOP_1 = '#0e7490' // teal-700
const GRAD_STOP_2 = '#155e75' // teal-800

// Read the Kampus Merdeka SVG source (viewBox 0 0 120 120)
const kmSvgSource = readFileSync(KM_SVG_PATH, 'utf-8')

/**
 * Build the composite icon SVG: teal gradient background + Kampus Merdeka
 * logo centered in the 80% safe zone.
 *
 * @param size  output canvas size in pixels
 */
function buildIconSvg(size: number): string {
  // Logo occupies ~70% of canvas — well inside the 80% safe zone.
  // KM SVG viewBox is 120×120, so scale = 0.7 * size / 120
  const logoScale = (size * 0.7) / 120
  const logoSize = 120 * logoScale
  const logoOffset = (size - logoSize) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${GRAD_STOP_1}"/>
      <stop offset="100%" stop-color="${GRAD_STOP_2}"/>
    </linearGradient>
  </defs>
  <!-- Full-bleed teal gradient background — required for maskable -->
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <!-- Subtle decorative circles (low opacity, don't compete with logo) -->
  <circle cx="${size * 0.85}" cy="${size * 0.15}" r="${size * 0.35}" fill="#ffffff" opacity="0.04"/>
  <circle cx="${size * 0.12}" cy="${size * 0.88}" r="${size * 0.28}" fill="#ffffff" opacity="0.03"/>
  <!-- Kampus Merdeka logo — centered, inside safe zone -->
  <g transform="translate(${logoOffset} ${logoOffset}) scale(${logoScale})">
    ${kmSvgSource.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1] || ''}
  </g>
</svg>`
}

async function render(svg: string, size: number, file: string) {
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(file)
  console.log('  ✓', file)
}

async function main() {
  await mkdir(PUBLIC_ICONS, { recursive: true })
  console.log('Generating PWA icons (Kampus Merdeka logo on teal bg) in', PUBLIC_ICONS)

  // Canonical icons — single design works as both 'any' and 'maskable'
  await render(buildIconSvg(192), 192, resolve(PUBLIC_ICONS, 'icon-192.png'))
  await render(buildIconSvg(256), 256, resolve(PUBLIC_ICONS, 'icon-256.png'))
  await render(buildIconSvg(512), 512, resolve(PUBLIC_ICONS, 'icon-512.png'))

  // Maskable aliases (same image) for backward compat
  await render(buildIconSvg(192), 192, resolve(PUBLIC_ICONS, 'icon-192-maskable.png'))
  await render(buildIconSvg(512), 512, resolve(PUBLIC_ICONS, 'icon-512-maskable.png'))

  // Apple touch icon (iOS applies its own rounded mask)
  await render(buildIconSvg(180), 180, resolve(PUBLIC_ICONS, 'apple-touch-icon.png'))

  // Favicons
  await render(buildIconSvg(64), 64, resolve(PUBLIC_ICONS, 'favicon-64.png'))
  await render(buildIconSvg(32), 32, resolve(PUBLIC_ICONS, 'favicon-32.png'))
  await render(buildIconSvg(16), 16, resolve(PUBLIC_ICONS, 'favicon-16.png'))

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
