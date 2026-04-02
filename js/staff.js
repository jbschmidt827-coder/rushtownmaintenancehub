// ═══════════════════════════════════════════
// STAFF MODULE
// ═══════════════════════════════════════════
let staffList = [];
let _staffFilter = 'active';
let _staffFarmFilter = 'all';

const STAFF_ROLES = ['Technician','Lead','WNO','Director','Driver','Feed Mill','Other'];

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

// ── Add Employee ────────────────────────────
async function addStaff() {
  const name  = document.getElementById('staff-new-name').value.trim();
  const role  = document.getElementById('staff-new-role').value;
  const farm  = document.getElementById('staff-new-farm').value;
  const phone = document.getElementById('staff-new-phone').value.trim();
  if (!name) { document.getElementById('staff-new-name').focus(); return; }

  const btn = document.getElementById('staff-add-btn');
  btn.disabled = true; btn.textContent = 'Saving...';

  const errEl = document.getElementById('staff-add-error');
  if (errEl) errEl.style.display = 'none';

  try {
    await db.collection('staff').add({ name, role: role||'Technician', farm: farm||'', phone, active: true, ts: Date.now() });
    document.getElementById('staff-new-name').value  = '';
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
  try { await db.collection('staff').doc(id).delete(); } catch(e) { alert('Error: ' + e.message); }
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
  const nameInput = document.getElementById('staff-new-name');
  if (nameInput) nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addStaff(); });
  const phoneInput = document.getElementById('staff-new-phone');
  if (phoneInput) phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') addStaff(); });
});

// ═══════════════════════════════════════════
// STAFF SCHEDULE
// ═══════════════════════════════════════════
let _staffSchedWeekOf = '';
let _staffSchedFac = 'all';

const SCHED_DAYS       = ['mon','tue','wed','thu','fri','sat','sun'];
const SCHED_DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SCHED_SHIFTS     = ['', 'AM', 'PM', 'EVE', 'OFF', 'VAC'];

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

  let staff = staffList.filter(s => s.active !== false);
  if (_staffSchedFac !== 'all') {
    staff = staff.filter(s =>
      s.farm === _staffSchedFac ||
      s.farm === 'Both' ||
      s.farm === 'All Farms' ||
      s.farm === 'All'
    );
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
  SCHED_DAY_LABELS.forEach((label, i) => {
    const dd = new Date(weekStart);
    dd.setDate(dd.getDate() + i);
    const dateStr  = dd.toISOString().slice(0, 10);
    const isToday  = dateStr === today;
    html += `<th style="text-align:center;padding:6px 4px;font-size:9px;letter-spacing:1px;border-bottom:1px solid #1e3a1e;${isToday ? 'color:#f0ead8;' : 'color:#4a6a4a;'}">${label}<br><span style="font-size:9px;opacity:0.6;">${dd.getDate()}</span></th>`;
  });
  html += '</tr></thead>';

  // Rows
  html += '<tbody>';
  staff.forEach(s => {
    const row = schedData[s._fbId] || {};
    html += '<tr style="border-top:1px solid #121e12;">';
    html += `<td style="padding:6px 10px;color:#c0d8c0;white-space:nowrap;">${s.name}<br><span style="font-size:9px;color:#3a5a3a;">${s.role || ''}</span></td>`;
    SCHED_DAYS.forEach(day => {
      const shift = row[day] || '';
      const st    = SHIFT_STYLES[shift] || SHIFT_STYLES[''];
      const safeId = s._fbId.replace(/['"]/g, '');
      const safeName = s.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      html += `<td style="padding:3px;text-align:center;"><button onclick="cycleShift('${safeId}','${safeName}','${day}','${shift}')" style="${st};border-radius:5px;padding:5px 2px;font-size:10px;font-weight:700;cursor:pointer;width:100%;min-width:38px;font-family:'IBM Plex Mono',monospace;">${shift || '–'}</button></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  grid.innerHTML = html;
}

async function cycleShift(staffId, staffName, day, currentShift) {
  const idx       = SCHED_SHIFTS.indexOf(currentShift);
  const nextShift = SCHED_SHIFTS[(idx + 1) % SCHED_SHIFTS.length];
  try {
    const docId = `${staffId}_${_staffSchedWeekOf}`;
    await db.collection('staffSchedule').doc(docId).set(
      { staffId, staffName, weekOf: _staffSchedWeekOf, [day]: nextShift, ts: Date.now() },
      { merge: true }
    );
    renderStaffSched();
  } catch(e) { console.error('Shift save error:', e); }
}

// ═══════════════════════════════════════════
// STAFF CERTIFICATIONS
// ═══════════════════════════════════════════
let staffCertsList = [];

function startStaffCertsListener() {
  try {
    db.collection('staffCerts').orderBy('staffName', 'asc').onSnapshot(snap => {
      staffCertsList = snap.docs.map(d => ({ ...d.data(), _fbId: d.id }));
      renderStaffCerts();
    });
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
