const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const admin                 = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── PM frequency thresholds (mirrors core.js FREQ) ──
const FREQ_DAYS = {
  daily:      1,
  mwf:        2,
  weekly:     7,
  monthly:    30,
  quarterly:  90,
  semiannual: 180,
  annual:     365,
};

// ────────────────────────────────────────────────────
// HELPER — send FCM push to all registered devices
// ────────────────────────────────────────────────────
async function sendPushToAll(title, body, tag = 'rushtown') {
  const snap = await db.collection('fcmTokens').get();
  const tokens = snap.docs.map(d => d.data().token).filter(Boolean);
  if (!tokens.length) return;

  const msg = {
    notification: { title, body },
    data: { tag },
    tokens,
  };
  const res = await admin.messaging().sendEachForMulticast(msg);

  // Clean up invalid tokens
  const batch = db.batch();
  res.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
      batch.delete(db.collection('fcmTokens').doc(tokens[i]));
    }
  });
  await batch.commit().catch(() => {});
}

// ────────────────────────────────────────────────────
// HELPER — write a notification doc to Firestore
// ────────────────────────────────────────────────────
async function writeNotification(type, title, body) {
  await db.collection('notifications').add({
    type, title, body,
    read: false,
    ts: Date.now(),
  });
}

// ────────────────────────────────────────────────────
// TRIGGER — On-Call event logged
// ────────────────────────────────────────────────────
exports.notifyOnCall = onDocumentCreated(
  { document: 'onCallLog/{docId}', region: 'us-central1' },
  async (event) => {
    const oc = event.data?.data();
    if (!oc) return null;

    const urgent = oc.urgent ? '🚨 URGENT — ' : '';
    const title  = `${urgent}📞 On-Call Event — ${oc.site}`;
    const body   = `${oc.ocNum}: ${oc.reason} · Who: ${oc.who}${oc.description ? ' · ' + oc.description.slice(0, 80) : ''}`;

    await Promise.all([
      sendPushToAll(title, body, 'oncall'),
      writeNotification('oncall', title, body),
    ]);
    return null;
  }
);

// ────────────────────────────────────────────────────
// TRIGGER — Urgent Work Order created
// ────────────────────────────────────────────────────
exports.notifyUrgentWO = onDocumentCreated(
  { document: 'workOrders/{woId}', region: 'us-central1' },
  async (event) => {
    const wo = event.data?.data();
    if (!wo || wo.priority !== 'urgent') return null;

    const title = `🔧 Urgent Work Order — ${wo.farm}`;
    const body  = `${wo.id}: ${wo.problem} · ${wo.house || 'Site'} · Assigned: ${wo.tech || 'Unassigned'}`;

    await Promise.all([
      sendPushToAll(title, body, 'wo-urgent'),
      writeNotification('wo', title, body),
    ]);
    return null;
  }
);

// ────────────────────────────────────────────────────
// SCHEDULED — Daily 6 AM PM overdue check
// Runs every day at 6:00 AM Eastern
// ────────────────────────────────────────────────────
exports.dailyPMCheck = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'America/New_York', region: 'us-central1' },
  async () => {
    const now     = Date.now();
    const MS_DAY  = 86400000;

    // Read all latest PM completions
    const snap = await db.collection('pmCompletions').get();

    // Read pmHistory to get freq per pmId (take latest entry per pmId)
    const histSnap  = await db.collection('pmHistory').orderBy('ts', 'desc').get();
    const freqMap   = {};   // pmId → freq
    histSnap.forEach(d => {
      const { pmId, freq } = d.data();
      if (pmId && freq && !freqMap[pmId]) freqMap[pmId] = freq;
    });

    // Determine overdue
    const overdue = [];
    snap.forEach(d => {
      const pmId = d.id;
      const { date, ts } = d.data();
      const freq  = freqMap[pmId];
      const days  = FREQ_DAYS[freq];
      if (!days) return; // unknown freq, skip

      const lastTs   = ts || (date ? new Date(date + 'T12:00:00').getTime() : 0);
      const daysAgo  = (now - lastTs) / MS_DAY;
      if (daysAgo >= days) overdue.push({ pmId, freq, daysAgo: Math.floor(daysAgo) });
    });

    // Also flag PMs that have NEVER been done (not in pmCompletions at all)
    // — we don't know all PM IDs from Firestore alone, so we only handle existing completions

    if (!overdue.length) return null;

    // Group by farm (pmId format: "Farm-..."). Frontend supports multiple farms;
    // we read the first segment instead of hardcoding Danville/Hegins.
    const KNOWN_FARMS = ['Danville','Hegins','Rushtown','Turbotville','W&M'];
    const byFarm = {};
    overdue.forEach(o => {
      const seg  = String(o.pmId || '').split('-')[0];
      const farm = KNOWN_FARMS.includes(seg) ? seg : 'Other';
      byFarm[farm] = (byFarm[farm] || 0) + 1;
    });

    const summary = Object.entries(byFarm)
      .map(([f, n]) => `${f}: ${n}`)
      .join(' · ');

    const title = `⚠️ PM Tasks Overdue`;
    const body  = `${overdue.length} overdue PM${overdue.length !== 1 ? 's' : ''} — ${summary}. Open the app to catch up.`;

    await Promise.all([
      sendPushToAll(title, body, 'pm-overdue'),
      writeNotification('pm_overdue', title, body),
    ]);

    return null;
  }
);

