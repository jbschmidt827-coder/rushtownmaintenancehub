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

    // Group by farm (pmId format: "Farm-...")
    const byFarm = {};
    overdue.forEach(o => {
      const farm = o.pmId.startsWith('Danville') ? 'Danville' : 'Hegins';
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
