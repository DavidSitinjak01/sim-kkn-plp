'use client'

import { useEffect } from 'react'

/**
 * ChunkErrorRecovery
 *
 * Next.js 16 + Turbopack (dev) regenerates chunk hashes on every recompile.
 * If the browser holds a stale chunk manifest (e.g. after HMR, after the dev
 * server restarted, or after the preview iframe was cached), it requests a
 * chunk hash that no longer exists on disk → `ChunkLoadError` → blank page
 * with no way for the user to recover except a hard refresh.
 *
 * This component installs a global listener that:
 *   1. Detects ChunkLoadError (and similar dynamic-import failures) on both
 *      `window.error` and `unhandledrejection`.
 *   2. Reloads the page exactly ONCE per session via `sessionStorage` guard
 *      to prevent infinite reload loops in case the chunk is genuinely broken.
 *   3. Falls back to redirecting to `/` if a reload already happened, so the
 *      user always lands on a working page instead of a dead one.
 *
 * This is a defensive, dev-only safeguard. In production (Vercel) chunks are
 * immutable and content-hashed, so ChunkLoadError almost never happens there.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const RELOAD_KEY = '__chunk_error_reloaded__'
    const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1'

    const isChunkError = (message: string): boolean => {
      const m = (message || '').toLowerCase()
      return (
        m.includes('chunkloaderror') ||
        m.includes('loading chunk') ||
        m.includes('loading css chunk') ||
        m.includes('failed to fetch dynamically imported module') ||
        m.includes('importing a module script failed')
      )
    }

    const handleChunkError = (rawMessage: string) => {
      if (!isChunkError(rawMessage)) return

      // Surface a brief toast-like console message for debugging.
      console.warn('[ChunkErrorRecovery] ChunkLoadError detected. Reloading to recover...')

      if (!alreadyReloaded) {
        // Mark that we've attempted a recovery reload so we don't loop.
        sessionStorage.setItem(RELOAD_KEY, '1')
        // Hard reload to bypass HTTP cache and fetch fresh chunk manifest.
        window.location.reload()
      } else {
        // Already reloaded once and still failing — clear the flag and send
        // the user home so they don't stare at a dead page.
        sessionStorage.removeItem(RELOAD_KEY)
        if (window.location.pathname !== '/') {
          window.location.href = '/'
        }
      }
    }

    const onError = (e: ErrorEvent) => {
      const msg = e?.message || (e?.error?.message ?? '')
      handleChunkError(msg)
    }

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e?.reason
      const msg =
        typeof reason === 'string'
          ? reason
          : reason?.message || reason?.name || ''
      handleChunkError(msg)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    // Clear the reload flag once the page has been stable for a few seconds,
    // so a future genuine chunk failure can still trigger a single recovery.
    const clearTimer = window.setTimeout(() => {
      sessionStorage.removeItem(RELOAD_KEY)
    }, 5000)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.clearTimeout(clearTimer)
    }
  }, [])

  return null
}
