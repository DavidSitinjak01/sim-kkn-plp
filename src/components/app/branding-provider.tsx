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

// Validate that a string is a usable http(s) URL.
// Rejects HTML snippets, javascript: URLs, data: URLs (except small SVG),
// relative paths, or anything that would break the favicon/logo display.
function isValidImageUrl(url: string): boolean {
  if (!url) return false
  const s = url.trim()
  if (!s) return false
  // Must start with http:// or https:// (external image) — reject everything else
  // (relative paths won't work for user-uploaded external logos, and javascript:/data:
  // URLs are security risks in a favicon context)
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
      const iconType = branding.faviconUrl.match(/\.png$/i)
        ? 'image/png'
        : branding.faviconUrl.match(/\.svg$/i)
          ? 'image/svg+xml'
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
