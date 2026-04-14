// TV SCOREBOARD MODE
// ═══════════════════════════════════════════
let tvAutoRefresh = true;
let tvRefreshInterval = null;
let tvClockInterval = null;

function openTVMode() {
  document.getElementById('tv-mode-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
  renderTVMode();
  startTVClock();
  if (tvAutoRefresh) {
    tvRefreshInterval = setInterval(renderTVMode, 30000);
  }
  // Auto-hide controls
  let hideTimer;
  const ctrl = document.getElementById('tv-controls');
  document.getElementById('tv-mode-overlay').onmousemove = function() {
    if (ctrl) { ctrl.style.opacity='1'; ctrl.style.pointerEvents='all'; }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=>{ if(ctrl){ctrl.style.opacity='0';ctrl.style.pointerEvents='none';} }, 3000);
  };
  // Kick off hide
  setTimeout(()=>{ if(ctrl){ctrl.style.opacity='0';ctrl.style.pointerEvents='none';} }, 3000);
}

function closeTVMode() {
  document.getElementById('tv-mode-overlay').style.display = 'none';
  document.body.style.overflow = '';
  clearInterval(tvRefreshInterval);
  clearInterval(tvClockInterval);
}

function toggleTVAutoRefresh() {
  tvAutoRefresh = !tvAutoRefresh;
  const btn = document.getElementById('tv-refresh-btn');
  btn.textContent = '⏱ AUTO-REFRESH: ' + (tvAutoRefresh ? 'ON' : 'OFF');
  clearInterval(tvRefreshInterval);
  if (tvAutoRefresh) tvRefreshInterval = setInterval(renderTVMode, 30000);
}

function startTVClock() {
  function tick() {
    const now = new Date();
    const el = document.getElementById('tv-clock');
    if (el) el.textContent = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const del = document.getElementById('tv-date');
    if (del) del.textContent = now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase();
  }
  tick();
  tvClockInterval = setInterval(tick, 1000);
}

