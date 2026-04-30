// DASHBOARD
// ═══════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
// 6am Executive Brief — Director-ready top-issues ranked by severity
// ─────────────────────────────────────────────────────────────────────────────
function renderExecBrief(todayStr, yesterStr) {
  const el = document.getElementById('dash-exec-brief');
  if (!el) return;

  const issues = []; // { sev: 'critical'|'warning'|'ok', icon, title, detail, trend }

  // 1. Equipment down right now
  const activeDowntime = (downtimeEvents||[]).filter(e => e.ongoing || !e.endTs);
  if (activeDowntime.length > 0) {
    const names = activeDowntime.slice(0,3).map(e => e.equipment||'Unknown').join(', ');
    issues.push({ sev:'critical', icon:'🔴', title:`${activeDowntime.length} ${t('brief.equip_down')}`, detail: names, trend:null });
  }

  // 2. Urgent open work orders
  const urgentOpen = (workOrders||[]).filter(w => w.priority==='urgent' && w.status!=='completed');
  if (urgentOpen.length > 0) {
    const topWO = urgentOpen[0];
    issues.push({ sev:'critical', icon:'🔧', title:`${urgentOpen.length} ${t('brief.urgent_wo')}${urgentOpen.length>1?'s':''}`, detail: topWO.title||topWO.equipment||'See Work Orders', trend:null });
  }

  // 3. PM overdue
  const pmOvCount = (ALL_PM||[]).filter(t=>pmStatus(t.id)==='overdue').length;
  if (pmOvCount > 0) {
    issues.push({ sev: pmOvCount >= 3 ? 'critical' : 'warning', icon:'⏰', title:`${pmOvCount} ${t('brief.pm_overdue')}`, detail:t('brief.tap_maint'), trend:null });
  }

  // 4. Barns flagged today
  const allBarns2 = [...Array.from({length:8},(_,i)=>({farm:'Hegins',n:i+1})),...Array.from({length:5},(_,i)=>({farm:'Danville',n:i+1})),...Array.from({length:5},(_,i)=>({farm:'Rushtown',n:i+1})),...Array.from({length:4},(_,i)=>({farm:'Turbotville',n:i+1})),...Array.from({length:2},(_,i)=>({farm:'W&M',n:i+1}))];
  const bs2 = typeof BARN_STATUS !== 'undefined' ? BARN_STATUS : {};
  const flaggedBarns2 = allBarns2.filter(b=>bs2[b.farm+'-'+b.n]==='issue');
  if (flaggedBarns2.length > 0) {
    const names2 = flaggedBarns2.slice(0,3).map(b=>`${b.farm} H${b.n}`).join(', ');
    issues.push({ sev:'warning', icon:'🚩', title:`${flaggedBarns2.length} ${t('brief.barns_flagged')}`, detail: names2, trend:null });
  }

  // 5. Egg quality — defect rate trend vs yesterday
  const qToday = (opsEggQuality||[]).filter(r=>r.date===todayStr);
  const qYest  = (opsEggQuality||[]).filter(r=>r.date===yesterStr);
  const calcDefRate = recs => {
    const g = recs.reduce((s,r)=>s+(Number(r.totalGraded)||0),0);
    const d = recs.reduce((s,r)=>(Number(r.cracks)||0)+(Number(r.dirties)||0)+(Number(r.softShells)||0)+(Number(r.bloodSpots)||0)+(Number(r.floorEggs)||0)+s,0);
    return g > 0 ? (d/g*100) : null;
  };
  const drToday = calcDefRate(qToday);
  const drYest  = calcDefRate(qYest);
  if (drToday !== null) {
    let trend = null;
    if (drYest !== null) trend = drToday > drYest + 0.5 ? t('brief.worse') : drToday < drYest - 0.5 ? t('brief.better') : t('brief.flat');
    const sev = drToday > 5 ? 'critical' : drToday > 2 ? 'warning' : 'ok';
    issues.push({ sev, icon:'🥚', title:`${t('brief.defect_rate')} ${drToday.toFixed(1)}%`, detail: `${qToday.length} ${t('brief.quality_note')}`, trend });
  }

  // 6. Mortality spike
  const todayMort = typeof _todayMortTotal !== 'undefined' ? _todayMortTotal : 0;
  if (todayMort > 5) {
    issues.push({ sev: todayMort > 15 ? 'critical' : 'warning', icon:'⚠️', title:`${t('brief.mortality')}: ${todayMort} birds`, detail:t('brief.check_walk'), trend:null });
  }

  // 7. Low parts stock
  const lowParts2 = (typeof PARTS_DEFS!=='undefined'?PARTS_DEFS:[]).filter(p=>{const inv=partsInventory[p.id]||{qty:0,min:1};return inv.qty<=inv.min;}).length;
  if (lowParts2 > 0) {
    issues.push({ sev:'warning', icon:'📦', title:`${lowParts2} ${t('brief.low_stock')}`, detail:t('brief.tap_parts'), trend:null });
  }

  // Sort: critical first, then warning, then ok
  const sevOrder = {critical:0, warning:1, ok:2};
  issues.sort((a,b) => sevOrder[a.sev] - sevOrder[b.sev]);

  // All clear
  if (issues.length === 0) {
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#0a1f0a,#0f2a0f);border:1.5px solid #2a5a2a;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">✅</span>
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#4caf50;letter-spacing:1px;text-transform:uppercase;">${t('brief.all_clear')}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#3a6a3a;margin-top:2px;">${t('brief.no_issues')}</div>
        </div>
      </div>`;
    return;
  }

  const sevColors = { critical:'#e53e3e', warning:'#d69e2e', ok:'#4caf50' };
  const sevBg     = { critical:'#1a0505', warning:'#1a1200', ok:'#0a1a0a' };
  const sevBorder = { critical:'#5a1010', warning:'#4a3500', ok:'#1a3a1a' };
  const trendColors = { '↑ worse':'#e53e3e', '↓ better':'#4caf50', '→ flat':'#7a8a7a' };

  const rows = issues.slice(0,5).map((iss,i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:${sevBg[iss.sev]};border-left:3px solid ${sevColors[iss.sev]};${i<issues.slice(0,5).length-1?'border-bottom:1px solid #1a2a1a;':''}">
      <span style="font-size:16px;flex-shrink:0;">${iss.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${sevColors[iss.sev]};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${iss.title}${iss.trend?` <span style="color:${trendColors[iss.trend]||'#7a8a7a'};font-size:10px;">${iss.trend}</span>`:''}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5a7a5a;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${iss.detail}</div>
      </div>
      <div style="font-size:8px;font-family:'IBM Plex Mono',monospace;color:${sevColors[iss.sev]};text-transform:uppercase;letter-spacing:1px;flex-shrink:0;">${iss.sev}</div>
    </div>`).join('');

  el.innerHTML = `
    <div style="background:#0a1a0a;border:1.5px solid ${issues[0].sev==='critical'?'#5a1010':'#3a4a1a'};border-radius:12px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#0f0f0f;border-bottom:1px solid #1a2a1a;">
        <span style="font-size:13px;">📋</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#9a9a7a;letter-spacing:2px;text-transform:uppercase;">${t('dash.exec_brief').replace('📋 ','')}</span>
        <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5a4a;">${issues.filter(i=>i.sev==='critical').length} ${t('brief.critical')} · ${issues.filter(i=>i.sev==='warning').length} ${t('brief.warnings')}</span>
      </div>
      ${rows}
    </div>`;
}

