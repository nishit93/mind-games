(() => {
  const W = 4, H = 5;
  // A is the general (2×2); the exit is under columns 2–3. Fewest moves checked with a solver.
  const LEVELS = [
    { rows: ['bAAc', 'bAAc', '....', 'deef', 'dghf'], min: 19 },
    { rows: ['gAAh', 'bAAc', 'bdec', 'fdei', 'j..k'], min: 39 },
    { rows: ['bAAc', 'bAAc', 'ghij', 'k..l', 'eeff'], min: 52 },
    { rows: ['bAAc', 'bAAc', 'eeff', 'gh..', 'ijkl'], min: 60 },
    { rows: ['bAAc', 'bAAc', 'deef', 'dghf', 'i..j'], min: 90 },
  ];
  const tray = document.getElementById('tray');
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('min');
  const bestEl = document.getElementById('best');
  const ov = MG.overlay(document.querySelector('.stage'));

  let level = MG.kids ? 0 : +MG.store.get('huarong-level') || 0;
  let pieces, moves, done;

  function parse(rows) {
    const cells = {};
    [...rows.join('')].forEach((ch, i) => { if (ch !== '.') (cells[ch] ||= []).push(i); });
    return Object.entries(cells).map(([id, list]) => {
      const rs = list.map(i => Math.floor(i / W)), cs = list.map(i => i % W);
      const r = Math.min(...rs), c = Math.min(...cs);
      return { id, r, c, h: Math.max(...rs) - r + 1, w: Math.max(...cs) - c + 1 };
    });
  }

  // How far piece p can slide in a direction (0 if blocked).
  function room(p, dr, dc) {
    let s = 0;
    for (;;) {
      const r = p.r + dr * (s + 1), c = p.c + dc * (s + 1);
      if (r < 0 || c < 0 || r + p.h > H || c + p.w > W) return s;
      const hit = pieces.some(q => q !== p && r < q.r + q.h && q.r < r + p.h && c < q.c + q.w && q.c < c + p.w);
      if (hit) return s;
      s++;
    }
  }

  function newGame(l = level) {
    level = l;
    MG.store.set('huarong-level', level);
    pieces = parse(LEVELS[level].rows);
    moves = 0;
    done = false;
    ov.hide();
    tray.replaceChildren(...pieces.map(p => {
      const b = document.createElement('button');
      b.className = 'piece' + (p.id === 'A' ? ' general' : p.h * p.w === 1 ? ' small' : '');
      b.textContent = p.id === 'A' ? 'General' : '';
      b.setAttribute('aria-label', p.id === 'A' ? 'General, the big block' : `${p.h * p.w === 1 ? 'Small' : p.h > p.w ? 'Tall' : 'Wide'} block`);
      p.el = b;
      attach(p);
      return b;
    }));
    render();
  }

  function render() {
    const GAP = 3;
    for (const p of pieces) {
      Object.assign(p.el.style, {
        left: `calc(${(p.c / W) * 100}% + ${GAP}px)`,
        top: `calc(${(p.r / H) * 100}% + ${GAP}px)`,
        width: `calc(${(p.w / W) * 100}% - ${GAP * 2}px)`,
        height: `calc(${(p.h / H) * 100}% - ${GAP * 2}px)`,
      });
    }
    movesEl.textContent = moves;
    minEl.textContent = LEVELS[level].min;
    bestEl.textContent = MG.store.get(`huarong-best-${level}`) || '–';
  }

  function slide(p, dr, dc, steps) {
    const s = Math.min(steps, room(p, dr, dc));
    if (!s || done) return;
    p.r += dr * s;
    p.c += dc * s;
    moves++;
    render();
    const a = pieces.find(q => q.id === 'A');
    if (a.r === 3 && a.c === 1) finish();
  }

  function finish() {
    done = true;
    const { min } = LEVELS[level];
    const prev = +MG.store.get(`huarong-best-${level}`);
    if (!prev || moves < prev) MG.store.set(`huarong-best-${level}`, moves);
    render();
    const last = level === LEVELS.length - 1;
    ov.show(moves === min ? 'Perfect escape' : 'The general is free',
      moves === min ? `${moves} moves, the fewest possible.` : `${moves} moves. The fewest possible is ${min}.`,
      last ? 'Play again' : 'Next level', () => { if (!last) document.querySelector(`#level [data-value="${level + 1}"]`).click(); else newGame(); }, 600);
  }

  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function attach(p) {
    let start = null;
    p.el.addEventListener('pointerdown', e => {
      start = { x: e.clientX, y: e.clientY };
      p.el.setPointerCapture?.(e.pointerId);
    });
    p.el.addEventListener('pointerup', e => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist < 10) {
        // A tap moves the block one step if it can only go one way.
        const open = DIRS.filter(([dr, dc]) => room(p, dr, dc));
        if (open.length === 1) slide(p, ...open[0], 1);
        return;
      }
      const cell = tray.clientWidth / W;
      const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
      slide(p, dr, dc, Math.max(1, Math.round(dist / cell)));
    });
    p.el.addEventListener('pointercancel', () => { start = null; });
    // Keyboard: focus a block and use the arrow keys.
    p.el.addEventListener('keydown', e => {
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (d) { e.preventDefault(); slide(p, ...d, 1); }
    });
  }

  document.getElementById('restart').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('level'), level, v => newGame(+v));
  newGame();
})();
