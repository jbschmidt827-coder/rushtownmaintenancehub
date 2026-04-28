// ═══════════════════════════════════════════════════════════════════════
// BARN WALK QUICK ENTRY — Mobile-first overlay
// Full-screen step flow: Name → Farm → House → Morning Walk → Barn Walk → Done
// Saves to: morningWalks + barnWalks (Firebase)
// ═══════════════════════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────────────────────────────
const BE = {
  step:     0,       // current step 0-5
  name:     '',      // employee name
  farm:     '',      // 'Danville' | 'Hegins'
  house:    null,    // 1..N
  mw:       {},      // morning walk fields
  bw:       {},      // barn walk fields
  saving:   false,
  FARMS: { Danville: 5, Hegins: 8 },
  STEPS: ['Who Are You?', 'Pick Farm', 'Pick House', 'Morning Walk', 'Barn Walk', 'Done!']
};

// ── Open / Close ─────────────────────────────────────────────────────────────
function openBarnEntry() {
  // Reset state
  BE.step = 0; BE.name = ''; BE.farm = ''; BE.house = null;
  BE.mw = {}; BE.bw = {}; BE.saving = false;
  _beRender();
  const ov = document.getElementById('barn-entry-overlay');
  if (ov) { ov.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeBarnEntry() {
  const ov = document.getElementById('barn-entry-overlay');
  if (ov) { ov.style.display = 'none'; document.body.style.overflow = ''; }
}

function beLogAnother() {
  // Keep name + farm, reset house + data
  BE.step = 2; BE.house = null; BE.mw = {}; BE.bw = {};
  _beRender();
}

// ── Navigation ───────────────────────────────────────────────────────────────
function beNext() {
  if (BE.step === 0 && !BE.name.trim()) { _beShakeInput('be-name-input'); return; }
  if (BE.step === 1 && !BE.farm)        { return; }
  if (BE.step === 2 && !BE.house)       { return; }
  if (BE.step === 3) {
    if (!BE.mw.psi && BE.mw.psi !== 0) { _beShakeInput('be-psi'); return; }
  }
  if (BE.step === 4) {
    if (BE.bw.mort === undefined || BE.bw.mort === '') { _beShakeInput('be-mort'); return; }
    _beSave();
    return;
  }
  BE.step++;
  _beRender();
}

function beBack() {
  if (BE.step > 0) { BE.step--; _beRender(); }
}

function beSetFarm(f) {
  BE.farm = f;
  _beRender();
}

function beSetHouse(h) {
  BE.house = h;
  _beRender();
}

function beToggle(field, val, group) {
  // group = 'mw' | 'bw'
  const obj = group === 'mw' ? BE.mw : BE.bw;
  obj[field] = obj[field] === val ? undefined : val;
  _beRender();
}

function beField(field, val, group) {
  const obj = group === 'mw' ? BE.mw : BE.bw;
  obj[field] = val;
}

// ── Save to Firebase ─────────────────────────────────────────────────────────
async function _beSave() {
  if (BE.saving) return;
  BE.saving = true;
  _beRender();

  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const time  = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const ts    = now.getTime();

  // ── Morning Walk record ───────────────────────────────────────────────────
  const psi    = Number(BE.mw.psi) || 0;
  const temp   = BE.mw.temp  ? Number(BE.mw.temp)  : null;
  const ee     = BE.mw.ee    ? Number(BE.mw.ee)    : null;
  const mwFlags = [];
  if (psi < 10 || psi > 60) mwFlags.push('Water pressure out of range (' + psi + ' PSI)');
  if (BE.mw.feed   === 'no')  mwFlags.push('Feeders not running');
  if (BE.mw.fans   === 'no')  mwFlags.push('Fan issue');
  if (BE.mw.blowers=== 'no')  mwFlags.push('Blower issue');

  const mwRecord = {
    farm: BE.farm, house: String(BE.house), date: today, ts, time,
    employee: BE.name.trim(),
    waterPSI: psi, temp, eeCount: ee,
    feed:    BE.mw.feed    || null,
    fans:    BE.mw.fans    || null,
    blowers: BE.mw.blowers || null,
    flags:   mwFlags,
    source:  'barn-entry'
  };

  // ── Barn Walk record ──────────────────────────────────────────────────────
  const mort = Number(BE.bw.mort) || 0;
  const loose = BE.bw.loose ? Number(BE.bw.loose) : null;
  const bwFlags = [];
  if (mort > 0)             bwFlags.push('Mortality: ' + mort);
  if (BE.bw.binA !== undefined && BE.bw.binA !== '' && Number(BE.bw.binA) < 2) bwFlags.push('Bin A low: ' + BE.bw.binA + ' tons');
  if (BE.bw.binB !== undefined && BE.bw.binB !== '' && Number(BE.bw.binB) < 2) bwFlags.push('Bin B low: ' + BE.bw.binB + ' tons');
  if (BE.bw.water === 'no')   bwFlags.push('Water issue');
  if (BE.bw.rodent === 'yes') bwFlags.push('Rodent activity');
  if (loose > 0)              bwFlags.push('Loose birds: ' + loose);
  if (BE.bw.notes && BE.bw.notes.trim()) bwFlags.push('Note: ' + BE.bw.notes.trim());

  const bwRecord = {
    farm: BE.farm, house: String(BE.house), date: today, ts: Date.now(), time,
    employee: BE.name.trim(),
    mortCount:  mort,
    looseCount: loose,
    binA:       BE.bw.binA    || null,
    binB:       BE.bw.binB    || null,
    water:      BE.bw.water   || null,
    rodent:     BE.bw.rodent  || null,
    notes:      BE.bw.notes   || '',
    flags:      bwFlags,
    source:     'barn-entry'
  };

  try {
    await Promise.all([
      db.collection('morningWalks').add(mwRecord),
      db.collection('barnWalks').add(bwRecord)
    ]);
    // Log to activity log
    if (typeof db !== 'undefined') {
      db.collection('activityLog').add({
        type: 'barnwalk', farm: BE.farm, house: BE.house,
        desc: `${BE.name} logged barn walk — ${BE.farm} H${BE.house}`,
        flags: bwFlags.length + mwFlags.length,
        ts, date: today, employee: BE.name.trim()
      }).catch(() => {});
    }
    BE.step = 5;
  } catch(e) {
    alert('Save failed: ' + e.message);
    BE.saving = false;
  }
  _beRender();
}

// ── Render ────────────────────────────────────────────────────────────────────
function _beRender() {
  const el = document.getElementById('barn-entry-body');
  if (!el) return;

  const steps = BE.STEPS;
  const pct   = BE.step === 5 ? 100 : Math.round((BE.step / (steps.length - 1)) * 100);

  el.innerHTML = `
    <!-- Header -->
    <div style="padding:16px 16px 0 16px;flex-shrink:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${BE.step > 0 && BE.step < 5
            ? `<button onclick="beBack()" style="background:none;border:none;color:#7ab07a;font-size:18px;cursor:pointer;padding:4px 6px;line-height:1;">←</button>`
            : `<div style="width:34px;"></div>`}
          <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:#4ade80;">
            ${BE.step < 5 ? '🐓 BARN ENTRY' : ''}
          </span>
        </div>
        ${BE.step < 5
          ? `<button onclick="closeBarnEntry()" style="background:none;border:1px solid #2a5a2a;border-radius:8px;color:#7ab07a;font-size:13px;cursor:pointer;padding:6px 12px;font-family:'IBM Plex Mono',monospace;">✕ Cancel</button>`
          : ''}
      </div>

      <!-- Progress bar -->
      ${BE.step < 5 ? `
      <div style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a8a4a;letter-spacing:1px;text-transform:uppercase;">
            Step ${BE.step + 1} of ${steps.length - 1} — ${steps[BE.step]}
          </span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4ade80;">${pct}%</span>
        </div>
        <div style="background:#0a1a0a;border-radius:3px;height:4px;overflow:hidden;">
          <div style="background:#4ade80;width:${pct}%;height:100%;transition:width .3s;border-radius:3px;"></div>
        </div>
      </div>` : ''}

      <!-- Farm + House badge (steps 3+) -->
      ${BE.step >= 3 && BE.step < 5 ? `
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <span style="background:#1a3a1a;border:1px solid #2a6a2a;border-radius:20px;padding:4px 12px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4ade80;font-weight:700;">${BE.farm}</span>
        <span style="background:#1a3a1a;border:1px solid #2a6a2a;border-radius:20px;padding:4px 12px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4ade80;font-weight:700;">House ${BE.house}</span>
        ${BE.name ? `<span style="background:#0a2a0a;border:1px solid #1a4a1a;border-radius:20px;padding:4px 12px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7ab07a;">${BE.name}</span>` : ''}
      </div>` : ''}
    </div>

    <!-- Step content -->
    <div style="flex:1;overflow-y:auto;padding:16px;">
      ${_beStepContent()}
    </div>

    <!-- Footer button -->
    ${BE.step < 4 ? `
    <div style="padding:12px 16px;flex-shrink:0;border-top:1px solid #1a3a1a;">
      <button onclick="beNext()"
        style="width:100%;padding:16px;background:${_beNextEnabled() ? '#2D6A4F' : '#1a3a1a'};
               border:2px solid ${_beNextEnabled() ? '#4ade80' : '#2a5a2a'};
               border-radius:12px;color:${_beNextEnabled() ? '#fff' : '#4a7a4a'};
               font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;
               cursor:${_beNextEnabled() ? 'pointer' : 'not-allowed'};
               letter-spacing:1px;transition:all .15s;">
        ${BE.step === 3 ? 'NEXT → BARN WALK' : 'NEXT →'}
      </button>
    </div>` : ''}

    ${BE.step === 4 ? `
    <div style="padding:12px 16px;flex-shrink:0;border-top:1px solid #1a3a1a;">
      <button onclick="beNext()" ${BE.saving ? 'disabled' : ''}
        style="width:100%;padding:16px;background:${BE.saving ? '#1a3a1a' : '#166534'};
               border:2px solid ${BE.saving ? '#2a5a2a' : '#4ade80'};
               border-radius:12px;color:#fff;
               font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;
               cursor:${BE.saving ? 'wait' : 'pointer'};letter-spacing:1px;transition:all .15s;">
        ${BE.saving ? '⏳ SAVING…' : '✓ SAVE BARN WALK'}
      </button>
    </div>` : ''}
  `;
}

function _beNextEnabled() {
  if (BE.step === 0) return BE.name.trim().length > 0;
  if (BE.step === 1) return BE.farm !== '';
  if (BE.step === 2) return BE.house !== null;
  if (BE.step === 3) return BE.mw.psi !== undefined && BE.mw.psi !== '';
  return true;
}

function _beStepContent() {
  switch (BE.step) {
    case 0: return _beStepName();
    case 1: return _beStepFarm();
    case 2: return _beStepHouse();
    case 3: return _beStepMorning();
    case 4: return _beStepBarn();
    case 5: return _beStepDone();
    default: return '';
  }
}

// ── Step 0: Name ─────────────────────────────────────────────────────────────
function _beStepName() {
  return `
    <div style="text-align:center;padding:20px 0 10px 0;">
      <div style="font-size:48px;margin-bottom:12px;">👋</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:#e8f5ec;margin-bottom:6px;">WHO ARE YOU?</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4a8a4a;margin-bottom:28px;">Your name will be saved with this entry</div>
    </div>
    <input id="be-name-input"
      type="text" placeholder="Your name"
      value="${BE.name}"
      oninput="BE.name=this.value"
      onkeydown="if(event.key==='Enter')beNext()"
      autocomplete="name"
      style="width:100%;box-sizing:border-box;padding:18px 16px;background:#0a1f0a;border:2px solid #2a6a2a;border-radius:12px;
             color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:18px;outline:none;
             -webkit-appearance:none;text-align:center;letter-spacing:1px;"
    />
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${(typeof getActiveStaff==='function' ? getActiveStaff(BE.farm).slice(0,12) : []).map(n => `
        <button onclick="BE.name='${n.replace(/'/g,"\\'")}';_beRender()"
          style="padding:14px;background:${BE.name===n?'#1a4a1a':'#0a1a0a'};
                 border:1.5px solid ${BE.name===n?'#4ade80':'#2a4a2a'};
                 border-radius:10px;color:${BE.name===n?'#4ade80':'#7ab07a'};
                 font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;
                 transition:all .1s;">
          ${n}
        </button>`).join('') || '<div style="grid-column:1/-1;text-align:center;color:#7ab07a;font-size:11px;padding:8px;">No staff added yet — type your name above or add staff via the Staff panel.</div>'}
    </div>
  `;
}

// ── Step 1: Farm ─────────────────────────────────────────────────────────────
function _beStepFarm() {
  return `
    <div style="text-align:center;padding:20px 0 24px 0;">
      <div style="font-size:40px;margin-bottom:10px;">🏭</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:#e8f5ec;margin-bottom:6px;">WHICH FARM?</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4a8a4a;">Select your location</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;">
      ${Object.entries(BE.FARMS).map(([farm, houses]) => `
        <button onclick="beSetFarm('${farm}')"
          style="padding:28px 20px;background:${BE.farm===farm?'#0d3a2a':'#0a1a0a'};
                 border:3px solid ${BE.farm===farm?'#4ade80':'#1a4a2a'};
                 border-radius:16px;cursor:pointer;text-align:left;transition:all .15s;
                 display:flex;align-items:center;gap:16px;">
          <div style="font-size:36px;">${farm==='Danville'?'🌾':'🌿'}</div>
          <div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:2px;color:${BE.farm===farm?'#4ade80':'#c8e6c9'};">${farm}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4a8a4a;margin-top:2px;">${houses} houses</div>
          </div>
          ${BE.farm===farm ? `<div style="margin-left:auto;font-size:24px;">✓</div>` : ''}
        </button>
      `).join('')}
    </div>
  `;
}

// ── Step 2: House ─────────────────────────────────────────────────────────────
function _beStepHouse() {
  const n = BE.FARMS[BE.farm] || 5;
  const houses = Array.from({length: n}, (_, i) => i + 1);
  return `
    <div style="text-align:center;padding:20px 0 24px 0;">
      <div style="font-size:40px;margin-bottom:10px;">🏠</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:#e8f5ec;margin-bottom:6px;">WHICH HOUSE?</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4a8a4a;">${BE.farm} — ${n} houses</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${n <= 5 ? n : 4},1fr);gap:12px;">
      ${houses.map(h => `
        <button onclick="beSetHouse(${h})"
          style="aspect-ratio:1;background:${BE.house===h?'#1a5a2a':'#0a1a0a'};
                 border:3px solid ${BE.house===h?'#4ade80':'#1a4a2a'};
                 border-radius:14px;cursor:pointer;transition:all .15s;
                 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
          <span style="font-size:28px;font-family:'Bebas Neue',sans-serif;color:${BE.house===h?'#4ade80':'#c8e6c9'};letter-spacing:1px;">${h}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a7a4a;">HOUSE</span>
        </button>
      `).join('')}
    </div>
  `;
}

// ── Step 3: Morning Walk ──────────────────────────────────────────────────────
function _beStepMorning() {
  const psi = BE.mw.psi !== undefined ? BE.mw.psi : '';
  const psiNum = Number(psi);
  const psiBad = psi !== '' && (psiNum < 10 || psiNum > 60);
  const psiGood = psi !== '' && !psiBad;

  return `
    <div style="margin-bottom:20px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:2px;color:#e8f5ec;margin-bottom:4px;">☀️ MORNING WALK</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">Required fields marked with *</div>
    </div>

    <!-- Water PSI * -->
    <div style="margin-bottom:20px;">
      <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;display:block;margin-bottom:8px;text-transform:uppercase;">💧 Water PSI *</label>
      <input id="be-psi" type="number" inputmode="decimal" placeholder="e.g. 35"
        value="${psi}"
        oninput="beField('psi',this.value,'mw');_beRenderPSIFeedback(this.value)"
        style="width:100%;box-sizing:border-box;padding:16px;background:${psiBad?'#2a0a0a':psiGood?'#0a2a14':'#0a1a0a'};
               border:2px solid ${psiBad?'#ef4444':psiGood?'#4ade80':'#2a5a2a'};
               border-radius:12px;color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:22px;
               outline:none;-webkit-appearance:none;text-align:center;"
      />
      <div id="be-psi-feedback" style="font-family:'IBM Plex Mono',monospace;font-size:10px;margin-top:6px;text-align:center;
        color:${psiBad?'#ef4444':psiGood?'#4ade80':'#4a8a4a'};">
        ${psiBad ? '⚠ OUT OF RANGE — Normal is 10–60 PSI' : psiGood ? '✓ PSI looks good' : 'Normal range: 10 – 60 PSI'}
      </div>
    </div>

    <!-- Temp + Headcount row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div>
        <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;display:block;margin-bottom:8px;text-transform:uppercase;">🌡 Temp (°F)</label>
        <input type="number" inputmode="decimal" placeholder="72"
          value="${BE.mw.temp || ''}"
          oninput="beField('temp',this.value,'mw')"
          style="width:100%;box-sizing:border-box;padding:16px;background:#0a1a0a;border:2px solid #2a5a2a;
                 border-radius:12px;color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:20px;
                 outline:none;-webkit-appearance:none;text-align:center;"
        />
      </div>
      <div>
        <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;display:block;margin-bottom:8px;text-transform:uppercase;">👥 Headcount</label>
        <input type="number" inputmode="numeric" placeholder="0"
          value="${BE.mw.ee || ''}"
          oninput="beField('ee',this.value,'mw')"
          style="width:100%;box-sizing:border-box;padding:16px;background:#0a1a0a;border:2px solid #2a5a2a;
                 border-radius:12px;color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:20px;
                 outline:none;-webkit-appearance:none;text-align:center;"
        />
      </div>
    </div>

    <!-- Toggle row: Feed / Fans / Blowers -->
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;margin-bottom:10px;text-transform:uppercase;">Equipment Status</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:8px;">
      ${_beToggleRow('feed','mw','🌾 Feeders Running?','yes','no','OK','Issue')}
      ${_beToggleRow('fans','mw','💨 Fans OK?','yes','no','OK','Issue')}
      ${_beToggleRow('blowers','mw','🌬 Blowers OK?','yes','no','OK','Issue')}
    </div>
  `;
}

function _beRenderPSIFeedback(val) {
  const n = Number(val);
  const el = document.getElementById('be-psi-feedback');
  const inp = document.getElementById('be-psi');
  if (!el || !inp) return;
  beField('psi', val, 'mw');
  if (val === '') {
    el.style.color = '#4a8a4a'; el.textContent = 'Normal range: 10 – 60 PSI';
    inp.style.borderColor = '#2a5a2a'; inp.style.background = '#0a1a0a';
  } else if (n < 10 || n > 60) {
    el.style.color = '#ef4444'; el.textContent = '⚠ OUT OF RANGE — Normal is 10–60 PSI';
    inp.style.borderColor = '#ef4444'; inp.style.background = '#2a0a0a';
  } else {
    el.style.color = '#4ade80'; el.textContent = '✓ PSI looks good';
    inp.style.borderColor = '#4ade80'; inp.style.background = '#0a2a14';
  }
}

// ── Step 4: Barn Walk ─────────────────────────────────────────────────────────
function _beStepBarn() {
  const mort = BE.bw.mort !== undefined ? BE.bw.mort : '';
  const mortNum = Number(mort);
  const mortBad = mort !== '' && mortNum > 0;

  return `
    <div style="margin-bottom:20px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:2px;color:#e8f5ec;margin-bottom:4px;">🚶 BARN WALK</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a8a4a;">Record what you found in the barn</div>
    </div>

    <!-- Dead birds * -->
    <div style="margin-bottom:20px;">
      <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;display:block;margin-bottom:8px;text-transform:uppercase;">💀 Dead Birds Found *</label>
      <input id="be-mort" type="number" inputmode="numeric" placeholder="0"
        value="${mort}"
        oninput="beField('mort',this.value,'bw');_beRenderMortFeedback(this.value)"
        style="width:100%;box-sizing:border-box;padding:16px;background:${mortBad?'#1a0505':'#0a1a0a'};
               border:2px solid ${mortBad?'#ef4444':'#2a5a2a'};
               border-radius:12px;color:${mortBad?'#fca5a5':'#f0ead8'};
               font-family:'IBM Plex Mono',monospace;font-size:28px;
               outline:none;-webkit-appearance:none;text-align:center;"
      />
      <div id="be-mort-feedback" style="font-family:'IBM Plex Mono',monospace;font-size:10px;margin-top:6px;text-align:center;
        color:${mortBad?'#ef4444':'#4a8a4a'};">
        ${mortBad ? `⚠ ${mortNum} ${mortNum===1?'bird':'birds'} — will be flagged` : 'Enter 0 if none found'}
      </div>
    </div>

    <!-- Loose birds -->
    <div style="margin-bottom:20px;">
      <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;display:block;margin-bottom:8px;text-transform:uppercase;">🐔 Loose Birds</label>
      <input type="number" inputmode="numeric" placeholder="0"
        value="${BE.bw.loose || ''}"
        oninput="beField('loose',this.value,'bw')"
        style="width:100%;box-sizing:border-box;padding:14px;background:#0a1a0a;border:2px solid #2a5a2a;
               border-radius:12px;color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:22px;
               outline:none;-webkit-appearance:none;text-align:center;"
      />
    </div>

    <!-- Toggle row: Feed bins / Water / Rodent -->
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;margin-bottom:10px;text-transform:uppercase;">Conditions</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
    <!-- Bin totals -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;">
      <div>
        <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;display:block;margin-bottom:8px;text-transform:uppercase;">🌾 Bin A (tons)</label>
        <input type="number" inputmode="decimal" placeholder="0.0"
          value="${BE.bw.binA || ''}"
          oninput="beField('binA',this.value,'bw')"
          style="width:100%;box-sizing:border-box;padding:16px;background:#0a1a0a;border:2px solid #2a5a2a;
                 border-radius:12px;color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:22px;
                 outline:none;-webkit-appearance:none;text-align:center;"
        />
      </div>
      <div>
        <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;display:block;margin-bottom:8px;text-transform:uppercase;">🌾 Bin B (tons)</label>
        <input type="number" inputmode="decimal" placeholder="0.0"
          value="${BE.bw.binB || ''}"
          oninput="beField('binB',this.value,'bw')"
          style="width:100%;box-sizing:border-box;padding:16px;background:#0a1a0a;border:2px solid #2a5a2a;
                 border-radius:12px;color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:22px;
                 outline:none;-webkit-appearance:none;text-align:center;"
        />
      </div>
    </div>
      ${_beToggleRow('water','bw','💧 Water OK?','yes','no','OK','Issue')}
      ${_beToggleRow('rodent','bw','🐀 Rodent Activity?','no','yes','None','Seen')}
    </div>

    <!-- Notes -->
    <div>
      <label style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7ab07a;letter-spacing:1px;display:block;margin-bottom:8px;text-transform:uppercase;">📝 Notes (optional)</label>
      <textarea placeholder="Any issues, observations, or follow-ups…"
        oninput="beField('notes',this.value,'bw')"
        rows="3"
        style="width:100%;box-sizing:border-box;padding:14px;background:#0a1a0a;border:2px solid #2a5a2a;
               border-radius:12px;color:#f0ead8;font-family:'IBM Plex Mono',monospace;font-size:13px;
               outline:none;resize:none;-webkit-appearance:none;"
      >${BE.bw.notes || ''}</textarea>
    </div>
  `;
}

function _beRenderMortFeedback(val) {
  const n = Number(val);
  const el = document.getElementById('be-mort-feedback');
  const inp = document.getElementById('be-mort');
  if (!el || !inp) return;
  beField('mort', val, 'bw');
  if (val === '') {
    el.style.color = '#4a8a4a'; el.textContent = 'Enter 0 if none found';
    inp.style.borderColor = '#2a5a2a'; inp.style.color = '#f0ead8'; inp.style.background = '#0a1a0a';
  } else if (n > 0) {
    el.style.color = '#ef4444'; el.textContent = `⚠ ${n} ${n===1?'bird':'birds'} — will be flagged`;
    inp.style.borderColor = '#ef4444'; inp.style.color = '#fca5a5'; inp.style.background = '#1a0505';
  } else {
    el.style.color = '#4ade80'; el.textContent = '✓ No mortality — all clear';
    inp.style.borderColor = '#4ade80'; inp.style.color = '#4ade80'; inp.style.background = '#0a1f0a';
  }
}

// ── Step 5: Done ──────────────────────────────────────────────────────────────
function _beStepDone() {
  const mort  = Number(BE.bw.mort) || 0;
  const psi   = Number(BE.mw.psi)  || 0;
  const psiBad = psi < 10 || psi > 60;
  const hasFlags = mort > 0 || psiBad || BE.mw.feed === 'no' || BE.mw.fans === 'no' || BE.bw.water === 'no'
    || (BE.bw.binA !== '' && BE.bw.binA !== undefined && Number(BE.bw.binA) < 2)
    || (BE.bw.binB !== '' && BE.bw.binB !== undefined && Number(BE.bw.binB) < 2);

  return `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:64px;margin-bottom:16px;">${hasFlags ? '⚠️' : '✅'}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:2px;color:#4ade80;margin-bottom:8px;">SAVED!</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#7ab07a;margin-bottom:6px;">
        ${BE.farm} · House ${BE.house} · ${BE.name}
      </div>
      ${hasFlags ? `
        <div style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:12px;margin:16px 0;text-align:left;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#f87171;letter-spacing:1px;margin-bottom:8px;text-transform:uppercase;">⚑ Flags Logged</div>
          ${mort > 0 ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fca5a5;padding:3px 0;">• ${mort} dead bird(s)</div>` : ''}
          ${psiBad ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fca5a5;padding:3px 0;">• Water PSI out of range: ${psi}</div>` : ''}
          ${BE.mw.feed === 'no' ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fca5a5;padding:3px 0;">• Feeders not running</div>` : ''}
          ${(BE.bw.binA !== '' && BE.bw.binA !== undefined && Number(BE.bw.binA) < 2) ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fca5a5;padding:3px 0;">• Bin A low: ${BE.bw.binA} tons</div>` : ''}
          ${(BE.bw.binB !== '' && BE.bw.binB !== undefined && Number(BE.bw.binB) < 2) ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fca5a5;padding:3px 0;">• Bin B low: ${BE.bw.binB} tons</div>` : ''}
          ${BE.mw.fans === 'no' ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fca5a5;padding:3px 0;">• Fan issue reported</div>` : ''}
          ${BE.bw.water === 'no' ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#fca5a5;padding:3px 0;">• Water issue in barn</div>` : ''}
        </div>` : `
        <div style="background:#0a2a14;border:1px solid #166534;border-radius:10px;padding:12px;margin:16px 0;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4ade80;">All clear — no issues flagged</div>
        </div>`}
    </div>

    <!-- Action buttons -->
    <div style="display:flex;flex-direction:column;gap:12px;padding-bottom:8px;">
      <button onclick="beLogAnother()"
        style="width:100%;padding:16px;background:#1a3a1a;border:2px solid #4ade80;
               border-radius:12px;color:#4ade80;font-family:'IBM Plex Mono',monospace;
               font-size:14px;font-weight:700;cursor:pointer;letter-spacing:1px;">
        🐓 LOG ANOTHER HOUSE
      </button>
      <button onclick="closeBarnEntry()"
        style="width:100%;padding:16px;background:#0a1a0a;border:1.5px solid #2a5a2a;
               border-radius:12px;color:#7ab07a;font-family:'IBM Plex Mono',monospace;
               font-size:13px;cursor:pointer;letter-spacing:1px;">
        ← BACK TO APP
      </button>
    </div>
  `;
}

// ── Toggle helper ─────────────────────────────────────────────────────────────
function _beToggleRow(field, group, label, goodVal, badVal, goodLabel, badLabel) {
  const obj  = group === 'mw' ? BE.mw : BE.bw;
  const cur  = obj[field];
  const isGood = cur === goodVal;
  const isBad  = cur === badVal;

  return `
    <div style="background:#0a1a0a;border:1.5px solid #1a3a1a;border-radius:12px;padding:14px 16px;
                display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#c8e6c9;flex:1;">${label}</span>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button onclick="beToggle('${field}','${goodVal}','${group}')"
          style="padding:10px 18px;border-radius:8px;border:2px solid ${isGood?'#4ade80':'#2a5a2a'};
                 background:${isGood?'#14532d':'transparent'};
                 color:${isGood?'#4ade80':'#4a7a4a'};
                 font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;
                 transition:all .1s;min-width:56px;">
          ${goodLabel}
        </button>
        <button onclick="beToggle('${field}','${badVal}','${group}')"
          style="padding:10px 18px;border-radius:8px;border:2px solid ${isBad?'#ef4444':'#2a5a2a'};
                 background:${isBad?'#7f1d1d':'transparent'};
                 color:${isBad?'#f87171':'#4a7a4a'};
                 font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;
                 transition:all .1s;min-width:56px;">
          ${badLabel}
        </button>
      </div>
    </div>
  `;
}

// ── Shake animation on validation failure ─────────────────────────────────────
function _beShakeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'beShake 0.3s ease';
  setTimeout(() => { el.style.animation = ''; }, 350);
}
