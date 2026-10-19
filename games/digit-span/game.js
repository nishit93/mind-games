(() => {
  const big = document.getElementById('big');
  const typedEl = document.getElementById('typed');
  const answerEl = document.getElementById('answer');
  const lenEl = document.getElementById('len');
  const livesEl = document.getElementById('lives');
  const bestEl = document.getElementById('best');
  const padEl = document.getElementById('pad');
  const startBtn = document.getElementById('start');
  const ov = MG.overlay(document.querySelector('.stage'));

  let mode = MG.kids ? 'forward' : MG.store.get('span-mode') || 'forward';
  let len, lives, digits, typed, listening = false, round = 0, bestThisGame;

  padEl.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button class="key" data-d="${d}">${d}</button>`).join('')
    + '<button class="key wide" data-act="del" aria-label="Delete">⌫</button><button class="key go" data-act="go">Done</button>';

  function draw() {
    lenEl.textContent = len;
    livesEl.textContent = '●'.repeat(lives) + '○'.repeat(2 - lives);
    bestEl.textContent = MG.store.get(`span-best-${mode}`) || '–';
    padEl.querySelectorAll('button').forEach(b => { b.disabled = !listening; });
    typedEl.textContent = typed;
  }

  async function play() {
    const id = ++round;
    listening = false;
    typed = '';
    digits = '';
    for (let k = 0; k < len; k++) {
      let d;
      do d = String(Math.floor(Math.random() * 10)); while (d === digits.at(-1));
      digits += d;
    }
    answerEl.textContent = `Watch ${len} digits.`;
    draw();
    await MG.wait(700);
    for (const d of digits) {
      if (id !== round) return;
      big.textContent = d;
      big.classList.remove('show'); void big.offsetWidth; big.classList.add('show');
      await MG.wait(1000);
    }
    if (id !== round) return;
    big.textContent = '';
    listening = true;
    answerEl.textContent = mode === 'forward' ? 'Type them in the same order.' : 'Type them in reverse order.';
    draw();
  }

  async function submit() {
    if (!listening || !typed) return;
    listening = false;
    const want = mode === 'forward' ? digits : [...digits].reverse().join('');
    if (typed === want) {
      bestThisGame = len;
      const best = Math.max(len, +MG.store.get(`span-best-${mode}`) || 0);
      MG.store.set(`span-best-${mode}`, best);
      answerEl.textContent = `Right: ${want}. One more digit next.`;
      len++;
      lives = 2;
      draw();
      await MG.wait(1300);
      play();
      return;
    }
    lives--;
    answerEl.textContent = `It was ${want}.`;
    draw();
    if (!lives) {
      ov.show(bestThisGame ? `${bestThisGame} digits` : 'Keep practising', bestThisGame ? `You held ${bestThisGame} digits ${mode === 'forward' ? 'forwards' : 'backwards'}.` : 'Try grouping the digits in pairs as they appear.', 'Play again', start, 900);
      return;
    }
    await MG.wait(1800);
    play();
  }

  function start() {
    len = 3;
    lives = 2;
    bestThisGame = 0;
    ov.hide();
    startBtn.textContent = 'Restart';
    play();
  }

  function press(d) {
    if (!listening || typed.length >= len + 2) return;
    typed += d;
    draw();
  }

  padEl.addEventListener('click', e => {
    const k = e.target.closest('button');
    if (!k) return;
    if (k.dataset.d) press(k.dataset.d);
    else if (k.dataset.act === 'del') { typed = typed.slice(0, -1); draw(); }
    else submit();
  });
  document.addEventListener('keydown', e => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace' && listening) { typed = typed.slice(0, -1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  startBtn.addEventListener('click', start);
  MG.seg(document.getElementById('mode'), mode, v => { mode = v; MG.store.set('span-mode', v); round++; listening = false; startBtn.textContent = 'Start'; answerEl.textContent = 'Press Start and watch the digits.'; len = 3; lives = 2; typed = ''; draw(); });
  len = 3;
  lives = 2;
  typed = '';
  draw();
})();
