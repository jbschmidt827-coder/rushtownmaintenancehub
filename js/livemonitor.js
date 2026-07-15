// ═══════════════════════════════════════════════════════════════════════════
// livemonitor.js — LIVE daily-work monitoring board (EN/ES)
// A real-time overlay. TOP: an "all daily work today" summary strip (Morning
// walks / Daily checks / Manure / PMs done / Egg run, with run time + eggs per
// plant). BELOW: every house per site with Morning Walk / Daily Check / Manure
// status + WHO is working each in-progress check right now (name + live dot + %).
// Self-contained — arms its own onSnapshot listeners on today's morningWalks /
// barnWalks / manureSubmit / bwProgress (by date) + pmCompletions / eggDailyRun
// (by ts >= local midnight) and re-renders live; a 30s tick decays the "active
// now" indicator. Skips down houses. Reached from the 🔴 Live button on home.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var FARM_HOUSES   = { Hegins: 8, Danville: 5 };
  var MANURE_HOUSES = { Hegins: [4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
  var LIVE_MS = 6 * 60000;   // "active now" window

  var _lmUnsub = [];
  var _lmTick = null;
  var _mw = {}, _bw = {}, _mn = {}, _prog = {};   // today's live state, keyed farm-house
  var _pm = [], _erDocs = [];                      // today's PM completions + egg-run docs
  var EGGRUN_M = { Hegins: [1, 2], Danville: [1] };

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
      // PMs + egg run are dated by timestamp (their date fields are display strings),
      // so query on ts >= local midnight to catch everything done today.
      var midnight = new Date(); midnight.setHours(0, 0, 0, 0); var todayMs = midnight.getTime();
      _lmUnsub.push(db.collection('pmCompletions').where('ts', '>=', todayMs).onSnapshot(function (s) {
        _pm = []; s.forEach(function (d) { _pm.push(d.data()); }); _lmKick();
      }, function () {}));
      _lmUnsub.push(db.collection('eggDailyRun').where('ts', '>=', todayMs).onSnapshot(function (s) {
        _erDocs = []; s.forEach(function (d) { _erDocs.push(d.data()); }); _lmKick();
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

  // ── "All daily work" summary strip ──────────────────────────────────────────
  function _fmtMin(min) { var m = Math.round(min), h = Math.floor(m / 60), mm = m % 60; return h + 'h ' + (mm < 10 ? '0' : '') + mm + 'm'; }
  function _erAgg(farm) {
    var min = 0, eggs = 0, has = false;
    _erDocs.filter(function (d) { return d.farm === farm; }).forEach(function (d) {
      if (d.manualMin != null && Number(d.manualMin) > 0) { min += Number(d.manualMin); has = true; }
      else if (Array.isArray(d.runs)) { d.runs.forEach(function (r) { if (r.s && r.e) { min += (r.e - r.s) / 60000; has = true; } }); }
      if (d.eggs != null) { eggs += Number(d.eggs) || 0; has = true; }
    });
    return { min: min, eggs: eggs, has: has };
  }
  function _tile(icon, label, val, color) {
    return '<div style="flex:1;min-width:80px;background:#0f1f0f;border:1px solid #274a27;border-radius:10px;padding:9px 8px;text-align:center;">' +
      '<div style="font-size:15px;line-height:1;">' + icon + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:700;color:' + (color || '#e8f5ec') + ';margin-top:4px;">' + val + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;letter-spacing:.5px;color:#5a7a5a;text-transform:uppercase;margin-top:2px;">' + label + '</div>' +
    '</div>';
  }
  function _lmSummary(farms) {
    var barnFarms = farms.length ? farms.filter(function (f) { return f === 'Hegins' || f === 'Danville'; }) : ['Hegins', 'Danville'];
    var mwDone = 0, dcDone = 0, mnDone = 0, mwTot = 0, dcTot = 0, mnTot = 0;
    barnFarms.forEach(function (farm) {
      var n = FARM_HOUSES[farm] || 0;
      for (var h = 1; h <= n; h++) {
        if (_down(farm, h)) continue;
        var k = farm + '-' + h;
        mwTot++; dcTot++;
        if (_mw[k]) mwDone++;
        if (_bw[k]) dcDone++;
        if ((MANURE_HOUSES[farm] || []).indexOf(h) !== -1) { mnTot++; if (_mn[k]) mnDone++; }
      }
    });
    var pmCount = _pm.length;
    // Egg run: which plants have entered today
    var erPlants = Object.keys(EGGRUN_M).map(function (f) { return { farm: f, agg: _erAgg(f) }; }).filter(function (x) { return x.agg.has; });
    var erVal = erPlants.length ? (erPlants.length + '/' + Object.keys(EGGRUN_M).length) : '0/' + Object.keys(EGGRUN_M).length;
    var pctC = function (d, t) { return t ? Math.round(d / t * 100) : 0; };
    var col = function (d, t) { return (t && d >= t) ? '#4ade80' : '#f2c14e'; };

    var tiles =
      _tile('☀️', L('Morning', 'Mañana'), mwDone + '/' + mwTot, col(mwDone, mwTot)) +
      _tile('✅', L('Daily Check', 'Chequeo'), dcDone + '/' + dcTot, col(dcDone, dcTot)) +
      _tile('💩', L('Manure', 'Estiércol'), mnDone + '/' + mnTot, col(mnDone, mnTot)) +
      _tile('🔧', L('PMs today', 'PM hoy'), String(pmCount), pmCount ? '#4ade80' : '#5a7a5a') +
      _tile('🥚', L('Egg run', 'Huevos'), erVal, erPlants.length ? '#4ade80' : '#5a7a5a');

    // Egg-run detail line (run time + eggs per plant that has data)
    var erLine = erPlants.map(function (x) {
      return x.farm + ': ⏱ ' + _fmtMin(x.agg.min) + ' · 🥚 ' + (x.agg.eggs ? x.agg.eggs.toLocaleString() : '—');
    }).join('  ·  ');

    return '<div style="margin:10px 0 6px;">' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:1px;color:#7ab07a;text-transform:uppercase;margin-bottom:6px;">' + L('All daily work — today', 'Todo el trabajo de hoy') + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + tiles + '</div>' +
      (erLine ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ad6a0;margin-top:6px;">' + erLine + '</div>' : '') +
    '</div>';
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderLiveMonitor() {
    var ov = document.getElementById('livemonitor-overlay');
    if (!ov) return;
    var farms = _lmFarms();
    var dateStr = new Date().toLocaleDateString(_lmLang() === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Always show the "all daily work" summary strip at the top.
    var body = _lmSummary(farms);
    if (!farms.length) {
      body += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#7a9a7a;text-align:center;padding:26px 16px;">' + L('Pick <b>Hegins</b>, <b>Danville</b>, or <b>Master</b> to also see the per-house barn grid.', 'Elige <b>Hegins</b>, <b>Danville</b> o <b>Master</b> para ver también la cuadrícula por casa.') + '</div>';
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
            '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:2px;line-height:1;color:#f0ead8;"><span style="color:#f87171;">●</span> ' + L('LIVE BOARD', 'EN VIVO') + '</div>' +
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
