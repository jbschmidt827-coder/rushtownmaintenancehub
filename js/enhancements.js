
(function(){
  var _cc = 0, _ct = null, _busy = false;

  var PHRASES = [
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
  ];

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

  function _trigger(e) {
    _busy = true;
    var phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    var effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    _showBanner(phrase[0], phrase[1]);
    _cluck();
    effect(e);
    setTimeout(function(){ _busy = false; }, 8000);
  }

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
