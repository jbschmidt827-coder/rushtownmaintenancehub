// ═══════════════════════════════════════════════════════════════════════════
// help.js — How To Use / Instructions
// A clickable, department-organized guide. Static content (works offline).
// Reached from the "📖 How To Use" button on the home screen.
// Each task shows SIMPLE numbered steps + a "More detail" toggle for supervisors.
// ═══════════════════════════════════════════════════════════════════════════

// ── Language helpers (resolve at RENDER TIME so the 🌐 toggle updates live) ───
function _hlang(){ try { return (typeof _lang !== 'undefined' && _lang === 'es') ? 'es' : 'en'; } catch(e){ return 'en'; } }
function hT(v){ return (v && typeof v === 'object' && !Array.isArray(v) && ('en' in v)) ? (v[_hlang()] != null ? v[_hlang()] : v.en) : v; }

// ── Content model ───────────────────────────────────────────────────────────
// Departments → tasks → { title, simple:[steps], detail:[notes] }
// User-facing strings are {en, es} objects resolved through hT() at render time.
const HELP_CONTENT = [
  {
    id: 'barns',
    icon: '🐓',
    name: { en: 'Barns / Daily Walks', es: 'Galpones / Recorridos Diarios' },
    color: '#4ade80',
    blurb: { en: 'Morning Walk · Barn Walk · Daily Employee Check', es: 'Recorrido de la Mañana · Recorrido del Galpón · Chequeo Diario del Empleado' },
    tasks: [
      {
        title: { en: '☀️ Morning Walk & Barn Walk (start of shift)', es: '☀️ Recorrido de la Mañana y del Galpón (inicio del turno)' },
        simple: [
          { en: 'From the home screen, tap your location (Hegins or Danville).', es: 'En la pantalla de inicio, toca tu ubicación (Hegins o Danville).' },
          { en: 'Tap the green PRODUCTION tile.', es: 'Toca el cuadro verde de PRODUCCIÓN.' },
          { en: 'Step 1 — type your name. Step 2 — pick the farm. Step 3 — pick the house.', es: 'Paso 1 — escribe tu nombre. Paso 2 — elige la granja. Paso 3 — elige el galpón.' },
          { en: 'MORNING WALK: enter Water PSI (normal is 10–60), Temp, Headcount. Tap Feeders / Fans / Blowers OK or Issue.', es: 'RECORRIDO DE LA MAÑANA: ingresa la presión de agua PSI (lo normal es 10–60), Temperatura y Conteo de aves. Toca Comederos / Ventiladores / Sopladores: OK o Problema.' },
          { en: 'BARN WALK: enter Dead Birds Found (type 0 if none), Loose Birds, Bin A and Bin B tons. Mark Water OK and Rodent activity. Add notes if needed.', es: 'RECORRIDO DEL GALPÓN: ingresa Aves Muertas Encontradas (escribe 0 si no hay), Aves Sueltas, toneladas del Silo A y Silo B. Marca Agua OK y actividad de Roedores. Agrega notas si hace falta.' },
          { en: 'Tap ✓ Submit Barn Walk. You will see "Done!"', es: 'Toca ✓ Enviar Recorrido del Galpón. Verás "¡Listo!"' },
        ],
        detail: [
          { en: 'Required fields are marked with *. Water PSI and Dead Birds must be filled before you can submit.', es: 'Los campos obligatorios llevan *. La presión de agua PSI y las Aves Muertas deben llenarse antes de poder enviar.' },
          { en: 'The PSI box turns red and warns you if the number is outside 10–60. The Dead Birds box turns red if more than 0 — that walk gets flagged on the Scorecard.', es: 'La casilla de PSI se pone roja y te avisa si el número está fuera de 10–60. La casilla de Aves Muertas se pone roja si es más de 0 — ese recorrido se marca en el Tablero.' },
          { en: 'Your work auto-saves as a draft as you type, so if the iPad sleeps or closes you can pick up where you left off.', es: 'Tu trabajo se guarda solo como borrador mientras escribes, así que si el iPad se apaga o se cierra puedes seguir donde quedaste.' },
          { en: 'Do one house at a time. After you submit, start again at Pick House for the next barn.', es: 'Haz un galpón a la vez. Después de enviar, vuelve a empezar en Elegir Galpón para el siguiente.' },
          { en: 'No internet? It still saves and sends automatically once you are back online.', es: '¿Sin internet? Igual se guarda y se envía solo en cuanto vuelvas a tener conexión.' },
        ],
      },
      {
        title: { en: '✅ Daily Employee Check (block-by-block)', es: '✅ Chequeo Diario del Empleado (bloque por bloque)' },
        simple: [
          { en: 'Location → PRODUCTION → Daily Employee Check → pick the house.', es: 'Ubicación → PRODUCCIÓN → Chequeo Diario del Empleado → elige la casa.' },
          { en: 'Your name fills in automatically from your login.', es: 'Tu nombre se llena solo desde tu inicio de sesión.' },
          { en: 'Tap ✅ EVERYTHING NORMAL at the top to mark every condition normal — then just change anything that is actually off.', es: 'Toca ✅ TODO NORMAL arriba para marcar todo normal — luego cambia solo lo que en verdad esté mal.' },
          { en: 'Work top-to-bottom through the 7 time blocks: (1) 7:00–7:15 quick feed/water/vent, (2) 7:15–9:00 mortality & bird check, (3) 9:00–12:00 cleaning, (4) 12:30–1:00 hallways, (5) after the house runs — under the egg collectors, (6) equipment check, (7) end of day.', es: 'Avanza de arriba a abajo por los 7 bloques: (1) 7:00–7:15 alimento/agua/ventilación, (2) 7:15–9:00 mortalidad y revisión de aves, (3) 9:00–12:00 limpieza, (4) 12:30–1:00 pasillos, (5) después de correr la casa — bajo los colectores, (6) revisión de equipo, (7) fin del día.' },
          { en: 'If feed/water or mortality has an issue, tap the boxes that apply (powdery feed, empty lines, blowouts, old mortality, etc.).', es: 'Si hay problema de alimento/agua o mortalidad, toca las casillas que apliquen (alimento en polvo, líneas vacías, reventones, mortalidad vieja, etc.).' },
          { en: 'Tap Submit when done — it shows on the Live Board the moment you submit.', es: 'Toca Enviar al terminar — aparece en el Tablero en Vivo al instante.' },
        ],
        detail: [
          { en: 'Cleaning rotates by day and ONLY today\'s job shows: blow out the house Sun/Tue/Thu, clean under the cages Mon/Wed/Fri, hallways Sun/Tue/Thu, nothing on Saturday.', es: 'La limpieza rota por día y SOLO aparece la de hoy: soplar la casa Dom/Mar/Jue, limpiar bajo las jaulas Lun/Mié/Vie, pasillos Dom/Mar/Jue, nada el sábado.' },
          { en: 'The % only reaches 100% when the real task work is reviewed — not just the top condition cards.', es: 'El % solo llega a 100% cuando se revisa el trabajo real de las tareas — no solo las tarjetas de arriba.' },
          { en: 'Progress is shared live across all iPads — anyone can pick up a check already started for that house without losing anything.', es: 'El avance se comparte en vivo entre iPads — cualquiera puede continuar un chequeo ya empezado sin perder nada.' },
          { en: 'Opening a house that is already done shows a read-only summary first — tap "Edit this check" only if you need to change it, so a finished check is never overwritten by accident.', es: 'Abrir una casa ya terminada muestra primero un resumen de solo lectura — toca "Editar" solo si necesitas cambiarlo, para no sobrescribir un chequeo terminado por accidente.' },
          { en: 'A house not submitted by midnight is counted INCOMPLETE and cleared — each day starts fresh.', es: 'Una casa no enviada antes de medianoche cuenta como INCOMPLETA y se borra — cada día empieza de cero.' },
        ],
      },
      {
        title: { en: '📋 End-of-Shift report (before you leave)', es: '📋 Reporte de Fin de Turno (antes de irte)' },
        simple: [
          { en: 'Location → PRODUCTION → End-of-Shift (under Morning Walk).', es: 'Ubicación → PRODUCCIÓN → Fin de Turno (debajo del Recorrido de la Mañana).' },
          { en: 'Review the auto-summary of the day at the top.', es: 'Revisa el resumen automático del día que aparece arriba.' },
          { en: 'Check off the end-of-shift items.', es: 'Marca los puntos de fin de turno.' },
          { en: 'Type your name to sign off, then tap Submit.', es: 'Escribe tu nombre para firmar y luego toca Enviar.' },
        ],
        detail: [
          { en: 'The summary is built for you from the day\'s walks and work — you just confirm and sign.', es: 'El resumen se arma solo con los recorridos y el trabajo del día — tú solo confirmas y firmas.' },
          { en: 'It is per-facility, so do it for the site you worked.', es: 'Es por instalación, así que hazlo para el sitio donde trabajaste.' },
        ],
      },
      {
        title: { en: '💩 Manure — 2-hr belt run, per-collector checks & Submit', es: '💩 Estiércol — banda 2 h, revisiones por colector y Enviar' },
        simple: [
          { en: 'Location (Hegins or Danville) → tap the 💩 Manure card.', es: 'Ubicación (Hegins o Danville) → toca la tarjeta 💩 Estiércol.' },
          { en: 'Each house is blocked out 2.0 hours to run its belts. Tap 🕐 Belt-run times to set each house\'s start time (they save for everyone).', es: 'Cada galpón tiene 2.0 horas para correr sus bandas. Toca 🕐 Horarios banda para fijar la hora de inicio de cada galpón (se guardan para todos).' },
          { en: 'During its window a house shows "🟢 Running now"; after the window it shows "⚠ Past window" until you submit it.', es: 'Durante su ventana el galpón muestra "🟢 Corriendo ahora"; después muestra "⚠ Fuera de la ventana" hasta que lo envíes.' },
          { en: 'For every collector (C1–C6): tap how much of the belt ran (0, 50, or 100), then tick PM, Belt (looked over), Clean, and Align.', es: 'Para cada colector (C1–C6): toca cuánto corrió la banda (0, 50 o 100) y luego marca PM, Banda (revisada), Limpio y Alin.' },
          { en: 'If a belt can’t run or has a rip, tap ⚠ on that collector, then pick "Can’t run" or a rip level 1–3 (3 = worst). That makes a Work Order automatically.', es: 'Si una banda no corre o tiene una rasgadura, toca ⚠ en ese colector y elige "No corre" o un nivel de rasgadura 1–3 (3 = peor). Eso crea una Orden de Trabajo automáticamente.' },
          { en: 'Per-house shortcuts: All 100% sets every belt to 100; ✓ All checks marks PM, Belt, Clean and Align for all six collectors.', es: 'Atajos por galpón: Todo 100% pone cada banda en 100; ✓ Todo marca PM, Banda, Limpio y Alin. en los seis colectores.' },
          { en: 'Manure tech: tap ☐ Mark weekly PM on each house once its weekly manure PM is done.', es: 'Técnico de estiércol: toca ☐ Marcar PM semanal en cada galpón cuando termines su PM semanal.' },
          { en: 'When a house is finished, tap ✓ Submit House — daily.', es: 'Cuando termines un galpón, toca ✓ Enviar Galpón — diario.' },
        ],
        detail: [
          { en: 'Houses shown: Hegins 4–8, Danville 1–5, six collectors each. It saves as you tap — no separate Save. A house down for repair is skipped automatically.', es: 'Galpones mostrados: Hegins 4–8, Danville 1–5, seis colectores cada uno. Se guarda al tocar — no hay un Guardar aparte. Un galpón en reparación se omite automáticamente.' },
          { en: 'The 2.0-hour windows stagger by default so no two houses run at once — change any of them with the 🕐 Belt-run times button; the times save to the whole team.', es: 'Las ventanas de 2.0 horas se escalonan por defecto para que no corran dos galpones a la vez — cambia cualquiera con el botón 🕐 Horarios banda; las horas se guardan para todo el equipo.' },
          { en: 'The four checks per collector are: PM (daily PM done), Belt (belt looked over), Clean (collector cleaned up), Align (alignment OK).', es: 'Las cuatro revisiones por colector son: PM (PM diario hecho), Banda (banda revisada), Limpio (colector limpiado), Alin. (alineación correcta).' },
          { en: 'Belt problems make a Work Order for you, priority set automatically: can’t-run or rip 3 = Urgent, rip 2 = High, rip 1 = Routine. It is one work order per collector — changing the level updates that same order, so no duplicates. Tap the same rip level again to clear it.', es: 'Los problemas de banda crean una Orden de Trabajo sola, con prioridad automática: no corre o rasgadura 3 = Urgente, rasgadura 2 = Alta, rasgadura 1 = Rutina. Es una orden por colector — cambiar el nivel actualiza esa misma orden, sin duplicados. Toca el mismo nivel otra vez para quitarlo.' },
          { en: 'Once EVERY house for the site is submitted for the day, the daily manure PMs (run belts, check belts, drying fans, trip switch) check themselves off in the Maintenance PM tracker automatically — no double entry.', es: 'Una vez que TODOS los galpones del sitio se envían en el día, los PM diarios de estiércol (correr bandas, revisar bandas, ventiladores de secado, interruptor de seguridad) se marcan solos en el rastreador de PM de Mantenimiento — sin doble captura.' },
          { en: 'Once EVERY house has its weekly box ticked, the weekly manure PMs (clean pit, auger rollers, belt tracking…) check off in the tracker too.', es: 'Una vez que TODOS los galpones tienen su casilla semanal marcada, los PM semanales de estiércol (limpiar foso, rodillos del sinfín, alineación de banda…) también se marcan en el rastreador.' },
          { en: 'Master shows both Hegins and Danville; the Processing Plant has no manure houses.', es: 'Master muestra Hegins y Danville juntos; la Planta de Procesamiento no tiene galpones de estiércol.' },
        ],
      },
      {
        title: { en: '📊 Completion dashboard (what\'s done today)', es: '📊 Tablero de Cumplimiento (qué falta hoy)' },
        simple: [
          { en: 'On a location home (or Master), tap the 📊 Completion card.', es: 'En el inicio de una ubicación (o Master), toca la tarjeta 📊 Cumplimiento.' },
          { en: 'You get a grid: each house (rows) vs each daily check — Morning Walk, Daily Check, Manure.', es: 'Verás una cuadrícula: cada galpón (filas) contra cada revisión diaria — Recorrido de la Mañana, Chequeo Diario, Estiércol.' },
          { en: 'Green ✓ = done today, red ✗ = still open, — = not needed for that house.', es: 'Verde ✓ = hecho hoy, rojo ✗ = pendiente, — = no aplica a ese galpón.' },
          { en: 'The big number up top is today\'s overall % complete. Tap ↻ Refresh to re-check.', es: 'El número grande de arriba es el % total completo de hoy. Toca ↻ Actualizar para volver a revisar.' },
        ],
        detail: [
          { en: 'Master shows Hegins and Danville together; each site shows only its own houses.', es: 'Master muestra Hegins y Danville juntos; cada sitio muestra solo sus propios galpones.' },
          { en: 'Use it at the morning standup to spot in seconds which house or check got missed.', es: 'Úsalo en la reunión de la mañana para ver en segundos qué galpón o revisión se saltó.' },
        ],
      },
    ],
  },
  {
    id: 'maint',
    icon: '🔧',
    name: { en: 'Maintenance / Work Orders', es: 'Mantenimiento / Órdenes de Trabajo' },
    color: '#3b82f6',
    blurb: { en: 'New work order · PMs · Mark done', es: 'Nueva orden de trabajo · PM · Marcar terminado' },
    tasks: [
      {
        title: { en: '🔧 Enter a Work Order', es: '🔧 Crear una Orden de Trabajo' },
        simple: [
          { en: 'On the home screen tap "🔧 New Work Order" (or open Maintenance → New Work Order).', es: 'En la pantalla de inicio toca "🔧 Nueva Orden de Trabajo" (o abre Mantenimiento → Nueva Orden de Trabajo).' },
          { en: 'Pick the Farm, then pick the House.', es: 'Elige la Granja y luego el Galpón.' },
          { en: 'Write a short Problem (e.g. "H3 fan belt squealing").', es: 'Escribe un Problema corto (ej. "Banda del ventilador del G3 rechina").' },
          { en: 'Add a Description — what you saw, heard, or measured.', es: 'Agrega una Descripción — lo que viste, escuchaste o mediste.' },
          { en: 'Set Priority: 🔴 Urgent, 🟡 High, or 🟢 Routine.', es: 'Define la Prioridad: 🔴 Urgente, 🟡 Alta o 🟢 Rutina.' },
          { en: 'Put your name in "Submitted by" and tap Submit.', es: 'Pon tu nombre en "Enviado por" y toca Enviar.' },
        ],
        detail: [
          { en: 'If a similar open work order already exists, the app warns you so you do not create a duplicate.', es: 'Si ya existe una orden de trabajo abierta parecida, la app te avisa para que no crees un duplicado.' },
          { en: 'No internet? It saves and shows "Saved — Will Send When Online," then sends automatically when you reconnect.', es: '¿Sin internet? Se guarda y muestra "Guardado — Se enviará al conectar", y se envía solo cuando vuelvas a tener conexión.' },
          { en: 'Urgent and High work orders send a notification to the maintenance team right away.', es: 'Las órdenes Urgentes y de prioridad Alta envían un aviso al equipo de mantenimiento de inmediato.' },
          { en: 'You can also start a work order straight from a barn walk issue — it carries the note over for you.', es: 'También puedes crear una orden de trabajo directo desde un problema del recorrido del galpón — pasa la nota por ti.' },
        ],
      },
      {
        title: { en: '🛠 Do a PM and Mark It Done', es: '🛠 Hacer un PM y Marcarlo Terminado' },
        simple: [
          { en: 'Open Maintenance → PM (preventive maintenance) list.', es: 'Abre Mantenimiento → lista de PM (mantenimiento preventivo).' },
          { en: 'Tap the PM you are doing.', es: 'Toca el PM que vas a hacer.' },
          { en: 'Work down the checklist — tap each step to check it off.', es: 'Baja por la lista — toca cada paso para marcarlo.' },
          { en: 'When every step is checked, tap Mark Done.', es: 'Cuando todos los pasos estén marcados, toca Marcar Terminado.' },
          { en: 'Enter your name on the sign-off and confirm.', es: 'Escribe tu nombre en la firma y confirma.' },
        ],
        detail: [
          { en: 'Mark Done stays locked until all checklist steps are ticked — this enforces the procedure.', es: 'Marcar Terminado queda bloqueado hasta marcar todos los pasos de la lista — así se cumple el procedimiento.' },
          { en: 'To knock out several at once, use Bulk PM select and choose the daily / weekly / MWF group.', es: 'Para hacer varios a la vez, usa Selección de PM en lote y elige el grupo diario / semanal / LMV (lunes-miércoles-viernes).' },
          { en: 'Procedures can be edited by a supervisor; changes are saved and show for everyone next time.', es: 'Un supervisor puede editar los procedimientos; los cambios se guardan y aparecen para todos la próxima vez.' },
          { en: 'Bulk PM and sign-offs also work offline and sync later.', es: 'El PM en lote y las firmas también funcionan sin conexión y se sincronizan después.' },
        ],
      },
      {
        title: { en: '✏️ Edit a work order after it is submitted', es: '✏️ Editar una orden de trabajo ya enviada' },
        simple: [
          { en: 'Open Maintenance → Work Orders and find the order (it may be in the Action Rail).', es: 'Abre Mantenimiento → Órdenes de Trabajo y busca la orden (puede estar en la Barra de Acción).' },
          { en: 'Tap the ✏️ Edit button on the card.', es: 'Toca el botón ✏️ Editar en la tarjeta.' },
          { en: 'Change the problem, description, priority, who it is assigned to, parts, or hours.', es: 'Cambia el problema, la descripción, la prioridad, a quién está asignada, las piezas o las horas.' },
          { en: 'Tap Save Changes.', es: 'Toca Guardar Cambios.' },
        ],
        detail: [
          { en: 'Use this to fix a typo, bump priority, or reassign — no need to delete and re-create.', es: 'Úsalo para corregir un error, subir la prioridad o reasignar — sin borrar y volver a crear.' },
          { en: 'It does not change the location or house; make a new one if those are wrong.', es: 'No cambia la ubicación ni el galpón; crea una nueva si esos están mal.' },
        ],
      },
      {
        title: { en: '⚡ Action Rail — your live to-do list', es: '⚡ Barra de Acción — tu lista de pendientes en vivo' },
        simple: [
          { en: 'On any work order card, tap the ⚡ button to move it up to the Action Rail.', es: 'En cualquier tarjeta de orden de trabajo, toca el botón ⚡ para subirla a la Barra de Acción.' },
          { en: 'From the rail: ✓ Done closes it out, 💬 Update adds a note, ↩ To List sends it back.', es: 'Desde la barra: ✓ Terminado la cierra, 💬 Actualizar agrega una nota, ↩ A la Lista la regresa.' },
          { en: 'Use the rail for the few jobs you are actively working right now.', es: 'Usa la barra para los pocos trabajos en los que estás trabajando ahora mismo.' },
        ],
        detail: [
          { en: 'Closing from the rail opens the normal close-out (who did it, parts, photos), then it drops off the rail.', es: 'Cerrar desde la barra abre el cierre normal (quién lo hizo, piezas, fotos) y luego sale de la barra.' },
          { en: 'Sending a work order to the rail also adds it to that site\'s Projects list automatically (once), so bigger jobs get tracked.', es: 'Enviar una orden a la barra también la agrega a la lista de Proyectos de ese sitio automáticamente (una vez), para dar seguimiento a trabajos grandes.' },
          { en: 'The 📋 button flags a work order for the meeting agenda.', es: 'El botón 📋 marca una orden de trabajo para la agenda de la reunión.' },
        ],
      },
      {
        title: { en: '📖 Edit or add a Work Instruction (WI)', es: '📖 Editar o agregar una Instrucción de Trabajo (WI)' },
        simple: [
          { en: 'Open Maintenance → WI (Work Instructions).', es: 'Abre Mantenimiento → WI (Instrucciones de Trabajo).' },
          { en: 'Tap a WI to open it, then tap Edit — or use + New to add one.', es: 'Toca una WI para abrirla y luego toca Editar — o usa + Nueva para agregar una.' },
          { en: 'Fill in the title, department, and step-by-step instructions; add photos if helpful.', es: 'Llena el título, el departamento y las instrucciones paso a paso; agrega fotos si ayudan.' },
          { en: 'Tap Save.', es: 'Toca Guardar.' },
        ],
        detail: [
          { en: 'Edited or new WIs save for everyone and show next time that task is opened.', es: 'Las WI editadas o nuevas se guardan para todos y aparecen la próxima vez que se abra esa tarea.' },
          { en: 'Photos store right in the instruction, so they work offline.', es: 'Las fotos se guardan dentro de la instrucción, así que funcionan sin conexión.' },
        ],
      },
      {
        title: { en: '🛠 Edit a PM procedure (its steps)', es: '🛠 Editar un procedimiento de PM (sus pasos)' },
        simple: [
          { en: 'Open Maintenance → PM and tap the PM you want to change.', es: 'Abre Mantenimiento → PM y toca el PM que quieres cambiar.' },
          { en: 'Tap Edit Procedure.', es: 'Toca Editar Procedimiento.' },
          { en: 'Add or change the Safety, Tools, Steps, and Corrective items.', es: 'Agrega o cambia los puntos de Seguridad, Herramientas, Pasos y Correctivos.' },
          { en: 'Tap Save — the updated procedure then shows for everyone.', es: 'Toca Guardar — el procedimiento actualizado aparece para todos.' },
        ],
        detail: [
          { en: 'This keeps the checklist current as a machine or process changes.', es: 'Esto mantiene la lista al día cuando una máquina o un proceso cambia.' },
          { en: 'The built-in steps stay as a fallback until you save an edit.', es: 'Los pasos originales quedan como respaldo hasta que guardes una edición.' },
        ],
      },
      {
        title: { en: '🗂 Add a maintenance project', es: '🗂 Agregar un proyecto de mantenimiento' },
        simple: [
          { en: 'Open Maintenance → Projects.', es: 'Abre Mantenimiento → Proyectos.' },
          { en: 'Tap + New Project.', es: 'Toca + Nuevo Proyecto.' },
          { en: 'Type a title (that is all that is required) — optionally the machine, who is assigned, and a due date.', es: 'Escribe un título (es lo único obligatorio) — opcionalmente la máquina, a quién se asigna y una fecha límite.' },
          { en: 'Add tasks one per line, then tap the chips: Requested by (Team / Management), What\'s it for (5S, Barns, Equipment…), and Priority.', es: 'Agrega tareas, una por línea, y luego toca las etiquetas: Solicitado por (Equipo / Gerencia), Para qué es (5S, Galpones, Equipo…) y Prioridad.' },
          { en: 'Tap Create Project.', es: 'Toca Crear Proyecto.' },
        ],
        detail: [
          { en: 'Use projects for bigger efforts that are more than one work order — a rebuild, a 5S push, etc.', es: 'Usa los proyectos para trabajos grandes que son más de una orden — una reconstrucción, un esfuerzo de 5S, etc.' },
          { en: 'Tap a task to check it off; the progress bar fills as you go, and urgent projects float to the top.', es: 'Toca una tarea para marcarla; la barra de progreso se llena conforme avanzas y los proyectos urgentes suben al inicio.' },
          { en: 'Projects are per-location, just like work orders.', es: 'Los proyectos son por ubicación, igual que las órdenes de trabajo.' },
        ],
      },
    ],
  },
  {
    id: 'processing',
    icon: '🏭',
    name: { en: 'Processing Plant', es: 'Planta de Procesamiento' },
    color: '#d69e2e',
    blurb: { en: 'Cases · Downtime · Breakage · Maintenance', es: 'Cajas · Paros · Rotura · Mantenimiento' },
    tasks: [
      {
        title: { en: '🏭 Open the Processing Plant', es: '🏭 Abrir la Planta de Procesamiento' },
        simple: [
          { en: 'On the front screen (where you pick a location), tap the PROCESSING button.', es: 'En la pantalla inicial (donde eliges la ubicación), toca el botón PROCESAMIENTO.' },
          { en: 'You will see three cards: Maintenance, Packing Log, and Processing PMs.', es: 'Verás tres tarjetas: Mantenimiento, Registro de Empaque y PM de Procesamiento.' },
          { en: 'Maintenance and Processing PMs show ONLY the plant now — no Hegins or Danville mixed in.', es: 'Mantenimiento y los PM de Procesamiento muestran SOLO la planta ahora — sin mezclar Hegins ni Danville.' },
          { en: 'You can create new plant work orders right from there.', es: 'Puedes crear nuevas órdenes de trabajo de la planta directo desde ahí.' },
        ],
        detail: [
          { en: 'Processing is its own location button — Hegins and Danville do not show it.', es: 'Procesamiento es su propio botón de ubicación — Hegins y Danville no lo muestran.' },
          { en: 'Master still brings everything together, including the plant.', es: 'Master sigue juntando todo, incluida la planta.' },
        ],
      },
      {
        title: { en: '📦 Log packing — cases, downtime, breakage', es: '📦 Registrar empaque — cajas, paros, rotura' },
        simple: [
          { en: 'Processing → Packing Log.', es: 'Procesamiento → Registro de Empaque.' },
          { en: 'Pick the line (Packer 1, 2, …).', es: 'Elige la línea (Empacadora 1, 2, …).' },
          { en: 'Enter the Start time and Stop time for that packer.', es: 'Ingresa la Hora de inicio y la Hora de fin de esa empacadora.' },
          { en: 'Enter Cases packed, any Downtime (minutes + a reason), and Breakage / cracks.', es: 'Ingresa Cajas empacadas, cualquier Paro (minutos + un motivo) y Rotura / huevos rotos.' },
          { en: 'Tap ✓ Log Packing.', es: 'Toca ✓ Registrar Empaque.' },
        ],
        detail: [
          { en: 'The top shows today\'s totals — cases packed, downtime minutes, and breakage.', es: 'Arriba se ven los totales del día — cajas empacadas, minutos de paro y rotura.' },
          { en: 'Start/Stop times figure the run minutes for each packer, shown as ▶ Xm in the by-line breakdown below.', es: 'Las horas de inicio/fin calculan los minutos de corrida de cada empacadora, mostrados como ▶ Xm en el desglose por línea.' },
          { en: 'Everything saves and syncs like the rest of the app.', es: 'Todo se guarda y se sincroniza como el resto de la app.' },
        ],
      },
      {
        title: { en: '🥚 Daily Egg Run + pallet inventory & shipping', es: '🥚 Corrida Diaria de Huevos + inventario y envío de pallets' },
        simple: [
          { en: 'Processing → Daily Egg Run.', es: 'Procesamiento → Corrida Diaria de Huevos.' },
          { en: 'Per machine, type total run time (minutes) and total eggs — eggs/hr is figured for you.', es: 'Por máquina, escribe el tiempo total (minutos) y el total de huevos — huevos/hr se calcula solo.' },
          { en: 'Under "Packed pallets", add each pallet: pick Conventional or Non-conventional, type total eggs and a lot #, tap + Add.', es: 'En "Pallets empacados", agrega cada pallet: elige Convencional o No convencional, escribe el total de huevos y un lote #, toca + Agregar.' },
          { en: 'To ship: tick the pallets, type the customer and date, tap 🚚 Ship — they leave inventory.', es: 'Para enviar: marca los pallets, escribe el cliente y la fecha, toca 🚚 Enviar — salen del inventario.' },
        ],
        detail: [
          { en: 'The top box shows today\'s run time, eggs, and eggs/hr per plant.', es: 'La caja de arriba muestra el tiempo, huevos y huevos/hr de hoy por planta.' },
          { en: 'Inventory shows every pallet still in stock, split Conventional vs Non-conventional, with pallet and egg totals.', es: 'El inventario muestra cada pallet en existencia, dividido Convencional vs No convencional, con totales de pallets y huevos.' },
          { en: 'Everything is live across iPads and stamps who + when.', es: 'Todo está en vivo entre iPads y registra quién y cuándo.' },
        ],
      },
    ],
  },
  {
    id: 'basics',
    icon: '⚙️',
    name: { en: 'Getting Around', es: 'Cómo Moverte en la App' },
    color: '#9ca3af',
    blurb: { en: 'Locations · Language · Brightness', es: 'Ubicaciones · Idioma · Brillo' },
    tasks: [
      {
        title: { en: '📍 Switch location (Hegins / Danville / Processing / Master)', es: '📍 Cambiar de ubicación (Hegins / Danville / Procesamiento / Master)' },
        simple: [
          { en: 'On the front screen, tap the location you want: Hegins, Danville, Processing Plant, or Master.', es: 'En la pantalla inicial, toca la ubicación que quieres: Hegins, Danville, Planta de Procesamiento o Master.' },
          { en: 'Work orders, PMs, and staff then show just that site.', es: 'Las órdenes de trabajo, los PM y el personal muestran solo ese sitio.' },
          { en: 'Master shows every site combined.', es: 'Master muestra todos los sitios juntos.' },
        ],
        detail: [
          { en: 'The app remembers your last location for next time.', es: 'La app recuerda tu última ubicación para la próxima vez.' },
          { en: 'Tap ← Back (top-left) to step back one screen; from a site home it returns to the location picker.', es: 'Toca ← Atrás (arriba a la izquierda) para retroceder una pantalla; desde el inicio de un sitio vuelve al selector de ubicación.' },
        ],
      },
      {
        title: { en: '🌐 Language & 🔆 brightness', es: '🌐 Idioma y 🔆 brillo' },
        simple: [
          { en: 'Tap the 🌐 button at the top of the front screen to switch English ⇄ Spanish.', es: 'Toca el botón 🌐 arriba en la pantalla inicial para cambiar entre Inglés ⇄ Español.' },
          { en: 'Tap Dark, Light, or White at the top to change the background brightness.', es: 'Toca Oscuro, Claro o Blanco arriba para cambiar el brillo del fondo.' },
        ],
        detail: [
          { en: 'Both choices are remembered on that tablet.', es: 'Ambas opciones se recuerdan en esa tableta.' },
          { en: 'Use White or Light when reading in bright daylight.', es: 'Usa Blanco o Claro cuando leas con mucha luz del día.' },
        ],
      },
      {
        title: { en: '👥 Add a team member & set their site', es: '👥 Agregar a alguien del equipo y asignar su sitio' },
        simple: [
          { en: 'Open Staff from the home screen.', es: 'Abre Personal desde la pantalla de inicio.' },
          { en: 'Add the person\'s name and role.', es: 'Agrega el nombre y el puesto de la persona.' },
          { en: 'On their card, tap Hegins, Danville, or Both to set where they work.', es: 'En su tarjeta, toca Hegins, Danville o Ambos para definir dónde trabaja.' },
          { en: 'That keeps each site\'s name lists correct when picking who did the work.', es: 'Eso mantiene correctas las listas de nombres de cada sitio al elegir quién hizo el trabajo.' },
        ],
        detail: [
          { en: 'Only people tagged to a site (or Both, for maintenance techs) show in that site\'s pickers.', es: 'Solo las personas asignadas a un sitio (o Ambos, para técnicos de mantenimiento) aparecen en los selectores de ese sitio.' },
          { en: 'Anyone left untagged is flagged in amber so you can fix it.', es: 'Quien quede sin asignar se marca en ámbar para que lo arregles.' },
        ],
      },
    ],
  },
];

