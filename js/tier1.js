// ═══════════════════════════════════════════════════════════════════════════
// tier1.js — TIER 1 DASHBOARD (EN/ES)
// One screen, red/yellow/green across the whole operation. Opens from a home
// Quick Action. Pulls live: workOrders / ALL_PM+pmStatus / partsInventory (app
// globals) + barnWalks, morningWalks, eggDailyRun, processingLog, maintProjects,
// safetySettings (Firestore, today). Each tile shows a status dot + a number and
// taps through to the relevant screen. Thresholds are simple + easy to tweak.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  function _es() { try { return (typeof _lang !== 'undefined' && _lang === 'es'); } catch (e) { return false; } }
  function L(en, es) { return _es() ? es : en; }
  function _today() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }

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
    var c = _dot(status);
    return '<button ' + (onclick ? 'onclick="' + onclick + '"' : '') + ' style="text-align:left;background:#0f1f0f;border:1.5px solid #1e3a1e;border-left:5px solid ' + c + ';border-radius:12px;padding:13px 14px;cursor:' + (onclick ? 'pointer' : 'default') + ';display:flex;align-items:center;gap:12px;width:100%;">' +
      '<span style="font-size:22px;line-height:1;">' + icon + '</span>' +
      '<span style="flex:1;min-width:0;">' +
        '<span style="' + MONO + 'font-size:10px;letter-spacing:1px;color:#8aa88a;text-transform:uppercase;display:block;">' + title + '</span>' +
        '<span style="' + MONO + 'font-size:16px;font-weight:700;color:#f0ead8;">' + value + '</span>' +
        (sub ? '<span style="' + MONO + 'font-size:10px;color:#7a9a7a;margin-left:6px;">' + sub + '</span>' : '') +
      '</span>' +
      '<span style="width:14px;height:14px;border-radius:50%;background:' + c + ';box-shadow:0 0 8px ' + c + ';flex-shrink:0;"></span>' +
    '</button>';
  }

  function _num(n) { try { return Number(n || 0).toLocaleString(); } catch (e) { return String(n || 0); } }

  async function _get(coll, where) {
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

    // ── Live pulls (today) ──
    var checks = await _get('barnWalks', ['date', '==', t]);
    var mwalks = await _get('morningWalks', ['date', '==', t]);
    var eggRun = await _get('eggDailyRun', ['date', '==', t]);
    var packLog = await _get('processingLog', ['date', '==', t]);
    var projects = await _get('maintProjects');
    var safety = [];
    try { if (typeof db !== 'undefined' && db) { var sd = await db.collection('safetySettings').doc('main').get(); if (sd.exists) safety = [sd.data()]; } } catch (e) {}

    // ── App globals (loaded while the app is running) ──
    var WOs = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
    var openWO = WOs.filter(function (w) { return w && w.status !== 'completed'; });
    var urgentWO = openWO.filter(function (w) { return (w.priority || '').toLowerCase() === 'urgent' || (w.priority || '').toLowerCase() === 'high'; });
    var pmOverdue = 0;
    try { if (typeof ALL_PM !== 'undefined' && typeof pmStatus === 'function') pmOverdue = ALL_PM.filter(function (p) { return pmStatus(p.id) === 'overdue'; }).length; } catch (e) {}
    var critParts = 0;
    try { if (typeof partsInventory !== 'undefined' && partsInventory) { Object.keys(partsInventory).forEach(function (k) { var p = partsInventory[k] || {}; if ((Number(p.qty) || 0) <= (Number(p.min) || 0) && (Number(p.min) || 0) > 0) critParts++; }); } } catch (e) {}
    var openProj = projects.filter(function (p) { return p && p.status !== 'done' && p.status !== 'completed'; }).length;

    // ── Derived metrics ──
    // Safety: days since last incident
    var safeDays = null;
    if (safety[0] && safety[0].lastIncidentDate) { try { safeDays = Math.floor((Date.now() - new Date(safety[0].lastIncidentDate).getTime()) / 86400000); } catch (e) {} }
    var safeS = safeDays == null ? '-' : (safeDays >= 30 ? 'g' : safeDays >= 7 ? 'y' : 'r');

    // Production: houses checked today vs active houses
    var FH = (typeof FARM_HOUSES !== 'undefined') ? FARM_HOUSES : { Hegins: 8, Danville: 5 };
    var totalHouses = 0; Object.keys(FH).forEach(function (f) { var n = FH[f] || 0; for (var h = 1; h <= n; h++) { if (!(typeof isHouseDown === 'function' && isHouseDown(f, h))) totalHouses++; } });
    var doneHouses = {}; checks.forEach(function (c) { if ((Number(c.pct) || 0) >= 100 || c.employee) doneHouses[c.farm + '-' + c.house] = 1; });
    var prodDone = Object.keys(doneHouses).length;
    var prodPct = totalHouses ? Math.round(prodDone / totalHouses * 100) : 0;
    var prodS = prodPct >= 90 ? 'g' : prodPct >= 50 ? 'y' : 'r';

    // Egg flow: eggs processed today
    var eggsToday = eggRun.reduce(function (s, r) { return s + (Number(r.eggs) || 0); }, 0);
    var eggS = eggsToday > 0 ? 'g' : (eggRun.length ? 'y' : 'r');

    // Feed: any house reporting feed empty today
    var feedBad = checks.filter(function (c) { return c.feed === 'empty' || (c.flags || []).some(function (f) { return /feed/i.test(f); }); }).length;
    var feedS = feedBad === 0 ? 'g' : feedBad <= 1 ? 'y' : 'r';

    // Water: low PSI on today's morning walks (or water flags)
    var waterBad = mwalks.filter(function (w) { return (w.waterPSI != null && Number(w.waterPSI) < 20); }).length +
      checks.filter(function (c) { return (c.flags || []).some(function (f) { return /water/i.test(f); }); }).length;
    var waterS = waterBad === 0 ? 'g' : waterBad <= 1 ? 'y' : 'r';

    // Quality: total flags raised on today's checks
    var flagCount = checks.reduce(function (s, c) { return s + ((c.flags && c.flags.length) || 0); }, 0);
    var qualS = flagCount === 0 ? 'g' : flagCount <= 3 ? 'y' : 'r';

    // Downtime: packing downtime minutes today
    var dtMin = packLog.reduce(function (s, r) { return s + (Number(r.downtimeMin) || 0); }, 0);
    var dtS = dtMin <= 30 ? 'g' : dtMin <= 90 ? 'y' : 'r';

    var pmS = pmOverdue === 0 ? 'g' : pmOverdue <= 5 ? 'y' : 'r';
    var woS = urgentWO.length ? 'r' : (openWO.length > 10 ? 'y' : 'g');
    var partsS = critParts === 0 ? 'g' : 'r';

    var tiles = [
      _tile('🦺', L('Safety', 'Seguridad'), safeS, safeDays == null ? '—' : (safeDays + ' ' + L('days safe', 'días seguro')), '', ''),
      _tile('✅', L('Quality', 'Calidad'), qualS, flagCount + ' ' + L('flags', 'alertas'), L('today', 'hoy'), ''),
      _tile('🐔', L('Production', 'Producción'), prodS, prodDone + '/' + totalHouses, L('houses checked', 'casas revisadas') + ' · ' + prodPct + '%', "closeTier1();typeof openCompletion==='function'&&openCompletion()"),
      _tile('🥚', L('Egg Flow', 'Flujo de Huevos'), eggS, _num(eggsToday), L('eggs processed', 'huevos procesados'), "closeTier1();typeof openProcessing==='function'&&openProcessing()"),
      _tile('🌽', L('Feed', 'Alimento'), feedS, feedBad === 0 ? L('OK', 'OK') : feedBad + ' ' + L('low', 'bajo'), '', ''),
      _tile('💧', L('Water', 'Agua'), waterS, waterBad === 0 ? L('OK', 'OK') : waterBad + ' ' + L('issues', 'problemas'), '', ''),
      _tile('⏱', L('Downtime', 'Paro'), dtS, dtMin + ' min', L('packing today', 'empaque hoy'), ''),
      _tile('📋', L('Past Due PMs', 'PM Vencidos'), pmS, String(pmOverdue), L('overdue', 'vencidos'), "closeTier1();typeof go==='function'&&go('maint');setTimeout(function(){typeof goMaintSection==='function'&&goMaintSection('pm')},150)"),
      _tile('🔧', L('Open WO', 'OT Abiertas'), woS, String(openWO.length), urgentWO.length ? (urgentWO.length + ' ' + L('urgent', 'urgente')) : L('none urgent', 'ninguna urgente'), "closeTier1();typeof go==='function'&&go('maint')"),
      _tile('🗂', L('Open Projects', 'Proyectos'), openProj > 0 ? 'y' : 'g', String(openProj), L('open', 'abiertos'), "closeTier1();typeof go==='function'&&go('maint');setTimeout(function(){typeof goMaintSection==='function'&&goMaintSection('projects')},150)"),
      _tile('🔩', L('Critical Parts', 'Piezas Críticas'), partsS, String(critParts), L('at/below min', 'en/bajo mín'), "closeTier1();typeof go==='function'&&go('maint');setTimeout(function(){typeof goMaintSection==='function'&&goMaintSection('parts')},150)")
    ].join('');

    // Overall roll-up
    var states = [safeS, qualS, prodS, eggS, feedS, waterS, dtS, pmS, woS, partsS];
    var reds = states.filter(function (s) { return s === 'r'; }).length;
    var yels = states.filter(function (s) { return s === 'y'; }).length;
    var overall = reds ? 'r' : yels ? 'y' : 'g';
    var overallTxt = reds ? (reds + ' ' + L('need attention', 'requieren atención')) : yels ? (yels + ' ' + L('watch', 'vigilar')) : L('All green', 'Todo en verde');

    o.innerHTML = _shell(null, tiles, overall, overallTxt);
  }

  function _shell(loadingMsg, tiles, overall, overallTxt) {
    var dot = overall ? _dot(overall) : '#5a7a5a';
    var dateStr = new Date().toLocaleDateString(_es() ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    return '<div style="max-width:760px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 40px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<button onclick="closeTier1()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + L('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:2px;line-height:1;color:#f0ead8;">📊 ' + L('TIER 1', 'TIER 1') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#7ab07a;margin-top:2px;">' + dateStr + '</div>' +
        '</div>' +
      '</div>' +
      (loadingMsg
        ? '<div style="' + MONO + 'color:#9ac9d6;text-align:center;padding:50px;">' + loadingMsg + '</div>'
        : ('<div style="display:flex;align-items:center;gap:10px;background:#0c1a0c;border:1.5px solid ' + dot + ';border-radius:12px;padding:12px 14px;margin:10px 0 14px;">' +
            '<span style="width:16px;height:16px;border-radius:50%;background:' + dot + ';box-shadow:0 0 10px ' + dot + ';"></span>' +
            '<span style="' + MONO + 'font-size:14px;font-weight:700;color:#f0ead8;">' + overallTxt + '</span>' +
            '<span style="' + MONO + 'font-size:10px;color:#7a9a7a;margin-left:auto;">' + L('tap a tile to jump there', 'toca un cuadro para ir') + '</span>' +
          '</div>' +
          '<div style="display:grid;gap:9px;">' + tiles + '</div>')
      ) +
    '</div>';
  }
})();
