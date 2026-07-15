// ═══════════════════════════════════════════════════════════════════════════
// processing.js — Processing Plant tab (was "Packaging")  (EN/ES)
// Front-screen button → a card-style home (like the per-site homes):
//   🔧 Maintenance · 📦 Packing Log · 🛠 Processing PMs
// Packing Log records PER PACKING LINE: cases packed, downtime (min + reason),
// and breakage/cracks. The app totals it and breaks it down by line.
// Stored in Firestore collection `processingLog`. Stored values stay English;
// only the on-screen text is translated, so data is language-independent.
// ═══════════════════════════════════════════════════════════════════════════

// Packing lines — EDIT THIS LIST to match the plant (names/count).
const PROC_LINES = ['Packer 1', 'Packer 2', 'Packer 3', 'Packer 4'];
const PROC_DT_REASONS = ['', 'Jam', 'Mechanical', 'Changeover', 'Cleaning', 'Waiting on eggs', 'Other'];
const PROC_DT_REASON_ES = { 'Jam': 'Atasco', 'Mechanical': 'Mecánico', 'Changeover': 'Cambio', 'Cleaning': 'Limpieza', 'Waiting on eggs': 'Esperando huevos', 'Other': 'Otro' };

// i18n — own helper (don't redeclare ML/compL from other modules, would crash)
function _plang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
function procL(en, es) { return _plang() === 'es' ? es : en; }

let _procLog = [];
let _procListening = false;

function procEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function procToday() { return new Date().toISOString().slice(0, 10); }
function procNum(n) { return (Number(n) || 0).toLocaleString(); }

function procStartListener() {
  if (_procListening || typeof db === 'undefined' || !db) return;
  _procListening = true;
  try {
    db.collection('processingLog').orderBy('ts', 'desc').limit(300).onSnapshot(function (snap) {
      _procLog = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      var panel = document.getElementById('panel-pkg');
      if (panel && panel.classList.contains('active')) { if (window._procView === 'packing') procOpenPacking(); else renderProcessing(); }
    }, function (err) { console.error('processingLog listener:', err); });
  } catch (e) { console.error('procStartListener:', e); _procListening = false; }
}

function procPlantOpenWOs() {
  var wos = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
  return wos.filter(function (w) { return w && w.farm === 'Processing Plant' && w.status !== 'completed'; });
}
function procTodayRows() { var t = procToday(); return _procLog.filter(function (r) { return r.date === t; }); }
function procSum(rows, field) { return rows.reduce(function (s, r) { return s + (Number(r[field]) || 0); }, 0); }

function procHideLegacy() {
  Array.prototype.forEach.call(document.querySelectorAll('#panel-pkg > *'), function (el) {
    if (el.id === 'processing-body' || (el.classList && el.classList.contains('section-title'))) return;
    el.style.display = 'none';
  });
}

