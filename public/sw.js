/**
 * Service Worker — SIM KKN & PLP
 *
 * Strategy:
 *  - Precache: app shell (/, /manifest.json, icons).
 *  - Runtime caching:
 *      • Static assets (_next/static, icons, images): CacheFirst, stale-while-revalidate
 *      • API GET requests: NetworkFirst with cache fallback (short TTL)
 *      • Navigation requests: NetworkFirst, fallback to cached "/" (offline shell)
 *
 * Versioned via SW_CACHE_VERSION — bump to invalidate old caches.
 */

const SW_CACHE_VERSION = 'v1.2.0'
const STATIC_CACHE = `simkkn-static-${SW_CACHE_VERSION}`
const RUNTIME_CACHE = `simkkn-runtime-${SW_CACHE_VERSION}`
const API_CACHE = `simkkn-api-${SW_CACHE_VERSION}`

// Resources to precache on install (app shell).
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/favicon.png',
]

// Maximum number of entries in the runtime cache (LRU eviction).
const RUNTIME_CACHE_MAX = 60
const API_CACHE_MAX = 40

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      // Use addAll but ignore individual failures (some assets may 404 in dev).
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            // Don't cache the root HTML in dev — it changes too often.
            // In production this is the app shell.
            const res = await fetch(url, { cache: 'no-cache' })
            if (res && res.ok) {
              await cache.put(url, res.clone())
            }
          } catch {
            /* ignore — asset unavailable */
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('simkkn-') &&
              key !== STATIC_CACHE &&
              key !== RUNTIME_CACHE &&
              key !== API_CACHE,
          )
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

// Helper: limit cache size (LRU-ish — evict oldest entries).
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxItems) {
    // Delete oldest entries (first inserted).
    await Promise.all(keys.slice(0, keys.length - maxItems).map((k) => cache.delete(k)))
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET requests.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip cross-origin requests (e.g. external logos, Google Fonts).
  if (url.origin !== self.location.origin) return

  // Skip Next.js HMR / dev-only endpoints.
  if (url.pathname.startsWith('/_next/webpack-hmr')) return
  if (url.pathname.includes('hot-update')) return

  // Skip non-http(s) schemes (chrome-extension:, data:, etc.)
  if (!url.protocol.startsWith('http')) return

  // ── Navigation requests (HTML pages) ────────────────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first — always serve fresh HTML when online.
          const fresh = await fetch(request)
          // Cache a copy of the latest HTML.
          const cache = await caches.open(RUNTIME_CACHE)
          cache.put('/', fresh.clone()).catch(() => {})
          return fresh
        } catch {
          // Offline: fall back to cached root shell.
          const cache = await caches.open(STATIC_CACHE)
          const cached = (await cache.match('/')) || (await caches.match('/'))
          if (cached) return cached
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
              '<body style="font-family:system-ui;padding:2rem;text-align:center">' +
              '<h2>Anda sedang offline</h2>' +
              '<p>Aplikasi SIM KKN &amp; PLP tidak dapat dimuat tanpa koneksi internet. ' +
              'Silakan periksa koneksi Anda dan coba lagi.</p></body>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          )
        }
      })(),
    )
    return
  }

  // ── API requests ────────────────────────────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          // Only cache successful GET responses.
          if (fresh && fresh.ok && fresh.status === 200) {
            const cache = await caches.open(API_CACHE)
            cache.put(request, fresh.clone()).catch(() => {})
            await trimCache(API_CACHE, API_CACHE_MAX)
          }
          return fresh
        } catch {
          // Offline: try cached API response.
          const cache = await caches.open(API_CACHE)
          const cached = await cache.match(request)
          if (cached) return cached
          return new Response(
            JSON.stringify({ error: 'offline', message: 'Tidak ada koneksi internet.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          )
        }
      })(),
    )
    return
  }

  // ── Static assets (Next.js chunks, images, icons, fonts) ────────────────
  // Strategy: stale-while-revalidate — fast from cache, update in background.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|css|js)$/i)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE)
        const cached = await cache.match(request)
        const networkFetch = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              cache.put(request, res.clone()).catch(() => {})
              trimCache(RUNTIME_CACHE, RUNTIME_CACHE_MAX)
            }
            return res
          })
          .catch(() => null)
        // Return cached immediately if available, else wait for network.
        return cached || (await networkFetch) || Response.error()
      })(),
    )
    return
  }

  // Default: try network, fall back to cache.
  event.respondWith(
    (async () => {
      try {
        return await fetch(request)
      } catch {
        const cache = await caches.open(RUNTIME_CACHE)
        const cached = await cache.match(request)
        return cached || Response.error()
      }
    })(),
  )
})

// Allow the page to trigger immediate activation (skipWaiting).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