function renderTVMode() {
  const now = new Date();
  const el = document.getElementById('tv-last-refresh');
  if (el) el.textContent = 'Updated: ' + now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

  // ── KPIs ──
  const openUrgent = workOrders.filter(w=>w.priority==='urgent'&&w.status!=='completed').length;
  const openWOs    = workOrders.filter(w=>w.status==='open'||w.status==='in-progress').length;
  const pmOverdue  = ALL_PM.filter(t=>pmStatus(t.id)==='overdue').length;
  const pmDoneToday= ALL_PM.filter(t=>doneToday(t.id)).length;
  const pmPct = ALL_PM.length > 0 ? Math.round(pmDoneToday/ALL_PM.length*100) : 0;

  // Barn walk completion
  const todayWalks = barnWalkStatus || {};
  const hDone = Array.from({length:8},(_,i)=>i+1).filter(n=>todayWalks['Hegins-'+n]).length;
  const dDone = Array.from({length:5},(_,i)=>i+1).filter(n=>todayWalks['Danville-'+n]).length;
  const totalDone = hDone + dDone;
  const totalBarns = 13;
  const barnPct = Math.round(totalDone/totalBarns*100);

  const kpis = [
    {num:openUrgent, lbl:'URGENT WOs', clr:openUrgent>0?'#c0392b':'#4caf50', bg:openUrgent>0?'#2a0808':'#0a1a0a', bdr:openUrgent>0?'#c0392b':'#1a4a1a'},
    {num:openWOs,    lbl:'OPEN WOs',   clr:openWOs>10?'#d69e2e':openWOs>0?'#f0ead8':'#4caf50', bg:openWOs>10?'#1a1000':'#0a1a0a', bdr:openWOs>10?'#d69e2e':'#1a4a1a'},
    {num:pmOverdue,  lbl:'PM OVERDUE', clr:pmOverdue>20?'#c0392b':pmOverdue>0?'#d69e2e':'#4caf50', bg:pmOverdue>0?'#1a0808':'#0a1a0a', bdr:pmOverdue>0?'#c0392b':'#1a4a1a'},
    {num:barnPct+'%',lbl:'BARN WALKS', clr:barnPct>=80?'#4caf50':barnPct>=50?'#d69e2e':'#c0392b', bg:barnPct>=80?'#0a1a0a':'#1a1000', bdr:barnPct>=80?'#1a4a1a':'#d69e2e'},
    {num:pmPct+'%',  lbl:'PM TODAY',   clr:pmPct>=80?'#4caf50':pmPct>0?'#9b59b6':'#3a6a3a', bg:'#0a0a1a', bdr:'#2a1a4a'},
  ];

  const kpiEl = document.getElementById('tv-kpi-row');
  if (kpiEl) kpiEl.innerHTML = kpis.map(k=>`
    <div style="background:${k.bg};border:1px solid ${k.bdr};border-radius:12px;padding:14px 10px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div style="font-size:clamp(32px,4vw,52px);font-weight:700;color:${k.clr};line-height:1;letter-spacing:-1px;">${k.num}</div>
      <div style="font-size:9px;letter-spacing:2px;color:${k.clr};opacity:.7;text-transform:uppercase;margin-top:5px;">${k.lbl}</div>
    </div>`).join('');

  // ── Barn grid: split by farm ──
  const barnCellHTML = (farm, n) => {
    const key = farm+'-'+n;
    const s = todayWalks[key];
    const colors = {green:{bg:'#0d2a0d',bdr:'#4caf50',clr:'#4caf50',icon:'✓'},yellow:{bg:'#1a1000',bdr:'#d69e2e',clr:'#d69e2e',icon:'⚠'},red:{bg:'#1a0505',bdr:'#c0392b',clr:'#c0392b',icon:'🔴'}};
    const c = colors[s] || {bg:'#0a150a',bdr:'#1a3a1a',clr:'#2a5a2a',icon:'—'};
    return `<div style="background:${c.bg};border:1px solid ${c.bdr};border-radius:8px;padding:8px 4px;text-align:center;">
      <div style="font-size:16px;font-weight:700;color:${c.clr};">${n}</div>
      <div style="font-size:12px;">${c.icon}</div>
    </div>`;
  };

  const hEl = document.getElementById('tv-barn-hegins');
  if (hEl) hEl.innerHTML = Array.from({length:8},(_,i)=>barnCellHTML('Hegins',i+1)).join('');
  const dEl = document.getElementById('tv-barn-danville');
  if (dEl) dEl.innerHTML = Array.from({length:5},(_,i)=>barnCellHTML('Danville',i+1)).join('');

  const bwEl = document.getElementById('tv-barn-walk-pct');
  if (bwEl) bwEl.textContent = totalDone + ' of ' + totalBarns + ' barns completed today';
  const barEl = document.getElementById('tv-walk-bar');
  if (barEl) { barEl.style.width=barnPct+'%'; barEl.style.background=barnPct>=80?'#4caf50':barnPct>=50?'#d69e2e':'#c0392b'; }

  // ── WO list ──
  const wosToShow = workOrders
    .filter(w=>w.status!=='completed')
    .sort((a,b)=>{const o={urgent:0,high:1,routine:2};return(o[a.priority]||2)-(o[b.priority]||2);})
    .slice(0,12);

  const woCountEl = document.getElementById('tv-wo-count');
  if (woCountEl) woCountEl.textContent = openWOs + ' open';

  const priClr={urgent:'#c0392b',high:'#d69e2e',routine:'#4caf50'};
  const priBg={urgent:'#1a0505',high:'#1a1000',routine:'#0a1a0a'};
  const priBdr={urgent:'#5a1010',high:'#5a3a00',routine:'#1a3a1a'};

  const woEl = document.getElementById('tv-wo-list');
  if (woEl) woEl.innerHTML = wosToShow.length
    ? wosToShow.map(w=>`
      <div style="background:${priBg[w.priority]||'#0a1a0a'};border:1px solid ${priBdr[w.priority]||'#1a3a1a'};border-radius:8px;padding:9px 12px;border-left:3px solid ${priClr[w.priority]||'#3b82f6'};">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
          <span style="font-size:13px;font-weight:700;color:#f0ead8;">${w.id}</span>
          <span style="font-size:11px;color:#a0b0a0;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${w.farm} · ${w.house}</span>
          <span style="font-size:10px;font-weight:700;color:${priClr[w.priority]||'#3b82f6'};white-space:nowrap;letter-spacing:1px;">${(w.priority||'').toUpperCase()}</span>
        </div>
        <div style="font-size:11px;color:#7a9a7a;margin-top:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${w.problem||''}</div>
      </div>`)
      .join('')
    : '<div style="text-align:center;padding:30px 10px;color:#4caf50;font-size:15px;letter-spacing:1px;">✅ ALL CLEAR</div>';

  // ── PM Overdue list ──
  const pmOverdueItems = ALL_PM.filter(t=>pmStatus(t.id)==='overdue').slice(0,10);
  const SYS_IC = {Ventilation:'💨',Water:'💧',Feed:'🌾',Manure:'♻️','Egg Collectors':'🥚',Heating:'🔥',Electrical:'⚡',Lubing:'🛢️',Building:'🏗️',Alarms:'🚨'};
  const pmEl = document.getElementById('tv-pm-list');
  if (pmEl) pmEl.innerHTML = pmOverdueItems.length
    ? pmOverdueItems.map(t=>`
      <div style="background:#1a0808;border:1px solid #3a1010;border-radius:7px;padding:8px 10px;">
        <div style="font-size:11px;font-weight:700;color:#e07070;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${SYS_IC[t.sys]||'🔧'} ${t.task.slice(0,45)}${t.task.length>45?'…':''}</div>
        <div style="font-size:10px;color:#7a4a4a;margin-top:2px;">${t.farm} · ${t.sys}</div>
      </div>`)
      .join('') + (ALL_PM.filter(t=>pmStatus(t.id)==='overdue').length > 10 ? `<div style="text-align:center;padding:8px;font-size:11px;color:#7a4a4a;">+ ${ALL_PM.filter(t=>pmStatus(t.id)==='overdue').length - 10} more…</div>` : '')
    : '<div style="text-align:center;padding:20px;color:#4caf50;font-size:13px;">✅ No overdue PMs</div>';

  // ── Ticker: low stock ──
  const lowParts = PARTS_DEFS.filter(p=>{const inv=partsInventory[p.id]||{qty:0,min:1};return inv.qty<=inv.min;});
  const tickEl = document.getElementById('tv-ticker');
  if (tickEl) tickEl.textContent = lowParts.length
    ? '⚠ LOW STOCK: ' + lowParts.map(p=>`${p.name} (${partsInventory[p.id]?.qty||0} left)`).join(' · ')
    : '✅ All parts stocked above minimum';
}

