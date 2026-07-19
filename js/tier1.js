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
  window.openTier1 = function () { var o = _ov(); o.style.display = 'block'; try { window.scrollTo(0, 0); } catch (e) {} renderTier1(); };
  window.closeTier1 = function () { var o = document.getElementById('tier1-overlay'); if (o) o.style.display = 'none'; };

  // status: 'g' green, 'y' yellow, 'r' red, '-' unknown/gray
  function _dot(s) { return ({ g: '#22c55e', y: '#f59e0b', r: '#ef4444' })[s] || '#5a7a5a'; }

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

  async function renderTier1() {
    var o = _ov();
    o.innerHTML = _shell(L('Loading live status…', 'Cargando estado…'));
    var t = _today();
    var buckets = _weekBuckets();
    var weekStart = buckets[0].date;
    var weekStartMs = new Date(weekStart + 'T00:00:00').getTime();

    // ── Parallel live pulls (week window; today derived by filter) ──
    var res = await Promise.all([
      _get('barnWalks', ['date', '>=', weekStart]),
      _get('morningWalks', ['date', '==', t]),
      _get('eggDailyRun', ['date', '>=', weekStart]),
      _get('processingLog', ['date', '>=', weekStart]),
      _get('mortalityLog', ['date', '>=', weekStart]),
      _get('pmHistory', ['ts', '>=', weekStartMs]),
      _get('maintProjects'),
      _get('tierExternal')
    ]);
    var weekChecks = res[0], mwalks = res[1], weekEgg = res[2], weekPack = res[3], weekMort = res[4], weekPM = res[5], projects = res[6];
    // Farm-record numbers pushed daily at ~6:05 AM by the Command Center
    // (push_tier_firestore.py): lay %, live birds, days safe, hours, cases.
    var ext = {}, extUpdated = '';
    (res[7] || []).forEach(function (d) {
      try { ext[d._id] = JSON.parse(d.json || '{}'); if (d.updated > extUpdated) extUpdated = d.updated; } catch (e) {}
    });
    var safety = [];
    try { if (typeof db !== 'undefined' && db) { var sd = await db.collection('safetySettings').doc('main').get(); if (sd.exists) safety = [sd.data()]; } } catch (e) {}

    var checks = weekChecks.filter(function (c) { return c.date === t; });
    var eggRun = weekEgg.filter(function (r) { return r.date === t; });
    var packLog = weekPack.filter(function (r) { return r.date === t; });
    var hasChecks = checks.length > 0;

    // ── App globals ──
    var WOs = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
    var openWO = WOs.filter(function (w) { return w && w.status !== 'completed'; });
    var urgentWO = openWO.filter(function (w) { var p = (w.priority || '').toLowerCase(); return p === 'urgent' || p === 'high'; });
    var woOpenedWk = WOs.filter(function (w) { return w && Number(w.ts) >= weekStartMs; }).length;
    var pmOverdue = 0;
    try { if (typeof ALL_PM !== 'undefined' && typeof pmStatus === 'function') pmOverdue = ALL_PM.filter(function (p) { return pmStatus(p.id) === 'overdue'; }).length; } catch (e) {}
    var critParts = 0;
    try { if (typeof partsInventory !== 'undefined' && partsInventory) { Object.keys(partsInventory).forEach(function (k) { var p = partsInventory[k] || {}; if ((Number(p.qty) || 0) <= (Number(p.min) || 1)) critParts++; }); } } catch (e) {}
    var openProj = projects.filter(function (p) { return p && p.status !== 'done' && p.status !== 'completed'; }).length;

    // ── Active houses (FARM_HOUSES holds arrays of house names, not counts) ──
    var FH = (typeof FARM_HOUSES !== 'undefined') ? FARM_HOUSES : { Hegins: ['1','2','3','4','5','6','7','8'], Danville: ['1','2','3','4','5'] };
    var totalHouses = 0;
    Object.keys(FH).forEach(function (f) {
      if (f === 'Processing Plant') return;
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
    var prodS = prodPct >= TH.prodG ? 'g' : prodPct >= TH.prodY ? 'y' : 'r';

    // Mortality today (from today's checks): total + worst single house
    var mortToday = checks.reduce(function (s, c) { return s + (Number(c.mortCount) || 0); }, 0);
    var mortWorst = checks.reduce(function (m, c) { return Math.max(m, Number(c.mortCount) || 0); }, 0);
    var mortS = !hasChecks ? '-' : (mortWorst >= TH.mortHouseR ? 'r' : mortWorst >= TH.mortHouseY ? 'y' : 'g');

    // Safety: days since last incident (falls back to the Command Center's DAYS SAFE)
    var safeDays = null;
    if (safety[0] && safety[0].lastIncidentDate) { try { safeDays = Math.floor((Date.now() - new Date(safety[0].lastIncidentDate).getTime()) / 86400000); } catch (e) {} }
    if (safeDays == null) { Object.keys(ext).forEach(function (k) { var ds = ext[k] && ext[k].daysSafe; if (ds != null && (safeDays == null || ds < safeDays)) safeDays = ds; }); }
    var safeS = safeDays == null ? '-' : (safeDays >= TH.safeDaysG ? 'g' : safeDays >= TH.safeDaysY ? 'y' : 'r');

    // Lay % + live birds (farm records via tierExternal; lay values are fractions)
    var birdsTotal = 0, layNum = 0, layDen = 0;
    Object.keys(ext).forEach(function (k) {
      var fl = ext[k] && ext[k].flock;
      if (fl && fl.birds) {
        birdsTotal += fl.birds;
        var lay = (fl.layLatest != null ? fl.layLatest : fl.lay7d);
        if (lay != null) { layNum += lay * fl.birds; layDen += fl.birds; }
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
      _tile('🐣', L('Lay Rate', 'Postura'), layS, layPct == null ? '—' : (layPct + '%'), layPct == null ? L('no farm data', 'sin datos') : L('flock avg', 'prom parvada'), ''),
      _tile('🐥', L('Live Birds', 'Aves Vivas'), birdsTotal > 0 ? 'g' : '-', birdsTotal > 0 ? _num(birdsTotal) : '—', L('all farms', 'todas granjas'), ''),
      _tile('🐔', L('Production', 'Producción'), prodS, prodDone + '/' + totalHouses, L('houses', 'casas') + ' · ' + prodPct + '%', "closeTier1();typeof openCompletion==='function'&&openCompletion()"),
      _tile('💀', L('Mortality', 'Mortalidad'), mortS, !hasChecks ? '—' : String(mortToday), !hasChecks ? L('no checks yet', 'sin revisiones') : (L('worst house', 'peor casa') + ' ' + mortWorst), "closeTier1();typeof openCompletion==='function'&&openCompletion()"),
      _tile('✅', L('Quality', 'Calidad'), qualS, !hasChecks ? '—' : (flagCount + ' ' + L('flags', 'alertas')), L('today', 'hoy'), ''),
      _tile('🥚', L('Egg Flow', 'Flujo Huevos'), eggS, eggsToday > 0 ? _num(eggsToday) : '—', eggsToday > 0 ? L('processed', 'procesados') : L('no run yet', 'sin corrida'), "closeTier1();typeof openProcessing==='function'&&openProcessing()"),
      _tile('🌽', L('Feed', 'Alimento'), feedS, !hasChecks ? '—' : (feedBad === 0 ? L('OK', 'OK') : feedBad + ' ' + L('low', 'bajo')), '', ''),
      _tile('💧', L('Water', 'Agua'), waterS, (!hasChecks && !mwalks.length) ? '—' : (waterBad === 0 ? L('OK', 'OK') : waterBad + ' ' + L('issues', 'problemas')), '', ''),
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
    var flagHouses = {}; weekChecks.forEach(function (c) { if (c.flags && c.flags.length) flagHouses[c.farm + '-' + c.house] = 1; });

    var trends =
      _trendRow('🥚', L('Eggs processed', 'Huevos procesados'), _num(eggWk), L('this week', 'esta semana'), _series(eggMap), '#eab308') +
      _trendRow('💀', L('Mortality', 'Mortalidad'), _num(mortWk), L('birds this week', 'aves esta semana'), _series(mortMap), '#ef4444') +
      _trendRow('🐔', L('Checks completed', 'Revisiones'), String(chkWk), L('this week', 'esta semana'), _series(chkMap), '#22c55e') +
      _trendRow('⏱', L('Packing downtime', 'Paro empaque'), _num(dtWk), L('min this week', 'min esta semana'), _series(dtMap), '#f59e0b');

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
      _dg('🔧', woOpenedWk + L(' work orders opened · ', ' OT abiertas · ') + openWO.length + L(' still open', ' aún abiertas')) +
      _dg('📋', weekPM.length + L(' PMs completed · ', ' PM completados · ') + pmOverdue + L(' overdue now', ' vencidos ahora')) +
      _dg(critParts ? '🟥' : '🔩', critParts + L(' parts at/below minimum', ' piezas en/bajo mínimo')) +
      (extUpdated ? _dg('📡', L('Farm records synced ', 'Registros sincronizados ') + extUpdated) : '');

    // ── Overall roll-up (today's status tiles that carry a real state) ──
    var states = [safeS, layS, prodS, mortS, qualS, feedS, waterS, dtS, pmS, woS, partsS].filter(function (s) { return s !== '-'; });
    var reds = states.filter(function (s) { return s === 'r'; }).length;
    var yels = states.filter(function (s) { return s === 'y'; }).length;
    var overall = reds ? 'r' : yels ? 'y' : 'g';
    var overallTxt = reds ? (reds + ' ' + L('need attention', 'requieren atención')) : yels ? (yels + ' ' + L('to watch', 'a vigilar')) : L('All green', 'Todo en verde');

    o.innerHTML = _shell(null, tiles, overall, overallTxt, trends, digest);
  }

  function _sec(label) {
    return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#6aa06a;text-transform:uppercase;margin:22px 2px 9px;font-weight:700;">' + label + '</div>';
  }

  function _shell(loadingMsg, tiles, overall, overallTxt, trends, digest) {
    var dot = overall ? _dot(overall) : '#5a7a5a';
    var dateStr = new Date().toLocaleDateString(_es() ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    var head = '<div style="max-width:820px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<div style="display:flex;gap:8px;">' +
          '<button onclick="closeTier1()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + L('Back', 'Atrás') + '</button>' +
          '<button onclick="typeof openTierSW===\'function\'&&openTierSW()" style="padding:11px 14px;background:#1a1408;border:1.5px solid #7a5a1a;border-radius:50px;color:#e8c96a;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">📘 SW</button>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:2px;line-height:1;color:#f0ead8;">📊 ' + L('TIER 1 BOARD', 'TABLERO TIER 1') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#7ab07a;margin-top:2px;">' + dateStr + '</div>' +
        '</div>' +
      '</div>';
    if (loadingMsg) return head + '<div style="' + MONO + 'color:#9ac9d6;text-align:center;padding:50px;">' + loadingMsg + '</div></div>';
    return head +
      '<div style="display:flex;align-items:center;gap:10px;background:#0c1a0c;border:1.5px solid ' + dot + ';border-radius:12px;padding:12px 14px;margin:10px 0 4px;">' +
        '<span style="width:16px;height:16px;border-radius:50%;background:' + dot + ';box-shadow:0 0 10px ' + dot + ';"></span>' +
        '<span style="' + MONO + 'font-size:14px;font-weight:700;color:#f0ead8;">' + overallTxt + '</span>' +
      '</div>' +
      _sec(L('Now · tap a tile to open it', 'Ahora · toca para abrir')) +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:9px;">' + tiles + '</div>' +
      _sec(L('This week · trends', 'Esta semana · tendencias')) +
      '<div style="background:#0c1a0c;border:1.5px solid #1e3a1e;border-radius:12px;padding:6px 14px;">' + trends + '</div>' +
      _sec(L('This week · digest', 'Esta semana · resumen')) +
      '<div style="background:#0c1a0c;border:1.5px solid #1e3a1e;border-radius:12px;padding:6px 14px;">' + digest + '</div>' +
      '<div style="margin-top:20px;text-align:center;"><button onclick="closeTier1();typeof openTier2===\'function\'&&openTier2()" style="padding:11px 20px;background:#0d152a;border:1.5px solid #2a4a7a;border-radius:50px;color:#93c5fd;' + MONO + 'font-size:12px;font-weight:700;cursor:pointer;">📈 ' + L('Month view (Tier 2)', 'Vista del mes (Tier 2)') + '</button></div>' +
    '</div>';
  }
})();
