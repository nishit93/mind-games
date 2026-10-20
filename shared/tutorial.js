// Gesture tutorials: a short, animated "how do I move?" for each game, shown when a player opens a game they have
// not yet won. A dot shows the gesture (tap, drag, swipe or press-and-hold) on the real board, with one plain sentence
// for each step. It disappears as soon as the player touches the board, and it never comes back for a game once a
// level of it has been won (shell.js records that). The ? button and "Show me a quick demo" replay it any time.
//
// Loaded on demand by shell.js, so a missing or broken file can never stop a game from loading or being played.
(() => {
  // Where a step points: a selector with an optional |index (|mid = middle, |-1 = last), or [x, y] as fractions of the board.
  const tap = (say, at) => ({ say, act: 'tap', at });
  const tap2 = (say, at, to) => ({ say, act: 'tap2', at, to });
  const drag = (say, at, to) => ({ say, act: 'drag', at, to });
  const swipe = (say, at, to) => ({ say, act: 'swipe', at, to });
  const hold = (say, at) => ({ say, act: 'hold', at });
  const look = say => ({ say, act: 'look' });

  const keyThen = (cell, key) => [
    tap2('Tap an empty square, then tap a number.', cell, key),
  ];

  const STEPS = {
    'sudoku': [...keyThen('.cell|mid', '.key|4'), look('Each row, column and box must hold every number once.')],
    'nonogram': [tap('Tap a square to fill it. The numbers say how many squares to fill in each line.', '.nc|mid'), drag('Drag across squares to fill several at once.', '.nc|0', '.nc|3')],
    'binary': [tap('Tap a circle: once for brown, twice for peach, three times to clear it.', '.b|mid'), look('No three of the same colour in a row, and each line has equal amounts of both.')],
    'futoshiki': [...keyThen('.lc|mid', '.pad button|2'), look('The < and > signs must be true: they point at the smaller number.')],
    'skyscrapers': [...keyThen('.lc|mid', '.pad button|2'), look('Each number is a building height. The clues say how many you can see from that side.')],
    'tents': [tap('Tap a square to place a tent. Tap again for grass, and once more to clear it.', '.t|mid'), look('Every tree needs one tent beside it. Tents never touch each other.')],
    'mines': [tap('Tap a square to dig it. The number shows how many mines touch it.', '.m|mid'), hold('Press and hold a square to flag a mine. Or switch to Flag mode.', '.m|0')],
    'lights-off': [tap('Tap a light. It flips, and so do its neighbours.', '.light|4'), look('Switch every light off to win.')],
    'pipes': [tap('Tap a tile to turn it a quarter turn.', '.p|mid'), look('Connect every pipe to the water source.')],
    'colour-flood': [tap('Tap a colour. Your area, top left, changes to it and soaks up its neighbours.', '.sw|1'), look('Fill the whole board with one colour in as few moves as you can.')],
    'eight-queens': [tap('Tap a square to place a queen. Tap it again to remove it.', '.sq|mid'), look('No two queens may be in the same row, column or diagonal.')],
    'knights-tour': [tap('Tap a square to place the knight, then tap a ringed square to jump there in an L shape.', '.sq|mid'), look('Visit every square once.')],
    'bulls-and-cows': [tap2('Tap digits to type a guess, then press Guess.', '.key|2', '.key|5'), look('A filled dot is a right digit in the right place. A ring is a right digit in the wrong place.')],
    'magic-square': [...keyThen('.cell|0', '.key|2'), look('Every row, column and corner line must add up to the same total.')],
    'make-24': [tap2('Tap a number, then a sign, then a second number. They join into one.', '.nums > *|0', '.ops > *|0'), look('Keep joining until one number is left. Make it 24.')],
    'target-number': [tap2('Tap a number, then a sign, then a second number. They join into one.', '.nums > *|0', '.ops > *|0'), look('Make the target number. You do not have to use every number.')],
    'number-pyramid': [...keyThen('.brick|-1', '.key|2'), look('Each brick is the sum of the two bricks under it.')],
    'cages': [...keyThen('.cg > *|0', '.pad button|2'), look('Each outlined cage shows a target and a sign. Its numbers must make that target.')],
    'water-jugs': [tap2('Tap one jug, then another, to pour the first into the second.', '.jug|0', '.jug|1'), look('Measure exactly the amount in the goal.')],
    'chinese-rings': [tap('Tap a ring that glows to take it off, or to put it back on.', '.ring|0'), look('Some rings must go back on to free the others. Free them all.')],
    'tchoukaillon': [tap('Tap a pit to sow its seeds towards the store, one in each pit.', '.pit|2'), look('The last seed must land in the store. Pit 3 needs exactly 3 seeds.')],
    '15-puzzle': [tap('Tap a tile next to the gap to slide it in.', '.tile|mid'), look('Put the numbers in order. A tile turns peach when it is home.')],
    'hanoi': [tap2('Tap a peg to lift its top disc, then tap another peg to put it down.', '.peg|0', '.peg|2'), look('Never put a bigger disc on a smaller one. Move the whole tower to the right peg.')],
    'huarong-dao': [swipe('Swipe a block towards the empty space to slide it.', '.piece|mid', [0.5, 0.85]), look('Slide the big block to the exit at the bottom.')],
    'traffic-jam': [swipe('Swipe a car along its lane. Cars only go forwards or backwards.', '.car|1', '.car|2'), look('Clear a path and drive the red car out of the exit.')],
    'warehouse': [tap('Use the arrows to walk. Walk into a crate to push it.', '.dpad button|0'), look('Push every crate onto a spot. You can only push, never pull.')],
    'pentominoes': [tap2('Tap a piece in the tray, then tap a square in the box to drop it in.', '.piece-btn|0', '.bc|mid'), look('Turn or flip a piece first with the buttons. Fill the whole box.')],
    'peg-solitaire': [tap2('Tap a peg, then tap the ringed hole it can jump into.', '.hole|mid', '.hole|0'), look('The jumped peg is removed. Finish with as few pegs as you can.')],
    '2048': [swipe('Swipe up, down, left or right. Every tile slides that way.', [0.7, 0.5], [0.3, 0.5]), look('When two tiles with the same number touch, they merge. Make 2048.')],
    'memory': [tap2('Tap a card to flip it, then tap a second card to look for its match.', '.card-m|0', '.card-m|5'), look('Matching cards stay face up. Find every pair.')],
    'recall': [look('Press Start and watch one pad light up.'), tap('Then tap the same pads, in the same order. One more is added each round.', '.pads > *|0')],
    'schulte-table': [tap('Tap the numbers in order, 1, then 2, then 3, as fast as you can.', '.sn|0'), look('The next number to find is shown above the table.')],
    'grid-recall': [look('Press Start. Some squares glow for a moment.'), tap('Then tap every square that glowed, in any order.', '.g|3')],
    'digit-span': [look('Press Start. Digits appear one at a time. Remember them.'), tap2('Then type them back with the keypad and press Done.', '.key|1', '.key|2')],
    'klondike': [tap('Tap a card to send it where it fits. Tap the pile to turn over new cards.', '.card|mid'), look('Build down in alternating colours. Move every card to the four home piles.')],
    'pyramid': [tap2('Tap two free cards that add up to 13 to remove them.', '.card|0', '.card|1'), look('A King is 13 on its own. Tap the pile for more cards.')],
    'golf': [tap('Tap the bottom card of a column if it is one higher or lower than the pile.', '.card|mid'), look('Stuck? Tap the stock for a new card. Clear every column.')],
    'accordion': [tap('Tap a card. It moves onto the card just before it, or three before, if the suit or number matches.', '.card|mid'), look('Fold the deck into as few piles as you can.')],
    'tripeaks': [tap('Tap a face-up card on the peaks that is one higher or lower than the pile.', '.card|mid'), look('Stuck? Tap the stock for a new card. Clear all three peaks.')],
    'calculation': [tap('Tap a home row to play your card there if it fits. Otherwise tap a pile below to put it away.', '.card|0'), look('Each row climbs by a different step. Complete all four.')],
    'monte-carlo': [tap2('Tap two cards of the same number that touch, even corner to corner.', '.card|0', '.card|1'), look('Then tap Fill gaps to slide the cards together and deal new ones.')],
    'find-the-cat': [tap('Look for the cat 🐱 and tap it.', '.fcell|3'), look('Wrong guesses just wiggle. Find the cat in all eight pictures.')],
    'find-them-all': [tap('Tap every picture that matches the one in the message.', '.fcell|2'), look('A counter shows how many you have found. Find them all!')],
    'hide-and-seek': [tap('Tap a hiding place to peek behind it.', '.fcell|1'), look('Grey places are empty. Keep peeking until you find your friend.')],
    'mahjong-solitaire': [tap2('Tap two matching free tiles to remove them.', '.tile|0', '.tile|1'), look('A tile is free when nothing is on top and its left or right side is open.')],
    'maze': [swipe('Swipe across the maze to run along a corridor. You stop at a fork.', [0.2, 0.2], [0.8, 0.2]), tap('Or tap a square right next to your dot to step there.', '.mc|1'), look('Reach the peach square in the far corner.')],
    'one-stroke': [tap('Tap any point to start, then tap a glowing point to draw a line to it.', '.nd|0'), look('Draw every line once, without lifting your pen. Tap the last point to step back.')],
    'next-in-line': [tap('Look at how the numbers change, then tap the one that comes next.', '.opt|0'), look('A wrong answer ends the run, so take your time.')],
    'odd-one-out': [tap('Tap the square whose shade is a little different.', '.sq|1'), look('Each right answer makes the grid bigger and the difference smaller.')],
    'colour-word': [tap('Tap the colour the word is written in, not the word itself.', '.ckey|1'), look('There is no clock. Ten rounds make a game.')],
    'word-search': [drag('Press on a word\'s first letter and drag to its last letter.', '.wc|0', '.wc|3'), tap2('Or tap its first letter, then tap its last.', '.wc|8', '.wc|11'), look('Find every word on the list.')],
    'free-cells': [tap('Tap a card: it goes home, onto a column where it fits, or into a free cell.', '.card|mid'), look('Build down in alternating colours. Move all 52 cards to the home piles.')],
  };

  let token = 0;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

  function pick(stage, spec) {
    if (Array.isArray(spec)) { const r = stage.getBoundingClientRect(); return { x: r.left + r.width * spec[0], y: r.top + r.height * spec[1] }; }
    const [sel, idx = '0'] = String(spec || '').split('|');
    let list = [];
    try { list = [...document.querySelectorAll(sel)].filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; }); } catch {}
    if (!list.length) { const r = stage.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    const i = idx === 'mid' ? Math.floor(list.length / 2) : +idx < 0 ? list.length + +idx : Math.min(+idx, list.length - 1);
    const r = list[i].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function start({ force = false } = {}) {
    const game = window.MG && MG.game;
    const stage = document.querySelector('.stage, .board');
    const steps = game && STEPS[game.id];
    if (!steps || !stage) return false;
    token++;
    const mine = token;
    document.querySelectorAll('.coach').forEach(e => e.remove());

    const el = document.createElement('div');
    el.className = 'coach';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `How to play ${game.name}: a quick demo`);
    el.innerHTML = '<div class="coach-layer" aria-hidden="true"><i class="coach-ring"></i><i class="coach-dot"></i></div>'
      + '<div class="coach-card"><p class="coach-text" aria-live="polite"></p><div class="coach-foot"><span class="coach-steps"></span>'
      + '<button class="btn ghost coach-skip">Skip</button><button class="btn coach-next">Next</button></div></div>';
    document.body.append(el);
    const layer = el.querySelector('.coach-layer'), dot = el.querySelector('.coach-dot'), ring = el.querySelector('.coach-ring');
    const text = el.querySelector('.coach-text'), nextBtn = el.querySelector('.coach-next'), skipBtn = el.querySelector('.coach-skip');
    const dots = el.querySelector('.coach-steps');
    let i = 0, closed = false;

    const close = () => {
      if (closed) return;
      closed = true; token++;
      removeEventListener('pointerdown', onBoardTouch, true);
      removeEventListener('keydown', onKey, true);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 350);
    };
    // Touching the board means "I've got it": the demo steps aside and the touch goes through to the game.
    const onBoardTouch = e => { if (e.target.closest && e.target.closest('.coach-card')) return; if (stage.contains(e.target)) close(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    addEventListener('pointerdown', onBoardTouch, true);
    addEventListener('keydown', onKey, true);
    skipBtn.addEventListener('click', close);
    nextBtn.addEventListener('click', () => { if (i >= steps.length - 1) close(); else show(i + 1); });

    const at = (p, scale = 1, opacity = 1) => `translate(${p.x - 19}px, ${p.y - 19}px) scale(${scale})`;
    async function perform(step, run) {
      const a = pick(stage, step.at), b = step.to ? pick(stage, step.to) : a;
      layer.hidden = step.act === 'look';
      dot.style.opacity = 0; ring.style.opacity = 0;
      if (step.act === 'look') { stage.classList.add('coach-glow'); return; }
      stage.classList.remove('coach-glow');
      const place = (p, s = 1) => { dot.style.transform = at(p, s); ring.style.transform = `translate(${p.x - 24}px, ${p.y - 24}px)`; };
      place(a);
      if (reduced()) { dot.style.opacity = 1; return; }
      const ripple = async p => {
        ring.style.transform = `translate(${p.x - 24}px, ${p.y - 24}px)`;
        ring.animate([{ opacity: 0.7, scale: 0.4 }, { opacity: 0, scale: 1.5 }], { duration: 650, easing: 'ease-out' });
        await wait(450);
      };
      while (run === token && !closed) {
        dot.style.opacity = 1;
        dot.animate([{ transform: at(a, 1.5), opacity: 0 }, { transform: at(a, 1), opacity: 1 }], { duration: 350, fill: 'forwards' });
        await wait(450);
        if (run !== token) return;
        if (step.act === 'tap' || step.act === 'tap2') {
          await dot.animate([{ transform: at(a, 1) }, { transform: at(a, 0.8) }, { transform: at(a, 1) }], { duration: 260 }).finished.catch(() => {});
          await ripple(a);
          if (step.act === 'tap2' && run === token) {
            await dot.animate([{ transform: at(a, 1) }, { transform: at(b, 1) }], { duration: 500, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {});
            await dot.animate([{ transform: at(b, 1) }, { transform: at(b, 0.8) }, { transform: at(b, 1) }], { duration: 260 }).finished.catch(() => {});
            await ripple(b);
          }
        } else if (step.act === 'hold') {
          dot.animate([{ transform: at(a, 1) }, { transform: at(a, 0.8) }], { duration: 200, fill: 'forwards' });
          ring.animate([{ opacity: 0.8, scale: 0.4 }, { opacity: 0.2, scale: 1.6 }], { duration: 1100, easing: 'ease-out' });
          await wait(1200);
        } else {
          dot.animate([{ transform: at(a, 1) }, { transform: at(a, 0.8) }], { duration: 160, fill: 'forwards' });
          await wait(180);
          await dot.animate([{ transform: at(a, 0.8) }, { transform: at(b, 0.8) }], { duration: step.act === 'swipe' ? 420 : 750, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.catch(() => {});
        }
        await wait(300);
        if (run !== token) return;
        await dot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished.catch(() => {});
        await wait(500);
      }
    }
    function show(n) {
      i = n;
      const step = steps[n];
      text.textContent = step.say;
      nextBtn.textContent = n >= steps.length - 1 ? 'Got it' : 'Next';
      dots.innerHTML = steps.map((_, k) => `<b class="${k === n ? 'on' : ''}"></b>`).join('');
      token++;
      perform(step, token);
    }
    setTimeout(() => { if (!closed && mine <= token) show(0); }, force ? 50 : 850);
    return true;
  }

  // Selectors in this game's steps that match nothing on the page (used by the site test, so a renamed element is caught).
  function missing() {
    const game = window.MG && MG.game;
    const out = [];
    for (const step of (game && STEPS[game.id]) || []) {
      for (const spec of [step.at, step.to]) {
        if (!spec || Array.isArray(spec)) continue;
        const sel = String(spec).split('|')[0];
        let found = 0;
        try { found = document.querySelectorAll(sel).length; } catch {}
        if (!found) out.push(sel);
      }
    }
    return out;
  }

  window.MGTutorial = { start, missing, has: id => !!STEPS[id] };
})();
