// ============================================================================
// trending-wo.js — WO Trending & Projection (Tier 2 Lean BB tool)
// ----------------------------------------------------------------------------
// Surfaces repeat-failure patterns in the WO history so the morning Tier 2
// meeting addresses ROOT CAUSE before tactics. Per Joe's non-negotiable:
//   "repeat WO in window = Grade 3 = root cause investigation required"
//
// Reads:    window.workOrders   (global, populated by core.js Firestore load)
// Writes:   db.collection('workOrders')   — sets actionRail / meetingFlag
//           db.collection('dailyProjects') — Push to Daily Report / Tier 2
//           db.collection('idsIssues')     — Push to EOS L10 IDS list
//
// Public:   window.renderTrendingWO(windowDays?)  — called by renderDash()
//           window.twSetWindow(days)              — toggle button handler
//           window.twSetFarm(farm)                — farm filter pill handler
//           window.twAutoDraft()                  — auto-draft Action Rail
//           window.twPushDaily()                  — push to Daily Report
//           window.twPushEOS()                    — push to EOS
//           window.twFlagTier2()                  — flag in Tier 2 agenda
// ============================================================================

(function(){
  'use strict';

  // ── State (preserved across re-renders) ────────────────────────────────────
  const TW = window._trendingWO = window._trendingWO || {
    window: 30,        // 7 | 14 | 30
    farm: 'All',       // 'All' | 'Hegins' | 'Danville' | 'Rushtown' | 'Turbotville' | 'W&M'
    busy: false        // prevents double-clicks during async writes
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Firestore Timestamp objects vs raw numeric ms vs Date — normalize to ms
  function tsMs(ts){
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (ts.toMillis) return ts.toMillis();
    if (ts.seconds)  return ts.seconds * 1000;
    if (ts instanceof Date) return ts.getTime();
    return 0;
  }

  function inWindow(wo, days){
    const t = tsMs(wo.ts);
    if (!t) return false;
    return (Date.now() - t) <= (days * 86400000);
  }

  function plusDaysISO(days){
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }

  // Group key: problem (system) + farm + house. This is what makes a repeat.
  function groupKey(wo){
    return (wo.problem || 'Uncategorized') + ' · ' + (wo.farm || '?') + ' ' + (wo.house || '');
  }

  // Light-weight toast in case core.js doesn't expose one
  function toast(msg, ok){
    const id = '_tw_toast';
    let el = document.getElementById(id);
    if (!el){
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);'
        + 'background:#0d1f16;color:#f0ead8;border:1.5px solid #4a9b6f;padding:11px 20px;border-radius:8px;'
        + 'font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;letter-spacing:.5px;'
        + 'opacity:0;transition:all .25s;z-index:9999;pointer-events:none;text-transform:uppercase;';
      document.body.appendChild(el);
    }
    el.style.borderColor = ok === false ? '#e53e3e' : '#4a9b6f';
    el.style.color       = ok === false ? '#ffb0b0' : '#f0ead8';
    el.textContent = msg;
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2400);
  }

  // ── Compute ────────────────────────────────────────────────────────────────

  function getCandidates(){
    const all = (typeof workOrders !== 'undefined') ? workOrders : [];
    return all.filter(wo => {
      if (!inWindow(wo, TW.window)) return false;
      if (TW.farm !== 'All' && wo.farm !== TW.farm) return false;
      return true;
    });
  }

  function paretoize(wos){
    const groups = {};
    wos.forEach(wo => {
      const k = groupKey(wo);
      if (!groups[k]) {
        groups[k] = {
          key: k,
          problem: wo.problem || 'Uncategorized',
          farm: wo.farm || '?',
          house: wo.house || '',
          count: 0,
          urgentCount: 0,
          downCount: 0,
          railCount: 0,
          openCount: 0,
          items: []
        };
      }
      const g = groups[k];
      g.count++;
      if (wo.priority === 'urgent')   g.urgentCount++;
      if (wo.down === 'yes')          g.downCount++;
      if (wo.actionRail === true)     g.railCount++;
      if (wo.status !== 'completed')  g.openCount++;
      g.items.push(wo);
    });
    return Object.values(groups).sort((a,b) =>
      b.count - a.count || b.urgentCount - a.urgentCount || b.downCount - a.downCount
    );
  }

  function getRepeats(pareto){ return pareto.filter(g => g.count >= 2); }

  // ── Render ─────────────────────────────────────────────────────────────────

  const FARMS = ['All','Hegins','Danville','Rushtown','Turbotville','W&M'];

  function renderTrendingWO(initialWindow){
    if (initialWindow) TW.window = initialWindow;
    const host = document.getElementById('dash-trending-wo');
    if (!host) return;

    const candidates = getCandidates();
    const pareto     = paretoize(candidates);
    const repeats    = getRepeats(pareto);
    const totalDown  = candidates.filter(w => w.down === 'yes').length;
    const onRail     = candidates.filter(w => w.actionRail === true).length;
    const titleColor = repeats.length ? '#e07070' : '#4caf50';
    const cardBg     = repeats.length ? '#1a0808' : '#0a1a14';
    const cardBdr    = repeats.length ? '#5a1e1e' : '#1e4a3a';

    host.innerHTML = `
      <div id="dash-trending-wo-card" style="background:${cardBg};border:1.5px solid ${cardBdr};border-radius:12px;padding:14px 12px;transition:border-color .15s;">

        <!-- Header: title + window toggle -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${titleColor};">
            ${repeats.length ? '▲' : '▼'} WO Trending &amp; Projection
            <span style="opacity:.6;font-weight:500;letter-spacing:1px;">— Lean BB Intelligence</span>
          </div>
          <div style="display:flex;gap:3px;background:#0a1a0a;border:1px solid #2a4a2a;border-radius:6px;padding:2px;">
            ${[7,14,30].map(d => `
              <button onclick="twSetWindow(${d})" style="background:${TW.window===d?'#1a4a25':'transparent'};color:${TW.window===d?'#7ed9a0':'#5a8a5a'};border:0;padding:5px 11px;font-size:11px;font-weight:700;letter-spacing:.5px;border-radius:4px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${d}d</button>
            `).join('')}
          </div>
        </div>

        <!-- Farm filter pills -->
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">
          ${FARMS.map(f => {
            const active = TW.farm === f;
            return `<button onclick="twSetFarm('${f}')" style="background:${active?'#1a3a2a':'transparent'};color:${active?'#a8d5b5':'#5a8a5a'};border:1px solid ${active?'#3a6a4a':'#2a4a2a'};padding:4px 9px;font-size:10px;font-weight:600;letter-spacing:.5px;border-radius:99px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${f}</button>`;
          }).join('')}
        </div>

        <!-- KPI strip -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
          ${twKPI('WOs in window', candidates.length, '', '#f0ead8')}
          ${twKPI('Repeat groups', repeats.length, repeats.length ? 'Root-cause gaps' : 'No repeats', repeats.length ? '#e53e3e' : '#4caf50')}
          ${twKPI('Already on rail', onRail, 'flagged actionRail', '#d69e2e')}
          ${twKPI('With downtime', totalDown, 'down=yes', totalDown ? '#e53e3e' : '#f0ead8')}
        </div>

        ${repeats.length ? `
        <!-- Root-cause gap banner -->
        <div style="background:linear-gradient(90deg,rgba(229,62,62,.15),transparent);border:1px solid #5a1e1e;border-left:3px solid #e53e3e;border-radius:8px;padding:9px 12px;margin-bottom:10px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;color:#e07070;text-transform:uppercase;">
            ▲ ${repeats.length} Root-Cause Gap${repeats.length>1?'s':''} Detected
          </div>
          <div style="font-size:11px;color:#c8b0a0;margin-top:3px;font-family:'IBM Plex Mono',monospace;">
            Per Tier 2 rule: <b style="color:#e07070;">repeat = Grade 3</b>. These are failing fixes, not failing parts. Address root cause first.
          </div>
        </div>` : ''}

        <!-- Pareto list (top 8) -->
        <div style="margin-bottom:10px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5a8a5a;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;">
            Top Trending — Next Week's Projected Work · ${pareto.length} unique pattern${pareto.length===1?'':'s'}
          </div>
          ${pareto.length ? pareto.slice(0, 8).map(g => twParetoRow(g, pareto[0].count)).join('') :
            `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a8a5a;padding:14px;text-align:center;">No WOs match this filter.</div>`}
        </div>

        <!-- 4-button action bar -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
          ${twActBtn('twAutoDraft()',  '⚙', 'Auto-Draft Action Rail',  repeats.length, '#e53e3e', true)}
          ${twActBtn('twPushDaily()',  '▤', 'Push to Daily Report',    Math.min(5, pareto.length), '#4caf50', false)}
          ${twActBtn('twPushEOS()',    '▥', 'Push to EOS Report',      repeats.length, '#3b82f6', false)}
          ${twActBtn('twFlagTier2()',  '▶', 'Flag in Tier 2 Agenda',   repeats.length, '#d69e2e', false)}
        </div>

        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5a8a5a;text-align:center;margin-top:10px;letter-spacing:.4px;">
          Window: ${TW.window} days · Farm: ${TW.farm} · Reads from live workOrders. Repeats = ≥2 of same problem at same farm/house.
        </div>
      </div>
    `;
  }

  function twKPI(label, val, sub, color){
    return `
      <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:8px 10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5a8a5a;letter-spacing:1px;text-transform:uppercase;">${label}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${color};line-height:1.1;margin-top:3px;">${val}</div>
        ${sub ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5a8a5a;margin-top:2px;">${sub}</div>` : ''}
      </div>`;
  }

  function twParetoRow(g, max){
    const pct = (g.count / max) * 100;
    const isRepeat = g.count >= 2;
    const fillCol  = g.count >= 3 ? '#e53e3e' : (g.count === 2 ? '#d69e2e' : '#4caf50');
    const cntCol   = g.count >= 3 ? '#e53e3e' : (g.count === 2 ? '#d69e2e' : '#f0ead8');
    const badge    = isRepeat
      ? `<span style="background:rgba(229,62,62,.18);color:#e07070;border:1px solid #5a1e1e;padding:1px 6px;border-radius:99px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">REPEAT ×${g.count}</span>`
      : `<span style="background:rgba(74,154,111,.15);color:#7ed9a0;border:1px solid #1e4a3a;padding:1px 6px;border-radius:99px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">single</span>`;
    const flags = [];
    if (g.urgentCount) flags.push(`<span style="color:#e53e3e;">${g.urgentCount} urgent</span>`);
    if (g.downCount)   flags.push(`<span style="color:#d69e2e;">${g.downCount} down</span>`);
    if (g.railCount)   flags.push(`<span style="color:#a8d5b5;">${g.railCount} on rail</span>`);
    if (g.openCount && g.openCount !== g.count) flags.push(`${g.openCount} open`);
    return `
      <div style="display:grid;grid-template-columns:1fr 50px;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px dashed #1a3a2a;">
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:600;color:#f0ead8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(g.problem)}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7a9a7a;margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            ${badge}
            <span>${escHtml(g.farm)} ${escHtml(g.house)}</span>
            ${flags.length ? `<span style="color:#5a8a5a;">·</span> ${flags.join('<span style="color:#5a8a5a;"> · </span>')}` : ''}
          </div>
          <div style="background:#0a1a0a;border-radius:3px;height:4px;overflow:hidden;margin-top:5px;">
            <div style="height:100%;width:${pct}%;background:${fillCol};border-radius:3px;transition:width .4s;"></div>
          </div>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${cntCol};text-align:right;">${g.count}</div>
      </div>`;
  }

  function twActBtn(onclickJs, icon, label, badgeNum, accent, primary){
    const bg = primary ? 'rgba(229,62,62,.10)' : 'rgba(0,0,0,.25)';
    const bdr = primary ? '#5a1e1e' : '#2a4a2a';
    const lblColor = primary ? '#e07070' : '#a8d5b5';
    return `
      <button onclick="${onclickJs}" style="background:${bg};border:1px solid ${bdr};border-radius:8px;padding:9px 6px;cursor:pointer;font-family:'IBM Plex Mono',monospace;color:${lblColor};display:flex;flex-direction:column;align-items:center;gap:3px;line-height:1.2;">
        <span style="font-size:14px;color:${accent};">${icon}</span>
        <span style="font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;text-align:center;">${label}</span>
        ${badgeNum ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${accent};font-weight:700;">${badgeNum} ready</span>` : `<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#5a8a5a;">— nothing —</span>`}
      </button>`;
  }

  function escHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ── Toggle handlers ────────────────────────────────────────────────────────

  function twSetWindow(d){ TW.window = d; renderTrendingWO(); }
  function twSetFarm(f){   TW.farm = f;   renderTrendingWO(); }

  // ── Auto-actions (the 4 buttons) ───────────────────────────────────────────

  // 1) Auto-Draft Action Rail: flag every WO in repeat groups as actionRail+meetingFlag,
  //    and create one parent dailyProjects entry per repeat pattern (priority: Urgent)
  //    so the pattern is tracked separately from the constituent WOs.
  async function twAutoDraft(){
    if (TW.busy) return;
    const repeats = getRepeats(paretoize(getCandidates()));
    if (!repeats.length){ toast('No repeats — nothing to draft', false); return; }
    if (!confirm(`Flag ${repeats.reduce((s,g)=>s+g.items.length,0)} WO(s) as Action Rail + create ${repeats.length} parent project entr${repeats.length===1?'y':'ies'}?`)) return;

    TW.busy = true;
    try {
      for (const g of repeats){
        // Flag every constituent WO
        for (const wo of g.items){
          if (!wo._fbId) continue;
          await db.collection('workOrders').doc(wo._fbId).update({
            actionRail: true,
            meetingFlag: true
          });
        }
        // Create a parent dailyProjects entry capturing the PATTERN
        await db.collection('dailyProjects').add({
          task:        `[REPEAT ×${g.count}] Root-cause: ${g.problem} @ ${g.farm} ${g.house}`,
          area:        g.house || g.farm,
          owner:       'Maintenance Lead',
          dueDate:     plusDaysISO(7),
          farm:        g.farm,
          focus:       'Root Cause',
          priority:    'Urgent',
          status:      'Not Started',
          createdTs:   Date.now(),
          createdDate: new Date().toISOString().slice(0,10),
          source:      'trending-wo',
          sourceWOs:   g.items.map(w => w.id || w._fbId).join(', ')
        });
      }
      toast(`Drafted ${repeats.length} root-cause project${repeats.length===1?'':'s'}`, true);
    } catch (e){
      console.error('twAutoDraft error', e);
      toast('Error: see console', false);
    } finally {
      TW.busy = false;
      renderTrendingWO();
    }
  }

  // 2) Push to Daily Report: top 5 trending → dailyProjects (priority varies)
  async function twPushDaily(){
    if (TW.busy) return;
    const pareto = paretoize(getCandidates());
    const top5 = pareto.slice(0, 5);
    if (!top5.length){ toast('Nothing trending in window', false); return; }
    if (!confirm(`Push top ${top5.length} trending pattern${top5.length===1?'':'s'} to today's Daily Report?`)) return;

    TW.busy = true;
    try {
      for (const g of top5){
        await db.collection('dailyProjects').add({
          task:        `${g.problem} @ ${g.farm} ${g.house}` + (g.count >= 2 ? ` (×${g.count} this ${TW.window}d)` : ''),
          area:        g.house || g.farm,
          owner:       g.urgentCount ? 'Maintenance Lead' : 'Maintenance',
          dueDate:     plusDaysISO(g.count >= 3 ? 3 : 7),
          farm:        g.farm,
          focus:       g.count >= 2 ? 'Root Cause' : 'PM',
          priority:    g.count >= 3 ? 'Urgent' : (g.count === 2 ? 'High' : 'Planned'),
          status:      'Not Started',
          createdTs:   Date.now(),
          createdDate: new Date().toISOString().slice(0,10),
          source:      'trending-wo'
        });
      }
      toast(`Pushed ${top5.length} item${top5.length===1?'':'s'} to Daily Report`, true);
    } catch (e){
      console.error('twPushDaily error', e);
      toast('Error: see console', false);
    } finally {
      TW.busy = false;
    }
  }

  // 3) Push to EOS: each repeat → idsIssues (Identify-Discuss-Solve)
  async function twPushEOS(){
    if (TW.busy) return;
    const repeats = getRepeats(paretoize(getCandidates()));
    if (!repeats.length){ toast('No repeats to push', false); return; }
    if (!confirm(`Add ${repeats.length} repeat pattern${repeats.length===1?'':'s'} to EOS L10 IDS list?`)) return;

    TW.busy = true;
    try {
      for (const g of repeats){
        await db.collection('idsIssues').add({
          title:       `Why does ${g.problem} keep happening at ${g.farm} ${g.house}?`,
          description: `${g.count} occurrences in ${TW.window} days. WOs: ${g.items.map(w => w.id || '').filter(Boolean).join(', ')}. ${g.downCount} caused downtime. Root cause not yet established.`,
          owner:       'Maintenance Lead',
          priority:    g.count >= 3 ? 'High' : 'Medium',
          status:      'Identified',
          createdTs:   Date.now(),
          source:      'trending-wo'
        });
      }
      toast(`Added ${repeats.length} IDS issue${repeats.length===1?'':'s'} to EOS`, true);
    } catch (e){
      console.error('twPushEOS error', e);
      toast('Error: see console', false);
    } finally {
      TW.busy = false;
    }
  }

  // 4) Flag in Tier 2 Agenda: set meetingFlag=true on every constituent WO
  async function twFlagTier2(){
    if (TW.busy) return;
    const repeats = getRepeats(paretoize(getCandidates()));
    if (!repeats.length){ toast('No repeats to flag', false); return; }
    const totalWOs = repeats.reduce((s,g) => s + g.items.length, 0);
    if (!confirm(`Flag ${totalWOs} WO(s) for the next Tier 2 meeting agenda?`)) return;

    TW.busy = true;
    try {
      for (const g of repeats){
        for (const wo of g.items){
          if (!wo._fbId) continue;
          await db.collection('workOrders').doc(wo._fbId).update({ meetingFlag: true });
        }
      }
      toast(`Flagged ${totalWOs} WO${totalWOs===1?'':'s'} for Tier 2`, true);
    } catch (e){
      console.error('twFlagTier2 error', e);
      toast('Error: see console', false);
    } finally {
      TW.busy = false;
      renderTrendingWO();
    }
  }

  // ── Public exposure ────────────────────────────────────────────────────────
  window.renderTrendingWO = renderTrendingWO;
  window.twSetWindow      = twSetWindow;
  window.twSetFarm        = twSetFarm;
  window.twAutoDraft      = twAutoDraft;
  window.twPushDaily      = twPushDaily;
  window.twPushEOS        = twPushEOS;
  window.twFlagTier2      = twFlagTier2;

})();
