(() => {
  const JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const gridEl = document.getElementById('grid');
  const countEl = document.getElementById('count');
  const totalEl = document.getElementById('total');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = +MG.store.get('knight-n') || 5;
  let path, cells, done;

  const moves = i => {
    const r = Math.floor(i / n), c = i % n, out = [];
    for (const [dr, dc] of JUMPS) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && !path.includes(rr * n + cc)) out.push(rr * n + cc);
    }
    return out;
  };

  function newGame(size = n) {
    n = size;
    MG.store.set('knight-n', n);
    path = [];
    done = false;
    ov.hide();
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = Array.from({ length: n * n }, (_, i) => {
      const b = document.createElement('button');
      b.addEventListener('click', () => tap(i));
      return b;
    });
    gridEl.replaceChildren(...cells);
    totalEl.textContent = n * n;
    status.textContent = 'Tap any square to place the knight.';
    render();
  }

  function render() {
    const at = path.at(-1);
    const next = at === undefined ? [] : moves(at);
    cells.forEach((b, i) => {
      const step = path.indexOf(i);
      const dark = (Math.floor(i / n) + (i % n)) % 2 === 1;
      b.className = 'sq' + (dark ? ' dark' : '') + (step >= 0 ? ' visited' : '') + (i === at ? ' knight' : '') + (next.includes(i) ? ' next' : '');
      b.textContent = i === at ? '♞' : step >= 0 ? step + 1 : '';
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}, ${
        i === at ? 'knight' : step >= 0 ? `visited ${step + 1}` : next.includes(i) ? 'can jump here' : 'empty'}`);
    });
    countEl.textContent = path.length;
    bestEl.textContent = MG.store.get(`knight-best-${n}`) || '–';
    undoBtn.disabled = !path.length;
  }

  function tap(i) {
    if (done) return;
    if (path.length && !moves(path.at(-1)).includes(i)) return;
    path.push(i);
    const prev = +MG.store.get(`knight-best-${n}`) || 0;
    if (path.length > prev) MG.store.set(`knight-best-${n}`, path.length);
    render();

    if (path.length === n * n) {
      done = true;
      status.textContent = 'Every square visited.';
      ov.show('Full tour', `The knight visited all ${n * n} squares.`, 'Play again', () => newGame(), 600);
    } else if (!moves(i).length) {
      status.textContent = `Stuck after ${path.length} squares. Undo, or start again.`;
    } else {
      status.textContent = `${n * n - path.length} squares to go.`;
    }
  }

  undoBtn.addEventListener('click', () => {
    if (!path.length) return;
    path.pop();
    done = false;
    ov.hide();
    status.textContent = path.length ? `${n * n - path.length} squares to go.` : 'Tap any square to place the knight.';
    render();
  });
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
