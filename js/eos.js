// ═══════════════════════════════════════════════════════════════════════
// EOS — Rocks (Quarterly Priorities) · L10 To-Dos (7-day clock) · IDS Issues
// Adds three EOS sections to the Daily End-of-Shift Report.
// Firestore collections used: rocks, l10Todos, idsIssues
// ═══════════════════════════════════════════════════════════════════════

let _eosRocks   = [];
let _eosTodos   = [];
let _eosIssues  = [];
let _eosListening = false;

// ── Subscribe once to all three collections ─────────────────────────────────
function eosSubscribe(onUpdate) {
  if (_eosListening) return;
  _eosListening = true;

  db.collection('rocks').orderBy('createdTs','desc').limit(50).onSnapshot(snap => {
    _eosRocks = snap.docs.map(d => ({...d.data(), _id: d.id}));
    onUpdate && onUpdate();
  });
  db.collection('l10Todos').orderBy('createdTs','desc').limit(100).onSnapshot(snap => {
    _eosTodos = snap.docs.map(d => ({...d.data(), _id: d.id}));
    onUpdate && onUpdate();
  });
  db.collection('idsIssues').orderBy('createdTs','desc').limit(100).onSnapshot(snap => {
    _eosIssues = snap.docs.map(d => ({...d.data(), _id: d.id}));
    onUpdate && onUpdate();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function eosCurrentQuarter() {
  const now = new Date();
  return { q: 'Q' + (Math.floor(now.getMonth()/3)+1), year: now.getFullYear() };
}

function eosDaysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function eosDaysAgo(ts) {
  if (!ts) return 0;
  return Math.floor((Date.now() - ts) / 86400000);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — ROCKS (Quarterly Priorities)
// ═══════════════════════════════════════════════════════════════════════════
function renderRocksSection() {
  const cur = eosCurrentQuarter();
  const active = _eosRocks.filter(r => r.q === cur.q && r.year === cur.year && r.status !== 'Complete');
  const done   = _eosRocks.filter(r => r.q === cur.q && r.year === cur.year && r.status === 'Complete');

  const onTrack = active.filter(r => r.status === 'On Track').length;
  const offTrack = active.filter(r => r.status === 'Off Track').length;

  return `
  <div style="padding:20px 16px 6px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;">
        🪨 ROCKS — ${cur.q} ${cur.year}
        <span style="margin-left:8px;background:#1a3a1a;border-radius:4px;padding:2px 8px;font-size:9px;">
          ${active.length} active · ${onTrack} on track · ${offTrack > 0 ? `<span style="color:#f87171">${offTrack} off track</span>` : '0 off track'} · ${done.length} done
        </span>
      </div>
      <button onclick="eosOpenAddRock()" style="padding:6px 14px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:6px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:1px;">+ ADD ROCK</button>
    </div>
    ${active.length === 0 && done.length === 0
      ? `<div style="padding:18px;background:#0a1f0a;border:1px dashed #2a5a2a;border-radius:6px;text-align:center;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:11px;">No rocks set for ${cur.q} ${cur.year} — click + ADD ROCK to set quarterly priorities.</div>`
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;">
          ${[...active, ...done].map(eosRockCard).join('')}
        </div>`}
  </div>
  ${eosAddRockModal()}
  `;
}

function eosRockCard(r) {
  const stColors = {
    'On Track':   { bg:'#0a1f0a', bd:'#2a5a2a', fg:'#4ade80' },
    'Off Track':  { bg:'#2a1010', bd:'#7f1d1d', fg:'#f87171' },
    'Not Started':{ bg:'#0d1a2a', bd:'#1e3a6a', fg:'#7ab0f6' },
    'Complete':   { bg:'#0a1f0a', bd:'#2a5a2a', fg:'#7ab07a' }
  };
  const c = stColors[r.status] || stColors['Not Started'];
  const days = eosDaysUntil(r.dueDate);
  const dueLbl = days==null ? '' : days < 0 ? `<span style="color:#f87171">⏰ ${Math.abs(days)}d overdue</span>` : days <= 14 ? `<span style="color:#fbbf24">${days}d left</span>` : `${days}d left`;
  const pct = Math.max(0, Math.min(100, Number(r.percentComplete||0)));

  return `
  <div style="background:${c.bg};border:1.5px solid ${c.bd};border-radius:8px;padding:10px 12px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:1px;color:${c.fg};text-transform:uppercase;">${r.status}</div>
      <div style="display:flex;gap:4px;">
        <button onclick="eosCycleRockStatus('${r._id}')" title="Cycle status" style="padding:1px 6px;background:transparent;border:1px solid ${c.bd};border-radius:3px;color:${c.fg};cursor:pointer;font-size:10px;">↻</button>
        <button onclick="eosDeleteRock('${r._id}')" title="Delete" style="padding:1px 6px;background:transparent;border:1px solid #5a1010;border-radius:3px;color:#f87171;cursor:pointer;font-size:10px;">×</button>
      </div>
    </div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1px;color:#e8f5ec;margin-bottom:6px;line-height:1.2;">${r.title || ''}</div>
    <div style="display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7ab07a;margin-bottom:6px;">
      <span>${r.owner || '—'}</span>
      <span>${dueLbl}</span>
    </div>
    <div style="background:#000;border-radius:3px;height:6px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${c.fg};transition:width .25s;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;">
      <span>${pct}% complete</span>
      <span>
        <button onclick="eosBumpRock('${r._id}',-10)" style="padding:0 5px;background:transparent;border:1px solid #2a5a2a;border-radius:3px;color:#7ab07a;cursor:pointer;font-size:9px;">−10</button>
        <button onclick="eosBumpRock('${r._id}',+10)" style="padding:0 5px;background:transparent;border:1px solid #2a5a2a;border-radius:3px;color:#7ab07a;cursor:pointer;font-size:9px;">+10</button>
      </span>
    </div>
  </div>`;
}

function eosAddRockModal() {
  const cur = eosCurrentQuarter();
  return `
  <div id="eos-rock-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;align-items:center;justify-content:center;padding:16px;">
    <div style="background:#0a1f0a;border:2px solid #4ade80;border-radius:10px;padding:18px;max-width:420px;width:100%;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#4ade80;margin-bottom:12px;">ADD ROCK — ${cur.q} ${cur.year}</div>
      <input id="eos-rock-title" placeholder="Rock title (specific & measurable)" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:8px;">
      <input id="eos-rock-owner" placeholder="Owner (name)" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:8px;">
      <input id="eos-rock-due" type="date" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:14px;">
      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('eos-rock-modal').style.display='none'" style="flex:1;padding:9px;background:transparent;border:1px solid #2a5a2a;border-radius:5px;color:#7ab07a;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">CANCEL</button>
        <button onclick="eosSaveRock()" style="flex:1;padding:9px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:5px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">SAVE</button>
      </div>
    </div>
  </div>`;
}

function eosOpenAddRock() {
  const m = document.getElementById('eos-rock-modal');
  if (!m) return;
  document.getElementById('eos-rock-title').value = '';
  document.getElementById('eos-rock-owner').value = '';
  document.getElementById('eos-rock-due').value = '';
  m.style.display = 'flex';
}

async function eosSaveRock() {
  const title = document.getElementById('eos-rock-title').value.trim();
  const owner = document.getElementById('eos-rock-owner').value.trim();
  const dueDate = document.getElementById('eos-rock-due').value;
  if (!title) { alert('Title required'); return; }
  const cur = eosCurrentQuarter();
  await db.collection('rocks').add({
    title, owner, dueDate, q: cur.q, year: cur.year,
    status: 'Not Started', percentComplete: 0,
    createdTs: Date.now()
  });
  document.getElementById('eos-rock-modal').style.display = 'none';
}

async function eosCycleRockStatus(id) {
  const r = _eosRocks.find(x => x._id === id);
  if (!r) return;
  const order = ['Not Started','On Track','Off Track','Complete'];
  const idx = order.indexOf(r.status || 'Not Started');
  const next = order[(idx+1) % order.length];
  const update = { status: next };
  if (next === 'Complete') update.percentComplete = 100;
  await db.collection('rocks').doc(id).update(update);
}

async function eosBumpRock(id, delta) {
  const r = _eosRocks.find(x => x._id === id);
  if (!r) return;
  const cur = Number(r.percentComplete || 0);
  const next = Math.max(0, Math.min(100, cur + delta));
  const update = { percentComplete: next };
  if (next >= 100) update.status = 'Complete';
  else if (next > 0 && r.status === 'Not Started') update.status = 'On Track';
  await db.collection('rocks').doc(id).update(update);
}

async function eosDeleteRock(id) {
  if (!confirm('Delete this rock?')) return;
  await db.collection('rocks').doc(id).delete();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — L10 TO-DOS (7-day clock)
// ═══════════════════════════════════════════════════════════════════════════
function renderTodosSection() {
  const open = _eosTodos.filter(t => !t.done);
  const recent = _eosTodos.filter(t => t.done && (Date.now() - (t.completedTs||0) < 7*86400000));

  const overdue = open.filter(t => eosDaysAgo(t.createdTs) > 7).length;

  return `
  <div style="padding:20px 16px 6px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;">
        ✅ L10 TO-DOS — 7-DAY CLOCK
        <span style="margin-left:8px;background:#1a3a1a;border-radius:4px;padding:2px 8px;font-size:9px;">
          ${open.length} open${overdue > 0 ? ` · <span style="color:#f87171">${overdue} aged &gt;7d</span>` : ''} · ${recent.length} done this week
        </span>
      </div>
      <button onclick="eosOpenAddTodo()" style="padding:6px 14px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:6px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:1px;">+ ADD TO-DO</button>
    </div>
    ${open.length === 0
      ? `<div style="padding:18px;background:#0a1f0a;border:1px dashed #2a5a2a;border-radius:6px;text-align:center;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:11px;">No open to-dos. Add commitments from your L10 meeting.</div>`
      : open.map(eosTodoRow).join('')}
  </div>
  ${eosAddTodoModal()}
  `;
}

function eosTodoRow(t) {
  const age = eosDaysAgo(t.createdTs);
  const aged = age > 7;
  const ageColor = aged ? '#f87171' : age >= 5 ? '#fbbf24' : '#7ab07a';
  return `
  <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:6px;background:${aged?'#2a1010':'#0a1f0a'};border:1px solid ${aged?'#5a1010':'#1a3a1a'};border-radius:6px;">
    <button onclick="eosCompleteTodo('${t._id}')" title="Mark complete" style="width:22px;height:22px;border-radius:50%;border:2px solid #4ade80;background:transparent;color:#4ade80;cursor:pointer;font-size:11px;line-height:1;flex-shrink:0;">✓</button>
    <div style="flex:1;min-width:0;">
      <div style="color:#e8f5ec;font-size:13px;line-height:1.3;">${t.title || ''}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7ab07a;margin-top:2px;">
        ${t.owner ? `${t.owner} · ` : ''}<span style="color:${ageColor}">${age}d old${aged?' ⏰':''}</span>${t.dueDate?` · due ${t.dueDate}`:''}
      </div>
    </div>
    <button onclick="eosDeleteTodo('${t._id}')" title="Delete" style="padding:2px 8px;background:transparent;border:1px solid #5a1010;border-radius:3px;color:#f87171;cursor:pointer;font-size:11px;">×</button>
  </div>`;
}

function eosAddTodoModal() {
  return `
  <div id="eos-todo-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;align-items:center;justify-content:center;padding:16px;">
    <div style="background:#0a1f0a;border:2px solid #4ade80;border-radius:10px;padding:18px;max-width:420px;width:100%;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#4ade80;margin-bottom:12px;">ADD L10 TO-DO</div>
      <input id="eos-todo-title" placeholder="What needs to happen? (action item)" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:8px;">
      <input id="eos-todo-owner" placeholder="Who owns it?" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:8px;">
      <input id="eos-todo-due" type="date" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:14px;">
      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('eos-todo-modal').style.display='none'" style="flex:1;padding:9px;background:transparent;border:1px solid #2a5a2a;border-radius:5px;color:#7ab07a;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">CANCEL</button>
        <button onclick="eosSaveTodo()" style="flex:1;padding:9px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:5px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">SAVE</button>
      </div>
    </div>
  </div>`;
}

function eosOpenAddTodo() {
  document.getElementById('eos-todo-title').value = '';
  document.getElementById('eos-todo-owner').value = '';
  document.getElementById('eos-todo-due').value = '';
  document.getElementById('eos-todo-modal').style.display = 'flex';
}

async function eosSaveTodo() {
  const title = document.getElementById('eos-todo-title').value.trim();
  const owner = document.getElementById('eos-todo-owner').value.trim();
  const dueDate = document.getElementById('eos-todo-due').value;
  if (!title) { alert('Title required'); return; }
  await db.collection('l10Todos').add({ title, owner, dueDate, done: false, createdTs: Date.now() });
  document.getElementById('eos-todo-modal').style.display = 'none';
}

async function eosCompleteTodo(id) {
  await db.collection('l10Todos').doc(id).update({ done: true, completedTs: Date.now() });
}

async function eosDeleteTodo(id) {
  if (!confirm('Delete this to-do?')) return;
  await db.collection('l10Todos').doc(id).delete();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — IDS ISSUES (Identify · Discuss · Solve)
// ═══════════════════════════════════════════════════════════════════════════
function renderIDSSection() {
  const open = _eosIssues.filter(i => i.status !== 'Solved');
  const solved = _eosIssues.filter(i => i.status === 'Solved' && (Date.now() - (i.solvedTs||0) < 14*86400000));
  const high = open.filter(i => i.priority === 'High').length;

  return `
  <div style="padding:20px 16px 6px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1a3a1a;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:#4a8a4a;text-transform:uppercase;">
        💬 IDS ISSUES LIST
        <span style="margin-left:8px;background:#1a3a1a;border-radius:4px;padding:2px 8px;font-size:9px;">
          ${open.length} open${high > 0 ? ` · <span style="color:#f87171">${high} high</span>` : ''} · ${solved.length} solved &lt;14d
        </span>
      </div>
      <button onclick="eosOpenAddIssue()" style="padding:6px 14px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:6px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:1px;">+ ADD ISSUE</button>
    </div>
    ${open.length === 0
      ? `<div style="padding:18px;background:#0a1f0a;border:1px dashed #2a5a2a;border-radius:6px;text-align:center;color:#4a8a4a;font-family:'IBM Plex Mono',monospace;font-size:11px;">No open issues. Add anything that needs to be discussed/solved at the next L10.</div>`
      : open.sort((a,b) => (b.priority==='High'?1:0)-(a.priority==='High'?1:0)).map(eosIssueRow).join('')}
  </div>
  ${eosAddIssueModal()}
  `;
}

function eosIssueRow(i) {
  const priColors = { High:'#f87171', Med:'#fbbf24', Low:'#7ab07a' };
  const stColors = { Identified:'#7ab0f6', Discussing:'#fbbf24', Solved:'#4ade80' };
  const pc = priColors[i.priority] || '#7ab07a';
  const sc = stColors[i.status] || '#7ab07a';
  return `
  <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;margin-bottom:6px;background:#0a1f0a;border:1px solid #1a3a1a;border-radius:6px;">
    <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0;">
      <span style="background:${pc}22;color:${pc};border-radius:3px;padding:1px 6px;font-family:'IBM Plex Mono',monospace;font-size:8px;font-weight:700;text-align:center;">${i.priority || 'Low'}</span>
      <span style="background:${sc}22;color:${sc};border-radius:3px;padding:1px 6px;font-family:'IBM Plex Mono',monospace;font-size:8px;font-weight:700;text-align:center;">${i.status || 'Identified'}</span>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="color:#e8f5ec;font-size:13px;line-height:1.3;">${i.title || ''}</div>
      ${i.description ? `<div style="color:#7ab07a;font-size:11px;margin-top:3px;">${i.description}</div>` : ''}
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;margin-top:3px;">
        ${i.owner ? `${i.owner} · ` : ''}${eosDaysAgo(i.createdTs)}d old
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
      <button onclick="eosCycleIssueStatus('${i._id}')" title="Cycle status" style="padding:2px 8px;background:transparent;border:1px solid #2a5a2a;border-radius:3px;color:#7ab07a;cursor:pointer;font-size:11px;">↻</button>
      <button onclick="eosDeleteIssue('${i._id}')" title="Delete" style="padding:2px 8px;background:transparent;border:1px solid #5a1010;border-radius:3px;color:#f87171;cursor:pointer;font-size:11px;">×</button>
    </div>
  </div>`;
}

function eosAddIssueModal() {
  return `
  <div id="eos-issue-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;align-items:center;justify-content:center;padding:16px;">
    <div style="background:#0a1f0a;border:2px solid #4ade80;border-radius:10px;padding:18px;max-width:480px;width:100%;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#4ade80;margin-bottom:12px;">ADD ISSUE</div>
      <input id="eos-issue-title" placeholder="Issue (one sentence)" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:8px;">
      <textarea id="eos-issue-desc" placeholder="More detail (optional)" rows="3" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:12px;margin-bottom:8px;resize:vertical;"></textarea>
      <input id="eos-issue-owner" placeholder="Owner (who's accountable?)" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:8px;">
      <select id="eos-issue-pri" style="width:100%;padding:9px;background:#000;border:1px solid #2a5a2a;border-radius:5px;color:#e8f5ec;font-family:inherit;font-size:13px;margin-bottom:14px;">
        <option value="Low">Priority: Low</option>
        <option value="Med" selected>Priority: Medium</option>
        <option value="High">Priority: High</option>
      </select>
      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('eos-issue-modal').style.display='none'" style="flex:1;padding:9px;background:transparent;border:1px solid #2a5a2a;border-radius:5px;color:#7ab07a;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">CANCEL</button>
        <button onclick="eosSaveIssue()" style="flex:1;padding:9px;background:#1a3a1a;border:1.5px solid #4ade80;border-radius:5px;color:#4ade80;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">SAVE</button>
      </div>
    </div>
  </div>`;
}

function eosOpenAddIssue() {
  document.getElementById('eos-issue-title').value = '';
  document.getElementById('eos-issue-desc').value = '';
  document.getElementById('eos-issue-owner').value = '';
  document.getElementById('eos-issue-pri').value = 'Med';
  document.getElementById('eos-issue-modal').style.display = 'flex';
}

async function eosSaveIssue() {
  const title = document.getElementById('eos-issue-title').value.trim();
  const description = document.getElementById('eos-issue-desc').value.trim();
  const owner = document.getElementById('eos-issue-owner').value.trim();
  const priority = document.getElementById('eos-issue-pri').value;
  if (!title) { alert('Title required'); return; }
  await db.collection('idsIssues').add({
    title, description, owner, priority,
    status: 'Identified', createdTs: Date.now()
  });
  document.getElementById('eos-issue-modal').style.display = 'none';
}

async function eosCycleIssueStatus(id) {
  const i = _eosIssues.find(x => x._id === id);
  if (!i) return;
  const order = ['Identified','Discussing','Solved'];
  const idx = order.indexOf(i.status || 'Identified');
  const next = order[(idx+1) % order.length];
  const update = { status: next };
  if (next === 'Solved') update.solvedTs = Date.now();
  await db.collection('idsIssues').doc(id).update(update);
}

async function eosDeleteIssue(id) {
  if (!confirm('Delete this issue?')) return;
  await db.collection('idsIssues').doc(id).delete();
}

// Expose key functions to window so HTML onclick handlers can find them
window.renderRocksSection = renderRocksSection;
window.renderTodosSection = renderTodosSection;
window.renderIDSSection   = renderIDSSection;
window.eosSubscribe       = eosSubscribe;
window.eosOpenAddRock     = eosOpenAddRock;
window.eosSaveRock        = eosSaveRock;
window.eosCycleRockStatus = eosCycleRockStatus;
window.eosBumpRock        = eosBumpRock;
window.eosDeleteRock      = eosDeleteRock;
window.eosOpenAddTodo     = eosOpenAddTodo;
window.eosSaveTodo        = eosSaveTodo;
window.eosCompleteTodo    = eosCompleteTodo;
window.eosDeleteTodo      = eosDeleteTodo;
window.eosOpenAddIssue    = eosOpenAddIssue;
window.eosSaveIssue       = eosSaveIssue;
window.eosCycleIssueStatus= eosCycleIssueStatus;
window.eosDeleteIssue     = eosDeleteIssue;
