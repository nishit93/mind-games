(() => {
  const ringsEl = document.getElementById('rings');
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('min');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let n = +MG.store.get('rings-n') || 4;
  let on, moves, history, done;

  // on[k] is ring k+1 (ring 1 on the far right).
  const fewest = k => (k % 2 ? (2 ** (k + 1) - 1) / 3 : (2 ** (k + 1) - 2) / 3);
  const canMove = k => k === 0 || (on[k - 1] && on.slice(0, k - 1).every(x => !x));

  function newGame(size = n) {
    n = size;
    MG.store.set('rings-n', n);
    on = new Array(n).fill(true);
    moves = 0;
    history = [];
    done = false;
    ov.hide();
    status.textContent = 'Tap a glowing ring to move it.';
    render();
  }

  function render() {
    ringsEl.innerHTML = on.map((_, k) => k).reverse().map(k => `
      <button class="ring${on[k] ? '' : ' off'}${canMove(k) && !done ? ' can' : ''}" data-k="${k}" ${done ? 'disabled' : ''}
        aria-label="Ring ${k + 1}, ${on[k] ? 'on the bar' : 'off'}${canMove(k) ? ', can move' : ''}">
        <span class="o"></span><span class="stem"></span><span class="num">${k + 1}</span>
      </button>`).join('');
    movesEl.textContent = moves;
    minEl.textContent = fewest(n);
    bestEl.textContent = MG.store.get(`rings-best-${n}`) || '–';
    undoBtn.disabled = !history.length || done;
  }

  ringsEl.addEventListener('click', e => {
    const b = e.target.closest('.ring');
    if (!b || done) return;
    const k = +b.dataset.k;
    if (!canMove(k)) {
      status.textContent = k === 0 ? '' : `Ring ${k + 1} needs ring ${k} on and every ring to its right off.`;
      b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      return;
    }
    history.push(on.slice());
    on[k] = !on[k];
    moves++;
    const left = on.filter(Boolean).length;
    status.textContent = left ? `${left} ring${left === 1 ? '' : 's'} still on the bar.` : 'All rings are off.';
    if (!left) {
      done = true;
      const prev = +MG.store.get(`rings-best-${n}`);
      if (!prev || moves < prev) MG.store.set(`rings-best-${n}`, moves);
      const min = fewest(n);
      ov.win(moves === min ? 'Perfectly freed' : 'All rings off',
        moves === min ? `${moves} moves, the fewest possible.` : `${moves} moves. The fewest possible is ${min}.`, 'Play again', () => newGame(), 700);
    }
    render();
  });

  undoBtn.addEventListener('click', () => {
    if (!history.length || done) return;
    on = history.pop();
    moves--;
    status.textContent = 'Move taken back.';
    render();
  });
  document.getElementById('restart').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
