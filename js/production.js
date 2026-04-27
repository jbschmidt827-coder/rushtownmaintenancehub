// PRODUCTION PANEL RENDER
// ═══════════════════════════════════════════
const EGG_BIRDS_PER_BARN = 150000;

// ── Landing page live status badges ──────────────────
async function renderLandingStatus() {
  const today = new Date().toISOString().slice(0,10);
  const badge = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  // Production: barn walk count today
  try {
    const snap = await db.collection('barnWalks')
      .where('date','==',today).get().catch(() =>
        db.collection('barnWalks').where('ts','>=', new Date(today)).get()
      );
    const done = snap.docs.length;
    const total = 13;
    const color = done >= total ? '#4caf50' : done > 0 ? '#d69e2e' : '#e53e3e';
    badge('ls-prod', `<span style="color:${color};font-weight:700;">${done}/${total} barns checked today</span>`);
  } catch(e) { badge('ls-prod',''); }

  // Maintenance: open work orders
  try {
    const snap = await db.collection('workOrders')
      .where('status','in',['open','in-progress']).get();
    const count = snap.docs.length;
    const urgent = snap.docs.filter(d => d.data().priority === 'urgent').length;
    const color = urgent > 0 ? '#e53e3e' : count > 0 ? '#d69e2e' : '#4caf50';
    const txt = count === 0 ? '✓ No open work orders'
      : urgent > 0 ? `${urgent} urgent · ${count} total open`
      : `${count} open work order${count!==1?'s':''}`;
    badge('ls-maint', `<span style="color:${color};font-weight:700;">${txt}</span>`);
  } catch(e) { badge('ls-maint',''); }

  // On-Call: today's scheduled people across sites
  try {
    const ocSnap = await db.collection('onCallSchedule').where('date','==',today).get();
    const ocDocs = ocSnap.docs.map(d => d.data());
    // Also count any open (unresolved) on-call log entries today
    const ocLogSnap = await db.collection('onCallLog').where('resolved','==',false).get();
    const openCount = ocLogSnap.docs.length;
    if (ocDocs.length > 0) {
      const names = ocDocs.map(d => `${d.site}: ${d.staffName}`).join(' · ');
      const suffix = openCount > 0 ? ` · <span style="color:#e53e3e;">${openCount} open</span>` : '';
      badge('ls-oncall', `<span style="color:#4caf50;font-weight:700;">${names}</span>${suffix}`);
    } else if (openCount > 0) {
      badge('ls-oncall', `<span style="color:#e53e3e;font-weight:700;">${openCount} open event${openCount!==1?'s':''}</span>`);
    } else {
      badge('ls-oncall', `<span style="color:#4a4a4a;">No assignments today</span>`);
    }
  } catch(e) { badge('ls-oncall',''); }
}
const EGG_KPI_RATE       = 0.90;
const EGG_TARGET         = Math.round(EGG_BIRDS_PER_BARN * EGG_KPI_RATE); // 135,000

function kpiCol(pct) {
  return pct >= 90 ? '#4caf50' : pct >= 75 ? '#d69e2e' : '#e53e3e';
}

function renderProdPanel() {
  const bs = typeof BARN_STATUS !== 'undefined' ? BARN_STATUS : {};
  const ms = typeof MORNING_STATUS !== 'undefined' ? MORNING_STATUS : {};
  const totalBarns = 13;
  // A barn counts as checked if either a barn walk OR a morning walk was submitted
  const allKeys = new Set([...Object.keys(bs), ...Object.keys(ms)]);
  const done   = [...allKeys].filter(k => bs[k]==='done'||bs[k]==='issue'||ms[k]==='done'||ms[k]==='issue').length;
  const issues = Object.values(bs).filter(s => s==='issue').length;
  const pct    = Math.round(done / totalBarns * 100);
  const todayStr = new Date().toISOString().slice(0,10);

  // Sum today's eggs per farm+house
  const eggMap = {};  // key: "Farm-House" → total eggs
  (typeof opsEggData !== 'undefined' ? opsEggData : [])
    .filter(r => r.date === todayStr)
    .forEach(r => {
      const k = r.farm + '-' + r.house;
      eggMap[k] = (eggMap[k] || 0) + (Number(r.eggs) || 0);
    });

  const todayEggs = Object.values(eggMap).reduce((s,v) => s + v, 0);

  // Per-location progress
  const FARM_BARNS = { Hegins: 8, Danville: 5 };
  function farmDone(farm) {
    let d = 0;
    const n = FARM_BARNS[farm] || 0;
    for (let i = 1; i <= n; i++) {
      const k = farm + '-' + i;
      if (bs[k]==='done'||bs[k]==='issue'||ms[k]==='done'||ms[k]==='issue') d++;
    }
    return d;
  }
  function farmIssues(farm) {
    let d = 0;
    const n = FARM_BARNS[farm] || 0;
    for (let i = 1; i <= n; i++) {
      const k = farm + '-' + i;
      if (bs[k]==='issue') d++;
    }
    return d;
  }
  function locationTile(farm) {
    const total = FARM_BARNS[farm];
    const d     = farmDone(farm);
    const iss   = farmIssues(farm);
    const p     = Math.round(d / total * 100);
    const col   = p >= 80 ? '#4caf50' : p >= 40 ? '#d69e2e' : '#e53e3e';
    return `<div style="background:#0f2a0f;border:1px solid #2a5a2a;border-radius:12px;padding:12px 14px;">
      <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📍 ${farm}</div>
      <div style="display:flex;align-items:baseline;gap:6px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:700;color:${col};line-height:1;">${d}/${total}</div>
        <div style="font-size:10px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;">barns</div>
      </div>
      <div style="background:#163016;border-radius:3px;height:5px;overflow:hidden;margin-top:8px;">
        <div style="height:100%;background:${col};width:${p}%;border-radius:3px;transition:width 0.4s;"></div>
      </div>
      ${iss > 0 ? `<div style="font-size:10px;color:#e53e3e;font-family:'IBM Plex Mono',monospace;margin-top:5px;">⚠ ${iss} flagged</div>` : `<div style="font-size:10px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;margin-top:5px;">${d===total?'✅ All checked':'—'}</div>`}
    </div>`;
  }

  const kpiBar = document.getElementById('prod-kpi-bar');
  if (kpiBar) kpiBar.innerHTML = `
    ${locationTile('Hegins')}
    ${locationTile('Danville')}
    <div style="background:#0f2a0f;border:1px solid #2a5a2a;border-radius:12px;padding:14px 12px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:700;color:#f0ead8;line-height:1;">${fmtNum(todayEggs)}</div>
      <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${t('prod.kpi.eggs')}</div>
    </div>
    <div style="background:${issues>0?'#2a0f0f':'#0f2a0f'};border:1px solid ${issues>0?'#5a2a2a':'#2a5a2a'};border-radius:12px;padding:14px 12px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:700;color:${issues>0?'#e53e3e':'#4caf50'};line-height:1;">${issues}</div>
      <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${t('prod.kpi.flagged')}</div>
    </div>`;

  // ── Per-barn Egg KPI ──────────────────────────────────────────────────────
  const eggKpi = document.getElementById('prod-egg-kpi');
  if (!eggKpi) return;

  const farmOrder = ['Hegins','Danville','Rushtown','Turbotville','W&M'];
  const farmHouses = { Hegins:8, Danville:5, Rushtown:5, Turbotville:4, 'W&M':2 };

  // Only show farms that have at least one barn with reported eggs today
  const farmsWithData = farmOrder.filter(farm =>
    Object.keys(eggMap).some(k => k.startsWith(farm + '-'))
  );

  if (farmsWithData.length === 0) {
    eggKpi.innerHTML = `
      <div style="background:#0f1a0f;border:1px solid #1e3a1e;border-radius:12px;padding:12px 14px;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#3a6a3a;margin-bottom:4px;">${t('prod.egg_kpi_title')} (135,000 / ${t('prod.barn').toLowerCase()})</div>
        <div style="font-size:11px;color:#3a5a3a;font-family:'IBM Plex Mono',monospace;">${t('prod.no_eggs_yet')}</div>
      </div>`;
    return;
  }

  let html = `<div style="background:#0f1a0f;border:1px solid #1e3a1e;border-radius:12px;padding:12px 14px;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5a8a5a;margin-bottom:12px;">${t('prod.egg_kpi_title')} (${fmtNum(EGG_TARGET)} / ${t('prod.barn').toLowerCase()})</div>`;

  farmsWithData.forEach(farm => {
    const houseCount = farmHouses[farm] || 0;
    let farmTotal = 0, farmTarget = 0;
    let barnRows = '';

    for (let h = 1; h <= houseCount; h++) {
      const k = farm + '-' + h;
      const actual = eggMap[k] || 0;
      if (actual === 0) continue;   // skip barns with no report today
      const barnPct = Math.round((actual / EGG_TARGET) * 100);
      const col = kpiCol(barnPct);
      const barW = Math.min(100, barnPct);
      farmTotal  += actual;
      farmTarget += EGG_TARGET;
      barnRows += `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;min-width:22px;">H${h}</div>
          <div style="flex:1;background:#163016;border-radius:3px;height:10px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:${col};border-radius:3px;"></div>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${col};min-width:70px;text-align:right;">${fmtNum(actual)} <span style="color:#4a7a4a;">(${barnPct}%)</span></div>
        </div>`;
    }

    if (!barnRows) return;
    const farmPct = Math.round((farmTotal / farmTarget) * 100);
    const farmCol = kpiCol(farmPct);
    html += `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#a0c0a0;">${farm}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${farmCol};font-weight:700;">${farmPct}% <span style="font-size:9px;color:#4a7a4a;">avg</span></div>
        </div>
        ${barnRows}
      </div>`;
  });

  html += '</div>';
  eggKpi.innerHTML = html;
}

// ── EC Section (Employee Daily Check) ──
var _ecFarm = null;

function openECSection() {
  _ecFarm = null;
  document.getElementById('ec-section').style.display = 'block';
  document.getElementById('ec-section').scrollTop = 0;
  renderECContent();
}

function ecBack() {
  if (_ecFarm) { _ecFarm = null; renderECContent(); }
  else { document.getElementById('ec-section').style.display = 'none'; }
}

function renderECContent() {
  const bs = typeof BARN_STATUS !== 'undefined' ? BARN_STATUS : {};
  const hdr = document.getElementById('ec-header');
  const btn = document.getElementById('ec-back-btn');
  if (_ecFarm) {
    if (hdr) hdr.textContent = '🐓 ' + _ecFarm;
    if (btn) btn.textContent = t('btn.back_farms');
    const cnt = _ecFarm === 'Hegins' ? 8 : 5;
    let html = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">`;
    for (let i = 1; i <= cnt; i++) {
      const key = _ecFarm + '-' + i;
      const st  = bs[key] || 'pending';
      const bc  = st==='done'?'#4caf50':st==='issue'?'#e53e3e':'#2a4a2a';
      const bg  = st==='done'?'#1a3a1a':st==='issue'?'#2a1a1a':'#163016';
      const nc  = st==='done'?'#f0ead8':st==='issue'?'#f0ead8':'#5a8a5a';
      const ic  = st==='done'?'<div style="font-size:14px;color:#4caf50;margin-top:4px;">✓</div>':
                  st==='issue'?'<div style="font-size:14px;color:#e53e3e;margin-top:4px;">⚠</div>':
                  '<div style="font-size:14px;color:#3a6a3a;margin-top:4px;">—</div>';
      html += `<div style="background:${bg};border:2px solid ${bc};border-radius:12px;padding:16px 4px;text-align:center;cursor:pointer;" onclick="openBarnWalk('${_ecFarm}',${i})">
        <div style="font-size:9px;color:#5a8a5a;letter-spacing:1px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;">${t('prod.barn')}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:700;color:${nc};line-height:1.1;">${i}</div>
        ${ic}
      </div>`;
    }
    html += `</div>`;
    document.getElementById('ec-content').innerHTML = html;
  } else {
    if (hdr) hdr.textContent = '🐓 ' + t('prod.daily_check');
    if (btn) btn.textContent = t('btn.close');
    const bsDone = f => Object.entries(bs).filter(([k,v])=>k.startsWith(f+'-')&&(v==='done'||v==='issue')).length;
    const bsCnt  = f => f==='Hegins'?8:5;
    document.getElementById('ec-content').innerHTML = `
      <div style="font-size:13px;color:#5a8a5a;margin-bottom:20px;font-family:'IBM Plex Mono',monospace;">${t('prod.select_farm')}</div>
      <div style="display:grid;gap:14px;">
        ${['Hegins','Danville'].map(f=>`
        <button onclick="_ecFarm='${f}';renderECContent()" style="width:100%;padding:28px 20px;background:#1a3a1a;border:2px solid #2a5a2a;border-radius:16px;color:#fff;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#f0ead8;">📍 ${f}</div>
            <div style="font-size:12px;color:#7ab07a;margin-top:6px;">${bsDone(f)}/${bsCnt(f)} ${t('prod.barns_checked')}</div>
          </div>
          <div style="font-size:28px;">→</div>
        </button>`).join('')}
      </div>`;
  }
}

// ── MW Section (Morning Walk) ──
var _mwSectionFarm = null;

function openMWSection() {
  _mwSectionFarm = null;
  document.getElementById('mw-section').style.display = 'block';
  document.getElementById('mw-section').scrollTop = 0;
  renderMWContent();
}

function mwBack() {
  if (_mwSectionFarm) { _mwSectionFarm = null; renderMWContent(); }
  else { document.getElementById('mw-section').style.display = 'none'; }
}

