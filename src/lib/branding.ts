'use client'

import { useEffect, useState } from 'react'

/**
 * Branding state — di-cache global (module-level) agar tidak fetch berulang.
 * Dimuat sekali saat aplikasi pertama kali render (lihat BrandingProvider).
 */
export interface Branding {
  logoUrl: string
  faviconUrl: string
  namaKampus: string
  website: string
  emailKampus: string
  noTelepon: string
  alamatKampus: string
}

const DEFAULT_BRANDING: Branding = {
  logoUrl: '',
  faviconUrl: '',
  namaKampus: 'Universitas Nias Raya',
  website: '',
  emailKampus: '',
  noTelepon: '',
  alamatKampus: '',
}

// Module-level cache — seluruh app share instance yang sama
let cachedBranding: Branding = DEFAULT_BRANDING
let fetchPromise: Promise<Branding> | null = null
const listeners = new Set<(b: Branding) => void>()

function notify() {
  listeners.forEach((fn) => fn(cachedBranding))
}

export async function fetchBranding(force = false): Promise<Branding> {
  if (!force && cachedBranding !== DEFAULT_BRANDING) return cachedBranding
  if (!force && fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/pengaturan', { cache: 'no-store' })
      if (!res.ok) return cachedBranding
      const data: Record<string, string> = await res.json()
      cachedBranding = {
        logoUrl: (data.logo_url ?? '').trim(),
        faviconUrl: (data.favicon_url ?? '').trim(),
        namaKampus: (data.nama_kampus ?? '').trim() || 'Universitas Nias Raya',
        website: (data.website ?? '').trim(),
        emailKampus: (data.email_kampus ?? '').trim(),
        noTelepon: (data.no_telepon ?? '').trim(),
        alamatKampus: (data.alamat_kampus ?? '').trim(),
      }
      notify()
      return cachedBranding
    } catch {
      return cachedBranding
    } finally {
      fetchPromise = null
    }
  })()
  return fetchPromise
}

/** Hook React untuk akses branding secara reaktif. */
export function useBranding(): Branding {
  // Inisialisasi dari cache (sinkron, tanpa effect)
  const [branding, setBranding] = useState<Branding>(() => cachedBranding)

  useEffect(() => {
    // Subscribe ke perubahan branding
    listeners.add(setBranding)
    // Trigger fetch di background jika belum pernah di-load
    if (cachedBranding === DEFAULT_BRANDING) {
      fetchBranding()
    }
    return () => {
      listeners.delete(setBranding)
    }
  }, [])

  return branding
}

/** Refresh branding setelah admin update pengaturan. */
export function refreshBranding() {
  return fetchBranding(true)
}
