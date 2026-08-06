// ═══════════════════════════════════════════════════════════════════════════
// egg-flow.js — EGG FLOW / SETTING TRACKER (EN/ES)  [Front-End Flow Protector]
// Per house: the SPEED/SETTING we ran the egg belts at + HOW LONG the run took.
// Same setup as Manure Runs: tap ▶ Start (stamps time + saves the speed), tap
// ⏹ Stop (computes minutes). Live via onSnapshot — the table + running timers
// update on every tablet while a run is going. User-friendly big buttons.
//
// Data: collection eggFlow = {farm, house, speed, startTs, stopTs, minutes,
//        status:'open'|'done', date, by, ts}
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  function efL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _today() { return (typeof LDATE === 'function') ? LDATE() : new Date().toISOString().slice(0, 10); }
  function _by() { try { return (typeof getDeviceUser === 'function' && getDeviceUser()) || ''; } catch (e) { return ''; } }

  var _efUnsub = null;
  var _efData = [];          // last-30-day eggFlow docs
  var _efWalks = [];         // last-30-day barnWalks (for eggsCollected per house)
  var _efWalkUnsub = null;
  var _efExt = {};           // tierExternal by farm → eggs per house from the farm records
  var _efExtUnsub = null;
  var _efTick = null;        // 20s live-duration repaint
  var _efDirty = {};         // farm_house → dirty-line ON toggled before a run starts
  var _EF_STUCK_MIN = 8 * 60;   // a "run" longer than 8h = someone forgot to tap Stop
  function _num(n) { try { return Number(n || 0).toLocaleString(); } catch (e) { return String(n || 0); } }
  // 1 case = 30 dozen = 360 eggs (Joe 2026-07-28)
  var EGGS_PER_DZ = 12, DZ_PER_CASE = 30, EGGS_PER_CASE = EGGS_PER_DZ * DZ_PER_CASE;
  function _dz(eggs) { return eggs ? Math.round(eggs / EGGS_PER_DZ) : null; }
  function _cases(eggs) { return eggs ? Math.round(eggs / EGGS_PER_CASE * 10) / 10 : null; }

  function _efSite() {
    try { var p = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null; if (p === 'Hegins' || p === 'Danville') return p; } catch (e) {}
    return 'Danville';
  }
  function _efHouses(farm) {
    var out = [];
    try {
      var arr = (typeof FARM_HOUSES !== 'undefined' && FARM_HOUSES[farm]) ? FARM_HOUSES[farm] : [];
      arr.forEach(function (h) {
        var num = String(h).replace(/^\s*house\s*/i, '').trim();
        if (!(typeof isHouseDown === 'function' && isHouseDown(farm, num))) out.push(num);
      });
    } catch (e) {}
    return out;
  }

  // ── HOW EACH SITE RUNS (Joe 2026-07-28) ───────────────────────────────────
  // Hegins runs its egg belts in GROUPS of houses — one Start/Stop covers the
  // whole group. Danville runs house by house. So the unit of work here is a
  // "run unit": either a single house (Danville) or a group (Hegins).
  var EF_GROUPS = {
    Hegins: [
      { id: 'G1', label: 'Group 1', houses: ['1', '3', '4'] },
      { id: 'G2', label: 'Group 2', houses: ['5', '6', '7', '8'] }
    ]
  };
  function _efUnits(farm) {
    var live = _efHouses(farm);                       // active (down houses removed)
    var groups = EF_GROUPS[farm];
    if (groups) {
      return groups.map(function (g) {
        var hs = g.houses.filter(function (h) { return live.indexOf(h) !== -1; });
        return { key: g.id, label: g.label, houses: hs, isGroup: true };
      }).filter(function (g) { return g.houses.length; });
    }
    return live.map(function (h) { return { key: h, label: efL('House', 'Casa') + ' ' + h, houses: [h], isGroup: false }; });
  }
  // A run doc's identity: group id for Hegins, house number for Danville.
  function _efRunKey(r) { return r.group ? String(r.group) : String(r.house); }
  function _openRun(farm, unitKey) {
    return _efData.filter(function (r) { return r.farm === farm && _efRunKey(r) === String(unitKey) && r.status === 'open'; })
      .sort(function (a, b) { return (b.startTs || 0) - (a.startTs || 0); })[0] || null;
  }
  function _dur(ms) {
    if (ms == null) return '—';
    var m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return m + 'm';
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }
  function _timeLbl(ts) { try { return ts ? new Date(ts).toLocaleTimeString(_lang === 'es' ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : ''; } catch (e) { return ''; } }

  // ── House cards (start/stop + speed) ──
  function _houseCard(farm, unit) {
    var house = unit.key;              // group id (Hegins) or house number (Danville)
    var run = _openRun(farm, unit.key);
    var running = !!run;
    var elapsed = running ? _dur(Date.now() - (run.startTs || Date.now())) : '';
    var speedVal = running ? (run.speed != null ? _esc(run.speed) : '') : '';
    var idb = (farm + '_' + house).replace(/[^a-zA-Z0-9]/g, '_');
    var dirtyOn = running ? !!run.dirtyLine : !!_efDirty[farm + '_' + house];
    var dirtyBtn = '<button onclick="efToggleDirty(\'' + _esc(farm) + '\',\'' + _esc(house) + '\')" style="flex:0 0 auto;padding:7px 11px;border-radius:8px;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;background:' + (dirtyOn ? '#3a2f0a' : '#0c150c') + ';border:1.5px solid ' + (dirtyOn ? '#d6b34a' : '#2a4a2a') + ';color:' + (dirtyOn ? '#f0d68a' : '#6a8a6a') + ';">🥚 ' + efL('Dirty line', 'Línea sucia') + ': ' + (dirtyOn ? efL('ON', 'SÍ') : efL('OFF', 'NO')) + '</button>';
    return '<div style="background:' + (running ? '#101f10' : '#0c150c') + ';border:1.5px solid ' + (running ? '#4ade80' : '#1e3a1e') + ';border-radius:12px;padding:12px 13px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="' + MONO + 'font-size:15px;font-weight:700;color:#f0ead8;">' + _esc(unit.label) +
          (unit.isGroup ? '<span style="font-size:10px;color:#9cc0f6;font-weight:400;"> · ' + efL('Houses', 'Casas') + ' ' + unit.houses.join(' · ') + '</span>' : '') +
        '</span>' +
        (running
          ? '<span style="' + MONO + 'font-size:11px;color:#4ade80;">● ' + efL('running', 'corriendo') + ' ' + elapsed + '</span>'
          : '<span style="' + MONO + 'font-size:11px;color:#5a7a5a;">' + efL('not running', 'sin correr') + '</span>') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:9px;">' +
        '<label style="' + MONO + 'font-size:10px;color:#7a9a7a;flex:0 0 auto;">' + efL('Speed', 'Velocidad') + '</label>' +
        '<input id="ef-speed-' + idb + '" type="number" inputmode="decimal" step="0.1" value="' + speedVal + '" placeholder="—" ' +
          (running ? 'onchange="efSetSpeed(\'' + _esc(run._id) + '\',this.value)"' : '') +
          ' style="flex:0 0 72px;padding:9px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;' + MONO + 'font-size:15px;font-weight:700;text-align:center;">' +
        dirtyBtn +
        (running
          ? '<button onclick="efStop(\'' + _esc(run._id) + '\')" style="flex:1;padding:11px;border-radius:9px;background:#3a1414;border:1.5px solid #e5533c;color:#ffb4a6;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">⏹ ' + efL('Stop', 'Detener') + '</button>'
          : '<button onclick="efStart(\'' + _esc(farm) + '\',\'' + _esc(house) + '\')" style="flex:1;padding:11px;border-radius:9px;background:#14361c;border:1.5px solid #4ade80;color:#4ade80;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">▶ ' + efL('Start', 'Iniciar') + '</button>') +
      '</div>' +
    '</div>';
  }

  function _drawLog(host, site) {
    // Site-scope + last 30 days; newest first.
    var list = _efData.filter(function (r) { return site === 'All' || r.farm === site; })
      .slice().sort(function (a, b) { return (b.startTs || b.ts || 0) - (a.startTs || a.ts || 0); });
    var rows = list.map(function (r) {
      var dur = r.status === 'open'
        ? '<span style="color:#4ade80;">● ' + _dur(Date.now() - (r.startTs || Date.now())) + '</span>'
        : (r.minutes != null ? _dur(r.minutes * 60000) : '—');
      var dateLbl = r.date ? r.date.slice(5).replace('-', '/') : '—';
      var dirty = r.dirtyLine ? '<span style="color:#f0d68a;">🥚 ' + efL('ON', 'SÍ') + '</span>' : '<span style="color:#4a6a4a;">—</span>';
      return '<tr style="border-bottom:1px solid #1a2a1a;">' +
        '<td style="padding:8px 6px;color:#f0ead8;">' + dateLbl + '</td>' +
        '<td style="padding:8px 6px;color:#aaa;">' + (r.groupLabel ? (_esc(r.groupLabel) + '<span style="color:#5a7a7a;font-size:9px;"> ' + _esc((r.houses||[]).join('·')) + '</span>') : ('H' + _esc(r.house))) + '</td>' +
        '<td style="padding:8px 6px;color:#e8d36a;font-weight:700;text-align:center;">' + (r.speed != null && r.speed !== '' ? _esc(r.speed) : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;">' + dirty + '</td>' +
        '<td style="padding:8px 6px;color:#9ad6a0;">' + dur + '</td>' +
        '<td style="padding:8px 6px;color:#7ab07a;">' + _timeLbl(r.startTs) + (r.by ? ' · ' + _esc(r.by) : '') + '</td>' +
        // ✎/🗑 — crew feedback 2026-08-06 ("Tiff entered house 5 as house 1 and we
        // couldn't fix it"). Edit = move the run to the right house/group;
        // delete = confirm first. Both stamp who did it.
        '<td style="padding:8px 6px;text-align:right;white-space:nowrap;">' +
          '<button onclick="efEditRun(\'' + _esc(r._id) + '\')" title="' + efL('Fix house', 'Corregir casa') + '" style="padding:6px 9px;background:#0d1f3a;border:1px solid #2a4a7a;border-radius:7px;color:#9cc0f6;cursor:pointer;font-size:11px;">✎</button> ' +
          '<button onclick="efDeleteRun(\'' + _esc(r._id) + '\')" title="' + efL('Delete run', 'Borrar corrida') + '" style="padding:6px 9px;background:#1a0505;border:1px solid #5a1d1d;border-radius:7px;color:#e08a8a;cursor:pointer;font-size:11px;">🗑</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="7" style="padding:18px;text-align:center;color:#888;">' + efL('No runs logged yet.', 'Sin corridas registradas.') + '</td></tr>';
    return '<div style="' + MONO + 'font-size:10px;color:#4a6a4a;margin:14px 0 6px;">' + efL('speed = the setting you ran · dirty = dirty line on · duration = how long the belts ran', 'velocidad = el ajuste · sucia = línea sucia encendida · duración = cuánto corrieron') + '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;min-width:460px;">' +
      '<thead><tr style="border-bottom:1px solid #2a4a2a;">' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + efL('Date', 'Fecha') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + efL('House', 'Casa') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + efL('Speed', 'Velocidad') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:center;">' + efL('Dirty line', 'Línea sucia') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + efL('Duration', 'Duración') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:left;">' + efL('Started', 'Inició') + '</th>' +
        '<th style="padding:8px 6px;color:#5a8a5a;text-align:right;">' + efL('Fix', 'Corregir') + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // ── Fix a mis-entered run: move it to the right house/group, or delete it ──
  window.efEditRun = function (id) {
    var r = _efData.find(function (x) { return x._id === id; });
    if (!r || typeof db === 'undefined' || !db) return;
    var site = r.farm;
    var units = _efUnits(site);
    var opts = units.map(function (u) { return u.isGroup ? (u.label + ' (' + u.houses.join('·') + ')') : ('H' + u.key); }).join(', ');
    var ask = efL('Move this run to which house/group? Options: ', '¿A qué casa/grupo mover esta corrida? Opciones: ') + opts;
    var go = function (val) {
      if (!val) return;
      var v = String(val).trim().toLowerCase().replace(/^h/, '').replace(/^group\s*/, 'g').replace(/^grupo\s*/, 'g');
      var unit = units.find(function (u) {
        return String(u.key).toLowerCase() === v || String(u.label || '').toLowerCase().indexOf(v) === 0 || (!u.isGroup && String(u.key) === v);
      });
      if (!unit) { if (typeof toast === 'function') toast(efL('No house/group called ', 'No existe ') + val); return; }
      var patch = unit.isGroup
        ? { group: unit.id, groupLabel: unit.label, houses: unit.houses, house: null, editedBy: (typeof getDeviceUser === 'function' ? getDeviceUser() : ''), editedTs: Date.now() }
        : { house: String(unit.key), group: null, groupLabel: null, houses: null, editedBy: (typeof getDeviceUser === 'function' ? getDeviceUser() : ''), editedTs: Date.now() };
      db.collection('eggFlow').doc(id).set(patch, { merge: true }).then(function () {
        if (typeof toast === 'function') toast('✎ ' + efL('Run moved to ', 'Corrida movida a ') + (unit.label || 'H' + unit.key));
      }).catch(function () { if (typeof toast === 'function') toast(efL('Could not save', 'No se pudo guardar')); });
    };
    if (typeof promptInline === 'function') promptInline(ask, go);
    else { var v = window.prompt(ask); go(v); }
  };
  window.efDeleteRun = function (id) {
    var r = _efData.find(function (x) { return x._id === id; });
    if (!r || typeof db === 'undefined' || !db) return;
    var lbl = (r.groupLabel || ('H' + r.house)) + ' · ' + (r.date || '');
    var doIt = function () {
      db.collection('eggFlow').doc(id).delete().then(function () {
        if (typeof toast === 'function') toast('🗑 ' + efL('Run deleted', 'Corrida borrada') + ' — ' + lbl);
      }).catch(function () { if (typeof toast === 'function') toast(efL('Could not delete', 'No se pudo borrar')); });
    };
    if (typeof confirmInline === 'function') confirmInline(efL('Delete this run? ', '¿Borrar esta corrida? ') + lbl, doIt);
    else if (window.confirm('Delete run ' + lbl + '?')) doIt();
  };

  // ── PER-HOUSE ROLLUP + TRENDING TARGETS ───────────────────────────────────
  // For each house: how many runs, total + average run time, average speed, the
  // eggs collected (from the Daily EE Check), and EGGS PER HOUR. The TARGET for
  // each house is its OWN trailing average (last 14 days) — so every barn trends
  // against its own proven pace instead of one number forced on every house.
  // Runs left open >8h are excluded from averages (forgot to tap Stop) and shown
  // as a data-fix warning.
  // Eggs per house per day from the FARM RECORDS (tierExternal, pushed daily from
  // the Command Center): eggs/day = lay% × live birds. Used when the crew hasn't
  // typed "eggs collected" on the Daily EE Check, so eggs/hour always has data.
  function _efFarmEggs(site) {
    var map = {};
    try {
      var d = (_efExt || {})[site];
      if (!d || !Array.isArray(d.houses)) return map;
      d.houses.forEach(function (h) {
        var num = String(h.name || '').replace(/^\s*house\s*/i, '').trim();
        // 1st choice: real counted eggs from the Farm Production Records
        // (pushed by push_house_eggs.py — the same files Tier 1 is built from).
        if (h.eggsPerDay != null && Number(h.eggsPerDay) > 0) { map[num] = Math.round(Number(h.eggsPerDay)); return; }
        // Fallback: lay % × live birds (mathematically the same thing).
        var lay = (h.lay7d != null ? h.lay7d : h.layLatest);
        if (lay == null || !h.birds) return;
        if (lay > 2) lay = lay / 100;                       // sheets store fractions
        map[num] = Math.round(lay * h.birds);
      });
    } catch (e) {}
    return map;
  }

  // TRUE per-house KPI (Joe 2026-08-03): PRODUCTION RATE = lay % (eggs/day ÷ live
  // birds) per run unit, from the same tierExternal farm-record push that feeds
  // Tier 1. Molt/out houses (lay < 20%) are skipped so a flock-out can't drag a
  // group's number the way Hegins H7 once did.
  function _efProdRate(site, units) {
    var out = {};
    try {
      var d = (_efExt || {})[site];
      var hs = (d && Array.isArray(d.houses)) ? d.houses : [];
      var info = {};   // house num → { eggs/day, birds }
      hs.forEach(function (h) {
        var num = String(h.name || '').replace(/^\s*house\s*/i, '').trim();
        var birds = Number(h.birds) || 0;
        var lay = (h.lay7d != null ? h.lay7d : h.layLatest);
        if (lay != null && lay > 2) lay = lay / 100;          // sheets store fractions
        var eggs = (h.eggsPerDay != null && Number(h.eggsPerDay) > 0) ? Number(h.eggsPerDay)
                 : ((lay != null && birds) ? lay * birds : null);
        var layC = (eggs != null && birds) ? (eggs / birds) : lay;
        if (layC == null || layC < 0.20 || !birds) return;    // molt / out / no data
        info[num] = { eggs: eggs, birds: birds };
      });
      units.forEach(function (u) {
        var e = 0, b = 0;
        (u.houses || []).forEach(function (hh) { var i = info[hh]; if (i) { e += i.eggs; b += i.birds; } });
        out[u.key] = b ? { lay: Math.round(e / b * 1000) / 10, birds: b, eggs: Math.round(e) } : null;
      });
    } catch (e) {}
    return out;
  }

  // Window = [fromDaysAgo, toDaysAgo) back from now. Actual week = [0,7),
  // target/prior week = [7,14) → ▼/▲ is a real week-over-week trend.
  // Keyed by RUN UNIT (group id at Hegins, house number at Danville).
  function _efStats(site, units, fromDays, toDays) {
    var now = Date.now();
    var hi = now - fromDays * 86400000;   // newest edge
    var lo = now - toDays * 86400000;     // oldest edge
    var out = {};
    var unitOf = {};
    units.forEach(function (u) {
      out[u.key] = { runs: 0, min: 0, speed: [], eggs: 0, eggDays: 0, stuck: 0, houses: u.houses };
      u.houses.forEach(function (h) { unitOf[h] = u.key; });   // house → its unit
    });
    _efData.forEach(function (r) {
      if (r.farm !== site) return;
      var k = _efRunKey(r); if (!out[k]) return;
      var ts = r.startTs || 0; if (ts < lo || ts >= hi) return;
      if (r.status !== 'done' || r.minutes == null) return;
      var m = Number(r.minutes) || 0;
      if (m > _EF_STUCK_MIN) { out[k].stuck++; return; }   // don't let a forgotten Stop skew it
      out[k].runs++; out[k].min += m;
      if (r.speed != null && r.speed !== '') out[k].speed.push(Number(r.speed));
    });
    _efWalks.forEach(function (w) {
      if (w.farm !== site) return;
      var k = unitOf[String(w.house)]; if (!k) return;       // roll a house's eggs into its unit
      var ts = Number(w.ts) || 0; if (ts < lo || ts >= hi) return;
      var e = Number(w.eggsCollected) || 0;
      if (e > 0) { out[k].eggs += e; out[k].eggDays++; }
    });
    var farmEggs = _efFarmEggs(site);
    Object.keys(out).forEach(function (h) {
      var s = out[h];
      s.avgMin = s.runs ? Math.round(s.min / s.runs) : null;
      s.avgSpeed = s.speed.length ? Math.round(s.speed.reduce(function (a, b) { return a + b; }, 0) / s.speed.length * 10) / 10 : null;
      s.avgEggs = s.eggDays ? Math.round(s.eggs / s.eggDays) : null;
      // Farm-record eggs: for a GROUP, sum every house in the group.
      if (s.avgEggs == null) {
        var fe = (s.houses || [h]).reduce(function (sum, hh) { return sum + (farmEggs[hh] || 0); }, 0);
        if (fe > 0) { s.avgEggs = fe; s.eggsFromFarm = true; }
      }
      s.eggsPerHr = (s.avgEggs && s.avgMin) ? Math.round(s.avgEggs / (s.avgMin / 60)) : null;
      s.dzPerHr = s.eggsPerHr ? Math.round(s.eggsPerHr / EGGS_PER_DZ) : null;
      s.casesPerHr = s.eggsPerHr ? Math.round(s.eggsPerHr / EGGS_PER_CASE * 10) / 10 : null;
      s.dzPerDay = _dz(s.avgEggs);
      s.casesPerDay = _cases(s.avgEggs);
    });
    return out;
  }

  function _drawSummary(site, units) {
    var keys = units.map(function (u) { return u.key; });
    var labelOf = {}; units.forEach(function (u) { labelOf[u.key] = u.isGroup ? (u.label + ' (' + u.houses.join('·') + ')') : ('H' + u.key); });
    var wk = _efStats(site, units, 0, 7);    // THIS week (last 7 days) = actual
    var tgt = _efStats(site, units, 7, 14);  // PRIOR week = the trend target
    var prod = _efProdRate(site, units);     // production rate (lay %) per unit
    function prodCell(p, bold) {
      if (!p || p.lay == null) return '<td style="padding:8px 6px;text-align:center;color:#4a6a4a;">—</td>';
      var c = p.lay >= 90 ? '#4ade80' : (p.lay >= 85 ? '#e8c96a' : '#f0a0a0');
      return '<td style="padding:8px 6px;text-align:center;color:' + c + ';font-weight:700;" title="' + _num(p.birds) + ' birds">' + p.lay + '%</td>';
    }
    var stuckTotal = keys.reduce(function (s, h) { return s + (wk[h] ? wk[h].stuck : 0); }, 0);
    var anyData = keys.some(function (h) { return wk[h] && wk[h].runs > 0; });
    if (!anyData) return '';
    var houses = keys;   // rows are keyed by run unit

    function cell(v, unit) { return v == null ? '<span style="color:#4a6a4a;">—</span>' : ('<b style="color:#f0ead8;">' + _num(v) + '</b>' + (unit ? '<span style="color:#7a9a7a;font-size:9px;"> ' + unit + '</span>' : '')); }
    // vs-target arrow: for run time LOWER is better; for eggs/hr HIGHER is better.
    function vs(actual, target, lowerBetter) {
      if (actual == null || target == null || !target) return '';
      var d = Math.round((actual - target) / target * 100);
      if (Math.abs(d) < 3) return '<span style="color:#7a9a7a;font-size:9px;"> ≈ target</span>';
      var good = lowerBetter ? d < 0 : d > 0;
      return '<span style="color:' + (good ? '#4ade80' : '#f0a0a0') + ';font-size:9px;"> ' + (d > 0 ? '▲' : '▼') + Math.abs(d) + '%</span>';
    }

    var rows = houses.map(function (h) {
      var a = wk[h], t = tgt[h];
      if (!a || !a.runs) return '';
      return '<tr style="border-bottom:1px solid #1a2a1a;">' +
        '<td style="padding:8px 6px;color:#f0ead8;font-weight:700;">' + _esc(labelOf[h] || h) + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#aaa;">' + a.runs + '</td>' +
        '<td style="padding:8px 6px;text-align:center;">' + cell(a.avgMin, 'min') + vs(a.avgMin, t.avgMin, true) + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#7a9a7a;font-size:10px;">' + (t.avgMin != null ? (t.avgMin + ' min') : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;">' + cell(a.avgSpeed) + '</td>' +
        '<td style="padding:8px 6px;text-align:center;">' + cell(a.avgEggs) + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#cfe0a0;">' + (a.dzPerDay != null ? _num(a.dzPerDay) : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#cfe0a0;">' + (a.casesPerDay != null ? _num(a.casesPerDay) : '—') + '</td>' +
        prodCell(prod[h]) +
        '<td style="padding:8px 6px;text-align:center;">' + cell(a.eggsPerHr) + vs(a.eggsPerHr, t.eggsPerHr, false) + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#e8d36a;font-weight:700;">' + (a.dzPerHr != null ? _num(a.dzPerHr) : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#4ade80;font-weight:700;">' + (a.casesPerHr != null ? _num(a.casesPerHr) : '—') + '</td>' +
      '</tr>';
    }).join('');

    // Site totals — eggs use each house's avg/day (farm records), not just the
    // hand-typed ones, so the TOTAL row can't read 0 while the rows show numbers.
    var tRuns = 0, tMin = 0, tEggs = 0;
    houses.forEach(function (h) {
      if (!wk[h]) return;
      tRuns += wk[h].runs; tMin += wk[h].min;
      tEggs += (wk[h].avgEggs || 0);
    });
    var tAvgMin = 0, nH = 0;
    houses.forEach(function (h) { if (wk[h] && wk[h].avgMin) { tAvgMin += wk[h].avgMin; nH++; } });
    // Site eggs/hour = total eggs per day ÷ the average house run length (hours).
    var tEggsHr = (tEggs && nH) ? Math.round(tEggs / ((tAvgMin / nH) / 60)) : null;
    // Site production rate = all units' eggs/day ÷ all their live birds.
    var tB = 0, tE2 = 0;
    keys.forEach(function (h) { var p = prod[h]; if (p) { tB += p.birds; tE2 += p.eggs; } });
    var tLay = tB ? Math.round(tE2 / tB * 1000) / 10 : null;

    return '<div style="' + MONO + 'font-size:11px;letter-spacing:1px;color:#6aa06a;text-transform:uppercase;margin:16px 2px 8px;font-weight:700;">📊 ' +
        efL('7-day trend by house · vs last week', 'Tendencia 7 días por casa · vs la semana pasada') + '</div>' +
      (stuckTotal ? '<div style="' + MONO + 'font-size:10.5px;color:#e8c96a;background:#231a08;border:1.5px solid #7a5a1a;border-radius:9px;padding:8px 11px;margin-bottom:8px;">⚠ ' +
        efL(stuckTotal + ' run(s) left open over 8h (someone forgot to tap Stop) — excluded from the averages. Fix by stopping the run.',
            stuckTotal + ' corrida(s) abiertas más de 8h (no se tocó Detener) — excluidas de los promedios.') + '</div>' : '') +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;' + MONO + 'font-size:12px;min-width:700px;">' +
      '<thead><tr style="border-bottom:1px solid #2a4a2a;">' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:left;">' + (EF_GROUPS[site] ? efL('Group', 'Grupo') : efL('House', 'Casa')) + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">' + efL('Runs', 'Corridas') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">' + efL('Avg run', 'Prom corrida') + '</th>' +
        '<th style="padding:7px 6px;color:#7a9a7a;text-align:center;font-size:9px;">🎯 ' + efL('target', 'meta') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">' + efL('Avg speed', 'Prom vel') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">' + efL('Eggs/day', 'Huevos/día') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">' + efL('Dz/day', 'Dz/día') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">' + efL('Cases/day', 'Cajas/día') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">🥚 ' + efL('Prod rate', '% Prod') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">🚿 ' + efL('Flow eggs/hr', 'Flujo huevos/hr') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">' + efL('Dz/hour', 'Dz/hora') + '</th>' +
        '<th style="padding:7px 6px;color:#5a8a5a;text-align:center;">' + efL('Cases/hour', 'Cajas/hora') + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr style="border-top:1.5px solid #2a4a2a;">' +
        '<td style="padding:8px 6px;color:#9ad6a0;font-weight:700;">' + efL('TOTAL', 'TOTAL') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#9ad6a0;font-weight:700;">' + tRuns + '</td>' +
        '<td colspan="3" style="padding:8px 6px;text-align:center;color:#9ad6a0;font-weight:700;">' + _dur(tMin * 60000) + ' ' + efL('total run time', 'tiempo total') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#9ad6a0;font-weight:700;">' + _num(tEggs) + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#cfe0a0;font-weight:700;">' + (_dz(tEggs) != null ? _num(_dz(tEggs)) : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#cfe0a0;font-weight:700;">' + (_cases(tEggs) != null ? _num(_cases(tEggs)) : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;font-weight:700;color:' + (tLay == null ? '#4a6a4a' : (tLay >= 90 ? '#4ade80' : (tLay >= 85 ? '#e8c96a' : '#f0a0a0'))) + ';">' + (tLay != null ? (tLay + '%') : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#9ad6a0;font-weight:700;">' + (tEggsHr ? _num(tEggsHr) : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#e8d36a;font-weight:700;">' + (tEggsHr ? _num(_dz(tEggsHr)) : '—') + '</td>' +
        '<td style="padding:8px 6px;text-align:center;color:#4ade80;font-weight:700;">' + (tEggsHr ? _num(_cases(tEggsHr)) : '—') + '</td>' +
      '</tr></tfoot></table></div>' +
      '<div style="' + MONO + 'font-size:9.5px;color:#4a6a4a;margin-top:6px;line-height:1.6;">' +
        efL('7-DAY TREND · 🎯 target = that barn\'s own PRIOR 7 days. ▼/▲ = this week vs last week (lower run time and higher eggs/hour are better). Eggs come from the Farm Production Records (same files as Tier 1). 🥚 Prod rate = eggs/day ÷ live birds (lay %) — green ≥90 · amber ≥85 · red below; molt/out houses excluded. 🚿 Flow = eggs/hour while the belts run.',
            'TENDENCIA 7 DÍAS · 🎯 meta = los 7 días anteriores de esa casa. ▼/▲ = esta semana vs la pasada (menos tiempo y más huevos/hora es mejor). Los huevos vienen de los Registros de Producción. 🥚 % Prod = huevos/día ÷ aves vivas — verde ≥90 · ámbar ≥85 · rojo abajo; casas en muda/vacías excluidas. 🚿 Flujo = huevos/hora mientras corren las bandas.') + '</div>';
  }

  function _draw() {
    var host = document.getElementById('prod-sec-eggflow');
    if (!host) return;
    var site = _efSite();
    var houses = _efHouses(site);
    var units = _efUnits(site);          // groups at Hegins, houses at Danville
    var cards = units.map(function (u) { return _houseCard(site, u); }).join('') ||
      '<div style="' + MONO + 'font-size:12px;color:#5a7a5a;padding:14px;">' + efL('No active houses for this site.', 'Sin casas activas para este sitio.') + '</div>';
    host.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">' +
        '<span style="' + MONO + 'font-size:13px;font-weight:700;color:#a3d0e8;letter-spacing:1px;">🚿 ' + efL('Egg Flow', 'Flujo de Huevos') + ' · ' + _esc(site) + '</span>' +
        '<span style="' + MONO + 'font-size:9px;color:#4ade80;border:1px solid #2a5a2a;border-radius:20px;padding:2px 8px;">● ' + efL('LIVE', 'EN VIVO') + '</span>' +
      '</div>' +
      '<div style="' + MONO + 'font-size:10px;color:#7a9a7a;margin-bottom:12px;">' +
        efL('Set the speed, tap Start when the belts run, Stop when done. Times save automatically.', 'Pon la velocidad, toca Iniciar cuando corran las bandas, Detener al terminar. Los tiempos se guardan solos.') +
        (EF_GROUPS[site] ? ('<br>' + efL('This site runs in GROUPS — one Start/Stop covers the whole group.', 'Este sitio corre en GRUPOS — un Iniciar/Detener cubre todo el grupo.')) : '') +
      '</div>' +
      '<div style="display:grid;gap:9px;">' + cards + '</div>' +
      _drawSummary(site, units) +
      _drawLog(host, site);
  }

  // ── Actions ──
  window.efStart = function (farm, house) {
    if (typeof db === 'undefined' || !db) return;
    var idb = (farm + '_' + house).replace(/[^a-zA-Z0-9]/g, '_');
    var sp = document.getElementById('ef-speed-' + idb);
    var speed = sp && sp.value !== '' ? Number(sp.value) : null;
    // Speed is REQUIRED — a run with no setting isn't useful data (Joe 2026-07-20).
    if (speed == null || isNaN(speed)) {
      if (typeof toast === 'function') toast(efL('⚠ Enter the speed first', '⚠ Pon la velocidad primero'));
      if (sp) { try { sp.focus(); sp.style.borderColor = '#e5533c'; } catch (e) {} }
      return;
    }
    var key = farm + '_' + house;
    // Hegins runs in groups: record the group id + the houses it covers so the
    // rollup can split eggs across them. Danville stays a single house.
    var unit = _efUnits(farm).filter(function (u) { return u.key === String(house); })[0];
    var rec = { farm: farm, house: String(house), speed: speed, dirtyLine: !!_efDirty[key],
                startTs: Date.now(), stopTs: null, minutes: null, status: 'open',
                date: _today(), by: _by(), ts: Date.now() };
    if (unit && unit.isGroup) { rec.group = unit.key; rec.groupLabel = unit.label; rec.houses = unit.houses.slice(); }
    db.collection('eggFlow').add(rec)
      .then(function () { delete _efDirty[key]; if (typeof toast === 'function') toast(efL('▶ Run started', '▶ Corrida iniciada')); })
      .catch(function (e) { console.error('efStart:', e); if (typeof toast === 'function') toast(efL('⚠ Could not start', '⚠ No se pudo iniciar')); });
  };
  window.efToggleDirty = function (farm, house) {
    var open = _openRun(farm, house);
    if (open && typeof db !== 'undefined' && db) {
      db.collection('eggFlow').doc(open._id).update({ dirtyLine: !open.dirtyLine, ts: Date.now() }).catch(function (e) { console.error('efToggleDirty:', e); });
    } else {
      var k = farm + '_' + house; _efDirty[k] = !_efDirty[k]; _draw();
    }
  };
  window.efStop = function (id) {
    if (typeof db === 'undefined' || !db) return;
    var run = _efData.filter(function (r) { return r._id === id; })[0];
    var start = run ? (run.startTs || Date.now()) : Date.now();
    var now = Date.now();
    db.collection('eggFlow').doc(id).update({ stopTs: now, minutes: Math.max(0, Math.round((now - start) / 60000)), status: 'done', ts: now })
      .then(function () { if (typeof toast === 'function') toast(efL('⏹ Run logged', '⏹ Corrida registrada')); })
      .catch(function (e) { console.error('efStop:', e); if (typeof toast === 'function') toast(efL('⚠ Could not stop', '⚠ No se pudo detener')); });
  };
  window.efSetSpeed = function (id, val) {
    if (typeof db === 'undefined' || !db) return;
    db.collection('eggFlow').doc(id).update({ speed: val !== '' ? Number(val) : null, ts: Date.now() }).catch(function (e) { console.error('efSetSpeed:', e); });
  };

  window.renderEggFlow = function () {
    var host = document.getElementById('prod-sec-eggflow');
    if (!host || typeof db === 'undefined' || !db) return;
    if (_efUnsub) { try { _efUnsub(); } catch (e) {} _efUnsub = null; }
    host.innerHTML = '<div style="color:#aaa;' + MONO + 'font-size:12px;padding:12px;">' + efL('Loading egg flow…', 'Cargando flujo…') + '</div>';
    var cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    try {
      _efUnsub = db.collection('eggFlow').where('ts', '>=', cutoff).orderBy('ts', 'desc').onSnapshot(function (snap) {
        _efData = snap.docs.map(function (d) { return Object.assign({}, d.data(), { _id: d.id }); });
        _draw();
      }, function (err) { console.error('eggFlow live:', err); host.innerHTML = '<div style="color:#e53e3e;padding:16px;">' + (err && err.message ? err.message : err) + '</div>'; });
    } catch (e) { console.error('renderEggFlow:', e); }
    // Eggs collected per house comes from the Daily EE Check — needed for eggs/hour.
    if (_efWalkUnsub) { try { _efWalkUnsub(); } catch (e) {} _efWalkUnsub = null; }
    try {
      _efWalkUnsub = db.collection('barnWalks').where('ts', '>=', cutoff).onSnapshot(function (snap) {
        _efWalks = snap.docs.map(function (d) { return d.data() || {}; });
        _draw();
      }, function (err) { console.warn('eggFlow barnWalks:', err); });
    } catch (e) { console.warn('eggFlow walks listen:', e); }
    // Farm-record eggs per house (tierExternal, refreshed by the 6am push).
    if (_efExtUnsub) { try { _efExtUnsub(); } catch (e) {} _efExtUnsub = null; }
    try {
      _efExtUnsub = db.collection('tierExternal').onSnapshot(function (snap) {
        var m = {};
        snap.docs.forEach(function (d) { try { m[d.id] = JSON.parse((d.data() || {}).json || '{}'); } catch (e) {} });
        _efExt = m; _draw();
      }, function (err) { console.warn('eggFlow tierExternal:', err); });
    } catch (e) { console.warn('eggFlow ext listen:', e); }
    // Repaint running timers every 20s.
    if (_efTick) clearInterval(_efTick);
    _efTick = setInterval(function () { if (document.getElementById('prod-sec-eggflow') && document.getElementById('prod-sec-eggflow').offsetParent !== null) _draw(); }, 20000);
  };
})();
