// ═══════════════════════════════════════════════════════════════════════════
// tier2.js — TIER 2 DASHBOARD · MONTH (EN/ES)
// The monthly roll-up above Tier 1. CALENDAR MONTH-TO-DATE, grouped into weeks
// of the month (W1 = 1st–7th, W2 = 8th–14th, …) building up as the month goes;
// resets on the 1st. Month totals, weekly trend bars, where maintenance time
// went (laborPunch), and a month digest. Opens from home or the Tier 1 link.
// Pulls live (parallel): barnWalks, eggDailyRun, processingLog, mortalityLog,
// pmHistory, laborPunch, maintProjects, safetySettings + globals workOrders /
// ALL_PM+pmStatus / partsInventory.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";

  function _es() { try { return (typeof _lang !== 'undefined' && _lang === 'es'); } catch (e) { return false; } }
  function L(en, es) { return _es() ? es : en; }
  function _num(n) { try { return Number(n || 0).toLocaleString(); } catch (e) { return String(n || 0); } }
  function _dayStr(d) { return d.toISOString().slice(0, 10); }

  // Calendar month-to-date grouped into weeks of the month:
  // W1 = 1st–7th, W2 = 8th–14th, W3 = 15th–21st, W4 = 22nd–28th, W5 = 29th+.
  // Only weeks that have started exist, so the board builds up through the month.
  function _weeks() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var y = today.getFullYear(), m = today.getMonth(), dom = today.getDate();
    var w = [];
    for (var d = 1; d <= dom; d++) {
      var wi = Math.floor((d - 1) / 7);
      (w[wi] = w[wi] || []).push(_dayStr(new Date(y, m, d)));
    }
    return w;
  }

  function _ov() {
    var o = document.getElementById('tier2-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'tier2-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:956;background:#080f18;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.openTier2 = function () { var o = _ov(); o.style.display = 'block'; try { window.scrollTo(0, 0); } catch (e) {} renderTier2(); };
  window.closeTier2 = function () { var o = document.getElementById('tier2-overlay'); if (o) o.style.display = 'none'; };

  function _metric(icon, label, value, unit, accent) {
    return '<div style="background:#0c1424;border:1.5px solid #1c2c44;border-left:4px solid ' + (accent || '#3b82f6') + ';border-radius:12px;padding:12px 13px;">' +
      '<div style="' + MONO + 'font-size:9.5px;letter-spacing:1px;color:#7f9bc4;text-transform:uppercase;">' + icon + ' ' + label + '</div>' +
      '<div style="' + MONO + 'font-size:20px;font-weight:700;color:#eaf1ff;margin-top:3px;">' + value + ' <span style="font-size:10px;color:#6f8bb4;font-weight:400;">' + (unit || '') + '</span></div>' +
    '</div>';
  }

  function _spark(vals, color) {
    var max = Math.max.apply(null, vals.concat([1]));
    var bw = 26, gap = 8, h = 34;
    var bars = vals.map(function (v, i) {
      var bh = Math.max(2, Math.round((v / max) * h));
      return '<rect x="' + (i * (bw + gap)) + '" y="' + (h - bh) + '" width="' + bw + '" height="' + bh + '" rx="2" fill="' + color + '" opacity="' + (i === vals.length - 1 ? 1 : 0.5) + '"></rect>';
    }).join('');
    var w = vals.length * (bw + gap) - gap;
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block;">' + bars + '</svg>';
  }

  function _trendRow(icon, label, total, unit, vals, color) {
    var labels = vals.map(function (_, i) { return '<span style="' + MONO + 'font-size:8px;color:#5f7ba4;width:26px;display:inline-block;text-align:center;margin-right:8px;">W' + (i + 1) + '</span>'; }).join('');
    return '<div style="display:flex;align-items:center;gap:16px;padding:12px 4px;border-bottom:1px solid #16223880;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="' + MONO + 'font-size:10px;letter-spacing:.5px;color:#7f9bc4;text-transform:uppercase;">' + icon + ' ' + label + '</div>' +
        '<div style="' + MONO + 'font-size:18px;font-weight:700;color:#eaf1ff;">' + total + ' <span style="font-size:10px;color:#6f8bb4;font-weight:400;">' + unit + '</span></div>' +
      '</div>' +
      '<div style="flex-shrink:0;">' + _spark(vals, color) + '<div style="margin-top:2px;">' + labels + '</div></div>' +
    '</div>';
  }

  async function _get(coll, where) {
    try {
      if (typeof db === 'undefined' || !db) return [];
      var q = db.collection(coll);
      if (where) q = q.where(where[0], where[1], where[2]);
      var snap = await q.get();
      return snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
    } catch (e) { return []; }
  }

  async function renderTier2() {
    var o = _ov();
    o.innerHTML = _shell(L('Loading the month…', 'Cargando el mes…'));
    var weeks = _weeks();
    var monthStart = weeks[0][0];
    var monthStartMs = new Date(monthStart + 'T00:00:00').getTime();
    var wkIndex = {}; weeks.forEach(function (w, i) { w.forEach(function (ds) { wkIndex[ds] = i; }); });

    var res = await Promise.all([
      _get('barnWalks', ['date', '>=', monthStart]),
      _get('eggDailyRun', ['date', '>=', monthStart]),
      _get('processingLog', ['date', '>=', monthStart]),
      _get('mortalityLog', ['date', '>=', monthStart]),
      _get('pmHistory', ['ts', '>=', monthStartMs]),
      _get('laborPunch', ['ts', '>=', monthStartMs]),
      _get('maintProjects'),
      _get('tierExternal'),
      _get('feedMade', ['date', '>=', monthStart])
    ]);
    var mChecks = res[0], mEgg = res[1], mPack = res[2], mMort = res[3], mPM = res[4], mLabor = res[5], projects = res[6];
    var ext = {}; (res[7] || []).forEach(function (d) { try { ext[d._id] = JSON.parse(d.json || '{}'); } catch (e) {} });
    var mFeed = res[8] || [];
    // DAYS SAFE — same source of truth as Tier 1 / the printed huddle boards.
    var safeDays = null;
    Object.keys(ext).forEach(function (k) { var ds = ext[k] && ext[k].daysSafe; if (ds != null && (safeDays == null || ds < safeDays)) safeDays = ds; });
    var safety = [];
    try { if (typeof db !== 'undefined' && db) { var sd = await db.collection('safetySettings').doc('main').get(); if (sd.exists) safety = [sd.data()]; } } catch (e) {}

    // ── Globals ──
    var WOs = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
    var openWO = WOs.filter(function (w) { return w && w.status !== 'completed'; }).length;
    var woOpenedM = WOs.filter(function (w) { return w && Number(w.ts) >= monthStartMs; }).length;
    var woClosedM = WOs.filter(function (w) {
      if (!w || w.status !== 'completed') return false;
      var ts = w.completedTs, ms = (ts && typeof ts.toMillis === 'function') ? ts.toMillis() : (typeof ts === 'number' ? ts : null);
      return ms != null && ms >= monthStartMs;
    }).length;
    var pmOverdue = 0;
    try { if (typeof ALL_PM !== 'undefined' && typeof pmStatus === 'function') pmOverdue = ALL_PM.filter(function (p) { return pmStatus(p.id) === 'overdue'; }).length; } catch (e) {}
    var critParts = 0;
    try { if (typeof partsInventory !== 'undefined' && partsInventory) { Object.keys(partsInventory).forEach(function (k) { var p = partsInventory[k] || {}; if ((Number(p.qty) || 0) <= (Number(p.min) || 1)) critParts++; }); } } catch (e) {}
    var openProj = projects.filter(function (p) { return p && p.status !== 'done' && p.status !== 'completed'; }).length;

    // Active houses
    var FH = (typeof FARM_HOUSES !== 'undefined') ? FARM_HOUSES : { Hegins: ['1','2','3','4','5','6','7','8'], Danville: ['1','2','3','4','5'] };
    var totalHouses = 0;
    Object.keys(FH).forEach(function (f) {
      if (f === 'Processing Plant') return;
      (Array.isArray(FH[f]) ? FH[f] : []).forEach(function (h) {
        var num = String(h).replace(/^\s*house\s*/i, '').trim();
        if (!(typeof isHouseDown === 'function' && isHouseDown(f, num))) totalHouses++;
      });
    });

    // ── Month totals ──
    var checksDone = mChecks.filter(function (c) { return (Number(c.pct) || 0) >= 100; }).length;
    var daysElapsed = weeks.reduce(function (s, w) { return s + w.length; }, 0) || 1;
    var possibleChecks = totalHouses * daysElapsed;
    var complPct = possibleChecks ? Math.round(checksDone / possibleChecks * 100) : 0;
    var mortM = mMort.reduce(function (s, r) { return r.type === 'mortality' ? s + (Number(r.mortCount) || 0) : s; }, 0);
    var eggM = mEgg.reduce(function (s, r) { return s + (Number(r.eggs) || 0); }, 0);
    var dtM = mPack.reduce(function (s, r) { return s + (Number(r.downtimeMin) || 0); }, 0);
    var flagsM = mChecks.reduce(function (s, c) { return s + ((c.flags && c.flags.length) || 0); }, 0);
    var millM = Math.round(mFeed.reduce(function (s, r) { return s + (Number(r.tons) || 0); }, 0) * 10) / 10;
    var incidentsM = (safety[0] && safety[0].lastIncidentDate && String(safety[0].lastIncidentDate).slice(0, 10) >= monthStart) ? 1 : 0;

    var metrics =
      _metric('🐔', L('Checks completed', 'Revisiones'), _num(checksDone), complPct + '% ' + L('of possible', 'de lo posible'), '#22c55e') +
      _metric('💀', L('Mortality', 'Mortalidad'), _num(mortM), L('birds', 'aves'), '#ef4444') +
      _metric('🥚', L('Eggs processed', 'Huevos procesados'), _num(eggM), '', '#eab308') +
      _metric('⏱', L('Packing downtime', 'Paro empaque'), _num(dtM), 'min', '#f59e0b') +
      _metric('⚠️', L('Quality flags', 'Alertas calidad'), _num(flagsM), '', '#f59e0b') +
      _metric('🦺', L('Days safe', 'Días seguros'), safeDays == null ? '—' : String(safeDays), incidentsM ? L('incident this month!', '¡incidente este mes!') : L('no incidents', 'sin incidentes'), (incidentsM || (safeDays != null && safeDays < 7)) ? '#ef4444' : '#22c55e') +
      _metric('🔧', L('WOs opened', 'OT abiertas'), _num(woOpenedM), openWO + ' ' + L('open now', 'abiertas'), '#3b82f6') +
      _metric('✅', L('WOs closed', 'OT cerradas'), _num(woClosedM), L('this month', 'este mes'), '#22c55e') +
      _metric('📋', L('PMs completed', 'PM completados'), _num(mPM.length), pmOverdue + ' ' + L('overdue now', 'vencidos'), '#3b82f6') +
      _metric('🗂', L('Projects open', 'Proyectos'), String(openProj), '', '#3b82f6') +
      _metric('🔩', L('Critical parts', 'Piezas críticas'), String(critParts), L('at/below min', 'en/bajo mín'), critParts ? '#ef4444' : '#22c55e') +
      _metric('🌾', L('Mill output', 'Molino'), millM > 0 ? _num(millM) : '—', millM > 0 ? L('tons this month', 'ton este mes') : L('no data yet', 'sin datos aún'), '#a3e635');

    // ── Weekly trend series ──
    function _wk(map) { return weeks.map(function (_, i) { return map[i] || 0; }); }
    function _byWeek(rows, dateKey, valFn) { var m = {}; rows.forEach(function (r) { var wi = wkIndex[r[dateKey]]; if (wi != null) m[wi] = (m[wi] || 0) + valFn(r); }); return m; }
    var eggWk = _byWeek(mEgg, 'date', function (r) { return Number(r.eggs) || 0; });
    var mortWk = _byWeek(mMort.filter(function (r) { return r.type === 'mortality'; }), 'date', function (r) { return Number(r.mortCount) || 0; });
    var dtWk = _byWeek(mPack, 'date', function (r) { return Number(r.downtimeMin) || 0; });
    var chkWk = _byWeek(mChecks.filter(function (c) { return (Number(c.pct) || 0) >= 100; }), 'date', function () { return 1; });

    var trends =
      _trendRow('🥚', L('Eggs processed', 'Huevos procesados'), _num(eggM), L('this month', 'este mes'), _wk(eggWk), '#eab308') +
      _trendRow('💀', L('Mortality', 'Mortalidad'), _num(mortM), L('birds', 'aves'), _wk(mortWk), '#ef4444') +
      _trendRow('🐔', L('Checks completed', 'Revisiones'), String(checksDone), L('this month', 'este mes'), _wk(chkWk), '#22c55e') +
      _trendRow('⏱', L('Packing downtime', 'Paro empaque'), _num(dtM), L('min', 'min'), _wk(dtWk), '#f59e0b');

    // ── Where maintenance time went (laborPunch) ──
    var lpByDept = {}, lpTotal = 0;
    mLabor.forEach(function (p) { var m = Number(p.minutes) || 0; if (m > 0) { lpByDept[p.dept || '—'] = (lpByDept[p.dept || '—'] || 0) + m; lpTotal += m; } });
    var lpRows;
    if (lpTotal === 0) {
      lpRows = '<div style="' + MONO + 'font-size:12px;color:#6f8bb4;padding:10px 2px;">' + L('No maintenance time logged to other departments this month.', 'No se registró tiempo de mantenimiento a otros departamentos este mes.') + '</div>';
    } else {
      lpRows = Object.keys(lpByDept).sort(function (a, b) { return lpByDept[b] - lpByDept[a]; }).map(function (d) {
        var min = lpByDept[d], pct = Math.round(min / lpTotal * 100), hrs = (min / 60).toFixed(1);
        return '<div style="padding:7px 2px;">' +
          '<div style="display:flex;justify-content:space-between;' + MONO + 'font-size:11px;color:#cfe0ff;margin-bottom:3px;"><span>' + d + '</span><span>' + hrs + ' h · ' + pct + '%</span></div>' +
          '<div style="height:8px;background:#132038;border-radius:5px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:#3b82f6;"></div></div>' +
        '</div>';
      }).join('');
      lpRows = '<div style="' + MONO + 'font-size:11px;color:#7f9bc4;margin-bottom:6px;">' + L('Total', 'Total') + ': ' + (lpTotal / 60).toFixed(1) + ' ' + L('hours across the month', 'horas en el mes') + '</div>' + lpRows;
    }

    // ── Month digest ──
    function _dg(icon, txt) { return '<div style="display:flex;gap:9px;padding:8px 2px;border-bottom:1px solid #16223880;' + MONO + 'font-size:12px;color:#cfe0ff;"><span>' + icon + '</span><span>' + txt + '</span></div>'; }
    var avgMortDay = Math.round(mortM / daysElapsed);
    var digest =
      _dg(incidentsM ? '🟥' : '🦺', (safeDays != null ? (safeDays + L(' days safe · ', ' días seguros · ')) : '') + (incidentsM ? L('incident this month — review', 'incidente este mes — revisar') : L('no incidents this month', 'sin incidentes este mes'))) +
      _dg('🌾', millM > 0 ? (_num(millM) + L(' tons feed made', ' ton de alimento hecho')) : L('Mill: no data entered yet', 'Molino: sin datos aún')) +
      _dg('🐔', checksDone + L(' checks done · ', ' revisiones · ') + complPct + L('% completion rate', '% de cumplimiento')) +
      _dg('💀', _num(mortM) + L(' birds mortality · avg ', ' aves · prom ') + avgMortDay + L('/day', '/día')) +
      _dg('🥚', _num(eggM) + L(' eggs processed', ' huevos procesados')) +
      _dg('⏱', _num(dtM) + L(' min packing downtime', ' min de paro en empaque')) +
      _dg('🔧', woOpenedM + L(' work orders opened · ', ' OT abiertas · ') + woClosedM + L(' closed · ', ' cerradas · ') + openWO + L(' still open', ' aún abiertas')) +
      _dg('📋', mPM.length + L(' PMs completed · ', ' PM completados · ') + pmOverdue + L(' overdue now', ' vencidos ahora')) +
      _dg('🔧', (lpTotal ? (lpTotal / 60).toFixed(1) : '0') + L(' maintenance hours to other departments', ' horas de mantenimiento a otros departamentos'));

    o.innerHTML = _shell(null, metrics, trends, lpRows, digest, monthStart);
  }

  function _sec(label) {
    return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#6f8bb4;text-transform:uppercase;margin:22px 2px 9px;font-weight:700;">' + label + '</div>';
  }

  function _shell(loadingMsg, metrics, trends, lpRows, digest, monthStart) {
    var range = monthStart ? (new Date(monthStart + 'T00:00:00').toLocaleDateString(_es() ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' }) + ' – ' + new Date().toLocaleDateString(_es() ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })) : '';
    var head = '<div style="max-width:820px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<div style="display:flex;gap:8px;">' +
          '<button onclick="closeTier2()" style="padding:11px 16px;background:#0d1526;border:1.5px solid #2a4a7a;border-radius:50px;color:#93c5fd;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + L('Back', 'Atrás') + '</button>' +
          '<button onclick="typeof openTierSW===\'function\'&&openTierSW()" style="padding:11px 14px;background:#1a1408;border:1.5px solid #7a5a1a;border-radius:50px;color:#e8c96a;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">📘 SW</button>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:2px;line-height:1;color:#eaf1ff;">📈 ' + L('TIER 2 · MONTH', 'TIER 2 · MES') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#6f8bb4;margin-top:2px;">' + range + '</div>' +
        '</div>' +
      '</div>';
    if (loadingMsg) return head + '<div style="' + MONO + 'color:#9ac9d6;text-align:center;padding:50px;">' + loadingMsg + '</div></div>';
    return head +
      _sec(L('Month to date · totals', 'Mes a la fecha · totales')) +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;">' + metrics + '</div>' +
      _sec(L('Week by week this month', 'Semana a semana este mes')) +
      '<div style="background:#0a1220;border:1.5px solid #1c2c44;border-radius:12px;padding:6px 14px;">' + trends + '</div>' +
      _sec(L('Where maintenance time went', 'A dónde fue el tiempo de mantenimiento')) +
      '<div style="background:#0a1220;border:1.5px solid #1c2c44;border-radius:12px;padding:12px 14px;">' + lpRows + '</div>' +
      _sec(L('Month digest', 'Resumen del mes')) +
      '<div style="background:#0a1220;border:1.5px solid #1c2c44;border-radius:12px;padding:6px 14px;">' + digest + '</div>' +
      '<div style="margin-top:20px;text-align:center;"><button onclick="closeTier2();typeof openTier1===\'function\'&&openTier1()" style="padding:11px 20px;background:#0d1a0d;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:12px;font-weight:700;cursor:pointer;">📊 ' + L('Day / Week view (Tier 1)', 'Vista Día / Semana (Tier 1)') + '</button></div>' +
    '</div>';
  }
})();
