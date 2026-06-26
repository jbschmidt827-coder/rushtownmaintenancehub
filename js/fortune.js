// ═══════════════════════════════════════════════════════════════════════════
// fortune.js — 🥠 Daily Farm Fortune (EN/ES)
// A 🥠 button on the location home pops a silly "Poultry Proverb." The default
// is today's fortune (same for everyone, changes each day); "Another" rolls a
// random one. Pure fun + a little motivation. No data, works offline.
// ═══════════════════════════════════════════════════════════════════════════
function _ftlang() { try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch (e) { return 'en'; } }
function ftL(en, es) { return _ftlang() === 'es' ? es : en; }

var FORTUNES = [
  { en: 'A clean barn is a happy barn. A happy barn files fewer work orders.', es: 'Un galpón limpio es un galpón feliz. Y un galpón feliz genera menos órdenes.' },
  { en: 'The early bird gets the worm. The early tech gets the easy fix.', es: 'Al que madruga... le toca el arreglo fácil.' },
  { en: 'Measure the feed twice, fill the bin once.', es: 'Mide el alimento dos veces, llena el silo una.' },
  { en: 'A watched belt never jams. So watch it. We are serious.', es: 'Una banda vigilada nunca se atasca. Así que vigílala. Es en serio.' },
  { en: "Today's small leak is tomorrow's big work order.", es: 'La pequeña fuga de hoy es la gran orden de mañana.' },
  { en: 'Respect the rooster. He is middle management.', es: 'Respeta al gallo. Es gerencia media.' },
  { en: 'A PM done on time is a breakdown that never happened.', es: 'Un PM a tiempo es una falla que nunca pasó.' },
  { en: 'Coffee first. Then conquer the houses.', es: 'Primero el café. Luego conquista los galpones.' },
  { en: 'The barn rewards the patient and humbles the rushed.', es: 'El galpón premia al paciente y humilla al apurado.' },
  { en: 'Grease is cheaper than a new bearing. Always.', es: 'La grasa es más barata que un rodamiento nuevo. Siempre.' },
  { en: 'Check the water before the birds remind you.', es: 'Revisa el agua antes de que las aves te lo recuerden.' },
  { en: 'A tidy shop finds its tools. A messy shop buys new ones.', es: 'Un taller ordenado encuentra sus herramientas; uno desordenado compra nuevas.' },
  { en: 'Wet litter waits for no one. Move now.', es: 'La cama húmeda no espera a nadie. Actúa ya.' },
  { en: 'Good notes today save a guessing game tomorrow.', es: 'Buenas notas hoy evitan adivinanzas mañana.' },
  { en: 'The best work order is the one you prevented.', es: 'La mejor orden de trabajo es la que evitaste.' },
  { en: 'Slow is smooth, smooth is fast — even at 5:30 a.m.', es: 'Despacio es suave, y suave es rápido — incluso a las 5:30 a.m.' },
  { en: 'Feed the birds like they sign your paycheck. They do.', es: 'Alimenta a las aves como si firmaran tu cheque. Lo hacen.' },
  { en: 'Two zip ties and confidence can fix almost anything. Almost.', es: 'Dos amarres y confianza arreglan casi todo. Casi.' }
];

function _ftDay() {
  var d = new Date(); var s = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - s) / 86400000) % FORTUNES.length;
}

function showFortune(rand) {
  var i = rand ? Math.floor(Math.random() * FORTUNES.length) : _ftDay();
  var f = FORTUNES[i] || FORTUNES[0];
  var ov = document.getElementById('fortune-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'fortune-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:980;background:rgba(6,12,6,.82);display:flex;align-items:center;justify-content:center;padding:24px;-webkit-overflow-scrolling:touch;';
    ov.onclick = function (e) { if (e.target === ov) closeFortune(); };
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
  ov.innerHTML =
    '<div style="max-width:420px;width:100%;background:#10210f;border:2px solid #d6b34a;border-radius:18px;padding:22px 20px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.6);">' +
      '<div style="font-size:44px;line-height:1;">🥠</div>' +
      '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:22px;letter-spacing:2px;color:#f0d68a;margin:8px 0 12px;">' + ftL('FARM FORTUNE', 'FORTUNA DEL DÍA') + '</div>' +
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:15px;line-height:1.55;color:#e8f5ec;min-height:64px;">&ldquo;' + (f[_ftlang()] || f.en) + '&rdquo;</div>' +
      '<div style="display:flex;gap:8px;margin-top:18px;">' +
        '<button onclick="showFortune(true)" style="flex:1;padding:13px;background:#1c2e14;border:1.5px solid #3a6a2a;border-radius:10px;color:#a7e08a;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;">🔄 ' + ftL('Another', 'Otra') + '</button>' +
        '<button onclick="closeFortune()" style="flex:1;padding:13px;background:#0f1a0f;border:1.5px solid #2a5a2a;border-radius:10px;color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;">' + ftL('Close', 'Cerrar') + '</button>' +
      '</div>' +
    '</div>';
}
function closeFortune() { var ov = document.getElementById('fortune-overlay'); if (ov) ov.style.display = 'none'; }
function openFortune() { showFortune(false); }

if (typeof window !== 'undefined') {
  window.openFortune = openFortune;
  window.showFortune = showFortune;
  window.closeFortune = closeFortune;
}
