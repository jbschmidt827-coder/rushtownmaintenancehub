// ═══════════════════════════════════════════
// STAFF ROSTER SEED — 2026-05-13
// One-time loader for the official Rushtown Poultry 71-person roster.
// Runs in the background after the app boots. Gated by a meta flag
// (`meta/_staffRosterSeeded`) so it never runs twice. Skipped entirely
// if the staff collection already contains records.
//
// All employees are seeded as role='Other' and farm='' so dropdowns
// work immediately; Joe can edit each record's role + farm via the
// Staff panel as he tags people to barns.
// ═══════════════════════════════════════════

const STAFF_ROSTER_2026 = [
  { empId: '1002', last: 'Alicea',                first: 'Jonathan' },
  { empId: '1091', last: 'Ayala Sr',              first: 'Joseph D' },
  { empId: '1135', last: 'Barr',                  first: 'Natalie' },
  { empId: '1156', last: 'Bello Gonzalez',        first: 'Joaquin Tomas' },
  { empId: '1081', last: 'Bewley',                first: 'Trevor' },
  { empId: '1124', last: 'Bingaman',              first: 'Joshua' },
  { empId: '1136', last: 'Bixler',                first: 'Jill' },
  { empId: '1131', last: 'Bogar Jr',              first: 'Erik' },
  { empId: '1096', last: 'Boyer',                 first: 'Adrianna M' },
  { empId: '1159', last: 'Broschart',             first: 'Kayla' },
  { empId: '1137', last: 'Brosius',               first: 'Adam Miles' },
  { empId: '1114', last: 'Colon',                 first: 'Jose' },
  { empId: '1126', last: 'Davenport',             first: 'Celia' },
  { empId: '1092', last: 'Deitzler',              first: 'David S' },
  { empId: '1008', last: 'Derr',                  first: 'Bradley S' },
  { empId: '1154', last: 'Ernest',                first: 'John' },
  { empId: '1051', last: 'Foust',                 first: 'Cody A' },
  { empId: '1010', last: 'Fox',                   first: 'John P' },
  { empId: '1011', last: 'Garcia',                first: 'Arturo' },
  { empId: '1012', last: 'Garcia',                first: 'Candelaria' },
  { empId: '1155', last: 'Hansen',                first: 'Matthew' },
  { empId: '1161', last: 'Haynes',                first: 'Joshua' },
  { empId: '1157', last: 'Hernandez Hernandez',   first: 'Oscar Eduardo' },
  { empId: '1123', last: 'Jiminez',               first: 'Aracely' },
  { empId: '1115', last: 'Kipp',                  first: 'Mariah' },
  { empId: '1015', last: 'Klinger',               first: 'Thomas A' },
  { empId: '1152', last: 'Kramer',                first: 'Joshua' },
  { empId: '1017', last: 'Kuykendall',            first: 'Matthew S' },
  { empId: '1087', last: 'Lahout',                first: 'Michael' },
  { empId: '1127', last: 'Leisey',                first: 'Harry Steven' },
  { empId: '1067', last: 'Linsky',                first: 'Andrew' },
  { empId: '1044', last: 'Lopez-Jimenez',         first: 'Maria' },
  { empId: '1147', last: 'Lopez-Veguilla',        first: 'Christian D' },
  { empId: '1164', last: 'Madrid Castro',         first: 'Karen' },
  { empId: '1150', last: 'Madrid Romero',         first: 'Norlan E' },
  { empId: '1128', last: 'Manning',               first: 'Claire' },
  { empId: '1140', last: 'Martz',                 first: 'Debra C' },
  { empId: '1089', last: 'McCarthy Jr',           first: 'Sean R' },
  { empId: '1023', last: 'Nye',                   first: 'Shawn Z' },
  { empId: '1110', last: 'Orellana',              first: 'Marifer M' },
  { empId: '1113', last: 'Ortiz',                 first: 'Leidy Yessenia' },
  { empId: '1122', last: 'Perez',                 first: 'Milagros' },
  { empId: '1098', last: 'Perez',                 first: 'Norma' },
  { empId: '1045', last: 'Perez-Sanchez',         first: 'Carlos U' },
  { empId: '1085', last: 'Pico Estrada',          first: 'Jorge A' },
  { empId: '1024', last: 'Piestrak',              first: 'Nathan' },
  { empId: '1106', last: 'Quiles',                first: 'Hector' },
  { empId: '1095', last: 'Roarabaugh',            first: 'Thomas P' },
  { empId: '1078', last: 'Ross',                  first: 'Quil' },
  { empId: '1148', last: 'Rudderow',              first: 'Lindsey' },
  { empId: '1086', last: 'Salazar Samuel',        first: 'Jenny Catherine' },
  { empId: '1056', last: 'Sanchez',               first: 'Dervys' },
  { empId: '1047', last: 'Sanchez-Roblero',       first: 'Cain' },
  { empId: '1141', last: 'Schell',                first: 'Elizabeth' },
  { empId: '1100', last: 'Schmidt',               first: 'Joseph' },
  { empId: '1142', last: 'Schmitt',               first: 'Paul' },
  { empId: '1037', last: 'Shaffer',               first: 'Kyle G' },
  { empId: '1130', last: 'Sibaja Cruz',           first: 'Daniela' },
  { empId: '1160', last: 'Smullen',               first: 'Michael Kenneth' },
  { empId: '1153', last: 'Strobel',               first: 'Tiffany' },
  { empId: '1149', last: 'Tenorio',               first: 'Lyneth' },
  { empId: '1027', last: 'Thompson',              first: 'John' },
  { empId: '1125', last: 'Torres',                first: 'Ruth' },
  { empId: '1029', last: 'Ulrich',                first: 'Tim L' },
  { empId: '1102', last: 'Walters',               first: 'Allison' },
  { empId: '1107', last: 'Weidner',               first: 'Cody' },
  { empId: '1144', last: 'Wenrich',               first: 'Tammy A' },
  { empId: '1162', last: 'Wilt',                  first: 'Eric' },
  { empId: '1145', last: 'Wolfe',                 first: 'Nathan' },
  { empId: '1146', last: 'Wolfe',                 first: 'Randy E' },
  { empId: '1094', last: 'Zeiset',                first: 'Raymond W' },
  { empId: '1119', last: 'Ziegler',               first: 'Shawn' },
];

