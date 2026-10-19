(() => {
  const grid = document.getElementById('grid');
  const movesEl = document.getElementById('moves');
  const leftEl = document.getElementById('left');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let n = MG.kids ? 3 : +MG.store.get('lights-n') || 5;
  let on, cells, moves, done;

  function flip(i) {
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) on[rr * n + cc] ^= 1;
    }
  }

  // Start from all-off and press random squares, so every puzzle is solvable.
  function newGame(size = n) {
    n = size;
    MG.store.set('lights-n', n);
    on = new Array(n * n).fill(0);
    while (on.every(v => !v)) {
      for (const i of MG.shuffle([...on.keys()]).slice(0, Math.ceil(n * n / 2))) {
        if (Math.random() < 0.6) flip(i);
      }
    }
    moves = 0;
    done = false;
    clock.reset();
    ov.hide();
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = on.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'light';
      b.addEventListener('click', () => press(i));
      return b;
    });
    grid.replaceChildren(...cells);
    render();
  }

  function render() {
    cells.forEach((b, i) => {
      b.classList.toggle('on', !!on[i]);
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}, ${on[i] ? 'on' : 'off'}`);
    });
    movesEl.textContent = moves;
    leftEl.textContent = on.filter(Boolean).length;
  }

  function press(i) {
    if (done) return;
    clock.start();
    flip(i);
    moves++;
    render();
    if (on.every(v => !v)) {
      done = true;
      const ms = clock.stop();
      ov.win('All lights off', `${moves} move${moves === 1 ? '' : 's'}.`, 'Play again', () => newGame());
    }
  }

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
