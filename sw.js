// ═══════════════════════════════════════════
// RUSHTOWN POULTRY — SERVICE WORKER v9
// Stale-while-revalidate (cache-first) + FCM background push
// ═══════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBRPjACWaVeHXw4ztydZVB-_MTMwEWfWmY',
  authDomain:        'rushtown-poultry.firebaseapp.com',
  projectId:         'rushtown-poultry',
  storageBucket:     'rushtown-poultry.firebasestorage.app',
  messagingSenderId: '1050651051862',
  appId:             '1:1050651051862:web:c83d671abaec7f4c8378f7'
});

const messaging = firebase.messaging();

// ── Background push → show system notification ──
messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  return self.registration.showNotification(n.title || 'Rushtown Poultry', {
    body:  n.body  || '',
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag:   payload.data?.tag || 'rushtown',
    data:  { url: '/' }
  });
});

// ── Notification tap → open/focus app ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

// ═══════════════════════════════════════════
// CACHE — stale-while-revalidate (fast opens)
// Returns cached asset INSTANTLY, then refreshes
// in the background for the next visit.
// ═══════════════════════════════════════════
const CACHE_NAME = 'rushtown-v56';

const SHELL_FILES = [
  '/',
  '/index.html',
  '/barn.html',
  '/js/core.js',
  '/js/staff-roster.js',
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
  '/js/oncall.js',
  '/js/enhancements.js',
  '/js/notifications.js',
  '/js/contractor.js',
  '/js/cost-dashboard.js',
  '/js/weekly-agenda.js',
  '/js/shift-signoff.js',
  '/js/red-tags.js',
  '/js/director-brief.js',
  '/js/barn-entry.js',
  '/js/daily-checklist.js',
  '/js/daily-report.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Use individual put()s so a single 404 doesn't blow up the install.
      .then(cache => Promise.all(
        SHELL_FILES.map(url =>
          fetch(url, { cache: 'reload' })
            .then(r => r.ok ? cache.put(url, r) : null)
            .catch(() => null)
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then(cs => cs.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME })))
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Stale-while-revalidate: serve cache instantly, refresh in background.
// Skipped entirely for Firestore / Firebase / Google APIs so live data
// never gets a stale read.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('identitytoolkit')
  ) return;

  // Only cache same-origin requests.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(req).then(cached => {
        const networkFetch = fetch(req).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(req, response.clone());
          }
          return response;
        }).catch(() => null);

        // Cache hit → return immediately, refresh in background.
        if (cached) {
          event.waitUntil(networkFetch);
          return cached;
        }
        // No cache → wait for network, fall back to index.html for documents.
        return networkFetch.then(r => {
          if (r) return r;
          if (req.destination === 'document') return cache.match('/index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
    )
  );
});
