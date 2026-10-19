(() => {
  const gridEl = document.getElementById('grid');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = +MG.store.get('futoshiki-n') || 4;
  // rels: { a, b } meaning value[a] < value[b], always between neighbours.
  let solution, given, rels, values, sel, done, cells, signs;

  function count(g, limit, relSet) {
    const i = g.indexOf(0);
    if (i < 0) return 1;
    const r = Math.floor(i / n), c = i % n;
    let found = 0;
    for (let v = 1; v <= n; v++) {
      let ok = true;
      for (let k = 0; k < n && ok; k++) if (g[r * n + k] === v || g[k * n + c] === v) ok = false;
      if (!ok) continue;
      g[i] = v;
      for (const { a, b } of relSet) {
        if ((a === i || b === i) && g[a] && g[b] && !(g[a] < g[b])) { ok = false; break; }
      }
      if (ok) found += count(g, limit - found, relSet);
      g[i] = 0;
      if (found >= limit) break;
    }
    return found;
  }

  function newGame(size = n) {
    n = size;
    MG.store.set('futoshiki-n', n);
    solution = Latin.random(n);
    const all = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n;
      for (const j of [c < n - 1 ? i + 1 : -1, r < n - 1 ? i + n : -1]) {
        if (j < 0) continue;
        all.push(solution[i] < solution[j] ? { a: i, b: j } : { a: j, b: i });
      }
    }
    const grid = () => solution.map((v, i) => (given[i] ? v : 0));
    given = solution.map(() => false);
    rels = all.slice();
    // Add givens until the full set of signs pins down one answer.
    while (count(grid(), 2, rels) !== 1) given[MG.shuffle(given.map((g, i) => (g ? -1 : i)).filter(i => i >= 0))[0]] = true;
    // Remove signs (keeping a gentle number), then spare givens, while the answer stays unique.
    for (const rel of MG.shuffle(all.slice())) {
      if (rels.length <= Math.ceil(all.length * 0.4)) break;
      const without = rels.filter(x => x !== rel);
      if (count(grid(), 2, without) === 1) rels = without;
    }
    for (const i of MG.shuffle([...Array(n * n).keys()])) {
      if (!given[i]) continue;
      given[i] = false;
      if (count(grid(), 2, rels) !== 1) given[i] = true;
    }
    values = grid();
    sel = values.indexOf(0);
    done = false;
    clock.reset();
    ov.hide();
    gridEl.parentElement.classList.remove('solved');
    build();
    const best = MG.store.get(`futoshiki-best-${n}`);
    bestEl.textContent = best ? MG.fmt(+best) : '–';
  }

  // Layout: (2n-1) columns, with sign slots between squares.
  function build() {
    gridEl.style.gridTemplateColumns = Array.from({ length: 2 * n - 1 }, (_, k) => (k % 2 ? '0.45fr' : '1fr')).join(' ');
    const parts = [];
    cells = [];
    signs = [];
    const relBetween = (x, y) => rels.find(r => (r.a === x && r.b === y) || (r.a === y && r.b === x));
    for (let R = 0; R < 2 * n - 1; R++) {
      for (let C = 0; C < 2 * n - 1; C++) {
        if (R % 2 === 0 && C % 2 === 0) {
          const i = (R / 2) * n + C / 2;
          const b = document.createElement('button');
          b.addEventListener('click', () => { if (!given[i] && !done) { sel = i; render(); } });
          cells[i] = b;
          parts.push(b);
        } else {
          const s = document.createElement('div');
          s.className = 'sign';
          if (R % 2 === 0 && C % 2 === 1) {
            const x = (R / 2) * n + (C - 1) / 2, rel = relBetween(x, x + 1);
            if (rel) { s.textContent = rel.a === x ? '<' : '>'; signs.push({ el: s, rel }); }
          } else if (R % 2 === 1 && C % 2 === 0) {
            const x = ((R - 1) / 2) * n + C / 2, rel = relBetween(x, x + n);
            if (rel) { s.textContent = rel.a === x ? '∧' : '∨'; signs.push({ el: s, rel }); }
            s.style.aspectRatio = 'auto';
            s.style.minHeight = '18px';
          }
          parts.push(s);
        }
      }
    }
    gridEl.replaceChildren(...parts);
    Latin.pad(document.getElementById('pad'), n, enter);
    render();
  }

  function render() {
    cells.forEach((b, i) => {
      const r = Math.floor(i / n), c = i % n;
      const peer = sel !== null && i !== sel && (Math.floor(sel / n) === r || sel % n === c);
      b.className = 'lc' + (given[i] ? ' given' : '') + (i === sel && !done ? ' sel' : peer && !done ? ' peer' : '') + (Latin.clash(values, n, i) ? ' clash' : '');
      b.textContent = values[i] || '';
      b.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${values[i] || 'empty'}${given[i] ? ', given' : ''}`);
    });
    for (const { el, rel } of signs) el.classList.toggle('bad', !!(values[rel.a] && values[rel.b] && values[rel.a] >= values[rel.b]));
  }

  function enter(v) {
    if (done || sel === null || given[sel]) return;
    clock.start();
    values[sel] = v;
    render();
    if (values.every((x, i) => x === solution[i])) {
      done = true;
      const ms = clock.stop();
      gridEl.parentElement.classList.add('solved');
      render();
      const prev = +MG.store.get(`futoshiki-best-${n}`);
      if (!prev || ms < prev) MG.store.set(`futoshiki-best-${n}`, ms);
      bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
      ov.show('Solved', `${n}×${n} in ${MG.fmt(ms)}.${!prev || ms < prev ? ' A new best.' : ''}`, 'New puzzle', () => newGame(), 600);
    }
  }

  Latin.keys(() => n, () => sel, s => { if (!given[s]) { sel = s; render(); } }, enter);
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
