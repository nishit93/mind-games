(() => {
  const tableEl = document.getElementById('table');
  const leftEl = document.getElementById('left');
  const stockEl = document.getElementById('stock');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const fillBtn = document.getElementById('fill');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show;

  // s: { grid: [card|null x25], stock: [card] }
  let s, history, sel, done;
  const COLS = 5;

  const near = (i, j) => i !== j && Math.abs((i % COLS) - (j % COLS)) <= 1 && Math.abs(Math.floor(i / COLS) - Math.floor(j / COLS)) <= 1;
  const pairs = g => g.some((c, i) => c && g.some((d, j) => d && near(i, j) && c.rank === d.rank));
  const compacted = g => { const cs = g.filter(Boolean); while (cs.length < 25) cs.push(null); return cs; };
  const count = () => s.grid.filter(Boolean).length + s.stock.length;

  function deal() {
    const d = Cards.deck();
    s = { grid: d.splice(0, 25), stock: d };
    history = [];
    sel = null;
    done = false;
    ov.hide();
    status.textContent = 'Remove pairs of the same number that touch, even corner to corner.';
    render();
  }

  function check() {
    const n = count();
    const hasGap = s.grid.some(c => !c);
    const canGo = pairs(s.grid) || (hasGap && (s.stock.length || pairs(compacted(s.grid))));
    if (!n || !canGo) {
      done = true;
      const prev = MG.store.get('montecarlo-best');
      if (prev === null || n < +prev) MG.store.set('montecarlo-best', n);
      render();
      (n ? ov.show : ov.win)(n ? `${n} left` : 'Every card paired', n ? `${n} card${n === 1 ? '' : 's'} left. Lower is better.` : 'The whole deck is gone.', 'New deal', deal, 600);
    }
  }

  function tap(i) {
    if (done || !s.grid[i]) return;
    if (sel === null) { sel = i; render(); return; }
    if (sel === i) { sel = null; render(); return; }
    if (near(sel, i) && s.grid[sel].rank === s.grid[i].rank) {
      history.push(JSON.stringify(s));
      s.grid[sel] = null; s.grid[i] = null;
      sel = null;
      status.textContent = '';
      render();
      check();
    } else { status.textContent = 'Those two do not match, or do not touch.'; sel = i; render(); }
  }

  function fill() {
    if (done || !s.grid.some(c => !c)) return;
    history.push(JSON.stringify(s));
    const g = compacted(s.grid);
    for (let i = 0; i < 25 && s.stock.length; i++) if (!g[i]) g[i] = s.stock.pop();
    s.grid = g;
    sel = null;
    status.textContent = '';
    render();
    check();
  }

  function render() {
    const W = tableEl.clientWidth - 20;
    const gap = 6;
    const cw = Math.min(64, Math.floor((W - gap * (COLS - 1)) / COLS));
    const ch = cw * 1.4;
    tableEl.style.setProperty('--cw', `${cw}px`);
    const parts = [];
    s.grid.forEach((c, i) => {
      const x = (i % COLS) * (cw + gap) + 10;
      const y = Math.floor(i / COLS) * (ch + gap) + 10;
      if (!c) { parts.push(`<div class="slot" style="left:${x}px;top:${y}px"></div>`); return; }
      const html = Cards.html(c, { up: true }).replace('class="card', `class="card${i === sel ? ' sel' : ''}`);
      parts.push(html.replace('class="card', `data-i="${i}" style="left:${x}px;top:${y}px" class="card`));
    });
    tableEl.style.height = `${5 * (ch + gap) + 14}px`;
    tableEl.innerHTML = parts.join('');
    leftEl.textContent = count();
    stockEl.textContent = s.stock.length;
    bestEl.textContent = MG.store.get('montecarlo-best') ?? '–';
    undoBtn.disabled = !history.length || done;
    fillBtn.disabled = done || !s.grid.some(c => !c);
  }

  tableEl.addEventListener('click', e => {
    const el = e.target.closest('[data-i]');
    if (el) tap(+el.dataset.i);
  });
  fillBtn.addEventListener('click', fill);
  undoBtn.addEventListener('click', () => { if (history.length && !done) { s = JSON.parse(history.pop()); sel = null; status.textContent = ''; render(); } });
  document.getElementById('new').addEventListener('click', deal);
  { let raf = 0; new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (s) render(); }); }).observe(tableEl); }
  deal();
})();
