(() => {
  const grid = document.getElementById('grid');
  const roundEl = document.getElementById('round');
  const foundEl = document.getElementById('found');
  const winsEl = document.getElementById('best');
  const status = document.getElementById('status');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show;

  const THINGS = ['🐱', '⭐', '🦋', '🍎', '🌸', '🐟'];
  const CLUTTER = ['🌳', '🌼', '🍄', '🐌', '🐞', '🌈', '☁️', '🍓', '🐥', '🎈', '🪨', '🍃', '🐛', '🌻', '🍂'];
  const SIZES = [3, 4, 4, 5, 5, 6];
  const COUNTS = [3, 3, 4, 4, 5, 6];
  const ROUNDS = SIZES.length;

  let round = 1, target = '', need = 0, got = 0, run = 0, locked = false;

  const draw = () => {
    roundEl.textContent = round;
    foundEl.textContent = `${got} of ${need}`;
    winsEl.textContent = MG.store.get('findall-wins') || 0;
  };

  function deal() {
    const n = SIZES[round - 1];
    const total = n * n;
    need = COUNTS[round - 1];
    got = 0;
    locked = false;
    target = THINGS[(round - 1) % THINGS.length];
    const spots = new Set();
    while (spots.size < need) spots.add(Math.floor(Math.random() * total));
    grid.style.setProperty('--n', n);
    grid.replaceChildren(...Array.from({ length: total }, (_, i) => {
      const b = document.createElement('button');
      const hit = spots.has(i);
      b.className = 'fcell';
      b.textContent = hit ? target : CLUTTER[Math.floor(Math.random() * CLUTTER.length)];
      b.setAttribute('aria-label', `Picture ${i + 1} of ${total}`);
      b.addEventListener('click', () => tap(hit, b));
      return b;
    }));
    status.textContent = `Find all ${need} of these: ${target}`;
    draw();
  }

  async function tap(hit, b) {
    if (locked || b.classList.contains('found')) return;
    if (!hit) {
      b.classList.remove('miss'); void b.offsetWidth; b.classList.add('miss');
      status.textContent = `Not that one. Look for ${target}`;
      return;
    }
    b.classList.add('found');
    got++;
    draw();
    if (got < need) { status.textContent = `${need - got} more ${target} to find`; return; }
    locked = true;
    status.textContent = `You found them all ${target}`;
    const mine = run;
    await MG.wait(900);
    if (mine !== run) return;
    if (round >= ROUNDS) {
      MG.store.set('findall-wins', (+MG.store.get('findall-wins') || 0) + 1);
      draw();
      ov.win('Everything found', `${ROUNDS} boards cleared. Sharp eyes!`, 'Play again', start, 300);
      return;
    }
    round++;
    deal();
  }

  function start() {
    run++;
    round = 1;
    ov.hide();
    deal();
  }

  document.getElementById('new').addEventListener('click', start);
  start();
})();
