// ═══════════════════════════════════════════════════════════════════
// DASHBOARD — Per-Barn Check Status (live)
// -------------------------------------------------------------------
// Adds a real-time grid to the main dashboard showing every barn's
// check progress through the day. Each barn shows:
//   • status icon: not-started · in-progress · submitted · failed
//   • worker name (first name)
//   • % completion BY TIME (not task count)
//   • how long ago the last update was
//
// Subscribes to the `barnWalks` Firestore collection so the grid
// updates live as workers Pass/Fail tasks. Refreshes "Xm ago" labels
// on a 60s tick.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Farms / barn counts ────────────────────────────────────────
  // Keep aligned with CL_FARMS in daily-checklist.js — duplicated
  // here so this panel doesn't depend on that file's load order.
  const FARMS = { Hegins:8, Danville:5, Rushtown:5, Turbotville:4, 'W&M':2 };

  // ── Stalled threshold ──────────────────────────────────────────
  // A barn is "stalled" if it's been started but not submitted AND no
  // updates have come in for STALL_MIN minutes. 45 min is roughly the
  // longest single task on the daily list, so anything past that is a
  // signal someone got pulled away or stuck.
  const STALL_MIN = 45;

  // ── Source of truth for barn-walk task durations (minutes) ─────
  // Mirrors data-minutes on each <div id="bw-cl-..."> row. If a row's
  // data-minutes changes in index.html, update here too.
  const BW_MINS = {
    fwv:           0,    // ongoing — no fixed time budget
    birdcheck:     120,
    watertubes:    30,
    frontofhouse:  45,
    blowoff:       210,
    wheelbarrow:   25,
    undercages:    180,
    hallways:      45,
    flycheck:      15,
    rodentcheck:   30,
  };

  // ── Day-of-week + permanent visibility (matches time-blocks.js) ─
  function isTaskShownToday(taskId) {
    const dow = new Date().getDay();
    if (taskId === 'watertubes') return false;          // moved to monthly PM
    if (taskId === 'flycheck')   return dow === 2;      // Tuesdays only
    if (taskId === 'rodentcheck')return dow === 5;      // Fridays only
    return true;
  }

  function plannedMinutesForToday() {
    return Object.entries(BW_MINS)
      .filter(([k]) => isTaskShownToday(k))
      .reduce((s, [, m]) => s + m, 0);
  }
  function doneMinutesForRec(rec) {
    if (!rec || !rec.checklist) return 0;
    return Object.entries(rec.checklist)
      .filter(([k, v]) => (v === 'pass' || v === 'fail') && isTaskShownToday(k))
      .reduce((s, [k]) => s + (BW_MINS[k] || 0), 0);
  }
  function failCount(rec) {
    if (!rec || !rec.checklist) return 0;
    return Object.values(rec.checklist).filter(v => v === 'fail').length;
  }

  // ── State ──────────────────────────────────────────────────────
  let _walks = [];     // today's barnWalks records
  let _unsub = null;
  let _tick = null;

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function fmtAgo(ts) {
    if (!ts) return '';
    const ms = Date.now() - ts;
    const m = Math.floor(ms / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm ago';
  }

  function fmtMin(m) {
    if (!m) return '0m';
    if (m < 60) return Math.round(m) + 'm';
    const h = Math.floor(m/60), mm = Math.round(m%60);
    return mm ? h + 'h ' + mm + 'm' : h + 'h';
  }

  // Safe HTML attribute escape — needed because farm names can contain
  // characters (W&M has &) that would otherwise break the attribute or
  // the title tooltip when rendered inside template strings.
  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Render ─────────────────────────────────────────────────────
  function render() {
    const el = document.getElementById('dash-barn-status');
    if (!el) return;

    const planned = plannedMinutesForToday();
    const today = todayStr();

    // Aggregate header counters
    let started = 0, submitted = 0, failingNow = 0, stalledNow = 0;
    let aggDone = 0;
    const allBarns = [];
    Object.entries(FARMS).forEach(([farm, count]) => {
      for (let h = 1; h <= count; h++) allBarns.push({ farm, house: h });
    });

    const recByKey = {};
    _walks.filter(w => w.date === today).forEach(w => {
      const k = w.farm + '#' + String(w.house || w.barn);
      // Keep the latest record by ts in case there are dupes
      if (!recByKey[k] || (w.ts || 0) > (recByKey[k].ts || 0)) recByKey[k] = w;
    });

    let html = `
      <div style="background:#0a1a0a;border:1.5px solid #1a3a1a;border-radius:12px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#0f0f0f;border-bottom:1px solid #1a2a1a;">
          <span style="font-size:14px;">📋</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#9ad0a0;letter-spacing:2px;text-transform:uppercase;">Barn Check Status — Live</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#5a8a5a;font-weight:400;letter-spacing:0.5px;">· tap a barn to open</span>
          <span id="dash-barn-status-summary" style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5a8a5a;"></span>
        </div>
        <div style="padding:10px 12px;">`;

    Object.entries(FARMS).forEach(([farm, count]) => {
      html += `<div style="margin-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#7ab07a;letter-spacing:1px;margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid #1a3a1a;">📍 ${farm} <span style="color:#3a6a3a;font-weight:400;">· ${count} ${count===1?'barn':'barns'}</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:6px;">`;

      for (let b = 1; b <= count; b++) {
        const rec = recByKey[farm + '#' + String(b)];
        // Encode farm name + house number as data-attrs so the delegated
        // click handler can pull them back without onclick string escaping
        const tapAttrs = `data-bs-farm="${escapeAttr(farm)}" data-bs-house="${b}" role="button" tabindex="0"`;
        const tapStyle = 'cursor:pointer;-webkit-tap-highlight-color:rgba(74,222,128,0.18);transition:transform 0.08s, border-color 0.15s;';
        if (!rec) {
          // Not started — still tappable so a lead can open and start the walk
          html += `<div ${tapAttrs} title="${escapeAttr(farm + ' H' + b)} — not started · tap to open" style="${tapStyle}background:#0a1a0a;border:1.5px solid #1a2a1a;border-radius:9px;padding:7px 5px;text-align:center;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a5a3a;font-weight:700;margin-bottom:2px;">${farm.charAt(0)}${b}</div>
            <div style="font-size:14px;line-height:1.1;color:#3a5a3a;">○</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#2a4a2a;margin-top:3px;">not started</div>
          </div>`;
          continue;
        }
        started++;
        const fbCount = failCount(rec);
        if (fbCount > 0) failingNow++;
        const sub = rec.status === 'pending-review' || rec.status === 'approved';
        if (sub) submitted++;

        const dn = doneMinutesForRec(rec);
        aggDone += dn;
        const pct = planned > 0 ? Math.round(dn / planned * 100) : 0;

        // Has the barn been silent for too long? Only counts as stalled
        // if it's been STARTED (rec exists) but NOT submitted yet.
        const idleMs = rec.ts ? Date.now() - rec.ts : 0;
        const isStalled = !sub && rec.ts && idleMs >= STALL_MIN * 60000;
        if (isStalled) stalledNow++;

        // Priority for color/icon: failing > submitted > stalled > in-progress > opened
        let col, bg, bdr, icon, label;
        if (fbCount > 0 && !sub) {
          col = '#e57373'; bg = '#1a0505'; bdr = '#5a1010'; icon = '⚠️'; label = fbCount + ' FAIL';
        } else if (sub) {
          col = '#4caf50'; bg = '#0a2a0a'; bdr = '#2a5a2a'; icon = '✅'; label = 'submitted';
        } else if (isStalled) {
          col = '#ff9b54'; bg = '#2a0f00'; bdr = '#7a3500'; icon = '⏸'; label = 'stalled';
        } else if (dn > 0) {
          col = '#d69e2e'; bg = '#1a1200'; bdr = '#4a3500'; icon = '⏳'; label = pct + '%';
        } else {
          col = '#7a8a7a'; bg = '#0a1a0a'; bdr = '#2a3a2a'; icon = '◐'; label = 'opened';
        }

        const worker = rec.worker ? String(rec.worker).split(' ')[0] : '?';
        const ago = fmtAgo(rec.ts);

        html += `<div data-bs-farm="${escapeAttr(farm)}" data-bs-house="${b}" role="button" tabindex="0" title="${escapeAttr(farm + ' H' + b + ' — ' + fmtMin(dn) + ' of ' + fmtMin(planned) + ' done · ' + (rec.worker||'?') + ' · ' + ago)}" style="cursor:pointer;-webkit-tap-highlight-color:rgba(74,222,128,0.18);transition:transform 0.08s, border-color 0.15s;background:${bg};border:1.5px solid ${bdr};border-radius:9px;padding:7px 5px;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${col};font-weight:700;margin-bottom:2px;">${farm.charAt(0)}${b}</div>
          <div style="font-size:14px;line-height:1.1;">${icon}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:${col};margin-top:3px;">${pct}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${col};margin-top:1px;">${label === pct + '%' ? fmtMin(dn) : label}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#5a7a5a;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${worker}</div>
          <div style="background:#050f05;border-radius:3px;height:3px;margin-top:4px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;"></div>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:7px;color:#3a6a3a;margin-top:2px;">${ago}</div>
        </div>`;
      }
      html += `</div></div>`;
    });

    // Aggregate / footer
    const totalBarns = allBarns.length;
    const aggPct = (planned * totalBarns) > 0
      ? Math.round((aggDone / (planned * totalBarns)) * 100)
      : 0;
    // Stalled barns expose the stalled counter as a window global so the
    // dashboard exec brief can read it without re-deriving the math.
    window._dashStalledBarns = stalledNow;

    html += `
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:6px;padding-top:8px;border-top:1px solid #1a3a1a;">
          <div style="text-align:center;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#4caf50;">${submitted}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#3a6a3a;text-transform:uppercase;letter-spacing:1px;">Submitted</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${started-submitted>0?'#d69e2e':'#4caf50'}">${Math.max(0, started - submitted)}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#3a6a3a;text-transform:uppercase;letter-spacing:1px;">In Progress</div>
          </div>
          <div style="text-align:center;" title="Started but no updates in ${STALL_MIN}+ minutes">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${stalledNow>0?'#ff9b54':'#5a8a5a'}">${stalledNow}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${stalledNow>0?'#ff9b54':'#3a6a3a'};text-transform:uppercase;letter-spacing:1px;">Stalled</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${totalBarns-started>0?'#e07070':'#4caf50'}">${totalBarns - started}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#3a6a3a;text-transform:uppercase;letter-spacing:1px;">Not Started</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${failingNow>0?'#e07070':'#5a8a5a'}">${failingNow}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#3a6a3a;text-transform:uppercase;letter-spacing:1px;">With FAILs</div>
          </div>
        </div>
      </div></div>`;

    el.innerHTML = html;
    const sumEl = document.getElementById('dash-barn-status-summary');
    if (sumEl) {
      sumEl.textContent =
        aggPct + '% across all barns by time · ' +
        fmtMin(planned) + ' planned per barn today';
    }

    // Nudge the dashboard exec brief to repaint so a freshly-stalled
    // barn shows in the top-of-page brief without waiting for a full
    // renderDash() cycle. Cheap — only runs on dashboard panel.
    if (typeof renderExecBrief === 'function') {
      try {
        const today  = todayStr();
        const yester = new Date(Date.now() - 86400000).toISOString().slice(0,10);
        renderExecBrief(today, yester);
      } catch (e) { /* silent */ }
    }
  }

  // ── Live subscription ──────────────────────────────────────────
  function startListener() {
    if (_unsub || typeof db === 'undefined' || !db) return;
    try {
      _unsub = db.collection('barnWalks').where('date', '==', todayStr())
        .onSnapshot(snap => {
          _walks = snap.docs.map(d => d.data());
          render();
        }, err => console.warn('[barn-status] listener:', err));
    } catch (e) { console.warn('[barn-status] startListener failed:', e); }
  }

  function stopListener() {
    if (_unsub) { try { _unsub(); } catch(e) {} _unsub = null; }
  }

  // Tick once per minute so "Xm ago" labels stay fresh even with no
  // new data coming in.
  function startTick() {
    if (_tick) return;
    _tick = setInterval(() => { render(); }, 60 * 1000);
  }

  // ── Tap-to-open: opens the barn-walk modal for the tapped card ──
  // Delegated handler attached once on the panel container so we don't
  // pay the cost of binding per-card listeners on every render.
  function wireTapHandler() {
    const root = document.getElementById('dash-barn-status');
    if (!root || root.dataset.tapWired === '1') return;
    root.dataset.tapWired = '1';
    const handle = (e) => {
      const card = e.target.closest('[data-bs-farm]');
      if (!card || !root.contains(card)) return;
      const farm  = card.getAttribute('data-bs-farm');
      const house = parseInt(card.getAttribute('data-bs-house'), 10);
      if (!farm || !house) return;
      // Tiny visual ack so the user knows the tap landed
      card.style.transform = 'scale(0.97)';
      setTimeout(() => { card.style.transform = ''; }, 120);
      if (typeof window.openBarnWalk === 'function') {
        window.openBarnWalk(farm, house);
      } else {
        console.warn('[barn-status] openBarnWalk not loaded yet');
      }
    };
    root.addEventListener('click', handle);
    // Keyboard accessibility — Enter or Space on a focused card
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('[data-bs-farm]');
      if (!card) return;
      e.preventDefault();
      handle(e);
    });
  }

  // ── Boot ───────────────────────────────────────────────────────
  function boot() {
    // Render an empty shell first so the slot is never blank
    render();
    wireTapHandler();
    // Wait for Firestore (db) to be ready
    const tryStart = (n) => {
      if (typeof db !== 'undefined' && db) { startListener(); startTick(); return; }
      if (n < 30) setTimeout(() => tryStart(n + 1), 1000);
    };
    tryStart(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Re-render whenever the dashboard panel becomes visible (e.g. user
  // navigates back to it) so "Xm ago" is current.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
})();
