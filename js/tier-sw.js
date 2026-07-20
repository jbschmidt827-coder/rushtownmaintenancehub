// ═══════════════════════════════════════════════════════════════════════════
// tier-sw.js — STANDARD WORK: WHO FEEDS THE TIER SYSTEM (EN/ES)
// One card per department leader with their DAILY duties that keep the Tier 1 /
// Tier 2 boards true. Opens from the 📘 SW button on both Tier boards.
// If a leader does their card every day, every tile on the boards is real.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var MONO = "font-family:'IBM Plex Mono',monospace;";
  function _es() { try { return (typeof _lang !== 'undefined' && _lang === 'es'); } catch (e) { return false; } }
  function L(en, es) { return _es() ? es : en; }

  // role: {icon, title:[en,es], who:[en,es], items:[[en,es],...]}
  function ROLES() {
    return [
      { icon: '🐔', title: ['Barn Leader — Hegins', 'Líder de Casas — Hegins'], who: ['Start 5:30 AM', 'Inicio 5:30 AM'], items: [
        ['By 6:30 AM — a Morning Walk is entered for EVERY house (temp, PSI, birds).', 'Antes de 6:30 AM — Caminata Matutina registrada en CADA casa (temp, PSI, aves).'],
        ['Assign the Daily Employee Checks; every active house submitted by end of shift.', 'Asigna las Revisiones Diarias; cada casa activa enviada antes del fin del turno.'],
        ['Mortality count + eggs collected entered in each house check — no blanks.', 'Conteo de mortalidad + huevos recogidos en cada revisión — sin espacios vacíos.'],
        ['Any problem found → flag it in the check or open a Work Order the SAME day.', 'Cualquier problema → márcalo en la revisión o abre una Orden de Trabajo el MISMO día.'],
        ['Huddle: open 📊 Tier 1, read the reds/yellows out loud, assign one owner per red.', 'Reunión: abre 📊 Tier 1, lee los rojos/amarillos en voz alta, asigna un dueño por cada rojo.']
      ]},
      { icon: '🐔', title: ['Barn Leader — Danville', 'Líder de Casas — Danville'], who: ['Start 7:00 AM', 'Inicio 7:00 AM'], items: [
        ['By 8:00 AM — a Morning Walk is entered for EVERY house (temp, PSI, birds).', 'Antes de 8:00 AM — Caminata Matutina registrada en CADA casa (temp, PSI, aves).'],
        ['Assign the Daily Employee Checks; every active house submitted by end of shift.', 'Asigna las Revisiones Diarias; cada casa activa enviada antes del fin del turno.'],
        ['Mortality count + eggs collected entered in each house check — no blanks.', 'Conteo de mortalidad + huevos recogidos en cada revisión — sin espacios vacíos.'],
        ['Any problem found → flag it in the check or open a Work Order the SAME day.', 'Cualquier problema → márcalo en la revisión o abre una Orden de Trabajo el MISMO día.'],
        ['Huddle: open 📊 Tier 1, read the reds/yellows out loud, assign one owner per red.', 'Reunión: abre 📊 Tier 1, lee los rojos/amarillos en voz alta, asigna un dueño por cada rojo.']
      ]},
      { icon: '🔧', title: ['Maintenance Leader', 'Líder de Mantenimiento'], who: ['Both plants', 'Ambas plantas'], items: [
        ['Morning: open 📊 Tier 1 → Past Due PMs, Open WO (urgent first), Critical Parts.', 'Mañana: abre 📊 Tier 1 → PM Vencidos, OT Abiertas (urgentes primero), Piezas Críticas.'],
        ['Assign every open WO an owner; completed WOs are CLOSED in the app the same day (notes + parts used).', 'Asigna dueño a cada OT abierta; las OT terminadas se CIERRAN en la app el mismo día (notas + piezas).'],
        ['PMs are marked done in the app when the work is done — not at the end of the week.', 'Los PM se marcan hechos en la app al terminar el trabajo — no al final de la semana.'],
        ['Techs use ⏱ Time (Maintenance tab) EVERY time they help another department.', 'Los técnicos usan ⏱ Time (pestaña Mantenimiento) CADA vez que ayudan a otro departamento.'],
        ['Any part at/below minimum → order it and note it today.', 'Cualquier pieza en/bajo mínimo → ordénala y anótalo hoy.']
      ]},
      { icon: '🚿', title: ['Maintenance — Front-End Flow Protector', 'Mantenimiento — Protector de Flujo (Frente)'], who: ['Front of houses — feed, water, eggs', 'Frente de las casas — alimento, agua, huevos'], items: [
        ['The health and well-being of the chickens comes FIRST — before any task, always.', 'La salud y el bienestar de las gallinas es PRIMERO — antes de cualquier tarea, siempre.'],
        ['Monitor feed: lines running, no empty pans, bin levels checked — problems flagged TODAY.', 'Vigila el alimento: líneas corriendo, sin platos vacíos, niveles de tolva revisados — problemas marcados HOY.'],
        ['Monitor egg flow + egg collectors: belts moving, no jams, collectors clear house by house.', 'Vigila el flujo de huevos + colectores: bandas moviendo, sin atascos, colectores limpios casa por casa.'],
        ['Watch water at the front: pressure, leaks, drinkers — anything off gets a Work Order.', 'Vigila el agua al frente: presión, fugas, bebederos — cualquier falla genera una Orden de Trabajo.'],
        ['Run your assigned PMs and mark them done in the app the same day.', 'Haz tus PM asignados y márcalos hechos en la app el mismo día.'],
        ['Open the job\'s 📖 Work Instruction before starting anything you don\'t do daily.', 'Abre la 📖 Instrucción de Trabajo antes de empezar algo que no haces a diario.']
      ]},
      { icon: '🔄', title: ['Maintenance — Back-End / Manure Runner', 'Mantenimiento — Trasero / Estiércol'], who: ['Back of houses — manure, belts, cleanup', 'Parte trasera — estiércol, bandas, limpieza'], items: [
        ['The health and well-being of the chickens comes FIRST — before any task, always.', 'La salud y el bienestar de las gallinas es PRIMERO — antes de cualquier tarea, siempre.'],
        ['Run the manure belts on schedule; log every run + belt %s in the Manure tab.', 'Corre las bandas de estiércol según el horario; registra cada corrida + % en la pestaña Estiércol.'],
        ['Make sure ALL belts are adjusted and tracking right — a rip caught early is a cheap fix.', 'Asegura que TODAS las bandas estén ajustadas y alineadas — una rotura detectada temprano es barata.'],
        ['Watch water at the back: lines, leaks, pressure — report anything off the same day.', 'Vigila el agua atrás: líneas, fugas, presión — reporta cualquier falla el mismo día.'],
        ['Keep the back of every house cleaned up.', 'Mantén limpia la parte trasera de cada casa.'],
        ['Remove dead chickens through the week — never let them sit.', 'Retira las gallinas muertas durante la semana — nunca las dejes acumularse.']
      ]},
      { icon: '🧰', title: ['Maintenance — Lead', 'Mantenimiento — Líder'], who: ['Sets up the team + owns parts', 'Organiza al equipo + dueño de piezas'], items: [
        ['Set up ALL staff every morning — everyone knows their houses, jobs, and times (📅 Schedule tab).', 'Organiza a TODO el personal cada mañana — todos saben sus casas, trabajos y horarios (pestaña 📅 Horario).'],
        ['Build NEXT week by Friday: assign projects and labor on the schedule before the week starts.', 'Arma la PRÓXIMA semana antes del viernes: asigna proyectos y mano de obra antes de que empiece la semana.'],
        ['Make sure the app is used EVERY day: WOs closed, PMs marked, punch-outs logged, schedule followed.', 'Asegura que la app se use CADA día: OT cerradas, PM marcados, salidas registradas, horario seguido.'],
        ['Jump into any house or department that needs help — you cover the whole operation.', 'Entra a cualquier casa o departamento que necesite ayuda — cubres toda la operación.'],
        ['FULLY responsible for parts & inventory: counts right, minimums set, orders placed before we run out.', 'TOTALMENTE responsable de piezas e inventario: conteos correctos, mínimos definidos, pedidos antes de quedarnos sin nada.']
      ]},
      { icon: '🏭', title: ['Processing Leader', 'Líder de Procesamiento'], who: ['Danville plant', 'Planta Danville'], items: [
        ['Start of run: tap ▶ Start on the machine. End of run: ⏹ Stop + total eggs (Daily Run).', 'Inicio de corrida: toca ▶ Start. Fin: ⏹ Stop + total de huevos (Corrida Diaria).'],
        ['Log downtime minutes with the reason — every stop, every day.', 'Registra los minutos de paro con la razón — cada paro, cada día.'],
        ['Pallets packed + shipments entered so inventory stays true.', 'Pallets empacados + envíos registrados para que el inventario sea real.'],
        ['Huddle: check ⏱ Downtime and 🥚 Egg Flow tiles; assign an owner to any red.', 'Reunión: revisa los cuadros ⏱ Paro y 🥚 Flujo; asigna dueño a cualquier rojo.']
      ]},
      { icon: '🌽', title: ['Feed Mill Leader', 'Líder del Molino'], who: ['All sites', 'Todos los sitios'], items: [
        ['Enter Feed Made (farm + house + tons) every day it runs.', 'Registra Alimento Hecho (granja + casa + toneladas) cada día que corre.'],
        ['Check the 🌽 Feed tile; any house reporting empty gets a call TODAY.', 'Revisa el cuadro 🌽 Alimento; cualquier casa vacía recibe llamada HOY.'],
        ['Bin or auger problems → Work Order the same day.', 'Problemas de tolva o sinfín → Orden de Trabajo el mismo día.']
      ]},
      { icon: '🎯', title: ['Director / Ops', 'Director / Operaciones'], who: ['Joe + leads', 'Joe + líderes'], items: [
        ['6:15 AM — farm records auto-sync at ~6:05; open 📊 Tier 1 and scan the board.', '6:15 AM — los registros se sincronizan ~6:05; abre 📊 Tier 1 y revisa el tablero.'],
        ['Every red has ONE owner and ONE due date before the huddle ends.', 'Cada rojo tiene UN dueño y UNA fecha antes de terminar la reunión.'],
        ['Monday — 📈 Tier 2 weekly review: mortality trend, lay %, WOs opened vs closed, maintenance hours by department.', 'Lunes — revisión semanal 📈 Tier 2: tendencia de mortalidad, postura, OT abiertas vs cerradas, horas de mantenimiento por departamento.'],
        ['Month-end — Tier 2 digest becomes next month’s action list.', 'Fin de mes — el resumen de Tier 2 se vuelve la lista de acciones del mes siguiente.']
      ]}
    ];
  }

  function _ov() {
    var o = document.getElementById('tiersw-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'tiersw-overlay'; o.className = 'overlay';
      o.style.cssText = 'position:fixed;inset:0;z-index:957;background:#0f0d08;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;';
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeTierSW = function () { var o = document.getElementById('tiersw-overlay'); if (o) o.style.display = 'none'; };
  window.tierSWToggle = function (i) {
    var b = document.getElementById('tsw-body-' + i), c = document.getElementById('tsw-chev-' + i);
    if (!b) return;
    var open = b.style.display !== 'none';
    b.style.display = open ? 'none' : 'block';
    if (c) c.textContent = open ? '▸' : '▾';
  };
  window.openTierSW = function () {
    var o = _ov();
    var cards = ROLES().map(function (r, i) {
      var items = r.items.map(function (it) {
        return '<div style="display:flex;gap:9px;padding:7px 2px;border-bottom:1px solid #2a220f80;' + MONO + 'font-size:12.5px;line-height:1.5;color:#e8dfc8;"><span style="color:#d6b34a;">☐</span><span>' + L(it[0], it[1]) + '</span></div>';
      }).join('');
      return '<div style="background:#171207;border:1.5px solid #3a2f14;border-radius:12px;margin-bottom:10px;overflow:hidden;">' +
        '<button onclick="tierSWToggle(' + i + ')" style="width:100%;text-align:left;background:none;border:none;padding:13px 14px;display:flex;align-items:center;gap:11px;cursor:pointer;">' +
          '<span style="font-size:20px;">' + r.icon + '</span>' +
          '<span style="flex:1;">' +
            '<span style="' + MONO + 'font-size:13px;font-weight:700;color:#f0e6c8;display:block;">' + L(r.title[0], r.title[1]) + '</span>' +
            '<span style="' + MONO + 'font-size:10px;color:#a08a4a;">' + L(r.who[0], r.who[1]) + '</span>' +
          '</span>' +
          '<span id="tsw-chev-' + i + '" style="color:#d6b34a;font-size:15px;">▸</span>' +
        '</button>' +
        '<div id="tsw-body-' + i + '" style="display:none;padding:2px 14px 12px;">' + items + '</div>' +
      '</div>';
    }).join('');
    o.innerHTML = '<div style="max-width:720px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 26px) 14px 60px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">' +
        '<button onclick="closeTierSW()" style="padding:11px 16px;background:#1a1408;border:1.5px solid #7a5a1a;border-radius:50px;color:#e8c96a;' + MONO + 'font-size:13px;font-weight:700;cursor:pointer;">← ' + L('Back', 'Atrás') + '</button>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:26px;letter-spacing:2px;line-height:1;color:#f0e6c8;">📘 ' + L('TIER STANDARD WORK', 'TRABAJO ESTÁNDAR TIER') + '</div>' +
          '<div style="' + MONO + 'font-size:10px;color:#a08a4a;margin-top:2px;">' + L('Who feeds the boards, every day', 'Quién alimenta los tableros, cada día') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="' + MONO + 'font-size:11px;color:#c9b478;background:#171207;border:1px solid #3a2f14;border-radius:10px;padding:10px 12px;margin-bottom:14px;line-height:1.5;">' +
        L('If every leader does their card daily, every light on the Tier boards is real. Green means green.',
          'Si cada líder cumple su tarjeta a diario, cada luz de los tableros es real. Verde significa verde.') + '</div>' +
      cards + '</div>';
    o.style.display = 'block';
    try { window.scrollTo(0, 0); } catch (e) {}
  };
})();
