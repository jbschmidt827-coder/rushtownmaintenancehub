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

function mpFarm() {
  return (typeof getPreferredFarm === 'function' && getPreferredFarm()) || 'Hegins';
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
  if (diff < 0)  return `<span style="color:#f87171;font-weight:700;">⚠ ${Math.abs(diff)}d overdue (${fmt})</span>`;
  if (diff === 0) return `<span style="color:#fbbf24;font-weight:700;">🎯 Due today</span>`;
  if (diff <= 3)  return `<span style="color:#fbbf24;">🎯 Due in ${diff}d (${fmt})</span>`;
  return `<span style="color:#7ab07a;">🎯 ${fmt}</span>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
function renderMaintProjects() {
  mpStartListener();
  const el = document.getElementById('maint-projects');
  if (!el) return;
  const farm = mpFarm();
  const all  = _mpProjects.filter(p => !p.farm || p.farm === farm);
  const active = all.filter(p => !mpIsDone(p));
  const done   = all.filter(p =>  mpIsDone(p));
  // active: overdue/soonest due first, then newest
  active.sort((a,b) => {
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return ad - bd || (b.createdTs||0) - (a.createdTs||0);
  });

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:2px;color:#7ab07a;text-transform:uppercase;">📋 Projects · ${mpEsc(farm)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a8a5a;margin-top:3px;">${active.length} active · ${done.length} done</div>
      </div>
      <button onclick="mpToggleAdd()" style="padding:10px 16px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:8px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:1px;">${_mpShowAdd ? '✕ Cancel' : '+ New Project'}</button>
    </div>`;

  if (_mpShowAdd) html += mpAddFormHtml(farm);

  if (!active.length && !done.length && !_mpShowAdd) {
    html += `<div style="text-align:center;padding:40px 16px;color:#3a6a3a;font-family:'IBM Plex Mono',monospace;font-size:12px;">No projects yet for ${mpEsc(farm)}.<br>Tap "+ New Project" to start one (e.g. a bearing rebuild).</div>`;
  }

  active.forEach(p => { html += mpCardHtml(p); });
  if (done.length) {
    html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#3a6a3a;text-transform:uppercase;margin:18px 0 8px;">✅ Completed</div>`;
    done.forEach(p => { html += mpCardHtml(p, true); });
  }

  el.innerHTML = html;
}

function mpAddFormHtml(farm) {
  return `
  <div style="background:#0a1f0a;border:1.5px solid #2a5a2a;border-radius:12px;padding:16px;margin-bottom:16px;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:1px;color:#4ade80;text-transform:uppercase;margin-bottom:10px;">New Project — ${mpEsc(farm)}</div>
    <input id="mp-title" placeholder="Project title (e.g. Bearing redundancy — pack line)" style="width:100%;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;margin-bottom:9px;">
    <input id="mp-machine" placeholder="Machine / equipment (e.g. Washer + Blower)" style="width:100%;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;margin-bottom:9px;">
    <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:9px;">
      <input id="mp-assigned" list="staff-datalist" placeholder="Assigned to" style="flex:1;min-width:130px;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;">
      <input id="mp-due" type="date" style="flex:1;min-width:130px;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;">
    </div>
    <textarea id="mp-tasks" rows="4" placeholder="Tasks — one per line, e.g.&#10;Order bearings — Machine A&#10;Order bearings — Machine B&#10;Rebuild Machine A&#10;Rebuild Machine B" style="width:100%;box-sizing:border-box;padding:11px;border-radius:8px;border:1.5px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:13px;margin-bottom:10px;"></textarea>
    <button onclick="mpCreateProject()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#2e7d32;color:#fff;font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:800;letter-spacing:1px;cursor:pointer;">✓ Create Project</button>
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

    <div style="margin-top:4px;">${taskHtml || '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#3a6a3a;padding:6px;">No tasks yet — add one below.</div>'}</div>

    <div style="display:flex;gap:7px;margin-top:9px;">
      <input id="mp-newtask-${p._id}" placeholder="Add a task…" onkeydown="if(event.key==='Enter')mpAddTask('${p._id}')" style="flex:1;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid #2a5a2a;background:#06120a;color:#e8f5ec;font-family:'IBM Plex Mono',monospace;font-size:12px;">
      <button onclick="mpAddTask('${p._id}')" style="padding:9px 13px;background:#1a3a1a;border:1px solid #4ade80;border-radius:8px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">+ Task</button>
    </div>
  </div>`;
}

// ── Actions ──────────────────────────────────────────────────────────────────
function mpToggleAdd() { _mpShowAdd = !_mpShowAdd; renderMaintProjects(); }

async function mpCreateProject() {
  const title = (document.getElementById('mp-title')   || {}).value || '';
  const machine = (document.getElementById('mp-machine') || {}).value || '';
  const assigned = (document.getElementById('mp-assigned')|| {}).value || '';
  const due = (document.getElementById('mp-due')      || {}).value || '';
  const tasksRaw = (document.getElementById('mp-tasks')  || {}).value || '';
  if (!title.trim()) { alert('Please give the project a title.'); return; }
  const tasks = tasksRaw.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text, done: false }));
  const rec = {
    farm: mpFarm(),
    title: title.trim(),
    machine: machine.trim(),
    assignedTo: assigned.trim(),
    dueDate: due || null,
    tasks,
    status: 'open',
    createdBy: (typeof getDeviceUser === 'function' ? (getDeviceUser() || '') : ''),
    createdTs: Date.now()
  };
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('maintProjects').add(rec);
    if (typeof setSyncDot === 'function') setSyncDot('live');
    _mpShowAdd = false;
    if (typeof toast === 'function') toast('✅ Project created: ' + rec.title);
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

if (typeof window !== 'undefined') {
  window.renderMaintProjects = renderMaintProjects;
  window.mpToggleAdd = mpToggleAdd;
  window.mpCreateProject = mpCreateProject;
  window.mpToggleTask = mpToggleTask;
  window.mpAddTask = mpAddTask;
  window.mpDeleteTask = mpDeleteTask;
  window.mpDeleteProject = mpDeleteProject;
}
