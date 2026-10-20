(() => {
  const grid = document.getElementById('grid');
  const roundEl = document.getElementById('round');
  const peeksEl = document.getElementById('peeks');
  const winsEl = document.getElementById('best');
  const status = document.getElementById('status');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show;

  const FRIENDS = ['🐱', '🐶', '🐰', '🐸', '🐥', '🦊'];
  const PLACES = ['🌳', '📦', '🪴', '⛺', '🏠', '🌵'];
  const SPOTS = [3, 4, 6, 6, 9, 12];
  const ROUNDS = SPOTS.length;

  let round = 1, hidden = -1, peeks = 0, locked = false, run = 0;

  const draw = () => {
    roundEl.textContent = round;
    peeksEl.textContent = peeks;
    winsEl.textContent = MG.store.get('hideseek-wins') || 0;
  };

  function deal() {
    const n = SPOTS[round - 1];
    const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4;
    hidden = Math.floor(Math.random() * n);
    peeks = 0;
    locked = false;
    grid.style.setProperty('--n', cols);
    const place = PLACES[(round - 1) % PLACES.length];
    grid.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'fcell';
      b.textContent = place;
      b.setAttribute('aria-label', `Hiding place ${i + 1} of ${n}`);
      b.addEventListener('click', () => peek(i, b));
      return b;
    }));
    status.textContent = `${FRIENDS[(round - 1) % FRIENDS.length]} is hiding. Peek behind a ${place}!`;
    draw();
  }

  async function peek(i, b) {
    if (locked || b.disabled) return;
    peeks++;
    if (i !== hidden) {
      b.disabled = true;
      b.textContent = '·';
      b.classList.add('empty');
      status.textContent = 'Nobody here. Try another!';
      draw();
      return;
    }
    locked = true;
    const friend = FRIENDS[(round - 1) % FRIENDS.length];
    b.textContent = friend;
    b.classList.add('found');
    status.textContent = `Peekaboo! Found ${friend}`;
    draw();
    const mine = run;
    await MG.wait(1000);
    if (mine !== run) return;
    if (round >= ROUNDS) {
      MG.store.set('hideseek-wins', (+MG.store.get('hideseek-wins') || 0) + 1);
      draw();
      ov.win('All found', 'Every friend came out of hiding. Great seeking!', 'Play again', start, 300);
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
