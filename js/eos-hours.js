// ═══════════════════════════════════════════════════════════════════════
// EOS Hours Tracker — Maintenance section helper
// Rolls up labor hours from PM completions + WO completions today,
// plus a "missed hours" button that creates a new WO with those hours logged.
// ═══════════════════════════════════════════════════════════════════════

function ehGetTodayPMHours(farm) {
  if (typeof pmComps === 'undefined' || !pmComps) return { count: 0, hours: 0, items: [] };
  const today = new Date().toISOString().slice(0,10);
  let count = 0, hours = 0;
  const items = [];
  Object.keys(pmComps).forEach(pmId => {
    const c = pmComps[pmId];
    if (!c || c.date !== today) return;
    const def = (typeof ALL_PM !== 'undefined' && ALL_PM) ? ALL_PM.find(t => t.id === pmId) : null;
    if (def && def.farm && def.farm !== farm && def.farm !== 'Both') return;
    const h = Number(c.hours || (def && def.hrs) || 0);
    count++;
    hours += h;
    items.push({ id: pmId, name: def?.task || def?.name || pmId, hours: h, by: c.by || c.tech || '—' });
  });
  return { count, hours, items };
}

function ehGetTodayWOHours(farm) {
  if (typeof workOrders === 'undefined' || !workOrders) return { count: 0, hours: 0, items: [] };
  const today = new Date().toISOString().slice(0,10);
  let count = 0, hours = 0;
  const items = [];
  workOrders.forEach(w => {
    if (w.farm !== farm) return;
    if (w.status !== 'completed') return;
    const ts = w.completedTs || w.closedTs || w.ts || 0;
    const cdate = ts ? new Date(ts).toISOString().slice(0,10) : null;
    if (cdate !== today) return;
    const h = Number(w.actualHours || w.hours || 0);
    count++;
    hours += h;
    items.push({
      id: w.woNum || w._fbId,
      title: w.problem || w.title || w.description?.slice(0,60) || '(no title)',
      hours: h,
      by: w.completedBy || w.assignTo || '—',
      house: w.house || ''
    });
  });
  return { count, hours, items };
}

// Render the hours tracker block for a farm
function ehRenderHoursBlock(farm) {
  const pm = ehGetTodayPMHours(farm);
  const wo = ehGetTodayWOHours(farm);
  const total = pm.hours + wo.hours;

  const itemRow = (icon, label, hrs, by) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#080f08;border-radius:5px;margin-bottom:4px;">
      <span style="font-size:14px;flex-shrink:0;">${icon}</span>
      <span style="flex:1;font-size:11px;color:#c8e6c9;line-height:1.3;">${label}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;flex-shrink:0;">${by}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4ade80;font-weight:700;flex-shrink:0;min-width:42px;text-align:right;">${(hrs||0).toFixed(2)}h</span>
    </div>`;

  return `
  <div style="background:#0a1f0a;border:1.5px solid #1a3a1a;border-radius:10px;padding:12px;margin-bottom:14px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:1.5px;color:#4ade80;text-transform:uppercase;">⏱ Hours Today — ${farm}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#4ade80;letter-spacing:1px;">${total.toFixed(1)}h</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:10px;">
      <div style="background:#0d1f3a;border:1px solid #1e3a6a;border-radius:6px;padding:8px 10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7ab0f6;letter-spacing:1px;text-transform:uppercase;">PMs Done</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:#7ab0f6;">${pm.count} · ${pm.hours.toFixed(1)}h</div>
      </div>
      <div style="background:#1a1400;border:1px solid #854d0e;border-radius:6px;padding:8px 10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#fbbf24;letter-spacing:1px;text-transform:uppercase;">WOs Closed</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:#fbbf24;">${wo.count} · ${wo.hours.toFixed(1)}h</div>
      </div>
    </div>

    ${pm.items.length || wo.items.length ? `
      <div style="max-height:240px;overflow-y:auto;">
        ${pm.items.map(p => itemRow('📋', `<b>PM:</b> ${p.name}`, p.hours, p.by)).join('')}
        ${wo.items.map(w => itemRow('🔧', `<b>WO ${w.id}${w.house?' · H'+w.house:''}:</b> ${w.title}`, w.hours, w.by)).join('')}
      </div>
    ` : `<div style="text-align:center;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:10px;padding:6px 0;">No PMs or WOs closed yet today.</div>`}

    <button onclick="ehAddMissedHours('${farm}')" style="width:100%;margin-top:10px;padding:9px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:6px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">
      + ADD MISSED HOURS (creates a new WO)
    </button>
  </div>`;
}

// Modal-driven add — collects what was worked on, who, hours, then creates a WO
async function ehAddMissedHours(farm) {
  const what = prompt(`What was worked on? (will become a new WO for ${farm})`);
  if (!what || !what.trim()) return;
  const who = prompt('Who worked on it? (name)');
  if (who === null) return;
  const hrsStr = prompt('How many hours?');
  const hrs = Number(hrsStr);
  if (!hrs || isNaN(hrs)) { alert('Hours must be a number'); return; }
  const houseStr = prompt('Which house? (number, or leave blank)');
  const house = houseStr && houseStr.trim() ? houseStr.trim() : '';

  const today = new Date().toISOString().slice(0,10);
  const ts = Date.now();
  const woNum = 'MH-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*1000);

  const wo = {
    woNum,
    farm,
    house,
    title: what.trim(),
    problem: 'Missed Hours / Added Project',
    description: `Auto-created from missed-hours entry on Daily Report. ${who?'Performed by '+who+'. ':''}Logged ${hrs}h.`,
    priority: 'normal',
    status: 'completed',
    actualHours: hrs,
    hours: hrs,
    completedBy: who || '',
    assignTo: who || '',
    ts,
    completedTs: ts,
    date: today,
    closedTs: ts,
    source: 'missed-hours',
    actionRail: false
  };

  try {
    await db.collection('workOrders').add(wo);
    alert(`✓ Created WO ${woNum} for ${hrs}h on ${what.trim()}`);
    if (typeof drRender === 'function') drRender();
  } catch (e) {
    alert('Failed to create WO: ' + e.message);
    console.error(e);
  }
}

window.ehGetTodayPMHours  = ehGetTodayPMHours;
window.ehGetTodayWOHours  = ehGetTodayWOHours;
window.ehRenderHoursBlock = ehRenderHoursBlock;
window.ehAddMissedHours   = ehAddMissedHours;
