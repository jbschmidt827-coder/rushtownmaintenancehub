// ═══════════════════════════════════════════════════════════════════════════
// today.js — "Today" home strip: what's left + needs attention, per site. EN/ES
// Renders into #today-panel at the top of the location home. Shows the daily
// checks still missing (Morning Walk / Daily Check / Manure), open urgent work
// orders, and overdue PMs — each tappable. "✅ All caught up" when clear.
// Read-only; pulls today's checks on each home open. Scoped via getPreferredFarm.
// ═══════════════════════════════════════════════════════════════════════════
function _tdlang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
function tdL(en, es) { return _tdlang() === 'es' ? es : en; }

const TD_HOUSES = { Hegins: [1, 2, 3, 4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
function _tdHnum(h) { var m = String(h).match(/\d+/); return m ? m[0] : String(h); }
function _tdManApplies(farm, h) { var hs = (typeof MANURE_HOUSES !== 'undefined' && MANURE_HOUSES[farm]) ? MANURE_HOUSES[farm] : []; return hs.indexOf(Number(h)) !== -1; }
function _tdLayerFarms() {
  var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  if (f === 'Hegins' || f === 'Danville') return [f];
  if (!f) return ['Hegins', 'Danville']; // Master = both layer sites
  return []; // Processing Plant — no daily-check houses
}

// ── LIVE SYNC (v165) ────────────────────────────────────────────────────────
// One set of Firestore listeners on TODAY's three check collections. The
// moment ANYONE submits on ANY device, every visible view refreshes:
// Today panel, Completion grid, Daily Check barn grid, landing badges.
// Also hydrates BARN_STATUS from Firestore so the barn grid is accurate
// across devices (it used to be device-local — a house submitted on one
// iPad stayed "pending" on all the others).
var _tdLiveDate = null, _tdLiveUnsubs = [], _tdKickTimer = null;

function _tdArmLive() {
  try {
    if (typeof db === 'undefined' || !db) return;
    var today = new Date().toISOString().slice(0, 10);
    if (_tdLiveDate === today) return;                    // already armed
    _tdLiveUnsubs.forEach(function (u) { try { u(); } catch (e) {} });
    _tdLiveUnsubs = [];
    _tdLiveDate = today;
    ['morningWalks', 'barnWalks', 'manureSubmit', 'bwProgress'].forEach(function (coll) {
      try {
        var u = db.collection(coll).where('date', '==', today).onSnapshot(function (snap) {
          // Cross-device status: mirror today's submits into the shared maps
          // (BARN_STATUS / MORNING_STATUS / BARN_PROGRESS) that drive the
          // grids and KPI tiles on every device.
          try {
            if (coll === 'bwProgress') {
              // Live in-progress % + section detail — fills the barn grid
              // and the "in progress right now" strip as the crew works.
              window.BW_PROG_DETAIL = window.BW_PROG_DETAIL || {};
              snap.forEach(function (d) {
                var x = d.data() || {};
                if (x.farm && x.house != null && typeof x.pct === 'number') {
                  var k = x.farm + '-' + _tdHnum(x.house);
                  if (typeof BARN_PROGRESS !== 'undefined') BARN_PROGRESS[k] = x.pct;
                  window.BW_PROG_DETAIL[k] = { pct: x.pct, blocks: x.blocks || [], by: x.by || '', ts: x.ts || 0 };
                }
              });
            } else {
              var map = (coll === 'barnWalks' && typeof BARN_STATUS !== 'undefined') ? BARN_STATUS
                      : (coll === 'morningWalks' && typeof MORNING_STATUS !== 'undefined') ? MORNING_STATUS
                      : null;
              if (map) {
                snap.forEach(function (d) {
                  var x = d.data() || {};
                  if (x.farm && x.house != null) {
                    map[x.farm + '-' + _tdHnum(x.house)] =
                      (x.flags && x.flags.length > 0) ? 'issue' : 'done';
                  }
                });
              }
            }
          } catch (e) {}
          _tdLiveKick();
        }, function () { /* listener error → next arm retries */ _tdLiveDate = null; });
        _tdLiveUnsubs.push(u);
      } catch (e) {}
    });
  } catch (e) {}
}

// Debounced re-render of whatever is on screen right now.
function _tdLiveKick() {
  clearTimeout(_tdKickTimer);
  _tdKickTimer = setTimeout(function () {
    try {
      var lh = document.getElementById('loc-home');
      if (lh && lh.style.display !== 'none' && typeof renderTodayPanel === 'function') renderTodayPanel();
    } catch (e) {}
    try {
      var co = document.getElementById('completion-overlay');
      if (co && co.style.display !== 'none' && typeof renderCompletion === 'function') renderCompletion();
    } catch (e) {}
    try {
      if (document.getElementById('ec-content') && typeof renderECContent === 'function') renderECContent();
    } catch (e) {}
    try {
      // Production KPI tiles (Daily Check / Morning Walk counts) — refresh live so
      // they're never stale when a check is submitted from any device.
      if (document.getElementById('prod-kpi-bar') && typeof renderProdPanel === 'function') renderProdPanel();
    } catch (e) {}
    try { if (typeof renderLandingStatus === 'function') renderLandingStatus(); } catch (e) {}
    // History tables refresh live too — but never while a detail modal is open
    // (a re-render underneath is fine; wiping the table mid-read is not).
    try {
      var sec = window._prodSection;
      var vis = function (id) { var el = document.getElementById(id); return el && el.style.display !== 'none'; };
      if (sec === 'bwhistory' && vis('prod-sec-bwhistory') && typeof renderProdBarnWalks === 'function') renderProdBarnWalks();
      if (sec === 'mwhistory' && vis('prod-sec-mwhistory') && typeof renderProdMorningWalks === 'function') renderProdMorningWalks();
    } catch (e) {}
  }, 400);
}

// Arm shortly after boot; re-arm on wake so the date rollover is handled
// (iPads live on the wall — "today" changes under them at midnight).
setTimeout(_tdArmLive, 5000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) _tdArmLive(); });

