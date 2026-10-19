(() => {
  const NOTES = [261.63, 329.63, 392.0, 440.0]; // C, E, G, A: a gentle pentatonic set
  const pads = [...document.querySelectorAll('.pad')];
  const status = document.getElementById('status');
  const lenEl = document.getElementById('len');
  const bestEl = document.getElementById('best');
  const startBtn = document.getElementById('start');
  const soundBtn = document.getElementById('sound');
  const ov = MG.overlay(document.querySelector('.stage'));

  let speed = MG.kids ? 'calm' : MG.store.get('sequence-speed') || 'calm';
  let soundOn = MG.store.get('sequence-sound') !== 'off';
  let seq = [], pos = 0, listening = false, game = 0;
  let audio;

  function tone(k, ms) {
    if (!soundOn) return;
    try {
      audio = audio || new AudioContext();
      const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = NOTES[k];
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000 + 0.25);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.3);
    } catch {}
  }

  async function flash(k, ms) {
    pads[k].classList.add('lit');
    tone(k, ms);
    await MG.wait(ms);
    pads[k].classList.remove('lit');
  }

  function setPads(on) { pads.forEach(p => { p.disabled = !on; }); }

  async function playRound() {
    const id = game;
    listening = false;
    setPads(false);
    seq.push(Math.floor(Math.random() * 4));
    lenEl.textContent = seq.length - 1;
    status.textContent = 'Watch…';
    const base = speed === 'calm' ? 620 : 420;
    const step = Math.max(base - seq.length * 12, base * 0.6);
    await MG.wait(700);
    for (const k of seq) {
      if (id !== game) return;
      await flash(k, step);
      await MG.wait(step * 0.4);
    }
    if (id !== game) return;
    pos = 0;
    listening = true;
    setPads(true);
    status.innerHTML = `Your turn. Repeat <b>${seq.length}</b>.`;
  }

  function press(k) {
    if (!listening) return;
    flash(k, 260);
    if (k !== seq[pos]) return lose();
    pos++;
    if (pos === seq.length) {
      lenEl.textContent = seq.length;
      saveBest(seq.length);
      status.textContent = 'Lovely.';
      playRound();
    }
  }

  function saveBest(n) {
    const best = Math.max(n, +MG.store.get('sequence-best') || 0);
    MG.store.set('sequence-best', best);
    bestEl.textContent = best;
  }

  function lose() {
    listening = false;
    setPads(false);
    const score = seq.length - 1;
    status.textContent = 'That was a different pad.';
    ov.show(score ? `${score} in a row` : 'Not quite',
      score ? `You repeated a pattern of ${score}. Breathe, and try again.` : 'Watch the first light, then tap the same pad.',
      'Play again', start, 500);
  }

  function start() {
    game++;
    seq = [];
    ov.hide();
    startBtn.textContent = 'Restart';
    playRound();
  }

  pads.forEach((p, k) => p.addEventListener('pointerdown', e => { e.preventDefault(); press(k); }));
  pads.forEach((p, k) => p.addEventListener('click', e => { if (e.detail === 0) press(k); }));
  document.addEventListener('keydown', e => {
    const k = { 1: 0, 2: 1, 3: 2, 4: 3, q: 0, w: 1, a: 2, s: 3 }[e.key.toLowerCase()];
    if (k !== undefined) press(k);
  });

  const drawSound = () => {
    soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
  };
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    MG.store.set('sequence-sound', soundOn ? 'on' : 'off');
    drawSound();
  });
  startBtn.addEventListener('click', start);
  MG.seg(document.getElementById('speed'), speed, v => { speed = v; MG.store.set('sequence-speed', v); });

  drawSound();
  setPads(false);
  bestEl.textContent = MG.store.get('sequence-best') || 0;
})();
