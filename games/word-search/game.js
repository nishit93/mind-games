(() => {
  const gridEl = document.getElementById('grid');
  const listEl = document.getElementById('words');
  const foundEl = document.getElementById('found');
  const triesEl = document.getElementById('tries');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  const THEMES = {
    'Nature': ['TREE', 'LEAF', 'RIVER', 'CLOUD', 'STONE', 'GRASS', 'FOREST', 'MEADOW', 'BREEZE', 'SUNSET', 'PETAL', 'BRANCH', 'VALLEY', 'OCEAN', 'ISLAND', 'WAVES', 'MOSS', 'FERN', 'POND', 'RAIN'],
    'Food': ['BREAD', 'APPLE', 'MANGO', 'RICE', 'SOUP', 'HONEY', 'LEMON', 'CHEESE', 'NOODLE', 'PEPPER', 'BANANA', 'GRAPE', 'PEACH', 'CARROT', 'BEANS', 'CAKE', 'OLIVE', 'BERRY', 'SALAD', 'TOAST'],
    'Animals': ['TIGER', 'HORSE', 'OTTER', 'EAGLE', 'RABBIT', 'PANDA', 'ZEBRA', 'TURTLE', 'MONKEY', 'FALCON', 'KOALA', 'BEAR', 'FROG', 'SWAN', 'LION', 'GOAT', 'CAMEL', 'SHEEP', 'DONKEY', 'PARROT'],
  };
  // right, down, down-right first; the bigger grids add the backwards and upwards ones.
  const ALL = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];
  const dirsFor = n => (n <= 8 ? ALL.slice(0, 3) : n <= 10 ? ALL.slice(0, 4) : ALL);
  const PER = { 8: 5, 10: 7, 12: 9 };

  let n = MG.kids ? 8 : [8, 10, 12].includes(+MG.store.get('wordsearch-n')) ? +MG.store.get('wordsearch-n') : 8;
  let letters, words, foundSet, tries, cells, done, anchor = null, drag = null;
  window.__wordSearch = () => ({ n, letters, words, foundSet }); // for the site test

  function place(list) {
    const g = new Array(n * n).fill('');
    const dirs = dirsFor(n);
    const placed = [];
    for (const w of [...list].sort((a, b) => b.length - a.length)) {
      let ok = false;
      for (let t = 0; t < 300 && !ok; t++) {
        const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
        const r = Math.floor(Math.random() * n), c = Math.floor(Math.random() * n);
        const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
        if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
        let fits = true;
        for (let k = 0; k < w.length; k++) { const v = g[(r + dr * k) * n + c + dc * k]; if (v && v !== w[k]) { fits = false; break; } }
        if (!fits) continue;
        for (let k = 0; k < w.length; k++) g[(r + dr * k) * n + c + dc * k] = w[k];
        placed.push(w);
        ok = true;
      }
      if (!ok) return null;
    }
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return { g: g.map(v => v || A[Math.floor(Math.random() * 26)]), placed };
  }

  function newGame(size = n) {
    n = size;
    MG.store.set('wordsearch-n', n);
    const themeName = Object.keys(THEMES)[Math.floor(Math.random() * 3)];
    const pool = THEMES[themeName].filter(w => w.length <= n - 1);
    let result = null;
    for (let k = PER[n] || 5; k >= 3 && !result; k--) for (let attempt = 0; attempt < 10 && !result; attempt++) result = place(MG.shuffle(pool.slice()).slice(0, k));
    letters = result.g;
    words = result.placed.sort();
    foundSet = new Set();
    tries = 0;
    done = false;
    anchor = null;
    ov.hide();
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    gridEl.style.fontSize = `${n === 8 ? 1.25 : n === 10 ? 1.05 : 0.9}rem`;
    cells = letters.map((ch, i) => {
      const d = document.createElement('div');
      d.className = 'wc';
      d.textContent = ch;
      d.dataset.i = i;
      return d;
    });
    gridEl.replaceChildren(...cells);
    listEl.replaceChildren(...words.map(w => { const s = document.createElement('span'); s.className = 'ww'; s.textContent = w; s.dataset.w = w; return s; }));
    bestEl.textContent = MG.store.get(`wordsearch-best-${n}`) || '–';
    status.textContent = `Theme: ${themeName}. Drag across a word, or tap its first and last letter.`;
    render();
  }

  function render() {
    foundEl.textContent = `${foundSet.size} of ${words.length}`;
    triesEl.textContent = tries;
    [...listEl.children].forEach(s => s.classList.toggle('got', foundSet.has(s.dataset.w)));
  }

  // The squares on a straight line (any of eight directions) from one square to another, or null if they are not in line.
  function line(a, b) {
    const r1 = Math.floor(a / n), c1 = a % n, r2 = Math.floor(b / n), c2 = b % n;
    const dr = r2 - r1, dc = c2 - c1;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
    const len = Math.max(Math.abs(dr), Math.abs(dc));
    const sr = Math.sign(dr), sc = Math.sign(dc);
    return Array.from({ length: len + 1 }, (_, k) => (r1 + sr * k) * n + c1 + sc * k);
  }

  function mark(sel) { cells.forEach((d, i) => d.classList.toggle('sel', !!sel && sel.includes(i))); }

  function attempt(path) {
    if (done || !path || path.length < 2) return;
    tries++;
    const text = path.map(i => letters[i]).join();
    const word = words.find(w => !foundSet.has(w) && (w.split('').join() === text || w.split('').reverse().join() === text));
    if (word) {
      foundSet.add(word);
      const colour = (foundSet.size - 1) % 6;
      path.forEach(i => { cells[i].classList.add('f', `f${colour}`); });
      status.textContent = `Found ${word}.`;
      if (foundSet.size === words.length) { render(); finish(); return; }
    } else {
      status.textContent = 'Not a word on the list. Try again.';
    }
    render();
  }

  function finish() {
    done = true;
    const prev = +MG.store.get(`wordsearch-best-${n}`);
    const isBest = !prev || tries < prev;
    if (isBest) MG.store.set(`wordsearch-best-${n}`, tries);
    bestEl.textContent = MG.store.get(`wordsearch-best-${n}`);
    ov.win(tries === words.length ? 'Every word, first time' : 'All words found',
      `${tries} tries for ${words.length} words.${isBest ? ' A new best.' : ''}`, 'New puzzle', () => newGame(), 600);
  }

  const cellAt = (x, y) => { const el = gridEl.ownerDocument.elementFromPoint(x, y); return el && el.dataset && el.dataset.i !== undefined && gridEl.contains(el) ? +el.dataset.i : -1; };

  gridEl.addEventListener('pointerdown', e => {
    if (done) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    drag = { from: i, to: i, moved: false };
    try { gridEl.setPointerCapture(e.pointerId); } catch {}
    mark([i]);
  });
  gridEl.addEventListener('pointermove', e => {
    if (!drag) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i === drag.to) return;
    drag.to = i;
    if (i !== drag.from) drag.moved = true;
    mark(line(drag.from, i) || [drag.from]);
  });
  gridEl.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) { const p = line(d.from, d.to); mark(null); attempt(p); anchor = null; return; }
    // a tap: the first tap is the start of a word, the second is its end
    if (anchor === null) { anchor = d.from; mark([d.from]); return; }
    const p = anchor === d.from ? null : line(anchor, d.from);
    anchor = null;
    mark(null);
    if (p) attempt(p);
    else status.textContent = 'Those two letters are not in a straight line.';
  });
  gridEl.addEventListener('pointercancel', () => { drag = null; mark(null); });

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
