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

  // Saved scores that are not plain numbers (damaged by an old version, a bug or hand editing) would show as "NaN" or
  // as raw text. Drop them before any game reads them, so the game simply starts with no best score.
  try {
    for (const k of Object.keys(localStorage)) {
      if (/^fifteen-best-\d+$/.test(k)) {
        let ok = false;
        try { const b = JSON.parse(localStorage.getItem(k)); ok = b && Number.isFinite(b.moves) && b.moves >= 0 && (b.ms === undefined || Number.isFinite(b.ms)); } catch {}
        if (!ok) localStorage.removeItem(k);
      } else if (/-best(-|$)/.test(k) || /-(solved|wins)$/.test(k)) {
        if (!/^\d{1,12}(\.\d+)?$/.test(String(localStorage.getItem(k)))) localStorage.removeItem(k);
      }
    }
  } catch {}

  const fmt = ms => {
    if (!Number.isFinite(+ms) || ms < 0) return '–'; // a damaged saved time must not show as NaN
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const section = game && SECTIONS.find(s => s.id === game.sec);

  // ---- Puzzle of the day ----
  // The page address carries ?daily=<today's date>. Everything the game draws at random is then taken from a generator
  // started from the date and the game, so everyone gets the same puzzle, on the level the pool names. Normal randomness
  // and the player's own saved level are put back as soon as the page has finished loading.
  const daily = (() => {
    try {
      const d = new URLSearchParams(location.search).get('daily');
      if (!d || !game || typeof DAILY === 'undefined' || d !== dailyDate()) return null;
      const e = DAILY.find(x => x.id === game.id);
      return e ? { id: e.id, level: e.level, date: d } : null;
    } catch { return null; }
  })();
  if (daily) {
    try {
      let h = 1779033703 ^ (daily.date + ':' + daily.id).length;
      for (const ch of daily.date + ':' + daily.id) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
      let a = h >>> 0;
      const realRandom = Math.random, realMirror = MGProgress.mirror;
      Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      MGProgress.mirror = () => {};
      const lvKey = typeof LEVELS === 'object' && LEVELS[game.id] ? LEVELS[game.id][0] : null;
      let saved = null;
      try { if (lvKey) { saved = localStorage.getItem(lvKey); localStorage.setItem(lvKey, daily.level); } } catch {}
      document.addEventListener('DOMContentLoaded', () => {
        Math.random = realRandom; MGProgress.mirror = realMirror;
        try { if (lvKey) { if (saved === null) localStorage.removeItem(lvKey); else localStorage.setItem(lvKey, saved); } } catch {}
      });
    } catch (err) { console.error('Puzzle of the day could not start:', err); }
  }
  const dailyDone = () => { try { const v = JSON.parse(localStorage.getItem('mg-daily')); return Array.isArray(v) ? v : []; } catch { return []; } };
  const dailyStreak = () => {
    const have = new Set(dailyDone()); const d = new Date(); d.setHours(0, 0, 0, 0);
    if (!have.has(dailyDate(d))) d.setDate(d.getDate() - 1);
    let n = 0; while (have.has(dailyDate(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  function markDaily() {
    if (!daily) return 0;
    try { const done = dailyDone(); if (!done.includes(daily.date)) localStorage.setItem('mg-daily', JSON.stringify([...done, daily.date].sort().slice(-400))); } catch {}
    return dailyStreak();
  }
  // Kid mode (a switch the player turns on) shows only the games for children, and every game then starts on its easiest
  // setting, like the Kids section does. It is kept on this device only.
  const isKidMode = () => store.get('mg-kidmode') === 'on';
  const kidMode = isKidMode();
  // Opened from the Kids section, or kid mode is on: games start on their easiest setting.
  const kids = new URLSearchParams(location.search).has('kids') || kidMode;
  document.body.classList.toggle('kidmode', kidMode);
  const href = (g, kidsLink = false) => `${root}games/${g.id}/${kidsLink && g.kids ? '?kids' : ''}`;
  const HUES = { logic: 28, math: 222, moves: 14, memory: 158, cards: 262 };
  const hueOf = g => { const same = GAMES.filter(x => x.sec === g.sec); return (HUES[g.sec] || 200) + [-6, 3, -3, 6, 0][Math.max(same.indexOf(g), 0) % 5]; };
  // On a game page, the pieces take the colour of the game's section.
  if (game) document.body.style.setProperty('--sec-h', HUES[game.sec] || 200);
  const iconAttrs = g => `style="--hh:${hueOf(g)}" data-g="${esc(g.icon)}" data-gid="${esc(g.id)}"`;
  const icon = g => `<span class="mini sec-${g.sec}${g.icon.length > 2 ? ' small' : ''}" ${iconAttrs(g)} aria-hidden="true"><span class="gglyph">${g.icon}</span></span>`;

  // The kids badge: a small smiling face and the age range, so it is clear which games are meant for children.
  const FACE = '<svg class="kface" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><circle cx="5.6" cy="6.7" r="1"/><circle cx="10.4" cy="6.7" r="1"/><path d="M4.9 9.7c.9 1.7 5.3 1.7 6.2 0"/></svg>';
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
      <h1>${game ? game.name : 'The Quiet Board'}</h1>
      <p class="sub">${game ? `${game.origin} · <a href="${root}#${section.id}">${section.name}</a>${game.kids ? ` ${badge(game)}` : ''}` : 'Quite bored? <a href="#" id="surprise">Surprise me</a>'}</p>
    </div>
    ${game
      ? `${MGProgress._stub ? '' : '<button class="icon-btn fav-btn" aria-label="Add to favourites" aria-pressed="false">♡</button><button class="icon-btn list-btn" aria-label="Save to a list">＋</button>'}<button class="icon-btn help-btn" aria-label="How to play">?</button>`
      : '<button class="icon-btn theme-btn" type="button" aria-label="Switch to dark mode"></button>'}`;
  main.prepend(header);

  // Light or dark: follows the phone until the player chooses, then remembers the choice on this device (mg-theme).
  const THEME_ICON = {
    moon: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  };
  const themeBtn = header.querySelector('.theme-btn');
  const themeNow = () => {
    const t = store.get('mg-theme');
    if (t === 'dark' || t === 'light') return t;
    try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
  };
  function applyTheme() {
    const t = store.get('mg-theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    const dark = themeNow() === 'dark';
    if (themeBtn) {
      themeBtn.innerHTML = dark ? THEME_ICON.sun : THEME_ICON.moon;
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
    try { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#12161E' : '#F6F4EF'); } catch { /* optional */ }
  }
  if (themeBtn) themeBtn.addEventListener('click', () => { store.set('mg-theme', themeNow() === 'dark' ? 'light' : 'dark'); applyTheme(); });
  applyTheme();

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
  let focusing = false, focusLeft = false, focusTimer = 0;
  const focusOn = () => store.get('mg-focus') !== 'off';
  const handle = document.createElement('button');
  const dock = document.createElement('div');
  if (game) {
    handle.className = 'focus-handle';
    handle.setAttribute('aria-label', 'Show the menu, rules and more');
    handle.innerHTML = '<span aria-hidden="true">⌃</span>';
    dock.className = 'focus-dock';
    dock.hidden = true;
    // The heart and the list button stay within reach while the rest of the page steps aside.
    if (!MGProgress._stub) {
      const favB = document.createElement('button');
      favB.className = 'focus-handle focus-fav';
      const listB = document.createElement('button');
      listB.className = 'focus-handle focus-list';
      listB.setAttribute('aria-label', 'Save to a list');
      listB.innerHTML = '<span aria-hidden="true">＋</span>';
      const drawFocusFav = () => {
        const on = MGProgress.isFav(game.id);
        favB.innerHTML = `<span aria-hidden="true">${on ? '♥' : '♡'}</span>`;
        favB.setAttribute('aria-pressed', String(on));
        favB.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
      };
      favB.addEventListener('click', () => MGProgress.toggleFav(game.id));
      listB.addEventListener('click', () => saveSheet(game.id));
      MGProgress.onChange(drawFocusFav);
      drawFocusFav();
      dock.append(favB, listB);
    }
    dock.append(handle);
    document.body.append(dock);
  }
  // Entering focus is gentle: the rules, history and links fade and slide away first, then the header folds up.
  function setFocus(on) {
    clearTimeout(focusTimer);
    focusing = on;
    if (on) {
      document.body.classList.add('focus-in');
      dock.hidden = false;
      focusTimer = setTimeout(() => { if (focusing) document.body.classList.add('focus'); }, 1150);
    } else {
      document.body.classList.remove('focus-in', 'focus');
      dock.hidden = true;
      focusLeft = true;
    }
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
      // Taste for the quiet personalisation layer (see similarity.js): plays per game, kept on this device only.
      try {
        let o = JSON.parse(localStorage.getItem('mg-taste'));
        if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
        const c = o[game.id] && typeof o[game.id] === 'object' ? o[game.id] : {};
        o[game.id] = { n: (+c.n > 0 ? +c.n : 0) + 1, t: Date.now() };
        localStorage.setItem('mg-taste', JSON.stringify(o));
      } catch { /* personalisation is optional */ }
      // Focus begins with the first real action (a number typed, a piece slid), not with a plain tap: wait until the board changes.
      if (focusOn() && !focusLeft) {
        const stage = document.querySelector('.stage, .board, .table, main .grid') || document.querySelector('main');
        let started = false;
        const begin = () => { if (started || focusLeft) return; started = true; mo && mo.disconnect(); setTimeout(() => { if (!focusLeft) setFocus(true); }, 350); };
        let mo = null;
        try {
          // Games where a first tap only selects something (and the real action is typing or a second tap) ignore attribute-only changes.
          const SELECT_FIRST = ['sudoku', 'futoshiki', 'skyscrapers', 'cages', 'magic-square', 'number-pyramid', 'make-24', 'target-number', 'pyramid', 'monte-carlo', 'accordion', 'mahjong-solitaire', 'pentominoes'];
          const watchAttrs = !SELECT_FIRST.includes(game.id);
          mo = new MutationObserver(muts => { if (muts.some(m => m.type === 'characterData' || (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) || (watchAttrs && m.type === 'attributes'))) begin(); });
          mo.observe(stage, { childList: true, subtree: true, characterData: true, attributes: watchAttrs, attributeFilter: watchAttrs ? ['class', 'style', 'aria-pressed', 'data-on', 'data-v'] : undefined });
        } catch { setTimeout(begin, 900); }
      }
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
    <a class="drawer-home" href="${root}">The Quiet Board</a>
    <div class="drawer-switches">
      <button class="switch" role="switch" data-sw="kid" aria-checked="${km}"><span>Kid mode<small>Only games for children up to 11</small></span><i class="knob" aria-hidden="true"></i></button>
      ${game ? `<button class="switch" role="switch" data-sw="focus" aria-checked="${focusOn()}"><span>Focus while playing<small>Hide everything else once you start</small></span><i class="knob" aria-hidden="true"></i></button>` : ''}
    </div>
    ${window.MGLang ? `<div class="lang-row"><span class="lang-label">Language</span><div class="seg" role="group" aria-label="Language" data-no-i18n>${MGLang.langs.map(l => `<button type="button" data-lang="${l.code}" aria-pressed="${l.code === MGLang.code}">${l.label}</button>`).join('')}</div></div>` : ''}
    <input class="search drawer-search" type="search" placeholder="Find a game" aria-label="Find a game">
    ${(() => { try { const p = dailyPick(km); const g = GAMES.find(x => x.id === p.id); return `<a class="drawer-kids drawer-daily" href="${root}games/${p.id}/?daily=${p.date}">☀ Puzzle of the day <small>${g.name}${dailyDone().includes(p.date) ? ' · done' : ''}</small></a>`; } catch { return ''; } })()}
    ${km ? '' : `<a class="drawer-kids" href="${root}#kids">${FACE} Great for kids</a>`}
    <a class="drawer-kids drawer-favs" href="${root}#favs">♥ Favourites</a>
    <a class="drawer-kids drawer-lists" href="${root}#lists">☰ Your lists</a>
    <a class="drawer-kids drawer-stats" href="${root}#stats">▤ Your stats</a>
    <a class="drawer-kids drawer-about" href="${root}#about">ⓘ About</a>
    ${SECTIONS.map(s => {
      const games = GAMES.filter(g => g.sec === s.id && (!km || g.kids));
      const isCurrent = !!game && game.sec === s.id;
      return games.length ? `
      <details class="drawer-group"${isCurrent ? ' open' : ''} data-def="${isCurrent ? 1 : 0}">
        <summary class="drawer-heading"><span>${s.name}</span><small>${games.length}</small></summary>
        <a class="drawer-all" href="${root}#${s.id}">See all in ${s.name} ›</a>
        ${games.map(g => `
          <a class="drawer-item${g === game ? ' current' : ''}" href="${href(g)}" data-name="${g.name.toLowerCase()} ${g.origin.toLowerCase()} ${s.name.toLowerCase()}"${g === game ? ' aria-current="page"' : ''}>
            ${icon(g)}
            <span><b>${g.name}${g.kids ? ` ${badge(g, true)}` : ''}</b><small>${g.origin}</small></span>
          </a>`).join('')}
      </details>` : '';
    }).join('')}
    <p class="drawer-empty" hidden>No game matches.</p>`;

    const search = drawer.querySelector('.drawer-search');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      drawer.querySelectorAll('.drawer-item').forEach(a => { a.hidden = !!q && !a.dataset.name.includes(q); });
      drawer.querySelectorAll('.drawer-group').forEach(g => {
        g.hidden = !g.querySelector('.drawer-item:not([hidden])');
        g.open = q ? true : g.dataset.def === '1';
        const all = g.querySelector('.drawer-all'); if (all) all.hidden = !!q;
      });
      drawer.querySelectorAll('.drawer-kids').forEach(a => { a.hidden = !!q; });
      drawer.querySelector('.drawer-empty').hidden = !!drawer.querySelector('.drawer-item:not([hidden])');
    });
    drawer.querySelector('[data-sw="kid"]').addEventListener('click', () => setKidMode(!isKidMode()));
    drawer.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { if (window.MGLang && b.dataset.lang !== MGLang.code) MGLang.set(b.dataset.lang); }));
    const focusSwitch = drawer.querySelector('[data-sw="focus"]');
    if (focusSwitch) focusSwitch.addEventListener('click', () => {
      const on = !focusOn();
      store.set('mg-focus', on ? 'on' : 'off');
      focusSwitch.setAttribute('aria-checked', String(on));
    });
  }
  fillDrawer();

  // Bottom tabs (home page only): Explore, Lists, Today's puzzle, Stats and the full menu.
  if (!game) {
    const todayHref = () => { try { const p = dailyPick(isKidMode()); return `${root}games/${p.id}/?daily=${p.date}`; } catch { return root; } };
    const I = {
      play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM10 4v16M14 4v16M4 10h16M4 14h16"/></svg>',
      lists: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.7c0 5.4-7.5 10-7.5 10z"/></svg>',
      foryou: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.4 5.6 6.1.5-4.6 4 1.4 6-5.3-3.2-5.3 3.2 1.4-6-4.6-4 6.1-.5z"/></svg>',
      stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>',
    };
    const tabs = document.createElement('nav');
    tabs.className = 'tabbar';
    tabs.setAttribute('aria-label', 'Main');
    tabs.innerHTML = `
      <a class="tab" data-tab="explore" href="#all"><span class="pill">${I.play}</span><span>Play</span></a>
      <a class="tab" data-tab="foryou" href="#foryou"><span class="pill">${I.foryou}</span><span>For you</span></a>
      <a class="tab" data-tab="lists" href="#lists"><span class="pill">${I.lists}</span><span>Lists</span></a>
      <a class="tab" data-tab="stats" href="#stats"><span class="pill">${I.stats}</span><span>Progress</span></a>`;
    document.body.append(tabs);
    const mark = () => {
      const f = location.hash.slice(1) || 'all';
      const on = f === 'lists' || f === 'favs' || f.startsWith('l-') ? 'lists' : f === 'stats' ? 'stats' : f === 'foryou' ? 'foryou' : 'explore';
      tabs.querySelectorAll('.tab').forEach(t => { if (t.dataset.tab === on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    };
    mark();
    addEventListener('hashchange', mark);
  }

  const menuBtn = header.querySelector('.menu-btn');
  const setOpen = open => {
    document.body.classList.toggle('drawer-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      const current = drawer.querySelector('.current');
      if (current) current.scrollIntoView({ block: 'center' });
      // Never focus the search box here: on a phone that pops the keyboard open as soon as the menu opens.
      (current || drawer.querySelector('.drawer-home') || drawer).focus({ preventScroll: true });
    }
  };
  menuBtn.addEventListener('click', () => setOpen(true));
  scrim.addEventListener('click', () => setOpen(false));
  // A link in the menu that stays on this page (About, Favourites, Stats…) must close the menu too: no page load does it for us.
  drawer.addEventListener('click', e => { if (e.target.closest && e.target.closest('a[href]')) setOpen(false); });
  addEventListener('hashchange', () => setOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });

  // The puzzle of the day: a banner, and the controls that would replace the puzzle ask before they do.
  if (daily) {
    const lvSel = typeof LEVELS === 'object' && LEVELS[game.id] ? LEVELS[game.id][2] : null;
    const label = lvSel && document.querySelector(lvSel + ' button[data-value="' + daily.level + '"], ' + lvSel + ' button[data-size="' + daily.level + '"]');
    const bar = document.createElement('div');
    bar.className = 'dailybar';
    bar.innerHTML = `<p><b>Puzzle of the day</b> · ${new Date().toLocaleDateString(window.MGLang ? MGLang.code : [], { weekday: 'long', day: 'numeric', month: 'long' })}${label ? ' · ' + esc(label.textContent.trim()) : ''}</p>`;
    header.after(bar);
    const leave = () => {
      const wrap = document.createElement('div');
      wrap.className = 'sheet-wrap';
      wrap.innerHTML = '<div class="sheet-scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Leave the puzzle of the day"><h2>Leave the puzzle of the day?</h2><p class="sheet-sub">Starting something new replaces today’s puzzle. You can come back to it from the home page.</p><button class="btn sheet-done" type="button">Keep playing</button><a class="btn ghost sheet-done" href="' + location.pathname + '">Start a regular game</a></div>';
      document.body.append(wrap);
      requestAnimationFrame(() => wrap.classList.add('open'));
      const close = () => { wrap.classList.add('leaving'); setTimeout(() => wrap.remove(), 250); };
      wrap.querySelector('.sheet-scrim').addEventListener('click', close);
      wrap.querySelector('button').addEventListener('click', close);
    };
    document.addEventListener('click', e => {
      const c = e.target.closest && e.target.closest('.controls button, .controls .seg *');
      if (!c || c.closest('.sheet-wrap')) return;
      e.preventDefault(); e.stopPropagation();
      if (!document.querySelector('.sheet-wrap')) leave();
    }, true);
  }

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
  // A saved level that is not one of this game's buttons (damaged data, or a level removed in an update) would crash some games: forget it.
  if (LV) {
    try {
      const values = lvButtons().map(b => String(lvBtnValue(b)));
      const cur = localStorage.getItem(LV[0]);
      if (cur !== null && values.length && !values.includes(cur)) localStorage.removeItem(LV[0]);
    } catch {}
  }
  if (LV && !kids && !daily) {
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
  let lastDailyStreak = 0;
  // Remember that the current level was won; returns the next level's button, if there is one.
  function noteWin() {
    if (game) store.set(`tut-done-${game.id}`, '1');
    if (daily) lastDailyStreak = markDaily();
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
        if (daily && lastDailyStreak) bits.push(lastDailyStreak > 1 ? `Puzzle of the day done · ${lastDailyStreak}-day streak` : 'Puzzle of the day done');
        else if (nextBtn) bits.push('Next step unlocked');
        if (streak >= 2 && !daily) bits.push(`${streak}-day streak`);
        const quips = ['Quite a board, that was.', 'Not so bored now?', 'Quietly brilliant.', 'Quite good. Quite quiet.', 'Bored? Not anymore.'];
        bits.push(quips[Math.floor(Math.random() * quips.length)]);
        extra.textContent = bits.join(' · ');
        if (nextBtn && !daily) { next.textContent = `Try ${nextBtn.textContent.trim()}`; next.hidden = false; }
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
    const draw = () => { if (el) el.textContent = fmt((stopped || Date.now()) - started); };
    return {
      start() { if (started) return; started = Date.now(); if (el) id = setInterval(draw, 250); },
      stop() { clearInterval(id); if (!started) return 0; stopped = Date.now(); draw(); return stopped - started; },
      reset() { clearInterval(id); started = stopped = 0; if (el) el.textContent = '0:00'; },
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

  // Game art: a flat tonal plate with a simple drawing for each game (see the design language, "Icons and imagery").
  // The plate replaces the old text glyph; if anything here fails, the glyph simply stays.
  const plates = (() => {
        const T = (h) => ({ bg: `hsl(${h},40%,92%)`, D: `hsl(${h},42%,24%)`, M: `hsl(${h},30%,52%)`, L: `hsl(${h},34%,80%)`, W: "#FCFBF8" });
    const sty = (k, C) => k === 'O' ? `fill="${C.W}" stroke="${C.D}" stroke-width="4"` : `fill="${C[k]}"`;
    const r = (x, y, w, h, k, C, rx = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${sty(k, C)}/>`;
    const c = (x, y, R, k, C) => `<circle cx="${x}" cy="${y}" r="${R}" ${sty(k, C)}/>`;
    const p = (d, k, C) => `<path d="${d}" ${sty(k, C)}/>`;
    const ln = (d, C, w = 4, k = 'D') => `<path d="${d}" fill="none" stroke="${C[k]}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const grid = (n, x0, y0, s, gap, fn) => { let o = ''; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) o += fn(i, j, x0 + j * (s + gap), y0 + i * (s + gap)) || ''; return o; };
    const txt = (t, x, y, size, C) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${size}" fill="${C.D}">${t}</text>`;
    const D = {
      sudoku: C => r(36, 36, 88, 88, 'O', C, 10) + ln('M65 36v88M95 36v88M36 65h88M36 95h88', C, 3) + c(50, 50, 5, 'D', C) + c(110, 80, 5, 'D', C) + c(80, 110, 5, 'D', C),
      nonogram: C => grid(5, 34, 34, 14, 3, (i, j, x, y) => r(x, y, 14, 14, (i + j * 2) % 3 === 0 || (i === 2) ? 'D' : 'W', C, 3)),
      binary: C => grid(2, 40, 40, 36, 8, (i, j, x, y) => (i + j) % 2 ? c(x + 18, y + 18, 17, 'D', C) : c(x + 18, y + 18, 16, 'O', C)),
      futoshiki: C => r(26, 56, 42, 48, 'O', C, 10) + r(92, 56, 42, 48, 'O', C, 10) + ln('M84 70L74 80l10 10', C, 5) + c(47, 80, 5, 'D', C),
      skyscrapers: C => r(34, 76, 22, 52, 'D', C, 4) + r(60, 50, 22, 78, 'M', C, 4) + r(86, 62, 22, 66, 'D', C, 4) + r(112, 38, 16, 90, 'L', C, 4),
      tents: C => p('M80 40L124 116H36z', 'D', C) + p('M80 78l14 38H66z', 'W', C) + c(40, 50, 14, 'M', C) + r(37, 60, 6, 14, 'D', C, 2),
      mines: C => ln('M80 28v104M28 80h104M43 43l74 74M117 43L43 117', C, 5) + c(80, 80, 28, 'D', C) + c(72, 72, 7, 'W', C),
      'lights-off': C => grid(3, 34, 34, 26, 8, (i, j, x, y) => c(x + 13, y + 13, 13, (i + j) % 2 ? 'W' : 'D', C)),
      pipes: C => ln('M30 110h40a20 20 0 0 0 20-20V70a20 20 0 0 1 20-20h20', C, 12, 'M') + c(30, 110, 9, 'D', C) + c(130, 50, 9, 'D', C),
      'colour-flood': C => grid(3, 34, 34, 26, 8, (i, j, x, y) => r(x, y, 26, 26, ['D', 'M', 'L'][(i + j) % 3], C, 7)),
      'eight-queens': C => grid(2, 34, 64, 46, 0, (i, j, x, y) => r(x, y, 46, 46, (i + j) % 2 ? 'L' : 'W', C, 0)) + p('M50 60l8-24 10 14 12-18 12 18 10-14 8 24z', 'D', C) + r(50, 60, 72, 10, 'D', C, 3),
      'knights-tour': C => ln('M44 116V84l36-0V48l36 0', C, 5, 'M') + c(44, 116, 11, 'D', C) + c(44, 84, 8, 'M', C) + c(80, 84, 8, 'M', C) + c(80, 48, 8, 'M', C) + c(116, 48, 11, 'D', C),
      'bulls-and-cows': C => c(44, 80, 14, 'D', C) + c(80, 80, 14, 'O', C) + c(116, 80, 14, 'M', C) + ln('M34 112h92', C, 4, 'L'),
      'one-stroke': C => ln('M36 112L80 40l44 72H36z', C, 5) + c(36, 112, 8, 'D', C) + c(80, 40, 8, 'D', C) + c(124, 112, 8, 'D', C),
      'magic-square': C => grid(3, 36, 36, 20, 8, (i, j, x, y) => c(x + 10, y + 10, [4, 7, 10][(i + j) % 3], 'D', C)),
      'make-24': C => txt('24', 80, 96, 64, C),
      'target-number': C => c(80, 80, 46, 'L', C) + c(80, 80, 32, 'W', C) + c(80, 80, 18, 'M', C) + c(80, 80, 7, 'D', C),
      'next-in-line': C => c(36, 88, 8, 'D', C) + c(64, 84, 12, 'D', C) + c(100, 78, 16, 'D', C) + `<circle cx="136" cy="70" r="12" fill="none" stroke="${C.D}" stroke-width="3" stroke-dasharray="4 5"/>`,
      'number-pyramid': C => r(54, 36, 52, 26, 'D', C, 8) + r(36, 66, 40, 26, 'M', C, 8) + r(84, 66, 40, 26, 'M', C, 8) + r(26, 96, 34, 26, 'O', C, 8) + r(63, 96, 34, 26, 'O', C, 8) + r(100, 96, 34, 26, 'O', C, 8),
      cages: C => grid(3, 36, 36, 26, 6, (i, j, x, y) => r(x, y, 26, 26, 'W', C, 5)) + `<rect x="30" y="30" width="64" height="38" rx="9" fill="none" stroke="${C.D}" stroke-width="4" stroke-dasharray="6 5"/>`,
      'water-jugs': C => p('M36 60h40l-6 62H42z', 'O', C) + p('M41 92h30l-3 30H44z', 'M', C) + p('M90 40h34l-4 82H94z', 'O', C) + p('M93 76h28l-1 46H94z', 'M', C),
      'chinese-rings': C => `<circle cx="52" cy="80" r="26" fill="none" stroke="${C.D}" stroke-width="6"/><circle cx="80" cy="80" r="26" fill="none" stroke="${C.M}" stroke-width="6"/><circle cx="108" cy="80" r="26" fill="none" stroke="${C.D}" stroke-width="6"/>`,
      tchoukaillon: C => grid(1, 28, 70, 20, 4, () => '') + [0, 1, 2, 3, 4].map(i => r(30 + i * 22, 70, 18, 34, 'W', C, 9) + (i % 2 ? c(39 + i * 22, 94, 5, 'D', C) : c(39 + i * 22, 90, 5, 'M', C) + c(39 + i * 22, 98, 5, 'D', C))).join(''),
      '15-puzzle': C => grid(3, 34, 34, 26, 8, (i, j, x, y) => (i === 2 && j === 2) ? '' : r(x, y, 26, 26, (i + j) % 2 ? 'M' : 'D', C, 7)),
      hanoi: C => ln('M30 118h100', C, 4) + ln('M52 118V48M80 118V48M108 118V48', C, 4) + r(34, 102, 36, 14, 'D', C, 7) + r(40, 86, 24, 14, 'M', C, 7) + r(92, 102, 32, 14, 'O', C, 7),
      'huarong-dao': C => r(32, 32, 44, 56, 'D', C, 8) + r(80, 32, 20, 26, 'M', C, 6) + r(104, 32, 24, 26, 'M', C, 6) + r(80, 62, 48, 26, 'L', C, 6) + r(32, 92, 22, 36, 'M', C, 6) + r(58, 92, 70, 36, 'O', C, 6),
      'traffic-jam': C => r(30, 40, 70, 26, 'D', C, 13) + r(30, 74, 36, 26, 'M', C, 13) + r(74, 74, 56, 26, 'L', C, 13) + r(30, 108, 70, 22, 'M', C, 11),
      maze: C => ln('M34 34h92v92H46V58h60v44H70', C, 8, 'M') + c(34, 34, 9, 'D', C) + c(70, 102, 9, 'D', C),
      warehouse: C => r(38, 38, 84, 84, 'O', C, 10) + ln('M38 38l84 84M122 38L38 122', C, 4) + c(124, 124, 9, 'D', C),
      pentominoes: C => r(38, 34, 40, 40, 'D', C, 8) + r(82, 34, 40, 40, 'D', C, 8) + r(38, 78, 40, 40, 'D', C, 8) + r(82, 78, 40, 40, 'L', C, 8),
      'peg-solitaire': C => [[80, 42], [58, 80], [102, 80], [80, 118], [80, 80]].map(([x, y], i) => c(x, y, 16, i === 4 ? 'O' : 'D', C)).join(''),
      2048: C => r(34, 34, 44, 44, 'D', C, 9) + r(82, 34, 44, 44, 'M', C, 9) + r(34, 82, 44, 44, 'L', C, 9) + r(82, 82, 44, 44, 'O', C, 9),
      memory: C => r(34, 34, 40, 52, 'D', C, 9) + r(86, 34, 40, 52, 'O', C, 9) + r(86, 94, 40, 40, 'D', C, 9),
      recall: C => p('M76 76V34a42 42 0 0 0-42 42z', 'D', C) + p('M84 76V34a42 42 0 0 1 42 42z', 'M', C) + p('M76 84v42a42 42 0 0 1-42-42z', 'L', C) + p('M84 84v42a42 42 0 0 0 42-42z', 'O', C),
      'schulte-table': C => grid(3, 34, 34, 26, 8, (i, j, x, y) => r(x, y, 26, 26, 'W', C, 6) + (((i * 3 + j) % 2) ? c(x + 13, y + 13, 5, 'D', C) : '')),
      'grid-recall': C => grid(3, 34, 34, 26, 8, (i, j, x, y) => r(x, y, 26, 26, (i === j || (i === 0 && j === 2)) ? 'D' : 'L', C, 7)),
      'digit-span': C => [0, 1, 2, 3].map(i => r(28 + i * 26, 62, 22, 36, i < 3 ? 'D' : 'O', C, 7)).join(''),
      'odd-one-out': C => c(56, 54, 16, 'D', C) + r(86, 38, 32, 32, 'O', C, 7) + p('M56 92l18 30H38z', 'D', C) + c(104, 108, 16, 'D', C),
      'colour-word': C => r(28, 38, 70, 46, 'D', C, 14) + r(62, 78, 70, 46, 'O', C, 14) + txt('Aa', 63, 71, 28, { D: C.W }),
      'word-search': C => grid(4, 34, 34, 14, 8, (i, j, x, y) => c(x + 7, y + 7, 4, i === j ? 'D' : 'M', C)) + ln('M36 36l78 78', C, 4, 'D'),
      klondike: C => r(30, 40, 56, 78, 'O', C, 9) + r(52, 46, 56, 78, 'M', C, 9) + r(74, 52, 56, 78, 'W', C, 9) + c(102, 92, 9, 'D', C),
      pyramid: C => [[80, 40], [62, 70], [98, 70], [44, 100], [80, 100], [116, 100]].map(([x, y], i) => r(x - 15, y - 18, 30, 40, i % 2 ? 'O' : 'M', C, 7)).join(''),
      golf: C => ln('M70 118V38', C, 4) + p('M70 38l40 14-40 14z', 'D', C) + `<ellipse cx="70" cy="122" rx="30" ry="9" fill="${C.M}"/>` + c(106, 118, 7, 'W', C),
      'mahjong-solitaire': C => r(36, 56, 48, 64, 'O', C, 9) + r(50, 42, 48, 64, 'M', C, 9) + r(64, 28, 48, 64, 'W', C, 9) + ln('M80 50v28M92 50v28', C, 4),
      'free-cells': C => [0, 1, 2, 3].map(i => `<rect x="${28 + i * 26}" y="48" width="22" height="34" rx="6" fill="none" stroke="${C.D}" stroke-width="3" stroke-dasharray="5 4"/>`).join('') + r(54, 92, 52, 34, 'D', C, 9),
      accordion: C => r(26, 56, 40, 56, 'O', C, 7) + r(46, 50, 40, 56, 'M', C, 7) + r(66, 44, 40, 56, 'D', C, 7) + r(86, 38, 40, 56, 'W', C, 7) + ln('M34 124h92', C, 4, 'L'),
      tripeaks: C => p('M20 120L50 52l30 68z', 'D', C) + p('M60 120L90 40l30 80z', 'M', C) + p('M96 120l22-44 22 44z', 'L', C) + ln('M20 124h120', C, 4),
      calculation: C => r(30, 36, 28, 40, 'D', C, 6) + r(62, 36, 28, 40, 'M', C, 6) + r(94, 36, 28, 40, 'L', C, 6) + ln('M44 100v22M76 100v22M108 100v22M30 112h100', C, 4, 'M'),
      'monte-carlo': C => grid(3, 36, 36, 26, 8, (i, j, x, y) => r(x, y, 26, 26, (i === j) ? 'D' : 'O', C, 6)) + ln('M40 40l80 80', C, 3, 'M'),
    };
    return (id, hue) => {
      const f = D[id]; if (!f) return '';
      const C = T(hue);
      return `<svg class="plate" viewBox="0 0 160 160" aria-hidden="true" focusable="false"><rect width="160" height="160" fill="${C.bg}"/>${f(C)}</svg>`;
    };
  })();
  const paintPlates = root => {
    try {
      (root || document).querySelectorAll('[data-gid]:not([data-plated])').forEach(el => {
        const g = GAMES.find(x => x.id === el.dataset.gid);
        const svg = g && plates(g.id, hueOf(g));
        el.dataset.plated = '1';
        if (svg) el.innerHTML = svg;
      });
    } catch { /* the text glyph stays */ }
  };
  try {
    new MutationObserver(() => paintPlates()).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => paintPlates());
    paintPlates();
  } catch { /* old browser: glyphs stay */ }

  window.MG = { root, game, kids, store, fmt, overlay, seg, clock, wait, shuffle, esc, badge, ageText, iconAttrs, hueOf, isKidMode, setKidMode, saveSheet, daily, dailyDone, dailyStreak, demo: () => loadTutorial(true), FACE };

  // Show the gesture tutorial on arrival, until a level of this game has been won.
  // The gesture demo no longer starts by itself: it plays only when "Show me a quick demo" is pressed.

  // Offline support is a bonus: if it cannot start (private browsing, an old browser, a blocked file) nothing else may notice.
  try { if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${root}sw.js`).catch(() => {}); } catch {}
})();
