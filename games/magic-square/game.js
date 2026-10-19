(() => {
  // Base squares; random rotations, reflections (and for 4×4 a few known symmetries) give variety.
  const BASE = {
    3: [2, 7, 6, 9, 5, 1, 4, 3, 8],
    4: [16, 3, 2, 13, 5, 10, 11, 8, 9, 6, 7, 12, 4, 15, 14, 1],
  };
  const GIVEN = { 3: 2, 4: 6 };
  const gridEl = document.getElementById('grid');
  const padEl = document.getElementById('pad');
  const targetEl = document.getElementById('target');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let n = MG.kids ? 3 : +MG.store.get('magic-n') || 3;
  let solution, given, values, sel, done, cells, sums;

  const transform = (sq, size) => {
    let g = sq.slice();
    const rot = a => a.map((_, i) => a[(size - 1 - (i % size)) * size + Math.floor(i / size)]);
    const flip = a => a.map((_, i) => a[Math.floor(i / size) * size + size - 1 - (i % size)]);
    for (let k = Math.floor(Math.random() * 4); k > 0; k--) g = rot(g);
    if (Math.random() < 0.5) g = flip(g);
    // 4×4: swapping the two middle rows and the two middle columns keeps it magic.
    if (size === 4 && Math.random() < 0.5) {
      const swapRows = a => a.map((_, i) => { const r = Math.floor(i / 4), c = i % 4; const rr = r === 1 ? 2 : r === 2 ? 1 : r; return a[rr * 4 + c]; });
      const swapCols = a => a.map((_, i) => { const r = Math.floor(i / 4), c = i % 4; const cc = c === 1 ? 2 : c === 2 ? 1 : c; return a[r * 4 + cc]; });
      g = swapCols(swapRows(g));
    }
    return g;
  };

  const target = () => (n * (n * n + 1)) / 2;
  const lines = () => {
    const L = [];
    for (let k = 0; k < n; k++) {
      L.push({ kind: 'row', k, cells: [...Array(n).keys()].map(c => k * n + c) });
      L.push({ kind: 'col', k, cells: [...Array(n).keys()].map(r => r * n + k) });
    }
    L.push({ kind: 'd1', cells: [...Array(n).keys()].map(i => i * n + i) });
    L.push({ kind: 'd2', cells: [...Array(n).keys()].map(i => i * n + n - 1 - i) });
    return L;
  };

  function newGame(size = n) {
    n = size;
    MG.store.set('magic-n', n);
    solution = transform(BASE[n], n);
    const keep = new Set(MG.shuffle([...Array(n * n).keys()]).slice(0, GIVEN[n]));
    given = solution.map((_, i) => keep.has(i));
    values = solution.map((v, i) => (keep.has(i) ? v : 0));
    sel = values.indexOf(0);
    done = false;
    clock.reset();
    ov.hide();
    targetEl.textContent = target();

    // (n+1)×(n+1) layout: numbers, row sums on the right, column sums below, diagonals in corners.
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr) 0.8fr`;
    const parts = [];
    cells = [];
    sums = {};
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const b = document.createElement('button');
        b.className = 'cell';
        b.addEventListener('click', () => { if (!given[i] && !done) { sel = i; render(); } });
        cells.push(b);
        parts.push(b);
      }
      parts.push(sums[`row${r}`] = Object.assign(document.createElement('div'), { className: 'sum' }));
    }
    for (let c = 0; c < n; c++) parts.push(sums[`col${c}`] = Object.assign(document.createElement('div'), { className: 'sum' }));
    parts.push(sums.d1 = Object.assign(document.createElement('div'), { className: 'sum diag' }));
    gridEl.replaceChildren(...parts);
    // The other diagonal's total sits above the grid's last column.
    sums.d2 = Object.assign(document.createElement('div'), { className: 'sum diag' });
    sums.d2.style.cssText = 'grid-column: 1 / -1; justify-self: start; padding: 2px 10px;';
    gridEl.prepend(sums.d2);

    padEl.style.gridTemplateColumns = `repeat(${n === 3 ? 5 : 6}, 1fr)`;
    padEl.innerHTML = [...Array(n * n).keys()].map(k => `<button class="key" data-v="${k + 1}">${k + 1}</button>`).join('')
      + '<button class="key" data-v="0" aria-label="Clear">⌫</button>';
    render();
  }

  function render() {
    cells.forEach((b, i) => {
      b.textContent = values[i] || '';
      b.className = 'cell' + (given[i] ? ' given' : '') + (i === sel && !done ? ' sel' : '');
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, ${values[i] || 'empty'}`);
    });
    for (const l of lines()) {
      const el = sums[l.kind === 'row' ? `row${l.k}` : l.kind === 'col' ? `col${l.k}` : l.kind];
      const total = l.cells.reduce((s, i) => s + values[i], 0);
      const full = l.cells.every(i => values[i]);
      el.textContent = l.kind === 'd1' ? `↘ ${total}` : l.kind === 'd2' ? `↙ diagonal ${total}` : total;
      el.className = 'sum' + (l.kind.startsWith('d') ? ' diag' : '') + (full && total === target() ? ' ok' : total > target() ? ' over' : '');
    }
    const used = new Set(values);
    padEl.querySelectorAll('[data-v]').forEach(k => k.classList.toggle('used', +k.dataset.v > 0 && used.has(+k.dataset.v)));
  }

  function enter(v) {
    if (done || sel === null || given[sel]) return;
    clock.start();
    if (v) { const j = values.indexOf(v); if (j >= 0 && !given[j]) values[j] = 0; else if (j >= 0) return; }
    values[sel] = v;
    if (v) { const next = values.findIndex((x, i) => !x && i > sel); sel = next >= 0 ? next : values.indexOf(0) >= 0 ? values.indexOf(0) : sel; }
    render();
    if (values.every(Boolean) && lines().every(l => l.cells.reduce((s, i) => s + values[i], 0) === target())) {
      done = true;
      const ms = clock.stop();
      render();
      ov.win('Magic', `Every line makes ${target()}. Solved in ${MG.fmt(ms)}.`, 'New square', () => newGame(), 600);
    }
  }

  padEl.addEventListener('click', e => { const k = e.target.closest('[data-v]'); if (k) enter(+k.dataset.v); });
  document.addEventListener('keydown', e => { if (e.key === 'Backspace') enter(0); });
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
