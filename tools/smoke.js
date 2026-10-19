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
  // Nothing listens on this address, so by default the whole site is tested as if the server were down,
  // and a test can never reach (or create players on) the real server by accident.
  const DEAD_API = 'http://127.0.0.1:9';
  const seed = data => { try { sessionStorage.clear(); } catch {} localStorage.clear(); for (const [k, v] of Object.entries({ 'mg-api': DEAD_API, ...data })) localStorage.setItem(k, v); };
  const restore = () => { try { sessionStorage.clear(); } catch {} localStorage.clear(); for (const [k, v] of Object.entries(snapshot)) localStorage.setItem(k, v); };
  const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(200); } return false; };
  // Real syncing is tested only against a server we are allowed to talk to: the one named in ?api=, or the live site's own.
  const apiUnderTest = params.get('api') || (location.origin === 'https://nishit93.github.io' ? MG_CONFIG.api : '');
  let testCode = '';

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
        if (label.startsWith('returning')) check('Home page', 'the hero continues the last game played', d.querySelector('.hero b') && d.querySelector('.hero b').textContent.trim().startsWith('Sudoku') && /Continue/.test(d.querySelector('.hero-label').textContent));
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
      check('Home features', 'the home page then shows a Your favourites shelf', !!d.querySelector('.lists-shelf .chip[data-chip="favs"]') && !!d.querySelector('.lists-shelf .gcard'));
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
          const hist = d.querySelector('section.history');
          if (!(hist && hist.querySelector('h2') && hist.querySelector('p') && hist.textContent.trim().length > 80)) problems.push('history section');
          if (!d.querySelector('meta[name="description"]') || !d.querySelector('link[rel="canonical"]')) problems.push('description or canonical address');
          try { const ld = JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent); if (!ld['@graph'].some(x => x['@type'] === 'FAQPage') || !ld['@graph'].some(x => x['@type'] === 'VideoGame')) problems.push('structured data'); } catch { problems.push('structured data'); }
        }
        if (!lenient && label === 'new visitor') {
          if (!w.MGTutorial) await sleep(500);
          const miss = w.MGTutorial ? w.MGTutorial.missing() : ['tutorial did not load'];
          if (miss.length) problems.push('tutorial points at ' + miss.join(' and '));
          if (g.kids && !(d.querySelector('.sub .kidbadge') && /Ages \d+–\d+/.test(d.querySelector('.sub .kidbadge').textContent))) problems.push('kids badge');
          if (!g.kids && d.querySelector('.sub .kidbadge')) problems.push('kids badge on a game that is not for kids');
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

    // 6. Saving to a real server and moving progress to another device.
    if (!lenient && apiUnderTest) {
      const authed = code => ({ headers: { authorization: `Bearer ${code}` } });
      seed({ 'mg-api': apiUnderTest });
      const a = await open('games/golf/', 600);
      a.d.querySelector('.fav-btn').click();
      a.d.querySelector('.card').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      a.w.MG.store.set('hanoi-best-5', '33');
      a.w.MGProgress.createList('Smoke list', 'golf');
      const saved = await until(() => a.w.MGProgress.status().status === 'ok' && a.w.MGProgress.status().hasPlayer);
      check('Saving online', 'a first play is saved to the server', saved, `status: ${a.w.MGProgress.status().status}`);
      testCode = a.w.MGProgress.exportCode();
      let server = null;
      try { server = (await (await fetch(`${apiUnderTest}/v1/me`, authed(testCode))).json()).state; } catch {}
      check('Saving online', 'the server holds the favourite and the score', server && server.favourites.golf && server.favourites.golf.on && server.bests['hanoi-best-5'] && server.bests['hanoi-best-5'].v === 33);
      check('Saving online', 'the server holds the player\'s own game list', server && server.lists && Object.values(server.lists).some(l => l.name === 'Smoke list' && l.on && l.games.includes('golf')));
      a.close();

      seed({ 'mg-api': apiUnderTest });
      const b = await open('games/sudoku/', 500);
      check('Saving online', 'a wrong or malformed code is refused and changes nothing', (await b.w.MGProgress.useCode('not a code')) === 'invalid' && (await b.w.MGProgress.useCode('0'.repeat(32) + '.' + 'A'.repeat(43))) === 'unknown' && !b.w.MGProgress.status().hasPlayer);
      const joined = await b.w.MGProgress.useCode(testCode);
      check('Saving online', 'a second device can use the progress code', joined === 'ok', `result: ${joined}`);
      check('Saving online', 'the second device gets the game list', b.w.MGProgress.lists().some(l => l.name === 'Smoke list' && l.games.includes('golf')));
      check('Saving online', 'the second device gets the favourite and the score', b.w.MGProgress.isFav('golf') && b.w.localStorage.getItem('hanoi-best-5') === '33');
      await b.w.MGProgress.eraseOnline();
      const after = await fetch(`${apiUnderTest}/v1/me`, authed(testCode)).then(r => r.status).catch(() => 0);
      check('Saving online', 'erasing online data really erases it and stops syncing', after === 401 && !b.w.MGProgress.status().hasPlayer && !b.w.MGProgress.syncEnabled(), `server answered ${after}`);
      check('Saving online', 'progress stays on the device after erasing', b.w.MGProgress.isFav('golf'));
      b.close();
      testCode = '';
    }
    if (!lenient) {
      // With the server unreachable, the site must carry on and keep everything on the device.
      seed({});
      const c = await open('games/golf/', 500);
      c.d.querySelector('.fav-btn').click();
      c.d.querySelector('.card').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await sleep(2500);
      check('Saving online', 'with the server unreachable, everything still works and is kept on the device', c.w.MGProgress.isFav('golf') && c.w.MGProgress.summary().plays === 1 && ['error', 'offline', 'idle'].includes(c.w.MGProgress.status().status), `status: ${c.w.MGProgress.status().status}`);
      c.close();
    }

    // 7. Play some games to a win.
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
      await play('Lights Off', 'games/lights-off/', async (d, w2) => {
        d.querySelector('#size [data-value="3"]').click();
        const L = [...d.querySelectorAll('.light')], on = L.map(b => (b.classList.contains('on') ? 1 : 0));
        const flip = (s, i) => { const r = Math.floor(i / 3), c = i % 3; for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 3 && cc >= 0 && cc < 3) s[rr * 3 + cc] ^= 1; } };
        let sol;
        for (let m = 0; m < 512 && sol === undefined; m++) { const s = on.slice(); for (let i = 0; i < 9; i++) if (m >> i & 1) flip(s, i); if (s.every(v => !v)) sol = m; }
        for (let i = 0; i < 9; i++) if (sol >> i & 1) L[i].click();
        await sleep(1200);
        if (!lenient) check('Tutorial', 'winning a level retires the tutorial for that game', w2.localStorage.getItem('tut-done-lights-off') === '1');
        if (!lenient) check('Rewards', 'a win shows the celebration and offers the next size', d.querySelector('.win.celebrate .badge') && d.querySelector('.win .next') && !d.querySelector('.win .next').hidden && /4/.test(d.querySelector('.win .next').textContent), (d.querySelector('.win') || {}).className);
        return winText(d);
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

    // 8. Newer behaviour: levels, the how-to box, coming back with Back.
    if (!lenient) {
      const pressed = d => { const b = d.querySelector('#size button[aria-pressed="true"], #level button[aria-pressed="true"]'); return b ? b.dataset.value : null; };
      seed({ 'hanoi-n': '3', 'hanoi-best-3': '7', 'hanoi-best-4': '15' });
      const h = await open('games/hanoi/', 500);
      check('Levels', 'a game opens one level above the highest one won (3 and 4 won, so 5)', pressed(h.d) === '5', 'on level ' + pressed(h.d));
      h.close();
      seed({ 'hanoi-n': '3', 'hanoi-best-3': '7' });
      const hk = await open('games/hanoi/?kids', 500);
      check('Levels', 'from the Kids section it still starts on the easiest level', pressed(hk.d) === '3', 'on level ' + pressed(hk.d));
      hk.close();
      seed({ 'hanoi-best-7': '127' });
      const ht = await open('games/hanoi/', 500);
      check('Levels', 'after the hardest level it stays on the hardest', pressed(ht.d) === '7', 'on level ' + pressed(ht.d));
      ht.close();
      seed({ 'sudoku-best-mini': '100000' });
      const su = await open('games/sudoku/', 500);
      check('Levels', 'a game with named levels moves on too (mini won, so easy)', pressed(su.d) === 'easy', 'on level ' + pressed(su.d));
      su.close();
      seed({ 'fifteen-best-3': JSON.stringify({ moves: 20, ms: 30000 }) });
      const fp = await open('games/15-puzzle/', 500);
      const fpOn = fp.d.querySelector('.seg [aria-pressed="true"]');
      check('Levels', '15-Puzzle moves on after a 3x3 win (to 4x4)', fpOn && fpOn.dataset.size === '4', fpOn ? fpOn.dataset.size : 'none pressed');
      fp.close();
      seed({ 'lvdone-lights-off': '["3"]' });
      const lo = await open('games/lights-off/', 500);
      check('Levels', 'a game without saved scores remembers wins too (3x3 won, so 4x4)', pressed(lo.d) === '4', 'on level ' + pressed(lo.d));
      lo.close();

      seed({});
      const seen = [];
      for (let i = 0; i < 3; i++) { const g = await open('games/golf/', 300); seen.push(g.d.querySelector('.howto').open); g.close(); }
      check('How to play', 'open on the first two visits, folded from the third', seen.join() === 'true,true,false', seen.join());
      const g3 = await open('games/golf/', 300);
      g3.d.querySelector('.help-btn').click();
      check('How to play', 'the ? button opens it again', g3.d.querySelector('.howto').open);
      g3.close();

      seed({});
      const home = await open('', 600);
      const game = await open('games/golf/', 500);
      game.d.querySelector('.fav-btn').click();
      await sleep(400);
      check('Back button', 'a favourite chosen on a game page shows on the open home page without a refresh', !!home.d.querySelector('.lists-shelf .chip[data-chip="favs"]'));
      home.w.localStorage.setItem('recent', '["golf"]');
      home.w.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      await sleep(200);
      check('Back button', 'a page restored by Back redraws with current data', /Golf/.test((home.d.querySelector('.hero b') || {}).textContent || ''));
      game.close(); home.close();
    }

    // 9. Kids badge and kid mode, game lists, focus while playing, and the gesture tutorial.
    if (!lenient) {
      const nonKidLinks = d => [...d.querySelectorAll('#view a[href*="games/"]')].map(a => (a.getAttribute('href').match(/games\/([a-z0-9-]+)\//) || [])[1]).filter(id => id && !GAMES.find(g => g.id === id).kids);

      seed({});
      let h = await open('', 700);
      const kidShelf = h.d.querySelector('.shelf[data-shelf="kids"]');
      check('Kids badge', 'every game in the kids shelf has a badge with its ages, and no star is used', kidShelf && kidShelf.querySelectorAll('.kidbadge').length === GAMES.filter(g => g.kids).length && !/★/.test(h.d.body.textContent));
      h.w.location.hash = '#kids'; await sleep(300);
      check('Kids badge', 'the kids list shows the age range on every row', [...h.d.querySelectorAll('.item')].every(r => /Ages \d+–\d+/.test(r.textContent)) && h.d.querySelectorAll('.item').length === GAMES.filter(g => g.kids).length);
      h.close();

      seed({ 'mg-kidmode': 'on' });
      h = await open('', 700);
      check('Kid mode', 'when on, the home page offers only games for children', nonKidLinks(h.d).length === 0 && h.d.querySelectorAll('.gcard').length > 10 && h.d.body.classList.contains('kidmode'), nonKidLinks(h.d).join());
      check('Kid mode', 'the menu lists only games for children too', [...h.d.querySelectorAll('.drawer-item')].every(a => GAMES.find(g => a.getAttribute('href').includes('/' + g.id + '/')).kids));
      const sInput = h.d.getElementById('search'); sInput.value = 'sudoku'; sInput.dispatchEvent(new Event('input')); await sleep(100);
      const found1 = h.d.querySelectorAll('.item').length;
      sInput.value = 'mahjong'; sInput.dispatchEvent(new Event('input')); await sleep(100);
      check('Kid mode', 'search finds children\'s games but not the others', found1 === 1 && !!h.d.querySelector('.empty'));
      sInput.value = ''; sInput.dispatchEvent(new Event('input'));
      h.d.querySelector('.kidswitch').click(); await sleep(500);
      check('Kid mode', 'switching it off brings every game back', !h.d.body.classList.contains('kidmode') && h.w.localStorage.getItem('mg-kidmode') === 'off' && nonKidLinks(h.d).length > 0);
      h.close();

      seed({ 'mg-kidmode': 'on', 'hanoi-best-3': '7', 'hanoi-best-4': '15' });
      const kh = await open('games/hanoi/', 500);
      const kOn = kh.d.querySelector('#size button[aria-pressed="true"]');
      check('Kid mode', 'a kids game starts on its easiest level', kOn && kOn.dataset.value === '3', kOn && kOn.dataset.value);
      kh.close();
      const kn = await open('games/mahjong-solitaire/', 500);
      check('Kid mode', 'a game for older players says so and offers a way back', !!kn.d.querySelector('.kidbar a') && !!kn.d.querySelector('.kidbar button'));
      kn.d.querySelector('.kidbar button').click();
      check('Kid mode', 'Play anyway dismisses the notice', !kn.d.querySelector('.kidbar'));
      kn.close();

      // Game lists
      seed({});
      const g1 = await open('games/golf/', 500);
      g1.d.querySelector('.list-btn').click(); await sleep(400);
      const sheetRows0 = g1.d.querySelectorAll('.sheet-row').length;
      const nameInput = g1.d.querySelector('.sheet-new input'); nameInput.value = '  Train <b>rides</b> '; g1.d.querySelector('.sheet-new').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await sleep(200);
      const made = g1.w.MGProgress.lists();
      check('Game lists', 'a game can be saved to a new list from its page, and a list name is kept as plain text', sheetRows0 === 1 && made.length === 1 && made[0].games.join() === 'golf' && !/[<>]/.test(made[0].name), JSON.stringify(made));
      const emptyName = g1.d.querySelector('.sheet-new input'); emptyName.value = '   '; g1.d.querySelector('.sheet-new').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await sleep(100);
      check('Game lists', 'a blank name makes no list', g1.w.MGProgress.lists().length === 1);
      g1.d.querySelectorAll('.sheet-row input')[0].click(); await sleep(100);
      check('Game lists', 'Favourites is one of the lists in the sheet', g1.w.MGProgress.isFav('golf'));
      g1.close();

      const listId = made[0].id;
      h = await open('', 700);
      check('Game lists', 'the home page shows Favourites and the list as chips in one row, and the chosen list games below', (() => { const row = h.d.querySelector('.lists-shelf .chips'); const chips = row ? [...row.querySelectorAll('.chip[data-chip]')].map(c => c.dataset.chip) : []; return chips.join() === 'favs,' + listId; })() && (() => { h.d.querySelector('.chip[data-chip="' + listId + '"]').click(); return !!h.d.querySelector('.lists-shelf .gcard') && h.d.querySelector('.chip[aria-pressed="true"]').dataset.chip === listId; })());
      h.w.location.hash = '#lists'; await sleep(400);
      check('Game lists', 'Your lists shows Favourites and the new list', h.d.querySelectorAll('.item').length === 2 && !!h.d.querySelector('[data-newlist]'));
      h.w.location.hash = '#l-' + listId; await sleep(400);
      check('Game lists', 'opening a list shows its games, with a way to remove them', h.d.querySelectorAll('.item').length === 1 && !!h.d.querySelector('[data-remove]') && !!h.d.querySelector('[data-act="rename-list"]'));
      h.d.querySelector('[data-remove]').click(); await sleep(300);
      check('Game lists', 'removing a game from a list works', h.w.MGProgress.lists()[0].games.length === 0 && !!h.d.querySelector('.empty'));
      h.w.MGProgress.setInList(listId, 'sudoku', true);
      h.w.MGProgress.renameList(listId, 'Evening');
      check('Game lists', 'a list can be renamed and added to', h.w.MGProgress.lists()[0].name === 'Evening' && h.w.MGProgress.lists()[0].games.join() === 'sudoku');
      h.w.MGProgress.deleteList(listId); await sleep(200);
      const tomb = h.w.MGProgress._state().lists[listId];
      check('Game lists', 'deleting a list removes it everywhere but leaves a marker so the delete reaches other devices', h.w.MGProgress.lists().length === 0 && tomb && tomb.on === false);
      h.close();

      // Focus while playing
      seed({});
      const f1 = await open('games/golf/', 500);
      f1.d.querySelector('.card').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await sleep(1500);
      const handle = f1.d.querySelector('.focus-handle');
      check('Focus', 'once play starts, the header, rules and links step aside', f1.d.body.classList.contains('focus') && handle && !handle.hidden && f1.w.getComputedStyle(f1.d.querySelector('.howto')).display === 'none' && f1.w.getComputedStyle(f1.d.querySelector('.more')).display === 'none');
      handle.click(); await sleep(200);
      check('Focus', 'the handle brings everything back', !f1.d.body.classList.contains('focus') && f1.w.getComputedStyle(f1.d.querySelector('.howto')).display !== 'none');
      f1.close();
      seed({ 'mg-focus': 'off' });
      const f2 = await open('games/golf/', 500);
      f2.d.querySelector('.card').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await sleep(1500);
      check('Focus', 'it can be turned off in the menu', !f2.d.body.classList.contains('focus'));
      f2.close();

      // Gesture tutorial
      seed({});
      const t1 = await open('games/hanoi/', 1700);
      check('Tutorial', 'a new player sees the gesture demo on arrival', !!t1.d.querySelector('.coach .coach-text') && /peg/i.test(t1.d.querySelector('.coach-text').textContent));
      const stepsBefore = t1.d.querySelectorAll('.coach-steps b').length;
      t1.d.querySelector('.coach-next').click(); await sleep(150);
      check('Tutorial', 'Next moves through the steps', stepsBefore >= 2 && t1.d.querySelector('.coach-steps b.on') === t1.d.querySelectorAll('.coach-steps b')[1]);
      t1.d.querySelector('.peg').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await sleep(600);
      check('Tutorial', 'touching the board makes the demo step aside', !t1.d.querySelector('.coach'));
      t1.d.querySelector('.demo-btn').click(); await sleep(400);
      check('Tutorial', 'the demo button plays it again', !!t1.d.querySelector('.coach'));
      t1.close();
      seed({ 'tut-done-hanoi': '1' });
      const t2 = await open('games/hanoi/', 1700);
      check('Tutorial', 'after a win it is not shown again', !t2.d.querySelector('.coach'));
      t2.close();
      seed({ 'sudoku-best-easy': '300000' });
      const t3 = await open('games/sudoku/', 1700);
      check('Tutorial', 'a returning player with scores does not see it', !t3.d.querySelector('.coach'));
      t3.close();
    }
  } catch (err) {
    check('Test run', 'finished without crashing', false, err.stack || err.message);
  } finally {
    if (testCode && apiUnderTest) { try { await fetch(`${apiUnderTest}/v1/me`, { method: 'DELETE', headers: { authorization: `Bearer ${testCode}` } }); } catch {} }
    restore();
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
