// SIX SIGMA / TRENDS
// ═══════════════════════════════════════════════════════════════════════════

let _chartEggSpc = null, _chartMortality = null, _chartPmCompliance = null, _chartDefectPareto = null;

function destroyChart(ref) { try { if (ref) ref.destroy(); } catch(e){} }

// Build array of last N date strings
function lastNDates(n) {
  const arr = [];
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0,10));
  }
  return arr;
}

// Sigma level from defect rate (using normal distribution approximation)
function sigmaLevel(pct) {
  // pct = 0-100; defect rate = (100-pct)/100
  const defectRate = Math.max(0.000001, (100 - pct) / 100);
  // DPMO-based approximation
  const dpmo = defectRate * 1000000;
  if (dpmo <= 3.4)   return 6.0;
  if (dpmo <= 233)   return 5.0;
  if (dpmo <= 6210)  return 4.0;
  if (dpmo <= 66807) return 3.0;
  if (dpmo <= 308537) return 2.0;
  return 1.0;
}

function sigmaBeltLabel(s) {
  if (s >= 6)   return { label:'6σ — World Class', bg:'#1a3a1a', color:'#4caf50' };
  if (s >= 5)   return { label:'5σ — Excellent', bg:'#1a2a1a', color:'#66bb6a' };
  if (s >= 4)   return { label:'4σ — Good', bg:'#2a2a0a', color:'#d69e2e' };
  if (s >= 3)   return { label:'3σ — Average', bg:'#2a1a0a', color:'#ed8936' };
  return               { label:'< 3σ — Needs Work', bg:'#2a0a0a', color:'#e53e3e' };
}

