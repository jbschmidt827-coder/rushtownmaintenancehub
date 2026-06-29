// ═══════════════════════════════════════════
// FIREBASE INIT (compat — no type=module)
// ═══════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyBRPjACWaVeHXw4ztydZVB-_MTMwEWfWmY",
  authDomain: "rushtown-poultry.firebaseapp.com",
  projectId: "rushtown-poultry",
  storageBucket: "rushtown-poultry.firebasestorage.app",
  messagingSenderId: "1050651051862",
  appId: "1:1050651051862:web:c83d671abaec7f4c8378f7"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── OFFLINE PERSISTENCE ──────────────────────────────────────────────────
// Keeps a copy of Firestore data in the browser's IndexedDB so the app loads
// and shows live data even with no signal in the barns. Writes made while
// offline are also cached by Firestore and replayed automatically on
// reconnect. MUST be called before any other Firestore use, so it lives here
// right after db is created. synchronizeTabs lets multiple open tabs share
// one cache instead of fighting over the lock.
try {
  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    // failed-precondition = multiple tabs without sync support;
    // unimplemented = browser doesn't support it. Either way the app still
    // works online — it just won't have the offline cache.
    console.warn('Firestore offline persistence unavailable:', err && err.code);
  });
} catch (e) {
  console.warn('enablePersistence threw:', e);
}

// Login was removed (too many farm staff don't have email accounts).
// The ADMIN_PIN below still gates admin actions inside the app.

// ═══════════════════════════════════════════
// ADMIN PIN SYSTEM
// ═══════════════════════════════════════════
const ADMIN_PIN = '1234'; // ← change this to your desired PIN
var _adminUnlocked = false;
var _adminPinEntry = '';
var _adminPendingCallback = null;

function requireAdmin(callback) {
  if (_adminUnlocked) { callback(); return; }
  _adminPendingCallback = callback;
  _adminPinEntry = '';
  _adminUpdateDots();
  document.getElementById('admin-pin-error').style.display = 'none';
  document.getElementById('admin-pin-modal').style.display = 'flex';
}

function adminPinDigit(d) {
  if (_adminPinEntry.length >= 4) return;
  _adminPinEntry += d;
  _adminUpdateDots();
  if (_adminPinEntry.length === 4) {
    setTimeout(() => {
      if (_adminPinEntry === ADMIN_PIN) {
        _adminUnlocked = true;
        document.getElementById('admin-pin-modal').style.display = 'none';
        document.getElementById('admin-lock-btn').style.display = 'flex';
        const cb = _adminPendingCallback;
        _adminPendingCallback = null;
        if (cb) cb();
      } else {
        document.getElementById('admin-pin-error').style.display = 'block';
        _adminPinEntry = '';
        _adminUpdateDots();
        [1,2,3,4].forEach(i => {
          const d = document.getElementById('admin-pin-d'+i);
          d.style.background = '#5a1a1a';
          d.style.borderColor = '#e53e3e';
          setTimeout(() => { d.style.background = '#163016'; d.style.borderColor = '#3a7a3a'; }, 600);
        });
      }
    }, 120);
  }
}

function adminPinBackspace() {
  _adminPinEntry = _adminPinEntry.slice(0,-1);
  _adminUpdateDots();
}

function adminPinCancel() {
  _adminPendingCallback = null;
  _adminPinEntry = '';
  document.getElementById('admin-pin-modal').style.display = 'none';
}

function adminLock() {
  _adminUnlocked = false;
  document.getElementById('admin-lock-btn').style.display = 'none';
}

function _adminUpdateDots() {
  [1,2,3,4].forEach(i => {
    const dot = document.getElementById('admin-pin-d'+i);
    dot.style.background = i <= _adminPinEntry.length ? '#4caf50' : '#163016';
    dot.style.borderColor = i <= _adminPinEntry.length ? '#4caf50' : '#3a7a3a';
  });
}

// ═══════════════════════════════════════════
// LAYER FARM DIRECTORY
// ═══════════════════════════════════════════
const LAYER_FARMS = [
  { name:'A&L',               owner:'R&L',            address:'3304 Mountain Rd, Hamburg, PA 19526',          stateId:'PA060001',  fedId:'003G17A',  npip:'23-815', doorCode:'8391', contacts:[{name:'Cleason',phone:'717-926-1529'},{name:'Joshua',phone:'717-422-2231'}], email:'' },
  { name:'Ernest Hursh',      owner:'R&L',            address:'2050 Turkey Bird Rd, Newport, PA 17074',       stateId:'PA5002YG',  fedId:'00J4LZX',  npip:'23-818', doorCode:'3411', contacts:[{name:'Ernest Hursh',phone:'717-275-2642'}], email:'' },
  { name:'Mike Ewing',        owner:'R&L',            address:'497 Bannerville Hill Rd, McClure, PA 17841',   stateId:'PA5500CN',  fedId:'00G116P',  npip:'23-816', doorCode:'N/A',  contacts:[{name:'Michael Ewing',phone:'570-765-3614'},{name:'Janelle Brouse',phone:'570-765-3628'}], email:'gnatsumstacey@gmail.com' },
  { name:'Swatara Creek Poultry', owner:'Swatara Creek', address:'105 Dead End Rd, Lebanon, PA 17046',       stateId:'PA380387',  fedId:'00PMHNK',  npip:'23-813', doorCode:'8495', contacts:[{name:'Colleen Snyder',phone:'717-675-8495'}], email:'' },
  { name:'Collett Farms',     owner:'Collett',        address:'1118 Luxemburg Rd, Lykens, PA 17048',          stateId:'PA22033M',  fedId:'00K0LAP',  npip:'23-814', doorCode:'6264', contacts:[{name:'Obed',phone:'484-332-8438'}], email:'' },
  { name:'Kenneth Snyder',    owner:'Kenneth Snyder', address:'3797 Irish Creek Rd, Bernville, PA 19506',     stateId:'PA06004K',  fedId:'003G516',  npip:'23-829', doorCode:'3230', contacts:[{name:'Kenneth Snyder',phone:'267-278-1300'}], email:'' },
  { name:'Leonard Martin',    owner:'R&L',            address:'601 Bloody Spring Rd, Bernville, PA 19506',    stateId:'PA0603FH',  fedId:'00SDR53',  npip:'23-826', doorCode:'1066', contacts:[{name:'Leonard',phone:'570-294-3656'}], email:'' },
  { name:'JT Poultry, LLC',   owner:'JT Poultry',     address:'664 Mountain Rd, Elizabethville, PA 17023',    stateId:'PA2203AH',  fedId:'00STHLP',  npip:'23-846', doorCode:'4600', contacts:[{name:'Jared Moore',phone:'570-274-6896'}], email:'jtpoultryfarms@gmail.com' },
  { name:'Brian Martin',      owner:'Brian Martin',   address:'195 Fort Swatara Rd, Jonestown, PA 17038',     stateId:'PA3803BB',  fedId:'00R5CXB',  npip:'',       doorCode:'N/A',  contacts:[{name:'Brian Martin',phone:'717-813-4826'}], email:'brianlmartin1980@gmail.com' },
  { name:'Travis Burkholder', owner:'Travis Burkholder', address:'700 Green Spring Rd, Newville, PA 17241',   stateId:'',          fedId:'00SWXM5',  npip:'23-852', doorCode:'0421', contacts:[{name:'Travis',phone:'717-776-4738'}], email:'tkburkholder@upwardmail.com' },
  { name:'Samuel Lapp',       owner:'R&L',            address:'7780 Lancaster Ave, Myerstown, PA 17067',      stateId:'',          fedId:'00K9066',  npip:'',       doorCode:'N/A',  contacts:[{name:'Samuel Lapp',phone:'717-926-1965'}], email:'' },
  { name:'Hidden Hollow Poultry LLC', owner:'Hidden Hollow', address:'160 Oakville Rd, Newville, PA 17241',   stateId:'',          fedId:'00T57KT',  npip:'23-879', doorCode:'8360', contacts:[{name:'Matt Neally',phone:'717-226-5435'},{name:'Steven Weaver',phone:'717-446-4217'},{name:'Tommy',phone:'717-226-4018'}], email:'hiddenhollowpoultryllc@gmail.com' },
  { name:'Alex Hursh',        owner:'R&L',            address:'1900 Turkey Bird Rd, Newport, PA 17074',       stateId:'',          fedId:'00TKT7U',  npip:'23-896', doorCode:'6474', contacts:[{name:'Alex Hursh',phone:'717-275-6204'}], email:'' },
  { name:'Austin Hurst',      owner:'R&L',            address:'37 New Schaefferstown Rd, Bernville, PA 19506',stateId:'',          fedId:'00KCWM1',  npip:'',       doorCode:'',     contacts:[{name:'Austin Hurst',phone:'717-517-0706'}], email:'kaitlynlorelle@gmail.com' },
  { name:'Dwayne Peifer',     owner:'R&L',            address:'510 Mt. Eden Rd, Kirkwood, PA 17536',          stateId:'',          fedId:'00TKQHM',  npip:'23-895', doorCode:'2838', contacts:[{name:'Dwayne Peifer',phone:'717-666-8093'}], email:'dkpeifer@frontier.com' },
  { name:'Timothy Reiff',     owner:'R&L',            address:'480 Baltimore Rd, Shippensburg, PA 17257',     stateId:'',          fedId:'00TLPN6',  npip:'',       doorCode:'',     contacts:[{name:'Tim Reiff (Home)',phone:'717-477-8063'},{name:'Tim Reiff (Work)',phone:'717-491-5477'}], email:'Sparkies5477@gmail.com' },
  { name:'Nathan Zimmerman',  owner:'R&L',            address:'760 N Market St, Myerstown, PA 17067',         stateId:'',          fedId:'00TKDY1',  npip:'23-898', doorCode:'3589', contacts:[{name:'Nathan Zimmerman',phone:'717-304-9905'}], email:'Nzim34906@gmail.com' },
  { name:'Keith Nolt',        owner:'Keith Nolt',     address:'1519 Slate Hill Rd, Peach Bottom, PA 17563',   stateId:'',          fedId:'004FA05',  npip:'',       doorCode:'',     contacts:[{name:'Keith',phone:'717-669-5331'}], email:'Knolt97@yahoo.com' },
  { name:'Rushtown Poultry, LLC', owner:'Rushtown',   address:'970 Rushtown Rd, Danville, PA 17821',          stateId:'',          fedId:'00REKKB',  npip:'23-541', doorCode:'N/A',  contacts:[{name:'Katie Ronk',phone:'717-644-1060'},{name:'Nate Piestrak',phone:'570-284-7520'},{name:'Brad Martin',phone:'717-376-8104'}], email:'' },
  { name:'Milan',             owner:'RTP',            address:'1194 Milan Rd, Milan, PA 18831',               stateId:'PA08035H',  fedId:'00S4JCH',  npip:'23-819', doorCode:'4635', contacts:[{name:'Jorge (Spanish Only)',phone:'484-940-0295'},{name:'Nate Piestrak',phone:'570-284-7520'},{name:'Brad Martin',phone:'717-376-8104'}], email:'' },
  { name:'W&M Farms LLC',     owner:'RTP',            address:'972 Friedline Rd, Danville, PA 17822',         stateId:'',          fedId:'00D6RKA',  npip:'23-871', doorCode:'2525', contacts:[{name:'Wade Martin',phone:'717-639-1121'}], email:'Wademar678@gmail.com' },
  { name:'Meadow Ridge Farms',owner:'RTP',            address:'9 W Four Point Rd, Richland, PA 17087',        stateId:'PA06032B',  fedId:'00JZ7FP',  npip:'',       doorCode:'1555', contacts:[{name:'Glenden Martin',phone:'717-926-1888'}], email:'glendenmartin1@yahoo.com' },
  { name:'Turbotville',       owner:'RTP',            address:'155 Foggy Mountain Rd, Turbotville, PA 17772', stateId:'PA47014W',  fedId:'00PAHL7',  npip:'23-817', doorCode:'',     contacts:[{name:'Daniel',phone:'570-293-0022'},{name:'Nate Piestrak',phone:'570-284-7520'},{name:'Brad Martin',phone:'717-376-8104'}], email:'' },
  { name:'Nelson Martin',     owner:'RTP',            address:'502 E Rosebud Rd, Myerstown, PA 17067',        stateId:'',          fedId:'003LHJU',  npip:'',       doorCode:'',     contacts:[{name:'Nelson Martin',phone:'717-679-3270'}], email:'' },
  { name:'Lamar Zimmerman',   owner:'Rushtown',       address:'138 Hetzels Church Rd, Pinegrove, PA 17963',   stateId:'',          fedId:'00LUJ61',  npip:'23-603', doorCode:'',     contacts:[{name:'Kris Zimmerman',phone:'717-673-0753'}], email:'' },
  { name:'Hegins Valley Farms',owner:'Rushtown',      address:'824 Church Rd, Hegins, PA 17938',              stateId:'',          fedId:'003MQLH',  npip:'23-583', doorCode:'',     contacts:[{name:'Debra Martz',phone:''}], email:'' },
];

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════
const FARM_HOUSES = {
  Hegins:   ['House 1','House 2','House 3','House 4','House 5','House 6','House 7','House 8'],
  Danville: ['House 1','House 2','House 3','House 4','House 5'],
  // Processing Plant has no houses — it has plant areas instead.
  // These are the egg-handling line locations a WO could pin to.
  'Processing Plant': ['Packing Floor','Washer Line','Candler / Detector Line','Cooler / Storage','Loader','Boiler Room','Air Compressor Room','Loading Dock','Office']
};
const AREAS = ['Feed System','Watering System','Ventilation / Fans','Heating / Brooders','Electrical Panel','Well House / Pump','Catch / Load Out','Generator','Vehicle / Equipment','Shop / Office','Other'];
const FREQ = {
  daily:      {label:'Daily',        icon:'🟢', days:1},
  mwf:        {label:'Mon/Wed/Fri',  icon:'🔁', days:2},
  weekly:     {label:'Weekly',       icon:'🔵', days:7},
  monthly:    {label:'Monthly',      icon:'🟡', days:30},
  quarterly:  {label:'Quarterly',    icon:'🟠', days:90},
  semiannual: {label:'Bi-Annual',    icon:'🟣', days:180},
  annual:     {label:'Annual',       icon:'🔴', days:365},
};
const SYS_TAG  = {Ventilation:'t-vent',Water:'t-water',Feed:'t-feed','Feed System':'t-feed',Feeders:'t-feed',Manure:'t-manure','Egg Collectors':'t-egg',Building:'t-building',Alarms:'t-water',Lubing:'t-lubing','Processing Plant':'t-egg',Packaging:'t-egg'};

// Maps WO problem type keywords → parts system categories
const PROBLEM_TO_PARTS = {
  'Ventilation': ['Ventilation'],
  'Water':       ['Water'],
  'Feed':        ['Feed'],
  'Manure':      ['Manure'],
  'Egg':         ['Egg Collectors'],
  'Lubing':      ['Lubing'],
  'Heating':     ['General','Ventilation'],
  'Electrical':  ['General'],
  'Structure':   ['General'],
  'Vehicle':     ['General'],
  'Other':       null, // null = show all
};

function getPartsForProblem(problem) {
  if (!problem) return PARTS_DEFS;
  const key = Object.keys(PROBLEM_TO_PARTS).find(k => problem.includes(k));
  const systems = key ? PROBLEM_TO_PARTS[key] : null;
  if (!systems) return PARTS_DEFS;
  return PARTS_DEFS.filter(p => systems.includes(p.sys));
}

// Assign RH-### numbers to all parts at runtime (called after PARTS_DEFS is defined)
function assignRHNumbers() {
  PARTS_DEFS.forEach((p, i) => {
    p.rhNum = 'RH-' + String(i + 1).padStart(3, '0');
  });
}
let poCounter = 1;
async function loadPOCounter() {
  try {
    const doc = await db.collection('settings').doc('poCounter').get();
    if (doc.exists) poCounter = (doc.data().val || 0) + 1;
  } catch(e) { poCounter = 1; }
}
// Atomic PO ID minting — same pattern as mintWoId(). Prevents two devices
// from generating the same PO-#### at the same time.
async function getNextPO() {
  const counterRef = db.collection('settings').doc('poCounter');
  const n = await db.runTransaction(async tx => {
    const snap = await tx.get(counterRef);
    let v;
    if (snap.exists && typeof snap.data().val === 'number' && snap.data().val > 0) {
      v = snap.data().val;
    } else {
      v = (typeof poCounter !== 'undefined' && poCounter > 0) ? poCounter : 1;
    }
    tx.set(counterRef, { val: v + 1 });
    return v;
  });
  poCounter = n + 1;
  return 'PO-' + String(n).padStart(4,'0');
}

// ─── Work Order ID minting ──────────────────────────────────────────────
// Atomically allocate the next WO-### number using a Firestore transaction.
// Two devices submitting at the same instant previously could both produce
// the same human-readable id (different _fbIds, same "WO-042"), which made
// records look like duplicates downstream. Running the increment inside a
// transaction guarantees a unique number across all devices.
//
// All call sites should use:    const woId = await mintWoId();
// rather than computing 'WO-' + woCounter directly.
async function mintWoId() {
  const counterRef = db.collection('settings').doc('woCounter');
  const next = await db.runTransaction(async tx => {
    const snap = await tx.get(counterRef);
    let n;
    if (snap.exists && typeof snap.data().val === 'number' && snap.data().val > 0) {
      n = snap.data().val;
    } else {
      // Bootstrap from the locally computed woCounter (set by initApp from
      // the existing workOrders collection). Falls back to 1 if unavailable.
      n = (typeof woCounter !== 'undefined' && woCounter > 0) ? woCounter : 1;
    }
    tx.set(counterRef, { val: n + 1 });
    return n;
  });
  // Keep the local counter in sync so any UI that displays "next WO" stays right.
  if (typeof woCounter !== 'undefined') woCounter = next + 1;
  return 'WO-' + String(next).padStart(3, '0');
}
const SYS_ICON = {Ventilation:'💨',Water:'💧',Feed:'🌾','Feed System':'🌾',Feeders:'🌾',Manure:'♻️','Egg Collectors':'🥚',Building:'🏚️',Alarms:'🚨',Lubing:'🛢️','Processing Plant':'📦',Packaging:'📦'};

