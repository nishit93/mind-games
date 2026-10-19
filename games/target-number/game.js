(() => {
  const BIG = [25, 50, 75, 100];
  const status = document.getElementById('status');
  const targetEl = document.getElementById('target');
  const solvedEl = document.getElementById('solved');
  const undoBtn = document.getElementById('undo');
  const clock = MG.clock(document.getElementById('time'));
  const ov = MG.overlay(document.querySelector('.stage'));

  let level = MG.store.get('target-level') || 'gentle';
  let solved = +MG.store.get('target-solved') || 0;
  let nums, target, answer, done;

  // Pick the numbers, then build the target from a random whole-number calculation, so it is always reachable.
  function newRound() {
    for (;;) {
      const bigCount = level === 'gentle' ? 1 : Math.floor(Math.random() * 3) + 1;
      const smalls = MG.shuffle([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
      nums = [...MG.shuffle(BIG.slice()).slice(0, bigCount), ...smalls.slice(0, 6 - bigCount)];
      let pool = MG.shuffle(nums.map(v => ({ v, e: String(v) })));
      const steps = 2 + Math.floor(Math.random() * 3);
      for (let s = 0; s < steps && pool.length > 1; s++) {
        const [a, b, ...rest] = pool;
        const ops = [['+', a.v + b.v], ['×', a.v * b.v], ['−', a.v - b.v], ['÷', b.v && a.v % b.v === 0 ? a.v / b.v : 0]].filter(o => o[1] > 0);
        const [op, v] = ops[Math.floor(Math.random() * ops.length)];
        pool = MG.shuffle([{ v, e: `(${a.e} ${op} ${b.e})` }, ...rest]);
      }
      const best = pool.reduce((m, p) => (p.v > m.v ? p : m));
      const [lo, hi] = level === 'gentle' ? [21, 199] : [101, 999];
      if (best.v >= lo && best.v <= hi && !nums.includes(best.v)) {
        target = best.v;
        answer = Combine.solve(nums, target, { integers: true }) || best.e.replace(/^\((.*)\)$/, '$1');
        break;
      }
    }
    done = false;
    clock.reset();
    ov.hide();
    targetEl.textContent = target;
    ui.set(nums);
    status.textContent = 'Tap a number, a sign, then another number.';
    draw();
  }

  function draw() {
    solvedEl.textContent = solved;
    undoBtn.disabled = !ui.canUndo() || done;
  }

  const ui = Combine.board({
    numsEl: document.getElementById('nums'),
    opsEl: document.getElementById('ops'),
    integers: true,
    onStep(tiles, warning) {
      clock.start();
      draw();
      if (warning) { status.textContent = warning; return; }
      if (tiles.some(t => Combine.eq(t.f, target))) {
        done = true;
        solved++;
        MG.store.set('target-solved', solved);
        const ms = clock.stop();
        draw();
        status.textContent = 'Right on target.';
        ov.show('Right on target', `${target} in ${MG.fmt(ms)}.`, 'Next round', newRound, 500);
        return;
      }
      const closest = tiles.reduce((m, t) => Math.min(m, Math.abs(t.f.n - target)), Infinity);
      status.textContent = `Closest so far: ${closest} away.`;
    },
  });

  undoBtn.addEventListener('click', () => { if (!done && ui.undo()) status.textContent = 'Step taken back.'; });
  document.getElementById('show').addEventListener('click', () => {
    if (done) return;
    done = true;
    clock.stop();
    draw();
    ov.show('One way', `${answer} = ${target}`, 'Next round', newRound, 0);
  });
  MG.seg(document.getElementById('level'), level, v => { level = v; MG.store.set('target-level', v); newRound(); });
  newRound();
})();