// ── Render ────────────────────────────────────────────────────────────────
function _helpStepList(steps, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const items = steps.map(s => `<li style="margin-bottom:7px;line-height:1.5;">${hT(s)}</li>`).join('');
  return `<${tag} style="margin:6px 0 0;padding-left:20px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#d8e8d8;">${items}</${tag}>`;
}

function _helpTaskCard(task, deptColor, key) {
  return `
    <div style="background:#0a1a0a;border:1px solid #1e3a1e;border-radius:12px;margin-bottom:10px;overflow:hidden;">
      <button onclick="helpToggle('task-${key}')" style="width:100%;padding:13px 14px;background:transparent;border:none;color:#f0ead8;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;">
        <span style="flex:1;line-height:1.3;">${hT(task.title)}</span>
        <span id="task-${key}-caret" style="color:${deptColor};font-size:16px;">+</span>
      </button>
      <div id="task-${key}" style="display:none;padding:0 14px 14px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${deptColor};letter-spacing:2px;text-transform:uppercase;margin:4px 0 2px;">${_hlang()==='es' ? 'Pasos Rápidos' : 'Quick Steps'}</div>
        ${_helpStepList(task.simple, true)}
        <button onclick="helpToggle('detail-${key}',this)" style="margin-top:12px;padding:7px 12px;background:#0d1f0d;border:1px solid #2a5a2a;border-radius:50px;color:#7ab07a;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;">${_hlang()==='es' ? 'ℹ️ Más detalle' : 'ℹ️ More detail'}</button>
        <div id="detail-${key}" style="display:none;margin-top:10px;padding:11px 13px;background:#081208;border-left:3px solid ${deptColor};border-radius:6px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${deptColor};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${_hlang()==='es' ? 'Bueno saber' : 'Good to know'}</div>
          ${_helpStepList(task.detail, false)}
        </div>
      </div>
    </div>`;
}

