// ═══════════════════════════════════════════════════════════════════════
// WEEKLY MEETING AGENDA GENERATOR
// Auto-builds Monday operations meeting from the week's Firebase data
// Sections: Safety | Dead Birds | PM Compliance | WOs | Contractors | 5S
// ═══════════════════════════════════════════════════════════════════════

let _waMorningWalks = [];
let _waBarnWalks    = [];
let _waProjects     = [];
let _waSafety       = {};
let _waLoaded       = false;
let _waPrinting     = false;

// ── Entry point called from maintenance sub-nav ──────────────────────────────
async function renderWeeklyAgenda() {
  const el = document.getElementById('maint-weekly-agenda');
  if (!el) return;
  el.innerHTML = `<div style="padding:32px;text-align:center;font-family:'IBM Plex Mono',monospace;color:#4a8a4a;font-size:13px;letter-spacing:1px;">Building weekly agenda…</div>`;
  try {
    await waLoadData();
    waRender();
  } catch(e) {
    el.innerHTML = `<div style="padding:24px;color:#ef4444;font-family:'IBM Plex Mono',monospace;">Error: ${e.message}</div>`;
    console.error('Weekly Agenda error:', e);
  }
}

// ── Load this week's data ─────────────────────────────────────────────────────
async function waLoadData() {
  const { start, end } = waWeekRange();

  const [mwSnap, bwSnap, projSnap, safetySnap] = await Promise.all([
    db.collection('morningWalks').where('date','>=',start).where('date','<=',end).get(),
    db.collection('barnWalks').where('date','>=',start).where('date','<=',end).get(),
    db.collection('dailyProjects').orderBy('createdTs','desc').limit(200).get(),
    db.collection('safetySettings').doc('main').get()
  ]);

  _waMorningWalks = mwSnap.docs.map(d => d.data());
  _waBarnWalks    = bwSnap.docs.map(d => d.data());
  _waProjects     = projSnap.docs.map(d => ({...d.data(), _fbId: d.id}));
  _waSafety       = safetySnap.exists ? safetySnap.data() : {};
  _waLoaded       = true;
}

// ── Week range: Mon–Sun of current week ──────────────────────────────────────
function waWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0,0,0,0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = d => d.toISOString().slice(0,10);
  return { start: fmt(mon), end: fmt(sun), mon, sun };
}

function waFmtDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return new Date(y,m-1,d).toLocaleDateString('en-US', {weekday:'short',month:'short',day:'numeric'});
}

// ── Dead birds aggregation ────────────────────────────────────────────────────
function waDeadByFarm() {
  const result = { Danville: {total:0,byDay:{}}, Hegins: {total:0,byDay:{}} };
  _waBarnWalks.forEach(w => {
    const farm = w.farm;
    if (!result[farm]) return;
    const n = Number(w.mortCount || 0);
    result[farm].total += n;
    result[farm].byDay[w.date] = (result[farm].byDay[w.date] || 0) + n;
  });
  return result;
}

// ── PM compliance this week ───────────────────────────────────────────────────
function waPMCompliance(farm) {
  if (typeof ALL_PM === 'undefined' || !ALL_PM) return null;
  const { start, end } = waWeekRange();
  const farmPMs = ALL_PM.filter(t => !t.farm || t.farm === farm || t.farm === 'Both');
  if (!farmPMs.length) return null;

  let completed = 0, overdue = 0;
  farmPMs.forEach(t => {
    const s = typeof pmStatus === 'function' ? pmStatus(t.id) : 'ok';
    if (s === 'ok') completed++;
    if (s === 'overdue') overdue++;
  });
  const pct = Math.round((completed / farmPMs.length) * 100);
  return { total: farmPMs.length, completed, overdue, pct };
}

// ── Open WOs by farm ─────────────────────────────────────────────────────────
function waOpenWOs(farm) {
  return (workOrders || []).filter(w => w.farm === farm && w.status !== 'completed');
}

// ── Contractors this week ─────────────────────────────────────────────────────
function waContractorsThisWeek() {
  const { start, end } = waWeekRange();
  return (contractorLog || []).filter(c => c.date >= start && c.date <= end);
}

