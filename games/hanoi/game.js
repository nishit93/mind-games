(() => {
  const pegEls = [...document.querySelectorAll('.peg')];
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('min');
  const bestEl = document.getElementById('best');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let n = MG.kids ? 3 : +MG.store.get('hanoi-n') || 4;
  let pegs, held, moves, done;

  function newGame(size = n) {
    n = size;
    MG.store.set('hanoi-n', n);
    pegs = [Array.from({ length: n }, (_, i) => n - i), [], []];
    held = null;
    moves = 0;
    done = false;
    ov.hide();
    render();
  }

  // Largest disc is mocha, smallest is peach.
  const discColour = size => {
    const mocha = n === 1 ? 100 : Math.round(((size - 1) / (n - 1)) * 100);
    return `color-mix(in srgb, var(--tile) ${mocha}%, var(--tile-home))`;
  };

  function render() {
    pegEls.forEach((el, i) => {
      el.replaceChildren(...pegs[i].map((size, j) => {
        const d = document.createElement('div');
        d.className = 'disc' + (held === i && j === pegs[i].length - 1 ? ' lifted' : '');
        d.style.width = `${28 + (70 * size) / n}%`;
        d.style.background = discColour(size);
        return d;
      }));
      el.classList.toggle('active', held === i);
    });
    movesEl.textContent = moves;
    minEl.textContent = 2 ** n - 1;
    const best = MG.store.get(`hanoi-best-${n}`);
    bestEl.textContent = best || '–';
  }

  function tap(i) {
    if (done) return;
    if (held === null) {
      if (pegs[i].length) held = i;
    } else if (held === i) {
      held = null;
    } else {
      const disc = pegs[held].at(-1), top = pegs[i].at(-1);
      if (top !== undefined && top < disc) {
        pegEls[i].classList.remove('shake');
        void pegEls[i].offsetWidth;
        pegEls[i].classList.add('shake');
        return;
      }
      pegs[i].push(pegs[held].pop());
      held = null;
      moves++;
      if (pegs[2].length === n) finish();
    }
    render();
  }

  function finish() {
    done = true;
    const min = 2 ** n - 1;
    const prev = +MG.store.get(`hanoi-best-${n}`);
    if (!prev || moves < prev) MG.store.set(`hanoi-best-${n}`, moves);
    ov.win(moves === min ? 'Perfect' : 'Tower moved',
      moves === min ? `${moves} moves, the fewest possible.` : `${moves} moves. The fewest possible is ${min}.`,
      'Play again', () => newGame());
  }

  pegEls.forEach((el, i) => el.addEventListener('click', () => tap(i)));
  document.addEventListener('keydown', e => { if (/^[123]$/.test(e.key)) tap(+e.key - 1); });
  document.getElementById('restart').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));

  newGame();
})();
