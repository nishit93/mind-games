(() => {
  const tableEl = document.getElementById('table');
  const leftEl = document.getElementById('left');
  const stockEl = document.getElementById('stock');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show;

  // Layout: rows of 3, 6, 9 and 10 cards. A card covers the two cards below it.
  const ROWS = [3, 6, 9, 10];
  const slots = []; // { row, idx, x, kids: [slot index] }
  (() => {
    let start = 0;
    const rowStart = [];
    ROWS.forEach(n => { rowStart.push(start); start += n; });
    for (let r = 0; r < 4; r++) for (let i = 0; i < ROWS[r]; i++) slots.push({ row: r, idx: i, x: 0, kids: [] });
    for (let i = 0; i < 10; i++) slots[rowStart[3] + i].x = i;
    for (let r = 2; r >= 0; r--) {
      for (let i = 0; i < ROWS[r]; i++) {
        let a, b;
        if (r === 2) { a = i; b = i + 1; }
        else if (r === 1) { const p = Math.floor(i / 2), q = i % 2; a = 3 * p + q; b = 3 * p + q + 1; }
        else { a = 2 * i; b = 2 * i + 1; }
        const s = slots[rowStart[r] + i];
        s.kids = [rowStart[r + 1] + a, rowStart[r + 1] + b];
        s.x = (slots[s.kids[0]].x + slots[s.kids[1]].x) / 2;
      }
    }
  })();

  // s: { cards: [card|null x28], stock: [card], waste: [card] }
  let s, history, done;

  const top = a => a[a.length - 1];
  const free = i => s.cards[i] && slots[i].kids.every(k => !s.cards[k]);
  const fits = c => Math.abs(c.rank - top(s.waste).rank) === 1;
  const left = () => s.cards.filter(Boolean).length;
  const canPlay = () => s.cards.some((c, i) => c && free(i) && fits(c));

  function deal() {
    const d = Cards.deck();
    s = { cards: d.splice(0, 28), waste: [d.pop()], stock: d };
    history = [];
    done = false;
    ov.hide();
    status.textContent = 'Clear the peaks: play a free card one higher or lower than the pile.';
    render();
  }

  function play(i) {
    if (done || !free(i)) return;
    if (!fits(s.cards[i])) { status.textContent = 'That card is not one away from the pile.'; return; }
    history.push(JSON.stringify(s));
    s.waste.push(s.cards[i]);
    s.cards[i] = null;
    after();
  }

  function draw() {
    if (done || !s.stock.length) return;
    history.push(JSON.stringify(s));
    s.waste.push(s.stock.pop());
    after();
  }

  function after() {
    status.textContent = '';
    render();
    const n = left();
    if (!n || (!s.stock.length && !canPlay())) {
      done = true;
      const prev = MG.store.get('tripeaks-best');
      if (prev === null || n < +prev) MG.store.set('tripeaks-best', n);
      render();
      (n ? ov.show : ov.win)(n ? `${n} left` : 'Three peaks cleared', n ? `${n} card${n === 1 ? '' : 's'} left on the peaks. Lower is better.` : 'Every peak is cleared.', 'New deal', deal, 600);
    }
  }

  function render() {
    const W = tableEl.clientWidth - 20;
    const gap = 3;
    const cw = Math.max(26, Math.min(52, Math.floor((W - gap * 9) / 10)));
    const ch = cw * 1.4;
    const dy = ch * 0.55;
    tableEl.style.setProperty('--cw', `${cw}px`);
    const parts = [];
    const put = (html, x, y, attrs = '') => parts.push(html.replace('class="card', `${attrs} style="left:${x + 10}px;top:${y + 10}px" class="card`));
    s.cards.forEach((c, i) => {
      if (!c) return;
      const sl = slots[i];
      const x = sl.x * (cw + gap);
      const y = sl.row * dy;
      if (free(i)) {
        const html = Cards.html(c, { up: true }).replace('class="card', `class="card${!done && fits(c) ? ' free' : ''}`);
        put(html, x, y, `data-i="${i}"`);
      } else put(Cards.html(c), x, y);
    });
    const y = 3 * dy + ch + 18;
    parts.push(`<div class="slot" style="left:10px;top:${y + 10}px"></div>`);
    if (s.stock.length) put(Cards.html(s.stock[0]), 0, y, 'data-stock="1"');
    put(Cards.html(top(s.waste), { up: true }), cw + 14, y);
    tableEl.style.height = `${y + ch + 20}px`;
    tableEl.innerHTML = parts.join('');
    leftEl.textContent = left();
    stockEl.textContent = s.stock.length;
    bestEl.textContent = MG.store.get('tripeaks-best') ?? '–';
    undoBtn.disabled = !history.length || done;
  }

  tableEl.addEventListener('click', e => {
    const el = e.target.closest('[data-i], [data-stock]');
    if (!el) return;
    if (el.dataset.stock) draw();
    else play(+el.dataset.i);
  });
  undoBtn.addEventListener('click', () => { if (history.length && !done) { s = JSON.parse(history.pop()); status.textContent = ''; render(); } });
  document.getElementById('new').addEventListener('click', deal);
  { let raf = 0; new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (s) render(); }); }).observe(tableEl); }
  deal();
})();
