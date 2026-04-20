// ═══════════════════════════════════════════
// STAFF MODULE
// ═══════════════════════════════════════════
let staffList = [];
let _staffFilter = 'active';
let _staffFarmFilter = 'all';

const STAFF_ROLES = ['Technician','Lead','WNO','Barn Worker','Director','Driver','Feed Mill','Other'];
const MAINTENANCE_ROLES = ['Technician','Lead','Director','Driver'];
const BARN_ROLES        = ['WNO','Barn Worker','Other'];

// ── Firestore listener ──────────────────────
function startStaffListener() {
  try {
    db.collection('staff').orderBy('name','asc').onSnapshot(snap => {
      staffList = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
      renderStaff();
      updateStaffDropdowns();
    });
  } catch(e) { console.error('Staff listener error:', e); }
}

// ── Fallback team list used until staff are added via the Staff panel ──
const FALLBACK_TEAM = [
  'Josh','Steve','Mike','Chris','Dave','Dan','Tom','Joe','Kyle','Brian',
  'Ryan','Tyler','Jake','Zach','Derek','Adam','Kevin','Scott','Eric','Matt'
];

// ── Populate all name datalists and selects in the app ──
function updateStaffDropdowns() {
  const active = staffList.filter(s => s.active !== false);
  // If Firestore staff collection is empty, use the fallback list
  const names = active.length
    ? active.map(s => s.name)
    : FALLBACK_TEAM;

  // Datalist for text inputs with list="staff-datalist"
  const datalistOpts = names.map(n => `<option value="${n.replace(/"/g,'&quot;')}">`).join('');
  document.querySelectorAll('datalist#staff-datalist').forEach(dl => dl.innerHTML = datalistOpts);

  // Select dropdowns — all get the same active staff list
  const selectOpts = '<option value="">— Select —</option>' +
    names.map(n => `<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');

  const selectIds = [
    'bulk-tech',        // Bulk PM Catch-Up: Completed By
    'wo-assign',        // WO form: Assign To
    'closeout-tech',    // WO Closeout modal: Completed By
    'modal-tech',       // PM complete modal: Completed By
    'wo-completed-by',  // legacy alias
  ];

  selectIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.tagName !== 'SELECT') return;
    const cur = el.value;
    el.innerHTML = id === 'wo-assign'
      ? '<option value="">— Unassigned —</option>' + names.map(n => `<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('')
      : selectOpts;
    if (cur) el.value = cur;
  });
}

// ── Render Staff Panel ──────────────────────
function renderStaff() {
  const el = document.getElementById('staff-list');
  if (!el) return;

  let list = staffList;
  if (_staffFarmFilter !== 'all')   list = list.filter(s => s.farm === _staffFarmFilter || s.farm === 'Both' || s.farm === 'All');
  if (_staffFilter === 'active')    list = list.filter(s => s.active !== false);
  if (_staffFilter === 'inactive')  list = list.filter(s => s.active === false);

  // Stats
  const total   = staffList.filter(s => s.active !== false).length;
  const hegins  = staffList.filter(s => s.active !== false && (s.farm === 'Hegins' || s.farm === 'Both' || s.farm === 'All')).length;
  const danville= staffList.filter(s => s.active !== false && (s.farm === 'Danville' || s.farm === 'Both' || s.farm === 'All')).length;

  const stats = document.getElementById('staff-stats');
  if (stats) stats.innerHTML = `
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Active Staff</div></div>
    <div class="stat-card"><div class="stat-num">${hegins}</div><div class="stat-label">Hegins</div></div>
    <div class="stat-card"><div class="stat-num">${danville}</div><div class="stat-label">Danville</div></div>`;

  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="ei">👥</div><p>${_staffFilter === 'inactive' ? 'No inactive staff' : 'No staff added yet — use the form above'}</p></div>`;
    return;
  }

  // Group by role
  const byRole = {};
  list.forEach(s => { const r = s.role || 'Other'; (byRole[r] = byRole[r]||[]).push(s); });
  const roleOrder = STAFF_ROLES;

  let html = '';
  roleOrder.forEach(role => {
    const people = byRole[role];
    if (!people || !people.length) return;
    html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#5a8a5a;text-transform:uppercase;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #1e3a1e;">${role}</div>`;
    people.forEach(s => {
      const inactive = s.active === false;
      html += `<div style="background:${inactive?'#0a0a0a':'#0f1a0f'};border:1px solid ${inactive?'#2a2a2a':'#1e3a1e'};border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;border-radius:50%;background:${inactive?'#1a1a1a':'#1a3a2a'};border:2px solid ${inactive?'#2a2a2a':'#2a5a2a'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${staffInitials(s.name)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:${inactive?'#4a4a4a':'#f0ead8'};${inactive?'text-decoration:line-through;':''}">${s.name}</div>
          <div style="font-size:11px;color:#4a6a4a;margin-top:2px;">${s.farm||''}${s.phone?' · 📞 '+s.phone:''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="toggleStaff('${s._fbId}',${!inactive})" style="padding:5px 10px;background:${inactive?'#1a3a1a':'#1a1a1a'};border:1px solid ${inactive?'#2a5a2a':'#2a2a2a'};border-radius:6px;color:${inactive?'#4caf50':'#666'};font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${inactive?'Activate':'Deactivate'}</button>
          <button onclick="editStaffOpen('${s._fbId}')" style="padding:5px 10px;background:#1a2a3a;border:1px solid #1e3a5a;border-radius:6px;color:#4a90d9;font-size:11px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">Edit</button>
          <button onclick="deleteStaff('${s._fbId}','${s.name.replace(/'/g,"\\'")}')" style="padding:5px 8px;background:#1a0a0a;border:1px solid #3a1a1a;border-radius:6px;color:#666;font-size:11px;cursor:pointer;">✕</button>
        </div>
      </div>`;
    });
  });

  // Any roles not in roleOrder
  Object.keys(byRole).filter(r => !roleOrder.includes(r)).forEach(role => {
    const people = byRole[role];
    html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#5a8a5a;text-transform:uppercase;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #1e3a1e;">${role}</div>`;
    people.forEach(s => {
      html += staffCardHtml(s);
    });
  });

  el.innerHTML = html;
}

function staffInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}

// ── DB connectivity check shown on Add tab ──
async function checkStaffDbStatus() {
  const el = document.getElementById('staff-db-status');
  if (!el) return;
  try {
    await db.collection('staff').limit(1).get();
    el.style.display = 'none';
  } catch(e) {
    el.style.display = 'block';
    el.style.background = '#2a0a0a';
    el.style.border = '1px solid #5a1a1a';
    el.style.color = '#e53e3e';
    el.textContent = '⚠ Database error: ' + e.message + ' (code: ' + e.code + ')';
  }
}

// ── Add Employee ────────────────────────────
async function addStaff() {
  const fname = document.getElementById('staff-new-fname').value.trim();
  const lname = document.getElementById('staff-new-lname').value.trim();
  const name  = (fname + ' ' + lname).trim();
  const role  = document.getElementById('staff-new-role').value;
  const farm  = document.getElementById('staff-new-farm').value;
  const phone = document.getElementById('staff-new-phone').value.trim();
  if (!fname) { document.getElementById('staff-new-fname').focus(); return; }
  if (!lname) { document.getElementById('staff-new-lname').focus(); return; }

  const btn = document.getElementById('staff-add-btn');
  btn.disabled = true; btn.textContent = 'Saving...';

  const errEl = document.getElementById('staff-add-error');
  if (errEl) errEl.style.display = 'none';

  try {
    const ref = await db.collection('staff').add({ name, role: role||'Technician', farm: farm||'', phone, active: true, ts: Date.now() });
    await createOnboarding(ref.id, name);
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'STAFF',
        desc: 'Staff added: ' + name + ' (' + (role||'Technician') + ')' + (farm ? ' — ' + farm : ''),
        tech: 'System', date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}), ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
    document.getElementById('staff-new-fname').value = '';
    document.getElementById('staff-new-lname').value = '';
    document.getElementById('staff-new-phone').value = '';
    document.getElementById('staff-add-result').style.display = 'block';
    setTimeout(() => { document.getElementById('staff-add-result').style.display = 'none'; }, 2000);
  } catch(e) {
    console.error('addStaff error:', e);
    if (errEl) { errEl.textContent = '⚠ ' + e.message; errEl.style.display = 'block'; }
    else alert('Error: ' + e.message);
  }

  btn.disabled = false; btn.textContent = '+ Add';
}

// ── Toggle Active/Inactive ──────────────────
async function toggleStaff(id, active) {
  try { await db.collection('staff').doc(id).update({ active }); } catch(e) { console.error(e); }
}

// ── Delete Employee ─────────────────────────
async function deleteStaff(id, name) {
  if (!confirm(`Remove ${name} from the staff list?`)) return;
  try {
    await db.collection('staff').doc(id).delete();
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'STAFF',
        desc: 'Staff removed: ' + name,
        tech: 'System', date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}), ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
  } catch(e) { alert('Error: ' + e.message); }
}

