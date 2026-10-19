(() => {
  const PICTURES = ['🌸', '🍃', '🌙', '⭐', '🐚', '🍂', '🌊', '☁️', '🪷', '🍄', '🐟', '🦋'];
  const NAMES = ['blossom', 'leaf', 'moon', 'star', 'shell', 'autumn leaf', 'wave', 'cloud', 'lotus', 'mushroom', 'fish', 'butterfly'];
  const grid = document.getElementById('grid');
  const turnsEl = document.getElementById('turns');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let size = MG.kids ? 12 : +MG.store.get('memory-size') || 16;
  let deck, cards, open, matched, turns, lock, gen = 0;

  function newGame(n = size) {
    size = n;
    gen++;
    MG.store.set('memory-size', size);
    const kinds = MG.shuffle([...PICTURES.keys()]).slice(0, size / 2);
    deck = MG.shuffle([...kinds, ...kinds]);
    open = [];
    matched = new Set();
    turns = 0;
    lock = false;
    clock.reset();
    ov.hide();
    cards = deck.map((kind, i) => {
      const b = document.createElement('button');
      b.className = 'card-m';
      b.innerHTML = `<span class="inner"><span class="face back"></span><span class="face front">${PICTURES[kind]}</span></span>`;
      b.setAttribute('aria-label', 'Face-down card');
      b.addEventListener('click', () => flip(i));
      return b;
    });
    grid.style.gridTemplateColumns = `repeat(${size === 24 ? 6 : 4}, 1fr)`;
    grid.replaceChildren(...cards);
    turnsEl.textContent = '0';
    bestEl.textContent = MG.store.get(`memory-best-${size}`) || '–';
  }

  function show(i, up) {
    cards[i].classList.toggle('up', up);
    cards[i].setAttribute('aria-label', up ? NAMES[deck[i]] : 'Face-down card');
  }

  async function flip(i) {
    if (lock || matched.has(i) || open.includes(i) || !cards[i]) return;
    clock.start();
    show(i, true);
    open.push(i);
    if (open.length < 2) return;

    turns++;
    turnsEl.textContent = turns;
    const [a, b] = open;
    open = [];
    if (deck[a] === deck[b]) {
      matched.add(a).add(b);
      cards[a].classList.add('matched');
      cards[b].classList.add('matched');
      if (matched.size === deck.length) finish();
    } else {
      lock = true;
      const mine = gen;
      await MG.wait(900);
      if (mine !== gen) return; // a new game began meanwhile
      show(a, false);
      show(b, false);
      lock = false;
    }
  }

  function finish() {
    const ms = clock.stop();
    const prev = +MG.store.get(`memory-best-${size}`);
    if (!prev || turns < prev) MG.store.set(`memory-best-${size}`, turns);
    bestEl.textContent = MG.store.get(`memory-best-${size}`);
    const perfect = turns === size / 2;
    ov.win(perfect ? 'Perfect memory' : 'All pairs found',
      `${turns} turns.${!prev || turns < prev ? ' A new best.' : ''}`, 'Play again', () => newGame(), 700);
  }

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), size, v => newGame(+v));
  newGame();
})();
