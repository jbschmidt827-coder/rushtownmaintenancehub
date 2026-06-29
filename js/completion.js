// ═══════════════════════════════════════════════════════════════════════════
// completion.js — Daily house-completion dashboard  (EN/ES)
// For each house, shows whether the day's three required checks are in:
//   Morning Walk (morningWalks) · Daily Employee Check (barnWalks) · Manure (manureSubmit)
// Cells: ✓ done · ✗ still open · — not applicable (manure only Hegins 4-8).
// % per house, per check, and overall. Scoped via getPreferredFarm(); Master=both.
// Read-only snapshot of TODAY (Refresh re-pulls). Opened from a 📊 home card.
// ═══════════════════════════════════════════════════════════════════════════

// i18n — own helper (don't redeclare manure.js's ML, would crash on dup-declare)
function _clang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
function compL(en, es) { return _clang() === 'es' ? es : en; }

const COMP_CHECKS = [
  { key: 'morning', label: 'Morning', labelEs: 'Mañana',    coll: 'morningWalks' },
  { key: 'check',   label: 'Daily',   labelEs: 'Diario',    coll: 'barnWalks' },
  { key: 'manure',  label: 'Manure',  labelEs: 'Estiércol', coll: 'manureSubmit' }
];

var _compData = { morning: null, check: null, manure: null };
var _compLoading = false;

function compToday() { return new Date().toISOString().slice(0, 10); }
function _compHnum(h) { var m = String(h).match(/\d+/); return m ? m[0] : String(h); }

function compFarms() {
  var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
  if (f === 'Hegins' || f === 'Danville') return [f];
  if (!f) return ['Hegins', 'Danville'];
  return [];
}
function compHouses(farm) {
  var base = farm === 'Hegins' ? [1, 2, 3, 4, 5, 6, 7, 8] : (farm === 'Danville' ? [1, 2, 3, 4, 5] : []);
  return base.filter(function (h) { return !(typeof isHouseDown === 'function' && isHouseDown(farm, h)); });
}
function compManureApplies(farm, house) {
  var hs = (typeof MANURE_HOUSES !== 'undefined' && MANURE_HOUSES[farm]) ? MANURE_HOUSES[farm] : [];
  return hs.indexOf(Number(house)) !== -1;
}
function compApplies(key, farm, house) { return key === 'manure' ? compManureApplies(farm, house) : true; }
function compDone(key, farm, house) { var s = _compData[key]; return !!(s && s.has(farm + '|' + _compHnum(house))); }

async function compLoad() {
  if (typeof db === 'undefined' || !db) return;
  _compLoading = true; renderCompletion();
  var today = compToday();
  try {
    var results = await Promise.all(COMP_CHECKS.map(function (c) {
      return db.collection(c.coll).where('date', '==', today).get()
        .then(function (snap) {
          var s = new Set();
          snap.forEach(function (d) { var x = d.data(); if (x && x.farm != null && x.house != null) s.add(x.farm + '|' + _compHnum(x.house)); });
          return { key: c.key, set: s };
        })
        .catch(function (e) { console.error('completion load ' + c.coll + ':', e); return { key: c.key, set: new Set() }; });
    }));
    results.forEach(function (r) { _compData[r.key] = r.set; });
  } catch (e) { console.error('compLoad:', e); }
  _compLoading = false; renderCompletion();
}

function openCompletion() {
  var ov = document.getElementById('completion-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'completion-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:950;background:#08121a;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    document.body.appendChild(ov);
  }
  ov.style.display = 'block';
  renderCompletion();
  compLoad();
  try { window.scrollTo(0, 0); } catch (e) {}
}
function closeCompletion() { var ov = document.getElementById('completion-overlay'); if (ov) ov.style.display = 'none'; }

function _compCell(key, farm, house) {
  if (!compApplies(key, farm, house)) {
    return '<td style="text-align:center;padding:0;"><div style="margin:3px;padding:9px 4px;color:#3a5a66;font-family:\'IBM Plex Mono\',monospace;font-size:13px;">—</div></td>';
  }
  var done = compDone(key, farm, house);
  return '<td style="text-align:center;padding:0;"><div style="margin:3px;border-radius:7px;background:' + (done ? '#14532d' : '#3a1414') + ';color:' + (done ? '#86efac' : '#f8a4a4') + ';font-family:\'IBM Plex Mono\',monospace;font-size:18px;font-weight:800;padding:10px 4px;">' + (done ? '✓' : '✗') + '</div></td>';
}

