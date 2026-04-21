// ═══════════════════════════════════════════
// RUSHTOWN POULTRY — IN-APP NOTIFICATIONS
// Bell icon + FCM push registration
// ═══════════════════════════════════════════

// ── VAPID key ──
// Generate once at: Firebase Console → Project Settings
//   → Cloud Messaging → Web Push certificates → Generate key pair
// Paste the key string below:
const VAPID_KEY = 'BOWvCMW927PI2vndQLJozUhrGbI0sqqFQ3lAvpXlJmZZzbx99oZOqei7Y442lf5WyOVLjNbRdlgboSfNFu8wIt4';

let _notifUnsub   = null;
let _panelOpen    = false;
let _notifDocs    = [];

// ── Boot: called from core.js after Firebase init ──
function initNotifications() {
  if (!firebase.messaging || !firebase.messaging.isSupported()) return;

  const messaging = firebase.messaging();

  // Ask for permission + save token
  Notification.requestPermission().then(perm => {
    if (perm !== 'granted') return;
    messaging.getToken({ vapidKey: VAPID_KEY }).then(token => {
      if (!token) return;
      db.collection('fcmTokens').doc(token).set({
        token,
        ts: Date.now(),
        ua: navigator.userAgent.slice(0, 120)
      }).catch(() => {});
    }).catch(err => console.warn('FCM token error:', err));
  });

  // Foreground message → toast + update bell
  messaging.onMessage(payload => {
    const n = payload.notification || {};
    _showToast(n.title || 'Rushtown Poultry', n.body || '');
  });

  // Subscribe to Firestore notifications collection
  _listenToNotifications();
}

// ── Firestore listener ──
function _listenToNotifications() {
  if (_notifUnsub) _notifUnsub();
  _notifUnsub = db.collection('notifications')
    .orderBy('ts', 'desc').limit(40)
    .onSnapshot(snap => {
      _notifDocs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      _updateBadge();
      if (_panelOpen) _renderList();
    }, () => {});
}

// ── Badge count ──
function _updateBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const count = _notifDocs.filter(d => !d.read).length;
  badge.textContent = count > 9 ? '9+' : String(count || '');
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// ── Toggle panel ──
function toggleNotifPanel() {
  _panelOpen = !_panelOpen;
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  panel.style.display = _panelOpen ? 'block' : 'none';
  if (_panelOpen) {
    _renderList();
    _markAllRead();
  }
}

// Close panel when clicking outside
document.addEventListener('click', e => {
  if (!_panelOpen) return;
  const btn  = document.getElementById('notif-bell-btn');
  const panel = document.getElementById('notif-panel');
  if (btn && btn.contains(e.target)) return;
  if (panel && panel.contains(e.target)) return;
  _panelOpen = false;
  if (panel) panel.style.display = 'none';
});

// ── Mark all read ──
function _markAllRead() {
  const unread = _notifDocs.filter(d => !d.read);
  if (!unread.length) return;
  const batch = db.batch();
  unread.forEach(d => batch.update(db.collection('notifications').doc(d._id), { read: true }));
  batch.commit().catch(() => {});
  // Optimistic local update
  _notifDocs.forEach(d => d.read = true);
  _updateBadge();
}

// ── Render notification list ──
function _renderList() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (!_notifDocs.length) {
    list.innerHTML = `<div style="padding:24px 16px;text-align:center;color:#5a8a5a;font-size:13px;font-family:'IBM Plex Mono',monospace;">
      No notifications yet
    </div>`;
    return;
  }

  const icons = { pm:'⚙️', wo:'🔧', barnwalk:'🐓', parts:'📦', pm_overdue:'⚠️' };

  list.innerHTML = _notifDocs.map(d => {
    const icon = icons[d.type] || '🔔';
    const unread = !d.read;
    const ts = d.ts ? new Date(d.ts).toLocaleString('en-US', {
      month:'short', day:'numeric', hour:'numeric', minute:'2-digit'
    }) : '';
    return `
      <div style="padding:12px 14px;border-bottom:1px solid #1a3a1a;
        background:${unread ? '#0a2a0a' : 'transparent'};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:700;color:#f0ead8;margin-bottom:3px;">
              ${icon} ${d.title || ''}
              ${unread ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#4caf50;margin-left:6px;vertical-align:middle;"></span>' : ''}
            </div>
            <div style="font-size:11px;color:#a0c8a0;line-height:1.45;">${d.body || ''}</div>
          </div>
        </div>
        <div style="font-size:10px;color:#4a7a4a;margin-top:5px;font-family:'IBM Plex Mono',monospace;">${ts}</div>
      </div>`;
  }).join('');
}

// ── In-app toast for foreground pushes ──
function _showToast(title, body) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed;top:68px;right:14px;z-index:9999;',
    'background:#1a3a1a;border:1.5px solid #4caf50;border-radius:12px;',
    'padding:12px 16px;max-width:300px;box-shadow:0 4px 24px rgba(0,0,0,.6);',
    'font-family:\'IBM Plex Sans\',sans-serif;',
    'animation:notif-slide-in .25s ease;'
  ].join('');
  el.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:#f0ead8;margin-bottom:4px;">🔔 ${title}</div>
    <div style="font-size:12px;color:#a0c8a0;line-height:1.4;">${body}</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