function renderDash() {
  document.getElementById('dash-date').textContent = TODAY.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const todayStr = new Date().toISOString().slice(0,10);
  const yesterStr = new Date(Date.now()-86400000).toISOString().slice(0,10);

  // ── 6am Executive Brief ──
  renderExecBrief(todayStr, yesterStr);

  // ── PM overdue alert banner ──
  const pmOvCount = ALL_PM.filter(t=>pmStatus(t.id)==='overdue').length;
  const pmAlertEl = document.getElementById('dash-pm-alert');
  const pmAlertCount = document.getElementById('dash-pm-alert-count');
  if (pmAlertEl) {
    if (pmOvCount > 0) {
      pmAlertEl.style.display = 'flex';
      if (pmAlertCount) pmAlertCount.textContent = '⚠️ ' + pmOvCount + ' PM tasks overdue';
    } else {
      pmAlertEl.style.display = 'none';
    }
  }

  // ── PRODUCTION card ──
  const allBarns = [...Array.from({length:8},(_,i)=>({farm:'Hegins',n:i+1})),...Array.from({length:5},(_,i)=>({farm:'Danville',n:i+1})),...Array.from({length:5},(_,i)=>({farm:'Rushtown',n:i+1})),...Array.from({length:4},(_,i)=>({farm:'Turbotville',n:i+1})),...Array.from({length:2},(_,i)=>({farm:'W&M',n:i+1}))];
  const bs  = typeof BARN_STATUS    !== 'undefined' ? BARN_STATUS    : {};
  const msd = typeof MORNING_STATUS !== 'undefined' ? MORNING_STATUS : {};
  const barnsDone    = allBarns.filter(b => { const k=b.farm+'-'+b.n; return bs[k]==='done'||bs[k]==='issue'||msd[k]==='done'||msd[k]==='issue'; }).length;
  const flaggedBarns = allBarns.filter(b=>bs[b.farm+'-'+b.n]==='issue').length;
  const barnPct = Math.round(barnsDone/allBarns.length*100);
  const todayMortTotal = typeof _todayMortTotal !== 'undefined' ? _todayMortTotal : 0;
  // Build egg map: today vs yesterday for trend
  const eggMapToday = {}, eggMapYest = {};
  (typeof opsEggByBarn!=='undefined'?opsEggByBarn:[]).filter(r=>r.date===todayStr)
    .forEach(r=>{ const k=r.farm+'-'+r.house; if(!eggMapToday[k]||r.ts>eggMapToday[k].ts) eggMapToday[k]=r; });
  (typeof opsEggByBarn!=='undefined'?opsEggByBarn:[]).filter(r=>r.date===yesterStr)
    .forEach(r=>{ const k=r.farm+'-'+r.house; if(!eggMapYest[k]||r.ts>eggMapYest[k].ts) eggMapYest[k]=r; });
  const todayEggTotal = Object.values(eggMapToday).reduce((s,r)=>s+(Number(r.eggsCollected)||0),0);
  const yesterEggTotal= Object.values(eggMapYest).reduce((s,r)=>s+(Number(r.eggsCollected)||0),0);
  const eggTrend = (todayEggTotal > 0 && yesterEggTotal > 0) ? (todayEggTotal >= yesterEggTotal ? `<span style="color:#4caf50;font-size:10px;">↑ ${fmtNum(todayEggTotal-yesterEggTotal)} vs yest</span>` : `<span style="color:#e53e3e;font-size:10px;">↓ ${fmtNum(yesterEggTotal-todayEggTotal)} vs yest</span>`) : '';
  // Legacy opsEggData fallback
  const eggMap = {};
  (typeof opsEggData!=='undefined'?opsEggData:[]).filter(r=>r.date===todayStr)
    .forEach(r=>{ const k=r.farm+'-'+r.house; eggMap[k]=(eggMap[k]||0)+(Number(r.eggs)||0); });
  const todayEggs = todayEggTotal || Object.values(eggMap).reduce((s,v)=>s+v,0);
  const barnColor = barnPct>=80?'#4caf50':barnPct>=50?'#d69e2e':'#e53e3e';
  const prodCard = document.getElementById('dash-prod-card');
  if (prodCard) prodCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4caf50;">${t('dash.prod_card')}</div>
      <span style="font-size:11px;color:#4caf50;">→</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${barnColor};line-height:1.1;">${barnsDone}/${allBarns.length}</div>
        <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.checks_done')}</div>
      </div>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${todayMortTotal>0?'#e53e3e':'#f0ead8'};line-height:1.1;">${todayMortTotal}</div>
        <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.mortality')}</div>
      </div>
    </div>
    ${todayEggs > 0 ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#3a6a3a;margin-bottom:5px;">${fmtNum(todayEggs)} eggs ${eggTrend}</div>` : ''}
    ${flaggedBarns>0?`<div style="font-size:10px;color:#e53e3e;font-family:'IBM Plex Mono',monospace;font-weight:700;margin-bottom:6px;">🚩 ${flaggedBarns} barn${flaggedBarns>1?'s':''} flagged</div>`:''}
    <div style="background:#163016;border-radius:3px;height:4px;overflow:hidden;"><div style="height:100%;background:${barnColor};width:${barnPct}%;border-radius:3px;"></div></div>`;

  // ── MAINTENANCE card ──
  const urgOpen = workOrders.filter(w=>w.priority==='urgent'&&w.status!=='completed').length;
  const woOpenAll = workOrders.filter(w=>w.status!=='completed').length;
  const pmOv = ALL_PM.filter(t=>pmStatus(t.id)==='overdue').length;
  const pmDoneToday = ALL_PM.filter(t=>doneToday(t.id)).length;
  const pmCompliancePct = ALL_PM.length > 0 ? Math.round((ALL_PM.filter(t=>pmStatus(t.id)==='ok'||doneToday(t.id)).length / ALL_PM.length)*100) : 100;
  const pmCompCol = pmCompliancePct >= 90 ? '#4caf50' : pmCompliancePct >= 70 ? '#d69e2e' : '#e53e3e';
  const lowParts = PARTS_DEFS.filter(p=>{const inv=partsInventory[p.id]||{qty:0,min:1};return inv.qty<=inv.min;}).length;
  const maintCard = document.getElementById('dash-maint-card');
  if (maintCard) maintCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#3b82f6;">${t('dash.maint_card')}</div>
      <span style="font-size:11px;color:#3b82f6;">→</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;">
      <div style="cursor:pointer;" onclick="go('maint');goMaintSection('wo');woTogglePriority('urgent',document.querySelector('#wo-filter-bar .pill[data-wo=urgent]'))" title="View urgent WOs">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${urgOpen>0?'#e53e3e':'#f0ead8'};line-height:1.1;">${urgOpen}</div>
        <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.urgent_wo')} →</div>
      </div>
      <div style="cursor:pointer;" onclick="go('maint');goMaintSection('wo');pmStat('overdue',document.querySelector('#pm-filter-bar .pill'))" title="View overdue PMs">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${pmOv>0?'#d69e2e':'#f0ead8'};line-height:1.1;">${pmOv}</div>
        <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.pm_overdue')} →</div>
      </div>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${pmCompCol};line-height:1.1;">${pmCompliancePct}%</div>
        <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.pm_compliance')}</div>
      </div>
    </div>
    <div class="pm-compliance-bar"><div class="pm-compliance-fill" style="width:${pmCompliancePct}%;background:${pmCompCol};"></div></div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a7aaa;margin-top:6px;cursor:pointer;" onclick="go('maint');goMaintSection('wo');woResetFilters()">${woOpenAll} open WOs →${lowParts>0?' &nbsp;·&nbsp; <span style="color:#e07070;">⚠ '+lowParts+' low stock</span>':''}</div>`;

  // ── PACKAGING card ──
  const todayPacked = (typeof opsPackData!=='undefined'?opsPackData:[]).filter(r=>r.date===todayStr).reduce((s,r)=>s+(Number(r.qty)||0),0);
  const yesterPacked= (typeof opsPackData!=='undefined'?opsPackData:[]).filter(r=>r.date===yesterStr).reduce((s,r)=>s+(Number(r.qty)||0),0);
  const packTrend = (todayPacked > 0 && yesterPacked > 0) ? (todayPacked >= yesterPacked ? `<span style="color:#4caf50;">↑ ${todayPacked-yesterPacked}</span>` : `<span style="color:#e53e3e;">↓ ${yesterPacked-todayPacked}</span>`) : '';
  const pkgCard = document.getElementById('dash-pkg-card');
  if (pkgCard) pkgCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#d69e2e;">${t('dash.pkg_card')}</div>
      <span style="font-size:11px;color:#d69e2e;">→</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#f0ead8;line-height:1.1;">${fmtNum(todayEggs)}</div>
        <div style="font-size:9px;color:#7a6a30;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.eggs_logged')}</div>
      </div>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#f0ead8;line-height:1.1;">${fmtNum(todayPacked)}</div>
        <div style="font-size:9px;color:#7a6a30;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.cases_packed')}</div>
      </div>
    </div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#8a7040;">${fmtNum(todayPacked)} cases${packTrend?' &nbsp;'+packTrend+' vs yest':' packed today'}</div>`;

  // ── SHIPPING card ──
  const activeLoads = (typeof opsShipData!=='undefined'?opsShipData:[]).filter(r=>['in-process','staged','loaded'].includes(r.status)).length;
  const todayShipLoads = (typeof opsShipData!=='undefined'?opsShipData:[]).filter(r=>r.date===todayStr).length;
  const holds = (typeof opsShipData!=='undefined'?opsShipData:[]).filter(r=>r.status==='hold').length;
  const openExc = (typeof opsExcData!=='undefined'?opsExcData:[]).filter(r=>r.status!=='resolved').length;
  const shipCard = document.getElementById('dash-ship-card');
  if (shipCard) shipCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9b59b6;">${t('dash.ship_card')}</div>
      <span style="font-size:11px;color:#9b59b6;">→</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#f0ead8;line-height:1.1;">${activeLoads}</div>
        <div style="font-size:9px;color:#6a4a8a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.active_loads')}</div>
      </div>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${openExc>0?'#e53e3e':'#f0ead8'};line-height:1.1;">${openExc}</div>
        <div style="font-size:9px;color:#6a4a8a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">${t('dash.exceptions')}</div>
      </div>
    </div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6a4a8a;">${todayShipLoads} loads today${holds>0?' &nbsp;·&nbsp; <span style="color:#e07070;">'+holds+' on hold</span>':''}</div>`;

  // ── FEED MILL card ──
  const feedCard = document.getElementById('dash-feed-card');
  if (feedCard && typeof feedBins !== 'undefined') {
    const latestByBin = {};
    (feedReadings||[]).forEach(r => { if (!latestByBin[r.binId] || r.ts > latestByBin[r.binId].ts) latestByBin[r.binId] = r; });
    const totalFeedLbs = feedBins.reduce((s,b) => { const r=latestByBin[b.binId]; return s + (r?Number(r.readingLbs):0); }, 0);
    const lowBins  = feedBins.filter(b => { const r=latestByBin[b.binId]; const pct=r&&b.capacityLbs?Math.round((r.readingLbs/b.capacityLbs)*100):101; return pct < (b.orderPct||25); });
    const todayDel = (feedDeliveries||[]).filter(r=>r.date===todayStr).reduce((s,r)=>s+(Number(r.tons)||0),0);
    const todayMade= (feedMadeLog||[]).filter(r=>r.date===todayStr).reduce((s,r)=>s+(Number(r.tons)||0),0);

    const binBars = feedBins.slice(0,6).map(b => {
      const r = latestByBin[b.binId];
      const pct = r&&b.capacityLbs ? Math.min(100,Math.round((r.readingLbs/b.capacityLbs)*100)) : 0;
      const col = pct >= 50 ? '#4caf50' : pct >= (b.orderPct||25) ? '#d69e2e' : '#e53e3e';
      return `<div style="flex:1;min-width:60px;">
        <div style="font-size:9px;color:#6a9a6a;font-family:'IBM Plex Mono',monospace;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${b.name}">${b.barn||b.name}</div>
        <div style="background:#162816;border-radius:4px;height:8px;position:relative;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;transition:width .4s;"></div>
          <div style="position:absolute;top:0;bottom:0;left:${b.orderPct||25}%;width:1px;background:rgba(255,255,255,.5);"></div>
        </div>
        <div style="font-size:9px;font-family:'IBM Plex Mono',monospace;color:${col};margin-top:2px;text-align:center;font-weight:700;">${r?pct+'%':'—'}</div>
      </div>`;
    }).join('');

    feedCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4caf50;">🌾 Feed Mill</div>
        <span style="font-size:11px;color:#4caf50;">→</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <div><div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#f0ead8;">${feedBins.length}</div><div style="font-size:9px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;">Bins</div></div>
        <div><div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#f0ead8;">${fmtNum(Math.round(totalFeedLbs/2000*10)/10)} T</div><div style="font-size:9px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;">Total Inv.</div></div>
        <div><div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${lowBins.length>0?'#e53e3e':'#4caf50'};">${lowBins.length}</div><div style="font-size:9px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;">Low Bins</div></div>
        <div><div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#f0ead8;">${todayDel>0?todayDel+'T':todayMade>0?todayMade+'T':'—'}</div><div style="font-size:9px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.5px;">${todayDel>0?'Delivered':todayMade>0?'Made Today':'No Activity'}</div></div>
      </div>
      ${feedBins.length ? `<div style="display:flex;gap:8px;align-items:flex-end;">${binBars}</div>` : '<div style="font-size:11px;color:#4a8a4a;font-family:\'IBM Plex Mono\',monospace;">No bins configured — go to Feed Mill to set up bins.</div>'}
      ${lowBins.length ? `<div style="margin-top:8px;font-size:10px;color:#e53e3e;font-family:'IBM Plex Mono',monospace;">⚠️ Low: ${lowBins.map(b=>b.barn||b.name).join(', ')}</div>` : ''}`;
  }

  // ── Urgent WOs ──
  const urgent = workOrders.filter(w=>w.priority==='urgent'&&w.status!=='completed');
  document.getElementById('dash-urgent').innerHTML = urgent.length
    ? urgent.map(wo=>woCardHtml(wo)).join('')
    : '<div class="empty"><div class="ei">✅</div><p>No urgent open work orders</p></div>';

  // ── Active Exceptions ──
  const exc = (typeof opsExcData!=='undefined'?opsExcData:[]).filter(r=>r.status!=='resolved').slice(0,4);
  const excHdr = document.getElementById('dash-exc-hdr');
  if (excHdr) excHdr.style.display = exc.length ? '' : 'none';
  const excEl = document.getElementById('dash-exceptions');
  if (excEl) excEl.innerHTML = exc.length
    ? exc.map(r=>`<div style="background:#fde8e6;border:1px solid #f0a0a0;border-radius:10px;padding:10px 14px;margin-bottom:8px;cursor:pointer;" onclick="go('ship');setTimeout(()=>goShipSection('exceptions'),50)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span style="font-weight:700;font-size:13px;color:#333;">${r.type||'Exception'} — ${r.description||''}</span>
          <span class="exc-sev ${r.severity||'medium'}">${(r.severity||'medium').toUpperCase()}</span>
        </div>
        <div style="font-size:11px;color:#888;margin-top:3px;font-family:'IBM Plex Mono',monospace;">${r.date||''}${r.farm?' · '+r.farm:''}${r.reporter?' · Reported by '+r.reporter:''}</div>
      </div>`).join('')
    : '';

  // ── Packing Performance Summary ──
  renderPackingSummary(todayStr);

  // ── Egg KPI Hero ──
  renderDashEggKPI(todayStr);

  // ── Low Stock Parts ──
  updatePartsAlerts();
  const lowPartsArr = PARTS_DEFS.filter(p=>{const inv=partsInventory[p.id]||{qty:0,min:1};return inv.qty<=inv.min;});
  document.getElementById('dash-low-parts').innerHTML = lowPartsArr.length
    ? lowPartsArr.map(p=>{
        const inv = partsInventory[p.id]||{qty:0,min:1};
        return `<div class="parts-card" onclick="go('maint');setTimeout(()=>goMaintSection('parts'),50)">
          <div class="parts-qty low">${inv.qty}</div>
          <div class="parts-info"><h4>${p.name}</h4><p><span style="font-weight:700;color:var(--green-mid)">${p.rhNum}</span> · #${p.itemNo}</p></div>
          <div class="parts-min">Min: ${inv.min}</div>
        </div>`;
      }).join('')
    : '<div class="empty"><div class="ei">✅</div><p>All parts stocked</p></div>';
}


function renderPackingSummary(todayStr) {
  const el = document.getElementById('dash-packing-summary');
  if (!el) return;

  const breakColor = r => r >= 2 ? '#e53e3e' : r >= 1 ? '#d69e2e' : '#4caf50';
  const breakBg    = r => r >= 2 ? '#1a0505' : r >= 1 ? '#1a1200' : '#0a1a0a';
  const breakBdr   = r => r >= 2 ? '#5a1010' : r >= 1 ? '#4a3500' : '#1a3a1a';

  const calcLoc = recs => {
    const dz     = recs.reduce((s,r) => s + (Number(r.qty)||0), 0);
    const broken = recs.reduce((s,r) => s + (Number(r.brokenEggs)||0), 0);
    const rate   = dz > 0 ? Math.round((broken / (dz * 12)) * 1000) / 10 : null;
    return { dz, broken, rate };
  };

  const mainRecs = (typeof opsPackData !== 'undefined' ? opsPackData : []).filter(r => r.date === todayStr);
  const hgRecs   = (typeof locationPackData !== 'undefined' ? locationPackData.hegins  : []).filter(r => r.date === todayStr);
  const dvRecs   = (typeof locationPackData !== 'undefined' ? locationPackData.danville : []).filter(r => r.date === todayStr);

  const locs = [
    { label: 'Rushtown',  data: calcLoc(mainRecs), entries: mainRecs.length },
    { label: 'Hegins',    data: calcLoc(hgRecs),   entries: hgRecs.length   },
    { label: 'Danville',  data: calcLoc(dvRecs),   entries: dvRecs.length   },
  ];

  const totalDz     = locs.reduce((s,l) => s + l.data.dz, 0);
  const totalBroken = locs.reduce((s,l) => s + l.data.broken, 0);
  const totalRate   = totalDz > 0 ? Math.round((totalBroken / (totalDz * 12)) * 1000) / 10 : null;

  const locCard = (loc) => {
    const { dz, broken, rate } = loc.data;
    const hasData = loc.entries > 0;
    const rc = rate !== null ? breakColor(rate) : '#5a7a5a';
    const rb = rate !== null ? breakBg(rate)    : '#0a1a0a';
    const rd = rate !== null ? breakBdr(rate)   : '#1a2a1a';
    return `
      <div style="background:${rb};border:1.5px solid ${rd};border-radius:10px;padding:10px 12px;cursor:pointer;" onclick="go('pkg');setTimeout(()=>goPkgSection('packing'),50)">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7a9a7a;margin-bottom:8px;">${loc.label}</div>
        ${hasData ? `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">
            <div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#f0ead8;line-height:1;">${fmtNum(dz)}</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#5a7a5a;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Doz</div>
            </div>
            <div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${broken>0?'#e07070':'#f0ead8'};line-height:1;">${broken||'0'}</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#5a7a5a;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Broken</div>
            </div>
            <div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${rc};line-height:1;">${rate !== null ? rate+'%' : '—'}</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#5a7a5a;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Break</div>
            </div>
          </div>` :
          `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#2a4a2a;">No entries today</div>`
        }
      </div>`;
  };

  const hasAnyData = totalDz > 0;
  const tc = totalRate !== null ? breakColor(totalRate) : '#5a7a5a';

  el.innerHTML = `
    <div style="background:#050f05;border:1.5px solid #1a3a1a;border-radius:14px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;background:#0a1a0a;border-bottom:1px solid #1a2a1a;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9a9a6a;">📦 Today's Packing</span>
        ${hasAnyData ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${tc};">${fmtNum(totalDz)} dz total${totalRate !== null ? ' · '+totalRate+'% break' : ''}</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:10px 12px;">
        ${locs.map(locCard).join('')}
      </div>
    </div>`;
}

function renderDashEggKPI(todayStr) {
  const el = document.getElementById('dash-egg-kpi');
  if (!el) return;

  const farmOrder  = ['Hegins','Danville','Rushtown','Turbotville','W&M'];
  const farmHouses = {Hegins:8, Danville:5, Rushtown:5, Turbotville:4, 'W&M':2};
  const totalHouses = Object.values(farmHouses).reduce((s,v)=>s+v,0);

  // Index today's opsEggByBarn by farm+house (newest per barn)
  const barnMap = {};  // "Farm-House" → record
  (opsEggByBarn||[]).filter(r => r.date === todayStr)
    .forEach(r => {
      const k = r.farm + '-' + r.house;
      if (!barnMap[k] || r.ts > barnMap[k].ts) barnMap[k] = r;
    });

  const barnsReported  = Object.keys(barnMap).length;
  const totalCollected = Object.values(barnMap).reduce((s,r)=>s+(Number(r.eggsCollected)||0),0);
  const totalPackedDz  = Object.values(barnMap).reduce((s,r)=>s+(Number(r.eggsPacked)||0),0);
  const totalTarget    = barnsReported * EGG_TARGET;
  const overallPct     = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : null;
  const heroCol        = overallPct === null ? '#2a5a2a' : kpiCol(overallPct);

  // Per-farm breakdown
  let farmRows = '';
  farmOrder.forEach(farm => {
    let farmCollected = 0, farmPacked = 0, farmCount = 0;
    let houseRows = '';
    for (let h = 1; h <= farmHouses[farm]; h++) {
      const rec = barnMap[farm + '-' + h];
      if (!rec) continue;
      const collected = Number(rec.eggsCollected) || 0;
      const packedDz  = Number(rec.eggsPacked) || 0;
      const pct = Math.round((collected / EGG_TARGET) * 100);
      const hc  = kpiCol(pct);
      farmCollected += collected; farmPacked += packedDz; farmCount++;
      houseRows += `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#5a8a5a;">H${h}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${hc};font-weight:700;">${pct}% &nbsp;<span style="color:#3a5a3a;font-weight:400;">${fmtNum(collected)}</span></span>
          </div>
          <div style="background:#0c2a0c;border-radius:3px;height:10px;overflow:hidden;margin-bottom:2px;">
            <div style="height:100%;width:${Math.min(100,pct)}%;background:${hc};border-radius:3px;"></div>
          </div>
          ${packedDz > 0 ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a7a5a;text-align:right;">📦 ${fmtNum(packedDz)} dz packed</div>` : ''}
        </div>`;
    }
    if (!houseRows) return;
    const fp = Math.round((farmCollected / (farmCount * EGG_TARGET)) * 100);
    farmRows += `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #1e3a1e;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#7ab07a;letter-spacing:1px;">${farm}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${kpiCol(fp)};font-weight:700;">${fmtNum(farmCollected)} eggs &nbsp;·&nbsp; ${fp}%</span>
        </div>
        ${houseRows}
      </div>`;
  });

  const hasData = barnsReported > 0;

  el.innerHTML = `
    <div style="background:#050f05;border:2px solid ${heroCol};border-radius:18px;overflow:hidden;" onclick="go('pkg');setTimeout(()=>goPkgSection('eggs'),50)" style="cursor:pointer;">
      <!-- Hero Header -->
      <div style="background:linear-gradient(135deg,#0a2a0a,#0f1f0f);padding:20px 18px 16px;cursor:pointer;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#4caf50;margin-bottom:10px;">🥚 EGG PRODUCTION KPI</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:52px;font-weight:700;color:${heroCol};line-height:1;">${overallPct !== null ? overallPct+'%' : '—'}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#3a6a3a;margin-top:4px;">of 90% target · ${fmtNum(EGG_TARGET)}/barn/day</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#f0ead8;">${fmtNum(totalCollected)}</div>
            <div style="font-size:9px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;">eggs today</div>
            ${totalPackedDz > 0 ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:#4caf50;margin-top:6px;">${fmtNum(totalPackedDz)} dz</div><div style="font-size:9px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;">packed</div>` : ''}
          </div>
        </div>
        <!-- Master progress bar -->
        <div style="margin-top:14px;background:#0c2a0c;border-radius:6px;height:12px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(100,overallPct||0)}%;background:${heroCol};border-radius:6px;transition:width .5s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:5px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a6a3a;">${barnsReported} of ${totalHouses} barns reported</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a6a3a;">Target: ${fmtNum(totalTarget||0)}</div>
        </div>
      </div>
      <!-- Per-barn breakdown -->
      ${hasData ? `<div style="padding:14px 18px 16px;background:#050f05;">${farmRows}</div>` :
        `<div style="padding:16px 18px;background:#050f05;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2a5a2a;">No egg data yet today — log in Packaging → Eggs by Barn</div>`}
    </div>`;
}

// ═══════════════════════════════════════════
// WEEKLY EMAIL SUMMARY
// ═══════════════════════════════════════════
async function generateWeeklySummary() {
  const btn = document.querySelector('[onclick="generateWeeklySummary()"]');
  if (btn) { btn.textContent = '⏳ Building…'; btn.disabled = true; }

  try {
    const today   = new Date();
    const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
    const weekAgoTs   = weekAgo.getTime();
    const weekAgoDate = weekAgo.toISOString().slice(0,10);

    const [woSnap, barnSnap, pestSnap, pmSnap] = await Promise.all([
      db.collection('workOrders').where('ts','>=',weekAgoTs).get().catch(()=>({docs:[]})),
      db.collection('barnWalks').where('date','>=',weekAgoDate).get().catch(()=>({docs:[]})),
      db.collection('pestLog').where('date','>=',weekAgoDate).get().catch(()=>({docs:[]})),
      db.collection('pmHistory').where('ts','>=',weekAgoTs).get().catch(()=>({docs:[]})),
    ]);

    const wos    = woSnap.docs.map(d=>d.data());
    const walks  = barnSnap.docs.map(d=>d.data());
    const pests  = pestSnap.docs.map(d=>d.data());
    const pmDone = pmSnap.docs.map(d=>d.data());

    const woOpen   = wos.filter(w=>w.status==='open').length;
    const woInProg = wos.filter(w=>w.status==='in-progress').length;
    const woDone   = wos.filter(w=>w.status==='completed').length;
    const woUrgent = wos.filter(w=>w.priority==='urgent'&&w.status!=='completed').length;
    const woByFarm = {};
    wos.forEach(w=>{ woByFarm[w.farm]=(woByFarm[w.farm]||0)+1; });

    const flaggedWalks = walks.filter(w=>w.flags&&w.flags.length>0).length;
    const totalMort    = walks.reduce((s,w)=>s+(w.mortCount||0),0);
    const uniqueBarns  = new Set(walks.map(w=>w.farm+'-'+w.house)).size;

    const rodentSightings = pests.filter(p=>p.rodent==='yes').length;
    const totalRodents    = pests.reduce((s,p)=>s+(p.rodentCount||0),0);
    const flySightings    = pests.filter(p=>p.fly==='yes').length;

    const fmt   = d => d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const range = fmt(weekAgo) + ' \u2013 ' + fmt(today);

    const lines = [
      'RUSHTOWN POULTRY \u2014 WEEKLY OPERATIONS SUMMARY',
      range + ' | Generated ' + today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}),
      '',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '\uD83D\uDD27 WORK ORDERS',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      'New this week:    ' + wos.length,
      'Completed:        ' + woDone,
      'Open:             ' + woOpen,
      'In Progress:      ' + woInProg,
      woUrgent > 0 ? '\uD83D\uDEA8 Urgent open:   ' + woUrgent + '  <- NEEDS ATTENTION' : '\u2705 No urgent open WOs',
      Object.keys(woByFarm).length ? 'By farm:          ' + Object.entries(woByFarm).map(([f,n])=>f+' ('+n+')').join(', ') : '',
      '',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '\uD83D\uDC13 BARN WALKS',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      'Total walks logged:  ' + walks.length,
      'Unique barns walked: ' + uniqueBarns + ' / 13',
      'Walks with flags:    ' + flaggedWalks,
      'Total mortality:     ' + totalMort,
      '',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '\uD83D\uDC00 PEST LOG',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      'Rodent sightings:  ' + rodentSightings,
      'Total rodents:     ' + totalRodents,
      'Fly sightings:     ' + flySightings,
      '',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '\uD83D\uDCCB PREVENTIVE MAINTENANCE',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      'PM tasks completed:  ' + pmDone.length,
      '',
      'Generated by Rushtown Poultry Operations Hub',
    ];

    const subject = encodeURIComponent('Rushtown Poultry \u2014 Weekly Summary ' + range);
    const body    = encodeURIComponent(lines.join('\n'));
    window.open('mailto:?subject=' + subject + '&body=' + body);

  } catch(err) {
    console.error('generateWeeklySummary error:', err);
    alert('Error building summary: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '\uD83D\uDCE7 Weekly Summary'; btn.disabled = false; }
  }
}
