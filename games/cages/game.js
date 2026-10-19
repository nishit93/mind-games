(() => {
  const gridEl = document.getElementById('grid');
  const padEl = document.getElementById('pad');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = +MG.store.get('cages-n') || 4;
  let solution, cages, cageOf, values, sel, done, cells;

  function latin() {
    const rows = MG.shuffle([...Array(n).keys()]), cols = MG.shuffle([...Array(n).keys()]);
    const sym = MG.shuffle([...Array(n).keys()].map(k => k + 1));
    return Array.from({ length: n * n }, (_, i) => sym[(rows[Math.floor(i / n)] + cols[i % n]) % n]);
  }

  function makeCages(sol) {
    const owner = new Array(n * n).fill(-1), list = [];
    for (const start of MG.shuffle([...Array(n * n).keys()])) {
      if (owner[start] >= 0) continue;
      const r = Math.random();
      const size = r < 0.12 ? 1 : r < 0.6 ? 2 : r < 0.95 ? 3 : 4;
      const members = [start];
      owner[start] = list.length;
      while (members.length < size) {
        const options = members.flatMap(i => {
          const rr = Math.floor(i / n), cc = i % n;
          return [[rr - 1, cc], [rr + 1, cc], [rr, cc - 1], [rr, cc + 1]]
            .filter(([a, b]) => a >= 0 && a < n && b >= 0 && b < n && owner[a * n + b] < 0).map(([a, b]) => a * n + b);
        });
        if (!options.length) break;
        const pick = options[Math.floor(Math.random() * options.length)];
        owner[pick] = list.length;
        members.push(pick);
      }
      const vals = members.map(i => sol[i]);
      let op, target;
      if (members.length === 1) { op = ''; target = vals[0]; }
      else if (members.length === 2) {
        const [a, b] = [Math.max(...vals), Math.min(...vals)];
        const choices = ['−', '+', '×'];
        if (a % b === 0) choices.push('÷', '÷');
        op = choices[Math.floor(Math.random() * choices.length)];
        target = op === '−' ? a - b : op === '÷' ? a / b : op === '+' ? a + b : a * b;
      } else {
        op = Math.random() < 0.5 ? '+' : '×';
        target = op === '+' ? vals.reduce((x, y) => x + y) : vals.reduce((x, y) => x * y);
      }
      list.push({ members, op, target });
    }
    return { list, owner };
  }

  // Does a (possibly partial) cage still work?
  function cageOk(c, g) {
    const vals = c.members.map(i => g[i]);
    const filled = vals.filter(Boolean);
    const full = filled.length === vals.length;
    switch (c.op) {
      case '': return !full || vals[0] === c.target;
      case '+': { const s = filled.reduce((a, b) => a + b, 0); return full ? s === c.target : s < c.target; }
      case '×': { const p = filled.reduce((a, b) => a * b, 1); return full ? p === c.target : c.target % p === 0; }
      case '−': return !full || Math.abs(vals[0] - vals[1]) === c.target;
      case '÷': return !full || Math.max(...vals) / Math.min(...vals) === c.target;
    }
    return true;
  }

  function count(g, limit) {
    const i = g.indexOf(0);
    if (i < 0) return 1;
    const r = Math.floor(i / n), c = i % n;
    let found = 0;
    for (let v = 1; v <= n; v++) {
      let clash = false;
      for (let k = 0; k < n; k++) if (g[r * n + k] === v || g[k * n + c] === v) { clash = true; break; }
      if (clash) continue;
      g[i] = v;
      if (cageOk(cages[cageOf[i]], g)) found += count(g, limit - found);
      g[i] = 0;
      if (found >= limit) break;
    }
    return found;
  }

  function newGame(size = n) {
    n = size;
    MG.store.set('cages-n', n);
    for (let tries = 0; ; tries++) {
      solution = latin();
      const made = makeCages(solution);
      cages = made.list;
      cageOf = made.owner;
      if (count(new Array(n * n).fill(0), 2) === 1) break;
    }
    values = new Array(n * n).fill(0);
    sel = 0;
    done = false;
    clock.reset();
    ov.hide();
    gridEl.classList.remove('solved');
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    const thick = '2px solid var(--text)';
    cells = values.map((_, i) => {
      const b = document.createElement('button');
      const r = Math.floor(i / n), c = i % n, own = cageOf[i];
      if (r > 0 && cageOf[i - n] !== own) b.style.borderTop = thick;
      if (c > 0 && cageOf[i - 1] !== own) b.style.borderLeft = thick;
      const cage = cages[own];
      if (Math.min(...cage.members) === i) b.dataset.label = `${cage.target}${cage.op}`;
      b.addEventListener('click', () => { if (!done) { sel = i; render(); } });
      return b;
    });
    gridEl.replaceChildren(...cells);
    padEl.style.gridTemplateColumns = `repeat(${n + 1}, 1fr)`;
    padEl.innerHTML = [...Array(n).keys()].map(k => `<button class="key" data-v="${k + 1}">${k + 1}</button>`).join('')
      + '<button class="key" data-v="0" aria-label="Clear">⌫</button>';
    const best = MG.store.get(`cages-best-${n}`);
    bestEl.textContent = best ? MG.fmt(+best) : '–';
    render();
  }

  function render() {
    cells.forEach((b, i) => {
      const r = Math.floor(i / n), c = i % n, v = values[i];
      const clash = v && [...Array(n).keys()].some(k => (k !== c && values[r * n + k] === v) || (k !== r && values[k * n + c] === v));
      const peer = sel !== null && i !== sel && (Math.floor(sel / n) === r || sel % n === c);
      b.className = 'c' + (i === sel && !done ? ' sel' : peer && !done ? ' peer' : '') + (clash ? ' clash' : '');
      b.innerHTML = `${b.dataset.label ? `<span class="lab">${b.dataset.label}</span>` : ''}${v || ''}`;
      const cage = cages[cageOf[i]];
      b.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${v || 'empty'}, cage ${cage.target}${{ '+': ' plus', '×': ' times', '−': ' minus', '÷': ' divide', '': '' }[cage.op]}`);
    });
  }

  function enter(v) {
    if (done || sel === null) return;
    clock.start();
    values[sel] = v;
    render();
    if (values.every((x, i) => x === solution[i])) {
      done = true;
      const ms = clock.stop();
      gridEl.classList.add('solved');
      render();
      const prev = +MG.store.get(`cages-best-${n}`);
      if (!prev || ms < prev) MG.store.set(`cages-best-${n}`, ms);
      bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
      ov.show('Solved', `${n}×${n} in ${MG.fmt(ms)}.${!prev || ms < prev ? ' A new best.' : ''}`, 'New puzzle', () => newGame(), 600);
    }
  }

  padEl.addEventListener('click', e => { const k = e.target.closest('[data-v]'); if (k) enter(+k.dataset.v); });
  document.addEventListener('keydown', e => {
    if (new RegExp(`^[1-${n}]$`).test(e.key)) enter(+e.key);
    else if (e.key === 'Backspace' || e.key === 'Delete') enter(0);
    else if (e.key.startsWith('Arrow') && sel !== null) {
      e.preventDefault();
      const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      sel = ((Math.floor(sel / n) + dr + n) % n) * n + ((sel % n) + dc + n) % n;
      render();
    }
  });
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
