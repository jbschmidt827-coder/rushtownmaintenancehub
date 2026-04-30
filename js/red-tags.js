// ═══════════════════════════════════════════════════════════════════════
// RED TAG TRACKER
// Firebase collection: redTags
// Core 5S tool — tag items that don't belong, are broken, or need decision
// Statuses: Tagged → Under Review → Keep / Relocate / Dispose
// ═══════════════════════════════════════════════════════════════════════

let redTags = [];
let _rtFilter = 'active';  // 'all' | 'active' | 'resolved'
let _rtFarmFilter = 'all';
let _rtListening = false;

// ── Listener (called from initApp) ───────────────────────────────────────────
function startRedTagListener() {
  if (_rtListening) return;
  _rtListening = true;
  db.collection('redTags').orderBy('ts','desc').onSnapshot(snap => {
    redTags = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
    if (document.getElementById('maint-redtags')?.style.display !== 'none') renderRedTags();
  });
}

// ── Main render (Maintenance sub-section) ────────────────────────────────────
function renderRedTags() {
  const el = document.getElementById('maint-redtags');
  if (!el) return;

  const active   = redTags.filter(t => t.status === 'Tagged' || t.status === 'Under Review');
  const resolved = redTags.filter(t => t.status !== 'Tagged' && t.status !== 'Under Review');
  const shown    = _rtFilter === 'active' ? active : _rtFilter === 'resolved' ? resolved : redTags;
  const farmed   = _rtFarmFilter === 'all' ? shown : shown.filter(t => t.farm === _rtFarmFilter);

  el.innerHTML = `
  <div style="max-width:960px;margin:0 auto;padding-bottom:60px;">

    <!-- Stats bar -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:14px;">
      ${rtStatCard('🏷️', active.length, 'Active Tags', active.length > 10 ? '#7f1d1d' : active.length > 5 ? '#856404' : '#1b5e20', active.length > 10 ? '#f87171' : active.length > 5 ? '#fbbf24' : '#4ade80')}
      ${rtStatCard('🔍', redTags.filter(t=>t.status==='Under Review').length, 'Under Review', '#0d1a2a', '#7ab0f6')}
      ${rtStatCard('✅', resolved.length, 'Resolved', '#1b5e20', '#4ade80')}
      ${rtStatCard('📍', [...new Set(active.map(t=>t.farm+'-'+t.house))].length, 'Locations Affected', '#1a1000', '#fbbf24')}
    </div>

    <!-- Add button + filters -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
      <div style="display:flex;gap:7px;flex-wrap:wrap;">
        ${['active','resolved','all'].map(f => `
          <button onclick="rtSetFilter('${f}')" style="padding:6px 14px;background:${_rtFilter===f?'#1a3a1a':'#0a1a0a'};border:1.5px solid ${_rtFilter===f?'#4ade80':'#1a3a1a'};border-radius:20px;color:${_rtFilter===f?'#4ade80':'#4a8a4a'};font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:.5px;">
            ${f==='active'?'Active':''}${f==='resolved'?'Resolved':''}${f==='all'?'All':''}
          </button>`).join('')}
        ${['all','Danville','Hegins'].map(f => `
          <button onclick="rtSetFarm('${f}')" style="padding:6px 14px;background:${_rtFarmFilter===f?'#0d1a2a':'#0a1a0a'};border:1.5px solid ${_rtFarmFilter===f?'#3b82f6':'#1a3a1a'};border-radius:20px;color:${_rtFarmFilter===f?'#7ab0f6':'#4a8a4a'};font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:.5px;">
            ${f==='all'?'All Farms':'📍 '+f}
          </button>`).join('')}
      </div>
      <button onclick="rtOpenForm()" style="padding:8px 18px;background:#2d0505;border:2px solid #ef4444;border-radius:8px;color:#fca5a5;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">🏷️ + RED TAG</button>
    </div>

    <!-- Cards -->
    ${farmed.length === 0
      ? `<div style="background:#0a1f0a;border:1px solid #1a3a1a;border-radius:10px;padding:24px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2a5a2a;">
          ${_rtFilter==='active' ? '✓ No active red tags — areas are clear' : 'No tags found for this filter'}
         </div>`
      : farmed.map(t => rtCard(t)).join('')}
  </div>

  <!-- Add / Edit form modal -->
  <div id="rt-modal" style="display:none;position:fixed;inset:0;background:#000a;z-index:9999;align-items:center;justify-content:center;padding:20px;">
    <div style="background:#0f1a0f;border:2px solid #7f1d1d;border-radius:16px;padding:24px;width:100%;max-width:500px;max-height:88vh;overflow-y:auto;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#fca5a5;letter-spacing:2px;margin-bottom:18px;">🏷️ NEW RED TAG</div>
      ${rtForm()}
    </div>
  </div>`;
}

