// A brute-force stress test of the whole site. Where smoke.html checks that things work, this tries to break them:
// random taps, swipes and keys on every game, every level, odd and damaged saved data, saved storage that refuses to
// write, odd list names, very narrow phones, and every tutorial. It fails on any script error, on "NaN" or "undefined"
// showing on screen, on sideways overflow, and on a button with no name.
//
// Pages are loaded into frames with an error catcher put in before their own scripts, so nothing that happens while a page
// starts can slip past. Results are in the page and in window.__stress.
(async () => {
  const base = new URL('../', location.href).href;
  const params = new URLSearchParams(location.search);
  const run = (params.get('run') || 'games,flows,states,tutorial,layout').split(',');
  const from = +params.get('from') || 0, to = +params.get('to') || GAMES.length;
  const taps = +params.get('taps') || 60;
  const games = GAMES.slice(from, to);
  const results = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const check = (group, name, ok, detail = '') => results.push({ group, name, ok: !!ok, detail: String(detail).slice(0, 600) });
  window.__errs = [];
  const errsSince = n => window.__errs.slice(n);

  const snapshot = {};
  for (const k of Object.keys(localStorage)) snapshot[k] = localStorage.getItem(k);
  const DEAD_API = 'http://127.0.0.1:9';
  const seed = data => { try { sessionStorage.clear(); } catch {} localStorage.clear(); for (const [k, v] of Object.entries({ 'mg-api': DEAD_API, ...data })) localStorage.setItem(k, v); };
  const restore = () => { try { sessionStorage.clear(); } catch {} localStorage.clear(); for (const [k, v] of Object.entries(snapshot)) localStorage.setItem(k, v); };

  const LEGACY = {
    'sudoku-best-easy': '210000', 'hanoi-n': '4', 'hanoi-best-4': '19', 'fifteen-best-4': JSON.stringify({ moves: 62, ms: 90500 }),
    '2048-best': '2200', 'sequence-best': '5', 'klondike-wins': '2', 'recent': '["sudoku","hanoi"]', 'seen-sudoku': '1', 'queens-found-8': '["01234567"]',
  };
  // Every saved value the site knows about, set to something a person (or a bug in an old version) could have left there.
  const GARBAGE = () => {
    const o = {
      'recent': 'not json', 'mg-chip': 'zzz', 'mg-focus': '??', 'mg-kidmode': 'maybe', 'mg-device': '', 'mg-player': '{', 'mg-sync': 'weird', 'mg-last-sync': 'x',
      'mg-progress': JSON.stringify({ state: { favourites: { sudoku: 7, golf: { on: 'yes' } }, bests: { a: { v: 'x' }, 'hanoi-best-3': { v: -1, dir: 'up' } },
        lists: { x: 5, y: { name: 1, games: 'no' }, z: { name: 'ok', games: [1, null, 'sudoku'], on: true, t: 'x' } }, days: 'x', stats: [], settings: 3 } }),
    };
    for (const [key, v] of Object.entries(LEVELS)) { o[v[0]] = 'banana'; if (v[1]) for (const n of ['0', '1', '2', '3', '4', '5', '6', '7', '8', 'easy', 'mini', 'forward']) o[v[1] + n] = n % 2 ? 'NaN' : '{oops'; }
    for (const g of GAMES) { o['seen-' + g.id] = 'abc'; o['tut-done-' + g.id] = 'x'; o['lvdone-' + g.id] = '{oops'; }
    Object.assign(o, { '2048-best': '-5', 'golf-best': 'x', 'pegs-best': '1e999', 'sequence-best': '', 'sequence-speed': 'warp', 'sequence-sound': '??', 'klondike-draw': '9', 'span-mode': 'sideways', 'queens-shade': 'purple', 'queens-found-8': '[[[' });
    return o;
  };

  // ---- Frames ----
  // opts.storage: 'throws' (setItem refuses) or 'denied' (localStorage itself throws), like private browsing in some browsers.
  async function open(path, { width = 375, height = 800, wait = 450, storage = '' } = {}) {
    window.name = 'at ' + path + ' ' + storage + ' ' + (window.__kind || '');   // a breadcrumb, readable even if a page freezes
    const html = await (await fetch(base + path, { cache: 'no-store' })).text();
    const hook = `<base href="${base + path}"><script>
      window.addEventListener('error', function (e) { parent.__errs.push((e.message || 'error') + ' @' + String(e.filename || '').split('/').slice(-2).join('/') + ':' + e.lineno); });
      window.addEventListener('unhandledrejection', function (e) { parent.__errs.push('promise: ' + ((e.reason && e.reason.message) || e.reason)); });
      var ce = console.error; console.error = function () { parent.__errs.push('console.error: ' + [].slice.call(arguments).map(String).join(' ').slice(0, 220)); ce.apply(console, arguments); };
      ${storage === 'throws' ? "Storage.prototype.setItem = function () { throw new DOMException('Quota', 'QuotaExceededError'); };" : ''}
      ${storage === 'denied' ? "Object.defineProperty(window, 'localStorage', { get: function () { throw new DOMException('denied', 'SecurityError'); } }); Object.defineProperty(window, 'sessionStorage', { get: function () { throw new DOMException('denied', 'SecurityError'); } });" : ''}
    <\/script>`;
    const f = document.createElement('iframe');
    f.style.cssText = `width:${width}px;height:${height}px;position:fixed;left:-99999px;top:0;opacity:0;border:0`;
    document.body.append(f);
    f.srcdoc = html.replace('<head>', '<head>' + hook);
    await new Promise(r => { f.onload = r; setTimeout(r, 9000); });
    await sleep(wait);
    return { d: f.contentDocument, w: f.contentWindow, f, close: () => f.remove() };
  }

  const badText = d => { const t = (d.body && d.body.innerText) || ''; const m = t.match(/.{0,25}(\bNaN\b|undefined|\[object|\bnull\b).{0,25}/s); return m ? m[0].replace(/\s+/g, ' ') : ''; };
  const badWhere = d => { const re = /\bNaN\b|undefined|\[object|\bnull\b/; const tw = d.createTreeWalker(d.body, 4); let n; while ((n = tw.nextNode())) { if (re.test(n.nodeValue) && n.parentElement && getComputedStyle(n.parentElement).display !== 'none' && !n.parentElement.closest('script,style,noscript,[hidden]')) { const chain = []; for (let e = n.parentElement; e && chain.length < 5; e = e.parentElement) chain.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : '')); return chain.join('<'); } } return ''; };
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && el.offsetParent !== null; };
  const SKIP = 'header.top,.drawer,.scrim,.howto,.more,.history,.coach,.sheet-wrap,.focus-handle,.kidbar,.demo-btn,.install,#progress,a[href]';

  async function hammer(g, n) {
    const { d, w } = g;
    const pool = () => [...d.querySelectorAll('main .stage *, main .board *, main .controls *, main .actions *, main .pad *, main .keypad *, main .swatches *, main button')].filter(el => !el.closest(SKIP) && !el.disabled && visible(el) && el.children.length < 8);
    const fire = (el, x, y) => {
      const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0 };
      for (const t of ['pointerdown', 'mousedown']) el.dispatchEvent(new (t.startsWith('pointer') ? w.PointerEvent : w.MouseEvent)(t, o));
      for (const t of ['pointerup', 'mouseup', 'click']) el.dispatchEvent(new (t.startsWith('pointer') ? w.PointerEvent : w.MouseEvent)(t, o));
    };
    const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '1', '2', '3', '4', '5', '0', '9', 'Backspace', 'Enter', ' ', 'z', 'u', 'r', 'Escape'];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      try {
        if (r < 0.12) d.dispatchEvent(new w.KeyboardEvent('keydown', { key: KEYS[Math.floor(Math.random() * KEYS.length)], bubbles: true }));
        else if (r < 0.22) {
          const stage = d.querySelector('.stage, .board'); if (!stage) continue;
          const b = stage.getBoundingClientRect(); const x0 = b.left + b.width * Math.random(), y0 = b.top + b.height * Math.random();
          const el = d.elementFromPoint(x0, y0) || stage; const ang = Math.random() * 6.28;
          const o = (x, y) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 2, pointerType: 'touch', isPrimary: true });
          el.dispatchEvent(new w.PointerEvent('pointerdown', o(x0, y0)));
          for (const k of [1, 2, 3]) el.dispatchEvent(new w.PointerEvent('pointermove', o(x0 + Math.cos(ang) * 30 * k, y0 + Math.sin(ang) * 30 * k)));
          el.dispatchEvent(new w.PointerEvent('pointerup', o(x0 + Math.cos(ang) * 90, y0 + Math.sin(ang) * 90)));
        } else {
          const win = d.querySelector('.win.show button.btn');
          const p = win && Math.random() < 0.5 ? [win] : pool();
          if (!p.length) continue;
          const el = p[Math.floor(Math.random() * p.length)];
          const b = el.getBoundingClientRect();
          fire(el, b.left + b.width / 2, b.top + b.height / 2);
        }
      } catch (err) { window.__errs.push('test harness: ' + err.message); }
      if (i % 8 === 7) await sleep(30);
    }
  }

  const wide = (d, w) => {
    const max = w.innerWidth + 1;
    return [...d.querySelectorAll('main *')].filter(el => {
      if (el.closest('.rail,.chips,.drawer,.scrim,.coach,.sheet-wrap,[hidden]') || getComputedStyle(el).position === 'fixed') return false;
      for (let p = el.parentElement; p && p !== d.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return false; }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > max;
    }).slice(0, 3).map(el => (el.tagName + '.' + (el.className || '')).slice(0, 40));
  };
  const unnamed = d => [...d.querySelectorAll('button, [role="button"], a')].filter(b => !b.closest('[hidden]') && b.ownerDocument.defaultView.getComputedStyle(b).visibility !== 'hidden' && !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.title && !b.querySelector('img[alt]')).slice(0, 3).map(b => (b.tagName + '.' + (b.className || '')).slice(0, 40));

  try {
    // ===== 1. Every game: random taps, swipes and keys; every level button; then odd storage =====
    if (run.includes('games')) {
      const problems = [];
      for (const g of games) {
        seed({});
        const e0 = window.__errs.length;
        const p = await open(`games/${g.id}/`, { wait: 500 });
        const issues = [];
        await hammer(p, taps);
        // every level, size or mode button
        const segBtns = [...p.d.querySelectorAll('.seg')].flatMap(s => [...s.querySelectorAll('button')]);
        for (const b of segBtns) {
          b.click(); await sleep(120);
          if (badText(p.d)) issues.push(`"${badText(p.d)}" after choosing ${b.textContent.trim()}`);
          if (!p.d.querySelector('.stage, .board') || !p.d.querySelector('.stage, .board').childElementCount) issues.push(`empty board after ${b.textContent.trim()}`);
          await hammer(p, 10);
        }
        if (badText(p.d)) issues.push(`"${badText(p.d)}" on screen`);
        if (!p.d.querySelector('.stage, .board') || !p.d.querySelector('.stage, .board').childElementCount) issues.push('empty board');
        const ov = wide(p.d, p.w); if (ov.length) issues.push('sideways overflow: ' + ov.join(' '));
        const errs = errsSince(e0); if (errs.length) issues.push('errors: ' + [...new Set(errs)].slice(0, 3).join(' | '));
        if (issues.length) problems.push(`${g.name}: ${issues.join('; ')}`);
        p.close();
      }
      check('Every game', `${games.length} games survive ${taps} random taps, swipes and keys plus every level button`, !problems.length, problems.join(' || '));
    }

    // ===== 2. Every game from odd starting states, and with storage that refuses to work =====
    if (run.includes('states')) {
      const kinds = {
        'a returning player': LEGACY, 'kid mode': { 'mg-kidmode': 'on' }, 'damaged and nonsense saved data': GARBAGE(),
        'a player who finished everything': Object.fromEntries(GAMES.flatMap(g => [['tut-done-' + g.id, '1'], ['seen-' + g.id, '9']])),
      };
      for (const [label, data] of Object.entries(kinds)) {
        const problems = [];
        for (const g of games) {
          window.__kind = label; seed(data);
          const e0 = window.__errs.length;
          const p = await open(`games/${g.id}/`, { wait: 420 });
          const issues = [];
          await hammer(p, 20);
          if (badText(p.d)) issues.push(`"${badText(p.d)}" on screen`);
          if (!p.d.querySelector('.stage, .board') || !p.d.querySelector('.stage, .board').childElementCount) issues.push('empty board');
          const errs = errsSince(e0); if (errs.length) issues.push([...new Set(errs)].slice(0, 2).join(' | '));
          if (issues.length) problems.push(`${g.name}: ${issues.join('; ')}`);
          p.close();
        }
        check('Odd starting states', `every game opens and plays for ${label}`, !problems.length, problems.join(' || '));
      }
      for (const mode of ['throws', 'denied']) {
        const problems = [];
        for (const g of games) {
          seed({});
          const e0 = window.__errs.length;
          const p = await open(`games/${g.id}/`, { wait: 420, storage: mode });
          const issues = [];
          await hammer(p, 20);
          if (!p.d.querySelector('.stage, .board') || !p.d.querySelector('.stage, .board').childElementCount) issues.push('empty board');
          if (!p.d.querySelector('h1')) issues.push('no title');
          const errs = errsSince(e0); if (errs.length) issues.push([...new Set(errs)].slice(0, 2).join(' | '));
          if (issues.length) problems.push(`${g.name}: ${issues.join('; ')}`);
          p.close();
        }
        check('Odd starting states', mode === 'throws' ? 'every game plays when the browser refuses to save anything (storage full)' : 'every game plays when the browser forbids storage altogether (some private modes)', !problems.length, problems.join(' || '));
      }
      for (const mode of ['', 'throws', 'denied']) {
        seed({ 'recent': '["sudoku"]' });
        const e0 = window.__errs.length;
        const h = await open('', { wait: 700, storage: mode });
        const ok = h.d.querySelectorAll('#view a[href*="games/"]').length >= GAMES.length - 5 && !badText(h.d);
        check('Odd starting states', `the home page draws${mode ? (mode === 'throws' ? ' when storage refuses writes' : ' when storage is forbidden') : ' normally'}`, ok && !errsSince(e0).length, errsSince(e0).join(' | ') || `${h.d.querySelectorAll('#view a[href*="games/"]').length} games linked`);
        h.close();
      }
      for (const [label, data] of Object.entries({ 'nonsense saved data': GARBAGE(), 'a huge list collection': { 'mg-progress': JSON.stringify({ state: { lists: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`l${i}`, { name: `List ${i} ` + 'x'.repeat(i), games: GAMES.map(g => g.id), on: true, t: i }])) } }) } })) {
        seed(data);
        const e0 = window.__errs.length;
        const h = await open('', { wait: 700 });
        const ok = h.d.querySelector('#view') && h.d.querySelector('#view').children.length > 0 && !badText(h.d);
        for (const hash of ['#lists', '#favs', '#kids', '#logic', '#all']) { h.w.location.hash = hash; await sleep(250); if (!h.d.querySelector('#view').children.length) { check('Odd starting states', `home view ${hash} is empty with ${label}`, false); } }
        check('Odd starting states', `the home page and every view survive ${label}`, ok && !errsSince(e0).length, errsSince(e0).join(' | '));
        h.close();
      }
    }

    // ===== 3. Flows: lists, kid mode, routes, focus, sheets, Back =====
    if (run.includes('flows')) {
      // lists fuzz through the progress API
      seed({});
      let h = await open('', { wait: 600 });
      const MGP = h.w.MGProgress, e0 = window.__errs.length;
      const names = ['', '   ', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'a'.repeat(120), '😀 Train rides', '‮evil‬', 'dup', 'dup', 'quote " and \' and &amp;', '\u0000\u0001ctrl', 'ünï©ode', 12345, null, undefined, {}];
      const ids = [];
      for (const n of names) { try { const id = MGP.createList(n, Math.random() < 0.5 ? 'golf' : undefined); if (id) ids.push(id); } catch (err) { window.__errs.push('createList threw: ' + err.message); } }
      const made = MGP.lists();
      check('Lists', 'odd list names are cleaned: no markup characters, no control characters, at most 40 long, blank names refused', made.every(l => l.name.length > 0 && l.name.length <= 40 && !/[<>\u0000-\u001f]/.test(l.name)) && made.length >= 5, JSON.stringify(made.map(l => l.name)));
      for (const id of ids) for (const g of GAMES) MGP.setInList(id, g.id, true);
      check('Lists', 'a list holds at most 60 games and never the same game twice', MGP.lists().every(l => l.games.length <= 60 && new Set(l.games).size === l.games.length));
      for (let i = 0; i < 60; i++) MGP.createList('Extra ' + i);
      check('Lists', 'no more than 30 lists can be made', MGP.lists().length <= 30, MGP.lists().length);
      h.w.location.hash = '#lists'; await sleep(400);
      check('Lists', 'the Your lists page shows odd names as plain text (no injected elements)', !h.d.querySelector('#view script, #view img') && h.d.querySelectorAll('#view .item').length === MGP.lists().length + 1);
      for (const l of MGP.lists().slice(0, 6)) { h.w.location.hash = '#l-' + l.id; await sleep(250); if (!h.d.querySelector('#view .view-title')) check('Lists', 'a list page does not open: ' + l.name, false); }
      h.w.location.hash = '#all'; await sleep(300);
      check('Lists', 'the home chip row shows Favourites first, then every list', (() => { const c = [...h.d.querySelectorAll('.lists-shelf .chip[data-chip]')].map(x => x.dataset.chip); return c[0] === 'favs' && c.length === MGP.lists().length + 1; })());
      for (const c of [...h.d.querySelectorAll('.lists-shelf .chip[data-chip]')].slice(0, 8)) { c.click(); await sleep(60); }
      for (const l of MGP.lists()) MGP.deleteList(l.id);
      await sleep(200);
      check('Lists', 'deleting every list leaves none and the home page still draws', MGP.lists().length === 0 && h.d.querySelectorAll('#view .shelf').length > 3 && !h.d.querySelector('.lists-shelf [data-chip]:not([data-chip="favs"])'));
      check('Lists', 'no errors in any of that', !errsSince(e0).length, errsSince(e0).join(' | '));
      h.close();

      // random operations on the home page itself
      seed({ 'recent': '["sudoku"]' });
      h = await open('', { wait: 600 });
      const e1 = window.__errs.length;
      const hashes = ['#all', '#lists', '#favs', '#kids', '#logic', '#math', '#moves', '#memory', '#cards', '#zzz', '#l-nope', '#', '#l-', '#lists?x=1', '#%E0%A4%A'];
      const clickables = () => [...h.d.querySelectorAll('#view button, .kidswitch')].filter(visible);
      for (let i = 0; i < 400; i++) {
        const r = Math.random();
        try {
          if (r < 0.2) h.w.location.hash = hashes[Math.floor(Math.random() * hashes.length)];
          else if (r < 0.3) { const s = h.d.getElementById('search'); s.value = ['', 'a', 'sud', 'zzzz', '<b>', 'ma'][Math.floor(Math.random() * 6)]; s.dispatchEvent(new h.w.Event('input')); }
          else if (r < 0.34) h.d.querySelector('.kidswitch').click();
          else if (r < 0.40) { const f = h.d.querySelector('[data-newlist]'); if (f) { f.querySelector('input').value = 'L' + i; f.dispatchEvent(new h.w.Event('submit', { cancelable: true, bubbles: true })); } }
          else { const c = clickables(); if (c.length) { const el = c[Math.floor(Math.random() * c.length)]; if (!el.matches('[data-act="rename-list"],[data-act="delete-list"],[data-act="erase"],[data-act="use"],[data-act="copy"]')) el.click(); } }
        } catch (err) { window.__errs.push('harness: ' + err.message); }
        if (document.querySelector('iframe') && h.d.querySelector('.sheet-wrap')) h.d.querySelector('.sheet-wrap').remove();
        if (i % 20 === 19) await sleep(60);
      }
      await sleep(300);
      check('Home flows', '400 random home-page actions (routes, search, hearts, lists, chips, kid mode): no errors, never blank, no NaN or undefined', !errsSince(e1).length && h.d.querySelector('#view') && h.d.querySelector('#view').children.length > 0 && !badText(h.d), errsSince(e1).join(' | ') || (badText(h.d) + ' IN ' + badWhere(h.d)));
      h.close();

      // kid mode round trip on the home page and in the menu
      seed({});
      h = await open('', { wait: 600 });
      const e2 = window.__errs.length;
      const states = [];
      for (let i = 0; i < 6; i++) { h.d.querySelector('.kidswitch').click(); await sleep(150); states.push(h.d.body.classList.contains('kidmode') + ':' + h.d.querySelectorAll('.drawer-item').length + ':' + new Set([...h.d.querySelectorAll('#view .gcard')].map(a => a.getAttribute('href'))).size); }
      check('Kid mode', 'switching kid mode on and off six times keeps the page, menu and storage in step', states.join() === 'true:22:' + states[0].split(':')[2] + ',false:38:' + states[1].split(':')[2] + ',true:22:' + states[0].split(':')[2] + ',false:38:' + states[1].split(':')[2] + ',true:22:' + states[0].split(':')[2] + ',false:38:' + states[1].split(':')[2] && !errsSince(e2).length, states.join(' ') + ' ' + errsSince(e2).join(' | '));
      h.close();

      // the save sheet, opened and closed again and again
      seed({});
      let g = await open('games/hanoi/', { wait: 500 });
      const e3 = window.__errs.length;
      for (let i = 0; i < 12; i++) {
        g.d.querySelector('.list-btn').click(); await sleep(80);
        const inp = g.d.querySelector('.sheet-new input');
        if (inp && i % 3 === 0) { inp.value = 'Mix ' + i; g.d.querySelector('.sheet-new').dispatchEvent(new g.w.Event('submit', { cancelable: true, bubbles: true })); }
        const boxes = [...g.d.querySelectorAll('.sheet-row input')]; if (boxes.length) boxes[i % boxes.length].click();
        g.d.dispatchEvent(new g.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(300);
      }
      check('Lists', 'opening, using and closing the save sheet twelve times leaves no stray sheet and no errors', !g.d.querySelector('.sheet-wrap') && !errsSince(e3).length, errsSince(e3).join(' | '));
      g.close();

      // focus: enter, leave with the handle and with Esc, and it is entered only once per visit
      seed({});
      g = await open('games/lights-off/', { wait: 500 });
      const e4 = window.__errs.length;
      g.d.querySelector('.light').dispatchEvent(new g.w.PointerEvent('pointerdown', { bubbles: true })); await sleep(1500);
      const entered = g.d.body.classList.contains('focus');
      g.d.dispatchEvent(new g.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(150);
      const left = !g.d.body.classList.contains('focus');
      g.d.querySelector('.light').dispatchEvent(new g.w.PointerEvent('pointerdown', { bubbles: true })); await sleep(1500);
      check('Focus', 'focus is entered on first touch, Esc leaves it, and it does not jump back in during the same visit', entered && left && !g.d.body.classList.contains('focus') && !errsSince(e4).length, `${entered} ${left} ${errsSince(e4).join(' | ')}`);
      g.close();
      // plays are counted once, and not for taps on the menu or the sheet
      seed({});
      g = await open('games/lights-off/', { wait: 500 });
      for (const sel of ['.menu-btn', '.list-btn', '.help-btn']) g.d.querySelector(sel).dispatchEvent(new g.w.PointerEvent('pointerdown', { bubbles: true }));
      await sleep(100);
      const before = g.w.MGProgress.summary().plays;
      for (let i = 0; i < 5; i++) g.d.querySelector('.light').dispatchEvent(new g.w.PointerEvent('pointerdown', { bubbles: true }));
      await sleep(100);
      check('Flows', 'five taps on the board count as exactly one play, and the menu, + and ? buttons count as none', before === 0 && g.w.MGProgress.summary().plays === 1, `${before} then ${g.w.MGProgress.summary().plays}`);
      g.close();

      // Back button: the page restored from memory shows what changed meanwhile
      seed({});
      h = await open('', { wait: 600 });
      const e5 = window.__errs.length;
      h.w.localStorage.setItem('mg-progress', JSON.stringify({ state: { favourites: { golf: { on: true, t: Date.now() } }, bests: {}, stats: {}, settings: {}, days: [], lists: { lab1: { name: 'Away', games: ['hanoi'], on: true, t: Date.now() } } } }));
      h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow', { persisted: true })); await sleep(300);
      const chips = [...h.d.querySelectorAll('.lists-shelf .chip[data-chip]')].map(c => c.dataset.chip).join();
      check('Back button', 'a page restored from memory picks up a favourite and a list changed in the meantime', chips === 'favs,lab1' && !errsSince(e5).length, chips + ' ' + errsSince(e5).join(' | '));
      h.close();
    }

    // ===== 4. Every tutorial: play it through, check the dot stays on screen =====
    if (run.includes('tutorial')) {
      const problems = [];
      for (const g of games) {
        seed({});
        const e0 = window.__errs.length;
        const p = await open(`games/${g.id}/`, { wait: 300 });
        const issues = [];
        try {
          if (!p.w.MGTutorial) await sleep(600);
          if (!p.w.MGTutorial) { issues.push('tutorial script did not load'); }
          else {
            p.w.MGTutorial.start({ force: true }); await sleep(250);
            const total = p.d.querySelectorAll('.coach-steps b').length;
            if (total < 1) issues.push('no steps');
            for (let s = 0; s < total; s++) {
              const text = (p.d.querySelector('.coach-text') || {}).textContent || '';
              if (text.trim().length < 10) issues.push(`step ${s + 1} has no text`);
              // Read where the dot is going from its animation (a hidden test frame does not draw, so it cannot be watched on screen).
              await sleep(400);
              const dot = p.d.querySelector('.coach-dot'), layer = p.d.querySelector('.coach-layer');
              if (dot && !layer.hidden) {
                const spots = [];
                for (const an of dot.getAnimations()) for (const kf of an.effect.getKeyframes()) { const m = String(kf.transform || '').match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/); if (m) spots.push([+m[1], +m[2]]); }
                if (!spots.length) issues.push(`step ${s + 1}: the dot has nowhere to go`);
                for (const [x, y] of spots) if (x < -40 || y < -40 || x > p.w.innerWidth + 40 || y > p.w.innerHeight + 40) issues.push(`step ${s + 1}: the dot is off screen at ${Math.round(x)},${Math.round(y)}`);
              }
              const card = p.d.querySelector('.coach-card').getBoundingClientRect();
              const stage = p.d.querySelector('.stage, .board').getBoundingClientRect();
              if (card.top < stage.top + 40 && stage.height > 150 && card.height > 0 && card.bottom > stage.top + stage.height * 0.6 && s === 0) issues.push('the text card covers most of the board');
              p.d.querySelector('.coach-next').click(); await sleep(120);
            }
            if (p.d.querySelector('.coach:not(.leaving)')) issues.push('the demo did not close after the last step');
          }
        } catch (err) { issues.push('threw: ' + err.message); }
        const errs = errsSince(e0); if (errs.length) issues.push([...new Set(errs)].slice(0, 2).join(' | '));
        if (issues.length) problems.push(`${g.name}: ${issues.join('; ')}`);
        p.close();
      }
      check('Tutorials', `every tutorial plays through to the end with the dot on screen (${games.length} games)`, !problems.length, problems.join(' || '));
    }

    // ===== 5. Layout on narrow and wide screens, names on every button =====
    if (run.includes('layout')) {
      for (const width of [320, 375, 414, 768, 1100]) {
        const problems = [];
        for (const g of games) {
          seed({ 'tut-done-x': '1' });
          const e0 = window.__errs.length;
          const p = await open(`games/${g.id}/`, { width, height: width < 700 ? 760 : 900, wait: 300 });
          const issues = [];
          const ov = wide(p.d, p.w); if (ov.length) issues.push('overflow ' + ov.join(' '));
          if (p.d.documentElement.scrollWidth > width + 1) issues.push(`page is ${p.d.documentElement.scrollWidth}px wide`);
          const un = unnamed(p.d); if (un.length) issues.push('unnamed ' + un.join(' '));
          const small = [...p.d.querySelectorAll('header.top button, header.top a.btn')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.width < 36 || r.height < 36); });
          if (small.length) issues.push('tap target under 36px: ' + small.map(b => b.className).join(' '));
          const title = p.d.querySelector('header.top .title'), btns = [...p.d.querySelectorAll('header.top > button')];
          if (title) for (const b of btns) { const a = title.getBoundingClientRect(), c = b.getBoundingClientRect(); if (a.right > c.left + 1 && a.left < c.right - 1 && a.bottom > c.top && a.top < c.bottom) issues.push('title overlaps ' + (b.getAttribute('aria-label') || b.className)); }
          if (!p.d.documentElement.lang) issues.push('no lang');
          const errs = errsSince(e0); if (errs.length) issues.push([...new Set(errs)].slice(0, 2).join(' | '));
          if (issues.length) problems.push(`${g.name}: ${issues.join('; ')}`);
          p.close();
        }
        check('Layout', `all ${games.length} game pages fit at ${width}px wide, with no unnamed buttons, small tap targets or overlaps`, !problems.length, problems.join(' || '));
      }
      for (const [label, data] of Object.entries({ 'a new visitor': {}, 'a player with favourites and lists': { 'mg-progress': JSON.stringify({ state: { favourites: { sudoku: { on: true, t: 1 }, hanoi: { on: true, t: 1 }, golf: { on: true, t: 1 } }, lists: { l1: { name: 'Train rides with a rather long name', games: ['sudoku', 'golf', 'pipes'], on: true, t: 1 }, l2: { name: 'Kids', games: [], on: true, t: 1 } } } }), 'recent': '["sudoku"]' }, 'kid mode': { 'mg-kidmode': 'on' } })) {
        const problems = [];
        for (const width of [320, 375, 414, 768, 1100]) {
          seed(data);
          const p = await open('', { width, wait: 700 });
          const issues = [];
          const ov = wide(p.d, p.w); if (ov.length) issues.push('overflow ' + ov.join(' '));
          if (p.d.documentElement.scrollWidth > width + 1) issues.push(`page is ${p.d.documentElement.scrollWidth}px wide`);
          const un = unnamed(p.d); if (un.length) issues.push('unnamed ' + un.join(' '));
          for (const hash of ['#lists', '#favs', '#kids', '#logic']) {
            p.w.location.hash = hash; await sleep(250);
            const o2 = wide(p.d, p.w); if (o2.length) issues.push(hash + ' overflow ' + o2.join(' '));
            const un2 = unnamed(p.d); if (un2.length) issues.push(hash + ' unnamed ' + un2.join(' '));
          }
          if (issues.length) problems.push(`${width}px: ${issues.join('; ')}`);
          p.close();
        }
        check('Layout', `the home page and its lists fit every screen width for ${label}`, !problems.length, problems.join(' || '));
      }
    }
  } catch (err) {
    check('Test run', 'finished without crashing', false, err.stack || err.message);
  } finally {
    restore();
  }

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
  title.textContent = failed.length ? `FAIL: ${failed.length} of ${results.length} stress checks failed` : `PASS: all ${results.length} stress checks passed`;
  title.className = failed.length ? 'fail' : 'pass';
  document.title = `${failed.length ? 'FAIL' : 'PASS'} · Stress test`;
  window.__stress = { pass: !failed.length, total: results.length, failed: failed.length, failures: failed, errors: window.__errs.slice(0, 50) };
})();
