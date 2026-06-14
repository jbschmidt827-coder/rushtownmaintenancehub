// ═══════════════════════════════════════════
// STAFF ROSTER — LOCATION-BASED (rebuilt 2026-06-14)
// ═══════════════════════════════════════════
// Single source of truth for WHO works WHERE. Each person carries a
// `loc` of 'Danville' | 'Hegins' | 'Both'. Locations come straight from
// the Hours-by-Department export (Location Title column). The export's
// "Bethel" transportation/trucking crew serves both plants, so they are
// folded into 'Both'. People not present in the export (office / mgmt /
// not-yet-clocked) default to 'Both' so they stay selectable everywhere.
//
// Why this matters: every name picker in the app already filters by
// location (getActiveStaff, loadHouses, the PM/closeout modals). They all
// showed everyone ONLY because the old seed left every farm blank. Giving
// each person a real location turns all of that filtering on at once.
//
// Two entry points run at boot (see core.js):
//   • seedStaffRosterIfEmpty()       — fresh installs: seed roster w/ loc
//   • assignStaffLocationsIfNeeded() — existing installs: backfill farm
// ═══════════════════════════════════════════

// last, first, loc  (loc: 'Danville' | 'Hegins' | 'Both')
const STAFF_ROSTER_2026 = [
  { empId: '1002', last: 'Alicea',                first: 'Jonathan',        loc: 'Both'     },
  { empId: '1091', last: 'Ayala Sr',              first: 'Joseph D',        loc: 'Both'     },
  { empId: '1135', last: 'Barr',                  first: 'Natalie',         loc: 'Hegins'   },
  { empId: '1156', last: 'Bello Gonzalez',        first: 'Joaquin Tomas',   loc: 'Danville' },
  { empId: '1081', last: 'Bewley',                first: 'Trevor',          loc: 'Both'     },
  { empId: '1124', last: 'Bingaman',              first: 'Joshua',          loc: 'Danville' },
  { empId: '1136', last: 'Bixler',                first: 'Jill',            loc: 'Hegins'   },
  { empId: '1131', last: 'Bogar Jr',              first: 'Erik',            loc: 'Danville' },
  { empId: '1096', last: 'Boyer',                 first: 'Adrianna M',      loc: 'Both'     },
  { empId: '1159', last: 'Broschart',             first: 'Kayla',           loc: 'Both'     },
  { empId: '1137', last: 'Brosius',               first: 'Adam Miles',      loc: 'Both'     },
  { empId: '1114', last: 'Colon',                 first: 'Jose',            loc: 'Danville' },
  { empId: '1126', last: 'Davenport',             first: 'Celia',           loc: 'Danville' },
  { empId: '1092', last: 'Deitzler',              first: 'David S',         loc: 'Both'     },
  { empId: '1008', last: 'Derr',                  first: 'Bradley S',       loc: 'Danville' },
  { empId: '1154', last: 'Ernest',                first: 'John',            loc: 'Danville' },
  { empId: '1051', last: 'Foust',                 first: 'Cody A',          loc: 'Danville' },
  { empId: '1010', last: 'Fox',                   first: 'John P',          loc: 'Danville' },
  { empId: '1011', last: 'Garcia',                first: 'Arturo',          loc: 'Both'     },
  { empId: '1012', last: 'Garcia',                first: 'Candelaria',      loc: 'Danville' },
  { empId: '1155', last: 'Hansen',                first: 'Matthew',         loc: 'Danville' },
  { empId: '1161', last: 'Haynes',                first: 'Joshua',          loc: 'Danville' },
  { empId: '1157', last: 'Hernandez Hernandez',   first: 'Oscar Eduardo',   loc: 'Danville' },
  { empId: '1123', last: 'Jiminez',               first: 'Aracely',         loc: 'Danville' },
  { empId: '1115', last: 'Kipp',                  first: 'Mariah',          loc: 'Both'     },
  { empId: '1015', last: 'Klinger',               first: 'Thomas A',        loc: 'Danville' },
  { empId: '1152', last: 'Kramer',                first: 'Joshua',          loc: 'Both'     },
  { empId: '1017', last: 'Kuykendall',            first: 'Matthew S',       loc: 'Danville' },
  { empId: '1087', last: 'Lahout',                first: 'Michael',         loc: 'Danville' },
  { empId: '1127', last: 'Leisey',                first: 'Harry Steven',    loc: 'Hegins'   },
  { empId: '1067', last: 'Linsky',                first: 'Andrew',          loc: 'Both'     },
  { empId: '1044', last: 'Lopez-Jimenez',         first: 'Maria',           loc: 'Danville' },
  { empId: '1147', last: 'Lopez-Veguilla',        first: 'Christian D',     loc: 'Both'     },
  { empId: '1164', last: 'Madrid Castro',         first: 'Karen',           loc: 'Danville' },
  { empId: '1150', last: 'Madrid Romero',         first: 'Norlan E',        loc: 'Both'     },
  { empId: '1128', last: 'Manning',               first: 'Claire',          loc: 'Both'     },
  { empId: '1140', last: 'Martz',                 first: 'Debra C',         loc: 'Both'     },
  { empId: '1089', last: 'McCarthy Jr',           first: 'Sean R',          loc: 'Danville' },
  { empId: '1023', last: 'Nye',                   first: 'Shawn Z',         loc: 'Danville' },
  { empId: '1110', last: 'Orellana',              first: 'Marifer M',       loc: 'Danville' },
  { empId: '1113', last: 'Ortiz',                 first: 'Leidy Yessenia',  loc: 'Danville' },
  { empId: '1122', last: 'Perez',                 first: 'Milagros',        loc: 'Danville' },
  { empId: '1098', last: 'Perez',                 first: 'Norma',           loc: 'Danville' },
  { empId: '1045', last: 'Perez-Sanchez',         first: 'Carlos U',        loc: 'Both'     },
  { empId: '1085', last: 'Pico Estrada',          first: 'Jorge A',         loc: 'Both'     },
  { empId: '1024', last: 'Piestrak',              first: 'Nathan',          loc: 'Both'     },
  { empId: '1106', last: 'Quiles',                first: 'Hector',          loc: 'Both'     },
  { empId: '1095', last: 'Roarabaugh',            first: 'Thomas P',        loc: 'Both'     },
  { empId: '1078', last: 'Ross',                  first: 'Quil',            loc: 'Danville' },
  { empId: '1148', last: 'Rudderow',              first: 'Lindsey',         loc: 'Both'     },
  { empId: '1086', last: 'Salazar Samuel',        first: 'Jenny Catherine', loc: 'Both'     },
  { empId: '1056', last: 'Sanchez',               first: 'Dervys',          loc: 'Danville' },
  { empId: '1047', last: 'Sanchez-Roblero',       first: 'Cain',            loc: 'Danville' },
  { empId: '1141', last: 'Schell',                first: 'Elizabeth',       loc: 'Hegins'   },
  { empId: '1100', last: 'Schmidt',               first: 'Joseph',          loc: 'Both'     },
  { empId: '1142', last: 'Schmitt',               first: 'Paul',            loc: 'Hegins'   },
  { empId: '1037', last: 'Shaffer',               first: 'Kyle G',          loc: 'Danville' },
  { empId: '1130', last: 'Sibaja Cruz',           first: 'Daniela',         loc: 'Both'     },
  { empId: '1160', last: 'Smullen',               first: 'Michael Kenneth', loc: 'Both'     },
  { empId: '1153', last: 'Strobel',               first: 'Tiffany',         loc: 'Danville' },
  { empId: '1149', last: 'Tenorio',               first: 'Lyneth',          loc: 'Both'     },
  { empId: '1027', last: 'Thompson',              first: 'John',            loc: 'Danville' },
  { empId: '1125', last: 'Torres',                first: 'Ruth',            loc: 'Danville' },
  { empId: '1029', last: 'Ulrich',                first: 'Tim L',           loc: 'Both'     },
  { empId: '1102', last: 'Walters',               first: 'Allison',         loc: 'Danville' },
  { empId: '1107', last: 'Weidner',               first: 'Cody',            loc: 'Both'     },
  { empId: '1144', last: 'Wenrich',               first: 'Tammy A',         loc: 'Both'     },
  { empId: '1162', last: 'Wilt',                  first: 'Eric',            loc: 'Danville' },
  { empId: '1145', last: 'Wolfe',                 first: 'Nathan',          loc: 'Hegins'   },
  { empId: '1146', last: 'Wolfe',                 first: 'Randy E',         loc: 'Hegins'   },
  { empId: '1094', last: 'Zeiset',                first: 'Raymond W',       loc: 'Both'     },
  { empId: '1119', last: 'Ziegler',               first: 'Shawn',           loc: 'Both'     },
];

