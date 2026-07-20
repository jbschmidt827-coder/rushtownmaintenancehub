// ═══════════════════════════════════════════════════════════════════════════
// labor-punch.js — Maintenance → ⏱ Time tab (EN/ES)
// Lets a maintenance tech PUNCH OUT to another department when they go help
// somewhere else, and PUNCH BACK when done, so the time that leaves Maintenance
// is tracked to the department it went to. Manual entry too, for catching up.
// Collection: laborPunch  { tech, dept, farm, start, stop, minutes, note,
//   status:'open'|'closed', date, by, ts }.  Live via onSnapshot.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Departments a maintenance tech might get pulled to help.
  var LP_DEPTS = [
    { id: 'Barns',          en: 'Barns',            es: 'Galpones',        icon: '🐔' },
    { id: 'Processing',     en: 'Processing',       es: 'Procesamiento',   icon: '🏭' },
    { id: 'Feed Mill',      en: 'Feed Mill',        es: 'Molino',          icon: '🌽' },
    { id: 'Manure Loading', en: 'Manure Loading',   es: 'Carga Estiércol', icon: '💩' },
    { id: 'Shipping',       en: 'Shipping / Loadout', es: 'Envío / Carga', icon: '🚚' },
    { id: 'Egg Room',       en: 'Egg Room',         es: 'Sala de Huevos',  icon: '🥚' },
    { id: 'Other',          en: 'Other',            es: 'Otro',            icon: '🔧' }
  ];

  var _lpDocs = [], _lpListening = false, _lpTick = null;
  var MONO = "font-family:'IBM Plex Mono',monospace;";

  function _es() { try { return (typeof _lang !== 'undefined' && _lang === 'es'); } catch (e) { return false; } }
  function lpL(en, es) { return _es() ? es : en; }
  function _lpToday() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }
  function _lpBy() { return (typeof getDeviceUser === 'function') ? (getDeviceUser() || '') : ''; }
  function _lpFmtTime(ts) { try { return ts ? new Date(ts).toLocaleTimeString(_es() ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : ''; } catch (e) { return ''; } }
  function _lpFmtDur(min) { min = Math.max(0, Math.round(min)); var h = Math.floor(min / 60), m = min % 60; return h ? (h + 'h ' + (m < 10 ? '0' : '') + m + 'm') : (m + 'm'); }
  function _lpEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function _lpNameVal() { var el = document.getElementById('lp-name'); return el ? String(el.value || '').trim() : ''; }
  function _lpTech() { return _lpNameVal() || _lpBy(); }

  // The tech's currently-open punch (punched out, not back yet).
  function _lpOpen(tech) {
    if (!tech) return null;
    return _lpDocs.find(function (d) { return d.status !== 'closed' && !d.stop && String(d.tech || '').toLowerCase() === tech.toLowerCase(); }) || null;
  }

  // ── Live listener (last 14 days) ────────────────────────────────────────────
  function _lpStartListener() {
    if (_lpListening || typeof db === 'undefined' || !db) return;
    _lpListening = true;
    try {
      var cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      db.collection('laborPunch').where('ts', '>=', cutoff).onSnapshot(function (snap) {
        _lpDocs = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
        _lpRerender();
      }, function (err) { console.error('laborPunch listener:', err); });
    } catch (e) { console.error('lpStartListener:', e); _lpListening = false; }
  }
  function _lpVisible() { var el = document.getElementById('maint-time'); return el && el.offsetParent !== null; }
  function _lpRerender() {
    if (!_lpVisible()) return;
    var ae = document.activeElement;
    if (ae && ae.id === 'lp-name') return;   // don't clobber the name field mid-typing
    renderLaborPunch();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function lpStart(dept) {
    try {
      var tech = _lpTech();
      if (!tech) { if (typeof toast === 'function') toast(lpL('Enter your name first', 'Ingresa tu nombre primero')); var n = document.getElementById('lp-name'); if (n) n.focus(); return; }
      if (_lpOpen(tech)) { if (typeof toast === 'function') toast(lpL('You are already punched out — punch back first', 'Ya estás afuera — regresa primero')); return; }
      var id = 'lp__' + tech.replace(/[^a-zA-Z0-9]/g, '') + '__' + Date.now();
      await db.collection('laborPunch').doc(id).set({
        tech: tech, dept: dept, start: Date.now(), stop: null, minutes: null,
        status: 'open', date: _lpToday(), by: _lpBy() || tech, ts: Date.now()
      });
      if (typeof toast === 'function') toast('⏱ ' + lpL('Punched out to ', 'Fuiste a ') + dept);
      renderLaborPunch();
    } catch (e) { console.error('lpStart:', e); if (typeof toast === 'function') toast(lpL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e)); }
  }
  async function lpStop(id) {
    try {
      var rec = _lpDocs.find(function (d) { return d._id === id; });
      if (!rec) return;
      var mins = Math.max(0, Math.round((Date.now() - (rec.start || Date.now())) / 60000));
      await db.collection('laborPunch').doc(id).set({ stop: Date.now(), minutes: mins, status: 'closed' }, { merge: true });
      if (typeof toast === 'function') toast('✅ ' + lpL('Back in — ', 'De vuelta — ') + _lpFmtDur(mins) + lpL(' logged to ', ' para ') + rec.dept);
      renderLaborPunch();
    } catch (e) { console.error('lpStop:', e); if (typeof toast === 'function') toast(lpL('Could not save', 'No se pudo guardar')); }
  }
  async function lpManual() {
    try {
      var tech = _lpTech();
      if (!tech) { if (typeof toast === 'function') toast(lpL('Enter your name first', 'Ingresa tu nombre primero')); return; }
      var deptEl = document.getElementById('lp-manual-dept');
      var minEl = document.getElementById('lp-manual-min');
      var dept = deptEl ? deptEl.value : '';
      var mins = minEl ? Math.max(0, Math.round(Number(minEl.value) || 0)) : 0;
      if (!dept) { if (typeof toast === 'function') toast(lpL('Pick a department', 'Elige un departamento')); return; }
      if (!mins) { if (typeof toast === 'function') toast(lpL('Enter minutes', 'Ingresa los minutos')); return; }
      var now = Date.now();
      var id = 'lp__' + tech.replace(/[^a-zA-Z0-9]/g, '') + '__' + now;
      await db.collection('laborPunch').doc(id).set({
        tech: tech, dept: dept, start: now - mins * 60000, stop: now, minutes: mins,
        status: 'closed', date: _lpToday(), by: _lpBy() || tech, ts: now, manual: true
      });
      if (minEl) minEl.value = '';
      if (typeof toast === 'function') toast('✅ ' + _lpFmtDur(mins) + lpL(' logged to ', ' para ') + dept);
      renderLaborPunch();
    } catch (e) { console.error('lpManual:', e); if (typeof toast === 'function') toast(lpL('Could not save', 'No se pudo guardar')); }
  }
  async function lpRemove(id) {
    try { await db.collection('laborPunch').doc(id).delete(); renderLaborPunch(); }
    catch (e) { console.error('lpRemove:', e); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function renderLaborPunch() {
    var host = document.getElementById('maint-time');
    if (!host) return;
    _lpStartListener();
    var t = _lpToday();
    var tech = _lpTech();
    var open = _lpOpen(tech);

    // Today's totals by department + the running log.
    var today = _lpDocs.filter(function (d) { return d.date === t; });
    var totals = {};
    today.forEach(function (d) {
      if (d.status !== 'closed') return;
      totals[d.dept] = (totals[d.dept] || 0) + (Number(d.minutes) || 0);
    });

    var deptBtns = LP_DEPTS.map(function (D) {
      return '<button onclick="lpStart(\'' + D.id + '\')" style="padding:14px 10px;border-radius:12px;background:#0d1f3a;border:1.5px solid #2a5a8a;color:#cfe3ff;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;text-align:center;">' + D.icon + '<br>' + _lpEsc(lpL(D.en, D.es)) + '</button>';
    }).join('');

    var manualOpts = LP_DEPTS.map(function (D) { return '<option value="' + D.id + '">' + _lpEsc(lpL(D.en, D.es)) + '</option>'; }).join('');

    // Open-punch banner (elapsed) OR the department picker.
    var actionHtml;
    if (open) {
      var elapsed = Math.max(0, Math.round((Date.now() - (open.start || Date.now())) / 60000));
      actionHtml =
        '<div style="background:#2a1508;border:2px solid #d97706;border-radius:14px;padding:16px;margin-bottom:14px;text-align:center;">' +
          '<div style="' + MONO + 'font-size:13px;color:#fbbf24;font-weight:700;">🔴 ' + _lpEsc(tech) + ' ' + lpL('is helping', 'está ayudando') + ' <b style="color:#fff;">' + _lpEsc(open.dept) + '</b></div>' +
          '<div style="' + MONO + 'font-size:12px;color:#d6b36a;margin:6px 0 12px;">' + lpL('since', 'desde') + ' ' + _lpFmtTime(open.start) + ' · ' + _lpFmtDur(elapsed) + ' ' + lpL('so far', 'hasta ahora') + '</div>' +
          '<button onclick="lpStop(\'' + open._id + '\')" style="width:100%;padding:16px;border-radius:12px;background:#14532d;border:2px solid #4ade80;color:#86efac;' + MONO + 'font-size:15px;font-weight:700;cursor:pointer;">⏹ ' + lpL('PUNCH BACK IN', 'REGRESAR') + '</button>' +
        '</div>';
    } else {
      actionHtml =
        '<div style="' + MONO + 'font-size:11px;color:#9ab09a;margin-bottom:8px;">▶ ' + lpL('Punch out to help another department:', 'Marca salida para ayudar a otro departamento:') + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">' + deptBtns + '</div>';
    }

    // Today's totals strip.
    var totalKeys = Object.keys(totals).filter(function (k) { return totals[k] > 0; });
    var totalHtml = totalKeys.length
      ? '<div style="' + MONO + 'font-size:12px;color:#cfe0a0;background:#0c1a0c;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin-bottom:12px;">' +
          '<b style="color:#7ab07a;">' + lpL('Time to depts today:', 'Tiempo a depts hoy:') + '</b> ' +
          totalKeys.map(function (k) { return _lpEsc(k) + ' ' + _lpFmtDur(totals[k]); }).join(' · ') +
        '</div>'
      : '';

    // ── THIS WEEK — hours OUT of maintenance by employee (last 7 days) ──
    var weekAgo = Date.now() - 7 * 86400000;
    var wk = _lpDocs.filter(function (d) { return d.status === 'closed' && (Number(d.ts) || 0) >= weekAgo; });
    var byTech = {}, byDept = {}, weekTotal = 0;
    wk.forEach(function (d) {
      var m = Number(d.minutes) || 0; if (m <= 0) return;
      var who = d.tech || '—';
      if (!byTech[who]) byTech[who] = { total: 0, depts: {} };
      byTech[who].total += m; byTech[who].depts[d.dept] = (byTech[who].depts[d.dept] || 0) + m;
      byDept[d.dept] = (byDept[d.dept] || 0) + m; weekTotal += m;
    });
    var techKeys = Object.keys(byTech).sort(function (a, b) { return byTech[b].total - byTech[a].total; });
    var weekHtml;
    if (!techKeys.length) {
      weekHtml = '<div style="' + MONO + 'font-size:12px;color:#5a7a5a;padding:10px 0;">' + lpL('No time out of maintenance logged this week.', 'Sin tiempo fuera de mantenimiento esta semana.') + '</div>';
    } else {
      var techRows = techKeys.map(function (who) {
        var rec = byTech[who];
        var chips = Object.keys(rec.depts).sort(function (a, b) { return rec.depts[b] - rec.depts[a]; })
          .map(function (dp) { return '<span style="background:#0d1f3a;border:1px solid #2a5a8a;border-radius:6px;color:#9cc0f6;padding:2px 7px;margin:2px 3px 0 0;display:inline-block;font-size:10px;">' + _lpEsc(dp) + ' ' + _lpFmtDur(rec.depts[dp]) + '</span>'; }).join('');
        return '<div style="padding:8px 0;border-bottom:1px solid #163016;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
            '<b style="color:#f0ead8;' + MONO + 'font-size:13px;">' + _lpEsc(who) + '</b>' +
            '<b style="color:#fbbf24;' + MONO + 'font-size:14px;">' + _lpFmtDur(rec.total) + '</b>' +
          '</div>' +
          '<div style="margin-top:3px;">' + chips + '</div>' +
        '</div>';
      }).join('');
      var deptSummary = Object.keys(byDept).sort(function (a, b) { return byDept[b] - byDept[a]; })
        .map(function (dp) { var pct = Math.round(byDept[dp] / weekTotal * 100); return _lpEsc(dp) + ' ' + _lpFmtDur(byDept[dp]) + ' (' + pct + '%)'; }).join(' · ');
      weekHtml =
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">' +
          '<span style="' + MONO + 'font-size:11px;color:#9ad6a0;font-weight:700;">' + lpL('Hours out by employee', 'Horas fuera por empleado') + '</span>' +
          '<span style="' + MONO + 'font-size:12px;color:#fbbf24;font-weight:700;">' + lpL('total', 'total') + ' ' + _lpFmtDur(weekTotal) + '</span>' +
        '</div>' +
        techRows +
        '<div style="' + MONO + 'font-size:10px;color:#8aa88a;margin-top:8px;line-height:1.6;"><b style="color:#7ab07a;">' + lpL('Where the labor went:', 'A dónde fue el trabajo:') + '</b> ' + deptSummary + '</div>';
    }
    var weekSection =
      '<div style="' + MONO + 'font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;margin-bottom:6px;">📆 ' + lpL('This week · out of maintenance', 'Esta semana · fuera de mantenimiento') + '</div>' +
      '<div style="background:#0c1a0c;border:1px solid #1e3a1e;border-radius:10px;padding:8px 12px;margin-bottom:14px;">' + weekHtml + '</div>';

    // Today's log rows (most recent first).
    var rows = today.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).map(function (d) {
      var open2 = d.status !== 'closed' && !d.stop;
      var dur = open2 ? (lpL('open…', 'abierto…')) : _lpFmtDur(Number(d.minutes) || 0);
      // Delete removed per Joe (2026-07-20) — a stray tap was wiping real time
      // entries. Times are now permanent from the tablet. (lpRemove kept below
      // for a future leader-gated correction path once login is back on.)
      return '<div style="display:flex;align-items:center;gap:8px;' + MONO + 'font-size:12px;color:#cfe0a0;padding:7px 0;border-bottom:1px solid #163016;">' +
        '<span style="flex:1;">' + _lpEsc(d.tech || '—') + ' → <b style="color:#9cc0f6;">' + _lpEsc(d.dept) + '</b>' + (d.manual ? ' <span style="color:#7a9a7a;">(' + lpL('manual', 'manual') + ')</span>' : '') + '</span>' +
        '<span style="color:' + (open2 ? '#fbbf24' : '#f0d68a') + ';font-weight:700;">' + dur + '</span>' +
      '</div>';
    }).join('') || '<div style="' + MONO + 'font-size:12px;color:#5a7a5a;padding:8px 0;">' + lpL('No time logged yet today.', 'Sin tiempo registrado hoy.') + '</div>';

    host.innerHTML =
      '<div style="max-width:640px;margin:0 auto;">' +
        '<div style="' + MONO + 'font-size:14px;font-weight:700;color:#f0ead8;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">⏱ ' + lpL('Punch Out — Time to Other Depts', 'Salida — Tiempo a Otros Depts') + '</div>' +
        '<div style="' + MONO + 'font-size:10px;color:#7a9a7a;margin-bottom:14px;">' + lpL('Track maintenance time that goes to help other departments.', 'Registra el tiempo de mantenimiento que va a ayudar a otros departamentos.') + '</div>' +
        // Name
        '<label style="' + MONO + 'font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;display:block;margin-bottom:4px;">' + lpL('Your name', 'Tu nombre') + '</label>' +
        '<input id="lp-name" list="staff-datalist" value="' + _lpEsc(tech) + '" onchange="renderLaborPunch()" placeholder="' + lpL('Type your name', 'Escribe tu nombre') + '" autocomplete="off" style="width:100%;box-sizing:border-box;padding:11px;border-radius:10px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:15px;font-weight:700;margin-bottom:14px;">' +
        actionHtml +
        totalHtml +
        // Manual entry
        '<div style="background:#0a1a0a;border:1px solid #1e3a1e;border-radius:10px;padding:10px;margin-bottom:14px;">' +
          '<div style="' + MONO + 'font-size:11px;color:#9ad6a0;font-weight:700;margin-bottom:6px;">' + lpL('Log time already worked', 'Registrar tiempo ya trabajado') + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<select id="lp-manual-dept" style="flex:2;min-width:120px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:13px;"><option value="">' + lpL('— department —', '— departamento —') + '</option>' + manualOpts + '</select>' +
            '<input id="lp-manual-min" type="number" min="0" inputmode="numeric" placeholder="' + lpL('min', 'min') + '" style="flex:1;min-width:70px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:14px;font-weight:700;">' +
            '<button onclick="lpManual()" style="flex:0 0 auto;padding:9px 14px;border-radius:8px;background:#14361c;border:1.5px solid #4ade80;color:#4ade80;' + MONO + 'font-size:14px;font-weight:700;cursor:pointer;">+ ' + lpL('Add', 'Agregar') + '</button>' +
          '</div>' +
        '</div>' +
        weekSection +
        // Today's log
        '<div style="' + MONO + 'font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;margin-bottom:6px;">' + lpL('Today · ' + t, 'Hoy · ' + t) + '</div>' +
        '<div style="background:#0c1a0c;border:1px solid #1e3a1e;border-radius:10px;padding:4px 12px;">' + rows + '</div>' +
      '</div>';

    // Tick the "so far" elapsed while someone is punched out.
    if (_lpTick) { clearInterval(_lpTick); _lpTick = null; }
    if (open) _lpTick = setInterval(function () { if (_lpVisible()) { if (_lpOpen(_lpTech())) renderLaborPunch(); else { clearInterval(_lpTick); _lpTick = null; } } else { clearInterval(_lpTick); _lpTick = null; } }, 30000);
  }

  if (typeof window !== 'undefined') {
    window.renderLaborPunch = renderLaborPunch;
    window.lpStart = lpStart;
    window.lpStop = lpStop;
    window.lpManual = lpManual;
    window.lpRemove = lpRemove;
  }
})();
