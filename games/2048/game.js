(() => {
  // Cloud Dancer → Peach Fuzz → Mocha Mousse → Very Peri as the tiles grow.
  const COLOURS = {
    2: ['#F6F1EA', '#4A3B33'], 4: ['#EFE2D4', '#4A3B33'], 8: ['#FFD5BA', '#4A3B33'], 16: ['#FFBE98', '#4A3B33'],
    32: ['#EEA27F', '#FFFFFF'], 64: ['#D58C6C', '#FFFFFF'], 128: ['#BC8569', '#FFFFFF'], 256: ['#A47864', '#FFFFFF'],
    512: ['#8E6654', '#FFFFFF'], 1024: ['#8586C4', '#FFFFFF'], 2048: ['#6667AB', '#FFFFFF'],
  };
  const gridEl = document.getElementById('grid');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let board, score, prev, won, over;
  const squares = Array.from({ length: 16 }, () => Object.assign(document.createElement('div'), { className: 'sq' }));
  gridEl.replaceChildren(...squares);

  function addTile() {
    const empty = board.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    const i = empty[Math.floor(Math.random() * empty.length)];
    board[i] = Math.random() < 0.9 ? 2 : 4;
    return i;
  }

  function newGame() {
    board = new Array(16).fill(0);
    score = 0;
    prev = null;
    won = over = false;
    ov.hide();
    const a = addTile(), b = addTile();
    render(new Set([a, b]));
  }

  function render(fresh = new Set(), merged = new Set()) {
    squares.forEach((el, i) => {
      const v = board[i];
      const [bg, fg] = COLOURS[v] || (v ? ['#4E4F8F', '#FFFFFF'] : []);
      el.textContent = v || '';
      el.style.background = bg || '';
      el.style.color = fg || '';
      el.className = 'sq' + (v >= 1024 ? ' huge' : v >= 128 ? ' big' : '') + (fresh.has(i) ? ' new' : '') + (merged.has(i) ? ' merged' : '');
    });
    scoreEl.textContent = score;
    const best = Math.max(score, +MG.store.get('2048-best') || 0);
    MG.store.set('2048-best', best);
    bestEl.textContent = best;
    undoBtn.disabled = !prev;
  }

  // Index lines for each direction, ordered from the side tiles slide towards.
  const LINES = {
    left: [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => r * 4 + c)),
    right: [0, 1, 2, 3].map(r => [3, 2, 1, 0].map(c => r * 4 + c)),
    up: [0, 1, 2, 3].map(c => [0, 1, 2, 3].map(r => r * 4 + c)),
    down: [0, 1, 2, 3].map(c => [3, 2, 1, 0].map(r => r * 4 + c)),
  };

  function slide(b, dir) {
    const next = b.slice(), merged = new Set();
    let gained = 0;
    for (const line of LINES[dir]) {
      const vals = line.map(i => b[i]).filter(Boolean);
      const out = [];
      for (let k = 0; k < vals.length; k++) {
        if (vals[k] === vals[k + 1]) {
          out.push(vals[k] * 2);
          gained += vals[k] * 2;
          merged.add(line[out.length - 1]);
          k++;
        } else out.push(vals[k]);
      }
      line.forEach((i, k) => { next[i] = out[k] || 0; });
    }
    const moved = next.some((v, i) => v !== b[i]);
    return { next, moved, gained, merged };
  }

  function move(dir) {
    if (over) return;
    const r = slide(board, dir);
    if (!r.moved) return;
    prev = { board: board.slice(), score, won };
    board = r.next;
    score += r.gained;
    const fresh = addTile();
    render(new Set([fresh]), r.merged);

    if (!won && board.includes(2048)) {
      won = true;
      ov.win('You made 2048', `Score ${score}. Keep going for a higher score?`, 'Keep going', null, 300);
    } else if (!['left', 'right', 'up', 'down'].some(d => slide(board, d).moved)) {
      over = true;
      ov.show('No moves left', `Final score ${score}.`, 'New game', newGame, 600);
    }
  }

  undoBtn.addEventListener('click', () => {
    if (!prev) return;
    ({ board, score, won } = prev);
    prev = null;
    over = false;
    ov.hide();
    render();
  });

  document.addEventListener('keydown', e => {
    const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' }[e.key];
    if (dir) { e.preventDefault(); move(dir); }
  });

  let start = null;
  gridEl.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
  gridEl.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  document.getElementById('new').addEventListener('click', newGame);
  newGame();
})();
