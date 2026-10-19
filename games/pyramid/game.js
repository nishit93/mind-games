(() => {
  const tableEl = document.getElementById('table');
  const leftEl = document.getElementById('left');
  const passesEl = document.getElementById('passes');
  const winsEl = document.getElementById('wins');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let wins = +MG.store.get('pyramid-wins') || 0;
  // s: { pyr: [card|null] x28, stock: [], waste: [], passes }
  let s, sel, history, done;

  // Card k in row r (0-based) sits at index r(r+1)/2 + k and is covered by (r+1, k) and (r+1, k+1).
  const idx = (r, k) => (r * (r + 1)) / 2 + k;
  const rowOf = i => { let r = 0; while (idx(r + 1, 0) <= i) r++; return r; };
  const free = i => { const r = rowOf(i), k = i - idx(r, 0); return r === 6 || (!s.pyr[idx(r + 1, k)] && !s.pyr[idx(r + 1, k + 1)]); };

  function deal() {
    const d = Cards.deck();
    s = { pyr: d.splice(0, 28), stock: d, waste: [], passes: 2 };
    sel = null;
    history = [];
    done = false;
    ov.hide();
    status.textContent = 'Pair free cards that make 13. Kings go on their own.';
    render();
  }

  function snapshot() { history.push(JSON.stringify(s)); }

  // A selectable spot: { from: 'pyr', i } or { from: 'waste' }.
  const cardAt = p => (p.from === 'pyr' ? s.pyr[p.i] : s.waste[s.waste.length - 1]);
  const removeAt = p => { if (p.from === 'pyr') s.pyr[p.i] = null; else s.waste.pop(); };

  function pick(p) {
    if (done) return;
    const c = cardAt(p);
    if (!c) return;
    if (c.rank === 13) { snapshot(); removeAt(p); sel = null; return after(); }
    if (!sel) { sel = p; return render(); }
    if (sel.from === p.from && sel.i === p.i) { sel = null; return render(); }
    const a = cardAt(sel);
    if (a.rank + c.rank === 13) {
      snapshot();
      // Remove the pyramid card first so indices stay valid.
      removeAt(sel);
      removeAt(p);
      sel = null;
      return after();
    }
    sel = p;
    status.textContent = `${a.rank} + ${c.rank} is ${a.rank + c.rank}, not 13.`;
    render();
  }

  function tapStock() {
    if (done) return;
    if (s.stock.length) { snapshot(); s.waste.push(s.stock.pop()); sel = null; return after(); }
    if (s.passes > 0 && s.waste.length) { snapshot(); s.stock = s.waste.reverse(); s.waste = []; s.passes--; sel = null; return after(); }
  }

  function anyMove() {
    const avail = s.pyr.map((c, i) => (c && free(i) ? c : null)).filter(Boolean);
    const w = s.waste[s.waste.length - 1];
    if (w) avail.push(w);
    if (avail.some(c => c.rank === 13)) return true;
    for (let a = 0; a < avail.length; a++) for (let b = a + 1; b < avail.length; b++) if (avail[a].rank + avail[b].rank === 13) return true;
    return s.stock.length > 0 || (s.passes > 0 && s.waste.length > 0);
  }

  function after() {
    const left = s.pyr.filter(Boolean).length;
    if (!left) {
      done = true;
      wins++;
      MG.store.set('pyramid-wins', wins);
      render();
      ov.win('Pyramid cleared', 'Every pair made 13.', 'New deal', deal, 500);
      return;
    }
    status.textContent = '';
    render();
    if (!anyMove()) {
      done = true;
      render();
      ov.show('No more pairs', `${left} card${left === 1 ? '' : 's'} left in the pyramid. Try another deal?`, 'New deal', deal, 700);
    }
  }

  function render() {
    const W = tableEl.clientWidth - 20;
    const cw = Math.min(64, Math.floor((W - 6 * 4) / 7));
    const ch = cw * 1.4;
    tableEl.style.setProperty('--cw', `${cw}px`);
    const parts = [];
    const put = (html, left, top, attrs) => parts.push(html.replace('class="card', `${attrs} style="left:${left + 10}px;top:${top + 10}px" class="card`));
    for (let r = 0; r < 7; r++) {
      for (let k = 0; k <= r; k++) {
        const i = idx(r, k), c = s.pyr[i];
        if (!c) continue;
        const left = (W - (r + 1) * cw - r * 4) / 2 + k * (cw + 4);
        const isFree = free(i);
        const html = Cards.html(c, { up: true, value: true }).replace('class="card', `class="card ${isFree ? 'free' : 'blocked'}${sel && sel.from === 'pyr' && sel.i === i ? ' sel' : ''}`);
        put(html, left, r * ch * 0.5, isFree ? `data-pyr="${i}"` : '');
      }
    }
    const y = 6 * ch * 0.5 + ch + 18;
    parts.push(`<div class="slot" data-stock="1" style="left:10px;top:${y + 10}px">${s.stock.length ? '' : s.passes ? '↺' : ''}</div>`);
    if (s.stock.length) put(Cards.html(s.stock[0]), 0, y, 'data-stock="1"');
    parts.push(`<div class="slot" style="left:${cw + 14}px;top:${y + 10}px"></div>`);
    const w = s.waste[s.waste.length - 1];
    if (w) put(Cards.html(w, { up: true, value: true }).replace('class="card', `class="card${sel && sel.from === 'waste' ? ' sel' : ''}`), cw + 4, y, 'data-waste="1"');
    tableEl.style.height = `${y + ch + 20}px`;
    tableEl.innerHTML = parts.join('');
    leftEl.textContent = s.pyr.filter(Boolean).length;
    passesEl.textContent = s.passes;
    winsEl.textContent = wins;
    undoBtn.disabled = !history.length || done;
  }

  tableEl.addEventListener('click', e => {
    const el = e.target.closest('[data-pyr], [data-waste], [data-stock]');
    if (!el) return;
    if (el.dataset.stock) tapStock();
    else if (el.dataset.waste) pick({ from: 'waste' });
    else pick({ from: 'pyr', i: +el.dataset.pyr });
  });
  undoBtn.addEventListener('click', () => { if (history.length && !done) { s = JSON.parse(history.pop()); sel = null; render(); } });
  document.getElementById('new').addEventListener('click', deal);
  new ResizeObserver(() => { if (s) render(); }).observe(tableEl);
  deal();
})();
