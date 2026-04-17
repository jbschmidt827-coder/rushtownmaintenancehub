// TEAM SCHEDULE
// ═══════════════════════════════════════════
function getSchedDepts() {
  const houseCount = _schedFacility === 'Hegins' ? 8 : 5;
  const barns = Array.from({length: houseCount}, (_, i) => ({
    key:   `house_${i+1}`,
    label: `House ${i+1}`,
    icon:  '🏠',
    color: '#4a9b6f',
  }));
  return [
    ...barns,
    { key:'maint_manure',   label:'Manure Tech',    icon:'🔧', color:'#f0a500' },
    { key:'maint_prodflow', label:'Prod Flow Tech', icon:'⚙️', color:'#d69e2e' },
    { key:'pkg',   label:'Packaging',  icon:'📦', color:'#3b82f6' },
    { key:'feed',  label:'Feed Mill',  icon:'🌾', color:'#a0522d' },
    { key:'ship',  label:'Shipping',   icon:'🚚', color:'#dc2626' },
  ];
}
const SCHED_DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
const SCHED_DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const SHIFT_COLOR = { morning:'morning', afternoon:'afternoon', night:'night' };

let _schedWeekOf  = '';
let _schedFacility = 'Danville';
let _schedDept    = 'prod';
let _schedData    = [];
let _schedEditId  = null;
let _schedModalDept = '';
let _schedModalDay  = '';

function schedGetMonday(d) {
  const dt = d ? new Date(d + 'T12:00:00') : new Date();
  const day = dt.getDay(); // 0=Sun
  const diff = (day === 0) ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().slice(0,10);
}

function schedWeekLabel() {
  if (!_schedWeekOf) return '';
  const mon = new Date(_schedWeekOf + 'T12:00:00');
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m1 = mo[mon.getMonth()], d1 = mon.getDate();
  const m2 = mo[sun.getMonth()], d2 = sun.getDate();
  const yr = sun.getFullYear();
  return m1 === m2 ? `${m1} ${d1} – ${d2}, ${yr}` : `${m1} ${d1} – ${m2} ${d2}, ${yr}`;
}

