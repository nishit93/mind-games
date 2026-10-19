(() => {
  const gridEl = document.getElementById('grid');
  const nextEl = document.getElementById('next');
  const bestEl = document.getElementById('best');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  let n = MG.kids ? 3 : +MG.store.get('schulte-n') || 5;
  let next, done;

  function newGame(size = n) {
    n = size;
    MG.store.set('schulte-n', n);
    next = 1;
    done = false;
    clock.reset();
    ov.hide();
    nextEl.textContent = 1;
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    gridEl.replaceChildren(...MG.shuffle([...Array(n * n).keys()].map(k => k + 1)).map(v => {
      const b = document.createElement('button');
      b.className = 'sn';
      b.textContent = v;
      b.addEventListener('click', () => tap(b, v));
      return b;
    }));
    const best = MG.store.get(`schulte-best-${n}`);
    bestEl.textContent = best ? `${(best / 1000).toFixed(1)}s` : '–';
  }

  function tap(b, v) {
    if (done || b.classList.contains('found')) return;
    if (v !== next) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
    clock.start();
    b.classList.add('found');
    next++;
    nextEl.textContent = next <= n * n ? next : '✓';
    if (next > n * n) {
      done = true;
      const ms = clock.stop();
      const prev = +MG.store.get(`schulte-best-${n}`);
      if (!prev || ms < prev) MG.store.set(`schulte-best-${n}`, ms);
      bestEl.textContent = `${(Math.min(ms, prev || ms) / 1000).toFixed(1)}s`;
      ov.show('All found', `1 to ${n * n} in ${(ms / 1000).toFixed(1)} seconds.${!prev || ms < prev ? ' A new best.' : ''}`, 'New table', () => newGame(), 500);
    }
  }

  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), n, v => newGame(+v));
  newGame();
})();
