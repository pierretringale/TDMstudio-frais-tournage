// === SERVICE WORKER — PWA Galactus ===
// Trigger    : enregistré par index.html via navigator.serviceWorker.register()
// Étapes     : install → cache shell · activate → purge anciens caches · fetch → strategy par type
// Contraintes: pas d'interception POST/PUT/DELETE (Supabase mutations), pas de cache des credentials
// Cas limites: offline → toast Alpine "fonctionnalités limitées" + fallback HTML cached

const CACHE_VERSION = 'galactus-v2-sprint2';

// Shell statique à cacher au install (assets locaux + fonts).
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/galactus.css',
  './js/app.js',
  './js/supabase.js',
  './js/utils.js',
  './js/ingestion.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'
];

// === INSTALL ===
self.addEventListener('install', (event) => {
  console.log('[SW] Install', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // addAll est atomique : si un fichier échoue, tout le cache l'est. On force individual put pour resilience.
      return Promise.all(
        SHELL_ASSETS.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => {
              if (res.ok) return cache.put(url, res);
              console.warn('[SW] Skip cache', url, res.status);
            })
            .catch((err) => console.warn('[SW] Skip cache (fetch error)', url, err.message))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// === ACTIVATE — purge anciens caches ===
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => {
          console.log('[SW] Purge old cache', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// === FETCH — strategy par type ===
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ne jamais intercepter les mutations
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase API + Auth + Storage : network-first (data toujours fraîche), pas de cache
  if (url.hostname.endsWith('.supabase.co')) {
    event.respondWith(
      fetch(req).catch(() => new Response('{"error":"offline"}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // CDN Tailwind/Alpine/Supabase-js/Fonts : cache-first (lourd, stable)
  if (
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Shell local : cache-first avec network fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && req.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Offline fallback HTML : renvoyer l'index si on demande du HTML
        if (req.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
