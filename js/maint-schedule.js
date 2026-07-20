// ═══════════════════════════════════════════════════════════════════════════
// maint-schedule.js — MAINTENANCE SET WEEKLY SCHEDULE + TODAY'S PLAN (EN/ES)
// • Fixed weekly routine: each day = set duties per tech (name · site · duty ·
//   optional start/end). TODAY highlighted. Leaders edit; techs see it live.
// • Tech picker is SITE-SCOPED to Maintenance staff (getDeptStaff(site,'Maintenance')).
// • Each job can attach a Work Instruction (📖 opens openWIView) and every job
//   links the 📘 Tier Standard Work.
// • TODAY'S PLAN card on top: today's routine + one-off tasks planned just for
//   today (stored per-date, auto-pruned after 14 days) + quick links to the
//   urgent work (WOs / PMs) so the leader can plan the whole day in one place.
//
// Data: settings/maintSchedule = { days:{mon:[entry…],…}, dates:{'YYYY-MM-DD':[entry…]} }
// entry = {tech, site, duty, start, end, wiId, wiTitle, by, ts}  (+ future woId/pmId)
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  function msL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var MS_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  function MS_DAY_LBL(k) {
    var m = { mon: ['Monday', 'Lunes'], tue: ['Tuesday', 'Martes'], wed: ['Wednesday', 'Miércoles'], thu: ['Thursday', 'Jueves'], fri: ['Friday', 'Viernes'], sat: ['Saturday', 'Sábado'], sun: ['Sunday', 'Domingo'] };
    return msL(m[k][0], m[k][1]);
  }
  var MS_SITES = ['Hegins', 'Danville', 'Processing Plant', 'Feed Mill', 'Both'];

  var _msData = null;
  var _msUnsub = null;
  var _msEdit = false;

  function _todayKey() { return MS_DAYS[(new Date().getDay() + 6) % 7]; }
  function _todayDate() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }

  function _canEdit() {
    try {
      if (typeof isLoggedIn === 'function' && isLoggedIn()) {
        return (typeof _isLeader === 'function') ? !!_isLeader() : true;
      }
    } catch (e) {}
    return true;
  }

  // Maintenance techs for a site (leaders included via getDeptStaff).
  function _msTechs(site) {
    try {
      if (typeof getDeptStaff === 'function') {
        var farm = (site === 'Both' || !site) ? null : site;
        // Processing Plant / Feed Mill techs are usually tagged Both — fall back to all.
        var names = getDeptStaff(farm, 'Maintenance') || [];
        if (!names.length) names = getDeptStaff(null, 'Maintenance') || [];
        return names;
      }
    } catch (e) {}
    return [];
  }

  function _msWIs() {
    try { if (typeof allWI !== 'undefined' && Array.isArray(allWI)) return allWI; } catch (e) {}
    return [];
  }

  function _load() {
    if (_msUnsub || typeof db === 'undefined' || !db) return;
    try {
      _msUnsub = db.collection('settings').doc('maintSchedule').onSnapshot(function (doc) {
        _msData = (doc.exists && doc.data()) || { days: {}, dates: {} };
        if (!_msData.days) _msData.days = {};
        if (!_msData.dates) _msData.dates = {};
        _msDraw();
      }, function (err) { console.error('maintSchedule listener:', err); });
    } catch (e) { console.error('maintSchedule load:', e); }
  }

  function _save() {
    if (typeof db === 'undefined' || !db || !_msData) return;
    // Prune one-off day plans older than 14 days so the doc never bloats.
    try {
      var cut = new Date(); cut.setDate(cut.getDate() - 14);
      var cutStr = cut.toISOString().slice(0, 10);
      Object.keys(_msData.dates || {}).forEach(function (d) { if (d < cutStr) delete _msData.dates[d]; });
    } catch (e) {}
    db.collection('settings').doc('maintSchedule').set(_msData, { merge: false })
      .then(function () { if (typeof toast === 'function') toast(msL('✅ Schedule saved', '✅ Horario guardado')); })
      .catch(function (e) { console.error('maintSchedule save:', e); if (typeof toast === 'function') toast(msL('⚠ Save failed — try again', '⚠ No se guardó — intenta de nuevo')); });
  }

  // "06:30" → "6:30 AM" (shows raw text for old free-text entries)
  function _fmtTime(v) {
    if (!v) return '';
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim());
    if (!m) return _esc(v);
    var h = parseInt(m[1], 10), min = m[2];
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + min + ' ' + ap;
  }

  // ── Entry display row ──
  function _entryRow(bucket, i, e, canEdit) {
    var time = (e.start || e.end) ? '<span style="color:#d6b34a;">🕐 ' + _fmtTime(e.start) + (e.end ? ' – ' + _fmtTime(e.end) : '') + '</span> · ' : '';
    var wiBtn = e.wiId
      ? '<button onclick="msOpenWI(\'' + _esc(e.wiId) + '\')" style="background:#0d1f3a;border:1px solid #2a5a8a;border-radius:6px;color:#7ab0f6;' + MONO + 'font-size:10px;font-weight:700;padding:4px 8px;cursor:pointer;margin-top:4px;">📖 ' + _esc(e.wiTitle || msL('Work Instruction', 'Instrucción')) + '</button>'
      : '';
    var swBtn = '<button onclick="typeof openTierSW===\'function\'&&openTierSW()" style="background:#1a1408;border:1px solid #7a5a1a;border-radius:6px;color:#e8c96a;' + MONO + 'font-size:10px;font-weight:700;padding:4px 8px;cursor:pointer;margin-top:4px;">📘 SW</button>';
    return '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #16281680;">' +
      '<span style="flex:1;' + MONO + 'font-size:12px;color:#d8e8d8;line-height:1.5;">' +
        time + '<b style="color:#9ad6a0;">' + _esc(e.tech || '—') + '</b>' +
        (e.site ? ' <span style="color:#7ab0f6;">@ ' + _esc(e.site) + '</span>' : '') +
        (e.duty ? '<br><span style="color:#b8c8b8;">' + _esc(e.duty) + '</span>' : '') +
        '<br>' + wiBtn + (wiBtn ? ' ' : '') + swBtn +
      '</span>' +
      (canEdit ? '<button onclick="msRemove(\'' + bucket + '\',' + i + ')" style="background:none;border:none;color:#7a4a4a;cursor:pointer;font-size:15px;padding:4px 6px;">✕</button>' : '') +
    '</div>';
  }

  // ── Add form (bucket = day key or 'date:YYYY-MM-DD') ──
  function _addForm(bucket, defaultSite) {
    var bid = bucket.replace(/[^a-zA-Z0-9]/g, '_');
    var siteOpts = MS_SITES.map(function (s) { return '<option value="' + s + '"' + (s === defaultSite ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    var techOpts = _msTechs(defaultSite).map(function (n) { return '<option value="' + _esc(n) + '">' + _esc(n) + '</option>'; }).join('');
    var wiOpts = _msWIs().map(function (w) { var id = w.wiId || w._fbId || ''; return id ? '<option value="' + _esc(id) + '">' + _esc((w.title || id).slice(0, 55)) + '</option>' : ''; }).join('');
    return '<div style="background:#0a1a0a;border:1px dashed #2a5a2a;border-radius:9px;padding:9px;margin-top:8px;">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' +
        '<select id="ms-site-' + bid + '" onchange="msSiteChanged(\'' + bucket + '\')" style="flex:1;min-width:105px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:12px;">' + siteOpts + '</select>' +
        '<select id="ms-tech-' + bid + '" style="flex:2;min-width:130px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:13px;"><option value="">' + msL('— tech —', '— técnico —') + '</option>' + techOpts + '</select>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' +
        '<input id="ms-duty-' + bid + '" placeholder="' + msL('Job (e.g. Fans + PMs houses 4-6)', 'Trabajo (ej. Ventiladores + PM casas 4-6)') + '" style="flex:3;min-width:150px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:12px;">' +
        '<label style="flex:0 0 auto;display:flex;align-items:center;gap:4px;' + MONO + 'font-size:10px;color:#7a9a7a;">' + msL('start', 'inicio') +
          '<input id="ms-start-' + bid + '" type="time" step="300" style="padding:8px 6px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:13px;color-scheme:dark;"></label>' +
        '<label style="flex:0 0 auto;display:flex;align-items:center;gap:4px;' + MONO + 'font-size:10px;color:#7a9a7a;">' + msL('end', 'fin') +
          '<input id="ms-end-' + bid + '" type="time" step="300" style="padding:8px 6px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:13px;color-scheme:dark;"></label>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<select id="ms-wi-' + bid + '" style="flex:3;min-width:150px;padding:9px;border-radius:8px;border:1.5px solid #2a4a6a;background:#060d14;color:#b8d0f0;' + MONO + 'font-size:11px;"><option value="">📖 ' + msL('attach work instruction (optional)', 'adjuntar instrucción (opcional)') + '</option>' + wiOpts + '</select>' +
        '<button onclick="msAdd(\'' + bucket + '\')" style="flex:0 0 auto;padding:9px 16px;border-radius:8px;background:#14361c;border:1.5px solid #4ade80;color:#4ade80;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">+ ' + msL('Add', 'Agregar') + '</button>' +
      '</div>' +
    '</div>';
  }

  function _msDraw() {
    var host = document.getElementById('maint-schedule');
    if (!host) return;
    var canEdit = _canEdit() && _msEdit;
    var tk = _todayKey(), td = _todayDate();
    var days = (_msData && _msData.days) || {};
    var dates = (_msData && _msData.dates) || {};

    // ── TODAY'S PLAN: routine for today + one-offs planned for this date ──
    var routine = Array.isArray(days[tk]) ? days[tk] : [];
    var oneOffs = Array.isArray(dates[td]) ? dates[td] : [];
    var planRows =
      routine.map(function (e, i) { return _entryRow(tk, i, e || {}, false); }).join('') +
      (oneOffs.length ? '<div style="' + MONO + 'font-size:9.5px;letter-spacing:1px;color:#d6b34a;text-transform:uppercase;margin-top:8px;">+ ' + msL('Added for today only', 'Solo por hoy') + '</div>' : '') +
      oneOffs.map(function (e, i) { return _entryRow('date:' + td, i, e || {}, canEdit); }).join('');
    if (!routine.length && !oneOffs.length) planRows = '<div style="' + MONO + 'font-size:11px;color:#4a6a4a;padding:8px 0;">' + msL('Nothing planned yet — add the routine below or a one-off task here.', 'Nada planeado aún — agrega la rutina abajo o una tarea de hoy aquí.') + '</div>';
    var quickLinks = '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px;">' +
      '<button onclick="goMaintSection(\'wo\')" style="padding:8px 12px;border-radius:8px;background:#0d1f3a;border:1px solid #2a5a8a;color:#7ab0f6;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">🔧 ' + msL('Open WOs', 'OT abiertas') + '</button>' +
      '<button onclick="goMaintSection(\'pm\')" style="padding:8px 12px;border-radius:8px;background:#0d1f3a;border:1px solid #2a5a8a;color:#7ab0f6;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">📋 ' + msL('PMs due', 'PM pendientes') + '</button>' +
      '<button onclick="typeof openTierSW===\'function\'&&openTierSW()" style="padding:8px 12px;border-radius:8px;background:#1a1408;border:1px solid #7a5a1a;color:#e8c96a;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">📘 ' + msL('Standard Work', 'Trabajo Estándar') + '</button>' +
    '</div>';
    var todayCard = '<div style="background:#101f10;border:2px solid #4ade80;border-radius:12px;padding:13px 14px;margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
        '<span style="' + MONO + 'font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4ade80;">🎯 ' + msL("Today's Plan", 'Plan de Hoy') + '</span>' +
        '<span style="' + MONO + 'font-size:9px;color:#0a140a;background:#4ade80;border-radius:20px;padding:2px 8px;font-weight:700;">' + MS_DAY_LBL(tk).toUpperCase() + '</span>' +
      '</div>' +
      planRows + (canEdit ? _addForm('date:' + td, 'Danville') : '') + quickLinks +
    '</div>';

    // ── Weekly routine cards ──
    var cards = MS_DAYS.map(function (dk) {
      var list = Array.isArray(days[dk]) ? days[dk] : [];
      var isToday = dk === tk;
      var rows = list.map(function (e, i) { return _entryRow(dk, i, e || {}, canEdit); }).join('') ||
        '<div style="' + MONO + 'font-size:11px;color:#4a6a4a;padding:8px 0;">' + msL('Nothing scheduled.', 'Nada programado.') + '</div>';
      return '<div style="background:' + (isToday ? '#0d1f0d' : '#0c150c') + ';border:1.5px solid ' + (isToday ? '#3a7a3a' : '#1e3a1e') + ';border-radius:12px;padding:12px 14px;">' +
        '<div style="' + MONO + 'font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + (isToday ? '#4ade80' : '#8aa88a') + ';margin-bottom:4px;">' + MS_DAY_LBL(dk) + (isToday ? ' · ' + msL('TODAY', 'HOY') : '') + '</div>' +
        rows + (canEdit ? _addForm(dk, 'Danville') : '') +
      '</div>';
    }).join('');

    host.innerHTML = '<div style="max-width:680px;margin:0 auto;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">' +
        '<span style="' + MONO + 'font-size:14px;font-weight:700;color:#f0ead8;letter-spacing:1px;text-transform:uppercase;">📅 ' + msL('Maintenance Schedule', 'Horario de Mantenimiento') + '</span>' +
        '<span style="' + MONO + 'font-size:9px;color:#4ade80;border:1px solid #2a5a2a;border-radius:20px;padding:2px 8px;">● ' + msL('LIVE', 'EN VIVO') + '</span>' +
        (_canEdit() ? '<button onclick="msEditToggle()" style="margin-left:auto;padding:8px 14px;border-radius:20px;background:' + (_msEdit ? '#3a2f14' : '#0f1a0f') + ';border:1.5px solid ' + (_msEdit ? '#d6b34a' : '#2a5a2a') + ';color:' + (_msEdit ? '#e8c96a' : '#9ad6a0') + ';' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">' + (_msEdit ? '✓ ' + msL('Done editing', 'Listo') : '✏️ ' + msL('Edit', 'Editar')) + '</button>' : '') +
      '</div>' +
      '<div style="' + MONO + 'font-size:10px;color:#7a9a7a;margin-bottom:12px;">' + msL('Set weekly routine + today\'s one-off plan. Tech list shows that site\'s maintenance crew; attach the work instruction to any job.', 'Rutina semanal fija + plan de hoy. La lista muestra el equipo de ese sitio; adjunta la instrucción a cualquier trabajo.') + '</div>' +
      todayCard +
      '<div style="' + MONO + 'font-size:10px;letter-spacing:1.5px;color:#6aa06a;text-transform:uppercase;margin:4px 2px 8px;font-weight:700;">' + msL('Set weekly routine', 'Rutina semanal fija') + '</div>' +
      '<div style="display:grid;gap:10px;">' + cards + '</div>' +
    '</div>';
  }

  // ── Actions ──
  window.msEditToggle = function () { _msEdit = !_msEdit; _msDraw(); };
  window.msOpenWI = function (id) { try { if (typeof openWIView === 'function') openWIView(id); } catch (e) {} };
  window.msSiteChanged = function (bucket) {
    var bid = bucket.replace(/[^a-zA-Z0-9]/g, '_');
    var siteSel = document.getElementById('ms-site-' + bid), techSel = document.getElementById('ms-tech-' + bid);
    if (!siteSel || !techSel) return;
    var names = _msTechs(siteSel.value);
    var cur = techSel.value;
    techSel.innerHTML = '<option value="">' + msL('— tech —', '— técnico —') + '</option>' + names.map(function (n) { return '<option value="' + _esc(n) + '">' + _esc(n) + '</option>'; }).join('');
    if (cur && names.indexOf(cur) !== -1) techSel.value = cur;
  };
  function _bucketList(bucket, make) {
    if (!_msData) _msData = { days: {}, dates: {} };
    if (!_msData.days) _msData.days = {};
    if (!_msData.dates) _msData.dates = {};
    if (bucket.indexOf('date:') === 0) {
      var d = bucket.slice(5);
      if (make && !Array.isArray(_msData.dates[d])) _msData.dates[d] = [];
      return _msData.dates[d];
    }
    if (make && !Array.isArray(_msData.days[bucket])) _msData.days[bucket] = [];
    return _msData.days[bucket];
  }
  window.msAdd = function (bucket) {
    var bid = bucket.replace(/[^a-zA-Z0-9]/g, '_');
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var tech = g('ms-tech-' + bid), site = g('ms-site-' + bid), duty = g('ms-duty-' + bid);
    var start = g('ms-start-' + bid), end = g('ms-end-' + bid), wiId = g('ms-wi-' + bid);
    if (!tech && !duty) { if (typeof toast === 'function') toast(msL('Pick a tech or type a job first', 'Elige un técnico o escribe un trabajo primero')); return; }
    var wiTitle = '';
    if (wiId) { var w = _msWIs().filter(function (x) { return (x.wiId || x._fbId) === wiId; })[0]; wiTitle = w ? (w.title || '') : ''; }
    _bucketList(bucket, true).push({ tech: tech, site: site, duty: duty, start: start, end: end, wiId: wiId, wiTitle: wiTitle, by: (typeof getDeviceUser === 'function' && getDeviceUser()) || '', ts: Date.now() });
    _msDraw();
    _save();
  };
  window.msRemove = function (bucket, i) {
    var list = _bucketList(bucket, false);
    if (!Array.isArray(list)) return;
    list.splice(i, 1);
    _msDraw();
    _save();
  };
  window.renderMaintSchedule = function () { _load(); _msDraw(); };
})();
