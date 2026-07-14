// ═══════════════════════════════════════════════════════════════════════════
// eggrun.js — Daily Egg Run (Processing → 🥚⏱ Daily Run) EN/ES
// ONE entry per MACHINE per plant per day: total eggs + total machine run time.
// Hegins runs 2 machines, Danville 1 (EGGRUN_MACHINES).
// Multi-machine plants get CHECKBOXES for which machine(s) you're starting /
// stopping (per Joe) — tick M1/M2, then one big ▶ START / ⏹ STOP acts on the
// ticked machines. Single-machine plants just get the big buttons.
// Multiple start/stop cycles per day are fine (lunch, jams): each pair is a
// "run" and the day's run time is the sum. Total eggs typed once per machine
// (saves on change). Eggs/hr computed automatically.
// Live via onSnapshot: every device sees machine state + times instantly.
// Collection: eggDailyRun, doc "<Farm>__M<machine>__<YYYY-MM-DD>"
//   { farm, machine, date, runs:[{s,e,by,eBy}], eggs, by, ts }
// ═══════════════════════════════════════════════════════════════════════════
const EGGRUN_MACHINES = { Hegins: [1, 2], Danville: [1] };

function erL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }

let _erDocs = [];          // last ~14 days of eggDailyRun docs (live)
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
// Per-machine runs detail + eggs input row.
function _erMachineDetail(farm, m, rec, multi) {
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var eggs = (rec && rec.eggs != null) ? Number(rec.eggs) : null;
  var totalMs = erTotalMs(rec);
  var hrs = totalMs / 3600000;
  var eph = (eggs && hrs > 0.05) ? Math.round(eggs / hrs) : null;
  var runRows = erRuns(rec).map(function (r, i) {
    return '<div style="' + MONO + 'font-size:11px;color:#7a9a7a;padding:2px 0;">' +
      (i + 1) + '. ▶ ' + erFmtTime(r.s) + (r.by ? ' <span style="color:#5a8a5a;">' + r.by + '</span>' : '') +
      (r.e ? ' &nbsp;→&nbsp; ⏹ ' + erFmtTime(r.e) + ' <span style="color:#9ab09a;">(' + erFmtDur(r.e - r.s) + ')</span>' : ' &nbsp;→&nbsp; <span style="color:#4ade80;">' + erL('running…', 'corriendo…') + '</span>') +
    '</div>';
  }).join('');
  return (runRows ? '<div style="margin-top:7px;border-top:1px dashed #2a5a2a;padding-top:5px;">' + (multi ? '<div style="' + MONO + 'font-size:10px;color:#d6b36a;font-weight:700;">M' + m + '</div>' : '') + runRows + '</div>' : '') +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:9px;border-top:1px solid #163016;">' +
      '<label style="' + MONO + 'font-size:12px;color:#f0d68a;font-weight:700;">🥚 ' + (multi ? 'M' + m + ' — ' : '') + erL('Total eggs today', 'Total de huevos hoy') + '</label>' +
      '<input type="number" min="0" inputmode="numeric" value="' + (eggs != null ? eggs : '') + '" onchange="eggRunEggsSet(\'' + farm + '\',' + m + ',this.value)" placeholder="0" style="flex:1;min-width:110px;background:#0a1408;border:1.5px solid #5a4a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:16px;font-weight:700;padding:10px 12px;">' +
      '<div style="' + MONO + 'font-size:11px;color:#9ab09a;line-height:1.6;">' +
        (eggs != null ? ('= ' + (Math.round(eggs / 12 * 10) / 10).toLocaleString() + ' dz') : '') +
        (eph ? ('<br><b style="color:#4ade80;">' + eph.toLocaleString() + ' ' + erL('eggs/hr', 'huevos/hr') + '</b>') : '') +
      '</div>' +
    '</div>' +
    // Manual run-time entry — type minutes off the meter instead of Start/Stop.
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;">' +
      '<label style="' + MONO + 'font-size:12px;color:#9ad6a0;font-weight:700;">⏱ ' + (multi ? 'M' + m + ' — ' : '') + erL('Or enter run time (min)', 'O ingresa tiempo (min)') + '</label>' +
      '<input type="number" min="0" inputmode="numeric" value="' + (rec && rec.manualMin != null ? rec.manualMin : '') + '" onchange="eggRunSetManualMin(\'' + farm + '\',' + m + ',this.value)" placeholder="min" style="flex:1;min-width:90px;background:#0a1408;border:1.5px solid #2a5a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:15px;font-weight:700;padding:9px 12px;">' +
      (rec && Number(rec.manualMin) > 0 ? '<span style="' + MONO + 'font-size:10px;color:#d6b36a;">' + erL('manual · overrides timer', 'manual · anula cronómetro') + '</span>' : '') +
    '</div>';
}

