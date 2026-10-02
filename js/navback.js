// ═══════════════════════════════════════════════════════════════════════════
// navback.js — BACK that goes to the screen you were just on (v313, per Joe
// 10/1: "i dont like the back button. have issues with going to the prior
// screen. dont like how the tabs at the bottom are in the way of the screen").
//
// What was wrong (seen live on a phone + iPad as Joe, 10/1):
//  • Back from ANY app screen called goHome(), which lands on "Select a
//    location" — so Maintenance → Back skipped the Hegins home you came from.
//  • Device Back only knew 9 overlays. Every other full-screen layer (Daily
//    Employee Check, the barn check form, Morning Walk, Bird Health, Tier 1/2,
//    Shift Board …) was invisible to it, so Back jumped "home" from inside them.
//  • On phones the header had no Back and no Home (only the logo).
//  • Four floating pills (Bird Health / Master / Usage / sign out) and the
//    Quick WO button sat on top of buttons and cards on every screen.
//
// How it works now:
//  1. A small STACK of base screens — the location picker, a site's home, an
//     app panel (Maintenance, Production …) — records where you have been.
//     Back pops to the previous one. Going to a screen already in the stack
//     cuts the stack there, so Back never loops.
//  2. Before that, Back closes the TOPMOST full-screen layer by pressing that
//     layer's OWN Back / ✕ button, so each screen's own logic runs (the Daily
//     Check steps back from a house to the farm list, the barn check saves
//     before closing, …). Any layer is found generically — no list to forget.
//  3. One Back button in the header (every screen size) and the device/browser
//     Back both use this. ⌂ Home = this site's home; 📍 chip = switch location.
//  4. The four pills fold into ONE 👤 menu at the top; Quick WO hides while
//     you scroll down; the panels get bottom padding so nothing is covered.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function _nbL(en, es) { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; } catch (e) { return en; } }

  // ── 1. FULL-SCREEN LAYERS (overlays, forms, boards) ───────────────────────
  // Never "backed out of": the sign-in gate, boot splash, status bars.
  var SKIP = { 'login-overlay': 1, 'loading-screen': 1, 'splash': 1, 'splash-screen': 1, 'offline-banner': 1, 'sw-update-bar': 1, 'me-menu': 1 };
  // Fallback close functions when a layer has no Back/✕ button of its own.
  var CLOSE_MAP = {
    'fortune-overlay': 'closeFortune', 'pm-modal': 'closePMModal', 'bulk-pm-modal': 'closeBulkPM',
    'manure-overlay': 'closeManure', 'completion-overlay': 'closeCompletion', 'scorecard-overlay': 'closeScorecard',
    'help-overlay': 'closeHelp', 'staff-edit-modal': 'closeStaffEdit', 'housestatus-overlay': 'closeHouseStatus',
    'barn-walk-modal': 'closeBarnWalk', 'morning-walk-modal': 'closeMorningWalk', 'ec-section': 'ecBack',
    'mw-section': 'mwBack', 'bio-section': 'closeBioSection', 'flock-section': 'closeFlockSection',
    'egg-trends-overlay': 'closeEggTrends', 'bw-history-overlay': 'closeBarnWalkHistory', 'ops-overlay': 'closeOperations',
    'bh-overlay': 'closeBirdHealth', 'livemonitor-overlay': 'closeLiveMonitor', 'bw-choice-overlay': '_bwChoiceClose'
  };
  // A button whose onclick calls one of these is never pressed by Back.
  var DENY = /closeGate|closeDownHouse|closeTopLayer|signOut|delete|remove|submit|complete|save|mark/i;
  var ONCLICK_OK = /^\s*(?:return\s+)?(close[A-Z]\w*|[a-z]\w*Back|_bwChoiceClose|exitToHome)\s*\([^)]*\)\s*;?\s*$/;
  var TXT_BACK = /^\s*[←⬅‹]/;
  var TXT_X = /^\s*[✕×✖⨯]\s*(close|exit|cancel|cerrar|salir|cancelar)?\s*$/i;
  var TXT_WORD = /^\s*(back|close|cancel|exit|atrás|atras|cerrar|cancelar|salir|volver)\s*$/i;

  function _shown(el) {
    try {
      if (!el || !el.getClientRects || !el.getClientRects().length) return false;
      var cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    } catch (e) { return false; }
  }
  function _layers() {
    var seen = [], out = [];
    var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    var cands = Array.prototype.slice.call(document.body ? document.body.children : []);
    try {
      Array.prototype.forEach.call(document.querySelectorAll('[id$="-overlay"],[id$="-modal"],[id$="-section"],.overlay'), function (el) {
        if (cands.indexOf(el) < 0) cands.push(el);
      });
    } catch (e) {}
    cands.forEach(function (el, i) {
      if (!el || seen.indexOf(el) >= 0) return; seen.push(el);
      if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) return;
      if (el.id && SKIP[el.id]) return;
      var cs; try { cs = getComputedStyle(el); } catch (e) { return; }
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
      if (Number(cs.opacity) === 0 || cs.pointerEvents === 'none') return;   // decorative (confetti …)
      var r = el.getBoundingClientRect();
      if (r.width < vw * 0.6 || r.height < vh * 0.5) return;               // chips, toasts, banners
      out.push({ el: el, z: parseInt(cs.zIndex, 10) || 0, i: i });
    });
    out.sort(function (a, b) { return (b.z - a.z) || (b.i - a.i); });
    return out;
  }
  function _closeBtn(layer) {
    var btns; try { btns = layer.querySelectorAll('button,[role="button"],a[onclick]'); } catch (e) { return null; }
    var byClick = null, byBack = null, byX = null, byWord = null;
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.disabled || !_shown(b)) continue;
      var oc = (b.getAttribute && b.getAttribute('onclick')) || '';
      if (oc && DENY.test(oc) && !ONCLICK_OK.test(oc)) continue;
      var t = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if (!byClick && oc && ONCLICK_OK.test(oc) && !DENY.test(oc.replace(/^\s*(?:return\s+)?\w+/, ''))) {
        // header-style buttons (← / ✕ / words) win over a "Cancel" at the foot of a form
        if (TXT_BACK.test(t) || TXT_X.test(t) || TXT_WORD.test(t) || t.length <= 14) byClick = b;
      }
      if (!byBack && TXT_BACK.test(t)) byBack = b;
      if (!byX && TXT_X.test(t)) byX = b;
      if (!byWord && TXT_WORD.test(t)) byWord = b;
    }
    // the layer's own close/back function first, then ← / ✕ / plain words
    return byClick || byBack || byX || byWord;
  }
  function _closeLayer(el) {
    var b = _closeBtn(el);
    if (b) { try { b.click(); return true; } catch (e) {} }
    var fn = el.id && CLOSE_MAP[el.id];
    if (fn && typeof window[fn] === 'function') { try { window[fn](); return true; } catch (e) {} }
    // Class-based modals: drop 'open' and CLEAR inline display (never set
    // display:none inline on a .overlay — it could never reopen; v190 lesson).
    if (el.classList && el.classList.contains('overlay')) { el.classList.remove('open'); el.style.display = ''; return true; }
    el.style.display = 'none';
    return true;
  }
  function _closeTopLayer() {
    var L = _layers();
    if (!L.length) return false;
    return _closeLayer(L[0].el);
  }
  function _loginUp() { var g = $('login-overlay'); return !!(g && _shown(g) && getComputedStyle(g).position === 'fixed'); }

  // ── 2. BASE SCREENS + STACK ───────────────────────────────────────────────
  var _stack = [];          // [{k:'picker'} | {k:'home',loc} | {k:'tab',tab,loc}]
  var _silent = false;      // true while Back is restoring a screen (don't record)
  function _loc() { try { return (typeof getActiveLocation === 'function') ? getActiveLocation() : ''; } catch (e) { return ''; } }
  function _vis(el) { return !!el && el.style.display !== 'none'; }
  function _cur() {
    var ls = $('landing-screen'), mc = $('main-content');
    if (mc && _vis(mc) && (!ls || ls.style.display === 'none')) return { k: 'tab', tab: window._activeTab || 'dash', loc: _loc() };
    var home = $('loc-home');
    if (home && _vis(home)) return { k: 'home', loc: _loc() };
    return { k: 'picker' };
  }
  function _key(s) { return s ? (s.k + ':' + (s.tab || '') + ':' + (s.k === 'picker' ? '' : (s.loc || ''))) : ''; }
  function _record() {
    if (_silent) return;
    try {
      var c = _cur(), k = _key(c);
      for (var i = _stack.length - 1; i >= 0; i--) {
        if (_key(_stack[i]) === k) { _stack.length = i + 1; return; }   // been here → cut back to it
      }
      _stack.push(c);
      if (_stack.length > 30) _stack.splice(0, _stack.length - 30);
    } catch (e) {}
    // Back at the picker lets the device leave (nothing armed). If the crew then
    // goes back INTO the app, arm again — otherwise the very next Back would
    // exit the app from deep inside it.
    if (!_armed && _key(_cur()) !== 'picker::') _arm();
  }
  function _showLanding() {
    // goHome() does every bit of landing clean-up (overlays, scroll-lock, app
    // chrome, Quick WO button) and lands on the picker.
    if (typeof window.goHome === 'function') window.goHome();
  }
  function _restore(s) {
    _silent = true;
    try {
      if (s.k === 'picker') _showLanding();
      else if (s.k === 'home') {
        _showLanding();
        if (typeof window.openLocationHome === 'function') window.openLocationHome(s.loc || _loc());
      } else if (s.k === 'tab') {
        if (s.loc && s.loc !== _loc() && typeof setActiveLocation === 'function') { try { setActiveLocation(s.loc); } catch (e) {} }
        if (typeof window.enterApp === 'function') window.enterApp(s.tab);
        else if (typeof window.go === 'function') window.go(s.tab);
      }
    } catch (e) { console.warn('nav restore:', e); }
    _silent = false;
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  // ⌂ Home = THIS site's home (Hegins / Danville / Master) — not the picker.
  function goSiteHome() {
    _meClose();
    _showLanding();
    if (typeof window.openLocationHome === 'function') window.openLocationHome(_loc());
    _record();
  }

  // ── 3. BACK ───────────────────────────────────────────────────────────────
  function appGoBack() {
    // Always release a scroll-lock a modal may have left on, so going Back
    // never leaves the page frozen.
    try { document.body.style.overflow = ''; } catch (e) {}
    if (_meClose()) return true;
    var np = $('notif-panel'); if (np && np.style.display !== 'none' && np.style.display !== '') { np.style.display = 'none'; return true; }
    if (_loginUp()) return true;                       // stay on the sign-in gate
    if (_closeTopLayer()) return true;
    // No layer open → previous base screen.
    var c = _cur(), k = _key(c);
    if (!_stack.length || _key(_stack[_stack.length - 1]) !== k) _record();
    if (_stack.length >= 2) {
      _stack.pop();
      _restore(_stack[_stack.length - 1]);
      return true;
    }
    // Nothing recorded (fresh boot) → the screen's natural parent.
    if (c.k === 'tab') { _restore({ k: 'home', loc: c.loc }); _stack = [{ k: 'picker' }, { k: 'home', loc: c.loc }]; return true; }
    if (c.k === 'home') { _restore({ k: 'picker' }); _stack = [{ k: 'picker' }]; return true; }
    return false;                                      // at the picker → let the device exit
  }

  // Wrap the screen-changing functions so every visit is recorded. Other
  // modules wrap some of these too (access.js, usage.js); wrappers compose.
  function _wrap(name) {
    var f = window[name];
    if (typeof f !== 'function' || f.__nav) return;
    var w = function () { var r = f.apply(this, arguments); _record(); return r; };
    w.__nav = true;
    try { Object.keys(f).forEach(function (p) { if (!(p in w)) w[p] = f[p]; }); } catch (e) {}
    window[name] = w;
  }
  function _wrapAll() { ['go', 'enterApp', 'goHome', 'openLocationHome', 'showLocationPicker'].forEach(_wrap); }

  // Device / browser Back: keep one history entry armed; every Back re-arms.
  var _armed = false;
  function _arm() { try { history.pushState({ rt: Date.now() }, ''); _armed = true; } catch (e) {} }
  window.addEventListener('popstate', function () {
    _armed = false;
    if (appGoBack()) _arm();   // handled in-app → re-arm so the next Back is caught too
  });

  // ── 4. 👤 MENU — replaces the four floating pills at the bottom ───────────
  function _me() { try { return (typeof getDeviceUser === 'function') ? String(getDeviceUser() || '') : ''; } catch (e) { return ''; } }
  function _signedIn() { try { return !!_me() && (typeof window.isLoggedIn !== 'function' || window.isLoggedIn()); } catch (e) { return !!_me(); } }
  function _isJoe() {
    var n = _me().toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!n) return false;
    if (n === 'joe' || n === 'joseph') return true;
    return /^jo/.test(n) && /schmidt/.test(n);
  }
  function _alerts() {   // the 👑 Master red-alert count (master.js keeps it fresh)
    var b = $('master-badge');
    if (!b || b.style.display === 'none') return 0;
    return parseInt(b.textContent, 10) || 0;
  }
  function _ensureButtons() {
    try {
      var hdr = document.querySelector('#main-header .header-inner');
      if (hdr && !$('me-btn-hdr')) {
        var b = document.createElement('button');
        b.id = 'me-btn-hdr'; b.className = 'me-btn'; b.type = 'button';
        b.onclick = function (e) { window.meMenuToggle(e); };
        hdr.appendChild(b);
      }
      var date = $('ls-date');
      if (date && !$('me-btn-land')) {
        var l = document.createElement('button');
        l.id = 'me-btn-land'; l.className = 'me-btn me-btn-land'; l.type = 'button';
        l.onclick = function (e) { window.meMenuToggle(e); };
        date.parentNode.appendChild(l);
      }
      var on = _signedIn(), first = _me().split(' ')[0], n = _isJoe() ? _alerts() : 0;
      var dot = n ? '<span class="me-dot">' + n + '</span>' : '';
      var h = $('me-btn-hdr'), d = $('me-btn-land');
      if (h) { h.style.display = on ? '' : 'none'; h.innerHTML = '👤' + dot; h.title = first; }
      if (d) { d.style.display = on ? '' : 'none'; d.innerHTML = '👤 ' + _esc(first) + ' ▾' + dot; }
    } catch (e) {}
  }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var _armedSignOut = 0;
  function _meClose() {
    var m = $('me-menu');
    if (m && m.style.display !== 'none') { m.style.display = 'none'; _armedSignOut = 0; return true; }
    return false;
  }
  function _item(icon, label, extra, fn) {
    return '<button type="button" class="me-item" data-act="' + fn + '"><span class="me-ic">' + icon + '</span><span class="me-lb">' + label + '</span>' + (extra || '') + '</button>';
  }
  function _renderMenu(m) {
    var joe = _isJoe(), n = joe ? _alerts() : 0;
    var html = '<div class="me-who">' + _nbL('Signed in as', 'Conectado como') + '<b>' + _esc(_me() || '—') + '</b></div>';
    if (joe) {
      html += _item('🐔', _nbL('Bird Health', 'Salud de aves'), '', 'bh');
      html += _item('👑', _nbL('Master board', 'Tablero maestro'), n ? '<span class="me-badge">' + n + '</span>' : '', 'master');
      html += _item('📈', _nbL('Usage', 'Uso'), '', 'usage');
    }
    html += _item('🚪', _armedSignOut > Date.now() ? _nbL('Tap again to sign out', 'Toca otra vez para salir') : _nbL('Sign out', 'Salir'), '', 'out');
    m.innerHTML = html;
  }
  window.meMenuToggle = function (ev) {
    try { if (ev) { ev.stopPropagation(); ev.preventDefault(); } } catch (e) {}
    var m = $('me-menu');
    if (m && m.style.display !== 'none') { _meClose(); return; }
    if (!m) {
      m = document.createElement('div');
      m.id = 'me-menu';
      m.style.display = 'none';
      m.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('.me-item') : null;
        if (!t) return;
        e.stopPropagation();
        var a = t.getAttribute('data-act');
        if (a === 'out') {
          // Two taps (confirm() is a no-op in the installed PWA) — an accidental
          // tap never signs anyone out.
          if (_armedSignOut > Date.now()) { _armedSignOut = 0; _meClose(); if (typeof window.signOutDevice === 'function') window.signOutDevice(); return; }
          _armedSignOut = Date.now() + 3000; _renderMenu(m);
          setTimeout(function () { if (_armedSignOut && Date.now() >= _armedSignOut) { _armedSignOut = 0; if (m.style.display !== 'none') _renderMenu(m); } }, 3100);
          return;
        }
        _meClose();
        if (a === 'bh' && typeof window.openBirdHealth === 'function') window.openBirdHealth();
        if (a === 'master' && typeof window.openMasterBoard === 'function') window.openMasterBoard();
        if (a === 'usage' && typeof window.openUsageBoard === 'function') window.openUsageBoard();
      });
      document.body.appendChild(m);
    }
    _renderMenu(m);
    // Drop it just under the button that opened it, kept on screen.
    var btn = (ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect) ? ev.currentTarget : ($('me-btn-hdr') && _shown($('me-btn-hdr')) ? $('me-btn-hdr') : $('me-btn-land'));
    var r = btn ? btn.getBoundingClientRect() : { left: 10, right: window.innerWidth - 10, bottom: 60 };
    m.style.display = 'block';
    var w = Math.min(280, window.innerWidth - 20);
    m.style.width = w + 'px';
    var left = (r.left + w <= window.innerWidth - 10) ? r.left : Math.max(10, r.right - w);
    m.style.left = left + 'px';
    m.style.top = Math.round(r.bottom + 8) + 'px';
  };
  document.addEventListener('click', function (e) {
    var m = $('me-menu');
    if (!m || m.style.display === 'none') return;
    if (e.target && e.target.closest && (e.target.closest('#me-menu') || e.target.closest('.me-btn'))) return;
    _meClose();
  }, true);

  // ── 5. STYLES: pills gone, header Back/Home, bottom kept clear ────────────
  function _css() {
    if ($('navback-css')) return;
    var s = document.createElement('style');
    s.id = 'navback-css';
    s.textContent = [
      // the four floating pills now live in the 👤 menu
      '#login-chip,#usage-chip,#master-chip,#bh-chip{display:none !important;}',
      // 👤 button
      ".me-btn{position:relative;flex-shrink:0;display:inline-flex;align-items:center;gap:4px;padding:7px 11px;background:#0f2a0f;border:1.5px solid #2a5a2a;border-radius:9px;color:#9ad6a0;font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;cursor:pointer;line-height:1.2;}",
      ".me-btn-land{margin-top:8px;font-size:12px;padding:6px 12px;border-radius:50px;white-space:nowrap;}",
      ".me-dot{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;background:#e53e3e;color:#fff;border-radius:9px;font-size:10px;line-height:18px;text-align:center;}",
      "#me-menu{position:fixed;z-index:20000;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.55);padding:6px;font-family:'IBM Plex Mono',monospace;}",
      ".me-who{padding:9px 10px 10px;font-size:10px;color:#5a8a5a;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #1e3a1e;margin-bottom:4px;}",
      ".me-who b{display:block;margin-top:3px;font-size:13px;color:#e8f5ec;letter-spacing:.3px;text-transform:none;}",
      ".me-item{display:flex;align-items:center;gap:10px;width:100%;padding:12px 10px;background:none;border:none;border-radius:9px;color:#d8e8d8;font-family:inherit;font-size:13px;font-weight:700;text-align:left;cursor:pointer;}",
      ".me-item:hover,.me-item:active{background:#163016;}",
      ".me-ic{font-size:17px;width:22px;text-align:center;}",
      ".me-lb{flex:1;}",
      ".me-badge{background:#e53e3e;color:#fff;border-radius:50px;padding:1px 8px;font-size:11px;}",
      // header Back button
      ".hdr-back-btn{flex-shrink:0;display:inline-flex;align-items:center;padding:8px 13px;background:#0f1a0f;border:1.5px solid #4caf50;border-radius:9px;color:#9ad6a0;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;}",
      // Quick WO hides while you scroll down, comes back when you scroll up
      ".fab{transition:transform .25s ease,opacity .25s ease !important;}",
      "body.nav-scroll-down .fab{transform:translateY(170%) !important;opacity:0 !important;pointer-events:none !important;}",
      // room at the bottom so the last card is never under a button or toast
      "#main-content{padding-bottom:calc(96px + env(safe-area-inset-bottom,0px)) !important;}",
      // phones: Back + Home + site + ES + bell + 👤 all fit; the logo makes room
      "@media(max-width:600px){",
      "  #main-header .logo{display:none !important;}",
      "  #main-header .header-inner .header-home-btn{display:inline-flex !important;padding:8px 11px !important;font-size:14px !important;}",
      "  #main-header .header-inner .header-home-btn .hh-label{display:none;}",
      "  #main-header .header-inner{gap:6px !important;padding:8px 8px !important;overflow-x:auto;scrollbar-width:none;}",
      "  #main-header .header-inner::-webkit-scrollbar{display:none;}",
      "  .hdr-back-btn{padding:8px 11px;}",
      "  .me-btn{padding:7px 10px;}",
      "}",
      // light / white screen modes
      "html[data-theme=\"lightgreen\"] .me-btn-land,html[data-theme=\"white\"] .me-btn-land{background:#ffffff;border-color:#2a7a3a;color:#12331f;}"
    ].join('\n');
    document.head.appendChild(s);
  }

  // Scroll direction → hide / show Quick WO. Works for the page and any
  // scrolling container (capture listener sees them all).
  var _lastY = {};
  document.addEventListener('scroll', function (e) {
    try {
      var t = (e.target === document || e.target === document.documentElement || e.target === document.body) ? (document.scrollingElement || document.documentElement) : e.target;
      var id = t.id || '_doc', y = t.scrollTop || 0, prev = _lastY[id] || 0;
      if (y < 40) document.body.classList.remove('nav-scroll-down');
      else if (y - prev > 8) document.body.classList.add('nav-scroll-down');
      else if (prev - y > 8) document.body.classList.remove('nav-scroll-down');
      _lastY[id] = y;
    } catch (err) {}
  }, true);

  // ── 6. BOOT ───────────────────────────────────────────────────────────────
  function _boot() {
    _css();
    _wrapAll();
    _record();
    _ensureButtons();
    if (!_armed) _arm();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();
  // Some modules wrap go/enterApp late (usage.js at 2.5 s) and sign-in happens
  // after boot — re-check the wrappers + the 👤 button for a while, then slowly.
  var _ticks = 0;
  var _tm = setInterval(function () {
    _wrapAll(); _ensureButtons();
    if (++_ticks > 20) { clearInterval(_tm); setInterval(function () { _wrapAll(); _ensureButtons(); }, 15000); }
  }, 1500);

  window.appGoBack = appGoBack;
  window.goSiteHome = goSiteHome;
  window.appNavStack = function () { return _stack.map(_key); };   // debug: where Back will go
})();
