// ═══════════════════════════════════════════════════════════════════════
// CONTRACTOR TRACKER
// Firebase collection: contractorLog
// Tracks: vendor, job, farm, house, date, cost, in-house flag, notes
// ═══════════════════════════════════════════════════════════════════════

let contractorLog    = [];
let ctFilter         = 'all';   // farm filter
let ctInHouseFilter  = 'all';   // all | yes | no

// ── Listener ─────────────────────────────────────────────────────────────────
function startContractorListener() {
  db.collection('contractorLog').orderBy('ts','desc').limit(300).onSnapshot(snap => {
    contractorLog = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
    if (window._maintSection === 'contractor') renderContractor();
    if (window._maintSection === 'cost')       renderCostDashboard();
  }, err => console.error('contractorLog listener:', err));
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderContractor() {
  const el = document.getElementById('maint-contractor');
  if (!el) return;

  let base = ctFilter === 'all' ? contractorLog : contractorLog.filter(r => r.farm === ctFilter);
  if (ctInHouseFilter === 'yes') base = base.filter(r => r.couldInHouse === 'yes');
  if (ctInHouseFilter === 'no')  base = base.filter(r => r.couldInHouse === 'no');

  const totalCost     = base.reduce((s,r) => s + (Number(r.cost)||0), 0);
  const couldInHouse  = base.filter(r => r.couldInHouse === 'yes');
  const savingsOpp    = couldInHouse.reduce((s,r) => s + (Number(r.cost)||0), 0);
  const thisMonth     = new Date().toISOString().slice(0,7);
  const monthCost     = base.filter(r => (r.date||'').slice(0,7) === thisMonth)
                            .reduce((s,r) => s + (Number(r.cost)||0), 0);

  el.innerHTML = `
    <!-- Stats bar -->
    <div class="stats-grid g4" style="margin-bottom:16px;">
      ${ctStat('💰', '$' + totalCost.toLocaleString(), 'Total Spend', '#1a3a1a', '#4ade80')}
      ${ctStat('📅', '$' + monthCost.toLocaleString(), 'This Month', '#0d2a4a', '#7ab0f6')}
      ${ctStat('⚠️', couldInHouse.length, 'Could Do In-House', '#2d1500', '#fb923c')}
      ${ctStat('💸', '$' + savingsOpp.toLocaleString(), 'Savings Opportunity', '#2d1500', '#fbbf24')}
    </div>

    <!-- Filters -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;">FARM:</span>
      ${['all','Hegins','Danville','Turbotville','Rushtown','W&M'].map(f =>
        `<button class="pill${ctFilter===f?' active':''}" onclick="ctSetFarm('${f}',this)">${f==='all'?'All Farms':f}</button>`
      ).join('')}
      <span style="margin-left:12px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;">IN-HOUSE?:</span>
      <button class="pill${ctInHouseFilter==='all'?' active':''}" onclick="ctSetInHouse('all',this)">All</button>
      <button class="pill${ctInHouseFilter==='yes'?' active':''}" onclick="ctSetInHouse('yes',this)" style="background:${ctInHouseFilter==='yes'?'#92400e':'transparent'};color:${ctInHouseFilter==='yes'?'#fff':'#fb923c'};border-color:#92400e;">⚠ Could Do In-House</button>
      <button class="pill${ctInHouseFilter==='no'?' active':''}" onclick="ctSetInHouse('no',this)">Needed Contractor</button>
    </div>

    <!-- Add button -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
      <button onclick="openContractorForm()" style="padding:9px 20px;background:#1a3a1a;border:2px solid #4ade80;border-radius:8px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">+ LOG CONTRACTOR VISIT</button>
    </div>

    <!-- Log table -->
    ${base.length === 0
      ? `<div style="background:#0a1f0a;border:1px solid #1a3a1a;border-radius:10px;padding:24px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2a5a2a;">No contractor visits logged yet</div>`
      : base.map(r => ctCard(r)).join('')
    }

    <!-- Add/Edit Modal -->
    ${ctFormModal()}
  `;
}

function ctStat(icon, val, lbl, bg, color) {
  return `<div style="background:${bg};border:1.5px solid ${color}33;border-radius:12px;padding:14px 10px;text-align:center;">
    <div style="font-size:18px;margin-bottom:4px;">${icon}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${color};line-height:1;">${val}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${color};opacity:.7;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">${lbl}</div>
  </div>`;
}

function ctCard(r) {
  const inHouse = r.couldInHouse === 'yes';
  const borderColor = inHouse ? '#92400e' : '#1a3a1a';
  const inhouseBadge = inHouse
    ? `<span style="background:#92400e;color:#fbbf24;border-radius:4px;padding:2px 8px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">⚠ COULD DO IN-HOUSE</span>`
    : `<span style="background:#14532d;color:#4ade80;border-radius:4px;padding:2px 8px;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;">✓ NEEDED CONTRACTOR</span>`;

  return `
    <div style="background:#0d1a0d;border:1.5px solid ${borderColor};border-radius:12px;padding:12px 16px;margin-bottom:8px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#e8f5ec;">${r.vendor || 'Unknown Vendor'}</span>
            ${inhouseBadge}
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#a8c8a8;margin-bottom:4px;">${r.job || ''}</div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">📍 ${r.farm}${r.house ? ' · H'+r.house : ''}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">📅 ${r.date || ''}</span>
            ${r.woId ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">🔧 ${r.woId}</span>` : ''}
          </div>
          ${r.notes ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#5a8a5a;margin-top:5px;">${r.notes}</div>` : ''}
          ${inHouse && r.inHousePlan ? `<div style="background:#2d1500;border:1px solid #7c3a00;border-radius:6px;padding:5px 8px;margin-top:6px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#fb923c;">📋 Plan: ${r.inHousePlan}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#4ade80;">$${Number(r.cost||0).toLocaleString()}</div>
          <button onclick="deleteContractorEntry('${r._fbId}')" style="padding:4px 10px;background:#2d0000;border:1px solid #7f1d1d;border-radius:6px;color:#f87171;font-family:'IBM Plex Mono',monospace;font-size:10px;cursor:pointer;">✕ Remove</button>
        </div>
      </div>
    </div>`;
}

function ctFormModal() {
  return `
  <div id="ct-form-modal" style="display:none;position:fixed;inset:0;background:#000b;z-index:9999;align-items:center;justify-content:center;padding:16px;">
    <div style="background:#0f1a0f;border:2px solid #2a5a2a;border-radius:16px;padding:24px;width:100%;max-width:500px;max-height:88vh;overflow-y:auto;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#4ade80;letter-spacing:2px;margin-bottom:18px;">🏗️ LOG CONTRACTOR VISIT</div>
      <div style="display:flex;flex-direction:column;gap:12px;">

        ${ctField('Vendor / Company Name *', 'ct-vendor', 'text', 'e.g. ABC Electrical, Smith HVAC')}
        ${ctField('Job Description *', 'ct-job', 'text', 'What did they do?')}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <div class="ct-lbl">Farm *</div>
            <select id="ct-farm" style="width:100%;padding:10px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;">
              <option value="">— Select —</option>
              <option>Hegins</option><option>Danville</option>
              <option>Turbotville</option><option>Rushtown</option><option>W&M</option>
            </select>
          </div>
          <div>
            <div class="ct-lbl">House / Area</div>
            <input id="ct-house" type="text" placeholder="e.g. H3, Feed Room" style="width:100%;box-sizing:border-box;padding:10px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${ctField('Date *', 'ct-date', 'date', '')}
          ${ctField('Total Cost ($) *', 'ct-cost', 'number', '0.00')}
        </div>

        <div>
          <div class="ct-lbl">Could We Have Done This In-House? *</div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <button id="ct-inh-yes" onclick="ctToggleInHouse('yes')" style="flex:1;padding:10px;background:#0a1a0a;border:2px solid #2a5a2a;border-radius:8px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">⚠ YES — could do in-house</button>
            <button id="ct-inh-no"  onclick="ctToggleInHouse('no')"  style="flex:1;padding:10px;background:#0a1a0a;border:2px solid #2a5a2a;border-radius:8px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">✓ NO — needed contractor</button>
          </div>
          <input type="hidden" id="ct-inhouse-val" value="">
        </div>

        <div id="ct-inhouse-plan-row" style="display:none;">
          ${ctField('Plan to Handle In-House Next Time', 'ct-inhouse-plan', 'text', 'e.g. Train tech on belt alignment by June')}
        </div>

        ${ctField('Linked Work Order # (optional)', 'ct-wo', 'text', 'e.g. WO-042')}
        ${ctField('Notes', 'ct-notes', 'text', 'Any additional context')}
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;">
        <button onclick="saveContractorEntry()" style="flex:1;padding:12px;background:#1a4a1a;border:2px solid #4ade80;border-radius:10px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:1px;">✓ SAVE VISIT</button>
        <button onclick="closeContractorForm()" style="padding:12px 18px;background:#1a0a0a;border:1.5px solid #4a2a2a;border-radius:10px;color:#f87171;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">✕</button>
      </div>
    </div>
  </div>
  <style>
    .ct-lbl { font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:4px;text-transform:uppercase; }
    #ct-inh-yes.ct-active { background:#92400e !important;border-color:#d97706 !important;color:#fbbf24 !important; }
    #ct-inh-no.ct-active  { background:#14532d !important;border-color:#16a34a !important;color:#4ade80 !important; }
  </style>`;
}

function ctField(label, id, type, placeholder) {
  return `<div>
    <div class="ct-lbl">${label}</div>
    <input id="${id}" type="${type}" placeholder="${placeholder}"
      style="width:100%;box-sizing:border-box;padding:10px;background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
  </div>`;
}

// ── Actions ───────────────────────────────────────────────────────────────────
function ctSetFarm(farm, btn) {
  ctFilter = farm;
  renderContractor();
}
function ctSetInHouse(val, btn) {
  ctInHouseFilter = val;
  renderContractor();
}
function openContractorForm() {
  const m = document.getElementById('ct-form-modal');
  if (m) { m.style.display = 'flex'; document.getElementById('ct-date').value = new Date().toISOString().slice(0,10); }
}
function closeContractorForm() {
  const m = document.getElementById('ct-form-modal');
  if (m) m.style.display = 'none';
  ['ct-vendor','ct-job','ct-farm','ct-house','ct-date','ct-cost','ct-wo','ct-notes','ct-inhouse-plan','ct-inhouse-val'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['ct-inh-yes','ct-inh-no'].forEach(id => document.getElementById(id)?.classList.remove('ct-active'));
  const row = document.getElementById('ct-inhouse-plan-row'); if (row) row.style.display = 'none';
}
function ctToggleInHouse(val) {
  document.getElementById('ct-inhouse-val').value = val;
  document.getElementById('ct-inh-yes').classList.toggle('ct-active', val === 'yes');
  document.getElementById('ct-inh-no').classList.toggle('ct-active', val === 'no');
  const row = document.getElementById('ct-inhouse-plan-row');
  if (row) row.style.display = val === 'yes' ? 'block' : 'none';
}
async function saveContractorEntry() {
  const vendor  = document.getElementById('ct-vendor')?.value.trim();
  const job     = document.getElementById('ct-job')?.value.trim();
  const farm    = document.getElementById('ct-farm')?.value;
  const cost    = Number(document.getElementById('ct-cost')?.value) || 0;
  const inhouse = document.getElementById('ct-inhouse-val')?.value;
  if (!vendor || !job || !farm || !inhouse) { alert('Please fill in Vendor, Job, Farm, and In-House selection.'); return; }
  const record = {
    vendor, job, farm,
    house:       document.getElementById('ct-house')?.value.trim() || '',
    date:        document.getElementById('ct-date')?.value || new Date().toISOString().slice(0,10),
    cost,
    couldInHouse: inhouse,
    inHousePlan: document.getElementById('ct-inhouse-plan')?.value.trim() || '',
    woId:        document.getElementById('ct-wo')?.value.trim() || '',
    notes:       document.getElementById('ct-notes')?.value.trim() || '',
    ts:          Date.now(),
    month:       new Date().toISOString().slice(0,7)
  };
  try {
    await db.collection('contractorLog').add(record);
    closeContractorForm();
    // Log activity
    try { await db.collection('activityLog').add({ type:'contractor', action:'Contractor visit logged', farm, desc: vendor + ' — ' + job, cost, ts: Date.now(), date: record.date }); } catch(e) {}
  } catch(e) { alert('Error saving: ' + e.message); console.error(e); }
}
async function deleteContractorEntry(fbId) {
  if (!confirm('Remove this contractor entry?')) return;
  try { await db.collection('contractorLog').doc(fbId).delete(); } catch(e) { console.error(e); }
}
