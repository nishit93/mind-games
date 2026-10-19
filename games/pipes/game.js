(() => {
  // Connection bits: 1 up, 2 right, 4 down, 8 left.
  const DIRS = [[1, -1, 0, 4], [2, 0, 1, 8], [4, 1, 0, 1], [8, 0, -1, 2]];
  const gridEl = document.getElementById('grid');
  const movesEl = document.getElementById('moves');
  const litEl = document.getElementById('lit');
  const bestEl = document.getElementById('best');
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = MG.kids ? 4 : +MG.store.get('pipes-n') || 6;
  let base, turns, source, moves, done, cells;

  const rot = (m, k) => { for (let s = 0; s < k % 4; s++) m = ((m << 1) | (m >> 3)) & 15; return m; };
  const mask = i => rot(base[i], turns[i]);

  // A random spanning tree grown outward from the source (randomised Prim).
  function generate() {
    base = new Array(n * n).fill(0);
    source = Math.floor(n / 2) * n + Math.floor(n / 2);
    const inTree = new Set([source]);
    const frontier = [];
    const addEdges = i => { const r = Math.floor(i / n), c = i % n; for (const [bit, dr, dc, back] of DIRS) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < n && cc >= 0 && cc < n) frontier.push([i, rr * n + cc, bit, back]); } };
    addEdges(source);
    while (inTree.size < n * n) {
      const [from, to, bit, back] = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0];
      if (inTree.has(to)) continue;
      base[from] |= bit;
      base[to] |= back;
      inTree.add(to);
      addEdges(to);
    }
  }

  function connected() {
    const seen = new Set([source]), stack = [source];
    while (stack.length) {
      const i = stack.pop(), m = mask(i), r = Math.floor(i / n), c = i % n;
      for (const [bit, dr, dc, back] of DIRS) {
        if (!(m & bit)) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const j = rr * n + cc;
        if (!seen.has(j) && mask(j) & back) { seen.add(j); stack.push(j); }
      }
    }
    return seen;
  }

  function solved() {
    for (let i = 0; i < n * n; i++) {
      const m = mask(i), r = Math.floor(i / n), c = i % n;
      for (const [bit, dr, dc, back] of DIRS) {
        if (!(m & bit)) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n || !(mask(rr * n + cc) & back)) return false;
      }
    }
    return connected().size === n * n;
  }

  const svg = m => {
    const deg = [1, 2, 4, 8].filter(b => m & b).length;
    const arms = [[1, 'M50 50V0'], [2, 'M50 50H100'], [4, 'M50 50V100'], [8, 'M50 50H0']].filter(([b]) => m & b).map(([, d]) => d).join('');
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${arms}" stroke="currentColor" stroke-width="18" stroke-linecap="round" fill="none"/>${deg === 1 ? '<circle cx="50" cy="50" r="17" fill="currentColor"/>' : ''}</svg>`;
  };

  function newGame(size = n) {
    n = size;
    MG.store.set('pipes-n', n);
    generate();
    do turns = base.map(() => Math.floor(Math.random() * 4)); while (solved());
    moves = 0;
    done = false;
    ov.hide();
    gridEl.classList.remove('solved');
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = base.map((m, i) => {
      const b = document.createElement('button');
      b.className = 'p' + (i === source ? ' source' : '');
      b.innerHTML = svg(m);
      b.querySelector('svg').style.transform = `rotate(${turns[i] * 90}deg)`;
      b.addEventListener('click', () => tap(i));
      return b;
    });
    gridEl.replaceChildren(...cells);
    bestEl.textContent = MG.store.get(`pipes-best-${n}`) || '–';
    render();
  }

  function render() {
    const lit = connected();
    cells.forEach((b, i) => {
      b.classList.toggle('lit', lit.has(i));
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}${i === source ? ', source' : ''}${lit.has(i) ? ', connected' : ''}`);
    });
    movesEl.textContent = moves;
    litEl.textContent = `${lit.size}/${n * n}`;
  }

  function tap(i) {
    if (done) return;
    turns[i]++;
    moves++;
    cells[i].querySelector('svg').style.transform = `rotate(${turns[i] * 90}deg)`;
    render();
    if (solved()) {
      done = true;
      gridEl.classList.add('solved');
      const prev = +MG.store.get(`pipes-best-${n}`);
      if (!prev || moves < prev) MG.store.set(`pipes-best-${n}`, moves);
      bestEl.textContent = Math.min(moves, prev || moves);
      ov.show('All connected', `The whole network flows, in ${moves} turns.`, 'New network', () => newGame(), 700);
    }
  }

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