// ── Card-style home ──
function renderProcessing() {
  window._procView = 'home';
  procStartListener();
  procHideLegacy();
  var body = document.getElementById('processing-body');
  if (!body) return;
  var plantOpen = procPlantOpenWOs().length;
  var casesToday = procSum(procTodayRows(), 'cases');

  function tile(onclick, bg, border, icon, title, sub, status, statusColor) {
    return '<button onclick="' + onclick + '" class="hub-card" style="width:100%;padding:16px 16px;background:' + bg + ';border:2px solid ' + border + ';border-radius:14px;color:#fff;cursor:pointer;text-align:left;display:flex;align-items:center;gap:14px;margin-bottom:10px;">' +
      '<span style="font-size:30px;line-height:1;">' + icon + '</span>' +
      '<div style="flex:1;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;color:#f0ead8;letter-spacing:1px;text-transform:uppercase;">' + title + '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#7ab07a;line-height:1.4;margin-top:3px;">' + sub + '</div>' +
        (status ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;margin-top:4px;color:' + (statusColor || '#7ab07a') + ';">' + status + '</div>' : '') +
      '</div>' +
      '<span style="font-size:20px;color:' + border + ';">→</span>' +
    '</button>';
  }

  body.innerHTML =
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#5a8a5a;margin-bottom:14px;">🏭 ' + procL('Processing Plant', 'Planta de Procesamiento') + '</div>' +
    tile("go('maint')", '#0d1f3a', '#3b82f6', '🔧', procL('Maintenance', 'Mantenimiento'), procL('Work orders · PM · Parts', 'Órdenes · PM · Piezas'), plantOpen + ' ' + procL('open work order' + (plantOpen !== 1 ? 's' : ''), 'orden' + (plantOpen !== 1 ? 'es' : '') + ' abierta' + (plantOpen !== 1 ? 's' : '')), '#9cc0f6') +
    tile("procOpenPacking()", '#2a1f0a', '#d69e2e', '📦', procL('Packing Log', 'Registro de Empaque'), procL('Cases · Downtime · Breakage, by line', 'Cajas · Paro · Rotura, por línea'), procNum(casesToday) + ' ' + procL('cases today', 'cajas hoy'), '#d6b36a') +
    tile("go('pm')", '#10241a', '#4ade80', '🛠', procL('Processing PMs', 'PM de Procesamiento'), procL('PM schedule for the plant', 'Calendario de PM de la planta'), '', '');
}

// ── Packing Log (per line: cases, downtime, breakage) ──
function procOpenPacking() {
  window._procView = 'packing';
  procStartListener();
  procHideLegacy();
  var body = document.getElementById('processing-body');
  if (!body) return;
  var rows = procTodayRows();
  var inp = 'width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:\'IBM Plex Mono\',monospace;font-size:13px;';
  var lbl = 'font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;display:block;margin-bottom:4px;';

  // Per-line totals for today
  var perLine = PROC_LINES.map(function (ln) {
    var lr = rows.filter(function (r) { return r.line === ln; });
    var c = procSum(lr, 'cases'), d = procSum(lr, 'downtimeMin'), b = procSum(lr, 'breakage'), rm = procSum(lr, 'runMin');
    if (!lr.length) return '';
    return '<div style="display:flex;justify-content:space-between;gap:8px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#cfe0a0;padding:7px 9px;border-bottom:1px solid #163016;">' +
      '<span style="font-weight:700;">' + procEsc(ln) + '</span>' +
      '<span>📦 ' + procNum(c) + (rm ? ' · ▶ ' + procNum(rm) + 'm' : '') + ' · ⏱ ' + procNum(d) + 'm · 💔 ' + procNum(b) + '</span></div>';
  }).join('') || '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#3a6a3a;padding:9px;">' + procL('No packing logged today yet.', 'Aún no hay empaque registrado hoy.') + '</div>';

  var lastLine = rows.length ? rows[0].line : ''; // most recent line today → pre-selected
  var lineOpts = PROC_LINES.map(function (l) { return '<option' + (l === lastLine ? ' selected' : '') + '>' + procEsc(l) + '</option>'; }).join('');
  // option VALUE stays English (stored), display translated
  var reasonOpts = PROC_DT_REASONS.map(function (r) {
    var disp = r ? (_plang() === 'es' ? (PROC_DT_REASON_ES[r] || r) : r) : procL('— reason —', '— motivo —');
    return '<option value="' + procEsc(r) + '">' + procEsc(disp) + '</option>';
  }).join('');

  body.innerHTML =
    '<button onclick="renderProcessing()" style="padding:9px 14px;margin-bottom:14px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#7ab07a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;">← ' + procL('Processing', 'Procesamiento') + '</button>' +
    // Today summary
    '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
      '<div style="flex:1;background:#0f2410;border:1.5px solid #2a5a2a;border-radius:10px;padding:11px;text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;color:#f0ead8;line-height:1;">' + procNum(procSum(rows, 'cases')) + '</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#7ab07a;margin-top:3px;">' + procL('CASES TODAY', 'CAJAS HOY') + '</div></div>' +
      '<div style="flex:1;background:#2a1f0a;border:1.5px solid #856404;border-radius:10px;padding:11px;text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;color:#f0d68a;line-height:1;">' + procNum(procSum(rows, 'downtimeMin')) + '</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#d6b36a;margin-top:3px;">' + procL('DOWNTIME MIN', 'PARO MIN') + '</div></div>' +
      '<div style="flex:1;background:#2a0f0f;border:1.5px solid #7f1d1d;border-radius:10px;padding:11px;text-align:center;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;color:#f8b4b4;line-height:1;">' + procNum(procSum(rows, 'breakage')) + '</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#e08a8a;margin-top:3px;">' + procL('BREAKAGE', 'ROTURA') + '</div></div>' +
    '</div>' +
    // Entry form
    '<div style="background:#0a1f0a;border:1.5px solid #2a5a2a;border-radius:12px;padding:14px;margin-bottom:14px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:1px;color:#4ade80;text-transform:uppercase;margin-bottom:10px;">➕ ' + procL('Log Packing', 'Registrar Empaque') + '</div>' +
      '<label style="' + lbl + '">' + procL('Line', 'Línea') + '</label><select id="proc-line" style="' + inp + 'margin-bottom:10px;">' + lineOpts + '</select>' +
      '<div style="display:flex;gap:9px;margin-bottom:10px;">' +
        '<div style="flex:1;"><label style="' + lbl + '">' + procL('Start time', 'Hora inicio') + '</label><input id="proc-start" type="time" style="' + inp + '"></div>' +
        '<div style="flex:1;"><label style="' + lbl + '">' + procL('Stop time', 'Hora fin') + '</label><input id="proc-stop" type="time" style="' + inp + '"></div>' +
      '</div>' +
      '<label style="' + lbl + '">' + procL('Cases packed', 'Cajas empacadas') + '</label><input id="proc-cases" type="number" min="0" inputmode="numeric" placeholder="0" style="' + inp + 'margin-bottom:10px;">' +
      '<div style="display:flex;gap:9px;margin-bottom:10px;">' +
        '<div style="flex:1;"><label style="' + lbl + '">' + procL('Downtime (min)', 'Paro (min)') + '</label><input id="proc-dt" type="number" min="0" inputmode="numeric" placeholder="0" style="' + inp + '"></div>' +
        '<div style="flex:1.4;"><label style="' + lbl + '">' + procL('Reason', 'Motivo') + '</label><select id="proc-dtreason" style="' + inp + '">' + reasonOpts + '</select></div>' +
      '</div>' +
      '<label style="' + lbl + '">' + procL('Breakage / cracks', 'Rotura / fisuras') + '</label><input id="proc-break" type="number" min="0" inputmode="numeric" placeholder="0" style="' + inp + 'margin-bottom:12px;">' +
      '<button onclick="procSavePacking()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#2e7d32;color:#fff;font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:800;letter-spacing:1px;cursor:pointer;">✓ ' + procL('Log Packing', 'Registrar Empaque') + '</button>' +
    '</div>' +
    // Per-line today
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;margin-bottom:6px;">' + procL('By line · today', 'Por línea · hoy') + '</div>' +
    '<div style="background:#0c1a0c;border:1px solid #1e3a1e;border-radius:10px;overflow:hidden;">' + perLine + '</div>';
}

async function procSavePacking() {
  var lineEl = document.getElementById('proc-line');
  var casesEl = document.getElementById('proc-cases');
  var line = lineEl ? lineEl.value : '';
  if (!line) { alert(procL('Pick a packing line.', 'Elige una línea de empaque.')); return; }
  if (!casesEl || casesEl.value === '') { alert(procL('Enter cases packed.', 'Ingresa las cajas empacadas.')); if (casesEl) casesEl.focus(); return; }
  var cases = Number(casesEl.value);
  if (isNaN(cases) || cases < 0) { alert(procL('Cases must be a number.', 'Las cajas deben ser un número.')); return; }
  var dt = Number((document.getElementById('proc-dt') || {}).value || 0) || 0;
  var reason = (document.getElementById('proc-dtreason') || {}).value || '';
  var brk = Number((document.getElementById('proc-break') || {}).value || 0) || 0;
  var start = ((document.getElementById('proc-start') || {}).value) || '';
  var stop = ((document.getElementById('proc-stop') || {}).value) || '';
  var runMin = (function () { if (!start || !stop) return null; var a = start.split(':'), b = stop.split(':'); var m = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1])); if (m < 0) m += 1440; return m; })();
  var by = (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : '');
  var rec = { line: line, cases: cases, start: start, stop: stop, runMin: runMin, downtimeMin: dt, downtimeReason: reason, breakage: brk, by: by, date: procToday(), ts: Date.now() };
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('processingLog').add(rec);
    if (typeof setSyncDot === 'function') setSyncDot('live');
    if (typeof toast === 'function') toast('✅ ' + procL('Logged ', 'Registradas ') + procNum(cases) + procL(' cases — ', ' cajas — ') + line);
    // listener re-renders the packing view (form clears on re-render)
  } catch (e) {
    console.error('procSavePacking:', e);
    alert(procL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

// Open the Work Order form pre-scoped to Processing Plant + this line.
function procNewWO(line) {
  if (typeof go === 'function') go('wo-submit');
  setTimeout(function () {
    var farm = document.getElementById('wo-farm');
    if (farm) {
      farm.value = 'Processing Plant';
      if (typeof loadHouses === 'function') loadHouses();
      if (typeof woFillNames === 'function') woFillNames('Processing Plant');
    }
    var house = document.getElementById('wo-house');
    if (house && line) {
      var has = Array.prototype.some.call(house.options, function (o) { return o.value === line || o.text === line; });
      if (!has) { var opt = document.createElement('option'); opt.value = line; opt.text = line; house.appendChild(opt); }
      house.value = line;
    }
  }, 130);
}

if (typeof window !== 'undefined') {
  window.renderProcessing = renderProcessing;
  window.procOpenPacking = procOpenPacking;
  window.procSavePacking = procSavePacking;
  window.procNewWO = procNewWO;
}
