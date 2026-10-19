(() => {
  const TREE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="7" fill="#88B04B"/><rect x="11" y="14" width="2" height="7" rx="1" fill="#8E6654"/></svg>';
  const TENT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3Z" fill="#A47864"/><path d="M12 11 15.5 20h-7Z" fill="#FFBE98"/></svg>';
  const gridEl = document.getElementById('grid');
  const placedEl = document.getElementById('placed');
  const needEl = document.getElementById('need');
  const bestEl = document.getElementById('best');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message
  const clock = { t: 0 };

  let n = +MG.store.get('tents-n') || 6;
  // state: 0 empty, 1 tent, 2 grass. trees: Set of indices.
  let trees, solution, rowClue, colClue, state, done, cells, rowEls, colEls;

  const nb4 = i => { const r = Math.floor(i / n), c = i % n; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && a < n && b >= 0 && b < n).map(([a, b]) => a * n + b); };
  const nb8 = i => { const r = Math.floor(i / n), c = i % n, out = []; for (let a = r - 1; a <= r + 1; a++) for (let b = c - 1; b <= c + 1; b++) if ((a !== r || b !== c) && a >= 0 && a < n && b >= 0 && b < n) out.push(a * n + b); return out; };

  // Count distinct tent layouts (up to limit) that satisfy every rule.
  function count(limit) {
    const treeList = [...trees].sort((a, b) => a - b);
    const tents = new Set(), rows = new Array(n).fill(0), cols = new Array(n).fill(0);
    const layouts = new Set();
    function go(k) {
      if (layouts.size >= limit) return;
      if (k === treeList.length) {
        if (rows.every((v, r) => v === rowClue[r]) && cols.every((v, c) => v === colClue[c])) layouts.add([...tents].sort((a, b) => a - b).join());
        return;
      }
      for (const cell of nb4(treeList[k])) {
        if (trees.has(cell) || tents.has(cell)) continue;
        const r = Math.floor(cell / n), c = cell % n;
        if (rows[r] >= rowClue[r] || cols[c] >= colClue[c]) continue;
        if (nb8(cell).some(x => tents.has(x))) continue;
        tents.add(cell); rows[r]++; cols[c]++;
        go(k + 1);
        tents.delete(cell); rows[r]--; cols[c]--;
      }
    }
    go(0);
    return layouts.size;
  }

  function generate() {
    for (;;) {
      const tents = new Set();
      for (const i of MG.shuffle([...Array(n * n).keys()])) {
        if (tents.size >= Math.round((n * n) / 5)) break;
        if (!nb8(i).some(x => tents.has(x))) tents.add(i);
      }
      trees = new Set();
      for (const t of tents) {
        const spots = nb4(t).filter(x => !tents.has(x) && !trees.has(x));
        if (!spots.length) { tents.delete(t); continue; }
        trees.add(spots[Math.floor(Math.random() * spots.length)]);
      }
      solution = tents;
      rowClue = [...Array(n).keys()].map(r => [...tents].filter(t => Math.floor(t / n) === r).length);
      colClue = [...Array(n).keys()].map(c => [...tents].filter(t => t % n === c).length);
      if (count(2) === 1) return;
    }
  }

  function newGame(size = n) {
    n = size;
    MG.store.set('tents-n', n);
    generate();
    state = new Array(n * n).fill(0);
    done = false;
    clock.t = 0;
    ov.hide();
    gridEl.parentElement.classList.remove('solved');
    gridEl.style.gridTemplateColumns = `0.6fr repeat(${n}, 1fr)`;
    const parts = [document.createElement('div')];
    colEls = [...Array(n).keys()].map(c => { const d = Object.assign(document.createElement('div'), { className: 'clue', textContent: colClue[c] }); parts.push(d); return d; });
    rowEls = [];
    cells = [];
    for (let r = 0; r < n; r++) {
      const d = Object.assign(document.createElement('div'), { className: 'clue', textContent: rowClue[r] });
      rowEls.push(d);
      parts.push(d);
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const b = document.createElement('button');
        b.addEventListener('click', () => tap(i));
        cells.push(b);
        parts.push(b);
      }
    }
    gridEl.replaceChildren(...parts);
    needEl.textContent = trees.size;
    bestEl.textContent = MG.store.get(`tents-best-${n}`) ? MG.fmt(+MG.store.get(`tents-best-${n}`)) : '–';
    render();
  }

  function render() {
    const tents = state.map((s, i) => (s === 1 ? i : -1)).filter(i => i >= 0);
    const tentSet = new Set(tents);
    cells.forEach((b, i) => {
      const tree = trees.has(i), s = state[i];
      const touching = s === 1 && nb8(i).some(x => tentSet.has(x));
      b.className = 't' + (tree ? ' tree' : s === 2 ? ' grass' : '') + (touching ? ' bad' : '');
      b.innerHTML = tree ? TREE : s === 1 ? TENT : '';
      b.disabled = tree;
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}, ${tree ? 'tree' : ['empty', 'tent', 'grass'][s]}`);
    });
    rowEls.forEach((el, r) => { const k = tents.filter(t => Math.floor(t / n) === r).length; el.className = 'clue' + (k === rowClue[r] ? ' met' : k > rowClue[r] ? ' over' : ''); });
    colEls.forEach((el, c) => { const k = tents.filter(t => t % n === c).length; el.className = 'clue' + (k === colClue[c] ? ' met' : k > colClue[c] ? ' over' : ''); });
    placedEl.textContent = tents.length;
  }

  function tap(i) {
    if (done || trees.has(i)) return;
    if (!clock.t) clock.t = Date.now();
    state[i] = (state[i] + 1) % 3;
    render();
    const tents = state.map((s, k) => (s === 1 ? k : -1)).filter(k => k >= 0);
    if (tents.length === solution.size && tents.every(t => solution.has(t))) {
      done = true;
      const ms = Date.now() - clock.t;
      gridEl.parentElement.classList.add('solved');
      const prev = +MG.store.get(`tents-best-${n}`);
      if (!prev || ms < prev) MG.store.set(`tents-best-${n}`, ms);
      bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
      ov.win('Campsite ready', `Every tree has its tent. ${MG.fmt(ms)}.`, 'New puzzle', () => newGame(), 600);
    }
  }

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
