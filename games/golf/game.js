(() => {
  const tableEl = document.getElementById('table');
  const leftEl = document.getElementById('left');
  const stockEl = document.getElementById('stock');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));

  // s: { cols: [[card] x7], stock: [card], pile: [card] }
  let s, history, done;

  function deal() {
    const d = Cards.deck();
    s = { cols: Array.from({ length: 7 }, () => d.splice(0, 5)), pile: [d.pop()], stock: d };
    history = [];
    done = false;
    ov.hide();
    status.textContent = 'Play a card one higher or lower than the pile.';
    render();
  }

  const top = a => a[a.length - 1];
  const fits = c => Math.abs(c.rank - top(s.pile).rank) === 1;
  const left = () => s.cols.reduce((n, col) => n + col.length, 0);

  function play(k) {
    if (done) return;
    const c = top(s.cols[k]);
    if (!c) return;
    if (!fits(c)) { status.textContent = `${Cards.RANKS[c.rank]} isn't one away from ${Cards.RANKS[top(s.pile).rank]}.`; return; }
    history.push(JSON.stringify(s));
    s.pile.push(s.cols[k].pop());
    after();
  }

  function draw() {
    if (done || !s.stock.length) return;
    history.push(JSON.stringify(s));
    s.pile.push(s.stock.pop());
    after();
  }

  function after() {
    status.textContent = '';
    render();
    const n = left();
    if (!n || (!s.stock.length && !s.cols.some(col => col.length && fits(top(col))))) {
      done = true;
      const prev = MG.store.get('golf-best');
      if (prev === null || n < +prev) MG.store.set('golf-best', n);
      render();
      ov.show(n ? `Score ${n}` : 'Hole in one', n ? `${n} card${n === 1 ? '' : 's'} left in the columns. Lower is better.` : 'Every column cleared.', 'New deal', deal, 600);
    }
  }

  function render() {
    const W = tableEl.clientWidth - 20;
    const gap = 4;
    const cw = Math.min(64, Math.floor((W - gap * 6) / 7));
    const ch = cw * 1.4;
    const off = cw * 0.42;
    tableEl.style.setProperty('--cw', `${cw}px`);
    const parts = [];
    const put = (html, left, topPx, attrs = '') => parts.push(html.replace('class="card', `${attrs} style="left:${left + 10}px;top:${topPx + 10}px" class="card`));
    s.cols.forEach((col, k) => col.forEach((c, j) => {
      const isTop = j === col.length - 1;
      const html = Cards.html(c, { up: true }).replace('class="card', `class="card${isTop && !done ? (fits(c) ? ' free' : '') : ' blocked'}`);
      put(html, k * (cw + gap), j * off, isTop ? `data-col="${k}"` : '');
    }));
    const y = 4 * off + ch + 22;
    parts.push(`<div class="slot" style="left:10px;top:${y + 10}px"></div>`);
    if (s.stock.length) put(Cards.html(s.stock[0]), 0, y, 'data-stock="1"');
    put(Cards.html(top(s.pile), { up: true }), cw + gap + cw * 0.4, y);
    tableEl.style.height = `${y + ch + 20}px`;
    tableEl.innerHTML = parts.join('');
    leftEl.textContent = left();
    stockEl.textContent = s.stock.length;
    bestEl.textContent = MG.store.get('golf-best') ?? '–';
    undoBtn.disabled = !history.length || done;
  }

  tableEl.addEventListener('click', e => {
    const el = e.target.closest('[data-col], [data-stock]');
    if (!el) return;
    if (el.dataset.stock) draw();
    else play(+el.dataset.col);
  });
  undoBtn.addEventListener('click', () => { if (history.length && !done) { s = JSON.parse(history.pop()); status.textContent = ''; render(); } });
  document.getElementById('new').addEventListener('click', deal);
  new ResizeObserver(() => { if (s) render(); }).observe(tableEl);
  deal();
})();
