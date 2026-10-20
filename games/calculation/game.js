(() => {
  const tableEl = document.getElementById('table');
  const leftEl = document.getElementById('left');
  const stockEl = document.getElementById('stock');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show;

  // s: { found: [[card] x4], waste: [[card] x4], stock: [card] }  (the top of the stock is the card in hand)
  let s, history, done;
  const STEP = [1, 2, 3, 4];

  const top = a => a[a.length - 1];
  const need = k => ((top(s.found[k]).rank - 1 + STEP[k]) % 13) + 1;
  const hand = () => top(s.stock);
  const placed = () => s.found.reduce((n, f) => n + f.length, 0);

  function deal() {
    const d = Cards.deck();
    const found = [1, 2, 3, 4].map(r => { const i = d.findIndex(c => c.rank === r); return [d.splice(i, 1)[0]]; });
    s = { found, waste: [[], [], [], []], stock: d };
    history = [];
    done = false;
    ov.hide();
    status.textContent = 'Build the four rows up: Ace, 2, 3… then 2, 4, 6… then 3, 6, 9… then 4, 8, Q…';
    render();
  }

  const wasteTopFits = k => s.waste.some(w => w.length && top(w).rank === need(k));
  function playFound(k) {
    if (done) return;
    if (s.stock.length && hand().rank === need(k)) {
      history.push(JSON.stringify(s));
      s.found[k].push(s.stock.pop());
    } else {
      const w = s.waste.find(w => w.length && top(w).rank === need(k));
      if (!w) { status.textContent = `This row needs a ${Cards.RANKS[need(k)]}.`; return; }
      history.push(JSON.stringify(s));
      s.found[k].push(w.pop());
    }
    after();
  }

  function playWaste(k) {
    if (done || !s.stock.length) return;
    history.push(JSON.stringify(s));
    s.waste[k].push(s.stock.pop());
    after();
  }

  function stuck() {
    if (s.stock.length) return false;
    return !s.found.some((_, k) => wasteTopFits(k));
  }

  function after() {
    status.textContent = '';
    render();
    const n = 52 - placed();
    if (!n || stuck()) {
      done = true;
      const prev = MG.store.get('calculation-best');
      if (prev === null || n < +prev) MG.store.set('calculation-best', n);
      render();
      (n ? ov.show : ov.win)(n ? `${n} left` : 'Calculated', n ? `${n} card${n === 1 ? '' : 's'} left over. Lower is better.` : 'All four rows are complete.', 'New deal', deal, 600);
    }
  }

  function render() {
    const W = tableEl.clientWidth - 20;
    const gap = 6;
    const cw = Math.min(64, Math.floor((W - gap * 3) / 4));
    const ch = cw * 1.4;
    const off = cw * 0.38;
    tableEl.style.setProperty('--cw', `${cw}px`);
    const parts = [];
    const put = (html, x, y, attrs = '') => parts.push(html.replace('class="card', `${attrs} style="left:${x + 10}px;top:${y + 10}px" class="card`));
    s.found.forEach((f, k) => {
      const html = Cards.html(top(f), { up: true }).replace('class="card', `class="card${!done && ((s.stock.length && hand().rank === need(k)) || wasteTopFits(k)) ? ' free' : ''}`);
      put(html, k * (cw + gap), 0, `data-found="${k}"`);
      parts.push(`<span class="nextlabel" style="left:${k * (cw + gap) + 10}px;top:${ch + 12}px;width:${cw}px">needs ${Cards.RANKS[need(k)]}</span>`);
    });
    const y2 = ch + 34;
    parts.push(`<div class="slot" style="left:10px;top:${y2 + 10}px"></div>`);
    if (s.stock.length) put(Cards.html(hand(), { up: true }), 0, y2, '');
    const y3 = y2 + ch + 16;
    let maxH = 0;
    s.waste.forEach((w, k) => {
      const x = k * (cw + gap);
      parts.push(`<div class="slot" style="left:${x + 10}px;top:${y3 + 10}px" data-waste="${k}"></div>`);
      w.forEach((c, j) => put(Cards.html(c, { up: true }), x, y3 + j * off, j === w.length - 1 ? `data-waste="${k}"` : ''));
      maxH = Math.max(maxH, (w.length - 1) * off);
    });
    tableEl.style.height = `${y3 + ch + maxH + 24}px`;
    tableEl.innerHTML = parts.join('');
    leftEl.textContent = 52 - placed();
    stockEl.textContent = Math.max(s.stock.length - 1, 0);
    bestEl.textContent = MG.store.get('calculation-best') ?? '–';
    undoBtn.disabled = !history.length || done;
  }

  tableEl.addEventListener('click', e => {
    const f = e.target.closest('[data-found]');
    if (f) return playFound(+f.dataset.found);
    const w = e.target.closest('[data-waste]');
    if (w) playWaste(+w.dataset.waste);
  });
  undoBtn.addEventListener('click', () => { if (history.length && !done) { s = JSON.parse(history.pop()); status.textContent = ''; render(); } });
  document.getElementById('new').addEventListener('click', deal);
  { let raf = 0; new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (s) render(); }); }).observe(tableEl); }
  deal();
})();
