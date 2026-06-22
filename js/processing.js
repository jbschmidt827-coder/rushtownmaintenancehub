// ═══════════════════════════════════════════════════════════════════════════
// processing.js — Processing Plant tab (was "Packaging")
// Reached from its OWN button on the front screen (landing). Opens a card-style
// home just like the per-site homes: Maintenance · Processing Units · Processing PMs.
// "Processing Units" (Packers/Cleaners/Conveyors/Cleanup) tracks per-unit counts
// (Firestore collection `processingLog`) + open work orders. Data fills in over time.
// Rendered into #processing-body inside #panel-pkg; go('pkg') calls renderProcessing().
// ═══════════════════════════════════════════════════════════════════════════
const PROC_UNITS = [
  { key: 'Packers',   icon: '📦' },
  { key: 'Cleaners',  icon: '🧼' },
  { key: 'Conveyors', icon: '🔗' },
  { key: 'Cleanup',   icon: '🧹' }
];
let _procLog = [];
let _procListening = false;

function procEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function procToday() { return new Date().toISOString().slice(0, 10); }

function procStartListener() {
  if (_procListening || typeof db === 'undefined' || !db) return;
  _procListening = true;
  try {
    db.collection('processingLog').orderBy('ts', 'desc').limit(200).onSnapshot(function (snap) {
      _procLog = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
      var panel = document.getElementById('panel-pkg');
      if (panel && panel.classList.contains('active')) { if (window._procView === 'units') procOpenUnits(); else renderProcessing(); }
    }, function (err) { console.error('processingLog listener:', err); });
  } catch (e) { console.error('procStartListener:', e); _procListening = false; }
}

function procOpenWOs(unit) {
  var wos = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
  return wos.filter(function (w) {
    if (!w || w.farm !== 'Processing Plant' || w.status === 'completed') return false;
    return unit ? String(w.house) === unit : true;
  });
}

function procHideLegacy() {
  Array.prototype.forEach.call(document.querySelectorAll('#panel-pkg > *'), function (el) {
    if (el.id === 'processing-body' || (el.classList && el.classList.contains('section-title'))) return;
    el.style.display = 'none';
  });
}

// ── Card-style home (matches the per-site home tiles) ──
function renderProcessing() {
  window._procView = 'home';
  procStartListener();
  procHideLegacy();
  var body = document.getElementById('processing-body');
  if (!body) return;
  var plantOpen = procOpenWOs(null).length;
  var todayLogs = _procLog.filter(function (r) { return r.date === procToday(); }).length;

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
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#5a8a5a;margin-bottom:14px;">🏭 Processing Plant</div>' +
    tile("go('maint')", '#0d1f3a', '#3b82f6', '🔧', 'Maintenance', 'Work orders · PM · Parts', plantOpen + ' open work order' + (plantOpen !== 1 ? 's' : ''), '#9cc0f6') +
    tile("procOpenUnits()", '#2a1f0a', '#d69e2e', '📦', 'Processing Units', 'Packers · Cleaners · Conveyors · Cleanup', todayLogs + ' log' + (todayLogs !== 1 ? 's' : '') + ' today', '#d6b36a') +
    tile("go('pm')", '#10241a', '#4ade80', '🛠', 'Processing PMs', 'PM schedule for the plant', '', '');
}

// ── Units detail (counts + work orders per unit) ──
function procOpenUnits() {
  window._procView = 'units';
  procStartListener();
  procHideLegacy();
  var body = document.getElementById('processing-body');
  if (!body) return;
  var today = procToday();
  var rows = PROC_UNITS.map(function (u) {
    var open = procOpenWOs(u.key);
    var todayCount = _procLog.filter(function (r) { return r.unit === u.key && r.date === today; }).reduce(function (s, r) { return s + (Number(r.count) || 0); }, 0);
    var chips = open.slice(0, 3).map(function (w) { return '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#d6b36a;background:#1a1500;border:1px solid #856404;border-radius:5px;padding:2px 6px;">⚡ ' + procEsc(w.id || '') + '</span>'; }).join(' ');
    return '<div style="background:#0f2410;border:1.5px solid #2a5a2a;border-radius:12px;padding:13px 14px;margin-bottom:10px;">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<span style="font-size:22px;">' + u.icon + '</span>' +
        '<div style="flex:1;min-width:120px;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;color:#e8f5ec;">' + u.key + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#7ab07a;margin-top:2px;">' + open.length + ' open WO' + (open.length !== 1 ? 's' : '') + ' · today: ' + todayCount + '</div>' +
        '</div>' +
        '<button onclick="procLogCount(\'' + u.key + '\')" style="padding:8px 11px;background:#1a3a1a;border:1px solid #4ade80;border-radius:8px;color:#4ade80;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">＋ Count</button>' +
        '<button onclick="procNewWO(\'' + u.key + '\')" style="padding:8px 11px;background:#15213a;border:1px solid #3b82f6;border-radius:8px;color:#9cc0f6;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🔧 WO</button>' +
      '</div>' +
      (chips ? '<div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;">' + chips + '</div>' : '') +
    '</div>';
  }).join('');

  body.innerHTML =
    '<button onclick="renderProcessing()" style="padding:9px 14px;margin-bottom:14px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#7ab07a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;">← Processing</button>' +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;margin-bottom:8px;">Units · tap ＋ Count to log</div>' +
    rows;
}

async function procLogCount(unit) {
  var raw = prompt('Log a count / reading for ' + unit + ':');
  if (raw === null) return;
  raw = String(raw).trim();
  if (raw === '') return;
  var val = Number(raw);
  if (isNaN(val) || val < 0) { alert('Please enter a valid number.'); return; }
  var by = (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : '');
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('processingLog').add({ unit: unit, count: val, by: by, notes: '', date: procToday(), ts: Date.now() });
    if (typeof setSyncDot === 'function') setSyncDot('live');
    if (typeof toast === 'function') toast('✅ Logged ' + val + ' — ' + unit);
  } catch (e) {
    console.error('procLogCount:', e);
    alert('Could not save: ' + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

// Open the Work Order form pre-scoped to Processing Plant + this unit.
function procNewWO(unit) {
  if (typeof go === 'function') go('wo-submit');
  setTimeout(function () {
    var farm = document.getElementById('wo-farm');
    if (farm) {
      farm.value = 'Processing Plant';
      if (typeof loadHouses === 'function') loadHouses();
      if (typeof woFillNames === 'function') woFillNames('Processing Plant');
    }
    var house = document.getElementById('wo-house');
    if (house) {
      var has = Array.prototype.some.call(house.options, function (o) { return o.value === unit || o.text === unit; });
      if (!has) { var opt = document.createElement('option'); opt.value = unit; opt.text = unit; house.appendChild(opt); }
      house.value = unit;
    }
  }, 130);
}

if (typeof window !== 'undefined') {
  window.renderProcessing = renderProcessing;
  window.procOpenUnits = procOpenUnits;
  window.procLogCount = procLogCount;
  window.procNewWO = procNewWO;
}
