// ═══════════════════════════════════════════════════════════════════════════
// birdhealth.js — 🐔 BIRD HEALTH (v288, per Joe 2026-08-12)
//
// "Can we bring back bird health and that to track mortality" + "check high low
// for that day, check difference compared to outside" + "not for all users just
// for me" → Joe-only board, same gate as 👑 Master and 📈 Usage.
//
// THREE sources, and the board shows where they disagree:
//   • tierExternal   — the FARM RECORDS: live birds + mortality per house PER DAY
//                      (mortDays[], layDays[] — added to push_tier_firestore.py
//                      the same day this board was built; before that only a
//                      7-day total came across and no trend was possible)
//   • mortalityLog   — what the CREW entered in the Daily EE Check
//   • morningWalks   — tempHigh / tempLow / tempOut per house per day
//
// Mortality is shown as a RATE (% of the live flock), never a raw count. House 4
// at Danville has 164,870 birds and House 1 at Hegins has 86,675 — comparing
// their death counts side by side tells you nothing.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  var SITES = ['Hegins', 'Danville', 'Turbotville'];
  var HIST_DAYS = 30;

  function bhL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _bhEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _bhN(v) { return (v == null || isNaN(v)) ? '—' : Math.round(Number(v)).toLocaleString(); }
  function _bhP(v, dp) { return (v == null || isNaN(v)) ? '—' : (Math.round(Number(v) * Math.pow(10, dp == null ? 2 : dp)) / Math.pow(10, dp == null ? 2 : dp)).toFixed(dp == null ? 2 : dp); }
  function _bhMe() { try { return (typeof getDeviceUser === 'function') ? String(getDeviceUser() || '') : ''; } catch (e) { return ''; } }
  function _isJoe() {
    var n = _bhMe().toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!n) return false;
    if (n === 'joe' || n === 'joseph') return true;
    return /^jo/.test(n) && /schmidt/.test(n);
  }
  function _bhToday() { try { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function _bhDstr(o) {
    var d = new Date(_bhToday() + 'T12:00:00');
    if (isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() - o);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function _hnum(name) { var m = /(\d+)/.exec(String(name || '')); return m ? m[1] : String(name || ''); }
  function _avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }

  // ── DATA ────────────────────────────────────────────────────────────────
  var _B = null, _site = null;
  function _load() {
    var from = _bhDstr(HIST_DAYS);
    return Promise.all([
      db.collection('tierExternal').get(),
      db.collection('mortalityLog').where('date', '>=', from).get().catch(function () { return null; }),
      db.collection('morningWalks').where('date', '>=', from).get().catch(function () { return null; })
    ]).then(function (r) {
      var ext = {}, logs = [], walks = [];
      r[0].forEach(function (d) { try { ext[d.id] = JSON.parse((d.data() || {}).json || '{}'); } catch (e) {} });
      if (r[1]) r[1].forEach(function (d) { logs.push(d.data()); });
      if (r[2]) r[2].forEach(function (d) { walks.push(d.data()); });
      _B = { ext: ext, logs: logs, walks: walks };
      return _B;
    });
  }

  // ── PER-HOUSE HEALTH from the farm records ──────────────────────────────
  function _houses(site) {
    var e = _B.ext[site] || {};
    var hs = Array.isArray(e.houses) ? e.houses : [];
    return hs.map(function (h) {
      var days = Array.isArray(h.mortDays) ? h.mortDays.slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; }) : [];
      var m7 = (h.mort7d != null) ? Number(h.mort7d) : (days.length ? days.reduce(function (s, x) { return s + (Number(x.n) || 0); }, 0) : null);
      var birds = (h.birds != null) ? Number(h.birds) : null;
      // Weekly mortality as a share of the live flock — the number that actually
      // compares one house to another.
      var rate = (m7 != null && birds) ? (m7 / birds * 100) : null;
      var nums = days.map(function (x) { return Number(x.n) || 0; });
      var mean = _avg(nums);
      var last = days.length ? days[days.length - 1] : null;
      // A single day well above this house's own recent average is the early
      // warning — a rising 7-day total shows up days later.
      var spike = (last && mean && nums.length >= 4 && last.n >= mean * 1.8 && last.n >= mean + 5) ? last : null;
      var out = {
        name: h.name || '', hn: _hnum(h.name), birds: birds,
        mort7d: m7, rate: rate, days: days, nums: nums, avgDay: mean,
        lay7d: (h.lay7d != null) ? Number(h.lay7d) : null,
        layDays: Array.isArray(h.layDays) ? h.layDays : [],
        note: h.note || '', spike: spike, down: false,
        latest: last ? last.n : null, latestDate: last ? last.d : null,
        // trend: back half of the window vs front half
        trend: (function () {
          if (nums.length < 4) return null;
          var half = Math.floor(nums.length / 2);
          var a = _avg(nums.slice(0, half)), b = _avg(nums.slice(half));
          if (!a) return null;
          return (b - a) / a * 100;
        })(),
        // NO LIVE BIRDS = no flock, full stop. This used to require a note as
        // well, but Hegins H2 (a down house) carries no note in the records, so
        // it was being counted as a live house — it padded the flock size, and
        // the temperature coverage line demanded a reading from an empty barn.
        out: (h.birds == null) || Number(h.birds) <= 0
      };
      try { out.down = (typeof isHouseDown === 'function') && isHouseDown(site, out.hn); } catch (e) {}
      if (!out.note) {
        out.note = out.down ? bhL('house down', 'casa fuera de servicio')
                 : out.out  ? bhL('no flock', 'sin lote') : '';
      }
      return out;
    });
  }

  function _siteRoll(site) {
    var hs = _houses(site).filter(function (h) { return !h.out; });
    var birds = hs.reduce(function (s, h) { return s + (h.birds || 0); }, 0);
    var m7 = hs.reduce(function (s, h) { return s + (h.mort7d || 0); }, 0);
    var rates = hs.map(function (h) { return h.rate; }).filter(function (v) { return v != null; });
    return {
      houses: hs, birds: birds, mort7d: m7,
      rate: birds ? (m7 / birds * 100) : null,
      medRate: (function () { if (!rates.length) return null; var b = rates.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; })(),
      worst: hs.slice().filter(function (h) { return h.rate != null; }).sort(function (a, b) { return b.rate - a.rate; })[0] || null,
      daysSafe: (_B.ext[site] || {}).daysSafe
    };
  }

  // ── TEMPERATURE: high / low swing + difference vs outside ────────────────
  function _temps(site) {
    var t = _bhToday();
    var rows = {}, anyDay = null;
    // Prefer TODAY; if nobody has walked yet, fall back to the most recent day
    // that has readings so the board is never blank at 6am.
    var byDay = {};
    _B.walks.forEach(function (w) {
      if (!w || w.farm !== site || !w.date) return;
      if (w.tempHigh == null && w.tempLow == null && w.temp == null) return;
      (byDay[w.date] || (byDay[w.date] = [])).push(w);
    });
    var days = Object.keys(byDay).sort();
    anyDay = byDay[t] ? t : (days.length ? days[days.length - 1] : null);
    if (!anyDay) return { day: null, rows: [], outside: null, coverage: 0, expected: 0 };
    byDay[anyDay].forEach(function (w) {
      var h = String(w.house || '');
      var prev = rows[h];
      if (prev && (prev.ts || 0) > (w.ts || 0)) return;      // newest per house
      rows[h] = {
        house: h, ts: w.ts || 0, employee: w.employee || '',
        high: w.tempHigh != null ? Number(w.tempHigh) : null,
        low: w.tempLow != null ? Number(w.tempLow) : null,
        outside: w.tempOut != null ? Number(w.tempOut) : null,
        spot: w.temp != null ? Number(w.temp) : null
      };
    });
    var list = Object.keys(rows).map(function (k) { return rows[k]; })
      .sort(function (a, b) { return (parseInt(a.house, 10) || 0) - (parseInt(b.house, 10) || 0); });
    list.forEach(function (r) {
      r.swing = (r.high != null && r.low != null) ? Math.round((r.high - r.low) * 10) / 10 : null;
      r.vsOut = (r.high != null && r.outside != null) ? Math.round((r.high - r.outside) * 10) / 10 : null;
    });
    var outs = list.map(function (r) { return r.outside; }).filter(function (v) { return v != null; });
    var live = _houses(site).filter(function (h) { return !h.out; }).length;
    return {
      day: anyDay, rows: list,
      outside: outs.length ? _avg(outs) : null,
      coverage: list.filter(function (r) { return r.high != null && r.low != null; }).length,
      expected: live || list.length
    };
  }

  // ── CREW ENTRY vs FARM RECORD — where they disagree ─────────────────────
  // The crew logs mortality in the Daily EE Check; the office keys it into the
  // farm records. When those two numbers differ for the same house on the same
  // day, one of them is wrong, and mortality is the number the vet and the
  // insurance company care about. Worth Joe seeing.
  function _mismatch(site) {
    var byHouseDay = {};
    _B.logs.forEach(function (l) {
      if (!l || l.farm !== site || l.type !== 'mortality' || !l.date) return;
      var k = _hnum(l.house) + '|' + l.date;
      byHouseDay[k] = (byHouseDay[k] || 0) + (Number(l.mortCount) || 0);
    });
    var out = [];
    _houses(site).forEach(function (h) {
      (h.days || []).forEach(function (d) {
        var k = h.hn + '|' + d.d;
        var app = byHouseDay[k];
        if (app == null) return;                     // crew logged nothing that day
        var rec = Number(d.n) || 0;
        if (Math.abs(app - rec) >= 5 && Math.abs(app - rec) / Math.max(rec, 1) >= 0.2) {
          out.push({ house: h.hn, date: d.d, app: app, rec: rec, diff: app - rec });
        }
        delete byHouseDay[k];
      });
    });
    // Crew logged a day the records never picked up at all
    Object.keys(byHouseDay).forEach(function (k) {
      var p = k.split('|');
      if (p[1] < _bhDstr(7)) return;                 // only the current window
      out.push({ house: p[0], date: p[1], app: byHouseDay[k], rec: null, diff: byHouseDay[k] });
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 12);
  }

  // ── RENDER ──────────────────────────────────────────────────────────────
  function _ov() {
    var o = document.getElementById('bh-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'bh-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:963;background:#140f0a;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeBirdHealth = function () { var o = document.getElementById('bh-overlay'); if (o) o.style.display = 'none'; };
  window.bhSite = function (s) { _site = s; window.openBirdHealth(); };

  function _dot(c) { return '<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:' + c + ';box-shadow:0 0 8px ' + c + ';"></span>'; }
  function _sec(t) { return '<div style="' + MONO + 'font-size:11px;letter-spacing:1.5px;color:#c99a5a;text-transform:uppercase;margin:20px 2px 8px;font-weight:700;">' + t + '</div>'; }
  function _box(inner, border) { return '<div style="background:#1c150e;border:1.5px solid ' + (border || '#3a2a18') + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;">' + inner + '</div>'; }

  // Tiny inline bar chart of the daily counts — no library, no canvas.
  function _spark(nums, w, h) {
    if (!nums || !nums.length) return '';
    w = w || 92; h = h || 22;
    var max = Math.max.apply(null, nums) || 1;
    var bw = Math.max(2, Math.floor(w / nums.length) - 1);
    var bars = nums.map(function (n, i) {
      var bh = Math.max(1, Math.round((n / max) * h));
      var col = (n >= max && nums.length > 2) ? '#f87171' : '#c99a5a';
      return '<rect x="' + (i * (bw + 1)) + '" y="' + (h - bh) + '" width="' + bw + '" height="' + bh + '" fill="' + col + '" rx="1"/>';
    }).join('');
    return '<svg width="' + (nums.length * (bw + 1)) + '" height="' + h + '" style="vertical-align:middle;">' + bars + '</svg>';
  }

  window.openBirdHealth = function () {
    if (!_isJoe()) { if (typeof toast === 'function') toast(bhL('🐔 This board is for Joe.', '🐔 Este tablero es para Joe.')); return; }
    try { if (typeof trackUse === 'function') trackUse('birdHealth'); } catch (e) {}
    var o = _ov();
    o.innerHTML = '<div style="max-width:900px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeBirdHealth()" style="padding:11px 16px;background:#1c150e;border:1.5px solid #5a4225;border-radius:50px;color:#e8c98a;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + bhL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:27px;letter-spacing:2px;line-height:1;color:#f5ecdc;">🐔 ' + bhL('BIRD HEALTH', 'SALUD DE AVES') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#8a6a45;margin-top:2px;">' + bhL('Only your login sees this · mortality as % of flock', 'Solo tu cuenta ve esto') + '</div>' +
        '</div>' +
      '</div>' +
      '<div id="bh-body" style="' + MONO + 'font-size:12px;color:#b09a75;">' + bhL('Loading flock records…', 'Cargando…') + '</div>' +
    '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}

    _load().then(function () {
      var body = document.getElementById('bh-body'); if (!body) return;
      var avail = SITES.filter(function (s) { return _B.ext[s] && Array.isArray(_B.ext[s].houses) && _B.ext[s].houses.length; });
      if (!avail.length) { body.innerHTML = bhL('No flock records have come across yet.', 'Aún no llegan registros.'); return; }
      if (!_site || avail.indexOf(_site) === -1) _site = avail[0];

      var html = '';
      // site chips
      html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
        avail.map(function (s) {
          var on = s === _site;
          return '<button onclick="bhSite(\'' + s + '\')" style="flex:1;min-width:100px;padding:11px 12px;border-radius:50px;cursor:pointer;' + MONO +
            'font-size:12px;font-weight:700;background:' + (on ? '#3a2a12' : '#171208') + ';border:1.5px solid ' + (on ? '#e8c98a' : '#3a2a18') +
            ';color:' + (on ? '#f5ecdc' : '#8a6a45') + ';">' + (on ? '✓ ' : '') + s.toUpperCase() + '</button>';
        }).join('') + '</div>';

      var R = _siteRoll(_site);

      // ── FLOCK SUMMARY ──
      var rateCol = R.rate == null ? '#8a6a45' : R.rate >= 0.35 ? '#f87171' : R.rate >= 0.20 ? '#f0a35a' : '#4ade80';
      html += _sec('🐔 ' + bhL(_site + ' flock · last 7 days', _site + ' · últimos 7 días'));
      html += _box(
        '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;">' +
          '<div><div style="' + MONO + 'font-size:10px;color:#8a6a45;">' + bhL('LIVE BIRDS', 'AVES VIVAS') + '</div>' +
            '<div style="' + MONO + 'font-size:22px;font-weight:700;color:#f5ecdc;">' + _bhN(R.birds) + '</div></div>' +
          '<div><div style="' + MONO + 'font-size:10px;color:#8a6a45;">' + bhL('DEATHS 7d', 'MUERTES 7d') + '</div>' +
            '<div style="' + MONO + 'font-size:22px;font-weight:700;color:#e8c98a;">' + _bhN(R.mort7d) + '</div></div>' +
          '<div><div style="' + MONO + 'font-size:10px;color:#8a6a45;">' + bhL('WEEKLY RATE', 'TASA SEMANAL') + '</div>' +
            '<div style="' + MONO + 'font-size:22px;font-weight:700;color:' + rateCol + ';">' + _bhP(R.rate) + '%</div></div>' +
          '<div><div style="' + MONO + 'font-size:10px;color:#8a6a45;">' + bhL('PER DAY', 'POR DÍA') + '</div>' +
            '<div style="' + MONO + 'font-size:22px;font-weight:700;color:#f5ecdc;">' + _bhN(R.mort7d / 7) + '</div></div>' +
          (R.daysSafe != null ? ('<div><div style="' + MONO + 'font-size:10px;color:#8a6a45;">' + bhL('DAYS SAFE', 'DÍAS SEGUROS') + '</div>' +
            '<div style="' + MONO + 'font-size:22px;font-weight:700;color:#4ade80;">' + R.daysSafe + '</div></div>') : '') +
        '</div>' +
        (R.worst && R.worst.rate != null
          ? ('<div style="' + MONO + 'font-size:11px;color:#c9a97a;margin-top:10px;padding-top:9px;border-top:1px dashed #3a2a18;">' +
              bhL('Highest rate: ', 'Tasa más alta: ') + '<b style="color:#f5ecdc;">' + _bhEsc(R.worst.name) + '</b> ' +
              bhL('at ', 'con ') + '<b style="color:#f87171;">' + _bhP(R.worst.rate) + '%</b>' +
              (R.medRate ? (' · ' + bhL('site median ', 'mediana ') + _bhP(R.medRate) + '%') : '') + '</div>')
          : ''), R.rate != null && R.rate >= 0.35 ? '#7f1d1d' : undefined);

      // ── PER-HOUSE TABLE ──
      html += _sec('📍 ' + bhL('By house · rate, trend, and today', 'Por casa · tasa, tendencia y hoy'));
      html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;min-width:640px;">' +
        '<thead><tr style="border-bottom:1px solid #3a2a18;color:#8a6a45;">' +
          '<th style="text-align:left;padding:6px;">' + bhL('House', 'Casa') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + bhL('Birds', 'Aves') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + bhL('7d', '7d') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + bhL('Rate %', 'Tasa %') + '</th>' +
          '<th style="text-align:center;padding:6px;">' + bhL('Daily', 'Diario') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + bhL('Trend', 'Tend.') + '</th>' +
          '<th style="text-align:right;padding:6px;">' + bhL('Lay %', 'Postura') + '</th>' +
        '</tr></thead><tbody>';
      _houses(_site).forEach(function (h) {
        if (h.out) {
          html += '<tr style="border-bottom:1px solid #241a10;opacity:.6;">' +
            '<td style="padding:6px;color:#c9a97a;font-weight:700;">' + _bhEsc(h.name) + '</td>' +
            '<td colspan="6" style="padding:6px;color:#8a6a45;">' + _bhEsc(h.note || bhL('no flock', 'sin lote')) + '</td></tr>';
          return;
        }
        // Out of line with its own site? Compare to the site median, not a fixed number.
        var hot = (h.rate != null && R.medRate && h.rate >= R.medRate * 1.6 && h.rate >= 0.15);
        var rc = h.rate == null ? '#8a6a45' : hot ? '#f87171' : h.rate >= 0.20 ? '#f0a35a' : '#4ade80';
        var tc = h.trend == null ? '#8a6a45' : h.trend > 25 ? '#f87171' : h.trend < -25 ? '#4ade80' : '#c9a97a';
        html += '<tr style="border-bottom:1px solid #241a10;">' +
          '<td style="padding:6px;color:#f5ecdc;font-weight:700;">' + _bhEsc(h.name) +
            (h.spike ? '<div style="' + MONO + 'font-size:9px;color:#f87171;font-weight:700;">⚠ ' + bhL('spike ', 'pico ') + _bhN(h.spike.n) + ' ' + h.spike.d.slice(5) + '</div>' : '') + '</td>' +
          '<td style="padding:6px;text-align:right;color:#c9a97a;">' + _bhN(h.birds) + '</td>' +
          '<td style="padding:6px;text-align:right;color:#e8c98a;font-weight:700;">' + _bhN(h.mort7d) + '</td>' +
          '<td style="padding:6px;text-align:right;color:' + rc + ';font-weight:700;">' + _bhP(h.rate) + (hot ? ' ⚠' : '') + '</td>' +
          '<td style="padding:6px;text-align:center;">' + _spark(h.nums) + '</td>' +
          '<td style="padding:6px;text-align:right;color:' + tc + ';font-weight:700;">' + (h.trend == null ? '—' : ((h.trend > 0 ? '▲' : h.trend < 0 ? '▼' : '') + Math.abs(Math.round(h.trend)) + '%')) + '</td>' +
          '<td style="padding:6px;text-align:right;color:#c9a97a;">' + (h.lay7d != null ? _bhP(h.lay7d * 100, 1) : '—') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>' +
        '<div style="' + MONO + 'font-size:9.5px;color:#6a5335;margin-top:6px;line-height:1.6;">' +
          bhL('Rate = deaths in the last 7 days ÷ live birds. ⚠ marks a house running 1.6× its own site median. Trend compares the back half of the window to the front half. Spike = one day at least 1.8× that house\'s own recent average.',
              'Tasa = muertes de 7 días ÷ aves vivas. ⚠ = 1.6× la mediana del sitio.') + '</div>';

      // ── TEMPERATURE ──
      var T = _temps(_site);
      html += _sec('🌡 ' + bhL('Temperature · high, low, and against outside', 'Temperatura · alta, baja y vs exterior'));
      if (!T.day) {
        html += _box('<div style="' + MONO + 'font-size:12px;color:#c9a97a;">' +
          bhL('No temperature readings yet. The high / low / outside boxes are on the Morning Walk — once the crew fills them this fills in.',
              'Sin lecturas. Las casillas alta / baja / exterior están en la Caminata Matutina.') + '</div>');
      } else {
        var stale = T.day !== _bhToday();
        html += _box(
          '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px;">' +
            '<b style="' + MONO + 'font-size:12.5px;color:#f5ecdc;">' + T.day + (stale ? (' <span style="color:#f0a35a;font-weight:400;">· ' + bhL('last day with readings', 'último día con lecturas') + '</span>') : '') + '</b>' +
            (T.outside != null ? ('<span style="' + MONO + 'font-size:12px;color:#9ad6a0;">' + bhL('outside ', 'exterior ') + '<b>' + _bhP(T.outside, 0) + '°F</b></span>') : '') +
            '<span style="' + MONO + 'font-size:11px;color:' + (T.coverage >= T.expected ? '#4ade80' : T.coverage === 0 ? '#f87171' : '#f0a35a') + ';">' +
              T.coverage + '/' + T.expected + ' ' + bhL('houses reported high+low', 'casas con alta+baja') + '</span>' +
          '</div>' +
          '<table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:11.5px;"><thead>' +
            '<tr style="border-bottom:1px solid #3a2a18;color:#8a6a45;">' +
              '<th style="text-align:left;padding:5px;">' + bhL('House', 'Casa') + '</th>' +
              '<th style="text-align:right;padding:5px;">' + bhL('High', 'Alta') + '</th>' +
              '<th style="text-align:right;padding:5px;">' + bhL('Low', 'Baja') + '</th>' +
              '<th style="text-align:right;padding:5px;">' + bhL('Swing', 'Variación') + '</th>' +
              '<th style="text-align:right;padding:5px;">' + bhL('vs outside', 'vs exterior') + '</th>' +
            '</tr></thead><tbody>' +
          T.rows.map(function (r) {
            var sc = r.swing == null ? '#8a6a45' : r.swing >= 15 ? '#f87171' : r.swing >= 10 ? '#f0a35a' : '#4ade80';
            var vc = r.vsOut == null ? '#8a6a45' : r.vsOut >= 15 ? '#f87171' : r.vsOut >= 10 ? '#f0a35a' : '#9ad6a0';
            return '<tr style="border-bottom:1px solid #241a10;">' +
              '<td style="padding:5px;color:#f5ecdc;font-weight:700;">' + _bhEsc(r.house) + '</td>' +
              '<td style="padding:5px;text-align:right;color:#f0a35a;">' + (r.high != null ? _bhP(r.high, 0) + '°' : (r.spot != null ? '<span style="color:#6a5335;">' + _bhP(r.spot, 0) + '°*</span>' : '—')) + '</td>' +
              '<td style="padding:5px;text-align:right;color:#7ab8f0;">' + (r.low != null ? _bhP(r.low, 0) + '°' : '—') + '</td>' +
              '<td style="padding:5px;text-align:right;color:' + sc + ';font-weight:700;">' + (r.swing != null ? r.swing + '°' : '—') + '</td>' +
              '<td style="padding:5px;text-align:right;color:' + vc + ';font-weight:700;">' + (r.vsOut != null ? ((r.vsOut >= 0 ? '+' : '') + r.vsOut + '°') : '—') + '</td>' +
            '</tr>';
          }).join('') + '</tbody></table>' +
          '<div style="' + MONO + 'font-size:9.5px;color:#6a5335;margin-top:7px;line-height:1.6;">' +
            bhL('Swing = high − low for that day: over 10° is worth a look, over 15° means the controller is chasing itself. vs outside = how far above the outdoor temp the house sat at its hottest; a big gap means the house is not shedding heat. * = only the old single spot reading was entered, no high/low.',
                'Variación = alta − baja; más de 15° = el control va persiguiendo. vs exterior = qué tan arriba quedó la casa. * = solo lectura puntual.') + '</div>');
      }

      // ── CREW vs RECORDS ──
      var MM = _mismatch(_site);
      html += _sec('🔎 ' + bhL('Crew entry vs farm record', 'Entrada del equipo vs registro'));
      if (!MM.length) {
        html += _box('<div style="' + MONO + 'font-size:12px;color:#4ade80;">✅ ' +
          bhL('Every day the crew logged matches the farm record.', 'Todo coincide.') + '</div>');
      } else {
        html += _box(
          MM.map(function (m) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;' + MONO + 'font-size:12px;flex-wrap:wrap;">' +
              '<b style="color:#f5ecdc;min-width:60px;">H' + _bhEsc(m.house) + '</b>' +
              '<span style="color:#c9a97a;min-width:60px;">' + m.date.slice(5) + '</span>' +
              '<span style="color:#9cc0f6;">' + bhL('app ', 'app ') + '<b>' + _bhN(m.app) + '</b></span>' +
              '<span style="color:#8a6a45;">vs</span>' +
              '<span style="color:#e8c98a;">' + bhL('record ', 'registro ') + '<b>' + (m.rec == null ? bhL('nothing', 'nada') : _bhN(m.rec)) + '</b></span>' +
              '<b style="color:' + (m.diff > 0 ? '#f87171' : '#f0a35a') + ';">' + (m.diff > 0 ? '+' : '') + _bhN(m.diff) + '</b>' +
            '</div>';
          }).join('') +
          '<div style="' + MONO + 'font-size:10px;color:#c9a97a;margin-top:8px;padding-top:8px;border-top:1px dashed #3a2a18;line-height:1.6;">' +
            bhL('One of these two numbers is wrong. Mortality is the figure the vet, the flock supervisor and the insurer all work from, so it is worth knowing which. Shown only when the gap is 5+ birds AND 20%+.',
                'Uno de los dos números está mal. Se muestra solo si la diferencia es 5+ aves y 20%+.') + '</div>', '#5a4a1a');
      }

      // ── LOOSE BIRDS ──
      var loose = _B.logs.filter(function (l) { return l && l.farm === _site && l.type === 'loose'; })
        .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 8);
      if (loose.length) {
        html += _sec('🕊 ' + bhL('Loose birds reported', 'Aves sueltas'));
        html += _box(loose.map(function (l) {
          return '<div style="' + MONO + 'font-size:11.5px;color:#c9a97a;padding:3px 0;">' +
            '<b style="color:#f5ecdc;">H' + _bhEsc(_hnum(l.house)) + '</b> · ' + _bhEsc(l.date || '') +
            ' · <b style="color:#e8c98a;">' + _bhN(l.looseCount) + '</b> ' + bhL('birds', 'aves') +
            (l.employee ? (' · ' + _bhEsc(l.employee)) : '') + '</div>';
        }).join(''));
      }

      html += '<div style="' + MONO + 'font-size:9.5px;color:#5a4630;margin-top:14px;line-height:1.7;">' +
        bhL('Where this comes from: live birds and daily mortality are the FARM RECORDS pushed nightly from the Command Center (tierExternal). The crew\'s own entries come from the Daily EE Check. Temperatures come from the Morning Walk. Nothing on this board is typed twice.',
            'Fuente: aves vivas y mortalidad diaria de los registros de granja; entradas del equipo del Chequeo Diario; temperaturas de la Caminata Matutina.') + '</div>';

      body.innerHTML = html;
    }).catch(function (e) {
      console.error('birdhealth:', e);
      var b = document.getElementById('bh-body'); if (b) b.innerHTML = bhL('Could not load.', 'No se pudo cargar.');
    });
  };

  // ── 🐔 chip (Joe only), sits above the 👑 Master chip ────────────────────
  function _chip() {
    try {
      var ex = document.getElementById('bh-chip');
      if (!_isJoe()) { if (ex) ex.remove(); return; }
      if (ex) return;
      var b = document.createElement('button');
      b.id = 'bh-chip';
      b.onclick = function () { window.openBirdHealth(); };
      b.style.cssText = 'position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 172px);z-index:940;background:#1c150e;border:1.5px solid #c99a5a;border-radius:50px;color:#e8c98a;' + MONO + 'font-size:12px;font-weight:700;padding:9px 14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.45);';
      b.textContent = '🐔 Bird Health';
      document.body.appendChild(b);
    } catch (e) {}
  }
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(_chip, 1200); });
    else setTimeout(_chip, 1200);
    setInterval(_chip, 5000);       // sign-in happens after boot; re-check
  } catch (e) {}
})();