function renderMWContent() {
  const ms = typeof MORNING_STATUS !== 'undefined' ? MORNING_STATUS : {};
  const hdr = document.getElementById('mw-header');
  const btn = document.getElementById('mw-back-btn');
  if (_mwSectionFarm) {
    if (hdr) hdr.textContent = '☀️ ' + _mwSectionFarm;
    if (btn) btn.textContent = t('btn.back_farms');
    const cnt = _mwSectionFarm === 'Hegins' ? 8 : 5;
    let html = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">`;
    for (let i = 1; i <= cnt; i++) {
      const key = _mwSectionFarm + '-' + i;
      const st  = ms[key] || 'pending';
      const bc  = st==='done'?'#4a90d9':st==='issue'?'#e53e3e':'#1e3a6a';
      const bg  = st==='done'?'#0d2a4a':st==='issue'?'#2a1a1a':'#091529';
      const nc  = st==='done'?'#f0ead8':st==='issue'?'#f0ead8':'#3a5a8a';
      const ic  = st==='done'?'<div style="font-size:14px;color:#4a90d9;margin-top:4px;">✓</div>':
                  st==='issue'?'<div style="font-size:14px;color:#e53e3e;margin-top:4px;">⚠</div>':
                  '<div style="font-size:14px;color:#1e3a6a;margin-top:4px;">—</div>';
      html += `<div style="background:${bg};border:2px solid ${bc};border-radius:12px;padding:16px 4px;text-align:center;cursor:pointer;" onclick="openMorningWalk('${_mwSectionFarm}',${i})">
        <div style="font-size:9px;color:#3a5a8a;letter-spacing:1px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;">Barn</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:700;color:${nc};line-height:1.1;">${i}</div>
        ${ic}
      </div>`;
    }
    html += `</div>`;
    document.getElementById('mw-content').innerHTML = html;
  } else {
    if (hdr) hdr.textContent = '☀️ ' + t('prod.morning_walk');
    if (btn) btn.textContent = t('btn.close');
    const msDone = f => Object.entries(ms).filter(([k,v])=>k.startsWith(f+'-')&&(v==='done'||v==='issue')).length;
    const msCnt  = f => f==='Hegins'?8:5;
    document.getElementById('mw-content').innerHTML = `
      <div style="font-size:13px;color:#3a5a8a;margin-bottom:20px;font-family:'IBM Plex Mono',monospace;">${t('prod.select_walk')}</div>
      <div style="display:grid;gap:14px;">
        ${['Hegins','Danville'].map(f=>`
        <button onclick="_mwSectionFarm='${f}';renderMWContent()" style="width:100%;padding:28px 20px;background:#0d1f3a;border:2px solid #1e3a6a;border-radius:16px;color:#fff;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#f0ead8;">📍 ${f}</div>
            <div style="font-size:12px;color:#6a90d9;margin-top:6px;">${msDone(f)}/${msCnt(f)} ${t('prod.barns_walked')}</div>
          </div>
          <div style="font-size:28px;">→</div>
        </button>`).join('')}
      </div>`;
  }
}

// ── Employee Daily Barn Check ──
var _bwFarm = '', _bwHouse = 0, _bwData = {}, _bwChecklist = {}, _bwDocId = null;

const _BW_WEEKLY = {
  2: { // Tuesday
    title: '📅 Weekly Task — Fly Test (Tuesday)',
    note: 'Open a new fly trap and walk the house.',
    steps: [
      'Open a fly trap and walk down an aisle to the end of the house.',
      'Walk back to the front up a different aisle, holding the fly trap at waist level.',
      'Count the flies caught on the trap — record on the whiteboard at the front of the house.',
      'Hang the fly trap in the house.',
      'Discard the fly trap from the previous week.',
      'Notify the barn manager if you are low on bait.'
    ]
  },
  5: { // Friday
    title: '📅 Weekly Task — Rodent Check (Friday)',
    note: 'Check all traps and bait on top & bottom floors.',
    steps: [
      'Check rodent traps on the top & bottom floors on the outside aisles — empty into a bucket.',
      'Count the rodents caught — record below and on the whiteboard at the front of the house.',
      'Check bait boxes & bait tubes on the top & bottom floors on the outside aisles.',
      'Add more bait if any bait boxes or bait tubes are empty.',
      'Notify the barn manager if you are low on bait.'
    ],
    fields: [
      { id: 'bw-weekly-rodent-count', label: 'Rodents Caught (count)', type: 'number', placeholder: '0' }
    ]
  }
};

function bwInitChecklist() {
  _bwChecklist = {};
  document.querySelectorAll('#bw-checklist-items .bw-cl-row').forEach(el => {
    el.classList.remove('bw-pass','bw-fail');
    el.querySelectorAll('.bw-cl-pass,.bw-cl-fail-btn').forEach(b => b.classList.remove('active'));
  });
  document.querySelectorAll('#bw-checklist-items .bw-cl-fail-detail').forEach(el => el.style.display='none');
  document.querySelectorAll('#bw-checklist-items input[id^="bw-cl-note-"]').forEach(el => el.value='');
  bwUpdateTimeBadge();

  // Clean Under Cages — House 1: Sun(0)/Thu(4), House 2: Mon(1)/Sat(6)
  const _CAGE_CLEAN_DAYS = { 1: [0, 4], 2: [1, 6] };
  const cageCard = document.getElementById('bw-cage-clean-card');
  const cageStatus = document.getElementById('bw-cage-clean-status');
  if (cageStatus) { cageStatus.style.display = 'none'; cageStatus.textContent = ''; }
  const todayDay = new Date().getDay();
  const scheduledDays = _CAGE_CLEAN_DAYS[_bwHouse];
  if (scheduledDays && scheduledDays.includes(todayDay)) {
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    document.getElementById('bw-cage-clean-note').textContent =
      'Scheduled for House ' + _bwHouse + ' on ' + scheduledDays.map(d => dayNames[d]).join(' & ') + ' each week';
    cageCard.style.display = 'block';
  } else {
    cageCard.style.display = 'none';
  }

  const day = new Date().getDay();
  const weekly = _BW_WEEKLY[day];
  const card = document.getElementById('bw-weekly-card');
  if (weekly) {
    document.getElementById('bw-weekly-title').textContent = weekly.title;
    const fieldsHtml = (weekly.fields||[]).map(f =>
      `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #2a5a2a;">
        <div class="bw-row-label">${f.label}</div>
        <input type="${f.type}" id="${f.id}" class="bw-input" placeholder="${f.placeholder||''}" min="0">
      </div>`
    ).join('');
    document.getElementById('bw-weekly-content').innerHTML =
      `<div style="font-size:11px;color:#5a8a5a;margin-bottom:10px;font-family:'IBM Plex Mono',monospace;">${weekly.note}</div>` +
      weekly.steps.map((s, i) =>
        `<div class="bw-weekly-step"><span class="bw-step-num">${i+1}.</span><span>${s}</span></div>`
      ).join('') + fieldsHtml;
    card.style.display = 'block';
  } else {
    card.style.display = 'none';
  }
}

// ── Checklist time badge ──
function bwUpdateTimeBadge() {
  const badge = document.getElementById('bw-time-badge');
  const prog  = document.getElementById('bw-checklist-progress');
  const rows  = document.querySelectorAll('#bw-checklist-items .bw-cl-row');
  let remaining = 0, total = 0, done = 0;
  rows.forEach(row => {
    const mins = parseInt(row.dataset.minutes || '0');
    total += mins;
    const checked = _bwChecklist[row.id.replace('bw-cl-','')];
    if (checked) { done++; } else { remaining += mins; }
  });
  const fmt = m => m >= 60 ? Math.floor(m/60) + 'h ' + (m%60 ? (m%60) + 'm' : '') : m + 'm';
  if (badge) {
    if (done === rows.length) {
      badge.textContent = '✅ All tasks reviewed';
      badge.style.color = '#4caf50'; badge.style.borderColor = '#2a5a2a';
    } else {
      badge.textContent = '⏱ ~' + fmt(remaining).trim() + ' remaining';
      badge.style.color = '#3a6a3a'; badge.style.borderColor = '#1a4a1a';
    }
  }
  if (prog) {
    const fails = Object.values(_bwChecklist).filter(v => v === 'fail').length;
    prog.textContent = done + ' / ' + rows.length + ' reviewed' + (fails ? ' · ' + fails + ' ⚠️ FAIL' : '');
    prog.style.color = fails ? '#e53e3e' : done === rows.length ? '#4caf50' : '#5a8a5a';
  }
}

// ── Barn Walk Draft Persistence ──
function bwSaveDraft() {
  if (!_bwFarm) return;
  const today = new Date().toISOString().slice(0,10);
  const fields = {};
  ['bw-employee','bw-notes','bw-mort-count','bw-loose-count','bw-rodent-count',
   'bw-fly-count','bw-egg-count','bw-weekly-rodent-count','bw-feed-bin-reading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) fields[id] = el.value;
  });
  const clNotes = {};
  document.querySelectorAll('#bw-checklist-items input[id^="bw-cl-note-"]').forEach(el => {
    clNotes[el.id.replace('bw-cl-note-', '')] = el.value;
  });
  try {
    localStorage.setItem('bwDraft-' + _bwFarm + '-' + _bwHouse + '-' + today,
      JSON.stringify({ fields, bwData: _bwData, bwChecklist: _bwChecklist, clNotes, ts: Date.now() }));
  } catch(e) {}
}

