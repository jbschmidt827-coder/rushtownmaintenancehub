// ═══════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════
function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotif(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag: tag||'rushtown', icon: '/icon-192.png', badge: '/icon-192.png' });
  } catch(e) { /* silently fail on unsupported browsers */ }
}

// Call on app load
setTimeout(requestNotifPermission, 3000);

// ═══════════════════════════════════════════
// WORK ORDERS
// ═══════════════════════════════════════════
function woLoc(v,btn) {
  woLocFilter=v;
  document.querySelectorAll('#wo-loc-bar .loc-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderWO();
}
function woResetFilters() {
  woPriorityFilters.clear();
  woStatusFilters.clear();
  document.querySelectorAll('#wo-filter-bar .pill').forEach(b=>b.classList.remove('active'));
  document.querySelector('#wo-filter-bar .pill[data-wo="all"]').classList.add('active');
  renderWO();
}
function woTogglePriority(v, btn) {
  document.querySelector('#wo-filter-bar .pill[data-wo="all"]').classList.remove('active');
  if (woPriorityFilters.has(v)) { woPriorityFilters.delete(v); btn.classList.remove('active'); }
  else { woPriorityFilters.add(v); btn.classList.add('active'); }
  if (woPriorityFilters.size===0 && woStatusFilters.size===0) {
    document.querySelector('#wo-filter-bar .pill[data-wo="all"]').classList.add('active');
  }
  renderWO();
}
function woToggleStatus(v, btn) {
  document.querySelector('#wo-filter-bar .pill[data-wo="all"]').classList.remove('active');
  if (woStatusFilters.has(v)) { woStatusFilters.delete(v); btn.classList.remove('active'); }
  else { woStatusFilters.add(v); btn.classList.add('active'); }
  if (woPriorityFilters.size===0 && woStatusFilters.size===0) {
    document.querySelector('#wo-filter-bar .pill[data-wo="all"]').classList.add('active');
  }
  renderWO();
}

// SLA thresholds in days by priority
const WO_SLA = { urgent: 1, high: 3, normal: 7, routine: 7, low: 14 };

function woSlaBreached(wo) {
  if (wo.status === 'completed' || wo.status === 'on-hold') return false;
  const ts = wo.ts?.toMillis ? wo.ts.toMillis() : (wo.ts||0);
  if (!ts) return false;
  const days = Math.floor((Date.now() - ts) / 86400000);
  return days >= (WO_SLA[wo.priority] || 7);
}

function renderWO() {
  let base = woLocFilter==='all' ? workOrders : workOrders.filter(w=>w.farm===woLocFilter);
  document.getElementById('wo-stats').innerHTML =
    sc('s-red',base.filter(w=>w.priority==='urgent'&&w.status!=='completed').length,t('wo.stat.urgent')) +
    sc('s-amber',base.filter(w=>w.priority==='high'&&w.status!=='completed').length,t('wo.stat.high')) +
    sc('s-green',base.filter(w=>w.status==='open').length,t('wo.stat.open')) +
    sc('s-blue',base.filter(w=>w.status==='in-progress').length,t('wo.stat.inprog')) +
    sc('',base.length,t('wo.stat.total'));

  // SLA breach banner
  const slaBreached = base.filter(w => woSlaBreached(w));
  const slaBanner = document.getElementById('wo-sla-banner');
  if (slaBanner) {
    if (slaBreached.length > 0) {
      const urgCnt = slaBreached.filter(w=>w.priority==='urgent').length;
      const hiCnt  = slaBreached.filter(w=>w.priority==='high').length;
      const detail = [urgCnt && `${urgCnt} Urgent`, hiCnt && `${hiCnt} High`, (slaBreached.length - urgCnt - hiCnt) && `${slaBreached.length - urgCnt - hiCnt} other`].filter(Boolean).join(' · ');
      slaBanner.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#2d0000;border:1.5px solid #7f1d1d;border-radius:10px;margin-bottom:12px;">
        <span style="font-size:18px;">🚨</span>
        <div style="flex:1;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#f87171;">${slaBreached.length} WO${slaBreached.length!==1?'s':''} exceeded SLA — need immediate attention</div>
          <div style="font-size:11px;color:#fca5a5;margin-top:2px;">${detail}</div>
        </div>
      </div>`;
      slaBanner.style.display = 'block';
    } else {
      slaBanner.style.display = 'none';
    }
  }

  let list = [...base];
  const hasPriority = woPriorityFilters.size > 0;
  const hasStatus = woStatusFilters.size > 0;

  if (!hasPriority && !hasStatus) {
    list = list.filter(w => w.status !== 'completed');
  } else {
    if (hasPriority) list = list.filter(w => woPriorityFilters.has(w.priority));
    if (hasStatus) {
      list = list.filter(w => woStatusFilters.has(w.status));
    } else {
      list = list.filter(w => w.status !== 'completed');
    }
  }

  // ── Action Rail ──────────────────────────────
  const actionRailWOs = base.filter(w => w.actionRail && w.status !== 'completed');
  const railEl = document.getElementById('wo-action-rail');
  if (railEl) {
    if (actionRailWOs.length > 0) {
      railEl.style.display = 'block';
      railEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#f59e0b;text-transform:uppercase;">⚡ Action Rail — ${actionRailWOs.length} item${actionRailWOs.length!==1?'s':''}</div>
          <button onclick="openMeetingAgenda()" style="padding:4px 10px;background:#1a2a1a;border:1px solid #2a4a2a;border-radius:6px;color:#7ab07a;font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">📋 Meeting Agenda</button>
        </div>
        ${actionRailWOs.map(wo => `
          <div style="background:#1a1500;border:1.5px solid #856404;border-radius:10px;padding:10px 14px;margin-bottom:7px;display:flex;align-items:flex-start;gap:10px;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#f59e0b;">${wo.id}</span>
                <span style="font-size:11px;color:#d0c8b8;">${wo.farm} · ${wo.house} · ${wo.problem}</span>
                ${wo.meetingFlag?'<span style="background:#1a2a3a;border:1px solid #2a4a6a;border-radius:4px;padding:2px 6px;font-size:9px;color:#60a5fa;font-family:\'IBM Plex Mono\',monospace;font-weight:700;">MEETING</span>':''}
              </div>
              <div style="font-size:12px;color:#a09070;margin-top:4px;">${wo.desc}</div>
              ${wo.updates&&wo.updates.length?`<div style="font-size:11px;color:#856404;margin-top:4px;">💬 ${wo.updates[wo.updates.length-1].text}</div>`:''}
            </div>
            <button onclick="event.stopPropagation();removeFromRail('${wo._fbId}')" style="padding:4px 8px;background:#2a1a00;border:1px solid #5a3a00;border-radius:6px;color:#856404;font-size:11px;cursor:pointer;flex-shrink:0;">✕</button>
          </div>`).join('')}`;
    } else {
      railEl.style.display = 'none';
    }
  }

  // Meeting flag badge on sub-nav
  const meetingCount = base.filter(w => w.meetingFlag && w.status !== 'completed').length;
  const meetingBadge = document.getElementById('wo-meeting-badge');
  if (meetingBadge) {
    meetingBadge.style.display = meetingCount > 0 ? 'inline' : 'none';
    meetingBadge.textContent = meetingCount;
  }

  document.getElementById('wo-list').innerHTML = list.length
    ? list.map(wo=>woCardHtml(wo)).join('')
    : `<div class="empty"><div class="ei">📋</div><p>${t('wo.empty')}</p></div>`;
}

function woAgePill(wo) {
  if (wo.status === 'completed') return '';
  const ts = wo.ts?.toMillis ? wo.ts.toMillis() : (wo.ts || 0);
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return `<span class="wo-age-pill age-new">${t('wo.age.new')}</span>`;
  if (days === 1) return `<span class="wo-age-pill age-1d">${days} ${t('wo.age.1d')}</span>`;
  if (days <= 3)  return `<span class="wo-age-pill age-warn">${days} ${t('wo.age.days')}</span>`;
  if (days <= 7)  return `<span class="wo-age-pill age-old">${days} ${t('wo.age.warn')}</span>`;
  return `<span class="wo-age-pill age-critical">${days} ${t('wo.age.over')}</span>`;
}

function woCardHtml(wo) {
  const pL={urgent:t('wo.stat.urgent'),high:t('wo.stat.high'),routine:t('wo.pri.routine'),normal:t('wo.pri.routine'),low:t('wo.pri.routine')};
  const pC={urgent:'var(--red)',high:'#b07a00',routine:'var(--green-mid)',normal:'var(--green-mid)',low:'var(--green-mid)'};
  const dT={yes:` ${t('wo.down')}`,partial:` ${t('wo.degraded')}`,no:''};
  const ts = wo.ts?.toMillis ? wo.ts.toMillis() : (wo.ts || 0);
  const ageDays = ts ? Math.floor((Date.now() - ts) / 86400000) : 0;
  const escalate = wo.status !== 'completed' && (
    (wo.priority === 'urgent' && ageDays >= 1) ||
    (wo.priority === 'high'   && ageDays >= 3)
  );
  const slaBreach = woSlaBreached(wo);
  const photoStrip = (wo.photos && wo.photos.length)
    ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;">${wo.photos.map(p=>`<img src="${p}" style="height:60px;border-radius:6px;border:1px solid var(--border);cursor:zoom-in;" onclick="event.stopPropagation();openPhotoViewer('${wo._fbId}')">`).join('')}</div>`
    : '';

  // Build status action buttons based on current status
  let actionBtns = '';
  if (wo.status === 'open') {
    actionBtns = `
      <button onclick="event.stopPropagation();woSetStatus('${wo._fbId}','in-progress')" style="flex:1;padding:9px;background:#1e3a8a;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${t('wo.btn.start')}</button>
      <button onclick="event.stopPropagation();woSetStatus('${wo._fbId}','on-hold')" style="flex:1;padding:9px;background:#4a3a00;border:1px solid #856404;border-radius:8px;color:#fcd34d;font-weight:700;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${t('wo.btn.hold')}</button>`;
  } else if (wo.status === 'in-progress') {
    actionBtns = `
      <button onclick="event.stopPropagation();cycleWO('${wo._fbId}')" style="flex:2;padding:9px;background:#14532d;border:none;border-radius:8px;color:#86efac;font-weight:700;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${t('wo.btn.complete')}</button>
      <button onclick="event.stopPropagation();woSetStatus('${wo._fbId}','on-hold')" style="flex:1;padding:9px;background:#4a3a00;border:1px solid #856404;border-radius:8px;color:#fcd34d;font-weight:700;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${t('wo.btn.hold')}</button>`;
  } else if (wo.status === 'on-hold') {
    actionBtns = `
      <button onclick="event.stopPropagation();woSetStatus('${wo._fbId}','in-progress')" style="flex:1;padding:9px;background:#1e3a8a;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${t('wo.btn.resume')}</button>
      <button onclick="event.stopPropagation();woSetStatus('${wo._fbId}','open')" style="flex:1;padding:9px;background:#2a2a2a;border:1px solid #555;border-radius:8px;color:#ccc;font-weight:700;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${t('wo.btn.reopen')}</button>`;
  } else if (wo.status === 'completed') {
    actionBtns = `
      <button onclick="event.stopPropagation();woSetStatus('${wo._fbId}','open')" style="flex:1;padding:9px;background:#2a1a1a;border:1px solid #7f1d1d;border-radius:8px;color:#f87171;font-weight:700;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">${t('wo.btn.reopen')}</button>`;
  }

  const completionPhotoStrip = (wo.completionPhotos && wo.completionPhotos.length)
    ? `<div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap;">${wo.completionPhotos.map(p=>`<img src="${p}" style="height:55px;border-radius:6px;border:1px solid #2a5a2a;cursor:zoom-in;" onclick="event.stopPropagation();openCompletionPhotoViewer('${wo._fbId}')">`).join('')}</div>`
    : '';
  let timeToClose = '';
  if (wo.status === 'completed' && ts) {
    const closedTs = wo.completedTs?.toMillis ? wo.completedTs.toMillis() : (wo.completedTs || 0);
    if (closedTs) {
      const diffMins = Math.round((closedTs - ts) / 60000);
      if (diffMins < 60) timeToClose = ` · closed in ${diffMins}m`;
      else if (diffMins < 1440) timeToClose = ` · closed in ${Math.round(diffMins/60)}h`;
      else timeToClose = ` · closed in ${Math.round(diffMins/1440)}d`;
    }
  }
  const completedInfo = wo.status === 'completed' && wo.completedBy
    ? `<div style="margin-top:6px;padding:6px 8px;background:#0a1f0a;border-radius:6px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:#4caf50;">${t('wo.completedby')} ${wo.completedBy}${wo.completedDate?' · '+wo.completedDate:''}${timeToClose}${wo.completedNotes?'<br><span style="color:#7ab07a;">'+wo.completedNotes+'</span>':''}${completionPhotoStrip}</div>` : '';

  // Update log entries displayed on card
  const updateLog = (wo.updates && wo.updates.length)
    ? `<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px;">` +
      wo.updates.slice().reverse().map(u =>
        `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:5px;">
          <span style="font-size:9px;color:#4a6a4a;font-family:'IBM Plex Mono',monospace;white-space:nowrap;margin-top:2px;">${u.time||''}</span>
          <span style="font-size:12px;color:#d0c8b8;flex:1;">${u.text}</span>
          ${u.by?`<span style="font-size:10px;color:#4a7a4a;font-family:'IBM Plex Mono',monospace;white-space:nowrap;">— ${u.by}</span>`:''}
        </div>`
      ).join('') +
      `</div>`
    : '';

  return `<div class="wo-card ${wo.priority}${escalate?' wo-escalated':''}${slaBreach?' wo-sla-breach':''}">
    <div class="wo-id">${wo.id}<div class="wo-pri" style="color:${pC[wo.priority]}">${pL[wo.priority]}</div></div>
    <div class="wo-body">
      <h4>${wo.farm} · ${wo.house}${dT[wo.down]||''}</h4>
      <span class="prob-tag">${wo.problem}</span>
      <p>${wo.desc}</p>
      ${wo.parts?`<p style="margin-top:5px;font-size:12px;color:var(--green-mid)">🔩 ${wo.parts}</p>`:''}
      ${completedInfo}
      ${photoStrip}
      ${updateLog}
    </div>
    <div class="wo-meta">
      <span class="badge ${wo.status}">${wo.status.replace('-',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span>
      ${woAgePill(wo)}
      <span class="wo-meta-txt">👤 ${wo.tech||t('wo.unassigned')}${wo.assignedTo?' <span style="color:#3b82f6;font-weight:700;">→ '+wo.assignedTo+'</span>':''}</span>
      <span class="wo-meta-txt">${wo.submitted||''}</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
      ${actionBtns}
      <button onclick="event.stopPropagation();openWOUpdate('${wo._fbId}')" style="padding:9px 12px;background:#1a2a1a;border:1px solid #2a4a2a;border-radius:8px;color:#7ab07a;font-weight:700;font-size:12px;cursor:pointer;font-family:'IBM Plex Mono',monospace;">💬 Update</button>
      <button onclick="event.stopPropagation();toggleWORail('${wo._fbId}',${!wo.actionRail})" title="${wo.actionRail?'Remove from Action Rail':'Add to Action Rail'}" style="padding:9px 10px;background:${wo.actionRail?'#2a1f00':'#1a1a1a'};border:1px solid ${wo.actionRail?'#856404':'#333'};border-radius:8px;color:${wo.actionRail?'#f59e0b':'#555'};font-size:13px;cursor:pointer;" >⚡</button>
      <button onclick="event.stopPropagation();toggleWOMeeting('${wo._fbId}',${!wo.meetingFlag})" title="${wo.meetingFlag?'Remove from Meeting':'Flag for Meeting'}" style="padding:9px 10px;background:${wo.meetingFlag?'#0d1f3a':'#1a1a1a'};border:1px solid ${wo.meetingFlag?'#2a4a6a':'#333'};border-radius:8px;color:${wo.meetingFlag?'#60a5fa':'#555'};font-size:13px;cursor:pointer;">📋</button>
    </div>
  </div>`;
}

// ── WO Update (append-only notes) ────────────
function openWOUpdate(fbId) {
  const wo = workOrders.find(w => w._fbId === fbId);
  if (!wo) return;
  const existing = document.getElementById('wo-update-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'wo-update-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center;padding:0 0 0 0;';
  modal.innerHTML = `
    <div style="background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:16px 16px 0 0;width:100%;max-width:min(720px,96vw);padding:20px 18px 32px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#f0ead8;">💬 Add Update — ${wo.id}</div>
          <div style="font-size:11px;color:#5a8a5a;margin-top:2px;">${wo.farm} · ${wo.house} · ${wo.problem}</div>
        </div>
        <button onclick="document.getElementById('wo-update-modal').remove()" style="background:none;border:none;color:#5a8a5a;font-size:20px;cursor:pointer;line-height:1;">✕</button>
      </div>
      <textarea id="wo-update-text" placeholder="e.g. Waiting on parts — ordered belt tensioner, ETA Thursday..." style="width:100%;background:#0a140a;border:1.5px solid #2a5a2a;border-radius:10px;color:#f0ead8;padding:12px 14px;font-size:14px;font-family:inherit;box-sizing:border-box;resize:none;min-height:90px;"></textarea>
      <div style="display:flex;gap:8px;margin-top:10px;align-items:center;">
        <input type="text" id="wo-update-by" placeholder="Your name (optional)" list="staff-datalist" autocomplete="off" style="flex:1;background:#0a140a;border:1px solid #1e3a1e;border-radius:8px;color:#f0ead8;padding:9px 12px;font-size:13px;font-family:inherit;">
        <button id="wo-update-save-btn" onclick="saveWOUpdate('${fbId}')" style="padding:10px 20px;background:#1a4a2a;border:2px solid #2a7a3a;border-radius:10px;color:#f0ead8;font-size:13px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">Save</button>
      </div>
      <div id="wo-update-result" style="display:none;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#4caf50;margin-top:10px;text-align:center;">✓ Update saved</div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  setTimeout(() => document.getElementById('wo-update-text')?.focus(), 50);
}

async function saveWOUpdate(fbId) {
  const text = (document.getElementById('wo-update-text')?.value || '').trim();
  if (!text) { document.getElementById('wo-update-text')?.focus(); return; }
  const by   = (document.getElementById('wo-update-by')?.value || '').trim();
  const btn  = document.getElementById('wo-update-save-btn');
  if (btn) btn.disabled = true;

  const now  = new Date();
  const time = now.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' +
               now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const entry = { text, by, time, ts: Date.now() };

  try {
    const wo = workOrders.find(w => w._fbId === fbId);
    const current = wo?.updates || [];
    await db.collection('workOrders').doc(fbId).update({
      updates: [...current, entry]
    });
    const res = document.getElementById('wo-update-result');
    if (res) res.style.display = 'block';
    setTimeout(() => document.getElementById('wo-update-modal')?.remove(), 1000);
  } catch(e) {
    alert('Save failed: ' + e.message);
    if (btn) btn.disabled = false;
  }
}

// ── Action Rail & Meeting Flag ────────────────
async function toggleWORail(fbId, state) {
  try { await db.collection('workOrders').doc(fbId).update({ actionRail: state }); } catch(e) { console.error(e); }
}

async function toggleWOMeeting(fbId, state) {
  try { await db.collection('workOrders').doc(fbId).update({ meetingFlag: state }); } catch(e) { console.error(e); }
}

async function removeFromRail(fbId) {
  try { await db.collection('workOrders').doc(fbId).update({ actionRail: false }); } catch(e) { console.error(e); }
}

function openMeetingAgenda() {
  const existing = document.getElementById('meeting-agenda-modal');
  if (existing) existing.remove();

  const flagged = workOrders.filter(w => w.meetingFlag && w.status !== 'completed');
  const modal = document.createElement('div');
  modal.id = 'meeting-agenda-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.8);display:flex;align-items:flex-start;justify-content:center;padding:20px 16px;overflow-y:auto;';

  const items = flagged.length ? flagged.map(wo => {
    const lastUpdate = wo.updates && wo.updates.length ? wo.updates[wo.updates.length-1] : null;
    return `<div style="background:#0d1a2a;border:1px solid #1e3a5a;border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#60a5fa;">${wo.id}</span>
        <span class="badge ${wo.priority}" style="font-size:10px;">${wo.priority}</span>
        <span style="font-size:11px;color:#8aacca;">${wo.farm} · ${wo.house}</span>
        ${wo.actionRail?'<span style="background:#2a1f00;border:1px solid #856404;border-radius:4px;padding:2px 6px;font-size:9px;color:#f59e0b;font-family:\'IBM Plex Mono\',monospace;">⚡ ACTION</span>':''}
      </div>
      <div style="font-size:12px;color:#60a5fa;font-weight:600;margin-bottom:4px;">${wo.problem}</div>
      <div style="font-size:13px;color:#d0c8b8;margin-bottom:6px;">${wo.desc}</div>
      ${lastUpdate?`<div style="background:#0a1520;border-left:3px solid #2a4a6a;padding:6px 10px;border-radius:4px;font-size:11px;color:#8aacca;"><strong>Last update:</strong> ${lastUpdate.text}${lastUpdate.by?' — '+lastUpdate.by:''}<span style="color:#4a6a8a;margin-left:6px;">${lastUpdate.time||''}</span></div>`:'<div style="font-size:11px;color:#3a5a7a;font-style:italic;">No updates yet</div>'}
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button onclick="document.getElementById('meeting-agenda-modal').remove();openWOUpdate('${wo._fbId}')" style="padding:6px 12px;background:#0f1a2a;border:1px solid #2a4a6a;border-radius:6px;color:#60a5fa;font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">💬 Add Update</button>
        <button onclick="toggleWOMeeting('${wo._fbId}',false)" style="padding:6px 10px;background:#0a0a0a;border:1px solid #2a2a2a;border-radius:6px;color:#555;font-size:11px;cursor:pointer;">Remove from Meeting</button>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center;padding:30px;color:#3a5a7a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">No WOs flagged for meeting.<br><br>Tap 📋 on any work order to add it here.</div>';

  modal.innerHTML = `
    <div style="background:#080d14;border:1.5px solid #1e3a5a;border-radius:16px;width:100%;max-width:520px;padding:20px 18px 28px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #1e3a5a;">
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;color:#f0ead8;letter-spacing:1px;">📋 Meeting Agenda</div>
          <div style="font-size:11px;color:#4a6a8a;margin-top:2px;">${flagged.length} WO${flagged.length!==1?'s':''} flagged for discussion</div>
        </div>
        <button onclick="document.getElementById('meeting-agenda-modal').remove()" style="background:none;border:none;color:#4a6a8a;font-size:22px;cursor:pointer;">✕</button>
      </div>
      ${items}
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// Lightbox viewer for WO photos
function openPhotoViewer(fbId) {
  const wo = workOrders.find(w => w._fbId === fbId);
  if (!wo || !wo.photos || !wo.photos.length) return;
  let idx = 0;
  const overlay = document.createElement('div');
  overlay.id = 'photo-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;flex-direction:column;';
  const renderLB = () => {
    overlay.innerHTML = `
      <div style="position:relative;max-width:90vw;max-height:80vh;">
        <img src="${wo.photos[idx]}" style="max-width:90vw;max-height:75vh;border-radius:10px;display:block;">
        <div style="text-align:center;color:#ccc;font-size:13px;margin-top:8px;">${idx+1} / ${wo.photos.length} · ${wo.id} · ${wo.farm} · ${wo.house}</div>
      </div>
      <div style="display:flex;gap:16px;margin-top:14px;">
        ${wo.photos.length > 1 ? `<button onclick="event.stopPropagation();window._lbPrev()" style="padding:10px 20px;background:#333;border:1px solid #555;color:white;border-radius:8px;cursor:pointer;font-size:14px;">${t('wo.photo.prev')}</button>` : ''}
        ${wo.photos.length > 1 ? `<button onclick="event.stopPropagation();window._lbNext()" style="padding:10px 20px;background:#333;border:1px solid #555;color:white;border-radius:8px;cursor:pointer;font-size:14px;">${t('wo.photo.next')}</button>` : ''}
        <button onclick="document.getElementById('photo-lightbox').remove()" style="padding:10px 20px;background:#c0392b;border:none;color:white;border-radius:8px;cursor:pointer;font-size:14px;">${t('wo.photo.close')}</button>
      </div>`;
  };
  window._lbPrev = () => { idx = (idx - 1 + wo.photos.length) % wo.photos.length; renderLB(); };
  window._lbNext = () => { idx = (idx + 1) % wo.photos.length; renderLB(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  renderLB();
  document.body.appendChild(overlay);
}

function openCompletionPhotoViewer(fbId) {
  const wo = workOrders.find(w => w._fbId === fbId);
  if (!wo || !wo.completionPhotos || !wo.completionPhotos.length) return;
  let idx = 0;
  const overlay = document.createElement('div');
  overlay.id = 'photo-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;flex-direction:column;';
  const renderLB = () => {
    overlay.innerHTML = `
      <div style="text-align:center;color:#4caf50;font-size:11px;font-family:'IBM Plex Mono',monospace;margin-bottom:8px;">✓ AFTER REPAIR — ${wo.id}</div>
      <div style="position:relative;max-width:90vw;max-height:80vh;">
        <img src="${wo.completionPhotos[idx]}" style="max-width:90vw;max-height:72vh;border-radius:10px;display:block;">
        <div style="text-align:center;color:#ccc;font-size:13px;margin-top:8px;">${idx+1} / ${wo.completionPhotos.length} · ${wo.farm} · ${wo.house}</div>
      </div>
      <div style="display:flex;gap:16px;margin-top:14px;">
        ${wo.completionPhotos.length > 1 ? `<button onclick="event.stopPropagation();window._lbPrev()" style="padding:10px 20px;background:#333;border:1px solid #555;color:white;border-radius:8px;cursor:pointer;font-size:14px;">◀ Prev</button>` : ''}
        ${wo.completionPhotos.length > 1 ? `<button onclick="event.stopPropagation();window._lbNext()" style="padding:10px 20px;background:#333;border:1px solid #555;color:white;border-radius:8px;cursor:pointer;font-size:14px;">Next ▶</button>` : ''}
        <button onclick="document.getElementById('photo-lightbox').remove()" style="padding:10px 20px;background:#c0392b;border:none;color:white;border-radius:8px;cursor:pointer;font-size:14px;">✕ Close</button>
      </div>`;
  };
  window._lbPrev = () => { idx = (idx - 1 + wo.completionPhotos.length) % wo.completionPhotos.length; renderLB(); };
  window._lbNext = () => { idx = (idx + 1) % wo.completionPhotos.length; renderLB(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  renderLB();
  document.body.appendChild(overlay);
}

let pendingCycleFbId = null;

function cycleWO(fbId) {
  const wo = workOrders.find(w=>w._fbId===fbId);
  if (!wo) return;
  const cycle = ['open','in-progress','completed','on-hold'];
  const newStatus = cycle[(cycle.indexOf(wo.status)+1) % cycle.length];
  pendingCycleFbId = fbId;

  // If completing — show closeout modal instead
  if (newStatus === 'completed') {
    openCloseout(wo);
    return;
  }

  const fmtS = s => s.replace('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
  document.getElementById('confirm-wo-info').textContent = `${wo.id} · ${wo.farm} · ${wo.house}`;
  document.getElementById('confirm-from-badge').textContent = fmtS(wo.status);
  document.getElementById('confirm-from-badge').className = `badge ${wo.status}`;
  document.getElementById('confirm-to-badge').textContent = fmtS(newStatus);
  document.getElementById('confirm-to-badge').className = `badge ${newStatus}`;
  document.getElementById('wo-confirm').classList.add('open');
}

function closeWOConfirm() {
  document.getElementById('wo-confirm').classList.remove('open');
  pendingCycleFbId = null;
}

async function confirmWOCycle() {
  if (!pendingCycleFbId) return;
  const wo = workOrders.find(w=>w._fbId===pendingCycleFbId);
  if (!wo) return;
  const cycle = ['open','in-progress','completed','on-hold'];
  const newStatus = cycle[(cycle.indexOf(wo.status)+1) % cycle.length];
  closeWOConfirm();
  setSyncDot('saving');
  try {
    await db.collection('workOrders').doc(wo._fbId).update({status: newStatus});
  } catch(e) { console.error('WO cycle failed:', e); alert('Update failed: ' + e.message); }
  setSyncDot('live');
}

// Direct status setter — used by the explicit action buttons on WO cards
async function woSetStatus(fbId, newStatus) {
  const wo = workOrders.find(w => w._fbId === fbId);
  if (!wo) return;
  // Demo WOs (no real Firestore doc) — update local array only
  if (fbId.startsWith('demo-')) {
    wo.status = newStatus;
    renderWO();
    return;
  }
  setSyncDot('saving');
  try {
    await db.collection('workOrders').doc(fbId).update({ status: newStatus, updatedTs: Date.now() });
    // Optimistically update local copy for instant UI feedback
    wo.status = newStatus;
    renderWO();
  } catch(e) {
    console.error('woSetStatus failed:', e);
    alert('Could not update work order: ' + e.message);
  }
  setSyncDot('live');
}

const SITE_TECHS = {
  Hegins:   ['Nathan','Adam','Carlos','Randy','Steve'],
  Danville: ['Josh','Cain','Celia','Deb','Steve'],
};

function loadHouses() {
  const farm = document.getElementById('wo-farm').value;

  // Update house dropdown
  const sel = document.getElementById('wo-house');
  sel.innerHTML = '<option value="">— Select House / Area —</option>';
  const hg = document.createElement('optgroup'); hg.label = 'Houses';
  (FARM_HOUSES[farm]||[]).forEach(h=>{const o=document.createElement('option');o.value=h;o.textContent=h;hg.appendChild(o);});
  const ag = document.createElement('optgroup'); ag.label = 'Common Areas';
  AREAS.forEach(a=>{const o=document.createElement('option');o.value=a;o.textContent=a;ag.appendChild(o);});
  sel.appendChild(hg); sel.appendChild(ag);

  // Update tech dropdown to show only this site's crew
  const techSel = document.getElementById('wo-tech');
  const currentTech = techSel.value;
  techSel.innerHTML = '<option value="">— Select Tech —</option>';
  const techs = farm ? SITE_TECHS[farm] : ['Adam','Nathan','Carlos','Randy','Josh','Cain','Celia','Deb','Steve'];
  techs.forEach(name => {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    if (name === currentTech) o.selected = true;
    techSel.appendChild(o);
  });

  // Update Assign To dropdown with same crew
  const assignSel = document.getElementById('wo-assign');
  if (assignSel) {
    const currentAssign = assignSel.value;
    assignSel.innerHTML = '<option value="">— Unassigned —</option>';
    techs.forEach(name => {
      const o = document.createElement('option');
      o.value = name; o.textContent = name;
      if (name === currentAssign) o.selected = true;
      assignSel.appendChild(o);
    });
  }
}

function setPri(val, el) {
  document.querySelectorAll('.pri-pill').forEach(p=>p.classList.remove('sel'));
  if (el) el.classList.add('sel');
  selPri = val;
}

// Stores compressed base64 data URIs for photos selected on the WO form
let pendingPhotoData = [];
// Stores compressed base64 data URIs for closeout (after-repair) photos
let pendingCloseoutPhotos = [];

function previewCloseoutPhotos(input) {
  const pv = document.getElementById('closeout-photo-preview');
  pv.innerHTML = '';
  pendingCloseoutPhotos = [];
  const files = [...input.files];
  if (!files.length) return;
  const info = document.createElement('div');
  info.style.cssText = 'font-size:11px;color:var(--muted);margin-top:4px;width:100%;';
  info.textContent = 'Processing…';
  pv.appendChild(info);
  let done = 0;
  files.forEach((f, idx) => {
    compressPhoto(f).then(uri => {
      pendingCloseoutPhotos[idx] = uri;
      const img = document.createElement('img');
      img.src = uri;
      img.style.cssText = 'height:60px;border-radius:6px;border:2px solid var(--border);';
      pv.insertBefore(img, info);
      done++;
      if (done === files.length) {
        info.style.color = 'var(--green-mid)';
        info.textContent = done + ' photo' + (done !== 1 ? 's' : '') + ' ready';
      }
    }).catch(() => { done++; });
  });
}

// Compress a File to a JPEG data URI, max 1200px on longest side, quality 0.72
// Returns a Promise<string>
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
          else        { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function previewPhotos(input) {
  const pv = document.getElementById('photo-preview');
  pv.innerHTML = '';
  pendingPhotoData = [];
  const files = [...input.files];
  if (!files.length) return;

  // Show a processing indicator while compressing
  const processing = document.createElement('div');
  processing.style.cssText = 'font-size:11px;color:var(--muted);margin-top:4px;';
  processing.textContent = 'Processing photos…';
  pv.appendChild(processing);

  let finished = 0;
  files.forEach((f, idx) => {
    compressPhoto(f).then(dataUri => {
      pendingPhotoData[idx] = dataUri;

      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;display:inline-block;margin:4px;';
      const img = document.createElement('img');
      img.src = dataUri;
      img.style.cssText = 'max-height:120px;border-radius:8px;border:2px solid var(--border);';
      wrap.appendChild(img);
      // Insert before the processing note
      pv.insertBefore(wrap, processing);

      finished++;
      if (finished === files.length) {
        // Show approx KB so the user can see the compressed size
        const totalKB = Math.round(pendingPhotoData.filter(Boolean).reduce((s, d) => s + d.length * 0.75 / 1024, 0));
        processing.style.color = 'var(--green-mid)';
        processing.textContent = finished + ' photo' + (finished !== 1 ? 's' : '') + ' ready — ~' + totalKB + 'KB';
      }
    }).catch(err => {
      console.error('Photo compress error', err);
      // Fall back to raw FileReader if canvas fails
      const r = new FileReader();
      r.onload = e => { pendingPhotoData[idx] = e.target.result; };
      r.readAsDataURL(f);
      finished++;
      if (finished === files.length) { processing.textContent = finished + ' photo(s) ready'; }
    });
  });
}

document.getElementById('wo-date').value = todayStr;

let _woSubmitting = false;

async function submitWO() {
  if (_woSubmitting) return;
  const tech=document.getElementById('wo-tech').value;
  const farm=document.getElementById('wo-farm').value;
  const house=document.getElementById('wo-house').value;
  const problem=document.getElementById('wo-problem').value;
  const desc=document.getElementById('wo-desc').value.trim();
  if (!tech)    return alert('Please select your name.');
  if (!farm)    return alert('Please select a farm location.');
  if (!house)   return alert('Please select a house or area.');
  if (!problem) return alert('Please select a problem type.');
  if (!desc)    return alert('Please describe the problem.');
  if (!selPri)  return alert('Please select a priority level.');

  _woSubmitting = true;
  const submitBtn = document.querySelector('#wo-form-card .btn-confirm');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

  try {
    const photos = pendingPhotoData.filter(Boolean);

    // Guard: Firestore doc limit ~1MB. Compress already ran; this is a final size check.
    const MAX_PHOTO_BYTES = 800 * 1024;
    const photoBytes = photos.reduce((s, d) => s + Math.round(d.length * 0.75), 0);
    let safePhotos = photos;
    if (photoBytes > MAX_PHOTO_BYTES) {
      let acc = 0;
      safePhotos = [];
      for (const p of photos) {
        const sz = Math.round(p.length * 0.75);
        if (acc + sz > MAX_PHOTO_BYTES) break;
        safePhotos.push(p);
        acc += sz;
      }
      if (safePhotos.length < photos.length) {
        alert(`Photos are large — only ${safePhotos.length} of ${photos.length} will be saved to keep the record under size limits.`);
      }
    }

    const wo = {
      id: 'WO-' + String(woCounter).padStart(3,'0'),
      date: document.getElementById('wo-date').value,
      tech, farm, house, problem, desc,
      priority: selPri,
      assignedTo: document.getElementById('wo-assign')?.value || '',
      parts: document.getElementById('wo-parts').value,
      down: document.getElementById('wo-down').value,
      status: 'open',
      notes: document.getElementById('wo-notes').value,
      photos: safePhotos,
      submitted: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      ts: Date.now()
    };

    setSyncDot('saving');
    const ref = await db.collection('workOrders').add(wo);
    wo._fbId = ref.id;
    woCounter++;
    workOrders.unshift(wo);
    renderWO();

    // Log write is best-effort — don't let it break the success screen
    try {
      await db.collection('activityLog').add({
        type:'wo', id:wo.id,
        desc:`WO submitted: ${wo.farm} · ${wo.house} — ${wo.problem}`,
        tech:wo.tech, date:wo.submitted, ts:Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }

    setSyncDot('live');

    // Notify on urgent/high WOs
    if (wo.priority === 'urgent') {
      sendNotif('🔴 Urgent WO Submitted', `${wo.id} · ${wo.farm} · ${wo.house} — ${wo.problem}`, wo.id);
    } else if (wo.priority === 'high') {
      sendNotif('🟡 High Priority WO', `${wo.id} · ${wo.farm} · ${wo.house} — ${wo.problem}`, wo.id);
    }

    // Only hide the form after everything succeeded
    _woSubmitting = false;
    document.getElementById('wo-form-card').style.display='none';
    document.getElementById('wo-success').style.display='block';
    document.getElementById('wo-success-num').textContent = wo.id + ' · ' + wo.farm + ' · ' + wo.house;

  } catch(err) {
    _woSubmitting = false;
    setSyncDot('live');
    console.error('submitWO error:', err);
    alert('Something went wrong saving the work order. Please try again.\n\nError: ' + err.message);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✓ SUBMIT WORK ORDER'; }
  }
}

function afterWOSubmit() {
  _woSubmitting = false;
  const fabBtn = document.getElementById('fab-btn');
  const woFormCard = document.getElementById('wo-form-card');
  if (fabBtn) fabBtn.style.display = '';
  if (woFormCard) woFormCard.style.display='';
  const woSuccess = document.getElementById('wo-success');
  if (woSuccess) woSuccess.style.display='none';
  ['wo-farm','wo-problem','wo-tech','wo-assign','wo-desc','wo-parts','wo-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const woDown = document.getElementById('wo-down'); if (woDown) woDown.value='no';
  const woHouse = document.getElementById('wo-house'); if (woHouse) woHouse.innerHTML='<option value="">— Select Farm First —</option>';
  const photoPreview = document.getElementById('photo-preview'); if (photoPreview) photoPreview.innerHTML='';
  const photoInput = document.getElementById('photo-input'); if (photoInput) photoInput.value='';
  pendingPhotoData = [];
  document.querySelectorAll('.pri-pill').forEach(p=>p.classList.remove('sel'));
  selPri='';
  document.getElementById('wo-date').value=todayStr;
  // Re-enable submit button in case it was left disabled by an error
  const submitBtn = document.querySelector('#wo-form-card .btn-confirm');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✓ SUBMIT WORK ORDER'; }
  window.scrollTo(0,0);
}

// ═══════════════════════════════════════════
// PM SCHEDULE
// ═══════════════════════════════════════════
function pmLoc(v,btn) {
  pmLocFilter=v;
  document.querySelectorAll('#pm-loc-bar .loc-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderPM();
}
function pmStat(v,btn) {
  pmStatFilter=v;
  document.querySelectorAll('#pm-filter-bar .pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderPM();
}
function pmSys(v,btn) {
  // Filter by system — reuse pmStatFilter as sys override when prefixed
  pmStatFilter='sys:'+v;
  document.querySelectorAll('#pm-filter-bar .pill').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderPM();
}

function renderPM() {
  let tasks = pmLocFilter==='all' ? ALL_PM : ALL_PM.filter(t=>t.farm===pmLocFilter);
  // Handle sys: prefix filters
  if (pmStatFilter && pmStatFilter.startsWith('sys:')) {
    const sysVal = pmStatFilter.slice(4);
    tasks = tasks.filter(t=>t.sys===sysVal);
  }
  document.getElementById('pm-stats').innerHTML =
    sc('s-red',tasks.filter(t=>pmStatus(t.id)==='overdue').length,'Overdue') +
    sc('s-amber',tasks.filter(t=>pmStatus(t.id)==='due-soon').length,'Due Soon') +
    sc('s-green',tasks.filter(t=>pmStatus(t.id)==='ok').length,'On Track') +
    sc('s-blue',tasks.filter(t=>doneToday(t.id)).length,'Done Today');

  let filtered=[...tasks];
  if (pmStatFilter==='overdue') filtered=tasks.filter(t=>pmStatus(t.id)==='overdue');
  else if (pmStatFilter==='soon') filtered=tasks.filter(t=>pmStatus(t.id)==='due-soon');
  else if (['daily','mwf','weekly','monthly','quarterly','semiannual','annual'].includes(pmStatFilter))
    filtered=tasks.filter(t=>t.freq===pmStatFilter);
  else if (pmStatFilter && pmStatFilter.startsWith('sys:'))
    filtered=tasks.filter(t=>t.sys===pmStatFilter.slice(4));

  filtered.sort((a,b)=>{
    const o=['overdue','due-soon','ok'];
    return o.indexOf(pmStatus(a.id))-o.indexOf(pmStatus(b.id));
  });

  const overdueCount = tasks.filter(t=>pmStatus(t.id)==='overdue').length;
  const dueSoonCount = tasks.filter(t=>pmStatus(t.id)==='due-soon').length;
  let banner = '';
  if (overdueCount > 0) {
    banner = `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#2d1a1a;border:1.5px solid #7f1d1d;border-radius:10px;margin-bottom:12px;">
      <span style="font-size:18px;">🔴</span>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#f87171;">${overdueCount} PM task${overdueCount!==1?'s':''} overdue</div>
        ${dueSoonCount>0?`<div style="font-size:11px;color:#fca5a5;margin-top:2px;">${dueSoonCount} more due soon</div>`:''}
      </div>
      <button onclick="pmStat('overdue',this)" style="margin-left:auto;padding:5px 10px;background:#7f1d1d;border:none;border-radius:6px;color:#fca5a5;font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">Show Overdue</button>
    </div>`;
  } else if (dueSoonCount > 0) {
    banner = `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#2a1f00;border:1.5px solid #856404;border-radius:10px;margin-bottom:12px;">
      <span style="font-size:18px;">🟡</span>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#fcd34d;">${dueSoonCount} PM task${dueSoonCount!==1?'s':''} due soon</div>
      <button onclick="pmStat('soon',this)" style="margin-left:auto;padding:5px 10px;background:#856404;border:none;border-radius:6px;color:#fef3c7;font-size:11px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">Show Due Soon</button>
    </div>`;
  }

  if (!filtered.length) {
    document.getElementById('pm-container').innerHTML = banner + '<div class="empty"><div class="ei">✅</div><p>All tasks on track.</p></div>';
    return;
  }

  let html = banner;
  for (const sys of ['Ventilation','Water','Feed','Manure','Egg Collectors','Building','Alarms','Lubing']) {
    const st=filtered.filter(t=>t.sys===sys);
    if (!st.length) continue;
    html+=`<div class="sys-hdr">${SYS_ICON[sys]} ${sys}</div><div class="card-list">`;
    html+=st.map(t=>pmCardHtml(t)).join('');
    html+='</div>';
  }
  document.getElementById('pm-container').innerHTML=html;
}

function pmCardHtml(t) {
  const status=pmStatus(t.id);
  const done=doneToday(t.id);
  const f=FREQ[t.freq];
  const comp=pmComps[t.id];
  const cardCls=done?'done-today':status;
  const badgeCls=done?'done':status;
  const badgeTxt=done?'✓ Done Today':nextDueLabel(t.id);
  const btnAttr=done?'disabled':`onclick="openPMModal('${t.id}')"`;
  return `<div class="pm-card ${cardCls}">
    <div><span class="pm-freq-icon">${f.icon}</span><span class="pm-freq-lbl">${f.label}</span></div>
    <div class="pm-body">
      <div class="pm-tags">
        <span class="pm-tag ${SYS_TAG[t.sys]}">${SYS_ICON[t.sys]} ${t.sys}</span>
        <span class="pm-tag t-loc">📍 ${t.farm}</span>
      </div>
      <h4>${t.task}</h4>
      <p>Est. ${t.hrs}h${comp?' · Last: '+fmtDate(comp.date)+' by '+comp.tech:' · Never completed'}</p>
    </div>
    <div class="pm-right">
      <span class="due-badge ${badgeCls}">${badgeTxt}</span>
      <button class="btn-done" ${btnAttr}>${done?'✓ Done':'Mark Done'}</button>
      <button class="btn-history" onclick="event.stopPropagation();openPMHistory('${t.id}')">📋 History</button>
    </div>
  </div>`;
}

function openPMModal(id) {
  modalPMId=id;
  const t=ALL_PM.find(x=>x.id===id);
  document.getElementById('modal-desc').textContent=`${t.farm} · ${SYS_ICON[t.sys]} ${t.sys} · ${FREQ[t.freq].label} — ${t.task}`;
  document.getElementById('modal-date').value=todayStr;
  document.getElementById('modal-parts').value='';
  document.getElementById('modal-notes').value='';
  document.getElementById('modal-gen-wo').value='no';

  // Filter techs by farm
  const techSel = document.getElementById('modal-tech');
  techSel.innerHTML = '<option value="">— Select Tech —</option>';
  (SITE_TECHS[t.farm]||[]).forEach(name=>{
    const o=document.createElement('option'); o.value=name; o.textContent=name; techSel.appendChild(o);
  });

  document.getElementById('pm-modal').classList.add('open');
}

function closePMModal() {
  document.getElementById('pm-modal').classList.remove('open');
  modalPMId=null;
}

async function confirmPM() {
  const tech=document.getElementById('modal-tech').value;
  if (!tech) return alert('Please select who completed this task.');
  const date=document.getElementById('modal-date').value;
  const parts=document.getElementById('modal-parts').value;
  const notes=document.getElementById('modal-notes').value;
  const genWO=document.getElementById('modal-gen-wo').value;
  const t=ALL_PM.find(x=>x.id===modalPMId);

  setSyncDot('saving');

  // Always update the 'latest' doc so status logic stays fast
  await db.collection('pmCompletions').doc(modalPMId).set({tech, date, parts, notes, ts:Date.now()});

  // Append to history — one record per completion, never overwritten
  await db.collection('pmHistory').add({
    pmId: modalPMId,
    farm: t.farm, sys: t.sys, task: t.task, freq: t.freq,
    tech, date, parts, notes, ts: Date.now()
  });

  await db.collection('activityLog').add({
    type:'pm', id:modalPMId,
    desc:`PM completed: ${t.farm} · ${SYS_ICON[t.sys]} ${t.sys} · ${FREQ[t.freq].label} — ${t.task}`,
    tech, date:fmtDate(date), parts, notes, ts:Date.now()
  });

  if (genWO==='yes') {
    const wo = {
      id: 'WO-' + String(woCounter).padStart(3,'0'),
      date, tech, farm:t.farm, house:'PM-Generated',
      problem:`${SYS_ICON[t.sys]} ${t.sys} — PM Follow-up`,
      desc:`Follow-up repair needed from PM: ${t.task}. Notes: ${notes}`,
      priority:'high', parts, down:'no', status:'open',
      notes:'Auto-generated from PM task',
      submitted:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), ts:Date.now()
    };
    await db.collection('workOrders').add(wo);
    await db.collection('activityLog').add({
      type:'wo', id:wo.id,
      desc:`WO auto-created from PM: ${t.farm} · ${t.sys}`,
      tech, date:wo.submitted, ts:Date.now()
    });
  }

  setSyncDot('live');
  closePMModal();
}

document.getElementById('pm-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closePMModal();});

// ═══════════════════════════════════════════
// PM HISTORY MODAL
// ═══════════════════════════════════════════
async function openPMHistory(pmId) {
  const t = ALL_PM.find(x => x.id === pmId);
  document.getElementById('pm-history-title').textContent = `${t.farm} · ${SYS_ICON[t.sys]} ${t.sys} · ${FREQ[t.freq].label}`;
  document.getElementById('pm-history-task').textContent = t.task;
  document.getElementById('pm-history-list').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);">Loading...</div>';
  document.getElementById('pm-history-modal').classList.add('open');

  try {
    const snap = await db.collection('pmHistory')
      .where('pmId','==', pmId)
      .orderBy('ts','desc')
      .limit(20)
      .get();
    if (snap.empty) {
      document.getElementById('pm-history-list').innerHTML = '<div class="empty"><div class="ei">📋</div><p>No history yet — completions will appear here.</p></div>';
      return;
    }
    document.getElementById('pm-history-list').innerHTML = snap.docs.map(d => {
      const h = d.data();
      return `<div style="background:#f9f9f9;border-radius:10px;padding:11px 14px;margin-bottom:8px;border-left:3px solid var(--green-mid);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:700;font-size:13px;">👤 ${h.tech}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);">${fmtDate(h.date)}</span>
        </div>
        ${h.parts ? `<div style="font-size:12px;color:var(--muted);">🔩 ${h.parts}</div>` : ''}
        ${h.notes ? `<div style="font-size:12px;font-style:italic;margin-top:3px;">${h.notes}</div>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    document.getElementById('pm-history-list').innerHTML = '<div class="empty"><div class="ei">⚠️</div><p>Could not load history.</p></div>';
  }
}

function closePMHistory() {
  document.getElementById('pm-history-modal').classList.remove('open');
}

// ═══════════════════════════════════════════
// LOG
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// MORNING BRIEFING
// ═══════════════════════════════════════════
const LEADS = { Hegins: 'Nathan', Danville: 'Josh' };
let dailyCheckins = {}; // loaded from Firebase: {'checkin-Hegins-2026-03-15': ['Nathan','Adam',...]}

function toggleCheckin(farm, name, todayKey) {
  if (!dailyCheckins[todayKey]) dailyCheckins[todayKey] = [];
  const idx = dailyCheckins[todayKey].indexOf(name);
  if (idx > -1) dailyCheckins[todayKey].splice(idx, 1);
  else dailyCheckins[todayKey].push(name);

  // Update button
  const btn = document.getElementById(`checkin-${name}`);
  const isOn = dailyCheckins[todayKey].includes(name);
  btn.className = `checkin-btn ${isOn?'on':'off'}`;
  btn.textContent = (isOn?'✓ ':'')+name;

  updateCheckinLabel(todayKey);

  // Save to Firebase
  db.collection('dailyCheckins').doc(todayKey).set({
    crew: dailyCheckins[todayKey],
    farm,
    date: new Date().toISOString().slice(0,10),
    ts: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e=>console.error(e));
}

function updateCheckinLabel(todayKey) {
  const crew = dailyCheckins[todayKey]||[];
  const el = document.getElementById('briefing-crew-confirmed');
  if (el) el.textContent = crew.length > 0
    ? `✓ ${crew.length} on site: ${crew.join(', ')}`
    : 'Tap names to check in';
}

function openBriefing(farm) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  document.getElementById('briefing-title').textContent = `🌅 ${farm} Morning Briefing`;
  document.getElementById('briefing-date').textContent = dateStr;

  // Crew check-in buttons
  const crew = SITE_TECHS[farm] || [];
  const todayKey = `checkin-${farm}-${new Date().toISOString().slice(0,10)}`;
  // Load today's check-ins from memory (already loaded from Firebase)
  const checkedIn = dailyCheckins[todayKey] || [];
  document.getElementById('briefing-crew').innerHTML = crew.map(name => {
    const isOn = checkedIn.includes(name);
    return `<button class="checkin-btn ${isOn?'on':'off'}" id="checkin-${name}" onclick="toggleCheckin('${farm}','${name}','${todayKey}')">${isOn?'✓':''} ${name}</button>`;
  }).join('');
  updateCheckinLabel(todayKey);

  // Open/In-Progress WOs for this farm
  const wos = workOrders.filter(w=> w.farm===farm && (w.status==='open'||w.status==='in-progress'||w.status==='on-hold'));
  document.getElementById('briefing-wos').innerHTML = wos.length
    ? wos.map(wo=>woCardHtml(wo)).join('')
    : '<div class="empty"><div class="ei">✅</div><p>No open work orders</p></div>';

  // Today's PM tasks for this farm
  const todayPMs = ALL_PM.filter(t=> t.farm===farm && !doneToday(t.id) && (t.freq==='daily' || pmStatus(t.id)==='overdue' || pmStatus(t.id)==='due-soon'));
  const activeCrew = (dailyCheckins[todayKey]||[]).length > 0 ? dailyCheckins[todayKey] : (SITE_TECHS[farm]||[]);
  const techOptions = activeCrew.map(t=>`<option>${t}</option>`).join('');
  document.getElementById('briefing-pms').innerHTML = todayPMs.length
    ? todayPMs.map(t=>`
        <div class="briefing-pm-row">
          <div style="flex:1;">
            <h4>${t.task}</h4>
            <p>${SYS_ICON[t.sys]||''} ${t.sys} · ${FREQ[t.freq]?.label||t.freq}</p>
          </div>
          <select class="briefing-pm-assign" id="assign-${t.id}">
            <option value="">Assign to...</option>
            ${techOptions}
          </select>
        </div>`).join('')
    : '<div class="empty"><div class="ei">✅</div><p>All PM tasks up to date</p></div>';

  // Low stock parts
  const lowParts = PARTS_DEFS.filter(p=>{
    const inv = partsInventory[p.id]||{qty:0,min:1};
    return inv.qty <= inv.min;
  });
  document.getElementById('briefing-parts').innerHTML = lowParts.length
    ? lowParts.map(p=>{
        const inv = partsInventory[p.id]||{qty:0,min:1};
        return `<div class="parts-card">
          <div class="parts-qty low">${inv.qty}</div>
          <div class="parts-info"><h4>${p.name}</h4><p>#${p.itemNo}</p></div>
          <div class="parts-min">Min: ${inv.min}</div>
        </div>`;
      }).join('')
    : '<div class="empty"><div class="ei">✅</div><p>All parts stocked</p></div>';

  // Clear notes
  document.getElementById('briefing-notes').value = '';

  document.getElementById('briefing-modal').classList.add('open');
}

function closeBriefing() {
  document.getElementById('briefing-modal').classList.remove('open');
}

// ═══════════════════════════════════════════
// PARTS
// ═══════════════════════════════════════════
function partsFilter(v, btn) {
  partsFilter_ = v;
  document.querySelectorAll('#panel-maint .maint-section#maint-parts .pill, #panel-parts .pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderParts();
}

function renderParts() {
  // Apply search filter first
  const searchVal = (document.getElementById('parts-search-input')?.value || '').toLowerCase().trim();

  let list = partsFilter_==='all' ? PARTS_DEFS
    : partsFilter_==='low' ? PARTS_DEFS.filter(p=>{
        const inv = partsInventory[p.id]||{qty:0,min:1};
        return inv.qty <= inv.min;
      })
    : PARTS_DEFS.filter(p=>p.sys===partsFilter_);

  if (searchVal) {
    list = list.filter(p =>
      (p.name||'').toLowerCase().includes(searchVal) ||
      (p.itemNo||'').toLowerCase().includes(searchVal) ||
      (p.sys||'').toLowerCase().includes(searchVal) ||
      (p.rhNum||'').toLowerCase().includes(searchVal) ||
      (p.notes||'').toLowerCase().includes(searchVal)
    );
  }

  const total = PARTS_DEFS.length;
  const lowCount = PARTS_DEFS.filter(p=>{
    const inv = partsInventory[p.id]||{qty:0,min:1};
    return inv.qty <= inv.min;
  }).length;
  const totalVal = PARTS_DEFS.reduce((sum,p)=>{
    const inv = partsInventory[p.id]||{qty:0};
    return sum + (inv.qty * (p.unitPrice||0));
  },0);

  document.getElementById('parts-stats').innerHTML =
    `<div class="stat-card"><div class="stat-num">${total}</div><div class="stat-lbl">Total Parts</div></div>` +
    `<div class="stat-card"><div class="stat-num" style="color:${lowCount>0?'#e53e3e':'var(--green-mid)'};">${lowCount}</div><div class="stat-lbl">Low Stock</div></div>` +
    `<div class="stat-card"><div class="stat-num">$${totalVal.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</div><div class="stat-lbl">Inventory Value</div></div>`;

  // Update badge
  const badge = document.getElementById('parts-alert-badge');
  if (badge) {
    if (lowCount > 0) { badge.textContent=lowCount; badge.style.display='inline'; }
    else badge.style.display='none';
  }

  if (!list.length) {
    document.getElementById('parts-container').innerHTML='<div class="empty"><div class="ei">🔩</div><p>No parts match this filter.</p></div>';
    return;
  }

  // Group by system
  const systems = [...new Set(list.map(p=>p.sys))];
  let html='';
  for (const sys of systems) {
    const sysparts = list.filter(p=>p.sys===sys);
    html+=`<div class="sys-hdr">${SYS_ICON[sys]||'🔩'} ${sys}</div><div class="card-list">`;
    for (const p of sysparts) {
      const inv = partsInventory[p.id]||{qty:0,min:1};
      const isLow = inv.qty <= inv.min;
      const editBtn = `<button onclick="event.stopPropagation();openPartForm('${p.id}')" style="padding:5px 10px;font-size:11px;background:#f0f0f0;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-weight:600;flex-shrink:0;">✏️ Edit</button>`;
      html+=`<div class="parts-card" onclick="openPartsModal('${p.id}')">
        <div class="parts-qty ${isLow?'low':'ok'}">${inv.qty}</div>
        <div class="parts-info" style="flex:1;">
          <h4>${p.name}</h4>
          <p><span style="font-weight:700;color:var(--green-mid);">${p.rhNum||''}</span>${p.rhNum?' &nbsp;·&nbsp; ':''} #${p.itemNo}${p.unitPrice?` · $${p.unitPrice.toFixed(2)}/ea`:''}</p>
          ${p.notes?`<p style="font-size:11px;color:var(--muted);margin-top:2px;">${p.notes}</p>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
          <div class="parts-min">Min: ${inv.min}</div>
          ${editBtn}
        </div>
      </div>`;
    }
    html+='</div>';
  }
  document.getElementById('parts-container').innerHTML=html;
}

function openPartsModal(id) {
  const p = PARTS_DEFS.find(x=>x.id===id);
  const inv = partsInventory[id]||{qty:0,min:1};
  editingPartId = id;
  editingPartQty = inv.qty;
  document.getElementById('parts-modal-name').textContent = p.name;
  document.getElementById('parts-modal-num').textContent = p.rhNum + ' · #' + p.itemNo;
  document.getElementById('parts-modal-qty').textContent = editingPartQty;
  document.getElementById('parts-modal-min').value = inv.min||1;
  document.getElementById('parts-modal').classList.add('open');
}

function partsAdjust(delta) {
  editingPartQty = Math.max(0, editingPartQty + delta);
  document.getElementById('parts-modal-qty').textContent = editingPartQty;
}

function closePartsModal() {
  document.getElementById('parts-modal').classList.remove('open');
  editingPartId = null;
}

async function savePartsQty() {
  if (!editingPartId) return;
  const min = parseInt(document.getElementById('parts-modal-min').value)||1;
  const oldQty = (partsInventory[editingPartId]||{qty:0}).qty;
  partsInventory[editingPartId] = {qty: editingPartQty, min};
  try {
    await db.collection('partsInventory').doc(editingPartId).set({qty: editingPartQty, min, ts: firebase.firestore.FieldValue.serverTimestamp()});
    const part = PARTS_DEFS.find(p => p.id === editingPartId);
    const partName = part ? part.name : editingPartId;
    const delta = editingPartQty - oldQty;
    const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
    await db.collection('activityLog').add({
      type: 'parts',
      id: editingPartId,
      desc: `Parts adjusted: ${partName} — ${deltaStr} (${oldQty} → ${editingPartQty})`,
      tech: 'Manual',
      date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      ts: Date.now()
    });
  } catch(e) { console.error(e); }
  closePartsModal();
  renderParts();
  updatePartsAlerts();
}

function updatePartsAlerts() {
  const lowCount = PARTS_DEFS.filter(p=>{
    const inv = partsInventory[p.id]||{qty:0,min:1};
    return inv.qty <= inv.min;
  }).length;
  const badge = document.getElementById('parts-alert-badge');
  if (badge) {
    if (lowCount>0) { badge.textContent=lowCount; badge.style.display='inline'; }
    else badge.style.display='none';
  }
  // Also refresh the parts panel order button if it's visible
  if (window._maintSection==='parts') renderParts();
}

// ═══════════════════════════════════════════
// PART ADD / EDIT
// ═══════════════════════════════════════════
let editingPartDefId = null; // fbId of part being edited (null = new)

// Load user-added parts from Firestore and merge into PARTS_DEFS
async function loadCustomParts() {
  try {
    const snap = await db.collection('partsDefs').get();
    snap.forEach(d => {
      const p = { ...d.data(), _fbId: d.id, _custom: true };
      // Avoid duplicates on hot-reload
      if (!PARTS_DEFS.find(x => x.id === p.id)) PARTS_DEFS.push(p);
      else Object.assign(PARTS_DEFS.find(x => x.id === p.id), p);
    });
    assignRHNumbers();
  } catch(e) { console.error('loadCustomParts:', e); }
}

// Real-time listener so parts added by others appear instantly
function startPartsDefsListener() {
  db.collection('partsDefs').onSnapshot(snap => {
    snap.docChanges().forEach(change => {
      const p = { ...change.doc.data(), _fbId: change.doc.id, _custom: true };
      const idx = PARTS_DEFS.findIndex(x => x.id === p.id);
      if (change.type === 'removed') {
        if (idx !== -1) PARTS_DEFS.splice(idx, 1);
      } else {
        if (idx === -1) PARTS_DEFS.push(p);
        else Object.assign(PARTS_DEFS[idx], p);
      }
    });
    assignRHNumbers();
    if (document.getElementById('panel-parts')?.classList.contains('active') || window._maintSection==='parts') renderParts();
  });
}

// ═══════════════════════════════════════════
// RECEIVE STOCK
// ═══════════════════════════════════════════
function openReceiveStock() {
  // Populate part dropdown grouped by system
  const sel = document.getElementById('rs-part');
  sel.innerHTML = '<option value="">— Select Part —</option>';
  const systems = [...new Set(PARTS_DEFS.map(p=>p.sys))].sort();
  systems.forEach(sys => {
    const grp = document.createElement('optgroup');
    grp.label = (SYS_ICON[sys]||'🔩') + ' ' + sys;
    PARTS_DEFS.filter(p=>p.sys===sys).forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      const inv = partsInventory[p.id]||{qty:0};
      o.textContent = `${p.rhNum||p.itemNo} — ${p.name} (in stock: ${inv.qty})`;
      grp.appendChild(o);
    });
    sel.appendChild(grp);
  });
  document.getElementById('rs-qty').value = '1';
  document.getElementById('rs-current').value = '';
  document.getElementById('rs-po').value = '';
  document.getElementById('rs-notes').value = '';
  document.getElementById('rs-result').style.display = 'none';
  document.getElementById('rs-save-btn').disabled = false;
  document.getElementById('rs-save-btn').textContent = '📦 Receive';
  document.getElementById('receive-stock-modal').classList.add('open');
}

