// ═══════════════════════════════════════════════════════════════════════════
// training.js — 🎓 MAINTENANCE TRAINING PLAN (v290, per Joe 2026-08-12)
//
// "Make me a training plan for maintenance … to follow the work instructions
//  and how to be trained for each job."
//
// Built ON TOP of the 55 unique maintenance work instructions already in the
// app — this file invents no new content. Each level below lists WI titles that
// really exist in the `workInstructions` collection; they are matched live by
// title so a renamed WI shows up as a gap instead of silently disappearing.
//
// THREE STAGES per work instruction, in order:
//   1. 📖 READ    — the tech opens the WI and confirms they read it
//   2. 👀 DID IT  — they did the job with a lead watching
//   3. ✅ SIGNED  — a Lead or Director signs them off
// A person can never sign their own stage 3. That is the whole point of a
// qualification: somebody else says you can do the job.
//
// Levels gate: you cannot start Level 3 until Levels 1–2 are signed off.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";

  function trL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _trEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function _trKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function _trMe() { try { return (typeof getDeviceUser === 'function') ? String(getDeviceUser() || '') : ''; } catch (e) { return ''; } }
  function _trToday() { try { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); } }

  // ── THE LADDER ──────────────────────────────────────────────────────────
  // Every title here is a real maintenance WI. `safety:true` means the job can
  // hurt somebody — those always need a lead signature, even at Level 1.
  var LEVELS = [
    {
      id: 1,
      name: 'Safety first', nameEs: 'Seguridad primero',
      when: 'Before working alone — day 1', whenEs: 'Antes de trabajar solo — día 1',
      why: 'Nobody touches a motor, a ladder or a panel until this level is signed.',
      whyEs: 'Nadie toca un motor, una escalera o un panel hasta firmar este nivel.',
      safety: true,
      wis: ['Lockout Tagout — Motor Work', 'Electrical Safety Check', 'Ladder Safety Standard',
            'Confined Space Awareness', 'Chemical Spill Response', 'Red Tag Procedure',
            'Emergency Breakdown Response', 'Emergency Breakdown Ticket']
    },
    {
      id: 2,
      name: 'How we run the shop', nameEs: 'Cómo trabajamos en el taller',
      when: 'First week', whenEs: 'Primera semana',
      why: 'Paperwork, parts and handoff. Do this wrong and the work never gets recorded.',
      whyEs: 'Papeleo, refacciones y entrega de turno. Si esto falla, el trabajo no se registra.',
      wis: ['Work Order Creation', 'Daily Maintenance Job Ticket', 'Daily Shift Handoff Notes',
            'Shift Handoff', 'Parts Request Procedure', 'Tool Return Standard',
            'PM Completion', 'PM Completion Signoff', 'Scrap Removal Standard',
            '5S Shop Closeout', 'Shop Cleanup — End of Shift']
    },
    {
      id: 3,
      name: 'Routine PM by system', nameEs: 'PM de rutina por sistema',
      when: '30–90 days', whenEs: '30–90 días',
      why: 'The inspections and PMs that keep the houses running. Learn these before you fix anything.',
      whyEs: 'Las inspecciones y PM que mantienen las casas corriendo.',
      wis: ['Fan Bearing Grease PM', 'House Temperature Sensor Check', 'Vent Door Cable Adjustment',
            'Water Pressure Check', 'Iron / Dirt Flush Procedure', 'Water Filter Change',
            'Lubing Rod Conveyor Daily Inspection', 'Counter Card Reset — Houses 5–8 (PMSI Controls)',
            'Conveyor Chain Tensioning', 'Mechanical Timing Check',
            'Gearbox Inspection & Oil Check', 'Orange Transfer Belt PM', 'Weekly Manure System PM',
            'Manure Cleanout Under Belts', 'Feed Auger Inspection', 'Feed Motor Reset Procedure',
            'Bin Boot Cleanout']
    },
    {
      id: 4,
      name: 'Repairs and changeouts', nameEs: 'Reparaciones y cambios',
      when: '90 days and on', whenEs: '90 días en adelante',
      why: 'Component work. Every one of these gets signed by a lead who watched you do it.',
      whyEs: 'Trabajo de componentes. Cada uno lo firma un líder que te vio hacerlo.',
      safety: true,
      wis: ['Fan Belt Replacement', 'Ventilation Fan Belt Replacement', 'Blower Motor Changeout',
            'Water Leak Repair', 'Water Regulator Replacement — Houses 5–8',
            'Broken Rod Replacement', 'Chain & Sprocket Alignment', 'Drive Roller Replacement',
            'Head Roller Replacement', 'Pit Belt Changeout Procedure',
            'Auger Roller — Cleaning, Replacement & Preventive Maintenance']
    },
    {
      id: 5,
      name: 'Emergencies and winter', nameEs: 'Emergencias e invierno',
      when: 'Once Level 4 is signed · winter items before Nov 1', whenEs: 'Después del nivel 4 · invierno antes del 1 de nov',
      why: 'The calls that come at 2am. Everyone qualified should be able to take one.',
      whyEs: 'Las llamadas de las 2am. Todo calificado debe poder atender una.',
      safety: true,
      wis: ['Emergency Hot House Response', 'Belt Flip Emergency Recovery', 'Frozen Belt Winter Recovery']
    },
    {
      id: 6,
      name: 'Lead add-on', nameEs: 'Adicional para líder',
      when: 'Leads and Directors', whenEs: 'Líderes y directores',
      why: 'Planning, review and spending money. Only leads carry these.',
      whyEs: 'Planeación, revisión y gasto. Solo los líderes.',
      leadOnly: true,
      wis: ['Hegins Saturday Job Planning', 'Weekly Open Project Review',
            'Contractor Call Approval Process', 'Min/Max Inventory Review']
    }
  ];
  var STAGES = ['read', 'did', 'signed'];

  // ── DATA ────────────────────────────────────────────────────────────────
  var _T = null, _who = null, _openLvl = {}, _view = 'me';
  function _load() {
    return Promise.all([
      db.collection('workInstructions').get(),
      db.collection('trainingSignoffs').get().catch(function () { return null; })
    ]).then(function (r) {
      var wis = [], sign = [];
      r[0].forEach(function (d) { var o = d.data() || {}; o._id = d.id; wis.push(o); });
      if (r[1]) r[1].forEach(function (d) { sign.push(d.data() || {}); });
      // The collection holds 101 duplicate copies of the same 55 titles. Keep the
      // richest copy of each title so a tech is never asked to read one twice.
      var byTitle = {};
      wis.forEach(function (w) {
        if (String(w.dept || '').toLowerCase().indexOf('aint') === -1) return;
        var k = _trKey(w.title);
        var prev = byTitle[k];
        if (!prev || (w.steps || []).length > (prev.steps || []).length) byTitle[k] = w;
      });
      _T = { wi: byTitle, sign: sign, allWi: wis };
      return _T;
    });
  }

  function _staff() { try { return (typeof staffList !== 'undefined' && Array.isArray(staffList)) ? staffList : []; } catch (e) { return []; } }
  function _rec(name) {
    var n = String(name || '').toLowerCase();
    return _staff().find(function (s) { return s && String(s.name || '').toLowerCase() === n; }) || null;
  }
  function _isLead(name) {
    var s = _rec(name);
    if (!s) return false;
    return s.role === 'Lead' || s.role === 'Director';
  }
  function _maintStaff() {
    return _staff().filter(function (s) {
      return s && String(s.dept || s.department || '').toLowerCase().indexOf('aint') !== -1;
    }).sort(function (a, b) {
      var rank = { Director: 0, Lead: 1, Technician: 2 };
      var d = (rank[a.role] == null ? 3 : rank[a.role]) - (rank[b.role] == null ? 3 : rank[b.role]);
      return d || String(a.name).localeCompare(String(b.name));
    });
  }

  // stage state for one person + one WI title
  function _got(person, title, stage) {
    var k = _trKey(title), p = String(person || '').toLowerCase();
    return (_T.sign || []).find(function (s) {
      return s && String(s.employee || '').toLowerCase() === p && _trKey(s.wiTitle) === k && s.stage === stage;
    }) || null;
  }
  // A level's WIs that actually exist in the collection (the rest are gaps).
  function _lvlWis(lvl) {
    return lvl.wis.map(function (t) {
      var w = _T.wi[_trKey(t)];
      return { title: t, wi: w || null, missing: !w, time: w ? (Number(w.time) || null) : null,
               steps: w ? (w.steps || []).length : 0, system: w ? (w.system || '') : '',
               // 🎬 v291 — a filmed job is worth flagging: the crew would rather
               // watch two minutes than read nine steps, especially in Spanish.
               video: (w && w.videoUrl && /^https?:\/\//i.test(String(w.videoUrl))) ? String(w.videoUrl) : null };
    });
  }
  function _lvlProgress(person, lvl) {
    var items = _lvlWis(lvl).filter(function (i) { return !i.missing; });
    var done = items.filter(function (i) { return _got(person, i.title, 'signed'); }).length;
    var read = items.filter(function (i) { return _got(person, i.title, 'read'); }).length;
    var did = items.filter(function (i) { return _got(person, i.title, 'did'); }).length;
    return { n: items.length, read: read, did: did, signed: done,
             pct: items.length ? Math.round(done / items.length * 100) : 0,
             complete: items.length > 0 && done === items.length };
  }
  // Levels 3+ are locked until every earlier non-lead-only level is signed off.
  function _locked(person, lvl) {
    if (lvl.id <= 2) return false;
    if (lvl.leadOnly) return !_isLead(person);
    for (var i = 0; i < LEVELS.length; i++) {
      var L = LEVELS[i];
      if (L.id >= lvl.id || L.leadOnly) continue;
      if (!_lvlProgress(person, L).complete) return { by: L };
    }
    return false;
  }
  function _overall(person) {
    var n = 0, s = 0;
    LEVELS.forEach(function (L) {
      if (L.leadOnly && !_isLead(person)) return;
      var p = _lvlProgress(person, L); n += p.n; s += p.signed;
    });
    return { n: n, signed: s, pct: n ? Math.round(s / n * 100) : 0 };
  }
  function _level(person) {            // highest fully-signed level
    var top = 0;
    LEVELS.forEach(function (L) { if (!L.leadOnly && _lvlProgress(person, L).complete) top = Math.max(top, L.id); });
    return top;
  }

  // ── WRITE ───────────────────────────────────────────────────────────────
  function _save(person, title, stage, lvlId) {
    var id = (String(person) + '__' + _trKey(title) + '__' + stage).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 380);
    return db.collection('trainingSignoffs').doc(id).set({
      employee: person, wiTitle: title, stage: stage, level: lvlId,
      by: _trMe(), date: _trToday(), ts: Date.now(),
      appVersion: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : ''
    }, { merge: true });
  }

  window.trMark = function (person, title, stage, lvlId) {
    var me = _trMe();
    if (stage === 'signed') {
      // The one rule that makes a qualification mean anything.
      if (!_isLead(me)) {
        if (typeof toast === 'function') toast(trL('Only a Lead or Director can sign someone off', 'Solo un Líder o Director puede firmar'));
        return;
      }
      if (String(me).toLowerCase() === String(person).toLowerCase()) {
        if (typeof toast === 'function') toast(trL('You cannot sign off your own training — ask another lead', 'No puedes firmar tu propia capacitación — pide a otro líder'));
        return;
      }
      if (!_got(person, title, 'did')) {
        if (typeof toast === 'function') toast(trL('They have to do the job with you watching first', 'Primero debe hacer el trabajo contigo observando'));
        return;
      }
    }
    if (stage === 'did' && !_got(person, title, 'read')) {
      if (typeof toast === 'function') toast(trL('Read the work instruction first', 'Lee la instrucción de trabajo primero'));
      return;
    }
    _save(person, title, stage, lvlId).then(function () {
      // keep the local copy in step so the UI updates without a refetch
      _T.sign.push({ employee: person, wiTitle: title, stage: stage, level: lvlId, by: me, date: _trToday(), ts: Date.now() });
      if (typeof toast === 'function') {
        toast(stage === 'read' ? ('📖 ' + trL('Marked as read', 'Marcado como leído'))
            : stage === 'did' ? ('👀 ' + trL('Marked done with a lead watching', 'Hecho con líder observando'))
            : ('✅ ' + person + ' ' + trL('signed off', 'firmado')));
      }
      window.openTraining();
    }).catch(function (e) {
      console.error('trMark:', e);
      if (typeof toast === 'function') toast(trL('Could not save', 'No se pudo guardar'));
    });
  };
  window.trOpenWI = function (title) {
    var w = _T.wi[_trKey(title)];
    if (!w) { if (typeof toast === 'function') toast(trL('That work instruction is missing', 'Falta esa instrucción')); return; }
    // Reuse the app's own WI viewer when it exists so there is ONE place a work
    // instruction is ever displayed.
    try {
      if (typeof viewWI === 'function') { viewWI(w._id); return; }
      if (typeof openWIView === 'function') { openWIView(w._id); return; }
    } catch (e) {}
    var body = (w.steps || []).map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n');
    if (typeof toast === 'function') toast(w.title + ' — ' + (w.steps || []).length + ' ' + trL('steps', 'pasos'));
    console.log(w.title + '\n' + body);
  };
  window.trWatch = function (title) {
    var w = _T.wi[_trKey(title)];
    var u = w && w.videoUrl;
    if (!u) { if (typeof toast === 'function') toast(trL('No video on this one yet', 'Aún no hay video')); return; }
    try { window.open(u, '_blank', 'noopener'); } catch (e) { location.href = u; }
  };
  window.trPick = function (name) { _who = name; _view = 'me'; window.openTraining(); };
  window.trView = function (v) { _view = v; window.openTraining(); };
  window.trToggleLvl = function (id) { _openLvl[id] = !_openLvl[id]; window.openTraining(); };

  // ── RENDER ──────────────────────────────────────────────────────────────
  function _ov() {
    var o = document.getElementById('tr-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'tr-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:964;background:#0a1018;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeTraining = function () { var o = document.getElementById('tr-overlay'); if (o) o.style.display = 'none'; };

  function _bar(pct, col) {
    return '<div style="height:7px;background:#101c2a;border-radius:50px;overflow:hidden;">' +
      '<div style="height:100%;width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + (col || '#3b82f6') + ';"></div></div>';
  }
  function _sec(t) { return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#5a8ad0;text-transform:uppercase;margin:20px 2px 8px;font-weight:700;">' + t + '</div>'; }

  window.openTraining = function () {
    var o = _ov();
    o.innerHTML = '<div style="max-width:920px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeTraining()" style="padding:11px 16px;background:#0d1a2a;border:1.5px solid #2a4a7a;border-radius:50px;color:#9cc0f6;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + trL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:27px;letter-spacing:2px;line-height:1;color:#e8f0fa;">🎓 ' + trL('MAINTENANCE TRAINING', 'CAPACITACIÓN MANTENIMIENTO') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#5a7aa0;margin-top:2px;">' + trL('Read it · do it watched · a lead signs you off', 'Léelo · hazlo observado · un líder te firma') + '</div>' +
        '</div>' +
      '</div>' +
      '<div id="tr-body" style="' + MONO + 'font-size:12px;color:#8aa0c0;">' + trL('Loading work instructions…', 'Cargando…') + '</div>' +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}
    try { if (typeof trackUse === 'function') trackUse('training'); } catch (e) {}

    _load().then(function () {
      var body = document.getElementById('tr-body'); if (!body) return;
      var me = _trMe();
      if (!_who) _who = me || (_maintStaff()[0] || {}).name || '';
      var lead = _isLead(me);
      var html = '';

      // ── view switch ──
      if (lead) {
        html += '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
          [['me', '👤 ' + trL('One person', 'Una persona')], ['matrix', '📊 ' + trL('Who is qualified', 'Quién está calificado')], ['gaps', '⚠ ' + trL('Gaps', 'Faltantes')]].map(function (v) {
            var on = _view === v[0];
            return '<button onclick="trView(\'' + v[0] + '\')" style="flex:1;padding:11px;border-radius:10px;cursor:pointer;' + MONO +
              'font-size:11.5px;font-weight:700;background:' + (on ? '#152a45' : '#0b1420') + ';border:1.5px solid ' + (on ? '#3b82f6' : '#1e3050') +
              ';color:' + (on ? '#cfe0fa' : '#5a7aa0') + ';">' + v[1] + '</button>';
          }).join('') + '</div>';
      } else { _view = 'me'; }

      // ═══ MATRIX ═══
      if (_view === 'matrix') {
        var crew = _maintStaff();
        html += _sec('📊 ' + trL('Qualification matrix · ' + crew.length + ' in maintenance', 'Matriz · ' + crew.length + ' en mantenimiento'));
        html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11px;min-width:640px;">' +
          '<thead><tr style="border-bottom:1px solid #1e3050;color:#5a7aa0;">' +
            '<th style="text-align:left;padding:6px;">' + trL('Person', 'Persona') + '</th>' +
            '<th style="padding:6px;">' + trL('Role', 'Rol') + '</th>' +
            LEVELS.map(function (L) { return '<th style="padding:6px;" title="' + _trEsc(trL(L.name, L.nameEs)) + '">L' + L.id + '</th>'; }).join('') +
            '<th style="padding:6px;">' + trL('Level', 'Nivel') + '</th>' +
            '<th style="padding:6px;">' + trL('Overall', 'Total') + '</th>' +
          '</tr></thead><tbody>';
        crew.forEach(function (s) {
          var ov = _overall(s.name);
          html += '<tr style="border-bottom:1px solid #131f30;">' +
            '<td style="padding:6px;color:#e8f0fa;font-weight:700;cursor:pointer;" onclick="trPick(\'' + _trEsc(s.name).replace(/'/g, "\\'") + '\')">' + _trEsc(s.name) + '</td>' +
            '<td style="padding:6px;text-align:center;color:#8aa0c0;">' + _trEsc(s.role || '') + '</td>' +
            LEVELS.map(function (L) {
              if (L.leadOnly && !_isLead(s.name)) return '<td style="padding:6px;text-align:center;color:#2a3a50;">·</td>';
              var p = _lvlProgress(s.name, L);
              if (!p.n) return '<td style="padding:6px;text-align:center;color:#2a3a50;">—</td>';
              var col = p.complete ? '#4ade80' : p.signed ? '#e8c96a' : '#5a7aa0';
              return '<td style="padding:6px;text-align:center;color:' + col + ';font-weight:700;">' + p.signed + '/' + p.n + '</td>';
            }).join('') +
            '<td style="padding:6px;text-align:center;color:#9cc0f6;font-weight:700;">' + (_level(s.name) || '—') + '</td>' +
            '<td style="padding:6px;text-align:center;color:' + (ov.pct >= 80 ? '#4ade80' : ov.pct >= 40 ? '#e8c96a' : '#f87171') + ';font-weight:700;">' + ov.pct + '%</td>' +
          '</tr>';
        });
        html += '</tbody></table></div>' +
          '<div style="' + MONO + 'font-size:9.5px;color:#4a6a90;margin-top:6px;line-height:1.6;">' +
            trL('Each cell = work instructions SIGNED OFF / total in that level. Tap a name to open their plan. Level = the highest level they have fully cleared.',
                'Cada celda = instrucciones FIRMADAS / total del nivel. Toca un nombre para abrir su plan.') + '</div>';
        body.innerHTML = html; return;
      }

      // ═══ GAPS ═══
      if (_view === 'gaps') {
        var crew2 = _maintStaff();
        html += _sec('⚠ ' + trL('Where the department is exposed', 'Dónde estamos expuestos'));
        // How many people are signed off on each WI — 0 or 1 is a single point of failure.
        var cover = [];
        LEVELS.forEach(function (L) {
          _lvlWis(L).forEach(function (i) {
            if (i.missing) return;
            var n = crew2.filter(function (s) { return _got(s.name, i.title, 'signed'); }).length;
            cover.push({ title: i.title, lvl: L.id, system: i.system, n: n, safety: !!L.safety });
          });
        });
        var none = cover.filter(function (c) { return c.n === 0; });
        var one = cover.filter(function (c) { return c.n === 1; });
        html += '<div style="background:#0d1a2a;border:1.5px solid ' + (none.length ? '#7f1d1d' : '#1e3050') + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;">' +
          '<div style="display:flex;gap:18px;flex-wrap:wrap;">' +
            '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + trL('NOBODY SIGNED OFF', 'NADIE FIRMADO') + '</div>' +
              '<div style="' + MONO + 'font-size:22px;font-weight:700;color:' + (none.length ? '#f87171' : '#4ade80') + ';">' + none.length + '</div></div>' +
            '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + trL('ONLY ONE PERSON', 'SOLO UNA PERSONA') + '</div>' +
              '<div style="' + MONO + 'font-size:22px;font-weight:700;color:' + (one.length ? '#f0a35a' : '#4ade80') + ';">' + one.length + '</div></div>' +
            '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + trL('JOBS TRACKED', 'TRABAJOS') + '</div>' +
              '<div style="' + MONO + 'font-size:22px;font-weight:700;color:#e8f0fa;">' + cover.length + '</div></div>' +
          '</div></div>';
        [[none, trL('Nobody is signed off on these', 'Nadie está firmado en esto'), '#f87171'],
         [one, trL('Only one person can do these — if they are off, nobody covers it', 'Solo una persona puede hacer esto'), '#f0a35a']].forEach(function (grp) {
          if (!grp[0].length) return;
          html += '<div style="' + MONO + 'font-size:11px;color:' + grp[2] + ';font-weight:700;margin:12px 2px 6px;">' + grp[1] + '</div>';
          html += '<div style="background:#0d1a2a;border:1px solid #1e3050;border-radius:10px;padding:10px 12px;">' +
            grp[0].sort(function (a, b) { return (b.safety - a.safety) || (a.lvl - b.lvl); }).map(function (c) {
              return '<div style="' + MONO + 'font-size:11.5px;color:#cfe0fa;padding:3px 0;">' +
                (c.safety ? '<span style="color:#f87171;">⚠ </span>' : '') +
                '<span style="color:#5a7aa0;">L' + c.lvl + (c.system ? ' · ' + _trEsc(c.system) : '') + '</span> — ' + _trEsc(c.title) + '</div>';
            }).join('') + '</div>';
        });
        html += '<div style="' + MONO + 'font-size:9.5px;color:#4a6a90;margin-top:8px;line-height:1.6;">⚠ ' +
          trL('marks a safety-critical job. Those are the ones to close first — a single-point-of-failure on lockout/tagout or a hot-house call is how somebody gets hurt on a Saturday.',
              'marca un trabajo crítico de seguridad. Cierra esos primero.') + '</div>';
        body.innerHTML = html; return;
      }

      // ═══ ONE PERSON ═══
      var person = _who;
      var pRec = _rec(person);
      var ov = _overall(person);
      var lvlNow = _level(person);

      if (lead) {
        var crew3 = _maintStaff();
        html += '<div style="margin-bottom:12px;">' +
          '<div style="' + MONO + 'font-size:10px;color:#5a7aa0;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:6px;">' + trL('Training plan for', 'Plan de capacitación de') + '</div>' +
          '<select onchange="trPick(this.value)" style="width:100%;background:#0b1420;border:1.5px solid #2a4a7a;border-radius:9px;color:#e8f0fa;' + MONO + 'font-size:14px;font-weight:700;padding:11px;">' +
            crew3.map(function (s) {
              return '<option value="' + _trEsc(s.name) + '"' + (s.name === person ? ' selected' : '') + '>' + _trEsc(s.name) + ' · ' + _trEsc(s.role || '') + '</option>';
            }).join('') +
          '</select></div>';
      }

      html += '<div style="background:#0d1a2a;border:1.5px solid #2a4a7a;border-radius:12px;padding:13px 15px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin-bottom:10px;">' +
          '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + trL('PERSON', 'PERSONA') + '</div>' +
            '<div style="' + MONO + 'font-size:16px;font-weight:700;color:#e8f0fa;">' + _trEsc(person || '—') + '</div>' +
            '<div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + _trEsc((pRec && pRec.role) || '') + (pRec && pRec.farm ? (' · ' + _trEsc(pRec.farm)) : '') + '</div></div>' +
          '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + trL('LEVEL', 'NIVEL') + '</div>' +
            '<div style="' + MONO + 'font-size:26px;font-weight:700;color:#9cc0f6;line-height:1;">' + (lvlNow || '—') + '</div></div>' +
          '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + trL('SIGNED OFF', 'FIRMADO') + '</div>' +
            '<div style="' + MONO + 'font-size:26px;font-weight:700;color:' + (ov.pct >= 80 ? '#4ade80' : ov.pct >= 40 ? '#e8c96a' : '#f87171') + ';line-height:1;">' + ov.signed + '<span style="font-size:14px;color:#5a7aa0;">/' + ov.n + '</span></div></div>' +
        '</div>' + _bar(ov.pct, ov.pct >= 80 ? '#4ade80' : ov.pct >= 40 ? '#e8c96a' : '#3b82f6') + '</div>';

      var isMe = String(person || '').toLowerCase() === String(me || '').toLowerCase();

      LEVELS.forEach(function (L) {
        if (L.leadOnly && !_isLead(person)) return;
        var items = _lvlWis(L);
        var live = items.filter(function (i) { return !i.missing; });
        var p = _lvlProgress(person, L);
        var lk = _locked(person, L);
        var open = _openLvl[L.id] != null ? _openLvl[L.id] : (!p.complete && !lk);
        var mins = live.reduce(function (a, i) { return a + (i.time || 0); }, 0);
        var col = p.complete ? '#4ade80' : lk ? '#4a6a90' : '#3b82f6';

        html += '<div style="background:#0b1420;border:1.5px solid ' + (p.complete ? '#2a6a3a' : lk ? '#1a2838' : '#1e3050') + ';border-radius:12px;margin-bottom:10px;overflow:hidden;">' +
          '<div onclick="trToggleLvl(' + L.id + ')" style="padding:12px 14px;cursor:pointer;">' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
              '<span style="' + MONO + 'font-size:11px;font-weight:700;color:#0a1018;background:' + col + ';border-radius:50px;padding:2px 9px;">' + trL('LEVEL ', 'NIVEL ') + L.id + '</span>' +
              '<b style="' + MONO + 'font-size:13.5px;color:#e8f0fa;">' + trL(L.name, L.nameEs) + '</b>' +
              (L.safety ? '<span style="' + MONO + 'font-size:9.5px;color:#f87171;font-weight:700;">⚠ ' + trL('SAFETY', 'SEGURIDAD') + '</span>' : '') +
              (p.complete ? '<span style="' + MONO + 'font-size:11px;color:#4ade80;font-weight:700;">✅ ' + trL('cleared', 'completo') + '</span>' : '') +
              (lk ? '<span style="' + MONO + 'font-size:10.5px;color:#f0a35a;font-weight:700;">🔒 ' + trL('finish Level ', 'termina el nivel ') + lk.by.id + '</span>' : '') +
              (function () { var nv = live.filter(function (x) { return x.video; }).length;
                 return nv ? ('<span style="' + MONO + 'font-size:10px;color:#f0a0a0;">🎬 ' + nv + '</span>') : ''; })() +
              '<span style="margin-left:auto;' + MONO + 'font-size:11px;color:#8aa0c0;">' + p.signed + '/' + p.n + ' · ' + mins + 'm</span>' +
            '</div>' +
            '<div style="' + MONO + 'font-size:10.5px;color:#5a7aa0;margin-top:5px;">' + trL(L.when, L.whenEs) + ' — ' + trL(L.why, L.whyEs) + '</div>' +
            '<div style="margin-top:8px;">' + _bar(p.pct, col) + '</div>' +
          '</div>';

        if (open) {
          html += '<div style="border-top:1px solid #131f30;padding:4px 0;">';
          items.forEach(function (i) {
            if (i.missing) {
              html += '<div style="padding:9px 14px;' + MONO + 'font-size:11.5px;color:#f0a35a;border-bottom:1px solid #101a26;">' +
                '⚠ ' + _trEsc(i.title) + ' — ' + trL('no work instruction written yet', 'falta escribir la instrucción') + '</div>';
              return;
            }
            var r = _got(person, i.title, 'read'), dd = _got(person, i.title, 'did'), sg = _got(person, i.title, 'signed');
            var esc = _trEsc(i.title).replace(/'/g, "\\'");
            var pesc = _trEsc(person).replace(/'/g, "\\'");
            function btn(stage, on, label, enabled) {
              var bg = on ? '#14361c' : '#0d1a2a', bd = on ? '#4ade80' : '#2a4a7a', fg = on ? '#9ad6a0' : '#9cc0f6';
              if (!enabled) { bg = '#0a1018'; bd = '#1a2838'; fg = '#3a4a60'; }
              return '<button ' + (enabled ? 'onclick="trMark(\'' + pesc + '\',\'' + esc + '\',\'' + stage + '\',' + L.id + ')"' : 'disabled') +
                ' style="padding:6px 10px;background:' + bg + ';border:1.5px solid ' + bd + ';border-radius:7px;color:' + fg + ';' + MONO +
                'font-size:10.5px;font-weight:700;cursor:' + (enabled ? 'pointer' : 'default') + ';">' + (on ? '✓ ' : '') + label + '</button>';
            }
            html += '<div style="padding:9px 14px;border-bottom:1px solid #101a26;">' +
              '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                '<span style="' + MONO + 'font-size:12px;color:' + (sg ? '#9ad6a0' : '#e8f0fa') + ';font-weight:700;">' + (sg ? '✅ ' : '') + _trEsc(i.title) + '</span>' +
                '<span style="' + MONO + 'font-size:9.5px;color:#5a7aa0;">' + (i.system ? _trEsc(i.system) + ' · ' : '') + i.steps + ' ' + trL('steps', 'pasos') + (i.time ? ' · ' + i.time + 'm' : '') + '</span>' +
                (i.video ? '<span style="' + MONO + 'font-size:9.5px;color:#f0a0a0;font-weight:700;">🎬 ' + trL('video', 'video') + '</span>' : '') +
              '</div>' +
              '<div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap;align-items:center;">' +
                '<button onclick="trOpenWI(\'' + esc + '\')" style="padding:6px 10px;background:#0d1a2a;border:1.5px solid #2a4a7a;border-radius:7px;color:#9cc0f6;' + MONO + 'font-size:10.5px;font-weight:700;cursor:pointer;">📖 ' + trL('Open', 'Abrir') + '</button>' +
                (i.video ? ('<button onclick="trWatch(\'' + esc + '\')" style="padding:6px 10px;background:#2a0d0d;border:1.5px solid #b03a3a;border-radius:7px;color:#f0a0a0;' + MONO + 'font-size:10.5px;font-weight:700;cursor:pointer;">▶ ' + trL('Watch', 'Ver') + '</button>') : '') +
                btn('read', !!r, trL('Read it', 'Leído'), !lk && (isMe || lead)) +
                btn('did', !!dd, trL('Did it watched', 'Hecho observado'), !lk && !!r && (isMe || lead)) +
                btn('signed', !!sg, trL('Lead signs', 'Líder firma'), !lk && !!dd && lead && !isMe) +
              '</div>' +
              (sg ? ('<div style="' + MONO + 'font-size:9.5px;color:#5a8a5a;margin-top:5px;">' + trL('signed by ', 'firmado por ') + _trEsc(sg.by || '?') + ' · ' + _trEsc(sg.date || '') + '</div>') : '') +
            '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });

      // honest notes
      var missing = 0;
      LEVELS.forEach(function (L) { _lvlWis(L).forEach(function (i) { if (i.missing) missing++; }); });
      var dups = (_T.allWi || []).filter(function (w) { return String(w.dept || '').toLowerCase().indexOf('aint') !== -1; }).length - Object.keys(_T.wi).length;
      html += '<div style="' + MONO + 'font-size:9.5px;color:#4a6a90;margin-top:14px;line-height:1.7;">' +
        trL('This plan is built from the maintenance work instructions already in the app — ' + Object.keys(_T.wi).length + ' unique ones. ' +
            (dups > 0 ? (dups + ' duplicate copies are ignored so nobody reads the same job twice. ') : '') +
            (missing > 0 ? (missing + ' job(s) in the ladder have no work instruction written yet and are marked ⚠. ') : '') +
            'A tech marks Read and Did-it-watched; only a Lead or Director can sign the third box, and never on their own row. ' +
            (function () {
              var live = 0, vid = 0;
              LEVELS.forEach(function (L) { _lvlWis(L).forEach(function (i) { if (!i.missing) { live++; if (i.video) vid++; } }); });
              return vid ? (vid + ' of ' + live + ' jobs have a training video attached.')
                         : 'No training videos are attached yet — add a SharePoint link on any work instruction and a ▶ WATCH button appears here.';
            })(),
            'Este plan usa las instrucciones ya en la app (' + Object.keys(_T.wi).length + ' únicas). Solo un Líder o Director firma la tercera casilla, y nunca la propia.') + '</div>';

      body.innerHTML = html;
    }).catch(function (e) {
      console.error('training:', e);
      var b = document.getElementById('tr-body'); if (b) b.innerHTML = trL('Could not load.', 'No se pudo cargar.');
    });
  };
})();
