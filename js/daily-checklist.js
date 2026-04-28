// DAILY EMPLOYEE TASK CHECKLIST + LIVE DASHBOARD
// Per-barn shift checklist with time tracking and end-of-day submit
// ═══════════════════════════════════════════════════════════════════

const CL_TASKS = [
  // 🔴 Priority 1
  { id:'fwv',         group:'p1',         label:'Monitor Feed, Water, Ventilation',          sub:'Check all systems — note any issues below',                             timeMin:null, freq:'always'       },

  // 🟡 Core Work Block
  { id:'bird',        group:'core',        label:'Full Bird & Equipment Check',               sub:'Mortality · chute · sick/loose birds · egg belt · cage damage',         timeMin:120,  freq:'always'       },
  { id:'tubes',       group:'core',        label:'Clean Water Tubes (front & back)',           sub:null,                                                                    timeMin:30,   freq:'always'       },
  { id:'front',       group:'core',        label:'Clean Front of House',                       sub:'After egg run',                                                         timeMin:45,   freq:'always'       },

  // 🔵 Cleaning Block
  { id:'blowoff',     group:'cleaning',    label:'Blow Off',                                   sub:'Walls · cages · egg collectors · floors',                               timeMin:210,  freq:'toggle'       },
  { id:'wheelbarrow', group:'cleaning',    label:'Wheelbarrow + Back Cleanup',                 sub:null,                                                                    timeMin:25,   freq:'always'       },

  // 🟢 Rotational
  { id:'undercage',   group:'rotational',  label:'Under Cage Cleaning',                        sub:null,                                                                    timeMin:180,  freq:'2x-week'      },
  { id:'hallway',     group:'rotational',  label:'Hallway Cleaning',                           sub:null,                                                                    timeMin:45,   freq:'every-other'  },

  // 🟣 Weekly
  { id:'fly',         group:'weekly',      label:'Fly Check',                                  sub:'Tuesday only',                                                          timeMin:15,   freq:'tuesday'      },
  { id:'rodent',      group:'weekly',      label:'Rodent Check',                               sub:'Friday only',                                                           timeMin:30,   freq:'friday'       },
];

const CL_GROUPS = {
  p1:         { label:'🔴 PRIORITY 1 — ALWAYS FIRST', color:'#e53e3e', bg:'#1a0505', border:'#5a1010' },
  core:       { label:'🟡 CORE WORK BLOCK',            color:'#d69e2e', bg:'#1a1200', border:'#4a3500' },
  cleaning:   { label:'🔵 CLEANING BLOCK',             color:'#3b82f6', bg:'#0d1f3a', border:'#1e3a6a' },
  rotational: { label:'🟢 ROTATIONAL TASKS',           color:'#4caf50', bg:'#0a1f0a', border:'#2a5a2a' },
  weekly:     { label:'🟣 WEEKLY TASKS',               color:'#9b59b6', bg:'#1a0a2a', border:'#3a1a5a' },
};

const CL_FARMS = { Hegins:8, Danville:5, Rushtown:5, Turbotville:4, 'W&M':2 };

