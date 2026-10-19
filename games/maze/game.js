(() => {
  const mazeEl = document.getElementById('maze');
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('min');
  const bestEl = document.getElementById('best');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  // Walls of a cell are bits: 1 up, 2 right, 4 down, 8 left (a set bit is a wall).
  const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
  const DIRS = { up: [-1, 0, UP, DOWN], right: [0, 1, RIGHT, LEFT], down: [1, 0, DOWN, UP], left: [0, -1, LEFT, RIGHT] };

  let n = MG.kids ? 7 : +MG.store.get('maze-n') || 10;
  let walls, cells, pos, moves, shortest, seen, done;

  // A "perfect" maze: carve passages with a depth-first walk, so there is exactly one route between any two squares.
  function build() {
    walls = new Array(n * n).fill(15);
    const visited = new Array(n * n).fill(false);
    const stack = [0];
    visited[0] = true;
    while (stack.length) {
      const cur = stack[stack.length - 1], r = Math.floor(cur / n), c = cur % n;
      const options = MG.shuffle(Object.values(DIRS)).filter(([dr, dc]) => {
        const rr = r + dr, cc = c + dc;
        return rr >= 0 && rr < n && cc >= 0 && cc < n && !visited[rr * n + cc];
      });
      if (!options.length) { stack.pop(); continue; }
      const [dr, dc, bit, opposite] = options[0];
      const next = (r + dr) * n + (c + dc);
      walls[cur] &= ~bit;
      walls[next] &= ~opposite;
      visited[next] = true;
      stack.push(next);
    }
  }

  function fewest() {
    const dist = new Array(n * n).fill(-1);
    dist[0] = 0;
    const queue = [0];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i], r = Math.floor(cur / n), c = cur % n;
      for (const [dr, dc, bit] of Object.values(DIRS)) {
        if (walls[cur] & bit) continue;
        const next = (r + dr) * n + (c + dc);
        if (dist[next] < 0) { dist[next] = dist[cur] + 1; queue.push(next); }
      }
    }
    return dist[n * n - 1];
  }

  function newMaze(size = n) {
    n = size;
    MG.store.set('maze-n', n);
    build();
    shortest = fewest();
    pos = 0;
    moves = 0;
    done = false;
    seen = new Set([0]);
    ov.hide();
    mazeEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = walls.map((w, i) => {
      const d = document.createElement('div');
      d.className = 'mc' + (w & UP ? ' u' : '') + (w & RIGHT ? ' r' : '') + (w & DOWN ? ' d' : '') + (w & LEFT ? ' l' : '');
      d.addEventListener('click', () => tapCell(i));
      return d;
    });
    cells[n * n - 1].classList.add('exit');
    mazeEl.replaceChildren(...cells);
    minEl.textContent = shortest;
    bestEl.textContent = MG.store.get(`maze-best-${n}`) || '–';
    render();
  }

  function render() {
    cells.forEach((d, i) => {
      d.classList.toggle('seen', seen.has(i));
      d.classList.toggle('me', i === pos);
    });
    movesEl.textContent = moves;
  }

  function open(i, dir) {
    const [dr, dc, bit] = DIRS[dir];
    const r = Math.floor(i / n), c = i % n;
    if (walls[i] & bit) return -1;
    const rr = r + dr, cc = c + dc;
    return rr >= 0 && rr < n && cc >= 0 && cc < n ? rr * n + cc : -1;
  }

  function step(dir) {
    if (done) return false;
    const next = open(pos, dir);
    if (next < 0) { mazeEl.classList.remove('bump'); void mazeEl.offsetWidth; mazeEl.classList.add('bump'); return false; }
    pos = next;
    moves++;
    seen.add(pos);
    render();
    if (pos === n * n - 1) finish();
    return true;
  }

  // Run along a corridor until the way forks or ends.
  function run(dir) {
    let cur = dir, guard = n * n;
    while (guard-- > 0 && step(cur)) {
      if (done) return;
      const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[cur];
      const exits = Object.keys(DIRS).filter(d => d !== back && open(pos, d) >= 0);
      if (exits.length !== 1) return;
      cur = exits[0];
    }
  }

  function tapCell(i) {
    const r = Math.floor(pos / n), c = pos % n, rr = Math.floor(i / n), cc = i % n;
    const dir = rr === r - 1 && cc === c ? 'up' : rr === r + 1 && cc === c ? 'down' : rr === r && cc === c - 1 ? 'left' : rr === r && cc === c + 1 ? 'right' : null;
    if (dir) step(dir);
  }

  function finish() {
    done = true;
    const prev = +MG.store.get(`maze-best-${n}`);
    const isBest = !prev || moves < prev;
    if (isBest) MG.store.set(`maze-best-${n}`, moves);
    bestEl.textContent = MG.store.get(`maze-best-${n}`);
    ov.win(moves === shortest ? 'Straight through' : 'Out of the maze',
      moves === shortest ? `${moves} steps, the fewest possible.` : `${moves} steps. The fewest possible is ${shortest}.${isBest ? ' A new best.' : ''}`,
      'New maze', () => newMaze(), 600);
  }

  // Swipe on the maze to run, tap a square next to you to step, or use the arrow keys or buttons.
  let start = null;
  mazeEl.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
  mazeEl.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    run(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  mazeEl.addEventListener('pointercancel', () => { start = null; });
  document.addEventListener('keydown', e => {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
    if (!dir || (e.target.closest && e.target.closest('input, textarea'))) return;
    e.preventDefault();
    step(dir);
  });
  document.getElementById('dpad').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) step(b.dataset.d);
  });

  document.getElementById('new').addEventListener('click', () => newMaze());
  MG.seg(document.getElementById('size'), n, v => newMaze(+v));
  newMaze();
})();
