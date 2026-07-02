// ═══════════════════════════════════════════
// rooster.js — 🐓 Rooster, the in-app AI help chat (v163)
// Frontend only: all AI calls go through the roosterChat Cloud Function
// (functions/index.js), which holds the API key as a secret and only
// answers signed-in app instances. Bilingual EN/ES.
// ═══════════════════════════════════════════
var ROOSTER_URL = 'https://us-central1-rushtown-poultry.cloudfunctions.net/roosterChat';
var _rcMsgs = [];        // {role:'user'|'assistant', content:string}
var _rcBusy = false;

function _rclang() { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; }
function rcL(en, es) { return _rclang() === 'es' ? es : en; }

function _rcEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _rcEnsureOverlay() {
  if (document.getElementById('rooster-overlay')) return;
  var ov = document.createElement('div');
  ov.id = 'rooster-overlay';
  ov.className = 'overlay';   // navback.js sweeps .overlay on device BACK
  ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:9500;background:#050f05;flex-direction:column;';
  ov.innerHTML =
    '<div style="display:flex;align-items:center;gap:10px;padding:max(env(safe-area-inset-top,10px),10px) 14px 10px;border-bottom:1px solid #1e3a1e;background:#0a140a;">' +
      '<button onclick="closeRooster()" style="padding:8px 14px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:50px;color:#7ab07a;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;cursor:pointer;" id="rc-back-btn">← Back</button>' +
      '<span style="font-size:24px;">🐓</span>' +
      '<div style="flex:1;">' +
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:22px;color:#f0ead8;letter-spacing:2px;line-height:1;">ROOSTER</div>' +
        '<div id="rc-sub" style="font-family:\'IBM Plex Mono\',monospace;font-size:9px;color:#7ab07a;letter-spacing:1px;"></div>' +
      '</div>' +
    '</div>' +
    '<div id="rc-msgs" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch;"></div>' +
    '<div style="display:flex;gap:8px;padding:10px 12px max(env(safe-area-inset-bottom,12px),12px);border-top:1px solid #1e3a1e;background:#0a140a;">' +
      '<input id="rc-input" type="text" autocomplete="off" style="flex:1;padding:12px 14px;background:#050f05;border:1.5px solid #2a5a2a;border-radius:10px;color:#f0ead8;font-family:\'IBM Plex Mono\',monospace;font-size:13px;box-sizing:border-box;">' +
      '<button id="rc-send" onclick="roosterSend()" style="padding:12px 18px;background:#1a3a1a;border:1.5px solid #4caf50;border-radius:10px;color:#a5e8a5;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;">➤</button>' +
    '</div>';
  document.body.appendChild(ov);
  var inp = document.getElementById('rc-input');
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') roosterSend(); });
}

function _rcBubble(role, html) {
  var box = document.getElementById('rc-msgs');
  if (!box) return null;
  var b = document.createElement('div');
  b.style.cssText = role === 'user'
    ? 'align-self:flex-end;max-width:85%;background:#1a3a1a;border:1px solid #2a5a2a;border-radius:14px 14px 4px 14px;padding:10px 13px;color:#e8f5ec;font-size:13px;line-height:1.5;font-family:\'IBM Plex Mono\',monospace;white-space:pre-wrap;word-break:break-word;'
    : 'align-self:flex-start;max-width:85%;background:#0d1f3a;border:1px solid #1e3a6a;border-radius:14px 14px 14px 4px;padding:10px 13px;color:#e8f0fa;font-size:13px;line-height:1.5;font-family:\'IBM Plex Mono\',monospace;white-space:pre-wrap;word-break:break-word;';
  b.innerHTML = html;
  box.appendChild(b);
  box.scrollTop = box.scrollHeight;
  return b;
}

function openRooster() {
  _rcEnsureOverlay();
  var ov = document.getElementById('rooster-overlay');
  ov.style.display = 'flex';
  document.getElementById('rc-back-btn').textContent = rcL('← Back', '← Atrás');
  document.getElementById('rc-sub').textContent = rcL('App help — ask me anything', 'Ayuda de la app — pregúntame lo que sea');
  document.getElementById('rc-input').placeholder = rcL('e.g. How do I log a work order?', 'ej. ¿Cómo registro una orden de trabajo?');
  if (!_rcMsgs.length) {
    _rcBubble('assistant', _rcEsc(rcL(
      "🐓 Hey! I'm Rooster. Ask me how to do anything in this app — work orders, barn walks, manure checks, PMs, you name it.",
      '🐓 ¡Hola! Soy Rooster. Pregúntame cómo hacer cualquier cosa en esta app — órdenes de trabajo, rondas, revisión de estiércol, PMs, lo que sea.')));
  }
  setTimeout(function () { try { document.getElementById('rc-input').focus(); } catch (e) {} }, 200);
}

function closeRooster() {
  var ov = document.getElementById('rooster-overlay');
  if (ov) ov.style.display = 'none';
}

async function roosterSend() {
  if (_rcBusy) return;
  var inp = document.getElementById('rc-input');
  var q = (inp.value || '').trim();
  if (!q) return;
  inp.value = '';
  _rcMsgs.push({ role: 'user', content: q });
  _rcBubble('user', _rcEsc(q));
  var thinking = _rcBubble('assistant', rcL('🐓 thinking…', '🐓 pensando…'));
  _rcBusy = true;
  var sendBtn = document.getElementById('rc-send');
  if (sendBtn) sendBtn.disabled = true;

  try {
    var user = (firebase.auth && firebase.auth().currentUser) || null;
    if (!user) throw new Error('noauth');
    var token = await user.getIdToken();
    var r = await fetch(ROOSTER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + token },
      body: JSON.stringify({ messages: _rcMsgs.slice(-12) }),
    });
    if (!r.ok) throw new Error('http' + r.status);
    var data = await r.json();
    var text = (data && data.text) ? String(data.text) : '';
    if (!text) throw new Error('empty');
    _rcMsgs.push({ role: 'assistant', content: text });
    thinking.innerHTML = _rcEsc(text);
  } catch (e) {
    _rcMsgs.pop();   // let them retry the same question
    thinking.innerHTML = _rcEsc(e.message === 'noauth'
      ? rcL('🐓 One sec — the app is still connecting. Try again in a moment.', '🐓 Un segundo — la app se está conectando. Intenta de nuevo en un momento.')
      : rcL("🐓 Couldn't reach the coop (no signal?). Try again, or check 📖 How To Use.", '🐓 No pude conectar (¿sin señal?). Intenta de nuevo, o revisa 📖 Cómo Usar.'));
  }
  _rcBusy = false;
  if (sendBtn) sendBtn.disabled = false;
  var box = document.getElementById('rc-msgs');
  if (box) box.scrollTop = box.scrollHeight;
}

if (typeof window !== 'undefined') {
  window.openRooster = openRooster;
  window.closeRooster = closeRooster;
  window.roosterSend = roosterSend;
}
