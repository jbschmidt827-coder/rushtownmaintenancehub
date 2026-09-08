// ═══════════════════════════════════════════════════════════════════════════
// barnhist.js — 🏚 MAINTENANCE HISTORY BY BARN (v297, per Joe 2026-08-21)
//
// "show me maintenance history by barn for hegins" → "can it be shareable to the
//  plant manager and the team lead"
//
// Two ways out, because not everyone lives in the app:
//   • IN-APP — any Lead or Director sees it live. No export, no stale copy.
//   • 📤 SHARE — builds a plain-text report and hands it to the phone's share
//     sheet (email / text / Teams), with a clipboard fallback on desktop.
//
// EVERY EVENT COMES FROM DATA THE CREW ALREADY ENTERS:
//   workOrders   — the repair record (has a house)
//   barnWalks    — flags raised on the Daily EE Check
//   morningWalks — flags raised on the Morning Walk
//
// ⚠ pmHistory is NOT here on purpose. PM completions carry farm + system but
// NO HOUSE, so a manure PM cannot be traced to a barn. The screen says so
// rather than quietly leaving a hole — fixing that needs a house field on PM
// completion.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var DAYS = 180;

  function bhL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _e(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _bhToday() { try { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function _from() { var d = new Date(_bhToday() + 'T12:00:00'); d.setDate(d.getDate() - DAYS); return d.toISOString().slice(0, 10); }
  function _me() { try { return (typeof getDeviceUser === 'function') ? String(getDeviceUser() || '') : ''; } catch (e) { return ''; } }
  function _isLead() {
    try {
      var n = _me().toLowerCase();
      if (!n) return true;                                   // fail-open, same as access.js
      var s = (typeof staffList !== 'undefined' ? staffList : []).find(function (x) {
        return x && String(x.name || '').toLowerCase() === n;
      });
      if (!s) return true;
      return s.role === 'Lead' || s.role === 'Director';
    } catch (e) { return true; }
  }
  function _hn(v) { var m = /(\d+)/.exec(String(v == null ? '' : v)); return m ? m[1] : null; }
  function _ms(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    return 0;
  }
  // The `system` field is blank on ~80% of work orders, so classify from the text.
  function _sys(t) {
    var s = String(t || '').toLowerCase();
    var map = [[/feed/, 'Feed'], [/egg\s*collect|collection|egg belt/, 'Egg collection'], [/manure/, 'Manure'],
               [/water|psi|meter/, 'Water'], [/vent|fan|inlet/, 'Ventilation'], [/generat/, 'Generator'],
               [/lub/, 'Lubing'], [/light/, 'Lighting'], [/door/, 'Doors'], [/cage/, 'Cages'],
               [/electric/, 'Electrical'], [/building|structure/, 'Building']];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(s)) return map[i][1];
    return bhL('Other', 'Otro');
  }

  var _B = null, _site = 'Hegins', _open = {};

  function _load() {
    var f = _from();
    // v298: bound the WO pull to the screen's own window. The collection is
    // 1,500+ docs with photos stored inline (~46 MB unbounded); ts is a number
    // (Date.now()) on every doc, so a range on ts stays on the built-in index.
    var cutoff = Date.now() - DAYS * 86400000;
    return Promise.all([
      db.collection('workOrders').where('ts', '>=', cutoff).get()
        .catch(function () { return db.collection('workOrders').get(); }),
      db.collection('barnWalks').where('date', '>=', f).get().catch(function () { return null; }),
      db.collection('morningWalks').where('date', '>=', f).get().catch(function () { return null; })
    ]).then(function (r) {
      var wo = [], bw = [], mw = [];
      r[0].forEach(function (d) { var o = d.data() || {}; o._id = d.id; wo.push(o); });
      if (r[1]) r[1].forEach(function (d) { bw.push(d.data() || {}); });
      if (r[2]) r[2].forEach(function (d) { mw.push(d.data() || {}); });
      _B = { wo: wo, bw: bw, mw: mw };
      return _B;
    });
  }

  function _sites() {
    var s = {};
    (_B.wo || []).forEach(function (w) { if (w && w.farm && _hn(w.house)) s[w.farm] = 1; });
    (_B.bw || []).forEach(function (w) { if (w && w.farm) s[w.farm] = 1; });
    return Object.keys(s).filter(function (x) { return x !== 'Processing Plant'; }).sort();
  }
  function _houses(site) {
    var out = {};
    try {
      var arr = (typeof FARM_HOUSES !== 'undefined' && FARM_HOUSES[site]) ? FARM_HOUSES[site] : [];
      arr.forEach(function (h) { var n = _hn(h); if (n) out[n] = 1; });
    } catch (e) {}
    // include any house that has events even if it is not in the roster
    ['wo', 'bw', 'mw'].forEach(function (k) {
      (_B[k] || []).forEach(function (w) {
        if (w && w.farm === site) { var n = _hn(w.house); if (n) out[n] = 1; }
      });
    });
    return Object.keys(out).sort(function (a, b) { return Number(a) - Number(b); });
  }
  function _down(site, h) {
    try { return (typeof isHouseDown === 'function') && isHouseDown(site, h); } catch (e) { return false; }
  }

  // ⚠ Work orders whose house field is not a number ("Other", "Generator",
  // "Catch / Load Out", "N/A"). They are REAL repairs that simply cannot be
  // pinned to a barn, so every total must say how many are missing rather than
  // quietly shrinking the site count. An audit report that under-reports is
  // worse than no report.
  function _orphans(site) {
    return (_B.wo || []).filter(function (w) {
      return w && w.farm === site && !_hn(w.house);
    });
  }

  function _barn(site, h) {
    var wo = (_B.wo || []).filter(function (w) { return w && w.farm === site && _hn(w.house) === h; })
      .sort(function (a, b) { return (_ms(a.ts) || 0) - (_ms(b.ts) || 0); });
    var bw = (_B.bw || []).filter(function (w) { return w && w.farm === site && _hn(w.house) === h; });
    var mw = (_B.mw || []).filter(function (w) { return w && w.farm === site && _hn(w.house) === h; });
    var flags = [];
    bw.concat(mw).forEach(function (w) {
      (Array.isArray(w.flags) ? w.flags : []).forEach(function (f) {
        if (f) flags.push({ f: String(f), date: w.date || '', who: w.employee || '' });
      });
    });
    var bySys = {};
    flags.forEach(function (x) { var s = _sys(x.f); (bySys[s] || (bySys[s] = [])).push(x); });
    wo.forEach(function (w) {
      var s = w.system || _sys(w.problem || w.desc);
      (bySys[s] || (bySys[s] = []));
    });
    // repeat = same system hit by 2+ work orders
    var woSys = {};
    wo.forEach(function (w) { var s = w.system || _sys(w.problem || w.desc); woSys[s] = (woSys[s] || 0) + 1; });
    var repeats = Object.keys(woSys).filter(function (s) { return woSys[s] >= 2; });
    // a WO closed by a house name instead of a person
    var byHouse = wo.filter(function (w) {
      var who = String(w.completedBy || w.tech || '');
      return /house\s*\d/i.test(who);
    });
    return {
      house: h, down: _down(site, h), wo: wo, checks: bw.length, walks: mw.length,
      flagged: bw.filter(function (w) { return (w.flags || []).length; }).length +
               mw.filter(function (w) { return (w.flags || []).length; }).length,
      flags: flags, bySys: bySys, woSys: woSys, repeats: repeats, byHouse: byHouse,
      score: wo.length * 3 + flags.length      // rough attention rank
    };
  }

  // ── plain-text report for sharing ───────────────────────────────────────
  function _text(site) {
    var hs = _houses(site);
    var L = [];
    L.push('MAINTENANCE HISTORY BY BARN — ' + site.toUpperCase());
    L.push('Rushtown Poultry · last ' + DAYS + ' days · generated ' + _bhToday() + ' by ' + (_me() || 'app'));
    L.push('');
    var tw = 0, tf = 0;
    hs.forEach(function (h) { var b = _barn(site, h); tw += b.wo.length; tf += b.flags.length; });
    var orph = _orphans(site);
    L.push('TOTALS: ' + tw + ' work orders · ' + tf + ' flags raised on checks across ' + hs.length + ' barns');
    if (orph.length) {
      L.push('PLUS ' + orph.length + ' work order(s) at this site with NO house on them — they are');
      L.push('real repairs but cannot be listed under a barn. Site total = ' + (tw + orph.length) + '.');
      orph.slice(0, 8).forEach(function (w) {
        L.push('    ' + (w.date || '?') + '  [' + (w.house || 'blank') + ']  ' + String(w.problem || w.desc || '').slice(0, 40));
      });
      if (orph.length > 8) L.push('    … +' + (orph.length - 8) + ' more');
    }
    L.push('');
    hs.slice().sort(function (a, b) { return _barn(site, b).score - _barn(site, a).score; }).forEach(function (h) {
      var b = _barn(site, h);
      L.push('─────────────────────────────────────────────');
      L.push('HOUSE ' + h + (b.down ? '   [HOUSE DOWN]' : ''));
      L.push('  ' + b.wo.length + ' work orders · ' + b.checks + ' daily checks · ' + b.walks + ' morning walks · ' + b.flagged + ' flagged');
      if (b.repeats.length) L.push('  ** REPEAT SYSTEM: ' + b.repeats.join(', ') + ' **');
      if (b.wo.length) {
        L.push('  WORK ORDERS:');
        b.wo.forEach(function (w) {
          L.push('    ' + (w.date || '?') + '  ' + String(w.priority || '').toUpperCase().padEnd(7) +
            ' ' + String(w.problem || w.desc || '').slice(0, 40) +
            '  [' + (w.completedBy || w.tech || 'open') + ']');
        });
      }
      var sys = Object.keys(b.bySys).filter(function (s) { return b.bySys[s].length; })
        .sort(function (x, y) { return b.bySys[y].length - b.bySys[x].length; });
      if (sys.length) {
        L.push('  FLAGS BY SYSTEM: ' + sys.map(function (s) { return s + ' ' + b.bySys[s].length; }).join(' · '));
      }
      if (b.byHouse.length) {
        L.push('  ! ' + b.byHouse.length + ' work order(s) closed by a house name, not a person — tablet sign-in');
      }
      L.push('');
    });
    L.push('─────────────────────────────────────────────');
    L.push('NOTE: PM completions are NOT included. They record farm + system but no');
    L.push('house, so a PM cannot be traced to a barn. Work orders and check flags only.');
    return L.join('\n');
  }

  window.bhShare = function () {
    var txt = _text(_site);
    var title = 'Maintenance history by barn — ' + _site;
    try {
      if (navigator.share) {
        navigator.share({ title: title, text: txt }).catch(function () {});
        return;
      }
    } catch (e) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () {
          if (typeof toast === 'function') toast('📋 ' + bhL('Report copied — paste it into an email or text', 'Reporte copiado — pégalo en un correo'));
        }).catch(function () { _fallback(txt); });
        return;
      }
    } catch (e) {}
    _fallback(txt);
  };
  // Last resort: show it in a selectable box so they can copy by hand. Never
  // leave the person with a dead button.
  function _fallback(txt) {
    var o = document.getElementById('bh-overlay'); if (!o) return;
    var box = document.getElementById('bh-copybox');
    if (!box) {
      box = document.createElement('textarea');
      box.id = 'bh-copybox';
      box.style.cssText = 'position:fixed;left:5%;top:8%;width:90%;height:70%;z-index:9999;background:#0a1410;color:#cfe0d0;border:2px solid #4ade80;border-radius:12px;padding:12px;' + MONO + 'font-size:11px;';
      box.onclick = function () { this.select(); };
      document.body.appendChild(box);
      var btn = document.createElement('button');
      btn.textContent = 'CLOSE';
      btn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:8%;z-index:10000;padding:12px 26px;background:#14361c;border:2px solid #4ade80;border-radius:50px;color:#9ad6a0;' + MONO + 'font-weight:700;cursor:pointer;';
      btn.onclick = function () { box.remove(); btn.remove(); };
      document.body.appendChild(btn);
    }
    box.value = txt;
    box.select();
    if (typeof toast === 'function') toast(bhL('Select all and copy', 'Selecciona todo y copia'));
  }

  window.bhSite = function (s) { _site = s; _open = {}; window.openBarnHistory(); };
  window.bhToggle = function (h) { _open[h] = !_open[h]; window.openBarnHistory(); };

  function _ov() {
    var o = document.getElementById('bh2-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'bh2-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:967;background:#100f0a;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeBarnHistory = function () { var o = document.getElementById('bh2-overlay'); if (o) o.style.display = 'none'; };

  function _sec(t) { return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#c99a5a;text-transform:uppercase;margin:20px 2px 8px;font-weight:700;">' + t + '</div>'; }

  window.openBarnHistory = function () {
    if (!_isLead()) { if (typeof toast === 'function') toast(bhL('🏚 Leads and Directors only', '🏚 Solo líderes y directores')); return; }
    var o = _ov();
    o.innerHTML = '<div style="max-width:900px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeBarnHistory()" style="padding:11px 16px;background:#1c150e;border:1.5px solid #5a4225;border-radius:50px;color:#e8c98a;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + bhL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;letter-spacing:2px;line-height:1;color:#f5ecdc;">🏚 ' + bhL('BARN HISTORY', 'HISTORIAL POR CASA') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#8a6a45;margin-top:2px;">' + bhL('Maintenance by house · last ' + DAYS + ' days', 'Mantenimiento por casa · ' + DAYS + ' días') + '</div>' +
        '</div>' +
      '</div>' +
      '<div id="bh2-body" style="' + MONO + 'font-size:12px;color:#b09a75;">' + bhL('Loading…', 'Cargando…') + '</div>' +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}
    try { if (typeof trackUse === 'function') trackUse('barnHistory'); } catch (e) {}

    _load().then(function () {
      var body = document.getElementById('bh2-body'); if (!body) return;
      var sites = _sites();
      if (!sites.length) { body.innerHTML = bhL('No maintenance history yet.', 'Sin historial.'); return; }
      if (sites.indexOf(_site) === -1) _site = sites[0];
      var hs = _houses(_site);
      var barns = hs.map(function (h) { return _barn(_site, h); });
      var totWO = barns.reduce(function (a, b) { return a + b.wo.length; }, 0);
      var totFl = barns.reduce(function (a, b) { return a + b.flags.length; }, 0);
      var orph = _orphans(_site);
      var html = '';

      if (sites.length > 1) {
        html += '<div style="display:flex;gap:8px;margin-bottom:12px;">' + sites.map(function (s) {
          var on = s === _site;
          return '<button onclick="bhSite(\'' + _e(s) + '\')" style="flex:1;padding:10px;border-radius:50px;cursor:pointer;' + MONO +
            'font-size:12px;font-weight:700;background:' + (on ? '#3a2a12' : '#171208') + ';border:1.5px solid ' + (on ? '#e8c98a' : '#3a2a18') +
            ';color:' + (on ? '#f5ecdc' : '#8a6a45') + ';">' + (on ? '✓ ' : '') + _e(s).toUpperCase() + '</button>';
        }).join('') + '</div>';
      }

      // ── SHARE ──
      html += '<button onclick="bhShare()" style="width:100%;padding:14px;margin-bottom:12px;background:#0d1f3a;border:2px solid #3b82f6;border-radius:11px;color:#9cc0f6;' + MONO + 'font-size:13.5px;font-weight:700;letter-spacing:1px;cursor:pointer;">📤 ' +
        bhL('SHARE THIS REPORT', 'COMPARTIR REPORTE') + '</button>' +
        '<div style="' + MONO + 'font-size:9.5px;color:#6a5335;margin:-6px 2px 10px;line-height:1.6;">' +
          bhL('Sends the whole ' + _site + ' report as text — email, message or Teams to the plant manager and team lead. On a computer it copies to the clipboard instead.',
              'Envía el reporte completo como texto — correo, mensaje o Teams. En computadora se copia al portapapeles.') + '</div>';

      html += _sec('📊 ' + _e(_site) + ' · ' + bhL('summary', 'resumen'));
      html += '<div style="background:#1c150e;border:1.5px solid #3a2a18;border-radius:12px;padding:12px 14px;margin-bottom:10px;">' +
        '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end;">' +
          '<div><div style="' + MONO + 'font-size:10px;color:#8a6a45;">' + bhL('WORK ORDERS', 'ÓRDENES') + '</div>' +
            '<div style="' + MONO + 'font-size:23px;font-weight:700;color:#f5ecdc;">' + totWO + '</div></div>' +
          '<div><div style="' + MONO + 'font-size:10px;color:#8a6a45;">' + bhL('FLAGS ON CHECKS', 'MARCAS') + '</div>' +
            '<div style="' + MONO + 'font-size:23px;font-weight:700;color:#e8c98a;">' + totFl + '</div></div>' +
          '<div><div style="' + MONO + 'font-size:10px;color:#8a6a45;">' + bhL('BARNS', 'CASAS') + '</div>' +
            '<div style="' + MONO + 'font-size:23px;font-weight:700;color:#f5ecdc;">' + hs.length + '</div></div>' +
        '</div>' +
        (orph.length ? ('<div style="' + MONO + 'font-size:10px;color:#f0a35a;margin-top:9px;line-height:1.6;border-top:1px solid #3a2a18;padding-top:8px;">⚠ ' +
          bhL('Plus ' + orph.length + ' work order(s) with NO house on them (' +
              orph.slice(0, 3).map(function (w) { return _e(String(w.house || 'blank')); }).join(', ') +
              (orph.length > 3 ? '…' : '') + '). Real repairs, but they cannot be listed under a barn. Site total ' + (totWO + orph.length) + '.',
              'Más ' + orph.length + ' orden(es) SIN casa. Reparaciones reales que no se pueden asignar a una casa. Total del sitio ' + (totWO + orph.length) + '.') +
          '</div>') : '') +
      '</div>';

      // ── barns, worst first ──
      html += _sec('🏚 ' + bhL('By barn · most activity first', 'Por casa'));
      barns.slice().sort(function (a, b) { return b.score - a.score; }).forEach(function (b) {
        var open = !!_open[b.house];
        var sys = Object.keys(b.bySys).filter(function (s) { return b.bySys[s].length; })
          .sort(function (x, y) { return b.bySys[y].length - b.bySys[x].length; });
        html += '<div style="background:#1c150e;border:1.5px solid ' + (b.repeats.length ? '#7a4a1a' : '#3a2a18') + ';border-radius:12px;margin-bottom:9px;overflow:hidden;">' +
          '<div onclick="bhToggle(\'' + b.house + '\')" style="padding:11px 13px;cursor:pointer;">' +
            '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;">' +
              '<b style="' + MONO + 'font-size:14px;color:#f5ecdc;">' + bhL('HOUSE ', 'CASA ') + b.house + '</b>' +
              (b.down ? '<span style="' + MONO + 'font-size:9.5px;color:#f0a35a;font-weight:700;">⛔ ' + bhL('DOWN', 'FUERA') + '</span>' : '') +
              (b.repeats.length ? '<span style="' + MONO + 'font-size:9.5px;color:#f87171;font-weight:700;">🔁 ' + bhL('REPEAT: ', 'REPITE: ') + _e(b.repeats.join(', ')) + '</span>' : '') +
              '<span style="margin-left:auto;' + MONO + 'font-size:11px;color:#c9a97a;">' + b.wo.length + ' ' + bhL('WOs', 'órdenes') + ' · ' + b.flags.length + ' ' + bhL('flags', 'marcas') + '</span>' +
              '<span style="' + MONO + 'font-size:12px;color:#8a6a45;">' + (open ? '▾' : '▸') + '</span>' +
            '</div>' +
            (sys.length ? ('<div style="' + MONO + 'font-size:10px;color:#8a6a45;margin-top:5px;">' +
              sys.slice(0, 5).map(function (s) { return _e(s) + ' ' + b.bySys[s].length; }).join(' · ') + '</div>') : '') +
          '</div>';
        if (open) {
          html += '<div style="border-top:1px solid #241a10;padding:10px 13px;">';
          html += '<div style="' + MONO + 'font-size:10px;color:#8a6a45;margin-bottom:6px;">' +
            b.checks + ' ' + bhL('daily checks', 'chequeos') + ' · ' + b.walks + ' ' + bhL('morning walks', 'caminatas') + ' · ' + b.flagged + ' ' + bhL('flagged', 'con marcas') + '</div>';
          if (b.wo.length) {
            html += '<div style="' + MONO + 'font-size:10px;font-weight:700;color:#c99a5a;margin:8px 0 4px;letter-spacing:1px;">' + bhL('WORK ORDERS', 'ÓRDENES DE TRABAJO') + '</div>';
            b.wo.forEach(function (w) {
              var pr = String(w.priority || '').toLowerCase();
              var pc = pr === 'urgent' ? '#f87171' : pr === 'high' ? '#f0a35a' : '#8a6a45';
              var who = String(w.completedBy || w.tech || '');
              var badWho = /house\s*\d/i.test(who);
              html += '<div style="' + MONO + 'font-size:11.5px;color:#cfe0d0;padding:4px 0;border-bottom:1px solid #241a10;">' +
                '<span style="color:#8a6a45;">' + _e(w.date || '?') + '</span> ' +
                '<b style="color:' + pc + ';">' + _e(String(w.priority || '').toUpperCase()) + '</b> ' +
                _e(String(w.problem || w.desc || '').slice(0, 44)) +
                (who ? ('<span style="color:' + (badWho ? '#f0a35a' : '#5a8a5a') + ';"> · ' + _e(who) + (badWho ? ' ⚠' : '') + '</span>') : '<span style="color:#f0a35a;"> · ' + bhL('open', 'abierta') + '</span>') +
              '</div>';
            });
          }
          if (sys.length) {
            html += '<div style="' + MONO + 'font-size:10px;font-weight:700;color:#c99a5a;margin:10px 0 4px;letter-spacing:1px;">' + bhL('FLAGS RAISED ON CHECKS', 'MARCAS EN CHEQUEOS') + '</div>';
            sys.forEach(function (s) {
              var seen = {}, ex = [];
              b.bySys[s].forEach(function (x) { if (!seen[x.f]) { seen[x.f] = 1; ex.push(x); } });
              html += '<div style="' + MONO + 'font-size:11px;color:#cfe0d0;padding:3px 0;">' +
                '<b style="color:#e8c98a;">' + _e(s) + ' × ' + b.bySys[s].length + '</b>' +
                ex.slice(0, 3).map(function (x) { return '<div style="color:#9ab09a;padding-left:12px;font-size:10.5px;">· "' + _e(x.f.slice(0, 62)) + '" <span style="color:#6a5335;">' + _e(x.date) + '</span></div>'; }).join('') +
                (ex.length > 3 ? ('<div style="color:#6a5335;padding-left:12px;font-size:10px;">… +' + (ex.length - 3) + ' ' + bhL('more distinct', 'más') + '</div>') : '') +
              '</div>';
            });
          }
          if (!b.wo.length && !b.flags.length) {
            html += '<div style="' + MONO + 'font-size:11px;color:#5a8a5a;">✅ ' + bhL('No maintenance events on record.', 'Sin eventos.') + '</div>';
          }
          if (b.byHouse.length) {
            html += '<div style="' + MONO + 'font-size:10.5px;color:#f0a35a;margin-top:8px;line-height:1.6;">⚠ ' +
              b.byHouse.length + ' ' + bhL('work order(s) closed by a house name instead of a person — the tablet is signed in as a house.',
                                           'orden(es) cerradas con nombre de casa, no de persona — la tablet está firmada como casa.') + '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
      });

      html += '<div style="' + MONO + 'font-size:9.5px;color:#5a4630;margin-top:14px;line-height:1.7;">' +
        bhL('Where this comes from: work orders (the repair record), plus flags raised on the Daily EE Check and Morning Walk. ' +
            '⚠ PM completions are NOT included — they record farm and system but NO HOUSE, so a PM cannot be traced to a barn. ' +
            'Adding a house field to PM completion is what would make this history complete.',
            'Fuente: órdenes de trabajo + marcas de los chequeos diarios y caminatas. ⚠ Los PM no se incluyen: registran granja y sistema pero NO la casa.') + '</div>';

      body.innerHTML = html;
    }).catch(function (e) {
      console.error('barnhist:', e);
      var b = document.getElementById('bh2-body'); if (b) b.innerHTML = bhL('Could not load.', 'No se pudo cargar.');
    });
  };
})();
