(() => {
  const grid = document.getElementById('grid');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let level = 1, lives = 3, odd = -1, locked = false;

  const sizeFor = lv => Math.min(2 + Math.floor((lv - 1) / 2), 7);
  // The difference between the odd square and the rest gets smaller each level, but never disappears.
  const gapFor = lv => Math.max(2.5, 26 - lv * 2);

  function draw() {
    levelEl.textContent = level;
    livesEl.textContent = '●'.repeat(lives) + '○'.repeat(3 - lives);
    bestEl.textContent = MG.store.get('oddone-best') || '–';
  }

  function round() {
    const n = sizeFor(level);
    const hue = Math.floor(Math.random() * 360), sat = 38 + Math.floor(Math.random() * 20), light = 52 + Math.floor(Math.random() * 14);
    const gap = gapFor(level) * (Math.random() < 0.5 ? 1 : -1);
    odd = Math.floor(Math.random() * n * n);
    locked = false;
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    grid.replaceChildren(...Array.from({ length: n * n }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'sq';
      b.style.background = `hsl(${hue} ${sat}% ${i === odd ? light + gap : light}%)`;
      b.setAttribute('aria-label', `Square ${i + 1} of ${n * n}`);
      b.addEventListener('click', () => tap(i, b));
      return b;
    }));
    status.textContent = 'Tap the square that is a little different.';
    draw();
  }

  async function tap(i, b) {
    if (locked) return;
    if (i === odd) {
      locked = true;
      b.classList.add('found');
      const best = Math.max(level, +MG.store.get('oddone-best') || 0);
      MG.store.set('oddone-best', best);
      level++;
      status.textContent = 'Yes!';
      const mine = run;
      await MG.wait(600);
      if (mine === run) round();
      return;
    }
    locked = true;
    lives--;
    b.classList.add('miss');
    grid.children[odd].classList.add('found');
    draw();
    const mine = run;
    if (!lives) {
      status.textContent = 'That was the one.';
      await MG.wait(700);
      if (mine !== run) return;
      const reached = level - 1;
      (reached ? ov.win : ov.show)(reached ? `Level ${reached}` : 'Good start',
        reached ? `You spotted ${reached} odd square${reached === 1 ? '' : 's'}. Your eyes did well.` : 'Look for the square with a slightly different shade.', 'Play again', start, 300);
      return;
    }
    status.textContent = `Not that one. ${lives} ${lives === 1 ? 'try' : 'tries'} left.`;
    await MG.wait(1100);
    if (mine === run) round();
  }

  let run = 0;
  function start() {
    run++;
    level = 1;
    lives = 3;
    ov.hide();
    round();
  }

  document.getElementById('new').addEventListener('click', start);
  start();
})();
