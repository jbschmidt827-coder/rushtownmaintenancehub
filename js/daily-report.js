// ═══════════════════════════════════════════════════════════════════════
// DAILY END-OF-SHIFT REPORT
// Farms: Danville (5 houses) · Hegins (8 houses)
// Pulls from: morningWalks, barnWalks, workOrders
// Also tracks: headcount, safe days, 5S/improvement projects
// ═══════════════════════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────────────────────────────
let _drFarm = 'Danville';
let _drSection = 'production';  // 'production' | 'maintenance' | '5s'
let _drMorningWalks  = [];
let _drBarnWalks     = [];
let _drProjects      = [];
let _drSafetySettings = {};
let _drLoaded        = false;

const DR_FARMS = {
  Danville: { houses: 5, color: '#2563eb', border: '#3b82f6' },
  Hegins:   { houses: 8, color: '#16a34a', border: '#4ade80' }
};

// ── Entry point ──────────────────────────────────────────────────────────────
async function renderDailyReport() {
  const el = document.getElementById('panel-daily');
  if (!el) return;
  el.innerHTML = drLoadingHTML();
  try {
    await drLoadData();
    drRender();
  } catch(e) {
    el.innerHTML = `<div style="padding:24px;color:#ef4444;font-family:'IBM Plex Mono',monospace;">Error loading daily report: ${e.message}</div>`;
    console.error('Daily Report error:', e);
  }
}

function drLoadingHTML() {
  return `<div style="padding:32px;text-align:center;font-family:'IBM Plex Mono',monospace;color:#4a8a4a;font-size:13px;letter-spacing:1px;">Loading daily report…</div>`;
}

