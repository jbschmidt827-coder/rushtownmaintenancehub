// SHIPPING SUB-NAV
// ═══════════════════════════════════════════
window._shipSection = 'shipping';
function goShipSection(section) {
  window._shipSection = section;
  document.querySelectorAll('.ship-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('#panel-ship .sub-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('ship-' + section);
  if (el) el.style.display = 'block';
  document.querySelectorAll('#panel-ship .sub-btn').forEach(b => {
    if (b.dataset.section === section) b.classList.add('active');
  });
  updateOpsExcBadge();
  if (section === 'shipping') renderShipping();
  if (section === 'farms') renderFarms();
  if (section === 'reconciliation') renderReconciliation();
  if (section === 'exceptions') renderExceptions();
}

// ═══════════════════════════════════════════
// FARMS DIRECTORY
// ═══════════════════════════════════════════
function initShipFarmDropdown() {
  const sel = document.getElementById('sf-customer');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select Farm —</option>' +
    LAYER_FARMS.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
}

function onShipFarmSelect() {
  const name = document.getElementById('sf-customer').value;
  const panel = document.getElementById('sf-farm-info');
  if (!name) { panel.style.display = 'none'; return; }
  const f = LAYER_FARMS.find(x => x.name === name);
  if (!f) { panel.style.display = 'none'; return; }
  const contacts = f.contacts.map(c => `<span style="margin-right:14px;">📞 <b>${c.name}</b>: <a href="tel:${c.phone}" style="color:#2e7d32;text-decoration:none;">${c.phone}</a></span>`).join('');
  const email = f.email ? `<br>✉️ <a href="mailto:${f.email}" style="color:#2e7d32;">${f.email}</a>` : '';
  panel.innerHTML = `
    <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#1b5e20;">${f.name} <span style="font-weight:400;color:#666;font-size:11px;">(${f.owner})</span></div>
    <div style="color:#444;margin-bottom:4px;">📍 ${f.address}</div>
    <div style="margin-bottom:4px;">${contacts}${email}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#555;margin-top:4px;">
      ${f.stateId ? `<span>State ID: <b>${f.stateId}</b></span>` : ''}
      ${f.fedId   ? `<span>Fed ID: <b>${f.fedId}</b></span>`     : ''}
      ${f.npip    ? `<span>NPIP: <b>${f.npip}</b></span>`        : ''}
      ${f.doorCode && f.doorCode !== 'N/A' ? `<span style="color:#9b59b6;">🔑 Door: <b>${f.doorCode}</b></span>` : ''}
    </div>`;
  panel.style.display = 'block';
}

function renderFarms() {
  const q = (document.getElementById('farm-search')?.value || '').toLowerCase();
  const ownerFilter = document.getElementById('farm-owner-filter')?.value || '';
  const rlOwners = ['R&L','RTP','Rushtown'];

  let farms = LAYER_FARMS.filter(f => {
    if (ownerFilter === 'independent') {
      if (rlOwners.includes(f.owner)) return false;
    } else if (ownerFilter && !f.owner.includes(ownerFilter)) return false;
    if (!q) return true;
    return [f.name, f.address, f.owner, f.npip, f.fedId, f.stateId,
            ...f.contacts.map(c => c.name + ' ' + c.phone), f.email]
      .join(' ').toLowerCase().includes(q);
  });

  // Stats
  document.getElementById('farm-dir-stats').innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
      <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:8px;padding:6px 14px;font-size:12px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:#2e7d32;">${farms.length} FARMS</div>
      <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:8px;padding:6px 14px;font-size:12px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:#6a1b9a;">${farms.filter(f=>rlOwners.includes(f.owner)).length} R&L / RTP</div>
      <div style="background:#fff3e0;border:1px solid #ffcc80;border-radius:8px;padding:6px 14px;font-size:12px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:#e65100;">${farms.filter(f=>!rlOwners.includes(f.owner)).length} INDEPENDENT</div>
    </div>`;

  if (!farms.length) {
    document.getElementById('farm-dir-list').innerHTML = `<div style="text-align:center;padding:40px;color:#999;font-family:'IBM Plex Mono',monospace;">No farms match your search.</div>`;
    return;
  }

  document.getElementById('farm-dir-list').innerHTML = farms.map(f => {
    const ownerBadge = rlOwners.includes(f.owner)
      ? `<span style="background:#e8f5e9;color:#2e7d32;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;">${f.owner}</span>`
      : `<span style="background:#fff3e0;color:#e65100;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;">${f.owner}</span>`;
    const contacts = f.contacts.map(c =>
      `<a href="tel:${c.phone}" style="display:inline-block;margin:2px 6px 2px 0;color:#1976d2;font-size:12px;text-decoration:none;">📞 ${c.name}${c.phone ? ': ' + c.phone : ''}</a>`
    ).join('');
    const email = f.email ? `<a href="mailto:${f.email}" style="display:inline-block;margin:2px 6px 2px 0;color:#666;font-size:11px;">✉️ ${f.email}</a>` : '';
    const ids = [
      f.stateId ? `State: ${f.stateId}` : '',
      f.fedId   ? `Fed: ${f.fedId}`   : '',
      f.npip    ? `NPIP: ${f.npip}`   : '',
    ].filter(Boolean).join(' · ');
    const door = f.doorCode && f.doorCode !== 'N/A' && f.doorCode
      ? `<span style="background:#f3e5f5;color:#6a1b9a;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:6px;">🔑 ${f.doorCode}</span>` : '';

    return `<div onclick="openFarmDetail('${f.name.replace(/'/g,"\\'")}')" style="background:#fff;border:1.5px solid #e0e0e0;border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor='#4caf50'" onmouseout="this.style.borderColor='#e0e0e0'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div style="font-weight:700;font-size:15px;color:#111;">${f.name} ${ownerBadge}${door}</div>
        <div style="font-size:11px;color:#999;font-family:'IBM Plex Mono',monospace;">›</div>
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:6px;">📍 ${f.address}</div>
      <div style="margin-bottom:4px;">${contacts}${email}</div>
      ${ids ? `<div style="font-size:11px;color:#888;margin-top:4px;font-family:'IBM Plex Mono',monospace;">${ids}</div>` : ''}
    </div>`;
  }).join('');
}

function openFarmDetail(name) {
  const f = LAYER_FARMS.find(x => x.name === name);
  if (!f) return;
  const rlOwners = ['R&L','RTP','Rushtown'];
  const ownerColor = rlOwners.includes(f.owner) ? '#2e7d32' : '#e65100';
  const contacts = f.contacts.map(c =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0;">
       <span style="font-weight:600;">${c.name}</span>
       ${c.phone ? `<a href="tel:${c.phone}" style="color:#1976d2;font-weight:700;text-decoration:none;">${c.phone}</a>` : '<span style="color:#999;">—</span>'}
     </div>`
  ).join('');

  document.getElementById('farm-detail-card').innerHTML = `
    <button onclick="closeFarmDetail()" style="position:absolute;top:14px;right:14px;background:#f5f5f5;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;font-weight:700;color:#555;">✕</button>
    <div style="font-size:22px;font-weight:800;color:#111;margin-bottom:4px;">${f.name}</div>
    <div style="font-size:12px;font-weight:700;color:${ownerColor};margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">Owned by ${f.owner}</div>
    <div style="background:#f9f9f9;border-radius:10px;padding:12px 14px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Address</div>
      <div style="font-size:14px;color:#333;">📍 ${f.address}</div>
      <a href="https://maps.google.com/?q=${encodeURIComponent(f.address)}" target="_blank" style="display:inline-block;margin-top:8px;font-size:12px;color:#1976d2;">Open in Maps →</a>
    </div>
    <div style="background:#f9f9f9;border-radius:10px;padding:12px 14px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Contacts</div>
      ${contacts}
      ${f.email ? `<div style="padding:8px 0;"><a href="mailto:${f.email}" style="color:#555;font-size:12px;">✉️ ${f.email}</a></div>` : ''}
    </div>
    <div style="background:#f9f9f9;border-radius:10px;padding:12px 14px;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">IDs & Codes</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div><div style="font-size:10px;color:#999;">State ID</div><div style="font-weight:700;">${f.stateId || '—'}</div></div>
        <div><div style="font-size:10px;color:#999;">Federal ID</div><div style="font-weight:700;">${f.fedId || '—'}</div></div>
        <div><div style="font-size:10px;color:#999;">NPIP #</div><div style="font-weight:700;">${f.npip || '—'}</div></div>
        <div><div style="font-size:10px;color:#999;">Door Code</div><div style="font-weight:700;color:#6a1b9a;">${f.doorCode || '—'}</div></div>
      </div>
    </div>
    <button onclick="startLoadFromFarm('${f.name.replace(/'/g,"\\'")}');closeFarmDetail();" style="width:100%;padding:14px;background:#4caf50;color:#fff;border:none;border-radius:10px;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:1px;">🚛 CREATE LOAD FOR THIS FARM</button>`;

  const overlay = document.getElementById('farm-detail-overlay');
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) closeFarmDetail(); };
}

function closeFarmDetail() {
  document.getElementById('farm-detail-overlay').style.display = 'none';
}

function startLoadFromFarm(name) {
  goShipSection('shipping');
  const panel = document.getElementById('ship-form-panel');
  if (panel.style.display === 'none') toggleShipForm();
  setTimeout(() => {
    const sel = document.getElementById('sf-customer');
    if (sel) { sel.value = name; onShipFarmSelect(); }
    document.getElementById('sf-date').value = new Date().toISOString().slice(0,10);
  }, 100);
}

// ═══════════════════════════════════════════
