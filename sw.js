// ═══════════════════════════════════════════
// RUSHTOWN POULTRY — SERVICE WORKER v8
// Network-first + FCM background push
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
// CACHE — network-first, fall back offline
// ═══════════════════════════════════════════
const CACHE_NAME = 'rushtown-v24';

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
  '/js/oncall.js',
  '/js/enhancements.js',
  '/js/notifications.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
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

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.destination === 'document') return caches.match('/index.html');
        })
      )
  );
});