// ── Load today's data from Firebase ─────────────────────────────────────────
async function drLoadData() {
  const today = new Date().toISOString().slice(0,10);

  const [mwSnap, bwSnap, projSnap, safetySnap] = await Promise.all([
    db.collection('morningWalks').where('date','==',today).get(),
    db.collection('barnWalks').where('date','==',today).get(),
    db.collection('dailyProjects').orderBy('createdTs','desc').limit(100).get(),
    db.collection('safetySettings').doc('main').get()
  ]);

  _drMorningWalks  = mwSnap.docs.map(d => ({...d.data(), _fbId: d.id}));
  _drBarnWalks     = bwSnap.docs.map(d => ({...d.data(), _fbId: d.id}));
  _drProjects      = projSnap.docs.map(d => ({...d.data(), _fbId: d.id}));
  _drSafetySettings = safetySnap.exists ? safetySnap.data() : {};
  _drLoaded        = true;

  // Real-time listener for projects
  if (!window._drProjectsListening) {
    window._drProjectsListening = true;
    db.collection('dailyProjects').orderBy('createdTs','desc').limit(100).onSnapshot(snap => {
      _drProjects = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
      if (document.getElementById('panel-daily')?.classList.contains('active')) drRender();
    });
  }

  // Subscribe to EOS collections (rocks, l10Todos, idsIssues) — re-render when any change
  if (typeof eosSubscribe === 'function') {
    eosSubscribe(() => {
      if (document.getElementById('panel-daily')?.classList.contains('active')) drRender();
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function drGetMW(farm, house) {
  // Latest morning walk for this farm+house today
  return _drMorningWalks
    .filter(w => w.farm === farm && String(w.house) === String(house))
    .sort((a,b) => (b.ts||0) - (a.ts||0))[0] || null;
}

function drGetBW(farm, house) {
  // Latest barn walk for this farm+house today
  return _drBarnWalks
    .filter(w => w.farm === farm && String(w.house) === String(house))
    .sort((a,b) => (b.ts||0) - (a.ts||0))[0] || null;
}

function drSafeDays() {
  if (!_drSafetySettings.lastIncidentDate) return null;
  const last = new Date(_drSafetySettings.lastIncidentDate);
  const now  = new Date();
  return Math.floor((now - last) / 86400000);
}

function drFarmWOs(farm) {
  return (workOrders || []).filter(w => w.farm === farm && w.status !== 'completed');
}

function drTodayDeadTotal(farm) {
  const houses = DR_FARMS[farm].houses;
  let total = 0;
  for (let i = 1; i <= houses; i++) {
    const bw = drGetBW(farm, i);
    total += Number(bw?.mortCount || 0);
  }
  return total;
}

function drTodayHeadcount(farm) {
  const houses = DR_FARMS[farm].houses;
  let total = 0;
  for (let i = 1; i <= houses; i++) {
    const mw = drGetMW(farm, i);
    total += Number(mw?.eeCount || 0);
  }
  return total;
}

// ── PM stats for today ────────────────────────────────────────────────────────
function drPMStats(farm) {
  if (typeof ALL_PM === 'undefined' || !ALL_PM) return {total:0, done:0, overdue:0, dueSoon:0};
  const today = new Date().toISOString().slice(0,10);
  const farmPMs = ALL_PM.filter(t => !t.farm || t.farm === farm || t.farm === 'Both');
  const total   = farmPMs.length;
  let done = 0, overdue = 0, dueSoon = 0;
  farmPMs.forEach(t => {
    const s = typeof pmStatus === 'function' ? pmStatus(t.id) : 'ok';
    if (s === 'ok') {
      const c = pmComps && pmComps[t.id];
      if (c && c.date === today) done++;
    }
    if (s === 'overdue') overdue++;
    if (s === 'due-soon') dueSoon++;
  });
  return { total, done, overdue, dueSoon, farmPMs };
}

// ── PM section HTML — percentage-based, no long list ─────────────────────────
function drPMSection(farm) {
  const { total, done, overdue, dueSoon, farmPMs } = drPMStats(farm);

  if (!total) {
    return `<div style="background:#0a1f0a;border:1px solid #1a3a1a;border-radius:10px;padding:14px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2a5a2a;">No PMs scheduled for ${farm}</div>`;
  }

  // Headline metric: on-time % = (total - overdue) / total
  const onTimePct = Math.round(((total - overdue) / total) * 100);
  const donePct   = Math.round((done / total) * 100);
  const headColor = overdue === 0 ? '#4ade80' : onTimePct >= 90 ? '#fbbf24' : '#f87171';
  const headBg    = overdue === 0 ? '#0a1f0a' : onTimePct >= 90 ? '#1a1400' : '#1a0505';
  const headBorder= overdue === 0 ? '#166534' : onTimePct >= 90 ? '#854d0e' : '#7f1d1d';

  // Group overdue by system to surface the worst area without a long list
  const sysCounts = {};
  (farmPMs || []).forEach(t => {
    if (typeof pmStatus === 'function' && pmStatus(t.id) === 'overdue') {
      const sys = t.system || 'Other';
      sysCounts[sys] = (sysCounts[sys] || 0) + 1;
    }
  });
  const sysSorted = Object.entries(sysCounts).sort((a,b) => b[1] - a[1]);
  const topSys = sysSorted[0];

  // Stash overdue list for the optional drill-down toggle
  const overdueList = (farmPMs || []).filter(t => typeof pmStatus === 'function' && pmStatus(t.id) === 'overdue');
  const drillId = 'pm-drill-' + farm;

  return `
    <div style="background:${headBg};border:1.5px solid ${headBorder};border-radius:12px;padding:14px 16px;">

      <!-- Headline: big % + mini-stats row -->
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
        <div style="flex-shrink:0;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:42px;letter-spacing:1px;color:${headColor};line-height:1;">${onTimePct}<span style="font-size:22px;">%</span></div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${headColor};opacity:.8;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">On-Time Rate</div>
        </div>
        <div style="flex:1;min-width:200px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
          ${drPMMini('✓', done, 'Done', '#4ade80')}
          ${drPMMini('⚠', overdue, 'Overdue', overdue > 0 ? '#f87171' : '#2a5a2a')}
          ${drPMMini('⏰', dueSoon, 'Due Soon', dueSoon > 0 ? '#fbbf24' : '#2a5a2a')}
          ${drPMMini('Σ', total, 'Total', '#7ab0f6')}
        </div>
      </div>

      <!-- Progress bar (done today) -->
      <div style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
          <span>Today's Progress</span><span>${done}/${total} · ${donePct}%</span>
        </div>
        <div style="background:#0a1a0a;border-radius:4px;height:6px;overflow:hidden;">
          <div style="background:${donePct === 100 ? '#4ade80' : '#fbbf24'};width:${donePct}%;height:100%;transition:width .4s;border-radius:4px;"></div>
        </div>
      </div>

      ${overdue > 0 ? `
      <!-- Worst system bars -->
      <div style="margin-top:12px;padding-top:12px;border-top:1px dashed ${headBorder};">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#f87171;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">⚠ Where the misses are</div>
        ${sysSorted.slice(0,3).map(([sys, n]) => {
          const sysTotal = (farmPMs || []).filter(t => (t.system || 'Other') === sys).length;
          const pct = sysTotal > 0 ? Math.round((n / sysTotal) * 100) : 0;
          return `
            <div style="margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#fca5a5;margin-bottom:3px;">
                <span>${sys}</span><span>${n}/${sysTotal} overdue · ${pct}%</span>
              </div>
              <div style="background:#0a0505;border-radius:3px;height:5px;overflow:hidden;">
                <div style="background:#f87171;width:${pct}%;height:100%;border-radius:3px;"></div>
              </div>
            </div>`;
        }).join('')}
        <div style="margin-top:10px;text-align:center;">
          <button onclick="drToggleOverdue('${drillId}')" style="background:transparent;border:1px solid ${headBorder};color:#fca5a5;border-radius:6px;padding:6px 14px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:1px;cursor:pointer;">Show overdue list ▾</button>
        </div>
        <div id="${drillId}" style="display:none;margin-top:10px;">
          ${overdueList.map(t => `
            <div style="background:#1a0505;border:1px solid #7f1d1d;border-radius:6px;padding:6px 10px;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;" onclick="go('maint');setTimeout(()=>goMaintSection('pm'),50);">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fca5a5;">${t.name}</div>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#7a3a3a;white-space:nowrap;">${t.system||''}${t.house?' · H'+t.house:''}</span>
            </div>`).join('')}
        </div>
      </div>` : `
      <div style="margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4ade80;text-align:center;">All PMs on schedule${dueSoon > 0 ? ` — ${dueSoon} due soon` : ''}</div>`}

    </div>`;
}

// Tiny stat for PM section
function drPMMini(icon, value, label, color) {
  return `
    <div style="background:#0a1a0a;border:1px solid ${color}33;border-radius:8px;padding:8px 6px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${color};line-height:1;">${value}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${color};opacity:.8;margin-top:3px;letter-spacing:1px;text-transform:uppercase;">${label}</div>
    </div>`;
}

// Drill-down toggle for overdue list
function drToggleOverdue(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function drWalksComplete(farm) {
  const houses = DR_FARMS[farm].houses;
  let done = 0;
  for (let i = 1; i <= houses; i++) {
    if (drGetMW(farm, i)) done++;
  }
  return done;
}

// ── Main render ──────────────────────────────────────────────────────────────
function drRender() {
  const el = document.getElementById('panel-daily');
  if (!el) return;

  const today = new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
  const safeDays = drSafeDays();
  const farm = _drFarm;
  const cfg  = DR_FARMS[farm];
  const woList = drFarmWOs(farm);
  const openCount = woList.length;
  const urgentCount = woList.filter(w => w.priority === 'urgent').length;
  const deadTotal = drTodayDeadTotal(farm);
  const headcount = drTodayHeadcount(farm);
  const walksComplete = drWalksComplete(farm);
  const totalHouses = cfg.houses;

  // EOS sub-section state
  const SECT = {
    production:  { label:'🐔 Production / Barns', color:'#16a34a', border:'#4ade80' },
    maintenance: { label:'🔧 Maintenance / Shop', color:'#fbbf24', border:'#fbbf24' },
    '5s':        { label:'5️⃣ 5S Audit',           color:'#a855f7', border:'#c084fc' }
  };
  const section = _drSection;

  // % completions
  const walkPct  = Math.round((walksComplete / Math.max(totalHouses,1)) * 100);
  const pmStats  = drPMStats(farm);
  const pmPct    = pmStats.total ? Math.round(((pmStats.total - pmStats.overdue) / pmStats.total) * 100) : 100;
  const audit5s  = (typeof _dr5SAudits !== 'undefined' && _dr5SAudits?.[farm]) || null;
  const auditPct = audit5s?.total != null ? Math.round((audit5s.total / 25) * 100) : null;

  el.innerHTML = `
  <div style="max-width:960px;margin:0 auto;padding:0 0 60px 0;">

    <div style="padding:18px 16px 10px 16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:4px;">Daily End-of-Shift Report · ${today}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:#e8f5ec;">BARN & MAINTENANCE REPORT</div>
    </div>

    <div style="display:flex;gap:8px;padding:0 16px 10px 16px;border-bottom:1.5px solid #1a3a1a;">
      ${Object.keys(DR_FARMS).map(f => `
        <button onclick="drSwitchFarm('${f}')"
          style="padding:9px 22px;border-radius:8px;border:2px solid ${f===farm ? DR_FARMS[f].border : '#2a5a2a'};
                 background:${f===farm ? DR_FARMS[f].color+'22' : 'transparent'};
                 color:${f===farm ? '#fff' : '#7ab07a'};
                 font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;
                 letter-spacing:1px;text-transform:uppercase;transition:all .15s;">
          ${f} <span style="font-size:10px;opacity:.7;">(${DR_FARMS[f].houses} houses)</span>
        </button>`).join('')}
    </div>

    <div style="display:flex;gap:6px;padding:10px 16px 14px 16px;flex-wrap:wrap;">
      ${Object.keys(SECT).map(s => `
        <button onclick="drSwitchSection('${s}')"
          style="padding:8px 16px;border-radius:8px;border:2px solid ${s===section ? SECT[s].border : '#2a5a2a'};
                 background:${s===section ? SECT[s].color+'22' : 'transparent'};
                 color:${s===section ? '#fff' : '#7ab07a'};
                 font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;
                 letter-spacing:1px;transition:all .15s;">
          ${SECT[s].label}
        </button>`).join('')}
    </div>

    ${section === 'production' ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:0 16px 14px 16px;">
        ${drStatCard('🏠', walkPct + '%', `Walks ${walksComplete}/${totalHouses}`,
            walkPct === 100 ? '#1b5e20' : walkPct >= 50 ? '#856404' : '#7f1d1d',
            walkPct === 100 ? '#4ade80' : walkPct >= 50 ? '#fbbf24' : '#f87171')}
        ${drStatCard('💀', deadTotal, 'Dead Birds Today',
            deadTotal === 0 ? '#1b5e20' : deadTotal > 20 ? '#7f1d1d' : '#856404',
            deadTotal === 0 ? '#4ade80' : deadTotal > 20 ? '#f87171' : '#fbbf24')}
        ${drStatCard('👥', headcount > 0 ? headcount.toLocaleString() : '—', 'Headcount', '#0d2a4a', '#7ab0f6')}
      </div>
      <div style="padding:0 16px 6px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
          🏠 HOUSE DATA — ${farm.toUpperCase()} (Today)
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">
          ${Array.from({length: totalHouses}, (_,i) => drHouseCard(farm, i+1)).join('')}
        </div>
      </div>
      <div style="padding:20px 16px 30px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
          ✅ PRODUCTION SUBMIT — END-OF-SHIFT
        </div>
        <div id="dr-signoff-${farm}">${drSignoffPanel(farm)}</div>
      </div>
    ` : ''}

    ${section === 'maintenance' ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:0 16px 14px 16px;">
        ${drStatCard('🔧', openCount, 'Open WOs' + (urgentCount > 0 ? ` (${urgentCount} 🚨)` : ''),
            openCount === 0 ? '#1b5e20' : urgentCount > 0 ? '#7f1d1d' : '#856404',
            openCount === 0 ? '#4ade80' : urgentCount > 0 ? '#f87171' : '#fbbf24')}
        ${drStatCard('📋', pmPct + '%', `PM On-Time ${pmStats.done}/${pmStats.total}`,
            pmPct === 100 ? '#1b5e20' : pmPct >= 90 ? '#856404' : '#7f1d1d',
            pmPct === 100 ? '#4ade80' : pmPct >= 90 ? '#fbbf24' : '#f87171')}
        ${safeDays !== null
          ? drStatCard('🛡️', safeDays, 'Safe Days',
              safeDays >= 30 ? '#1b5e20' : safeDays >= 7 ? '#856404' : '#7f1d1d',
              safeDays >= 30 ? '#4ade80' : safeDays >= 7 ? '#fbbf24' : '#f87171')
          : drStatCard('🛡️', 'Set Date', 'Safe Days', '#0f2a0f', '#4a8a4a')}
      </div>
      <div style="padding:0 16px 14px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:'IBM Plex Mono',monospace;font-size:10px;">
        ${_drSafetySettings.lastIncidentDate
          ? `<span style="color:#4a8a4a;">Last incident: ${_drSafetySettings.lastIncidentDate}</span>`
          : `<button onclick="drSetSafeDayStart()" style="padding:4px 10px;background:#0a1f0a;border:1px solid #2a5a2a;border-radius:5px;color:#4ade80;font-family:inherit;font-size:10px;font-weight:600;cursor:pointer;">▶ Set start date</button>`}
        <button onclick="drResetSafeDays()" style="padding:4px 10px;background:transparent;border:1px solid #7f1d1d;border-radius:5px;color:#f87171;font-family:inherit;font-size:10px;font-weight:600;cursor:pointer;margin-left:auto;">⚠ Log incident</button>
      </div>
      <div style="padding:0 16px 6px 16px;">
        ${(()=>{try{return typeof ehRenderHoursBlock==='function'?ehRenderHoursBlock(farm):'';}catch(e){console.error('hours block error:',e);return '<div style="color:#f87171;font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:8px;">Hours block failed: '+e.message+'</div>';}})()}
      </div>
      <div style="padding:6px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
          🔧 OPEN WORK ORDERS — ${farm.toUpperCase()}
          <span style="margin-left:8px;background:#1a3a1a;border-radius:4px;padding:2px 8px;font-size:9px;">${openCount} open</span>
        </div>
        ${(()=>{try{return drWOList(woList);}catch(e){console.error('WO list error:',e);return '<div style="color:#f87171;">WO list failed: '+e.message+'</div>';}})()}
      </div>
      <div style="padding:20px 16px 6px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;">📋 PM TODAY</div>
          <span onclick="go('maint');setTimeout(()=>goMaintSection('pm'),50);" style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4ade80;cursor:pointer;text-decoration:underline;">View PM Schedule →</span>
        </div>
        ${(()=>{try{return drPMSection(farm);}catch(e){console.error('PM section error:',e);return '<div style="color:#f87171;">PM section failed: '+e.message+'</div>';}})()}
      </div>
      <div style="padding:20px 16px 30px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
          ✅ MAINTENANCE SUBMIT — END-OF-SHIFT
        </div>
        <div id="dr-signoff-${farm}">${drSignoffPanel(farm)}</div>
      </div>
    ` : ''}

    ${section === '5s' ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:0 16px 14px 16px;">
        ${drStatCard('5️⃣', auditPct != null ? auditPct + '%' : '—', '5S Score',
            auditPct == null ? '#0f2a0f' : auditPct >= 80 ? '#1b5e20' : auditPct >= 60 ? '#856404' : '#7f1d1d',
            auditPct == null ? '#4a8a4a' : auditPct >= 80 ? '#4ade80' : auditPct >= 60 ? '#fbbf24' : '#f87171')}
      </div>
      <div style="padding:0 16px 6px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;">5️⃣ 5S DAILY AUDIT — ${farm.toUpperCase()}</div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a5a2a;">${getWeekFocusLabel().split('·')[0].replace(/^[^:]+:/,'').trim()}</span>
        </div>
        ${dr5SAuditPanel(farm)}
        <div style="margin-top:10px;">
          ${typeof drRedTagWidget === 'function' ? drRedTagWidget(farm) : ''}
        </div>
      </div>
      <div style="padding:20px 16px 6px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;">📋 5S & IMPROVEMENT PROJECTS</div>
          <button onclick="drOpenAddProject()" style="padding:6px 14px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:6px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:1px;">+ ADD TASK</button>
        </div>
        ${drProjectList(farm)}
      </div>
      <div style="padding:20px 16px 30px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
          ✅ 5S SUBMIT
        </div>
        <div id="dr-signoff-${farm}">${drSignoffPanel(farm)}</div>
      </div>
    ` : ''}

    <div style="margin:24px 16px 0;padding-top:18px;border-top:2px dashed #2a5a2a;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:3px;color:#4ade80;text-align:center;margin-bottom:6px;">EOS — L10 TO-DOS</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;text-align:center;letter-spacing:1px;">7-day clock action items</div>
    </div>
    <div id="eos-todos-host">${typeof renderTodosSection === 'function' ? renderTodosSection() : ''}</div>

  </div>

  ${drAddProjectModal()}
  `;
}

// ── Stat card helper ─────────────────────────────────────────────────────────
function drStatCard(icon, value, label, bg, textColor) {
  return `
    <div style="background:${bg};border:1.5px solid ${textColor}33;border-radius:12px;padding:14px 12px;text-align:center;">
      <div style="font-size:20px;margin-bottom:4px;">${icon}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${textColor};line-height:1;">${value}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${textColor};opacity:.7;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">${label}</div>
    </div>`;
}

// ── House card ───────────────────────────────────────────────────────────────
function drHouseCard(farm, house) {
  const mw = drGetMW(farm, house);
  const bw = drGetBW(farm, house);

  const walked    = !!mw;
  const psi       = mw ? mw.waterPSI : null;
  const temp      = mw ? mw.temp : null;
  const feed      = mw ? mw.feedMeterReading : null;
  const headcount = mw ? mw.eeCount : null;
  const feedOk    = mw ? mw.feed : null;
  const fansOk    = mw ? mw.fans : null;
  const dead      = bw ? Number(bw.mortCount || 0) : null;
  const binA      = bw && bw.binA !== undefined && bw.binA !== null ? Number(bw.binA) : null;
  const binB      = bw && bw.binB !== undefined && bw.binB !== null ? Number(bw.binB) : null;
  const flags     = mw ? (mw.flags || []) : [];

  const psiAlert  = psi !== null && (psi < 10 || psi > 60);
  const deadAlert = dead !== null && dead > 10;
  const binALow   = binA !== null && binA < 2;
  const binBLow   = binB !== null && binB < 2;
  const hasFlag   = flags.length > 0 || psiAlert || deadAlert || feedOk==='no' || fansOk==='no' || binALow || binBLow;

  const cardBg     = !walked ? '#0f1a0f' : hasFlag ? '#1a0a00' : '#0a1f0a';
  const cardBorder = !walked ? '#1a3a1a' : hasFlag ? '#854d0e' : '#166534';
  const statusDot  = !walked ? '#4a8a4a' : hasFlag ? '#f59e0b' : '#4ade80';

  const psiColor   = psiAlert ? '#f87171' : '#7ab0f6';
  const deadColor  = deadAlert ? '#f87171' : dead > 0 ? '#fbbf24' : '#4ade80';

  return `
    <div style="background:${cardBg};border:1.5px solid ${cardBorder};border-radius:12px;padding:12px 14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#e8f5ec;">House ${house}</div>
        <div style="width:9px;height:9px;border-radius:50%;background:${statusDot};flex-shrink:0;" title="${!walked?'Not walked':hasFlag?'Issues flagged':'All clear'}"></div>
      </div>

      ${walked ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          ${drMiniStat('💧 PSI', psi !== null ? psi : '—', psiColor)}
          ${drMiniStat('🌡 Temp', temp ? temp + '°F' : '—', '#fbbf24')}
          ${drMiniStat('💀 Dead', dead !== null ? dead : '—', deadColor)}
          ${headcount ? drMiniStat('👥 Count', Number(headcount).toLocaleString(), '#7ab0f6') : ''}
          ${drMiniStat('🌾 Bin A', binA !== null ? binA + 't' : '—', binALow ? '#f87171' : '#a78bfa')}
          ${drMiniStat('🌾 Bin B', binB !== null ? binB + 't' : '—', binBLow ? '#f87171' : '#a78bfa')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
          ${drSystemPill('Feeders', feedOk)}
          ${drSystemPill('Fans', fansOk)}
          ${binALow ? `<span style="background:#7f1d1d;color:#f87171;border-radius:4px;padding:2px 7px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">⚠ BIN A LOW</span>` : ''}
          ${binBLow ? `<span style="background:#7f1d1d;color:#f87171;border-radius:4px;padding:2px 7px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">⚠ BIN B LOW</span>` : ''}
        </div>
        ${flags.length > 0 ? `
          <div style="background:#2d1500;border:1px solid #7c3a00;border-radius:6px;padding:6px 8px;margin-top:6px;">
            ${flags.map(f=>`<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#fbbf24;line-height:1.6;">⚠ ${f}</div>`).join('')}
          </div>` : ''}
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;margin-top:8px;">
          Walked ${mw.time || ''} by ${mw.employee || '—'}
        </div>
      ` : `
        <div style="text-align:center;padding:14px 0;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#2a5a2a;letter-spacing:1px;">
          Not walked yet
        </div>
      `}
    </div>`;
}

function drMiniStat(label, value, color) {
  return `
    <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:6px;padding:6px 8px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a8a4a;margin-bottom:2px;">${label}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:${color};">${value}</div>
    </div>`;
}

function drSystemPill(label, val) {
  const ok    = val === 'yes';
  const notOk = val === 'no';
  const bg    = ok ? '#14532d' : notOk ? '#7f1d1d' : '#1a3a1a';
  const color = ok ? '#4ade80' : notOk ? '#f87171' : '#4a8a4a';
  const icon  = ok ? '✓' : notOk ? '✗' : '?';
  return `<span style="background:${bg};color:${color};border-radius:4px;padding:2px 7px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${icon} ${label}</span>`;
}

// ── Work order list ──────────────────────────────────────────────────────────
function drWOList(wos) {
  if (!wos.length) {
    return `<div style="background:#0a1f0a;border:1px solid #1a3a1a;border-radius:10px;padding:16px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2a5a2a;">✓ No open work orders</div>`;
  }
  const priColor = {urgent:'#f87171',high:'#fbbf24',normal:'#7ab0f6',routine:'#a78bfa',low:'#4a8a4a'};
  return wos.slice(0,8).map(wo => `
    <div style="background:#0d1a0d;border:1.5px solid ${wo.priority==='urgent'?'#7f1d1d':wo.priority==='high'?'#854d0e':'#1a3a1a'};border-radius:10px;padding:10px 12px;margin-bottom:7px;display:flex;align-items:flex-start;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#7ab0f6;">${wo.id}</span>
          <span style="background:${priColor[wo.priority]||'#4a8a4a'}22;color:${priColor[wo.priority]||'#4a8a4a'};border-radius:4px;padding:1px 6px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;text-transform:uppercase;">${wo.priority}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">${wo.house ? 'H'+wo.house : ''}</span>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#c8e6c9;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${wo.desc || wo.problem || ''}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;margin-top:2px;">Tech: ${wo.tech||'Unassigned'} · ${wo.status}</div>
      </div>
    </div>`).join('') +
  (wos.length > 8 ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;text-align:center;padding:8px;">+${wos.length - 8} more — <span onclick="go('maint')" style="color:#4ade80;cursor:pointer;text-decoration:underline;">View all in Maintenance</span></div>` : '');
}

// ── Project list ─────────────────────────────────────────────────────────────
function drProjectList(farm) {
  const farmProjects = _drProjects.filter(p => p.farm === farm || p.farm === 'All');

  // Group by focus: 5S this week, Improvement next week, others
  const now = new Date();
  const weekLabel = getWeekFocusLabel();

  const active = farmProjects.filter(p => p.status !== 'Complete');
  const done   = farmProjects.filter(p => p.status === 'Complete');

  if (!farmProjects.length) {
    return `<div style="background:#0a1f0a;border:1px solid #1a3a1a;border-radius:10px;padding:20px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2a5a2a;">No projects yet — tap + ADD TASK to get started</div>`;
  }

  return `
    <div style="background:#091209;border:1px solid #1a3a1a;border-radius:4px;padding:6px 10px;margin-bottom:10px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4ade80;letter-spacing:1px;">
      ${weekLabel}
    </div>
    ${active.map(p => drProjectCard(p)).join('')}
    ${done.length > 0 ? `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a5a2a;letter-spacing:1px;margin:12px 0 6px 0;text-transform:uppercase;">✓ Completed (${done.length})</div>
      ${done.map(p => drProjectCard(p)).join('')}` : ''}`;
}

function getWeekFocusLabel() {
  // Determine if this week is 5S or Improvement based on week number
  const weekNum = Math.ceil(new Date().getDate() / 7);
  const isEvenWeek = weekNum % 2 === 0;
  return isEvenWeek
    ? '📋 THIS WEEK: 5S (Sort · Set · Shine · Standardize · Sustain)  ·  NEXT WEEK: Improvement Projects'
    : '🔧 THIS WEEK: Improvement Projects  ·  NEXT WEEK: 5S Audit';
}

function drProjectCard(p) {
  const priColor = {Critical:'#f87171',Urgent:'#fbbf24',Planned:'#4ade80'};
  const statusBg = {Complete:'#14532d','In Progress':'#1e3a00','Not Started':'#0f1a0f'};
  const statusColor = {Complete:'#4ade80','In Progress':'#a3e635','Not Started':'#4a8a4a'};

  return `
    <div style="background:${statusBg[p.status]||'#0f1a0f'};border:1.5px solid #1a3a1a;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#e8f5ec;">${p.task}</span>
          ${p.focus ? `<span style="background:#1a3a5a;color:#7ab0f6;border-radius:4px;padding:1px 7px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${p.focus}</span>` : ''}
          ${p.priority ? `<span style="background:${priColor[p.priority]||'#4a8a4a'}22;color:${priColor[p.priority]||'#4a8a4a'};border-radius:4px;padding:1px 6px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${p.priority}</span>` : ''}
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">${p.area || ''}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">Owner: ${p.owner || '—'}</span>
          ${p.dueDate ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">Due: ${p.dueDate}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
        <span style="background:${statusColor[p.status]||'#4a8a4a'}22;color:${statusColor[p.status]||'#4a8a4a'};border-radius:4px;padding:2px 8px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${p.status}</span>
        <div style="display:flex;gap:5px;">
          ${p.status !== 'Complete'
            ? `<button onclick="drMarkComplete('${p._fbId}')" style="padding:3px 8px;background:#14532d;border:1px solid #166534;border-radius:4px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;">✓</button>`
            : ''}
          <button onclick="drDeleteProject('${p._fbId}')" style="padding:3px 7px;background:#2d0000;border:1px solid #7f1d1d;border-radius:4px;color:#f87171;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;">✕</button>
        </div>
      </div>
    </div>`;
}

// ── 5S Audit Panel ────────────────────────────────────────────────────────────
// Score each S from 1–5; saves to Firestore 5sAudits collection

const DR_5S_ITEMS = [
  { key:'sort',        label:'Sort (Seiri)',        icon:'🗑️', desc:'Remove unneeded items' },
  { key:'set',         label:'Set In Order (Seiton)',icon:'📦', desc:'Everything in its place' },
  { key:'shine',       label:'Shine (Seiso)',        icon:'✨', desc:'Clean & inspect' },
  { key:'standardize', label:'Standardize (Seiketsu)',icon:'📋', desc:'Consistent practices' },
  { key:'sustain',     label:'Sustain (Shitsuke)',   icon:'♻️', desc:'Maintain the habit' }
];

let _dr5SState = {};   // { farm: { sort:3, set:4, ... } }
let _dr5SAudits = {};  // today's saved audits by farm

async function dr5SLoadTodayAudit(farm) {
  const today = new Date().toISOString().slice(0,10);
  const key   = farm + '-' + today;
  try {
    const doc = await db.collection('5sAudits').doc(key).get();
    if (doc.exists) {
      _dr5SAudits[farm] = doc.data();
      _dr5SState[farm]  = doc.data().scores || {};
    }
  } catch(e) { console.warn('5S load:', e); }
}

function dr5SAuditPanel(farm) {
  const today  = new Date().toISOString().slice(0,10);
  const saved  = _dr5SAudits[farm];
  const scores = _dr5SState[farm] || {};
  const total  = DR_5S_ITEMS.reduce((s,item) => s + Number(scores[item.key]||0), 0);
  const max    = DR_5S_ITEMS.length * 5;
  const pct    = max > 0 ? Math.round((total/max)*100) : 0;
  const barColor = pct >= 80 ? '#4ade80' : pct >= 60 ? '#fbbf24' : '#f87171';

  // Load audit if not loaded yet
  if (!_dr5SAudits[farm] && !window['_5sLoading_'+farm]) {
    window['_5sLoading_'+farm] = true;
    dr5SLoadTodayAudit(farm).then(() => {
      window['_5sLoading_'+farm] = false;
      const panel = document.getElementById('dr-5s-panel-' + farm);
      if (panel) panel.outerHTML = dr5SAuditPanel(farm);
    });
  }

  return `
  <div id="dr-5s-panel-${farm}">
    ${saved ? `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <div style="flex:1;background:#0a1a0a;border-radius:4px;height:6px;overflow:hidden;">
        <div style="background:${barColor};width:${pct}%;height:100%;border-radius:4px;transition:width .4s;"></div>
      </div>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:${barColor};">${total}/${max}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;">Submitted ${saved.submittedBy||''}${saved.submittedBy?' ':''}${saved.time||''}</span>
      <button onclick="dr5SEdit('${farm}')" style="padding:4px 10px;background:#0a1a0a;border:1px solid #2a5a2a;border-radius:5px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;">Edit</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:7px;">
      ${DR_5S_ITEMS.map(item => {
        const score = Number(saved.scores?.[item.key] || 0);
        const sc = score >= 4 ? '#4ade80' : score >= 3 ? '#fbbf24' : score > 0 ? '#f87171' : '#4a8a4a';
        return `
        <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:8px;padding:8px 10px;">
          <div style="font-size:14px;margin-bottom:3px;">${item.icon}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;text-transform:uppercase;margin-bottom:3px;">${item.label.split(' ')[0]}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${sc};">${score > 0 ? score : '—'}<span style="font-size:9px;opacity:.5;">/5</span></div>
        </div>`;
      }).join('')}
    </div>` : `
    <!-- Audit form -->
    <div style="background:#091209;border:1px solid #1a3a1a;border-radius:10px;padding:14px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;margin-bottom:12px;letter-spacing:1px;">Score each area 1 (poor) → 5 (excellent)</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${DR_5S_ITEMS.map(item => `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:16px;flex-shrink:0;">${item.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#c8e6c9;font-weight:600;">${item.label.split(' ')[0]}</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a5a2a;">${item.desc}</div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;">
              ${[1,2,3,4,5].map(n => `
                <button id="5s-${farm}-${item.key}-${n}"
                  onclick="dr5SScore('${farm}','${item.key}',${n})"
                  style="width:28px;height:28px;border-radius:6px;border:1.5px solid #1a3a1a;background:#0a1a0a;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;transition:all .1s;">
                  ${n}
                </button>`).join('')}
            </div>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;align-items:center;">
        <input id="5s-who-${farm}" type="text" placeholder="Your name"
          style="flex:1;padding:8px 10px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:7px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;" />
        <button onclick="dr5SSubmit('${farm}')"
          style="padding:8px 16px;background:#1a4a1a;border:2px solid #4ade80;border-radius:8px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:1px;">
          ✓ SUBMIT
        </button>
      </div>
    </div>`}
  </div>`;
}

function dr5SScore(farm, key, val) {
  if (!_dr5SState[farm]) _dr5SState[farm] = {};
  _dr5SState[farm][key] = val;
  // Highlight selected button
  DR_5S_ITEMS.forEach(item => {
    [1,2,3,4,5].forEach(n => {
      const btn = document.getElementById(`5s-${farm}-${item.key}-${n}`);
      if (!btn) return;
      const isSelected = _dr5SState[farm][item.key] === n;
      btn.style.background = isSelected ? '#1a4a1a' : '#0a1a0a';
      btn.style.borderColor = isSelected ? '#4ade80' : '#1a3a1a';
      btn.style.color       = isSelected ? '#4ade80' : '#4a8a4a';
    });
  });
}

async function dr5SSubmit(farm) {
  const scores = _dr5SState[farm] || {};
  const filled = DR_5S_ITEMS.filter(item => scores[item.key] > 0).length;
  if (filled < DR_5S_ITEMS.length) {
    alert('Please score all 5 areas before submitting.');
    return;
  }
  const who   = document.getElementById('5s-who-' + farm)?.value.trim() || 'Team';
  const today = new Date().toISOString().slice(0,10);
  const time  = new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'});
  const key   = farm + '-' + today;
  const total = DR_5S_ITEMS.reduce((s,item) => s + Number(scores[item.key]||0), 0);
  const max   = DR_5S_ITEMS.length * 5;

  try {
    await db.collection('5sAudits').doc(key).set({
      farm, date: today, time, submittedBy: who,
      scores, total, max,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    _dr5SAudits[farm] = { farm, date:today, time, submittedBy:who, scores, total, max };
    // Re-render 5S panel only
    const panel = document.getElementById('dr-5s-panel-' + farm);
    if (panel) panel.outerHTML = dr5SAuditPanel(farm);
  } catch(e) {
    alert('Save failed: ' + e.message);
  }
}

function dr5SEdit(farm) {
  delete _dr5SAudits[farm];
  const panel = document.getElementById('dr-5s-panel-' + farm);
  if (panel) panel.outerHTML = dr5SAuditPanel(farm);
}

// ── Add Project Modal ────────────────────────────────────────────────────────
function drAddProjectModal() {
  return `
  <div id="dr-project-modal" style="display:none;position:fixed;inset:0;background:#000a;z-index:9999;align-items:center;justify-content:center;padding:20px;">
    <div style="background:#0f1a0f;border:2px solid #2a5a2a;border-radius:16px;padding:24px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#4ade80;letter-spacing:2px;margin-bottom:18px;">+ ADD PROJECT TASK</div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        ${drFormField('Task / Description', 'dr-task', 'text', 'e.g. Sort & remove red tags from House 3')}
        ${drFormField('House / Area', 'dr-area', 'text', 'e.g. House 2, Feed Room')}
        ${drFormField('Owner', 'dr-owner', 'text', 'Who is responsible')}
        ${drFormField('Due Date', 'dr-due', 'date', '')}

        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Farm</div>
          <select id="dr-farm-sel" style="width:100%;padding:10px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;">
            <option value="Danville">Danville</option>
            <option value="Hegins">Hegins</option>
            <option value="All">Both Farms</option>
          </select>
        </div>

        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Focus</div>
          <select id="dr-focus" style="width:100%;padding:10px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;">
            <option value="5S">5S</option>
            <option value="Improvement">Improvement</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Safety">Safety</option>
          </select>
        </div>

        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Priority</div>
          <select id="dr-priority" style="width:100%;padding:10px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;">
            <option value="Planned">Planned</option>
            <option value="Urgent">Urgent</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;">
        <button onclick="drSaveProject()" style="flex:1;padding:12px;background:#1a4a1a;border:2px solid #4ade80;border-radius:10px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:1px;">✓ SAVE TASK</button>
        <button onclick="drCloseAddProject()" style="padding:12px 18px;background:#1a0a0a;border:1.5px solid #4a2a2a;border-radius:10px;color:#f87171;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">✕</button>
      </div>
    </div>
  </div>`;
}

function drFormField(label, id, type, placeholder) {
  return `
    <div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">${label}</div>
      <input id="${id}" type="${type}" placeholder="${placeholder}"
        style="width:100%;box-sizing:border-box;padding:10px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
    </div>`;
}

// ── Actions ──────────────────────────────────────────────────────────────────
function drSwitchFarm(farm) {
  _drFarm = farm;
  drRender();
}

function drOpenAddProject() {
  const modal = document.getElementById('dr-project-modal');
  if (modal) {
    modal.style.display = 'flex';
    const sel = document.getElementById('dr-farm-sel');
    if (sel) sel.value = _drFarm;
  }
}

function drCloseAddProject() {
  const modal = document.getElementById('dr-project-modal');
  if (modal) modal.style.display = 'none';
}

async function drSaveProject() {
  const task     = document.getElementById('dr-task')?.value.trim();
  const area     = document.getElementById('dr-area')?.value.trim();
  const owner    = document.getElementById('dr-owner')?.value.trim();
  const dueDate  = document.getElementById('dr-due')?.value;
  const farm     = document.getElementById('dr-farm-sel')?.value || _drFarm;
  const focus    = document.getElementById('dr-focus')?.value || '5S';
  const priority = document.getElementById('dr-priority')?.value || 'Planned';

  if (!task) { alert('Please enter a task description.'); return; }

  try {
    await db.collection('dailyProjects').add({
      task, area, owner, dueDate, farm, focus, priority,
      status: 'Not Started',
      createdTs: Date.now(),
      createdDate: new Date().toISOString().slice(0,10)
    });
    drCloseAddProject();
    // Clear fields
    ['dr-task','dr-area','dr-owner','dr-due'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch(e) {
    alert('Error saving task: ' + e.message);
    console.error(e);
  }
}

async function drMarkComplete(fbId) {
  try {
    await db.collection('dailyProjects').doc(fbId).update({
      status: 'Complete',
      completedDate: new Date().toISOString().slice(0,10)
    });
  } catch(e) { console.error(e); }
}

async function drDeleteProject(fbId) {
  if (!confirm('Remove this task?')) return;
  try {
    await db.collection('dailyProjects').doc(fbId).delete();
  } catch(e) { console.error(e); }
}

async function drResetSafeDays() {
  if (!confirm('Record an incident today? This will reset the safe days counter to 0.')) return;
  const today = new Date().toISOString().slice(0,10);
  try {
    await db.collection('safetySettings').doc('main').set({
      lastIncidentDate: today,
      updatedTs: Date.now()
    }, { merge: true });
    _drSafetySettings = { lastIncidentDate: today };
    drRender();
  } catch(e) { console.error(e); }
}

async function drSetSafeDayStart() {
  const date = prompt('Enter the date of the last safety incident (YYYY-MM-DD), or leave blank to start counting from today:');
  const useDate = (date && date.match(/^\d{4}-\d{2}-\d{2}/)) ? date.trim() : new Date().toISOString().slice(0,10);
  try {
    await db.collection('safetySettings').doc('main').set({
      lastIncidentDate: useDate,
      updatedTs: Date.now()
    }, { merge: true });
    _drSafetySettings = { lastIncidentDate: useDate };
    drRender();
  } catch(e) { console.error(e); }
}

function drSwitchSection(s) {
  _drSection = s;
  drRender();
}
window.drSwitchSection = drSwitchSection;
