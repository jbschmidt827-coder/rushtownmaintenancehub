// ═══════════════════════════════════════════════════════════════════════════
// shiftboard.js — 🕐 DANVILLE SHIFT BOARD (v305, per Joe 2026-09-22)
//
// "i will make this our hour by hour board" — the 24-hour Danville plan, hour by
// hour, with the day's ACTUAL pallets pulled straight off the 🥚⏱ Daily Run entry
// (eggDailyRun) the crew already fills in. Nothing is typed twice.
//
// THE PLAN (Joe's numbers):
//   • Barns run 5 → 4 → 3 → 2 → 1 at 152 cases/hr (belts + packer). When the last
//     barn is done: 30-min changeover, then OUTSIDE eggs at 190 cases/hr.
//   • 1st shift 6 AM–4 PM: break 9:30, Tier 1 9:45, lunch 12:00–12:30.
//   • 2nd shift 4 PM–2 AM (10 h, same break pattern: 7:30 / 7:45 / 10:00–10:30).
//     No changeover at 4 PM — 2nd shift picks up the running barn.
//   • Cleaning crew 2–6 AM. 1st shift in at 5:30 for walks + pre-run inspection.
//   • 1 case = 30 dz = 360 eggs. 1 pallet = 30 cases = 10,800 eggs.
//   • Downtime is placed at 10 AM on the board for planning. Rule of thumb:
//     30 min down = −76 cases on 1st shift, barns done 30 min later, −95 cases
//     (≈3 pallets) of outside eggs. The barn eggs always get run.
//
// DATA (all live, all Firestore):
//   eggDailyRun  Danville__M1__<date> {houseEggs:{'1':n,…,'outside':n}, houseEggsTs:{key:ms}, eggs, ts}
//                → pallets in the cooler = eggs / 10,800; per-barn actual vs plan.
//                An entry stamped between midnight and 6 AM belongs to the PREVIOUS
//                plan day (2nd shift ends at 2 AM) — that is what houseEggsTs is for.
//   eggFlow      today's belt runs → which barns are running / done right now.
//   settings/shiftBoard {off:{'3':true}, cases:{'2':238}}   — standing settings.
//   shiftBoard/<date>   {down:1.5}                           — that day's downtime.
//
// ⚠ H2's default is 238 cases (82.9% lay, 7,141 dz off Joe's Tier 2 chart). The
// farm-record feed (tierExternal) showed 110k eggs = lay over 100% on 9/17–9/21
// while H1 read 0 — bad rows, not real eggs. Barn cases are editable on screen.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var FARM = 'Danville';
  var EGGS_CASE = 360, CPP = 30, EGGS_PALLET = EGGS_CASE * CPP;   // 10,800
  var RATE_BARN = 152, RATE_OUT = 190;                              // cases/hr (settings can override)
  var CHANGEOVER = 30;                                              // minutes
  // Barn order and default cases/day. H3 = H4 per Joe ("house 3 will match house 4").
  var BARNS = [ { id: '5', cases: 353 }, { id: '4', cases: 461 }, { id: '3', cases: 461 }, { id: '2', cases: 238 }, { id: '1', cases: 186 } ];
  var DAY0 = 360, DAY1 = 360 + 1440;          // plan day = 6:00 AM → 6:00 AM, in minutes
  var SHIFT1_END = 960, SHIFT2_END = 1560, DOWN_AT = 600, CLEAN_END = 1800;
  var FIXED = [
    [570, 585, 'pause', 'Break', 'Descanso'], [585, 600, 'pause', 'Tier 1', 'Tier 1'], [720, 750, 'pause', 'Lunch', 'Almuerzo'],
    [1170, 1185, 'pause', 'Break', 'Descanso'], [1185, 1200, 'pause', 'Tier 1', 'Tier 1'], [1320, 1350, 'pause', 'Lunch', 'Almuerzo'],
    [1560, 1800, 'clean', 'Cleaning crew', 'Equipo de limpieza']
  ];
  var DOWN_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  var HIST_DAYS = 30;
  var COL = { '5': '#4f93c7', '4': '#3fae8c', '3': '#7f9bd6', '2': '#57bcbc', '1': '#8fb457',
              outside: '#e7a03a', pause: '#3a4753', down: '#e0574c', change: '#a8875a', clean: '#9a7fc9', idle: '#1a2a1a' };

  function sbL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _n(v) { return (v == null || isNaN(v)) ? '—' : Math.round(Number(v)).toLocaleString(); }
  function _p(c) { return (Math.round(c / CPP * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }); }   // cases → pallets
  function _pp(p) { return (Math.round(p * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }); }        // pallets
  function _h(min) { return (Math.round(min / 6) / 10).toFixed(1) + ' h'; }
  function _pad(n) { return (n < 10 ? '0' : '') + n; }
  function _clock(m) { m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'PM' : 'AM'; var hh = h % 12; if (hh === 0) hh = 12; return hh + ':' + _pad(mm) + ' ' + ap; }
  function _hourLbl(m) { var h = Math.floor((m % 1440) / 60), ap = h >= 12 ? 'PM' : 'AM'; var hh = h % 12; if (hh === 0) hh = 12; return hh + ' ' + ap; }
  function _ldate(d) { return (typeof LDATE === 'function') ? LDATE(d) : (d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate())); }
  // The plan day rolls at 6 AM, not midnight: 1:30 AM still belongs to yesterday's board.
  function _dayKey(ts) { return _ldate(new Date((ts || Date.now()) - 6 * 3600000)); }
  function _dayStart(key) { var p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 6, 0, 0, 0).getTime(); }
  function _planMin(key) { return 360 + (Date.now() - _dayStart(key)) / 60000; }
  function _dayLabel(key) { var p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(sbL('en-US', 'es'), { weekday: 'long', month: 'short', day: 'numeric' }); }
  function _shortDay(key) { var p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(sbL('en-US', 'es'), { weekday: 'short', month: 'numeric', day: 'numeric' }); }
  function _time(ts) { try { return new Date(Number(ts)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function _by() { try { return (typeof getDeviceUser === 'function' && getDeviceUser()) || ''; } catch (e) { return ''; } }
  function _clone(o) { return JSON.parse(JSON.stringify(o)); }
  function _fixedAt(t) { for (var i = 0; i < FIXED.length; i++) { if (t >= FIXED[i][0] && t < FIXED[i][1]) return FIXED[i]; } return null; }

  // ── state ────────────────────────────────────────────────────────────────
  var _cfg = { off: {}, cases: {} };      // settings/shiftBoard
  var _dayDocs = {};                       // shiftBoard/<date> → {down}
  var _runs = [];                          // eggDailyRun docs (all farms, ~35 days) — filtered to Danville
  var _flows = [];                         // eggFlow docs (~3 days)
  var _subs = [], _daySub = null, _key = _dayKey(), _open = false, _ticker = null, _editCases = false, _cfgLoaded = false;

  function _rateBarn() { var r = Number(_cfg.rateBarn); return r > 0 ? r : RATE_BARN; }
  function _rateOut() { var r = Number(_cfg.rateOutside); return r > 0 ? r : RATE_OUT; }
  function _casesOf(b, cases) { var c = cases && Number(cases[b.id]); return c > 0 ? c : b.cases; }
  function _barns(off, cases) { return BARNS.filter(function (b) { return !(off || {})[b.id]; }).map(function (b) { return { id: b.id, cases: _casesOf(b, cases) }; }); }
  function _downFor(key) { var d = _dayDocs[key]; var n = d ? Number(d.down) : NaN; return isNaN(n) ? 0 : n; }

  // ── the plan: minute-by-minute simulation of one 24-hour day ────────────
  function _simulate(downHrs, off, cases) {
    var H = _barns(off, cases), r1 = _rateBarn() / 60, r2 = _rateOut() / 60;
    var segs = [], downLeft = Math.round((downHrs || 0) * 60), hi = 0, left = H.length ? H[0].cases : 0, change = CHANGEOVER;
    var out = { barns: H, shift1: 0, shift2barn: 0, outside: 0, byBarn: {}, minutes: { barn: 0, outside: 0, change: 0, down: 0, pause: 0, clean: 0, idle: 0 }, barnsDone: H.length ? null : DAY0, barnDone: {} };
    H.forEach(function (b) { out.byBarn[b.id] = { shift1: 0, shift2: 0 }; });
    function push(t, type, lbl, cases) {
      var last = segs[segs.length - 1];
      if (last && last.type === type && last.lbl === lbl && last.end === t) { last.end = t + 1; last.cases += cases; }
      else segs.push({ start: t, end: t + 1, type: type, lbl: lbl, cases: cases });
    }
    for (var t = DAY0; t < DAY1; t++) {
      var f = _fixedAt(t);
      if (f) { push(t, f[2], sbL(f[3], f[4]), 0); out.minutes[f[2]]++; continue; }
      if (t >= DOWN_AT && downLeft > 0) { downLeft--; push(t, 'down', sbL('Downtime', 'Paro'), 0); out.minutes.down++; continue; }
      if (hi < H.length) {
        var id = H[hi].id, sh = (t < SHIFT1_END) ? 'shift1' : 'shift2', rem = r1;
        while (rem > 0 && hi < H.length) {
          var take = Math.min(rem, left); left -= take; rem -= take;
          out.byBarn[H[hi].id][sh] += take;
          if (left <= 0.0001) { out.barnDone[H[hi].id] = t + 1; hi++; if (hi < H.length) left = H[hi].cases; else out.barnsDone = t + 1; }
        }
        var c = r1 - rem;
        if (sh === 'shift1') out.shift1 += c; else out.shift2barn += c;
        push(t, id, 'H' + id, c); out.minutes.barn++; continue;
      }
      if (change > 0) { change--; push(t, 'change', sbL('Changeover', 'Cambio'), 0); out.minutes.change++; continue; }
      if (t < SHIFT2_END) { push(t, 'outside', sbL('Outside eggs', 'Huevos externos'), r2); out.outside += r2; out.minutes.outside++; continue; }
      push(t, 'idle', '', 0); out.minutes.idle++;
    }
    out.segs = segs; out.barn = out.shift1 + out.shift2barn; out.day = out.barn + out.outside;
    return out;
  }
  function _planBy(sim, t) {            // cases the plan expects by minute t
    var b = 0, o = 0;
    for (var i = 0; i < sim.segs.length; i++) {
      var s = sim.segs[i]; if (s.cases <= 0) continue;
      var e = Math.min(s.end, t); if (e <= s.start) break;
      var c = s.cases * (e - s.start) / (s.end - s.start);
      if (s.type === 'outside') o += c; else b += c;
    }
    return { barn: b, outside: o, total: b + o };
  }
  function _beltAfter(sim, t) {          // planned belt minutes still ahead
    var m = 0; sim.segs.forEach(function (s) { if (s.cases <= 0) return; var a = Math.max(s.start, t); if (s.end > a) m += s.end - a; }); return m;
  }
  function _sim(key) { return _simulate(_downFor(key), _cfg.off, _cfg.cases); }

  // ── actuals off the Daily Run entry ──────────────────────────────────────
  // Each house box is attributed to a PLAN day by the moment it was typed
  // (houseEggsTs). Older docs without stamps fall back to the doc's calendar date.
  function _actual(key) {
    var out = { eggs: 0, byBarn: {}, outside: 0, entries: 0, last: 0, docs: 0 };
    _runs.forEach(function (r) {
      if (!r || r.farm !== FARM) return;
      var he = r.houseEggs || {}, hts = r.houseEggsTs || {};
      var keys = Object.keys(he);
      if (!keys.length && Number(r.eggs) > 0) {           // machine total only, no house split
        if (r.date === key) { out.eggs += Number(r.eggs); out.docs++; out.entries++; out.last = Math.max(out.last, Number(r.ts) || 0); }
        return;
      }
      var hit = false;
      keys.forEach(function (k) {
        var n = Number(he[k]) || 0; if (n <= 0) return;
        var ts = Number(hts[k]) || 0;
        var day = ts ? _dayKey(ts) : r.date;
        if (day !== key) return;
        hit = true; out.eggs += n; out.entries++; out.last = Math.max(out.last, ts || Number(r.ts) || 0);
        if (k === 'outside') out.outside += n; else out.byBarn[k] = (out.byBarn[k] || 0) + n;
      });
      if (hit) out.docs++;
    });
    out.cases = out.eggs / EGGS_CASE; out.pallets = out.eggs / EGGS_PALLET;
    return out;
  }
  // Belt runs for the plan day, straight off Egg Flow.
  function _belts(key) {
    var lo = _dayStart(key), hi = lo + 86400000, out = {};
    _flows.forEach(function (f) {
      if (!f || f.farm !== FARM) return;
      var st = Number(f.startTs) || 0; if (st < lo || st >= hi) return;
      var h = String(f.house || ''); if (!h) return;
      var running = f.status !== 'done' && !f.stopTs;
      var min = running ? Math.round((Date.now() - st) / 60000) : (Number(f.minutes) || 0);
      var cur = out[h] || { min: 0, running: false, by: '' };
      cur.min += min; cur.running = cur.running || running; cur.by = f.by || cur.by;
      out[h] = cur;
    });
    return out;
  }

  // ── Firestore ────────────────────────────────────────────────────────────
  function _listen() {
    if (_subs.length) return;
    var cutoff = Date.now() - (HIST_DAYS + 5) * 86400000;
    try {
      _subs.push(db.collection('settings').doc('shiftBoard').onSnapshot(function (s) {
        var d = s.exists ? (s.data() || {}) : {};
        _cfg = { off: d.off || {}, cases: d.cases || {}, rateBarn: d.rateBarn, rateOutside: d.rateOutside };
        _cfgLoaded = true; _render();
      }, function (e) { console.error('shiftBoard settings:', e); }));
      // Same-field where + orderBy (ts) — no composite index needed. Farm filtered client-side.
      _subs.push(db.collection('eggDailyRun').where('ts', '>=', cutoff).orderBy('ts', 'desc').onSnapshot(function (snap) {
        var a = []; snap.forEach(function (d) { a.push(d.data() || {}); }); _runs = a; _render();
      }, function (e) { console.error('shiftBoard eggDailyRun:', e); }));
      _subs.push(db.collection('eggFlow').where('ts', '>=', Date.now() - 3 * 86400000).orderBy('ts', 'desc').onSnapshot(function (snap) {
        var a = []; snap.forEach(function (d) { a.push(d.data() || {}); }); _flows = a; _render();
      }, function (e) { console.error('shiftBoard eggFlow:', e); }));
      _subs.push(db.collection('shiftBoard').where('ts', '>=', cutoff).orderBy('ts', 'desc').onSnapshot(function (snap) {
        var m = {}; snap.forEach(function (d) { var x = d.data() || {}; if (x.date && m[x.date] == null) m[x.date] = x; }); _dayDocs = m; _render();
      }, function (e) { console.error('shiftBoard days:', e); }));
    } catch (e) { console.error('shiftBoard listen:', e); }
  }
  function _saveDay(patch) {
    var key = _key, cur = _dayDocs[key] || {};
    var rec = Object.assign({ farm: FARM, date: key }, cur, patch, { by: _by(), ts: Date.now(), appVersion: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '' });
    _dayDocs[key] = rec; _render();
    return db.collection('shiftBoard').doc(key).set(rec, { merge: true }).then(function () {
      if (typeof toast === 'function') toast('🕐 ' + sbL('Saved', 'Guardado'), { ok: true });
    }).catch(function (e) { console.error('shiftBoard save day:', e); if (typeof toast === 'function') toast(sbL('Could not save', 'No se pudo guardar')); });
  }
  function _saveCfg(patch) {
    Object.assign(_cfg, patch); _render();
    var rec = Object.assign({}, patch, { by: _by(), ts: Date.now() });
    return db.collection('settings').doc('shiftBoard').set(rec, { merge: true }).then(function () {
      if (typeof toast === 'function') toast('🕐 ' + sbL('Setting saved', 'Ajuste guardado'), { ok: true });
    }).catch(function (e) { console.error('shiftBoard save cfg:', e); if (typeof toast === 'function') toast(sbL('Could not save', 'No se pudo guardar')); });
  }

  // ── actions ──────────────────────────────────────────────────────────────
  window.sbDown = function (h) { _saveDay({ down: Number(h) || 0 }); };
  window.sbToggleBarn = function (id) {
    var off = _clone(_cfg.off || {}); if (off[id]) delete off[id]; else off[id] = true;
    _saveCfg({ off: off });
  };
  window.sbEditCases = function () { _editCases = !_editCases; _render(); };
  window.sbSaveCases = function () {
    var cases = {};
    BARNS.forEach(function (b) { var el = document.getElementById('sb-cs-' + b.id); var v = el ? parseInt(el.value, 10) : NaN; if (v > 0 && v !== b.cases) cases[b.id] = v; });
    _editCases = false; _saveCfg({ cases: cases });
  };

  // ── rendering ────────────────────────────────────────────────────────────
  function _ov() {
    var o = document.getElementById('sb-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'sb-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:966;background:#0a1410;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeShiftBoard = function () {
    var o = document.getElementById('sb-overlay'); if (o) o.style.display = 'none';
    _open = false; if (_ticker) { clearInterval(_ticker); _ticker = null; }
  };
  function _sec(t) { return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#6aa06a;text-transform:uppercase;margin:20px 2px 8px;font-weight:700;">' + t + '</div>'; }
  function _box(inner, border) { return '<div style="background:#0d1a12;border:1.5px solid ' + (border || '#1e3a2a') + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;">' + inner + '</div>'; }
  function _tile(eyebrow, big, small, col) {
    return '<div style="flex:1 1 150px;background:#0d1a12;border:1.5px solid #1e3a2a;border-top:3px solid ' + (col || '#1e3a2a') + ';border-radius:12px;padding:10px 12px;min-width:0;">' +
      '<div style="' + MONO + 'font-size:9.5px;letter-spacing:1.2px;color:#6aa06a;text-transform:uppercase;">' + eyebrow + '</div>' +
      '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:30px;letter-spacing:1px;line-height:1.05;color:' + (col && col !== '#1e3a2a' ? col : '#e8f5ec') + ';margin:3px 0 2px;">' + big + '</div>' +
      '<div style="' + MONO + 'font-size:10.5px;color:#7ab07a;line-height:1.5;">' + small + '</div></div>';
  }
  function _chip(label, on, onclick, col) {
    return '<button onclick="' + onclick + '" style="padding:8px 12px;border-radius:50px;cursor:pointer;' + MONO + 'font-size:12px;font-weight:700;background:' + (on ? (col || '#14361c') : '#0d1a0d') +
      ';border:1.5px solid ' + (on ? (col ? col : '#4ade80') : '#2a4a2a') + ';color:' + (on ? '#e8f5ec' : '#5a7a5a') + ';">' + label + '</button>';
  }
  function _meter(label, val, max, col) {
    var pct = max > 0 ? Math.min(100, val / max * 100) : 0;
    return '<div style="flex:1 1 220px;min-width:0;">' +
      '<div style="' + MONO + 'font-size:11px;color:#9ab09a;margin-bottom:4px;">' + label + '</div>' +
      '<div style="height:9px;background:#0a1a0a;border-radius:50px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + col + ';"></div></div></div>';
  }

  function _render() {
    if (!_open) return;
    var body = document.getElementById('sb-body'); if (!body) return;
    var key = _key, sim = _sim(key), act = _actual(key), belts = _belts(key), down = _downFor(key);
    var now = _planMin(key), inDay = now >= DAY0 && now < DAY1;
    var targetP = sim.day / CPP, gotP = act.pallets, remain = targetP - gotP;
    var planNow = _planBy(sim, inDay ? now : DAY1), planP = planNow.total / CPP, diff = gotP - planP;
    var beltMin = inDay ? _beltAfter(sim, now) : 0;
    var need = (remain > 0 && beltMin > 0) ? (remain * CPP) / (beltMin / 60) : null;
    var barnTot = sim.barn;
    var html = '';

    // ── settings: downtime today + barns running ──
    html += _sec('⚙ ' + sbL('Today', 'Hoy') + ' · ' + _dayLabel(key));
    html += _box(
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<span style="' + MONO + 'font-size:12px;color:#d6b36a;font-weight:700;min-width:130px;">⏸ ' + sbL('Downtime today', 'Paro de hoy') + '</span>' +
        DOWN_STEPS.map(function (d) { return _chip(d === 0 ? sbL('None', 'Nada') : d + ' h', d === down, 'sbDown(' + d + ')', d === 0 ? null : '#7f1d1d'); }).join('') +
      '</div>' +
      '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:6px;">' + sbL('Every 30 min down = barns done 30 min later, 3 fewer pallets of outside eggs. The barn eggs always get run.', 'Cada 30 min de paro = casas terminan 30 min más tarde, 3 pallets menos de huevos externos.') + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
        '<span style="' + MONO + 'font-size:12px;color:#9cc0f6;font-weight:700;min-width:130px;">🏠 ' + sbL('Barns running', 'Casas activas') + '</span>' +
        BARNS.map(function (b) { var on = !(_cfg.off || {})[b.id]; return _chip('H' + b.id + ' <span style="opacity:.75;font-weight:500;">' + (on ? _casesOf(b, _cfg.cases) + ' cs' : 'OFF') + '</span>', on, 'sbToggleBarn(\'' + b.id + '\')', COL[b.id]); }).join('') +
        _chip(_editCases ? sbL('Done', 'Listo') : '✎ ' + sbL('Edit cases/day', 'Editar cajas/día'), false, 'sbEditCases()') +
      '</div>' +
      (_editCases
        ? ('<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px;padding-top:10px;border-top:1px dashed #2a5a2a;">' +
            BARNS.map(function (b) { return '<label style="' + MONO + 'font-size:10px;color:#9cc0f6;">H' + b.id + ' ' + sbL('cases/day', 'cajas/día') + '<br><input id="sb-cs-' + b.id + '" type="number" min="0" inputmode="numeric" value="' + _casesOf(b, _cfg.cases) + '" style="width:92px;background:#0a1408;border:1.5px solid #5a4a2a;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:16px;font-weight:700;padding:8px 10px;color-scheme:dark;"></label>'; }).join('') +
            '<button onclick="sbSaveCases()" style="padding:11px 16px;background:#14361c;border:2px solid #4ade80;border-radius:11px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">✓ ' + sbL('Save cases', 'Guardar') + '</button>' +
            '<div style="flex-basis:100%;' + MONO + 'font-size:10px;color:#5a8a5a;">' + sbL('1 case = 30 dz = 360 eggs · dozens ÷ 30 = cases. Blank or 0 goes back to the default.', '1 caja = 30 dz = 360 huevos. Vacío o 0 vuelve al valor por defecto.') + '</div>' +
          '</div>')
        : ('<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:6px;">' + sim.barns.length + ' ' + sbL('barns', 'casas') + ' · ' + _n(barnTot) + ' ' + sbL('cases', 'cajas') + ' / ' + _p(barnTot) + ' ' + sbL('pallets', 'pallets') + ' · ' + _h(barnTot / _rateBarn() * 60) + ' ' + sbL('of belts at', 'de bandas a') + ' ' + _rateBarn() + ' ' + sbL('cases/hr', 'cajas/hr') + '</div>'))
    );

    // ── tracker: pallets in the cooler vs the plan ──
    var vsCol = !inDay ? '#1e3a2a' : (diff >= -1 ? '#4ade80' : '#f87171');
    var vsTxt = !inDay ? (now < DAY0 ? sbL('not started', 'no iniciado') : sbL('day closed', 'día cerrado')) : (diff >= 0 ? '+' + _pp(diff) + ' ' + sbL('ahead', 'adelante') : _pp(diff) + ' ' + sbL('behind', 'atrás'));
    html += _sec('📦 ' + sbL('Pallets in the cooler · from the Daily Run entry', 'Pallets en el cuarto frío · de la entrada diaria'));
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
      _tile(sbL('Target today', 'Meta de hoy'), _pp(targetP) + ' <span style="font-size:18px;">' + sbL('pallets', 'pallets') + '</span>', _n(sim.day) + ' ' + sbL('cases', 'cajas') + ' · ' + sbL('barn', 'casas') + ' ' + _p(sim.barn) + ' + ' + sbL('outside', 'ext.') + ' ' + _p(sim.outside)) +
      _tile(sbL('In the cooler', 'En el cuarto frío'), _pp(gotP) + ' <span style="font-size:18px;">' + sbL('pallets', 'pallets') + '</span>', _n(act.eggs) + ' ' + sbL('eggs entered', 'huevos ingresados') + (act.last ? ' · ' + sbL('last', 'último') + ' ' + _time(act.last) : ''), '#9ad6a0') +
      _tile(remain >= 0 ? sbL('Still to build', 'Falta construir') : sbL('Over target', 'Sobre la meta'), _pp(Math.abs(remain)) + ' <span style="font-size:18px;">' + sbL('pallets', 'pallets') + '</span>', need != null ? sbL('need ', 'requiere ') + Math.round(need) + ' ' + sbL('cases/hr over the', 'cajas/hr en las') + ' ' + _h(beltMin) + ' ' + sbL('of belts left', 'de bandas restantes') : (remain <= 0 ? sbL('target met', 'meta cumplida') : '—'), remain <= 0 ? '#4ade80' : '#d6b36a') +
      _tile(sbL('Vs plan right now', 'Vs plan ahora'), vsTxt, inDay ? sbL('plan says ', 'el plan dice ') + _pp(planP) + ' ' + sbL('by', 'a las') + ' ' + _clock(Math.floor(now)) : '—', vsCol) +
    '</div>';
    var pct = targetP > 0 ? Math.min(100, gotP / targetP * 100) : 0, mp = (inDay && targetP > 0) ? Math.min(100, planP / targetP * 100) : null;
    html += _box(
      '<div style="height:16px;background:#0a1a0a;border-radius:50px;overflow:hidden;position:relative;">' +
        '<div style="height:100%;width:' + pct + '%;background:' + (gotP > targetP ? COL.outside : '#3fae8c') + ';"></div>' +
        (mp != null ? '<div title="' + sbL('plan now', 'plan ahora') + '" style="position:absolute;left:' + mp + '%;top:0;bottom:0;width:2px;background:#f0c674;"></div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;">' +
        _meter(sbL('Barn eggs', 'Huevos de casas') + ' · <b style="color:#e8f5ec;">' + _p((act.eggs - act.outside) / EGGS_CASE) + '</b> ' + sbL('of', 'de') + ' ' + _p(sim.barn) + ' ' + sbL('pallets', 'pallets'), act.eggs - act.outside, sim.barn * EGGS_CASE, '#3fae8c') +
        _meter(sbL('Outside eggs', 'Huevos externos') + ' · <b style="color:#e8f5ec;">' + _p(act.outside / EGGS_CASE) + '</b> ' + sbL('of', 'de') + ' ' + _p(sim.outside) + ' ' + sbL('pallets', 'pallets'), act.outside, sim.outside * EGGS_CASE, COL.outside) +
      '</div>' +
      '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:10px;line-height:1.6;">' +
        (act.entries ? (act.entries + ' ' + sbL('house boxes entered on the 🥚⏱ Daily Run today.', 'casillas ingresadas hoy en 🥚⏱ Corrida Diaria.')) : sbL('Nothing entered on the 🥚⏱ Daily Run yet today — the pallets here come straight from those house boxes (eggs ÷ 10,800 = pallets).', 'Aún no hay entradas en 🥚⏱ Corrida Diaria — los pallets salen de esas casillas (huevos ÷ 10,800).')) +
        ' ' + sbL('Entries typed between midnight and 6 AM count for the day that just ended.', 'Lo ingresado entre medianoche y 6 AM cuenta para el día que terminó.') +
      '</div>'
    );

    // ── per barn: plan vs actual + belts ──
    html += _sec('🏠 ' + sbL('By barn · plan vs entered', 'Por casa · plan vs ingresado'));
    var rows = sim.barns.map(function (b) {
      var a = act.byBarn[b.id] || 0, bl = belts[b.id], doneAt = sim.barnDone[b.id];
      var aC = a / EGGS_CASE, pctB = b.cases > 0 ? Math.min(100, aC / b.cases * 100) : 0;
      var status = bl ? (bl.running ? '<span style="color:#4ade80;font-weight:700;">● ' + sbL('belts on', 'bandas') + ' ' + bl.min + 'm</span>' : '<span style="color:#7ab07a;">✓ ' + sbL('ran', 'corrió') + ' ' + bl.min + 'm</span>') : '<span style="color:#3a5a3a;">— ' + sbL('no run logged', 'sin corrida') + '</span>';
      return '<tr style="border-top:1px solid #1e3a2a;">' +
        '<td style="padding:7px 6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + COL[b.id] + ';margin-right:6px;vertical-align:-1px;"></span><b style="color:#e8f5ec;">H' + b.id + '</b></td>' +
        '<td style="padding:7px 6px;text-align:right;color:#9ab09a;">' + _n(b.cases) + ' <span style="color:#5a8a5a;">/ ' + _p(b.cases) + '</span></td>' +
        '<td style="padding:7px 6px;text-align:right;color:#9ab09a;">' + (doneAt ? _clock(doneAt) : '—') + '</td>' +
        '<td style="padding:7px 6px;text-align:right;color:' + (a > 0 ? '#e8f5ec' : '#3a5a3a') + ';font-weight:700;">' + (a > 0 ? _n(aC) + ' <span style="color:#7ab07a;font-weight:400;">/ ' + _p(aC) + '</span>' : '—') + '</td>' +
        '<td style="padding:7px 6px;min-width:90px;"><div style="height:8px;background:#0a1a0a;border-radius:50px;overflow:hidden;"><div style="height:100%;width:' + pctB + '%;background:' + COL[b.id] + ';"></div></div></td>' +
        '<td style="padding:7px 6px;' + MONO + 'font-size:11px;">' + status + '</td>' +
      '</tr>';
    }).join('');
    var offB = BARNS.filter(function (b) { return (_cfg.off || {})[b.id]; });
    html += _box('<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;">' +
      '<tr style="color:#5a8a5a;font-size:10px;letter-spacing:1px;text-transform:uppercase;"><th style="text-align:left;padding:4px 6px;">' + sbL('Barn', 'Casa') + '</th><th style="text-align:right;padding:4px 6px;">' + sbL('Plan cs / pal', 'Plan cj / pal') + '</th><th style="text-align:right;padding:4px 6px;">' + sbL('Done by', 'Termina') + '</th><th style="text-align:right;padding:4px 6px;">' + sbL('Entered cs / pal', 'Ingresado cj / pal') + '</th><th></th><th style="text-align:left;padding:4px 6px;">' + sbL('Belts', 'Bandas') + '</th></tr>' +
      rows +
      '<tr style="border-top:1px solid #1e3a2a;">' +
        '<td style="padding:7px 6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + COL.outside + ';margin-right:6px;vertical-align:-1px;"></span><b style="color:#e8f5ec;">' + sbL('Outside eggs', 'Huevos ext.') + '</b></td>' +
        '<td style="padding:7px 6px;text-align:right;color:#9ab09a;">' + _n(sim.outside) + ' <span style="color:#5a8a5a;">/ ' + _p(sim.outside) + '</span></td>' +
        '<td style="padding:7px 6px;text-align:right;color:#9ab09a;">' + (sim.minutes.outside ? _clock(SHIFT2_END) : '—') + '</td>' +
        '<td style="padding:7px 6px;text-align:right;color:' + (act.outside > 0 ? '#e8f5ec' : '#3a5a3a') + ';font-weight:700;">' + (act.outside > 0 ? _n(act.outside / EGGS_CASE) + ' <span style="color:#7ab07a;font-weight:400;">/ ' + _p(act.outside / EGGS_CASE) + '</span>' : '—') + '</td>' +
        '<td style="padding:7px 6px;"><div style="height:8px;background:#0a1a0a;border-radius:50px;overflow:hidden;"><div style="height:100%;width:' + (sim.outside > 0 ? Math.min(100, act.outside / EGGS_CASE / sim.outside * 100) : 0) + '%;background:' + COL.outside + ';"></div></div></td>' +
        '<td style="padding:7px 6px;' + MONO + 'font-size:11px;color:#5a8a5a;">' + (sim.barnsDone != null ? sbL('after', 'después de') + ' ' + _clock(sim.barnsDone + CHANGEOVER) : '—') + '</td>' +
      '</tr>' +
      '</table></div>' +
      (offB.length ? '<div style="' + MONO + 'font-size:10px;color:#d6b36a;margin-top:8px;">' + sbL('Closed out:', 'Cerradas:') + ' H' + offB.map(function (b) { return b.id; }).join(', H') + ' — ' + sbL('that belt time goes to outside eggs.', 'ese tiempo pasa a huevos externos.') + '</div>' : '')
    );

    // ── plan tiles ──
    var base = _simulate(0, _cfg.off, _cfg.cases);
    var doneCol = sim.barnsDone == null ? '#f87171' : (sim.barnsDone <= 1200 ? '#4ade80' : (sim.barnsDone <= 1320 ? '#d6b36a' : '#f87171'));
    html += _sec('🎯 ' + sbL('Plan for the day', 'Plan del día'));
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
      _tile(sbL('1st shift · 6 AM–4 PM', '1er turno · 6 AM–4 PM'), _n(sim.shift1) + ' <span style="font-size:18px;">' + sbL('cases', 'cajas') + '</span>', _p(sim.shift1) + ' ' + sbL('pallets', 'pallets') + ' · ' + _stops(sim)) +
      _tile(sbL('Barns done', 'Casas listas'), sim.barnsDone == null ? sbL('not today', 'hoy no') : _clock(sim.barnsDone), sbL('target', 'meta') + ' ' + _clock(base.barnsDone) + ' · ' + _n(sim.barn) + ' ' + sbL('cases', 'cajas') + ' / ' + _p(sim.barn) + ' ' + sbL('pallets', 'pallets'), doneCol) +
      _tile(sbL('2nd shift · barn eggs', '2º turno · casas'), _n(sim.shift2barn) + ' <span style="font-size:18px;">' + sbL('cases', 'cajas') + '</span>', _p(sim.shift2barn) + ' ' + sbL('pallets at', 'pallets a') + ' ' + _rateBarn() + '/hr') +
      _tile(sbL('2nd shift · outside eggs', '2º turno · externos'), _n(sim.outside) + ' <span style="font-size:18px;">' + sbL('cases', 'cajas') + '</span>', _p(sim.outside) + ' ' + sbL('pallets', 'pallets') + ' · ' + _h(sim.minutes.outside) + ' ' + sbL('at', 'a') + ' ' + _rateOut() + '/hr', COL.outside) +
      _tile(sbL('Day total', 'Total del día'), _n(sim.day) + ' <span style="font-size:18px;">' + sbL('cases', 'cajas') + '</span>', _p(sim.day) + ' ' + sbL('pallets', 'pallets')) +
    '</div>';

    // ── hour by hour ──
    html += _sec('🕐 ' + sbL('The day, hour by hour', 'El día, hora por hora'));
    var nowHour = Math.floor(now / 60) * 60, board = '';
    for (var h = DAY0; h < DAY1; h += 60) {
      var cases = 0, parts = '', labels = [];
      for (var i = 0; i < sim.segs.length; i++) {
        var s = sim.segs[i], a = Math.max(s.start, h), b = Math.min(s.end, h + 60); if (b <= a) continue;
        var frac = (b - a) / 60, lbl = s.lbl; if (s.type === 'clean' && h === 1740) lbl = sbL('Cleaning · 1st shift in 5:30', 'Limpieza · 1er turno 5:30');
        var bg = COL[s.type] || COL.idle, fg = (s.type === 'outside' || s.type === 'change') ? '#1a1206' : (s.type === 'pause' ? '#d8e0e7' : (s.type === 'idle' ? '#3a5a3a' : '#fff'));
        var striped = (s.type === 'down' || s.type === 'change') ? 'background:repeating-linear-gradient(135deg,' + bg + ' 0 8px,rgba(0,0,0,.35) 8px 12px);' : 'background:' + bg + ';';
        parts += '<div title="' + _esc(lbl) + ' ' + _clock(a) + '–' + _clock(b) + '" style="flex:0 0 ' + (frac * 100).toFixed(2) + '%;' + striped + 'color:' + fg + ';display:flex;align-items:center;padding:0 ' + (frac < 0.2 ? 0 : 7) + 'px;font-size:' + (frac < 0.2 ? 0 : 11) + 'px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">' + _esc(lbl) + '</div>';
        if (s.cases > 0) cases += s.cases * (b - a) / (s.end - s.start);
        if (lbl && labels.indexOf(lbl) < 0) labels.push(lbl);
      }
      var who = h < SHIFT1_END ? sbL('1st', '1º') : (h < SHIFT2_END ? sbL('2nd', '2º') : (h < CLEAN_END ? sbL('Clean', 'Limp.') : ''));
      var isNow = inDay && h === nowHour, isShift = (h === DAY0 || h === SHIFT1_END || h === SHIFT2_END);
      board += '<div style="display:grid;grid-template-columns:58px 1fr 105px;gap:8px;align-items:center;padding:4px 4px;border-top:' + (isShift ? '2px solid #4a7a5a' : '1px solid #1a2e1e') + ';' + (isNow ? 'background:rgba(240,198,116,.12);border-radius:6px;' : '') + '">' +
        '<div style="' + MONO + 'font-size:13px;font-weight:700;color:' + (isNow ? '#f0c674' : '#9ab09a') + ';line-height:1.1;"><span style="display:block;font-size:9px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;">' + who + '</span>' + _hourLbl(h) + '</div>' +
        '<div style="display:flex;height:30px;border-radius:5px;overflow:hidden;background:' + COL.idle + ';' + MONO + '">' + parts + '</div>' +
        '<div style="text-align:right;' + MONO + 'font-size:11px;color:#7ab07a;">' + (cases > 0.5 ? '<b style="color:#e8f5ec;font-size:14px;">' + Math.round(cases) + '</b> ' + sbL('cs', 'cj') + ' · ' + _p(cases) + ' pal' : _esc(labels.join(' · ') || '—')) + '</div>' +
      '</div>';
    }
    var legend = [['5', 'H5'], ['4', 'H4'], ['3', 'H3'], ['2', 'H2'], ['1', 'H1'], ['outside', sbL('Outside eggs', 'Huevos ext.')], ['change', sbL('Changeover', 'Cambio')], ['down', sbL('Downtime', 'Paro')], ['pause', sbL('Break · Tier 1 · Lunch', 'Descanso · Tier 1 · Almuerzo')], ['clean', sbL('Cleaning crew', 'Limpieza')]];
    html += _box(board + '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;' + MONO + 'font-size:10.5px;color:#9ab09a;">' +
      legend.map(function (l) { return '<span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:' + COL[l[0]] + ';vertical-align:-1px;margin-right:5px;"></i>' + l[1] + '</span>'; }).join('') + '</div>');

    // ── where the hours go + targets by downtime ──
    var m = sim.minutes;
    function trow(lbl, min, cs) { return '<tr style="border-top:1px solid #1e3a2a;"><td style="padding:6px;color:#9ab09a;">' + lbl + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + (min / 60).toFixed(1) + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + (cs != null ? _n(cs) : '') + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + (cs != null ? _p(cs) : '') + '</td></tr>'; }
    var th = 'style="padding:4px 6px;text-align:right;color:#5a8a5a;font-size:10px;letter-spacing:1px;text-transform:uppercase;"';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;">' +
      '<div>' + _sec('⏳ ' + sbL('Where the 24 hours go', 'A dónde van las 24 horas')) + _box('<table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;">' +
        '<tr><th ' + th.replace('right', 'left') + '>' + sbL('Block', 'Bloque') + '</th><th ' + th + '>' + sbL('Hours', 'Horas') + '</th><th ' + th + '>' + sbL('Cases', 'Cajas') + '</th><th ' + th + '>' + sbL('Pallets', 'Pallets') + '</th></tr>' +
        trow(sbL('Barn eggs @ ', 'Huevos de casas @ ') + _rateBarn(), m.barn, sim.barn) + trow(sbL('Outside eggs @ ', 'Huevos externos @ ') + _rateOut(), m.outside, sim.outside) +
        trow(sbL('Changeover', 'Cambio'), m.change) + trow(sbL('Downtime', 'Paro'), m.down) + trow(sbL('Breaks · Tier 1 · lunches', 'Descansos · Tier 1 · almuerzos'), m.pause) + trow(sbL('Cleaning crew', 'Limpieza'), m.clean) + (m.idle ? trow(sbL('Not running', 'Sin correr'), m.idle) : '') +
        '<tr style="border-top:2px solid #4a7a5a;font-weight:700;"><td style="padding:6px;color:#e8f5ec;">' + sbL('Total', 'Total') + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;">24.0</td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + _n(sim.day) + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + _p(sim.day) + '</td></tr></table>') + '</div>' +
      '<div>' + _sec('📉 ' + sbL('Targets by downtime', 'Metas según el paro')) + _box('<table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;">' +
        '<tr><th ' + th.replace('right', 'left') + '>' + sbL('Down', 'Paro') + '</th><th ' + th + '>' + sbL('1st shift', '1er turno') + '</th><th ' + th + '>' + sbL('Barns done', 'Casas') + '</th><th ' + th + '>' + sbL('Outside', 'Ext.') + '</th><th ' + th + '>' + sbL('Day pal', 'Pal día') + '</th></tr>' +
        DOWN_STEPS.map(function (d) {
          var x = _simulate(d, _cfg.off, _cfg.cases), sel = d === down;
          return '<tr style="border-top:1px solid #1e3a2a;' + (sel ? 'background:rgba(240,198,116,.12);font-weight:700;' : '') + '"><td style="padding:6px;color:#e8f5ec;">' + (d === 0 ? sbL('None', 'Nada') : d + ' h') + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + _n(x.shift1) + ' <span style="color:#5a8a5a;">/ ' + _p(x.shift1) + '</span></td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + (x.barnsDone == null ? '—' : _clock(x.barnsDone)) + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + _n(x.outside) + ' <span style="color:#5a8a5a;">/ ' + _p(x.outside) + '</span></td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + _p(x.day) + '</td></tr>';
        }).join('') + '</table>' +
        '<div style="' + MONO + 'font-size:10px;color:#d6b36a;margin-top:8px;line-height:1.6;">' + sbL('Rule of thumb: 30 min of 1st-shift downtime = −76 cases on 1st shift, barns done 30 min later, −95 cases (≈3 pallets) of outside eggs.', 'Regla: 30 min de paro en 1er turno = −76 cajas, casas 30 min más tarde, −95 cajas (≈3 pallets) de huevos externos.') + '</div>') + '</div>' +
    '</div>';

    // ── history ──
    html += _sec('📅 ' + sbL('Last 30 days · entered vs target', 'Últimos 30 días · ingresado vs meta'));
    var days = {}, k;
    _runs.forEach(function (r) {
      if (!r || r.farm !== FARM) return;
      var he = r.houseEggs || {}, hts = r.houseEggsTs || {}, keys = Object.keys(he);
      if (!keys.length) { if (r.date && Number(r.eggs) > 0) days[r.date] = true; return; }
      keys.forEach(function (kk) { if (Number(he[kk]) > 0) { var ts = Number(hts[kk]) || 0; days[ts ? _dayKey(ts) : r.date] = true; } });
    });
    for (k in _dayDocs) if (_dayDocs[k] && Number(_dayDocs[k].down) > 0) days[k] = true;
    days[key] = true;
    var list = Object.keys(days).sort().reverse().slice(0, HIST_DAYS), sumT = 0, sumG = 0;
    html += _box('<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;">' +
      '<tr><th ' + th.replace('right', 'left') + '>' + sbL('Day', 'Día') + '</th><th ' + th + '>' + sbL('Down', 'Paro') + '</th><th ' + th + '>' + sbL('Eggs', 'Huevos') + '</th><th ' + th + '>' + sbL('Pallets', 'Pallets') + '</th><th ' + th + '>' + sbL('Target', 'Meta') + '</th><th ' + th + '>' + sbL('Diff', 'Dif.') + '</th></tr>' +
      list.map(function (d) {
        var a = _actual(d), x = _sim(d), t = x.day / CPP, g = a.pallets, df = g - t, dn = _downFor(d), isT = d === key;
        sumT += t; sumG += g;
        return '<tr style="border-top:1px solid #1e3a2a;' + (isT ? 'background:rgba(240,198,116,.12);' : '') + '"><td style="padding:6px;color:#e8f5ec;">' + _shortDay(d) + (isT ? ' <span style="color:#5a8a5a;">(' + sbL('today', 'hoy') + ')</span>' : '') + '</td><td style="padding:6px;text-align:right;color:#9ab09a;">' + (dn ? dn + ' h' : '—') + '</td><td style="padding:6px;text-align:right;color:#9ab09a;">' + (a.eggs ? _n(a.eggs) : '—') + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;font-weight:700;">' + _pp(g) + '</td><td style="padding:6px;text-align:right;color:#9ab09a;">' + _pp(t) + '</td><td style="padding:6px;text-align:right;font-weight:700;color:' + (df >= -0.05 ? '#4ade80' : '#f87171') + ';">' + (df >= 0 ? '+' : '') + _pp(df) + '</td></tr>';
      }).join('') +
      (list.length > 1 ? '<tr style="border-top:2px solid #4a7a5a;font-weight:700;"><td style="padding:6px;color:#e8f5ec;">' + list.length + ' ' + sbL('days', 'días') + '</td><td></td><td></td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + _pp(sumG) + '</td><td style="padding:6px;text-align:right;color:#e8f5ec;">' + _pp(sumT) + '</td><td style="padding:6px;text-align:right;color:' + (sumG - sumT >= 0 ? '#4ade80' : '#f87171') + ';">' + (sumG - sumT >= 0 ? '+' : '') + _pp(sumG - sumT) + '</td></tr>' : '') +
      '</table></div>' +
      '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:8px;">' + sbL('Pallets = eggs entered on the Daily Run ÷ 10,800. Target uses that day\'s downtime and today\'s barn settings. Only days with an entry or a downtime are listed.', 'Pallets = huevos ingresados ÷ 10,800. La meta usa el paro de ese día y la configuración actual de casas.') + '</div>');

    // ── honest notes ──
    html += '<div style="' + MONO + 'font-size:9.5px;color:#4a6a4a;margin-top:14px;line-height:1.7;">' +
      sbL('How this works: barns run 5 → 4 → 3 → 2 → 1 at ' + _rateBarn() + ' cases/hr; when the last barn is done there is a ' + CHANGEOVER + '-min changeover and then outside eggs at ' + _rateOut() + ' cases/hr until 2 AM. 1st shift 6 AM–4 PM, 2nd shift 4 PM–2 AM (same breaks), cleaning crew 2–6 AM, 1st shift in at 5:30. 1 case = 30 dz = 360 eggs; 1 pallet = 30 cases = 10,800 eggs. Default barn cases: H5 353 · H4 461 · H3 461 (set equal to H4) · H2 238 (82.9% lay, 7,141 dz) · H1 186. Crew belt logs average ~166 cases/hr, so ' + _rateBarn() + ' is a safe target, not a stretch. Downtime sits at 10 AM on the board for planning; where it actually lands changes the picture, not the totals.',
          'Las casas corren 5 → 4 → 3 → 2 → 1 a ' + _rateBarn() + ' cajas/hr; al terminar la última hay un cambio de ' + CHANGEOVER + ' min y luego huevos externos a ' + _rateOut() + ' cajas/hr hasta las 2 AM. 1 caja = 30 dz = 360 huevos; 1 pallet = 30 cajas = 10,800 huevos.') +
    '</div>';

    body.innerHTML = html;
  }
  function _stops(sim) {
    for (var i = 0; i < sim.barns.length; i++) { var b = sim.barns[i], s1 = sim.byBarn[b.id].shift1; if (s1 < b.cases - 0.5) return s1 < 0.5 ? sbL('stops before H', 'para antes de H') + b.id : sbL('stops at H', 'para en H') + b.id + ', ' + Math.round(s1) + ' ' + sbL('of', 'de') + ' ' + b.cases; }
    return sbL('all barns done', 'todas las casas listas');
  }

  window.openShiftBoard = function () {
    var o = _ov();
    _key = _dayKey(); _open = true;
    o.innerHTML = '<div style="max-width:1000px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeShiftBoard()" style="padding:11px 16px;background:#0f1a12;border:1.5px solid #2a5a3a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + sbL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:27px;letter-spacing:2px;line-height:1;color:#e8f5ec;">🕐 ' + sbL('DANVILLE SHIFT BOARD', 'TABLERO DE TURNOS DANVILLE') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:2px;">' + sbL('24 hours, hour by hour · pallets live off the Daily Run · day runs 6 AM → 6 AM', '24 horas · pallets en vivo de la Corrida Diaria · el día va de 6 AM a 6 AM') + '</div>' +
        '</div>' +
      '</div>' +
      '<div id="sb-body" style="' + MONO + 'font-size:12px;color:#7ab07a;">' + sbL('Loading…', 'Cargando…') + '</div>' +
    '</div>';
    o.style.display = 'block';
    try { if (typeof trackUse === 'function') trackUse('shiftBoard'); } catch (e) {}
    _listen(); _render();
    // Wall tablets never reload: tick every minute for the "now" marker and the 6 AM day change.
    if (_ticker) clearInterval(_ticker);
    _ticker = setInterval(function () { if (!_open) return; var k = _dayKey(); if (k !== _key) { _key = k; _editCases = false; } _render(); }, 60000);
  };
})();
