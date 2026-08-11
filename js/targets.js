// ═══════════════════════════════════════════════════════════════════════════
// targets.js — 🎯 SITE TARGETS & ATTAINMENT (v286, per Joe 2026-08-11)
//
// "Do NOT use one company-wide production target for every site."
// Every site gets its own profile built from ITS OWN history, then three target
// levels (Minimum / Standard / Stretch), a company roll-up, recovery math when a
// site falls behind, and attainment history that drives targets UP over time.
//
// NOTHING IS HARD-CODED. Every number is calculated from live data:
//   • eggDailyRun  — Hegins packer machines (clocks, eggs, caseWt, downtime)
//   • eggFlow      — Danville house belts / Hegins groups (minutes, stops, off)
//   • tierExternal — farm records: eggs PRODUCED per house per day
//   • laborPunch   — labor hours where recorded (honest "—" when missing)
// Management may OVERRIDE any target; the calculated recommendation is always
// preserved next to it (settings/siteTargets).
//
// The seven questions every site must answer are printed on its card:
//   what do we need · how long should it take · what have we made · ahead or
//   behind · what rate are we running · where do we finish · how do we recover
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var EGGS_PER_CASE = 360;
  var SITES = ['Hegins', 'Danville'];
  var HIST_DAYS = 56;                 // 8 weeks of history for baselines
  var BASE_DAYS = 28;                 // baseline window (recent capability)

  function tgL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _n(v) { return (v == null || isNaN(v)) ? '—' : Math.round(Number(v)).toLocaleString(); }
  function _n1(v) { return (v == null || isNaN(v)) ? '—' : (Math.round(Number(v) * 10) / 10).toLocaleString(); }
  function _hrs(h) { return (h == null || isNaN(h)) ? '—' : (Math.floor(h) + 'h ' + String(Math.round((h % 1) * 60)).padStart(2, '0') + 'm'); }
  function _dstr(o) { return new Date(Date.now() - o * 86400000).toISOString().slice(0, 10); }
  function _today() { try { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function _me() { try { return (typeof getDeviceUser === 'function') ? String(getDeviceUser() || '') : ''; } catch (e) { return ''; } }
  function _canEdit() {
    try {
      var s = (typeof staffList !== 'undefined' ? staffList : []).find(function (x) {
        return x && String(x.name || '').toLowerCase() === _me().toLowerCase();
      });
      if (!s) return true;                                  // fail-open (unknown = allow)
      return s.role === 'Director' || s.role === 'Lead';
    } catch (e) { return true; }
  }
  // stats helpers
  function _med(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
  function _pct(a, p) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }); var i = Math.min(b.length - 1, Math.max(0, Math.round((p / 100) * (b.length - 1)))); return b[i]; }
  function _avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function _clock(c) { var m = /^(\d{1,2}):(\d{2})/.exec(String(c || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; }

  // ── DATA ────────────────────────────────────────────────────────────────
  var _D = null, _cfg = null;
  function _load() {
    var dFrom = _dstr(HIST_DAYS), tFrom = Date.now() - HIST_DAYS * 86400000;
    return Promise.all([
      db.collection('eggDailyRun').where('date', '>=', dFrom).get(),
      db.collection('eggFlow').where('date', '>=', dFrom).get(),
      db.collection('tierExternal').get(),
      db.collection('laborPunch').where('date', '>=', dFrom).get().catch(function () { return null; }),
      db.collection('settings').doc('siteTargets').get().catch(function () { return null; })
    ]).then(function (r) {
      var runs = [], flows = [], ext = {}, labor = [];
      r[0].forEach(function (d) { runs.push(d.data()); });
      r[1].forEach(function (d) { flows.push(d.data()); });
      r[2].forEach(function (d) { try { ext[d.id] = JSON.parse((d.data() || {}).json || '{}'); } catch (e) {} });
      if (r[3]) r[3].forEach(function (d) { labor.push(d.data()); });
      _cfg = (r[4] && r[4].exists) ? (r[4].data() || {}) : {};
      _D = { runs: runs, flows: flows, ext: ext, labor: labor };
      return _D;
    });
  }

  // Eggs PRODUCED per day for a site, from the farm records (what the hens laid).
  function _produced(site) {
    var hs = (_D.ext[site] && Array.isArray(_D.ext[site].houses)) ? _D.ext[site].houses : [];
    var sum = 0;
    hs.forEach(function (h) { if (h.eggsPerDay != null && Number(h.eggsPerDay) > 0) sum += Number(h.eggsPerDay); });
    return sum || null;
  }

  // ── PER-DAY PACKED / RUNTIME / DOWNTIME for one site ─────────────────────
  // Hegins packs on machines (eggDailyRun). Danville's belt runs are the flow
  // record; its packed eggs come from the farm records for days it ran.
  // Returns { days, eggsSource } where eggsSource is:
  //   'packer' — a real counted packed total per day (trustworthy targets)
  //   'flock'  — no packed count entered, so we fall back to what the hens laid.
  //              That number is the SAME every day, so median/best/stretch all
  //              collapse to one value. Targets from it are PROVISIONAL and the
  //              board says so instead of pretending.
  function _days(site) {
    var out = {};   // date → { eggs, runMin, spanMin, downMin, stops, machines }
    var parallel = (site === 'Hegins');       // machines run at the same time
    var tgtDone = (typeof EGGRUN_TARGET_DONE !== 'undefined' && EGGRUN_TARGET_DONE[site]) ? _clock(EGGRUN_TARGET_DONE[site]) : null;
    var packed = 0;

    // 1) machine/packer rows (eggDailyRun) — both sites use this form
    _D.runs.forEach(function (r) {
      if (r.farm !== site || !r.date) return;
      var a = _clock(r.startClock), b = _clock(r.stopClock);
      var mins = (a != null && b != null && b > a) ? b - a : null;
      if (mins == null && r.manualMin != null) mins = Number(r.manualMin) || null;
      if (!(mins > 0 && mins <= 960)) mins = null;                      // forgotten-stop guard
      var e = Number(r.eggs) || 0;
      if (mins == null && e <= 0) return;                               // nothing usable
      var g = out[r.date] || (out[r.date] = { eggs: 0, runMin: 0, spanMin: 0, downMin: 0, stops: 0, machines: 0, src: '' });
      if (e > 0) { g.eggs += e; g.src = 'packer'; packed++; }
      g.machines++;
      if (mins) {
        g.runMin += mins;
        g.spanMin = parallel ? Math.max(g.spanMin, mins) : (g.spanMin + mins);
      }
      var stopM = _clock(r.stopClock);
      if (tgtDone != null && stopM != null && stopM > tgtDone) g.downMin += (stopM - tgtDone);
      else if (r.downtimeMin != null) g.downMin += Number(r.downtimeMin) || 0;
    });

    // 2) belt/house flow rows (eggFlow) — Danville's real runtime lives here
    _D.flows.forEach(function (f) {
      if (f.farm !== site || !f.date || f.status !== 'done') return;
      var m = Number(f.minutes) || 0; if (m <= 0 || m > 480) return;    // stuck-run guard
      var g = out[f.date] || (out[f.date] = { eggs: 0, runMin: 0, spanMin: 0, downMin: 0, stops: 0, machines: 0, src: '' });
      if (g.src === 'packer' && parallel) return;                       // Hegins: machines already counted
      g.runMin += m;
      g.spanMin += m;                                                   // houses run one after another
      g.machines++;
      if (f.eggs != null && Number(f.eggs) > 0) { g.eggs += Number(f.eggs); g.src = 'packer'; packed++; }
      if (f.stops != null) g.stops += Number(f.stops) || 0;
      if (f.offMin != null) g.downMin += Number(f.offMin) || 0;
    });

    // 3) no counted eggs anywhere → fall back to the flock's daily lay
    var src = packed ? 'packer' : 'flock';
    if (!packed) {
      var lay = _produced(site);
      Object.keys(out).forEach(function (d) { if (lay) out[d].eggs = lay; });
    } else {
      // drop days that ran but never got an egg count — they'd read as a zero day
      Object.keys(out).forEach(function (d) { if (!(out[d].eggs > 0)) delete out[d]; });
    }
    return { days: out, eggsSource: src };
  }

  // Labor hours per day for a site, where punches exist.
  function _laborDays(site) {
    var out = {};
    (_D.labor || []).forEach(function (p) {
      if (!p || !p.date) return;
      var f = p.farm || p.site || '';
      if (f && f !== site && f !== 'Both') return;
      var h = Number(p.hours != null ? p.hours : p.hrs);
      if (!h || isNaN(h)) return;
      out[p.date] = (out[p.date] || 0) + h;
    });
    return out;
  }

  // ── SITE PROFILE ────────────────────────────────────────────────────────
  function _profile(site) {
    var dd = _days(site), days = dd.days, lab = _laborDays(site);
    var baseFrom = _dstr(BASE_DAYS);
    var dts = Object.keys(days).filter(function (d) { return d >= baseFrom; }).sort();
    var eggsArr = [], rateArr = [], spanArr = [], downArr = [], caseHrArr = [], laborArr = [], eggsPerLabor = [];
    dts.forEach(function (d) {
      var g = days[d];
      if (g.eggs > 0) eggsArr.push(g.eggs);
      if (g.spanMin > 5) spanArr.push(g.spanMin / 60);
      if (g.eggs > 0 && g.spanMin > 5) {
        var hrs = g.spanMin / 60;
        rateArr.push(g.eggs / hrs);
        caseHrArr.push((g.eggs / EGGS_PER_CASE) / hrs);
      }
      downArr.push(g.downMin || 0);
      if (lab[d]) { laborArr.push(lab[d]); if (g.eggs > 0) eggsPerLabor.push(g.eggs / lab[d]); }
    });
    var cfg = (_cfg && _cfg[site]) || {};
    var availHrs = Number(cfg.availHrs) || 8.0;                     // available production hours/day
    // demonstrated capability
    var demoMax = eggsArr.length ? Math.max.apply(null, eggsArr) : null;
    var demoRate = rateArr.length ? _pct(rateArr, 75) : null;        // a rate they've PROVEN (p75)
    var bestRate = rateArr.length ? Math.max.apply(null, rateArr) : null;
    var stdCalc = eggsArr.length ? _med(eggsArr) : null;             // median = normal expected
    var stretchCalc = (stdCalc != null && demoMax != null) ? (stdCalc + (demoMax - stdCalc) * 0.5) : null;
    return {
      site: site, days: days, labor: lab, dates: dts,
      nDays: dts.length,
      eggsSource: dd.eggsSource,
      provisional: (dd.eggsSource !== 'packer' || dts.length < 10),
      avgProduced: _produced(site),
      avgPacked: _avg(eggsArr),
      medPacked: stdCalc,
      avgRuntimeH: _avg(spanArr),
      avgEggsPerHr: _avg(rateArr),
      avgCasesPerHr: _avg(caseHrArr),
      avgLaborH: _avg(laborArr),
      avgEggsPerLaborH: _avg(eggsPerLabor),
      avgDownMin: _avg(downArr),
      demoMax: demoMax, demoRate: demoRate, bestRate: bestRate,
      availHrs: availHrs,
      // ── three target levels (calculated) ──
      calc: {
        standard: stdCalc,
        stretch: stretchCalc,
        minimum: stdCalc != null ? stdCalc * 0.85 : null,           // replaced by company allocation below
        targetRate: demoRate,
        targetRuntimeH: (stdCalc != null && demoRate) ? (stdCalc / demoRate) : null
      },
      set: {
        minimum: cfg.minimum != null ? Number(cfg.minimum) : null,
        standard: cfg.standard != null ? Number(cfg.standard) : null,
        stretch: cfg.stretch != null ? Number(cfg.stretch) : null,
        by: cfg.by || '', ts: cfg.ts || 0
      }
    };
  }
  function _eff(p, level) {
    var v = p.set[level];
    return (v != null && v > 0) ? v : (p.calc[level] != null ? p.calc[level] : null);
  }

  // Company weekly requirement → per-site MINIMUM allocated by capability share.
  function _allocMinimums(profs) {
    var weekly = Number((_cfg || {}).companyWeekly) || null;
    var totalStd = profs.reduce(function (a, p) { return a + (_eff(p, 'standard') || 0); }, 0);
    profs.forEach(function (p) {
      var std = _eff(p, 'standard') || 0;
      if (weekly && totalStd > 0) {
        p.calc.minimum = (weekly / 7) * (std / totalStd);            // daily minimum share
        p.minSource = 'company';
      } else {
        p.calc.minimum = std ? std * 0.85 : null;
        p.minSource = 'floor';
      }
    });
    return weekly;
  }

  // ── WEEK TO DATE + PROJECTION + RECOVERY ────────────────────────────────
  function _week(p) {
    var t = _today(), dow = new Date(t + 'T12:00:00').getDay();      // 0=Sun
    var elapsed = dow === 0 ? 7 : dow;                               // Mon-start week, today counts
    var wkStart = _dstr(elapsed - 1);
    var actual = 0, runMin = 0, downMin = 0, ranDays = 0, labor = 0;
    Object.keys(p.days).forEach(function (d) {
      if (d < wkStart || d > t) return;
      var g = p.days[d];
      actual += g.eggs || 0; runMin += g.spanMin || 0; downMin += g.downMin || 0;
      if ((g.eggs || 0) > 0) ranDays++;
      if (p.labor[d]) labor += p.labor[d];
    });
    var stdDaily = _eff(p, 'standard') || 0;
    var minDaily = _eff(p, 'minimum') || 0;
    var strDaily = _eff(p, 'stretch') || 0;
    var runDaysPlanned = Number(((_cfg || {})[p.site] || {}).runDays) || 7;
    var weekTarget = stdDaily * runDaysPlanned;
    var expectedToDate = weekTarget * (elapsed / runDaysPlanned);
    var variance = actual - expectedToDate;
    var daysLeft = Math.max(0, runDaysPlanned - elapsed);
    var dailyRate = ranDays ? (actual / ranDays) : null;
    var projected = actual + (dailyRate || 0) * daysLeft;
    var remaining = Math.max(0, weekTarget - actual);
    var recoveryDaily = daysLeft > 0 ? (remaining / daysLeft) : null;
    var rate = (runMin > 5 && actual) ? (actual / (runMin / 60)) : null;
    var recoveryRuntimeH = (recoveryDaily && p.calc.targetRate) ? (recoveryDaily / p.calc.targetRate) : null;
    return {
      elapsed: elapsed, daysLeft: daysLeft, runDaysPlanned: runDaysPlanned,
      actual: actual, weekTarget: weekTarget, expectedToDate: expectedToDate,
      variance: variance, projected: projected, shortfall: projected - weekTarget,
      remaining: remaining, recoveryDaily: recoveryDaily, recoveryRuntimeH: recoveryRuntimeH,
      runMin: runMin, downMin: downMin, ranDays: ranDays, labor: labor,
      rate: rate, eggsPerLaborH: labor ? (actual / labor) : null,
      stdDaily: stdDaily, minDaily: minDaily, strDaily: strDaily,
      spare: (p.demoMax != null && stdDaily) ? Math.max(0, (p.demoMax - stdDaily) * daysLeft) : 0,
      status: (function () {
        if (!actual) return '-';
        if (actual >= expectedToDate) return 'g';
        if (minDaily && actual >= (minDaily * elapsed)) return 'y';
        return 'r';
      })()
    };
  }

  // ── ATTAINMENT HISTORY ──────────────────────────────────────────────────
  function _attain(p) {
    var dts = Object.keys(p.days).sort();
    var min = _eff(p, 'minimum'), std = _eff(p, 'standard'), str = _eff(p, 'stretch');
    var hitMin = 0, hitStd = 0, hitStr = 0, n = 0, varSum = 0;
    var streakStd = 0, bestStreak = 0, run = 0;
    dts.forEach(function (d) {
      var e = p.days[d].eggs || 0; if (!e) return;
      n++;
      if (min && e >= min) hitMin++;
      if (std && e >= std) { hitStd++; run++; if (run > bestStreak) bestStreak = run; } else { run = 0; }
      if (str && e >= str) hitStr++;
      if (std) varSum += (e - std);
    });
    // consecutive days meeting standard, counting BACK from the most recent day
    for (var i = dts.length - 1; i >= 0; i--) {
      var e2 = p.days[dts[i]].eggs || 0; if (!e2) continue;
      if (std && e2 >= std) streakStd++; else break;
    }
    // weekly attainment (rolling 7-day blocks)
    var weeks = [], wkStreak = 0;
    for (var w = 0; w < 8; w++) {
      var from = _dstr((w + 1) * 7 - 1), to = _dstr(w * 7);
      var sum = 0, any = false;
      dts.forEach(function (d) { if (d >= from && d <= to) { sum += p.days[d].eggs || 0; any = any || (p.days[d].eggs || 0) > 0; } });
      if (any) weeks.push({ from: from, to: to, sum: sum, target: (std || 0) * (Number(((_cfg || {})[p.site] || {}).runDays) || 7) });
    }
    for (var k = 0; k < weeks.length; k++) { if (weeks[k].target && weeks[k].sum >= weeks[k].target) wkStreak++; else break; }
    return {
      nDays: n,
      pctMin: n ? Math.round(hitMin / n * 100) : null,
      pctStd: n ? Math.round(hitStd / n * 100) : null,
      pctStr: n ? Math.round(hitStr / n * 100) : null,
      avgDailyVar: n ? (varSum / n) : null,
      avgWeeklyVar: weeks.length ? _avg(weeks.map(function (x) { return x.sum - x.target; })) : null,
      streakDays: streakStd, bestStreak: bestStreak, streakWeeks: wkStreak,
      weeks: weeks,
      // review flags — targets move UP when earned, never down for failing
      raiseFlag: (n >= 10 && hitStd / n >= 0.9 && str && hitStr / n >= 0.5),
      missFlag: (n >= 10 && hitStd / n < 0.5)
    };
  }

  // ── WHY ARE WE MISSING? (ranked from data — never "lower the target") ────
  function _diagnose(p, wk) {
    var out = [];
    var tRun = p.calc.targetRuntimeH, tRate = p.calc.targetRate;
    if (p.eggsSource !== 'packer') {
      out.push({ k: tgL('No packed count entered', 'Sin conteo empacado'), d: tgL('Nobody enters total eggs packed at ' + p.site + ', so this target is the flock\'s daily lay — the same number every day. Enter eggs on the egg run and the target becomes real within 2 weeks.', 'Nadie registra los huevos empacados en ' + p.site + '. Registra los huevos en la corrida y la meta será real en 2 semanas.') });
    }
    var actRunH = wk.ranDays ? (wk.runMin / 60 / wk.ranDays) : null;
    if (tRun && actRunH != null && actRunH < tRun * 0.9) {
      out.push({ k: tgL('Runtime', 'Tiempo de corrida'), d: tgL('Ran ' + _hrs(actRunH) + '/day vs ' + _hrs(tRun) + ' needed — not enough hours on the line.', 'Corrió ' + _hrs(actRunH) + '/día vs ' + _hrs(tRun) + ' necesarias.') });
    }
    if (wk.downMin && wk.ranDays && (wk.downMin / wk.ranDays) > 20) {
      out.push({ k: tgL('Downtime', 'Paro'), d: tgL(Math.round(wk.downMin / wk.ranDays) + ' min/day stopped or past target — that is the lost time.', Math.round(wk.downMin / wk.ranDays) + ' min/día parado o pasado de meta.') });
    }
    if (tRate && wk.rate && wk.rate < tRate * 0.9) {
      out.push({ k: tgL('Production rate', 'Ritmo'), d: tgL('Running ' + _n(wk.rate) + ' eggs/hr vs ' + _n(tRate) + ' proven — the line is slow, not short of hours.', 'Corriendo ' + _n(wk.rate) + ' huevos/hr vs ' + _n(tRate) + ' comprobados.') });
    }
    var prod = p.avgProduced;
    if (prod && wk.stdDaily && prod < wk.stdDaily * 0.98) {
      out.push({ k: tgL('Egg availability (WIP)', 'Huevos disponibles'), d: tgL('Hens are laying ' + _n(prod) + '/day — you cannot pack more than the flock makes. Target may exceed supply.', 'Las aves ponen ' + _n(prod) + '/día — no se puede empacar más de lo que produce el lote.') });
    }
    if (p.avgLaborH == null) {
      out.push({ k: tgL('Labor (unknown)', 'Mano de obra (sin datos)'), d: tgL('No labor hours recorded — cannot rule labor in or out. Record hours daily.', 'Sin horas registradas — no se puede evaluar. Registra horas a diario.') });
    }
    var stops = 0, sd = 0;
    Object.keys(p.days).forEach(function (d) { if (p.days[d].stops) { stops += p.days[d].stops; sd++; } });
    if (sd && (stops / sd) >= 3) {
      out.push({ k: tgL('Stoppages / changeover', 'Paros / cambios'), d: tgL(_n1(stops / sd) + ' stops per run day — each restart costs flow.', _n1(stops / sd) + ' paros por día.') });
    }
    if (p.demoMax && wk.stdDaily && wk.stdDaily > p.demoMax * 0.98) {
      out.push({ k: tgL('Target may be unrealistic', 'Meta poco realista'), d: tgL('Standard is at or above the best day ever achieved (' + _n(p.demoMax) + '). Review capacity before blaming the crew.', 'La meta iguala o supera el mejor día (' + _n(p.demoMax) + ').') });
    }
    if (!out.length) out.push({ k: tgL('Scheduling / mix', 'Programación'), d: tgL('Rate, runtime and downtime all look normal — check the schedule and day-to-day mix.', 'Ritmo, tiempo y paro normales — revisa la programación.') });
    return out;
  }

  // ── SAVE OVERRIDES ──────────────────────────────────────────────────────
  window.tgSave = function (site, field) {
    if (!_canEdit()) { if (typeof toast === 'function') toast(tgL('Only a Director or Lead can change targets', 'Solo un Director o Líder puede cambiar metas')); return; }
    var el = document.getElementById('tg-' + field + '-' + site);
    var raw = el ? String(el.value).replace(/[, ]/g, '').trim() : '';
    var v = raw === '' ? null : Number(raw);
    if (v != null && (isNaN(v) || v < 0)) { if (typeof toast === 'function') toast(tgL('Numbers only', 'Solo números')); return; }
    var patch = {}; patch[site] = {}; patch[site][field] = v;
    patch[site].by = _me(); patch[site].ts = Date.now();
    db.collection('settings').doc('siteTargets').set(patch, { merge: true })
      .then(function () {
        if (typeof toast === 'function') toast('🎯 ' + site + ' ' + field + (v == null ? tgL(' cleared — using calculated', ' borrado — usando calculado') : ' = ' + _n(v)));
        window.openTargets();
      })
      .catch(function () { if (typeof toast === 'function') toast(tgL('Could not save', 'No se pudo guardar')); });
  };
  window.tgSaveCompany = function () {
    if (!_canEdit()) { if (typeof toast === 'function') toast(tgL('Only a Director or Lead can change this', 'Solo Director o Líder')); return; }
    var el = document.getElementById('tg-company-weekly');
    var raw = el ? String(el.value).replace(/[, ]/g, '').trim() : '';
    var v = raw === '' ? null : Number(raw);
    if (v != null && (isNaN(v) || v < 0)) { if (typeof toast === 'function') toast(tgL('Numbers only', 'Solo números')); return; }
    db.collection('settings').doc('siteTargets').set({ companyWeekly: v, companyBy: _me(), companyTs: Date.now() }, { merge: true })
      .then(function () { if (typeof toast === 'function') toast('🏢 ' + tgL('Company weekly requirement saved', 'Requerimiento semanal guardado')); window.openTargets(); })
      .catch(function () {});
  };

  // ── RENDER ──────────────────────────────────────────────────────────────
  function _ov() {
    var o = document.getElementById('tg-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'tg-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:962;background:#0b1410;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeTargets = function () { var o = document.getElementById('tg-overlay'); if (o) o.style.display = 'none'; };

  function _dot(s) { return s === 'g' ? '#4ade80' : s === 'y' ? '#e8c96a' : s === 'r' ? '#f87171' : '#5a7a5a'; }
  function _sec(t) { return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#6aa06a;text-transform:uppercase;margin:20px 2px 8px;font-weight:700;">' + t + '</div>'; }
  function _box(inner, border) { return '<div style="background:#0d1a12;border:1.5px solid ' + (border || '#1e3a2a') + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;">' + inner + '</div>'; }

  window.openTargets = function () {
    var o = _ov();
    o.innerHTML = '<div style="max-width:900px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeTargets()" style="padding:11px 16px;background:#0f1a12;border:1.5px solid #2a5a3a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + tgL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:27px;letter-spacing:2px;line-height:1;color:#e8f5ec;">🎯 ' + tgL('SITE TARGETS', 'METAS POR SITIO') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:2px;">' + tgL('Built from each site\'s own history · nothing hard-coded', 'Calculado del historial de cada sitio') + '</div>' +
        '</div>' +
      '</div>' +
      '<div id="tg-body" style="' + MONO + 'font-size:12px;color:#7ab07a;">' + tgL('Calculating from history…', 'Calculando…') + '</div>' +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}

    _load().then(function () {
      var body = document.getElementById('tg-body'); if (!body) return;
      var profs = SITES.map(_profile);
      var weekly = _allocMinimums(profs);
      var wks = profs.map(_week);
      var atts = profs.map(_attain);
      var editable = _canEdit();

      // ── company roll-up ──
      var cT = 0, cA = 0, cP = 0, cRem = 0;
      wks.forEach(function (w) { cT += w.weekTarget; cA += w.actual; cP += w.projected; cRem += w.remaining; });
      var cVar = cA - wks.reduce(function (a, w) { return a + w.expectedToDate; }, 0);
      var cShort = cP - cT;
      var cStatus = cShort >= 0 ? 'g' : (cShort > -cT * 0.05 ? 'y' : 'r');
      var inp = 'background:#06120a;border:1.5px solid #2a5a2a;border-radius:7px;color:#e8f5ec;' + MONO + 'font-size:13px;font-weight:700;padding:7px 8px;width:110px;text-align:right;';

      var html = '';
      // COMPANY
      html += _sec('🏢 ' + tgL('Company position · this week', 'Posición de la compañía · esta semana'));
      html += _box(
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;flex-wrap:wrap;">' +
          '<span style="width:14px;height:14px;border-radius:50%;background:' + _dot(cStatus) + ';box-shadow:0 0 9px ' + _dot(cStatus) + ';"></span>' +
          '<b style="' + MONO + 'font-size:14px;color:#e8f5ec;">' + (cShort >= 0
            ? (tgL('ON TRACK · projected surplus ', 'EN META · superávit ') + _n(cShort))
            : (tgL('BEHIND · projected shortfall ', 'ATRASADO · faltante ') + _n(Math.abs(cShort)))) + '</b>' +
        '</div>' +
        '<table style="width:100%;' + MONO + 'font-size:12px;color:#cfe0d0;"><tbody>' +
          '<tr><td style="padding:3px 0;">' + tgL('Total target (week)', 'Meta total') + '</td><td style="text-align:right;font-weight:700;color:#e8f5ec;">' + _n(cT) + '</td></tr>' +
          '<tr><td style="padding:3px 0;">' + tgL('Total actual to date', 'Real a la fecha') + '</td><td style="text-align:right;font-weight:700;color:#e8f5ec;">' + _n(cA) + '</td></tr>' +
          '<tr><td style="padding:3px 0;">' + tgL('Variance vs expected', 'Variación') + '</td><td style="text-align:right;font-weight:700;color:' + (cVar >= 0 ? '#4ade80' : '#f87171') + ';">' + (cVar >= 0 ? '+' : '') + _n(cVar) + '</td></tr>' +
          '<tr><td style="padding:3px 0;">' + tgL('Remaining requirement', 'Falta producir') + '</td><td style="text-align:right;font-weight:700;color:#e8c96a;">' + _n(cRem) + '</td></tr>' +
          '<tr><td style="padding:3px 0;">' + tgL('Projected weekly production', 'Proyección semanal') + '</td><td style="text-align:right;font-weight:700;color:#e8f5ec;">' + _n(cP) + '</td></tr>' +
        '</tbody></table>' +
        '<div style="margin-top:10px;padding-top:9px;border-top:1px dashed #2a4a2a;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '<span style="' + MONO + 'font-size:11px;color:#9ab09a;">' + tgL('Company weekly requirement (optional — drives each site\'s MINIMUM):', 'Requerimiento semanal (opcional):') + '</span>' +
          '<input id="tg-company-weekly" type="number" min="0" value="' + (weekly != null ? weekly : '') + '" placeholder="' + tgL('eggs/week', 'huevos/sem') + '" style="' + inp + '"' + (editable ? '' : ' disabled') + '>' +
          (editable ? '<button onclick="tgSaveCompany()" style="padding:7px 12px;background:#14361c;border:1.5px solid #4ade80;border-radius:7px;color:#4ade80;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">' + tgL('SAVE', 'GUARDAR') + '</button>' : '') +
        '</div>', cStatus === 'r' ? '#7f1d1d' : undefined);

      // ── CONFIG TABLE ──
      html += _sec('⚙️ ' + tgL('Site target table · calculated, override allowed', 'Tabla de metas · calculado, puedes sobrescribir'));
      html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;min-width:760px;">' +
        '<thead><tr style="border-bottom:1px solid #2a4a2a;color:#5a8a5a;">' +
          '<th style="text-align:left;padding:6px;">' + tgL('Site', 'Sitio') + '</th>' +
          '<th style="padding:6px;">' + tgL('Minimum/day', 'Mínimo/día') + '</th>' +
          '<th style="padding:6px;">' + tgL('Standard/day', 'Estándar/día') + '</th>' +
          '<th style="padding:6px;">' + tgL('Stretch/day', 'Reto/día') + '</th>' +
          '<th style="padding:6px;">' + tgL('Target runtime', 'Tiempo meta') + '</th>' +
          '<th style="padding:6px;">' + tgL('Target eggs/hr', 'Huevos/hr meta') + '</th>' +
        '</tr></thead><tbody>';
      profs.forEach(function (p) {
        function cell(field) {
          var calc = p.calc[field], set = p.set[field];
          return '<td style="padding:6px;text-align:center;">' +
            '<input id="tg-' + field + '-' + p.site + '" type="number" min="0" value="' + (set != null ? set : '') + '" placeholder="' + (calc != null ? _n(calc) : 'auto') + '" style="' + inp + 'width:96px;"' + (editable ? ' onchange="tgSave(\'' + p.site + '\',\'' + field + '\')"' : ' disabled') + '>' +
            '<div style="' + MONO + 'font-size:9px;color:' + (set != null ? '#e8c96a' : '#5a8a5a') + ';margin-top:2px;">' +
              (set != null ? (tgL('set · calc ', 'fijo · calc ') + _n(calc)) : (tgL('auto ', 'auto ') + _n(calc))) + '</div>' +
          '</td>';
        }
        html += '<tr style="border-bottom:1px solid #16281a;">' +
          '<td style="padding:6px;color:#e8f5ec;font-weight:700;">' + p.site +
            '<div style="' + MONO + 'font-size:9px;color:#5a8a5a;">' + p.nDays + ' ' + tgL('days of data', 'días de datos') + '</div>' +
            (p.provisional ? ('<div style="' + MONO + 'font-size:9px;color:#f0a35a;font-weight:700;">⚠ ' + tgL('PROVISIONAL', 'PROVISIONAL') + '</div>') : '') + '</td>' +
          cell('minimum') + cell('standard') + cell('stretch') +
          '<td style="padding:6px;text-align:center;color:#9ad6a0;font-weight:700;">' + _hrs(p.calc.targetRuntimeH) +
            '<div style="' + MONO + 'font-size:9px;color:#5a8a5a;">' + tgL('avail ', 'disp ') + _n1(p.availHrs) + 'h</div></td>' +
          '<td style="padding:6px;text-align:center;color:#4ade80;font-weight:700;">' + _n(p.calc.targetRate) +
            '<div style="' + MONO + 'font-size:9px;color:#5a8a5a;">' + tgL('proven p75', 'comprobado') + '</div></td>' +
        '</tr>';
      });
      html += '</tbody></table></div>' +
        '<div style="' + MONO + 'font-size:9.5px;color:#4a6a4a;margin-top:6px;line-height:1.6;">' +
          tgL('Standard = median of that site\'s last ' + BASE_DAYS + ' days (its normal, demonstrated output). Stretch = halfway between standard and its best day ever. Minimum = its share of the company weekly requirement (or 85% of standard if none set). Target eggs/hr = a rate the site has already proven (75th percentile of its daily rates). Target runtime = standard ÷ that rate. Blank an override to go back to calculated.',
                'Estándar = mediana de los últimos ' + BASE_DAYS + ' días. Reto = mitad entre estándar y su mejor día. Mínimo = su parte del requerimiento semanal. Deja vacío para volver a lo calculado.') + '</div>';

      // ── SITE CARDS ──
      html += _sec('📍 ' + tgL('Site level · the seven questions', 'Por sitio · las siete preguntas'));
      profs.forEach(function (p, i) {
        var w = wks[i], a = atts[i];
        var rows = [
          [tgL('1. What do we need to produce?', '1. ¿Qué debemos producir?'), _n(w.weekTarget) + tgL(' this week · ', ' esta semana · ') + _n(w.stdDaily) + tgL('/day', '/día'), '#e8f5ec'],
          [tgL('2. How many hours should it take?', '2. ¿Cuántas horas?'), _hrs(p.calc.targetRuntimeH) + tgL('/day at ', '/día a ') + _n(p.calc.targetRate) + tgL(' eggs/hr', ' huevos/hr'), '#9ad6a0'],
          [tgL('3. How much have we produced?', '3. ¿Cuánto hemos producido?'), _n(w.actual) + ' (' + w.ranDays + tgL(' days run)', ' días)'), '#e8f5ec'],
          [tgL('4. Ahead or behind?', '4. ¿Adelante o atrás?'), (w.variance >= 0 ? '▲ ' + tgL('AHEAD ', 'ADELANTE ') : '▼ ' + tgL('BEHIND ', 'ATRÁS ')) + _n(Math.abs(w.variance)) + tgL(' vs expected ', ' vs esperado ') + _n(w.expectedToDate), w.variance >= 0 ? '#4ade80' : '#f87171'],
          [tgL('5. What rate are we running?', '5. ¿A qué ritmo?'), (w.rate ? (_n(w.rate) + tgL(' eggs/hr · ', ' huevos/hr · ') + _n1((w.rate / EGGS_PER_CASE)) + tgL(' cases/hr', ' cajas/hr')) : '—') + (p.calc.targetRate && w.rate ? (' (' + Math.round(w.rate / p.calc.targetRate * 100) + tgL('% of target rate)', '% de la meta)')) : ''), '#4ade80'],
          [tgL('6. Where do we finish?', '6. ¿Dónde terminamos?'), _n(w.projected) + ' → ' + (w.shortfall >= 0 ? ('+' + _n(w.shortfall) + tgL(' surplus', ' superávit')) : (_n(Math.abs(w.shortfall)) + tgL(' short', ' faltante'))), w.shortfall >= 0 ? '#4ade80' : '#f87171'],
          [tgL('7. What do we do to recover?', '7. ¿Cómo recuperamos?'), (w.daysLeft <= 0
              ? tgL('Week is done.', 'Semana terminada.')
              : (w.remaining <= 0 ? tgL('Target already met.', 'Meta cumplida.')
                 : (_n(w.recoveryDaily) + tgL('/day for the next ', '/día por los próximos ') + w.daysLeft + tgL(' day(s)', ' día(s)') +
                    (w.recoveryRuntimeH ? (' · ' + _hrs(w.recoveryRuntimeH) + tgL(' runtime/day', ' de corrida/día')) : '')))), '#e8c96a']
        ];
        html += _box(
          '<div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;flex-wrap:wrap;">' +
            '<span style="width:13px;height:13px;border-radius:50%;background:' + _dot(w.status) + ';box-shadow:0 0 8px ' + _dot(w.status) + ';"></span>' +
            '<b style="' + MONO + 'font-size:15px;color:#e8f5ec;">' + p.site + '</b>' +
            (p.provisional ? ('<span style="' + MONO + 'font-size:9.5px;font-weight:700;color:#f0a35a;background:#2a1c08;border:1px solid #6a4a1a;border-radius:50px;padding:2px 8px;">⚠ ' + tgL('PROVISIONAL — no packed count', 'PROVISIONAL — sin conteo') + '</span>') : '') +
            '<span style="' + MONO + 'font-size:10.5px;color:#9ab09a;">' + tgL('day ', 'día ') + w.elapsed + '/' + w.runDaysPlanned +
              ' · ' + tgL('stretch ', 'reto ') + _n(w.strDaily) + tgL('/day', '/día') +
              ' · ' + tgL('best ever ', 'mejor ') + _n(p.demoMax) + '</span>' +
          '</div>' +
          '<table style="width:100%;' + MONO + 'font-size:11.5px;"><tbody>' +
          rows.map(function (r) {
            return '<tr><td style="padding:3px 0;color:#8aa88a;white-space:nowrap;vertical-align:top;">' + r[0] + '</td>' +
                   '<td style="padding:3px 0 3px 10px;color:' + r[2] + ';font-weight:700;">' + r[1] + '</td></tr>';
          }).join('') + '</tbody></table>' +
          '<div style="margin-top:9px;padding-top:8px;border-top:1px dashed #24402c;display:flex;gap:14px;flex-wrap:wrap;' + MONO + 'font-size:10.5px;color:#9ab09a;">' +
            '<span>' + tgL('Runtime ', 'Corrida ') + '<b style="color:#cfe0d0;">' + _hrs(w.runMin / 60) + '</b></span>' +
            '<span>' + tgL('Downtime ', 'Paro ') + '<b style="color:' + (w.downMin ? '#f0a35a' : '#4ade80') + ';">' + Math.round(w.downMin) + 'm</b></span>' +
            '<span>' + tgL('Labor ', 'Horas ') + '<b style="color:#cfe0d0;">' + (w.labor ? _n1(w.labor) + 'h' : '—') + '</b></span>' +
            '<span>' + tgL('Eggs/labor-hr ', 'Huevos/hora-hombre ') + '<b style="color:#cfe0d0;">' + (w.eggsPerLaborH ? _n(w.eggsPerLaborH) : '—') + '</b></span>' +
            '<span>' + tgL('Hens lay ', 'Postura ') + '<b style="color:#cfe0d0;">' + _n(p.avgProduced) + '/day</b></span>' +
          '</div>' +
          // attainment
          '<div style="margin-top:9px;padding-top:8px;border-top:1px dashed #24402c;' + MONO + 'font-size:10.5px;color:#9ab09a;line-height:1.8;">' +
            '<b style="color:#cfe0d0;">' + tgL('Attainment', 'Cumplimiento') + '</b> · ' +
            tgL('minimum ', 'mínimo ') + '<b style="color:#4ade80;">' + (a.pctMin != null ? a.pctMin + '%' : '—') + '</b> · ' +
            tgL('standard ', 'estándar ') + '<b style="color:' + (a.pctStd >= 70 ? '#4ade80' : a.pctStd >= 40 ? '#e8c96a' : '#f87171') + ';">' + (a.pctStd != null ? a.pctStd + '%' : '—') + '</b> · ' +
            tgL('stretch ', 'reto ') + '<b style="color:#9cc0f6;">' + (a.pctStr != null ? a.pctStr + '%' : '—') + '</b><br>' +
            tgL('avg daily variance ', 'variación diaria ') + '<b style="color:' + (a.avgDailyVar >= 0 ? '#4ade80' : '#f87171') + ';">' + (a.avgDailyVar != null ? ((a.avgDailyVar >= 0 ? '+' : '') + _n(a.avgDailyVar)) : '—') + '</b> · ' +
            tgL('avg weekly ', 'semanal ') + '<b style="color:' + (a.avgWeeklyVar >= 0 ? '#4ade80' : '#f87171') + ';">' + (a.avgWeeklyVar != null ? ((a.avgWeeklyVar >= 0 ? '+' : '') + _n(a.avgWeeklyVar)) : '—') + '</b> · ' +
            tgL('streak ', 'racha ') + '<b style="color:#cfe0d0;">' + a.streakDays + tgL(' days', ' días') + '</b> / <b style="color:#cfe0d0;">' + a.streakWeeks + tgL(' weeks', ' sem') + '</b>' +
            (a.raiseFlag ? ('<div style="margin-top:6px;color:#4ade80;">🚀 ' + tgL('Beating standard consistently — REVIEW: raise the standard target.', 'Supera el estándar — REVISAR: subir la meta.') + '</div>') : '') +
          '</div>' +
          // diagnosis when behind
          ((w.status === 'r' || w.status === 'y' || a.missFlag || p.provisional)
            ? ('<div style="margin-top:9px;padding:9px 10px;background:#1c1208;border:1px solid #5a4a1a;border-radius:9px;">' +
                '<div style="' + MONO + 'font-size:10px;font-weight:700;color:#e8c96a;letter-spacing:1px;margin-bottom:5px;">🔎 ' + tgL('WHY — CHECK THESE FIRST (the target does not get lowered)', 'POR QUÉ — REVISA ESTO (la meta no se baja)') + '</div>' +
                _diagnose(p, w).map(function (d) {
                  return '<div style="' + MONO + 'font-size:11px;color:#e8dfc8;line-height:1.5;margin-bottom:3px;">• <b>' + d.k + ':</b> ' + d.d + '</div>';
                }).join('') + '</div>')
            : ''),
          w.status === 'r' ? '#7f1d1d' : (w.status === 'y' ? '#5a4a1a' : undefined));
      });

      // ── RECOVERY / CROSS-SITE ──
      html += _sec('🚑 ' + tgL('Recovery position · who is behind, who can help', 'Recuperación · quién está atrás, quién puede ayudar'));
      var net = 0;
      var recov = profs.map(function (p, i) { net += wks[i].variance; return { site: p.site, v: wks[i].variance, spare: wks[i].spare, daysLeft: wks[i].daysLeft, rec: wks[i].recoveryDaily, runH: wks[i].recoveryRuntimeH }; })
        .sort(function (a, b) { return a.v - b.v; });
      var behind = recov.filter(function (r) { return r.v < 0; });
      var ahead = recov.filter(function (r) { return r.v > 0; });
      var help = ahead.reduce(function (a, r) { return a + r.spare; }, 0);
      html += _box(
        recov.map(function (r) {
          return '<div style="display:flex;align-items:center;gap:9px;padding:4px 0;' + MONO + 'font-size:12.5px;">' +
            '<b style="color:#e8f5ec;min-width:90px;">' + r.site + '</b>' +
            '<b style="color:' + (r.v >= 0 ? '#4ade80' : '#f87171') + ';min-width:130px;">' + (r.v >= 0 ? '+' : '−') + _n(Math.abs(r.v)) + ' ' + (r.v >= 0 ? tgL('AHEAD', 'ADELANTE') : tgL('BEHIND', 'ATRÁS')) + '</b>' +
            '<span style="color:#9ab09a;font-size:11px;">' + (r.v < 0 && r.daysLeft > 0
              ? (tgL('needs ', 'necesita ') + _n(r.rec) + tgL('/day · ', '/día · ') + _hrs(r.runH) + tgL(' runtime', ' de corrida'))
              : (r.spare ? (tgL('spare capacity ', 'capacidad libre ') + _n(r.spare)) : '')) + '</span>' +
          '</div>';
        }).join('') +
        '<div style="margin-top:9px;padding-top:9px;border-top:1px dashed #2a4a2a;' + MONO + 'font-size:13px;font-weight:700;color:' + (net >= 0 ? '#4ade80' : '#f87171') + ';">' +
          tgL('Company net position: ', 'Posición neta: ') + (net >= 0 ? '+' : '−') + _n(Math.abs(net)) +
        '</div>' +
        (behind.length && help > 0
          ? ('<div style="' + MONO + 'font-size:11px;color:#9cc0f6;margin-top:6px;line-height:1.6;">🔁 ' +
              tgL('Sites that are ahead have about ' + _n(help) + ' eggs of spare capacity left this week — enough to cover ' +
                  (help >= Math.abs(behind.reduce(function (a, r) { return a + r.v; }, 0)) ? 'the whole shortfall' : 'part of the shortfall') + ' if volume can realistically be shifted.',
                  'Los sitios adelantados tienen ~' + _n(help) + ' de capacidad libre esta semana.') + '</div>')
          : ''));

      // honest data caveats
      var noLabor = profs.every(function (p) { return p.avgLaborH == null; });
      var prov = profs.filter(function (p) { return p.provisional; }).map(function (p) { return p.site; });
      html += '<div style="' + MONO + 'font-size:9.5px;color:#4a6a4a;margin-top:14px;line-height:1.7;">' +
        tgL('Data notes: every number above is calculated from this site\'s own history — nothing is hard-coded. Runtime at Hegins is the LONGEST machine that day (both machines run at the same time, so their minutes are never added); at Danville the house belts run one after another, so their minutes are summed. Runs over 8h (belts) and 16h (machines) are dropped as forgotten stops. ' +
        (prov.length ? ('⚠ ' + prov.join(' and ') + ' shows PROVISIONAL because no counted packed total is entered there — the target falls back to the flock\'s daily lay, which is the same every day. Enter eggs on the egg run and the target becomes real in about 2 weeks. ') : '') +
        (noLabor ? 'NO LABOR HOURS are recorded, so eggs-per-labor-hour is blank and labor cannot be ruled in or out as a cause — that is the biggest gap in this whole board.' : ''),
        'Notas: todo se calcula del historial de cada sitio. El tiempo de Hegins es la máquina MÁS LARGA del día; en Danville las bandas corren una tras otra y se suman.' +
        (prov.length ? (' ⚠ ' + prov.join(' y ') + ': PROVISIONAL, falta el conteo de huevos empacados.') : '')) + '</div>';

      body.innerHTML = html;
    }).catch(function (e) {
      console.error('targets:', e);
      var b = document.getElementById('tg-body'); if (b) b.innerHTML = tgL('Could not load.', 'No se pudo cargar.');
    });
  };
})();
