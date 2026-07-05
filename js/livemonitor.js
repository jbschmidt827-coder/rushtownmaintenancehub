// ═══════════════════════════════════════════════════════════════════════════
// livemonitor.js — LIVE Daily-Check monitoring board (EN/ES)
// A real-time overlay: every house per site with Morning Walk / Daily Check /
// Manure status, WHO is working each in-progress check right now (name + live
// dot + %), and a top summary. Self-contained — arms its own onSnapshot
// listeners on today's morningWalks / barnWalks / manureSubmit / bwProgress and
// re-renders live; a 30s tick decays the "active now" indicator. Skips down
// houses. Reached from a 🔴 Live button on the location home.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var FARM_HOUSES   = { Hegins: 8, Danville: 5 };
  var MANURE_HOUSES = { Hegins: [4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
  var LIVE_MS = 6 * 60000;   // "active now" window

  var _lmUnsub = [];
  var _lmTick = null;
  var _mw = {}, _bw = {}, _mn = {}, _prog = {};   // today's live state, keyed farm-house

  function _lmLang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
  function L(en, es) { return _lmLang() === 'es' ? es : en; }
  function _today() { return new Date().toISOString().slice(0, 10); }
  function _first(name) { return name ? String(name).split(' ')[0] : ''; }
  function _down(farm, h) { return (typeof isHouseDown === 'function') && isHouseDown(farm, h); }

  function _lmFarms() {
    var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
    if (f === 'Hegins' || f === 'Danville') return [f];
    if (!f) return ['Hegins', 'Danville'];   // Master
    return [];   // Processing etc. — no barn checks
  }

  // ── Live listeners ─────────────────────────────────────────────────────────
  function _lmArm() {
    if (_lmUnsub.length || typeof db === 'undefined' || !db) return;
    var today = _today();
    var flagsStatus = function (w) { return (w.flags && w.flags.length > 0) ? 'issue' : 'done'; };
    try {
      _lmUnsub.push(db.collection('morningWalks').where('date', '==', today).onSnapshot(function (s) {
        _mw = {}; s.forEach(function (d) { var w = d.data(); _mw[w.farm + '-' + w.house] = flagsStatus(w); }); _lmKick();
      }, function () {}));
      _lmUnsub.push(db.collection('barnWalks').where('date', '==', today).onSnapshot(function (s) {
        _bw = {}; s.forEach(function (d) { var w = d.data(); _bw[w.farm + '-' + w.house] = flagsStatus(w); }); _lmKick();
      }, function () {}));
      _lmUnsub.push(db.collection('manureSubmit').where('date', '==', today).onSnapshot(function (s) {
        _mn = {}; s.forEach(function (d) { var w = d.data(); _mn[w.farm + '-' + w.house] = true; }); _lmKick();
      }, function () {}));
      _lmUnsub.push(db.collection('bwProgress').where('date', '==', today).onSnapshot(function (s) {
        _prog = {}; s.forEach(function (d) { var w = d.data(); _prog[w.farm + '-' + w.house] = { pct: w.pct || 0, by: w.by || '', ts: w.ts || 0, blocks: w.blocks || [] }; }); _lmKick();
      }, function () {}));
    } catch (e) { console.error('livemonitor arm:', e); }
  }
  function _lmDisarm() { _lmUnsub.forEach(function (u) { try { u(); } catch (e) {} }); _lmUnsub = []; }
  function _lmKick() { var ov = document.getElementById('livemonitor-overlay'); if (ov && ov.style.display !== 'none') renderLiveMonitor(); }

  // ── Status pill ──────────────────────────────────────────────────────────
  function _pill(icon, status, extra) {
    var map = {
      done:    { c: '#4ade80', bg: '#0d2a12', bd: '#2a7a3a', t: '✓' },
      issue:   { c: '#f87171', bg: '#2a0f0f', bd: '#7a2a2a', t: '⚠' },
      prog:    { c: '#f2c14e', bg: '#241d05', bd: '#7a5a1a', t: (extra || '') },
      pending: { c: '#5a7a5a', bg: '#0f1a0f', bd: '#274a27', t: '—' },
      na:      { c: '#3a4a3a', bg: '#0c140c', bd: '#1a2a1a', t: '·' }
    };
    var m = map[status] || map.pending;
    return '<div style="flex:1;min-width:0;background:' + m.bg + ';border:1px solid ' + m.bd + ';border-radius:9px;padding:7px 4px;text-align:center;">' +
      '<div style="font-size:12px;line-height:1;">' + icon + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;color:' + m.c + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + m.t + '</div>' +
    '</div>';
  }

  function _dcCell(key) {
    if (_bw[key]) return _pill('✅', _bw[key]);
    var p = _prog[key];
    if (p && p.pct > 0) {
      var live = p.ts && (Date.now() - p.ts < LIVE_MS);
      var who = _first(p.by);
      var label = p.pct + '%' + (who ? ' ' + (live ? '● ' : '') + who : '');
      return _pill('✅', 'prog', label);
    }
    return _pill('✅', 'pending');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderLiveMonitor() {
    var ov = document.getElementById('livemonitor-overlay');
    if (!ov) return;
    var farms = _lmFarms();
    var dateStr = new Date().toLocaleDateString(_lmLang() === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    var body = '';
    if (!farms.length) {
      body = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;color:#7a9a7a;text-align:center;padding:40px 16px;">' + L('Pick <b>Hegins</b>, <b>Danville</b>, or <b>Master</b> to monitor barn checks.', 'Elige <b>Hegins</b>, <b>Danville</b> o <b>Master</b> para monitorear los chequeos.') + '</div>';
    } else {
      farms.forEach(function (farm) {
        var n = FARM_HOUSES[farm] || 0;
        var houses = [];
        for (var h = 1; h <= n; h++) { if (!_down(farm, h)) houses.push(h); }
        var doneC = 0, progC = 0, workers = {};
        houses.forEach(function (h) {
          var k = farm + '-' + h;
          if (_bw[k]) doneC++;
          else if (_prog[k] && _prog[k].pct > 0) { progC++; if (_prog[k].by && _prog[k].ts && (Date.now() - _prog[k].ts < LIVE_MS)) workers[_first(_prog[k].by)] = 1; }
        });
        var pctDone = houses.length ? Math.round(doneC / houses.length * 100) : 0;
        var activeNames = Object.keys(workers);

        body += '<div style="margin:16px 0 8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;">' +
            '<span style="font-family:\'Bebas Neue\',sans-serif;font-size:22px;letter-spacing:1.5px;color:#e8f5ec;">' + (farms.length > 1 ? '📍 ' : '') + farm + '</span>' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;color:' + (pctDone === 100 ? '#4ade80' : '#f2c14e') + ';">' + doneC + '/' + houses.length + ' ' + L('done', 'listas') + ' · ' + pctDone + '%</span>' +
          '</div>' +
          (activeNames.length
            ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#4ade80;margin-top:4px;">🟢 ' + L('working now', 'trabajando ahora') + ': ' + activeNames.join(', ') + '</div>'
            : (progC ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#b0a05a;margin-top:4px;">⏳ ' + progC + ' ' + L('in progress', 'en progreso') + '</div>' : '')) +
        '</div>';

        // Column header
        body += '<div style="display:flex;gap:6px;align-items:center;margin:6px 0 4px;padding:0 2px;">' +
          '<span style="width:52px;flex:0 0 auto;"></span>' +
          '<span style="flex:1;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:1px;color:#5a7a5a;text-transform:uppercase;">' + L('Morning', 'Mañana') + '</span>' +
          '<span style="flex:1;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:1px;color:#5a7a5a;text-transform:uppercase;">' + L('Daily Check', 'Chequeo') + '</span>' +
          '<span style="flex:1;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:1px;color:#5a7a5a;text-transform:uppercase;">' + L('Manure', 'Estiércol') + '</span>' +
        '</div>';

        houses.forEach(function (h) {
          var k = farm + '-' + h;
          var mwCell = _mw[k] ? _pill('☀️', _mw[k]) : _pill('☀️', 'pending');
          var mnApplies = (MANURE_HOUSES[farm] || []).indexOf(h) !== -1;
          var mnCell = mnApplies ? (_mn[k] ? _pill('💩', 'done') : _pill('💩', 'pending')) : _pill('💩', 'na');
          body += '<div style="display:flex;gap:6px;align-items:stretch;margin-bottom:6px;" onclick="if(typeof openBarnWalk===\'function\'){closeLiveMonitor();openBarnWalk(\'' + farm + '\',' + h + ');}" >' +
            '<div style="width:52px;flex:0 0 auto;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#0f1f0f;border:1px solid #274a27;border-radius:9px;cursor:pointer;">' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#5a8a5a;letter-spacing:1px;">' + L('BARN', 'GALP') + '</div>' +
              '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:18px;font-weight:700;color:#e8f5ec;line-height:1;">' + h + '</div>' +
            '</div>' +
            mwCell + _dcCell(k) + mnCell +
          '</div>';
        });
      });
    }

    ov.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:calc(env(safe-area-inset-top, 0px) + 26px) 14px 40px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">' +
          '<button onclick="closeLiveMonitor()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">← ' + L('Back', 'Atrás') + '</button>' +
          '<div style="text-align:right;">' +
            '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:2px;line-height:1;color:#f0ead8;"><span style="color:#f87171;">●</span> ' + L('LIVE CHECKS', 'EN VIVO') + '</div>' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#7ab07a;margin-top:3px;">' + dateStr + ' · ' + L('auto-refreshing', 'actualiza solo') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#7a9a7a;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:9px;padding:8px 11px;margin:8px 0 6px;line-height:1.5;">' + L('Live status of every house. 🟢 = someone working it now. Tap a barn to open its check.', 'Estado en vivo de cada casa. 🟢 = alguien trabajando ahora. Toca una casa para abrir su chequeo.') + '</div>' +
        body +
      '</div>';
  }

  // ── Open / close ─────────────────────────────────────────────────────────
  function openLiveMonitor() {
    var ov = document.getElementById('livemonitor-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'livemonitor-overlay';
      ov.className = 'overlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:950;background:#0a140a;overflow-y:auto;-webkit-overflow-scrolling:touch;';
      document.body.appendChild(ov);
    }
    ov.style.display = 'block';
    _lmArm();
    renderLiveMonitor();
    if (!_lmTick) _lmTick = setInterval(function () { _lmKick(); }, 30000);   // decay "active now"
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function closeLiveMonitor() {
    var ov = document.getElementById('livemonitor-overlay');
    if (ov) ov.style.display = 'none';
    if (_lmTick) { clearInterval(_lmTick); _lmTick = null; }
    _lmDisarm();
  }

  if (typeof window !== 'undefined') {
    window.openLiveMonitor = openLiveMonitor;
    window.closeLiveMonitor = closeLiveMonitor;
    window.renderLiveMonitor = renderLiveMonitor;
  }
})();
