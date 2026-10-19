// Shared page shell: header, games menu, how-to toggle, and small helpers the games use (window.MG).
(() => {
  const root = new URL('.', document.currentScript.src).href;
  const game = GAMES.find(g => g.id === document.body.dataset.game);
  const main = document.querySelector('main');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    json(k) { try { return JSON.parse(store.get(k)); } catch { return null; } },
  };

  const fmt = ms => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // Header
  const header = document.createElement('header');
  header.className = 'top';
  header.innerHTML = `
    <button class="icon-btn menu-btn" aria-label="Open games menu" aria-controls="drawer" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <div class="title">
      <h1>${game ? game.name : 'Mind Games'}</h1>
      <p class="sub">${game ? game.origin : 'Quiet puzzles from around the world.'}</p>
    </div>
    ${game ? '<button class="icon-btn help-btn" aria-label="How to play">?</button>' : ''}`;
  main.prepend(header);

  // Games menu
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const drawer = document.createElement('nav');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  drawer.setAttribute('aria-label', 'Games');
  drawer.innerHTML = `
    <a class="drawer-home" href="${root}">Mind Games</a>
    ${GAMES.map(g => `
      <a class="drawer-item${g === game ? ' current' : ''}" href="${root}games/${g.id}/"${g === game ? ' aria-current="page"' : ''}>
        <span class="mini${g.icon.length > 2 ? ' small' : ''}">${g.icon}</span>
        <span><b>${g.name}</b><small>${g.origin}</small></span>
      </a>`).join('')}`;
  document.body.append(scrim, drawer);

  const menuBtn = header.querySelector('.menu-btn');
  const setOpen = open => {
    document.body.classList.toggle('drawer-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) drawer.querySelector('.current, a').focus({ preventScroll: true });
  };
  menuBtn.addEventListener('click', () => setOpen(true));
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });

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

  window.MG = { root, game, store, fmt, overlay, seg, clock, wait, shuffle };

  if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${root}sw.js`);
})();
