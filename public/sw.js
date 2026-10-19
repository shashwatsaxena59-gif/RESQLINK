/**
 * ResQLink Service Worker — PWA App Shell Caching & Background Sync
 * Safe versioning, zero sensitive API caching, and offline recovery.
 */

const CACHE_VERSION = 'resqlink-v1.0.0';
const STATIC_CACHE_NAME = `resqlink-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `resqlink-dynamic-${CACHE_VERSION}`;

// Application shell assets to precache during service worker installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.svg',
  '/icons/apple-touch-icon.png',
];

// Sensitive endpoints that MUST NEVER be stored in shared browser caches
const SENSITIVE_URL_PATTERNS = [
  '/api/auth',
  '/api/sync',
  '/api/rescue-tasks',
  '/api/shelters',
  '/api/volunteers',
  '/api/confidential',
  '/api/medical',
  '/supabase/',
];

function isSensitiveUrl(url) {
  const urlString = url.toString();
  return SENSITIVE_URL_PATTERNS.some((pattern) => urlString.includes(pattern));
}

// ── Install Event ─────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(async (cache) => {
      // Robust precaching: catch individual failures so install doesn't break
      await Promise.all(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[SW] Precache failed for ${asset}:`, err);
          })
        )
      );
      return self.skipWaiting();
    })
  );
});

// ── Activate Event: Safe Cache Eviction ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      const allowedCaches = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
      await Promise.all(
        cacheNames
          .filter((name) => !allowedCaches.includes(name))
          .map((obsoleteName) => {
            console.log(`[SW] Evicting outdated cache: ${obsoleteName}`);
            return caches.delete(obsoleteName);
          })
      );
      return self.clients.claim();
    })
  );
});

// ── Fetch Event: Intelligent Strategy ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache non-GET requests (POST, PUT, DELETE mutations go through sync engine)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Strict invariant: NEVER cache sensitive user-specific or operational API endpoints
  if (isSensitiveUrl(url)) {
    return; // Pass directly to network
  }

  // 3. Navigation requests (HTML documents): Network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback: reopen previously cached index.html
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return caches.match('/');
        })
    );
    return;
  }

  // 4. Static assets (JS, CSS, fonts, SVG/PNG icons, GeoJSON): Cache-first with background revalidation
  const isStaticAsset =
    url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|ico|json)$/) ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate: fetch in background to update cache for next time
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            })
            .catch(() => {
              // Ignore background update failures when offline
            });
          return cachedResponse;
        }

        // Cache miss: fetch from network and store in dynamic cache
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Asset unreachable and not cached
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
          });
      })
    );
    return;
  }

  // Default: Network fetch with catch
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── Background Sync API Handler ───────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'resqlink-sync') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: 'RESQLINK_BACKGROUND_SYNC',
            timestamp: new Date().toISOString(),
          });
        }
      })
    );
  }
});

// ── Message Event ─────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
