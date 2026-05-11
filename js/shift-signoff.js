// ═══════════════════════════════════════════════════════════════════════
// SHIFT SIGN-OFF
// Firebase collection: shiftSignoffs  (doc id: farm-YYYY-MM-DD)
// Barn leader signs off at end of shift — creates accountable daily record
// Shows in Director's Brief as signed/unsigned status per farm
// ═══════════════════════════════════════════════════════════════════════

let _ssSignoffs = {};   // { 'Danville-2026-04-14': {...}, ... }
let _ssListening = false;

// ── Listener (called from initApp) ───────────────────────────────────────────
function startSignoffListener() {
  if (_ssListening) return;
  _ssListening = true;
  const today = new Date().toISOString().slice(0,10);
  db.collection('shiftSignoffs').where('date','==',today).onSnapshot(snap => {
    _ssSignoffs = {};                                          // ← drop stale entries (deletes & yesterday)
    snap.docs.forEach(d => { _ssSignoffs[d.id] = d.data(); });
    // Refresh Director's Brief badge if open
    if (document.getElementById('panel-brief')?.classList.contains('active')) dbRender();
    // Update landing badge
    updateBriefBadge();
  });
}

// ── Get today's signoff for a farm ───────────────────────────────────────────
function ssGetToday(farm) {
  const today = new Date().toISOString().slice(0,10);
  return _ssSignoffs[farm + '-' + today] || null;
}

