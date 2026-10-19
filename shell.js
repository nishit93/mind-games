// Shared page shell: header, games menu, how-to toggle, and small helpers the games use (window.MG).
(() => {
  const root = new URL('.', document.currentScript.src).href;
  const game = GAMES.find(g => g.id === document.body.dataset.game);
  const main = document.querySelector('main');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) {
      try { localStorage.setItem(k, v); } catch {}
      if (window.MGProgress) MGProgress.mirror(k, v); // scores and settings are also kept in the progress record
    },
    json(k) { try { return JSON.parse(store.get(k)); } catch { return null; } },
  };

  const fmt = ms => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const section = game && SECTIONS.find(s => s.id === game.sec);
  // Opened from the Kids section: games start on their easiest setting.
  const kids = new URLSearchParams(location.search).has('kids');
  const href = (g, kidsLink = false) => `${root}games/${g.id}/${kidsLink && g.kids ? '?kids' : ''}`;
  const icon = g => `<span class="mini${g.icon.length > 2 ? ' small' : ''}" aria-hidden="true">${g.icon}</span>`;

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
      <p class="sub">${game ? `${game.origin} · <a href="${root}#${section.id}">${section.name}</a>` : 'Quiet puzzles from around the world.'}</p>
    </div>
    ${game ? '<button class="icon-btn fav-btn" aria-label="Add to favourites" aria-pressed="false">♡</button><button class="icon-btn help-btn" aria-label="How to play">?</button>' : ''}`;
  main.prepend(header);

  // Heart: favourite this game.
  if (game && window.MGProgress) {
    const fav = header.querySelector('.fav-btn');
    const drawFav = () => {
      const on = MGProgress.isFav(game.id);
      fav.textContent = on ? '♥' : '♡';
      fav.setAttribute('aria-pressed', String(on));
      fav.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
    };
    fav.addEventListener('click', () => MGProgress.toggleFav(game.id));
    MGProgress.onChange(drawFav);
    drawFav();

    // Count a play on the first real touch of the game, not on the menu, header or how-to.
    const onFirstTouch = e => {
      if (e.target.closest && e.target.closest('header.top, .drawer, .scrim, .howto, .more')) return;
      if (e.type === 'keydown' && ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      removeEventListener('pointerdown', onFirstTouch, true);
      removeEventListener('keydown', onFirstTouch, true);
      MGProgress.recordPlay();
    };
    addEventListener('pointerdown', onFirstTouch, true);
    addEventListener('keydown', onFirstTouch, true);
  }

  // Games menu: search, then the games grouped by section.
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const drawer = document.createElement('nav');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  drawer.setAttribute('aria-label', 'Games');
  drawer.innerHTML = `
    <a class="drawer-home" href="${root}">Mind Games</a>
    <input class="search drawer-search" type="search" placeholder="Find a game" aria-label="Find a game">
    <a class="drawer-kids" href="${root}#kids">★ Great for kids</a>
    <a class="drawer-kids drawer-favs" href="${root}#favs">♥ Your favourites</a>
    ${SECTIONS.map(s => `
      <div class="drawer-group">
        <a class="drawer-heading" href="${root}#${s.id}">${s.name}</a>
        ${GAMES.filter(g => g.sec === s.id).map(g => `
          <a class="drawer-item${g === game ? ' current' : ''}" href="${href(g)}" data-name="${g.name.toLowerCase()} ${g.origin.toLowerCase()} ${s.name.toLowerCase()}"${g === game ? ' aria-current="page"' : ''}>
            ${icon(g)}
            <span><b>${g.name}${g.kids ? ' <i class="kid" title="Great for kids">★</i>' : ''}</b><small>${g.origin}</small></span>
          </a>`).join('')}
      </div>`).join('')}
    <p class="drawer-empty" hidden>No game matches.</p>`;
  document.body.append(scrim, drawer);

  const search = drawer.querySelector('.drawer-search');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    drawer.querySelectorAll('.drawer-item').forEach(a => { a.hidden = !!q && !a.dataset.name.includes(q); });
    drawer.querySelectorAll('.drawer-group').forEach(g => { g.hidden = !g.querySelector('.drawer-item:not([hidden])'); });
    drawer.querySelectorAll('.drawer-kids').forEach(a => { a.hidden = !!q; });
    drawer.querySelector('.drawer-empty').hidden = !!drawer.querySelector('.drawer-item:not([hidden])');
  });

  const menuBtn = header.querySelector('.menu-btn');
  const setOpen = open => {
    document.body.classList.toggle('drawer-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      const current = drawer.querySelector('.current');
      if (current) current.scrollIntoView({ block: 'center' });
      (current || search).focus({ preventScroll: true });
    }
  };
  menuBtn.addEventListener('click', () => setOpen(true));
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });

  // More like this: other games from the same section, under the how-to.
  if (game) {
    const others = MG_pick(GAMES.filter(g => g.sec === game.sec && g !== game), 4);
    const more = document.createElement('section');
    more.className = 'more';
    more.innerHTML = `
      <h2>More in ${section.name}</h2>
      <div class="tiles">${others.map(g => `
        <a class="tile-link" href="${href(g, kids)}">${icon(g)}<span><b>${g.name}</b><small>${g.origin}</small></span></a>`).join('')}
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

  // How to play: opens on a first visit, and the ? button jumps to it.
  const howto = document.querySelector('.howto');
  if (howto && game) {
    if (!store.get(`seen-${game.id}`)) { howto.open = true; store.set(`seen-${game.id}`, '1'); }
    header.querySelector('.help-btn').addEventListener('click', () => {
      howto.open = true;
      howto.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // A soft message layer over a game area (which needs position: relative).
  function overlay(container) {
    const el = document.createElement('div');
    el.className = 'win';
    el.innerHTML = '<div><h2></h2><p></p><button class="btn"></button></div>';
    container.append(el);
    let action, timer;
    el.querySelector('button').addEventListener('click', () => { hide(); action && action(); });
    function show(title, text, label = 'Play again', fn, delay = 450) {
      clearTimeout(timer);
      el.querySelector('h2').textContent = title;
      el.querySelector('p').textContent = text;
      el.querySelector('button').textContent = label;
      action = fn;
      timer = setTimeout(() => el.classList.add('show'), delay);
    }
    function hide() { clearTimeout(timer); el.classList.remove('show'); }
    return { show, hide };
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

  window.MG = { root, game, kids, store, fmt, overlay, seg, clock, wait, shuffle };

  if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${root}sw.js`);
})();
