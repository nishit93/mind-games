(() => {
  const GIVENS = { easy: 40, medium: 32, hard: 26 };
  const gridEl = document.getElementById('grid');
  const padEl = document.getElementById('pad');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  const row = i => Math.floor(i / 9), col = i => i % 9;
  const box = i => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
  const PEERS = Array.from({ length: 81 }, (_, i) =>
    [...Array(81).keys()].filter(j => j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))));

  // Bitmask of digits 1–9 still possible at i.
  function options(g, i) {
    let used = 0;
    for (const j of PEERS[i]) used |= 1 << g[j];
    return ~used & 0x3FE;
  }

  // Count solutions up to limit, filling the most constrained square first.
  // With random=true it also leaves the first solution in g.
  function solve(g, limit, random = false) {
    let at = -1, mask = 0, fewest = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = options(g, i);
      let n = 0;
      for (let d = 1; d <= 9; d++) if (m & (1 << d)) n++;
      if (n < fewest) { at = i; mask = m; fewest = n; if (!n) return 0; }
    }
    if (at < 0) return 1;
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => mask & (1 << d));
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
    const solution = new Array(81).fill(0);
    solve(solution, 1, true);
    const puzzle = solution.slice();
    let filled = 81;
    for (const i of MG.shuffle([...Array(81).keys()])) {
      if (filled <= givens) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (solve(puzzle.slice(), 2) === 1) filled--;
      else puzzle[i] = keep;
    }
    return { puzzle, solution };
  }

  let level = MG.store.get('sudoku-level') || 'easy';
  let given, values, solution, sel, done;

  const cells = Array.from({ length: 81 }, (_, i) => {
    const b = document.createElement('button');
    b.className = 'cell';
    b.addEventListener('click', () => { sel = i; render(); });
    return b;
  });
  const boxes = Array.from({ length: 9 }, () => Object.assign(document.createElement('div'), { className: 'box' }));
  cells.forEach((b, i) => boxes[box(i)].append(b));
  gridEl.replaceChildren(...boxes);
  padEl.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button class="key" data-d="${d}">${d}</button>`).join('')
    + '<button class="key erase" data-d="0" aria-label="Erase">⌫</button>';

  function newGame(l = level) {
    level = l;
    MG.store.set('sudoku-level', level);
    const p = generate(GIVENS[level]);
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
    const counts = Array(10).fill(0);
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
    padEl.querySelectorAll('[data-d]').forEach(k => k.classList.toggle('full', +k.dataset.d > 0 && counts[k.dataset.d] >= 9));
  }

  function enter(d) {
    if (done || sel === null || given[sel]) return;
    clock.start();
    values[sel] = d;
    render();
    if (values.every((x, i) => x === solution[i])) {
      done = true;
      const ms = clock.stop();
      const prev = +MG.store.get(`sudoku-best-${level}`);
      if (!prev || ms < prev) MG.store.set(`sudoku-best-${level}`, ms);
      bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
      ov.show('Solved', `${level[0].toUpperCase() + level.slice(1)} puzzle in ${MG.fmt(ms)}.${!prev || ms < prev ? ' A new best.' : ''}`,
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
      sel = ((row(sel) + dr + 9) % 9) * 9 + (col(sel) + dc + 9) % 9;
      render();
    }
  });

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('level'), level, v => newGame(v));
  newGame();
})();
