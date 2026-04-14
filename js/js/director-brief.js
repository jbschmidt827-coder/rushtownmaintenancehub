// ═══════════════════════════════════════════════════════════════════════
// DIRECTOR'S DAILY BRIEF
// Real-time escalation dashboard — both farms, one screen
// Thresholds: PSI < 10 or > 60, dead birds > 15/house, PMs overdue,
//             urgent WOs, houses not walked by 10am, contractor spend
// ═══════════════════════════════════════════════════════════════════════

let _dbMorningWalks = [];
let _dbBarnWalks    = [];
let _dbSafety       = {};
let _dbLoaded       = false;

// ── Thresholds (tweak here) ───────────────────────────────────────────────────
const DB_THRESH = {
  psiLow:       10,
  psiHigh:      60,
  deadPerHouse: 15,    // red flag per house
  walkedByHour: 10,    // houses should be walked by 10am
  contractorWeekly: 2000  // flag if this week's spend exceeds $
};

// ── Entry point ───────────────────────────────────────────────────────────────
async function renderDirectorBrief() {
  const el = document.getElementById('panel-brief');
  if (!el) return;
  el.innerHTML = `<div style="padding:32px;text-align:center;font-family:'IBM Plex Mono',monospace;color:#4a8a4a;font-size:13px;letter-spacing:1px;">Loading brief…</div>`;
  try {
    await dbLoadData();
    dbRender();
  } catch(e) {
    el.innerHTML = `<div style="padding:24px;color:#ef4444;font-family:'IBM Plex Mono',monospace;">Error: ${e.message}</div>`;
    console.error('Director Brief error:', e);
  }
}

// ── Load today's data ─────────────────────────────────────────────────────────
async function dbLoadData() {
  const today = new Date().toISOString().slice(0,10);
  // 8 weeks back for trend charts
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const sinceDate = eightWeeksAgo.toISOString().slice(0,10);

  const [mwSnap, bwSnap, bwHistSnap, safetySnap] = await Promise.all([
    db.collection('morningWalks').where('date','==',today).get(),
    db.collection('barnWalks').where('date','==',today).get(),
    db.collection('barnWalks').where('date','>=',sinceDate).where('date','<',today).limit(500).get(),
    db.collection('safetySettings').doc('main').get()
  ]);
  _dbMorningWalks = mwSnap.docs.map(d => d.data());
  // Combine today + history for trend calculations
  const todayBW   = bwSnap.docs.map(d => d.data());
  const histBW    = bwHistSnap.docs.map(d => d.data());
  _dbBarnWalks    = [...todayBW, ...histBW];
  _dbSafety       = safetySnap.exists ? safetySnap.data() : {};
  _dbLoaded       = true;

  // Live refresh
  if (!window._dbListening) {
    window._dbListening = true;
    db.collection('morningWalks').where('date','==',today).onSnapshot(snap => {
      _dbMorningWalks = snap.docs.map(d => d.data());
      if (document.getElementById('panel-brief')?.classList.contains('active')) dbRender();
    });
    db.collection('barnWalks').where('date','==',today).onSnapshot(snap => {
      _dbBarnWalks = snap.docs.map(d => d.data());
      if (document.getElementById('panel-brief')?.classList.contains('active')) dbRender();
    });
  }
}

