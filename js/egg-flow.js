// ═══════════════════════════════════════════════════════════════════════════
// egg-flow.js — EGG FLOW / SETTING TRACKER (EN/ES)  [Front-End Flow Protector]
// Per house: the SPEED/SETTING we ran the egg belts at + HOW LONG the run took.
// Same setup as Manure Runs: tap ▶ Start (stamps time + saves the speed), tap
// ⏹ Stop (computes minutes). Live via onSnapshot — the table + running timers
// update on every tablet while a run is going. User-friendly big buttons.
//
// Data: collection eggFlow = {farm, house, speed, startTs, stopTs, minutes,
//        status:'open'|'done', date, by, ts}
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  function efL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _today() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }
  function _by() { try { return (typeof getDeviceUser === 'function' && getDeviceUser()) || ''; } catch (e) { return ''; } }

  var _efUnsub = null;
  var _efData = [];          // last-30-day eggFlow docs
  var _efTick = null;        // 20s live-duration repaint
  var _efDirty = {};         // farm_house → dirty-line ON toggled before a run starts

  function _efSite() {
    try { var p = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null; if (p === 'Hegins' || p === 'Danville') return p; } catch (e) {}
    return 'Danville';
  }
  function _efHouses(farm) {
    var out = [];
    try {
      var arr = (typeof FARM_HOUSES !== 'undefined' && FARM_HOUSES[farm]) ? FARM_HOUSES[farm] : [];
      arr.forEach(function (h) {
        var num = String(h).replace(/^\s*house\s*/i, '').trim();
        if (!(typeof isHouseDown === 'function' && isHouseDown(farm, num))) out.push(num);
      });
    } catch (e) {}
    return out;
  }
  function _openRun(farm, house) {
    return _efData.filter(function (r) { return r.farm === farm && String(r.house) === String(house) && r.status === 'open'; })
      .sort(function (a, b) { return (b.startTs || 0) - (a.startTs || 0); })[0] || null;
  }
  function _dur(ms) {
    if (ms == null) return '—';
    var m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }
  function _timeLbl(ts) { try { return ts ? new Date(ts).toLocaleTimeString(_lang === 'es' ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : ''; } catch (e) { return ''; } }

  // ── House cards (start/stop + speed) ──
  function _houseCard(farm, house) {
    var run = _openRun(farm, house);
    var running = !!run;
    var elapsed = running ? _dur(Date.now() - (run.startTs || Date.now())) : '';
    var speedVal = running ? (run.speed != null ? _esc(run.speed) : '') : '';
    var idb = (farm + '_' + house).replace(/[^a-zA-Z0-9]/g, '_');
    var dirtyOn = running ? !!run.dirtyLine : !!_efDirty[farm + '_' + house];
    var dirtyBtn = '<button onclick="efToggleDirty(\'' + _esc(farm) + '\',\'' + _esc(house) + '\')" style="flex:0 0 auto;padding:7px 11px;border-radius:8px;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;background:' + (dirtyOn ? '#3a2f0a' : '#0c150c') + ';border:1.5px solid ' + (dirtyOn ? '#d6b34a' : '#2a4a2a') + ';color:' + (dirtyOn ? '#f0d68a' : '#6a8a6a') + ';">🥚 ' + efL('Dirty line', 'Línea sucia') + ': ' + (dirtyOn ? efL('ON', 'SÍ') : efL('OFF', 'NO')) + '</button>';
    return '<div style="background:' + (running ? '#101f10' : '#0c150c') + ';border:1.5px solid ' + (running ? '#4ade80' : '#1e3a1e') + ';border-radius:12px;padding:12px 13px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="' + MONO + 'font-size:15px;font-weight:700;color:#f0ead8;min-width:60px;">' + efL('House', 'Casa') + ' ' + _esc(house) + '</span>' +
        (running
          ? '<span style="' + MONO + 'font-size:11px;color:#4ade80;">● ' + efL('running', 'corriendo') + ' ' + elapsed + '</span>'
          : '<span style="' + MONO + 'font-size:11px;color:#5a7a5a;">' + efL('not running', 'sin correr') + '</span>') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:9px;">' +
        '<label style="' + MONO + 'font-size:10px;color:#7a9a7a;flex:0 0 auto;">' + efL('Speed', 'Velocidad') + '</label>' +
        '<input id="ef-speed-' + idb + '" type="number" inputmode="decimal" step="0.1" value="' + speedVal + '" placeholder="—" ' +
          (running ? 'onchange="efSetSpeed(\'' + _esc(run._id) + '\',this.value)"' : '') +
          ' style="flex:0 0 72px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:15px;font-weight:700;text-align:center;">' +
        dirtyBtn +
        (running
          ? '<button onclick="efStop(\'' + _esc(run._id) + '\')" style="flex:1;padding:11px;border-radius:9px;background:#3a1414;border:1.5px solid #e5533c;color:#ffb4a6;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">⏹ ' + efL('Stop', 'Detener') + '</button>'
          : '<button onclick="efStart(\'' + _esc(farm) + '\',\'' + _esc(house) + '\')" style="flex:1;padding:11px;border-radius:9px;background:#14361c;border:1.5px solid #4ade80;color:#4ade80;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">▶ ' + efL('Start', 'Iniciar') + '</button>') +
      '</div>' +
    '</div>';
  }

  function _drawLog(host, site) {
    // Site-scope + last 30 days; newest first.
    var list = _efData.filter(function (r) { return site === 'All' || r.farm === site; })
      .slice().sort(function (a, b) { return (b.startTs || b.ts || 0) - (a.startTs || a.ts || 0); });
    var rows = list.map(function (r) {
      var dur = r.status === 'open'
        ? '<span style="color:#4ade80;">● ' + _dur(Date.now() - (r.startTs || Date.now())) + '</span>'
        : (r.minutes != null ? _dur(r.minutes * 60000) : '—');
      var dateLbl = r.date ? r.date.slice(5).replace('-', '/') : '—';
      var dirty = r.dirtyLine ? '<span style="color:#f0d68a;">🥚 ' + efL('ON', 'SÍ') + '</span>' : '<span style="color:#4a6a4a;">—</span>';
      return '<tr style="border-bottom:1px solid #1a2a1a;">' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + dateLbl + '</td>' +
        '<td style="padding:8px 6px;color:#aaa;">H' + _esc(r.house) + '</td>' +
        '<td style="padding:8px 6px;color:#e8d36a;font-weight:700;text-align:center;">' + (r.speed != null && r.speed !== '' ? _esc(r.speed) : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;">' + dirty + '</td>' +
        '<td style="padding:8px 6px;color:#9ad6a0;">' + dur + '</td>' +
        '<td style="padding:8px 6px;color:#7ab07a;">' + _timeLbl(r.startTs) + (r.by ? ' · ' + _esc(r.by) : '') + '</td>' +
      '</tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="6" style="padding:18px;text-align:center;color:#888;">' + efL('No runs logged yet.', 'Sin corridas registradas.') + '</td></tr>';
    return '<div style="' + MONO + 'font-size:10px;color:#4a6a4a;margin:14px 0 6px;">' + efL('speed = the setting you ran · dirty = dirty line on · duration = how long the belts ran', 'velocidad = el ajuste · sucia = línea sucia encendida · duración = cuánto corrieron') + '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;min-width:460px;">' +
      '<thead><tr style="border-bottom:1px solid #2a4a2a;">' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + efL('Date', 'Fecha') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + efL('House', 'Casa') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + efL('Speed', 'Velocidad') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + efL('Dirty line', 'Línea sucia') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + efL('Duration', 'Duración') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + efL('Started', 'Inició') + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function _draw() {
    var host = document.getElementById('prod-sec-eggflow');
    if (!host) return;
    var site = _efSite();
    var houses = _efHouses(site);
    var cards = houses.map(function (h) { return _houseCard(site, h); }).join('') ||
      '<div style="' + MONO + 'font-size:12px;color:#5a7a5a;padding:14px;">' + efL('No active houses for this site.', 'Sin casas activas para este sitio.') + '</div>';
    host.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">' +
        '<span style="' + MONO + 'font-size:13px;font-weight:700;color:#a3d0e8;letter-spacing:1px;">🚿 ' + efL('Egg Flow', 'Flujo de Huevos') + ' · ' + _esc(site) + '</span>' +
        '<span style="' + MONO + 'font-size:9px;color:#4ade80;border:1px solid #2a5a2a;border-radius:20px;padding:2px 8px;">● ' + efL('LIVE', 'EN VIVO') + '</span>' +
      '</div>' +
      '<div style="' + MONO + 'font-size:10px;color:#7a9a7a;margin-bottom:12px;">' + efL('Set the speed, tap Start when the belts run, Stop when done. Times save automatically.', 'Pon la velocidad, toca Iniciar cuando corran las bandas, Detener al terminar. Los tiempos se guardan solos.') + '</div>' +
      '<div style="display:grid;gap:9px;">' + cards + '</div>' +
      _drawLog(host, site);
  }

  // ── Actions ──
  window.efStart = function (farm, house) {
    if (typeof db === 'undefined' || !db) return;
    var idb = (farm + '_' + house).replace(/[^a-zA-Z0-9]/g, '_');
    var sp = document.getElementById('ef-speed-' + idb);
    var speed = sp && sp.value !== '' ? Number(sp.value) : null;
    // Speed is REQUIRED — a run with no setting isn't useful data (Joe 2026-07-20).
    if (speed == null || isNaN(speed)) {
      if (typeof toast === 'function') toast(efL('⚠ Enter the speed first', '⚠ Pon la velocidad primero'));
      if (sp) { try { sp.focus(); sp.style.borderColor = '#e5533c'; } catch (e) {} }
      return;
    }
    var key = farm + '_' + house;
    db.collection('eggFlow').add({ farm: farm, house: String(house), speed: speed, dirtyLine: !!_efDirty[key], startTs: Date.now(), stopTs: null, minutes: null, status: 'open', date: _today(), by: _by(), ts: Date.now() })
      .then(function () { delete _efDirty[key]; if (typeof toast === 'function') toast(efL('▶ Run started', '▶ Corrida iniciada')); })
      .catch(function (e) { console.error('efStart:', e); if (typeof toast === 'function') toast(efL('⚠ Could not start', '⚠ No se pudo iniciar')); });
  };
  window.efToggleDirty = function (farm, house) {
    var open = _openRun(farm, house);
    if (open && typeof db !== 'undefined' && db) {
      db.collection('eggFlow').doc(open._id).update({ dirtyLine: !open.dirtyLine, ts: Date.now() }).catch(function (e) { console.error('efToggleDirty:', e); });
    } else {
      var k = farm + '_' + house; _efDirty[k] = !_efDirty[k]; _draw();
    }
  };
  window.efStop = function (id) {
    if (typeof db === 'undefined' || !db) return;
    var run = _efData.filter(function (r) { return r._id === id; })[0];
    var start = run ? (run.startTs || Date.now()) : Date.now();
    var now = Date.now();
    db.collection('eggFlow').doc(id).update({ stopTs: now, minutes: Math.max(0, Math.round((now - start) / 60000)), status: 'done', ts: now })
      .then(function () { if (typeof toast === 'function') toast(efL('⏹ Run logged', '⏹ Corrida registrada')); })
      .catch(function (e) { console.error('efStop:', e); if (typeof toast === 'function') toast(efL('⚠ Could not stop', '⚠ No se pudo detener')); });
  };
  window.efSetSpeed = function (id, val) {
    if (typeof db === 'undefined' || !db) return;
    db.collection('eggFlow').doc(id).update({ speed: val !== '' ? Number(val) : null, ts: Date.now() }).catch(function (e) { console.error('efSetSpeed:', e); });
  };

  window.renderEggFlow = function () {
    var host = document.getElementById('prod-sec-eggflow');
    if (!host || typeof db === 'undefined' || !db) return;
    if (_efUnsub) { try { _efUnsub(); } catch (e) {} _efUnsub = null; }
    host.innerHTML = '<div style="color:#aaa;' + MONO + 'font-size:12px;padding:12px;">' + efL('Loading egg flow…', 'Cargando flujo…') + '</div>';
    var cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    try {
      _efUnsub = db.collection('eggFlow').where('ts', '>=', cutoff).orderBy('ts', 'desc').onSnapshot(function (snap) {
        _efData = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
        _draw();
      }, function (err) { console.error('eggFlow live:', err); host.innerHTML = '<div style="color:#e53e3e;padding:16px;">' + (err && err.message ? err.message : err) + '</div>'; });
    } catch (e) { console.error('renderEggFlow:', e); }
    // Repaint running timers every 20s.
    if (_efTick) clearInterval(_efTick);
    _efTick = setInterval(function () { if (document.getElementById('prod-sec-eggflow') && document.getElementById('prod-sec-eggflow').offsetParent !== null) _draw(); }, 20000);
  };
})();