function setSchedFacility(fac, btn) {
  _schedFacility = fac;
  document.querySelectorAll('.sched-fac-bar .loc-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Reset to prod when switching facility (house counts differ)
  _schedDept = 'prod';
  document.querySelectorAll('.sched-dept-bar .sub-btn').forEach(b => b.classList.remove('active'));
  const prodBtn = document.getElementById('sdept-prod');
  if (prodBtn) prodBtn.classList.add('active');
  loadSchedule();
}

function setSchedDept(dept, btn) {
  _schedDept = dept;
  document.querySelectorAll('.sched-dept-bar .sub-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSchedule();
}

function prevSchedWeek() {
  const d = new Date(_schedWeekOf + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  _schedWeekOf = d.toISOString().slice(0,10);
  loadSchedule();
}
function nextSchedWeek() {
  const d = new Date(_schedWeekOf + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  _schedWeekOf = d.toISOString().slice(0,10);
  loadSchedule();
}

async function loadSchedule() {
  if (!_schedWeekOf) _schedWeekOf = schedGetMonday();
  document.getElementById('sched-week-label').textContent = 'Week of ' + schedWeekLabel();
  _schedData = [];
  try {
    const snap = await db.collection('teamSchedule').where('weekOf','==',_schedWeekOf).where('facility','==',_schedFacility).get();
    snap.forEach(doc => _schedData.push({ _id: doc.id, ...doc.data() }));
  } catch(e) { console.error('Schedule load error:', e); }
  renderSchedule();
}

function renderSchedule() {
  const allRows = getSchedDepts();

  // KPI: based on all data for this facility/week
  const total = _schedData.length;
  const allDeptDays = allRows.length * 7;
  const covered = new Set(_schedData.map(r => r.dept + '_' + r.day)).size;
  const gaps = allDeptDays - covered;
  const covPct = allDeptDays > 0 ? Math.round((covered / allDeptDays) * 100) : 0;
  const people = new Set(_schedData.map(r => r.person)).size;

  document.getElementById('sched-kpi-assign-num').textContent = total;
  const covEl = document.getElementById('sched-kpi-cov-num');
  covEl.textContent = covPct + '%';
  const covCell = document.getElementById('sched-kpi-cov');
  covCell.style.borderTopColor = covPct >= 90 ? '#4a9b6f' : covPct >= 70 ? '#f0a500' : '#dc2626';
  document.getElementById('sched-kpi-gaps-num').textContent = gaps;
  document.getElementById('sched-kpi-people-num').textContent = people;

  // Filter rows to active dept
  const deptRowMap = {
    prod:  allRows.filter(r => r.key.startsWith('house_')),
    maint: allRows.filter(r => r.key.startsWith('maint_')),
    pkg:   allRows.filter(r => r.key === 'pkg'),
    feed:  allRows.filter(r => r.key === 'feed'),
    ship:  allRows.filter(r => r.key === 'ship'),
  };
  const rows = deptRowMap[_schedDept] || allRows;

  // Grid body
  const tbody = document.getElementById('sched-tbody');
  let html = '';

  rows.forEach(dept => {
    html += `<tr>`;
    html += `<td class="sched-dept-cell" style="border-left:3px solid ${dept.color};">
               <span class="sched-dept-icon">${dept.icon}</span>${dept.label}
             </td>`;
    SCHED_DAYS.forEach(day => {
      const entries = _schedData.filter(r => r.dept === dept.key && r.day === day);
      html += `<td>`;
      entries.forEach(e => {
        const sc = SHIFT_COLOR[e.shift] || 'morning';
        const tip = e.role ? `${e.person} · ${e.role}` : e.person;
        html += `<span class="sched-chip ${sc}" onclick="openSchedModal('${dept.key}','${day}','${e._id}')" title="${tip}">${e.person}</span>`;
      });
      html += `<button class="sched-add-btn" onclick="openSchedModal('${dept.key}','${day}',null)">+</button>`;
      html += `</td>`;
    });
    html += `</tr>`;
  });

  // EE locked row only when on prod or all
  if (_schedDept === 'prod') {
    html += `<tr class="sched-ee-row">
      <td class="sched-dept-cell" style="border-left:3px solid #444;color:#555;"><span class="sched-dept-icon">⚡</span>EE</td>
      <td colspan="7" style="text-align:center;padding:12px 8px;">⚡ EE — Coming Soon</td>
    </tr>`;
  }

  tbody.innerHTML = html;
  applyFormTextTranslation();
}

function openSchedModal(dept, day, entryId) {
  _schedModalDept = dept;
  _schedModalDay  = day;
  _schedEditId    = entryId;

  const deptObj = getSchedDepts().find(d => d.key === dept) || {};
  const dayLabel = SCHED_DAY_LABELS[SCHED_DAYS.indexOf(day)] || day.toUpperCase();
  document.getElementById('sched-modal-title').textContent =
    `${deptObj.icon || ''} ${deptObj.label || dept} — ${dayLabel} · ${_schedFacility}`;

  if (entryId) {
    const entry = _schedData.find(r => r._id === entryId) || {};
    document.getElementById('sched-person').value = entry.person || '';
    document.getElementById('sched-shift').value  = entry.shift  || 'morning';
    document.getElementById('sched-notes').value  = entry.notes  || '';
    document.getElementById('sched-del-btn').style.display = '';
  } else {
    document.getElementById('sched-person').value = '';
    document.getElementById('sched-shift').value  = 'morning';
    document.getElementById('sched-notes').value  = '';
    document.getElementById('sched-del-btn').style.display = 'none';
  }

  document.getElementById('sched-modal-bg').style.display = 'block';
  document.getElementById('sched-person').focus();
  applyFormTextTranslation();
}

function closeSchedModal() {
  document.getElementById('sched-modal-bg').style.display = 'none';
}

async function saveSchedEntry() {
  const person = document.getElementById('sched-person').value.trim();
  if (!person) { alert('Person name is required.'); return; }
  const record = {
    weekOf:   _schedWeekOf,
    facility: _schedFacility,
    dept:     _schedModalDept,
    day:      _schedModalDay,
    person,
    role:   '',
    shift:  document.getElementById('sched-shift').value,
    notes:  document.getElementById('sched-notes').value.trim(),
    ts:     Date.now()
  };
  try {
    if (_schedEditId) {
      await db.collection('teamSchedule').doc(_schedEditId).update(record);
      const idx = _schedData.findIndex(r => r._id === _schedEditId);
      if (idx > -1) _schedData[idx] = { _id: _schedEditId, ...record };
    } else {
      const ref = await db.collection('teamSchedule').add(record);
      _schedData.push({ _id: ref.id, ...record });
    }
    closeSchedModal();
    renderSchedule();
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'SCHED',
        desc: (_schedEditId ? 'Schedule updated: ' : 'Schedule assigned: ') + person + ' — ' + _schedFacility + ' ' + _schedModalDept + ' (' + _schedModalDay + ', wk ' + _schedWeekOf + ')',
        tech: person, date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}), ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
  } catch(e) {
    console.error('Schedule save error:', e);
    alert('Error saving: ' + e.message);
  }
}

async function deleteSchedEntry() {
  if (!_schedEditId) return;
  if (!confirm('Remove this assignment?')) return;
  try {
    await db.collection('teamSchedule').doc(_schedEditId).delete();
    _schedData = _schedData.filter(r => r._id !== _schedEditId);
    closeSchedModal();
    renderSchedule();
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'SCHED',
        desc: 'Schedule entry removed — ' + _schedFacility + ' ' + _schedModalDept + ' (' + _schedModalDay + ', wk ' + _schedWeekOf + ')',
        tech: 'System', date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}), ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
  } catch(e) {
    console.error('Schedule delete error:', e);
    alert('Error deleting: ' + e.message);
  }
}