// ── Escalation engine ─────────────────────────────────────────────────────────
function dbBuildAlerts() {
  const alerts = { critical: [], warning: [], ok: [] };
  const now = new Date();
  const hour = now.getHours();
  const today = now.toISOString().slice(0,10);
  const farms = { Danville: 5, Hegins: 8 };
  // Use only today's data for alerts
  const todayMW = _dbMorningWalks.filter(w => w.date === today || !w.date);
  const todayBW = _dbBarnWalks.filter(w => w.date === today);

  Object.entries(farms).forEach(([farm, houses]) => {
    for (let h = 1; h <= houses; h++) {
      const mw = todayMW.find(w => w.farm === farm && String(w.house) === String(h));
      const bw = todayBW.find(w => w.farm === farm && String(w.house) === String(h));

      // House not walked
      if (!mw) {
        const level = hour >= DB_THRESH.walkedByHour ? 'warning' : 'ok';
        alerts[level].push({ icon:'🏠', farm, house:h, msg:`House ${h} not walked yet`, action: `go('prod')` });
      } else {
        // PSI
        const psi = Number(mw.waterPSI);
        if (!isNaN(psi) && psi < DB_THRESH.psiLow) {
          alerts.critical.push({ icon:'💧', farm, house:h, msg:`H${h} water PSI critical: ${psi} PSI (< ${DB_THRESH.psiLow})`, action:`go('maint')` });
        } else if (!isNaN(psi) && psi > DB_THRESH.psiHigh) {
          alerts.warning.push({ icon:'💧', farm, house:h, msg:`H${h} water PSI high: ${psi} PSI (> ${DB_THRESH.psiHigh})`, action:`go('maint')` });
        }

        // Feed / fans
        if (mw.feed === 'no') {
          alerts.critical.push({ icon:'🌾', farm, house:h, msg:`H${h} feeder issue reported`, action:`go('maint')` });
        }
        if (mw.fans === 'no') {
          alerts.critical.push({ icon:'💨', farm, house:h, msg:`H${h} fan/ventilation issue reported`, action:`go('maint')` });
        }

        // Flags
        if (mw.flags && mw.flags.length > 0) {
          mw.flags.forEach(f => {
            alerts.warning.push({ icon:'⚑', farm, house:h, msg:`H${h}: ${f}`, action:`go('prod')` });
          });
        }
      }

      // Dead birds
      if (bw) {
        const dead = Number(bw.mortCount || 0);
        if (dead >= DB_THRESH.deadPerHouse) {
          alerts.critical.push({ icon:'💀', farm, house:h, msg:`H${h} — ${dead} dead birds today`, action:`go('daily')` });
        } else if (dead > 5) {
          alerts.warning.push({ icon:'💀', farm, house:h, msg:`H${h} — ${dead} dead birds (monitor)`, action:`go('daily')` });
        }

        // Feed bin levels
        const binA = bw.binA !== undefined && bw.binA !== null ? Number(bw.binA) : null;
        const binB = bw.binB !== undefined && bw.binB !== null ? Number(bw.binB) : null;
        if (binA !== null && binA < 2) {
          alerts.warning.push({ icon:'🌾', farm, house:h, msg:`H${h} Bin A low — ${binA}t remaining`, action:`go('daily')` });
        }
        if (binB !== null && binB < 2) {
          alerts.warning.push({ icon:'🌾', farm, house:h, msg:`H${h} Bin B low — ${binB}t remaining`, action:`go('daily')` });
        }
      }
    }
  });

  // Urgent WOs
  const urgentWOs = (workOrders || []).filter(w => w.priority === 'urgent' && w.status !== 'completed');
  urgentWOs.forEach(wo => {
    alerts.critical.push({ icon:'🔧', farm: wo.farm||'', house: wo.house||'', msg:`Urgent WO ${wo.id}: ${(wo.desc||wo.problem||'').slice(0,60)}`, action:`go('maint')` });
  });

  // Overdue PMs
  if (typeof ALL_PM !== 'undefined' && ALL_PM) {
    const overduePMs = ALL_PM.filter(t => typeof pmStatus === 'function' && pmStatus(t.id) === 'overdue');
    if (overduePMs.length > 3) {
      alerts.warning.push({ icon:'📋', farm:'', house:'', msg:`${overduePMs.length} PMs overdue across all farms`, action:`go('maint');setTimeout(()=>goMaintSection('pm'),50)` });
    } else {
      overduePMs.forEach(t => {
        alerts.warning.push({ icon:'📋', farm: t.farm||'', house: t.house||'', msg:`PM overdue: ${t.name} (${t.farm||'all farms'})`, action:`go('maint');setTimeout(()=>goMaintSection('pm'),50)` });
      });
    }
  }

  // Contractor spend this week
  const { start, end } = dbWeekRange();
  const weekContractors = (contractorLog || []).filter(c => c.date >= start && c.date <= end);
  const weekSpend = weekContractors.reduce((s,c) => s + Number(c.cost||0), 0);
  if (weekSpend >= DB_THRESH.contractorWeekly) {
    alerts.warning.push({ icon:'🏗️', farm:'', house:'', msg:`Contractor spend this week: $${weekSpend.toLocaleString()}`, action:`go('maint');setTimeout(()=>goMaintSection('contractor'),50)` });
  }

  // Shift sign-off — flag after 3pm if not signed off
  if (hour >= 15 && typeof ssStatus === 'function') {
    ['Danville','Hegins'].forEach(farm => {
      const ss = ssStatus(farm);
      if (!ss.signed) {
        alerts.warning.push({ icon:'✅', farm, house:'', msg:`${farm} shift not signed off yet`, action:`go('daily')` });
      }
    });
  }

  return alerts;
}

function dbWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = d => d.toISOString().slice(0,10);
  return { start: fmt(mon), end: fmt(sun) };
}

// ── Farm status card ──────────────────────────────────────────────────────────
function dbFarmStatus(farm, houses, alerts) {
  const farmAlerts = alerts.critical.filter(a => a.farm === farm);
  const farmWarns  = alerts.warning.filter(a => a.farm === farm);

  const todayStr = new Date().toISOString().slice(0,10);
  const walked = _dbMorningWalks.filter(w => w.farm === farm && (w.date === todayStr || !w.date)).length;
  const totalDead = _dbBarnWalks
    .filter(w => w.farm === farm && w.date === todayStr)
    .reduce((s,w) => s + Number(w.mortCount||0), 0);
  const openWOs = (workOrders||[]).filter(w => w.farm === farm && w.status !== 'completed').length;

  const status = farmAlerts.length > 0 ? 'critical' : farmWarns.length > 0 ? 'warning' : 'ok';
  const colors = {
    critical: { bg:'#1a0505', border:'#f87171', dot:'#ef4444', text:'#fca5a5' },
    warning:  { bg:'#1a1000', border:'#fbbf24', dot:'#f59e0b', text:'#fde68a' },
    ok:       { bg:'#0a1f0a', border:'#4ade80', dot:'#22c55e', text:'#4ade80' }
  };
  const c = colors[status];

  return `
  <div style="background:${c.bg};border:2px solid ${c.border};border-radius:14px;padding:16px 18px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#e8f5ec;">${farm.toUpperCase()}</div>
      <div style="display:flex;align-items:center;gap:7px;">
        <span style="width:11px;height:11px;border-radius:50%;background:${c.dot};display:inline-block;${status!=='ok'?'box-shadow:0 0 8px '+c.dot+';':''}"></span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${c.text};font-weight:700;text-transform:uppercase;">${status === 'ok' ? 'ALL CLEAR' : status === 'warning' ? 'NEEDS ATTENTION' : 'ACTION REQUIRED'}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
      ${dbMiniKPI('🏠', walked + '/' + houses, 'Walked', walked===houses?'#4ade80':'#fbbf24')}
      ${dbMiniKPI('💀', totalDead, 'Dead Today', totalDead>20?'#f87171':totalDead>5?'#fbbf24':'#4ade80')}
      ${dbMiniKPI('🔧', openWOs, 'Open WOs', openWOs===0?'#4ade80':openWOs>5?'#f87171':'#fbbf24')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${farmAlerts.length > 0 ? `<span style="background:#7f1d1d;color:#fca5a5;border-radius:20px;padding:3px 10px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${farmAlerts.length} 🚨 Critical</span>` : ''}
      ${farmWarns.length > 0 ? `<span style="background:#854d0e;color:#fde68a;border-radius:20px;padding:3px 10px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${farmWarns.length} ⚠ Warning</span>` : ''}
      ${farmAlerts.length === 0 && farmWarns.length === 0 ? `<span style="background:#14532d;color:#4ade80;border-radius:20px;padding:3px 10px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">✓ No issues</span>` : ''}
      ${(() => {
        const ss = typeof ssStatus === 'function' ? ssStatus(farm) : null;
        if (!ss) return '';
        return `<span style="background:${ss.signed?'#14532d':'#2d0505'};color:${ss.color};border-radius:20px;padding:3px 10px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">${ss.signed?'✅':'⏳'} ${ss.signed?'Signed Off':'Shift Open'}</span>`;
      })()}
    </div>
  </div>`;
}

function dbMiniKPI(icon, value, label, color) {
  return `
  <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:8px;padding:8px;text-align:center;">
    <div style="font-size:14px;margin-bottom:2px;">${icon}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:${color};line-height:1;">${value}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a8a4a;margin-top:2px;text-transform:uppercase;">${label}</div>
  </div>`;
}

// ── Alert row ─────────────────────────────────────────────────────────────────
function dbAlertRow(a, level) {
  const levelStyle = {
    critical: { bg:'#1a0505', border:'#7f1d1d', color:'#fca5a5', badge:'#7f1d1d', badgeText:'#fca5a5', label:'CRITICAL' },
    warning:  { bg:'#1a1000', border:'#854d0e', color:'#fde68a', badge:'#854d0e', badgeText:'#fde68a', label:'WARNING' }
  }[level];

  const loc = [a.farm, a.house ? 'H'+a.house : ''].filter(Boolean).join(' ');

  return `
  <div style="background:${levelStyle.bg};border:1.5px solid ${levelStyle.border};border-radius:10px;padding:10px 14px;margin-bottom:6px;display:flex;align-items:center;gap:12px;cursor:pointer;"
       onclick="${a.action}">
    <span style="font-size:18px;flex-shrink:0;">${a.icon}</span>
    <div style="flex:1;min-width:0;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${levelStyle.color};font-weight:600;line-height:1.4;">${a.msg}</div>
      ${loc ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;margin-top:2px;">${loc}</div>` : ''}
    </div>
    <span style="background:${levelStyle.badge};color:${levelStyle.badgeText};border-radius:4px;padding:2px 7px;font-family:'IBM Plex Mono',monospace;font-size:8px;font-weight:700;flex-shrink:0;">${levelStyle.label}</span>
    <span style="color:#4a8a4a;font-size:10px;flex-shrink:0;">→</span>
  </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────
function dbRender() {
  const el = document.getElementById('panel-brief');
  if (!el) return;

  const alerts = dbBuildAlerts();
  const today = new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
  const time  = new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
  const safeDays = _dbSafety.lastIncidentDate
    ? Math.floor((new Date() - new Date(_dbSafety.lastIncidentDate)) / 86400000)
    : null;

  const totalCritical = alerts.critical.length;
  const totalWarning  = alerts.warning.length;

  // Overall status
  const overallStatus = totalCritical > 0 ? 'critical' : totalWarning > 0 ? 'warning' : 'ok';
  const statusLabel = { critical:'ISSUES REQUIRE ATTENTION', warning:'REVIEW BEFORE SHIFT', ok:'OPERATIONS NORMAL' };
  const statusColor = { critical:'#f87171', warning:'#fbbf24', ok:'#4ade80' };
  const statusBg    = { critical:'#2d0505', warning:'#2d1f00', ok:'#0a2a0a' };

  // WO counts
  const allOpenWOs   = (workOrders||[]).filter(w => w.status !== 'completed').length;
  const allUrgentWOs = (workOrders||[]).filter(w => w.priority === 'urgent' && w.status !== 'completed').length;

  // PM counts
  let allOverduePMs = 0, allDueSoonPMs = 0;
  if (typeof ALL_PM !== 'undefined' && ALL_PM && typeof pmStatus === 'function') {
    ALL_PM.forEach(t => {
      const s = pmStatus(t.id);
      if (s === 'overdue') allOverduePMs++;
      if (s === 'due-soon') allDueSoonPMs++;
    });
  }

  // Total dead today
  const todayDateStr = new Date().toISOString().slice(0,10);
  const allDeadToday = _dbBarnWalks.filter(w => w.date === todayDateStr).reduce((s,w) => s + Number(w.mortCount||0), 0);

  // Contractor this week
  const { start, end } = dbWeekRange();
  const weekSpend = (contractorLog||[])
    .filter(c => c.date >= start && c.date <= end)
    .reduce((s,c) => s + Number(c.cost||0), 0);

  el.innerHTML = `
  <div style="max-width:960px;margin:0 auto;padding:0 0 60px 0;">

    <!-- ── Header ── -->
    <div style="padding:16px 16px 12px 16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:3px;">Director's Daily Brief · ${today} · ${time}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:#e8f5ec;">OPERATIONS STATUS</div>
    </div>

    <!-- ── Overall Status Banner ── -->
    <div style="margin:0 16px 16px 16px;background:${statusBg[overallStatus]};border:2px solid ${statusColor[overallStatus]};border-radius:14px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:24px;">${overallStatus==='ok'?'✅':overallStatus==='warning'?'⚠️':'🚨'}</span>
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:${statusColor[overallStatus]};">${statusLabel[overallStatus]}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;margin-top:2px;">
            ${totalCritical} critical · ${totalWarning} warnings · updated ${time}
          </div>
        </div>
      </div>
      <button onclick="dbRefresh()" style="padding:8px 14px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:1px;">↻ REFRESH</button>
    </div>

    <!-- ── KPI Strip ── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;padding:0 16px 16px 16px;">
      ${dbKPICard('🛡️', safeDays !== null ? safeDays + 'd' : '—', 'Safe Days',
          safeDays===null?'#0f2a0f':safeDays>=30?'#1b5e20':safeDays>=7?'#856404':'#7f1d1d',
          safeDays===null?'#4a8a4a':safeDays>=30?'#4ade80':safeDays>=7?'#fbbf24':'#f87171')}
      ${dbKPICard('💀', allDeadToday, 'Dead Today',
          allDeadToday>50?'#7f1d1d':allDeadToday>20?'#856404':'#1b5e20',
          allDeadToday>50?'#f87171':allDeadToday>20?'#fbbf24':'#4ade80')}
      ${dbKPICard('🔧', allOpenWOs + (allUrgentWOs>0?' ('+allUrgentWOs+'🚨)':''), 'Open WOs',
          allUrgentWOs>0?'#7f1d1d':allOpenWOs>8?'#856404':'#1b5e20',
          allUrgentWOs>0?'#f87171':allOpenWOs>8?'#fbbf24':'#4ade80')}
      ${dbKPICard('📋', allOverduePMs, 'PMs Overdue',
          allOverduePMs>5?'#7f1d1d':allOverduePMs>0?'#856404':'#1b5e20',
          allOverduePMs>5?'#f87171':allOverduePMs>0?'#fbbf24':'#4ade80')}
      ${dbKPICard('🏗️', weekSpend>0?'$'+weekSpend.toLocaleString():'$0', 'Contractor $',
          weekSpend>=DB_THRESH.contractorWeekly?'#2d1f00':'#0d1a2a',
          weekSpend>=DB_THRESH.contractorWeekly?'#fbbf24':'#7ab0f6')}
    </div>

    <!-- ── Farm Status Cards ── -->
    <div style="padding:0 16px 16px 16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:10px;">🏭 FARM STATUS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${dbFarmStatus('Danville', 5, alerts)}
        ${dbFarmStatus('Hegins', 8, alerts)}
      </div>
    </div>

    <!-- ── Critical Alerts ── -->
    ${totalCritical > 0 ? `
    <div style="padding:0 16px 16px 16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;color:#f87171;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        🚨 CRITICAL — ACTION REQUIRED (${totalCritical})
        <span style="background:#7f1d1d;color:#fca5a5;border-radius:10px;padding:1px 8px;font-size:8px;">${totalCritical}</span>
      </div>
      ${alerts.critical.map(a => dbAlertRow(a, 'critical')).join('')}
    </div>` : ''}

    <!-- ── Warnings ── -->
    ${totalWarning > 0 ? `
    <div style="padding:0 16px 16px 16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        ⚠ NEEDS REVIEW (${totalWarning})
        <span style="background:#854d0e;color:#fde68a;border-radius:10px;padding:1px 8px;font-size:8px;">${totalWarning}</span>
      </div>
      ${alerts.warning.map(a => dbAlertRow(a, 'warning')).join('')}
    </div>` : ''}

    <!-- ── All Clear ── -->
    ${totalCritical === 0 && totalWarning === 0 ? `
    <div style="margin:0 16px;background:#0a2a0a;border:2px solid #166534;border-radius:14px;padding:28px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">✅</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#4ade80;">ALL FARMS CLEAR</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#2a8a2a;margin-top:6px;">No critical issues or warnings at this time</div>
    </div>` : ''}

    <!-- ── 8-Week KPI Trends ── -->
    <div style="padding:20px 16px 0 16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:12px;">📈 8-WEEK TRENDS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${dbTrendChart('Dead Birds / Week', dbBuildDeadTrend(), '#f87171')}
        ${dbTrendChart('Open WOs (End of Week)', dbBuildWOTrend(), '#7ab0f6')}
        ${dbTrendChart('PM Compliance %', dbBuildPMTrend(), '#4ade80')}
        ${dbTrendChart('Contractor Spend $', dbBuildContractorTrend(), '#fbbf24')}
      </div>
    </div>

    <!-- ── Quick Links ── -->
    <div style="padding:20px 16px 0 16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:10px;">⚡ QUICK ACTIONS</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
        ${dbQuickBtn('📋', 'Daily Report',   `go('daily')`)}
        ${dbQuickBtn('🔧', 'Work Orders',    `go('maint')`)}
        ${dbQuickBtn('📋', 'PM Schedule',    `go('maint');setTimeout(()=>goMaintSection('pm'),50)`)}
        ${dbQuickBtn('🏗️', 'Contractors',   `go('maint');setTimeout(()=>goMaintSection('contractor'),50)`)}
        ${dbQuickBtn('💰', 'Cost Dashboard', `go('maint');setTimeout(()=>goMaintSection('cost'),50)`)}
        ${dbQuickBtn('📅', 'Weekly Agenda',  `go('maint');setTimeout(()=>goMaintSection('weekly-agenda'),50)`)}
        ${dbQuickBtn('🏷️', 'Red Tags',      `go('maint');setTimeout(()=>goMaintSection('redtags'),50)`)}
      </div>
    </div>

  </div>`;
}

function dbKPICard(icon, value, label, bg, color) {
  return `
  <div style="background:${bg};border:1.5px solid ${color}33;border-radius:12px;padding:12px;text-align:center;">
    <div style="font-size:16px;margin-bottom:4px;">${icon}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${color};line-height:1;">${value}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${color};opacity:.7;margin-top:3px;text-transform:uppercase;letter-spacing:1px;">${label}</div>
  </div>`;
}

function dbQuickBtn(icon, label, action) {
  return `
  <button onclick="${action}" style="padding:12px 10px;background:#0a1a0a;border:1.5px solid #1a3a1a;border-radius:10px;color:#7ab07a;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;text-align:center;letter-spacing:.5px;display:flex;flex-direction:column;align-items:center;gap:5px;transition:border-color .15s;"
    onmouseover="this.style.borderColor='#4ade80'" onmouseout="this.style.borderColor='#1a3a1a'">
    <span style="font-size:18px;">${icon}</span>
    <span>${label}</span>
  </button>`;
}

async function dbRefresh() {
  _dbLoaded = false;
  await renderDirectorBrief();
}

// ── 8-Week trend charts ───────────────────────────────────────────────────────
// Returns array of { label, value } for the past 8 weeks

function dbWeekStarts(count) {
  const weeks = [];
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  let mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0,0,0,0);
  for (let i = count - 1; i >= 0; i--) {
    const wStart = new Date(mon);
    wStart.setDate(mon.getDate() - i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    weeks.push({
      start: wStart.toISOString().slice(0,10),
      end:   wEnd.toISOString().slice(0,10),
      label: wStart.toLocaleDateString('en-US', {month:'short', day:'numeric'})
    });
  }
  return weeks;
}

function dbBuildDeadTrend() {
  const weeks = dbWeekStarts(8);
  return weeks.map(w => {
    const total = (_dbBarnWalks||[])
      .filter(b => b.date >= w.start && b.date <= w.end)
      .reduce((s,b) => s + Number(b.mortCount||0), 0);
    return { label: w.label, value: total };
  });
}

function dbBuildWOTrend() {
  // Use current WO data — show open count snapshot (approximate from timestamps)
  const weeks = dbWeekStarts(8);
  return weeks.map(w => {
    // WOs created up to end of that week that haven't been completed yet (rough proxy)
    const created = (workOrders||[]).filter(wo => wo.date >= w.start && wo.date <= w.end).length;
    return { label: w.label, value: created };
  });
}

function dbBuildPMTrend() {
  // PM compliance — approximate from pmComps completion dates
  const weeks = dbWeekStarts(8);
  if (typeof ALL_PM === 'undefined' || !ALL_PM || !pmComps) {
    return weeks.map(w => ({ label: w.label, value: 0 }));
  }
  return weeks.map(w => {
    const completedThisWeek = ALL_PM.filter(t => {
      const c = pmComps[t.id];
      return c && c.date >= w.start && c.date <= w.end;
    }).length;
    const pct = ALL_PM.length > 0 ? Math.round((completedThisWeek / ALL_PM.length) * 100) : 0;
    return { label: w.label, value: Math.min(pct, 100) };
  });
}

function dbBuildContractorTrend() {
  const weeks = dbWeekStarts(8);
  return weeks.map(w => {
    const spend = (contractorLog||[])
      .filter(c => c.date >= w.start && c.date <= w.end)
      .reduce((s,c) => s + Number(c.cost||0), 0);
    return { label: w.label, value: spend };
  });
}

function dbTrendChart(title, data, color) {
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const last = values[values.length - 1];
  const prev = values[values.length - 2] ?? last;
  const trend = last > prev ? '↑' : last < prev ? '↓' : '→';
  const trendColor = title.includes('Dead') || title.includes('Cost') || title.includes('WO')
    ? (last > prev ? '#f87171' : last < prev ? '#4ade80' : '#7ab07a')
    : (last > prev ? '#4ade80' : last < prev ? '#f87171' : '#7ab07a');

  const bars = data.map((d, i) => {
    const h = max > 0 ? Math.round((d.value / max) * 48) : 0;
    const isLast = i === data.length - 1;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:7px;color:${isLast?color:'#2a5a2a'};text-align:center;min-height:10px;line-height:10px;">
          ${d.value > 0 ? (title.includes('$') ? '$'+d.value.toLocaleString() : d.value) : ''}
        </div>
        <div style="width:100%;background:${isLast?color:color+'55'};border-radius:3px 3px 0 0;height:${Math.max(h,2)}px;transition:height .3s;"></div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:7px;color:#2a5a2a;text-align:center;white-space:nowrap;overflow:hidden;max-width:28px;">${d.label.split(' ')[1]||d.label}</div>
      </div>`;
  }).join('');

  return `
  <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:12px;padding:12px 14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;text-transform:uppercase;letter-spacing:1px;">${title}</div>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:${trendColor};">${trend} ${title.includes('$')?'$'+last.toLocaleString():title.includes('%')?last+'%':last}</span>
    </div>
    <div style="display:flex;align-items:flex-end;gap:3px;height:60px;">
      ${bars}
    </div>
  </div>`;
}

// ── Landing screen badge ──────────────────────────────────────────────────────
// Called after app loads — shows urgent WO + overdue PM count on the landing card
function updateBriefBadge() {
  const badge = document.getElementById('ls-brief-badge');
  if (!badge) return;

  const urgentWOs = (workOrders||[]).filter(w => w.priority === 'urgent' && w.status !== 'completed').length;
  let overduePMs = 0;
  if (typeof ALL_PM !== 'undefined' && ALL_PM && typeof pmStatus === 'function') {
    ALL_PM.forEach(t => { if (pmStatus(t.id) === 'overdue') overduePMs++; });
  }

  const total = urgentWOs + overduePMs;
  if (total === 0) {
    badge.innerHTML = `<span style="color:#4ade80;font-size:11px;font-weight:700;">✓ CLEAR</span>`;
  } else {
    badge.innerHTML = `<span style="background:#ef4444;color:#fff;border-radius:50%;font-size:12px;font-weight:700;padding:2px 8px;display:inline-block;">${total}</span>`;
  }
}