const PM_DEFS = [
  // ── MANURE SYSTEM ─────────────────────────────────────────
  {id:'mn1',sys:'Manure',task:'Check manure drying fans are running',freq:'daily',hrs:0.25},
  {id:'mn2',sys:'Manure',task:'Check manure belts — report any problems to supervisor',freq:'daily',hrs:0.25},
  {id:'mnr_h',sys:'Manure',task:'Run manure belts — Houses 4, 5, 6, 7, 8 (2.25 hrs per house)',freq:'mwf',hrs:11.25, farms:['Hegins']},
  {id:'mnr_d',sys:'Manure',task:'Run manure belts — all 5 houses (2.25 hrs per house)',freq:'daily',hrs:11.25, farms:['Danville']},
  {id:'mn3',sys:'Manure',task:'Loosen plows and clean off manure after running',freq:'mwf',hrs:0.5, farms:['Hegins']},
  {id:'mn4',sys:'Manure',task:'Open all curtains after done running',freq:'mwf',hrs:0.25, farms:['Hegins']},
  {id:'mn5',sys:'Manure',task:'Clean trip switch on manure scrapers',freq:'daily',hrs:0.25},
  {id:'mn6',sys:'Manure',task:'Clean manure in pit — must stay clean',freq:'weekly',hrs:1.0},
  {id:'mn7',sys:'Manure',task:'Check auger rollers for buildup — clean if necessary',freq:'weekly',hrs:0.5},
  {id:'mn8',sys:'Manure',task:'Check trip sensors on floor scrapers for proper operation',freq:'weekly',hrs:0.5},
  {id:'mn9',sys:'Manure',task:'Clean screens on manure drying fans',freq:'weekly',hrs:0.5},
  {id:'mn10',sys:'Manure',task:'Check tracking on pit belt',freq:'weekly',hrs:0.25},
  {id:'mn11',sys:'Manure',task:'Check tracking on incline belt',freq:'weekly',hrs:0.25},
  {id:'mn12',sys:'Manure',task:'Oil all chains on manure system',freq:'monthly',hrs:1.0},
  {id:'mn13',sys:'Manure',task:'Check bearings on entire manure system — including pit and incline belt',freq:'monthly',hrs:1.0},
  {id:'mn14',sys:'Manure',task:'Check chain tensioners',freq:'monthly',hrs:0.5},
  {id:'mn15',sys:'Manure',task:'Check chain tension',freq:'monthly',hrs:0.5},
  {id:'mn16',sys:'Manure',task:'Check and clean auger rollers and bushings',freq:'monthly',hrs:0.75},
  {id:'mn17',sys:'Manure',task:'Oil all adjuster plates and bolts',freq:'monthly',hrs:0.5},
  {id:'mn18',sys:'Manure',task:'Check plow gap for proper clearance — adjust if needed',freq:'monthly',hrs:0.5},
  {id:'mn19',sys:'Manure',task:'Check pit belt condition',freq:'monthly',hrs:0.25},
  {id:'mn20',sys:'Manure',task:'Check incline belt condition',freq:'monthly',hrs:0.25},
  {id:'mn21',sys:'Manure',task:'Check V-belts on pit belt',freq:'monthly',hrs:0.25},
  {id:'mn22',sys:'Manure',task:'Check V-belts on incline belt',freq:'monthly',hrs:0.25},
  {id:'mn23',sys:'Manure',task:'Grease bearings on pit and incline belt',freq:'monthly',hrs:0.5},
  {id:'mn24',sys:'Manure',task:'Blow out all motors and clean fan shrouds',freq:'monthly',hrs:1.0},
  {id:'mn25',sys:'Manure',task:'Check oil in all gear boxes',freq:'monthly',hrs:0.5},
  {id:'mn26',sys:'Manure',task:'Check cables on manure scrapers',freq:'monthly',hrs:0.5},
  {id:'mn27',sys:'Manure',task:'Check pulleys on manure scrapers',freq:'monthly',hrs:0.5},
  {id:'mn28',sys:'Manure',task:'Check and clean out holes in 2x6s on scraper system',freq:'monthly',hrs:0.5},
  // ── EGG COLLECTORS ────────────────────────────────────────
  {id:'ec1',sys:'Egg Collectors',task:'Check for egg jams',freq:'daily',hrs:0.25},
  {id:'ec2',sys:'Egg Collectors',task:'Check white egg belts for fraying',freq:'daily',hrs:0.25},
  {id:'ec3',sys:'Egg Collectors',task:'Check tracking on Niagara belts',freq:'daily',hrs:0.25},
  {id:'ec4',sys:'Egg Collectors',task:'Check tension on egg belts',freq:'weekly',hrs:0.25},
  {id:'ec5',sys:'Egg Collectors',task:'Oil all chains on egg collector system',freq:'monthly',hrs:0.75},
  {id:'ec6',sys:'Egg Collectors',task:'Check bearings, shafts, and rollers on egg collector system',freq:'monthly',hrs:0.75},
  {id:'ec7',sys:'Egg Collectors',task:'Check chain tension on egg collectors — tighten when needed',freq:'monthly',hrs:0.5},
  {id:'ec8',sys:'Egg Collectors',task:'Check Niagara belt for missing fingers',freq:'monthly',hrs:0.25},
  {id:'ec9',sys:'Egg Collectors',task:'Clean Niagara belt if dirty',freq:'monthly',hrs:0.5},
  {id:'ec10',sys:'Egg Collectors',task:'Check all egg belts and fingers — replace as necessary',freq:'monthly',hrs:0.5},
  {id:'ec11',sys:'Egg Collectors',task:'Check egg belt tracking',freq:'monthly',hrs:0.25},
  {id:'ec12',sys:'Egg Collectors',task:'Check gearbox oil',freq:'monthly',hrs:0.25},
  {id:'ec13',sys:'Egg Collectors',task:'Clean manure scraper cables',freq:'monthly',hrs:0.5},
  // ── FEEDERS ───────────────────────────────────────────────
  {id:'fd1',sys:'Feeders',task:'Check all feeders are working',freq:'daily',hrs:0.25},
  {id:'fd2',sys:'Feeders',task:'Check high flow chain tension',freq:'weekly',hrs:0.25},
  {id:'fd3',sys:'Feeders',task:'Check paddles on high flow chain for excessive wear',freq:'weekly',hrs:0.25},
  {id:'fd4',sys:'Feeders',task:'Check V-belts on feed bins',freq:'monthly',hrs:0.25},
  {id:'fd5',sys:'Feeders',task:'Check all sprockets on feeder chain for wear',freq:'monthly',hrs:0.5},
  {id:'fd6',sys:'Feeders',task:'Check and fill all oil cups — replace any missing cups or guards',freq:'monthly',hrs:0.5},
  {id:'fd7',sys:'Feeders',task:'Repair feeder chain as needed',freq:'monthly',hrs:1.0},
  {id:'fd8',sys:'Feeders',task:'Check feeder corners for wear',freq:'monthly',hrs:0.25},
  {id:'fd9',sys:'Feeders',task:'Check gearbox oil — add if needed',freq:'monthly',hrs:0.25},
  {id:'fd10',sys:'Feeders',task:'Check wear shoes',freq:'monthly',hrs:0.25},
  {id:'fd11',sys:'Feeders',task:'Oil high flow feed system chain',freq:'monthly',hrs:0.5},
  // ── VENTILATION ───────────────────────────────────────────
  {id:'vn1',sys:'Ventilation',task:'Check proper operation of inletting',freq:'daily',hrs:0.25},
  {id:'vn2',sys:'Ventilation',task:'Check manure fans are running',freq:'daily',hrs:0.25},
  {id:'vn3',sys:'Ventilation',task:'Check operation of stir fans',freq:'weekly',hrs:0.25},
  {id:'vn4',sys:'Ventilation',task:'Check inlets are closing and opening evenly',freq:'weekly',hrs:0.25},
  {id:'vn5',sys:'Ventilation',task:'Check operation of updraft fans',freq:'weekly',hrs:0.25},
  {id:'vn6',sys:'Ventilation',task:'Check belt condition on all fans',freq:'monthly',hrs:0.5},
  {id:'vn7',sys:'Ventilation',task:'Check all fans are operating',freq:'monthly',hrs:0.5},
  {id:'vn8',sys:'Ventilation',task:'Check all rods and chains on inlet shutters',freq:'monthly',hrs:0.5},
  {id:'vn9',sys:'Ventilation',task:'Check attic boards',freq:'monthly',hrs:0.25},
  {id:'vn10',sys:'Ventilation',task:'Check equalizer — lube all parts',freq:'monthly',hrs:0.5},
  {id:'vn11',sys:'Ventilation',task:'Oil equalizer chain and rails',freq:'monthly',hrs:0.5},
  {id:'vn12',sys:'Ventilation',task:'Check cables on equalizer',freq:'monthly',hrs:0.25},
  {id:'vn13',sys:'Ventilation',task:'Grease all bearings on pit fans',freq:'monthly',hrs:0.5},
  {id:'vn14',sys:'Ventilation',task:'Check operation of pit fans',freq:'monthly',hrs:0.25},
  {id:'vn15',sys:'Ventilation',task:'Replace belts on pit fans',freq:'annual',hrs:2.0},
  // ── WATER ─────────────────────────────────────────────────
  {id:'wt1',sys:'Water',task:'Check water readings for normal consumption',freq:'daily',hrs:0.25},
  {id:'wt2',sys:'Water',task:'Check for water leaks',freq:'daily',hrs:0.25},
  // Moved off the daily checklist (was bw-cl-watertubes) — now a monthly deep clean.
  // Procedure: shut off water, drain end caps, run tube brush front-to-back, flush
  // until clear, sanitize per label + flush again, restore pressure, verify every
  // nipple drips. PPE: gloves + safety glasses. Reference WI: WI-CL-TUBES.
  {id:'wt3',sys:'Water',task:'Clean water tubes — front & back of house (deep clean, sanitize, verify all nipples drip)',freq:'monthly',hrs:1.0},
  // ── BUILDING ──────────────────────────────────────────────
  {id:'bd1',sys:'Building',task:'Check foundation for any holes — mark for repair',freq:'monthly',hrs:0.5},
  {id:'bd2',sys:'Building',task:'Check structure for any damage — document where repairs are needed',freq:'monthly',hrs:0.5},
  {id:'bd3',sys:'Building',task:'Check for any water leaks and repair',freq:'monthly',hrs:0.5},
  {id:'bd4',sys:'Building',task:'Check walkway boards for any repairs needed',freq:'monthly',hrs:0.25},
  // ── ALARMS ────────────────────────────────────────────────
  {id:'al1',sys:'Alarms',task:'Check all thermostats and alarm functions',freq:'annual',hrs:1.0},
  {id:'al2',sys:'Alarms',task:'Check all sirens are working',freq:'annual',hrs:0.5},

  // ── LUBING ───────────────────────────────────────────────
  {id:'lb1',sys:'Lubing',task:'Check oiler drips for proper operation',freq:'daily',hrs:0.25},
  {id:'lb2',sys:'Lubing',task:'Mark oil reservoirs to make sure oil is being used and traveling through line',freq:'daily',hrs:0.25},
  {id:'lb3',sys:'Lubing',task:'Check tightness of chain at drive roller',freq:'daily',hrs:0.25},
  {id:'lb4',sys:'Lubing',task:'Make sure chain is oiled',freq:'daily',hrs:0.25},
  {id:'lb5',sys:'Lubing',task:'Clean lubing brushes at drive roller',freq:'daily',hrs:0.25},
  {id:'lb6',sys:'Lubing',task:'Check chain for any missing rods and replace',freq:'daily',hrs:0.5},
  {id:'lb7',sys:'Lubing',task:'Check rod counter sprockets for wear and adjustment',freq:'daily',hrs:0.25},
  {id:'lb8',sys:'Lubing',task:'Fill oil reservoirs as needed',freq:'daily',hrs:0.25},

  // ── PROCESSING PLANT (Egg Processing Equipment — Master List #100–#126) ─
  {id:'pk-rodcon',sys:'Processing Plant',pmNum:100,task:'Rod Conveyor — weekly inspection',freq:'weekly',hrs:0.33, farms:['Processing Plant'],
    safety:['Lock out / tag out equipment before inspection','Verify conveyor cannot start automatically'],
    tools:['Grease gun','Wrenches','Flashlight','Cleaning rag'],
    instructions:[
      'Inspect rods for bends, cracks, or excessive wear',
      'Check chain tension and alignment',
      'Inspect sprockets for wear',
      'Check bearings for heat, vibration, or noise',
      'Inspect guards and mounting hardware',
      'Remove egg buildup and debris',
      'Lubricate bearings if required',
      'Run conveyor and verify smooth operation'
    ],
    corrective:['Replace damaged rods','Tighten loose hardware','Report worn sprockets or bearings','Create WO for repairs outside PM scope']
  },
  {id:'pk-slk',sys:'Processing Plant',pmNum:101,task:'SLK — weekly inspection',freq:'weekly',hrs:0.25, farms:['Processing Plant'],
    instructions:[
      'Verify proper machine cycling',
      'Inspect chains and sprockets',
      'Check bearings for vibration or noise',
      'Inspect sensors and switches',
      'Tighten loose hardware',
      'Clean debris and buildup',
      'Verify proper product flow'
    ],
    corrective:['Adjust timing if required','Replace damaged sensors','Create WO for major issues']
  },
  {id:'pk-washer',sys:'Processing Plant',pmNum:102,task:'Washer — test eggs + transfer points + check master links',freq:'monthly',hrs:0.75, farms:['Processing Plant'],
    instructions:[
      'Run test eggs through washer',
      'Inspect transfer points',
      'Clean and inspect brushes',
      'Check all belts for wear and tracking',
      'Inspect master links and chain condition',
      'Verify spray nozzles are clear',
      'Check water flow and temperature',
      'Inspect bearings and motors',
      'Clean debris and buildup',
      'Verify proper egg flow through machine'
    ],
    corrective:['Replace worn brushes','Adjust belts','Replace damaged chains or links','Create WO for motor or bearing issues']
  },
  {id:'pk-blower',sys:'Processing Plant',pmNum:103,task:'Blower — check belts',freq:'weekly',hrs:0.25, farms:['Processing Plant'],
    instructions:[
      'Inspect blower motor',
      'Check fan blades for damage',
      'Inspect belts and alignment',
      'Check bearings for heat or noise',
      'Tighten hardware and guards',
      'Clean dust buildup',
      'Verify proper airflow'
    ],
    corrective:['Replace damaged belts','Report vibration issues','Create WO for motor repairs']
  },
  {id:'pk-candler',sys:'Processing Plant',pmNum:104,task:'Candler — check copper plug-ins',freq:'monthly',hrs:0.33, farms:['Processing Plant'],
    instructions:[
      'Verify candler light operation',
      'Inspect copper plug-ins',
      'Clean lenses and sensors',
      'Verify reject functions',
      'Inspect electrical connections',
      'Tighten loose hardware',
      'Test operation with eggs'
    ],
    corrective:['Replace failed lights','Repair loose connections','Create WO for electrical repairs']
  },
  {id:'pk-dirtdet',sys:'Processing Plant',pmNum:105,task:'Dirt Detector — calibrate',freq:'monthly',hrs:0.33, farms:['Processing Plant'],
    instructions:[
      'Calibrate detector',
      'Verify reject operation',
      'Clean sensors and lenses',
      'Inspect mounts and wiring',
      'Run test eggs through detector',
      'Verify sensitivity settings'
    ],
    corrective:['Recalibrate unit','Replace damaged sensors','Create WO if reject system fails']
  },
  {id:'pk-pusher',sys:'Processing Plant',pmNum:106,task:'Pusher Pin Chain — check tightness',freq:'monthly',hrs:0.42, farms:['Processing Plant'],
    instructions:[
      'Inspect chain tension',
      'Check alignment',
      'Inspect pusher pins for damage',
      'Inspect sprockets and bearings',
      'Lubricate chain',
      'Tighten loose hardware',
      'Verify smooth movement'
    ],
    corrective:['Replace damaged pins','Adjust chain tension','Create WO for excessive wear']
  },
  {id:'pk-transfer',sys:'Processing Plant',pmNum:107,task:'Transfer — time transfer',freq:'monthly',hrs:0.33, farms:['Processing Plant'],
    instructions:[
      'Check transfer timing',
      'Inspect rollers and belts',
      'Verify alignment',
      'Tighten hardware',
      'Inspect bearings',
      'Remove debris buildup',
      'Verify smooth egg flow'
    ],
    corrective:['Adjust alignment','Replace damaged rollers','Create WO for major repairs']
  },
  {id:'pk-scales',sys:'Processing Plant',pmNum:108,task:'Scales — auto calibrate',freq:'monthly',hrs:0.5, farms:['Processing Plant'],
    instructions:[
      'Auto calibrate scales',
      'Verify accuracy with test weights',
      'Inspect load cells',
      'Inspect wiring and mounts',
      'Clean debris from scale area',
      'Verify communication with system'
    ],
    corrective:['Recalibrate scales','Replace damaged load cells','Create WO for electrical issues']
  },
  {id:'pk-basket',sys:'Processing Plant',pmNum:109,task:'Basket Conveyor — check basket gap 1/2"',freq:'monthly',hrs:0.33, farms:['Processing Plant'],
    instructions:[
      'Inspect conveyor alignment',
      'Inspect baskets for wear',
      'Check chain and sprockets',
      'Inspect bearings',
      'Lubricate moving parts',
      'Verify smooth operation'
    ],
    corrective:['Replace damaged baskets','Tighten loose hardware','Create WO for major repairs']
  },
  {id:'pk-blood',sys:'Processing Plant',pmNum:110,task:'Blood Detector — test blood detector',freq:'monthly',hrs:0.33, farms:['Processing Plant'],
    instructions:[
      'Test blood detector operation',
      'Verify reject system works',
      'Clean sensors and lenses',
      'Inspect wiring and mounts',
      'Verify calibration settings'
    ],
    corrective:['Recalibrate detector','Replace failed sensors','Create WO for electrical repairs']
  },
  {id:'pk-packers',sys:'Processing Plant',pmNum:111,task:'Packers — run 100 test eggs through all packers',freq:'monthly',hrs:1.0, farms:['Processing Plant'],
    instructions:[
      'Run 100 test eggs through all packers',
      'Verify proper packing operation',
      'Inspect chains, belts, and sprockets',
      'Inspect rubber components',
      'Tighten loose hardware',
      'Inspect bearings and rollers',
      'Clean buildup and debris',
      'Verify reject and transfer functions'
    ],
    corrective:['Replace worn rubber','Adjust timing','Create WO for major mechanical issues']
  },
  {id:'pk-cagebelt',sys:'Processing Plant',pmNum:121,task:'Cage Belt — check rubber, chain and sprockets',freq:'weekly',hrs:0.33, farms:['Processing Plant'],
    instructions:[
      'Inspect belt condition',
      'Verify belt tracking',
      'Inspect rollers and bearings',
      'Check chain and sprockets',
      'Remove buildup and debris',
      'Verify smooth operation'
    ],
    corrective:['Adjust tracking','Replace damaged rollers','Create WO for torn belts']
  },
  {id:'pk-loader',sys:'Processing Plant',pmNum:122,task:'Loader — weekly inspection',freq:'weekly',hrs:0.33, farms:['Processing Plant'],
    instructions:[
      'Inspect loader timing',
      'Check chains and sprockets',
      'Inspect bearings',
      'Verify smooth product flow',
      'Tighten hardware',
      'Lubricate moving parts'
    ],
    corrective:['Adjust timing','Replace damaged chains','Create WO for major repairs']
  },
  {id:'pk-lights',sys:'Processing Plant',pmNum:123,task:'Plant Lights — replace bad bulbs or ballasts',freq:'weekly',hrs:0.25, farms:['Processing Plant'],
    instructions:[
      'Inspect all plant lighting',
      'Replace bad bulbs',
      'Replace failed ballasts',
      'Inspect fixtures and wiring',
      'Clean dust buildup'
    ],
    corrective:['Replace failed fixtures','Create WO for electrical issues']
  },
  {id:'pk-aircomp',sys:'Processing Plant',pmNum:124,task:'Air Compressor — change oil',freq:'monthly',hrs:0.5, farms:['Processing Plant'],
    instructions:[
      'Change oil',
      'Drain moisture from tank',
      'Inspect hoses and fittings',
      'Check for air leaks',
      'Inspect belts and alignment',
      'Verify pressure settings',
      'Clean cooling fins'
    ],
    corrective:['Replace leaking hoses','Tighten fittings','Create WO for compressor issues']
  },
  {id:'pk-boiler',sys:'Processing Plant',pmNum:125,task:'Boiler — visually inspect',freq:'weekly',hrs:0.33, farms:['Processing Plant'],
    instructions:[
      'Visually inspect boiler',
      'Check for leaks',
      'Verify pressure and temperature',
      'Inspect valves and safety devices',
      'Listen for unusual noises',
      'Clean surrounding area'
    ],
    corrective:['Report pressure issues immediately','Create WO for leaks or unsafe conditions']
  },
  {id:'pk-bldg',sys:'Processing Plant',pmNum:126,task:'Building Maintenance — check fire extinguishers + walk',freq:'weekly',hrs:0.5, farms:['Processing Plant'],
    instructions:[
      'Check fire extinguishers — inspect tags, gauge in green, no damage, mounted correctly',
      'Inspect walls, floors, and ceilings',
      'Inspect doors and docks',
      'Check handrails and guards',
      'Verify safety signage',
      'Inspect housekeeping and 5S conditions',
      'Identify structural or utility repairs needed'
    ],
    corrective:['Replace any failed or out-of-date extinguishers immediately','Create WO for repairs','Correct housekeeping issues immediately']
  },
];

