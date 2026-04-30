// ═══════════════════════════════════════════════════════════════════════
// COST DASHBOARD
// Pulls from: workOrders (labor hrs), partsInventory (parts),
//             contractorLog (contractor), downtimeEvents (downtime loss)
// Labor rate: $30/hr
// ═══════════════════════════════════════════════════════════════════════

const COST_LABOR_RATE = 30;   // $/hr — update here to change everywhere

function renderCostDashboard() {
  const el = document.getElementById('maint-cost');
  if (!el) return;

  const now       = new Date();
  const thisWeek  = getWeekStart(now);
  const lastWeek  = getWeekStart(new Date(now - 7*86400000));
  const thisMonth = now.toISOString().slice(0,7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);

  // ── Labor: sum hours from completed WOs ───────────────────────────────────
  const wos = workOrders || [];
  const completedWOs = wos.filter(w => w.status === 'completed' && w.date);

  function woLaborCost(list) {
    return list.reduce((s,w) => s + (Number(w.laborHours)||0) * COST_LABOR_RATE, 0);
  }
  function filterByDate(list, from, to) {
    return list.filter(w => { const d = w.date||w.completedDate||''; return d >= from && d <= to; });
  }

  const weekStr     = thisWeek.toISOString().slice(0,10);
  const lastWkStr   = lastWeek.toISOString().slice(0,10);
  const weekEnd     = new Date(thisWeek.getTime() + 6*86400000).toISOString().slice(0,10);
  const lastWkEnd   = new Date(lastWeek.getTime() + 6*86400000).toISOString().slice(0,10);

  const thisWkWOs   = filterByDate(completedWOs, weekStr, weekEnd);
  const lastWkWOs   = filterByDate(completedWOs, lastWkStr, lastWkEnd);
  const thisMonWOs  = completedWOs.filter(w => (w.date||'').slice(0,7) === thisMonth);
  const lastMonWOs  = completedWOs.filter(w => (w.date||'').slice(0,7) === lastMonth);

  const laborThisWk  = woLaborCost(thisWkWOs);
  const laborLastWk  = woLaborCost(lastWkWOs);
  const laborThisMon = woLaborCost(thisMonWOs);

  // ── Parts ─────────────────────────────────────────────────────────────────
  // Sum parts cost from WOs that have partsCost logged
  function partsCost(list) {
    return list.reduce((s,w) => s + (Number(w.partsCost)||0), 0);
  }
  const partsThisWk  = partsCost(thisWkWOs);
  const partsLastWk  = partsCost(lastWkWOs);
  const partsThisMon = partsCost(thisMonWOs);

  // ── Contractor ────────────────────────────────────────────────────────────
  const ctLog = contractorLog || [];
  function ctCost(fromDate, toDate) {
    return ctLog.filter(r => r.date >= fromDate && r.date <= toDate)
                .reduce((s,r) => s + (Number(r.cost)||0), 0);
  }
  const ctThisWk  = ctCost(weekStr, weekEnd);
  const ctLastWk  = ctCost(lastWkStr, lastWkEnd);
  const ctThisMon = ctLog.filter(r => (r.date||'').slice(0,7) === thisMonth)
                         .reduce((s,r) => s + (Number(r.cost)||0), 0);
  const ctInHouseOpp = ctLog.filter(r => r.couldInHouse === 'yes')
                            .reduce((s,r) => s + (Number(r.cost)||0), 0);

  // ── Downtime ─────────────────────────────────────────────────────────────
  // Downtime cost = (minutes / 60) * 25 employees * avg $18/hr production rate
  const dt = downtimeEvents || [];
  function dtCost(fromDate, toDate) {
    return dt.filter(e => { const d = (e.date||e.startDate||''); return d >= fromDate && d <= toDate; })
             .reduce((s,e) => s + ((Number(e.duration)||0) / 60) * 25 * 18, 0);
  }
  const dtThisWk  = dtCost(weekStr, weekEnd);
  const dtLastWk  = dtCost(lastWkStr, lastWkEnd);
  const thisMonStart = thisMonth + '-01';
  const todayStr     = now.toISOString().slice(0,10);
  const dtThisMon    = dtCost(thisMonStart, todayStr);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalThisWk  = laborThisWk + partsThisWk + ctThisWk + dtThisWk;
  const totalLastWk  = laborLastWk + partsLastWk + ctLastWk + dtLastWk;
  const totalThisMon = laborThisMon + partsThisMon + ctThisMon;
  const weekDelta    = totalLastWk > 0 ? ((totalThisWk - totalLastWk) / totalLastWk * 100) : null;

  // ── 8-week trend ──────────────────────────────────────────────────────────
  const weeklyTrend = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = getWeekStart(new Date(now - i*7*86400000));
    const wEnd   = new Date(wStart.getTime() + 6*86400000);
    const ws     = wStart.toISOString().slice(0,10);
    const we     = wEnd.toISOString().slice(0,10);
    const label  = wStart.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const labor  = woLaborCost(filterByDate(completedWOs, ws, we));
    const parts  = partsCost(filterByDate(completedWOs, ws, we));
    const ct     = ctCost(ws, we);
    weeklyTrend.push({ label, total: labor + parts + ct, labor, parts, ct });
  }
  const maxTrend = Math.max(...weeklyTrend.map(w => w.total), 1);

  // ── Contractor breakdown ──────────────────────────────────────────────────
  const ctByVendor = {};
  ctLog.forEach(r => {
    if (!ctByVendor[r.vendor]) ctByVendor[r.vendor] = { cost:0, visits:0, inHouse:0 };
    ctByVendor[r.vendor].cost   += Number(r.cost)||0;
    ctByVendor[r.vendor].visits += 1;
    if (r.couldInHouse === 'yes') ctByVendor[r.vendor].inHouse += Number(r.cost)||0;
  });
  const topVendors = Object.entries(ctByVendor).sort((a,b) => b[1].cost - a[1].cost).slice(0,5);

  el.innerHTML = `
    <!-- Header KPIs -->
    <div class="stats-grid g4" style="margin-bottom:20px;">
      ${costKpi('This Week', '$'+fmt(totalThisWk), weekDelta !== null ? (weekDelta > 0 ? '↑ +'+Math.abs(weekDelta).toFixed(0)+'% vs last wk' : '↓ '+Math.abs(weekDelta).toFixed(0)+'% vs last wk') : '', weekDelta === null ? '#1a3a1a' : weekDelta > 10 ? '#2d0000' : '#1a3a1a', '#4ade80')}
      ${costKpi('This Month', '$'+fmt(totalThisMon), '', '#0d2a4a', '#7ab0f6')}
      ${costKpi('Contractor Total', '$'+fmt(ctLog.reduce((s,r)=>s+(Number(r.cost)||0),0)), ctLog.length + ' visits logged', '#1a1500', '#fbbf24')}
      ${costKpi('Savings Opportunity', '$'+fmt(ctInHouseOpp), 'if done in-house', '#2d1500', '#fb923c')}
    </div>

    <!-- This Week Breakdown -->
    <div style="background:#0a1f0a;border:1.5px solid #1a3a1a;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#4a8a4a;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">THIS WEEK BREAKDOWN</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
        ${costBreakdownItem('🔧 Labor', laborThisWk, totalThisWk, '#7ab0f6')}
        ${costBreakdownItem('🔩 Parts', partsThisWk, totalThisWk, '#a78bfa')}
        ${costBreakdownItem('🏗️ Contractor', ctThisWk, totalThisWk, '#fbbf24')}
        ${costBreakdownItem('⏱️ Downtime Loss', dtThisWk, totalThisWk, '#f87171')}
      </div>
      <div style="margin-top:12px;border-top:1px solid #1a3a1a;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#4a8a4a;">TOTAL THIS WEEK</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#4ade80;">$${fmt(totalThisWk)}</span>
      </div>
    </div>

    <!-- 8-Week Trend Bar Chart -->
    <div style="background:#0a1f0a;border:1.5px solid #1a3a1a;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#4a8a4a;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">8-WEEK COST TREND</div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:100px;">
        ${weeklyTrend.map((w, i) => {
          const pct = maxTrend > 0 ? Math.max((w.total / maxTrend) * 100, 3) : 3;
          const isThisWk = i === weeklyTrend.length - 1;
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a8a4a;">$${w.total > 999 ? (w.total/1000).toFixed(1)+'k' : fmt(w.total)}</div>
            <div style="width:100%;background:${isThisWk?'#4ade80':'#2d6a4f'};border-radius:3px 3px 0 0;height:${pct}%;min-height:4px;transition:height .3s;"></div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${isThisWk?'#4ade80':'#4a8a4a'};white-space:nowrap;">${w.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Top Contractors -->
    ${topVendors.length > 0 ? `
    <div style="background:#0a1f0a;border:1.5px solid #1a3a1a;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#4a8a4a;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">TOP CONTRACTORS BY SPEND</div>
      ${topVendors.map(([vendor, data]) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1a3a1a;">
          <div style="flex:1;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#e8f5ec;">${vendor}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;">${data.visits} visit${data.visits!==1?'s':''} ${data.inHouse > 0 ? '· <span style="color:#fb923c;">$'+fmt(data.inHouse)+' could be in-house</span>' : ''}</div>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:#fbbf24;">$${fmt(data.cost)}</div>
        </div>`).join('')}
    </div>` : ''}

    <!-- Note on labor hours -->
    <div style="background:#091209;border:1px solid #1a3a1a;border-radius:8px;padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a5a2a;line-height:1.7;">
      💡 Labor cost calculated at $${COST_LABOR_RATE}/hr from completed WO hours. Parts cost from WO parts-cost field.
      Downtime loss estimated at 25 employees × $18/hr production rate.
      To improve accuracy, make sure techs log hours and parts cost when closing work orders.
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Math.round(n).toLocaleString(); }

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
}

function costKpi(label, value, sub, bg, color) {
  return `<div style="background:${bg};border:1.5px solid ${color}33;border-radius:12px;padding:14px 12px;text-align:center;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${color};opacity:.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${label}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${color};line-height:1;">${value}</div>
    ${sub ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${color};opacity:.6;margin-top:4px;">${sub}</div>` : ''}
  </div>`;
}

function costBreakdownItem(label, cost, total, color) {
  const pct = total > 0 ? Math.round(cost / total * 100) : 0;
  return `<div style="background:#0d1a0d;border:1px solid #1a3a1a;border-radius:8px;padding:10px 12px;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;margin-bottom:6px;">${label}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:${color};">$${fmt(cost)}</div>
    <div style="margin-top:6px;background:#1a3a1a;border-radius:3px;height:4px;">
      <div style="background:${color};height:4px;border-radius:3px;width:${pct}%;transition:width .4s;"></div>
    </div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;margin-top:3px;">${pct}% of total</div>
  </div>`;
}
