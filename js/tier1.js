// ═══════════════════════════════════════════════════════════════════════════
// tier1.js — TIER 1 DASHBOARD (EN/ES)
// One screen, red/yellow/green across the whole operation, PLUS a 7-day trend
// section and a week-to-date digest for the Tier 1 meeting. Opens from a home
// Quick Action. Pulls live (parallel): barnWalks, morningWalks, eggDailyRun,
// processingLog, mortalityLog, pmHistory, maintProjects, safetySettings +
// app globals workOrders / ALL_PM+pmStatus / partsInventory. Thresholds are
// grouped at the top (TH) so they are easy to tune once real numbers land.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";

  // ── EGGS/HOUR TARGETS (set 2026-07-30 from each plant's own median of the
  // first weeks of real data; goal6 = +9% in 6 months per Joe). Pass = at/above
  // target. These are the Tier 1 / Tier 2 productivity KPI. ──
  // Measured in CASES/HOUR per Joe (1 case = 30 dz = 360 eggs).
  var EGGS_PER_CASE_T1 = 360;
  var EGG_RATE_TARGET = {
    Hegins:   { target: 131.7, goal6: 143.6 },   // 47,414 → 51,681 eggs/hr
    Danville: { target: 157.7, goal6: 171.9 }    // 56,760 → 61,869 eggs/hr
  };
  window.EGG_RATE_TARGET = EGG_RATE_TARGET;

  // ── Tunable thresholds (green ≤ / ≥, else yellow, else red) ──
  var TH = {
    safeDaysG: 30, safeDaysY: 7,          // days since last incident
    prodG: 90, prodY: 50,                 // % houses checked today
    mortHouseR: 30, mortHouseY: 15,       // worst single-house mortality today
    qualG: 0, qualY: 3,                   // flags today
    feedY: 1,                             // houses reporting feed low
    waterY: 1,                            // water issues
    dtG: 30, dtY: 90,                     // packing downtime min today
    pmY: 5,                               // overdue PMs
    woOpenY: 10                           // open WO count (urgent → red)
  };

  function _es() { try { return (typeof _lang !== 'undefined' && _lang === 'es'); } catch (e) { return false; } }
  function L(en, es) { return _es() ? es : en; }
  function _today() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }
  function _num(n) { try { return Number(n || 0).toLocaleString(); } catch (e) { return String(n || 0); } }
  function _dayStr(d) { return d.toISOString().slice(0, 10); }

  // Last 7 calendar days ending today → [{date:'YYYY-MM-DD', lbl:'M'}]
  function _weekBuckets() {
    var out = [], names = _es() ? ['D','L','M','X','J','V','S'] : ['S','M','T','W','T','F','S'];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      out.push({ date: _dayStr(d), lbl: names[d.getDay()] });
    }
    return out;
  }

  function _ov() {
    var o = document.getElementById('tier1-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'tier1-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:955;background:#0a140a;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.openTier1 = function () {
    var o = _ov(); o.style.display = 'block'; try { window.scrollTo(0, 0); } catch (e) {}
    if (!_t1listening) o.innerHTML = _shell(L('Loading live status…', 'Cargando estado…'));
    _t1Listen(); _t1draw();
  };
  window.closeTier1 = function () { var o = document.getElementById('tier1-overlay'); if (o) o.style.display = 'none'; _t1Unlisten(); };

  // ── Site tabs: each tab = one site (Joe 2026-07-20). 'All' = whole operation. ──
  var _t1Site = null;
  var T1_SITES = ['Danville', 'Hegins', 'Turbotville', 'All'];
  window.tier1Site = function (s) { _t1Site = s; renderTier1(); };
  function _t1SiteInit() {
    if (_t1Site) return _t1Site;
    var pf = null; try { pf = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null; } catch (e) {}
    _t1Site = (pf === 'Hegins' || pf === 'Danville') ? pf : 'Danville';
    return _t1Site;
  }
  function _t1Tabs() {
    return '<div style="display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 2px;">' + T1_SITES.map(function (s) {
      var on = s === _t1Site;
      var lbl = s === 'All' ? L('All Sites', 'Todos') : s;
      return '<button onclick="tier1Site(\'' + s + '\')" style="padding:9px 15px;border-radius:20px;' + MONO + 'font-size:12px;font-weight:700;cursor:pointer;background:' + (on ? '#14361c' : '#0c150c') + ';border:1.5px solid ' + (on ? '#4ade80' : '#1e3a1e') + ';color:' + (on ? '#4ade80' : '#7a9a7a') + ';">' + lbl + '</button>';
    }).join('') + '</div>';
  }

  // status: 'g' green, 'y' yellow, 'r' red, '-' unknown/gray
  function _dot(s) { return ({ g: '#22c55e', y: '#f59e0b', r: '#ef4444' })[s] || '#5a7a5a'; }

  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _tile(icon, title, status, value, sub, onclick) {
    var c = _dot(status), tap = !!onclick;
    return '<button ' + (tap ? 'onclick="' + onclick + '"' : 'disabled') + ' style="text-align:left;background:#0f1f0f;border:1.5px solid #1e3a1e;border-left:5px solid ' + c + ';border-radius:12px;padding:13px 14px;cursor:' + (tap ? 'pointer' : 'default') + ';display:flex;align-items:center;gap:12px;width:100%;">' +
      '<span style="font-size:22px;line-height:1;">' + icon + '</span>' +
      '<span style="flex:1;min-width:0;">' +
        '<span style="' + MONO + 'font-size:10px;letter-spacing:1px;color:#8aa88a;text-transform:uppercase;display:block;">' + title + '</span>' +
        '<span style="' + MONO + 'font-size:16px;font-weight:700;color:#f0ead8;">' + value + '</span>' +
        (sub ? '<span style="' + MONO + 'font-size:10px;color:#7a9a7a;margin-left:6px;">' + sub + '</span>' : '') +
      '</span>' +
      (tap ? '<span style="' + MONO + 'font-size:15px;color:#4a7a4a;">›</span>' : '') +
      '<span style="width:14px;height:14px;border-radius:50%;background:' + c + ';box-shadow:0 0 8px ' + c + ';flex-shrink:0;"></span>' +
    '</button>';
  }

  // Tiny inline bar sparkline for a 7-value series.
  function _spark(vals, color) {
    var max = Math.max.apply(null, vals.concat([1]));
    var bw = 15, gap = 4, h = 30;
    var bars = vals.map(function (v, i) {
      var bh = Math.max(2, Math.round((v / max) * h));
      return '<rect x="' + (i * (bw + gap)) + '" y="' + (h - bh) + '" width="' + bw + '" height="' + bh + '" rx="2" fill="' + color + '" opacity="' + (i === vals.length - 1 ? 1 : 0.55) + '"></rect>';
    }).join('');
    var w = vals.length * (bw + gap) - gap;
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block;">' + bars + '</svg>';
  }

  function _trendRow(icon, label, total, unit, vals, color) {
    var labels = _weekBuckets().map(function (b) { return '<span style="' + MONO + 'font-size:8px;color:#5a7a5a;width:15px;display:inline-block;text-align:center;margin-right:4px;">' + b.lbl + '</span>'; }).join('');
    return '<div style="display:flex;align-items:center;gap:14px;padding:11px 4px;border-bottom:1px solid #16281680;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="' + MONO + 'font-size:10px;letter-spacing:.5px;color:#8aa88a;text-transform:uppercase;">' + icon + ' ' + label + '</div>' +
        '<div style="' + MONO + 'font-size:18px;font-weight:700;color:#f0ead8;">' + total + ' <span style="font-size:10px;color:#7a9a7a;font-weight:400;">' + unit + '</span></div>' +
      '</div>' +
      '<div style="flex-shrink:0;">' + _spark(vals, color) + '<div style="margin-top:2px;">' + labels + '</div></div>' +
    '</div>';
  }

  async function _get(coll, where, order) {
    try {
      if (typeof db === 'undefined' || !db) return [];
      var q = db.collection(coll);
      if (where) q = q.where(where[0], where[1], where[2]);
      var snap = await q.get();
      return snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
    } catch (e) { return []; }
  }

  // ── LIVE (v244): onSnapshot listeners fill _t1cache so the board updates on
  // every tablet the moment data lands — no reopening. openTier1 attaches them;
  // closeTier1 detaches. Snapshots are debounced into one repaint. ──
  var _t1subs = [], _t1listening = false, _t1cache = {}, _t1tick = null, _t1RAF = null;
  function _t1Listen() {
    if (_t1listening || typeof db === 'undefined' || !db) return;
    _t1listening = true;
    var b = _weekBuckets(); var ws = b[0].date; var wsMs = new Date(ws + 'T00:00:00').getTime(); var t = _today();
    function sub(key, q) {
      try { _t1subs.push(q.onSnapshot(function (snap) { _t1cache[key] = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); }); _t1Redraw(); }, function (e) { console.warn('tier1 ' + key + ':', e); })); }
      catch (e) { console.warn('tier1 sub ' + key + ':', e); }
    }
    sub('barnWalks', db.collection('barnWalks').where('date', '>=', ws));
    sub('morningWalks', db.collection('morningWalks').where('date', '>=', ws));
    sub('eggDailyRun', db.collection('eggDailyRun').where('date', '>=', ws));
    sub('processingLog', db.collection('processingLog').where('date', '>=', ws));
    sub('mortalityLog', db.collection('mortalityLog').where('date', '>=', ws));
    sub('pmHistory', db.collection('pmHistory').where('ts', '>=', wsMs));
    sub('maintProjects', db.collection('maintProjects'));
    sub('tierExternal', db.collection('tierExternal'));
    sub('feedMade', db.collection('feedMade').where('date', '>=', ws));
    sub('eggFlow', db.collection('eggFlow').where('date', '>=', ws));   // belt run minutes (Danville)
    try { _t1subs.push(db.collection('safetySettings').doc('main').onSnapshot(function (doc) { _t1cache.safety = doc.exists ? [doc.data()] : []; _t1Redraw(); })); } catch (e) {}
    // App globals (workOrders / ALL_PM / partsInventory) update in their own
    // listeners — repaint every 30s while open so those tiles stay fresh too.
    _t1tick = setInterval(function () { var o = document.getElementById('tier1-overlay'); if (o && o.style.display !== 'none') _t1draw(); else { clearInterval(_t1tick); _t1tick = null; } }, 30000);
  }
  function _t1Unlisten() { _t1subs.forEach(function (u) { try { u(); } catch (e) {} }); _t1subs = []; _t1listening = false; if (_t1tick) { clearInterval(_t1tick); _t1tick = null; } }
  function _t1Redraw() { if (_t1RAF) return; _t1RAF = setTimeout(function () { _t1RAF = null; _t1draw(); }, 120); }
  function renderTier1() { _t1Listen(); _t1draw(); }   // back-compat entry (tier1Site)

  function _t1draw() {
    var o = _ov();
    if (o.style.display === 'none') return;
    var t = _today();
    var buckets = _weekBuckets();
    var weekStart = buckets[0].date;
    var weekStartMs = new Date(weekStart + 'T00:00:00').getTime();

    var weekChecks = (_t1cache.barnWalks || []).slice(), mwalks = (_t1cache.morningWalks || []).slice(),
        weekEgg = (_t1cache.eggDailyRun || []).slice(), weekPack = (_t1cache.processingLog || []).slice(),
        weekMort = (_t1cache.mortalityLog || []).slice(), weekPM = (_t1cache.pmHistory || []).slice(),
        projects = (_t1cache.maintProjects || []).slice();
    // Farm-record numbers pushed daily by the Command Center (tierExternal).
    var ext = {}, extUpdated = '';
    (_t1cache.tierExternal || []).forEach(function (d) {
      try { ext[d._id] = JSON.parse(d.json || '{}'); if (d.updated > extUpdated) extUpdated = d.updated; } catch (e) {}
    });
    var weekFeed = (_t1cache.feedMade || []).slice();
    var safety = _t1cache.safety || [];

    // ── Scope everything to the selected site tab (each tab = one site) ──
    var S = _t1SiteInit();
    function _fOK(v) { return S === 'All' || !v || v === S || v === 'Both'; }
    if (S !== 'All') {
      weekChecks = weekChecks.filter(function (c) { return c.farm === S; });
      mwalks = mwalks.filter(function (w) { return w.farm === S; });
      weekMort = weekMort.filter(function (m) { return m.farm === S; });
      weekEgg = weekEgg.filter(function (r) { return _fOK(r.farm); });
      weekPack = weekPack.filter(function (r) { return _fOK(r.farm || r.plant); });
      weekFeed = weekFeed.filter(function (r) { return _fOK(r.farm); });
      weekPM = weekPM.filter(function (x) { return _fOK(x.farm); });
      var _only = {}; if (ext[S]) _only[S] = ext[S]; ext = _only;
    }

    // ── Day scoping w/ YESTERDAY FALLBACK (v246): the NOW tiles read today, but
    // first thing in the morning today is empty — so if nothing's entered today
    // yet, fall back to yesterday's completed data and label it, instead of a
    // blank board. Lay/Birds/Safety (farm records) + WO/PM/Parts are always
    // current and unaffected.
    var _yd = (function () { var d = new Date(); d.setDate(d.getDate() - 1); return _dayStr(d); })();
    var _todayHasData = weekChecks.some(function (c) { return c.date === t; }) || weekEgg.some(function (r) { return r.date === t; }) || weekPack.some(function (r) { return r.date === t; });
    var effDay = _todayHasData ? t : _yd;
    var _dayLbl = _todayHasData ? '' : L(' · yesterday', ' · ayer');
    var checks = weekChecks.filter(function (c) { return c.date === effDay; });
    var eggRun = weekEgg.filter(function (r) { return r.date === effDay; });
    var packLog = weekPack.filter(function (r) { return r.date === effDay; });
    mwalks = mwalks.filter(function (w) { return w.date === effDay; });
    var hasChecks = checks.length > 0;

    // ── App globals (scoped to the site tab too) ──
    var WOs = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
    if (S !== 'All') WOs = WOs.filter(function (w) { return w && _fOK(w.farm); });
    var openWO = WOs.filter(function (w) { return w && w.status !== 'completed'; });
    var urgentWO = openWO.filter(function (w) { var p = (w.priority || '').toLowerCase(); return p === 'urgent' || p === 'high'; });
    var woOpenedWk = WOs.filter(function (w) { return w && Number(w.ts) >= weekStartMs; }).length;
    var pmOverdue = 0;
    try {
      if (typeof ALL_PM !== 'undefined' && typeof pmStatus === 'function') {
        pmOverdue = ALL_PM.filter(function (p) {
          if (S !== 'All' && !((p.farms || []).indexOf(S) !== -1 || p.farm === S || (!p.farms && !p.farm))) return false;
          return pmStatus(p.id) === 'overdue';
        }).length;
      }
    } catch (e) {}
    var critParts = 0;
    try { if (typeof partsInventory !== 'undefined' && partsInventory) { Object.keys(partsInventory).forEach(function (k) { var p = partsInventory[k] || {}; if ((Number(p.qty) || 0) <= (Number(p.min) || 1)) critParts++; }); } } catch (e) {}
    var openProj = projects.filter(function (p) { return p && p.status !== 'done' && p.status !== 'completed' && _fOK(p.farm); }).length;

    // ── Active houses (FARM_HOUSES holds arrays of house names, not counts) ──
    var FH = (typeof FARM_HOUSES !== 'undefined') ? FARM_HOUSES : { Hegins: ['1','2','3','4','5','6','7','8'], Danville: ['1','2','3','4','5'] };
    var totalHouses = 0;
    Object.keys(FH).forEach(function (f) {
      if (f === 'Processing Plant') return;
      if (S !== 'All' && f !== S) return;
      var arr = Array.isArray(FH[f]) ? FH[f] : [];
      arr.forEach(function (h) {
        var num = String(h).replace(/^\s*house\s*/i, '').trim();
        if (!(typeof isHouseDown === 'function' && isHouseDown(f, num))) totalHouses++;
      });
    });

    // ── TODAY metrics ──
    // Production: count only SUBMITTED (pct≥100) house checks, matching completion.js
    var doneToday = {}; checks.forEach(function (c) { if ((Number(c.pct) || 0) >= 100) doneToday[c.farm + '-' + c.house] = 1; });
    var prodDone = Object.keys(doneToday).length;
    var prodPct = totalHouses ? Math.round(prodDone / totalHouses * 100) : 0;
    // No app house data for this site (e.g. Turbotville) → gray, not red.
    var prodS = totalHouses === 0 ? '-' : (prodPct >= TH.prodG ? 'g' : prodPct >= TH.prodY ? 'y' : 'r');

    // Mortality today (from today's checks): total + worst single house
    var mortToday = checks.reduce(function (s, c) { return s + (Number(c.mortCount) || 0); }, 0);
    var mortWorst = checks.reduce(function (m, c) { return Math.max(m, Number(c.mortCount) || 0); }, 0);
    var mortS = !hasChecks ? '-' : (mortWorst >= TH.mortHouseR ? 'r' : mortWorst >= TH.mortHouseY ? 'y' : 'g');

    // Safety: the Command Center's DAYS SAFE is the source of truth (same number
    // as the printed huddle boards — worst/lowest across farms). Falls back to
    // the app's own safetySettings only if the sync hasn't run.
    var safeDays = null;
    Object.keys(ext).forEach(function (k) { var ds = ext[k] && ext[k].daysSafe; if (ds != null && (safeDays == null || ds < safeDays)) safeDays = ds; });
    if (safeDays == null && safety[0] && safety[0].lastIncidentDate) { try { safeDays = Math.floor((Date.now() - new Date(safety[0].lastIncidentDate).getTime()) / 86400000); } catch (e) {} }
    var safeS = safeDays == null ? '-' : (safeDays >= TH.safeDaysG ? 'g' : safeDays >= TH.safeDaysY ? 'y' : 'r');

    // ── EGGS/HOUR vs TARGET (the productivity KPI) ─────────────────────────
    // Hegins packs on 2 machines (eggDailyRun run minutes); Danville's belts run
    // per house (eggFlow minutes). Either way: eggs ÷ run hours, today first and
    // this week as the fallback so the tile is never blank mid-morning.
    var rateS = '-', rateDay = null, rateWk = null, rateTgt = null, rateGoal = null, rateSub = '', rateDayLbl = '';
    (function () {
      if (S === 'All') return;                                  // per-plant KPI
      var conf = EGG_RATE_TARGET[S]; if (!conf) return;
      rateTgt = conf.target; rateGoal = conf.goal6;
      // Eggs that came off the houses (farm records) → cases.
      var eggsDay = 0;
      try { (ext[S] && ext[S].houses || []).forEach(function (x) { eggsDay += Number(x.eggsPerDay) || 0; }); } catch (e) {}
      if (!eggsDay) return;
      var casesDay = eggsDay / EGGS_PER_CASE_T1;
      // Run minutes per DAY: Hegins = packing machines, Danville = house belts.
      var byDate = {};
      var rows = (S === 'Hegins') ? weekEgg : (_t1cache.eggFlow || []);
      var minField = (S === 'Hegins') ? 'manualMin' : 'minutes';
      rows.forEach(function (r) {
        var m = Number(r[minField]) || 0; if (m <= 0 || m > 960) return;   // drop forgotten-Stop runs
        if (!r.date) return;
        byDate[r.date] = (byDate[r.date] || 0) + m;
      });
      var days = Object.keys(byDate).sort();
      if (!days.length) return;
      // DAILY = today if it has runs, else the latest day that does.
      var pick = (byDate[t] != null) ? t : days[days.length - 1];
      rateDay = Math.round(casesDay / (byDate[pick] / 60) * 10) / 10;
      rateDayLbl = (pick === t) ? L('today', 'hoy') : (pick.slice(5).replace('-', '/'));
      // WEEKLY = average of each day's cases/hour across the days logged.
      var per = days.map(function (d) { return casesDay / (byDate[d] / 60); });
      rateWk = Math.round(per.reduce(function (a, b) { return a + b; }, 0) / per.length * 10) / 10;
      // Pass/fail on the WEEKLY average (one slow day shouldn't flip the light).
      rateS = (rateWk >= rateTgt) ? 'g' : (rateWk >= rateTgt * 0.95 ? 'y' : 'r');
      rateSub = L('wk avg ', 'prom sem ') + rateWk + ' · ' + L('target ', 'meta ') + rateTgt;
    })();

    // Mill: feed made (tons) — from the app's own Feed Made records
    var millToday = 0, millWk = 0;
    weekFeed.forEach(function (r) { var tn = Number(r.tons) || 0; millWk += tn; if (r.date === t) millToday += tn; });
    millToday = Math.round(millToday * 10) / 10; millWk = Math.round(millWk * 10) / 10;
    var millS = millWk === 0 ? '-' : (millToday > 0 ? 'g' : 'y');

    // Lay % + live birds (farm records via tierExternal; lay values are fractions).
    // Per-farm breakdown shown on the tiles so a big combined number can never be
    // misread as one farm (1.5M = ALL farms, not Danville). Lay prefers the 7-day
    // avg — steadier when a farm's sheet has blank days.
    var birdsTotal = 0, layNum = 0, layDen = 0, birdBits = [], layBits = [];
    function _abbr(k) { return ({ Hegins: 'Heg', Danville: 'Dan', Turbotville: 'Tur' })[k] || k.slice(0, 3); }
    function _pctOf(v) { if (v == null) return null; return Math.round((v <= 2 ? v * 100 : v) * 10) / 10; }
    Object.keys(ext).sort().forEach(function (k) {
      var fl = ext[k] && ext[k].flock;
      if (fl && fl.birds) {
        birdsTotal += fl.birds;
        birdBits.push(_abbr(k) + ' ' + Math.round(fl.birds / 1000) + 'k');
        var lay = (fl.lay7d != null ? fl.lay7d : fl.layLatest);
        var lp = _pctOf(lay);
        if (lay != null) { layNum += lay * fl.birds; layDen += fl.birds; layBits.push(_abbr(k) + ' ' + Math.round(lp) + '%'); }
      }
    });
    var layPct = null;
    if (layDen) {
      var raw = layNum / layDen;               // weighted avg; sheets store fractions (0.90 = 90%)
      layPct = Math.round((raw <= 2 ? raw * 100 : raw) * 10) / 10;
    }
    var layS = layPct == null ? '-' : (layPct >= 85 ? 'g' : layPct >= 75 ? 'y' : 'r');

    // Egg flow today (processed)
    var eggsToday = eggRun.reduce(function (s, r) { return s + (Number(r.eggs) || 0); }, 0);
    var eggS = eggsToday > 0 ? 'g' : '-';

    // Feed / Water / Quality (only meaningful once checks exist)
    var feedBad = checks.filter(function (c) { return c.feed === 'empty' || (c.flags || []).some(function (f) { return /feed/i.test(f); }); }).length;
    var feedS = !hasChecks ? '-' : (feedBad === 0 ? 'g' : feedBad <= TH.feedY ? 'y' : 'r');
    var waterBad = mwalks.filter(function (w) { return (w.waterPSI != null && Number(w.waterPSI) < 20); }).length +
      checks.filter(function (c) { return (c.flags || []).some(function (f) { return /water/i.test(f); }); }).length;
    var waterS = (!hasChecks && !mwalks.length) ? '-' : (waterBad === 0 ? 'g' : waterBad <= TH.waterY ? 'y' : 'r');

    // ── 💧 WATER VOLUME + 🌾 FEED ON HAND (v272) — real numbers off the Morning
    // Walk (waterUsedGal / binA+binB tons), not just "is there a problem".
    // A water DROP is the earliest bird-health signal we have, so it drives the
    // tile colour: >25% under this site's own 7-day average = red.
    // Readings come from BOTH the Morning Walk and the crew's Daily EE Check
    // (v272) — each record's waterUsedGal is measured against the reading before
    // it, so summing them gives the day's true total without double counting.
    var _wkMW = (_t1cache.morningWalks || []).filter(function (w) { return S === 'All' || w.farm === S; })
      .concat(weekChecks || []);
    var _todayReads = mwalks.concat(checks || []);
    var galToday = 0, galHouses = {};
    _todayReads.forEach(function (w) { var g = Number(w.waterUsedGal); if (g > 0) { galToday += g; galHouses[w.farm + '-' + w.house] = 1; } });
    galHouses = Object.keys(galHouses).length;
    var _byDayGal = {};
    _wkMW.forEach(function (w) { var g = Number(w.waterUsedGal); if (g > 0 && w.date) _byDayGal[w.date] = (_byDayGal[w.date] || 0) + g; });
    var _galDays = Object.keys(_byDayGal).filter(function (d) { return d !== t; });
    var galAvg = _galDays.length ? Math.round(_galDays.reduce(function (s, d) { return s + _byDayGal[d]; }, 0) / _galDays.length) : null;
    var galDrop = (galAvg && galToday > 0) ? Math.round((galToday - galAvg) / galAvg * 100) : null;
    if (galToday > 0 && galDrop != null && galDrop <= -25) waterS = 'r';
    else if (galToday > 0 && galDrop != null && galDrop <= -10 && waterS === 'g') waterS = 'y';
    // ── Daily-entry COVERAGE (Joe 2026-08-07: "track water entry every day from
    // Hegins and total gallons captured for the Tier 1 meeting"). A read house =
    // any house with a meter reading TODAY (morning walk or EE check). Missing
    // houses are the point — a total means nothing if 3 barns never got read.
    var _expHouses = {};
    try {
      var _sites = (S === 'All') ? ['Hegins', 'Danville'] : [S];
      _sites.forEach(function (fm) {
        var arr = (typeof FARM_HOUSES !== 'undefined' && FARM_HOUSES[fm]) ? FARM_HOUSES[fm] : [];
        arr.forEach(function (h) {
          var n = String(h).replace(/^\s*house\s*/i, '').trim();
          if (typeof isHouseDown === 'function' && isHouseDown(fm, n)) return;
          _expHouses[fm + '-' + n] = 1;
        });
      });
    } catch (eH) {}
    var waterExp = Object.keys(_expHouses).length;
    var _readSet = {}, _meterSeen = 0;
    _todayReads.forEach(function (w) {
      if (w.waterMeter == null && !w.waterMeters) return;
      _readSet[w.farm + '-' + w.house] = 1; _meterSeen++;
    });
    var waterRead = Object.keys(_readSet).length;
    // colour also reflects COVERAGE: a day with houses unread can't be green.
    if (waterExp && waterRead < waterExp) {
      var _missFrac = (waterExp - waterRead) / waterExp;
      if (_missFrac >= 0.5 && waterS !== 'r') waterS = 'r';
      else if (waterS === 'g') waterS = 'y';
    }
    var waterVal = galToday > 0 ? (_num(galToday) + ' gal')
                 : (waterRead ? L('no usage yet', 'sin uso aún')
                 : (waterBad === 0 ? L('OK', 'OK') : waterBad + ' ' + L('issues', 'problemas')));
    var waterCov = waterExp ? (waterRead + '/' + waterExp + ' ' + L('houses read', 'casas leídas')) : '';
    var waterSub = (waterCov ? waterCov : (galHouses + ' ' + L('houses', 'casas'))) +
      (galAvg ? (' · ' + L('7d avg ', 'prom 7d ') + _num(galAvg) + (galDrop != null ? (' · ' + (galDrop >= 0 ? '▲' : '▼') + Math.abs(galDrop) + '%') : '')) : '') +
      (!waterRead && waterBad ? (' · ' + L('PSI / flags', 'PSI / alertas')) : '') +
      (!waterRead && !waterBad ? (' · ' + L('no meter reading yet', 'sin lectura del medidor')) : '');
    // Feed tons on hand = NEWEST bin reading per house today (A + B), morning
    // walk or EE check, whichever was entered last.
    var _tons = {}, _tonsTs = {};
    _todayReads.forEach(function (w) {
      var a = Number(w.binA), b = Number(w.binB);
      if (isNaN(a) && isNaN(b)) return;
      var k = w.farm + '-' + w.house, ts = Number(w.ts) || 0;
      if (_tonsTs[k] != null && ts < _tonsTs[k]) return;
      _tonsTs[k] = ts;
      _tons[k] = (isNaN(a) ? 0 : a) + (isNaN(b) ? 0 : b);
    });
    var _tonsLow = Object.keys(_tons).filter(function (k) { return _tons[k] < 2; }).length;
    var tonsOnHand = Object.keys(_tons).reduce(function (s, k) { return s + _tons[k]; }, 0);
    var tonsHouses = Object.keys(_tons).length;
    if (_tonsLow > 0 && feedS === 'g') feedS = 'y';
    var feedVal = tonsHouses ? (Math.round(tonsOnHand * 10) / 10 + ' ' + L('tons', 'ton'))
                : (!hasChecks ? '—' : (feedBad === 0 ? L('OK', 'OK') : feedBad + ' ' + L('low', 'bajo')));
    var feedSub = tonsHouses
      ? (L('on hand · ', 'en tolvas · ') + tonsHouses + ' ' + L('houses', 'casas') + (_tonsLow ? (' · ' + _tonsLow + ' ' + L('under 2 tons', 'bajo 2 ton')) : ''))
      : (feedBad ? L('feeders / bins flagged', 'comederos / tolvas') : '');
    var flagCount = checks.reduce(function (s, c) { return s + ((c.flags && c.flags.length) || 0); }, 0);
    var qualS = !hasChecks ? '-' : (flagCount === TH.qualG ? 'g' : flagCount <= TH.qualY ? 'y' : 'r');

    // Downtime today
    var dtMin = packLog.reduce(function (s, r) { return s + (Number(r.downtimeMin) || 0); }, 0);
    var dtS = packLog.length === 0 ? '-' : (dtMin <= TH.dtG ? 'g' : dtMin <= TH.dtY ? 'y' : 'r');

    var pmS = pmOverdue === 0 ? 'g' : pmOverdue <= TH.pmY ? 'y' : 'r';
    var woS = urgentWO.length ? 'r' : (openWO.length > TH.woOpenY ? 'y' : 'g');
    var partsS = critParts === 0 ? 'g' : 'r';

    var GM = "closeTier1();typeof go==='function'&&go('maint');";
    var tiles = [
      _tile('🦺', L('Safety', 'Seguridad'), safeS, safeDays == null ? '—' : (safeDays + ' ' + L('days safe', 'días')), '', ''),
      _tile('🐣', L('Lay Rate', 'Postura'), layS, layPct == null ? '—' : (layPct + '%'), layPct == null ? L('no farm data', 'sin datos') : (S === 'All' ? layBits.join(' · ') : L('flock avg 7d', 'prom 7d')), ''),
      _tile('🐥', L('Live Birds', 'Aves Vivas'), birdsTotal > 0 ? 'g' : '-', birdsTotal > 0 ? _num(birdsTotal) : '—', S === 'All' ? birdBits.join(' · ') : S, ''),
      _tile('🐔', L('Production', 'Producción'), prodS, totalHouses === 0 ? '—' : (prodDone + '/' + totalHouses), totalHouses === 0 ? L('no house checks here', 'sin revisiones aquí') : (L('houses', 'casas') + ' · ' + prodPct + '%'), "closeTier1();typeof openCompletion==='function'&&openCompletion()"),
      _tile('💀', L('Mortality', 'Mortalidad'), mortS, !hasChecks ? '—' : String(mortToday), !hasChecks ? L('no checks yet', 'sin revisiones') : (L('worst house', 'peor casa') + ' ' + mortWorst), "closeTier1();typeof openCompletion==='function'&&openCompletion()"),
      _tile('✅', L('Quality', 'Calidad'), qualS, !hasChecks ? '—' : (flagCount + ' ' + L('flags', 'alertas')), L('today', 'hoy'), ''),
      _tile('🥚', L('Egg Flow', 'Flujo Huevos'), eggS, eggsToday > 0 ? _num(eggsToday) : '—', eggsToday > 0 ? L('processed', 'procesados') : L('no run yet', 'sin corrida'), "closeTier1();typeof openProcessing==='function'&&openProcessing()"),
      _tile('🌽', L('Feed', 'Alimento'), feedS, feedVal, feedSub, ''),
      _tile('📦', L('Cases / Hour', 'Cajas / Hora'), rateS,
            rateDay == null ? '—' : (rateDay + ' ' + L('cases/hr', 'cajas/hr')),
            rateDay == null ? L('no run data yet', 'sin datos de corrida') : (rateDayLbl + ' · ' + rateSub),
            "closeTier1();typeof openProcessing==='function'&&openProcessing()"),
      _tile('🌾', L('Mill Output', 'Molino'), millS, millWk === 0 ? '—' : (millToday + ' ' + L('tons today', 'ton hoy')), millWk === 0 ? L('no data yet', 'sin datos aún') : (millWk + ' ' + L('tons this week', 'ton semana')), ''),
      _tile('💧', L('Water', 'Agua'), waterS, (!hasChecks && !mwalks.length) ? '—' : waterVal, waterSub, ''),
      _tile('⏱', L('Downtime', 'Paro'), dtS, packLog.length === 0 ? '—' : (dtMin + ' min'), L('packing today', 'empaque hoy'), ''),
      _tile('📋', L('Past Due PMs', 'PM Vencidos'), pmS, String(pmOverdue), L('overdue', 'vencidos'), GM + "setTimeout(function(){typeof goMaintSection==='function'&&goMaintSection('pm')},150)"),
      _tile('🔧', L('Open WO', 'OT Abiertas'), woS, String(openWO.length), urgentWO.length ? (urgentWO.length + ' ' + L('urgent', 'urgente')) : L('none urgent', 'ninguna urgente'), GM),
      _tile('🗂', L('Open Projects', 'Proyectos'), openProj > 0 ? 'y' : 'g', String(openProj), L('open', 'abiertos'), GM + "setTimeout(function(){typeof goMaintSection==='function'&&goMaintSection('projects')},150)"),
      _tile('🔩', L('Critical Parts', 'Piezas Críticas'), partsS, String(critParts), L('at/below min', 'en/bajo mín'), GM + "setTimeout(function(){typeof goMaintSection==='function'&&goMaintSection('parts')},150)")
    ].join('');

    // ── WEEK trends (7-day series) ──
    function _series(map) { return buckets.map(function (b) { return map[b.date] || 0; }); }
    var eggMap = {}; weekEgg.forEach(function (r) { eggMap[r.date] = (eggMap[r.date] || 0) + (Number(r.eggs) || 0); });
    var mortMap = {}; weekMort.forEach(function (r) { if (r.type === 'mortality') mortMap[r.date] = (mortMap[r.date] || 0) + (Number(r.mortCount) || 0); });
    var dtMap = {}; weekPack.forEach(function (r) { dtMap[r.date] = (dtMap[r.date] || 0) + (Number(r.downtimeMin) || 0); });
    var chkMap = {}; weekChecks.forEach(function (c) { if ((Number(c.pct) || 0) >= 100) { chkMap[c.date] = (chkMap[c.date] || 0) + 1; } });

    var eggWk = weekEgg.reduce(function (s, r) { return s + (Number(r.eggs) || 0); }, 0);
    var mortWk = weekMort.reduce(function (s, r) { return r.type === 'mortality' ? s + (Number(r.mortCount) || 0) : s; }, 0);
    var dtWk = weekPack.reduce(function (s, r) { return s + (Number(r.downtimeMin) || 0); }, 0);
    var chkWk = Object.keys(chkMap).reduce(function (s, k) { return s + chkMap[k]; }, 0);
    var flagsWk = weekChecks.reduce(function (s, c) { return s + ((c.flags && c.flags.length) || 0); }, 0);
    var galWk = Object.keys(_byDayGal).reduce(function (a, d) { return a + _byDayGal[d]; }, 0);
    var flagHouses = {}; weekChecks.forEach(function (c) { if (c.flags && c.flags.length) flagHouses[c.farm + '-' + c.house] = 1; });

    var trends =
      _trendRow('🥚', L('Eggs processed', 'Huevos procesados'), _num(eggWk), L('this week', 'esta semana'), _series(eggMap), '#eab308') +
      _trendRow('💀', L('Mortality', 'Mortalidad'), _num(mortWk), L('birds this week', 'aves esta semana'), _series(mortMap), '#ef4444') +
      _trendRow('🐔', L('Checks completed', 'Revisiones'), String(chkWk), L('this week', 'esta semana'), _series(chkMap), '#22c55e') +
      _trendRow('⏱', L('Packing downtime', 'Paro empaque'), _num(dtWk), L('min this week', 'min esta semana'), _series(dtMap), '#f59e0b') +
      // 💧 TOTAL GALLONS captured per day — the Tier 1 water number (v279).
      _trendRow('💧', L('Water captured', 'Agua registrada'), _num(galWk), L('gal this week', 'gal esta semana'), _series(_byDayGal), '#38bdf8');

    // ── WEEK digest (what happened / open risks) ──
    function _dg(icon, txt) { return '<div style="display:flex;gap:9px;padding:8px 2px;border-bottom:1px solid #16281680;' + MONO + 'font-size:12px;color:#cbe0cb;"><span>' + icon + '</span><span>' + txt + '</span></div>'; }
    var incidentThisWk = safety[0] && safety[0].lastIncidentDate && (String(safety[0].lastIncidentDate).slice(0, 10) >= weekStart);
    var digest =
      _dg(incidentThisWk ? '🟥' : '🦺', incidentThisWk
          ? L('Safety incident logged this week', 'Incidente de seguridad esta semana')
          : (safeDays == null ? L('No incident date set', 'Sin fecha de incidente') : (safeDays + L(' days with no incident', ' días sin incidente')))) +
      _dg('🐔', chkWk + L(' house checks completed', ' revisiones completadas')) +
      _dg('💀', _num(mortWk) + L(' birds mortality logged', ' aves de mortalidad')) +
      _dg('🥚', _num(eggWk) + L(' eggs processed', ' huevos procesados')) +
      _dg('⚠️', flagsWk + L(' flags across ', ' alertas en ') + Object.keys(flagHouses).length + L(' houses', ' casas')) +
      _dg('⏱', _num(dtWk) + L(' min packing downtime', ' min de paro en empaque')) +
      _dg('💧', _num(galWk) + L(' gallons of water captured · ', ' galones de agua registrados · ') + waterRead + '/' + waterExp + L(' houses read today', ' casas leídas hoy')) +
      _dg('🔧', woOpenedWk + L(' work orders opened · ', ' OT abiertas · ') + openWO.length + L(' still open', ' aún abiertas')) +
      _dg('📋', weekPM.length + L(' PMs completed · ', ' PM completados · ') + pmOverdue + L(' overdue now', ' vencidos ahora')) +
      _dg(critParts ? '🟥' : '🔩', critParts + L(' parts at/below minimum', ' piezas en/bajo mínimo')) +
      (extUpdated ? _dg('📡', L('Farm records synced ', 'Registros sincronizados ') + extUpdated) : '');

    // ── 🧠 IMPROVEMENT NOTES (auto) — for the tier walk (Joe 2026-08-03/06):
    // reads the same data as the tiles and says WHAT to improve, in plain words,
    // worst first. Site-scoped like everything else on this board.
    var notes = [];
    try {
      // 1) Eggs not hitting target
      if (rateTgt && rateWk != null && rateWk < rateTgt) {
        var pctOf = Math.round(rateWk / rateTgt * 100);
        notes.push({ sev: rateWk < rateTgt * 0.95 ? 'r' : 'y',
          txt: '📦 ' + L('Cases/hr below target: ', 'Cajas/hr bajo la meta: ') + rateWk + ' vs ' + rateTgt + ' (' + pctOf + '%). ' +
               L('Find the slowest day this week and ask what stopped the line.', 'Encuentra el día más lento de la semana y pregunta qué paró la línea.') });
      }
      // 2) Repeat WOs — same farm+house+problem 2+ times in 14 days
      var _wo14 = Date.now() - 14 * 86400000, _grp = {};
      WOs.forEach(function (w) {
        if ((w.ts || 0) < _wo14) return;
        if (S !== 'All' && w.farm !== S && !(S === 'Danville' && w.farm === 'Processing Plant')) return;
        var k = (w.farm || '?') + '|' + (w.house || '—') + '|' + (w.problem || w.desc || '?');
        (_grp[k] = _grp[k] || { farm: w.farm, house: w.house, problem: w.problem || w.desc, n: 0, open: 0 });
        _grp[k].n++; if (w.status !== 'completed') _grp[k].open++;
      });
      Object.keys(_grp).map(function (k) { return _grp[k]; })
        .filter(function (g) { return g.n >= 2; })
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 3)
        .forEach(function (g) {
          notes.push({ sev: g.open ? 'r' : 'y',
            txt: '🔁 ' + _esc(g.problem) + ' — ' + g.farm + (g.house ? ' H' + g.house : '') + ' — ' + g.n + '× ' + L('in 14 days. Fix the CAUSE, assign one owner.', 'en 14 días. Arregla la CAUSA, asigna un dueño.') });
        });
      // 3) Houses flagged repeatedly this week
      var _fh = {};
      weekChecks.forEach(function (c) { if (c.flags && c.flags.length) { var k = (c.farm || '?') + ' H' + c.house; _fh[k] = (_fh[k] || 0) + c.flags.length; } });
      Object.keys(_fh).filter(function (k) { return _fh[k] >= 3; }).sort(function (a, b) { return _fh[b] - _fh[a]; }).slice(0, 2)
        .forEach(function (k) { notes.push({ sev: 'y', txt: '⚠ ' + k + ' — ' + _fh[k] + ' ' + L('flags this week. Walk that house today.', 'alertas esta semana. Camina esa casa hoy.') }); });
      // 4) Low-producing houses (laying but under 85%)
      Object.keys(ext).forEach(function (fm) {
        if (S !== 'All' && fm !== S) return;
        ((ext[fm] && ext[fm].houses) || []).forEach(function (h) {
          var lay = (h.lay7d != null ? h.lay7d : h.layLatest);
          if (lay != null && lay > 2) lay = lay / 100;
          if (lay != null && lay >= 0.20 && lay < 0.85 && !/flock out|down/i.test(String(h.note || ''))) {
            notes.push({ sev: 'y', txt: '🥚 ' + fm + ' ' + _esc(h.name || '?') + ' — ' + Math.round(lay * 1000) / 10 + '% ' + L('lay. Check feed, water and light before it slides further.', 'postura. Revisa alimento, agua y luz antes de que baje más.') });
          }
        });
      });
      // 4b) Water not entered everywhere today — the daily-entry discipline note.
      if (waterExp && waterRead < waterExp) {
        var _missN = waterExp - waterRead;
        notes.push({ sev: (_missN / waterExp) >= 0.5 ? 'r' : 'y',
          txt: '💧 ' + L('Water meters not read in ', 'Medidores de agua sin leer en ') + _missN + L(' of ', ' de ') + waterExp + L(' houses today — no reading means no usage number and no early warning if birds stop drinking.', ' casas hoy — sin lectura no hay número de uso ni aviso temprano si las aves dejan de beber.') });
      }
      // 5) Runs left open (forgot Stop)
      var _stuck = (_t1cache.eggFlow || []).filter(function (f) {
        return (S === 'All' || f.farm === S) && f.status !== 'done' && f.startTs && (Date.now() - f.startTs) > 8 * 3600000;
      }).length;
      if (_stuck) notes.push({ sev: 'y', txt: '⏱ ' + _stuck + ' ' + L('egg-flow run(s) left open >8h — coach the Stop tap at the huddle.', 'corrida(s) abiertas >8h — recuerda el botón Detener en la reunión.') });
      // 6) Overdue PMs
      if (pmOverdue > 3) notes.push({ sev: 'y', txt: '📋 ' + pmOverdue + ' ' + L('PMs overdue — 15 minutes of PM beats a 3-hour breakdown.', 'PM vencidos — 15 minutos de PM ganan a 3 horas de avería.') });
    } catch (eN) { console.warn('t1 notes:', eN); }
    notes.sort(function (a, b) { return (a.sev === 'r' ? 0 : 1) - (b.sev === 'r' ? 0 : 1); });
    var notesHtml = notes.slice(0, 6).map(function (n) {
      return '<div style="display:flex;gap:9px;padding:8px 2px;border-bottom:1px solid #16281680;' + MONO + 'font-size:12px;line-height:1.5;color:' + (n.sev === 'r' ? '#f0a0a0' : '#e8c96a') + ';"><span>' + (n.sev === 'r' ? '🟥' : '🟨') + '</span><span>' + n.txt + '</span></div>';
    }).join('') || '<div style="' + MONO + 'font-size:12px;color:#4ade80;padding:8px 2px;">✅ ' + L('Nothing needs improving today — protect the streak.', 'Nada que mejorar hoy — protege la racha.') + '</div>';

    // ── Overall roll-up (today's status tiles that carry a real state) ──
    var states = [safeS, layS, prodS, mortS, qualS, feedS, millS, rateS, waterS, dtS, pmS, woS, partsS].filter(function (s) { return s !== '-'; });
    var reds = states.filter(function (s) { return s === 'r'; }).length;
    var yels = states.filter(function (s) { return s === 'y'; }).length;
    var overall = reds ? 'r' : yels ? 'y' : 'g';
    var overallTxt = reds ? (reds + ' ' + L('need attention', 'requieren atención')) : yels ? (yels + ' ' + L('to watch', 'a vigilar')) : L('All green', 'Todo en verde');

    // Yesterday-fallback banner above the NOW tiles.
    var dayNote = _todayHasData ? '' :
      '<div style="' + MONO + 'font-size:11px;color:#e8c96a;background:#231a08;border:1.5px solid #7a5a1a;border-radius:10px;padding:9px 12px;margin:2px 0 4px;">🕓 ' +
      L('Showing YESTERDAY (' + _yd.slice(5).replace('-', '/') + ') — nothing entered today yet', 'Mostrando AYER (' + _yd.slice(5).replace('-', '/') + ') — nada ingresado hoy aún') + '</div>';
    o.innerHTML = _shell(null, tiles, overall, overallTxt, trends, digest, dayNote, notesHtml);
  }

  function _sec(label) {
    return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#6aa06a;text-transform:uppercase;margin:22px 2px 9px;font-weight:700;">' + label + '</div>';
  }

  function _shell(loadingMsg, tiles, overall, overallTxt, trends, digest, dayNote, notesHtml) {
    var dot = overall ? _dot(overall) : '#5a7a5a';
    var dateStr = new Date().toLocaleDateString(_es() ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    var head = '<div style="max-width:820px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<div style="display:flex;gap:8px;">' +
          '<button onclick="closeTier1()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + L('Back', 'Atrás') + '</button>' +
          '<button onclick="typeof openTierSW===\'function\'&&openTierSW()" style="padding:11px 14px;background:#1a1408;border:1.5px solid #7a5a1a;border-radius:50px;color:#e8c96a;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">📘 SW</button>' +
          '<button onclick="typeof openTargets===\'function\'&&openTargets()" style="padding:11px 14px;background:#0f1a12;border:1.5px solid #2a7a4a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">🎯 ' + L('Targets','Metas') + '</button>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:2px;line-height:1;color:#f0ead8;">📊 ' + L('TIER 1 BOARD', 'TABLERO TIER 1') + (_t1Site && _t1Site !== 'All' ? ' · ' + _t1Site.toUpperCase() : '') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#7ab07a;margin-top:2px;">' + dateStr + '</div>' +
        '</div>' +
      '</div>' + _t1Tabs();
    if (loadingMsg) return head + '<div style="' + MONO + 'color:#9ac9d6;text-align:center;padding:50px;">' + loadingMsg + '</div></div>';
    return head +
      '<div style="display:flex;align-items:center;gap:10px;background:#0c1a0c;border:1.5px solid ' + dot + ';border-radius:12px;padding:12px 14px;margin:10px 0 4px;">' +
        '<span style="width:16px;height:16px;border-radius:50%;background:' + dot + ';box-shadow:0 0 10px ' + dot + ';"></span>' +
        '<span style="' + MONO + 'font-size:14px;font-weight:700;color:#f0ead8;">' + overallTxt + '</span>' +
      '</div>' +
      _sec(L('Now · tap a tile to open it', 'Ahora · toca para abrir')) +
      (dayNote || '') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:9px;">' + tiles + '</div>' +
      (notesHtml ? (_sec('🧠 ' + L('Improvement notes · auto, for the tier walk', 'Notas de mejora · auto, para el recorrido')) +
        '<div style="background:#0c1a0c;border:1.5px solid #1e3a1e;border-radius:12px;padding:6px 14px;">' + notesHtml + '</div>') : '') +
      _sec(L('This week · trends', 'Esta semana · tendencias')) +
      '<div style="background:#0c1a0c;border:1.5px solid #1e3a1e;border-radius:12px;padding:6px 14px;">' + trends + '</div>' +
      _sec(L('This week · digest', 'Esta semana · resumen')) +
      '<div style="background:#0c1a0c;border:1.5px solid #1e3a1e;border-radius:12px;padding:6px 14px;">' + digest + '</div>' +
      '<div style="margin-top:20px;text-align:center;"><button onclick="closeTier1();typeof openTier2===\'function\'&&openTier2()" style="padding:11px 20px;background:#0d152a;border:1.5px solid #2a4a7a;border-radius:50px;color:#93c5fd;' + MONO + 'font-size:12px;font-weight:700;cursor:pointer;">📈 ' + L('Month view (Tier 2)', 'Vista del mes (Tier 2)') + '</button></div>' +
    '</div>';
  }
})();
