// ═══════════════════════════════════════════════════════════════════════════
// housestatus.js — Self-serve "House Down" toggle  (EN/ES)
// Management flips a house DOWN (rebuild / out of service) or back online with
// no code change. Writes settings/downHouses, which core.js reads live via
// isHouseDown(). A house marked down stops generating work orders, drops out of
// completion / daily tracking + the WO house dropdown, and its OPEN work orders
// are closed automatically. Opened from a 🏚 House Status button.
// ═══════════════════════════════════════════════════════════════════════════
function _hsLang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
function hsL(en, es) { return _hsLang() === 'es' ? es : en; }
const HS_HOUSES = { Hegins: [1, 2, 3, 4, 5, 6, 7, 8], Danville: [1, 2, 3, 4, 5] };

function _hsDownList(farm) {
  var src = (typeof _downHousesLive === 'object' && _downHousesLive) ? _downHousesLive : (typeof DOWN_HOUSES !== 'undefined' ? DOWN_HOUSES : {});
  return Array.isArray(src[farm]) ? src[farm].map(String) : [];
}
function _hsIsDown(farm, h) { return _hsDownList(farm).indexOf(String(h)) !== -1; }

function openHouseStatus() {
  var ov = document.getElementById('housestatus-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'housestatus-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:950;background:#0a140a;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    document.body.appendChild(ov);
  }
  ov.style.display = 'block';
  renderHouseStatus();
  try { window.scrollTo(0, 0); } catch (e) {}
}
function closeHouseStatus() { var ov = document.getElementById('housestatus-overlay'); if (ov) ov.style.display = 'none'; }

function renderHouseStatus() {
  var ov = document.getElementById('housestatus-overlay');
  if (!ov) return;
  var body = '';
  ['Hegins', 'Danville'].forEach(function (farm) {
    var rows = HS_HOUSES[farm].map(function (h) {
      var down = _hsIsDown(farm, h);
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;border-bottom:1px solid #163016;">' +
        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:700;color:' + (down ? '#f8a4a4' : '#e8f5ec') + ';">🏚 ' + hsL('House', 'Casa') + ' ' + h + (down ? ' · ' + hsL('DOWN', 'FUERA') : '') + '</span>' +
        '<button onclick="houseToggleDown(\'' + farm + '\',' + h + ')" style="padding:10px 14px;border-radius:9px;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;' + (down ? 'background:#3a1010;border:1.5px solid #7f1d1d;color:#f8b4b4;' : 'background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;') + '">' + (down ? ('↩ ' + hsL('Bring back', 'Reactivar')) : ('⏸ ' + hsL('Mark down', 'Marcar fuera'))) + '</button>' +
      '</div>';
    }).join('');
    body += '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:2px;color:#7ab07a;text-transform:uppercase;margin:16px 0 6px;">📍 ' + farm + '</div>' +
      '<div style="background:#0f2410;border:1.5px solid #2a5a2a;border-radius:12px;overflow:hidden;">' + rows + '</div>';
  });
  ov.innerHTML =
    '<div style="max-width:640px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 30px) 14px 40px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<button onclick="closeHouseStatus()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;">← ' + hsL('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;"><div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;color:#f0ead8;letter-spacing:2px;line-height:1;">🏚 ' + hsL('HOUSE STATUS', 'ESTADO DE CASAS') + '</div></div>' +
      '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#9ab09a;line-height:1.5;background:#0d1f0d;border:1px solid #1e3a1e;border-radius:10px;padding:10px 12px;margin:8px 0 8px;">' + hsL('Mark a house <b style="color:#f8b4b4;">down</b> while it&rsquo;s being rebuilt — it stops making work orders and drops out of daily tracking, and its open work orders are closed. <b style="color:#86efac;">Bring it back</b> when it&rsquo;s ready.', 'Marca una casa <b style="color:#f8b4b4;">fuera</b> mientras se reconstruye — deja de generar órdenes y sale del seguimiento diario, y sus órdenes abiertas se cierran. <b style="color:#86efac;">Reactívala</b> cuando esté lista.') + '</div>' +
      body +
    '</div>';
}

async function houseToggleDown(farm, house) {
  var list = _hsDownList(farm);
  var h = String(house);
  var idx = list.indexOf(h);
  var nowDown;
  if (idx === -1) { list.push(h); nowDown = true; } else { list.splice(idx, 1); nowDown = false; }
  var update = {}; update[farm] = list;
  try {
    if (typeof setSyncDot === 'function') setSyncDot('saving');
    await db.collection('settings').doc('downHouses').set(update, { merge: true });
    if (nowDown) await _hsCloseOpenWOs(farm, h);
    if (typeof setSyncDot === 'function') setSyncDot('live');
    if (typeof toast === 'function') toast(nowDown ? (hsL('House', 'Casa') + ' ' + h + ' · ' + farm + ' ' + hsL('marked down', 'marcada fuera')) : (hsL('House', 'Casa') + ' ' + h + ' · ' + farm + ' ' + hsL('back online', 'reactivada')));
  } catch (e) {
    console.error('houseToggleDown:', e);
    alert('Could not update: ' + (e && e.message ? e.message : e));
    if (typeof setSyncDot === 'function') setSyncDot('live');
  }
}

async function _hsCloseOpenWOs(farm, house) {
  try {
    var wos = (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) ? workOrders : [];
    var date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var hn = String(house).replace(/^\s*house\s*/i, '').trim();
    var batch = db.batch(); var n = 0;
    wos.forEach(function (w) {
      if (w && w._fbId && (w.status === 'open' || w.status === 'in-progress') && w.farm === farm && String(w.house).replace(/^\s*house\s*/i, '').trim() === hn) {
        batch.update(db.collection('workOrders').doc(w._fbId), { status: 'completed', completedBy: 'System', completedDate: date, completedNotes: 'Auto-closed — house down for rebuild', actionRail: false, ts: Date.now() });
        n++;
      }
    });
    if (n) await batch.commit();
  } catch (e) { console.warn('_hsCloseOpenWOs:', e); }
}

if (typeof window !== 'undefined') {
  window.openHouseStatus = openHouseStatus;
  window.closeHouseStatus = closeHouseStatus;
  window.renderHouseStatus = renderHouseStatus;
  window.houseToggleDown = houseToggleDown;
}
