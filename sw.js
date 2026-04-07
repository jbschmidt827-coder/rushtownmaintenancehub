// ═══════════════════════════════════════════
// RUSHTOWN POULTRY — SERVICE WORKER
// Enables "Add to Home Screen" / PWA install
// and caches the app shell for fast loads
// ═══════════════════════════════════════════

const CACHE_NAME = 'rushtown-v1';

// Files to cache for offline / fast load
const SHELL_FILES = [
  '/',
  '/index.html',
  '/js/core.js',
  '/js/dashboard.js',
  '/js/maintenance.js',
  '/js/production.js',
  '/js/egg-quality.js',
  '/js/feed-mill.js',
  '/js/packaging.js',
  '/js/shipping.js',
  '/js/scheduling.js',
  '/js/biosecurity.js',
  '/js/tv-scoreboard.js',
  '/js/staff.js',
  '/js/enhancements.js',
  '/manifest.json'
];

// ── Install: cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_FILES);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for Firebase, cache-first for app shell ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network-first for Firebase (live data)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com')) {
    return; // let browser handle it normally
  }

  // Cache-first for app shell files
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache fresh copies of shell files
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If offline and not cached, return a simple offline page
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