// ═══════════════════════════════════════════
// PARTS MASTER LIST
// ═══════════════════════════════════════════
const PARTS_DEFS = [
  // LUBING / EGG CHAIN (T750)
  {id:'p-lb01',sys:'Lubing',name:'Intermediate Power Transmission Repair Kit T750',itemNo:'14HB10000A',unitPrice:1530.00},
  {id:'p-lb02',sys:'Lubing',name:'Intermediate Consumables Repair Kit T750',itemNo:'14HA00000A',unitPrice:389.00},
  {id:'p-lb03',sys:'Lubing',name:'Conveyor Chain T750 Standard',itemNo:'4891',unitPrice:1100.00},
  {id:'p-lb04',sys:'Lubing',name:'Closing Rod T750 Standard',itemNo:'4894',unitPrice:20.00},
  {id:'p-lb05',sys:'Lubing',name:'Security Element',itemNo:'1855400402',unitPrice:0.38},
  {id:'p-lb06',sys:'Lubing',name:'Discharge Wheel Complete T750',itemNo:'1885001102',unitPrice:112.00},
  {id:'p-lb07',sys:'Lubing',name:'Cleaning Brush Complete T750',itemNo:'1885000500',unitPrice:128.00},
  {id:'p-lb08',sys:'Lubing',name:'Diverter Assembly T750 x60-I',itemNo:'18DA10000A',unitPrice:135.00},
  {id:'p-lb09',sys:'Lubing',name:'Top/Tandem Drip Oiler T750 240V Gen2',itemNo:'F103B',unitPrice:864.00},
  {id:'p-lb10',sys:'Lubing',name:'Lubricant Food Grade 5 Gallon',itemNo:'LBG78-035',unitPrice:229.00},
  {id:'p-lb11',sys:'Lubing',name:'Motor 1/3HP 1PH 115/208-230 60Hz (Marathon)',itemNo:'G513',unitPrice:460.00},
  {id:'p-lb12',sys:'Lubing',name:'Gearbox Stober 87.3:1',itemNo:'S-87.3',unitPrice:1358.00},
  {id:'p-lb13',sys:'Lubing',name:'Deflection Wheel Smooth 94.7MM',itemNo:'1855152200',unitPrice:33.00},
  {id:'p-lb14',sys:'Lubing',name:'Deflection Wheel Grooved 94.7MM',itemNo:'1855152100',unitPrice:50.00},
  {id:'p-lb15',sys:'Lubing',name:'Drive Shaft T750',itemNo:'1885160101',unitPrice:176.00},
  {id:'p-lb16',sys:'Lubing',name:'Main Drive Sprocket',itemNo:'7050010200',unitPrice:248.00},
  {id:'p-lb17',sys:'Lubing',name:'20MM Axle T750',itemNo:'1885150402',unitPrice:83.00},
  {id:'p-lb18',sys:'Lubing',name:'Curved Sliding Shoe',itemNo:'1855200700',unitPrice:8.50},
  {id:'p-lb19',sys:'Lubing',name:'Screw Spindle Main Drive',itemNo:'1855002200',unitPrice:18.00},
  {id:'p-lb20',sys:'Lubing',name:'Pressure Spring',itemNo:'3202639',unitPrice:6.80},
  {id:'p-lb21',sys:'Lubing',name:'Pressure Piece',itemNo:'1855150700',unitPrice:18.00},
  {id:'p-lb22',sys:'Lubing',name:'Curve Conveyor Accessory Pack',itemNo:'AP100',unitPrice:14.00},
  {id:'p-lb23',sys:'Lubing',name:'Guide Unit T750',itemNo:'4888',unitPrice:165.00},
  {id:'p-lb24',sys:'Lubing',name:'8x7x28 Parallel Key',itemNo:'2743070',unitPrice:1.50},
  // MANURE BELT
  {id:'p-mn01',sys:'Manure',name:'24" Smooth Belt (per foot)',itemNo:'NOVA-BELT24',unitPrice:0},
  {id:'p-mn02',sys:'Manure',name:'24" Stainless Steel Belt Lacing Set',itemNo:'NOVA-LACE24',unitPrice:0},
  {id:'p-mn03',sys:'Manure',name:'24" Scraper',itemNo:'NOVA-SCRAP24',unitPrice:0},
  {id:'p-mn04',sys:'Manure',name:'5/32" Stainless Cable (per foot)',itemNo:'NOVA-CABLE',unitPrice:0},
  {id:'p-mn05',sys:'Manure',name:'Electric Motor 5HP 1PH 230V 184TC Frame',itemNo:'NOVA-MOT5HP',unitPrice:0},
  {id:'p-mn06',sys:'Manure',name:'Electric Motor 3HP 1PH 230V 182TC Frame',itemNo:'NOVA-MOT3HP',unitPrice:0},
  {id:'p-mn07',sys:'Manure',name:'24" Lo-Profile Independent Feeder Kit',itemNo:'NOVA-FEED24',unitPrice:0},
  // WATER
  {id:'p-wt01',sys:'Water',name:'Water Floor SDL Nipple Assembly CT',itemNo:'12070267',unitPrice:3.50},
  {id:'p-wt02',sys:'Water',name:'Regulator Big Ace 24" Riser',itemNo:'12010169',unitPrice:130.78},
  {id:'p-gn01',sys:'General',name:'V-Belt (various)',itemNo:'V-BELT',unitPrice:0},
  {id:'p-gn02',sys:'General',name:'Bearing (various)',itemNo:'BEARING',unitPrice:0},
  {id:'p-gn03',sys:'General',name:'Fuse Assortment',itemNo:'FUSE-ASST',unitPrice:0},
  {id:'p-gn04',sys:'General',name:'Zip Ties (bag)',itemNo:'ZIPTIE',unitPrice:0},
  {id:'p-gn05',sys:'General',name:'WD-40 (can)',itemNo:'WD40',unitPrice:0},
];

let partsInventory = {}; // loaded from Firebase: {partId: {qty, min}}
let partsFilter_ = 'all';
let editingPartId = null;
let editingPartQty = 0;

// ═══════════════════════════════════════════
// FACILITIES — single source of truth
// ═══════════════════════════════════════════
// Each facility has a whitelist of PM systems that apply to it.
// Layer farms (Hegins, Danville) run the egg-laying operation:
// ventilation, water, feed, manure, egg-collectors, building, alarms,
// lubing. The Processing Plant runs ONLY the Packaging line — no
// manure handling, no feed delivery, no egg-laying systems.
//
// Adding a new facility? Add a row here and update FACILITIES list.
const FACILITIES = ['Hegins','Danville','Processing Plant'];

const FACILITY_SYSTEMS = {
  'Hegins':           ['Ventilation','Water','Feed','Feed System','Feeders','Manure','Egg Collectors','Building','Alarms','Lubing'],
  'Danville':         ['Ventilation','Water','Feed','Feed System','Feeders','Manure','Egg Collectors','Building','Alarms','Lubing'],
  'Processing Plant': ['Processing Plant', 'Packaging'],
};

const ALL_PM = [];
for (const farm of FACILITIES) {
  const allowed = FACILITY_SYSTEMS[farm] || [];
  for (const def of PM_DEFS) {
    // Two-stage filter:
    //   1. Explicit `farms:` array on a PM_DEF wins — only those farms see it.
    //   2. Otherwise the def's system must be on this facility's allowlist.
    // This is what keeps the Processing Plant from inheriting farm-only
    // tasks like manure-belt runs, and keeps layer farms from being told
    // to inspect packaging conveyors.
    if (def.farms && !def.farms.includes(farm)) continue;
    if (!allowed.includes(def.sys)) continue;
    ALL_PM.push({
      id:`${farm}-${def.id}`, defId:def.id, farm,
      sys:def.sys, task:def.task, freq:def.freq, hrs:def.hrs,
      pmNum:def.pmNum||null,
      // Procedural details (optional — used by PM modal if present)
      safety:def.safety||null, tools:def.tools||null,
      instructions:def.instructions||null, corrective:def.corrective||null
    });
  }
}

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
let workOrders = [];
let pmComps    = {};
// Per-PM procedure overrides edited via the app. Stored in Firestore
// `pmProcedures/{defId}` — each doc may have {safety, tools, instructions, corrective}.
// Falls back to PM_DEFS defaults baked into core.js if no override exists.
let pmProcedures = {};
let actLog     = [];
let selPri     = 'normal';
let woLocFilter = 'all';
let woPriorityFilters = new Set();
let woStatusFilters = new Set();
let pmLocFilter = 'all', pmStatFilter = 'all';
let logFilterVal = 'all';
let logFarmFilter = 'all';
let logHouseFilter = 'all';
let modalPMId   = null;
let woCounter   = 1;
let flocks        = [];   // flock placement records
let opsEggByBarn  = [];   // per-barn egg collection + packing log

const TODAY = new Date(); TODAY.setHours(0,0,0,0);
// `todayStr` is read from many modules. PWAs can run for >24h on phones,
// so we refresh once a minute to keep midnight rollovers accurate.
let todayStr = new Date().toISOString().slice(0,10);
setInterval(() => {
  const t = new Date().toISOString().slice(0,10);
  if (t !== todayStr) {
    todayStr = t;
    // Force a re-render so date-scoped views (egg log, walks, etc) refresh.
    if (typeof refreshCurrentPanel === 'function') refreshCurrentPanel();
  }
}, 60000);

function setSyncDot(state) {
  const d = document.getElementById('sync-dot');
  d.className = 'sync-dot ' + state;
}

function setMsg(m) { document.getElementById('loading-msg').textContent = m; }

// ── Global toast utility ───────────────────────────────────────────────────
// ── App version (bump on every deploy — shown on the landing screen) ─────
var APP_VERSION = 'v152 · Jun 26 2026';

// ── Screen brightness (Dark / Mid / Bright) ──────────────────────────────────
// Applies app-wide via a single root filter, remembered per device. The early
// inline script in index.html applies the saved level before paint (no flash);
// this updates it live when the toggle is tapped and highlights the active button.
function setScreenMode(mode) {
  if (mode === 'mid') mode = 'lightgreen';   // migrate old brightness names → real themes
  if (mode === 'bright') mode = 'white';
  mode = (mode === 'lightgreen' || mode === 'white') ? mode : 'dark';
  try { document.documentElement.setAttribute('data-theme', mode); } catch (e) {}
  try { document.documentElement.style.filter = 'none'; } catch (e) {}   // clear any old brightness filter
  try { localStorage.setItem('screenMode', mode); } catch (e) {}
  ['dark','lightgreen','white'].forEach(function (m) {
    var b = document.getElementById('mode-btn-' + m);
    if (!b) return;
    var on = (m === mode);
    b.style.background = on ? '#2e7d32' : 'transparent';
    b.style.color      = on ? '#ffffff' : '#7ab07a';
  });
}
if (typeof window !== 'undefined') window.setScreenMode = setScreenMode;
try { setScreenMode(localStorage.getItem('screenMode') || 'dark'); } catch (e) {}

// ── Device user (per device) ─────────────────────────────────────────────
// Remembers the last name typed into any staff-name field on this device
// and offers it automatically — tap a name field and it fills itself.
function getDeviceUser() {
  try { return localStorage.getItem('deviceUser') || ''; } catch(e) { return ''; }
}
document.addEventListener('change', function(e) {
  const el = e.target;
  if (el && el.tagName === 'INPUT' && el.getAttribute('list') === 'staff-datalist' && el.value.trim()) {
    try { localStorage.setItem('deviceUser', el.value.trim()); } catch(err) {}
  }
});
document.addEventListener('focusin', function(e) {
  const el = e.target;
  if (el && el.tagName === 'INPUT' && el.getAttribute('list') === 'staff-datalist' && !el.value) {
    const u = getDeviceUser();
    if (u) {
      el.value = u;
      try { el.dispatchEvent(new Event('input',  { bubbles: true })); } catch(err) {}
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch(err) {}
    }
  }
});

// ── Location context: one app, three views ──────────────────────────────
// Hegins / Danville scope the whole hub to that plant. Master shows
// everything aggregated. Persisted per device; defaults to Hegins on first
// run ("just start with Hegins"), then remembers the last choice.
const LOCATIONS = ['Hegins', 'Danville', 'Processing Plant', 'Master'];

function getActiveLocation() {
  try {
    const v = localStorage.getItem('activeLocation');
    if (LOCATIONS.includes(v)) return v;
  } catch(e) {}
  return 'Hegins';
}

// The plant used for filtering. Master → null, which every farm filter in
// the app already treats as "all locations".
function getPreferredFarm() {
  const loc = getActiveLocation();
  return (loc === 'Hegins' || loc === 'Danville' || loc === 'Processing Plant') ? loc : null;
}

function setActiveLocation(loc) {
  if (!LOCATIONS.includes(loc)) return;
  try {
    localStorage.setItem('activeLocation', loc);
    if (loc === 'Master') localStorage.removeItem('preferredFarm');
    else localStorage.setItem('preferredFarm', loc);
  } catch(e) {}
  renderLocationSwitch();
  if (typeof updateStaffDropdowns === 'function') updateStaffDropdowns();
  rerenderActiveView();
}

// Back-compat: older flows (egg counts, morning walk, daily report) call
// setPreferredFarm('Hegins'|'Danville'). Route them through the new model.
function setPreferredFarm(f) {
  if (f !== 'Hegins' && f !== 'Danville') return;
  setActiveLocation(f);
}

// Paint the active state on every location control (landing pills + header).
function renderLocationSwitch() {
  const loc = getActiveLocation();
  document.querySelectorAll('.loc-pill').forEach(btn => {
    const on = btn.dataset.loc === loc;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('.loc-current-label').forEach(el => {
    el.textContent = (loc === 'Master') ? 'All Locations' : loc;
  });
  renderLocationContext();
}

// Paint the per-location home header (the site name you're inside) so the
// screen always says which location it's tracking. Hegins/Danville → that
// site only; Master → everything combined.
function renderLocationContext() {
  const loc = getActiveLocation();
  const title = document.getElementById('loc-home-title');
  const sub   = document.getElementById('loc-home-sub');
  if (title) title.textContent = (loc === 'Master') ? 'ALL LOCATIONS' : String(loc).toUpperCase();
  if (sub) {
    if (loc === 'Master') { sub.textContent = 'Hegins + Danville combined'; sub.style.color = '#7ab0f6'; }
    else { sub.textContent = 'This location only'; sub.style.color = '#4ade80'; }
  }
}

// ── Two-screen flow: location picker → per-site home ─────────────────────
// Tapping a location on the landing screen opens a home screen titled with
// that site's name; everything below it is already scoped via getPreferredFarm.
function openLocationHome(loc) {
  if (typeof setActiveLocation === 'function') setActiveLocation(loc);
  const picker = document.getElementById('loc-picker');
  const home   = document.getElementById('loc-home');
  if (picker) picker.style.display = 'none';
  if (home)   home.style.display   = '';
  renderLocationContext();
  if (typeof renderLandingStatus === 'function') renderLandingStatus();
  if (typeof updateHomeFeedStatus === 'function') updateHomeFeedStatus();
  if (typeof renderTodayPanel === 'function') renderTodayPanel();
  try { window.scrollTo(0, 0); } catch(e) {}
}

// Back to the location chooser.
function showLocationPicker() {
  const picker = document.getElementById('loc-picker');
  const home   = document.getElementById('loc-home');
  if (home)   home.style.display   = 'none';
  if (picker) picker.style.display = '';
  try { window.scrollTo(0, 0); } catch(e) {}
}
if (typeof window !== 'undefined') { window.openLocationHome = openLocationHome; window.showLocationPicker = showLocationPicker; }

// Re-render whatever view is showing so a location change takes effect now.
function rerenderActiveView() {
  try {
    const landing = document.getElementById('landing-screen');
    if (landing && landing.style.display !== 'none') {
      if (typeof renderLandingStatus === 'function') renderLandingStatus();
      return;
    }
    if (typeof go === 'function' && window._activeTab) go(window._activeTab);
  } catch(e) { console.warn('rerenderActiveView failed:', e); }
}

// On boot: keep the legacy preferredFarm key in sync with the default so
// code paths that read it directly behave, then paint the switch.
document.addEventListener('DOMContentLoaded', () => {
  try {
    const loc = getActiveLocation();
    if (loc !== 'Master' && !localStorage.getItem('preferredFarm')) {
      localStorage.setItem('preferredFarm', loc);
    }
  } catch(e) {}
  if (typeof renderLocationSwitch === 'function') renderLocationSwitch();
});

// Several modules (maintenance.js, production.js, daily-checklist.js, etc.)
// call `if (typeof toast === 'function') toast(msg)` to surface a quick error
// or status message. Previously no global `toast` existed so those messages
// silently disappeared. This implementation is intentionally tiny: shows a
// pill at the bottom of the screen, auto-dismisses, tap to dismiss early.
function toast(msg, opts) {
  const cfg = opts || {};
  const ok  = cfg.ok === true;
  const ms  = typeof cfg.ms === 'number' ? cfg.ms : 3200;
  const el  = document.createElement('div');
  el.textContent = String(msg == null ? '' : msg);
  el.style.cssText = [
    'position:fixed','left:50%','bottom:80px','transform:translateX(-50%) translateY(20px)',
    'background:' + (ok ? '#0a2a0a' : '#1f0a0a'),
    'color:' + (ok ? '#a8d5b5' : '#ffd5d0'),
    'border:1px solid ' + (ok ? '#4a9b6f' : '#a94038'),
    'padding:11px 18px','border-radius:10px','font-size:13px',
    'font-family:"IBM Plex Sans",sans-serif','line-height:1.35',
    'max-width:min(90vw,440px)','text-align:center',
    'box-shadow:0 8px 24px rgba(0,0,0,0.45)','z-index:20000',
    'opacity:0','transition:opacity .18s ease, transform .18s ease',
    'cursor:pointer','touch-action:manipulation'
  ].join(';');
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => el.remove(), 220);
  }, ms);
}
// Make sure it's reachable from every module / inline handler.
if (typeof window !== 'undefined') window.toast = toast;