// ── Main render ──────────────────────────────────────────────────────────────
function waRender() {
  const el = document.getElementById('maint-weekly-agenda');
  if (!el) return;

  const { start, end, mon, sun } = waWeekRange();
  const weekLabel = `${waFmtDate(start)} – ${waFmtDate(end)}`;
  const genTime = new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'});

  const dead   = waDeadByFarm();
  const pmDan  = waPMCompliance('Danville');
  const pmHeg  = waPMCompliance('Hegins');
  const woDan  = waOpenWOs('Danville');
  const woHeg  = waOpenWOs('Hegins');
  const contractors = waContractorsThisWeek();
  const safeDays = _waSafety.lastIncidentDate
    ? Math.floor((new Date() - new Date(_waSafety.lastIncidentDate)) / 86400000)
    : null;

  // Projects: active this week
  const activeProjs = _waProjects.filter(p => p.status !== 'Complete');
  const doneProjs   = _waProjects.filter(p => p.status === 'Complete');

  el.innerHTML = `
  <div id="wa-container" style="max-width:860px;margin:0 auto;padding:0 0 80px 0;font-family:'IBM Plex Mono',monospace;">

    <!-- ── Toolbar ── -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;gap:10px;flex-wrap:wrap;">
      <div>
        <div style="font-size:9px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;margin-bottom:3px;">Weekly Ops Meeting Agenda</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#e8f5ec;">WEEK OF ${start.slice(5).replace('-','/')} — ${end.slice(5).replace('-','/')}</div>
        <div style="font-size:9px;color:#2a5a2a;margin-top:2px;">Auto-generated ${genTime}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="waPrint()" style="padding:8px 16px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:8px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:1px;">🖨 PRINT / SAVE PDF</button>
        <button onclick="renderWeeklyAgenda()" style="padding:8px 14px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;">↻ REFRESH</button>
      </div>
    </div>

    <!-- ═══ SECTION 1: SAFETY ═══ -->
    ${waSection('1', '🛡️', 'SAFETY UPDATE', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${waBigStat(
          safeDays !== null ? safeDays : '—',
          'Days Without Incident',
          safeDays === null ? '#0f2a0f' : safeDays >= 30 ? '#1b5e20' : safeDays >= 7 ? '#856404' : '#7f1d1d',
          safeDays === null ? '#4a8a4a' : safeDays >= 30 ? '#4ade80' : safeDays >= 7 ? '#fbbf24' : '#f87171'
        )}
        <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:10px;padding:14px;">
          <div style="font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase;">Discussion Points</div>
          ${waCheckItem('Any near-misses or injuries this week?')}
          ${waCheckItem('PPE compliance check across all houses')}
          ${waCheckItem('Lockout/tagout procedures followed?')}
          ${waCheckItem('Any safety training needs identified?')}
        </div>
      </div>
    `)}

    <!-- ═══ SECTION 2: DEAD BIRDS ═══ -->
    ${waSection('2', '💀', 'DEAD BIRD REPORT', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        ${waBigStat(
          dead.Danville.total,
          'Danville — Total This Week',
          dead.Danville.total > 50 ? '#7f1d1d' : dead.Danville.total > 20 ? '#856404' : '#1b5e20',
          dead.Danville.total > 50 ? '#f87171' : dead.Danville.total > 20 ? '#fbbf24' : '#4ade80'
        )}
        ${waBigStat(
          dead.Hegins.total,
          'Hegins — Total This Week',
          dead.Hegins.total > 80 ? '#7f1d1d' : dead.Hegins.total > 40 ? '#856404' : '#1b5e20',
          dead.Hegins.total > 80 ? '#f87171' : dead.Hegins.total > 40 ? '#fbbf24' : '#4ade80'
        )}
      </div>
      ${waDeadByDayTable(dead)}
      <div style="margin-top:10px;background:#0a1a0a;border:1px solid #1a3a1a;border-radius:8px;padding:12px;">
        <div style="font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">Discussion Points</div>
        ${waCheckItem('Any spike days — identify cause')}
        ${waCheckItem('Houses with highest loss — any pattern?')}
        ${waCheckItem('Vet call needed?')}
      </div>
    `)}

    <!-- ═══ SECTION 3: PM COMPLIANCE ═══ -->
    ${waSection('3', '📋', 'PM COMPLIANCE', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        ${waPMCard('Danville', pmDan)}
        ${waPMCard('Hegins', pmHeg)}
      </div>
      <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:8px;padding:12px;">
        <div style="font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">Discussion Points</div>
        ${waCheckItem('Review any missed PMs — assign catch-up dates')}
        ${waCheckItem('Identify recurring missed PMs → add to daily schedule')}
        ${waCheckItem('Next week\'s PM priorities')}
      </div>
    `)}

    <!-- ═══ SECTION 4: OPEN WORK ORDERS ═══ -->
    ${waSection('4', '🔧', 'OPEN WORK ORDERS', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        ${waBigStat(woDan.length, 'Open WOs — Danville',
          woDan.some(w=>w.priority==='urgent') ? '#7f1d1d' : woDan.length > 5 ? '#856404' : '#1b5e20',
          woDan.some(w=>w.priority==='urgent') ? '#f87171' : woDan.length > 5 ? '#fbbf24' : '#4ade80')}
        ${waBigStat(woHeg.length, 'Open WOs — Hegins',
          woHeg.some(w=>w.priority==='urgent') ? '#7f1d1d' : woHeg.length > 5 ? '#856404' : '#1b5e20',
          woHeg.some(w=>w.priority==='urgent') ? '#f87171' : woHeg.length > 5 ? '#fbbf24' : '#4ade80')}
      </div>
      ${waWOTable([...woDan, ...woHeg])}
    `)}

    <!-- ═══ SECTION 5: CONTRACTOR REVIEW ═══ -->
    ${waSection('5', '🏗️', 'CONTRACTOR REVIEW', `
      ${contractors.length === 0
        ? `<div style="background:#0a1f0a;border:1px solid #1a3a1a;border-radius:8px;padding:14px;text-align:center;font-size:11px;color:#2a5a2a;">No contractor work logged this week</div>`
        : waContractorTable(contractors)}
      <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:8px;padding:12px;margin-top:10px;">
        <div style="font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">Discussion Points</div>
        ${waCheckItem('Any "could do in-house" jobs we should plan to own?')}
        ${waCheckItem('Contractor performance issues?')}
        ${waCheckItem('Schedule upcoming contractor work')}
      </div>
    `)}

    <!-- ═══ SECTION 6: 5S & IMPROVEMENT PROJECTS ═══ -->
    ${waSection('6', '🏭', '5S & IMPROVEMENT PROJECTS', `
      ${waProjectsTable(activeProjs, doneProjs)}
      <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:8px;padding:12px;margin-top:10px;">
        <div style="font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">Discussion Points</div>
        ${waCheckItem('Review each in-progress project — any blockers?')}
        ${waCheckItem('Assign any unowned tasks')}
        ${waCheckItem(`Next week focus: ${getWeekFocusLabel ? getWeekFocusLabel().split('·')[0].replace(/^.*?:/,'').trim() : '5S / Improvement'}`)}
      </div>
    `)}

    <!-- ═══ SECTION 7: NEXT STEPS ═══ -->
    ${waSection('7', '⚡', 'ACTION ITEMS — THIS WEEK', `
      <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:10px;padding:14px;">
        <div style="font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:10px;text-transform:uppercase;">Capture commitments during the meeting</div>
        ${[1,2,3,4,5].map(i=>`
          <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #1a3a1a;">
            <span style="font-size:10px;color:#2a5a2a;font-weight:700;min-width:18px;">${i}.</span>
            <div style="flex:1;border-bottom:1px dashed #1a3a1a;min-height:18px;"></div>
            <span style="font-size:9px;color:#2a5a2a;min-width:60px;">Owner: ______</span>
            <span style="font-size:9px;color:#2a5a2a;min-width:60px;">Due: ______</span>
          </div>`).join('')}
      </div>
    `)}

  </div>`;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function waSection(num, icon, title, body) {
  return `
  <div style="margin:0 16px 16px 16px;border:1.5px solid #1a3a1a;border-radius:14px;overflow:hidden;">
    <div style="background:#0f2a0f;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1.5px solid #1a3a1a;">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:#2a5a2a;letter-spacing:1px;min-width:22px;">${num}</span>
      <span style="font-size:16px;">${icon}</span>
      <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:#4ade80;letter-spacing:2px;">${title}</span>
    </div>
    <div style="padding:14px 16px;background:#0a150a;">
      ${body}
    </div>
  </div>`;
}

// ── Big stat card ─────────────────────────────────────────────────────────────
function waBigStat(value, label, bg, color) {
  return `
  <div style="background:${bg};border:1.5px solid ${color}33;border-radius:10px;padding:16px;text-align:center;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:32px;font-weight:700;color:${color};line-height:1;">${value}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${color};opacity:.8;margin-top:5px;text-transform:uppercase;letter-spacing:1px;">${label}</div>
  </div>`;
}

// ── Checklist item ────────────────────────────────────────────────────────────
function waCheckItem(text) {
  return `
  <div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;">
    <span style="font-size:11px;margin-top:1px;">☐</span>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;line-height:1.5;">${text}</span>
  </div>`;
}

// ── Dead-by-day table ─────────────────────────────────────────────────────────
function waDeadByDayTable(dead) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const { start } = waWeekRange();
  const dates = Array.from({length:7}, (_,i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0,10);
  });

  return `
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:10px;">
      <thead>
        <tr>
          <td style="padding:6px 10px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Farm</td>
          ${days.map((d,i)=>`<td style="padding:6px 8px;color:#4a8a4a;font-size:9px;text-align:center;text-transform:uppercase;">${d}<div style="font-size:8px;color:#2a5a2a;">${dates[i].slice(5)}</div></td>`).join('')}
          <td style="padding:6px 8px;color:#4ade80;font-size:9px;text-align:center;text-transform:uppercase;">TOTAL</td>
        </tr>
      </thead>
      <tbody>
        ${['Danville','Hegins'].map(farm => `
          <tr style="border-top:1px solid #1a3a1a;">
            <td style="padding:8px 10px;color:#c8e6c9;font-weight:700;">${farm}</td>
            ${dates.map(date => {
              const n = dead[farm]?.byDay[date] || 0;
              const color = n > 10 ? '#f87171' : n > 0 ? '#fbbf24' : '#2a5a2a';
              return `<td style="padding:8px;text-align:center;color:${color};font-weight:${n>0?'700':'400'};">${n > 0 ? n : '—'}</td>`;
            }).join('')}
            <td style="padding:8px;text-align:center;color:#4ade80;font-weight:700;">${dead[farm]?.total || 0}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── PM compliance card ────────────────────────────────────────────────────────
function waPMCard(farm, pm) {
  if (!pm) return `<div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:10px;padding:16px;text-align:center;color:#2a5a2a;font-size:11px;">${farm} — PM data not available</div>`;
  const barColor = pm.overdue > 0 ? '#f87171' : pm.pct === 100 ? '#4ade80' : '#fbbf24';
  return `
  <div style="background:#0a1a0a;border:1.5px solid ${barColor}33;border-radius:10px;padding:14px;">
    <div style="font-size:11px;color:#c8e6c9;font-weight:700;margin-bottom:8px;">${farm}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
      <span style="font-size:9px;color:#4a8a4a;">${pm.completed} / ${pm.total} complete</span>
      <span style="font-size:14px;font-weight:700;color:${barColor};">${pm.pct}%</span>
    </div>
    <div style="background:#0f1a0f;border-radius:4px;height:6px;overflow:hidden;margin-bottom:8px;">
      <div style="background:${barColor};width:${pm.pct}%;height:100%;border-radius:4px;"></div>
    </div>
    ${pm.overdue > 0 ? `<div style="font-size:9px;color:#f87171;">⚠ ${pm.overdue} overdue</div>` : `<div style="font-size:9px;color:#4ade80;">✓ None overdue</div>`}
  </div>`;
}

// ── WO table ──────────────────────────────────────────────────────────────────
function waWOTable(wos) {
  const urgent = wos.filter(w => w.priority === 'urgent');
  const others = wos.filter(w => w.priority !== 'urgent');
  const sorted = [...urgent, ...others].slice(0, 12);

  if (!sorted.length) return `<div style="background:#0a1f0a;border:1px solid #1a3a1a;border-radius:8px;padding:12px;text-align:center;font-size:11px;color:#2a5a2a;">✓ No open work orders this week</div>`;

  const priColor = {urgent:'#f87171',high:'#fbbf24',normal:'#7ab0f6',routine:'#a78bfa',low:'#4a8a4a'};

  return `
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:10px;">
      <thead>
        <tr style="border-bottom:1.5px solid #1a3a1a;">
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">WO #</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Farm</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Issue</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Priority</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Tech</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Status</td>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(wo => `
          <tr style="border-bottom:1px solid #1a3a1a;background:${wo.priority==='urgent'?'#1a050522':''}">>
            <td style="padding:7px 8px;color:#7ab0f6;font-weight:700;">${wo.id}</td>
            <td style="padding:7px 8px;color:#c8e6c9;">${wo.farm||'—'} ${wo.house?'H'+wo.house:''}</td>
            <td style="padding:7px 8px;color:#c8e6c9;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${wo.desc||wo.problem||'—'}</td>
            <td style="padding:7px 8px;">
              <span style="background:${(priColor[wo.priority]||'#4a8a4a')}22;color:${priColor[wo.priority]||'#4a8a4a'};border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700;text-transform:uppercase;">${wo.priority||'—'}</span>
            </td>
            <td style="padding:7px 8px;color:#7ab07a;">${wo.tech||'—'}</td>
            <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;">${wo.status||'—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    ${wos.length > 12 ? `<div style="text-align:center;padding:6px;font-size:9px;color:#4a8a4a;">+${wos.length-12} more open WOs</div>` : ''}
  </div>`;
}

// ── Contractor table ──────────────────────────────────────────────────────────
function waContractorTable(contracts) {
  const totalCost = contracts.reduce((s,c) => s + Number(c.cost||0), 0);
  const inhouseCost = contracts.filter(c=>c.couldInHouse==='yes').reduce((s,c)=>s+Number(c.cost||0),0);

  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
    ${waBigStat('$' + totalCost.toLocaleString(), 'Total Contractor Spend', '#0d1a2a', '#7ab0f6')}
    ${waBigStat('$' + inhouseCost.toLocaleString(), 'Could Do In-House', '#1a0f00', '#fbbf24')}
  </div>
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:10px;">
      <thead>
        <tr style="border-bottom:1.5px solid #1a3a1a;">
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Vendor</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Job</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Farm</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Cost</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">In-House?</td>
        </tr>
      </thead>
      <tbody>
        ${contracts.map(c => `
          <tr style="border-bottom:1px solid #1a3a1a;">
            <td style="padding:7px 8px;color:#c8e6c9;font-weight:700;">${c.vendor||'—'}</td>
            <td style="padding:7px 8px;color:#c8e6c9;">${c.job||'—'}</td>
            <td style="padding:7px 8px;color:#7ab07a;">${c.farm||'—'} ${c.house?'H'+c.house:''}</td>
            <td style="padding:7px 8px;color:#7ab0f6;font-weight:700;">$${Number(c.cost||0).toLocaleString()}</td>
            <td style="padding:7px 8px;">
              <span style="background:${c.couldInHouse==='yes'?'#85400022':'#14532d22'};color:${c.couldInHouse==='yes'?'#fbbf24':'#4ade80'};border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700;">
                ${c.couldInHouse==='yes'?'YES — IN-HOUSE':'NO'}
              </span>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── Projects table ────────────────────────────────────────────────────────────
function waProjectsTable(active, done) {
  if (!active.length && !done.length) {
    return `<div style="background:#0a1f0a;border:1px solid #1a3a1a;border-radius:8px;padding:12px;text-align:center;font-size:11px;color:#2a5a2a;">No active projects — use Daily Report to add tasks</div>`;
  }
  const priColor = {Critical:'#f87171',Urgent:'#fbbf24',Planned:'#4ade80'};
  const rows = (list, statusColor) => list.map(p => `
    <tr style="border-bottom:1px solid #1a3a1a;">
      <td style="padding:7px 8px;color:#c8e6c9;font-weight:600;">${p.task}</td>
      <td style="padding:7px 8px;color:#7ab07a;">${p.farm||'—'}</td>
      <td style="padding:7px 8px;color:#7ab07a;">${p.area||'—'}</td>
      <td style="padding:7px 8px;color:#7ab07a;">${p.owner||'—'}</td>
      <td style="padding:7px 8px;">
        ${p.focus ? `<span style="background:#1a3a5a;color:#7ab0f6;border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700;">${p.focus}</span>` : ''}
        ${p.priority ? `<span style="background:${(priColor[p.priority]||'#4a8a4a')}22;color:${priColor[p.priority]||'#4a8a4a'};border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700;margin-left:3px;">${p.priority}</span>` : ''}
      </td>
      <td style="padding:7px 8px;color:${statusColor};font-size:9px;font-weight:700;">${p.status}</td>
    </tr>`).join('');

  return `
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:10px;">
      <thead>
        <tr style="border-bottom:1.5px solid #1a3a1a;">
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Task</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Farm</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Area</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Owner</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Focus / Priority</td>
          <td style="padding:7px 8px;color:#4a8a4a;font-size:9px;text-transform:uppercase;">Status</td>
        </tr>
      </thead>
      <tbody>
        ${rows(active, '#fbbf24')}
        ${done.length > 0 ? `
          <tr style="border-top:1.5px solid #1a3a1a;">
            <td colspan="6" style="padding:8px 10px;color:#2a5a2a;font-size:9px;letter-spacing:1px;text-transform:uppercase;">✓ Completed (${done.length})</td>
          </tr>
          ${rows(done, '#4ade80')}` : ''}
      </tbody>
    </table>
  </div>`;
}

// ── Print handler ─────────────────────────────────────────────────────────────
function waPrint() {
  const content = document.getElementById('wa-container');
  if (!content) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>Rushtown Weekly Ops Agenda — ${new Date().toLocaleDateString()}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Bebas+Neue&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; }
      body { background: #fff; color: #111; font-family: 'IBM Plex Mono', monospace; font-size: 11px; margin: 20px; }
      @media print { body { margin: 10px; } }
    </style>
    </head><body>${content.innerHTML}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}
