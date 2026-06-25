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
      {
        title: '📋 End-of-Shift report (before you leave)',
        simple: [
          'Location → PRODUCTION → End-of-Shift (under Morning Walk).',
          'Review the auto-summary of the day at the top.',
          'Check off the end-of-shift items.',
          'Type your name to sign off, then tap Submit.',
        ],
        detail: [
          'The summary is built for you from the day\'s walks and work — you just confirm and sign.',
          'It is per-facility, so do it for the site you worked.',
        ],
      },
      {
        title: '💩 Manure — belt %, daily PM, weekly PM & Submit',
        simple: [
          'Location (Hegins or Danville) → tap the 💩 Manure card.',
          'For each house, for every collector (C1–C6), tap how much of the belt ran: 0, 50, or 100.',
          'Tap ☐ PM on a collector once its daily PM is done — it turns ✓ PM.',
          'Per-house shortcuts: All 100% sets every collector to 100; ✓ All PM checks all six PMs.',
          'When a house is finished, tap ✓ Submit House — daily.',
          'Manure tech: tap ☐ Mark weekly PM on each house once its weekly manure PM is done.',
        ],
        detail: [
          'Houses shown: Hegins 4–8, Danville 1–5, six collectors each. It saves as you tap — no separate Save.',
          'Once EVERY house for the site is submitted for the day, the daily manure PMs (run belts, check belts, drying fans, trip switch) check themselves off in the Maintenance PM tracker automatically — no double entry.',
          'Once EVERY house has its weekly box ticked, the weekly manure PMs (clean pit, auger rollers, belt tracking…) check off in the tracker too.',
          'Submit a house with fewer than 6 collectors logged and it asks "submit anyway?" — a reminder, not a block.',
          'Master shows both Hegins and Danville; the Processing Plant has no manure houses.',
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
      {
        title: '✏️ Edit a work order after it is submitted',
        simple: [
          'Open Maintenance → Work Orders and find the order (it may be in the Action Rail).',
          'Tap the ✏️ Edit button on the card.',
          'Change the problem, description, priority, who it is assigned to, parts, or hours.',
          'Tap Save Changes.',
        ],
        detail: [
          'Use this to fix a typo, bump priority, or reassign — no need to delete and re-create.',
          'It does not change the location or house; make a new one if those are wrong.',
        ],
      },
      {
        title: '⚡ Action Rail — your live to-do list',
        simple: [
          'On any work order card, tap the ⚡ button to move it up to the Action Rail.',
          'From the rail: ✓ Done closes it out, 💬 Update adds a note, ↩ To List sends it back.',
          'Use the rail for the few jobs you are actively working right now.',
        ],
        detail: [
          'Closing from the rail opens the normal close-out (who did it, parts, photos), then it drops off the rail.',
          'The 📋 button flags a work order for the meeting agenda.',
        ],
      },
      {
        title: '📖 Edit or add a Work Instruction (WI)',
        simple: [
          'Open Maintenance → WI (Work Instructions).',
          'Tap a WI to open it, then tap Edit — or use + New to add one.',
          'Fill in the title, department, and step-by-step instructions; add photos if helpful.',
          'Tap Save.',
        ],
        detail: [
          'Edited or new WIs save for everyone and show next time that task is opened.',
          'Photos store right in the instruction, so they work offline.',
        ],
      },
      {
        title: '🛠 Edit a PM procedure (its steps)',
        simple: [
          'Open Maintenance → PM and tap the PM you want to change.',
          'Tap Edit Procedure.',
          'Add or change the Safety, Tools, Steps, and Corrective items.',
          'Tap Save — the updated procedure then shows for everyone.',
        ],
        detail: [
          'This keeps the checklist current as a machine or process changes.',
          'The built-in steps stay as a fallback until you save an edit.',
        ],
      },
      {
        title: '🗂 Add a maintenance project',
        simple: [
          'Open Maintenance → Projects.',
          'Tap + New Project.',
          'Type a title (that is all that is required) — optionally the machine, who is assigned, and a due date.',
          'Add tasks one per line, then tap the chips: Requested by (Team / Management), What\'s it for (5S, Barns, Equipment…), and Priority.',
          'Tap Create Project.',
        ],
        detail: [
          'Use projects for bigger efforts that are more than one work order — a rebuild, a 5S push, etc.',
          'Tap a task to check it off; the progress bar fills as you go, and urgent projects float to the top.',
          'Projects are per-location, just like work orders.',
        ],
      },
    ],
  },
  {
    id: 'processing',
    icon: '🏭',
    name: 'Processing Plant',
    color: '#d69e2e',
    blurb: 'Cases · Downtime · Breakage · Maintenance',
    tasks: [
      {
        title: '🏭 Open the Processing Plant',
        simple: [
          'On the front screen (where you pick a location), tap the PROCESSING button.',
          'You will see three cards: Maintenance, Packing Log, and Processing PMs.',
          'Maintenance and Processing PMs show ONLY the plant now — no Hegins or Danville mixed in.',
          'You can create new plant work orders right from there.',
        ],
        detail: [
          'Processing is its own location button — Hegins and Danville do not show it.',
          'Master still brings everything together, including the plant.',
        ],
      },
      {
        title: '📦 Log packing — cases, downtime, breakage',
        simple: [
          'Processing → Packing Log.',
          'Pick the line (Packer 1, 2, …).',
          'Enter Cases packed, any Downtime (minutes + a reason), and Breakage / cracks.',
          'Tap ✓ Log Packing.',
        ],
        detail: [
          'The top shows today\'s totals — cases packed, downtime minutes, and breakage.',
          'Below that is a by-line breakdown so you can compare packers.',
          'Everything saves and syncs like the rest of the app.',
        ],
      },
    ],
  },
  {
    id: 'basics',
    icon: '⚙️',
    name: 'Getting Around',
    color: '#9ca3af',
    blurb: 'Locations · Language · Brightness',
    tasks: [
      {
        title: '📍 Switch location (Hegins / Danville / Processing / Master)',
        simple: [
          'On the front screen, tap the location you want: Hegins, Danville, Processing Plant, or Master.',
          'Work orders, PMs, and staff then show just that site.',
          'Master shows every site combined.',
        ],
        detail: [
          'The app remembers your last location for next time.',
          'To switch while inside, tap ← Locations to go back to the picker.',
        ],
      },
      {
        title: '🌐 Language & 🔆 brightness',
        simple: [
          'Tap the 🌐 button at the top of the front screen to switch English ⇄ Spanish.',
          'Tap Dark, Light, or White at the top to change the background brightness.',
        ],
        detail: [
          'Both choices are remembered on that tablet.',
          'Use White or Light when reading in bright daylight.',
        ],
      },
      {
        title: '👥 Add a team member & set their site',
        simple: [
          'Open Staff from the home screen.',
          'Add the person\'s name and role.',
          'On their card, tap Hegins, Danville, or Both to set where they work.',
          'That keeps each site\'s name lists correct when picking who did the work.',
        ],
        detail: [
          'Only people tagged to a site (or Both, for maintenance techs) show in that site\'s pickers.',
          'Anyone left untagged is flagged in amber so you can fix it.',
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
