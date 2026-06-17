// ═══════════════════════════════════════════════════════════════════════════
// maint-projects.js — Maintenance Projects tracker
// Bigger-than-a-work-order efforts (e.g. "Bearing redundancy: order bearings for
// 2 machines + rebuild both for a backup"). Per-facility. Each project has a
// task checklist with progress %, a target date, an assigned person, and the
// machine/equipment it's about. Stored in Firestore collection `maintProjects`.
// ═══════════════════════════════════════════════════════════════════════════
let _mpProjects   = [];
let _mpListening  = false;
let _mpShowAdd    = false;
let _mpNewStage   = 'upcoming';
let _mpNewReq     = '';        // requested by: Team | Management
let _mpNewCat     = '';        // what's it for (work area)
let _mpNewPri     = 'normal';  // priority: urgent | high | normal

function mpFarm() {
  return (typeof getPreferredFarm === 'function' && getPreferredFarm()) || 'Hegins';
}

// Staff <option>s scoped to the active location (Hegins shows Hegins + Both,
// Danville shows Danville + Both) so each plant only sees its own employees.
function mpStaffOptions(farm) {
  let names = [];
  try { if (typeof getActiveStaff === 'function') names = getActiveStaff(farm) || []; } catch (e) {}
  return names.map(n => `<option value="${mpEsc(n)}"></option>`).join('');
}

function mpStartListener() {
  if (_mpListening || typeof db === 'undefined' || !db) return;
  _mpListening = true;
  try {
    db.collection('maintProjects').orderBy('createdTs','desc').onSnapshot(snap => {
      _mpProjects = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
      if (window._maintSection === 'projects') renderMaintProjects();
    }, err => { console.error('maintProjects listener:', err); });
  } catch (e) { console.error('mpStartListener:', e); _mpListening = false; }
}

function mpProgress(p) {
  const tasks = (p && p.tasks) || [];
  if (!tasks.length) return 0;
  return Math.round(tasks.filter(t => t.done).length / tasks.length * 100);
}

function mpIsDone(p) {
  const tasks = (p && p.tasks) || [];
  return tasks.length > 0 && tasks.every(t => t.done);
}

