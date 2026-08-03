// ═══════════════════════════════════════════════════════════════════════════
// usage.js — 📈 USAGE BOARD, visible ONLY to Joe (v265, per Joe 2026-08-03:
// "add a usage tab into the app for only my login to see, who uses what and
// how often and so on. also monitor how many times people click the chicken
// 3 times for a joke.")
//
// • trackUse(feature) — one Firestore write per event into usageDaily/<date>_<user>
//   using FieldValue.increment on a counts map. Cheap, additive, offline-safe
//   (SDK queues it). Auto-instrumented: every go(tab) + enterApp(area), plus
//   'chicken-joke' from enhancements.js _trigger.
// • A small 📈 chip appears bottom-left ONLY when the signed-in device user is
//   Joe; it opens the full board (last 14 days: by person, by feature, jokes).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var _last = {};   // feature → ts of last write (throttle double-fires)

  function _today() { try { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function _me() { try { return (typeof getDeviceUser === 'function') ? (String(getDeviceUser() || '').trim() || 'shared device') : 'shared device'; } catch (e) { return 'shared device'; } }
  function _slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'; }
  // Owner check — the roster name is "Joseph Schmidt" (empId 1100), not "Joe",
  // so match Joe/Joseph + Schmidt as well as a bare first name (fixed v266).
  function _isJoe() {
    var n = _me().toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!n) return false;
    if (n === 'joe' || n === 'joseph') return true;
    return /^jo/.test(n) && /schmidt/.test(n);
  }

  // ── The counter every module can call ──
  window.trackUse = function (feature) {
    try {
      if (typeof db === 'undefined' || !db || !feature) return;
      var now = Date.now();
      if (_last[feature] && now - _last[feature] < 2000) return;   // debounce double-taps
      _last[feature] = now;
      var user = _me(), date = _today();
      var inc = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
        ? firebase.firestore.FieldValue.increment(1) : 1;
      var counts = {}; counts[String(feature).replace(/[.~/*\[\]]/g, '_')] = inc;
      db.collection('usageDaily').doc(date + '_' + _slug(user))
        .set({ date: date, user: user, ts: now, counts: counts }, { merge: true })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Auto-instrument the app's navigation once everything is loaded ──
  function _wire() {
    try {
      if (typeof window.go === 'function' && !window.go.__usage) {
        var g = window.go;
        window.go = function (tab) { try { window.trackUse('tab: ' + tab); } catch (e) {} return g.apply(this, arguments); };
        window.go.__usage = true;
      }
      if (typeof window.enterApp === 'function' && !window.enterApp.__usage) {
        var ea = window.enterApp;
        window.enterApp = function (area) { try { window.trackUse('area: ' + area); } catch (e) {} return ea.apply(this, arguments); };
        window.enterApp.__usage = true;
      }
    } catch (e) {}
  }
  setTimeout(_wire, 2500);

  // ── Joe-only 📈 chip ──
  function _chip() {
    try {
      var ex = document.getElementById('usage-chip');
      if (!_isJoe()) { if (ex) ex.remove(); return; }
      if (ex) return;
      var b = document.createElement('button');
      b.id = 'usage-chip';
      b.onclick = function () { window.openUsageBoard(); };
      b.style.cssText = 'position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);z-index:940;background:#101d2e;border:1.5px solid #3b82f6;border-radius:50px;color:#9cc0f6;' + MONO + 'font-size:12px;font-weight:700;padding:9px 14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.45);';
      b.textContent = '📈 ' + 'Usage';
      document.body.appendChild(b);
    } catch (e) {}
  }
  setTimeout(_chip, 3500);
  setInterval(_chip, 60000);   // login/logout changes who's on the device

  // ── The board ──
  window.openUsageBoard = function () {
    if (!_isJoe()) { if (typeof toast === 'function') toast('📈 This board is for Joe.'); return; }
    var o = document.getElementById('usage-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'usage-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:960;background:#08101d;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    o.innerHTML = '<div style="max-width:820px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="document.getElementById(\'usage-overlay\').style.display=\'none\'" style="padding:11px 16px;background:#0d1626;border:1.5px solid #2a4a7a;border-radius:50px;color:#9cc0f6;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← Back</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;letter-spacing:2px;line-height:1;color:#e8f0fa;">📈 USAGE — LAST 14 DAYS</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#5a7aaa;margin-top:2px;">Who uses what, how often · only your login sees this</div>' +
        '</div>' +
      '</div>' +
      '<div id="usage-body" style="' + MONO + 'font-size:12px;color:#7a9ac0;">Loading…</div>' +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}

    var d14 = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    db.collection('usageDaily').where('date', '>=', d14).get().then(function (snap) {
      var body = document.getElementById('usage-body'); if (!body) return;
      var rows = []; snap.forEach(function (d) { rows.push(d.data()); });
      if (!rows.length) { body.innerHTML = 'No usage recorded yet — it starts counting the moment v265 is on the tablets.'; return; }
      var byUser = {}, byFeat = {}, byDay = {}, jokesByUser = {}, total = 0;
      rows.forEach(function (r) {
        var u = r.user || '?', c = r.counts || {};
        byDay[r.date] = byDay[r.date] || 0;
        Object.keys(c).forEach(function (f) {
          var n = Number(c[f]) || 0; total += n;
          byUser[u] = (byUser[u] || 0) + n;
          byFeat[f] = (byFeat[f] || 0) + n;
          byDay[r.date] += n;
          if (f === 'chicken-joke') jokesByUser[u] = (jokesByUser[u] || 0) + n;
        });
      });
      function _bars(obj, color, max) {
        var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
        var top = keys.length ? obj[keys[0]] : 1;
        return keys.slice(0, max || 20).map(function (k) {
          var v = obj[k], w = Math.max(3, Math.round(v / top * 100));
          return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
            '<span style="' + MONO + 'font-size:11px;color:#cfe0f0;min-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + k.replace(/</g, '&lt;') + '</span>' +
            '<div style="flex:1;background:#0d1626;border-radius:5px;height:16px;overflow:hidden;"><div style="width:' + w + '%;height:100%;background:' + color + ';"></div></div>' +
            '<b style="' + MONO + 'font-size:11.5px;color:#e8f0fa;min-width:44px;text-align:right;">' + v.toLocaleString() + '</b>' +
          '</div>';
        }).join('');
      }
      var jokeTotal = byFeat['chicken-joke'] || 0;
      var days = Object.keys(byDay).sort();
      var sect = function (title, inner) {
        return '<div style="background:#0d1626;border:1.5px solid #22375a;border-radius:12px;padding:13px 15px;margin-bottom:12px;">' +
          '<div style="' + MONO + 'font-size:10px;font-weight:700;letter-spacing:1px;color:#6a9ae0;text-transform:uppercase;margin-bottom:9px;">' + title + '</div>' + inner + '</div>';
      };
      body.innerHTML =
        sect('Totals', '<div style="' + MONO + 'font-size:12px;color:#cfe0f0;line-height:1.8;">' +
          '<b style="font-size:20px;color:#4ade80;">' + total.toLocaleString() + '</b> actions · ' +
          '<b style="color:#e8f0fa;">' + Object.keys(byUser).length + '</b> people · ' +
          '<b style="color:#e8f0fa;">' + days.length + '</b> days · ' +
          '🐔 <b style="color:#f0d68a;">' + jokeTotal.toLocaleString() + '</b> chicken jokes triggered</div>') +
        sect('🐔 Chicken jokes — who taps the chicken', jokeTotal ? _bars(jokesByUser, '#d6b34a') : '<span style="color:#5a7aaa;">Nobody yet. The crew is being professional. Suspicious.</span>') +
        sect('By person — total actions', _bars(byUser, '#3b82f6')) +
        sect('By feature — what gets used', _bars(byFeat, '#4ade80', 25)) +
        sect('By day', days.map(function (d) {
          var top = Math.max.apply(null, days.map(function (x) { return byDay[x]; }));
          var w = Math.max(3, Math.round(byDay[d] / top * 100));
          return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
            '<span style="' + MONO + 'font-size:10.5px;color:#cfe0f0;min-width:78px;">' + d.slice(5) + '</span>' +
            '<div style="flex:1;background:#101d2e;border-radius:5px;height:13px;overflow:hidden;"><div style="width:' + w + '%;height:100%;background:#8a6dd6;"></div></div>' +
            '<b style="' + MONO + 'font-size:11px;color:#e8f0fa;min-width:44px;text-align:right;">' + byDay[d] + '</b>' +
          '</div>';
        }).join('')) +
        '<div style="' + MONO + 'font-size:9.5px;color:#40567a;line-height:1.6;">Counted: every tab/section open (tab:/area:) + 🐔 3-tap jokes. One count per action, 2s debounce. Nothing is tracked beyond name + what was opened.</div>';
    }).catch(function (e) {
      console.error('usage board:', e);
      var b = document.getElementById('usage-body'); if (b) b.innerHTML = 'Could not load usage.';
    });
  };
})();