// ── Sign-off panel rendered at bottom of Daily Report ────────────────────────
function drSignoffPanel(farm) {
  const existing = ssGetToday(farm);
  const today = new Date().toISOString().slice(0,10);

  if (existing) {
    return `
    <div style="background:#0a2a0a;border:2px solid #166534;border-radius:14px;padding:16px 18px;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <span style="font-size:24px;">✅</span>
        <div style="flex:1;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;color:#4ade80;">SHIFT SIGNED OFF</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a8a2a;margin-top:3px;">
            ${existing.barnLeader} · ${existing.time || ''} · ${existing.openIssues?.length || 0} issue(s) carried forward
          </div>
        </div>
        <button onclick="ssEdit('${farm}')" style="padding:6px 12px;background:#0a1a0a;border:1px solid #2a5a2a;border-radius:6px;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;">Edit</button>
      </div>
      ${existing.notes ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;margin-top:10px;padding-top:10px;border-top:1px solid #1a3a1a;">📝 ${existing.notes}</div>` : ''}

      ${existing.labor?.totalHours > 0 ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #1a3a1a;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4ade80;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">👷 Labor — ${existing.labor.totalHours}h · $${existing.labor.totalCost} total</div>
          ${(existing.labor.rows||[]).map(r => `
            <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;padding:2px 0;display:flex;gap:10px;">
              <span style="color:#c8e6c9;font-weight:700;">${r.name}</span>
              <span style="color:#4ade80;">${r.hours}h</span>
              ${r.task ? `<span style="color:#4a8a4a;">${r.task}</span>` : ''}
            </div>`).join('')}
        </div>` : ''}

      ${existing.tomorrow?.focus ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #1a3a1a;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7ab0f6;letter-spacing:1px;margin-bottom:4px;text-transform:uppercase;">📅 Tomorrow</div>
          ${existing.tomorrow.crew ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a7ab0;margin-bottom:4px;">👥 ${existing.tomorrow.crew}</div>` : ''}
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab0f6;font-weight:700;">🎯 ${existing.tomorrow.focus}</div>
          ${existing.tomorrow.partsToOrder?.length > 0 ? `
            <div style="margin-top:6px;">${existing.tomorrow.partsToOrder.map(p=>`<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#fbbf24;">📦 ${p}</div>`).join('')}</div>` : ''}
        </div>` : ''}

      ${existing.openIssues && existing.openIssues.length > 0 ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #1a3a1a;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#fbbf24;letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">⚑ Carrying forward to next shift:</div>
          ${existing.openIssues.map(issue => `
            <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#fde68a;padding:3px 0;display:flex;gap:8px;align-items:flex-start;">
              <span>•</span><span>${issue}</span>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
  }

  // Build summary stats for the sign-off form
  const farms = { Danville:5, Hegins:8 };
  const houseCount = farms[farm] || 5;
  const walked = Array.from({length:houseCount},(_,i)=>i+1)
    .filter(h => _drMorningWalks?.find(w => w.farm===farm && String(w.house)===String(h))).length;
  const deadTotal = (_drBarnWalks||[])
    .filter(w => w.farm===farm)
    .reduce((s,w) => s + Number(w.mortCount||0), 0);
  const openWOs = (workOrders||[]).filter(w => w.farm===farm && w.status!=='completed').length;
  const audit5s = _dr5SAudits?.[farm];
  const pmDone = typeof ALL_PM!=='undefined' ? ALL_PM.filter(t => {
    const c = pmComps?.[t.id];
    return c && c.date === today && (!t.farm || t.farm===farm || t.farm==='Both');
  }).length : 0;

  return `
  <div id="ss-form-${farm}" style="background:#0a1a0a;border:2px solid #2a5a2a;border-radius:14px;padding:16px 18px;">
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#c8e6c9;margin-bottom:14px;">END-OF-SHIFT SIGN-OFF — ${farm.toUpperCase()}</div>

    <!-- Day summary (auto-pulled) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:7px;margin-bottom:16px;">
      ${ssSummaryTile('🏠', walked+'/'+houseCount, 'Houses Walked', walked===houseCount?'#4ade80':'#fbbf24')}
      ${ssSummaryTile('💀', deadTotal, 'Dead Birds', deadTotal>30?'#f87171':deadTotal>10?'#fbbf24':'#4ade80')}
      ${ssSummaryTile('🔧', openWOs, 'Open WOs', openWOs===0?'#4ade80':openWOs>5?'#f87171':'#fbbf24')}
      ${ssSummaryTile('📋', pmDone, 'PMs Done', pmDone>0?'#4ade80':'#fbbf24')}
      ${audit5s ? ssSummaryTile('5️⃣', audit5s.total+'/'+audit5s.max, '5S Score', audit5s.total>=20?'#4ade80':audit5s.total>=14?'#fbbf24':'#f87171') : ssSummaryTile('5️⃣', '—', '5S Score', '#4a8a4a')}
    </div>

    <!-- Shift leader -->
    <div style="margin-bottom:12px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Barn Leader / Shift Lead *</div>
      <input id="ss-leader-${farm}" type="text" placeholder="Your name"
        style="width:100%;box-sizing:border-box;padding:10px;background:#091209;border:1.5px solid #2a5a2a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;" />
    </div>

    <!-- Issues to carry forward -->
    <div style="margin-bottom:12px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Issues / Carry-Forwards for Next Shift</div>
      <div id="ss-issues-list-${farm}" style="margin-bottom:6px;"></div>
      <div style="display:flex;gap:7px;">
        <input id="ss-issue-input-${farm}" type="text" placeholder="e.g. H3 fan belt making noise — needs follow up"
          style="flex:1;padding:9px;background:#091209;border:1.5px solid #1a3a1a;border-radius:7px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;"
          onkeydown="if(event.key==='Enter')ssAddIssue('${farm}')" />
        <button onclick="ssAddIssue('${farm}')" style="padding:8px 12px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:7px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;">+ Add</button>
      </div>
    </div>

    <!-- Confirmations -->
    <div style="margin-bottom:14px;display:flex;flex-direction:column;gap:7px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:2px;text-transform:uppercase;">Confirm before sign-off:</div>
      ${ssCheckbox(`ss-chk-walks-${farm}`, 'All house walks completed (or incomplete walks documented)')}
      ${ssCheckbox(`ss-chk-water-${farm}`, 'Water systems checked — no leaks or pressure issues')}
      ${ssCheckbox(`ss-chk-feed-${farm}`, 'Feed bins checked — levels adequate for next shift')}
      ${ssCheckbox(`ss-chk-dead-${farm}`, 'Dead bird count recorded and birds removed')}
      ${ssCheckbox(`ss-chk-clean-${farm}`, 'Work area cleaned and tools returned')}
    </div>

    <!-- ── LABOR TRACKING ── -->
    <div style="margin-bottom:16px;background:#080f08;border:1.5px solid #1a4a1a;border-radius:12px;padding:14px 14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4ade80;letter-spacing:1px;text-transform:uppercase;">👷 Labor Tracking</div>
        <button onclick="ssAddLaborRow('${farm}')"
          style="padding:5px 12px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:6px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;">+ Add Person</button>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a5a2a;margin-bottom:8px;">Name · Hours · WO# or what they worked on</div>
      <div id="ss-labor-rows-${farm}">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#2a5a2a;padding:8px 0;text-align:center;">No crew added yet — tap + Add Person</div>
      </div>
      <div id="ss-labor-cost-${farm}" style="font-family:'IBM Plex Mono',monospace;font-size:11px;margin-top:8px;padding-top:8px;border-top:1px solid #1a3a1a;text-align:right;min-height:18px;"></div>
    </div>

    <!-- ── TOMORROW PLANNING ── -->
    <div style="margin-bottom:16px;background:#0a0d1a;border:1.5px solid #1e3a6a;border-radius:12px;padding:14px 14px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7ab0f6;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">📅 Tomorrow Planning</div>

      <!-- Who's on tomorrow -->
      <div style="margin-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a7ab0;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Who's on tomorrow's shift?</div>
        <input id="ss-tomorrow-crew-${farm}" type="text" placeholder="e.g. Mike, Dave, Chris"
          style="width:100%;box-sizing:border-box;padding:9px;background:#080d1a;border:1.5px solid #1e3a6a;border-radius:7px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;" />
      </div>

      <!-- #1 Priority for next shift -->
      <div style="margin-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a7ab0;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">#1 Priority for Next Shift</div>
        <input id="ss-tomorrow-focus-${farm}" type="text" placeholder="e.g. Get H4 fan replaced before 7am"
          style="width:100%;box-sizing:border-box;padding:9px;background:#080d1a;border:1.5px solid #1e3a6a;border-radius:7px;color:#7ab0f6;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;outline:none;" />
      </div>

      <!-- Parts to order -->
      <div style="margin-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a7ab0;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Parts to Order</div>
        <div id="ss-parts-list-${farm}" style="margin-bottom:6px;"></div>
        <div style="display:flex;gap:7px;">
          <input id="ss-part-input-${farm}" type="text" placeholder="e.g. Fan belt H3 — 1/2 inch"
            style="flex:1;padding:8px;background:#080d1a;border:1.5px solid #1e3a6a;border-radius:7px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;min-width:0;"
            onkeydown="if(event.key==='Enter')ssAddPart('${farm}')" />
          <button onclick="ssAddPart('${farm}')" style="padding:7px 12px;background:#0d1f3a;border:1.5px solid #3b82f6;border-radius:7px;color:#7ab0f6;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0;">+ Add</button>
        </div>
      </div>

      <!-- Auto-pulled: PMs due tomorrow -->
      ${(() => {
        const pms = ssTomorrowPMs(farm);
        if (!pms.length) return '';
        return `
        <div style="margin-bottom:8px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#fbbf24;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">⏰ PMs Due / Overdue (auto-pulled)</div>
          ${pms.map(t => `
            <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#fde68a;padding:3px 0;display:flex;gap:6px;">
              <span>📋</span><span>${t.name}${t.area?' · '+t.area:''}</span>
            </div>`).join('')}
        </div>`;
      })()}

      <!-- Auto-pulled: urgent/high WOs -->
      ${(() => {
        const wos = ssTomorrowWOs(farm);
        if (!wos.length) return '';
        return `
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#f87171;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">🔧 Open Priority WOs</div>
          ${wos.map(w => `
            <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#fca5a5;padding:3px 0;display:flex;gap:6px;">
              <span>${w.priority==='urgent'?'🚨':'⚠'}</span><span>${w.id} — ${(w.desc||w.problem||'').slice(0,55)}</span>
            </div>`).join('')}
        </div>`;
      })()}
    </div>

    <!-- Notes -->
    <div style="margin-bottom:16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Additional Notes (optional)</div>
      <textarea id="ss-notes-${farm}" rows="2" placeholder="Anything else the next shift should know..."
        style="width:100%;box-sizing:border-box;padding:10px;background:#091209;border:1.5px solid #1a3a1a;border-radius:8px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;resize:vertical;"></textarea>
    </div>

    <button onclick="ssSubmit('${farm}')"
      style="width:100%;padding:14px;background:#1a4a1a;border:2px solid #4ade80;border-radius:10px;color:#4ade80;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;cursor:pointer;">
      ✓ SIGN OFF SHIFT
    </button>
  </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ssSummaryTile(icon, value, label, color) {
  return `
  <div style="background:#091209;border:1px solid #1a3a1a;border-radius:8px;padding:8px;text-align:center;">
    <div style="font-size:14px;margin-bottom:2px;">${icon}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:${color};line-height:1;">${value}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a8a4a;margin-top:2px;text-transform:uppercase;">${label}</div>
  </div>`;
}

function ssCheckbox(id, label) {
  // Plain div with explicit click handler — no <label for=> double-toggle, no native quirks.
  return `
  <div onclick="ssChkToggle('${id}')" id="${id}-row" style="display:flex;align-items:flex-start;gap:9px;cursor:pointer;padding:8px 8px;background:#080f08;border:1px solid #1a3a1a;border-radius:6px;-webkit-tap-highlight-color:rgba(74,222,128,.25);">
    <span id="${id}-box" style="display:inline-block;width:20px;height:20px;border:2px solid #2a5a2a;border-radius:4px;background:#000;flex-shrink:0;margin-top:1px;text-align:center;line-height:18px;color:#4ade80;font-weight:700;font-size:14px;"></span>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;line-height:1.5;user-select:none;">${label}</span>
    <input type="checkbox" id="${id}" style="display:none;" />
  </div>`;
}

// Toggle using the hidden checkbox + a custom box span for visual state.
function ssChkToggle(id) {
  const cb = document.getElementById(id);
  const box = document.getElementById(id + '-box');
  const row = document.getElementById(id + '-row');
  if (!cb) return;
  cb.checked = !cb.checked;
  if (box) {
    box.textContent = cb.checked ? '✓' : '';
    box.style.background = cb.checked ? '#1a3a1a' : '#000';
    box.style.borderColor = cb.checked ? '#4ade80' : '#2a5a2a';
  }
  if (row) {
    row.style.background = cb.checked ? '#0d2a0d' : '#080f08';
    row.style.borderColor = cb.checked ? '#2a5a2a' : '#1a3a1a';
  }
  cb.dispatchEvent(new Event('change', {bubbles:true}));
}
window.ssChkToggle = ssChkToggle;

// Temporary issue list per farm
const _ssIssueList  = {};
const _ssLaborRows  = {};   // { farm: [{name, hours, task}] }
const SS_LABOR_RATE = 30;   // $/hr — matches core cost constant

// ── Labor row helpers ─────────────────────────────────────────────────────────
function ssAddLaborRow(farm) {
  if (!_ssLaborRows[farm]) _ssLaborRows[farm] = [];
  _ssLaborRows[farm].push({ name: '', hours: '', task: '' });
  ssRenderLaborRows(farm);
}

function ssRemoveLaborRow(farm, idx) {
  if (_ssLaborRows[farm]) _ssLaborRows[farm].splice(idx, 1);
  ssRenderLaborRows(farm);
}

function ssUpdateLaborRow(farm, idx, field, val) {
  if (!_ssLaborRows[farm]?.[idx]) return;
  _ssLaborRows[farm][idx][field] = val;
  // Update cost display
  const rows = _ssLaborRows[farm] || [];
  const totalHrs  = rows.reduce((s,r) => s + (Number(r.hours)||0), 0);
  const totalCost = totalHrs * SS_LABOR_RATE;
  const costEl = document.getElementById('ss-labor-cost-' + farm);
  if (costEl) costEl.innerHTML = `
    <span style="color:#7ab07a;">${totalHrs.toFixed(1)} hrs</span>
    <span style="color:#4a8a4a;margin:0 6px;">·</span>
    <span style="color:#4ade80;font-weight:700;">$${totalCost.toFixed(0)} labor</span>
    <span style="color:#4a8a4a;margin:0 6px;">·</span>
    <span style="color:#4a8a4a;">@ $${SS_LABOR_RATE}/hr</span>
  `;
}

function ssRenderLaborRows(farm) {
  const container = document.getElementById('ss-labor-rows-' + farm);
  if (!container) return;
  const rows = _ssLaborRows[farm] || [];
  container.innerHTML = rows.length === 0
    ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#2a5a2a;padding:8px 0;text-align:center;">No crew added yet — tap + Add Person</div>`
    : rows.map((r, i) => `
      <div style="display:grid;grid-template-columns:1fr 70px 1fr auto;gap:6px;align-items:center;margin-bottom:6px;">
        <input type="text" placeholder="Name" value="${r.name}"
          oninput="ssUpdateLaborRow('${farm}',${i},'name',this.value)"
          style="padding:8px;background:#091209;border:1.5px solid #1a3a1a;border-radius:7px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;min-width:0;" />
        <input type="number" placeholder="Hrs" value="${r.hours}" min="0" max="24" step="0.5"
          oninput="ssUpdateLaborRow('${farm}',${i},'hours',this.value)"
          style="padding:8px;background:#091209;border:1.5px solid #1a3a1a;border-radius:7px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;outline:none;text-align:center;min-width:0;" />
        <input type="text" placeholder="WO# or task" value="${r.task}"
          oninput="ssUpdateLaborRow('${farm}',${i},'task',this.value)"
          style="padding:8px;background:#091209;border:1.5px solid #1a3a1a;border-radius:7px;color:#c8e6c9;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;min-width:0;" />
        <button onclick="ssRemoveLaborRow('${farm}',${i})"
          style="background:none;border:none;color:#f87171;font-size:14px;cursor:pointer;padding:4px 6px;flex-shrink:0;">✕</button>
      </div>`).join('');
  ssUpdateLaborRow(farm, -1, '', ''); // refresh total
}