// ═══════════════════════════════════════════════════════════════════════════
// OFFLINE WORK ORDER QUEUE
// ───────────────────────────────────────────────────────────────────────────
// Lets staff fill out and "submit" a work order with no signal. The order is
// saved on the device (localStorage, so it survives closing the app), shown in
// the Work Orders list with a "Pending sync" badge, and automatically sent to
// Firestore the moment the phone is back online.
//
// Why a hand-rolled queue instead of relying only on Firestore's own offline
// writes: the WO-### number is minted with a Firestore transaction, and
// transactions cannot run offline. So offline orders are parked here without a
// number, and the real WO-### is assigned during the flush once we're online.
// ═══════════════════════════════════════════════════════════════════════════
const OFFLINE_WO_KEY = 'rtp_offline_wo_v1';
let _flushingWOQueue = false;

function getOfflineWOQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_WO_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveOfflineWOQueue(arr) {
  try { localStorage.setItem(OFFLINE_WO_KEY, JSON.stringify(arr || [])); }
  catch (e) { console.warn('offline WO queue save failed:', e); }
  updateOfflineBanner();
}

// Park a work order on the device. `data` is the plain WO form payload.
function queueOfflineWO(data) {
  const q = getOfflineWOQueue();
  const localId = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const item = { ...data, _localId: localId, _queuedAt: Date.now() };
  q.push(item);
  saveOfflineWOQueue(q);
  injectPendingWOs();
  if (typeof refreshCurrentPanel === 'function') refreshCurrentPanel();
  return item;
}

// Prepend not-yet-synced orders into the in-memory workOrders list so they
// show up in the Work Orders view immediately. Skips any whose _localId is
// already present (i.e. already synced and rebuilt from the Firestore snapshot).
function injectPendingWOs() {
  const q = getOfflineWOQueue();
  if (!q.length) return;
  const have = new Set(workOrders.map(w => w && w._localId).filter(Boolean));
  // Oldest first so the newest queued WO ends up on top after unshift.
  q.slice().reverse().forEach(item => {
    if (have.has(item._localId)) return;
    workOrders.unshift({
      ...item,
      id: 'WO-PENDING',
      _fbId: item._localId,   // placeholder id so card buttons don't blow up
      _pending: true,
      status: item.status || 'open',
      ts: item._queuedAt
    });
  });
}

// Send every parked order to Firestore. Safe to call repeatedly; a lock keeps
// two callers (e.g. the 'online' event and the startup pass) from double-sending.
async function flushOfflineWOs() {
  if (_flushingWOQueue) return;
  if (!navigator.onLine) return;
  if (!getOfflineWOQueue().length) return;

  _flushingWOQueue = true;
  setSyncDot('saving');
  const startCount = getOfflineWOQueue().length;
  try {
    for (const item of getOfflineWOQueue().slice()) {
      try {
        const woId = await mintWoId();          // transaction — needs network
        const wo = {
          id: woId,
          date: item.date,
          tech: item.tech, farm: item.farm, house: item.house,
          problem: item.problem, desc: item.desc,
          priority: item.priority,
          assignedTo: item.assignedTo || '',
          estHours: (item.estHours != null) ? item.estHours : null,
          parts: item.parts || '',
          down: item.down || 'no',
          status: 'open',
          notes: item.notes || '',
          photos: item.photos || [],
          submitted: item.submitted,
          ts: item._queuedAt || Date.now(),
          _localId: item._localId,   // dedupe key carried into Firestore
          queuedOffline: true
        };
        await db.collection('workOrders').add(wo);
        try {
          await db.collection('activityLog').add({
            type: 'wo', id: wo.id,
            desc: `WO submitted (offline sync): ${wo.farm} · ${wo.house} — ${wo.problem}`,
            tech: wo.tech, date: wo.submitted, ts: Date.now()
          });
        } catch (logErr) { console.warn('activityLog (offline sync) failed:', logErr); }

        // Drop just this item from the queue now that it's committed.
        saveOfflineWOQueue(getOfflineWOQueue().filter(x => x._localId !== item._localId));
      } catch (itemErr) {
        // Likely lost signal again mid-flush — stop and retry on next 'online'.
        console.warn('offline WO flush stopped, will retry:', itemErr);
        break;
      }
    }
  } finally {
    _flushingWOQueue = false;
    const left = getOfflineWOQueue().length;
    setSyncDot(navigator.onLine ? 'live' : 'offline');
    updateOfflineBanner();
    if (typeof refreshCurrentPanel === 'function') refreshCurrentPanel();
    const sent = startCount - left;
    if (sent > 0 && typeof toast === 'function') {
      toast(`✓ ${sent} offline work order${sent > 1 ? 's' : ''} synced`, { ok: true });
    }
  }
}

// Bottom-of-screen status bar: shown while offline and/or while orders wait.
function updateOfflineBanner() {
  if (typeof document === 'undefined') return;
  const n = getOfflineWOQueue().length;
  const offline = !navigator.onLine;
  let bar = document.getElementById('offline-banner');

  if (!n && !offline) { if (bar) bar.remove(); return; }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'offline-banner';
    bar.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:15000',
      'padding:9px 14px', 'text-align:center',
      'font-family:"IBM Plex Sans",sans-serif', 'font-size:13px', 'font-weight:600',
      'color:#1a1a1a', 'box-shadow:0 -2px 10px rgba(0,0,0,0.3)'
    ].join(';');
    document.body.appendChild(bar);
  }

  if (offline && n) {
    bar.textContent = `📴 Offline — ${n} work order${n > 1 ? 's' : ''} saved on this device, will send when you're back online`;
    bar.style.background = '#f6c453';
  } else if (offline) {
    bar.textContent = '📴 Offline — your changes will sync when you reconnect';
    bar.style.background = '#f6c453';
  } else {
    bar.textContent = `🔄 Back online — syncing ${n} work order${n > 1 ? 's' : ''}…`;
    bar.style.background = '#7ed957';
  }
}

// React to the browser going on/offline.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setSyncDot('live');
    updateOfflineBanner();
    flushOfflineWOs();
  });
  window.addEventListener('offline', () => {
    setSyncDot('offline');
    updateOfflineBanner();
  });
}

