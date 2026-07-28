'use client'

import { useEffect } from 'react'
import { useBranding, fetchBranding } from '@/lib/branding'

/**
 * BrandingProvider — dimuat sekali di root layout.
 * - Trigger fetch pengaturan dari DB saat app mount
 * - Inject/update <link rel="icon"> di <head> berdasarkan favicon_url
 * - Inject/update <link rel="apple-touch-icon"> jika ada
 * - Update document.title dengan nama kampus
 *
 * Komponen ini render null (tidak ada UI), hanya side-effect.
 */

// Validate that a string is a usable image URL.
// Accepts:
//   - http(s) URLs (external/remote logos)
//   - data:image/*;base64,... URLs (admin-uploaded logos stored as base64 in DB)
// Rejects HTML snippets, javascript: URLs, relative paths, or anything that
// would break the favicon/logo display.
function isValidImageUrl(url: string): boolean {
  if (!url) return false
  const s = url.trim()
  if (!s) return false
  // Allow base64 data URLs from admin file upload: data:image/png;base64,...
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(s)) return true
  // Otherwise must be a clean http(s) URL
  return /^https?:\/\/[^\s"'<>\]]+/i.test(s) && !/[<>"']/.test(s)
}

export function BrandingProvider() {
  const branding = useBranding()

  useEffect(() => {
    // Fetch branding on mount
    fetchBranding()
  }, [])

  useEffect(() => {
    // Update favicon — only if URL is valid (prevents broken icon if DB has bad data).
    // IMPORTANT: update ALL <link rel="icon"> and <link rel="shortcut icon"> tags,
    // not just the first one. Next.js metadata.icons can emit multiple <link rel="icon">
    // tags, and browsers are inconsistent about which one they pick. If we only update
    // the first, a stale second tag can keep pointing at the old favicon.
    if (branding.faviconUrl && isValidImageUrl(branding.faviconUrl)) {
      // Determine MIME type — supports both data: URLs (admin upload) and file extensions
      const iconType = branding.faviconUrl.startsWith('data:')
        ? (branding.faviconUrl.match(/^data:image\/([a-z0-9.+-]+)/i)?.[1] ?? '')
        : branding.faviconUrl.match(/\.png$/i)
          ? 'image/png'
          : branding.faviconUrl.match(/\.svg$/i)
            ? 'image/svg+xml'
            : branding.faviconUrl.match(/\.ico$/i)
              ? 'image/x-icon'
              : branding.faviconUrl.match(/\.(jpe?g|webp|gif)$/i)
                ? (branding.faviconUrl.match(/\.jpe?g$/i) ? 'image/jpeg' : branding.faviconUrl.match(/\.webp$/i) ? 'image/webp' : 'image/gif')
                : ''

      // Update every existing icon + shortcut icon link in one pass.
      const existingLinks = document.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="shortcut icon"]',
      )
      existingLinks.forEach((link) => {
        link.href = branding.faviconUrl
        if (iconType) link.type = iconType
      })

      // If nothing existed yet, create one canonical link.
      if (existingLinks.length === 0) {
        const link = document.createElement('link')
        link.rel = 'icon'
        link.href = branding.faviconUrl
        if (iconType) link.type = iconType
        document.head.appendChild(link)
      }
    }

    // Update apple-touch-icon
    if (branding.faviconUrl && isValidImageUrl(branding.faviconUrl)) {
      let appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
      if (!appleLink) {
        appleLink = document.createElement('link')
        appleLink.rel = 'apple-touch-icon'
        document.head.appendChild(appleLink)
      }
      appleLink.href = branding.faviconUrl
    }

    // Update document title
    if (branding.namaKampus) {
      document.title = `SIM KKN & PLP — ${branding.namaKampus}`
    }
  }, [branding.faviconUrl, branding.namaKampus])

  return null
}
