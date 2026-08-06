// ═══════════════════════════════════════════════════════════════════════════
// master.js — 👑 JOE'S MASTER BOARD (v266, per Joe 2026-08-03):
// "show me the 7 day trends and so on… only make that available for me with
//  filter to do one site, 2 sites… alert me when we see something bad —
//  WOs repeating and eggs not hitting target."
//
// • Joe-only (same login gate as the 📈 Usage board). 👑 chip bottom-left,
//   with a red badge when there are active alerts.
// • Site filter chips: HEGINS / DANVILLE — tap to include one, both = all.
//   (Danville includes the Processing Plant's work orders.)
// • Sections: ⚠ Alerts · 📦 Cases/hr 7-day trend vs target · 🏠 per-unit
//   7-day (runs, eggs/hr, prod %) · 🔧 WOs 7d (opened/closed, repeats, urgent).
// • Data: eggDailyRun + eggFlow + tierExternal (json field!) + workOrders.
//   Groups here MUST mirror EF_GROUPS in egg-flow.js (it's IIFE-private).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var EGGS_PER_CASE = 360;
  var TGT_FALLBACK = { Hegins: { target: 131.7, goal6: 143.6 }, Danville: { target: 157.7, goal6: 171.9 } };
  var M_GROUPS = { Hegins: [{ id: 'G1', label: 'Group 1', houses: ['1', '3', '4'] }, { id: 'G2', label: 'Group 2', houses: ['5', '6', '7', '8'] }] };
  var WO_FARMS = { Hegins: ['Hegins'], Danville: ['Danville', 'Processing Plant'] };

  function _me() { try { return (typeof getDeviceUser === 'function') ? String(getDeviceUser() || '').trim() : ''; } catch (e) { return ''; } }
  // Roster name is "Joseph Schmidt" — match Joe/Joseph + Schmidt (fixed v266).
  function _isJoe() {
    var n = _me().toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!n) return false;
    if (n === 'joe' || n === 'joseph') return true;
    return /^jo/.test(n) && /schmidt/.test(n);
  }
  function _tgt(site) { var t = (window.EGG_RATE_TARGET && window.EGG_RATE_TARGET[site]) || TGT_FALLBACK[site]; return t || { target: null, goal6: null }; }
  function _dstr(offset) { return new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10); }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _num(v) { return (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString(); }
  // completedTs can be a Firestore Timestamp OBJECT (serverTimestamp) — coerce.
  function _ms(v) { try { return (v && typeof v.toMillis === 'function') ? v.toMillis() : (Number(v) || 0); } catch (e) { return 0; } }

  function _sites() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem('masterSites') || 'null'); } catch (e) {}
    if (!raw || !raw.length) raw = ['Hegins', 'Danville'];
    return raw.filter(function (s) { return s === 'Hegins' || s === 'Danville'; });
  }
  window.masterToggleSite = function (site) {
    var cur = _sites(), i = cur.indexOf(site);
    if (i >= 0) { if (cur.length > 1) cur.splice(i, 1); }   // never allow zero sites
    else cur.push(site);
    try { localStorage.setItem('masterSites', JSON.stringify(cur)); } catch (e) {}
    window.openMasterBoard();
  };

  // Clock 'HH:MM' pair → minutes (same-day); fallback manualMin; junk → null.
  function _mMin(rec) {
    function p(s) { var m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; }
    var a = p(rec.startClock), b = p(rec.stopClock);
    var d = (a != null && b != null && b > a) ? b - a : null;
    if (d == null && rec.manualMin != null) d = Number(rec.manualMin) || null;
    return (d && d > 0 && d <= 960) ? d : null;
  }

  var _cache = null;   // { days, data } — so switching tabs doesn't refetch
  function _fetchAll(days) {
    days = days || 14;
    if (_cache && _cache.days >= days) return Promise.resolve(_cache.data);
    var dFrom = _dstr(days - 1), tFrom = Date.now() - days * 86400000;
    return Promise.all([
      db.collection('eggDailyRun').where('date', '>=', dFrom).get(),
      db.collection('eggFlow').where('date', '>=', dFrom).get(),
      db.collection('tierExternal').get(),
      db.collection('workOrders').where('ts', '>=', tFrom).get(),
      db.collection('barnWalks').where('date', '>=', dFrom).get().catch(function () { return null; }),
      db.collection('workOrders').where('status', '==', 'open').get().catch(function () { return null; }),
      db.collection('workOrders').where('status', '==', 'in-progress').get().catch(function () { return null; })
    ]).then(function (r) {
      var runs = [], flows = [], ext = {}, wos = [], walks = [], openWos = [];
      r[0].forEach(function (d) { runs.push(d.data()); });
      r[1].forEach(function (d) { flows.push(d.data()); });
      r[2].forEach(function (d) { try { ext[d.id] = JSON.parse((d.data() || {}).json || '{}'); } catch (e) {} });
      r[3].forEach(function (d) { wos.push(d.data()); });
      if (r[4]) r[4].forEach(function (d) { walks.push(d.data()); });
      if (r[5]) r[5].forEach(function (d) { openWos.push(d.data()); });
      if (r[6]) r[6].forEach(function (d) { openWos.push(d.data()); });
      var D = { runs: runs, flows: flows, ext: ext, wos: wos, walks: walks, openWos: openWos };
      _cache = { days: days, data: D };
      return D;
    });
  }

  // ── WEEKLY buckets: index 0 = oldest, last = current week ──
  function _weeks(n) {
    var out = [];
    for (var w = n - 1; w >= 0; w--) {
      out.push({ fromD: w * 7, toD: (w + 1) * 7, label: _dstr((w + 1) * 7 - 1).slice(5) + '–' + _dstr(w * 7).slice(5), cur: w === 0 });
    }
    return out;
  }
  function _weekAgg(D, site, fromD, toD) {
    var dset = {}, i;
    for (i = fromD; i < toD; i++) dset[_dstr(i)] = 1;
    var rate = _avg(_dayRates(D, site, fromD, toD));
    var mins = 0, eggs = 0, mort = 0, daysRun = {};
    if (site === 'Hegins') {
      D.runs.forEach(function (r) {
        if (r.farm !== 'Hegins' || !dset[r.date]) return;
        var m = _mMin(r); if (!m) return;
        mins += m; eggs += Number(r.eggs) || 0; daysRun[r.date] = 1;
      });
    } else {
      D.flows.forEach(function (f) {
        if (f.farm !== site || f.status !== 'done' || f.minutes == null || !dset[f.date]) return;
        var m = Number(f.minutes) || 0; if (m <= 0 || m > 480) return;
        mins += m; daysRun[f.date] = 1;
      });
      eggs = _extEggs(D.ext, site) * Object.keys(daysRun).length;   // no egg history — est. from today's rate
    }
    (D.walks || []).forEach(function (w) {
      if (w.farm !== site || !dset[w.date]) return;
      mort += Number(w.mortCount) || 0;
    });
    var farms = WO_FARMS[site] || [site];
    var hi = Date.now() - fromD * 86400000, lo = Date.now() - toD * 86400000;
    var opened = D.wos.filter(function (w) { return farms.indexOf(w.farm) >= 0 && (w.ts || 0) >= lo && (w.ts || 0) < hi; }).length;
    var closed = D.wos.filter(function (w) { var t = _ms(w.completedTs); return farms.indexOf(w.farm) >= 0 && w.status === 'completed' && t >= lo && t < hi; }).length;
    return { rate: rate, hours: Math.round(mins / 60 * 10) / 10, cases: Math.round(eggs / EGGS_PER_CASE), mort: mort, opened: opened, closed: closed, days: Object.keys(daysRun).length };
  }

  function _extEggs(ext, site) {
    var hs = (ext[site] && Array.isArray(ext[site].houses)) ? ext[site].houses : [];
    var sum = 0;
    hs.forEach(function (h) { if (h.eggsPerDay != null && Number(h.eggsPerDay) > 0) sum += Number(h.eggsPerDay); });
    return sum;
  }

  // Per-day cases/hr for one site over [from,to) days ago. Hegins = packer
  // machines (eggDailyRun); Danville = house belts (eggFlow) + farm-record eggs.
  function _dayRates(D, site, fromD, toD) {
    var out = [];
    for (var i = fromD; i < toD; i++) {
      var day = _dstr(i), mins = 0, eggs = 0;
      if (site === 'Hegins') {
        D.runs.forEach(function (r) {
          if (r.farm !== 'Hegins' || r.date !== day) return;
          var m = _mMin(r); if (!m) return;
          mins += m; eggs += Number(r.eggs) || 0;
        });
      } else {
        D.flows.forEach(function (f) {
          if (f.farm !== 'Danville' || f.date !== day) return;
          if (f.status !== 'done' || f.minutes == null) return;
          var m = Number(f.minutes) || 0; if (m <= 0 || m > 480) return;
          mins += m;
        });
        if (mins) eggs = _extEggs(D.ext, 'Danville');
      }
      out.push({ date: day, rate: (mins > 0 && eggs > 0) ? Math.round(eggs / EGGS_PER_CASE / (mins / 60) * 10) / 10 : null });
    }
    return out;
  }
  function _avg(list) { var v = list.map(function (d) { return d.rate; }).filter(function (x) { return x != null; }); return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10 : null; }

  // Repeating WOs: same farm+house+problem ≥2 in 14 days.
  function _repeats(wos, farms) {
    var g = {};
    wos.forEach(function (w) {
      if (farms.indexOf(w.farm) < 0) return;
      var k = (w.farm || '?') + '|' + (w.house || '—') + '|' + (w.problem || w.desc || '?');
      (g[k] = g[k] || { farm: w.farm, house: w.house, problem: w.problem || w.desc, n: 0, open: 0 });
      g[k].n++; if (w.status !== 'completed') g[k].open++;
    });
    return Object.keys(g).map(function (k) { return g[k]; })
      .filter(function (x) { return x.n >= 2; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  // Everything bad, in one list. Used by both the board and the chip badge.
  function _alerts(D, sites) {
    var A = [];
    sites.forEach(function (site) {
      var t = _tgt(site).target;
      var wk = _avg(_dayRates(D, site, 0, 7));
      if (t && wk != null && wk < t * 0.95) A.push({ sev: 'red', txt: '📦 ' + site + ' eggs NOT hitting target: 7-day avg ' + wk + ' cases/hr vs target ' + t + ' (' + Math.round(wk / t * 100) + '%)' });
      else if (t && wk != null && wk < t) A.push({ sev: 'amber', txt: '📦 ' + site + ' just under target: ' + wk + ' vs ' + t + ' cases/hr' });
      var hs = (D.ext[site] && D.ext[site].houses) || [];
      hs.forEach(function (h) {
        var lay = (h.lay7d != null ? h.lay7d : h.layLatest);
        if (lay != null && lay > 2) lay = lay / 100;
        var note = String(h.note || '');
        if (lay != null && lay >= 0.20 && lay < 0.85 && !/flock out|down/i.test(note)) {
          A.push({ sev: 'amber', txt: '🥚 ' + site + ' ' + _esc(h.name || '?') + ' production rate low: ' + Math.round(lay * 1000) / 10 + '% lay' });
        }
      });
    });
    var farms = []; sites.forEach(function (s) { farms = farms.concat(WO_FARMS[s] || [s]); });
    _repeats(D.wos, farms).slice(0, 6).forEach(function (r) {
      A.push({ sev: r.open ? 'red' : 'amber', txt: '🔁 REPEAT WO ×' + r.n + ': ' + _esc(r.problem) + ' — ' + r.farm + (r.house ? ' H' + r.house : '') + (r.open ? ' (' + r.open + ' still open)' : ' (all closed — watch it)') });
    });
    var urg = D.wos.filter(function (w) { return farms.indexOf(w.farm) >= 0 && w.status !== 'completed' && w.priority === 'urgent'; }).length;
    if (urg) A.push({ sev: 'red', txt: '🚨 ' + urg + ' URGENT work order' + (urg > 1 ? 's' : '') + ' open right now' });
    var now = Date.now();
    var stuck = D.flows.filter(function (f) { return sites.indexOf(f.farm) >= 0 && f.status !== 'done' && f.startTs && (now - f.startTs) > 8 * 3600000; }).length;
    if (stuck) A.push({ sev: 'amber', txt: '⏱ ' + stuck + ' egg-flow run(s) left open >8h — someone forgot Stop' });
    return A;
  }

  // ── 👑 chip (Joe only) with red badge ──
  function _chip() {
    try {
      var ex = document.getElementById('master-chip');
      if (!_isJoe()) { if (ex) ex.remove(); return; }
      if (ex) return;
      var b = document.createElement('button');
      b.id = 'master-chip';
      b.onclick = function () { window.openMasterBoard(); };
      b.style.cssText = 'position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 124px);z-index:940;background:#1d1626;border:1.5px solid #8a6dd6;border-radius:50px;color:#c9b0f0;' + MONO + 'font-size:12px;font-weight:700;padding:9px 14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.45);';
      b.innerHTML = '👑 Master<span id="master-badge" style="display:none;margin-left:7px;background:#e53e3e;color:#fff;border-radius:50px;padding:1px 7px;font-size:11px;"></span>';
      document.body.appendChild(b);
      _badge();
    } catch (e) {}
  }
  function _badge() {
    try {
      if (!_isJoe() || typeof db === 'undefined' || !db) return;
      _fetchAll().then(function (D) {
        var n = _alerts(D, _sites()).filter(function (a) { return a.sev === 'red'; }).length;
        var el = document.getElementById('master-badge'); if (!el) return;
        if (n > 0) { el.style.display = 'inline-block'; el.textContent = n; }
        else el.style.display = 'none';
      }).catch(function () {});
    } catch (e) {}
  }
  setTimeout(_chip, 4000);
  setInterval(_chip, 60000);
  setInterval(_badge, 10 * 60000);   // re-check alerts every 10 min

  // ── 📈 WEEKLY TRENDS tab (8 weeks, week over week) ──
  function _weeklyHtml(D, sites) {
    var wks = _weeks(8);
    return sites.map(function (site) {
      var t = _tgt(site);
      var rows = wks.map(function (w) { return Object.assign({ label: w.label, cur: w.cur }, _weekAgg(D, site, w.fromD, w.toD)); });
      var withRate = rows.filter(function (r) { return r.rate != null; });
      if (!withRate.length) return '<div style="' + MONO + 'font-size:11.5px;color:#6a5a8a;margin-bottom:10px;"><b style="color:#efe8fa;">' + site + '</b> — no run data in the last 8 weeks yet.</div>';
      var top = Math.max.apply(null, rows.map(function (r) { return r.rate || 0; }).concat([t.target || 0, t.goal6 || 0, 1]));
      var H = 110;
      var tLine = t.target ? Math.round(t.target / top * H) : null;
      var gLine = t.goal6 ? Math.round(t.goal6 / top * H) : null;
      var bars = rows.map(function (r) {
        var h = r.rate ? Math.max(4, Math.round(r.rate / top * H)) : 3;
        var c = r.rate == null ? '#2a2340' : (t.target && r.rate >= t.target) ? '#4ade80' : (t.target && r.rate >= t.target * 0.95) ? '#e8c96a' : '#f0a0a0';
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;min-width:0;">' +
          '<span style="' + MONO + 'font-size:9px;color:' + (r.cur ? '#efe8fa' : '#9a8ac0') + ';font-weight:' + (r.cur ? '700' : '400') + ';">' + (r.rate != null ? r.rate : '·') + '</span>' +
          '<div style="width:78%;height:' + h + 'px;background:' + c + ';border-radius:3px 3px 0 0;' + (r.cur ? 'box-shadow:0 0 0 1.5px #efe8fa inset;' : '') + '"></div>' +
        '</div>';
      }).join('');
      var labels = rows.map(function (r) {
        return '<div style="flex:1;text-align:center;' + MONO + 'font-size:7.5px;color:' + (r.cur ? '#c9b0f0' : '#5a4a7a') + ';min-width:0;overflow:hidden;">' + r.label + '</div>';
      }).join('');
      // week-over-week move on the most recent two weeks that have data
      var lastTwo = withRate.slice(-2);
      var mv = (lastTwo.length === 2 && lastTwo[0].rate) ? Math.round((lastTwo[1].rate - lastTwo[0].rate) / lastTwo[0].rate * 100) : null;
      var tbl = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11px;min-width:560px;">' +
        '<thead><tr style="border-bottom:1px solid #3a2f55;color:#6a5a8a;">' +
          '<th style="text-align:left;padding:5px 6px;">Week</th><th style="padding:5px 6px;">Cases/hr</th><th style="padding:5px 6px;">vs prior</th>' +
          '<th style="padding:5px 6px;">Run hrs</th><th style="padding:5px 6px;">Cases</th><th style="padding:5px 6px;">Mort</th><th style="padding:5px 6px;">WO open/close</th>' +
        '</tr></thead><tbody>' +
        rows.slice().reverse().map(function (r, i, arr) {
          var prior = arr[i + 1];
          var d = (r.rate != null && prior && prior.rate) ? Math.round((r.rate - prior.rate) / prior.rate * 100) : null;
          var rc = r.rate == null ? '#6a5a8a' : (t.target && r.rate >= t.target) ? '#4ade80' : (t.target && r.rate >= t.target * 0.95) ? '#e8c96a' : '#f0a0a0';
          return '<tr style="border-bottom:1px solid #241d3a;' + (r.cur ? 'background:#1d1630;' : '') + '">' +
            '<td style="padding:6px;color:#cfc0e8;">' + r.label + (r.cur ? ' <span style="color:#c9b0f0;font-size:8.5px;">NOW</span>' : '') + '</td>' +
            '<td style="padding:6px;text-align:center;font-weight:700;color:' + rc + ';">' + (r.rate != null ? r.rate : '—') + '</td>' +
            '<td style="padding:6px;text-align:center;color:' + (d == null ? '#6a5a8a' : d >= 0 ? '#4ade80' : '#f0a0a0') + ';">' + (d == null ? '—' : (d >= 0 ? '▲' : '▼') + Math.abs(d) + '%') + '</td>' +
            '<td style="padding:6px;text-align:center;color:#cfc0e8;">' + (r.hours || '—') + '</td>' +
            '<td style="padding:6px;text-align:center;color:#cfc0e8;">' + _num(r.cases || null) + '</td>' +
            '<td style="padding:6px;text-align:center;color:' + (r.mort > 0 ? '#e8c96a' : '#6a5a8a') + ';">' + (r.mort || '—') + '</td>' +
            '<td style="padding:6px;text-align:center;color:#cfc0e8;">' + r.opened + ' / <span style="color:#4ade80;">' + r.closed + '</span></td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>';
      return '<div style="margin-bottom:18px;">' +
        '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap;">' +
          '<b style="' + MONO + 'font-size:13px;color:#efe8fa;">' + site + '</b>' +
          '<span style="' + MONO + 'font-size:10.5px;color:#9a8ac0;">8 weeks · cases/hr · 🎯 ' + (t.target || '—') + ' · 🚀 ' + (t.goal6 || '—') + '</span>' +
          (mv != null ? ('<span style="' + MONO + 'font-size:10.5px;color:' + (mv >= 0 ? '#4ade80' : '#f0a0a0') + ';font-weight:700;">' + (mv >= 0 ? '▲' : '▼') + Math.abs(mv) + '% week over week</span>') : '') +
        '</div>' +
        '<div style="position:relative;background:#120d1d;border-radius:8px;padding:8px;">' +
          (tLine != null ? '<div title="target" style="position:absolute;left:8px;right:8px;bottom:' + (8 + tLine) + 'px;border-top:1.5px dashed #4ade80;opacity:.75;"></div>' : '') +
          (gLine != null ? '<div title="6-month goal" style="position:absolute;left:8px;right:8px;bottom:' + (8 + gLine) + 'px;border-top:1px dashed #8a6dd6;opacity:.6;"></div>' : '') +
          '<div style="display:flex;align-items:flex-end;gap:4px;height:' + (H + 16) + 'px;position:relative;">' + bars + '</div>' +
          '<div style="display:flex;gap:4px;margin-top:3px;">' + labels + '</div>' +
        '</div>' +
        '<div style="' + MONO + 'font-size:9px;color:#5a4a7a;margin:5px 0 7px;">🟩 dashed = target ' + (t.target || '—') + ' · 🟪 dashed = 6-month goal ' + (t.goal6 || '—') + ' · outlined bar = this week (still filling)</div>' +
        tbl +
      '</div>';
    }).join('');
  }

  // ── 💰 8-HOUR PLAN (v274, per Joe: "we run from 8 hours and did this many
  // eggs — not by person, just operational cost"). Day span = first Start to
  // last Stop across the plant's machines; plan = 8.0h; over-plan = the waste.
  // Earned hours = cases ÷ that plant's target cases/hr → efficiency = earned/span.
  var PLAN_HOURS = 8.0;
  function _clockMin(c) { var m = /^(\d{1,2}):(\d{2})/.exec(String(c || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function _planDay(D, site, day) {
    var st = null, en = null, eggs = 0, got = false;
    D.runs.forEach(function (r) {
      if (r.farm !== site || r.date !== day) return;
      var a = _clockMin(r.startClock), b = _clockMin(r.stopClock);
      if (a != null) { st = (st == null || a < st) ? a : st; }
      if (b != null) { en = (en == null || b > en) ? b : en; }
      eggs += Number(r.eggs) || 0; got = true;
    });
    if (!got || st == null || en == null || en <= st) return null;
    var span = (en - st) / 60;
    var cases = eggs / EGGS_PER_CASE;
    var tgt = _tgt(site).target;
    var earned = tgt ? cases / tgt : null;
    return {
      date: day, start: st, end: en,
      span: Math.round(span * 10) / 10,
      over: Math.round((span - PLAN_HOURS) * 10) / 10,
      eggs: eggs, cases: Math.round(cases),
      rate: span > 0.05 ? Math.round(cases / span * 10) / 10 : null,
      earned: earned != null ? Math.round(earned * 10) / 10 : null,
      eff: (earned != null && span > 0.05) ? Math.round(earned / span * 100) : null
    };
  }
  function _fmtClk(min) { var h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12; return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap; }
  function _planHtml(D, sites) {
    return sites.map(function (site) {
      var rows = [];
      for (var i = 0; i < 7; i++) { var r = _planDay(D, site, _dstr(i)); if (r) rows.push(r); }
      if (!rows.length) return '<div style="' + MONO + 'font-size:11.5px;color:#6a5a8a;margin-bottom:12px;"><b style="color:#efe8fa;">' + site + '</b> — no start/stop times entered in the last 7 days.</div>';
      var tSpan = 0, tOver = 0, tCases = 0, tEarned = 0, nEff = 0, effSum = 0;
      rows.forEach(function (r) { tSpan += r.span; tOver += Math.max(0, r.over); tCases += r.cases; if (r.earned != null) tEarned += r.earned; if (r.eff != null) { effSum += r.eff; nEff++; } });
      var body = rows.map(function (r) {
        var oc = r.over > 0.5 ? '#f0a0a0' : r.over > 0 ? '#e8c96a' : '#4ade80';
        var ec = r.eff == null ? '#6a5a8a' : r.eff >= 90 ? '#4ade80' : r.eff >= 75 ? '#e8c96a' : '#f0a0a0';
        return '<tr style="border-bottom:1px solid #241d3a;">' +
          '<td style="padding:6px;color:#cfc0e8;">' + r.date.slice(5).replace('-', '/') + '</td>' +
          '<td style="padding:6px;text-align:center;color:#9a8ac0;">' + _fmtClk(r.start) + '→' + _fmtClk(r.end) + '</td>' +
          '<td style="padding:6px;text-align:center;color:#efe8fa;font-weight:700;">' + r.span + 'h</td>' +
          '<td style="padding:6px;text-align:center;font-weight:700;color:' + oc + ';">' + (r.over > 0 ? '+' : '') + r.over + 'h</td>' +
          '<td style="padding:6px;text-align:center;color:#cfc0e8;">' + _num(r.cases) + '</td>' +
          '<td style="padding:6px;text-align:center;color:#cfc0e8;">' + (r.rate != null ? r.rate : '—') + '</td>' +
          '<td style="padding:6px;text-align:center;color:#cfc0e8;">' + (r.earned != null ? r.earned + 'h' : '—') + '</td>' +
          '<td style="padding:6px;text-align:center;font-weight:700;color:' + ec + ';">' + (r.eff != null ? r.eff + '%' : '—') + '</td>' +
        '</tr>';
      }).join('');
      return '<div style="margin-bottom:16px;">' +
        '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap;">' +
          '<b style="' + MONO + 'font-size:13px;color:#efe8fa;">' + site + '</b>' +
          '<span style="' + MONO + 'font-size:10.5px;color:#9a8ac0;">plan ' + PLAN_HOURS.toFixed(1) + 'h/day · 🎯 ' + (_tgt(site).target || '—') + ' cases/hr</span>' +
          '<span style="' + MONO + 'font-size:10.5px;font-weight:700;color:' + (tOver > 1 ? '#f0a0a0' : '#4ade80') + ';">' + Math.round(tOver * 10) / 10 + 'h over plan this week</span>' +
        '</div>' +
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;min-width:620px;">' +
        '<thead><tr style="border-bottom:1px solid #3a2f55;color:#6a5a8a;"><th style="text-align:left;padding:5px 6px;">Day</th><th style="padding:5px 6px;">Ran</th><th style="padding:5px 6px;">Span</th><th style="padding:5px 6px;">vs 8h</th><th style="padding:5px 6px;">Cases</th><th style="padding:5px 6px;">Cases/hr</th><th style="padding:5px 6px;">Earned</th><th style="padding:5px 6px;">Efficiency</th></tr></thead>' +
        '<tbody>' + body +
        '<tr style="border-top:1.5px solid #3a2f55;">' +
          '<td style="padding:6px;color:#c9b0f0;font-weight:700;">WEEK</td><td></td>' +
          '<td style="padding:6px;text-align:center;color:#efe8fa;font-weight:700;">' + Math.round(tSpan * 10) / 10 + 'h</td>' +
          '<td style="padding:6px;text-align:center;font-weight:700;color:' + (tOver > 1 ? '#f0a0a0' : '#4ade80') + ';">+' + Math.round(tOver * 10) / 10 + 'h</td>' +
          '<td style="padding:6px;text-align:center;color:#efe8fa;font-weight:700;">' + _num(tCases) + '</td><td></td>' +
          '<td style="padding:6px;text-align:center;color:#efe8fa;font-weight:700;">' + Math.round(tEarned * 10) / 10 + 'h</td>' +
          '<td style="padding:6px;text-align:center;font-weight:700;color:#c9b0f0;">' + (nEff ? Math.round(effSum / nEff) + '%' : '—') + '</td>' +
        '</tr></tbody></table></div>' +
      '</div>';
    }).join('');
  }

  var _mTab = '7d';
  window.masterTab = function (t) { _mTab = t; window.openMasterBoard(); };

  // ── The board ──
  window.openMasterBoard = function () {
    if (!_isJoe()) { if (typeof toast === 'function') toast('👑 This board is for Joe.'); return; }
    var o = document.getElementById('master-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'master-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:961;background:#120d1d;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    var sites = _sites();
    var chip = function (s) {
      var on = sites.indexOf(s) >= 0;
      return '<button onclick="masterToggleSite(\'' + s + '\')" style="padding:9px 16px;border-radius:50px;cursor:pointer;' + MONO + 'font-size:12px;font-weight:700;background:' + (on ? '#2a1d4a' : '#171222') + ';border:1.5px solid ' + (on ? '#8a6dd6' : '#3a2f55') + ';color:' + (on ? '#c9b0f0' : '#6a5a8a') + ';">' + (on ? '✓ ' : '') + s.toUpperCase() + '</button>';
    };
    o.innerHTML = '<div style="max-width:860px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="document.getElementById(\'master-overlay\').style.display=\'none\'" style="padding:11px 16px;background:#171222;border:1.5px solid #3a2f55;border-radius:50px;color:#c9b0f0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← Back</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;letter-spacing:2px;line-height:1;color:#efe8fa;">👑 MASTER BOARD</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#6a5a8a;margin-top:2px;">Only your login sees this · alerts first, always</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;">' + chip('Hegins') + chip('Danville') + '</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:12px;">' +
        ['7d', 'weekly', 'plan'].map(function (tb) {
          var on = _mTab === tb;
          return '<button onclick="masterTab(\'' + tb + '\')" style="flex:1;padding:11px;border-radius:10px;cursor:pointer;' + MONO + 'font-size:12px;font-weight:700;background:' + (on ? '#2a1d4a' : '#171222') + ';border:1.5px solid ' + (on ? '#8a6dd6' : '#3a2f55') + ';color:' + (on ? '#efe8fa' : '#6a5a8a') + ';">' +
            (tb === '7d' ? '📅 7-DAY + ALERTS' : tb === 'weekly' ? '📈 WEEKLY TRENDS' : '💰 8-HOUR PLAN') + '</button>';
        }).join('') +
      '</div>' +
      '<div id="master-body" style="' + MONO + 'font-size:12px;color:#9a8ac0;">Loading…</div>' +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}

    _fetchAll(_mTab === 'weekly' ? 63 : 14).then(function (D) {
      var body = document.getElementById('master-body'); if (!body) return;
      var sect = function (title, inner, border) {
        return '<div style="background:#191326;border:1.5px solid ' + (border || '#332a4d') + ';border-radius:12px;padding:13px 15px;margin-bottom:12px;">' +
          '<div style="' + MONO + 'font-size:10px;font-weight:700;letter-spacing:1px;color:#9a7ae0;text-transform:uppercase;margin-bottom:9px;">' + title + '</div>' + inner + '</div>';
      };

      // ── 💰 8-HOUR PLAN TAB ──
      if (_mTab === 'plan') {
        body.innerHTML =
          sect('💰 Run day vs the 8-hour plan — operational cost, no per-person tracking', _planHtml(D, sites)) +
          '<div style="' + MONO + 'font-size:9.5px;color:#4a3f66;line-height:1.7;">Span = first machine Start to last Stop that day (Daily Egg Run clocks). vs 8h = over/under the planned day — over-plan time is the waste to chase. Earned hours = cases ÷ that plant\'s target cases/hr (the hours the day SHOULD have taken at target speed). Efficiency = earned ÷ span: 100% means the day ran exactly at target pace; the gap below 100% is your recoverable time.</div>';
        return;
      }

      // ── WEEKLY TAB ──
      if (_mTab === 'weekly') {
        var alW = _alerts(D, sites).filter(function (a) { return a.sev === 'red'; });
        body.innerHTML =
          (alW.length ? sect('⚠ Still red right now', alW.map(function (a) {
            return '<div style="' + MONO + 'font-size:12px;line-height:1.5;padding:8px 10px;border-radius:8px;margin-bottom:6px;background:#2a0d0d;border:1.5px solid #7f1d1d;color:#f0a0a0;">' + a.txt + '</div>';
          }).join(''), '#7f1d1d') : '') +
          sect('📈 Week over week — cases/hour, run hours, cases, mortality, WOs', _weeklyHtml(D, sites)) +
          '<div style="' + MONO + 'font-size:9.5px;color:#4a3f66;line-height:1.6;">Weeks are rolling 7-day buckets back from today; the last bar is this week still filling. Hegins cases/hr = packer machines (real eggs per run); Danville = house belts × current farm-record eggs (no egg history stored, so Danville weekly CASES are an estimate — the rate is the number to trust). Mortality from Daily EE Checks.</div>';
        return;
      }

      // ⚠ Alerts
      var al = _alerts(D, sites);
      var alHtml = al.length ? al.map(function (a) {
        return '<div style="' + MONO + 'font-size:12px;line-height:1.5;padding:8px 10px;border-radius:8px;margin-bottom:6px;background:' + (a.sev === 'red' ? '#2a0d0d' : '#231a08') + ';border:1.5px solid ' + (a.sev === 'red' ? '#7f1d1d' : '#7a5a1a') + ';color:' + (a.sev === 'red' ? '#f0a0a0' : '#e8c96a') + ';">' + a.txt + '</div>';
      }).join('') : '<div style="' + MONO + 'font-size:12px;color:#4ade80;">✅ Nothing bad on the radar. Boards green.</div>';

      // 📦 Cases/hr per site
      var rateHtml = sites.map(function (site) {
        var wk = _dayRates(D, site, 0, 7).reverse();   // oldest→newest
        var avg = _avg(wk), prior = _avg(_dayRates(D, site, 7, 14));
        var t = _tgt(site);
        var trend = (avg != null && prior != null && prior) ? Math.round((avg - prior) / prior * 100) : null;
        var top = Math.max.apply(null, wk.map(function (d) { return d.rate || 0; }).concat([t.target || 0, 1]));
        var bars = wk.map(function (d) {
          var h = d.rate ? Math.max(6, Math.round(d.rate / top * 64)) : 3;
          var c = d.rate == null ? '#2a2340' : (t.target && d.rate >= t.target) ? '#4ade80' : (t.target && d.rate >= t.target * 0.95) ? '#e8c96a' : '#f0a0a0';
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">' +
            '<span style="' + MONO + 'font-size:9px;color:#cfc0e8;">' + (d.rate != null ? d.rate : '·') + '</span>' +
            '<div style="width:70%;height:' + h + 'px;background:' + c + ';border-radius:3px 3px 0 0;"></div>' +
            '<span style="' + MONO + 'font-size:8px;color:#6a5a8a;">' + d.date.slice(5) + '</span>' +
          '</div>';
        }).join('');
        var st = (avg == null || !t.target) ? '#6a5a8a' : avg >= t.target ? '#4ade80' : avg >= t.target * 0.95 ? '#e8c96a' : '#f0a0a0';
        return '<div style="margin-bottom:14px;">' +
          '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap;">' +
            '<b style="' + MONO + 'font-size:13px;color:#efe8fa;">' + site + '</b>' +
            '<span style="' + MONO + 'font-size:12px;color:' + st + ';font-weight:700;">wk avg ' + (avg != null ? avg : '—') + ' cases/hr</span>' +
            '<span style="' + MONO + 'font-size:10.5px;color:#9a8ac0;">🎯 ' + (t.target || '—') + ' · 🚀 6-mo ' + (t.goal6 || '—') + '</span>' +
            (trend != null ? ('<span style="' + MONO + 'font-size:10.5px;color:' + (trend >= 0 ? '#4ade80' : '#f0a0a0') + ';">' + (trend >= 0 ? '▲' : '▼') + Math.abs(trend) + '% vs last wk</span>') : '') +
          '</div>' +
          '<div style="display:flex;align-items:flex-end;gap:4px;height:92px;background:#120d1d;border-radius:8px;padding:8px 8px 4px;">' + bars + '</div>' +
        '</div>';
      }).join('');

      // 🏠 Per-unit 7d (belt runs + prod rate)
      var unitHtml = sites.map(function (site) {
        var units = (M_GROUPS[site] || null);
        if (!units) {
          units = [];
          var hs = (D.ext[site] && D.ext[site].houses) || [];
          hs.forEach(function (h) {
            var num = String(h.name || '').replace(/^\s*house\s*/i, '').trim();
            if (typeof isHouseDown === 'function' && isHouseDown(site, num)) return;
            units.push({ id: num, label: 'H' + num, houses: [num] });
          });
        }
        var extHs = {};
        ((D.ext[site] && D.ext[site].houses) || []).forEach(function (h) {
          var num = String(h.name || '').replace(/^\s*house\s*/i, '').trim();
          extHs[num] = h;
        });
        var rows = units.map(function (u) {
          var mins = [], n = 0;
          D.flows.forEach(function (f) {
            if (f.farm !== site || f.status !== 'done' || f.minutes == null) return;
            var key = f.group ? String(f.group) : String(f.house);
            if (key !== u.id) return;
            var m = Number(f.minutes) || 0; if (m <= 0 || m > 480) return;
            var age = (Date.now() - (f.startTs || 0)) / 86400000; if (age > 7) return;
            mins.push(m); n++;
          });
          var avgMin = mins.length ? Math.round(mins.reduce(function (a, b) { return a + b; }, 0) / mins.length) : null;
          var eggs = 0, birds = 0;
          u.houses.forEach(function (hh) {
            var h = extHs[hh]; if (!h) return;
            var lay = (h.lay7d != null ? h.lay7d : h.layLatest); if (lay != null && lay > 2) lay = lay / 100;
            var e = (h.eggsPerDay != null && Number(h.eggsPerDay) > 0) ? Number(h.eggsPerDay) : ((lay != null && h.birds) ? lay * h.birds : 0);
            var l = (e && h.birds) ? e / h.birds : lay;
            if (l == null || l < 0.20 || !h.birds) return;
            eggs += e; birds += Number(h.birds) || 0;
          });
          var prod = birds ? Math.round(eggs / birds * 1000) / 10 : null;
          var eph = (eggs && avgMin) ? Math.round(eggs / (avgMin / 60)) : null;
          var pc = prod == null ? '#6a5a8a' : prod >= 90 ? '#4ade80' : prod >= 85 ? '#e8c96a' : '#f0a0a0';
          return '<tr style="border-bottom:1px solid #241d3a;">' +
            '<td style="padding:7px 6px;color:#efe8fa;font-weight:700;">' + _esc(u.label) + (u.houses.length > 1 ? ' <span style="color:#6a5a8a;font-size:9px;">(' + u.houses.join('·') + ')</span>' : '') + '</td>' +
            '<td style="padding:7px 6px;text-align:center;color:#9a8ac0;">' + n + '</td>' +
            '<td style="padding:7px 6px;text-align:center;color:#cfc0e8;">' + (avgMin != null ? avgMin + ' min' : '—') + '</td>' +
            '<td style="padding:7px 6px;text-align:center;color:#cfc0e8;">' + _num(Math.round(eggs) || null) + '</td>' +
            '<td style="padding:7px 6px;text-align:center;color:#cfc0e8;">' + _num(eph) + '</td>' +
            '<td style="padding:7px 6px;text-align:center;font-weight:700;color:' + pc + ';">' + (prod != null ? prod + '%' : '—') + '</td>' +
          '</tr>';
        }).join('');
        return '<div style="' + MONO + 'font-size:11.5px;font-weight:700;color:#efe8fa;margin:4px 0 6px;">' + site + '</div>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;min-width:520px;margin-bottom:10px;">' +
          '<thead><tr style="border-bottom:1px solid #3a2f55;color:#6a5a8a;"><th style="text-align:left;padding:5px 6px;">Unit</th><th style="padding:5px 6px;">Runs 7d</th><th style="padding:5px 6px;">Avg run</th><th style="padding:5px 6px;">Eggs/day</th><th style="padding:5px 6px;">Eggs/hr</th><th style="padding:5px 6px;">Prod %</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>';
      }).join('');

      // 🔧 WOs 7d
      var farms = []; sites.forEach(function (s) { farms = farms.concat(WO_FARMS[s] || [s]); });
      var t7 = Date.now() - 7 * 86400000;
      var w7 = D.wos.filter(function (w) { return farms.indexOf(w.farm) >= 0 && (w.ts || 0) >= t7; });
      var opened = w7.length;
      var closed = D.wos.filter(function (w) { return farms.indexOf(w.farm) >= 0 && w.status === 'completed' && (_ms(w.completedTs) || w.ts || 0) >= t7; }).length;
      var openNow = D.wos.filter(function (w) { return farms.indexOf(w.farm) >= 0 && w.status !== 'completed'; });
      var reps = _repeats(D.wos, farms);
      // WO AGING BY TECH (v273): every open WO regardless of age, by assignee.
      var _tech = {};
      (D.openWos || []).forEach(function (w) {
        if (farms.indexOf(w.farm) < 0) return;
        var who = String(w.assignedTo || '').trim() || '— unassigned —';
        var g = (_tech[who] = _tech[who] || { open: 0, oldest: 0, urgent: 0 });
        g.open++;
        if (w.priority === 'urgent') g.urgent++;
        var age = Math.floor((Date.now() - (w.ts || Date.now())) / 86400000);
        if (age > g.oldest) g.oldest = age;
      });
      var _closes = {};
      D.wos.forEach(function (w) {
        if (farms.indexOf(w.farm) < 0 || w.status !== 'completed') return;
        var who = String(w.completedBy || w.assignedTo || '').trim(); if (!who) return;
        var g = (_closes[who] = _closes[who] || { n: 0, days: [] });
        g.n++;
        var ct = _ms(w.completedTs); if (ct && w.ts) g.days.push((ct - w.ts) / 86400000);
      });
      var _names = {}; Object.keys(_tech).forEach(function (k) { _names[k] = 1; }); Object.keys(_closes).forEach(function (k) { _names[k] = 1; });
      var agingRows = Object.keys(_names).map(function (who) {
        var o = _tech[who] || { open: 0, oldest: 0, urgent: 0 }, c = _closes[who] || { n: 0, days: [] };
        var avg = c.days.length ? Math.round(c.days.reduce(function (a, b) { return a + b; }, 0) / c.days.length * 10) / 10 : null;
        return { who: who, open: o.open, oldest: o.oldest, urgent: o.urgent, closed: c.n, avg: avg };
      }).sort(function (a, b) { return b.open - a.open || b.oldest - a.oldest; });
      var agingHtml = agingRows.length
        ? '<div style="' + MONO + 'font-size:10px;font-weight:700;letter-spacing:1px;color:#9a7ae0;text-transform:uppercase;margin-bottom:6px;">' + 'By tech — open · oldest · closed' + '</div>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;min-width:520px;">' +
          '<thead><tr style="border-bottom:1px solid #3a2f55;color:#6a5a8a;"><th style="text-align:left;padding:5px 6px;">Tech</th><th style="padding:5px 6px;">Open</th><th style="padding:5px 6px;">Oldest</th><th style="padding:5px 6px;">Urgent</th><th style="padding:5px 6px;">Closed 14d</th><th style="padding:5px 6px;">Avg days to close</th></tr></thead><tbody>' +
          agingRows.map(function (r) {
            var oc = r.oldest >= 10 ? '#f0a0a0' : r.oldest >= 5 ? '#e8c96a' : '#cfc0e8';
            return '<tr style="border-bottom:1px solid #241d3a;">' +
              '<td style="padding:6px;color:#efe8fa;font-weight:700;">' + _esc(r.who) + '</td>' +
              '<td style="padding:6px;text-align:center;color:' + (r.open ? '#e8c96a' : '#4ade80') + ';font-weight:700;">' + r.open + '</td>' +
              '<td style="padding:6px;text-align:center;color:' + oc + ';">' + (r.open ? r.oldest + 'd' : '—') + '</td>' +
              '<td style="padding:6px;text-align:center;color:' + (r.urgent ? '#f0a0a0' : '#6a5a8a') + ';">' + (r.urgent || '—') + '</td>' +
              '<td style="padding:6px;text-align:center;color:#4ade80;">' + r.closed + '</td>' +
              '<td style="padding:6px;text-align:center;color:#cfc0e8;">' + (r.avg != null ? r.avg + 'd' : '—') + '</td>' +
            '</tr>';
          }).join('') + '</tbody></table></div>'
        : '';
      var woHtml = agingHtml + '<div style="' + MONO + 'font-size:12px;color:#cfc0e8;line-height:1.9;margin-top:8px;">' +
        'Opened 7d: <b style="color:#efe8fa;">' + opened + '</b> · Closed 7d: <b style="color:#4ade80;">' + closed + '</b> · Open now: <b style="color:' + (openNow.length ? '#e8c96a' : '#4ade80') + ';">' + openNow.length + '</b>' +
        (reps.length ? ('<br>🔁 Repeat patterns (14d): ' + reps.slice(0, 5).map(function (r) { return '<b style="color:#f0a0a0;">' + _esc(r.problem) + ' ×' + r.n + '</b> (' + r.farm + (r.house ? ' H' + r.house : '') + ')'; }).join(' · ')) : '<br>🔁 No repeat patterns in 14 days. Clean.') +
        '</div>';

      body.innerHTML =
        sect('⚠ Needs your attention', alHtml, al.some(function (a) { return a.sev === 'red'; }) ? '#7f1d1d' : undefined) +
        sect('📦 Cases per hour — 7-day trend vs target', rateHtml) +
        sect('🏠 By unit — last 7 days', unitHtml) +
        sect('🔧 Work orders', woHtml) +
        '<div style="' + MONO + 'font-size:9.5px;color:#4a3f66;line-height:1.6;">Eggs from Farm Production Records (same push as Tier 1). Hegins cases/hr = packer machines; Danville = house belts. Repeat WO = same problem, same house, 2+ times in 14 days. Alerts re-check every 10 minutes; red badge on the 👑 chip = red alerts waiting.</div>';
    }).catch(function (e) {
      console.error('master board:', e);
      var b = document.getElementById('master-body'); if (b) b.innerHTML = 'Could not load.';
    });
  };
})();
