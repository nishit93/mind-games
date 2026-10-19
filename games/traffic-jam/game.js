(() => {
  const N = 6;
  // X is the coral car; fewest moves found with a breadth-first solver (one move = one slide).
  const LEVELS = [
    { rows: ['IJKGG.', 'IJKDDD', 'XX..BF', '.LLHBF', 'EEEH.F', '...CCC'], min: 4 },
    { rows: ['GHHNNK', 'G.MMDK', '.XXCDJ', 'FFFC.J', 'L..EE.', 'LBBII.'], min: 5 },
    { rows: ['...D..', '.HHDFF', '.XXD.I', '..E..I', 'G.ECCB', 'G....B'], min: 8 },
    { rows: ['..HMM.', '..HBB.', 'CXXIEK', 'CGDIEK', '.GDJJ.', '.FFLLL'], min: 12 },
    { rows: ['IIFFFD', 'HEEJCD', 'HXXJC.', 'GG..CM', '..LBBM', 'KKLNN.'], min: 17 },
    { rows: ['HDJJKK', 'HDBBB.', 'XXN..F', 'GINLLF', 'GIEECF', '.MM.C.'], min: 20 },
    { rows: ['C.HBII', 'C.HB..', '..XXE.', '.FFGE.', 'JJJGD.', '..KKD.'], min: 26 },
    { rows: ['F.LHGG', 'F.LHDD', 'XX..BN', 'CC.EBN', 'KKKEJI', 'MM..JI'], min: 30 },
  ];
  const yard = document.getElementById('yard');
  const movesEl = document.getElementById('moves');
  const minEl = document.getElementById('min');
  const bestEl = document.getElementById('best');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let level = MG.kids ? 0 : +MG.store.get('traffic-level') || 0;
  let cars, moves, done;

  function parse(rows) {
    const cells = {};
    [...rows.join('')].forEach((ch, i) => { if (ch !== '.') (cells[ch] ||= []).push(i); });
    return Object.entries(cells).map(([id, list]) => {
      const r = Math.floor(list[0] / N), c = list[0] % N;
      const h = list.length > 1 && list[1] === list[0] + 1;
      return { id, r, c, len: list.length, h };
    });
  }

  // How far a car can slide in direction d (−1 or +1).
  function room(car, d) {
    let s = 0;
    for (;;) {
      const r = car.h ? car.r : car.r + d * (s + 1), c = car.h ? car.c + d * (s + 1) : car.c;
      if (r < 0 || c < 0 || (car.h ? c + car.len > N : r + car.len > N)) return s;
      const cell = d < 0 ? [r, c] : car.h ? [r, c + car.len - 1] : [r + car.len - 1, c];
      const hit = cars.some(o => o !== car && cell[0] >= o.r && cell[0] < o.r + (o.h ? 1 : o.len) && cell[1] >= o.c && cell[1] < o.c + (o.h ? o.len : 1));
      if (hit) return s;
      s++;
    }
  }

  function newGame(l = level) {
    level = l;
    MG.store.set('traffic-level', level);
    cars = parse(LEVELS[level].rows);
    moves = 0;
    done = false;
    ov.hide();
    yard.replaceChildren(...cars.map(car => {
      const b = document.createElement('button');
      b.className = 'car' + (car.id === 'X' ? ' hero' : car.len === 3 ? ' truck' : '');
      b.setAttribute('aria-label', car.id === 'X' ? 'Coral car' : `${car.len === 3 ? 'Truck' : 'Car'}, ${car.h ? 'sideways' : 'upright'}`);
      car.el = b;
      attach(car);
      return b;
    }));
    render();
  }

  function render() {
    const G = 3;
    for (const car of cars) {
      Object.assign(car.el.style, {
        left: `calc(${(car.c / N) * 100}% + ${G}px)`,
        top: `calc(${(car.r / N) * 100}% + ${G}px)`,
        width: `calc(${((car.h ? car.len : 1) / N) * 100}% - ${G * 2}px)`,
        height: `calc(${((car.h ? 1 : car.len) / N) * 100}% - ${G * 2}px)`,
      });
    }
    movesEl.textContent = moves;
    minEl.textContent = LEVELS[level].min;
    bestEl.textContent = MG.store.get(`traffic-best-${level}`) || '–';
  }

  function slide(car, d, steps) {
    if (done) return;
    const s = Math.min(steps, room(car, d));
    if (!s) return;
    if (car.h) car.c += d * s; else car.r += d * s;
    moves++;
    render();
    const hero = cars.find(c => c.id === 'X');
    if (hero.c + hero.len === N) finish(hero);
  }

  function finish(hero) {
    done = true;
    hero.el.style.left = '110%';
    const { min } = LEVELS[level];
    const prev = +MG.store.get(`traffic-best-${level}`);
    if (!prev || moves < prev) MG.store.set(`traffic-best-${level}`, moves);
    bestEl.textContent = Math.min(moves, prev || moves);
    const last = level === LEVELS.length - 1;
    ov.win(moves === min ? 'Perfect drive' : 'Free to go',
      moves === min ? `${moves} moves, the fewest possible.` : `${moves} moves. The fewest possible is ${min}.`,
      last ? 'Play again' : 'Next level', () => { if (last) newGame(); else document.querySelector(`#level [data-value="${level + 1}"]`).click(); }, 700);
  }

  function attach(car) {
    let start = null;
    car.el.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; try { car.el.setPointerCapture?.(e.pointerId); } catch {} });
    car.el.addEventListener('pointerup', e => {
      if (!start) return;
      const delta = car.h ? e.clientX - start.x : e.clientY - start.y;
      start = null;
      if (Math.abs(delta) < 10) {
        const open = [-1, 1].filter(d => room(car, d));
        if (open.length === 1) slide(car, open[0], 1);
        return;
      }
      const cell = yard.clientWidth / N;
      slide(car, Math.sign(delta), Math.max(1, Math.round(Math.abs(delta) / cell)));
    });
    car.el.addEventListener('pointercancel', () => { start = null; });
    car.el.addEventListener('keydown', e => {
      const d = car.h ? { ArrowLeft: -1, ArrowRight: 1 }[e.key] : { ArrowUp: -1, ArrowDown: 1 }[e.key];
      if (d) { e.preventDefault(); slide(car, d, 1); }
    });
  }

  document.getElementById('restart').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('level'), level, v => newGame(+v));
  newGame();
})();
