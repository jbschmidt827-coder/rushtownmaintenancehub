// ═══════════════════════════════════════════════════════════════════════════
// navback.js — make the device/browser BACK button navigate inside the app
// instead of exiting it. This is a single-page app that shows/hides screens in
// JS without touching browser history, so Back had nothing in-app to return to
// and dumped the user out. We arm a history state and, on Back (popstate):
//   1) close the open overlay/modal, else
//   2) step back: app panels → location home → location picker, else
//   3) let it exit (only at the picker/root).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  function _vis(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('open')) return true;
    var d = (el.style && el.style.display) || '';
    return d !== '' && d !== 'none';
  }

  // Full-screen overlays + modals, topmost-first. [elementId, closeFnName]
  var LAYERS = [
    ['fortune-overlay',    'closeFortune'],
    ['pm-modal',           'closePMModal'],
    ['bulk-pm-modal',      'closeBulkPM'],
    ['manure-overlay',     'closeManure'],
    ['completion-overlay', 'closeCompletion'],
    ['scorecard-overlay',  'closeScorecard'],
    ['help-overlay',       'closeHelp'],
    ['staff-edit-modal',   'closeStaffEdit']
  ];

  function _closeTopLayer() {
    for (var i = 0; i < LAYERS.length; i++) {
      var el = document.getElementById(LAYERS[i][0]);
      if (_vis(el)) {
        var fn = LAYERS[i][1];
        if (fn && typeof window[fn] === 'function') { try { window[fn](); return true; } catch (e) {} }
        el.style.display = 'none';
        if (el.classList) el.classList.remove('open');
        return true;
      }
    }
    // Generic sweep — any other visible .overlay modal
    var ovs = document.querySelectorAll('.overlay');
    for (var j = 0; j < ovs.length; j++) {
      if (_vis(ovs[j])) { ovs[j].style.display = 'none'; if (ovs[j].classList) ovs[j].classList.remove('open'); return true; }
    }
    return false;
  }

  function appGoBack() {
    // 1) Close whatever overlay/modal is on top.
    if (_closeTopLayer()) return true;
    // 2) Inside the app (panels showing) → back to the landing/home.
    var mc = document.getElementById('main-content');
    var ls = document.getElementById('landing-screen');
    if (mc && mc.style.display !== 'none' && (!ls || ls.style.display === 'none')) {
      if (typeof goHome === 'function') { try { goHome(); return true; } catch (e) {} }
    }
    // 3) On a site's home → back to the location picker.
    var home = document.getElementById('loc-home');
    var picker = document.getElementById('loc-picker');
    if (home && home.style.display !== 'none' && picker && picker.style.display === 'none') {
      if (typeof showLocationPicker === 'function') { try { showLocationPicker(); return true; } catch (e) {} }
    }
    return false; // at the picker / root → allow the browser to exit
  }

  function _arm() { try { history.pushState({ rt: Date.now() }, ''); } catch (e) {} }

  window.addEventListener('popstate', function () {
    if (appGoBack()) _arm();   // handled in-app → re-arm so the next Back is caught too
    // else: we're at the root — let normal back/exit happen
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _arm);
  else _arm();

  if (typeof window !== 'undefined') window.appGoBack = appGoBack;
})();
