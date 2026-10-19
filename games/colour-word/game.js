(() => {
  const wordEl = document.getElementById('word');
  const keys = document.getElementById('keys');
  const roundEl = document.getElementById('round');
  const rightEl = document.getElementById('right');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  const COLOURS = [
    { name: 'Red', bg: '#C8553D', fg: '#FFFFFF' },
    { name: 'Blue', bg: '#3D6FB6', fg: '#FFFFFF' },
    { name: 'Green', bg: '#4E8F5E', fg: '#FFFFFF' },
    { name: 'Yellow', bg: '#E0B03C', fg: '#3A2E12' },
  ];
  const ROUNDS = 10;

  let count = MG.kids ? 3 : (MG.store.get('colourword-level') === '3' ? 3 : 4);
  let round = 0, right = 0, ink = 0, locked = true, run = 0;

  function buttons() {
    keys.style.gridTemplateColumns = `repeat(${count === 3 ? 3 : 2}, 1fr)`;
    keys.replaceChildren(...COLOURS.slice(0, count).map((c, i) => {
      const b = document.createElement('button');
      b.className = 'ckey';
      b.textContent = c.name;
      b.style.background = c.bg;
      b.style.color = c.fg;
      b.addEventListener('click', () => answer(i, b));
      return b;
    }));
  }

  function next() {
    round++;
    ink = Math.floor(Math.random() * count);
    let word = ink;
    if (Math.random() < 0.8) while (word === ink) word = Math.floor(Math.random() * count);
    wordEl.textContent = COLOURS[word].name;
    wordEl.style.color = COLOURS[ink].bg;
    locked = false;
    roundEl.textContent = `${round} of ${ROUNDS}`;
    status.textContent = 'Tap the colour the word is written in, not the word.';
    [...keys.children].forEach(b => b.classList.remove('good', 'bad'));
  }

  async function answer(i, b) {
    if (locked) return;
    locked = true;
    const mine = run;
    if (i === ink) { right++; b.classList.add('good'); status.textContent = 'Yes.'; }
    else { b.classList.add('bad'); keys.children[ink].classList.add('good'); status.textContent = `That ink was ${COLOURS[ink].name.toLowerCase()}.`; }
    rightEl.textContent = right;
    await MG.wait(i === ink ? 450 : 1100);
    if (mine !== run) return;
    if (round >= ROUNDS) { finish(); return; }
    next();
  }

  function finish() {
    locked = true;
    const best = Math.max(right, +MG.store.get('colourword-best') || 0);
    const isBest = right > (+MG.store.get('colourword-best') || 0);
    MG.store.set('colourword-best', best);
    bestEl.textContent = best;
    (right >= 7 ? ov.win : ov.show)(`${right} of ${ROUNDS}`,
      right === ROUNDS ? 'Not one slip. Your attention is sharp.' : `${isBest && right ? 'A new best. ' : ''}It is normal for the word to pull your eye the wrong way. That tug is the point.`,
      'Play again', start, 400);
  }

  function start() {
    run++;
    round = 0;
    right = 0;
    ov.hide();
    rightEl.textContent = '0';
    bestEl.textContent = MG.store.get('colourword-best') || '–';
    buttons();
    next();
  }

  document.getElementById('new').addEventListener('click', start);
  MG.seg(document.getElementById('level'), String(count), v => { count = +v; MG.store.set('colourword-level', v); start(); });
  start();
})();