// ═══════════════════════════════════════════
// FIREBASE LOAD
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE / TRANSLATION SYSTEM  — 🌐 English ↔ Español
// ═══════════════════════════════════════════════════════════════════════════
const TRANSLATIONS = {
  en: {
    // Nav
    'nav.home':'🏠 Home','nav.dash':'📊 Dashboard','nav.prod':'🏭 Production',
    'nav.maint':'🔧 Maintenance','nav.pkg':'🏭 Processing','nav.feed':'🌾 Feed Mill',
    'nav.ship':'🚚 Shipping','nav.kpi':'🥚 KPI','nav.reports':'📊 Reports','nav.sched':'📅 Schedule',
    // Section titles
    'title.dash':'📊 Operations Dashboard','title.prod':'🏭 Production',
    'title.maint':'🔧 Maintenance','title.pkg':'🏭 Processing',
    'title.feed':'🌾 Feed Mill','title.ship':'🚚 Shipping',
    'title.kpi':'🥚 Egg Production KPI','title.reports':'Reports','title.sched':'📅 Team Schedule',
    // Maintenance sub-buttons
    'sub.wo':'🔧 Work Orders','sub.pm':'📋 PM Schedule','sub.parts':'🔩 Parts',
    'sub.downtime':'⏱️ Downtime','sub.assets':'🏭 Assets',
    'sub.wi':'📖 Work Instructions','sub.log':'📁 Log',
    // Packaging sub-buttons
    'sub.packing':'📦 Packing','sub.eggs':'🥚 Eggs by Barn','sub.quality':'🏅 Egg Quality',
    // KPI sub-buttons
    'sub.kpi.dashboard':'📊 Dashboard','sub.kpi.trends':'📈 Trends',
    'sub.kpi.log':'📋 Log','sub.kpi.entry':'➕ Log Eggs',
    // Production panel buttons
    'prod.daily_check':'Daily Employee Check',
    'prod.daily_check_sub':'Log barn walk, equipment & conditions',
    'prod.morning_walk':'Morning Walk',
    'prod.morning_walk_sub':'Lead / WNO — water, temp, feed, fans, blowers',
    'prod.summary':"Today's Summary",
    'prod.summary_sub':'All barn checks, mortality, flags & morning walks',
    'prod.flock':'Flock Ages',
    'prod.flock_sub':'Track placement dates, age in weeks & depop timeline',
    'prod.biosec':'Biosecurity Log',
    'prod.biosec_sub':'Visitor & entry log, sanitation records, risk tracking',
    // Dashboard
    'btn.new_wo':'🔧 New Work Order',
    'dash.exec_brief':'📋 Executive Brief','dash.all_clear':'All Clear',
    'dash.no_issues':'No critical issues at this time',
    'dash.prod_card':'🏭 Production','dash.maint_card':'🔧 Maintenance',
    'dash.pkg_card':'📦 Packaging','dash.ship_card':'🚚 Shipping',
    'dash.checks_done':'Checks Done','dash.mortality':'Mortality Today',
    'dash.urgent_wo':'Urgent WOs','dash.pm_overdue':'PM Overdue',
    'dash.pm_compliance':'PM Compliance',
    'dash.eggs_logged':'Eggs Logged','dash.cases_packed':'Cases Packed',
    'dash.active_loads':'Active Loads','dash.exceptions':'Exceptions',
    // Status
    'status.open':'Open','status.in_progress':'In Progress',
    'status.completed':'Completed','status.on_hold':'On Hold',
    // Priority
    'priority.urgent':'Urgent','priority.high':'High',
    'priority.normal':'Normal','priority.low':'Low',
    // Common
    'lbl.date':'Date','lbl.farm':'Farm','lbl.house':'House','lbl.notes':'Notes',
    'lbl.by':'Entered By','lbl.status':'Status','lbl.priority':'Priority',
    'lbl.name':'Name','lbl.company':'Company','lbl.purpose':'Purpose',
    'btn.save':'Save','btn.cancel':'Cancel','btn.clear':'Clear','btn.today':'Today',
    // Reports
    'reports.sub':'Summary of activity — updated in real time',
    // Executive brief issue labels
    'brief.equip_down':'Equipment Down','brief.urgent_wo':'Urgent WO',
    'brief.pm_overdue':'PM Tasks Overdue','brief.barns_flagged':'Barn Flagged',
    'brief.defect_rate':'Defect Rate','brief.mortality':'Mortality',
    'brief.low_stock':'Parts Low Stock','brief.tap_maint':'Tap Maintenance → PM Schedule',
    'brief.tap_parts':'Tap Maintenance → Parts',
    'brief.check_walk':'Check barn walk logs',
    'brief.quality_note':'quality records today',
    'brief.all_clear':'All Clear','brief.no_issues':'No critical issues at this time',
    'brief.critical':'critical','brief.warnings':'warnings',
    'brief.worse':'↑ worse','brief.better':'↓ better','brief.flat':'→ flat',
    'brief.vs_yest':'vs yest',
    // Work Orders dynamic strings
    'wo.stat.urgent':'🔴 Urgent','wo.stat.high':'🟡 High','wo.stat.open':'Open',
    'wo.stat.inprog':'In Progress','wo.stat.total':'Total WOs',
    'wo.empty':'No work orders match this filter.',
    'wo.age.new':'NEW TODAY','wo.age.1d':'1 DAY OLD',
    'wo.age.days':'DAYS OLD','wo.age.warn':'DAYS OLD ⚠️','wo.age.over':'DAYS — OVERDUE 🔴',
    'wo.pri.routine':'🟢 Routine',
    'wo.down':'⚠️ DOWN','wo.degraded':'⚡ Degraded',
    'wo.btn.start':'▶ Start','wo.btn.hold':'⏸ Hold',
    'wo.btn.complete':'✓ Complete','wo.btn.resume':'↩ Resume','wo.btn.reopen':'↩ Re-Open',
    'wo.unassigned':'Unassigned','wo.completedby':'✓ Completed by',
    'wo.photo.prev':'← Prev','wo.photo.next':'Next →','wo.photo.close':'✕ Close',
    'wo.hint':'Tap any card to update status — confirmation required',
    // Production KPI bar
    'prod.kpi.checks':'Checks Done','prod.kpi.eggs':'Eggs Today','prod.kpi.flagged':'Flagged',
    'prod.barn':'Barn',
    'prod.select_farm':'Select your farm to begin',
    'prod.barns_checked':'barns checked today',
    'prod.barns_walked':'barns walked today',
    'prod.select_walk':'Select farm to walk',
    'prod.no_eggs_yet':'No egg counts submitted yet today.',
    'prod.egg_kpi_title':'🥚 Egg KPI — 90% Target',
    // Shipping / Farm directory
    'ship.select_farm':'— Select Farm —',
    'ship.no_farms':'No farms match your search.',
    'ship.farms':'FARMS','ship.independent':'INDEPENDENT',
    'ship.owned_by':'Owned by',
    'ship.address':'Address','ship.contacts':'Contacts',
    'ship.ids_codes':'IDs & Codes',
    'ship.state_id':'State ID','ship.federal_id':'Federal ID',
    'ship.npip':'NPIP #','ship.door_code':'Door Code',
    'ship.create_load':'🚛 CREATE LOAD FOR THIS FARM',
    'ship.open_maps':'Open in Maps →',
    // Biosecurity
    'bio.required':'Date, Farm, Entry Type, and Person Name are required.',
    'bio.saving':'Saving...','bio.saved':'✓ Entry logged!',
    'bio.save_failed':'Save failed: ',
    'bio.entries_today':'Entries Today',
    'bio.high_risk':'🔴 High Risk','bio.medium_risk':'Medium Risk',
    // Common UI
    'btn.close':'✕ Close','btn.back_farms':'← Farms',
    'common.saving':'Saving...','common.save_failed':'Save failed: ',
    // Landing screen cards
    'landing.prod':'Production','landing.prod_sub':'Barn walk · Daily checks · Feed & water',
    'landing.maint':'Maintenance','landing.maint_sub':'Work orders · PM · Parts · Assets',
    'landing.pkg':'Packaging','landing.pkg_sub':'Egg ops · Packing log',
    'landing.ship':'Shipping','landing.ship_sub':'Loads · Reconciliation · Exceptions',
    'landing.feed':'Feed Mill','landing.feed_default':'Bin levels · Deliveries · Readings',
    'landing.dash':'Dashboard','landing.dash_sub':'Directors & Owners overview',
    'landing.staff':'Staff','landing.staff_sub':'Team directory · Add employees',
    'landing.scorecard':'Daily Scorecard','landing.scorecard_sub':'Livability & maintenance CTQs · red flags · trends',
    'landing.oncall':'On Call','landing.oncall_sub':'Log · History · Calendar by site',
    'landing.locations':'← Locations','landing.this_loc':'This location only','landing.processing':'Processing',
    'landing.eos_report':'EOS Report','landing.eos_report_sub':'End-of-shift summary & sign-off — before you go home',
    'landing.tagline':'Hegins &amp; Danville Operations','landing.select_loc':'Select a location','landing.layer_only':'Layer houses · this site only','landing.all_combined':'All locations combined','landing.newwo_title':'New Work Order','landing.newwo_sub':'Report a problem fast — uses your last location','landing.howto_title':'How To Use','landing.howto_sub':'Step-by-step instructions by department',
    'mode.dark':'Dark','mode.mid':'Mid','mode.bright':'Bright','mode.light':'Light','mode.white':'White',
    'proj.header':'Projects','proj.upcoming':'upcoming','proj.inprogress':'in progress','proj.done':'done',
    'proj.new':'+ New Project','proj.cancel':'✕ Cancel','proj.none':'No projects yet. Tap "+ New Project" to add an upcoming rebuild.',
    'proj.sec_upcoming':'📅 Upcoming','proj.sec_inprogress':'🔧 In Progress','proj.sec_completed':'✅ Completed',
    'proj.form_new':'New Project','proj.only_title':'Just a title is required — everything else is optional.',
    'proj.ph_title':'Project title (e.g. Bearing redundancy)','proj.ph_machine':'Machine / equipment (e.g. Washer + Blower)','proj.ph_assigned':'Assigned to','proj.ph_tasks':'Tasks — one per line',
    'proj.stage_upcoming':'📅 Upcoming','proj.stage_inprogress':'🔧 In progress','proj.create':'✓ Create Project',
    'proj.req_label':'Requested by','proj.req_team':'Team','proj.req_mgmt':'Management','proj.for_label':"What's it for?",'proj.pri_label':'Priority','proj.pri_urgent':'Urgent','proj.pri_high':'High','proj.pri_normal':'Normal',
    'proj.start':'▶ Start now','proj.no_tasks':'No tasks yet — add one below.','proj.add_task_ph':'Add a task…','proj.add_task':'+ Task',
    'proj.due_overdue':'overdue','proj.due_today':'Due today','proj.due_in':'Due in','proj.need_title':'Please give the project a title.','proj.created':'Project created',
    'eos.subtitle':'Daily End-of-Shift Report','eos.title':'END OF SHIFT','eos.houses':'houses',
    'eos.walks':'Walks','eos.dead':'Dead Birds Today','eos.headcount':'Headcount','eos.houses_walked':'Houses walked today',
    'eos.submitted':'✅ End of shift submitted','eos.by':'by','eos.confirm':'Before you go — confirm each',
    'eos.chk_walked':'All barns walked & issues logged','eos.chk_feedwater':'Feed & water OK overnight','eos.chk_secured':'Equipment secured (doors, lights, heat)','eos.chk_clean':'Work area clean (5S)',
    'eos.your_name':'Your name','eos.type_name':'Type your name','eos.submit':'✓ Submit End of Shift','eos.submitting':'Submitting…',
    'eos.need_all':'Please confirm all four items before submitting.','eos.need_name':'Please enter your name.','eos.offline':'You appear to be offline — reconnect and submit again.','eos.thanks':'End of shift submitted — thanks',
    'landing.quick_actions':'⚡ QUICK ACTIONS',
    'landing.new_wo':'🔧 New Work Order','landing.log_barn':'🐓 Log Barn Walk','landing.fortune':'🥠 Farm Fortune',
    'landing.enter_egg':'🥚 Enter Egg Data',
    // Daily Check dashboard (renderProdCheck)
    'chk.loading':'Loading…',
    'chk.pending':'pending',
    'chk.no_check':'No barn check submitted today',
    'chk.low_eggs':'Low eggs:',
    'chk.of_target':'of target',
    'chk.no_egg_log':'no egg log',
    'chk.issues_one':'Issue Found',
    'chk.issues_many':'Issues Found',
    'chk.no_issues_today':'✅ No issues found for today',
    'chk.todays_submissions':"Today's Submissions",
    'chk.ok':'✓ OK',
    'chk.flags_one':'flag(s)',
    'chk.unknown':'Unknown',
    'chk.psi':'PSI:',
    'chk.checked':'Checked',
    'chk.flagged':'Flagged',
    'chk.coverage':'Coverage',
    'chk.create_wos':'🔧 Create Must-Fix WOs for All Issues',
    'chk.creating_wos':'Creating WOs…',
    'chk.wos_created':'✓ WOs Created',
    // Morning Walk dashboard (renderProdMW)
    'mw.create_wos':'🔧 Create Must-Fix WOs',
    'mw.walked':'Walked',
    // Daily Checklist (renderChecklist / Dashboard)
    'cl.farm_placeholder':'Farm…',
    'cl.barn_placeholder':'Barn…',
    'cl.your_name':'Your name',
    'cl.barn_prefix':'Barn',
    'cl.done_suffix':'done',
    'cl.expected_time':'Expected Time Today',
    'cl.submit_day':'✅ SUBMIT DAY',
    'cl.submitted_pending':'✅ DAY SUBMITTED — PENDING REVIEW',
    'cl.note_p1':'Note any issues here (required if not checked)…',
    'cl.note_optional':'Optional note…',
    'cl.live_title':'📋 Task Completion — Live',
    'cl.submitted_stat':'Submitted',
    'cl.in_progress_stat':'In Progress',
    'cl.not_started_stat':'Not Started',
    'cl.freq_daily':'DAILY','cl.freq_2xwk':'2×/WK','cl.freq_eod':'EOD',
    'cl.freq_tue':'TUE','cl.freq_fri':'FRI','cl.freq_skip':'SKIP',
    'cl.select_first':'Select a farm and barn first.',
    'cl.must_check':'must be checked or have a note before submitting.',
    'cl.save_error':'Error saving:',
    // Daily Checklist group headers
    'cl.grp.p1':'🔴 PRIORITY 1 — ALWAYS FIRST',
    'cl.grp.core':'🟡 CORE WORK BLOCK',
    'cl.grp.cleaning':'🔵 CLEANING BLOCK',
    'cl.grp.rotational':'🟢 ROTATIONAL TASKS',
    'cl.grp.weekly':'🟣 WEEKLY TASKS',
    // Daily Checklist task labels
    'cl.tk.fwv':'Monitor Feed, Water, Ventilation',
    'cl.tk.fwv_sub':'Check all systems — note any issues below',
    'cl.tk.bird':'Full Bird & Equipment Check',
    'cl.tk.bird_sub':'Mortality · chute · sick/loose birds · egg belt · cage damage',
    'cl.tk.tubes':'Clean Water Tubes (front & back)',
    'cl.tk.front':'Clean Front of House',
    'cl.tk.front_sub':'After egg run',
    'cl.tk.blowoff':'Blow Off',
    'cl.tk.blowoff_sub':'Walls · cages · egg collectors · floors',
    'cl.tk.wheelbarrow':'Wheelbarrow + Back Cleanup',
    'cl.tk.undercage':'Under Cage Cleaning',
    'cl.tk.hallway':'Hallway Cleaning',
    'cl.tk.fly':'Fly Check',
    'cl.tk.fly_sub':'Tuesday only',
    'cl.tk.rodent':'Rodent Check',
    'cl.tk.rodent_sub':'Friday only',
  },
  es: {
    // Nav
    'nav.home':'🏠 Inicio','nav.dash':'📊 Panel','nav.prod':'🏭 Producción',
    'nav.maint':'🔧 Mantenimiento','nav.pkg':'🏭 Procesamiento','nav.feed':'🌾 Molino',
    'nav.ship':'🚚 Envíos','nav.kpi':'🥚 KPI','nav.reports':'📊 Reportes','nav.sched':'📅 Horario',
    // Section titles
    'title.dash':'📊 Panel de Operaciones','title.prod':'🏭 Producción',
    'title.maint':'🔧 Mantenimiento','title.pkg':'🏭 Procesamiento',
    'title.feed':'🌾 Molino de Alimento','title.ship':'🚚 Envíos',
    'title.kpi':'🥚 KPI de Producción','title.reports':'Reportes','title.sched':'📅 Horario de Equipo',
    // Maintenance sub-buttons
    'sub.wo':'🔧 Órdenes de Trabajo','sub.pm':'📋 PM Programado','sub.parts':'🔩 Partes',
    'sub.downtime':'⏱️ Tiempo Fuera','sub.assets':'🏭 Equipos',
    'sub.wi':'📖 Instrucciones','sub.log':'📁 Registro',
    // Packaging sub-buttons
    'sub.packing':'📦 Empaque','sub.eggs':'🥚 Huevos por Galpón','sub.quality':'🏅 Calidad de Huevo',
    // KPI sub-buttons
    'sub.kpi.dashboard':'📊 Panel','sub.kpi.trends':'📈 Tendencias',
    'sub.kpi.log':'📋 Registro','sub.kpi.entry':'➕ Registrar Huevos',
    // Production panel buttons
    'prod.daily_check':'Revisión Diaria del Empleado',
    'prod.daily_check_sub':'Registrar ronda, equipo y condiciones',
    'prod.morning_walk':'Ronda Mañanera',
    'prod.morning_walk_sub':'Líder / WNO — agua, temperatura, alimento, ventiladores',
    'prod.summary':'Resumen de Hoy',
    'prod.summary_sub':'Todas las revisiones, mortalidad, alertas y rondas',
    'prod.flock':'Edades del Lote',
    'prod.flock_sub':'Fechas de colocación, edad en semanas y cronograma',
    'prod.biosec':'Registro de Bioseguridad',
    'prod.biosec_sub':'Registro de visitantes, saneamiento y seguimiento de riesgos',
    // Dashboard
    'btn.new_wo':'🔧 Nueva Orden de Trabajo',
    'dash.exec_brief':'📋 Resumen Ejecutivo','dash.all_clear':'Todo en Orden',
    'dash.no_issues':'Sin problemas críticos en este momento',
    'dash.prod_card':'🏭 Producción','dash.maint_card':'🔧 Mantenimiento',
    'dash.pkg_card':'📦 Empaque','dash.ship_card':'🚚 Envíos',
    'dash.checks_done':'Revisiones Hechas','dash.mortality':'Mortalidad Hoy',
    'dash.urgent_wo':'OTs Urgentes','dash.pm_overdue':'PM Atrasado',
    'dash.pm_compliance':'Cumplimiento PM',
    'dash.eggs_logged':'Huevos Registrados','dash.cases_packed':'Cajas Empacadas',
    'dash.active_loads':'Cargas Activas','dash.exceptions':'Excepciones',
    // Status
    'status.open':'Abierta','status.in_progress':'En Progreso',
    'status.completed':'Completada','status.on_hold':'En Espera',
    // Priority
    'priority.urgent':'Urgente','priority.high':'Alta',
    'priority.normal':'Normal','priority.low':'Baja',
    // Common
    'lbl.date':'Fecha','lbl.farm':'Granja','lbl.house':'Galpón','lbl.notes':'Notas',
    'lbl.by':'Registrado Por','lbl.status':'Estado','lbl.priority':'Prioridad',
    'lbl.name':'Nombre','lbl.company':'Empresa','lbl.purpose':'Propósito',
    'btn.save':'Guardar','btn.cancel':'Cancelar','btn.clear':'Limpiar','btn.today':'Hoy',
    // Reports
    'reports.sub':'Resumen de actividad — actualizado en tiempo real',
    // Executive brief issue labels
    'brief.equip_down':'Equipo Fuera de Servicio','brief.urgent_wo':'OT Urgente',
    'brief.pm_overdue':'Tareas PM Atrasadas','brief.barns_flagged':'Galpón con Alerta',
    'brief.defect_rate':'Tasa de Defectos','brief.mortality':'Mortalidad',
    'brief.low_stock':'Partes con Bajo Stock','brief.tap_maint':'Ver Mantenimiento → PM',
    'brief.tap_parts':'Ver Mantenimiento → Partes',
    'brief.check_walk':'Revisar registros de ronda',
    'brief.quality_note':'registros de calidad hoy',
    'brief.all_clear':'Todo en Orden','brief.no_issues':'Sin problemas críticos en este momento',
    'brief.critical':'críticos','brief.warnings':'alertas',
    'brief.worse':'↑ peor','brief.better':'↓ mejor','brief.flat':'→ igual',
    'brief.vs_yest':'vs ayer',
    // Work Orders dynamic strings
    'wo.stat.urgent':'🔴 Urgente','wo.stat.high':'🟡 Alta','wo.stat.open':'Abierto',
    'wo.stat.inprog':'En Progreso','wo.stat.total':'Total OTs',
    'wo.empty':'Sin órdenes para este filtro.',
    'wo.age.new':'NUEVO HOY','wo.age.1d':'1 DÍA',
    'wo.age.days':'DÍAS','wo.age.warn':'DÍAS ⚠️','wo.age.over':'DÍAS — VENCIDO 🔴',
    'wo.pri.routine':'🟢 Rutina',
    'wo.down':'⚠️ CAÍDO','wo.degraded':'⚡ Degradado',
    'wo.btn.start':'▶ Iniciar','wo.btn.hold':'⏸ Pausar',
    'wo.btn.complete':'✓ Completar','wo.btn.resume':'↩ Reanudar','wo.btn.reopen':'↩ Reabrir',
    'wo.unassigned':'Sin Asignar','wo.completedby':'✓ Completado por',
    'wo.photo.prev':'← Ant','wo.photo.next':'Sig →','wo.photo.close':'✕ Cerrar',
    'wo.hint':'Toca una tarjeta para actualizar estado — confirmación requerida',
    // Production KPI bar
    'prod.kpi.checks':'Revisiones Hechas','prod.kpi.eggs':'Huevos Hoy','prod.kpi.flagged':'Con Alertas',
    'prod.barn':'Galpón',
    'prod.select_farm':'Seleccione su granja para comenzar',
    'prod.barns_checked':'galpones revisados hoy',
    'prod.barns_walked':'galpones recorridos hoy',
    'prod.select_walk':'Seleccione granja para recorrer',
    'prod.no_eggs_yet':'Sin conteos de huevos registrados hoy.',
    'prod.egg_kpi_title':'🥚 KPI de Huevos — Meta 90%',
    // Shipping / Farm directory
    'ship.select_farm':'— Seleccionar Granja —',
    'ship.no_farms':'Ninguna granja coincide con su búsqueda.',
    'ship.farms':'GRANJAS','ship.independent':'INDEPENDIENTE',
    'ship.owned_by':'Propiedad de',
    'ship.address':'Dirección','ship.contacts':'Contactos',
    'ship.ids_codes':'IDs y Códigos',
    'ship.state_id':'ID Estatal','ship.federal_id':'ID Federal',
    'ship.npip':'NPIP #','ship.door_code':'Código de Puerta',
    'ship.create_load':'🚛 CREAR CARGA PARA ESTA GRANJA',
    'ship.open_maps':'Abrir en Mapas →',
    // Biosecurity
    'bio.required':'Fecha, Granja, Tipo de Entrada y Nombre son requeridos.',
    'bio.saving':'Guardando...','bio.saved':'✓ Entrada registrada!',
    'bio.save_failed':'Error al guardar: ',
    'bio.entries_today':'Entradas Hoy',
    'bio.high_risk':'🔴 Alto Riesgo','bio.medium_risk':'Riesgo Medio',
    // Common UI
    'btn.close':'✕ Cerrar','btn.back_farms':'← Granjas',
    'common.saving':'Guardando...','common.save_failed':'Error al guardar: ',
    // Landing screen cards
    'landing.prod':'Producción','landing.prod_sub':'Ronda · Revisiones diarias · Alimento y agua',
    'landing.maint':'Mantenimiento','landing.maint_sub':'Órdenes · PM · Partes · Equipos',
    'landing.pkg':'Empaque','landing.pkg_sub':'Ops de huevos · Registro',
    'landing.ship':'Envíos','landing.ship_sub':'Cargas · Reconciliación · Excepciones',
    'landing.feed':'Molino de Alimento','landing.feed_default':'Niveles · Entregas · Lecturas',
    'landing.dash':'Panel','landing.dash_sub':'Vista para Directores y Dueños',
    'landing.staff':'Personal','landing.staff_sub':'Directorio · Agregar empleados',
    'landing.scorecard':'Tarjeta Diaria','landing.scorecard_sub':'CTQs de habitabilidad y mantenimiento · alertas · tendencias',
    'landing.oncall':'De Guardia','landing.oncall_sub':'Registro · Historial · Calendario por sitio',
    'landing.locations':'← Ubicaciones','landing.this_loc':'Solo esta ubicación','landing.processing':'Procesamiento',
    'landing.eos_report':'Reporte Fin de Turno','landing.eos_report_sub':'Resumen de fin de turno y firma — antes de salir',
    'landing.tagline':'Operaciones de Hegins y Danville','landing.select_loc':'Seleccione una ubicación','landing.layer_only':'Casas de ponedoras · solo este sitio','landing.all_combined':'Todas las ubicaciones combinadas','landing.newwo_title':'Nueva Orden de Trabajo','landing.newwo_sub':'Reporte un problema rápido — usa su última ubicación','landing.howto_title':'Cómo Usar','landing.howto_sub':'Instrucciones paso a paso por departamento',
    'mode.dark':'Oscuro','mode.mid':'Medio','mode.bright':'Brillante','mode.light':'Claro','mode.white':'Blanco',
    'proj.header':'Proyectos','proj.upcoming':'próximos','proj.inprogress':'en curso','proj.done':'hechos',
    'proj.new':'+ Nuevo Proyecto','proj.cancel':'✕ Cancelar','proj.none':'Aún no hay proyectos. Toca "+ Nuevo Proyecto" para agregar una reconstrucción próxima.',
    'proj.sec_upcoming':'📅 Próximos','proj.sec_inprogress':'🔧 En Curso','proj.sec_completed':'✅ Completados',
    'proj.form_new':'Nuevo Proyecto','proj.only_title':'Solo el título es obligatorio — lo demás es opcional.',
    'proj.ph_title':'Título del proyecto (ej. Repuesto de baleros)','proj.ph_machine':'Máquina / equipo (ej. Lavadora + Soplador)','proj.ph_assigned':'Asignado a','proj.ph_tasks':'Tareas — una por línea',
    'proj.stage_upcoming':'📅 Próximo','proj.stage_inprogress':'🔧 En curso','proj.create':'✓ Crear Proyecto',
    'proj.req_label':'Solicitado por','proj.req_team':'Equipo','proj.req_mgmt':'Gerencia','proj.for_label':'¿Para qué es?','proj.pri_label':'Prioridad','proj.pri_urgent':'Urgente','proj.pri_high':'Alta','proj.pri_normal':'Normal',
    'proj.start':'▶ Empezar ahora','proj.no_tasks':'Aún no hay tareas — agrega una abajo.','proj.add_task_ph':'Agregar tarea…','proj.add_task':'+ Tarea',
    'proj.due_overdue':'atrasado','proj.due_today':'Vence hoy','proj.due_in':'Vence en','proj.need_title':'Por favor da un título al proyecto.','proj.created':'Proyecto creado',
    'eos.subtitle':'Reporte de Fin de Turno','eos.title':'FIN DE TURNO','eos.houses':'casas',
    'eos.walks':'Rondas','eos.dead':'Aves Muertas Hoy','eos.headcount':'Personal','eos.houses_walked':'Casas recorridas hoy',
    'eos.submitted':'✅ Fin de turno enviado','eos.by':'por','eos.confirm':'Antes de salir — confirma cada uno',
    'eos.chk_walked':'Todas las casas recorridas y problemas registrados','eos.chk_feedwater':'Alimento y agua bien para la noche','eos.chk_secured':'Equipo asegurado (puertas, luces, calor)','eos.chk_clean':'Área de trabajo limpia (5S)',
    'eos.your_name':'Tu nombre','eos.type_name':'Escribe tu nombre','eos.submit':'✓ Enviar Fin de Turno','eos.submitting':'Enviando…',
    'eos.need_all':'Por favor confirma los cuatro puntos antes de enviar.','eos.need_name':'Por favor escribe tu nombre.','eos.offline':'Parece que no tienes conexión — reconéctate y envía de nuevo.','eos.thanks':'Fin de turno enviado — gracias',
    'landing.quick_actions':'⚡ ACCIONES RÁPIDAS',
    'landing.new_wo':'🔧 Nueva Orden de Trabajo','landing.log_barn':'🐓 Registrar Ronda','landing.fortune':'🥠 Fortuna del Día',
    'landing.enter_egg':'🥚 Registrar Huevos',
    // Daily Check dashboard (renderProdCheck)
    'chk.loading':'Cargando…',
    'chk.pending':'pendiente',
    'chk.no_check':'No se registró revisión de galpón hoy',
    'chk.low_eggs':'Huevos bajos:',
    'chk.of_target':'de meta',
    'chk.no_egg_log':'sin registro',
    'chk.issues_one':'Problema Encontrado',
    'chk.issues_many':'Problemas Encontrados',
    'chk.no_issues_today':'✅ Sin problemas hoy',
    'chk.todays_submissions':'Entregas de Hoy',
    'chk.ok':'✓ OK',
    'chk.flags_one':'alerta(s)',
    'chk.unknown':'Desconocido',
    'chk.psi':'PSI:',
    'chk.checked':'Revisados',
    'chk.flagged':'Con Alertas',
    'chk.coverage':'Cobertura',
    'chk.create_wos':'🔧 Crear OTs Obligatorias para Todos',
    'chk.creating_wos':'Creando OTs…',
    'chk.wos_created':'✓ OTs Creadas',
    // Morning Walk dashboard (renderProdMW)
    'mw.create_wos':'🔧 Crear OTs Obligatorias',
    'mw.walked':'Recorridos',
    // Daily Checklist (renderChecklist / Dashboard)
    'cl.farm_placeholder':'Granja…',
    'cl.barn_placeholder':'Galpón…',
    'cl.your_name':'Tu nombre',
    'cl.barn_prefix':'Galpón',
    'cl.done_suffix':'hechas',
    'cl.expected_time':'Tiempo Esperado Hoy',
    'cl.submit_day':'✅ ENVIAR DÍA',
    'cl.submitted_pending':'✅ DÍA ENVIADO — PENDIENTE REVISIÓN',
    'cl.note_p1':'Anota los problemas aquí (requerido si no se marca)…',
    'cl.note_optional':'Nota opcional…',
    'cl.live_title':'📋 Tareas Completadas — En Vivo',
    'cl.submitted_stat':'Enviado',
    'cl.in_progress_stat':'En Progreso',
    'cl.not_started_stat':'Sin Empezar',
    'cl.freq_daily':'DIARIO','cl.freq_2xwk':'2×/SEM','cl.freq_eod':'C/2D',
    'cl.freq_tue':'MAR','cl.freq_fri':'VIE','cl.freq_skip':'OMITIR',
    'cl.select_first':'Seleccione granja y galpón primero.',
    'cl.must_check':'debe estar marcado o tener nota antes de enviar.',
    'cl.save_error':'Error al guardar:',
    // Daily Checklist group headers
    'cl.grp.p1':'🔴 PRIORIDAD 1 — SIEMPRE PRIMERO',
    'cl.grp.core':'🟡 BLOQUE DE TRABAJO PRINCIPAL',
    'cl.grp.cleaning':'🔵 BLOQUE DE LIMPIEZA',
    'cl.grp.rotational':'🟢 TAREAS ROTATIVAS',
    'cl.grp.weekly':'🟣 TAREAS SEMANALES',
    // Daily Checklist task labels
    'cl.tk.fwv':'Monitorear Alimento, Agua y Ventilación',
    'cl.tk.fwv_sub':'Revisar todos los sistemas — notar problemas',
    'cl.tk.bird':'Revisión Completa de Aves y Equipo',
    'cl.tk.bird_sub':'Mortalidad · chute · aves enfermas/sueltas · banda · daño en jaulas',
    'cl.tk.tubes':'Limpiar Tubos de Agua (frente y fondo)',
    'cl.tk.front':'Limpiar Frente del Galpón',
    'cl.tk.front_sub':'Después de recolectar huevos',
    'cl.tk.blowoff':'Soplado',
    'cl.tk.blowoff_sub':'Paredes · jaulas · recolectores · pisos',
    'cl.tk.wheelbarrow':'Carretilla + Limpieza Atrás',
    'cl.tk.undercage':'Limpieza Bajo Jaulas',
    'cl.tk.hallway':'Limpieza de Pasillo',
    'cl.tk.fly':'Revisión de Moscas',
    'cl.tk.fly_sub':'Solo martes',
    'cl.tk.rodent':'Revisión de Roedores',
    'cl.tk.rodent_sub':'Solo viernes',
  }
};

