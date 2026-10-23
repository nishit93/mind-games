// Shared playing cards for the solitaire games.
(() => {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RANK_NAMES = ['', 'ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];

  const red = c => c.suit === 1 || c.suit === 2;
  const name = c => `${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit]}`;

  // A shuffled 52-card deck: { id, rank 1–13, suit 0–3 }.
  function deck() {
    const d = [];
    for (let suit = 0; suit < 4; suit++) for (let rank = 1; rank <= 13; rank++) d.push({ id: suit * 13 + rank, rank, suit });
    return MG.shuffle(d);
  }

  // Card markup. opts: { up, value } where value shows the number for J, Q, K (helpful for adding games).
  function html(c, opts = {}) {
    if (!opts.up) return `<div class="card down" data-id="${c.id}" role="img" aria-label="Face-down card"></div>`;
    const v = opts.value && c.rank > 10 ? `<small class="val">${c.rank}</small>` : '';
    return `<div class="card${red(c) ? ' red' : ''}" data-id="${c.id}" aria-label="${name(c)}">
      <span class="corner">${RANKS[c.rank]}<br>${SUITS[c.suit]}</span><span class="pip">${SUITS[c.suit]}</span>${v}</div>`;
  }

  window.Cards = { SUITS, RANKS, deck, html, red, name };
})();
