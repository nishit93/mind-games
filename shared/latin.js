// Shared helpers for Latin-square puzzles (Futoshiki, Skyscrapers): every row and column holds 1..n once.
(() => {
  // A random Latin square, as a flat array of n*n values 1..n.
  function random(n) {
    const rows = MG.shuffle([...Array(n).keys()]), cols = MG.shuffle([...Array(n).keys()]);
    const sym = MG.shuffle([...Array(n).keys()].map(k => k + 1));
    return Array.from({ length: n * n }, (_, i) => sym[(rows[Math.floor(i / n)] + cols[i % n]) % n]);
  }

  // A number pad and grid selection shared by these puzzles.
  function pad(el, n, onPick) {
    el.style.gridTemplateColumns = `repeat(${n + 1}, 1fr)`;
    el.innerHTML = [...Array(n).keys()].map(k => `<button class="key" data-v="${k + 1}">${k + 1}</button>`).join('')
      + '<button class="key" data-v="0" aria-label="Clear">⌫</button>';
    el.onclick = e => { const k = e.target.closest('[data-v]'); if (k) onPick(+k.dataset.v); };
  }

  // Keyboard: digits, Backspace, arrow keys to move the selection.
  function keys(getN, getSel, setSel, onPick) {
    document.addEventListener('keydown', e => {
      const n = getN(), sel = getSel();
      if (new RegExp(`^[1-${n}]$`).test(e.key)) onPick(+e.key);
      else if (e.key === 'Backspace' || e.key === 'Delete') onPick(0);
      else if (e.key.startsWith('Arrow') && sel !== null) {
        e.preventDefault();
        const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        setSel(((Math.floor(sel / n) + dr + n) % n) * n + ((sel % n) + dc + n) % n);
      }
    });
  }

  // Does value v clash with another value in its row or column?
  const clash = (g, n, i) => {
    const r = Math.floor(i / n), c = i % n, v = g[i];
    if (!v) return false;
    for (let k = 0; k < n; k++) if ((k !== c && g[r * n + k] === v) || (k !== r && g[k * n + c] === v)) return true;
    return false;
  };

  window.Latin = { random, pad, keys, clash };
})();