function renderKpiTrends() {
  const farm = document.getElementById('kpi-trend-farm')?.value || 'all';
  const days = parseInt(document.getElementById('kpi-trend-days')?.value || '30');
  const dates = lastNDates(days);
  const farmHouses = {Hegins:8, Danville:5, Rushtown:5, Turbotville:4, 'W&M':2};

  // ── Build per-day KPI% from opsEggByBarn ──
  const dailyKpi = dates.map(date => {
    const recs = (opsEggByBarn||[]).filter(r => {
      if (r.date !== date) return false;
      if (farm !== 'all' && r.farm !== farm) return false;
      return true;
    });
    if (!recs.length) return null;
    const totalCollected = recs.reduce((s,r)=>s+(Number(r.eggsCollected)||0),0);
    const totalTarget    = recs.length * EGG_TARGET;
    return totalTarget > 0 ? Math.round((totalCollected/totalTarget)*100) : null;
  });

  // Filter to days with data for stats (KPI throughput for control chart)
  const dataPoints = dailyKpi.filter(v => v !== null);
  const mean = dataPoints.length ? dataPoints.reduce((s,v)=>s+v,0)/dataPoints.length : 0;
  const variance = dataPoints.length > 1 ? dataPoints.reduce((s,v)=>s+(v-mean)**2,0)/(dataPoints.length-1) : 0;
  const stdDev = Math.sqrt(variance);
  const ucl = Math.min(100, Math.round(mean + 3*stdDev));
  const lcl = Math.max(0,   Math.round(mean - 3*stdDev));

  // ── Sigma from ACTUAL egg quality data (real defect rate) ──
  const qualityPoints = dates.map(date => {
    const recs = (opsEggQuality||[]).filter(r => {
      if (r.date !== date) return false;
      if (farm !== 'all' && r.farm !== farm) return false;
      return true;
    });
    if (!recs.length) return null;
    const totalGraded  = recs.reduce((s,r)=>s+(Number(r.totalGraded)||0),0);
    const totalDefects = recs.reduce((s,r)=>
      (Number(r.cracks)||0)+(Number(r.dirties)||0)+(Number(r.softShells)||0)+
      (Number(r.bloodSpots)||0)+(Number(r.floorEggs)||0)+s, 0);
    return totalGraded > 0 ? ((totalGraded - totalDefects) / totalGraded) * 100 : null;
  });
  const qualityPts = qualityPoints.filter(v => v !== null);
  let avgSigma, sigmaNote;
  if (qualityPts.length > 0) {
    const qMean = qualityPts.reduce((s,v)=>s+v,0) / qualityPts.length;
    avgSigma = sigmaLevel(qMean);
    sigmaNote = `from ${qualityPts.length} quality records`;
  } else {
    avgSigma = dataPoints.length ? sigmaLevel(mean) : 0;
    sigmaNote = 'based on throughput %';
  }
  const belt = sigmaBeltLabel(avgSigma);

  // ── Sigma Level Card ──
  const sigCard = document.getElementById('kpi-sigma-card');
  if (sigCard) sigCard.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
      <div class="ss-stat-card">
        <div class="ss-stat-val" style="color:${belt.color};">${avgSigma.toFixed(1)}σ</div>
        <div class="ss-stat-lbl">Process Sigma</div>
        <div class="ss-sigma-belt" style="background:${belt.bg};color:${belt.color};">${belt.label}</div>
        <div style="font-size:8px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;margin-top:4px;">${sigmaNote}</div>
      </div>
      <div class="ss-stat-card">
        <div class="ss-stat-val" style="color:${kpiCol(mean)}">${mean.toFixed(1)}%</div>
        <div class="ss-stat-lbl">Avg Throughput (${days}d)</div>
      </div>
      <div class="ss-stat-card" style="border-color:#2a3a5a;background:#0a0f1f;">
        <div class="ss-stat-val" style="color:#e53e3e;">${ucl}%</div>
        <div class="ss-stat-lbl">UCL +3σ</div>
      </div>
      <div class="ss-stat-card" style="border-color:#1a2a4a;background:#0a0f1f;">
        <div class="ss-stat-val" style="color:#3b82f6;">${lcl}%</div>
        <div class="ss-stat-lbl">LCL −3σ</div>
      </div>
    </div>`;

  // Short labels (MM/DD)
  const labels = dates.map(d => d.slice(5).replace('-','/'));

  // ── SPC Chart ──
  destroyChart(_chartEggSpc);
  const spcCtx = document.getElementById('chart-egg-spc');
  if (spcCtx) {
    _chartEggSpc = new Chart(spcCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label:'KPI %', data: dailyKpi, borderColor:'#4caf50', backgroundColor:'rgba(76,175,80,.12)', pointBackgroundColor: dailyKpi.map(v => v !== null && v < lcl ? '#e53e3e' : '#4caf50'), pointRadius:4, tension:.3, spanGaps:true },
          { label:'Target (90%)', data: dates.map(()=>90), borderColor:'#d69e2e', borderDash:[6,4], pointRadius:0, borderWidth:1.5 },
          { label:'UCL', data: dates.map(()=>ucl), borderColor:'#e53e3e', borderDash:[4,3], pointRadius:0, borderWidth:1 },
          { label:'LCL', data: dates.map(()=>lcl), borderColor:'#3b82f6', borderDash:[4,3], pointRadius:0, borderWidth:1 }
        ]
      },
      options: {
        responsive:true, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+(ctx.parsed.y!==null?ctx.parsed.y+'%':'no data')}} },
        scales:{
          x:{ ticks:{color:'#5a8a5a',font:{family:'IBM Plex Mono',size:9}}, grid:{color:'#1a2a1a'} },
          y:{ min:0, max:110, ticks:{color:'#5a8a5a',font:{family:'IBM Plex Mono',size:9},callback:v=>v+'%'}, grid:{color:'#1a2a1a'} }
        }
      }
    });
  }

  // ── Mortality Trend Chart (from barnWalks) ──
  const mortMap = {};
  (typeof barnWalksToday !== 'undefined' ? [] : []).forEach(()=>{});
  // Pull from actLog (barnwalk entries) if available
  dates.forEach(d => mortMap[d] = 0);
  (typeof actLog !== 'undefined' ? actLog : []).forEach(e => {
    if (e.type==='barnwalk' && e.date && mortMap.hasOwnProperty(e.date)) {
      mortMap[e.date] = (mortMap[e.date]||0) + (Number(e.mortality)||0);
    }
  });
  const mortData = dates.map(d => mortMap[d] || null);

  destroyChart(_chartMortality);
  const mortCtx = document.getElementById('chart-mortality');
  if (mortCtx) {
    _chartMortality = new Chart(mortCtx, {
      type:'bar',
      data:{ labels, datasets:[{ label:'Mortality', data:mortData, backgroundColor: mortData.map(v=>v>50?'rgba(229,62,62,.7)':'rgba(76,175,80,.5)'), borderColor: mortData.map(v=>v>50?'#e53e3e':'#4caf50'), borderWidth:1 }] },
      options:{ responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>'Mortality: '+(ctx.parsed.y||0)}}}, scales:{ x:{ticks:{color:'#5a8a5a',font:{family:'IBM Plex Mono',size:9}},grid:{color:'#1a2a1a'}}, y:{ticks:{color:'#5a8a5a',font:{family:'IBM Plex Mono',size:9}},grid:{color:'#1a2a1a'},beginAtZero:true} } }
    });
  }

  // ── PM Compliance Chart ──
  // Compute daily PM compliance from pmComps history
  const pmDailyPct = dates.map(d => {
    const doneOnDay = Object.values(pmComps||{}).filter(c=>c.date===d).length;
    const total = ALL_PM.length || 1;
    return doneOnDay > 0 ? Math.min(100, Math.round((doneOnDay/total)*100)) : null;
  });

  destroyChart(_chartPmCompliance);
  const pmCtx = document.getElementById('chart-pm-compliance');
  if (pmCtx) {
    _chartPmCompliance = new Chart(pmCtx, {
      type:'line',
      data:{ labels, datasets:[
        { label:'PM Compliance %', data:pmDailyPct, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,.1)', pointRadius:3, tension:.3, spanGaps:true },
        { label:'Target (90%)', data:dates.map(()=>90), borderColor:'#4caf50', borderDash:[5,4], pointRadius:0, borderWidth:1.5 }
      ]},
      options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#5a8a5a',font:{family:'IBM Plex Mono',size:9}},grid:{color:'#1a2a1a'}}, y:{min:0,max:110,ticks:{color:'#5a8a5a',font:{family:'IBM Plex Mono',size:9},callback:v=>v+'%'},grid:{color:'#1a2a1a'}} } }
    });
  }

  // ── Defect Pareto Chart (from opsEggQuality) ──
  destroyChart(_chartDefectPareto);
  const paretoCtx = document.getElementById('chart-defect-pareto');
  const paretoNote = document.getElementById('kpi-pareto-note');
  const qRecs2 = (opsEggQuality||[]).filter(r => {
    if (farm !== 'all' && r.farm !== farm) return false;
    return dates.includes(r.date);
  });
  if (paretoCtx && qRecs2.length > 0) {
    const defectTotals = {
      'Cracks':      qRecs2.reduce((s,r)=>s+(Number(r.cracks)||0),0),
      'Dirties':     qRecs2.reduce((s,r)=>s+(Number(r.dirties)||0),0),
      'Floor Eggs':  qRecs2.reduce((s,r)=>s+(Number(r.floorEggs)||0),0),
      'Soft Shells': qRecs2.reduce((s,r)=>s+(Number(r.softShells)||0),0),
      'Blood Spots': qRecs2.reduce((s,r)=>s+(Number(r.bloodSpots)||0),0)
    };
    const sorted = Object.entries(defectTotals).sort((a,b)=>b[1]-a[1]);
    const paretoLabels = sorted.map(([k])=>k);
    const paretoCounts = sorted.map(([,v])=>v);
    const totalDef = paretoCounts.reduce((s,v)=>s+v,0);
    // Cumulative % line
    let cum = 0;
    const cumPct = paretoCounts.map(v=>{ cum+=v; return totalDef>0?Math.round(cum/totalDef*100):0; });
    const barColors = ['#e53e3e','#d69e2e','#ed8936','#9b59b6','#3b82f6'];
    _chartDefectPareto = new Chart(paretoCtx, {
      type: 'bar',
      data: {
        labels: paretoLabels,
        datasets: [
          { type:'bar', label:'Defect Count', data:paretoCounts, backgroundColor:barColors, borderRadius:4, yAxisID:'y' },
          { type:'line', label:'Cumulative %', data:cumPct, borderColor:'#f0ead8', pointBackgroundColor:'#f0ead8', pointRadius:4, tension:0, yAxisID:'y2' }
        ]
      },
      options: {
        responsive:true,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx => ctx.dataset.label+': '+(ctx.datasetIndex===1?ctx.parsed.y+'%':ctx.parsed.y) } } },
        scales: {
          x:{ ticks:{color:'#9a9a7a',font:{family:'IBM Plex Mono',size:10}}, grid:{color:'#1a2a1a'} },
          y:{ position:'left', ticks:{color:'#5a8a5a',font:{family:'IBM Plex Mono',size:9}}, grid:{color:'#1a2a1a'}, title:{display:true,text:'Count',color:'#3a6a3a',font:{family:'IBM Plex Mono',size:9}} },
          y2:{ position:'right', min:0, max:100, ticks:{color:'#8a8a6a',font:{family:'IBM Plex Mono',size:9},callback:v=>v+'%'}, grid:{display:false}, title:{display:true,text:'Cumulative %',color:'#6a6a4a',font:{family:'IBM Plex Mono',size:9}} }
        }
      }
    });
    if (paretoNote) paretoNote.textContent = `${totalDef.toLocaleString()} total defects across ${qRecs2.length} quality record${qRecs2.length!==1?'s':''} in last ${days} days`;
  } else if (paretoCtx) {
    // No quality data — show placeholder
    if (paretoNote) paretoNote.textContent = 'No egg quality records in this period. Use Packaging → Egg Quality to log grade-outs.';
  }
}

// ─── EGG BY BARN ───────────────────────────────────────────────────────────

const EB_HOUSES = {Hegins:8, Danville:5, Rushtown:5, Turbotville:4, 'W&M':2};

function updateEbHouses() {
  const farm = document.getElementById('eb-farm').value;
  const sel  = document.getElementById('eb-house');
  sel.innerHTML = '<option value="">—</option>';
  for (let h = 1; h <= (EB_HOUSES[farm]||0); h++) {
    const o = document.createElement('option');
    o.value = h; o.textContent = 'House ' + h;
    sel.appendChild(o);
  }
}

function calcEbKpi() {
  const collected = Number(document.getElementById('eb-collected').value) || 0;
  const packedDz  = Number(document.getElementById('eb-packed-dz').value) || 0;
  const row = document.getElementById('eb-kpi-row');
  if (!collected && !packedDz) { row.style.display = 'none'; return; }
  row.style.display = '';
  const pct     = Math.round((collected / EGG_TARGET) * 100);
  const diff    = collected - EGG_TARGET;
  const packPct = collected > 0 ? Math.round((packedDz * 12 / collected) * 100) : 0;
  const col     = kpiCol(pct);
  document.getElementById('eb-kpi-pct').style.color = col;
  document.getElementById('eb-kpi-pct').textContent = pct + '%';
  document.getElementById('eb-kpi-diff').style.color = diff >= 0 ? '#4caf50' : '#e53e3e';
  document.getElementById('eb-kpi-diff').textContent = (diff >= 0 ? '+' : '') + fmtNum(diff);
  document.getElementById('eb-kpi-packrate').style.color = packPct >= 90 ? '#4caf50' : '#d69e2e';
  document.getElementById('eb-kpi-packrate').textContent = packedDz > 0 ? packPct + '%' : '—';
}

async function loadEggByBarn() {
  try {
    const snap = await db.collection('opsEggByBarn').orderBy('ts','desc').limit(500).get();
    opsEggByBarn = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
  } catch(e) { console.error('opsEggByBarn load:', e); }
}

async function saveEggByBarn() {
  const date      = document.getElementById('eb-date').value;
  const farm      = document.getElementById('eb-farm').value;
  const house     = document.getElementById('eb-house').value;
  const collected = Number(document.getElementById('eb-collected').value) || 0;
  const packedDz  = Number(document.getElementById('eb-packed-dz').value) || 0;
  const by        = document.getElementById('eb-by').value.trim() || 'Packaging';
  const notes     = document.getElementById('eb-notes').value.trim();

  if (!date || !farm || !house) { alert('Date, farm, and house are required.'); return; }
  if (!collected && !packedDz) { alert('Enter at least eggs collected or eggs packed.'); return; }

  const rec = { date, farm, house: String(house), eggsCollected: collected,
    eggsPacked: packedDz, by, notes, ts: Date.now() };

  try {
    const ref = await db.collection('opsEggByBarn').add(rec);
    rec._fbId = ref.id;
    // Replace any existing record for same farm+house+date (keep newest)
    opsEggByBarn = opsEggByBarn.filter(r => !(r.farm===farm && r.house===String(house) && r.date===date));
    opsEggByBarn.unshift(rec);
    clearEbForm();
    renderEggByBarn();
    // Refresh dashboard KPI if visible
    if (document.getElementById('panel-dash')?.classList.contains('active')) renderDash();
  } catch(e) { console.error('saveEggByBarn:', e); alert('Save failed: ' + e.message); }
}

function clearEbForm() {
  ['eb-farm','eb-house','eb-collected','eb-packed-dz','eb-by','eb-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'eb-farm' || id === 'eb-house' ? '' : '';
  });
  document.getElementById('eb-house').innerHTML = '<option value="">—</option>';
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('eb-date').value = today;
  document.getElementById('eb-kpi-row').style.display = 'none';
}

function renderEggByBarn() {
  const filterDate = document.getElementById('eb-filter-date')?.value ||
                     new Date().toISOString().slice(0,10);
  const dayData = opsEggByBarn.filter(r => r.date === filterDate);

  // Summary tiles
  const totalCollected = dayData.reduce((s,r) => s + (Number(r.eggsCollected)||0), 0);
  const totalPackedDz  = dayData.reduce((s,r) => s + (Number(r.eggsPacked)||0), 0);
  const totalTarget    = dayData.length * EGG_TARGET;
  const overallPct     = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : null;
  const col = overallPct !== null ? kpiCol(overallPct) : '#5a8a5a';

  const sumEl = document.getElementById('eb-summary');
  if (sumEl) sumEl.innerHTML = dayData.length === 0 ? '' : `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
      <div style="background:#0a1f0a;border:1px solid #2a5a2a;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${col};">${overallPct !== null ? overallPct+'%' : '—'}</div>
        <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">KPI</div>
      </div>
      <div style="background:#0a1f0a;border:1px solid #2a5a2a;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#f0ead8;">${fmtNum(totalCollected)}</div>
        <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Eggs Collected</div>
      </div>
      <div style="background:#0a1f0a;border:1px solid #2a5a2a;border-radius:10px;padding:12px;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#f0ead8;">${fmtNum(totalPackedDz)}<span style="font-size:12px;color:#5a8a5a;">dz</span></div>
        <div style="font-size:9px;color:#5a8a5a;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Eggs Packed</div>
      </div>
    </div>`;

  // Per-barn rows
  const listEl = document.getElementById('eb-list');
  if (!listEl) return;
  if (dayData.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#3a5a3a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">No entries for this date.</div>';
    return;
  }

  // Sort by farm then house
  const sorted = [...dayData].sort((a,b) => a.farm.localeCompare(b.farm) || Number(a.house)-Number(b.house));
  listEl.innerHTML = sorted.map(r => {
    const pct     = r.eggsCollected > 0 ? Math.round((r.eggsCollected / EGG_TARGET) * 100) : 0;
    const col     = kpiCol(pct);
    const diff    = r.eggsCollected - EGG_TARGET;
    const packPct = r.eggsCollected > 0 && r.eggsPacked > 0
      ? Math.round(((r.eggsPacked * 12) / r.eggsCollected) * 100) : null;
    return `
      <div style="background:#0a1f0a;border:1px solid #1e3a1e;border-radius:12px;padding:14px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#f0ead8;">${r.farm} — House ${r.house}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${col};">${pct}%</span>
        </div>
        <div style="background:#163016;border-radius:4px;height:10px;overflow:hidden;margin-bottom:8px;">
          <div style="height:100%;width:${Math.min(100,pct)}%;background:${col};border-radius:4px;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:10px;">
          <div style="color:#7ab07a;">Collected<br><span style="color:#f0ead8;font-size:13px;font-weight:700;">${fmtNum(r.eggsCollected||0)}</span></div>
          <div style="color:#7ab07a;">vs Target<br><span style="color:${diff>=0?'#4caf50':'#e53e3e'};font-size:13px;font-weight:700;">${diff>=0?'+':''}${fmtNum(diff)}</span></div>
          <div style="color:#7ab07a;">Packed<br><span style="color:#f0ead8;font-size:13px;font-weight:700;">${r.eggsPacked>0?fmtNum(r.eggsPacked)+' dz':'—'}${packPct!==null?' ('+packPct+'%)':''}</span></div>
        </div>
        ${r.notes?`<div style="margin-top:6px;font-size:10px;color:#3a6a3a;font-style:italic;">${r.notes}</div>`:''}
        <div style="margin-top:4px;font-size:9px;color:#2a4a2a;">By: ${r.by}</div>
      </div>`;
  }).join('');
}

// ─── FLOCK TRACKING ────────────────────────────────────────────────────────

const FL_HOUSES = {
  'Turbotville': [1,2,3,4],
  'W&M':         [1,2],
  'Rushtown':    [1,2,3,4,5],
  'Danville':    [1,2,3,4,5],
  'Hegins':      [1,2,3,4,5,6,7,8]
};
// 2.5 years in days
const FL_CYCLE_DAYS = 912;

function updateFlHouses() {
  const farm = document.getElementById('fl-farm').value;
  const sel  = document.getElementById('fl-house');
  sel.innerHTML = '<option value="">—</option>';
  (FL_HOUSES[farm] || []).forEach(h => {
    const o = document.createElement('option');
    o.value = h; o.textContent = 'House ' + h;
    sel.appendChild(o);
  });
}

async function openFlockSection() {
  document.getElementById('flock-section').style.display = 'block';
  document.getElementById('flock-section').scrollTop = 0;
  await loadFlocks();
  renderFlockList();
}

function closeFlockSection() {
  document.getElementById('flock-section').style.display = 'none';
}

async function loadFlocks() {
  try {
    const snap = await db.collection('flocks').orderBy('ts','desc').get();
    flocks = snap.docs.map(d => ({ ...d.data(), _fbId: d.id }));
  } catch(e) { console.error('flocks load:', e); }
}

async function saveFlock() {
  const farm  = document.getElementById('fl-farm').value.trim();
  const house = document.getElementById('fl-house').value;
  const date  = document.getElementById('fl-date').value;
  const birds = Number(document.getElementById('fl-birds').value) || 150000;
  const notes = document.getElementById('fl-notes').value.trim();
  const statusEl = document.getElementById('fl-save-status');

  if (!farm || !house || !date) {
    statusEl.innerHTML = '<span style="color:#e53e3e;">⚠ Farm, house, and date are required.</span>';
    return;
  }

  statusEl.innerHTML = '<span style="color:#d69e2e;">⏳ Saving…</span>';

  // Deactivate any existing active flock for same farm+house
  const existing = flocks.find(f => f.farm === farm && String(f.house) === String(house) && f.status === 'active');
  if (existing && existing._fbId) {
    try {
      await db.collection('flocks').doc(existing._fbId).update({ status: 'depopulated' });
      existing.status = 'depopulated';
    } catch(e) { console.error('flock deactivate:', e); }
  }

  const rec = {
    farm, house: String(house), placedDate: date,
    birdCount: birds, notes, status: 'active',
    ts: Date.now()
  };

  try {
    const ref = await db.collection('flocks').add(rec);
    flocks.unshift({ ...rec, _fbId: ref.id });
    statusEl.innerHTML = '<span style="color:#4caf50;">✅ Flock saved!</span>';
    // Reset form
    document.getElementById('fl-farm').value  = '';
    document.getElementById('fl-house').innerHTML = '<option value="">—</option>';
    document.getElementById('fl-date').value  = '';
    document.getElementById('fl-birds').value = '150000';
    document.getElementById('fl-notes').value = '';
    renderFlockList();
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  } catch(e) {
    console.error('flock save:', e);
    statusEl.innerHTML = '<span style="color:#e53e3e;">⚠ Save failed — check connection.</span>';
  }
}

async function depopulateFlock(fbId) {
  if (!confirm('Mark this flock as depopulated?')) return;
  try {
    await db.collection('flocks').doc(fbId).update({ status: 'depopulated' });
    const f = flocks.find(f => f._fbId === fbId);
    if (f) f.status = 'depopulated';
    renderFlockList();
  } catch(e) { console.error('flock depop:', e); }
}

function renderFlockList() {
  const container = document.getElementById('flock-list-container');
  const active = flocks.filter(f => f.status === 'active');
  const history = flocks.filter(f => f.status !== 'active');
  const today = new Date(); today.setHours(0,0,0,0);

  function flockCard(f) {
    const placed = new Date(f.placedDate + 'T00:00:00');
    const ageDays = Math.floor((today - placed) / 86400000);
    const ageWeeks = Math.floor(ageDays / 7);
    const remDays = FL_CYCLE_DAYS - ageDays;
    const pct = Math.min(100, Math.round((ageDays / FL_CYCLE_DAYS) * 100));
    const depopDate = new Date(placed.getTime() + FL_CYCLE_DAYS * 86400000);
    const depopStr = depopDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const col = pct < 60 ? '#4caf50' : pct < 80 ? '#d69e2e' : '#e53e3e';
    const barCol = pct < 60 ? '#4caf50' : pct < 80 ? '#d69e2e' : '#e53e3e';
    const depopLabel = remDays > 0
      ? remDays + ' days left'
      : Math.abs(remDays) + ' days past cycle';
    const isDepop = f.status !== 'active';
    return `
      <div style="background:#12082a;border:1px solid ${isDepop ? '#3b2a5a' : '#5b21b6'};border-radius:12px;padding:14px;margin-bottom:10px;opacity:${isDepop ? '0.55' : '1'};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#f0ead8;">${f.farm} — House ${f.house}</span>
            ${isDepop ? '<span style="font-size:10px;color:#7c3aed;font-family:\'IBM Plex Mono\',monospace;margin-left:8px;">DEPOP</span>' : ''}
          </div>
          <div style="display:flex;gap:6px;">
            ${!isDepop ? `<button onclick="depopulateFlock('${f._fbId}')" style="font-size:10px;font-family:'IBM Plex Mono',monospace;padding:4px 8px;border-radius:6px;border:1px solid #5b21b6;background:#1a0d2e;color:#a78bfa;cursor:pointer;">Depop</button>` : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
          <div style="background:#0a0618;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${col};">${ageWeeks}</div>
            <div style="font-size:10px;color:#7c6aaa;">weeks old</div>
          </div>
          <div style="background:#0a0618;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#f0ead8;">${(f.birdCount||0).toLocaleString()}</div>
            <div style="font-size:10px;color:#7c6aaa;">birds</div>
          </div>
          <div style="background:#0a0618;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:${col};">${pct}%</div>
            <div style="font-size:10px;color:#7c6aaa;">of cycle</div>
          </div>
        </div>
        <div style="background:#0a0618;border-radius:6px;height:8px;overflow:hidden;margin-bottom:8px;">
          <div style="height:100%;width:${pct}%;background:${barCol};border-radius:6px;transition:width .3s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;font-family:'IBM Plex Mono',monospace;color:#7c6aaa;">
          <span>Placed ${new Date(f.placedDate + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
          <span style="color:${col};">Est. depop ${depopStr} · ${depopLabel}</span>
        </div>
        ${f.notes ? `<div style="margin-top:6px;font-size:10px;color:#9a8aaa;font-style:italic;">${f.notes}</div>` : ''}
      </div>`;
  }

  // Group active flocks by farm
  const farmOrder = ['Turbotville','W&M','Rushtown','Danville','Hegins'];
  let html = '';

  if (active.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:#5a4a7a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">No active flocks yet — add one above.</div>';
  } else {
    farmOrder.forEach(farm => {
      const farmFlocks = active.filter(f => f.farm === farm).sort((a,b) => Number(a.house) - Number(b.house));
      if (!farmFlocks.length) return;
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;margin:14px 0 8px;">${farm}</div>`;
      farmFlocks.forEach(f => { html += flockCard(f); });
    });
  }

  if (history.length > 0) {
    html += `<details style="margin-top:16px;">
      <summary style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5a4a7a;cursor:pointer;padding:4px 0;">▸ History (${history.length} depopulated)</summary>
      <div style="margin-top:10px;">`;
    history.forEach(f => { html += flockCard(f); });
    html += '</div></details>';
  }

  container.innerHTML = html;
}

