(() => {
  const seqEl = document.getElementById('seq');
  const optsEl = document.getElementById('opts');
  const streakEl = document.getElementById('streak');
  const bestEl = document.getElementById('best');
  const status = document.getElementById('status');
  const ov = MG.overlay(document.querySelector('.stage'));
  if (!ov.win) ov.win = ov.show; // an older shell.js has no celebration: show the plain message

  let level = MG.kids ? 'easy' : (MG.store.get('nextline-level') === 'tricky' ? 'tricky' : 'easy');
  let streak = 0, q = null, locked = false, run = 0;
  window.__nextInLine = () => q; // for the site test

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const build = (first, next, count = 6) => { const out = [first]; while (out.length < count) out.push(next(out[out.length - 1], out.length - 1)); return out; };

  // Each pattern makes six numbers: five are shown and the sixth is the answer.
  const EASY = [
    () => { const k = rnd(2, 9), s = rnd(1, 20); return { seq: build(s, v => v + k), rule: `add ${k} each time`, step: k }; },
    () => { const k = rnd(2, 8), s = rnd(40, 70); return { seq: build(s, v => v - k), rule: `take away ${k} each time`, step: k }; },
    () => { const k = pick([5, 10, 25, 3, 4]), s = pick([0, k, 2 * k]); return { seq: build(s, v => v + k), rule: `count up in ${k}s`, step: k }; },
    () => { const a = rnd(1, 4), b = rnd(a + 1, 6), s = rnd(1, 10); return { seq: build(s, (v, i) => v + (i % 2 ? b : a)), rule: `add ${a}, then ${b}, then ${a}, then ${b}…`, step: a }; },
    () => { const k = rnd(2, 3), s = rnd(1, 3); return { seq: build(s, v => v * k, 6), rule: `multiply by ${k} each time`, step: 1 }; },
  ];
  const TRICKY = [
    () => { const m = pick([2, 3]), s = rnd(1, 4); return { seq: build(s, v => v * m), rule: `multiply by ${m} each time`, step: 1 }; },
    () => { const o = rnd(1, 5); return { seq: build((o) * (o), (v, i) => (o + i + 1) * (o + i + 1)), rule: 'square numbers: 1×1, 2×2, 3×3…', step: 2 }; },
    () => { const o = rnd(1, 4); const t = n => (n * (n + 1)) / 2; return { seq: Array.from({ length: 6 }, (_, i) => t(o + i)), rule: 'triangular numbers: add 1 more each time', step: 2 }; },
    () => { const s = rnd(1, 9), d = rnd(1, 3); return { seq: build(s, (v, i) => v + d + i), rule: `the jump grows by 1 each time (+${d}, +${d + 1}, +${d + 2}…)`, step: 2 }; },
    () => { const a = rnd(1, 4), b = rnd(2, 6); return { seq: fib(a, b), rule: 'add the two numbers before it', step: 3 }; },
    () => { const s = rnd(1, 3); return { seq: build(s, v => v * 2 + 1), rule: 'double it, then add 1', step: 2 }; },
    () => { const k = rnd(3, 6), s = rnd(60, 120); return { seq: build(s, (v, i) => v - k - i), rule: `take away ${k}, then ${k + 1}, then ${k + 2}…`, step: 2 }; },
  ];
  function fib(a, b) { const out = [a, b]; while (out.length < 6) out.push(out[out.length - 1] + out[out.length - 2]); return out; }

  function question() {
    const p = pick(level === 'tricky' ? TRICKY : EASY)();
    const shown = p.seq.slice(0, 5), answer = p.seq[5];
    const wrong = new Set();
    const tries = [answer + 1, answer - 1, answer + 2, answer - 2, answer + p.step, answer - p.step, answer + 10, answer * 2, shown[4] + (shown[4] - shown[3]) + 1, shown[4]];
    for (const t of MG.shuffle(tries)) if (t > 0 && t !== answer && wrong.size < 3) wrong.add(t);
    for (let k = 3; wrong.size < 3; k++) wrong.add(answer + k);
    return { shown, answer, rule: p.rule, options: MG.shuffle([answer, ...wrong]) };
  }

  function next() {
    q = question();
    locked = false;
    seqEl.replaceChildren(...q.shown.map(v => { const s = document.createElement('span'); s.className = 'sn-item'; s.textContent = v; return s; }),
      Object.assign(document.createElement('span'), { className: 'sn-item q', textContent: '?' }));
    optsEl.replaceChildren(...q.options.map(v => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.textContent = v;
      b.addEventListener('click', () => answer(v, b));
      return b;
    }));
    status.textContent = 'What number comes next?';
    streakEl.textContent = streak;
  }

  async function answer(v, btn) {
    if (locked) return;
    locked = true;
    const mine = run;
    if (v === q.answer) {
      btn.classList.add('right');
      streak++;
      const best = Math.max(streak, +MG.store.get('nextline-best') || 0);
      MG.store.set('nextline-best', best);
      bestEl.textContent = best;
      streakEl.textContent = streak;
      seqEl.lastChild.textContent = q.answer;
      status.textContent = `Yes: ${q.rule}.`;
      await MG.wait(1400);
      if (mine === run) next();
      return;
    }
    btn.classList.add('wrong');
    [...optsEl.children].forEach(b => { if (+b.textContent === q.answer) b.classList.add('right'); });
    seqEl.lastChild.textContent = q.answer;
    status.textContent = `The rule was: ${q.rule}.`;
    const got = streak;
    await MG.wait(900);
    if (mine !== run) return;
    (got >= 3 ? ov.win : ov.show)(got ? `${got} in a row` : 'Not quite',
      `The next number was ${q.answer}: ${q.rule}.${got >= 3 ? ' Lovely thinking.' : ''}`, 'Play again', start, 300);
  }

  function start() {
    run++;
    streak = 0;
    ov.hide();
    bestEl.textContent = MG.store.get('nextline-best') || '–';
    next();
  }

  document.getElementById('new').addEventListener('click', start);
  MG.seg(document.getElementById('level'), level, v => { level = v; MG.store.set('nextline-level', v); start(); });
  start();
})();
