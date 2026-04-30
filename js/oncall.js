// ═══════════════════════════════════════════
// ON-CALL MODULE  (v2 — site-first design)
// ═══════════════════════════════════════════
let onCallLog      = [];
let onCallSched    = {};
let _ocSite        = 'Danville';
let _ocSection     = 'log';
let _ocCalMonth    = '';
let _ocHistFilter  = 'all';
let _ocCounter     = 1;

const OC_SITES   = ['Danville','Hegins','Rushtown'];
const OC_REASONS = [
  'Equipment Failure','Animal Health','Safety Issue',
  'Power Outage','Water / Feed Issue','Weather Emergency',
  'After-Hours Work Order','Biosecurity','Injury / Accident','Other'
];

// ── Listeners ────────────────────────────────
function startOnCallListener() {
  try {
    db.collection('onCallLog').orderBy('ts','desc').onSnapshot(snap => {
      onCallLog = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
      const nums  = onCallLog.map(e => parseInt((e.ocNum||'OC-0').replace('OC-','')));
      const valid = nums.filter(n => !isNaN(n));
      _ocCounter  = valid.length ? Math.max(...valid) + 1 : 1;
      if (document.getElementById('panel-oncall')?.classList.contains('active')) _renderOcView();
    }, err => console.error('OnCall listener:', err));
  } catch(e) { console.error(e); }
}

function startOnCallSchedListener() {
  try {
    const from = new Date(); from.setDate(1); from.setMonth(from.getMonth()-1);
    const fromStr = from.toISOString().slice(0,10);
    db.collection('onCallSchedule').where('date','>=',fromStr).onSnapshot(snap => {
      onCallSched = {};
      snap.docs.forEach(d => { onCallSched[d.id] = d.data(); });
      if (document.getElementById('panel-oncall')?.classList.contains('active') && _ocSection==='calendar') _renderOcCalendar();
      _renderStaffOnCallCal();
    }, err => console.error('OnCallSched listener:', err));
  } catch(e) { console.error(e); }
}

// ── Panel entry point ────────────────────────
function renderOnCallPanel() {
  _setOcSite(_ocSite, null, true);
}

// ── Site selector ────────────────────────────
function setOcSite(site, btn) { _setOcSite(site, btn, false); }

function _setOcSite(site, btn, force) {
  _ocSite = site;
  OC_SITES.forEach(s => {
    const b = document.getElementById('oc-site-' + s.toLowerCase());
    if (b) b.classList.toggle('active', s === site);
  });
  _renderOcStats();
  _renderOcTodayBanner();
  _goOcSection(_ocSection, true);
}

// ── Section navigation ───────────────────────
function goOcSection(sec) { _goOcSection(sec, false); }

function _goOcSection(sec, force) {
  _ocSection = sec;
  ['log','history','calendar'].forEach(s => {
    const el  = document.getElementById('oc-sec-' + s);
    const btn = document.getElementById('oc-tab-' + s);
    if (el)  el.style.display = s === sec ? '' : 'none';
    if (btn) btn.classList.toggle('active', s === sec);
  });
  if (sec === 'log')      _renderOcOpenList();
  if (sec === 'history')  _renderOcHistory();
  if (sec === 'calendar') _renderOcCalendar();
}

// ── Stats bar ────────────────────────────────
function _renderOcStats() {
  const el = document.getElementById('oc-stats');
  if (!el) return;
  const site  = _ocSite;
  const mine  = onCallLog.filter(e => e.site === site);
  const open  = mine.filter(e => !e.resolved);
  const now   = Date.now();
  const week  = mine.filter(e => e.ts >= now - 7*86400000);
  const month = mine.filter(e => e.ts >= now - 30*86400000);
  el.innerHTML = `
    <div class="stat-card"><div class="stat-num">${mine.length}</div><div class="stat-label">Total</div></div>
    <div class="stat-card"><div class="stat-num" style="color:${open.length?'#e53e3e':'#4caf50'}">${open.length}</div><div class="stat-label">Open</div></div>
    <div class="stat-card"><div class="stat-num">${week.length}</div><div class="stat-label">This Week</div></div>
    <div class="stat-card"><div class="stat-num">${month.length}</div><div class="stat-label">This Month</div></div>`;
}