// ── Edit Employee ───────────────────────────
function editStaffOpen(id) {
  const s = staffList.find(x => x._fbId === id);
  if (!s) return;
  document.getElementById('edit-staff-id').value    = id;
  document.getElementById('edit-staff-name').value  = s.name || '';
  document.getElementById('edit-staff-role').value  = s.role || 'Technician';
  document.getElementById('edit-staff-farm').value  = s.farm || '';
  document.getElementById('edit-staff-phone').value = s.phone || '';
  document.getElementById('staff-edit-modal').style.display = 'flex';
}

function closeStaffEdit() {
  document.getElementById('staff-edit-modal').style.display = 'none';
}

async function saveStaffEdit() {
  const id    = document.getElementById('edit-staff-id').value;
  const name  = document.getElementById('edit-staff-name').value.trim();
  const role  = document.getElementById('edit-staff-role').value;
  const farm  = document.getElementById('edit-staff-farm').value;
  const phone = document.getElementById('edit-staff-phone').value.trim();
  if (!name) return;
  const btn = document.getElementById('staff-edit-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await db.collection('staff').doc(id).update({ name, role, farm, phone });
    closeStaffEdit();
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'STAFF',
        desc: 'Staff updated: ' + name + ' (' + role + ')' + (farm ? ' — ' + farm : ''),
        tech: 'System', date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}), ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
  } catch(e) { alert('Error: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Save Changes';
}

// ── Filters ─────────────────────────────────
function staffStatusFilter(val, btn) {
  _staffFilter = val;
  document.querySelectorAll('#staff-filter-bar .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStaff();
}

function staffFarmFilter(val, btn) {
  _staffFarmFilter = val;
  document.querySelectorAll('#staff-farm-bar .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStaff();
}

// ── Allow Enter key on add form ─────────────
document.addEventListener('DOMContentLoaded', () => {
  ['staff-new-fname','staff-new-lname','staff-new-phone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') addStaff(); });
  });
});

// ═══════════════════════════════════════════
// ONBOARDING CHECKLIST
// ═══════════════════════════════════════════
let staffOnboardList = [];
let _onboardFilter = 'all';

const DEFAULT_ONBOARD_ITEMS = [
  { id: 'orientation',  label: 'Facility orientation walkthrough' },
  { id: 'paperwork',    label: 'HR paperwork & forms completed' },
  { id: 'biosecurity',  label: 'Biosecurity & safety training' },
  { id: 'ppe',          label: 'Uniform / PPE issued' },
  { id: 'access',       label: 'Keys / access card issued' },
  { id: 'comms',        label: 'Added to team group chat' },
  { id: 'duties',       label: 'Job duties & expectations reviewed' },
  { id: 'emergency',    label: 'Emergency procedures reviewed' },
  { id: 'equipment',    label: 'Equipment training completed' },
  { id: 'checkin',      label: 'First week check-in with manager' },
];

function startStaffOnboardListener() {
  try {
    db.collection('staffOnboarding').onSnapshot(
      snap => {
        staffOnboardList = snap.docs.map(d => ({ ...d.data(), _fbId: d.id }));
        renderStaffOnboard();
      },
      err => { console.error('Onboard listener error:', err); }
    );
  } catch(e) { console.error('Onboard listener error:', e); }
}

async function createOnboarding(staffId, staffName) {
  const items = DEFAULT_ONBOARD_ITEMS.map(i => ({
    ...i, done: false, doneBy: '', doneTs: null
  }));
  try {
    await db.collection('staffOnboarding').doc(staffId).set({
      staffId, staffName, items, createdTs: Date.now(), completedTs: null
    });
  } catch(e) { console.error('Create onboarding error:', e); }
}