// ────────────────────────────────────────────────────
// House / check helpers (mirror the app)
// ────────────────────────────────────────────────────
const LAYER_HOUSES  = { Hegins: [1, 2, 3, 4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };
const MANURE_LAYER  = { Hegins: [4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };

function etDateStr(daysAgo = 0) {
  // YYYY-MM-DD in America/New_York
  return new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
function hnum(h) { const m = String(h == null ? '' : h).match(/\d+/); return m ? m[0] : String(h); }

async function getDownHouses() {
  try {
    const doc = await db.collection('settings').doc('downHouses').get();
    const d = doc.exists ? (doc.data() || {}) : {};
    const out = {};
    Object.keys(d).forEach(f => { out[f] = (Array.isArray(d[f]) ? d[f] : []).map(String); });
    return out;
  } catch (e) { return {}; }
}
async function presentSet(coll, dateStr) {
  const s = new Set();
  try {
    const snap = await db.collection(coll).where('date', '==', dateStr).get();
    snap.forEach(doc => { const x = doc.data(); if (x && x.farm && x.house != null) s.add(x.farm + '|' + hnum(x.house)); });
  } catch (e) {}
  return s;
}

// ────────────────────────────────────────────────────
// SCHEDULED — Daily checks reminder (10:00 AM ET)
// Pushes if Morning Walk / Daily Check / Manure are still missing for any house
// (down houses excluded).
// ────────────────────────────────────────────────────
exports.dailyChecksReminder = onSchedule(
  { schedule: '0 10 * * *', timeZone: 'America/New_York', region: 'us-central1' },
  async () => {
    const today = etDateStr(0);
    const down  = await getDownHouses();
    const isDown = (farm, h) => (down[farm] || []).indexOf(hnum(h)) !== -1;
    const [mw, ck, ms] = await Promise.all([
      presentSet('morningWalks', today), presentSet('barnWalks', today), presentSet('manureSubmit', today),
    ]);
    let missMorning = 0, missCheck = 0, missManure = 0;
    Object.keys(LAYER_HOUSES).forEach(farm => {
      LAYER_HOUSES[farm].forEach(h => {
        if (isDown(farm, h)) return;
        const key = farm + '|' + h;
        if (!mw.has(key)) missMorning++;
        if (!ck.has(key)) missCheck++;
        if ((MANURE_LAYER[farm] || []).indexOf(h) !== -1 && !ms.has(key)) missManure++;
      });
    });
    if (!(missMorning + missCheck + missManure)) return null;
    const parts = [];
    if (missMorning) parts.push(`${missMorning} Morning Walk`);
    if (missCheck)   parts.push(`${missCheck} Daily Check`);
    if (missManure)  parts.push(`${missManure} Manure`);
    const title = '⏰ Daily checks not done';
    const body  = `Still open: ${parts.join(' · ')} house(s). Tap to finish them up.`;
    await Promise.all([ sendPushToAll(title, body, 'daily-missed'), writeNotification('daily_missed', title, body) ]);
    return null;
  }
);

// ────────────────────────────────────────────────────
// SCHEDULED — Manager morning digest (5:45 AM ET)
// Yesterday's completion %, open urgent WOs, overdue PMs, mortality.
// ────────────────────────────────────────────────────
exports.managerDigest = onSchedule(
  { schedule: '45 5 * * *', timeZone: 'America/New_York', region: 'us-central1' },
  async () => {
    const yday   = etDateStr(1);
    const down   = await getDownHouses();
    const isDown = (farm, h) => (down[farm] || []).indexOf(hnum(h)) !== -1;
    const [mw, ck, ms] = await Promise.all([
      presentSet('morningWalks', yday), presentSet('barnWalks', yday), presentSet('manureSubmit', yday),
    ]);
    let done = 0, app = 0, mort = 0;
    Object.keys(LAYER_HOUSES).forEach(farm => {
      LAYER_HOUSES[farm].forEach(h => {
        if (isDown(farm, h)) return;
        const key = farm + '|' + h;
        app += 2; if (mw.has(key)) done++; if (ck.has(key)) done++;
        if ((MANURE_LAYER[farm] || []).indexOf(h) !== -1) { app++; if (ms.has(key)) done++; }
      });
    });
    const pct = app ? Math.round(done / app * 100) : 0;
    try { const bw = await db.collection('barnWalks').where('date', '==', yday).get(); bw.forEach(d => { mort += Number((d.data() || {}).mortCount) || 0; }); } catch (e) {}
    let urgent = 0;
    try { const wos = await db.collection('workOrders').where('status', '==', 'open').get(); wos.forEach(d => { if ((d.data() || {}).priority === 'urgent') urgent++; }); } catch (e) {}
    let overdue = 0;
    try {
      const now = Date.now(), MS_DAY = 86400000;
      const comps = await db.collection('pmCompletions').get();
      const hist  = await db.collection('pmHistory').orderBy('ts', 'desc').get();
      const freqMap = {};
      hist.forEach(d => { const { pmId, freq } = d.data(); if (pmId && freq && !freqMap[pmId]) freqMap[pmId] = freq; });
      comps.forEach(d => {
        const { date, ts } = d.data(); const days = FREQ_DAYS[freqMap[d.id]];
        if (!days) return;
        const lastTs = ts || (date ? new Date(date + 'T12:00:00').getTime() : 0);
        if ((now - lastTs) / MS_DAY >= days) overdue++;
      });
    } catch (e) {}
    const title = '📋 Morning Briefing';
    const body  = `Yesterday: ${pct}% checks done · ${urgent} urgent WO${urgent !== 1 ? 's' : ''} · ${overdue} PM${overdue !== 1 ? 's' : ''} overdue · ${mort} dead.`;
    await Promise.all([ sendPushToAll(title, body, 'digest'), writeNotification('digest', title, body) ]);
    return null;
  }
);
