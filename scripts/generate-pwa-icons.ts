/**
 * Generate PWA icons using the official Universitas Nias Raya logo.
 *
 * Design:
 *   - Solid white background (maximizes logo contrast & legibility on Android)
 *   - University logo (circular badge, 300×300 source PNG) centered at ~80%
 *     of canvas — fills the safe zone edge-to-edge for maximum visibility
 *
 * The logo is a detailed circular emblem (orange/red with rice plant symbol
 * + "UNIVERSITAS NIAS RAYA" text), so we use a white background rather than
 * the teal gradient to avoid color clash and keep the logo recognizable.
 *
 * Outputs (in /public/icons/):
 *   - icon-192.png, icon-256.png, icon-512.png (any maskable)
 *   - apple-touch-icon.png (180×180)
 *   - favicon-64/32/16.png
 *
 * Run:  bun scripts/generate-pwa-icons.ts
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_ICONS = resolve(__dirname, '../public/icons')
const LOGO_PATH = resolve(__dirname, '../public/logo-universitas-nias-raya.png')

async function buildIconBuffer(size: number): Promise<Buffer> {
  // Logo fills ~80% of canvas — the full safe zone — for maximum
  // legibility of the detailed emblem at small icon sizes.
  const logoSize = Math.round(size * 0.8)
  const logoOffset = Math.round((size - logoSize) / 2)

  // Resize the source logo to the target size (fit: contain keeps aspect
  // ratio; the source is square 300×300 so no distortion).
  const logoResized = await sharp(LOGO_PATH)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  // Composite logo on solid white background.
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }, // white
    },
  })
    .composite([{ input: logoResized, left: logoOffset, top: logoOffset }])
    .png({ compressionLevel: 9, quality: 90 })
    .toBuffer()
}

async function render(size: number, file: string) {
  const buf = await buildIconBuffer(size)
  await sharp(buf).toFile(file)
  console.log('  ✓', file)
}

async function main() {
  await mkdir(PUBLIC_ICONS, { recursive: true })
  console.log('Generating PWA icons (Universitas Nias Raya logo) in', PUBLIC_ICONS)

  // Canonical icons — single design works as both 'any' and 'maskable'
  await render(192, resolve(PUBLIC_ICONS, 'icon-192.png'))
  await render(256, resolve(PUBLIC_ICONS, 'icon-256.png'))
  await render(512, resolve(PUBLIC_ICONS, 'icon-512.png'))

  // Maskable aliases (same image)
  await render(192, resolve(PUBLIC_ICONS, 'icon-192-maskable.png'))
  await render(512, resolve(PUBLIC_ICONS, 'icon-512-maskable.png'))

  // Apple touch icon (iOS applies its own rounded mask)
  await render(180, resolve(PUBLIC_ICONS, 'apple-touch-icon.png'))

  // Favicons
  await render(64, resolve(PUBLIC_ICONS, 'favicon-64.png'))
  await render(32, resolve(PUBLIC_ICONS, 'favicon-32.png'))
  await render(16, resolve(PUBLIC_ICONS, 'favicon-16.png'))

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