function renderEggRun() {
  var el = document.getElementById('pkg-dailyrun');
  if (!el) return;
  erStartListener();
  var t = erToday();
  var farms = erFarmsInScope();
  var MONO = "font-family:'IBM Plex Mono',monospace;";

  var html = '<div style="' + MONO + 'font-size:11px;color:#9ab09a;line-height:1.5;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin-bottom:14px;">' +
    erL('Tick <b style="color:#d6b36a;">which machine(s)</b> you mean, then tap <b style="color:#4ade80;">▶ START</b> when they start and <b style="color:#f2a0a0;">⏹ STOP</b> when they stop — start/stop as many times as the day needs (lunch, jams); the total run time adds up per machine. Type the <b style="color:#f0d68a;">total eggs</b> once per machine for the day. Eggs/hr is automatic. Everything stamps who + when and shows live on every device.',
        'Marca <b style="color:#d6b36a;">qué máquina(s)</b>, luego toca <b style="color:#4ade80;">▶ INICIAR</b> cuando arranquen y <b style="color:#f2a0a0;">⏹ PARAR</b> cuando paren — puedes iniciar/parar las veces necesarias (almuerzo, atascos); el tiempo total se suma por máquina. Escribe el <b style="color:#f0d68a;">total de huevos</b> una vez por máquina al día. Huevos/hr es automático. Todo registra quién y cuándo, en vivo en cada equipo.') +
  '</div>';

  farms.forEach(function (farm) {
    var machines = erMachines(farm);
    var multi = machines.length > 1;
    var anyRun = machines.some(function (m) { return !!erRunning(erRec(farm, m, t)); });

    // ── Machine checkboxes (multi-machine plants only, per Joe) ──
    var chkRow = '';
    if (multi) {
      chkRow = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 4px;">' +
        '<span style="' + MONO + 'font-size:11px;color:#9ab09a;">' + erL('Machines:', 'Máquinas:') + '</span>' +
        machines.map(function (m) {
          var on = erSelGet(farm, m);
          var st = on
            ? 'background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;'
            : 'background:#13110a;border:1.5px solid #4a4030;color:#9f8a63;';
          return '<button onclick="eggRunSelToggle(\'' + farm + '\',' + m + ')" style="padding:10px 16px;border-radius:8px;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;' + st + '">' + (on ? '☑' : '☐') + ' ' + erL('Machine', 'Máquina') + ' ' + m + '</button>';
        }).join('') +
      '</div>';
    }

    // ── Status lines per machine ──
    var statusHtml = machines.map(function (m) { return _erStatusLine(farm, m, erRec(farm, m, t), multi); }).join('');

    // ── Start/Stop buttons ──
    var btnHtml;
    if (multi) {
      btnHtml = '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button onclick="eggRunStartSel(\'' + farm + '\')" style="flex:1;padding:16px;border-radius:12px;' + MONO + 'font-size:15px;font-weight:700;cursor:pointer;background:#14361c;border:2px solid #4ade80;color:#4ade80;">▶ ' + erL('START', 'INICIAR') + '</button>' +
        '<button onclick="eggRunStopSel(\'' + farm + '\')" style="flex:1;padding:16px;border-radius:12px;' + MONO + 'font-size:15px;font-weight:700;cursor:pointer;background:#7a1414;border:2px solid #c0392b;color:#ffd7d7;">⏹ ' + erL('STOP', 'PARAR') + '</button>' +
      '</div>' +
      '<div style="' + MONO + 'font-size:10px;color:#6f8f6f;margin-top:5px;">' + erL('Acts on the ticked machine(s) above', 'Aplica a la(s) máquina(s) marcada(s) arriba') + '</div>';
    } else {
      var m1 = machines[0];
      var rec1 = erRec(farm, m1, t);
      if (erRunning(rec1)) {
        btnHtml = '<button onclick="eggRunStop(\'' + farm + '\',' + m1 + ')" style="width:100%;margin-top:6px;padding:16px;border-radius:12px;' + MONO + 'font-size:16px;font-weight:700;cursor:pointer;background:#7a1414;border:2px solid #c0392b;color:#ffd7d7;">⏹ ' + erL('STOP MACHINE', 'PARAR MÁQUINA') + '</button>';
      } else if (erRuns(rec1).length) {
        btnHtml = '<button onclick="eggRunStart(\'' + farm + '\',' + m1 + ')" style="width:100%;margin-top:6px;padding:16px;border-radius:12px;' + MONO + 'font-size:16px;font-weight:700;cursor:pointer;background:#14361c;border:2px solid #4ade80;color:#4ade80;">▶ ' + erL('RESUME — START AGAIN', 'REANUDAR — INICIAR') + '</button>';
      } else {
        btnHtml = '<button onclick="eggRunStart(\'' + farm + '\',' + m1 + ')" style="width:100%;margin-top:6px;padding:18px;border-radius:12px;' + MONO + 'font-size:17px;font-weight:700;cursor:pointer;background:#14361c;border:2px solid #4ade80;color:#4ade80;">▶ ' + erL('START MACHINE', 'INICIAR MÁQUINA') + '</button>';
      }
    }

    // ── Runs detail + eggs per machine ──
    var detailHtml = machines.map(function (m) { return _erMachineDetail(farm, m, erRec(farm, m, t), multi); }).join('');

    html += '<div style="background:#0f2410;border:1.5px solid ' + (anyRun ? '#2a7a3a' : '#2a5a2a') + ';border-radius:12px;padding:14px;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
        '<div style="' + MONO + 'font-size:15px;font-weight:700;color:#e8f5ec;">🥚 ' + farm + (multi ? ' <span style="font-size:11px;font-weight:400;color:#d6b36a;">· ' + machines.length + ' ' + erL('machines', 'máquinas') + '</span>' : '') + '</div>' +
        '<div style="' + MONO + 'font-size:11px;color:#7ab07a;">' + t + '</div>' +
      '</div>' +
      chkRow + statusHtml + btnHtml + detailHtml +
    '</div>';
  });

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
      var first = erRuns(r)[0];
      return '<tr style="border-bottom:1px solid #1a2a1a;">' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + (r.date || '—').slice(5).replace('-', '/') + '</td>' +
        '<td style="padding:8px 6px;color:#7ab07a;">' + r.farm + '</td>' +
        '<td style="padding:8px 6px;color:#d6b36a;">M' + (r.machine || 1) + '</td>' +
        '<td style="padding:8px 6px;color:#aaa;">' + (first ? erFmtTime(first.s) : '—') + '</td>' +
        '<td style="padding:8px 6px;color:#f0d68a;">' + (ms ? erFmtDur(ms) : '—') + '</td>' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + (e2 != null ? e2.toLocaleString() : '—') + '</td>' +
        '<td style="padding:8px 6px;color:' + (eph2 ? '#4ade80' : '#555') + ';">' + (eph2 ? eph2.toLocaleString() : '—') + '</td>' +
        '<td style="padding:8px 6px;color:#5a8a5a;font-size:11px;">' + ((erRuns(r)[0] || {}).by || r.by || '—') + '</td>' +
      '</tr>';
    }).join('');
    html += '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#7ab07a;margin:16px 0 8px;">📋 ' + erL('Last 14 days', 'Últimos 14 días') + '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;min-width:580px;">' +
      '<thead><tr style="border-bottom:1px solid #2a4a2a;">' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Date', 'Fecha') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Farm', 'Granja') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Mach.', 'Máq.') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Started', 'Inició') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Run time', 'Tiempo') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Eggs', 'Huevos') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Eggs/hr', 'Huevos/hr') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('By', 'Por') + '</th>' +
      '</tr></thead><tbody>' + hrows + '</tbody></table></div>';
  }

  el.innerHTML = html;

  // Tick the elapsed time while a machine is running and the tab is visible.
  if (_erTick) { clearInterval(_erTick); _erTick = null; }
  var anyRunning = farms.some(function (f) {
    return erMachines(f).some(function (m) { return !!erRunning(erRec(f, m, t)); });
  });
  if (anyRunning) _erTick = setInterval(function () { if (_erVisible()) _erRerender(); else { clearInterval(_erTick); _erTick = null; } }, 30000);
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
  window.openProcessing = openProcessing;
}
