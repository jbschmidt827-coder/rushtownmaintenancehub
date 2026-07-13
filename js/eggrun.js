// ═══════════════════════════════════════════════════════════════════════════
// eggrun.js — Daily Egg Run (Processing → 🥚 Daily Run) EN/ES
// ONE entry per plant per day: total eggs + total MACHINE run time.
// The crew taps ▶ START when the machine starts and ⏹ STOP when it stops —
// the app stamps who + when. Multiple start/stop cycles per day are fine
// (lunch, jams): each pair is a "run" and the day's run time is the sum.
// Total eggs typed once (saves on change). Eggs/hr computed automatically.
// Live via onSnapshot: every device sees machine state + times instantly.
// Collection: eggDailyRun, doc "<Farm>__<YYYY-MM-DD>"
//   { farm, date, runs:[{s,e,by,eBy}], eggs, by, ts }
// ═══════════════════════════════════════════════════════════════════════════
const EGGRUN_FARMS = ['Hegins', 'Danville'];

function erL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }

let _erDocs = [];          // last ~14 days of eggDailyRun docs (live)
let _erListening = false;
let _erTick = null;        // 30s ticker so "running" elapsed time counts up

function erToday() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }
function erBy() { return (typeof getDeviceUser === 'function') ? (getDeviceUser() || '') : ''; }
function erKey(farm, date) { return farm + '__' + date; }
function erRec(farm, date) {
  return _erDocs.find(function (r) { return r.farm === farm && r.date === date; });
}
function erFarmsInScope() {
  var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  if (f === 'Hegins' || f === 'Danville') return [f];
  return EGGRUN_FARMS.slice();   // Master / Processing / unknown → both plants
}
function erRuns(rec) { return (rec && Array.isArray(rec.runs)) ? rec.runs : []; }
function erRunning(rec) {
  var rs = erRuns(rec);
  return (rs.length && !rs[rs.length - 1].e) ? rs[rs.length - 1] : null;
}
function erTotalMs(rec) {
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
  var ae = document.activeElement;   // don't clobber the eggs field mid-typing
  if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && document.getElementById('pkg-dailyrun') && document.getElementById('pkg-dailyrun').contains(ae)) return;
  try { renderEggRun(); } catch (e) { console.error('eggrun rerender:', e); }
}

// ── Save helpers (always first-tap save, toast confirmation) ────────────────
async function _erSave(farm, patch) {
  var t = erToday();
  var base = { farm: farm, date: t, ts: Date.now() };
  if (typeof setSyncDot === 'function') setSyncDot('saving');
  await db.collection('eggDailyRun').doc(erKey(farm, t)).set(Object.assign(base, patch), { merge: true });
  if (typeof setSyncDot === 'function') setSyncDot('live');
}