// ── Individual red tag card ────────────────────────────────────────────────────
function rtCard(t) {
  const statusColor = {
    'Tagged':       { bg:'#2d0505', border:'#7f1d1d', color:'#fca5a5' },
    'Under Review': { bg:'#1a1000', border:'#854d0e', color:'#fde68a' },
    'Keep':         { bg:'#0d1a2a', border:'#1e3a5f', color:'#7ab0f6' },
    'Relocate':     { bg:'#1a1a00', border:'#4a4a00', color:'#d4d400' },
    'Dispose':      { bg:'#0a2a0a', border:'#166534', color:'#4ade80' }
  }[t.status] || { bg:'#0a1a0a', border:'#1a3a1a', color:'#4a8a4a' };

  const daysOld = t.date ? Math.floor((new Date() - new Date(t.date)) / 86400000) : null;

  return `
  <div style="background:${statusColor.bg};border:1.5px solid ${statusColor.border};border-radius:12px;padding:14px 16px;margin-bottom:8px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <!-- Tag header -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;">🏷️ TAG-${t._fbId?.slice(-4).toUpperCase()||'????'}</span>
          <span style="background:${statusColor.color}22;color:${statusColor.color};border-radius:4px;padding:1px 7px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;text-transform:uppercase;">${t.status}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;">${t.farm||''} ${t.house?'· H'+t.house:''}</span>
          ${daysOld !== null && daysOld > 7 && (t.status==='Tagged'||t.status==='Under Review') ? `<span style="background:#7f1d1d;color:#fca5a5;border-radius:4px;padding:1px 6px;font-family:'IBM Plex Mono',monospace;font-size:8px;font-weight:700;">⏰ ${daysOld}d old</span>` : ''}
        </div>

        <!-- Item description -->
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#e8f5ec;font-weight:600;margin-bottom:4px;">${t.item}</div>

        <!-- Location / category -->
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;margin-bottom:6px;">
          📍 ${t.location||'—'} &nbsp;·&nbsp; 📂 ${t.category||'Unknown'} &nbsp;·&nbsp; Tagged by ${t.taggedBy||'—'} on ${t.date||'—'}
        </div>

        <!-- Reason -->
        ${t.reason ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;margin-bottom:6px;">Reason: ${t.reason}</div>` : ''}

        <!-- Resolution notes -->
        ${t.resolution ? `<div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:6px;padding:6px 9px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#c8e6c9;margin-top:6px;">✓ ${t.resolution}</div>` : ''}
      </div>

      <!-- Action buttons -->
      <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">
        ${t.status === 'Tagged' ? `
          <button onclick="rtUpdateStatus('${t._fbId}','Under Review')" style="padding:4px 10px;background:#1a1000;border:1.5px solid #854d0e;border-radius:5px;color:#fde68a;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;">Review</button>` : ''}
        ${t.status === 'Tagged' || t.status === 'Under Review' ? `
          <button onclick="rtResolvePrompt('${t._fbId}')" style="padding:4px 10px;background:#0a2a0a;border:1.5px solid #166534;border-radius:5px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;">Resolve</button>
          <button onclick="rtDelete('${t._fbId}')" style="padding:4px 10px;background:#2d0505;border:1px solid #7f1d1d;border-radius:5px;color:#f87171;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;">Remove</button>` : ''}
      </div>
    </div>
  </div>

  <!-- Resolve mini-form (hidden, toggled inline) -->
  <div id="rt-resolve-${t._fbId}" style="display:none;background:#0a2a0a;border:1px solid #166534;border-radius:10px;padding:12px 14px;margin-top:-4px;margin-bottom:8px;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase;">How was this resolved?</div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px;">
      ${['Keep','Relocate','Dispose'].map(s => `
        <button id="rt-res-btn-${t._fbId}-${s}" onclick="rtSelectResolution('${t._fbId}','${s}')"
          style="padding:6px 14px;background:#0a1a0a;border:1.5px solid #1a3a1a;border-radius:6px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;text-transform:uppercase;">${s}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px;">
      <input id="rt-res-note-${t._fbId}" type="text" placeholder="Resolution note (optional)"
        style="flex:1;padding:8px;background:#091209;border:1.5px solid #2a5a2a;border-radius:7px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;" />
      <button onclick="rtSubmitResolution('${t._fbId}')" style="padding:8px 14px;background:#1a4a1a;border:2px solid #4ade80;border-radius:7px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;">✓ SAVE</button>
    </div>
  </div>`;
}

// ── Resolve flow ──────────────────────────────────────────────────────────────
let _rtSelectedResolution = {};

function rtResolvePrompt(fbId) {
  const el = document.getElementById('rt-resolve-' + fbId);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function rtSelectResolution(fbId, status) {
  _rtSelectedResolution[fbId] = status;
  ['Keep','Relocate','Dispose'].forEach(s => {
    const btn = document.getElementById(`rt-res-btn-${fbId}-${s}`);
    if (!btn) return;
    const sel = s === status;
    btn.style.background   = sel ? '#1a4a1a' : '#0a1a0a';
    btn.style.borderColor  = sel ? '#4ade80' : '#1a3a1a';
    btn.style.color        = sel ? '#4ade80' : '#4a8a4a';
  });
}

async function rtSubmitResolution(fbId) {
  const status = _rtSelectedResolution[fbId];
  if (!status) { alert('Select Keep, Relocate, or Dispose.'); return; }
  const note = document.getElementById('rt-res-note-' + fbId)?.value.trim() || '';
  const resolvedDate = new Date().toISOString().slice(0,10);
  try {
    await db.collection('redTags').doc(fbId).update({
      status,
      resolution: note || `${status} — ${resolvedDate}`,
      resolvedDate,
      resolvedTs: Date.now()
    });
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'RTAG',
        desc: 'Red tag resolved: ' + status + (note ? ' — ' + note : ''),
        tech: 'System', date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}),
        ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
  } catch(e) { alert('Update failed: ' + e.message); }
}

