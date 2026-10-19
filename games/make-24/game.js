(() => {
  const status = document.getElementById('status');
  const solvedEl = document.getElementById('solved');
  const streakEl = document.getElementById('streak');
  const undoBtn = document.getElementById('undo');
  const ov = MG.overlay(document.querySelector('.stage'));

  let level = MG.kids ? 'easy' : MG.store.get('m24-level') || 'easy';
  let deal, answer, done;
  const tally = MG.store.json('m24-tally') || { solved: 0, streak: 0 };

  // Easy: solvable with + − × alone. Tricky: needs ÷ (or fractions).
  function newDeal() {
    for (;;) {
      deal = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 9));
      const plain = Combine.solve(deal, 24, { ops: ['+', '−', '×'] });
      if (level === 'easy' && plain) { answer = plain; break; }
      if (level === 'tricky' && !plain) { answer = Combine.solve(deal, 24); if (answer) break; }
    }
    done = false;
    ov.hide();
    ui.set(deal);
    status.textContent = 'Tap a number, a sign, then another number.';
    draw();
  }

  function draw() {
    solvedEl.textContent = tally.solved;
    streakEl.textContent = tally.streak;
    undoBtn.disabled = !ui.canUndo() || done;
  }

  const ui = Combine.board({
    numsEl: document.getElementById('nums'),
    opsEl: document.getElementById('ops'),
    onStep(tiles, warning) {
      draw();
      if (warning) { status.textContent = warning; return; }
      if (tiles.length > 1) { status.textContent = `${tiles.length} numbers left.`; return; }
      if (Combine.eq(tiles[0].f, 24)) {
        done = true;
        tally.solved++;
        tally.streak++;
        MG.store.set('m24-tally', JSON.stringify(tally));
        draw();
        status.textContent = 'That makes 24.';
        ov.show('24', `Nicely done. That's ${tally.solved} solved.`, 'Next deal', newDeal, 500);
      } else {
        status.textContent = `That makes ${Combine.show(tiles[0].f)}, not 24. Undo and try another way.`;
      }
    },
  });

  undoBtn.addEventListener('click', () => { if (!done && ui.undo()) status.textContent = 'Step taken back.'; });
  document.getElementById('show').addEventListener('click', () => {
    if (done) return;
    done = true;
    tally.streak = 0;
    MG.store.set('m24-tally', JSON.stringify(tally));
    draw();
    ov.show('One way', `${answer} = 24`, 'Next deal', newDeal, 0);
  });
  MG.seg(document.getElementById('level'), level, v => { level = v; MG.store.set('m24-level', v); newDeal(); });
  newDeal();
})();
