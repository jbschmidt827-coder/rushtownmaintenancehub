// ═══════════════════════════════════════════════════════════════════════════
// selftest.js — automatic button/health check after every update (v196)
// WHY: updates kept shipping "dead buttons" (a syntax error makes a whole file's
// functions undefined; a renamed/removed handler leaves an onclick pointing at
// nothing). This runs on every load and VERIFIES every button's onclick resolves
// to a real function — so a broken update is caught in the app, automatically,
// without anyone having to click through by hand.
//
// It NEVER blocks the app (wrapped in try/catch, read-only). If it finds broken
// buttons it (a) logs them to the console and (b) shows a dismissible banner —
// but ONLY to a leader/manager or when ?selftest=1 is in the URL, so the crew is
// never alarmed.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  // Critical handlers that MUST exist — the crew-facing submit/open paths. If any
  // of these is missing, that feature's button is dead. (Extend as features grow.)
  var CRITICAL = [
    'submitBarnWalk', 'openBarnWalk', 'submitMorningWalk', 'openMorningWalk',
    'manureSubmitHouse', 'openManure', 'submitBulkPM', 'openBulkPM',
    'submitQuickWO', 'openQuickWO', 'clSubmitDay', 'confirmPM',
    'goHome', 'openLocationHome', 'showLocationPicker', 'appGoBack',
    'enterApp', 'go', 'openProductionScreen', 'openCompletion', 'openLiveMonitor',
    'toast', 'getDeviceUser', 'LDATE'
  ];

  function _isLeaderNow() {
    try {
      var u = (typeof getDeviceUser === 'function') ? getDeviceUser() : '';
      if (!u || typeof staffList === 'undefined') return false;
      var s = staffList.find(function (x) { return x && x.name === u; });
      return (typeof _isLeader === 'function') && _isLeader(s);
    } catch (e) { return false; }
  }

  // Pull the function name out of an inline onclick like "openBarnWalk('Hegins',1)".
  function _fnName(attr) {
    if (!attr) return null;
    var m = String(attr).match(/^\s*([a-zA-Z_$][\w$]*)\s*\(/);
    if (!m) return null;
    var n = m[1];
    // Skip language keywords / inline expressions that aren't a single call.
    if (['if', 'for', 'while', 'return', 'function', 'event', 'this'].indexOf(n) !== -1) return null;
    return n;
  }

  function runSelfTest(opts) {
    opts = opts || {};
    var broken = [];   // {kind, name, where}
    try {
      // 1) Every onclick handler in the DOM must resolve to a real global function.
      var els = document.querySelectorAll('[onclick]');
      var seen = {};
      els.forEach(function (el) {
        var attr = el.getAttribute('onclick') || '';
        // Only check simple single-call handlers; skip inline expressions.
        if (/[;={}]|=>|\bif\b|\bfunction\b/.test(attr)) return;
        var fn = _fnName(attr);
        if (!fn || seen[fn]) return;
        seen[fn] = 1;
        if (typeof window[fn] !== 'function') {
          broken.push({ kind: 'onclick', name: fn, where: (el.textContent || el.id || el.className || '').trim().slice(0, 30) });
        }
      });
      // 2) Critical named handlers must exist even if not currently in the DOM.
      CRITICAL.forEach(function (fn) {
        if (typeof window[fn] !== 'function') broken.push({ kind: 'critical', name: fn, where: '(core handler)' });
      });
    } catch (e) { console.warn('[selftest] scan error (non-fatal):', e); }

    if (!broken.length) {
      console.log('%c[selftest] ✓ all ' + '(' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?') + ') buttons resolve', 'color:#4caf50');
      var ok = document.getElementById('selftest-banner'); if (ok) ok.remove();
      return { ok: true, broken: [] };
    }

    console.error('[selftest] ⚠ ' + broken.length + ' broken button/handler(s):', broken);
    // Visible banner — only to a leader/manager, or when ?selftest=1 forced.
    var forced = false; try { forced = /[?&]selftest=1/.test(location.search); } catch (e) {}
    if (opts.force || forced || _isLeaderNow()) _showBanner(broken);
    return { ok: false, broken: broken };
  }

  function _showBanner(broken) {
    try {
      var b = document.getElementById('selftest-banner');
      if (!b) {
        b = document.createElement('div');
        b.id = 'selftest-banner';
        b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:13000;background:#5a1010;border-top:2px solid #e53e3e;color:#ffd7d7;font-family:"IBM Plex Mono",monospace;font-size:12px;padding:10px 14px;text-align:left;box-shadow:0 -2px 10px rgba(0,0,0,.5);';
        document.body.appendChild(b);
      }
      var list = broken.slice(0, 8).map(function (x) { return x.name; }).join(', ');
      b.innerHTML = '<b>⚠ Self-test: ' + broken.length + ' button(s) may be broken after this update</b><br>' +
        '<span style="color:#f2b0b0;">' + list + (broken.length > 8 ? '…' : '') + '</span>' +
        ' <button onclick="this.parentNode.remove()" style="float:right;background:#7a1414;border:1px solid #e53e3e;color:#fff;border-radius:6px;padding:4px 10px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">Dismiss</button>' +
        ' <button onclick="location.reload(true)" style="float:right;margin-right:8px;background:#1a3a1a;border:1px solid #4caf50;color:#9ad6a0;border-radius:6px;padding:4px 10px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;">Reload</button>';
    } catch (e) {}
  }

  window.runSelfTest = runSelfTest;
  // Run a few seconds after load so all deferred scripts + initial render are done.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { runSelfTest(); }, 3500); });
  else setTimeout(function () { runSelfTest(); }, 3500);
})();