// ── Today's on-call banner ───────────────────
function _renderOcTodayBanner() {
  const el = document.getElementById('oc-today-banner');
  if (!el) return;
  const today = new Date().toISOString().slice(0,10);
  const sched = Object.values(onCallSched).find(s => s.date === today && s.site === _ocSite);
  if (sched) {
    el.style.display = 'flex';
    el.innerHTML = `
      <span style="font-size:20px;">📞</span>
      <div>
        <div style="font-size:9px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-weight:700;letter-spacing:2px;text-transform:uppercase;">On Call Today — ${_ocSite}</div>
        <div style="font-size:15px;font-weight:700;color:#f0ead8;font-family:'IBM Plex Mono',monospace;">${sched.staffName}</div>
      </div>`;
  } else {
    el.style.display = 'none';
  }
}

// ── Log form: set datetime to now ───────────
function ocSetNow() {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  document.getElementById('oc-called-at').value =
    `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ── Submit new OC log entry ──────────────────
async function submitOnCallEvent() {
  const who      = (document.getElementById('oc-who')?.value||'').trim();
  const calledBy = (document.getElementById('oc-called-by')?.value||'').trim();
  const reason   = document.getElementById('oc-reason')?.value||'';
  const desc     = (document.getElementById('oc-desc')?.value||'').trim();
  const actions  = (document.getElementById('oc-actions')?.value||'').trim();
  const equipment= (document.getElementById('oc-equipment')?.value||'').trim();
  const urgent   = document.getElementById('oc-urgent')?.checked||false;
  const calledAt = document.getElementById('oc-called-at')?.value
    ? new Date(document.getElementById('oc-called-at').value).getTime() : Date.now();

  if (!who)    { alert('Who was on call is required.'); return; }
  if (!reason) { alert('Please select a reason.'); return; }

  const btn = document.getElementById('oc-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Logging...'; }

  const ocNum = 'OC-' + String(_ocCounter).padStart(3,'0');
  try {
    await db.collection('onCallLog').add({
      ocNum, who, calledBy, reason, description: desc,
      actions, equipment, site: _ocSite,
      urgent, calledAt, resolved: false,
      resolvedAt: null, resolution: '', ts: Date.now()
    });
    ['oc-who','oc-called-by','oc-desc','oc-actions','oc-equipment','oc-called-at'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('oc-urgent')) document.getElementById('oc-urgent').checked = false;
    const res = document.getElementById('oc-submit-result');
    if (res) { res.style.display='block'; setTimeout(()=>{ res.style.display='none'; },2500); }
  } catch(e) { alert('Error: ' + e.message); }
  if (btn) { btn.disabled=false; btn.textContent='+ Log On-Call Event'; }
}

// ── Open events list ─────────────────────────
function _renderOcOpenList() {
  const el = document.getElementById('oc-open-list');
  if (!el) return;
  const open = onCallLog.filter(e => !e.resolved && e.site === _ocSite);
  if (!open.length) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:#2a5a2a;font-family:'IBM Plex Mono',monospace;font-size:12px;">✓ No open on-call events for ${_ocSite}</div>`;
    return;
  }
  el.innerHTML = open.map(e => _ocCard(e)).join('');
}

// ── History ──────────────────────────────────
function _renderOcHistory() {
  const el = document.getElementById('oc-history-list');
  if (!el) return;
  let list = onCallLog.filter(e => e.site === _ocSite);
  if (_ocHistFilter === 'open')     list = list.filter(e => !e.resolved);
  if (_ocHistFilter === 'resolved') list = list.filter(e =>  e.resolved);
  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:#3a5a3a;font-family:'IBM Plex Mono',monospace;font-size:12px;">No events for this filter</div>`;
    return;
  }
  el.innerHTML = list.map(e => _ocCard(e)).join('');
}

function _renderOcView() {
  _renderOcStats();
  _renderOcTodayBanner();
  if (_ocSection === 'log')      _renderOcOpenList();
  if (_ocSection === 'history')  _renderOcHistory();
  if (_ocSection === 'calendar') _renderOcCalendar();
}

