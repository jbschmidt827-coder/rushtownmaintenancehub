// ═══════════════════════════════════════════════════════════════════════════
// manure.js — Manure belt-run check-off
// Employees log what % of the belt ran, per HOUSE and per COLLECTOR (6 per house),
// for today. Auto-saves as they tap (that IS the check-off). Houses with manure:
// Hegins barns 4-8, Danville barns 1-5. One row per farm+house+collector+day in
// Firestore `manureLog` (doc id keyed so re-tapping just updates today's value).
// Opened from a "Manure" card on each location's home; scoped to the active site.
// ═══════════════════════════════════════════════════════════════════════════
const MANURE_HOUSES   = { Hegins: [4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
const MANURE_COLLECTORS = 6;
const MANURE_PCTS     = [0, 25, 50, 75, 100];
const MANURE_PCT_COL  = { 0: '#c0392b', 25: '#e67e22', 50: '#d69e2e', 75: '#5a9b4a', 100: '#2e7d32' };

let _manureLog = [];
let _manureListening = false;

function manToday() { return new Date().toISOString().slice(0, 10); }
function manKey(farm, house, coll, date) { return farm + '__H' + house + '__C' + coll + '__' + date; }
function manRec(farm, house, coll) {
  var t = manToday();
  return _manureLog.find(function (r) {
    return r.farm === farm && String(r.house) === String(house) && String(r.collector) === String(coll) && r.date === t;
  });
}
function manFarms() {
  var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  if (f === 'Hegins' || f === 'Danville') return [f];
  if (!f) return ['Hegins', 'Danville']; // Master = both layer sites
  return []; // Processing Plant etc. — no manure houses
}

function manStartListener() {
  if (_manureListening || typeof db === 'undefined' || !db) return;
  _manureListening = true;
  try {
    db.collection('manureLog').orderBy('ts', 'desc').limit(600).onSnapshot(function (snap) {
      _manureLog = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      if (document.getElementById('manure-overlay') && document.getElementById('manure-overlay').style.display !== 'none') renderManure();
    }, function (err) { console.error('manureLog listener:', err); });
  } catch (e) { console.error('manStartListener:', e); _manureListening = false; }
}

function openManure() {
  var ov = document.getElementById('manure-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'manure-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:950;background:#0a140a;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    document.body.appendChild(ov);
  }
  ov.style.display = 'block';
  manStartListener();
  renderManure();
  try { window.scrollTo(0, 0); } catch (e) {}
}
function closeManure() { var ov = document.getElementById('manure-overlay'); if (ov) ov.style.display = 'none'; }

function manBtn(farm, house, coll, cur) {
  return MANURE_PCTS.map(function (p) {
    var on = (cur === p);
    var col = MANURE_PCT_COL[p];
    var st = on
      ? 'background:' + col + ';border:1.5px solid ' + col + ';color:#fff;'
      : 'background:#0f1f0f;border:1.5px solid #2a5a2a;color:#6f8f6f;';
    return '<button onclick="manureSet(\'' + farm + '\',' + house + ',' + coll + ',' + p + ')" style="flex:1;min-width:42px;padding:9px 4px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;' + st + '">' + p + '</button>';
  }).join('');
}

function renderManure() {
  var ov = document.getElementById('manure-overlay');
  if (!ov) return;
  var farms = manFarms();
  var dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  var body = '';
  if (!farms.length) {
    body = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;color:#c9a86a;text-align:center;padding:40px 16px;">Manure is tracked at the layer houses.<br>Go back and pick <b>Hegins</b> or <b>Danville</b>.</div>';
  } else {
    farms.forEach(function (farm) {
      if (farms.length > 1) body += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:2px;color:#7ab07a;text-transform:uppercase;margin:14px 0 8px;">📍 ' + farm + '</div>';
      (MANURE_HOUSES[farm] || []).forEach(function (house) {
        var logged = 0, rows = '';
        for (var c = 1; c <= MANURE_COLLECTORS; c++) {
          var rec = manRec(farm, house, c);
          var cur = rec ? Number(rec.pctRun) : null;
          if (rec) logged++;
          rows += '<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;min-width:38px;">C' + c + '</span>' +
            '<div style="display:flex;gap:5px;flex:1;">' + manBtn(farm, house, c, cur) + '</div>' +
          '</div>';
        }
        var allDone = logged === MANURE_COLLECTORS;
        rows += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#5a8a5a;margin-top:4px;">% of belt that ran · taps save automatically</div>';
        body += '<div style="background:#0f2410;border:1.5px solid ' + (allDone ? '#2a7a3a' : '#2a5a2a') + ';border-radius:12px;padding:13px 14px;margin-bottom:12px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:700;color:#e8f5ec;">🏚 House ' + house + ' <span style="font-size:11px;font-weight:400;color:' + (allDone ? '#4ade80' : '#7ab07a') + ';">· ' + logged + '/' + MANURE_COLLECTORS + (allDone ? ' ✓' : '') + '</span></div>' +
            '<button onclick="manureSetAll(\'' + farm + '\',' + house + ',100)" style="padding:7px 11px;background:#14532d;border:1px solid #2a7a3a;border-radius:8px;color:#86efac;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">All 100%</button>' +
          '</div>' + rows + '</div>';
      });
    });
  }

  ov.innerHTML =
    '<div style="max-width:720px;margin:0 auto;padding:16px 14px 40px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:30px;color:#f0ead8;letter-spacing:2px;line-height:1;">💩 MANURE</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#7ab07a;margin-top:3px;">' + dateStr + '</div></div>' +
        '<button onclick="closeManure()" style="padding:9px 14px;background:#2a1010;border:1.5px solid #7f1d1d;border-radius:10px;color:#f8b4b4;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;">✕ Exit</button>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;line-height:1.5;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin:8px 0 16px;">Tap the % of the belt that ran for each collector (C1–C6). Use <b style="color:#86efac;">All 100%</b> if a whole house ran fully. It saves as you go.</div>' +
      body +
    '</div>';
}

async function manureSet(farm, house, coll, pct) {
  var by = (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : '');
  var t = manToday();
  var rec = { farm: farm, house: house, collector: coll, pctRun: pct, date: t, by: by, ts: Date.now() };
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('manureLog').doc(manKey(farm, house, coll, t)).set(rec);
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manureSet:', e);
    alert('Could not save: ' + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function manureSetAll(farm, house, pct) {
  var by = (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : '');
  var t = manToday();
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    if (db && typeof db.batch === 'function') {
      var batch = db.batch();
      for (var c = 1; c <= MANURE_COLLECTORS; c++) {
        batch.set(db.collection('manureLog').doc(manKey(farm, house, c, t)), { farm: farm, house: house, collector: c, pctRun: pct, date: t, by: by, ts: Date.now() });
      }
      await batch.commit();
    } else {
      for (var c2 = 1; c2 <= MANURE_COLLECTORS; c2++) await manureSet(farm, house, c2, pct);
    }
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manureSetAll:', e);
    alert('Could not save: ' + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

if (typeof window !== 'undefined') {
  window.openManure = openManure;
  window.closeManure = closeManure;
  window.renderManure = renderManure;
  window.manureSet = manureSet;
  window.manureSetAll = manureSetAll;
}
