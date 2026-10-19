(() => {
  const gridEl = document.getElementById('grid');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = Math.min(+MG.store.get('sky-n') || 4, 5);
  // clues: { top, bottom, left, right } arrays of length n; 0 = no clue.
  let solution, clues, given, values, sel, done, cells, clueEls;

  const seen = line => { let max = 0, k = 0; for (const v of line) if (v > max) { max = v; k++; } return k; };
  const row = (g, r) => g.slice(r * n, r * n + n);
  const col = (g, c) => Array.from({ length: n }, (_, r) => g[r * n + c]);

  let perms = [];
  function permutations(k) {
    const out = [];
    const go = (cur, used) => {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let v = 1; v <= k; v++) if (!used[v]) { used[v] = true; cur.push(v); go(cur, used); cur.pop(); used[v] = false; }
    };
    go([], []);
    return out;
  }

  // Count solutions row by row, pruning by column clashes and partial views from the top.
  function count(cl, g0, limit) {
    const rowsOk = [...Array(n).keys()].map(r => perms.filter(p =>
      (!cl.left[r] || seen(p) === cl.left[r]) && (!cl.right[r] || seen(p.slice().reverse()) === cl.right[r])
      && p.every((v, c) => !g0[r * n + c] || g0[r * n + c] === v)));
    const g = new Array(n * n).fill(0);
    let found = 0;
    const colMax = new Array(n).fill(0), colSeen = new Array(n).fill(0);
    const usedCol = Array.from({ length: n }, () => new Array(n + 1).fill(false));
    function go(r) {
      if (r === n) {
        for (let c = 0; c < n; c++) if (cl.bottom[c] && seen(col(g, c).reverse()) !== cl.bottom[c]) return;
        found++;
        return;
      }
      for (const p of rowsOk[r]) {
        let ok = true;
        for (let c = 0; c < n && ok; c++) {
          if (usedCol[c][p[c]]) ok = false;
          else if (cl.top[c]) {
            const s = colSeen[c] + (p[c] > colMax[c] ? 1 : 0);
            if (s > cl.top[c] || (Math.max(colMax[c], p[c]) === n && s !== cl.top[c])) ok = false;
          }
        }
        if (!ok) continue;
        const saved = [colMax.slice(), colSeen.slice()];
        p.forEach((v, c) => { g[r * n + c] = v; usedCol[c][v] = true; if (v > colMax[c]) { colMax[c] = v; colSeen[c]++; } });
        go(r + 1);
        p.forEach((v, c) => { usedCol[c][v] = false; });
        colMax.splice(0, n, ...saved[0]);
        colSeen.splice(0, n, ...saved[1]);
        if (found >= limit) return;
      }
    }
    go(0);
    return found;
  }

  function newGame(size = n) {
    n = size;
    MG.store.set('sky-n', n);
    perms = permutations(n);
    solution = Latin.random(n);
    clues = {
      top: [...Array(n).keys()].map(c => seen(col(solution, c))),
      bottom: [...Array(n).keys()].map(c => seen(col(solution, c).reverse())),
      left: [...Array(n).keys()].map(r => seen(row(solution, r))),
      right: [...Array(n).keys()].map(r => seen(row(solution, r).reverse())),
    };
    given = new Array(n * n).fill(0);
    while (count(clues, given, 2) !== 1) {
      const free = given.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
      const i = free[Math.floor(Math.random() * free.length)];
      given[i] = solution[i];
    }
    // Hide clues while the city stays unique, keeping at least half of them for a gentler puzzle.
    const slots = MG.shuffle(['top', 'bottom', 'left', 'right'].flatMap(s => [...Array(n).keys()].map(k => [s, k])));
    let shown = 4 * n;
    for (const [s, k] of slots) {
      if (shown <= 2 * n) break;
      const keep = clues[s][k];
      clues[s][k] = 0;
      if (count(clues, given, 2) === 1) shown--;
      else clues[s][k] = keep;
    }
    values = given.slice();
    sel = values.indexOf(0);
    done = false;
    clock.reset();
    ov.hide();
    gridEl.parentElement.classList.remove('solved');
    build();
    const best = MG.store.get(`sky-best-${n}`);
    bestEl.textContent = best ? MG.fmt(+best) : '–';
  }

  function build() {
    gridEl.style.gridTemplateColumns = `0.6fr repeat(${n}, 1fr) 0.6fr`;
    const parts = [];
    cells = [];
    clueEls = [];
    const clueEl = (side, k) => {
      const d = document.createElement('div');
      d.className = 'clue';
      const v = clues[side][k];
      d.textContent = v || '';
      if (v) { d.setAttribute('aria-label', `${v} visible from the ${side}`); clueEls.push({ el: d, side, k }); }
      return d;
    };
    parts.push(document.createElement('div'));
    for (let c = 0; c < n; c++) parts.push(clueEl('top', c));
    parts.push(document.createElement('div'));
    for (let r = 0; r < n; r++) {
      parts.push(clueEl('left', r));
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        const b = document.createElement('button');
        b.addEventListener('click', () => { if (!given[i] && !done) { sel = i; render(); } });
        cells[i] = b;
        parts.push(b);
      }
      parts.push(clueEl('right', r));
    }
    parts.push(document.createElement('div'));
    for (let c = 0; c < n; c++) parts.push(clueEl('bottom', c));
    parts.push(document.createElement('div'));
    gridEl.replaceChildren(...parts);
    Latin.pad(document.getElementById('pad'), n, enter);
    render();
  }

  function render() {
    cells.forEach((b, i) => {
      const r = Math.floor(i / n), c = i % n, v = values[i];
      const peer = sel !== null && i !== sel && (Math.floor(sel / n) === r || sel % n === c);
      b.className = 'lc' + (given[i] ? ' given' : '') + (i === sel && !done ? ' sel' : peer && !done ? ' peer' : '') + (Latin.clash(values, n, i) ? ' clash' : '');
      b.innerHTML = v ? `<div class="bar" style="height:${(v / n) * 100}%"></div><span>${v}</span>` : '';
      b.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${v ? `height ${v}` : 'empty'}${given[i] ? ', given' : ''}`);
    });
    for (const { el, side, k } of clueEls) {
      let line = side === 'top' || side === 'bottom' ? col(values, k) : row(values, k);
      if (side === 'bottom' || side === 'right') line = line.reverse();
      const full = line.every(Boolean);
      el.className = 'clue' + (full ? (seen(line) === clues[side][k] ? ' met' : ' bad') : '');
    }
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
      const prev = +MG.store.get(`sky-best-${n}`);
      if (!prev || ms < prev) MG.store.set(`sky-best-${n}`, ms);
      bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
      ov.show('City built', `${n}×${n} in ${MG.fmt(ms)}.${!prev || ms < prev ? ' A new best.' : ''}`, 'New city', () => newGame(), 600);
    }
  }

  Latin.keys(() => n, () => sel, s => { if (!given[s]) { sel = s; render(); } }, enter);
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
