// ═══════════════════════════════════════════════════════════════════════════
// help.js — How To Use / Instructions
// A clickable, department-organized guide. Static content (works offline).
// Reached from the "📖 How To Use" button on the home screen.
// Each task shows SIMPLE numbered steps + a "More detail" toggle for supervisors.
// ═══════════════════════════════════════════════════════════════════════════

// ── Content model ───────────────────────────────────────────────────────────
// Departments → tasks → { title, simple:[steps], detail:[notes] }
const HELP_CONTENT = [
  {
    id: 'barns',
    icon: '🐓',
    name: 'Barns / Daily Walks',
    color: '#4ade80',
    blurb: 'Morning Walk · Barn Walk · Daily Employee Check',
    tasks: [
      {
        title: '☀️ Morning Walk & Barn Walk (start of shift)',
        simple: [
          'From the home screen, tap your location (Hegins or Danville).',
          'Tap the green PRODUCTION tile.',
          'Step 1 — type your name. Step 2 — pick the farm. Step 3 — pick the house.',
          'MORNING WALK: enter Water PSI (normal is 10–60), Temp, Headcount. Tap Feeders / Fans / Blowers OK or Issue.',
          'BARN WALK: enter Dead Birds Found (type 0 if none), Loose Birds, Bin A and Bin B tons. Mark Water OK and Rodent activity. Add notes if needed.',
          'Tap ✓ Submit Barn Walk. You will see "Done!"',
        ],
        detail: [
          'Required fields are marked with *. Water PSI and Dead Birds must be filled before you can submit.',
          'The PSI box turns red and warns you if the number is outside 10–60. The Dead Birds box turns red if more than 0 — that walk gets flagged on the Scorecard.',
          'Your work auto-saves as a draft as you type, so if the iPad sleeps or closes you can pick up where you left off.',
          'Do one house at a time. After you submit, start again at Pick House for the next barn.',
          'No internet? It still saves and sends automatically once you are back online.',
        ],
      },
      {
        title: '✅ Daily Employee Check (block-by-block)',
        simple: [
          'Location → PRODUCTION → Daily Employee Check.',
          'Type the worker name at the top.',
          'Work through each block. A block stays open until every question is answered.',
          'Tap Done on a block — it collapses and the next one opens.',
          'For any count you do not have, tap N/A.',
          'When all blocks are done, tap Submit.',
        ],
        detail: [
          'Every answer is required before the Submit button works — this is by design so nothing gets skipped.',
          'Completed blocks collapse to keep the screen short; tap a block header to reopen and change an answer.',
          'Notes boxes are optional except where the checklist marks them required.',
        ],
      },
    ],
  },
  {
    id: 'maint',
    icon: '🔧',
    name: 'Maintenance / Work Orders',
    color: '#3b82f6',
    blurb: 'New work order · PMs · Mark done',
    tasks: [
      {
        title: '🔧 Enter a Work Order',
        simple: [
          'On the home screen tap "🔧 New Work Order" (or open Maintenance → New Work Order).',
          'Pick the Farm, then pick the House.',
          'Write a short Problem (e.g. "H3 fan belt squealing").',
          'Add a Description — what you saw, heard, or measured.',
          'Set Priority: 🔴 Urgent, 🟡 High, or 🟢 Routine.',
          'Put your name in "Submitted by" and tap Submit.',
        ],
        detail: [
          'If a similar open work order already exists, the app warns you so you do not create a duplicate.',
          'No internet? It saves and shows "Saved — Will Send When Online," then sends automatically when you reconnect.',
          'Urgent and High work orders send a notification to the maintenance team right away.',
          'You can also start a work order straight from a barn walk issue — it carries the note over for you.',
        ],
      },
      {
        title: '🛠 Do a PM and Mark It Done',
        simple: [
          'Open Maintenance → PM (preventive maintenance) list.',
          'Tap the PM you are doing.',
          'Work down the checklist — tap each step to check it off.',
          'When every step is checked, tap Mark Done.',
          'Enter your name on the sign-off and confirm.',
        ],
        detail: [
          'Mark Done stays locked until all checklist steps are ticked — this enforces the procedure.',
          'To knock out several at once, use Bulk PM select and choose the daily / weekly / MWF group.',
          'Procedures can be edited by a supervisor; changes are saved and show for everyone next time.',
          'Bulk PM and sign-offs also work offline and sync later.',
        ],
      },
    ],
  },
  {
    id: 'processing',
    icon: '🏭',
    name: 'Processing Plant',
    color: '#d69e2e',
    blurb: 'Units · Counts · Maintenance',
    tasks: [
      {
        title: '🏭 Open the Processing Plant',
        simple: [
          'On the home screen (where you pick a location), tap the PROCESSING button.',
          'You will see cards: Maintenance, Processing Units, and Processing PMs.',
          'Maintenance = work orders & PMs for the plant. Processing PMs = the plant PM schedule.',
          'Tap Processing Units to work the units: Packers, Cleaners, Conveyors, Cleanup.',
        ],
        detail: [
          'Processing is its own button on the front screen — Hegins and Danville do not show it.',
          'Master still brings everything together, including processing.',
        ],
      },
      {
        title: '📦 Log a count or start a work order on a unit',
        simple: [
          'Processing → Processing Units.',
          'Find the unit: Packers, Cleaners, Conveyors, or Cleanup.',
          'Tap ＋ Count, type the number, and confirm — it logs for today.',
          'Tap 🔧 WO to start a work order already set to that unit.',
        ],
        detail: [
          'Each unit shows how many work orders are open and today\'s logged count.',
          'Counts and work orders save and sync like everything else.',
        ],
      },
    ],
  },
];

