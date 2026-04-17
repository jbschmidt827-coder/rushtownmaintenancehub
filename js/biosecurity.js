// BIOSECURITY
// ═══════════════════════════════════════════
let bioLog = [];

async function loadBioLog() {
  try {
    const snap = await db.collection('biosecurityLog').orderBy('ts','desc').limit(300).get();
    bioLog = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
    db.collection('biosecurityLog').orderBy('ts','desc').limit(300).onSnapshot(snap => {
      bioLog = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
    });
  } catch(e) { console.warn('loadBioLog:', e.message); }
}

function openBioSection() {
  document.getElementById('bio-section').style.display = 'block';
  const today = new Date().toISOString().slice(0,10);
  if (!document.getElementById('bio-date').value) document.getElementById('bio-date').value = today;
  if (!document.getElementById('bio-filter-date').value) document.getElementById('bio-filter-date').value = today;
  renderBioLog();
}

function closeBioSection() {
  document.getElementById('bio-section').style.display = 'none';
}

async function saveBioEntry() {
  const date = document.getElementById('bio-date').value;
  const farm = document.getElementById('bio-farm').value;
  const type = document.getElementById('bio-type').value;
  const person = document.getElementById('bio-person').value.trim();
  const risk = document.getElementById('bio-risk').value;
  if (!date || !farm || !type || !person) { alert(t('bio.required')); return; }
  const measures = {
    footbath: document.getElementById('bio-footbath').checked,
    coveralls: document.getElementById('bio-coveralls').checked,
    bootCovers: document.getElementById('bio-bootcovers').checked,
    vehicleDisinfected: document.getElementById('bio-vehicle').checked,
    handWash: document.getElementById('bio-handwash').checked,
    noPoultryContact7d: document.getElementById('bio-nopoultrylast7').checked
  };
  const measureCount = Object.values(measures).filter(Boolean).length;
  const rec = {
    date, farm, type, person,
    company: document.getElementById('bio-company').value || '',
    purpose: document.getElementById('bio-purpose').value || '',
    risk, measures, measureCount,
    notes: document.getElementById('bio-notes').value || '',
    ts: Date.now()
  };
  const statusEl = document.getElementById('bio-save-status');
  if (!statusEl) return;
  setSyncDot('saving');
  try {
    statusEl.style.color = '#f87171'; statusEl.textContent = t('bio.saving');
    const ref = await db.collection('biosecurityLog').add(rec);
    rec._fbId = ref.id;
    bioLog.unshift(rec);
    statusEl.style.color = '#4caf50'; statusEl.textContent = t('bio.saved');
    setTimeout(() => statusEl.textContent = '', 2000);
    clearBioForm();
    renderBioLog();
    try {
      await db.collection('activityLog').add({
        type: 'biosec', id: 'BIO',
        desc: 'Biosecurity log: ' + farm + ' — ' + type + ' (' + person + ') · Risk: ' + risk,
        tech: person, date: new Date(date + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'}),
        ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
  } catch(e) { statusEl.style.color = '#e53e3e'; statusEl.textContent = t('bio.save_failed') + e.message; }
  setSyncDot('live');
}

function clearBioForm() {
  ['bio-date','bio-farm','bio-type','bio-person','bio-company','bio-purpose','bio-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['bio-footbath','bio-coveralls','bio-bootcovers','bio-vehicle','bio-handwash','bio-nopoultrylast7'].forEach(id => {
    const el = document.getElementById(id); if (el) el.checked = false;
  });
  document.getElementById('bio-risk').value = 'low';
}

function renderBioLog() {
  const filterDate = document.getElementById('bio-filter-date')?.value || new Date().toISOString().slice(0,10);
  const filterFarm = document.getElementById('bio-filter-farm')?.value || 'all';
  const rows = (bioLog||[]).filter(r => {
    if (r.date !== filterDate) return false;
    if (filterFarm !== 'all' && r.farm !== filterFarm) return false;
    return true;
  });

  // Stats
  const statsEl = document.getElementById('bio-stats');
  const highRisk = rows.filter(r=>r.risk==='high').length;
  const medRisk = rows.filter(r=>r.risk==='medium').length;
  if (statsEl) statsEl.innerHTML = `
    <div style="background:#0f1a0f;border:1px solid #7f1d1d;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:700;color:#f0ead8;">${rows.length}</div>
      <div style="font-size:9px;color:#f87171;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">${t('bio.entries_today')}</div>
    </div>
    <div style="background:#0f1a0f;border:1px solid ${highRisk>0?'#dc2626':'#7f1d1d'};border-radius:10px;padding:12px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:700;color:${highRisk>0?'#f87171':'#f0ead8'};">${highRisk}</div>
      <div style="font-size:9px;color:#f87171;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">${t('bio.high_risk')}</div>
    </div>
    <div style="background:#0f1a0f;border:1px solid #7f1d1d;border-radius:10px;padding:12px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:700;color:${medRisk>0?'#d69e2e':'#f0ead8'};">${medRisk}</div>
      <div style="font-size:9px;color:#f87171;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">🟡 ${t('bio.medium_risk')}</div>
    </div>`;

  const listEl = document.getElementById('bio-log-list');
  if (!listEl) return;
  if (!rows.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#7f1d1d;font-family:\'IBM Plex Mono\',monospace;">No entries for this date.</div>';
    return;
  }
  const riskColors = { low:'#4caf50', medium:'#d69e2e', high:'#dc2626' };
  const riskIcons  = { low:'🟢', medium:'🟡', high:'🔴' };
  listEl.innerHTML = rows.map(r => {
    const measures = r.measures || {};
    const measureTags = Object.entries({footbath:'Footbath',coveralls:'Coveralls',bootCovers:'Boot Covers',vehicleDisinfected:'Vehicle Disinfected',handWash:'Hand Wash',noPoultryContact7d:'No Poultry Contact (7d)'})
      .filter(([k])=>measures[k])
      .map(([,v])=>`<span style="background:#1a2a1a;border:1px solid #2a5a2a;border-radius:12px;padding:2px 8px;font-size:10px;font-family:'IBM Plex Mono',monospace;color:#7ab07a;">${v}</span>`)
      .join('');
    return `<div style="background:#0f1a0f;border:1.5px solid ${riskColors[r.risk]||'#7f1d1d'};border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#f0ead8;">${r.person}</span>
          <span style="font-size:11px;color:#7a8a7a;margin-left:8px;">${r.type}</span>
        </div>
        <span style="font-size:11px;font-weight:700;color:${riskColors[r.risk]||'#ccc'};">${riskIcons[r.risk]||''} ${(r.risk||'').toUpperCase()}</span>
      </div>
      <div style="font-size:11px;color:#7a8a7a;font-family:'IBM Plex Mono',monospace;margin-bottom:6px;">${r.farm}${r.company?' · '+r.company:''}${r.purpose?' · '+r.purpose:''}</div>
      ${measureTags ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">${measureTags}</div>` : '<div style="font-size:10px;color:#dc2626;font-family:\'IBM Plex Mono\',monospace;margin-bottom:6px;">⚠️ No biosecurity measures recorded</div>'}
      ${r.notes?`<div style="font-size:10px;color:#5a7a5a;font-style:italic;">${r.notes}</div>`:''}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
