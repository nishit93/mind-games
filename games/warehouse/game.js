(() => {
  // Levels made for this site by playing backwards from a solved position; fewest moves found with a solver.
  // # wall, . spot, $ crate, * crate on spot, @ you, + you on a spot.
  const LEVELS = [
    { rows: ['######', '# #  #', '#@.  #', '#  $ #', '#   ##', '######'], min: 8 },
    { rows: ['#######', '# #@  #', '#.$.# #', '# $ # #', '#     #', '#######'], min: 12 },
    { rows: ['#######', '#  #  #', '#     #', '# # #@#', '# #$*.#', '#     #', '#######'], min: 20 },
    { rows: ['########', '# *#+  #', '#  $   #', '# # #. #', '#    $ #', '# ##   #', '########'], min: 28 },
    { rows: ['########', '#  ..@ #', '#    ###', '#    $ #', '# #   .#', '# $ $  #', '###    #', '########'], min: 34 },
    { rows: ['########', '# #..$ #', '# #@$  #', '#  # # #', '#  $ # #', '# $.#  #', '#  .   #', '########'], min: 47 },
  ];
  const D = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const floorEl = document.getElementById('floor');
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('min');
  const bestEl = document.getElementById('best');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));

  let level = +MG.store.get('warehouse-level') || 0;
  let W, H, walls, goals, crates, me, moves, history, done, cells;

  function newGame(l = level) {
    level = l;
    MG.store.set('warehouse-level', level);
    const rows = LEVELS[level].rows;
    H = rows.length;
    W = Math.max(...rows.map(r => r.length));
    walls = new Set();
    goals = new Set();
    crates = new Set();
    rows.forEach((row, r) => [...row.padEnd(W, '#')].forEach((ch, c) => {
      const i = r * W + c;
      if (ch === '#') walls.add(i);
      if ('.*+'.includes(ch)) goals.add(i);
      if ('$*'.includes(ch)) crates.add(i);
      if ('@+'.includes(ch)) me = i;
    }));
    moves = 0;
    history = [];
    done = false;
    ov.hide();
    floorEl.style.gridTemplateColumns = `repeat(${W}, 1fr)`;
    cells = Array.from({ length: W * H }, (_, i) => {
      const d = document.createElement('div');
      d.addEventListener('click', () => walkTo(i));
      return d;
    });
    floorEl.replaceChildren(...cells);
    render();
  }

  function render() {
    cells.forEach((d, i) => {
      d.className = 'w' + (walls.has(i) ? ' wall' : '') + (goals.has(i) ? ' goal' : '');
      d.innerHTML = crates.has(i) ? `<div class="crate${goals.has(i) ? ' home' : ''}"></div>` : i === me ? '<div class="me"></div>' : '';
    });
    movesEl.textContent = moves;
    minEl.textContent = LEVELS[level].min;
    bestEl.textContent = MG.store.get(`warehouse-best-${level}`) || '–';
    undoBtn.disabled = !history.length || done;
  }

  function step(dir, redraw = true) {
    if (done) return false;
    const [dr, dc] = D[dir];
    const to = me + dr * W + dc;
    if (walls.has(to)) return false;
    const pushing = crates.has(to);
    const beyond = to + dr * W + dc;
    if (pushing && (walls.has(beyond) || crates.has(beyond))) return false;
    // History keeps the old crate set; a push works on a fresh copy.
    history.push({ me, crates });
    if (pushing) {
      crates = new Set(crates);
      crates.delete(to);
      crates.add(beyond);
    }
    me = to;
    moves++;
    if (redraw) render();
    if ([...crates].every(c => goals.has(c))) finish();
    return true;
  }

  // Tap a free square to walk there along the shortest path (no pushing).
  function walkTo(target) {
    if (done || walls.has(target) || crates.has(target) || target === me) return;
    const prev = new Map([[me, null]]), queue = [me];
    while (queue.length) {
      const i = queue.shift();
      if (i === target) break;
      for (const [dir, [dr, dc]] of Object.entries(D)) {
        const j = i + dr * W + dc;
        if (!prev.has(j) && !walls.has(j) && !crates.has(j)) { prev.set(j, [i, dir]); queue.push(j); }
      }
    }
    if (!prev.has(target)) return;
    const path = [];
    for (let k = target; prev.get(k); k = prev.get(k)[0]) path.unshift(prev.get(k)[1]);
    path.forEach(dir => step(dir, false));
    render();
  }

  function finish() {
    done = true;
    render();
    const { min } = LEVELS[level];
    const prev = +MG.store.get(`warehouse-best-${level}`);
    if (!prev || moves < prev) MG.store.set(`warehouse-best-${level}`, moves);
    bestEl.textContent = Math.min(moves, prev || moves);
    const last = level === LEVELS.length - 1;
    ov.show(moves === min ? 'Perfectly stacked' : 'All crates home',
      moves === min ? `${moves} moves, the fewest possible.` : `${moves} moves. The fewest possible is ${min}.`,
      last ? 'Play again' : 'Next level', () => { if (last) newGame(); else document.querySelector(`#level [data-value="${level + 1}"]`).click(); }, 600);
  }

  document.getElementById('dpad').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) step(b.dataset.d); });
  document.addEventListener('keydown', e => {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
    if (dir) { e.preventDefault(); step(dir); }
  });
  let start = null;
  floorEl.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
  floorEl.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  undoBtn.addEventListener('click', () => {
    if (!history.length || done) return;
    ({ me, crates } = history.pop());
    moves--;
    render();
  });
  document.getElementById('restart').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('level'), level, v => newGame(+v));
  newGame();
})();