// ═══════════════════════════════════════════════════════════════════
// BUILT-IN WORK INSTRUCTIONS (source of truth per checklist task)
// ═══════════════════════════════════════════════════════════════════
const CL_INSTRUCTIONS = {
  fwv: {
    title: 'Monitor Feed, Water, Ventilation',
    purpose: 'Birds depend on these three systems every minute. Catch failures fast — minutes matter.',
    ppe: 'Coveralls · gloves · dust mask',
    tools: 'Phone (for photos) · flashlight',
    timeMin: 15,
    steps: [
      'Walk the full length of the house and look at every feed line — feed should be present in pans, no clumping or empty stretches.',
      'Check water lines and drinkers — water should be flowing at every nipple/cup, no dripping or dry spots.',
      'Listen and feel for ventilation — fans running, air moving, no dead spots, no unusual smells (ammonia, dust spike).',
      'Read controller temp + set point. Note actual vs target on the checklist.',
      'Photo any issue (empty pan, dry drinker, dead fan, alarm light) and submit a Work Order from the checklist.',
    ],
    verification: 'Every pan has feed · every nipple drips when triggered · all fans turning · controller in normal range with no active alarms.',
  },
  bird: {
    title: 'Full Bird & Equipment Check',
    purpose: 'Find mortality, sick or loose birds, and equipment failures before they become bigger problems.',
    ppe: 'Coveralls · gloves · boots',
    tools: 'Mortality bucket · flashlight · cage-row clipboard',
    timeMin: 120,
    steps: [
      'Start at the front, walk every cage row. Pull all dead birds — note count by row.',
      'Look for sick birds (huddled, eyes closed, ruffled feathers) — pull and isolate.',
      'Look for loose birds outside cages — recover and return.',
      'Check chute level — should be evenly loaded, not packed at one end.',
      'Watch the egg belt for jams, broken eggs piling up, or off-track belt.',
      'Inspect cage doors, latches, and bottom wires — flag any damaged cages.',
      'Total mortality count goes on the checklist + create a Work Order for any equipment damage found.',
    ],
    verification: 'No dead/sick birds left in cages · belt running clean · no loose birds · no flagged cage damage left without a WO.',
  },
  tubes: {
    title: 'Clean Water Tubes (front & back)',
    purpose: 'Biofilm in water tubes makes birds sick and tanks intake.',
    ppe: 'Gloves · safety glasses',
    tools: 'Tube brush · bucket · sanitizer (per label) · flashlight',
    timeMin: 30,
    steps: [
      'Shut off water at the regulator for the line you are cleaning.',
      'Open the end cap and let the line drain into the bucket.',
      'Run the tube brush through the full length. Repeat at the back of house.',
      'Flush with clean water until it runs clear.',
      'If sanitizer is on the schedule today, dose per label and let dwell, then flush again.',
      'Re-cap, restore pressure, walk the line and confirm every drinker is wet.',
    ],
    verification: 'Water runs clear at the end cap · every nipple drips on demand · no leaks at fittings.',
    warnings: 'Do NOT skip the flush after sanitizer — birds cannot drink chlorinated water at dose strength.',
  },
  front: {
    title: 'Clean Front of House',
    purpose: 'The front is the first thing visitors and inspectors see — and where the most cross-contamination risk lives.',
    ppe: 'Gloves · dust mask',
    tools: 'Broom · scraper · trash can · rags',
    timeMin: 45,
    steps: [
      'Sweep all dust, feathers, and feed off the floor from the door back to the first cage row.',
      'Scrape any caked manure off walls, doors, and the threshold.',
      'Wipe down door handles, light switches, and the controller face.',
      'Empty the trash can. Replace bag.',
      'Restock paper towels, sanitizer, and gloves at the entry station.',
      'Roll up hoses and cords. Hang tools on the rack.',
    ],
    verification: 'Floor is clean enough that nothing tracks back into the house · entry station fully stocked · no trash overflowing.',
  },
  blowoff: {
    title: 'Blow Off (Walls · Cages · Egg Collectors · Floors)',
    purpose: 'Dust on cages and equipment kills airflow, attracts mites, and is a fire hazard.',
    ppe: 'Coveralls · dust mask (P100 or N95) · safety glasses · hearing protection',
    tools: 'Backpack blower · extension wand · spare fuel',
    timeMin: 210,
    steps: [
      'Start at the back of the house and work toward the door — never blow dust over a clean section.',
      'Walls: top down. Get cobwebs and dust off the rafters first.',
      'Cages: blow horizontally across the top, then down the rows. Don\'t blast birds directly — angle to flush dust off the structure.',
      'Egg collectors and belts: turn collectors OFF before blowing the belt area.',
      'Floors: last step. Push everything to the front and sweep out.',
      'Empty blower fuel and check filter at end of shift.',
    ],
    verification: 'No visible dust pile on cage tops · belt area clean · floor has no drift piles · no birds visibly stressed.',
    warnings: 'Hearing protection is REQUIRED. Backpack blowers exceed 100 dB. Eye protection is REQUIRED — debris will come back at you.',
  },
  wheelbarrow: {
    title: 'Wheelbarrow + Back Cleanup',
    purpose: 'Keeps the back of house clear so the manure system runs and emergency exits stay open.',
    ppe: 'Gloves · boots',
    tools: 'Wheelbarrow · shovel · scraper · trash can',
    timeMin: 25,
    steps: [
      'Sweep loose feed and manure from the back walkway into a pile.',
      'Shovel the pile into the wheelbarrow.',
      'Dump into the manure pit / compost area per farm rules.',
      'Scrape any caked spots on the back walls and doors.',
      'Confirm the back emergency exit is clear — nothing blocking the door swing.',
      'Rinse the wheelbarrow and hang shovel/scraper on the rack.',
    ],
    verification: 'Back walkway is walkable · emergency exit swings free · tools stored.',
  },
  undercage: {
    title: 'Cleaning Under Cages',
    purpose: 'Train operators and new hires on the correct procedure so the task is performed the same way, every time, by everyone.',
    ppe: 'Boots, face mask, push shovel, scraper, scoop shovel, wheelbarrow, broom/blower',
    tools: 'Standard maintenance tool kit and any items called out in the steps.',
    timeMin: 180,
    steps: [
      'Scrape under cages and drag out all fallen debris into aisle.',
      'Push waste into piles in the aisles.',
      'Pick up waste with scoop shovel and place in wheelbarrow.',
      'Empty wheelbarrow on the floor in the back of the house.',
      'Sweep or blow any dust and debris left on the floor to the back of the house into a pile.',
    ],
    verification: 'All 5 steps completed; equipment runs without abnormal sound, smell, or vibration; area cleaned and tools returned; sign off in the daily log or work order.',
    warnings: 'DO NOT EMPTY WHEELBARROW ON PIT BELTS!',
  },
  hallway: {
    title: 'Hallway Cleaning',
    purpose: 'The hallway is shared between barns — dust and manure here moves disease between flocks.',
    ppe: 'Gloves · dust mask',
    tools: 'Broom · scraper · mop · bucket · sanitizer',
    timeMin: 45,
    steps: [
      'Sweep the full length end to end.',
      'Scrape any caked manure or feed off the floor and walls.',
      'Mop with sanitizer at label dilution.',
      'Wipe down door handles between barns and the foot bath frame.',
      'Refill foot baths with fresh sanitizer to label strength.',
      'Restock entry stations as needed (gloves, masks, paper towels).',
    ],
    verification: 'Floor mopped end-to-end · all foot baths fresh · door handles wiped · no debris piles left.',
  },
  fly: {
    title: 'Fly Check (Tuesday)',
    purpose: 'Spot fly populations early — once they explode they are 10x harder to control.',
    ppe: 'Coveralls · gloves',
    tools: 'Spot card / scudder index card · pen · phone for photos',
    timeMin: 15,
    steps: [
      'Place spot cards at the standard locations (front, mid, back of house — same spots every week).',
      'Count spots per card vs. last week.',
      'Walk the manure pit and note any larva activity.',
      'Photograph any heavy fly clusters on cage supports or walls.',
      'Record the count on the checklist. If above threshold, alert the manager and submit a WO for treatment.',
    ],
    verification: 'Spot cards placed · counts logged · any threshold breach reported.',
  },
  rodent: {
    title: 'Rodents and Rodent Bait',
    purpose: 'Train operators and new hires on the correct procedure so the task is performed the same way, every time, by everyone.',
    ppe: 'Gloves, face mask, boots, 5-gallon bucket',
    tools: 'Standard maintenance tool kit and any items called out in the steps.',
    timeMin: 30,
    steps: [
      'Check rodent traps on the top and bottom floors of the house on the outside aisles and empty into a 5-gallon bucket.',
      'Count the number of rodent caught by the rodent traps.',
      'Record the number of rodents caught on the whiteboard in the front o the house.',
      'Check black bait boxes and bait tubes on the top and bottom of the house on the outside aisles.',
      'Add more bait to the black bait boxes and bait tubes if no bait is present.',
      'Notify supervisor if running low on bait.',
      'Wash your hands.',
    ],
    verification: 'All 7 steps completed; equipment runs without abnormal sound, smell, or vibration; area cleaned and tools returned; sign off in the daily log or work order.',
    warnings: 'Do not touch rodent bait without gloves. Wash hands after handling.',
  },
};

