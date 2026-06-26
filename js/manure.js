// ═══════════════════════════════════════════════════════════════════════════
// manure.js — Manure belt-run check-off + PM sign-off  (EN/ES)
// Employees log what % of the belt ran (0 / 50 / 100), per HOUSE and per
// COLLECTOR (6 per house), for today, and tick a daily "PM" box per collector.
// The manure tech also ticks a WEEKLY PM box per house. Auto-saves as they tap.
// Houses: Hegins 4-8, Danville 1-5. Submitting a house collapses it; once every
// house is submitted the farm's daily manure PMs auto-complete in the PM tracker.
// ═══════════════════════════════════════════════════════════════════════════
const MANURE_HOUSES     = { Hegins: [4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
const MANURE_COLLECTORS = 6;
const MANURE_PCTS       = [0, 50, 100];
const MANURE_PCT_COL    = { 0: '#c0392b', 50: '#d69e2e', 100: '#2e7d32' };

// ── i18n: pick ES when the app is in Spanish (global _lang from core.js) ──
function _mlang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
function ML(en, es) { return _mlang() === 'es' ? es : en; }

let _manureLog = [];
let _manureWeekly = [];
let _manureSubmit = [];
let _manureListening = false;
let _manurePushed = {}; // dedupe PM-tracker pushes per farm+period this session
let _manureExpanded = {}; // submitted houses the user re-opened for editing

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
function manSubKey(farm, house, date) { return farm + '__H' + house + '__' + date; }

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
function manSubRec(farm, house) {
  var t = manToday();
  return _manureSubmit.find(function (r) {
    return r.farm === farm && String(r.house) === String(house) && r.date === t;
  });
}
function manFarms() {
  var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  if (f === 'Hegins' || f === 'Danville') return [f];
  if (!f) return ['Hegins', 'Danville']; // Master = both layer sites
  return []; // Processing Plant etc. — no manure houses
}
function _manBy() { return (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : ''); }

function _allHousesSubmittedToday(farm) {
  var hs = MANURE_HOUSES[farm] || [];
  return hs.length > 0 && hs.every(function (h) { return !!manSubRec(farm, h); });
}
function _allHousesWeeklyDone(farm) {
  var hs = MANURE_HOUSES[farm] || [];
  return hs.length > 0 && hs.every(function (h) { var r = manWeeklyRec(farm, h); return !!(r && r.done); });
}

// ── PM tracker bridge ──────────────────────────────────────────────────────
function _manureDailyPMs(farm) {
  if (typeof ALL_PM === 'undefined' || !Array.isArray(ALL_PM)) return [];
  return ALL_PM.filter(function (t) { return t.farm === farm && t.sys === 'Manure' && (t.freq === 'daily' || t.freq === 'mwf'); });
}
function _manureWeeklyPMs(farm) {
  if (typeof ALL_PM === 'undefined' || !Array.isArray(ALL_PM)) return [];
  return ALL_PM.filter(function (t) { return t.farm === farm && t.sys === 'Manure' && t.freq === 'weekly'; });
}
function _pmDoneToday(pmId) {
  try { return typeof pmComps !== 'undefined' && pmComps[pmId] && pmComps[pmId].date === manToday(); } catch (e) { return false; }
}
function _pmDoneThisWeek(pmId) {
  try { var c = (typeof pmComps !== 'undefined') ? pmComps[pmId] : null; return !!(c && c.date && c.date >= manWeekKey()); } catch (e) { return false; }
}
async function _markManurePMs(tasks, note) {
  if (typeof db === 'undefined' || !db || !tasks || !tasks.length || typeof db.batch !== 'function') return;
  var tech = _manBy() || 'Manure crew';
  var date = manToday();
  try {
    var batch = db.batch();
    tasks.forEach(function (t) {
      batch.set(db.collection('pmCompletions').doc(t.id), { tech: tech, date: date, parts: '', notes: note, ts: Date.now() });
      batch.set(db.collection('pmHistory').doc(), { pmId: t.id, farm: t.farm, sys: t.sys, task: t.task, freq: t.freq, tech: tech, date: date, parts: '', notes: note, ts: Date.now() });
    });
    batch.set(db.collection('activityLog').doc(), { type: 'pm', desc: 'Manure tab auto-completed ' + tasks.length + ' ' + tasks[0].farm + ' manure PM(s)', tech: tech, date: (typeof fmtDate === 'function' ? fmtDate(date) : date), ts: Date.now() });
    await batch.commit();
  } catch (e) { console.error('_markManurePMs:', e); }
}
async function _maybeMarkDailyManurePMs(farm) {
  if (!_allHousesSubmittedToday(farm)) return false;
  var pms = _manureDailyPMs(farm);
  if (!pms.length) return false;
  var key = farm + '__D__' + manToday();
  if (_manurePushed[key] || _pmDoneToday(pms[0].id)) return false;
  _manurePushed[key] = true;
  await _markManurePMs(pms, 'Auto: all houses manure submitted (daily) via Manure tab');
  return true;
}
async function _maybeMarkWeeklyManurePMs(farm) {
  if (!_allHousesWeeklyDone(farm)) return false;
  var pms = _manureWeeklyPMs(farm);
  if (!pms.length) return false;
  var key = farm + '__W__' + manWeekKey();
  if (_manurePushed[key] || _pmDoneThisWeek(pms[0].id)) return false;
  _manurePushed[key] = true;
  await _markManurePMs(pms, 'Auto: all houses weekly manure PM done via Manure tab');
  return true;
}

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
    db.collection('manureSubmit').orderBy('ts', 'desc').limit(400).onSnapshot(function (snap) {
      _manureSubmit = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      _manureRerender();
    }, function (err) { console.error('manureSubmit listener:', err); });
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
  return '<button onclick="manurePMSet(\'' + farm + '\',' + house + ',' + coll + ')" title="' + ML('Daily PM done for this collector', 'PM diario hecho para este colector') + '" style="flex:0 0 auto;min-width:62px;padding:12px 8px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;' + st + '">' + (done ? '✓ PM' : '☐ PM') + '</button>';
}

function renderManure() {
  var ov = document.getElementById('manure-overlay');
  if (!ov) return;
  var farms = manFarms();
  var dateStr = new Date().toLocaleDateString(_mlang() === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  var HOUSE = ML('House', 'Casa');

  var body = '';
  if (!farms.length) {
    body = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;color:#c9a86a;text-align:center;padding:40px 16px;">' + ML('Manure is tracked at the layer houses.<br>Go back and pick <b>Hegins</b> or <b>Danville</b>.', 'El estiércol se registra en las casas de gallinas.<br>Regresa y elige <b>Hegins</b> o <b>Danville</b>.') + '</div>';
  } else {
    farms.forEach(function (farm) {
      var _hs = MANURE_HOUSES[farm] || [];
      var _subCount = _hs.filter(function (h) { return !!manSubRec(farm, h); }).length;
      var _pct = _hs.length ? Math.round(_subCount / _hs.length * 100) : 0;
      body += '<div style="margin:14px 0 10px;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:1px;color:' + (_pct === 100 ? '#4ade80' : '#7ab07a') + ';text-transform:uppercase;margin-bottom:5px;">' + (farms.length > 1 ? ('📍 ' + farm + ' · ') : '') + _subCount + '/' + _hs.length + ' ' + ML('houses submitted today', 'casas enviadas hoy') + ' · ' + _pct + '%' + (_pct === 100 ? ' ✓ ' + ML('all done', 'todo listo') : '') + '</div>' +
        '<div style="height:8px;background:#0f1f0f;border:1px solid #2a5a2a;border-radius:5px;overflow:hidden;"><div style="height:100%;width:' + _pct + '%;background:' + (_pct === 100 ? '#2e7d32' : '#5a9b4a') + ';transition:width .3s;"></div></div>' +
      '</div>';
      _hs.forEach(function (house) {
        var hkey = farm + '__' + house;
        var sub = manSubRec(farm, house);
        var subDone = !!sub;
        var subBy = (subDone && sub.by) ? ' · ' + sub.by : '';
        // Submitted houses fold to a thin green bar so the crew only sees what's left.
        if (subDone && !_manureExpanded[hkey]) {
          body += '<div onclick="manureToggleHouse(\'' + farm + '\',' + house + ')" style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#0d1f0d;border:1.5px solid #2a7a3a;border-radius:12px;padding:13px 14px;margin-bottom:10px;cursor:pointer;">' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;color:#86efac;">✓ ' + HOUSE + ' ' + house + ' — ' + ML('submitted', 'enviada') + subBy + '</span>' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#5a8a5a;">' + ML('tap to reopen', 'toca para abrir') + ' ▸</span>' +
          '</div>';
          return;
        }
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
        rows += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#5a8a5a;margin-top:4px;">' + ML('% of belt that ran &nbsp;·&nbsp; ☐ PM = daily PM done for that collector &nbsp;·&nbsp; taps save automatically', '% de la banda que corrió &nbsp;·&nbsp; ☐ PM = PM diario hecho para ese colector &nbsp;·&nbsp; se guarda al tocar') + '</div>';

        // Weekly manure-tech PM sign-off for this house
        var wrec = manWeeklyRec(farm, house);
        var wdone = !!(wrec && wrec.done);
        var wby = (wdone && wrec && wrec.by) ? ' · ' + wrec.by : '';
        rows += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px;padding-top:11px;border-top:1px dashed #2a5a2a;">' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;">📅 ' + ML('Weekly manure PM', 'PM semanal de estiércol') + ' <span style="color:#5a8a5a;">(' + ML('manure tech', 'técnico') + ')' + wby + '</span></span>' +
            '<button onclick="manureWeeklySet(\'' + farm + '\',' + house + ')" style="padding:10px 13px;border-radius:8px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;' + (wdone ? 'background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;' : 'background:#13110a;border:1.5px solid #5a4a2a;color:#d8b478;') + '">' + (wdone ? '✓ ' + ML('Done this week', 'Hecho esta semana') : '☐ ' + ML('Mark weekly PM', 'Marcar PM semanal')) + '</button>' +
        '</div>';

        // Per-house daily Submit. Submitting collapses the house; once every
        // house is in, the farm's daily manure PMs auto-complete in the tracker.
        if (subDone) {
          rows += '<button onclick="manureToggleHouse(\'' + farm + '\',' + house + ')" style="width:100%;margin-top:11px;padding:13px;border-radius:10px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;">✓ ' + ML('Submitted', 'Enviada') + subBy + ' — ' + ML('tap to collapse', 'toca para cerrar') + '</button>';
        } else {
          rows += '<button onclick="manureSubmitHouse(\'' + farm + '\',' + house + ')" style="width:100%;margin-top:11px;padding:13px;border-radius:10px;font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;cursor:pointer;background:#1f7a3a;border:1.5px solid #2a7a3a;color:#eafff0;">✓ ' + ML('Submit', 'Enviar') + ' ' + HOUSE + ' ' + house + ' — ' + ML('daily', 'diario') + '</button>';
        }

        body += '<div style="background:#0f2410;border:1.5px solid ' + (allRan ? '#2a7a3a' : '#2a5a2a') + ';border-radius:12px;padding:13px 14px;margin-bottom:12px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:700;color:#e8f5ec;">🏚 ' + HOUSE + ' ' + house +
              ' <span style="font-size:11px;font-weight:400;color:' + (allRan ? '#4ade80' : '#7ab07a') + ';">· ' + ran + '/' + MANURE_COLLECTORS + ' ' + ML('ran', 'corrió') + (allRan ? ' ✓' : '') + '</span>' +
              ' <span style="font-size:11px;font-weight:400;color:' + (allPM ? '#4ade80' : '#b08f5a') + ';">· ' + pmCount + '/' + MANURE_COLLECTORS + ' PM' + (allPM ? ' ✓' : '') + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              '<button onclick="manureSetAll(\'' + farm + '\',' + house + ',100)" style="padding:7px 11px;background:#14532d;border:1px solid #2a7a3a;border-radius:8px;color:#86efac;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">' + ML('All 100%', 'Todo 100%') + '</button>' +
              '<button onclick="manurePMSetAll(\'' + farm + '\',' + house + ')" style="padding:7px 11px;background:#1c2e14;border:1px solid #3a6a2a;border-radius:8px;color:#a7e08a;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">✓ ' + ML('All PM', 'Todo PM') + '</button>' +
            '</div>' +
          '</div>' + rows + '</div>';
      });
    });
  }

  ov.innerHTML =
    '<div style="max-width:720px;margin:0 auto;padding:calc(env(safe-area-inset-top, 0px) + 30px) 14px 40px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<button onclick="closeManure()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">← ' + ML('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:30px;color:#f0ead8;letter-spacing:2px;line-height:1;">💩 ' + ML('MANURE', 'ESTIÉRCOL') + '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#7ab07a;margin-top:3px;">' + dateStr + '</div></div>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;line-height:1.5;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin:8px 0 16px;">' + ML('Tap the % of the belt that ran (<b style="color:#86efac;">0 / 50 / 100</b>) for each collector, then tick <b style="color:#86efac;">PM</b> when its daily PM is done. Use <b style="color:#86efac;">All 100%</b> / <b style="color:#a7e08a;">All PM</b> to do a whole house at once, and the manure tech ticks the <b style="color:#d8b478;">weekly PM</b> per house. Hit <b style="color:#eafff0;">Submit</b> on each house when it&rsquo;s done. It saves as you go.', 'Toca el % de la banda que corrió (<b style="color:#86efac;">0 / 50 / 100</b>) para cada colector, luego marca <b style="color:#86efac;">PM</b> cuando se haga su PM diario. Usa <b style="color:#86efac;">Todo 100%</b> / <b style="color:#a7e08a;">Todo PM</b> para una casa entera, y el técnico marca el <b style="color:#d8b478;">PM semanal</b> por casa. Toca <b style="color:#eafff0;">Enviar</b> en cada casa al terminar. Se guarda solo.') + '</div>' +
      body +
    '</div>';
}

async function manureSet(farm, house, coll, pct) {
  var t = manToday();
  var rec = { farm: farm, house: house, collector: coll, pctRun: pct, date: t, by: _manBy(), ts: Date.now() };
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('manureLog').doc(manKey(farm, house, coll, t)).set(rec, { merge: true });
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manureSet:', e);
    alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
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
    alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
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
    alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
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
    alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
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
    if (next) { try { await _maybeMarkWeeklyManurePMs(farm); } catch (e2) {} }
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manureWeeklySet:', e);
    alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function manureSubmitHouse(farm, house) {
  var already = !!manSubRec(farm, house);
  if (!already) {
    var logged = 0;
    for (var c = 1; c <= MANURE_COLLECTORS; c++) { var r = manRec(farm, house, c); if (r && r.pctRun != null) logged++; }
    if (logged < MANURE_COLLECTORS) {
      if (!confirm(ML('House ', 'Casa ') + house + ML(': only ', ': solo ') + logged + '/' + MANURE_COLLECTORS + ML(' collectors logged.\nSubmit anyway?', ' colectores registrados.\n¿Enviar de todas formas?'))) return;
    }
  }
  var t = manToday();
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('manureSubmit').doc(manSubKey(farm, house, t)).set(
      { farm: farm, house: house, date: t, by: _manBy(), ts: Date.now() },
      { merge: true }
    );
    _manureExpanded[farm + '__' + house] = false; // fold it away once submitted
    var pushed = await _maybeMarkDailyManurePMs(farm);
    if (typeof setSyncDot === 'function') setSyncDot('live');
    if (typeof toast === 'function') {
      toast(pushed ? (ML('All houses in — ', 'Todas las casas listas — ') + farm + ML(' daily manure PMs marked done ✓', ' PM diarios de estiércol marcados ✓')) : (ML('House ', 'Casa ') + house + ML(' manure submitted ✓', ' estiércol enviado ✓')));
    }
  } catch (e) {
    console.error('manureSubmitHouse:', e);
    alert(ML('Could not submit: ', 'No se pudo enviar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

function manureToggleHouse(farm, house) {
  var k = farm + '__' + house;
  _manureExpanded[k] = !_manureExpanded[k];
  renderManure();
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
  window.manureSubmitHouse = manureSubmitHouse;
  window.manureToggleHouse = manureToggleHouse;
}
