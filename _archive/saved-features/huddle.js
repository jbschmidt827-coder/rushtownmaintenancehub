// ═══════════════════════════════════════════════════════════════════════════
// huddle.js — Daily Huddle → Tier 2 (capture · report up · drive to closure) EN/ES
// Replaces the paper/spreadsheet "Daily Huddle Talking Points". Each morning the
// crew records Attendance + Recognition and logs OPEN ISSUES (Safety / Open
// Project / Need-from-leadership). Issues STAY OPEN — with a running day-count —
// until someone resolves them, so recurring problems get escalated up to the
// Tier 2 leadership meeting and actually driven to closure instead of re-typed
// every day. A Safety issue can spin off a Work Order so it gets fixed + tracked.
// Firestore: huddleIssues (persistent) + huddleLog (daily attendance/recognition).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var CATS = {
    safety:  { en: 'Safety',           es: 'Seguridad',   icon: '⚠️', col: '#e05656', bg: '#2a1010', bd: '#7a2a2a' },
    project: { en: 'Open Project',     es: 'Proyecto',    icon: '🛠', col: '#d69e2e', bg: '#241d05', bd: '#7a5a1a' },
    support: { en: 'Need from leadership', es: 'Apoyo de gerencia', icon: '🙋', col: '#5aa0e0', bg: '#0d1f3a', bd: '#2a4a7a' },
    other:   { en: 'Other',            es: 'Otro',        icon: '📌', col: '#8a9a8a', bg: '#141a14', bd: '#2a3a2a' }
  };

  var _hudIssues = [];
  var _hudLog = [];
  var _hudUnsub = [];
  var _hudTick = null;
  var _hudNewCat = 'safety';
  var _hudNewWO = true;   // default: make a WO for a new safety issue

  function _hlang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
  function HL(en, es) { return _hlang() === 'es' ? es : en; }
  function _today() { return new Date().toISOString().slice(0, 10); }
  function _by() { return (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : ''); }
  function _farm() { var f = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null; return f || 'All'; }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _ageDays(ts) { if (!ts) return 0; return Math.floor((Date.now() - ts) / 86400000); }
  function _ageLabel(ts) {
    var d = _ageDays(ts);
    if (d <= 0) return HL('today', 'hoy');
    if (d === 1) return HL('1 day open', '1 día abierto');
    return d + HL(' days open', ' días abierto');
  }

  // ── Live listeners ──────────────────────────────────────────────────────
  function _hudArm() {
    if (_hudUnsub.length || typeof db === 'undefined' || !db) return;
    try {
      _hudUnsub.push(db.collection('huddleIssues').orderBy('ts', 'desc').limit(300).onSnapshot(function (s) {
        _hudIssues = s.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });
        _hudKick();
      }, function () {}));
      _hudUnsub.push(db.collection('huddleLog').where('date', '==', _today()).limit(20).onSnapshot(function (s) {
        _hudLog = s.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });
        _hudKick();
      }, function () {}));
    } catch (e) { console.error('huddle arm:', e); }
  }
  function _hudDisarm() { _hudUnsub.forEach(function (u) { try { u(); } catch (e) {} }); _hudUnsub = []; }
  function _hudKick() { var ov = document.getElementById('huddle-overlay'); if (ov && ov.style.display !== 'none') renderHuddle(); }

  function _hudScope() {
    var f = _farm();
    return _hudIssues.filter(function (r) { return f === 'All' || !r.farm || r.farm === f || r.farm === 'All'; });
  }
  function _openIssues() { return _hudScope().filter(function (r) { return r.status !== 'resolved'; }); }
  function _todayLog() { var f = _farm(); return _hudLog.find(function (r) { return (f === 'All' || r.farm === f); }); }

  // ── Actions ──────────────────────────────────────────────────────────────
  window.hudAddIssue = async function () {
    var inp = document.getElementById('hud-new-text');
    var txt = (inp && inp.value ? inp.value : '').trim();
    if (!txt) { if (inp) inp.focus(); return; }
    var cat = _hudNewCat;
    var mkWO = (cat === 'safety') && _hudNewWO;
    var rec = {
      text: txt, cat: cat, status: 'open', escalate: (cat === 'support'),
      farm: _farm(), by: _by(), createdDate: _today(), ts: Date.now()
    };
    try {
      if (typeof setSyncDot === 'function') setSyncDot('saving');
      var ref = await db.collection('huddleIssues').add(rec);
      if (mkWO && typeof mintWoId === 'function') {
        try {
          var woId = await mintWoId();
          await db.collection('workOrders').add({
            id: woId, farm: (_farm() === 'All' ? 'Hegins' : _farm()), house: '',
            problem: 'Building / Structure', priority: 'high', status: 'open',
            desc: HL('Safety (daily huddle): ', 'Seguridad (junta diaria): ') + txt,
            tech: _by(), notes: 'Auto-created from Daily Huddle safety item',
            submitted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            date: _today(), ts: Date.now()
          });
          await ref.set({ woId: woId }, { merge: true });
          if (typeof toast === 'function') toast(HL('Work order ' + woId + ' created', 'Orden ' + woId + ' creada'));
        } catch (e) { console.error('huddle WO:', e); }
      }
      if (inp) inp.value = '';
      if (typeof setSyncDot === 'function') setSyncDot('live');
    } catch (e) {
      console.error('hudAddIssue:', e);
      alert(HL('Could not save: ', 'No se pudo guardar: ') + (e && e.message ? e.message : e));
      if (typeof setSyncDot === 'function') setSyncDot('live');
    }
  };

  window.hudSetCat = function (c) { _hudNewCat = c; renderHuddle(); };
  window.hudToggleWO = function () { _hudNewWO = !_hudNewWO; renderHuddle(); };

  window.hudResolve = async function (id) {
    try {
      if (typeof setSyncDot === 'function') setSyncDot('saving');
      await db.collection('huddleIssues').doc(id).set(
        { status: 'resolved', resolvedBy: _by(), resolvedDate: _today(), resolvedTs: Date.now() }, { merge: true });
      if (typeof setSyncDot === 'function') setSyncDot('live');
    } catch (e) { console.error('hudResolve:', e); if (typeof setSyncDot === 'function') setSyncDot('live'); }
  };
  window.hudReopen = async function (id) {
    try { await db.collection('huddleIssues').doc(id).set({ status: 'open' }, { merge: true }); } catch (e) {}
  };
  window.hudEscalate = async function (id, cur) {
    try { await db.collection('huddleIssues').doc(id).set({ escalate: !cur }, { merge: true }); } catch (e) {}
  };
  window.hudMakeWO = async function (id, text) {
    if (typeof mintWoId !== 'function') return;
    try {
      if (typeof setSyncDot === 'function') setSyncDot('saving');
      var woId = await mintWoId();
      await db.collection('workOrders').add({
        id: woId, farm: (_farm() === 'All' ? 'Hegins' : _farm()), house: '',
        problem: 'Building / Structure', priority: 'high', status: 'open',
        desc: HL('Safety (daily huddle): ', 'Seguridad (junta diaria): ') + text,
        tech: _by(), notes: 'Created from Daily Huddle', submitted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        date: _today(), ts: Date.now()
      });
      await db.collection('huddleIssues').doc(id).set({ woId: woId }, { merge: true });
      if (typeof toast === 'function') toast(HL('Work order ' + woId + ' created', 'Orden ' + woId + ' creada'));
      if (typeof setSyncDot === 'function') setSyncDot('live');
    } catch (e) { console.error('hudMakeWO:', e); if (typeof setSyncDot === 'function') setSyncDot('live'); }
  };

  window.hudSaveDay = async function () {
    var present = document.getElementById('hud-present') ? document.getElementById('hud-present').value : '';
    var recog = document.getElementById('hud-recog') ? document.getElementById('hud-recog').value.trim() : '';
    var att = document.getElementById('hud-att') ? document.getElementById('hud-att').value.trim() : '';
    try {
      if (typeof setSyncDot === 'function') setSyncDot('saving');
      await db.collection('huddleLog').doc(_farm() + '__' + _today()).set(
        { farm: _farm(), date: _today(), present: present, attendance: att, recognition: recog, by: _by(), ts: Date.now() }, { merge: true });
      if (typeof setSyncDot === 'function') setSyncDot('live');
      if (typeof toast === 'function') toast(HL('Huddle saved ✓', 'Junta guardada ✓'));
    } catch (e) { console.error('hudSaveDay:', e); if (typeof setSyncDot === 'function') setSyncDot('live'); }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  function renderHuddle() {
    var ov = document.getElementById('huddle-overlay');
    if (!ov) return;
    var dateStr = new Date().toLocaleDateString(_hlang() === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    var open = _openIssues();
    var esc = open.filter(function (r) { return r.escalate || r.cat === 'support'; });
    var stale = open.filter(function (r) { return _ageDays(r.ts) >= 2; });
    var log = _todayLog();

    // New-issue category picker
    var catBtns = Object.keys(CATS).map(function (c) {
      var m = CATS[c]; var on = _hudNewCat === c;
      return '<button onclick="hudSetCat(\'' + c + '\')" style="padding:8px 11px;border-radius:8px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;' +
        (on ? 'background:' + m.col + ';border:1.5px solid ' + m.col + ';color:#fff;' : 'background:#0f1a0f;border:1.5px solid #2a4a2a;color:#8aa08a;') + '">' + m.icon + ' ' + HL(m.en, m.es) + '</button>';
    }).join('');

    // Open-issue rows (newest first, but stale/escalated float up)
    var sorted = open.slice().sort(function (a, b) {
      var ea = (a.escalate || a.cat === 'support') ? 1 : 0, eb = (b.escalate || b.cat === 'support') ? 1 : 0;
      if (ea !== eb) return eb - ea;
      return (a.ts || 0) - (b.ts || 0);   // oldest open first (been waiting longest)
    });
    var rows = sorted.map(function (r) {
      var m = CATS[r.cat] || CATS.other;
      var age = _ageDays(r.ts);
      var ageCol = age >= 3 ? '#e05656' : age >= 1 ? '#d69e2e' : '#7a9a7a';
      var woTag = r.woId ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#f0a35a;">🔧 ' + _esc(r.woId) + '</span>' : '';
      var escOn = (r.escalate || r.cat === 'support');
      return '<div style="background:' + m.bg + ';border:1px solid ' + m.bd + ';border-left:4px solid ' + m.col + ';border-radius:9px;padding:10px 12px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;color:#f0ead8;line-height:1.4;">' + _esc(r.text) + '</div>' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#7a9a7a;margin-top:4px;">' + m.icon + ' ' + HL(m.en, m.es) + (r.farm && r.farm !== 'All' ? ' · ' + _esc(r.farm) : '') + (r.by ? ' · ' + _esc(r.by) : '') + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;">' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;color:' + ageCol + ';">' + (age >= 2 ? '⚠ ' : '') + _ageLabel(r.ts) + '</div>' +
            (woTag ? '<div style="margin-top:3px;">' + woTag + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;">' +
          '<button onclick="hudResolve(\'' + r._id + '\')" style="padding:7px 11px;background:#14532d;border:1px solid #2a7a3a;border-radius:7px;color:#86efac;font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;cursor:pointer;">✓ ' + HL('Resolve', 'Resolver') + '</button>' +
          '<button onclick="hudEscalate(\'' + r._id + '\',' + escOn + ')" style="padding:7px 11px;background:' + (escOn ? '#3a2a05' : '#0f1a0f') + ';border:1px solid ' + (escOn ? '#7a5a1a' : '#2a4a2a') + ';border-radius:7px;color:' + (escOn ? '#f0c86a' : '#8aa08a') + ';font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;cursor:pointer;">⬆ ' + (escOn ? HL('Reporting up', 'Reportado') : HL('Report up', 'Reportar')) + '</button>' +
          (r.woId ? '' : '<button onclick="hudMakeWO(\'' + r._id + '\',\'' + _esc(r.text).replace(/'/g, '&#39;') + '\')" style="padding:7px 11px;background:#0d1f3a;border:1px solid #2a4a7a;border-radius:7px;color:#8ab8f0;font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;cursor:pointer;">🔧 ' + HL('Work order', 'Orden') + '</button>') +
        '</div>' +
      '</div>';
    }).join('') || '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#5a8a5a;text-align:center;padding:22px;">✅ ' + HL('No open issues — nice.', 'Sin problemas abiertos — bien.') + '</div>';

    ov.innerHTML =
      '<div style="max-width:760px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 44px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
          '<button onclick="closeHuddle()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;">← ' + HL('Back', 'Atrás') + '</button>' +
          '<div style="text-align:right;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;letter-spacing:2px;line-height:1;color:#f0ead8;">📋 ' + HL('TIER 1 DAILY HUDDLE', 'JUNTA DIARIA · NIVEL 1') + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#7ab07a;margin-top:3px;">' + dateStr + (_farm() !== 'All' ? ' · ' + _farm() : '') + ' · ' + HL('reports up to Tier 2', 'sube a Nivel 2') + '</div></div>' +
        '</div>' +

        // Report-up summary
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0 14px;">' +
          '<div style="background:#0f2410;border:1px solid #2a5a2a;border-radius:10px;padding:10px;text-align:center;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:22px;font-weight:700;color:#f0ead8;">' + open.length + '</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;">' + HL('Open', 'Abiertos') + '</div></div>' +
          '<div style="background:#241d05;border:1px solid #7a5a1a;border-radius:10px;padding:10px;text-align:center;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:22px;font-weight:700;color:#f0c86a;">' + esc.length + '</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#b09a5a;text-transform:uppercase;letter-spacing:1px;">⬆ ' + HL('Report up', 'Reportar') + '</div></div>' +
          '<div style="background:#2a1010;border:1px solid #7a2a2a;border-radius:10px;padding:10px;text-align:center;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:22px;font-weight:700;color:#e05656;">' + stale.length + '</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:8px;color:#b06a6a;text-transform:uppercase;letter-spacing:1px;">⚠ ' + HL('2+ days', '2+ días') + '</div></div>' +
        '</div>' +

        // Add issue
        '<div style="background:#0d1f0d;border:1px solid #1e3a1e;border-radius:12px;padding:12px 13px;margin-bottom:14px;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#9ad6a0;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">➕ ' + HL('Log an issue (stays open until resolved)', 'Registrar problema (queda abierto hasta resolver)') + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + catBtns + '</div>' +
          '<textarea id="hud-new-text" rows="2" placeholder="' + HL('What\'s the issue? e.g. Hanging wires in House 4', '¿Cuál es el problema? ej. Cables colgando en Casa 4') + '" style="width:100%;box-sizing:border-box;background:#0a1408;border:1px solid #2a4a2a;border-radius:8px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;padding:9px 10px;resize:none;"></textarea>' +
          (_hudNewCat === 'safety' ? '<label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#c9a86a;cursor:pointer;"><input type="checkbox" ' + (_hudNewWO ? 'checked' : '') + ' onchange="hudToggleWO()" style="width:16px;height:16px;"> ' + HL('Also create a Work Order (get it fixed)', 'También crear Orden de Trabajo (para arreglarlo)') + '</label>' : '') +
          '<button onclick="hudAddIssue()" style="width:100%;margin-top:10px;padding:12px;background:#1f7a3a;border:1.5px solid #2a7a3a;border-radius:10px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;">＋ ' + HL('Add issue', 'Agregar') + '</button>' +
        '</div>' +

        // Open issues list (the report-up board)
        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a8a3a;margin-bottom:8px;">🔺 ' + HL('Open issues — review & drive to closure', 'Problemas abiertos — revisar y cerrar') + '</div>' +
        rows +

        // Attendance + recognition (daily log)
        '<div style="background:#0d1f0d;border:1px solid #1e3a1e;border-radius:12px;padding:12px 13px;margin-top:16px;">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#9ad6a0;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">👥 ' + HL('Attendance & recognition', 'Asistencia y reconocimiento') + '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
            '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;">' + HL('Everyone present?', '¿Todos presentes?') + '</span>' +
            '<select id="hud-present" style="flex:1;background:#0a1408;border:1px solid #2a4a2a;border-radius:8px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:12px;padding:8px;">' +
              ['', 'Yes', 'No'].map(function (v) { var lbl = v === 'Yes' ? HL('Yes', 'Sí') : v === 'No' ? HL('No', 'No') : HL('—', '—'); return '<option value="' + v + '"' + (log && log.present === v ? ' selected' : '') + '>' + lbl + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
          '<input id="hud-att" value="' + (log ? _esc(log.attendance || '') : '') + '" placeholder="' + HL('Attendance notes (who\'s out, etc.)', 'Notas de asistencia') + '" style="width:100%;box-sizing:border-box;background:#0a1408;border:1px solid #2a4a2a;border-radius:8px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:12px;padding:8px 9px;margin-bottom:8px;">' +
          '<input id="hud-recog" value="' + (log ? _esc(log.recognition || '') : '') + '" placeholder="' + HL('Recognition / shout-outs 🎉', 'Reconocimiento / felicitaciones 🎉') + '" style="width:100%;box-sizing:border-box;background:#0a1408;border:1px solid #2a4a2a;border-radius:8px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:12px;padding:8px 9px;">' +
          '<button onclick="hudSaveDay()" style="width:100%;margin-top:10px;padding:11px;background:#14361c;border:1.5px solid #2a7a3a;border-radius:10px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;">💾 ' + HL('Save today\'s huddle', 'Guardar junta de hoy') + '</button>' +
        '</div>' +

        '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#5a7a5a;text-align:center;margin-top:14px;line-height:1.5;">' + HL('Issues stay here until resolved — so they get reported up and don\'t repeat. Safety items can spin off a work order.', 'Los problemas quedan aquí hasta resolverse — para reportarlos y que no se repitan. Los de seguridad pueden crear una orden de trabajo.') + '</div>' +
      '</div>';
  }

  function openHuddle() {
    var ov = document.getElementById('huddle-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'huddle-overlay';
      ov.className = 'overlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:950;background:#0a140a;overflow-y:auto;-webkit-overflow-scrolling:touch;';
      document.body.appendChild(ov);
    }
    ov.style.display = 'block';
    _hudArm();
    renderHuddle();
    if (!_hudTick) _hudTick = setInterval(function () { _hudKick(); }, 60000);   // keep day-counts fresh
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function closeHuddle() {
    var ov = document.getElementById('huddle-overlay');
    if (ov) ov.style.display = 'none';
    if (_hudTick) { clearInterval(_hudTick); _hudTick = null; }
    _hudDisarm();
  }

  if (typeof window !== 'undefined') {
    window.openHuddle = openHuddle;
    window.closeHuddle = closeHuddle;
    window.renderHuddle = renderHuddle;
  }
})();
