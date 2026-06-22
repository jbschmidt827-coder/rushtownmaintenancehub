// ═══════════════════════════════════════════════════════════════════════════
// processing.js — Processing Plant tab (was "Packaging")
// The processing plant has no barns. Instead it's organized into UNITS —
// Packers, Cleaners, Conveyors, Cleanup — and each unit tracks both
// maintenance (open work orders + the Processing Plant PMs) and a simple
// per-unit count / activity log (Firestore collection `processingLog`).
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
      if (panel && panel.classList.contains('active')) renderProcessing();
    }, function (err) { console.error('processingLog listener:', err); });
  } catch (e) { console.error('procStartListener:', e); _procListening = false; }
}

function procOpenWOs(unit) {
  var wos = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
  return wos.filter(function (w) { return w && w.farm === 'Processing Plant' && String(w.house) === unit && w.status !== 'completed'; });
}

function renderProcessing() {
  procStartListener();
  // Hide the legacy packaging markup — show only the title + our container.
  Array.prototype.forEach.call(document.querySelectorAll('#panel-pkg > *'), function (el) {
    if (el.id === 'processing-body' || (el.classList && el.classList.contains('section-title'))) return;
    el.style.display = 'none';
  });
  var body = document.getElementById('processing-body');
  if (!body) return;
  var today = procToday();

  var cards = PROC_UNITS.map(function (u) {
    var open = procOpenWOs(u.key);
    var todayCount = _procLog.filter(function (r) { return r.unit === u.key && r.date === today; })
                             .reduce(function (s, r) { return s + (Number(r.count) || 0); }, 0);
    var woList = open.slice(0, 4).map(function (w) {
      return '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#d6b36a;background:#1a1500;border:1px solid #856404;border-radius:6px;padding:5px 8px;">⚡ ' + procEsc(w.id || '') + ' — ' + procEsc(w.problem || w.desc || '') + '</div>';
    }).join('');
    return '' +
    '<div style="background:#0f2410;border:1.5px solid #2a5a2a;border-radius:12px;padding:14px;margin-bottom:12px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="font-size:24px;line-height:1;">' + u.icon + '</span>' +
        '<div style="flex:1;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:700;color:#e8f5ec;">' + u.key + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#7ab07a;margin-top:2px;">' + open.length + ' open WO' + (open.length !== 1 ? 's' : '') + ' · today: ' + todayCount + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:11px;">' +
        '<input id="proc-count-' + u.key + '" type="number" min="0" placeholder="Count / reading" style="flex:1;min-width:110px;box-sizing:border-box;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:\'IBM Plex Mono\',monospace;font-size:13px;">' +
        '<button onclick="procLogCount(\'' + u.key + '\')" style="padding:9px 13px;background:#1a3a1a;border:1px solid #4ade80;border-radius:8px;color:#4ade80;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">＋ Log</button>' +
        '<button onclick="procNewWO(\'' + u.key + '\')" style="padding:9px 13px;background:#15213a;border:1px solid #3b82f6;border-radius:8px;color:#9cc0f6;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">🔧 WO</button>' +
      '</div>' +
      (woList ? '<div style="margin-top:9px;display:flex;flex-direction:column;gap:5px;">' + woList + '</div>' : '') +
    '</div>';
  }).join('');

  var recent = _procLog.slice(0, 12).map(function (r) {
    return '<div style="display:flex;justify-content:space-between;gap:10px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#a8c5b0;padding:6px 8px;border-bottom:1px solid #163016;">' +
      '<span>' + procEsc(r.unit) + ' · ' + (Number(r.count) || 0) + '</span>' +
      '<span style="color:#5a8a5a;">' + procEsc(r.by || '') + ' ' + procEsc(r.date || '') + '</span>' +
    '</div>';
  }).join('') || '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#3a6a3a;padding:8px;">No entries yet.</div>';

  body.innerHTML =
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#5a8a5a;margin-bottom:12px;">Processing Plant · maintenance + counts by unit</div>' +
    '<button onclick="go(\'pm\')" style="width:100%;padding:11px;margin-bottom:14px;background:#0d1f3a;border:1.5px solid #3b82f6;border-radius:10px;color:#9cc0f6;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;">🛠 Processing PMs →</button>' +
    cards +
    '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;margin:16px 0 6px;">Recent log</div>' +
    '<div style="background:#0c1a0c;border:1px solid #1e3a1e;border-radius:10px;overflow:hidden;">' + recent + '</div>';
}

async function procLogCount(unit) {
  var inp = document.getElementById('proc-count-' + unit);
  var raw = inp ? inp.value : '';
  if (raw === '' || raw == null) { if (inp) inp.focus(); return; }
  var val = Number(raw);
  if (isNaN(val) || val < 0) { alert('Enter a valid number.'); return; }
  var by = (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : '');
  var rec = { unit: unit, count: val, by: by, notes: '', date: procToday(), ts: Date.now() };
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('processingLog').add(rec);
    if (typeof setSyncDot === 'function') setSyncDot('live');
    if (inp) inp.value = '';
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
  window.procLogCount = procLogCount;
  window.procNewWO = procNewWO;
}
