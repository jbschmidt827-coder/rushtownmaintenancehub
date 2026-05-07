// ═══════════════════════════════════════════════════════════════════
// END-OF-SHIFT ROLLUP — All barns, all farms, time-weighted
// -------------------------------------------------------------------
// One-tap printable summary leads can review at end of day or hand
// off to the next shift / manager. Pulls from the `barnWalks`
// collection for today and computes time-based completion using the
// same minute math as the dashboard panel.
//
// Exposes a single global: window.openEosRollup()
// Opens a fullscreen modal with print CSS so it prints clean on letter
// paper without the dark theme bleeding through.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Source of truth — must stay aligned with barn-status-panel.js
  const FARMS = { Hegins:8, Danville:5, Rushtown:5, Turbotville:4, 'W&M':2 };
  const BW_MINS = {
    fwv: 0, birdcheck: 120, watertubes: 30, frontofhouse: 45,
    blowoff: 210, wheelbarrow: 25, undercages: 180, hallways: 45,
    flycheck: 15, rodentcheck: 30,
  };
  const STALL_MIN = 45;

  function isTaskShownToday(taskId) {
    const dow = new Date().getDay();
    if (taskId === 'watertubes') return false;
    if (taskId === 'flycheck')   return dow === 2;
    if (taskId === 'rodentcheck')return dow === 5;
    return true;
  }
  function plannedMins() {
    return Object.entries(BW_MINS)
      .filter(([k]) => isTaskShownToday(k))
      .reduce((s, [, m]) => s + m, 0);
  }
  function doneMinsForRec(rec) {
    if (!rec || !rec.checklist) return 0;
    return Object.entries(rec.checklist)
      .filter(([k, v]) => (v === 'pass' || v === 'fail') && isTaskShownToday(k))
      .reduce((s, [k]) => s + (BW_MINS[k] || 0), 0);
  }
  function failCount(rec) {
    if (!rec || !rec.checklist) return 0;
    return Object.values(rec.checklist).filter(v => v === 'fail').length;
  }
  function failTaskNames(rec) {
    if (!rec || !rec.checklist) return [];
    return Object.entries(rec.checklist)
      .filter(([, v]) => v === 'fail')
      .map(([k]) => k);
  }

  function fmtMin(m) {
    if (!m) return '0m';
    if (m < 60) return Math.round(m) + 'm';
    const h = Math.floor(m/60), mm = Math.round(m%60);
    return mm ? h + 'h ' + mm + 'm' : h + 'h';
  }
  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  }
  function fmtAgo(ts) {
    if (!ts) return '';
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m/60);
    return h + 'h ' + (m%60) + 'm ago';
  }
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function classifyRec(rec) {
    if (!rec) return 'not-started';
    const sub = rec.status === 'pending-review' || rec.status === 'approved';
    if (sub) return 'submitted';
    const fb = failCount(rec);
    if (fb > 0) return 'failing';
    const idle = rec.ts ? Date.now() - rec.ts : 0;
    if (idle >= STALL_MIN * 60000) return 'stalled';
    if (doneMinsForRec(rec) > 0) return 'in-progress';
    return 'opened';
  }

  // Map status → display props
  const STATUS = {
    'submitted':   { icon:'✅', label:'Submitted',   color:'#0f7b3a' },
    'failing':     { icon:'⚠️', label:'Has FAILs',   color:'#b91c1c' },
    'stalled':     { icon:'⏸',  label:'Stalled',    color:'#c2410c' },
    'in-progress': { icon:'⏳', label:'In Progress', color:'#a16207' },
    'opened':      { icon:'◐',  label:'Opened',     color:'#475569' },
    'not-started': { icon:'○',  label:'Not Started',color:'#94a3b8' },
  };

  // ── Build the rollup modal ────────────────────────────────────
  async function fetchTodayWalks() {
    if (typeof db === 'undefined' || !db) return [];
    const today = new Date().toISOString().slice(0, 10);
    try {
      const snap = await db.collection('barnWalks').where('date', '==', today).get();
      return snap.docs.map(d => d.data());
    } catch (e) { console.warn('[rollup] fetch failed:', e); return []; }
  }

  async function openEosRollup() {
    // Tear down any prior modal
    document.getElementById('eos-rollup-modal')?.remove();

    const planned = plannedMins();
    const today   = new Date();
    const dateStr = today.toLocaleDateString([], { weekday:'long', month:'long', day:'numeric', year:'numeric' });
    const timeStr = today.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });

    // Loading shell first
    const shell = document.createElement('div');
    shell.id = 'eos-rollup-modal';
    shell.style.cssText = 'position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,0.78);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto;';
    shell.innerHTML = `
      <div id="eos-rollup-paper" style="background:#fff;color:#1a1a1a;max-width:900px;width:100%;border-radius:10px;padding:24px 28px;font-family:'IBM Plex Sans',system-ui,sans-serif;">
        <div style="text-align:center;padding:60px 0;color:#5a5a5a;font-family:'IBM Plex Mono',monospace;">Loading…</div>
      </div>`;
    shell.addEventListener('click', e => { if (e.target === shell) shell.remove(); });
    document.body.appendChild(shell);

    const walks = await fetchTodayWalks();
    const todayKey = today.toISOString().slice(0, 10);
    const recByKey = {};
    walks.filter(w => w.date === todayKey).forEach(w => {
      const k = w.farm + '#' + String(w.house || w.barn);
      if (!recByKey[k] || (w.ts || 0) > (recByKey[k].ts || 0)) recByKey[k] = w;
    });

    // Aggregate stats
    const all = [];
    Object.entries(FARMS).forEach(([farm, count]) => {
      for (let h = 1; h <= count; h++) {
        const rec = recByKey[farm + '#' + String(h)];
        all.push({ farm, house: h, rec, status: classifyRec(rec) });
      }
    });
    const totalBarns = all.length;
    const counts = { submitted:0, failing:0, stalled:0, 'in-progress':0, opened:0, 'not-started':0 };
    let totalDone = 0, totalFails = 0;
    all.forEach(b => {
      counts[b.status]++;
      totalDone += doneMinsForRec(b.rec);
      totalFails += failCount(b.rec);
    });
    const aggPct = totalBarns > 0 && planned > 0
      ? Math.round((totalDone / (planned * totalBarns)) * 100)
      : 0;

    // Build per-farm rows
    let bodyHtml = '';
    Object.entries(FARMS).forEach(([farm, count]) => {
      const farmBarns = all.filter(b => b.farm === farm);
      const fSubmit = farmBarns.filter(b => b.status === 'submitted').length;
      const fFail   = farmBarns.filter(b => b.status === 'failing').length;
      const fStall  = farmBarns.filter(b => b.status === 'stalled').length;
      const fNot    = farmBarns.filter(b => b.status === 'not-started').length;
      const fInProg = count - fSubmit - fNot;
      const fDone   = farmBarns.reduce((s, b) => s + doneMinsForRec(b.rec), 0);
      const fPlanned= planned * count;
      const fPct    = fPlanned > 0 ? Math.round((fDone / fPlanned) * 100) : 0;

      bodyHtml += `
        <div class="rollup-farm">
          <div class="rollup-farm-head">
            <span class="rollup-farm-name">${farm}</span>
            <span class="rollup-farm-meta">${count} ${count===1?'barn':'barns'} · ${fSubmit} submitted · ${fInProg} in progress · ${fNot} not started${fFail?' · ' + fFail + ' with FAILs':''}${fStall?' · ' + fStall + ' stalled':''} · ${fPct}% by time (${fmtMin(fDone)} of ${fmtMin(fPlanned)})</span>
          </div>
          <table class="rollup-table">
            <thead>
              <tr>
                <th style="width:50px;">House</th>
                <th style="width:90px;">Status</th>
                <th>Worker</th>
                <th style="width:90px;text-align:right;">% Done</th>
                <th style="width:90px;text-align:right;">Time Done</th>
                <th style="width:50px;text-align:right;">FAIL</th>
                <th style="width:90px;text-align:right;">Last Update</th>
                <th>FAIL Items</th>
              </tr>
            </thead>
            <tbody>`;

      farmBarns.forEach(b => {
        const stat = STATUS[b.status];
        const dn = doneMinsForRec(b.rec);
        const pct = planned > 0 ? Math.round((dn / planned) * 100) : 0;
        const fbN = failCount(b.rec);
        const fbList = failTaskNames(b.rec).join(', ');
        const worker = b.rec?.worker || '—';
        const last = b.rec?.ts ? fmtTime(b.rec.ts) + ' (' + fmtAgo(b.rec.ts) + ')' : '—';
        const rowStyle = b.status === 'failing'  ? 'background:#fef2f2;'
                       : b.status === 'stalled'  ? 'background:#fff7ed;'
                       : b.status === 'submitted'? 'background:#f0fdf4;'
                       : '';
        bodyHtml += `
          <tr style="${rowStyle}">
            <td><strong>H${b.house}</strong></td>
            <td><span style="color:${stat.color};font-weight:600;">${stat.icon} ${stat.label}</span></td>
            <td>${escAttr(worker)}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums;">${b.rec ? pct + '%' : '—'}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums;">${b.rec ? fmtMin(dn) : '—'}</td>
            <td style="text-align:right;color:${fbN>0?'#b91c1c':'#475569'};font-weight:${fbN>0?'700':'400'};">${fbN || ''}</td>
            <td style="text-align:right;color:${b.status==='stalled'?'#c2410c':'#475569'};">${last}</td>
            <td style="font-size:11px;color:#475569;">${escAttr(fbList)}</td>
          </tr>`;
      });

      bodyHtml += `</tbody></table></div>`;
    });

    // Final paper
    const paperHtml = `
      <style id="rollup-style">
        #eos-rollup-paper { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
        #eos-rollup-paper h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
        #eos-rollup-paper .rollup-sub { color: #475569; font-size: 13px; margin-bottom: 16px; }
        #eos-rollup-paper .rollup-actions { display: flex; gap: 8px; margin-bottom: 16px; }
        #eos-rollup-paper .rollup-actions button { padding: 8px 14px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #0f172a; cursor: pointer; font-size: 13px; }
        #eos-rollup-paper .rollup-actions button.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
        #eos-rollup-paper .rollup-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 12px 0 18px; }
        #eos-rollup-paper .rollup-stat { background: #f1f5f9; border-radius: 6px; padding: 10px; text-align: center; }
        #eos-rollup-paper .rollup-stat .v { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1; }
        #eos-rollup-paper .rollup-stat .l { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
        #eos-rollup-paper .rollup-farm { margin-bottom: 18px; }
        #eos-rollup-paper .rollup-farm-head { background: #0f172a; color: #fff; padding: 8px 12px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
        #eos-rollup-paper .rollup-farm-name { font-weight: 700; font-size: 14px; }
        #eos-rollup-paper .rollup-farm-meta { font-size: 11px; opacity: 0.85; }
        #eos-rollup-paper .rollup-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        #eos-rollup-paper .rollup-table th { background: #e2e8f0; color: #0f172a; padding: 6px 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 600; }
        #eos-rollup-paper .rollup-table td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
        #eos-rollup-paper .rollup-foot { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
        @media print {
          body * { visibility: hidden !important; }
          #eos-rollup-modal, #eos-rollup-modal * { visibility: visible !important; }
          #eos-rollup-modal { position: absolute !important; inset: 0 !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
          #eos-rollup-paper { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; padding: 14px !important; }
          .rollup-actions, .rollup-close { display: none !important; }
          .rollup-farm { page-break-inside: avoid; }
        }
      </style>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:12px;">
        <div>
          <h1>End-of-Shift Rollup</h1>
          <div class="rollup-sub">${dateStr} · generated ${timeStr} · all farms, all barns</div>
        </div>
        <button class="rollup-close" onclick="document.getElementById('eos-rollup-modal').remove()" style="border:none;background:none;font-size:20px;cursor:pointer;color:#64748b;padding:0 4px;">✕</button>
      </div>

      <div class="rollup-actions">
        <button class="primary" onclick="window.print()">🖨 Print / Save PDF</button>
        <button onclick="document.getElementById('eos-rollup-modal').remove()">Close</button>
      </div>

      <div class="rollup-stats">
        <div class="rollup-stat"><div class="v" style="color:#0f7b3a;">${counts.submitted}</div><div class="l">Submitted</div></div>
        <div class="rollup-stat"><div class="v" style="color:#a16207;">${counts['in-progress'] + counts.opened}</div><div class="l">In Progress</div></div>
        <div class="rollup-stat"><div class="v" style="color:${counts.stalled>0?'#c2410c':'#0f172a'};">${counts.stalled}</div><div class="l">Stalled</div></div>
        <div class="rollup-stat"><div class="v" style="color:${counts['not-started']>0?'#b91c1c':'#0f172a'};">${counts['not-started']}</div><div class="l">Not Started</div></div>
        <div class="rollup-stat"><div class="v" style="color:${counts.failing>0?'#b91c1c':'#0f172a'};">${counts.failing}</div><div class="l">With FAILs</div></div>
        <div class="rollup-stat"><div class="v">${aggPct}%</div><div class="l">Avg by Time</div></div>
      </div>

      <div style="font-size:13px;color:#0f172a;margin-bottom:14px;">
        <strong>Day plan per barn:</strong> ${fmtMin(planned)} ·
        <strong>Total work logged across all barns:</strong> ${fmtMin(totalDone)} of ${fmtMin(planned * totalBarns)} ·
        <strong>Total FAIL items:</strong> ${totalFails}
      </div>

      ${bodyHtml}

      <div class="rollup-foot">
        Status legend: ✅ Submitted · ⏳ In Progress · ⏸ Stalled (no updates ${STALL_MIN}+ min) · ⚠️ Has FAILs · ◐ Opened · ○ Not Started.
        Time-weighted % uses each task's planned duration. Hidden rows (water tubes, fly check on non-Tue, rodent check on non-Fri) are excluded from totals.
      </div>`;

    const paper = shell.querySelector('#eos-rollup-paper');
    if (paper) paper.innerHTML = paperHtml;
  }

  // Expose globally so the dashboard panel button can call it
  window.openEosRollup = openEosRollup;
})();
