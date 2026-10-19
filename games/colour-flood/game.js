(() => {
  // Mocha Mousse, Peach Fuzz, Very Peri, Greenery, Serenity, Illuminating.
  const COLOURS = ['#A47864', '#FFBE98', '#6667AB', '#88B04B', '#92A8D1', '#F5DF4D'];
  const NAMES = ['brown', 'peach', 'violet', 'green', 'blue', 'yellow'];
  const KINDS = { 8: 4, 12: 5, 16: 6 };
  const gridEl = document.getElementById('grid');
  const swEl = document.getElementById('swatches');
  const movesEl = document.getElementById('moves');
  const parEl = document.getElementById('par');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let n = MG.kids ? 8 : +MG.store.get('flood-n') || 12;
  let board, moves, par, done, cells;

  const nb = i => { const r = Math.floor(i / n), c = i % n; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && a < n && b >= 0 && b < n).map(([a, b]) => a * n + b); };

  function region(b) {
    const col = b[0], seen = new Set([0]), stack = [0];
    while (stack.length) for (const j of nb(stack.pop())) if (!seen.has(j) && b[j] === col) { seen.add(j); stack.push(j); }
    return seen;
  }
  function flood(b, colour) {
    const next = b.slice();
    for (const i of region(b)) next[i] = colour;
    return next;
  }

  // Par: the best of several greedy runs (each step picks the colour that grows the area most).
  function computePar(start) {
    let best = Infinity;
    for (let run = 0; run < 6; run++) {
      let b = start.slice(), m = 0;
      while (new Set(b).size > 1 && m < 200) {
        const options = [...Array(KINDS[n]).keys()].filter(c => c !== b[0]).map(c => ({ c, size: region(flood(b, c)).size + Math.random() * (run ? 0.9 : 0) }));
        options.sort((x, y) => y.size - x.size);
        b = flood(b, options[0].c);
        m++;
      }
      best = Math.min(best, m);
    }
    return best;
  }

  function newGame(size = n) {
    n = size;
    MG.store.set('flood-n', n);
    board = Array.from({ length: n * n }, () => Math.floor(Math.random() * KINDS[n]));
    par = computePar(board);
    moves = 0;
    done = false;
    ov.hide();
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = board.map(() => Object.assign(document.createElement('div'), { className: 'fc' }));
    gridEl.replaceChildren(...cells);
    swEl.innerHTML = [...Array(KINDS[n]).keys()].map(c => `<button class="sw" data-c="${c}" style="background:${COLOURS[c]}" aria-label="Flood with ${NAMES[c]}"></button>`).join('');
    status.textContent = 'Tap a colour to grow your area from the top-left corner.';
    bestEl.textContent = MG.store.get(`flood-best-${n}`) || '–';
    render();
  }

  function render() {
    const home = region(board);
    cells.forEach((el, i) => { el.style.background = COLOURS[board[i]]; el.classList.toggle('home', home.has(i)); });
    swEl.querySelectorAll('.sw').forEach(b => { b.disabled = done || +b.dataset.c === board[0]; });
    movesEl.textContent = moves;
    parEl.textContent = par;
  }

  swEl.addEventListener('click', e => {
    const b = e.target.closest('.sw');
    if (!b || done || +b.dataset.c === board[0]) return;
    board = flood(board, +b.dataset.c);
    moves++;
    const size = region(board).size;
    status.textContent = `Your area covers ${Math.round((100 * size) / (n * n))}% of the board.`;
    render();
    if (size === n * n) {
      done = true;
      render();
      const prev = +MG.store.get(`flood-best-${n}`);
      if (!prev || moves < prev) MG.store.set(`flood-best-${n}`, moves);
      bestEl.textContent = Math.min(moves, prev || moves);
      const verdict = moves < par ? `${par - moves} under par. Wonderful.` : moves === par ? 'Right on par.' : `${moves - par} over par. Try again for par?`;
      ov.win(moves <= par ? 'Flooded' : 'All one colour', `${moves} moves. ${verdict}`, 'New board', () => newGame(), 600);
    }
  });

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
