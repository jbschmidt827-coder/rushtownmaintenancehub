// ═══════════════════════════════════════════════════════════════════════════
// prodhistory.js — editable Production History (daily checks / barn walks) (v206)
// Everyone views; Directors + Leads can correct a past record (name, mortality,
// loose birds, notes). ISOLATED + additive: reads/updates the barnWalks docs by
// their deterministic id and never touches the daily-check submit flow, so it
// cannot break entry. Edits merge-write + stamp editedBy/editedTs.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  var _phDocs = [], _phEdit = null;
  function _es() { return (typeof _lang !== 'undefined' && _lang === 'es'); }
  function L(en, es) { return _es() ? es : en; }
  function _leader() {
    try {
      var u = (typeof getDeviceUser === 'function') ? getDeviceUser() : '';
      if (!u || typeof staffList === 'undefined' || !Array.isArray(staffList)) return false;
      var s = staffList.find(function (x) { return x && x.name === u; });
      return (typeof _isLeader === 'function') && _isLeader(s);
    } catch (e) { return false; }
  }
  function _ov() {
    var o = document.getElementById('prodhist-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'prodhist-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:950;background:#0a1a0a;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.openProdHistory = function () {
    var o = _ov(); o.style.display = 'block';
    _render(L('Loading…', 'Cargando…'));
    try {
      if (typeof db !== 'undefined' && db) {
        db.collection('barnWalks').orderBy('ts', 'desc').limit(300).get().then(function (snap) {
          _phDocs = snap.docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });
          _render();
        }).catch(function (e) { console.error('prodhist load:', e); _render(L('Could not load history — check connection.', 'No se pudo cargar.')); });
      }
    } catch (e) { _render(L('Could not load history.', 'No se pudo cargar.')); }
    try { window.scrollTo(0, 0); } catch (e) {}
  };
  window.closeProdHistory = function () { var o = document.getElementById('prodhist-overlay'); if (o) o.style.display = 'none'; _phEdit = null; };
  window.phEditRow = function (id) { _phEdit = (_phEdit === id ? null : id); _render(); };
  window.phSaveRow = async function (id) {
    var g = function (f) { var el = document.getElementById('ph-' + f + '-' + id); return el ? el.value : undefined; };
    var patch = { editedBy: ((typeof getDeviceUser === 'function' ? getDeviceUser() : '') || ''), editedTs: Date.now() };
    var emp = g('emp'); if (emp !== undefined) patch.employee = emp.trim();
    var mc = g('mc'); if (mc !== undefined) patch.mortCount = (mc === '' ? null : Math.max(0, Number(mc) || 0));
    var lc = g('lc'); if (lc !== undefined) patch.looseCount = (lc === '' ? null : Math.max(0, Number(lc) || 0));
    var nt = g('nt'); if (nt !== undefined) patch.notes = nt.trim();
    try {
      await db.collection('barnWalks').doc(id).set(patch, { merge: true });
      var r = _phDocs.find(function (x) { return x._id === id; }); if (r) Object.assign(r, patch);
      _phEdit = null;
      if (typeof toast === 'function') toast(L('✅ Record updated', '✅ Registro actualizado'));
      _render();
    } catch (e) { console.error('phSaveRow:', e); if (typeof toast === 'function') toast(L('Could not save — try again', 'No se pudo guardar')); }
  };
  function _f(k, id, label, val, type) {
    var MONO = "font-family:'IBM Plex Mono',monospace;";
    return '<label style="' + MONO + 'font-size:11px;color:#9ab09a;">' + label +
      '<input id="ph-' + k + '-' + id + '" type="' + type + '" value="' + String(val).replace(/"/g, '&quot;') + '" style="width:100%;margin-top:3px;background:#0a1408;border:1.5px solid #2a5a2a;border-radius:7px;color:#f0ead8;' + MONO + 'font-size:14px;padding:9px 11px;box-sizing:border-box;"></label>';
  }
  function _render(msg) {
    var o = _ov(); var MONO = "font-family:'IBM Plex Mono',monospace;"; var canEdit = _leader();
    var body;
    if (msg) body = '<div style="' + MONO + 'color:#9ac9d6;text-align:center;padding:40px;">' + msg + '</div>';
    else if (!_phDocs.length) body = '<div style="' + MONO + 'color:#9ac9d6;text-align:center;padding:40px;">' + L('No daily checks recorded yet.', 'Sin chequeos registrados.') + '</div>';
    else {
      body = _phDocs.map(function (r) {
        var flags = (r.flags && r.flags.length) ? r.flags.length : 0;
        var head = '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
          '<span style="' + MONO + 'font-size:13px;font-weight:700;color:#f0ead8;">' + (r.date || '?') + ' · ' + (r.farm || '?') + ' ' + L('H', 'C') + (r.house || '?') + '</span>' +
          '<span style="' + MONO + 'font-size:12px;color:' + (flags ? '#f2705a' : '#4ade80') + ';">' + (flags ? ('⚠ ' + flags) : '✓') + '</span></div>' +
          '<div style="' + MONO + 'font-size:11px;color:#7ab07a;margin-top:3px;">👤 ' + (r.employee || '—') + ' · 💀 ' + (r.mortCount != null ? r.mortCount : '—') + (r.editedBy ? (' · ✎ ' + r.editedBy) : '') + '</div>';
        var edit = '';
        if (canEdit && _phEdit === r._id) {
          edit = '<div style="margin-top:10px;border-top:1px solid #2a5a2a;padding-top:10px;display:grid;gap:8px;">' +
            _f('emp', r._id, L('Name', 'Nombre'), r.employee || '', 'text') +
            _f('mc', r._id, L('Mortality count', 'Conteo mortalidad'), r.mortCount != null ? r.mortCount : '', 'number') +
            _f('lc', r._id, L('Loose birds', 'Aves sueltas'), r.looseCount != null ? r.looseCount : '', 'number') +
            _f('nt', r._id, L('Notes', 'Notas'), r.notes || '', 'text') +
            '<div style="display:flex;gap:8px;"><button onclick="phSaveRow(\'' + r._id + '\')" style="flex:1;padding:10px;border-radius:8px;background:#14532d;border:1.5px solid #2a7a3a;color:#86efac;' + MONO + 'font-weight:700;cursor:pointer;">💾 ' + L('Save', 'Guardar') + '</button>' +
            '<button onclick="phEditRow(\'' + r._id + '\')" style="padding:10px 14px;border-radius:8px;background:#1a1a1a;border:1px solid #3a3a3a;color:#999;' + MONO + 'cursor:pointer;">' + L('Cancel', 'Cancelar') + '</button></div></div>';
        } else if (canEdit) {
          edit = '<button onclick="phEditRow(\'' + r._id + '\')" style="margin-top:8px;padding:7px 12px;border-radius:7px;background:#0d1f3a;border:1px solid #2a5a8a;color:#7ab0f6;' + MONO + 'font-size:11px;font-weight:700;cursor:pointer;">✏️ ' + L('Edit', 'Editar') + '</button>';
        }
        return '<div style="background:#0f2410;border:1px solid #2a5a2a;border-radius:10px;padding:12px 14px;margin-bottom:8px;">' + head + edit + '</div>';
      }).join('');
    }
    o.innerHTML = '<div style="max-width:720px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 30px) 14px 40px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
        '<button onclick="closeProdHistory()" style="padding:11px 16px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#9ad6a0;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + L('Back', 'Atrás') + '</button>' +
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;color:#f0ead8;letter-spacing:2px;">📋 ' + L('PRODUCTION HISTORY', 'HISTORIAL') + '</div>' +
      '</div>' +
      '<div style="' + MONO + 'font-size:11px;color:#7ab07a;margin-bottom:12px;">' + (canEdit ? L('Daily checks — tap ✏️ to correct any record.', 'Chequeos — toca ✏️ para corregir.') : L('Daily checks — view only.', 'Chequeos — solo lectura.')) + '</div>' +
      body + '</div>';
  }
})();
