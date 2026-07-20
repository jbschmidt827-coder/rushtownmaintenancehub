// ═══════════════════════════════════════════════════════════════════════════
// maint-schedule.js — MAINTENANCE SET WEEKLY SCHEDULE (EN/ES)
// A fixed weekly routine: each day of the week has set duties per tech
// (name · site · duty · optional start/end time). Same every week. Leaders
// edit it in the app; techs see TODAY highlighted when they open the tab.
// Live via onSnapshot so every tablet sees edits instantly.
//
// Data: settings/maintSchedule = { days: { mon:[{tech,site,duty,start,end}...],
// tue:[…], … } }. Entries carry optional start/end (shift control) and are
// shaped so WO/PM day-assignment can be added later (optional woId/pmId).
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

  var _msData = null;      // {days:{mon:[...],...}}
  var _msUnsub = null;
  var _msEdit = false;     // leader edit mode toggle

  function _todayKey() { return MS_DAYS[(new Date().getDay() + 6) % 7]; }

  function _canEdit() {
    // Same fail-open pattern as access.js: only restrict when login is ON.
    try {
      if (typeof isLoggedIn === 'function' && isLoggedIn()) {
        return (typeof _isLeader === 'function') ? !!_isLeader() : true;
      }
    } catch (e) {}
    return true;
  }

  function _load() {
    if (_msUnsub || typeof db === 'undefined' || !db) return;
    try {
      _msUnsub = db.collection('settings').doc('maintSchedule').onSnapshot(function (doc) {
        _msData = (doc.exists && doc.data()) || { days: {} };
        if (!_msData.days) _msData.days = {};
        _msDraw();
      }, function (err) { console.error('maintSchedule listener:', err); });
    } catch (e) { console.error('maintSchedule load:', e); }
  }

  function _save() {
    if (typeof db === 'undefined' || !db || !_msData) return;
    db.collection('settings').doc('maintSchedule').set(_msData, { merge: false })
      .then(function () { if (typeof toast === 'function') toast(msL('✅ Schedule saved', '✅ Horario guardado')); })
      .catch(function (e) { console.error('maintSchedule save:', e); if (typeof toast === 'function') toast(msL('⚠ Save failed — try again', '⚠ No se guardó — intenta de nuevo')); });
  }

  function _entryRow(dk, i, e, canEdit) {
    var time = (e.start || e.end) ? '<span style="color:#d6b34a;">' + _esc(e.start || '') + (e.end ? '–' + _esc(e.end) : '') + '</span> · ' : '';
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #16281680;">' +
      '<span style="flex:1;' + MONO + 'font-size:12px;color:#d8e8d8;line-height:1.5;">' +
        time + '<b style="color:#9ad6a0;">' + _esc(e.tech || '—') + '</b>' +
        (e.site ? ' <span style="color:#7ab0f6;">@ ' + _esc(e.site) + '</span>' : '') +
        (e.duty ? '<br><span style="color:#b8c8b8;">' + _esc(e.duty) + '</span>' : '') +
      '</span>' +
      (canEdit ? '<button onclick="msRemove(\'' + dk + '\',' + i + ')" style="background:none;border:none;color:#7a4a4a;cursor:pointer;font-size:15px;padding:4px 6px;">✕</button>' : '') +
    '</div>';
  }

  function _addForm(dk) {
    var siteOpts = MS_SITES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
    return '<div style="background:#0a1a0a;border:1px dashed #2a5a2a;border-radius:9px;padding:9px;margin-top:8px;">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' +
        '<input id="ms-tech-' + dk + '" list="staff-datalist" placeholder="' + msL('Tech name', 'Nombre') + '" autocomplete="off" style="flex:2;min-width:110px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:13px;">' +
        '<select id="ms-site-' + dk + '" style="flex:1;min-width:100px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:12px;"><option value="">' + msL('site', 'sitio') + '</option>' + siteOpts + '</select>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<input id="ms-duty-' + dk + '" placeholder="' + msL('Duty (e.g. Fans + PMs houses 4-6)', 'Tarea (ej. Ventiladores + PM casas 4-6)') + '" style="flex:3;min-width:150px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:12px;">' +
        '<input id="ms-start-' + dk + '" placeholder="' + msL('start', 'inicio') + '" style="flex:0 0 62px;padding:9px 6px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:12px;">' +
        '<input id="ms-end-' + dk + '" placeholder="' + msL('end', 'fin') + '" style="flex:0 0 62px;padding:9px 6px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:12px;">' +
        '<button onclick="msAdd(\'' + dk + '\')" style="flex:0 0 auto;padding:9px 14px;border-radius:8px;background:#14361c;border:1.5px solid #4ade80;color:#4ade80;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">+ ' + msL('Add', 'Agregar') + '</button>' +
      '</div>' +
    '</div>';
  }

  function _msDraw() {
    var host = document.getElementById('maint-schedule');
    if (!host) return;
    var canEdit = _canEdit() && _msEdit;
    var tk = _todayKey();
    var days = (_msData && _msData.days) || {};

    var cards = MS_DAYS.map(function (dk) {
      var list = Array.isArray(days[dk]) ? days[dk] : [];
      var isToday = dk === tk;
      var rows = list.map(function (e, i) { return _entryRow(dk, i, e || {}, canEdit); }).join('') ||
        '<div style="' + MONO + 'font-size:11px;color:#4a6a4a;padding:8px 0;">' + msL('Nothing scheduled.', 'Nada programado.') + '</div>';
      return '<div style="background:' + (isToday ? '#0d1f0d' : '#0c150c') + ';border:1.5px solid ' + (isToday ? '#4ade80' : '#1e3a1e') + ';border-radius:12px;padding:12px 14px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
          '<span style="' + MONO + 'font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + (isToday ? '#4ade80' : '#8aa88a') + ';">' + MS_DAY_LBL(dk) + '</span>' +
          (isToday ? '<span style="' + MONO + 'font-size:9px;color:#0a140a;background:#4ade80;border-radius:20px;padding:2px 8px;font-weight:700;">' + msL('TODAY', 'HOY') + '</span>' : '') +
        '</div>' +
        rows + (canEdit ? _addForm(dk) : '') +
      '</div>';
    }).join('');

    host.innerHTML = '<div style="max-width:680px;margin:0 auto;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">' +
        '<span style="' + MONO + 'font-size:14px;font-weight:700;color:#f0ead8;letter-spacing:1px;text-transform:uppercase;">📅 ' + msL('Set Weekly Schedule', 'Horario Semanal Fijo') + '</span>' +
        '<span style="' + MONO + 'font-size:9px;color:#4ade80;border:1px solid #2a5a2a;border-radius:20px;padding:2px 8px;">● ' + msL('LIVE', 'EN VIVO') + '</span>' +
        (_canEdit() ? '<button onclick="msEditToggle()" style="margin-left:auto;padding:8px 14px;border-radius:20px;background:' + (_msEdit ? '#3a2f14' : '#0f1a0f') + ';border:1.5px solid ' + (_msEdit ? '#d6b34a' : '#2a5a2a') + ';color:' + (_msEdit ? '#e8c96a' : '#9ad6a0') + ';' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">' + (_msEdit ? '✓ ' + msL('Done editing', 'Listo') : '✏️ ' + msL('Edit', 'Editar')) + '</button>' : '') +
      '</div>' +
      '<div style="' + MONO + 'font-size:10px;color:#7a9a7a;margin-bottom:12px;">' + msL('The same plan every week. Leaders tap Edit to change it; everyone sees it live.', 'El mismo plan cada semana. Los líderes tocan Editar; todos lo ven en vivo.') + '</div>' +
      '<div style="display:grid;gap:10px;">' + cards + '</div>' +
    '</div>';
  }

  // ── Actions ──
  window.msEditToggle = function () { _msEdit = !_msEdit; _msDraw(); };
  window.msAdd = function (dk) {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var tech = g('ms-tech-' + dk), site = g('ms-site-' + dk), duty = g('ms-duty-' + dk);
    var start = g('ms-start-' + dk), end = g('ms-end-' + dk);
    if (!tech && !duty) { if (typeof toast === 'function') toast(msL('Enter a name or duty first', 'Escribe un nombre o tarea primero')); return; }
    if (!_msData) _msData = { days: {} };
    if (!Array.isArray(_msData.days[dk])) _msData.days[dk] = [];
    _msData.days[dk].push({ tech: tech, site: site, duty: duty, start: start, end: end, by: (typeof getDeviceUser === 'function' && getDeviceUser()) || '', ts: Date.now() });
    _msDraw();   // instant local echo; snapshot confirms
    _save();
  };
  window.msRemove = function (dk, i) {
    if (!_msData || !Array.isArray(_msData.days[dk])) return;
    _msData.days[dk].splice(i, 1);
    _msDraw();
    _save();
  };
  window.renderMaintSchedule = function () { _load(); _msDraw(); };
})();