async function eggRunStart(farm) {
  try {
    var rec = erRec(farm, erToday());
    if (erRunning(rec)) return;                       // already running
    var runs = erRuns(rec).slice();
    runs.push({ s: Date.now(), by: erBy() });
    await _erSave(farm, { runs: runs, by: erBy() });
    if (typeof toast === 'function') toast(erL('▶ ' + farm + ' machine started', '▶ Máquina de ' + farm + ' iniciada'));
    renderEggRun();
  } catch (e) {
    console.error('eggRunStart:', e);
    if (typeof toast === 'function') toast(erL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function eggRunStop(farm) {
  try {
    var rec = erRec(farm, erToday());
    if (!erRunning(rec)) return;                      // not running
    var runs = erRuns(rec).slice();
    runs[runs.length - 1] = Object.assign({}, runs[runs.length - 1], { e: Date.now(), eBy: erBy() });
    await _erSave(farm, { runs: runs });
    if (typeof toast === 'function') toast(erL('⏹ ' + farm + ' machine stopped — ' + erFmtDur(erTotalMs({ runs: runs })) + ' today', '⏹ Máquina de ' + farm + ' detenida — ' + erFmtDur(erTotalMs({ runs: runs })) + ' hoy'));
    renderEggRun();
  } catch (e) {
    console.error('eggRunStop:', e);
    if (typeof toast === 'function') toast(erL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function eggRunEggsSet(farm, val) {
  try {
    var n = Math.max(0, Math.round(Number(val) || 0));
    await _erSave(farm, { eggs: n, eggsBy: erBy() });
    if (typeof toast === 'function') toast(erL('🥚 ' + farm + ' eggs saved: ', '🥚 Huevos de ' + farm + ' guardados: ') + n.toLocaleString());
    renderEggRun();
  } catch (e) {
    console.error('eggRunEggsSet:', e);
    if (typeof toast === 'function') toast(erL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

// ── Render ──────────────────────────────────────────────────────────────────
function renderEggRun() {
  var el = document.getElementById('pkg-dailyrun');
  if (!el) return;
  erStartListener();
  var t = erToday();
  var farms = erFarmsInScope();
  var MONO = "font-family:'IBM Plex Mono',monospace;";

  var html = '<div style="' + MONO + 'font-size:11px;color:#9ab09a;line-height:1.5;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin-bottom:14px;">' +
    erL('Tap <b style="color:#4ade80;">▶ START</b> when the machine starts and <b style="color:#f2a0a0;">⏹ STOP</b> when it stops — start/stop as many times as the day needs (lunch, jams); the total run time adds up. Type the <b style="color:#f0d68a;">total eggs</b> once for the day. Eggs/hr is automatic. Everything stamps who + when and shows live on every device.',
        'Toca <b style="color:#4ade80;">▶ INICIAR</b> cuando arranque la máquina y <b style="color:#f2a0a0;">⏹ PARAR</b> cuando pare — puedes iniciar/parar las veces necesarias (almuerzo, atascos); el tiempo total se suma. Escribe el <b style="color:#f0d68a;">total de huevos</b> una vez al día. Huevos/hr es automático. Todo registra quién y cuándo, en vivo en cada equipo.') +
  '</div>';

  farms.forEach(function (farm) {
    var rec = erRec(farm, t);
    var running = erRunning(rec);
    var totalMs = erTotalMs(rec);
    var eggs = (rec && rec.eggs != null) ? Number(rec.eggs) : null;
    var hrs = totalMs / 3600000;
    var eph = (eggs && hrs > 0.05) ? Math.round(eggs / hrs) : null;

    var statusHtml, btnHtml;
    if (running) {
      statusHtml = '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#4ade80;background:#0d2a12;border:1px solid #2a7a3a;border-radius:8px;padding:8px 11px;margin:9px 0;">🟢 ' +
        erL('RUNNING — started ', 'CORRIENDO — inició ') + erFmtTime(running.s) + (running.by ? ' · ' + running.by : '') +
        ' · <span style="color:#a7e08a;">' + erFmtDur(totalMs) + erL(' today', ' hoy') + '</span></div>';
      btnHtml = '<button onclick="eggRunStop(\'' + farm + '\')" style="width:100%;padding:16px;border-radius:12px;' + MONO + 'font-size:16px;font-weight:700;cursor:pointer;background:#7a1414;border:2px solid #c0392b;color:#ffd7d7;">⏹ ' + erL('STOP MACHINE', 'PARAR MÁQUINA') + '</button>';
    } else if (erRuns(rec).length) {
      statusHtml = '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#d8b478;background:#1a1408;border:1px solid #5a4a2a;border-radius:8px;padding:8px 11px;margin:9px 0;">⏸ ' +
        erL('Stopped — total run ', 'Detenida — tiempo total ') + '<span style="color:#f0d68a;">' + erFmtDur(totalMs) + '</span></div>';
      btnHtml = '<button onclick="eggRunStart(\'' + farm + '\')" style="width:100%;padding:16px;border-radius:12px;' + MONO + 'font-size:16px;font-weight:700;cursor:pointer;background:#14361c;border:2px solid #4ade80;color:#4ade80;">▶ ' + erL('RESUME — START AGAIN', 'REANUDAR — INICIAR') + '</button>';
    } else {
      statusHtml = '';
      btnHtml = '<button onclick="eggRunStart(\'' + farm + '\')" style="width:100%;padding:18px;border-radius:12px;' + MONO + 'font-size:17px;font-weight:700;cursor:pointer;background:#14361c;border:2px solid #4ade80;color:#4ade80;">▶ ' + erL('START MACHINE', 'INICIAR MÁQUINA') + '</button>';
    }

    var runRows = erRuns(rec).map(function (r, i) {
      return '<div style="' + MONO + 'font-size:11px;color:#7a9a7a;padding:3px 0;">' +
        (i + 1) + '. ▶ ' + erFmtTime(r.s) + (r.by ? ' <span style="color:#5a8a5a;">' + r.by + '</span>' : '') +
        (r.e ? ' &nbsp;→&nbsp; ⏹ ' + erFmtTime(r.e) + ' <span style="color:#9ab09a;">(' + erFmtDur(r.e - r.s) + ')</span>' : ' &nbsp;→&nbsp; <span style="color:#4ade80;">' + erL('running…', 'corriendo…') + '</span>') +
      '</div>';
    }).join('');

    html += '<div style="background:#0f2410;border:1.5px solid ' + (running ? '#2a7a3a' : '#2a5a2a') + ';border-radius:12px;padding:14px;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
        '<div style="' + MONO + 'font-size:15px;font-weight:700;color:#e8f5ec;">🥚 ' + farm + ' — ' + erL('Daily Egg Run', 'Corrida diaria de huevos') + '</div>' +
        '<div style="' + MONO + 'font-size:11px;color:#7ab07a;">' + t + '</div>' +
      '</div>' +
      statusHtml + btnHtml +
      (runRows ? '<div style="margin-top:9px;border-top:1px dashed #2a5a2a;padding-top:7px;">' + runRows + '</div>' : '') +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding-top:11px;border-top:1px solid #163016;">' +
        '<label style="' + MONO + 'font-size:12px;color:#f0d68a;font-weight:700;">🥚 ' + erL('Total eggs today', 'Total de huevos hoy') + '</label>' +
        '<input type="number" min="0" inputmode="numeric" value="' + (eggs != null ? eggs : '') + '" onchange="eggRunEggsSet(\'' + farm + '\',this.value)" placeholder="0" style="flex:1;min-width:120px;background:#0a1408;border:1.5px solid #5a4a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:16px;font-weight:700;padding:11px 12px;">' +
        '<div style="' + MONO + 'font-size:11px;color:#9ab09a;line-height:1.6;">' +
          (eggs != null ? ('= ' + (Math.round(eggs / 12 * 10) / 10).toLocaleString() + ' dz') : '') +
          (eph ? ('<br><b style="color:#4ade80;">' + eph.toLocaleString() + ' ' + erL('eggs/hr', 'huevos/hr') + '</b>') : '') +
        '</div>' +
      '</div>' +
    '</div>';
  });

  // ── 14-day history (tracking log) ──
  var hist = _erDocs.slice()
    .filter(function (r) { return farms.indexOf(r.farm) !== -1; })
    .sort(function (a, b) { return (b.date > a.date ? 1 : b.date < a.date ? -1 : 0); });
  if (hist.length) {
    var hrows = hist.map(function (r) {
      var ms = erTotalMs(r), h2 = ms / 3600000;
      var e2 = (r.eggs != null) ? Number(r.eggs) : null;
      var eph2 = (e2 && h2 > 0.05) ? Math.round(e2 / h2) : null;
      var first = erRuns(r)[0];
      return '<tr style="border-bottom:1px solid #1a2a1a;">' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + (r.date || '—').slice(5).replace('-', '/') + '</td>' +
        '<td style="padding:8px 6px;color:#7ab07a;">' + r.farm + '</td>' +
        '<td style="padding:8px 6px;color:#aaa;">' + (first ? erFmtTime(first.s) : '—') + '</td>' +
        '<td style="padding:8px 6px;color:#f0d68a;">' + (ms ? erFmtDur(ms) : '—') + '</td>' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + (e2 != null ? e2.toLocaleString() : '—') + '</td>' +
        '<td style="padding:8px 6px;color:' + (eph2 ? '#4ade80' : '#555') + ';">' + (eph2 ? eph2.toLocaleString() : '—') + '</td>' +
        '<td style="padding:8px 6px;color:#5a8a5a;font-size:11px;">' + ((erRuns(r)[0] || {}).by || r.by || '—') + '</td>' +
      '</tr>';
    }).join('');
    html += '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#7ab07a;margin:16px 0 8px;">📋 ' + erL('Last 14 days', 'Últimos 14 días') + '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;min-width:540px;">' +
      '<thead><tr style="border-bottom:1px solid #2a4a2a;">' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Date', 'Fecha') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + erL('Farm', 'Granja') + '</th>' +
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
  var anyRunning = farms.some(function (f) { return !!erRunning(erRec(f, t)); });
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
  window.eggRunEggsSet = eggRunEggsSet;
  window.openProcessing = openProcessing;
}
