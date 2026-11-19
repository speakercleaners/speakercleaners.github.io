/* SpeakerCleaners tool — plays cleaning tones through the Web Audio API.
   Water Eject: steady 165 Hz with a gentle pulse.
   Dust Clean: sweeps 200 Hz up to 1500 Hz in steps.
   Deep Clean: 165 Hz water phase, then a 200-1500 Hz sweep, then vibration.
   Test: short test tones so you can hear whether the speaker is clear. */
(function () {
  var MODES = {
    water: { label: 'Water Eject', seconds: 60, text: 'Ejecting water at 165 Hz — keep the speaker facing down.' },
    dust:  { label: 'Dust Clean',  seconds: 45, text: 'Sweeping 200–1500 Hz to shake dust loose.' },
    deep:  { label: 'Deep Clean',  seconds: 90, text: 'Full deep-clean cycle: water eject, dust sweep and vibration.' },
    test:  { label: 'Test',        seconds: 12, text: 'Playing test tones — listen for clear, even sound.' }
  };
  var state = { mode: 'water', speaker: 'both', running: false, ctx: null, osc: null, gain: null, pan: null, timer: null, startedAt: 0, total: 0, vibeTimer: null };

  var $ = function (id) { return document.getElementById(id); };
  var bar = $('barFill'), pct = $('pct'), statusText = $('statusText'), statusSub = $('statusSub'),
      dots = $('dots'), freqNow = $('freqNow'), startBtn = $('startBtn'), stopBtn = $('stopBtn');
  if (!startBtn) return; // not the tool page

  function panValue() { return state.speaker === 'left' ? -1 : state.speaker === 'right' ? 1 : 0; }

  function ensureAudio() {
    if (!state.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      state.ctx = new AC();
      state.gain = state.ctx.createGain();
      state.gain.gain.value = 0.9;
      state.pan = state.ctx.createStereoPanner ? state.ctx.createStereoPanner() : null;
      if (state.pan) { state.pan.pan.value = panValue(); state.gain.connect(state.pan); state.pan.connect(state.ctx.destination); }
      else { state.gain.connect(state.ctx.destination); }
    }
    if (state.ctx.state === 'suspended') state.ctx.resume();
    if (state.pan) state.pan.pan.value = panValue();
  }

  function startOsc(freq) {
    stopOsc();
    state.osc = state.ctx.createOscillator();
    state.osc.type = 'sine';
    state.osc.frequency.value = freq;
    state.osc.connect(state.gain);
    state.osc.start();
  }
  function stopOsc() {
    if (state.osc) { try { state.osc.stop(); } catch (e) {} state.osc.disconnect(); state.osc = null; }
  }
  function setFreq(freq) {
    if (state.osc) state.osc.frequency.setTargetAtTime(freq, state.ctx.currentTime, 0.05);
    freqNow.textContent = 'Now playing: ' + Math.round(freq) + ' Hz';
  }
  function vibrate(pattern) {
    if ('vibrate' in navigator) { try { navigator.vibrate(pattern); } catch (e) {} }
  }

  function renderDots(progress) {
    var lit = Math.round(progress * 7), out = '';
    for (var i = 0; i < 7; i++) out += '<span class="' + (i < lit ? 'on' : 'off') + '">&#9646;</span>';
    dots.innerHTML = out;
  }

  function tick() {
    var elapsed = (Date.now() - state.startedAt) / 1000;
    var total = state.total;
    var progress = Math.min(1, elapsed / total);
    bar.style.width = Math.round(progress * 100) + '%';
    pct.textContent = Math.round(progress * 100) + '%';
    renderDots(progress);
    var mode = state.mode, t = elapsed;
    if (mode === 'water') {
      // gentle 165 Hz pulse: alternate 165 Hz and a short 180 Hz lift every 2 seconds
      setFreq(t % 2 < 1.6 ? 165 : 185);
    } else if (mode === 'dust') {
      // step sweep 200 -> 1500 Hz, one step every 3 seconds
      var step = Math.floor(t / 3) % 7;
      setFreq(200 + step * (1300 / 6));
    } else if (mode === 'deep') {
      if (t < 30) setFreq(165);
      else if (t < 60) { var s = Math.floor((t - 30) / 3) % 7; setFreq(200 + s * (1300 / 6)); }
      else { setFreq(120); vibrate([200, 100, 200]); }
    } else if (mode === 'test') {
      // short ascending test tones: 300, 600, 1000, 1600 Hz
      var tones = [300, 600, 1000, 1600];
      setFreq(tones[Math.min(3, Math.floor(t / 3))]);
    }
    if (progress >= 1) finish(true);
  }

  function finish(done) {
    clearInterval(state.timer); clearInterval(state.vibeTimer);
    stopOsc(); vibrate(0);
    state.running = false;
    startBtn.disabled = false;
    stopBtn.style.display = 'none';
    startBtn.textContent = done ? 'Clean Again' : 'Start Cleaning';
    if (done) {
      bar.style.width = '100%'; pct.textContent = '100%';
      renderDots(1);
      statusText.textContent = 'Done — cleaning complete';
      statusSub.textContent = 'Test your speaker with music or a call. Repeat if the sound is still muffled.';
      freqNow.textContent = '';
    } else {
      statusText.textContent = 'Stopped';
      statusSub.textContent = 'Press Start Cleaning to run a new cycle.';
    }
  }

  function start() {
    ensureAudio();
    var mode = MODES[state.mode];
    state.running = true;
    state.total = mode.seconds;
    state.startedAt = Date.now();
    startBtn.disabled = true;
    stopBtn.style.display = 'block';
    startBtn.textContent = 'Cleaning…';
    statusText.textContent = mode.label + ' in progress';
    statusSub.textContent = mode.text;
    if (state.mode === 'water' || state.mode === 'deep') vibrate([300, 150, 300]);
    startOsc(state.mode === 'water' ? 165 : state.mode === 'dust' ? 200 : state.mode === 'test' ? 300 : 165);
    renderDots(0); bar.style.width = '0%'; pct.textContent = '0%';
    state.timer = setInterval(tick, 200);
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', function () { finish(false); });

  document.querySelectorAll('.mode').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (state.running) return;
      document.querySelectorAll('.mode').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      state.mode = btn.getAttribute('data-mode');
      statusText.textContent = MODES[state.mode].label + ' selected';
      statusSub.textContent = 'Press Start Cleaning when your volume is at maximum.';
    });
  });
  document.querySelectorAll('.spk').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (state.running) return;
      document.querySelectorAll('.spk').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      state.speaker = btn.getAttribute('data-spk');
    });
  });
  renderDots(0);
})();
