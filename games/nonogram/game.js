(() => {
  const puzzleEl = document.getElementById('puzzle');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = +MG.store.get('nonogram-n') || 5;
  let mode = 'fill';
  let target, state, rowClues, colClues, cells, rowEls, colEls, done;

  // Runs of filled squares in a line, e.g. [1,1,1,0,1] → [3,1]. Empty line → [0].
  const runs = line => {
    const out = [];
    let k = 0;
    for (const v of line) {
      if (v) k++;
      else if (k) { out.push(k); k = 0; }
    }
    if (k) out.push(k);
    return out.length ? out : [0];
  };
  const rowOf = (g, r) => g.slice(r * n, r * n + n);
  const colOf = (g, c) => Array.from({ length: n }, (_, r) => g[r * n + c]);
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  function newGame(size = n) {
    n = size;
    MG.store.set('nonogram-n', n);
    do {
      target = Array.from({ length: n * n }, () => Math.random() < 0.58);
    } while ([...Array(n).keys()].some(i => same(runs(rowOf(target, i)), [0]) || same(runs(colOf(target, i)), [0])));
    rowClues = [...Array(n).keys()].map(r => runs(rowOf(target, r)));
    colClues = [...Array(n).keys()].map(c => runs(colOf(target, c)));
    state = new Array(n * n).fill(0); // 0 empty, 1 filled, 2 marked
    done = false;
    clock.reset();
    ov.hide();
    build();
    const best = MG.store.get(`nonogram-best-${n}`);
    bestEl.textContent = best ? MG.fmt(+best) : '–';
  }

  function build() {
    puzzleEl.classList.remove('solved');
    const clueWidth = n <= 5 ? 'auto' : 'minmax(56px, auto)';
    puzzleEl.style.gridTemplateColumns = `${clueWidth} repeat(${n}, 1fr)`;
    const parts = [document.createElement('div')];
    colEls = colClues.map(clue => {
      const d = document.createElement('div');
      d.className = 'clue col';
      d.innerHTML = clue.map(x => `<span>${x}</span>`).join('');
      parts.push(d);
      return d;
    });
    rowEls = [];
    cells = [];
    for (let r = 0; r < n; r++) {
      const d = document.createElement('div');
      d.className = 'clue row';
      d.innerHTML = rowClues[r].map(x => `<span>${x}</span>`).join('');
      rowEls.push(d);
      parts.push(d);
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const b = document.createElement('button');
        b.className = 'nc';
        b.dataset.i = i;
        // Group 5×5 blocks on bigger grids for easier counting.
        if (n > 5 && c % 5 === 4 && c < n - 1) b.classList.add('gap-r');
        if (n > 5 && r % 5 === 4 && r < n - 1) b.classList.add('gap-b');
        cells.push(b);
        parts.push(b);
      }
    }
    puzzleEl.replaceChildren(...parts);
    render();
  }

  function render() {
    cells.forEach((b, i) => {
      b.classList.toggle('fill', state[i] === 1);
      b.textContent = state[i] === 2 ? '✕' : '';
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}, ${['empty', 'filled', 'marked'][state[i]]}`);
    });
    const filled = state.map(v => v === 1);
    rowEls.forEach((el, r) => el.classList.toggle('done', same(runs(rowOf(filled, r)), rowClues[r])));
    colEls.forEach((el, c) => el.classList.toggle('done', same(runs(colOf(filled, c)), colClues[c])));
  }

  function check() {
    const filled = state.map(v => v === 1);
    const ok = [...Array(n).keys()].every(i =>
      same(runs(rowOf(filled, i)), rowClues[i]) && same(runs(colOf(filled, i)), colClues[i]));
    if (!ok) return;
    done = true;
    const ms = clock.stop();
    puzzleEl.classList.add('solved');
    const prev = +MG.store.get(`nonogram-best-${n}`);
    if (!prev || ms < prev) MG.store.set(`nonogram-best-${n}`, ms);
    bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
    ov.show('Solved', `${n}×${n} in ${MG.fmt(ms)}.${!prev || ms < prev ? ' A new best.' : ''}`, 'New puzzle', () => newGame(), 1200);
  }

  // Press, then drag to paint the same value across squares.
  let paint = null;
  const cellAt = e => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el && el.classList.contains('nc') ? +el.dataset.i : -1;
  };
  const apply = i => {
    if (i < 0 || state[i] === paint) return;
    state[i] = paint;
    render();
  };
  puzzleEl.addEventListener('pointerdown', e => {
    const i = cellAt(e);
    if (done || i < 0) return;
    e.preventDefault();
    clock.start();
    const want = mode === 'fill' ? 1 : 2;
    paint = state[i] === want ? 0 : want;
    apply(i);
  });
  puzzleEl.addEventListener('pointermove', e => { if (paint !== null) apply(cellAt(e)); });
  // Keyboard: Enter or Space on a focused square.
  puzzleEl.addEventListener('click', e => {
    const b = e.target.closest('.nc');
    if (e.detail !== 0 || done || !b) return;
    clock.start();
    const want = mode === 'fill' ? 1 : 2;
    paint = state[b.dataset.i] === want ? 0 : want;
    apply(+b.dataset.i);
    end();
  });
  const end = () => { if (paint === null) return; paint = null; check(); };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);

  document.getElementById('clear').addEventListener('click', () => {
    if (done) return;
    state.fill(0);
    render();
  });
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('mode'), mode, v => { mode = v; });
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