// ═══════════════════════════════════════════
// 5S SYSTEM
// ═══════════════════════════════════════════
let s5Records = [];
let s5LocFilter = 'all';
let redTags = [];

function s5Loc(v, btn) {
  s5LocFilter = v;
  document.querySelectorAll('#5s-loc-bar .loc-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  render5S();
}

// Real-time listeners for 5S — called from initApp
function start5SListener() {
  db.collection('5sAudits').orderBy('ts','desc').limit(200).onSnapshot(snap => {
    s5Records = [];
    snap.forEach(d => s5Records.push({...d.data(), _fbId: d.id}));
    if (window._maintSection==='5s') render5S();
  }, err => console.error('5sAudits listener:', err));

  db.collection('redTags').orderBy('ts','desc').limit(200).onSnapshot(snap => {
    redTags = [];
    snap.forEach(d => redTags.push({...d.data(), _fbId: d.id}));
    if (window._maintSection==='5s') render5S();
  }, err => console.error('redTags listener:', err));
}

function render5S() {
  const base = s5LocFilter==='all' ? s5Records : s5Records.filter(r=>r.farm===s5LocFilter);
  const rtBase = s5LocFilter==='all' ? redTags : redTags.filter(r=>r.farm===s5LocFilter);

  // Stats
  const avgScore = base.length ? Math.round(base.reduce((s,r)=>s+(r.totalScore||0),0)/base.length) : 0;
  const rtOpen = rtBase.filter(r=>!r.resolved).length;
  const lastAudit = base.length ? base[0].date : '—';
  const critCount = base.filter(r=>(r.totalScore||0)<40).length;

  const statsEl = document.getElementById('5s-stats');
  if (statsEl) {
    const sc_ = (cls,num,lbl)=>`<div class="stat-card ${cls}"><div class="stat-num">${num}</div><div class="stat-label">${lbl}</div></div>`;
    statsEl.innerHTML =
      sc_(avgScore>=70?'s-green':avgScore>=50?'s-amber':'s-red', avgScore+'/100','Avg Score') +
      sc_('s-amber', base.length,'Audits') +
      sc_(rtOpen>0?'s-red':'s-green', rtOpen,'Open Red Tags') +
      sc_(critCount>0?'s-red':'','Last: '+lastAudit,'Last Audit');
  }

  // Render audit cards grouped by barn
  const barnMap = {};
  base.forEach(r=>{
    const k=r.farm+' '+r.house;
    if (!barnMap[k]||r.ts>barnMap[k].ts) barnMap[k]=r;
  });

  const container = document.getElementById('5s-container');
  if (!container) return;

  if (Object.keys(barnMap).length === 0) {
    container.innerHTML = '<div class="empty"><div class="ei">5️⃣</div><p>No 5S audits yet. Tap "New 5S Audit" to start.</p></div>';
    return;
  }

  const getScoreClass = s => s>=70?'5s-score-good':s>=50?'5s-score-warn':'5s-score-bad';
  container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">' +
    Object.entries(barnMap).map(([k,r])=>{
      const cls = getScoreClass(r.totalScore||0);
      const scoreColor = (r.totalScore||0)>=70?'#2e7d32':(r.totalScore||0)>=50?'#856404':'#c62828';
      return `<div class="fives-audit-card" onclick="view5SAudit('${r._fbId}')">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="font-weight:700;font-size:15px;">${r.farm} · ${r.house}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">Last audit: ${r.date||'—'} by ${r.auditor||'—'}</div>
          </div>
          <div class="fives-score-badge ${cls}">${r.totalScore||0}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;">
          ${['sort','set','shine','standardize','sustain'].map((s,i)=>`
            <div style="text-align:center;background:#f9f9f9;border-radius:6px;padding:6px 2px;">
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-bottom:2px;">${['Sort','Set','Shine','Std','Sus'][i]}</div>
              <div style="font-weight:700;font-size:14px;color:${scoreColor};">${r.scores?.[s]||0}</div>
            </div>`).join('')}
        </div>
        ${r.redtags?`<div style="margin-top:8px;font-size:11px;background:#fde8e6;border-radius:6px;padding:6px 10px;color:#c62828;">🏷️ Red tags: ${r.redtags.slice(0,60)}</div>`:''}
      </div>`;
    }).join('') + '</div>';
}

function update5SSlider(input) {
  input.nextElementSibling.textContent = input.value;
  // Update total
  const total = Array.from(document.querySelectorAll('.fives-slider')).reduce((s,el)=>s+parseInt(el.value),0);
  const totalEl = document.getElementById('5sf-total');
  if (totalEl) {
    totalEl.textContent = total + '/100';
    totalEl.style.color = total>=70?'var(--green-mid)':total>=50?'#d69e2e':'#e53e3e';
  }
}

function open5SForm() {
  document.getElementById('5sf-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('5sf-farm').value = '';
  document.getElementById('5sf-house').innerHTML = '<option value="">— Select Farm First —</option>';
  document.getElementById('5sf-auditor').value = '';
  document.getElementById('5sf-redtags').value = '';
  document.getElementById('5sf-notes').value = '';
  document.querySelectorAll('.fives-slider').forEach(s=>{s.value=5;s.nextElementSibling.textContent=5;});
  document.getElementById('5sf-total').textContent = '50/100';
  document.getElementById('5s-form-title').textContent = 'New 5S Audit';
  document.getElementById('5s-form-modal').classList.add('open');
}

function close5SForm() {
  document.getElementById('5s-form-modal').classList.remove('open');
}

function load5SHouses() {
  const farm = document.getElementById('5sf-farm').value;
  const sel = document.getElementById('5sf-house');
  sel.innerHTML = '<option value="">— Select House —</option>';
  if (!farm) return;
  const houses = (FARM_HOUSES[farm]||[]).concat(['Feed System','Ventilation / Fans','Well House / Pump','Shop / Office','Catch / Load Out']);
  houses.forEach(h=>{const o=document.createElement('option');o.value=h;o.textContent=h;sel.appendChild(o);});
}

async function save5SAudit() {
  const farm = document.getElementById('5sf-farm').value;
  const house = document.getElementById('5sf-house').value;
  const auditor = document.getElementById('5sf-auditor').value.trim();
  const date = document.getElementById('5sf-date').value;
  if (!farm||!house||!auditor) { alert('Please fill in Farm, House, and Auditor.'); return; }
  const scores = {};
  document.querySelectorAll('#5sf-scores .fives-score-row').forEach(row=>{
    const key = row.dataset.key;
    const val = parseInt(row.querySelector('.fives-slider').value);
    scores[key] = val;
  });
  const totalScore = Object.values(scores).reduce((s,v)=>s+v,0);
  const record = {
    farm, house, auditor, date,
    scores, totalScore,
    redtags: document.getElementById('5sf-redtags').value.trim(),
    notes: document.getElementById('5sf-notes').value.trim(),
    ts: Date.now()
  };
  setSyncDot('saving');
  await db.collection('5sAudits').add(record);
  s5Records = []; // force reload
  setSyncDot('live');
  close5SForm();
  render5S();
}

let current5SAuditFbId = null;
let is5SAuditEditMode = false;

const S5_KEYS = ['sort','set','shine','standardize','sustain'];
const S5_LABELS = ['Sort','Set In Order','Shine','Standardize','Sustain'];
const S5_DESC = ['Remove unneeded items','Organize — a place for everything','Clean and inspect','Create standards','Maintain discipline'];

async function view5SAudit(fbId) {
  const record = s5Records.find(r => r._fbId === fbId);
  if (!record) return;
  current5SAuditFbId = fbId;
  is5SAuditEditMode = false;

  document.getElementById('5sam-title').textContent = `${record.farm} · ${record.house}`;
  document.getElementById('5sam-meta').textContent = `Audit by ${record.auditor||'—'} · ${record.date||'—'} · Score: ${record.totalScore||0}/100`;
  document.getElementById('5sam-edit-btn').textContent = '✏️ Edit';

  render5SAuditView(record);
  render5SAuditEditForm(record);
  setAuditEditMode(false);

  document.getElementById('5s-audit-modal').classList.add('open');
}

function render5SAuditView(record) {
  const scoreColor = s => s >= 16 ? '#2e7d32' : s >= 10 ? '#856404' : '#c62828';
  const html = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;">
      ${S5_KEYS.map((k,i) => {
        const v = record.scores?.[k] ?? 0;
        return `<div style="text-align:center;background:#f9f9f9;border-radius:8px;padding:10px 4px;">
          <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">${S5_LABELS[i]}</div>
          <div style="font-size:22px;font-weight:700;color:${scoreColor(v)};">${v}</div>
          <div style="font-size:9px;color:var(--muted);">/20</div>
        </div>`;
      }).join('')}
    </div>
    <div style="background:#f9f9f9;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-weight:700;font-size:14px;color:var(--muted);">Total Score</span>
      <span style="font-size:24px;font-weight:700;color:${(record.totalScore||0)>=70?'#2e7d32':(record.totalScore||0)>=50?'#856404':'#c62828'};">${record.totalScore||0} / 100</span>
    </div>`;
  document.getElementById('5sam-scores-view').innerHTML = html;
}

function render5SAuditEditForm(record) {
  const html = S5_KEYS.map((k,i) => {
    const v = record.scores?.[k] ?? 0;
    return `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:600;">${S5_LABELS[i]} <span style="font-size:11px;color:var(--muted);">— ${S5_DESC[i]}</span></span>
        <span id="5sam-val-${k}" style="font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;">${v}/20</span>
      </div>
      <input type="range" min="0" max="20" value="${v}" class="fives-slider"
        oninput="document.getElementById('5sam-val-${k}').textContent=this.value+'/20';update5SAuditTotal()"
        id="5sam-slider-${k}" style="width:100%;">
    </div>`;
  }).join('') + `<div id="5sam-total-display" style="text-align:center;font-size:15px;font-weight:700;padding:8px;background:#f9f9f9;border-radius:8px;"></div>`;
  document.getElementById('5sam-scores-edit').innerHTML = html;
  update5SAuditTotal();
}

function update5SAuditTotal() {
  const total = S5_KEYS.reduce((s,k) => {
    const el = document.getElementById('5sam-slider-'+k);
    return s + (el ? parseInt(el.value) : 0);
  }, 0);
  const el = document.getElementById('5sam-total-display');
  if (el) {
    el.textContent = `Total: ${total}/100`;
    el.style.color = total>=70?'#2e7d32':total>=50?'#856404':'#c62828';
  }
}

function setAuditEditMode(editing) {
  is5SAuditEditMode = editing;
  document.getElementById('5sam-scores-view').style.display  = editing ? 'none' : '';
  document.getElementById('5sam-scores-edit').style.display  = editing ? '' : 'none';
  document.getElementById('5sam-notes-view').style.display   = editing ? 'none' : '';
  document.getElementById('5sam-notes-edit').style.display   = editing ? '' : 'none';
  document.getElementById('5sam-redtags-view').style.display = editing ? 'none' : '';
  document.getElementById('5sam-redtags-edit').style.display = editing ? '' : 'none';
  document.getElementById('5sam-fields-edit').style.display  = editing ? '' : 'none';
  document.getElementById('5sam-action-btns').style.display  = editing ? '' : 'none';
  document.getElementById('5sam-edit-btn').textContent = editing ? '✕ Cancel Edit' : '✏️ Edit';

  const record = s5Records.find(r => r._fbId === current5SAuditFbId);
  if (!record) return;
  document.getElementById('5sam-notes-view').textContent   = record.notes || '(no notes)';
  document.getElementById('5sam-redtags-view').textContent = record.redtags || '(none)';
  if (editing) {
    document.getElementById('5sam-notes-edit').value    = record.notes || '';
    document.getElementById('5sam-redtags-edit').value  = record.redtags || '';
    document.getElementById('5sam-auditor-edit').value  = record.auditor || '';
    document.getElementById('5sam-date-edit').value     = record.date || '';
  }
}

function toggle5SAuditEdit() {
  setAuditEditMode(!is5SAuditEditMode);
}

async function save5SAuditEdit() {
  if (!current5SAuditFbId) return;
  const scores = {};
  S5_KEYS.forEach(k => {
    const el = document.getElementById('5sam-slider-'+k);
    scores[k] = el ? parseInt(el.value) : 0;
  });
  const totalScore = Object.values(scores).reduce((s,v)=>s+v,0);
  const notes    = document.getElementById('5sam-notes-edit').value.trim();
  const redtags  = document.getElementById('5sam-redtags-edit').value.trim();
  const auditor  = document.getElementById('5sam-auditor-edit').value.trim();
  const date     = document.getElementById('5sam-date-edit').value;

  setSyncDot('saving');
  await db.collection('5sAudits').doc(current5SAuditFbId).update({scores, totalScore, notes, redtags, auditor, date, updatedTs: Date.now()});

  // Refresh local record
  const idx = s5Records.findIndex(r=>r._fbId===current5SAuditFbId);
  if (idx !== -1) s5Records[idx] = {...s5Records[idx], scores, totalScore, notes, redtags, auditor, date};

  setSyncDot('live');
  setAuditEditMode(false);
  document.getElementById('5sam-meta').textContent = `Audit by ${auditor||'—'} · ${date||'—'} · Score: ${totalScore}/100`;
  render5SAuditView(s5Records[idx]);
  render5S();
}

async function delete5SAudit() {
  if (!current5SAuditFbId) return;
  if (!confirm('Delete this 5S audit? This cannot be undone.')) return;
  setSyncDot('saving');
  await db.collection('5sAudits').doc(current5SAuditFbId).delete();
  s5Records = s5Records.filter(r=>r._fbId!==current5SAuditFbId);
  setSyncDot('live');
  close5SAuditModal();
  render5S();
}

function close5SAuditModal() {
  document.getElementById('5s-audit-modal').classList.remove('open');
  current5SAuditFbId = null;
  is5SAuditEditMode = false;
}

// ─── Red Tags ───
function open5SRedTag() {
  loadRedTags();
  document.getElementById('5s-redtag-modal').classList.add('open');
}

function close5SRedTag() {
  document.getElementById('5s-redtag-modal').classList.remove('open');
}

async function loadRedTags() {
  try {
    const snap = await db.collection('redTags').orderBy('ts','desc').limit(100).get();
    redTags = [];
    snap.forEach(d=>redTags.push({...d.data(),_fbId:d.id}));
    renderRedTagList();
  } catch(e){ renderRedTagList(); }
}

function renderRedTagList() {
  const el = document.getElementById('rt-list');
  if (!el) return;
  const active = redTags.filter(r=>!r.resolved);
  const resolved = redTags.filter(r=>r.resolved);
  const rows = [...active,...resolved.slice(0,5)];
  if (!rows.length){ el.innerHTML='<div class="empty"><div class="ei">🏷️</div><p>No red tags yet</p></div>'; return; }
  const actionLabel={remove:'Remove',repair:'Repair',relocate:'Relocate',evaluate:'Evaluate'};
  const catIcon={tools:'🔧',electrical:'⚡',walls:'🧱',equipment:'🏭',chemical:'🧪',other:'📦'};
  el.innerHTML = rows.map(r=>`
    <div class="rt-card ${r.resolved?'resolved':''}">
      <div style="font-size:22px;">${catIcon[r.category]||'📦'}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:14px;">${r.item}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">${r.farm||'—'} · ${r.house||'—'} · ${actionLabel[r.action]||r.action}</div>
        <div style="font-size:11px;color:var(--muted);">${r.date||'—'}</div>
      </div>
      ${!r.resolved?`<button onclick="resolveRedTag('${r._fbId}')" style="padding:6px 12px;background:#e6f4ea;border:1px solid #2e7d32;color:#2e7d32;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">✓ Resolved</button>`
        :'<span style="font-size:11px;color:#2e7d32;font-weight:700;">RESOLVED</span>'}
    </div>`).join('');
}

async function addRedTag() {
  const farm = document.getElementById('rt-farm').value;
  const house = document.getElementById('rt-house').value.trim();
  const item = document.getElementById('rt-item').value.trim();
  const category = document.getElementById('rt-category').value;
  const action = document.getElementById('rt-action').value;
  if (!item) { alert('Item description required'); return; }
  const record = { farm, house, item, category, action, date: new Date().toISOString().slice(0,10), resolved: false, ts: Date.now() };
  setSyncDot('saving');
  const ref = await db.collection('redTags').add(record);
  record._fbId = ref.id;
  redTags.unshift(record);
  setSyncDot('live');
  document.getElementById('rt-item').value = '';
  renderRedTagList();
}

async function resolveRedTag(fbId) {
  setSyncDot('saving');
  await db.collection('redTags').doc(fbId).update({resolved:true,resolvedDate:new Date().toISOString().slice(0,10)});
  const r = redTags.find(r=>r._fbId===fbId);
  if (r) r.resolved = true;
  setSyncDot('live');
  renderRedTagList();
}

// ═══════════════════════════════════════════
// PURCHASE ORDER MODAL (enhanced)
// ═══════════════════════════════════════════
let poItems = [];

function openPOModal(preselected) {
  poItems = [];
  const lowParts = PARTS_DEFS.filter(p=>{
    const inv = partsInventory[p.id]||{qty:0,min:1};
    return inv.qty <= inv.min;
  });
  const initParts = preselected ? [preselected] : lowParts;

  document.getElementById('po-modal-subtitle').textContent =
    preselected ? 'Review and submit order' : lowParts.length + ' low-stock items auto-selected';

  poItems = initParts.map(p=>({
    part:p,
    qty: Math.max(1, ((partsInventory[p.id]?.min||1)*3) - (partsInventory[p.id]?.qty||0))
  }));
  renderPOItems();
  document.getElementById('po-requested-by').value = '';
  document.getElementById('po-notes').value = '';
  document.getElementById('po-modal').classList.add('open');
}

function closePOModal() {
  document.getElementById('po-modal').classList.remove('open');
}

function renderPOItems() {
  const el = document.getElementById('po-items-list');
  if (!el) return;
  if (!poItems.length) {
    el.innerHTML = '<div class="empty" style="padding:20px;"><p>No items selected. All parts are stocked above minimum.</p></div>';
    document.getElementById('po-total').textContent = '$0.00';
    return;
  }
  el.innerHTML = poItems.map((item,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
      <div style="flex:1;">
        <div style="font-weight:700;font-size:13px;">${item.part.name}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;">${item.part.rhNum||''} · #${item.part.itemNo}</div>
        <div style="font-size:11px;color:var(--muted);">In stock: ${partsInventory[item.part.id]?.qty||0} · Min: ${partsInventory[item.part.id]?.min||1}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button onclick="poQtyAdj(${i},-1)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:#f9f9f9;font-size:16px;cursor:pointer;">−</button>
        <div style="font-weight:700;font-size:16px;font-family:'IBM Plex Mono',monospace;min-width:30px;text-align:center;">${item.qty}</div>
        <button onclick="poQtyAdj(${i},1)" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:#f9f9f9;font-size:16px;cursor:pointer;">+</button>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;min-width:70px;text-align:right;">
        ${item.part.unitPrice>0?'$'+(item.part.unitPrice*item.qty).toFixed(2):'—'}
      </div>
      <button onclick="poRemoveItem(${i})" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
    </div>`).join('');
  const total = poItems.reduce((s,item)=>s+(item.part.unitPrice||0)*item.qty,0);
  document.getElementById('po-total').textContent = '$' + total.toFixed(2);
}

function poQtyAdj(i, delta) {
  poItems[i].qty = Math.max(1, poItems[i].qty + delta);
  renderPOItems();
}

function poRemoveItem(i) {
  poItems.splice(i, 1);
  renderPOItems();
}

async function submitPO() {
  if (!poItems.length) { closePOModal(); return; }
  const requestedBy = document.getElementById('po-requested-by').value.trim() || 'System';
  const notes = document.getElementById('po-notes').value.trim();
  const poNum = await getNextPO();
  const total = poItems.reduce((s,item)=>s+(item.part.unitPrice||0)*item.qty,0);
  const record = {
    poNum, requestedBy, notes,
    items: poItems.map(item=>({id:item.part.id,name:item.part.name,itemNo:item.part.itemNo,qty:item.qty,unitPrice:item.part.unitPrice||0})),
    totalEstimate: total,
    status: 'submitted',
    date: new Date().toISOString().slice(0,10),
    ts: Date.now()
  };
  setSyncDot('saving');
  await db.collection('purchaseOrders').add(record);
  await db.collection('activityLog').add({
    type:'po', id:poNum,
    desc:`Purchase Order ${poNum} generated — ${poItems.length} items, est. $${total.toFixed(2)}`,
    tech:requestedBy, date:record.date, ts:Date.now()
  });
  setSyncDot('live');
  closePOModal();
  alert('✅ Purchase Order ' + poNum + ' submitted!\nEstimate: $' + total.toFixed(2));
}

// ═══════════════════════════════════════════
// ENHANCED DASHBOARD — add barn walk status
// ═══════════════════════════════════════════
// Expose barnWalkStatus to TV mode
var barnWalkStatus = {};

const _origMarkBarnDone = typeof markBarnDone === 'function' ? markBarnDone : null;
// Intercept barn walk completions to update TV data
function updateBarnWalkStatus(farm, houseNum, flags) {
  const key = farm + '-' + houseNum;
  const hasCrit = flags.some(f=>f.status==='critical');
  const hasNeeds = flags.some(f=>f.status==='needs');
  barnWalkStatus[key] = hasCrit ? 'red' : hasNeeds ? 'yellow' : 'green';
}

// ═══════════════════════════════════════════
// ENHANCED PARTS PANEL — add PO button  
// ═══════════════════════════════════════════
// Inject PO button into parts panel on load
document.addEventListener('DOMContentLoaded', function() {
  const partsTitle = document.querySelector('#maint-parts .section-sub') || document.querySelector('#panel-parts .section-title');
  if (partsTitle) {
    const poBtn = document.createElement('button');
    poBtn.textContent = '📋 Generate Purchase Order';
    poBtn.style.cssText = 'padding:10px 18px;background:#1a3a6b;border:2px solid #3b82f6;color:#fff;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px;display:block;';
    poBtn.onclick = () => openPOModal(null);
    partsTitle.after(poBtn);
  }
});

// ═══════════════════════════════════════════
// BARN WALK WORKFLOW ENFORCEMENT
// ═══════════════════════════════════════════
// Wrap prodSubmit to also update barnWalkStatus
const _origProdSubmit = typeof prodSubmit === 'function' ? prodSubmit.bind(window) : null;
// The actual enforcement is handled by requiring all items flagged before submit (already in prodRenderSummary)
// Enhanced: force notes on non-good items
const _origProdSetStatus = typeof prodSetStatus === 'function' ? prodSetStatus : null;


// ═══════════════════════════════════════════
// BULK PM CATCH-UP
// ═══════════════════════════════════════════
let bulkPMSelected = new Set();

function openBulkPM(preFilter) {
  document.getElementById('bulk-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('bulk-tech').value = '';
  document.getElementById('bulk-notes').value = 'Catch-up completion — tasks performed per normal schedule';
  document.getElementById('bulk-pm-progress').style.display = 'none';
  document.getElementById('bulk-pm-submit-btn').disabled = false;
  if (preFilter) {
    document.getElementById('bulk-farm-filter').value = 'all';
  }
  // Refresh staff dropdown every time modal opens
  if (typeof updateStaffDropdowns === 'function') updateStaffDropdowns();
  bulkPMSelected = new Set();
  renderBulkPMList();
  if (preFilter === 'daily') {
    // Auto-select all daily overdue
    ALL_PM.filter(t=>t.freq==='daily'&&pmStatus(t.id)==='overdue').forEach(t=>bulkPMSelected.add(t.id));
    renderBulkPMList();
  }
  document.getElementById('bulk-pm-modal').classList.add('open');
}

function closeBulkPM() {
  document.getElementById('bulk-pm-modal').classList.remove('open');
}

function renderBulkPMList() {
  const farm = document.getElementById('bulk-farm-filter')?.value || 'all';
  const tasks = farm==='all' ? ALL_PM : ALL_PM.filter(t=>t.farm===farm);
  const overdue = tasks.filter(t=>pmStatus(t.id)==='overdue');

  const SYS_IC2 = {Ventilation:'💨',Water:'💧',Feed:'🌾',Manure:'♻️','Egg Collectors':'🥚',Heating:'🔥',Electrical:'⚡',Lubing:'🛢️',Building:'🏗️',Alarms:'🚨'};
  const freqColor = {daily:'#4caf50',weekly:'#3b82f6',monthly:'#d69e2e',quarterly:'#e67e22',annual:'#e53e3e'};

  if (!overdue.length) {
    document.getElementById('bulk-pm-list').innerHTML = '<div class="empty" style="padding:20px;"><div class="ei">✅</div><p>No overdue PM tasks for this filter</p></div>';
    updateBulkCount();
    return;
  }

  // Group by system
  const bySystem = {};
  overdue.forEach(t=>{
    if (!bySystem[t.sys]) bySystem[t.sys] = [];
    bySystem[t.sys].push(t);
  });

  let html = '';
  Object.entries(bySystem).forEach(([sys, tasks]) => {
    html += `<div style="background:#f9f9f9;padding:8px 12px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border);">${SYS_IC2[sys]||'🔧'} ${sys} (${tasks.length})</div>`;
    tasks.forEach(t => {
      const checked = bulkPMSelected.has(t.id);
      html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f0f0f0;cursor:pointer;${checked?'background:#f0f9f0;':''}" onclick="bulkToggle('${t.id}')">
        <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${checked?'var(--green-mid)':'#ccc'};background:${checked?'var(--green-mid)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${checked?'<span style="color:white;font-size:12px;">✓</span>':''}
        </div>
        <div style="flex:1;">
          <div style="font-size:13px;color:var(--ink);">${t.task}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;font-family:'IBM Plex Mono',monospace;">
            ${t.farm} · <span style="color:${freqColor[t.freq]||'#666'}">${t.freq}</span>
          </div>
        </div>
      </div>`;
    });
  });

  document.getElementById('bulk-pm-list').innerHTML = html;
  updateBulkCount();
}

function bulkToggle(id) {
  if (bulkPMSelected.has(id)) bulkPMSelected.delete(id);
  else bulkPMSelected.add(id);
  renderBulkPMList();
}

function bulkSelectAll(val) {
  const farm = document.getElementById('bulk-farm-filter')?.value || 'all';
  const tasks = farm==='all' ? ALL_PM : ALL_PM.filter(t=>t.farm===farm);
  tasks.filter(t=>pmStatus(t.id)==='overdue').forEach(t=>{ if(val) bulkPMSelected.add(t.id); else bulkPMSelected.delete(t.id); });
  renderBulkPMList();
}

function bulkSelectByFreq(freq) {
  bulkPMSelected.clear();
  ALL_PM.filter(t=>t.freq===freq&&pmStatus(t.id)==='overdue').forEach(t=>bulkPMSelected.add(t.id));
  renderBulkPMList();
}

function updateBulkCount() {
  const el = document.getElementById('bulk-selected-count');
  if (el) el.textContent = bulkPMSelected.size + ' selected';
}

async function submitBulkPM() {
  const tech = document.getElementById('bulk-tech').value;
  const date = document.getElementById('bulk-date').value;
  const notes = document.getElementById('bulk-notes').value.trim() || 'Bulk catch-up completion';
  if (!tech) { alert('Please select who completed these tasks.'); return; }
  if (!date) { alert('Please select a completion date.'); return; }
  if (!bulkPMSelected.size) { alert('No tasks selected.'); return; }

  const ids = Array.from(bulkPMSelected);
  document.getElementById('bulk-pm-submit-btn').disabled = true;
  document.getElementById('bulk-pm-progress').style.display = 'block';

  let done = 0;
  const batch = db.batch();
  const historyDocs = [];

  for (const pmId of ids) {
    const t = ALL_PM.find(x=>x.id===pmId);
    if (!t) continue;
    // Update latest completion
    const ref = db.collection('pmCompletions').doc(pmId);
    batch.set(ref, {tech, date, parts:'', notes, ts:Date.now()});
    // Prepare history record
    historyDocs.push({pmId, farm:t.farm, sys:t.sys, task:t.task, freq:t.freq, tech, date, parts:'', notes, ts:Date.now()});
    done++;
    document.getElementById('bulk-pm-bar').style.width = (done/ids.length*100)+'%';
    document.getElementById('bulk-pm-status').textContent = `Saving ${done}/${ids.length}...`;
  }

  setSyncDot('saving');
  await batch.commit();

  // Write history records in batches of 500
  const histBatch = db.batch();
  historyDocs.forEach(h=>{ histBatch.set(db.collection('pmHistory').doc(), h); });
  await histBatch.commit();

  // Activity log
  await db.collection('activityLog').add({
    type:'pm', id:'BULK',
    desc:`Bulk PM catch-up: ${ids.length} tasks marked done by ${tech} for date ${date}`,
    tech, date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), ts:Date.now()
  });

  setSyncDot('live');
  document.getElementById('bulk-pm-status').textContent = `✅ ${ids.length} tasks marked complete!`;
  document.getElementById('bulk-pm-bar').style.background = '#4caf50';

  // Reload PM completions
  const snap = await db.collection('pmCompletions').get();
  pmComps = {};
  snap.forEach(d=>{ pmComps[d.id] = d.data(); });

  setTimeout(()=>{
    closeBulkPM();
    renderPM();
    renderDash();
  }, 1500);
}

// ═══════════════════════════════════════════
// MULTI-SITE SELECTOR (Phase 9 foundation)
// ═══════════════════════════════════════════
const SITES = {
  Hegins:   { houses: 8, techs: ['Nathan','Adam','Carlos','Randy','Steve'], lead: 'Nathan' },
  Danville: { houses: 5, techs: ['Josh','Cain','Celia','Deb','Steve'], lead: 'Josh' },
};

// Landing page site filter
let activeSite = 'all';

function setSiteFilter(site, btn) {
  activeSite = site;
  document.querySelectorAll('.site-filter-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Update landing cards
  if (typeof renderBarnGrid === 'function') renderBarnGrid();
  if (typeof renderMaintCard === 'function') renderMaintCard();
}

// ═══════════════════════════════════════════
// WORKFLOW ENFORCEMENT: WO Notes required
// ═══════════════════════════════════════════
// Validate WO form — ensure notes on non-routine issues
const _origSubmitWO = typeof submitWO === 'function' ? submitWO : null;
function submitWOEnhanced() {
  const desc = document.getElementById('wo-desc')?.value?.trim();
  const pri = typeof selPri !== 'undefined' ? selPri : '';
  if (pri === 'urgent' && (!desc || desc.length < 10)) {
    alert('⚠️ Urgent WOs require a description. Please describe what you found.');
    document.getElementById('wo-desc')?.focus();
    return;
  }
  if (typeof submitWO === 'function') submitWO();
}

// Override submit button
document.addEventListener('DOMContentLoaded', function() {
  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn && submitBtn.getAttribute('onclick') === 'submitWO()') {
    submitBtn.setAttribute('onclick', 'submitWOEnhanced()');
  }
  // Pre-populate the farm dropdown as soon as the page loads
  initShipFarmDropdown();
});


// ═══════════════════════════════════════════
// SPEED OPTIMIZATIONS
// ═══════════════════════════════════════════
// Large-button tap targets already exist; add keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (document.getElementById('tv-mode-overlay').style.display !== 'none') {
    if (e.key === 'Escape') closeTVMode();
    return;
  }
  // Ctrl+W = new work order
  if (e.ctrlKey && e.key === 'w') { e.preventDefault(); go('wo-submit'); }
  // Ctrl+D = dashboard
  if (e.ctrlKey && e.key === 'd') { e.preventDefault(); if(typeof enterApp==='function') enterApp('dash'); }
});

