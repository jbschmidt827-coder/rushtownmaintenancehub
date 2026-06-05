// ════════════════════════════════════════════════════════════════════
// Add 9 Lubing Rebuild Work Orders to the Maintenance Hub
//
// HOW TO RUN:
//   1. Open the Maintenance Hub app in your browser and sign in
//   2. Open DevTools (F12), go to the Console tab
//   3. Paste this whole file and press Enter
//   4. WOs will appear in the open work-order list and the dashboard
//
// EDIT BEFORE PASTING IF NEEDED:
//   - FARM:        farm name (must match your app's farm list)
//   - PRIORITY:    'urgent' | 'high' | 'normal' | 'low'
//   - TECH:        your name as it appears in the Staff list
//   - START_DATE:  first scheduled Monday (YYYY-MM-DD)
// ════════════════════════════════════════════════════════════════════

(async function addLubingRebuildWOs() {
  const FARM        = 'Rushtown';
  const PRIORITY    = 'normal';                  // planned major maintenance
  const TECH        = 'Joe Schmidt';
  const ASSIGNED_TO = 'Maintenance Team';
  const START_DATE  = '2026-06-29';              // Monday, end of June
  const EST_HOURS   = 16;                        // adjust if you want
  const PROBLEM     = 'Watering System';         // Lubing = watering system
  const DOWN        = 'no';                      // planned, not an outage

  // 5 barns + 4 hallways, one per week
  const HOUSES = [
    'Barn 1', 'Barn 2', 'Barn 3', 'Barn 4', 'Barn 5',
    'Hallway 1', 'Hallway 2', 'Hallway 3', 'Hallway 4'
  ];

  // Helper: add N days to a YYYY-MM-DD string
  function addDays(yyyymmdd, days) {
    const d = new Date(yyyymmdd + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // Quick guard so a half-loaded app doesn't bite us
  if (typeof db === 'undefined' || typeof mintWoId !== 'function') {
    alert('App not fully loaded. Wait for the green sync dot, then re-run.');
    return;
  }

  console.log(`Creating ${HOUSES.length} Lubing rebuild WOs for ${FARM}…`);

  const created = [];
  for (let i = 0; i < HOUSES.length; i++) {
    const house = HOUSES[i];
    const date  = addDays(START_DATE, i * 7);   // one per week

    let woId;
    try {
      woId = await mintWoId();   // already returns 'WO-NNN'
    } catch (e) {
      console.error('mintWoId failed; aborting at index', i, e);
      break;
    }

    const wo = {
      id:           woId,
      date:         date,
      tech:         TECH,
      farm:         FARM,
      house:        house,
      problem:      PROBLEM,
      desc:         `Lubing rebuild — ${house}. Replace worn drinker line components, regulators, drippers, and stand-pipes. Flush and pressure-test the line after reassembly.`,
      priority:     PRIORITY,
      assignedTo:   ASSIGNED_TO,
      estHours:     EST_HOURS,
      parts:        'Lubing nipples, regulators, drip cups, line gaskets, stand-pipe assemblies (as needed)',
      down:         DOWN,
      status:       'open',
      notes:        'Scheduled rebuild — part of farm-wide Lubing system refresh (Barns 1-5, Hallways 1-4, one per week starting end of June 2026).',
      photos:       [],
      submitted:    new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}),
      ts:           Date.now() + i        // tiny offset so they sort in order
    };

    try {
      const ref = await db.collection('workOrders').add(wo);
      wo._fbId = ref.id;
      created.push(wo);
      console.log(`  ✓ ${wo.id}  ${date}  ${house}`);

      // Best-effort activity log entry (matches submitWO behavior)
      try {
        await db.collection('activityLog').add({
          type: 'wo',
          id:   wo.id,
          desc: `WO submitted: ${wo.farm} · ${wo.house} — ${wo.problem}`,
          tech: wo.tech,
          date: wo.submitted,
          ts:   Date.now()
        });
      } catch (logErr) {
        console.warn('  (activityLog skip)', logErr.message);
      }
    } catch (err) {
      console.error(`  ✗ Failed on ${house}:`, err);
      break;
    }
  }

  console.log(`\nDone. Created ${created.length} of ${HOUSES.length} WOs.`);
  console.table(created.map(w => ({ id: w.id, date: w.date, house: w.house, priority: w.priority })));

  // Refresh the open-WO view if it's open
  if (typeof renderWO === 'function') renderWO();
  alert(`Created ${created.length} Lubing rebuild WOs. Check the open work-order list to confirm.`);
})();