// ── Tomorrow planning helpers ─────────────────────────────────────────────────
const _ssPartsNeeded = {};

function ssAddPart(farm) {
  const inp = document.getElementById('ss-part-input-' + farm);
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  if (!_ssPartsNeeded[farm]) _ssPartsNeeded[farm] = [];
  _ssPartsNeeded[farm].push(val);
  inp.value = '';
  ssRenderParts(farm);
}

function ssRemovePart(farm, idx) {
  if (_ssPartsNeeded[farm]) _ssPartsNeeded[farm].splice(idx, 1);
  ssRenderParts(farm);
}

function ssRenderParts(farm) {
  const container = document.getElementById('ss-parts-list-' + farm);
  if (!container) return;
  const items = _ssPartsNeeded[farm] || [];
  container.innerHTML = items.length === 0 ? '' : items.map((p, i) => `
    <div style="display:flex;align-items:center;gap:8px;background:#1a1000;border:1px solid #854d0e;border-radius:6px;padding:5px 10px;margin-bottom:4px;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#fde68a;flex:1;">📦 ${p}</span>
      <button onclick="ssRemovePart('${farm}',${i})" style="background:none;border:none;color:#f87171;font-size:11px;cursor:pointer;padding:0 2px;">✕</button>
    </div>`).join('');
}

