// ═══════════════════════════════════════════════════════════════════════════
// wotime.js — ⏱ JOB TIME (v295, per Joe 2026-08-20)
//
// "make the work order clock in and out when they start them and when they end
//  them and we will start tracking time spent on each job"
//
// The clock itself already existed (woTimerStart / woTimerStop, v245) — what was
// missing was (a) it never auto-clocked-out on completion so 0 of 56 work orders
// had any time on them, and (b) there was nowhere to SEE the time once collected.
// This file is the reporting half. It invents nothing: every figure comes from
// `workMin` and the `workLog` segments the clock writes.
//
// The four questions this answers:
//   1. How long does a job actually take?           (actual vs estimate)
//   2. Where is maintenance time going?             (by system)
//   3. Who is doing the hands-on work?              (by tech)
//   4. Are we even capturing it?                    (coverage — the honest one)
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";

  function wtL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _wtEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _wtM(m) {
    m = Math.round(Number(m) || 0);
    if (!m) return '—';
    return m < 60 ? (m + 'm') : (Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm');
  }
  function _wtH(m) { return (Math.round((Number(m) || 0) / 6) / 10); }   // minutes → hours, 1dp
  // completedTs / ts arrive as a Firestore Timestamp OR a number depending on
  // which client wrote them — same coercion bug that undercounted WO closes in v273.
  function _wtMs(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    return 0;
  }
  function _wtDays(n) { return Date.now() - n * 86400000; }

  var _range = 30;   // days
  window.wtRange = function (d) { _range = d; window.openWOTime(); };

  function _rows() {
    var all = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
    var from = _wtDays(_range);
    return all.filter(function (w) {
      if (!w) return false;
      var when = _wtMs(w.completedTs) || _wtMs(w.ts) || 0;
      return when >= from;
    });
  }

  // Every clock segment in range, flattened — this is the real ledger.
  function _segments(rows) {
    var out = [];
    rows.forEach(function (w) {
      (Array.isArray(w.workLog) ? w.workLog : []).forEach(function (seg) {
        if (!seg) return;
        out.push({
          wo: w, by: seg.by || w.assignedTo || w.tech || wtL('unknown', 'desconocido'),
          min: Number(seg.min) || 0, start: Number(seg.start) || 0, stop: Number(seg.stop) || 0,
          capped: !!seg.capped, auto: !!seg.auto,
          system: w.system || _guessSystem(w), farm: w.farm || ''
        });
      });
    });
    return out;
  }
  // The system field is blank on ~80% of work orders, so fall back to the text.
  function _guessSystem(w) {
    var t = String(w.problem || w.desc || '').toLowerCase();
    var map = [[/feed/, 'Feed'], [/egg\s*collect|collection/, 'Egg Collectors'], [/manure/, 'Manure'],
               [/water|psi/, 'Water'], [/vent|fan/, 'Ventilation'], [/generat/, 'Generator'],
               [/lub/, 'Lubing'], [/light/, 'Lighting'], [/belt/, 'Belts'], [/electric/, 'Electrical']];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(t)) return map[i][1];
    return wtL('Unclassified', 'Sin clasificar');
  }

  function _byKey(list, keyFn) {
    var m = {};
    list.forEach(function (x) {
      var k = keyFn(x) || '—';
      (m[k] || (m[k] = { min: 0, n: 0, wos: {} }));
      m[k].min += x.min; m[k].n++;
      if (x.wo && x.wo._fbId) m[k].wos[x.wo._fbId] = 1;
    });
    return Object.keys(m).map(function (k) {
      return { key: k, min: m[k].min, segments: m[k].n, jobs: Object.keys(m[k].wos).length };
    }).sort(function (a, b) { return b.min - a.min; });
  }

  function _ov() {
    var o = document.getElementById('wt-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'wt-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:965;background:#0a1118;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeWOTime = function () { var o = document.getElementById('wt-overlay'); if (o) o.style.display = 'none'; };

  function _sec(t) { return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#5a8ad0;text-transform:uppercase;margin:20px 2px 8px;font-weight:700;">' + t + '</div>'; }
  function _box(inner, border) { return '<div style="background:#0d1622;border:1.5px solid ' + (border || '#1e3050') + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;">' + inner + '</div>'; }
  function _bar(pct, col) {
    return '<div style="height:6px;background:#101c2a;border-radius:50px;overflow:hidden;margin-top:4px;">' +
      '<div style="height:100%;width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + (col || '#3b82f6') + ';"></div></div>';
  }

  window.openWOTime = function () {
    var o = _ov();
    var rows = _rows();
    var segs = _segments(rows);
    var totalMin = segs.reduce(function (a, s) { return a + s.min; }, 0);
    var withTime = rows.filter(function (w) { return (Number(w.workMin) || 0) > 0; });
    var running = (typeof workOrders !== 'undefined' ? workOrders : []).filter(function (w) { return w && w.timerStart; });

    var html = '';

    // ── clocked in right now ──
    if (running.length) {
      html += _sec('⏱ ' + wtL('Clocked in right now', 'Trabajando ahora'));
      html += _box(running.map(function (w) {
        var mins = Math.round((Date.now() - w.timerStart) / 60000);
        var warn = mins > 480;
        return '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;' + MONO + 'font-size:12.5px;flex-wrap:wrap;">' +
          '<span style="width:9px;height:9px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;"></span>' +
          '<b style="color:#e8f0fa;">' + _wtEsc(w.timerBy || '?') + '</b>' +
          '<span style="color:#8aa0c0;">' + _wtEsc(w.farm || '') + ' ' + _wtEsc(String(w.house || '')) + ' — ' + _wtEsc(String(w.problem || w.desc || '').slice(0, 40)) + '</span>' +
          '<b style="margin-left:auto;color:' + (warn ? '#ffb4a6' : '#86efac') + ';">' + _wtM(mins) + (warn ? ' ⚠' : '') + '</b>' +
        '</div>';
      }).join('') +
        (running.some(function (w) { return (Date.now() - w.timerStart) / 60000 > 480; })
          ? ('<div style="' + MONO + 'font-size:10.5px;color:#ffb4a6;margin-top:7px;">⚠ ' +
             wtL('Over 8 hours — someone forgot to clock out. A segment is capped at 12h so one forgotten timer cannot wreck the averages.',
                 'Más de 8 horas — alguien olvidó marcar salida. Un segmento se limita a 12h.') + '</div>')
          : ''), '#2a6a3a');
    }

    // ── headline ──
    html += _sec('📊 ' + wtL('Job time · last ' + _range + ' days', 'Tiempo · últimos ' + _range + ' días'));
    var cov = rows.length ? Math.round(withTime.length / rows.length * 100) : 0;
    html += _box(
      '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end;">' +
        '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + wtL('HOURS LOGGED', 'HORAS') + '</div>' +
          '<div style="' + MONO + 'font-size:24px;font-weight:700;color:#e8f0fa;">' + _wtH(totalMin) + '</div></div>' +
        '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + wtL('JOBS WITH TIME', 'TRABAJOS CON TIEMPO') + '</div>' +
          '<div style="' + MONO + 'font-size:24px;font-weight:700;color:#9cc0f6;">' + withTime.length + '<span style="font-size:13px;color:#5a7aa0;">/' + rows.length + '</span></div></div>' +
        '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + wtL('AVG PER JOB', 'PROM/TRABAJO') + '</div>' +
          '<div style="' + MONO + 'font-size:24px;font-weight:700;color:#e8f0fa;">' + _wtM(withTime.length ? totalMin / withTime.length : 0) + '</div></div>' +
        '<div><div style="' + MONO + 'font-size:10px;color:#5a7aa0;">' + wtL('COVERAGE', 'COBERTURA') + '</div>' +
          '<div style="' + MONO + 'font-size:24px;font-weight:700;color:' + (cov >= 80 ? '#86efac' : cov >= 40 ? '#f0c674' : '#ffb4a6') + ';">' + cov + '%</div></div>' +
      '</div>' + _bar(cov, cov >= 80 ? '#4ade80' : cov >= 40 ? '#f0c674' : '#e5533c') +
      '<div style="' + MONO + 'font-size:10px;color:#5a7aa0;margin-top:7px;">' +
        wtL('Coverage = work orders that have any clocked time. Until this is high, every average below is only as good as the habit.',
            'Cobertura = órdenes con tiempo registrado.') + '</div>',
      cov < 40 ? '#7f1d1d' : undefined);

    if (!segs.length) {
      html += _box('<div style="' + MONO + 'font-size:12px;color:#f0c674;line-height:1.6;">⚠ ' +
        wtL('No clocked time in this window yet. The crew taps <b>▶ CLOCK IN</b> when they start a job and <b>⏹ CLOCK OUT</b> when they stop — and closing a work order now clocks them out automatically. Once a week of that lands, this page fills in.',
            'Aún no hay tiempo registrado. El equipo toca <b>▶ CLOCK IN</b> al empezar y <b>⏹ CLOCK OUT</b> al terminar.') + '</div>', '#5a4a1a');
    } else {
      // ── longest jobs ──
      html += _sec('🔧 ' + wtL('Longest jobs', 'Trabajos más largos'));
      var jobs = withTime.slice().sort(function (a, b) { return (Number(b.workMin) || 0) - (Number(a.workMin) || 0); }).slice(0, 12);
      html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;min-width:600px;">' +
        '<thead><tr style="border-bottom:1px solid #1e3050;color:#5a7aa0;">' +
          '<th style="text-align:left;padding:6px;">' + wtL('Job', 'Trabajo') + '</th>' +
          '<th style="padding:6px;">' + wtL('Site', 'Sitio') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + wtL('Actual', 'Real') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + wtL('Est.', 'Est.') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + wtL('vs est', 'vs est') + '</th>' +
          '<th style="padding:6px;">' + wtL('Who', 'Quién') + '</th>' +
        '</tr></thead><tbody>';
      jobs.forEach(function (w) {
        var wm = Number(w.workMin) || 0, est = (Number(w.estHours) || 0) * 60;
        var pct = est ? Math.round(wm / est * 100) : null;
        var col = pct == null ? '#5a7aa0' : pct <= 110 ? '#86efac' : pct <= 150 ? '#f0c674' : '#ffb4a6';
        var who = {};
        (Array.isArray(w.workLog) ? w.workLog : []).forEach(function (s) { if (s && s.by) who[s.by] = 1; });
        html += '<tr style="border-bottom:1px solid #131f30;">' +
          '<td style="padding:6px;color:#e8f0fa;">' + _wtEsc(String(w.problem || w.desc || '—').slice(0, 42)) + '</td>' +
          '<td style="padding:6px;text-align:center;color:#8aa0c0;">' + _wtEsc(w.farm || '') + ' ' + _wtEsc(String(w.house || '')) + '</td>' +
          '<td style="padding:6px;text-align:right;color:#e8f0fa;font-weight:700;">' + _wtM(wm) + '</td>' +
          '<td style="padding:6px;text-align:right;color:#5a7aa0;">' + (est ? _wtM(est) : '—') + '</td>' +
          '<td style="padding:6px;text-align:right;color:' + col + ';font-weight:700;">' + (pct == null ? '—' : pct + '%') + '</td>' +
          '<td style="padding:6px;color:#8aa0c0;">' + _wtEsc(Object.keys(who).join(', ').slice(0, 24)) + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>' +
        '<div style="' + MONO + 'font-size:9.5px;color:#4a6a90;margin-top:6px;">' +
          wtL('vs est over 150% means the estimate is wrong or the job hit a surprise — both worth knowing before quoting the next one.',
              'Más de 150% = la estimación está mal o hubo sorpresa.') + '</div>';

      // ── by system ──
      html += _sec('⚙️ ' + wtL('Where the hours go — by system', 'Dónde van las horas'));
      var bySys = _byKey(segs, function (s) { return s.system; });
      var maxSys = bySys.length ? bySys[0].min : 1;
      html += _box(bySys.slice(0, 10).map(function (r) {
        return '<div style="padding:5px 0;">' +
          '<div style="display:flex;justify-content:space-between;' + MONO + 'font-size:12px;">' +
            '<span style="color:#e8f0fa;">' + _wtEsc(r.key) + '</span>' +
            '<span style="color:#9cc0f6;font-weight:700;">' + _wtH(r.min) + 'h <span style="color:#5a7aa0;font-weight:400;">· ' + r.jobs + ' ' + wtL('jobs', 'trabajos') + ' · ' + wtL('avg ', 'prom ') + _wtM(r.min / Math.max(1, r.jobs)) + '</span></span>' +
          '</div>' + _bar(r.min / maxSys * 100, '#3b82f6') + '</div>';
      }).join(''));

      // ── by tech ──
      html += _sec('👷 ' + wtL('Hands-on hours by tech', 'Horas por técnico'));
      var byTech = _byKey(segs, function (s) { return s.by; });
      var maxT = byTech.length ? byTech[0].min : 1;
      html += _box(byTech.map(function (r) {
        return '<div style="padding:5px 0;">' +
          '<div style="display:flex;justify-content:space-between;' + MONO + 'font-size:12px;">' +
            '<span style="color:#e8f0fa;">' + _wtEsc(r.key) + '</span>' +
            '<span style="color:#86efac;font-weight:700;">' + _wtH(r.min) + 'h <span style="color:#5a7aa0;font-weight:400;">· ' + r.jobs + ' ' + wtL('jobs', 'trabajos') + '</span></span>' +
          '</div>' + _bar(r.min / maxT * 100, '#4ade80') + '</div>';
      }).join('') +
        '<div style="' + MONO + 'font-size:10px;color:#5a7aa0;margin-top:8px;">' +
          wtL('This is wrench time on work orders — not a timesheet. It says nothing about PMs, walks or anything done off-system.',
              'Esto es tiempo en órdenes de trabajo, no una tarjeta de tiempo.') + '</div>');

      var capped = segs.filter(function (s) { return s.capped; }).length;
      var auto = segs.filter(function (s) { return s.auto; }).length;
      if (capped || auto) {
        html += _box('<div style="' + MONO + 'font-size:11px;color:#c9a97a;line-height:1.6;">' +
          (capped ? ('⚠ ' + capped + ' ' + wtL('segment(s) hit the 12h cap — a timer was left running.', 'segmento(s) alcanzaron el límite de 12h.') + '<br>') : '') +
          (auto ? ('ℹ ' + auto + ' ' + wtL('segment(s) were closed automatically when the work order was completed.', 'segmento(s) se cerraron al completar la orden.')) : '') +
          '</div>', '#5a4a1a');
      }
    }

    o.innerHTML = '<div style="max-width:900px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeWOTime()" style="padding:11px 16px;background:#0d1a2a;border:1.5px solid #2a4a7a;border-radius:50px;color:#9cc0f6;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + wtL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:27px;letter-spacing:2px;line-height:1;color:#e8f0fa;">⏱ ' + wtL('JOB TIME', 'TIEMPO POR TRABAJO') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#5a7aa0;margin-top:2px;">' + wtL('Clock in when you start · clock out when you stop', 'Marca al empezar y al terminar') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
        [[7, '7d'], [30, '30d'], [90, '90d']].map(function (r) {
          var on = _range === r[0];
          return '<button onclick="wtRange(' + r[0] + ')" style="flex:1;padding:10px;border-radius:10px;cursor:pointer;' + MONO +
            'font-size:12px;font-weight:700;background:' + (on ? '#152a45' : '#0b1420') + ';border:1.5px solid ' + (on ? '#3b82f6' : '#1e3050') +
            ';color:' + (on ? '#cfe0fa' : '#5a7aa0') + ';">' + r[1] + '</button>';
        }).join('') +
      '</div>' + html +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}
    try { if (typeof trackUse === 'function') trackUse('jobTime'); } catch (e) {}
  };
})();