let _lang = localStorage.getItem('rushtown_lang') || 'en';

function t(key) {
  return (TRANSLATIONS[_lang]?.[key]) ?? (TRANSLATIONS.en[key]) ?? key;
}

function toggleLang() {
  _lang = _lang === 'en' ? 'es' : 'en';
  localStorage.setItem('rushtown_lang', _lang);
  applyTranslations();
  // Refresh whatever panel/sub-section is currently visible so dynamic content
  // (rendered via JS, not data-i18n attributes) flips to the new language.
  // refreshCurrentPanel() covers every panel/sub-section the app exposes —
  // see its body in this file. Add new panels there, not here.
  try { refreshCurrentPanel(); } catch(e) { console.warn('toggleLang refresh:', e); }
  // Sub-views that may be open inside the current panel (filter drawers,
  // farm-scoped views) — these aren't gated by the panel-active check above.
  try { if (typeof _ecFarm !== 'undefined' && typeof renderECContent === 'function') renderECContent(); } catch(e){}
  try { if (typeof _mwSectionFarm !== 'undefined' && typeof renderMWContent === 'function') renderMWContent(); } catch(e){}
  try { if (window._maintSection === 'projects' && typeof renderMaintProjects === 'function') renderMaintProjects(); } catch(e){}
  // Self-contained full-screen overlays — re-render if open so they flip EN/ES live.
  try { var _mo = document.getElementById('manure-overlay'); if (_mo && _mo.style.display !== 'none' && typeof renderManure === 'function') renderManure(); } catch(e){}
  try { var _co = document.getElementById('completion-overlay'); if (_co && _co.style.display !== 'none' && typeof renderCompletion === 'function') renderCompletion(); } catch(e){}
  try { var _lh = document.getElementById('loc-home'); if (_lh && _lh.style.display !== 'none' && typeof renderTodayPanel === 'function') renderTodayPanel(); } catch(e){}
  try { var _pd = document.getElementById('panel-daily'); if (_pd && _pd.classList.contains('active') && _drLoaded && typeof drRender === 'function') drRender(); } catch(e){}
  try { if (typeof renderFarms === 'function') renderFarms(); } catch(e){}
  try { if (typeof renderBioLog === 'function') renderBioLog(); } catch(e){}
  // Daily Check / Morning Walk dashboards — always re-render so language flips
  // immediately even if the user has the tab open but the panel-active check
  // above missed it (e.g. when both prod-sec-check and panel-check exist).
  try { if (typeof renderProdCheck === 'function')          renderProdCheck(); } catch(e){}
  try { if (typeof renderProdMW === 'function')             renderProdMW(); } catch(e){}
  // Daily Checklist (employee task list + live dashboard)
  try { if (typeof renderChecklist === 'function')          renderChecklist(); } catch(e){}
  try { if (typeof renderChecklistDashboard === 'function') renderChecklistDashboard(); } catch(e){}
}

// ── Form-level text translations (labels, options, placeholders, buttons) ──
// Keyed by exact English text so no HTML changes needed — DOM walks automatically
const FORM_TEXT = {
  // ── Packing form ──
  '➕ Log Packing':           { es:'➕ Registrar Empaque' },
  'Date *':                   { es:'Fecha *' },
  'Product Type *':           { es:'Tipo de Producto *' },
  'Total Dz *':               { es:'Total Docenas *' },
  'Unit':                     { es:'Unidad' },
  'Start Time':               { es:'Hora Inicio' },
  'End Time':                 { es:'Hora Fin' },
  'Break (min)':              { es:'Descanso (min)' },
  'Downtime (min)':           { es:'Tiempo Fuera (min)' },
  'Houses Packed':            { es:'Galpones Empacados' },
  'Total Stops':              { es:'Paradas Totales' },
  'Line / Area':              { es:'Línea / Área' },
  'Shift':                    { es:'Turno' },
  'Entered By':               { es:'Registrado Por' },
  'Notes':                    { es:'Notas' },
  '✓ Log Packing':            { es:'✓ Registrar Empaque' },
  'Clear':                    { es:'Limpiar' },
  '⚡ Auto-Calculated':       { es:'⚡ Auto-Calculado' },
  'Run Time':                 { es:'Tiempo Corrida' },
  'Dz / Hour':                { es:'Dz / Hora' },
  'Dz / House':               { es:'Dz / Galpón' },
  'Packing Log':              { es:'Registro de Empaque' },
  // Select options
  '— Select —':               { es:'— Seleccionar —' },
  '— select —':               { es:'— seleccionar —' },
  'Jumbo':                    { es:'Jumbo' },
  'XL':                       { es:'XL' },
  'Large':                    { es:'Grande' },
  'Medium':                   { es:'Mediano' },
  'Small':                    { es:'Pequeño' },
  'Pullet':                   { es:'Pollita' },
  'Nest Run':                 { es:'Postura' },
  'Dozen':                    { es:'Docena' },
  'Cases':                    { es:'Cajas' },
  'Flats':                    { es:'Bandejas' },
  'AM':                       { es:'AM' },
  'PM':                       { es:'PM' },
  'Night':                    { es:'Noche' },
  // ── Eggs by Barn form ──
  '🥚 Log Eggs by Barn':      { es:'🥚 Registrar Huevos por Galpón' },
  'Farm *':                   { es:'Granja *' },
  'House *':                  { es:'Galpón *' },
  'Eggs Collected':           { es:'Huevos Recolectados' },
  'Eggs Packed (Dz)':         { es:'Huevos Empacados (Dz)' },
  '✓ Save Barn Eggs':         { es:'✓ Guardar Huevos' },
  'KPI %':                    { es:'KPI %' },
  'vs Target':                { es:'vs Meta' },
  'Pack Rate':                { es:'Tasa Empaque' },
  // ── Egg Quality form ──
  '🏅 Log Egg Quality Grade-Out': { es:'🏅 Registrar Calidad de Huevo' },
  'Total Graded *':           { es:'Total Clasificado *' },
  'Grade A':                  { es:'Grado A' },
  'Cracks':                   { es:'Grietas' },
  'Dirties':                  { es:'Sucios' },
  'Floor Eggs':               { es:'Huevos de Piso' },
  'Soft Shells':              { es:'Cáscaras Blandas' },
  'Blood Spots':              { es:'Manchas de Sangre' },
  '✓ Save Quality Record':    { es:'✓ Guardar Calidad' },
  // ── Work order form ──
  'Equipment / Item *':       { es:'Equipo / Ítem *' },
  'Location *':               { es:'Ubicación *' },
  'Priority':                 { es:'Prioridad' },
  'Reported By':              { es:'Reportado Por' },
  'Description':              { es:'Descripción' },
  'Submit Work Order':        { es:'Enviar Orden' },
  'Cancel':                   { es:'Cancelar' },
  '⚠️ Urgent':                { es:'⚠️ Urgente' },
  '🔴 High':                  { es:'🔴 Alta' },
  '🟡 Normal':                { es:'🟡 Normal' },
  '🟢 Low':                   { es:'🟢 Baja' },
  'open':                     { es:'abierta' },
  'in-progress':              { es:'en progreso' },
  'completed':                { es:'completada' },
  'on-hold':                  { es:'en espera' },
  // ── Biosecurity form ──
  'Entry Type':               { es:'Tipo de Entrada' },
  'Risk Level':               { es:'Nivel de Riesgo' },
  'Person Name *':            { es:'Nombre *' },
  'Company / Org':            { es:'Empresa / Org' },
  'Purpose of Visit':         { es:'Propósito de Visita' },
  'Visitor':                  { es:'Visitante' },
  'Vendor':                   { es:'Proveedor' },
  'Contractor':               { es:'Contratista' },
  'Employee':                 { es:'Empleado' },
  'Delivery':                 { es:'Entrega' },
  'Low':                      { es:'Bajo' },
  'Medium':                   { es:'Medio' },
  'High':                     { es:'Alto' },
  '✓ Log Entry':              { es:'✓ Registrar Entrada' },
  // ── Downtime form ──
  'Equipment *':              { es:'Equipo *' },
  'Start Time *':             { es:'Hora Inicio *' },
  'Duration (min)':           { es:'Duración (min)' },
  'Cause':                    { es:'Causa' },
  'System':                   { es:'Sistema' },
  'Mechanical':               { es:'Mecánico' },
  'Electrical':               { es:'Eléctrico' },
  'Operator':                 { es:'Operador' },
  'Planned':                  { es:'Planificado' },
  'Other':                    { es:'Otro' },
  // ── Barn walk modal: card titles ──
  '👤 Employee Check-In':              { es:'👤 Registro de Empleado' },
  '💀 Mortality':                      { es:'💀 Mortalidad' },
  '⚙️ Equipment':                      { es:'⚙️ Equipos' },
  '🌡️ Air & Environment':             { es:'🌡️ Aire y Ambiente' },
  '🍗 Feeding & Water':               { es:'🍗 Alimentación y Agua' },
  '🥚 Belts':                          { es:'🥚 Bandas' },
  '🐀 Pest Control':                  { es:'🐀 Control de Plagas' },
  '✅ Daily Checklist':               { es:'✅ Lista de Revisión Diaria' },
  '📝 Notes / Corrective Actions':    { es:'📝 Notas / Acciones Correctivas' },
  // ── Barn walk modal: row labels ──
  'Mortality found?':                 { es:'¿Se encontró mortalidad?' },
  'How many?':                        { es:'¿Cuántos?' },
  'All mortality removed?':           { es:'¿Toda la mortalidad removida?' },
  'Manure Dryers':                    { es:'Secadores de Estiércol' },
  'Feathering condition':             { es:'Condición del Plumaje' },
  'House Doors':                      { es:'Puertas del Galpón' },
  'Loose Birds?':                     { es:'¿Aves Sueltas?' },
  'How many loose birds?':            { es:'¿Cuántas aves sueltas?' },
  'Air Quality Anomaly?':             { es:'¿Anomalía en Calidad del Aire?' },
  'House Temp (°F)':                  { es:'Temperatura del Galpón (°F)' },
  'Feeders':                          { es:'Comederos' },
  'Feed Wastage?':                    { es:'¿Desperdicio de Alimento?' },
  'Feed Bin Reading (lbs) — record current bin level': { es:'Lectura de Tolva (lbs) — nivel actual' },
  'Water Pressure (PSI) — Normal: 10–60': { es:'Presión de Agua (PSI) — Normal: 10–60' },
  'Standpipes':                       { es:'Tuberías de Pie' },
  'Egg Belt Working?':                { es:'¿Banda de Huevos Funcionando?' },
  'Manure Belts':                     { es:'Bandas de Estiércol' },
  'Rodents present?':                 { es:'¿Roedores Presentes?' },
  'Rodents caught (count)':          { es:'Roedores Atrapados (cantidad)' },
  'Fly trap activity?':               { es:'¿Actividad en Trampa de Moscas?' },
  'Fly trap count (flies caught)':    { es:'Conteo de Trampa (moscas atrapadas)' },
  // ── Barn walk modal: yes/no buttons ──
  '❌ YES':                           { es:'❌ SÍ' },
  '✅ NO':                            { es:'✅ NO' },
  '⚠️ YES':                          { es:'⚠️ SÍ' },
  '🟢 ON':                           { es:'🟢 ENCENDIDO' },
  '🔴 OFF':                          { es:'🔴 APAGADO' },
  '✅ Good':                          { es:'✅ Bueno' },
  '⚠️ Fair':                         { es:'⚠️ Regular' },
  '❌ Poor':                          { es:'❌ Malo' },
  'Open':                             { es:'Abierta' },
  'Closed':                           { es:'Cerrada' },
  '✅ Normal':                        { es:'✅ Normal' },
  '❌ Anomaly':                       { es:'❌ Anomalía' },
  '✅ Full':                          { es:'✅ Lleno' },
  '❌ Empty':                         { es:'❌ Vacío' },
  '✅ Clean':                         { es:'✅ Limpio' },
  '❌ Dirty':                         { es:'❌ Sucio' },
  '✅ Working':                       { es:'✅ Funcionando' },
  '❌ Down':                          { es:'❌ Caído' },
  '✅ Running':                       { es:'✅ Corriendo' },
  '❌ Not Running':                   { es:'❌ Detenido' },
  '✓ Submit Daily Check':             { es:'✓ Enviar Revisión Diaria' },
  // ── Barn walk checklist labels ──
  'Check for water leaks — notify manager if found':          { es:'Revisar fugas de agua — notificar al gerente si hay' },
  'Check all cages — cull any injured or sick birds':         { es:'Revisar todas las jaulas — retirar aves lesionadas o enfermas' },
  'All dead birds placed in white chute (back of barn, top floor)': { es:'Todas las aves muertas en el chute blanco (parte trasera, piso superior)' },
  'White chute checked — getting full?':                      { es:'¿Chute blanco revisado — está llenándose?' },
  'Damaged cages & egg belts — any damage found?':            { es:'Jaulas y bandas de huevos — ¿se encontró daño?' },
  'Water tubes cleaned (front & back of house)':              { es:'Tubos de agua limpios (frente y fondo del galpón)' },
  // ── Barn walk checklist buttons ──
  '✅ Pass':   { es:'✅ OK' },
  '❌ Fail':   { es:'❌ Falla' },
  '✅ OK':     { es:'✅ OK' },
  '⚠️ Full':  { es:'⚠️ Lleno' },
  '✅ None':   { es:'✅ Ninguno' },
  '❌ Found':  { es:'❌ Encontrado' },
  // ── Work Orders form labels ──
  'Farm Location *':          { es:'Ubicación de Granja *' },
  'Your Name *':              { es:'Tu Nombre *' },
  'House / Area':             { es:'Galpón / Área' },
  'Problem / System *':       { es:'Problema / Sistema *' },
  'Equipment Down?':          { es:'¿Equipo Fuera de Servicio?' },
  'Parts Needed':             { es:'Partes Necesarias' },
  'Est. Hours':               { es:'Horas Est.' },
  'Additional Notes':         { es:'Notas Adicionales' },
  // ── Work Orders select options ──
  '— Select Farm —':          { es:'— Seleccionar Granja —' },
  '— Select Farm First —':    { es:'— Seleccionar Granja Primero —' },
  '— Select Problem —':       { es:'— Seleccionar Problema —' },
  'Ventilation / Fans':       { es:'Ventilación / Ventiladores' },
  'Watering System':          { es:'Sistema de Agua' },
  'Feed System':              { es:'Sistema de Alimento' },
  'Heating / Brooders':       { es:'Calefacción / Criadoras' },
  'Manure System':            { es:'Sistema de Estiércol' },
  'Egg Collection':           { es:'Recolección de Huevos' },
  'Generator':                { es:'Generador' },
  'Building / Structure':     { es:'Edificio / Estructura' },
  'No — still running':       { es:'No — sigue funcionando' },
  'Yes — equipment down':     { es:'Sí — equipo fuera de servicio' },
  'Normal':                   { es:'Normal' },
  // ── Work Orders buttons / success ──
  '✕ Cancel':                 { es:'✕ Cancelar' },
  '✓ SUBMIT WORK ORDER':      { es:'✓ ENVIAR ORDEN DE TRABAJO' },
  'Work Order Submitted!':    { es:'¡Orden Enviada!' },
  'Submit Another':           { es:'Enviar Otra' },
  'New Work Order':           { es:'Nueva Orden de Trabajo' },
  'Fill it out — your director will see it immediately': { es:'Complétala — tu director la verá de inmediato' },
  // ── Work Orders closeout modal ──
  '✓ Complete Work Order':    { es:'✓ Completar Orden' },
  'Completed By':             { es:'Completado Por' },
  'What Was Done':            { es:'Qué Se Hizo' },
  'Parts Used':               { es:'Partes Usadas' },
  'Update Status?':           { es:'¿Actualizar Estado?' },
  // ── Team Schedule modal ──
  'Person Name *':            { es:'Nombre *' },
  'Role / Position':          { es:'Rol / Puesto' },
  '🔵 Morning':              { es:'🔵 Mañana' },
  '🟡 Afternoon':            { es:'🟡 Tarde' },
  '🟣 Night':                { es:'🟣 Noche' },
  '✓ Save':                  { es:'✓ Guardar' },
  '🗑 Delete':               { es:'🗑 Eliminar' },
  '⎘ Copy Last Week':        { es:'⎘ Copiar Semana Anterior' },
  // ── Barn walk / morning walk ──
  'Pass':                     { es:'Pasa' },
  'Fail':                     { es:'Falla' },
  // ── Common form text ──
  'Date':                     { es:'Fecha' },
  'Farm':                     { es:'Granja' },
  'House':                    { es:'Galpón' },
  'Name':                     { es:'Nombre' },
  'Status':                   { es:'Estado' },
  'All Locations':            { es:'Todas las Ubicaciones' },
  'All':                      { es:'Todas' },
  '← Back':                  { es:'← Atrás' },
  'Save':                     { es:'Guardar' },
  'Submit':                   { es:'Enviar' },
  'Today':                    { es:'Hoy' },
  '+ Add New':                { es:'+ Agregar Nuevo' },
  // ── Barn walk modal: extra static HTML ──
  '✕ Exit':                                                       { es:'✕ Salir' },
  'MARK EACH ITEM PASS OR FAIL — IN ORDER':                       { es:'MARQUE CADA ÍTEM PASA O FALLA — EN ORDEN' },
  'Egg count (approx. total today)':                              { es:'Conteo de Huevos (total aprox. hoy)' },
  'Weekly rodent trap count':                                     { es:'Conteo semanal de roedores' },
  '🔧 Work Order will be auto-created when you submit.':          { es:'🔧 Orden de Trabajo creada al enviar.' },
  '🔧 Work Order will be auto-created':                           { es:'🔧 Orden de Trabajo será creada' },
  '✓ Submit Daily Check':                                         { es:'✓ Enviar Revisión Diaria' },
  // Barn walk checklist task labels (inside .bw-cl-label)
  'Monitor feed, water & ventilation throughout the shift':       { es:'Monitorear alimento, agua y ventilación durante el turno' },
  'Full bird check — mortality, chute, sick/loose birds, egg belt & cage damage': { es:'Revisión completa — mortalidad, chute, aves enfermas/sueltas, banda de huevos y daño en jaulas' },
  'Water tubes cleaned — front & back of house':                  { es:'Tubos de agua limpios — frente y fondo del galpón' },
  'Front of house cleaned after egg run':                         { es:'Frente del galpón limpio después de recolectar huevos' },
  'Full blow-off — walls, cages, egg collectors & floors (top & bottom of house)': { es:'Soplado completo — paredes, jaulas, recolectores y pisos (arriba y abajo)' },
  'Wheelbarrow emptied & back of house tidied':                   { es:'Carretilla vaciada y fondo del galpón ordenado' },
  'Under cage cleaning — all rows, both floors':                  { es:'Limpieza bajo jaulas — todas las filas, ambos pisos' },
  'Designated hallways cleaned (swept & tidied)':                 { es:'Pasillos designados limpios (barridos y ordenados)' },
  'Fly check — inspect all traps & bait stations':                { es:'Revisión de moscas — inspeccionar trampas y estaciones de cebo' },
  'Rodent check — inspect stations, add poison if needed':        { es:'Revisión de roedores — inspeccionar estaciones, agregar veneno si es necesario' },
  // Time markers (next to .bw-cl-label)
  '⏱ time varies · ongoing':                                      { es:'⏱ tiempo variable · continuo' },
  '⏱ 2 hrs · daily':                                              { es:'⏱ 2 hrs · diario' },
  '⏱ 30 min · daily':                                             { es:'⏱ 30 min · diario' },
  '⏱ 45 min · daily':                                             { es:'⏱ 45 min · diario' },
  '⏱ 3h 30min · daily / every other day':                         { es:'⏱ 3h 30min · diario / día por medio' },
  '⏱ 25 min · daily':                                             { es:'⏱ 25 min · diario' },
  '⏱ 3 hrs · min 2x/week':                                        { es:'⏱ 3 hrs · mín. 2x/sem' },
  '⏱ 45 min · every other day':                                   { es:'⏱ 45 min · día por medio' },
  '⏱ 15 min · weekly':                                            { es:'⏱ 15 min · semanal' },
  '⏱ 30 min · weekly':                                            { es:'⏱ 30 min · semanal' },
  // Alert headers in .bw-cl-fail-detail
  '⚠ LOG THE ISSUE & NOTIFY MANAGER':                             { es:'⚠ REGISTRAR PROBLEMA Y AVISAR AL GERENTE' },
  '⚠ LOG ALL ISSUES — NOTIFY MANAGER':                            { es:'⚠ REGISTRAR TODOS LOS PROBLEMAS — AVISAR AL GERENTE' },
  '⚠ MUST COMPLETE — RETURN TO FINISH':                           { es:'⚠ DEBE COMPLETAR — REGRESAR A TERMINAR' },
  '⚠ COMPLETE BEFORE SHIFT END':                                  { es:'⚠ COMPLETAR ANTES DEL FIN DEL TURNO' },
  '⚠ LOG WHAT WAS MISSED':                                        { es:'⚠ REGISTRAR LO QUE FALTÓ' },
  '⚠ DO NOT LEAVE FULL':                                          { es:'⚠ NO DEJAR LLENA' },
  '⚠ LOG WHICH SECTION WAS SKIPPED':                              { es:'⚠ REGISTRAR QUÉ SECCIÓN SE OMITIÓ' },
  '⚠ LOG WHICH HALLWAY WAS SKIPPED':                              { es:'⚠ REGISTRAR QUÉ PASILLO SE OMITIÓ' },
  '⚠ REPORT HIGH ACTIVITY TO MANAGER':                            { es:'⚠ REPORTAR ACTIVIDAD ALTA AL GERENTE' },
  '⚠ REPORT EVIDENCE TO MANAGER':                                 { es:'⚠ REPORTAR EVIDENCIA AL GERENTE' },
  // Morning walk modal headers + labels
  '☀️ Morning Walk':                                              { es:'☀️ Ronda Mañanera' },
  '👤 Lead / WNO Name':                                           { es:'👤 Nombre del Líder / WNO' },
  '👥 Employees Present at This Barn':                            { es:'👥 Empleados Presentes en Este Galpón' },
  '👥 Employees Present at This Barn (optional)':                 { es:'👥 Empleados Presentes en Este Galpón (opcional)' },
  '📖 WALK INSTRUCTIONS — WHAT TO CHECK & WHY':                   { es:'📖 INSTRUCCIONES DE LA RONDA — QUÉ REVISAR Y POR QUÉ' },
  '📊 Readings':                                                  { es:'📊 Lecturas' },
  'Water Pressure (PSI)':                                         { es:'Presión de Agua (PSI)' },
  'House Temp (°F)':                                              { es:'Temperatura del Galpón (°F)' },
  '🌾 Feed Meter Reading (lbs) — updates bin level instantly':    { es:'🌾 Medidor de Alimento (lbs) — actualiza el nivel al instante' },
  '🌾 Bin A (tons)':                                              { es:'🌾 Tolva A (toneladas)' },
  '🌾 Bin B (tons)':                                              { es:'🌾 Tolva B (toneladas)' },
  '⚙️ Systems Check':                                             { es:'⚙️ Revisión de Sistemas' },
  'Feed — Feeders running?':                                      { es:'Alimento — ¿Comederos funcionando?' },
  'Fans — All working?':                                          { es:'Ventiladores — ¿Todos funcionando?' },
  'Blowers — Working?':                                           { es:'Sopladores — ¿Funcionando?' },
  '📝 Notes (optional)':                                          { es:'📝 Notas (opcional)' },
  '☀️ Submit Morning Walk':                                       { es:'☀️ Enviar Ronda Mañanera' },
  // Misc UI strings (across panels)
  '📍 Hegins':                                                    { es:'📍 Hegins' },
  '📍 Danville':                                                  { es:'📍 Danville' },
  '📍 Rushtown':                                                  { es:'📍 Rushtown' },
  '📍 Turbotville':                                               { es:'📍 Turbotville' },
  '📍 W&M':                                                       { es:'📍 W&M' },
  'All Farms':                                                    { es:'Todas las Granjas' },
  'All Types':                                                    { es:'Todos los Tipos' },
  '💀 Mortality':                                                 { es:'💀 Mortalidad' },
  '🐔 Loose Birds':                                               { es:'🐔 Aves Sueltas' },
  '🐀 Rodents':                                                   { es:'🐀 Roedores' },
  '🪰 Flies':                                                     { es:'🪰 Moscas' },
  // Daily Checklist tab buttons
  '✅ Daily Tasks':                                               { es:'✅ Tareas Diarias' },
  '📊 Barn Overview':                                             { es:'📊 Vista por Galpón' },
  'Overview':                                                     { es:'Vista General' },
  'Tasks':                                                        { es:'Tareas' },
  // Cage cleaning card
  '🧹 Clean Under Cages':                                         { es:'🧹 Limpiar Bajo Jaulas' },
  'Scheduled deep-clean task: sweep and remove buildup from under all cage rows on both floors.': { es:'Tarea de limpieza profunda programada: barrer y remover acumulación bajo todas las filas de jaulas en ambos pisos.' },
  'Was this completed?':                                          { es:'¿Se completó?' },
  '✅ COMPLETE':                                                  { es:'✅ COMPLETO' },
  '❌ INCOMPLETE':                                                { es:'❌ INCOMPLETO' },
  '📅 Weekly Task':                                               { es:'📅 Tarea Semanal' },
};

