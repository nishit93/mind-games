(() => {
  const boardEl = document.getElementById('board');
  const leftEl = document.getElementById('left');
  const solvedEl = document.getElementById('solved');
  const status = document.getElementById('status');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let seeds = +MG.store.get('tchouk-seeds') || 10;
  let solved = +MG.store.get('tchouk-solved') || 0;
  let pits, store, history, done;

  // Build the one solvable start for this many seeds by playing backwards from an empty board:
  // fill the first empty pit i with i seeds, taking one back from each nearer pit and from the store.
  function start(total) {
    const p = [0];
    for (let s = 0; s < total; s++) {
      let i = 1;
      while (p[i]) i++;
      for (let j = 1; j < i; j++) p[j]--;
      p[i] = i;
    }
    return p;
  }

  function newGame(n = seeds) {
    seeds = n;
    MG.store.set('tchouk-seeds', seeds);
    pits = start(seeds);
    store = 0;
    history = [];
    done = false;
    ov.hide();
    status.textContent = 'Play a glowing pit: its seeds will end exactly in the store.';
    render();
  }

  const dots = k => Array.from({ length: Math.min(k, 24) }, () => '<span class="seed"></span>').join('');

  function render() {
    boardEl.innerHTML = `<div class="store" aria-label="Store, ${store} seeds"><span class="seeds">${dots(store)}</span><span class="count">${store}</span><span class="idx">store</span></div>`
      + pits.slice(1).map((k, j) => {
        const i = j + 1;
        return `<button class="pit${k === i && !done ? ' ready' : ''}" data-i="${i}" ${done ? 'disabled' : ''} aria-label="Pit ${i}, ${k} seeds${k === i ? ', ready' : ''}">
          <span class="seeds">${dots(k)}</span><span class="count">${k || ''}</span><span class="idx">${i}</span></button>`;
      }).join('');
    const left = pits.reduce((a, b) => a + b, 0);
    leftEl.textContent = left;
    solvedEl.textContent = solved;
    undoBtn.disabled = !history.length || done;
  }

  boardEl.addEventListener('click', e => {
    const b = e.target.closest('.pit');
    if (!b || done) return;
    const i = +b.dataset.i;
    const k = pits[i];
    if (!k) return;
    if (k !== i) {
      status.textContent = k > i ? `Pit ${i} has ${k} seeds: they would go past the store.` : `Pit ${i} has ${k} seed${k === 1 ? '' : 's'}: they would stop short of the store.`;
      b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      return;
    }
    history.push({ pits: pits.slice(), store });
    pits[i] = 0;
    for (let j = i - 1; j >= 1; j--) pits[j]++;
    store++;
    const left = pits.reduce((a, c) => a + c, 0);
    if (!left) {
      done = true;
      solved++;
      MG.store.set('tchouk-solved', solved);
      status.textContent = 'Every seed is home.';
      ov.win('All sown', `All ${seeds} seeds are in the store.`, 'Play again', () => newGame(), 600);
    } else if (!pits.some((c, j) => j > 0 && c === j)) {
      status.textContent = 'No pit can be played. Undo and try another order.';
    } else {
      status.textContent = `${left} seeds to go.`;
    }
    render();
  });

  undoBtn.addEventListener('click', () => {
    if (!history.length || done) return;
    ({ pits, store } = history.pop());
    status.textContent = 'Move taken back.';
    render();
  });
  document.getElementById('restart').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), seeds, v => newGame(+v));
  newGame();
})();
