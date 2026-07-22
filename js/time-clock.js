// ═══════════════════════════════════════════════════════════════════════════
// time-clock.js — 🕐 TIME CLOCK: daily IN/OUT per employee + week log (EN/ES)
// Everyone (all departments) clocks IN when they arrive and OUT when they
// leave. Live log like everything else: today's punches on every device the
// second they happen, plus a THIS WEEK rollup — hours per person per day and
// week totals. Multiple in/outs per day supported (lunch etc.). NO delete
// button (lesson learned v234) — corrections go through a leader/Joe.
//
// Collection: timeClock (.add per punch) =
//   { name, farm, inTs, outTs, minutes, status:'in'|'out', date, by, ts }
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  function tcL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function _today() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }
  function _fmtT(ts) { try { return ts ? new Date(ts).toLocaleTimeString(tcL('en-US', 'es-ES'), { hour: 'numeric', minute: '2-digit' }) : ''; } catch (e) { return ''; } }
  function _fmtDur(min) { min = Math.max(0, Math.round(min)); var h = Math.floor(min / 60), m = min % 60; return h ? (h + 'h ' + (m < 10 ? '0' : '') + m + 'm') : (m + 'm'); }

  var _tcDocs = [], _tcUnsub = null, _tcTick = null;

  function _ov() {
    var o = document.getElementById('timeclock-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'timeclock-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:958;background:#0a1214;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.openTimeClock = function () { var o = _ov(); o.style.display = 'block'; try { window.scrollTo(0, 0); } catch (e) {} _listen(); _draw(); };
  window.closeTimeClock = function () { var o = document.getElementById('timeclock-overlay'); if (o) o.style.display = 'none'; };

  function _listen() {
    if (_tcUnsub || typeof db === 'undefined' || !db) return;
    var cutoff = Date.now() - 8 * 86400000;
    try {
      _tcUnsub = db.collection('timeClock').where('ts', '>=', cutoff).orderBy('ts', 'desc').onSnapshot(function (snap) {
        _tcDocs = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
        _draw();
      }, function (err) { console.error('timeClock live:', err); });
    } catch (e) { console.error('timeClock listen:', e); }
  }

  function _nameVal() { var el = document.getElementById('tc-name'); return el ? String(el.value || '').trim() : ''; }

  // Name PICKER like the Daily EE Check — pick from the staff list instead of
  // typing (Joe 2026-07-22). ALL active staff (login-roster lesson: never
  // site-scope a sign-in list — people cover other sites). Falls back to a
  // text input if the staff list isn't loaded yet.
  function _nameField(cur) {
    var names = [];
    try {
      if (typeof staffList !== 'undefined' && Array.isArray(staffList)) {
        names = staffList.filter(function (s) { return s && s.active !== false && s.name; })
          .map(function (s) { return s.name; })
          .sort(function (a, b) { return a.localeCompare(b); });
      }
    } catch (e) {}
    if (!names.length) {
      return '<input id="tc-name" list="staff-datalist" value="' + _esc(cur) + '" onchange="renderTimeClock()" placeholder="' + tcL('Type your name', 'Escribe tu nombre') + '" autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1.5px solid #2a5a6a;background:#06121a;color:#e8f5ec;' + MONO + 'font-size:16px;font-weight:700;margin-bottom:12px;">';
    }
    var opts = '<option value="">— ' + tcL('pick your name', 'elige tu nombre') + ' —</option>' +
      names.map(function (n) { var e = _esc(n); return '<option value="' + e + '"' + (n === cur ? ' selected' : '') + '>' + e + '</option>'; }).join('');
    return '<select id="tc-name" onchange="renderTimeClock()" style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1.5px solid #2a5a6a;background:#06121a;color:#e8f5ec;' + MONO + 'font-size:16px;font-weight:700;margin-bottom:12px;">' + opts + '</select>';
  }
  function _openPunch(name) {
    if (!name) return null;
    return _tcDocs.find(function (d) { return d.status === 'in' && !d.outTs && String(d.name || '').toLowerCase() === name.toLowerCase(); }) || null;
  }
  function _farm() { try { var p = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null; return p || ''; } catch (e) { return ''; } }

  window.tcIn = function () {
    var name = _nameVal();
    if (!name) { if (typeof toast === 'function') toast(tcL('Type your name first', 'Escribe tu nombre primero')); var el = document.getElementById('tc-name'); if (el) el.focus(); return; }
    if (_openPunch(name)) { if (typeof toast === 'function') toast(tcL('Already clocked in — clock out first', 'Ya marcaste entrada — marca salida primero')); return; }
    var now = Date.now();
    db.collection('timeClock').add({ name: name, farm: _farm(), inTs: now, outTs: null, minutes: null, status: 'in', date: _today(), by: name, ts: now })
      .then(function () { if (typeof toast === 'function') toast('🕐 ' + _esc(name) + tcL(' clocked IN ', ' entrada ') + _fmtT(now)); })
      .catch(function (e) { console.error('tcIn:', e); if (typeof toast === 'function') toast(tcL('⚠ Clock-in did NOT save — try again', '⚠ NO se guardó — intenta de nuevo')); });
  };
  window.tcOut = function () {
    var name = _nameVal();
    if (!name) { if (typeof toast === 'function') toast(tcL('Type your name first', 'Escribe tu nombre primero')); return; }
    var open = _openPunch(name);
    if (!open) { if (typeof toast === 'function') toast(tcL('No open clock-in for that name', 'No hay entrada abierta para ese nombre')); return; }
    var now = Date.now();
    var mins = Math.max(0, Math.round((now - (open.inTs || now)) / 60000));
    db.collection('timeClock').doc(open._id).update({ outTs: now, minutes: mins, status: 'out', ts: now })
      .then(function () { if (typeof toast === 'function') toast('✅ ' + _esc(name) + tcL(' clocked OUT — ', ' salida — ') + _fmtDur(mins) + tcL(' today', ' hoy')); })
      .catch(function (e) { console.error('tcOut:', e); if (typeof toast === 'function') toast(tcL('⚠ Clock-out did NOT save — try again', '⚠ NO se guardó — intenta de nuevo')); });
  };

  function _draw() {
    var host = document.getElementById('timeclock-overlay');
    if (!host || host.style.display === 'none') return;
    var t = _today();
    var name = _nameVal();
    var open = _openPunch(name);

    // ── TODAY: everyone's punches, newest first ──
    var today = _tcDocs.filter(function (d) { return d.date === t; });
    var inNow = today.filter(function (d) { return d.status === 'in' && !d.outTs; });
    var todayRows = today.slice().sort(function (a, b) { return (b.inTs || 0) - (a.inTs || 0); }).map(function (d) {
      var out = d.outTs ? ('→ ' + _fmtT(d.outTs) + ' · <b style="color:#f0d68a;">' + _fmtDur(d.minutes || 0) + '</b>')
                        : ('<span style="color:#4ade80;">● ' + tcL('in now', 'presente') + ' · ' + _fmtDur((Date.now() - (d.inTs || Date.now())) / 60000) + '</span>');
      return '<div style="display:flex;align-items:center;gap:8px;' + MONO + 'font-size:12px;color:#cfe0e0;padding:7px 0;border-bottom:1px solid #14262a;">' +
        '<b style="flex:1;color:#e8f5ec;">' + _esc(d.name || '—') + '</b>' +
        '<span style="color:#9ab0c0;">' + _fmtT(d.inTs) + ' ' + out + '</span>' +
      '</div>';
    }).join('') || '<div style="' + MONO + 'font-size:12px;color:#5a7a7a;padding:8px 0;">' + tcL('No punches yet today.', 'Sin marcas hoy.') + '</div>';

    // ── THIS WEEK: per-employee totals with day chips ──
    var weekAgo = Date.now() - 7 * 86400000;
    var wk = _tcDocs.filter(function (d) { return (d.inTs || 0) >= weekAgo; });
    var byName = {};
    wk.forEach(function (d) {
      var who = d.name || '—';
      if (!byName[who]) byName[who] = { total: 0, days: {} };
      var m = d.minutes != null ? Number(d.minutes) : (d.status === 'in' && d.inTs ? (Date.now() - d.inTs) / 60000 : 0);
      if (m > 0) { byName[who].total += m; var dd = d.date || '?'; byName[who].days[dd] = (byName[who].days[dd] || 0) + m; }
    });
    var names = Object.keys(byName).sort(function (a, b) { return byName[b].total - byName[a].total; });
    var weekRows = names.map(function (who) {
      var rec = byName[who];
      var chips = Object.keys(rec.days).sort().map(function (dd) {
        return '<span style="background:#0d1f2a;border:1px solid #2a4a5a;border-radius:6px;color:#9cc0d6;padding:2px 7px;margin:2px 3px 0 0;display:inline-block;font-size:10px;">' + dd.slice(5).replace('-', '/') + ' ' + _fmtDur(rec.days[dd]) + '</span>';
      }).join('');
      return '<div style="padding:8px 0;border-bottom:1px solid #14262a;">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
          '<b style="color:#e8f5ec;' + MONO + 'font-size:13px;">' + _esc(who) + '</b>' +
          '<b style="color:#4ade80;' + MONO + 'font-size:14px;">' + _fmtDur(rec.total) + '</b>' +
        '</div>' +
        '<div style="margin-top:3px;">' + chips + '</div>' +
      '</div>';
    }).join('') || '<div style="' + MONO + 'font-size:12px;color:#5a7a7a;padding:8px 0;">' + tcL('No time logged this week yet.', 'Sin tiempo esta semana.') + '</div>';

    // ── Action area ──
    var action;
    if (open) {
      var mins = (Date.now() - (open.inTs || Date.now())) / 60000;
      action = '<div style="background:#0d2a12;border:2px solid #4ade80;border-radius:14px;padding:16px;margin-bottom:14px;text-align:center;">' +
        '<div style="' + MONO + 'font-size:13px;color:#86efac;font-weight:700;">🟢 ' + _esc(name) + ' ' + tcL('is clocked IN since', 'entró a las') + ' ' + _fmtT(open.inTs) + ' · ' + _fmtDur(mins) + '</div>' +
        '<button onclick="tcOut()" style="width:100%;margin-top:12px;padding:18px;border-radius:12px;background:#3a1414;border:2px solid #e5533c;color:#ffb4a6;' + MONO + 'font-size:16px;font-weight:800;cursor:pointer;">🕐 ' + tcL('CLOCK OUT', 'MARCAR SALIDA') + '</button>' +
      '</div>';
    } else {
      action = '<button onclick="tcIn()" style="width:100%;padding:18px;border-radius:12px;background:#14361c;border:2px solid #4ade80;color:#86efac;' + MONO + 'font-size:16px;font-weight:800;cursor:pointer;margin-bottom:14px;">🕐 ' + tcL('CLOCK IN', 'MARCAR ENTRADA') + '</button>';
    }

    host.innerHTML = '<div style="max-width:640px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">' +
        '<button onclick="closeTimeClock()" style="padding:11px 16px;background:#0d1a1e;border:1.5px solid #2a5a6a;border-radius:50px;color:#9ad6d6;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + tcL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:2px;line-height:1;color:#f0ead8;">🕐 ' + tcL('TIME CLOCK', 'RELOJ') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#7ab0b0;margin-top:2px;">● ' + tcL('LIVE', 'EN VIVO') + ' · ' + (inNow.length) + ' ' + tcL('in now', 'presentes') + '</div>' +
        '</div>' +
      '</div>' +
      '<label style="' + MONO + 'font-size:10px;letter-spacing:1px;color:#5a8a9a;text-transform:uppercase;display:block;margin-bottom:4px;">' + tcL('Your name', 'Tu nombre') + '</label>' +
      _nameField(name) +
      action +
      '<div style="' + MONO + 'font-size:10px;letter-spacing:1px;color:#5a8a9a;text-transform:uppercase;margin-bottom:6px;">📅 ' + tcL('Today', 'Hoy') + ' · ' + t + '</div>' +
      '<div style="background:#0c181c;border:1px solid #1e3a44;border-radius:10px;padding:4px 12px;margin-bottom:14px;">' + todayRows + '</div>' +
      '<div style="' + MONO + 'font-size:10px;letter-spacing:1px;color:#5a8a9a;text-transform:uppercase;margin-bottom:6px;">📆 ' + tcL('This week · hours by employee', 'Esta semana · horas por empleado') + '</div>' +
      '<div style="background:#0c181c;border:1px solid #1e3a44;border-radius:10px;padding:4px 12px;">' + weekRows + '</div>' +
    '</div>';

    // Live elapsed tick while anyone is clocked in.
    if (_tcTick) { clearInterval(_tcTick); _tcTick = null; }
    if (inNow.length) _tcTick = setInterval(function () { var o = document.getElementById('timeclock-overlay'); if (o && o.style.display !== 'none') _draw(); else { clearInterval(_tcTick); _tcTick = null; } }, 30000);
  }
  window.renderTimeClock = _draw;
})();
