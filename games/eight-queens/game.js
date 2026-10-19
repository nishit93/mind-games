(() => {
  const TOTAL = { 5: 10, 6: 4, 8: 92 };
  const gridEl = document.getElementById('grid');
  const placedEl = document.getElementById('placed');
  const needEl = document.getElementById('need');
  const foundEl = document.getElementById('found');
  const allEl = document.getElementById('all');
  const status = document.getElementById('status');
  const shadeBtn = document.getElementById('shade');
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = +MG.store.get('queens-n') || 8;
  let shade = MG.store.get('queens-shade') !== 'off';
  let queens, cells, solved;

  const rc = i => [Math.floor(i / n), i % n];
  const attacks = (a, b) => {
    const [r1, c1] = rc(a), [r2, c2] = rc(b);
    return a !== b && (r1 === r2 || c1 === c2 || Math.abs(r1 - r2) === Math.abs(c1 - c2));
  };
  const foundKey = () => `queens-found-${n}`;
  const found = () => MG.store.json(foundKey()) || [];

  function newGame(size = n) {
    n = size;
    MG.store.set('queens-n', n);
    queens = new Set();
    solved = false;
    ov.hide();
    gridEl.classList.remove('solved');
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = Array.from({ length: n * n }, (_, i) => {
      const b = document.createElement('button');
      b.addEventListener('click', () => tap(i));
      return b;
    });
    gridEl.replaceChildren(...cells);
    needEl.textContent = n;
    allEl.textContent = TOTAL[n];
    status.textContent = 'Place a queen on every row, with none attacking another.';
    render();
  }

  function render() {
    const qs = [...queens];
    cells.forEach((b, i) => {
      const [r, c] = rc(i);
      const queen = queens.has(i);
      const clash = queen && qs.some(q => attacks(q, i));
      const attacked = !queen && shade && qs.some(q => attacks(q, i));
      b.className = 'sq' + ((r + c) % 2 ? ' dark' : '') + (attacked ? ' attacked' : '') + (queen ? ' queen' : '') + (clash ? ' clash' : '');
      b.textContent = queen ? '♛' : '';
      b.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${queen ? (clash ? 'queen under attack' : 'queen') : attacked ? 'attacked' : 'safe'}`);
    });
    placedEl.textContent = queens.size;
    foundEl.textContent = found().length;
    shadeBtn.textContent = shade ? 'Shading on' : 'Shading off';
    shadeBtn.setAttribute('aria-pressed', String(shade));
  }

  function tap(i) {
    if (solved) return;
    if (queens.has(i)) queens.delete(i);
    else queens.add(i);
    render();

    const qs = [...queens];
    const clashes = qs.some(a => qs.some(b => attacks(a, b)));
    if (queens.size === n && !clashes) finish();
    else if (clashes) status.textContent = 'Two queens are attacking each other.';
    else status.textContent = `${n - queens.size} more to place.`;
  }

  function finish() {
    solved = true;
    gridEl.classList.add('solved');
    // Record the solution as the column of the queen in each row.
    const key = [...queens].sort((a, b) => a - b).map(i => i % n).join('');
    const list = found();
    const isNew = !list.includes(key);
    if (isNew) { list.push(key); MG.store.set(foundKey(), JSON.stringify(list)); }
    render();
    status.textContent = isNew ? 'A new solution.' : 'Solved, but you have found this one before.';
    const left = TOTAL[n] - list.length;
    ov.show(isNew ? 'A new solution' : 'Solved again',
      left ? `${list.length} of ${TOTAL[n]} found. ${left} more to discover.` : `You have found all ${TOTAL[n]} solutions on this board.`,
      'Next', () => newGame(), 700);
  }

  shadeBtn.addEventListener('click', () => {
    shade = !shade;
    MG.store.set('queens-shade', shade ? 'on' : 'off');
    render();
  });
  document.getElementById('clear').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
