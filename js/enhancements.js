
(function(){
  var _cc = 0, _ct = null, _eggTimer = null;
  var PHRASES = [
    ['🐔 BAWK BAWK BAWK! 🐔',   'The chickens have taken over!'],
    ['🥚  EGG-CELLENT! 🥚',      'That\'s 3 clicks — you found us!'],
    ['🐔 CLUCK CLUCK CLUCK! 🐔', 'Stop clicking the chicken!'],
    ['🌽 DINNER TIME! 🌽',       'The chickens demand corn.'],
    ['🐔 FOWL PLAY DETECTED 🐔', 'Security has been notified.'],
  ];

  window.chickenClick = function(e) {
    e.stopPropagation();
    _cc++;
    clearTimeout(_ct);
    _ct = setTimeout(function(){ _cc = 0; }, 1200);
    if (_cc >= 3) {
      _cc = 0;
      clearTimeout(_ct);
      _launchChicken();
    }
  };

  function _launchChicken() {
    var phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    var runner  = document.getElementById('chicken-runner');
    var banner  = document.getElementById('cluck-banner');

    // Reset & show runner
    runner.style.animation = 'none';
    runner.offsetHeight; // reflow
    runner.style.display = 'block';
    runner.style.animation = 'chicken-run 2s linear 3, chicken-bounce 0.26s ease-in-out infinite';

    // Show banner
    banner.innerHTML = phrase[0] + '<span>' + phrase[1] + '</span>';
    banner.style.display = 'block';
    banner.style.animation = 'none';
    banner.offsetHeight;
    banner.style.animation = 'cluck-pop 0.45s cubic-bezier(.17,.67,.32,1.5) forwards';

    // Drop eggs from random spots
    clearTimeout(_eggTimer);
    _dropEggs(12);

    // Cluck sound via Web Audio
    _cluck();

    // Clean up after 7s
    setTimeout(function(){
      runner.style.display = 'none';
      banner.style.display = 'none';
      document.querySelectorAll('.egg-drop').forEach(function(el){ el.remove(); });
    }, 7000);
  }

  function _dropEggs(n) {
    for (var i = 0; i < n; i++) {
      (function(delay){
        setTimeout(function(){
          var el = document.createElement('div');
          el.className = 'egg-drop';
          el.textContent = Math.random() > 0.4 ? '🥚' : '🐣';
          el.style.left  = (5 + Math.random() * 90) + 'vw';
          el.style.animationDelay = '0s';
          el.style.animationDuration = (0.9 + Math.random() * 0.7) + 's';
          document.body.appendChild(el);
          setTimeout(function(){ el.remove(); }, 2200);
        }, delay);
      })(i * 190 + Math.random() * 120);
    }
  }

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
    } catch(e) { /* audio not supported, no problem */ }
  }
})();