function bwRestoreFromData(data) {
  if (data.fields) {
    Object.entries(data.fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
  }
  if (data.bwData) {
    Object.entries(data.bwData).forEach(([key, val]) => {
      if (val == null) return;
      if (key.startsWith('_')) { _bwData[key] = val; return; }
      bwSet(key, val);
    });
  }
  if (data.bwChecklist) {
    Object.entries(data.bwChecklist).forEach(([key, val]) => {
      _bwChecklist[key] = val;
      const row    = document.getElementById('bw-cl-' + key);
      const detail = document.getElementById('bw-cl-det-' + key);
      if (!row) return;
      row.querySelectorAll('.bw-cl-pass').forEach(b => b.classList.remove('active'));
      row.querySelectorAll('.bw-cl-fail-btn').forEach(b => b.classList.remove('active'));
      const btn = row.querySelector(val === 'pass' ? '.bw-cl-pass' : '.bw-cl-fail-btn');
      if (btn) btn.classList.add('active');
      row.classList.remove('bw-pass','bw-fail');
      row.classList.add(val === 'pass' ? 'bw-pass' : 'bw-fail');
      if (detail) detail.style.display = val === 'fail' ? 'block' : 'none';
    });
    const total    = document.querySelectorAll('#bw-checklist-items .bw-cl-row').length;
    const reviewed = Object.keys(_bwChecklist).length;
    const fails    = Object.values(_bwChecklist).filter(v => v === 'fail').length;
    const prog     = document.getElementById('bw-checklist-progress');
    if (prog) {
      prog.textContent = reviewed + ' / ' + total + ' reviewed' + (fails ? ' · ' + fails + ' ⚠️ FAIL' : '');
      prog.style.color = fails ? '#e53e3e' : (reviewed === total ? '#4caf50' : '#5a8a5a');
    }
  }
  if (data.clNotes) {
    Object.entries(data.clNotes).forEach(([key, val]) => {
      const el = document.getElementById('bw-cl-note-' + key);
      if (el) el.value = val;
    });
  }
  bwUpdateTimeBadge();
  // Restore cage clean status display if present
  if (_bwData._cageCleanEmployee && _bwData.cageclean) {
    const statusEl = document.getElementById('bw-cage-clean-status');
    if (statusEl) {
      const v = _bwData.cageclean;
      statusEl.textContent = (v === 'complete' ? '✅ Completed' : '❌ Incomplete')
        + ' · ' + _bwData._cageCleanEmployee + ' · ' + (_bwData._cageCleanTime || '');
      statusEl.style.background  = v === 'complete' ? '#0f3a1a' : '#2d1a1a';
      statusEl.style.borderColor = v === 'complete' ? '#4caf50' : '#e53e3e';
      statusEl.style.color       = v === 'complete' ? '#7ad07a' : '#e57373';
      statusEl.style.display = 'block';
    }
  }
  checkBWReady();
}

function bwRecordToDraft(rec) {
  return {
    fields: {
      'bw-employee':            rec.employee   || '',
      'bw-notes':               rec.notes      || '',
      'bw-mort-count':          rec.mortCount  != null ? String(rec.mortCount)  : '',
      'bw-loose-count':         rec.looseCount != null ? String(rec.looseCount) : '',
      'bw-rodent-count':        rec.rodentCount!= null ? String(rec.rodentCount): '',
      'bw-fly-count':           rec.flyCount   != null ? String(rec.flyCount)   : '',
      'bw-egg-count':           rec.eggCount   != null ? String(rec.eggCount)   : '',
      'bw-weekly-rodent-count': rec.weeklyRodentCount != null ? String(rec.weeklyRodentCount) : '',
      'bw-feed-bin-reading':    rec.feedBinReading    != null ? String(rec.feedBinReading)    : '',
    },
    bwData: {
      mort: rec.mort, feather: rec.feather, air: rec.air, feed: rec.feed,
      rodent: rec.rodent, loose: rec.loose, dryers: rec.dryers,
      eggbelt: rec.eggbelt, stand: rec.stand,
      fly: rec.fly, mortrem: rec.mortrem, doors: rec.doors, cageclean: rec.cageClean,
      footpan: rec.footpan, waste: rec.waste,
      _cageCleanEmployee: rec.cageCleanEmployee || '',
      _cageCleanTime:     rec.cageCleanTime     || '',
    },
    bwChecklist: rec.checklist || {},
    clNotes:     rec.checklistNotes || {},
  };
}

// items that auto-generate a WO on fail
const _BW_WO_ITEMS = {
  birdcheck:  { desc:'Issues found during bird check — see notes', problem:'Building / Structure', priority:'urgent' },
  watertubes: { desc:'Water tubes not cleaned / issue',            problem:'Watering System',      priority:'normal' },
};

function bwSetCheck(key, val, btn) {
  _bwChecklist[key] = val;
  const row    = document.getElementById('bw-cl-' + key);
  const detail = document.getElementById('bw-cl-det-' + key);
  // Reset button styles in this row
  row.querySelectorAll('.bw-cl-pass').forEach(b => b.classList.remove('active'));
  row.querySelectorAll('.bw-cl-fail-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Row color
  row.classList.remove('bw-pass','bw-fail');
  row.classList.add(val === 'pass' ? 'bw-pass' : 'bw-fail');
  // Show/hide fail detail
  if (detail) detail.style.display = val === 'fail' ? 'block' : 'none';
  bwUpdateTimeBadge();
  bwSaveDraft();
}

function openBarnWalk(farm, house) {
  _bwFarm = farm; _bwHouse = house; _bwData = {}; _bwDocId = null;
  document.getElementById('bw-title').textContent = farm + ' — Barn ' + house;
  document.getElementById('bw-subtitle').textContent = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  ['bw-employee','bw-notes','bw-temp','bw-water-psi','bw-mort-count','bw-loose-count','bw-rodent-count','bw-fly-count','bw-egg-count'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('bw-mort-count-row').style.display    = 'none';
  document.getElementById('bw-loose-count-row').style.display   = 'none';
  document.getElementById('bw-rodent-count-row').style.display  = 'none';
  document.getElementById('bw-fly-count-row').style.display     = 'none';
  document.getElementById('bw-eggbelt-wo-note').style.display   = 'none';
  document.querySelectorAll('#barn-walk-modal .bw-yn-btn').forEach(b => b.className = 'bw-yn-btn');
  bwInitChecklist();

  // Remove any stale submitted banner and reset submit button
  const oldBanner = document.getElementById('bw-submitted-banner');
  if (oldBanner) oldBanner.remove();
  const submitBtn = document.getElementById('bw-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submit';
  submitBtn.style.background = '';

  document.getElementById('barn-walk-modal').style.display = 'block';
  document.getElementById('barn-walk-modal').scrollTop = 0;
  applyFormTextTranslation();

  // Auto-save on any text input inside the modal
  const modal = document.getElementById('barn-walk-modal');
  modal._bwInputHandler = modal._bwInputHandler || function() { bwSaveDraft(); };
  modal.removeEventListener('input', modal._bwInputHandler);
  modal.addEventListener('input', modal._bwInputHandler);

  const today = new Date().toISOString().slice(0,10);
  const draftKey = 'bwDraft-' + farm + '-' + house + '-' + today;

  // 1. Check for an in-progress draft first
  try {
    const draftStr = localStorage.getItem(draftKey);
    if (draftStr) {
      const draft = JSON.parse(draftStr);
      bwRestoreFromData(draft);
      return;
    }
  } catch(e) {}

  // 2. Check Firestore for today's already-submitted walk
  db.collection('barnWalks')
    .where('farm','==',farm).where('house','==',String(house)).where('date','==',today)
    .limit(1).get()
    .then(snap => {
      if (!snap.empty) {
        _bwDocId = snap.docs[0].id;
        bwRestoreFromData(bwRecordToDraft(snap.docs[0].data()));
        // Show "editing previous submission" banner
        let banner = document.getElementById('bw-submitted-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'bw-submitted-banner';
          banner.style.cssText = 'background:#0f2a3a;border:1px solid #3a8ac0;border-radius:8px;padding:10px 14px;margin:0 0 12px;color:#7ab8d0;font-size:12px;font-family:"IBM Plex Mono",monospace;text-align:center;';
          const sb = document.getElementById('bw-submit-btn');
          if (sb) sb.parentNode.insertBefore(banner, sb);
        }
        banner.textContent = '✏️ Editing today\'s submission — changes will update the existing record';
        const sb = document.getElementById('bw-submit-btn');
        if (sb) { sb.textContent = 'Update Submission'; sb.style.background = '#1a3a4a'; }
        return;
      }
      // 3. No draft, no submission — pre-fill employee from last barn walk
      db.collection('barnWalks').where('farm','==',farm).where('house','==',String(house))
        .limit(20).get()
        .then(snap2 => {
          if (snap2.empty) return;
          const docs = snap2.docs.map(d => d.data()).sort((a,b) => (b.ts||0) - (a.ts||0));
          const e = document.getElementById('bw-employee');
          if (e && !e.value) { e.value = docs[0].employee || ''; checkBWReady(); }
        }).catch(()=>{});
    }).catch(()=>{});
}

function closeBarnWalk() {
  document.getElementById('barn-walk-modal').style.display = 'none';
}

async function clOpenTaskWI(taskId, taskLabel) {
  // Step 1: close ALL barn walk overlays before navigating
  if (typeof closeBarnEntry === 'function') closeBarnEntry();
  if (typeof closeBarnWalk  === 'function') closeBarnWalk();
  const bwModal = document.getElementById('barn-walk-modal');
  if (bwModal) bwModal.style.display = 'none';
  const beOverlay = document.getElementById('barn-entry-overlay');
  if (beOverlay) { beOverlay.style.display = 'none'; document.body.style.overflow = ''; }
  if (typeof go === 'function') go('maint');
  if (typeof goMaintSection === 'function') goMaintSection('wi');

  // Step 2: load WIs if not yet loaded
  try {
    if (!allWI || !allWI.length) {
      if (typeof loadWIFallback === 'function') await loadWIFallback();
      else if (typeof loadWI === 'function') await loadWI();
    }
  } catch(e) {}

  // Step 3: find matching WI
  const wi = (typeof allWI !== 'undefined' ? allWI : []);
  let matches = wi.filter(w => w.clTaskId === taskId);
  if (!matches.length && taskLabel) {
    const words = taskLabel.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    matches = wi.filter(w => {
      const t = (w.title || '').toLowerCase();
      return words.length > 0 && words.some(word => t.includes(word));
    });
  }

  // Step 4: open WI viewer or pre-fill create form
  setTimeout(() => {
    if (matches.length > 0) {
      if (typeof openWIView === 'function') openWIView(matches[0].wiId);
    } else {
      // Pre-fill search with task label so user can see what's available
      const el = document.getElementById('wi-search');
      if (el) { el.value = taskLabel; if (typeof wiSearch === 'function') wiSearch(); }
      if (typeof _openWIForm === 'function') _openWIForm(null, taskId, taskLabel, 'Barn / Layer');
    }
  }, 150);
}

function bwSet(key, val) {
  _bwData[key] = val;
  const badge = {
    mort:    {yes:'bw-no-sel',  no:'bw-yes-sel'},
    footpan: {ok:'bw-yes-sel',  clean:'bw-warn-sel', replace:'bw-no-sel'},
    mortrem: {yes:'bw-yes-sel', no:'bw-no-sel'},
    dryers:  {on:'bw-yes-sel',  off:'bw-warn-sel'},
    feather: {good:'bw-yes-sel',fair:'bw-warn-sel',  poor:'bw-no-sel'},
    doors:   {open:'bw-sel',    closed:'bw-sel'},
    loose:   {yes:'bw-no-sel',  no:'bw-yes-sel'},
    air:     {good:'bw-yes-sel',poor:'bw-no-sel'},
    feed:    {full:'bw-yes-sel',empty:'bw-no-sel'},
    waste:   {yes:'bw-warn-sel',no:'bw-yes-sel'},
    stand:   {clean:'bw-yes-sel',dirty:'bw-no-sel'},
    eggbelt: {working:'bw-yes-sel',down:'bw-no-sel'},

    rodent:    {yes:'bw-no-sel',  no:'bw-yes-sel'},
    fly:       {yes:'bw-warn-sel',no:'bw-yes-sel'},
    cageclean: {complete:'bw-yes-sel', incomplete:'bw-no-sel'},
  };
  document.querySelectorAll(`#barn-walk-modal .bw-yn-btn[id^="bw-${key}-"]`).forEach(b => b.className = 'bw-yn-btn');
  const sel = document.getElementById(`bw-${key}-${val}`);
  if (sel) sel.className = 'bw-yn-btn ' + (badge[key]?.[val] || 'bw-sel');
  if (key === 'mort')  document.getElementById('bw-mort-count-row').style.display  = val==='yes' ? 'block' : 'none';
  if (key === 'loose')   document.getElementById('bw-loose-count-row').style.display   = val==='yes'  ? 'block' : 'none';
  if (key === 'rodent')  document.getElementById('bw-rodent-count-row').style.display  = val==='yes'  ? 'block' : 'none';
  if (key === 'fly')     document.getElementById('bw-fly-count-row').style.display     = val==='yes'  ? 'block' : 'none';
  if (key === 'eggbelt') document.getElementById('bw-eggbelt-wo-note').style.display   = val==='down' ? 'block' : 'none';
  if (key === 'cageclean') {
    const emp  = (document.getElementById('bw-employee')?.value || '').trim() || 'Unknown';
    const time = new Date().toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
    _bwData._cageCleanEmployee = emp;
    _bwData._cageCleanTime     = time;
    const statusEl = document.getElementById('bw-cage-clean-status');
    if (statusEl) {
      statusEl.textContent = (val === 'complete' ? '✅ Completed' : '❌ Incomplete') + ' · ' + emp + ' · ' + time;
      statusEl.style.background = val === 'complete' ? '#0f3a1a' : '#2d1a1a';
      statusEl.style.borderColor = val === 'complete' ? '#4caf50' : '#e53e3e';
      statusEl.style.color = val === 'complete' ? '#7ad07a' : '#e57373';
      statusEl.style.display = 'block';
    }
  }
  checkBWReady();
  bwSaveDraft();
}

function checkBWReady() {
  const emp  = (document.getElementById('bw-employee')?.value || '').trim();
  const mort = _bwData.mort !== undefined;
  const feed = _bwData.feed !== undefined;
  document.getElementById('bw-submit-btn').disabled = !(emp && mort && feed);
}

async function submitBarnWalk() {
  const employee   = document.getElementById('bw-employee').value.trim();
  const notes      = document.getElementById('bw-notes').value.trim();
  const waterPSI   = null; // field removed from Daily Employee Check
  const temp       = null; // field removed from Daily Employee Check
  const mortCount  = document.getElementById('bw-mort-count').value ? Number(document.getElementById('bw-mort-count').value) : null;
  const looseCount  = document.getElementById('bw-loose-count').value  ? Number(document.getElementById('bw-loose-count').value)  : null;
  const rodentCount = document.getElementById('bw-rodent-count').value ? Number(document.getElementById('bw-rodent-count').value) : null;
  const flyCount    = document.getElementById('bw-fly-count').value    ? Number(document.getElementById('bw-fly-count').value)    : null;
  const weeklyRodentCount = document.getElementById('bw-weekly-rodent-count')?.value ? Number(document.getElementById('bw-weekly-rodent-count').value) : null;
  const feedBinReading    = document.getElementById('bw-feed-bin-reading')?.value ? Number(document.getElementById('bw-feed-bin-reading').value) : null;

  const flags = [];
  // NOTE: Mortality and Loose Birds are logged to mortalityLog only — never create a WO
  if (_bwData.dryers === 'off')         flags.push('Manure dryers off');
  if (_bwData.feather === 'poor')       flags.push('Poor feathering');
  if (_bwData.air === 'poor')           flags.push('Air quality anomaly');
  if (_bwData.feed === 'empty')         flags.push('Feeders empty');
  if (_bwData.eggbelt === 'down')       flags.push('Egg belt not working');

  // Pest observations are saved to pestLog — not added to flags/WO queue
  if (_bwData.doors === 'open')         flags.push('House doors open');

  const checklistTotal  = document.querySelectorAll('#bw-checklist-items .bw-cl-row').length;
  const checklistFails  = Object.entries(_bwChecklist).filter(([,v]) => v === 'fail').map(([k]) => k);
  const checklistPasses = Object.entries(_bwChecklist).filter(([,v]) => v === 'pass').map(([k]) => k);
  // Collect checklist fail notes
  const checklistNotes = {};
  checklistFails.forEach(k => {
    const el = document.getElementById('bw-cl-note-' + k);
    if (el && el.value.trim()) checklistNotes[k] = el.value.trim();
  });
  if (checklistFails.length) flags.push('Checklist failures: ' + checklistFails.join(', '));

  const record = {
    farm: _bwFarm, house: String(_bwHouse), employee, notes, flags,
    waterPSI, temp, mortCount, looseCount, rodentCount, flyCount, weeklyRodentCount, feedBinReading,
    mort: _bwData.mort, feather: _bwData.feather, air: _bwData.air,
    feed: _bwData.feed, rodent: _bwData.rodent, loose: _bwData.loose,
    dryers: _bwData.dryers, eggbelt: _bwData.eggbelt,
    stand: _bwData.stand, fly: _bwData.fly, mortrem: _bwData.mortrem,
    doors: _bwData.doors,
    checklist: _bwChecklist, checklistNotes,
    checklistFails: checklistFails.length, checklistTotal,
    cageClean: _bwData.cageclean || null,
    cageCleanEmployee: _bwData._cageCleanEmployee || null,
    cageCleanTime: _bwData._cageCleanTime || null,
    date: new Date().toISOString().slice(0,10),
    time: new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
    ts: Date.now()
  };

  try {
    if (_bwDocId) {
      await db.collection('barnWalks').doc(_bwDocId).set(record);
    } else {
      const docRef = await db.collection('barnWalks').add(record);
      _bwDocId = docRef.id;
    }
  } catch(e) { console.error(e); }

  // ── Activity Log ──
  try {
    const statusDesc = flags.length > 0
      ? flags.length + ' flag' + (flags.length !== 1 ? 's' : '')
      : 'All Clear';
    await db.collection('activityLog').add({
      type: 'barnwalk',
      id: 'BW-' + _bwFarm + '-H' + _bwHouse,
      desc: 'Daily barn check: ' + _bwFarm + ' Barn ' + _bwHouse + ' — ' + statusDesc
        + (_bwData.feed === 'empty' ? ' ⚠ Feed Empty' : '')
        + (_bwData.mort === 'yes' ? ' ⚠ Mortality' + (mortCount ? ' (' + mortCount + ')' : '') : '')
        + (flags.length > 0 ? ' · Flags: ' + flags.slice(0, 2).join(', ') + (flags.length > 2 ? '…' : '') : ''),
      tech: employee,
      farm: _bwFarm,
      house: String(_bwHouse),
      feed: _bwData.feed,
      water: _bwData.stand,
      fans: _bwData.air,
      mort: _bwData.mort,
      mortCount: mortCount || 0,
      flagCount: flags.length,
      date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}),
      ts: Date.now()
    });
  } catch(e) { console.warn('activityLog write failed:', e); }

  // ── Mortality Log ──
  // Always log mortality — never creates a WO
  // Log mortality — never creates a WO
  if (_bwData.mort === 'yes') {
    const mortEntry = {
      farm: _bwFarm, house: String(_bwHouse), employee,
      date: new Date().toISOString().slice(0,10),
      time: new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
      type: 'mortality',
      mortCount: mortCount || 0,
      mortrem: _bwData.mortrem || 'yes',
      notes: notes || '',
      ts: Date.now()
    };
    try { await db.collection('mortalityLog').add(mortEntry); } catch(e) { console.error('mortalityLog write failed:', e); }
  }

  // Log loose birds — never creates a WO
  if (_bwData.loose === 'yes') {
    const looseEntry = {
      farm: _bwFarm, house: String(_bwHouse), employee,
      date: new Date().toISOString().slice(0,10),
      time: new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
      type: 'loose',
      looseCount: looseCount || 0,
      notes: notes || '',
      ts: Date.now()
    };
    try { await db.collection('mortalityLog').add(looseEntry); } catch(e) { console.error('looseLog write failed:', e); }
  }

  // ── Pest Log ──
  // Always log pest observations — never creates a WO
  const hasPest = _bwData.rodent === 'yes' || _bwData.fly === 'yes';
  if (hasPest) {
    const pestEntry = {
      farm: _bwFarm, house: String(_bwHouse), employee,
      date: new Date().toISOString().slice(0,10),
      time: new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
      rodent: _bwData.rodent || 'no', rodentCount: rodentCount || 0,
      fly: _bwData.fly || 'no', flyCount: flyCount || 0,
      notes: notes || '',
      ts: Date.now()
    };
    try { await db.collection('pestLog').add(pestEntry); } catch(e) { console.error('pestLog write failed:', e); }
  }

  // Feed bin reading is saved live via liveUpdateFeedBin (onchange) — no duplicate save needed here.

  // Auto-save egg count to opsEggProduction (replaces Egg Ops form)
  const eggCount = parseInt(document.getElementById('bw-egg-count')?.value||'0')||0;
  if (eggCount > 0) {
    try {
      const eggRec = { date: new Date().toISOString().slice(0,10), farm: _bwFarm, house: String(_bwHouse),
        shift: shiftFromTime(), eggs: eggCount, by: employee, notes: 'From daily barn check', ts: Date.now() };
      const eggRef = await db.collection('opsEggProduction').add(eggRec);
      eggRec._fbId = eggRef.id;
      opsEggData.unshift(eggRec);
    } catch(e) { console.error(e); }
  }

  // Auto-create WOs for checklist failures that warrant one
  const submitted = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const woDate    = new Date().toISOString().slice(0,10);
  for (const key of checklistFails) {
    if (!_BW_WO_ITEMS[key]) continue;
    try {
      const {desc, problem, priority} = _BW_WO_ITEMS[key];
      const woId = 'WO-' + String(woCounter || 900).padStart(3,'0');
      woCounter = (woCounter || 900) + 1;
      const extraNote = checklistNotes[key] ? ' — ' + checklistNotes[key] : '';
      await db.collection('workOrders').add({
        id: woId, farm: _bwFarm, house: String(_bwHouse),
        problem, priority, status: 'open',
        desc: desc + extraNote,
        tech: employee,
        notes: 'Auto-created from daily checklist — ' + _bwFarm + ' Barn ' + _bwHouse,
        submitted, date: woDate, ts: Date.now()
      });
    } catch(e) { console.error(e); }
  }

  const key = _bwFarm + '-' + _bwHouse;
  BARN_STATUS[key] = flags.length > 0 ? 'issue' : 'done';
  if (mortCount) _todayMortTotal += mortCount;

  // Map each flag to a problem category and priority.
  // Mortality, loose birds, and pest are logged to their own collections — never WOs.
  // Checklist failures are handled individually above (_BW_WO_ITEMS loop) — skip here.
  const flagProblemMap = {
    'Manure dryers off':          {problem:'Manure System',       priority:'high'},

    'Poor feathering':            {problem:'Building / Structure', priority:'normal'},
    'House doors open':           {problem:'Building / Structure', priority:'high'},
    'Air quality anomaly':        {problem:'Ventilation / Fans',  priority:'urgent'},
    'Feeders empty':              {problem:'Feed System',         priority:'urgent'},
    'Egg belt not working':       {problem:'Egg Collection',      priority:'urgent'},
  };
  for (const flag of flags) {
    // Checklist failures already handled above — skip to avoid duplicate WOs
    if (flag.startsWith('Checklist failures')) continue;
    // Mortality and loose birds go to mortalityLog only — never WOs
    if (flag.toLowerCase().includes('mort') || flag.toLowerCase().includes('loose')) continue;
    // Only create WOs for flags we explicitly recognise
    const mapKey = Object.keys(flagProblemMap).find(k => flag.startsWith(k));
    if (!mapKey) continue; // unknown flag — log it but don't create a WO
    try {
      const {problem, priority} = flagProblemMap[mapKey];
      const woId = 'WO-' + String(woCounter || 900).padStart(3,'0');
      woCounter = (woCounter || 900) + 1;
      await db.collection('workOrders').add({
        id: woId, farm: _bwFarm, house: String(_bwHouse),
        problem, priority, status: 'open',
        desc: flag,
        tech: employee,
        notes: 'Auto-created from employee daily check — ' + _bwFarm + ' Barn ' + _bwHouse,
        submitted, date: woDate, ts: Date.now()
      });
    } catch(e) { console.error(e); }
  }

  // Clear localStorage draft — data is now in Firestore
  const draftKey = 'bwDraft-' + _bwFarm + '-' + _bwHouse + '-' + record.date;
  try { localStorage.removeItem(draftKey); } catch(e) {}

  // Keep form open for editing; show success banner and update button label
  const sBtn = document.getElementById('bw-submit-btn');
  if (sBtn) {
    sBtn.disabled = false;
    sBtn.textContent = '✅ Submitted — Tap to Update';
    sBtn.style.background = '#1a4a1a';
  }
  let banner = document.getElementById('bw-submitted-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'bw-submitted-banner';
    banner.style.cssText = 'background:#0f3a1a;border:1px solid #4caf50;border-radius:8px;padding:10px 14px;margin:0 0 12px;color:#7ad07a;font-size:12px;font-family:"IBM Plex Mono",monospace;text-align:center;';
    if (sBtn) sBtn.parentNode.insertBefore(banner, sBtn);
  }
  banner.style.cssText = 'background:#0f3a1a;border:1px solid #4caf50;border-radius:8px;padding:10px 14px;margin:0 0 12px;color:#7ad07a;font-size:12px;font-family:"IBM Plex Mono",monospace;text-align:center;';
  banner.textContent = '✅ Saved at ' + record.time + ' — edit any field above and tap Update to re-save';

  renderProdPanel();
  renderECContent();
  if (document.getElementById('panel-dash')?.classList.contains('active')) renderDash();
}

// ── Morning Walk (Lead / WNO) ──
var _mwFarm = '', _mwHouse = 0, _mwData = {};

function openMorningWalk(farm, house) {
  _mwFarm = farm; _mwHouse = house; _mwData = {};
  document.getElementById('mw-title').textContent = farm + ' — Barn ' + house;
  ['mw-employee','mw-water','mw-temp','mw-notes','mw-ee-count'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.querySelectorAll('#morning-walk-modal .bw-yn-btn').forEach(b => b.className = 'bw-yn-btn');
  document.getElementById('mw-submit-btn').disabled = true;
  document.getElementById('morning-walk-modal').style.display = 'block';
  document.getElementById('morning-walk-modal').scrollTop = 0;
  // Pre-populate employee from last submission for this barn
  db.collection('morningWalks').where('farm','==',farm).where('house','==',String(house))
    .limit(20).get()
    .then(snap => {
      if (snap.empty) return;
      const docs = snap.docs.map(d => d.data()).sort((a,b) => (b.ts||0) - (a.ts||0));
      const l = docs[0];
      const e = document.getElementById('mw-employee');
      if (e && !e.value) { e.value = l.employee || ''; checkMWReady(); }
    }).catch(()=>{});
}

function closeMorningWalk() {
  document.getElementById('morning-walk-modal').style.display = 'none';
}

function mwCheckBinLevel(inputId, statusId) {
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);
  if (!input || !status) return;
  const val = parseFloat(input.value);
  if (isNaN(val) || input.value === '') { status.textContent = ''; return; }
  if (val < 1)        { status.style.color = '#e53e3e'; status.textContent = '🔴 CRITICAL — Order feed now'; }
  else if (val < 2.5) { status.style.color = '#d69e2e'; status.textContent = '🟡 Low — Order soon'; }
  else if (val < 5)   { status.style.color = '#4ade80'; status.textContent = '🟢 Moderate'; }
  else                { status.style.color = '#4ade80'; status.textContent = '🟢 Good'; }
}

function mwSet(key, val) {
  _mwData[key] = val;
  const badge = {
    feed:    {yes:'bw-yes-sel', no:'bw-no-sel'},
    fans:    {yes:'bw-yes-sel', no:'bw-no-sel'},
    blowers: {yes:'bw-yes-sel', no:'bw-no-sel'},
  };
  document.querySelectorAll(`#morning-walk-modal .bw-yn-btn[id^="mw-${key}-"]`).forEach(b => b.className = 'bw-yn-btn');
  const sel = document.getElementById(`mw-${key}-${val}`);
  if (sel) sel.className = 'bw-yn-btn ' + (badge[key]?.[val] || 'bw-sel');
  checkMWReady();
}

function checkMWReady() {
  const emp   = (document.getElementById('mw-employee')?.value || '').trim();
  const water = (document.getElementById('mw-water')?.value || '').trim();
  const temp  = (document.getElementById('mw-temp')?.value || '').trim();
  const ready = emp && water && temp &&
    _mwData.feed !== undefined && _mwData.fans !== undefined && _mwData.blowers !== undefined;
  document.getElementById('mw-submit-btn').disabled = !ready;
}

async function submitMorningWalk() {
  const employee = document.getElementById('mw-employee').value.trim();
  const notes    = document.getElementById('mw-notes').value.trim();
  const waterPSI = Number(document.getElementById('mw-water').value) || 0;
  const temp     = Number(document.getElementById('mw-temp').value) || 0;
  const eeCount  = document.getElementById('mw-ee-count').value !== '' ? Number(document.getElementById('mw-ee-count').value) : null;

  const flags = [];
  if (waterPSI < 10 || waterPSI > 60) flags.push('Water pressure out of range (' + waterPSI + ' PSI)');
  if (_mwData.feed === 'no')           flags.push('Feeders not running');
  if (_mwData.fans === 'no')           flags.push('Fan issue');
  if (_mwData.blowers === 'no')        flags.push('Blower issue');

  const feedMeterReading = document.getElementById('mw-feed-meter')?.value ? Number(document.getElementById('mw-feed-meter').value) : null;
  const binA = document.getElementById('mw-bin-a')?.value !== '' ? Number(document.getElementById('mw-bin-a').value) : null;
  const binB = document.getElementById('mw-bin-b')?.value !== '' ? Number(document.getElementById('mw-bin-b').value) : null;
  if (binA !== null && binA < 1)   flags.push('Bin A critically low (' + binA + ' tons)');
  if (binB !== null && binB < 1)   flags.push('Bin B critically low (' + binB + ' tons)');
  const record = {
    farm: _mwFarm, house: String(_mwHouse), employee, notes, flags,
    waterPSI, temp, eeCount, feedMeterReading, binA, binB,
    feed: _mwData.feed, fans: _mwData.fans, blowers: _mwData.blowers,
    date: new Date().toISOString().slice(0,10),
    time: new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
    ts: Date.now()
  };

  try { await db.collection('morningWalks').add(record); } catch(e) { console.error(e); }

  // ── Activity Log ──
  try {
    const statusDesc = flags.length > 0
      ? flags.length + ' flag' + (flags.length !== 1 ? 's' : '')
      : 'All Clear';
    await db.collection('activityLog').add({
      type: 'barnwalk',
      id: 'BW-' + _mwFarm + '-H' + _mwHouse,
      desc: 'Morning walk: ' + _mwFarm + ' Barn ' + _mwHouse + ' — ' + statusDesc
        + (_mwData.feed === 'no' ? ' ⚠ Feeders not running' : '')
        + (_mwData.fans === 'no' ? ' ⚠ Fan issue' : '')
        + (flags.length > 0 ? ' · Flags: ' + flags.slice(0, 2).join(', ') + (flags.length > 2 ? '…' : '') : ''),
      tech: employee,
      farm: _mwFarm,
      house: String(_mwHouse),
      feed: _mwData.feed,
      fans: _mwData.fans,
      blowers: _mwData.blowers,
      waterPSI,
      flagCount: flags.length,
      date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}),
      ts: Date.now()
    });
  } catch(e) { console.warn('activityLog write failed:', e); }

  const key = _mwFarm + '-' + _mwHouse;
  MORNING_STATUS[key] = flags.length > 0 ? 'issue' : 'done';

  if (flags.length > 0) {
    try {
      const woId = 'WO-' + String(woCounter || 900).padStart(3,'0');
      woCounter = (woCounter||900) + 1;
      await db.collection('workOrders').add({
        id: woId, farm: _mwFarm, house: String(_mwHouse), system: 'Production',
        desc: 'Morning Walk Flag — ' + flags.join('; '), priority: 'high', status: 'open',
        tech: employee, notes: 'Auto-created from morning walk by ' + employee,
        submitted: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
        ts: Date.now(), date: new Date().toISOString().slice(0,10)
      });
    } catch(e) { console.error(e); }
  }

  closeMorningWalk();
  renderProdPanel();
  renderMWContent();
  if (document.getElementById('panel-dash')?.classList.contains('active')) renderDash();
}

