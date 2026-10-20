(() => {
  const tableEl = document.getElementById('table');
  const leftEl = document.getElementById('left');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show;

  // piles: array of piles, each an array of cards (the last card is on top)
  let piles, history, sel, done;
  const COLS = 7;

  const top = p => p[p.length - 1];
  const match = (a, b) => a.rank === b.rank || a.suit === b.suit;
  const targets = i => [i - 1, i - 3].filter(t => t >= 0 && match(top(piles[i]), top(piles[t])));
  const anyMove = () => piles.some((_, i) => targets(i).length);

  function deal() {
    piles = Cards.deck().map(c => [c]);
    history = [];
    sel = null;
    done = false;
    ov.hide();
    status.textContent = 'Tap a card, then the card to its left (or three to the left) that matches its suit or number.';
    render();
  }

  function move(i, t) {
    history.push(JSON.stringify(piles));
    piles[t].push(...piles[i]);
    piles.splice(i, 1);
    sel = null;
    status.textContent = '';
    render();
    if (piles.length === 1 || !anyMove()) finish();
  }

  function finish() {
    done = true;
    const n = piles.length;
    const prev = MG.store.get('accordion-best');
    if (prev === null || n < +prev) MG.store.set('accordion-best', n);
    render();
    (n === 1 ? ov.win : ov.show)(n === 1 ? 'All in one pile' : `${n} piles left`, n === 1 ? 'The whole deck folded into one pile. Very rare.' : 'No more cards can move. Fewer piles is better.', 'New deal', deal, 600);
  }

  function tap(i) {
    if (done) return;
    if (sel === null) {
      const t = targets(i);
      if (!t.length) { status.textContent = 'That card has nowhere to go yet.'; return; }
      if (t.length === 1) { move(i, t[0]); return; }
      sel = i; status.textContent = 'Two places fit. Tap the one you want.';
      render();
      return;
    }
    if (i === sel) { sel = null; status.textContent = ''; render(); return; }
    if (targets(sel).includes(i)) move(sel, i);
    else { sel = null; status.textContent = ''; render(); }
  }

  function render() {
    const W = tableEl.clientWidth - 20;
    const gap = 4;
    const cw = Math.min(56, Math.floor((W - gap * (COLS - 1)) / COLS));
    const ch = cw * 1.4;
    tableEl.style.setProperty('--cw', `${cw}px`);
    const rows = Math.ceil(piles.length / COLS);
    const t = sel === null ? [] : targets(sel);
    tableEl.innerHTML = piles.map((p, i) => {
      const cls = i === sel ? ' sel' : t.includes(i) ? ' free' : '';
      const html = Cards.html(top(p), { up: true }).replace('class="card', `class="card${cls}`);
      const left = (i % COLS) * (cw + gap) + 10;
      const topPx = Math.floor(i / COLS) * (ch + gap) + 10;
      const stack = p.length > 1 ? `<span class="stackn">${p.length}</span>` : '';
      return html.replace('class="card', `data-i="${i}" style="left:${left}px;top:${topPx}px" class="card`).replace(/<\/div>$/, `${stack}</div>`);
    }).join('');
    tableEl.style.height = `${rows * (ch + gap) + 16}px`;
    leftEl.textContent = piles.length;
    bestEl.textContent = MG.store.get('accordion-best') ?? '–';
    undoBtn.disabled = !history.length || done;
  }

  tableEl.addEventListener('click', e => {
    const el = e.target.closest('[data-i]');
    if (el) tap(+el.dataset.i);
  });
  undoBtn.addEventListener('click', () => { if (history.length && !done) { piles = JSON.parse(history.pop()); sel = null; status.textContent = ''; render(); } });
  document.getElementById('new').addEventListener('click', deal);
  { let raf = 0; new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (piles) render(); }); }).observe(tableEl); }
  deal();
})();
