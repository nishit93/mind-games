(() => {
  // Mini is a 4×4 grid with 2×2 boxes and the digits 1–4; the others are classic 9×9.
  const LEVELS = { mini: { size: 4, givens: 6 }, easy: { size: 9, givens: 40 }, medium: { size: 9, givens: 32 }, hard: { size: 9, givens: 26 } };
  const gridEl = document.getElementById('grid');
  const padEl = document.getElementById('pad');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let N, B, PEERS, cells;
  const row = i => Math.floor(i / N), col = i => i % N;
  const box = i => Math.floor(row(i) / B) * B + Math.floor(col(i) / B);

  function setSize(size) {
    if (size === N) return;
    N = size;
    B = Math.sqrt(N);
    PEERS = Array.from({ length: N * N }, (_, i) =>
      [...Array(N * N).keys()].filter(j => j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))));
    gridEl.classList.toggle('mini', N === 4);
    cells = Array.from({ length: N * N }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'cell';
      b.addEventListener('click', () => { sel = i; render(); });
      return b;
    });
    const boxes = Array.from({ length: N }, () => Object.assign(document.createElement('div'), { className: 'box' }));
    cells.forEach((b, i) => boxes[box(i)].append(b));
    gridEl.style.gridTemplateColumns = gridEl.style.gridTemplateRows = `repeat(${B}, 1fr)`;
    boxes.forEach(bx => { bx.style.gridTemplateColumns = bx.style.gridTemplateRows = `repeat(${B}, 1fr)`; });
    gridEl.replaceChildren(...boxes);
    padEl.style.gridTemplateColumns = `repeat(${N === 4 ? 5 : 5}, 1fr)`;
    padEl.innerHTML = [...Array(N).keys()].map(k => `<button class="key" data-d="${k + 1}">${k + 1}</button>`).join('')
      + '<button class="key erase" data-d="0" aria-label="Erase">⌫</button>';
  }

  // Bitmask of digits still possible at i.
  function options(g, i) {
    let used = 0;
    for (const j of PEERS[i]) used |= 1 << g[j];
    return ~used & (((1 << (N + 1)) - 1) & ~1);
  }

  // Count solutions up to limit, filling the most constrained square first.
  // With random=true it also leaves the first solution in g.
  function solve(g, limit, random = false) {
    let at = -1, mask = 0, fewest = N + 1;
    for (let i = 0; i < N * N; i++) {
      if (g[i]) continue;
      const m = options(g, i);
      let k = 0;
      for (let d = 1; d <= N; d++) if (m & (1 << d)) k++;
      if (k < fewest) { at = i; mask = m; fewest = k; if (!k) return 0; }
    }
    if (at < 0) return 1;
    const digits = [...Array(N).keys()].map(k => k + 1).filter(d => mask & (1 << d));
    if (random) MG.shuffle(digits);
    let found = 0;
    for (const d of digits) {
      g[at] = d;
      found += solve(g, limit - found, random);
      if (found >= limit) { if (random) return found; break; }
    }
    g[at] = 0;
    return found;
  }

  function generate(givens) {
    const solution = new Array(N * N).fill(0);
    solve(solution, 1, true);
    const puzzle = solution.slice();
    let filled = N * N;
    for (const i of MG.shuffle([...Array(N * N).keys()])) {
      if (filled <= givens) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (solve(puzzle.slice(), 2) === 1) filled--;
      else puzzle[i] = keep;
    }
    return { puzzle, solution };
  }

  let level = MG.kids ? 'mini' : MG.store.get('sudoku-level') || 'easy';
  let given, values, solution, sel, done;

  function newGame(l = level) {
    level = l;
    MG.store.set('sudoku-level', level);
    setSize(LEVELS[level].size);
    const p = generate(LEVELS[level].givens);
    given = p.puzzle.map(Boolean);
    values = p.puzzle.slice();
    solution = p.solution;
    sel = values.indexOf(0);
    done = false;
    clock.reset();
    ov.hide();
    const best = MG.store.get(`sudoku-best-${level}`);
    bestEl.textContent = best ? MG.fmt(+best) : '–';
    render();
  }

  function render() {
    const v = sel === null ? 0 : values[sel];
    const counts = Array(N + 1).fill(0);
    values.forEach(d => counts[d]++);
    cells.forEach((b, i) => {
      b.textContent = values[i] || '';
      b.className = 'cell'
        + (given[i] ? ' given' : '')
        + (i === sel ? ' sel' : '')
        + (sel !== null && i !== sel && PEERS[sel].includes(i) ? ' peer' : '')
        + (v && i !== sel && values[i] === v ? ' same' : '')
        + (values[i] && PEERS[i].some(j => values[j] === values[i]) ? ' clash' : '');
      b.setAttribute('aria-label', `Row ${row(i) + 1}, column ${col(i) + 1}, ${values[i] || 'empty'}`);
    });
    padEl.querySelectorAll('[data-d]').forEach(k => k.classList.toggle('full', +k.dataset.d > 0 && counts[k.dataset.d] >= N));
  }

  function enter(d) {
    if (done || sel === null || given[sel] || d > N) return;
    clock.start();
    values[sel] = d;
    render();
    if (values.every((x, i) => x === solution[i])) {
      done = true;
      const ms = clock.stop();
      const prev = +MG.store.get(`sudoku-best-${level}`);
      if (!prev || ms < prev) MG.store.set(`sudoku-best-${level}`, ms);
      bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
      ov.win('Solved', `${level[0].toUpperCase() + level.slice(1)} puzzle in ${MG.fmt(ms)}.${!prev || ms < prev ? ' A new best.' : ''}`,
        'New puzzle', () => newGame(), 600);
    }
  }

  padEl.addEventListener('click', e => { const k = e.target.closest('[data-d]'); if (k) enter(+k.dataset.d); });

  document.addEventListener('keydown', e => {
    if (/^[1-9]$/.test(e.key)) enter(+e.key);
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') enter(0);
    else if (e.key.startsWith('Arrow') && sel !== null) {
      e.preventDefault();
      const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      sel = ((row(sel) + dr + N) % N) * N + (col(sel) + dc + N) % N;
      render();
    }
  });

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('level'), level, v => newGame(v));
  newGame();
})();
