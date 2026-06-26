// ═══════════════════════════════════════════════════════════════════════════
// DAILY SCORECARD  —  Six Sigma operations view, scoped to the active location.
// CTQs (Critical-To-Quality): (1) Bird Livability / mortality, (2) Maintenance
// reliability. Built for a daily standup: yesterday's numbers + today's red
// flags, with SPC-style control limits (mean + 2σ) so a spike screams at you.
// Master = both plants combined; Hegins / Danville = that site only.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const MONO = "'IBM Plex Mono',monospace";
  const L = (en, es) => (typeof _lang !== 'undefined' && _lang === 'es') ? es : en;

  // ── small stats helpers ──────────────────────────────────────────────────
  const iso        = d => d.toISOString().slice(0, 10);
  const daysAgoISO = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const num        = n => (typeof fmtNum === 'function' ? fmtNum(Math.round(n)) : String(Math.round(n)));
  const mean       = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const stdev      = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
  const woMillis   = w => (w.ts && w.ts.toMillis ? w.ts.toMillis() : (w.ts || 0));

  window.openScorecard = function () {
    const ov = document.getElementById('scorecard-overlay');
    if (ov) ov.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}
    renderScorecard();
  };
  window.closeScorecard = function () {
    const ov = document.getElementById('scorecard-overlay');
    if (ov) ov.style.display = 'none';
  };

  // ── KPI tile ───────────────────────────────────────────────────────────────
  function tile(value, label, color, sub) {
    return `<div style="background:#0f2a0f;border:1px solid #1e3a1e;border-left:4px solid ${color};border-radius:12px;padding:14px 14px 12px;">
      <div style="font-family:${MONO};font-size:30px;font-weight:700;color:${color};line-height:1;">${value}</div>
      <div style="font-family:${MONO};font-size:9px;font-weight:700;color:#7ab07a;text-transform:uppercase;letter-spacing:1px;margin-top:6px;">${label}</div>
      ${sub ? `<div style="font-family:${MONO};font-size:10px;color:#5a8a5a;margin-top:3px;">${sub}</div>` : ''}
    </div>`;
  }
  const card = inner => `<div style="background:#0d1f0d;border:1px solid #1e3a1e;border-radius:14px;padding:16px;margin-bottom:14px;">${inner}</div>`;
  const secTitle = (icon, txt) => `<div style="font-family:${MONO};font-size:11px;font-weight:700;color:#c8e6c9;letter-spacing:2px;text-transform:uppercase;margin:4px 0 12px;">${icon} ${txt}</div>`;

  window.renderScorecard = async function renderScorecard() {
    const body = document.getElementById('scorecard-body');
    if (!body) return;

    const pref     = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
    const isMaster = !pref;
    const farms    = pref ? [pref] : ['Hegins', 'Danville'];
    const titleEl  = document.getElementById('scorecard-title');
    if (titleEl) titleEl.textContent = (isMaster ? 'ALL LOCATIONS' : pref.toUpperCase()) + ' · ' + new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    body.innerHTML = `<div style="padding:48px;text-align:center;color:#4a8a4a;font-family:${MONO};font-size:13px;letter-spacing:1px;">${L('Crunching the numbers…', 'Calculando los números…')}</div>`;

    // ── BIRD LIVABILITY: 30 days of barn walks ─────────────────────────────
    let walks = [];
    try {
      const snap = await db.collection('barnWalks').where('date', '>=', daysAgoISO(29)).get();
      walks = snap.docs.map(d => d.data()).filter(w => isMaster || farms.includes(w.farm));
    } catch (e) { console.warn('scorecard barnWalks:', e); }

    const today = iso(new Date());
    const yday  = daysAgoISO(1);

    const byDay = {};
    walks.forEach(w => { byDay[w.date] = (byDay[w.date] || 0) + (Number(w.mortCount) || 0); });
    const last14   = Array.from({ length: 14 }, (_, i) => { const d = daysAgoISO(13 - i); return { date: d, mort: byDay[d] || 0 }; });
    const ydayMort = byDay[yday] || 0;
    const todayMort = byDay[today] || 0;
    const past13   = last14.slice(0, 13).map(x => x.mort);   // exclude today (incomplete)
    const mu = mean(past13), sd = stdev(past13);
    const ucl = mu + 2 * sd;                                 // SPC upper control limit
    const avg7 = mean(last14.slice(-7).map(x => x.mort));

    const BIRDS_PER = (typeof EGG_BIRDS_PER_BARN !== 'undefined' ? EGG_BIRDS_PER_BARN : 150000);
    const flock = farms.reduce((s, f) => s + ((typeof FARM_HOUSES !== 'undefined' && FARM_HOUSES[f] ? FARM_HOUSES[f].length : 0) * BIRDS_PER), 0);
    const ydayRate = flock ? (ydayMort / flock * 100) : 0;

    // per-house yesterday (outlier detection across houses)
    const houseY = {};
    walks.filter(w => w.date === yday).forEach(w => { const k = w.farm + ' · ' + w.house; houseY[k] = (houseY[k] || 0) + (Number(w.mortCount) || 0); });
    const hVals = Object.values(houseY);
    const hUcl  = mean(hVals) + 2 * stdev(hVals);
    const houseRows = Object.entries(houseY).sort((a, b) => b[1] - a[1]);

    const mortColor = (todayMort > ucl && ucl > 0) ? '#e53e3e' : (ydayMort > mu && mu > 0) ? '#d69e2e' : '#4caf50';

    // ── MAINTENANCE RELIABILITY ────────────────────────────────────────────
    const wos    = (typeof workOrders !== 'undefined' ? workOrders : []).filter(w => isMaster || farms.includes(w.farm));
    const openWO = wos.filter(w => w.status === 'open' || w.status === 'in-progress');
    const urgent = openWO.filter(w => w.priority === 'urgent');
    const sla    = openWO.filter(w => (typeof woSlaBreached === 'function') && woSlaBreached(w));

    const cut    = Date.now() - 30 * 86400000;
    const recent = wos.filter(w => woMillis(w) >= cut);
    const paretoMap = {};
    recent.forEach(w => { const k = w.problem || 'Other'; paretoMap[k] = (paretoMap[k] || 0) + 1; });
    const pareto    = Object.entries(paretoMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const paretoMax = pareto.length ? pareto[0][1] : 1;
    const paretoTot = recent.length || 1;

    const rfMap = {};
    recent.forEach(w => { const k = (w.farm || '') + ' · ' + (w.house || '?') + ' — ' + (w.problem || 'Other'); rfMap[k] = (rfMap[k] || 0) + 1; });
    const repeats = Object.entries(rfMap).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const pmInScope = t => isMaster || (t.farm ? (farms.includes(t.farm) || t.farm === 'Both' || t.farm === 'All') : (t.farms ? t.farms.some(f => farms.includes(f)) : true));
    const pms = (typeof ALL_PM !== 'undefined' ? ALL_PM : []).filter(pmInScope);
    const pmOverdue   = pms.filter(t => pmStatus(t.id) === 'overdue').length;
    const pmDueSoon   = pms.filter(t => pmStatus(t.id) === 'due-soon').length;
    const pmDoneToday = pms.filter(t => doneToday(t.id)).length;
    const pmHealth    = pms.length ? Math.round((pms.length - pmOverdue) / pms.length * 100) : 100;
    const pmColor     = pmHealth >= 95 ? '#4caf50' : pmHealth >= 85 ? '#d69e2e' : '#e53e3e';
    const woColor     = (urgent.length || sla.length) ? '#e53e3e' : openWO.length ? '#d69e2e' : '#4caf50';

    // ── RED FLAGS (the standup glance) ─────────────────────────────────────
    const flags = [];
    if (todayMort > ucl && ucl > 0) flags.push(L(`Mortality today (${num(todayMort)}) is above the ${num(ucl)} control limit — investigate now.`, `Mortalidad de hoy (${num(todayMort)}) supera el límite de control ${num(ucl)} — investiga ahora.`));
    houseRows.filter(([, v]) => hUcl > 0 && v > hUcl).forEach(([k, v]) => flags.push(L(`${k}: ${num(v)} dead yesterday — outlier vs the other houses.`, `${k}: ${num(v)} muertas ayer — fuera de lo normal vs los demás galpones.`)));
    if (urgent.length) flags.push(L(`${urgent.length} URGENT work order${urgent.length > 1 ? 's' : ''} open.`, `${urgent.length} orden${urgent.length > 1 ? 'es' : ''} URGENTE${urgent.length > 1 ? 's' : ''} abierta${urgent.length > 1 ? 's' : ''}.`));
    if (sla.length)    flags.push(L(`${sla.length} work order${sla.length > 1 ? 's' : ''} past SLA.`, `${sla.length} orden${sla.length > 1 ? 'es' : ''} vencida${sla.length > 1 ? 's' : ''} (SLA).`));
    if (pmOverdue)     flags.push(L(`${pmOverdue} PM${pmOverdue > 1 ? 's' : ''} overdue.`, `${pmOverdue} PM vencido${pmOverdue > 1 ? 's' : ''}.`));
    repeats.slice(0, 2).forEach(([k, c]) => flags.push(L(`Repeat failure: ${k} — ${c}× in 30 days. Root-cause it.`, `Falla repetida: ${k} — ${c}× en 30 días. Busca la causa raíz.`)));

    // ── sparkline (14-day mortality with control limit) ────────────────────
    const sparkMax = Math.max(ucl, ...last14.map(x => x.mort), 1);
    const spark = last14.map(x => {
      const h = Math.max(3, Math.round(x.mort / sparkMax * 46));
      const c = (x.mort > ucl && ucl > 0) ? '#e53e3e' : '#4caf50';
      const isToday = x.date === today;
      return `<div title="${x.date}: ${num(x.mort)}" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px;">
        <div style="width:100%;max-width:16px;height:${h}px;background:${c};border-radius:2px;opacity:${isToday ? 0.5 : 1};"></div>
      </div>`;
    }).join('');
    const uclY = 46 - Math.round(Math.min(ucl, sparkMax) / sparkMax * 46);

    // ── Daily Completion: the checks the crew actually logs each day —
    //    Morning Walk / Daily Employee Check / Manure submit, per house, today. ──
    const _hnum = h => String(h).replace(/\D/g, '');
    const ckSet = new Set();
    walks.filter(w => w.date === today).forEach(w => ckSet.add(w.farm + '|' + _hnum(w.house)));
    const mwSet = new Set(), msSet = new Set();
    try { (await db.collection('morningWalks').where('date', '==', today).get()).forEach(d => { const x = d.data(); if (x && x.farm && x.house != null) mwSet.add(x.farm + '|' + _hnum(x.house)); }); } catch (e) { console.warn('scorecard morningWalks:', e); }
    try { (await db.collection('manureSubmit').where('date', '==', today).get()).forEach(d => { const x = d.data(); if (x && x.farm && x.house != null) msSet.add(x.farm + '|' + _hnum(x.house)); }); } catch (e) { console.warn('scorecard manureSubmit:', e); }
    const COMP_H = { Hegins: [1, 2, 3, 4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
    const MAN_H = (typeof MANURE_HOUSES !== 'undefined') ? MANURE_HOUSES : { Hegins: [4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
    let cDone = 0, cApp = 0, mwD = 0, mwA = 0, ckD = 0, ckA = 0, mnD = 0, mnA = 0;
    farms.forEach(f => (COMP_H[f] || []).forEach(h => {
      const key = f + '|' + h;
      mwA++; if (mwSet.has(key)) mwD++;
      ckA++; if (ckSet.has(key)) ckD++;
      const manApplies = (MAN_H[f] || []).indexOf(h) !== -1;
      if (manApplies) { mnA++; if (msSet.has(key)) mnD++; }
      cApp += 2 + (manApplies ? 1 : 0);
      cDone += (mwSet.has(key) ? 1 : 0) + (ckSet.has(key) ? 1 : 0) + (manApplies && msSet.has(key) ? 1 : 0);
    }));
    const compPct = cApp ? Math.round(cDone / cApp * 100) : 0;
    const mwPct = mwA ? Math.round(mwD / mwA * 100) : 0;
    const ckPct = ckA ? Math.round(ckD / ckA * 100) : 0;
    const mnPct = mnA ? Math.round(mnD / mnA * 100) : 0;
    const compColor = compPct >= 100 ? '#4caf50' : (compPct >= 50 ? '#d69e2e' : '#e53e3e');

    // ── build the page ─────────────────────────────────────────────────────
    let html = '';

    // Sticky glance strip — the three key numbers stay visible while scrolling.
    html += `<div style="position:sticky;top:0;z-index:5;display:flex;gap:8px;background:#0d1f0d;padding:10px 8px;margin:0 0 10px;border:1px solid #1e3a1e;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,.4);">
      <div style="flex:1;text-align:center;"><div style="font-family:${MONO};font-size:24px;font-weight:800;color:${compColor};line-height:1;">${compPct}%</div><div style="font-family:${MONO};font-size:8px;color:#7ab07a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${L('Done Today', 'Listo Hoy')}</div></div>
      <div style="flex:1;text-align:center;border-left:1px solid #1e3a1e;"><div style="font-family:${MONO};font-size:24px;font-weight:800;color:${pmColor};line-height:1;">${pmHealth}%</div><div style="font-family:${MONO};font-size:8px;color:#7ab07a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${L('PM Health', 'Salud PM')}</div></div>
      <div style="flex:1;text-align:center;border-left:1px solid #1e3a1e;"><div style="font-family:${MONO};font-size:24px;font-weight:800;color:${mortColor};line-height:1;">${num(ydayMort)}</div><div style="font-family:${MONO};font-size:8px;color:#7ab07a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${L('Dead Yday', 'Muertas Ayer')}</div></div>
    </div>`;

    // Red-flag band
    html += card(
      secTitle('🚦', L("Today's Red Flags", 'Alertas de Hoy')) +
      (flags.length
        ? flags.map(f => `<div style="display:flex;gap:9px;align-items:flex-start;padding:8px 10px;background:#2a0f0f;border:1px solid #5a2a2a;border-radius:9px;margin-bottom:6px;">
              <span style="font-size:14px;line-height:1.2;">⚠️</span>
              <span style="font-family:${MONO};font-size:12px;color:#ffd5d0;line-height:1.4;">${f}</span>
            </div>`).join('')
        : `<div style="padding:14px;background:#0a2a0a;border:1px solid #2a5a2a;border-radius:9px;font-family:${MONO};font-size:12px;color:#a8d5b5;text-align:center;">${L('✅ No red flags — all CTQs in control.', '✅ Sin alertas — todo bajo control.')}</div>`)
    );

    // CTQ 1 — Daily Completion (the checks the crew actually logs each day)
    html += card(
      secTitle('📋', L('Daily Completion', 'Cumplimiento Diario')) +
      `<div style="text-align:center;margin-bottom:12px;">
        <div style="font-family:${MONO};font-size:40px;font-weight:700;color:${compColor};line-height:1;">${compPct}%</div>
        <div style="font-family:${MONO};font-size:9px;color:#7ab07a;text-transform:uppercase;letter-spacing:1px;margin-top:5px;">${L('Today complete', 'Completo hoy')} · ${cDone}/${cApp} ${L('checks in', 'revisiones')}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        ${tile(mwPct + '%', L('Morning Walk', 'Caminata Mañana'), '#7ab0f6', mwD + '/' + mwA + ' ' + L('houses', 'casas'))}
        ${tile(ckPct + '%', L('Daily Check', 'Revisión Diaria'), '#7ab0f6', ckD + '/' + ckA + ' ' + L('houses', 'casas'))}
        ${tile(mnPct + '%', L('Manure', 'Estiércol'), '#d69e2e', mnD + '/' + mnA + ' ' + L('houses', 'casas'))}
      </div>`
    );

    // CTQ 2 — Bird Livability
    html += card(
      secTitle('🐔', L('Bird Livability', 'Viabilidad de Aves')) +
      `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
        ${tile(num(ydayMort), L('Dead Yesterday', 'Muertas Ayer'), mortColor, ydayRate ? ydayRate.toFixed(3) + L('% of flock', '% del lote') : '')}
        ${tile(avg7.toFixed(1), L('7-Day Avg / Day', 'Prom 7 Días/Día'), '#7ab0f6', L('baseline ', 'base ') + num(mu) + L('/day', '/día'))}
        ${tile(num(ucl), L('Control Limit', 'Límite de Control'), '#d69e2e', L('mean + 2σ', 'media + 2σ'))}
      </div>
      <div style="font-family:${MONO};font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${L('14-Day Mortality Trend', 'Tendencia de Mortalidad 14 Días')}</div>
      <div style="position:relative;height:46px;display:flex;align-items:flex-end;gap:3px;border-bottom:1px solid #1e3a1e;">
        ${ucl > 0 ? `<div style="position:absolute;left:0;right:0;top:${uclY}px;border-top:1px dashed #d69e2e;"></div>` : ''}
        ${spark}
      </div>
      <div style="font-family:${MONO};font-size:8px;color:#3a6a3a;margin-top:4px;text-align:right;">${L('dashed line = control limit · faded bar = today (in progress)', 'línea punteada = límite · barra tenue = hoy (en progreso)')}</div>` +
      (houseRows.length
        ? `<div style="font-family:${MONO};font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">${L('Yesterday by House', 'Ayer por Galpón')}</div>` +
          houseRows.slice(0, 10).map(([k, v]) => {
            const out = hUcl > 0 && v > hUcl;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #14241410;">
              <span style="font-family:${MONO};font-size:12px;color:${out ? '#f87171' : '#c8e6c9'};">${out ? '⚠ ' : ''}${k}</span>
              <span style="font-family:${MONO};font-size:12px;font-weight:700;color:${out ? '#f87171' : '#7ab07a'};">${num(v)}</span>
            </div>`;
          }).join('')
        : `<div style="font-family:${MONO};font-size:11px;color:#5a8a5a;margin-top:10px;">${L('No barn-walk mortality logged yesterday.', 'No se registró mortalidad en el recorrido de ayer.')}</div>`)
    );

    // CTQ 2 — Maintenance Reliability
    html += card(
      secTitle('🔧', L('Maintenance Reliability', 'Confiabilidad de Mantenimiento')) +
      `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
        ${tile(pmHealth + '%', L('PM Compliance', 'Cumplimiento PM'), pmColor, pmDoneToday + L(' done today · target 95%', ' hechos hoy · meta 95%'))}
        ${tile(openWO.length, L('Open WOs', 'Órdenes Abiertas'), woColor, urgent.length + L(' urgent · ', ' urgentes · ') + sla.length + L(' past SLA', ' vencidas'))}
        ${tile(pmOverdue, L('PMs Overdue', 'PM Vencidos'), pmOverdue ? '#e53e3e' : '#4caf50', pmDueSoon + L(' due soon', ' por vencer'))}
      </div>` +
      `<div style="font-family:${MONO};font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${L("Pareto — What's Breaking (30 days)", 'Pareto — Qué Falla (30 días)')}</div>` +
      (pareto.length
        ? pareto.map(([k, c]) => {
            const pct = Math.round(c / paretoTot * 100);
            return `<div style="margin-bottom:7px;">
              <div style="display:flex;justify-content:space-between;font-family:${MONO};font-size:11px;color:#c8e6c9;margin-bottom:2px;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:74%;">${k}</span><span style="color:#7ab07a;">${c} · ${pct}%</span>
              </div>
              <div style="background:#163016;border-radius:3px;height:8px;overflow:hidden;">
                <div style="height:100%;width:${Math.round(c / paretoMax * 100)}%;background:#e67e22;border-radius:3px;"></div>
              </div>
            </div>`;
          }).join('')
        : `<div style="font-family:${MONO};font-size:11px;color:#5a8a5a;">${L('No work orders in the last 30 days.', 'Sin órdenes en los últimos 30 días.')}</div>`) +
      (repeats.length
        ? `<div style="font-family:${MONO};font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">${L('🔁 Repeat Failures (root-cause candidates)', '🔁 Fallas Repetidas (candidatas a causa raíz)')}</div>` +
          repeats.map(([k, c]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #14241410;">
            <span style="font-family:${MONO};font-size:11px;color:#fca5a5;">${k}</span>
            <span style="font-family:${MONO};font-size:11px;font-weight:700;color:#f87171;">${c}×</span>
          </div>`).join('')
        : '')
    );

    html += `<div style="font-family:${MONO};font-size:9px;color:#2a4a2a;text-align:center;padding:6px 0 24px;letter-spacing:1px;">
      ${L('Define → Measure → Analyze → Improve → Control · live data, scoped to ', 'Definir → Medir → Analizar → Mejorar → Controlar · datos en vivo, ')}${isMaster ? L('all locations', 'todas las ubicaciones') : pref}</div>`;

    body.innerHTML = html;
  };
})();
