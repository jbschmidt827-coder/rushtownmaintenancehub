// ═══════════════════════════════════════════════════════════════════════════
// eggrun.js — Daily Egg Run (Processing → 🥚⏱ Daily Run) EN/ES
// MANUAL DAILY ENTRY (per Joe): no stopwatch. Once a day, per machine, the crew
// types the total RUN TIME (minutes off the meter) + TOTAL EGGS for the day.
// Eggs/hr is computed. A report-style DAILY SUMMARY (run time · eggs · eggs/hr,
// per plant) sits at the top of the Processing tab.
// Hegins runs 2 machines, Danville 1 (EGGRUN_MACHINES).
// Live via onSnapshot: every device sees the day's entries instantly.
// Collection: eggDailyRun, doc "<Farm>__M<machine>__<YYYY-MM-DD>"
//   { farm, machine, date, manualMin, eggs, by, ts }  (legacy runs:[] still read)
// NOTE: eggRunStart/Stop/*Sel are kept defined (legacy/back-compat) but no longer
// wired to any button — the UI is manual-entry only.
// ═══════════════════════════════════════════════════════════════════════════
const EGGRUN_MACHINES = { Hegins: [1, 2], Danville: [1] };
// Target finish ("all eggs done") time per plant. Any run time PAST this counts
// as DOWNTIME (Joe, Hegins). "HH:MM" 24h. Add plants here as targets are set.
const EGGRUN_TARGET_DONE = { Hegins: '11:48' };   // Joe 2026-07-29 (was 11:45)
// DEFAULT START TIME per plant (Joe 2026-08-03: "make hegins start at 5:30").
// Prefilled in the Start box so the crew usually never opens the time picker —
// they only change it on an off-schedule day. Danville's shift starts at 7:00.
const EGGRUN_START_DEFAULT = { Hegins: '05:30', Danville: '07:00' };
function erStartDefault(farm) { return EGGRUN_START_DEFAULT[farm] || ''; }
// HOW EGGS ARE COUNTED per plant (Joe 2026-07-30): Hegins packs by LANE off the
// machine; Danville counts by HOUSE — the packer enters the total eggs for each
// house (or the houses assigned to them). Machine total = the sum either way.
const EGGRUN_BY_HOUSE = { Danville: true };
function erByHouse(farm) { return !!EGGRUN_BY_HOUSE[farm]; }
// LANES PER MACHINE (Joe 2026-08-03: "remove the lane 2 and only have one line").
// Hegins runs ONE line per machine — lane 2 was always 0 in every record, which
// confirmed it. One box = the machine's total eggs. Old lane-2 values still count
// toward historical totals (the sum runs over the whole array).
const EGGRUN_LANES = { Hegins: 1, Danville: 1 };
function erLaneCount(farm) { var n = EGGRUN_LANES[farm]; return Math.max(1, Math.min(4, n == null ? 1 : n)); }
function erActiveHouses(farm) {
  var out = [];
  try {
    var arr = (typeof FARM_HOUSES !== 'undefined' && FARM_HOUSES[farm]) ? FARM_HOUSES[farm] : [];
    arr.forEach(function (h) {
      var n = String(h).replace(/^\s*house\s*/i, '').trim();
      if (!(typeof isHouseDown === 'function' && isHouseDown(farm, n))) out.push(n);
    });
  } catch (e) {}
  return out;
}
function erTargetDone(farm) { return EGGRUN_TARGET_DONE[farm] || null; }
function _erMinOfDay(hhmm) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; }

function erL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
// v287: this file used to borrow _esc() from maintenance.js. If maintenance.js
// ever moves, is renamed, or fails to parse, the whole 14-day history table
// silently disappears. Own helper = no cross-file dependency.
function _erEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

let _erDocs = [];          // last ~14 days of eggDailyRun docs (live)
let _poDocs = [];          // last ~14 days of opsPacking docs (eggs packed out, live)
let _erListening = false;
let _erTick = null;        // 30s ticker so "running" elapsed time counts up
let _erSel = {};           // farm__machine → checkbox state (default checked)

function erToday() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }
function erBy() { return (typeof getDeviceUser === 'function') ? (getDeviceUser() || '') : ''; }
function erKey(farm, m, date) { return farm + '__M' + m + '__' + date; }
function erRec(farm, m, date) {
  return _erDocs.find(function (r) { return r.farm === farm && Number(r.machine || 1) === Number(m) && r.date === date; });
}
// v287 — WHICH PLANTS CAN THIS PERSON ENTER? Joe's complaint was that the Danville
// card never appeared: the screen used to render ONLY getPreferredFarm(), so a
// tablet (or a Director) parked on Hegins could never reach Danville's by-house
// boxes. Now anyone whose staff record says 'Both' (Directors, Leads, floaters)
// gets both plants, with sticky chips to narrow it down. Fail-open: an unknown
// name sees both rather than being locked out of entry.
function erAllowedFarms() {
  var all = Object.keys(EGGRUN_MACHINES);
  try {
    var me = erBy();
    if (!me) return all;
    var s = (typeof staffList !== 'undefined' ? staffList : []).find(function (x) {
      return x && String(x.name || '').toLowerCase() === String(me).toLowerCase();
    });
    if (!s || !s.farm || s.farm === 'Both') return all;
    return EGGRUN_MACHINES[s.farm] ? [s.farm] : all;
  } catch (e) { return all; }
}
// ONE PLANT AT A TIME. Joe, 2026-08-12: "I ONLY WANT DANVILLE FOR DANVILLE AND
// HEGINS FOR HEGINS." The first cut of this defaulted to showing BOTH plants
// stacked, which meant a Danville tablet displayed a Hegins card it had no
// business touching (and the daily summary double-counted both plants at the
// top of the screen). Default = THIS DEVICE's plant, and the chips pick one.
function erPlantsSel() {
  var allow = erAllowedFarms();
  var pref = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  var dflt = (pref && allow.indexOf(pref) !== -1) ? pref : allow[0];
  var saved;
  try { saved = localStorage.getItem('erPlants'); } catch (e) { saved = null; }
  // v287 briefly stored a JSON array here. Collapse any old value to one plant.
  if (saved && saved.charAt(0) === '[') {
    try { var a = JSON.parse(saved); saved = (Array.isArray(a) && a.length === 1) ? a[0] : null; } catch (e) { saved = null; }
  }
  if (!saved || allow.indexOf(saved) === -1) return [dflt];
  return [saved];
}
function erTogglePlant(farm) {
  var allow = erAllowedFarms();
  if (allow.indexOf(farm) === -1) return;
  try { localStorage.setItem('erPlants', farm); } catch (e) {}
  renderEggRun();
}
function _erPlantChips() {
  var allow = erAllowedFarms();
  if (allow.length < 2) return '';
  var sel = erPlantsSel();
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  return '<div style="' + MONO + 'font-size:10px;letter-spacing:1.5px;color:#5a8a5a;text-transform:uppercase;font-weight:700;margin-bottom:6px;">' + erL('Entering for', 'Registrando para') + '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
    allow.map(function (f) {
      var on = sel.indexOf(f) !== -1;
      return '<button onclick="erTogglePlant(\'' + f + '\')" style="flex:1;min-width:120px;padding:11px 14px;border-radius:50px;cursor:pointer;' + MONO +
        'font-size:12.5px;font-weight:700;background:' + (on ? '#14361c' : '#0d1a0d') + ';border:1.5px solid ' + (on ? '#4ade80' : '#2a4a2a') +
        ';color:' + (on ? '#9ad6a0' : '#5a7a5a') + ';">' + (on ? '✓ ' : '') + f.toUpperCase() +
        (erByHouse(f) ? ('<span style="font-size:9.5px;font-weight:400;display:block;color:' + (on ? '#7ab07a' : '#4a6a4a') + ';">' + erL('by house', 'por casa') + '</span>') : '') +
      '</button>';
    }).join('') + '</div>';
}
function erFarmsInScope() { return erPlantsSel(); }   // exactly one plant
function erMachines(farm) { return EGGRUN_MACHINES[farm] || [1]; }
function erRuns(rec) { return (rec && Array.isArray(rec.runs)) ? rec.runs : []; }
function erRunning(rec) {
  var rs = erRuns(rec);
  return (rs.length && !rs[rs.length - 1].e) ? rs[rs.length - 1] : null;
}
function erTotalMs(rec) {
  // Manual run-time override (minutes) — lets the crew type the time straight off
  // a meter instead of timing with Start/Stop. When set (>0) it's the source of
  // truth for total run time (and therefore eggs/hr).
  if (rec && rec.manualMin != null && Number(rec.manualMin) > 0) return Number(rec.manualMin) * 60000;
  return erRuns(rec).reduce(function (t, r) {
    var e = r.e || Date.now();
    return t + Math.max(0, e - (r.s || e));
  }, 0);
}
function erFmtDur(ms) {
  var m = Math.round(ms / 60000), h = Math.floor(m / 60), mm = m % 60;
  return h + 'h ' + (mm < 10 ? '0' : '') + mm + 'm';
}
function erFmtTime(ts) {
  try { return ts ? new Date(ts).toLocaleTimeString(erL('en-US', 'es-ES'), { hour: 'numeric', minute: '2-digit' }) : ''; } catch (e) { return ''; }
}

