// Shared engine for "combine numbers to hit a target" games (Make 24, Target Number).
// Numbers are fractions {n, d}; games choose whether fractions and negatives are allowed.
(() => {
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const frac = (n, d = 1) => {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
  };
  const show = f => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);
  const eq = (f, v) => f.d === 1 && f.n === v;

  const OPS = {
    '+': (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d),
    '−': (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d),
    '×': (a, b) => frac(a.n * b.n, a.d * b.d),
    '÷': (a, b) => (b.n === 0 ? null : frac(a.n * b.d, a.d * b.n)),
  };

  // Find one way to reach target. opts: { ops, integers } where integers forbids fractions and negatives.
  function solve(nums, target, opts = {}) {
    const ops = opts.ops || Object.keys(OPS);
    const items = nums.map(v => ({ f: frac(v), e: String(v) }));
    const seen = new Set();
    function go(list) {
      for (const it of list) if (eq(it.f, target)) return it.e;
      if (list.length === 1) return null;
      const key = list.map(x => show(x.f)).sort().join(',');
      if (seen.has(key)) return null;
      seen.add(key);
      for (let i = 0; i < list.length; i++) {
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const a = list[i], b = list[j];
          for (const op of ops) {
            if ((op === '+' || op === '×') && i > j) continue;
            const f = OPS[op](a.f, b.f);
            if (!f) continue;
            if (opts.integers && (f.d !== 1 || f.n <= 0)) continue;
            const rest = list.filter((_, k) => k !== i && k !== j);
            const found = go([...rest, { f, e: `(${a.e} ${op} ${b.e})` }]);
            if (found) return found;
          }
        }
      }
      return null;
    }
    const e = go(items);
    return e && e.replace(/^\((.*)\)$/, '$1');
  }

  // UI: tiles + operator buttons. onChange(tiles) after every step.
  function board({ numsEl, opsEl, integers, onStep }) {
    let tiles = [], history = [], pick = null, op = null;
    opsEl.innerHTML = Object.keys(OPS).map(o => `<button class="op" data-op="${o}" aria-label="${{ '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' }[o]}">${o}</button>`).join('');

    function render() {
      numsEl.innerHTML = tiles.map((t, i) => `<button class="num${pick === i ? ' picked' : ''}${t.fresh ? ' fresh' : ''}" data-i="${i}">${show(t.f)}</button>`).join('');
      opsEl.querySelectorAll('.op').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.op === op)));
      tiles.forEach(t => { delete t.fresh; });
    }

    numsEl.addEventListener('click', e => {
      const b = e.target.closest('.num');
      if (!b) return;
      const i = +b.dataset.i;
      if (pick === null || op === null) { pick = pick === i ? null : i; op = op && pick !== null ? op : null; render(); return; }
      if (i === pick) { pick = null; op = null; render(); return; }
      const f = OPS[op](tiles[pick].f, tiles[i].f);
      if (!f || (integers && (f.d !== 1 || f.n <= 0))) {
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        onStep && onStep(tiles, integers ? 'Only whole numbers above zero are allowed.' : 'You can’t divide by zero.');
        return;
      }
      history.push(tiles.map(t => ({ f: t.f })));
      const next = tiles.filter((_, k) => k !== pick && k !== i);
      next.splice(Math.min(pick, i), 0, { f, fresh: true });
      tiles = next;
      pick = null;
      op = null;
      render();
      onStep && onStep(tiles);
    });

    opsEl.addEventListener('click', e => {
      const b = e.target.closest('.op');
      if (!b || pick === null) return;
      op = op === b.dataset.op ? null : b.dataset.op;
      render();
    });

    return {
      set(nums) { tiles = nums.map(v => ({ f: frac(v) })); history = []; pick = null; op = null; render(); },
      undo() { if (!history.length) return false; tiles = history.pop(); pick = null; op = null; render(); onStep && onStep(tiles); return true; },
      tiles: () => tiles,
      canUndo: () => history.length > 0,
    };
  }

  window.Combine = { solve, board, show, eq, frac };
})();