// ── Today's Summary ──
async function openProdSummary() {
  document.getElementById('prod-summary-section').style.display = 'block';
  document.getElementById('prod-summary-section').scrollTop = 0;
  document.getElementById('prod-summary-content').innerHTML = '<div style="text-align:center;padding:40px;color:#5a5a3a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">Loading...</div>';
  const today = new Date().toISOString().slice(0,10);
  let walks = [], mWalks = [];
  try {
    const snap = await db.collection('barnWalks').where('date','==',today).get();
    walks = snap.docs.map(d => d.data());
  } catch(e) { console.error(e); }
  try {
    const snap = await db.collection('morningWalks').where('date','==',today).get();
    mWalks = snap.docs.map(d => d.data());
  } catch(e) { console.error(e); }
  renderProdSummary(walks, mWalks);
}

function renderProdSummary(walks, mWalks) {
  const dateStr = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  const farms = {Hegins:8, Danville:5};
  const totalMort  = walks.reduce((s,w) => s + (Number(w.mortCount)||0), 0);
  const totalLoose = walks.reduce((s,w) => s + (Number(w.looseCount)||0), 0);
  const totalFlags = walks.filter(w => w.flags && w.flags.length > 0).length;

  let html = `
    <div style="font-size:11px;color:#5a5a3a;font-family:'IBM Plex Mono',monospace;margin-bottom:14px;">${dateStr}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px;">
      <div style="background:#1a2a0a;border:1px solid #3a5a1a;border-radius:10px;padding:12px 6px;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#a0c060;">${walks.length}/13</div>
        <div style="font-size:9px;color:#5a6a3a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Checks</div>
      </div>
      <div style="background:${totalMort>0?'#2a0f0f':'#1a2a0a'};border:1px solid ${totalMort>0?'#5a2a2a':'#3a5a1a'};border-radius:10px;padding:12px 6px;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${totalMort>0?'#e53e3e':'#a0c060'};">${totalMort}</div>
        <div style="font-size:9px;color:#5a6a3a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Mortality</div>
      </div>
      <div style="background:${totalFlags>0?'#2a0f0f':'#1a2a0a'};border:1px solid ${totalFlags>0?'#5a2a2a':'#3a5a1a'};border-radius:10px;padding:12px 6px;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${totalFlags>0?'#e53e3e':'#a0c060'};">${totalFlags}</div>
        <div style="font-size:9px;color:#5a6a3a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Flagged</div>
      </div>
    </div>`;

  Object.entries(farms).forEach(([farm, cnt]) => {
    html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#7a9a5a;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #2a3a1a;">📍 ${farm}</div>`;
    for (let i = 1; i <= cnt; i++) {
      const w  = walks.find(x => x.farm===farm && x.house===String(i));
      const mw = mWalks.find(x => x.farm===farm && x.house===String(i));
      const flagged = w && w.flags && w.flags.length > 0;
      html += `<div style="background:#121a0a;border:1px solid ${flagged?'#5a2a2a':w?'#2a4a1a':'#1a2a0a'};border-radius:10px;padding:12px 14px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#f0ead8;">Barn ${i}</div>
          <div style="font-size:11px;color:${flagged?'#e53e3e':w?'#4caf50':'#3a4a2a'};">${flagged?'⚠ Flagged':w?'✓ Clear':'— Pending'}</div>
        </div>
        ${w ? `<div style="font-size:11px;color:#7a9a5a;margin-top:4px;">👤 ${w.employee} · ${w.time||''}</div>
          ${w.mortCount?`<div style="font-size:11px;color:#e53e3e;margin-top:3px;">💀 Mortality: ${w.mortCount}</div>`:''}
          ${w.looseCount?`<div style="font-size:11px;color:#d69e2e;margin-top:3px;">🐓 Loose birds: ${w.looseCount}</div>`:''}
          ${flagged?`<div style="font-size:10px;color:#e07070;margin-top:5px;line-height:1.6;">${w.flags.map(f=>'• '+f).join('<br>')}</div>`:''}` : ''}
        ${mw ? `<div style="font-size:10px;color:#6a90d9;margin-top:6px;padding-top:6px;border-top:1px solid #1a2a2a;">☀️ ${mw.employee} · ${mw.waterPSI} PSI · ${mw.temp}°F${mw.eeCount!=null?' · '+mw.eeCount+' EE':''}</div>` : ''}
      </div>`;
    }
  });

  if (!walks.length && !mWalks.length) {
    html += `<div style="text-align:center;padding:30px;color:#3a4a2a;font-family:'IBM Plex Mono',monospace;font-size:12px;">No checks logged today yet.</div>`;
  }
  document.getElementById('prod-summary-content').innerHTML = html;
}

