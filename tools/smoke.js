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
  const apiUnderTest = params.has('nosync') ? '' : (params.get('api') || (location.origin === 'https://nishit93.github.io' ? MG_CONFIG.api : ''));   // ?nosync=1 skips the real-server checks (the server allows only 10 new players an hour from one place)
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
        check('Home page', `${label}: one big pick plus a shelf for every section, and no Great for kids shelf`, !!d.querySelector('.hero') && SECTIONS.every(s => shelves.includes(s.id)) && !shelves.includes('kids'), `shelves: ${shelves.join(', ')}`);
        const height = d.documentElement.scrollHeight;
        check('Home page', `${label}: stays a sensible length (under 4.5 phone screens)`, height <= 4.5 * 812, `${height}px tall`);
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
      check('Home features', 'the category row then shows Favourites right after All', !!d.querySelector('#cats .cat[data-chip="favs"]'));
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

    // 3b. Quiet personalisation: every game has a place on the similarity map, and play shapes the order of the home page.
    if (!lenient) {
      const secOrder = d => [...d.querySelectorAll('.shelf[data-shelf]')].map(e => e.dataset.shelf).filter(id => SECTIONS.some(x => x.id === id));
      seed({});
      const p0 = await open('', 700);
      const T0 = p0.w.MGTaste;
      check('Personalisation', 'every game has a place on the similarity map', !!T0 && GAMES.every(g => Array.isArray(T0.VEC[g.id]) && T0.VEC[g.id].length === T0.DIMS.length), T0 ? GAMES.filter(g => !T0.VEC[g.id]).map(g => g.id).join() : 'similarity.js did not load');
      check('Personalisation', 'a new visitor sees the sections in their usual order', secOrder(p0.d).join() === SECTIONS.map(x => x.id).join(), secOrder(p0.d).join());
      const allShelves = [...p0.d.querySelectorAll('.shelf[data-shelf]')].map(e => e.dataset.shelf);
      check('Personalisation', 'the home page has no Great for kids shelf (the Kids chip and the Kid mode switch cover it)', !allShelves.includes('kids'), allShelves.join());
      const logicNames = [...p0.d.querySelectorAll('.shelf[data-shelf="logic"] .gname')].map(e => e.textContent);
      check('Personalisation', 'a new visitor sees every row in plain alphabetical order, so games for children are not bunched at the start', logicNames.join() === [...logicNames].sort((a, b) => a.localeCompare(b)).join(), logicNames.join());
      const logicKids = [...p0.d.querySelectorAll('.shelf[data-shelf="logic"] .gcard')].map(a => !!a.querySelector('.kidbadge'));
      check('Personalisation', 'children\'s games are spread through the row (not all in the first places)', logicKids.indexOf(true) >= 0 && logicKids.lastIndexOf(true) > logicKids.filter(Boolean).length, logicKids.join());
      p0.close();
      seed({ 'mg-taste': JSON.stringify({ hanoi: { n: 25, t: Date.now() }, '15-puzzle': { n: 6, t: Date.now() } }) });
      const p1 = await open('', 700);
      const order1 = secOrder(p1.d);
      check('Personalisation', 'a player who plays Hanoi a lot sees the sliding section first', order1[0] === 'moves' && order1.length === SECTIONS.length, order1.join());
      const movesCards = [...p1.d.querySelectorAll('.shelf[data-shelf="moves"] .gcard')].map(a => a.getAttribute('href'));
      check('Personalisation', 'and Hanoi leads that section', /hanoi/.test(movesCards[0] || ''), movesCards.slice(0, 3).join());
      check('Personalisation', 'every game is still shown once', p1.d.querySelectorAll('.shelf[data-shelf="moves"] .gcard').length === GAMES.filter(g => g.sec === 'moves').length);
      p1.close();
      for (const bad of ['{oops', '[1,2]', '"x"', JSON.stringify({ hanoi: 'many', sudoku: { n: 'x' }, nothing: { n: 5 } })]) {
        seed({ 'mg-taste': bad });
        const pb = await open('', 600);
        check('Personalisation', 'damaged taste data (' + bad.slice(0, 12) + ') changes nothing and breaks nothing', pb.d.querySelectorAll('.gcard').length >= GAMES.filter(g => g.kids).length && secOrder(pb.d).length === SECTIONS.length);
        pb.close();
      }
      seed({});
      const pg = await open('games/hanoi/', 500);
      pg.d.querySelector('.menu-btn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const before = pg.w.localStorage.getItem('mg-taste');
      pg.d.querySelector('.stage').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const t1 = JSON.parse(pg.w.localStorage.getItem('mg-taste') || '{}');
      check('Personalisation', 'a real tap in a game is remembered, the menu is not', before === null && t1.hanoi && t1.hanoi.n === 1, pg.w.localStorage.getItem('mg-taste'));
      pg.close();
    }

    // 3c. For you tab, side-by-side cards on Home, and the menu never opens the keyboard.
    if (!lenient) {
      seed({});
      const f0 = await open('#foryou', 800);
      check('For you', 'the tab bar has For you in place of Today', !!f0.d.querySelector('.tab[data-tab="foryou"]') && !f0.d.querySelector('.tab[data-tab="today"]'));
      check('For you', 'a new visitor is invited to play a few games first', /Play a few games/.test(f0.d.querySelector('#view').textContent), f0.d.querySelector('#view').textContent.slice(0, 120));
      f0.close();
      seed({ 'mg-taste': JSON.stringify({ hanoi: { n: 30, t: Date.now() } }) });
      const f1 = await open('#foryou', 800);
      const hrefs = [...f1.d.querySelectorAll('#view .item-link')].map(a => a.getAttribute('href'));
      check('For you', 'a Hanoi player is offered close games they have not played, such as the 15-Puzzle, and not Hanoi itself', hrefs.some(h => /15-puzzle/.test(h)) && !hrefs.some(h => /\/hanoi\//.test(h)), hrefs.join());
      check('For you', 'far-away games (cards, memory) stay below the cutoff', !hrefs.some(h => /klondike|memory|accordion/.test(h)), hrefs.join());
      check('For you', 'each suggestion says what it is like', /Like Tower of Hanoi/.test(f1.d.querySelector('#view').textContent));
      f1.close();
      seed({});
      const hm = await open('', 700);
      const daily = hm.d.querySelector('.duo .daily'), hero = hm.d.querySelector('.duo .hero');
      const rd = daily && daily.getBoundingClientRect(), rh = hero && hero.getBoundingClientRect();
      check('Home', 'puzzle of the day and continue playing sit side by side', !!rd && !!rh && Math.abs(rd.top - rh.top) < 4 && rd.right <= rh.left + 2, rd && rh ? [rd.top, rh.top, rd.right, rh.left].join() : 'missing');
      hm.d.querySelector('.menu-btn').click(); await sleep(400);
      check('Home', 'opening the menu does not focus the search box (no phone keyboard)', hm.d.activeElement && hm.d.activeElement.tagName !== 'INPUT', hm.d.activeElement && hm.d.activeElement.tagName);
      hm.close();
    }

    // 3d. Light and dark toggle in the home header; Kid mode lives in the menu.
    if (!lenient) {
      seed({});
      const th = await open('', 700);
      const rootEl = th.d.documentElement;
      check('Theme', 'the home header has a light/dark toggle and no Kid mode switch', !!th.d.querySelector('header.top .theme-btn') && !th.d.querySelector('header.top .kidswitch') && !!th.d.querySelector('.drawer [data-sw="kid"]'));
      const before = th.w.getComputedStyle(th.d.body).backgroundColor;
      const startDark = th.w.matchMedia('(prefers-color-scheme: dark)').matches;
      th.d.querySelector('.theme-btn').click(); await sleep(250);
      const after = th.w.getComputedStyle(th.d.body).backgroundColor;
      check('Theme', 'tapping it switches the colours and remembers the choice', rootEl.getAttribute('data-theme') === (startDark ? 'light' : 'dark') && th.w.localStorage.getItem('mg-theme') === (startDark ? 'light' : 'dark') && before !== after, before + ' -> ' + after);
      th.d.querySelector('.theme-btn').click(); await sleep(250);
      check('Theme', 'tapping again goes back', th.w.getComputedStyle(th.d.body).backgroundColor === before);
      th.close();
      seed({ 'mg-theme': 'dark' });
      const td = await open('games/golf/', 600);
      check('Theme', 'a chosen theme applies to game pages too, from the first paint', td.d.documentElement.getAttribute('data-theme') === 'dark' && /rgb\(1[0-9], 2[0-9], 3[0-9]\)/.test(td.w.getComputedStyle(td.d.body).backgroundColor), td.w.getComputedStyle(td.d.body).backgroundColor);
      td.close();
      seed({ 'mg-theme': 'banana' });
      const tb = await open('', 500);
      check('Theme', 'a damaged theme value is ignored', !tb.d.documentElement.getAttribute('data-theme') && tb.d.querySelectorAll('.gcard').length > 10);
      tb.close();
    }

    // 3e. The About page.
    if (!lenient) {
      seed({});
      const ab = await open('#about', 700);
      const txt = ab.d.querySelector('#view').textContent;
      check('About', 'the About page says what the app is, who we are and why it is free', /What this is/.test(txt) && /Who we are/.test(txt) && /Why it is free/.test(txt) && /no ads/i.test(txt));
      check('About', 'the About page has a way back and hides the search and category row', !!ab.d.querySelector('#view .back') && ab.d.body.dataset.view === 'sub' && ab.d.getElementById('cats').hidden);
      check('About', 'the menu links to it', !!ab.d.querySelector('.drawer a[href$="#about"]'));
      ab.close();
      // The menu closes after a link that stays on the same page (no page load does it for us)
      const mn = await open('', 700);
      for (const [sel, hash] of [['.drawer-about', '#about'], ['.drawer-stats', '#stats'], ['.drawer-favs', '#favs'], ['.drawer-lists', '#lists']]) {
        mn.d.querySelector('.menu-btn').click(); await sleep(250);
        const wasOpen = mn.d.body.classList.contains('drawer-open');
        mn.d.querySelector(sel).click(); await sleep(400);
        check('Menu', 'tapping ' + hash + ' in the menu opens it and closes the menu', wasOpen && !mn.d.body.classList.contains('drawer-open') && mn.w.location.hash === hash, 'open before: ' + wasOpen + ', open after: ' + mn.d.body.classList.contains('drawer-open') + ', hash ' + mn.w.location.hash);
      }
      mn.d.querySelector('.menu-btn').click(); await sleep(250);
      mn.d.querySelector('.drawer-about').click(); await sleep(400);
      check('Menu', 'tapping the link for the page you are already on still closes the menu', !mn.d.body.classList.contains('drawer-open'));
      mn.close();
    }

    // 3f. Surprise me is always in the home header; the streak is on the Progress page only.
    if (!lenient) {
      seed({});
      const hs = await open("", 600);
      check("Home header", "a new visitor sees Surprise me", !!hs.d.querySelector("header.top .sub #surprise"));
      hs.close();
      const today = new Date().toISOString().slice(0, 10);
      seed({ "mg-progress": JSON.stringify({ state: { favourites: {}, bests: {}, stats: { "plays-dabc123": 3 }, settings: {}, days: [today], lists: {} } }) });
      const hp = await open("", 700);
      check("Home header", "a player with a streak still sees Surprise me, and no streak line", !!hp.d.querySelector("header.top .sub #surprise") && !/streak/.test(hp.d.querySelector("header.top").textContent), hp.d.querySelector("header.top").textContent.replace(/s+/g, " "));
      hp.close();
      const sp = await open("#stats", 1200);
      check("Home header", "the Progress page shows the streak", /streak/i.test(sp.d.querySelector("#view").textContent));
      sp.close();
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
          if (d.querySelector('#time') || /\bTime\b/.test((d.querySelector('.stats') || { textContent: '' }).textContent)) problems.push('a clock is still shown');
          const hist = d.querySelector('section.history');
          if (!(hist && hist.querySelector('h2') && hist.querySelector('p') && hist.textContent.trim().length > 80)) problems.push('history section');
          if (!d.querySelector('meta[name="description"]') || !d.querySelector('link[rel="canonical"]')) problems.push('description or canonical address');
          try { const ld = JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent); if (!ld['@graph'].some(x => x['@type'] === 'FAQPage') || !ld['@graph'].some(x => x['@type'] === 'VideoGame')) problems.push('structured data'); } catch { problems.push('structured data'); }
        }
        if (!lenient && label === 'new visitor') {
          if (!w.MGTutorial) { const demoBtn = d.querySelector('.demo-btn'); if (demoBtn) demoBtn.click(); await sleep(900); }   // the demo only loads when asked for
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
      check('Back button', 'a favourite chosen on a game page shows on the open home page without a refresh', !!home.d.querySelector('#cats .cat[data-chip="favs"]'));
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
      const kl = await open('#kids', 700);
      check('Kids badge', 'every game on the Kids page has a badge with its ages, and no star is used', kl.d.querySelectorAll('#view .item .kidbadge').length === GAMES.filter(g => g.kids).length && !/★/.test(kl.d.body.textContent));
      kl.close();
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
      h.d.querySelector('[data-sw="kid"]').click(); await sleep(500);
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
      check('Game lists', 'the category row shows All, then Favourites and the list, before the sections', (() => { const hs = [...h.d.querySelectorAll('#cats .cat')].map(c => c.getAttribute('href')); return hs[0] === '#all' && hs[1] === '#favs' && hs[2] === '#l-' + listId && hs[hs.length - 1] === '#kids'; })());
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

      // Focus while playing: starts with the first real change to the board, not with a plain tap
      seed({});
      const f1 = await open('games/golf/', 500);
      f1.d.querySelector('.card').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await sleep(1500);
      check('Focus', 'a plain tap does not start it', !f1.d.body.classList.contains('focus') && !f1.d.body.classList.contains('focus-in'));
      f1.d.querySelector('.stage').append(f1.d.createElement('i')); await sleep(2400);
      const handle = f1.d.querySelector('.focus-handle:not(.focus-fav):not(.focus-list)');
      check('Focus', 'the first change to the board starts it: header, rules and links step aside', f1.d.body.classList.contains('focus') && handle && f1.w.getComputedStyle(f1.d.querySelector('.focus-dock')).display !== 'none' && f1.w.getComputedStyle(f1.d.querySelector('.howto')).visibility === 'hidden' && f1.w.getComputedStyle(f1.d.querySelector('.more')).visibility === 'hidden');
      const favB = f1.d.querySelector('.focus-fav'), listB = f1.d.querySelector('.focus-list');
      check('Focus', 'the heart and list buttons stay within reach', !!favB && !!listB);
      favB.click(); await sleep(150);
      check('Focus', 'the heart works while focused', f1.w.MGProgress.isFav('golf') && favB.getAttribute('aria-pressed') === 'true');
      listB.click(); await sleep(400);
      check('Focus', 'the list button opens the save sheet', !!f1.d.querySelector('.sheet-wrap .sheet'));
      f1.d.querySelector('.sheet-done').click(); await sleep(400);
      handle.click(); await sleep(300);
      check('Focus', 'the handle brings everything back', !f1.d.body.classList.contains('focus') && f1.w.getComputedStyle(f1.d.querySelector('.howto')).visibility !== 'hidden');
      f1.close();
      seed({ 'mg-focus': 'off' });
      const f2 = await open('games/golf/', 500);
      f2.d.querySelector('.card').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); f2.d.querySelector('.stage').append(f2.d.createElement('i')); await sleep(1500);
      check('Focus', 'it can be turned off in the menu', !f2.d.body.classList.contains('focus'));
      f2.close();

      // Gesture tutorial: only when asked for
      seed({});
      const t1 = await open('games/hanoi/', 1700);
      check('Tutorial', 'a new player is not interrupted by the demo on arrival', !t1.d.querySelector('.coach'));
      t1.d.querySelector('.demo-btn').click(); await sleep(500);
      check('Tutorial', 'the demo button plays it', !!t1.d.querySelector('.coach .coach-text') && /peg/i.test(t1.d.querySelector('.coach-text').textContent));
      const stepsBefore = t1.d.querySelectorAll('.coach-steps b').length;
      t1.d.querySelector('.coach-next').click(); await sleep(150);
      check('Tutorial', 'Next moves through the steps', stepsBefore >= 2 && t1.d.querySelector('.coach-steps b.on') === t1.d.querySelectorAll('.coach-steps b')[1]);
      t1.d.querySelector('.peg').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await sleep(600);
      check('Tutorial', 'touching the board makes the demo step aside', !t1.d.querySelector('.coach'));
      t1.close();
    }

    // 10. Folded menu, stats page, puzzle of the day, and the new games.
    if (!lenient) {
      // the menu keeps categories folded, except the one being played
      seed({});
      let m = await open('games/sudoku/', 400);
      const groups = [...m.d.querySelectorAll('.drawer-group')];
      check('Menu', 'categories are folded groups, and only the current game\'s category is open', groups.length === SECTIONS.length && groups.filter(g => g.open).length === 1 && groups.find(g => g.open).querySelector('.drawer-item.current'));
      const ms = m.d.querySelector('.drawer-search'); ms.value = 'tower'; ms.dispatchEvent(new m.w.Event('input')); await sleep(100);
      const found = groups.filter(g => !g.hidden);
      check('Menu', 'searching opens the group that holds the match and hides the rest', found.length === 1 && found[0].open && found[0].querySelector('.drawer-item:not([hidden])').textContent.includes('Hanoi'));
      ms.value = ''; ms.dispatchEvent(new m.w.Event('input')); await sleep(100);
      check('Menu', 'clearing the search folds them again', groups.filter(g => g.open).length === 1 && groups.every(g => !g.hidden));
      m.close();

      // stats page
      seed({ ...LEGACY, 'mg-progress': JSON.stringify({ state: { favourites: {}, bests: { 'sudoku-best-easy': { v: 210000, dir: 'min', t: 5 }, 'hanoi-best-4': { v: 19, dir: 'min', t: 5 }, '2048-best': { v: 2200, dir: 'max', t: 5 } }, stats: { 'plays-dabc123': 3, 'klondike-wins': 2 }, settings: {}, days: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-07'] } }) });
      let h = await open('', 700);
      h.w.location.hash = '#stats'; await until(() => h.d.querySelector('.stat-tile'), 10000);
      const tiles = [...h.d.querySelectorAll('.st-num')].map(b => b.textContent);
      check('Stats', 'the stats page shows streak, longest streak, days played and games played', tiles.length >= 4 && tiles[1] === '3' && tiles[2] === '4', tiles.join());
      check('Stats', 'it opens with the streak as one big number', !!h.d.querySelector('.st-big .st-num'));
      check('Stats', 'it shows a calendar of recent days', !!h.d.querySelector('.cal') && h.d.querySelectorAll('.cal i').length > 90);
      const text = h.d.getElementById('view').textContent;
      check('Stats', 'best results are shown in plain words: a time, moves, a score and wins', /Sudoku/.test(text) && /3:30/.test(text) && /19 moves/.test(text) && /2200/.test(text) && /Klondike/.test(text) && /2\b/.test(text), text.slice(0, 300));
      h.close();
      seed({});
      h = await open('#stats', 900);
      await until(() => /Finish a puzzle/.test(h.d.getElementById('view').textContent), 10000);
      check('Stats', 'with nothing played, it says so kindly instead of showing a blank page', /Finish a puzzle/.test(h.d.getElementById('view').textContent));
      h.close();

      // puzzle of the day
      const today = dailyDate();
      seed({});
      h = await open('', 700);
      const strip = h.d.querySelector('.daily');
      check('Puzzle of the day', 'the home page offers today\'s puzzle, with a link that carries the date', strip && strip.getAttribute('href').endsWith('?daily=' + today), strip && strip.getAttribute('href'));
      const pickId = (strip.getAttribute('href').match(/games\/([a-z0-9-]+)\//) || [])[1];
      check('Puzzle of the day', 'the menu links to it as well', !!h.d.querySelector('.drawer-daily') && h.d.querySelector('.drawer-daily').getAttribute('href').includes('?daily=' + today));
      h.close();
      seed({ 'mg-kidmode': 'on' });
      h = await open('', 700);
      const kidPick = (h.d.querySelector('.daily').getAttribute('href').match(/games\/([a-z0-9-]+)\//) || [])[1];
      check('Puzzle of the day', 'in kid mode the puzzle is always a game for children', !!GAMES.find(g => g.id === kidPick && g.kids), kidPick);
      h.close();

      const sig = async path => { const f = await open(path, 450); const out = f.d.querySelector('.stage, .board').innerHTML.replace(/\s+/g, ' '); f.close(); return out; };
      seed({ 'lights-n': '3' });
      const d1 = await sig('games/lights-off/?daily=' + today), d2 = await sig('games/lights-off/?daily=' + today), p1 = await sig('games/lights-off/'), p2 = await sig('games/lights-off/'), p3 = await sig('games/lights-off/'), p4 = await sig('games/lights-off/');
      // a small 3x3 board can repeat by chance, so four plain games must not all be the same
      check('Puzzle of the day', 'everyone gets the same puzzle on the same day, and normal games stay random', d1 === d2 && new Set([p1, p2, p3, p4]).size > 1);
      check('Puzzle of the day', 'it is played on its own level, and the player\'s own saved level is untouched', d1.split('class="light').length - 1 === 25 && localStorage.getItem('lights-n') === '3', localStorage.getItem('lights-n'));
      seed({});
      const oldPage = await open('games/lights-off/?daily=2001-01-01', 450);
      check('Puzzle of the day', 'a daily link for another day is ignored (a normal game opens)', !oldPage.d.querySelector('.dailybar'));
      oldPage.close();

      // play today's puzzle to the end (a 5x5 Lights Off, solved by "chasing the lights")
      seed({});
      const dp = await open('games/lights-off/?daily=' + today, 600);
      check('Puzzle of the day', 'the page says it is the puzzle of the day', !!dp.d.querySelector('.dailybar') && /Puzzle of the day/.test(dp.d.querySelector('.dailybar').textContent));
      dp.d.querySelector('#new').click(); await sleep(200);
      check('Puzzle of the day', 'new-game controls ask before replacing the day\'s puzzle', !!dp.d.querySelector('.sheet-wrap') && /Leave the puzzle of the day/.test(dp.d.querySelector('.sheet-wrap').textContent));
      dp.d.querySelector('.sheet-wrap button').click(); await sleep(400);
      const L = [...dp.d.querySelectorAll('.light')], n = 5;
      const state = L.map(b => (b.classList.contains('on') ? 1 : 0));
      let plan = null;
      for (let mask = 0; mask < 32 && !plan; mask++) {
        const st = state.slice(), presses = [];
        const flip = i => { const r = Math.floor(i / n), c = i % n; for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < n && cc >= 0 && cc < n) st[rr * n + cc] ^= 1; } presses.push(i); };
        for (let c = 0; c < n; c++) if (mask >> c & 1) flip(c);
        for (let r = 1; r < n; r++) for (let c = 0; c < n; c++) if (st[(r - 1) * n + c]) flip(r * n + c);
        if (st.every(v => !v)) plan = presses;
      }
      if (plan) for (const i of plan) L[i].click();
      await sleep(1300);
      check('Puzzle of the day', 'solving it marks the day as done and says so on the win card', !!plan && JSON.parse(dp.w.localStorage.getItem('mg-daily') || '[]').includes(today) && /Puzzle of the day done/.test((dp.d.querySelector('.win .extra') || {}).textContent || ''), (dp.d.querySelector('.win .extra') || {}).textContent);
      dp.close();
      h = await open('', 700);
      check('Puzzle of the day', 'the home page then shows today as done, with a streak', !!h.d.querySelector('.daily.done') && /✓/.test(h.d.querySelector('.daily small').textContent), (h.d.querySelector('.daily') || {}).className);
      h.close();

      // the new games
      seed({});
      const playNew = async (name, path, fn) => {
        try { const g = await open(path, 500); const text = await fn(g.d, g.w); check('New games', name + ' can be played to the end', text, text || 'no result'); g.close(); }
        catch (err) { check('New games', name + ' can be played to the end', false, err.message); }
      };
      await playNew('Maze', 'games/maze/', async (d, w) => {
        d.querySelector('#size [data-value="7"]').click(); await sleep(150);
        const cells = [...d.querySelectorAll('.mc')], N = 7;
        const open = (i, dir) => { const c = cells[i].classList; const r = Math.floor(i / N), col = i % N; return dir === 'u' ? !c.contains('u') && r > 0 && i - N : dir === 'd' ? !c.contains('d') && r < N - 1 && i + N : dir === 'l' ? !c.contains('l') && col > 0 && i - 1 : !c.contains('r') && col < N - 1 && i + 1; };
        const prev = new Map([[0, null]]), queue = [0];
        for (let k = 0; k < queue.length; k++) for (const dir of ['u', 'd', 'l', 'r']) { const nx = open(queue[k], dir); if (nx !== false && nx !== 0 && !prev.has(nx)) { prev.set(nx, [queue[k], dir]); queue.push(nx); } }
        const path = []; for (let i = N * N - 1; prev.get(i); i = prev.get(i)[0]) path.unshift(prev.get(i)[1]);
        const keyOf = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' };
        for (const dir of path) d.dispatchEvent(new w.KeyboardEvent('keydown', { key: keyOf[dir], bubbles: true }));
        await sleep(1100);
        return d.querySelector('.win.show') && /fewest possible/.test(d.querySelector('.win p').textContent) && +d.querySelector('#moves').textContent === path.length ? 'Solved' : '';
      });
      await playNew('One Stroke (every shape has a route that uses each line once)', 'games/one-stroke/', async (d, w) => {
        const shapes = w.__oneStrokeShapes;
        for (let lv = 0; lv < shapes.length; lv++) {
          d.querySelector('#level [data-value="' + lv + '"]').click(); await sleep(150);
          const { pts, edges } = shapes[lv];
          // find a route with a depth-first search: use every line exactly once
          const used = new Set(), key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
          const dfs = (cur, trail) => {
            if (used.size === edges.length) return trail;
            for (const [a, b] of edges) { const k = key(a, b); if (used.has(k) || (a !== cur && b !== cur)) continue; used.add(k); const r = dfs(a === cur ? b : a, [...trail, a === cur ? b : a]); if (r) return r; used.delete(k); }
            return null;
          };
          let route = null; for (let st = 0; st < pts.length && !route; st++) route = dfs(st, [st]);
          if (!route) return '';
          const nodes = [...d.querySelectorAll('.nd')];
          for (const p of route) { nodes[p].click(); }
          await sleep(900);
          if (!(d.querySelector('.win.show') && +d.querySelector('#moves').textContent === edges.length)) return '';
          d.querySelector('.win .btn').click(); await sleep(200);
        }
        return 'Every shape solved';
      });
      await playNew('Next in Line', 'games/next-in-line/', async (d, w) => {
        for (let k = 0; k < 4; k++) {
          const q = w.__nextInLine();
          if (!q || q.shown.length !== 5 || !q.options.includes(q.answer) || new Set(q.options).size !== 4) return '';
          [...d.querySelectorAll('.opt')].find(b => +b.textContent === q.answer).click();
          await sleep(1700);
        }
        if (+d.querySelector('#streak').textContent !== 4) return '';
        const q = w.__nextInLine();
        [...d.querySelectorAll('.opt')].find(b => +b.textContent !== q.answer).click();
        await sleep(1500);
        return d.querySelector('.win.show h2') && /4 in a row/.test(d.querySelector('.win.show h2').textContent) && w.localStorage.getItem('nextline-best') === '4' ? 'Run ended and saved' : '';
      });
      await playNew('Odd One Out', 'games/odd-one-out/', async (d, w) => {
        for (let k = 0; k < 3; k++) {
          const sq = [...d.querySelectorAll('.sq')], count = {};
          sq.forEach(b => { count[b.style.background] = (count[b.style.background] || 0) + 1; });
          const odd = sq.find(b => count[b.style.background] === 1);
          if (!odd) return '';
          odd.click(); await sleep(900);
        }
        return +d.querySelector('#level').textContent === 4 && w.localStorage.getItem('oddone-best') === '3' ? 'Three levels' : '';
      });
      await playNew('Colour Word', 'games/colour-word/', async (d, w) => {
        for (let k = 0; k < 10; k++) {
          const ink = w.getComputedStyle(d.getElementById('word')).color;
          const key = [...d.querySelectorAll('.ckey')].find(b => w.getComputedStyle(b).backgroundColor === ink);
          if (!key) return '';
          key.click(); await sleep(650);
        }
        await sleep(600);
        return d.querySelector('.win.show h2') && /10 of 10/.test(d.querySelector('.win.show h2').textContent) ? 'Ten of ten' : '';
      });
      await playNew('Word Search', 'games/word-search/', async (d, w) => {
        const { n, letters, words } = w.__wordSearch();
        const cells = [...d.querySelectorAll('.wc')];
        const press = i => { const r = cells[i].getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 3 }; cells[i].dispatchEvent(new w.PointerEvent('pointerdown', o)); cells[i].dispatchEvent(new w.PointerEvent('pointerup', o)); };
        for (const word of words) {
          let spot = null;
          for (let r = 0; r < n && !spot; r++) for (let c = 0; c < n && !spot; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]]) {
            let ok = true; for (let k = 0; k < word.length && ok; k++) { const rr = r + dr * k, cc = c + dc * k; ok = rr >= 0 && rr < n && cc >= 0 && cc < n && letters[rr * n + cc] === word[k]; }
            if (ok) { spot = [r * n + c, (r + dr * (word.length - 1)) * n + c + dc * (word.length - 1)]; break; }
          }
          if (!spot) return '';
          press(spot[0]); press(spot[1]);
        }
        await sleep(1200);
        return d.querySelector('.win.show') && +d.querySelector('#tries').textContent >= words.length ? 'All words found' : '';
      });
      await playNew('Free Cells (a position that only needs the Finish button)', 'games/free-cells/', async (d, w) => {
        const card = (rank, suit) => ({ id: suit * 13 + rank, rank, suit });
        const found = [0, 1, 2, 3].map(suit => Array.from({ length: 11 }, (_, i) => card(i + 1, suit)));
        const tab = [0, 1, 2, 3].map(suit => [card(13, suit), card(12, suit)]).concat([[], [], [], []]);
        w.__freeCells.load({ cells: [null, null, null, null], found, tab });
        await sleep(200);
        const btn = [...d.querySelectorAll('#table .btn')].find(b => b.textContent === 'Finish');
        if (!btn) return '';
        btn.click(); await sleep(2200);
        return d.querySelector('.win.show') && w.localStorage.getItem('freecells-wins') === '1' ? 'Finished' : '';
      });
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
