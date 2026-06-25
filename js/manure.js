// ═══════════════════════════════════════════════════════════════════════════
// manure.js — Manure belt-run check-off + PM sign-off
// Employees log what % of the belt ran (0 / 50 / 100), per HOUSE and per
// COLLECTOR (6 per house), for today, and tick a daily "PM" box per collector.
// The manure tech also ticks a WEEKLY PM box per house. Auto-saves as they tap.
// Houses with manure: Hegins barns 4-8, Danville barns 1-5.
//   manureLog     — one doc per farm+house+collector+day  { pctRun, pmDone }
//   manureWeekly  — one doc per farm+house+week            { done }
// Opened from a "Manure" card on each location's home; scoped to the active site.
// ═══════════════════════════════════════════════════════════════════════════
const MANURE_HOUSES     = { Hegins: [4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
const MANURE_COLLECTORS = 6;
const MANURE_PCTS       = [0, 50, 100];
const MANURE_PCT_COL    = { 0: '#c0392b', 50: '#d69e2e', 100: '#2e7d32' };

let _manureLog = [];
let _manureWeekly = [];
let _manureListening = false;

function manToday() { return new Date().toISOString().slice(0, 10); }
function manKey(farm, house, coll, date) { return farm + '__H' + house + '__C' + coll + '__' + date; }

// Monday-of-this-week as YYYY-MM-DD — the bucket the weekly PM is saved under.
function manWeekKey() {
  var d = new Date();
  var dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}
function manWeeklyKey(farm, house) { return farm + '__H' + house + '__W' + manWeekKey(); }

function manRec(farm, house, coll) {
  var t = manToday();
  return _manureLog.find(function (r) {
    return r.farm === farm && String(r.house) === String(house) && String(r.collector) === String(coll) && r.date === t;
  });
}
function manWeeklyRec(farm, house) {
  var w = manWeekKey();
  return _manureWeekly.find(function (r) {
    return r.farm === farm && String(r.house) === String(house) && r.weekKey === w;
  });
}
function manFarms() {
  var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  if (f === 'Hegins' || f === 'Danville') return [f];
  if (!f) return ['Hegins', 'Danville']; // Master = both layer sites
  return []; // Processing Plant etc. — no manure houses
}
function _manBy() { return (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : ''); }

function manStartListener() {
  if (_manureListening || typeof db === 'undefined' || !db) return;
  _manureListening = true;
  try {
    db.collection('manureLog').orderBy('ts', 'desc').limit(800).onSnapshot(function (snap) {
      _manureLog = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      _manureRerender();
    }, function (err) { console.error('manureLog listener:', err); });
    db.collection('manureWeekly').orderBy('ts', 'desc').limit(400).onSnapshot(function (snap) {
      _manureWeekly = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      _manureRerender();
    }, function (err) { console.error('manureWeekly listener:', err); });
  } catch (e) { console.error('manStartListener:', e); _manureListening = false; }
}
function _manureRerender() {
  var ov = document.getElementById('manure-overlay');
  if (ov && ov.style.display !== 'none') renderManure();
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
    return '<button onclick="manureSet(\'' + farm + '\',' + house + ',' + coll + ',' + p + ')" style="flex:1;min-width:50px;padding:12px 4px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;cursor:pointer;' + st + '">' + p + '</button>';
  }).join('');
}

