(() => {
  const pyrEl = document.getElementById('pyr');
  const padEl = document.getElementById('pad');
  const solvedEl = document.getElementById('solved');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message
  const MAX_BASE = { 3: 5, 4: 9, 5: 12 };

  let rows = MG.kids ? 3 : +MG.store.get('pyramid-rows') || 3;
  let solved = +MG.store.get('pyramid-solved') || 0;
  let cells, solution, given, values, sel, done, bricks;

  // cells[r] lists brick indices of row r (row 0 is the bottom). Brick above (r, k) rests on (r-1, k) and (r-1, k+1).
  function layout() {
    cells = [];
    let id = 0;
    for (let r = 0; r < rows; r++) cells.push(Array.from({ length: rows - r }, () => id++));
  }
  const triples = () => {
    const t = [];
    for (let r = 1; r < rows; r++) cells[r].forEach((top, k) => t.push([top, cells[r - 1][k], cells[r - 1][k + 1]]));
    return t;
  };

  // Can the hidden bricks be filled one at a time from the known ones?
  function solvable(known) {
    const k = new Set(known);
    for (let changed = true; changed;) {
      changed = false;
      for (const [t, a, b] of triples()) {
        const miss = [t, a, b].filter(x => !k.has(x));
        if (miss.length === 1) { k.add(miss[0]); changed = true; }
      }
    }
    return k.size === rows * (rows + 1) / 2;
  }

  function newGame(r = rows) {
    rows = r;
    MG.store.set('pyramid-rows', rows);
    layout();
    const base = Array.from({ length: rows }, () => 1 + Math.floor(Math.random() * MAX_BASE[rows]));
    solution = [];
    cells[0].forEach((id, k) => { solution[id] = base[k]; });
    for (const [t, a, b] of triples()) solution[t] = solution[a] + solution[b];
    // Start from a few random givens and add more until the pyramid can be worked out.
    const order = MG.shuffle([...solution.keys()]);
    const known = [];
    for (const id of order) { known.push(id); if (known.length >= rows && solvable(known)) break; }
    // Drop any given that isn't needed, to keep it a puzzle.
    for (const id of MG.shuffle(known.slice())) {
      const without = known.filter(x => x !== id);
      if (solvable(without)) known.splice(known.indexOf(id), 1);
    }
    given = solution.map((_, i) => known.includes(i));
    values = solution.map((v, i) => (given[i] ? v : null));
    sel = values.indexOf(null);
    done = false;
    clock.reset();
    ov.hide();
    pyrEl.classList.remove('solved');
    pyrEl.style.setProperty('--w', `calc((100% - ${(rows - 1) * 6}px) / ${rows})`);
    bricks = [];
    pyrEl.replaceChildren(...cells.slice().reverse().map(ids => {
      const row = document.createElement('div');
      row.className = 'row';
      ids.forEach(id => {
        const b = document.createElement('button');
        b.addEventListener('click', () => { if (!given[id] && !done) { sel = id; render(); } });
        bricks[id] = b;
        row.append(b);
      });
      return row;
    }));
    padEl.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button class="key" data-d="${d}">${d}</button>`).join('')
      + '<button class="key" data-d="del" aria-label="Delete" style="grid-column: span 2">⌫</button>';
    render();
  }

  function render() {
    const full = values.every(v => v !== null);
    const wrong = new Set();
    if (full) for (const [t, a, b] of triples()) if (values[t] !== values[a] + values[b]) [t, a, b].forEach(x => !given[x] && wrong.add(x));
    bricks.forEach((b, id) => {
      b.textContent = values[id] ?? '';
      b.className = 'brick' + (given[id] ? ' given' : '') + (id === sel && !done ? ' sel' : '') + (wrong.has(id) ? ' wrong' : '');
      b.setAttribute('aria-label', `Brick ${values[id] ?? 'empty'}${given[id] ? ', given' : ''}`);
    });
    solvedEl.textContent = solved;
  }

  function type(d) {
    if (done || sel === null || given[sel]) return;
    clock.start();
    const cur = values[sel] === null ? '' : String(values[sel]);
    const next = d === 'del' ? cur.slice(0, -1) : (cur + d).slice(0, 3);
    values[sel] = next === '' ? null : +next;
    render();
    if (values.every((v, i) => v === solution[i])) {
      done = true;
      solved++;
      MG.store.set('pyramid-solved', solved);
      const ms = clock.stop();
      pyrEl.classList.add('solved');
      render();
      ov.win('Solid as a pyramid', `Every brick adds up. Solved in ${MG.fmt(ms)}.`, 'New pyramid', () => newGame(), 600);
    }
  }

  padEl.addEventListener('click', e => { const k = e.target.closest('[data-d]'); if (k) type(k.dataset.d); });
  document.addEventListener('keydown', e => {
    if (/^[0-9]$/.test(e.key)) type(e.key);
    else if (e.key === 'Backspace') type('del');
  });
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), rows, v => newGame(+v));
  newGame();
})();
