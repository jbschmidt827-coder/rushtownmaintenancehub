// ═══════════════════════════════════════════
// DANVILLE LOAD-OUT
// -------------------------------------------
// Track every load of eggs leaving the Danville barn (555,000-bird flock at
// 970 Rushtown Rd). Mirrors the daily log book format the team is already
// used to (Date · Driver · Truck · Trailer · Cases · Destination · SO · Notes)
// but scoped to outbound loads from Danville only — so the "how many eggs did
// we load out today?" question has a one-tap answer.
//
// Firestore collection: danvilleLoads
// State: window.danvilleLoads (array, newest first)
// ═══════════════════════════════════════════

// Drivers known to drive Danville loads (from the Rushtown loads3.xlsx
// Schedule sheet's driver columns). Edit as the roster changes.
const DV_DRIVERS = [
  'Adrianna','Raymond','Bradley','Brad','Joe','Cody','Dave','David',
  'Hector','Christian','Red','Jared','Hess','Ed','Brandon','Eddie',
  'Trevor','Sensenig','Ray','Merle','Jim','Hired out'
];

// Weekly load forecast for the Danville barn (from the Forecast sheet, row
// "Rushtown" 555k birds). Each entry: { weekStart: 'YYYY-MM-DD', loads: 9.21 }
// Keep ~12 weeks rolling. Cases/load ≈ 1550 — adjust if your average drifts.
const DV_FORECAST = [
  {ws:'2026-04-26', loads:9.29},
  {ws:'2026-05-03', loads:9.27},
  {ws:'2026-05-10', loads:9.25},
  {ws:'2026-05-17', loads:9.23},
  {ws:'2026-05-24', loads:9.21},
  {ws:'2026-05-31', loads:9.19},
  {ws:'2026-06-07', loads:9.17},
  {ws:'2026-06-14', loads:9.15},
];
const DV_CASES_PER_LOAD = 1550;

// In-memory state — populated by Firestore listener
window.danvilleLoads = [];
window._dvView = 'today';

// ── Forecast helpers ───────────────────────────────────────
// Return the forecast entry whose weekStart is the Sunday on/before `dateStr`.
function dvForecastForDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const sun = new Date(d); sun.setDate(d.getDate() - day);
  const ws = sun.toISOString().slice(0,10);
  let best = null;
  for (const f of DV_FORECAST) {
    if (f.ws <= ws && (!best || f.ws > best.ws)) best = f;
  }
  return best;
}

function dvWeekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const sun = new Date(d); sun.setDate(d.getDate() - day); sun.setHours(0,0,0,0);
  const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
  return {start: sun.toISOString().slice(0,10), end: sat.toISOString().slice(0,10)};
}

// Client-side sort: newest date+time first. Server query uses a single ts
// orderBy (no composite index required); we sort by user-visible date+time
// here so the table never depends on when the row happened to be saved.
function _dvSort(arr) {
  return arr.slice().sort((a,b) => {
    const aK = (a.date||'') + ' ' + (a.time||'');
    const bK = (b.date||'') + ' ' + (b.time||'');
    if (aK !== bK) return bK.localeCompare(aK);
    return 0;
  });
}

// ── Firestore wiring ──────────────────────────────────────
async function loadDanvilleLoads() {
  try {
    const snap = await db.collection('danvilleLoads').orderBy('ts','desc').limit(500).get();
    const out = [];
    snap.forEach(d => out.push({...d.data(), _fbId: d.id}));
    window.danvilleLoads = _dvSort(out);
  } catch(e) {
    // First-time use: collection may not exist yet — that's fine, leave empty.
    console.warn('loadDanvilleLoads:', e.message);
    window.danvilleLoads = window.danvilleLoads || [];
  }
}

function listenDanvilleLoads() {
  try {
    db.collection('danvilleLoads').orderBy('ts','desc').limit(500)
      .onSnapshot(snap => {
        const out = [];
        snap.forEach(d => out.push({...d.data(), _fbId: d.id}));
        window.danvilleLoads = _dvSort(out);
        if (window._shipSection === 'danville') renderDanvilleLoadout();
      }, e => console.warn('dv listener:', e.message));
  } catch(e) { console.warn('listenDanvilleLoads:', e.message); }
}

// ── UI: form ──────────────────────────────────────────────
function toggleDanvilleLoadForm() {
  const panel = document.getElementById('dv-form-panel');
  if (!panel) return;
  const showing = panel.style.display !== 'none';
  panel.style.display = showing ? 'none' : 'block';
  if (!showing) {
    // pre-fill defaults
    const dEl = document.getElementById('dv-date');
    if (dEl && !dEl.value) dEl.value = (typeof todayStr !== 'undefined') ? todayStr : new Date().toISOString().slice(0,10);
    const tEl = document.getElementById('dv-time');
    if (tEl && !tEl.value) {
      const now = new Date();
      tEl.value = now.toTimeString().slice(0,5);
    }
    const cEl = document.getElementById('dv-cases');
    if (cEl && !cEl.value) cEl.value = DV_CASES_PER_LOAD;
    populateDvDrivers();
  }
}

