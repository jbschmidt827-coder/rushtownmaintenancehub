// ═══════════════════════════════════════════════════════════════════════════
// manure.js — Manure belt-run block + per-collector checks + PM sign-off (EN/ES)
// Each house is BLOCKED OUT for a fixed 2.0-hour belt-run window (editable per
// house, saved to settings/manureBeltSchedule). During its window a house shows
// "running now"; after, "past window" until submitted. For each of the 6
// collectors the crew logs % of belt that ran (0/50/100) and ticks four checks:
//   PM done · Belt looked over · Cleaned up · Alignment OK
// The manure tech also ticks a WEEKLY PM per house. Auto-saves as they tap.
// Houses: Hegins 4-8, Danville 1-5. Submitting a house collapses it; once every
// house is submitted the farm's daily manure PMs auto-complete in the PM tracker.
// ═══════════════════════════════════════════════════════════════════════════
const MANURE_HOUSES     = { Hegins: [4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
const MANURE_COLLECTORS = 6;
const MANURE_PCTS       = [0, 50, 100];
const MANURE_PCT_COL    = { 0: '#c0392b', 50: '#d69e2e', 100: '#2e7d32' };

// ── Belt-run block: fixed 2.0-hour window per house ─────────────────────────
// Defaults stagger each house 2 hours apart so no two houses run at once; edit
// any of them in-app (saved to settings/manureBeltSchedule, live across devices).
const MANURE_BELT_DUR_HR = 2.0;
const MANURE_BELT_SCHED_DEFAULT = {
  Hegins:   { 4: '06:00', 5: '08:00', 6: '10:00', 7: '12:00', 8: '14:00' },
  Danville: { 1: '07:00', 2: '09:00', 3: '11:00', 4: '13:00', 5: '15:00' }
};
let _manBeltSched = null;   // live override from settings/manureBeltSchedule
let _manSchedOpen = false;  // is the belt-run time editor expanded?

// ── Per-collector checks (beyond % ran). Order = display order. ─────────────
const MAN_CHK_FIELDS = ['pmDone', 'beltOk', 'cleanOk', 'alignOk'];
const MAN_CHK_LABEL  = {
  pmDone:  { en: 'PM',    es: 'PM'     },
  beltOk:  { en: 'Belt',  es: 'Banda'  },
  cleanOk: { en: 'Clean', es: 'Limpio' },
  alignOk: { en: 'Align', es: 'Alin.'  }
};
const MAN_CHK_TIP = {
  pmDone:  { en: 'Daily PM done for this collector',  es: 'PM diario hecho para este colector' },
  beltOk:  { en: 'Belt looked over',                  es: 'Banda revisada' },
  cleanOk: { en: 'Collector cleaned up',              es: 'Colector limpiado' },
  alignOk: { en: 'Alignment OK for this collector',   es: 'Alineación correcta de este colector' }
};
const MAN_CHK_BY = { pmDone: 'pmBy', beltOk: 'beltBy', cleanOk: 'cleanBy', alignOk: 'alignBy' };

// ── Belt-run issues → Work Order ────────────────────────────────────────────
// A collector can be flagged as "can't run / area failed" and/or a belt rip
// rated 1–3 (3 = worst). Raising an issue auto-creates a Work Order (deduped
// per collector/day, updated in place). Priority: can't-run or rip 3 = urgent,
// rip 2 = high, rip 1 = routine.
const MAN_RIP_COL   = { 1: '#d6b02e', 2: '#e07b39', 3: '#c0392b' };
const MAN_RIP_LABEL = { 1: { en: 'minor', es: 'leve' }, 2: { en: 'medium', es: 'media' }, 3: { en: 'worst', es: 'peor' } };

// ── i18n: pick ES when the app is in Spanish (global _lang from core.js) ──
function _mlang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
function ML(en, es) { return _mlang() === 'es' ? es : en; }

let _manureLog = [];
let _manureWeekly = [];
let _manureSubmit = [];
let _manureStart = [];   // per-house "belts started" stamps (who + when), live
let _manureListening = false;
let _manurePushed = {}; // dedupe PM-tracker pushes per farm+period this session
let _manureExpanded = {}; // submitted houses the user re-opened for editing
let _manIssueOpen = {}; // per-collector issue panel open state (farm__house__coll)

function manToday() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }
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
function manStartRec(farm, house) {
  var t = manToday();
  return _manureStart.find(function (r) {
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

// ── Belt-run schedule helpers ───────────────────────────────────────────────
function _manSchedFor(farm, house) {
  var live = (_manBeltSched && _manBeltSched[farm] && _manBeltSched[farm][String(house)]) || null;
  var def  = (MANURE_BELT_SCHED_DEFAULT[farm] && MANURE_BELT_SCHED_DEFAULT[farm][house]) || '08:00';
  return live || def;
}
function _hhmmToMin(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? (Number(m[1]) * 60 + Number(m[2])) : null; }
function _minToLabel(min) {
  if (min == null) return '';
  min = ((min % 1440) + 1440) % 1440;
  var h = Math.floor(min / 60), m = min % 60;
  var ap = h < 12 ? 'AM' : 'PM';
  var h12 = (h % 12) || 12;
  return h12 + ':' + (m < 10 ? '0' + m : m) + ' ' + ap;
}
function manBeltWindowLabel(farm, house) {
  var s = _hhmmToMin(_manSchedFor(farm, house));
  if (s == null) return '';
  return _minToLabel(s) + '–' + _minToLabel(s + Math.round(MANURE_BELT_DUR_HR * 60));
}
function _manNowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function manBeltStatus(farm, house) {
  if (manSubRec(farm, house)) return 'done';
  var s = _hhmmToMin(_manSchedFor(farm, house));
  if (s == null) return 'none';
  var e = s + Math.round(MANURE_BELT_DUR_HR * 60);
  var now = _manNowMin();
  if (now < s) return 'upcoming';
  if (now <= e) return 'due';
  return 'missed';
}
function manBeltBadge(farm, house) {
  var st = manBeltStatus(farm, house);
  if (st === 'none' || st === 'done') return '';
  var win = manBeltWindowLabel(farm, house);
  var conf = {
    upcoming: { c: '#7a8f7a', bg: '#0f1a0f', bd: '#2a4a2a', txt: ML('🕐 Belt run', '🕐 Banda') + ' ' + win },
    due:      { c: '#4ade80', bg: '#0d2a12', bd: '#2a7a3a', txt: ML('🟢 Running now', '🟢 Corriendo ahora') + ' · ' + win },
    missed:   { c: '#f0a35a', bg: '#241505', bd: '#7a4a1a', txt: ML('⚠ Past belt-run window', '⚠ Fuera de la ventana') + ' · ' + win }
  }[st];
  return '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;color:' + conf.c + ';background:' + conf.bg + ';border:1px solid ' + conf.bd + ';border-radius:8px;padding:6px 10px;margin-bottom:9px;">' + conf.txt + ' <span style="font-weight:400;color:#6f8f6f;">· 2.0 hr</span></div>';
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

function _allHousesSubmittedToday(farm) {
  var hs = (MANURE_HOUSES[farm] || []).filter(function (h) { return !(typeof isHouseDown === 'function' && isHouseDown(farm, h)); });
  return hs.length > 0 && hs.every(function (h) { return !!manSubRec(farm, h); });
}
function _allHousesWeeklyDone(farm) {
  var hs = (MANURE_HOUSES[farm] || []).filter(function (h) { return !(typeof isHouseDown === 'function' && isHouseDown(farm, h)); });
  return hs.length > 0 && hs.every(function (h) { var r = manWeeklyRec(farm, h); return !!(r && r.done); });
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
    db.collection('manureStart').orderBy('ts', 'desc').limit(400).onSnapshot(function (snap) {
      _manureStart = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      _manureRerender();
    }, function (err) { console.error('manureStart listener:', err); });
    // Belt-run schedule (settings/manureBeltSchedule) — rarely changes, live so
    // an edit on one tablet shows on all of them.
    db.collection('settings').doc('manureBeltSchedule').onSnapshot(function (doc) {
      _manBeltSched = doc.exists ? (doc.data() || {}) : {};
      _manureRerender();
    }, function (err) { console.error('manureBeltSchedule listener:', err); });
  } catch (e) { console.error('manStartListener:', e); _manureListening = false; }
}
var _manRerenderTimer = null;
function _manureRerender() {
  var ov = document.getElementById('manure-overlay');
  if (!ov || ov.style.display === 'none') return;
  // Live, but SMOOTH (like the daily check): debounce bursty snapshot events
  // (a batch write fires several), keep the scroll position, and never repaint
  // out from under someone who's mid-entry — otherwise a teammate's live update
  // would wipe the value/note they're typing or jump their scroll.
  if (_manRerenderTimer) clearTimeout(_manRerenderTimer);
  _manRerenderTimer = setTimeout(function () {
    _manRerenderTimer = null;
    var ov2 = document.getElementById('manure-overlay');
    if (!ov2 || ov2.style.display === 'none') return;
    var ae = document.activeElement;
    if (ae && ov2.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) {
      _manRerenderTimer = setTimeout(_manureRerender, 1500);   // they're typing — retry shortly
      return;
    }
    var sy = ov2.scrollTop;
    try { renderManure(); } catch (e) { console.error('manure rerender:', e); }
    try { ov2.scrollTop = sy; } catch (e) {}
  }, 250);
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
    return '<button onclick="manureSet(\'' + farm + '\',' + house + ',' + coll + ',' + p + ')" style="flex:1;min-width:42px;padding:11px 4px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;' + st + '">' + p + '</button>';
  }).join('');
}

// Tri-state check: unset ☐ → PASS ✓ → FAIL ✗ → unset. (Old records saved
// `true` for done — treated as pass, so nothing already logged changes.)
function manChkState(rec, field) {
  var v = rec ? rec[field] : null;
  if (v === 'fail') return 'fail';
  if (v === true || v === 'pass') return 'pass';
  return 'unset';
}
function manChkFailLabel(field) {
  return {
    pmDone:  { en: 'PM/inspection FAILED', es: 'PM/inspección FALLÓ' },
    beltOk:  { en: 'belt RIPPED / failed', es: 'banda RASGADA / falló' },
    cleanOk: { en: 'NOT cleaned',          es: 'NO limpiado' },
    alignOk: { en: 'alignment OFF',        es: 'alineación MAL' }
  }[field] || { en: field + ' failed', es: field + ' falló' };
}

// One check chip (PM / Belt / Clean / Align) for a collector — pass/fail.
function manChkBtn(farm, house, coll, field, state) {
  var lbl = MAN_CHK_LABEL[field] || { en: field, es: field };
  var tip = MAN_CHK_TIP[field] || { en: '', es: '' };
  var st, mark;
  if (state === 'pass')      { st = 'background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;'; mark = '✓ '; }
  else if (state === 'fail') { st = 'background:#7a1414;border:1.5px solid #c0392b;color:#ffd7d7;'; mark = '✗ '; }
  else                       { st = 'background:#13110a;border:1.5px solid #4a4030;color:#9f8a63;'; mark = '☐ '; }
  return '<button onclick="manureCheckSet(\'' + farm + '\',' + house + ',' + coll + ',\'' + field + '\')" title="' + ML(tip.en, tip.es) + ' — ' + ML('tap: pass ✓ · again: FAIL ✗ (makes a work order) · again: clear', 'toca: pasa ✓ · otra vez: FALLA ✗ (crea orden) · otra vez: borrar') + '" style="flex:0 0 auto;min-width:56px;padding:11px 7px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;' + st + '">' + mark + ML(lbl.en, lbl.es) + '</button>';
}

function _manCollKey(farm, house, coll) { return farm + '__' + house + '__' + coll; }
function manChkFails(rec) {
  return MAN_CHK_FIELDS.filter(function (f) { return manChkState(rec, f) === 'fail'; });
}
function manIssueActive(rec) {
  return !!(rec && (rec.cantRun || Number(rec.ripLevel || 0) > 0 || manChkFails(rec).length));
}

// The small ⚠ toggle on a collector row. Red once an issue is logged.
function _manIssueBtn(farm, house, coll, active) {
  var st = active
    ? 'background:#3a0f0f;border:1.5px solid #c0392b;color:#f2a0a0;'
    : 'background:#13110a;border:1.5px solid #4a4030;color:#9f8a63;';
  return '<button onclick="manureIssueToggle(\'' + farm + '\',' + house + ',' + coll + ')" title="' + ML('Report a problem / make a work order', 'Reportar un problema / crear orden') + '" style="flex:0 0 auto;min-width:40px;padding:11px 8px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;' + st + '">⚠</button>';
}

// The expandable per-collector issue panel: can't-run + belt-rip 1/2/3 + note.
function _manIssuePanel(farm, house, coll, rec) {
  var cant = !!(rec && rec.cantRun);
  var lvl  = rec ? Number(rec.ripLevel || 0) : 0;
  var note = (rec && rec.issueNote) ? rec.issueNote : '';
  var cantSt = cant
    ? 'background:#7a1414;border:1.5px solid #c0392b;color:#fff;'
    : 'background:#0f1f0f;border:1.5px solid #5a2a2a;color:#d88;';
  var cantBtn = '<button onclick="manureCantRun(\'' + farm + '\',' + house + ',' + coll + ')" style="padding:9px 12px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;' + cantSt + '">' + (cant ? '✓ ' : '') + ML('🚫 Can’t run', '🚫 No corre') + '</button>';
  var ripBtns = [1, 2, 3].map(function (n) {
    var on = lvl === n;
    var col = MAN_RIP_COL[n];
    var st = on ? 'background:' + col + ';border:1.5px solid ' + col + ';color:#fff;' : 'background:#0f1f0f;border:1.5px solid #4a4030;color:#b09a6a;';
    return '<button onclick="manureRipSet(\'' + farm + '\',' + house + ',' + coll + ',' + n + ')" title="' + ML('Belt rip severity ', 'Gravedad de rasgadura ') + n + ' — ' + ML(MAN_RIP_LABEL[n].en, MAN_RIP_LABEL[n].es) + '" style="min-width:40px;padding:9px 4px;border-radius:7px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;' + st + '">' + n + '</button>';
  }).join('');
  var woLine = (rec && rec.woId)
    ? '<div style="margin-top:7px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#f0a35a;">🔧 ' + rec.woId + ' — ' + ML('work order created', 'orden de trabajo creada') + '</div>'
    : '';
  return '<div style="margin-top:8px;background:#160d0d;border:1px solid #4a2020;border-radius:9px;padding:9px 11px;">' +
    '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">' +
      cantBtn +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#c9a86a;margin-left:4px;">' + ML('Belt rip:', 'Rasgadura:') + '</span>' + ripBtns +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#8a7a5a;">' + ML('(3 = worst)', '(3 = peor)') + '</span>' +
    '</div>' +
    '<input type="text" value="' + String(note).replace(/"/g, '&quot;') + '" onchange="manureIssueNote(\'' + farm + '\',' + house + ',' + coll + ',this.value)" placeholder="' + ML('What’s wrong? (optional)', '¿Qué pasa? (opcional)') + '" style="width:100%;box-sizing:border-box;margin-top:8px;background:#0a1408;border:1px solid #3a2a1a;border-radius:7px;color:#e8e0c8;font-family:\'IBM Plex Mono\',monospace;font-size:11px;padding:8px 9px;">' +
    woLine +
  '</div>';
}

// Belt-run time editor (collapsible). Native <input type="time"> = reliable on
// phones. Saving writes settings/manureBeltSchedule.
function _manSchedEditor(farm) {
  if (!_manSchedOpen) return '';
  var HOUSE = ML('House', 'Casa');
  var hs = (MANURE_HOUSES[farm] || []).filter(function (h) { return !(typeof isHouseDown === 'function' && isHouseDown(farm, h)); });
  var rows = hs.map(function (h) {
    var start = _manSchedFor(farm, h);
    var endLbl = _minToLabel(_hhmmToMin(start) + Math.round(MANURE_BELT_DUR_HR * 60));
    return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#c9d9c9;min-width:64px;">' + HOUSE + ' ' + h + '</span>' +
      '<input type="time" value="' + start + '" onchange="manureBeltSchedSet(\'' + farm + '\',' + h + ',this.value)" style="background:#0a160a;border:1.5px solid #2a5a2a;border-radius:8px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:14px;padding:8px 10px;">' +
      '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#7a9a7a;">→ ' + endLbl + ' · 2.0 hr</span>' +
    '</div>';
  }).join('');
  return '<div style="background:#0c1a0c;border:1px solid #274a27;border-radius:10px;padding:12px 14px;margin-bottom:12px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ad6a0;margin-bottom:9px;">' + ML('Set each house’s 2.0-hour belt-run start time:', 'Hora de inicio de la banda (2.0 h) por casa:') + '</div>' +
    rows + '</div>';
}

// Bottom-of-page roundup: every collector with a problem logged today, across
// all houses — can't-run, belt rip (1–3), and any failed PM/Belt/Clean/Align
// check, plus the note and the work-order id if one was raised.
function _manFailuresHtml(farms) {
  var items = [];
  farms.forEach(function (farm) {
    var hs = (MANURE_HOUSES[farm] || []).filter(function (h) { return !(typeof isHouseDown === 'function' && isHouseDown(farm, h)); });
    hs.forEach(function (house) {
      for (var c = 1; c <= MANURE_COLLECTORS; c++) {
        var rec = manRec(farm, house, c);
        if (!manIssueActive(rec)) continue;
        var parts = [];
        if (rec.cantRun) parts.push(ML('🚫 can’t run', '🚫 no corre'));
        var lvl = Number(rec.ripLevel || 0);
        if (lvl > 0) parts.push(ML('belt rip ', 'rasgadura ') + lvl + (MAN_RIP_LABEL[lvl] ? ' (' + ML(MAN_RIP_LABEL[lvl].en, MAN_RIP_LABEL[lvl].es) + ')' : ''));
        manChkFails(rec).forEach(function (f) { var l = manChkFailLabel(f); parts.push(ML(l.en, l.es)); });
        items.push({ farm: farm, house: house, coll: c, txt: parts.join(' · '),
          note: (rec.issueNote || '').trim(), wo: rec.woId ? (' · ' + rec.woId) : '' });
      }
    });
  });
  if (!items.length) {
    return '<div style="background:#0d1f0d;border:1px solid #1e3a1e;border-radius:12px;padding:14px;margin-top:14px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#7ab07a;">✓ ' + ML('No manure issues logged today', 'Sin problemas de estiércol hoy') + '</div>';
  }
  var rows = items.map(function (i) {
    return '<div style="padding:9px 0;border-bottom:1px solid #2a1414;font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#f2b0a0;">' +
      '<b style="color:#ffd7d7;">' + i.farm + ' ' + ML('House', 'Casa') + ' ' + i.house + ' · C' + i.coll + '</b> — ' + i.txt + i.wo +
      (i.note ? '<div style="color:#cc9a9a;font-size:11px;font-style:italic;margin-top:2px;">“' + String(i.note).replace(/</g, '&lt;') + '”</div>' : '') +
    '</div>';
  }).join('');
  return '<div style="background:#1a0a0a;border:1.5px solid #5a2a2a;border-radius:12px;padding:14px;margin-top:14px;">' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#f2705a;margin-bottom:8px;">⚠ ' + ML('Issues logged today', 'Problemas registrados hoy') + ' (' + items.length + ')</div>' +
    rows + '</div>';
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
      var _hs = (MANURE_HOUSES[farm] || []).filter(function (h) { return !(typeof isHouseDown === 'function' && isHouseDown(farm, h)); });
      var _subCount = _hs.filter(function (h) { return !!manSubRec(farm, h); }).length;
      var _pct = _hs.length ? Math.round(_subCount / _hs.length * 100) : 0;
      body += '<div style="margin:14px 0 10px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:1px;color:' + (_pct === 100 ? '#4ade80' : '#7ab07a') + ';text-transform:uppercase;">' + (farms.length > 1 ? ('📍 ' + farm + ' · ') : '') + _subCount + '/' + _hs.length + ' ' + ML('houses submitted today', 'casas enviadas hoy') + ' · ' + _pct + '%' + (_pct === 100 ? ' ✓ ' + ML('all done', 'todo listo') : '') + '</div>' +
          '<button onclick="manureToggleSchedule()" style="flex:0 0 auto;padding:7px 11px;background:' + (_manSchedOpen ? '#14361c' : '#0f1f0f') + ';border:1px solid #2a5a2a;border-radius:8px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🕐 ' + ML('Belt-run times', 'Horarios banda') + ' ' + (_manSchedOpen ? '▴' : '▾') + '</button>' +
        '</div>' +
        '<div style="height:8px;background:#0f1f0f;border:1px solid #2a5a2a;border-radius:5px;overflow:hidden;"><div style="height:100%;width:' + _pct + '%;background:' + (_pct === 100 ? '#2e7d32' : '#5a9b4a') + ';transition:width .3s;"></div></div>' +
      '</div>';
      body += _manSchedEditor(farm);
      _hs.forEach(function (house) {
        var hkey = farm + '__' + house;
        var sub = manSubRec(farm, house);
        var subDone = !!sub;
        var subBy = (subDone && sub.by) ? ' · ' + sub.by : '';
        var srec = manStartRec(farm, house);
        var startLbl = manStartLabel(srec);
        // Submitted houses fold to a thin green bar so the crew only sees what's left.
        if (subDone && !_manureExpanded[hkey]) {
          body += '<div onclick="manureToggleHouse(\'' + farm + '\',' + house + ')" style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#0d1f0d;border:1.5px solid #2a7a3a;border-radius:12px;padding:13px 14px;margin-bottom:10px;cursor:pointer;">' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;color:#86efac;">✓ ' + HOUSE + ' ' + house + ' — ' + ML('submitted', 'enviada') + subBy + (startLbl ? ' <span style="font-weight:400;font-size:11px;color:#5a8a5a;">· ▶ ' + ML('started', 'inició') + ' ' + startLbl + '</span>' : '') + '</span>' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#5a8a5a;">' + ML('tap to reopen', 'toca para abrir') + ' ▸</span>' +
          '</div>';
          return;
        }
        var ran = 0, pmCount = 0, chkCount = 0, issueCount = 0, rows = '';
        for (var c = 1; c <= MANURE_COLLECTORS; c++) {
          var rec = manRec(farm, house, c);
          var cur = (rec && rec.pctRun != null) ? Number(rec.pctRun) : null;
          if (rec && rec.pctRun != null) ran++;
          if (manChkState(rec, 'pmDone') === 'pass') pmCount++;
          var allFour = MAN_CHK_FIELDS.every(function (f) { return manChkState(rec, f) === 'pass'; });
          if (allFour) chkCount++;
          var issue = manIssueActive(rec);
          if (issue) issueCount++;
          var chips = MAN_CHK_FIELDS.map(function (f) { return manChkBtn(farm, house, c, f, manChkState(rec, f)); }).join('');
          var _ik = _manCollKey(farm, house, c);
          // Show the panel when it's been opened, OR when an issue is active and
          // the user hasn't explicitly collapsed it (tap ⚠ to collapse/expand).
          var showPanel = (_manIssueOpen[_ik] === true) || (_manIssueOpen[_ik] !== false && issue);
          rows += '<div style="border-bottom:1px solid #163016;margin-bottom:8px;padding-bottom:8px;">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
              '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;color:' + (issue ? '#f2a0a0' : '#9ab09a') + ';min-width:26px;">C' + c + '</span>' +
              '<div style="display:flex;gap:4px;flex:1;min-width:140px;">' + manBtn(farm, house, c, cur) + '</div>' +
              '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + chips + '</div>' +
              _manIssueBtn(farm, house, c, issue) +
            '</div>' +
            (showPanel ? _manIssuePanel(farm, house, c, rec) : '') +
          '</div>';
        }
        var allRan = ran === MANURE_COLLECTORS;
        var allPM  = pmCount === MANURE_COLLECTORS;
        var allChk = chkCount === MANURE_COLLECTORS;
        rows += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#5a8a5a;margin-top:2px;line-height:1.5;">' + ML('% = belt that ran &nbsp;·&nbsp; each check: tap once = <b style="color:#86efac;">pass ✓</b>, again = <b style="color:#f2a0a0;">FAIL ✗ → work order</b>, again = clear &nbsp;·&nbsp; ⚠ = report rip / can’t run &nbsp;·&nbsp; saves as you tap', '% = banda que corrió &nbsp;·&nbsp; cada revisión: un toque = <b style="color:#86efac;">pasa ✓</b>, otro = <b style="color:#f2a0a0;">FALLA ✗ → orden de trabajo</b>, otro = borrar &nbsp;·&nbsp; ⚠ = reportar rasgadura / no corre &nbsp;·&nbsp; se guarda al tocar') + '</div>';

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
              ' <span style="font-size:11px;font-weight:400;color:' + (allChk ? '#4ade80' : '#8fae8f') + ';">· ' + chkCount + '/' + MANURE_COLLECTORS + ' ' + ML('checks', 'revis.') + (allChk ? ' ✓' : '') + '</span>' +
              (issueCount > 0 ? ' <span style="font-size:11px;font-weight:700;color:#f2705a;">· ⚠ ' + issueCount + ' ' + ML('issue', 'problema') + (issueCount > 1 ? ML('s', 's') : '') + '</span>' : '') +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              (srec ? '' : '<button onclick="manureStartRun(\'' + farm + '\',' + house + ')" style="padding:7px 11px;background:#14361c;border:1.5px solid #4ade80;border-radius:8px;color:#4ade80;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">▶ ' + ML('Start belt run', 'Iniciar banda') + '</button>') +
              '<button onclick="manureSetAll(\'' + farm + '\',' + house + ',100)" style="padding:7px 11px;background:#14532d;border:1px solid #2a7a3a;border-radius:8px;color:#86efac;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">' + ML('All 100%', 'Todo 100%') + '</button>' +
              '<button onclick="manureAllChecks(\'' + farm + '\',' + house + ')" style="padding:7px 11px;background:#1c2e14;border:1px solid #3a6a2a;border-radius:8px;color:#a7e08a;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">✓ ' + ML('All checks', 'Todo') + '</button>' +
            '</div>' +
          '</div>' +
          (srec ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;color:#4ade80;background:#0d2a12;border:1px solid #2a7a3a;border-radius:8px;padding:6px 10px;margin-bottom:9px;">▶ ' + ML('Belts started', 'Banda iniciada') + ' ' + startLbl + '</div>' : '') +
          manBeltBadge(farm, house) + rows + '</div>';
      });
    });
  }

  ov.innerHTML =
    '<div style="max-width:720px;margin:0 auto;padding:calc(env(safe-area-inset-top, 0px) + 30px) 14px 40px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<button onclick="closeManure()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">← ' + ML('Back', 'Atrás') + '</button>' +
          '<button onclick="openManureHelp()" style="padding:11px 14px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">❓ ' + ML('How to use', 'Cómo usar') + '</button>' +
        '</div>' +
        '<div style="text-align:right;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:30px;color:#f0ead8;letter-spacing:2px;line-height:1;">💩 ' + ML('MANURE', 'ESTIÉRCOL') + '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#7ab07a;margin-top:3px;">' + dateStr + '</div></div>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;line-height:1.5;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin:8px 0 16px;">' + ML('Tap <b style="color:#4ade80;">▶ Start belt run</b> when you begin — it stamps your name + start time for the house (logging the first % does it too). Each house is blocked out <b style="color:#86efac;">2.0 hours</b> to run its belts (tap <b style="color:#9ad6a0;">🕐 Belt-run times</b> to set the window). For each collector, tap the <b style="color:#86efac;">% that ran</b> (0/50/100) and tick <b style="color:#86efac;">PM · Belt · Clean · Align</b>. Use <b style="color:#86efac;">All 100%</b> / <b style="color:#a7e08a;">All checks</b> to do a whole house at once, and the manure tech ticks the <b style="color:#d8b478;">weekly PM</b>. Tap <b style="color:#f2a0a0;">⚠</b> on a collector to flag it can’t run or a belt rip (1–3, 3 = worst) — that makes a work order. Hit <b style="color:#eafff0;">Submit</b> per house. It saves as you go.', 'Toca <b style="color:#4ade80;">▶ Iniciar banda</b> al comenzar — registra tu nombre y hora de inicio de la casa (marcar el primer % también lo hace). Cada casa tiene <b style="color:#86efac;">2.0 horas</b> para correr sus bandas (toca <b style="color:#9ad6a0;">🕐 Horarios banda</b> para fijar la ventana). Para cada colector, toca el <b style="color:#86efac;">% que corrió</b> (0/50/100) y marca <b style="color:#86efac;">PM · Banda · Limpio · Alin.</b>. Usa <b style="color:#86efac;">Todo 100%</b> / <b style="color:#a7e08a;">Todo</b> para una casa entera, y el técnico marca el <b style="color:#d8b478;">PM semanal</b>. Toca <b style="color:#f2a0a0;">⚠</b> en un colector para marcar que no corre o una rasgadura (1–3, 3 = peor) — crea una orden de trabajo. Toca <b style="color:#eafff0;">Enviar</b> por casa. Se guarda solo.') + '</div>' +
      body +
      (farms.length ? _manFailuresHtml(farms) : '') +
    '</div>';
}

// ── Belt-run START stamp ────────────────────────────────────────────────────
// Records WHO started running this house's belts and WHEN. One stamp per house
// per day (first one wins — it's a start time). Stamped by tapping ▶ Start, or
// auto-stamped the moment the first belt-% is logged. Live on every device so
// a lead can see the run actually began.
async function manureStartRun(farm, house, silent) {
  if (manStartRec(farm, house)) return;              // already started today
  if (typeof db === 'undefined' || !db) return;
  var t = manToday();
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('manureStart').doc(manSubKey(farm, house, t)).set(
      { farm: farm, house: house, date: t, by: _manBy(), startedAt: Date.now(), ts: Date.now() },
      { merge: true }
    );
    if (typeof setSyncDot === 'function') setSyncDot('live');
    if (!silent && typeof toast === 'function') toast(ML('▶ House ' + house + ' — belt run started', '▶ Casa ' + house + ' — banda iniciada'));
  } catch (e) {
    console.error('manureStartRun:', e);
    if (!silent) alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}
// "6:12 AM · Maria" — start time + who, for the house card / collapsed bar.
function manStartLabel(rec) {
  if (!rec || !rec.startedAt) return '';
  try {
    var d = new Date(rec.startedAt);
    var lbl = d.toLocaleTimeString(_mlang() === 'es' ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' });
    return lbl + (rec.by ? ' · ' + rec.by : '');
  } catch (e) { return rec.by || ''; }
}

async function manureSet(farm, house, coll, pct) {
  try { manureStartRun(farm, house, true); } catch (e0) {}   // first % logged = belts started
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

// Toggle any per-collector check (pmDone / beltOk / cleanOk / alignOk).
// Pass/fail cycle: unset → PASS ✓ → FAIL ✗ → unset.
// A FAIL goes STRAIGHT to a work order (deduped per collector/day). Failing
// the Belt check also pops the rip-severity panel (1/2/3) so the WO gets the
// right urgency the moment they rate it.
async function manureCheckSet(farm, house, coll, field) {
  if (MAN_CHK_FIELDS.indexOf(field) === -1) return;
  var t = manToday();
  var rec = manRec(farm, house, coll);
  var cur = manChkState(rec, field);
  var next = cur === 'unset' ? 'pass' : cur === 'pass' ? 'fail' : false;
  var upd = { farm: farm, house: house, collector: coll, date: t, ts: Date.now() };
  upd[field] = next;
  upd[MAN_CHK_BY[field]] = _manBy();
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('manureLog').doc(manKey(farm, house, coll, t)).set(upd, { merge: true });
    if (next === 'fail') {
      if (field === 'beltOk') _manIssueOpen[_manCollKey(farm, house, coll)] = true;  // rate the rip 1/2/3
      await _manureSyncIssueWO(farm, house, coll);                                    // straight to a WO
    }
    if (typeof setSyncDot === 'function') setSyncDot('live');
    renderManure();
  } catch (e) {
    console.error('manureCheckSet:', e);
    alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function manureSetAll(farm, house, pct) {
  try { manureStartRun(farm, house, true); } catch (e0) {}   // logging %s = belts started
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

// Mark every check (PM, Belt, Clean, Align) done for all 6 collectors at once.
async function manureAllChecks(farm, house) {
  var t = manToday();
  var by = _manBy();
  var payload = { farm: farm, house: house, date: t, ts: Date.now() };
  MAN_CHK_FIELDS.forEach(function (f) { payload[f] = 'pass'; payload[MAN_CHK_BY[f]] = by; });
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    if (db && typeof db.batch === 'function') {
      var batch = db.batch();
      for (var c = 1; c <= MANURE_COLLECTORS; c++) {
        batch.set(db.collection('manureLog').doc(manKey(farm, house, c, t)), Object.assign({ collector: c }, payload), { merge: true });
      }
      await batch.commit();
    } else {
      for (var c2 = 1; c2 <= MANURE_COLLECTORS; c2++) {
        await db.collection('manureLog').doc(manKey(farm, house, c2, t)).set(Object.assign({ collector: c2 }, payload), { merge: true });
      }
    }
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manureAllChecks:', e);
    alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

// ── Belt-run issues → Work Order ────────────────────────────────────────────
function manureIssueToggle(farm, house, coll) {
  var k = _manCollKey(farm, house, coll);
  var active = manIssueActive(manRec(farm, house, coll));
  // What's showing now? (explicitly opened, OR auto-open because an issue is active)
  var shown = (_manIssueOpen[k] === true) || (_manIssueOpen[k] !== false && active);
  _manIssueOpen[k] = !shown;   // flip — lets you collapse the panel even after flagging an issue
  renderManure();
}

async function _manSaveIssue(farm, house, coll, patch) {
  var t = manToday();
  var base = { farm: farm, house: house, collector: coll, date: t, ts: Date.now() };
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('manureLog').doc(manKey(farm, house, coll, t)).set(Object.assign(base, patch), { merge: true });
    await _manureSyncIssueWO(farm, house, coll);
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('_manSaveIssue:', e);
    alert(ML('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

// Tap a rip level to set it; tap the same level again to clear the rip.
function manureRipSet(farm, house, coll, level) {
  var rec = manRec(farm, house, coll);
  var cur = rec ? Number(rec.ripLevel || 0) : 0;
  var next = (cur === level) ? 0 : level;
  _manSaveIssue(farm, house, coll, { ripLevel: next, ripBy: _manBy() });
}

function manureCantRun(farm, house, coll) {
  var rec = manRec(farm, house, coll);
  var next = !(rec && rec.cantRun);
  _manSaveIssue(farm, house, coll, { cantRun: next, cantRunBy: _manBy() });
}

function manureIssueNote(farm, house, coll, val) {
  _manSaveIssue(farm, house, coll, { issueNote: (val || '').trim() });
}

// Create/update ONE Work Order per collector reflecting its current issues.
// Deduped via the woDocId stored on the collector's manureLog doc. If the
// employee clears both issues, the WO is left open for maintenance to close.
async function _manureSyncIssueWO(farm, house, coll) {
  var rec = manRec(farm, house, coll) || {};
  var lvl   = Number(rec.ripLevel || 0);
  var cant  = !!rec.cantRun;
  var fails = manChkFails(rec);
  if (!cant && !lvl && !fails.length) return; // nothing active — don't auto-create/close
  if (typeof db === 'undefined' || !db) return;
  // Urgency: can't-run or rip 3 = URGENT · rip 2 or a ripped-belt fail = HIGH ·
  // rip 1 / other check fails = routine.
  var priority = (cant || lvl >= 3) ? 'urgent'
               : (lvl === 2 || (fails.indexOf('beltOk') !== -1 && !lvl)) ? 'high'
               : 'normal';
  var parts = [];
  if (cant) parts.push(ML('belt won’t run / area failed', 'la banda no corre / área falló'));
  if (lvl)  parts.push(ML('belt rip severity ' + lvl + ' (' + ML(MAN_RIP_LABEL[lvl].en, MAN_RIP_LABEL[lvl].es) + ')', 'rasgadura nivel ' + lvl + ' (' + ML(MAN_RIP_LABEL[lvl].en, MAN_RIP_LABEL[lvl].es) + ')'));
  fails.forEach(function (f) {
    if (f === 'beltOk' && lvl) return;   // rip severity already says it better
    var fl = manChkFailLabel(f);
    parts.push(ML(fl.en, fl.es));
  });
  var note = (rec.issueNote || '').trim();
  var desc = ML('Manure belt', 'Banda de estiércol') + ' — ' + ML('House', 'Casa') + ' ' + house + ' C' + coll + ': ' + parts.join(' + ') + (note ? ' — ' + note : '');
  var t = manToday();
  var submittedStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  try {
    if (rec.woDocId) {
      await db.collection('workOrders').doc(rec.woDocId).set(
        { problem: 'Manure System', priority: priority, desc: desc, tech: _manBy(), status: 'open', ts: Date.now() },
        { merge: true }
      );
    } else {
      var woId = await mintWoId();
      var ref = await db.collection('workOrders').add({
        id: woId, farm: farm, house: String(house),
        problem: 'Manure System', priority: priority, status: 'open',
        desc: desc, tech: _manBy(),
        notes: 'Auto-created from Manure belt-run — ' + farm + ' House ' + house + ' Collector ' + coll,
        submitted: submittedStr, date: t, ts: Date.now()
      });
      await db.collection('manureLog').doc(manKey(farm, house, coll, t)).set({ woId: woId, woDocId: ref.id }, { merge: true });
      if (typeof toast === 'function') toast(ML('Work order ' + woId + ' created — House ' + house + ' C' + coll, 'Orden ' + woId + ' creada — Casa ' + house + ' C' + coll));
    }
  } catch (e) { console.error('_manureSyncIssueWO:', e); }
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

// Save a house's belt-run start time to settings/manureBeltSchedule (merge).
async function manureBeltSchedSet(farm, house, val) {
  if (!/^\d{1,2}:\d{2}$/.test(val || '')) return;
  _manBeltSched = _manBeltSched || {};
  _manBeltSched[farm] = _manBeltSched[farm] || {};
  _manBeltSched[farm][String(house)] = val;   // optimistic local update
  renderManure();
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    var patch = {}; patch[farm] = {}; patch[farm][String(house)] = val;
    await db.collection('settings').doc('manureBeltSchedule').set(patch, { merge: true });
    if (typeof setSyncDot === 'function') setSyncDot('live');
  } catch (e) {
    console.error('manureBeltSchedSet:', e);
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

function manureToggleSchedule() { _manSchedOpen = !_manSchedOpen; renderManure(); }

async function manureSubmitHouse(farm, house) {
  // No confirm() nudge — the native mobile dialog is unreliable (returns false
  // on the phone and blocks the submit); the per-collector grid already shows
  // what's logged. Tapping Submit is intentional, so just save it.
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

// ── Manure Runs tracking log (Production → 💩 Manure Runs) ─────────────────
// Lives in the SAME place walks and employee checks are tracked (the
// Production sub-tabs). Last 30 days, one row per farm+house+day: when the
// run was STARTED and by whom, when it was SUBMITTED and by whom, how many
// collectors ran (and avg %), and how many issues were flagged.
function _manTimeLbl(ts) {
  try { return ts ? new Date(ts).toLocaleTimeString(_mlang() === 'es' ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : ''; } catch (e) { return ''; }
}
function renderProdManureRuns() {
  var el = document.getElementById('prod-sec-manure');
  if (!el || typeof db === 'undefined' || !db) return;
  el.innerHTML = '<div style="color:#aaa;font-family:\'IBM Plex Mono\',monospace;font-size:12px;margin-bottom:12px;">' + ML('Loading manure run log…', 'Cargando registro de estiércol…') + '</div>';
  var cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  Promise.all([
    db.collection('manureStart').where('ts', '>=', cutoff).orderBy('ts', 'desc').get(),
    db.collection('manureSubmit').where('ts', '>=', cutoff).orderBy('ts', 'desc').get(),
    db.collection('manureLog').where('ts', '>=', cutoff).orderBy('ts', 'desc').get()
  ]).then(function (snaps) {
    var days = {}; // farm|house|date → row
    function rowFor(x) {
      var k = x.farm + '|' + x.house + '|' + x.date;
      if (!days[k]) days[k] = { farm: x.farm, house: x.house, date: x.date, start: null, sub: null, ran: 0, pctSum: 0, issues: 0, ts: 0 };
      days[k].ts = Math.max(days[k].ts, x.ts || 0);
      return days[k];
    }
    snaps[0].forEach(function (d) { var x = d.data() || {}; if (!x.farm) return; var r = rowFor(x); r.start = x; });
    snaps[1].forEach(function (d) { var x = d.data() || {}; if (!x.farm) return; var r = rowFor(x); r.sub = x; });
    snaps[2].forEach(function (d) {
      var x = d.data() || {}; if (!x.farm) return;
      var r = rowFor(x);
      if (x.pctRun != null) { r.ran++; r.pctSum += Number(x.pctRun) || 0; }
      if (x.cantRun || Number(x.ripLevel || 0) > 0 || manChkFails(x).length) r.issues++;
    });
    var list = Object.keys(days).map(function (k) { return days[k]; });
    // Site scope like the walk logs: preferred farm only (Master sees both).
    var pref = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
    if (pref === 'Hegins' || pref === 'Danville') list = list.filter(function (r) { return r.farm === pref; });
    list.sort(function (a, b) { return (b.date > a.date ? 1 : b.date < a.date ? -1 : 0) || (b.ts - a.ts); });
    var titleBar = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;color:#a87b3a;margin-bottom:10px;">💩 ' + ML('Manure Run Log — last 30 days', 'Registro de estiércol — últimos 30 días') + '</div>';
    if (!list.length) { el.innerHTML = titleBar + '<div style="color:#888;padding:20px;text-align:center;">' + ML('No manure runs in the last 30 days.', 'Sin corridas de estiércol en los últimos 30 días.') + '</div>'; return; }
    var rows = list.map(function (r) {
      var avg = r.ran ? Math.round(r.pctSum / r.ran) : 0;
      var started = r.start
        ? '<span style="color:#4ade80;">▶ ' + _manTimeLbl(r.start.startedAt || r.start.ts) + '</span>' + (r.start.by ? ' <span style="color:#7ab07a;">' + r.start.by + '</span>' : '')
        : '<span style="color:#555;">—</span>';
      var submitted = r.sub
        ? '<span style="color:#4caf50;">✓ ' + _manTimeLbl(r.sub.ts) + '</span>' + (r.sub.by ? ' <span style="color:#7ab07a;">' + r.sub.by + '</span>' : '')
        : '<span style="color:#d69e2e;">' + ML('open', 'abierta') + '</span>';
      var ranCell = r.ran
        ? r.ran + '/' + MANURE_COLLECTORS + ' <span style="color:' + (avg >= 100 ? '#4caf50' : avg >= 50 ? '#d69e2e' : '#c0392b') + ';">' + avg + '%</span>'
        : '<span style="color:#555;">—</span>';
      var issueCell = r.issues ? '<span style="color:#e53e3e;">⚠ ' + r.issues + '</span>' : '<span style="color:#4caf50;">✓</span>';
      var dateLbl = r.date ? (r.date.slice(5).replace('-', '/')) : '—';
      return '<tr style="border-bottom:1px solid #1a2a1a;">' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + dateLbl + '</td>' +
        '<td style="padding:8px 6px;color:#7ab07a;">' + (r.farm || '—') + '</td>' +
        '<td style="padding:8px 6px;color:#aaa;">H' + (r.house != null ? r.house : '—') + '</td>' +
        '<td style="padding:8px 6px;">' + started + '</td>' +
        '<td style="padding:8px 6px;">' + submitted + '</td>' +
        '<td style="padding:8px 6px;color:#aaa;">' + ranCell + '</td>' +
        '<td style="padding:8px 6px;">' + issueCell + '</td>' +
      '</tr>';
    }).join('');
    el.innerHTML = titleBar +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#4a6a4a;margin-bottom:8px;">' + ML('▶ = when the belt run was started · ✓ = when the house was submitted', '▶ = cuándo se inició la banda · ✓ = cuándo se envió la casa') + '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-family:\'IBM Plex Mono\',monospace;font-size:12px;min-width:560px;">' +
      '<thead><tr style="border-bottom:1px solid #2a4a2a;">' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + ML('Date', 'Fecha') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + ML('Farm', 'Granja') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + ML('House', 'Casa') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + ML('Started', 'Inició') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + ML('Submitted', 'Enviada') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + ML('Ran', 'Corrió') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + ML('Issues', 'Problemas') + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }).catch(function (e) {
    el.innerHTML = '<div style="color:#e53e3e;padding:20px;">Error: ' + (e && e.message ? e.message : e) + '</div>';
  });
}

// Open the in-app How-To guide straight to the Manure section.
function openManureHelp() {
  if (typeof window.openHelp === 'function') window.openHelp('barns', 'task-barns-3');
}

if (typeof window !== 'undefined') {
  window.openManure = openManure;
  window.closeManure = closeManure;
  window.renderManure = renderManure;
  window.manureSet = manureSet;
  window.manureSetAll = manureSetAll;
  window.manureCheckSet = manureCheckSet;
  window.manureAllChecks = manureAllChecks;
  window.manureWeeklySet = manureWeeklySet;
  window.manureIssueToggle = manureIssueToggle;
  window.manureRipSet = manureRipSet;
  window.manureCantRun = manureCantRun;
  window.manureIssueNote = manureIssueNote;
  window.manureBeltSchedSet = manureBeltSchedSet;
  window.manureToggleSchedule = manureToggleSchedule;
  window.manureStartRun = manureStartRun;
  window.manureSubmitHouse = manureSubmitHouse;
  window.manureToggleHouse = manureToggleHouse;
  window.openManureHelp = openManureHelp;
  window.renderProdManureRuns = renderProdManureRuns;
}
