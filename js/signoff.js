// ═══════════════════════════════════════════════════════════════════════════
// signoff.js — 📋 MY SIGN-OFFS: every employee gets their position's packet
// (Joe 2026-08-03: "each person will get the work instructions and so on and
// will read and sign off by clicking the button. tell them to read and improve
// if needed. all through the app, no paperwork. signoff for each position.")
//
// • _soCards(person) maps role/dept/farm → required Standard Work cards.
// • Every active employee is also required to sign EVERY SOP work instruction.
// • openMySignoffs() — the employee's packet: read → sign → done, with a
//   💡 "suggest an improvement" box on every document (saves to sopFeedback).
// • openSignoffBoard() — leader coverage: who HASN'T signed what, worst first.
// • _soNag() — once a day, the device's signed-in user gets a banner if they
//   still owe signatures. That's how each person "gets" their packet.
// Signatures live in sopSignoffs (written by sopAccept in maintenance.js).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  function soL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Titles for the SW cards (slug → [en, es]) — MUST match tier-sw.js titles.
  var SW_TITLES = {
    'barn-leader-hegins':                  ['Barn Leader — Hegins', 'Líder de Casas — Hegins'],
    'barn-leader-danville':                ['Barn Leader — Danville', 'Líder de Casas — Danville'],
    'barn-crew-daily-employee-check':      ['Barn Crew — Daily Employee Check', 'Personal de Casas — Revisión Diaria'],
    'maintenance-leader':                  ['Maintenance Leader', 'Líder de Mantenimiento'],
    'maintenance-front-end-flow-protector':['Maintenance — Front-End Flow Protector', 'Mantenimiento — Protector de Flujo (Frente)'],
    'maintenance-back-end-manure-runner':  ['Maintenance — Back-End / Manure Runner', 'Mantenimiento — Trasero / Estiércol'],
    'maintenance-lead':                    ['Maintenance — Lead', 'Mantenimiento — Líder'],
    'egg-packer':                          ['Egg Packer', 'Empacador de Huevos'],
    'processing-line-crew':                ['Processing Line Crew', 'Personal de Línea — Procesamiento'],
    'processing-leader':                   ['Processing Leader', 'Líder de Procesamiento'],
    'feed-mill-leader':                    ['Feed Mill Leader', 'Líder del Molino'],
    'driver':                              ['Driver', 'Chofer'],
    'director-ops':                        ['Director / Ops', 'Director / Operaciones']
  };

  function _deptOf(s) {
    try { if (typeof staffDeptOf === 'function') return staffDeptOf(s); } catch (e) {}
    if (!s) return 'Barns';
    if (s.dept) return s.dept;
    if (s.farm === 'Processing Plant') return 'Processing';
    var r = s.role || '';
    if (r === 'WNO' || r === 'Barn Worker') return 'Barns';
    if (r === 'Feed Mill') return 'Feed Mill';
    if (r === 'Technician' || r === 'Lead' || r === 'Director' || r === 'Driver') return 'Maintenance';
    return 'Barns';
  }

  // POSITION → required Standard Work cards.
  function _soCards(s) {
    if (!s) return [];
    var role = s.role || '', farm = s.farm || '', dept = _deptOf(s);
    if (role === 'Director') return ['director-ops'];
    if (role === 'Driver')   return ['driver'];
    if (dept === 'Feed Mill') return ['feed-mill-leader'];
    if (dept === 'Processing') return role === 'Lead' ? ['processing-leader'] : ['processing-line-crew', 'egg-packer'];
    if (dept === 'Maintenance') {
      if (role === 'Lead') return ['maintenance-lead', 'maintenance-leader'];
      return ['maintenance-front-end-flow-protector', 'maintenance-back-end-manure-runner'];
    }
    // Barns / production floor
    if (role === 'Lead' || role === 'WNO') {
      if (farm === 'Hegins') return ['barn-leader-hegins'];
      if (farm === 'Danville') return ['barn-leader-danville'];
      return ['barn-leader-hegins', 'barn-leader-danville'];   // Both / All
    }
    return ['barn-crew-daily-employee-check', 'egg-packer'];    // crew runs the egg run too
  }

  // All SOP work instructions (from the live WI cache, fallback direct query).
  function _soSOPs() {
    var list = (typeof allWI !== 'undefined' && Array.isArray(allWI)) ? allWI : [];
    return list.filter(function (w) { return /^SOP/i.test(String(w.wiId || '')) || /^SOP\b/i.test(String(w.title || '')); });
  }

  // Full requirement list for one person: [{key, title, kind:'sop'|'sw', wiKey}]
  function _soReqs(s) {
    var reqs = [];
    _soSOPs().forEach(function (w) {
      // upd = last edit — a signature OLDER than this needs a re-sign (v273).
      reqs.push({ key: String(w.wiId || w._fbId), title: String(w.title || w.wiId), kind: 'sop', wiKey: String(w.wiId || w._fbId), upd: Number(w.updatedTs) || 0 });
    });
    _soCards(s).forEach(function (slug) {
      var t = SW_TITLES[slug] || [slug, slug];
      reqs.push({ key: 'SW:' + slug, title: soL(t[0], t[1]), kind: 'sw' });
    });
    return reqs;
  }

  function _staffByName(name) {
    var list = (typeof staffList !== 'undefined' && Array.isArray(staffList)) ? staffList : [];
    var n = String(name || '').trim().toLowerCase();
    return list.find(function (s) { return s && String(s.name || '').trim().toLowerCase() === n; }) || null;
  }
  function _activeStaff() {
    var list = (typeof staffList !== 'undefined' && Array.isArray(staffList)) ? staffList : [];
    return list.filter(function (s) { return s && s.name && s.active !== false; });
  }
  function _signedSetFor(rows, name) {
    // Keep the NEWEST signature per document (people can re-sign after edits).
    var n = String(name || '').trim().toLowerCase(), set = {};
    rows.forEach(function (r) {
      if (String(r.employee || '').trim().toLowerCase() !== n) return;
      var k = String(r.sopId), ts = Number(r.ts) || 0;
      if (!set[k] || ts > set[k].ts) set[k] = { date: r.date || '✓', ts: ts };
    });
    return set;
  }
  function _soOk(sig, req) { return !!sig && (!req.upd || sig.ts >= req.upd); }
  function _allSignoffs() {
    return db.collection('sopSignoffs').get().then(function (snap) {
      var rows = []; snap.forEach(function (d) { rows.push(d.data()); }); return rows;
    });
  }

  function _ovEl(id, z) {
    var o = document.getElementById(id);
    if (!o) {
      o = document.createElement('div');
      o.id = id; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:' + z + ';background:#0a1206;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }

  // ── 📋 MY SIGN-OFFS (the employee packet) ──
  window.openMySignoffs = function (presetName) {
    var o = _ovEl('so-overlay', 958);
    var me = presetName || (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : '');
    o.innerHTML = '<div style="max-width:680px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeMySignoffs()" style="padding:11px 16px;background:#0d1f0d;border:1.5px solid #2a5a2a;border-radius:50px;color:#7ab07a;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + soL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;letter-spacing:2px;line-height:1;color:#e8f5ec;">📋 ' + soL('MY SIGN-OFFS', 'MIS FIRMAS') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:2px;">' + soL('Your position\'s packet — read each one, then sign it', 'El paquete de tu puesto — lee cada uno y fírmalo') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
        '<input list="staff-datalist" id="so-me" value="' + _esc(me) + '" placeholder="' + soL('Your name', 'Tu nombre') + '" autocomplete="off" style="flex:1;background:#0a1408;border:1.5px solid #2a5a2a;border-radius:10px;color:#f0ead8;' + MONO + 'font-size:15px;font-weight:700;padding:12px;">' +
        '<button onclick="openMySignoffs(document.getElementById(\'so-me\').value)" style="padding:12px 16px;background:#1f7a3a;border:1.5px solid #2a9a4a;border-radius:10px;color:#eafff0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">→</button>' +
      '</div>' +
      '<div id="so-list" style="' + MONO + 'font-size:12px;color:#7ab07a;">' + (me ? soL('Loading your packet…', 'Cargando tu paquete…') : soL('Type your name to see your packet.', 'Escribe tu nombre para ver tu paquete.')) + '</div>' +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}
    if (me) _soRenderPacket(me);
  };
  window.closeMySignoffs = function () { var o = document.getElementById('so-overlay'); if (o) o.style.display = 'none'; };

  function _soRenderPacket(name) {
    var host = document.getElementById('so-list'); if (!host) return;
    var st = _staffByName(name);
    var reqs = _soReqs(st || { role: '', farm: '', dept: '' });
    if (!reqs.length) { host.innerHTML = soL('No documents found yet.', 'Aún no hay documentos.'); return; }
    _allSignoffs().then(function (rows) {
      var signed = _signedSetFor(rows, name);
      var missing = reqs.filter(function (r) { return !_soOk(signed[r.key], r); }).length;
      var head =
        '<div style="background:' + (missing ? '#231a08' : '#07240f') + ';border:1.5px solid ' + (missing ? '#7a5a1a' : '#1f7a3a') + ';border-radius:10px;padding:11px 13px;margin-bottom:11px;' + MONO + 'font-size:12.5px;color:' + (missing ? '#e8c96a' : '#4ade80') + ';font-weight:700;">' +
        (missing ? ('⚠ ' + _esc(name) + ' — ' + missing + ' ' + soL('document(s) left to read & sign', 'documento(s) por leer y firmar'))
                 : ('✅ ' + _esc(name) + ' — ' + soL('all signed. Thank you.', 'todo firmado. Gracias.'))) +
        (st ? '' : ('<div style="font-size:10px;font-weight:400;color:#a08a4a;margin-top:4px;">' + soL('Name not on the roster — showing the base packet (all SOPs + barn crew).', 'Nombre fuera de la lista — mostrando el paquete base.') + '</div>')) +
        '</div>';
      var items = reqs.map(function (r) {
        var sig = signed[r.key];
        var stale = sig && r.upd && sig.ts < r.upd;   // signed BEFORE the latest edit
        var done = _soOk(sig, r);
        var openBtn = r.kind === 'sop'
          ? '<button onclick="closeMySignoffs();if(typeof openWIView===\'function\')openWIView(\'' + _esc(r.wiKey) + '\')" style="padding:9px 13px;background:#0d1f3a;border:1.5px solid #3b82f6;border-radius:8px;color:#9cc0f6;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">📖 ' + soL('READ & SIGN', 'LEER Y FIRMAR') + '</button>'
          : '<button onclick="closeMySignoffs();if(typeof openTierSW===\'function\')openTierSW()" style="padding:9px 13px;background:#0d1f3a;border:1.5px solid #3b82f6;border-radius:8px;color:#9cc0f6;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">📘 ' + soL('READ & SIGN', 'LEER Y FIRMAR') + '</button>';
        return '<div style="display:flex;align-items:center;gap:10px;background:#10190c;border:1.5px solid ' + (done ? '#1f7a3a' : '#5a4a2a') + ';border-radius:10px;padding:10px 12px;margin-bottom:7px;">' +
          '<span style="font-size:17px;">' + (done ? '✅' : stale ? '🔁' : '🔴') + '</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="' + MONO + 'font-size:12px;font-weight:700;color:#e8f5ec;line-height:1.35;">' + _esc(r.title) + '</div>' +
            '<div style="' + MONO + 'font-size:9.5px;color:' + (stale ? '#e8c96a' : '#5a8a5a') + ';margin-top:2px;">' + (r.kind === 'sop' ? 'SOP' : soL('Job requirements', 'Requisitos del puesto')) + (done ? (' · ' + soL('signed', 'firmado') + ' ' + _esc(sig.date)) : stale ? (' · ' + soL('UPDATED since you signed — read & sign again', 'ACTUALIZADO después de tu firma — lee y firma de nuevo')) : '') + '</div>' +
          '</div>' +
          (done ? '' : openBtn) +
        '</div>';
      }).join('');
      var improve =
        '<div style="background:#171207;border:1.5px solid #3a2f14;border-radius:10px;padding:12px;margin-top:14px;">' +
          '<div style="' + MONO + 'font-size:10px;font-weight:700;letter-spacing:1px;color:#d6b34a;text-transform:uppercase;margin-bottom:5px;">💡 ' + soL('See a better way? Tell us', '¿Ves una mejor forma? Dinos') + '</div>' +
          '<div style="' + MONO + 'font-size:11px;color:#c9b478;line-height:1.5;margin-bottom:8px;">' + soL('Read it, and if something is wrong or could be better — write it here. Improvements are how these documents get good.', 'Léelo, y si algo está mal o puede mejorar — escríbelo aquí. Las mejoras hacen buenos estos documentos.') + '</div>' +
          '<textarea id="so-fb-text" rows="2" placeholder="' + soL('Which document + your idea…', 'Qué documento + tu idea…') + '" style="width:100%;box-sizing:border-box;background:#0a1408;border:1.5px solid #3a2f14;border-radius:8px;color:#f0ead8;' + MONO + 'font-size:12px;padding:9px;"></textarea>' +
          '<button onclick="soSendFeedback(\'' + _esc(name).replace(/'/g, "\\'") + '\')" style="margin-top:7px;padding:10px 16px;background:#5a4a1a;border:1.5px solid #7a5a1a;border-radius:8px;color:#f0d68a;' + MONO + 'font-size:11.5px;font-weight:700;cursor:pointer;">💡 ' + soL('SEND IMPROVEMENT', 'ENVIAR MEJORA') + '</button>' +
        '</div>';
      host.innerHTML = head + items + improve;
    }).catch(function (e) { console.error('signoff packet:', e); host.innerHTML = soL('Could not load — check connection.', 'No se pudo cargar — revisa la conexión.'); });
  }

  window.soSendFeedback = function (name) {
    var ta = document.getElementById('so-fb-text');
    var txt = ta ? ta.value.trim() : '';
    if (!txt) { if (typeof toast === 'function') toast(soL('Write your idea first', 'Escribe tu idea primero')); return; }
    db.collection('sopFeedback').add({
      employee: name || (typeof getDeviceUser === 'function' ? getDeviceUser() : ''), text: txt,
      date: (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10),
      ts: Date.now(), appVersion: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '')
    }).then(function () {
      if (ta) ta.value = '';
      if (typeof toast === 'function') toast('💡 ' + soL('Thank you — sent to the leaders', 'Gracias — enviado a los líderes'));
    }).catch(function () { if (typeof toast === 'function') toast(soL('Could not send — try again', 'No se pudo enviar — intenta de nuevo')); });
  };

  // ── 📊 COVERAGE BOARD (leaders): who HASN'T signed ──
  window.openSignoffBoard = function () {
    var o = _ovEl('sob-overlay', 959);
    o.innerHTML = '<div style="max-width:860px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeSignoffBoard()" style="padding:11px 16px;background:#0d1f0d;border:1.5px solid #2a5a2a;border-radius:50px;color:#7ab07a;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + soL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;letter-spacing:2px;line-height:1;color:#e8f5ec;">📊 ' + soL('SIGN-OFF COVERAGE', 'COBERTURA DE FIRMAS') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#5a8a5a;margin-top:2px;">' + soL('Red = still owes a signature', 'Rojo = aún debe una firma') + '</div>' +
        '</div>' +
      '</div>' +
      '<div id="sob-body" style="' + MONO + 'font-size:12px;color:#7ab07a;">' + soL('Loading…', 'Cargando…') + '</div>' +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}
    Promise.all([_allSignoffs(), db.collection('sopFeedback').get().catch(function () { return null; })]).then(function (res) {
      var rows = res[0];
      var fb = []; if (res[1]) res[1].forEach(function (d) { fb.push(d.data()); });
      fb.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      var body = document.getElementById('sob-body'); if (!body) return;
      var people = _activeStaff().map(function (s) {
        var reqs = _soReqs(s), signed = _signedSetFor(rows, s.name);
        var miss = reqs.filter(function (r) { return !_soOk(signed[r.key], r); })
          .map(function (r) { var sig = signed[r.key]; return Object.assign({}, r, { stale: !!(sig && r.upd && sig.ts < r.upd) }); });
        return { s: s, reqs: reqs, miss: miss };
      }).sort(function (a, b) { return b.miss.length - a.miss.length || String(a.s.name).localeCompare(String(b.s.name)); });
      var total = 0, done = 0;
      people.forEach(function (p) { total += p.reqs.length; done += (p.reqs.length - p.miss.length); });
      var pct = total ? Math.round(done / total * 100) : 0;
      var html =
        '<div style="background:#10190c;border:1.5px solid #2a5a2a;border-radius:10px;padding:12px 14px;margin-bottom:12px;' + MONO + '">' +
          '<span style="font-size:22px;font-weight:700;color:' + (pct >= 95 ? '#4ade80' : pct >= 75 ? '#e8c96a' : '#f0a0a0') + ';">' + pct + '%</span> ' +
          '<span style="font-size:11px;color:#7a9a7a;">' + soL('of required signatures collected', 'de las firmas requeridas recolectadas') + ' · ' + done + '/' + total + ' · ' + people.length + ' ' + soL('people', 'personas') + '</span>' +
        '</div>' +
        people.map(function (p) {
          var ok = !p.miss.length;
          return '<div style="background:#10190c;border:1.5px solid ' + (ok ? '#1f7a3a' : '#7a2a2a') + ';border-radius:10px;padding:10px 12px;margin-bottom:7px;">' +
            '<div style="display:flex;align-items:center;gap:9px;">' +
              '<span style="font-size:15px;">' + (ok ? '✅' : '🔴') + '</span>' +
              '<b style="' + MONO + 'font-size:12.5px;color:#e8f5ec;flex:1;">' + _esc(p.s.name) + '</b>' +
              '<span style="' + MONO + 'font-size:10px;color:#7a9a7a;">' + _esc(p.s.role || '') + (p.s.farm ? ' · ' + _esc(p.s.farm) : '') + '</span>' +
              '<span style="' + MONO + 'font-size:11px;font-weight:700;color:' + (ok ? '#4ade80' : '#f0a0a0') + ';">' + (p.reqs.length - p.miss.length) + '/' + p.reqs.length + '</span>' +
            '</div>' +
            (ok ? '' : '<div style="' + MONO + 'font-size:10px;color:#d09090;margin-top:5px;line-height:1.6;">' + soL('Missing', 'Falta') + ': ' + p.miss.map(function (m) { return _esc(m.title) + (m.stale ? ' <span style=\"color:#e8c96a;\">(' + soL('re-sign — updated', 'refirmar — actualizado') + ')</span>' : ''); }).join(' · ') + '</div>') +
          '</div>';
        }).join('') +
        (fb.length ?
          '<div style="' + MONO + 'font-size:10px;font-weight:700;letter-spacing:1px;color:#d6b34a;text-transform:uppercase;margin:16px 2px 7px;">💡 ' + soL('Improvement ideas from the crew', 'Ideas de mejora del equipo') + ' (' + fb.length + ')</div>' +
          fb.slice(0, 12).map(function (f) {
            return '<div style="background:#171207;border:1px solid #3a2f14;border-radius:9px;padding:9px 11px;margin-bottom:6px;' + MONO + 'font-size:11px;color:#e8dfc8;line-height:1.5;">' +
              _esc(f.text) + '<div style="font-size:9px;color:#a08a4a;margin-top:3px;">— ' + _esc(f.employee || '?') + ' · ' + _esc(f.date || '') + '</div></div>';
          }).join('') : '');
      body.innerHTML = html;
    }).catch(function (e) { console.error('signoff board:', e); var b = document.getElementById('sob-body'); if (b) b.innerHTML = soL('Could not load.', 'No se pudo cargar.'); });
  };
  window.closeSignoffBoard = function () { var o = document.getElementById('sob-overlay'); if (o) o.style.display = 'none'; };

  // ── Daily nag: the signed-in user owes signatures → one-tap banner ──
  function _soNag() {
    try {
      if (typeof db === 'undefined' || !db) return;
      var me = (typeof getDeviceUser === 'function') ? (getDeviceUser() || '').trim() : '';
      if (!me) return;
      var day = (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10);
      var lsKey = 'soNag-' + day;
      try { if (localStorage.getItem(lsKey)) return; } catch (e) {}
      var st = _staffByName(me);
      var reqs = _soReqs(st || { role: '', farm: '' });
      if (!reqs.length) return;
      db.collection('sopSignoffs').where('employee', '==', me).get().then(function (snap) {
        var set = {}; snap.forEach(function (d) { var r = d.data(); var k = String(r.sopId), ts = Number(r.ts) || 0; if (!set[k] || ts > set[k]) set[k] = ts; });
        var missing = reqs.filter(function (r) { return !set[r.key] || (r.upd && set[r.key] < r.upd); }).length;
        if (!missing) return;
        if (document.getElementById('so-nag')) return;
        var n = document.createElement('div');
        n.id = 'so-nag';
        n.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:955;background:#231a08;border:2px solid #d6b34a;border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:11px;box-shadow:0 8px 30px rgba(0,0,0,.55);';
        n.innerHTML = '<span style="font-size:22px;">📋</span>' +
          '<div style="flex:1;' + MONO + 'font-size:12px;color:#f0d68a;line-height:1.45;"><b>' + _esc(me) + '</b> — ' + missing + ' ' + soL('document(s) to read & sign for your position.', 'documento(s) por leer y firmar para tu puesto.') + '</div>' +
          '<button onclick="document.getElementById(\'so-nag\').remove();try{localStorage.setItem(\'' + lsKey + '\',\'1\')}catch(e){};openMySignoffs()" style="padding:10px 14px;background:#1f7a3a;border:1.5px solid #2a9a4a;border-radius:9px;color:#eafff0;' + MONO + 'font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;">' + soL('OPEN', 'ABRIR') + '</button>' +
          '<button onclick="document.getElementById(\'so-nag\').remove();try{localStorage.setItem(\'' + lsKey + '\',\'1\')}catch(e){}" style="background:none;border:none;color:#a08a4a;font-size:18px;cursor:pointer;padding:0 2px;">✕</button>';
        document.body.appendChild(n);
      }).catch(function () {});
    } catch (e) {}
  }
  // Staff + WI caches need a moment to fill; check twice, quietly.
  setTimeout(_soNag, 6000);
  setTimeout(_soNag, 25000);
})();