async function seedStaffRosterIfEmpty() {
  try {
    // Gate 1: meta flag — never seed twice.
    const flagRef  = db.collection('meta').doc('_staffRosterSeeded');
    const flagSnap = await flagRef.get();
    if (flagSnap.exists) return;

    // Gate 2: if staff already exist, don't blow them away — just mark seeded.
    const existing = await db.collection('staff').limit(1).get();
    if (!existing.empty) {
      await flagRef.set({ ts: Date.now(), reason: 'staff-already-present-skip' });
      console.log('[roster] staff already present, marking seeded without writing.');
      return;
    }

    console.log('[roster] seeding ' + STAFF_ROSTER_2026.length + ' employees…');

    // Firestore batch limit is 500 ops. We have 72 (71 + 1 flag), well under.
    const batch = db.batch();
    STAFF_ROSTER_2026.forEach(row => {
      const ref = db.collection('staff').doc();
      batch.set(ref, {
        name:      row.first + ' ' + row.last,
        firstName: row.first,
        lastName:  row.last,
        empId:     row.empId,
        role:      'Other',
        farm:      '',
        phone:     '',
        active:    true,
        ts:        Date.now(),
        seededFromRoster2026: true,
      });
    });
    batch.set(flagRef, {
      ts: Date.now(),
      count: STAFF_ROSTER_2026.length,
      version: '2026-05-13',
    });
    await batch.commit();
    console.log('[roster] seeded ' + STAFF_ROSTER_2026.length + ' employees ✓');
  } catch (e) {
    console.warn('[roster] seed failed:', e);
  }
}