// Placeholders
const PLACEHOLDER_TEXT = {
  es: {
    'Name':            'Nombre',
    'Optional notes':  'Notas opcionales',
    'Optional':        'Opcional',
    'e.g. Line 1':     'ej. Línea 1',
    'Notes...':        'Notas...',
    'Search...':       'Buscar...',
    'e.g. 134500':     'ej. 134500',
    'e.g. 11200':      'ej. 11200',
    'e.g. 134000':     'ej. 134000',
    'Your name':                               'Tu nombre',
    'Describe the issue in detail...':         'Describe el problema en detalle...',
    'Any other details...':                    'Otros detalles...',
    'List any parts (optional)':               'Lista de partes (opcional)',
    'e.g. 2':                                  'ej. 2',
    'Describe what was repaired, replaced, or adjusted...': 'Describe lo que se reparó, reemplazó o ajustó...',
    // ── Barn walk modal placeholders ──
    'Enter your name...':                      'Ingresa tu nombre...',
    'Enter count':                             'Ingresa cantidad',
    'Enter fly count':                         'Ingresa conteo de moscas',
    'Total rodents caught this week':          'Total de roedores atrapados esta semana',
    'Anything to flag for the manager...':     'Algo que reportar al gerente...',
    // Barn walk fail-detail input placeholders
    'System affected, readings, action taken...': 'Sistema afectado, lecturas, acción tomada...',
    'Mortality count, cage row, belt issue, loose birds, chute level...': 'Conteo de mortalidad, fila, problema de banda, aves sueltas, nivel del chute...',
    'What was incomplete, reason...':          'Qué quedó incompleto, motivo...',
    'What was not cleaned, reason...':         'Qué no se limpió, motivo...',
    'Which areas not completed (top floor, fan screens, collectors...)...': 'Qué áreas no se completaron (piso superior, rejillas, recolectores...)...',
    'What was left, reason...':                'Qué quedó, motivo...',
    'Which rows/section not completed, reason...': 'Qué filas/sección no se completaron, motivo...',
    'Which hallway(s) not completed, reason...': 'Qué pasillo(s) no se completaron, motivo...',
    'Trap location, activity level (low/med/high)...': 'Ubicación de la trampa, nivel de actividad (bajo/medio/alto)...',
    'Station location, evidence found, poison added (y/n)...': 'Ubicación, evidencia, veneno agregado (s/n)...',
    // ── Morning walk modal placeholders ──
    'Headcount':                               'Conteo',
    '10–60 PSI':                               '10–60 PSI',
    'e.g. 72':                                 'ej. 72',
    'Enter total lbs remaining':               'Ingresa total de lbs restantes',
    'Anything to flag...':                     'Algo que reportar...',
    '0.0':                                     '0.0',
  }
};

function applyFormTextTranslation() {
  // Translate <label> and <option> text
  document.querySelectorAll('label, option').forEach(el => {
    // Skip options inside dynamically-built selects (managed by render fns)
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    if (!orig) return;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });

  // Translate .ops-qf-title (form headers like "➕ Log Packing")
  document.querySelectorAll('.ops-qf-title').forEach(el => {
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });

  // Translate save/cancel button text
  document.querySelectorAll('.ops-save-btn, .ops-cancel-btn').forEach(el => {
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });

  // Translate barn walk modal: card titles, row labels, yn-buttons, checklist labels, submit
  document.querySelectorAll('.bw-card-title, .bw-row-label, .bw-yn-btn, .bw-cl-label, .bw-cl-pass, .bw-cl-fail-btn, .bw-submit, .bw-wo-badge').forEach(el => {
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    if (!orig) return;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });

  // ── Barn-walk checklist rows: time labels & alert headers ──
  // Pattern: each .bw-cl-label is followed by a sibling <div> holding the time
  // marker ("⏱ 2 hrs · daily"). Translate by exact-text match against FORM_TEXT.
  document.querySelectorAll('#barn-walk-modal .bw-cl-label + div').forEach(el => {
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    if (!orig) return;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });
  // .bw-cl-fail-detail alert blocks: first child of inner wrapper = bold header,
  // second child = paragraph. Walk both via FORM_TEXT.
  document.querySelectorAll('#barn-walk-modal .bw-cl-fail-detail > div > div').forEach(el => {
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    if (!orig) return;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });
  // Generic walker for the daily-walk/check modals + related overlays: translate
  // plain text-only divs whose exact textContent matches a FORM_TEXT key. Cheap
  // and covers section headers like "👤 Lead / WNO Name", "📊 Readings",
  // "⚙️ Systems Check", and pill buttons like "All Farms", "📍 Hegins", etc.,
  // without needing new class hooks in the HTML.
  const _modalScopes = [
    '#barn-walk-modal',
    '#morning-walk-modal',
    '#bw-history-overlay',
    '#pest-log-overlay',
    '#egg-trends-overlay',
    '#prod-summary-section',
  ].join(', ');
  document.querySelectorAll(_modalScopes.replace(/(#[\w-]+)/g, '$1 div')).forEach(el => {
    if (el.children.length > 0) return; // text-only nodes only
    if (!el.textContent || !el.textContent.trim()) return;
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    if (!orig) return;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });
  document.querySelectorAll(_modalScopes.replace(/(#[\w-]+)/g, '$1 button')).forEach(el => {
    if (el.children.length > 0) return;
    if (!el.textContent || !el.textContent.trim()) return;
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    if (!orig) return;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });
  // Pill buttons live across many panels (filters, locations, types) — single
  // text-only buttons that show "All Farms", "📍 Hegins", "All Types", etc.
  document.querySelectorAll('button.pill, button.loc-pill, button.pri-pill').forEach(el => {
    if (el.children.length > 0) return;
    if (!el.textContent || !el.textContent.trim()) return;
    if (!el.dataset.enText) el.dataset.enText = el.textContent.trim();
    const orig = el.dataset.enText;
    if (!orig) return;
    const tr = FORM_TEXT[orig];
    if (tr) el.textContent = _lang === 'es' ? (tr.es ?? orig) : orig;
  });

  // Translate placeholders
  const pmap = PLACEHOLDER_TEXT[_lang] || {};
  document.querySelectorAll('[placeholder]').forEach(el => {
    if (!el.dataset.enPlaceholder) el.dataset.enPlaceholder = el.getAttribute('placeholder');
    const orig = el.dataset.enPlaceholder;
    el.setAttribute('placeholder', pmap[orig] || orig);
  });
}

function applyTranslations() {
  // Update all data-i18n elements (nav, section titles, sub-buttons)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val && val !== key) el.innerHTML = val;
  });
  // Header toggle button (inside the app)
  const hdrBtn = document.getElementById('lang-toggle-btn');
  if (hdrBtn) hdrBtn.textContent = _lang === 'en' ? '🌐 ES' : '🌐 EN';
  // Landing screen top-bar lang button
  const landingLbl = document.getElementById('landing-lang-label');
  if (landingLbl) landingLbl.textContent = _lang === 'en' ? 'ES' : 'EN';
  // Translate all form labels, options, placeholders, buttons
  applyFormTextTranslation();
}

// Live clock for landing screen
function startLandingClock() {
  function tick() {
    const now = new Date();
    const clockEl = document.getElementById('ls-clock');
    const dateEl  = document.getElementById('ls-date');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    if (dateEl)  dateEl.textContent  = now.toLocaleDateString(_lang === 'es' ? 'es-ES' : 'en-US', {weekday:'long', month:'long', day:'numeric'}).toUpperCase();
  }
  tick();
  setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────────────────────────────
// initApp — fast-boot strategy:
//   1. Attach onSnapshot listeners for the 5 core collections.
//      The first snapshot doubles as the initial load (Firestore returns
//      cached docs instantly when offline / before the network responds).
//   2. As soon as the workOrders snapshot fires (or 4s safety timeout),
//      hide the loading screen and render the dashboard.
//   3. Run all secondary loaders / seeders / listeners in the BACKGROUND
//      so they never block first paint.
// ─────────────────────────────────────────────────────────────────────────
let _hideLoadingCalled = false;
function _hideLoadingScreen() {
  if (_hideLoadingCalled) return;
  _hideLoadingCalled = true;
  requestAnimationFrame(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) ls.classList.add('hidden');
    try { renderDash(); } catch(e) { console.warn('renderDash failed:', e); }
    if (typeof initNotifications === 'function') {
      setTimeout(() => { try { initNotifications(); } catch(e){} }, 600);
    }
  });
}

