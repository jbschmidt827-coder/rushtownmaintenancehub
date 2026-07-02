// ═══════════════════════════════════════════
// rolehome.js — role-based home screen (v163)
// Each person sees the cards for THEIR department big and up front;
// everything else tucks behind a bilingual "More" toggle.
// Dept comes from the device user's staff doc (staffDeptOf in staff.js).
// Leaders/Directors, unknown names, and depts we don't trim for see ALL
// cards — nothing is ever more than one tap away, and nothing breaks if
// the staff list hasn't loaded yet.
// ═══════════════════════════════════════════
var _rhExpanded = false;

function _rhlang() { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; }
function rhL(en, es) { return _rhlang() === 'es' ? es : en; }

// Which card tags each trimmed department keeps on top.
// Card tags live in index.html as data-role-dept="...".
var RH_SHOW = {
  'Barns':       ['barns'],
  'Maintenance': ['maint'],
};

function _rhDept() {
  try {
    var name = (typeof getDeviceUser === 'function') ? String(getDeviceUser() || '').trim().toLowerCase() : '';
    if (!name || typeof staffList === 'undefined' || !Array.isArray(staffList)) return null;
    var s = null;
    for (var i = 0; i < staffList.length; i++) {
      var x = staffList[i];
      if (x && x.active !== false && x.name && String(x.name).trim().toLowerCase() === name) { s = x; break; }
    }
    if (!s) return null;                                            // unknown → show all
    if (typeof _isLeader === 'function' && _isLeader(s)) return null; // leaders → show all
    var d = (typeof staffDeptOf === 'function') ? staffDeptOf(s) : null;
    return RH_SHOW[d] ? d : null;                                   // only trim known depts
  } catch (e) { return null; }
}

function applyRoleHome() {
  var home = document.getElementById('loc-home');
  if (!home) return;
  var cards   = home.querySelectorAll('[data-role-dept]');
  var moreBtn = document.getElementById('rh-more-btn');
  var dept    = _rhDept();

  if (!dept) {                       // full home, no toggle
    cards.forEach(function (c) { c.style.display = ''; });
    if (moreBtn) moreBtn.style.display = 'none';
    return;
  }

  var keep = RH_SHOW[dept], hidden = 0;
  cards.forEach(function (c) {
    var tags = (c.getAttribute('data-role-dept') || '').split(/\s+/);
    var mine = false;
    for (var i = 0; i < tags.length; i++) if (keep.indexOf(tags[i]) !== -1) { mine = true; break; }
    if (!mine) hidden++;
    c.style.display = (mine || _rhExpanded) ? '' : 'none';
  });
  if (moreBtn) {
    moreBtn.style.display = '';
    moreBtn.textContent = _rhExpanded
      ? rhL('▲ Show less', '▲ Mostrar menos')
      : rhL('▼ More (' + hidden + ')', '▼ Más (' + hidden + ')');
  }
}

function rhToggleMore() { _rhExpanded = !_rhExpanded; applyRoleHome(); }

if (typeof window !== 'undefined') {
  window.applyRoleHome = applyRoleHome;
  window.rhToggleMore  = rhToggleMore;
}