function manPMBtn(farm, house, coll, done) {
  var st = done
    ? 'background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;'
    : 'background:#13110a;border:1.5px solid #5a4a2a;color:#b08f5a;';
  return '<button onclick="manurePMSet(\'' + farm + '\',' + house + ',' + coll + ')" title="Daily PM done for this collector" style="flex:0 0 auto;min-width:62px;padding:12px 8px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;' + st + '">' + (done ? '✓ PM' : '☐ PM') + '</button>';
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
        var ran = 0, pmCount = 0, rows = '';
        for (var c = 1; c <= MANURE_COLLECTORS; c++) {
          var rec = manRec(farm, house, c);
          var cur = (rec && rec.pctRun != null) ? Number(rec.pctRun) : null;
          var pm  = !!(rec && rec.pmDone);
          if (rec && rec.pctRun != null) ran++;
          if (pm) pmCount++;
          rows += '<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px;">' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;min-width:30px;">C' + c + '</span>' +
            '<div style="display:flex;gap:5px;flex:1;">' + manBtn(farm, house, c, cur) + '</div>' +
            manPMBtn(farm, house, c, pm) +
          '</div>';
        }
        var allRan = ran === MANURE_COLLECTORS;
        var allPM  = pmCount === MANURE_COLLECTORS;
        rows += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#5a8a5a;margin-top:4px;">% of belt that ran &nbsp;·&nbsp; ☐ PM = daily PM done for that collector &nbsp;·&nbsp; taps save automatically</div>';

        // Weekly manure-tech PM sign-off for this house
        var wrec = manWeeklyRec(farm, house);
        var wdone = !!(wrec && wrec.done);
        var wby = (wdone && wrec && wrec.by) ? ' · ' + wrec.by : '';
        rows += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px;padding-top:11px;border-top:1px dashed #2a5a2a;">' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;">📅 Weekly manure PM <span style="color:#5a8a5a;">(manure tech)' + wby + '</span></span>' +
            '<button onclick="manureWeeklySet(\'' + farm + '\',' + house + ')" style="padding:10px 13px;border-radius:8px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;' + (wdone ? 'background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;' : 'background:#13110a;border:1.5px solid #5a4a2a;color:#d8b478;') + '">' + (wdone ? '✓ Done this week' : '☐ Mark weekly PM') + '</button>' +
        '</div>';

        body += '<div style="background:#0f2410;border:1.5px solid ' + (allRan ? '#2a7a3a' : '#2a5a2a') + ';border-radius:12px;padding:13px 14px;margin-bottom:12px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:700;color:#e8f5ec;">🏚 House ' + house +
              ' <span style="font-size:11px;font-weight:400;color:' + (allRan ? '#4ade80' : '#7ab07a') + ';">· ' + ran + '/' + MANURE_COLLECTORS + ' ran' + (allRan ? ' ✓' : '') + '</span>' +
              ' <span style="font-size:11px;font-weight:400;color:' + (allPM ? '#4ade80' : '#b08f5a') + ';">· ' + pmCount + '/' + MANURE_COLLECTORS + ' PM' + (allPM ? ' ✓' : '') + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              '<button onclick="manureSetAll(\'' + farm + '\',' + house + ',100)" style="padding:7px 11px;background:#14532d;border:1px solid #2a7a3a;border-radius:8px;color:#86efac;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">All 100%</button>' +
              '<button onclick="manurePMSetAll(\'' + farm + '\',' + house + ')" style="padding:7px 11px;background:#1c2e14;border:1px solid #3a6a2a;border-radius:8px;color:#a7e08a;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">✓ All PM</button>' +
            '</div>' +
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
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;line-height:1.5;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin:8px 0 16px;">Tap the % of the belt that ran (<b style="color:#86efac;">0 / 50 / 100</b>) for each collector, then tick <b style="color:#86efac;">PM</b> when its daily PM is done. Use <b style="color:#86efac;">All 100%</b> / <b style="color:#a7e08a;">All PM</b> to do a whole house at once. The manure tech ticks the <b style="color:#d8b478;">weekly PM</b> per house. It saves as you go.</div>' +
      body +
    '</div>';
}

async function manureSet(farm, house, coll, pct) {
  var t = manToday();
  var rec = { farm: farm, house: house, collector: coll, pctRun: pct, date: t, by: _manBy(), ts: Date.now() };
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    // merge:true so we never wipe a pmDone flag already on today's doc
    await db.collection('manureLog').doc(manKey(farm, house, coll, t)).set(rec, { merge: true });
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manureSet:', e);
    alert('Could not save: ' + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function manurePMSet(farm, house, coll) {
  var t = manToday();
  var rec = manRec(farm, house, coll);
  var next = !(rec && rec.pmDone);
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('manureLog').doc(manKey(farm, house, coll, t)).set(
      { farm: farm, house: house, collector: coll, pmDone: next, pmBy: _manBy(), date: t, ts: Date.now() },
      { merge: true }
    );
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manurePMSet:', e);
    alert('Could not save: ' + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function manureSetAll(farm, house, pct) {
  var t = manToday();
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    if (db && typeof db.batch === 'function') {
      var batch = db.batch();
      for (var c = 1; c <= MANURE_COLLECTORS; c++) {
        batch.set(db.collection('manureLog').doc(manKey(farm, house, c, t)), { farm: farm, house: house, collector: c, pctRun: pct, date: t, by: _manBy(), ts: Date.now() }, { merge: true });
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

async function manurePMSetAll(farm, house) {
  var t = manToday();
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    if (db && typeof db.batch === 'function') {
      var batch = db.batch();
      for (var c = 1; c <= MANURE_COLLECTORS; c++) {
        batch.set(db.collection('manureLog').doc(manKey(farm, house, c, t)), { farm: farm, house: house, collector: c, pmDone: true, pmBy: _manBy(), date: t, ts: Date.now() }, { merge: true });
      }
      await batch.commit();
    } else {
      for (var c2 = 1; c2 <= MANURE_COLLECTORS; c2++) {
        await db.collection('manureLog').doc(manKey(farm, house, c2, t)).set({ farm: farm, house: house, collector: c2, pmDone: true, pmBy: _manBy(), date: t, ts: Date.now() }, { merge: true });
      }
    }
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manurePMSetAll:', e);
    alert('Could not save: ' + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function manureWeeklySet(farm, house) {
  var rec = manWeeklyRec(farm, house);
  var next = !(rec && rec.done);
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('manureWeekly').doc(manWeeklyKey(farm, house)).set(
      { farm: farm, house: house, weekKey: manWeekKey(), done: next, by: _manBy(), ts: Date.now() },
      { merge: true }
    );
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manureWeeklySet:', e);
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
  window.manurePMSet = manurePMSet;
  window.manurePMSetAll = manurePMSetAll;
  window.manureWeeklySet = manureWeeklySet;
}
