// ═══════════════════════════════════════════
// ON-CALL MODULE
// ═══════════════════════════════════════════
let onCallLog      = [];
let onCallSched    = {}; // { 'YYYY-MM-DD': {staffId, staffName, location} }
let _onCallSection = 'log';
let _onCallCalMonth = '';
let _onCallLogFilter = 'all';  // 'all' | 'open' | 'resolved'
let _onCallLocFilter = 'all';

const ONCALL_REASONS = [
  'Equipment Failure',
  'Animal Health',
  'Safety Issue',
  'Power Outage',
  'Water / Feed Issue',
  'Weather Emergency',
  'After-Hours Work Order',
  'Biosecurity',
  'Other'
];

const ONCALL_LOCATIONS = ['All Locations','Danville','Hegins','Rushtown'];

// ── Firestore listeners ──────────────────────
function startOnCallListener() {
  try {
    db.collection('onCallLog').orderBy('ts','desc').onSnapshot(snap => {
      onCallLog = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
      if (document.getElementById('panel-oncall')?.classList.contains('active')) {
        renderOnCallStats();
        if (_onCallSection === 'log')      renderOnCallLogSection();
        if (_onCallSection === 'history')  renderOnCallHistory();
      }
    }, err => console.error('OnCall listener:', err));
  } catch(e) { console.error(e); }
}

function startOnCallSchedListener() {
  try {
    const now   = new Date();
    const from  = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2,'0') + '-01';
    db.collection('onCallSchedule').where('date','>=',from).onSnapshot(snap => {
      onCallSched = {};
      snap.docs.forEach(d => { onCallSched[d.id] = d.data(); });
      if (document.getElementById('panel-oncall')?.classList.contains('active') && _onCallSection === 'calendar') renderOnCallCalendar();
      renderStaffOnCallCalendar();
    }, err => console.error('OnCallSched listener:', err));
  } catch(e) { console.error(e); }
}

// ── Panel entry point ────────────────────────
function renderOnCallPanel() {
  renderOnCallStats();
  goOnCallSection(_onCallSection || 'log');
}

function goOnCallSection(sec) {
  _onCallSection = sec;
  ['log','history','calendar'].forEach(s => {
    const el = document.getElementById('oncall-sec-' + s);
    if (el) el.style.display = s === sec ? '' : 'none';
    const btn = document.getElementById('oncall-tab-' + s);
    if (btn) btn.classList.toggle('active', s === sec);
  });
  if (sec === 'log')      renderOnCallLogSection();
  if (sec === 'history')  renderOnCallHistory();
  if (sec === 'calendar') renderOnCallCalendar();
}

// ── Stats ────────────────────────────────────
function renderOnCallStats() {
  const el = document.getElementById('oncall-stats');
  if (!el) return;
  const now   = Date.now();
  const week  = now - 7  * 86400000;
  const month = now - 30 * 86400000;
  const open  = onCallLog.filter(e => !e.resolved).length;
  const wk    = onCallLog.filter(e => e.ts >= week).length;
  const mo    = onCallLog.filter(e => e.ts >= month).length;
  el.innerHTML = `
    <div class="stat-card"><div class="stat-num">${onCallLog.length}</div><div class="stat-label">Total Events</div></div>
    <div class="stat-card"><div class="stat-num" style="color:${open?'#e53e3e':'#4caf50'}">${open}</div><div class="stat-label">Open / Active</div></div>
    <div class="stat-card"><div class="stat-num">${wk}</div><div class="stat-label">This Week</div></div>
    <div class="stat-card"><div class="stat-num">${mo}</div><div class="stat-label">This Month</div></div>`;
}

// ── Log Event Section ────────────────────────
function renderOnCallLogSection() {
  const el = document.getElementById('oncall-log-list');
  if (!el) return;
  const open = onCallLog.filter(e => !e.resolved);
  if (!open.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#4a6a4a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">No open on-call events</div>';
    return;
  }
  el.innerHTML = open.map(e => onCallCard(e)).join('');
}