function renderCompletion() {
  var ov = document.getElementById('completion-overlay');
  if (!ov) return;
  var farms = compFarms();
  var dateStr = new Date().toLocaleDateString(_clang() === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  var HOUSE = compL('House', 'Casa');

  var body = '';
  if (!farms.length) {
    body = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;color:#9ac9d6;text-align:center;padding:40px 16px;">' + compL('House completion is tracked at the layer sites.<br>Go back and pick <b>Hegins</b> or <b>Danville</b> (or <b>Master</b> for both).', 'El cumplimiento por casa se registra en las casas de gallinas.<br>Regresa y elige <b>Hegins</b> o <b>Danville</b> (o <b>Master</b> para ambas).') + '</div>';
  } else {
    var totDone = 0, totApp = 0;
    farms.forEach(function (farm) {
      var houses = compHouses(farm);
      var colDone = { morning: 0, check: 0, manure: 0 }, colApp = { morning: 0, check: 0, manure: 0 };
      var rowsHtml = '';
      houses.forEach(function (house) {
        var hDone = 0, hApp = 0, cells = '';
        COMP_CHECKS.forEach(function (c) {
          if (compApplies(c.key, farm, house)) { colApp[c.key]++; hApp++; if (compDone(c.key, farm, house)) { colDone[c.key]++; hDone++; } }
          cells += _compCell(c.key, farm, house);
        });
        totDone += hDone; totApp += hApp;
        var hPct = hApp ? Math.round(hDone / hApp * 100) : 0;
        var hcol = hPct === 100 ? '#4ade80' : (hPct === 0 ? '#f8a4a4' : '#e8d36a');
        rowsHtml += '<tr>' +
          '<td style="padding:6px 8px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;color:#dbeaf0;white-space:nowrap;">H' + house + '</td>' +
          cells +
          '<td style="text-align:center;padding:6px 8px;font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:800;color:' + hcol + ';">' + hPct + '%</td>' +
        '</tr>';
      });
      var headCells = COMP_CHECKS.map(function (c) { return '<th style="padding:6px 4px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;color:#7fb8cc;text-transform:uppercase;letter-spacing:0.5px;">' + compL(c.label, c.labelEs) + '</th>'; }).join('');
      var footCells = COMP_CHECKS.map(function (c) {
        var p = colApp[c.key] ? Math.round(colDone[c.key] / colApp[c.key] * 100) : 0;
        var cc = p === 100 ? '#4ade80' : (p === 0 ? '#f8a4a4' : '#e8d36a');
        return '<td style="text-align:center;padding:6px 4px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;color:' + cc + ';">' + p + '%</td>';
      }).join('');
      var fDone = colDone.morning + colDone.check + colDone.manure;
      var fApp = colApp.morning + colApp.check + colApp.manure;
      var fPct = fApp ? Math.round(fDone / fApp * 100) : 0;

      body += '<div style="background:#0c1c26;border:1.5px solid ' + (fPct === 100 ? '#2a7a9a' : '#1e3a46') + ';border-radius:12px;padding:12px;margin-bottom:14px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;color:#eaf6fb;">📍 ' + farm + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;color:' + (fPct === 100 ? '#4ade80' : '#9ac9d6') + ';">' + fPct + '% ' + compL('complete', 'completo') + '</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;">' +
          '<thead><tr><th style="text-align:left;padding:6px 8px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#5f8fa0;text-transform:uppercase;">' + HOUSE + '</th>' + headCells + '<th style="padding:6px 8px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#5f8fa0;text-transform:uppercase;">%</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
          '<tfoot><tr style="border-top:1px solid #1e3a46;"><td style="padding:6px 8px;font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#5f8fa0;text-transform:uppercase;">' + compL('% done', '% hecho') + '</td>' + footCells + '<td></td></tr></tfoot>' +
        '</table>' +
      '</div>';
    });
    var overall = totApp ? Math.round(totDone / totApp * 100) : 0;
    body = '<div style="background:#0a2030;border:1.5px solid #2a7a9a;border-radius:12px;padding:14px;margin-bottom:14px;text-align:center;">' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:44px;font-weight:800;color:' + (overall === 100 ? '#4ade80' : '#9ad6ea') + ';line-height:1;">' + overall + '%</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:1px;color:#9ac9d6;text-transform:uppercase;margin:7px 0 10px;">' + compL('Done today · all checks', 'Listo hoy · todas las revisiones') + (_compLoading ? ' · ' + compL('loading…', 'cargando…') : '') + '</div>' +
        '<div style="height:10px;background:#06151e;border:1px solid #1e3a46;border-radius:5px;overflow:hidden;"><div style="height:100%;width:' + overall + '%;background:' + (overall === 100 ? '#2e7d32' : '#2a8ab0') + ';transition:width .3s;"></div></div>' +
      '</div>' + body;
  }

  ov.innerHTML =
    '<div style="max-width:760px;margin:0 auto;padding:calc(env(safe-area-inset-top, 0px) + 30px) 14px 40px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<button onclick="closeCompletion()" style="padding:11px 16px;background:#0a1a24;border:1.5px solid #2a5a6a;border-radius:50px;color:#9ad6ea;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">← ' + compL('Back', 'Atrás') + '</button>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<button onclick="compLoad()" style="padding:9px 13px;background:#0a2030;border:1.5px solid #2a7a9a;border-radius:10px;color:#9ad6ea;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;">↻ ' + compL('Refresh', 'Actualizar') + '</button>' +
          '<div style="text-align:right;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;color:#eaf6fb;letter-spacing:2px;line-height:1;">📊 ' + compL('COMPLETION', 'CUMPLIMIENTO') + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#7fb8cc;margin-top:2px;">' + dateStr + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ac9d6;line-height:1.5;background:#0a1c26;border:1px solid #1e3a46;border-radius:10px;padding:10px 12px;margin:8px 0 14px;">' + compL('Green ✓ = done today · red ✗ = still open · — = not applicable. Columns: <b style="color:#9ad6ea;">Morning</b> Walk · <b style="color:#9ad6ea;">Daily</b> Check · <b style="color:#9ad6ea;">Manure</b>. % shows per house and per check.', 'Verde ✓ = hecho hoy · rojo ✗ = pendiente · — = no aplica. Columnas: Caminata de la <b style="color:#9ad6ea;">Mañana</b> · Revisión <b style="color:#9ad6ea;">Diaria</b> · <b style="color:#9ad6ea;">Estiércol</b>. El % se muestra por casa y por revisión.') + '</div>' +
      body +
    '</div>';
}

if (typeof window !== 'undefined') {
  window.openCompletion = openCompletion;
  window.closeCompletion = closeCompletion;
  window.renderCompletion = renderCompletion;
  window.compLoad = compLoad;
}
