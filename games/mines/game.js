(() => {
  const LEVELS = { easy: [8, 10], medium: [10, 16], hard: [12, 28] };
  const gridEl = document.getElementById('grid');
  const minesEl = document.getElementById('mines');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  let level = MG.store.get('mines-level') || 'easy';
  let mode = 'dig';
  let n, count, mine, open, flag, cells, started, over;

  const around = i => {
    const r = Math.floor(i / n), c = i % n, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
    }
    return out;
  };
  const touching = i => around(i).filter(j => mine[j]).length;

  function newGame(l = level) {
    level = l;
    MG.store.set('mines-level', level);
    [n, count] = LEVELS[level];
    mine = new Array(n * n).fill(false);
    open = new Array(n * n).fill(false);
    flag = new Array(n * n).fill(false);
    started = over = false;
    clock.reset();
    ov.hide();
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = mine.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'm';
      b.addEventListener('click', () => (mode === 'flag' ? toggleFlag(i) : dig(i)));
      b.addEventListener('contextmenu', e => { e.preventDefault(); toggleFlag(i); });
      let timer;
      b.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'touch') return;
        timer = setTimeout(() => { timer = null; toggleFlag(i); b.dataset.held = '1'; }, 420);
      });
      const cancel = () => clearTimeout(timer);
      b.addEventListener('pointerup', cancel);
      b.addEventListener('pointerleave', cancel);
      b.addEventListener('click', e => { if (b.dataset.held) { e.stopImmediatePropagation(); delete b.dataset.held; } }, true);
      return b;
    });
    gridEl.replaceChildren(...cells);
    const best = MG.store.get(`mines-best-${level}`);
    bestEl.textContent = best ? MG.fmt(+best) : '–';
    render();
  }

  // Mines are laid after the first tap, away from it, so the first dig always opens an area.
  function layMines(first) {
    const safe = new Set([first, ...around(first)]);
    MG.shuffle([...mine.keys()].filter(i => !safe.has(i))).slice(0, count).forEach(i => { mine[i] = true; });
    started = true;
    clock.start();
  }

  function dig(i) {
    if (over || flag[i]) return;
    if (!started) layMines(i);
    if (open[i]) return chord(i);
    if (mine[i]) return lose(i);
    const stack = [i];
    while (stack.length) {
      const j = stack.pop();
      if (open[j] || flag[j]) continue;
      open[j] = true;
      if (!touching(j)) stack.push(...around(j));
    }
    render();
    if (open.filter(Boolean).length === n * n - count) win();
  }

  function chord(i) {
    const t = touching(i);
    if (!t || around(i).filter(j => flag[j]).length !== t) return;
    for (const j of around(i)) if (!open[j] && !flag[j]) { dig(j); if (over) return; }
  }

  function toggleFlag(i) {
    if (over || open[i]) return;
    flag[i] = !flag[i];
    render();
  }

  function render(boom = -1) {
    cells.forEach((b, i) => {
      let cls = 'm', text = '', label = 'covered';
      if (open[i]) {
        const t = touching(i);
        cls += ' open' + (t ? ` n${t}` : '');
        text = t || '';
        label = t ? `${t} mines around` : 'clear';
      } else if (over && mine[i]) {
        cls += i === boom ? ' boom' : ' mine';
        text = flag[i] ? '⚑' : '●';
        label = 'mine';
      } else if (flag[i]) {
        cls += ' flag' + (over ? ' wrong' : '');
        text = '⚑';
        label = 'flagged';
      }
      b.className = cls;
      b.textContent = text;
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}, ${label}`);
    });
    minesEl.textContent = count - flag.filter(Boolean).length;
  }

  function lose(i) {
    over = true;
    clock.stop();
    render(i);
    ov.show('Boom', 'That square hid a mine. Take a breath and try again.', 'New game', () => newGame(), 1100);
  }

  function win() {
    over = true;
    const ms = clock.stop();
    mine.forEach((m, i) => { if (m) flag[i] = true; });
    over = false;
    render();
    over = true;
    const prev = +MG.store.get(`mines-best-${level}`);
    if (!prev || ms < prev) MG.store.set(`mines-best-${level}`, ms);
    bestEl.textContent = MG.fmt(Math.min(ms, prev || ms));
    ov.show('Field cleared', `Every safe square found in ${MG.fmt(ms)}.${!prev || ms < prev ? ' A new best.' : ''}`, 'Play again', () => newGame(), 500);
  }

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('mode'), mode, v => { mode = v; });
  MG.seg(document.getElementById('level'), level, v => newGame(v));
  newGame();
})();