// ═══════════════════════════════════════════
// EGG QUALITY
// ═══════════════════════════════════════════
let opsEggQuality = [];

async function loadEggQuality() {
  try {
    const snap = await db.collection('opsEggQuality').orderBy('ts','desc').limit(500).get();
    opsEggQuality = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
    db.collection('opsEggQuality').orderBy('ts','desc').limit(500).onSnapshot(snap => {
      opsEggQuality = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
      if (window._pkgSection === 'quality') renderEggQuality();
    });
  } catch(e) { console.warn('loadEggQuality:', e.message); }
}

function updateEqHouses() {
  const farm = document.getElementById('eq-farm').value;
  const houses = {Hegins:8,Danville:5,Rushtown:5,Turbotville:4,'W&M':2};
  const sel = document.getElementById('eq-house');
  sel.innerHTML = '<option value="">—</option>';
  for (let h = 1; h <= (houses[farm]||0); h++) {
    sel.innerHTML += `<option value="${h}">House ${h}</option>`;
  }
}

function calcEqKpi() {
  const total = Number(document.getElementById('eq-total').value) || 0;
  const gradeA = Number(document.getElementById('eq-grade-a').value) || 0;
  const cracks = Number(document.getElementById('eq-cracks').value) || 0;
  const dirties = Number(document.getElementById('eq-dirties').value) || 0;
  const floor = Number(document.getElementById('eq-floor').value) || 0;
  const soft = Number(document.getElementById('eq-soft').value) || 0;
  const blood = Number(document.getElementById('eq-blood').value) || 0;
  const row = document.getElementById('eq-calc-row');
  if (!total) { if (row) row.style.display = 'none'; return; }
  const defects = cracks + dirties + floor + soft + blood;
  const gradeAPct = gradeA > 0 ? Math.round((gradeA/total)*100) : Math.round(((total-defects)/total)*100);
  const defectPct = Math.round((defects/total)*100);
  const sig = sigmaLevel(gradeAPct);
  const blt = sigmaBeltLabel(sig);
  row.style.display = 'block';
  document.getElementById('eq-grade-pct').textContent = gradeAPct + '%';
  document.getElementById('eq-grade-pct').style.color = gradeAPct >= 95 ? '#4caf50' : gradeAPct >= 90 ? '#d69e2e' : '#e53e3e';
  document.getElementById('eq-defect-pct').textContent = defectPct + '%';
  document.getElementById('eq-defect-pct').style.color = defectPct < 5 ? '#4caf50' : defectPct < 10 ? '#d69e2e' : '#e53e3e';
  document.getElementById('eq-sigma').textContent = sig.toFixed(1) + 'σ';
  document.getElementById('eq-sigma').style.color = blt.color;
}