// ── Machine checkbox selection (multi-machine plants) ───────────────────────
function erSelGet(farm, m) { return _erSel[farm + '__' + m] !== false; }   // default: checked
function eggRunSelToggle(farm, m) {
  _erSel[farm + '__' + m] = !erSelGet(farm, m);
  renderEggRun();
}
function erSelected(farm) {
  return erMachines(farm).filter(function (m) { return erSelGet(farm, m); });
}

// ── Live listener (last 14 days) ────────────────────────────────────────────
function erStartListener() {
  if (_erListening || typeof db === 'undefined' || !db) return;
  _erListening = true;
  try {
    var cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    db.collection('eggDailyRun').where('ts', '>=', cutoff).orderBy('ts', 'desc').onSnapshot(function (snap) {
      _erDocs = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      _erRerender();
    }, function (err) { console.error('eggDailyRun listener:', err); });
    db.collection('opsPacking').where('ts', '>=', cutoff).onSnapshot(function (snap) {
      _poDocs = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      _erRerender();
    }, function (err) { console.error('opsPacking listener:', err); });
  } catch (e) { console.error('erStartListener:', e); _erListening = false; }
}
function _erVisible() {
  var el = document.getElementById('pkg-dailyrun');
  return el && el.style.display !== 'none' && el.offsetParent !== null;
}
function _erRerender() {
  if (!_erVisible()) return;
  var ae = document.activeElement;   // don't clobber an eggs field mid-typing
  if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && document.getElementById('pkg-dailyrun') && document.getElementById('pkg-dailyrun').contains(ae)) return;
  try { renderEggRun(); } catch (e) { console.error('eggrun rerender:', e); }
}

// ── Save helpers (always first-tap save, toast confirmation) ────────────────
async function _erSave(farm, m, patch) {
  var t = erToday();
  var base = { farm: farm, machine: Number(m), date: t, ts: Date.now() };
  if (typeof setSyncDot === 'function') setSyncDot('saving');
  await db.collection('eggDailyRun').doc(erKey(farm, m, t)).set(Object.assign(base, patch), { merge: true });
  if (typeof setSyncDot === 'function') setSyncDot('live');
}

