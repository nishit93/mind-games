// Shared page shell: header, games menu, how-to toggle, and small helpers the games use (window.MG).
(() => {
  // If progress.js is missing or failed to start, carry on without favourites, streaks and sync
  // rather than breaking the page. Nothing else may depend on it being there.
  if (!window.MGProgress) {
    window.MGProgress = {
      _stub: true,
      mirror() {}, recordPlay() {}, toggleFav: () => false, onChange() {}, setSyncEnabled() {}, refresh() {},
      isFav: () => false, favs: () => [], configured: () => false, syncEnabled: () => false, exportCode: () => '',
      lists: () => [], collections: () => [], createList: () => null, renameList: () => false, deleteList() {}, inList: () => false, setInList: () => false,
      summary: () => ({ streak: 0, plays: 0, favourites: 0, days: 0 }),
      status: () => ({ status: 'off', lastSync: 0, hasPlayer: false }),
      sync: async () => 'off', useCode: async () => 'error', eraseOnline: async () => {},
      _state: () => ({ favourites: {}, bests: {}, stats: {}, settings: {}, days: [], lists: {} }),
    };
  }
  const root = new URL('.', document.currentScript.src).href;
  const game = GAMES.find(g => g.id === document.body.dataset.game);
  const main = document.querySelector('main');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) {
      try { localStorage.setItem(k, v); } catch {}
      try { MGProgress.mirror(k, v); } catch (err) { console.error(err); } // scores and settings are also kept in the progress record
    },
    json(k) { try { return JSON.parse(store.get(k)); } catch { return null; } },
  };

  const fmt = ms => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const section = game && SECTIONS.find(s => s.id === game.sec);
  // Kid mode (a switch the player turns on) shows only the games for children, and every game then starts on its easiest
  // setting, like the Kids section does. It is kept on this device only.
  const isKidMode = () => store.get('mg-kidmode') === 'on';
  const kidMode = isKidMode();
  // Opened from the Kids section, or kid mode is on: games start on their easiest setting.
  const kids = new URLSearchParams(location.search).has('kids') || kidMode;
  document.body.classList.toggle('kidmode', kidMode);
  const href = (g, kidsLink = false) => `${root}games/${g.id}/${kidsLink && g.kids ? '?kids' : ''}`;
  const icon = g => `<span class="mini sec-${g.sec}${g.icon.length > 2 ? ' small' : ''}" aria-hidden="true">${g.icon}</span>`;

  // The kids badge: a small smiling face and the age range, so it is clear which games are meant for children.
  const FACE = '<svg class="face" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><circle cx="5.6" cy="6.7" r="1"/><circle cx="10.4" cy="6.7" r="1"/><path d="M4.9 9.7c.9 1.7 5.3 1.7 6.2 0"/></svg>';
  const ageText = g => (g && g.ages ? `${g.ages[0]}–${g.ages[1]}` : '');
  const badge = (g, short = false) => g && g.kids
    ? `<span class="kidbadge${short ? ' sm' : ''}" title="Made for children aged ${g.ages ? `${g.ages[0]} to ${g.ages[1]}` : '6 to 11'}">${FACE}<span>${ageText(g) ? `${short ? '' : 'Ages '}${ageText(g)}` : 'Kids'}</span></span>`
    : '';
  const visible = g => !kidMode || !!g.kids;

  // Remember recently played games for the home page.
  if (game) {
    const recent = (store.json('recent') || []).filter(id => id !== game.id);
    store.set('recent', JSON.stringify([game.id, ...recent].slice(0, 6)));
  }

  // Header
  const header = document.createElement('header');
  header.className = 'top';
  header.innerHTML = `
    <button class="icon-btn menu-btn" aria-label="Open games menu" aria-controls="drawer" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <div class="title">
      <h1>${game ? game.name : 'Mind Games'}</h1>
      <p class="sub">${game ? `${game.origin} · <a href="${root}#${section.id}">${section.name}</a>${game.kids ? ` ${badge(game)}` : ''}` : 'Quiet puzzles from around the world.'}</p>
    </div>
    ${game
      ? `${MGProgress._stub ? '' : '<button class="icon-btn fav-btn" aria-label="Add to favourites" aria-pressed="false">♡</button><button class="icon-btn list-btn" aria-label="Save to a list">＋</button>'}<button class="icon-btn help-btn" aria-label="How to play">?</button>`
      : `<button class="kidswitch" role="switch" aria-checked="${kidMode}" title="Kid mode shows only games for children up to 11">${FACE}<span>Kid mode</span><i class="knob" aria-hidden="true"></i></button>`}`;
  main.prepend(header);

  // Kid mode switch: reloads a game (so it starts on its easiest setting); the home page redraws itself.
  function setKidMode(on) {
    store.set('mg-kidmode', on ? 'on' : 'off');
    if (game) { location.reload(); return; }
    document.body.classList.toggle('kidmode', on);
    const sw = header.querySelector('.kidswitch');
    if (sw) sw.setAttribute('aria-checked', String(on));
    fillDrawer();
    document.dispatchEvent(new CustomEvent('mg-kidmode'));
  }
  const kidSwitch = header.querySelector('.kidswitch');
  if (kidSwitch) kidSwitch.addEventListener('click', () => setKidMode(!isKidMode()));

  // A sheet that opens from the bottom to save a game to Favourites or to one of the player's lists.
  function saveSheet(gameId) {
    const g = GAMES.find(x => x.id === gameId);
    if (!g || MGProgress._stub) return;
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<div class="sheet-scrim"></div><div class="sheet" role="dialog" aria-modal="true"><h2>Save to a list</h2><p class="sheet-sub"></p><div class="sheet-rows"></div>'
      + '<form class="sheet-new"><input maxlength="40" placeholder="New list, for example Train rides" aria-label="Name of a new list" autocomplete="off"><button class="btn" type="submit">Create</button></form>'
      + '<button class="btn ghost sheet-done" type="button">Done</button></div>';
    wrap.querySelector('.sheet').setAttribute('aria-label', `Save ${g.name} to a list`);
    wrap.querySelector('.sheet-sub').textContent = g.name;
    document.body.append(wrap);
    const rows = wrap.querySelector('.sheet-rows'), input = wrap.querySelector('input');
    const draw = () => {
      rows.textContent = '';
      MGProgress.collections().forEach(c => {
        const label = document.createElement('label');
        label.className = 'sheet-row';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = MGProgress.inList(c.id, g.id);
        box.addEventListener('change', () => { MGProgress.setInList(c.id, g.id, box.checked); draw(); });
        const name = document.createElement('span');
        name.textContent = `${c.fav ? '♥ ' : ''}${c.name}`;
        const n = document.createElement('small');
        n.textContent = `${c.games.length} game${c.games.length === 1 ? '' : 's'}`;
        label.append(box, name, n);
        rows.append(label);
      });
    };
    draw();
    const close = () => { document.removeEventListener('keydown', onKey, true); wrap.classList.add('leaving'); setTimeout(() => wrap.remove(), 250); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    wrap.querySelector('.sheet-scrim').addEventListener('click', close);
    wrap.querySelector('.sheet-done').addEventListener('click', close);
    wrap.querySelector('.sheet-new').addEventListener('submit', e => {
      e.preventDefault();
      if (MGProgress.createList(input.value, g.id)) { input.value = ''; draw(); }
      else { input.classList.add('bad'); setTimeout(() => input.classList.remove('bad'), 600); }
    });
    requestAnimationFrame(() => wrap.classList.add('open'));
    wrap.querySelector('.sheet-done').focus({ preventScroll: true });
  }

  // Heart: favourite this game. Plus: save it to a list.
  if (game && !MGProgress._stub) {
    const fav = header.querySelector('.fav-btn');
    const drawFav = () => {
      const on = MGProgress.isFav(game.id);
      fav.textContent = on ? '♥' : '♡';
      fav.setAttribute('aria-pressed', String(on));
      fav.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
    };
    fav.addEventListener('click', () => MGProgress.toggleFav(game.id));
    header.querySelector('.list-btn').addEventListener('click', () => saveSheet(game.id));
    MGProgress.onChange(drawFav);
    drawFav();
  }

  // Focus: once play begins, everything except the game steps aside (the header, rules, history and links). A small
  // handle brings it all back. It can be turned off in the menu, and it is entered once per visit.
  let focusing = false, focusLeft = false;
  const focusOn = () => store.get('mg-focus') !== 'off';
  const handle = document.createElement('button');
  if (game) {
    handle.className = 'focus-handle';
    handle.hidden = true;
    handle.setAttribute('aria-label', 'Show the menu, rules and more');
    handle.innerHTML = '<span aria-hidden="true">⌃</span>';
    document.body.append(handle);
  }
  function setFocus(on) {
    focusing = on;
    document.body.classList.toggle('focus', on);
    handle.hidden = !on;
    if (!on) focusLeft = true;
  }
  handle.addEventListener('click', () => setFocus(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && focusing) setFocus(false); });

  // The first real touch of a game counts as a play, and starts focus. Touches on the menu, header, how-to or sheets do not count.
  if (game) {
    const onFirstTouch = e => {
      if (e.target.closest && e.target.closest('header.top, .drawer, .scrim, .howto, .more, .history, .coach, .sheet-wrap, .focus-handle, .kidbar')) return;
      if (e.type === 'keydown' && ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      removeEventListener('pointerdown', onFirstTouch, true);
      removeEventListener('keydown', onFirstTouch, true);
      try { MGProgress.recordPlay(); } catch (err) { console.error(err); }
      if (focusOn() && !focusLeft) setTimeout(() => { if (!focusLeft) setFocus(true); }, 900);
    };
    addEventListener('pointerdown', onFirstTouch, true);
    addEventListener('keydown', onFirstTouch, true);
  }

  // Games menu: switches, then search, then the games grouped by section.
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const drawer = document.createElement('nav');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  drawer.setAttribute('aria-label', 'Games');
  document.body.append(scrim, drawer);

  function fillDrawer() {
    const km = isKidMode();
    drawer.innerHTML = `
    <a class="drawer-home" href="${root}">Mind Games</a>
    <div class="drawer-switches">
      <button class="switch" role="switch" data-sw="kid" aria-checked="${km}"><span>Kid mode<small>Only games for children up to 11</small></span><i class="knob" aria-hidden="true"></i></button>
      ${game ? `<button class="switch" role="switch" data-sw="focus" aria-checked="${focusOn()}"><span>Focus while playing<small>Hide everything else once you start</small></span><i class="knob" aria-hidden="true"></i></button>` : ''}
    </div>
    <input class="search drawer-search" type="search" placeholder="Find a game" aria-label="Find a game">
    ${km ? '' : `<a class="drawer-kids" href="${root}#kids">${FACE} Great for kids</a>`}
    <a class="drawer-kids drawer-favs" href="${root}#favs">♥ Favourites</a>
    <a class="drawer-kids drawer-lists" href="${root}#lists">☰ Your lists</a>
    ${SECTIONS.map(s => {
      const games = GAMES.filter(g => g.sec === s.id && (!km || g.kids));
      return games.length ? `
      <div class="drawer-group">
        <a class="drawer-heading" href="${root}#${s.id}">${s.name}</a>
        ${games.map(g => `
          <a class="drawer-item${g === game ? ' current' : ''}" href="${href(g)}" data-name="${g.name.toLowerCase()} ${g.origin.toLowerCase()} ${s.name.toLowerCase()}"${g === game ? ' aria-current="page"' : ''}>
            ${icon(g)}
            <span><b>${g.name}${g.kids ? ` ${badge(g, true)}` : ''}</b><small>${g.origin}</small></span>
          </a>`).join('')}
      </div>` : '';
    }).join('')}
    <p class="drawer-empty" hidden>No game matches.</p>`;

    const search = drawer.querySelector('.drawer-search');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      drawer.querySelectorAll('.drawer-item').forEach(a => { a.hidden = !!q && !a.dataset.name.includes(q); });
      drawer.querySelectorAll('.drawer-group').forEach(g => { g.hidden = !g.querySelector('.drawer-item:not([hidden])'); });
      drawer.querySelectorAll('.drawer-kids').forEach(a => { a.hidden = !!q; });
      drawer.querySelector('.drawer-empty').hidden = !!drawer.querySelector('.drawer-item:not([hidden])');
    });
    drawer.querySelector('[data-sw="kid"]').addEventListener('click', () => setKidMode(!isKidMode()));
    const focusSwitch = drawer.querySelector('[data-sw="focus"]');
    if (focusSwitch) focusSwitch.addEventListener('click', () => {
      const on = !focusOn();
      store.set('mg-focus', on ? 'on' : 'off');
      focusSwitch.setAttribute('aria-checked', String(on));
    });
  }
  fillDrawer();

  const menuBtn = header.querySelector('.menu-btn');
  const setOpen = open => {
    document.body.classList.toggle('drawer-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      const current = drawer.querySelector('.current');
      if (current) current.scrollIntoView({ block: 'center' });
      (current || drawer.querySelector('.drawer-search')).focus({ preventScroll: true });
    }
  };
  menuBtn.addEventListener('click', () => setOpen(true));
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });

  // Kid mode is on but this is a game for older players: say so gently, and offer a way back.
  if (game && kidMode && !game.kids) {
    const bar = document.createElement('div');
    bar.className = 'kidbar';
    bar.innerHTML = `<p>${FACE} Kid mode is on. This game is meant for older players.</p><a class="btn ghost" href="${root}">Kids’ games</a><button class="btn ghost" type="button">Play anyway</button>`;
    bar.querySelector('button').addEventListener('click', () => bar.remove());
    header.after(bar);
  }

  // More like this: other games from the same section, under the how-to.
  if (game) {
    const others = MG_pick(GAMES.filter(g => g.sec === game.sec && g !== game && visible(g)), 4);
    const more = document.createElement('section');
    more.className = 'more';
    more.innerHTML = `
      <h2>More in ${section.name}</h2>
      <div class="tiles">${others.map(g => `
        <a class="tile-link" href="${href(g, kids)}">${icon(g)}<span><b>${g.name}</b><small>${g.origin}${g.kids ? ` ${badge(g, true)}` : ''}</small></span></a>`).join('')}
      </div>
      <a class="all-link" href="${root}">All games →</a>`;
    main.append(more);
  }

  function MG_pick(list, k) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  // How to play: opens on the first two visits, and the ? button jumps to it. A demo button replays the gesture tutorial.
  const howto = document.querySelector('.howto');
  if (howto && game) {
    // Open on the first two visits to a game, then folded away (it can always be opened again).
    const visits = parseInt(store.get(`seen-${game.id}`), 10) || 0;
    if (visits < 2) howto.open = true;
    store.set(`seen-${game.id}`, String(Math.min(visits + 1, 9)));
    header.querySelector('.help-btn').addEventListener('click', () => {
      howto.open = true;
      howto.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const demo = document.createElement('button');
    demo.type = 'button';
    demo.className = 'btn ghost demo-btn';
    demo.textContent = '▶ Show me a quick demo';
    demo.addEventListener('click', () => { loadTutorial(true); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    const sum = howto.querySelector('summary');
    if (sum) sum.after(demo);
  }

  // Gesture tutorial: loaded on demand, and shown until a level of this game has been won (never blocks the game).
  function loadTutorial(force) {
    const go = () => { try { MGTutorial.start({ force }); } catch (err) { console.error(err); } };
    if (window.MGTutorial) return go();
    const s = document.createElement('script');
    s.src = `${root}shared/tutorial.js`;
    s.onload = go;
    s.onerror = () => {};
    document.head.append(s);
  }
  // A player who already has scores for this game has plainly learned it.
  const OLD_SCORE_KEYS = { '2048': ['2048-best'], 'golf': ['golf-best'], 'peg-solitaire': ['pegs-best'], 'recall': ['sequence-best'], 'grid-recall': ['recall-grid-best'], 'klondike': ['klondike-wins'], 'pyramid': ['pyramid-wins'], 'digit-span': ['span-best-forward', 'span-best-backward'], 'eight-queens': ['queens-found-5', 'queens-found-6', 'queens-found-8'] };
  const tutorialDone = () => {
    if (store.get(`tut-done-${game.id}`) === '1' || wonLevels().length) return true;
    if ((OLD_SCORE_KEYS[game.id] || []).some(k => store.get(k) != null)) return true;
    return !!(LV && LV[1] && lvButtons().some(b => store.get(LV[1] + lvBtnValue(b)) != null));
  };

  // ---- Levels: games with a difficulty or size choice open one step above the highest level won ----
  // LEVELS (games.js) maps a game to [setting key, best-score key prefix or null, selector of its level buttons, attribute].
  const LV = typeof LEVELS === 'object' && LEVELS && game ? LEVELS[game.id] : null;
  const lvBtnValue = b => (b.dataset.value !== undefined ? b.dataset.value : b.dataset.size);
  const lvButtons = () => {
    try { return LV ? [...document.querySelectorAll(LV[2] + ' button')].filter(b => lvBtnValue(b) !== undefined) : []; } catch { return []; }
  };
  const wonKey = game ? `lvdone-${game.id}` : '';
  const wonLevels = () => { const v = store.json(wonKey); return Array.isArray(v) ? v.map(String) : []; };
  const levelNow = () => {
    const b = lvButtons().find(x => x.getAttribute('aria-pressed') === 'true' || x.classList.contains('on') || x.classList.contains('active'));
    return b ? String(lvBtnValue(b)) : (LV && store.get(LV[0]) != null ? String(store.get(LV[0])) : null);
  };
  if (LV && !kids) {
    try {
      const order = lvButtons().map(b => String(lvBtnValue(b)));
      const won = new Set(wonLevels());
      if (LV[1]) order.forEach(v => { if (store.get(LV[1] + v) != null) won.add(v); });
      let top = -1;
      order.forEach((v, i) => { if (won.has(v)) top = i; });
      // Once per visit to the site (not on every reload), so a level chosen on purpose is not undone mid-session.
      let applied = false;
      try { applied = sessionStorage.getItem(`lvl-${game.id}`) === '1'; sessionStorage.setItem(`lvl-${game.id}`, '1'); } catch {}
      if (top >= 0 && !applied) {
        const target = order[Math.min(top + 1, order.length - 1)];
        if (store.get(LV[0]) !== target) store.set(LV[0], target);
      }
    } catch (err) { console.error('Level choice skipped:', err); }
  }
  // Remember that the current level was won; returns the next level's button, if there is one.
  function noteWin() {
    if (game) store.set(`tut-done-${game.id}`, '1');
    if (!LV) return null;
    try {
      const now = levelNow();
      if (now === null) return null;
      const won = wonLevels();
      if (!won.includes(now)) store.set(wonKey, JSON.stringify([...won, now]));
      const btns = lvButtons();
      const i = btns.findIndex(b => String(lvBtnValue(b)) === now);
      return i >= 0 && i < btns.length - 1 ? btns[i + 1] : null;
    } catch { return null; }
  }

  // A soft message layer over a game area (which needs position: relative).
  // show() is for any message; win() adds a gentle celebration and, where there is one, an invitation to the next level.
  function overlay(container) {
    const el = document.createElement('div');
    el.className = 'win';
    el.innerHTML = '<div><div class="reward" aria-hidden="true"></div><h2></h2><p></p><p class="extra"></p><button class="btn"></button><button class="btn ghost next" hidden></button></div>';
    container.append(el);
    const main = el.querySelector('button.btn'), next = el.querySelector('button.next');
    let action, timer, nextBtn;
    main.addEventListener('click', () => { hide(); action && action(); });
    next.addEventListener('click', () => { hide(); if (nextBtn) nextBtn.click(); });
    function show(title, text, label = 'Play again', fn, delay = 450, celebrate = false) {
      clearTimeout(timer);
      el.querySelector('h2').textContent = title;
      el.querySelector('p').textContent = text;
      main.textContent = label;
      action = fn;
      el.classList.remove('celebrate');
      const reward = el.querySelector('.reward'), extra = el.querySelector('.extra');
      reward.innerHTML = '';
      extra.textContent = '';
      next.hidden = true;
      nextBtn = null;
      if (celebrate) {
        nextBtn = noteWin();
        const streak = (() => { try { return MGProgress.summary().streak; } catch { return 0; } })();
        const bits = [];
        if (nextBtn) bits.push('Next step unlocked');
        if (streak >= 2) bits.push(`${streak}-day streak`);
        extra.textContent = bits.join(' · ');
        if (nextBtn) { next.textContent = `Try ${nextBtn.textContent.trim()}`; next.hidden = false; }
        reward.innerHTML = '<svg viewBox="0 0 52 52" class="badge"><circle cx="26" cy="26" r="23"/><path d="M15 27l8 8 14-17"/></svg>'
          + Array.from({ length: 14 }, (_, i) => `<i style="--a:${Math.round(i * 360 / 14)}deg;--d:${(i % 4) * 60}ms;--c:${['--peach', '--peri', '--mocha', '--tile-home'][i % 4]}"></i>`).join('');
      }
      timer = setTimeout(() => {
        el.classList.add('show');
        if (celebrate) {
          el.classList.add('celebrate');
          try { navigator.vibrate && navigator.vibrate([16, 40, 16]); } catch {}
        }
      }, delay);
    }
    const win = (title, text, label, fn, delay) => show(title, text, label, fn, delay, true);
    function hide() { clearTimeout(timer); el.classList.remove('show', 'celebrate'); }
    return { show, win, hide };
  }

  // Segmented buttons: <div class="seg"><button data-value="x">…</div>
  function seg(el, value, onChange) {
    const btns = el.querySelectorAll('button');
    const mark = v => btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === String(v))));
    btns.forEach(b => b.addEventListener('click', () => { mark(b.dataset.value); onChange(b.dataset.value); }));
    mark(value);
  }

  // A clock shown in el; starts on the first move.
  function clock(el) {
    let started = 0, id = 0, stopped = 0;
    const draw = () => { el.textContent = fmt((stopped || Date.now()) - started); };
    return {
      start() { if (started) return; started = Date.now(); id = setInterval(draw, 250); },
      stop() { clearInterval(id); if (!started) return 0; stopped = Date.now(); draw(); return stopped - started; },
      reset() { clearInterval(id); started = stopped = 0; el.textContent = '0:00'; },
    };
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  window.MG = { root, game, kids, store, fmt, overlay, seg, clock, wait, shuffle, esc, badge, ageText, isKidMode, setKidMode, saveSheet, demo: () => loadTutorial(true), FACE };

  // Show the gesture tutorial on arrival, until a level of this game has been won.
  if (game && !tutorialDone()) setTimeout(() => loadTutorial(false), 200);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${root}sw.js`);
})();
