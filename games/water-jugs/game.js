(() => {
  // Fewest moves checked with a breadth-first solver.
  const LEVELS = [
    { caps: [3, 5], start: [0, 0], tap: true, target: 4, min: 6 },
    { caps: [12, 8, 5], start: [12, 0, 0], tap: false, target: 6, min: 6 },
    { caps: [8, 5, 3], start: [8, 0, 0], tap: false, target: 4, min: 6 },
    { caps: [4, 9], start: [0, 0], tap: true, target: 6, min: 8 },
    { caps: [10, 7, 3], start: [10, 0, 0], tap: false, target: 5, min: 8 },
    { caps: [7, 11], start: [0, 0], tap: true, target: 2, min: 14 },
  ];
  const jugsEl = document.getElementById('jugs');
  const goalEl = document.getElementById('goal');
  const status = document.getElementById('status');
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('min');
  const bestEl = document.getElementById('best');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let level = MG.kids ? 0 : +MG.store.get('jugs-level') || 0;
  let water, picked, moves, history, done;

  function newGame(l = level) {
    level = l;
    MG.store.set('jugs-level', level);
    const L = LEVELS[level];
    water = L.start.slice();
    picked = null;
    moves = 0;
    history = [];
    done = false;
    ov.hide();
    goalEl.innerHTML = `Measure exactly <b>${L.target}</b> litres in any jug${L.tap ? '. You have a tap.' : '. No tap: use only the water you have.'}`;
    status.textContent = 'Tap a jug, then another to pour.';
    const tallest = Math.max(...L.caps);
    jugsEl.innerHTML = L.caps.map((cap, i) => `
      <div class="jug-col">
        <button class="jug" data-i="${i}" style="height:${60 + (140 * cap) / tallest}px"><div class="water"></div><span class="amount"></span></button>
        <span class="cap">holds ${cap}</span>
        ${L.tap ? `<div class="mini-btns"><button class="mini-btn" data-fill="${i}">Fill</button><button class="mini-btn" data-empty="${i}">Empty</button></div>` : ''}
      </div>`).join('');
    render();
  }

  function render() {
    const L = LEVELS[level];
    jugsEl.querySelectorAll('.jug').forEach((b, i) => {
      b.querySelector('.water').style.height = `${(100 * water[i]) / L.caps[i]}%`;
      b.querySelector('.amount').textContent = water[i];
      b.classList.toggle('picked', picked === i);
      b.classList.toggle('hit', water[i] === L.target);
      b.setAttribute('aria-label', `Jug holding ${water[i]} of ${L.caps[i]} litres`);
    });
    movesEl.textContent = moves;
    minEl.textContent = L.min;
    bestEl.textContent = MG.store.get(`jugs-best-${level}`) || '–';
    undoBtn.disabled = !history.length || done;
  }

  function act(next, text) {
    if (done) return;
    if (next.every((v, i) => v === water[i])) { status.textContent = 'Nothing would change.'; return; }
    history.push(water.slice());
    water = next;
    moves++;
    picked = null;
    status.textContent = text;
    render();
    const L = LEVELS[level];
    if (water.includes(L.target)) {
      done = true;
      const prev = +MG.store.get(`jugs-best-${level}`);
      if (!prev || moves < prev) MG.store.set(`jugs-best-${level}`, moves);
      render();
      const last = level === LEVELS.length - 1;
      ov.win(moves === L.min ? 'Perfectly measured' : 'Measured',
        moves === L.min ? `${L.target} litres in ${moves} moves, the fewest possible.` : `${L.target} litres in ${moves} moves. The fewest possible is ${L.min}.`,
        last ? 'Play again' : 'Next level', () => { if (last) newGame(); else document.querySelector(`#level [data-value="${level + 1}"]`).click(); }, 600);
    }
  }

  jugsEl.addEventListener('click', e => {
    const L = LEVELS[level];
    const fill = e.target.closest('[data-fill]'), empty = e.target.closest('[data-empty]'), jug = e.target.closest('.jug');
    if (fill) { const i = +fill.dataset.fill; const w = water.slice(); w[i] = L.caps[i]; act(w, `Filled the ${L.caps[i]}-litre jug.`); return; }
    if (empty) { const i = +empty.dataset.empty; const w = water.slice(); w[i] = 0; act(w, `Emptied the ${L.caps[i]}-litre jug.`); return; }
    if (!jug || done) return;
    const i = +jug.dataset.i;
    if (picked === null) { if (water[i]) picked = i; else status.textContent = 'That jug is empty.'; render(); return; }
    if (picked === i) { picked = null; render(); return; }
    const amt = Math.min(water[picked], L.caps[i] - water[i]);
    const w = water.slice();
    w[picked] -= amt;
    w[i] += amt;
    act(w, `Poured ${amt} from the ${L.caps[picked]} into the ${L.caps[i]}.`);
    picked = null;
    render();
  });

  undoBtn.addEventListener('click', () => {
    if (!history.length || done) return;
    water = history.pop();
    moves--;
    picked = null;
    status.textContent = 'Move taken back.';
    render();
  });
  document.getElementById('restart').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('level'), level, v => newGame(+v));
  newGame();
})();
