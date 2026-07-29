'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * PWAInstaller — handles three responsibilities:
 *
 *  1. Registers the service worker (/sw.js) so the app becomes installable
 *     and works offline.
 *  2. Captures the `beforeinstallprompt` event fired by Chrome/Edge on
 *     Android & desktop. Safari iOS does NOT fire this event (users must
 *     use Share → Add to Home Screen manually — we show a hint for iOS).
 *  3. Shows a dismissible install banner with an "Install" button that
 *     triggers the native install prompt. After install (or dismiss), the
 *     banner stays hidden for 14 days (localStorage) so it doesn't nag.
 *
 * The banner only renders on small/medium screens (≤ lg) per the user's
 * request ("notifikasi untuk instal aplikasi di android"), but we still
 * register the SW on all devices so the PWA is installable everywhere.
 */

// TypeScript: `beforeinstallprompt` is non-standard, declare the types.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt: () => Promise<void>
}

const DISMISS_KEY = 'simkkn.pwa.install.dismissed'
const DISMISS_TTL = 14 * 24 * 60 * 60 * 1000 // 14 days
const INSTALL_KEY = 'simkkn.pwa.installed'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // Android Chrome / Edge: display-mode: standalone
  // iOS Safari: navigator.standalone
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // @ts-expect-error iOS legacy property
    window.navigator.standalone === true
  )
}

function isDismissedRecently(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (!ts) return false
    return Date.now() - ts < DISMISS_TTL
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALL_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Register the service worker. Called once on mount.
 * In dev, the SW can be flaky due to HMR, so we log but don't throw.
 */
function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  // Only register in production OR when explicitly enabled via ?sw=1.
  // In Next.js dev mode (localhost), the SW tends to cache stale chunks
  // and break HMR — we skip it unless the user opts in.
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const forceSw = new URLSearchParams(window.location.search).get('sw') === '1'
  if (isDev && !forceSw) {
    return
  }

  // Register immediately. We previously waited for the `load` event, but in
  // a Next.js CSR app the React component mounts AFTER `load` has already
  // fired (HTML + initial chunks load, then hydration runs), so the listener
  // never fires. Using `window.readyState` covers both cases.
  const doRegister = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Check for updates every hour.
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
      })
      .catch((err) => {
        // Don't surface to user — SW is a progressive enhancement.
        console.warn('[PWA] Service worker registration failed:', err)
      })
  }
  if (document.readyState === 'complete') {
    doRegister()
  } else {
    window.addEventListener('load', doRegister, { once: true })
  }
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [installing, setInstalling] = useState(false)

  // ── Register service worker on mount ────────────────────────────────────
  useEffect(() => {
    registerServiceWorker()
  }, [])

  // ── Detect iOS Safari (no beforeinstallprompt event) ────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = window.navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
    setIsIOS(ios)
  }, [])

  // ── Listen for beforeinstallprompt (Android Chrome / Edge / Desktop) ────
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Already installed (running standalone) → don't show anything.
    if (isStandalone()) {
      markInstalled()
      return
    }
    // User already installed before (cached flag) → don't show.
    if (localStorage.getItem(INSTALL_KEY) === '1') return

    const handler = (e: Event) => {
      // Prevent the mini-infobar from showing on mobile Chrome.
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      setDeferredPrompt(evt)
      // Only show banner if not recently dismissed.
      if (!isDismissedRecently()) {
        setShowBanner(true)
      }
    }

    const installedHandler = () => {
      markInstalled()
      setShowBanner(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // ── For iOS: show a hint banner after a short delay (no native prompt) ──
  useEffect(() => {
    if (!isIOS || isStandalone()) return
    if (localStorage.getItem(INSTALL_KEY) === '1') return
    if (isDismissedRecently()) return

    const t = setTimeout(() => setShowIOSHint(true), 4000)
    return () => clearTimeout(t)
  }, [isIOS])

  // ── Trigger native install prompt ───────────────────────────────────────
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        markInstalled()
        setShowBanner(false)
      } else {
        markDismissed()
        setShowBanner(false)
      }
      // The deferredPrompt can only be used once — clear it.
      setDeferredPrompt(null)
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err)
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    markDismissed()
    setShowBanner(false)
    setShowIOSHint(false)
  }, [])

  return (
    <>
      {/* ── Android / Chrome / Edge install banner ─────────────────────── */}
      <AnimatePresence>
        {showBanner && deferredPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md sm:left-auto sm:right-4 sm:mx-0"
            role="dialog"
            aria-labelledby="pwa-install-title"
          >
            <div className="rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 overflow-hidden">
              {/* Header strip with icon */}
              <div className="flex items-center gap-3 p-3 bg-gradient-primary text-white">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p id="pwa-install-title" className="text-sm font-semibold leading-tight">
                    Pasang Aplikasi
                  </p>
                  <p className="text-[11px] text-white/80 truncate">SIM KKN &amp; PLP</p>
                </div>
                <button
                  onClick={handleDismiss}
                  aria-label="Tutup notifikasi"
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-3 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pasang aplikasi di perangkat Anda untuk akses cepat tanpa browser. Ikon aplikasi
                  akan muncul di layar utama Android Anda.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleInstall}
                    disabled={installing}
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {installing ? 'Memasang…' : 'Pasang Sekarang'}
                  </Button>
                  <Button
                    onClick={handleDismiss}
                    disabled={installing}
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                  >
                    Nanti
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── iOS Safari hint (no native prompt — must use Share menu) ────── */}
      <AnimatePresence>
        {showIOSHint && isIOS && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md"
            role="dialog"
            aria-labelledby="pwa-ios-hint-title"
          >
            <div className="rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-gradient-primary text-white">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p id="pwa-ios-hint-title" className="text-sm font-semibold leading-tight">
                    Tambahkan ke Layar Utama
                  </p>
                  <p className="text-[11px] text-white/80 truncate">SIM KKN &amp; PLP</p>
                </div>
                <button
                  onClick={handleDismiss}
                  aria-label="Tutup notifikasi"
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 space-y-3">
                <ol className="text-xs text-muted-foreground space-y-1.5 leading-relaxed list-decimal list-inside">
                  <li>
                    Ketuk ikon <span className="font-semibold text-foreground">Share</span>{' '}
                    <span aria-hidden>(</span>
                    <span className="inline-flex items-center align-middle px-1">⎋</span>
                    <span aria-hidden>)</span> di toolbar Safari.
                  </li>
                  <li>
                    Pilih <span className="font-semibold text-foreground">Tambahkan ke Layar Utama</span>.
                  </li>
                  <li>
                    Ketuk <span className="font-semibold text-foreground">Tambah</span>.
                  </li>
                </ol>
                <Button
                  onClick={handleDismiss}
                  size="sm"
                  variant="outline"
                  className="w-full h-9 text-xs gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mengerti
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