async function copyLastWeek() {
  if (!_schedWeekOf) return;
  const prevMon = new Date(_schedWeekOf + 'T12:00:00');
  prevMon.setDate(prevMon.getDate() - 7);
  const prevWeekOf = prevMon.toISOString().slice(0,10);
  try {
    const snap = await db.collection('teamSchedule').where('weekOf','==',prevWeekOf).where('facility','==',_schedFacility).get();
    if (snap.empty) { alert('No schedule found for last week.'); return; }
    const batch = db.batch();
    snap.forEach(doc => {
      const d = doc.data();
      const newRef = db.collection('teamSchedule').doc();
      batch.set(newRef, { ...d, weekOf: _schedWeekOf, ts: Date.now() });
    });
    await batch.commit();
    await loadSchedule();
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'SCHED',
        desc: 'Schedule copied from wk ' + prevWeekOf + ' → wk ' + _schedWeekOf + ' (' + _schedFacility + ')',
        tech: 'System', date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}), ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
  } catch(e) {
    console.error('Copy last week error:', e);
    alert('Error copying: ' + e.message);
  }
}

// BOOT
// ═══════════════════════════════════════════
initApp().then(() => {
  applyTranslations();
  startLandingClock();
  if (typeof injectLandingStaffCard === 'function') injectLandingStaffCard();
  _initBuildDate();
  _initSwUpdateListener();
});

// ── Show build date in landing footer ───────────────────────────
function _initBuildDate() {
  var el = document.getElementById('ls-build-date');
  if (!el) return;
  // The build date is baked in at deploy time via the cache version name
  // For live tracking we show today's cached-asset date
  var d = new Date();
  el.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

// ── Service-worker update notification ──────────────────────────
function _initSwUpdateListener() {
  if (!('serviceWorker' in navigator)) return;

  // Listen for SW postMessage telling us a new version activated
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SW_UPDATED') {
      _showUpdateBanner();
    }
  });

  // Also detect when a new SW is waiting (e.g. first install in another tab)
  navigator.serviceWorker.ready.then(function(reg) {
    if (reg.waiting) _showUpdateBanner();
    reg.addEventListener('updatefound', function() {
      var newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', function() {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          _showUpdateBanner();
        }
      });
    });
  });
}

function _showUpdateBanner() {
  var banner = document.getElementById('sw-update-banner');
  if (!banner) return;
  banner.style.display = 'flex';
  banner.onclick = function() {
    banner.innerHTML = '⏳ Refreshing...';
    // Tell the waiting SW to take over, then reload
    navigator.serviceWorker.ready.then(function(reg) {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    setTimeout(function() { location.reload(true); }, 400);
  };
}

