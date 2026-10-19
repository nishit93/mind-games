(() => {
  const KINDS = [
    ...['一', '二', '三', '四', '五', '六', '七', '八', '九'].map(g => [g, '#8E6654']),
    ...['東', '南', '西', '北'].map(g => [g, '#6667AB']),
    ['中', '#C0564B'], ['發', '#5E8F3E'], ['白', '#92A8D1'],
    ...['春', '夏', '秋', '冬'].map(g => [g, '#5E8F3E']),
    ...['梅', '蘭', '竹', '菊'].map(g => [g, '#B9614E']),
  ];
  // Layers of the layout: [columns, rows, column offset, row offset].
  const LAYERS = [[8, 6, 0, 0], [6, 4, 1, 1], [4, 2, 2, 2], [2, 1, 3, 2]];
  const boardEl = document.getElementById('board');
  const leftEl = document.getElementById('left');
  const pairsEl = document.getElementById('pairs');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  const SLOTS = LAYERS.flatMap(([w, h, ox, oy], z) => Array.from({ length: w * h }, (_, k) => ({ z, x: ox + (k % w), y: oy + Math.floor(k / w) })));
  // tiles: kind index per slot, or -1 once removed
  let tiles, sel, history, done;

  const at = (z, x, y) => SLOTS.findIndex(p => p.z === z && p.x === x && p.y === y);
  const ABOVE = SLOTS.map(p => at(p.z + 1, p.x, p.y));
  const LEFT = SLOTS.map(p => at(p.z, p.x - 1, p.y));
  const RIGHT = SLOTS.map(p => at(p.z, p.x + 1, p.y));
  const isFree = (t, i) => t[i] >= 0 && !(ABOVE[i] >= 0 && t[ABOVE[i]] >= 0) && (!(LEFT[i] >= 0 && t[LEFT[i]] >= 0) || !(RIGHT[i] >= 0 && t[RIGHT[i]] >= 0));

  // Give the occupied slots matching kinds by "playing" a random game in reverse: each pair is chosen
  // from tiles that are free at that moment, so the deal can always be cleared.
  function assign(slots, kinds) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const t = new Array(SLOTS.length).fill(-1);
      slots.forEach(i => { t[i] = 0; });
      const pairs = MG.shuffle(kinds.slice());
      const out = new Array(SLOTS.length).fill(-1);
      let ok = true;
      for (const kind of pairs) {
        const free = MG.shuffle(slots.filter(i => isFree(t, i)));
        if (free.length < 2) { ok = false; break; }
        const [a, b] = free;
        out[a] = out[b] = kind;
        t[a] = t[b] = -1;
      }
      if (ok) return out;
    }
    return null;
  }

  function deal() {
    const pairCount = SLOTS.length / 2;
    const kinds = Array.from({ length: pairCount }, (_, k) => k % KINDS.length);
    tiles = assign([...SLOTS.keys()], kinds);
    sel = null;
    history = [];
    done = false;
    clock.reset();
    ov.hide();
    status.textContent = 'Tap two matching free tiles.';
    render();
  }

  function freePairs() {
    const byKind = {};
    tiles.forEach((k, i) => { if (k >= 0 && isFree(tiles, i)) (byKind[k] ||= []).push(i); });
    return Object.values(byKind).filter(list => list.length > 1);
  }

  function render(hint = []) {
    const W = boardEl.clientWidth;
    const tw = Math.min(54, Math.floor((W - 30) / 8));
    const th = Math.round(tw * 1.3);
    const lift = Math.max(4, Math.round(tw * 0.16));
    boardEl.style.height = `${6 * th + 34}px`;
    boardEl.innerHTML = SLOTS.map((p, i) => {
      const k = tiles[i];
      if (k < 0) return '';
      const free = isFree(tiles, i);
      const [glyph, colour] = KINDS[k];
      return `<button class="tile${free ? '' : ' blocked'}${sel === i ? ' sel' : ''}${hint.includes(i) ? ' hint' : ''}" data-i="${i}"
        style="left:${(W - 8 * tw) / 2 + p.x * tw - p.z * lift}px;top:${16 + p.y * th - p.z * lift}px;width:${tw - 2}px;height:${th - 2}px;z-index:${p.z * 10 + p.y};color:${colour};font-size:${tw * 0.58}px"
        aria-label="${glyph}${free ? '' : ', blocked'}">${glyph}</button>`;
    }).join('');
    const left = tiles.filter(k => k >= 0).length;
    leftEl.textContent = left;
    pairsEl.textContent = freePairs().length;
    undoBtn.disabled = !history.length || done;
  }

  function tap(i) {
    if (done || !isFree(tiles, i)) return;
    clock.start();
    if (sel === null || sel === i) { sel = sel === i ? null : i; return render(); }
    if (tiles[sel] !== tiles[i]) { sel = i; return render(); }
    history.push(tiles.slice());
    tiles[sel] = tiles[i] = -1;
    sel = null;
    after();
  }

  function after() {
    const left = tiles.filter(k => k >= 0).length;
    if (!left) {
      done = true;
      const ms = clock.stop();
      render();
      ov.win('Board cleared', `Every tile matched in ${MG.fmt(ms)}.`, 'New deal', deal, 500);
      return;
    }
    if (!freePairs().length) {
      // Reshuffle the remaining tiles into a layout that can still be cleared.
      const slots = tiles.map((k, i) => (k >= 0 ? i : -1)).filter(i => i >= 0);
      const counts = {};
      slots.forEach(i => { counts[tiles[i]] = (counts[tiles[i]] || 0) + 1; });
      const kinds = Object.entries(counts).flatMap(([k, c]) => Array(c / 2).fill(+k));
      const fresh = assign(slots, kinds);
      if (fresh) { slots.forEach(i => { tiles[i] = fresh[i]; }); status.textContent = 'No free pairs were left, so the tiles were reshuffled.'; }
    } else {
      status.textContent = '';
    }
    render();
  }

  boardEl.addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) tap(+t.dataset.i); });
  document.getElementById('hint').addEventListener('click', () => {
    if (done) return;
    const p = freePairs()[0];
    if (p) { sel = null; render(p.slice(0, 2)); status.textContent = 'These two match.'; }
  });
  undoBtn.addEventListener('click', () => { if (history.length && !done) { tiles = history.pop(); sel = null; render(); } });
  document.getElementById('new').addEventListener('click', deal);
  new ResizeObserver(() => { if (tiles) render(); }).observe(boardEl);
  deal();
})();
