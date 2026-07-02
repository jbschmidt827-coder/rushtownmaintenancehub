// ═══════════════════════════════════════════
// voice.js — 🎤 dictation for work-order descriptions (v163)
// Adds a "Speak" button under the Full WO and Quick WO description boxes.
// Uses the browser's built-in speech recognition (Web Speech API) — no
// server, no cost. Language follows the app's EN/ES toggle. On devices
// without support the button simply never appears (the keyboard's own
// mic key still works there).
// ═══════════════════════════════════════════
(function () {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;                       // unsupported → stay invisible

  function vL(en, es) { return (typeof _lang !== 'undefined' && _lang === 'es') ? es : en; }
  var _rec = null;

  function makeBtn(taId) {
    var ta = document.getElementById(taId);
    if (!ta || ta._voiceWired) return;
    ta._voiceWired = true;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🎤 ' + vL('Speak it', 'Dictar');
    btn.style.cssText = 'display:block;margin-top:6px;padding:8px 14px;background:#0d1f3a;border:1.5px solid #3b82f6;border-radius:8px;color:#7ab0f6;font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:700;cursor:pointer;';

    function idle() {
      _rec = null;
      btn.textContent = '🎤 ' + vL('Speak it', 'Dictar');
      btn.style.borderColor = '#3b82f6'; btn.style.color = '#7ab0f6';
    }

    btn.onclick = function () {
      if (_rec) { try { _rec.stop(); } catch (e) {} return; }   // tap again = stop
      var rec = new SR();
      rec.lang = (typeof _lang !== 'undefined' && _lang === 'es') ? 'es-MX' : 'en-US';
      rec.interimResults = false;
      rec.continuous = true;
      rec.onresult = function (ev) {
        var txt = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++)
          if (ev.results[i].isFinal) txt += ev.results[i][0].transcript;
        if (txt) ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + txt.trim();
      };
      rec.onend = idle;
      rec.onerror = idle;
      _rec = rec;
      btn.textContent = '🔴 ' + vL('Listening… tap to stop', 'Escuchando… toca para parar');
      btn.style.borderColor = '#e53e3e'; btn.style.color = '#f0a0a0';
      try { rec.start(); } catch (e) { idle(); }
    };

    ta.insertAdjacentElement('afterend', btn);
  }

  function wire() { ['wo-desc', 'qwo-desc'].forEach(makeBtn); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
