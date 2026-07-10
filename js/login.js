// ═══════════════════════════════════════════════════════════════════════════
// login.js — per-device staff login with a 4-digit PIN (v195)
// One device per person: you log in once (name + PIN), the device stays signed
// in, and every check/walk/WO is auto-stamped with you. PIN stops someone
// posting as someone else. No email (farm staff have none) — name + PIN only.
//
// FAIL-OPEN BY DESIGN: this is a full-screen overlay laid ON TOP of the app. If
// the roster can't load, or anything errors, the gate quietly steps aside so a
// bug here can NEVER brick the fleet. The app underneath is always functional.
//
// PIN storage: a `pin` field on the staff doc (plain, like the existing admin
// PIN) — a light gate against mis-attribution, not bank security.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  var LKEY = 'deviceUser';          // existing localStorage key (core.js getDeviceUser)
  var VKEY = 'loginVerified';       // '1' once this device completed a PIN login
  var _pin = '';                    // PIN pad buffer
  var _stage = 'name';              // 'name' | 'pin' | 'setpin' | 'confirmpin'
  var _who = null;                  // chosen staff record
  var _firstPin = '';               // for set-PIN confirm

  function _es() { return (typeof _lang !== 'undefined' && _lang === 'es'); }
  function L(en, es) { return _es() ? es : en; }

  // Roster scoped to this device's plant (barn crew + leaders + Both), active only.
  function _roster() {
    try {
      if (typeof staffList === 'undefined' || !Array.isArray(staffList)) return [];
      var loc = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
      var list = (typeof staffAtLocation === 'function') ? staffAtLocation(loc) : staffList.filter(function (s) { return s && s.active !== false; });
      return list.filter(function (s) { return s && s.name; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    } catch (e) { return []; }
  }

  function _staffByName(name) {
    if (typeof staffList === 'undefined' || !Array.isArray(staffList)) return null;
    var n = String(name || '').trim().toLowerCase();
    for (var i = 0; i < staffList.length; i++) { var s = staffList[i]; if (s && s.name && String(s.name).trim().toLowerCase() === n) return s; }
    return null;
  }

  // ── Public identity helpers ────────────────────────────────────────────────
  window.setDeviceUser = function (name) {
    try { localStorage.setItem(LKEY, String(name || '').trim()); localStorage.setItem(VKEY, '1'); } catch (e) {}
    try { _stampNameFields(); } catch (e) {}
    try { if (typeof renderLoginChip === 'function') renderLoginChip(); } catch (e) {}
    try { if (typeof applyAccessPicker === 'function') applyAccessPicker(); } catch (e) {}
  };
  window.signOutDevice = function () {
    try { localStorage.removeItem(VKEY); } catch (e) {}
    // keep the name as a hint but force a fresh PIN login
    _stage = 'name'; _pin = ''; _who = null; _firstPin = '';
    openLoginGate();
  };
  window.isLoggedIn = function () { try { return localStorage.getItem(VKEY) === '1' && !!(localStorage.getItem(LKEY) || '').trim(); } catch (e) { return false; } };

  // Auto-stamp the logged-in person onto EVERY name field, app-wide, so their
  // name is first on everything (daily walks, checks, manure, PM, etc.) without
  // typing. Covers name text-inputs (any staff datalist) AND name dropdowns
  // (wo-tech/bulk-tech/etc.) — for a dropdown, adds the person as an option if
  // needed and selects it. Only fills BLANK fields, so a deliberate change on a
  // shared entry is respected; runs on a light interval to catch fields that are
  // populated dynamically (e.g. the WO name list after a location is picked).
  // NOTE: work-order name fields (wo-*, qwo-*) are intentionally EXCLUDED — WOs are
  // often filed on behalf of someone else, so those stay a manual pick (per Joe).
  var NAME_SELECT_IDS = ['bulk-tech', 'cl-worker', 'mw-employee', 'pm-tech'];
  function _stampNameFields() {
    var u = (typeof getDeviceUser === 'function') ? getDeviceUser() : '';
    if (!u) return;
    try {
      document.querySelectorAll('input[list*="staff-datalist"]').forEach(function (el) {
        if (!el || el.value) return;
        if (/^q?wo-/.test(el.id || '')) return;   // skip Work Order name fields
        el.value = u;
      });
      NAME_SELECT_IDS.forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel || sel.tagName !== 'SELECT' || sel.value) return;
        var has = Array.prototype.some.call(sel.options, function (o) { return o.value === u; });
        if (!has) { var o = document.createElement('option'); o.value = u; o.textContent = u; sel.appendChild(o); }
        sel.value = u;
      });
    } catch (e) {}
  }
  window.stampUser = _stampNameFields;
  // Keep name fields stamped for logged-in users (catches dynamically-built pickers).
  setInterval(function () { try { if (window.isLoggedIn && window.isLoggedIn()) _stampNameFields(); } catch (e) {} }, 1500);

  // ── The gate overlay ────────────────────────────────────────────────────────
  function _overlay() {
    var ov = document.getElementById('login-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'login-overlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:12000;background:#08120a;display:none;overflow-y:auto;-webkit-overflow-scrolling:touch;';
      document.body.appendChild(ov);
    }
    return ov;
  }

  function openLoginGate() {
    var ov = _overlay();
    ov.style.display = 'block';
    _render();
  }
  window.openLoginGate = openLoginGate;

  function _closeGate() {
    var ov = document.getElementById('login-overlay');
    if (ov) ov.style.display = 'none';
  }

  function _render() {
    var ov = _overlay();
    var body = '';
    if (_stage === 'name') {
      var r = _roster();
      var opts = r.map(function (s) {
        var nm = String(s.name).replace(/"/g, '&quot;');
        var pinSet = s.pin ? '' : ' • ' + L('set PIN', 'crear PIN');
        return '<button onclick="_loginPick(\'' + nm.replace(/'/g, "\\'") + '\')" style="display:block;width:100%;text-align:left;padding:14px 16px;margin-bottom:8px;background:#0f1f0f;border:1.5px solid #2a5a2a;border-radius:12px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:700;cursor:pointer;">' + nm + '<span style="color:#7a9a7a;font-size:11px;font-weight:400;">' + pinSet + '</span></button>';
      }).join('');
      if (!r.length) opts = '<div style="color:#c9a86a;font-family:\'IBM Plex Mono\',monospace;font-size:13px;text-align:center;padding:20px;">' + L('Loading staff…', 'Cargando personal…') + '</div>';
      body =
        '<div style="text-align:center;margin-bottom:18px;">' +
          '<div style="font-size:40px;line-height:1;">🐔</div>' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:30px;color:#f0ead8;letter-spacing:2px;margin-top:6px;">' + L('WHO ARE YOU?', '¿QUIÉN ERES?') + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#7ab07a;margin-top:4px;">' + L('Tap your name to sign in on this device', 'Toca tu nombre para entrar en este dispositivo') + '</div>' +
        '</div>' +
        '<input id="login-search" type="text" oninput="_loginFilter(this.value)" placeholder="' + L('Search your name…', 'Busca tu nombre…') + '" autocomplete="off" style="width:100%;box-sizing:border-box;background:#0a160a;border:1.5px solid #2a5a2a;border-radius:10px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:15px;padding:12px 14px;margin-bottom:12px;">' +
        '<div id="login-roster">' + opts + '</div>';
    } else {
      var isSet = (_stage === 'setpin' || _stage === 'confirmpin');
      var title = _stage === 'confirmpin' ? L('Re-enter your PIN', 'Repite tu PIN')
                : isSet ? L('Create a 4-digit PIN', 'Crea un PIN de 4 dígitos')
                : L('Enter your PIN', 'Ingresa tu PIN');
      var dots = '';
      for (var i = 0; i < 4; i++) dots += '<span style="width:16px;height:16px;border-radius:50%;margin:0 7px;display:inline-block;background:' + (i < _pin.length ? '#4ade80' : 'transparent') + ';border:2px solid ' + (i < _pin.length ? '#4ade80' : '#3a5a3a') + ';"></span>';
      var pad = '';
      [['1','2','3'],['4','5','6'],['7','8','9'],['←','0','✓']].forEach(function (row) {
        pad += '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:12px;">';
        row.forEach(function (k) {
          var act = k === '←' ? '_loginPinDel()' : k === '✓' ? '_loginPinGo()' : "_loginPinTap('" + k + "')";
          var col = (k === '✓') ? '#14532d' : (k === '←' ? '#1a0f0f' : '#0f1f0f');
          var bd  = (k === '✓') ? '#2a7a3a' : (k === '←' ? '#5a2a2a' : '#2a5a2a');
          var cl  = (k === '✓') ? '#86efac' : '#eafff0';
          pad += '<button onclick="' + act + '" style="width:74px;height:64px;background:' + col + ';border:1.5px solid ' + bd + ';border-radius:14px;color:' + cl + ';font-family:\'IBM Plex Mono\',monospace;font-size:24px;font-weight:700;cursor:pointer;">' + k + '</button>';
        });
        pad += '</div>';
      });
      body =
        '<div style="text-align:center;">' +
          '<button onclick="_loginBack()" style="float:left;padding:9px 14px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;">← ' + L('Back', 'Atrás') + '</button>' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;color:#f0ead8;letter-spacing:2px;padding-top:4px;">' + (_who ? String(_who.name) : '') + '</div>' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:#7ab07a;margin:6px 0 18px;">' + title + '</div>' +
          '<div style="margin-bottom:22px;">' + dots + '</div>' +
          '<div id="login-pin-err" style="color:#f2705a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;min-height:16px;margin-bottom:12px;"></div>' +
          pad +
        '</div>';
    }
    ov.innerHTML = '<div style="max-width:420px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 34px) 18px 40px;">' + body + '</div>';
    var srch = document.getElementById('login-search'); if (srch) setTimeout(function () { try { srch.focus(); } catch (e) {} }, 60);
  }

  window._loginFilter = function (q) {
    q = String(q || '').trim().toLowerCase();
    var r = _roster().filter(function (s) { return !q || String(s.name).toLowerCase().indexOf(q) !== -1; });
    var host = document.getElementById('login-roster'); if (!host) return;
    host.innerHTML = r.map(function (s) {
      var nm = String(s.name).replace(/"/g, '&quot;');
      var pinSet = s.pin ? '' : ' • ' + L('set PIN', 'crear PIN');
      return '<button onclick="_loginPick(\'' + nm.replace(/'/g, "\\'") + '\')" style="display:block;width:100%;text-align:left;padding:14px 16px;margin-bottom:8px;background:#0f1f0f;border:1.5px solid #2a5a2a;border-radius:12px;color:#eafff0;font-family:\'IBM Plex Mono\',monospace;font-size:15px;font-weight:700;cursor:pointer;">' + nm + '<span style="color:#7a9a7a;font-size:11px;font-weight:400;">' + pinSet + '</span></button>';
    }).join('');
  };

  window._loginPick = function (name) {
    _who = _staffByName(name);
    if (!_who) { _who = { name: name }; }
    _pin = ''; _firstPin = '';
    _stage = _who.pin ? 'pin' : 'setpin';
    _render();
  };
  window._loginBack = function () { _stage = 'name'; _pin = ''; _firstPin = ''; _who = null; _render(); };
  window._loginPinTap = function (d) { if (_pin.length < 4) { _pin += d; _render(); if (_pin.length === 4) setTimeout(_loginPinGo, 120); } };
  window._loginPinDel = function () { _pin = _pin.slice(0, -1); _render(); };

  function _err(msg) { var e = document.getElementById('login-pin-err'); if (e) e.textContent = msg || ''; }

  window._loginPinGo = function () {
    if (_pin.length !== 4) { _err(L('Enter 4 digits', 'Ingresa 4 dígitos')); return; }
    if (_stage === 'setpin') { _firstPin = _pin; _pin = ''; _stage = 'confirmpin'; _render(); return; }
    if (_stage === 'confirmpin') {
      if (_pin !== _firstPin) { _pin = ''; _firstPin = ''; _stage = 'setpin'; _render(); _err(L('PINs didn\'t match — try again', 'Los PIN no coinciden — reinténtalo')); return; }
      // Save the new PIN to the staff doc, then sign in.
      _savePin(_who, _firstPin, function (ok) {
        if (ok) { window.setDeviceUser(_who.name); _closeGate(); }
        else _err(L('Could not save PIN — check connection', 'No se pudo guardar el PIN — revisa la conexión'));
      });
      return;
    }
    // verify
    if (String(_who.pin) === _pin) { window.setDeviceUser(_who.name); _closeGate(); }
    else { _pin = ''; _render(); _err(L('Wrong PIN', 'PIN incorrecto')); }
  };

  function _savePin(staff, pin, cb) {
    try {
      if (staff && staff._fbId && typeof db !== 'undefined' && db) {
        db.collection('staff').doc(staff._fbId).update({ pin: pin }).then(function () { staff.pin = pin; cb(true); }).catch(function () { cb(false); });
      } else { if (staff) staff.pin = pin; cb(true); }   // fail-open: still sign in
    } catch (e) { cb(true); }
  }

  // ── "Signed in as" chip + sign-out ──────────────────────────────────────────
  window.renderLoginChip = function () {
    try {
      var u = (typeof getDeviceUser === 'function') ? getDeviceUser() : '';
      var chip = document.getElementById('login-chip');
      if (!u || !(window.isLoggedIn && window.isLoggedIn())) { if (chip) chip.style.display = 'none'; return; }
      if (!chip) {
        chip = document.createElement('div');
        chip.id = 'login-chip';
        chip.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9000;background:#0f1f0f;border:1.5px solid #2a5a2a;border-radius:50px;padding:7px 12px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);';
        // Two-tap (confirm() is a no-op in the PWA): first tap arms, second within
        // 3s signs out. Prevents an accidental tap from logging someone out.
        chip._armed = 0;
        chip.onclick = function () {
          if (Date.now() < chip._armed) { chip._armed = 0; window.signOutDevice(); return; }
          chip._armed = Date.now() + 3000;
          var nm = (typeof getDeviceUser === 'function') ? getDeviceUser() : '';
          chip.textContent = L('Tap again to sign out', 'Toca otra vez para salir');
          setTimeout(function () { if (Date.now() >= chip._armed) window.renderLoginChip(); }, 3100);
        };
        document.body.appendChild(chip);
      }
      if (!chip._armed || Date.now() >= chip._armed) chip.textContent = '👤 ' + u.split(' ')[0] + ' · ' + L('sign out', 'salir');
      chip.style.display = 'block';
    } catch (e) {}
  };

  // ── Roster-wait gate — fail-open ────────────────────────────────────────────
  // Wait for the roster; if it never comes, DON'T block the app.
  function _gateFlow(tries) {
    tries = tries || 0;
    try {
      if (window.isLoggedIn && window.isLoggedIn()) { _stampNameFields(); try { window.renderLoginChip(); } catch (e) {} return; }   // already signed in
      var r = _roster();
      if (r.length) { openLoginGate(); return; }
      if (tries < 16) { setTimeout(function () { _gateFlow(tries + 1); }, 500); return; } // ~8s
      // Roster never loaded → fail open (no gate). App stays usable.
    } catch (e) { /* never brick */ }
  }

  // ── REMOTE KILL-SWITCH ───────────────────────────────────────────────────────
  // The login gate only activates when settings/loginConfig.enabled === true in
  // Firestore. Default (no doc) = OFF, so shipping this build changes NOTHING
  // until Joe flips it on — and flipping it back off recovers every device on the
  // next load with NO redeploy. Set localStorage.loginPreview='1' to test the gate
  // on your own device without enabling it for the fleet.
  function _bootGate() {
    try {
      var preview = false; try { preview = localStorage.getItem('loginPreview') === '1'; } catch (e) {}
      if (preview) { _gateFlow(0); return; }
      if (typeof db === 'undefined' || !db) { return; }   // no db → never gate
      db.collection('settings').doc('loginConfig').get().then(function (doc) {
        var on = doc && doc.exists && doc.data() && doc.data().enabled === true;
        if (on) { _gateFlow(0); }
        else if (window.isLoggedIn && window.isLoggedIn()) { _stampNameFields(); try { window.renderLoginChip(); } catch (e) {} }
      }).catch(function () { /* can't read config → fail open, no gate */ });
    } catch (e) { /* never brick */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(_bootGate, 1500); });
  else setTimeout(_bootGate, 1500);
})();
