(() => {
  const slotsEl = document.getElementById('slots');
  const historyEl = document.getElementById('history');
  const keypad = document.getElementById('keypad');
  const countEl = document.getElementById('count');
  const bestEl = document.getElementById('best');
  const ov = MG.overlay(document.querySelector('.stage'));

  let len = +MG.store.get('bulls-len') || 4;
  let secret, guess, guesses, done;

  keypad.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button class="key" data-d="${d}">${d}</button>`).join('')
    + '<button class="key wide" data-act="del" aria-label="Delete">⌫</button><button class="key go" data-act="go">Guess</button>';

  function newGame(size = len) {
    len = size;
    MG.store.set('bulls-len', len);
    secret = MG.shuffle([...'0123456789']).slice(0, len).join('');
    guess = '';
    guesses = [];
    done = false;
    ov.hide();
    render();
  }

  function score(g) {
    let bulls = 0, cows = 0;
    [...g].forEach((d, i) => {
      if (secret[i] === d) bulls++;
      else if (secret.includes(d)) cows++;
    });
    return { bulls, cows };
  }

  function render() {
    slotsEl.innerHTML = Array.from({ length: len }, (_, i) =>
      `<div class="slot${i === guess.length && !done ? ' next' : ''}">${guess[i] ?? ''}</div>`).join('');

    historyEl.innerHTML = guesses.length
      ? guesses.map((g, i) => {
        const pips = '<span class="pip bull"></span>'.repeat(g.bulls) + '<span class="pip cow"></span>'.repeat(g.cows)
          || '<span class="pip none"></span>';
        const words = `${g.bulls} bull${g.bulls === 1 ? '' : 's'}, ${g.cows} cow${g.cows === 1 ? '' : 's'}`;
        return `<li><span class="n">${i + 1}</span><span class="g">${g.guess}</span><span class="pips" aria-label="${words}">${pips}</span><span class="result">${g.bulls}B ${g.cows}C</span></li>`;
      }).reverse().join('')
      : '<li class="empty">Make a first guess. Any digits will do.</li>';

    keypad.querySelectorAll('[data-d]').forEach(k => { k.disabled = done || guess.includes(k.dataset.d) || guess.length === len; });
    keypad.querySelector('[data-act="del"]').disabled = done || !guess.length;
    keypad.querySelector('[data-act="go"]').disabled = done || guess.length !== len;
    countEl.textContent = guesses.length;
    bestEl.textContent = MG.store.get(`bulls-best-${len}`) || '–';
  }

  function press(d) {
    if (done || guess.length >= len || guess.includes(d)) return;
    guess += d;
    render();
  }

  function del() {
    if (done) return;
    guess = guess.slice(0, -1);
    render();
  }

  function submit() {
    if (done || guess.length !== len) return;
    const s = score(guess);
    guesses.push({ guess, ...s });
    guess = '';
    if (s.bulls === len) {
      done = true;
      const n = guesses.length;
      const prev = +MG.store.get(`bulls-best-${len}`);
      if (!prev || n < prev) MG.store.set(`bulls-best-${len}`, n);
      ov.show('Cracked it', `The number was ${secret}. You needed ${n} guess${n === 1 ? '' : 'es'}.`, 'Play again', () => newGame());
    }
    render();
  }

  keypad.addEventListener('click', e => {
    const k = e.target.closest('button');
    if (!k) return;
    if (k.dataset.d) press(k.dataset.d);
    else if (k.dataset.act === 'del') del();
    else submit();
  });

  document.addEventListener('keydown', e => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') del();
    else if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });

  document.getElementById('reveal').addEventListener('click', () => {
    if (done) return;
    done = true;
    render();
    ov.show('The secret', `It was ${secret}. Another round?`, 'New game', () => newGame(), 0);
  });
  document.getElementById('new').addEventListener('click', () => newGame());
  MG.seg(document.getElementById('size'), len, v => newGame(+v));
  newGame();
})();
