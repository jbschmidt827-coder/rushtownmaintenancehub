const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { onRequest }         = require('firebase-functions/v2/https');
const { defineSecret }      = require('firebase-functions/params');
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

// ────────────────────────────────────────────────────
// SCHEDULED — nightly full-database backup (2:30 AM ET)
// Restorable export of EVERY collection to Cloud Storage; keeps 30 days.
// One-time setup: Firebase Console → Build → Storage → Get started
// (creates the gs://rushtown-poultry.firebasestorage.app bucket).
// Restore a day (from a machine with gcloud):
//   gcloud firestore import gs://rushtown-poultry.firebasestorage.app/firestore-backups/<YYYY-MM-DD>
// ────────────────────────────────────────────────────
const { v1: firestoreV1 } = require('@google-cloud/firestore');
const BACKUP_BUCKET = 'rushtown-poultry.firebasestorage.app';

exports.nightlyBackup = onSchedule(
  { schedule: '30 2 * * *', timeZone: 'America/New_York', region: 'us-central1' },
  async () => {
    const client    = new firestoreV1.FirestoreAdminClient();
    const projectId = process.env.GCLOUD_PROJECT || 'rushtown-poultry';
    const stamp     = etDateStr(0);
    await client.exportDocuments({
      name: client.databasePath(projectId, '(default)'),
      outputUriPrefix: `gs://${BACKUP_BUCKET}/firestore-backups/${stamp}`,
      collectionIds: [],                      // empty = all collections
    });
    console.log('Firestore backup exported:', stamp);
    // Prune backups older than 30 days so storage never balloons.
    try {
      const [files] = await admin.storage().bucket(BACKUP_BUCKET)
        .getFiles({ prefix: 'firestore-backups/' });
      const cutoff = Date.now() - 30 * 86400000;
      await Promise.all(files
        .filter(f => new Date(f.metadata.timeCreated).getTime() < cutoff)
        .map(f => f.delete().catch(() => {})));
    } catch (e) { console.warn('Backup prune skipped:', e.message); }
    return null;
  }
);

// ────────────────────────────────────────────────────
// HTTPS — Rooster 🐓 AI help chat (Claude API proxy)
// The API key lives HERE as a secret, never in the app. Only signed-in app
// instances (invisible anonymous auth) may call it — strangers get a 401,
// so nobody can burn API credits from outside.
// One-time setup before deploy:
//   firebase functions:secrets:set ANTHROPIC_API_KEY
//   (paste a key from console.anthropic.com)
// ────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const ROOSTER_SYSTEM = `You are Rooster 🐓, the friendly in-app helper for the Rushtown Poultry Operations Hub — a PWA used on iPads/phones by farm crews at two layer sites (Hegins houses 4-8, Danville houses 1-5) plus a Processing Plant and Feed Mill.

Answer questions about HOW TO USE THE APP, step by step, in the language the user writes (English or Spanish). Be brief, warm, and concrete — these are busy farm workers with dirty gloves. Use short numbered steps. If asked something unrelated to the app or farm work, politely steer back.

APP MAP (how to get around):
• Open the app → pick a location (Hegins / Danville / Master). The home screen shows big cards for your department; tap "More" to see the rest.
• PRODUCTION card → Daily Employee Check (per-block barn walk wizard: mortality, equipment, air, feed/water, belts, pests — every answer required, N/A allowed for egg/rodent counts), Morning Walk (Lead/WNO: water PSI, temp, feed meter, bins, fans/blowers — drafts autosave), Today's Summary, Biosecurity Log, Pest Log, Barn/Morning Walk History.
• MAINTENANCE card → Work Orders (tap a card to update status), PM Schedule (procedures + checklist sign-off; Bulk Catch-Up to clear overdue), Parts inventory (receive stock, low-stock alerts), Work Instructions, Projects (multi-task efforts with checklists), 5S audits.
• MANURE card → per-house belt-run in a fixed 2-hour window (status shows upcoming/running/past), each collector C1-C6 gets % ran (0/50/100) + PM/Belt/Clean/Align checks. "All 100%" and "✓ All checks" do a house in one tap. 🕐 button sets belt-run times; ❓ opens instructions.
• COMPLETION card → today's grid of every house × check (Morning Walk / Daily Check / Manure).
• DAILY SCORECARD → mortality SPC, PM compliance, completion trends.
• QUICK ACTIONS → 🔧 New Work Order (fast form: name, house, problem, priority, photos; 🎤 button lets you dictate the description), 📖 How To Use guide, 🥠 Farm Fortune, 🏚 House Status (mark a house down/up for rebuild — closes its open work orders).
• Work orders: Quick WO = fastest. Urgent priority pushes a notification to the team. ⚡ Action Rail on a WO card can turn it into a Project.
• 🌐 ES/EN button switches language app-wide. The version number is at the bottom of the home screen; the app updates itself when iPads wake.
• End-of-Shift report lives under Production → EOS Report.
• House down for rebuild? Quick Actions → 🏚 House Status — its checks disappear from tracking until marked back up.

RULES: Never invent features that aren't listed. If unsure, say so and point to 📖 How To Use. Keep answers under 120 words unless steps demand more.`;

exports.roosterChat = onRequest(
  { region: 'us-central1', cors: true, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
    // Only the app may call this (invisible anonymous sign-in from core.js).
    try {
      const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      await admin.auth().verifyIdToken(idToken);
    } catch (e) { res.status(401).json({ error: 'unauthorized' }); return; }

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    if (!messages.length) { res.status(400).json({ error: 'no messages' }); return; }
    // Sanitize: only role+text through, capped length.
    const clean = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY.value(),
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',   // fast + cheap — right fit for app help
          max_tokens: 600,
          system: ROOSTER_SYSTEM,
          messages: clean,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        console.error('Anthropic error:', JSON.stringify(data).slice(0, 500));
        res.status(502).json({ error: 'upstream' });
        return;
      }
      const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
      res.json({ text });
    } catch (e) {
      console.error('roosterChat failed:', e.message);
      res.status(500).json({ error: 'internal' });
    }
  }
);