async function rtUpdateStatus(fbId, status) {
  try {
    await db.collection('redTags').doc(fbId).update({ status });
  } catch(e) { alert('Update failed: ' + e.message); }
}

async function rtDelete(fbId) {
  if (!confirm('Remove this red tag permanently?')) return;
  try {
    await db.collection('redTags').doc(fbId).delete();
  } catch(e) { alert('Delete failed: ' + e.message); }
}

// ── Add form ──────────────────────────────────────────────────────────────────
function rtForm() {
  return `
  <div style="display:flex;flex-direction:column;gap:12px;">
    <div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Item / Equipment *</div>
      <input id="rt-item" type="text" placeholder="e.g. Broken feed auger belt, Unused equipment, Leaking hose"
        style="width:100%;box-sizing:border-box;padding:10px;background:#091209;border:1.5px solid #7f1d1d;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Farm</div>
        <select id="rt-farm" style="width:100%;padding:10px;background:#091209;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;">
          <option value="Danville">Danville</option>
          <option value="Hegins">Hegins</option>
        </select>
      </div>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">House #</div>
        <input id="rt-house" type="text" placeholder="1–8 or area"
          style="width:100%;box-sizing:border-box;padding:10px;background:#091209;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
      </div>
    </div>
    <div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Exact Location</div>
      <input id="rt-location" type="text" placeholder="e.g. East wall, Feed room, Storage shed"
        style="width:100%;box-sizing:border-box;padding:10px;background:#091209;border:1.5px solid #1a3a1a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
    </div>
    <div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Category</div>
      <select id="rt-category" style="width:100%;padding:10px;background:#091209;border:1.5px solid #1a3a1a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;">
        <option value="Broken Equipment">Broken Equipment</option>
        <option value="Unnecessary Item">Unnecessary Item</option>
        <option value="Unneeded Inventory">Unneeded Inventory</option>
        <option value="Safety Hazard">Safety Hazard</option>
        <option value="Needs Repair">Needs Repair</option>
        <option value="Unknown Ownership">Unknown Ownership</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Reason for Tag</div>
      <input id="rt-reason" type="text" placeholder="Why is this being tagged?"
        style="width:100%;box-sizing:border-box;padding:10px;background:#091209;border:1.5px solid #1a3a1a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Tagged By</div>
        <input id="rt-by" type="text" placeholder="Your name"
          style="width:100%;box-sizing:border-box;padding:10px;background:#091209;border:1.5px solid #1a3a1a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
      </div>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Date Tagged</div>
        <input id="rt-date" type="date" value="${new Date().toISOString().slice(0,10)}"
          style="width:100%;box-sizing:border-box;padding:10px;background:#091209;border:1.5px solid #1a3a1a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button onclick="rtSave()" style="flex:1;padding:12px;background:#2d0505;border:2px solid #ef4444;border-radius:10px;color:#fca5a5;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:1px;">🏷️ CREATE RED TAG</button>
      <button onclick="rtCloseModal()" style="padding:12px 18px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:10px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">✕</button>
    </div>
  </div>`;
}

