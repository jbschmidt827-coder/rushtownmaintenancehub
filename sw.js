// ═══════════════════════════════════════════
// RUSHTOWN POULTRY — SERVICE WORKER v7
// Network-first strategy: users always get
// the latest version when online.
// Falls back to cache when offline.
// ═══════════════════════════════════════════

const CACHE_NAME = 'rushtown-v9';

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

// ── Install: pre-cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())   // activate immediately, don't wait
  );
});

// ── Activate: wipe old caches, take control ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Tell every open tab that a new version just took over
        return self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      })
      .then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME }));
      })
  );
});

// ── Message: page can ask waiting SW to take over ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch: NETWORK-FIRST ──
// Always try the network so updates are seen immediately.
// Only fall back to cache when offline.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Pass Firebase / Google API calls straight through (live data, no cache)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Stash a fresh copy in cache for offline use
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Last resort: serve index.html for navigation requests
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
