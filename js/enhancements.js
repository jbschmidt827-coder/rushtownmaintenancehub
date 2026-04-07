
(function(){
  var _cc = 0, _ct = null, _busy = false;

  var PHRASES = [
    ['🐔 BAWK BAWK BAWK! 🐔',       'The chickens have taken over!'],
    ['🥚 EGG-CELLENT WORK! 🥚',     'You found the secret 3-tap!'],
    ['🌽 DINNER TIME! 🌽',          'The chickens demand corn. NOW.'],
    ['🐔 FOWL PLAY DETECTED 🐔',    'IT security has been notified. Maybe.'],
    ['🐓 COCKADOODLE DOO! 🐓',      'Why did the egg come first? Philosophy.'],
    ['🥚 EGG COUNT: TOO MANY 🥚',   'Please stop clicking and count your barns.'],
  ];

  var EFFECTS = [
    _chickenRun,
    _screenShake,
    _matrixBawk,
    _chickenInvasion,
    _upsideDown,
    _eggExplosion,
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