// ── Render ────────────────────────────────────────────────────────────────
function _helpStepList(steps, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const items = steps.map(s => `<li style="margin-bottom:7px;line-height:1.5;">${s}</li>`).join('');
  return `<${tag} style="margin:6px 0 0;padding-left:20px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#d8e8d8;">${items}</${tag}>`;
}

function _helpTaskCard(task, deptColor, key) {
  return `
    <div style="background:#0a1a0a;border:1px solid #1e3a1e;border-radius:12px;margin-bottom:10px;overflow:hidden;">
      <button onclick="helpToggle('task-${key}')" style="width:100%;padding:13px 14px;background:transparent;border:none;color:#f0ead8;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;">
        <span style="flex:1;line-height:1.3;">${task.title}</span>
        <span id="task-${key}-caret" style="color:${deptColor};font-size:16px;">+</span>
      </button>
      <div id="task-${key}" style="display:none;padding:0 14px 14px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${deptColor};letter-spacing:2px;text-transform:uppercase;margin:4px 0 2px;">Quick Steps</div>
        ${_helpStepList(task.simple, true)}
        <button onclick="helpToggle('detail-${key}',this)" style="margin-top:12px;padding:7px 12px;background:#0d1f0d;border:1px solid #2a5a2a;border-radius:50px;color:#7ab07a;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;">ℹ️ More detail</button>
        <div id="detail-${key}" style="display:none;margin-top:10px;padding:11px 13px;background:#081208;border-left:3px solid ${deptColor};border-radius:6px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${deptColor};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Good to know</div>
          ${_helpStepList(task.detail, false)}
        </div>
      </div>
    </div>`;
}

function _helpDeptCard(dept) {
  const tasksHtml = dept.tasks.map((t, i) => _helpTaskCard(t, dept.color, dept.id + '-' + i)).join('');
  return `
    <div style="margin-bottom:14px;">
      <button onclick="helpToggle('dept-${dept.id}',this)" style="width:100%;padding:16px 16px;background:linear-gradient(135deg,#10241a,#0b1a0b);border:2px solid ${dept.color};border-radius:14px;color:#fff;cursor:pointer;text-align:left;display:flex;align-items:center;gap:14px;">
        <span style="font-size:28px;line-height:1;">${dept.icon}</span>
        <div style="flex:1;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:#f0ead8;letter-spacing:1.5px;text-transform:uppercase;">${dept.name}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7ab07a;line-height:1.4;margin-top:3px;">${dept.blurb}</div>
        </div>
        <span id="dept-${dept.id}-caret" style="font-size:20px;color:${dept.color};">+</span>
      </button>
      <div id="dept-${dept.id}" style="display:none;padding:12px 4px 2px;">
        ${tasksHtml}
      </div>
    </div>`;
}

function renderHelp() {
  const body = document.getElementById('help-body');
  if (!body) return;
  body.innerHTML = `
    <div style="background:#0d1f0d;border:1px solid #1e3a1e;border-radius:12px;padding:13px 15px;margin-bottom:16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#9cc79c;line-height:1.6;">
        Tap a department below to see how to do each task. Each task has <b style="color:#f0ead8;">Quick Steps</b> to follow, and a <b style="color:#f0ead8;">More detail</b> button for tips and edge cases.
      </div>
    </div>
    ${HELP_CONTENT.map(_helpDeptCard).join('')}`;
}

// ── Toggle helper ───────────────────────────────────────────────────────────
function helpToggle(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.style.display === 'none' || el.style.display === '';
  el.style.display = open ? 'block' : 'none';
  const caret = document.getElementById(id + '-caret');
  if (caret) caret.textContent = open ? '–' : '+';
}

// ── Open / close overlay ─────────────────────────────────────────────────────
function openHelp() {
  renderHelp();
  const ov = document.getElementById('help-overlay');
  if (ov) ov.style.display = 'block';
  try { window.scrollTo(0, 0); } catch (e) {}
}
function closeHelp() {
  const ov = document.getElementById('help-overlay');
  if (ov) ov.style.display = 'none';
}

if (typeof window !== 'undefined') {
  window.openHelp = openHelp;
  window.closeHelp = closeHelp;
  window.helpToggle = helpToggle;
  window.renderHelp = renderHelp;
}