async function saveEggQuality() {
  const date = document.getElementById('eq-date').value;
  const farm = document.getElementById('eq-farm').value;
  const house = document.getElementById('eq-house').value;
  const total = Number(document.getElementById('eq-total').value) || 0;
  if (!date || !farm || !house || !total) { alert('Date, Farm, House, and Total Graded are required.'); return; }
  const gradeA = Number(document.getElementById('eq-grade-a').value) || 0;
  const cracks = Number(document.getElementById('eq-cracks').value) || 0;
  const dirties = Number(document.getElementById('eq-dirties').value) || 0;
  const floor = Number(document.getElementById('eq-floor').value) || 0;
  const soft = Number(document.getElementById('eq-soft').value) || 0;
  const blood = Number(document.getElementById('eq-blood').value) || 0;
  const by = document.getElementById('eq-by').value || 'System';
  const notes = document.getElementById('eq-notes').value || '';
  const defects = cracks + dirties + floor + soft + blood;
  const gradeAPct = gradeA > 0 ? Math.round((gradeA/total)*100) : Math.round(((total-defects)/total)*100);
  const rec = { date, farm, house: String(house), total, gradeA, cracks, dirties, floorEggs:floor, softShells:soft, bloodSpots:blood, defects, gradeAPct, by, notes, ts: Date.now() };
  setSyncDot('saving');
  try {
    const ref = await db.collection('opsEggQuality').add(rec);
    rec._fbId = ref.id;
    opsEggQuality.unshift(rec);
    clearEqForm();
    renderEggQuality();
  } catch(e) { alert('Save failed: ' + e.message); }
  setSyncDot('live');
}

