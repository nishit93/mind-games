(() => {
  const stage = document.getElementById('os');
  const svg = document.getElementById('lines');
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('min');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  // Shapes to trace without lifting the pen. Points are [x, y] in a 0–100 square; edges join two points by number.
  // Every shape has a route that uses each line exactly once (the page's test checks this): either every point has an even
  // number of lines (start anywhere, finish where you began) or exactly two points have an odd number (start at one, end at the other).
  const penta = (cx, cy, r, k) => Array.from({ length: k }, (_, i) => [Math.round(cx + r * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / k)), Math.round(cy + r * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / k))]);
  const lattice = (rows, cols) => {
    const pts = [], edges = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pts.push([Math.round(14 + (72 * c) / (cols - 1)), Math.round(18 + (64 * r) / (rows - 1))]);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (c < cols - 1) edges.push([r * cols + c, r * cols + c + 1]);
      if (r < rows - 1) edges.push([r * cols + c, (r + 1) * cols + c]);
    }
    return { pts, edges };
  };
  const star = penta(50, 54, 40, 5);
  const starEdges = [...Array(5).keys()].flatMap(i => [[i, (i + 1) % 5], [i, (i + 2) % 5]]);
  const hexPts = penta(50, 52, 40, 6);
  const allPairs = [];
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) if (!((a === 0 && b === 1) || (a === 2 && b === 3))) allPairs.push([a, b]);
  const l3 = lattice(3, 3), l5 = lattice(3, 4);
  const SHAPES = [
    { name: 'Envelope', pts: [[12, 88], [88, 88], [12, 46], [88, 46], [50, 10]], edges: [[0, 1], [0, 2], [1, 3], [2, 3], [0, 3], [1, 2], [2, 4], [3, 4]] },
    { name: 'Star', pts: star, edges: starEdges },
    { name: 'Almost a star', pts: star, edges: starEdges.filter(([a, b]) => !(a === 0 && b === 2) && !(a === 2 && b === 0)) },
    { name: 'Windows', pts: l3.pts, edges: [...l3.edges, [1, 3]] },
    { name: 'Hexagon', pts: hexPts, edges: allPairs },
    { name: 'Garden', pts: l5.pts, edges: [...l5.edges, [1, 4], [7, 10]] },
  ];
  window.__oneStrokeShapes = SHAPES; // for the site test

  let level = MG.kids ? 0 : Math.min(Math.max(+MG.store.get('stroke-level') || 0, 0), SHAPES.length - 1);
  let L, used, trail, moves, nodes, lines, done;

  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const adj = p => L.edges.filter(([a, b]) => (a === p || b === p) && !used.has(key(a, b))).map(([a, b]) => (a === p ? b : a));

  function newGame(lv = level) {
    level = lv;
    MG.store.set('stroke-level', level);
    L = SHAPES[level];
    used = new Set();
    trail = [];
    moves = 0;
    done = false;
    ov.hide();
    svg.replaceChildren();
    lines = L.edges.map(([a, b]) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', L.pts[a][0]); el.setAttribute('y1', L.pts[a][1]);
      el.setAttribute('x2', L.pts[b][0]); el.setAttribute('y2', L.pts[b][1]);
      svg.append(el);
      return el;
    });
    stage.querySelectorAll('.nd').forEach(n => n.remove());
    nodes = L.pts.map(([x, y], i) => {
      const b = document.createElement('button');
      b.className = 'nd';
      b.style.left = `${x}%`;
      b.style.top = `${y}%`;
      b.setAttribute('aria-label', `Point ${i + 1}`);
      b.addEventListener('click', () => tap(i));
      stage.append(b);
      return b;
    });
    minEl.textContent = L.edges.length;
    bestEl.textContent = MG.store.get(`stroke-best-${level}`) || '–';
    status.textContent = 'Tap any point to start.';
    render();
  }

  function render() {
    const cur = trail.length ? trail[trail.length - 1] : -1;
    const next = cur >= 0 ? new Set(adj(cur)) : new Set();
    L.edges.forEach(([a, b], i) => lines[i].classList.toggle('used', used.has(key(a, b))));
    nodes.forEach((n, i) => {
      n.classList.toggle('cur', i === cur);
      n.classList.toggle('next', next.has(i));
      n.classList.toggle('start', trail.length > 0 && i === trail[0]);
    });
    movesEl.textContent = moves;
    undoBtn.disabled = trail.length < 2;
  }

  function tap(i) {
    if (done) return;
    const cur = trail.length ? trail[trail.length - 1] : -1;
    if (cur < 0) { trail = [i]; status.textContent = 'Now tap a glowing point to draw a line to it.'; render(); return; }
    if (i === cur && trail.length === 1) { trail = []; status.textContent = 'Tap any point to start.'; render(); return; }
    if (adj(cur).includes(i)) {
      used.add(key(cur, i));
      trail.push(i);
      moves++;
      if (used.size === L.edges.length) { render(); finish(); return; }
      status.textContent = adj(i).length ? '' : 'Stuck: no line is left from here. Undo a step and try another way.';
      render();
      return;
    }
    if (trail.length > 1 && i === trail[trail.length - 2]) undo();
  }

  function undo() {
    if (done || trail.length < 2) return;
    const last = trail.pop();
    used.delete(key(trail[trail.length - 1], last));
    status.textContent = '';
    render();
  }

  function finish() {
    done = true;
    const prev = +MG.store.get(`stroke-best-${level}`);
    const isBest = !prev || moves < prev;
    if (isBest) MG.store.set(`stroke-best-${level}`, moves);
    bestEl.textContent = MG.store.get(`stroke-best-${level}`);
    status.textContent = '';
    const last = level === SHAPES.length - 1;
    ov.win(moves === L.edges.length ? 'One clean stroke' : 'Every line drawn',
      moves === L.edges.length ? `${moves} lines, with no wrong turns.` : `${moves} lines drawn, ${L.edges.length} needed.${isBest ? ' A new best.' : ''}`,
      last ? 'Play again' : 'Next shape', () => { if (!last) document.querySelector(`#level [data-value="${level + 1}"]`).click(); else newGame(); }, 600);
  }

  undoBtn.addEventListener('click', undo);
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('level'), level, v => newGame(+v));
  newGame();
})();
