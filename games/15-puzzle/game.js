(() => {
  const PAD = 8, GAP = 6;
  const board = document.getElementById('board');
  const winEl = document.getElementById('win');
  const movesEl = document.getElementById('moves');
  const timeEl = document.getElementById('time');
  const bestEl = document.getElementById('best');
  const sizeBtns = document.querySelectorAll('[data-size]');

  let n = 4;
  let cells = [];       // cells[pos] = tile number, 0 = gap
  let tiles = new Map(); // tile number -> element
  let moves = 0, startedAt = 0, timer = 0, solved = false;

  const store = MG.store;

  const fmt = ms => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function neighbours(pos) {
    const r = Math.floor(pos / n), c = pos % n, out = [];
    if (r > 0) out.push(pos - n);
    if (r < n - 1) out.push(pos + n);
    if (c > 0) out.push(pos - 1);
    if (c < n - 1) out.push(pos + 1);
    return out;
  }

  // Shuffle by walking the gap randomly, so every board is solvable.
  function shuffle() {
    cells = Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
    let gap = n * n - 1, prev = -1;
    const steps = n * n * 25;
    for (let i = 0; i < steps || isSolved(); i++) {
      const opts = neighbours(gap).filter(p => p !== prev);
      const next = opts[Math.floor(Math.random() * opts.length)];
      [cells[gap], cells[next]] = [cells[next], cells[gap]];
      prev = gap;
      gap = next;
    }
  }

  const isSolved = () => cells.every((v, i) => v === (i + 1) % (n * n));

  function build() {
    board.querySelectorAll('.tile').forEach(t => t.remove());
    tiles.clear();
    for (let v = 1; v < n * n; v++) {
      const t = document.createElement('button');
      t.className = 'tile';
      t.textContent = v;
      t.setAttribute('aria-label', `Tile ${v}`);
      t.addEventListener('pointerdown', e => { e.preventDefault(); tap(cells.indexOf(v)); });
      t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') tap(cells.indexOf(v)); });
      board.insertBefore(t, winEl);
      tiles.set(v, t);
    }
    // Place new tiles without animating them in from the corner.
    board.classList.add('instant');
    layout();
    board.offsetWidth;
    board.classList.remove('instant');
  }

  function layout() {
    const inner = board.clientWidth - PAD * 2;
    const size = (inner - GAP * (n - 1)) / n;
    cells.forEach((v, pos) => {
      if (!v) return;
      const t = tiles.get(v);
      const x = PAD + (pos % n) * (size + GAP);
      const y = PAD + Math.floor(pos / n) * (size + GAP);
      t.style.width = t.style.height = `${size}px`;
      t.style.fontSize = `${size * 0.36}px`;
      t.style.transform = `translate(${x}px, ${y}px)`;
      t.classList.toggle('home', v === pos + 1);
    });
  }

  // Tapping any tile in the gap's row or column slides the whole run.
  function tap(pos) {
    if (solved || pos < 0) return;
    const gap = cells.indexOf(0);
    const [pr, pc, gr, gc] = [Math.floor(pos / n), pos % n, Math.floor(gap / n), gap % n];
    let step;
    if (pr === gr && pc !== gc) step = pc < gc ? -1 : 1;
    else if (pc === gc && pr !== gr) step = pr < gr ? -n : n;
    else return;

    let g = gap;
    while (g !== pos) {
      const next = g + step;
      [cells[g], cells[next]] = [cells[next], cells[g]];
      g = next;
      moves++;
    }
    if (!startedAt) {
      startedAt = Date.now();
      timer = setInterval(tick, 250);
    }
    movesEl.textContent = moves;
    layout();
    if (isSolved()) finish();
  }

  function tick() { timeEl.textContent = fmt(Date.now() - startedAt); }

  function finish() {
    solved = true;
    clearInterval(timer);
    const ms = Date.now() - startedAt;
    tick();
    const key = `fifteen-best-${n}`;
    const prev = JSON.parse(store.get(key) || 'null');
    const isBest = !prev || moves < prev.moves || (moves === prev.moves && ms < prev.ms);
    if (isBest) store.set(key, JSON.stringify({ moves, ms }));
    document.getElementById('win-text').textContent =
      `${moves} moves in ${fmt(ms)}${isBest ? ' · a new best' : ''}`;
    showBest();
    setTimeout(() => winEl.classList.add('show'), 500);
  }

  function showBest() {
    const b = JSON.parse(store.get(`fifteen-best-${n}`) || 'null');
    bestEl.textContent = b ? `${b.moves} · ${fmt(b.ms)}` : '–';
  }

  function newGame(size = n) {
    n = size;
    store.set('fifteen-size', n);
    sizeBtns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.size === n)));
    clearInterval(timer);
    moves = 0; startedAt = 0; solved = false;
    movesEl.textContent = '0';
    timeEl.textContent = '0:00';
    winEl.classList.remove('show');
    shuffle();
    build();
    showBest();
  }

  document.addEventListener('keydown', e => {
    const gap = cells.indexOf(0), r = Math.floor(gap / n), c = gap % n;
    const map = {
      ArrowLeft: c < n - 1 ? gap + 1 : -1,
      ArrowRight: c > 0 ? gap - 1 : -1,
      ArrowUp: r < n - 1 ? gap + n : -1,
      ArrowDown: r > 0 ? gap - n : -1,
    };
    if (e.key in map) { e.preventDefault(); tap(map[e.key]); }
  });

  sizeBtns.forEach(b => b.addEventListener('click', () => newGame(+b.dataset.size)));
  document.getElementById('shuffle').addEventListener('click', () => newGame());
  document.getElementById('again').addEventListener('click', () => newGame());
  new ResizeObserver(layout).observe(board);

  newGame(MG.kids ? 3 : +store.get('fifteen-size') || 4);
})();