function ocHistFilter(val, btn) {
  _ocHistFilter = val;
  document.querySelectorAll('#oc-hist-filter-bar .pill').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _renderOcHistory();
}

// ── OC Card (WO-style) ───────────────────────
function _ocCard(e) {
  const safeId    = (e._fbId||'').replace(/['"]/g,'');
  const calledAt  = e.calledAt  ? new Date(e.calledAt).toLocaleString()  : '—';
  const resolvedAt= e.resolvedAt? new Date(e.resolvedAt).toLocaleString(): null;
  const duration  = (e.calledAt && e.resolvedAt) ? _ocDuration(e.calledAt, e.resolvedAt) : null;
  return `
  <div style="background:#0d180d;border:1px solid ${e.resolved?'#1e3a1e':'#4a1a0a'};border-left:4px solid ${e.resolved?'#4caf50':'#e53e3e'};border-radius:12px;padding:16px;margin-bottom:12px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#4a6a4a;background:#0a140a;border:1px solid #1e3a1e;border-radius:4px;padding:2px 8px;">${e.ocNum||'OC-?'}</span>
        ${e.urgent?'<span style="background:#3a0a0a;border:1px solid #e53e3e;border-radius:4px;padding:1px 7px;font-size:9px;color:#e53e3e;font-family:\'IBM Plex Mono\',monospace;font-weight:700;">🚨 URGENT</span>':''}
        <span style="background:${e.resolved?'#0a2a0a':'#2a0a0a'};border:1px solid ${e.resolved?'#2a5a2a':'#5a2a0a'};border-radius:4px;padding:1px 7px;font-size:9px;color:${e.resolved?'#4caf50':'#e53e3e'};font-family:'IBM Plex Mono',monospace;font-weight:700;">${e.resolved?'✓ RESOLVED':'● OPEN'}</span>
      </div>
      ${!e.resolved?`<button onclick="openResolveModal('${safeId}')" style="padding:6px 14px;background:#1a3a1a;border:1px solid #2a7a3a;border-radius:8px;color:#4caf50;font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;flex-shrink:0;">✓ Resolve</button>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-bottom:8px;">
      <div><span style="font-size:9px;color:#4a6a4a;font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;">Who</span><div style="font-size:13px;font-weight:700;color:#f0ead8;font-family:'IBM Plex Mono',monospace;">${e.who||'—'}</div></div>
      <div><span style="font-size:9px;color:#4a6a4a;font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;">Called By</span><div style="font-size:12px;color:#c0d8c0;">${e.calledBy||'—'}</div></div>
      <div><span style="font-size:9px;color:#4a6a4a;font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;">Reason</span><div style="font-size:12px;color:#d69e2e;">${e.reason||'—'}</div></div>
      <div><span style="font-size:9px;color:#4a6a4a;font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;">Site</span><div style="font-size:12px;color:#7aacd9;">📍 ${e.site||'—'}</div></div>
    </div>
    ${e.description?`<div style="background:#0a140a;border-radius:6px;padding:8px 10px;margin-bottom:6px;"><span style="font-size:9px;color:#4a6a4a;font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;display:block;margin-bottom:3px;">What Happened</span><div style="font-size:12px;color:#c0d8c0;">${e.description}</div></div>`:''}
    ${e.actions?`<div style="background:#0a140a;border-radius:6px;padding:8px 10px;margin-bottom:6px;"><span style="font-size:9px;color:#4a6a4a;font-family:'IBM Plex Mono',monospace;font-weight:700;text-transform:uppercase;display:block;margin-bottom:3px;">Actions Taken</span><div style="font-size:12px;color:#c0d8c0;">${e.actions}</div></div>`:''}
    ${e.equipment?`<div style="font-size:11px;color:#7a6a4a;margin-bottom:4px;">🔧 Equipment: ${e.equipment}</div>`:''}
    <div style="font-size:10px;color:#3a5a3a;font-family:'IBM Plex Mono',monospace;margin-top:6px;border-top:1px solid #1a2a1a;padding-top:6px;">
      🕐 Called: ${calledAt}
      ${resolvedAt?` &nbsp;·&nbsp; ✓ Resolved: ${resolvedAt}`:''}
      ${duration?` &nbsp;·&nbsp; ⏱ Duration: ${duration}`:''}
    </div>
    ${e.resolution?`<div style="font-size:11px;color:#4a7a4a;margin-top:5px;font-style:italic;">📝 Resolution: ${e.resolution}</div>`:''}
  </div>`;
}

function _ocDuration(start, end) {
  const ms = end - start, h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// ── Resolve Modal ────────────────────────────
function openResolveModal(id) {
  document.getElementById('oc-resolve-id').value    = id;
  document.getElementById('oc-resolve-notes').value = '';
  document.getElementById('oc-resolve-modal').style.display = 'flex';
}
function closeResolveModal() { document.getElementById('oc-resolve-modal').style.display = 'none'; }

async function saveResolve() {
  const id    = document.getElementById('oc-resolve-id').value;
  const notes = document.getElementById('oc-resolve-notes').value.trim();
  const btn   = document.getElementById('oc-resolve-save-btn');
  btn.disabled=true; btn.textContent='Saving...';
  try {
    await db.collection('onCallLog').doc(id).update({ resolved:true, resolvedAt:Date.now(), resolution:notes });
    closeResolveModal();
  } catch(e) { alert('Error: '+e.message); }
  btn.disabled=false; btn.textContent='Mark Resolved';
}

// ── Calendar ─────────────────────────────────
function _renderOcCalendar() {
  const el = document.getElementById('oc-cal-grid');
  if (!el) return;
  _buildOcCal(el, 'main');
}
function _renderStaffOnCallCal() {
  const el = document.getElementById('staff-oncall-cal-grid');
  if (!el) return;
  _buildOcCal(el, 'staff');
}

function _buildOcCal(el, ctx) {
  if (!_ocCalMonth) {
    const n = new Date();
    _ocCalMonth = n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');
  }
  const [yr,mo] = _ocCalMonth.split('-').map(Number);
  const first   = new Date(yr, mo-1, 1);
  const last    = new Date(yr, mo, 0);
  const startDow= (first.getDay()+6)%7;
  const today   = new Date().toISOString().slice(0,10);
  const site    = ctx==='staff' ? (_ocSite||'Danville') : _ocSite;
  const label   = first.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const active  = (typeof staffList!=='undefined') ? staffList.filter(s=>s.active!==false) : [];

  let html = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
    <button onclick="ocCalPrev('${ctx}')" style="padding:6px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#888;cursor:pointer;">◀</button>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#c0d8c0;min-width:160px;text-align:center;">${label}</span>
    <button onclick="ocCalNext('${ctx}')" style="padding:6px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#888;cursor:pointer;">▶</button>
    <button onclick="ocCalToday('${ctx}')" style="padding:6px 12px;background:#1a3a1a;border:1px solid #2a5a2a;border-radius:6px;color:#7ac57a;font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">Today</button>
    <span style="font-size:11px;color:#4a6a8a;font-family:'IBM Plex Mono',monospace;">📍 ${site}</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px;">
    ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a6a4a;padding:4px 0;font-weight:700;">${d}</div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">
    ${'<div></div>'.repeat(startDow)}`;

  for (let d=1; d<=last.getDate(); d++) {
    const ds    = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const sch   = Object.values(onCallSched).find(s=>s.date===ds && s.site===site);
    const isToday = ds===today;
    const isPast  = ds<today;
    html += `
    <div onclick="openOcDayModal('${ds}','${ctx}')" style="background:${isToday?'#1a3a1a':'#0d180d'};border:1px solid ${isToday?'#4ade80':'#1a3a1a'};border-radius:8px;padding:5px 4px;min-height:62px;cursor:pointer;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:${isToday?'#4ade80':isPast?'#2a4a2a':'#6a9a6a'};margin-bottom:3px;">${d}</div>
      ${sch
        ?`<div style="background:#0a2a0a;border:1px solid #2a5a2a;border-radius:4px;padding:2px 4px;font-size:9px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-weight:700;word-break:break-word;line-height:1.3;">📞 ${sch.staffName}</div>`
        :`<div style="font-size:9px;color:#1a2a1a;font-family:'IBM Plex Mono',monospace;">—</div>`}
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

function ocCalPrev(ctx) {
  const [yr,mo] = _ocCalMonth.split('-').map(Number);
  const d = new Date(yr,mo-2,1);
  _ocCalMonth = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  if (ctx==='main')  _renderOcCalendar();
  if (ctx==='staff') _renderStaffOnCallCal();
}
function ocCalNext(ctx) {
  const [yr,mo] = _ocCalMonth.split('-').map(Number);
  const d = new Date(yr,mo,1);
  _ocCalMonth = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  if (ctx==='main')  _renderOcCalendar();
  if (ctx==='staff') _renderStaffOnCallCal();
}
function ocCalToday(ctx) {
  const n = new Date();
  _ocCalMonth = n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');
  if (ctx==='main')  _renderOcCalendar();
  if (ctx==='staff') _renderStaffOnCallCal();
}

// ── Week helpers ─────────────────────────────
function _weekMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}
function _weekDates(mondayStr) {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(mondayStr + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// ── Week assignment modal ─────────────────────
function openOcDayModal(date, ctx) {
  const site   = ctx === 'staff' ? (_ocSite || 'Danville') : _ocSite;
  const monStr = _weekMonday(date);
  const days   = _weekDates(monStr);
  // Pre-select staff if any day this week is already assigned
  const existing = days.map(ds => Object.values(onCallSched).find(s => s.date === ds && s.site === site)).find(Boolean);
  const active = (typeof staffList !== 'undefined') ? staffList.filter(s => s.active !== false) : [];
  // Build week label: "Apr 21 – Apr 27, 2026 — Danville"
  const monD = new Date(monStr + 'T12:00:00');
  const sunD = new Date(monStr + 'T12:00:00'); sunD.setDate(sunD.getDate() + 6);
  const fmt  = d => d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
  document.getElementById('oc-day-label').textContent =
    `${fmt(monD)} – ${fmt(sunD)}, ${sunD.getFullYear()} — ${site}`;
  document.getElementById('oc-day-date-val').value = monStr;
  document.getElementById('oc-day-ctx').value      = ctx;
  document.getElementById('oc-day-site-val').value = site;
  const sel = document.getElementById('oc-day-staff');
  sel.innerHTML = '<option value="">— No one assigned —</option>' +
    active.map(s => `<option value="${s._fbId}|${s.name.replace(/"/g,'&quot;')}" ${existing && existing.staffId === s._fbId ? 'selected' : ''}>${s.name}</option>`).join('');
  document.getElementById('oc-day-modal').style.display = 'flex';
}
function closeOcDayModal() { document.getElementById('oc-day-modal').style.display = 'none'; }

async function saveOcDay() {
  const monStr  = document.getElementById('oc-day-date-val').value;
  const ctx     = document.getElementById('oc-day-ctx').value;
  const site    = document.getElementById('oc-day-site-val').value;
  const staffVal= document.getElementById('oc-day-staff').value;
  const btn     = document.getElementById('oc-day-save-btn');
  btn.disabled  = true; btn.textContent = 'Saving...';
  try {
    const days  = _weekDates(monStr);
    const batch = db.batch();
    days.forEach(ds => {
      const ref = db.collection('onCallSchedule').doc(ds + '_' + site.toLowerCase());
      if (!staffVal) {
        batch.delete(ref);
      } else {
        const [staffId, staffName] = staffVal.split('|');
        batch.set(ref, {date: ds, site, staffId, staffName, ts: Date.now()});
      }
    });
    await batch.commit();
    closeOcDayModal();
    if (ctx === 'main')  _renderOcCalendar();
    if (ctx === 'staff') _renderStaffOnCallCal();
    _renderOcTodayBanner();
  } catch(e) { alert('Error: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Save Week';
}

// Public wrapper called by maintenance.js goStaffSection
function renderStaffOnCallCalendar() { _renderStaffOnCallCal(); }

// Legacy aliases kept for old HTML if any
function openOnCallDayModal(date,prefix){ openOcDayModal(date,prefix==='staff-oncall-cal'?'staff':'main'); }
function closeOnCallDayModal(){ closeOcDayModal(); }
function saveOnCallDay(){ saveOcDay(); }