async function initApp() {
  setMsg('Loading…');
  // Safety net: never let the splash sit longer than 4 seconds, even if
  // Firestore is unreachable. App opens with whatever it has cached.
  const safetyTimer = setTimeout(_hideLoadingScreen, 4000);

  try {
    const today = new Date().toISOString().slice(0,10);

    // ── Core listeners: one round-trip each, no duplicate .get() ──
    db.collection('workOrders').orderBy('ts','desc').onSnapshot(snap => {
      workOrders = [];
      snap.forEach(d => workOrders.push({...d.data(), _fbId: d.id}));
      // Re-add any work orders still parked on this device (offline, not yet
      // synced) so they keep showing in the list across snapshot rebuilds.
      injectPendingWOs();
      if (workOrders.length > 0) {
        const nums = workOrders.map(w => parseInt((w.id||'').replace('WO-',''))).filter(n => !isNaN(n));
        woCounter = nums.length ? nums.reduce((m,n) => Math.max(m,n), 0) + 1 : 1;
      }
      setSyncDot('live');
      // First fire → app is interactive. Subsequent fires just refresh.
      if (!_hideLoadingCalled) {
        clearTimeout(safetyTimer);
        _hideLoadingScreen();
      } else {
        refreshCurrentPanel();
      }
    }, err => {
      console.error('workOrders listener error:', err);
      _hideLoadingScreen();
    });

    db.collection('pmCompletions').onSnapshot(snap => {
      pmComps = {};
      snap.forEach(d => { pmComps[d.id] = d.data(); });
      if (_hideLoadingCalled) refreshCurrentPanel();
    });

    db.collection('pmProcedures').onSnapshot(snap => {
      pmProcedures = {};
      snap.forEach(d => { pmProcedures[d.id] = d.data(); });
      if (_hideLoadingCalled) refreshCurrentPanel();
    });

    db.collection('activityLog').orderBy('ts','desc').limit(500).onSnapshot(snap => {
      actLog = [];
      snap.forEach(d => actLog.push(d.data()));
      if (document.getElementById('panel-log')?.classList.contains('active') || window._maintSection==='log') renderLog();
      if (document.getElementById('panel-reports')?.classList.contains('active')) renderReports();
    });

    db.collection('partsInventory').onSnapshot(snap => {
      partsInventory = {};
      snap.forEach(d => { partsInventory[d.id] = d.data(); });
      if (document.getElementById('panel-parts')?.classList.contains('active') || window._maintSection==='parts') renderParts();
      if (document.getElementById('panel-reports')?.classList.contains('active')) renderReports();
      updatePartsAlerts();
    });

    db.collection('dailyCheckins').where('date','==',today).onSnapshot(snap => {
      dailyCheckins = {};
      snap.forEach(d => { dailyCheckins[d.id] = d.data().crew||[]; });
      if (_hideLoadingCalled) refreshCurrentPanel();
    });

    // Staff listener has to fire on the FAST path — its data feeds every
    // name dropdown in the app (WO form, PM complete modal, etc).
    //
    // NOTE: scheduling.js is loaded BEFORE staff.js in index.html, so at
    // the synchronous moment initApp() runs, startStaffListener may not
    // yet be defined. setTimeout(...,0) defers the call to the next tick,
    // by which time ALL <script defer> tags (including staff.js) have
    // executed. This was a real production bug — without this, the Staff
    // panel renders permanently empty.
    setTimeout(() => {
      try {
        if (typeof startStaffListener === 'function') startStaffListener();
        else console.warn('startStaffListener still undefined after tick — script order broken');
      } catch(e) { console.warn('startStaffListener fail:', e); }
    }, 0);

    // ── Background pass: secondary loaders, seeders, panel listeners.
    // Deferred so first paint happens fast. Errors here are non-fatal.
    setTimeout(() => {
      const safeRun = (fn, label) => {
        try {
          const r = fn();
          if (r && typeof r.catch === 'function') r.catch(e => console.warn(label+' bg-fail:', e));
        } catch(e) { console.warn(label+' bg-fail:', e); }
      };

      // Show any orders parked offline + try to send them now that we're up.
      safeRun(() => {
        injectPendingWOs();
        updateOfflineBanner();
        if (!navigator.onLine) setSyncDot('offline');
      }, 'offlineWOInit');
      safeRun(flushOfflineWOs, 'flushOfflineWOs');

      safeRun(loadDowntime, 'loadDowntime');
      safeRun(loadPOCounter, 'loadPOCounter');
      safeRun(loadAssets, 'loadAssets');
      safeRun(loadWI, 'loadWI');
      safeRun(loadCustomParts, 'loadCustomParts');
      safeRun(loadFeedBins, 'loadFeedBins');
      safeRun(loadFeedData, 'loadFeedData');
      safeRun(loadEggByBarn, 'loadEggByBarn');
      safeRun(loadEggQuality, 'loadEggQuality');
      safeRun(loadPkgExtras, 'loadPkgExtras');
      safeRun(loadBioLog, 'loadBioLog');

      safeRun(() => typeof startAssetListener === 'function' && startAssetListener(), 'startAssetListener');
      safeRun(() => typeof startWIListener === 'function' && startWIListener(), 'startWIListener');
      safeRun(() => typeof start5SListener === 'function' && start5SListener(), 'start5SListener');
      safeRun(() => typeof startPartsDefsListener === 'function' && startPartsDefsListener(), 'startPartsDefsListener');
      // Belt-and-suspenders: also try startStaffListener here in case the
      // fast-path setTimeout(0) attempt was skipped or threw silently.
      // startStaffListener itself is idempotent — calling twice is harmless.
      safeRun(() => typeof startStaffListener === 'function' && startStaffListener(), 'startStaffListener-bg');
      safeRun(() => typeof startStaffCertsListener === 'function' && startStaffCertsListener(), 'startStaffCertsListener');
      safeRun(() => typeof startStaffOnboardListener === 'function' && startStaffOnboardListener(), 'startStaffOnboardListener');
      safeRun(() => typeof startOnCallListener === 'function' && startOnCallListener(), 'startOnCallListener');
      safeRun(() => typeof startOnCallSchedListener === 'function' && startOnCallSchedListener(), 'startOnCallSchedListener');
      safeRun(() => typeof startSignoffListener === 'function' && startSignoffListener(), 'startSignoffListener');

      safeRun(async () => {
        if (typeof loadOpsData === 'function') await loadOpsData();
        if (typeof startOpsListeners === 'function') startOpsListeners();
      }, 'opsData');

      safeRun(async () => {
        if (typeof loadDanvilleLoads === 'function') await loadDanvilleLoads();
        if (typeof listenDanvilleLoads === 'function') listenDanvilleLoads();
      }, 'danvilleLoadout');

      // Seeders run last — they write back to Firestore, lowest priority.
      setTimeout(() => {
        safeRun(() => typeof seedStaffRosterIfEmpty === 'function' && seedStaffRosterIfEmpty(), 'seedStaffRoster');
        safeRun(() => typeof assignStaffLocationsIfNeeded === 'function' && assignStaffLocationsIfNeeded(), 'assignStaffLocations');
        safeRun(() => typeof ensureProcessingPMStaff === 'function' && ensureProcessingPMStaff(), 'ensureProcPMStaff');
        safeRun(() => typeof seedMortalityCompostingWI === 'function' && seedMortalityCompostingWI(), 'seedMort');
        safeRun(() => typeof seedWaterRegulatorWI === 'function' && seedWaterRegulatorWI(), 'seedWater');
        safeRun(() => typeof seedAugerRollerWI === 'function' && seedAugerRollerWI(), 'seedAuger');
        safeRun(() => typeof seedCounterCardWI === 'function' && seedCounterCardWI(), 'seedCounter');
        safeRun(() => typeof seedRushtownOpsWI === 'function' && seedRushtownOpsWI(), 'seedOps');
        safeRun(() => typeof assignRHNumbers === 'function' && assignRHNumbers(), 'assignRH');
      }, 2000);
    }, 100);

    setSyncDot('live');
  } catch(err) {
    console.error('initApp failed:', err);
    setMsg('Connection issue — opening anyway…');
    clearTimeout(safetyTimer);
    _hideLoadingScreen();
  }
}

// Re-render whatever panel + sub-section is currently visible. Used by:
//   • the snapshot listeners in initApp() to refresh after Firestore changes
//   • toggleLang() to re-render the visible screen so labels swap on EN/ES
// IMPORTANT: every panel/sub-section the app exposes via go()/goXSection()
// should appear here, otherwise translation toggles don't fully refresh
// dynamic content on those screens.
// ─────────────────────────────────────────────────────────────────────────
// PM PROCEDURE HELPERS
// Merge the PM_DEFS baked-in procedure with any Firestore override saved
// via the "Edit Procedure" mini-modal. Always returns 4 arrays (may be empty).
// ─────────────────────────────────────────────────────────────────────────
function getPMProcedure(t) {
  if (!t) return {safety:[], tools:[], instructions:[], corrective:[]};
  const override = (typeof pmProcedures !== 'undefined' && pmProcedures && pmProcedures[t.defId]) || null;
  const pick = (k) => {
    if (override && Array.isArray(override[k])) return override[k];
    if (t && Array.isArray(t[k])) return t[k];
    return [];
  };
  return {
    safety:       pick('safety'),
    tools:        pick('tools'),
    instructions: pick('instructions'),
    corrective:   pick('corrective')
  };
}

function refreshCurrentPanel() {
  const safe = fn => { try { if (typeof fn === 'function') fn(); } catch(e) { console.warn('refreshCurrentPanel:', e); } };
  const active = tab => document.getElementById('panel-' + tab)?.classList.contains('active');

  if (active('dash'))    { safe(typeof renderDash === 'function' ? renderDash : null); return; }
  if (active('reports')) { safe(typeof renderReports === 'function' ? renderReports : null); return; }

  // Maintenance sub-sections
  if (active('maint')) {
    const s = window._maintSection;
    if      (s==='wo')       safe(typeof renderWO === 'function' ? renderWO : null);
    else if (s==='pm')       safe(typeof renderPM === 'function' ? renderPM : null);
    else if (s==='parts')    safe(typeof renderParts === 'function' ? renderParts : null);
    else if (s==='log')      safe(typeof renderLog === 'function' ? renderLog : null);
    else if (s==='assets')   safe(typeof renderAssets === 'function' ? renderAssets : null);
    else if (s==='wi')       safe(typeof renderWI === 'function' ? renderWI : null);
    else if (s==='5s')       safe(typeof render5S === 'function' ? render5S : null);
    else if (s==='calendar') safe(typeof renderMaintCalendar === 'function' ? renderMaintCalendar : null);
    else if (s==='redtags')  safe(typeof renderRedTags === 'function' ? renderRedTags : null);
    else if (s==='trending') safe(typeof renderTrendingWO === 'function' ? renderTrendingWO : null);
    return;
  }

  // Production — has its own sub-sections via prod-sec-*
  if (active('prod')) {
    safe(typeof renderProdPanel === 'function' ? renderProdPanel : null);
    const ps = window._prodSection;
    if      (ps==='check')   {
      safe(typeof renderProdCheck === 'function' ? renderProdCheck : null);
      safe(typeof renderChecklist === 'function' ? renderChecklist : null);
      safe(typeof renderChecklistDashboard === 'function' ? renderChecklistDashboard : null);
    }
    else if (ps==='mw')      safe(typeof renderProdMW === 'function' ? renderProdMW : null);
    else if (ps==='summary') safe(typeof renderProdSummary === 'function' ? renderProdSummary : null);
    else if (ps==='biosec')  safe(typeof renderProdBiosec === 'function' ? renderProdBiosec : null);
    else if (ps==='mwhistory') safe(typeof renderProdMorningWalks === 'function' ? renderProdMorningWalks : null);
    else if (ps==='bwhistory') safe(typeof renderProdBarnWalks === 'function' ? renderProdBarnWalks : null);
    return;
  }

  // Packaging sub-sections
  if (active('pkg')) {
    const ps = window._pkgSection;
    if      (ps==='packing')    safe(typeof renderPacking === 'function' ? renderPacking : null);
    else if (ps==='cooler')     safe(typeof renderCooler === 'function' ? renderCooler : null);
    else if (ps==='downtime')   safe(typeof renderDowntime === 'function' ? renderDowntime : null);
    else if (ps==='waste')      safe(typeof renderWaste === 'function' ? renderWaste : null);
    else if (ps==='efficiency') safe(typeof renderEfficiency === 'function' ? renderEfficiency : null);
    else if (ps==='eggs')       safe(typeof renderEggByBarn === 'function' ? renderEggByBarn : null);
    else if (ps==='quality')    safe(typeof renderEggQuality === 'function' ? renderEggQuality : null);
    return;
  }

  // Shipping sub-sections
  if (active('ship')) {
    if      (window._shipSection==='shipping')       safe(typeof renderShipping === 'function' ? renderShipping : null);
    else if (window._shipSection==='reconciliation') safe(typeof renderReconciliation === 'function' ? renderReconciliation : null);
    else if (window._shipSection==='exceptions')     safe(typeof renderExceptions === 'function' ? renderExceptions : null);
    return;
  }

  // Feed Mill sub-sections
  if (active('feed')) {
    const fs = window._feedSection;
    if      (fs==='dashboard')   safe(typeof renderFeedDashboard === 'function' ? renderFeedDashboard : null);
    else if (fs==='readings')    safe(typeof renderFeedReadings === 'function' ? renderFeedReadings : null);
    else if (fs==='deliveries')  safe(typeof renderFeedDeliveries === 'function' ? renderFeedDeliveries : null);
    else if (fs==='made')        safe(typeof renderFeedMade === 'function' ? renderFeedMade : null);
    else if (fs==='bins')        safe(typeof renderFeedBinsList === 'function' ? renderFeedBinsList : null);
    else if (fs==='medication')  safe(typeof renderMedicationLog === 'function' ? renderMedicationLog : null);
    else if (fs==='withdrawal')  safe(typeof renderWithdrawalAlerts === 'function' ? renderWithdrawalAlerts : null);
    else if (fs==='consumption') safe(typeof renderConsumptionLog === 'function' ? renderConsumptionLog : null);
    return;
  }

  // KPI sub-sections
  if (active('kpi')) {
    const ks = window._kpiSection;
    if      (ks==='dashboard') safe(typeof renderKpiDashboard === 'function' ? renderKpiDashboard : null);
    else if (ks==='trends')    safe(typeof renderKpiTrends === 'function' ? renderKpiTrends : null);
    else if (ks==='log')       safe(typeof renderKpiLog === 'function' ? renderKpiLog : null);
    else if (ks==='entry')     safe(typeof renderEggByBarn === 'function' ? renderEggByBarn : null);
    return;
  }

  // Single-render panels
  if (active('check'))  {
    safe(typeof renderProdCheck === 'function' ? renderProdCheck : null);
    safe(typeof renderChecklist === 'function' ? renderChecklist : null);
    safe(typeof renderChecklistDashboard === 'function' ? renderChecklistDashboard : null);
    return;
  }
  if (active('mw'))     { safe(typeof renderProdMW === 'function' ? renderProdMW : null); return; }
  if (active('staff'))  { safe(typeof renderStaff === 'function' ? renderStaff : null); return; }
  if (active('sched'))  { safe(typeof renderSchedule === 'function' ? renderSchedule : null); return; }
  if (active('oncall')) { safe(typeof renderOnCallPanel === 'function' ? renderOnCallPanel : null); return; }
  if (active('daily'))  { safe(typeof renderDailyReport === 'function' ? renderDailyReport : null); return; }
  if (active('brief'))  { safe(typeof renderDirectorBrief === 'function' ? renderDirectorBrief : null); return; }
}

// ═══════════════════════════════════════════
// NAVIGATION — plain global function
// ═══════════════════════════════════════════
function go(tab) {
  const fab = document.getElementById('fab-btn');
  // Backward compat aliases
  const maintSections = {wo:'wo', pm:'pm', parts:'parts', log:'log', assets:'assets', wi:'wi', '5s':'5s', calendar:'calendar'};
  if (maintSections[tab] !== undefined) {
    go('maint');
    setTimeout(()=>goMaintSection(tab), 50);
    return;
  }
  if (tab === 'ops') { go('pkg'); return; }
  if (tab === 'wo-submit') {
    go('maint');
    setTimeout(()=>{
      goMaintSection('wo');
      document.getElementById('wo-dash-section').style.display = 'none';
      document.getElementById('wo-submit-section').style.display = 'block';
      if(fab) fab.style.display = 'none';
      const woSubmitBtn = document.querySelector('#wo-form-card .btn-confirm');
      if (woSubmitBtn) { woSubmitBtn.disabled = false; woSubmitBtn.textContent = '✓ SUBMIT WORK ORDER'; }
      // Repopulate name dropdowns from current staff list before showing form.
      if (typeof updateStaffDropdowns === 'function') updateStaffDropdowns();
    }, 50);
    return;
  }
  if(fab) fab.style.display = (tab==='maint') ? '' : 'none';
  closeAssetForm();
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const pm = {dash:'panel-dash', prod:'panel-prod', maint:'panel-maint', pkg:'panel-pkg', feed:'panel-feed', ship:'panel-ship', kpi:'panel-kpi', reports:'panel-reports', sched:'panel-sched', staff:'panel-staff', check:'panel-check', mw:'panel-mw', oncall:'panel-oncall', daily:'panel-daily'};
  const tm = {dash:'tab-dash', prod:'tab-prod', maint:'tab-maint', pkg:'tab-pkg', feed:'tab-feed', ship:'tab-ship', kpi:'tab-kpi', reports:'tab-reports', sched:'tab-sched', staff:'tab-staff', check:'tab-check', mw:'tab-mw', oncall:'tab-oncall', daily:'tab-daily'};
  if (!pm[tab]) return;
  window._activeTab = tab;   // remembered so a location switch can re-render
  document.getElementById(pm[tab]).classList.add('active');
  const tabEl = document.getElementById(tm[tab]);
  if (tabEl) tabEl.classList.add('active');
  if (tab === 'dash')  renderDash();
  if (tab === 'prod')  { renderProdPanel(); goProdSection('overview'); }
  if (tab === 'maint') { goMaintSection(window._maintSection || 'wo'); }
  if (tab === 'pkg')   { if (typeof renderProcessing === 'function') renderProcessing(); else goPkgSection(window._pkgSection || 'packing'); }
  if (tab === 'feed')  { goFeedSection(window._feedSection || 'dashboard'); }
  if (tab === 'ship')  { goShipSection(window._shipSection || 'shipping'); }
  if (tab === 'check') { renderProdCheck(); if (typeof startChecklistDashboard==='function') startChecklistDashboard(); if (typeof loadWI==='function') loadWI(); }
  if (tab === 'mw')    renderProdMW();
  if (tab === 'kpi')   { goKpiSection(window._kpiSection || 'dashboard'); }
  if (tab === 'reports') renderReports();
  if (tab === 'sched')   loadSchedule();
  if (tab === 'staff')   { if (typeof syncStaffFarmToActive === 'function') syncStaffFarmToActive(); renderStaff(); }
  if (tab === 'oncall')  renderOnCallPanel();
  if (tab === 'daily')   { if (typeof renderDailyReport === 'function') renderDailyReport(); }
}

// ═══════════════════════════════════════════
// DATE UTILS
// ═══════════════════════════════════════════
function daysAgo(str) {
  if (!str) return 9999;
  const d = new Date(str); d.setHours(0,0,0,0);
  return Math.floor((TODAY - d) / 86400000);
}
function pmStatus(id) {
  const t = ALL_PM.find(x => x.id === id);
  // Defensive: a missing task or an unknown frequency must never throw —
  // a single bad record used to crash the whole PM list and the bulk modal.
  if (!t) { console.warn('[pmStatus] no PM task for id', id); return 'ok'; }
  const freqDef = FREQ[t.freq];
  if (!freqDef) { console.warn('[pmStatus] unknown freq', t.freq, 'on', id); return 'ok'; }
  const c = pmComps[id];
  const days = freqDef.days;
  if (!c) return 'overdue';
  // If completed today, always show as OK regardless of frequency
  if (c.date === todayStr) return 'ok';
  const ago = daysAgo(c.date);
  if (ago >= days) return 'overdue';
  if (ago >= days * 0.75) return 'due-soon';
  return 'ok';
}
function nextDueLabel(id) {
  const t = ALL_PM.find(x => x.id === id);
  const c = pmComps[id];
  if (!c) return 'Never done';
  if (!t || !FREQ[t.freq]) return '—';
  const next = new Date(c.date); next.setDate(next.getDate() + FREQ[t.freq].days);
  const diff = Math.floor((next - TODAY) / 86400000);
  if (diff < 0) return Math.abs(diff) + 'd overdue';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return 'Due in ' + diff + 'd';
}
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function doneToday(id) { return pmComps[id] && pmComps[id].date === todayStr; }
function sc(cls, num, lbl) {
  return `<div class="stat-card ${cls}"><div class="stat-num">${num}</div><div class="stat-label">${lbl}</div></div>`;
}

// ═══════════════════════════════════════════
