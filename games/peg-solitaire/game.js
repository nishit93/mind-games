(() => {
  const N = 7, CENTRE = 24;
  const grid = document.getElementById('grid');
  const leftEl = document.getElementById('left');
  const bestEl = document.getElementById('best');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  // The English cross: the middle three rows and columns.
  const onBoard = i => {
    const r = Math.floor(i / N), c = i % N;
    return (r >= 2 && r <= 4) || (c >= 2 && c <= 4);
  };
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  let pegs, selected, history, done;

  const holes = Array.from({ length: N * N }, (_, i) => {
    const b = document.createElement('button');
    b.className = 'hole' + (onBoard(i) ? '' : ' off');
    if (!onBoard(i)) b.tabIndex = -1;
    b.addEventListener('click', () => tap(i));
    return b;
  });
  grid.replaceChildren(...holes);

  // Landing holes for a jump from i: [middle, landing] pairs.
  function jumps(i) {
    const r = Math.floor(i / N), c = i % N, out = [];
    for (const [dr, dc] of DIRS) {
      const r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (r2 < 0 || r2 >= N || c2 < 0 || c2 >= N) continue;
      const mid = (r + dr) * N + c + dc, to = r2 * N + c2;
      if (onBoard(to) && pegs[mid] && !pegs[to]) out.push([mid, to]);
    }
    return out;
  }

  function newGame() {
    pegs = holes.map((_, i) => onBoard(i) && i !== CENTRE);
    selected = null;
    history = [];
    done = false;
    ov.hide();
    render();
  }

  function render() {
    const targets = selected === null ? [] : jumps(selected).map(j => j[1]);
    holes.forEach((b, i) => {
      if (!onBoard(i)) return;
      b.classList.toggle('peg', pegs[i]);
      b.classList.toggle('selected', i === selected);
      b.classList.toggle('target', targets.includes(i));
      b.setAttribute('aria-label', `Row ${Math.floor(i / N) + 1}, column ${i % N + 1}, ${pegs[i] ? 'peg' : targets.includes(i) ? 'landing spot' : 'empty'}`);
    });
    leftEl.textContent = pegs.filter(Boolean).length;
    bestEl.textContent = MG.store.get('pegs-best') || '–';
    undoBtn.disabled = !history.length;
  }

  function tap(i) {
    if (done) return;
    if (pegs[i]) {
      selected = selected === i ? null : i;
    } else if (selected !== null) {
      const jump = jumps(selected).find(j => j[1] === i);
      if (!jump) return;
      history.push(pegs.slice());
      pegs[selected] = false;
      pegs[jump[0]] = false;
      pegs[i] = true;
      // Keep the moved peg picked up if it can jump again.
      selected = jumps(i).length ? i : null;
      checkEnd();
    }
    render();
  }

  function checkEnd() {
    if (pegs.some((p, i) => p && jumps(i).length)) return;
    done = true;
    selected = null;
    const left = pegs.filter(Boolean).length;
    const prev = +MG.store.get('pegs-best');
    if (!prev || left < prev) MG.store.set('pegs-best', left);
    let title = 'No more jumps', text = `${left} pegs left. Can you finish with fewer?`;
    if (left === 1 && pegs[CENTRE]) { title = 'Perfect'; text = 'One peg, right in the centre.'; }
    else if (left === 1) { title = 'Brilliant'; text = 'Just one peg left. Next time, aim for the centre.'; }
    (left === 1 ? ov.win : ov.show)(title, text, 'Play again', newGame);
  }

  undoBtn.addEventListener('click', () => {
    if (!history.length) return;
    pegs = history.pop();
    selected = null;
    done = false;
    ov.hide();
    render();
  });
  document.getElementById('new').addEventListener('click', newGame);
  newGame();
})();