// ── History Section ──────────────────────────
function renderOnCallHistory() {
  const el = document.getElementById('oncall-history-list');
  if (!el) return;
  let list = [...onCallLog];
  if (_onCallLogFilter === 'open')     list = list.filter(e => !e.resolved);
  if (_onCallLogFilter === 'resolved') list = list.filter(e => !!e.resolved);
  if (_onCallLocFilter !== 'all')      list = list.filter(e => e.location === _onCallLocFilter);
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#4a6a4a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">No events match this filter</div>';
    return;
  }
  el.innerHTML = list.map(e => onCallCard(e)).join('');
}

function onCallHistoryFilter(type, val, btn) {
  if (type === 'status') _onCallLogFilter = val;
  if (type === 'loc')    _onCallLocFilter = val;
  document.querySelectorAll('#oncall-' + type + '-bar .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderOnCallHistory();
}

// ── Event Card ───────────────────────────────
function onCallCard(e) {
  const calledAt  = e.calledAt  ? new Date(e.calledAt).toLocaleString()  : '—';
  const resolvedAt= e.resolvedAt? new Date(e.resolvedAt).toLocaleString(): null;
  const duration  = (e.calledAt && e.resolvedAt)
    ? _onCallDuration(e.calledAt, e.resolvedAt) : null;
  const safeId = (e._fbId||'').replace(/['"]/g,'');
  return `
  <div style="background:#0f1a0f;border:1px solid ${e.resolved?'#2a5a2a':'#5a2a0a'};border-left:4px solid ${e.resolved?'#4caf50':'#e53e3e'};border-radius:12px;padding:14px 16px;margin-bottom:12px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:#f0ead8;">${e.who||'Unknown'}</span>
          ${e.urgent ? '<span style="background:#5a0a0a;border:1px solid #e53e3e;border-radius:4px;padding:1px 6px;font-size:9px;color:#e53e3e;font-family:\'IBM Plex Mono\',monospace;font-weight:700;">🚨 URGENT</span>' : ''}
          <span style="background:${e.resolved?'#0a2a0a':'#2a0a0a'};border:1px solid ${e.resolved?'#2a5a2a':'#5a2a0a'};border-radius:4px;padding:1px 6px;font-size:9px;color:${e.resolved?'#4caf50':'#e53e3e'};font-family:'IBM Plex Mono',monospace;font-weight:700;">${e.resolved?'✓ RESOLVED':'● OPEN'}</span>
          ${e.location ? `<span style="font-size:10px;color:#4a6a8a;">📍 ${e.location}</span>` : ''}
        </div>
        <div style="font-size:12px;color:#c0d8c0;margin-bottom:4px;"><strong style="color:#d69e2e;">Reason:</strong> ${e.reason||'—'}</div>
        ${e.description ? `<div style="font-size:12px;color:#9ab09a;margin-bottom:4px;"><strong style="color:#7a9a7a;">What:</strong> ${e.description}</div>` : ''}
        ${e.calledBy ? `<div style="font-size:11px;color:#5a7a5a;">Called by: ${e.calledBy}</div>` : ''}
        <div style="font-size:10px;color:#3a5a3a;margin-top:6px;font-family:'IBM Plex Mono',monospace;">
          🕐 Called: ${calledAt}
          ${resolvedAt ? ` &nbsp;·&nbsp; ✓ Resolved: ${resolvedAt}` : ''}
          ${duration ? ` &nbsp;·&nbsp; ⏱ ${duration}` : ''}
        </div>
        ${e.resolution ? `<div style="font-size:11px;color:#4a7a4a;margin-top:4px;font-style:italic;">Resolution: ${e.resolution}</div>` : ''}
      </div>
      ${!e.resolved ? `<button onclick="openResolveModal('${safeId}')" style="padding:7px 14px;background:#1a3a1a;border:1px solid #2a7a3a;border-radius:8px;color:#4caf50;font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;flex-shrink:0;">✓ Resolve</button>` : ''}
    </div>
  </div>`;
}

function _onCallDuration(start, end) {
  const ms  = end - start;
  const h   = Math.floor(ms / 3600000);
  const m   = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// ── Submit New Event ─────────────────────────
async function submitOnCallEvent() {
  const who      = document.getElementById('oc-who').value.trim();
  const calledBy = document.getElementById('oc-called-by').value.trim();
  const reason   = document.getElementById('oc-reason').value;
  const desc     = document.getElementById('oc-desc').value.trim();
  const location = document.getElementById('oc-location').value;
  const urgent   = document.getElementById('oc-urgent').checked;
  const calledAt = new Date(document.getElementById('oc-called-at').value).getTime() || Date.now();

  if (!who)    { alert('Who was on call is required.'); return; }
  if (!reason) { alert('Reason is required.'); return; }

  const btn = document.getElementById('oc-submit-btn');
  btn.disabled = true; btn.textContent = 'Logging...';
  try {
    await db.collection('onCallLog').add({
      who, calledBy, reason, description: desc,
      location, urgent, calledAt, resolved: false,
      resolvedAt: null, resolution: '', ts: Date.now()
    });
    document.getElementById('oc-who').value       = '';
    document.getElementById('oc-called-by').value = '';
    document.getElementById('oc-desc').value      = '';
    document.getElementById('oc-called-at').value = '';
    document.getElementById('oc-urgent').checked  = false;
    document.getElementById('oc-reason').value    = '';
    const res = document.getElementById('oc-submit-result');
    res.style.display = 'block';
    setTimeout(() => { res.style.display = 'none'; }, 2500);
  } catch(e) { alert('Error: ' + e.message); }
  btn.disabled = false; btn.textContent = '+ Log On-Call Event';
}

// ── Resolve Modal ────────────────────────────
function openResolveModal(id) {
  document.getElementById('oc-resolve-id').value    = id;
  document.getElementById('oc-resolve-notes').value = '';
  document.getElementById('oc-resolve-modal').style.display = 'flex';
}

function closeResolveModal() {
  document.getElementById('oc-resolve-modal').style.display = 'none';
}

async function saveResolve() {
  const id    = document.getElementById('oc-resolve-id').value;
  const notes = document.getElementById('oc-resolve-notes').value.trim();
  const btn   = document.getElementById('oc-resolve-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await db.collection('onCallLog').doc(id).update({
      resolved: true, resolvedAt: Date.now(), resolution: notes
    });
    closeResolveModal();
  } catch(e) { alert('Error: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Mark Resolved';
}

// ── On-Call Calendar ─────────────────────────
function renderOnCallCalendar() {
  const el = document.getElementById('oncall-cal-grid');
  if (!el) return;
  _buildCalGrid(el, 'oncall-cal');
}

function renderStaffOnCallCalendar() {
  const el = document.getElementById('staff-oncall-cal-grid');
  if (!el) return;
  _buildCalGrid(el, 'staff-oncall-cal');
}

function _buildCalGrid(el, prefix) {
  if (!_onCallCalMonth) {
    const now = new Date();
    _onCallCalMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
  const [yr, mo] = _onCallCalMonth.split('-').map(Number);
  const firstDay  = new Date(yr, mo-1, 1);
  const lastDay   = new Date(yr, mo, 0);
  const startDow  = (firstDay.getDay() + 6) % 7; // Monday=0
  const today     = new Date().toISOString().slice(0,10);

  const monthLabel = firstDay.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const activeStaff= (typeof staffList !== 'undefined') ? staffList.filter(s => s.active !== false) : [];
  const staffOpts  = activeStaff.map(s => `<option value="${s._fbId}|${s.name.replace(/"/g,'&quot;')}">${s.name}</option>`).join('');

  let html = `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
    <button onclick="onCallCalPrev('${prefix}')" style="padding:6px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#888;cursor:pointer;">◀</button>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#c0d8c0;min-width:160px;text-align:center;">${monthLabel}</span>
    <button onclick="onCallCalNext('${prefix}')" style="padding:6px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#888;cursor:pointer;">▶</button>
    <button onclick="onCallCalToday('${prefix}')" style="padding:6px 12px;background:#1a3a1a;border:1px solid #2a5a2a;border-radius:6px;color:#7ac57a;font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">Today</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px;">`;

  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => {
    html += `<div style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a6a4a;padding:4px 0;font-weight:700;">${d}</div>`;
  });
  html += '</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">';

  for (let i = 0; i < startDow; i++) html += '<div></div>';

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr  = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const sched    = onCallSched[dateStr];
    const isToday  = dateStr === today;
    const isPast   = dateStr < today;
    html += `
    <div style="background:${isToday?'#1a3a1a':'#0f1a0f'};border:1px solid ${isToday?'#4ade80':'#1e3a1e'};border-radius:8px;padding:6px 4px;min-height:64px;cursor:pointer;position:relative;" onclick="openOnCallDayModal('${dateStr}','${prefix}')">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:${isToday?'#4ade80':isPast?'#3a5a3a':'#7ab07a'};margin-bottom:4px;">${d}</div>
      ${sched
        ? `<div style="background:#1a3a2a;border:1px solid #2a5a3a;border-radius:4px;padding:2px 4px;font-size:9px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-weight:700;word-break:break-word;">📞 ${sched.staffName}</div>`
        : `<div style="font-size:9px;color:#2a3a2a;font-family:'IBM Plex Mono',monospace;">—</div>`}
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

function onCallCalPrev(prefix) {
  const [yr, mo] = _onCallCalMonth.split('-').map(Number);
  const d = new Date(yr, mo-2, 1);
  _onCallCalMonth = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  _refreshCal(prefix);
}

function onCallCalNext(prefix) {
  const [yr, mo] = _onCallCalMonth.split('-').map(Number);
  const d = new Date(yr, mo, 1);
  _onCallCalMonth = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  _refreshCal(prefix);
}

function onCallCalToday(prefix) {
  const now = new Date();
  _onCallCalMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  _refreshCal(prefix);
}

function _refreshCal(prefix) {
  if (prefix === 'oncall-cal')       renderOnCallCalendar();
  if (prefix === 'staff-oncall-cal') renderStaffOnCallCalendar();
}

// ── Day Assignment Modal ─────────────────────
function openOnCallDayModal(date, prefix) {
  document.getElementById('oc-day-date').textContent  = new Date(date + 'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.getElementById('oc-day-date-val').value    = date;
  document.getElementById('oc-day-prefix').value      = prefix;
  const sched = onCallSched[date];
  const sel   = document.getElementById('oc-day-staff');
  const active= (typeof staffList !== 'undefined') ? staffList.filter(s => s.active !== false) : [];
  sel.innerHTML = '<option value="">— No one assigned —</option>' +
    active.map(s => `<option value="${s._fbId}|${s.name.replace(/"/g,'&quot;')}" ${sched && sched.staffId===s._fbId?'selected':''}>${s.name}</option>`).join('');
  document.getElementById('oc-day-loc').value = sched?.location || '';
  document.getElementById('oc-day-modal').style.display = 'flex';
}

function closeOnCallDayModal() {
  document.getElementById('oc-day-modal').style.display = 'none';
}

async function saveOnCallDay() {
  const date   = document.getElementById('oc-day-date-val').value;
  const prefix = document.getElementById('oc-day-prefix').value;
  const staffVal = document.getElementById('oc-day-staff').value;
  const loc    = document.getElementById('oc-day-loc').value;
  const btn    = document.getElementById('oc-day-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    if (!staffVal) {
      await db.collection('onCallSchedule').doc(date).delete();
    } else {
      const [staffId, staffName] = staffVal.split('|');
      await db.collection('onCallSchedule').doc(date).set({
        date, staffId, staffName, location: loc, ts: Date.now()
      });
    }
    closeOnCallDayModal();
    _refreshCal(prefix);
  } catch(e) { alert('Error: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Save';
}