// ── Auto-pull tomorrows PMs ───────────────────────────────────────────────────
function ssTomorrowPMs(farm) {
  if (typeof ALL_PM === 'undefined' || !ALL_PM) return [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tStr = tomorrow.toISOString().slice(0,10);
  return (ALL_PM || []).filter(t => {
    if (t.farm && t.farm !== farm && t.farm !== 'Both') return false;
    const s = typeof pmStatus === 'function' ? pmStatus(t.id) : 'ok';
    return s === 'due-soon' || s === 'overdue';
  }).slice(0, 6);
}

// ── Auto-pull priority WOs for tomorrow ──────────────────────────────────────
function ssTomorrowWOs(farm) {
  return (workOrders || [])
    .filter(w => w.farm === farm && w.status !== 'completed' && (w.priority === 'urgent' || w.priority === 'high'))
    .slice(0, 5);
}

function ssAddIssue(farm) {
  const inp = document.getElementById('ss-issue-input-' + farm);
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  if (!_ssIssueList[farm]) _ssIssueList[farm] = [];
  _ssIssueList[farm].push(val);
  inp.value = '';
  ssRenderIssues(farm);
}

function ssRemoveIssue(farm, idx) {
  if (_ssIssueList[farm]) _ssIssueList[farm].splice(idx, 1);
  ssRenderIssues(farm);
}

function ssRenderIssues(farm) {
  const container = document.getElementById('ss-issues-list-' + farm);
  if (!container) return;
  const items = _ssIssueList[farm] || [];
  container.innerHTML = items.map((issue, i) => `
    <div style="display:flex;align-items:center;gap:8px;background:#1a1a00;border:1px solid #854d0e;border-radius:6px;padding:6px 10px;margin-bottom:5px;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#fde68a;flex:1;">⚑ ${issue}</span>
      <button onclick="ssRemoveIssue('${farm}',${i})" style="background:none;border:none;color:#f87171;font-size:12px;cursor:pointer;padding:0 3px;">✕</button>
    </div>`).join('');
}

async function ssSubmit(farm) {
  const leader = document.getElementById('ss-leader-' + farm)?.value.trim();
  if (!leader) { alert('Please enter your name before signing off.'); return; }

  const today  = new Date().toISOString().slice(0,10);
  const time   = new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
  const issues = _ssIssueList[farm] || [];

  // Collect checkboxes
  const checks = {
    walks: document.getElementById('ss-chk-walks-' + farm)?.checked || false,
    water: document.getElementById('ss-chk-water-' + farm)?.checked || false,
    feed:  document.getElementById('ss-chk-feed-' + farm)?.checked || false,
    dead:  document.getElementById('ss-chk-dead-' + farm)?.checked || false,
    clean: document.getElementById('ss-chk-clean-' + farm)?.checked || false
  };
  const notes = document.getElementById('ss-notes-' + farm)?.value.trim() || '';

  // Labor tracking
  const laborRows = (_ssLaborRows[farm] || []).filter(r => r.name || r.hours);
  const totalLaborHrs  = laborRows.reduce((s,r) => s + (Number(r.hours)||0), 0);
  const totalLaborCost = totalLaborHrs * SS_LABOR_RATE;

  // Tomorrow planning
  const tomorrowCrew  = document.getElementById('ss-tomorrow-crew-' + farm)?.value.trim() || '';
  const tomorrowFocus = document.getElementById('ss-tomorrow-focus-' + farm)?.value.trim() || '';
  const partsToOrder  = _ssPartsNeeded[farm] || [];

  // Snapshot of the day's stats
  const houseCount = farm === 'Hegins' ? 8 : 5;
  const walksToday = (_drMorningWalks||[]).filter(w => w.farm===farm).length;
  const deadToday  = (_drBarnWalks||[]).filter(w=>w.farm===farm).reduce((s,w)=>s+Number(w.mortCount||0),0);
  const openWOs    = (workOrders||[]).filter(w=>w.farm===farm&&w.status!=='completed').length;
  const audit5s    = _dr5SAudits?.[farm] || null;

  const docId = farm + '-' + today;
  const record = {
    farm, date: today, time,
    barnLeader: leader,
    openIssues: issues,
    checks, notes,
    labor: { rows: laborRows, totalHours: totalLaborHrs, totalCost: totalLaborCost },
    tomorrow: { crew: tomorrowCrew, focus: tomorrowFocus, partsToOrder },
    stats: { walksToday, houseCount, deadToday, openWOs, audit5sScore: audit5s?.total || null },
    ts: Date.now()
  };

  try {
    await db.collection('shiftSignoffs').doc(docId).set(record);
    _ssSignoffs[docId] = record;
    _ssIssueList[farm]  = [];
    _ssLaborRows[farm]  = [];
    _ssPartsNeeded[farm] = [];
    // Re-render the sign-off section
    const container = document.getElementById('dr-signoff-' + farm);
    if (container) container.innerHTML = drSignoffPanel(farm);
    // Log to activity
    try {
      await db.collection('activityLog').add({
        type: 'wo', id: 'SS',
        desc: 'Shift signed off — ' + farm + ' by ' + leader + (issues.length ? ' · ' + issues.length + ' carry-forward' + (issues.length !== 1 ? 's' : '') : ''),
        tech: leader, date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'}),
        ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
  } catch(e) {
    alert('Sign-off failed: ' + e.message);
  }
}

function ssEdit(farm) {
  const today = new Date().toISOString().slice(0,10);
  delete _ssSignoffs[farm + '-' + today];
  const container = document.getElementById('dr-signoff-' + farm);
  if (container) container.innerHTML = drSignoffPanel(farm);
}

// ── Sign-off status for Director's Brief ─────────────────────────────────────
function ssStatus(farm) {
  const rec = ssGetToday(farm);
  if (!rec) return { signed: false, label: 'NOT SIGNED OFF', color: '#f87171', bg: '#2d0505' };
  return { signed: true, label: 'SIGNED OFF · ' + rec.barnLeader + ' @ ' + (rec.time||''), color: '#4ade80', bg: '#0a2a0a' };
}
