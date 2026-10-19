(() => {
  const gridEl = document.getElementById('grid');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = +MG.store.get('binary-n') || 6;
  let given, values, cells, done;

  const line = (g, k, isRow) => Array.from({ length: n }, (_, j) => g[isRow ? k * n + j : j * n + k]);

  // Rules 1 and 2 for one line; empty cells are -1.
  function lineOk(l) {
    let zeros = 0, ones = 0;
    for (let j = 0; j < n; j++) {
      if (l[j] === 0) zeros++;
      if (l[j] === 1) ones++;
      if (j >= 2 && l[j] >= 0 && l[j] === l[j - 1] && l[j] === l[j - 2]) return false;
    }
    return zeros <= n / 2 && ones <= n / 2;
  }

  // Rule 3: a full line must not repeat another full line.
  function unique(g, k, isRow) {
    const l = line(g, k, isRow);
    if (l.includes(-1)) return true;
    const s = l.join('');
    for (let o = 0; o < n; o++) {
      if (o === k) continue;
      const m = line(g, o, isRow);
      if (!m.includes(-1) && m.join('') === s) return false;
    }
    return true;
  }

  const okAt = (g, i) => {
    const r = Math.floor(i / n), c = i % n;
    return lineOk(line(g, r, true)) && lineOk(line(g, c, false)) && unique(g, r, true) && unique(g, c, false);
  };

  // Count solutions up to limit; with random=true leave the first one in g.
  function solve(g, limit, random = false) {
    const i = g.indexOf(-1);
    if (i < 0) return 1;
    const order = random && Math.random() < 0.5 ? [1, 0] : [0, 1];
    let found = 0;
    for (const v of order) {
      g[i] = v;
      if (okAt(g, i)) {
        found += solve(g, limit - found, random);
        if (found >= limit) { if (random) return found; break; }
      }
    }
    g[i] = -1;
    return found;
  }

  function generate() {
    const full = new Array(n * n).fill(-1);
    solve(full, 1, true);
    const puzzle = full.slice();
    // Keep about a third of the circles so puzzles stay relaxing rather than minimal.
    let filled = n * n;
    for (const i of MG.shuffle([...puzzle.keys()])) {
      if (filled <= Math.round(n * n * 0.32)) break;
      const keep = puzzle[i];
      puzzle[i] = -1;
      if (solve(puzzle.slice(), 2) === 1) filled--;
      else puzzle[i] = keep;
    }
    return puzzle;
  }

  function newGame(size = n) {
    n = size;
    MG.store.set('binary-n', n);
    values = generate();
    given = values.map(v => v >= 0);
    done = false;
    clock.reset();
    ov.hide();
    gridEl.classList.remove('solved');
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = values.map((_, i) => {
      const b = document.createElement('button');
      b.addEventListener('click', () => tap(i));
      return b;
    });
    gridEl.replaceChildren(...cells);
    const best = MG.store.get(`binary-best-${n}`);
    bestEl.textContent = best ? MG.fmt(+best) : '–';
    status.textContent = `${values.filter(v => v < 0).length} circles to fill.`;
    render();
  }

  function render() {
    const badRows = new Set(), badCols = new Set();
    for (let k = 0; k < n; k++) {
      if (!lineOk(line(values, k, true))) badRows.add(k);
      if (!lineOk(line(values, k, false))) badCols.add(k);
    }
    cells.forEach((b, i) => {
      const r = Math.floor(i / n), c = i % n, v = values[i];
      b.className = 'b' + (v >= 0 ? ` v${v}` : '') + (given[i] ? ' given' : '')
        + (v >= 0 && !given[i] && (badRows.has(r) || badCols.has(c)) ? ' bad' : '');
      b.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${v === 0 ? 'brown' : v === 1 ? 'peach' : 'empty'}${given[i] ? ', given' : ''}`);
    });
  }

  function tap(i) {
    if (done || given[i]) return;
    clock.start();
    values[i] = values[i] === -1 ? 0 : values[i] === 0 ? 1 : -1;
    render();
    const left = values.filter(v => v < 0).length;
    if (left) { status.textContent = `${left} circle${left === 1 ? '' : 's'} to fill.`; return; }
    const ok = values.every((_, k) => k >= n || (lineOk(line(values, k, true)) && lineOk(line(values, k, false))
      && unique(values, k, true) && unique(values, k, false)));
    if (!ok) { status.textContent = 'All filled, but a rule is broken somewhere.'; return; }
    done = true;
    const ms = clock.stop();
    gridEl.classList.add('solved');
    const prev = +MG.store.get(`binary-best-${n}`);
    if (!prev || ms < prev) MG.store.set(`binary-best-${n}`, ms);
    bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
    status.textContent = 'Solved.';
    ov.show('Solved', `${n}×${n} in ${MG.fmt(ms)}.${!prev || ms < prev ? ' A new best.' : ''}`, 'New puzzle', () => newGame(), 700);
  }

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