document.getElementById('rs-part').addEventListener('change', function() {
  const inv = partsInventory[this.value]||{qty:0};
  document.getElementById('rs-current').value = this.value ? inv.qty : '';
});

function closeReceiveStock() {
  document.getElementById('receive-stock-modal').classList.remove('open');
}

async function saveReceiveStock() {
  const partId = document.getElementById('rs-part').value;
  const qty = parseInt(document.getElementById('rs-qty').value)||0;
  const po = document.getElementById('rs-po').value.trim();
  const notes = document.getElementById('rs-notes').value.trim();

  if (!partId) return alert('Please select a part.');
  if (qty < 1) return alert('Quantity must be at least 1.');

  const part = PARTS_DEFS.find(p=>p.id===partId);
  const inv = partsInventory[partId]||{qty:0, min:1};
  const newQty = inv.qty + qty;

  const btn = document.getElementById('rs-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  setSyncDot('saving');

  try {
    partsInventory[partId] = {...inv, qty: newQty};
    await db.collection('partsInventory').doc(partId).set(
      {qty: newQty, min: inv.min||1, ts: firebase.firestore.FieldValue.serverTimestamp()},
      {merge: true}
    );
    const desc = `Stock received: ${part.name} +${qty} (${inv.qty} → ${newQty})${po?' · '+po:''}${notes?' · '+notes:''}`;
    await db.collection('activityLog').add({
      type: 'parts', id: partId,
      desc, tech: 'Receiving',
      date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      ts: Date.now()
    });
    setSyncDot('live');

    const resultEl = document.getElementById('rs-result');
    resultEl.textContent = `✅ ${part.name}: ${inv.qty} → ${newQty} in stock`;
    resultEl.style.display = 'block';
    document.getElementById('rs-current').value = newQty;
    btn.textContent = 'Received!';
    updatePartsAlerts();
    renderParts();
    setTimeout(closeReceiveStock, 1200);
  } catch(e) {
    setSyncDot('live');
    btn.disabled = false; btn.textContent = '📦 Receive';
    alert('Error saving: ' + e.message);
  }
}

function openPartForm(partId) {
  requireAdmin(() => _openPartForm(partId));
}
function _openPartForm(partId) {
  editingPartDefId = null;
  document.getElementById('part-form-title').textContent = 'Add Part';
  document.getElementById('pf-delete-row').style.display = 'none';
  // Clear fields
  ['pf-name','pf-itemno','pf-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pf-sys').value = '';
  document.getElementById('pf-price').value = '';
  document.getElementById('pf-qty').value = '0';
  document.getElementById('pf-min').value = '1';

  if (partId) {
    const p = PARTS_DEFS.find(x => x.id === partId);
    if (!p) return;
    editingPartDefId = p._fbId || null;
    document.getElementById('part-form-title').textContent = 'Edit Part';
    document.getElementById('pf-name').value    = p.name || '';
    document.getElementById('pf-sys').value     = p.sys || '';
    document.getElementById('pf-itemno').value  = p.itemNo || '';
    document.getElementById('pf-price').value   = p.unitPrice != null ? p.unitPrice : '';
    document.getElementById('pf-notes').value   = p.notes || '';
    // Pull current qty/min from inventory
    const inv = partsInventory[p.id] || { qty: 0, min: 1 };
    document.getElementById('pf-qty').value = inv.qty;
    document.getElementById('pf-min').value = inv.min;
    // Only show delete for custom (user-added) parts
    if (p._custom) document.getElementById('pf-delete-row').style.display = '';
  }

  document.getElementById('part-form-modal').classList.add('open');
}

function closePartForm() {
  document.getElementById('part-form-modal').classList.remove('open');
  editingPartDefId = null;
}

async function savePart() {
  const name    = document.getElementById('pf-name').value.trim();
  const sys     = document.getElementById('pf-sys').value;
  const itemNo  = document.getElementById('pf-itemno').value.trim();
  const price   = parseFloat(document.getElementById('pf-price').value) || 0;
  const qty     = parseInt(document.getElementById('pf-qty').value)   || 0;
  const min     = parseInt(document.getElementById('pf-min').value)    || 1;
  const notes   = document.getElementById('pf-notes').value.trim();

  if (!name) return alert('Part name is required.');
  if (!sys)  return alert('Please select a system.');

  const btn = document.getElementById('pf-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    setSyncDot('saving');
    if (editingPartDefId) {
      // Editing an existing custom part
      const existing = PARTS_DEFS.find(p => p._fbId === editingPartDefId);
      await db.collection('partsDefs').doc(editingPartDefId).update({
        name, sys, itemNo, unitPrice: price, notes, updatedTs: Date.now()
      });
      // Update inventory separately
      if (existing) {
        await db.collection('partsInventory').doc(existing.id).set(
          { qty, min, ts: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        partsInventory[existing.id] = { qty, min };
      }
      await db.collection('activityLog').add({
        type: 'parts', id: editingPartDefId,
        desc: `Part updated: ${name}`,
        tech: 'Manual',
        date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
        ts: Date.now()
      });
    } else {
      // New part
      const id = 'p-custom-' + Date.now().toString(36);
      const record = { id, name, sys, itemNo, unitPrice: price, notes, createdTs: Date.now() };
      const ref = await db.collection('partsDefs').add(record);
      // Set initial inventory
      await db.collection('partsInventory').doc(id).set(
        { qty, min, ts: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      partsInventory[id] = { qty, min };
      await db.collection('activityLog').add({
        type: 'parts', id,
        desc: `Part added: ${name} (${sys})`,
        tech: 'Manual',
        date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
        ts: Date.now()
      });
    }
    setSyncDot('live');
    closePartForm();
    // Listener will update PARTS_DEFS and re-render automatically
  } catch(e) {
    setSyncDot('live');
    console.error('savePart:', e);
    alert('Error saving part: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '✓ SAVE PART';
  }
}

async function deletePart() {
  if (!editingPartDefId) return;
  const p = PARTS_DEFS.find(x => x._fbId === editingPartDefId);
  if (!p) return;
  if (!confirm(`Delete "${p.name}"? This removes it from the parts list. Inventory history is kept.`)) return;
  try {
    setSyncDot('saving');
    await db.collection('partsDefs').doc(editingPartDefId).delete();
    await db.collection('activityLog').add({
      type: 'parts', id: editingPartDefId,
      desc: `Part deleted: ${p.name}`,
      tech: 'Manual',
      date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      ts: Date.now()
    });
    setSyncDot('live');
    closePartForm();
  } catch(e) {
    setSyncDot('live');
    alert('Error deleting part: ' + e.message);
  }
}

// ═══════════════════════════════════════════
// WO CLOSEOUT
// ═══════════════════════════════════════════
let closeoutPartsSelected = {}; // {partId: qty}

function openCloseout(wo) {
  document.getElementById('closeout-wo-info').textContent = `${wo.id} · ${wo.farm} · ${wo.house} · ${wo.problem}`;
  closeoutPartsSelected = {};

  // Tech dropdown — show farm crew
  const techSel = document.getElementById('closeout-tech');
  techSel.innerHTML = '<option value="">— Who completed this? —</option>';
  (SITE_TECHS[wo.farm]||[]).forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    if (t === wo.tech) o.selected = true;
    techSel.appendChild(o);
  });

  document.getElementById('closeout-notes').value = '';
  pendingCloseoutPhotos = [];
  document.getElementById('closeout-photo-preview').innerHTML = '';
  document.getElementById('closeout-photo-cam').value = '';
  document.getElementById('closeout-photo-file').value = '';

  // Build parts checklist — filtered to WO problem type
  const relevantParts = getPartsForProblem(wo.problem);
  const partsList = document.getElementById('closeout-parts-list');

  if (!relevantParts.length) {
    partsList.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px;">No parts linked to this problem type.</div>';
  } else {
    // Group by system
    const systems = [...new Set(relevantParts.map(p=>p.sys))];
    partsList.innerHTML = systems.map(sys => {
      const sysparts = relevantParts.filter(p=>p.sys===sys);
      return `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:6px 4px 3px;">${SYS_ICON[sys]||'🔩'} ${sys}</div>` +
        sysparts.map(p => {
          const inv = partsInventory[p.id]||{qty:0};
          const rhNum = p.rhNum || p.itemNo;
          return `<div style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px solid #f0f0f0;">
            <input type="checkbox" id="cp-${p.id}" onchange="toggleCloseoutPart('${p.id}')" style="width:16px;height:16px;">
            <label for="cp-${p.id}" style="flex:1;font-size:12px;cursor:pointer;">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);margin-right:4px;">${rhNum}</span>${p.name}
              <span style="font-size:10px;color:${inv.qty<=0?'#e53e3e':'#999'};margin-left:4px;">(${inv.qty} in stock)</span>
            </label>
            <input type="number" id="cpq-${p.id}" min="1" value="1" style="width:48px;padding:3px;border:1px solid #ddd;border-radius:4px;font-size:12px;display:none;">
          </div>`;
        }).join('');
    }).join('');
  }

  document.getElementById('wo-closeout').classList.add('open');
}

function toggleCloseoutPart(partId) {
  const cb = document.getElementById(`cp-${partId}`);
  const qtyEl = document.getElementById(`cpq-${partId}`);
  if (cb.checked) {
    qtyEl.style.display = 'block';
    closeoutPartsSelected[partId] = 1;
  } else {
    qtyEl.style.display = 'none';
    delete closeoutPartsSelected[partId];
  }
}

function closeCloseout() {
  document.getElementById('wo-closeout').classList.remove('open');
  pendingCycleFbId = null;
  closeoutPartsSelected = {};
  pendingCloseoutPhotos = [];
  document.getElementById('closeout-photo-preview').innerHTML = '';
}

async function confirmCloseout() {
  if (!pendingCycleFbId) return;
  const wo = workOrders.find(w=>w._fbId===pendingCycleFbId);
  if (!wo) return;

  const tech = document.getElementById('closeout-tech').value;
  const notes = document.getElementById('closeout-notes').value.trim();

  if (!tech) return alert('Please select who completed this work order.');

  // Collect parts used
  const partsUsed = [];
  for (const partId of Object.keys(closeoutPartsSelected)) {
    const qty = parseInt(document.getElementById(`cpq-${partId}`)?.value)||1;
    const part = PARTS_DEFS.find(p=>p.id===partId);
    if (part) partsUsed.push({partId, name:part.name, qty, itemNo:part.itemNo, rhNum:part.rhNum||part.itemNo});
  }

  // If parts were selected — show confirmation before deducting
  if (partsUsed.length > 0) {
    const confirmMsg = partsUsed.map(p => `• ${p.rhNum} ${p.name} — qty: ${p.qty}`).join('\n');
    const inv_warnings = partsUsed.filter(p => {
      const inv = partsInventory[p.partId]||{qty:0};
      return p.qty > inv.qty;
    });
    let msg = `Deduct the following from inventory?\n\n${confirmMsg}`;
    if (inv_warnings.length) {
      msg += `\n\n⚠️ WARNING: Some quantities exceed current stock:\n` +
        inv_warnings.map(p => `• ${p.name} (stock: ${(partsInventory[p.partId]||{qty:0}).qty}, using: ${p.qty})`).join('\n');
    }
    if (!confirm(msg)) return;
  }

  const savedFbId = wo._fbId;
  const completedDate = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const completionPhotos = pendingCloseoutPhotos.filter(Boolean);

  closeCloseout();

  // Optimistic local update — shows completed immediately without waiting for onSnapshot
  wo.status = 'completed';
  wo.completedBy = tech;
  wo.completedNotes = notes;
  wo.completedDate = completedDate;
  if (completionPhotos.length) wo.completionPhotos = completionPhotos;
  renderWO();

  setSyncDot('saving');
  try {
    await db.collection('workOrders').doc(savedFbId).update({
      status: 'completed',
      completedBy: tech,
      completedNotes: notes,
      completedDate,
      ...(completionPhotos.length ? {completionPhotos} : {}),
      partsUsed,
      completedTs: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Decrement parts inventory
    for (const {partId, qty} of partsUsed) {
      const inv = partsInventory[partId]||{qty:0,min:1};
      const newQty = Math.max(0, inv.qty - qty);
      partsInventory[partId] = {...inv, qty: newQty};
      await db.collection('partsInventory').doc(partId).set({...partsInventory[partId], ts: firebase.firestore.FieldValue.serverTimestamp()});
    }

    // Log activity
    await db.collection('activityLog').add({
      type:'wo', id:wo.id,
      desc:`WO Completed: ${wo.farm} · ${wo.house} · ${wo.problem}`,
      tech, notes, partsUsed,
      date: completedDate,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });

    setSyncDot('live');
    updatePartsAlerts();
  } catch(e) {
    console.error('WO complete failed:', e);
    alert('Error completing work order: ' + e.message);
    // Roll back optimistic update
    wo.status = 'in-progress';
    wo.completedBy = '';
    renderWO();
    setSyncDot('live');
  }
}

// ═══════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════
let reportDays = 7;
let _rptSection = 'maint';

function goRptSection(sec) {
  _rptSection = sec;
  ['maint','prod','pkg','ship','feed'].forEach(s => {
    const el  = document.getElementById('rpt-sec-' + s);
    const btn = document.getElementById('rpt-tab-' + s);
    if (el)  el.style.display = s === sec ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', s === sec);
  });
  if (sec === 'maint') renderReports();
  else if (sec === 'prod')  renderRptProd();
  else if (sec === 'pkg')   renderRptPkg();
  else if (sec === 'ship')  renderRptShip();
  else if (sec === 'feed')  renderRptFeed();
}

function reportRange(days, btn) {
  reportDays = days;
  document.querySelectorAll('#panel-reports .pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (_rptSection === 'maint') renderReports();
}

// ═══════════════════════════════════════════
// REPORTS — PRODUCTION
// ═══════════════════════════════════════════
async function renderRptProd() {
  const el = document.getElementById('rpt-sec-prod');
  if (!el) return;
  el.innerHTML = '<div style="color:#aaa;font-size:12px;font-family:\'IBM Plex Mono\',monospace;padding:8px 0;">Loading…</div>';
  const cutoff = new Date(Date.now() - reportDays * 86400000);
  try {
    const [walksSnap, eggSnap] = await Promise.all([
      db.collection('barnWalks').where('ts','>=',cutoff).get(),
      db.collection('opsEggProduction').where('date','>=',cutoff.toISOString().slice(0,10)).get(),
    ]);
    const walks = walksSnap.docs.map(d=>d.data());
    const eggs  = eggSnap.docs.map(d=>d.data());
    const totalEggs = eggs.reduce((s,r)=>s+(Number(r.eggs)||0),0);
    const flagged   = walks.filter(w=>w.flags&&w.flags.length>0).length;
    const farms = ['Hegins','Danville'];
    const farmRows = farms.map(farm => {
      const fw = walks.filter(w=>w.farm===farm).length;
      const fe = eggs.filter(e=>e.farm===farm).reduce((s,r)=>s+(Number(r.eggs)||0),0);
      return `<tr style="border-bottom:1px solid #1a2a1a;">
        <td style="padding:8px 6px;color:#f0ead8;font-weight:700;">📍 ${farm}</td>
        <td style="padding:8px 6px;color:#7ab07a;text-align:center;">${fw}</td>
        <td style="padding:8px 6px;color:#d69e2e;text-align:center;">${fmtNum(fe)}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
        <div style="background:#0f2a0f;border:1px solid #2a5a2a;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#4caf50;font-family:'IBM Plex Mono',monospace;">${walks.length}</div>
          <div style="font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Barn Walks</div>
        </div>
        <div style="background:#1a1400;border:1px solid #4a3000;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#d69e2e;font-family:'IBM Plex Mono',monospace;">${fmtNum(totalEggs)}</div>
          <div style="font-size:9px;color:#7a6020;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Total Eggs</div>
        </div>
        <div style="background:${flagged>0?'#2a0a0a':'#0f2a0f'};border:1px solid ${flagged>0?'#5a1a1a':'#2a5a2a'};border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:${flagged>0?'#e53e3e':'#4caf50'};font-family:'IBM Plex Mono',monospace;">${flagged}</div>
          <div style="font-size:9px;color:#5a5a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Flagged Walks</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:12px;">
        <thead><tr style="border-bottom:1px solid #2a4a2a;">
          <th style="padding:8px 6px;color:#5a8a5a;text-align:left;">Farm</th>
          <th style="padding:8px 6px;color:#5a8a5a;text-align:center;">Walks</th>
          <th style="padding:8px 6px;color:#5a8a5a;text-align:center;">Eggs</th>
        </tr></thead>
        <tbody>${farmRows}</tbody>
      </table>`;
  } catch(e) { el.innerHTML = '<div style="color:#e53e3e;padding:16px;">Error: '+e.message+'</div>'; }
}

// ═══════════════════════════════════════════
// REPORTS — PACKAGING
// ═══════════════════════════════════════════
async function renderRptPkg() {
  const el = document.getElementById('rpt-sec-pkg');
  if (!el) return;
  el.innerHTML = '<div style="color:#aaa;font-size:12px;font-family:\'IBM Plex Mono\',monospace;padding:8px 0;">Loading…</div>';
  const cutoff = new Date(Date.now() - reportDays * 86400000);
  try {
    const [packSnap, dtSnap, wasteSnap] = await Promise.all([
      db.collection('opsPacking').where('ts','>=',cutoff).get().catch(()=>({docs:[]})),
      db.collection('pkgDowntime').where('ts','>=',cutoff).get().catch(()=>({docs:[]})),
      db.collection('pkgWaste').where('ts','>=',cutoff).get().catch(()=>({docs:[]})),
    ]);
    const packs  = packSnap.docs.map(d=>d.data());
    const dts    = dtSnap.docs.map(d=>d.data());
    const wastes = wasteSnap.docs.map(d=>d.data());
    const totalCases   = packs.reduce((s,r)=>s+(Number(r.cases)||Number(r.totalCases)||0),0);
    const totalDtMin   = dts.reduce((s,r)=>s+(Number(r.duration)||Number(r.durationMin)||0),0);
    const totalWaste   = wastes.reduce((s,r)=>s+(Number(r.qty)||Number(r.count)||0),0);
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
        <div style="background:#1a1a0a;border:1px solid #4a4a00;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#d69e2e;font-family:'IBM Plex Mono',monospace;">${fmtNum(totalCases)}</div>
          <div style="font-size:9px;color:#7a7020;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Cases Packed</div>
        </div>
        <div style="background:${totalDtMin>120?'#2a0a0a':'#0f1a0f'};border:1px solid ${totalDtMin>120?'#5a1a1a':'#2a4a2a'};border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:${totalDtMin>120?'#e53e3e':'#4caf50'};font-family:'IBM Plex Mono',monospace;">${totalDtMin>=60?(totalDtMin/60).toFixed(1)+'h':totalDtMin+'m'}</div>
          <div style="font-size:9px;color:#5a5a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Downtime</div>
        </div>
        <div style="background:#1a0a0a;border:1px solid #4a2a2a;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#f87171;font-family:'IBM Plex Mono',monospace;">${totalWaste}</div>
          <div style="font-size:9px;color:#7a4040;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Waste Events</div>
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a8a5a;margin-bottom:8px;">${packs.length} packing sessions · ${dts.length} downtime events · ${wastes.length} waste entries in last ${reportDays} days</div>`;
  } catch(e) { el.innerHTML = '<div style="color:#e53e3e;padding:16px;">Error: '+e.message+'</div>'; }
}

// ═══════════════════════════════════════════
// REPORTS — SHIPPING
// ═══════════════════════════════════════════
async function renderRptShip() {
  const el = document.getElementById('rpt-sec-ship');
  if (!el) return;
  el.innerHTML = '<div style="color:#aaa;font-size:12px;font-family:\'IBM Plex Mono\',monospace;padding:8px 0;">Loading…</div>';
  const cutoff = new Date(Date.now() - reportDays * 86400000);
  try {
    const snap = await db.collection('opsShipping').where('ts','>=',cutoff).get().catch(()=>({docs:[]}));
    const loads = snap.docs.map(d=>d.data());
    const completed = loads.filter(l=>l.status==='completed'||l.status==='delivered').length;
    const pending   = loads.filter(l=>l.status==='pending'||l.status==='in-transit').length;
    const totalCases = loads.reduce((s,l)=>s+(Number(l.cases)||Number(l.totalCases)||0),0);
    const rows = loads.slice(0,15).map(l => {
      const ts = l.ts?.toMillis?l.ts.toMillis():(typeof l.ts==='number'?l.ts:null);
      const date = ts ? new Date(ts).toLocaleDateString() : (l.date||'—');
      const statusColor = l.status==='completed'||l.status==='delivered'?'#4caf50':l.status==='pending'?'#d69e2e':'#aaa';
      return `<tr style="border-bottom:1px solid #1a1a2a;">
        <td style="padding:8px 6px;color:#f0ead8;">${date}</td>
        <td style="padding:8px 6px;color:#9b59b6;">${l.driver||l.carrier||'—'}</td>
        <td style="padding:8px 6px;color:#aaa;">${l.destination||l.farm||'—'}</td>
        <td style="padding:8px 6px;color:#d69e2e;">${l.cases||'—'}</td>
        <td style="padding:8px 6px;color:${statusColor};font-weight:700;">${(l.status||'—').toUpperCase()}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
        <div style="background:#0a0a1a;border:1px solid #2a2a5a;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#9b59b6;font-family:'IBM Plex Mono',monospace;">${loads.length}</div>
          <div style="font-size:9px;color:#5a5a8a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Total Loads</div>
        </div>
        <div style="background:#0f2a0f;border:1px solid #2a5a2a;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#4caf50;font-family:'IBM Plex Mono',monospace;">${completed}</div>
          <div style="font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Delivered</div>
        </div>
        <div style="background:#1a1400;border:1px solid #4a3000;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#d69e2e;font-family:'IBM Plex Mono',monospace;">${fmtNum(totalCases)}</div>
          <div style="font-size:9px;color:#7a6020;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Cases Shipped</div>
        </div>
      </div>
      ${rows ? `<table style="width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:12px;">
        <thead><tr style="border-bottom:1px solid #2a2a4a;">
          <th style="padding:8px 6px;color:#7a7aaa;text-align:left;">Date</th>
          <th style="padding:8px 6px;color:#7a7aaa;text-align:left;">Driver</th>
          <th style="padding:8px 6px;color:#7a7aaa;text-align:left;">Destination</th>
          <th style="padding:8px 6px;color:#7a7aaa;text-align:left;">Cases</th>
          <th style="padding:8px 6px;color:#7a7aaa;text-align:left;">Status</th>
        </tr></thead><tbody>${rows}</tbody></table>` :
        '<div style="text-align:center;padding:20px;color:#888;font-family:\'IBM Plex Mono\',monospace;">No shipments in this period.</div>'}`;
  } catch(e) { el.innerHTML = '<div style="color:#e53e3e;padding:16px;">Error: '+e.message+'</div>'; }
}

// ═══════════════════════════════════════════
// REPORTS — FEED MILL
// ═══════════════════════════════════════════
async function renderRptFeed() {
  const el = document.getElementById('rpt-sec-feed');
  if (!el) return;
  el.innerHTML = '<div style="color:#aaa;font-size:12px;font-family:\'IBM Plex Mono\',monospace;padding:8px 0;">Loading…</div>';
  const cutoff = new Date(Date.now() - reportDays * 86400000);
  const cutoffStr = cutoff.toISOString().slice(0,10);
  try {
    const [delivSnap, madeSnap, medSnap] = await Promise.all([
      db.collection('feedDeliveries').where('date','>=',cutoffStr).get().catch(()=>({docs:[]})),
      db.collection('feedMade').where('date','>=',cutoffStr).get().catch(()=>({docs:[]})),
      db.collection('feedMedications').where('date','>=',cutoffStr).get().catch(()=>({docs:[]})),
    ]);
    const deliveries = delivSnap.docs.map(d=>d.data());
    const made       = madeSnap.docs.map(d=>d.data());
    const meds       = medSnap.docs.map(d=>d.data());
    const totalDelivTons = deliveries.reduce((s,r)=>s+(Number(r.tons)||Number(r.amount)||0),0);
    const totalMadeTons  = made.reduce((s,r)=>s+(Number(r.tons)||Number(r.amount)||0),0);
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
        <div style="background:#1a1205;border:1px solid #4a3a00;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#e67e22;font-family:'IBM Plex Mono',monospace;">${deliveries.length}</div>
          <div style="font-size:9px;color:#7a5a20;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Deliveries</div>
        </div>
        <div style="background:#0f1a0f;border:1px solid #2a4a2a;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#4caf50;font-family:'IBM Plex Mono',monospace;">${totalMadeTons.toFixed(1)}t</div>
          <div style="font-size:9px;color:#5a8a5a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Feed Made</div>
        </div>
        <div style="background:#0a1020;border:1px solid #1a2a50;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#3b82f6;font-family:'IBM Plex Mono',monospace;">${meds.length}</div>
          <div style="font-size:9px;color:#4a6a9a;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Medication Events</div>
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a8a5a;">${totalDelivTons.toFixed(1)}t delivered · ${made.length} production runs · ${meds.length} medication entries in last ${reportDays} days</div>`;
  } catch(e) { el.innerHTML = '<div style="color:#e53e3e;padding:16px;">Error: '+e.message+'</div>'; }
}

// ═══════════════════════════════════════════
// STAFF SUB-TABS
// ═══════════════════════════════════════════
function goStaffSection(sec) {
  ['dir','add','sched','certs','onboard'].forEach(s => {
    const el  = document.getElementById('staff-sec-' + s);
    const btn = document.getElementById('staff-tab-' + s);
    if (el)  el.style.display = s === sec ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', s === sec);
  });
  if (sec === 'sched') renderStaffSched();
  if (sec === 'add' && typeof checkStaffDbStatus === 'function') checkStaffDbStatus();
  if (sec === 'onboard' && typeof renderStaffOnboard === 'function') renderStaffOnboard();
}

async function renderReports() {
  const now = Date.now();
  const cutoff = now - (reportDays * 24 * 60 * 60 * 1000);
  const cutoffStr = new Date(cutoff).toISOString().slice(0,10);

  const recentWOs = workOrders.filter(w => {
    const ts = w.ts?.toMillis ? w.ts.toMillis() : (w.ts||0);
    return ts >= cutoff;
  });
  const completedWOs = recentWOs.filter(w=>w.status==='completed');
  const openWOs = workOrders.filter(w=>w.status==='open'||w.status==='in-progress');

  // ── PM compliance — honest date-range logic ──
  // "Due in range" = tasks that had at least one cycle fall due inside [cutoff, now].
  // "Done in range" = tasks that have at least one pmHistory record with date >= cutoffStr.
  // We use pmHistory from Firestore; fall back to pmComps if the query fails (no index yet).
  let pmDueInRange = 0;
  let pmDoneInRange = 0;

  let rangeHistory = [];
  try {
    const hSnap = await db.collection('pmHistory')
      .where('date', '>=', cutoffStr)
      .get();
    hSnap.forEach(d => rangeHistory.push(d.data()));
  } catch(e) {
    // Fallback: use latest completion per task — works without a composite index
    rangeHistory = Object.entries(pmComps)
      .filter(([, c]) => c.date >= cutoffStr)
      .map(([id, c]) => ({ pmId: id, ...c }));
  }

  // Unique task IDs completed within the range
  // pmHistory records store the task ID in the `pmId` field
  const doneTaskIds = new Set(rangeHistory.map(h => h.pmId).filter(Boolean));

  // Count tasks due in range and tasks done in range
  ALL_PM.forEach(t => {
    const comp   = pmComps[t.id];
    const freqDays = FREQ[t.freq]?.days || 30;
    let nextDueTs;
    if (!comp) {
      nextDueTs = 0; // never done → perpetually overdue → counts as due in any range
    } else {
      nextDueTs = new Date(comp.date).getTime() + freqDays * 86400000;
    }
    // Task is "due in range" if its due date falls within [cutoff, now]
    // or if it is already overdue (nextDueTs < cutoff) and was never completed
    const dueInRange = (nextDueTs <= now) && (nextDueTs >= (cutoff - freqDays * 86400000));
    if (dueInRange) {
      pmDueInRange++;
      if (doneTaskIds.has(t.id)) pmDoneInRange++;
    }
  });

  // Safety cap — done can never exceed due
  pmDoneInRange = Math.min(pmDoneInRange, pmDueInRange);

  const pmCompliance = pmDueInRange > 0 ? Math.round((pmDoneInRange / pmDueInRange) * 100) : 100;
  const pmComplianceLabel = `${reportDays}-Day PM Compliance`;

  // Today stat shown separately — not mixed into the period calculation
  const todayDone  = ALL_PM.filter(t => doneToday(t.id)).length;
  const todayTotal = ALL_PM.length;
  const todayCompliance = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  // Parts used from completed WOs in range
  const partsUsedMap = {};
  completedWOs.forEach(wo => {
    (wo.partsUsed||[]).forEach(p => {
      if (!partsUsedMap[p.name]) partsUsedMap[p.name] = 0;
      partsUsedMap[p.name] += p.qty;
    });
  });

  // WOs by tech
  const byTech = {};
  completedWOs.forEach(wo => {
    const t = wo.completedBy || wo.tech || 'Unknown';
    if (!byTech[t]) byTech[t] = 0;
    byTech[t]++;
  });

  // WOs by farm
  const hWOs = completedWOs.filter(w=>w.farm==='Hegins').length;
  const dWOs = completedWOs.filter(w=>w.farm==='Danville').length;

  // Downtime in range
  const dtInRange = downtimeEvents.filter(e => e.startTs >= cutoff);
  const dtMins = dtInRange.filter(e=>e.durationMins).reduce((s,e)=>s+e.durationMins,0);
  const dtHrs = (dtMins/60).toFixed(1);

  // WOs by problem category
  const byProblem = {};
  recentWOs.forEach(wo => {
    const cat = (wo.problem||'Other').split(' — ')[0].split(' — ')[0].split(' ')[0];
    if (!byProblem[cat]) byProblem[cat] = 0;
    byProblem[cat]++;
  });

  let html = `
  <div class="stats-grid g4" style="margin-bottom:20px;">
    <div class="stat-card"><div class="stat-num">${recentWOs.length}</div><div class="stat-label">WOs Submitted</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--green-mid)">${completedWOs.length}</div><div class="stat-label">WOs Completed</div></div>
    <div class="stat-card"><div class="stat-num" style="color:${openWOs.length>5?'#e53e3e':'var(--ink)'}">${openWOs.length}</div><div class="stat-label">Still Open</div></div>
    <div class="stat-card" title="Tasks completed ÷ tasks due within this date range">
      <div class="stat-num" style="color:${pmCompliance<70?'#e53e3e':pmCompliance<90?'var(--amber)':'var(--green-mid)'}">${pmCompliance}%</div>
      <div class="stat-label">${pmComplianceLabel}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px;">${pmDoneInRange} done / ${pmDueInRange} due · Today: ${todayCompliance}%</div>
    </div>
  </div>`;

  // Downtime summary
  html += `<div class="recent-hdr">⏱️ Downtime Summary</div>
  <div class="stats-grid g3" style="margin-bottom:20px;">
    <div class="stat-card"><div class="stat-num">${dtInRange.length}</div><div class="stat-label">Events</div></div>
    <div class="stat-card"><div class="stat-num">${dtHrs}h</div><div class="stat-label">Total Hours Down</div></div>
    <div class="stat-card"><div class="stat-num">${dtInRange.filter(e=>e.ongoing).length}</div><div class="stat-label">Still Active</div></div>
  </div>`;

  // PM compliance by farm
  const pmFarms = ['Hegins','Danville'];
  const pmByFarm = {};
  pmFarms.forEach(farm => {
    const farmPMs = ALL_PM.filter(t => !t.farms || t.farms.includes(farm));
    let due = 0, done = 0;
    farmPMs.forEach(t => {
      const comp = pmComps[t.id];
      const freqDays = FREQ[t.freq]?.days || 30;
      const nextDueTs = comp ? new Date(comp.date).getTime() + freqDays * 86400000 : 0;
      const dueInRange = (nextDueTs <= now) && (nextDueTs >= (cutoff - freqDays * 86400000));
      if (dueInRange) { due++; if (doneTaskIds.has(t.id)) done++; }
    });
    pmByFarm[farm] = { due, done, pct: due > 0 ? Math.round(done/due*100) : 100 };
  });

  // Parts cost from completed WOs
  const partsCostMap = {};
  completedWOs.forEach(wo => {
    (wo.partsUsed||[]).forEach(p => {
      if (!partsCostMap[p.name]) partsCostMap[p.name] = { qty: 0, cost: 0 };
      partsCostMap[p.name].qty += p.qty;
      const def = (typeof PARTS_DEFS !== 'undefined' ? PARTS_DEFS : []).find(d => d.name === p.name || d.id === p.id);
      partsCostMap[p.name].cost += (p.qty) * (def?.unitPrice || 0);
    });
  });
  const totalPartsCost = Object.values(partsCostMap).reduce((s,v)=>s+v.cost,0);

  // By farm
  html += `<div class="recent-hdr">📍 WOs Completed by Farm</div>
  <div class="stats-grid g2" style="margin-bottom:20px;">
    <div class="stat-card"><div class="stat-num">${hWOs}</div><div class="stat-label">Hegins</div></div>
    <div class="stat-card"><div class="stat-num">${dWOs}</div><div class="stat-label">Danville</div></div>
  </div>`;

  // PM compliance by farm
  html += `<div class="recent-hdr">✅ PM Compliance by Farm</div>
  <div class="stats-grid g2" style="margin-bottom:20px;">
    ${pmFarms.map(farm => {
      const d = pmByFarm[farm];
      return `<div class="stat-card" title="${d.done} done / ${d.due} due">
        <div class="stat-num" style="color:${d.pct<70?'#e53e3e':d.pct<90?'var(--amber)':'var(--green-mid)'}">${d.pct}%</div>
        <div class="stat-label">${farm}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">${d.done}/${d.due} tasks</div>
      </div>`;
    }).join('')}
  </div>`;

  // By tech
  html += `<div class="recent-hdr">👤 WOs Completed by Tech</div><div class="card-list" style="margin-bottom:20px;">`;
  const techEntries = Object.entries(byTech).sort((a,b)=>b[1]-a[1]);
  if (techEntries.length) {
    techEntries.forEach(([name,count]) => {
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:white;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.07);">
        <span style="font-weight:600;">${name}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:var(--green-mid);">${count} WO${count!==1?'s':''}</span>
      </div>`;
    });
  } else html += '<div class="empty"><div class="ei">📋</div><p>No completed WOs in this period</p></div>';
  html += '</div>';

  // By problem category
  const probEntries = Object.entries(byProblem).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if (probEntries.length) {
    html += `<div class="recent-hdr">🔧 WOs by Problem Category</div><div class="card-list" style="margin-bottom:20px;">`;
    const maxCount = probEntries[0][1];
    probEntries.forEach(([cat, count]) => {
      const pct = Math.round(count/maxCount*100);
      html += `<div style="padding:10px 14px;background:white;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:4px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-weight:600;font-size:13px;">${cat}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;">${count}</span>
        </div>
        <div style="background:#eee;border-radius:4px;height:6px;"><div style="background:var(--green-mid);height:6px;width:${pct}%;border-radius:4px;"></div></div>
      </div>`;
    });
    html += '</div>';
  }

  // Parts used with cost
  const partsEntries = Object.entries(partsCostMap).sort((a,b)=>b[1].qty-a[1].qty);
  html += `<div class="recent-hdr">🔩 Parts Used${totalPartsCost>0?' — Est. Cost: $'+totalPartsCost.toFixed(2):''}</div>
  <div class="card-list" style="margin-bottom:20px;">`;
  if (partsEntries.length) {
    partsEntries.forEach(([name, {qty, cost}]) => {
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:white;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.07);">
        <span style="font-size:13px;">${name}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;">×${qty}${cost>0?'<span style="color:#888;font-weight:400;margin-left:6px;">$'+cost.toFixed(2)+'</span>':''}</span>
      </div>`;
    });
  } else html += '<div class="empty"><div class="ei">🔩</div><p>No parts logged in this period</p></div>';
  html += '</div>';

  // Export / print button
  html += `<div style="margin-top:8px;padding-top:16px;border-top:1px solid #e5e5e5;display:flex;gap:10px;">
    <button onclick="printReport()" style="flex:1;padding:11px;background:#1a3a1a;border:2px solid #4caf50;border-radius:10px;color:#4caf50;font-size:13px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">🖨️ Print / Save PDF</button>
    <button onclick="copyReportText()" style="flex:1;padding:11px;background:#1a2a3a;border:2px solid #3b82f6;border-radius:10px;color:#3b82f6;font-size:13px;font-weight:700;cursor:pointer;font-family:'IBM Plex Mono',monospace;">📋 Copy Summary</button>
  </div>`;

  document.getElementById('reports-container').innerHTML = html;

  // Store report data for copy/export
  window._lastReportData = { reportDays, recentWOs, completedWOs, openWOs, pmCompliance, pmDoneInRange, pmDueInRange, dtHrs, dtInRange, byTech, hWOs, dWOs, totalPartsCost, pmByFarm };
}

function printReport() {
  window.print();
}

function copyReportText() {
  const d = window._lastReportData;
  if (!d) return;
  const byTechLines = Object.entries(d.byTech||{}).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`  ${n}: ${c} WO${c!==1?'s':''}`).join('\n');
  const text = `RUSHTOWN MAINTENANCE REPORT — Last ${d.reportDays} Days
Generated: ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
─────────────────────────────
WOs Submitted:  ${d.recentWOs.length}
WOs Completed:  ${d.completedWOs.length}
Still Open:     ${d.openWOs.length}
PM Compliance:  ${d.pmCompliance}% (${d.pmDoneInRange} done / ${d.pmDueInRange} due)
Downtime:       ${d.dtHrs}h across ${d.dtInRange.length} events
─────────────────────────────
By Farm:
  Hegins:   ${d.hWOs} completed
  Danville: ${d.dWOs} completed
By Tech:
${byTechLines||'  (none)'}`;
  navigator.clipboard.writeText(text).then(()=>{
    const btn = document.querySelector('#reports-container button:last-child');
    if (btn) { const orig=btn.textContent; btn.textContent='✓ Copied!'; setTimeout(()=>btn.textContent=orig, 2000); }
  }).catch(()=> alert(text));
}

// Classify a raw log entry type — normalises legacy and new types
function logClassify(e) {
  const t = (e.type || '').toLowerCase();
  const desc = (e.desc || '').toLowerCase();
  if (t === 'pm' || t === 'pm_bulk') return 'pm';
  if (t === 'wi') return 'wi';
  if (t === 'po') return 'po';
  if (t === '5s') return '5s';
  // Downtime logged under type 'wo' with id 'DT' — reclassify
  if (e.id === 'DT' || desc.startsWith('downtime')) return 'downtime';
  // Barn walk
  if (e.id === 'BW' || desc.startsWith('barn walk')) return 'barnwalk';
  // Parts activity
  if (t === 'parts' || desc.includes('inventory') || desc.includes('parts adjusted')) return 'parts';
  // WO
  if (t === 'wo' || desc.startsWith('wo ') || desc.startsWith('work order')) return 'wo';
  if (t === 'ops-egg') return 'ops-egg';
  if (t === 'ops-pack') return 'ops-pack';
  if (t === 'ops-ship') return 'ops-ship';
  if (t === 'ops-exc') return 'ops-exc';
  return t || 'wo';
}

const LOG_TYPE_META = {
  wo:        { icon:'🔧', label:'Work Order',        cls:'wo-log' },
  pm:        { icon:'📋', label:'PM Task',           cls:'pm-log' },
  wi:        { icon:'📖', label:'Work Instruction',  cls:'wi-log' },
  po:        { icon:'🛒', label:'Purchase Order',    cls:'po-log' },
  downtime:  { icon:'⏱️', label:'Downtime',          cls:'downtime-log' },
  barnwalk:  { icon:'🐔', label:'Barn Walk',         cls:'barnwalk-log' },
  parts:     { icon:'🔩', label:'Parts / Inventory', cls:'parts-log' },
  '5s':      { icon:'5️⃣', label:'5S Audit',         cls:'fives-log' },
  'ops-egg': { icon:'🥚', label:'Egg Production',    cls:'barnwalk-log' },
  'ops-pack':{ icon:'📦', label:'Packing',           cls:'pm-log' },
  'ops-ship':{ icon:'🚚', label:'Shipping',          cls:'po-log' },
  'ops-exc': { icon:'⚠️', label:'Exception',         cls:'downtime-log' },
};

function logFilter(v,btn) {
  logFilterVal=v;
  document.querySelectorAll('#log-filter-bar .pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderLog();
}

function renderLog() {
  let entries = actLog.map(e => ({...e, _classified: logClassify(e)}));

  if (logFilterVal !== 'all') {
    // 'parts' filter also catches 'po' loosely — keep them separate
    entries = entries.filter(e => e._classified === logFilterVal);
  }

  if (!entries.length) {
    document.getElementById('log-container').innerHTML='<div class="empty"><div class="ei">📁</div><p>No activity in this category yet.</p></div>';
    return;
  }

  document.getElementById('log-container').innerHTML = entries.map(e => {
    const meta = LOG_TYPE_META[e._classified] || LOG_TYPE_META.wo;
    const partsHtml = e.parts ? `<p style="font-size:12px;margin-top:3px;">🔩 ${e.parts}</p>` : '';
    const notesHtml = e.notes ? `<p style="font-size:12px;font-style:italic;color:var(--muted);margin-top:3px;">${e.notes}</p>` : '';
    const partsUsedHtml = (e.partsUsed && e.partsUsed.length)
      ? `<p style="font-size:12px;margin-top:3px;color:var(--green-mid)">🔩 Parts: ${e.partsUsed.map(p=>`${p.name} ×${p.qty}`).join(', ')}</p>`
      : '';
    const idBadge = e.id && e.id !== 'DT' && e.id !== 'BW'
      ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;background:#f0f0f0;border-radius:4px;padding:2px 6px;margin-right:4px;">${e.id}</span>`
      : '';
    return `<div class="log-card ${meta.cls}">
      <div class="log-body">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);">${meta.icon} ${meta.label}</span>
          ${idBadge}
        </div>
        <h4 style="font-size:13px;font-weight:600;margin:0;">${e.desc}</h4>
        ${partsHtml}${notesHtml}${partsUsedHtml}
      </div>
      <div class="log-meta">
        ${e.tech ? `<div style="font-weight:600;color:var(--ink)">👤 ${e.tech}</div>` : ''}
        <div style="color:var(--muted);font-size:11px;">${e.date||''}</div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// DOWNTIME TRACKER
// ═══════════════════════════════════════════
let downtimeEvents = [];
let dtFarmFilterVal = 'all';

// Load downtime from Firebase on boot (called in initApp)
async function loadDowntime() {
  try {
    const snap = await db.collection('downtimeEvents').orderBy('startTs','desc').get();
    downtimeEvents = [];
    snap.forEach(d => downtimeEvents.push({...d.data(), _fbId: d.id}));
    // Real-time listener
    db.collection('downtimeEvents').orderBy('startTs','desc').onSnapshot(snap => {
      downtimeEvents = [];
      snap.forEach(d => downtimeEvents.push({...d.data(), _fbId: d.id}));
      if (window._maintSection==='downtime') renderDowntime();
      if (document.getElementById('panel-reports').classList.contains('active')) renderReports();
    });
  } catch(e) { console.error('Downtime load error:', e); }
}

function dtFarmFilter(v, btn) {
  dtFarmFilterVal = v;
  document.querySelectorAll('#maint-downtime .pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDowntime();
}

function loadDtHouses() {
  // pre-fill start time to now
  const now = new Date();
  now.setSeconds(0,0);
  document.getElementById('dt-start').value = now.toISOString().slice(0,16);
}

function populateDtWOList() {
  const farm = document.getElementById('dt-farm').value;
  const sel = document.getElementById('dt-linked-wo');
  const current = sel.value;
  sel.innerHTML = '<option value="">— None —</option>';
  const openWOs = workOrders.filter(w =>
    (w.status === 'open' || w.status === 'in-progress') &&
    (!farm || w.farm === farm)
  );
  openWOs.forEach(wo => {
    const o = document.createElement('option');
    o.value = wo.id;
    o.textContent = `${wo.id} · ${wo.farm} · ${wo.house} — ${wo.problem.slice(0,30)}`;
    if (wo.id === current) o.selected = true;
    sel.appendChild(o);
  });
}

async function submitDowntime() {
  const farm = document.getElementById('dt-farm').value;
  const system = document.getElementById('dt-system').value;
  const startVal = document.getElementById('dt-start').value;
  const endVal = document.getElementById('dt-end').value;
  const desc = document.getElementById('dt-desc').value.trim();
  if (!farm || !system || !startVal || !desc) return alert('Please fill in Farm, System, Start Time and Description.');
  const startTs = new Date(startVal).getTime();
  const endTs = endVal ? new Date(endVal).getTime() : null;
  const durationMins = endTs ? Math.round((endTs - startTs) / 60000) : null;
  const linkedWO = document.getElementById('dt-linked-wo').value || null;
  const event = {
    farm, system, desc,
    startTs, endTs, durationMins,
    ongoing: !endTs,
    linkedWO,
    date: new Date(startTs).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    loggedAt: Date.now()
  };
  setSyncDot('saving');
  try {
    await db.collection('downtimeEvents').add(event);
    try {
      await db.collection('activityLog').add({
        type:'downtime', id:'DT',
        desc: `Downtime logged: ${farm} · ${system} — ${desc}`,
        tech: 'System', date: event.date, ts: Date.now()
      });
    } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
    setSyncDot('live');
    ['dt-farm','dt-system','dt-start','dt-end','dt-desc','dt-linked-wo'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    renderDowntime();
  } catch(err) {
    setSyncDot('live');
    console.error('submitDowntime error:', err);
    alert('Something went wrong saving the downtime event. Please try again.\n\nError: ' + err.message);
  }
}

function renderDowntime() {
  // Default downtime start to current date/time
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  const startEl = document.getElementById('dt-start');
  if (startEl && !startEl.value) startEl.value = nowLocal;
  const list = dtFarmFilterVal === 'all' ? downtimeEvents : downtimeEvents.filter(e => e.farm === dtFarmFilterVal);

  // Stats
  const now = Date.now();
  const cutoff30 = now - 30 * 86400000;
  const recent = list.filter(e => e.startTs >= cutoff30);
  const ongoing = list.filter(e => e.ongoing);
  const totalMins = recent.filter(e => e.durationMins).reduce((s,e) => s + e.durationMins, 0);
  const totalHrs = (totalMins / 60).toFixed(1);
  const avgMins = recent.filter(e=>e.durationMins).length
    ? Math.round(totalMins / recent.filter(e=>e.durationMins).length)
    : 0;

  // MTBF / MTTR calculation
  const completedEvents = recent.filter(e => e.durationMins && !e.ongoing).sort((a,b)=>a.startTs-b.startTs);
  let mtbfHrs = null, mttrMins = null;
  if (completedEvents.length > 1) {
    // MTBF = total operating time / number of failures
    const spanMs = completedEvents[completedEvents.length-1].startTs - completedEvents[0].startTs;
    const totalDownMs = completedEvents.reduce((s,e)=>s+(e.durationMins*60000),0);
    const operatingMs = Math.max(0, spanMs - totalDownMs);
    mtbfHrs = operatingMs > 0 ? (operatingMs / completedEvents.length / 3600000).toFixed(1) : null;
  }
  if (completedEvents.length) {
    mttrMins = Math.round(completedEvents.reduce((s,e)=>s+e.durationMins,0) / completedEvents.length);
  }

  document.getElementById('dt-stats').innerHTML =
    sc('s-red', ongoing.length, '🔴 Active Now') +
    sc('s-amber', recent.length, 'Events (30d)') +
    sc('s-blue', totalHrs + 'h', 'Total Downtime') +
    sc('', avgMins + 'm', 'Avg Duration (MTTR)') +
    (mtbfHrs !== null ? sc('s-green', mtbfHrs + 'h', 'MTBF') : '') +
    (mttrMins !== null ? sc('s-amber', mttrMins + 'm', 'MTTR') : '');

  // By system breakdown
  const sysMap = {};
  recent.filter(e=>e.durationMins).forEach(e => {
    if (!sysMap[e.system]) sysMap[e.system] = {count:0, mins:0};
    sysMap[e.system].count++;
    sysMap[e.system].mins += e.durationMins;
  });
  const sysEntries = Object.entries(sysMap).sort((a,b) => b[1].mins - a[1].mins);
  const maxMins = sysEntries.length ? sysEntries[0][1].mins : 1;

  document.getElementById('dt-by-system').innerHTML = sysEntries.length
    ? sysEntries.map(([sys, data]) => {
        const pct = Math.round((data.mins / maxMins) * 100);
        const hrs = (data.mins/60).toFixed(1);
        return `<div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
            <span style="font-weight:600;">${sys}</span>
            <span style="font-family:'IBM Plex Mono',monospace;color:var(--muted);">${data.count} event${data.count!==1?'s':''} · ${hrs}h</span>
          </div>
          <div style="background:#eee;border-radius:4px;height:8px;overflow:hidden;">
            <div style="background:var(--amber);height:100%;width:${pct}%;border-radius:4px;transition:width .5s;"></div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty"><div class="ei">✅</div><p>No downtime logged in last 30 days</p></div>';

  // Events list
  document.getElementById('dt-log-list').innerHTML = list.length
    ? list.slice(0,20).map(e => {
        const dur = e.durationMins ? `${Math.floor(e.durationMins/60)}h ${e.durationMins%60}m` : '⏳ Ongoing';
        const col = e.ongoing ? '#e53e3e' : 'var(--green-mid)';
        const linkedWOHtml = e.linkedWO
          ? `<span style="display:inline-block;margin-top:5px;background:#e8f4fd;border:1px solid #3b82f6;border-radius:5px;padding:2px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:#1a3a6b;cursor:pointer;" onclick="go('wo');woResetFilters()">🔧 ${e.linkedWO}</span>`
          : '';
        return `<div style="background:white;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.07);padding:12px 14px;margin-bottom:8px;border-left:4px solid ${col};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
            <div style="font-weight:700;font-size:13px;">${e.farm} · ${e.system}</div>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:${col};">${dur}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:3px;">${e.desc}</div>
          <div style="font-size:11px;color:#aaa;">${e.date}</div>
          ${linkedWOHtml}
        </div>`;
      }).join('')
    : '<div class="empty"><div class="ei">⏱️</div><p>No downtime events logged yet</p></div>';
}

// ═══════════════════════════════════════════
// AUTO PARTS ORDERING
// ═══════════════════════════════════════════
function updatePartsAlerts() {
  const lowParts = PARTS_DEFS.filter(p => {
    const inv = partsInventory[p.id]||{qty:0,min:1};
    return inv.qty <= inv.min;
  });
  const badge = document.getElementById('parts-alert-badge');
  if (badge) {
    if (lowParts.length > 0) { badge.textContent = lowParts.length; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  }
}

async function sendOrderEmail() {
  const lowParts = PARTS_DEFS.filter(p => {
    const inv = partsInventory[p.id]||{qty:0,min:1};
    return inv.qty <= inv.min;
  });
  if (!lowParts.length) return alert('No parts below minimum stock.');

  const poNum = await getNextPO();
  const today = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  const poItems = lowParts.map(p => {
    const inv = partsInventory[p.id]||{qty:0,min:1};
    const qtyNeeded = Math.max(1, (inv.min * 2) - inv.qty);
    return { rhNum: p.rhNum, name: p.name, itemNo: p.itemNo, qtyNeeded, unitPrice: p.unitPrice||0 };
  });
  const poTotal = poItems.reduce((s,i) => s + (i.qtyNeeded * i.unitPrice), 0);

  await db.collection('purchaseOrders').add({
    poNum, date: today, items: poItems, total: poTotal, status: 'pending', ts: Date.now()
  }).catch(e => console.error('PO save error:', e));

  const subject = encodeURIComponent('Parts Order ' + poNum + ' -- Rushtown Poultry -- ' + today);
  let body = 'Purchase Order: ' + poNum + '\nDate: ' + today + '\n';
  body += '---------------------------------------------\n\n';
  poItems.forEach(i => {
    body += i.rhNum + '  ' + i.name + '\n';
    body += '  Item #: ' + i.itemNo + '\n';
    body += '  Qty Needed: ' + i.qtyNeeded;
    if (i.unitPrice) body += '   |   Unit: $' + i.unitPrice.toFixed(2) + '   |   Ext: $' + (i.qtyNeeded * i.unitPrice).toFixed(2);
    body += '\n\n';
  });
  if (poTotal > 0) {
    body += '---------------------------------------------\n';
    body += 'ESTIMATED TOTAL: $' + poTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + '\n';
  }
  body += '\nPlease confirm availability and expected delivery date.\n\nThank you,\nRushtown Poultry Maintenance';

  window.location.href = 'mailto:JSCHMIDT@RUSHTOWN.COM?subject=' + subject + '&body=' + encodeURIComponent(body);
}

// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// BARN CHECKLIST
// ═══════════════════════════════════════════
var CL_MODE = 'production'; // 'production' or 'maintenance'

function openChecklist(mode) {
  CL_MODE = mode;
  var overlay = document.getElementById('checklist-overlay');
  overlay.style.display = 'block';
  overlay.scrollTop = 0;
  document.getElementById('cl-mode-title').textContent = mode === 'maintenance' ? 'Maintenance Checklist' : 'Production Barn Walk';
  document.getElementById('cl-mode-sub').textContent = mode === 'maintenance' ? 'Maintenance' : 'Production';
  var tabs = mode === 'maintenance' ? CL_TABS_MAINT : CL_TABS_PROD;
  CL.chk={}; CL.done={}; CL.by={}; CL.time={}; CL.flags={};
  tabs.forEach(function(t){ CL.chk[t]={}; CL.done[t]=false; CL.flags[t]={}; });
  CL.tab = tabs[0];
  document.getElementById('cl-hdate').textContent = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.getElementById('cl-ldate').textContent = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  var wg = document.getElementById('cl-wgrid'); wg.innerHTML = '';
  var step2 = document.getElementById('cl-barn-step2-lbl'); if(step2) step2.style.display='none';
  CL.w = '';
  document.getElementById('cl-btn-d').disabled = false;
  document.getElementById('cl-btn-h').disabled = false;
  clShowNav('checklist', document.querySelector('.cl-nav-btn'));
  clGoSc('cl-s-home');
}

function resetChecklist() {
  // Reset ALL screens back to square one — overlay stays OPEN
  document.querySelectorAll('#checklist-overlay .sc').forEach(function(s){ s.classList.remove('on'); });
  document.getElementById('cl-s-home').classList.add('on');
  // Clear barn walk state
  PROD_STATE = {};
  PROD_SUBMITTED = false;
  document.getElementById('prod-submitted-card').style.display = 'none';
  document.getElementById('prod-sections').innerHTML = '';
  // Deselect any selected barn button
  document.querySelectorAll('.cl-wbtn').forEach(function(b){ b.classList.remove('sel'); });
  // Reset location/barn step labels
  var step2 = document.getElementById('cl-barn-step2-lbl');
  if (step2) step2.style.display = 'none';
  var wg = document.getElementById('cl-wgrid'); if (wg) wg.innerHTML = '';
  // Re-enable location buttons
  document.getElementById('cl-btn-d').disabled = false;
  document.getElementById('cl-btn-h').disabled = false;
  // Reset CL state
  CL.loc = ''; CL.house = 0; CL.w = '';
  CL.chk = {}; CL.done = {}; CL.by = {}; CL.time = {}; CL.flags = {};
}

function exitToHome() {
  // Called from HOME button — close overlay and go to landing screen WITHOUT resetting
  document.getElementById('checklist-overlay').style.display = 'none';
  goHome();
}

function closeChecklist() {
  // Only called after successful submit — hides the overlay and goes to dashboard
  resetChecklist();
  document.getElementById('checklist-overlay').style.display = 'none';
}

function clShowNav(id, btn) {
  document.querySelectorAll('.cl-nav-btn').forEach(function(b){b.classList.remove('on')});
  if(btn) btn.classList.add('on');
  ['checklist'].forEach(function(n){
    var el = document.getElementById('cl-n-'+n); if(el) el.classList.remove('on');
  });
  var target = document.getElementById('cl-n-'+id); if(target) target.classList.add('on');
}

function clGoSc(id) {
  document.querySelectorAll('#cl-n-checklist .sc').forEach(function(s){s.classList.remove('on')});
  var el = document.getElementById(id); if(el) el.classList.add('on');
}

function clGoLoc(loc, cnt) {
  CL.loc = loc; CL.house = 0; CL.w = '';
  var tabs = CL_MODE === 'maintenance' ? CL_TABS_MAINT : CL_TABS_PROD;
  CL.chk={}; CL.done={}; CL.flags={};
  tabs.forEach(function(t){CL.chk[t]={}; CL.done[t]=false; CL.flags[t]={};});
  var step2 = document.getElementById('cl-barn-step2-lbl');
  if(step2) { step2.style.display='block'; step2.textContent='Step 2 — Select your barn ('+loc+')'; }
  var wg = document.getElementById('cl-wgrid'); wg.innerHTML = '';
  for(var i=1;i<=cnt;i++){
    var b = document.createElement('div');
    b.className = 'cl-wbtn';
    b.innerHTML = '<div style="font-size:9px;color:#7ab07a;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">Barn</div><div style="font-size:18px;font-weight:700;">'+i+'</div>';
    (function(num){
      b.onclick = function(){
        document.querySelectorAll('.cl-wbtn').forEach(function(x){x.classList.remove('sel')});
        b.classList.add('sel');
        CL.w = 'Barn '+num;
        // Production uses new barn walk; maintenance uses legacy tab system
        if (CL_MODE === 'production') { prodOpenHouse(num); }
        else { clOpenHouse(num); }
      };
    })(i);
    wg.appendChild(b);
  }
  document.getElementById('cl-hlbl').textContent = loc + ' — Select your barn';
  document.getElementById('cl-s-home').scrollIntoView({behavior:'smooth'});
}


// ─── PRODUCTION CHECKLIST — STATUS-DRIVEN BARN WALK ───────────
var PROD_SECTIONS = [
  { id:'water', label:'💧 Water Pressure', items:[
    { id:'w1', text:'Water pressure reads 10–60 PSI on the meter' },
    { id:'w2', text:'No visible leaks on lines or connections' }
  ]},
  { id:'collectors', label:'🥚 Egg Collectors', items:[
    { id:'c1', text:'Collector meters are moving / running' },
    { id:'c2', text:'No jams or belt issues visible' }
  ]},
  { id:'feed', label:'🌾 Feed', items:[
    { id:'f1', text:'Feed augers running — no stopped motors' },
    { id:'f2', text:'Birds have access to feed in pans' }
  ]},
  { id:'birds', label:'🐔 Birds', items:[
    { id:'b1', text:'No unusual bird behavior or mass issues' },
    { id:'b2', text:'Mortality collected and counted' }
  ]},
  { id:'general', label:'⚙️ Equipment', items:[
    { id:'g1', text:'All fans running — none off or noisy' },
    { id:'g2', text:'No alarms active or unusual smells' }
  ]}
];

// Item state: { itemId: { status:'pass'|'needs'|'critical', note:'', woId:'' } }
var PROD_STATE = {};
var PROD_HEADER = { house:'', tech:'', date:'', shift:'day', start:'', end:'' };
var PROD_WOS_CREATED = 0;
var PROD_SUBMITTED = false;

// Legacy fly/rodent tabs (used by weekly/friday checks)
var CL_TKS = {
  fly:{label:'Fly Test',note:'Tuesdays — walk house with fly trap',tasks:[
    'Open a fly trap and walk down an aisle to the end of the house.',
    'Walk back to the front up a different aisle, holding fly trap at waist level.',
    'Count the flies caught and record on the whiteboard in the front of the house.',
    'Hang the fly trap in the house.',
    'Discard the fly trap from the previous week.'
  ]},
  rod:{label:'Rodents',note:'Fridays — check all traps and bait',tasks:[
    'Check rodent traps on top and bottom floors on outside aisles and empty into a bucket.',
    'Count the rodents caught and record on the whiteboard in the front of the house.',
    'Check bait boxes and bait tubes on top and bottom floors on outside aisles.',
    'Add more bait if any bait boxes or bait tubes are empty.',
    'Notify barn manager if you are low on bait.',
    'Any questions, concerns, or issues — contact the barn manager.'
  ]}
};

// Maintenance-specific checklist tabs
var CL_TKS_MAINT = {
  fans:{label:'Fans',note:'Check all ventilation fans',tasks:[
    'Inspect all fans are running — note any that are off or noisy.',
    'Check fan belts for wear, cracking, or slippage.',
    'Check fan blades for buildup — clean if needed.',
    'Verify fan controllers and thermostats are set correctly.',
    'Check inlet doors and curtains for proper operation.',
    'Note any unusual vibration or noise and flag for repair.'
  ]},
  water:{label:'Water',note:'Water system check',tasks:[
    'Check water pressure at front and back of each house.',
    'Inspect nipple drinkers for drips or clogs.',
    'Check regulator and pressure gauge readings.',
    'Inspect all visible lines for leaks or damage.',
    'Check well house pump — verify it is running normally.',
    'Check water filters — replace if clogged.'
  ]},
  feed:{label:'Feed',note:'Feed system check',tasks:[
    'Verify all auger motors are running.',
    'Check feed pans — confirm birds have access to feed.',
    'Inspect chains and belts for wear or damage.',
    'Check hoppers — confirm adequate feed level.',
    'Listen for unusual motor noise or vibration.',
    'Check and tighten any loose connections or guards.'
  ]},
  elec:{label:'Electrical',note:'Electrical check',tasks:[
    'Walk all electrical panels — check for tripped breakers.',
    'Inspect all alarm systems — confirm they are active.',
    'Check generator — verify it starts and runs properly.',
    'Inspect controllers and timers for correct settings.',
    'Check lighting — replace any burned out bulbs.',
    'Note any burning smells, flickering, or other electrical issues.'
  ]}
};

var CL_TABS_PROD  = ['fly','rod'];  // weekly tabs kept for Fly/Rodent checks
var CL_TABS_MAINT = ['fans','water','feed','elec'];

// ─── CL_TKS_MAINT kept for maintenance mode ───────────────────
var CL_TKS_MAINT = {
  fans:{label:'Fans',note:'Check all ventilation fans',tasks:[
    'Inspect all fans are running — note any that are off or noisy.',
    'Check fan belts for wear, cracking, or slippage.',
    'Check fan blades for buildup — clean if needed.',
    'Verify fan controllers and thermostats are set correctly.',
    'Check inlet doors and curtains for proper operation.',
    'Note any unusual vibration or noise and flag for repair.'
  ]},
  water:{label:'Water',note:'Water system check',tasks:[
    'Check water pressure at front and back of each house.',
    'Inspect nipple drinkers for drips or clogs.',
    'Check regulator and pressure gauge readings.',
    'Inspect all visible lines for leaks or damage.',
    'Check well house pump — verify it is running normally.',
    'Check water filters — replace if clogged.'
  ]},
  feed:{label:'Feed',note:'Feed system check',tasks:[
    'Verify all auger motors are running.',
    'Check feed pans — confirm birds have access to feed.',
    'Inspect chains and belts for wear or damage.',
    'Check hoppers — confirm adequate feed level.',
    'Listen for unusual motor noise or vibration.',
    'Check and tighten any loose connections or guards.'
  ]},
  elec:{label:'Electrical',note:'Electrical check',tasks:[
    'Walk all electrical panels — check for tripped breakers.',
    'Inspect all alarm systems — confirm they are active.',
    'Check generator — verify it starts and runs properly.',
    'Inspect controllers and timers for correct settings.',
    'Check lighting — replace any burned out bulbs.',
    'Note any burning smells, flickering, or other electrical issues.'
  ]}
};

var CL = {
  w:'', loc:'', house:0, tab:'fly',
  chk:{}, done:{}, by:{}, time:{}, flags:{}
};

// ═══════════════════════════════════════════
// PRODUCTION BARN WALK — new status-driven system
// ═══════════════════════════════════════════

function prodOpenHouse(n) {
  PROD_STATE = {};
  PROD_HEADER = {
    house: String(n),
    tech: CL.w || '',
    date: new Date().toISOString().slice(0,10),
    shift: 'day',
    start: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}),
    end: ''
  };
  PROD_WOS_CREATED = 0;
  PROD_SUBMITTED = false;
  // init all items to null
  PROD_SECTIONS.forEach(function(sec){
    sec.items.forEach(function(item){
      PROD_STATE[item.id] = { status: null, note: '', woId: '' };
    });
  });
  prodRenderHeader();
  prodRenderSections();
  prodRenderSummary();
  opsBwInitForHouse();
  clGoSc('cl-s-prod');
}

function prodRenderHeader() {
  var h = PROD_HEADER;
  document.getElementById('prod-hdr-house').textContent  = CL.loc + ' — House ' + h.house;
  document.getElementById('prod-hdr-tech').textContent   = h.tech || '—';
  document.getElementById('prod-hdr-date').textContent   = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  document.getElementById('prod-hdr-shift').value        = h.shift;
  document.getElementById('prod-hdr-start').value        = h.start;
  document.getElementById('prod-hdr-end').value          = h.end;
}

function prodRenderSections() {
  var container = document.getElementById('prod-sections');
  container.innerHTML = '';

  PROD_SECTIONS.forEach(function(sec) {
    var secEl = document.createElement('div');
    secEl.className = 'prod-section';
    secEl.setAttribute('data-sec', sec.id);

    var hdr = document.createElement('div');
    hdr.className = 'prod-sec-hdr';
    hdr.innerHTML = '<span class="prod-sec-title">' + sec.label + '</span><span class="prod-sec-prog" id="prog-' + sec.id + '">0/' + sec.items.length + '</span>';
    secEl.appendChild(hdr);

    sec.items.forEach(function(item) {
      var itemEl = document.createElement('div');
      itemEl.className = 'prod-item';
      itemEl.id = 'prod-item-' + item.id;

      // Item text
      var txt = document.createElement('div');
      txt.className = 'prod-item-text';
      txt.textContent = item.text;
      itemEl.appendChild(txt);

      // Status buttons — use addEventListener, no inline onclick
      var btnRow = document.createElement('div');
      btnRow.className = 'prod-status-btns';

      var btnDefs = [
        { key:'pass',     label:'✓ Pass',       cls:'prod-sbtn-pass' },
        { key:'needs',    label:'⚠ Needs Attn', cls:'prod-sbtn-needs' },
        { key:'critical', label:'🔴 Critical',   cls:'prod-sbtn-critical' }
      ];
      btnDefs.forEach(function(def) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'prod-sbtn ' + def.cls;
        btn.textContent = def.label;
        (function(iid, skey){ btn.addEventListener('click', function(e){ e.stopPropagation(); prodSetStatus(iid, skey); }); })(item.id, def.key);
        btnRow.appendChild(btn);
      });
      itemEl.appendChild(btnRow);

      // Issue detail fields (hidden until needs/critical)
      var fields = document.createElement('div');
      fields.className = 'prod-issue-fields';
      fields.id = 'prod-fields-' + item.id;
      fields.style.display = 'none';

      var ta = document.createElement('textarea');
      ta.className = 'prod-note-input';
      ta.id = 'prod-note-' + item.id;
      ta.rows = 2;
      ta.placeholder = 'Describe the issue — what you saw, heard, or measured...';
      (function(iid){ ta.addEventListener('input', function(){ PROD_STATE[iid].note = this.value; prodRenderSummary(); }); })(item.id);
      fields.appendChild(ta);

      var actions = document.createElement('div');
      actions.className = 'prod-issue-actions';
      actions.id = 'prod-actions-' + item.id;

      // Photo button
      var photoLbl = document.createElement('label');
      photoLbl.className = 'prod-photo-btn';
      var photoSpan = document.createElement('span');
      photoSpan.textContent = '📷 Photo';
      var photoInput = document.createElement('input');
      photoInput.type = 'file'; photoInput.accept = 'image/*'; photoInput.setAttribute('capture','environment');
      photoInput.style.display = 'none';
      (function(iid){ photoInput.addEventListener('change', function(){ prodAttachPhoto(iid, this); }); })(item.id);
      photoLbl.appendChild(photoSpan); photoLbl.appendChild(photoInput);
      actions.appendChild(photoLbl);

      // Priority select
      var priSel = document.createElement('select');
      priSel.className = 'prod-pri-sel';
      priSel.id = 'prod-pri-' + item.id;
      priSel.innerHTML = '<option value="">Priority...</option><option value="urgent">🔴 Urgent</option><option value="high">🟡 High</option><option value="routine">🟢 Routine</option>';
      actions.appendChild(priSel);

      // Create WO button
      var woBtn = document.createElement('button');
      woBtn.type = 'button';
      woBtn.className = 'prod-wo-btn';
      woBtn.textContent = '➕ Create WO';
      (function(iid, itxt, sid){ woBtn.addEventListener('click', function(){ prodCreateWO(iid, itxt, sid); }); })(item.id, item.text, sec.id);
      actions.appendChild(woBtn);

      fields.appendChild(actions);
      itemEl.appendChild(fields);
      secEl.appendChild(itemEl);
    });

    container.appendChild(secEl);
  });
}

function escQ(s){ return s.replace(/'/g,"\\'"); }

function prodSetStatus(itemId, status) {
  if (!PROD_STATE[itemId]) PROD_STATE[itemId] = { status:null, note:'', woId:'' };
  // Toggle off if tapping same status again
  PROD_STATE[itemId].status = (PROD_STATE[itemId].status === status) ? null : status;
  var s = PROD_STATE[itemId].status;

  // Update item background
  var itemEl = document.getElementById('prod-item-' + itemId);
  if (itemEl) {
    itemEl.className = 'prod-item' + (s==='pass'?' prod-pass': s==='needs'?' prod-needs': s==='critical'?' prod-crit':'');
    // Update button active states
    itemEl.querySelectorAll('.prod-sbtn').forEach(function(b){ b.classList.remove('active'); });
    if (s) {
      var map = { pass:'prod-sbtn-pass', needs:'prod-sbtn-needs', critical:'prod-sbtn-critical' };
      var ab = itemEl.querySelector('.' + map[s]);
      if (ab) ab.classList.add('active');
    }
  }

  // Show/hide detail fields
  var fields = document.getElementById('prod-fields-' + itemId);
  if (fields) fields.style.display = (s==='needs'||s==='critical') ? 'block' : 'none';

  // Auto-set priority to urgent for critical items
  if (s === 'critical') {
    var priSel = document.getElementById('prod-pri-' + itemId);
    if (priSel && !priSel.value) priSel.value = 'urgent';
  }

  // Update section header color and progress
  PROD_SECTIONS.forEach(function(sec){
    if (!sec.items.some(function(it){ return it.id===itemId; })) return;
    var secEl = document.querySelector('.prod-section[data-sec="' + sec.id + '"]');
    if (secEl) {
      var hasIssue = sec.items.some(function(it){ var st=PROD_STATE[it.id]; return st&&(st.status==='needs'||st.status==='critical'); });
      var hasCrit  = sec.items.some(function(it){ var st=PROD_STATE[it.id]; return st&&st.status==='critical'; });
      secEl.className = 'prod-section' + (hasCrit?' prod-sec-crit':hasIssue?' prod-sec-warn':'');
      var prog = document.getElementById('prog-' + sec.id);
      if (prog) {
        var done = sec.items.filter(function(it){ return PROD_STATE[it.id]&&PROD_STATE[it.id].status; }).length;
        prog.textContent = done + '/' + sec.items.length;
      }
    }
  });

  prodRenderSummary();
}

function prodAttachPhoto(itemId, input) {
  if (!input.files || !input.files[0]) return;
  if (!PROD_STATE[itemId]) PROD_STATE[itemId] = { status:null, note:'', woId:'' };
  PROD_STATE[itemId].photo = input.files[0].name;
  var btn = input.parentElement;
  btn.innerHTML = '<span style="color:#4caf50">📷 ✓ Photo</span><input type="file" accept="image/*" capture="environment" onchange="prodAttachPhoto(\'' + itemId + '\',this)" style="display:none">';
}

async function prodCreateWO(itemId, taskText, sectionId) {
  var note = document.getElementById('prod-note-' + itemId);
  var pri  = document.getElementById('prod-pri-'  + itemId);
  var desc = (note ? note.value.trim() : '') || taskText;
  var priority = (pri ? pri.value : '') || (PROD_STATE[itemId].status==='critical'?'urgent':'high');
  if (!priority) { alert('Select a priority before creating a work order.'); return; }

  var sectionLabel = '';
  var itemTextFull = taskText;
  PROD_SECTIONS.forEach(function(s){ if(s.id===sectionId){ sectionLabel=s.label; s.items.forEach(function(it){ if(it.id===itemId) itemTextFull=it.text; }); } });

  var problemMap = {
    water:'Water — Other', feed:'Feed — Auger Not Running', eggs:'Egg Collection — Other',
    manure:'Manure — Wet Litter / Wet Spots', birds:'Other — Not Listed',
    vent:'Ventilation — Fan Not Running', fives:'Structure — Door / Curtain Damage'
  };

  var wo = {
    id: 'WO-' + String(woCounter).padStart(3,'0'),
    date: PROD_HEADER.date || todayStr,
    tech: PROD_HEADER.tech || CL.w || 'Checklist',
    farm: CL.loc,
    house: 'House ' + PROD_HEADER.house,
    problem: problemMap[sectionId] || 'Other — Not Listed',
    desc: 'From barn walk checklist:\n' + itemTextFull + '\n\nNotes: ' + desc,
    priority: priority,
    parts: '', down: 'no', status: 'open',
    notes: 'Auto-created from production checklist — ' + sectionLabel,
    submitted: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    ts: Date.now()
  };

  setSyncDot('saving');
  var ref = await db.collection('workOrders').add(wo);
  wo._fbId = ref.id;
  await db.collection('activityLog').add({
    type:'wo', id:wo.id,
    desc:'WO from barn walk: ' + CL.loc + ' House ' + PROD_HEADER.house + ' — ' + itemTextFull.slice(0,60),
    tech: wo.tech, date: wo.submitted, ts: Date.now()
  });
  setSyncDot('live');

  PROD_WOS_CREATED++;
  PROD_STATE[itemId].woId = wo.id;
  if (note) PROD_STATE[itemId].note = note.value;

  // Replace WO creation controls with badge
  var fields = document.getElementById('prod-fields-' + itemId);
  var actions = fields.querySelector('.prod-issue-actions');
  if (actions) {
    var existingPhoto = actions.querySelector('label') ? actions.querySelector('label').outerHTML : '';
    actions.innerHTML = existingPhoto + '<span class="prod-wo-badge">🔧 ' + wo.id + ' created</span>';
  }
  prodRenderSummary();
}

function prodRenderSummary() {
  var totalItems   = 0;
  var passCount    = 0;
  var needsCount   = 0;
  var critCount    = 0;
  var answeredCount = 0;

  PROD_SECTIONS.forEach(function(sec){
    sec.items.forEach(function(item){
      totalItems++;
      var s = PROD_STATE[item.id];
      if (!s || !s.status) return;
      answeredCount++;
      if (s.status==='pass')     passCount++;
      if (s.status==='needs')    needsCount++;
      if (s.status==='critical') critCount++;
    });
  });

  var barnStatus = critCount > 0 ? 'red' : needsCount > 0 ? 'yellow' : answeredCount===totalItems ? 'green' : 'grey';
  var barnLabel  = { red:'🔴 Critical Issues', yellow:'🟡 Needs Attention', green:'✅ All Clear', grey:'⬜ In Progress' };
  var barnColor  = { red:'#c0392b', yellow:'#d69e2e', green:'#4caf50', grey:'#5a8a5a' };

  document.getElementById('prod-sum-total').textContent    = answeredCount + '/' + totalItems;
  document.getElementById('prod-sum-needs').textContent    = needsCount;
  document.getElementById('prod-sum-crit').textContent     = critCount;
  document.getElementById('prod-sum-wos').textContent      = PROD_WOS_CREATED;
  document.getElementById('prod-sum-status').textContent   = barnLabel[barnStatus];
  document.getElementById('prod-sum-status').style.color   = barnColor[barnStatus];
  document.getElementById('prod-sum-bar-fill').style.width = (answeredCount/totalItems*100).toFixed(0) + '%';
  document.getElementById('prod-sum-bar-fill').style.background = barnColor[barnStatus];

  var submitBtn = document.getElementById('prod-submit-btn');
  submitBtn.disabled = answeredCount < totalItems;
  submitBtn.style.opacity = answeredCount < totalItems ? '0.4' : '1';
  submitBtn.textContent = answeredCount < totalItems
    ? (totalItems - answeredCount) + ' items remaining'
    : '✓ Submit Barn Walk';
}

async function prodSubmit() {
  if (PROD_SUBMITTED) return;
  // collect notes from open textareas
  PROD_SECTIONS.forEach(function(sec){
    sec.items.forEach(function(item){
      var n = document.getElementById('prod-note-' + item.id);
      if (n) PROD_STATE[item.id].note = n.value;
    });
  });

  PROD_HEADER.end = document.getElementById('prod-hdr-end').value ||
    new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  PROD_HEADER.shift = document.getElementById('prod-hdr-shift').value;
  PROD_HEADER.start = document.getElementById('prod-hdr-start').value;

  var totalItems = 0; var critCount = 0; var needsCount = 0;
  PROD_SECTIONS.forEach(function(sec){ sec.items.forEach(function(it){
    totalItems++;
    if (PROD_STATE[it.id].status==='critical') critCount++;
    if (PROD_STATE[it.id].status==='needs') needsCount++;
  });});

  var barnStatus = critCount>0?'red':needsCount>0?'yellow':'green';

  var record = {
    farm: CL.loc,
    house: PROD_HEADER.house,
    tech: PROD_HEADER.tech,
    date: PROD_HEADER.date,
    shift: PROD_HEADER.shift,
    startTime: PROD_HEADER.start,
    endTime: PROD_HEADER.end,
    barnStatus: barnStatus,
    criticalCount: critCount,
    needsCount: needsCount,
    wosCreated: PROD_WOS_CREATED,
    items: PROD_STATE,
    ts: Date.now()
  };

  setSyncDot('saving');
  await db.collection('barnWalks').add(record);
  await db.collection('activityLog').add({
    type:'barnwalk', id:'BW',
    desc: 'Barn walk completed: ' + CL.loc + ' House ' + PROD_HEADER.house +
      ' — ' + barnStatus.toUpperCase() + ' (' + critCount + ' critical, ' + needsCount + ' needs attention)',
    tech: PROD_HEADER.tech, date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'}), ts: Date.now()
  });
  setSyncDot('live');

  PROD_SUBMITTED = true;

  // Mark barn done on home screen
  var allFlags = [];
  PROD_SECTIONS.forEach(function(sec){ sec.items.forEach(function(it){
    var s = PROD_STATE[it.id];
    if (s && (s.status==='needs'||s.status==='critical')) {
      allFlags.push({ text: it.text + (s.note?' — '+s.note:''), status: s.status });
    }
  });});
  markBarnDone(CL.loc, parseInt(PROD_HEADER.house), allFlags);


  document.getElementById('prod-sections').innerHTML = '';
  document.getElementById('prod-submitted-card').style.display = 'block';
  document.getElementById('prod-submitted-status').textContent =
    barnStatus==='red' ? '🔴 Critical Issues Found' :
    barnStatus==='yellow' ? '🟡 Needs Attention' : '✅ All Clear';
  document.getElementById('prod-submitted-status').style.color =
    barnStatus==='red'?'#c0392b':barnStatus==='yellow'?'#d69e2e':'#4caf50';
  document.getElementById('prod-submitted-detail').textContent =
    critCount + ' critical · ' + needsCount + ' needs attention · ' + PROD_WOS_CREATED + ' WOs created';
}

function prodStartNew() {
  closeChecklist();
  go('dash');
}

// ─── legacy checklist functions (maintenance mode + fly/rodent) ─

function clOpenHouse(n) {
  if (CL_MODE === 'production') {
    prodOpenHouse(n);
    return;
  }
  var tabs = CL_TABS_MAINT;
  CL.house = n; CL.tab = tabs[0];
  CL.chk={}; CL.done={}; CL.flags={};
  tabs.forEach(function(t){CL.chk[t]={}; CL.done[t]=false; CL.flags[t]={};});
  document.getElementById('cl-cltitle').textContent = CL.loc + ' — House ' + n;
  document.getElementById('cl-clwkr').textContent = CL.w;
  document.getElementById('cl-cldate').textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  clRTabs(); clRTasks(); clGoSc('cl-s-cl');
}

function clRTabs() {
  var tks = CL_MODE === 'maintenance' ? CL_TKS_MAINT : CL_TKS;
  var tabs = CL_MODE === 'maintenance' ? CL_TABS_MAINT : CL_TABS_PROD;
  var row = document.getElementById('cl-tabs'); row.innerHTML='';
  tabs.forEach(function(tid){
    var t = tks[tid];
    var isDone = CL.done[tid];
    var flags = CL.flags[tid]||{};
    var hasFlag = Object.values(flags).some(function(f){return f});
    var b = document.createElement('button');
    b.className = 'cl-tab'+(CL.tab===tid?' on':'');
    b.innerHTML = t.label + (isDone?'<span style="width:6px;height:6px;border-radius:50%;background:#4caf50;display:inline-block;margin-left:4px;vertical-align:middle"></span>':'') + (hasFlag?'<span style="width:6px;height:6px;border-radius:50%;background:#c0392b;display:inline-block;margin-left:3px;vertical-align:middle"></span>':'');
    (function(id){b.onclick=function(){CL.tab=id;clRTabs();clRTasks()}})(tid);
    row.appendChild(b);
  });
}

function clRTasks() {
  var tks = CL_MODE === 'maintenance' ? CL_TKS_MAINT : CL_TKS;
  var tid = CL.tab; var t = tks[tid];
  if(!t) return;
  if(CL.done[tid]){
    document.getElementById('cl-plbl').textContent = t.tasks.length+' of '+t.tasks.length+' tasks';
    document.getElementById('cl-ppct').textContent = '100%';
    document.getElementById('cl-pfil').style.width = '100%';
    var flags = CL.flags[tid]||{};
    var flagCount = Object.values(flags).filter(function(f){return f}).length;
    var fc = flagCount>0 ? '<div style="margin-top:10px;font-size:12px;color:#c0392b;font-weight:700">'+flagCount+' issue'+(flagCount>1?'s':'')+' flagged — check Log tab</div>' : '';
    document.getElementById('cl-tlist').innerHTML = '<div style="text-align:center;padding:36px 16px;background:#1a3a1a;border-radius:12px;border:1px solid #2a5a2a"><div style="width:52px;height:52px;border-radius:50%;background:#4caf50;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;color:#fff">✓</div><div style="font-size:18px;font-weight:700;color:#f0ead8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">'+t.label+' Complete</div><div style="font-size:14px;color:#7ab07a;margin-bottom:4px">Signed off by <span style="color:#f0ead8;font-weight:700">'+CL.by[tid]+'</span></div><div style="font-size:13px;color:#5a8a5a;margin-bottom:6px">'+CL.loc+' · House '+CL.house+' · '+CL.time[tid]+'</div>'+fc+'<div style="margin-top:18px"><button class="cl-gbtn" onclick="clResetTab()">Reset for next worker</button></div></div>';
    document.getElementById('cl-swrap').innerHTML='';
    return;
  }
  var ch = CL.chk[tid]||{}; var flags = CL.flags[tid]||{};
  var dn=0; for(var k in ch){if(ch[k])dn++}
  var tot = t.tasks.length; var pct = tot?Math.round(dn/tot*100):0;
  document.getElementById('cl-plbl').textContent = dn+' of '+tot+' tasks';
  document.getElementById('cl-ppct').textContent = pct+'%';
  document.getElementById('cl-pfil').style.width = pct+'%';
  var list = document.getElementById('cl-tlist'); list.innerHTML='';
  var note = document.createElement('div');
  note.style.cssText='font-size:10px;font-weight:700;color:#7ab07a;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px';
  note.textContent = t.note; list.appendChild(note);
  t.tasks.forEach(function(task,i){
    var isDone=!!ch[i]; var isFlagged=!!(flags[i]&&flags[i].text!==undefined);
    var row=document.createElement('div');
    row.className='cl-trow'+(isDone?' dn':'')+(isFlagged?' flagged':'');
    row.innerHTML='<div class="cl-cb'+(isDone?' on':'')+'">✓</div><div class="cl-tt'+(isDone?' dn':'')+'" style="flex:1">'+task+'</div>';
    (function(idx){row.querySelector('.cl-cb').onclick=function(e){e.stopPropagation();if(!CL.chk[tid])CL.chk[tid]={};CL.chk[tid][idx]=!CL.chk[tid][idx];clRTasks()};})(i);
    list.appendChild(row);
  });
  var sw=document.getElementById('cl-swrap');
  if(dn===tot){sw.innerHTML='<button class="cl-cbtn" onclick="clMarkDone()">✓  Mark Complete</button>'}
  else{sw.innerHTML=dn>0?'<div style="text-align:center;margin-top:12px"><button class="cl-gbtn" onclick="clResetTab()">Reset</button></div>':''}
}

function clMarkDone(){
  var tid=CL.tab;
  CL.done[tid]=true; CL.by[tid]=CL.w;
  CL.time[tid]=new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  var flags=CL.flags[tid]||{}; var flagList=[];
  Object.keys(flags).forEach(function(k){if(flags[k])flagList.push(flags[k])});
  clRTabs(); clRTasks();
}

function clResetTab(){
  var tid=CL.tab;
  CL.chk[tid]={}; CL.done[tid]=false; CL.by[tid]=''; CL.time[tid]=''; CL.flags[tid]={};
  clRTabs(); clRTasks();
}

function clFlagToWO(issueText, farm){
  closeChecklist(); go('wo-submit');
  setTimeout(function(){
    var desc=document.getElementById('wo-desc'); if(desc) desc.value='Issue from barn walk: '+issueText;
    document.querySelectorAll('.pri-pill').forEach(function(p){p.classList.remove('sel')});
    var hp=document.querySelector('.pri-pill.high'); if(hp){hp.classList.add('sel'); selPri='high';}
    var loc = farm || CL.loc; if(loc){ var sel=document.getElementById('wo-farm'); if(sel){sel.value=loc;loadHouses();} }
  },300);
}

function enterApp(tab) {
  document.getElementById('landing-screen').style.display = 'none';
  document.getElementById('main-header').style.display = '';
  document.getElementById('main-content').style.display = '';
  loadTodayStatus();
  if (tab) go(tab);
}

function goHome() {
  // ── Close every full-screen overlay that might be open ──────────
  var OVERLAYS = [
    'ec-section','mw-section','bio-section','flock-section',
    'prod-summary-section','barn-walk-modal','morning-walk-modal',
    'bw-history-overlay','egg-trends-overlay',
    'ops-overlay','staff-edit-modal',
    'admin-pin-modal','briefing-modal'
  ];
  OVERLAYS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Also close any generic .overlay modals
  document.querySelectorAll('.overlay').forEach(function(el) {
    el.style.display = 'none';
  });

  // ── Show landing, hide app chrome ───────────────────────────────
  document.getElementById('landing-screen').style.display = 'flex';
  document.getElementById('main-header').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';
  var fab = document.getElementById('fab-btn');
  if (fab) fab.style.display = 'none';


  injectLandingStaffCard();
  updateHomeFeedStatus();
  if (typeof renderLandingStatus === 'function') renderLandingStatus();
}

function injectLandingStaffCard() {
  if (document.getElementById('landing-staff-btn')) return; // already injected
  // Find the Dashboard card button and insert Staff card after it
  var buttons = document.querySelectorAll('#landing-screen button');
  var dashBtn = null;
  buttons.forEach(function(b) { if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("enterApp('dash')")) dashBtn = b; });
  if (!dashBtn) return;
  var staffBtn = document.createElement('button');
  staffBtn.id = 'landing-staff-btn';
  staffBtn.setAttribute('onclick', "enterApp('staff')");
  staffBtn.style.cssText = 'width:100%;padding:22px 20px;background:#1a2a3a;border:2px solid #4a90d9;border-radius:14px;color:#fff;cursor:pointer;display:flex;align-items:center;gap:18px;text-align:left;margin-top:0;';
  staffBtn.innerHTML = '<span style="font-size:32px;line-height:1;">👥</span><div style="flex:1;"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:14px;font-weight:700;color:#7ab0f6;letter-spacing:1.5px;text-transform:uppercase;">Staff</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#5a90c9;letter-spacing:1px;margin-top:4px;">Team directory · Add employees</div></div><span style="margin-left:auto;font-size:20px;color:#4a90d9;">→</span>';
  dashBtn.parentNode.insertBefore(staffBtn, dashBtn.nextSibling);
}

async function updateHomeFeedStatus() {
  var el = document.getElementById('home-feed-status');
  if (!el) return;
  try {
    // Use already-loaded feedBins + feedReadings if available, otherwise quick query
    var bins = (typeof feedBins !== 'undefined' && feedBins.length) ? feedBins : [];
    var readings = (typeof feedReadings !== 'undefined' && feedReadings.length) ? feedReadings : [];
    if (!bins.length) {
      var snap = await db.collection('feedBins').get();
      snap.forEach(function(d){ bins.push(d.data()); });
    }
    if (!readings.length) {
      var today = new Date().toISOString().slice(0,10);
      // get last 7 days of readings for latest per-bin
      var rSnap = await db.collection('feedReadings').orderBy('date','desc').limit(200).get();
      rSnap.forEach(function(d){ readings.push(d.data()); });
    }
    if (!bins.length) { el.textContent = 'Bin levels · Deliveries · Readings'; return; }
    // Get latest reading per binId
    var latestByBin = {};
    readings.forEach(function(r){ if (!latestByBin[r.binId] || r.date > latestByBin[r.binId].date) latestByBin[r.binId] = r; });
    var red=0, amber=0, green=0, noData=0;
    bins.forEach(function(b){
      var r = latestByBin[b.binId];
      if (!r) { noData++; return; }
      var lbs = (parseFloat(r.lbs)||0);
      var cap = b.capacity||90000;
      var pct = Math.round((lbs/cap)*100);
      if (pct < 20) red++;
      else if (pct < 40) amber++;
      else green++;
    });
    var parts = [];
    var totalHouses = bins.length / 2; // 2 bins per house
    if (red > 0) parts.push('🔴 ' + red + ' bins low');
    if (amber > 0) parts.push('🟡 ' + amber + ' bins watch');
    if (green > 0) parts.push('✅ ' + green + ' bins ok');
    if (noData > 0 && !parts.length) parts.push('📖 ' + bins.length + ' bins · tap to read');
    el.textContent = parts.length ? parts.join(' · ') : '✅ All bins OK';
  } catch(e) {
    el.textContent = 'Bin levels · Deliveries · Readings';
  }
}

function openProductionScreen() {
  enterApp('prod');
}

// ═══════════════════════════════════════════
// BARN STATUS TRACKING
// ═══════════════════════════════════════════
var BARN_STATUS = {};
var MORNING_STATUS = {};
var _todayMortTotal = 0;

async function loadTodayStatus() {
  var today = new Date().toISOString().slice(0,10);
  try {
    var bSnap = await db.collection('barnWalks').where('date','==',today).get();
    bSnap.forEach(function(d) {
      var w = d.data();
      var key = w.farm + '-' + w.house;
      BARN_STATUS[key] = (w.flags && w.flags.length > 0) ? 'issue' : 'done';
      if (w.mortCount) _todayMortTotal += Number(w.mortCount) || 0;
    });
  } catch(e) { console.warn('loadTodayStatus barnWalks:', e); }
  try {
    var mSnap = await db.collection('morningWalks').where('date','==',today).get();
    mSnap.forEach(function(d) {
      var w = d.data();
      var key = w.farm + '-' + w.house;
      MORNING_STATUS[key] = (w.flags && w.flags.length > 0) ? 'issue' : 'done';
    });
  } catch(e) { console.warn('loadTodayStatus morningWalks:', e); }
  renderProdPanel();
}
var BARN_DATE = '';

var FARMS = {
  Hegins: 8,
  Danville: 5
};

function barnKey(farm, house) { return farm + '-' + house; }

function getBarnStatus() {
  var today = new Date().toLocaleDateString('en-US');
  if (BARN_DATE !== today) {
    BARN_STATUS = {};
    BARN_DATE = today;
  }
  return BARN_STATUS;
}

function markBarnDone(farm, house, flags) {
  getBarnStatus();
  var key = barnKey(farm, house);
  BARN_STATUS[key] = {
    done: true,
    flagged: flags && flags.length > 0,
    flags: flags || [],
    time: new Date().toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})
  };
  // Update TV scoreboard status
  if (typeof updateBarnWalkStatus === 'function') updateBarnWalkStatus(farm, house, flags||[]);
  renderBarnGrid();
}

function renderBarnGrid() {
  var status = getBarnStatus();
  var totalDone = Object.values(status).filter(function(s){return s.done}).length;
  var totalHouses = 13;
  var pct = Math.round((totalDone / totalHouses) * 100);
  var circumference = 201;

  // Update production ring
  var ring = document.getElementById('prod-ring');
  if (ring) ring.style.strokeDashoffset = circumference - (circumference * pct / 100);
  var pctLbl = document.getElementById('prod-pct-label');
  if (pctLbl) pctLbl.textContent = pct + '%';
  var doneLbl = document.getElementById('prod-done-label');
  if (doneLbl) doneLbl.textContent = totalDone + ' / ' + totalHouses + ' barns';

  // Render mini grids
  Object.keys(FARMS).forEach(function(farm) {
    var grid = document.getElementById('mini-grid-' + farm.toLowerCase());
    if (!grid) return;
    var count = FARMS[farm];
    grid.innerHTML = '';
    for (var i = 1; i <= count; i++) {
      var key = barnKey(farm, i);
      var s = status[key];
      var bg, border;
      if (s && s.flagged)     { bg = '#3a1a1a'; border = '#c0392b'; }
      else if (s && s.done)   { bg = '#1a4a1a'; border = '#4caf50'; }
      else                    { bg = '#163016'; border = '#2a5a2a'; }
      var div = document.createElement('div');
      div.style.cssText = 'background:'+bg+';border:1px solid '+border+';border-radius:4px;padding:4px 2px;text-align:center;';
      div.innerHTML = '<div style="font-size:9px;font-weight:700;color:'+(s&&s.done?'#f0ead8':'#5a8a5a')+';">'+i+'</div>'
        + '<div style="font-size:8px;line-height:1;">'+(s&&s.flagged?'🚩':s&&s.done?'✓':'')+'</div>';
      grid.appendChild(div);
    }
  });

  // Flags alert
  var allFlags = [];
  Object.keys(status).forEach(function(key) {
    var s = status[key];
    if (s && s.flagged && s.flags && s.flags.length) {
      var parts = key.split('-');
      s.flags.forEach(function(f) {
        allFlags.push({farm: parts[0], house: parts[1], note: typeof f === 'object' ? f.text : f});
      });
    }
  });
  var alertEl = document.getElementById('landing-flags-alert');
  var listEl = document.getElementById('landing-flags-list');
  if (alertEl && listEl) {
    if (allFlags.length > 0) {
      alertEl.style.display = 'block';
      listEl.innerHTML = allFlags.map(function(f) {
        return '<div style="font-size:12px;color:#f0ead8;margin-bottom:5px;padding:5px 8px;background:#3a1a1a;border-radius:6px;">'
          + '<span style="color:#c0392b;font-weight:700;">'+f.farm+' Barn '+f.house+'</span> — '+f.note+'</div>';
      }).join('');
    } else {
      alertEl.style.display = 'none';
    }
  }
}

function renderMaintCard() {
  // Pull live data if available, otherwise show dashes
  if (typeof workOrders === 'undefined' || typeof ALL_PM === 'undefined') return;

  var totalWOs = workOrders.filter(function(w){ return w.status !== 'completed'; }).length;
  var doneWOs  = workOrders.filter(function(w){ return w.status === 'completed'; }).length;
  var allWOs   = workOrders.length;
  var woPct    = allWOs > 0 ? Math.round((doneWOs / allWOs) * 100) : 0;

  var totalPM  = ALL_PM.length;
  var donePM   = ALL_PM.filter(function(t){ return doneToday(t.id); }).length;
  var pmPct    = totalPM > 0 ? Math.round((donePM / totalPM) * 100) : 0;

  var urgent   = workOrders.filter(function(w){ return w.priority==='urgent' && w.status!=='completed'; }).length;
  var pmOver   = ALL_PM.filter(function(t){ return pmStatus(t.id) === 'overdue'; }).length;

  // Overall maintenance score = average of WO % and PM %
  var overall  = Math.round((woPct + pmPct) / 2);
  var circumference = 201;

  var ring = document.getElementById('maint-ring');
  if (ring) {
    ring.style.strokeDashoffset = circumference - (circumference * overall / 100);
    ring.style.stroke = urgent > 0 ? '#e53e3e' : '#3b82f6';
  }
  var lbl = document.getElementById('maint-pct-label');
  if (lbl) lbl.textContent = overall + '%';

  var pmPctEl = document.getElementById('maint-pm-pct');
  if (pmPctEl) pmPctEl.textContent = pmPct + '%';
  var woPctEl = document.getElementById('maint-wo-pct');
  if (woPctEl) woPctEl.textContent = woPct + '%';
  var urgEl = document.getElementById('maint-urgent');
  if (urgEl) { urgEl.textContent = urgent; urgEl.style.color = urgent > 0 ? '#e53e3e' : '#4caf50'; }
  var pmOverEl = document.getElementById('maint-pm-over');
  if (pmOverEl) { pmOverEl.textContent = pmOver; pmOverEl.style.color = pmOver > 0 ? '#d69e2e' : '#4caf50'; }
}

// Midnight auto-reset check
setInterval(function() {
  var today = new Date().toLocaleDateString('en-US');
  if (BARN_DATE && BARN_DATE !== today) {
    BARN_STATUS = {};
    MORNING_STATUS = {};
    _todayMortTotal = 0;
    BARN_DATE = today;
    renderBarnGrid();
  }
}, 60000); // check every minute

// Init grid on load
document.addEventListener('DOMContentLoaded', function() {
  renderBarnGrid();
  // Populate Feed Mill status on home card after a short delay (let Firebase init)
  setTimeout(updateHomeFeedStatus, 1800);
});

// ═══════════════════════════════════════════
// OPERATIONS — Mortality / Temp / PSI Logs
// ═══════════════════════════════════════════
// OPS DATA - shared by barn walk and operations dashboard
var OPS_DATA = { mortality:{}, temp:{}, psi:{} };
var OPS_TODAY = new Date().toISOString().slice(0,10);

async function opsLoadToday() {
  OPS_TODAY = new Date().toISOString().slice(0,10);
  try {
    var snap = await db.collection('opsLogs').where('date','==',OPS_TODAY).get();
    OPS_DATA = { mortality:{}, temp:{}, psi:{} };
    snap.forEach(function(doc) {
      var d = doc.data();
      if (!OPS_DATA[d.type]) OPS_DATA[d.type] = {};
      OPS_DATA[d.type][doc.id] = d;
    });
  } catch(e) { console.warn('opsLoad:', e); }
}

// Save from barn walk - uses CL.loc + PROD_HEADER.house
async function opsSaveMortality() {
  var count = parseInt(document.getElementById('bw-mort-count').value);
  if (isNaN(count) || count < 0) { alert('Enter a valid count (0 or more).'); return; }
  var notes = document.getElementById('bw-mort-notes').value.trim();
  var flagged = count >= 50;
  var key = CL.loc + '-H' + PROD_HEADER.house + '-' + OPS_TODAY + '-mortality';
  var record = { type:'mortality', farm:CL.loc, house:parseInt(PROD_HEADER.house),
    date:OPS_TODAY, count:count, notes:notes, flagged:flagged, ts:Date.now() };
  if (!OPS_DATA.mortality) OPS_DATA.mortality = {};
  OPS_DATA.mortality[key] = record;
  setSyncDot('saving');
  await db.collection('opsLogs').doc(key).set(record);
  setSyncDot('live');
  opsBwRenderMort();
  opsUpdateLandingCard();
  if (flagged) alert('ALERT: Mortality of ' + count + ' is at or above 50. Notify barn manager.');
}

async function opsSaveTemp() {
  var val = parseFloat(document.getElementById('bw-temp-val').value);
  if (isNaN(val)) { alert('Enter a temperature reading.'); return; }
  var loc = document.getElementById('bw-temp-loc').value.trim() || 'Not specified';
  var flagged = val < 65 || val > 89;
  var key = CL.loc + '-H' + PROD_HEADER.house + '-' + OPS_TODAY + '-temp-' + Date.now();
  var record = { type:'temp', farm:CL.loc, house:parseInt(PROD_HEADER.house),
    date:OPS_TODAY, value:val, location:loc, flagged:flagged, ts:Date.now() };
  if (!OPS_DATA.temp) OPS_DATA.temp = {};
  OPS_DATA.temp[key] = record;
  setSyncDot('saving');
  await db.collection('opsLogs').doc(key).set(record);
  setSyncDot('live');
  document.getElementById('bw-temp-val').value = '';
  document.getElementById('bw-temp-loc').value = '';
  opsBwRenderTemp();
  opsUpdateLandingCard();
  if (flagged) alert('TEMP FLAG: ' + val + 'F is outside 65-89F range.');
}

async function opsSavePSI() {
  var val = parseFloat(document.getElementById('bw-psi-val').value);
  if (isNaN(val)) { alert('Enter a PSI reading.'); return; }
  var loc = document.getElementById('bw-psi-loc').value.trim() || 'Not specified';
  var flagged = val < 10 || val > 80;
  var key = CL.loc + '-H' + PROD_HEADER.house + '-' + OPS_TODAY + '-psi-' + Date.now();
  var record = { type:'psi', farm:CL.loc, house:parseInt(PROD_HEADER.house),
    date:OPS_TODAY, value:val, location:loc, flagged:flagged, ts:Date.now() };
  if (!OPS_DATA.psi) OPS_DATA.psi = {};
  OPS_DATA.psi[key] = record;
  setSyncDot('saving');
  await db.collection('opsLogs').doc(key).set(record);
  setSyncDot('live');
  document.getElementById('bw-psi-val').value = '';
  document.getElementById('bw-psi-loc').value = '';
  opsBwRenderPSI();
  opsUpdateLandingCard();
  if (flagged) alert('PSI FLAG: ' + val + ' PSI is outside 10-80 PSI range.');
}

function opsBwGetEntries(type) {
  return Object.values(OPS_DATA[type]||{}).filter(function(r){
    return r.farm===CL.loc && String(r.house)===String(PROD_HEADER.house) && r.date===OPS_TODAY;
  }).sort(function(a,b){ return b.ts-a.ts; });
}

function opsBwRenderMort() {
  var el = document.getElementById('bw-mort-list'); if (!el) return;
  var entries = opsBwGetEntries('mortality');
  if (!entries.length) { el.innerHTML = '<div style="color:#5a8a5a;font-size:12px;padding:6px 0">No entry yet today</div>'; return; }
  el.innerHTML = entries.map(function(r){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #2a5a2a">'
      + '<span style="font-size:13px;color:#f0ead8">' + (r.notes||'Daily count') + '</span>'
      + '<span style="font-family:IBM Plex Mono,monospace;font-size:18px;font-weight:700;color:' + (r.flagged?'#c0392b':'#4caf50') + '">'
      + r.count + ' <span style="font-size:10px">birds</span>'
      + (r.flagged?' <span style="font-size:10px;color:#c0392b">HIGH</span>':'') + '</span></div>';
  }).join('');
}

function opsBwRenderTemp() {
  var el = document.getElementById('bw-temp-list'); if (!el) return;
  var entries = opsBwGetEntries('temp');
  if (!entries.length) { el.innerHTML = '<div style="color:#5a8a5a;font-size:12px;padding:6px 0">No readings yet</div>'; return; }
  el.innerHTML = entries.map(function(r){
    var col = r.flagged?(r.value>89?'#c0392b':'#d69e2e'):'#4caf50';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #2a5a2a">'
      + '<span style="font-size:12px;color:#7ab07a">' + r.location + '</span>'
      + '<span style="font-family:IBM Plex Mono,monospace;font-size:18px;font-weight:700;color:' + col + '">'
      + r.value + 'F' + (r.flagged?' <span style="font-size:11px">FLAG</span>':'') + '</span></div>';
  }).join('');
}

function opsBwRenderPSI() {
  var el = document.getElementById('bw-psi-list'); if (!el) return;
  var entries = opsBwGetEntries('psi');
  if (!entries.length) { el.innerHTML = '<div style="color:#5a8a5a;font-size:12px;padding:6px 0">No readings yet</div>'; return; }
  el.innerHTML = entries.map(function(r){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #2a5a2a">'
      + '<span style="font-size:12px;color:#7ab07a">' + r.location + '</span>'
      + '<span style="font-family:IBM Plex Mono,monospace;font-size:18px;font-weight:700;color:' + (r.flagged?'#c0392b':'#4caf50') + '">'
      + r.value + ' PSI' + (r.flagged?' <span style="font-size:11px">FLAG</span>':'') + '</span></div>';
  }).join('');
}

function opsBwInitForHouse() { opsBwRenderMort(); opsBwRenderTemp(); opsBwRenderPSI(); }

// Operations dashboard
function openOperations() {
  OPS_TODAY = new Date().toISOString().slice(0,10);
  document.getElementById('ops-overlay').style.display = 'block';
  document.getElementById('ops-hdr-date').textContent =
    new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  opsLoadToday().then(function(){ opsDashRender(); });
}

function closeOperations() {
  document.getElementById('ops-overlay').style.display = 'none';
}

function opsDashRender() {
  var allMort = Object.values(OPS_DATA.mortality||{}).filter(function(r){ return r.date===OPS_TODAY; });
  var allTemp = Object.values(OPS_DATA.temp||{}).filter(function(r){ return r.date===OPS_TODAY; });
  var allPsi  = Object.values(OPS_DATA.psi||{}).filter(function(r){ return r.date===OPS_TODAY; });
  var barnSt  = getBarnStatus();
  var barnsDone = Object.values(barnSt).filter(function(s){ return s.done; }).length;
  var barnsFlag = Object.values(barnSt).filter(function(s){ return s.flagged; }).length;
  var totalMort = allMort.reduce(function(s,r){ return s+(r.count||0); },0);
  var mortHigh  = allMort.filter(function(r){ return r.flagged; });
  var tempFlags = allTemp.filter(function(r){ return r.flagged; });
  var psiFlags  = allPsi.filter(function(r){ return r.flagged; });
  var openWOs   = workOrders.filter(function(w){ return w.status==='open'||w.status==='in-progress'; });
  var urgentWOs = workOrders.filter(function(w){ return w.priority==='urgent'&&w.status!=='completed'; });
  var s=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  var col=function(id,v){var e=document.getElementById(id);if(e)e.style.color=v;};
  s('ops-stat-barns', barnsDone+'/13');
  s('ops-stat-mort', totalMort);   col('ops-stat-mort',  mortHigh.length?'#c0392b':'#4caf50');
  s('ops-stat-temp', tempFlags.length); col('ops-stat-temp',tempFlags.length?'#d69e2e':'#4caf50');
  s('ops-stat-psi',  psiFlags.length);  col('ops-stat-psi', psiFlags.length?'#d69e2e':'#4caf50');
  s('ops-stat-wo',   openWOs.length);   col('ops-stat-wo',  urgentWOs.length?'#c0392b':openWOs.length?'#d69e2e':'#4caf50');
  s('ops-stat-urgent',urgentWOs.length);col('ops-stat-urgent',urgentWOs.length?'#c0392b':'#4caf50');
  // Barn grid
  var bwHtml='';
  [['Hegins',8],['Danville',5]].forEach(function(pair){
    var farm=pair[0],cnt=pair[1];
    bwHtml+='<div style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#7ab07a;text-transform:uppercase;letter-spacing:1px;margin:8px 0 5px">'+farm+'</div>';
    bwHtml+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:4px">';
    for(var i=1;i<=cnt;i++){
      var key=farm+'-'+i; var st=barnSt[key];
      var bg=st&&st.flagged?'#3a0a0a':st&&st.done?'#1a3a1a':'#163016';
      var bc=st&&st.flagged?'#c0392b':st&&st.done?'#4caf50':'#2a5a2a';
      var ic=st&&st.flagged?'!':st&&st.done?'v':'';
      var tc=st&&st.done?'#f0ead8':'#5a8a5a';
      bwHtml+='<div style="background:'+bg+';border:1px solid '+bc+';border-radius:6px;padding:6px 3px;text-align:center">'
        +'<div style="font-size:12px;font-weight:700;color:'+tc+'">'+i+'</div>'
        +'<div style="font-size:10px;color:'+bc+'">'+ic+'</div>'
        +(st&&st.time?'<div style="font-size:8px;color:#5a8a5a">'+st.time+'</div>':'')+'</div>';
    }
    bwHtml+='</div>';
  });
  document.getElementById('ops-barn-grid').innerHTML=bwHtml;
  // Mortality
  var mHtml=!allMort.length?'<div style="color:#5a8a5a;font-size:13px;padding:8px 0">No mortality logged today</div>'
    :allMort.slice().sort(function(a,b){return (a.farm+a.house)>(b.farm+b.house)?1:-1;}).map(function(r){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a5a2a">'
        +'<div><span style="font-size:13px;font-weight:700;color:#f0ead8">'+r.farm+' H'+r.house+'</span>'
        +(r.notes?'<span style="font-size:11px;color:#7ab07a;display:block">'+r.notes+'</span>':'')+'</div>'
        +'<div style="text-align:right"><span style="font-family:IBM Plex Mono,monospace;font-size:18px;font-weight:700;color:'+(r.flagged?'#c0392b':'#4caf50')+'">'+r.count+'</span>'
        +(r.flagged?'<span style="font-size:10px;color:#c0392b;display:block">NOTIFY MANAGER</span>':'')+'</div></div>';
    }).join('');
  document.getElementById('ops-mort-dash').innerHTML=mHtml;
  // Temp flags
  var tHtml=!tempFlags.length?'<div style="color:#4caf50;font-size:13px;padding:8px 0">All temperatures in range</div>'
    :tempFlags.map(function(r){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a5a2a">'
        +'<div><span style="font-size:13px;font-weight:700;color:#f0ead8">'+r.farm+' H'+r.house+'</span>'
        +'<span style="font-size:11px;color:#7ab07a;display:block">'+r.location+'</span></div>'
        +'<span style="font-family:IBM Plex Mono,monospace;font-size:18px;font-weight:700;color:#c0392b">'+r.value+'F</span></div>';
    }).join('');
  document.getElementById('ops-temp-dash').innerHTML=tHtml;
  // PSI flags
  var pHtml=!psiFlags.length?'<div style="color:#4caf50;font-size:13px;padding:8px 0">All water pressure in range</div>'
    :psiFlags.map(function(r){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a5a2a">'
        +'<div><span style="font-size:13px;font-weight:700;color:#f0ead8">'+r.farm+' H'+r.house+'</span>'
        +'<span style="font-size:11px;color:#7ab07a;display:block">'+r.location+'</span></div>'
        +'<span style="font-family:IBM Plex Mono,monospace;font-size:18px;font-weight:700;color:#c0392b">'+r.value+' PSI</span></div>';
    }).join('');
  document.getElementById('ops-psi-dash').innerHTML=pHtml;
  // Open WOs
  var pC={urgent:'#c0392b',high:'#d69e2e',routine:'#4caf50'};
  var wHtml=!openWOs.length?'<div style="color:#4caf50;font-size:13px;padding:8px 0">No open work orders</div>'
    :openWOs.slice(0,12).map(function(w){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a5a2a">'
        +'<div><span style="font-size:13px;font-weight:700;color:#f0ead8">'+w.id+'</span>'
        +'<span style="font-size:11px;color:#7ab07a;display:block">'+w.farm+' - '+w.house+'</span></div>'
        +'<div style="text-align:right"><span style="font-size:11px;font-weight:700;color:'+(pC[w.priority]||'#7ab07a')+'">'+(w.priority||'routine').toUpperCase()+'</span>'
        +'<span style="font-size:10px;color:#5a8a5a;display:block">'+w.problem.slice(0,28)+'</span></div></div>';
    }).join('');
  document.getElementById('ops-wo-dash').innerHTML=wHtml;
}

function opsUpdateLandingCard() {
  var allMort=Object.values(OPS_DATA.mortality||{}).filter(function(r){return r.date===OPS_TODAY;});
  var allTemp=Object.values(OPS_DATA.temp||{}).filter(function(r){return r.date===OPS_TODAY;});
  var allPsi =Object.values(OPS_DATA.psi||{}).filter(function(r){return r.date===OPS_TODAY;});
  var totalMort=allMort.reduce(function(s,r){return s+(r.count||0);},0);
  var tempFlags=allTemp.filter(function(r){return r.flagged;}).length;
  var psiFlags =allPsi.filter(function(r){return r.flagged;}).length;
  var barnsDone=Object.keys(getBarnStatus()).filter(function(k){return getBarnStatus()[k].done;}).length;
  var pct=Math.round((barnsDone/13)*100);
  var ring=document.getElementById('ops-ring');
  if(ring){ring.style.strokeDashoffset=201-(201*pct/100);ring.style.stroke=(psiFlags||tempFlags)?'#d69e2e':'#9b59b6';}
  var e;
  e=document.getElementById('ops-ring-label'); if(e)e.textContent=pct+'%';
  e=document.getElementById('ops-barns-done'); if(e)e.textContent=barnsDone+'/13';
  e=document.getElementById('ops-mort-today'); if(e){e.textContent=totalMort;e.style.color=totalMort>50?'#c0392b':'#f0ead8';}
  e=document.getElementById('ops-temp-flags'); if(e){e.textContent=tempFlags;e.style.color=tempFlags?'#d69e2e':'#4caf50';}
  e=document.getElementById('ops-psi-flags');  if(e){e.textContent=psiFlags; e.style.color=psiFlags?'#d69e2e':'#4caf50';}
}


// ═══════════════════════════════════════════
// WORK INSTRUCTIONS MODULE
// ═══════════════════════════════════════════
let allWI = [];
let wiTypeFilterVal = 'all';
let wiDeptFilterVal = 'all';
let wiSearchVal = '';
let wiStepCount = 0;
let editingWIId = null;
let currentWIId = null;

const WI_TYPE = {
  repair:      { label:'🔧 Repair Procedure',     color:'#3b82f6', bg:'#eff6ff' },
  startup:     { label:'▶️ Startup / Shutdown',    color:'#059669', bg:'#ecfdf5' },
  emergency:   { label:'🚨 Emergency Response',    color:'#e53e3e', bg:'#fde8e6' },
  safety:      { label:'🦺 Safety & PPE',          color:'#d69e2e', bg:'#fff8e1' },
  onboarding:  { label:'🆕 Onboarding',            color:'#9b59b6', bg:'#f5f0ff' },
};

async function loadWI() {
  try {
    const snap = await db.collection('workInstructions').orderBy('ts','desc').get();
    allWI = [];
    snap.forEach(d => allWI.push({...d.data(), _fbId: d.id}));
  } catch(e) {
    console.error('loadWI (ordered) failed, trying unordered fallback:', e);
    try {
      const snap2 = await db.collection('workInstructions').get();
      allWI = [];
      snap2.forEach(d => allWI.push({...d.data(), _fbId: d.id}));
      allWI.sort((a,b) => (b.ts||0) - (a.ts||0));
    } catch(e2) { console.error('loadWI fallback also failed:', e2); }
  }
}

// ── Seed Rushtown Poultry mortality composting instructions ──
async function seedMortalityCompostingWI() {
  const SEED_IDS = ['WI-COMPOST-SETUP', 'WI-COMPOST-OPS', 'WI-COMPOST-TROUBLE'];
  try {
    const check = await db.collection('workInstructions').where('wiId','in', SEED_IDS).get();
    if (!check.empty) return; // already seeded — never run twice
  } catch(e) { return; }

  const today = new Date().toISOString().slice(0,10);
  const author = 'Rushtown Poultry / NRCS';

  const instructions = [
    {
      wiId: 'WI-COMPOST-SETUP',
      title: 'Mortality Composting — Bin Setup & Loading',
      type: 'onboarding',
      system: 'General',
      time: 45,
      author,
      date: today,
      ppe: 'Gloves, rubber boots, N95 mask. Wash hands thoroughly after handling carcasses.',
      warnings: 'NEVER allow carcasses or bones to be exposed above the sawdust — scavengers will dig in and spread disease. Keep 1 ft of cover on all sides and top at all times. Frozen carcasses take much longer to compost — add them as soon as possible in cold weather. DO NOT add too much water — saturated compost becomes anaerobic and produces severe odors.',
      steps: [
        'Place a minimum 1 foot of dry sawdust on the concrete floor of the primary bin before adding any carcasses. Carcasses placed directly on concrete, soil, or gravel WILL NOT compost properly.',
        'Place one layer of dead birds on the sawdust. Use a rake to spread birds flat in a single layer — do not mound. Keep birds at least 6 inches away from all walls so carcasses are not exposed.',
        'Cover the carcasses with a minimum 1 foot of dry sawdust. Use a pointed dowel or rod to measure cover thickness. The 1 ft cover on sides and top eliminates scavengers and minimizes odors.',
        'Small birds (under 20 lbs) can be grouped together in the same layer. Larger birds may need to be recovered individually as sawdust settles around each carcass.',
        'If finished compost is available, use it to cover carcasses before the final sawdust cover — finished compost adds heat and bacteria to jump-start the process.',
        'To add more carcasses after the first layer: hollow out a cavity in the existing compost, place birds one layer thick, cover with minimum 1 ft of sawdust. Maintain 1/2 to 1 ft between carcasses to prevent a large anaerobic mass.',
        'Add water only when needed to keep the mixture damp (like a damp sponge — 40 to 60% moisture). DO NOT over-water. Less water is needed as the batch approaches maturity.',
        'When the last layer of birds is added to a bin, cap the pile with a double layer of dry sawdust or litter. This insulates the pile and deters scavenging animals.',
        'Keep fresh sawdust as dry as possible — 40 to 50% moisture is ideal. Store sawdust in a covered area away from rain.',
        'Keep the area around all bins mowed and free of tall weeds and brush. Watch for leaching at the base — sawdust foundation in primary bins helps prevent it.',
        'Plan to fill each bin in approximately 5 days. Rotate bins on schedule — do not overfill a single bin.',
      ],
      ts: Date.now() - 3000
    },
    {
      wiId: 'WI-COMPOST-OPS',
      title: 'Mortality Composting — Primary & Secondary Stage Operation',
      type: 'repair',
      system: 'General',
      time: 30,
      author,
      date: today,
      ppe: 'Gloves, rubber boots, N95 mask when turning compost. Eye protection when using a loader.',
      warnings: 'Target temperature is 130–160°F. If temps do NOT reach 130°F, the compost has not achieved pathogen kill and must be incorporated into the soil immediately upon land application. If temps EXCEED 160°F, remove compost from the bin immediately, spread no deeper than 6 inches away from all buildings, and saturate with water to prevent spontaneous combustion.',
      steps: [
        'Monitor compost temperature daily using a 36-inch probe-type thermometer with a rigid protective cover. Temperatures should peak at 130 to 140°F within 5 to 7 days. This is the primary confirmation of pathogen kill.',
        'Primary stage composting time depends on carcass size. For standard chickens (~5 lbs): 10 days primary. Group similar-sized carcasses in the same bin whenever possible to keep stage timing consistent.',
        'After the primary stage time has elapsed (measured from adding the last bird), turn the entire bin contents into the secondary bin. This aerates the material, revives bacteria, and allows the pile to reheat. Temperature should rise and peak again within about 7 days.',
        'Secondary stage for chickens: approximately 10 days. For larger animals, secondary stage is roughly 1/3 of the primary stage time. See the carcass size reference table.',
        'Monitor moisture and temperature during the secondary stage using the same standards as primary. Protect the secondary composter from rain and surface runoff.',
        'After secondary stage is complete, finished compost should be dark, humus-like material with very little odor. Remaining bones should be soft and easily crumbled. If not, reintroduce them to the primary bin.',
        'Store finished compost at least 30 days before land application. Do not store in piles deeper than 7 feet — this reduces the risk of spontaneous combustion. Do not store compost in contact with raw manure.',
        'Recycle finished compost as a starter material over new carcasses in the primary bin — up to 50% of the sawdust requirement can be replaced with recycled finished compost. Always maintain at least 50% actual dry sawdust.',
        'Apply finished compost per your Waste Utilization Plan. Estimated nutrient content of Rushtown Poultry compost: Total Nitrogen 40 lbs/ton, Organic Nitrogen 28 lbs/ton, Phosphorus 20 lbs/ton, Potassium 25 lbs/ton. Always base application rates on a current soil test.',
        'Keep daily records during early batches: sawdust added, bird weight, and compost temperature. Discontinue when consistent results are achieved.',
        'Inspect all compost structures at least twice annually when bins are empty. Replace worn hardware, patch concrete floors and curbs, and check roof structures for leaks.',
      ],
      ts: Date.now() - 2000
    },
    {
      wiId: 'WI-COMPOST-TROUBLE',
      title: 'Mortality Composting — Troubleshooting & Common Problems',
      type: 'emergency',
      system: 'General',
      time: 20,
      author,
      date: today,
      ppe: 'Gloves and rubber boots when handling compost. N95 mask if odors are present.',
      warnings: 'A wet, anaerobic compost pile can produce hydrogen sulfide gas — do not lean directly over an actively odorous pile. If leaching is observed at the base of any bin, address immediately — leaching is an environmental compliance issue. Contact your farm manager and NRCS if leaching persists.',
      steps: [
        'PROBLEM — Compost not heating up: Most common cause is too much water (anaerobic) or too little sawdust (insufficient carbon). FIX: Turn the pile to aerate it, add DRY sawdust, and verify moisture. The pile should feel like a damp sponge — not dripping wet.',
        'PROBLEM — Compost producing odors: Caused by anaerobic conditions — pile is too wet, too dense, or birds were not properly layered between carbon material. FIX: Turn the compost immediately and add dry sawdust. Ensure all carcasses are fully buried with minimum 1 ft cover.',
        'PROBLEM — Seepage or leaching at the base of the bin: Pile is oversaturated. FIX: Stop adding water. Turn the pile and add dry sawdust or dry litter. Monitor the base for continued leaching and address drainage around the structure.',
        'PROBLEM — Temperature not reaching 130°F: Could be insufficient mass, incorrect moisture, or cold weather. FIX: During cold weather, incorporate fresh mortalities into the warmest part of an active pile immediately. Frozen carcasses delay heat generation significantly.',
        'PROBLEM — Temperature exceeding 160°F: Risk of spontaneous combustion. FIX: Remove compost from bin immediately. Spread no deeper than 6 inches in an area well away from all buildings. Saturate thoroughly with water. Do not leave deep unattended piles.',
        'PROBLEM — Animals digging into compost bins: Exposed carcasses attract scavengers repeatedly — once they find a source they return. FIX: Immediately cover all exposed material with minimum 1 ft of sawdust. Inspect all bins daily for exposed material. This is both a biosecurity and public perception issue.',
        'PROBLEM — Compost too dry or dusty: Decomposition rate is greatly reduced when too dry. FIX: Add water carefully in small amounts — target 40 to 60% moisture (damp sponge feel). Never flood the pile.',
        'PROBLEM — Compost not breaking down after secondary stage: Soft resistant parts like small bones can be reintroduced to the primary bin. Hard teeth are normal and acceptable in finished compost.',
        'PROBLEM — Improperly mixed or incomplete compost: Can be corrected by turning and remixing. Add dry manure or straw to too-wet compost. Add water to dusty-dry compost. A little experience and perseverance usually give good results.',
        'GENERAL RULE — When in doubt, turn the pile and add dry sawdust. Turning aerates the mixture, revives bacteria, and is the single most effective corrective action for nearly every composting problem.',
        'Contact NRCS with any questions about operation, temperature records, or compliance requirements.',
      ],
      ts: Date.now() - 1000
    }
  ];

  try {
    for (const wi of instructions) {
      await db.collection('workInstructions').add(wi);
    }
    console.log('✅ Rushtown Poultry mortality composting instructions seeded.');
  } catch(e) {
    console.error('Seed error:', e);
  }
}

async function seedWaterRegulatorWI() {
  const SEED_ID = 'WI-WATER-REG-H5-8';
  try {
    const check = await db.collection('workInstructions').where('wiId','==', SEED_ID).get();
    if (!check.empty) return;
  } catch(e) { return; }

  const today = new Date().toISOString().slice(0,10);
  await db.collection('workInstructions').add({
    wiId: SEED_ID,
    title: 'Water Regulator Replacement — Houses 5–8',
    dept: 'Maintenance',
    type: 'repair',
    system: 'Watering System',
    time: 30,
    author: 'Rushtown Poultry',
    date: today,
    ppe: 'Safety glasses, work gloves',
    warnings: 'Ensure water is fully shut off before disassembly. Avoid overtightening connections to prevent damage.',
    steps: [
      'Shut Off Water Supply — Turn off the water valve located on top of the water regulator.',
      'Remove Sight Tube — Carefully remove the sight tube from the regulator and set it aside in a safe location.',
      'Disconnect Unions — Loosen and disconnect both unions that connect to the water nipples in the cages.',
      'Remove Pipes from Regulator — Twist the pipes counterclockwise to remove them from the regulator once all couplers are disconnected.',
      'Install Pipes into New Regulator — Insert the pipes into the new water regulator and twist clockwise until the locking tab is fully engaged.',
      'Reinstall Regulator — Place the new regulator back into position. Reconnect all unions securely. Reinstall the sight tube.',
      'Restore Water Supply — Turn the water supply back on.',
      'Adjust Regulator — Turn the red adjustment knob located at the bottom of the regulator. Adjust until the red ball in the sight tube reaches approximately ¾ of the way up.',
      'Verification — Check for leaks at all connections. Confirm proper water flow and regulator function.',
    ],
    ts: Date.now()
  });
  console.log('✅ Water Regulator WI seeded.');
}

async function seedAugerRollerWI() {
  const SEED_ID = 'WI-AUGER-ROLLER-CLEAN-REPLACE';
  try {
    const check = await db.collection('workInstructions').where('wiId','==', SEED_ID).get();
    if (!check.empty) return;
  } catch(e) { return; }

  const today = new Date().toISOString().slice(0,10);
  await db.collection('workInstructions').add({
    wiId: SEED_ID,
    title: 'Auger Roller — Cleaning, Replacement & Preventive Maintenance',
    dept: 'Maintenance',
    type: 'repair',
    system: 'Manure Belt',
    time: 90,
    author: 'Rushtown Poultry',
    date: today,
    ppe: 'Safety glasses, work gloves. Follow Lockout/Tagout (LOTO) at all times. Use proper lifting techniques and secured rigging when handling the roller.',
    warnings: 'Verify zero energy before starting work — attempt to start equipment to confirm it will NOT operate after lockout. Uneven belt tension causes tracking issues and premature wear. Always recheck hardware tightness after initial run.',
    tools: '19mm deep well socket, impact driver, 10mm wrench, emery cloth, anti-seize compound, crowbar, hammer, tape measure, (2) chain come-alongs, (2) chains',
    steps: [
      'LOCKOUT & VERIFICATION — Lock out the manure belt at the back of the house. Attempt to start the equipment to confirm it will not operate.',
      'RECORD BELT ADJUSTMENT — Measure and record the distance between the all-thread adjusters. This ensures proper belt tension can be restored after reassembly.',
      'LOOSEN BELT — Fully loosen the belt using a 19mm deep well socket and impact driver.',
      'REMOVE TROUGH — Remove the trough from the side using a 10mm wrench.',
      'SET UP ROLLER SUPPORT — Attach chains to the cross member above the belt. Connect chain come-alongs to both sides of the roller.',
      'REMOVE ROLLER FASTENERS — Secure the roller with the come-alongs. Remove bolts from the tail roller using a 19mm socket and impact driver.',
      'LOWER ROLLER — Slowly lower the roller using the chain hoists. Once fully lowered, remove the roller and place it on the ground.',
      'CLEANING & INSPECTION — Clean out auger flights thoroughly. Partially remove the shaft, clean shaft ends with emery cloth, and apply anti-seize to both ends.',
      'REPLACEMENT (if applicable) — Prepare the new auger roller: ensure new bushings and shaft are properly installed before reinstallation.',
      'REINSTALLATION — Slide the auger roller back into the manure belt. Hoist the roller into position using the come-alongs. Install and tighten all mounting bolts securely.',
      'REASSEMBLE COMPONENTS — Reinstall the trough on both sides.',
      'RESTORE BELT TENSION — Tighten the belt back to the original recorded measurements from Step 2.',
      'STARTUP & TESTING — Notify affected employees before startup. Remove lockout and start the manure belt.',
      'FINAL CHECKS — Check belt tracking on the auger roller. Verify belt tension and adjust if necessary. Ensure both sides are equal or within 1/8 inch.',
      'COMPLETION — Once proper operation is confirmed, release the system back to service. Log completion in the work order system.',
    ],
    ts: Date.now()
  });
  console.log('✅ Auger Roller WI seeded.');
}

async function seedCounterCardWI() {
  const SEED_ID = 'WI-COUNTER-CARD-H5-8-PMSI';
  try {
    const check = await db.collection('workInstructions').where('wiId','==', SEED_ID).get();
    if (!check.empty) return;
  } catch(e) { return; }

  const today = new Date().toISOString().slice(0,10);
  await db.collection('workInstructions').add({
    wiId: SEED_ID,
    title: 'Counter Card Reset — Houses 5–8 (PMSI Controls)',
    dept: 'Maintenance',
    farm: 'Hegins',
    type: 'repair',
    system: 'Egg Collectors',
    time: 15,
    author: 'Adam',
    date: today,
    purpose: 'Resetting the counter card after replacement if the card is still not counting correctly. This step is crucial in helping further diagnose counter issues.',
    tools: '#2 Phillips head screwdriver (×1), Small flat head screwdriver / Tweeker (×1)',
    ppe: '',
    warnings: 'Power down the card before cycling dip switches to avoid incorrect address settings.',
    steps: [
      'POWER DOWN — Pull the power block out of the card. The power block is located at the top center of the card.',
      'CYCLE DIP SWITCHES — Cycle dip switches 1, 4, 5, 6, 7, and 8 from ON to OFF three times, ending in the OFF position. These switches are located on the right side of the card.',
      'SET DIP SWITCHES FROM OLD CARD — Using the old card (removed from the box), set the dip switches on the new card to match the old card exactly. This sets the correct address for that card and row.',
      'RESTORE POWER — Plug the power block back into the card and check for proper egg counting.',
      'VERIFY OR ESCALATE — If everything is working correctly, close everything up — job complete. If issues persist, notify supervisor to proceed with further diagnosing from PMSI controls.',
    ],
    verification: 'The egg counter on the REF screen in the head packer\'s office should show eggs being counted and not display in red. Alternatively, verify on the CIII command screen located in the corridor between House 5 and House 6.',
    ts: Date.now()
  });
  console.log('✅ Counter Card Reset WI seeded.');
}

// ── Seed Rushtown Operations WIs ──────────────────────────────────────────────
async function seedRushtownOpsWI() {
  const SEED_IDS = [
    'WI-BARNWALK-DAILY','WI-WO-CREATE','WI-EGG-JAM',
    'WI-WATER-FILTER','WI-FAN-BELT','WI-SHIFT-HANDOFF',
    'WI-5S-CLOSEOUT','WI-PM-COMPLETE','WI-EMERGENCY-BREAKDOWN','WI-WEEKLY-REVIEW',
    'WI-HEAD-ROLLER','WI-DRIVE-ROLLER','WI-GEARBOX-OIL',
    'WI-CHAIN-SPROCKET','WI-BELT-FLIP','WI-FROZEN-BELT',
    'WI-PIT-BELT-CHANGEOUT','WI-ORANGE-BELT-PM','WI-MANURE-CLEANOUT',
    'WI-MANURE-WEEKLY-PM','WI-ROD-CONV-INSPECT','WI-EGG-JAM-PROD',
    'WI-CONV-SPEED-ADJ','WI-BROKEN-ROD','WI-CONV-CHAIN-TENSION',
    'WI-EGG-FLOW-AUDIT','WI-FAN-BELT-VENT','WI-BLOWER-MOTOR',
    'WI-TEMP-SENSOR','WI-VENT-DOOR-CABLE','WI-FAN-BEARING-GREASE',
    'WI-HOT-HOUSE','WI-WATER-PRESSURE','WI-FILTER-CHANGE',
    'WI-IRON-FLUSH','WI-WATER-LEAK','WI-FEED-AUGER'
  ];
  try {
    const check = await db.collection('workInstructions').where('wiId','in',SEED_IDS).get();
    if (!check.empty) return; // already seeded
  } catch(e) { return; }

  const today = new Date().toISOString().slice(0,10);
  const author = 'Rushtown Poultry';
  const base = Date.now();

  const instructions = [
    {
      wiId: 'WI-BARNWALK-DAILY',
      title: 'Daily Barn Walk Standard',
      type: 'onboarding',
      dept: 'Barn / Layer',
      system: 'General',
      time: 20,
      author,
      date: today,
      ppe: '',
      warnings: 'Identify issues before production loss.',
      steps: [
        'Walk barn front to back.',
        'Check feed lines are running.',
        'Check water pressure.',
        'Inspect fans and airflow.',
        'Observe bird behavior.',
        'Look for leaks.',
        'Look for broken equipment.',
        'Enter any issues into the app.'
      ],
      ts: base - 9000
    },
    {
      wiId: 'WI-WO-CREATE',
      title: 'Work Order Creation',
      type: 'onboarding',
      dept: 'Maintenance',
      system: 'General',
      time: 5,
      author,
      date: today,
      ppe: '',
      warnings: 'Rule: One issue = one WO. Do not combine multiple problems into one work order.',
      steps: [
        'Select the barn or area.',
        'Choose priority: Emergency / Planned / PM.',
        'Enter the exact issue description.',
        'Add a photo if possible.',
        'Assign an owner.',
        'Submit the work order.'
      ],
      ts: base - 8000
    },
    {
      wiId: 'WI-EGG-JAM',
      title: 'Conveyor Egg Jam Removal',
      type: 'safety',
      dept: 'Egg Ops',
      system: 'Egg Collectors',
      time: 15,
      author,
      date: today,
      ppe: 'Gloves required.',
      warnings: 'STOP line before reaching in. Never clear a jam while the belt is moving.',
      steps: [
        'Hit the stop button on the conveyor.',
        'Identify the source of the jam.',
        'Remove broken eggs and debris.',
        'Check rod alignment.',
        'Restart the line slowly.',
        'Monitor egg flow for 2 minutes.'
      ],
      ts: base - 7000
    },
    {
      wiId: 'WI-WATER-FILTER',
      title: 'Water Filter Change',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Water',
      time: 20,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Isolate and relieve pressure before removing filter housing.',
      steps: [
        'Isolate the water supply valve.',
        'Relieve pressure from the line.',
        'Remove the used filter.',
        'Clean the filter housing.',
        'Install the new filter.',
        'Restore water slowly.',
        'Check all connections for leaks.',
        'Record the date of change in the app.'
      ],
      ts: base - 6000
    },
    {
      wiId: 'WI-FAN-BELT',
      title: 'Fan Belt Replacement',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Ventilation',
      time: 30,
      author,
      date: today,
      ppe: 'Safety glasses, gloves.',
      warnings: 'LOCKOUT power before removing guard. Verify zero energy before touching belt.',
      steps: [
        'Lockout / tagout power to the fan.',
        'Remove the belt guard.',
        'Loosen the motor mount bolts.',
        'Remove the old belt.',
        'Install the new belt.',
        'Set proper belt tension.',
        'Align pulleys visually.',
        'Replace the belt guard.',
        'Restore power and test run.'
      ],
      ts: base - 5000
    },
    {
      wiId: 'WI-SHIFT-HANDOFF',
      title: 'Shift Handoff',
      type: 'onboarding',
      dept: 'Maintenance',
      system: 'General',
      time: 10,
      author,
      date: today,
      ppe: '',
      warnings: 'Do not leave without completing handoff — open breakdowns must be communicated.',
      steps: [
        'List all completed jobs from the shift.',
        'List all open breakdowns still in progress.',
        'Note any parts that are needed.',
        'Identify priorities for the next shift.',
        'Communicate any safety concerns.'
      ],
      ts: base - 4000
    },
    {
      wiId: 'WI-5S-CLOSEOUT',
      title: '5S Shop Closeout',
      type: 'onboarding',
      dept: 'Maintenance',
      system: 'General',
      time: 10,
      author,
      date: today,
      ppe: '',
      warnings: 'Complete every step — do not leave shop until checklist is done.',
      steps: [
        'Return all tools to their designated locations.',
        'Throw away trash and waste.',
        'Sweep the floor.',
        'Put all parts and materials away.',
        'Charge all battery-powered tools.',
        'Reset shop for the next shift.'
      ],
      ts: base - 3000
    },
    {
      wiId: 'WI-PM-COMPLETE',
      title: 'PM Completion',
      type: 'startup',
      dept: 'Maintenance',
      system: 'General',
      time: 15,
      author,
      date: today,
      ppe: '',
      warnings: 'Do not close a PM without performing all checks.',
      steps: [
        'Open the PM task in the app.',
        'Perform all required checks per the PM schedule.',
        'Replace any worn parts found during inspection.',
        'Add notes describing what was done and any findings.',
        'Close the PM task in the app.'
      ],
      ts: base - 2000
    },
    {
      wiId: 'WI-EMERGENCY-BREAKDOWN',
      title: 'Emergency Breakdown Response',
      type: 'emergency',
      dept: 'Maintenance',
      system: 'General',
      time: 20,
      author,
      date: today,
      ppe: 'PPE appropriate to the equipment.',
      warnings: 'Make area safe FIRST before any diagnosis or repair.',
      steps: [
        'Make the area safe — lockout / isolate energy as needed.',
        'Notify production supervisor immediately.',
        'Diagnose root cause of failure.',
        'Perform repair.',
        'Test run to confirm fix.',
        'Document downtime minutes in the app.'
      ],
      ts: base - 1000
    },
    {
      wiId: 'WI-WEEKLY-REVIEW',
      title: 'Weekly Open Project Review',
      type: 'startup',
      dept: 'Maintenance',
      system: 'General',
      time: 20,
      author,
      date: today,
      ppe: '',
      warnings: 'Every open WO must be reviewed — nothing stays invisible.',
      steps: [
        'Pull up all open work orders in the app.',
        'Sort by production impact.',
        'Assign deadlines to each open job.',
        'Identify any parts blockers preventing completion.',
        'Set the must-fix list for this week.'
      ],
      ts: base
    },
    {
      wiId: 'WI-HEAD-ROLLER',
      title: 'Head Roller Replacement',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Manure',
      time: 90,
      author,
      date: today,
      ppe: 'Lockout/tagout, gloves, safety glasses. Pinch-point caution.',
      warnings: 'Lockout power before any work. Mark all alignment points before disassembly. Pass Check: smooth rotation, centered belt, no vibration.',
      steps: [
        'Lockout power source.',
        'Remove belt tension if needed.',
        'Remove guards and covers.',
        'Mark current alignment points on frame.',
        'Remove bearings and shaft hardware.',
        'Pull damaged roller out safely.',
        'Install new roller in position.',
        'Reinstall bearings and hardware.',
        'Align roller square to frame using marks.',
        'Re-tension belt.',
        'Test run and verify belt tracks centered.'
      ],
      ts: base + 1000
    },
    {
      wiId: 'WI-DRIVE-ROLLER',
      title: 'Drive Roller Replacement',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Manure',
      time: 60,
      author,
      date: today,
      ppe: 'Lockout/tagout, gloves.',
      warnings: 'Lockout before removing chain or coupling. Inspect shaft and bearings during replacement.',
      steps: [
        'Lockout power source.',
        'Remove chain or coupling from drive roller.',
        'Release belt tension.',
        'Remove old roller.',
        'Inspect shaft and bearings for wear — replace if needed.',
        'Install new roller.',
        'Reconnect drive chain or coupling.',
        'Set correct tension.',
        'Test run under load and observe.'
      ],
      ts: base + 2000
    },
    {
      wiId: 'WI-GEARBOX-OIL',
      title: 'Gearbox Inspection & Oil Check',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Manure',
      time: 15,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Fail triggers: leak present, metal grinding noise, overheating. Do not run a leaking gearbox — tag out and report.',
      steps: [
        'Verify unit is cool and safe to touch.',
        'Check for any oil leaks around seals and housing.',
        'Inspect mounting bolts for tightness.',
        'Check oil level via sight glass or drain plug.',
        'Add approved gearbox oil if level is low.',
        'Listen during operation for grinding or unusual noise.',
        'Record findings in the app.'
      ],
      ts: base + 3000
    },
    {
      wiId: 'WI-CHAIN-SPROCKET',
      title: 'Chain & Sprocket Alignment',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Manure',
      time: 30,
      author,
      date: today,
      ppe: 'Lockout/tagout, gloves.',
      warnings: 'Lockout before any inspection or adjustment. Misaligned chain causes premature wear and chain jumping.',
      steps: [
        'Lockout power source.',
        'Inspect chain slack — should not exceed 1/2 inch deflection.',
        'Inspect sprocket teeth for hooked or worn profile.',
        'Use a straight edge to check sprocket alignment.',
        'Adjust motor or shaft position to align.',
        'Lubricate chain if applicable per maintenance schedule.',
        'Rotate chain by hand through full cycle.',
        'Test run and observe.'
      ],
      ts: base + 4000
    },
    {
      wiId: 'WI-BELT-FLIP',
      title: 'Belt Flip Emergency Recovery',
      type: 'emergency',
      dept: 'Maintenance',
      system: 'Manure',
      time: 30,
      author,
      date: today,
      ppe: 'Lockout/tagout, gloves, boots.',
      warnings: 'STOP equipment immediately — do not run a flipped belt. Escalate if: torn cords, damaged roller, or belt flips repeatedly.',
      steps: [
        'Stop equipment immediately.',
        'Lockout power source.',
        'Identify the flip location and root cause.',
        'Remove any buildup or obstruction causing the flip.',
        'Realign belt manually.',
        'Inspect belt welds and edges for damage.',
        'Restart slowly.',
        'Watch a full belt cycle before returning to normal operation.'
      ],
      ts: base + 5000
    },
    {
      wiId: 'WI-FROZEN-BELT',
      title: 'Frozen Belt Winter Recovery',
      type: 'emergency',
      dept: 'Maintenance',
      system: 'Manure',
      time: 45,
      author,
      date: today,
      ppe: 'Gloves, boots, cold weather PPE.',
      warnings: 'Do NOT hard-start repeatedly — this tears belts and burns motors. Use approved thaw method only.',
      steps: [
        'Do not attempt to hard-start repeatedly.',
        'Inspect frozen points along belt path.',
        'Remove ice and manure buildup manually.',
        'Apply approved thaw method — safe heat source only if allowed.',
        'Check all rollers spin freely by hand.',
        'Jog system slowly — do not full-start until belt moves freely.',
        'Monitor amp draw or motor load if available.',
        'Resume normal operation once confirmed clear.'
      ],
      ts: base + 6000
    },
    {
      wiId: 'WI-PIT-BELT-CHANGEOUT',
      title: 'Pit Belt Changeout Procedure',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Manure',
      time: 120,
      author,
      date: today,
      ppe: 'Lockout/tagout, gloves, boots, N95 mask in pit.',
      warnings: 'Major repair — plan labor and parts in advance. Do not work alone in pit area.',
      steps: [
        'Lockout power and isolate the work area.',
        'Clean access path for safe entry and belt removal.',
        'Remove old belt completely.',
        'Inspect rollers and frame — repair any issues before installing new belt.',
        'Pull new belt into position safely — use proper pulling tools.',
        'Splice or weld belt joint.',
        'Track and tension belt per spec.',
        'Test run empty — verify tracking and tension.',
        'Recheck tracking and tension after first loaded run.'
      ],
      ts: base + 7000
    },
    {
      wiId: 'WI-ORANGE-BELT-PM',
      title: 'Orange Transfer Belt PM',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Manure',
      time: 20,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Perform weekly. Do not skip — buildup under belt causes overload and fire risk.',
      steps: [
        'Inspect belt surface for cracks, tears, or wear.',
        'Check belt tracking — adjust if off-center.',
        'Inspect gearbox and motor for leaks or noise.',
        'Check scraper and belt cleaners for contact and wear.',
        'Remove buildup beneath the unit.',
        'Tighten any loose hardware.',
        'Run system and observe for one full cycle.'
      ],
      ts: base + 8000
    },
    {
      wiId: 'WI-MANURE-CLEANOUT',
      title: 'Manure Cleanout Under Belts',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Manure',
      time: 30,
      author,
      date: today,
      ppe: 'Gloves, boots, N95 mask. Lockout if entering hazard zone.',
      warnings: 'Prevent drag, odor, overload, and fire. Note any abnormal accumulation — it indicates a belt, scraper, or tracking problem.',
      steps: [
        'Lockout power if entering a hazard zone under the belt.',
        'Remove manure piles from under the return path.',
        'Clear roller pockets and end areas.',
        'Inspect support structure and frame for corrosion.',
        'Bag and dispose of waste properly.',
        'Note any abnormal accumulation and record source in the app.'
      ],
      ts: base + 9000
    },
    {
      wiId: 'WI-MANURE-WEEKLY-PM',
      title: 'Weekly Manure System PM',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Manure',
      time: 45,
      author,
      date: today,
      ppe: 'Gloves, boots.',
      warnings: 'Purpose: reduce emergency breakdowns. Pass Check: running clean, aligned, no abnormal wear.',
      steps: [
        'Inspect all belts for wear, cracks, or tears.',
        'Check tracking on each belt run — adjust if off-center.',
        'Inspect all rollers turning freely.',
        'Check chains and sprockets for wear and slack.',
        'Tighten any loose hardware.',
        'Remove buildup under the system.',
        'Check motor and gearbox condition — leaks, noise, heat.',
        'Record any issues found for planned repair.'
      ],
      ts: base + 10000
    },
    {
      wiId: 'WI-ROD-CONV-INSPECT',
      title: 'Lubing Rod Conveyor Daily Inspection',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Egg Collectors',
      time: 15,
      author,
      date: today,
      ppe: '',
      warnings: 'Report any issues found — do not run a damaged rod conveyor.',
      steps: [
        'Walk the full conveyor path from end to end.',
        'Check rod movement for smoothness — no hesitation or jerking.',
        'Look for bent or missing rods.',
        'Check chain tension.',
        'Inspect egg buildup points along the path.',
        'Listen for clicking or grinding sounds.',
        'Verify all guards are in place.',
        'Report any issues found in the app.'
      ],
      ts: base + 11000
    },
    {
      wiId: 'WI-EGG-JAM-PROD',
      title: 'Egg Jam Removal Procedure',
      type: 'repair',
      dept: 'Egg Ops',
      system: 'Egg Collectors',
      time: 15,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Production critical — act immediately. Never reach into a moving conveyor.',
      steps: [
        'Stop the conveyor safely.',
        'Locate the jam source.',
        'Remove broken eggs and debris.',
        'Inspect rods and guides for damage.',
        'Check egg flow upstream for cause.',
        'Restart conveyor slowly.',
        'Watch the first 5 minutes of operation.'
      ],
      ts: base + 12000
    },
    {
      wiId: 'WI-CONV-SPEED-ADJ',
      title: 'Conveyor Speed Adjustment',
      type: 'repair',
      dept: 'Egg Ops',
      system: 'Egg Collectors',
      time: 10,
      author,
      date: today,
      ppe: '',
      warnings: 'Small adjustments only — large speed changes cause pileups or gaps. Purpose: improve egg flow and reduce pileups.',
      steps: [
        'Identify whether issue is too fast or too slow.',
        'Check current speed setting on controller or drive.',
        'Adjust controller or drive per standard setting.',
        'Restart and monitor egg flow.',
        'Confirm no buildup at transition points.',
        'Record final setting in the app.'
      ],
      ts: base + 13000
    },
    {
      wiId: 'WI-BROKEN-ROD',
      title: 'Broken Rod Replacement',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Egg Collectors',
      time: 20,
      author,
      date: today,
      ppe: 'Lockout/tagout, gloves.',
      warnings: 'Lockout before accessing conveyor. Verify rod spacing and alignment after installation.',
      steps: [
        'Lockout power to the conveyor.',
        'Locate the damaged rod.',
        'Remove retaining hardware on both ends.',
        'Remove the broken rod.',
        'Install replacement rod.',
        'Verify rod spacing and alignment with adjacent rods.',
        'Rotate chain manually through full cycle.',
        'Restore power and restart system.'
      ],
      ts: base + 14000
    },
    {
      wiId: 'WI-CONV-CHAIN-TENSION',
      title: 'Conveyor Chain Tensioning',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Egg Collectors',
      time: 20,
      author,
      date: today,
      ppe: 'Lockout/tagout, gloves.',
      warnings: 'Lockout before adjustment. Purpose: prevent chain jumping and premature wear.',
      steps: [
        'Lockout power to the conveyor.',
        'Inspect chain slack — should not sag excessively.',
        'Adjust take-up evenly on both sides.',
        'Verify sprocket alignment with a straight edge.',
        'Rotate chain manually through full cycle.',
        'Lubricate chain if applicable per schedule.',
        'Test run and observe.'
      ],
      ts: base + 15000
    },
    {
      wiId: 'WI-EGG-FLOW-AUDIT',
      title: 'Egg Flow Alignment Audit',
      type: 'startup',
      dept: 'Egg Ops',
      system: 'Egg Collectors',
      time: 20,
      author,
      date: today,
      ppe: '',
      warnings: 'Perform weekly. Escalate any structural redesign needs — do not attempt major guide modifications without approval.',
      steps: [
        'Observe eggs entering the line at each barn.',
        'Identify any crowding or pileup points.',
        'Check guide rails and guide plates for position and wear.',
        'Inspect transition heights between conveyor sections.',
        'Look for cracked eggs indicating impact or drop problems.',
        'Make minor guide corrections as needed.',
        'Escalate any redesign needs to supervisor.'
      ],
      ts: base + 16000
    },
    {
      wiId: 'WI-FAN-BELT-VENT',
      title: 'Ventilation Fan Belt Replacement',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Ventilation',
      time: 30,
      author,
      date: today,
      ppe: 'Lockout/tagout, safety glasses, gloves.',
      warnings: 'Lockout power before removing guard. Verify zero energy before touching belt.',
      steps: [
        'Lockout power to the fan.',
        'Remove the belt guard.',
        'Loosen the motor mount bolts.',
        'Remove the old belt.',
        'Install the new belt.',
        'Set correct belt tension.',
        'Align pulleys visually.',
        'Replace the belt guard.',
        'Restore power and test run.'
      ],
      ts: base + 17000
    },
    {
      wiId: 'WI-BLOWER-MOTOR',
      title: 'Blower Motor Changeout',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Ventilation',
      time: 90,
      author,
      date: today,
      ppe: 'Lockout/tagout, gloves, safety glasses. Skilled repair.',
      warnings: 'Verify zero energy before disconnecting wiring. Label all leads before removal. Confirm correct rotation direction before final run check.',
      steps: [
        'Lockout power and verify zero energy at the motor.',
        'Disconnect wiring and label all leads.',
        'Remove belt or coupling from motor shaft.',
        'Support motor weight with proper lifting equipment.',
        'Remove mounting bolts and remove old motor.',
        'Install new motor in position.',
        'Align shaft and pulleys.',
        'Reconnect wiring per labeled leads.',
        'Test amp draw and verify correct rotation direction.',
        'Perform final run check — no excessive heat, noise, or vibration.'
      ],
      ts: base + 18000
    },
    {
      wiId: 'WI-TEMP-SENSOR',
      title: 'House Temperature Sensor Check',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Ventilation',
      time: 15,
      author,
      date: today,
      ppe: '',
      warnings: 'Pass Check: reading within acceptable tolerance. Report any large variance immediately — incorrect readings cause incorrect ventilation.',
      steps: [
        'Bring a calibrated reference thermometer.',
        'Compare controller reading vs actual measured temperature.',
        'Check sensor location for drafts, fan wash, or direct sunlight exposure.',
        'Inspect sensor wiring and mounting.',
        'Clean any dust buildup from sensor.',
        'Adjust or calibrate if the control system allows.',
        'Report any large variance to supervisor.'
      ],
      ts: base + 19000
    },
    {
      wiId: 'WI-VENT-DOOR-CABLE',
      title: 'Vent Door Cable Adjustment',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Ventilation',
      time: 30,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Lockout controller if required. Purpose: maintain even airflow and proper vent opening.',
      steps: [
        'Lockout the vent controller if required.',
        'Inspect cable for fraying or slipping.',
        'Cycle vents open and closed manually.',
        'Identify any uneven doors.',
        'Adjust cable tension equally on all doors.',
        'Tighten clamps and set screws.',
        'Recycle the system and verify smooth even movement.'
      ],
      ts: base + 20000
    },
    {
      wiId: 'WI-FAN-BEARING-GREASE',
      title: 'Fan Bearing Grease PM',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Ventilation',
      time: 15,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Do NOT over-grease — over-greasing damages seals. Fail trigger: heat, noise, or looseness in bearing.',
      steps: [
        'Lockout fan if required for safe access.',
        'Clean grease fitting before applying grease.',
        'Add correct grease type slowly — follow OEM spec.',
        'Do not over-grease.',
        'Spin shaft manually if accessible and check for smooth rotation.',
        'Check for noise or play in bearing.',
        'Wipe excess grease from fitting and housing.'
      ],
      ts: base + 21000
    },
    {
      wiId: 'WI-HOT-HOUSE',
      title: 'Emergency Hot House Response',
      type: 'emergency',
      dept: 'Maintenance',
      system: 'Ventilation',
      time: 30,
      author,
      date: today,
      ppe: 'Appropriate PPE for electrical and hot environment.',
      warnings: 'CRITICAL — bird losses begin quickly in overheated houses. Do not leave until temperature is stable.',
      steps: [
        'Notify management immediately.',
        'Confirm actual house temperature with a physical thermometer.',
        'Check power supply and breakers.',
        'Verify all fans are operating.',
        'Open emergency ventilation if available.',
        'Inspect controller and sensor for faults.',
        'Bring portable ventilation support if available.',
        'Stay on-site until house temperature is stable.',
        'Document cause and corrective action in the app.'
      ],
      ts: base + 22000
    },
    {
      wiId: 'WI-WATER-PRESSURE',
      title: 'Water Pressure Check',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Water',
      time: 15,
      author,
      date: today,
      ppe: '',
      warnings: 'Ensure birds receive proper water flow. Record and escalate any abnormal zones.',
      steps: [
        'Read pressure gauge at the regulator.',
        'Compare reading to target standard for the area.',
        'Walk water lines looking for weak flow signs.',
        'Check regulator and filter condition.',
        'Flush the line if sediment or buildup is suspected.',
        'Record any abnormal zones.',
        'Correct or escalate as needed.'
      ],
      ts: base + 23000
    },
    {
      wiId: 'WI-FILTER-CHANGE',
      title: 'Water Filter Change Procedure',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Water',
      time: 20,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Isolate and relieve pressure before removing filter housing.',
      steps: [
        'Isolate the water source valve.',
        'Relieve pressure from the line.',
        'Remove the old filter.',
        'Inspect housing and seals for wear or damage.',
        'Clean the housing.',
        'Install the new filter.',
        'Restore water flow slowly.',
        'Check all connections for leaks.',
        'Log the date and filter change in the app.'
      ],
      ts: base + 24000
    },
    {
      wiId: 'WI-IRON-FLUSH',
      title: 'Iron / Dirt Flush Procedure',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Water',
      time: 20,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Purpose: remove contamination causing nipple clogs and poor flow. Record recurring problem areas.',
      steps: [
        'Identify the affected line or zone.',
        'Open flush points at the end of the line.',
        'Run water until it runs clear.',
        'Inspect sediment level coming out.',
        'Check upstream filter condition.',
        'Restore normal operation and close flush points.',
        'Record any recurring problem areas in the app.'
      ],
      ts: base + 25000
    },
    {
      wiId: 'WI-WATER-LEAK',
      title: 'Water Leak Repair',
      type: 'repair',
      dept: 'Maintenance',
      system: 'Water',
      time: 30,
      author,
      date: today,
      ppe: 'Gloves.',
      warnings: 'Priority: medium to high depending on severity. Dry area immediately if slip risk.',
      steps: [
        'Identify the leak source.',
        'Isolate the section if possible.',
        'Replace the faulty fitting, hose, or valve.',
        'Restore pressure slowly.',
        'Check for any secondary leaks nearby.',
        'Dry the area if there is a slip risk.',
        'Log the repair in the app.'
      ],
      ts: base + 26000
    },
    {
      wiId: 'WI-FEED-AUGER',
      title: 'Feed Auger Inspection',
      type: 'startup',
      dept: 'Maintenance',
      system: 'Feed',
      time: 20,
      author,
      date: today,
      ppe: 'Lockout/tagout before opening guards. Gloves.',
      warnings: 'Purpose: prevent feed outages and motor overload. Report any worn flighting immediately.',
      steps: [
        'Lockout power before opening any guards.',
        'Inspect motor and gearbox for leaks or heat.',
        'Listen for binding or unusual noise.',
        'Check flighting for wear or missing sections.',
        'Inspect tube supports and hangers for security.',
        'Verify feed flow is moving freely.',
        'Check boot and bin transition area for blockage.',
        'Report any worn sections in the app.'
      ],
      ts: base + 27000
    }
  ];

  try {
    for (const wi of instructions) {
      await db.collection('workInstructions').add(wi);
    }
    console.log('✅ Rushtown Ops WIs seeded (37 procedures).');
  } catch(e) {
    console.error('seedRushtownOpsWI error:', e);
  }
}

function startWIListener() {
  db.collection('workInstructions').orderBy('ts','desc').onSnapshot(snap => {
    allWI = [];
    snap.forEach(d => allWI.push({...d.data(), _fbId: d.id}));
    if (window._maintSection==='wi') renderWI();
  }, err => {
    console.error('WI listener error:', err);
    // Fallback: load without orderBy (avoids missing-index errors)
    loadWIFallback();
  });
}

async function loadWIFallback() {
  try {
    const snap = await db.collection('workInstructions').get();
    allWI = [];
    snap.forEach(d => allWI.push({...d.data(), _fbId: d.id}));
    allWI.sort((a,b) => (b.ts||0) - (a.ts||0));
    if (window._maintSection==='wi') renderWI();
    console.log('WI fallback load succeeded, count:', allWI.length);
  } catch(e) {
    console.error('WI fallback load also failed:', e);
  }
}

function wiTypeFilter(val, btn) {
  wiTypeFilterVal = val;
  document.querySelectorAll('#wi-type-bar .pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWI();
}

function wiDeptFilter(val, btn) {
  wiDeptFilterVal = val;
  document.querySelectorAll('#wi-dept-bar .pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWI();
}

function wiSearch() {
  wiSearchVal = document.getElementById('wi-search').value.toLowerCase().trim();
  renderWI();
}

function renderWI() {
  // Stats
  const total     = allWI.length;
  const repairs   = allWI.filter(w => w.type === 'repair').length;
  const emergency = allWI.filter(w => w.type === 'emergency').length;
  const safety    = allWI.filter(w => w.type === 'safety').length;
  document.getElementById('wi-stats').innerHTML =
    sc('', total, 'Total Procedures') +
    sc('s-blue', repairs, 'Repair Guides') +
    sc('s-red', emergency, 'Emergency SOPs') +
    sc('s-amber', safety, 'Safety Rules');

  // Filter
  let list = allWI;
  if (wiTypeFilterVal !== 'all') list = list.filter(w => w.type === wiTypeFilterVal);
  if (wiDeptFilterVal !== 'all') list = list.filter(w => (w.dept || w.department || '') === wiDeptFilterVal);
  if (wiSearchVal) {
    list = list.filter(w =>
      (w.title||'').toLowerCase().includes(wiSearchVal) ||
      (w.system||'').toLowerCase().includes(wiSearchVal) ||
      (w.ppe||'').toLowerCase().includes(wiSearchVal) ||
      (w.warnings||'').toLowerCase().includes(wiSearchVal) ||
      (w.steps||[]).some(s => s.toLowerCase().includes(wiSearchVal))
    );
  }

  const container = document.getElementById('wi-list');
  if (!list.length) {
    container.innerHTML = `<div class="empty"><div class="ei">📖</div><p>${wiSearchVal ? 'No instructions match your search.' : 'No work instructions yet — add your first one above.'}</p></div>`;
    return;
  }

  const SYS_ICON_MAP = {Ventilation:'💨',Water:'💧',Feed:'🌾',Manure:'♻️','Egg Collectors':'🥚',Heating:'🔥',Electrical:'⚡',Lubing:'🛢️',Building:'🏚️',General:'🔧'};

  container.innerHTML = list.map(wi => {
    const t = WI_TYPE[wi.type] || WI_TYPE.repair;
    const sysIcon = SYS_ICON_MAP[wi.system] || '';
    const stepCount = (wi.steps||[]).length;
    const timeStr = wi.time ? wi.time + ' min' : '';
    return `<div class="wi-card" onclick="openWIView('${wi.wiId}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px;">
        <span class="wi-type-badge" style="background:${t.bg};color:${t.color};border-color:${t.color}40;">${t.label}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:8px;">
          ${timeStr ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);">⏱ ${timeStr}</span>` : ''}
          ${wi.warnings ? '<span style="font-size:12px;" title="Has warnings">⚠️</span>' : ''}
        </div>
      </div>
      <div class="wi-title">${wi.title}</div>
      <div class="wi-meta">
        ${(wi.dept||wi.department) ? `<span style="background:#e8f4e8;color:#2e7d32;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;margin-right:5px;">🏢 ${wi.dept||wi.department}</span>` : ''}${sysIcon ? sysIcon + ' ' + wi.system + ' · ' : ''}${stepCount} step${stepCount !== 1 ? 's' : ''}${wi.ppe ? ' · 🦺 PPE required' : ''}
      </div>
      <div class="wi-meta" style="margin-top:2px;">By ${wi.author || 'Unknown'} · ${fmtDate(wi.date)}</div>
    </div>`;
  }).join('');
}

// ── Form ──
function openWIForm(wiId) {
  requireAdmin(() => _openWIForm(wiId));
}
function _openWIForm(wiId) {
  editingWIId = wiId || null;
  wiStepCount = 0;
  document.getElementById('wif-steps-list').innerHTML = '';

  if (wiId) {
    const wi = allWI.find(x => x.wiId === wiId);
    if (!wi) return;
    document.getElementById('wi-form-title').textContent = 'Edit Work Instruction';
    document.getElementById('wif-title').value   = wi.title || '';
    document.getElementById('wif-type').value    = wi.type || '';
    document.getElementById('wif-dept').value    = wi.dept || wi.department || '';
    document.getElementById('wif-system').value  = wi.system || '';
    document.getElementById('wif-time').value    = wi.time || '';
    document.getElementById('wif-ppe').value     = wi.ppe || '';
    document.getElementById('wif-warnings').value = wi.warnings || '';
    document.getElementById('wif-author').value  = wi.author || '';
    (wi.steps || []).forEach(step => wiAddStep(step));
  } else {
    document.getElementById('wi-form-title').textContent = 'Add Work Instruction';
    ['wif-title','wif-time','wif-ppe','wif-warnings','wif-author'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('wif-type').value   = '';
    document.getElementById('wif-dept').value   = '';
    document.getElementById('wif-system').value = '';
    wiAddStep(); wiAddStep(); wiAddStep(); // start with 3 blank steps
  }
  document.getElementById('wi-form-modal').classList.add('open');
}

function closeWIForm() {
  document.getElementById('wi-form-modal').classList.remove('open');
  editingWIId = null;
}

function wiAddStep(text) {
  wiStepCount++;
  const idx = wiStepCount;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:7px;';
  row.id = 'wi-step-row-' + idx;
  row.innerHTML = `
    <div style="width:24px;height:24px;min-width:24px;border-radius:50%;background:var(--green-mid);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:8px;">${idx}</div>
    <textarea id="wi-step-${idx}" placeholder="Describe step ${idx}..." style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;min-height:42px;resize:vertical;font-family:'IBM Plex Sans',sans-serif;">${text || ''}</textarea>
    <button type="button" onclick="wiRemoveStep(${idx})" style="margin-top:8px;background:none;border:none;font-size:16px;cursor:pointer;color:#aaa;padding:0 2px;">✕</button>`;
  document.getElementById('wif-steps-list').appendChild(row);
}

function wiRemoveStep(idx) {
  const row = document.getElementById('wi-step-row-' + idx);
  if (row) row.remove();
}

function wiCollectSteps() {
  const steps = [];
  document.querySelectorAll('#wif-steps-list textarea').forEach(ta => {
    const v = ta.value.trim();
    if (v) steps.push(v);
  });
  return steps;
}

async function saveWI() {
  const title    = document.getElementById('wif-title').value.trim();
  const type     = document.getElementById('wif-type').value;
  const dept     = document.getElementById('wif-dept').value;
  const system   = document.getElementById('wif-system').value;
  const time     = document.getElementById('wif-time').value;
  const ppe      = document.getElementById('wif-ppe').value.trim();
  const warnings = document.getElementById('wif-warnings').value.trim();
  const author   = document.getElementById('wif-author').value.trim();
  const steps    = wiCollectSteps();

  if (!title) return alert('Please enter a title.');
  if (!type)  return alert('Please select a type.');
  if (!steps.length) return alert('Please add at least one step.');

  const btn = document.getElementById('wif-save-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;

  try {
    const date = new Date().toISOString().slice(0,10);
    if (editingWIId) {
      const existing = allWI.find(w => w.wiId === editingWIId);
      if (existing && existing._fbId) {
        await db.collection('workInstructions').doc(existing._fbId).update({
          title, type, dept, system, time: parseInt(time)||0, ppe, warnings, author, steps, updatedTs: Date.now()
        });
      }
    } else {
      const wiId = 'WI-' + Date.now().toString(36).toUpperCase();
      await db.collection('workInstructions').add({
        wiId, title, type, dept, system, time: parseInt(time)||0,
        ppe, warnings, author, steps, date, ts: Date.now()
      });
      // activityLog is non-blocking — never let it prevent the WI from saving
      try {
        await db.collection('activityLog').add({
          type:'wi', id: wiId,
          desc: 'Work instruction added: ' + title,
          tech: author || 'Unknown', date: fmtDate(date), ts: Date.now()
        });
      } catch(logErr) { console.warn('activityLog write failed (non-fatal):', logErr); }
    }
    setSyncDot('live');
    closeWIForm();
    // Force re-render so new entry appears immediately
    await loadWIFallback();
  } catch(e) {
    console.error('saveWI error:', e);
    alert('Error saving work instruction: ' + e.message);
  } finally {
    btn.textContent = '✓ SAVE'; btn.disabled = false;
  }
}

// ── View modal ──
function openWIView(wiId) {
  const wi = allWI.find(x => x.wiId === wiId);
  if (!wi) return;
  currentWIId = wiId;
  const t = WI_TYPE[wi.type] || WI_TYPE.repair;
  const SYS_ICON_MAP = {Ventilation:'💨',Water:'💧',Feed:'🌾',Manure:'♻️','Egg Collectors':'🥚',Heating:'🔥',Electrical:'⚡',Lubing:'🛢️',Building:'🏚️',General:'🔧'};

  document.getElementById('wiv-type-badge').innerHTML =
    `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${t.bg};color:${t.color};border:1px solid ${t.color}40;font-family:'IBM Plex Mono',monospace;">${t.label}</span>`;
  document.getElementById('wiv-title').textContent = wi.title;

  const sysIcon = SYS_ICON_MAP[wi.system] || '';
  const metaParts = [];
  if (wi.system) metaParts.push(sysIcon + ' ' + wi.system);
  if (wi.time)   metaParts.push('⏱ ' + wi.time + ' min');
  metaParts.push('By ' + (wi.author || 'Unknown') + ' · ' + fmtDate(wi.date));
  document.getElementById('wiv-meta').textContent = metaParts.join(' · ');

  // PPE strip
  const ppeEl = document.getElementById('wiv-ppe-strip');
  if (wi.ppe) { ppeEl.style.display = ''; document.getElementById('wiv-ppe-text').textContent = wi.ppe; }
  else ppeEl.style.display = 'none';

  // Warnings strip
  const warnEl = document.getElementById('wiv-warn-strip');
  if (wi.warnings) { warnEl.style.display = ''; document.getElementById('wiv-warn-text').textContent = wi.warnings; }
  else warnEl.style.display = 'none';

  // Tools strip
  const toolsEl = document.getElementById('wiv-tools-strip');
  if (toolsEl) {
    if (wi.tools) { toolsEl.style.display = ''; document.getElementById('wiv-tools-text').textContent = wi.tools; }
    else toolsEl.style.display = 'none';
  }

  // Purpose strip
  const purposeEl = document.getElementById('wiv-purpose-strip');
  if (purposeEl) {
    if (wi.purpose) { purposeEl.style.display = ''; document.getElementById('wiv-purpose-text').textContent = wi.purpose; }
    else purposeEl.style.display = 'none';
  }

  // Steps — interactive checklist
  const steps = wi.steps || [];
  document.getElementById('wiv-steps').innerHTML = steps.map((step, i) => `
    <div class="wiv-step" id="wiv-step-${i}" onclick="wiToggleStep(${i})">
      <div class="wiv-step-num" id="wiv-step-num-${i}">${i+1}</div>
      <div class="wiv-step-text" id="wiv-step-text-${i}">${step}</div>
    </div>`).join('');

  // Verification / "What Good Looks Like" strip
  const verifEl = document.getElementById('wiv-verif-strip');
  if (verifEl) {
    if (wi.verification) { verifEl.style.display = ''; document.getElementById('wiv-verif-text').textContent = wi.verification; }
    else verifEl.style.display = 'none';
  }

  document.getElementById('wiv-footer').textContent = `#${wi.wiId} · ${steps.length} steps`;
  document.getElementById('wi-view-modal').classList.add('open');
}

function wiToggleStep(idx) {
  const row  = document.getElementById('wiv-step-' + idx);
  const num  = document.getElementById('wiv-step-num-' + idx);
  const text = document.getElementById('wiv-step-text-' + idx);
  const done = row.classList.toggle('wiv-step-done');
  num.textContent  = done ? '✓' : idx + 1;
  text.style.textDecoration = done ? 'line-through' : '';
  text.style.color = done ? 'var(--muted)' : '';
}

function closeWIView() {
  document.getElementById('wi-view-modal').classList.remove('open');
  currentWIId = null;
}

function wiEditCurrent() {
  requireAdmin(() => { closeWIView(); _openWIForm(currentWIId); });
}

async function wiDeleteCurrent() {
  if (!currentWIId) return;
  const wi = allWI.find(x => x.wiId === currentWIId);
  if (!wi || !wi._fbId) return;
  if (!confirm(`Delete "${wi.title}"? This cannot be undone.`)) return;
  await db.collection('workInstructions').doc(wi._fbId).delete();
  closeWIView();
}

// Close on backdrop
document.getElementById('wi-form-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeWIForm(); });
document.getElementById('wi-view-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeWIView(); });

// ═══════════════════════════════════════════
// ASSET MASTER MODULE
// ═══════════════════════════════════════════
let allAssets = [];
let assetFarmFilter = 'all';
let assetSysFilter  = 'all';
let editingAssetId  = null;
let currentAssetId  = null;
let ahActiveTab     = 'pm';

// ── Load assets from Firebase ──
async function loadAssets() {
  try {
    const snap = await db.collection('assets').orderBy('ts','desc').get();
    allAssets = [];
    snap.forEach(d => allAssets.push({...d.data(), _fbId: d.id}));
  } catch(e) { console.error('loadAssets:', e); }
}

// ── Listen for real-time asset changes ──
function startAssetListener() {
  db.collection('assets').orderBy('ts','desc').onSnapshot(snap => {
    allAssets = [];
    snap.forEach(d => allAssets.push({...d.data(), _fbId: d.id}));
    if (window._maintSection==='assets') renderAssets();
  });
}

// ── Generate asset ID ──
function genAssetId() {
  return 'ASSET-' + Date.now().toString(36).toUpperCase();
}

// ── Filter helpers ──
function assetFarm(val, btn) {
  assetFarmFilter = val;
  document.querySelectorAll('#asset-farm-bar .loc-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAssets();
}
function assetSys(val, btn) {
  assetSysFilter = val;
  document.querySelectorAll('#asset-sys-bar .pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAssets();
}

// ── Render asset list ──
function renderAssets() {
  // Stats
  const total    = allAssets.length;
  const critical = allAssets.filter(a => a.criticality === 'critical').length;
  const high     = allAssets.filter(a => a.criticality === 'high').length;
  const hegins   = allAssets.filter(a => a.farm === 'Hegins').length;
  document.getElementById('asset-stats').innerHTML =
    sc('s-blue', total, 'Total Assets') +
    sc('s-red',  critical, 'Critical') +
    sc('s-amber', high, 'High Criticality') +
    sc('', hegins, 'Hegins / ' + (total - hegins) + ' Danville');

  // Filter
  let list = allAssets;
  if (assetFarmFilter !== 'all') list = list.filter(a => a.farm === assetFarmFilter);
  if (assetSysFilter  !== 'all') list = list.filter(a => a.system === assetSysFilter);

  // Text search — name, assetId, system, farm, house, makeModel
  const searchEl = document.getElementById('asset-search-input');
  const searchVal = searchEl ? searchEl.value.toLowerCase().trim() : '';
  if (searchVal) {
    list = list.filter(a =>
      (a.name||'').toLowerCase().includes(searchVal) ||
      (a.assetId||'').toLowerCase().includes(searchVal) ||
      (a.system||'').toLowerCase().includes(searchVal) ||
      (a.farm||'').toLowerCase().includes(searchVal) ||
      (a.house||'').toLowerCase().includes(searchVal) ||
      (a.makeModel||'').toLowerCase().includes(searchVal) ||
      (a.notes||'').toLowerCase().includes(searchVal)
    );
  }

  const container = document.getElementById('asset-list');
  if (!list.length) {
    container.innerHTML = '<div class="empty"><div class="ei">🏭</div><p>No assets found — add your first asset above.</p></div>';
    return;
  }

  const CRIT_ICON = {critical:'🔴', high:'🟡', medium:'🟢', low:'⚪'};
  const SYS_ICON_MAP = {Ventilation:'💨',Water:'💧',Feed:'🌾',Manure:'♻️','Egg Collectors':'🥚',Heating:'🔥',Electrical:'⚡',Lubing:'🛢️',Building:'🏚️',Other:'📦'};

  container.innerHTML = list.map(a => {
    const icon = SYS_ICON_MAP[a.system] || '📦';
    const critCls = a.criticality || 'medium';
    const critLabel = (CRIT_ICON[a.criticality] || '') + ' ' + (a.criticality || 'medium').charAt(0).toUpperCase() + (a.criticality || 'medium').slice(1);
    const installStr = a.installDate ? 'Installed ' + fmtDate(a.installDate) : 'Install date unknown';
    const linkedPMs = a.linkedPMs ? a.linkedPMs.length : 0;
    const linkedWOs = a.linkedWOs ? a.linkedWOs.length : 0;
    return `<div class="asset-card crit-${critCls}" onclick="openAssetHistory('${a.assetId}')">
      <div>
        <div class="asset-name">${icon} ${a.name}</div>
        <div class="asset-meta">${a.farm} · ${a.house} · ${a.system}</div>
        <div class="asset-meta" style="margin-top:2px;">${a.makeModel ? a.makeModel + ' · ' : ''}${installStr}</div>
        <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap;">
          <span style="font-size:10px;color:var(--muted);font-family:'IBM Plex Mono',monospace;">🔩 ${linkedPMs} PMs linked</span>
          <span style="font-size:10px;color:var(--muted);font-family:'IBM Plex Mono',monospace;">🔧 ${linkedWOs} WOs linked</span>
          <span style="font-size:10px;color:#777;font-family:'IBM Plex Mono',monospace;">#${a.assetId}</span>
        </div>
      </div>
      <div class="asset-badges">
        <span class="crit-badge ${critCls}">${critLabel}</span>
        <span style="font-size:20px;margin-top:4px;">${icon}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Add / Edit form ──
function openAssetForm(assetId) {
  requireAdmin(() => _openAssetForm(assetId));
}
function _openAssetForm(assetId) {
  editingAssetId = assetId || null;
  const modal = document.getElementById('asset-form-modal');
  if (assetId) {
    const a = allAssets.find(x => x.assetId === assetId);
    if (!a) return;
    document.getElementById('asset-form-title').textContent = 'Edit Asset';
    document.getElementById('af-farm').value        = a.farm || '';
    document.getElementById('af-house').value       = a.house || '';
    document.getElementById('af-system').value      = a.system || '';
    document.getElementById('af-criticality').value = a.criticality || '';
    document.getElementById('af-name').value        = a.name || '';
    document.getElementById('af-makemodel').value   = a.makeModel || '';
    document.getElementById('af-installdate').value = a.installDate || '';
    document.getElementById('af-notes').value       = a.notes || '';
  } else {
    document.getElementById('asset-form-title').textContent = 'Add Asset';
    document.getElementById('af-farm').value        = '';
    document.getElementById('af-house').value       = '';
    document.getElementById('af-system').value      = '';
    document.getElementById('af-criticality').value = '';
    document.getElementById('af-name').value        = '';
    document.getElementById('af-makemodel').value   = '';
    document.getElementById('af-installdate').value = '';
    document.getElementById('af-notes').value       = '';
  }
  modal.classList.add('open');
}

function closeAssetForm() {
  document.getElementById('asset-form-modal').classList.remove('open');
  editingAssetId = null;
}

async function saveAsset() {
  const farm        = document.getElementById('af-farm').value.trim();
  const house       = document.getElementById('af-house').value.trim();
  const system      = document.getElementById('af-system').value.trim();
  const criticality = document.getElementById('af-criticality').value.trim();
  const name        = document.getElementById('af-name').value.trim();
  if (!farm || !house || !system || !criticality || !name) {
    alert('Please fill in all required fields.'); return;
  }
  const makeModel   = document.getElementById('af-makemodel').value.trim();
  const installDate = document.getElementById('af-installdate').value;
  const notes       = document.getElementById('af-notes').value.trim();

  const btn = document.getElementById('af-save-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;

  try {
    if (editingAssetId) {
      // Update existing
      const existing = allAssets.find(a => a.assetId === editingAssetId);
      if (existing && existing._fbId) {
        await db.collection('assets').doc(existing._fbId).update({
          farm, house, system, criticality, name, makeModel, installDate, notes,
          updatedTs: Date.now()
        });
      }
    } else {
      const assetId = genAssetId();
      await db.collection('assets').add({
        assetId, farm, house, system, criticality, name,
        makeModel, installDate, notes,
        linkedPMs: [], linkedWOs: [],
        ts: Date.now()
      });
      // Log activity
      await db.collection('activityLog').add({
        type: 'asset', id: assetId,
        desc: `New asset registered: ${name} (${farm} · ${house})`,
        tech: 'System', date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
        ts: Date.now()
      });
    }
    setSyncDot('live');
    closeAssetForm();
  } catch(e) {
    alert('Error saving asset: ' + e.message);
    console.error(e);
  } finally {
    btn.textContent = '✓ SAVE ASSET'; btn.disabled = false;
  }
}

function editAsset() {
  requireAdmin(() => { closeAssetHistory(); _openAssetForm(currentAssetId); });
}

// ── Asset History Modal ──
async function openAssetHistory(assetId) {
  currentAssetId = assetId;
  ahActiveTab = 'pm';
  const a = allAssets.find(x => x.assetId === assetId);
  if (!a) return;

  const SYS_ICON_MAP = {Ventilation:'💨',Water:'💧',Feed:'🌾',Manure:'♻️','Egg Collectors':'🥚',Heating:'🔥',Electrical:'⚡',Lubing:'🛢️',Building:'🏚️',Other:'📦'};
  const icon = SYS_ICON_MAP[a.system] || '📦';
  const CRIT_ICON = {critical:'🔴 Critical', high:'🟡 High', medium:'🟢 Medium', low:'⚪ Low'};

  document.getElementById('ah-title').textContent = icon + ' ' + a.name;
  document.getElementById('ah-sub').textContent   = '#' + a.assetId + ' · ' + a.farm + ' · ' + a.house;

  // Info chips
  const installLabel = a.installDate ? fmtDate(a.installDate) : 'Unknown';
  const ageLabel = a.installDate ? Math.floor((Date.now() - new Date(a.installDate)) / (365.25*24*3600*1000)) + ' yrs' : '—';
  document.getElementById('ah-info-strip').innerHTML = `
    <div class="ah-info-chip"><div class="ah-chip-lbl">System</div><div class="ah-chip-val" style="font-size:11px;">${icon} ${a.system}</div></div>
    <div class="ah-info-chip"><div class="ah-chip-lbl">Criticality</div><div class="ah-chip-val" style="font-size:11px;">${CRIT_ICON[a.criticality]||'—'}</div></div>
    <div class="ah-info-chip"><div class="ah-chip-lbl">Installed</div><div class="ah-chip-val" style="font-size:11px;">${installLabel}</div></div>
    <div class="ah-info-chip"><div class="ah-chip-lbl">Age</div><div class="ah-chip-val">${ageLabel}</div></div>
    ${a.makeModel ? `<div class="ah-info-chip" style="grid-column:1/-1;"><div class="ah-chip-lbl">Make / Model</div><div class="ah-chip-val" style="font-size:12px;">${a.makeModel}</div></div>` : ''}
    ${a.notes ? `<div class="ah-info-chip" style="grid-column:1/-1;text-align:left;"><div class="ah-chip-lbl">Notes</div><div style="font-size:12px;color:var(--ink);margin-top:2px;">${a.notes}</div></div>` : ''}
  `;
  document.getElementById('ah-info-strip').style.gridTemplateColumns = 'repeat(4,1fr)';

  // Reset tabs
  document.querySelectorAll('.ah-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.ah-tab').classList.add('active');
  document.getElementById('ah-pm-tab').style.display       = '';
  document.getElementById('ah-wo-tab').style.display       = 'none';
  document.getElementById('ah-downtime-tab').style.display = 'none';
  document.getElementById('ah-parts-tab').style.display    = 'none';

  // Loading placeholders
  ['pm','wo','downtime','parts'].forEach(t => {
    document.getElementById('ah-'+t+'-tab').innerHTML = '<div class="empty"><div class="ei">⌛</div><p>Loading...</p></div>';
  });

  document.getElementById('asset-history-modal').classList.add('open');

  // Load all four tabs in parallel
  await Promise.all([
    loadAHPMs(a),
    loadAHWOs(a),
    loadAHDowntime(a),
    loadAHParts(a)
  ]);
}

function closeAssetHistory() {
  document.getElementById('asset-history-modal').classList.remove('open');
  currentAssetId = null;
}

function ahTab(tab, btn) {
  ahActiveTab = tab;
  document.querySelectorAll('.ah-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['pm','wo','downtime','parts'].forEach(t => {
    document.getElementById('ah-'+t+'-tab').style.display = (t === tab) ? '' : 'none';
  });
}

// ── PM History for asset ──
async function loadAHPMs(asset) {
  const el = document.getElementById('ah-pm-tab');
  try {
    // Match PMs by farm + system
    const matchedPMs = ALL_PM.filter(pm =>
      pm.farm === asset.farm &&
      pm.sys  === asset.system
    );

    if (!matchedPMs.length) {
      el.innerHTML = '<div class="empty"><div class="ei">📋</div><p>No PM tasks linked to this system at ' + asset.farm + '.</p></div>';
      return;
    }

    // Load recent completions for matched PMs
    let rows = '';
    for (const pm of matchedPMs.slice(0,10)) {
      const comp = pmComps[pm.id];
      const status = pmStatus(pm.id);
      const statusLabel = status === 'ok' ? '✅ OK' : status === 'due-soon' ? '⚠️ Due Soon' : '🔴 Overdue';
      rows += `<div class="ah-row">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
          <span style="font-weight:700;font-size:13px;">${pm.task}</span>
          <span style="font-size:10px;font-family:'IBM Plex Mono',monospace;white-space:nowrap;margin-left:8px;">${statusLabel}</span>
        </div>
        <div style="font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;">
          ${FREQ[pm.freq].label} · Last done: ${comp ? fmtDate(comp.date) + ' by ' + comp.tech : 'Never'} · ${nextDueLabel(pm.id)}
        </div>
        ${comp && comp.parts ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">🔩 ${comp.parts}</div>` : ''}
      </div>`;
    }
    el.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:10px;font-family:'IBM Plex Mono',monospace;">${matchedPMs.length} PM task(s) matched to ${asset.system} at ${asset.farm}</div>` + rows;
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="ei">⚠️</div><p>Could not load PM history.</p></div>';
  }
}

// ── WO History for asset ──
async function loadAHWOs(asset) {
  const el = document.getElementById('ah-wo-tab');
  try {
    // Match WOs by farm + house + system keyword OR linked WO IDs
    const linkedIds = asset.linkedWOs || [];
    const matchedWOs = workOrders.filter(wo => {
      if (linkedIds.includes(wo.id)) return true;
      // Fuzzy match: same farm, same house, same system keyword in problem
      return wo.farm === asset.farm &&
             (wo.house === asset.house || wo.house === 'PM-Generated') &&
             wo.problem && wo.problem.toLowerCase().includes(asset.system.toLowerCase().split(' ')[0]);
    }).slice(0, 20);

    if (!matchedWOs.length) {
      el.innerHTML = '<div class="empty"><div class="ei">🔧</div><p>No work orders matched to this asset yet.</p></div>';
      return;
    }

    const STATUS_COLOR = {open:'#e53e3e','in-progress':'#d69e2e','on-hold':'#718096',completed:'#38a169'};
    el.innerHTML = matchedWOs.map(wo => {
      const stColor = STATUS_COLOR[wo.status] || '#718096';
      return `<div class="ah-row wo-row">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:700;font-size:13px;font-family:'IBM Plex Mono',monospace;">${wo.id}</span>
          <span style="font-size:10px;font-weight:700;color:${stColor};font-family:'IBM Plex Mono',monospace;">${wo.status.toUpperCase()}</span>
        </div>
        <div style="font-size:13px;color:var(--ink);margin-bottom:3px;">${wo.problem}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;">${wo.date} · ${wo.tech || '—'} · ${wo.house}</div>
        ${wo.desc ? `<div style="font-size:12px;color:var(--muted);margin-top:3px;font-style:italic;">${wo.desc.slice(0,120)}${wo.desc.length>120?'…':''}</div>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="ei">⚠️</div><p>Could not load work orders.</p></div>';
  }
}

// ── Downtime History for asset ──
async function loadAHDowntime(asset) {
  const el = document.getElementById('ah-downtime-tab');
  try {
    const snap = await db.collection('downtime')
      .where('farm','==', asset.farm)
      .orderBy('ts','desc')
      .limit(30)
      .get();

    const sysKey = asset.system.toLowerCase().split(' ')[0];
    const rows = [];
    snap.forEach(d => {
      const r = d.data();
      if (r.system && r.system.toLowerCase().includes(sysKey)) rows.push(r);
    });

    if (!rows.length) {
      el.innerHTML = '<div class="empty"><div class="ei">⏱️</div><p>No downtime events logged for this system at ' + asset.farm + '.</p></div>';
      return;
    }

    // Summary
    const totalHrs = rows.reduce((s,r) => s + (parseFloat(r.hours)||0), 0);
    el.innerHTML = `<div style="background:#fff8e1;border:1px solid var(--amber);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;font-weight:700;color:#856404;">${rows.length} downtime event(s)</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:#b07a00;">${totalHrs.toFixed(1)} hrs total</span>
    </div>` + rows.map(r => `<div class="ah-row dt-row">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-weight:700;font-size:13px;">${r.system}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:#e53e3e;">${r.hours || 0} hrs</span>
      </div>
      <div style="font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;">${fmtDate(r.date)} · ${r.farm} · ${r.house || '—'}</div>
      ${r.cause ? `<div style="font-size:12px;color:var(--ink);margin-top:3px;">${r.cause}</div>` : ''}
    </div>`).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="ei">⚠️</div><p>Could not load downtime data.</p></div>';
  }
}

// ── Parts Used for asset ──
async function loadAHParts(asset) {
  const el = document.getElementById('ah-parts-tab');
  try {
    // Gather parts from WO closeout notes + PM completions that match farm+system
    const partsMap = {};

    // From PM completions
    const matchedPMs = ALL_PM.filter(pm => pm.farm === asset.farm && pm.sys === asset.system);
    for (const pm of matchedPMs) {
      const comp = pmComps[pm.id];
      if (comp && comp.parts && comp.parts.trim()) {
        const key = comp.parts.trim().toLowerCase();
        if (!partsMap[key]) partsMap[key] = {name: comp.parts.trim(), count: 0, lastDate: '', source: 'PM'};
        partsMap[key].count++;
        if (!partsMap[key].lastDate || comp.date > partsMap[key].lastDate) partsMap[key].lastDate = comp.date;
      }
    }

    // From WO closeout notes (woCloseoutParts field)
    const sysKey = asset.system.toLowerCase().split(' ')[0];
    const relatedWOs = workOrders.filter(wo =>
      wo.farm === asset.farm &&
      wo.problem && wo.problem.toLowerCase().includes(sysKey) &&
      wo.closeoutParts && wo.closeoutParts.length
    );
    for (const wo of relatedWOs) {
      for (const p of wo.closeoutParts) {
        if (!p || !p.name) continue;
        const key = p.name.trim().toLowerCase();
        if (!partsMap[key]) partsMap[key] = {name: p.name.trim(), count: 0, lastDate: '', source: 'WO'};
        partsMap[key].count += (p.qty || 1);
        if (!partsMap[key].lastDate || wo.date > partsMap[key].lastDate) partsMap[key].lastDate = wo.date;
      }
    }

    // Also check parts field in WOs (free-text)
    const txtWOs = workOrders.filter(wo =>
      wo.farm === asset.farm &&
      wo.problem && wo.problem.toLowerCase().includes(sysKey) &&
      wo.parts && wo.parts.trim()
    );
    for (const wo of txtWOs) {
      const key = wo.parts.trim().toLowerCase();
      if (!partsMap[key]) partsMap[key] = {name: wo.parts.trim(), count: 0, lastDate: '', source: 'WO'};
      partsMap[key].count++;
      if (!partsMap[key].lastDate || wo.date > partsMap[key].lastDate) partsMap[key].lastDate = wo.date;
    }

    const partsList = Object.values(partsMap).sort((a,b) => b.count - a.count);

    if (!partsList.length) {
      el.innerHTML = '<div class="empty"><div class="ei">🔩</div><p>No parts recorded for this asset\'s system yet.</p></div>';
      return;
    }

    el.innerHTML = partsList.map(p => `<div class="ah-row pt-row">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;font-size:13px;">🔩 ${p.name}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:#3b82f6;">×${p.count}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-top:3px;">
        Source: ${p.source} · Last used: ${p.lastDate ? fmtDate(p.lastDate) : '—'}
      </div>
    </div>`).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="ei">⚠️</div><p>Could not load parts data.</p></div>';
  }
}

// ── Close on backdrop click ──
document.getElementById('asset-form-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAssetForm(); });
document.getElementById('asset-history-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAssetHistory(); });

// ═══════════════════════════════════════════
// MAINTENANCE CALENDAR
// ═══════════════════════════════════════════
var _maintCalFarm = 'all';

function maintCalFarm(farm, btn) {
  _maintCalFarm = farm;
  document.querySelectorAll('#maint-calendar .pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMaintCalendar();
}

function renderMaintCalendar() {
  const el = document.getElementById('maint-calendar-container');
  if (!el) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const DAYS = 14;
  const dayMs = 86400000;

  // Build upcoming tasks: compute next due date for each PM
  const tasks = (_maintCalFarm === 'all' ? ALL_PM : ALL_PM.filter(t => !t.farms || t.farms.includes(_maintCalFarm)));
  const upcoming = [];

  tasks.forEach(t => {
    const comp = pmComps[t.id];
    const freqDays = FREQ[t.freq]?.days || 30;
    let nextDue;
    if (!comp) {
      nextDue = new Date(today); // overdue — show as today
    } else {
      nextDue = new Date(new Date(comp.date).getTime() + freqDays * dayMs);
    }
    nextDue.setHours(0,0,0,0);
    const diffDays = Math.round((nextDue - today) / dayMs);
    if (diffDays <= DAYS) { // show overdue + next 14 days
      upcoming.push({ task: t, nextDue, diffDays, done: doneToday(t.id) });
    }
  });

  // Sort by diffDays, then by task system
  upcoming.sort((a,b) => a.diffDays - b.diffDays || a.task.sys.localeCompare(b.task.sys));

  if (!upcoming.length) {
    el.innerHTML = '<div class="empty"><div class="ei">📅</div><p>No PMs due in the next 14 days</p></div>';
    return;
  }

  // Group by day bucket
  const groups = {};
  upcoming.forEach(item => {
    let label;
    if (item.diffDays < 0)       label = `⚠️ Overdue (${Math.abs(item.diffDays)}d ago)`;
    else if (item.diffDays === 0) label = '📌 Today';
    else if (item.diffDays === 1) label = '📅 Tomorrow';
    else {
      const d = new Date(item.nextDue);
      label = '📅 ' + d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  const freqIcon = freq => FREQ[freq]?.icon || '🔵';
  const priorityOrder = ['⚠️ Overdue','📌 Today','📅 Tomorrow'];

  let html = '';
  Object.entries(groups).forEach(([label, items]) => {
    const isOverdue = label.startsWith('⚠️');
    html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;color:${isOverdue?'#f87171':'#5a8a5a'};text-transform:uppercase;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid ${isOverdue?'#3a1a1a':'#1e3a1e'};">${label}</div>`;
    items.forEach(({task, done}) => {
      const farmTag = task.farms && task.farms.length ? `<span style="font-size:9px;color:#4a7a4a;background:#1a3a1a;border-radius:4px;padding:2px 5px;margin-left:6px;">${task.farms.join('/')}</span>` : '';
      html += `<div style="background:${done?'#0f2a0f':isOverdue?'#1a0a0a':'#0f1a0f'};border:1px solid ${done?'#2a5a2a':isOverdue?'#3a1a1a':'#1a3a1a'};border-radius:10px;padding:10px 14px;margin-bottom:6px;display:flex;align-items:flex-start;gap:10px;">
        <div style="font-size:16px;margin-top:1px;">${freqIcon(task.freq)}</div>
        <div style="flex:1;">
          <div style="font-size:12px;color:${done?'#5a8a5a':isOverdue?'#f87171':'#f0ead8'};font-weight:${done?'400':'600'};${done?'text-decoration:line-through;':''}">${task.task}${farmTag}</div>
          <div style="font-size:10px;color:#4a6a4a;margin-top:3px;font-family:'IBM Plex Mono',monospace;">${task.sys} · ${FREQ[task.freq]?.label||task.freq}${task.hrs?' · '+task.hrs+'h':''}</div>
        </div>
        ${done?'<div style="font-size:16px;">✅</div>':''}
      </div>`;
    });
  });

  const overdueCnt = upcoming.filter(i=>i.diffDays<0).length;
  const todayCnt   = upcoming.filter(i=>i.diffDays===0).length;
  const doneCnt    = upcoming.filter(i=>i.done).length;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
      <div class="stat-card"><div class="stat-num" style="color:${overdueCnt>0?'#e53e3e':'var(--green-mid)'}">${overdueCnt}</div><div class="stat-label">Overdue</div></div>
      <div class="stat-card"><div class="stat-num">${todayCnt}</div><div class="stat-label">Due Today</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--green-mid)">${doneCnt}</div><div class="stat-label">Done Today</div></div>
    </div>
    ${html}`;
}

// ═══════════════════════════════════════════
// OPERATIONS MODULE
// ═══════════════════════════════════════════

let opsEggData = [], opsPackData = [], opsShipData = [], opsExcData = [];
let opsCurrentSection = 'scoreboard';
let opsScoreFilter = 'today';
let opsEggFarm_ = 'all';
let opsShipView_ = 'active';
let opsExcView_ = 'open';
let opsReconMode_ = 'today';

// ═══════════════════════════════════════════
