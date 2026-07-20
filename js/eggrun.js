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
const EGGRUN_TARGET_DONE = { Hegins: '11:45' };
function erTargetDone(farm) { return EGGRUN_TARGET_DONE[farm] || null; }
function _erMinOfDay(hhmm) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; }

function erL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }

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
function erFarmsInScope() {
  var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  if (EGGRUN_MACHINES[f]) return [f];
  return Object.keys(EGGRUN_MACHINES);   // Master / Processing / unknown → all plants
}
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
    renderEggRun();
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
// Per-machine MANUAL entry: run time (min) + total eggs, computed eggs/hr.
function _erMachineDetail(farm, m, rec, multi) {
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var packer = (rec && rec.packer) ? rec.packer : '';
  var lanes = (rec && rec.lanes != null) ? Number(rec.lanes) : 2;   // 2 lanes per machine
  var nLanes = Math.max(1, Math.min(4, lanes || 2));
  var laneEggs = (rec && Array.isArray(rec.laneEggs)) ? rec.laneEggs.slice() : [];
  var laneSum = laneEggs.reduce(function (s, v) { return s + (Number(v) || 0); }, 0);
  var eggs = laneSum > 0 ? laneSum : (rec && rec.eggs != null ? Number(rec.eggs) : null);  // total = sum of lanes
  var startC = (rec && rec.startClock) ? rec.startClock : '';
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
      '<label style="' + MONO + 'font-size:12px;color:#9ab09a;">' + erL('Lanes', 'Carriles') + '</label>' +
      '<input type="number" min="0" max="2" inputmode="numeric" value="' + lanes + '" onchange="eggRunSetLanes(\'' + farm + '\',' + m + ',this.value)" style="flex:0 0 56px;text-align:center;' + inp + '">' +
    '</div>' +
    // Start + Stop time of day
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;">' +
      '<label style="' + MONO + 'font-size:12px;color:#9ad6a0;font-weight:700;min-width:135px;">⏱ ' + erL('Start / Stop time', 'Hora inicio / fin') + '</label>' +
      '<input type="time" step="60" value="' + startC + '" onchange="eggRunSetClock(\'' + farm + '\',' + m + ',\'start\',this.value)" style="flex:1;min-width:96px;' + inp + '">' +
      '<input type="time" step="60" value="' + stopC + '" onchange="eggRunSetClock(\'' + farm + '\',' + m + ',\'stop\',this.value)" style="flex:1;min-width:96px;' + inp + '">' +
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
      '<label style="' + MONO + 'font-size:12px;color:#f0d68a;font-weight:700;display:block;margin-bottom:5px;">🥚 ' + erL('Eggs by lane', 'Huevos por carril') + '</label>' +
      '<div style="display:grid;grid-template-columns:repeat(' + nLanes + ',1fr);gap:8px;">' +
        (function () {
          var out = '';
          for (var i = 0; i < nLanes; i++) {
            var lv = (laneEggs[i] != null && laneEggs[i] !== '') ? laneEggs[i] : '';
            out += '<div>' +
              '<div style="' + MONO + 'font-size:10px;color:#9cc0f6;margin-bottom:3px;">' + erL('Lane', 'Carril') + ' ' + (i + 1) + '</div>' +
              '<input type="number" min="0" inputmode="numeric" value="' + lv + '" onchange="eggRunSetLaneEggs(\'' + farm + '\',' + m + ',' + i + ',this.value)" placeholder="0" style="width:100%;box-sizing:border-box;background:#0a1408;border:1.5px solid #5a4a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:16px;font-weight:700;padding:9px 10px;">' +
            '</div>';
          }
          return out;
        })() +
      '</div>' +
      '<div style="' + MONO + 'font-size:12px;color:#9ab09a;line-height:1.7;margin-top:7px;">' +
        (eggs != null ? ('🥚 ' + erL('Machine total', 'Total máquina') + ': <b style="color:#f0d68a;">' + eggs.toLocaleString() + '</b> = ' + (Math.round(eggs / 12 * 10) / 10).toLocaleString() + ' dz') : erL('Enter each lane\'s eggs.', 'Ingresa los huevos de cada carril.')) +
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
    rows + '</div>';
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
      '</tr></thead><tbody>' + hrows + '</tbody></table></div>';
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
  window.palTypeSet = palTypeSet;
  window.palToggleSel = palToggleSel;
  window.palAdd = palAdd;
  window.palRemove = palRemove;
  window.palShip = palShip;
  window.openProcessing = openProcessing;
}