// People present in the Hours export but NOT on the seed roster above
// (newer hires). Listed so the migration can tag them if they already
// exist in Firestore. Keyed the same way as the roster.
const STAFF_LOC_EXTRAS = [
  { last: 'DeGreen',   first: 'Noah Alen',         loc: 'Danville' },
  { last: 'Hernandez', first: 'Adalgisa',          loc: 'Danville' },
  { last: 'Polanco',   first: 'Francisco Antonio', loc: 'Danville' },
  { last: 'Herrera',   first: 'Francis',           loc: 'Both'     },
  { last: 'Lahout Jr.', first: 'Michael D',        loc: 'Danville' },
];

// ── Name → location lookup, order-independent ────────────────────────
// Matching on a sorted set of alpha tokens makes "First Last",
// "Last, First" and middle-initial variants all resolve to the same key.
function _staffNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')   // drop commas, periods, digits
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function _buildStaffLocMap() {
  const map = {};
  STAFF_ROSTER_2026.forEach(r => { map[_staffNameKey(r.first + ' ' + r.last)] = r.loc; });
  STAFF_LOC_EXTRAS.forEach(r => { map[_staffNameKey(r.first + ' ' + r.last)] = r.loc; });
  return map;
}
const STAFF_LOC_MAP = _buildStaffLocMap();

