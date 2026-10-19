// A complete check of the whole site. Run it before and after every deployment, and read the result in the page
// (or in window.__smoke when driven by a script).
//
// It never trusts a clean browser: the home page and the game pages are also loaded from the saved data of
// someone who played before an update, and with a damaged progress record, because that is where breakages hide.
(async () => {
  const base = new URL('../', location.href).href;
  const params = new URLSearchParams(location.search);
  const lenient = params.has('lenient');   // only require that everything is playable
  const quick = params.has('quick');       // skip the play-throughs
  const results = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const check = (group, name, ok, detail = '') => results.push({ group, name, ok: !!ok, detail: String(detail) });

  // This browser's saved data is put back at the end, whatever happens.
  const snapshot = {};
  for (const k of Object.keys(localStorage)) snapshot[k] = localStorage.getItem(k);
  const seed = data => { localStorage.clear(); for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v); };

  // Saved data as it looked before progress tracking existed, and with damaged records.
  const LEGACY = {
    'sudoku-best-easy': '210000', 'hanoi-n': '4', 'hanoi-best-4': '19', 'fifteen-best-4': JSON.stringify({ moves: 62, ms: 90500 }),
    '2048-best': '2200', 'sequence-best': '5', 'klondike-wins': '2', 'recent': '["sudoku","hanoi"]', 'seen-sudoku': '1', 'queens-found-8': '["01234567"]',
  };
  const STATES = {
    'new visitor': {},
    'returning player (saved scores from before progress existed)': LEGACY,
    'player with a saved progress record': {
      ...LEGACY,
      'mg-progress': JSON.stringify({ state: { favourites: { sudoku: { on: true, t: 5 } }, bests: { 'hanoi-best-4': { v: 19, dir: 'min', t: 5 } }, stats: { 'plays-dabc123': 3 }, settings: {}, days: ['2026-10-01'] } }),
    },
    'damaged progress record': { ...LEGACY, 'mg-progress': '{oops', 'mg-player': 'nonsense', 'mg-device': '' },
    'progress record of the wrong shape': { ...LEGACY, 'mg-progress': JSON.stringify({ state: { favourites: 5, bests: [], days: 'x' } }) },
  };

  async function open(path, wait = 450) {
    const f = document.createElement('iframe');
    f.style.cssText = 'width:375px;height:900px;position:fixed;left:-9999px;top:0;opacity:0';
    f.src = base + path;
    document.body.append(f);
    await new Promise(r => { f.onload = r; setTimeout(r, 8000); });
    await sleep(wait);
    return { d: f.contentDocument, w: f.contentWindow, close: () => f.remove() };
  }
  const winText = d => (d.querySelector('.win.show h2') || {}).textContent || '';

  try {
    // 1. Every file the site and the offline cache depend on can be fetched.
    {
      const sw = await (await fetch(base + 'sw.js', { cache: 'no-store' })).text();
      const files = new Set([...sw.matchAll(/'([^']+\.(?:js|css|png|svg|webmanifest))'/g)].map(m => m[1]).filter(p => p !== 'games.js' || true));
      files.add('index.html');
      for (const g of GAMES) { files.add(`games/${g.id}/`); files.add(`games/${g.id}/game.js`); }
      const bad = [];
      await Promise.all([...files].map(async p => { try { const r = await fetch(base + p, { cache: 'no-store' }); if (!r.ok) bad.push(`${p} (${r.status})`); } catch { bad.push(`${p} (failed)`); } }));
      check('Files', `all ${files.size} files load`, !bad.length, bad.join(', '));
      let manifest = null;
      try { manifest = await (await fetch(base + 'manifest.webmanifest', { cache: 'no-store' })).json(); } catch {}
      check('Files', 'app manifest is valid with icons', manifest && manifest.icons && manifest.icons.length >= 3 && manifest.display === 'standalone');
      const iconBad = [];
      for (const i of (manifest && manifest.icons) || []) { const r = await fetch(base + i.src, { cache: 'no-store' }).catch(() => ({ ok: false })); if (!r.ok) iconBad.push(i.src); }
      check('Files', 'every app icon loads', !iconBad.length, iconBad.join(', '));
    }

    // 2. The home page from each kind of starting state.
    for (const [label, data] of Object.entries(STATES)) {
      seed(data);
      const { d, w, close } = await open('', 700);
      // Every game must be reachable from the home page itself (the menu is not counted).
      const reachable = new Set([...d.querySelectorAll('main a[href*="games/"]')].map(a => (a.getAttribute('href').match(/games\/([a-z0-9-]+)\//) || [])[1]).filter(Boolean));
      check('Home page', `${label}: shows all ${GAMES.length} games`, reachable.size === GAMES.length, `${reachable.size} shown`);
      check('Home page', `${label}: has search`, !!d.getElementById('search'));
      if (!lenient) {
        check('Home page', `${label}: progress features are running`, w.MGProgress && !w.MGProgress._stub, `MGProgress is ${typeof w.MGProgress}${w.MGProgress && w.MGProgress._stub ? ' (fallback)' : ''}`);
        const shelves = [...d.querySelectorAll('.shelf[data-shelf]')].map(s => s.dataset.shelf);
        check('Home page', `${label}: one big pick plus a shelf for every section`, !!d.querySelector('.hero') && SECTIONS.every(s => shelves.includes(s.id)) && shelves.includes('kids'), `shelves: ${shelves.join(', ')}`);
        const height = d.documentElement.scrollHeight;
        check('Home page', `${label}: stays compact (under 2.6 phone screens)`, height <= 2.6 * 812, `${height}px tall`);
        if (label.startsWith('returning')) check('Home page', 'the hero continues the last game played', d.querySelector('.hero b') && d.querySelector('.hero b').textContent === 'Sudoku' && /Continue/.test(d.querySelector('.hero-label').textContent));
        if (label === 'new visitor') check('Home page', 'a new visitor gets a pick for today', d.querySelector('.hero-label') && /pick/i.test(d.querySelector('.hero-label').textContent));
      }
      if (!lenient && label.startsWith('returning')) {
        const st = w.MGProgress && w.MGProgress._state();
        check('Home page', 'old scores and settings are picked up', st && st.bests['sudoku-best-easy'] && st.bests['2048-best'] && st.settings['hanoi-n'] && st.bests['fifteen-best-4'], st ? Object.keys(st.bests).join(',') : 'no state');
      }
      close();
    }

    // 3. Home page features (favourites, filters, search).
    if (!lenient) {
      seed({});
      const { d, w, close } = await open('#logic', 700);
      const logic = GAMES.filter(g => g.sec === 'logic');
      check('Home features', 'See all lists a whole section, with a heart on every row', d.querySelectorAll('.item').length === logic.length && d.querySelectorAll('.heart').length === logic.length, `${d.querySelectorAll('.item').length} rows, ${d.querySelectorAll('.heart').length} hearts`);
      check('Home features', 'See all has a way back', !!d.querySelector('.back'));
      d.querySelector('.heart[data-fav="sudoku"]').click(); await sleep(100);
      check('Home features', 'hearting a game remembers it', w.MGProgress.isFav('sudoku'));
      w.location.hash = '#all'; await sleep(300);
      check('Home features', 'the home page then shows a Your favourites shelf', !!d.querySelector('.shelf[data-shelf="favs"] .gcard'));
      w.location.hash = '#favs'; await sleep(300);
      check('Home features', 'the Favourites list shows it', /Sudoku/.test((d.querySelector('.list') || {}).textContent || ''));
      w.location.hash = '#kids'; await sleep(300);
      check('Home features', 'the Kids list shows every kids game', d.querySelectorAll('.item').length === GAMES.filter(g => g.kids).length);
      w.location.hash = '#math'; await sleep(300);
      check('Home features', 'every section opens its own list', d.querySelectorAll('.item').length === GAMES.filter(g => g.sec === 'math').length);
      w.location.hash = '#all'; await sleep(300);
      const s = d.getElementById('search'); s.value = 'solitaire'; s.dispatchEvent(new Event('input')); await sleep(150);
      check('Home features', 'search finds games', d.querySelectorAll('.item').length >= 3);
      s.value = 'zzzz'; s.dispatchEvent(new Event('input')); await sleep(100);
      check('Home features', 'search says so when nothing matches', !!d.querySelector('.empty'));
      close();
    }

    // 4. Every game page, from a new visitor and from a returning player.
    for (const label of ['new visitor', 'returning player']) {
      seed(label === 'new visitor' ? {} : LEGACY);
      const bad = [];
      for (const g of GAMES) {
        const { d, w, close } = await open(`games/${g.id}/`, 380);
        const problems = [];
        if (!(d.querySelector('h1') && d.querySelector('h1').textContent === g.name)) problems.push('title');
        if (!(w.MG && d.querySelectorAll('.howto h3').length >= 3)) problems.push('how to play');
        if (d.querySelectorAll('main button').length < 3) problems.push('controls');
        if (d.documentElement.scrollWidth > 376) problems.push('too wide for a phone');
        if (!lenient) {
          if (!(w.MGProgress && !w.MGProgress._stub)) problems.push('progress features');
          if (!d.querySelector('.fav-btn')) problems.push('heart');
        }
        if (problems.length) bad.push(`${g.name}: ${problems.join(', ')}`);
        close();
      }
      check('Game pages', `all ${GAMES.length} games work for a ${label}`, !bad.length, bad.join(' | '));
    }

    // 5. Favourites and scores from inside a game.
    if (!lenient) {
      seed({});
      const a = await open('games/golf/', 500);
      const btn = a.d.querySelector('.fav-btn');
      btn.click(); await sleep(100);
      check('Inside a game', 'the heart toggles and remembers', btn.getAttribute('aria-pressed') === 'true' && a.w.MGProgress.isFav('golf'));
      a.w.MG.store.set('hanoi-best-5', '40'); a.w.MG.store.set('hanoi-best-5', '33'); a.w.MG.store.set('hanoi-best-5', '45');
      check('Inside a game', 'only the better score is kept', a.w.MGProgress._state().bests['hanoi-best-5'].v === 33);
      a.d.querySelector('.menu-btn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      check('Inside a game', 'opening the menu does not count as playing', a.w.MGProgress.summary().plays === 0);
      a.d.querySelector('.card').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      check('Inside a game', 'a real tap counts one play', a.w.MGProgress.summary().plays === 1);
      a.close();
      const b = await open('games/golf/', 500);
      check('Inside a game', 'it is all still there after reopening', b.w.MGProgress.isFav('golf') && b.d.querySelector('.fav-btn').getAttribute('aria-pressed') === 'true');
      b.close();
    }

    // 6. Play some games to a win.
    if (!quick) {
      seed({});
      const play = async (name, path, fn) => {
        try { const g = await open(path, 500); const text = await fn(g.d, g.w); check('Play-throughs', `${name} can be won`, text, text || 'no win screen'); g.close(); }
        catch (err) { check('Play-throughs', `${name} can be won`, false, err.message); }
      };
      await play('Tower of Hanoi', 'games/hanoi/', async d => {
        d.querySelector('#size [data-value="3"]').click();
        const pegs = [...d.querySelectorAll('.peg')], moves = [];
        (function h(n, a, b, c) { if (!n) return; h(n - 1, a, c, b); moves.push([a, b]); h(n - 1, c, b, a); })(3, 0, 2, 1);
        for (const [a, b] of moves) { pegs[a].click(); pegs[b].click(); }
        await sleep(900); return winText(d);
      });
      await play('Schulte Table', 'games/schulte-table/', async d => {
        d.querySelector('#size [data-value="3"]').click();
        const B = [...d.querySelectorAll('.sn')];
        for (let v = 1; v <= 9; v++) B.find(b => +b.textContent === v).click();
        await sleep(800); return winText(d);
      });
      await play('Shinkei-suijaku', 'games/memory/', async d => {
        const C = [...d.querySelectorAll('.card-m')], groups = {};
        C.forEach((c, i) => { (groups[c.querySelector('.front').textContent] ||= []).push(i); });
        for (const [x, y] of Object.values(groups)) { C[x].click(); C[y].click(); }
        await sleep(1200); return winText(d);
      });
      await play('Lights Off', 'games/lights-off/', async d => {
        d.querySelector('#size [data-value="3"]').click();
        const L = [...d.querySelectorAll('.light')], on = L.map(b => (b.classList.contains('on') ? 1 : 0));
        const flip = (s, i) => { const r = Math.floor(i / 3), c = i % 3; for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 3 && cc >= 0 && cc < 3) s[rr * 3 + cc] ^= 1; } };
        let sol;
        for (let m = 0; m < 512 && sol === undefined; m++) { const s = on.slice(); for (let i = 0; i < 9; i++) if (m >> i & 1) flip(s, i); if (s.every(v => !v)) sol = m; }
        for (let i = 0; i < 9; i++) if (sol >> i & 1) L[i].click();
        await sleep(800); return winText(d);
      });
      await play('15-Puzzle (and its score is saved)', 'games/15-puzzle/', async (d, w) => {
        d.querySelector('[data-size="3"]').click(); await sleep(100);
        const step = (d.getElementById('board').clientWidth - 16 - 12) / 3 + 6;
        const read = () => { const c = Array(9).fill(0); d.querySelectorAll('.tile').forEach(t => { const m = t.style.transform.match(/translate\(([\d.]+)px, ([\d.]+)px\)/); c[Math.round((m[2] - 8) / step) * 3 + Math.round((m[1] - 8) / step)] = +t.textContent; }); return c; };
        const start = read(), goal = '1,2,3,4,5,6,7,8,0', prev = new Map([[start.join(), null]]);
        let layer = [start], found = null;
        while (layer.length && !found) {
          const next = [];
          for (const s of layer) {
            const g = s.indexOf(0), r = Math.floor(g / 3), c = g % 3;
            for (const p of [r > 0 ? g - 3 : -1, r < 2 ? g + 3 : -1, c > 0 ? g - 1 : -1, c < 2 ? g + 1 : -1]) {
              if (p < 0) continue;
              const t = s.slice(); [t[g], t[p]] = [t[p], t[g]];
              const k = t.join(); if (prev.has(k)) continue;
              prev.set(k, [s.join(), s[p]]);
              if (k === goal) { found = k; break; }
              next.push(t);
            }
            if (found) break;
          }
          layer = next;
        }
        const path = []; for (let k = found; prev.get(k);) { const [p, tile] = prev.get(k); path.unshift(tile); k = p; }
        for (const v of path) [...d.querySelectorAll('.tile')].find(t => +t.textContent === v).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        await sleep(1200);
        const saved = JSON.parse(w.localStorage.getItem('fifteen-best-3') || 'null');
        return d.querySelector('.win.show') && saved && saved.moves === path.length && w.MGProgress._state().bests['fifteen-best-3'] ? 'Well done' : '';
      });
      await play('Colour Flood', 'games/colour-flood/', async d => {
        d.querySelector('#size [data-value="8"]').click();
        for (let k = 0; k < 300; k++) { const sw = [...d.querySelectorAll('.sw:not(:disabled)')]; if (!sw.length) break; sw[Math.floor(Math.random() * sw.length)].click(); }
        await sleep(900); return winText(d);
      });
    }
  } catch (err) {
    check('Test run', 'finished without crashing', false, err.stack || err.message);
  } finally {
    seed(snapshot);
  }

  // Report
  const failed = results.filter(r => !r.ok);
  const out = document.getElementById('out');
  let group = '';
  for (const r of results) {
    if (r.group !== group) { group = r.group; out.insertAdjacentHTML('beforeend', `<h2>${group}</h2>`); }
    const row = document.createElement('div');
    row.className = 'row' + (r.ok ? '' : ' fail');
    row.textContent = `${r.ok ? '✓' : '✗'} ${r.name}`;
    if (r.detail && !r.ok) { const s = document.createElement('small'); s.textContent = r.detail; row.append(s); }
    out.append(row);
  }
  const title = document.getElementById('title');
  title.textContent = failed.length ? `FAIL: ${failed.length} of ${results.length} checks failed` : `PASS: all ${results.length} checks passed`;
  title.className = failed.length ? 'fail' : 'pass';
  document.title = `${failed.length ? 'FAIL' : 'PASS'} · Smoke test`;
  window.__smoke = { pass: !failed.length, total: results.length, failed: failed.length, failures: failed, lenient, quick };
})();