function populateDvDrivers() {
  const sel = document.getElementById('dv-driver');
  if (sel && sel.options.length <= 1) {
    sel.innerHTML = '<option value="">— Select —</option>' +
      DV_DRIVERS.map(d => `<option value="${d}">${d}</option>`).join('');
  }
  const filt = document.getElementById('dv-driver-filter');
  if (filt && filt.options.length <= 1) {
    filt.innerHTML = '<option value="">All Drivers</option>' +
      DV_DRIVERS.map(d => `<option value="${d}">${d}</option>`).join('');
  }
}

async function saveDanvilleLoad() {
  const date    = document.getElementById('dv-date').value;
  const time    = document.getElementById('dv-time').value;
  const driver  = document.getElementById('dv-driver').value;
  const truck   = document.getElementById('dv-truck').value.trim();
  const trailer = document.getElementById('dv-trailer').value.trim();
  const cases   = parseInt(document.getElementById('dv-cases').value, 10);
  const dest    = document.getElementById('dv-dest').value;
  const so      = document.getElementById('dv-so').value.trim();
  const notes   = document.getElementById('dv-notes').value.trim();

  if (!date || !time || !driver || isNaN(cases) || cases < 0) {
    if (typeof toast === 'function') toast('Date, time, driver and cases are required');
    else alert('Date, time, driver and cases are required.');
    return;
  }

  const rec = {
    date, time, driver, truck, trailer, cases, dest, so, notes,
    facility: 'Danville',
    ts: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (typeof setSyncDot === 'function') setSyncDot('saving');
  try {
    await db.collection('danvilleLoads').add(rec);
    if (typeof setSyncDot === 'function') setSyncDot('ok');
    if (typeof toast === 'function') toast('Load logged ✓');
    // Reset form fields except date (handy when logging multiple loads on the same day)
    ['dv-time','dv-truck','dv-trailer','dv-cases','dv-so','dv-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('dv-driver').value = '';
    toggleDanvilleLoadForm();
  } catch(e) {
    if (typeof setSyncDot === 'function') setSyncDot('error');
    alert('Could not save: ' + e.message);
  }
}

async function deleteDanvilleLoad(fbId) {
  confirmInline('Delete this load entry?', async function () {
    try {
      await db.collection('danvilleLoads').doc(fbId).delete();
      if (typeof toast === 'function') toast('Deleted');
    } catch(e) { alert('Delete failed: ' + e.message); }
  });
  return;
}

function dvSetView(v, btn) {
  window._dvView = v;
  document.querySelectorAll('#dv-view-pills .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDanvilleLoadout();
}

// ── Rendering ──────────────────────────────────────────────
function renderDanvilleLoadout() {
  populateDvDrivers();
  const today = (typeof todayStr !== 'undefined') ? todayStr : new Date().toISOString().slice(0,10);
  const loads = window.danvilleLoads || [];

  // Driver filter
  const driverFilter = document.getElementById('dv-driver-filter')?.value || '';
  const matchesDriver = l => !driverFilter || l.driver === driverFilter;

  // Today + this week slices
  const wk = dvWeekRange(today);
  const todaysLoads = loads.filter(l => l.date === today && matchesDriver(l));
  const weekLoads   = loads.filter(l => l.date >= wk.start && l.date <= wk.end && matchesDriver(l));

  const todayCases = todaysLoads.reduce((s,l) => s + (l.cases||0), 0);
  const weekCases  = weekLoads.reduce((s,l) => s + (l.cases||0), 0);

  // Forecast for this week
  const fc = dvForecastForDate(today);
  const weekTargetLoads = fc ? fc.loads : 9.21;
  const weekTargetCases = Math.round(weekTargetLoads * DV_CASES_PER_LOAD);
  const dailyTargetLoads = weekTargetLoads / 7;
  const dailyTargetCases = Math.round(dailyTargetLoads * DV_CASES_PER_LOAD);
  const weekPct = weekTargetCases > 0 ? Math.round((weekCases / weekTargetCases) * 100) : 0;

  // Top banner: forecast summary
  const tgtSum = document.getElementById('dv-target-summary');
  if (tgtSum) tgtSum.textContent =
    `Week of ${wk.start}: forecast ${weekTargetLoads.toFixed(2)} loads (~${weekTargetCases.toLocaleString()} cases). Daily pace: ${dailyTargetLoads.toFixed(2)} loads (~${dailyTargetCases.toLocaleString()} cases).`;

  // Stat cards
  const sc = (cls, num, label) =>
    `<div class="stat-card"><div class="stat-num ${cls||''}">${num}</div><div class="stat-label">${label}</div></div>`;
  const stats = document.getElementById('dv-stats');
  if (stats) stats.innerHTML =
    sc('', todaysLoads.length, 'Loads Out Today') +
    sc('', todayCases.toLocaleString(), 'Cases Out Today') +
    sc('', weekLoads.length, 'Loads This Week') +
    sc(weekPct>=100?'':'', weekPct + '%', `Week vs Target<br><span style="font-size:10px;color:var(--muted);">${weekCases.toLocaleString()} / ${weekTargetCases.toLocaleString()}</span>`);

  // Week bar (Sun→Sat)
  const weekEl = document.getElementById('dv-week-bar');
  if (weekEl) {
    const days = [];
    const sun = new Date(wk.start + 'T00:00:00');
    for (let i=0; i<7; i++) {
      const d = new Date(sun); d.setDate(sun.getDate()+i);
      const ds = d.toISOString().slice(0,10);
      const dl = weekLoads.filter(l => l.date === ds);
      const dc = dl.reduce((s,l)=>s+(l.cases||0),0);
      days.push({ds, dayName:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i], loads:dl.length, cases:dc, isToday: ds===today});
    }
    const maxCases = Math.max(dailyTargetCases*1.3, ...days.map(d=>d.cases), 1);
    weekEl.innerHTML = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);margin-bottom:6px;">CASES OUT — WEEK OF ${wk.start}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;">
        ${days.map(d => {
          const h = Math.round((d.cases/maxCases) * 110);
          const tgtH = Math.round((dailyTargetCases/maxCases) * 110);
          const onPace = d.cases >= dailyTargetCases;
          const bgColor = d.cases===0 ? '#2a2a2a' : (onPace ? '#2e7d32' : '#856404');
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:10px;color:${d.isToday?'#fcd34d':'var(--muted)'};font-family:'IBM Plex Mono',monospace;font-weight:${d.isToday?'700':'400'};">${d.cases.toLocaleString()}</div>
            <div style="position:relative;width:100%;height:120px;display:flex;align-items:flex-end;justify-content:center;">
              <div style="position:absolute;left:0;right:0;bottom:${tgtH}px;border-top:1px dashed #5a8a5a;opacity:0.5;"></div>
              <div style="width:60%;height:${h}px;background:${bgColor};border-radius:4px 4px 0 0;min-height:2px;"></div>
            </div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#9a9a9a;">${d.dayName}</div>
            <div style="font-size:9px;color:var(--muted);">${d.loads}L</div>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;font-family:'IBM Plex Mono',monospace;">— — — daily target ${dailyTargetCases.toLocaleString()} cases (${dailyTargetLoads.toFixed(2)} loads)</div>
    `;
  }

  // List
  const view = window._dvView || 'today';
  let visible;
  if (view === 'today')      visible = loads.filter(l => l.date === today);
  else if (view === 'week')  visible = loads.filter(l => l.date >= wk.start && l.date <= wk.end);
  else if (view === 'month') {
    const m = today.slice(0,7);
    visible = loads.filter(l => (l.date||'').startsWith(m));
  } else visible = loads;
  visible = visible.filter(matchesDriver);

  const listEl = document.getElementById('dv-list');
  if (!listEl) return;
  if (!visible.length) {
    listEl.innerHTML = `<div class="empty"><div class="ei">🥚</div><p>No loads logged for this view. Tap "Log Load Out" to add the first one.</p></div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="ops-table" style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th>Date</th><th>Time</th><th>Driver</th><th>Truck</th><th>Trailer</th>
          <th style="text-align:right;">Cases</th><th>Destination</th><th>SO #</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>
          ${visible.map(l => `<tr>
            <td>${l.date||''}</td>
            <td>${l.time||''}</td>
            <td><strong>${l.driver||''}</strong></td>
            <td>${l.truck||''}</td>
            <td>${l.trailer||''}</td>
            <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;">${(l.cases||0).toLocaleString()}</td>
            <td>${l.dest||''}</td>
            <td>${l.so||''}</td>
            <td style="font-size:11px;color:var(--muted);max-width:200px;">${(l.notes||'').replace(/</g,'&lt;')}</td>
            <td><button onclick="deleteDanvilleLoad('${l._fbId}')" style="background:transparent;border:none;color:#c92a2a;font-size:14px;cursor:pointer;" title="Delete">🗑️</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);">
      ${visible.length} load${visible.length!==1?'s':''} · ${visible.reduce((s,l)=>s+(l.cases||0),0).toLocaleString()} cases total
    </div>
  `;
}
