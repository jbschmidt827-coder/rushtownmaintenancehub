// FEED MILL
// ═══════════════════════════════════════════
let feedBins      = [];   // bin configs from Firestore
let feedReadings  = [];   // reading logs
let feedDeliveries= [];   // delivery logs
let feedMadeLog   = [];   // feed made logs
let _editFeedBinId= null;

function goFeedSection(sec) {
  window._feedSection = sec;
  document.querySelectorAll('.feed-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#panel-feed .sub-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('feed-' + sec);
  if (el) el.style.display = 'block';
  const btn = document.querySelector(`#panel-feed .sub-btn[data-section="${sec}"]`);
  if (btn) btn.classList.add('active');
  if (sec === 'dashboard')  renderFeedDashboard();
  if (sec === 'readings')   {
    const dateEl = document.getElementById('fr-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);
    renderFeedReadings();
  }
  if (sec === 'deliveries')  { populateFeedBinSelect('fd-bin'); renderFeedDeliveries(); }
  if (sec === 'made')        { populateFeedBinSelect('fm-bin'); renderFeedMade(); }
  if (sec === 'bins')        renderFeedBinsList();
  if (sec === 'consumption') {
    const dateEl = document.getElementById('fc-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);
    fcSetRange('7', document.querySelector('#feed-consumption .pill.active') || document.querySelector('#feed-consumption .pill'));
    renderConsumptionLog();
  }
  if (sec === 'medications') { renderMedicationLog(); renderWithdrawalAlerts(); }
}

// ── Bins ──
function populateFeedBinSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Select Bin —</option>';
  feedBins.forEach(b => {
    const o = document.createElement('option');
    o.value = b.binId;
    o.textContent = b.name + (b.barn ? ' — ' + b.barn : '') + (b.farm ? ' (' + b.farm + ')' : '');
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}

function openFeedBinForm(binId) {
  _editFeedBinId = binId || null;
  const form = document.getElementById('feed-bin-form');
  if (_editFeedBinId) {
    const b = feedBins.find(x => x.binId === binId);
    if (!b) return;
    document.getElementById('feed-bin-form-title').textContent = 'Edit Bin';
    document.getElementById('fbin-name').value        = b.name || '';
    document.getElementById('fbin-farm').value        = b.farm || b.location || '';
    document.getElementById('fbin-barn').value        = b.barn || '';
    document.getElementById('fbin-type').value        = b.feedType || '';
    document.getElementById('fbin-capacity').value    = b.capacityLbs || '';
    document.getElementById('fbin-consumption').value = b.dailyConsumptionLbs || '';
    document.getElementById('fbin-order').value       = b.orderPct || 25;
  } else {
    document.getElementById('feed-bin-form-title').textContent = 'Add Feed Bin';
    ['fbin-name','fbin-barn','fbin-type','fbin-capacity','fbin-consumption'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('fbin-farm').value = '';
    document.getElementById('fbin-order').value = 25;
  }
  form.style.display = 'block';
  form.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function closeFeedBinForm() {
  document.getElementById('feed-bin-form').style.display = 'none';
  _editFeedBinId = null;
}

// Per-farm, per-house daily consumption in lbs (tons × 2000)
// Add or adjust farms/houses here as needed
const FARM_HOUSE_CONSUMPTION = {
  'Rushtown':      { 1:28000, 2:30000, 3:18000, 4:14000, 5:32000 },
  'Danville':      { 1:28000, 2:30000, 3:18000, 4:14000, 5:32000 }, // same as Rushtown
  'Turbotville':   { 1:20000, 2:16000, 3:14000, 4:14000 },
  'W&M':           { 1:20000, 2:24000 },
  'Hegins': { 1:20000, 3:22000, 4:22000, 6:31000, 7:29500, 8:31000 }, // H2 & H5 inactive
};
// Fallback global per-house rates (used when farm not listed above)
const HOUSE_CONSUMPTION_LBS = { 1:28000, 2:30000, 3:18000, 4:14000, 5:32000 };

async function quickAddBins() {
  const farm     = document.getElementById('fqs-farm').value;
  const houses   = parseInt(document.getElementById('fqs-houses').value)||0;
  const cap         = parseInt(document.getElementById('fqs-capacity').value)||90000;
  const order       = parseInt(document.getElementById('fqs-order').value)||25;
  const defaultConsumption = parseInt(document.getElementById('fqs-consumption').value)||32000;
  const feedType    = document.getElementById('fqs-type').value.trim();
  if (!farm || !houses) return alert('Farm and # of Houses are required.');
  if (!confirm(`Create ${houses * 2} bins for ${farm} (Houses 1–${houses}, Bin A + Bin B each)?`)) return;

  const existing = feedBins.filter(b => b.farm === farm).map(b => b.name);
  let created = 0;
  for (let h = 1; h <= houses; h++) {
    const farmRates = FARM_HOUSE_CONSUMPTION[farm] || HOUSE_CONSUMPTION_LBS;
    const consumption = farmRates[h] !== undefined ? farmRates[h] : defaultConsumption;
    for (const side of ['A','B']) {
      const name = `House ${h} — Bin ${side}`;
      if (existing.includes(name)) continue;
      const binId = 'BIN-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
      const data = { binId, name, farm, barn: `House ${h}`, feedType, capacityLbs: cap, orderPct: order, dailyConsumptionLbs: consumption, ts: Date.now() };
      const ref = await db.collection('feedBins').add(data);
      feedBins.push({ ...data, _fbId: ref.id });
      created++;
      await new Promise(r => setTimeout(r, 30));
    }
  }
  alert(`✅ Created ${created} bins for ${farm}.`);
  renderFeedBinsList();
  renderFeedDashboard();
}

// All known farms: { farm, houses[], feedType }
// houses with no consumption data (inactive) are still created for future use
const SEED_FARMS = [
  { farm:'Turbotville', houses:[1,2,3,4],     feedType:'Layer Mash' },
  { farm:'W&M',         houses:[1,2],          feedType:'Layer Mash' },
  { farm:'Rushtown',    houses:[1,2,3,4,5],    feedType:'Layer Mash' },
  { farm:'Danville',    houses:[1,2,3,4,5],    feedType:'Layer Mash' },
  { farm:'Hegins',      houses:[1,2,3,4,5,6,7,8], feedType:'Layer Mash' },
];


async function saveFeedBin() {
  const name     = document.getElementById('fbin-name').value.trim();
  const farm     = document.getElementById('fbin-farm').value;
  const barn     = document.getElementById('fbin-barn').value.trim();
  const feedType    = document.getElementById('fbin-type').value.trim();
  const cap         = parseInt(document.getElementById('fbin-capacity').value) || 0;
  const consumption = parseInt(document.getElementById('fbin-consumption').value) || 0;
  const order       = parseInt(document.getElementById('fbin-order').value) || 25;
  if (!name || !cap) return alert('Bin Name and Capacity are required.');
  const data = { name, farm, barn, feedType, capacityLbs: cap, dailyConsumptionLbs: consumption, orderPct: order, ts: Date.now() };
  try {
    if (_editFeedBinId) {
      const existing = feedBins.find(b => b.binId === _editFeedBinId);
      if (existing?._fbId) {
        await db.collection('feedBins').doc(existing._fbId).update(data);
      }
    } else {
      const binId = 'BIN-' + Date.now().toString(36).toUpperCase();
      const ref = await db.collection('feedBins').add({ ...data, binId });
      feedBins.push({ ...data, binId, _fbId: ref.id });
    }
    await loadFeedBins();
    closeFeedBinForm();
    renderFeedBinsList();
    renderFeedDashboard();
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteFeedBin(binId) {
  if (!confirm('Delete this bin? All readings for it will remain in the log.')) return;
  const b = feedBins.find(x => x.binId === binId);
  if (b?._fbId) await db.collection('feedBins').doc(b._fbId).delete();
  await loadFeedBins();
  renderFeedBinsList();
  renderFeedDashboard();
}

function renderFeedBinsList() {
  const el = document.getElementById('feed-bins-list');
  if (!el) return;
  if (!feedBins.length) {
    el.innerHTML = '<div class="empty"><div class="ei">⚙️</div><p>No bins set up yet — use Quick Setup above or add a single bin.</p></div>';
    return;
  }
  // Group by farm
  const byFarm = {};
  feedBins.forEach(b => {
    const f = b.farm || 'Unassigned';
    if (!byFarm[f]) byFarm[f] = [];
    byFarm[f].push(b);
  });
  // Sort bins within each farm by house number
  Object.values(byFarm).forEach(arr => arr.sort((a,b2) => {
    const na = parseInt((a.barn||a.name||'').replace(/\D/g,''))||0;
    const nb = parseInt((b2.barn||b2.name||'').replace(/\D/g,''))||0;
    if (na !== nb) return na - nb;
    return (a.name||'').localeCompare(b2.name||'');
  }));

  el.innerHTML = Object.entries(byFarm).map(([farm, bins]) => `
    <div style="margin-bottom:20px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4caf50;margin-bottom:8px;padding:6px 10px;background:#0f2a0f;border-radius:6px;">
        🌾 ${farm} <span style="font-weight:400;color:#4a8a4a;">(${bins.length} bins)</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;">
        ${bins.map(b => `
          <div style="background:#f9f9f9;border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div>
              <div style="font-weight:700;font-size:13px;">${b.name}</div>
              <div style="font-size:10px;color:var(--muted);font-family:'IBM Plex Mono',monospace;">${[b.feedType].filter(Boolean).join(' · ')}${b.feedType?' · ':''}Cap: ${fmtNum(b.capacityLbs)} lbs · Order @ ${b.orderPct||25}%</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="ops-action-btn" onclick="openFeedBinForm('${b.binId}')">✏️</button>
              <button class="ops-action-btn danger" onclick="deleteFeedBin('${b.binId}')">✕</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// ── Dashboard ──
function renderFeedDashboard() {
  const statsEl = document.getElementById('feed-dash-stats');
  const cardsEl = document.getElementById('feed-bin-cards');
  if (!cardsEl) return;

  if (!feedBins.length) {
    if (statsEl) statsEl.innerHTML = '';
    cardsEl.innerHTML = `<div class="empty">
      <div class="ei">🌾</div>
      <p style="margin-bottom:14px;">No bins set up yet.</p>
      <button class="ops-save-btn" onclick="loadFeedData().then(()=>{renderFeedDashboard();})" style="margin:0 auto;display:block;">⚡ Auto-Setup Bins &amp; Readings</button>
    </div>`;
    return;
  }

  // Get latest reading per bin
  const latestByBin = {};
  feedReadings.forEach(r => {
    if (!latestByBin[r.binId] || r.ts > latestByBin[r.binId].ts) latestByBin[r.binId] = r;
  });

  let totalLbs = 0, totalCap = 0, lowCount = 0, critCount = 0;
  feedBins.forEach(b => {
    const r = latestByBin[b.binId];
    const lbs = r ? Number(r.readingLbs) : 0;
    const pct = b.capacityLbs > 0 ? Math.min(100, Math.round((lbs / b.capacityLbs) * 100)) : 0;
    totalLbs += lbs; totalCap += b.capacityLbs;
    if (pct < (b.orderPct||25)) lowCount++;
    if (pct < 10) critCount++;
  });

  if (statsEl) {
    const todayStr = new Date().toISOString().slice(0,10);
    const activeWithdrawals = feedMedications.filter(m => m.withdrawalEndDate && m.withdrawalEndDate >= todayStr).length;
    statsEl.innerHTML =
      sc('s-green', feedBins.length, '🌾 Total Bins') +
      sc('s-blue', fmtNum(totalLbs) + ' lbs', '📦 Total Inventory') +
      sc(lowCount > 0 ? 's-amber' : 's-green', lowCount, '⚠️ Low Bins') +
      sc(critCount > 0 ? 's-red' : 's-green', critCount, '🔴 Critical') +
      sc(activeWithdrawals > 0 ? 's-amber' : 's-green', activeWithdrawals, '💊 In Withdrawal');
  }

  // Group bins by farm → house
  const byFarm = {};
  feedBins.forEach(b => {
    const f = b.farm || 'Unassigned';
    if (!byFarm[f]) byFarm[f] = {};
    const house = b.barn || b.name;
    if (!byFarm[f][house]) byFarm[f][house] = [];
    byFarm[f][house].push(b);
  });

  cardsEl.innerHTML = Object.entries(byFarm).map(([farm, houses]) => {
    // Sort houses numerically
    const sortedHouses = Object.entries(houses).sort((a,b2) => {
      const na = parseInt(a[0].replace(/\D/g,''))||0;
      const nb = parseInt(b2[0].replace(/\D/g,''))||0;
      return na - nb;
    });
    return `
      <div style="margin-bottom:24px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4caf50;margin-bottom:10px;padding:6px 10px;background:#0c1f0c;border-radius:6px;">🌾 ${farm}</div>
        <div class="feed-bin-grid">
          ${sortedHouses.map(([house, bins]) => {
            // Sum lbs across all bins in this house
            const totalLbsHouse = bins.reduce((s,b) => {
              const r = latestByBin[b.binId];
              return s + (r ? Number(r.readingLbs) : 0);
            }, 0);
            // Daily consumption — use per-bin value (take max set)
            const consumption = bins.reduce((s,b) => s + (Number(b.dailyConsumptionLbs)||0), 0);
            // Auto-calc consumption from readings if not set
            let calcConsumption = 0;
            if (!consumption) {
              bins.forEach(b => {
                const recs = feedReadings.filter(x => x.binId === b.binId).sort((a,c)=>c.ts-a.ts);
                if (recs.length >= 2) {
                  const days = Math.max(1, Math.round((recs[0].ts - recs[1].ts) / 86400000));
                  calcConsumption += Math.max(0, (recs[1].readingLbs - recs[0].readingLbs)) / days;
                }
              });
            }
            const dailyCons = consumption || calcConsumption;
            const daysLeft = dailyCons > 0 ? Math.round((totalLbsHouse / dailyCons) * 10) / 10 : null;
            const daysColor = daysLeft === null ? '#7ab07a' : daysLeft >= 3 ? '#4caf50' : daysLeft >= 1.5 ? '#d69e2e' : '#e53e3e';

            const binRows = bins.map(b => {
              const r = latestByBin[b.binId];
              const lbs = r ? Number(r.readingLbs) : 0;
              const pct = b.capacityLbs > 0 ? Math.min(100, Math.round((lbs / b.capacityLbs) * 100)) : 0;
              const orderPct = b.orderPct || 25;
              const colorClass = pct >= 50 ? 'fb-green' : pct >= orderPct ? 'fb-amber' : 'fb-red';
              const lastDate = r ? fmtDate(r.date) : 'No reading';
              const binLabel = b.name.includes('Bin A') ? 'A' : b.name.includes('Bin B') ? 'B' : b.name.split('—').pop().trim();
              return `
                <div style="margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                    <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#a0c8a0;">Bin ${binLabel}</span>
                    <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#f0ead8;">${fmtNum(lbs)} lbs</span>
                    <span class="feed-bin-pct ${colorClass}" style="font-size:14px;">${r ? pct+'%' : '—'}</span>
                  </div>
                  <div class="feed-bin-bar-wrap" style="height:14px;margin-bottom:2px;">
                    <div class="feed-bin-bar ${colorClass}" style="width:${pct}%;"></div>
                    <div class="feed-bin-threshold" style="left:${orderPct}%;"></div>
                  </div>
                  <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;">Last: ${lastDate}</div>
                </div>`;
            }).join('');

            const totalCapHouse = bins.reduce((s,b2) => s + (b2.capacityLbs||0), 0);
            const statusClass = daysLeft === null ? 'ok' : daysLeft >= 3 ? 'ok' : daysLeft >= 1.5 ? 'low' : 'critical';
            const statusLabel = daysLeft === null ? '— No consumption set' : daysLeft >= 3 ? '✅ OK' : daysLeft >= 1.5 ? '⚠️ Order Soon' : '🔴 Critical';
            const feedTypeLabel = bins[0]?.feedType || '';

            // ── 7-day actual consumption trend from consumption log ──
            const houseNum = parseInt(house.replace(/\D/g,'')||'0');
            const today7 = new Date(); today7.setHours(0,0,0,0);
            const last7Days = Array.from({length:7},(_,i)=>{
              const d=new Date(today7); d.setDate(d.getDate()-i);
              return d.toISOString().slice(0,10);
            }).reverse();
            const houseConsLogs = feedConsumption.filter(c => c.farm===farm && parseInt((c.house||'').replace(/\D/g,''))||0 === houseNum);
            const dayTotals = last7Days.map(date => {
              const rec = houseConsLogs.find(c => c.date === date);
              return rec ? rec.consumedLbs : null;
            });
            const hasConsData = dayTotals.some(v => v !== null);
            const avg7 = hasConsData ? Math.round(dayTotals.filter(v=>v!==null).reduce((s,v)=>s+v,0) / dayTotals.filter(v=>v!==null).length) : null;

            // Sparkline bars (mini 7-day chart)
            const sparkMax = hasConsData ? Math.max(...dayTotals.filter(v=>v!==null), dailyCons||1) : 1;
            const sparkline = hasConsData ? `
              <div style="margin:8px 0 4px;border-top:1px solid #2a5a2a;padding-top:8px;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">7-Day Consumption</div>
                <div style="display:flex;align-items:flex-end;gap:2px;height:28px;">
                  ${dayTotals.map((v,i) => {
                    const h = v !== null ? Math.max(3, Math.round((v/sparkMax)*28)) : 3;
                    const isToday = last7Days[i] === new Date().toISOString().slice(0,10);
                    const barColor = v === null ? '#2a5a2a' : v > (dailyCons||0)*1.15 ? '#e53e3e' : v < (dailyCons||0)*0.85 ? '#e67e22' : '#4caf50';
                    return `<div title="${last7Days[i]}: ${v!==null?fmtNum(v)+' lbs':'No data'}" style="flex:1;height:${h}px;background:${barColor};border-radius:2px 2px 0 0;opacity:${isToday?'1':'0.75'};"></div>`;
                  }).join('')}
                </div>
                <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7ab07a;margin-top:3px;">
                  7-day avg: <strong style="color:#a0c8a0;">${fmtNum(avg7)} lbs</strong>
                  ${dailyCons && avg7 ? ` · ${avg7 > dailyCons*1.1 ? '▲' : avg7 < dailyCons*0.9 ? '▼' : '≈'} expected` : ''}
                </div>
              </div>` : '';

            // ── Active medication warning for this house ──
            const todayStr = new Date().toISOString().slice(0,10);
            const activeMeds = feedMedications.filter(m =>
              m.farm === farm &&
              (m.barn === house || m.barn === 'All Houses') &&
              m.withdrawalEndDate && m.withdrawalEndDate >= todayStr
            );
            const medWarning = activeMeds.length ? `
              <div style="margin-top:6px;background:#fff8e1;border:1.5px solid #f59e0b;border-radius:7px;padding:6px 10px;font-size:10px;font-family:'IBM Plex Mono',monospace;color:#d97706;">
                ⚠️ ${activeMeds.length} active withdrawal${activeMeds.length>1?'s':''}: ${activeMeds.map(m=>m.product).join(', ')}
              </div>` : '';

            return `<div class="feed-bin-card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                <div class="feed-bin-name">${house}</div>
                <div style="text-align:right;">
                  ${daysLeft !== null ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${daysColor};line-height:1;">${daysLeft}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;">days left</div>` : ''}
                </div>
              </div>
              <div class="feed-bin-loc">${[feedTypeLabel, farm].filter(Boolean).join(' · ')}</div>
              ${binRows}
              ${sparkline}
              ${medWarning}
              <div style="border-top:1px solid #2a5a2a;padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;align-items:center;">
                <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;">Total: ${fmtNum(totalLbsHouse)} lbs${dailyCons?` · ${fmtNum(Math.round(dailyCons))} lbs/day`:''}</div>
                <div class="feed-bin-status ${statusClass}" style="margin-top:0;">${statusLabel}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

// ── Readings — Bulk Entry ──
function renderBulkReadingInputs() {
  const farm = document.getElementById('fr-farm')?.value;
  const container = document.getElementById('fr-house-inputs');
  const saveRow = document.getElementById('fr-save-row');
  if (!container) return;
  if (!farm) { container.innerHTML = ''; if(saveRow) saveRow.style.display='none'; return; }
  const farmBins = feedBins.filter(b => b.farm === farm);
  if (!farmBins.length) {
    container.innerHTML = `<div style="padding:16px;text-align:center;color:#e53e3e;font-family:'IBM Plex Mono',monospace;font-size:12px;">⚠ No bins set up for ${farm} yet.<br>Go to <strong>Bins</strong> tab and click <strong>🌾 Seed All Farms</strong> first.</div>`;
    if(saveRow) saveRow.style.display='none'; return;
  }
  // Group by house
  const houses = {};
  farmBins.forEach(b => { if (!houses[b.barn]) houses[b.barn] = []; houses[b.barn].push(b); });
  const sorted = Object.entries(houses).sort((a,b) => { const n=s=>parseInt(s.replace(/\D/g,''))||0; return n(a[0])-n(b[0]); });
  container.innerHTML = sorted.map(([house, bins]) => {
    const sortedBins = bins.sort((a,b) => a.name.localeCompare(b.name));
    return `<div style="margin-bottom:10px;padding:12px 14px;border:1.5px solid #2a5a2a;border-radius:10px;background:#163016;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#a0c8a0;margin-bottom:10px;">${house}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${sortedBins.map(b => {
          const label = b.name.includes('Bin A') ? 'Bin A' : b.name.includes('Bin B') ? 'Bin B' : b.name.split('—').pop().trim();
          const cap = b.capacityLbs || 90000;
          return `<div>
            <label style="font-size:11px;color:#5a8a5a;display:block;margin-bottom:4px;">${label} <span style="color:#3a6a3a;">(max ${fmtNum(cap)} lbs)</span></label>
            <input type="number" id="fr-input-${b.binId}" class="bw-input" min="0" max="${cap}" placeholder="0" style="width:100%;box-sizing:border-box;">
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
  if(saveRow) saveRow.style.display='flex';
}

async function saveBulkFeedReadings() {
  const farm = document.getElementById('fr-farm')?.value;
  const date = document.getElementById('fr-date')?.value;
  const by   = document.getElementById('fr-by')?.value?.trim() || '';
  if (!farm || !date) return alert('Farm and Date are required.');
  const farmBins = feedBins.filter(b => b.farm === farm);
  let saved = 0;
  for (const b of farmBins) {
    const el = document.getElementById('fr-input-' + b.binId);
    if (!el || el.value === '') continue;
    const readingLbs = parseInt(el.value) || 0;
    const ref = await db.collection('feedReadings').add({ date, binId: b.binId, binName: b.name, farm, readingLbs, by, ts: Date.now() });
    feedReadings.unshift({ date, binId: b.binId, binName: b.name, farm, readingLbs, by, ts: Date.now(), _fbId: ref.id });
    saved++;
  }
  if (!saved) return alert('Enter at least one reading.');
  alert(`✅ ${saved} readings saved for ${farm}.`);
  clearBulkReadingForm();
  renderFeedReadings();
  renderFeedDashboard();
}

function clearBulkReadingForm() {
  document.getElementById('fr-farm').value = '';
  document.getElementById('fr-date').value = new Date().toISOString().slice(0,10);
  const container = document.getElementById('fr-house-inputs');
  if(container) container.innerHTML = '';
  const saveRow = document.getElementById('fr-save-row');
  if(saveRow) saveRow.style.display = 'none';
}

function renderFeedReadings() {
  const tbl = document.getElementById('feed-readings-table'); if (!tbl) return;
  const filterDate = document.getElementById('fr-filter-date')?.value || '';
  const filterFarm = document.getElementById('fr-filter-farm')?.value || '';
  let data = feedReadings.slice(0, 100);
  if (filterDate) data = data.filter(r => r.date === filterDate);
  if (filterFarm) data = data.filter(r => r.farm === filterFarm || (feedBins.find(b=>b.binId===r.binId)?.farm===filterFarm));
  data = data.slice(0, 60);
  if (!data.length) { tbl.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted);font-family:\'IBM Plex Mono\',monospace;">No readings found.</td></tr>'; return; }
  let html = '<thead><tr><th>Date</th><th>Location</th><th>Bin</th><th>Reading (lbs)</th><th>% Full</th><th>By</th></tr></thead><tbody>';
  data.forEach(r => {
    const bin = feedBins.find(b => b.binId === r.binId);
    const pct = bin?.capacityLbs ? Math.round((r.readingLbs / bin.capacityLbs) * 100) : '—';
    const loc = r.farm || bin?.farm || '—';
    html += `<tr>
      <td style="font-family:'IBM Plex Mono',monospace;">${fmtDate(r.date)}</td>
      <td>${loc}</td>
      <td><strong>${r.binName || r.binId}</strong></td>
      <td style="font-weight:700;">${fmtNum(r.readingLbs)}</td>
      <td style="font-weight:700;color:${typeof pct==='number'?(pct>=50?'#4caf50':pct>=25?'#d69e2e':'#e53e3e'):'var(--muted)'};">${typeof pct==='number'?pct+'%':pct}</td>
      <td>${r.by||'—'}</td>
    </tr>`;
  });
  tbl.innerHTML = html + '</tbody>';
}

async function deleteFeedReading(fbId) {
  if (!fbId || !confirm('Delete this reading?')) return;
  await db.collection('feedReadings').doc(fbId).delete();
  feedReadings = feedReadings.filter(r => r._fbId !== fbId);
  renderFeedReadings(); renderFeedDashboard();
}

// ── Deliveries ──
async function saveFeedDelivery() {
  const date     = document.getElementById('fd-date')?.value;
  const tons     = parseFloat(document.getElementById('fd-tons')?.value || '0') || 0;
  const type     = document.getElementById('fd-type')?.value?.trim() || '';
  const binId    = document.getElementById('fd-bin')?.value || '';
  const supplier = document.getElementById('fd-supplier')?.value?.trim() || '';
  const by       = document.getElementById('fd-by')?.value?.trim() || '';
  const notes    = document.getElementById('fd-notes')?.value?.trim() || '';
  if (!date || !tons) return alert('Date and Tons are required.');
  const bin = feedBins.find(b => b.binId === binId);
  try {
    const ref = await db.collection('feedDeliveries').add({ date, tons, type, binId, binName: bin?.name||'', supplier, by, notes, ts: Date.now() });
    feedDeliveries.unshift({ date, tons, type, binId, binName: bin?.name||'', supplier, by, notes, ts: Date.now(), _fbId: ref.id });
    clearFeedDeliveryForm();
    renderFeedDeliveries();
  } catch(e) { alert('Error: ' + e.message); }
}

function clearFeedDeliveryForm() {
  const t = new Date().toISOString().slice(0,10);
  document.getElementById('fd-date').value = t;
  ['fd-tons','fd-type','fd-bin','fd-supplier','fd-by','fd-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
}

function renderFeedDeliveries() {
  const tbl = document.getElementById('feed-deliveries-table'); if (!tbl) return;
  if (!feedDeliveries.length) { tbl.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);font-family:\'IBM Plex Mono\',monospace;">No deliveries logged yet.</td></tr>'; return; }
  let html = '<thead><tr><th>Date</th><th>Tons</th><th>Type</th><th>Destination</th><th>Supplier</th><th>By</th><th></th></tr></thead><tbody>';
  feedDeliveries.slice(0,50).forEach(r => {
    html += `<tr>
      <td style="font-family:'IBM Plex Mono',monospace;">${fmtDate(r.date)}</td>
      <td style="font-weight:700;color:#4caf50;">${r.tons} T</td>
      <td>${r.type||'—'}</td>
      <td>${r.binName||r.binId||'—'}</td>
      <td>${r.supplier||'—'}</td>
      <td>${r.by||'—'}</td>
      <td><button class="ops-action-btn danger" onclick="deleteFeedDelivery('${r._fbId}')">✕</button></td>
    </tr>`;
  });
  tbl.innerHTML = html + '</tbody>';
}

async function deleteFeedDelivery(fbId) {
  if (!fbId || !confirm('Delete this delivery record?')) return;
  await db.collection('feedDeliveries').doc(fbId).delete();
  feedDeliveries = feedDeliveries.filter(r => r._fbId !== fbId);
  renderFeedDeliveries();
}

// ── Feed Made ──
function feedMadeDestChange() {
  const dest = document.getElementById('fm-dest')?.value;
  populateFeedBinSelect('fm-bin');
  const binSel = document.getElementById('fm-bin');
  if (!binSel) return;
  if (dest === 'external') {
    binSel.innerHTML = '<option value="external">External Site</option><option value="">Other (see notes)</option>';
  } else {
    populateFeedBinSelect('fm-bin');
  }
}

async function saveFeedMade() {
  const date  = document.getElementById('fm-date')?.value;
  const tons  = parseFloat(document.getElementById('fm-tons')?.value || '0') || 0;
  const type  = document.getElementById('fm-type')?.value?.trim() || '';
  const dest  = document.getElementById('fm-dest')?.value || '';
  const binId = document.getElementById('fm-bin')?.value || '';
  const by    = document.getElementById('fm-by')?.value?.trim() || '';
  const notes = document.getElementById('fm-notes')?.value?.trim() || '';
  if (!date || !tons) return alert('Date and Tons Made are required.');
  const bin = feedBins.find(b => b.binId === binId);
  try {
    const ref = await db.collection('feedMade').add({ date, tons, type, dest, binId, binName: bin?.name||binId||'', by, notes, ts: Date.now() });
    feedMadeLog.unshift({ date, tons, type, dest, binId, binName: bin?.name||binId||'', by, notes, ts: Date.now(), _fbId: ref.id });
    clearFeedMadeForm();
    renderFeedMade();
  } catch(e) { alert('Error: ' + e.message); }
}

function clearFeedMadeForm() {
  const t = new Date().toISOString().slice(0,10);
  document.getElementById('fm-date').value = t;
  ['fm-tons','fm-type','fm-dest','fm-bin','fm-by','fm-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
}

function renderFeedMade() {
  const tbl = document.getElementById('feed-made-table'); if (!tbl) return;
  if (!feedMadeLog.length) { tbl.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);font-family:\'IBM Plex Mono\',monospace;">No feed made records yet.</td></tr>'; return; }
  let html = '<thead><tr><th>Date</th><th>Tons</th><th>Type</th><th>Dest</th><th>Bin / Site</th><th>By</th><th></th></tr></thead><tbody>';
  feedMadeLog.slice(0,50).forEach(r => {
    const destLabel = r.dest === 'own' ? '🐔 Own Barns' : r.dest === 'external' ? '🚚 External' : '—';
    html += `<tr>
      <td style="font-family:'IBM Plex Mono',monospace;">${fmtDate(r.date)}</td>
      <td style="font-weight:700;color:#4caf50;">${r.tons} T</td>
      <td>${r.type||'—'}</td>
      <td>${destLabel}</td>
      <td>${r.binName||r.binId||'—'}</td>
      <td>${r.by||'—'}</td>
      <td><button class="ops-action-btn danger" onclick="deleteFeedMade('${r._fbId}')">✕</button></td>
    </tr>`;
  });
  tbl.innerHTML = html + '</tbody>';
}

async function deleteFeedMade(fbId) {
  if (!fbId || !confirm('Delete this record?')) return;
  await db.collection('feedMade').doc(fbId).delete();
  feedMadeLog = feedMadeLog.filter(r => r._fbId !== fbId);
  renderFeedMade();
}

// ── Load from Firestore ──
async function loadFeedBins() {
  try {
    const snap = await db.collection('feedBins').orderBy('ts','asc').get();
    feedBins = [];
    snap.forEach(d => feedBins.push({ ...d.data(), _fbId: d.id }));
  } catch(e) { console.error('feedBins load:', e); }
}

// ─── Live Feed Bin Update (from morning walk / barn walk) ───────────────────
// Called onchange of a meter reading input. Immediately saves to feedReadings
// and updates the Feed Mill dashboard + the status display below the input.
async function liveUpdateFeedBin(inputId, statusId, farm, house) {
  const el  = document.getElementById(inputId);
  const sEl = document.getElementById(statusId);
  if (!el || !sEl) return;
  const lbs = parseFloat(el.value);
  if (!lbs || lbs <= 0) { sEl.textContent = ''; return; }

  // Find the best-matching bin for this farm + house
  const matchBin = (typeof feedBins !== 'undefined' && feedBins.length)
    ? (feedBins.find(b =>
        (b.farm||'').toLowerCase() === (farm||'').toLowerCase() &&
        (b.barn||'').replace(/\D/g,'') === String(house)
      ) || feedBins.find(b =>
        (b.farm||'').toLowerCase().includes((farm||'').toLowerCase()) &&
        (b.barn||'').replace(/\D/g,'') === String(house)
      ))
    : null;

  // Show saving spinner
  sEl.innerHTML = '<span style="color:#d69e2e;">⏳ Saving…</span>';

  try {
    const date = new Date().toISOString().slice(0,10);
    const by   = document.getElementById('mw-employee')?.value?.trim() ||
                 document.getElementById('bw-employee')?.value?.trim() || 'Morning Walk';
    // Resolve farm name: prefer matched bin, then param, then DOM globals as last resort
    const resolvedFarm = matchBin?.farm || farm || _bwFarm || _mwFarm || '';
    const frRec = {
      date,
      binId:   matchBin?.binId   || (resolvedFarm ? resolvedFarm + '-H' + house : 'BARN-' + house),
      binName: matchBin?.name    || (resolvedFarm ? resolvedFarm + ' House ' + house : 'House ' + house),
      farm:    resolvedFarm,
      readingLbs: lbs,
      by,
      notes: 'From morning walk — live entry',
      ts: Date.now()
    };

    // Save to Firestore
    const ref = await db.collection('feedReadings').add(frRec);
    // Update in-memory array (remove any existing reading for same bin+date, add new one)
    if (typeof feedReadings !== 'undefined') {
      feedReadings = feedReadings.filter(r => !(r.binId === frRec.binId && r.date === date));
      feedReadings.unshift({ ...frRec, _fbId: ref.id });
    }

    // Re-render feed dashboard if it's loaded
    if (typeof renderFeedDashboard === 'function') renderFeedDashboard();
    if (typeof renderFeedReadings  === 'function') renderFeedReadings();
    if (typeof updateHomeFeedStatus === 'function') updateHomeFeedStatus();

    // Show confirmation with % full
    const cap = matchBin?.capacityLbs || 90000;
    const pct = Math.min(100, Math.round((lbs / cap) * 100));
    const col = pct >= 40 ? '#4caf50' : pct >= 20 ? '#d69e2e' : '#e53e3e';
    sEl.innerHTML = `<span style="color:${col};">✅ Bin updated — ${pct}% full (${lbs.toLocaleString()} lbs)</span>`;
  } catch(e) {
    console.error('liveUpdateFeedBin:', e);
    sEl.innerHTML = '<span style="color:#e53e3e;">⚠ Save failed — will retry on submit</span>';
  }
}

// ── CONSUMPTION LOG ──────────────────────────────────────────────
let feedConsumption = []; // loaded from Firestore feedConsumption collection

// Build per-house input rows when farm is selected
function renderConsumptionHouseInputs() {
  const farm = document.getElementById('fc-farm').value;
  const container = document.getElementById('fc-house-inputs');
  const saveRow = document.getElementById('fc-save-row');
  if (!farm) { container.innerHTML = ''; saveRow.style.display = 'none'; return; }

  // Figure out which houses this farm has from bin data
  const farmBins = feedBins.filter(b => b.farm === farm);
  const houses = [...new Set(farmBins.map(b => b.barn || b.name).filter(Boolean))].sort((a,b) => {
    return (parseInt(a.replace(/\D/g,''))||0) - (parseInt(b.replace(/\D/g,''))||0);
  });

  // Fallback: use FARM_HOUSE_CONSUMPTION keys if no bins
  const fallbackHouses = Object.keys(FARM_HOUSE_CONSUMPTION[farm] || HOUSE_CONSUMPTION_LBS).map(h => `House ${h}`);
  const houseList = houses.length ? houses : fallbackHouses;

  if (!houseList.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;font-family:\'IBM Plex Mono\',monospace;padding:8px;">No houses found for this farm. Set up bins first.</div>';
    saveRow.style.display = 'none';
    return;
  }

  container.innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">Enter Consumption per House (lbs)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
      ${houseList.map(house => {
        const hNum = parseInt(house.replace(/\D/g,''))||0;
        const farmRates = FARM_HOUSE_CONSUMPTION[farm] || {};
        const expected = farmRates[hNum] || 0;
        return `
          <div style="background:#f9f9f9;border:1.5px solid var(--border);border-radius:10px;padding:12px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${house}</div>
            ${expected ? `<div style="font-size:10px;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-bottom:6px;">Expected: ${fmtNum(expected)} lbs/day</div>` : ''}
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="number" id="fc-house-${hNum}" min="0" step="100"
                placeholder="lbs consumed"
                style="flex:1;padding:7px 10px;border:1.5px solid #ddd;border-radius:7px;font-size:13px;font-family:'IBM Plex Sans',sans-serif;"
                oninput="fcHighlightDeviation(${hNum},${expected})">
              <span style="font-size:11px;color:var(--muted);">lbs</span>
            </div>
            <div id="fc-dev-${hNum}" style="font-size:10px;margin-top:4px;font-family:'IBM Plex Mono',monospace;"></div>
          </div>`;
      }).join('')}
    </div>`;
  saveRow.style.display = 'flex';
}

function fcHighlightDeviation(hNum, expected) {
  const val = parseFloat(document.getElementById('fc-house-'+hNum)?.value) || 0;
  const devEl = document.getElementById('fc-dev-'+hNum);
  if (!devEl || !expected || !val) { if(devEl) devEl.textContent=''; return; }
  const diff = val - expected;
  const pct = Math.round((diff / expected) * 100);
  const color = Math.abs(pct) > 15 ? (diff > 0 ? '#e53e3e' : '#e67e22') : '#4caf50';
  devEl.style.color = color;
  devEl.textContent = (diff > 0 ? '▲ +' : '▼ ') + fmtNum(Math.abs(diff)) + ' lbs (' + (diff > 0 ? '+' : '') + pct + '% vs expected)';
}

async function saveConsumptionLog() {
  const farm  = document.getElementById('fc-farm').value;
  const date  = document.getElementById('fc-date').value;
  const by    = document.getElementById('fc-by').value.trim();
  const age   = document.getElementById('fc-age').value;
  if (!farm || !date || !by) return alert('Farm, Date, and Entered By are required.');

  const farmBins   = feedBins.filter(b => b.farm === farm);
  const houses     = [...new Set(farmBins.map(b => b.barn || b.name).filter(Boolean))].sort((a,b)=>(parseInt(a.replace(/\D/g,''))||0)-(parseInt(b.replace(/\D/g,''))||0));
  const fallback   = Object.keys(FARM_HOUSE_CONSUMPTION[farm]||HOUSE_CONSUMPTION_LBS).map(h=>`House ${h}`);
  const houseList  = houses.length ? houses : fallback;

  let saved = 0;
  for (const house of houseList) {
    const hNum = parseInt(house.replace(/\D/g,''))||0;
    const el   = document.getElementById('fc-house-'+hNum);
    const lbs  = el ? parseFloat(el.value) : 0;
    if (!lbs) continue;
    const farmRates  = FARM_HOUSE_CONSUMPTION[farm] || {};
    const expected   = farmRates[hNum] || 0;
    const deviation  = expected ? Math.round(((lbs - expected) / expected) * 100) : null;
    const data = { farm, house, date, consumedLbs: lbs, expectedLbs: expected, deviationPct: deviation,
                   flockAgeDays: age ? parseInt(age) : null, by, ts: Date.now() };
    const ref = await db.collection('feedConsumption').add(data);
    feedConsumption.push({ ...data, _fbId: ref.id });
    saved++;
    await new Promise(r => setTimeout(r, 20));
  }
  if (!saved) return alert('No consumption values entered.');
  alert(`✅ Saved consumption for ${saved} house(s) on ${date}.`);
  clearConsumptionForm();
  renderConsumptionLog();
}

function clearConsumptionForm() {
  ['fc-farm','fc-date','fc-by','fc-age'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fc-house-inputs').innerHTML = '';
  document.getElementById('fc-save-row').style.display = 'none';
}

function fcSetRange(range, btn) {
  document.querySelectorAll('#feed-consumption .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const today = new Date();
  const fromEl = document.getElementById('fc-filter-from');
  const toEl   = document.getElementById('fc-filter-to');
  if (!fromEl || !toEl) return;
  if (range === 'all') { fromEl.value = ''; toEl.value = ''; }
  else {
    const days = parseInt(range);
    const from = new Date(today); from.setDate(from.getDate() - days + 1);
    fromEl.value = from.toISOString().slice(0,10);
    toEl.value   = today.toISOString().slice(0,10);
  }
  renderConsumptionLog();
}

function renderConsumptionLog() {
  const farmFilter = document.getElementById('fc-filter-farm')?.value || '';
  const fromFilter = document.getElementById('fc-filter-from')?.value || '';
  const toFilter   = document.getElementById('fc-filter-to')?.value   || '';

  let rows = [...feedConsumption];
  if (farmFilter) rows = rows.filter(r => r.farm === farmFilter);
  if (fromFilter) rows = rows.filter(r => r.date >= fromFilter);
  if (toFilter)   rows = rows.filter(r => r.date <= toFilter);
  rows.sort((a,b) => b.date.localeCompare(a.date) || a.farm.localeCompare(b.farm));

  // Stats
  const statsEl = document.getElementById('fc-stats');
  if (statsEl) {
    const totalLbs    = rows.reduce((s,r) => s + (r.consumedLbs||0), 0);
    const highDev     = rows.filter(r => r.deviationPct !== null && Math.abs(r.deviationPct) > 15).length;
    const avgLbs      = rows.length ? Math.round(totalLbs / rows.length) : 0;
    const uniqueDates = new Set(rows.map(r=>r.date)).size;
    statsEl.innerHTML =
      sc('s-blue',  fmtNum(totalLbs) + ' lbs', '📦 Total Consumed') +
      sc('s-green', rows.length, '📋 Records') +
      sc('s-blue',  uniqueDates, '📅 Days Logged') +
      sc(highDev > 0 ? 's-amber' : 's-green', highDev, '⚠️ High Deviations');
  }

  const tbl = document.getElementById('fc-log-table');
  if (!tbl) return;
  if (!rows.length) {
    tbl.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">No consumption records found. Log your first entry above.</td></tr>';
    return;
  }
  tbl.innerHTML = `
    <thead><tr>
      <th>Date</th><th>Farm</th><th>House</th><th>Consumed (lbs)</th>
      <th>Expected (lbs)</th><th>Deviation</th><th>Flock Age</th><th>Entered By</th>
    </tr></thead>
    <tbody>
      ${rows.map(r => {
        const devColor = r.deviationPct === null ? '' : Math.abs(r.deviationPct) > 15 ? (r.deviationPct > 0 ? 'color:#e53e3e;font-weight:700;' : 'color:#e67e22;font-weight:700;') : 'color:#4caf50;';
        const devText  = r.deviationPct !== null ? (r.deviationPct > 0 ? '+' : '') + r.deviationPct + '%' : '—';
        return `<tr>
          <td>${r.date||'—'}</td>
          <td>${r.farm||'—'}</td>
          <td>${r.house||'—'}</td>
          <td style="font-weight:600;">${fmtNum(r.consumedLbs||0)}</td>
          <td style="color:var(--muted);">${r.expectedLbs ? fmtNum(r.expectedLbs) : '—'}</td>
          <td style="${devColor}">${devText}</td>
          <td>${r.flockAgeDays != null ? r.flockAgeDays + 'd' : '—'}</td>
          <td>${r.by||'—'}</td>
        </tr>`;
      }).join('')}
    </tbody>`;
}

// ── MEDICATIONS / ADDITIVES ───────────────────────────────────────
let feedMedications = []; // loaded from Firestore feedMedications collection

async function saveMedication() {
  const date       = document.getElementById('fmed-date').value;
  const farm       = document.getElementById('fmed-farm').value;
  const barn       = document.getElementById('fmed-barn').value.trim();
  const product    = document.getElementById('fmed-product').value.trim();
  const category   = document.getElementById('fmed-category').value;
  const method     = document.getElementById('fmed-method').value;
  const dosage     = document.getElementById('fmed-dosage').value.trim();
  const duration   = document.getElementById('fmed-duration').value;
  const withdrawal = document.getElementById('fmed-withdrawal').value;
  const flockAge   = document.getElementById('fmed-flockage').value;
  const by         = document.getElementById('fmed-by').value.trim();
  const vet        = document.getElementById('fmed-vet').value.trim();
  const reason     = document.getElementById('fmed-reason').value.trim();
  const notes      = document.getElementById('fmed-notes').value.trim();

  if (!date || !farm || !barn || !product || !by) return alert('Date, Farm, Barn, Product Name, and Administered By are required.');

  // Calculate withdrawal end date
  let withdrawalEndDate = null;
  if (withdrawal && parseInt(withdrawal) > 0) {
    const start = new Date(date);
    start.setDate(start.getDate() + parseInt(withdrawal));
    withdrawalEndDate = start.toISOString().slice(0,10);
  }

  const data = {
    date, farm, barn, product, category, method, dosage,
    durationDays:    duration   ? parseInt(duration)   : null,
    withdrawalDays:  withdrawal ? parseInt(withdrawal) : null,
    withdrawalEndDate,
    flockAgeDays:    flockAge   ? parseInt(flockAge)   : null,
    by, vet, reason, notes, ts: Date.now()
  };

  try {
    const ref = await db.collection('feedMedications').add(data);
    feedMedications.push({ ...data, _fbId: ref.id });
    alert(`✅ Medication logged: ${product} for ${barn} at ${farm}.`);
    clearMedicationForm();
    renderMedicationLog();
    renderWithdrawalAlerts();
    updateMedBadge();
  } catch(e) { alert('Error saving: ' + e.message); }
}

function clearMedicationForm() {
  ['fmed-date','fmed-farm','fmed-barn','fmed-product','fmed-category','fmed-method',
   'fmed-dosage','fmed-duration','fmed-withdrawal','fmed-flockage','fmed-by','fmed-vet',
   'fmed-reason','fmed-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function renderWithdrawalAlerts() {
  const el = document.getElementById('med-withdrawal-alerts');
  if (!el) return;
  const today = new Date().toISOString().slice(0,10);
  const active = feedMedications.filter(m => m.withdrawalEndDate && m.withdrawalEndDate >= today);
  if (!active.length) { el.innerHTML = ''; return; }
  active.sort((a,b) => a.withdrawalEndDate.localeCompare(b.withdrawalEndDate));
  el.innerHTML = `
    <div style="background:#fff8e1;border:2px solid #f59e0b;border-radius:12px;padding:14px 16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#d97706;margin-bottom:10px;">⚠️ Active Withdrawal Periods — ${active.length} record(s)</div>
      ${active.map(m => {
        const daysLeft = Math.ceil((new Date(m.withdrawalEndDate) - new Date(today)) / 86400000);
        const urgency  = daysLeft <= 3 ? 'color:#e53e3e;font-weight:700;' : daysLeft <= 7 ? 'color:#e67e22;font-weight:600;' : 'color:#d97706;';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #fde68a;flex-wrap:wrap;gap:6px;">
          <div>
            <span style="font-weight:700;">${m.product}</span>
            <span style="color:var(--muted);font-size:12px;margin-left:8px;">${m.farm} · ${m.barn}</span>
          </div>
          <div style="${urgency}font-family:'IBM Plex Mono',monospace;font-size:12px;">
            Clears ${m.withdrawalEndDate} · <strong>${daysLeft} day${daysLeft!==1?'s':''} left</strong>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function updateMedBadge() {
  const today  = new Date().toISOString().slice(0,10);
  const active = feedMedications.filter(m => m.withdrawalEndDate && m.withdrawalEndDate >= today).length;
  const badge  = document.getElementById('med-alert-badge');
  if (!badge) return;
  if (active > 0) { badge.textContent = active; badge.style.display = 'inline'; }
  else badge.style.display = 'none';
}

function renderMedicationLog() {
  const farmFilter     = document.getElementById('fmed-filter-farm')?.value     || '';
  const categoryFilter = document.getElementById('fmed-filter-category')?.value || '';
  const statusFilter   = document.getElementById('fmed-filter-status')?.value   || '';
  const today          = new Date().toISOString().slice(0,10);

  let rows = [...feedMedications];
  if (farmFilter)     rows = rows.filter(r => r.farm === farmFilter);
  if (categoryFilter) rows = rows.filter(r => r.category === categoryFilter);
  if (statusFilter === 'active')   rows = rows.filter(r => r.withdrawalEndDate && r.withdrawalEndDate >= today);
  if (statusFilter === 'complete') rows = rows.filter(r => !r.withdrawalEndDate || r.withdrawalEndDate < today);
  rows.sort((a,b) => b.date.localeCompare(a.date));

  // Stats
  const statsEl = document.getElementById('fmed-stats');
  if (statsEl) {
    const inWithdrawal = rows.filter(r => r.withdrawalEndDate && r.withdrawalEndDate >= today).length;
    const antibiotics  = rows.filter(r => r.category === 'Antibiotic').length;
    const uniqueProds  = new Set(rows.map(r=>r.product)).size;
    statsEl.innerHTML =
      sc('s-blue',  rows.length, '💊 Total Records') +
      sc(inWithdrawal > 0 ? 's-red' : 's-green', inWithdrawal, '⚠️ In Withdrawal') +
      sc('s-amber', antibiotics, '🔬 Antibiotic Treatments') +
      sc('s-blue',  uniqueProds, '🧪 Unique Products');
  }

  renderWithdrawalAlerts();
  updateMedBadge();

  const tbl = document.getElementById('fmed-log-table');
  if (!tbl) return;
  if (!rows.length) {
    tbl.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted);">No medication records found.</td></tr>';
    return;
  }
  tbl.innerHTML = `
    <thead><tr>
      <th>Date</th><th>Farm</th><th>Barn</th><th>Product</th><th>Category</th>
      <th>Method</th><th>Dosage</th><th>Withdrawal Clears</th><th>Administered By</th>
    </tr></thead>
    <tbody>
      ${rows.map(r => {
        const inWd     = r.withdrawalEndDate && r.withdrawalEndDate >= today;
        const wdStyle  = inWd ? 'color:#e53e3e;font-weight:700;' : 'color:#4caf50;';
        const wdText   = r.withdrawalEndDate ? r.withdrawalEndDate + (inWd ? ' ⚠️' : ' ✅') : '—';
        return `<tr>
          <td>${r.date||'—'}</td>
          <td>${r.farm||'—'}</td>
          <td>${r.barn||'—'}</td>
          <td style="font-weight:600;">${r.product||'—'}</td>
          <td><span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:20px;font-size:11px;font-family:'IBM Plex Mono',monospace;">${r.category||'—'}</span></td>
          <td>${r.method||'—'}</td>
          <td style="font-size:12px;">${r.dosage||'—'}</td>
          <td style="${wdStyle}">${wdText}</td>
          <td>${r.by||'—'}</td>
        </tr>`;
      }).join('')}
    </tbody>`;
}

async function loadFeedMedications() {
  try {
    const snap = await db.collection('feedMedications').orderBy('ts','desc').limit(500).get();
    feedMedications = [];
    snap.forEach(d => feedMedications.push({ ...d.data(), _fbId: d.id }));
    updateMedBadge();
  } catch(e) { console.error('feedMedications load:', e); }
}

async function loadFeedConsumption() {
  try {
    const snap = await db.collection('feedConsumption').orderBy('ts','desc').limit(1000).get();
    feedConsumption = [];
    snap.forEach(d => feedConsumption.push({ ...d.data(), _fbId: d.id }));
  } catch(e) { console.error('feedConsumption load:', e); }
}

async function loadFeedData() {
  try {
    const [rSnap, dSnap, mSnap, cSnap, medSnap] = await Promise.all([
      db.collection('feedReadings').orderBy('ts','desc').limit(200).get(),
      db.collection('feedDeliveries').orderBy('ts','desc').limit(200).get(),
      db.collection('feedMade').orderBy('ts','desc').limit(200).get(),
      db.collection('feedConsumption').orderBy('ts','desc').limit(1000).get(),
      db.collection('feedMedications').orderBy('ts','desc').limit(500).get(),
    ]);
    feedReadings   = []; rSnap.forEach(d => feedReadings.push({ ...d.data(), _fbId: d.id }));
    feedDeliveries = []; dSnap.forEach(d => feedDeliveries.push({ ...d.data(), _fbId: d.id }));
    feedMadeLog    = []; mSnap.forEach(d => feedMadeLog.push({ ...d.data(), _fbId: d.id }));
    feedConsumption= []; cSnap.forEach(d => feedConsumption.push({ ...d.data(), _fbId: d.id }));
    feedMedications= []; medSnap.forEach(d => feedMedications.push({ ...d.data(), _fbId: d.id }));
  } catch(e) { console.error('feedData load:', e); }
  updateMedBadge();
  // Auto-seed bins if none exist
  if (!feedBins.length) {
    await seedAllFarms(true);
  }
  // Seed initial readings if none exist (runs even if bins already existed)
  if (!feedReadings.length && feedBins.length) {
    await seedInitialReadings();
  }
  // Always re-render dashboard after data loads
  renderFeedDashboard();
}

// Initial readings from physical records (Turbotville + W&M: 3/27/2026, Hegins: 3/22/2026)
const INITIAL_READINGS = {
  'Turbotville': { 'House 1':{A:24311,B:33517}, 'House 2':{A:31543,B:18779}, 'House 3':{A:73367,B:51831}, 'House 4':{A:49400,B:73235} },
  'W&M':         { 'House 1':{A:17975,B:42600}, 'House 2':{A:47589,B:27902} },
  'Hegins':      { 'House 1':{A:35500,B:35500}, 'House 3':{A:40000,B:40000}, 'House 4':{A:34020,B:34020}, 'House 6':{A:41270,B:41270}, 'House 7':{A:53850,B:53850}, 'House 8':{A:66910,B:66910} },
};
const INITIAL_READING_DATES = { 'Turbotville':'2026-03-27','W&M':'2026-03-27','Hegins':'2026-03-22' };

async function seedInitialReadings() {
  if (feedReadings.length) return; // already have readings
  const ts = Date.now();
  for (const [farm, houses] of Object.entries(INITIAL_READINGS)) {
    const date = INITIAL_READING_DATES[farm] || '2026-03-27';
    for (const [house, bins] of Object.entries(houses)) {
      for (const [side, lbs] of Object.entries(bins)) {
        const binName = `${house} — Bin ${side}`;
        const bin = feedBins.find(b => b.farm === farm && b.name === binName);
        if (!bin) continue;
        const ref = await db.collection('feedReadings').add({ date, binId:bin.binId, binName:bin.name, farm, readingLbs:lbs, by:'Initial Setup', ts });
        feedReadings.push({ date, binId:bin.binId, binName:bin.name, farm, readingLbs:lbs, by:'Initial Setup', ts, _fbId:ref.id });
        await new Promise(r => setTimeout(r,20));
      }
    }
  }
}

// seedAllFarms can be called silently (no confirm/alert) for auto-init
async function seedAllFarms(silent=false) {
  if (!silent && !confirm(`Create all bins for ${SEED_FARMS.length} farms?\n\nExisting bins will be skipped.`)) return;
  const cap=90000, order=25;
  let created=0, skipped=0;
  for (const {farm, houses, feedType} of SEED_FARMS) {
    const existing=feedBins.filter(b=>b.farm===farm).map(b=>b.name);
    const farmRates=FARM_HOUSE_CONSUMPTION[farm]||HOUSE_CONSUMPTION_LBS;
    for (const h of houses) {
      const consumption=farmRates[h]!==undefined?farmRates[h]:32000;
      for (const side of ['A','B']) {
        const name=`House ${h} — Bin ${side}`;
        if (existing.includes(name)){skipped++;continue;}
        const binId='BIN-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
        const data={binId,name,farm,barn:`House ${h}`,feedType,capacityLbs:cap,orderPct:order,dailyConsumptionLbs:consumption,ts:Date.now()};
        const ref=await db.collection('feedBins').add(data);
        feedBins.push({...data,_fbId:ref.id});
        created++;
        await new Promise(r=>setTimeout(r,30));
      }
    }
  }
  if (!silent) { alert(`✅ ${created} bins created, ${skipped} skipped.`); renderFeedBinsList(); renderFeedDashboard(); }
}

// ── Packing ──
function calcPack() {
  const start=document.getElementById('pf-start')?.value;
  const end=document.getElementById('pf-end')?.value;
  const brk=parseInt(document.getElementById('pf-break')?.value||'0')||0;
  const down=parseInt(document.getElementById('pf-downtime')?.value||'0')||0;
  const qty=parseInt(document.getElementById('pf-qty')?.value||'0')||0;
  const houses=parseInt(document.getElementById('pf-houses')?.value||'0')||0;
  const row=document.getElementById('pf-calc-row');
  if (!start||!end) { if(row)row.style.display='none'; return; }
  const [sh,sm]=start.split(':').map(Number);
  const [eh,em]=end.split(':').map(Number);
  let totalMin=(eh*60+em)-(sh*60+sm);
  if (totalMin<=0) { if(row)row.style.display='none'; return; }
  const runMin=Math.max(0,totalMin-brk-down);
  const runH=Math.floor(runMin/60), runM=runMin%60;
  const runLabel=runH>0?`${runH}h ${runM}m`:`${runM}m`;
  const dzhr=runMin>0?Math.round((qty/(runMin/60))*10)/10:0;
  const dzhouse=houses>0?Math.round((qty/houses)*10)/10:0;
  if(row)row.style.display='block';
  document.getElementById('pf-calc-runtime').textContent=runLabel;
  document.getElementById('pf-calc-dzhr').textContent=dzhr?fmtNum(dzhr):'—';
  document.getElementById('pf-calc-dzhouse').textContent=dzhouse?fmtNum(dzhouse):'—';
}

function renderPacking() {
  const filterDate=document.getElementById('pack-filter-date')?.value||opsToday();
  const data=opsPackData.filter(r=>r.date===filterDate);
  const total=data.reduce((s,r)=>s+(Number(r.qty)||0),0);
  // Use saved runTime for avg dz/hr if available
  const withTime=data.filter(r=>r.runMin>0);
  const avgDzHr=withTime.length?Math.round(withTime.reduce((s,r)=>s+(Number(r.dzPerHr)||0),0)/withTime.length):0;
  const avgDzHouse=withTime.length?Math.round(withTime.reduce((s,r)=>s+(Number(r.dzPerHouse)||0),0)/withTime.length):0;
  const byShift={};data.forEach(r=>{byShift[r.shift]=(byShift[r.shift]||0)+(Number(r.qty)||0);});
  const statsEl=document.getElementById('pack-stats');
  if (statsEl) statsEl.innerHTML=
    sc('s-green',fmtNum(total),'📦 Total Dz')+
    sc('s-blue',avgDzHr?fmtNum(avgDzHr)+' dz':'—','⏱ Avg Dz/Hr')+
    sc('s-amber',avgDzHouse?fmtNum(avgDzHouse)+' dz':'—','🏠 Avg Dz/House')+
    sc('s-red',data.reduce((s,r)=>s+(Number(r.stops)||0),0)||'—','🛑 Total Stops')+
    sc('s-red',data.length,'# Entries');
  const tbl=document.getElementById('pack-table'); if(!tbl)return;
  if (!data.length) { tbl.innerHTML='<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--muted);font-family:\'IBM Plex Mono\',monospace;">No entries for this date.</td></tr>'; return; }
  let html='<thead><tr><th>Product</th><th>Total Dz</th><th>Start</th><th>End</th><th>Break</th><th>Downtime</th><th>Run Time</th><th>Dz/Hr</th><th>Dz/House</th><th>Houses</th><th>Stops</th><th>Shift</th><th>By</th><th></th></tr></thead><tbody>';
  let tot=0;
  data.forEach(r=>{
    tot+=Number(r.qty)||0;
    const sc2=r.shift==='AM'?'open':r.shift==='PM'?'in-progress':'on-hold';
    const runMin=r.runMin||0;
    const runLabel=runMin>0?(Math.floor(runMin/60)>0?`${Math.floor(runMin/60)}h ${runMin%60}m`:`${runMin}m`):'—';
    html+=`<tr>
      <td><strong>${r.product}</strong></td>
      <td>${fmtNum(r.qty)}</td>
      <td style="font-family:'IBM Plex Mono',monospace;">${r.startTime||'—'}</td>
      <td style="font-family:'IBM Plex Mono',monospace;">${r.endTime||'—'}</td>
      <td>${r.breakMin||0}m</td>
      <td>${r.downtimeMin||0}m</td>
      <td style="font-family:'IBM Plex Mono',monospace;font-weight:700;">${runLabel}</td>
      <td style="font-weight:700;color:#4caf50;">${r.dzPerHr?fmtNum(r.dzPerHr):'—'}</td>
      <td style="font-weight:700;color:#4caf50;">${r.dzPerHouse?fmtNum(r.dzPerHouse):'—'}</td>
      <td>${r.houses||'—'}</td>
      <td style="font-weight:700;">${r.stops||'—'}</td>
      <td><span class="badge ${sc2}" style="font-size:9px;">${r.shift}</span></td>
      <td>${r.by||'—'}</td>
      <td><button class="ops-action-btn danger" onclick="deletePacking('${r._fbId}')">✕</button></td>
    </tr>`;
  });
  html+=`<tr class="total-row"><td>TOTAL</td><td>${fmtNum(tot)}</td><td colspan="11"></td></tr></tbody>`;
  tbl.innerHTML=html;
}

async function savePacking() {
  const date=document.getElementById('pf-date')?.value, product=document.getElementById('pf-product')?.value;
  const qty=parseInt(document.getElementById('pf-qty')?.value||'0'), unit=document.getElementById('pf-unit')?.value||'Dozen';
  const startTime=document.getElementById('pf-start')?.value||'', endTime=document.getElementById('pf-end')?.value||'';
  const breakMin=parseInt(document.getElementById('pf-break')?.value||'0')||0;
  const downtimeMin=parseInt(document.getElementById('pf-downtime')?.value||'0')||0;
  const houses=parseInt(document.getElementById('pf-houses')?.value||'0')||0;
  const stops=parseInt(document.getElementById('pf-stops')?.value||'0')||0;
  const line=document.getElementById('pf-line')?.value?.trim()||'', shift=document.getElementById('pf-shift')?.value||'AM';
  const by=document.getElementById('pf-by')?.value?.trim()||'Unknown', notes=document.getElementById('pf-notes')?.value?.trim()||'';
  if (!date||!product||!qty) { alert('Date, Product Type, and Total Dz are required.'); return; }
  // Compute run time and rates
  let runMin=0, dzPerHr=0, dzPerHouse=0;
  if (startTime&&endTime) {
    const [sh,sm]=startTime.split(':').map(Number);
    const [eh,em]=endTime.split(':').map(Number);
    const totalMin=(eh*60+em)-(sh*60+sm);
    runMin=Math.max(0,totalMin-breakMin-downtimeMin);
    if(runMin>0) dzPerHr=Math.round((qty/(runMin/60))*10)/10;
  }
  if(houses>0) dzPerHouse=Math.round((qty/houses)*10)/10;
  const record={date,product,qty,unit,startTime,endTime,breakMin,downtimeMin,runMin,houses,stops,dzPerHr,dzPerHouse,line,shift,by,notes,ts:Date.now()};
  try {
    const ref=await db.collection('opsPacking').add(record);
    record._fbId=ref.id; opsPackData.unshift(record);
    await db.collection('activityLog').add({type:'ops-pack',id:'PACK',desc:`Packing: ${product} — ${fmtNum(qty)} dz${runMin?' | '+Math.round(dzPerHr)+' dz/hr':''}`,tech:by,date,ts:Date.now()});
    clearPackForm(); renderPacking(); renderOpsScoreboard();
  } catch(e) { console.error(e); alert('Error saving: '+e.message); }
}

function clearPackForm() {
  const t=opsToday(),s=shiftFromTime();
  ['pf-date','pf-product','pf-qty','pf-unit','pf-start','pf-end','pf-break','pf-downtime','pf-houses','pf-stops','pf-line','pf-shift','pf-by','pf-notes'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    if(id==='pf-date')el.value=t; else if(id==='pf-shift')el.value=s; else if(id==='pf-unit')el.value='Dozen'; else el.value='';
  });
  const row=document.getElementById('pf-calc-row');if(row)row.style.display='none';
}

async function deletePacking(fbId) {
  if (!confirm('Delete this packing entry?')) return;
  if (!fbId.startsWith('demo-')) await db.collection('opsPacking').doc(fbId).delete();
  opsPackData=opsPackData.filter(r=>r._fbId!==fbId);
  renderPacking(); renderOpsScoreboard();
}

// ── Shipping ──
function toggleShipForm() {
  const panel=document.getElementById('ship-form-panel'); if(!panel)return;
  const open=panel.style.display!=='none';
  panel.style.display=open?'none':'block';
  if(!open) {
    document.getElementById('sf-date').value=opsToday();
    initShipFarmDropdown();
    document.getElementById('sf-farm-info').style.display='none';
    setupEnterChain('ship-form-grid',saveShipping);
  }
}

function opsShipView(mode,btn) {
  opsShipView_=mode;
  document.querySelectorAll('#ship-view-pills .pill').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderShipping();
}

function renderShipping() {
  let data=[...opsShipData];
  if(opsShipView_==='active') data=data.filter(r=>!['shipped','delivered'].includes(r.status));
  else if(opsShipView_==='hold') data=data.filter(r=>r.status==='hold');
  data.sort((a,b)=>(b.ts||0)-(a.ts||0));

  const todayLoads=opsShipData.filter(r=>r.date===opsToday());
  const activeCount=opsShipData.filter(r=>!['shipped','delivered'].includes(r.status)).length;
  const shippedToday=opsShipData.filter(r=>r.date===opsToday()&&['shipped','delivered'].includes(r.status)).length;
  const holdCount=opsShipData.filter(r=>r.status==='hold').length;
  const stopsToday=todayLoads.reduce((s,r)=>s+(parseInt(r.stops)||1),0);
  const statsEl=document.getElementById('ship-stats');
  if(statsEl) statsEl.innerHTML=sc('s-blue',todayLoads.length,'🚚 Loads Today')+sc('s-purple',stopsToday,'📍 Stops Today')+sc('s-green',shippedToday,'✅ Shipped Today')+sc('s-red',holdCount,'🚫 On Hold');

  const listEl=document.getElementById('ship-list'); if(!listEl)return;
  if(!data.length){listEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted);font-family:\'IBM Plex Mono\',monospace;font-size:13px;">No loads to display. Click ➕ New Load to create one.</div>';return;}
  listEl.innerHTML=data.map(r=>shipCardHtml(r)).join('');
}

function shipCardHtml(r) {
  const stLbl={planned:'Planned','in-process':'In Process',staged:'Staged',loaded:'Loaded',shipped:'Shipped',delivered:'Delivered',hold:'Hold / Issue'};
  const nxtSt={planned:'in-process','in-process':'staged',staged:'loaded',loaded:'shipped',shipped:'delivered'};
  const nxtLbl={planned:'Mark In Process','in-process':'Mark Staged',staged:'Mark Loaded',loaded:'Mark Shipped',shipped:'Mark Delivered'};
  const st=r.status||'planned';
  const delay=r.schedDep&&r.actDep&&r.actDep>r.schedDep?`<span style="color:var(--red);font-size:11px;">⏱️ ${r.actDep} actual (sched. ${r.schedDep})</span>`:r.schedDep?`<span style="font-size:11px;color:var(--muted);">Sched. ${r.schedDep}</span>`:'';
  let actions='';
  if(nxtSt[st]) actions+=`<button class="ops-action-btn" onclick="updateShipStatus('${r._fbId}','${nxtSt[st]}')">${nxtLbl[st]}</button>`;
  if(st!=='hold') actions+=`<button class="ops-action-btn danger" onclick="updateShipStatus('${r._fbId}','hold')">🚫 Hold</button>`;
  actions+=`<button class="ops-action-btn" onclick="createWOFromShip('${r._fbId}')">🔧 Create WO</button>`;
  actions+=`<button class="ops-action-btn" onclick="flagShipIssue('${r._fbId}','${r.loadNum}')">⚠️ Exception</button>`;
  const dmg=r.damageNotes?`<div style="background:#fde8e6;border-radius:6px;padding:6px 10px;margin-top:8px;font-size:12px;color:var(--red);">⚠️ ${r.damageNotes}</div>`:'';
  const dlr=r.delayReason?`<div style="background:#fff8e1;border-radius:6px;padding:6px 10px;margin-top:6px;font-size:12px;color:#b07a00;">⏱️ Delay: ${r.delayReason}</div>`:'';
  const wo=r.linkedWO?`<div style="font-size:11px;color:var(--muted);margin-top:4px;">🔧 ${r.linkedWO}</div>`:'';
  return `<div class="ops-card ${st}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-family:'Bebas Neue',cursive;font-size:20px;color:var(--green-mid);">${r.loadNum}</span>
          <span class="ship-badge ${st}">${stLbl[st]||st}</span>
        </div>
        <div style="font-weight:700;font-size:14px;color:var(--ink);">${r.customer}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${r.product} · ${fmtNum(r.qty)} ${r.unit} · ${r.facility}${r.stops>1?' · '+r.stops+' stops':''}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${r.date}${r.trailer?' · '+r.trailer:''}${r.driver?' · '+r.driver:''}</div>
        ${delay?'<div style="margin-top:4px;">'+delay+'</div>':''}${wo}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);text-align:right;">📍 ${r.staging||'No staging area'}</div>
    </div>
    ${dmg}${dlr}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">${actions}</div>
  </div>`;
}

async function saveShipping() {
  const date=document.getElementById('sf-date')?.value, loadNum=document.getElementById('sf-loadnum')?.value?.trim();
  const customer=document.getElementById('sf-customer')?.value?.trim(), product=document.getElementById('sf-product')?.value;
  const qty=parseInt(document.getElementById('sf-qty')?.value||'0'), unit=document.getElementById('sf-unit')?.value||'Cases';
  const facility=document.getElementById('sf-facility')?.value||'Hegins', staging=document.getElementById('sf-staging')?.value?.trim()||'';
  const trailer=document.getElementById('sf-trailer')?.value?.trim()||'', driver=document.getElementById('sf-driver')?.value?.trim()||'';
  const schedDep=document.getElementById('sf-sched')?.value||'';
  const stops=parseInt(document.getElementById('sf-stops')?.value||'1')||1;
  const status=(document.getElementById('sf-status')?.value||'Planned').toLowerCase().replace(' ','-');
  const notes=document.getElementById('sf-notes')?.value?.trim()||'';
  if(!date||!loadNum||!customer||!product||!qty){alert('Date, Load #, Customer, Product, and Quantity are required.');return;}
  const record={date,loadNum,customer,product,qty,unit,facility,staging,trailer,driver,schedDep,stops,actDep:'',status,delayReason:'',damageNotes:notes,linkedWO:'',ts:Date.now()};
  try {
    const ref=await db.collection('opsShipping').add(record);
    record._fbId=ref.id; opsShipData.unshift(record);
    await db.collection('activityLog').add({type:'ops-ship',id:loadNum,desc:`Load created: ${loadNum} — ${customer} · ${fmtNum(qty)} ${unit} ${product} [${status}]`,tech:'',date,ts:Date.now()});
    toggleShipForm(); renderShipping(); renderOpsScoreboard();
  } catch(e){console.error(e);alert('Error: '+e.message);}
}

async function updateShipStatus(fbId,newStatus) {
  const record=opsShipData.find(r=>r._fbId===fbId); if(!record)return;
  const update={status:newStatus};
  if(['shipped','delivered'].includes(newStatus)) { const t=new Date(); update.actDep=t.toTimeString().slice(0,5); }
  if(newStatus==='hold') {
    update.delayReason=prompt('Hold/delay reason (optional):')||'';
    const dm=prompt('Damage or shortage notes (optional):')||'';
    if(dm) update.damageNotes=dm;
  }
  try {
    if(!fbId.startsWith('demo-')) await db.collection('opsShipping').doc(fbId).update(update);
    Object.assign(record,update);
    const stLbl={planned:'Planned','in-process':'In Process',staged:'Staged',loaded:'Loaded',shipped:'Shipped',delivered:'Delivered',hold:'Hold / Issue'};
    await db.collection('activityLog').add({type:'ops-ship',id:record.loadNum,desc:`Load ${record.loadNum} → ${stLbl[newStatus]||newStatus}`,tech:'',date:record.date,ts:Date.now()});
    renderShipping(); renderOpsScoreboard();
  } catch(e){console.error(e);alert('Error: '+e.message);}
}

function createWOFromShip(fbId) {
  const r=opsShipData.find(x=>x._fbId===fbId); if(!r)return;
  go('wo-submit');
  setTimeout(()=>{
    const farmEl=document.getElementById('wo-farm');
    if(farmEl){farmEl.value=r.facility||'Hegins'; loadHouses&&loadHouses();}
    const descEl=document.getElementById('wo-desc');
    if(descEl) descEl.value=`Shipping issue — Load ${r.loadNum} (${r.customer}): `;
    const notesEl=document.getElementById('wo-notes');
    if(notesEl) notesEl.value=`Load: ${r.loadNum} | Customer: ${r.customer} | Product: ${r.product} ${r.qty} ${r.unit} | Staging: ${r.staging||'—'}`;
    const pri=document.querySelector('.pri-pill.urgent');
    if(pri) setPri(pri);
  },300);
}

function flagShipIssue(fbId,loadNum) {
  goOps('exceptions');
  setTimeout(()=>{
    const panel=document.getElementById('exc-form-panel');
    if(panel) panel.style.display='block';
    const xDate=document.getElementById('xf-date'); if(xDate) xDate.value=opsToday();
    const xLink=document.getElementById('xf-shiplink'); if(xLink) xLink.value=loadNum;
    const xType=document.getElementById('xf-type'); if(xType) xType.value='Short Load';
    document.getElementById('xf-desc')?.focus();
    setupEnterChain('exc-form-grid',saveException);
  },150);
}

// ── Reconciliation ──
function reconSetDate(mode,btn) {
  opsReconMode_=mode;
  document.querySelectorAll('#ops-reconciliation .pill').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  if(mode==='today'){const el=document.getElementById('recon-date');if(el)el.value=opsToday();}
  renderReconciliation();
}

function renderReconciliation() {
  const mode=opsReconMode_||'today';
  const eggs=opsFilterByDate(opsEggData,mode);
  const pack=opsFilterByDate(opsPackData,mode);
  const ship=opsFilterByDate(opsShipData,mode);

  const produced=eggs.reduce((s,r)=>s+(Number(r.eggs)||0),0);
  const packed  =pack.reduce((s,r)=>s+(Number(r.qty)||0),0);
  const shipped =ship.filter(r=>['shipped','delivered'].includes(r.status)).reduce((s,r)=>s+(Number(r.qty)||0),0);
  const unpacked=Math.max(0,produced-packed), staged=Math.max(0,packed-shipped), variance=produced-packed-shipped;

  const statsEl=document.getElementById('recon-stats');
  if(statsEl) statsEl.innerHTML=sc('s-green',fmtNum(produced),'🥚 Produced')+sc('s-blue',fmtNum(packed),'📦 Packed')+sc('s-amber',fmtNum(shipped),'🚚 Shipped')+sc('s-red',fmtNum(Math.abs(variance)),variance<0?'⬆️ Over':'⚖️ Variance');

  const ins=[];
  if(unpacked>30000) ins.push({cls:'red',msg:`🏭 ${fmtNum(unpacked)} eggs produced but not yet packed — packing may be behind.`});
  else if(unpacked>10000) ins.push({cls:'',msg:`📊 ${fmtNum(unpacked)} eggs awaiting packing.`});
  else if(produced>0) ins.push({cls:'green',msg:'✅ Packing is keeping pace with production.'});
  if(staged>20000) ins.push({cls:'',msg:`🗄️ ${fmtNum(staged)} eggs staged — verify shipments are on schedule.`});
  const holdLoads=ship.filter(r=>r.status==='hold');
  if(holdLoads.length) ins.push({cls:'red',msg:`🚫 ${holdLoads.length} load(s) on hold — immediate action needed.`});
  const plannedLoads=ship.filter(r=>['planned','in-process','staged','loaded'].includes(r.status));
  if(plannedLoads.length) ins.push({cls:'',msg:`⏳ ${plannedLoads.length} load(s) still in progress for this period.`});
  if(!produced&&!packed&&!shipped) ins.push({cls:'',msg:'📋 No data for this period. Log production, packing, and shipping to see reconciliation.'});
  const insEl=document.getElementById('recon-insights');
  if(insEl) insEl.innerHTML=ins.map(i=>`<div class="ops-insight ${i.cls}">${i.msg}</div>`).join('');

  const tbl=document.getElementById('recon-table');
  if(tbl){
    let html='<thead><tr><th>Farm</th><th>Produced</th><th>Packed</th><th>Shipped</th><th>Unpacked</th><th>Staged</th><th>Variance</th></tr></thead><tbody>';
    ['Hegins','Danville'].forEach(farm=>{
      const fe=eggs.filter(r=>r.farm===farm).reduce((s,r)=>s+(Number(r.eggs)||0),0);
      const fs=ship.filter(r=>r.facility===farm&&['shipped','delivered'].includes(r.status)).reduce((s,r)=>s+(Number(r.qty)||0),0);
      const fv=fe-packed-fs;
      const vc=Math.abs(fv)<500?'ok':Math.abs(fv)<2000?'warn':'bad';
      html+=`<tr><td><strong>${farm}</strong></td><td>${fmtNum(fe)}</td><td>—</td><td>${fmtNum(fs)}</td><td>${fmtNum(Math.max(0,fe-packed))}</td><td>—</td><td class="recon-var ${vc}">${fv>0?'+':''}${fmtNum(fv)}</td></tr>`;
    });
    const tvc=Math.abs(variance)<1000?'ok':Math.abs(variance)<5000?'warn':'bad';
    html+=`<tr class="total-row"><td>TOTAL</td><td>${fmtNum(produced)}</td><td>${fmtNum(packed)}</td><td>${fmtNum(shipped)}</td><td>${fmtNum(unpacked)}</td><td>${fmtNum(staged)}</td><td class="recon-var ${tvc}">${variance>0?'+':''}${fmtNum(variance)}</td></tr></tbody>`;
    tbl.innerHTML=html;
  }

  const sTbl=document.getElementById('recon-ship-table');
  if(sTbl){
    if(!ship.length){sTbl.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">No shipping data for this period.</td></tr>';return;}
    const stO={hold:0,'in-process':1,staged:2,loaded:3,planned:4,shipped:5,delivered:6};
    const stL={planned:'Planned','in-process':'In Process',staged:'Staged',loaded:'Loaded',shipped:'Shipped',delivered:'Delivered',hold:'Hold / Issue'};
    const sorted=[...ship].sort((a,b)=>(stO[a.status]||9)-(stO[b.status]||9));
    let html='<thead><tr><th>Load #</th><th>Customer</th><th>Product</th><th>Qty</th><th>Facility</th><th>Sched.</th><th>Status</th></tr></thead><tbody>';
    sorted.forEach(r=>{html+=`<tr><td><strong>${r.loadNum}</strong></td><td>${r.customer}</td><td>${r.product}</td><td>${fmtNum(r.qty)} ${r.unit}</td><td>${r.facility}</td><td>${r.schedDep||'—'}</td><td><span class="ship-badge ${r.status}">${stL[r.status]||r.status}</span></td></tr>`;});
    sTbl.innerHTML=html+'</tbody>';
  }
}

// ── Exceptions ──
function toggleExcForm() {
  const panel=document.getElementById('exc-form-panel'); if(!panel)return;
  const open=panel.style.display!=='none';
  panel.style.display=open?'none':'block';
  if(!open){document.getElementById('xf-date').value=opsToday(); setupEnterChain('exc-form-grid',saveException);}
}

function opsExcView(mode,btn) {
  opsExcView_=mode;
  document.querySelectorAll('#exc-view-pills .pill').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderExceptions();
}

function renderExceptions() {
  let data=[...opsExcData];
  if(opsExcView_==='open') data=data.filter(r=>r.status==='Open'||r.status==='In Progress');
  else if(opsExcView_==='critical') data=data.filter(r=>r.severity==='Critical');
  else if(opsExcView_==='resolved') data=data.filter(r=>r.status==='Resolved');
  data.sort((a,b)=>{const so={Critical:0,High:1,Medium:2,Low:3};return(so[a.severity]||3)-(so[b.severity]||3)||(b.ts||0)-(a.ts||0);});

  const open=opsExcData.filter(r=>r.status==='Open').length;
  const ip=opsExcData.filter(r=>r.status==='In Progress').length;
  const crit=opsExcData.filter(r=>r.severity==='Critical'&&r.status!=='Resolved').length;
  const res=opsExcData.filter(r=>r.status==='Resolved').length;
  const statsEl=document.getElementById('exc-stats');
  if(statsEl) statsEl.innerHTML=sc('s-red',crit,'🔴 Critical')+sc('s-amber',open,'⚠️ Open')+sc('s-blue',ip,'🔄 In Progress')+sc('s-green',res,'✅ Resolved');

  const listEl=document.getElementById('exc-list'); if(!listEl)return;
  if(!data.length){listEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted);font-family:\'IBM Plex Mono\',monospace;font-size:13px;">No exceptions to display. 👍</div>';updateOpsExcBadge();return;}
  listEl.innerHTML=data.map(r=>excCardHtml(r)).join('');
  updateOpsExcBadge();
}

function excCardHtml(r) {
  const icons={'Short Load':'📉','Damaged Product':'💔','Late Load':'⏱️','Equipment Failure':'⚙️','Labor Delay':'👷','Inventory Variance':'⚖️','Labeling Error':'🏷️','Cooler / Temperature Issue':'🌡️'};
  const icon=icons[r.type]||'⚠️';
  const sc2=r.status==='Resolved'?'completed':r.status==='In Progress'?'in-progress':'open';
  const svcls=(r.severity||'low').toLowerCase();
  const bdrColor=r.severity==='Critical'?'var(--red)':r.severity==='High'?'var(--amber)':r.severity==='Medium'?'var(--blue)':'var(--muted)';
  const links=[r.shipLink?`🚚 ${r.shipLink}`:'',r.woLink?`🔧 ${r.woLink}`:''].filter(Boolean);
  let acts='';
  if(r.status==='Open') acts+=`<button class="ops-action-btn" onclick="updateExcStatus('${r._fbId}','In Progress')">▶ In Progress</button>`;
  if(r.status!=='Resolved') acts+=`<button class="ops-action-btn" onclick="updateExcStatus('${r._fbId}','Resolved')">✅ Resolve</button>`;
  acts+=`<button class="ops-action-btn" onclick="createWOFromExc('${r._fbId}')">🔧 Create WO</button>`;
  return `<div class="ops-card" style="border-left-color:${bdrColor}">
    <div style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
      <span style="font-size:18px;">${icon}</span>
      <span style="font-weight:700;font-size:14px;">${r.type}</span>
      <span class="exc-sev ${svcls}">${r.severity}</span>
      <span class="badge ${sc2}" style="font-size:9px;">${r.status}</span>
    </div>
    <div style="font-size:13px;color:var(--ink);margin-bottom:6px;">${r.desc}</div>
    ${r.rootCause?`<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">🔍 Root cause: ${r.rootCause}</div>`:''}
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
      <span style="font-size:11px;color:var(--muted);">📅 ${r.date}</span>
      <span style="font-size:11px;color:var(--muted);">🏢 ${r.dept}</span>
      ${r.owner?`<span style="font-size:11px;color:var(--muted);">👤 ${r.owner}</span>`:''}
      ${links.map(l=>`<span style="font-size:11px;color:var(--green-mid);">${l}</span>`).join('')}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--border);">${acts}</div>
  </div>`;
}

async function saveException() {
  const date=document.getElementById('xf-date')?.value, type=document.getElementById('xf-type')?.value;
  const sev=document.getElementById('xf-sev')?.value, dept=document.getElementById('xf-dept')?.value||'Operations';
  const owner=document.getElementById('xf-owner')?.value?.trim()||'';
  const ship=document.getElementById('xf-shiplink')?.value?.trim()||'', wo=document.getElementById('xf-wolink')?.value?.trim()||'';
  const status=document.getElementById('xf-status')?.value||'Open';
  const desc=document.getElementById('xf-desc')?.value?.trim(), root=document.getElementById('xf-root')?.value?.trim()||'';
  if(!date||!type||!sev||!desc){alert('Date, Type, Severity, and Description are required.');return;}
  const record={date,type,desc,dept,severity:sev,rootCause:root,owner,status,shipLink:ship,woLink:wo,ts:Date.now()};
  try {
    const ref=await db.collection('opsExceptions').add(record);
    record._fbId=ref.id; opsExcData.unshift(record);
    await db.collection('activityLog').add({type:'ops-exc',id:'EXC',desc:`Exception: ${type} — ${sev} (${dept})`,tech:owner,date,ts:Date.now()});
    toggleExcForm(); renderExceptions();
  } catch(e){console.error(e);alert('Error: '+e.message);}
}

async function updateExcStatus(fbId,newStatus) {
  const record=opsExcData.find(r=>r._fbId===fbId); if(!record)return;
  try {
    if(!fbId.startsWith('demo-')) await db.collection('opsExceptions').doc(fbId).update({status:newStatus});
    record.status=newStatus;
    await db.collection('activityLog').add({type:'ops-exc',id:'EXC',desc:`Exception status → ${newStatus}: ${record.type}`,tech:'',date:record.date,ts:Date.now()});
    renderExceptions(); updateOpsExcBadge();
  } catch(e){console.error(e);alert('Error: '+e.message);}
}

function createWOFromExc(fbId) {
  const exc=opsExcData.find(r=>r._fbId===fbId); if(!exc)return;
  go('wo-submit');
  setTimeout(()=>{
    const descEl=document.getElementById('wo-desc');
    if(descEl) descEl.value=`Exception: ${exc.type} — ${exc.desc}`;
    const notesEl=document.getElementById('wo-notes');
    if(notesEl) notesEl.value=`Root cause: ${exc.rootCause||'TBD'} | Dept: ${exc.dept}${exc.shipLink?' | Load: '+exc.shipLink:''}`;
    const prio=exc.severity==='Critical'?'urgent':exc.severity==='High'?'high':'routine';
    const priEl=document.querySelector(`.pri-pill.${prio}`);
    if(priEl) setPri(priEl);
  },300);
}

// ── Enter-key chain ──
function setupEnterChain(containerId, saveFunc) {
  const container=document.getElementById(containerId); if(!container)return;
  const fields=Array.from(container.querySelectorAll('input:not([type=hidden]),select,textarea'));
  fields.forEach((field,idx)=>{
    if(field._opsEnterHandler) field.removeEventListener('keydown',field._opsEnterHandler);
    field._opsEnterHandler=function(e){
      if(e.key==='Enter'&&!e.shiftKey){
        e.preventDefault();
        if(idx<fields.length-1){fields[idx+1].focus();}
        else if(saveFunc){saveFunc();}
      }
    };
    field.addEventListener('keydown',field._opsEnterHandler);
  });
}

// ── Firebase Load ──
async function loadOpsData() {
  try {
    const [eS,pS,sS,xS]=await Promise.all([
      db.collection('opsEggProduction').orderBy('ts','desc').limit(500).get(),
      db.collection('opsPacking').orderBy('ts','desc').limit(500).get(),
      db.collection('opsShipping').orderBy('ts','desc').limit(200).get(),
      db.collection('opsExceptions').orderBy('ts','desc').limit(200).get(),
    ]);
    opsEggData=[]; eS.forEach(d=>opsEggData.push({...d.data(),_fbId:d.id}));
    opsPackData=[]; pS.forEach(d=>opsPackData.push({...d.data(),_fbId:d.id}));
    opsShipData=[]; sS.forEach(d=>opsShipData.push({...d.data(),_fbId:d.id}));
    opsExcData=[]; xS.forEach(d=>opsExcData.push({...d.data(),_fbId:d.id}));
    if(!opsEggData.length&&!opsPackData.length&&!opsShipData.length&&!opsExcData.length) seedOpsDemo();
  } catch(e){ console.warn('loadOpsData:',e.message,'— loading demo data'); seedOpsDemo(); }
  opsInitForms();
}

function startOpsListeners() {
  db.collection('opsEggProduction').orderBy('ts','desc').limit(500).onSnapshot(snap=>{
    opsEggData=[]; snap.forEach(d=>opsEggData.push({...d.data(),_fbId:d.id}));
    if(document.getElementById('panel-dash')?.classList.contains('active')) renderDash();
  },e=>console.error('opsEgg listener:',e));
  db.collection('opsPacking').orderBy('ts','desc').limit(500).onSnapshot(snap=>{
    opsPackData=[]; snap.forEach(d=>opsPackData.push({...d.data(),_fbId:d.id}));
    if(window._pkgSection==='packing') renderPacking();
    if(document.getElementById('panel-dash')?.classList.contains('active')) renderDash();
  },e=>console.error('opsPack listener:',e));
  db.collection('opsShipping').orderBy('ts','desc').limit(200).onSnapshot(snap=>{
    opsShipData=[]; snap.forEach(d=>opsShipData.push({...d.data(),_fbId:d.id}));
    if(window._shipSection==='shipping') renderShipping();
    if(document.getElementById('panel-dash')?.classList.contains('active')) renderDash();
  },e=>console.error('opsShip listener:',e));
  db.collection('opsExceptions').orderBy('ts','desc').limit(200).onSnapshot(snap=>{
    opsExcData=[]; snap.forEach(d=>opsExcData.push({...d.data(),_fbId:d.id}));
    if(window._shipSection==='exceptions') renderExceptions();
    if(document.getElementById('panel-dash')?.classList.contains('active')) renderDash();
    updateOpsExcBadge();
  },e=>console.error('opsExc listener:',e));
}

function opsInitForms() {
  const t=opsToday(), s=shiftFromTime();
  const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  sv('ef-date',t); sv('ef-shift',s);
  sv('pf-date',t); sv('pf-shift',s);
  sv('sf-date',t);
  sv('xf-date',t);
  sv('egg-filter-date',t);
  sv('pack-filter-date',t);
  sv('recon-date',t);
  setupEnterChain('egg-form-grid',saveEggByBarn);
  setupEnterChain('pack-form-grid',savePacking);
}

// ── Demo seed data ──
function seedOpsDemo() {
  const now=new Date(), todayStr=now.toISOString().slice(0,10);
  const dayStr=n=>{const d=new Date(now);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
  const hH=['House 1','House 2','House 3','House 4','House 5','House 6','House 7','House 8'];
  const dH=['House 1','House 2','House 3','House 4','House 5'];
  const prods=['Large','XL','Jumbo','Medium'];
  const custs=['Walmart Distribution','Giant Food','Acme Grocery','Regional Foodbank','Metro Mart'];
  let rid=1; const mkId=()=>'demo-'+(rid++);
  for(let i=-6;i<=0;i++){
    const ds=dayStr(i), ts=new Date(now);ts.setDate(ts.getDate()+i);ts.setHours(6,0,0,0);
    hH.forEach(h=>opsEggData.push({_fbId:mkId(),date:ds,farm:'Hegins',house:h,shift:'AM',eggs:8500+Math.floor(Math.random()*2500),by:'Auto',notes:'',ts:ts.getTime()}));
    dH.forEach(h=>opsEggData.push({_fbId:mkId(),date:ds,farm:'Danville',house:h,shift:'AM',eggs:7200+Math.floor(Math.random()*2000),by:'Auto',notes:'',ts:ts.getTime()}));
    prods.forEach(p=>{
      opsPackData.push({_fbId:mkId(),date:ds,product:p,qty:900+Math.floor(Math.random()*500),unit:'Dozen',line:'Line 1',shift:'AM',by:'Auto',notes:'',ts:ts.getTime()+3600000});
      if(p==='Large'||p==='XL') opsPackData.push({_fbId:mkId(),date:ds,product:p,qty:400+Math.floor(Math.random()*300),unit:'Dozen',line:'Line 2',shift:'PM',by:'Auto',notes:'',ts:ts.getTime()+7200000});
    });
    if(i<0){
      const cust=custs[Math.abs(i)%custs.length], prod=prods[Math.abs(i)%prods.length], onTime=Math.random()>0.2;
      opsShipData.push({_fbId:mkId(),date:ds,loadNum:'L-'+String(100+Math.abs(i)).padStart(3,'0'),customer:cust,product:prod,qty:360+Math.floor(Math.random()*200),unit:'Cases',facility:'Hegins',staging:'Dock A',trailer:'TRL-'+String(4000+Math.abs(i)*111),driver:'Driver '+Math.abs(i),schedDep:'08:00',actDep:onTime?'07:55':'09:30',status:'delivered',delayReason:onTime?'':'Traffic delay',damageNotes:'',linkedWO:'',ts:ts.getTime()+28800000});
    }
  }
  opsShipData.push({_fbId:'demo-a1',date:todayStr,loadNum:'L-200',customer:'Giant Food',product:'XL',qty:360,unit:'Cases',facility:'Hegins',staging:'Dock B',trailer:'TRL-7789',driver:'Bob Johnson',schedDep:'10:00',actDep:'',status:'staged',delayReason:'',damageNotes:'',linkedWO:'',ts:Date.now()-5000});
  opsShipData.push({_fbId:'demo-a2',date:todayStr,loadNum:'L-201',customer:'Acme Grocery',product:'Jumbo',qty:240,unit:'Cases',facility:'Danville',staging:'Dock A',trailer:'TRL-3344',driver:'Frank Davis',schedDep:'13:00',actDep:'',status:'in-process',delayReason:'',damageNotes:'',linkedWO:'',ts:Date.now()-3000});
  opsShipData.push({_fbId:'demo-a3',date:todayStr,loadNum:'L-202',customer:'Regional Foodbank',product:'Medium',qty:120,unit:'Cases',facility:'Danville',staging:'Dock C',trailer:'',driver:'',schedDep:'15:30',actDep:'',status:'planned',delayReason:'',damageNotes:'',linkedWO:'',ts:Date.now()-1000});
  opsShipData.push({_fbId:'demo-h1',date:todayStr,loadNum:'L-199',customer:'Metro Mart',product:'Large',qty:480,unit:'Cases',facility:'Hegins',staging:'Dock A',trailer:'TRL-5501',driver:'Sam Lee',schedDep:'06:00',actDep:'',status:'hold',delayReason:'Temperature out of range — cooler unit failure',damageNotes:'50 cases flagged for inspection',linkedWO:'WO-042',ts:Date.now()-9000});
  opsExcData.push({_fbId:'demo-e1',date:todayStr,type:'Cooler / Temperature Issue',desc:'Cooler unit A at Hegins dropped to 45°F overnight. 50 cases of Large eggs flagged for inspection.',dept:'Cold Storage',severity:'Critical',rootCause:'Compressor failure — maintenance WO created',owner:'Maintenance Team',status:'In Progress',shipLink:'L-199',woLink:'WO-042',ts:Date.now()-9000});
  opsExcData.push({_fbId:'demo-e2',date:todayStr,type:'Late Load',desc:'L-201 running 45 minutes behind scheduled departure. Driver reported highway backup.',dept:'Shipping',severity:'Medium',rootCause:'Traffic / weather',owner:'Shipping Manager',status:'In Progress',shipLink:'L-201',woLink:'',ts:Date.now()-4000});
  opsExcData.push({_fbId:'demo-e3',date:dayStr(-1),type:'Short Load',desc:'L-097 delivered 20 cases short. Customer complaint received from Giant Food.',dept:'Shipping',severity:'High',rootCause:'Inventory count error at staging — under review',owner:'Quality Lead',status:'Open',shipLink:'L-097',woLink:'',ts:Date.now()-86400000});
  opsExcData.push({_fbId:'demo-e4',date:dayStr(-1),type:'Equipment Failure',desc:'Grading machine jammed on Line 2. Caused 3-hour packing delay.',dept:'Packing',severity:'High',rootCause:'Belt worn — replacement ordered and installed',owner:'Maintenance',status:'Resolved',shipLink:'',woLink:'WO-039',ts:Date.now()-90000000});
  opsExcData.push({_fbId:'demo-e5',date:dayStr(-1),type:'Inventory Variance',desc:'Hegins House 3 daily count is 900 eggs short vs expected flock production rate.',dept:'Production',severity:'Medium',rootCause:'Under investigation',owner:'Production Lead',status:'Open',shipLink:'',woLink:'',ts:Date.now()-93600000});
}

// ─── KPI TAB ───────────────────────────────────────────────────────────────

function goKpiSection(sec) {
  window._kpiSection = sec;
  document.querySelectorAll('.kpi-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#panel-kpi .sub-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('kpi-' + sec);
  if (el) el.style.display = 'block';
  document.querySelectorAll('#panel-kpi .sub-btn').forEach(b => {
    if (b.dataset.section === sec) b.classList.add('active');
  });
  const today = new Date().toISOString().slice(0,10);
  if (sec === 'dashboard') {
    if (!document.getElementById('kpi-dash-date').value)
      document.getElementById('kpi-dash-date').value = today;
    renderKpiDashboard();
  }
  if (sec === 'log') {
    if (!document.getElementById('kpi-log-date').value)
      document.getElementById('kpi-log-date').value = today;
    renderKpiLog();
  }
  if (sec === 'entry') {
    if (!document.getElementById('ke-date').value)
      document.getElementById('ke-date').value = today;
  }
  if (sec === 'trends') {
    setTimeout(() => renderKpiTrends(), 80);
  }
}

function updateKeHouses() {
  const farm = document.getElementById('ke-farm').value;
  const sel  = document.getElementById('ke-house');
  sel.innerHTML = '<option value="">—</option>';
  for (let h = 1; h <= (EB_HOUSES[farm]||0); h++) {
    const o = document.createElement('option');
    o.value = h; o.textContent = 'House ' + h;
    sel.appendChild(o);
  }
}

function calcKeKpi() {
  const collected = Number(document.getElementById('ke-collected').value) || 0;
  const packedDz  = Number(document.getElementById('ke-packed-dz').value) || 0;
  const row = document.getElementById('ke-kpi-row');
  if (!collected && !packedDz) { row.style.display = 'none'; return; }
  row.style.display = '';
  const pct     = Math.round((collected / EGG_TARGET) * 100);
  const diff    = collected - EGG_TARGET;
  const packPct = collected > 0 ? Math.round(((packedDz * 12) / collected) * 100) : 0;
  const col = kpiCol(pct);
  document.getElementById('ke-kpi-pct').style.color = col;
  document.getElementById('ke-kpi-pct').textContent = pct + '%';
  document.getElementById('ke-kpi-diff').style.color = diff >= 0 ? '#4caf50' : '#e53e3e';
  document.getElementById('ke-kpi-diff').textContent = (diff >= 0 ? '+' : '') + fmtNum(diff);
  document.getElementById('ke-kpi-packrate').style.color = packPct >= 90 ? '#4caf50' : '#d69e2e';
  document.getElementById('ke-kpi-packrate').textContent = packedDz > 0 ? packPct + '%' : '—';
}

async function saveKpiEntry() {
  const date      = document.getElementById('ke-date').value;
  const farm      = document.getElementById('ke-farm').value;
  const house     = document.getElementById('ke-house').value;
  const collected = Number(document.getElementById('ke-collected').value) || 0;
  const packedDz  = Number(document.getElementById('ke-packed-dz').value) || 0;
  const by        = document.getElementById('ke-by').value.trim() || 'Packaging';
  const notes     = document.getElementById('ke-notes').value.trim();
  if (!date || !farm || !house) { alert('Date, farm, and house are required.'); return; }
  if (!collected && !packedDz)  { alert('Enter eggs collected or eggs packed.'); return; }

  const rec = { date, farm, house: String(house), eggsCollected: collected,
    eggsPacked: packedDz, by, notes, ts: Date.now() };
  try {
    const ref = await db.collection('opsEggByBarn').add(rec);
    rec._fbId = ref.id;
    opsEggByBarn = opsEggByBarn.filter(r => !(r.farm===farm && r.house===String(house) && r.date===date));
    opsEggByBarn.unshift(rec);
    clearKeForm();
    renderKpiDashboard();
    renderKpiLog();
    if (document.getElementById('panel-dash')?.classList.contains('active')) renderDash();
  } catch(e) { alert('Save failed: ' + e.message); }
}

function clearKeForm() {
  ['ke-farm','ke-house','ke-collected','ke-packed-dz','ke-by','ke-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('ke-house').innerHTML = '<option value="">—</option>';
  document.getElementById('ke-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('ke-kpi-row').style.display = 'none';
}

function renderKpiDashboard() {
  const date = document.getElementById('kpi-dash-date')?.value || new Date().toISOString().slice(0,10);
  const farmOrder  = ['Hegins','Danville','Rushtown','Turbotville','W&M'];
  const farmHouses = {Hegins:8, Danville:5, Rushtown:5, Turbotville:4, 'W&M':2};

  // Index newest record per farm+house for the selected date
  const barnMap = {};
  (opsEggByBarn||[]).filter(r => r.date === date).forEach(r => {
    const k = r.farm + '-' + r.house;
    if (!barnMap[k] || r.ts > barnMap[k].ts) barnMap[k] = r;
  });

  const totalHouses   = Object.values(farmHouses).reduce((s,v)=>s+v,0);
  const barnsReported = Object.keys(barnMap).length;
  const totalCollected= Object.values(barnMap).reduce((s,r)=>s+(Number(r.eggsCollected)||0),0);
  const totalPackedDz = Object.values(barnMap).reduce((s,r)=>s+(Number(r.eggsPacked)||0),0);
  const totalTarget   = barnsReported * EGG_TARGET;
  const overallPct    = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : null;
  const col           = overallPct !== null ? kpiCol(overallPct) : '#5a8a5a';

  // Feed Conversion Ratio: lbs feed used today ÷ eggs collected (lbs/egg)
  const todayFeedLbs = (() => {
    if (typeof feedReadings === 'undefined' || !feedReadings.length) return null;
    // Sum of yesterday's ending - today's ending per bin (approximate daily consumption)
    const todayStr2 = date;
    const yesterStr = new Date(new Date(date).getTime()-86400000).toISOString().slice(0,10);
    const byBinToday = {}, byBinYest = {};
    feedReadings.forEach(r => {
      if (r.date === todayStr2) { if (!byBinToday[r.binId]||r.ts>byBinToday[r.binId].ts) byBinToday[r.binId]=r; }
      if (r.date === yesterStr) { if (!byBinYest[r.binId]||r.ts>byBinYest[r.binId].ts) byBinYest[r.binId]=r; }
    });
    let totalUsed = 0, counted = 0;
    Object.keys(byBinYest).forEach(bid => {
      if (byBinToday[bid]) {
        const used = (Number(byBinYest[bid].readingLbs)||0) - (Number(byBinToday[bid].readingLbs)||0);
        if (used > 0) { totalUsed += used; counted++; }
      }
    });
    return counted > 0 ? totalUsed : null;
  })();
  const fcr = (todayFeedLbs && totalCollected > 0) ? (todayFeedLbs / totalCollected).toFixed(3) : null;

  // ── Sigma Level — from ACTUAL egg quality defect data (real Six Sigma) ──
  const qRecs = (opsEggQuality||[]).filter(r => r.date === date);
  let sigmaVal = null, sigmaSource = 'none', sigmaSampleN = 0;
  if (qRecs.length > 0) {
    const totalGraded  = qRecs.reduce((s,r)=>s+(Number(r.totalGraded)||0),0);
    const totalDefects = qRecs.reduce((s,r)=>
      (Number(r.cracks)||0)+(Number(r.dirties)||0)+(Number(r.softShells)||0)+
      (Number(r.bloodSpots)||0)+(Number(r.floorEggs)||0)+s, 0);
    if (totalGraded > 0) {
      const passRate = ((totalGraded - totalDefects) / totalGraded) * 100;
      sigmaVal = sigmaLevel(passRate);
      sigmaSource = 'quality';
      sigmaSampleN = totalGraded;
    }
  }
  // Fallback: use throughput % only if no quality data yet today
  if (sigmaVal === null && overallPct !== null) {
    sigmaVal = sigmaLevel(overallPct);
    sigmaSource = 'throughput';
  }
  const blt = sigmaVal !== null ? sigmaBeltLabel(sigmaVal) : null;

  // Stats bar
  const statsEl = document.getElementById('kpi-dash-stats');
  if (statsEl) statsEl.innerHTML = `
    <div style="background:#0a1f0a;border:1px solid #2a5a2a;border-radius:10px;padding:14px 10px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:700;color:${col};line-height:1;">${overallPct !== null ? overallPct+'%' : '—'}</div>
      <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">KPI</div>
      <div style="background:#163016;border-radius:3px;height:4px;overflow:hidden;margin-top:6px;"><div style="height:100%;background:${col};width:${Math.min(100,overallPct||0)}%;border-radius:3px;"></div></div>
    </div>
    <div style="background:#0a1f0a;border:1px solid #2a5a2a;border-radius:10px;padding:14px 10px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#f0ead8;line-height:1;">${fmtNum(totalCollected)}</div>
      <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Eggs Collected</div>
    </div>
    <div style="background:#0a1f0a;border:1px solid #2a5a2a;border-radius:10px;padding:14px 10px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#f0ead8;line-height:1;">${fmtNum(totalPackedDz)}<span style="font-size:11px;color:#5a8a5a;">dz</span></div>
      <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Packed</div>
    </div>
    ${sigmaVal !== null ? `<div style="background:${blt.bg};border:1px solid #2a5a2a;border-radius:10px;padding:14px 10px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${blt.color};line-height:1;">${sigmaVal.toFixed(1)}σ</div>
      <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Sigma Level</div>
      <div style="font-size:9px;color:${blt.color};font-family:'IBM Plex Mono',monospace;margin-top:4px;">${blt.label.split('—')[0].trim()}</div>
      <div style="font-size:8px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;margin-top:3px;">${sigmaSource==='quality'?`based on ${sigmaSampleN} eggs graded`:'based on throughput %'}</div>
    </div>` : ''}
    ${fcr !== null ? `<div style="background:#0a1a0f;border:1px solid #1a3a2a;border-radius:10px;padding:14px 10px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#7ab07a;line-height:1;">${fcr}</div>
      <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Feed Conv. Ratio</div>
      <div style="font-size:9px;color:#3a7a5a;font-family:'IBM Plex Mono',monospace;margin-top:4px;">lbs feed / egg</div>
    </div>` : ''}`;
  // Update the stats grid column count
  statsEl.style.gridTemplateColumns = `repeat(${[1,1,1,sigmaVal!==null,fcr!==null].filter(Boolean).length},1fr)`;

  // Per-farm cards (Feed Mill style)
  const cardsEl = document.getElementById('kpi-dash-cards');
  if (!cardsEl) return;

  if (!barnsReported) {
    cardsEl.innerHTML = `<div class="empty"><div class="ei">🥚</div><p>No egg data for this date.<br>Use <strong>Log Eggs</strong> to enter barn counts.</p></div>`;
    return;
  }

  cardsEl.innerHTML = farmOrder.map(farm => {
    const houseCount = farmHouses[farm];
    const farmRecs   = [];
    for (let h = 1; h <= houseCount; h++) {
      const rec = barnMap[farm + '-' + h];
      if (rec) farmRecs.push({ h, rec });
    }
    if (!farmRecs.length) return '';

    const farmCollected = farmRecs.reduce((s,x)=>s+(Number(x.rec.eggsCollected)||0),0);
    const farmPacked    = farmRecs.reduce((s,x)=>s+(Number(x.rec.eggsPacked)||0),0);
    const farmTarget    = farmRecs.length * EGG_TARGET;
    const farmPct       = Math.round((farmCollected / farmTarget) * 100);
    const fc            = kpiCol(farmPct);

    const houseCards = farmRecs.map(({h, rec}) => {
      const collected = Number(rec.eggsCollected) || 0;
      const packedDz  = Number(rec.eggsPacked) || 0;
      const pct       = Math.round((collected / EGG_TARGET) * 100);
      const hc        = kpiCol(pct);
      const diff      = collected - EGG_TARGET;
      const packPct   = collected > 0 && packedDz > 0
        ? Math.round(((packedDz * 12) / collected) * 100) : null;
      return `
        <div style="background:#0d1f0d;border:1px solid #1e3a1e;border-radius:12px;padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#7ab07a;">House ${h}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${hc};">${pct}%</span>
          </div>
          <div style="background:#163016;border-radius:4px;height:12px;overflow:hidden;margin-bottom:10px;">
            <div style="height:100%;width:${Math.min(100,pct)}%;background:${hc};border-radius:4px;"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div style="background:#0a1a0a;border-radius:8px;padding:8px;text-align:center;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:#f0ead8;">${fmtNum(collected)}</div>
              <div style="font-size:9px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;margin-top:2px;">collected</div>
            </div>
            <div style="background:#0a1a0a;border-radius:8px;padding:8px;text-align:center;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:${diff>=0?'#4caf50':'#e53e3e'};">${diff>=0?'+':''}${fmtNum(diff)}</div>
              <div style="font-size:9px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;margin-top:2px;">vs target</div>
            </div>
          </div>
          ${packedDz > 0 ? `
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e3a1e;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:10px;color:#3a7a5a;font-family:'IBM Plex Mono',monospace;">📦 ${fmtNum(packedDz)} dz packed</span>
            ${packPct !== null ? `<span style="font-size:10px;font-weight:700;color:${kpiCol(packPct)};font-family:'IBM Plex Mono',monospace;">${packPct}% pack rate</span>` : ''}
          </div>` : ''}
          ${rec.notes ? `<div style="margin-top:6px;font-size:9px;color:#2a5a2a;font-style:italic;">${rec.notes}</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4caf50;margin-bottom:10px;padding:8px 12px;background:#0c1f0c;border-radius:8px;">
          <span>🐓 ${farm}</span>
          <span style="color:${fc};">${farmPct}% &nbsp;·&nbsp; ${fmtNum(farmCollected)} eggs${farmPacked?` &nbsp;·&nbsp; ${fmtNum(farmPacked)} dz`:''}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">${houseCards}</div>
      </div>`;
  }).join('');
}

function renderKpiLog() {
  const date  = document.getElementById('kpi-log-date')?.value || new Date().toISOString().slice(0,10);
  const rows  = (opsEggByBarn||[]).filter(r => r.date === date)
    .sort((a,b) => a.farm.localeCompare(b.farm) || Number(a.house)-Number(b.house));
  const el    = document.getElementById('kpi-log-table');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div class="empty"><div class="ei">🥚</div><p>No entries for this date.</p></div>';
    return;
  }
  el.innerHTML = `<table class="ops-table"><thead><tr>
    <th>Farm</th><th>House</th><th>Collected</th><th>KPI %</th><th>Packed (Dz)</th><th>By</th>
  </tr></thead><tbody>${rows.map(r => {
    const pct = r.eggsCollected > 0 ? Math.round((r.eggsCollected / EGG_TARGET) * 100) : 0;
    const col = kpiCol(pct);
    return `<tr>
      <td>${r.farm}</td><td>H${r.house}</td>
      <td style="font-family:'IBM Plex Mono',monospace;">${fmtNum(r.eggsCollected||0)}</td>
      <td style="font-family:'IBM Plex Mono',monospace;color:${col};font-weight:700;">${pct}%</td>
      <td style="font-family:'IBM Plex Mono',monospace;">${r.eggsPacked>0?fmtNum(r.eggsPacked)+' dz':'—'}</td>
      <td style="font-size:11px;color:#888;">${r.by}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

// ═══════════════════════════════════════════════════════════════════════════
