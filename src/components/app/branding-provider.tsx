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
export function BrandingProvider() {
  const branding = useBranding()

  useEffect(() => {
    // Fetch branding on mount
    fetchBranding()
  }, [])

  useEffect(() => {
    // Update favicon
    if (branding.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = branding.faviconUrl
      // Hint type untuk PNG
      if (branding.faviconUrl.match(/\.png$/i)) link.type = 'image/png'
      else if (branding.faviconUrl.match(/\.svg$/i)) link.type = 'image/svg+xml'
      else if (branding.faviconUrl.match(/\.(ico|jpg|jpeg|webp)$/i)) link.type = ''
    }

    // Update apple-touch-icon
    if (branding.faviconUrl) {
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
