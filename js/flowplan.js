// ═══════════════════════════════════════════════════════════════════════════
// flowplan.js — 🔀 COLLECTOR FLOW PLANNER (v296, per Joe 2026-08-21)
//
// "if we run the house now and we know the eggs by each house and the house has
//  6 collectors can we just turn on 2 collectors to run with house 2 to speed up
//  process" — yes, and this is the tool that says how many and what it yields.
//
// THE IDEA: while one house runs, it only uses part of the line. The spare
// capacity can be filled with collectors from a SECOND house. Because every
// Danville house is an identical 6-collector / 6-row layout and we know eggs per
// house, each collector is a known share of that house's eggs — so a mixed run
// is still fully attributable. No counter hardware needed.
//
// EVERY NUMBER BELOW IS DERIVED FROM LIVE eggFlow + tierExternal DATA — see
// _houseModel(). Nothing is hard-coded except the physical layout (6 collectors)
// and the line capacity, which is itself the best feed rate ever achieved.
//
// ⚠ HONEST LIMITS, stated on screen too:
//   • Line capacity is a FLOOR, not a rating. It is the hardest the line has
//     ever actually been pushed (one house, best day). The packer nameplate
//     could be higher — if you get it, put it in settings/flowPlan.lineMax.
//   • Per-collector minutes assume the 6 collectors SEQUENCE. If they all run
//     together on a fixed traverse, the capacity math holds but the time saving
//     is smaller. Watch one run to confirm.
//   • Danville has no packed-egg count. Eggs here are what the hens laid
//     (farm records), not eggs over the packer.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var COLLECTORS = 6;            // per house, 6 rows each — identical at Danville
  var HIST_DAYS = 45;
  var STUCK_MIN = 480;           // forgotten-stop guard, same as egg-flow.js
  var SAFE_PCT = 0.90;           // green up to here
  var TIGHT_PCT = 1.00;          // amber to here, red above

  function fpL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _fpEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _n(v) { return (v == null || isNaN(v)) ? '—' : Math.round(Number(v)).toLocaleString(); }
  function _mins(m) {
    m = Math.round(Number(m) || 0);
    if (!m) return '—';
    return m < 60 ? (m + 'm') : (Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm');
  }
  function _med(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }); var i = Math.floor(b.length / 2); return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2; }
  function _fpToday() { try { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function _hn(v) { var m = /(\d+)/.exec(String(v == null ? '' : v)); return m ? m[1] : String(v || ''); }

  var _F = null, _site = 'Danville', _sel = {}, _cfg = {};

  function _load() {
    var from = (function () { var d = new Date(_fpToday() + 'T12:00:00'); d.setDate(d.getDate() - HIST_DAYS); return d.toISOString().slice(0, 10); })();
    return Promise.all([
      db.collection('eggFlow').where('date', '>=', from).get(),
      db.collection('tierExternal').get(),
      db.collection('settings').doc('flowPlan').get().catch(function () { return null; })
    ]).then(function (r) {
      var flows = [], ext = {};
      r[0].forEach(function (d) { flows.push(d.data() || {}); });
      r[1].forEach(function (d) { try { ext[d.id] = JSON.parse((d.data() || {}).json || '{}'); } catch (e) {} });
      _cfg = (r[2] && r[2].exists) ? (r[2].data() || {}) : {};
      _F = { flows: flows, ext: ext };
      return _F;
    });
  }

  // ── eggs per house, straight from the farm records ──────────────────────
  function _eggsByHouse(site) {
    var e = _F.ext[site] || {}, out = {};
    (Array.isArray(e.houses) ? e.houses : []).forEach(function (h) {
      var n = _hn(h.name);
      if (!n) return;
      // birds x lay rate = eggs the hens made today. eggsPerDay when present.
      var eggs = (h.eggsPerDay != null && Number(h.eggsPerDay) > 0)
        ? Number(h.eggsPerDay)
        : ((h.birds && h.lay7d) ? Math.round(Number(h.birds) * Number(h.lay7d)) : null);
      if (eggs > 0) out[n] = { eggs: eggs, birds: Number(h.birds) || null, lay: Number(h.lay7d) || null };
    });
    return out;
  }

  // ── measured run time per house at max Hz, else scaled from what they run ─
  function _houseModel(site) {
    var eggs = _eggsByHouse(site);
    var runs = _F.flows.filter(function (f) {
      return f && f.farm === site && f.status === 'done' && f.minutes > 20 && f.minutes <= STUCK_MIN;
    });
    var maxHz = Number(_cfg.maxHz) || 60;
    var model = {};
    Object.keys(eggs).forEach(function (h) {
      var mine = runs.filter(function (f) { return _hn(f.house) === h; });
      var atMax = mine.filter(function (f) { return Number(f.speed) >= maxHz - 2; }).map(function (f) { return f.minutes; });
      var all = mine.map(function (f) { return f.minutes; });
      var t, basis;
      if (atMax.length >= 2) { t = _med(atMax); basis = 'measured'; }
      else if (all.length) {
        // Scale from the speed they actually run. Belt output is not linear with
        // Hz, so damp it — claiming a full linear gain would overpromise.
        var sp = _med(mine.map(function (f) { return Number(f.speed) || maxHz; })) || maxHz;
        t = _med(all) * (1 - (maxHz - sp) / maxHz * 0.7);
        basis = 'estimated';
      } else { t = null; basis = 'no data'; }
      if (!t) return;
      model[h] = {
        house: h, eggs: eggs[h].eggs, birds: eggs[h].birds, lay: eggs[h].lay,
        min: Math.round(t), basis: basis,
        rate: eggs[h].eggs / t,                       // eggs/min whole house
        perColl: eggs[h].eggs / t / COLLECTORS,        // eggs/min per collector
        eggsPerColl: Math.round(eggs[h].eggs / COLLECTORS),
        minPerColl: t / COLLECTORS,                    // if collectors sequence
        runs: mine.length, atMax: atMax.length,
        curMin: all.length ? Math.round(_med(all)) : null,
        curHz: all.length ? Math.round(_med(mine.map(function (f) { return Number(f.speed) || 0; }))) : null
      };
    });
    return model;
  }

  // ── line capacity = the best feed rate ever actually achieved ────────────
  function _lineMax(site, model) {
    if (Number(_cfg.lineMax) > 0) return { rate: Number(_cfg.lineMax), src: 'set by you' };
    var best = 0, who = '';
    var eggs = _eggsByHouse(site);
    _F.flows.forEach(function (f) {
      if (!f || f.farm !== site || f.status !== 'done') return;
      if (!(f.minutes > 20 && f.minutes <= STUCK_MIN)) return;
      var h = _hn(f.house);
      if (!eggs[h]) return;
      var r = eggs[h].eggs / f.minutes;
      if (r > best) { best = r; who = 'H' + h + ' ' + (f.date || ''); }
    });
    return { rate: best, src: best ? ('best run on record · ' + who) : 'unknown' };
  }

  // ── the plan for the current selection ──────────────────────────────────
  function _plan(model, line) {
    var picks = Object.keys(_sel).filter(function (h) { return _sel[h] > 0 && model[h]; });
    if (!picks.length) return null;
    var load = 0, eggs = 0, rows = [];
    picks.forEach(function (h) {
      var n = Math.min(COLLECTORS, _sel[h]);
      var m = model[h];
      load += m.perColl * n;
      eggs += m.eggsPerColl * n;
      rows.push({ house: h, n: n, load: m.perColl * n, eggs: m.eggsPerColl * n, m: m });
    });
    // Wall clock = the longest house's share of its own run, because collectors
    // for different houses run in parallel on the shared line.
    var clock = 0;
    rows.forEach(function (r) { clock = Math.max(clock, r.m.minPerColl * r.n); });
    var pct = line.rate ? load / line.rate : 0;
    // What is left in each house after this run
    var left = rows.map(function (r) {
      var rem = COLLECTORS - r.n;
      return { house: r.house, coll: rem, eggs: r.m.eggsPerColl * rem, min: r.m.minPerColl * rem };
    }).filter(function (x) { return x.coll > 0; });
    var seqAll = picks.reduce(function (a, h) { return a + model[h].min; }, 0);
    var thisRunPlusLeft = clock + left.reduce(function (a, x) { return a + x.min; }, 0);
    return {
      rows: rows, load: load, eggs: eggs, pct: pct, clock: clock, left: left,
      seqAll: seqAll, dayTotal: thisRunPlusLeft, saved: seqAll - thisRunPlusLeft,
      status: pct <= SAFE_PCT ? 'safe' : (pct <= TIGHT_PCT ? 'tight' : 'over')
    };
  }

  // ── best recommendation: fill the line without going over ───────────────
  function _recommend(model, line) {
    var hs = Object.keys(model);
    if (hs.length < 2) return null;
    // anchor = the house with the most eggs (run it whole), then fill with the
    // next house's collectors up to the safe line limit
    var sorted = hs.slice().sort(function (a, b) { return model[b].eggs - model[a].eggs; });
    var best = null;
    sorted.forEach(function (anchor) {
      sorted.forEach(function (fill) {
        if (fill === anchor) return;
        var base = model[anchor].rate;
        for (var n = COLLECTORS; n >= 1; n--) {
          var load = base + model[fill].perColl * n;
          if (line.rate && load <= line.rate * SAFE_PCT) {
            var clock = Math.max(model[anchor].min, model[fill].minPerColl * n);
            var leftMin = model[fill].minPerColl * (COLLECTORS - n);
            var total = clock + leftMin;
            var saved = (model[anchor].min + model[fill].min) - total;
            if (!best || saved > best.saved) {
              best = { anchor: anchor, fill: fill, n: n, load: load, pct: load / line.rate, saved: saved, total: total };
            }
            break;
          }
        }
      });
    });
    return best;
  }

  // ── save a planned run so the eggs are attributed per house ─────────────
  window.fpSaveRun = function () {
    var model = _houseModel(_site), line = _lineMax(_site, model), p = _plan(model, line);
    if (!p) { if (typeof toast === 'function') toast(fpL('Pick collectors first', 'Elige colectores primero')); return; }
    var by = '';
    try { by = (typeof getDeviceUser === 'function' && getDeviceUser()) || ''; } catch (e) {}
    var rec = {
      farm: _site, date: _fpToday(), type: 'collectorRun',
      collectors: p.rows.map(function (r) { return { house: r.house, n: r.n, eggs: Math.round(r.eggs) }; }),
      houses: p.rows.map(function (r) { return r.house; }),
      eggs: Math.round(p.eggs),
      lineLoad: Math.round(p.load), linePct: Math.round(p.pct * 100),
      plannedMin: Math.round(p.clock),
      hz: Number(_cfg.maxHz) || 60,
      by: by, ts: Date.now(),
      appVersion: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : ''
    };
    db.collection('eggFlowPlan').add(rec).then(function () {
      if (typeof toast === 'function') {
        toast('🔀 ' + fpL('Planned run saved — ', 'Corrida guardada — ') + _n(p.eggs) + ' ' + fpL('eggs', 'huevos'));
      }
      window.openFlowPlan();
    }).catch(function (e) {
      console.error('fpSaveRun:', e);
      if (typeof toast === 'function') toast(fpL('Could not save', 'No se pudo guardar'));
    });
  };

  window.fpSet = function (h, n) {
    var cur = Number(_sel[h] || 0);
    _sel[h] = (n === 'up') ? Math.min(COLLECTORS, cur + 1) : (n === 'down' ? Math.max(0, cur - 1) : Number(n) || 0);
    window.openFlowPlan();
  };
  window.fpAll = function (h) { _sel[h] = (Number(_sel[h] || 0) === COLLECTORS) ? 0 : COLLECTORS; window.openFlowPlan(); };
  window.fpUseRec = function () {
    var model = _houseModel(_site), line = _lineMax(_site, model), r = _recommend(model, line);
    if (!r) return;
    _sel = {}; _sel[r.anchor] = COLLECTORS; _sel[r.fill] = r.n;
    window.openFlowPlan();
  };
  window.fpClear = function () { _sel = {}; window.openFlowPlan(); };
  window.fpSite = function (s) { _site = s; _sel = {}; window.openFlowPlan(); };

  function _ov() {
    var o = document.getElementById('fp-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'fp-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:966;background:#0a1410;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeFlowPlan = function () { var o = document.getElementById('fp-overlay'); if (o) o.style.display = 'none'; };

  function _sec(t) { return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#6aa06a;text-transform:uppercase;margin:20px 2px 8px;font-weight:700;">' + t + '</div>'; }
  function _box(inner, border) { return '<div style="background:#0d1a12;border:1.5px solid ' + (border || '#1e3a2a') + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;">' + inner + '</div>'; }
  function _bar(pct, col) {
    return '<div style="height:12px;background:#0a1a0a;border-radius:50px;overflow:hidden;position:relative;">' +
      '<div style="height:100%;width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + col + ';"></div>' +
      '<div style="position:absolute;left:90%;top:0;bottom:0;width:1.5px;background:#f0c674;opacity:.8;"></div></div>';
  }

  window.openFlowPlan = function () {
    var o = _ov();
    o.innerHTML = '<div style="max-width:900px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeFlowPlan()" style="padding:11px 16px;background:#0f1a12;border:1.5px solid #2a5a3a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + fpL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:27px;letter-spacing:2px;line-height:1;color:#e8f5ec;">🔀 ' + fpL('FLOW PLANNER', 'PLAN DE FLUJO') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:2px;">' + fpL('Run two houses together · 6 collectors each', 'Dos casas juntas · 6 colectores cada una') + '</div>' +
        '</div>' +
      '</div>' +
      '<div id="fp-body" style="' + MONO + 'font-size:12px;color:#7ab07a;">' + fpL('Reading the run history…', 'Leyendo el historial…') + '</div>' +
    '</div>';
    o.style.display = 'block';
    try { if (typeof trackUse === 'function') trackUse('flowPlan'); } catch (e) {}

    _load().then(function () {
      var body = document.getElementById('fp-body'); if (!body) return;
      var sites = Object.keys(_F.ext).filter(function (s) {
        var m = _houseModel(s); return Object.keys(m).length >= 2;
      });
      if (!sites.length) { body.innerHTML = fpL('Not enough run history yet.', 'Aún no hay suficiente historial.'); return; }
      if (sites.indexOf(_site) === -1) _site = sites[0];

      var model = _houseModel(_site);
      var line = _lineMax(_site, model);
      var maxHz = Number(_cfg.maxHz) || 60;
      var hs = Object.keys(model).sort(function (a, b) { return model[b].eggs - model[a].eggs; });
      var p = _plan(model, line);
      var rec = _recommend(model, line);
      var html = '';

      if (sites.length > 1) {
        html += '<div style="display:flex;gap:8px;margin-bottom:12px;">' + sites.map(function (s) {
          var on = s === _site;
          return '<button onclick="fpSite(\'' + _fpEsc(s) + '\')" style="flex:1;padding:10px;border-radius:50px;cursor:pointer;' + MONO +
            'font-size:12px;font-weight:700;background:' + (on ? '#14361c' : '#0d1a0d') + ';border:1.5px solid ' + (on ? '#4ade80' : '#2a4a2a') +
            ';color:' + (on ? '#9ad6a0' : '#5a7a5a') + ';">' + (on ? '✓ ' : '') + _fpEsc(s).toUpperCase() + '</button>';
        }).join('') + '</div>';
      }

      // ── the line ──
      html += _sec('🚚 ' + fpL('The line is the constraint', 'La línea es el límite'));
      html += _box(
        '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end;">' +
          '<div><div style="' + MONO + 'font-size:10px;color:#5a8a5a;">' + fpL('LINE CAPACITY', 'CAPACIDAD') + '</div>' +
            '<div style="' + MONO + 'font-size:23px;font-weight:700;color:#e8f5ec;">' + _n(line.rate) + '<span style="font-size:12px;color:#5a8a5a;"> ' + fpL('eggs/min', 'huevos/min') + '</span></div>' +
            '<div style="' + MONO + 'font-size:9.5px;color:#5a8a5a;">' + _n(line.rate * 60) + ' ' + fpL('eggs/hr', 'huevos/hr') + '</div></div>' +
          '<div><div style="' + MONO + 'font-size:10px;color:#5a8a5a;">' + fpL('RUN EVERYTHING AT', 'CORRE TODO A') + '</div>' +
            '<div style="' + MONO + 'font-size:23px;font-weight:700;color:#4ade80;">' + maxHz + ' Hz</div>' +
            '<div style="' + MONO + 'font-size:9.5px;color:#5a8a5a;">' + fpL('max — never throttle', 'máximo — no bajar') + '</div></div>' +
        '</div>' +
        '<div style="' + MONO + 'font-size:9.5px;color:#4a6a4a;margin-top:8px;line-height:1.6;">' +
          fpL('Capacity here is the FLOOR — the hardest the line has ever actually been pushed (' + _fpEsc(line.src) + '). It is not a nameplate rating. Get the packer\'s rated eggs/hour and it can be raised.',
              'La capacidad es un PISO — lo más que la línea ha movido (' + _fpEsc(line.src) + '), no una especificación.') + '</div>');

      // ── per house ──
      html += _sec('🏠 ' + fpL('Each house · ' + COLLECTORS + ' collectors', 'Cada casa · ' + COLLECTORS + ' colectores'));
      html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;min-width:640px;">' +
        '<thead><tr style="border-bottom:1px solid #2a4a2a;color:#5a8a5a;">' +
          '<th style="text-align:left;padding:6px;">' + fpL('House', 'Casa') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + fpL('Eggs/day', 'Huevos/día') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + fpL('Per collector', 'Por colector') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + fpL('Min @ ' + maxHz + 'Hz', 'Min @ ' + maxHz + 'Hz') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + fpL('Feed/min', 'Flujo/min') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + fpL('Now', 'Ahora') + '</th>' +
        '</tr></thead><tbody>';
      hs.forEach(function (h) {
        var m = model[h];
        var est = m.basis !== 'measured';
        html += '<tr style="border-bottom:1px solid #16281a;">' +
          '<td style="padding:6px;color:#e8f5ec;font-weight:700;">H' + _fpEsc(h) +
            (est ? '<span style="' + MONO + 'font-size:9px;color:#f0a35a;"> ⚠est</span>' : '') + '</td>' +
          '<td style="padding:6px;text-align:right;color:#e8c96a;font-weight:700;">' + _n(m.eggs) + '</td>' +
          '<td style="padding:6px;text-align:right;color:#cfe0d0;">' + _n(m.eggsPerColl) + '</td>' +
          '<td style="padding:6px;text-align:right;color:#9ad6a0;font-weight:700;">' + Math.round(m.min) + '</td>' +
          '<td style="padding:6px;text-align:right;color:#cfe0d0;">' + _n(m.rate) + '</td>' +
          '<td style="padding:6px;text-align:right;color:' + (m.curHz && m.curHz < maxHz - 2 ? '#f0a35a' : '#5a8a5a') + ';">' +
            (m.curHz ? (m.curMin + 'm @ ' + m.curHz + 'Hz') : '—') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>' +
        '<div style="' + MONO + 'font-size:9.5px;color:#4a6a4a;margin-top:6px;line-height:1.6;">' +
          fpL('⚠est = that house has not been run at ' + maxHz + 'Hz enough times to measure, so its time is scaled from the speed it does run (damped — belt output is not linear with Hz). Amber in the "Now" column = running below max.',
              '⚠est = falta historial a ' + maxHz + 'Hz; el tiempo es estimado. Ámbar = corriendo bajo el máximo.') + '</div>';

      // ── recommendation ──
      if (rec) {
        html += _sec('⭐ ' + fpL('Best pairing from your own numbers', 'Mejor combinación'));
        html += _box(
          '<div style="' + MONO + 'font-size:13.5px;color:#e8f5ec;font-weight:700;line-height:1.7;">' +
            'H' + rec.anchor + ' ' + fpL('all 6 collectors', 'los 6 colectores') + '  +  H' + rec.fill + ' ' + fpL('with', 'con') + ' <span style="color:#4ade80;">' + rec.n + '</span> ' + fpL('collectors', 'colectores') +
          '</div>' +
          '<div style="' + MONO + 'font-size:11.5px;color:#9ab09a;margin-top:6px;line-height:1.7;">' +
            fpL('line load ', 'carga ') + '<b style="color:#cfe0d0;">' + _n(rec.load) + '/' + _n(line.rate) + ' (' + Math.round(rec.pct * 100) + '%)</b><br>' +
            fpL('saves about ', 'ahorra ~') + '<b style="color:#4ade80;">' + _mins(rec.saved) + '</b>' + fpL(' vs running them back to back', ' vs una tras otra') +
          '</div>' +
          '<button onclick="fpUseRec()" style="width:100%;margin-top:10px;padding:12px;background:#14361c;border:1.5px solid #4ade80;border-radius:10px;color:#9ad6a0;' + MONO + 'font-size:12.5px;font-weight:700;cursor:pointer;">⭐ ' + fpL('Use this plan', 'Usar este plan') + '</button>', '#2a6a3a');
      }

      // ── the picker ──
      html += _sec('🔀 ' + fpL('Build a run', 'Armar una corrida'));
      html += _box(hs.map(function (h) {
        var m = model[h], n = Number(_sel[h] || 0);
        return '<div style="padding:9px 0;border-bottom:1px solid #16281a;">' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
            '<b style="' + MONO + 'font-size:13px;color:#e8f5ec;min-width:44px;">H' + _fpEsc(h) + '</b>' +
            '<span style="' + MONO + 'font-size:10px;color:#5a8a5a;">' + _n(m.eggsPerColl) + fpL('/coll', '/col') + '</span>' +
            '<div style="margin-left:auto;display:flex;align-items:center;gap:6px;">' +
              '<button onclick="fpSet(\'' + h + '\',\'down\')" style="width:36px;height:36px;border-radius:9px;background:#0f1a12;border:1.5px solid #2a5a3a;color:#9ad6a0;' + MONO + 'font-size:17px;font-weight:700;cursor:pointer;">−</button>' +
              '<div style="min-width:58px;text-align:center;' + MONO + 'font-size:17px;font-weight:700;color:' + (n ? '#4ade80' : '#3a5a3a') + ';">' + n + '<span style="font-size:11px;color:#5a8a5a;">/' + COLLECTORS + '</span></div>' +
              '<button onclick="fpSet(\'' + h + '\',\'up\')" style="width:36px;height:36px;border-radius:9px;background:#0f1a12;border:1.5px solid #2a5a3a;color:#9ad6a0;' + MONO + 'font-size:17px;font-weight:700;cursor:pointer;">+</button>' +
              '<button onclick="fpAll(\'' + h + '\')" style="padding:8px 11px;border-radius:9px;background:#0d1f3a;border:1.5px solid #3b82f6;color:#9cc0f6;' + MONO + 'font-size:10.5px;font-weight:700;cursor:pointer;">' + fpL('ALL', 'TODOS') + '</button>' +
            '</div>' +
          '</div></div>';
      }).join('') +
        '<button onclick="fpClear()" style="width:100%;margin-top:10px;padding:9px;background:#161616;border:1.5px solid #3a3a3a;border-radius:9px;color:#aaa;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">' + fpL('Clear', 'Limpiar') + '</button>');

      // ── the result ──
      if (p) {
        var col = p.status === 'safe' ? '#4ade80' : p.status === 'tight' ? '#f0c674' : '#f87171';
        var lbl = p.status === 'safe' ? fpL('SAFE', 'SEGURO') : p.status === 'tight' ? fpL('TIGHT', 'AL LÍMITE') : fpL('OVER CAPACITY', 'SOBRE CAPACIDAD');
        html += _sec('📋 ' + fpL('This run', 'Esta corrida'));
        html += _box(
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;flex-wrap:wrap;">' +
            '<span style="width:13px;height:13px;border-radius:50%;background:' + col + ';box-shadow:0 0 9px ' + col + ';"></span>' +
            '<b style="' + MONO + 'font-size:14px;color:' + col + ';">' + lbl + ' · ' + Math.round(p.pct * 100) + '% ' + fpL('of line', 'de la línea') + '</b>' +
          '</div>' +
          _bar(p.pct * 100, col) +
          '<div style="' + MONO + 'font-size:9px;color:#5a8a5a;margin-top:3px;text-align:right;">' + fpL('yellow mark = 90% safe limit', 'marca amarilla = límite 90%') + '</div>' +
          '<table style="width:100%;' + MONO + 'font-size:12px;color:#cfe0d0;margin-top:10px;"><tbody>' +
            p.rows.map(function (r) {
              return '<tr><td style="padding:3px 0;">H' + r.house + ' × ' + r.n + ' ' + fpL('collectors', 'colectores') + '</td>' +
                '<td style="text-align:right;color:#e8c96a;font-weight:700;">' + _n(r.eggs) + '</td>' +
                '<td style="text-align:right;color:#9ab09a;">' + _n(r.load) + '/min</td></tr>';
            }).join('') +
            '<tr style="border-top:1px dashed #2a4a2a;"><td style="padding:5px 0;font-weight:700;color:#e8f5ec;">' + fpL('TOTAL', 'TOTAL') + '</td>' +
              '<td style="text-align:right;font-weight:700;color:#e8c96a;">' + _n(p.eggs) + '</td>' +
              '<td style="text-align:right;font-weight:700;color:#cfe0d0;">' + _n(p.load) + '/min</td></tr>' +
          '</tbody></table>' +
          '<div style="' + MONO + 'font-size:11.5px;color:#9ab09a;margin-top:9px;line-height:1.8;padding-top:8px;border-top:1px dashed #2a4a2a;">' +
            fpL('Run time ', 'Tiempo ') + '<b style="color:#9ad6a0;">' + _mins(p.clock) + '</b>' +
            (p.left.length ? ('<br>' + fpL('Still to run after: ', 'Falta después: ') +
              p.left.map(function (x) { return 'H' + x.house + ' × ' + x.coll + ' (' + _mins(x.min) + ', ' + _n(x.eggs) + ' ' + fpL('eggs', 'huevos') + ')'; }).join(' · ')) : '') +
            '<br>' + fpL('Whole day this way ', 'Día completo así ') + '<b style="color:#cfe0d0;">' + _mins(p.dayTotal) + '</b>' +
            fpL(' vs ', ' vs ') + _mins(p.seqAll) + fpL(' back to back', ' una tras otra') +
            (p.saved > 0 ? (' → <b style="color:#4ade80;">' + fpL('saves ', 'ahorra ') + _mins(p.saved) + '</b>') : '') +
          '</div>' +
          (p.status === 'over'
            ? ('<div style="' + MONO + 'font-size:11px;color:#f87171;margin-top:9px;line-height:1.6;">⚠ ' +
                fpL('Over what the line has ever moved. Take a collector off — do NOT drop the Hz. Slowing the belt leaves eggs sitting, which is where cracks come from.',
                    'Excede lo que la línea ha movido. Quita un colector — NO bajes los Hz.') + '</div>')
            : '') +
          '<button onclick="fpSaveRun()" style="width:100%;margin-top:11px;padding:14px;background:' + (p.status === 'over' ? '#2a1408' : '#14361c') + ';border:2px solid ' + col + ';border-radius:11px;color:' + col + ';' + MONO + 'font-size:14px;font-weight:700;letter-spacing:1px;cursor:pointer;">✓ ' + fpL('SAVE THIS RUN', 'GUARDAR CORRIDA') + '</button>',
          p.status === 'over' ? '#7f1d1d' : (p.status === 'tight' ? '#5a4a1a' : '#2a6a3a'));
      }

      // ── honest notes ──
      var est = hs.filter(function (h) { return model[h].basis !== 'measured'; });
      html += '<div style="' + MONO + 'font-size:9.5px;color:#4a6a4a;margin-top:14px;line-height:1.7;">' +
        fpL('How this works: every house here is ' + COLLECTORS + ' collectors with 6 rows, all identical, so one collector is exactly 1/' + COLLECTORS + ' of that house\'s eggs. That is why a mixed run is still fully attributable — no egg counter needed, just log which collectors ran. ' +
            'Eggs come from the farm records (what the hens laid), NOT from a packer count — Danville has no packed-egg count yet, so treat these as eggs available, not eggs packed. ' +
            'Per-collector minutes assume the ' + COLLECTORS + ' collectors sequence one after another; if they all run together on a fixed traverse the capacity math still holds but the time saving is smaller — watch one run to confirm. ' +
            (est.length ? ('H' + est.join(', H') + ' have not run at ' + maxHz + 'Hz enough to measure and are estimated. ') : '') +
            'Runs over ' + STUCK_MIN + ' minutes are excluded as forgotten stops.',
            'Cada casa tiene ' + COLLECTORS + ' colectores idénticos, así que un colector = 1/' + COLLECTORS + ' de los huevos de esa casa. Los huevos vienen de los registros de granja, no de un conteo de empaque.') + '</div>';

      // 😄 Joe's request — a rotating dig at the Hegins counters. English only:
      // house jokes are never translated (see feedback_bilingual_required).
      var JOKES = [
        'Accuracy note: this is already more accurate than the Hegins counters, and it does not need a counter card reset.',
        'Fun fact: the math above has never once had to be reset by pulling a counter card at Hegins.',
        'This planner has a 100% agreement rate with itself — a record the Hegins counters are still chasing.',
        'Confidence level: higher than a Hegins counter on a Monday.',
        'No counter cards were harmed, reset, or quietly disbelieved in the making of these numbers.',
        'Certified more trustworthy than the thing at Hegins we reset every day and still do not believe.'
      ];
      html += '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:10px;padding:9px 11px;background:#0d1a12;border-left:2.5px solid #4ade80;border-radius:0 8px 8px 0;line-height:1.6;">🥚 ' +
        JOKES[Math.floor(Date.now() / 86400000) % JOKES.length] + '</div>';

      body.innerHTML = html;
    }).catch(function (e) {
      console.error('flowplan:', e);
      var b = document.getElementById('fp-body'); if (b) b.innerHTML = fpL('Could not load.', 'No se pudo cargar.');
    });
  };
})();