// ── Sub-navigation ──
function goOps(section) {
  opsCurrentSection = section;
  document.querySelectorAll('.ops-section').forEach(s => { s.classList.remove('ops-visible'); s.style.display = 'none'; });
  document.querySelectorAll('.ops-sub-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('ops-' + section);
  if (el) { el.style.display = 'block'; el.classList.add('ops-visible'); }
  document.querySelectorAll('.ops-sub-btn').forEach(b => { if (b.dataset.section === section) b.classList.add('active'); });
  renderOpsPanel();
}

function renderOpsPanel() {
  // Legacy - now routed through goShipSection / goPkgSection
  if (opsCurrentSection === 'scoreboard')     renderOpsScoreboard();
  else if (opsCurrentSection === 'packing')   renderPacking();
  else if (opsCurrentSection === 'shipping')  renderShipping();
  else if (opsCurrentSection === 'reconciliation') renderReconciliation();
  else if (opsCurrentSection === 'exceptions') renderExceptions();
  updateOpsExcBadge();
}

function updateOpsExcBadge() {
  const open = opsExcData.filter(e => e.status === 'Open' || e.status === 'In Progress').length;
  const badge = document.getElementById('ops-exc-badge');
  if (!badge) return;
  badge.style.display = open > 0 ? 'inline' : 'none';
  badge.textContent = open;
}

// ── Date helpers ──
function opsDateRange(mode) {
  const now = new Date(); now.setHours(0,0,0,0);
  if (mode === 'today') { const s = now.toISOString().slice(0,10); return {start:s,end:s}; }
  if (mode === 'week')  { const s = new Date(now); s.setDate(s.getDate()-6); return {start:s.toISOString().slice(0,10),end:now.toISOString().slice(0,10)}; }
  if (mode === 'month') { const s = new Date(now); s.setDate(s.getDate()-29); return {start:s.toISOString().slice(0,10),end:now.toISOString().slice(0,10)}; }
  return {start:'',end:''};
}

function opsFilterByDate(arr, mode) {
  if (!mode || mode === 'all') return arr;
  if (mode === 'custom') {
    const d = document.getElementById('recon-date')?.value;
    return d ? arr.filter(r => r.date === d) : arr;
  }
  const {start,end} = opsDateRange(mode);
  return arr.filter(r => { const d = r.date||''; return d>=start && d<=end; });
}

function shiftFromTime() { const h=new Date().getHours(); return h>=5&&h<13?'AM':h>=13&&h<21?'PM':'Night'; }
function opsToday()      { return new Date().toISOString().slice(0,10); }
function fmtNum(n)       { return Number(n||0).toLocaleString(); }

function opsKpiColorLow(val,green,yellow)  { return val<=green?'green':val<=yellow?'yellow':'red'; }
function opsKpiColorHigh(val,green,yellow) { return val>=green?'green':val>=yellow?'yellow':'red'; }

// ── Scoreboard ──
function opsScoreDate(mode, btn) {
  opsScoreFilter = mode;
  document.querySelectorAll('#ops-scoreboard .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderOpsScoreboard();
}

function renderOpsScoreboard() {
  const eggs = opsFilterByDate(opsEggData, opsScoreFilter);
  const pack = opsFilterByDate(opsPackData, opsScoreFilter);
  const ship = opsFilterByDate(opsShipData, opsScoreFilter);

  const produced = eggs.reduce((s,r)=>s+(Number(r.eggs)||0),0);
  const packed   = pack.reduce((s,r)=>s+(Number(r.qty)||0),0);
  const shipped  = ship.filter(r=>['shipped','delivered'].includes(r.status)).reduce((s,r)=>s+(Number(r.qty)||0),0);
  const unpacked = Math.max(0, produced-packed);
  const staged   = Math.max(0, packed-shipped);

  const shippedLoads = ship.filter(r=>['shipped','delivered'].includes(r.status));
  const onTimeCnt  = shippedLoads.filter(r=>!r.actDep||!r.schedDep||r.actDep<=r.schedDep).length;
  const onTimePct  = shippedLoads.length ? Math.round(onTimeCnt/shippedLoads.length*100) : 100;
  const delayCnt   = shippedLoads.length - onTimeCnt;
  const holdCnt    = ship.filter(r=>r.status==='hold').length;
  const dmgCnt     = ship.filter(r=>r.damageNotes).length;
  const lossPct    = shippedLoads.length ? Math.round(dmgCnt/Math.max(1,shippedLoads.length)*100) : 0;

  const kpis = [
    {icon:'🥚', lbl:'Eggs Produced',      val:fmtNum(produced), color: produced>0?'green':'yellow'},
    {icon:'📦', lbl:'Eggs Packed',        val:fmtNum(packed),   color: packed>0?'green':'yellow'},
    {icon:'🚚', lbl:'Eggs Shipped',       val:fmtNum(shipped),  color: shipped>0?'green':'yellow'},
    {icon:'🏭', lbl:'Unpacked Inventory', val:fmtNum(unpacked), color: opsKpiColorLow(unpacked,20000,50000)},
    {icon:'🗄️', lbl:'Staged Inventory',  val:fmtNum(staged),   color: opsKpiColorLow(staged,10000,30000)},
    {icon:'⏱️', lbl:'On-Time Shipping %', val:onTimePct+'%',    color: opsKpiColorHigh(onTimePct,95,85)},
    {icon:'⚠️', lbl:'Delay Count',        val:delayCnt+(holdCnt>0?' (+'+holdCnt+' hold)':''), color: opsKpiColorLow(delayCnt+holdCnt,0,2)},
    {icon:'💔', lbl:'Loss / Damage %',    val:lossPct+'%',      color: opsKpiColorLow(lossPct,2,5)},
  ];

  const grid = document.getElementById('ops-kpi-grid');
  if (grid) grid.innerHTML = kpis.map(k=>`<div class="ops-kpi-card ${k.color}"><div class="ops-kpi-icon">${k.icon}</div><div class="ops-kpi-val">${k.val}</div><div class="ops-kpi-lbl">${k.lbl}</div></div>`).join('');

  const ins = [];
  if (unpacked>50000) ins.push({cls:'red',msg:`⚠️ High unpacked inventory: ${fmtNum(unpacked)} eggs waiting to be packed.`});
  if (staged>20000)   ins.push({cls:'',  msg:`📦 ${fmtNum(staged)} eggs staged but not yet shipped — verify loads are on schedule.`});
  if (holdCnt>0)      ins.push({cls:'red',msg:`🚫 ${holdCnt} load(s) on HOLD — action required immediately.`});
  if (delayCnt>0)     ins.push({cls:'',  msg:`⏱️ ${delayCnt} shipment(s) departed late this period.`});
  if (onTimePct>=95&&shippedLoads.length>0) ins.push({cls:'green',msg:`✅ On-time shipping at ${onTimePct}% — excellent!`});
  if (!produced&&!packed&&!shipped) ins.push({cls:'',msg:'📋 No data for this period. Log production, packing, and shipping to see live totals.'});
  const insEl = document.getElementById('ops-score-insights');
  if (insEl) insEl.innerHTML = ins.map(i=>`<div class="ops-insight ${i.cls}">${i.msg}</div>`).join('');

  const farms = ['Hegins','Danville'];
  const tbl = document.getElementById('ops-score-table');
  if (tbl) {
    let html = '<thead><tr><th>Farm</th><th>Eggs Produced</th><th>Eggs Packed</th><th>Eggs Shipped</th><th>Unpacked</th><th>Staged</th></tr></thead><tbody>';
    farms.forEach(farm => {
      const fe = eggs.filter(r=>r.farm===farm).reduce((s,r)=>s+(Number(r.eggs)||0),0);
      const fs = ship.filter(r=>r.facility===farm&&['shipped','delivered'].includes(r.status)).reduce((s,r)=>s+(Number(r.qty)||0),0);
      html += `<tr><td><strong>${farm}</strong></td><td>${fmtNum(fe)}</td><td>—</td><td>${fmtNum(fs)}</td><td>${fmtNum(Math.max(0,fe-packed))}</td><td>—</td></tr>`;
    });
    html += `<tr class="total-row"><td>TOTAL</td><td>${fmtNum(produced)}</td><td>${fmtNum(packed)}</td><td>${fmtNum(shipped)}</td><td>${fmtNum(unpacked)}</td><td>${fmtNum(staged)}</td></tr></tbody>`;
    tbl.innerHTML = html;
  }

  const tsEl = document.getElementById('ops-score-ts');
  if (tsEl) tsEl.textContent = 'As of ' + new Date().toLocaleTimeString();
}

// ═══════════════════════════════════════════
// ── Barn Walk History ──────────────────────
var _bwHistFarm = 'All', _bwHistPage = 0;
const _BW_HIST_PER_PAGE = 20;

function openBarnWalkHistory() {
  _bwHistFarm = 'All'; _bwHistPage = 0;
  document.getElementById('bw-history-overlay').style.display = 'block';
  document.getElementById('bw-history-overlay').scrollTop = 0;
  loadBarnWalkHistory();
}

function closeBarnWalkHistory() {
  document.getElementById('bw-history-overlay').style.display = 'none';
}

function bwHistFarmFilter(farm, btn) {
  _bwHistFarm = farm; _bwHistPage = 0;
  document.querySelectorAll('#bw-history-overlay .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadBarnWalkHistory();
}

async function loadBarnWalkHistory() {
  const el = document.getElementById('bw-history-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:#5a8a5a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">Loading...</div>';
  try {
    const snap = await db.collection('barnWalks').orderBy('ts','desc').limit(200).get();
    let walks = snap.docs.map(d => ({...d.data(), _id: d.id}));
    if (_bwHistFarm !== 'All') walks = walks.filter(w => w.farm === _bwHistFarm);
    renderBarnWalkHistory(walks);
  } catch(e) {
    el.innerHTML = `<div style="color:#e53e3e;padding:20px;font-size:12px;">Error: ${e.message}</div>`;
  }
}

function renderBarnWalkHistory(walks) {
  const el = document.getElementById('bw-history-list');
  if (!el) return;
  const total = walks.length;
  const start = _bwHistPage * _BW_HIST_PER_PAGE;
  const page  = walks.slice(start, start + _BW_HIST_PER_PAGE);
  const badge = document.getElementById('bw-history-count');
  if (badge) badge.textContent = total + ' walk' + (total !== 1 ? 's' : '');
  if (!page.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#3a5a3a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">No walks found.</div>';
    return;
  }
  const byDate = {};
  page.forEach(w => { const d = w.date || '?'; (byDate[d] = byDate[d]||[]).push(w); });
  let html = '';
  Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([date, ws]) => {
    const d = new Date(date + 'T12:00:00');
    const label = d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#4a7a4a;text-transform:uppercase;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #1e3a1e;">${label}</div>`;
    ws.sort((a,b)=>((a.farm||'')+a.house).localeCompare((b.farm||'')+b.house)).forEach(w => {
      const hasFlagsArr = w.flags && w.flags.length > 0;
      const clFails = w.checklistFails || 0;
      const statusColor = hasFlagsArr ? '#e53e3e' : '#4caf50';
      const statusLabel = hasFlagsArr ? `⚠ ${w.flags.length} Flag${w.flags.length!==1?'s':''}` : '✓ Clear';
      html += `<div style="background:#0f1a0f;border:1px solid ${hasFlagsArr?'#4a1a1a':'#1a3a1a'};border-radius:10px;padding:12px 14px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#f0ead8;">${w.farm} — Barn ${w.house}</div>
          <div style="font-size:11px;color:${statusColor};font-weight:600;">${statusLabel}</div>
        </div>
        <div style="font-size:11px;color:#5a8a5a;">👤 ${w.employee||'—'}${w.time?' · '+w.time:''}</div>
        ${w.waterPSI!=null?`<div style="font-size:10px;color:#3a6a6a;margin-top:3px;">💧 ${w.waterPSI} PSI${w.temp!=null?' · 🌡 '+w.temp+'°F':''}</div>`:''}
        ${w.mortCount?`<div style="font-size:10px;color:#e53e3e;margin-top:3px;">💀 Mortality: ${w.mortCount}</div>`:''}
        ${hasFlagsArr?`<div style="font-size:10px;color:#e07070;margin-top:6px;line-height:1.6;">${w.flags.map(f=>'• '+f).join('<br>')}</div>`:''}
        ${clFails>0?`<div style="font-size:10px;color:#d69e2e;margin-top:3px;">📋 Checklist: ${clFails} fail${clFails!==1?'s':''}</div>`:''}
        ${w.notes?`<div style="font-size:10px;color:#4a7a4a;margin-top:4px;font-style:italic;">"${w.notes}"</div>`:''}
      </div>`;
    });
  });
  const pages = Math.ceil(total / _BW_HIST_PER_PAGE);
  if (pages > 1) {
    html += `<div style="display:flex;justify-content:center;gap:8px;margin-top:16px;">`;
    if (_bwHistPage > 0) html += `<button class="pill" onclick="_bwHistPage--;loadBarnWalkHistory()">← Prev</button>`;
    html += `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a8a5a;padding:6px 10px;">${_bwHistPage+1} / ${pages}</span>`;
    if (_bwHistPage < pages-1) html += `<button class="pill" onclick="_bwHistPage++;loadBarnWalkHistory()">Next →</button>`;
    html += `</div>`;
  }
  el.innerHTML = html;
}

// ═══════════════════════════════════════════
// ── Egg Production Trends ──────────────────
var _eggTrendDays = 7;

function openEggTrends() {
  document.getElementById('egg-trends-overlay').style.display = 'block';
  document.getElementById('egg-trends-overlay').scrollTop = 0;
  loadEggTrends();
}

function closeEggTrends() {
  document.getElementById('egg-trends-overlay').style.display = 'none';
}

function eggTrendPeriod(days, btn) {
  _eggTrendDays = days;
  document.querySelectorAll('#egg-trends-overlay .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadEggTrends();
}

async function loadEggTrends() {
  const el = document.getElementById('egg-trends-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:#5a8a5a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">Loading...</div>';
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - _eggTrendDays);
  const cutStr = cutoff.toISOString().slice(0,10);
  try {
    const snap = await db.collection('opsEggProduction').where('date','>=',cutStr).orderBy('date','asc').get();
    renderEggTrends(snap.docs.map(d => d.data()));
  } catch(e) {
    el.innerHTML = `<div style="color:#e53e3e;padding:20px;font-size:12px;">Error: ${e.message}</div>`;
  }
}

function renderEggTrends(data) {
  const el = document.getElementById('egg-trends-content');
  if (!el) return;
  const dates = [];
  const now = new Date();
  for (let i = _eggTrendDays - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0,10));
  }
  const farmOrder = ['Hegins','Danville'];
  const farmHouses = {Hegins:8, Danville:5};
  const totals = {};
  data.forEach(r => {
    if (!totals[r.date]) totals[r.date] = {};
    totals[r.date][r.farm] = (totals[r.date][r.farm]||0) + (Number(r.eggs)||0);
  });
  const farmTarget = farm => (farmHouses[farm]||5) * EGG_TARGET;

  // Overall section
  const overallByDate = dates.map(d => Object.values(totals[d]||{}).reduce((s,v)=>s+v,0));
  const overallTarget = farmOrder.reduce((s,f)=>s+farmTarget(f),0);
  const overallAvg = overallByDate.reduce((s,v)=>s+v,0) / (overallByDate.filter(v=>v>0).length||1);
  const overallPct = Math.round(overallAvg / overallTarget * 100);
  const overallMax = Math.max(overallTarget, ...overallByDate, 1);

  const barChart = (vals, maxV, targetV, ds) =>
    `<div style="display:flex;align-items:flex-end;gap:3px;height:60px;margin-bottom:4px;">` +
    ds.map((d,i) => {
      const v = vals[i]; const h = Math.max(2, Math.round(v/maxV*58));
      const col = v===0?'#1e3a1e':kpiCol(Math.round(v/targetV*100));
      return `<div title="${d}: ${fmtNum(v)}" style="flex:1;"><div style="width:100%;height:${h}px;background:${col};border-radius:2px 2px 0 0;min-height:2px;"></div></div>`;
    }).join('') + `</div>` +
    `<div style="display:flex;gap:3px;">` +
    ds.map(d=>`<div style="flex:1;text-align:center;font-size:7px;color:#3a5a3a;font-family:'IBM Plex Mono',monospace;">${d.slice(5).replace('-','/')}</div>`).join('') +
    `</div>`;

  let html = `<div style="background:#0f1a0f;border:1px solid #2a5a2a;border-radius:12px;padding:14px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#f0ead8;">🌐 All Farms</div>
      <div style="font-size:11px;color:${kpiCol(overallPct)};font-family:'IBM Plex Mono',monospace;font-weight:600;">${overallPct}% avg</div>
    </div>
    ${barChart(overallByDate, overallMax, overallTarget, dates)}
    <div style="display:flex;gap:14px;margin-top:8px;padding-top:8px;border-top:1px solid #1a2a1a;">
      <div style="font-size:10px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;">Avg: <span style="color:#4caf50;font-weight:700;">${fmtNum(Math.round(overallAvg))}</span></div>
      <div style="font-size:10px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;">Target: <span style="color:#3a6a3a;">${fmtNum(overallTarget)}</span></div>
      <div style="font-size:10px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;">Peak: <span style="color:#f0ead8;">${fmtNum(Math.max(...overallByDate))}</span></div>
    </div>
  </div>`;

  farmOrder.forEach(farm => {
    const target = farmTarget(farm);
    const vals = dates.map(d => totals[d]?.[farm]||0);
    const avg = vals.reduce((s,v)=>s+v,0) / (vals.filter(v=>v>0).length||1);
    const pct = Math.round(avg/target*100);
    const maxV = Math.max(target, ...vals, 1);
    html += `<div style="background:#0f1a0f;border:1px solid #1a3a1a;border-radius:12px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#f0ead8;">📍 ${farm}</div>
        <div style="font-size:11px;color:${kpiCol(pct)};font-family:'IBM Plex Mono',monospace;font-weight:600;">${pct}% avg</div>
      </div>
      ${barChart(vals, maxV, target, dates)}
      <div style="display:flex;gap:14px;margin-top:8px;padding-top:8px;border-top:1px solid #1a2a1a;">
        <div style="font-size:10px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;">Avg: <span style="color:#4caf50;font-weight:700;">${fmtNum(Math.round(avg))}</span></div>
        <div style="font-size:10px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;">Target: <span style="color:#3a6a3a;">${fmtNum(target)}</span></div>
      </div>
    </div>`;
  });
  el.innerHTML = html;
}


// ═══════════════════════════════════════════
// ── Production Sub-Tab Switcher ─────────────

function goProdSection(sec) {
  const sections = ['overview','history','biosec'];
  sections.forEach(s => {
    const el  = document.getElementById('prod-sec-' + s);
    const btn = document.getElementById('prod-tab-' + s);
    if (el)  el.style.display = s === sec ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', s === sec);
  });

  if (sec === 'history') renderProdWalkHistory();
  if (sec === 'biosec')  renderProdBiosec();
}

function renderProdEggTrends() {
  const el = document.getElementById('prod-sec-trends');
  if (!el) return;
  el.innerHTML = '<div style="padding:20px;text-align:center;color:#a0c060;font-family:\'IBM Plex Mono\',monospace;">📈 Egg Trends — coming soon</div>';
}

let _walkDetailData = {}; // docId → full walk record

function renderProdWalkHistory() {
  const el = document.getElementById('prod-sec-history');
  if (!el) return;
  el.innerHTML = '<div style="color:#aaa;font-family:\'IBM Plex Mono\',monospace;font-size:12px;margin-bottom:12px;">Loading walk history…</div>';
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  db.collection('barnWalks').where('ts','>=',cutoff).orderBy('ts','desc').get().then(snap => {
    if (snap.empty) { el.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">No walks in the last 30 days.</div>'; return; }
    _walkDetailData = {};
    const rows = snap.docs.map(d => {
      const r = d.data();
      _walkDetailData[d.id] = r;
      const date  = r.ts ? new Date(r.ts).toLocaleDateString() : '—';
      const flags = r.flags && r.flags.length ? `<span style="color:#e53e3e;">⚑ ${r.flags.length}</span>` : '<span style="color:#4caf50;">✓</span>';
      return `<tr onclick="openWalkDetail('${d.id}')" style="border-bottom:1px solid #1a2a1a;cursor:pointer;" onmouseover="this.style.background='#1a2a1a'" onmouseout="this.style.background=''">
        <td style="padding:8px 6px;color:#f0ead8;">${date}</td>
        <td style="padding:8px 6px;color:#7ab07a;">${r.farm||'—'}</td>
        <td style="padding:8px 6px;color:#aaa;">H${r.house||'—'}</td>
        <td style="padding:8px 6px;">${flags}</td>
        <td style="padding:8px 6px;color:#aaa;">${r.employee||'—'}</td>
        <td style="padding:8px 6px;color:#3a6a8a;font-size:10px;">→</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a6a4a;margin-bottom:8px;">Tap any row to see full details</div>
      <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:12px;">
      <thead><tr style="border-bottom:1px solid #2a4a2a;">
        <th style="padding:8px 6px;color:#5a8a5a;text-align:left;">Date</th>
        <th style="padding:8px 6px;color:#5a8a5a;text-align:left;">Farm</th>
        <th style="padding:8px 6px;color:#5a8a5a;text-align:left;">House</th>
        <th style="padding:8px 6px;color:#5a8a5a;text-align:left;">Flags</th>
        <th style="padding:8px 6px;color:#5a8a5a;text-align:left;">Employee</th>
        <th style="padding:6px;"></th>
      </tr></thead><tbody>${rows}</tbody></table>`;
  }).catch(e => { el.innerHTML = '<div style="color:#e53e3e;padding:20px;">Error: '+e.message+'</div>'; });
}

function openWalkDetail(id) {
  const r = _walkDetailData[id];
  if (!r) return;
  const hasFlagsArr = r.flags && r.flags.length > 0;
  const date = r.ts ? new Date(r.ts).toLocaleString() : (r.date || '—');
  const yn = v => v === 'yes' ? '<span style="color:#e53e3e;">⚠ YES</span>' : v === 'no' ? '<span style="color:#4caf50;">✓ NO</span>' : v ? `<span style="color:#d69e2e;">${v}</span>` : '—';
  const field = (label, val) => val != null && val !== '' && val !== '—'
    ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1a2a1a;">
        <span style="color:#5a8a5a;font-size:11px;">${label}</span>
        <span style="color:#f0ead8;font-size:11px;font-weight:600;text-align:right;max-width:60%;">${val}</span>
       </div>` : '';

  let html = `
  <div style="position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1000;overflow-y:auto;padding:16px;">
  <div style="max-width:520px;margin:0 auto;background:#0d1a0d;border:1.5px solid ${hasFlagsArr?'#4a1a1a':'#1a3a1a'};border-radius:16px;padding:20px;">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:#f0ead8;">${r.farm} — House ${r.house}</div>
        <div style="font-size:11px;color:#5a8a5a;margin-top:3px;">📅 ${date} · 👤 ${r.employee||'—'}</div>
      </div>
      <button onclick="closeWalkDetail()" style="background:#1a1a1a;border:1px solid #3a3a3a;border-radius:8px;padding:8px 14px;color:#888;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;flex-shrink:0;">✕ Close</button>
    </div>
    <!-- Status banner -->
    <div style="background:${hasFlagsArr?'#1a0a0a':'#0a1a0a'};border:1px solid ${hasFlagsArr?'#e53e3e':'#4caf50'};border-radius:8px;padding:10px 14px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:700;color:${hasFlagsArr?'#e53e3e':'#4caf50'};">${hasFlagsArr?'⚠ '+r.flags.length+' Flag'+(r.flags.length!==1?'s':''):'✓ All Clear'}</div>
      ${hasFlagsArr?`<div style="font-size:11px;color:#c07070;margin-top:6px;line-height:1.7;">${r.flags.map(f=>'• '+f).join('<br>')}</div>`:''}
    </div>
    <!-- Readings -->
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#4a7a4a;text-transform:uppercase;margin-bottom:8px;">Readings</div>
    <div style="background:#0a140a;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-family:'IBM Plex Mono',monospace;">
      ${field('Water PSI', r.waterPSI != null ? r.waterPSI + ' PSI' : null)}
      ${field('House Temp', r.temp != null ? r.temp + '°F' : null)}
      ${field('Feed Bin', r.feedBinReading != null ? r.feedBinReading + ' lbs' : null)}
      ${field('Mortality Count', r.mortCount || null)}
      ${field('Loose Birds', r.looseCount || null)}
      ${field('Rodents Found', r.rodentCount || null)}
      ${field('Fly Count', r.flyCount || null)}
    </div>
    <!-- Observations -->
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#4a7a4a;text-transform:uppercase;margin-bottom:8px;">Observations</div>
    <div style="background:#0a140a;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-family:'IBM Plex Mono',monospace;">
      ${field('Mortality Found', yn(r.mort))}
      ${field('All Mortality Removed', yn(r.mortrem))}
      ${field('Loose Birds', yn(r.loose))}
      ${field('Feathering', r.feather||null)}
      ${field('Air Quality', yn(r.air))}
      ${field('Feeders', r.feed||null)}
      ${field('Rodents', yn(r.rodent))}
      ${field('Manure Dryers', r.dryers||null)}
      ${field('Egg Belt', r.eggbelt||null)}

      ${field('Standpipes', r.stand||null)}
      ${field('Fly Traps', r.fly||null)}
      ${field('House Doors', r.doors||null)}
    </div>
    ${r.checklist && Object.keys(r.checklist).length ? `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#4a7a4a;text-transform:uppercase;margin-bottom:8px;">Checklist <span style="color:${r.checklistFails>0?'#e53e3e':'#4caf50'};">(${r.checklistFails||0} fail${r.checklistFails!==1?'s':''})</span></div>
    <div style="background:#0a140a;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-family:'IBM Plex Mono',monospace;">
      ${Object.entries(r.checklist).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #1a2a1a;font-size:11px;">
        <span style="color:#5a8a5a;max-width:70%;">${k}</span>
        <span style="color:${v==='pass'||v==='ok'?'#4caf50':v==='fail'?'#e53e3e':'#d69e2e'};font-weight:700;">${(v||'').toUpperCase()}</span>
      </div>`).join('')}
    </div>` : ''}
    ${r.notes ? `<div style="background:#0a1a0a;border-radius:8px;padding:10px 12px;font-size:12px;color:#7ab07a;font-style:italic;font-family:'IBM Plex Mono',monospace;">📝 ${r.notes}</div>` : ''}
  </div></div>`;

  let overlay = document.getElementById('walk-detail-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'walk-detail-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = html;
  overlay.style.display = 'block';
}

function closeWalkDetail() {
  const el = document.getElementById('walk-detail-overlay');
  if (el) el.style.display = 'none';
}

function renderProdBiosec() {
  const el = document.getElementById('prod-sec-biosec');
  if (!el) return;
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#f87171;">🦠 Biosecurity Log</span>
    <button onclick="openBioSection()" style="padding:8px 16px;background:#1a0a0a;border:1px solid #dc2626;border-radius:8px;color:#f87171;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">+ New Entry</button>
  </div>
  <div id="prod-biosec-list" style="color:#aaa;font-size:12px;font-family:'IBM Plex Mono',monospace;">Loading…</div>`;
  db.collection('biosecurityLog').orderBy('ts','desc').limit(20).get().then(snap => {
    const listEl = document.getElementById('prod-biosec-list');
    if (!listEl) return;
    if (snap.empty) { listEl.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">No biosecurity entries yet.</div>'; return; }
    const riskColors = { low:'#4caf50', medium:'#d69e2e', high:'#dc2626' };
    const riskIcons  = { low:'🟢', medium:'🟡', high:'🔴' };
    listEl.innerHTML = snap.docs.map(d => {
      const r = d.data();
      const tsMs = r.ts?.toMillis ? r.ts.toMillis() : (typeof r.ts === 'number' ? r.ts : null);
      const date = tsMs ? new Date(tsMs).toLocaleDateString() : (r.date || '—');
      return `<div style="background:#0a1f0a;border:1px solid ${riskColors[r.risk]||'#7f1d1d'};border-radius:10px;padding:12px 14px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;">${r.person||r.visitorName||'Entry'}</span>
          <span style="color:#888;font-size:11px;">${date}</span>
        </div>
        <div style="color:#aaa;font-size:11px;margin-top:4px;">${r.type||''} · ${r.farm||''}</div>
        <div style="color:${riskColors[r.risk]||'#ccc'};font-size:11px;margin-top:2px;">${riskIcons[r.risk]||''} ${(r.risk||'').toUpperCase()}${r.notes?' · '+r.notes:''}</div>
      </div>`;
    }).join('');
  }).catch(e => {
    const listEl = document.getElementById('prod-biosec-list');
    if (listEl) listEl.innerHTML = '<div style="color:#e53e3e;padding:20px;">Error loading: '+e.message+'</div>';
  });
}

async function createMustFixWO(title, desc, farm, house, priority) {
  priority = priority || 'urgent';
  const woId = 'WO-' + String(woCounter || 900).padStart(3,'0');
  woCounter = (woCounter || 900) + 1;
  const today = new Date();
  await db.collection('workOrders').add({
    id: woId, farm: farm || '', house: String(house || ''),
    problem: 'Production', priority, status: 'open',
    title, desc,
    notes: desc + ' — Auto-flagged by production tab',
    submitted: today.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    date: today.toISOString().slice(0,10),
    ts: Date.now()
  });
}

// ── Daily Check Tab ─────────────────────────

var _prodCheckIssues = [];

async function renderProdCheck() {
  const el = document.getElementById('panel-check-body') || document.getElementById('prod-sec-check');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#5a8a5a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">Loading\u2026</div>';
  const todayStr = new Date().toISOString().slice(0,10);
  let walks = [];
  try {
    const snap = await db.collection('barnWalks').where('date','==',todayStr).get();
    walks = snap.docs.map(d => ({...d.data(), _id: d.id}));
  } catch(e) { console.error(e); }
  const walkMap = {};
  walks.forEach(w => { const k=w.farm+'-'+w.house; if (!walkMap[k]||w.ts>walkMap[k].ts) walkMap[k]=w; });
  const eggMap = {};
  (typeof opsEggData!=='undefined'?opsEggData:[]).filter(r=>r.date===todayStr)
    .forEach(r => { const k=r.farm+'-'+r.house; eggMap[k]=(eggMap[k]||0)+(Number(r.eggs)||0); });
  const farms = [{name:'Hegins',houses:8},{name:'Danville',houses:5}];
  const totalBarns = 13, checked = Object.keys(walkMap).length, flagged = walks.filter(w=>w.flags&&w.flags.length>0).length, pct = Math.round(checked/totalBarns*100);
  const issues = [];
  let farmsHtml = '';
  farms.forEach(({name, houses}) => {
    let cells = '';
    for (let h=1; h<=houses; h++) {
      const k=name+'-'+h, walk=walkMap[k], eggs=eggMap[k]||0, eggPct=eggs>0?Math.round((eggs/EGG_TARGET)*100):null, hasFlag=walk&&walk.flags&&walk.flags.length>0;
      let bg,bc,icon,sub;
      if (!walk)        { bg='#1a1a0a';bc='#4a4a00';icon='&mdash;';sub='pending'; issues.push({farm:name,house:h,issue:'No barn check submitted today'}); }
      else if (hasFlag) { bg='#2a1a1a';bc='#e53e3e';icon='&#x26a0;';sub=walk.employee||'?'; }
      else              { bg='#1a3a1a';bc='#4caf50';icon='&#x2713;';sub=walk.employee||'?'; }
      if (eggs>0&&eggPct<50) issues.push({farm:name,house:h,issue:'Low eggs: '+eggs+' ('+eggPct+'% of target)'});
      const eggLine = eggPct!==null ? '<div style="font-size:8px;color:'+(eggPct>=90?'#4caf50':eggPct>=70?'#d69e2e':'#e53e3e')+';margin-top:2px;">'+eggPct+'%</div>' : (walk?'<div style="font-size:8px;color:#3a5a3a;margin-top:2px;">no egg log</div>':'');
      cells += '<div onclick="openBarnWalk(\''+name+'\','+h+')" style="background:'+bg+';border:2px solid '+bc+';border-radius:10px;padding:10px 4px;text-align:center;cursor:pointer;"><div style="font-size:8px;color:#5a8a5a;letter-spacing:1px;font-family:\'IBM Plex Mono\',monospace;">H'+h+'</div><div style="font-size:20px;font-weight:700;color:'+bc+';line-height:1.3;">'+icon+'</div><div style="font-size:8px;color:#7a9a7a;font-family:\'IBM Plex Mono\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:54px;margin:1px auto 0;">'+sub+'</div>'+eggLine+'</div>';
    }
    farmsHtml += '<div style="margin-bottom:16px;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;color:#a0c0a0;margin-bottom:8px;">&#x1f4cd; '+name+'</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">'+cells+'</div></div>';
  });
  _prodCheckIssues = issues;
  const issuesHtml = issues.length>0
    ? '<div style="background:#1a0a0a;border:1px solid #5a2a2a;border-radius:12px;padding:14px;margin-bottom:16px;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;color:#e53e3e;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">&#x26a0; '+issues.length+' Issue'+(issues.length>1?'s':'')+' Found</div>'+issues.map(i=>'<div style="font-size:11px;color:#c0604a;font-family:\'IBM Plex Mono\',monospace;padding:4px 0;border-bottom:1px solid #2a1010;">'+i.farm+' Barn '+i.house+' &mdash; '+i.issue+'</div>').join('')+'<button onclick="prodCheckCreateWOs()" style="margin-top:12px;width:100%;padding:10px;background:#5a1010;border:1px solid #e53e3e;border-radius:8px;color:#e53e3e;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;">&#x1f527; Create Must-Fix WOs for All Issues</button></div>'
    : '<div style="background:#0a1a0a;border:1px solid #2a5a2a;border-radius:12px;padding:12px;margin-bottom:16px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#4caf50;">&#x2705; No issues found for today</div>';
  const recentHtml = walks.length>0
    ? '<div style="background:#0f1a0f;border:1px solid #2a4a2a;border-radius:12px;padding:14px;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;color:#5a8a5a;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Today\'s Submissions</div>'+walks.sort((a,b)=>b.ts-a.ts).map(w=>'<div style="padding:8px 0;border-bottom:1px solid #1a3a1a;display:flex;justify-content:space-between;align-items:center;"><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#f0ead8;">'+w.farm+' Barn '+w.house+' <span style="color:'+(w.flags&&w.flags.length?'#e53e3e':'#4caf50')+';font-size:10px;">'+(w.flags&&w.flags.length?'&#x26a0; '+w.flags.length+' flag(s)':'&#x2713; OK')+'</span></div><div style="font-size:10px;color:#5a8a5a;margin-top:2px;">'+(w.employee||'Unknown')+' &middot; '+(w.time||'')+'</div></div><div style="font-size:10px;color:#4a6a4a;font-family:\'IBM Plex Mono\',monospace;">PSI: '+(w.waterPSI||'&mdash;')+'</div></div>').join('')+'</div>'
    : '';
  el.innerHTML = '<div style="background:#0f2a0f;border:1px solid #2a5a2a;border-radius:12px;padding:14px;margin-bottom:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;"><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:26px;font-weight:700;color:'+(pct>=80?'#4caf50':pct>=50?'#d69e2e':'#e53e3e')+';">'+checked+'/'+totalBarns+'</div><div style="font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Checked</div></div><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:26px;font-weight:700;color:'+(flagged>0?'#e53e3e':'#4caf50')+';">'+flagged+'</div><div style="font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Flagged</div></div><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:26px;font-weight:700;color:'+(pct>=80?'#4caf50':pct>=50?'#d69e2e':'#e53e3e')+';">'+pct+'%</div><div style="font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Coverage</div></div></div>'+issuesHtml+farmsHtml+recentHtml;
}

async function prodCheckCreateWOs() {
  if (!_prodCheckIssues.length) return;
  const btn = document.querySelector('#prod-sec-check button[onclick="prodCheckCreateWOs()"]');
  if (btn) { btn.disabled=true; btn.textContent='Creating WOs\u2026'; }
  for (const iss of _prodCheckIssues) {
    try { await createMustFixWO(iss.farm+' Barn '+iss.house+' \u2014 '+iss.issue, iss.issue, iss.farm, iss.house, 'urgent'); } catch(e) { console.error(e); }
  }
  if (btn) btn.textContent='\u2713 WOs Created';
  setTimeout(()=>renderProdCheck(), 1500);
}

// ── Morning Walk Tab ────────────────────────

var _mwTabIssues = [];

async function renderProdMW() {
  const el = document.getElementById('panel-mw-body') || document.getElementById('prod-sec-mw');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#3a5a8a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">Loading\u2026</div>';
  const todayStr = new Date().toISOString().slice(0,10);
  let walks = [];
  try {
    const snap = await db.collection('morningWalks').where('date','==',todayStr).get();
    walks = snap.docs.map(d => ({...d.data(), _id: d.id}));
  } catch(e) { console.error(e); }
  const walkMap = {};
  walks.forEach(w => { const k=w.farm+'-'+w.house; if (!walkMap[k]||w.ts>walkMap[k].ts) walkMap[k]=w; });
  const farms = [{name:'Hegins',houses:8},{name:'Danville',houses:5}];
  const totalBarns = 13, checked = Object.keys(walkMap).length, flagged = walks.filter(w=>w.flags&&w.flags.length>0).length, pct = Math.round(checked/totalBarns*100);
  const issues = [];
  let farmsHtml = '';
  farms.forEach(({name, houses}) => {
    let cells = '';
    for (let h=1; h<=houses; h++) {
      const k=name+'-'+h, walk=walkMap[k], hasFlag=walk&&walk.flags&&walk.flags.length>0;
      let bg,bc,icon,sub;
      if (!walk)        { bg='#080d1a';bc='#1e3a6a';icon='&mdash;';sub=''; }
      else if (hasFlag) { bg='#2a1a1a';bc='#e53e3e';icon='&#x26a0;';sub=walk.employee||'?'; issues.push({farm:name,house:h,issue:walk.flags.join('; ')}); }
      else              { bg='#0d2a4a';bc='#4a90d9';icon='&#x2713;';sub=walk.employee||'?'; }
      const psiBad = walk&&(walk.waterPSI<10||walk.waterPSI>60);
      const psiLine = walk ? '<div style="font-size:8px;color:'+(psiBad?'#e53e3e':'#4a90d9')+';margin-top:2px;">'+walk.waterPSI+' PSI</div>' : '';
      cells += '<div onclick="openMorningWalk(\''+name+'\','+h+')" style="background:'+bg+';border:2px solid '+bc+';border-radius:10px;padding:10px 4px;text-align:center;cursor:pointer;"><div style="font-size:8px;color:#3a5a8a;letter-spacing:1px;font-family:\'IBM Plex Mono\',monospace;">H'+h+'</div><div style="font-size:20px;font-weight:700;color:'+bc+';line-height:1.3;">'+icon+'</div><div style="font-size:8px;color:#5a7aaa;font-family:\'IBM Plex Mono\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:54px;margin:1px auto 0;">'+sub+'</div>'+psiLine+'</div>';
    }
    farmsHtml += '<div style="margin-bottom:16px;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;color:#6a90c0;margin-bottom:8px;">&#x1f4cd; '+name+'</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">'+cells+'</div></div>';
  });
  _mwTabIssues = issues;
  const issuesHtml = issues.length>0
    ? '<div style="background:#1a0a0a;border:1px solid #5a2a2a;border-radius:12px;padding:14px;margin-bottom:16px;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;color:#e53e3e;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">&#x26a0; '+issues.length+' Issue'+(issues.length>1?'s':'')+' Found</div>'+issues.map(i=>'<div style="font-size:11px;color:#c0604a;font-family:\'IBM Plex Mono\',monospace;padding:4px 0;border-bottom:1px solid #2a1010;">'+i.farm+' Barn '+i.house+' &mdash; '+i.issue+'</div>').join('')+'<button onclick="mwTabCreateWOs()" style="margin-top:12px;width:100%;padding:10px;background:#5a1010;border:1px solid #e53e3e;border-radius:8px;color:#e53e3e;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;">&#x1f527; Create Must-Fix WOs</button></div>'
    : '<div style="background:#080d1a;border:1px solid #1e3a6a;border-radius:12px;padding:12px;margin-bottom:16px;text-align:center;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#4a90d9;">&#x2705; No issues found for today</div>';
  const recentHtml = walks.length>0
    ? '<div style="background:#080d1a;border:1px solid #1e3a6a;border-radius:12px;padding:14px;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;font-weight:700;color:#3a6aaa;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Today\'s Submissions</div>'+walks.sort((a,b)=>b.ts-a.ts).map(w=>'<div style="padding:8px 0;border-bottom:1px solid #0d1f3a;display:flex;justify-content:space-between;align-items:center;"><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#f0ead8;">'+w.farm+' Barn '+w.house+' <span style="color:'+(w.flags&&w.flags.length?'#e53e3e':'#4a90d9')+';font-size:10px;">'+(w.flags&&w.flags.length?'&#x26a0; '+w.flags.length+' flag(s)':'&#x2713; OK')+'</span></div><div style="font-size:10px;color:#3a5a8a;margin-top:2px;">'+(w.employee||'Unknown')+' &middot; '+(w.time||'')+' &middot; '+(w.temp||'&mdash;')+'&deg;F</div></div><div style="font-size:10px;color:#3a6aaa;font-family:\'IBM Plex Mono\',monospace;">PSI: '+(w.waterPSI||'&mdash;')+'</div></div>').join('')+'</div>'
    : '';
  el.innerHTML = '<div style="background:#080d1a;border:1px solid #1e3a6a;border-radius:12px;padding:14px;margin-bottom:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;"><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:26px;font-weight:700;color:'+(pct>=80?'#4a90d9':pct>=50?'#d69e2e':'#e53e3e')+';">'+checked+'/'+totalBarns+'</div><div style="font-size:9px;color:#3a5a8a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Walked</div></div><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:26px;font-weight:700;color:'+(flagged>0?'#e53e3e':'#4a90d9')+';">'+flagged+'</div><div style="font-size:9px;color:#3a5a8a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Flagged</div></div><div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:26px;font-weight:700;color:'+(pct>=80?'#4a90d9':pct>=50?'#d69e2e':'#e53e3e')+';">'+pct+'%</div><div style="font-size:9px;color:#3a5a8a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Coverage</div></div></div>'+issuesHtml+farmsHtml+recentHtml;
}

async function mwTabCreateWOs() {
  if (!_mwTabIssues.length) return;
  for (const iss of _mwTabIssues) {
    try { await createMustFixWO('MW \u2014 '+iss.farm+' Barn '+iss.house, iss.issue, iss.farm, iss.house, 'urgent'); } catch(e) {}
  }
  renderProdMW();
}


// ═══════════════════════════════════════════
// PEST LOG
// ═══════════════════════════════════════════
var _pestLogData = [];
var _mortLogData = [];
var _pestFarmFilter = 'all';
var _pestTypeFilter = 'all';

async function openPestLog() {
  document.getElementById('pest-log-overlay').style.display = 'block';
  document.getElementById('pest-log-count').textContent = 'Loading…';
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  try {
    const [pestSnap, mortSnap] = await Promise.all([
      db.collection('pestLog').where('ts','>=',cutoff).orderBy('ts','desc').get(),
      db.collection('mortalityLog').where('ts','>=',cutoff).orderBy('ts','desc').get()
    ]);
    _pestLogData = [];
    _mortLogData = [];
    pestSnap.forEach(d => _pestLogData.push({...d.data(), _type:'pest', _fbId: d.id}));
    mortSnap.forEach(d => _mortLogData.push({...d.data(), _type:'mort', _fbId: d.id}));
  } catch(e) {
    console.error('pest/mortality log load error:', e);
  }
  renderPestLog();
}

function closePestLog() {
  document.getElementById('pest-log-overlay').style.display = 'none';
  _pestFarmFilter = 'all';
  _pestTypeFilter = 'all';
}

function pestLogFilter(farm, btn) {
  _pestFarmFilter = farm;
  document.querySelectorAll('#pest-log-overlay .pill[data-farm]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPestLog();
}

function pestLogTypeFilter(type, btn) {
  _pestTypeFilter = type;
  document.querySelectorAll('#pest-log-overlay .pill[data-type]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPestLog();
}

function renderPestLog() {
  // Merge pest + mortality, sorted newest first
  let pestData = _pestLogData.slice();
  let mortData = _mortLogData.slice();

  if (_pestFarmFilter !== 'all') {
    pestData = pestData.filter(r => r.farm === _pestFarmFilter);
    mortData = mortData.filter(r => r.farm === _pestFarmFilter);
  }
  if (_pestTypeFilter === 'rodent') { mortData = []; pestData = pestData.filter(r => r.rodent === 'yes'); }
  if (_pestTypeFilter === 'fly')    { mortData = []; pestData = pestData.filter(r => r.fly === 'yes'); }
  if (_pestTypeFilter === 'mort')   { pestData = []; mortData = mortData.filter(r => r.type === 'mortality' || !r.type); }
  if (_pestTypeFilter === 'loose')  { pestData = []; mortData = mortData.filter(r => r.type === 'loose'); }

  const combined = [...pestData, ...mortData].sort((a,b) => (b.ts||0) - (a.ts||0));
  document.getElementById('pest-log-count').textContent = combined.length + ' records · last 30 days';

  // Summary stats
  const totalRodent    = pestData.filter(r => r.rodent === 'yes').length;
  const totalFly       = pestData.filter(r => r.fly === 'yes').length;
  const totalMortBirds = _mortLogData.filter(r => r.type === 'mortality' || !r.type).reduce((s,r) => s + (r.mortCount||0), 0);
  const totalLooseBirds = _mortLogData.filter(r => r.type === 'loose').reduce((s,r) => s + (r.looseCount||0), 0);
  const statStyle = 'background:#1a0a0a;border:1px solid #3a1a0a;border-radius:10px;padding:12px;text-align:center;';
  document.getElementById('pest-log-stats').innerHTML =
    '<div style="'+statStyle+'"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:24px;font-weight:700;color:#e07070;">'+totalMortBirds+'</div><div style="font-size:10px;color:#8a5a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">💀 Mortality (30d)</div></div>' +
    '<div style="'+statStyle+'"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:24px;font-weight:700;color:#f59e0b;">'+totalLooseBirds+'</div><div style="font-size:10px;color:#8a7a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">🐔 Loose Birds (30d)</div></div>' +
    '<div style="'+statStyle+'"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:24px;font-weight:700;color:#c8a05a;">'+totalRodent+'</div><div style="font-size:10px;color:#8a7a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">🐀 Rodent Sightings</div></div>' +
    '<div style="'+statStyle+'"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:24px;font-weight:700;color:#d69e2e;">'+totalFly+'</div><div style="font-size:10px;color:#8a7a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">🪰 Fly Sightings</div></div>';

  if (!combined.length) {
    document.getElementById('pest-log-list').innerHTML =
      '<div style="text-align:center;padding:40px 20px;color:#5a4a2a;font-family:\'IBM Plex Mono\',monospace;font-size:13px;">No records in the last 30 days.</div>';
    return;
  }

  document.getElementById('pest-log-list').innerHTML = combined.map(r => {
    if (r._type === 'mort' && r.type === 'loose') {
      // Loose bird entry
      return '<div style="background:#130c00;border:1px solid #7a5a00;border-radius:10px;padding:14px 16px;margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
          '<div>' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;color:#f0ead8;">'+r.farm+' — Barn '+r.house+'</div>' +
            '<div style="font-size:11px;color:#8a7a5a;margin-top:2px;">'+(r.date||'')+(r.time?' · '+r.time:'')+' · '+(r.employee||'')+'</div>' +
          '</div>' +
          '<span style="background:#2a1a00;color:#f59e0b;border:1px solid #7a5a00;border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;">🐔 Loose Birds</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">' +
          (r.looseCount ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;color:#f59e0b;font-weight:700;">'+r.looseCount+' bird'+(r.looseCount!==1?'s':'')+'</span>' : '') +
        '</div>' +
        (r.notes ? '<div style="margin-top:8px;font-size:12px;color:#8a7a5a;font-style:italic;">'+r.notes+'</div>' : '') +
      '</div>';
    }
    if (r._type === 'mort') {
      const notRemoved = r.mortrem === 'no';
      const borderColor = notRemoved ? '#e53e3e' : '#7a3a3a';
      return '<div style="background:#130808;border:1px solid '+borderColor+';border-radius:10px;padding:14px 16px;margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
          '<div>' +
            '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;color:#f0ead8;">'+r.farm+' — Barn '+r.house+'</div>' +
            '<div style="font-size:11px;color:#8a6a6a;margin-top:2px;">'+r.date+' · '+r.time+' · '+r.employee+'</div>' +
          '</div>' +
          '<span style="background:#3a0a0a;color:#f87171;border:1px solid #7a2a2a;border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;">💀 Mortality</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">' +
          (r.mortCount ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;color:#f87171;font-weight:700;">'+r.mortCount+' bird'+(r.mortCount!==1?'s':'')+'</span>' : '') +
          (notRemoved ? '<span style="background:#4a0a0a;color:#fca5a5;border:1px solid #e53e3e;border-radius:8px;padding:1px 8px;font-size:11px;">⚠ Not Removed</span>' : '') +
        '</div>' +
        (r.notes ? '<div style="margin-top:8px;font-size:12px;color:#8a6a6a;font-style:italic;">'+r.notes+'</div>' : '') +
      '</div>';
    }
    // Pest entry
    const rodentFlag = r.rodent === 'yes';
    const flyFlag    = r.fly === 'yes';
    const borderColor = rodentFlag ? '#c8a05a' : '#3a6a3a';
    const badges = [];
    if (rodentFlag) badges.push('<span style="background:#3a2800;color:#c8a05a;border:1px solid #7a5a1a;border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;">🐀 Rodents'+(r.rodentCount?' × '+r.rodentCount:'')+'</span>');
    if (flyFlag)    badges.push('<span style="background:#2a2000;color:#d69e2e;border:1px solid #5a4a10;border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;">🪰 Fly Activity'+(r.flyCount?' × '+r.flyCount:'')+'</span>');
    return '<div style="background:#111008;border:1px solid '+borderColor+';border-radius:10px;padding:14px 16px;margin-bottom:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
        '<div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;color:#f0ead8;">'+r.farm+' — Barn '+r.house+'</div>' +
          '<div style="font-size:11px;color:#8a7a5a;margin-top:2px;">'+r.date+' · '+r.time+' · '+r.employee+'</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + badges.join('') + '</div>' +
      (r.notes ? '<div style="margin-top:8px;font-size:12px;color:#8a7a5a;font-style:italic;">'+r.notes+'</div>' : '') +
    '</div>';
  }).join('');
}