function rtOpenForm() {
  const modal = document.getElementById('rt-modal');
  if (modal) modal.style.display = 'flex';
}

function rtCloseModal() {
  const modal = document.getElementById('rt-modal');
  if (modal) modal.style.display = 'none';
}

async function rtSave() {
  const item     = document.getElementById('rt-item')?.value.trim();
  const farm     = document.getElementById('rt-farm')?.value;
  const house    = document.getElementById('rt-house')?.value.trim();
  const location = document.getElementById('rt-location')?.value.trim();
  const category = document.getElementById('rt-category')?.value;
  const reason   = document.getElementById('rt-reason')?.value.trim();
  const taggedBy = document.getElementById('rt-by')?.value.trim();
  const date     = document.getElementById('rt-date')?.value;

  if (!item) { alert('Item description is required.'); return; }

  try {
    await db.collection('redTags').add({
      item, farm, house, location, category, reason, taggedBy, date,
      status: 'Tagged',
      ts: Date.now()
    });
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'RTAG',
        desc: 'Red tag created: ' + item + (farm ? ' — ' + farm : '') + (house ? ' Barn ' + house : '') + ' (' + (category||'') + ')',
        tech: taggedBy || 'System', date: new Date((date||new Date().toISOString().slice(0,10)) + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'}),
        ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
    rtCloseModal();
  } catch(e) { alert('Save failed: ' + e.message); }
}

// ── Filter handlers ───────────────────────────────────────────────────────────
function rtSetFilter(f) { _rtFilter = f; renderRedTags(); }
function rtSetFarm(f)   { _rtFarmFilter = f; renderRedTags(); }

// ── Stat card ─────────────────────────────────────────────────────────────────
function rtStatCard(icon, value, label, bg, color) {
  return `
  <div style="background:${bg};border:1.5px solid ${color}33;border-radius:12px;padding:12px;text-align:center;">
    <div style="font-size:18px;margin-bottom:4px;">${icon}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${color};line-height:1;">${value}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${color};opacity:.7;margin-top:3px;text-transform:uppercase;letter-spacing:1px;">${label}</div>
  </div>`;
}

// ── Mini widget for Daily Report 5S section ───────────────────────────────────
// Shows active red tag count for the farm with link to full tracker
function drRedTagWidget(farm) {
  const farmTags = redTags.filter(t => t.farm === farm && (t.status==='Tagged' || t.status==='Under Review'));
  const overdue  = farmTags.filter(t => t.date && Math.floor((new Date()-new Date(t.date))/86400000) > 7);

  return `
  <div style="background:${farmTags.length>0?'#2d0505':'#0a1f0a'};border:1.5px solid ${farmTags.length>0?'#7f1d1d':'#1a3a1a'};border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;"
    onclick="go('maint');setTimeout(()=>goMaintSection('redtags'),50)">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">🏷️</span>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:${farmTags.length>0?'#fca5a5':'#4ade80'};">
          ${farmTags.length > 0 ? farmTags.length + ' Active Red Tag' + (farmTags.length>1?'s':'') : '✓ No Active Red Tags'}
        </div>
        ${overdue.length > 0 ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#f87171;margin-top:2px;">⏰ ${overdue.length} tag${overdue.length>1?'s':''} open > 7 days</div>` : ''}
      </div>
    </div>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;">View all →</span>
  </div>`;
}