function _tdConfetti() {
  try {
    var colors = ['#4ade80', '#f0d68a', '#7ab0f6', '#f8a4a4', '#a7e08a', '#d6b34a'];
    for (var i = 0; i < 46; i++) {
      (function (i) {
        var el = document.createElement('div');
        var sz = 7 + Math.random() * 9;
        el.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;top:-24px;left:' + (Math.random() * 100) + 'vw;width:' + sz + 'px;height:' + (sz * 0.55) + 'px;background:' + colors[i % colors.length] + ';border-radius:2px;opacity:0.95;transition:transform 2.3s cubic-bezier(.25,.7,.4,1),opacity 2.3s;';
        document.body.appendChild(el);
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          el.style.transform = 'translateY(' + (105 + Math.random() * 20) + 'vh) rotate(' + (Math.random() * 720 - 360) + 'deg)';
          el.style.opacity = '0';
        }); });
        setTimeout(function () { el.remove(); }, 2500);
      })(i);
    }
  } catch (e) {}
}

async function renderTodayPanel() {
  var el = document.getElementById('today-panel');
  if (!el) return;
  var pref = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  var layerFarms = _tdLayerFarms();
  var today = new Date().toISOString().slice(0, 10);

  // ── In-memory items (sync): urgent WOs + overdue PMs, scoped to the site ──
  var wos = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
  var urgent = wos.filter(function (w) { return w && (w.status === 'open' || w.status === 'in-progress') && w.priority === 'urgent' && (!pref || w.farm === pref); }).length;
  var overduePM = 0;
  try {
    if (typeof ALL_PM !== 'undefined' && Array.isArray(ALL_PM) && typeof pmStatus === 'function') {
      overduePM = ALL_PM.filter(function (t) { return (!pref || t.farm === pref || t.farm === 'Both' || t.farm === 'All') && pmStatus(t.id) === 'overdue'; }).length;
    }
  } catch (e) {}

  // ── Async: today's daily checks (layer sites only) ──
  var missMorning = 0, missCheck = 0, missManure = 0;
  if (layerFarms.length && typeof db !== 'undefined' && db) {
    try {
      var snaps = await Promise.all([
        db.collection('morningWalks').where('date', '==', today).get(),
        db.collection('barnWalks').where('date', '==', today).get(),
        db.collection('manureSubmit').where('date', '==', today).get()
      ]);
      var mw = new Set(), ck = new Set(), ms = new Set();
      snaps[0].forEach(function (d) { var x = d.data(); if (x && x.farm && x.house != null) mw.add(x.farm + '|' + _tdHnum(x.house)); });
      snaps[1].forEach(function (d) { var x = d.data(); if (x && x.farm && x.house != null) ck.add(x.farm + '|' + _tdHnum(x.house)); });
      snaps[2].forEach(function (d) { var x = d.data(); if (x && x.farm && x.house != null) ms.add(x.farm + '|' + _tdHnum(x.house)); });
      layerFarms.forEach(function (f) {
        (TD_HOUSES[f] || []).filter(function (h) { return !(typeof isHouseDown === 'function' && isHouseDown(f, h)); }).forEach(function (h) {
          var key = f + '|' + h;
          if (!mw.has(key)) missMorning++;
          if (!ck.has(key)) missCheck++;
          if (_tdManApplies(f, h) && !ms.has(key)) missManure++;
        });
      });
    } catch (e) { console.warn('renderTodayPanel:', e); }
  }

  // 🎉 Celebrate once per day when this site finishes ALL its daily checks.
  try {
    if (layerFarms.length && (missMorning + missCheck + missManure) === 0) {
      var _doneKey = 'rushtown_alldone_' + (pref || 'master') + '_' + today;
      if (!localStorage.getItem(_doneKey)) { localStorage.setItem(_doneKey, '1'); _tdConfetti(); }
    }
  } catch (e) {}

  function row(icon, txt, color, onclick) {
    return '<button onclick="' + onclick + '" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:12px 12px;margin-bottom:7px;background:#10140a;border:1.5px solid ' + color + ';border-radius:11px;color:#f0ead8;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;">' +
      '<span style="font-size:19px;line-height:1;">' + icon + '</span><span style="flex:1;line-height:1.3;">' + txt + '</span><span style="color:' + color + ';font-size:17px;">→</span></button>';
  }
  var rows = [];
  if (missMorning) rows.push(row('☀️', '<b>' + missMorning + '</b> ' + tdL('houses need Morning Walk', 'galpones necesitan Recorrido'), '#d69e2e', "openProductionScreen()"));
  if (missCheck)   rows.push(row('✅', '<b>' + missCheck + '</b> ' + tdL('houses need Daily Check', 'galpones necesitan Chequeo'), '#d69e2e', "openProductionScreen()"));
  if (missManure)  rows.push(row('💩', '<b>' + missManure + '</b> ' + tdL('houses need Manure', 'galpones necesitan Estiércol'), '#a87b3a', "openManure()"));
  if (urgent)      rows.push(row('⚡', '<b>' + urgent + '</b> ' + tdL('urgent work orders', 'órdenes urgentes'), '#e53e3e', "enterApp('maint')"));
  if (overduePM)   rows.push(row('🛠', '<b>' + overduePM + '</b> ' + tdL('PMs overdue', 'PM vencidos'), '#e53e3e', "enterApp('maint')"));

  var header = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:2px;color:#7ab07a;text-transform:uppercase;margin:2px 0 8px;">📋 ' + (rows.length ? tdL('Today — needs attention', 'Hoy — requiere atención') : tdL('Today', 'Hoy')) + '</div>';
  var body = rows.length
    ? rows.join('')
    : '<div style="padding:13px 14px;background:#0a2a0a;border:1.5px solid #2a5a2a;border-radius:12px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;color:#86efac;text-align:center;">✅ ' + tdL('All caught up today', 'Todo al día hoy') + '</div>';
  el.innerHTML = header + body;
}

if (typeof window !== 'undefined') window.renderTodayPanel = renderTodayPanel;