function mpEsc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function mpDueLabel(p) {
  if (!p.dueDate) return '';
  const due = new Date(p.dueDate + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((due - today) / 86400000);
  const done = mpIsDone(p);
  const fmt = due.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  if (done) return `<span style="color:#7ab07a;">🎯 ${fmt}</span>`;
  if (diff < 0)  return `<span style="color:#f87171;font-weight:700;">⚠ ${Math.abs(diff)}d ${t('proj.due_overdue')} (${fmt})</span>`;
  if (diff === 0) return `<span style="color:#fbbf24;font-weight:700;">🎯 ${t('proj.due_today')}</span>`;
  if (diff <= 3)  return `<span style="color:#fbbf24;">🎯 ${t('proj.due_in')} ${diff}d (${fmt})</span>`;
  return `<span style="color:#7ab07a;">🎯 ${fmt}</span>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
function renderMaintProjects() {
  mpStartListener();
  const el = document.getElementById('maint-projects');
  if (!el) return;
  const farm = mpFarm();
  const all  = _mpProjects.filter(p => !p.farm || p.farm === farm);
  const priRank = p => p.priority === 'urgent' ? 0 : (p.priority === 'high' ? 1 : 2);
  const sortFn = (a,b) => {
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return priRank(a) - priRank(b) || ad - bd || (b.createdTs||0) - (a.createdTs||0);
  };
  const done     = all.filter(p =>  mpIsDone(p)).sort(sortFn);
  const notDone  = all.filter(p => !mpIsDone(p));
  const upcoming = notDone.filter(p => (p.stage || 'active') === 'upcoming').sort(sortFn);
  const active   = notDone.filter(p => (p.stage || 'active') !== 'upcoming').sort(sortFn);

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:2px;color:#7ab07a;text-transform:uppercase;">📋 ${t('proj.header')} · ${mpEsc(farm)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a8a5a;margin-top:3px;">${upcoming.length} ${t('proj.upcoming')} · ${active.length} ${t('proj.inprogress')} · ${done.length} ${t('proj.done')}</div>
      </div>
      <button onclick="mpToggleAdd()" style="padding:10px 16px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:8px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:1px;">${_mpShowAdd ? t('proj.cancel') : t('proj.new')}</button>
    </div>`;

  if (_mpShowAdd) html += mpAddFormHtml(farm);

  if (!all.length && !_mpShowAdd) {
    html += `<div style="text-align:center;padding:40px 16px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;font-size:12px;">${t('proj.none')}</div>`;
  }

  const mpSection = (label, items) => {
    if (!items.length) return '';
    let s = `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#3a6a3a;text-transform:uppercase;margin:18px 0 8px;">${label}</div>`;
    items.forEach(p => { s += mpCardHtml(p, mpIsDone(p)); });
    return s;
  };
  html += mpSection(t('proj.sec_upcoming'), upcoming);
  html += mpSection(t('proj.sec_inprogress'), active);
  html += mpSection(t('proj.sec_completed'), done);

  el.innerHTML = html;
}

const MP_CATS = ['5S','Barns','Equipment','Feed Mill','Electrical','Safety','Building','Other'];

function mpChipStyle(on, color) {
  return `padding:9px 13px;border-radius:18px;border:1.5px solid ${on?color:'#2a5a2a'};background:${on?color:'#06120a'};color:${on?'#06120a':'#7ab07a'};font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;`;
}
function mpReqRowHtml() {
  const defs = [['Team','👥 '+t('proj.req_team'),'#4ade80'],['Management','🧑‍💼 '+t('proj.req_mgmt'),'#7ab0f6']];
  return defs.map(d => `<button type="button" onclick="mpPickReq('${d[0]}')" style="${mpChipStyle(_mpNewReq===d[0],d[2])}">${d[1]}</button>`).join('');
}
function mpCatRowHtml() {
  return MP_CATS.map(c => `<button type="button" onclick="mpPickCat('${c.replace(/'/g,"\\'")}')" style="${mpChipStyle(_mpNewCat===c,'#4ade80')}">${mpEsc(c)}</button>`).join('');
}
function mpPriRowHtml() {
  const defs = [['urgent','🔴 '+t('proj.pri_urgent'),'#f87171'],['high','🟡 '+t('proj.pri_high'),'#fbbf24'],['normal',t('proj.pri_normal'),'#7ab07a']];
  return defs.map(d => `<button type="button" onclick="mpPickPri('${d[0]}')" style="${mpChipStyle(_mpNewPri===d[0],d[2])}">${d[1]}</button>`).join('');
}
function mpPickReq(k){ _mpNewReq=(_mpNewReq===k?'':k); const r=document.getElementById('mp-req-row'); if(r) r.innerHTML=mpReqRowHtml(); }
function mpPickCat(c){ _mpNewCat=(_mpNewCat===c?'':c); const r=document.getElementById('mp-cat-row'); if(r) r.innerHTML=mpCatRowHtml(); }
function mpPickPri(p){ _mpNewPri=p; const r=document.getElementById('mp-pri-row'); if(r) r.innerHTML=mpPriRowHtml(); }

function mpAddFormHtml(farm) {
  return `
  <div style="background:#0a1f0a;border:1.5px solid #2a5a2a;border-radius:12px;padding:16px;margin-bottom:16px;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:1px;color:#4ade80;text-transform:uppercase;margin-bottom:10px;">${t('proj.form_new')} — ${mpEsc(farm)}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#5a8a5a;margin-bottom:9px;">${t('proj.only_title')}</div>
    <input id="mp-title" placeholder="${t('proj.ph_title')}" style="width:100%;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;margin-bottom:9px;">
    <input id="mp-machine" placeholder="${t('proj.ph_machine')}" style="width:100%;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;margin-bottom:9px;">
    <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:9px;">
      <input id="mp-assigned" list="mp-staff-datalist" placeholder="${t('proj.ph_assigned')}" style="flex:1;min-width:130px;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;">
      <datalist id="mp-staff-datalist">${mpStaffOptions(farm)}</datalist>
      <input id="mp-due" type="date" style="flex:1;min-width:130px;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;">
    </div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;margin-bottom:6px;">${t('proj.req_label')}</div>
    <div id="mp-req-row" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px;">${mpReqRowHtml()}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;margin-bottom:6px;">${t('proj.for_label')}</div>
    <div id="mp-cat-row" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px;">${mpCatRowHtml()}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:1px;color:#5a8a5a;text-transform:uppercase;margin-bottom:6px;">${t('proj.pri_label')}</div>
    <div id="mp-pri-row" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px;">${mpPriRowHtml()}</div>
    <textarea id="mp-tasks" rows="4" placeholder="${t('proj.ph_tasks')}" style="width:100%;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;margin-bottom:10px;"></textarea>
    <div style="display:flex;gap:9px;margin-bottom:11px;">
      <button type="button" id="mp-stage-upcoming" onclick="mpPickStage('upcoming')" style="${mpStageBtnStyle(_mpNewStage==='upcoming')}">${t('proj.stage_upcoming')}</button>
      <button type="button" id="mp-stage-active" onclick="mpPickStage('active')" style="${mpStageBtnStyle(_mpNewStage==='active')}">${t('proj.stage_inprogress')}</button>
    </div>
    <button onclick="mpCreateProject()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#2e7d32;color:#fff;font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:800;letter-spacing:1px;cursor:pointer;">${t('proj.create')}</button>
  </div>`;
}

function mpCardHtml(p, isDone) {
  const pct   = mpProgress(p);
  const tasks = p.tasks || [];
  const bar   = pct === 100 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#3a8a4a';
  const taskHtml = tasks.map((tk, i) => `
    <div onclick="mpToggleTask('${p._id}',${i})" style="display:flex;align-items:center;gap:9px;padding:8px 6px;cursor:pointer;border-bottom:1px solid #112211;">
      <span style="font-size:15px;line-height:1;">${tk.done ? '✅' : '⬜'}</span>
      <span style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:12px;color:${tk.done ? '#5a8a5a' : '#e8f5ec'};${tk.done ? 'text-decoration:line-through;' : ''}">${mpEsc(tk.text)}</span>
      <span onclick="event.stopPropagation();mpDeleteTask('${p._id}',${i})" style="color:#7f3a3a;font-size:13px;padding:0 4px;">✕</span>
    </div>`).join('');

  return `
  <div style="background:${isDone ? '#0c1a0c' : '#0f2410'};border:1.5px solid ${isDone ? '#1e3a1e' : '#2a5a2a'};border-radius:12px;padding:14px;margin-bottom:12px;${isDone ? 'opacity:.7;' : ''}">
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div style="flex:1;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:#e8f5ec;">${mpEsc(p.title)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:7px;font-family:'IBM Plex Mono',monospace;font-size:10px;">
          ${p.priority==='urgent' ? `<span style="background:#2a0a0a;border:1px solid #7f1d1d;border-radius:6px;padding:3px 8px;color:#f87171;font-weight:700;">🔴 ${t('proj.pri_urgent')}</span>` : (p.priority==='high' ? `<span style="background:#2a1f00;border:1px solid #6a4a00;border-radius:6px;padding:3px 8px;color:#fbbf24;font-weight:700;">🟡 ${t('proj.pri_high')}</span>` : '')}
          ${p.requestedBy==='Management' ? `<span style="background:#16213a;border:1px solid #3a5a8a;border-radius:6px;padding:3px 8px;color:#9cc0f6;">🧑‍💼 ${t('proj.req_mgmt')}</span>` : (p.requestedBy==='Team' ? `<span style="background:#10241a;border:1px solid #2a5a3a;border-radius:6px;padding:3px 8px;color:#9fe0b5;">👥 ${t('proj.req_team')}</span>` : '')}
          ${p.category ? `<span style="background:#1a1f0a;border:1px solid #4a5a2a;border-radius:6px;padding:3px 8px;color:#cfe0a0;">🏷 ${mpEsc(p.category)}</span>` : ''}
          ${p.machine    ? `<span style="background:#0d1f3a;border:1px solid #1e3a6a;border-radius:6px;padding:3px 8px;color:#7ab0f6;">🔩 ${mpEsc(p.machine)}</span>` : ''}
          ${p.assignedTo ? `<span style="background:#1a2a3a;border:1px solid #3a5a7a;border-radius:6px;padding:3px 8px;color:#9cc0e8;">👤 ${mpEsc(p.assignedTo)}</span>` : ''}
          ${p.dueDate    ? `<span style="background:#0a1f0a;border:1px solid #2a5a2a;border-radius:6px;padding:3px 8px;">${mpDueLabel(p)}</span>` : ''}
        </div>
      </div>
      <span onclick="mpDeleteProject('${p._id}')" style="color:#7f3a3a;font-size:14px;cursor:pointer;padding:2px 4px;">🗑</span>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin:11px 0 6px;">
      <div style="flex:1;background:#0a1a0a;border-radius:4px;height:8px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${bar};border-radius:4px;transition:width .3s;"></div>
      </div>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${bar};">${pct}%</span>
    </div>

    ${(!isDone && (p.stage || 'active') === 'upcoming') ? `<button onclick="mpStart('${p._id}')" style="margin-bottom:9px;padding:9px 14px;background:#0d2a4a;border:1px solid #3a6aaa;border-radius:8px;color:#7ab0f6;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;">${t('proj.start')}</button>` : ''}

    <div style="margin-top:4px;">${taskHtml || ('<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#3a6a3a;padding:6px;">' + t('proj.no_tasks') + '</div>')}</div>

    <div style="display:flex;gap:7px;margin-top:9px;">
      <input id="mp-newtask-${p._id}" placeholder="${t('proj.add_task_ph')}" onkeydown="if(event.key==='Enter')mpAddTask('${p._id}')" style="flex:1;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:12px;">
      <button onclick="mpAddTask('${p._id}')" style="padding:9px 13px;background:#1a3a1a;border:1px solid #4ade80;border-radius:8px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">${t('proj.add_task')}</button>
    </div>
  </div>`;
}

// ── Actions ──────────────────────────────────────────────────────────────────
function mpToggleAdd() { _mpShowAdd = !_mpShowAdd; if (_mpShowAdd) { _mpNewStage = 'upcoming'; _mpNewReq = ''; _mpNewCat = ''; _mpNewPri = 'normal'; } renderMaintProjects(); }

function mpStageBtnStyle(on) {
  return `flex:1;padding:13px;border-radius:8px;border:2px solid ${on?'#4ade80':'#2a5a2a'};background:${on?'#16351b':'#06120a'};color:${on?'#fff':'#7ab07a'};font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;`;
}

function mpPickStage(s) {
  _mpNewStage = s;
  const up = document.getElementById('mp-stage-upcoming');
  const ac = document.getElementById('mp-stage-active');
  if (up) up.setAttribute('style', mpStageBtnStyle(s === 'upcoming'));
  if (ac) ac.setAttribute('style', mpStageBtnStyle(s === 'active'));
}

async function mpCreateProject() {
  const title = (document.getElementById('mp-title')   || {}).value || '';
  const machine = (document.getElementById('mp-machine') || {}).value || '';
  const assigned = (document.getElementById('mp-assigned')|| {}).value || '';
  const due = (document.getElementById('mp-due')      || {}).value || '';
  const tasksRaw = (document.getElementById('mp-tasks')  || {}).value || '';
  if (!title.trim()) { alert(t('proj.need_title')); return; }
  const stage = _mpNewStage || 'upcoming';
  const tasks = tasksRaw.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text, done: false }));
  const rec = {
    farm: mpFarm(),
    title: title.trim(),
    machine: machine.trim(),
    assignedTo: assigned.trim(),
    dueDate: due || null,
    requestedBy: _mpNewReq || '',
    category: _mpNewCat || '',
    priority: _mpNewPri || 'normal',
    tasks,
    stage,
    status: 'open',
    createdBy: (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : ''),
    createdTs: Date.now()
  };
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('maintProjects').add(rec);
    if (typeof setSyncDot === 'function') setSyncDot('live');
    _mpShowAdd = false;
    if (typeof toast === 'function') toast('✅ ' + t('proj.created') + ': ' + rec.title);
    // listener re-renders
  } catch (e) {
    console.error('mpCreateProject:', e);
    alert('Could not create the project: ' + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

function _mpFind(id) { return _mpProjects.find(p => p._id === id); }

async function mpToggleTask(id, idx) {
  const p = _mpFind(id); if (!p || !p.tasks || !p.tasks[idx]) return;
  p.tasks[idx].done = !p.tasks[idx].done;
  renderMaintProjects(); // optimistic
  try {
    await db.collection('maintProjects').doc(id).update({
      tasks: p.tasks,
      status: mpIsDone(p) ? 'done' : 'open'
    });
  } catch (e) { console.error('mpToggleTask:', e); }
}

async function mpAddTask(id) {
  const inp = document.getElementById('mp-newtask-' + id);
  const text = inp ? inp.value.trim() : '';
  if (!text) return;
  const p = _mpFind(id); if (!p) return;
  p.tasks = (p.tasks || []).concat([{ text, done: false }]);
  renderMaintProjects();
  try { await db.collection('maintProjects').doc(id).update({ tasks: p.tasks, status: 'open' }); }
  catch (e) { console.error('mpAddTask:', e); }
}

async function mpDeleteTask(id, idx) {
  const p = _mpFind(id); if (!p || !p.tasks) return;
  p.tasks.splice(idx, 1);
  renderMaintProjects();
  try { await db.collection('maintProjects').doc(id).update({ tasks: p.tasks, status: mpIsDone(p) ? 'done' : 'open' }); }
  catch (e) { console.error('mpDeleteTask:', e); }
}

async function mpDeleteProject(id) {
  const p = _mpFind(id);
  if (!confirm('Delete project "' + (p ? p.title : '') + '"? This cannot be undone.')) return;
  try { await db.collection('maintProjects').doc(id).delete(); }
  catch (e) { console.error('mpDeleteProject:', e); alert('Could not delete: ' + (e && e.message ? e.message : e)); }
}

async function mpStart(id) {
  const p = _mpFind(id); if (!p) return;
  p.stage = 'active';
  renderMaintProjects();
  try { await db.collection('maintProjects').doc(id).update({ stage: 'active' }); }
  catch (e) { console.error('mpStart:', e); }
}

if (typeof window !== 'undefined') {
  window.renderMaintProjects = renderMaintProjects;
  window.mpStart = mpStart;
  window.mpToggleAdd = mpToggleAdd;
  window.mpCreateProject = mpCreateProject;
  window.mpToggleTask = mpToggleTask;
  window.mpAddTask = mpAddTask;
  window.mpDeleteTask = mpDeleteTask;
  window.mpDeleteProject = mpDeleteProject;
  window.mpPickStage = mpPickStage;
  window.mpPickReq = mpPickReq;
  window.mpPickCat = mpPickCat;
  window.mpPickPri = mpPickPri;
}
