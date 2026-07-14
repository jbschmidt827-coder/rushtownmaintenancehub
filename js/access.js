// ═══════════════════════════════════════════════════════════════════════════
// access.js — strict per-area access control (v199)
// Once a person is signed in (js/login.js), they can only reach the pages for
// THEIR area (= their Department: Barns / Maintenance / Processing / Feed Mill).
// Directors + Leads see everything. Set a person's area in Staff → Edit (Dept).
//
// SAFETY: enforcement is active ONLY when someone is actually signed in via the
// login gate (isLoggedIn()). Login ships OFF behind settings/loginConfig, so this
// changes NOTHING until login is enabled. Every check is FAIL-OPEN — any error,
// unknown user, or untracked page → allowed, so it can never lock a person out of
// the whole app. It guards navigation by wrapping the existing openers (no edits
// to their files) so a bug here degrades to "no restriction", never a broken app.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  // Which tabs belong to which area. Anything not listed is management-only.
  var TAB_AREA = {
    prod: 'Barns', check: 'Barns', mw: 'Barns',
    maint: 'Maintenance', oncall: 'Maintenance',
    pkg: 'Processing',
    feed: 'Feed Mill'
  };
  var MGMT_ONLY = ['dash', 'staff', 'sched', 'reports', 'kpi', 'ship', 'daily'];
  // Home-card data-role-dept tag → area.
  var TAG_AREA = { barns: 'Barns', maint: 'Maintenance', pkg: 'Processing', mgmt: 'Management' };

  function _lang_es() { return (typeof _lang !== 'undefined' && _lang === 'es'); }

  // The signed-in staff record, or undefined when NOT enforcing (not logged in).
  function _curStaff() {
    try {
      if (!(window.isLoggedIn && window.isLoggedIn())) return undefined;   // not enforcing
      var u = (typeof getDeviceUser === 'function') ? getDeviceUser() : '';
      if (!u || typeof staffList === 'undefined' || !Array.isArray(staffList)) return null;
      return staffList.find(function (s) { return s && s.name === u; }) || null;
    } catch (e) { return undefined; }
  }
  function _leader(s) { try { return (typeof _isLeader === 'function') && _isLeader(s); } catch (e) { return false; } }
  function _area(s) { try { return (typeof staffDeptOf === 'function') ? staffDeptOf(s) : 'Barns'; } catch (e) { return 'Barns'; } }

  // Full access? (not enforcing, unknown user, or a leader). Fail-open.
  function _fullAccess() {
    var s = _curStaff();
    return (s === undefined) || !s || _leader(s);
  }

  // SAFE MODEL (v205): NEVER hard-block an operational page. Only the
  // management-only tabs (staff/schedule/reports/dashboard/kpi/etc.) are gated to
  // leaders. Every daily-work page — daily check, morning walk, manure, work
  // orders, PM, feed, processing — is ALWAYS allowed for any signed-in user, so a
  // wrong or blank Department can never lock the crew out of their job again
  // (that's exactly what blocked the daily check). Per-area scoping is now purely
  // cosmetic on the home screen (applyAccessHome), not a navigation block.
  window.accessAllowedTab = function (tab) {
    try {
      if (_fullAccess()) return true;
      return MGMT_ONLY.indexOf(tab) === -1;          // block ONLY management-only tabs
    } catch (e) { return true; }
  };
  window.accessAllowedArea = function (area) {
    try {
      if (_fullAccess()) return true;
      return area !== 'Management';                  // block ONLY the management area
    } catch (e) { return true; }
  };

  function _deny() {
    try { if (typeof toast === 'function') toast(_lang_es() ? 'No disponible para tu acceso' : 'Not available for your login'); } catch (e) {}
  }

  // Wrap the existing navigation entry points (once) so disallowed pages are
  // blocked with a toast instead of opening. Runs after all scripts define them.
  function _wrap() {
    try {
      if (typeof window.go === 'function' && !window.go._acc) {
        var g = window.go;
        window.go = function (tab) { if (!window.accessAllowedTab(tab)) { _deny(); return; } return g.apply(this, arguments); };
        window.go._acc = 1;
      }
      if (typeof window.enterApp === 'function' && !window.enterApp._acc) {
        var e = window.enterApp;
        window.enterApp = function (tab) { if (tab && !window.accessAllowedTab(tab)) { _deny(); return; } return e.apply(this, arguments); };
        window.enterApp._acc = 1;
      }
      if (typeof window.showLocationPicker === 'function' && !window.showLocationPicker._acc) {
        var sp = window.showLocationPicker;
        window.showLocationPicker = function () { var r = sp.apply(this, arguments); try { window.applyAccessPicker(); } catch (e) {} return r; };
        window.showLocationPicker._acc = 1;
      }
      [['openProductionScreen', 'Barns'], ['openManure', 'Barns'], ['openCompletion', 'Barns'],
       ['openPestLog', 'Barns'], ['openLiveMonitor', 'Management']].forEach(function (p) {
        var fn = p[0], area = p[1];
        if (typeof window[fn] === 'function' && !window[fn]._acc) {
          var o = window[fn];
          window[fn] = function () { if (!window.accessAllowedArea(area)) { _deny(); return; } return o.apply(this, arguments); };
          window[fn]._acc = 1;
        }
      });
    } catch (err) { console.warn('[access] wrap (non-fatal):', err); }
    try { window.applyAccessPicker(); } catch (e) {}   // filter picker if already signed in at boot
  }

  // Filter the site-home cards to the signed-in person's area (no More toggle).
  // Called from openLocationHome (after applyRoleHome). No-op when not enforcing.
  window.applyAccessHome = function () {
    try {
      var s = _curStaff();
      if (s === undefined) return;                    // not enforcing → leave rolehome's behavior
      var home = document.getElementById('loc-home'); if (!home) return;
      var leader = _leader(s), area = _area(s);
      home.querySelectorAll('[data-role-dept]').forEach(function (c) {
        if (leader) { c.style.display = ''; return; }
        // Show EVERY operational card (barns/maint/pkg/feed) to any signed-in user
        // so nobody is ever hidden from a page they might need; hide only cards that
        // are management-ONLY (e.g. Staff). Never blocks daily work.
        var tags = (c.getAttribute('data-role-dept') || '').split(/\s+/);
        var isOps = tags.some(function (t) { return t === 'barns' || t === 'maint' || t === 'pkg' || t === 'feed'; });
        c.style.display = isOps ? '' : 'none';
      });
    } catch (e) {}
  };

  // Which LOCATIONS a person may pick. Leaders → all (null). Else by farm/area.
  function _allowedLocs(s) {
    try {
      if (_leader(s)) return null;                       // all sites incl Master
      var area = _area(s), farm = (s && s.farm) || '';
      // Processing moved off the front screen (v202): plant staff now enter via
      // their farm's home card. Both plants unless their farm pins them to one.
      if (area === 'Processing' || farm === 'Processing Plant') {
        if (farm === 'Hegins' || farm === 'Danville') return [farm];
        return ['Hegins', 'Danville'];
      }
      if (farm === 'Hegins') return ['Hegins'];
      if (farm === 'Danville') return ['Danville'];
      if (farm === 'Both' || farm === 'All' || farm === 'All Farms') return ['Hegins', 'Danville'];
      return ['Hegins', 'Danville'];                      // default: both plants, no Master
    } catch (e) { return null; }
  }
  // Filter the location picker to the signed-in person's site(s); if exactly one,
  // jump straight into it. No-op when not enforcing or for leaders.
  window.applyAccessPicker = function () {
    try {
      var s = _curStaff();
      if (s === undefined) return;                        // not enforcing
      var allow = _allowedLocs(s);
      var picker = document.getElementById('loc-picker'); if (!picker) return;
      var btns = picker.querySelectorAll('[data-loc]');
      if (allow === null) { btns.forEach(function (b) { b.style.display = ''; }); return; }
      var visible = [];
      btns.forEach(function (b) {
        var ok = allow.indexOf(b.getAttribute('data-loc')) !== -1;
        b.style.display = ok ? '' : 'none';
        if (ok) visible.push(b.getAttribute('data-loc'));
      });
      if (visible.length === 1 && typeof openLocationHome === 'function') openLocationHome(visible[0]);
    } catch (e) {}
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(_wrap, 1700); });
  else setTimeout(_wrap, 1700);
})();