function _helpDeptCard(dept) {
  const tasksHtml = dept.tasks.map((t, i) => _helpTaskCard(t, dept.color, dept.id + '-' + i)).join('');
  return `
    <div style="margin-bottom:14px;">
      <button onclick="helpToggle('dept-${dept.id}',this)" style="width:100%;padding:16px 16px;background:linear-gradient(135deg,#10241a,#0b1a0b);border:2px solid ${dept.color};border-radius:14px;color:#fff;cursor:pointer;text-align:left;display:flex;align-items:center;gap:14px;">
        <span style="font-size:28px;line-height:1;">${dept.icon}</span>
        <div style="flex:1;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:#f0ead8;letter-spacing:1.5px;text-transform:uppercase;">${hT(dept.name)}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7ab07a;line-height:1.4;margin-top:3px;">${hT(dept.blurb)}</div>
        </div>
        <span id="dept-${dept.id}-caret" style="font-size:20px;color:${dept.color};">+</span>
      </button>
      <div id="dept-${dept.id}" style="display:none;padding:12px 4px 2px;">
        ${tasksHtml}
      </div>
    </div>`;
}

function renderHelp() {
  const body = document.getElementById('help-body');
  if (!body) return;
  body.innerHTML = `
    <div style="background:#0d1f0d;border:1px solid #1e3a1e;border-radius:12px;padding:13px 15px;margin-bottom:16px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#9cc79c;line-height:1.6;">
        ${_hlang()==='es'
          ? 'Toca un departamento abajo para ver cómo hacer cada tarea. Cada tarea tiene <b style="color:#f0ead8;">Pasos Rápidos</b> a seguir y un botón de <b style="color:#f0ead8;">Más detalle</b> con consejos y casos especiales.'
          : 'Tap a department below to see how to do each task. Each task has <b style="color:#f0ead8;">Quick Steps</b> to follow, and a <b style="color:#f0ead8;">More detail</b> button for tips and edge cases.'}
      </div>
    </div>
    ${HELP_CONTENT.map(_helpDeptCard).join('')}`;
}