function staffLocationFor(name) {
  return STAFF_LOC_MAP[_staffNameKey(name)] || null;
}

// ── Fresh-install seed (only runs when staff collection is empty) ─────
async function seedStaffRosterIfEmpty() {
  try {
    const flagRef  = db.collection('meta').doc('_staffRosterSeeded');
    const flagSnap = await flagRef.get();
    if (flagSnap.exists) return;

    const existing = await db.collection('staff').limit(1).get();
    if (!existing.empty) {
      await flagRef.set({ ts: Date.now(), reason: 'staff-already-present-skip' });
      console.log('[roster] staff already present, marking seeded without writing.');
      return;
    }

    console.log('[roster] seeding ' + STAFF_ROSTER_2026.length + ' employees…');
    const batch = db.batch();
    STAFF_ROSTER_2026.forEach(row => {
      const ref = db.collection('staff').doc();
      batch.set(ref, {
        name:      row.first + ' ' + row.last,
        firstName: row.first,
        lastName:  row.last,
        empId:     row.empId,
        role:      'Other',
        farm:      row.loc,           // ← seeded WITH location now
        phone:     '',
        active:    true,
        ts:        Date.now(),
        seededFromRoster2026: true,
      });
    });
    batch.set(flagRef, { ts: Date.now(), count: STAFF_ROSTER_2026.length, version: '2026-06-14-loc' });
    // The location backfill is already satisfied by this seed.
    await db.collection('meta').doc('_staffLocations_v1').set({ ts: Date.now(), via: 'seed' });
    await batch.commit();
    console.log('[roster] seeded ' + STAFF_ROSTER_2026.length + ' employees with locations ✓');
  } catch (e) {
    console.warn('[roster] seed failed:', e);
  }
}

// ── Existing-install backfill: set each staff doc's farm by name ──────
// Runs once (gated by meta/_staffLocations_v1). Overwrites farm for every
// person we can identify, because the prior data (all blank) was wrong.
// Anyone we can't match is set to 'Both' only if their farm is still blank,
// so they stay visible everywhere rather than vanishing from pickers.
async function assignStaffLocationsIfNeeded() {
  try {
    const flagRef  = db.collection('meta').doc('_staffLocations_v1');
    const flagSnap = await flagRef.get();
    if (flagSnap.exists) return;

    const snap = await db.collection('staff').get();
    if (snap.empty) return;   // seedStaffRosterIfEmpty will handle a fresh install

    const batch = db.batch();
    let matched = 0, defaulted = 0;
    snap.docs.forEach(doc => {
      const d   = doc.data() || {};
      const loc = staffLocationFor(d.name);
      if (loc) {
        if (d.farm !== loc) { batch.update(doc.ref, { farm: loc }); matched++; }
        else matched++;
      } else if (!d.farm) {
        batch.update(doc.ref, { farm: 'Both' });
        defaulted++;
      }
    });
    batch.set(flagRef, { ts: Date.now(), matched, defaulted, version: '2026-06-14-loc' });
    await batch.commit();
    console.log(`[roster] location backfill complete — ${matched} matched, ${defaulted} defaulted to Both ✓`);
  } catch (e) {
    console.warn('[roster] location backfill failed:', e);
  }
}