function clearEqForm() {
  ['eq-date','eq-farm','eq-house','eq-by','eq-total','eq-grade-a','eq-cracks','eq-dirties','eq-floor','eq-soft','eq-blood','eq-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const row = document.getElementById('eq-calc-row'); if (row) row.style.display = 'none';
}

function renderEggQuality() {
  const today = new Date().toISOString().slice(0,10);
  const filterDate = document.getElementById('eq-filter-date')?.value || today;
  const rows = (opsEggQuality||[]).filter(r => r.date === filterDate)
    .sort((a,b) => a.farm.localeCompare(b.farm) || Number(a.house)-Number(b.house));
  const dash = document.getElementById('eq-dashboard');
  const log = document.getElementById('eq-log');

  // Stats cards
  const totalGraded = rows.reduce((s,r)=>s+(Number(r.total)||0),0);
  const totalDefects = rows.reduce((s,r)=>s+(Number(r.defects)||0),0);
  const avgGradeA = rows.length ? Math.round(rows.reduce((s,r)=>s+(Number(r.gradeAPct)||0),0)/rows.length) : null;
  const avgSig = avgGradeA !== null ? sigmaLevel(avgGradeA) : null;
  const blt = avgSig !== null ? sigmaBeltLabel(avgSig) : null;

  if (dash) dash.innerHTML = rows.length ? `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
      <div class="ss-stat-card"><div class="ss-stat-val" style="color:#7ab0f0;">${fmtNum(totalGraded)}</div><div class="ss-stat-lbl">Total Graded</div></div>
      <div class="ss-stat-card"><div class="ss-stat-val" style="color:${avgGradeA>=95?'#4caf50':avgGradeA>=90?'#d69e2e':'#e53e3e'};">${avgGradeA}%</div><div class="ss-stat-lbl">Avg Grade A</div></div>
      <div class="ss-stat-card"><div class="ss-stat-val" style="color:${totalDefects/totalGraded*100<5?'#4caf50':'#e53e3e'};">${totalGraded>0?Math.round(totalDefects/totalGraded*100):0}%</div><div class="ss-stat-lbl">Defect Rate</div></div>
      ${avgSig!==null?`<div class="ss-stat-card" style="background:${blt.bg};"><div class="ss-stat-val" style="color:${blt.color};">${avgSig.toFixed(1)}σ</div><div class="ss-stat-lbl">Sigma Level</div></div>`:''}
    </div>` : '';

  if (!rows.length) {
    if (log) log.innerHTML = '<div class="empty"><div class="ei">🏅</div><p>No quality records for this date.</p></div>';
    return;
  }

  // Defect breakdown cards
  const cardHtml = rows.map(r => {
    const defectPct = r.total > 0 ? Math.round((r.defects/r.total)*100) : 0;
    const col = r.gradeAPct >= 95 ? '#4caf50' : r.gradeAPct >= 90 ? '#d69e2e' : '#e53e3e';
    return `<div style="background:#0a1020;border:1px solid #2a3a6a;border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#7ab0f0;">${r.farm} — House ${r.house}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${col};">${r.gradeAPct}% Grade A</span>
      </div>
      <div style="background:#1a2030;border-radius:4px;height:10px;overflow:hidden;margin-bottom:10px;">
        <div style="height:100%;width:${Math.min(100,r.gradeAPct)}%;background:${col};border-radius:4px;"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:10px;font-family:'IBM Plex Mono',monospace;text-align:center;">
        <div style="background:#0c1530;border-radius:6px;padding:6px;"><div style="color:#e53e3e;font-size:14px;font-weight:700;">${fmtNum(r.cracks||0)}</div><div style="color:#5a6a9a;">Cracks</div></div>
        <div style="background:#0c1530;border-radius:6px;padding:6px;"><div style="color:#d69e2e;font-size:14px;font-weight:700;">${fmtNum(r.dirties||0)}</div><div style="color:#5a6a9a;">Dirties</div></div>
        <div style="background:#0c1530;border-radius:6px;padding:6px;"><div style="color:#ed8936;font-size:14px;font-weight:700;">${fmtNum(r.floorEggs||0)}</div><div style="color:#5a6a9a;">Floor</div></div>
        <div style="background:#0c1530;border-radius:6px;padding:6px;"><div style="color:#9b59b6;font-size:14px;font-weight:700;">${fmtNum(r.softShells||0)}</div><div style="color:#5a6a9a;">Soft Shell</div></div>
        <div style="background:#0c1530;border-radius:6px;padding:6px;"><div style="color:#e53e3e;font-size:14px;font-weight:700;">${fmtNum(r.bloodSpots||0)}</div><div style="color:#5a6a9a;">Blood/Meat</div></div>
        <div style="background:#0c1530;border-radius:6px;padding:6px;"><div style="color:#f0ead8;font-size:14px;font-weight:700;">${defectPct}%</div><div style="color:#5a6a9a;">Defect %</div></div>
      </div>
      <div style="margin-top:8px;font-size:10px;color:#5a6a9a;font-family:'IBM Plex Mono',monospace;">${fmtNum(r.total)} graded · by ${r.by}</div>
    </div>`;
  }).join('');
  if (log) log.innerHTML = cardHtml;
}

// ═══════════════════════════════════════════