// Open built-in instructions modal (does NOT depend on Firestore data)
function clShowBuiltinWI(taskId) {
  const wi = CL_INSTRUCTIONS[taskId];
  const task = CL_TASKS.find(t => t.id === taskId);
  if (!wi || !task) return false;
  const grp = CL_GROUPS[task.group] || {};
  const stepsHtml = (wi.steps||[]).map((s,i) =>
    `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #1a3a1a;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:${grp.color||'#7ab07a'};min-width:22px;flex-shrink:0;">${i+1}.</span>
      <span style="font-size:13px;color:#e8f5ec;line-height:1.5;">${s}</span>
    </div>`
  ).join('');
  const strip = (label, txt, color, bg) => txt
    ? `<div style="background:${bg};border:1px solid ${color};border-radius:8px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${color};margin-bottom:4px;">${label}</div>
        <div style="font-size:13px;color:#e8f5ec;line-height:1.45;">${txt}</div>
      </div>`
    : '';
  const html = `
    <div class="overlay open" id="cl-wi-modal" style="z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.78);position:fixed;inset:0;padding:16px;" onclick="if(event.target===this)document.getElementById('cl-wi-modal').remove()">
      <div style="background:#0a1a0a;border:1.5px solid #2a5a2a;border-radius:14px;max-width:560px;width:100%;max-height:92vh;overflow-y:auto;padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:10px;">
          <div style="flex:1;">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${grp.color||'#7ab07a'};letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">${(grp.label||'').replace(/^[^A-Z]*/,'')}</div>
            <h3 style="margin:0;color:#f0ead8;font-size:18px;line-height:1.25;">${wi.title}</h3>
            ${wi.timeMin ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;margin-top:4px;">⏱ ${wi.timeMin} min · Built-in standard</div>` : ''}
          </div>
          <button onclick="document.getElementById('cl-wi-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#7a9a7a;padding:0 4px;">✕</button>
        </div>
        ${strip('📋 Purpose',     wi.purpose,      '#4caf50','#0a1f0a')}
        ${strip('🦺 PPE',          wi.ppe,          '#d69e2e','#1a1200')}
        ${strip('🔧 Tools',        wi.tools,        '#3b82f6','#0d1f3a')}
        ${strip('⚠️ Warnings',     wi.warnings,     '#e53e3e','#1a0505')}
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#7a9a7a;letter-spacing:1px;text-transform:uppercase;margin:14px 0 6px;">Steps</div>
        ${stepsHtml}
        ${strip('✅ What Good Looks Like', wi.verification, '#9b59b6','#1a0a2a')}
        <div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid #1a3a1a;">
          <button onclick="document.getElementById('cl-wi-modal').remove()" style="flex:1;padding:11px;background:#0a2a0a;border:1.5px solid #2a5a2a;border-radius:8px;color:#7ab07a;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;">CLOSE</button>
        </div>
      </div>
    </div>`;
  // Remove any existing modal
  const ex = document.getElementById('cl-wi-modal'); if (ex) ex.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  return true;
}



let _cl = {
  farm: '', barn: '', worker: '',
  date: new Date().toISOString().slice(0,10),
  checks:  {},   // taskId → { done, note }
  include: {},   // taskId → bool
  submitted: false,
  _fbId: null,
};

let _chkActiveTab = 'overview';

function chkTab(tab) {
  _chkActiveTab = tab;
  const ov   = document.getElementById('panel-check-body');
  const dash = document.getElementById('cl-dashboard');
  const tk   = document.getElementById('panel-check-tasks');
  const btnOv = document.getElementById('chk-tab-overview');
  const btnTk = document.getElementById('chk-tab-tasks');
  if (tab === 'overview') {
    if (ov)   ov.style.display   = '';
    if (dash) dash.style.display = '';
    if (tk)   tk.style.display   = 'none';
    if (btnOv) { btnOv.style.borderColor='#4caf50'; btnOv.style.color='#4caf50'; btnOv.style.background='#0f2a0f'; }
    if (btnTk) { btnTk.style.borderColor='#2a4a2a'; btnTk.style.color='#5a8a5a'; btnTk.style.background='#0a1a0a'; }
  } else {
    if (ov)   ov.style.display   = 'none';
    if (dash) dash.style.display = 'none';
    if (tk)   tk.style.display   = '';
    if (btnTk) { btnTk.style.borderColor='#4caf50'; btnTk.style.color='#4caf50'; btnTk.style.background='#0f2a0f'; }
    if (btnOv) { btnOv.style.borderColor='#2a4a2a'; btnOv.style.color='#5a8a5a'; btnOv.style.background='#0a1a0a'; }
    renderChecklist();
  }
}

function clFmtTime(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function clTotalTime() {
  return CL_TASKS.reduce((s, t) => {
    if (!t.timeMin || !_cl.include[t.id]) return s;
    return s + t.timeMin;
  }, 0);
}

function clInitDefaults() {
  const dow = new Date().getDay();
  CL_TASKS.forEach(t => {
    if (!_cl.checks[t.id]) _cl.checks[t.id] = { done: false, note: '' };
    if (_cl.include[t.id] === undefined) {
      if      (t.freq === 'tuesday')    _cl.include[t.id] = (dow === 2);
      else if (t.freq === 'friday')     _cl.include[t.id] = (dow === 5);
      else                              _cl.include[t.id] = true;
    }
  });
}

async function clLoadExisting() {
  if (!_cl.farm || !_cl.barn) return;
  const docId = `${_cl.farm}-${_cl.barn}-${_cl.date}`;
  try {
    const doc = await db.collection('dailyChecklists').doc(docId).get();
    if (doc.exists) {
      const d = doc.data();
      _cl.checks    = d.checks    || _cl.checks;
      _cl.include   = d.include   || _cl.include;
      _cl.worker    = d.worker    || _cl.worker;
      _cl.submitted = d.status === 'pending-review' || d.status === 'approved';
      _cl._fbId     = docId;
    }
  } catch(e) { console.error('clLoadExisting:', e); }
}

async function clSelectFarm() {
  _cl.farm = document.getElementById('cl-farm')?.value || '';
  _cl.barn = '';
  _cl.submitted = false;
  _cl._fbId = null;
  clInitDefaults();
  renderChecklist();
}

async function clSelectBarn() {
  _cl.barn   = document.getElementById('cl-barn')?.value || '';
  _cl.submitted = false;
  _cl._fbId = null;
  clInitDefaults();
  await clLoadExisting();
  renderChecklist();
}

function clToggle(id) {
  if (_cl.submitted) return;
  _cl.checks[id].done = !_cl.checks[id].done;
  renderChecklist();
}

function clNote(id, val) {
  if (!_cl.checks[id]) _cl.checks[id] = { done: false, note: '' };
  _cl.checks[id].note = val;
}

function clToggleInclude(id) {
  _cl.include[id] = !_cl.include[id];
  renderChecklist();
}

async function clSubmitDay() {
  if (_cl.submitted) return;
  if (!_cl.farm || !_cl.barn) { alert('Select a farm and barn first.'); return; }

  // Require P1 tasks checked or noted
  for (const t of CL_TASKS.filter(t => t.group === 'p1')) {
    const c = _cl.checks[t.id] || {};
    if (!c.done && !c.note) {
      alert(`"${t.label}" must be checked or have a note before submitting.`);
      return;
    }
  }

  const worker = _cl.worker || document.getElementById('cl-worker')?.value || '';
  const record = {
    date: _cl.date, farm: _cl.farm, barn: _cl.barn, worker,
    status: 'pending-review',
    checks:  _cl.checks,
    include: _cl.include,
    totalTimeMin: clTotalTime(),
    ts: Date.now(),
  };
  try {
    const docId = `${_cl.farm}-${_cl.barn}-${_cl.date}`;
    await db.collection('dailyChecklists').doc(docId).set(record);
    _cl.submitted = true;
    _cl._fbId = docId;
    renderChecklist();
  } catch(e) { alert('Error saving: ' + e.message); }
}

function renderChecklist() {
  const el = document.getElementById('panel-check-tasks');
  if (!el) return;

  clInitDefaults();

  const dateStr = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const totalMin = clTotalTime();
  const doneCount = CL_TASKS.filter(t => _cl.include[t.id] && _cl.checks[t.id]?.done).length;
  const visCount  = CL_TASKS.filter(t => _cl.include[t.id]).length;

  let html = '';

  // Header: farm/barn/worker selects
  html += `
    <div style="background:#0a1a0a;border:1.5px solid #1a3a1a;border-radius:12px;padding:12px 14px;margin-bottom:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
        <select id="cl-farm" onchange="clSelectFarm()" style="background:#050f05;border:1px solid #2a5a2a;color:#f0ead8;padding:8px;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:11px;">
          <option value="">Farm…</option>
          ${Object.keys(CL_FARMS).map(f => `<option value="${f}"${_cl.farm===f?' selected':''}>${f}</option>`).join('')}
        </select>
        <select id="cl-barn" onchange="clSelectBarn()" style="background:#050f05;border:1px solid #2a5a2a;color:#f0ead8;padding:8px;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:11px;">
          <option value="">Barn…</option>
          ${_cl.farm ? Array.from({length:CL_FARMS[_cl.farm]},(_,i)=>`<option value="${i+1}"${_cl.barn==i+1?' selected':''}>Barn ${i+1}</option>`).join('') : ''}
        </select>
        <input list="staff-datalist" id="cl-worker" value="${_cl.worker}" placeholder="Your name" oninput="_cl.worker=this.value" autocomplete="off" style="background:#050f05;border:1px solid #2a5a2a;color:#f0ead8;padding:8px;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:11px;">
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#3a6a3a;">${dateStr}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:#f0ead8;">${doneCount}/${visCount} done &nbsp;·&nbsp; ${clFmtTime(totalMin)||'—'}</span>
      </div>
    </div>`;

  // Progress bar
  const pct = visCount > 0 ? Math.round(doneCount / visCount * 100) : 0;
  const pCol = pct >= 100 ? '#4caf50' : pct >= 60 ? '#d69e2e' : '#e53e3e';
  html += `
    <div style="background:#0a1a0a;border-radius:6px;height:6px;margin-bottom:14px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${pCol};border-radius:6px;transition:width .3s;"></div>
    </div>`;

  // Task groups
  let currentGroup = null;
  CL_TASKS.forEach(t => {
    const g    = CL_GROUPS[t.group];
    const chk  = _cl.checks[t.id] || { done: false, note: '' };
    const incl = _cl.include[t.id];
    const toggleable = t.freq !== 'always';

    // Group header
    if (t.group !== currentGroup) {
      currentGroup = t.group;
      html += `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${g.color};padding:10px 0 5px;">${g.label}</div>`;
    }

    // Frequency badge
    const freqLabels = { toggle:'DAILY', '2x-week':'2×/WK', 'every-other':'EOD', tuesday:'TUE', friday:'FRI' };
    const freqBadge = toggleable ? `
      <span onclick="${_cl.submitted?'':'"clToggleInclude(\''+t.id+'\')"'}" style="cursor:${_cl.submitted?'default':'pointer'};font-family:'IBM Plex Mono',monospace;font-size:8px;padding:2px 7px;border-radius:10px;background:${incl?'#1a3a1a':'#2a1010'};color:${incl?'#4caf50':'#e07070'};border:1px solid ${incl?'#2a5a2a':'#5a2020'};" onclick="clToggleInclude('${t.id}')">${incl?(freqLabels[t.freq]||'ON'):'SKIP'}</span>` : '';

    if (!incl) {
      html += `
        <div style="padding:8px 0;border-bottom:1px solid #0a1a0a;display:flex;align-items:center;justify-content:space-between;opacity:0.45;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#3a5a3a;text-decoration:line-through;">${t.label}</span>
          ${freqBadge}
        </div>`;
      return;
    }

    const showNote = t.group === 'p1' || !chk.done;
    const wiExists = (typeof allWI !== 'undefined') && allWI.some(w => w.clTaskId === t.id);
    html += `
      <div style="background:${chk.done?'#050f05':g.bg};border:1.5px solid ${chk.done?'#1a3a1a':g.border};border-radius:10px;padding:10px 12px;margin-bottom:8px;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div onclick="${_cl.submitted?'':'"clToggle(\''+t.id+'\')"'}" style="flex-shrink:0;margin-top:1px;width:26px;height:26px;border:2px solid ${chk.done?'#4caf50':g.color};border-radius:7px;background:${chk.done?'#4caf50':'transparent'};display:flex;align-items:center;justify-content:center;cursor:${_cl.submitted?'default':'pointer'};" onclick="clToggle('${t.id}')">
            ${chk.done?'<span style="color:#fff;font-size:15px;line-height:1;font-weight:700;">✓</span>':''}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:${t.sub||showNote?'3px':'0'};">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:${chk.done?'#3a6a3a':'#f0ead8'};${chk.done?'text-decoration:line-through;':''}">${t.label}</span>
              ${freqBadge}
              ${t.timeMin?`<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a6a4a;">${clFmtTime(t.timeMin)}</span>`:''}
              <button onclick="clOpenTaskWI('${t.id}','${t.label.replace(/'/g,"\\'")}');" style="margin-left:auto;padding:2px 8px;border-radius:5px;border:1px solid ${wiExists?'#2a5a3a':'#2a3a5a'};background:${wiExists?'#0a2a0a':'#0a0f1a'};color:${wiExists?'#5a9a6a':'#5a7a9a'};font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;cursor:pointer;white-space:nowrap;">📖 ${wiExists?'WI':'+ WI'}</button>
            </div>
            ${t.sub?`<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a6a4a;margin-bottom:${showNote?'5px':'0'};">${t.sub}</div>`:''}
            ${showNote?`<input type="text" placeholder="${t.group==='p1'?'Note any issues here (required if not checked)…':'Optional note…'}" value="${chk.note||''}" oninput="clNote('${t.id}',this.value)" ${_cl.submitted?'disabled':''} style="width:100%;background:#0a1a0a;border:1px solid #1a3a1a;color:#9a9a8a;padding:5px 8px;border-radius:6px;font-family:'IBM Plex Mono',monospace;font-size:10px;box-sizing:border-box;">`:''}
          </div>
        </div>
      </div>`;
  });

  // Total time + submit
  html += `
    <div style="background:#0a1a0a;border:1.5px solid #1a3a1a;border-radius:12px;padding:14px;margin-top:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a7a4a;text-transform:uppercase;letter-spacing:1px;">Expected Time Today</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#f0ead8;">${clFmtTime(totalMin)||'—'}</span>
      </div>
      <button onclick="clSubmitDay()" style="width:100%;padding:14px;background:${_cl.submitted?'#0a2a0a':'#1a3a1a'};border:2px solid ${_cl.submitted?'#4caf50':'#3a7a3a'};border-radius:12px;color:${_cl.submitted?'#4caf50':'#f0ead8'};font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;cursor:${_cl.submitted?'default':'pointer'};letter-spacing:1px;">
        ${_cl.submitted ? '✅ DAY SUBMITTED — PENDING REVIEW' : '✅ SUBMIT DAY'}
      </button>
    </div>`;

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════
// LIVE CHECKLIST DASHBOARD — Barn Overview tab
// ═══════════════════════════════════════════════════════════════════

let _clDashData = [];   // today's submitted checklists
let _clDashUnsub = null;

async function clOpenTaskWI(taskId, taskLabel) {
  // ALWAYS show the built-in (correct) instructions first — guarantees the right content
  // regardless of whatever may have been saved/edited in Firestore.
  if (clShowBuiltinWI(taskId)) return;
  // Fallback for tasks without a built-in: try to find a Firestore WI mapped to this task
  try {
    if (typeof allWI === 'undefined' || !allWI.length) {
      if (typeof loadWI === 'function') await loadWI();
    }
  } catch(e) {}
  const matches = (typeof allWI !== 'undefined' ? allWI : []).filter(w => w.clTaskId === taskId);
  if (matches.length > 0) {
    if (typeof openWIView === 'function') openWIView(matches[0].wiId || matches[0]._fbId);
  } else if (typeof _openWIForm === 'function') {
    _openWIForm(null, taskId, taskLabel, 'Barn / Layer');
  }
}

function startChecklistDashboard() {
  if (_clDashUnsub) _clDashUnsub();
  const today = new Date().toISOString().slice(0,10);
  _clDashUnsub = db.collection('dailyChecklists')
    .where('date', '==', today)
    .onSnapshot(snap => {
      _clDashData = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
      renderChecklistDashboard();
    }, err => console.error('checklist listener:', err));
}

function renderChecklistDashboard() {
  const el = document.getElementById('cl-dashboard');
  if (!el) return;

  const totalTasksVisible = rec => {
    return CL_TASKS.filter(t => {
      if (!rec.include) return true;
      return rec.include[t.id] !== false;
    }).length;
  };
  const doneCount = rec => {
    return CL_TASKS.filter(t => rec.checks?.[t.id]?.done).length;
  };

  const farms = Object.keys(CL_FARMS);
  let html = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4caf50;margin-bottom:10px;">📋 Task Completion — Live</div>`;

  farms.forEach(farm => {
    const barnCount = CL_FARMS[farm];
    html += `<div style="margin-bottom:14px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#7ab07a;letter-spacing:1px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #1a3a1a;">📍 ${farm}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">`;

    for (let b = 1; b <= barnCount; b++) {
      const rec = _clDashData.find(r => r.farm === farm && String(r.barn) === String(b));
      if (!rec) {
        html += `<div style="background:#0a1a0a;border:1.5px solid #1a2a1a;border-radius:9px;padding:8px 6px;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#3a5a3a;margin-bottom:4px;">H${b}</div>
          <div style="font-size:16px;">—</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#2a4a2a;margin-top:3px;">pending</div>
        </div>`;
      } else {
        const done = doneCount(rec);
        const total = totalTasksVisible(rec);
        const pct = total > 0 ? Math.round(done / total * 100) : 0;
        const submitted = rec.status === 'pending-review' || rec.status === 'approved';
        const col = submitted ? '#4caf50' : pct > 0 ? '#d69e2e' : '#e53e3e';
        const bg  = submitted ? '#0a2a0a' : pct > 0 ? '#1a1200' : '#1a0505';
        const bdr = submitted ? '#2a5a2a' : pct > 0 ? '#4a3500' : '#5a1010';
        const icon = submitted ? '✅' : pct > 0 ? '⏳' : '🔴';
        const worker = rec.worker ? rec.worker.split(' ')[0] : '?';
        html += `<div style="background:${bg};border:1.5px solid ${bdr};border-radius:9px;padding:8px 6px;text-align:center;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${col};margin-bottom:3px;font-weight:700;">H${b}</div>
          <div style="font-size:15px;line-height:1.2;">${icon}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:${col};margin-top:3px;">${pct}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#5a7a5a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${rec.worker||''}">${worker}</div>
          <div style="background:#0a1a0a;border-radius:3px;height:3px;margin-top:4px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;"></div>
          </div>
        </div>`;
      }
    }
    html += `</div></div>`;
  });

  // Summary row
  const total = _clDashData.length;
  const submitted = _clDashData.filter(r => r.status === 'pending-review' || r.status === 'approved').length;
  const inProg = total - submitted;
  const totalBarns = Object.values(CL_FARMS).reduce((s,v) => s+v, 0);
  html += `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:4px;padding-top:10px;border-top:1px solid #1a3a1a;">
      <div style="text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#4caf50;">${submitted}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#3a6a3a;text-transform:uppercase;letter-spacing:1px;">Submitted</div>
      </div>
      <div style="text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${inProg>0?'#d69e2e':'#4caf50'}">${inProg}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#3a6a3a;text-transform:uppercase;letter-spacing:1px;">In Progress</div>
      </div>
      <div style="text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:${totalBarns-total>0?'#e53e3e':'#4caf50'}">${totalBarns - total}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#3a6a3a;text-transform:uppercase;letter-spacing:1px;">Not Started</div>
      </div>
    </div>`;

  el.innerHTML = html;
}
