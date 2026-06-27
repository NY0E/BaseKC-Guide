// ============================================================
// BaseKC Guidebook Service Worker
// Strategy: Network-first for HTML, cache-first for assets
// Updates activate immediately on next open
// Bump CACHE_VERSION any time you update the guidebook
// ============================================================

const CACHE_VERSION = 'v2';
const CACHE_NAME = `guidebook-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
];

// ---- Install: cache core assets ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  // Activate immediately — don't wait for old SW to be released
  self.skipWaiting();
});

// ---- Activate: delete old caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately
  event.waitUntil(clients.claim());
});

// ---- Fetch: network-first for HTML, cache-first for everything else ----
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Network-first for HTML (always try to get the latest guidebook)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Network failed — fall back to cache
          return caches.match(request).then(cached => {
            return cached || new Response(
              '<h1>You are offline</h1><p>Please reconnect to see the latest guidebook.</p>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        })
    );
    return;
  }

  // Cache-first for fonts, images, scripts, styles
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
