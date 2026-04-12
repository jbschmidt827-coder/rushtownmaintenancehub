// MAINTENANCE SUB-NAV
// ═══════════════════════════════════════════
window._maintSection = 'wo';
function newWorkOrder() {
  go('maint');
  goMaintSection('wo');
  document.getElementById('maint-wo').querySelector('#wo-dash-section').style.display = 'none';
  document.getElementById('wo-submit-section').style.display = 'block';
  document.getElementById('wo-date').value = todayStr;
  // Ensure submit button is enabled when opening a fresh form
  const submitBtn = document.querySelector('#wo-form-card .btn-confirm');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✓ SUBMIT WORK ORDER'; }
}

function goMaintSection(section) {
  window._maintSection = section;
  document.querySelectorAll('.maint-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('#panel-maint .sub-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('maint-' + section);
  if (el) el.style.display = 'block';
  document.querySelectorAll('#panel-maint .sub-btn').forEach(b => {
    if (b.dataset.section === section) b.classList.add('active');
  });
  const renders = {wo:renderWO, pm:renderPM, parts:renderParts, downtime:renderDowntime, log:renderLog, assets:renderAssets, wi:renderWI, calendar:renderMaintCalendar};
  if (renders[section]) renders[section]();
  // Handle WO form state
  if (section === 'wo') {
    const d = document.getElementById('wo-dash-section');
    const s = document.getElementById('wo-submit-section');
    if(d) d.style.display = 'block';
    if(s) s.style.display = 'none';
    const fab = document.getElementById('fab-btn');
    if(fab) fab.style.display = '';
  }
}

// ═══════════════════════════════════════════
// PACKAGING SUB-NAV
// ═══════════════════════════════════════════
window._pkgSection = 'packing';
function goPkgSection(section) {
  window._pkgSection = section;
  document.querySelectorAll('.pkg-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('#panel-pkg .sub-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('pkg-' + section);
  if (el) el.style.display = 'block';
  document.querySelectorAll('#panel-pkg .sub-btn').forEach(b => {
    if (b.dataset.section === section) b.classList.add('active');
  });
  if (section === 'packing') renderPacking();
  if (section === 'eggs') {
    const today = new Date().toISOString().slice(0,10);
    if (!document.getElementById('eb-date').value) document.getElementById('eb-date').value = today;
    if (!document.getElementById('eb-filter-date').value) document.getElementById('eb-filter-date').value = today;
    renderEggByBarn();
  }
  if (section === 'quality') {
    const today = new Date().toISOString().slice(0,10);
    if (!document.getElementById('eq-date').value) document.getElementById('eq-date').value = today;
    if (!document.getElementById('eq-filter-date').value) document.getElementById('eq-filter-date').value = today;
    renderEggQuality();
  }
  if (section === 'efficiency') {
    pkgEffRange('7', document.querySelector('#pkg-efficiency .pill'));
  }
  if (section === 'downtime') {
    const today = new Date().toISOString().slice(0,10);
    if (!document.getElementById('dt-date').value) document.getElementById('dt-date').value = today;
    dtSetRange('7', document.querySelector('#pkg-downtime .pill'));
  }
  if (section === 'waste') {
    const today = new Date().toISOString().slice(0,10);
    if (!document.getElementById('wst-date').value) document.getElementById('wst-date').value = today;
    wstSetRange('7', document.querySelector('#pkg-waste .pill'));
  }
  if (section === 'cooler') {
    const today = new Date().toISOString().slice(0,10);
    if (!document.getElementById('cool-date').value) document.getElementById('cool-date').value = today;
    renderCooler();
  }
}

// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// PACKAGING — EFFICIENCY, DOWNTIME, WASTE, COOLER
// ═══════════════════════════════════════════

let pkgDowntime   = [];
let pkgWaste      = [];
let pkgCooler     = [];

// ── EFFICIENCY ──────────────────────────────
function pkgEffRange(days, btn) {
  document.querySelectorAll('#pkg-efficiency .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const today = new Date();
  const from  = new Date(today); from.setDate(from.getDate() - (parseInt(days)||7) + 1);
  window._pkgEffDays = parseInt(days)||7;
  window._pkgEffFrom = from.toISOString().slice(0,10);
  window._pkgEffTo   = today.toISOString().slice(0,10);
  renderEfficiency();
}

function renderEfficiency() {
  const shiftF   = document.getElementById('eff-filter-shift')?.value   || '';
  const productF = document.getElementById('eff-filter-product')?.value || '';
  const from     = window._pkgEffFrom || '';
  const to       = window._pkgEffTo   || '';

  let rows = [...opsPackData];
  if (from)    rows = rows.filter(r => r.date >= from);
  if (to)      rows = rows.filter(r => r.date <= to);
  if (shiftF)  rows = rows.filter(r => r.shift === shiftF);
  if (productF)rows = rows.filter(r => r.product === productF);

  // Stats
  const statsEl = document.getElementById('eff-stats');
  const totalDz  = rows.reduce((s,r) => s+(Number(r.qty)||0), 0);
  const withTime = rows.filter(r => r.runMin > 0);
  const avgDzHr  = withTime.length ? Math.round(withTime.reduce((s,r)=>s+(Number(r.dzPerHr)||0),0)/withTime.length) : 0;
  const totalRunMin = withTime.reduce((s,r)=>s+(Number(r.runMin)||0),0);
  const totalDtMin  = rows.reduce((s,r)=>s+(Number(r.downtimeMin)||0),0);
  const effPct   = (totalRunMin+totalDtMin)>0 ? Math.round((totalRunMin/(totalRunMin+totalDtMin))*100) : null;
  if (statsEl) statsEl.innerHTML =
    sc('s-blue',  fmtNum(totalDz)+' dz', '📦 Total Packed') +
    sc(avgDzHr>0?'s-green':'s-blue', avgDzHr?fmtNum(avgDzHr)+' dz/hr':'—', '⚡ Avg Dz/Hr') +
    sc(effPct!==null?(effPct>=90?'s-green':effPct>=75?'s-amber':'s-red'):'s-blue', effPct!==null?effPct+'%':'—', '🎯 Line Efficiency') +
    sc('s-amber', rows.length, '📋 Entries');

  // Daily sparkline
  const days = window._pkgEffDays || 7;
  const today = new Date();
  const dateRange = Array.from({length:days},(_,i)=>{
    const d=new Date(today); d.setDate(d.getDate()-i); return d.toISOString().slice(0,10);
  }).reverse();

  const byDate = {};
  rows.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = {dz:0, dzhr:[], entries:0};
    byDate[r.date].dz += Number(r.qty)||0;
    if (r.dzPerHr>0) byDate[r.date].dzhr.push(Number(r.dzPerHr));
    byDate[r.date].entries++;
  });

  const sparkEl = document.getElementById('eff-sparkline-wrap');
  if (sparkEl) {
    const allAvgs = dateRange.map(d => byDate[d]?.dzhr.length ? Math.round(byDate[d].dzhr.reduce((s,v)=>s+v,0)/byDate[d].dzhr.length) : null);
    const maxAvg  = Math.max(...allAvgs.filter(v=>v!==null), 1);
    const hasData = allAvgs.some(v=>v!==null);
    if (!hasData) {
      sparkEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">No packing entries with time data in this range.</div>';
    } else {
      sparkEl.innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:6px;height:80px;padding-bottom:4px;">
          ${dateRange.map((date,i) => {
            const avg = allAvgs[i];
            const h   = avg !== null ? Math.max(8, Math.round((avg/maxAvg)*80)) : 6;
            const col = avg === null ? '#e5e7eb' : avg >= avgDzHr*1.1 ? '#4caf50' : avg >= avgDzHr*0.9 ? '#3b82f6' : '#f59e0b';
            const isToday = date === today.toISOString().slice(0,10);
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#6b7280;">${avg!==null?fmtNum(avg):''}</div>
              <div title="${date}: ${avg!==null?fmtNum(avg)+' dz/hr':'No data'}" style="width:100%;height:${h}px;background:${col};border-radius:3px 3px 0 0;${isToday?'outline:2px solid #1d4ed8;':''}"></div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#9ca3af;white-space:nowrap;">${date.slice(5)}</div>
            </div>`;
          }).join('')}
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b7280;margin-top:6px;">
          🟢 Above avg &nbsp; 🔵 On target &nbsp; 🟡 Below avg &nbsp; ⬜ No data
        </div>`;
    }
  }

  // Weekly summary table
  const tbl = document.getElementById('eff-weekly-table');
  if (tbl) {
    const weeks = {};
    rows.forEach(r => {
      const d = new Date(r.date); d.setDate(d.getDate() - d.getDay());
      const wk = d.toISOString().slice(0,10);
      if (!weeks[wk]) weeks[wk] = {dz:0, runMin:0, dtMin:0, dzhr:[], stops:0, entries:0};
      weeks[wk].dz    += Number(r.qty)||0;
      weeks[wk].runMin+= Number(r.runMin)||0;
      weeks[wk].dtMin += Number(r.downtimeMin)||0;
      if (r.dzPerHr>0) weeks[wk].dzhr.push(Number(r.dzPerHr));
      weeks[wk].stops += Number(r.stops)||0;
      weeks[wk].entries++;
    });
    const weekEntries = Object.entries(weeks).sort((a,b)=>b[0].localeCompare(a[0]));
    if (!weekEntries.length) {
      tbl.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No data in range.</td></tr>';
    } else {
      tbl.innerHTML = `<thead><tr><th>Week Of</th><th>Total Dz</th><th>Avg Dz/Hr</th><th>Run Time</th><th>Downtime</th><th>Stops</th></tr></thead><tbody>
        ${weekEntries.map(([wk, w]) => {
          const avgHr = w.dzhr.length ? Math.round(w.dzhr.reduce((s,v)=>s+v,0)/w.dzhr.length) : 0;
          const runH  = Math.floor(w.runMin/60), runM = w.runMin%60;
          const dtH   = Math.floor(w.dtMin/60),  dtM  = w.dtMin%60;
          return `<tr>
            <td style="font-family:'IBM Plex Mono',monospace;">${wk}</td>
            <td style="font-weight:700;">${fmtNum(w.dz)}</td>
            <td style="color:#4caf50;font-weight:700;">${avgHr?fmtNum(avgHr):' —'}</td>
            <td style="font-family:'IBM Plex Mono',monospace;">${runH>0?runH+'h ':''} ${runM}m</td>
            <td style="color:${w.dtMin>60?'#e53e3e':'#4caf50'};font-family:'IBM Plex Mono',monospace;">${dtH>0?dtH+'h ':''} ${dtM}m</td>
            <td style="font-weight:700;${w.stops>5?'color:#e53e3e;':''}">${w.stops||'—'}</td>
          </tr>`;
        }).join('')}
      </tbody>`;
    }
  }

  // Product mix
  const mixEl = document.getElementById('eff-product-mix');
  if (mixEl) {
    const byProduct = {};
    rows.forEach(r => { byProduct[r.product] = (byProduct[r.product]||0) + (Number(r.qty)||0); });
    const sorted = Object.entries(byProduct).sort((a,b)=>b[1]-a[1]);
    const grandTotal = sorted.reduce((s,[,v])=>s+v, 0);
    mixEl.innerHTML = sorted.length ? sorted.map(([prod, dz]) => {
      const pct = grandTotal > 0 ? Math.round((dz/grandTotal)*100) : 0;
      return `<div style="background:#f9f9f9;border:1.5px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-weight:700;font-size:13px;">${prod}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#3b82f6;margin:4px 0;">${fmtNum(dz)}<span style="font-size:10px;color:#9ca3af;"> dz</span></div>
        <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:#3b82f6;border-radius:4px;"></div>
        </div>
        <div style="font-size:10px;color:#9ca3af;font-family:'IBM Plex Mono',monospace;margin-top:3px;">${pct}% of mix</div>
      </div>`;
    }).join('') : '<div style="color:var(--muted);font-size:13px;padding:10px;">No data.</div>';
  }
}

// ── DOWNTIME ──────────────────────────────
function calcDtDuration() {
  const start = document.getElementById('dt-start')?.value;
  const end   = document.getElementById('dt-end')?.value;
  if (!start || !end) return;
  const [sh,sm] = start.split(':').map(Number);
  const [eh,em] = end.split(':').map(Number);
  const min = Math.max(0,(eh*60+em)-(sh*60+sm));
  document.getElementById('dt-duration').value = min || '';
}

function dtSetRange(days, btn) {
  document.querySelectorAll('#pkg-downtime .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const today = new Date();
  const from  = new Date(today); from.setDate(from.getDate()-(parseInt(days)||7)+1);
  document.getElementById('dt-filter-from').value = from.toISOString().slice(0,10);
  document.getElementById('dt-filter-to').value   = today.toISOString().slice(0,10);
  renderDowntime();
}

async function saveDowntime() {
  const date     = document.getElementById('dt-date').value;
  const shift    = document.getElementById('dt-shift').value;
  const start    = document.getElementById('dt-start').value;
  const end      = document.getElementById('dt-end').value;
  const duration = parseInt(document.getElementById('dt-duration').value)||0;
  const reason   = document.getElementById('dt-reason').value;
  const line     = document.getElementById('dt-line').value.trim();
  const by       = document.getElementById('dt-by').value.trim();
  const wo       = document.getElementById('dt-wo').value.trim();
  const desc     = document.getElementById('dt-desc').value.trim();
  const resolution = document.getElementById('dt-resolution').value.trim();
  if (!date||!reason||!by||!duration) return alert('Date, Reason, Duration, and Logged By are required.');
  const data = { date, shift, startTime:start, endTime:end, durationMin:duration, reason, line, by, wo, description:desc, resolution, ts:Date.now() };
  try {
    const ref = await db.collection('pkgDowntime').add(data);
    pkgDowntime.unshift({ ...data, _fbId: ref.id });
    clearDowntimeForm();
    renderDowntime();
    updateDtBadge();
    alert('✅ Downtime logged.');
  } catch(e) { alert('Error: '+e.message); }
}

function clearDowntimeForm() {
  ['dt-date','dt-shift','dt-start','dt-end','dt-duration','dt-reason','dt-line','dt-by','dt-wo','dt-desc','dt-resolution'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    if (id==='dt-date') el.value = new Date().toISOString().slice(0,10);
    else el.value = '';
  });
}

function updateDtBadge() {
  const today = new Date().toISOString().slice(0,10);
  const todayTotal = pkgDowntime.filter(r=>r.date===today).reduce((s,r)=>s+(Number(r.durationMin)||0),0);
  const badge = document.getElementById('pkg-dt-badge');
  if (!badge) return;
  if (todayTotal>0) { badge.textContent=Math.round(todayTotal)+'m'; badge.style.display='inline'; }
  else badge.style.display='none';
}

function renderDowntime() {
  const fromF   = document.getElementById('dt-filter-from')?.value||'';
  const toF     = document.getElementById('dt-filter-to')?.value||'';
  const reasonF = document.getElementById('dt-filter-reason')?.value||'';
  let rows = [...pkgDowntime];
  if (fromF)   rows = rows.filter(r=>r.date>=fromF);
  if (toF)     rows = rows.filter(r=>r.date<=toF);
  if (reasonF) rows = rows.filter(r=>r.reason===reasonF);
  rows.sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts);

  const totalMin   = rows.reduce((s,r)=>s+(Number(r.durationMin)||0),0);
  const avgPerDay  = rows.length ? Math.round(totalMin/Math.max(1, new Set(rows.map(r=>r.date)).size)) : 0;
  const statsEl    = document.getElementById('dt-stats');
  if (statsEl) statsEl.innerHTML =
    sc('s-red',   rows.length, '⏱️ Events') +
    sc(totalMin>120?'s-red':totalMin>60?'s-amber':'s-green', Math.floor(totalMin/60)+'h '+totalMin%60+'m', '⏳ Total Time') +
    sc(avgPerDay>30?'s-amber':'s-green', avgPerDay+'m', '📅 Avg/Day') +
    sc('s-blue',  new Set(rows.map(r=>r.reason)).size, '🗂️ Reason Types');

  // Reasons bar chart
  const chartEl = document.getElementById('dt-reasons-chart');
  if (chartEl) {
    const byReason = {};
    rows.forEach(r => { byReason[r.reason]=(byReason[r.reason]||0)+(Number(r.durationMin)||0); });
    const sorted = Object.entries(byReason).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const maxMin = sorted[0]?.[1]||1;
    chartEl.innerHTML = sorted.length ? sorted.map(([reason,min])=>`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#374151;width:180px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${reason}</div>
        <div style="flex:1;background:#f3f4f6;border-radius:4px;height:18px;overflow:hidden;">
          <div style="height:100%;width:${Math.round((min/maxMin)*100)}%;background:${min===maxMin?'#e53e3e':'#f59e0b'};border-radius:4px;transition:width 0.3s;"></div>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#111827;width:55px;text-align:right;">${Math.floor(min/60)>0?Math.floor(min/60)+'h ':''} ${min%60}m</div>
      </div>`).join('') : '<div style="color:var(--muted);padding:10px;">No data.</div>';
  }

  const tbl = document.getElementById('dt-log-table');
  if (!tbl) return;
  if (!rows.length) { tbl.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);">No downtime records found.</td></tr>'; return; }
  tbl.innerHTML = `<thead><tr><th>Date</th><th>Shift</th><th>Reason</th><th>Duration</th><th>Line</th><th>Logged By</th><th>WO</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td>${r.date||'—'}</td>
      <td>${r.shift||'—'}</td>
      <td><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;font-size:11px;font-family:'IBM Plex Mono',monospace;">${r.reason||'—'}</span></td>
      <td style="font-weight:700;color:${(r.durationMin||0)>30?'#e53e3e':'#374151'};font-family:'IBM Plex Mono',monospace;">${r.durationMin||'—'}m</td>
      <td>${r.line||'—'}</td>
      <td>${r.by||'—'}</td>
      <td>${r.wo?`<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#3b82f6;">${r.wo}</span>`:'—'}</td>
    </tr>`).join('')}
  </tbody>`;
}

// ── WASTE / LOSS ──────────────────────────────
function calcWasteDz() {
  const qty = parseInt(document.getElementById('wst-qty')?.value)||0;
  const dzEl = document.getElementById('wst-dz');
  if (dzEl && qty) dzEl.value = Math.round(qty/12*10)/10;
}

function wstSetRange(days, btn) {
  document.querySelectorAll('#pkg-waste .pill').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const today = new Date();
  const from  = new Date(today); from.setDate(from.getDate()-(parseInt(days)||7)+1);
  document.getElementById('wst-filter-from') || Object.assign(document.createElement('input'),{id:'wst-filter-from'});
  window._wstFrom = from.toISOString().slice(0,10);
  window._wstTo   = today.toISOString().slice(0,10);
  renderWaste();
}

async function saveWaste() {
  const date     = document.getElementById('wst-date').value;
  const farm     = document.getElementById('wst-farm').value;
  const house    = document.getElementById('wst-house').value.trim();
  const category = document.getElementById('wst-category').value;
  const qty      = parseInt(document.getElementById('wst-qty').value)||0;
  const dz       = parseFloat(document.getElementById('wst-dz').value)||Math.round(qty/12*10)/10;
  const by       = document.getElementById('wst-by').value.trim();
  const notes    = document.getElementById('wst-notes').value.trim();
  if (!date||!farm||!category||!qty||!by) return alert('Date, Farm, Category, Quantity, and Logged By are required.');
  const data = { date, farm, house, category, qtyEggs:qty, qtyDz:dz, by, notes, ts:Date.now() };
  try {
    const ref = await db.collection('pkgWaste').add(data);
    pkgWaste.unshift({ ...data, _fbId: ref.id });
    clearWasteForm();
    renderWaste();
    alert('✅ Waste logged.');
  } catch(e) { alert('Error: '+e.message); }
}

function clearWasteForm() {
  ['wst-date','wst-farm','wst-house','wst-category','wst-qty','wst-dz','wst-by','wst-notes'].forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    if (id==='wst-date') el.value=new Date().toISOString().slice(0,10); else el.value='';
  });
}

function renderWaste() {
  const farmF = document.getElementById('wst-filter-farm')?.value||'';
  const catF  = document.getElementById('wst-filter-cat')?.value||'';
  const from  = window._wstFrom||'';
  const to    = window._wstTo||'';
  let rows = [...pkgWaste];
  if (farmF) rows = rows.filter(r=>r.farm===farmF);
  if (catF)  rows = rows.filter(r=>r.category===catF);
  if (from)  rows = rows.filter(r=>r.date>=from);
  if (to)    rows = rows.filter(r=>r.date<=to);
  rows.sort((a,b)=>b.date.localeCompare(a.date));

  const totalEggs = rows.reduce((s,r)=>s+(Number(r.qtyEggs)||0),0);
  const totalDz   = rows.reduce((s,r)=>s+(Number(r.qtyDz)||0),0);
  const statsEl   = document.getElementById('wst-stats');
  if (statsEl) statsEl.innerHTML =
    sc('s-red',   rows.length, '🗑️ Events') +
    sc('s-red',   fmtNum(totalEggs), '🥚 Eggs Lost') +
    sc('s-amber', Math.round(totalDz*10)/10+' dz', '📦 Dozens Lost') +
    sc('s-blue',  new Set(rows.map(r=>r.category)).size, '🗂️ Categories');

  // Category bar chart
  const chartEl = document.getElementById('wst-category-chart');
  if (chartEl) {
    const byCat = {};
    rows.forEach(r=>{ byCat[r.category]=(byCat[r.category]||0)+(Number(r.qtyEggs)||0); });
    const sorted = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const maxVal = sorted[0]?.[1]||1;
    chartEl.innerHTML = sorted.length ? sorted.map(([cat,eggs])=>`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#374151;width:200px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat}</div>
        <div style="flex:1;background:#f3f4f6;border-radius:4px;height:18px;overflow:hidden;">
          <div style="height:100%;width:${Math.round((eggs/maxVal)*100)}%;background:#e53e3e;border-radius:4px;"></div>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#111827;width:70px;text-align:right;">${fmtNum(eggs)} eggs</div>
      </div>`).join('') : '<div style="color:var(--muted);padding:10px;">No waste records.</div>';
  }

  const tbl = document.getElementById('wst-log-table');
  if (!tbl) return;
  if (!rows.length) { tbl.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);">No waste records found.</td></tr>'; return; }
  tbl.innerHTML = `<thead><tr><th>Date</th><th>Farm</th><th>House</th><th>Category</th><th>Eggs</th><th>Dozens</th><th>By</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td>${r.date||'—'}</td><td>${r.farm||'—'}</td><td>${r.house||'—'}</td>
      <td><span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:20px;font-size:11px;font-family:'IBM Plex Mono',monospace;">${r.category||'—'}</span></td>
      <td style="font-weight:700;color:#e53e3e;">${fmtNum(r.qtyEggs||0)}</td>
      <td style="color:#e67e22;">${r.qtyDz||'—'}</td>
      <td>${r.by||'—'}</td>
    </tr>`).join('')}
  </tbody>`;
}

// ── COOLER INVENTORY ──────────────────────────────
async function saveCooler() {
  const date     = document.getElementById('cool-date').value;
  const product  = document.getElementById('cool-product').value;
  const cases    = parseInt(document.getElementById('cool-cases').value)||0;
  const dz       = parseInt(document.getElementById('cool-dz').value)||0;
  const location = document.getElementById('cool-location').value.trim();
  const status   = document.getElementById('cool-status').value;
  const packDate = document.getElementById('cool-packdate').value;
  const load     = document.getElementById('cool-load').value.trim();
  const by       = document.getElementById('cool-by').value.trim();
  const notes    = document.getElementById('cool-notes').value.trim();
  if (!date||!product||!cases||!by) return alert('Date, Product, Cases, and Logged By are required.');
  const daysInCooler = packDate ? Math.max(0,Math.round((new Date(date)-new Date(packDate))/86400000)) : 0;
  const data = { date, product, cases, dz, location, status, packDate, daysInCooler, linkedLoad:load, by, notes, ts:Date.now() };
  try {
    const ref = await db.collection('pkgCooler').add(data);
    pkgCooler.unshift({ ...data, _fbId: ref.id });
    clearCoolerForm();
    renderCooler();
    alert('✅ Cooler entry saved.');
  } catch(e) { alert('Error: '+e.message); }
}

function clearCoolerForm() {
  ['cool-date','cool-product','cool-cases','cool-dz','cool-location','cool-status','cool-packdate','cool-load','cool-by','cool-notes'].forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    if (id==='cool-date') el.value=new Date().toISOString().slice(0,10);
    else if (id==='cool-status') el.value='Available';
    else el.value='';
  });
}

async function updateCoolerStatus(fbId, newStatus) {
  const rec = pkgCooler.find(r=>r._fbId===fbId);
  if (!rec) return;
  rec.status = newStatus;
  await db.collection('pkgCooler').doc(fbId).update({status:newStatus});
  renderCooler();
}

function renderCooler() {
  const statusF  = document.getElementById('cool-filter-status')?.value||'';
  const productF = document.getElementById('cool-filter-product')?.value||'';
  let rows = [...pkgCooler];
  if (statusF)  rows = rows.filter(r=>r.status===statusF);
  if (productF) rows = rows.filter(r=>r.product===productF);
  rows.sort((a,b)=>b.ts-a.ts);

  const today = new Date().toISOString().slice(0,10);
  const available   = rows.filter(r=>r.status==='Available').reduce((s,r)=>s+(Number(r.cases)||0),0);
  const holds       = rows.filter(r=>r.status==='Quality Hold').length;
  const oldEggs     = rows.filter(r=>r.packDate && r.packDate<=new Date(Date.now()-7*86400000).toISOString().slice(0,10) && r.status!=='Shipped').length;
  const totalCases  = rows.filter(r=>r.status!=='Shipped').reduce((s,r)=>s+(Number(r.cases)||0),0);

  const statsEl = document.getElementById('cool-stats');
  if (statsEl) statsEl.innerHTML =
    sc('s-blue',  totalCases+' cases', '🧊 In Cooler') +
    sc('s-green', available+' cases',  '✅ Available') +
    sc(holds>0?'s-red':'s-green', holds, '🚨 Quality Holds') +
    sc(oldEggs>0?'s-amber':'s-green', oldEggs, '⏰ Aging (7d+)');

  // Age alerts
  const alertEl = document.getElementById('cool-age-alerts');
  const aging = rows.filter(r=>r.packDate && r.status!=='Shipped' && Math.round((new Date(today)-new Date(r.packDate))/86400000)>=5);
  if (alertEl) {
    if (aging.length) {
      alertEl.innerHTML = `<div style="background:#fff8e1;border:2px solid #f59e0b;border-radius:12px;padding:14px 16px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#d97706;margin-bottom:8px;">⏰ Aging Inventory — ${aging.length} lot(s) 5+ days old</div>
        ${aging.map(r=>{
          const age=Math.round((new Date(today)-new Date(r.packDate))/86400000);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #fde68a;flex-wrap:wrap;gap:4px;">
            <span style="font-weight:700;">${r.product}</span>
            <span style="color:var(--muted);font-size:12px;">${r.location||'—'} · ${r.cases} cases</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:${age>=7?'#e53e3e':'#d97706'};">${age} days old</span>
          </div>`;
        }).join('')}
      </div>`;
    } else alertEl.innerHTML = '';
  }

  const tbl = document.getElementById('cool-log-table');
  if (!tbl) return;
  if (!rows.length) { tbl.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">No cooler records found.</td></tr>'; return; }
  tbl.innerHTML = `<thead><tr><th>Date</th><th>Product</th><th>Cases</th><th>Location</th><th>Pack Date</th><th>Age</th><th>Status</th><th>Load #</th></tr></thead><tbody>
    ${rows.map(r=>{
      const age = r.packDate ? Math.round((new Date(today)-new Date(r.packDate))/86400000) : null;
      const ageTxt = age!==null ? age+'d' : '—';
      const ageCol = age===null?'':age>=7?'color:#e53e3e;font-weight:700;':age>=5?'color:#e67e22;font-weight:600;':'color:#4caf50;';
      const statusColors = {'Available':'background:#d1fae5;color:#065f46','Quality Hold':'background:#fee2e2;color:#991b1b','Reserved for Shipment':'background:#dbeafe;color:#1e40af','Staging for Pickup':'background:#fef3c7;color:#92400e','Shipped':'background:#f3f4f6;color:#6b7280'};
      const sc2 = statusColors[r.status]||'';
      return `<tr>
        <td>${r.date||'—'}</td>
        <td style="font-weight:700;">${r.product||'—'}</td>
        <td style="font-weight:700;">${r.cases||'—'}</td>
        <td>${r.location||'—'}</td>
        <td style="font-family:'IBM Plex Mono',monospace;">${r.packDate||'—'}</td>
        <td style="font-family:'IBM Plex Mono',monospace;${ageCol}">${ageTxt}</td>
        <td><select style="font-size:11px;padding:3px 6px;border-radius:20px;border:none;${sc2};font-family:'IBM Plex Mono',monospace;cursor:pointer;" onchange="updateCoolerStatus('${r._fbId}',this.value)">
          ${['Available','Reserved for Shipment','Quality Hold','Staging for Pickup','Shipped'].map(s=>`<option${s===r.status?' selected':''}>${s}</option>`).join('')}
        </select></td>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;">${r.linkedLoad||'—'}</td>
      </tr>`;
    }).join('')}
  </tbody>`;
}

async function loadPkgExtras() {
  try {
    const [dtSnap, wSnap, cSnap] = await Promise.all([
      db.collection('pkgDowntime').orderBy('ts','desc').limit(500).get(),
      db.collection('pkgWaste').orderBy('ts','desc').limit(500).get(),
      db.collection('pkgCooler').orderBy('ts','desc').limit(500).get(),
    ]);
    pkgDowntime = []; dtSnap.forEach(d=>pkgDowntime.push({...d.data(),_fbId:d.id}));
    pkgWaste    = []; wSnap.forEach(d=>pkgWaste.push({...d.data(),_fbId:d.id}));
    pkgCooler   = []; cSnap.forEach(d=>pkgCooler.push({...d.data(),_fbId:d.id}));
    updateDtBadge();
  } catch(e) { console.error('pkgExtras load:',e); }
}

