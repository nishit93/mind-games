(() => {
  const tableEl = document.getElementById('table');
  const movesEl = document.getElementById('moves');
  const winsEl = document.getElementById('wins');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let wins = +MG.store.get('freecells-wins') || 0;
  // s: { cells: [card|null x4], found: [[card] x4 by suit], tab: [[card] x8] }
  let s, moves, history, done, finishing = false;

  // for the site test: read the position, or set one up
  window.__freeCells = { state: () => s, load: st => { s = st; history = []; done = false; finishing = false; render(); } };

  function deal() {
    const d = Cards.deck();
    s = { cells: [null, null, null, null], found: [[], [], [], []], tab: Array.from({ length: 8 }, () => []) };
    d.forEach((c, i) => s.tab[i % 8].push(c));
    moves = 0;
    history = [];
    done = false;
    ov.hide();
    status.textContent = 'Tap a card to move it. Nearly every deal can be won.';
    render();
  }

  const top = a => a[a.length - 1];
  const canFound = c => { const f = s.found[c.suit]; return f.length ? top(f).rank + 1 === c.rank : c.rank === 1; };
  const fits = (c, col) => { const t = top(s.tab[col]); return !t || (Cards.red(t) !== Cards.red(c) && t.rank === c.rank + 1); };
  const freeCells = () => s.cells.filter(c => !c).length;
  // How many cards can travel together: one for each free cell plus one, doubled for each empty column (not counting the target).
  const capacity = target => (freeCells() + 1) * 2 ** s.tab.filter((col, k) => !col.length && k !== target).length;
  const isRun = cards => cards.every((c, i) => i === 0 || (Cards.red(cards[i - 1]) !== Cards.red(c) && cards[i - 1].rank === c.rank + 1));

  function snapshot() { history.push(JSON.stringify(s)); }
  function moved() { moves++; render(); check(); }

  function tapTab(col, idx) {
    if (done || finishing) return;
    const run = s.tab[col].slice(idx);
    if (!isRun(run)) { status.textContent = 'Only cards in a run (alternating colours, counting down) move together.'; return; }
    const c = run[0];
    if (run.length === 1 && canFound(c)) { snapshot(); s.found[c.suit].push(s.tab[col].pop()); return moved(); }
    const order = [...Array(8).keys()].filter(k => k !== col);
    const to = order.find(k => s.tab[k].length && fits(c, k) && run.length <= capacity(k))
      ?? order.find(k => !s.tab[k].length && run.length <= capacity(k) && !(idx === 0));
    if (to !== undefined) { snapshot(); s.tab[to].push(...s.tab[col].splice(idx)); return moved(); }
    if (run.length === 1) {
      const cell = s.cells.indexOf(null);
      if (cell >= 0) { snapshot(); s.cells[cell] = s.tab[col].pop(); return moved(); }
    }
    status.textContent = run.length > 1 ? 'There is not enough room to move that many cards.' : 'That card has nowhere to go just now.';
  }

  function tapCell(k) {
    if (done || finishing || !s.cells[k]) return;
    const c = s.cells[k];
    if (canFound(c)) { snapshot(); s.found[c.suit].push(c); s.cells[k] = null; return moved(); }
    const order = [...Array(8).keys()];
    const to = order.find(j => s.tab[j].length && fits(c, j)) ?? order.find(j => !s.tab[j].length);
    if (to !== undefined) { snapshot(); s.tab[to].push(c); s.cells[k] = null; return moved(); }
    status.textContent = 'That card has nowhere to go just now.';
  }

  const canFinish = () => s.tab.every(col => col.every((c, i) => i === 0 || col[i - 1].rank > c.rank));

  function check() {
    undoBtn.disabled = !history.length || done;
    if (s.found.every(f => f.length === 13)) {
      done = true;
      wins++;
      MG.store.set('freecells-wins', wins);
      winsEl.textContent = wins;
      ov.win('Solved', `All cards home in ${moves} moves.`, 'New deal', deal, 500);
    }
  }

  // Every column already counts down, so the lowest card is always free to go home: let the cards go by themselves.
  async function finishAll() {
    if (finishing) return;
    finishing = true;
    snapshot();
    const mine = s;
    while (s === mine && !s.found.every(f => f.length === 13)) {
      let went = false;
      for (let k = 0; k < 8 && !went; k++) { const t = top(s.tab[k]); if (t && canFound(t)) { s.found[t.suit].push(s.tab[k].pop()); moves++; went = true; } }
      for (let k = 0; k < 4 && !went; k++) { const c = s.cells[k]; if (c && canFound(c)) { s.found[c.suit].push(c); s.cells[k] = null; moves++; went = true; } }
      if (!went) break;
      render();
      await MG.wait(60);
    }
    finishing = false;
    if (s === mine) check();
  }

  function render() {
    const W = tableEl.clientWidth - 16;
    const gap = Math.max(2, Math.round(W * 0.01));
    const cw = Math.min(70, Math.floor((W - gap * 7) / 8));
    const ch = cw * 1.4;
    const x = k => k * (cw + gap);
    tableEl.style.setProperty('--cw', `${cw}px`);
    const parts = [];
    const place = (inner, left, topPx, attrs = '') => parts.push(inner.replace('class="card', `${attrs} style="left:${left + 8}px;top:${topPx + 8}px" class="card`));

    for (let k = 0; k < 4; k++) {
      parts.push(`<div class="slot" style="left:${x(k) + 8}px;top:8px" aria-hidden="true"></div>`);
      if (s.cells[k]) place(Cards.html(s.cells[k], { up: true }), x(k), 0, `data-where="cell" data-col="${k}"`);
    }
    for (let f = 0; f < 4; f++) {
      parts.push(`<div class="slot" style="left:${x(4 + f) + 8}px;top:8px" aria-hidden="true">${Cards.SUITS[f]}</div>`);
      if (s.found[f].length) place(Cards.html(top(s.found[f]), { up: true }), x(4 + f), 0, 'data-where="found"');
    }
    const y0 = ch + 14;
    let tallest = 0;
    s.tab.forEach((col, k) => {
      parts.push(`<div class="slot" style="left:${x(k) + 8}px;top:${y0 + 8}px" aria-hidden="true"></div>`);
      let off = cw * 0.4;
      const maxH = Math.max(ch * 3.6, window.innerHeight * 0.6);
      if ((col.length - 1) * off > maxH) off = Math.max(cw * 0.22, maxH / Math.max(col.length - 1, 1));
      col.forEach((c, j) => place(Cards.html(c, { up: true }), x(k), y0 + j * off, `data-where="tab" data-col="${k}" data-idx="${j}"`));
      tallest = Math.max(tallest, Math.max(col.length - 1, 0) * off);
    });
    tableEl.style.height = `${y0 + tallest + ch + 16}px`;
    tableEl.innerHTML = parts.join('');
    movesEl.textContent = moves;
    winsEl.textContent = wins;
    undoBtn.disabled = !history.length || done;
    if (canFinish() && !done && !finishing) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = 'Finish';
      b.style.cssText = 'position:absolute;right:12px;bottom:12px;';
      b.addEventListener('click', finishAll);
      tableEl.append(b);
    }
  }

  tableEl.addEventListener('click', e => {
    const el = e.target.closest('[data-where]');
    if (!el || finishing) return;
    if (el.dataset.where === 'tab') tapTab(+el.dataset.col, +el.dataset.idx);
    else if (el.dataset.where === 'cell') tapCell(+el.dataset.col);
  });
  undoBtn.addEventListener('click', () => {
    if (!history.length || done || finishing) return;
    s = JSON.parse(history.pop());
    moves++;
    render();
  });
  document.getElementById('new').addEventListener('click', deal);
  new ResizeObserver(() => { if (s) render(); }).observe(tableEl);
  deal();
})();
