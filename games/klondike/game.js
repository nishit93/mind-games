(() => {
  const tableEl = document.getElementById('table');
  const movesEl = document.getElementById('moves');
  const winsEl = document.getElementById('wins');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let draw = +MG.store.get('klondike-draw') || 1;
  let wins = +MG.store.get('klondike-wins') || 0;
  // s: { stock: [card], waste: [card], found: [[card] x4 by suit], tab: [[{c, up}] x7] }
  let s, moves, history, done, finishing = false;

  function deal() {
    const d = Cards.deck();
    s = { stock: [], waste: [], found: [[], [], [], []], tab: [] };
    for (let k = 0; k < 7; k++) s.tab.push(Array.from({ length: k + 1 }, (_, j) => ({ c: d.pop(), up: j === k })));
    s.stock = d;
    moves = 0;
    history = [];
    done = false;
    clock.reset();
    ov.hide();
    status.textContent = 'Tap a card to move it. Tap the stock to turn cards.';
    render();
  }

  const top = a => a[a.length - 1];
  const canFound = c => { const f = s.found[c.suit]; return f.length ? top(f).rank + 1 === c.rank : c.rank === 1; };
  const canTab = (c, col) => {
    const t = top(s.tab[col]);
    return t ? t.up && Cards.red(t.c) !== Cards.red(c) && t.c.rank === c.rank + 1 : c.rank === 13;
  };

  function snapshot() { history.push(JSON.stringify(s)); clock.start(); }
  function flipTops() { for (const col of s.tab) { const t = top(col); if (t && !t.up) t.up = true; } }
  function moved() { moves++; flipTops(); render(); check(); }

  function tapStock() {
    if (done) return;
    if (!s.stock.length && !s.waste.length) return;
    snapshot();
    if (s.stock.length) for (let k = 0; k < draw && s.stock.length; k++) s.waste.push(s.stock.pop());
    else { s.stock = s.waste.reverse(); s.waste = []; }
    moved();
  }

  // Move the card (and anything on top) to the best destination.
  function tapCard(where, col, idx) {
    if (done) return;
    if (where === 'waste') {
      const c = top(s.waste);
      if (canFound(c)) { snapshot(); s.found[c.suit].push(s.waste.pop()); return moved(); }
      const to = bestColumn(c, -1);
      if (to >= 0) { snapshot(); s.tab[to].push({ c: s.waste.pop(), up: true }); return moved(); }
    } else if (where === 'found') {
      const c = top(s.found[col]);
      const to = bestColumn(c, -1);
      if (to >= 0) { snapshot(); s.tab[to].push({ c: s.found[col].pop(), up: true }); return moved(); }
    } else {
      const pile = s.tab[col], item = pile[idx];
      if (!item.up) return;
      const run = pile.slice(idx);
      if (run.length === 1 && canFound(item.c)) { snapshot(); s.found[item.c.suit].push(pile.pop().c); return moved(); }
      const to = bestColumn(item.c, col, idx === 0);
      if (to >= 0) { snapshot(); s.tab[to].push(...pile.splice(idx)); return moved(); }
    }
    status.textContent = 'That card has nowhere to go just now.';
  }

  // Prefer a column that already has cards; a King only moves to an empty column if it would free something.
  function bestColumn(c, from, alreadyBottom = false) {
    const order = [...Array(7).keys()].filter(k => k !== from);
    const nonEmpty = order.find(k => s.tab[k].length && canTab(c, k));
    if (nonEmpty !== undefined) return nonEmpty;
    if (c.rank === 13 && !alreadyBottom) return order.find(k => !s.tab[k].length) ?? -1;
    return -1;
  }

  function check() {
    undoBtn.disabled = !history.length || done;
    if (s.found.every(f => f.length === 13)) {
      done = true;
      wins++;
      MG.store.set('klondike-wins', wins);
      const ms = clock.stop();
      render();
      ov.win('Solved', `All cards home in ${moves} moves.`, 'New deal', deal, 500);
    }
  }

  const canFinish = () => !s.stock.length && !s.waste.length && s.tab.every(col => col.every(x => x.up));

  async function finishAll() {
    if (finishing) return;
    finishing = true;
    snapshot();
    const mine = s;
    while (s === mine && !s.found.every(f => f.length === 13)) {
      let movedOne = false;
      for (const col of s.tab) {
        const t = top(col);
        if (t && canFound(t.c)) { s.found[t.c.suit].push(col.pop().c); moves++; movedOne = true; break; }
      }
      if (!movedOne) break;
      render();
      await MG.wait(60);
    }
    finishing = false;
    if (s === mine) check();
  }

  function render() {
    const W = tableEl.clientWidth - 20;
    const gap = Math.max(3, Math.round(W * 0.012));
    const cw = Math.min(70, Math.floor((W - gap * 6) / 7));
    const ch = cw * 1.4;
    const x = k => k * (cw + gap);
    tableEl.style.setProperty('--cw', `${cw}px`);
    const parts = [];
    const place = (inner, left, topPx, attrs = '') => parts.push(inner.replace('class="card', `${attrs} style="left:${left + 10}px;top:${topPx + 10}px" class="card`));

    // Stock and waste
    parts.push(`<div class="slot" data-where="stock" style="left:10px;top:10px">${s.stock.length ? '' : '↺'}</div>`);
    if (s.stock.length) place(Cards.html(top(s.stock)), x(0), 0, 'data-where="stock"');
    const shown = s.waste.slice(-(draw === 3 ? 3 : 1));
    shown.forEach((c, k) => place(Cards.html(c, { up: true }), x(1) + k * cw * 0.32, 0, k === shown.length - 1 ? 'data-where="waste"' : ''));
    // Foundations, one slot per suit
    for (let f = 0; f < 4; f++) {
      parts.push(`<div class="slot" style="left:${x(3 + f) + 10}px;top:10px">${Cards.SUITS[f]}</div>`);
      if (s.found[f].length) place(Cards.html(top(s.found[f]), { up: true }), x(3 + f), 0, `data-where="found" data-col="${f}"`);
    }
    // Tableau, squeezing the spacing if a column gets long
    const y0 = ch + 14;
    let tallest = 0;
    s.tab.forEach((col, k) => {
      parts.push(`<div class="slot" style="left:${x(k) + 10}px;top:${y0 + 10}px"></div>`);
      const downs = col.filter(i => !i.up).length, ups = col.length - downs;
      let offUp = cw * 0.42, offDown = cw * 0.2;
      const maxH = Math.max(ch * 3.6, window.innerHeight * 0.55);
      if (downs * offDown + ups * offUp > maxH) offUp = Math.max(cw * 0.24, (maxH - downs * offDown) / Math.max(ups, 1));
      let y = y0;
      col.forEach((item, j) => {
        place(Cards.html(item.c, { up: item.up }), x(k), y, `data-where="tab" data-col="${k}" data-idx="${j}"`);
        y += item.up ? offUp : offDown;
      });
      tallest = Math.max(tallest, y - y0);
    });
    tableEl.style.height = `${y0 + tallest + ch + 20}px`;
    tableEl.innerHTML = parts.join('');
    movesEl.textContent = moves;
    winsEl.textContent = wins;
    undoBtn.disabled = !history.length || done;
    if (canFinish() && !done) {
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
    const where = el.dataset.where;
    if (where === 'stock') tapStock();
    else tapCard(where, +el.dataset.col, +el.dataset.idx);
  });
  undoBtn.addEventListener('click', () => {
    if (!history.length || done || finishing) return;
    s = JSON.parse(history.pop());
    moves++;
    render();
  });
  document.getElementById('new').addEventListener('click', deal);
  MG.seg(document.getElementById('draw'), draw, v => { draw = +v; MG.store.set('klondike-draw', draw); deal(); });
  new ResizeObserver(() => { if (s) render(); }).observe(tableEl);
  deal();
})();
