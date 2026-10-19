(() => {
  const SHAPES = {
    F: ['.##', '##.', '.#.'], I: ['#####'], L: ['#...', '####'], N: ['##..', '.###'], P: ['##', '##', '#.'], T: ['###', '.#.', '.#.'],
    U: ['#.#', '###'], V: ['#..', '#..', '###'], W: ['#..', '##.', '.##'], X: ['.#.', '###', '.#.'], Y: ['.#..', '####'], Z: ['##.', '.#.', '.##'],
  };
  const COLOURS = {
    F: '#A47864', I: '#6667AB', L: '#D9905F', N: '#88B04B', P: '#92A8D1', T: '#C98B7B',
    U: '#8E6654', V: '#B5A3D8', W: '#E8B98F', X: '#7BA58F', Y: '#D4A15C', Z: '#8586C4',
  };
  // Piece sets checked with a solver to fill each box exactly.
  const LEVELS = [
    { w: 5, h: 3, set: 'LNV' }, { w: 5, h: 4, set: 'FIPU' }, { w: 5, h: 5, set: 'LNPTW' },
    { w: 5, h: 6, set: 'FILPUX' }, { w: 5, h: 8, set: 'FIPTUVYZ' }, { w: 6, h: 10, set: 'FILNPTUVWXYZ' },
  ];
  const boxEl = document.getElementById('box');
  const trayEl = document.getElementById('tray');
  const heldEl = document.getElementById('held');
  const status = document.getElementById('status');
  const placedEl = document.getElementById('placed');
  const totalEl = document.getElementById('total');
  const solvedEl = document.getElementById('solved');
  const ov = MG.overlay(document.querySelector('.stage'));

  let level = +MG.store.get('pento-level') || 0;
  let solved = +MG.store.get('pento-solved') || 0;
  let W, H, pieces, board, held, done, cells;

  const cellsOf = rows => rows.flatMap((row, r) => [...row].map((ch, c) => (ch === '#' ? [r, c] : null)).filter(Boolean));
  const norm = cs => {
    const mr = Math.min(...cs.map(p => p[0])), mc = Math.min(...cs.map(p => p[1]));
    return cs.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  };
  const rotate = cs => norm(cs.map(([r, c]) => [c, -r]));
  const flip = cs => norm(cs.map(([r, c]) => [r, -c]));

  const miniGrid = cs => {
    const h = Math.max(...cs.map(p => p[0])) + 1, w = Math.max(...cs.map(p => p[1])) + 1;
    const on = new Set(cs.map(([r, c]) => `${r},${c}`));
    let html = `<div class="mini-grid" style="grid-template-columns: repeat(${w}, auto)">`;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) html += `<i style="background:${on.has(`${r},${c}`) ? 'currentColor' : 'transparent'}"></i>`;
    return `${html}</div>`;
  };

  function newGame(l = level) {
    level = l;
    MG.store.set('pento-level', level);
    ({ w: W, h: H } = LEVELS[level]);
    pieces = [...LEVELS[level].set].map(id => ({ id, shape: norm(cellsOf(SHAPES[id])), at: null }));
    board = new Array(W * H).fill(null);
    held = null;
    done = false;
    ov.hide();
    boxEl.style.gridTemplateColumns = `repeat(${W}, 1fr)`;
    boxEl.style.maxWidth = `${Math.min(330, W * 56)}px`;
    cells = board.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'bc';
      b.addEventListener('click', () => tapBox(i));
      return b;
    });
    boxEl.replaceChildren(...cells);
    totalEl.textContent = pieces.length;
    status.textContent = 'Tap a piece below to pick it up.';
    render();
  }

  function render() {
    cells.forEach((b, i) => {
      const id = board[i];
      b.style.background = id ? COLOURS[id] : '';
      b.setAttribute('aria-label', `Row ${Math.floor(i / W) + 1}, column ${i % W + 1}, ${id ? `piece ${id}` : 'empty'}`);
    });
    trayEl.innerHTML = pieces.map(p => `<button class="piece-btn${p === held ? ' sel' : ''}${p.at !== null ? ' placed' : ''}" data-id="${p.id}" style="color:${COLOURS[p.id]}" aria-label="Piece ${p.id}${p.at !== null ? ', placed' : ''}">${miniGrid(norm(cellsOf(SHAPES[p.id])))}</button>`).join('');
    heldEl.innerHTML = held ? `<span style="color:${COLOURS[held.id]}">${miniGrid(held.shape)}</span>` : '<span class="cap" style="color:var(--muted)">No piece in hand</span>';
    document.getElementById('rotate').disabled = document.getElementById('flip').disabled = !held;
    placedEl.textContent = pieces.filter(p => p.at !== null).length;
    solvedEl.textContent = solved;
  }

  function lift(p) {
    for (let i = 0; i < board.length; i++) if (board[i] === p.id) board[i] = null;
    p.at = null;
  }

  function tapBox(i) {
    if (done) return;
    if (board[i] && !held) {
      held = pieces.find(p => p.id === board[i]);
      lift(held);
      status.textContent = 'Picked up. Turn or flip it, then tap where it should go.';
      render();
      return;
    }
    if (!held) { status.textContent = 'Pick a piece from the tray first.'; return; }
    const r0 = Math.floor(i / W), c0 = i % W;
    // Try each square of the piece on the tapped square, first fit wins.
    for (const [ar, ac] of held.shape) {
      const pos = held.shape.map(([r, c]) => [r - ar + r0, c - ac + c0]);
      if (pos.every(([r, c]) => r >= 0 && r < H && c >= 0 && c < W && !board[r * W + c])) {
        pos.forEach(([r, c]) => { board[r * W + c] = held.id; });
        held.at = i;
        held = null;
        render();
        const left = pieces.filter(p => p.at === null).length;
        status.textContent = left ? `${left} piece${left === 1 ? '' : 's'} to go.` : '';
        if (!left) finish();
        return;
      }
    }
    cells[i].classList.remove('shake'); void cells[i].offsetWidth; cells[i].classList.add('shake');
    status.textContent = 'It doesn’t fit there. Try turning or flipping it.';
  }

  function finish() {
    done = true;
    solved++;
    MG.store.set('pento-solved', solved);
    render();
    const last = level === LEVELS.length - 1;
    ov.show('Perfect fit', `All ${pieces.length} pieces fill the ${W}×${H} box.`, last ? 'Play again' : 'Bigger box',
      () => { if (last) newGame(); else document.querySelector(`#level [data-value="${level + 1}"]`).click(); }, 600);
  }

  trayEl.addEventListener('click', e => {
    const b = e.target.closest('.piece-btn');
    if (!b || done) return;
    const p = pieces.find(x => x.id === b.dataset.id);
    if (p.at !== null) lift(p);
    held = held === p ? null : p;
    status.textContent = held ? 'Turn or flip it, then tap where it should go.' : 'Tap a piece below to pick it up.';
    render();
  });
  document.getElementById('rotate').addEventListener('click', () => { if (held) { held.shape = rotate(held.shape); render(); } });
  document.getElementById('flip').addEventListener('click', () => { if (held) { held.shape = flip(held.shape); render(); } });
  document.getElementById('clear').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('level'), level, v => newGame(+v));
  newGame();
})();
