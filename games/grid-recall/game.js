(() => {
  const gridEl = document.getElementById('grid');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const startBtn = document.getElementById('start');
  const ov = MG.overlay(document.querySelector('.stage'));

  let level, lives, pattern, found, listening, round = 0, cells, n;

  // Level 1 shows 3 squares on a 3×3 grid; the grid grows as the pattern does.
  const sizeFor = lv => (lv < 3 ? 3 : lv < 6 ? 4 : lv < 10 ? 5 : 6);
  const countFor = lv => lv + 2;

  function build() {
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = Array.from({ length: n * n }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'g';
      b.disabled = true;
      b.setAttribute('aria-label', `Square ${i + 1}`);
      b.addEventListener('click', () => tap(i));
      return b;
    });
    gridEl.replaceChildren(...cells);
  }

  function draw() {
    levelEl.textContent = level;
    livesEl.textContent = '●'.repeat(lives) + '○'.repeat(3 - lives);
    bestEl.textContent = MG.store.get('recall-grid-best') || 0;
  }

  async function play() {
    const id = ++round;
    listening = false;
    n = sizeFor(level);
    build();
    draw();
    pattern = new Set(MG.shuffle([...Array(n * n).keys()]).slice(0, countFor(level)));
    found = new Set();
    status.textContent = `Watch: ${pattern.size} squares.`;
    await MG.wait(600);
    if (id !== round) return;
    pattern.forEach(i => cells[i].classList.add('lit'));
    await MG.wait(900 + pattern.size * 220);
    if (id !== round) return;
    pattern.forEach(i => cells[i].classList.remove('lit'));
    cells.forEach(b => { b.disabled = false; });
    listening = true;
    status.textContent = 'Now tap the squares that lit up.';
  }

  async function tap(i) {
    if (!listening || found.has(i)) return;
    if (pattern.has(i)) {
      found.add(i);
      cells[i].classList.add('hit');
      if (found.size === pattern.size) {
        listening = false;
        const best = Math.max(level, +MG.store.get('recall-grid-best') || 0);
        MG.store.set('recall-grid-best', best);
        status.textContent = 'All found. One more next time.';
        level++;
        await MG.wait(700);
        play();
      }
      return;
    }
    listening = false;
    lives--;
    cells[i].classList.add('miss');
    pattern.forEach(j => { if (!found.has(j)) cells[j].classList.add('missed'); });
    cells.forEach(b => { b.disabled = true; });
    draw();
    if (!lives) {
      const reached = level - 1;
      status.textContent = 'That one was not in the pattern.';
      ov.show(reached ? `Level ${reached} cleared` : 'Good start', reached ? `You remembered patterns of up to ${countFor(reached)} squares.` : 'Watch the whole shape, then tap it back.', 'Play again', start, 900);
      return;
    }
    status.textContent = `That square wasn't lit. The ringed squares were. ${lives} ${lives === 1 ? 'try' : 'tries'} left.`;
    await MG.wait(1600);
    play();
  }

  function start() {
    level = 1;
    lives = 3;
    ov.hide();
    startBtn.textContent = 'Restart';
    play();
  }

  startBtn.addEventListener('click', start);
  level = 1;
  lives = 3;
  n = 3;
  build();
  draw();
})();