async function eggRunStart(farm, m, silent) {
  try {
    var rec = erRec(farm, m, erToday());
    if (erRunning(rec)) return false;                 // already running
    var runs = erRuns(rec).slice();
    runs.push({ s: Date.now(), by: erBy() });
    await _erSave(farm, m, { runs: runs, by: erBy() });
    if (!silent && typeof toast === 'function') toast('▶ ' + farm + ' M' + m + erL(' started', ' iniciada'));
    renderEggRun();
    return true;
  } catch (e) {
    console.error('eggRunStart:', e);
    if (typeof toast === 'function') toast(erL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
    return false;
  }
}

async function eggRunStop(farm, m, silent) {
  try {
    var rec = erRec(farm, m, erToday());
    if (!erRunning(rec)) return false;                // not running
    var runs = erRuns(rec).slice();
    runs[runs.length - 1] = Object.assign({}, runs[runs.length - 1], { e: Date.now(), eBy: erBy() });
    await _erSave(farm, m, { runs: runs });
    if (!silent && typeof toast === 'function') toast('⏹ ' + farm + ' M' + m + erL(' stopped — ', ' detenida — ') + erFmtDur(erTotalMs({ runs: runs })) + erL(' today', ' hoy'));
    renderEggRun();
    return true;
  } catch (e) {
    console.error('eggRunStop:', e);
    if (typeof toast === 'function') toast(erL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
    return false;
  }
}

// One big button acting on the CHECKED machines (multi-machine plants).
async function eggRunStartSel(farm) {
  var sel = erSelected(farm);
  if (!sel.length) { if (typeof toast === 'function') toast(erL('☐ Tick a machine first', '☐ Marca una máquina primero')); return; }
  var started = [];
  for (var i = 0; i < sel.length; i++) { if (await eggRunStart(farm, sel[i], true)) started.push('M' + sel[i]); }
  if (typeof toast === 'function') {
    toast(started.length ? ('▶ ' + farm + ' ' + started.join(' + ') + erL(' started', ' iniciada(s)')) : erL('Already running', 'Ya está corriendo'));
  }
}
async function eggRunStopSel(farm) {
  var sel = erSelected(farm);
  if (!sel.length) { if (typeof toast === 'function') toast(erL('☐ Tick a machine first', '☐ Marca una máquina primero')); return; }
  var stopped = [];
  for (var i = 0; i < sel.length; i++) { if (await eggRunStop(farm, sel[i], true)) stopped.push('M' + sel[i]); }
  if (typeof toast === 'function') {
    toast(stopped.length ? ('⏹ ' + farm + ' ' + stopped.join(' + ') + erL(' stopped', ' detenida(s)')) : erL('Nothing running to stop', 'Nada corriendo para detener'));
  }
}

async function eggRunEggsSet(farm, m, val) {
  try {
    var n = Math.max(0, Math.round(Number(val) || 0));
    await _erSave(farm, m, { eggs: n, eggsBy: erBy() });
    if (typeof toast === 'function') toast('🥚 ' + farm + ' M' + m + erL(' eggs saved: ', ' — huevos guardados: ') + n.toLocaleString());
    renderEggRun();
  } catch (e) {
    console.error('eggRunEggsSet:', e);
    if (typeof toast === 'function') toast(erL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

// Manual run-time entry (minutes) — meter reading instead of Start/Stop timing.
async function eggRunSetManualMin(farm, m, val) {
  try {
    var n = (val === '' || val == null) ? null : Math.max(0, Math.round(Number(val) || 0));
    await _erSave(farm, m, { manualMin: n, manualBy: erBy() });
    if (typeof toast === 'function') toast(n ? ('⏱ ' + farm + ' M' + m + erL(' run time: ', ' — tiempo: ') + n + ' min') : erL('Manual time cleared', 'Tiempo manual borrado'));
    renderEggRun();
  } catch (e) {
    console.error('eggRunSetManualMin:', e);
    if (typeof toast === 'function') toast(erL('Could not save time: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
  }
}

// Run minutes from actual clock start/stop ("HH:MM"). Handles a run past midnight.
function _erMinFromClock(start, stop) {
  var a = /^(\d{1,2}):(\d{2})$/.exec(String(start || '')), b = /^(\d{1,2}):(\d{2})$/.exec(String(stop || ''));
  if (!a || !b) return null;
  var s = (+a[1]) * 60 + (+a[2]), e = (+b[1]) * 60 + (+b[2]);
  var d = e - s; if (d < 0) d += 1440;
  return d;
}
// "06:30" → "6:30 AM" for display (raw text if not HH:MM).
function erFmtClock(v) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); if (!m) return v || '';
  var h = +m[1], ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12;
  return h + ':' + m[2] + ' ' + ap;
}
// ── ✎ Edit a PAST day's row (v280) ─────────────────────────────────────────
// Accepts "05:30-11:48" (clock range), a single "11:48" (stop, keeping the saved
// start), or plain minutes "372". Writes manualMin so eggs/hr recomputes, and
// stamps who fixed it. Also fixes that day's eggs on request.
async function erEditRow(farm, m, date, what) {
  try {
    if (typeof db === 'undefined' || !db || !date) return;
    var rec = _erDocs.find(function (r) { return r.farm === farm && Number(r.machine || 1) === Number(m) && r.date === date; }) || {};
    var lbl = farm + ' M' + m + ' · ' + date;
    var save = function (patch) {
      patch.editedBy = erBy(); patch.editedTs = Date.now(); patch.ts = Date.now();
      return db.collection('eggDailyRun').doc(erKey(farm, m, date))
        .set(Object.assign({ farm: farm, machine: Number(m), date: date }, patch), { merge: true })
        .then(function () { if (typeof toast === 'function') toast('✎ ' + lbl + ' ' + erL('updated', 'actualizado')); renderEggRun(); })
        .catch(function (e) { console.error('erEditRow save:', e); if (typeof toast === 'function') toast(erL('Could not save', 'No se pudo guardar')); });
    };
    if (what === 'eggs') {
      var askE = erL('Total eggs for ' + lbl + '?', '¿Total de huevos para ' + lbl + '?');
      var goE = function (v) {
        v = String(v == null ? '' : v).replace(/[, ]/g, '').trim(); if (!v) return;
        if (!/^\d+$/.test(v)) { if (typeof toast === 'function') toast(erL('Numbers only', 'Solo números')); return; }
        save({ eggs: parseInt(v, 10), eggsBy: erBy() });
      };
      if (typeof promptInline === 'function') promptInline(askE, goE); else goE(window.prompt(askE, rec.eggs != null ? rec.eggs : ''));
      return;
    }
    var cur = (rec.startClock && rec.stopClock) ? (rec.startClock + '-' + rec.stopClock)
            : (rec.manualMin != null ? String(rec.manualMin) : '');
    var askT = erL('Run time for ' + lbl + '? Type 05:30-11:48, or just minutes (372).',
                   '¿Tiempo de ' + lbl + '? Escribe 05:30-11:48, o solo minutos (372).');
    var goT = function (v) {
      v = String(v == null ? '' : v).trim(); if (!v) return;
      var mins = null, patch = {};
      var rng = /^(\d{1,2}):(\d{2})\s*[-–to]+\s*(\d{1,2}):(\d{2})$/i.exec(v);
      var one = /^(\d{1,2}):(\d{2})$/.exec(v);
      if (rng) {
        var a = (+rng[1]) * 60 + (+rng[2]), b = (+rng[3]) * 60 + (+rng[4]);
        if (b <= a) b += 1440;                       // ran past midnight
        mins = b - a;
        patch.startClock = ('0' + rng[1]).slice(-2) + ':' + rng[2];
        patch.stopClock  = ('0' + rng[3]).slice(-2) + ':' + rng[4];
      } else if (one) {
        var st = rec.startClock || (typeof erStartDefault === 'function' ? erStartDefault(farm) : '');
        var sm = /^(\d{1,2}):(\d{2})$/.exec(st || '');
        if (!sm) { if (typeof toast === 'function') toast(erL('No start time saved — type the range 05:30-11:48', 'Sin hora de inicio — escribe el rango 05:30-11:48')); return; }
        var s1 = (+sm[1]) * 60 + (+sm[2]), s2 = (+one[1]) * 60 + (+one[2]);
        if (s2 <= s1) s2 += 1440;
        mins = s2 - s1;
        patch.startClock = ('0' + sm[1]).slice(-2) + ':' + sm[2];
        patch.stopClock  = ('0' + one[1]).slice(-2) + ':' + one[2];
      } else if (/^\d+$/.test(v)) {
        mins = parseInt(v, 10);
      } else {
        if (typeof toast === 'function') toast(erL('Type 05:30-11:48 or minutes like 372', 'Escribe 05:30-11:48 o minutos como 372'));
        return;
      }
      if (!(mins > 0) || mins > 960) { if (typeof toast === 'function') toast(erL('That run time looks wrong — check it', 'Ese tiempo no cuadra — revísalo')); return; }
      patch.manualMin = mins; patch.manualBy = erBy();
      save(patch);
    };
    if (typeof promptInline === 'function') promptInline(askT, goT); else goT(window.prompt(askT, cur));
  } catch (e) { console.error('erEditRow:', e); }
}

// ── Time-picker guards (v268) ──────────────────────────────────────────────
var _erRenderOnBlur = false;
function _erTimeFocused() {
  try { var a = document.activeElement; return !!(a && a.tagName === 'INPUT' && a.type === 'time'); } catch (e) { return false; }
}
function erTimeBlur() {
  // Give iOS a beat to finish dismissing its wheel before we repaint.
  setTimeout(function () {
    if (_erTimeFocused()) return;            // moved to the other time box — wait
    if (!_erRenderOnBlur) return;
    _erRenderOnBlur = false;
    try { renderEggRun(); } catch (e) {}
  }, 250);
}

// Save an actual start/stop time-of-day; run time (manualMin) is recomputed from the pair.
async function eggRunSetClock(farm, m, which, val) {
  try {
    var rec = erRec(farm, m, erToday()) || {};
    var patch = {}; patch[which === 'stop' ? 'stopClock' : 'startClock'] = val || null;
    var start = which === 'start' ? val : (rec.startClock || null);
    var stop = which === 'stop' ? val : (rec.stopClock || null);
    var rm = _erMinFromClock(start, stop);
    if (rm != null) patch.manualMin = rm;
    // Anything past the plant's target done-time is downtime (Hegins target 11:45).
    var tgt = _erMinOfDay(erTargetDone(farm)), stopMin = _erMinOfDay(stop);
    if (tgt != null && stopMin != null) patch.downtimeMin = Math.max(0, stopMin - tgt);
    patch.manualBy = erBy();
    await _erSave(farm, m, patch);
    if (typeof toast === 'function') toast('⏱ ' + farm + ' M' + m + ' ' + (which === 'stop' ? erL('stop', 'fin') : erL('start', 'inicio')) + ' ' + erFmtClock(val));
    // DON'T re-render while the crew is still in the time field (Joe 2026-08-03:
    // "hard time picking time, window closes too fast"). Re-rendering replaced the
    // <input> the native picker was attached to, which slammed the picker shut on
    // the first digit. erTimeBlur() repaints once they're done.
    _erRenderOnBlur = true;
    if (!_erTimeFocused()) { _erRenderOnBlur = false; renderEggRun(); }
  } catch (e) { console.error('eggRunSetClock:', e); if (typeof toast === 'function') toast(erL('Could not save time', 'No se pudo guardar')); }
}
// Each machine = 1 packer running 2 lanes. Save the packer name (onchange/blur so
// typing isn't interrupted).
async function eggRunSetPacker(farm, m, val) {
  try { await _erSave(farm, m, { packer: (val || '').trim(), manualBy: erBy() }); }
  catch (e) { console.error('eggRunSetPacker:', e); }
}
// Lanes running on this machine (default 2).
async function eggRunSetLanes(farm, m, val) {
  try {
    var n = (val === '' || val == null) ? null : Math.max(0, Math.round(Number(val) || 0));
    await _erSave(farm, m, { lanes: n, manualBy: erBy() });
    renderEggRun();
  } catch (e) { console.error('eggRunSetLanes:', e); }
}
// CASE WEIGHT (Joe 2026-08-11) — avg lb per case for that machine/day. Gives
// total lbs packed + lb/hr, and a trend that reveals egg size drifting.
async function eggRunSetCaseWt(farm, m, val) {
  try {
    var v = (val === '' || val == null) ? null : Number(val);
    if (v != null && (isNaN(v) || v <= 0 || v > 120)) {
      if (typeof toast === 'function') toast(erL('Case weight looks wrong', 'El peso de caja no cuadra'));
      return;
    }
    await _erSave(farm, m, { caseWt: v, caseWtBy: erBy() });
    if (typeof toast === 'function' && v != null) toast('CASE WT ' + farm + ' M' + m + ': ' + v + ' lb');
    renderEggRun();
  } catch (e) { console.error('eggRunSetCaseWt:', e); }
}

// Eggs entered PER HOUSE (Danville). Machine total = sum of the houses, so
// eggs/min, the packer table and the daily summary all still work off one number.
async function eggRunSetHouseEggs(farm, m, house, val) {
  try {
    var rec = erRec(farm, m, erToday()) || {};
    var map = Object.assign({}, rec.houseEggs || {});
    var n = Math.max(0, Math.round(Number(val) || 0));
    if (n > 0) map[String(house)] = n; else delete map[String(house)];
    var total = Object.keys(map).reduce(function (s, k) { return s + (Number(map[k]) || 0); }, 0);
    await _erSave(farm, m, { houseEggs: map, eggs: total, eggsBy: erBy() });
    if (typeof toast === 'function') toast('🥚 ' + farm + ' H' + house + ': ' + n.toLocaleString());
    renderEggRun();
  } catch (e) { console.error('eggRunSetHouseEggs:', e); if (typeof toast === 'function') toast(erL('Could not save', 'No se pudo guardar')); }
}

// Eggs entered PER LANE. Machine total (eggs) = sum of the lanes, kept in sync so
// eggs/min + the daily summary still work off one number.
async function eggRunSetLaneEggs(farm, m, idx, val) {
  try {
    var rec = erRec(farm, m, erToday()) || {};
    var lanesN = (rec.lanes != null) ? Number(rec.lanes) : 2; if (lanesN < 1) lanesN = 1;
    var arr = Array.isArray(rec.laneEggs) ? rec.laneEggs.slice() : [];
    while (arr.length < lanesN) arr.push(0);
    arr[idx] = Math.max(0, Math.round(Number(val) || 0));
    var total = arr.reduce(function (s, v) { return s + (Number(v) || 0); }, 0);
    await _erSave(farm, m, { laneEggs: arr, eggs: total, eggsBy: erBy() });
    if (typeof toast === 'function') toast('🥚 ' + farm + ' M' + m + ' L' + (idx + 1) + ': ' + arr[idx].toLocaleString());
    renderEggRun();
  } catch (e) { console.error('eggRunSetLaneEggs:', e); if (typeof toast === 'function') toast(erL('Could not save', 'No se pudo guardar')); }
}

// ── Render ──────────────────────────────────────────────────────────────────
// Per-machine status line ("M1 🟢 running since 6:05 · Joe · 2h 10m").
function _erStatusLine(farm, m, rec, multi) {
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var running = erRunning(rec);
  var totalMs = erTotalMs(rec);
  var tag = multi ? '<b style="color:#d6b36a;">M' + m + '</b> ' : '';
  if (running) {
    return '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#4ade80;background:#0d2a12;border:1px solid #2a7a3a;border-radius:8px;padding:7px 10px;margin:5px 0;">' + tag + '🟢 ' +
      erL('RUNNING — started ', 'CORRIENDO — inició ') + erFmtTime(running.s) + (running.by ? ' · ' + running.by : '') +
      ' · <span style="color:#a7e08a;">' + erFmtDur(totalMs) + erL(' today', ' hoy') + '</span></div>';
  }
  if (erRuns(rec).length) {
    return '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#d8b478;background:#1a1408;border:1px solid #5a4a2a;border-radius:8px;padding:7px 10px;margin:5px 0;">' + tag + '⏸ ' +
      erL('Stopped — total run ', 'Detenida — tiempo total ') + '<span style="color:#f0d68a;">' + erFmtDur(totalMs) + '</span></div>';
  }
  return multi
    ? '<div style="' + MONO + 'font-size:12px;color:#7a8f7a;background:#0f1a0f;border:1px solid #2a4a2a;border-radius:8px;padding:7px 10px;margin:5px 0;">' + tag + '— ' + erL('not started yet today', 'aún no ha iniciado hoy') + '</div>'
    : '';
}
// 📉 Downtime by day — ONE ROW PER MACHINE (Joe 2026-08-11: "i dont want the run
// time together"). M1 and M2 run at the SAME time, so adding their minutes made
// a 6h day look like 12h. Each machine gets its own run time and downtime;
// downtime = minutes finished PAST the plant target (Hegins 11:48) + logged
// offMin. A per-day sub-line shows the plant total eggs/cases for that date.
function _erDowntimeByDay(farms) {
  var MONO2 = "font-family:'IBM Plex Mono',monospace;";
  var rows = _erDocs.slice()
    .filter(function (r) { return farms.indexOf(r.farm) !== -1 && r.date; })
    .map(function (r) {
      var mins = _erMinFromClock(r.startClock, r.stopClock);
      if (mins == null && r.manualMin != null) mins = Number(r.manualMin) || 0;
      var tgt = _erMinOfDay(erTargetDone(r.farm)), stopM = _erMinOfDay(r.stopClock);
      var late = (tgt != null && stopM != null) ? Math.max(0, stopM - tgt) : (Number(r.downtimeMin) || 0);
      var dt = late + (r.offMin != null ? (Number(r.offMin) || 0) : 0);
      var eggs = Number(r.eggs) || 0;
      var cases = eggs ? Math.round(eggs / ER_EGGS_PER_CASE) : 0;
      return {
        farm: r.farm, date: r.date, machine: Number(r.machine || 1),
        start: r.startClock || null, stop: r.stopClock || null,
        mins: mins || 0, dt: dt, late: late, off: (r.offMin != null ? Number(r.offMin) : null),
        eggs: eggs, cases: cases,
        cph: (mins > 5 && cases) ? Math.round(cases / (mins / 60) * 10) / 10 : null,
        lbs: (r.caseWt != null && cases) ? Math.round(cases * Number(r.caseWt)) : null
      };
    })
    .sort(function (a, b) {
      return (b.date > a.date ? 1 : b.date < a.date ? -1 : 0) ||
             (a.farm > b.farm ? 1 : a.farm < b.farm ? -1 : 0) ||
             (a.machine - b.machine);
    });
  if (!rows.length) return '';
  // period totals: downtime sums (real lost time), run time = LONGEST machine per
  // day (the plant's actual span), eggs = sum.
  var tDt = 0, tEggs = 0, spanByDay = {}, dtDays = {};
  rows.forEach(function (r) {
    tDt += r.dt; tEggs += r.eggs;
    var k = r.farm + '|' + r.date;
    spanByDay[k] = Math.max(spanByDay[k] || 0, r.mins);
    if (r.dt > 0) dtDays[k] = 1;
  });
  var tSpan = Object.keys(spanByDay).reduce(function (a, k) { return a + spanByDay[k]; }, 0);
  var nDays = Object.keys(spanByDay).length;
  var lastDay = null;
  var body = rows.map(function (r) {
    var dc = r.dt === 0 ? '#4ade80' : r.dt <= 30 ? '#e8c96a' : '#f87171';
    var dayKey = r.farm + '|' + r.date;
    var newDay = dayKey !== lastDay; lastDay = dayKey;
    return '<tr style="border-bottom:1px solid #1a2a1a;' + (newDay ? 'border-top:1px solid #2a4a2a;' : '') + '">' +
      '<td style="padding:8px 6px;color:' + (newDay ? '#f0ead8' : '#4a6a4a') + ';">' + (newDay ? (r.date || '').slice(5).replace('-', '/') : '') + '</td>' +
      '<td style="padding:8px 6px;color:' + (newDay ? '#7ab07a' : '#3a5a3a') + ';">' + (newDay ? r.farm : '') + '</td>' +
      '<td style="padding:8px 6px;text-align:center;color:#d6b36a;font-weight:700;">M' + r.machine + '</td>' +
      '<td style="padding:8px 6px;text-align:center;color:#9cc0f6;font-size:11px;">' +
        (r.start ? erFmtClock(r.start) : '—') + ' → ' + (r.stop ? erFmtClock(r.stop) : '—') + '</td>' +
      '<td style="padding:8px 6px;text-align:center;color:#9ad6a0;font-weight:700;">' + (r.mins ? erFmtDur(r.mins * 60000) : '—') + '</td>' +
      '<td style="padding:8px 6px;text-align:center;font-weight:700;color:' + dc + ';">' + (r.dt ? _erDurShort(r.dt * 60000) : '0m') +
        ((r.late > 0 || r.off) ? ('<div style="' + MONO2 + 'font-size:9px;color:#a08a6a;font-weight:400;margin-top:2px;">' +
          (r.late > 0 ? (erL('past target', 'pasó meta') + ' +' + _erDurShort(r.late * 60000)) : '') +
          (r.off ? ((r.late > 0 ? ' · ' : '') + erL('stopped ', 'parado ') + _erDurShort(r.off * 60000)) : '') + '</div>') : '') + '</td>' +
      '<td style="padding:8px 6px;text-align:center;color:#f0d68a;">' + (r.eggs ? r.eggs.toLocaleString() : '—') + '</td>' +
      '<td style="padding:8px 6px;text-align:center;color:#cfe0a0;">' + (r.cases ? r.cases.toLocaleString() : '—') + '</td>' +
      '<td style="padding:8px 6px;text-align:center;color:#4ade80;font-weight:700;">' + (r.cph != null ? r.cph : '—') + '</td>' +
      '<td style="padding:8px 6px;text-align:center;color:#f0d68a;">' + (r.lbs != null ? r.lbs.toLocaleString() : '—') + '</td>' +
    '</tr>';
  }).join('');
  return '<div style="' + MONO2 + 'font-size:12px;font-weight:700;color:#f0a35a;margin:18px 0 6px;">📉 ' +
      erL('Downtime by day · per machine', 'Paro por día · por máquina') + '</div>' +
    '<div style="' + MONO2 + 'font-size:10px;color:#7a9a7a;margin-bottom:7px;">' +
      erL('Each machine has its OWN run time (they run at the same time — never added together). Downtime = minutes finished past ' +
          (erTargetDone(farms[0]) ? erFmtClock(erTargetDone(farms[0])) : 'target') + ' + any stopped minutes logged.',
          'Cada máquina tiene su PROPIO tiempo (corren a la vez — nunca se suman). Paro = minutos después de la meta + minutos parados.') + '</div>' +
    '<div style="background:#1a1208;border:1.5px solid #5a4a1a;border-radius:10px;padding:10px 12px;margin-bottom:9px;' + MONO2 + 'font-size:12px;color:#f0d68a;">' +
      '⏱ ' + _erDurShort(tDt * 60000) + ' ' + erL('total downtime', 'paro total') +
      ' · ' + Object.keys(dtDays).length + '/' + nDays + ' ' + erL('days with downtime', 'días con paro') +
      ' · ' + erL('plant time ', 'tiempo planta ') + erFmtDur(tSpan * 60000) +
      ' · ' + _erNum(Math.round(tEggs / ER_EGGS_PER_CASE)) + ' ' + erL('cases', 'cajas') +
    '</div>' +
    '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO2 + 'font-size:12px;min-width:700px;">' +
    '<thead><tr style="border-bottom:1px solid #2a4a2a;">' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Date', 'Fecha') + '</th>' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Farm', 'Granja') + '</th>' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + erL('Mach.', 'Máq.') + '</th>' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + erL('Ran', 'Corrió') + '</th>' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + erL('Run time', 'Tiempo') + '</th>' +
      '<th style="padding:8px 6px;color:#f0a35a;text-align:center;">' + erL('Downtime', 'Paro') + '</th>' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + erL('Eggs', 'Huevos') + '</th>' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + erL('Cases', 'Cajas') + '</th>' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + erL('Cases/hr', 'Cajas/hr') + '</th>' +
      '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + erL('Total lb', 'Total lb') + '</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table></div>';
}
function _erNum(n) { try { return Number(n || 0).toLocaleString(); } catch (e) { return String(n || 0); } }
// "7m" reads better than "0h 07m" for small downtime numbers.
function _erDurShort(ms) {
  var m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return m + 'm';
  return Math.floor(m / 60) + 'h ' + (m % 60 < 10 ? '0' : '') + (m % 60) + 'm';
}

// Per-machine MANUAL entry: run time (min) + total eggs, computed eggs/hr.
function _erMachineDetail(farm, m, rec, multi) {
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var packer = (rec && rec.packer) ? rec.packer : '';
  var nLanes = erLaneCount(farm);          // fixed per plant (Hegins = 1 line)
  var lanes = nLanes;
  var laneEggs = (rec && Array.isArray(rec.laneEggs)) ? rec.laneEggs.slice() : [];
  var laneSum = laneEggs.reduce(function (s, v) { return s + (Number(v) || 0); }, 0);
  var byHouse = erByHouse(farm);
  var houseEggs = (rec && rec.houseEggs) ? rec.houseEggs : {};
  var houseSum = Object.keys(houseEggs).reduce(function (s, k) { return s + (Number(houseEggs[k]) || 0); }, 0);
  var eggs = byHouse
    ? (houseSum > 0 ? houseSum : (rec && rec.eggs != null ? Number(rec.eggs) : null))
    : (laneSum > 0 ? laneSum : (rec && rec.eggs != null ? Number(rec.eggs) : null));
  // Prefill the plant's normal start (Hegins 5:30) — saved only when the crew
  // touches a field, so an untouched day never invents a run.
  var startC = (rec && rec.startClock) ? rec.startClock : erStartDefault(farm);
  var stopC = (rec && rec.stopClock) ? rec.stopClock : '';
  var mins = _erMinFromClock(startC, stopC);
  if (mins == null && rec && rec.manualMin != null) mins = Number(rec.manualMin);  // legacy fallback
  var hrs = (mins || 0) / 60;
  var eph = (eggs && hrs > 0.05) ? Math.round(eggs / hrs) : null;
  var epm = (eggs && mins > 0) ? Math.round(eggs / mins) : null;
  var by = (rec && (rec.manualBy || rec.eggsBy || rec.by)) ? (rec.manualBy || rec.eggsBy || rec.by) : '';
  var inp = 'background:#0a1408;border:1.5px solid #2a5a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:15px;font-weight:700;padding:9px 11px;color-scheme:dark;';
  return '<div style="' + (multi ? 'border-top:1px dashed #2a5a2a;padding-top:12px;margin-top:12px;' : '') + '">' +
    '<div style="' + MONO + 'font-size:12px;color:#d6b36a;font-weight:700;margin-bottom:8px;">🖥 ' + erL('Machine', 'Máquina') + ' ' + m + '</div>' +
    // Packer + lanes
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
      '<label style="' + MONO + 'font-size:12px;color:#9cc0f6;font-weight:700;min-width:135px;">👷 ' + erL('Packer', 'Empacador') + '</label>' +
      '<input list="staff-datalist" value="' + String(packer).replace(/"/g, '&quot;') + '" onchange="eggRunSetPacker(\'' + farm + '\',' + m + ',this.value)" placeholder="' + erL('name', 'nombre') + '" autocomplete="off" style="flex:2;min-width:120px;' + inp + '">' +
      /* Lanes box removed v268 — one line per machine, nothing to choose. */
    '</div>' +
    // Start + Stop time of day
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;">' +
      '<label style="' + MONO + 'font-size:12px;color:#9ad6a0;font-weight:700;min-width:135px;">⏱ ' + erL('Start / Stop time', 'Hora inicio / fin') + '</label>' +
      '<input type="time" step="60" value="' + startC + '" onchange="eggRunSetClock(\'' + farm + '\',' + m + ',\'start\',this.value)" onblur="erTimeBlur()" style="flex:1;min-width:110px;' + inp + '">' +
      '<input type="time" step="60" value="' + stopC + '" onchange="eggRunSetClock(\'' + farm + '\',' + m + ',\'stop\',this.value)" onblur="erTimeBlur()" style="flex:1;min-width:110px;' + inp + '">' +
      (mins != null ? '<span style="' + MONO + 'font-size:12px;color:#4ade80;font-weight:700;">= ' + erFmtDur(mins * 60000) + ' ' + erL('run', 'corrida') + '</span>' : '') +
    '</div>' +
    // Target done-time + downtime past it (Hegins target 11:45)
    (function () {
      var tgt = erTargetDone(farm); if (!tgt) return '';
      var tgtM = _erMinOfDay(tgt), stopM = _erMinOfDay(stopC);
      var line;
      if (stopM == null) { line = '<span style="color:#d6b36a;">🎯 ' + erL('target done ', 'meta ') + erFmtClock(tgt) + '</span>'; }
      else if (stopM <= tgtM) { line = '<span style="color:#4ade80;font-weight:700;">🎯 ✅ ' + erL('done by ', 'terminó antes de ') + erFmtClock(tgt) + '</span>'; }
      else { var dt = stopM - tgtM; line = '<span style="color:#f87171;font-weight:700;">🎯 ⚠ ' + erFmtDur(dt * 60000) + ' ' + erL('downtime past ', 'de paro después de ') + erFmtClock(tgt) + '</span>'; }
      return '<div style="' + MONO + 'font-size:11px;margin-top:8px;background:#0c1a0c;border:1px solid #1e3a1e;border-radius:8px;padding:7px 10px;">' + line + '</div>';
    })() +
    // Eggs BY LANE (2 lanes/machine) → machine total + eggs/min + eggs/hr
    '<div style="margin-top:10px;">' +
      '<label style="' + MONO + 'font-size:12px;color:#f0d68a;font-weight:700;display:block;margin-bottom:5px;">🥚 ' +
        (byHouse ? erL('Eggs by house', 'Huevos por casa')
                 : (nLanes === 1 ? erL('Total eggs', 'Total de huevos') : erL('Eggs by lane', 'Huevos por carril'))) + '</label>' +
      (byHouse
        ? (function () {
            // Danville: one box per active house — the packer enters that house's
            // total eggs. Machine total = the sum of the houses they ran.
            var hs = erActiveHouses(farm);
            var cols = Math.min(4, Math.max(2, hs.length));
            var out = '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:8px;">';
            hs.forEach(function (h) {
              var hv = (houseEggs[h] != null && houseEggs[h] !== '') ? houseEggs[h] : '';
              out += '<div>' +
                '<div style="' + MONO + 'font-size:10px;color:#9cc0f6;margin-bottom:3px;">' + erL('House', 'Casa') + ' ' + h + '</div>' +
                '<input type="number" min="0" inputmode="numeric" value="' + hv + '" onchange="eggRunSetHouseEggs(\'' + farm + '\',' + m + ',\'' + h + '\',this.value)" placeholder="0" style="width:100%;box-sizing:border-box;background:#0a1408;border:1.5px solid #5a4a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:16px;font-weight:700;padding:9px 10px;">' +
              '</div>';
            });
            return out + '</div>';
          })()
        : ('<div style="display:grid;grid-template-columns:repeat(' + nLanes + ',1fr);gap:8px;">' +
            (function () {
              var out = '';
              for (var i = 0; i < nLanes; i++) {
                var lv = (laneEggs[i] != null && laneEggs[i] !== '') ? laneEggs[i] : '';
                out += '<div>' +
                  (nLanes > 1 ? ('<div style="' + MONO + 'font-size:10px;color:#9cc0f6;margin-bottom:3px;">' + erL('Lane', 'Carril') + ' ' + (i + 1) + '</div>') : '') +
                  '<input type="number" min="0" inputmode="numeric" value="' + lv + '" onchange="eggRunSetLaneEggs(\'' + farm + '\',' + m + ',' + i + ',this.value)" placeholder="0" style="width:100%;box-sizing:border-box;background:#0a1408;border:1.5px solid #5a4a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:16px;font-weight:700;padding:9px 10px;">' +
                '</div>';
              }
              return out;
            })() +
          '</div>')) +
      '<div style="display:flex;align-items:center;gap:9px;margin-top:10px;flex-wrap:wrap;">' +
        '<label style="' + MONO + 'font-size:12px;color:#9ad6a0;font-weight:700;min-width:135px;">' + erL('Case weight (lb)', 'Peso caja (lb)') + '</label>' +
        '<input type="number" min="0" step="0.1" inputmode="decimal" value="' + (rec && rec.caseWt != null ? String(rec.caseWt) : '') + '" onchange="eggRunSetCaseWt(\'' + farm + '\',' + m + ',this.value)" placeholder="' + erL('lb / case', 'lb / caja') + '" style="flex:0 0 110px;text-align:center;' + inp + '">' +
        (function () {
          var w = (rec && rec.caseWt != null) ? Number(rec.caseWt) : null;
          var cs = (eggs != null) ? (eggs / 360) : null;
          if (!w || !cs) return '<span style="' + MONO + 'font-size:11px;color:#5a7a5a;">' + erL('total lbs appear here', 'las libras aparecen aquí') + '</span>';
          var lbs = Math.round(cs * w);
          var lph = (mins > 0) ? Math.round(lbs / (mins / 60)) : null;
          return '<span style="' + MONO + 'font-size:12.5px;color:#f0d68a;font-weight:700;">' + lbs.toLocaleString() + ' lb</span>' +
                 (lph ? ('<span style="' + MONO + 'font-size:11px;color:#7ab07a;"> · ' + lph.toLocaleString() + ' lb/hr</span>') : '');
        })() +
      '</div>' +
      '<div style="' + MONO + 'font-size:12px;color:#9ab09a;line-height:1.7;margin-top:7px;">' +
        (eggs != null ? ('🥚 ' + erL('Machine total', 'Total máquina') + ': <b style="color:#f0d68a;">' + eggs.toLocaleString() + '</b> = ' + (Math.round(eggs / 12 * 10) / 10).toLocaleString() + ' dz') : (byHouse ? erL('Enter each house\'s eggs.', 'Ingresa los huevos de cada casa.') : (nLanes === 1 ? erL('Enter the machine\'s total eggs.', 'Ingresa el total de huevos de la máquina.') : erL('Enter each lane\'s eggs.', 'Ingresa los huevos de cada carril.')))) +
        (epm ? ('<br><b style="color:#4ade80;">' + epm.toLocaleString() + ' ' + erL('eggs/min', 'huevos/min') + '</b>') : '') +
        (eph ? (' <span style="color:#7ab07a;">· ' + eph.toLocaleString() + ' ' + erL('eggs/hr', 'huevos/hr') + '</span>') : '') +
      '</div>' +
    '</div>' +
    (by ? '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:7px;">' + erL('Last entry by ', 'Última entrada por ') + by + '</div>' : '') +
  '</div>';
}

// Report-style DAILY SUMMARY: per plant in scope, today's run time · eggs · eggs/hr.
function _erDailySummary(farms, t) {
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var rows = farms.map(function (farm) {
    var totMin = 0, totEggs = 0, hasData = false;
    erMachines(farm).forEach(function (m) {
      var rec = erRec(farm, m, t);
      if (!rec) return;
      if (rec.manualMin != null) { totMin += Number(rec.manualMin) || 0; hasData = true; }
      else { var ms = erTotalMs(rec); if (ms) { totMin += ms / 60000; hasData = true; } }
      if (rec.eggs != null) { totEggs += Number(rec.eggs) || 0; hasData = true; }
    });
    var hrs = totMin / 60;
    var eph = (totEggs && hrs > 0.05) ? Math.round(totEggs / hrs) : null;
    var epm = (totEggs && totMin > 0) ? Math.round(totEggs / totMin) : null;
    return '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid #163016;">' +
      '<span style="' + MONO + 'font-size:13px;font-weight:700;color:#e8f5ec;">🥚 ' + farm + '</span>' +
      '<span style="' + MONO + 'font-size:12px;color:#9ab09a;">' +
        '⏱ <b style="color:#9ad6a0;">' + (hasData ? erFmtDur(totMin * 60000) : '—') + '</b>' +
        ' · 🥚 <b style="color:#f0d68a;">' + (totEggs ? totEggs.toLocaleString() : '—') + '</b>' +
        ' · <b style="color:' + (epm ? '#4ade80' : '#555') + ';">' + (epm ? (epm.toLocaleString() + ' ' + erL('eggs/min', 'huevos/min')) : '—') + '</b>' +
        (eph ? ' <span style="color:#7ab07a;">(' + eph.toLocaleString() + ' ' + erL('eggs/hr', 'huevos/hr') + ')</span>' : '') +
      '</span>' +
    '</div>';
  }).join('');
  return '<div style="background:#0d2a12;border:1.5px solid #2a7a3a;border-radius:12px;padding:12px 14px;margin-bottom:14px;">' +
    '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#7ab07a;margin-bottom:2px;">📊 ' + erL('TODAY — Processing report', 'HOY — Reporte de procesamiento') + ' · ' + t + '</div>' +
    rows +
    farms.map(function (f) { return _erPackerTable(f, t); }).join('') +
    '</div>';
}

// ── BY PACKER (Joe 2026-07-29) ──────────────────────────────────────────────
// One row per packer: their run time (from the clock times they entered), their
// total eggs (sum of their lanes), eggs/dz/cases per hour, and whether they beat
// the plant's target finish time. Eggs also roll up to a plant TOTAL so the
// numbers tie back to the day's total eggs.
var ER_EGGS_PER_DZ = 12, ER_DZ_PER_CASE = 30, ER_EGGS_PER_CASE = 360;
function _erPackerTable(farm, t) {
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var machines = erMachines(farm);
  var tgt = erTargetDone(farm), tgtM = tgt ? _erMinOfDay(tgt) : null;
  var any = false, tEggs = 0, tMin = 0;
  var rows = machines.map(function (m) {
    var rec = erRec(farm, m, t) || {};
    var packer = rec.packer || '';
    var lanes = (rec.lanes != null) ? Number(rec.lanes) : 2;
    var laneEggs = Array.isArray(rec.laneEggs) ? rec.laneEggs : [];
    var hEggs = rec.houseEggs || {};
    var hKeys = Object.keys(hEggs).filter(function (k) { return Number(hEggs[k]) > 0; }).sort();
    var eggs = (erByHouse(farm) ? hKeys.reduce(function (s, k) { return s + Number(hEggs[k]); }, 0) : 0)
            || laneEggs.reduce(function (s, v) { return s + (Number(v) || 0); }, 0)
            || (Number(rec.eggs) || 0);
    var mins = _erMinFromClock(rec.startClock, rec.stopClock);
    if (mins == null && rec.manualMin != null) mins = Number(rec.manualMin);
    if (!packer && !eggs && mins == null) return '';
    any = true; tEggs += eggs; tMin += (mins || 0);
    var eph = (eggs && mins) ? Math.round(eggs / (mins / 60)) : null;
    var dzh = eph ? Math.round(eph / ER_EGGS_PER_DZ) : null;
    var csh = eph ? Math.round(eph / ER_EGGS_PER_CASE * 10) / 10 : null;
    var stopM = _erMinOfDay(rec.stopClock);
    var onTime = (tgtM != null && stopM != null)
      ? (stopM <= tgtM
          ? '<span style="color:#4ade80;font-weight:700;">✅ ' + erL('on time', 'a tiempo') + '</span>'
          : '<span style="color:#f87171;font-weight:700;">⚠ +' + erFmtDur((stopM - tgtM) * 60000) + '</span>')
      : '<span style="color:#5a7a5a;">—</span>';
    return '<tr style="border-bottom:1px solid #163016;">' +
      '<td style="padding:7px 6px;color:#f0ead8;font-weight:700;">' + (packer ? String(packer).replace(/</g, '&lt;') : (erL('Machine', 'Máquina') + ' ' + m)) + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#9cc0f6;">' +
        (erByHouse(farm)
          ? (hKeys.length ? (erL('Houses ', 'Casas ') + hKeys.map(function (k) { return 'H' + k; }).join(' · ')) : erL('no houses yet', 'sin casas'))
          : ('M' + m + ' · ' + erLaneCount(farm) + ' ' + (erLaneCount(farm) === 1 ? erL('line', 'línea') : erL('lanes', 'carriles')))) + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#d6b36a;">' + (rec.startClock ? erFmtClock(rec.startClock) : '—') + ' → ' + (rec.stopClock ? erFmtClock(rec.stopClock) : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#9ad6a0;font-weight:700;">' + (mins != null ? erFmtDur(mins * 60000) : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#f0d68a;font-weight:700;">' + (eggs ? eggs.toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#cfe0a0;">' + (eggs ? Math.round(eggs / ER_EGGS_PER_DZ).toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#cfe0a0;">' + (eggs ? (Math.round(eggs / ER_EGGS_PER_CASE * 10) / 10).toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#4ade80;">' + (eph ? eph.toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#e8d36a;">' + (dzh ? dzh.toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#4ade80;font-weight:700;">' + (csh ? csh.toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#f0d68a;">' + (rec.caseWt != null ? Number(rec.caseWt) : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#f0d68a;font-weight:700;">' +
        ((rec.caseWt != null && eggs) ? Math.round((eggs / ER_EGGS_PER_CASE) * Number(rec.caseWt)).toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;">' + onTime + '</td>' +
    '</tr>';
  }).join('');
  if (!any) return '';
  var tEph = (tEggs && tMin) ? Math.round(tEggs / (tMin / 60)) : null;
  return '<div style="margin-top:10px;">' +
    '<div style="' + MONO + 'font-size:11px;font-weight:700;color:#9cc0f6;letter-spacing:1px;margin-bottom:5px;">👷 ' + erL('BY PACKER', 'POR EMPACADOR') + ' · ' + farm +
      (tgt ? ('<span style="color:#d6b36a;font-weight:400;"> · 🎯 ' + erL('target done ', 'meta ') + erFmtClock(tgt) + '</span>') : '') + '</div>' +
    '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;min-width:720px;">' +
    '<thead><tr style="border-bottom:1px solid #2a5a2a;">' +
      '<th style="padding:6px;color:#5a8a5a;text-align:left;">' + erL('Packer', 'Empacador') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Machine', 'Máquina') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Start → Stop', 'Inicio → Fin') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Run time', 'Tiempo') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Eggs', 'Huevos') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Dz', 'Dz') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Cases', 'Cajas') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Eggs/hr', 'Huevos/hr') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Dz/hr', 'Dz/hr') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Cases/hr', 'Cajas/hr') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('lb/case', 'lb/caja') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('Total lb', 'Total lb') + '</th>' +
      '<th style="padding:6px;color:#5a8a5a;text-align:center;">' + erL('vs target', 'vs meta') + '</th>' +
    '</tr></thead><tbody>' + rows + '</tbody>' +
    '<tfoot><tr style="border-top:1.5px solid #2a5a2a;">' +
      '<td colspan="3" style="padding:7px 6px;color:#9ad6a0;font-weight:700;">' + erL('PLANT TOTAL', 'TOTAL PLANTA') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#9ad6a0;font-weight:700;">' + (tMin ? erFmtDur(tMin * 60000) : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#f0d68a;font-weight:700;">' + (tEggs ? tEggs.toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#cfe0a0;font-weight:700;">' + (tEggs ? Math.round(tEggs / ER_EGGS_PER_DZ).toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#cfe0a0;font-weight:700;">' + (tEggs ? (Math.round(tEggs / ER_EGGS_PER_CASE * 10) / 10).toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#4ade80;font-weight:700;">' + (tEph ? tEph.toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#e8d36a;font-weight:700;">' + (tEph ? Math.round(tEph / ER_EGGS_PER_DZ).toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;text-align:center;color:#4ade80;font-weight:700;">' + (tEph ? (Math.round(tEph / ER_EGGS_PER_CASE * 10) / 10).toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 6px;"></td>' +
    '</tr></tfoot></table></div></div>';
}

// ── Eggs Packed Out → PALLET INVENTORY + SHIPPING (per Joe) ──────────────────
// Each PALLET is one opsPacking doc: {farm,date,type:'caged'|'cagefree',eggs,
// lot,status:'stock'|'shipped',shipmentId,by,ts}. Inventory = pallets not yet
// shipped. Shipping picks selected pallets + customer + date → writes an
// opsShipping doc and flips those pallets to 'shipped'. Manual entry, live.
var _palSel = {};                 // palletId -> selected for shipping
var _palType = {};                // farm -> 'caged' | 'cagefree' (add form)
function palTypeGet(farm) { return _palType[farm] || 'caged'; }
function palTypeSet(farm, ty) { _palType[farm] = ty; renderEggRun(); }
function _palInStock(farm) {
  return _poDocs.filter(function (p) { return p.farm === farm && p.eggs != null && p.status !== 'shipped'; })
                .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
}
function palToggleSel(id) { _palSel[id] = !_palSel[id]; renderEggRun(); }
async function palAdd(farm) {
  try {
    var eggsEl = document.getElementById('pal-eggs-' + farm);
    var lotEl = document.getElementById('pal-lot-' + farm);
    var eggs = eggsEl ? Math.max(0, Math.round(Number(eggsEl.value) || 0)) : 0;
    if (!eggs) { if (typeof toast === 'function') toast(erL('Enter the pallet egg count first', 'Ingresa el conteo del pallet')); return; }
    var lot = lotEl ? (lotEl.value || '').trim() : '';
    var id = farm + '__pal__' + Date.now();
    await db.collection('opsPacking').doc(id).set({
      farm: farm, date: erToday(), type: palTypeGet(farm), eggs: eggs, lot: lot,
      status: 'stock', by: erBy(), ts: Date.now()
    });
    if (eggsEl) eggsEl.value = ''; if (lotEl) lotEl.value = '';
    if (typeof toast === 'function') toast('📦 ' + erL('Pallet added', 'Pallet agregado') + ' — ' + eggs.toLocaleString() + ' ' + erL('eggs', 'huevos'));
    renderEggRun();
  } catch (e) { console.error('palAdd:', e); if (typeof toast === 'function') toast(erL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e)); }
}
async function palRemove(id) {
  try {
    await db.collection('opsPacking').doc(id).delete();
    delete _palSel[id];
    if (typeof toast === 'function') toast(erL('Pallet removed', 'Pallet eliminado'));
    renderEggRun();
  } catch (e) { console.error('palRemove:', e); }
}
async function palShip(farm) {
  try {
    var ids = _palInStock(farm).filter(function (p) { return _palSel[p._id]; }).map(function (p) { return p._id; });
    if (!ids.length) { if (typeof toast === 'function') toast(erL('Tick the pallets to ship first', 'Marca los pallets a enviar')); return; }
    var custEl = document.getElementById('pal-cust-' + farm);
    var dateEl = document.getElementById('pal-date-' + farm);
    var cust = custEl ? (custEl.value || '').trim() : '';
    if (!cust) { if (typeof toast === 'function') toast(erL('Enter a customer / destination', 'Ingresa cliente / destino')); return; }
    var shipDate = (dateEl && dateEl.value) ? dateEl.value : erToday();
    var pals = _poDocs.filter(function (p) { return ids.indexOf(p._id) !== -1; });
    var totalEggs = pals.reduce(function (s, p) { return s + (Number(p.eggs) || 0); }, 0);
    var shipId = farm + '__ship__' + Date.now();
    await db.collection('opsShipping').doc(shipId).set({
      farm: farm, customer: cust, date: shipDate, palletCount: ids.length,
      totalEggs: totalEggs, pallets: ids, by: erBy(), ts: Date.now()
    });
    for (var i = 0; i < ids.length; i++) {
      await db.collection('opsPacking').doc(ids[i]).set({ status: 'shipped', shipmentId: shipId, shippedTs: Date.now() }, { merge: true });
      delete _palSel[ids[i]];
    }
    if (custEl) custEl.value = '';
    if (typeof toast === 'function') toast('🚚 ' + erL('Shipped', 'Enviado') + ' ' + ids.length + ' ' + erL('pallets to', 'pallets a') + ' ' + cust + ' — ' + totalEggs.toLocaleString() + ' ' + erL('eggs', 'huevos'));
    renderEggRun();
  } catch (e) { console.error('palShip:', e); if (typeof toast === 'function') toast(erL('Could not ship: ', 'No se pudo enviar: ') + (e && e.message ? e.message : e)); }
}
function _erInventoryHtml(farms, t) {
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var out = '<div style="' + MONO + 'font-size:11px;letter-spacing:1px;color:#7ab07a;text-transform:uppercase;margin:10px 0 8px;">' + erL('Packed pallets — inventory & shipping', 'Pallets — inventario y envío') + '</div>';
  farms.forEach(function (farm) {
    var stock = _palInStock(farm);
    var caged = stock.filter(function (p) { return p.type === 'caged'; });
    var cf = stock.filter(function (p) { return p.type !== 'caged'; });
    var eggsCaged = caged.reduce(function (s, p) { return s + (Number(p.eggs) || 0); }, 0);
    var eggsCf = cf.reduce(function (s, p) { return s + (Number(p.eggs) || 0); }, 0);
    var selCount = stock.filter(function (p) { return _palSel[p._id]; }).length;
    var ty = palTypeGet(farm);
    var tyBtn = function (v, lbl) {
      var on = ty === v;
      return '<button onclick="palTypeSet(\'' + farm + '\',\'' + v + '\')" style="flex:1;padding:10px;border-radius:8px;' + MONO + 'font-size:12px;font-weight:700;cursor:pointer;' + (on ? 'background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;' : 'background:#13110a;border:1.5px solid #4a4030;color:#9f8a63;') + '">' + (on ? '☑ ' : '☐ ') + lbl + '</button>';
    };
    var rows = stock.map(function (p) {
      var sel = !!_palSel[p._id];
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #163016;">' +
        '<button onclick="palToggleSel(\'' + p._id + '\')" style="width:28px;height:28px;border-radius:6px;flex:0 0 auto;cursor:pointer;font-weight:700;' + (sel ? 'background:#14532d;border:1.5px solid #4ade80;color:#86efac;' : 'background:#0a1408;border:1.5px solid #2a5a2a;color:#5a7a5a;') + '">' + (sel ? '✓' : '') + '</button>' +
        '<span style="' + MONO + 'font-size:12px;color:#e8f5ec;flex:1;">' + (p.type === 'caged' ? '🥚 ' + erL('Conventional', 'Convencional') : '🌿 ' + erL('Non-conventional', 'No convencional')) + (p.lot ? ' · #' + String(p.lot).replace(/</g, '') : '') + ' · <b style="color:#f0d68a;">' + (Number(p.eggs) || 0).toLocaleString() + '</b></span>' +
        '<button onclick="palRemove(\'' + p._id + '\')" style="background:none;border:none;color:#7a4a4a;cursor:pointer;font-size:15px;padding:0 4px;">✕</button>' +
      '</div>';
    }).join('') || '<div style="' + MONO + 'font-size:12px;color:#5a7a5a;padding:8px 0;">' + erL('No pallets in stock', 'Sin pallets en inventario') + '</div>';

    out += '<div style="background:#0f2410;border:1.5px solid #2a5a2a;border-radius:12px;padding:14px;margin-bottom:12px;">' +
      '<div style="' + MONO + 'font-size:15px;font-weight:700;color:#e8f5ec;margin-bottom:4px;">📦 ' + farm + '</div>' +
      '<div style="' + MONO + 'font-size:12px;color:#9ab09a;margin-bottom:12px;">' + erL('In stock', 'En inventario') + ': <b style="color:#f0d68a;">' + stock.length + '</b> ' + erL('pallets', 'pallets') + ' · 🥚 ' + caged.length + ' (' + eggsCaged.toLocaleString() + ') · 🌿 ' + cf.length + ' (' + eggsCf.toLocaleString() + ')</div>' +
      '<div style="background:#0a1a0a;border:1px solid #1e3a1e;border-radius:10px;padding:10px;margin-bottom:10px;">' +
        '<div style="' + MONO + 'font-size:11px;color:#9ad6a0;font-weight:700;margin-bottom:6px;">' + erL('Add a pallet', 'Agregar pallet') + '</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:6px;">' + tyBtn('caged', erL('Conventional', 'Convencional')) + tyBtn('cagefree', erL('Non-conventional', 'No convencional')) + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<input id="pal-eggs-' + farm + '" type="number" min="0" inputmode="numeric" placeholder="' + erL('total eggs', 'total huevos') + '" style="flex:2;min-width:120px;background:#0a1408;border:1.5px solid #2a5a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:15px;font-weight:700;padding:9px 11px;">' +
          '<input id="pal-lot-' + farm + '" type="text" placeholder="' + erL('lot #', 'lote #') + '" style="flex:1;min-width:80px;background:#0a1408;border:1.5px solid #2a5a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:14px;padding:9px 11px;">' +
          '<button onclick="palAdd(\'' + farm + '\')" style="flex:0 0 auto;padding:9px 16px;border-radius:8px;background:#14361c;border:1.5px solid #4ade80;color:#4ade80;' + MONO + 'font-size:14px;font-weight:700;cursor:pointer;">+ ' + erL('Add', 'Agregar') + '</button>' +
        '</div>' +
      '</div>' +
      rows +
      '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #163016;">' +
        '<div style="' + MONO + 'font-size:11px;color:#9ad6a0;font-weight:700;margin-bottom:6px;">🚚 ' + erL('Ship selected', 'Enviar seleccionados') + ' (' + selCount + ')</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<input id="pal-cust-' + farm + '" type="text" placeholder="' + erL('customer / destination', 'cliente / destino') + '" style="flex:2;min-width:140px;background:#0a1408;border:1.5px solid #2a5a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:14px;padding:9px 11px;">' +
          '<input id="pal-date-' + farm + '" type="date" value="' + t + '" style="flex:1;min-width:120px;background:#0a1408;border:1.5px solid #2a5a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:13px;padding:9px 11px;">' +
          '<button onclick="palShip(\'' + farm + '\')" style="flex:0 0 auto;padding:9px 16px;border-radius:8px;background:#0d1f3a;border:1.5px solid #2a5a8a;color:#7ab0f6;' + MONO + 'font-size:14px;font-weight:700;cursor:pointer;">🚚 ' + erL('Ship', 'Enviar') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  return out;
}

function renderEggRun() {
  var el = document.getElementById('pkg-dailyrun');
  if (!el) return;
  erStartListener();
  var t = erToday();
  var farms = erFarmsInScope();
  var MONO = "font-family:'IBM Plex Mono',monospace;";

  var html = '<div style="' + MONO + 'font-size:11px;color:#9ab09a;line-height:1.5;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin-bottom:14px;">' +
    erL('Once a day, type the machine\'s <b style="color:#9ad6a0;">total run time in minutes</b> (off the meter) and the <b style="color:#f0d68a;">total eggs</b> for the day. Eggs/hr is figured automatically. Everything stamps who + when and shows live on every device.',
        'Una vez al día, escribe el <b style="color:#9ad6a0;">tiempo total en minutos</b> de la máquina (del medidor) y el <b style="color:#f0d68a;">total de huevos</b> del día. Huevos/hr se calcula solo. Todo registra quién y cuándo, en vivo en cada equipo.') +
  '</div>';

  // ── Plant chips (Hegins / Danville) ──
  html += _erPlantChips();

  // ── Report-style daily summary at the top ──
  html += _erDailySummary(farms, t);

  farms.forEach(function (farm) {
    var machines = erMachines(farm);
    var multi = machines.length > 1;

    // ── Manual entry per machine (run time + eggs) ──
    var detailHtml = machines.map(function (m) { return _erMachineDetail(farm, m, erRec(farm, m, t), multi); }).join('');

    html += '<div style="background:#0f2410;border:1.5px solid #2a5a2a;border-radius:12px;padding:14px;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;">' +
        '<div style="' + MONO + 'font-size:15px;font-weight:700;color:#e8f5ec;">🥚 ' + farm + (multi ? ' <span style="font-size:11px;font-weight:400;color:#d6b36a;">· ' + machines.length + ' ' + erL('machines', 'máquinas') + '</span>' : '') + '</div>' +
        '<div style="' + MONO + 'font-size:11px;color:#7ab07a;">' + t + '</div>' +
      '</div>' +
      detailHtml +
    '</div>';
  });

  // ── Packed pallets — inventory & shipping ──
  html += _erInventoryHtml(farms, t);

  // ── 📉 DOWNTIME BY DAY (per plant) ──
  html += _erDowntimeByDay(farms);

  // ── 14-day history (tracking log) ──
  var hist = _erDocs.slice()
    .filter(function (r) { return farms.indexOf(r.farm) !== -1; })
    .sort(function (a, b) {
      return (b.date > a.date ? 1 : b.date < a.date ? -1 : 0) ||
             (a.farm > b.farm ? 1 : a.farm < b.farm ? -1 : 0) ||
             (Number(a.machine || 1) - Number(b.machine || 1));
    });
  if (hist.length) {
    var hrows = hist.map(function (r) {
      var ms = erTotalMs(r), h2 = ms / 3600000;
      var e2 = (r.eggs != null) ? Number(r.eggs) : null;
      var eph2 = (e2 && h2 > 0.05) ? Math.round(e2 / h2) : null;
      return '<tr style="border-bottom:1px solid #1a2a1a;">' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + (r.date || '—').slice(5).replace('-', '/') + '</td>' +
        '<td style="padding:8px 6px;color:#7ab07a;">' + r.farm + '</td>' +
        '<td style="padding:8px 6px;color:#d6b36a;">M' + (r.machine || 1) + '</td>' +
        '<td style="padding:8px 6px;color:#f0d68a;">' + (ms ? erFmtDur(ms) : '—') + '</td>' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + (e2 != null ? e2.toLocaleString() : '—') + '</td>' +
        '<td style="padding:8px 6px;color:' + (eph2 ? '#4ade80' : '#555') + ';">' + (eph2 ? eph2.toLocaleString() : '—') + '</td>' +
        '<td style="padding:8px 6px;color:#5a8a5a;font-size:11px;">' + (r.manualBy || r.eggsBy || (erRuns(r)[0] || {}).by || r.by || '—') + '</td>' +
        // ✎ Fix a past day (Joe 2026-08-11: "be able to edit this to add run
        // times later"). Rows entered without Start/Stop show "—" — this adds
        // the run time (or corrects eggs) days later without re-opening the day.
        '<td style="padding:8px 6px;text-align:right;white-space:nowrap;">' +
          '<button onclick="erEditRow(\'' + _erEsc(r.farm) + '\',' + (r.machine || 1) + ',\'' + _erEsc(r.date || '') + '\',\'time\')" title="' + erL('Add / fix run time', 'Agregar / corregir tiempo') + '" style="padding:6px 9px;background:' + (ms ? '#0a2a1a' : '#3a2a08') + ';border:1px solid ' + (ms ? '#2a5a3a' : '#7a5a1a') + ';border-radius:7px;color:' + (ms ? '#9ad6a0' : '#f0d68a') + ';cursor:pointer;font-size:11px;">⏱</button> ' +
          '<button onclick="erEditRow(\'' + _erEsc(r.farm) + '\',' + (r.machine || 1) + ',\'' + _erEsc(r.date || '') + '\',\'eggs\')" title="' + erL('Fix eggs', 'Corregir huevos') + '" style="padding:6px 9px;background:#0d1f3a;border:1px solid #2a4a7a;border-radius:7px;color:#9cc0f6;cursor:pointer;font-size:11px;">🥚</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    html += '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#7ab07a;margin:16px 0 8px;">📋 ' + erL('Last 14 days', 'Últimos 14 días') + '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;min-width:520px;">' +
      '<thead><tr style="border-bottom:1px solid #2a4a2a;">' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Date', 'Fecha') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Farm', 'Granja') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Mach.', 'Máq.') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Run time', 'Tiempo') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Eggs', 'Huevos') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Eggs/hr', 'Huevos/hr') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('By', 'Por') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:right;">' + erL('Fix', 'Corregir') + '</th>' +
      '</tr></thead><tbody>' + hrows + '</tbody></table></div>' +
      '<div style="' + MONO + 'font-size:9.5px;color:#4a6a4a;margin-top:6px;line-height:1.6;">' +
        erL('⏱ add or fix a run time on any past day (type 05:30-11:48, or just the minutes). 🥚 fix that day\'s eggs. Edits are stamped with your name.',
            '⏱ agrega o corrige el tiempo de cualquier día (escribe 05:30-11:48, o solo los minutos). 🥚 corrige los huevos. Las ediciones quedan con tu nombre.') + '</div>';
  }

  el.innerHTML = html;

  // Manual entry — no running stopwatch, so no elapsed-time ticker needed.
  if (_erTick) { clearInterval(_erTick); _erTick = null; }
}

// Home-card entry: open Processing straight to the Daily Run tab.
function openProcessing() {
  if (typeof enterApp === 'function') enterApp('pkg');
  setTimeout(function () { try { if (typeof goPkgSection === 'function') goPkgSection('dailyrun'); } catch (e) {} }, 80);
}

if (typeof window !== 'undefined') {
  window.renderEggRun = renderEggRun;
  window.eggRunStart = eggRunStart;
  window.eggRunStop = eggRunStop;
  window.eggRunStartSel = eggRunStartSel;
  window.eggRunStopSel = eggRunStopSel;
  window.eggRunSelToggle = eggRunSelToggle;
  window.eggRunEggsSet = eggRunEggsSet;
  window.eggRunSetManualMin = eggRunSetManualMin;
  window.eggRunSetPacker = eggRunSetPacker;
  window.eggRunSetLanes = eggRunSetLanes;
  window.eggRunSetLaneEggs = eggRunSetLaneEggs;
  window.eggRunSetHouseEggs = eggRunSetHouseEggs;   // Danville: eggs by house
  window.eggRunSetClock = eggRunSetClock;
  window.eggRunSetCaseWt = eggRunSetCaseWt;
  window.erTimeBlur = erTimeBlur;
  window.erEditRow = erEditRow;
  window.palTypeSet = palTypeSet;
  window.palToggleSel = palToggleSel;
  window.palAdd = palAdd;
  window.palRemove = palRemove;
  window.palShip = palShip;
  window.openProcessing = openProcessing;
}
