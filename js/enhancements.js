
(function(){
  var _cc = 0, _ct = null, _busy = false, _adCount = 0;

  // Company-wide pack — classic chicken chaos + leadership roast (shows everywhere)
  var PHRASES_COMMON = [
    ['🐔 BAWK BAWK BAWK! 🐔',       'The chickens have taken over!'],
    ['🥚 EGG-CELLENT WORK! 🥚',     'You found the secret 3-tap!'],
    ['🌽 DINNER TIME! 🌽',          'The chickens demand corn. NOW.'],
    ['🐔 FOWL PLAY DETECTED 🐔',    'IT security has been notified. Maybe.'],
    ['🐓 COCKADOODLE DOO! 🐓',      'Why did the egg come first? Philosophy.'],
    ['🥚 EGG COUNT: TOO MANY 🥚',   'Please stop clicking and count your barns.'],
    ['🥚 OEUF! 🥚',                 'That\'s French for "egg." We are very cultured.'],
    ['🐔 THE PROPHECY 🐔',          'A chicken shall save the operations hub.'],
    ['🌽 NEW WO FILED 🌽',          'Submitted by: a hen. Priority: PECK.'],
    ['🐓 FREE-RANGE BUG 🐓',        'A glitch is loose in barn 4. Try not to step on it.'],
    ['🥚 SUNNY SIDE UP 🥚',         'Productivity rising at 350°F.'],
    ['🐣 OPS LEVEL UP! 🐣',         'Achievement unlocked: Knower of Secrets.'],
    ['🐔 UNION MEETING 🐔',         'The hens have demands. They will be heard.'],
    ['🥚 SCRAMBLED CODE 🥚',        'No bugs were harmed. The eggs are not so lucky.'],
    ['🐓 ROOSTER BOSS MODE 🐓',     'Crowing at full volume. HR has been notified.'],
    ['🥚 OVA-ACHIEVER 🥚',          'You really, really like that chicken, huh.'],
    // ── Maintenance roast pack (Joe, Nate, the team & open work orders) ──
    ['🔧 ETA? 🔧',                  'Joe asked Nate for an ETA. Nate said "define ETA."'],
    ['📋 HEALTHY BACKLOG 📋',       '{wo} open work orders. Maintenance calls that job security.'],
    ['⏳ ALMOST DONE ⏳',           'That bearing has been "almost done" so long it qualifies for a pension.'],
    ['🎂 ANNIVERSARY 🎂',           'Joe & Nate\'s "5-minute fix" just turned one week old.'],
    ['✅ 100% RATE ✅',             'Maintenance closes 100% of the work orders they actually finish.'],
    ['🚨 STILL URGENT 🚨',          'This work order has been URGENT for 11 days. Very patient little WO.'],
    ['🔧 DONE-ISH 🔧',              'Joe: "Is it done?" Nate: "Done-ish." Joe: "...?" Nate: "Not done."'],
    ['🛠 NATE FIXED IT 🛠',         'Then Joe touched it. Now there is a new work order.'],
    ['☕ ON IT ☕',                  'Nate gets to the work orders right after this coffee. His 4th.'],
    ['📋 TIER 2 📋',                'We would close the WOs faster, but then what would we talk about at Tier 2?'],
    ['🐔 WHY NOT DONE 🐔',          '{wo} open. The chickens filed a complaint with management.'],
    // ── Leadership roast (Joe & Nate P = Directors, Brad = owner, Natalie/Jill = leads) ──
    ['🐔 WHICH NATE? 🐔',           'A WO says "ask Nate." Director Nate and Tech Nate both said "the other one."'],
    ['👔 THE OWNER 👔',             'Brad walked in, nodded at a chicken, and left. Inspection passed.'],
    ['🐔 BRAD APPROVES 🐔',         'Brad reviewed the budget. The chickens get one (1) extra kernel.'],
    ['📋 NATALIE LEADS 📋',         'Natalie finished the checklist before the rooster finished crowing.'],
    ['🦸 BACKUP JILL 🦸',           'Jill stepped in as lead, fixed it all, and let everyone keep the credit.'],
    ['🐔 TWO DIRECTORS 🐔',         'Joe and Nate both pointed at the same broken fan. Standoff.'],
    // ── Good job / inspiring — {name} = a real barn worker at the active site ──
    ['🌟 GOOD JOB 🌟',              '{name}, the barns have never looked better. The hens noticed.'],
    ['💪 CREW MVP 💪',              '{name} showed up and showed out today. Respect.'],
    ['🐔 THE HENS THANK YOU 🐔',    '{name}, every bird in the house is clucking your name. Good job!'],
    ['👏 NICE WORK 👏',             '{name} kept it clean and kept it tight. That is how it is done.'],
    ['🏆 BARN HERO 🏆',             '{name} — first one in, barns squared away. Legend.'],
    ['⭐ KEEP IT UP ⭐',             '{name}, the flock is healthy because you show up. Good job!'],
    ['🥚 EGG-CELLENT 🥚',           '{name} ran the houses like a pro. The eggs basically packed themselves.'],
    ['🙌 TEAM STRONG 🙌',           'Big shout to {name} and the whole crew — you make this place run.'],
    ['🌅 EARLY BIRD 🌅',            '{name} beat the rooster to work again. The rooster is embarrassed.'],
    ['❤️ THANK YOU ❤️',             '{name}, the birds cannot say it, so we will: thank you. Good job today.'],
    ['🧤 GLOVES ON 🧤',             '{name} grabbed the dirty job nobody wanted and just handled it. MVP.'],
    ['🐥 FLOCK FAVORITE 🐥',        'The chicks took a vote. {name} is officially the favorite. Keep it up!'],
    // ── Extra roast pack (v205) — the named crew are all in on the joke ──
    ['🔄 CIRCLE BACK 🔄',           'Joe said he\'d "circle back." The chickens are getting dizzy waiting.'],
    ['🔢 VERSION 900 🔢',           'Joe fixed one button and bumped the version to v900. Ship it.'],
    ['🐔 JOE\'S FIX 🐔',            'Joe "fixed" it. Nate is quietly filing the follow-up work order.'],
    ['🧰 NATE\'S TOOLBOX 🧰',       'Nate\'s toolbox has every tool except the exact one you need.'],
    ['📣 NATE SAID 📣',             'Nate: "It\'s fine." The chicken disagrees. The chicken is usually right.'],
    ['⏱ RANDY TIME ⏱',            'Randy said "two minutes." Two minutes in Randy-time is a full shift.'],
    ['🛞 RANDY ROLLIN\' 🛞',        'Randy\'s on his way. He\'s been "on his way" since Tuesday.'],
    ['🔩 STEVE STRENGTH 🔩',        'Steve tightened it until the bolt filed for workers\' comp.'],
    ['👀 CELIA SEES ALL 👀',        'Celia spotted a dirty egg from three barns over. Eagle eyes, egg edition.'],
    ['🏆 CELIA\'S CLIPBOARD 🏆',    'Celia\'s clipboard remembers every mess you ever made. Forever.'],
    ['👔 THE NOD 👔',               'Brad walked in, nodded once, and left. That nod is legally binding.'],
    ['💰 BRAD\'S BUDGET 💰',        'Brad approved one (1) extra kernel of corn. The flock is celebrating.'],
    ['👴 ASK MIKE 👴',              'Mike\'s been here so long the barns ask HIM for advice now.'],
    ['☕ MIKE\'S COFFEE ☕',         'Mike\'s coffee is older than most of the crew. He is not sharing.'],
    ['🐔 WO OF THE DAY 🐔',         '{name} filed a work order on a hen "with an attitude problem." Approved.'],
    ['🥇 SPEED RUN 🥇',             '{name} finished the whole barn before the coffee finished brewing.'],
    ['🎖 CLUCK OF HONOR 🎖',        'The flock awards {name} the Golden Feather. Wear it proud.'],
    // ── MIKE PACK (v205) — most of the jokes ride on Mike, the O.G. ──
    ['👴 BACK IN MY DAY 👴',        'Mike remembers when eggs were a nickel and roosters had respect.'],
    ['🦵 MIKE\'S KNEES 🦵',         'Mike\'s knees forecast the weather better than the app does.'],
    ['🐔 THE FIRST BIRD 🐔',        'Mike\'s been here so long the founding chicken was his apprentice.'],
    ['🧘 MIKE DON\'T CHASE 🧘',     'Mike doesn\'t chase chickens. The chickens come to Mike.'],
    ['💾 UPDATE MIKE? 💾',          'They tried to update Mike\'s system. Mike updated THEM.'],
    ['😴 SCHEDULED NAP 😴',         'Mike\'s nap is a planned maintenance window. Do not interrupt.'],
    ['📻 DIAL-UP DAYS 📻',          'Mike\'s been running belts since dial-up. Still faster than your wifi.'],
    ['👓 GLASSES ON GLASSES 👓',    'Mike\'s reading glasses have reading glasses.'],
    ['🐓 ROOSTER APOLOGIZES 🐓',    'The rooster crowed at Mike. Mike crowed back. The rooster apologized.'],
    ['🐢 SLOW BUT FIRST 🐢',        'Mike\'s pace is "slow." His finish time is "before you." Explain that.'],
    ['💸 OWES HIM MONEY 💸',        'Mike squints at new tech like it owes him money.'],
    ['🛠 1987 BELT 🛠',             'Mike found a manure belt from 1987 in the shop. He installed it. It works.'],
    ['☕ MIKE\'S CHAIR ☕',          'Mike\'s coffee, Mike\'s chair, Mike\'s rules. You\'re just visiting.',  _oldRoosterWheelchair],
    ['🎂 MIKE\'S AGE 🎂',           'Ask Mike his age: "Older than the barns, younger than the jokes."'],
    ['🏆 THE LEGEND 🏆',            'Forty seasons in. Mike\'s forgotten more chickens than you\'ll ever meet.', _youngTeachesOld],
    // ── JOE\'s HOOD CHICKEN ──
    ['🧢 HOOD CHICKEN 🧢',          'Joe pulled up with the Hood Chicken — gold chain, lil\' grill, struttin\' the barn like he runs it. (He does.)', _discoChicken],
    ['🐔 CERTIFIED STREET 🐔',      'Joe\'s Hood Chicken don\'t peck — it drops the beat. Bawk bawk, straight fire.', _discoChicken],
  ];

  // ── Per-facility packs — appended to COMMON for the active site ──
  var PHRASES_BY_FARM = {
    'Hegins': [
      ['🐔 IS MIKE A CHICKEN? 🐔', 'Mike\'s done chickens so long he basically IS one now — wattle and all.'],
      ['👴 MIKE THE O.G. 👴',      'Mike was running manure belts before electricity. The original bird.'],
      ['♿ HERE ROLLS MIKE ♿',     'The old rooster has entered the building. Make a hole!', _oldRoosterWheelchair],
      ['🐤 SCHOOLIN\' MIKE 🐤',    'The young bird tried to teach Mike the new system. Mike just stared. Beautifully.', _youngTeachesOld],
      ['🦳 ELDER ROOSTER 🦳',      'Forty seasons in the barns — Mike\'s forgotten more chickens than you\'ll ever meet.'],
      ['🏭 HEGINS HUSTLE 🏭',      'Mike says Hegins runs like a clock — one the chickens keep pecking.'],
      ['☕ MIKE\'S HUDDLE ☕',      'Mike called a 5-minute huddle. The chickens are still waiting.'],
      ['🐔 5:30 CLUB 🐔',          'Hegins clocked in at 5:30. The roosters rolled up at 5:45. Lazy.'],
      ['🛠 CARLOS DID IT 🛠',      'Carlos fixed it with one zip tie and pure confidence.'],
      ['🔩 STEVE\'S TORQUE 🔩',    'Steve tightened it "just a little more." It is now permanent.'],
      ['📋 JOSH ON IT 📋',         'Josh closed 3 work orders and opened a snack. Balance.'],
      ['🥚 HEGINS RECORD 🥚',      'Hegins logged every barn before coffee. Mike pretended not to be impressed.'],
      ['🔧 HEGINS CREW 🔧',        'Josh, Steve & Carlos fixed it, broke it, then fixed it better. Probably.'],
    ],
    'Danville': [
      ['🏭 DANVILLE DRIVE 🏭',     'Celia runs Danville so smooth the chickens filed for vacation.'],
      ['📋 CELIA\'S LIST 📋',      'Celia found ONE thing out of place. One. She remembers.'],
      ['🐔 7 AM DANVILLE 🐔',      'Danville starts at 7. The hens are still negotiating a later shift.'],
      ['🛠 NATE WOLF 🛠',          'Nate Wolf fixed it. The OTHER Nate took the call. Classic.'],
      ['🔧 RANDY\'S TWO MIN 🔧',   'Randy said "two minutes." That was three coffees ago.'],
      ['🥚 NOAH\'S ARK 🥚',        'Noah loaded two of every tool and still couldn\'t find the 9/16.'],
      ['🐓 CAIN ABLE 🐓',          'Cain was able. Then a chicken got involved.'],
      ['📋 DANVILLE CLEAN 📋',     'Celia\'s clipboard has seen things. It does not forgive.'],
    ],
    'Processing Plant': [
      ['📦 PROCESSING POWER 📦',   'The packers ran all shift. {wo} open WOs said "later."'],
      ['🥚 CASES PACKED 🥚',       'Processing hit a record today. A chicken is demanding royalties.'],
      ['🔧 PACKER 2 JAM 🔧',       'Packer 2 jammed again. It only does that when you look at it.'],
      ['🐔 CLEANUP CREW 🐔',       'Cleanup finished spotless. Then a hen strolled through. Again.'],
      ['⚙️ CONVEYOR LIFE ⚙️',     'The conveyor never stops. Neither does the chicken riding it.'],
      ['📦 SHIP IT 📦',            'Processing shipped it. The chickens waved goodbye to the eggs.'],
    ],
  };

  var EFFECTS = [
    _chickenRun,
    _screenShake,
    _matrixBawk,
    _chickenInvasion,
    _upsideDown,
    _eggExplosion,
    _layAnEgg,
    _discoChicken,
    _workOrderBlast,
    _birdRain,
    _chickenDance,
    _chickenForklift,
    _eggFireworks,
    _chickenTornado,
    _oldRoosterWheelchair,
    _youngTeachesOld,
  ];

  // ── Public entry point ──────────────────────────────────────
  window.chickenClick = function(e) {
    e.stopPropagation();
    if (_busy) return;
    _cc++;
    clearTimeout(_ct);
    _ct = setTimeout(function(){ _cc = 0; }, 1400);
    if (_cc >= 3) {
      _cc = 0;
      clearTimeout(_ct);
      _trigger(e);
    }
  };

  // Pick a real staff name assigned to the active site (barn workers preferred),
  // so the good-job / inspiring lines name an actual person on the crew.
  function _siteStaff(farm, barnOnly) {
    if (typeof staffList === 'undefined' || !Array.isArray(staffList)) return [];
    return staffList.filter(function (s) {
      if (!s || s.active === false || !s.name) return false;
      var atSite = !farm || s.farm === farm || s.farm === 'Both' || s.farm === 'All' || s.farm === 'All Farms';
      if (!atSite) return false;
      if (barnOnly) { var r = s.role || ''; return r === 'WNO' || r === 'Barn Worker' || r === 'Other' || r === ''; }
      return true;
    }).map(function (s) { return s.name; });
  }
  function _pickName(farm) {
    var list = _siteStaff(farm, true);
    if (!list.length) list = _siteStaff(farm, false);
    return list.length ? list[Math.floor(Math.random() * list.length)] : 'the barn crew';
  }

  function _trigger(e) {
    _busy = true;
    // Pool = company-wide jokes + whichever facility you're standing in.
    // Master / unknown location → everybody is fair game.
    var farm = (typeof getPreferredFarm === 'function') ? getPreferredFarm() : null;
    var pool = PHRASES_COMMON.slice();
    if (farm && PHRASES_BY_FARM[farm]) {
      pool = pool.concat(PHRASES_BY_FARM[farm]);
    } else {
      pool = pool.concat(PHRASES_BY_FARM['Hegins'], PHRASES_BY_FARM['Danville'], PHRASES_BY_FARM['Processing Plant']);
    }
    var phrase = pool[Math.floor(Math.random() * pool.length)];
    var openWO = 0;
    try { if (typeof workOrders !== 'undefined' && Array.isArray(workOrders)) openWO = workOrders.filter(function (w) { return w && w.status !== 'completed'; }).length; } catch (e2) {}
    // A phrase can pin a specific animation as its 3rd element (e.g. Mike → wheelchair);
    // otherwise pick a random one.
    var effect = (phrase[2] && typeof phrase[2] === 'function') ? phrase[2] : EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    var nm = _pickName(farm);
    var fill = function (s) { return String(s).replace(/\{wo\}/g, openWO).replace(/\{name\}/g, nm); };
    _showBanner(fill(phrase[0]), fill(phrase[1]));
    _cluck();
    effect(e);
    // Fake "ad" pre-roll — the Rushtown trailer — fires on every easter-egg.
    _adCount++;
    setTimeout(_rushtownAd, 1200);
    setTimeout(function(){ _busy = false; }, 8000);
  }

  // ── Fake "AD" pre-roll: plays the Rushtown trailer (YouTube embed). Forced ~6s
  // watch before the Skip button unlocks, just like a real pre-roll — then Skip/✕.
  var _RUSHTOWN_TRAILER = 'tvQOgX56FiM';
  function _rushtownAd() {
    try {
      if (document.getElementById('rushtown-ad')) return;
      var es = (typeof _lang !== 'undefined' && _lang === 'es');
      var ov = document.createElement('div');
      ov.id = 'rushtown-ad';
      ov.style.cssText = 'position:fixed;inset:0;z-index:14000;background:rgba(0,0,0,0.94);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;';
      ov.innerHTML =
        '<div style="width:100%;max-width:640px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
            '<span style="background:#f0c419;color:#111;font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:800;padding:3px 8px;border-radius:4px;letter-spacing:1px;">' + (es ? 'ANUNCIO' : 'AD') + '</span>' +
            '<span style="color:#c9d9c9;font-family:\'IBM Plex Mono\',monospace;font-size:12px;">🐔 ' + (es ? 'RUSHTOWN POULTRY — el tráiler' : 'RUSHTOWN POULTRY — the trailer') + '</span>' +
          '</div>' +
          '<div style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;border:2px solid #4ade80;background:#000;">' +
            '<iframe id="rushtown-ad-frame" src="https://www.youtube.com/embed/' + _RUSHTOWN_TRAILER + '?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1" title="Rushtown" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;"></iframe>' +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:10px;flex-wrap:wrap;">' +
            '<a href="https://www.youtube.com/watch?v=' + _RUSHTOWN_TRAILER + '" target="_blank" rel="noopener" style="color:#9ad6a0;font-family:\'IBM Plex Mono\',monospace;font-size:11px;text-decoration:underline;">▶ ' + (es ? 'Ver en YouTube' : 'Open on YouTube') + '</a>' +
            '<button id="rushtown-ad-skip" disabled style="padding:10px 18px;border-radius:8px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:not-allowed;background:#1a1a1a;border:1.5px solid #3a3a3a;color:#888;">' + (es ? 'Saltar en 6' : 'Skip in 6') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      var skip = document.getElementById('rushtown-ad-skip');
      var n = 6;
      var iv = setInterval(function () {
        n--;
        if (n > 0) { if (skip) skip.textContent = (es ? 'Saltar en ' : 'Skip in ') + n; return; }
        clearInterval(iv);
        if (skip) {
          skip.disabled = false;
          skip.textContent = (es ? 'Saltar anuncio ⏭' : 'Skip Ad ⏭');
          skip.style.cssText = 'padding:10px 18px;border-radius:8px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;font-weight:700;cursor:pointer;background:#14361c;border:1.5px solid #4ade80;color:#4ade80;';
          skip.onclick = function () { var o = document.getElementById('rushtown-ad'); if (o) o.remove(); };
        }
      }, 1000);
    } catch (e) { console.warn('rushtownAd:', e); }
  }
  if (typeof window !== 'undefined') window._rushtownAd = _rushtownAd;

  // ── Banner ──────────────────────────────────────────────────
  function _showBanner(title, sub) {
    var banner = document.getElementById('cluck-banner');
    if (!banner) return;
    banner.innerHTML = title + '<span>' + sub + '</span>';
    banner.style.display = 'block';
    banner.style.animation = 'none';
    banner.offsetHeight;
    banner.style.animation = 'cluck-pop 0.45s cubic-bezier(.17,.67,.32,1.5) forwards';
    setTimeout(function(){ banner.style.display = 'none'; }, 5500);
  }

  // ── Effect 1: Chicken runs across the screen ────────────────
  function _chickenRun() {
    var runner = document.getElementById('chicken-runner');
    if (!runner) return;
    runner.style.animation = 'none';
    runner.offsetHeight;
    runner.style.display = 'block';
    runner.style.animation = 'chicken-run 2s linear 3, chicken-bounce 0.26s ease-in-out infinite';
    _dropEggs(14);
    setTimeout(function(){
      runner.style.display = 'none';
      document.querySelectorAll('.egg-drop').forEach(function(el){ el.remove(); });
    }, 7000);
  }

  // ── Effect 2: Screen shake ──────────────────────────────────
  function _screenShake() {
    _dropEggs(8);
    var style = document.createElement('style');
    style.id = 'shake-style';
    style.textContent = '@keyframes _shake{0%,100%{transform:translate(0,0)}10%{transform:translate(-8px,4px)}20%{transform:translate(8px,-4px)}30%{transform:translate(-6px,6px)}40%{transform:translate(6px,-6px)}50%{transform:translate(-10px,2px)}60%{transform:translate(10px,-2px)}70%{transform:translate(-4px,8px)}80%{transform:translate(4px,-8px)}90%{transform:translate(-6px,4px)}}';
    document.head.appendChild(style);
    document.body.style.animation = '_shake 0.1s linear 12';
    setTimeout(function(){
      document.body.style.animation = '';
      var s = document.getElementById('shake-style');
      if (s) s.remove();
      document.querySelectorAll('.egg-drop').forEach(function(el){ el.remove(); });
    }, 1500);
  }

  // ── Effect 3: Matrix BAWK rain ──────────────────────────────
  function _matrixBawk() {
    var cols = Math.floor(window.innerWidth / 28);
    var drops = [];
    for (var i = 0; i < cols; i++) drops.push(0);
    var canvas = document.createElement('canvas');
    canvas.id = '_matrix-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;pointer-events:none;opacity:0.85;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var words = ['BAWK','CLUCK','🥚','🐔','FEED','EGG'];
    var frame = 0;
    var interval = setInterval(function(){
      ctx.fillStyle = 'rgba(0,20,0,0.07)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#00ff41';
      ctx.font = '14px IBM Plex Mono, monospace';
      for (var j = 0; j < drops.length; j++) {
        var word = words[Math.floor(Math.random()*words.length)];
        ctx.fillText(word, j * 28, drops[j] * 18);
        if (drops[j] * 18 > canvas.height && Math.random() > 0.975) drops[j] = 0;
        drops[j]++;
      }
      frame++;
    }, 45);
    setTimeout(function(){
      clearInterval(interval);
      canvas.remove();
    }, 4500);
  }

  // ── Effect 4: Chicken invasion ──────────────────────────────
  function _chickenInvasion() {
    var chickens = [];
    for (var i = 0; i < 22; i++) {
      (function(delay){
        setTimeout(function(){
          var el = document.createElement('div');
          el.className = '_chicken-inv';
          el.textContent = Math.random() > 0.3 ? '🐔' : '🐓';
          el.style.cssText = 'position:fixed;z-index:9997;pointer-events:none;font-size:' +
            (24 + Math.random()*28) + 'px;' +
            'top:' + (5 + Math.random()*85) + 'vh;' +
            'left:' + (2 + Math.random()*90) + 'vw;' +
            'transform:rotate(' + (Math.random()*40-20) + 'deg);' +
            'animation:cluck-pop 0.4s cubic-bezier(.17,.67,.32,1.5) forwards;' +
            'transition:opacity 0.5s;';
          document.body.appendChild(el);
          chickens.push(el);
        }, delay);
      })(i * 120 + Math.random()*80);
    }
    setTimeout(function(){
      chickens.forEach(function(el){
        el.style.opacity = '0';
        setTimeout(function(){ el.remove(); }, 600);
      });
    }, 3800);
  }

  // ── Effect 5: Upside down ───────────────────────────────────
  function _upsideDown() {
    _dropEggs(6);
    var style = document.createElement('style');
    style.id = '_flip-style';
    style.textContent = '@keyframes _flipud{0%{transform:rotate(0deg)}25%{transform:rotate(180deg)}75%{transform:rotate(180deg)}100%{transform:rotate(0deg)}}';
    document.head.appendChild(style);
    var target = document.getElementById('main-content') || document.getElementById('landing-screen') || document.body;
    target.style.animation = '_flipud 3.5s ease-in-out forwards';
    target.style.transformOrigin = 'center center';
    setTimeout(function(){
      target.style.animation = '';
      target.style.transform = '';
      var s = document.getElementById('_flip-style');
      if (s) s.remove();
      document.querySelectorAll('.egg-drop').forEach(function(el){ el.remove(); });
    }, 3700);
  }

  // ── Effect 6: Egg explosion from click point ────────────────
  function _eggExplosion(e) {
    var cx = (e && e.clientX) ? e.clientX : window.innerWidth / 2;
    var cy = (e && e.clientY) ? e.clientY : 80;
    for (var i = 0; i < 20; i++) {
      (function(i){
        var el = document.createElement('div');
        var angle = (i / 20) * 360 + Math.random()*18;
        var dist  = 80 + Math.random()*160;
        var rad   = angle * Math.PI / 180;
        var tx    = Math.cos(rad) * dist;
        var ty    = Math.sin(rad) * dist;
        el.textContent = Math.random() > 0.4 ? '🥚' : '🐣';
        el.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;font-size:' +
          (16+Math.random()*18) + 'px;top:' + cy + 'px;left:' + cx + 'px;' +
          'transition:transform 0.7s cubic-bezier(.2,.8,.4,1.2),opacity 0.7s;opacity:1;';
        document.body.appendChild(el);
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            el.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
            el.style.opacity   = '0';
          });
        });
        setTimeout(function(){ el.remove(); }, 900);
      })(i);
    }
  }

  // ── Effect 7: Hen lays an egg, egg drops, hen runs off ──────
  function _layAnEgg() {
    var hen = document.createElement('div');
    hen.textContent = '🐔';
    hen.style.cssText = 'position:fixed;z-index:9998;pointer-events:none;font-size:64px;left:50%;top:30vh;transform:translateX(-50%);transition:transform 0.4s,left 0.7s ease-in,opacity 0.5s;';
    document.body.appendChild(hen);
    setTimeout(function(){ hen.style.transform = 'translateX(-50%) scale(1.3,0.75)'; }, 250);
    setTimeout(function(){
      hen.style.transform = 'translateX(-50%) scale(1,1)';
      var egg = document.createElement('div');
      egg.textContent = '🥚';
      egg.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;font-size:34px;left:50%;top:calc(30vh + 56px);transform:translateX(-50%);transition:top 0.65s ease-in,transform 0.45s,opacity 0.45s;';
      document.body.appendChild(egg);
      setTimeout(function(){ egg.style.top = '70vh'; }, 30);
      setTimeout(function(){
        egg.style.transform = 'translateX(-50%) rotate(360deg) scale(1.6)';
        egg.style.opacity = '0';
      }, 750);
      setTimeout(function(){ egg.remove(); }, 1300);
    }, 750);
    setTimeout(function(){
      hen.style.left = '120vw';
      hen.style.opacity = '0';
    }, 1700);
    setTimeout(function(){ hen.remove(); }, 2700);
  }

  // ── Effect 8: Disco chicken party ───────────────────────────
  function _discoChicken() {
    var style = document.createElement('style');
    style.id = '_disco-style';
    style.textContent = '@keyframes _disco{0%{filter:hue-rotate(0deg) saturate(1.3)}100%{filter:hue-rotate(360deg) saturate(1.3)}}';
    document.head.appendChild(style);
    document.body.style.animation = '_disco 0.55s linear 7';
    var ball = document.createElement('div');
    ball.textContent = '🪩';
    ball.style.cssText = 'position:fixed;top:18%;left:50%;font-size:90px;z-index:9998;pointer-events:none;transform:translateX(-50%);animation:cluck-pop 0.4s ease forwards;';
    document.body.appendChild(ball);
    var spawned = [];
    for (var i = 0; i < 18; i++) {
      (function(i){
        setTimeout(function(){
          var c = document.createElement('div');
          c.textContent = i % 2 ? '🐔' : '🐓';
          c.style.cssText = 'position:fixed;z-index:9997;pointer-events:none;font-size:' +
            (28 + Math.random()*22) + 'px;left:' + (3 + Math.random()*92) + 'vw;top:' + (10 + Math.random()*78) + 'vh;animation:cluck-pop 0.3s ease forwards;transition:opacity 0.4s;';
          document.body.appendChild(c);
          spawned.push(c);
          setTimeout(function(){ c.style.opacity = '0'; }, 400);
        }, i * 200);
      })(i);
    }
    setTimeout(function(){
      document.body.style.animation = '';
      var s = document.getElementById('_disco-style');
      if (s) s.remove();
      ball.remove();
      spawned.forEach(function(el){ el.remove(); });
    }, 4800);
  }

  // ── Effect 9: Work Order blast (work-themed) ────────────────
  function _workOrderBlast() {
    var msgs = ['🔧 WO #420', '🔧 WO #069', '🔧 WO #LOL', '🚨 PRIORITY: PECK', '🥚 NEEDS GREASE', '🐔 BIRD JAMMED', '🌽 LOW ON CORN', '🔧 WO #BAWK', '🐓 LOOSE BIRD'];
    for (var i = 0; i < 12; i++) {
      (function(i){
        setTimeout(function(){
          var el = document.createElement('div');
          el.textContent = msgs[Math.floor(Math.random()*msgs.length)];
          el.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;font-family:IBM Plex Mono,monospace;font-size:14px;font-weight:700;background:#1a3a1a;border:2px solid #4caf50;color:#7ab07a;padding:8px 14px;border-radius:8px;left:' +
            (5 + Math.random()*75) + 'vw;top:' + (8 + Math.random()*72) + 'vh;transform:rotate(' + (Math.random()*40-20) + 'deg);transition:transform 1s,opacity 0.6s;opacity:1;box-shadow:0 4px 12px rgba(0,0,0,.3);';
          document.body.appendChild(el);
          setTimeout(function(){
            el.style.transform = 'rotate(' + (Math.random()*40-20) + 'deg) translateY(-180px)';
            el.style.opacity = '0';
          }, 800);
          setTimeout(function(){ el.remove(); }, 2000);
        }, i * 180);
      })(i);
    }
  }

  // ── Effect 10: Bird rain (chickens, eggs, chicks falling) ───
  function _birdRain() {
    for (var i = 0; i < 30; i++) {
      (function(i){
        setTimeout(function(){
          var el = document.createElement('div');
          el.textContent = ['🐔','🐓','🐣','🥚'][Math.floor(Math.random()*4)];
          el.style.cssText = 'position:fixed;z-index:9998;pointer-events:none;font-size:' +
            (22 + Math.random()*20) + 'px;left:' + (Math.random()*100) + 'vw;top:-40px;transition:top 1.7s linear,transform 1.7s linear;';
          document.body.appendChild(el);
          setTimeout(function(){
            el.style.top = '110vh';
            el.style.transform = 'rotate(' + (Math.random()*720-360) + 'deg)';
          }, 30);
          setTimeout(function(){ el.remove(); }, 1800);
        }, i * 100);
      })(i);
    }
  }

  // ── Effect 11: Conga line of dancing chickens ──────────────
  function _chickenDance() {
    var dancers = [];
    var count = 7;
    for (var i = 0; i < count; i++) {
      var el = document.createElement('div');
      el.textContent = i % 2 ? '🐓' : '🐔';
      el.style.cssText = 'position:fixed;z-index:9998;pointer-events:none;font-size:52px;left:' +
        (8 + i * 12) + 'vw;top:55vh;transform:translateY(0);transition:transform 0.24s;';
      document.body.appendChild(el);
      dancers.push(el);
    }
    var beats = 18;
    var t = 0;
    var iv = setInterval(function(){
      dancers.forEach(function(d, idx){
        var up = (idx + t) % 2 === 0;
        d.style.transform = up ? 'translateY(-32px) rotate(-12deg)' : 'translateY(0) rotate(12deg)';
      });
      t++;
      if (t > beats) {
        clearInterval(iv);
        setTimeout(function(){
          dancers.forEach(function(d){
            d.style.transition = 'opacity 0.4s';
            d.style.opacity = '0';
            setTimeout(function(){ d.remove(); }, 450);
          });
        }, 300);
      }
    }, 270);
  }

  // ── Effect 12: Chicken on a forklift hauls eggs across ──────
  function _chickenForklift() {
    var rig = document.createElement('div');
    rig.textContent = '🥚📦 🐔🚜';
    rig.style.cssText = 'position:fixed;z-index:9998;pointer-events:none;font-size:46px;bottom:26px;left:-240px;white-space:nowrap;transition:left 3.2s linear;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5));';
    document.body.appendChild(rig);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ rig.style.left = '120vw'; }); });
    _dropEggs(8);
    setTimeout(function(){ rig.remove(); }, 3600);
  }

  // ── Effect 13: Egg fireworks (bursts from random points) ────
  function _eggFireworks() {
    for (var b = 0; b < 5; b++) {
      (function(b){
        setTimeout(function(){
          var cx = (10 + Math.random() * 80) * window.innerWidth / 100;
          var cy = (15 + Math.random() * 50) * window.innerHeight / 100;
          for (var i = 0; i < 14; i++) {
            (function(i){
              var el = document.createElement('div');
              var rad = (i / 14) * Math.PI * 2;
              var dist = 60 + Math.random() * 90;
              el.textContent = ['🥚','✨','🐣','🌟'][Math.floor(Math.random() * 4)];
              el.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;font-size:' + (14 + Math.random() * 14) + 'px;left:' + cx + 'px;top:' + cy + 'px;transition:transform .85s cubic-bezier(.15,.85,.4,1),opacity .85s;opacity:1;';
              document.body.appendChild(el);
              requestAnimationFrame(function(){ requestAnimationFrame(function(){
                el.style.transform = 'translate(' + (Math.cos(rad) * dist) + 'px,' + (Math.sin(rad) * dist) + 'px)';
                el.style.opacity = '0';
              }); });
              setTimeout(function(){ el.remove(); }, 1050);
            })(i);
          }
        }, b * 340);
      })(b);
    }
  }

  // ── Effect 14: Chicken tornado (spiraling flock) ────────────
  function _chickenTornado() {
    var birds = [];
    var n = 16, cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    for (var i = 0; i < n; i++) {
      var el = document.createElement('div');
      el.textContent = i % 3 === 0 ? '🥚' : (i % 2 ? '🐓' : '🐔');
      el.style.cssText = 'position:fixed;z-index:9998;pointer-events:none;font-size:' + (26 + Math.random() * 18) + 'px;left:' + cx + 'px;top:' + cy + 'px;will-change:transform;';
      document.body.appendChild(el);
      birds.push({ el: el, a: (i / n) * Math.PI * 2, r: 30 + i * 9 });
    }
    var t = 0;
    var iv = setInterval(function(){
      t++;
      birds.forEach(function(b){
        b.a += 0.25;
        var r = b.r * (1 + Math.sin(t / 10) * 0.15);
        b.el.style.transform = 'translate(' + (Math.cos(b.a) * r) + 'px,' + (Math.sin(b.a) * r * 0.6) + 'px) rotate(' + (b.a * 60) + 'deg)';
      });
      if (t > 60) {
        clearInterval(iv);
        birds.forEach(function(b){ b.el.style.transition = 'opacity .4s'; b.el.style.opacity = '0'; setTimeout(function(){ b.el.remove(); }, 450); });
      }
    }, 40);
  }

  // ── Effect 15: Big old rooster in a wheelchair takes over ───
  function _oldRoosterWheelchair() {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    var rig = document.createElement('div');
    rig.style.cssText = 'display:flex;flex-direction:column;align-items:center;line-height:0.9;transform:translateX(-130vw) scale(0.7);transition:transform 1.2s cubic-bezier(.2,.85,.3,1.25);filter:drop-shadow(0 10px 22px rgba(0,0,0,.6));';
    rig.innerHTML = '<div style="font-size:120px;">🐔</div><div style="font-size:96px;margin-top:-18px;">♿</div>';
    wrap.appendChild(rig);
    document.body.appendChild(wrap);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ rig.style.transform = 'translateX(0) scale(2.6)'; }); });
    var wob = 0, iv = setInterval(function(){ wob++; rig.style.marginLeft = (Math.sin(wob / 2) * 10) + 'px'; }, 60);
    setTimeout(function(){ rig.style.transform = 'translateX(135vw) scale(2.6) rotate(6deg)'; }, 3300);
    setTimeout(function(){ clearInterval(iv); wrap.remove(); }, 4700);
  }

  // ── Effect 16: Young chick teaches a baffled old rooster ────
  function _youngTeachesOld() {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;display:flex;align-items:center;justify-content:center;gap:36px;';
    var young = document.createElement('div');
    young.style.cssText = 'display:flex;flex-direction:column;align-items:center;line-height:1;opacity:0;transform:translateY(40px);transition:opacity .5s,transform .5s;';
    young.innerHTML = '<div style="font-size:44px;">📋</div><div class="_yc" style="font-size:88px;transition:transform .25s;">🐤</div>';
    var old = document.createElement('div');
    old.style.cssText = 'display:flex;flex-direction:column;align-items:center;line-height:1;opacity:0;transform:translateY(40px);transition:opacity .5s .12s,transform .5s .12s;';
    old.innerHTML = '<div class="_q" style="font-size:46px;opacity:0;transition:opacity .3s;">❓</div><div class="_oc" style="font-size:118px;transition:transform .25s;">🐔</div>';
    wrap.appendChild(young); wrap.appendChild(old);
    document.body.appendChild(wrap);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      young.style.opacity = '1'; young.style.transform = 'translateY(0)';
      old.style.opacity = '1'; old.style.transform = 'translateY(0)';
    }); });
    var yc = young.querySelector('._yc'), oc = old.querySelector('._oc'), q = old.querySelector('._q');
    setTimeout(function(){ if (q) q.style.opacity = '1'; }, 750);
    var t = 0, iv = setInterval(function(){
      t++;
      if (yc) yc.style.transform = 'translateY(' + (Math.sin(t / 2) * -9) + 'px)';   // eager teaching bob
      if (oc) oc.style.transform = 'rotate(' + (Math.sin(t / 3) * 9) + 'deg)';        // confused head-tilt
    }, 110);
    setTimeout(function(){ clearInterval(iv); young.style.opacity = '0'; old.style.opacity = '0'; setTimeout(function(){ wrap.remove(); }, 500); }, 4300);
  }

  // ── Falling eggs (shared) ───────────────────────────────────
  function _dropEggs(n) {
    for (var i = 0; i < n; i++) {
      (function(delay){
        setTimeout(function(){
          var el = document.createElement('div');
          el.className = 'egg-drop';
          el.textContent = Math.random() > 0.4 ? '🥚' : '🐣';
          el.style.left = (5 + Math.random()*90) + 'vw';
          el.style.animationDuration = (0.8 + Math.random()*0.8) + 's';
          document.body.appendChild(el);
          setTimeout(function(){ el.remove(); }, 2400);
        }, delay);
      })(i * 160 + Math.random()*100);
    }
  }

  // ── Cluck sound ─────────────────────────────────────────────
  function _cluck() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function beep(freq, start, dur, vol) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, ctx.currentTime + start);
        o.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + start + dur);
        g.gain.setValueAtTime(vol, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        o.start(ctx.currentTime + start);
        o.stop(ctx.currentTime + start + dur + 0.01);
      }
      beep(420, 0,    0.12, 0.18);
      beep(380, 0.14, 0.10, 0.15);
      beep(450, 0.28, 0.14, 0.18);
      beep(390, 0.44, 0.12, 0.15);
      beep(430, 0.62, 0.12, 0.18);
    } catch(err) { /* audio not available */ }
  }

})();