function onboardFilter(val, btn) {
  _onboardFilter = val;
  document.querySelectorAll('#onboard-filter-bar .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStaffOnboard();
}

function renderStaffOnboard() {
  const listEl  = document.getElementById('onboard-list');
  const statsEl = document.getElementById('onboard-stats');
  if (!listEl) return;

  const complete   = staffOnboardList.filter(o => o.items && o.items.every(i => i.done));
  const incomplete = staffOnboardList.filter(o => o.items && !o.items.every(i => i.done));

  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-num">${staffOnboardList.length}</div><div class="stat-label">Total</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#d69e2e">${incomplete.length}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#4caf50">${complete.length}</div><div class="stat-label">Complete</div></div>`;

  let list = staffOnboardList;
  if (_onboardFilter === 'complete')   list = complete;
  if (_onboardFilter === 'incomplete') list = incomplete;

  if (!list.length) {
    listEl.innerHTML = `<div class="empty"><div class="ei">📋</div><p>${staffOnboardList.length ? 'No results for this filter' : 'No onboarding checklists yet — add an employee to get started'}</p></div>`;
    return;
  }

  // Sort: incomplete first, then by name
  list = [...list].sort((a, b) => {
    const aDone = a.items?.every(i => i.done) ? 1 : 0;
    const bDone = b.items?.every(i => i.done) ? 1 : 0;
    return aDone - bDone || (a.staffName || '').localeCompare(b.staffName || '');
  });

  let html = '';
  list.forEach(o => {
    const items    = o.items || [];
    const doneCount= items.filter(i => i.done).length;
    const total    = items.length;
    const pct      = total ? Math.round((doneCount / total) * 100) : 0;
    const allDone  = doneCount === total;
    const safeId   = o.staffId.replace(/['"]/g, '');

    html += `<div style="background:#0f1a0f;border:1px solid ${allDone ? '#2a5a2a' : '#1e3a1e'};border-radius:12px;margin-bottom:12px;overflow:hidden;">
      <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="toggleOnboardExpand('${safeId}')">
        <div style="width:38px;height:38px;border-radius:50%;background:${allDone ? '#1a3a1a' : '#1a1a2a'};border:2px solid ${allDone ? '#2a5a2a' : '#2a2a4a'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${staffInitials(o.staffName)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#f0ead8;">${o.staffName}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:5px;">
            <div style="flex:1;height:6px;background:#1a1a1a;border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${allDone ? '#4caf50' : '#4a90d9'};border-radius:3px;transition:width 0.3s;"></div>
            </div>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${allDone ? '#4caf50' : '#4a6a8a'};font-weight:700;white-space:nowrap;">${doneCount}/${total} ${allDone ? '✓ Done' : ''}</span>
          </div>
        </div>
        <span style="color:#4a6a4a;font-size:12px;" id="onboard-chevron-${safeId}">▼</span>
      </div>
      <div id="onboard-items-${safeId}" style="display:none;border-top:1px solid #1e3a1e;padding:12px 16px;">
        ${items.map(item => {
          const safeItemId = item.id.replace(/['"]/g, '');
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #121e12;">
            <button onclick="toggleOnboardItem('${safeId}','${safeItemId}',${!item.done})" style="width:22px;height:22px;border-radius:4px;border:2px solid ${item.done ? '#4caf50' : '#2a5a2a'};background:${item.done ? '#1a3a1a' : 'transparent'};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;">${item.done ? '✓' : ''}</button>
            <span style="flex:1;font-size:12px;color:${item.done ? '#4a6a4a' : '#c0d8c0'};${item.done ? 'text-decoration:line-through;' : ''}">${item.label}</span>
            ${item.doneTs ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a5a3a;">${new Date(item.doneTs).toLocaleDateString()}</span>` : ''}
          </div>`;
        }).join('')}
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
          <input type="text" id="onboard-custom-${safeId}" placeholder="Add custom item..." style="flex:1;background:#0a140a;border:1px solid #2a5a2a;border-radius:6px;color:#f0ead8;padding:7px 10px;font-size:12px;font-family:inherit;">
          <button onclick="addCustomOnboardItem('${safeId}')" style="padding:7px 14px;background:#1a3a1a;border:1px solid #2a5a2a;border-radius:6px;color:#7ac57a;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-weight:700;">+ Add</button>
        </div>
      </div>
    </div>`;
  });

  listEl.innerHTML = html;
}

function toggleOnboardExpand(staffId) {
  const items   = document.getElementById('onboard-items-' + staffId);
  const chevron = document.getElementById('onboard-chevron-' + staffId);
  if (!items) return;
  const open = items.style.display === 'none';
  items.style.display   = open ? 'block' : 'none';
  if (chevron) chevron.textContent = open ? '▲' : '▼';
}

async function toggleOnboardItem(staffId, itemId, done) {
  const record = staffOnboardList.find(o => o.staffId === staffId);
  if (!record) return;
  const items = (record.items || []).map(i =>
    i.id === itemId ? { ...i, done, doneTs: done ? Date.now() : null } : i
  );
  const allDone = items.every(i => i.done);
  try {
    await db.collection('staffOnboarding').doc(staffId).update({
      items, completedTs: allDone ? Date.now() : null
    });
  } catch(e) { console.error('Onboard toggle error:', e); }
}

async function addCustomOnboardItem(staffId) {
  const input = document.getElementById('onboard-custom-' + staffId);
  const label = input?.value.trim();
  if (!label) return;
  const record = staffOnboardList.find(o => o.staffId === staffId);
  if (!record) return;
  const newItem = { id: 'custom_' + Date.now(), label, done: false, doneBy: '', doneTs: null };
  const items   = [...(record.items || []), newItem];
  try {
    await db.collection('staffOnboarding').doc(staffId).update({ items });
    input.value = '';
  } catch(e) { console.error('Add custom item error:', e); }
}

// ═══════════════════════════════════════════
// STAFF SCHEDULE
// ═══════════════════════════════════════════
let _staffSchedWeekOf = '';
let _staffSchedFac = 'all';
let _staffSchedType = 'maintenance'; // 'maintenance' | 'barn'
let _staffSchedLoc  = 'Danville';   // 'Danville' | 'Hegins'

const STAFF_SCHED_DAYS       = ['mon','tue','wed','thu','fri','sat','sun'];
const STAFF_SCHED_DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const STAFF_SCHED_SHIFTS     = ['', 'AM', 'PM', 'EVE', 'OFF', 'VAC'];

const SHIFT_STYLES = {
  'AM':  'background:#1a3a1a;border:1px solid #2a5a2a;color:#7ac57a',
  'PM':  'background:#1a2a3a;border:1px solid #1e3a5a;color:#7aacd9',
  'EVE': 'background:#1a1a3a;border:1px solid #2a2a5a;color:#9a9aff',
  'OFF': 'background:#2a1a0a;border:1px solid #4a3a1a;color:#c9963a',
  'VAC': 'background:#1a0a0a;border:1px solid #3a1a1a;color:#c96a6a',
  '':    'background:#0d0d0d;border:1px solid #1a1a1a;color:#333',
};

function _schedGetMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function staffSchedThisWeek() {
  _staffSchedWeekOf = _schedGetMonday(new Date());
  renderStaffSched();
}

function staffSchedPrevWeek() {
  const d = new Date(_staffSchedWeekOf + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  _staffSchedWeekOf = d.toISOString().slice(0, 10);
  renderStaffSched();
}

function staffSchedNextWeek() {
  const d = new Date(_staffSchedWeekOf + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  _staffSchedWeekOf = d.toISOString().slice(0, 10);
  renderStaffSched();
}

function staffSchedFacFilter(val, btn) {
  _staffSchedFac = val;
  document.querySelectorAll('#staff-sched-fac-bar .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStaffSched();
}

function staffSchedTypeFilter(type, btn) {
  _staffSchedType = type;
  document.querySelectorAll('.sched-type-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStaffSched();
}

function staffSchedLocFilter(loc, btn) {
  _staffSchedLoc = loc;
  document.querySelectorAll('.sched-loc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStaffSched();
}

async function setBarnLeader(staffId, staffName) {
  try {
    await db.collection('barnLeaders').doc(_staffSchedLoc).set({
      staffId, staffName, location: _staffSchedLoc, ts: Date.now()
    });
    renderStaffSched();
  } catch(e) { console.error('Leader set error:', e); }
}

async function clearBarnLeader() {
  try {
    await db.collection('barnLeaders').doc(_staffSchedLoc).delete();
    renderStaffSched();
  } catch(e) { console.error('Leader clear error:', e); }
}

async function renderStaffSched() {
  if (!_staffSchedWeekOf) _staffSchedWeekOf = _schedGetMonday(new Date());

  const labelEl = document.getElementById('sched-week-label');
  if (labelEl) {
    const d   = new Date(_staffSchedWeekOf + 'T00:00:00');
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const fmt = { month: 'short', day: 'numeric' };
    labelEl.textContent = `${d.toLocaleDateString('en-US', fmt)} – ${end.toLocaleDateString('en-US', fmt)}`;
  }

  const grid = document.getElementById('staff-sched-grid');
  if (!grid) return;

  // Filter by worker type
  const roleSet = _staffSchedType === 'barn' ? BARN_ROLES : MAINTENANCE_ROLES;
  let staff = staffList.filter(s => s.active !== false && roleSet.includes(s.role));

  // Filter by location
  staff = staff.filter(s =>
    s.farm === _staffSchedLoc ||
    s.farm === 'Both' ||
    s.farm === 'All Farms' ||
    s.farm === 'All'
  );

  // Load barn leader for this location (barn tab only)
  let barnLeaderId = null;
  if (_staffSchedType === 'barn') {
    try {
      const leaderDoc = await db.collection('barnLeaders').doc(_staffSchedLoc).get();
      if (leaderDoc.exists) {
        barnLeaderId = leaderDoc.data().staffId;
        const bannerEl = document.getElementById('barn-leader-banner');
        const nameEl   = document.getElementById('barn-leader-name');
        if (bannerEl && nameEl) {
          nameEl.textContent = leaderDoc.data().staffName + ' — ' + _staffSchedLoc;
          bannerEl.style.display = 'flex';
        }
      } else {
        const bannerEl = document.getElementById('barn-leader-banner');
        if (bannerEl) bannerEl.style.display = 'none';
      }
    } catch(e) { /* ignore */ }
  } else {
    const bannerEl = document.getElementById('barn-leader-banner');
    if (bannerEl) bannerEl.style.display = 'none';
  }

  if (!staff.length) {
    grid.innerHTML = '<div style="padding:24px;text-align:center;color:#4a6a4a;font-family:\'IBM Plex Mono\',monospace;">No active staff for this filter.</div>';
    return;
  }

  // Load this week's schedule from Firestore
  let schedData = {};
  try {
    const snap = await db.collection('staffSchedule')
      .where('weekOf', '==', _staffSchedWeekOf)
      .get();
    snap.docs.forEach(d => {
      const data = d.data();
      schedData[data.staffId] = { ...data, _fbId: d.id };
    });
  } catch(e) { console.error('Schedule load error:', e); }

  const today     = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(_staffSchedWeekOf + 'T00:00:00');

  // Build table
  let html = '<table style="width:100%;border-collapse:collapse;font-family:\'IBM Plex Mono\',monospace;font-size:11px;">';

  // Header
  html += '<thead><tr>';
  html += '<th style="text-align:left;padding:8px 10px;font-size:9px;color:#4a6a4a;letter-spacing:1px;border-bottom:1px solid #1e3a1e;white-space:nowrap;">EMPLOYEE</th>';
  STAFF_SCHED_DAY_LABELS.forEach((label, i) => {
    const dd = new Date(weekStart);
    dd.setDate(dd.getDate() + i);
    const dateStr  = dd.toISOString().slice(0, 10);
    const isToday  = dateStr === today;
    html += `<th style="text-align:center;padding:6px 4px;font-size:9px;letter-spacing:1px;border-bottom:1px solid #1e3a1e;${isToday ? 'color:#f0ead8;' : 'color:#4a6a4a;'}">${label}<br><span style="font-size:9px;opacity:0.6;">${dd.getDate()}</span></th>`;
  });
  html += '</tr></thead>';

  // Rows
  const SITE_OPTS = ['', 'Hegins', 'Danville', 'Rushtown', 'Feed Mill'];
  const SITE_COLOR = { Hegins:'#4a8a4a', Danville:'#4a70aa', Rushtown:'#9a6a2a', 'Feed Mill':'#7a5a2a', '':'#2a4a2a' };

  html += '<tbody>';
  staff.forEach(s => {
    const row = schedData[s._fbId] || {};
    const site = s.farm || '';
    const siteColor = SITE_COLOR[site] || SITE_COLOR[''];
    const siteLabel = site || 'No site';
    const safeId = s._fbId.replace(/['"]/g, '');
    const siteOptsHtml = SITE_OPTS.map(o =>
      `<option value="${o}"${o===site?' selected':''}>${o||'— No site —'}</option>`
    ).join('');
    const safeName = s.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const onCall   = !!row.onCall;
    const isLeader = _staffSchedType === 'barn' && s._fbId === barnLeaderId;
    html += `<tr style="border-top:1px solid #121e12;${onCall ? 'background:#0d1a0d;' : ''}${isLeader ? 'border-left:3px solid #4ade80;' : ''}">`;
    html += `<td style="padding:6px 10px;color:#c0d8c0;white-space:nowrap;">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span>${s.name}</span>
        ${isLeader ? '<span style="font-size:9px;background:#1a4a1a;border:1px solid #4ade80;border-radius:4px;padding:1px 5px;color:#4ade80;font-family:\'IBM Plex Mono\',monospace;font-weight:700;">👑 LEADER</span>' : ''}
        ${onCall ? '<span style="font-size:9px;background:#1a4a1a;border:1px solid #4ade80;border-radius:4px;padding:1px 5px;color:#4ade80;font-family:\'IBM Plex Mono\',monospace;font-weight:700;">ON CALL</span>' : ''}
      </div>
      <span style="font-size:9px;color:#3a5a3a;">${s.role || ''}</span><br>
      <div style="display:flex;gap:4px;margin-top:3px;align-items:center;flex-wrap:wrap;">
        <select onchange="setStaffSite('${safeId}',this.value)"
          style="background:#0a1a0a;border:1px solid ${siteColor};border-radius:4px;color:${siteColor};font-family:'IBM Plex Mono',monospace;font-size:9px;padding:2px 4px;cursor:pointer;max-width:90px;">
          ${siteOptsHtml}
        </select>
        <button onclick="toggleOnCall('${safeId}','${safeName}',${onCall})"
          title="${onCall ? 'Remove on-call' : 'Set on-call'}"
          style="background:${onCall ? '#1a4a1a' : '#0a1a0a'};border:1px solid ${onCall ? '#4ade80' : '#2a4a2a'};border-radius:4px;color:${onCall ? '#4ade80' : '#4a6a4a'};font-size:9px;padding:2px 5px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-weight:700;">📞</button>
        ${_staffSchedType === 'barn' ? `<button onclick="${isLeader ? 'clearBarnLeader()' : `setBarnLeader('${safeId}','${safeName.replace(/'/g,"\\'")}')`}"
          title="${isLeader ? 'Remove as leader' : 'Set as leader'}"
          style="background:${isLeader ? '#1a4a1a' : '#0a1a0a'};border:1px solid ${isLeader ? '#4ade80' : '#3a4a2a'};border-radius:4px;color:${isLeader ? '#4ade80' : '#4a6a4a'};font-size:9px;padding:2px 5px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-weight:700;">👑</button>` : ''}
      </div>
    </td>`;
    STAFF_SCHED_DAYS.forEach(day => {
      const shift = row[day] || '';
      const st    = SHIFT_STYLES[shift] || SHIFT_STYLES[''];
      html += `<td style="padding:3px;text-align:center;"><button onclick="cycleShift('${safeId}','${safeName}','${day}','${shift}')" style="${st};border-radius:5px;padding:5px 2px;font-size:10px;font-weight:700;cursor:pointer;width:100%;min-width:38px;font-family:'IBM Plex Mono',monospace;">${shift || '–'}</button></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  grid.innerHTML = html;
}

async function cycleShift(staffId, staffName, day, currentShift) {
  const idx       = STAFF_SCHED_SHIFTS.indexOf(currentShift);
  const nextShift = STAFF_SCHED_SHIFTS[(idx + 1) % STAFF_SCHED_SHIFTS.length];
  try {
    const docId = `${staffId}_${_staffSchedWeekOf}`;
    await db.collection('staffSchedule').doc(docId).set(
      { staffId, staffName, weekOf: _staffSchedWeekOf, [day]: nextShift, ts: Date.now() },
      { merge: true }
    );
    renderStaffSched();
  } catch(e) { console.error('Shift save error:', e); }
}

async function toggleOnCall(staffId, staffName, currentlyOnCall) {
  try {
    const docId = `${staffId}_${_staffSchedWeekOf}`;
    await db.collection('staffSchedule').doc(docId).set(
      { staffId, staffName, weekOf: _staffSchedWeekOf, onCall: !currentlyOnCall, ts: Date.now() },
      { merge: true }
    );
    renderStaffSched();
  } catch(e) { console.error('On-call save error:', e); }
}

async function setStaffSite(staffId, site) {
  try {
    await db.collection('staff').doc(staffId).update({ farm: site });
    const s = staffList.find(x => x._fbId === staffId);
    if (s) s.farm = site;
    renderStaffSched();
  } catch(e) { console.error('Site save error:', e); }
}

// ═══════════════════════════════════════════
// STAFF CERTIFICATIONS
// ═══════════════════════════════════════════
let staffCertsList = [];

function startStaffCertsListener() {
  try {
    db.collection('staffCerts').orderBy('staffName', 'asc').onSnapshot(
      snap => {
        staffCertsList = snap.docs.map(d => ({ ...d.data(), _fbId: d.id }));
        renderStaffCerts();
      },
      err => { console.error('Certs listener error:', err); }
    );
  } catch(e) { console.error('Certs listener error:', e); }
}

function renderStaffCerts() {
  const listEl  = document.getElementById('cert-list');
  const statsEl = document.getElementById('cert-stats');
  if (!listEl) return;

  updateCertStaffSelect();

  const today   = new Date().toISOString().slice(0, 10);
  const soonDt  = new Date();
  soonDt.setDate(soonDt.getDate() + 30);
  const soonStr = soonDt.toISOString().slice(0, 10);

  const expired     = staffCertsList.filter(c => c.expiresDate && c.expiresDate < today);
  const expiringSoon= staffCertsList.filter(c => c.expiresDate && c.expiresDate >= today && c.expiresDate <= soonStr);
  const valid       = staffCertsList.filter(c => !c.expiresDate || c.expiresDate > soonStr);

  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-num" style="color:#4caf50">${valid.length}</div><div class="stat-label">Valid</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#d69e2e">${expiringSoon.length}</div><div class="stat-label">Expiring Soon</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#e53e3e">${expired.length}</div><div class="stat-label">Expired</div></div>`;

  if (!staffCertsList.length) {
    listEl.innerHTML = '<div class="empty"><div class="ei">🏆</div><p>No certifications logged yet — use the form above</p></div>';
    return;
  }

  // Group by staff name
  const byStaff = {};
  staffCertsList.forEach(c => {
    const key = c.staffName || 'Unknown';
    (byStaff[key] = byStaff[key] || []).push(c);
  });

  let html = '';
  Object.keys(byStaff).sort().forEach(name => {
    html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:#5a8a5a;text-transform:uppercase;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #1e3a1e;">${name}</div>`;
    byStaff[name].forEach(c => {
      let borderColor = '#2a5a2a', statusHtml = '';
      if (c.expiresDate) {
        if (c.expiresDate < today) {
          borderColor = '#5a1a1a';
          statusHtml = ' <span style="color:#e53e3e;font-weight:700;">EXPIRED</span>';
        } else if (c.expiresDate <= soonStr) {
          borderColor = '#5a4a1a';
          statusHtml = ' <span style="color:#d69e2e;font-weight:700;">EXPIRING SOON</span>';
        }
      }
      const safeCert = c.certName.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const safeName = name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      html += `<div style="background:#0f1a0f;border:1px solid #1e3a1e;border-left:3px solid ${borderColor};border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
        <div style="flex:1;min-width:0;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#f0ead8;">${c.certName}${statusHtml}</div>
          <div style="font-size:11px;color:#4a6a4a;margin-top:3px;">
            ${c.issuedDate ? '📅 Issued: ' + c.issuedDate : ''}
            ${c.issuedDate && c.expiresDate ? ' · ' : ''}
            ${c.expiresDate ? '⏳ Expires: ' + c.expiresDate : ''}
            ${c.notes ? ' · ' + c.notes : ''}
          </div>
        </div>
        <button onclick="deleteStaffCert('${c._fbId}','${safeCert}','${safeName}')" style="padding:5px 8px;background:#1a0a0a;border:1px solid #3a1a1a;border-radius:6px;color:#666;font-size:11px;cursor:pointer;flex-shrink:0;">✕</button>
      </div>`;
    });
  });

  listEl.innerHTML = html;
}

function updateCertStaffSelect() {
  const sel = document.getElementById('cert-staff-select');
  if (!sel) return;
  const cur    = sel.value;
  const active = staffList.filter(s => s.active !== false);
  sel.innerHTML = '<option value="">— Select Employee —</option>' +
    active.map(s => `<option value="${s._fbId}|${s.name.replace(/"/g,'&quot;')}">${s.name}</option>`).join('');
  if (cur) sel.value = cur;
}

async function addStaffCert() {
  const staffVal = document.getElementById('cert-staff-select').value;
  const certName = document.getElementById('cert-name').value.trim();
  if (!staffVal || !certName) {
    alert('Employee and certification name are required.');
    return;
  }
  const [staffId, staffName] = staffVal.split('|');
  const issuedDate  = document.getElementById('cert-issued').value;
  const expiresDate = document.getElementById('cert-expires').value;
  const notes       = document.getElementById('cert-notes').value.trim();

  const btn = document.getElementById('cert-add-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await db.collection('staffCerts').add({
      staffId, staffName, certName, issuedDate, expiresDate, notes, ts: Date.now()
    });
    document.getElementById('cert-name').value    = '';
    document.getElementById('cert-issued').value  = '';
    document.getElementById('cert-expires').value = '';
    document.getElementById('cert-notes').value   = '';
    document.getElementById('cert-staff-select').value = '';
    const res = document.getElementById('cert-add-result');
    res.style.display = 'block';
    setTimeout(() => { res.style.display = 'none'; }, 2000);
  } catch(e) { alert('Error: ' + e.message); }
  btn.disabled = false; btn.textContent = '+ Log Cert';
}

async function deleteStaffCert(id, certName, staffName) {
  if (!confirm(`Remove "${certName}" from ${staffName}?`)) return;
  try { await db.collection('staffCerts').doc(id).delete(); } catch(e) { alert('Error: ' + e.message); }
}