// ── Toggle helper ───────────────────────────────────────────────────────────
function helpToggle(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const open = el.style.display === 'none' || el.style.display === '';
  el.style.display = open ? 'block' : 'none';
  const caret = document.getElementById(id + '-caret');
  if (caret) caret.textContent = open ? '–' : '+';
}

// ── Open / close overlay ─────────────────────────────────────────────────────
// openHelp() opens the guide. Optional (deptId, taskId) expands that department
// and task and scrolls to it — used by "How to use" buttons on feature screens.
function openHelp(expandDept, expandTask) {
  renderHelp();
  const ov = document.getElementById('help-overlay');
  if (ov) ov.style.display = 'block';
  try { window.scrollTo(0, 0); } catch (e) {}
  if (expandDept) {
    setTimeout(function () {
      const d = document.getElementById('dept-' + expandDept);
      if (d && d.style.display !== 'block') helpToggle('dept-' + expandDept);
      if (expandTask) {
        const tk = document.getElementById(expandTask);
        if (tk && tk.style.display !== 'block') helpToggle(expandTask);
        if (tk && tk.scrollIntoView) { try { tk.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
      }
    }, 70);
  }
}
function closeHelp() {
  const ov = document.getElementById('help-overlay');
  if (ov) ov.style.display = 'none';
}

if (typeof window !== 'undefined') {
  window.openHelp = openHelp;
  window.closeHelp = closeHelp;
  window.helpToggle = helpToggle;
  window.renderHelp = renderHelp;
}
