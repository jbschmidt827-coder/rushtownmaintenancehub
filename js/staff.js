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

  try {
    await db.collection('staff').add({ name, role: role||'Technician', farm: farm||'', phone, active: true, ts: Date.now() });
    document.getElementById('staff-new-name').value  = '';
    document.getElementById('staff-new-phone').value = '';
    document.getElementById('staff-add-result').style.display = 'block';
    setTimeout(() => { document.getElementById('staff-add-result').style.display = 'none'; }, 2000);
  } catch(e) { alert('Error: ' + e.message); }

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
