(() => {
  const grid = document.getElementById('grid');
  const roundEl = document.getElementById('round');
  const winsEl = document.getElementById('best');
  const status = document.getElementById('status');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show;

  const OTHERS = ['🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉', '🐴', '🐝', '🐢', '🐙', '🐠', '🐘', '🐑'];
  const SIZES = [3, 3, 4, 4, 5, 5, 6, 6];
  const ROUNDS = SIZES.length;

  let round = 1, cat = -1, locked = false, run = 0;

  function draw() {
    roundEl.textContent = round;
    winsEl.textContent = MG.store.get('findcat-wins') || 0;
  }

  function deal() {
    const n = SIZES[round - 1];
    const total = n * n;
    cat = Math.floor(Math.random() * total);
    locked = false;
    grid.style.setProperty('--n', n);
    grid.replaceChildren(...Array.from({ length: total }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'fcell';
      b.textContent = i === cat ? '🐱' : OTHERS[Math.floor(Math.random() * OTHERS.length)];
      b.setAttribute('aria-label', `Picture ${i + 1} of ${total}`);
      b.addEventListener('click', () => tap(i, b));
      return b;
    }));
    status.textContent = 'Can you find the cat?';
    draw();
  }

  async function tap(i, b) {
    if (locked) return;
    if (i !== cat) {
      b.classList.remove('miss'); void b.offsetWidth; b.classList.add('miss');
      status.textContent = 'Not this one. Keep looking!';
      return;
    }
    locked = true;
    b.classList.add('found');
    status.textContent = 'You found the cat!';
    const mine = run;
    await MG.wait(900);
    if (mine !== run) return;
    if (round >= ROUNDS) {
      MG.store.set('findcat-wins', (+MG.store.get('findcat-wins') || 0) + 1);
      draw();
      ov.win('Every cat found', `${ROUNDS} cats found, and they hid better each time. Well spotted!`, 'Play again', start, 300);
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
